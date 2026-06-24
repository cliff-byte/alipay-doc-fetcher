---
name: fetch-alipay-doc
description: 抓取支付宝开放平台文档（opendocs.alipay.com / opendoc.alipay.com）为本地 Markdown，供编程 Agent 离线查阅。当用户要获取/下载/本地化任何支付宝开放平台 API 文档、接入指南、错误码、产品文档，或粘贴支付宝 opendocs/opendoc 链接并希望抓取其内容时使用。也适用于普通网页抓取（WebFetch/curl 等）拿不到支付宝文档正文的场景。
---

# 抓取支付宝开放平台文档

支付宝文档站是 JS 渲染的 SPA，`WebFetch`/`curl` 拿不到正文，代码与参数依赖懒加载与折叠交互。本 Skill 用封装好的 Playwright 工具一步抓成结构化 Markdown。

## 何时使用
- 用户要把某个支付宝 API / 接入指南 / 错误码 / 产品文档「拉到本地」「抓下来」「转成 Markdown」。
- 用户粘贴 `opendocs.alipay.com` 或 `opendoc.alipay.com` 链接并想要其内容。
- 已发现普通网页抓取（`WebFetch` / `curl` 等）对支付宝文档只返回标题、正文为空。

## 怎么用

1. 确认本工具目录（本 Skill 所在项目根，含 `fetch-alipay-docs.cjs`）。首次使用先确保依赖就绪：
   ```bash
   npm install && npx playwright install chromium   # 若已全局安装 playwright 可跳过
   ```

2. 收集要抓的 URL。多篇时写一个 config JSON（`[{ "name": "...", "url": "..." }]`），`name` 决定输出文件名（可省略，缺省用页面 H1）。

3. 运行：
   ```bash
   # 单篇
   node fetch-alipay-docs.cjs --url "<支付宝文档URL>" --name "<文件名>" --out ./output
   # 批量
   node fetch-alipay-docs.cjs --config urls.json --out ./output
   ```

4. 产出在 `--out` 目录：`<name>.md` + `images/`。

## 关键原则
- **忠实**：正文文字必须 100% 来自页面，禁止虚构 / 总结 / 改写 / 解读。
- 抓完按 PLAYBOOK.md §3 验证清单自检：无残留 `@@占位@@`、无 UI 噪音、图片命中、参数嵌套与枚举完整、表格 rowspan 对齐。

## 排障
- 抓出来代码/参数缺失 → 多半是懒加载/折叠未触发，见 PLAYBOOK.md §2.2–2.4。
- 图片下不下来 → `cdn.nlark.com` 用 node https 会失败，本工具已改用 `curl`；确认系统有 `curl`。
- 接口页结构异常（如通知类） → 本工具用通用 H2 分段兼容，见 PLAYBOOK.md §2.10。

> 改代码前务必读 `PLAYBOOK.md` —— 它记录了所有踩过的坑与设计依据。
