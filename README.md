<h1 align="center">ALIPAY-DOC-FETCHER</h1>

<p align="center">
  <a href="https://github.com/cliff-byte/alipay-doc-fetcher/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/cliff-byte/alipay-doc-fetcher/actions/workflows/ci.yml/badge.svg"></a>&nbsp;<img alt="Node" src="https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white">&nbsp;<img alt="Playwright" src="https://img.shields.io/badge/Playwright-%5E1.40-2EAD33?logo=playwright&logoColor=white">&nbsp;<img alt="curl" src="https://img.shields.io/badge/runtime-curl-073551?logo=curl&logoColor=white">&nbsp;<img alt="Agent Skill" src="https://img.shields.io/badge/Agent%20Skill-npx%20skills-5A4FCF">&nbsp;<img alt="License" src="https://img.shields.io/badge/license-MIT-green">
</p>

把 JS 渲染的**支付宝开放平台文档**（`opendocs.alipay.com` / `opendoc.alipay.com`）抓取为对**编程 Agent 友好**的 Markdown —— 含标准代码块、层级化接口参数、表格、本地图片。

> 依赖：**Node ≥ 24**、**Playwright**（`^1.40`，需 `npx playwright install chromium`）、系统 **curl**（图片下载）。

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

## 提高触发率（推荐）

Skill 是否被调用由 Agent 自行判断。实测发现：对「抓个 URL」这类请求，Agent 常**误以为自己能直接 WebFetch** 而不去调本 Skill（直到拿到空正文才回头）。最可靠的办法是在你项目根的 `CLAUDE.md`（Codex 用 `AGENTS.md`，Cursor 用 `.cursor/rules/`）里加一条路由规则，把下面这段复制进去：

```markdown
## Skill 路由

当用户想要任何**支付宝开放平台文档**（opendocs.alipay.com / opendoc.alipay.com）的正文内容——抓取 / 下载 / 本地化 API 接口文档、接入指南、错误码、产品文档，或粘贴 opendocs/opendoc 链接、给出文档 ID（如 07kszv）或接口名（如 alipay.trade.fastpay.refund.query）——一律用 `fetch-alipay-doc` 技能，**不要直接 WebFetch/curl**：该站是 JS 渲染的 SPA，直接抓只会得到空正文。
```

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

批量（推荐）：自己建一个 config 文件（如 `urls.json`），内容为 JSON 数组：
```json
[
  { "name": "01-权限集介绍", "url": "https://opendocs.alipay.com/open/07kszv?pathHash=af92d9c3" },
  { "name": "退款查询", "url": "https://opendocs.alipay.com/open/c1cb8815_alipay.trade.fastpay.refund.query" }
]
```
`name` 可省略（缺省用页面 H1 生成文件名）。然后：
```bash
node scripts/fetch-alipay-docs.cjs --config urls.json --out ./alipay-docs/消费者投诉
```

> `--out` 缺省为当前目录下的 `./alipay-docs`。作为全局安装的 Skill 使用时，请在你的项目目录下用脚本绝对路径调用，详见上方 SKILL.md 指引。

## 产出

```
<out>/                 # 默认 ./alipay-docs（建议按产品分子目录）
├── <name>.md          # 每篇文档
└── images/            # 文档页正文图片（<name>-<idx>.png）
```

- **文档页**（指南/说明类）：正文 + 标题分层（`##`/`###`）+ 代码块 + 表格 + 内联图片。
- **API 接口页**：通用按 H2 分段；业务参数渲染为**层级列表**（含嵌套子属性、枚举值），公共参数/业务错误码渲染为**表格**，请求示例取 **Java** 代码块、响应取 JSON（含**正常+异常**两种示例）；**公共错误码保留为超链接**（各接口通用，不内联以免重复、省 token，需要时可顺链接自取）。
- **超链接**：正文 / 表格 / 参数描述里的链接全部保留为 Markdown 链接，相对链接补全为绝对 URL。

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
│       ├── validate.cjs          # 输入校验（config / URL）
│       ├── util.cjs              # 文件名 slug / 去重
│       ├── paths.cjs             # 输出落点护栏
│       └── *.test.cjs            # 各模块零依赖单测（node:test）

PLAYBOOK.md                       # 维护者经验手册（仓库根，不随 Skill 安装分发）
```

## 状态

早期版本（v0.3）。已在「消费者投诉」12 篇文档 + 退款查询 API 页上验证。v0.2 补完可靠性（健壮导航+重试、输入校验、文件名防撞、失败汇总+非零退出、DOM 漂移告警）；v0.3 增强能力（异常示例响应、公共错误码内联、跨平台 curl→fetch 兜底）。已知局限见 [PLAYBOOK.md](./PLAYBOOK.md) §4 与 [TODOS.md](./TODOS.md)。
