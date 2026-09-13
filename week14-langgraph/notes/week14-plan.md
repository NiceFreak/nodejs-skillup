# W14 周学习计划：Tool + Single-Agent Harness（LangGraph）（9/14–9/18）

> 建立：2026-09-13（Asia/Shanghai）。PIP 原定 W14 名称为 `Tool + Single-Agent Harness`，仓库执行方案用 LangGraph 承载其中的 state、tool loop、trace 和 verifier。本计划承接 W13 的固定 RAG 数据流，先建立非 Agent 基线，再进入控制层。W13 的质量与掌握验收未通过，不自动改写为通过；W14 只修补会阻断 Agent 入口的接口，并把其余问题保留为明确边界。

这是一次有意的范围重构，不是把 W14 改成继续 RAG：Tool、单 Agent 控制契约、终止/停滞/预算、trace、verifier 和多 trial 仍保留；自行实现显式 loop 和 DeepSeek Harness 抽样被移出主线，LangGraph wiring 与框架外确定性 replay/verifier 成为实现路径，OpenAI Agents SDK 只做职责对照或条件运行。

## 1. 开始条件与影响评估

W13 周末原计划的 D6 是固定 LangChain chain、接口 review、失败诊断和生产约束的模块化延展，不是 W14 的硬依赖。D5 的认知重建占用了原定 D6 学习窗口，因此 D6 的 M1 深化、M3/M4 诊断、M5 编排和 M6 生产映射没有全部形成学习证据；这不会把 W14 改成继续无边界深入 RAG。D5 已完成 LangChain `Document`、BM25 retriever、dense `Embeddings` adapter 与 `InMemoryVectorStore` 的接线；当前最低接口是“LangChain retrieval + 项目生成客户端”的固定 RAG 链路，具备可复核的 BM25 端到端证据、冻结题集、citation/abstention 记录和失败分层证据。生成仍使用现有 HTTP client，未接入 ChatModel/LCEL。

D5 的排障包含 fixture identity 修复，以及对浮点近似并列、source span 与 block 边界、schema/语义分层等现象的记录。历史 `rules-c0a4b85` / `w13-eval-v1` 实验中的 paraphrase 检索缺口、citation 与 evidence coverage 的关系、dense `schema_error` 的跨运行稳定性等根因尚未隔离；这些观察不作为当前 technical-v2 能力分数。本人掌握所需的合理变更或故障诊断也尚未完成。W13 的完整质量验收仍未通过，W14 不把 LangGraph 当作 RAG 质量修复方案。

因此 W14 可以开启。D6 未完成项压缩为 W14 D1 的一个有界恢复输入：完成评测合取与失败定位的第一档确定性重建，复述固定 RAG 的成功/失败边界，然后冻结一个非 Agent baseline 和 Agent 控制契约；D1 未完成契约或 baseline 时，停止在当前阶段，不启动 LangGraph wiring。

## 2. 目标能力与端到端最小行为

**目标能力**：能够判断一个任务是否需要 Tool + Single-Agent Harness；在固定 RAG 已能完成的范围内保持来源、上下文、引用和拒答契约，并用 LangGraph 实现可解释的只读工具调用、状态转移、终止和 trace/verifier。

**最小行为**：对当前 `technical-v2` 的模型适用 dev slice（`w13-v2-dev-04`、`07`、`08`、`09`），先运行固定 workflow：

```text
query → LangChain retrieval → Evidence Context → generation/parser → citation 或 abstention
```

再运行最小 LangGraph workflow：

```text
state → retrieve node → generate node → verify node
                         ↘ conditional edge: answer / abstain / stop
```

只有当固定 baseline 的明确失败可以由动态检索、工具选择或终止决策解释并验证时，才支持“该任务需要 Agent”的结论。单次运行成功不代表质量通过。

## 3. 迁移关系

| W13 已有能力 | W14 新增能力 | 迁移后的验证 |
|---|---|---|
| `Document`、retriever、source identity | 只读 retrieval tool contract | 工具输入输出保留 `source_id`、位置和 hash |
| Evidence Context、citation、abstention | state 与 conditional edge | state 记录检索、上下文、解析和终态；边条件可重放 |
| retrieval/context/generation/eval 分层 | trace 与 verifier | 每 trial 能定位层级，verifier 输出通过/拒绝及原因 |
| W12 Bub 的 turn、tape→context、预算边界 | Agent loop、终止/停滞/预算 | 只重建确定性控制，不把模型随机行为当作掌握证据 |

## 4. 周完成定义

在同一 dev slice、corpus、Prompt 和模型版本记录上，固定 workflow 与 LangGraph 只读 retrieval tool workflow 均可重复运行；state、node、edge、conditional edge、工具权限、终止/停滞/预算状态和 JSONL trace 有冻结契约；deterministic replay 与外部 verifier 能逐 trial 给出结果。本人能够讲清一次成功、一次工具失败或取消、一次停滞/预算终止路径，并完成一次合理修改或故障诊断。OpenAI Agents SDK 只作职责对照，不成为主链通过条件。

## 5. 每日主线与完成对象

### D1（9/14）：延迟重建、契约冻结与非 Agent baseline

- 先完成 `DEBT.md` 中 eval 合取判定与失败定位的第一档重建。
- 说明 W13 → W14 的迁移：固定 RAG 的输入输出如何成为 tool/state 的字段；复用当前 technical-v2 的模型适用 dev slice（`04`、`07`、`08`、`09`），只冻结只读工具权限、终止/停滞/预算判据、最小 trace 与 verifier 输入输出。
- 跑一次非 Agent baseline，记录 retrieval hits、context hash、response branch、citation/abstention 和 trace。
- **完成对象**：`w13-eval-debt-rebuild-01`、`w14-task-contract-v1`、`w14-fixed-baseline-run-01`、`w14-trace-verifier-contract-v1`。
- **自动顺延**：重建或契约未完成时不做 LangGraph wiring；不读取或运行受保护 holdout。D1 必须同时冻结 terminal-state enum 及其 verifier 关系；`answered`、`abstained`、`tool_error`、`cancelled`、`budget_exhausted`、`stagnated` 只是待本人确认的起始清单。

### D2（9/15）：LangGraph graph wiring 与固定 workflow 对照

- 在 D1 已冻结契约上接入 `StateGraph`、node、edge 和 conditional edge。
- 用同一输入对照固定 workflow 与图上的固定流程，分别记录框架运行状态和任务质量；这一步只证明映射一致，不证明任务需要 Agent。
- **完成对象**：state schema、节点输入输出表、固定流程 replay、一次成功与一次 abstain/失败记录。

### D3（9/16）：只读 retrieval tool、错误路径与终止

- 加入只读 retrieval tool 的参数校验、权限拒绝、空证据、超时/取消和结构错误路径。
- 通过受控的空证据、工具错误、取消和预算耗尽输入验证 answered、abstained、tool_error、cancelled、budget_exhausted、stagnated 等终态的来源和可重放性；具体枚举由本人 D1 冻结。受控注入只用于诊断控制层，不改 W13 语料或评测题。
- **完成对象**：最小工具 loop、终态矩阵、脱敏 JSONL trace、deterministic verifier，以及一条说明固定 baseline 失败是否真的需要动态控制的诊断记录。

### D4（9/17）：session state、Prompt 单变量与多 trial

- 做有界 session state 的 read/write/reset/isolation 实验，观察一次 context compaction 或 eviction；不新增持久化或向量 memory 服务。
- 对同一冻结 dev slice 只改变一个 Prompt 因素，记录前后 eval 和失败归因；不以主观感觉替代判据。
- **完成对象**：多 trial trace/replay、state reset/isolation 证据、单变量对照及未证明边界。Prompt 单变量、baseline、指标、阈值、失败归因和顺延条件先由本人冻结；若不能形成可证伪对照，顺延该扩展。

### D5（9/18）：review、诊断、演练与 W15 交接

- 复核 LangGraph 主链的职责、数据流、错误归因和 trace；完成一次本人合理修改或故障诊断。
- 用 60–90 分钟做 OpenAI Agents SDK 的 loop/state/tool execution 职责对照；真实运行失败时保留错误证据，不阻塞 Python 主线。
- 完成 W14 demo 演练，记录时长、追问卡点、已证明与未证明边界，并写出 W15 MCP 入口。
- **完成对象**：周验收表、演练稿/证据索引、W14→W15 交接记录。

## 6. 范围、保护与砍项

- 不读取、输出或修改受保护 holdout，不用 holdout 反馈调 Prompt、retrieval、阈值或工具契约。
- 不把 W13 dense 未通过、旧 rules 实验或单次 `status=ok` 改写为质量通过；不重做整套 W13 评测。
- 不实现 MCP、生产向量数据库、UI、durable memory 服务或通用 Agent 框架。
- 时间不足时依次砍：OpenAI Agents SDK 真实运行、额外 context 实验、本地量化模型；保留非 Agent baseline、LangGraph 主链、trace/verifier、多 trial 和 session reset/isolation。

## 7. 证据与收口

每天记录目标、操作、观察、结论和边界。W14 的“运行链路可重放”“任务质量”“本人掌握”分开判定；机器测试、框架 wiring 或展板材料不能替代本人复述、变更预测和故障诊断。若一项完成对象未满足，记录实际去向并把下一入口压缩为一条可执行动作。

主要输入：[W13→D6 对接](../../week13-rag/notes/day6-d5-facts-and-d6-bridge.md)、[W13 状态](../../LEARNING-STATE.md)、[五周计划 W14](../../plan/ai-engineer-reskill-5-week-plan.md)。
