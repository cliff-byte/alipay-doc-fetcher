'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { isInsideGlobalSkillDir } = require('./paths.cjs');

const CLAUDE = '/Users/x/.claude/skills/fetch-alipay-doc';

test('全局安装：写入 skill 目录内 → 拒绝', () => {
  assert.strictEqual(isInsideGlobalSkillDir(CLAUDE + '/output', CLAUDE), true);
  assert.strictEqual(isInsideGlobalSkillDir(CLAUDE, CLAUDE), true);
  assert.strictEqual(isInsideGlobalSkillDir(CLAUDE + '/alipay-docs/x', CLAUDE), true);
});

test('全局安装：写入用户项目（skill 目录之外）→ 放行', () => {
  assert.strictEqual(isInsideGlobalSkillDir('/Users/x/proj/alipay-docs', CLAUDE), false);
});

test('codex / cursor / agents 全局目录同样识别', () => {
  const codex = '/Users/x/.codex/skills/fetch-alipay-doc';
  const cursor = '/home/x/.cursor/skills/fetch-alipay-doc';
  const agents = '/home/x/.agents/skills/fetch-alipay-doc';
  assert.strictEqual(isInsideGlobalSkillDir(codex + '/output', codex), true);
  assert.strictEqual(isInsideGlobalSkillDir(cursor + '/output', cursor), true);
  assert.strictEqual(isInsideGlobalSkillDir(agents + '/output', agents), true);
});

test('本地 clone（非全局 skills 目录）→ 不拦，保持 ./output 行为', () => {
  const local = '/Users/x/Development/alipay-doc-fetcher/skills/fetch-alipay-doc';
  assert.strictEqual(isInsideGlobalSkillDir(local + '/output', local), false);
});

test('前缀相近但非子目录 → 不误判', () => {
  // skill 目录是 .../fetch-alipay-doc，另一个 .../fetch-alipay-doc-2 不应被当成其子目录
  assert.strictEqual(isInsideGlobalSkillDir(CLAUDE + '-2/output', CLAUDE), false);
});
