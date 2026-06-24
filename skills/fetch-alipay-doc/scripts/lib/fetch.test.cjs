'use strict';
/**
 * fetch.cjs 中可纯函数化部分的单测（sanityWarnings：DOM 漂移自检）。
 * 抓取主流程依赖浏览器，不在此单测；这里只覆盖产出合理性断言逻辑。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { sanityWarnings } = require('./fetch.cjs');

test('doc 页：正常内容不告警', () => {
  const data = { type: 'doc', text: '正文'.repeat(200), codes: [], tables: [], imgs: [] };
  assert.deepStrictEqual(sanityWarnings(data), []);
});

test('doc 页：有代码块即认为正常（即使正文短）', () => {
  const data = { type: 'doc', text: '简短', codes: [{ idx: 0, code: 'x' }], tables: [], imgs: [] };
  assert.deepStrictEqual(sanityWarnings(data), []);
});

test('doc 页：正文极短且零代码/表格/图片 → 告警（疑似选择器失效）', () => {
  const data = { type: 'doc', text: '@@IMG0@@', codes: [], tables: [], imgs: [] };
  const w = sanityWarnings(data);
  assert.strictEqual(w.length, 1);
  assert.match(w[0], /疑似 DOM 选择器失效/);
});

test('api 页：零分段 → 告警', () => {
  const w = sanityWarnings({ type: 'api', sections: [] });
  assert.strictEqual(w.length, 1);
  assert.match(w[0], /未提取到任何 H2 分段/);
});

test('api 页：有分段但无参数/表格 → 告警', () => {
  const w = sanityWarnings({ type: 'api', sections: [{ title: '业务请求参数', params: [], tables: [] }] });
  assert.strictEqual(w.length, 1);
  assert.match(w[0], /paramsRow \/ table 选择器失效/);
});

test('api 页：分段含参数 → 不告警', () => {
  const data = { type: 'api', sections: [{ title: '业务请求参数', params: [{ name: 'x' }], tables: [] }] };
  assert.deepStrictEqual(sanityWarnings(data), []);
});

test('error 数据 / 空数据：不告警（交由上层处理）', () => {
  assert.deepStrictEqual(sanityWarnings({ error: 'no article' }), []);
  assert.deepStrictEqual(sanityWarnings(null), []);
});
