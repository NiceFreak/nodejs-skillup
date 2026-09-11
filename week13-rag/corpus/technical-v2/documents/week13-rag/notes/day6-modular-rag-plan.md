# W13 D6：固定 RAG 链路与生产约束的模块化实践

> 日期：2026-09-12–2026-09-13。D6 是 W13 D5 之后的周末延伸，不改变 W13 已冻结的 corpus、eval、Prompt、schema 或 holdout 边界。
> 本计划按模块执行，可以在任意模块结束；未完成模块保留为未完成，不用剩余时间补齐叙事。

## 1. 目标与当前起点

目标是把已经能运行的确定性 RAG 数据流，逐步映射到 LangChain 的固定链路和 LangGraph 的状态编排，并说明从教学实验走向生产环境还需要哪些约束。

当前起点：

- 已有 7 份冻结规则文档、572 个带来源位置的 source blocks，以及可重算的 parser、registry、retrieval、context assembly 和评估入口。
- LangChain 已承接 `Document`、BM25 retriever，以及 dense 的 `Embeddings` adapter 和 `InMemoryVectorStore`；生成仍复用现有模型客户端，没有接入 ChatModel/LCEL。
- BM25、dense 的端到端运行只证明链路可以重复执行，不代表回答质量通过。BM25/dense 的人工语义判定各为 3/10；retrieval-only 与 holdout 均未通过。
- LangGraph、agent loop、UI、向量数据库和生产部署不属于 D6 必做范围。

## 2. 不改变的边界

- 不读取、输出或修改 `week13-rag/eval/holdout/` 的题面、答案或派生内容。
- 不用 holdout 选择参数、修改阈值或反向调 Prompt。
- 不把 `status=ok`、citation 可解析、链路可运行或输入变小写成质量通过。
- 不把 LangChain 接口映射写成完整 LangChain Runnable/LCEL 经验；不把 LangGraph 设计写成已实施能力。
- 不新增 UI、向量数据库、复杂 agent loop、外部工具权限或持续部署流程。
- 所有新增实验使用独立分支、独立证据文件或明确的实验标记，不覆盖冻结结果。

## 3. 模块清单

| 模块 | 完成对象 | 依赖 | 最小完成证据 | 自动止步条件 |
|---|---|---|---|---|
| M0 状态与演示复核 | 可恢复的 D6 起点 | 无 | 运行 `summary`、`verify`；复述当前实现和质量边界 | 发现输入 hash、脚本或展板状态不一致时停止扩展，先记录差异 |
| M1 固定 LangChain chain | `Document → retriever → prompt → model → parsed result` 的最小固定链 | M0；本人确认输出字段和失败分支 | 1 个成功案例、1 个拒答或失败案例；记录 query、命中证据、实际 context、answer、citation/status | 模型客户端或依赖无法运行时，保留 retrieval/context 证据，不称端到端完成 |
| M2 LangChain 接口 review | 框架组件与项目契约的逐项映射 | M1 | 能说明 `page_content`、metadata、retriever、prompt、parser 各自输入输出；指出 source ID、hash、排序规则由谁负责 | 发现框架默认行为会改变冻结身份、排序或评估语义时，不继续接线，先冻结取舍 |
| M3 Dev 质量诊断 | 对当前失败进行分层归因 | M0 | 从 dev 失败样本中选最多一个假设，区分 retrieval、context、prompt、generation、schema；写出验证方法 | 需要改 eval、读取 holdout 或同时改多个变量时停止 |
| M4 单变量实验 | 一个可回滚的 dev-only 改动 | M3；本人确认变量和预期 | 保留旧结果，运行同一 dev 题集，比较命中、机械检查、人工语义和输入变化 | 没有清晰判据、改动影响多个层或结果不能解释时不实施 |
| M5 LangGraph 最小 workflow | 固定 state、node、edge、conditional edge 的只读编排 | M1；本人确认 state 字段和停止条件 | 一个不带外部工具的 `retrieve → generate → verify/abstain` 流程图或最小运行记录 | 需要 agent loop、checkpoint、重试策略或新权限时顺延到 W14 |
| M6 生产约束映射 | 从实验链路到生产系统的风险清单 | M1–M3 任一完成即可 | 逐项说明 corpus 更新、身份/hash、评估回归、超时/重试、成本/延迟、日志和权限的缺口 | 只能写抽象口号、没有对应当前链路对象时停止 |
| M7 汇报材料复核 | 可操作的 demo 顺序和展板边界 | M0；可与 M1 并行 | 计时演练、备用命令、成功/拒答/错误拒答各一条说明；展板状态与证据一致 | 页面不可用时切终端回放，不在汇报前临时改实验输入 |

## 4. 推荐执行顺序

### 4.1 起步模块：M0 + M7

1. 从仓库根执行：

   ```bash
   python3 -B week13-rag/scripts/demo-replay.py summary
   week13-rag/.venv/bin/python -B week13-rag/scripts/demo-replay.py verify
   ```

2. 按 [D5 demo 讲稿](./day5-demo-script.md) 走一遍六页展板，确认默认态先显示对象、关系、结论和必要边界。
3. 记录实际主讲时长、卡点和页面操作问题；机器检查通过不替代本人复述。

当前展板的 `yarn rehearse:rag --check` 已通过 48 种桌面/移动端、明暗主题和展开状态，包含键盘 citation、静态回放、错误路径与本地重算；移动端主视觉锚点位于首屏下方，仍需本人实际打开手机视口确认是否能先读到主结论。该人工检查未完成前，不把机器通过写成完整视觉验收。

### 4.2 框架模块：M1 + M2

固定 chain 的输入仍使用现有冻结 registry 和 dev query。最小链路必须能观察：

```text
query
  → Document / retriever 命中
  → 实际进入模型的 context
  → prompt 与模型请求
  → parsed answer / citation / abstention
```

M1 的目标是理解和验证职责交接，不是新增一个生产服务。若现有脚本已经满足某一段，记录“复用并验证”；只有缺失段才新增最小实现。

### 4.3 诊断模块：M3 + M4

- 只使用 dev 结果，按失败阶段逐题归类。
- 选择一个最有证据支持的假设，例如检索候选不足、context 组织不完整或结构约束与语义目标不一致；根因未证实时继续写“待验证”。
- 一次只改一个变量，保留原 evidence、版本和比较结果。
- 若实验没有改善或无法解释，结论仍然有价值：记录该假设未被当前实验支持，不继续堆叠优化。

### 4.4 编排模块：M5

M5 只建立确定性 workflow 的结构理解：

```text
State(question, retrieved_context, answer, citations, status)
  → retrieve node
  → generate node
  → verify node
  → conditional edge：answer 或 abstain
```

节点是否重试、是否再次检索、是否写入 checkpoint、何时交还人工，都必须先由本人定义；D6 不默认加入这些行为。

### 4.5 生产映射模块：M6

将当前实验对象逐项映射到生产问题：

- corpus 如何版本化、更新和失效；
- source ID、原始位置和 hash 如何保持稳定；
- retrieval、grounding、citation、abstention 如何分别评估；
- 模型超时、结构错误和瞬时错误如何记录；
- token、延迟和成本如何观测；
- 哪些数据可以进入日志，哪些操作需要人工审批。

这部分只形成风险与验证问题，不把未实现的能力写成已有实现。

## 5. 可暂停的完成定义

D6 不要求 M0–M7 全部完成。每个模块完成时记录四项：

1. 实际操作和输入版本；
2. 可复核的输出或运行证据；
3. 当前结论及不能推出的结论；
4. 下一模块、顺延原因或停止条件。

建议的优先级是 `M0 → M7 → M1 → M2 → M3 → M5 → M4 → M6`。如果时间有限，完成 M0、M7、M1 中的最小闭环即可；如果模型或依赖阻断，完成 M0、M2、M3 和 M5 的解释与设计记录即可。

## 6. D6 收口记录

| 模块 | 状态 | 证据 | 未完成原因 / 下一入口 |
|---|---|---|---|
| M0 | 待执行 |  |  |
| M1 | 待执行 |  |  |
| M2 | 待执行 |  |  |
| M3 | 待执行 |  |  |
| M4 | 待执行 |  |  |
| M5 | 待执行 |  |  |
| M6 | 待执行 |  |  |
| M7 | 待执行 |  |  |

D6 的模块完成不等于 W13 质量门禁通过，也不自动启动 W14。状态文件只在实际模块完成、出现新阻断或周末收口时更新。
