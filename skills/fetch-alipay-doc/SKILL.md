---
name: fetch-alipay-doc
description: 获取支付宝开放平台（opendocs.alipay.com、opendoc.alipay.com）文档并保存为本地 Markdown。支付宝文档站是 JS 渲染的 SPA，WebFetch/curl 只能拿到空白正文——所以只要用户想要任何支付宝开放平台文档的正文内容，就用本技能，不要尝试直接用 WebFetch/curl 抓。触发场景：用户要抓取/下载/保存/本地化支付宝的 API 接口文档、接入指南、错误码页或产品文档为 md（存进项目 docs、离线在 IDE/Cursor 查阅），或粘贴 opendocs/opendoc 链接、给出文档 ID（如 07kszv、02km9f）或接口名（如 alipay.trade.fastpay.refund.query）并想要其内容；单篇或批量均适用。不要用于：调接口写业务代码、排查支付报错、配置沙箱、注册应用、整理本地已有 md 文件、下载图片素材。
---

# 抓取支付宝开放平台文档

支付宝文档站是 JS 渲染的 SPA，`WebFetch`/`curl` 拿不到正文，代码块与接口参数还依赖懒加载和折叠/Tab 交互。本 Skill 用封装好的 Playwright 工具一步抓成结构化 Markdown：标题分层、参数层级列表、表格、Java 请求示例、正常+异常响应、本地图片、保留超链接。

## 怎么用

记本 Skill 安装目录为 `$SKILL`（Claude Code `~/.claude/skills/fetch-alipay-doc`、Codex `~/.codex/skills/...`、Cursor `~/.cursor/skills/...`）。

1. **首次准备依赖**（仅一次，与运行目录无关）：
   ```bash
   (cd "$SKILL" && npm install && npx playwright install chromium)
   ```
2. **运行**：站在**用户当前项目目录**下，用绝对路径调脚本，`--out` 指到项目内（按产品/主题分目录）。**不要 `cd` 进 `$SKILL` 再跑**——产物会被工具拒绝写入安装目录。
   ```bash
   # 单篇
   node "$SKILL/scripts/fetch-alipay-docs.cjs" --url "<文档URL>" --name "<文件名>" --out ./alipay-docs/<产品名>
   # 批量：先写 urls.json = [{ "name": "...", "url": "..." }, ...]（name 可省，缺省用页面 H1）
   node "$SKILL/scripts/fetch-alipay-docs.cjs" --config urls.json --out ./alipay-docs/<产品名>
   ```
3. 产出在 `--out`（缺省 `./alipay-docs`）：`<name>.md` + `images/`。结尾汇总成功/失败/缺图，任一失败进程非零退出。

> playwright 依赖从脚本文件位置解析，与 cwd 无关；故绝对路径调用即可，cwd 只决定产物落点。

## 关键原则
**忠实**：正文文字 100% 来自页面，禁止虚构 / 总结 / 改写 / 解读。工具只做机械格式化。

## 抓完自检
- [ ] 无残留 `@@...@@` 占位（= 代码/表格/图片丢位）。
- [ ] 无 UI 噪音行（收藏 / 订阅 / cURL·Java tab 标签 / 「本示例仅供参考」/ 「收起所有属性」等）。
- [ ] 图片引用全部命中本地 `images/`（工具对缺图会显式告警）。
- [ ] API 业务参数含**嵌套子属性 + 枚举值**且完整。
- [ ] 公共请求/响应参数表、Java 请求示例、响应示例（正常+异常）、业务错误码表齐全；公共错误码为超链接（各接口通用，不内联）。
- [ ] 正文 / 表格 / 参数描述里的外链保留为 Markdown 链接（相对已补绝对）。
- [ ] 表格 rowspan 对齐（每行 code 与其 sub_code 一一对应）。

## 排障
- **代码 / 参数缺失** → 多为懒加载未滚到，或折叠（「更多」枚举、「子属性」嵌套）未展开。
- **抓取超时 / 失败** → 工具用 `domcontentloaded` 导航 + 自动重试 2 次；仍失败会在结尾列出并非零退出。
- **图片缺失** → 优先 `curl`，无 curl 自动回退 node `fetch`；二者都失败才告警缺图。
- **接口页结构异常**（通知 / 回调类，段为「消息属性 / 通知应答」） → 工具按通用 H2 分段兼容。

> 维护者：完整踩坑经验与设计依据见仓库根 `PLAYBOOK.md`（不随 Skill 安装分发，改代码前必读）。
