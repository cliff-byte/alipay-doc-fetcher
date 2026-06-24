'use strict';
/**
 * 把 fetch.cjs 的结构化数据确定性地渲染为 Markdown。
 * 渲染是纯机械转换：正文文字 100% 来自页面，不增删、不总结、不解读，
 * 只做格式化（占位→代码块/表格/图片、标题分层、列表符号、UI 噪音过滤、文件头）。
 */

// 站点级 UI 噪音（文档页顶部工具栏）
const UI_NOISE = new Set(['文档更新记录 >', '收藏', '订阅更新', '我的文档', '设置']);
// API 页里会混入 section 文本的交互/标签噪音
const API_NOISE = new Set(['收起所有属性', '展开所有属性', '常见请求示例', '默认示例', 'cURL', 'Java', 'C#', 'PHP', 'HTTP', '.NET', 'Python', '响应示例', '正常示例', '异常示例', '本示例仅供参考。', '说明：', '说明:']);

function mdTable(rows) {
  if (!rows || !rows.length) return '';
  const esc = c => (c || '').replace(/\|/g, '\\|');
  const cols = Math.max(...rows.map(r => r.length));
  const pad = r => { const a = r.slice(); while (a.length < cols) a.push(''); return a; };
  const out = [];
  out.push('| ' + pad(rows[0]).map(esc).join(' | ') + ' |');
  out.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
  for (let i = 1; i < rows.length; i++) out.push('| ' + pad(rows[i]).map(esc).join(' | ') + ' |');
  return out.join('\n');
}

// 数字标题 "N xxx" / "N.N xxx" / "N.N.N xxx" → ## / ### / ####（约束整行匹配且较短，防误伤正文如 "3 X 24 小时"）
function headingify(t) {
  const m = t.match(/^(\d+(?:\.\d+)*)\s+(\S.*)$/);
  if (m && t.length < 50) { const lvl = Math.min(m[1].split('.').length + 1, 4); return '#'.repeat(lvl) + ' ' + t; }
  return null;
}

// 把 .fieldDes 文本按【描述】【枚举值】【示例值】【注意事项】【必选条件】等标签切段
function parseDesc(desc) {
  const arr = (desc || '').split(/【(.+?)】/);
  const segs = [];
  for (let i = 1; i < arr.length; i += 2) segs.push({ label: arr[i], value: (arr[i + 1] || '').trim() });
  return segs;
}

// 业务参数渲染为层级列表（缩进表层级、加粗参数名表边界、枚举为子列表）
function renderParams(params) {
  if (!params || !params.length) return '';
  const out = [];
  for (const p of params) {
    const ind = '  '.repeat(p.depth || 0);
    const meta = [p.required, p.type, p.len ? ('最大长度 ' + p.len) : ''].filter(Boolean).join(' / ');
    out.push(ind + '- **' + p.name + '**' + (p.cn ? '（' + p.cn + '）' : '') + (meta ? ' — ' + meta : ''));
    for (const seg of parseDesc(p.desc)) {
      if (seg.label === '枚举值') {
        out.push(ind + '  - 枚举值：');
        seg.value.split('\n').map(x => x.trim()).filter(x => x && !['收起', '更多'].includes(x)).forEach(it => out.push(ind + '    - ' + it));
      } else {
        out.push(ind + '  - ' + seg.label + '：' + seg.value.replace(/\n+/g, ' '));
      }
    }
  }
  return out.join('\n');
}

function renderDoc(d, name, imageExists) {
  const h1 = (d.h1 || '').trim();
  const codeByIdx = {}; (d.codes || []).forEach(c => codeByIdx[c.idx] = c.code);
  const tableByIdx = {}; (d.tables || []).forEach(t => tableByIdx[t.idx] = t.rows);
  const imgByIdx = {}; (d.imgs || []).forEach(im => imgByIdx[im.idx] = im);
  const out = []; let pend = false;
  for (let raw of d.text.split('\n')) {
    let line = raw.replace(/​/g, '').replace(/\s+$/, '');
    const t = line.trim();
    if (UI_NOISE.has(t)) continue;
    if (h1 && t === h1) continue;
    if (/^更新时间：/.test(t)) continue;
    let m;
    if ((m = t.match(/^@@CODE(\d+)@@$/))) { const c = codeByIdx[+m[1]]; if (c != null) out.push('```java\n' + c + '\n```'); pend = false; continue; }
    if ((m = t.match(/^@@TABLE(\d+)@@$/))) { const r = tableByIdx[+m[1]]; if (r) out.push(mdTable(r)); pend = false; continue; }
    if ((m = t.match(/^@@IMG(\d+)@@$/))) { const idx = +m[1]; const fn = name + '-' + idx + '.png'; if (imageExists(fn)) { const im = imgByIdx[idx]; out.push('![' + (im ? (im.alt || '') : '') + '](images/' + fn + ')'); } pend = false; continue; }
    if (t === '●') { pend = true; continue; }
    if (pend) { if (t === '') { continue; } out.push('- ' + line); pend = false; continue; }
    const h = headingify(t); if (h) { out.push(h); continue; }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');
}

function renderApi(d) {
  const h1 = (d.h1 || '').trim();
  const clean = (text) => (text || '').split('\n').map(x => x.trim()).filter(x => x && !API_NOISE.has(x) && x !== h1 && x !== '支持第三方代理调用');
  const s = [];
  if (d.proxy) s.push('> 支持第三方代理调用', '');
  for (const line of clean(d.intro && d.intro.text)) { if (line === '通用场景') { s.push('## 通用场景', ''); } else { s.push(line, ''); } }
  for (const sec of (d.sections || [])) {
    s.push('## ' + sec.title, '');
    const txt = clean(sec.text).filter(x => !(sec.link && x === '前往查看')).join('\n');
    if (txt) s.push(txt, '');
    if (sec.params && sec.params.length) { s.push(renderParams(sec.params), ''); }
    else if (sec.tables && sec.tables.length) { sec.tables.forEach(t => s.push(mdTable(t), '')); }
    (sec.pres || []).forEach(p => { if (p.text && p.text.trim()) s.push('```' + (p.lang || ''), p.text.trim(), '```', ''); });
    if (sec.link) s.push('前往查看：' + sec.link, '');
  }
  return s.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '');
}

/**
 * @param data fetchDoc 返回的结构化数据（已附 name/url）
 * @param opts { imageExists:(filename)=>bool }  判断图片是否已下载（决定是否输出图片引用）
 * @returns 完整 markdown 字符串
 */
function renderMarkdown(data, opts = {}) {
  const imageExists = opts.imageExists || (() => true);
  const h1 = (data.h1 || '').trim();
  const head = ['# ' + h1, '', '> 文档来源：' + data.url];
  if (data.upd) head.push('> ' + data.upd);
  head.push('', '---', '');
  const body = data.type === 'doc' ? renderDoc(data, data.name, imageExists) : renderApi(data);
  return head.join('\n') + '\n' + body + '\n';
}

// 同时导出内部纯函数，便于单测（不影响 CLI 用法）
module.exports = { renderMarkdown, mdTable, headingify, parseDesc, renderParams };
