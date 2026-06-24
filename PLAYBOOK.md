# 抓取支付宝开放平台文档 · 经验手册（PLAYBOOK）

> 本手册沉淀自一次真实任务：把「消费者投诉」产品的 12 篇官方文档（3 篇指南页 + 8 个 API 接口页 + 1 篇公共错误码）完整、精确地抓成本地 Markdown，供编程 Agent 离线查阅。
> 目标读者：要继续完善本工具的人，以及任何需要抓取支付宝文档的支付开发者 / Agent。
>
> **核心原则：忠实**。正文文字必须 100% 来自页面渲染结果，**禁止**虚构、总结、改写、解读。工具只做格式化（占位→代码块/表格/图片、标题分层、噪音过滤、加文件头）。

---

## 0. 为什么难（一句话）

支付宝文档站（`opendocs.alipay.com` / `opendoc.alipay.com`）是 JS 渲染的 SPA，正文、代码块、参数、表格、图片大量依赖**懒加载**和**折叠/Tab 交互**。直接 `WebFetch` 只能拿到 `<title>`；直接抓 `innerHTML` / `innerText` 会大面积缺失代码与参数。必须用无头浏览器渲染 + 模拟交互 + 结构化提取。

---

## 1. 整体流程（本工具的做法）

```
goto(url, networkidle) → 等待
  → 滚动遍历全文（触发懒加载）
  → 逐个展开「更多」「子属性」（真实点击，防 toggle）
  → 切换请求示例的 Java tab
  → 页面内结构化提取：
       文档页 → 占位流（代码/表格/图片替换为 @@占位@@，保留正文位置）
       API 页 → 通用按 H2 分段（每段：参数/表格/代码/文本）
  → node 端渲染为 Markdown + 用 curl 下载图片
```

代码落点（均在 `skills/fetch-alipay-doc/scripts/` 下）：`lib/fetch.cjs`（抓取+提取）、`lib/render.cjs`（渲染）、`fetch-alipay-docs.cjs`（CLI 编排+下载）。

---

## 2. 逐个坑与解法

### 2.1 WebFetch 失效 → 直接上 Playwright
`WebFetch` / `curl` 拿到的 HTML 正文为空（只有 `<title>`）。**不要**反复换 URL、搜 GitHub 源码、靠记忆推断——直接用 Playwright 渲染。

### 2.2 懒加载：必须先滚动
代码块（CodeMirror）和部分 `<table>` 用 `IntersectionObserver` 懒渲染，**不滚动到就不在 DOM 里**。曾因此误判「页面本身没有代码 / 请求示例是空的」。
- 解法：抓取前遍历 `article *`，逐元素 `scrollIntoView({block:'center'})`，每步停 ~22ms，最后滚回顶部。
- 注意：用 `element.scrollIntoView` 而非 `window.scrollTo`——文档站常是内部容器滚动，window 滚动无效。

### 2.3 折叠展开：「更多」(枚举值) / 「子属性」(嵌套对象)
API 参数默认展开（显示「收起所有属性」），但**枚举值**被「更多」折叠、**嵌套对象字段**被「子属性」折叠，必须逐个点开才完整。
- 触发器是 `<a class="toggle">`，**不是**内层 `<span>`（点 span 无效）。
- 必须用 Playwright 真实 `locator.click()`——React 合成事件下 `el.click()`（在 evaluate 里）不触发。
- **防死循环**：给点过的 `<a>` 打持久 `data-__done` 标记，每轮只点一个再重查。`「子属性」`点击后文案不变（箭头状态也不一定变），不打标记会无限 toggle。
- **不要点「展开所有属性」**：它是 toggle 且文案不变，会被反复选中导致死循环；逐个点「子属性」即可覆盖嵌套展开。

### 2.4 代码块 = CodeMirror，且常在隐藏面板里（最大的坑）
文档页（如「接入准备」「接入指南」）的代码示例用 **CodeMirror**（`.cm-line` / `.cm-editor`）渲染：
- 懒加载（见 2.2，不滚动就没有）。
- 常放在**默认收起的 Tab/折叠面板**（`display:none`）里。`.cm-line` 的 `textContent` 能读到，但替换的占位 `<div>` 不会进 `innerText`（隐藏元素被排除），导致代码丢位置。
  - 解法：提取前对每个 `.cm-editor` 沿父链把 `display:none` 临时改 `block`。
- 提取代码：按 `.cm-line` 顺序 `join('\n')`，把 ` `(nbsp) 还原成普通空格，去行尾空白。
- 「接入指南」曾因此整页「请求示例/响应示例」为空——其实是 10 段 CodeMirror 代码没被触发。

### 2.5 正文容器：文档页 `.docs-article-content` vs API 页 `article`
- 文档页有 `.docs-article-content`，用它做正文根——天然排除顶部「收藏/订阅/我的文档/设置」工具栏和站点 UI 图标。
- API 接口页**没有**该容器，回退用 `article` 整体，再靠 H2 分段 + 文本噪音过滤清理。

### 2.6 图片
- **定位**：抓取前把每个 `<img>` 替换成 `@@IMG{idx}@@` 文本占位再取 `innerText`，可精确保留图片在正文中的位置。
- **下载**：`cdn.nlark.com`（语雀图床）用 node 的 `https.get` 会失败，但裸 `curl -L`（带 UA/Referer）成功（200）。统一用 curl（见 `fetch-alipay-docs.cjs` 的 `downloadImage`）。
- **排除 UI 图标**：API 接口页正文一般无图，其 `<img>` 多为页面模板 UI 图标（多页 `src` 相同、`alt` 为空）。用 `.docs-article-content` 抓正文图、API 页不抓图，即可自动规避。

### 2.7 API 参数有两种 DOM 视图，要选对
同一份参数页面同时渲染：
- **卡片视图** `.paramsRow`（默认可见，innerText 平铺，**含嵌套子属性**）。
- **表格视图** `<table>`（默认隐藏，结构化，但**不含嵌套子属性**）。

策略：
- **业务参数**用 `.paramsRow` 结构化提取（保住嵌套），渲染成**层级列表**（缩进表层级、`- **名**` 表边界、枚举为子列表）。
- **公共请求/响应参数、错误码、通知应答**用页面 `<table>`（无嵌套，表格最清晰）。

从 `.paramsRow` 提取单参数：
- 英文名 = `.isp-field-name`
- 中文名 = 该行 `.content > div` 内第 2 个 `[class*=fieldTitle] strong`
- 必选/类型/长度 = 该 title div 内的 `[class*=dataType]`（必选/可选、类型、`(长度)`）
- 描述/枚举/示例 = 该行**第一个** `[class*=fieldDes]` 的 `innerText`（真实元素，带换行；**不要 clone**，clone 会丢换行让枚举粘连成一坨）
- 层级 `depth` = 祖先 `.paramsRow` 计数

### 2.8 公共请求/响应参数：别漏（它们是隐藏 table）
「公共请求参数 >」「公共响应参数 >」在页面上是可点的折叠标题，但其内容其实是**一直存在于 DOM 的隐藏 `<table>`**（表头：参数/类型/是否必选/最大长度/描述/示例值；含 `app_id`/`method`/`sign`/`timestamp` 等）。直接按标题找到对应 table 提取即可，不必真去点。

### 2.9 Java 示例：先切 tab
请求示例默认 tab 是 cURL（`pre.language-bash`）。先 `getByText('Java',{exact:true}).click()` 切到 Java，再取 `pre.language-java`；响应 JSON 取 `pre.language-json`。通常只需 Java 一种，不必抓全 cURL/Java/C#/PHP 四种。

### 2.10 不要硬编码 H2 名 → 通用按 H2 分段
标准接口的 section 是「公共请求参数/业务请求参数/公共响应参数/业务响应参数/公共错误码/业务错误码」；但**通知/回调类**接口（如 `*.merchants.notify`）完全不同，是「消息属性/通知应答/接口工具」。
- 解法：遍历所有 H2 切段，每段内**有 `paramsRow` 就渲染层级列表，否则渲染 table，`pre` 转代码块**。这样任意接口形态都覆盖。

### 2.11 表格 rowspan / colspan
公共错误码这类大表用合并单元格（一个 `code` 跨多个 `sub_code` 行）。简单 `tr→td` 提取会**行错位**。
- 解法（见 `fetch.cjs` 的 `tableToRows`）：维护 `occupied` 网格；纵向合并（rowspan）**向下重复填值**（每行都有完整 code，AI 读取无歧义）；横向合并（colspan）**仅首格填值、其余留空**。

### 2.12 噪音过滤（渲染层）
会混进正文/段落文本、需要删除的标签：
- 站点级（文档页顶部）：`文档更新记录 >`、`收藏`、`订阅更新`、`我的文档`、`设置`
- API 页：`收起所有属性`、`展开所有属性`、`常见请求示例`、`默认示例`、`cURL`、`Java`、`C#`、`PHP`、`HTTP`、`响应示例`、`正常示例`、`异常示例`、`说明：`、`本示例仅供参考。`，以及重复出现的 h1 行。

### 2.13 Markdown 格式化（文档页，给 AI 读）
- 数字标题 `N` / `N.N` / `N.N.N xxx` → `##` / `###` / `####`（约束整行匹配且 <50 字，防误伤正文如「3 X 24 小时」）。
- 无序列表：`●` 单独成行 + 下一行内容 → `- 内容`。

---

## 3. 验证清单（每次抓完自检）
- [ ] 无残留 `@@...@@` 占位
- [ ] 无 UI 噪音行（收藏/订阅/cURL tab 标签/本示例仅供参考 等）
- [ ] 图片引用全部命中本地文件
- [ ] API 参数含嵌套子属性、枚举值完整（对比页面「展开所有属性」后）
- [ ] 公共参数表、Java 示例、错误码表齐全
- [ ] 表格 rowspan 对齐正确（每行 code 与其 sub_code 一一对应）

---

## 4. 已知局限 / 待改进
- API 页「公共错误码」只取「前往查看」外链；如需内联可单独抓 `https://opendoc.alipay.com/common/02km9f`（公共错误码全局页）。
- API 页「响应示例-异常示例」tab 默认未抓（只抓了正常示例）；如需补，按 tab 切换思路处理。
- 代码块语言标识：文档页 CodeMirror 统一标 ```java（实际多为 Java/JSON，未逐块判定语言）；API 页按 `pre.language-*` 真实标注。
- 未做增量/缓存；大批量抓取建议复用同一 browser 实例（CLI 已如此）。
- `loadChromium()` 目前回退到 homebrew 全局路径；迁移到其他环境时建议项目内 `npm install playwright`。

---

## 5. 环境
- Node + Playwright（`npm install` 后 `npx playwright install chromium`）。
- 图片下载依赖系统 `curl`。
- 仅在 macOS 验证过；其他平台注意 chromium 缓存路径与 curl 可用性。
