'use strict';
/**
 * 支付宝开放平台文档抓取核心。
 *
 * 支付宝 opendocs / opendoc 是 JS 渲染的 SPA，正文、代码块、参数、图片大量依赖
 * 懒加载与折叠交互，直接抓 HTML / innerText 会大面积缺失。本模块封装了一套
 * 经实战验证的抓取流程，详见仓库根 PLAYBOOK.md（维护者文档）。
 */

/** 解析 playwright（优先项目本地，回退全局 homebrew 安装） */
function loadChromium() {
  try { return require('playwright').chromium; } catch (e) {}
  const { execSync } = require('child_process');
  try {
    const root = execSync('npm root -g').toString().trim();
    return require(root + '/playwright').chromium;
  } catch (e) {}
  throw new Error('未找到 playwright，请在项目内执行 `npm install` 或全局 `npm i -g playwright`，并 `npx playwright install chromium`。');
}

/**
 * 抓取单个文档页，返回结构化数据。
 * 自动判断页面类型：
 *   - 文档页（有 .docs-article-content）：返回 { type:'doc', text(含@@占位), codes, tables, imgs }
 *   - API 接口页：返回 { type:'api', intro, sections:[{title,text,params,tables,pres,link}] }
 */
async function fetchDoc(page, url) {
  // 健壮导航：domcontentloaded 快速可靠；再等 article 渲染；networkidle 仅尽力而为
  // （轮询型 SPA 常永不触发 networkidle，原先 waitUntil:'networkidle' 会因此 60s 超时整篇失败）
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('article', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // 1) 滚动遍历，触发懒加载（CodeMirror 代码块、隐藏 table 等用 IntersectionObserver 懒渲染）
  await page.evaluate(async () => {
    const ns = document.querySelectorAll('article *');
    for (let i = 0; i < ns.length; i += 8) {
      try { ns[i].scrollIntoView({ block: 'center' }); } catch (e) {}
      await new Promise(r => setTimeout(r, 22));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);

  // 2) 展开「更多」（枚举值）/「子属性」（嵌套对象）。每个 <a> 只点一次（持久标记防 toggle 死循环），
  //    用真实 locator.click —— React 合成事件下 el.click() 无效；触发器是 <a class="toggle">，不是内层 span。
  for (let i = 0; i < 300; i++) {
    const found = await page.evaluate(() => {
      const a = document.querySelector('article'); if (!a) return false;
      const t = Array.from(a.querySelectorAll('a')).find(el =>
        !el.dataset.__done && ['更多', '子属性'].includes((el.innerText || '').trim()));
      if (!t) return false;
      t.dataset.__done = '1'; t.setAttribute('data-__cid', 'TGT'); return true;
    });
    if (!found) break;
    try {
      const loc = page.locator('article a[data-__cid="TGT"]');
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
      await loc.click({ timeout: 2000 });
    } catch (e) {}
    await page.evaluate(() => { const e = document.querySelector('article a[data-__cid="TGT"]'); if (e) e.removeAttribute('data-__cid'); });
    await page.waitForTimeout(180);
  }

  // 3) 切换请求示例的 Java tab（默认是 cURL=language-bash；点 Java 后出现 pre.language-java）
  try {
    const javaTabs = page.locator('article').getByText('Java', { exact: true });
    const jc = await javaTabs.count();
    for (let i = 0; i < jc; i++) { try { await javaTabs.nth(i).click({ timeout: 1500 }); } catch (e) {} }
    await page.waitForTimeout(600);
  } catch (e) {}

  // 4) 页面内结构化提取（自包含，不引用 node 作用域）
  const data = await page.evaluate(() => {
    const NBSP = String.fromCharCode(160);
    const a = document.querySelector('article');
    if (!a) return { error: 'no <article> found' };
    // 移除支付宝注入的「接入检测」调试浮层（非文档正文，class 形如 checkTool___xxx），避免其文案泄漏进正文
    a.querySelectorAll('[class*="checkTool"]').forEach(e => e.remove());
    const h1 = a.querySelector('h1');
    const H1 = h1 ? h1.innerText : '';
    let upd = '';
    a.querySelectorAll('*').forEach(el => { const t = (el.innerText || '').trim(); if (!upd && /^更新时间：/.test(t) && t.length < 40) upd = t; });
    const proxy = /支持第三方代理调用/.test(a.innerText);

    // rowspan / colspan 感知的表格 → 二维数组（纵向合并向下重复填值，横向合并仅首格填值、其余留空）
    function tableToRows(t) {
      const trs = Array.from(t.querySelectorAll('tr'));
      const occ = {}; const out = [];
      for (let r = 0; r < trs.length; r++) {
        const cells = Array.from(trs[r].children).filter(e => /^(TD|TH)$/.test(e.tagName));
        const row = []; let c = 0;
        const fill = () => { while (occ[r + ',' + c] !== undefined) { row[c] = occ[r + ',' + c]; c++; } };
        for (const cell of cells) {
          fill();
          const txt = cell.innerText.trim().replace(/\s*\n\s*/g, ' ');
          const cs = parseInt(cell.getAttribute('colspan') || '1', 10);
          const rs = parseInt(cell.getAttribute('rowspan') || '1', 10);
          for (let k = 0; k < cs; k++) { const v = (k === 0) ? txt : ''; row[c] = v; for (let rr = 1; rr < rs; rr++) occ[(r + rr) + ',' + c] = v; c++; }
        }
        fill();
        out.push(row);
      }
      return out;
    }

    const dac = a.querySelector('.docs-article-content');
    if (dac) {
      // ===== 文档页：占位流方案（代码块/表格/图片替换为 @@占位@@，保留正文位置）=====
      const root = dac;
      const codes = [], tables = [], imgs = [];
      // 让隐藏面板(Tab/折叠)中的 CodeMirror 可见，否则占位 div 不进 innerText
      root.querySelectorAll('.cm-editor').forEach(ed => { let p = ed; while (p && p !== root.parentElement) { try { if (getComputedStyle(p).display === 'none') p.style.display = 'block'; } catch (e) {} p = p.parentElement; } });
      root.querySelectorAll('.cm-editor').forEach((ed, idx) => {
        const lines = Array.from(ed.querySelectorAll('.cm-line')).map(l => l.textContent.split(NBSP).join(' ').replace(/\s+$/, ''));
        codes.push({ idx, code: lines.join('\n') });
        const ph = document.createElement('div'); ph.textContent = '@@CODE' + idx + '@@'; ed.replaceWith(ph);
      });
      root.querySelectorAll('table').forEach((t, idx) => { tables.push({ idx, rows: tableToRows(t) }); const ph = document.createElement('div'); ph.textContent = '@@TABLE' + idx + '@@'; t.replaceWith(ph); });
      root.querySelectorAll('img').forEach((img, idx) => { imgs.push({ idx, src: img.src, alt: img.alt || '' }); const ph = document.createElement('div'); ph.textContent = '@@IMG' + idx + '@@'; img.replaceWith(ph); });
      return { type: 'doc', h1: H1, upd, proxy, text: root.innerText, codes, tables, imgs };
    }

    // ===== API 接口页：通用按 H2 分段（不硬编码 section 名，兼容通知/回调类接口）=====
    const all = Array.from(a.querySelectorAll('*'));
    const h2s = Array.from(a.querySelectorAll('h2'));

    // 从 .paramsRow 卡片提取单个参数（卡片视图含嵌套子属性，table 视图不含）
    function parseRow(row) {
      let p = row.parentElement, depth = 0;
      while (p && p !== a) { if (/paramsRow/.test(p.className || '')) depth++; p = p.parentElement; }
      const name = (row.querySelector('.isp-field-name') || {}).textContent || '';
      const content = row.querySelector('[class*=content]');
      const titleDiv = content ? content.querySelector('div') : null;
      let cn = '';
      if (titleDiv) { const ss = Array.from(titleDiv.querySelectorAll('[class*=fieldTitle] strong')); if (ss[1]) cn = ss[1].textContent.replace(/^｜/, ''); }
      const dts = titleDiv ? Array.from(titleDiv.querySelectorAll('[class*=dataType]')).map(s => s.textContent.trim()) : [];
      const required = dts.find(x => ['必选', '可选', '条件必选'].includes(x)) || '';
      const type = dts.find(x => !['必选', '可选', '条件必选'].includes(x) && !/^\(.*\)$/.test(x)) || '';
      const lenM = dts.find(x => /^\(.*\)$/.test(x));
      const len = lenM ? lenM.replace(/[()]/g, '') : '';
      const fd = row.querySelector('[class*=fieldDes]'); // 第一个=本行（带换行的真实 innerText，勿 clone 否则枚举粘连）
      return { depth, name, cn, required, type, len, desc: fd ? fd.innerText : '' };
    }

    function rangeContent(start, end) {
      const slice = all.slice(start + 1, end);
      const params = [], tables = [], pres = []; let link = '';
      const skip = new Set();
      slice.forEach(e => { if (/paramsRow/.test(e.className || '') || ['TABLE', 'PRE'].includes(e.tagName)) { skip.add(e); e.querySelectorAll('*').forEach(c => skip.add(c)); } });
      let txt = '';
      slice.forEach(e => {
        if (/paramsRow/.test(e.className || '')) { params.push(parseRow(e)); return; }
        if (e.tagName === 'TABLE') { tables.push(tableToRows(e)); return; }
        if (e.tagName === 'PRE') { const cls = (e.className || '').toString(); const lm = cls.match(/language-(\w+)/); pres.push({ lang: lm ? lm[1] : '', text: e.innerText }); return; }
        if (skip.has(e)) return;
        const direct = Array.from(e.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
        if (direct) { txt += direct + '\n'; if (!link) { const ax = e.querySelector ? e.querySelector('a') : null; if (ax && /前往查看/.test(direct)) link = ax.href; } }
      });
      if (!link) { slice.forEach(e => { if (skip.has(e)) return; if (e.tagName === 'A' && /前往查看/.test(e.innerText)) link = e.href; }); }
      return { params, tables, pres, link, text: txt.trim() };
    }

    const h1idx = all.indexOf(h1);
    const firstH2idx = h2s.length ? all.indexOf(h2s[0]) : all.length;
    const intro = rangeContent(h1idx, firstH2idx);
    const sections = [];
    for (let i = 0; i < h2s.length; i++) {
      const s = all.indexOf(h2s[i]);
      const e = i + 1 < h2s.length ? all.indexOf(h2s[i + 1]) : all.length;
      const c = rangeContent(s, e); c.title = h2s[i].innerText.trim(); sections.push(c);
    }
    return { type: 'api', h1: H1, upd, proxy, intro, sections };
  });

  // 5) DOM 漂移合理性断言：站点改版会让选择器静默失效、产出空/残缺文档而不报错。
  //    抓完即自检，把"静默退化"变成显式告警。
  if (data && !data.error) data.warnings = sanityWarnings(data);
  return data;
}

/**
 * 产出合理性自检（纯函数，可单测）。返回告警字符串数组，空数组表示正常。
 * 触发条件刻意保守，只在"几乎肯定是抓取失败"时告警，避免对正常的短文档误报。
 */
function sanityWarnings(data) {
  const w = [];
  if (!data || data.error) return w;
  if (data.type === 'doc') {
    const textLen = (data.text || '').replace(/@@\w+@@/g, '').trim().length;
    const n = (data.codes || []).length + (data.tables || []).length + (data.imgs || []).length;
    if (textLen < 200 && n === 0) {
      w.push('文档页内容异常稀少（正文 <200 字且无代码/表格/图片），疑似 DOM 选择器失效或页面未渲染完成');
    }
  } else if (data.type === 'api') {
    const secs = data.sections || [];
    if (!secs.length) {
      w.push('API 页未提取到任何 H2 分段，疑似页面结构变化');
    } else {
      const hasParamsOrTable = secs.some(s => (s.params && s.params.length) || (s.tables && s.tables.length));
      if (!hasParamsOrTable) w.push('API 页有分段但未提取到任何参数/表格，疑似 paramsRow / table 选择器失效');
    }
  }
  return w;
}

module.exports = { loadChromium, fetchDoc, sanityWarnings };
