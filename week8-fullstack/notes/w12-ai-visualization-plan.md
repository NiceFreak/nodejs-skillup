# W12 可视化方案（草案 v0.4）：Python 迁移增量 + Bub harness 深读

> 状态：**草案 v0.4（2026-09-02）**。v0 判 7 阻断 → v0.2 修订；v0.2 判 5 阻断 → v0.3 修订；
> v0.3 判 3 阻断 → v0.4 修订。**第四轮 review 判定：六项复核 5 项通过、1 项（文档引用/轮次文字）
> 已修正，剩余问题不引起实现返工。** 十列与数据契约冻结可进 JSX；实现期仍以 §8 复核点自查。
> 范围：`week8-fullstack/src/frontend/` 展示资产（白名单）。不修改学习代码，不部署。
> 验收门槛：`yarn typecheck` / `yarn build:showcase` / `yarn verify:board` + 新增断言（图拓扑 +
> 深链） / `yarn audit:visual` + 桌面/手机截图 + 人工闸（逐块 expected answer / 标题+结论段遮挡 /
> 首屏结论锚）+ 存量首屏回归。
> 内容源版本：Bub `33c417a`；Python 实验 = D2/D3 实测记录；结论口径以
> `week12-python-rag/notes/bub-reading-report.md` 与 `day3-bub-main-chain.md` 为准；
> Express 侧真实来源 = `week2-express/src`。

## 0. 这次要解决的问题

W12 起进入 AI Engineer reskill（Python/Bub → RAG → harness → MCP → reliability/evals），产出
开始脱离 Node 后端，读者（本人）的复习与回忆成本明显上升。当前 Python 语法与 Bub 阅读结论只存在于
文字笔记，扫描效率低，且延迟重建（W14 自建最小 harness）需要「看图即回忆机制」的支持。

目标 = 把两类高密度内容变成**看图能懂的视觉对象**：① TS→Python 迁移增量；② Bub 的 harness 骨架
（turn 边界、loop 控制、tape→context）。质量基准 = 视觉协议第 1 节认定的当前标杆（Node.js 运行时）
可迁移的四条原则——结论由版面承担、主路径与证据详情分层、同一板复用稳定参与者与视觉语法、动效只在
状态确实随时间变化时承担教学职责。**迁移的是原则与水准，不是知识点 4/5 的具体组件或形态**；每个内容
用什么形态，由 §1/§3 的内容推导决定，允许协议 §3 表之外的新形态。

非目标：不做全站重写；不为现有 board 顺带返工；不虚构未实测数字；不把 OpenAI/Anthropic 的
harness 官方结论画上去（OpenAI 原文 403 未核验，见 §7 风险）。

## 1. 候选内容盘点与判据

**形态选型方法论（先于一切形态判断）**：

1. 每个候选先回答：这段内容的核心关系是什么（顺序 / 对比 / 层级 / 归属 / 循环 / 分叉 / 状态涨落 /
   结构映射 / 时序因果…）。
2. 从协议 §3「认知任务 → 首选形态」表选形态，表不足时允许扩展形态（状态机 / 循环数据流 /
   嵌套容器 / 对齐映照 / 分支拓扑等），只要符合协议可访问性与「结论由版面承担」。
3. **既有 tab 的组件（framePlayer / strip / 泳道）只是「实现复用」候选，不是形态约束**：内容需要
   什么形态就用什么形态；能与既有组件对齐是工程优化，对不齐就新增，绝不因为某个形态「现成」
   而套用它。
4. 判定是否适合出图用三条**本方案独立陈述**的判据（不以历史文档为规范来源）：同类对象 ≥3 且差距
   本身是结论时做相互比较；差距本身是结论时用视觉编码承载；信息有序或分层时用位置编码表达。

下表中「形态」栏 = 按上述流程得到的**初步方向（非终选）**；最终形态在 §3 推导表定稿。

### 1.1 Python 迁移组（源：D2 语法对照 6 单元 + D3 现场展开）

| 候选 | 核心关系 | 认知任务（协议 §3 对应） | 形态（初步，非终选） | 取舍 |
|---|---|---|---|---|
| P1 语法对照 6 单元（函数与类型 / import / dataclass·Pydantic / 异常链 / context manager / pytest） | 同一语义多端点表达，**映射类型不同**（等价/近似/新增/Python 内两形态） | 结构映射、形状变化 | 对齐映照（分语言栏 + 跨栏连线 + Python 内对照框） | 范围 = D2 完成的六个单元；dataclass↔Pydantic 记为 Python 内两形态（语义源 TS interface） |
| P2 模块执行时机（import 顶层执行 / `__name__` 门） | 同一脚本按入口分叉 | 分叉、时机 | （并入 B1） | **并入 B1**：它是入口链两条启动路径的核心语义，不再列 Python 组独立专题 |
| P3 CLI 分发器对照（Express 路由 ↔ typer，`ctx.obj`，异步模型差异） | 两套 API 存在**可对应的职责位置**（近似脚手架，非严格同构） | 结构映射、归属 | **结构对齐映照**（四职责位置 + 每对成立/失效标签，静态） | Express 是理解脚手架；每对标失效点，不宣称严格同构 |
| P4 async 模型差异（Python 无常驻循环 vs Node libuv） | 运行时结构对比 | 运行时结构 | — | **内容未冻结**（D4 实验后）；推到 D4/D5 后或 W13 |

### 1.2 Bub harness 组（源：bub-reading-report §0-§6 + day3 §8）

| 候选 | 核心关系 | 认知任务（协议 §3 对应） | 形态（初步，非终选） | 取舍 |
|---|---|---|---|---|
| B1 入口链（含 P2 模块执行语义） | 双启动路径（console wrapper / python -m）分叉后汇合 `app()`；模块归属与 import 时机 | 顺序、归属、时序、分叉汇合 | 序列泳道：双启动线汇合到 `app()`，L43 两线共有 / L46 仅 python-m | P2 并入本块（import 即执行 + `__name__` 门是双启动差异的核心语义） |
| B2 turn lifecycle 管线 + save_state 作用域 + 结束分叉 | 顺序管线 + finally 作用域 + 分叉停止 | 顺序、保证范围、汇聚分叉 | 顺序管线 + 作用域包含框 + 终止分叉 | 锚句 =「进入 `_run_model` 后尝试调 save_state（finally 只罩 `_run_model`，非保证持久化）」；CancelledError 标待运行验证 |
| B3 tape 追加 vs context 重建 | 单一真相源 + 两操作（读投影/写追加）时序因果；投影 ≠ 完整 messages | 反馈与资源涨落、时序、包含 | 单一真相源视图（一卷带子 + 读写口 + read→model→append 环） | 记忆点 =「一卷带子、两个朝向它的口」；区分 tape 投影区与本轮输入区 |
| B4 Agent step loop 判定 | 控制流四层（final 判定 / steering 补充 / 异常恢复 / 循环边界） | 汇聚、分叉、停止、层次 | **分层状态机**（正常判定子机 + 异常恢复子机 + 循环边界分区） | C1 mock 实测（D4）后回填证据 |
| B5 model / tool / harness 职责 + turn vs step | 归属 + 包含层级 | 归属与交接、包含层级 | 泳道（归属）+ 嵌套容器（turn ⊃ step） | 与现有泳道语言的相似是内容巧合，形态仍按归属/层级推导 |
| B6 Bub 术语 ↔ Web 映照表（report §0.1 已有 22 行） | 词典映射 | — | 表格 | **不上板**；若做页内术语释义，必须同时提供 focus/click/键盘与手机等价入口，禁止 hover-only（协议 §5） |

### 1.3 明确不做（本草案）

- Python 语法全量速查（进学习笔记 tab）。
- OpenAI/Anthropic harness 官方对照矩阵——OpenAI 原文未核验（403），核验后再评估。
- Bub 非主链（channel 细节 / sidecar / spill / skills 内部）：读报告已标选修，可视化同样砍掉。
- W13-W16 内容（RAG / harness / MCP / evals）：五周尚未产出，只预留 tab 扩展位，不预画。

## 2. 版面组织（增量，不动存量 tab）

- **新增顶层 tab `ai-engineer`（label「AI 工程」）**，一期含两组知识导航：
  `Python 迁移增量`（P1-P3）与 `Bub harness 骨架`（B1-B5）。
- 页面骨架沿用展示站点既有 Board 的共同结构（组导航 → 当前知识点舞台 → 复习门 → URL 深链）；
  该结构同时满足协议「首屏先视觉舞台」与仓库既有交互习惯，不是复制任一具体周的内容编排。
- 未来 W13-W16 产出在本 tab 内加组，不新增顶层 tab（范围门禁见 §7 风险）。
- 接线点（事实）：`types.ts` 的 `ShowcaseTab` union + `Showcase.tsx` 的 `TABS` 与 tabpanel 分发 +
  新 `AiEngineerBoard.tsx` / `aiEngineerTopics.ts`（新增文件，模式沿用 w5Topics.ts 的数据层纪律）。

## 3. 形态推导表（最终形态在此定稿，不引用既有 tab 作依据）

先给每块内容做「关系 → 认知任务 → 形态」推导；「是否用既有组件实现」是工程决策，放 §5，不进本表。
「过程动画」只在内容确实随时间变化时才允许（协议 §3.3）；静态结构对照不得演成虚假过程。

| 块 | 内容核心关系（一句话） | 认知任务 | 推导出的形态 | 过程动画？（为什么） |
|---|---|---|---|---|
| P1 | 同一语义多端点（TS / Python dataclass / Python Pydantic…）表达；映射类型含「Python 内两形态」 | 结构映射 / 形状变化 | 对齐映照：分语言栏 + 跨栏连线 + Python 内对照框；映射类型用线型/框型 | 否——静态对照，避免把映射演成流程 |
| P2 | 同一脚本因 `__name__` 进入不同路径；这是 B1 双启动路径差异的核心语义 | 分叉、时机 | （并入 B1）——作为 B1 两线差异的解释，不单独落位 | —（并入 B1；B1 动画 = 否，静态为主） |
| P3 | Express 与 typer 的 CLI/HTTP 入口存在**可对应的职责位置**（把 Express 当理解脚手架，非严格同构证明） | 结构映射 / 归属 | 结构对齐映照：四个职责位置并排对应，每对标注「成立点」与「失效点」（差异不止分发对象与循环来源） | 否——结构对照是空间关系不是时间过程；只做方位过渡 |
| B1 | `bub`（console wrapper）与 `python -m bub` 两条启动线：都经模块 import 执行 L43（建 app），差异 = 谁调用 `app()`（wrapper vs L46 `__name__` 门），汇合后走 typer 分发 → cli.run → process_inbound | 顺序 / 归属 / 时序因果 / 分叉汇合 | 序列泳道：双启动线分叉后汇合到 `app()`；L43 标两线共有，L46 仅 python-m 线 | 否（静态为主）——真实调用有先后但静态序列可讲清；不做自动播放 |
| B2 | turn 内阶段有固定顺序；`save_state` 由仅包住 `_run_model` 的内层 finally 无条件调用（更早阶段异常不经过）；turn 结束时按异常类型分叉 | 顺序 / 分叉停止 / 保证范围 | 顺序管线 + 终止分叉；finally 的**作用域**（只包 `_run_model`）单独标出，结论锚 =「进入 `_run_model` 后无论成功/普通异常/取消都会尝试调 `save_state`」（尝试 ≠ 保证持久化成功） | 否（静态）——与 §4.4 B2 十列一致；不做自动播放；CancelledError 路径标注「源码推导，运行验证 D4」 |
| B3 | 同一份 tape（唯一真相源）被两个操作使用：模型调用前 read 投影、调用后 append；read 决定所见、write 决定下次所见 | 反馈与资源涨落 / 时序因果 / 包含 | 单一真相源视图：一卷带子 + 两个操作点（读口/写口）+ 一轮时序环（read→model→append）；context 窗口 = 带子的投影（包含关系） | 是——「一轮读写在模型往返间交替」是真实时序过程，帧可演示一轮 |
| B4 | step 循环的正常判定、补充判定、异常恢复、循环耗尽处于**四个不同控制层次**：① final 先算 tool_calls/tool_results（L242）；② 有 tool 结果 → 短路 continue，**无**才查 steering（L285 `or`）；③ context 超限且在 auto_handoff 预算内走恢复（L246），预算耗尽记 error 并 raise；④ max_steps 只在最后一次仍 continue、for 耗尽后触发（L309），满足停止则循环内正常 return | 汇聚 / 分叉 / 停止位置 / 层次 | 分层状态机：正常判定子机（tool 短路边 + steering 补充判定）+ 异常恢复子机（含预算）+ 循环边界（「最后一步仍 continue」触发），三层分区 | 是——演示 step 流经判定是语义过程；C1 演示 normal 环不收敛 → 循环边界触发 |
| B5 | model 决策、tool 执行、harness 编排/落盘，turn 包 step | 归属与交接 / 包含层级 | 泳道 + 嵌套容器：三个参与者泳道 + turn 容器含 step 环 | 否——归属与层级是静态结构 |

最终形态一律遵守视觉协议的质量基线：结论由版面承担、主路径与证据详情分层（协议 §1 四原则）、
动效只在状态随时间变化时承担职责（§3.3）、颜色只做第二编码（§3）、每块一个技术关系结论锚（§3.1）、
可访问性与 reduced-motion（§5）。
## 4. 逐块设计契约（十列）

按视觉协议 §2 填列；本草案对三块重点给出完整十列（B3 单一真相源视图，B4 分层状态机并承载 C1 证据，
P3 结构对齐映照），其余块十列在 §4.4（P1/B1/B2/B5）。实现期改变核心图形/分页/主路径必须先回写本表。

### 4.1 B3 · tape 追加 vs context 重建（重点板；形态推导见 §3）

| 列 | 内容 |
|---|---|
| ① 单一问题 | 事实先落 tape，模型每次看到的 context 为何是「现算投影」而非累积缓存？ |
| ② 10 秒结论 | tape 是会话历史的唯一持久化真相源、只追加不修改；每次模型调用前 harness 从带子现读历史投影，再并入本轮 system/prompt/steering 后发给模型——「历史是投影，不是越存越大的记忆」 |
| ③ 对象与数据形状 | 中心对象 = 一卷带子（TapeEntry 序列：system/message/tool_call/tool_result/error/event run，kind 色点 + 名称）；两个操作点 = 读口（read_messages：anchor 后 + meta.context!=False + 默认只留 message kind → **历史投影**；自定义 `TapeContext.select` 可覆盖默认过滤，需分开标注）、写口（record_chat：一次模型往返追加一组事件）；边界 = 读口输出只是模型 messages 的**历史部分**，完整 messages 还含本轮 system/prompt/steering（model_runner L333-336） |
| ④ 结论编码 | 包含（窗口 ⊂ 带子）+ 方向（append 单向写、read 出投影）+ 时序因果（一轮 = read→model→write；读在调用前、写在调用后，源码 model_runner L322 读 / L251·L270 写） |
| ⑤ 视觉舞台 | 首屏：居中一卷带子，上下两处操作点（读口/写口），带一轮时序环说明「先读后写」；窗口灰显被过滤 kind（tool_call/tool_result 不进 messages）；短句结论「带子只追加，窗口现算」 |
| ⑥ 文字层级 | 常驻：结论短句 + boundary（工具记录不进模型 messages；store id 分配待 store.py 验证）；折叠：TapeEntry 各 kind payload 明细 |
| ⑦ 视觉记忆点 | 「一卷带子、两个朝向它的口」——真相源只有一份；读是快照、写是追加，二者不同时发生 |
| ⑧ 图标策略 | 无新图标；kind 用固定色点 + 名称，读写口用方向符号（语义必要） |
| ⑨ 动效策略 | 语义过程：演示一轮时序 read→model→[工具路径：执行工具→追加 tool_call/tool_result]→append；若只演纯文本路径，帧内标注「不含工具执行」，避免把工具条目追加读成模型返回后立即写入；framePlayer 类控件可暂停/单步/重放；reduced-motion 静止为静态单带图 |
| ⑩ 验收证据 | 验收句「模型 messages 的历史部分 = 最近 anchor 后按 context 规则现读的投影；完整 messages = 该投影 + 本轮 system/prompt/steering」；图中必须区分「tape 投影区」与「本轮输入区」两段，默认 selector 与自定义 select 分开标注；桌面 1440×1000 + 手机 390×844 截图；verify 断言 = 页面同时含「投影/历史」与「本轮输入」两区标签、默认过滤与 select 覆盖说明；reduced-motion 下信息完整 |

### 4.2 B4 · Agent step loop 判定（四控制层次；承载 C1 闭合问题证据）

| 列 | 内容 |
|---|---|
| ① 单一问题 | 一次 turn 内的 step 循环，什么条件下继续、停止、恢复或兜底？这些判定各在哪个控制层次？ |
| ② 10 秒结论 | 正常判定：final 带 tool_calls/tool_results → **直接继续**（短路，不再查 steering）；否则查 steering，有消息也继续；两者皆无才停。context 超限**且在 auto_handoff 预算内**走恢复（预算耗尽则记 error 并 raise）；循环内正常 return 只发生在满足停止条件时，最后一步仍要求 continue 且 for 耗尽才触 `max_steps` 抛 RuntimeError——四类出口不在同一层 |
| ③ 对象与数据形状 | 四层对象：① 事件消费层 = final 事件（tool_calls/tool_results 有无）；② 补充判定层 = steering 消息（tool 已继续时不查）；③ 异常恢复层 = except 分支 + `auto_handoff_remaining` 预算（agent.py L246）；④ 循环边界层 = for step vs max_steps（最后一次仍 continue 才触发，L309）。量 = 各层分支发生次数（C1 mock 实验后回填实测） |
| ④ 结论编码 | 分层状态机：正常判定子机（run → final：有 tool 结果 → 直接 continue（短路边）；无 → 查 steering：有 → continue / 无 → stop）＋ 异常恢复子机（except：context 超限且预算 >0 → auto_handoff → 下迭代；否则记 error → raise）＋ 循环边界（最后一次仍 continue、for 耗尽 → RuntimeError；满足停止则在循环内正常 return）。三个子机分区并置，不把不同层级压成同一节点下四岔 |
| ⑤ 视觉舞台 | 首屏：三个分区——正常判定子机（tool 短路边与 steering 判定区分显式，标 L242/L285）、异常恢复子机（含预算计数 L246-268）、循环边界（L309 只作为「最后一次仍 continue」的出口）；可播放 C1 演示（模型反复要工具 → 每次走短路 continue → 最后一步仍 continue → 循环边界触发） |
| ⑥ 文字层级 | 常驻：分层结论句（「继续有两来源，停止是两者皆无；handoff 与 max_steps 不在正常判定层」）+ boundary（无停滞检测，C1 为待运行验证/D4）；折叠：auto_handoff 细节与各 except 分支 |
| ⑦ 视觉记忆点 | 「两条『继续』来源 vs 一条『停止』」：normal 环内继续来自 tool 结果或插话；停止是两者皆无；handoff 与 max_steps 位于 normal 环外的恢复/边界层（三层分区本身是记忆锚） |
| ⑧ 图标策略 | 状态符号：继续/停止/恢复/超限四类（语义必要）；不做「停车标志 = 唯一停止」的误导符号 |
| ⑨ 动效策略 | 语义过程：演示 step 流经 normal 判定与 steering 补充；C1 演示展示 normal 环不收敛 → 循环边界触发；可暂停/单步/重放；reduced-motion 静止为三分区拓扑 |
| ⑩ 验收证据 | 验收句「有 tool 结果 → 短路 continue（不再查 steering）；无 tool 结果才查 steering 定 stop；auto_handoff 只在 context 超限且预算 >0 时发生（预算耗尽记 error 并 raise）；max_steps 只在最后一次仍 continue、for 耗尽后触发」；verify 断言 = tool=yes 直达 continue（steering 判定在该路径不可达）、auto_handoff 边带预算条件、max_steps 边标「最后一步仍 continue」；C1 实测后补数字（来源标注 mock 实测）；截图两视口 |

### 4.3 P3 · CLI 分发器对照（Express ↔ typer，入口链可理解前置）

| 列 | 内容 |
|---|---|
| ① 单一问题 | 同一个「前置处理 → 分发 → 上下文 → 处理函数」形状，在 Express 与 typer 里各如何实现？对应到哪、失效在哪？ |
| ② 10 秒结论 | Express 的中间件/路由模型是理解 typer 的**脚手架**：两者存在四个可对应的职责位置，但对应是近似的——每对都有成立点与失效点，不是严格同构 |
| ③ 对象与数据形状 | 四个职责位置 × 两侧真实实例：**全局前置**：`app.js` L19（请求日志中间件，生成 requestId 后 `next()`）↔ framework.py L105-112 `@app.callback`；**处理注册**：`app.js` L100 `app.use('/auth', authRouter)` / `routes/auth.js` L9 `router.post('/register', ...)` ↔ `hook_impl.py` L248 `app.command("run")(cli.run)`；**入站解析**：`app.js` L83 `express.json()` ↔ typer 读 argv 映射参数（cli.py run 签名）；**处理函数 + 上下文**：`registerController(req,res)`（controllers 层）↔ `cli.run(ctx, ...)` + `ctx.ensure_object(BubFramework)`（cli.py L38-67）。每对标注成立点/失效点；**失效点例子**：Express 的 404 catch-all（app.js L103）与 error handler（L110）是管线收口、typer 无对应物；HTTP 每请求独立 req/res 生命周期 vs CLI 进程一次性 argv |
| ④ 结论编码 | 结构对齐映照：四个职责位置并排，对齐线表示**近似对应**；每对带「成立 / 失效」标签，失效用明确标记（非隐喻符号），差异是判断内容不是标注杂音 |
| ⑤ 视觉舞台 | 首屏：两栏并排结构图 + 四段对齐线；两侧代码均为真实来源（Express 侧 `app.js` L19 前置中间件 / L83 / L100 业务挂载、`routes/auth.js` L9；typer 侧 `hook_impl.py` L248、`cli.py` run 签名、framework.py callback）；底部边界位单列失效点（Express 404 catch-all L103 与 error handler L110 无 typer 对应物、Node 常驻循环 vs `asyncio.run`、HTTP 生命周期 vs argv） |
| ⑥ 文字层级 | 常驻：四个职责位置标签 + 成立/失效标签；折叠：typer 参数映射细节、Express 中间件顺序细节 |
| ⑦ 视觉记忆点 | 「四根职责对齐线」——对齐线是记忆锚；失效用与成立不同的线端标记区分，不做文字隐喻 |
| ⑧ 图标策略 | 两端各一宿主符号 + 职责位置序号；成立/失效用线型与线端标记（语义必要），无装饰 |
| ⑨ 动效策略 | 无过程动画（结构对照是空间关系）；只保留滚动/悬停对齐线的方位过渡 |
| ⑩ 验收证据 | 验收句「Express 是理解 typer 的近似脚手架：四个职责位置可对应，每对标注了成立与失效边界，未宣称严格同构」；verify 断言 = 四段对齐存在、每对含成立/失效标签、typer 侧 `hook_impl.py` L248 与 Express 侧 `routes/auth.js` L9 / `app.js` L19 等真实行号在页（无虚构 `/run` 路由）；截图两视口 |

### 4.4 其余块十列（P1 / B1 / B2 / B5 完整；P2 处置见末）

**P1 · 语法映照（本周完成的六个语法单元，D2 记录；不做来源之外的扩展）**

| 列 | 内容 |
|---|---|
| ① 单一问题 | 本周（D2）完成的六个语法单元迁到 Python 时的对应关系各是什么形态？ |
| ② 10 秒结论 | 六个单元都有明确对应，但**映射类型不同**：TS↔Python 等价、近似、或**仅 Python 侧两形态对照**（如 dataclass ↔ Pydantic 的语义源是 TS interface） |
| ③ 对象与数据形状 | 六单元（函数与类型、import/export ↔ from/import、dataclass ↔ Pydantic、异常链、context manager、pytest 入口）；每项字段 = 单元名 + `sides`（可 ≥2 端点：TS interface、Python dataclass、Python Pydantic…）+ 映射类型（等价 / 近似 / 新增 / Python 内两形态）+ 易错点；「六个最易混」无来源支撑，不使用该措辞 |
| ④ 结论编码 | 对齐映照：端点按语言分栏，跨语言用对齐线，Python 内两形态用栏内并列框；映射类型用线型 + 标签，颜色不作唯一区分 |
| ⑤ 视觉舞台 | 首屏：分语言栏（TS 栏 / Python 栏），跨栏对齐线 + Python 内对照框；映射类型图例 |
| ⑥ 文字层级 | 常驻 = 单元名 + 映射类型标签；折叠 = 各单元易错点详解 |
| ⑦ 视觉记忆点 | 「同一语义、各语言外观」；对齐线与栏内对照框是记忆锚 |
| ⑧ 图标策略 | 无新图标；线型与框型承担映射类型 |
| ⑨ 动效策略 | 静态；hover 高亮对应端点与连线（方位过渡） |
| ⑩ 验收证据 | 验收句「六单元的映射类型能被独立正确分类，dataclass/Pydantic 记为 Python 内两形态而非 TS 等价」；verify = 六个单元均在页、每单元带类型标签与图例、连线端点正确（断言检查连线目标端点 id，非只查标签存在）；截图两视口 |

**P2 并入 B1（不再是 Python 组独立专题，也不放 P3）**：模块执行时机（import 即执行顶层、`__name__`
门）是 **B1 入口链的核心语义**，不是 P3（Express/Typer 对照）的成立边界。处置 = 并入 B1 块：B1 必须
展示两条启动路径（console script vs `python -m`），差异正由「谁在何时调用 `app()`」决定，解释依赖
模块级执行与 `__name__` 门。Python 组不再列 P2。

**B1 · 入口链（含 P2 模块执行语义）**

| 列 | 内容 |
|---|---|
| ① 单一问题 | `bub` 命令与 `python -m bub` 两条启动路径如何汇到同一个 `app()`？模块归属与执行时机如何分工？ |
| ② 10 秒结论 | `bub`（console script，pyproject `[project.scripts] bub = "bub.__main__:app"`）：wrapper import `bub.__main__` → 模块级 L43 执行（建 app）→ wrapper 调用 `app()`；`python -m bub`：同样先执行 L43，再由 L46 `if __name__ == "__main__": app()` 调用。两条路径汇合到 `app()`（typer 分发 → `cli.run` → `process_inbound`）；差异 = 谁调用 `app()`，由 Python「import 即执行顶层 + `__name__` 门」决定 |
| ③ 对象与数据形状 | 两条启动线；每线节点字段 = 模块 + `文件:行` + 动作（import 执行 / 调用 app / 参数解析 / 命令 handler）+ `lineOwner: "console"\|"python-m"\|"both"`；分叉/汇合用边类型表达（split / join）；汇合点 `app()`（typer.Typer 实例）|
| ④ 结论编码 | 序列泳道：两条启动线先分叉后汇合到 `app()` 节点；横轴时间 + 纵轴模块分区；L43（模块级，两线共有）与 L46（仅 python -m）用不同槽位 |
| ⑤ 视觉舞台 | 首屏：双启动线汇入 `app()` 后再入 typer 分发 → `cli.run` → `process_inbound`；节点标真实 `文件:行` |
| ⑥ 文字层级 | 常驻 = 时机句（L43 import 即执行是两线共有；L46 仅 `python -m`）+ boundary（构建后端为 hatchling，pyproject L66-68；`[project.scripts]` 仅入口声明 L47-48；console wrapper 生成/调用与 `bub run` 端到端列待运行验证，见 bub-reading-report §8；`python -m` 路径为源码可读）；折叠 = 各层细节 |
| ⑦ 视觉记忆点 | 「两条启动线、一个 `app()`」——汇合点是记忆锚；「import 时机」藏在两线差异里 |
| ⑧ 图标策略 | 两条启动线用不同线端/线型区分（语义必要）；模块泳道用标签 |
| ⑨ 动效策略 | **静态为主**：hover 高亮当前启动线路径（方位过渡），不做自动播放 |
| ⑩ 验收证据 | 验收句「两条启动路径的模块级执行一致（L43 两线共有）；差异落在 `app()` 的调用者——`python -m` 由 L46 调用（源码可读），console wrapper 行为列待运行验证；两线最终汇合到 `app()`」；verify = 双启动线存在且汇合到 `app()`、L43 标两线共有、L46 仅标 python-m 线、wrapper 细节带「待运行验证」标签、真实行号在页；截图两视口 |

**B2 · turn pipeline + save_state 作用域 + 结束分叉**

| 列 | 内容 |
|---|---|
| ① 单一问题 | 一次 turn 的管线阶段顺序、`save_state` 的保证范围、结束异常怎么分叉？ |
| ② 10 秒结论 | 阶段有固定顺序；**进入 `_run_model` 后**无论正常 / 普通异常 / 取消都会尝试调 `save_state`（finally 只罩 `_run_model`，更早阶段异常不经过；尝试 ≠ 保证持久化成功）；结束按异常类型分叉 |
| ③ 对象与数据形状 | 管线阶段序列（resolve_session → build_state → build_prompt → _run_model → collect_outbounds → dispatch_outbound）；finally 作用域框（只包 `_run_model`）；结束三岔（正常 return / except 重抛 / CancelledError 直穿，后者标注待运行验证） |
| ④ 结论编码 | 顺序管线 + 作用域**包含框**（标 finally 只罩 _run_model）+ 终点分叉 |
| ⑤ 视觉舞台 | 首屏：水平管线 + finally 作用域包含框（不扩大到整个 turn）+ 右端三岔 |
| ⑥ 文字层级 | 常驻 = 锚句「进入 _run_model 后尝试调 save_state（非保证持久化）」+ boundary（CancelledError 为源码推导，D4 运行验证）；折叠 = 各阶段 hook 细节 |
| ⑦ 视觉记忆点 | 「finally 的罩子只盖到 _run_model」——作用域范围本身是结论 |
| ⑧ 图标策略 | 阶段用序数；作用域框用包含轮廓，不加图标 |
| ⑨ 动效策略 | **静态**；hover 三岔高亮（方位过渡），不做自动播放 |
| ⑩ 验收证据 | 验收句「save_state 的 finally 只罩 _run_model，不是全 turn；是尝试调用非保证成功」；verify = 作用域框存在且只包围 _run_model 阶段、三岔标签正确、CancelledError 标注待验证；截图两视口 |

**B5 · 职责泳道 + turn ⊃ step 嵌套**

| 列 | 内容 |
|---|---|
| ① 单一问题 | model / tool / harness 各自承担什么？turn 与 step 是什么包含关系？ |
| ② 10 秒结论 | model 决策（tool_calls）、Tool 执行、harness 编排与落盘；一个 turn 含多个 step（turn ⊃ step）。停止判定不在此板重复（见 B4），避免两板口径漂移 |
| ③ 对象与数据形状 | 三个参与者（model / tool / harness）× 动作（决策 / 执行 / 编排 / 落盘）；层级对象 turn 与 step（嵌套关系） |
| ④ 结论编码 | 泳道（归属）+ 嵌套容器（turn 含 step 环）；动作跨泳道用带载荷连接 |
| ⑤ 视觉舞台 | 首屏：三泳道 + turn 容器内嵌 step 环；各动作标源码归属（agent.py / model_runner.py / framework.py） |
| ⑥ 文字层级 | 常驻 = 归属句 + boundary（未知工具名 → placeholder 抛错供 hook 恢复）；折叠 = 各层函数细节 |
| ⑦ 视觉记忆点 | 「turn 盒子套 step 环」——层级嵌套是记忆锚 |
| ⑧ 图标策略 | 参与者用稳定符号（model / tool / harness），复用现有图标语言 |
| ⑨ 动效策略 | **静态**；方位过渡仅用于专题切换 |
| ⑩ 验收证据 | 验收句「决策/执行/编排分层正确，且 turn 包含 step」；verify = 三泳道归属、嵌套容器结构、源码行号在页；截图两视口 |

## 5. 数据层与接线草案（实现方开工前冻结）

**命名（采纳外部 review 锦上添花）**：新 tab 是跨周 `ai-engineer`，文件用中性命名
`AiEngineerBoard.tsx` / `aiEngineerTopics.ts`，不用 `W12Board` 前缀，避免未来 W13-W16 数据
长期挂在误导性的周次所有权下。

**每块可枚举数据契约（十列齐全后才能落数据，防主结论退回句子）**：

| 块 | 必需可枚举形状 |
|---|---|
| P1 | `units: Array<{ id, semantics, sides: Array<{lang, kind}>, mapType: "eq"\|"approx"\|"new"\|"py-internal", pitfall }>`（`py-internal` 表达 dataclass↔Pydantic 同语言两形态；语义源可含 TS interface 端点） |
| P3 | `positions: Array<{ id, express: {node, source}, typer: {node, source}, holds, fails }>`（每对成立点/失效点 + 两侧 source） |
| B1 | `nodes: Array<{ id, module, line, action, lineOwner: "console"\|"python-m"\|"both" }>`；`edges: Array<{ from, to, type: "flow"\|"split"\|"join" }>`（能表达两线分叉与汇合拓扑） |
| B2 | `stages: Array<{id, label, line}>`；`finallyScope: {from, to}`；`ends: Array<{id, label, tone, verified}>` |
| B3 | `entries: Array<{id, kind, payloadBrief, metaContext}>`；`readStages: Array<{step, anchor, selectorMode: "default"\|"custom", visible, filtered, projectionOnly}>`（投影区；含 `meta.context` 过滤与默认/自定义 selector 标注）；`currentInputs: Array<{kind: "system"\|"prompt"\|"steering"}>`（本轮输入区，与投影区并列建模）；`writeStages`；`frame`（read→model→append；tool 路径含 execute 帧，纯文本路径标注） |
| B4 | `machine: { normalNodes, normalEdges: Array<{from,to,condition,line, shortCircuit?}>, steeringGate, exceptionModes: Array<{trigger, budgetCondition, action, line}>, loopBoundary: {trigger: "lastContinueThenExhaust", error, line} }`；`evidenceStatus` 逐分支 |
| B5 | `participants: Array<{id, role, actions}>`；`nesting: {turn, steps}`；`crossing: Array<{action, owner, target}>` |

接线（已有代码事实）：`types.ts` `ShowcaseTab` 增 `"ai-engineer"`；`Showcase.tsx` `TABS`
+ tabpanel 分发 + 顶部快捷按钮；`verify-w9-board.mjs` 增断言（含图拓扑断言：分区/边归属）、
`audit-showcase-visual.mjs` 覆盖新页视口。

**形态实现原则**：§3 推导表定稿的形态若与既有组件（framePlayer / charts / 现有 CSS）能力匹配，
优先复用实现；**不匹配时在本前端栈内新增视觉形态**（如单带读写图、分层状态机、对齐映照）。
「默认不引入新外部依赖」是防膨胀约束，不是禁止新形态——确需外部工具时在实现期单独评估记录。

## 6. 验收证据（机器 + 人工）

| 证据 | 最低要求 |
|---|---|
| 构建 | `yarn typecheck`、`yarn build:showcase`、`yarn verify:board`（新增断言含**图拓扑**）、`yarn audit:visual` |
| 视口 | 桌面 `1440×1000`、手机 `390×844`；深浅色各核 |
| 状态 | 默认态 + 全部展开态 + review 复习态 + reduced-motion |
| 度量 | 默认态屏数 ≤1.5（超出记不可拆理由）；主路径中文 ≤220 字/块目标 |
| 图拓扑断言 | 断言**图结构而非仅文字**：B3 投影区与本轮输入区分区、过滤灰显归属、**read/write 边方向与动画帧序**（read→model→[tool 路径]→append）；B4 三分区、tool=yes 短路边直达 continue、stop 边条件 =「无 tool 结果且无 steering」、auto_handoff 边带预算条件、max_steps 边标「最后一步仍 continue」；P3 对齐线与每对成立/失效标签、无虚构 `/run` 路由；B2 finally 作用域框只包围 `_run_model`；P1 连线**目标端点 id 正确**（断言连线两端点，非只查标签存在） |
| 人工闸 | 逐块记录：expected answer（用 §4 各块验收句）→ **标题与结论段同时遮挡** → 观察回答 → 记通过/不通过；**首屏是否先出现完整视觉舞台/结论锚**（根规范 §4.1/§6）；10 秒结论；视觉记忆点来自技术关系 |
| 深链与状态 | 机器断言：`#/showcase?tab=ai-engineer&topic=<id>` 可达并正确渲染；未知 topic 回退默认专题；刷新保留 topic；切 tab 清 topic（沿用既有 Showcase hash 语义） |
| 存量回归 | 共享 `Showcase.tsx` 顶栏/导航改动后，**全部存量 tab 首屏截图对比**确认无回归；判失败标准冻结三项 = 各 tab 结论锚仍在首屏、无文本裁切、无页面级横向溢出 |
| 截图 | 桌面/手机截图留存（交付记录指明） |
| 边界 | 示意动画标「相对示意」；C1 mock 数字标来源；CancelledError 保持「源码推导，运行验证 D4」标签；OpenAI 内容不上板 |

## 7. 里程碑与风险

- **M0**：v0.4 第四轮 review（通过，仅剩 3 处引用/轮次文字已修正）→ 冻结 §4 十列与 §5 数据契约 → 开工（十列与数据契约不全不进 JSX）。
- **M1**：数据层 + P3/B1/B3 → 构建全绿 + 图拓扑断言初版。
- **M2**：B2/B4/B5 + P1（B1 内含 P2 模块执行语义）→ verify 断言补全 + 存量首屏回归基线。
- **M3**：C1 mock 实验（D4）实测数字回填 B4 → 视觉复核 + 截图 + 人工闸记录 → 验收。
- 风险：
  1. **内容冻结时序**：Python async/P4 依赖 D4 实验；若 D4 溢出，P4 明确不进一期。
  2. **OpenAI 原文不可达**：官方 harness 对照不上板，只保留「待核验」标记。
  3. **手机端语义等价**：单带读写图、分层状态机、泳道与对齐映照在 390px 下的布局等价需单独设计，
     不把桌面布局简单堆列。
  4. **五周扩展位**：只预留 tab 组位，不预画未产出内容（范围门禁）。
  5. **B4 控制流复杂度**：四层状态机是本批最难的图；若 C1 实验显示还有额外分支，先回写 §3/§4.2
     再实现，不允许用文案把多出的分支解释掉。

## 8. 复核记录与自查清单（v0.4 第四轮通过；实现期按此自查）

第四轮复核结论：六项复核 5 项通过、1 项（§0/§2 的「§8 风险」引用与 M0 轮次文字）在本次修正后闭合；
review 判定剩余问题不引起返工。以下复核点保留为实现期自查清单：

1. B1 证据强度：构建后端 hatchling（pyproject L66-68）、`[project.scripts]` 仅入口声明（L47-48）、
   console wrapper 与 `bub run` 端到端标「待运行验证」——是否不再有「setuptools」「实测确认」类
   无证据表述？数据契约 `lineOwner`/`edges(split/join)` 是否足以画双启动线？
2. P3 职责归属：全局前置只用 `app.js` L19；L103（404 catch-all）与 L110（error handler）是否已
   移到失效点、不再作为「前置处理」？
3. P2 落位全文是否统一（§3/§4.4/§5/§7 均并入 B1，无残留「P3 页底部 P2」「P1 前置」指令）；
   B2 动效是否 §3 与 §4.4 一致为静态？
4. 其余块（B3/B4/P1/B5）自 v0.3 通过的结论是否因本轮改动出现回退（标题/断言/数据契约一致）？
5. 验收是否仍完整覆盖：图拓扑、首屏结论锚人工闸、深链回退、存量回归三项判据？
6. 残余反推与失效引用全文终检（含版本号、章节标题与「三/四判定点」口径）。

