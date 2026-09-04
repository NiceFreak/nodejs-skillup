# W12 展板设计方案（施工图 v1.2）：`ai-engineer` tab · 八块内容

> 状态：**施工图 v1.2（2026-09-03，D4 增量）**。
> 上游 = `w12-ai-visualization-plan.md` v0.6 与 `SHOWCASE-VISUAL-PROTOCOL.md`。
> v1.1 的事实纠正与验收记录作为历史保留；v1.2 的替代规格与待验收记录见 §7。

## 0. 事实边界

- Bub 源码不作为本仓库内可复核依据。Bub 行号与机制只采用
  `week12-python-rag/notes/bub-reading-report.md`、`day3-bub-main-chain.md`、
  `day2-freeze-and-baseline.md`、`week12-plan.md` 已记录的内容。
- TypeScript / Express / Jest 端点只采用本仓库真实源码。
- 证据等级保持四档：`源码事实`、`本人实测`、`推断`、`待运行验证`。
- 标注「示意」或「待验证」只限定已有材料的事实强度，不能补足不存在的内容。

本轮纠正的旧口径：

| 块 | v1 中的问题 | v1.1 当前口径 |
|---|---|---|
| P1 | 虚构 TS `greet`，并把真实 `try/finally` 误判为不存在 | 六个 TS 端点改为笔记或仓库真实代码；资源收尾引用 `AuthView.tsx:48-49` 与 `Dashboard.tsx:94-95` |
| P1 | 图例声明等价 / 新增，但页面没有这两类真实实例 | 当前只显示近似映射与 Python 内两形态 |
| P3 | 把实现者的降级判断归因给本人笔记，并断言 typer 没有某些对应物 | 明示「同构」是笔记原话，「近似」是本板推断；素材未记录的对应关系只写未核 |
| B1 | 把 console wrapper 的生成与调用形态写成源码事实 | `[project.scripts]` 只证明入口声明；wrapper 调用形态保持待运行验证 |
| B2 | 三个出口都从管线末端画出 | 正常出口从 `dispatch_outbound` 发出；普通异常与取消出口从 `_run_model` 发出 |
| B3 | 把七类记录类型画成一段虚构的会话顺序，并把自定义 selector 也说成只留 message | 图只表达记录类型集合；「只留 message」限定为默认 selector，自定义 `TapeContext.select` 可覆盖默认规则 |
| B4 | 把短路、`max_steps` 具体触发时机与无停滞检测写成源码事实 | 整块总证据为推断；这些细节分别标推断或待运行验证，C1 只演示结构路径 |
| B5 | 写成无来源的 `Tool / REGISTRY / tools.py`，并声称每个 turn 必有多个 step | 执行者写为笔记中的 `ToolExecutor`；一个 turn 含一个或多个 step |

## 1. 板面与接线

| 项 | 当前实现 |
|---|---|
| tab | `ai-engineer`，显示名 `AI 工程` |
| Python 组 | `py-syntax`、`cli-dispatch` |
| Bub 组 | `entry-chain`、`turn-pipeline`、`tape-context`、`step-loop`、`roles-nesting` |
| 默认专题 | `py-syntax` |
| 数据层 | `src/aiEngineerTopics.ts` |
| 视觉层 | `src/AiEngineerBoard.tsx` + `src/styles.css` |
| 机器断言 | `scripts/verify-w9-board.mjs` 的 `E. AI 工程板` |

页面保持既有 hash 深链：`#/showcase?tab=ai-engineer&topic=<id>`。未知 topic 回退默认专题；切换
顶层 tab 时清除 topic。

每块舞台结构为：单一问题、10 秒结论、视觉主图、边界、折叠的验收句与来源。来源和长解释不放进
主图，图内只保留节点、边、短条件和证据状态。

## 2. 七块当前契约

### P1 · 六个语法单元的映射类型

- 结论：当前六单元只出现两种映射类型，近似映射与 Python 内两形态。
- 图形：SVG 端点与六条真实边；每条边带 `data-from`、`data-to`、`data-maptype`。
- `data-shape` 的 TS interface 是语义来源；dataclass 与 Pydantic 在 Python 栏内并列，不画成 TS 等价。
- `ctx-manager` 的 TS 端引用前端真实 `try/finally`，但只在「退出时执行收尾」这一点与 Python
  context manager 对照；两侧收尾对象不同。
- 手机：每个语义单元保留两端点与映射类型，不显示缩小版桌面 SVG。

P1 的仓库源码端点：

| 单元 | 页面端点 | 来源 |
|---|---|---|
| 可选参数与返回类型 | `reviewNote?: string`；`readErrorMessage(...): string` | `authTopics.ts:49`；`api.ts:45` |
| 聚合导出 | `index.ts` 聚合导出概念 | `day2-freeze-and-baseline.md` §5 单元 2；页面明确本仓库前端未逐行比对 |
| 数据形状 | `interface LoginResponse / SafeUser` | `types.ts:29`、`types.ts:39` |
| 业务异常包装 | `new UserValidationError(..., { cause: error })` | `week2-express/src/repositories/users.js:37`、`errors/userErrors.js:13-17` |
| 资源收尾 | `try/finally` 恢复 UI 状态 | `AuthView.tsx:48-49`、`Dashboard.tsx:94-95` |
| 测试入口 | Jest / Supertest | `week2-express/src/__tests__/auth-flow.test.js:1-2`；W6 框架记录见对应笔记 |

### P3 · CLI 分发器对照

- 总证据等级：`推断`。
- 图形：Express 与 typer 各四个真实端点，用四条 SVG 对齐边连接；每条边旁直接显示短的成立点与失效点。
- 四个职责位置：全局前置、处理注册、入站解析、处理函数与上下文。
- `holds` / `fails` 只比较当前材料中可见的代码形状；不从局部位置推出两个框架整体同构。
- Express 的 404 catch-all / error handler 在 typer 侧是否有对应物，现有允许素材未记录，因此页面写未核，
  不下否定结论。

### B1 · 两条启动路径汇入第一次 turn

- 总证据等级：`推断`。
- 图形：双起点分开，经过共同的模块级初始化，再分成两个 `app()` 调用位置，随后汇入同一个
  typer 分发节点，最终到 `process_inbound`。
- 图内节点和边均有稳定 id；两条路径不是等宽卡片加序号，而是带分叉、共有节点、汇合点与触发点的拓扑。
- `python -m` 的 `__name__` 门由源码阅读记录与 Python 实验支撑。
- console 侧只确认 `[project.scripts] bub = "bub.__main__:app"` 的入口声明；生成 wrapper 的调用形态
  保持 `待运行验证`。

### B2 · turn 管线与 `finally` 作用域

- 图形：六阶段有向管线；`finally` 作用域框只包含 `_run_model`。
- 正常出口从 `dispatch_outbound` 发出；普通异常与取消出口从 `_run_model` 发出。
- 页面只承诺进入 `_run_model` 后会尝试调用 `save_state`，不承诺持久化成功。
- `CancelledError` 直穿普通异常处理的路径保持 `待运行验证`。
- `TurnResult` 只描述 frozen dataclass 外层；其中 `state` 字段仍是可变 dict，不写成深冻结快照。

### B3 · tape 到 context

- 图形：tape 记录类型集合、默认读取三级规则、本轮输入、模型调用与追加路径形成一轮有向过程。
- 七个 kind 是类型集合，不表示一段真实会话的顺序或数量。
- 默认 selector 才执行「anchor 范围、context 标记、只留 message」；自定义 `TapeContext.select`
  可以整体覆盖默认规则。
- 完整 messages 分成历史部分与本轮 system / steering / prompt，两类来源在图上分区。
- 写回顺序按笔记记录呈现，`context_error` 明示为可选。
- 手机保留横向 tape 主图并在自己的容器内滚动；页面本身不横向溢出。

### B4 · step 循环判定

- 总证据等级：`推断`。
- 图形：常规继续/停止、异常恢复、循环边界三个分区，十一节点、十二条条件边。
- 常规区分别画出 tool_calls/tool_results、steering、continue、stop。
- 恢复区显式经过预算节点，再分到 auto-handoff 或记录错误并抛出。
- 循环边界有独立的 `continue → last-step → max-steps` 路径。
- 动画只点亮数据层声明的节点与边；C1 标签为「结构示意 · 未实测」，不填重复次数。
- `or=` 是否造成所述短路、`max_steps` 具体触发时机、是否没有其他停滞检测，均不冒充源码事实。

### B5 · 职责与层级

- 图形：model、ToolExecutor、harness 三条泳道；带载荷的边表达交接。
- `step` SVG 分组是 `turn` SVG 分组的真实 DOM 后代，且几何上完全位于 turn 边界内。
- turn 表示一次 inbound 到 `TurnResult` 的框架边界；step 表示其中一次模型往返，一个 turn 含一个或多个 step。
- tape 画在 turn 外，表达记录跨 turn 存在；写回边从 harness 指向 tape。

## 3. 响应式形态

桌面使用完整 SVG。`390×844` 下，P1、P3、B1、B2、B4、B5 使用各自的窄屏等价图，保留以下关系：

| 块 | 窄屏仍需可见的关系 |
|---|---|
| P1 | 两端点、映射类型、Python 内并列形态 |
| P3 | 四个职责位置、每对成立与失效 |
| B1 | 双起点、共同初始化、调用位置分开、汇合、第一次 turn 触发点 |
| B2 | 六阶段顺序、`finally` 只包含 `_run_model`、三个出口的真实来源 |
| B4 | 三分区及每区的真实分支 |
| B5 | turn 包含 step、三类职责、写回 tape |

B3 继续使用可横向滚动的 tape 图，因为横向记录范围本身承担读取/追加方向；滚动只发生在图的自有容器内。

## 4. §E 断言边界

§E 不以「文字存在」替代图形或拓扑断言。当前关键保护包括：

| 块 | 直接量测或遍历的对象 |
|---|---|
| P1 | 六条 SVG 边的端点存在、类型正确；只出现当前两类映射；真实源码 ref 在页 |
| P3 | 四条 SVG 边、八个端点、每对的成立/失效短标签 |
| B1 | 十二节点、十二边、双起点到 `process_inbound` 的可达性、分叉/汇合关键边、唯一汇合点和触发点 |
| B2 | 真实阶段矩形与 scope 矩形的包含关系；三出口各自的 `fromStage` |
| B3 | 九条 SVG 边及端点；默认 selector 过滤；首帧不提前点亮读取范围，下一帧才点亮 |
| B4 | 十一节点、十二条 SVG 条件边及端点；停止、预算、循环边界；演示帧点亮实际边 |
| B5 | 三泳道；step 对 turn 的 DOM 后代关系与几何包含；带载荷的跨泳道 SVG 边 |
| 手机 | 六块窄屏等价图可见且对应桌面 SVG 隐藏；B3 图在自有容器滚动 |

每块的 `accept` 与关键事实片段都有精确断言。变异检查会临时删除或改写一条关键结论，重新构建并确认
对应断言失败，再恢复源文件并重建最终产物。

## 5. v1.1 验收记录（历史）

本节只记录命令实际输出，不用文档自述代替执行结果。

```bash
cd week8-fullstack/src/frontend
yarn typecheck
yarn build:showcase
PORT=8199 CHROMIUM_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  node scripts/verify-w9-board.mjs
SHOWCASE_AUDIT_SCREENSHOTS=1 SHOWCASE_AUDIT_TOPICS=ai-engineer \
  CHROMIUM_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome yarn audit:visual
```

- 最终 `typecheck` 通过；`build:showcase` 通过；`verify:board` = **1297 项通过，0 项失败**。
- 关键结论变异检查：在当时的 1295 项套件中，临时把 B1 `accept` 中「两条启动路径」改成「启动路径」
  并重建后，结果为 **1294 项通过，1 项失败**，唯一失败项是
  「AI 板-entry-chain 关键结论受断言保护 — 两条启动路径」。随后已恢复源码并重建；最终套件另增加两条
  B4 局部证据标签断言，得到上一条 1297/1297 的结果。
- `audit:visual` 采样 **172 个视口专题状态**；AI 工程板桌面最大 1.38 屏、手机最大 2.26 屏，
  两档页面级横向溢出均为 0。七块桌面 `1440×1000` 与手机 `390×844` 截图已逐张检查，未见文字压线、
  断头边、标签脱离对象或不连贯重叠；截图位于 `/tmp/nodejs-skillup-showcase-visual-audit/`。
- 人工闸仍由仓库主人按各块 `accept` 独立完成；实现方截图复核不替代本人验收。

## 6. 文件范围

本轮修订只涉及：

- `week8-fullstack/src/frontend/src/aiEngineerTopics.ts`
- `week8-fullstack/src/frontend/src/AiEngineerBoard.tsx`
- `week8-fullstack/src/frontend/src/styles.css`
- `week8-fullstack/src/frontend/scripts/verify-w9-board.mjs`
- `week8-fullstack/notes/w12-ai-visualization-plan.md`
- `week8-fullstack/notes/w12-ai-board-design.md`

不修改学习代码，不把 Bub 开发机源码当成本仓库可复核依据。

## 7. v1.2 实现规格与待验收记录

### 7.1 导航与分派

- `AE_TOPICS` 顺序：`py-syntax`、`cli-dispatch`、`async-failure-lifecycle`、`entry-chain`、
  `turn-pipeline`、`tape-context`、`step-loop`、`roles-nesting`。
- `AeTopic` 新增 `trace` 分支；`TopicVisual` 只为该分支新增 `FailureTraceVisual`。
- P1/P3/B1 数据与 JSX 不改。B3 只修改 `boundary`，不改 tape 图或播放器。

### 7.2 P4 `async-failure-lifecycle`

- 数据：3 条 `scale=ordinal` 轨迹；point 含 `ordinal/actor/kind/atSeconds?`，edge 含
  `from/to/relation`，终点含 `exception/clientClosed`。
- 三条轨迹均来自 D4 本项目受控 HTTP/httpx 实验。cancel 固定 `read=30s/hold=60s`，先由调用方在
  finally 完成后观察 `CancelledError` 与 task cancelled，再退出外层 `async with` 完成 client 级关闭。
- 桌面：三条横向 SVG 因果轨迹，所有 edge 有真实端点；每轨独立编号，SVG 标
  `data-scale=ordinal-not-common-time`。
- 手机：三条纵向轨迹，point 顺序与桌面一致。MRO、取消注入、C3 清理证据与 pending warning 下沉。

### 7.3 B2 checkpoint 拓扑

- 主路径节点：前三阶段 → `_run_model` → `save_state` checkpoint；success 再到 collect/dispatch。
- success/exception/cancelled 各自有 `data-path`，都包含 `run-model→save-state`。
- 前三阶段各有 `data-excludes=save-state` 的 early-error 旁路。手机 protected region 同时显示
  `_run_model`、checkpoint 与三条 outcome。
- cancelled 折叠层同时渲染 Python 3.12.10 等价实测和 Bub 本体待运行两个 `ScopedEvidence`。

### 7.4 B4 静态状态机与 C1 双轨

- 三分区 11 节点、12 条条件边保持默认静态完整可见；不再用 C1 播放器逐帧替代完整图。
- 唯一 `data-level=turn` 外框包含 `data-level=step-loop`；B5 不再渲染该层级。
- C1 双轨共享 `maxSteps=3/steering=false/branch=tool_calls`：repeat 为 1T/2T/3T 后
  `max_steps_reached=3`，control 为 1T/2F 后 `return`。DOM 不生成 `data-step=4`。
- 边界折叠列出 tool_results、steering、auto_handoff、Bub runtime 未覆盖；Bub scope 保持
  `targetVerified=false`。

### 7.5 B5 四职责矩阵

- 同一 responsive DOM 按 responsibility 组织四行，每行并排 D4/Bub 两格；手机不按 system 整列堆叠。
- 每格必须有 `system/responsibility/status/owner`。D4 状态为 present/manual/absent/absent；
  Bub 四格 status 均 present 且 owner 非空。
- 结构化边只允许 D4 decide→execute；禁止 D4 execute→decide/persist。Bub 至少包含
  execute→continue 与 execute→persist。
- `contentEmpty/toolCallCount/argumentsJsonParseable/resultFedBack` 与 call id/JSON/hook 细节进入折叠层。

### 7.6 专项断言

- 深链数量为 8；逐专题默认态非空、单一 accept、无 Markdown 残留、无页面级横向溢出。
- P4 断言轨迹数量、端点、ordinal、timeout 对照变量、cancel 输入与五节点时序、实验作用域、失败异常与关闭终点。
- B2 断言 checkpoint 唯一、三 path 可达、success 后续、三 bypass 与取消双 scope。
- B4 断言静态拓扑、唯一短路边、turn/step 唯一包含、两轨同 maxSteps、step3/step2 终点、无 step4。
- B5 断言 4×2 cells、D4 absent slots、Bub owners、D4 禁止边与 Bub tool-result 两条边。

### 7.7 本轮验收记录

v1.1 §5 的 1297/1297 与七块截图不作 v1.2 的证据。以下均为 2026-09-03 最终工作树的实际结果。

| 证据 | 状态 |
|---|---|
| `yarn typecheck` | 通过 |
| `yarn build:showcase` | 通过，362 modules transformed |
| `yarn verify:board` | **1324/1324** |
| 桌面 `1440×1000` / 手机 `390×844` | 默认态全站 174 个视口专题状态；AI 工程 8 块横向溢出均为 0，桌面最大 1.43 屏、手机最大 2.50 屏 |
| 深色 / 全展开 / reduced-motion | P4、B2、B4、B5 两档视口共 8 组，深链正确、details 全开、reduced-motion 命中、横向溢出 0、控制台错误 0 |
| 10 秒结论 / 视觉记忆点 / 首屏路径 | 实现方与独立 review 复核通过；P4/B4 首轮碰撞已修复并复拍 |
| 标题与结论遮挡回忆 | 保留为仓库主人独立闸；实现方不能代替本人回答验收句 |

默认态截图位于 `/tmp/nodejs-skillup-showcase-visual-audit/`；深色全展开截图位于
`/tmp/w12d4-browser-review/`。本轮未部署。
