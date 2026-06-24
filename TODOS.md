# TODOS

源自 2026-06-24 的一次系统性代码评审。已完成的 P1 硬化（render 单测、消灭静默失败、DOM 漂移告警）不在此列。

## 待做（已评审、未排期）

### P2 — 能力增强（评审接受、暂未实现）
> 下列 E1/E2/E5 在初次评审时被接受进范围，但实际迭代先做了可靠性主线（P1 + v0.2），尚未实现；对应"局限"见 PLAYBOOK §4。
- [ ] **E1 抓异常示例响应**：当前只抓「正常示例」JSON；补抓「异常示例」tab，让 API 文档同时给出成功/失败两种响应。
- [ ] **E2 内联公共错误码**：当前 API 页「公共错误码」只留「前往查看」外链；抓全局错误码页（`opendoc.alipay.com/common/02km9f`）内联，使文档离线自洽。
- [ ] **E5 跨平台可移植**：当前仅 macOS 验证，`loadChromium` 回退 homebrew 路径；补 Linux/Windows chromium/curl 路径探测。
- [ ] **E3 增量/缓存**：按 URL + 内容指纹跳过未变页，大批量/反复抓取省时，并减轻对支付宝服务器压力。
- [ ] **E4 多语言示例可选**：加 `--lang`，支持 Python/PHP 等语言栈开发者取对应请求示例（当前固定 Java）。

### P3 — 打磨
- [ ] **T9 魔法数具名化**：`fetch.cjs` 中 300（展开上限）、2500/1000/180（等待）、滚动步长 8 等抽为具名常量或可配置。
- [ ] **headingify 过度匹配**：`render.cjs` 的数字标题启发式会把 "3 X 24 小时" 这类乘法表达误判为标题（`<50` 字守卫拦不住短串）。
  - 现状：已有单测固定当前行为（`render.test.cjs`）。改进需更稳的启发式且不回归已验证的 12 篇文档，故需配套重新验证。

## 已完成

### v0.2 — 可靠性补完
- [x] **T10** 抓取健壮性：导航改 `domcontentloaded` + 等 `article` + networkidle 仅尽力而为；CLI 加 `fetchWithRetry`（2 次）。修掉 networkidle 偶发 60s 超时。
- [x] **T4** 输入校验：`lib/validate.cjs`（`parseConfig` / `validateUrl` / `isAlipayDocUrl`），畸形 config / 非法 URL 给清晰错误而非崩栈，非支付宝域名告警。
- [x] **T5** 文件名防撞：`lib/util.cjs` 的 `uniqueName`，同名追加 `-2`/`-3`，不再静默覆盖。

### v0.1 — P1 硬化
- [x] **T1** `render.cjs` 纯函数单测（mdTable / headingify / parseDesc / renderParams / renderMarkdown）。
- [x] **T2** 消灭静默失败：失败篇目汇总 + 图片缺失累计告警 + 任一失败 `process.exitCode=1`。
- [x] **T3** DOM 漂移合理性断言：`sanityWarnings` 抓后自检，产出异常稀少时显式告警。
