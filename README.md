<h1 align="center">ALIPAY-DOC-FETCHER</h1>

<p align="center">
  <a href="https://github.com/cliff-byte/alipay-doc-fetcher/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/cliff-byte/alipay-doc-fetcher/actions/workflows/ci.yml/badge.svg"></a>&nbsp;<img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white">&nbsp;<img alt="Playwright" src="https://img.shields.io/badge/Playwright-%5E1.40-2EAD33?logo=playwright&logoColor=white">&nbsp;<img alt="curl" src="https://img.shields.io/badge/runtime-curl-073551?logo=curl&logoColor=white">&nbsp;<img alt="Agent Skill" src="https://img.shields.io/badge/Agent%20Skill-npx%20skills-5A4FCF">&nbsp;<img alt="License" src="https://img.shields.io/badge/license-MIT-green">
</p>

把 JS 渲染的**支付宝开放平台文档**（`opendocs.alipay.com` / `opendoc.alipay.com`）抓取为对**编程 Agent 友好**的 Markdown —— 含标准代码块、层级化接口参数、表格、本地图片。

> 依赖：**Node ≥ 18**、**Playwright**（`^1.40`，需 `npx playwright install chromium`）、系统 **curl**（图片下载）。

## 为什么需要它

支付宝文档站是 SPA：`WebFetch`/`curl` 只能拿到标题；代码块（CodeMirror）和接口参数依赖懒加载与折叠/Tab 交互，直接抓 DOM 会大面积缺失。本工具用无头浏览器渲染 + 模拟交互 + 结构化提取，把这些坑一次性封装好。

> 完整的踩坑经验与设计依据见 [PLAYBOOK.md](./PLAYBOOK.md)。**强烈建议改代码前先读它。**

## 安装为 Skill（推荐）

本仓库是符合 [skills.sh](https://skills.sh) / `npx skills` 规范的开源 Skill 仓库（`skills/fetch-alipay-doc/SKILL.md`，跨 Claude Code / Codex / Cursor 等 70+ Agent 通用）。一条命令安装：

```bash
# 安装到所有已检测到的 Agent（交互式选择）
npx skills add cliff-byte/alipay-doc-fetcher

# 或指定 Agent
npx skills add cliff-byte/alipay-doc-fetcher -a claude-code -a codex -a cursor
```

安装后进入该 Skill 目录补齐运行依赖（Playwright + chromium，图片下载另需系统 `curl`）：

```bash
cd ~/.claude/skills/fetch-alipay-doc        # Codex 为 ~/.codex/skills/...，Cursor 为 ~/.cursor/skills/...
npm install && npx playwright install chromium
```

之后在任一支持的 Agent 里，直接说「把这篇支付宝文档抓到本地：<链接>」即可触发。

> **产物落点**：抓取结果默认落到你**当前项目**下的 `./alipay-docs/`（建议按产品分子目录），**不会**写进 skill 安装目录。全局安装时，工具会拒绝把产物写入 `~/.claude|.codex|.cursor/skills/...` 自身目录。

> 各 Agent 的 skills 目录：Claude Code `~/.claude/skills/`、Codex `~/.codex/skills/`、Cursor `~/.cursor/skills/`（Cursor 也兼容读取前两者）。

## 直接当 CLI 用

不走 Skill 也行，clone 后直接命令行调用：

```bash
git clone https://github.com/cliff-byte/alipay-doc-fetcher.git
cd alipay-doc-fetcher/skills/fetch-alipay-doc
npm install && npx playwright install chromium
```

> 若未 `npm install`，脚本会回退到全局 `playwright`（homebrew 路径）。

## 用法

> 以下命令均在 Skill 目录（`skills/fetch-alipay-doc/`）下执行。

抓单篇：
```bash
node scripts/fetch-alipay-docs.cjs --url "https://opendocs.alipay.com/open/07kszv" --name 01-权限集介绍 --out ./alipay-docs/消费者投诉
```

批量（推荐）：
```bash
node scripts/fetch-alipay-docs.cjs --config examples/urls.example.json --out ./alipay-docs/消费者投诉
```

> `--out` 缺省为当前目录下的 `./alipay-docs`。作为全局安装的 Skill 使用时，请在你的项目目录下用脚本绝对路径调用，详见上方 SKILL.md 指引。

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

## 测试

`render.cjs`（结构化数据 → Markdown）与 `fetch.cjs` 的产出自检是纯函数，有零依赖单测（`node:test`）：

```bash
cd skills/fetch-alipay-doc && npm test
```

## 可靠性

- 抓取失败的篇目会在结尾**汇总**，图片下载失败会**显式告警**，任一失败进程**非零退出**（便于自动化/CI 感知，不再静默部分失败）。
- 抓完做 **DOM 漂移合理性自检**：产出异常稀少（疑似支付宝改版导致选择器失效）时打印告警，而非静默吐残缺文档。

## 设计原则：忠实

正文文字 100% 来自页面渲染结果，不虚构、不总结、不改写、不解读。工具只做机械格式化。

## 结构

```
skills/fetch-alipay-doc/          # 自包含 Skill（npx skills 自动探测并安装）
├── SKILL.md                      # Skill 定义 + 抓完自检清单（跨 Agent 通用）
├── package.json                  # 依赖（playwright）
├── scripts/
│   ├── fetch-alipay-docs.cjs     # CLI 入口（编排浏览器、下载图片、落盘）
│   └── lib/
│       ├── fetch.cjs             # 抓取 + 页面内结构化提取 + 产出自检
│       ├── render.cjs            # 结构化数据 → Markdown
│       ├── fetch.test.cjs        # 单测（sanityWarnings）
│       └── render.test.cjs       # 单测（渲染纯函数）
└── examples/urls.example.json

PLAYBOOK.md                       # 维护者经验手册（仓库根，不随 Skill 安装分发）
```

## 状态

早期版本（v0.1）。已在「消费者投诉」12 篇文档上验证。已知局限见 [PLAYBOOK.md](./PLAYBOOK.md) §4。
