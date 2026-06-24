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

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) { a[k.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
  }
  return a;
}

function slug(s) {
  return (s || 'doc').replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 60);
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
  const outDir = path.resolve(args.out || './output');
  const imgDir = path.join(outDir, 'images');
  fs.mkdirSync(imgDir, { recursive: true });

  let jobs = [];
  if (args.config) {
    jobs = JSON.parse(fs.readFileSync(args.config, 'utf8'));
  } else if (args.url) {
    jobs = [{ url: args.url, name: args.name || null }];
  } else {
    console.error('用法：--url <url> [--name <文件名>] | --config <urls.json>  [--out <目录>]');
    process.exit(1);
  }

  const chromium = loadChromium();
  const browser = await chromium.launch({ headless: true });
  const downloaded = new Set();
  const failed = [];     // { url, reason } —— 抓取失败的篇目
  const imgFails = [];   // 'name-idx.png' —— 下载失败、不会出现在 Markdown 里的图片
  let okCount = 0, warnCount = 0;

  for (const job of jobs) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let data;
    try { data = await fetchDoc(page, job.url); }
    catch (e) { console.error(`✗ ${job.url}\n  ${e.message}`); failed.push({ url: job.url, reason: e.message }); await page.close(); continue; }
    await page.close();

    if (data.error) { console.error(`✗ ${job.url}: ${data.error}`); failed.push({ url: job.url, reason: data.error }); continue; }

    const name = slug(job.name || data.h1);
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
