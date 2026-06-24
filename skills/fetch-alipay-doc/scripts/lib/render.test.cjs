'use strict';
/**
 * render.cjs 纯函数单测。render 是确定性机械转换，最适合单测护栏。
 * 运行：node --test （见 package.json）
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { renderMarkdown, mdTable, headingify, parseDesc, renderParams } = require('./render.cjs');

test('mdTable: 基本表格 + 表头分隔行', () => {
  const md = mdTable([['参数', '类型'], ['app_id', 'String']]);
  assert.strictEqual(md, '| 参数 | 类型 |\n| --- | --- |\n| app_id | String |');
});

test('mdTable: 短行按最大列数补空', () => {
  const md = mdTable([['a', 'b', 'c'], ['1']]);
  assert.strictEqual(md, '| a | b | c |\n| --- | --- | --- |\n| 1 |  |  |');
});

test('mdTable: 转义竖线，避免破坏 Markdown 表格', () => {
  const md = mdTable([['a|b']]);
  assert.strictEqual(md, '| a\\|b |\n| --- |');
});

test('mdTable: 空输入返回空串', () => {
  assert.strictEqual(mdTable([]), '');
  assert.strictEqual(mdTable(null), '');
});

test('headingify: 一级/二级/三级数字标题分层', () => {
  assert.strictEqual(headingify('1 概述'), '## 1 概述');
  assert.strictEqual(headingify('1.2 接入准备'), '### 1.2 接入准备');
  assert.strictEqual(headingify('1.2.3 详细步骤'), '#### 1.2.3 详细步骤');
});

test('headingify: 层级上限封顶在 ####（4 级）', () => {
  assert.strictEqual(headingify('1.2.3.4 更深'), '#### 1.2.3.4 更深');
});

test('headingify: 无数字前缀的正文不分层', () => {
  assert.strictEqual(headingify('概述'), null);
  assert.strictEqual(headingify('这是一段正文'), null);
});

test('headingify: 超长行（>=50 字）不分层，防误伤正文', () => {
  const long = '1 ' + '很'.repeat(50);
  assert.strictEqual(headingify(long), null);
});

test('headingify: 已知过度匹配（如 "3 X 24 小时"）—— 当前会被误判为标题', () => {
  // 这是当前实现的已知局限：<50 字守卫拦不住短的乘法表达式误判。
  // 固定当前行为，留作 P3 改进（见 TODOS）。
  assert.strictEqual(headingify('3 X 24 小时'), '## 3 X 24 小时');
});

test('parseDesc: 按【标签】切段', () => {
  const segs = parseDesc('【描述】登录凭证【枚举值】A=创建\nB=支付');
  assert.deepStrictEqual(segs, [
    { label: '描述', value: '登录凭证' },
    { label: '枚举值', value: 'A=创建\nB=支付' },
  ]);
});

test('parseDesc: 空输入返回空数组', () => {
  assert.deepStrictEqual(parseDesc(''), []);
  assert.deepStrictEqual(parseDesc(null), []);
});

test('renderParams: 业务参数渲染为层级列表 + 元信息', () => {
  const md = renderParams([
    { depth: 0, name: 'auth_code', cn: '授权码', required: '必选', type: 'String', len: '40', desc: '【描述】换取 token' },
  ]);
  assert.strictEqual(
    md,
    '- **auth_code**（授权码） — 必选 / String / 最大长度 40\n  - 描述：换取 token'
  );
});

test('renderParams: 枚举值渲染为缩进子列表', () => {
  const md = renderParams([
    { depth: 0, name: 'status', cn: '', required: '可选', type: 'String', len: '', desc: '【枚举值】A=创建\nB=支付' },
  ]);
  assert.strictEqual(md, '- **status** — 可选 / String\n  - 枚举值：\n    - A=创建\n    - B=支付');
});

test('renderParams: 嵌套深度用两空格缩进表达', () => {
  const md = renderParams([
    { depth: 1, name: 'child', cn: '子字段', required: '可选', type: 'String', len: '', desc: '' },
  ]);
  assert.strictEqual(md, '  - **child**（子字段） — 可选 / String');
});

test('renderMarkdown: doc 页 —— 文件头含来源/更新时间，正文忠实输出', () => {
  const md = renderMarkdown({
    type: 'doc', h1: '接入指南', url: 'https://opendocs.alipay.com/open/x', upd: '更新时间：2026-06',
    name: 'guide', text: '这是正文内容', codes: [], tables: [], imgs: [],
  });
  assert.match(md, /^# 接入指南\n/);
  assert.match(md, /> 文档来源：https:\/\/opendocs\.alipay\.com\/open\/x/);
  assert.match(md, /> 更新时间：2026-06/);
  assert.match(md, /这是正文内容/);
});

test('renderMarkdown: api 页 —— 按 type 分派到 renderApi，输出 H2 段', () => {
  const md = renderMarkdown({
    type: 'api', h1: 'alipay.x.query', url: 'https://opendocs.alipay.com/open/y',
    intro: { text: '' },
    sections: [{ title: '业务请求参数', params: [{ depth: 0, name: 'out_no', cn: '商户单号', required: '必选', type: 'String', len: '', desc: '' }], tables: [], pres: [] }],
  });
  assert.match(md, /## 业务请求参数/);
  assert.match(md, /- \*\*out_no\*\*（商户单号） — 必选 \/ String/);
});

test('renderMarkdown: 图片只在已下载时输出引用（imageExists 守卫）', () => {
  const data = {
    type: 'doc', h1: 'T', url: 'u', upd: '', name: 'doc',
    text: '@@IMG0@@', codes: [], tables: [], imgs: [{ idx: 0, src: 's', alt: '示意图' }],
  };
  const withImg = renderMarkdown(data, { imageExists: () => true });
  assert.match(withImg, /!\[示意图\]\(images\/doc-0\.png\)/);
  const without = renderMarkdown(data, { imageExists: () => false });
  assert.doesNotMatch(without, /!\[/);
});
