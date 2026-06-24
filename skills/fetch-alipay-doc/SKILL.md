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

1. 进入本 Skill 目录（含 `scripts/fetch-alipay-docs.cjs`）。首次使用先确保依赖就绪：
   ```bash
   npm install && npx playwright install chromium   # 若已全局安装 playwright 可跳过
   ```

2. 收集要抓的 URL。多篇时写一个 config JSON（`[{ "name": "...", "url": "..." }]`），`name` 决定输出文件名（可省略，缺省用页面 H1）。参考 `examples/urls.example.json`。

3. 运行（在本 Skill 目录下）：
   ```bash
   # 单篇
   node scripts/fetch-alipay-docs.cjs --url "<支付宝文档URL>" --name "<文件名>" --out ./output
   # 批量
   node scripts/fetch-alipay-docs.cjs --config urls.json --out ./output
   ```

4. 产出在 `--out` 目录：`<name>.md` + `images/`。

## 关键原则
- **忠实**：正文文字必须 100% 来自页面，禁止虚构 / 总结 / 改写 / 解读。工具只做机械格式化。

## 抓完自检清单
每抓完一篇，逐项核对，有问题按「排障」处理或重抓：
- [ ] 无残留 `@@...@@` 占位（占位未被替换 = 代码/表格/图片丢失）。
- [ ] 无 UI 噪音行（收藏 / 订阅更新 / 我的文档 / cURL·Java·C# tab 标签 / 「本示例仅供参考」/ 「收起所有属性」等）。
- [ ] 图片引用全部命中本地 `images/` 文件（无坏链）。
- [ ] API 业务参数含**嵌套子属性**与**枚举值**且完整（对照页面「展开所有属性」后的状态）。
- [ ] 公共请求/响应参数表、Java 请求示例、错误码表齐全。
- [ ] 表格 rowspan 对齐正确（每行 code 与其 sub_code 一一对应，无错位）。

## 排障
- **代码 / 参数缺失** → 多半是懒加载未滚到或折叠（「更多」枚举、「子属性」嵌套）未展开；确认抓取流程做了全文滚动 + 逐个真实点击展开。
- **图片下不下来** → `cdn.nlark.com`（语雀图床）用 node `https` 会失败，本工具改用 `curl`（带 UA / Referer）；确认系统装了 `curl`。
- **接口页结构异常**（如通知 / 回调类，section 是「消息属性 / 通知应答」而非标准请求/响应） → 本工具按通用 H2 分段兼容，无需硬编码 section 名。

> 维护者注：完整的踩坑经验、各坑的成因与设计依据见仓库根 `PLAYBOOK.md`（不随 Skill 安装分发，改代码前务必读）。
