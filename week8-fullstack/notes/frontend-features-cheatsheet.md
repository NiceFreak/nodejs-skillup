# 前端已用能力速查表

> 对照 `src/frontend/` 实际代码整理：核心教学点在代码里有 `[标签]` 注释，其余项目级模式
> 直接索引到文件与组件，讲「是什么 + 这里为什么用它」。
> 白名单展示资产，AI 整理维护（`AGENTS.md`）。

## 一、ES2016+ 语言特性

| 特性 | 版本 | 代码位置 | 一句话 |
|---|---|---|---|
| `**` 幂运算符 | ES2016 | `charts.tsx` niceTicks | `10 ** n` ≡ `Math.pow(10, n)`，用于计算刻度数量级 |
| `async / await` | ES2017 | `api.ts` request | async 函数总返回 Promise；await 把异步写成同步顺序 |
| `String.padStart` | ES2017 | `Dashboard.tsx` 月度表格 | 头部补齐位数：`"7".padStart(2,"0")` → `"07"` |
| 对象展开 `{ ...a, b }` | ES2018 | `api.ts` fetch 调用 | 浅拷贝 + 同名覆盖，合并配置的惯用法，不改原对象 |
| 可选 catch 绑定 | ES2019 | `api.ts` probe / `App.tsx` | 不需要错误对象时 `catch { }` 可省略 `(err)` |
| 可选链 `?.` | ES2020 | `charts.tsx` useTooltip | 左侧为 null/undefined 时短路返回 undefined 不抛错 |
| 空值合并 `??` | ES2020 | `api.ts` API_BASE、`Dashboard.tsx` fillMonths | 只在 null/undefined 时取右侧；`""`、`0` 会被保留（区别于 `\|\|`） |

也在用但属 ES2015 基础：模板字符串、解构（`const [m, c] = await Promise.all(...)`）、
数组展开（`Math.max(1, ...values)`）、箭头函数、`find/reduce/map`。

**`Promise.all` + 解构**（`Dashboard.tsx` load）值得单独记：两个报表请求**并发**发出、
一次 await 等齐、按位置解构——比串行 `await` 少一轮网络往返；任一失败整体 reject，
正好落进同一个 catch 做 401/403 判定。

## 二、TypeScript 能力

| 能力 | 代码位置 | 一句话 |
|---|---|---|
| `interface` 描述接口契约 | `types.ts` 全文件 | 后端响应形状写成类型，改契约时编译器全量查漏 |
| 泛型函数 `request<T>` | `api.ts` | 一个 fetch 封装服务所有接口，调用方决定返回类型 |
| 字符串字面量联合 | `Dashboard.tsx` AccessState | `"loading" \| "admin" \| …` 当轻量状态机，比多个 boolean 更能表达互斥 |
| `as const` + 索引访问类型 | `types.ts` ORDER_STATUSES | 运行时数组和编译期联合类型只维护一份：`(typeof arr)[number]` |
| `Record<K, V>` 工具类型 | `Dashboard.tsx` STATUS_LABEL | 键必须穷举联合类型每个成员，漏写编译报错 |
| `unknown` vs `any` | `api.ts` readErrorMessage | unknown 强迫先收窄再使用；any 完全绕过检查 |
| `instanceof` 类型收窄 | `Dashboard.tsx` catch | 收窄后分支内自动变成 ApiError，可安全读 `.status` |
| 联合 `number \| null` | `types.ts` ProbeResult | 「可能没有」写进类型，调用方必须先排除 null |
| 类属性声明 | `api.ts` ApiError | 类体顶部声明 `status: number`，strict 下构造器漏赋值报错 |
| `as` 类型断言 | `App.tsx` JSON.parse | 只影响编译期、运行时不校验，所以配 try/catch 兜脏数据 |
| 非空断言 `!` | `main.tsx` | 确有把握时用；滥用会把空指针从编译期挪回运行时 |
| `import type` | `Dashboard.tsx` 等 | 类型导入打包时整行擦除，不产生运行时代码 |
| 可选属性 `hint?` | `charts.tsx` StatTile | 调用方可不传，组件内按 undefined 处理 |
| `Partial<T>` | `App.tsx` updateView | 只更新 URL 视图状态的一部分，其余字段保留 |
| 跨文件联合类型 | `showcaseTypes.ts` | `BoardMode` / `ShowcaseTab` 让 App 与展板共享有限状态集合 |

## 三、React 模式（React 18，函数组件 + Hooks）

| 模式 | 代码位置 | 一句话 |
|---|---|---|
| useState 惰性初始化 | `App.tsx` user | 传函数则只在首次挂载执行（localStorage 读取不重复跑） |
| useState 显式泛型 | `charts.tsx` useTooltip | 初始 null 时写 `useState<T \| null>(null)`，否则推断成 null |
| 函数式 setState | `Dashboard.tsx` AuthProbePanel | `setLog(prev => …)` 基于上一次状态算新状态，避开闭包旧值 |
| 不可变更新 | 同上 | 头插 + slice 截断生成新数组，不 push 原数组 |
| useCallback + useEffect 链 | `Dashboard.tsx` load | 筛选条件变 → load 函数变 → effect 重新执行，依赖链清晰 |
| useMemo | `charts.tsx` ticks、`Dashboard.tsx` kpi | 依赖不变时复用计算结果（React 19 编译器时代手动 memo 会越来越少，见工具箱） |
| useRef 拿 DOM | `charts.tsx` useTooltip | `.current` 指向真实节点，算 tooltip 相对坐标 |
| useRef 保存可变句柄 | `W5Board.tsx` ThreadpoolTrack | 保存 animation frame id；更新不触发渲染，cleanup 可取消 |
| 自定义 Hook | `charts.tsx` useTooltip | `use` 开头的函数打包状态逻辑，两个图表复用 |
| 条件渲染 | `Dashboard.tsx` | `state === x && <JSX/>`；互斥视图按 AccessState 分支 |
| 非受控字段 + FormData | `App.tsx` AuthView | 提交时从 form 一次取值；简单表单不必为每个输入维护 state |
| 刷新保帧 | `Dashboard.tsx` | 重新拉数时旧渲染降透明度，不用骨架屏（布局不跳） |
| effect 订阅与 cleanup | `App.tsx` | 订阅 `hashchange`，卸载时移除同一监听器，URL 是视图状态真源 |
| 状态提升 | `App.tsx` → `Showcase.tsx` | mode/tab/topic 由共同父组件解析，再下传到具体展板 |
| `key` 重挂载 | `W5Board.tsx` stage body | 切换专题时重建局部组件树，使入场动画和局部演示状态复位 |
| 主动回忆门 | `W5Board.tsx` | review 模式先隐藏模型与证据；用户作答后再揭示，避免把浏览误当掌握 |
| Markdown 组件映射 | `MarkdownNotes.tsx` | `react-markdown` 把语法树渲染成 React 元素，并定制 table / link 输出 |

## 四、CSS 与响应式布局

| 能力 | 代码位置 | 一句话 |
|---|---|---|
| 全局盒模型 | `styles.css` `*` | `border-box` 让声明宽度包含 padding/border，减少尺寸心算 |
| CSS 变量与暗色主题 | `styles.css` `:root` / `[data-theme]` | 语义 token 集中管理颜色，组件不绑定某个具体色值 |
| Flex 一维布局 | 顶栏、按钮组、图例 | 处理同一行或同一列的排列、对齐与剩余空间 |
| Grid 二维布局 | 展板导航、对比区、指标区 | 同时控制行列；`minmax(0, 1fr)` 防止长内容撑破网格 |
| 自适应列 | `.stats` 等 | `repeat(auto-fit, minmax(...))` 让列数由可用空间决定 |
| 内容宽度约束 | `.page` | `max-width` 保证宽屏阅读行长稳定，外侧自动留白 |
| 响应式断点 | `@media (max-width: 720px)` | 多列专题和流程在窄屏降为一列或两列，避免文字互相挤压 |
| 减少动态效果 | `prefers-reduced-motion` | 尊重系统设置，关闭动画与过渡 |
| 定位与溢出 | 图表 tooltip、时间线、进度条 | 父级 relative 建坐标系；absolute 只放覆盖层，overflow 控制裁切 |
| 伪元素 | 流程箭头、图例色条 | 装饰信息不污染 JSX；语义文本仍留在 DOM 中 |

### 12 栅格怎么回答

12 栅格是页面编排约定，不等于 CSS Grid API。12 能被 2、3、4、6 整除，因此常用
`span 6` 做两列、`span 4` 做三列、`span 3` 做四列；完整设计还要同时定义 container、
column、gutter 和断点。实现可以用 CSS Grid，也可以来自 Bootstrap / Ant Design 等组件库。

本项目没有建立通用 12 列系统：后台与知识展板主要是局部的 1–4 列语义布局，直接用
`grid-template-columns` 更清楚，移动端统一在 720px 收口。若后续出现大量跨页面、跨模块
对齐需求，再引入 12 列；仅因为面试被问到就改造现有页面，会增加抽象而没有实际收益。

## 五、工程与构建（Vite）

| 能力 | 位置 | 一句话 |
|---|---|---|
| dev proxy | `vite.config.ts` | `/auth`、`/users`、`/reports` 转发到 3000 端口，绕开 CORS，后端零改动 |
| `import.meta.env` | `api.ts` | 构建期注入的环境变量，只暴露 `VITE_` 前缀 |
| `vite-env.d.ts` | `src/` | 一行三斜线指令给 `import.meta.env` 补类型 |
| `tsc -b && vite build` | `package.json` | 类型检查与打包分开：Vite 自身只做转译不查类型 |
| hash URL 状态 | `App.tsx` | 不依赖路由库也能深链到 mode/tab/topic，并支持刷新与浏览器前进后退 |
| Vite `?raw` import | `MarkdownNotes.tsx` | 构建时把现有 Markdown 作为字符串导入，不复制第二份文档 |
| GFM Markdown | `react-markdown` + `remark-gfm` | 安全渲染仓库笔记，并支持速查表依赖的表格语法；原始 HTML 被禁用 |

## 六、本项目的三个设计决定（面试可讲）

1. **手写 SVG 图表而非引入图表库**：需求只有柱图/条形图两种、数据量小；省掉一个大依赖，
   换来对 mark 规格（柱宽、圆角、网格、tooltip 命中区）的完全控制。数据量大、图型多时
   应换库（见工具箱「数据可视化」）。
2. **前端不猜角色**：登录响应和 JWT payload 都没有 role（token 只证明 `sub`），
   角色判定交给报表请求的真实 403/200——UI 状态与服务端授权结论保持一致，
   也顺便成了 RBAC 的演示点。
3. **局部语义网格而非通用 12 栅格**：当前页面的真实组合有限，直接声明两列、三列或
   `auto-fit` 更易读；只有跨页面对齐规则反复出现时，12 栅格才值得成为公共约束。
