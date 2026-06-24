'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { isAlipayDocUrl, validateUrl, parseConfig } = require('./validate.cjs');

test('isAlipayDocUrl: 识别 opendocs / opendoc 域名', () => {
  assert.strictEqual(isAlipayDocUrl('https://opendocs.alipay.com/open/07kszv'), true);
  assert.strictEqual(isAlipayDocUrl('https://opendoc.alipay.com/common/02km9f'), true);
  assert.strictEqual(isAlipayDocUrl('https://example.com/x'), false);
  assert.strictEqual(isAlipayDocUrl('https://evil-opendocs.alipay.com.attacker.com/'), false);
});

test('validateUrl: 合法支付宝 URL 无 warning', () => {
  assert.deepStrictEqual(validateUrl('https://opendocs.alipay.com/open/x'), {
    url: 'https://opendocs.alipay.com/open/x', warning: null,
  });
});

test('validateUrl: 合法非支付宝域名 → 返回 warning', () => {
  const r = validateUrl('https://example.com/doc');
  assert.match(r.warning, /非支付宝文档域名/);
});

test('validateUrl: 非法输入抛清晰错误', () => {
  assert.throws(() => validateUrl('not-a-url'), /无效 URL/);
  assert.throws(() => validateUrl(null), /无效 URL/);
  assert.throws(() => validateUrl(123), /无效 URL/);
});

test('parseConfig: 合法数组通过', () => {
  const arr = parseConfig('[{"url":"https://opendocs.alipay.com/open/x","name":"a"}]');
  assert.strictEqual(arr.length, 1);
  assert.strictEqual(arr[0].name, 'a');
});

test('parseConfig: 畸形 JSON → 清晰错误而非崩栈', () => {
  assert.throws(() => parseConfig('{ not json'), /不是合法 JSON/);
});

test('parseConfig: 非数组 → 报错', () => {
  assert.throws(() => parseConfig('{"url":"https://opendocs.alipay.com/x"}'), /必须是 JSON 数组/);
});

test('parseConfig: 项缺 url 或 url 非法 → 报错并定位下标', () => {
  assert.throws(() => parseConfig('[{"name":"a"}]'), /config\[0\]\.url 缺失或非法/);
  assert.throws(() => parseConfig('[{"url":"ftp://x"}]'), /config\[0\]\.url 缺失或非法/);
  assert.throws(() => parseConfig('["x"]'), /config\[0\] 必须是对象/);
});
