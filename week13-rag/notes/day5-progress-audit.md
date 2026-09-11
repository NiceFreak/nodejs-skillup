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
