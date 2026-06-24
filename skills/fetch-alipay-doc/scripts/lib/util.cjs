'use strict';

// 文件名安全化：去掉非法字符、空白转连字符、限长
function slug(s) {
  return (s || 'doc').replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 60);
}

// 文件名去重：若 name 已用过，追加 -2 / -3 ...；返回最终名并登记到 used（Set）
function uniqueName(name, used) {
  let n = name, i = 2;
  while (used.has(n)) { n = `${name}-${i}`; i++; }
  used.add(n);
  return n;
}

module.exports = { slug, uniqueName };
