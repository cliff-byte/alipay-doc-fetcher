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
goto(url, domcontentloaded) → 等 article 渲染 → networkidle 尽力而为(不阻塞)
  → 滚动遍历全文（触发懒加载）
  → 逐个展开「更多」「子属性」（真实点击，防 toggle）
  → 切换请求示例的 Java tab
  → 页面内结构化提取：
       文档页 → 占位流（代码/表格/图片替换为 @@占位@@，保留正文位置）
       API 页 → 通用按 H2 分段（每段：参数/表格/代码/文本）
  → node 端渲染为 Markdown + 用 curl 下载图片
```

> 导航不用 `waitUntil:'networkidle'`——轮询型 SPA 常永不触发 networkidle 而 60s 超时。改 `domcontentloaded` + 等 `article` 出现 + networkidle 仅尽力而为(`.catch()` 吞超时)；CLI 侧再加 `fetchWithRetry`(2 次)。详见 §2.14。

代码落点（均在 `skills/fetch-alipay-doc/scripts/` 下）：`lib/fetch.cjs`（抓取+提取+产出自检）、`lib/render.cjs`（渲染）、`lib/validate.cjs`（输入校验）、`lib/util.cjs`（文件名）、`lib/paths.cjs`（落点护栏）、`fetch-alipay-docs.cjs`（CLI 编排+下载+重试）。

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
- **下载**：`cdn.nlark.com`（语雀图床）用 node 旧的 `https.get` 会失败，优先用 `curl`（带 UA/Referer，200）。无 curl 时回退 node 内置 `fetch`（undici，**实测对 nlark 同样 200**，跨平台兜底）。见 `fetch-alipay-docs.cjs` 的 `downloadImage` / `hasCurl`。
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
- API 页：`收起所有属性`、`展开所有属性`、`默认示例`、`cURL`、`Java`、`C#`、`PHP`、`HTTP`、`正常示例`、`异常示例`、`说明：`、`本示例仅供参考。`，以及重复出现的 h1 行。
- **接入检测浮层**：API 页顶部支付宝注入的调试组件（class 形如 `checkTool___*`），会泄漏「接入检测/去登录/收起」等文案。在 fetch 层（`page.evaluate` 内）用 `[class*="checkTool"]` **整体移除**，比渲染层加黑名单词稳。

### 2.12-bis 示例区标题：过滤 tab 噪音但保留「常见请求示例 / 响应示例」
页面上「常见请求示例」「响应示例」是 `hTitle___*` div（不是 h2），其下是 tab（默认示例 / cURL·Java·C#·PHP / 正常·异常示例）+ 代码。
- 这两个标题**不能简单当噪音删掉**——删了代码块就没了语义标签。
- 做法：渲染层不直接信任乱序文本，而是在每个 section 的代码块（`pres`）前，按**代码语言**判定后重新写出 `### ` 标题：`json` → `### 响应示例`，其余（bash/java/...）→ `### 常见请求示例`，各只标一次。

### 2.13 Markdown 格式化（文档页，给 AI 读）
- 数字标题 `N` / `N.N` / `N.N.N xxx` → `##` / `###` / `####`（约束整行匹配且 <50 字，防误伤正文如「3 X 24 小时」）。
- 无序列表：`●` 单独成行 + 下一行内容 → `- 内容`。

### 2.14 导航健壮性：别用 networkidle（会偶发 60s 超时）
支付宝文档站是轮询型 SPA，后台心跳/埋点请求**永不停歇**，`page.goto(url, {waitUntil:'networkidle'})` 常等不到 idle 而 60s 超时，把整篇判失败（实测 API 页约半数命中）。
- 解法：`goto(url, {waitUntil:'domcontentloaded'})`（快速可靠）→ `waitForSelector('article')`（确认 SPA 渲染出正文容器）→ `waitForLoadState('networkidle', {timeout:15000}).catch(()=>{})`（尽力等网络静默，超时就吞掉、不阻塞）。
- 兜底：CLI 侧 `fetchWithRetry`，失败换新页面重试 1 次（共 2 次），吸收偶发抖动。

### 2.15 输入校验与文件名防撞（CLI 边界）
- `lib/validate.cjs`：`parseConfig` 校验 config 是数组且每项含合法 http(s) url，畸形给清晰错误而非 `JSON.parse` 崩栈；`isAlipayDocUrl` 对非 opendocs/opendoc 域名告警。
- `lib/util.cjs`：`uniqueName` 对同名 H1 追加 `-2`/`-3`，避免静默覆盖 `.md`。

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
- 代码块语言标识：文档页 CodeMirror 统一标 ```java（实际多为 Java/JSON，未逐块判定语言）；API 页按 `pre.language-*` 真实标注。
- 未做增量/缓存（E3）；大批量抓取建议复用同一 browser 实例（CLI 已如此）。
- 请求示例固定取 Java（E4 多语言示例可选未做）。
- 跨平台代码已就绪（`npm root -g` + `path.join` 解析 chromium、curl→fetch 兜底下图），但仅 macOS 实测过。

> 已消解的局限（v0.3）：异常示例响应已抓（E1，`fetch.cjs` 点「异常示例」tab）；公共错误码已内联（E2，CLI 惰性抓 `common/02km9f` 缓存后内联，见 `render.cjs` 的 `commonErrorTables`）。

### 4.1 E1 异常示例（实现要点）
响应示例区有「正常示例 / 异常示例」两个 tab（`labelContainer___*`），默认只显示正常。做法：主提取拿到正常 JSON 后，Playwright 点「异常示例」tab，再读当前 `pre.language-json`，与正常 JSON 去重后作为 `{abnormal:true}` 注入对应 section，渲染为 `### 响应示例-异常`。

### 4.2 E2 内联公共错误码（实现要点）
API 页「公共错误码」段只给 `common/02km9f` 外链。CLI 检测到该链接时**惰性抓一次**全局错误码页（doc 型，取其 `tables`），缓存（`commonErr`：undefined/null/array 三态）后传入 `renderMarkdown` 的 `opts.commonErrorTables`，渲染层用内联表格替代外链。公共错误码是标准固定集（约 60 行），每 API 页内联使文档离线自洽。

---

## 5. 环境
- Node ≥ 24 + Playwright（`npm install` 后 `npx playwright install chromium`）。
- 图片下载优先 `curl`，无 curl 回退 node 内置 `fetch`（跨平台）。
- 代码跨平台（macOS/Linux/Windows），但仅在 macOS 实测过；其他平台注意 chromium 缓存由 Playwright 自管。
