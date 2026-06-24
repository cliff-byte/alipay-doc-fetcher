'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { slug, uniqueName } = require('./util.cjs');

test('slug: 去非法字符、空白转连字符、限长 60', () => {
  assert.strictEqual(slug('接入 / 指南 : 第一章'), '接入-指南-第一章');
  assert.strictEqual(slug(''), 'doc');
  assert.strictEqual(slug(null), 'doc');
  assert.strictEqual(slug('a'.repeat(80)).length, 60);
});

test('uniqueName: 首次原样返回并登记', () => {
  const used = new Set();
  assert.strictEqual(uniqueName('权限集介绍', used), '权限集介绍');
  assert.ok(used.has('权限集介绍'));
});

test('uniqueName: 重名追加 -2 / -3', () => {
  const used = new Set();
  assert.strictEqual(uniqueName('退款查询', used), '退款查询');
  assert.strictEqual(uniqueName('退款查询', used), '退款查询-2');
  assert.strictEqual(uniqueName('退款查询', used), '退款查询-3');
});
