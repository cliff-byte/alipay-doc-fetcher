# TODOS

源自 2026-06-24 的一次系统性代码评审。已完成的 P1 硬化（render 单测、消灭静默失败、DOM 漂移告警）不在此列。

## 待做（已评审、未排期）

### P2 — 能力增强（暂缓）
- [ ] **E3 增量/缓存**：按 URL + 内容指纹跳过未变页，大批量/反复抓取省时，并减轻对支付宝服务器压力。
- [ ] **E4 多语言示例可选**：加 `--lang`，支持 Python/PHP 等语言栈开发者取对应请求示例（当前固定 Java）。

### P3 — 打磨
- [ ] **业务参数描述链接**：表格单元格内的超链接已保留（`cellMd`），但 `.paramsRow` 业务参数描述（`renderParams`）里的 `<a>` 仍只剩文字。如需一致，给 `parseRow` 的 desc 提取也做 `<a>`→Markdown 链接转换。
- [ ] **T9 魔法数具名化**：`fetch.cjs` 中 300（展开上限）、2500/1000/180（等待）、滚动步长 8 等抽为具名常量或可配置。
- [ ] **headingify 过度匹配**：`render.cjs` 的数字标题启发式会把 "3 X 24 小时" 这类乘法表达误判为标题（`<50` 字守卫拦不住短串）。
  - 现状：已有单测固定当前行为（`render.test.cjs`）。改进需更稳的启发式且不回归已验证的 12 篇文档，故需配套重新验证。

## 已完成

### v0.3 — 能力增强
- [x] **E1** 抓异常示例响应：`fetch.cjs` 点「异常示例」tab，与正常 JSON 去重后注入，渲染 `### 响应示例-异常`。
- [x] **E2** 内联公共错误码：CLI 惰性抓 `common/02km9f` 缓存，`render.cjs` 用 `opts.commonErrorTables` 内联表格替代外链。
- [x] **E5** 跨平台：`loadChromium` 用 `npm root -g`+`path.join`；`downloadImage` curl→node fetch 兜底（实测对 nlark 图床有效）。

### v0.2 — 可靠性补完
- [x] **T10** 抓取健壮性：导航改 `domcontentloaded` + 等 `article` + networkidle 仅尽力而为；CLI 加 `fetchWithRetry`（2 次）。修掉 networkidle 偶发 60s 超时。
- [x] **T4** 输入校验：`lib/validate.cjs`（`parseConfig` / `validateUrl` / `isAlipayDocUrl`），畸形 config / 非法 URL 给清晰错误而非崩栈，非支付宝域名告警。
- [x] **T5** 文件名防撞：`lib/util.cjs` 的 `uniqueName`，同名追加 `-2`/`-3`，不再静默覆盖。

### v0.1 — P1 硬化
- [x] **T1** `render.cjs` 纯函数单测（mdTable / headingify / parseDesc / renderParams / renderMarkdown）。
- [x] **T2** 消灭静默失败：失败篇目汇总 + 图片缺失累计告警 + 任一失败 `process.exitCode=1`。
- [x] **T3** DOM 漂移合理性断言：`sanityWarnings` 抓后自检，产出异常稀少时显式告警。
