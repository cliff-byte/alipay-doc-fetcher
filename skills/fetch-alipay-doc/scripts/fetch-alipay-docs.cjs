#!/usr/bin/env node
'use strict';
/**
 * 支付宝开放平台文档抓取 CLI。
 *
 * 用法：
 *   node fetch-alipay-docs.cjs --url <url> [--name <文件名>] [--out <目录>]
 *   node fetch-alipay-docs.cjs --config urls.json [--out <目录>]
 *
 * config（JSON 数组）：[{ "name": "01-权限集介绍", "url": "https://opendocs.alipay.com/open/07kszv" }, ...]
 *
 * 产出：<out>/<name>.md，图片存 <out>/images/<name>-<idx>.png
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadChromium, fetchDoc } = require('./lib/fetch.cjs');
const { renderMarkdown } = require('./lib/render.cjs');
const { isInsideGlobalSkillDir } = require('./lib/paths.cjs');
const { slug, uniqueName } = require('./lib/util.cjs');
const { parseConfig, validateUrl, isAlipayDocUrl } = require('./lib/validate.cjs');

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) { a[k.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
  }
  return a;
}

// 抓取重试：networkidle 等导航对轮询型 SPA 偶发超时，失败时换新页面重试，提升成功率
async function fetchWithRetry(browser, url, attempts = 2) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try { const data = await fetchDoc(page, url); await page.close().catch(() => {}); return data; }
    catch (e) { lastErr = e; await page.close().catch(() => {}); }
  }
  throw lastErr;
}

// node 的 https 对部分支付宝图床（cdn.nlark.com）会失败，统一用 curl 更稳
function downloadImage(url, dest) {
  try {
    execFileSync('curl', ['-sSL', '--max-time', '30', '-H', 'User-Agent: Mozilla/5.0', '-H', 'Referer: https://opendocs.alipay.com/', '-o', dest, url], { stdio: 'ignore' });
    return fs.existsSync(dest) && fs.statSync(dest).size > 0;
  } catch (e) { return false; }
}

async function main() {
  const args = parseArgs(process.argv);

  // 先校验参数，再落盘，避免误操作时创建空目录。校验失败给清晰错误而非崩栈。
  let jobs = [];
  try {
    if (args.config) {
      jobs = parseConfig(fs.readFileSync(args.config, 'utf8'));
    } else if (args.url) {
      validateUrl(args.url); // 非法 URL 直接抛
      jobs = [{ url: args.url, name: args.name || null }];
    } else {
      console.error('用法：--url <url> [--name <文件名>] | --config <urls.json>  [--out <目录>]');
      process.exit(1);
    }
  } catch (e) {
    console.error(`✗ 参数错误：${e.message}`);
    process.exit(1);
  }

  // 域名提醒：非支付宝文档域名大概率抓不到正文
  for (const j of jobs) {
    if (!isAlipayDocUrl(j.url)) console.warn(`⚠ 非支付宝文档域名，可能抓不到正文：${j.url}`);
  }

  // 默认落到当前项目下的 ./alipay-docs（相对 cwd），而非 skill 安装目录
  const outDir = path.resolve(args.out || './alipay-docs');

  // 护栏：若通过 skills 全局安装（~/.claude|.codex|.cursor|.agents/skills/...），拒绝把产物写进 skill 自身目录
  const skillRoot = path.resolve(__dirname, '..');
  if (isInsideGlobalSkillDir(outDir, skillRoot)) {
    console.error(`✗ 拒绝把文档写入 Skill 安装目录：\n    ${outDir}\n  这是全局安装的 Skill 目录，抓取产物应落到你的项目里。\n  请在你的项目目录下运行，并用 --out 指定，例如：--out ./alipay-docs/<产品名>`);
    process.exit(1);
  }

  const imgDir = path.join(outDir, 'images');
  fs.mkdirSync(imgDir, { recursive: true });

  const chromium = loadChromium();
  const browser = await chromium.launch({ headless: true });
  const downloaded = new Set();
  const usedNames = new Set();  // 文件名防撞：同名 H1 不再静默覆盖
  const failed = [];     // { url, reason } —— 抓取失败的篇目
  const imgFails = [];   // 'name-idx.png' —— 下载失败、不会出现在 Markdown 里的图片
  let okCount = 0, warnCount = 0;

  for (const job of jobs) {
    let data;
    try { data = await fetchWithRetry(browser, job.url); }
    catch (e) { console.error(`✗ ${job.url}\n  ${e.message}`); failed.push({ url: job.url, reason: e.message }); continue; }

    if (data.error) { console.error(`✗ ${job.url}: ${data.error}`); failed.push({ url: job.url, reason: data.error }); continue; }

    const name = uniqueName(slug(job.name || data.h1), usedNames);
    data.url = job.url; data.name = name;

    // 下载文档页正文图片（失败的累计进 imgFails，不再静默丢弃）
    if (data.type === 'doc') {
      for (const im of (data.imgs || [])) {
        const fn = `${name}-${im.idx}.png`;
        const ok = downloadImage(im.src, path.join(imgDir, fn));
        if (ok) downloaded.add(fn);
        else imgFails.push(fn);
      }
    }

    const md = renderMarkdown(data, { imageExists: (fn) => downloaded.has(fn) });
    fs.writeFileSync(path.join(outDir, `${name}.md`), md);
    const summary = data.type === 'doc'
      ? `doc, ${(data.imgs || []).length} 图, ${(data.codes || []).length} 代码块, ${(data.tables || []).length} 表`
      : `api, ${data.sections.length} 段`;
    console.log(`✓ ${name}.md  (${summary})`);
    okCount++;
    // DOM 漂移合理性告警（来自 fetchDoc 的 sanityWarnings）
    for (const w of (data.warnings || [])) { console.warn(`  ⚠ ${name}: ${w}`); warnCount++; }
  }

  await browser.close();

  // 汇总 + 退出码：任何抓取失败或图片缺失都让进程非零退出，杜绝"静默部分失败"
  const parts = [`✓ ${okCount} 成功`];
  if (failed.length) parts.push(`✗ ${failed.length} 失败`);
  if (imgFails.length) parts.push(`⚠ ${imgFails.length} 图缺失`);
  if (warnCount) parts.push(`⚠ ${warnCount} 内容告警`);
  console.log(`\n完成：${parts.join(' / ')}。输出目录：${outDir}`);
  if (failed.length) { console.error('失败篇目：'); failed.forEach(f => console.error(`  - ${f.url}  (${f.reason})`)); }
  if (imgFails.length) console.error(`图片缺失（未写入 Markdown）：${imgFails.join(', ')}`);
  if (failed.length || imgFails.length) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
