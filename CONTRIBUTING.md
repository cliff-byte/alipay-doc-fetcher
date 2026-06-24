# 贡献指南

欢迎 issue 与 PR。本工具的核心是**忠实**地把支付宝开放平台文档抓成 Agent 友好的 Markdown，贡献时请守住这条底线：正文文字 100% 来自页面，不虚构 / 总结 / 改写。

## 开始之前

- **务必先读 [PLAYBOOK.md](./PLAYBOOK.md)** —— 它记录了支付宝文档站所有踩过的坑与设计依据（懒加载、折叠展开、CodeMirror、rowspan 表格、噪音过滤等）。改抓取/渲染逻辑前不读它大概率会重复踩坑。
- 代码落点：`skills/fetch-alipay-doc/scripts/`（`fetch-alipay-docs.cjs` 编排、`lib/fetch.cjs` 抓取+提取、`lib/render.cjs` 渲染、`lib/paths.cjs` 落点护栏）。

## 本地开发

```bash
git clone https://github.com/cliff-byte/alipay-doc-fetcher.git
cd alipay-doc-fetcher/skills/fetch-alipay-doc
npm install && npx playwright install chromium
npm test            # 纯函数单测（render / sanity / paths），零依赖 node:test
```

## 提交前自检

- [ ] `npm test` 全绿；改了渲染/抓取逻辑请补对应单测。
- [ ] 对真实文档跑一次 e2e，按 PLAYBOOK §3 验证清单核对（无 `@@占位@@`、无 UI 噪音、图片命中、参数嵌套与枚举完整、表格 rowspan 对齐）。
- [ ] 抓取产物（`output/`、`alipay-docs/`）不要提交（已在 `.gitignore`）。

## Commit 规范

采用 Conventional Commits：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`。
