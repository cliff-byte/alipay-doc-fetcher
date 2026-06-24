# alipay-doc-fetcher

把 JS 渲染的**支付宝开放平台文档**（`opendocs.alipay.com` / `opendoc.alipay.com`）抓取为对**编程 Agent 友好**的 Markdown —— 含标准代码块、层级化接口参数、表格、本地图片。

## 为什么需要它

支付宝文档站是 SPA：`WebFetch`/`curl` 只能拿到标题；代码块（CodeMirror）和接口参数依赖懒加载与折叠/Tab 交互，直接抓 DOM 会大面积缺失。本工具用无头浏览器渲染 + 模拟交互 + 结构化提取，把这些坑一次性封装好。

> 完整的踩坑经验与设计依据见 [PLAYBOOK.md](./PLAYBOOK.md)。**强烈建议改代码前先读它。**

## 安装为 Skill（推荐）

本仓库根目录即一个自包含 **Agent Skill**（`SKILL.md` 标准格式，跨 Claude Code / Codex / Cursor 通用）。把整个仓库 clone 到对应 Agent 的 skills 目录，命名为 `fetch-alipay-doc` 即可：

| Agent | clone 目标目录 |
|---|---|
| **Claude Code** | `~/.claude/skills/fetch-alipay-doc`（全局）或 `<项目>/.claude/skills/fetch-alipay-doc` |
| **Codex CLI** | `~/.codex/skills/fetch-alipay-doc`（全局）或 `<项目>/.codex/skills/` |
| **Cursor** | `~/.cursor/skills/fetch-alipay-doc` 或 `<项目>/.cursor/skills/`；Cursor 也兼容读取 `~/.claude/skills/`、`~/.codex/skills/` |

```bash
# 以 Claude Code 全局安装为例
git clone <repo-url> ~/.claude/skills/fetch-alipay-doc
cd ~/.claude/skills/fetch-alipay-doc
npm install && npx playwright install chromium   # 准备依赖（图片下载另需系统 curl）
```

> 装一处常可多家复用：Cursor 会兜底读取 `~/.claude/`、`~/.codex/` 下的 skills。

之后在任一支持的 Agent 里，直接说「把这篇支付宝文档抓到本地：<链接>」即可触发。

## 直接当 CLI 用

不走 Skill 也行，clone 后直接命令行调用：

```bash
git clone <repo-url> alipay-doc-fetcher
cd alipay-doc-fetcher
npm install && npx playwright install chromium
```

> 若未 `npm install`，脚本会回退到全局 `playwright`（homebrew 路径）。

## 用法

抓单篇：
```bash
node fetch-alipay-docs.cjs --url "https://opendocs.alipay.com/open/07kszv" --name 01-权限集介绍 --out ./output
```

批量（推荐）：
```bash
node fetch-alipay-docs.cjs --config examples/urls.example.json --out ./output
```

`config` 为 JSON 数组：
```json
[{ "name": "01-权限集介绍", "url": "https://opendocs.alipay.com/open/07kszv?pathHash=af92d9c3" }]
```
`name` 可省略（缺省用页面 H1 生成文件名）。

## 产出

```
output/
├── <name>.md          # 每篇文档
└── images/            # 文档页正文图片（<name>-<idx>.png）
```

- **文档页**（指南/说明类）：正文 + 标题分层（`##`/`###`）+ 代码块 + 表格 + 内联图片。
- **API 接口页**：通用按 H2 分段；业务参数渲染为**层级列表**（含嵌套子属性、枚举值），公共参数/错误码渲染为**表格**，请求示例取 **Java** 代码块、响应取 JSON。

## 设计原则：忠实

正文文字 100% 来自页面渲染结果，不虚构、不总结、不改写、不解读。工具只做机械格式化。

## 结构

```
fetch-alipay-docs.cjs   # CLI 入口（编排浏览器、下载图片、落盘）
lib/fetch.cjs           # 抓取 + 页面内结构化提取
lib/render.cjs          # 结构化数据 → Markdown
PLAYBOOK.md             # 经验手册（核心知识）
SKILL.md                # Claude Code Skill 定义
examples/urls.example.json
```

## 状态

早期版本（v0.1）。已在「消费者投诉」12 篇文档上验证。已知局限见 PLAYBOOK.md §4。
