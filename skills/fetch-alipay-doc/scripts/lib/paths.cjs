'use strict';
const path = require('path');

// 已知的"全局 Agent Skill 安装目录"特征：~/.claude/skills、~/.codex/skills、~/.cursor/skills、~/.agents/skills
const GLOBAL_SKILL_RE = /[/\\]\.(claude|codex|cursor|agents)[/\\]skills[/\\]/;

/**
 * 判断输出目录是否落在"通过 skills 全局安装的 Skill 目录"内。
 * 只在全局安装场景拦截（避免把抓取产物写进共享的 skill 安装目录）；
 * 本地 clone 当 CLI 用时（skillRoot 不在全局 skills 目录下）不拦，保持原有 ./output 行为。
 * @param {string} outDir   解析后的输出目录
 * @param {string} skillRoot Skill 根目录（即 scripts/ 的上级）
 * @returns {boolean} true 表示应拒绝
 */
function isInsideGlobalSkillDir(outDir, skillRoot) {
  if (!GLOBAL_SKILL_RE.test(skillRoot)) return false; // 非全局安装 → 不拦
  const o = path.resolve(outDir);
  const r = path.resolve(skillRoot);
  return o === r || o.startsWith(r + path.sep);
}

module.exports = { isInsideGlobalSkillDir };
