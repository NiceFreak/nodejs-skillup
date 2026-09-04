# W12 概念地图

> 状态：v1.0（2026-09-05，第三方 review 验收通过）。按独立 review 三轮迭代后
> 无阻断性问题，A–F 判据全达成，可作为 W12 概念地图讨论的收口。验收结论来自
> 外部独立 review（2026-09-05），不是本文档生成者自评。v0.5 修正记录保留于
> git 历史与本文件 §5。第 2 节导航卡由 AI 以实现方模式填写，素材以仓库既有
> 笔记与计划为源，经本人 review 定稿。
>
> 依据：`TECHNICAL-WRITING-PROTOCOL.md`（2026-09-05 修订，含 §3.5）；
> `SHOWCASE-VISUAL-PROTOCOL.md`（第 3 节图形轨启动时执行十列契约）。

## 0. 这份文档是什么 / 不是什么

- 是：面向 W13–W16 的导航图，以及 W12 学习内容的串联。
- 是：以中性描述落成 W12 涉及对象的定位、已有材料与后续动作，作为后续
  学习的稳定索引。
- 不是：对全部对象的完整枚举。对象列举开放，随学习推进增补。

---

## 1. 背景：五周主线与 W12 产出（来源锚点）

### 1.1 AI 工程五周能力目标与 W12 位置

- 五周能力目标（阅读/修改/诊断 Python AI 工程代码；解释 RAG 边界；
  区分 model/retrieval/tool/harness/MCP/verifier 职责；实现单 Agent harness
  确定性控制；MCP 新旧协议；multi-trial 与故障注入；prompt 可版本化；
  context 分层；MCP/Skills 生命周期；AI-assisted SDLC）：
  `plan/ai-engineer-reskill-5-week-plan.md` §2。
- W12 周目标：通过 Bub 与真实模型 client，建立从 TypeScript 迁移到 Python AI
  工程时所需的代码阅读、异步控制、资源清理和故障诊断能力：
  `week12-python-rag/notes/week12-plan.md` §1。
- 后续周次排期：W13 RAG（9/7–9/11）→ W14 单 Agent harness（9/14–9/18）→
  W15 MCP（9/21–9/24）→ W16 reliability/evals（9/28–9/30）：
  `plan/ai-engineer-reskill-5-week-plan.md` §3。

### 1.2 本周主线完成（五项交付）

1. Python 项目基线：项目级 Python 3.12、依赖锁定、可运行入口与冒烟测试。
2. Bub 阅读报告：turn 生命周期、tape → context、model/tool/harness 职责。
3. 真实客户端实验：真实 DeepSeek 调用、最小工具调用、timeout 与 cancellation
   各真实触发一次。
4. `prompt v0` 与 VS Code Codex / Cline 同题只读对照。
5. W13 输入清单：tracked Markdown 规模盘点与排除类别。

来源：`week12-plan.md` §1；完成判定见 `LEARNING-STATE.md`（W12 D5 收口）。

---

## 2. 导航卡

### 2.1 Python 工程能力（语法、类型、异步与资源管理）

- 一句话定位：以 JavaScript 熟练（10 年）与既有 TypeScript 基础为基线，按 TS → Python 迁移增量建立 Python 项目的工程读写能力；Python 语法属可查询的 API 层，该层可随时查证，不与业务模型层的判断混淆。
- 已有材料：D2 六个迁移单元（函数/类型、import、dataclass·Pydantic、异常链、context manager、pytest）；项目级 Python 3.12.10 基线，`pytest` 全量通过、增量迁移代码行覆盖率 ≥ 90%、mypy 零严重错误；`src/` 的 Protocol / dataclass / Pydantic / httpx 异步客户端均为此能力载体。
- W13–W16 再遇位置：作为贯穿五周的实现语言复用。W13 检索/embedding 脚本、W14 自建 harness、W15 MCP Python SDK、W16 trial runner 均基于本项目 Python 3.12 基线；语言本身不再是单独学习目标。
- 下一步动作：把地板题（`python-floor-prep-questions.md`）完成并冻结答案，作为 API 层覆盖范围的盘点（已确认：语法与库调用可查文档；推断：随 W13+ 写脚本，词汇量会继续补齐）。
- 边界：不覆盖 Django/FastAPI/ORM 等框架；装饰器、generator、dunder 等只在 Bub 调用链实际出现时展开过，未做语法目录式覆盖（未验证：单独脱离项目语境使用这些特性）。

### 2.2 Python 代码阅读与排障

- 一句话定位：把 W9–W11 用 shell/systemd/Node 练过的「假设 → 执行 → 状态验证 → 偏差归因」方法迁移到 Python 载体；阅读对象是真实 AI 工程代码。
- 已有材料：D3 Bub 三条主链源码阅读（turn lifecycle / tape→context / model/tool/harness，结论带事实/推断/待验证分档）；D4 预测对照（async 行为先预测后实测）；D4 timeout/cancellation 各真实触发一次并区分连接级与业务级清理；D5 独立诊断陌生异步代码，定位共享 client 生命周期缺陷并亲手修复验证 + 反证（主线验收通过）。
- W13–W16 再遇位置：W13 读检索与 embedding 工具链、W14 读/写自建 harness 并对照 OpenAI Agents SDK、W15 读 MCP 协议与 SDK、W16 做故障注入与回归分析。
- 下一步动作：D5 已完成一次陌生异步代码独立诊断并通过，样本仅一段，不据此宣称通用排障能力闭环；随各周真实实验保留「预测 → 实测 → 偏差留痕」记录，持续扩展覆盖范围（已确认：诊断方法可运行；待扩展：更多故障类型与场景）。
- 边界：D5 只诊断过一段异步资源管理代码；D4 已在本地受控慢 server 上真实触发 read timeout 与请求中 cancellation 并记录连接关闭证据；尚未实测的是真实外网 TLS 下的连接池复用行为（论断 10）。

### 2.3 AI 工程的范围与归属

- 一句话定位：AI 工程是以模型为决策组件的软件工程实践；它和 Node 后端工程共享分层/错误/资源/可观测性基础，新增部分是模型不确定性、上下文构造与评估。
- 已有材料：五周总计划能力目标（阅读修改诊断 Python AI 工程代码、区分 model/retrieval/tool/harness/MCP/verifier 职责、实现单 Agent harness 确定性控制等）；W12 demo 讲稿三句收束（一次 tool call 不构成 Agent；Agent 需要模型能力、职责边界、循环控制与 context 管理）；Bub 报告 §0.1 术语与 Web 映照表。
- W13–W16 再遇位置：后续周次各自处理本领域的一块，排期见 §1.1：W13 RAG（context assembly）、W14 单 Agent harness（运行时控制）、W15 MCP（工具/上下文协议化）、W16 reliability/evals（评估与回归）。这是计划排期事实，不是对本领域的象限划分；AI 工程能力的覆盖范围以五周计划能力目标为限。
- 下一步动作：以 W13 为第一个再遇点，届时对照「full-context 基线 → 检索 → context 构造」验证本卡对领域的划分是否成立（推断）。
- 边界：AI 工程的范围描述来自五周计划与本周阅读的归纳，不是对领域的完备定义（推断，非权威定义）。

### 2.4 Agent 运行时概念

- 一句话定位：agent 是 AI 工程内的一种架构范式。模型在每个 step 产出 tool_calls 或纯文本；Agent 层据产出、steering、异常与预算判断继续、停止或重置，harness 提供循环边界与上下文管理。agent runtime 大于「模型加工具」的叠加。
- 已有材料：Bub 阅读报告（turn 是 framework 边界，内部是 Agent 层多 step 循环；模型产出 tool_calls 就继续、纯文本就停；职责三分 model 决策 / Tool 执行 / harness 编排落盘）；C1 等价结构实验（实验组每轮都产出 tool_calls，无停滞检测，第 max_steps 轮后经 RuntimeError 兜底终止；对照组某轮 tool_calls 为空，在该轮自然 return，两组的终止方式由该轮产出是否为空决定）。
- W13–W16 再遇位置：W14 是主线再遇点。W14 自建只读单 Agent harness 的确定性控制部分（黑名单，需本人实现），Bub 是源码级参照物；W14 D1 已排 Bub 与 Python 调用链延迟重建。
- 下一步动作：W14 重建/自建时，把「turn > step、tape→context 现算、max_steps 兜底、model/tool/harness 职责三分」作为验收设计点（已确认：这些概念在源码与报告中成立；待验证：真实多 step 会话中 messages dump 与默认渲染规则一致）。
- 边界：本周只读了 Bub 并做等价实验，未实现自己的 loop、终止状态机、trace 或 verifier；C1 未覆盖 tool_results 分支、steering 分支与 Bub 本体真实运行。

### 2.5 Bub 源码阅读的作用

- 一句话定位：Bub 是本周多个认知对象交汇的具体实例：同时作为「真实 Python 代码」的阅读对象、「阅读与诊断练习」的载体、真实 agent runtime 项目的样例存在；阅读报告是 W14 自建 harness 的源码级参照物。
- 已有材料：`bub-reading-report.md`（v1，来源 commit `33c417a`；机制结论与 Web 映照表；证据等级分档）；D3 主链阅读执行记录；C1 收敛性实验；B3 展板 tape-context 数据契约按报告 §4 修正并通过断言。
- W13–W16 再遇位置：W14 D1 延迟重建对象（Bub 与 Python 调用链，15-20 分钟单元，只看允许材料）；W14 自建 harness 时作为职责分离与循环控制的参照；W13/W16 如果涉及 context 构造与 evals，报告的「tape 是记录源、context 是每轮重建的投影」是同一认知的迁移。
- 下一步动作：在 W14 重建时验证本卡对「Bub 多重角色」的划分是否成立；届时能脱离报告讲清 turn 边界、tape→context、职责三分与 step 终止，即证明此卡成立（待验证，尚未执行延迟重建）。
- 边界：Bub 报告标注的待运行验证项（真实 turn 执行、CancelledError 直穿时 save_state、真实多 step messages dump、max_steps 真实触发）在 W12 均未完成，属源码事实与运行验证之间的空隙。

## 3. 串联轨

### 3.1 对象连接关系（从 §2 导航卡归纳，开放集合，可增补）

- **2.1 → 2.2 载体关系**：Python 工程能力是代码阅读与排障的载体；D3/D4/D5 的阅读、预测对照与诊断全部在 Python 代码上进行（依据 2.1 已有材料、2.2 已有材料）。
- **2.2 → 2.4 方法迁移关系**（AI 推断，非仓库直接事实）：排障方法论（假设 → 执行 → 验证 → 归因）来自 W9–W11 的 shell/systemd/Node 实践归纳，是仓库自有的方法表达；D3/D4/D5 把它用于理解 Python async 生命周期与资源清理。它是否适用于 Agent 运行时（循环、取消、收尾）属跨材料推断。外部佐证方向一致：Anthropic《Building effective agents》将 agents 定义为「LLMs dynamically direct their own processes and tool usage」，与 workflows（predefined code paths）相对；这与 Bub 报告 §0.1 术语表对 agent/workflow 的区分一致。该外部资料只佐证「agent 是模型动态指挥、runtime 提供编排」的方向，不构成对本仓库排障方法的规范命名。OpenAI running-agents 文档因访问受限（403）未直接核实，review 转述不作为已验证证据写入。
- **2.3 → 2.4 范围包含关系**：agent 是 AI 工程内的一种架构范式，不是 AI 工程的全部；同一领域还包含检索、评估、协议与工具层（依据 2.4 一句话定位、五周计划能力目标）。
- **2.5 对 2.1/2.2/2.4 的实例化关系**：Bub 同时是真实 Python 代码（2.1 的阅读对象）、排障方法的应用现场（2.2 的练习载体）、agent runtime 实例（2.4 的源码参照）（依据 2.5 一句话定位）。
- **2.4 → 2.5 假设来源关系**：C1 实验的可证伪假设取自 Bub 报告 §7 C1（step 循环收敛性），实验在 day4 以 Python 等价结构完成并限定为「等价结构验证，非 Bub 真实运行」；实验结论未回填 Bub 报告 §7，该节仍为候选问题与验证方案，Bub 真实 `max_steps` 触发仍列于报告 §8 待验证。等价实验可作单元级佐证，不能证明 Bub 本体的运行行为（依据 day4 §11 C1、Bub 报告 §7/§8）。

### 3.2 关系图形态（十列草案已写入 `week8-fullstack/notes/w12-ai-visualization-plan.md` §12，待独立 review）

- 图形把 3.1 的关系画成对象间带方向的连接；载体、方法迁移、范围包含、实例化与假设来源用不同线型或容器表示。
- 落点 = 方案 A：`ai-engineer` 板新增第 9 块（topic id 建议 `concept-map`）。十列契约见可视化 plan §12，待独立 review 与本人确认后才进入实现。
- 图形受 `TECHNICAL-WRITING-PROTOCOL.md` §3.5 约束：不画成带封闭等式或完备分层断言的伪精确结构；3.1 的关系集开放，不暗示枚举已穷尽。

---

## 4. 边界与增补

- 尚未确定的归类：
- 后续学习推进中新增的对象：

---

## 5. AI 辅助记录

- 素材锚点与文档骨架：AI 以实现方模式整理（白名单文档工作）。
- 第 2 节导航卡与第 3 节串联轨：AI 以实现方模式填写与归纳，素材来自仓库
  既有笔记与计划，经本人 review 定稿；标注为「AI 推断」的关系不是仓库直接
  事实，需随 W13+ 学习验证。
- 外部资料核验（2026-09-05）：Anthropic《Building effective agents》已直接
  核实（agents = LLMs dynamically direct their own processes and tool usage，
  与 workflows 相对）；OpenAI running-agents 文档访问受限（403）未核实，
  review 转述不作为已验证证据入档。
- 本轮依据的规范修订：`TECHNICAL-WRITING-PROTOCOL.md` 新增 §3.5「归纳收拢
  不得超过材料」，并同步 §6 自检清单与 §7 Review 判定（2026-09-05）。
