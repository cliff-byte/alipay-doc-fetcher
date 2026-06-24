'use strict';

// 是否支付宝开放平台文档域名（opendocs.alipay.com / opendoc.alipay.com）
function isAlipayDocUrl(url) {
  return /^https?:\/\/(opendocs|opendoc)\.alipay\.com\//.test(url);
}

// 校验单个 URL：非法（非字符串/非 http(s)）抛清晰错误；合法但非支付宝域名返回 warning
function validateUrl(url) {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new Error(`无效 URL（需以 http(s):// 开头）：${JSON.stringify(url)}`);
  }
  return { url, warning: isAlipayDocUrl(url) ? null : `URL 非支付宝文档域名（opendocs/opendoc.alipay.com），可能抓不到正文：${url}` };
}

// 解析并校验 config：必须是 JSON 数组，每项含合法 http(s) url。失败抛清晰错误而非崩栈。
function parseConfig(text) {
  let arr;
  try { arr = JSON.parse(text); }
  catch (e) { throw new Error(`config 不是合法 JSON：${e.message}`); }
  if (!Array.isArray(arr)) {
    throw new Error('config 必须是 JSON 数组，形如 [{ "url": "...", "name": "..." }]');
  }
  arr.forEach((it, i) => {
    if (!it || typeof it !== 'object' || Array.isArray(it)) {
      throw new Error(`config[${i}] 必须是对象 { url, name? }`);
    }
    if (typeof it.url !== 'string' || !/^https?:\/\//.test(it.url)) {
      throw new Error(`config[${i}].url 缺失或非法：${JSON.stringify(it.url)}`);
    }
  });
  return arr;
}

module.exports = { isAlipayDocUrl, validateUrl, parseConfig };
