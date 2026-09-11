# W13 D5：学习进度与分享素材审核

> 审核日期：2026-09-11（Asia/Shanghai）。任务：在编写 D5 计划与 15 分钟内分享讲稿前，核实 W13 的实际进度，
> 订正会影响讲解的事实与证据边界。协作模式：独立 review 后按已发生事实订正文档。
> 本文不重新判分、不改变冻结契约，不以 AI 文档交付代替本人掌握验收。

## 1. 审核范围与依据

- 规则：根 `AGENTS.md`、`LEARNING-PROTOCOL.md`、`LEARNING-STATE.md`、`TECHNICAL-WRITING-PROTOCOL.md`，
  根 README 的 W13 入口和 `week13-plan.md`。
- 学习记录：D1–D4 每日笔记的状态、设计与收口，四天英文日报与三篇口语稿，serialization 确认清单、review
  worksheet、A1–A8 证据与 worked example，以及 BM25/dense 冻结记录、dev 人工判定 worksheet、原展板素材草稿。
- 行为与证据：`src/w13rag/` 的 serialization、retrieval、generation、scoring 职责；明确的 dev baseline、
  BM25 端到端与 retrieval-only JSON；冻结 `scoring-contract.md` 与 R1 口径。
- 保护范围：未读取 holdout 题面、答案、响应证据或含其内容的 worksheet。首次运行的总体状态仅引用既有非题面
  汇总记录，不声称独立重判 holdout。未调用外部生成模型、未提交或部署。

## 2. 阻断性记录问题与最小订正

以下问题会使分享建立在错误状态、数字或技术结论上，因此在使用素材前订正。位置使用小节锚点，避免订正后行号漂移。

| 位置 | 原说法 | 证据与问题 | 订正 |
|---|---|---|---|
| 根状态、周计划、D4 文件头与 §6.22 | baseline 未开工或停在机械 7/10，BM25 未开始 | D4 §6.14–§6.21 已记录后续运行、本人判定与计划变更；旧入口会把已完成阶段重新排入 D5 | 当前入口统一为已完成实现和实验、质量未通过；区分 full-context 人工判定已收口与 BM25 端到端人工语义待补 |
| D4 §6.18–§6.19、周计划证据清单 | 四类 backend、12 个检索配置/12 份证据 | 表格只有 BM25、dense、hybrid 三类，分别 k=10/20/30；retrieval 目录实际 10 份 JSON，其中 1 份是 BM25 缺陷版本 | 有效对照为 9 配置；保留缺陷版本后共 10 文件；full-context 不计入 retrieval-only 配置 |
| D4 §6.21 与各级摘要 | BM25 context 1,332–1,654 字符；full-context 列的 8/10 对应三个旧失败项 | `dev-bm25-e2e-top10-01.json` 的 context 实际为 1,332–2,020 字符；同配置 full-context v1 + JSON 的失败为 paraphrase-02 与 priority-conflict-exception-01 | 更正范围与失败项；完整 provider 输入比较为 full-context 44,704–44,725 tokens、BM25 1,131–1,535 tokens |
| D4 §6.21 | 输入缩小且“引用更精确”的直接证据 | `scoring.py` 的机械 `citation_precision` 只计算 identifier 可解析比例；契约 §5 的完整指标还要求 citation 支持 claim | 只宣称输入缩小、该轮返回的 identifiers 全部可解析；人工支持关系未补齐，不能宣称质量提升或账单节省 |
| D4 §6.14、§6.19 | 六条失败归为引用五条/拒答一条，并暗示没有其它语义错误 | dev worksheet 明确记录 cross-document-02 的 claim 7 不支持；问题维度可以重叠 | 标为非互斥观察：五条含引用/覆盖问题，其中一条还含 claim 内容错误；另有一条错误拒答 |
| D4 §6.16 | 不可能靠 top_k 达标；取 162/572 个块就失去检索意义 | 只测了 k=10/20/30；某 requirement 最好排名 162 不能证明更大 k 永远不达标，也未测该规模的成本与质量 | 写成已测 k 范围未过；更大 k 的收益与成本未验证，本轮按范围止步 |
| D4 §6.17–§6.19 | dense 与 BM25 失败都归因为词汇鸿沟；paraphrase 失败是预期结果 | 契约 §4 要求跨措辞仍正确回答；dense 失败只证明本配置排序不足，没有隔离模型、文本表示、标题重复等因素 | BM25 的词面匹配限制是机制说明；dense 具体根因仍待验证；共同失败不证明实现无缺陷 |
| D4 §6.18 | query expansion / reranker 必须引入人工语义映射，效果无法归因 | 两者不必依赖手工同义词映射，也可以通过冻结的新对照评估；本轮没有做该实验 | 保留“本轮未冻结、未实施，按扩展项止步”的范围决定，删除普遍机制断言 |
| D4 §6.13–§6.14 | JSON mode 对应 LangChain ProviderStrategy，单轮清零验证了稳定效果 | 当前发送的是 `json_object`，由本地 JSON Schema 再验证；未用 LangChain schema strategy。单轮结果不能隔离模型运行间波动 | 区分 JSON 语法约束、schema 验证与 claim 支持；记录该轮格式失败为 0，不承诺以后都遵守 |
| D1/D3 笔记状态与下一入口、D4 英文日报 | 标为当前的待办与同文件后续记录冲突；日报 22:20 快照容易当作日终结果 | D1 token 已计量，D3 parser 当日已实现；D4 22:20 之后还有真实运行与判定 | 保留历史快照日期，补充后续结果与当前入口；不把后续成果写成早先已完成 |
| D2 英文日报 | 预期拒答却作答“invalidates that split” | 契约 §3 是 split 失败；§7 运行无效是另一状态 | 改为直接使 split 失败，保持失败与运行无效的区别 |

另外订正 D3 的子规则数量：列出的 EOL、行尾空白、空行、行首缩进、span 拼接、fenced code、blockquote
共 7 项；原“8 项”是计数错误，规则内容未变。D1 英文日报将 answer/abstention 与 citation 的关联写清，避免
读成 abstained 分支也返回 citation；`src/w13rag/README.md` 明确只导读 serialization 六模块，不再暗示这是全包。

serialization 辅助材料还订正了三处验证表达：worksheet 将 `8a02c665…` 标清为 Evidence Context 整串 SHA；
手工重算必须包含 `context_spans` 与规范化，不能只拼核心 span；worked example 的行数公式只适用于本例，
一般情况还受表头与空行折叠影响。A6 的表头开销已计入完整输入总量，但没有单独测量边际增量，不能将
44,247 / 18,697 的总差额归为表头贡献。原“支持 lazy continuation 会导致错误”也改为需按新增语义验证的边界。

直接复核入口：

- [full-context v1 + JSON 原始 dev 证据](../evidence/baseline/dev-full-context-prompt-v1-json-output-01.json)：
  `summary.mechanical.failed_items` 与 `items[].record.usage.prompt_tokens`。
- [BM25 端到端原始 dev 证据](../evidence/bm25-e2e/dev-bm25-e2e-top10-01.json)：
  `items[].context.chars`、`items[].record.usage.prompt_tokens`、`summary.mechanical.failed_items`。
- [retrieval 汇总代码](../scripts/run-retrieval-eval.py)：`summarize()` 对适用题和诊断 coverage 分别聚合。
- [dev 人工判定记录](./dev-semantic-checklist-worksheet.md) §11：8 条人工语义结论、2 条机械失败，最终 4/10。
- [LangChain structured output 官方文档](https://docs.langchain.com/oss/python/langchain/structured-output)
  （复核 2026-09-11）：`ProviderStrategy` 接收 schema，`ToolStrategy.handle_errors` 控制该策略的错误处理。

补充口径：`coverage_mean` 是 runner 对所有非空 coverage 的平均，包含 no-answer 的 advisory source span；
它不是 8 条适用题的完整内容召回率。retrieval-only 通过数的分母为 8，generation 判定的分母为 10，不能直接
把 7/8 与 4/10 作为同一质量指标比较。

## 3. 实际进度与可讲范围

| 对象 | 当前可核实的完成事实 | 验收边界 |
|---|---|---|
| 语料与确定性输入 | 7 文档；572 source blocks；完整 Evidence Context 89,854 字符；冻结整串 SHA；A1–A8 本人签认与破坏性验证有记录 | 证明输入可复现，不能单独证明 chunk 语义最优 |
| full-context baseline | v1 + JSON 运行机械 8/10；本人判定收口后 4/10；Prompt v2 实验未消除目标问题，默认回到 v1 | 未达到质量阈值；R1 在该次 dev 运行后澄清，4/10 按诊断结论讲解 |
| BM25 / dense / hybrid | 同一 dev 的 9 配置已运行；通过数分别 5–7/8、3–5/8、4–7/8 | retrieval-only 门禁均未通过；不宣称 dense 或 RRF 普遍劣于 BM25 |
| BM25 端到端 | 10 条真实调用，机械 8/10；可展示 query → retrieval → context → response → citation/abstention | 本人授权作链路演示证据，非质量验收；人工语义判定仍待补 |
| LangChain 实践 | 使用 `Document` 与 `BM25Retriever` 组装索引，显式排序满足 tie-break；其余冻结契约与客户端保留本地实现 | 不是完整的 LangChain Runnable / structured-output / vector-store 链；dense 为 ONNX/NumPy 路径 |
| LangGraph | 已有运行事实、评估结果、判定职责可供后续迁移 | 未实现 LangGraph workflow；重试、状态持久化、工具决策属于 W14 后续实践 |
| 首次 holdout | 既有汇总记录为机械 8/10、质量门禁未通过 | 未读取受保护素材；人工语义补判、历史可见性边界继续有效 |
| 本人掌握与演练 | serialization review 与一次合理修改/故障验证有记录 | 完整 RAG 成功/失败路径复述、变更影响预测、15 分钟演练与延迟重建不能由文档完成代签 |

> **2026-09-11 补记（D5 当日）**：上表两条已变化——① 「BM25 端到端…人工语义判定仍待补」已在 D5 完成：
> 按 R1 口径通过 3/10，仍不通过（[判定素材](./dev-semantic-checklist-bm25-e2e.md)）；dense 端到端同日另有一轮链路运行，
> 人工语义判定亦完成（3/10，[判定素材](./dev-semantic-checklist-dense-e2e.md)）。
> ② 「dense 为 ONNX/NumPy 路径」已过期：dense 的 embedding 与向量存储已接 LangChain（`E5Embeddings` + `InMemoryVectorStore`），
> 排序仍由项目显式完成。记录见 [dense-langchain-wiring-freeze.md](./dense-langchain-wiring-freeze.md)。

适合 demo 的主线：先展示可运行的 RAG 问答链，再用可定位来源解释检索和上下文的区别；随后比较输入规模与
三类检索结果，最后连接到 LangChain 已用接口和 LangGraph 下一阶段职责。失败案例用于说明经验与边界，不扩展为
事故复盘主场。已有 dev 证据可回放，必须清楚标为记录输出；没有本次模型调用时不能称为现场生成。

## 4. 锦上添花与收口

- 当前没有必须顺手实施的架构优化。持久化 vector store、reranker、query expansion、额外 Prompt trials 和
  LangGraph 接线均需要后续需求或已冻结的新实验，不作为本轮记录修复。
- 冻结记录的原决定保持不变；历史解释如需澄清，以本次审计说明或带日期注释补充，不改写 corpus、eval 或旧 JSON。
- 复核：直接从两份 dev JSON 重算 context 范围、provider 输入总数和失败 ID；清点 retrieval JSON 为 10 份、
  有效配置 9 个；订正的 12 份文档本地链接检查通过，`git diff --check` 通过。英文日报正文分别为 D1 491、
  D2 446、D4 500 词；D4 的后续结果注释位于原证据截止时间之后，不混入 22:20 的历史完成声明。
- 同轮工程复核：当前既有 W13 tests **71 passed**，fresh/on-disk/frozen 三一致；与 D4 阶段 5 历史记录的
  70 passed 分开记录。复核没有运行新的 generation，也没有用测试数量证明质量或掌握。
- **无阻断性记录问题，可以验收本轮订正后的学习记录。** 如果现在验收文档，会不会因剩余问题不通过：
  **不会**；发现的错误已订正，当前未完成实践和质量失败均保留。**这不等于 W13 质量门禁通过，也不等于本人已完成演练。**

## 5. 新增代码导读 review（2026-09-11）

用户随后要求把现有代码解读补到当前 RAG 全链路，并在展板解释实现理由。本轮先核对所有 `src/w13rag/` 模块及
明确的 dev runner，再建立 [RAG 代码导读](./rag-implementation-guide.md)；原 serialization 导读保留为细节页并双向导航。

| 对象 | 发现与依据 | 分类与处理 |
|---|---|---|
| 旧 `src/w13rag/README.md` | 只解释输入处理六模块，缺少当前 retrieval/generation/scoring 与 runner 的完整数据流 | 文档范围补齐；新增按实际职责组织的导读，不重写输入层细节 |
| `retrieval_hybrid.py` 模块注释 | 原称 cosine 恒在 0–1、任一 ranker miss 就无法融合；代码实际对两个候选列表取并集 | 文案订正：cosine 一般为 [-1,1]；两个池均未含才无法加入，RRF 逻辑不变 |
| `generation.py` 状态注释 | 原写五类失败，实际为 `ok` 加六类错误 | 仅订正数量，不改状态或异常处理 |
| `run-dev-baseline.py` 说明 | 原称语义 pending 必然导致 incomplete；`summarize()` 实际会优先判定已足以否决 split 的失败 | 订正 docstring 与以后运行的说明字符串；不改判定逻辑，不回写旧 JSON |
| B3 与 `build_retrieval_context()` | 冻结记录描述超预算裁剪，当前函数只按 hits 拼接，没有计量或裁剪分支 | **现存实现限制**：导读明确尚未实现，未新开裁剪任务，也不因当前输入较小而宣称该能力已验收 |
| dense cache identity | 包含模型/tokenizer/长度/pooling/归一化/块数/batch，不含 corpus 内容 hash 或 entry 顺序 | **现存实现限制**：当前依赖冻结语料保持不变；同块数换内容的缓存有效性没有保障 |
| `evaluate_item()` 与展示回放 | scorer 接收 registry IDs，不独立接收 actual context；回放 verify 重算顺序/hash/chars，source 模式核对首条 citation | **现存实现限制**：不把 registry 可解析率、回放检查写成全部 citation 的 context membership 或语义支持验证 |

以上限制不通过文档修改伪装为已实现，也不在未冻结新需求时顺手改核心行为。六层展示依据已交给展板实现方：
读取与块边界 → 来源与正文 → 检索候选 → 实际 context → 单次生成 → 分维度评估与证据；dense/RRF 只连接已运行
的 retrieval-only 对照，不画成已完成 generation 或 LangGraph。

## 6. RAG 学习目标纠偏与后续范围（2026-09-11）

### 6.1 原判断与实际问题

W13 初始方案把七份规则文档作为小型、可控的 RAG 语料，并围绕规则问答建立固定 eval。语料规模较小有利于
控制输入、版本和证据，但“文件数量少”不能代替“任务具有代表性”。这组语料可以检验规则文档检索、跨文档
约束、引用定位和证据不足边界，不能单独验证技术资料检索工具或可嵌入状态化 agent 的可用性。

当前 BM25、dense、hybrid 的 retrieval-only 配置均未通过既定门禁，full-context 的人工语义结果也未达到阈值。
这证明当前题集与门禁没有达到预期验收结果；不能据此断言 RAG 机制本身不可用。现有题集同时承担规则问答、
确定性序列化、检索对照、生成与引用检查等不同目的，题目、语料和评测层之间的目标不完全一致。

### 6.2 RAG 与 agent harness 的重新定位

RAG 的核心链路是：用户问题 → 外部语料检索 → context assembly → 模型基于 context 生成回答 → 引用支持或
证据不足时拒答。RAG 可以作为固定链路、内部技术资料检索工具或 agent 的一个检索工具，不等同于完整 agent。

LangChain 负责 `Document`、文本切分、embedding、vector store、retriever、prompt 和模型接线等固定链路组件；
LangGraph 负责在需要状态、条件路由、循环、重试、终止、持久化和 trace 时编排这些步骤。LangGraph 的 `StateGraph`
以用户定义的 `State` 为参数，添加 nodes 与 edges 后编译；官方资料查看时点为 2026-09-11：
[`Document` 与知识库流程](https://docs.langchain.com/oss/python/langchain/knowledge-base)、
[`retriever` 接口](https://docs.langchain.com/oss/python/integrations/retrievers)、
[`StateGraph` 与 graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)。

后续目标调整为建立一个**可解释、可诊断、能嵌入 agent harness 的 LangChain RAG 最小垂直切片**。该切片应能
展示固定 RAG 数据流，并保留 query、检索结果、实际 context、生成结果、引用或拒答、失败状态和可复核 trace。
它可以先作为固定 LangChain 链运行，再在状态和编排复杂度确实增加时接入 LangGraph；两种完成边界分别记录。

### 6.3 对本轮四点确认的 review

| 重新确认的内容 | review 结论 | 需要保留的边界 |
|---|---|---|
| 目标是可接入 agent harness，或作为内部资料检索工具/独立 RAG agent | 方向正确；RAG 负责有来源的资料访问与回答，agent harness 负责调用决策和运行控制 | “可用”必须由检索、grounding、拒答、可观测性和失败处理证据定义，不能由一次 demo 或 `status=ok` 定义 |
| 评测同时覆盖框架知识和实现诊断 | 方向可行，但两者应拆成独立层：框架知识题验证资料问答，实现诊断验证确定性链路 | 不用同一条模型答案同时证明框架理解和程序实现正确 |
| 资料检索工具需要真实可用 | 方向正确；语料应改为与目标技术任务相符、带版本和来源信息的文档集合 | 仍遵守“小而有代表性”的原则；不按文件数量扩充，不用合成内容伪造覆盖 |
| 先实现 LangChain，复杂编排再引入 LangGraph | 技术顺序合理：先固定链路，再增加状态、条件路由、重试和终止 | LangChain 固定链路完成不等于 LangGraph harness 完成；后者必须单独记录 state、transition、stop condition 和 trace |

“各占一半”在执行上解释为两条并行验收线：一条验证框架和资料问答能力，另一条验证实现的数据流和故障诊断。
它不是把两个目标混写进同一题，也不是用框架知识题替代实现测试。

### 6.4 评测与语料的大修建议

现有 `w13-eval-v1`、rules corpus、Prompt、旧 evidence 和首次 holdout 结果保留为历史实验，不回写为新目标的
通过证据。当前 v2 candidate 也只作为纠偏过渡，不继续在原规则题上堆叠更多修补。

新评测应按 RAG 数据流拆开：

1. Document 与 source identity：正文、metadata、来源定位和 chunk 身份是否保持一致。
2. Retrieval：相关性、paraphrase、top-k 召回和多来源证据是否能找到。
3. Context assembly：检索结果是否实际进入 context，裁剪、排序和重复处理是否可复核。
4. Grounding 与 citation：claim 是否被 context 中的具体来源支持，citation identifier 是否与 claim 对应。
5. Abstention 与 agent control：证据不足时是否拒答；需要重试、改写查询或停止时，状态和终止条件是否明确。

每题只承担一个主要设计点。retrieval recall、context membership、claim support、abstention accuracy、schema
错误和 agent trace 分别记录，不能先合并成一个 item pass rate 再猜根因。只有在人能够指出最小充分证据时，
候选题才进入新版本。

### 6.5 当前结论与下一入口

本轮纠偏不把原计划描述为错误的“文件少”原则，而是补足其适用条件：语料应小而任务代表，题目应服务于明确的
RAG 能力层，评测应区分固定链路、模型回答和 agent 控制。当前 W13 的可保留成果是版本化 corpus/serialization、
BM25 与 dense 的可重复对照、LangChain `Document`/retriever/vector store 接线，以及失败分层记录；它们证明了
确定性机制和排障入口，不能单独证明可用 RAG agent。

下一入口是先设计新目标的 corpus 与候选自然语言题，不修改 `w13-eval-v1` 或 holdout；本人确认题意和最小证据后，
再建立新的 framework/technical corpus、v2 dev 题集和对应的分层验证。新 dev 通过前不运行 holdout；holdout 的
题意仍需在受保护边界内由本人确认。

## 6.6 v2 technical corpus 与候选 dev 实现状态（2026-09-12）

已建立 `technical-9c6e6549b991` 快照：显式 allowlist 的 7 份规范文件与 4 份 W13 技术学习笔记，排除评测、证据和
受保护目录；安全扫描拒绝疑似凭据、可定位路径和端点内容。两次序列化构建得到 1,502 个 block，context hash
为 `255d6705c702f7627abdcacb90f82bc6db4b11ab3e954c677a626dd5d2107192`，审计无未覆盖或重复核心行。

候选题库与抽样记录见 `eval/candidates/w13-v2-candidate-bank.md`；只读 selector 按固定种子抽取 A1/A2、B2/B4、C1/C3、
D3/D4、E1/E3，形成 10 题 `eval/v2-dev/items.json`。该文件保持 `contract_status=draft`，expected conclusion、
source block 与阈值仍待语义复核，不能当作已冻结 benchmark。

新增 `run-layered-diagnosis.py` 只执行 retrieval、context membership 和 context hash 检查，不调用模型且明确记录
`holdout=not_read`。当前 BM25 k=10 结果为 9 题失败、1 题 corpus-absence advisory；该结果首先暴露候选 query 与
最小 evidence span 尚未校准，属于排障输入，不是 RAG 质量结论。下一步应逐题核对 source block 与题意，再决定是否
把候选转为 v2 dev；模型调用与 holdout 继续后置。

## 6.7 自动推进目标（2026-09-12）

本阶段后续按“目标是否实现”收口，不按自然日切分学习日。自动推进链路定义为：候选题与 source block 校准 →
v2 dev 机械 contract → BM25、dense、RRF retrieval-only → context assembly → 可用时再运行端到端生成 → 分层
诊断与单变量修正 → dev 稳定后生成 holdout 候选题库。每次修正必须保留前一轮证据，并只改变一个可说明的变量。

当前目标可实现，但“BM25、dense、RRF 通过”不是单纯调参目标：若题意、最小证据或语料代表性不相容，应先修正候选题；
若模型凭据或依赖不可用，只能完成确定性 retrieval/context 阶段，不能伪称端到端通过。holdout 候选只能在 dev 稳定后
生成，题面、答案与最终选择仍由本人 review；普通对话继续不读取受保护 holdout。

## 6.8 technical-v2 首轮三后端诊断（2026-09-12）

目标：在不改变候选题意、阈值或旧 v1 资产的前提下，核对 technical snapshot 的 parser/source identity，并补齐
LangChain dense 与 RRF 的 retrieval-only 证据。

操作与事实：

- `w13rag.cli verify` 对 `technical-9c6e6549b991` 重新构建 1,502 个 block；fresh 与 on-disk Evidence Context
  的字符数均为 369,333，SHA 均为 `255d6705c702f7627abdcacb90f82bc6db4b11ab3e954c677a626dd5d2107192`。
  未发现未覆盖核心行或重复 block。
- v2 schema 使用 Draft 2020-12 validator 通过；10 个 item 的 `schema_version=2`、`eval_version`、snapshot ID、
  split 和行为类型均符合草稿 schema。`contract_status` 仍为 `draft`。
- 使用 technical registry 生成 dense cache（1502×384，模型/tokenizer identity 一致）；cache 写在 `/tmp`，不作为
  新冻结输入。`build_dense_store()` 通过 LangChain `InMemoryVectorStore` 装载，查询侧经 `E5Embeddings` adapter。
- 新增 `scripts/run-technical-v2-retrieval.py`，分别运行 BM25、dense、RRF，逐题记录 target block rank、top-k
  context 成员、context 字符数与 SHA、重复成员、rank 顺序和模型未调用状态。三后端都得到 4 个适用题 0/4，另 6
  个 diagnostic fixture 或 corpus absence 题在 retrieval-only 层不适用；三轮失败项均为 `03`、`04`、`07`、`08`。
- dense 重复运行一次，10/10 的 context SHA 与 target rank 完全一致。BM25、dense、RRF 的输出分别保存在
  `evidence/technical/technical-v2/retrieval-{bm25-k10-rerun,dense-k10,rrf-k10}.json`；registry 与 manifest
  SHA 检查通过，所有 hit source ID 唯一且都能解析到 technical registry。

失败与根因假设：4 个 source-span 题的目标 block 在 BM25 全量排序中的 rank 为 205、409、1,459、1,486 等，dense
与 RRF 也未进入 top-10。对应 block 多为带历史章节标题的学习笔记片段，题目询问的“如何诊断 / 如何处理”并不总由
所绑定的行直接表达。当前证据支持“候选题意、最小 evidence span 与 technical corpus 不相容或检索信号不足”这一
根因假设；不能把它统一归为 BM25、dense 或词汇鸿沟缺陷。6 个 fixture/absence 题没有 source span，不能用
retrieval-only 结果替代其 implementation observation 或 abstention 判据。

边界：没有可复现 `DEEPSEEK_API_KEY`，因此未运行 technical v2 端到端 generation；context 的 `budgetChars` 与
实际 model input 记录为 `null` / `not_run`，不声称 context budget 或 grounding 已通过。v2 仍未 stable，也没有
生成或运行 holdout candidate。

下一入口：先为 4 个失败 source-span 题各生成一个“题意—最小充分证据—候选 source block”的修订候选，并把
implementation observation / fixture 题单独列为机械链路验收；这些候选仍需本人确认 expected conclusion、最小证据、
abstention 边界和通过判据。确认前不把候选写入正式 dev，不修改旧 v1 或 holdout。

## 6.9 source-span 候选修订回放（2026-09-12）

针对 6.8 的题意/证据不相容假设，新增候选文件 `eval/candidates/technical-v2-revision-01.json`。本轮只改变候选
题目的自然语言、最小 source block 和待确认字段；没有改写 `eval/v2-dev/items.json`、阈值、Prompt、旧 evidence
或 holdout。

候选回放结果：4 个 source-span 候选在 BM25、LangChain dense 和 RRF 的 k=10 retrieval-only 运行中分别为 **4/4、
4/4、4/4**。每次运行都记录 source block rank、context 成员、context SHA、重复成员与 rank 顺序；registry/manifest
hash 和 source identity 检查通过。该结果说明把题目改成与单一充分证据一致后，三种排序可以稳定命中；它不能证明模型
生成、claim support 或 abstention 判据已经通过。

仍未解决的语义确认点：candidate-03 的 evidence recall 口径、candidate-04 的单一 source span 是否充分，以及
candidate-07/08 是否构成两个不重复的 citation resolution/正确性设计点。v2-dev 的 6 个 diagnostic fixture 或
corpus-absence 题还需要 implementation observation、schema/branch 分流和 abstention 边界的本人判据，不能由
retrieval-only 代替。由于当前环境没有可复现 API credential，technical v2 端到端 generation 未运行；因此本阶段
仍不能标记 dev stable，也不能生成正式 holdout candidate。

下一入口：由本人确认 candidate-03/04/07/08 的题意、最小证据和判据，并补齐 fixture 题的可观察对象；确认后再将
候选机械转换为新的 v2 dev draft，重复 BM25、dense、RRF、context/hash 与（凭据可用时）generation 分层检查。

## 6.10 diagnostic fixture observation（2026-09-12）

新增 `scripts/run-technical-v2-fixtures.py`，使用合成对象和 technical registry 记录 5 类确定性 observation：

- `document-identity-01`：`Document.page_content` 与 registry `model_content` 一致，`metadata.source_id` 与
  `metadata.content_sha256` 可回读。
- `document-identity-02`：正文相同的两个文档仍可保持不同 `source_id`；重复 source ID 会被唯一性守卫拒绝。
- `context-membership-01`：选定 hit 的 source ID 全部进入组装 context，context SHA 可重算。
- `context-budget-01`：当前实现记录输入长度和 retained/removed 列表，但 `clippingImplemented=false`，因此预算裁剪
  仍是实现缺口。
- `failure-routing-01`：格式错误落 `json_error`，schema 违规落 `schema_error`，合法 corpus-absence 拒答落 `ok`
  且 branch 为 `abstained`；这些是运行状态 observation，不是业务语义通过。

输出为 `evidence/technical/technical-v2/fixture-observations-01.json`，状态为 `observation_only`，明确
`semanticVerdict=pending_confirmation`、`modelInvocation=not_run`、`holdout=not_read`。因此它补齐了 fixture 层的
可复核输入，但没有把 v2-dev 的 6 个 fixture/absence 题静默判为通过。下一入口仍是本人确认 fixture 判据，并决定
是否把 context budget 裁剪列为当前切片必需能力或保留为已知限制。

## 6.11 候选题字段与安全校验（2026-09-12）

`technical-v2-revision-01.json` 已补齐每题的 `capability`、`candidate_criteria`、自然语言题意、候选结论、来源
block 和 `pending_confirmation`。校验结果：UTF-8 与 JSON 解析通过，4 题来源 ID 全部存在于 technical registry，
敏感模式扫描未命中，`git diff --check` 通过。文件仍标记为 `status=candidate`，这些判据没有进入正式 v2-dev 或
任何 holdout。

## 6.12 no-answer 题的明确缺失事实候选（2026-09-12）

`technical-v2-dev-candidate-01` 的 no-answer 题已把模糊的“没有支持所问具体事实”改为明确探针：是否规定使用
Qdrant 作为向量数据库并在更新时自动重建索引。对 technical-v2 allowlist snapshot 的只读搜索未发现 `Qdrant`、
“自动重建索引”或对应短语；该结果支持 corpus absence 候选，但不冻结 abstention reason code 或业务判据。

修改后重新把候选包转换为 retrieval 输入并复跑三后端：BM25、dense、RRF 均为 4/4 适用题通过，6 题继续按 fixture /
corpus-absence 不适用于 retrieval-only。该回放没有调用模型，也没有读取 holdout。下一入口仍需本人确认 no-answer
探针、fixture 判据和预算边界，之后才能建立正式 v2 dev。

## 6.13 technical-v2 完整候选包回放（2026-09-12）

新增 `eval/candidates/technical-v2-dev-candidate-01.json`，将 revision-01 的 4 个 source-span 题与原 v2-dev 的
6 个 diagnostic fixture / corpus-absence 题合并为一个 10 题候选包。候选包显式绑定 technical snapshot、fixture
observation 文件和待确认字段，顶层状态仍为 `candidate`，没有替换 `eval/v2-dev/items.json`。

将候选包机械转换为 retrieval 输入后，BM25、LangChain dense、RRF 在同一 technical snapshot、k=10 下均为 4/4
适用题通过；其余 6 题按 fixture 或 corpus-absence 设计不参与 retrieval-only。三份回放均检查 context 成员、
context SHA、source identity 和 manifest/registry hash。该结果只证明候选 source-span 与检索层相容，fixture 的语义
判定、预算裁剪能力、grounding/citation claim support 和 generation 仍未通过。

下一入口：本人确认 10 题的 expected branch、最小充分证据、candidate criteria 和预算边界后，才可把候选包转换为
正式 v2 dev；转换后需重新运行 schema/contract、三后端 retrieval、fixture/context 分层，并在凭据可用时运行固定
LangChain generation。确认前不运行 holdout、不调整旧阈值。

## 6.14 technical-v2 confirmed dev 分层回归（2026-09-12）

本人确认的 attachment 语义已落实到新的 v2 dev 契约：`contract_status=confirmed`，10 个 item 使用
`technical-9c6e6549b991`，没有修改 w13-eval-v1、旧 Prompt、旧阈值、旧 evidence 或 holdout。item-03 改为
`retrieval-diagnostics-01` fixture，item-06 固定 token 优先、字符 fallback、score/source_id/chunk_index 稳定排序、整块
保留或移除与预算审计，item-09 使用 Qdrant/自动重建索引 absence probe 和既有
`insufficient_corpus_evidence` reason code；schema 增加可选 `absence_probe` 并允许 confirmed 状态。

机械验证事实：Draft 2020-12 schema validator 通过；`verify-contract.mjs` 报告 dev 10/10、五类行为各 2 题；technical
snapshot 的 `w13rag.cli verify` fresh/on-disk 1,502 blocks 与 Evidence Context SHA
`255d6705c702f7627abdcacb90f82bc6db4b11ab3e954c677a626dd5d2107192` 一致；全量 pytest 为 84 passed。三后端
retrieval-only 在同一题集、snapshot、k=10 和判定口径下均通过 3/3 适用 source-span 题（04、07、08）；其余 7 题按
fixture/corpus-absence 分层，不把 N/A 当作 retrieval 通过。dense/RRF 输出包含缓存 identity，重复运行的 rank、context
成员和 SHA 可复现。

fixture observation 已补齐 7 类确定性记录：Document identity、retrieval diagnostics、context membership、token budget
审计、failure routing、corpus absence probe，以及无 API 时 `actualModelInput=not_run`。预算实现新增
`assemble_with_budget()` 和 3 个单元测试；预算裁剪保持整块并记录 retained/removed、单位、使用量和 context SHA，静默
截断字段为 false。fixture 输出仍标记 `observation_only`，不把 observation 自动升格为模型语义判定。

失败与边界：当前没有可复现 `DEEPSEEK_API_KEY` 和端到端模型依赖，因此未运行 generation；citation 的 claim support、真实
model input 和完整端到端 abstention 仍未验证。retrieval 3/3 只证明 source-span 与三种检索路径相容，不能声称 RAG
benchmark、学习阶段或 dev 全链路 stable。没有生成或运行 holdout。

下一入口：保留本轮 evidence 和 confirmed candidate，先完成一次完整的安全/路径/UTF-8/hash/parser coverage 检查并提交
本地 staged commit；不 push。待可复现模型凭据出现后，按同一 confirmed 题集运行固定 LangChain generation，再单独记录
模型层结果与剩余限制。只有 retrieval、context、citation、abstention 和重复运行证据齐全时才重新评估 dev stable。

## 6.15 technical-v2 fixed-chain generation 诊断（2026-09-12）

重新检查本地环境后，week12 `.env` 存在非空凭据，遂使用新建的 `run-technical-v2-langchain-e2e.py` 对 confirmed dev
题集执行一次固定链路：BM25 k=10 → shared context serializer → DeepSeek Chat Completions → v1 response schema
解析。运行未读取 holdout，也未改写历史 v1 evidence。

事实：10/10 请求返回 `status=ok`；实际 model input 的 context 成员、context SHA 和输入 hash 均写入
`evidence/technical/technical-v2/generation-langchain-k10-01.json`。机械层通过 5/10（04、05、07、08、09），未通过
的 5 题为 01、02、03、06、10。未通过项均为 confirmed diagnostic fixture 题：technical corpus context 不包含对应的
synthetic implementation observation，模型按 `insufficient_corpus_evidence` abstain，触发 expected branch mismatch。
这不是把 fixture 题改成 retrieval 失败的依据；它说明 fixture 证据与模型 context 的接线仍需单独决定。

04、07、08 的回答均可解析并进入 citation/claim-support 待人工复核；09 返回 corpus-absence abstention，reason code
为 `insufficient_corpus_evidence`，文本一致性仍需人工判定。当前 generation 运行证明了 transport、schema、context
hash 和分层状态记录链路可运行，不证明 10 题语义通过，也不证明 fixture 题应直接送入模型 context。

根因假设与边界：fixture 题的最小充分证据是合成 observation，独立于 technical snapshot source span；将其静默拼入
模型 prompt 会同时改变 context 输入变量，当前不自动采用。下一步应在不改 expected conclusion 的前提下，明确 fixture
题是否只走 deterministic harness，或冻结一个显式 fixture context adapter，再以单变量重跑；在该边界确认前不标记
technical v2 stable，不生成 holdout candidates。

## 6.16 fixture 与模型 generation 的边界修正（2026-09-12）

6.15 暴露了 fixture 题若直接送入 technical corpus context 会得到证据不足拒答。按 attachment 已确认的证据类型，
`run-technical-v2-langchain-e2e.py` 增加明确的 `fixture_only` 分支：01、02、03、05、06、10 只由 deterministic
fixture harness 观测，不调用模型；04、07、08、09 继续走固定 LangChain generation。旧的 6.15 全题运行证据保留，
新运行写入 `generation-langchain-k10-02.json`，没有修改 expected branch 或 Prompt。

新运行事实：4 个 model-applicable item 全部 `status=ok`，机械层 4/4，served model 字段均为 `deepseek-flash`；
4 个 fixture item 明确记录 `fixture_not_model_scored` 与 `actualModelInput=not_run`。04、07、08 的 claim support 与
09 的 reason-text consistency 仍是 pending，不能把 schema 通过或 citation 可解析当作语义通过。该运行完成了
transport、context、response schema、citation resolution 和 corpus-absence 分层记录，但没有形成 dev stable 判定。

根因与下一入口：fixture 证据和模型输入是两个不同层，当前证据支持 deterministic harness 独立验收；若要求模型回答
fixture 题，必须由本人另行确认并冻结显式 fixture context adapter，不能在 runner 中静默拼接。下一步是本人复核
`generation-langchain-k10-02.json` 的 04、07、08、09 语义结果；复核通过后再重复一次固定链路并评估 stable 条件，
仍不读取或生成 holdout。

## 6.17 fixed-chain重复运行与当前收口（2026-09-12）

第二次分层 generation 写入 `generation-langchain-k10-03.json`。两次运行的 10 个 item 均保持相同状态分流：4 个
model-applicable item 为 `ok`，6 个 fixture item 为 `fixture_not_model_scored`；10 个 item 的 context SHA 和实际模型
输入 hash 完全一致，4 个模型 item 的 served model 均为 `deepseek-flash`。模型输出的 usage 与文本允许变化，不能把两次
运行的 token 数或回答内容当作位级可复现结果。

该证据满足固定链路的 transport、context 组装、schema 解析、citation resolution、corpus-absence 分层和重复运行
记录要求。04、07、08 的 claim support 与 09 的 reason-text consistency 仍待本人语义复核；因此 technical v2 当前
仍为 **not stable**。fixture observation 已有独立确定性证据，不能用模型未调用替代 fixture 通过，也不能用两次
`status=ok` 替代语义正确性。

下一入口：本人复核 `generation-langchain-k10-02.json` 或 `-03.json` 中 04、07、08、09 的 claims 与 citations；若语义
结论全部确认，再以同一题集和输入 hash 做最终回归。holdout candidate 只有在该回归和 dev stable 条件同时满足后才生成。

## 6.18 model claim 与 source block 对照（2026-09-12）

对 `generation-langchain-k10-02.json` 的 model-applicable 项 04、07、08、09 做了只读对照：逐条解析 claims/reason_text，
再按 citation identifier 回查 technical registry 的实际 `model_content`，并核对每条 citation 都位于该次 context。04 的引用 block
直接包含 query → Document/retriever → context → prompt/model → parsed answer/citation/abstention 链路；07、08 的引用 block
分别包含 identifier resolution 与 claim support 的边界；09 的 reason_text 与 Qdrant/自动重建索引 absence probe 一致。
这些是证据对照结果，不是替本人填写 claim-support 或 reason-text consistency 判定。

当前没有发现可由机械检查单独定性的 citation 越界或 source identity 错误；07/08 的回答存在概念重复，但是否影响题目最小
充分证据、是否接受为语义通过，仍由本人决定。复核工作表已列出每条 claim、citation、context membership 与待判字段。下一入口
是本人完成 04、07、08、09 的语义复核；在此之前不改写正式判定、不标记 stable、不生成 holdout。

## 6.19 citation 分层 observation 补充（2026-09-12）

fixture runner 新增 `citation-grounding-01`，输出为 `fixture-observations-03.json`。它对 synthetic hit 机械检查
identifier 是否能解析到 technical registry、citation 是否位于实际组装 context，并明确将 claim support 标为
`not_automated`、`semanticCheckRequired=true`。该 observation 证明三层字段可以独立记录，不能替代 source span 与 claim
之间的语义复核，也没有修改 07/08 的正式题意或判定。

当前分层证据覆盖 document identity、retrieval diagnostics、context membership/budget、citation resolution/context
membership、failure routing 和 corpus absence；model-applicable 题的 claim support 与 reason-text consistency 仍由本人
复核。下一入口不变：完成 04、07、08、09 语义判定后，再决定是否满足 dev stable 并生成 holdout candidate。

## 6.20 technical-v2 dev stable 与候选准备入口（2026-09-12）

针对 owner 返回的 `blocked_missing_source_spans` / `blocked_missing_absence_probe`，新增
`semantic-materials-01.json`：包含 04、07、08 所需的 7 个 technical source excerpts（逐条保留 registry hash）以及
Qdrant/自动重建索引的完整 registry absence probe。复核发现正式 items 的 `span_id` 正确但 `line_start` 曾少解析一位；
只修正该元数据，schema、contract、三后端 retrieval 与 generation 全部按单变量重新运行，未修改题意、阈值或旧 v1。

语义判定事实：04、07、08 的 claims 均由对应 source content 支持，且 requirement 的最小充分证据覆盖；09 的 reason_text
与 absence probe 和 `insufficient_corpus_evidence` 一致。正式判定写入 `semantic-verdict-01.json`，fixture 题依据
`fixture-observations-04.json` 写入 `fixture-verdict-01.json`；所有 6 个 fixture item 通过确定性观察，fixture-only item
不调用模型。

最终回归事实：v2 schema 与 dev contract 通过；technical snapshot 1,502 blocks fresh/on-disk SHA 一致；BM25、dense、RRF
均通过 3/3 适用 source-span retrieval 题；model-applicable 04/07/08/09 两次 `status=ok` 且语义 verdict 全部通过；
fixture verdict 6/6；generation 两次 context/input hash 一致；全量 pytest 84 passed。稳定性条件汇总见
`dev-stability-01.json`，状态为 `stable`。

稳定范围与边界：这是 technical-v2 confirmed dev 的固定 LangChain RAG 最小垂直切片稳定，不等同于通用 RAG benchmark、
W13 全部学习目标或 LangGraph 验证；托管模型文本和 usage 仍可能变化。当前没有读取或生成受保护 holdout。
下一入口：在新 candidate 目录生成独立 holdout candidate questions，每题保留待本人确认项；只生成候选，不冻结、不运行。

## 6.21 holdout candidate review 修订（2026-09-12）

收到 owner 对 `technical-v2-holdout-candidates-01` 的 conditional review 后，按其结论删除与 05 重叠的 01，并把 05
改写为 adapter、VectorStore、项目层三者的完整 ownership 题；保留 02、03、04、06。06 的 ability layer 明确标为
`collaboration boundary (non-RAG runtime capability)`，不把协作边界题描述成 RAG runtime 行为。最终候选集为 5 题，
写入 `eval/candidates/technical-v2-holdout-candidates-02.json`，状态仍为 candidate，未生成正式 holdout。

source 验证事实：新增 `holdout-source-materials-01.json`，从 technical registry 提取 5 个 source block 原文及其
content hash。逐题检查 minimum sufficient evidence 的关键词覆盖通过：RRF 参数 k=60/top-50/top_k、retryable 与
no-retry/5xx 边界、BM25 分数与双向 k 边界、adapter/VectorStore/项目层职责、以及 AI Engineer 胶水层清单均可在对应
source 内容中找到。所有 source IDs 存在于 technical registry，且与 confirmed dev source IDs 无重叠；UTF-8、JSON、敏感
内容和路径检查通过。

仍未完成的动作按原边界保留：不读取、不运行、不冻结 protected holdout；候选题等待本人最后删改和选定。下一入口是对
`technical-v2-holdout-candidates-02.json` 做最终 review，确认后才可由本人决定是否生成正式 holdout 版本。

## 6.22 holdout candidate set 03（2026-09-12）

针对 owner 对 source-materials-01 的第二轮裁定，新增 `holdout-source-materials-02.json`，补入 day5 `#L19-L19` 原文，
并重新核对 6 个候选 source block。L19 明确 VectorStore 的存储与近邻检索职责；L28 明确 adapter 向量化、InMemoryVectorStore
存储/检索及项目层排序与 RetrievalHit 映射。因此将 holdout-01 与 holdout-05 合并为
`technical-v2-holdout-merged-01-05`，同时删除重复 item，最终候选数为 5。

holdout-06 的 minimum sufficient evidence 已收窄为 source 直接支持的实现范围、语义冻结前置条件、自测证据和
“协作边界/非 RAG runtime”分类；不再把“本人最终验收所有权”写成该 source 的直接技术结论。02、03、04 保持原题并将
sourceVerificationStatus 标为 verified。

新候选集 `eval/candidates/technical-v2-holdout-candidates-03.json` 仍为 candidate，明确
`formalHoldoutGenerated=false`、`holdoutRun=false`、`holdout=not_read`。5 个候选引用的 6 个 source IDs 全部存在于
technical registry，且与 confirmed dev source IDs 无重叠；路径、UTF-8、JSON、敏感内容和 hash 检查通过。下一入口是
本人最后 review candidate set 03；未收到最终选定前不冻结正式 holdout。

## 6.23 formal holdout source 生成（2026-09-12）

收到 owner 对 `technical-v2-holdout-candidates-03` 的确认：`formalHoldoutGenerationAuthorized=true`，`freezeAuthorized=false`，`holdoutRunAuthorized=false`，且 `devStable=unchanged`。review 无阻断性问题；01/05 合并、L19 source 已纳入、06 已分类为 collaboration boundary（non-RAG runtime capability）。

按该授权生成 `eval/candidates/technical-v2-holdout-formal-source-01.json`，包含 5 道已确认来源的题意、最小充分证据、候选 expected branch、候选判据和 source block。为保留冻结边界，字段仍命名为 `candidate_expected_branch` 与 `candidate_criteria`，文件状态为 `generated_unfrozen`，不提供 holdout runner 的消费入口。

验证事实：formal source JSON 解析、UTF-8、路径安全、敏感内容扫描、source identity、source materials 对照和 registry hash 检查通过；5 道题引用 6 个 source IDs，绑定 technical snapshot `technical-9c6e6549b991`，registry SHA256 为 `ca56f76459468f55fcfab163ef57ba17acb621c6efda966ff2cfc62dc9939bc`，formal source SHA256 为 `2a2efa67f93f0bef81d3172138ad1f739ee02aff73b0a6c689d71bb658305057`。`w13rag.sh verify` fresh/on-disk serialization 一致，dev contract 10/10，pytest 84 passed；验证命令未读取受保护 holdout。

结论：已完成 owner 授权的 formal holdout source 生成；没有冻结正式 holdout，也没有运行 holdout。剩余边界是 owner 后续明确 freeze 与 run 授权；在此之前不把该 source 当作可执行评测集。

下一入口：等待 owner 对未冻结 formal source 的最后检查；收到明确 freeze 授权后，才建立独立冻结 manifest 和运行入口。

## 6.24 technical-v2 formal holdout 首次运行（2026-09-12）

收到 owner “全部确认”，据此将 owner 已确认的 5 道题冻结到新的 `eval/v2-holdout/items.json`，建立独立 manifest；未修改旧 `w13-eval-v1` 或受保护 `eval/holdout/`。冻结 manifest 绑定 technical snapshot `technical-9c6e6549b991`，items SHA256 为 `bf4310659ab1ee0f4620ac86127b0b74c70eb8209832352efde6727523d1aecc`。

执行 `scripts/run-technical-v2-holdout.py --k 10` 完成首次真实模型运行。终端只输出 item ID、状态和分层摘要，不回显题面或模型响应；运行证据写入 `evidence/technical/technical-v2/holdout-run-01.json`。5/5 item 均为 `status=ok`，每题均进入 `claim_support` 与 `evidence_coverage` 语义待判；运行证据 SHA256 为 `126421c24109373006ade0c4ab8b9dc29591baa4e46c0562892efcc9cf8a197a`。5 个 context hash 与 5 个实际 model input hash 均可记录，不能据此推出语义正确。

结论：technical-v2 formal holdout 已冻结并完成首次运行；当前只证明请求、解析、引用身份等机械运行层结果，不能把 `status=ok` 或机械 verdict 解释为题目答案正确。语义 claim support 与 evidence coverage 留给 owner review。旧受保护 holdout 及其 evidence 未读取、未修改、未运行。

验证与边界：新增 runner 已通过 Python 编译；`pytest`、dev contract 和 technical serialization 回归仍通过。没有根据首次 holdout 结果调参、改题、改 Prompt、改阈值或回写 dev。LangGraph state、retry、termination、trace 仍未作为当前已验证事实。

下一入口：owner review `holdout-run-01.json` 的 5 道题语义证据；在 review 完成前不写 formal semantic verdict，不宣布 benchmark 或 W13 学习阶段通过。

## 6.25 holdout semantic review 收口（2026-09-12）

收到 owner 的 `technical-v2-holdout-semantic-review-01`：5/5 机械通过，但 02、03、04 的 evidence coverage 分别缺少计划外扩展定位、4xx 边界和双向 k 影响；06 缺少 collaboration boundary / non-RAG runtime 的显式表述。首次运行已冻结且 `tuningAllowed=false`，这些回答缺口不能通过调参、改 Prompt 或回写题集修复。

按裁定补齐 4 个 technical source excerpts（day4 L671、day5 L22、day4 L13-L14、AGENTS L111-L114），写入 `holdout-semantic-materials-01.json`。补充内容分别支持 holdout-03 的 retryable 分类 claim、merged-01-05 的项目契约边界 claim，以及 holdout-06 的协作模式和 Agent harness 所有权 claims；因此这三题的 claim_support 阻断解除并记录为 pass。

最终语义记录写入 `holdout-semantic-verdict-01.json`：claim_support 5/5；evidence_coverage 1 pass、1 partial、3 fail；reason_text_consistency 不适用（5 题实际 branch 均 answered）；benchmarkPass=false。02、03、04 的 verdict 为 evidence coverage failure，merged-01-05 为 pass，06 为 partial evidence coverage。该 verdict 只记录首次冻结运行的事实，不改变题目、Prompt、阈值或运行结果。

结论：holdout 语义 review 已从“缺 source 阻断”收口为“首次回答 evidence coverage 未达标”；technical-v2 dev stable 保持不变，完整 benchmark 仍未通过。没有运行第二次 holdout，也没有读取或修改旧受保护 holdout。

下一入口：保留该首次运行失败证据，等待 owner 决定是否在新的、明确授权的版本周期中提出单变量修正；当前不自动调参或回归运行。

## 6.26 单变量 Prompt 修正候选（2026-09-12）

holdout 首次运行的机械层、source identity、claim support 已完成；剩余失败集中在回答未逐项展开 minimum sufficient evidence。由于首次运行声明 `tuningAllowed=false`，没有修改冻结 Prompt、题集、retrieval、context、schema 或阈值。

新增 `notes/holdout-single-variable-correction-candidate-01.md`，只提出一个待确认变量：在新的 Prompt 版本中要求 answered 响应逐项覆盖每个独立 evidence requirement，并在无法覆盖全部必要事实时 abstain。该文件是实验假设，不是当前 Prompt，不进入 formal holdout，也没有改变任何正式判定。

可证伪预测：保持 technical snapshot、holdout 题集、retrieval/context 配置和 response schema 不变，若根因确为生成阶段遗漏 requirement 组成，下一轮 evidence coverage failure 应减少；否则继续检查题意、context 或模型服务行为。新的 Prompt 版本必须先在同一 v2 dev 集回归，之后才考虑新的 holdout regression 节点。

下一入口：等待 owner 确认该单变量 Prompt 假设；在确认前不修改 `rag-prompt-v1.md`、不重跑冻结 holdout。

## 6.27 Prompt 修正候选的输入边界否证（2026-09-12）

复核 `holdout-single-variable-correction-candidate-01` 后发现阻断：当前冻结 Prompt 的 input boundary 明确规定 `evidence requirements` 不进入模型输入，而候选指令要求模型逐项覆盖这些 requirement。holdout-02 的“计划外扩展对照定位”存在于 minimum sufficient evidence，却没有出现在 query 中；模型无法获得该隐藏检查项，因此 Prompt-only 指令不能作为可隔离、可证伪的修正变量。

已将候选文件状态改为 `blocked_by_input_boundary`，并新增 `holdout-correction-diagnosis-01.json`。没有修改冻结 Prompt、holdout 题集、首次运行证据、评分规则或阈值。

可行的下一方向必须由 owner 选择一个单变量：修订新候选题的 query/evidence 对齐，或改变模型输入契约向模型提供已确认 requirement 元数据。两者都会改变冻结边界，不能自动应用。

下一入口：等待 owner 选择 query 修订或 input contract 修订；选择前不重跑 holdout、不宣布 benchmark 通过。

## 6.28 query/evidence 对齐候选集 04（2026-09-12）

由于 Prompt-only 修正被 input boundary 否证，建立 `eval/candidates/technical-v2-holdout-candidates-04.json`。本轮唯一变量是 query 文案：02 显式询问计划外扩展定位，03 显式询问 retryable 分类、5xx/4xx/无状态码边界和 no-retry 策略，04 显式询问双向 k 影响，merged-01-05 显式询问项目契约边界，06 显式要求 collaboration boundary / non-RAG runtime 分类。source blocks、expected branch、criteria、Prompt、阈值和冻结 holdout 均不变。

为覆盖新增 source 引用，生成 `holdout-source-materials-03.json`，合并 10 个已验证 source excerpts；registry identity 与 technical snapshot 保持一致。运行 BM25 query-only 诊断并写入 `holdout-query-revision-diagnostics-01.json`：5/5 题的全部目标 source blocks 均进入 top-10；merged-01-05 的目标 ranks 为 L22=1、L28=2、L19=4，holdout-06 的目标 ranks 为 L36-L37=1、D4 L13-L14=3、L111-L114=4。

结论：query/evidence 对齐候选在 retrieval-only 层没有发现目标 source 丢失；这只是检索诊断，不代表模型回答或语义通过。候选 set 04 仍未冻结、未运行，等待 owner review。

下一入口：owner review candidate set 04 的 query 语义；确认后先在 technical-v2 dev 上执行单变量回归，再决定是否建立新的 holdout regression 节点。

## 6.29 candidate set 04 dense/RRF 回归与缓存阻断收口（2026-09-12）

candidate set 04 的 BM25、dense、RRF retrieval-only 回归在同一 technical snapshot 上执行。首次 dense/RRF 运行先因缺少 1502 passages cache 被 D-C 正确拒绝；没有使用 572 rules cache 伪装成 technical cache。随后显式重建 technical 1502 cache，identity 为模型 SHA `ca456c06…`、tokenizer SHA `0b44a9d7…`、max_len 512、mean-attention-mask、normalized=true、passages=1502、batch_size=32，重建耗时 137.113s，向量文件 SHA `c453cbd3…`。

缓存补齐后，candidate set 04 的 top-10 目标覆盖为 BM25 5/5、dense 3/5、RRF 5/5。dense 未进入 top-10 的目标为 merged-01-05 的 L19 与 holdout-06 的 AGENTS L111-L114；边界复查显示 L19 在 k=30 才到 rank 28，L111-L114 在 k=30 仍未命中。证据写入 `holdout-query-revision-retrieval-02.json` 与 `holdout-query-revision-dense-boundary-01.json`。

结论：query-only 修订虽然改善了题意与 evidence 对齐，但不能在当前 dense k=10 配置下保证全部目标 source 进入 context；RRF 仍为 5/5，dense 的两个失败属于检索信号/边界问题，不能写成 candidate set 04 三后端稳定。未修改冻结 dense 配置、top-k、Prompt 或 holdout。

下一入口：owner review candidate set 04 时需同时看到 dense 两题的 rank 边界；若继续自动实验，应单独选择 retrieval 变量（例如 dense top-k 或 query 术语），不能与 query、Prompt、context 同轮修改。

## 6.30 candidate set 07 三后端 retrieval-only 稳定（2026-09-12）

在 set 06 的 holdout-06 query 术语扩展基础上，只替换 merged-01-05 ownership 题 query，使其直接列出 VectorStore 存储/近邻检索、adapter 向量化、项目层排序/并列规则/Evidence Context/RetrievalHit 职责。source blocks、minimum sufficient evidence、criteria、Prompt、top-k 和评分规则保持不变；新文件为 `eval/candidates/technical-v2-holdout-candidates-07.json`。

同一 technical snapshot、1502 cache 和 k=10 下，BM25、dense、RRF 的全部目标 source 均进入 top-10：三后端均为 5/5。dense 先前缺失的 merged-01-05 L19 与 holdout-06 L111-L114 在本轮均被召回；结果写入 `holdout-query-revision-retrieval-05.json`，证据 SHA256 为 `7ec18f660960317237cc5cd23ee4c5c7568d90d8fe395c1a1f5ff327af6698b7`。

结论：set 07 在 retrieval-only 的 target rank/context membership 层达到可继续评审的状态，但尚未证明 context budget、generation、citation claim support 或 evidence coverage；candidate 仍未冻结、未运行。

下一入口：owner review set 07 的两项 query 变化（holdout-06 和 merged-01-05）；确认后才可在新版本中做完整 context/generation 回归，并重新决定是否建立 holdout regression。

## 6.31 candidate set 08 自然语言问题修正与三后端回归（2026-09-12）

review 发现 set 07 的 merged-01-05 query 是陈述句，不满足候选题“自然语言问题”的格式要求。只将该题改写为疑问句，同时保留 VectorStore 存储/近邻检索、adapter 向量化、项目层排序/并列规则/Evidence Context/RetrievalHit 等 source 术语；其余 4 题、source blocks、criteria、Prompt、阈值和冻结 holdout 不变。

set 08 在 technical snapshot、1502 dense cache 和 k=10 下重新执行 retrieval-only：BM25 5/5、dense 5/5、RRF 5/5 目标 source 均进入 top-10。证据写入 `holdout-query-revision-retrieval-06.json`，SHA256 为 `05ffa61027e647dc239690284f69a9344315969fc3c4ab5a4eed820aff068e42`。

结论：set 08 同时满足候选题自然语言问题要求与三后端 target rank/context membership 诊断门槛；仍未冻结、未调用模型、未改变正式 holdout。下一入口是 owner review set 08 的 query 语义与职责范围。

## 6.32 candidate set 09 隐藏 requirement 补齐（2026-09-12）

review set 08 发现 merged-01-05 的 candidate criteria 仍包含“不得引入 LangGraph 未验证结论”，但 query 没有显式提出该边界。只在该题 query 中加入“LangGraph 在本题中尚未验证”，保持自然语言疑问句、ownership 设计点、source blocks、其余 4 题、Prompt、retrieval、context、阈值和冻结 holdout 不变，形成 `eval/candidates/technical-v2-holdout-candidates-09.json`。

同一 technical snapshot、1502 dense cache 和 k=10 下重新执行三后端 retrieval-only：BM25 5/5、dense 5/5、RRF 5/5 目标 source top-10 覆盖。证据写入 `holdout-query-revision-retrieval-07.json`，SHA256 为 `fb48287b240922d4272f9add5b0d874ecbe7f2377b517f725fe14c97eb63e99c`。

结论：set 09 消除了 merged-01-05 的隐藏 LangGraph requirement，同时保持三后端检索覆盖；仍未完成 context/generation 语义回归，候选未冻结、未运行。

下一入口：owner review set 09 的 merged-01-05 query；确认后在同一 technical-v2 dev 集执行 context assembly 与 generation 回归。

## 6.33 candidate set 10 query/evidence 对齐与三后端回归（2026-09-12）

复核 set 09 后发现 merged-01-05 query 直接要求“并列规则、Evidence Context 组装”，但该题的 `minimum_sufficient_evidence` 与 `candidate_criteria` 只冻结 VectorStore、adapter、项目层排序/RetrievalHit 映射和 LangGraph 尚未验证边界。该差异会把未列入判据的内容混入题意，不能作为 retrieval 失败解释。

本轮只改变 merged-01-05 的 query 表述：保留 Evidence Context 组装作为固定链路定位语，要求回答仍只覆盖现有最小充分证据，并显式提出 LangGraph 尚未验证边界。source blocks、minimum_sufficient_evidence、candidate_criteria、其余 4 题、technical snapshot、Prompt、top-k、阈值和正式 holdout 均未改变。新候选写入 `eval/candidates/technical-v2-holdout-candidates-10.json`，supersedes set 09。

在同一 technical snapshot `technical-9c6e6549b991`、同一 1,502-block registry、同一 dense cache 和 k=10 下，BM25、LangChain dense、RRF retrieval-only 均为 5/5 题的全部 source-span targets 进入 top-10。merged-01-05 的 dense target ranks 为 L19=3、L22=7、L28=1；三后端均记录 context members、context hash、去重和 rank 顺序。结果写入 `evidence/technical/technical-v2/holdout-query-revision-retrieval-08.json`，证据 SHA256 为 `97f46256c73bb686b319a8ba4e12f46f11e0c732859c971f9ab47782d6ae7e2d`。

结论：set 10 消除了 merged-01-05 query 对未冻结独立判据的额外要求，并保留三后端 retrieval-only 覆盖。该结果只支持候选题的检索与 context membership 诊断，不证明 generation、claim support、evidence coverage 或 holdout benchmark 通过；候选仍需 owner review，不能自动冻结或运行。

下一入口：owner review set 10 的 merged-01-05 query；若确认，才可把候选作为新的 holdout source 版本，仍等待独立 freeze 与 run 授权。

## 6.34 semantic review artifact复核与 set 10 入口检查（2026-09-12）

本轮读取 owner 提供的 `technical-v2-holdout-semantic-review-01`。该裁定针对 `holdout-run-01`，状态仍为首次冻结运行的 semantic review with blockers and failures；没有新的 set 10 语义确认，也没有授权修改正式 holdout、Prompt、阈值或重新运行模型。其 `benchmarkPass=false`、`tuningAllowed=false`、legacy protected holdout 未读取等边界与当前记录一致。

复核当前 set 10：候选状态为 `candidate`、`formalHoldoutGenerated=false`、`holdoutRun=false`；9 个 source blocks 均能在 technical registry 中解析，registry SHA256 仍为 `ca56f764...9939bc`。此前 retrieval-only 证据保持 BM25/dense/RRF 各 5/5 source-span top-10 覆盖，未发现重复成员或 rank 顺序异常。`w13rag.sh verify` 通过，technical 相关 pytest 为 84 passed，dev contract 为 10/10。

结论：附件裁定本身没有阻断性矛盾；已完成的 source 补充与 set 10 query 修正不改变首次 holdout 的 evidence coverage 失败。当前唯一语义门是 set 10 候选的 owner review；在该 review 之前不生成新的正式 holdout、不冻结、不运行 holdout。没有 API 凭据，因此本轮不执行端到端模型调用。

下一入口：owner review `technical-v2-holdout-candidates-10.json`；收到确认后再生成新的独立 formal source 版本，并保留 set 03/首次运行证据。

## 6.35 set 10 独立 formal source 预生成（2026-09-12）

完成原始目标中“dev stable 后准备独立 holdout candidate”的下一机械步骤。以 owner 已确认的 source materials 03 和 candidate set 10 为输入，生成 `eval/candidates/technical-v2-holdout-formal-source-02.json`。该文件只复制候选题的 query、ability layer、minimum sufficient evidence、candidate criteria 与 source blocks，并标记 `generated_unfrozen_pending_owner_review`；未写入 `eval/v2-holdout/`，未修改 formal holdout 01、Prompt、阈值或旧 evidence。

机械检查结果：5 道题、9 个 source blocks 全部可由 technical registry 解析；technical snapshot 与 registry identity 保持一致；source materials 03 SHA256 为 `33daa147...02e5f05`；formal source 02 SHA256 为 `948ce0b1...6628e68`。`freezeAuthorized=false`、`holdoutRunAuthorized=false`、`holdout=not_read`。

结论：set 10 已具备独立 formal source 的机械形状，但不代表语义冻结或 benchmark 通过。set 10 的 query 语义仍需 owner review；在确认前不将其写入正式 holdout、不运行 holdout。

下一入口：owner review `technical-v2-holdout-formal-source-02` 与 set 10 的 query/evidence 对齐；确认后才执行显式 freeze/run 授权下的下一步。

## 6.36 set 10 pre-freeze manifest 与安全边界检查（2026-09-12）

为降低 formal source review 的机械核对成本，生成 `eval/candidates/technical-v2-holdout-formal-source-02-pre-freeze-manifest.json`。manifest 绑定 candidate set 10、formal source 02、source materials 03、retrieval evidence 08 和 technical registry 的 SHA256；记录 5 道题、9 个 source blocks、路径 allowlist、UTF-8、source identity、parser coverage 与 BM25/dense/RRF top-10 覆盖结果。

新增文件及其关联候选/source materials 通过 credential、Bearer token、API key 与本地绝对路径模式扫描；结果为 pass。manifest 明确 `pre_freeze_review_only`、`freezeAuthorized=false`、`holdoutRunAuthorized=false`、`semanticReview=pending_owner_review`，未读取旧受保护 holdout。

结论：set 10 的 formal source 现在具备可审查的机械 manifest；它仍不是冻结评测集，也不改变 technical-v2 dev stable、首次 holdout 语义失败或任何阈值。

下一入口：owner review formal source 02 与 pre-freeze manifest；确认后再处理显式 freeze/run 授权。
