# W13 D5 Demo 技术追问与开放讨论

> 日期：2026-09-11（Asia/Shanghai）。用途：主体展示结束后的问答备查；**本文件不计入 15 分钟主体时长**。
> 每题先用约 30 秒的短答回应，再按对方兴趣展开证据。短答是讲解参考，不是本人独立掌握的验收记录。
> 依据：D4 已存 dev 证据、当前代码与 9/11 官方文档核对。W14 内容均为职责映射或候选方向，未冻结新设计。
> 展示样例用于说明功能；BM25 与 dense 端到端的人工语义判定已在 D5 完成且均未通过（各 3/10），
> 不因此把样例改写为评测通过证据。

阅读顺序：Q1–Q11 解释链路与 LangChain；Q12–Q16 解释 dense / hybrid；Q17–Q28 解释评估与运行；
Q29–Q36 用于框架衔接和开放讨论。**被问“为什么分数没达标、准备怎样优化”时，先读 Q37，再按追问进入 Q38–Q41。** 正式评分始终以
[`scoring-contract.md`](../eval/scoring-contract.md) 与已登记的
[`scoring-rulings-r1.md`](../eval/scoring-rulings-r1.md) 为依据；本稿不新增或重述可执行判分规则。

## Q1. 这次 RAG 实际完成了什么？

**30 秒短答**：当前有一条可复现的规则文档脚本化问答链路：把冻结 Markdown 切成可追溯的 source blocks，检索与问题
相关的块，组装模型实际看到的上下文，生成带引用的答案或拒答，再分别检查运行、结构、引用和语义。BM25 已有
十条真实端到端调用记录；dense 和 hybrid 已完成检索对照。

**展开与边界**：展示脚本化 CLI 链路、定位来源和分析结果的能力；尚无质量验收通过的可用 RAG chain。完整质量验收仍未通过；没有上传管理、持续更新、
多租户服务或生产运行证据。依据：[BM25 端到端入口](../scripts/run-bm25-e2e.py)、
[D4 笔记 §6.21](./day4-full-context-baseline-and-bm25.md)。

## Q2. 为什么不直接把全部文档交给模型？

**30 秒短答**：这批语料能完整放进上下文，所以我先做了 full-context 基线。它让后面的比较有参照：检索到底
减少了多少输入，是否漏了证据，以及回答是否更好。本次能证明 BM25 输入明显更小，但两条路径都没有通过
质量门禁，因此尚不能认定这批文档必须使用 RAG。

**展开与边界**：full-context 是有效的候选方案。输入容量、质量、时延和费用需要分别比较，不能从其中一项
推出全部取舍。依据：[输入计量](../evidence/input-budget/assembled-input-rules-c0a4b85-w13-rag-prompt-v1.json)、
[当前 full-context 记录](../evidence/baseline/dev-full-context-prompt-v1-json-output-01.json)。

## Q3. 只有七份文档，实验有什么价值？

**30 秒短答**：这七份文档切成了 572 个 source blocks，足以观察直接回答、跨文档、近似表述、优先级和无答案
这些行为。它的价值是让来源、输入和评估都能核对，并且已经观察到不同检索配置的差异。它仍然只是小型、
同领域语料的受控实验，不能代表生产规模。

**展开与边界**：是否扩充语料取决于需要验证的场景。文件数量本身不能证明任务有代表性。
依据：[语料 manifest](../corpus/rules-c0a4b85/manifest.json)、[serialization 报告](../evidence/serialization/criteria-report-rules-c0a4b85.md)。

## Q4. 为什么按 Markdown 结构切块？

**30 秒短答**：当前内容主要是规则，按段落、顶层列表项和表格数据行切块，可以把独立规则与来源位置对应起来。
必要标题和表头进入模型正文，避免只剩一个没有适用对象的句子。这样方便引用和诊断；块是否适合检索，还要由
实际评估决定。

**展开与边界**：当前 parser 针对冻结语料中已经核实的结构工作，并非通用 CommonMark parser。不能把确定性
切分通过当作语义边界最优。依据：[parser.py](../src/w13rag/parser.py)、[D3 serialization 契约](./day3-freeze-serialization-contract.md)。

## Q5. source ID 与 hash 各解决什么问题？

**30 秒短答**：source ID 用来定位核心规则的原始行范围，hash 用来检查实际模型正文的字节是否变化。必要标题
和表头单独记录为 context spans，不扩大核心 source span。因此可以同时回答“这条引用来自哪里”和“提供给
模型的内容能否重建”。

**展开与边界**：当前 ID 前缀是 `rules/`，运行证据另行绑定 `rules-c0a4b85` snapshot。ID 必须结合该快照解释，
不能拿当前根目录文件的同一行号代替冻结来源。依据：[registry.py](../src/w13rag/registry.py)、
[serialize.py](../src/w13rag/serialize.py)。

## Q6. 检索结果与模型上下文为什么要分开看？

**30 秒短答**：检索结果告诉我哪些块被找到了、排名和分数是什么；模型上下文告诉我哪些文本真正被发送。
当前 BM25 按结果顺序，用冻结 wrapper 组装正文。即使检索正确，组装时漏块、换顺序或截断，也可能影响回答，
所以两者都要留证据。

**展开与边界**：9/11 已离线重算十条 BM25 context，与 D4 记录的十个 context hash 全部一致。这证明证据
上下文可以重建；本次没有重核完整 Prompt payload，也不保证再调用模型时返回相同文字。依据：[build_retrieval_context](../src/w13rag/retrieval.py)、
[BM25 端到端证据](../evidence/bm25-e2e/dev-bm25-e2e-top10-01.json)。

## Q7. BM25 的评分直觉是什么？

**30 秒短答**：BM25 根据查询词与文档词的匹配评分。一个词在当前文档出现更多，通常有帮助，但收益会逐渐
饱和；一个词在整个语料中越少见，区分度通常越高；文档长度也会影响分数，避免长文仅因词多而占优势。
它依靠词项统计，不自动理解同义表达。

**必要深入**：常见表达为对查询词求和：`IDF(t) × f(t,d)(k1+1) / [f(t,d)+k1(1-b+b·|d|/avgdl)]`。
`k1` 控制词频饱和，`b` 控制长度归一化，与返回几个结果的 `top_k` 不同；实际 IDF 细节以所用实现为准。
本地使用 `rank_bm25`，没有实现新的 BM25 算法。依据：[检索接线](../src/w13rag/retrieval.py)、
[Microsoft BM25 说明](https://learn.microsoft.com/en-us/azure/search/index-similarity-and-scoring)。

## Q8. 为什么中文使用 bigram？

**30 秒短答**：中文没有天然空格分词。当前冻结方案把连续中文切成相邻两个字的词项，拉丁字母和数字按边界
切词，查询和文档使用同一个处理函数。这样不需要另加分词模型，处理可复现，但它不会自动把业务描述翻译成
`controller` 或 `repository`。

**展开与边界**：`NFKC + lowercase` 只作用于评分用词项，不改写引用正文。bigram 是本次取舍，不能声称它是
中文 BM25 的最优方案。依据：[B2 冻结决定](./bm25-design-freeze.md)、[tokenize](../src/w13rag/retrieval.py)。

## Q9. top_k 越大是否越好？

**30 秒短答**：增大 top_k 会保留更多候选，可能找回排名靠后的证据，也会增加输入并带入更多无关内容。本次
BM25 从 top-10 的 5/8 增长到 top-30 的 7/8，但仍有一题未通过。可以说这三个测试点未达标，不能说任何更大
的 k 都无效。

**展开与边界**：BM25 的 `top_k`、BM25 公式中的 `k1`、RRF 的平滑常数 `k=60` 是不同参数。
依据：[BM25 top-10](../evidence/retrieval/dev-bm25-top10-02.json)、[top-30](../evidence/retrieval/dev-bm25-top30-01.json)。

## Q10. 当前到底用了哪些 LangChain 能力？

**30 秒短答**：实际使用了 LangChain 的 `Document`、`BM25Retriever.from_documents`、`Embeddings` 与
`InMemoryVectorStore`。正文映射为 `page_content`，source ID、行号和 hash 保存在 metadata；BM25 取底层分数后
显式排序，dense 走向量库检索后同样显式排序，都没有用 retriever 的 `invoke` 执行整条链。

**展开与边界**：generation 复用 W12 `DeepSeekClient`，没有接 ChatModel 或 LCEL，所以不是整条链都在框架上。
dense 的向量仍由本地 ONNX 推理产生；adapter 以冻结 `source_id` 作为向量库键，文档向量来自冻结缓存而不是重算。
2026-09-11 的等价性验证显示两条 dense 路径的 top-10 顺序与集合一致、分数差在 1e-7 量级。
依据：[retrieval.py](../src/w13rag/retrieval.py)、
[retrieval_dense_langchain.py](../src/w13rag/retrieval_dense_langchain.py)、
[dense 接线冻结记录](./dense-langchain-wiring-freeze.md)、
[官方 retriever 接口](https://docs.langchain.com/oss/python/integrations/retrievers)。

## Q11. 这些实现经验如何迁移到完整 LangChain 链路？

**30 秒短答**：已经明确的数据契约可以作为接入框架时的检查依据：Document 保留什么正文和 metadata，
retriever 返回什么，context 如何序列化，模型请求如何组装，输出怎样检查。框架接线时可以逐层替换或适配，
同时用既有来源与输入证据检查是否发生行为变化。

**展开与边界**：检索侧接线已经完成（2026-09-11：dense 的 adapter 与向量库），adapter 的语义由冻结记录决定——
前缀在 adapter 内、文档向量未命中即失败、缓存身份不一致即失败、存储键用冻结 `source_id`。generation 与
LangGraph 仍是后续项；框架默认 splitter、ID 或格式不能未经评估替换冻结契约。
依据：[dense 接线冻结记录](./dense-langchain-wiring-freeze.md)、[周计划 §3](./week13-plan.md)、[包导读](../src/w13rag/README.md)。

## Q12. dense retrieval 与 BM25 的核心区别是什么？

**30 秒短答**：BM25 比较词项统计，dense 把查询和文档变成向量，再按向量相似度排序。它有机会找回措辞不同
但相关的内容。当前用 multilingual-e5-small 的 ONNX 模型在 CPU 上产生 384 维向量；检索走 LangChain
`InMemoryVectorStore` 的余弦相似度，旧的 NumPy 矩阵路径保留作等价性参照（两条路径 top-10 顺序与集合一致）。

**展开与边界**：这是本地 embedding 模型；生成答案仍使用外部模型，不能把整套系统称为完全离线。
dense 在这组 10 条 dev 上仍未通过检索门禁（3/4/5 of 8），接入框架不改变该结论。
依据：[retrieval_dense.py](../src/w13rag/retrieval_dense.py)、
[retrieval_dense_langchain.py](../src/w13rag/retrieval_dense_langchain.py)、
[Microsoft E5 发布说明](https://github.com/microsoft/unilm/tree/master/e5)。

## Q13. E5 的前缀、pooling 与归一化怎样组成一条向量生成路径？

**30 秒短答**：查询加 `query: `，文档加 `passage: `，遵循 E5 的输入约定；tokenize 后按 attention mask
对 token 向量求平均，排除 padding，再做 L2 归一化。这样每段文本得到一个向量，归一化后的内积等价于
cosine similarity。

**必要深入**：当前输入上限设为 512 tokens。cosine 理论范围是 `[-1,1]`；本次分数集中在较高正值，并不表示
有同等数值的“答案正确概率”。正式记录未完整保留逐块截断统计，不能据此声称截断审计已完成。
依据：[dense 冻结决定](./dense-design-freeze.md)、[E5 模型卡](https://huggingface.co/intfloat/multilingual-e5-small)。

## Q14. embedding 缓存如何避免重复计算？

**30 秒短答**：当前把 passage 向量缓存为本地数组，使用模型和 tokenizer 的 hash、输入长度、pooling、
归一化、块数和 batch size 检查缓存身份。一致时直接加载，不一致时重新计算。它适合当前冻结语料的重复对照。

**展开与边界**：当前缓存身份没有包含正文内容或 registry hash；相同块数的内容更新不一定自动失效。
因此不能声称已经实现通用文档更新。未来支持更新时要先明确内容身份与失效规则。依据：
[EmbeddingIdentity / build_corpus_embeddings](../src/w13rag/retrieval_dense.py)。

## Q15. dense 分数不如 BM25，原因是什么？

**30 秒短答**：可确认的是，这个 E5 配置在本语料和八条适用 dev 题上，三个 k 点都比 BM25 少通过两题。
具体原因还没有隔离验证。短块、标题上下文、模型与领域的匹配程度都是可能因素；不能直接说 dense 无用，
也不能把 BM25 的词项不匹配解释直接当作 dense 的根因。

**展开与边界**：本地模型来自镜像，未与官方 hash 完成来源交叉验证；功能运行通过与来源验证是不同证据。
依据：[dense top-10 证据](../evidence/retrieval/dev-dense-top10-01.json)、[D4 dense 对照](./day4-full-context-baseline-and-bm25.md)。

## Q16. RRF 为什么可能有用，也可能没有改善？

**30 秒短答**：RRF 根据候选在各个列表中的排名累加分数，避免直接相加不可比的 BM25 和向量分数。当前每路
取 top-50，再融合选结果。只要某块进入任一路候选，就可能参与融合；两路都没找到的块，融合也无法新增出来。

**必要深入**：当前公式是 `Σ 1/(60 + rank)`，平滑常数与输出 top_k 分开。融合可能提升互补结果，也可能把
原本有用的结果挤出最终列表；本次 top-30 为 7/8，与 BM25 持平。依据：[RRF 实现](../src/w13rag/retrieval_hybrid.py)、
[Microsoft RRF 说明](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking)。

## Q17. 遇到错误回答，怎样定位所在阶段？

**30 秒短答**：先看期望证据是否在冻结语料里，再看是否被检索出来、是否实际进入 context，最后检查 Prompt、
原始响应、解析结果和引用。运行失败与答案质量分开记录，这样能区分“调用失败”“格式不合规”和“有证据
却没正确回答”。一个 item 也可能同时存在多种内容问题。

**展开与边界**：这是已有观察对象的阅读顺序，不替代本人失败归因与重建考核。依据：
[RunRecord](../src/w13rag/generation.py)、[run / evaluators / verdict](../src/w13rag/scoring.py)。

## Q18. JSON mode 能保证答案符合 schema 吗？

**30 秒短答**：当前请求的 `json_object` 用来约束 JSON 输出；应用仍需检查字段、类型、分支和引用结构。
本地收到内容后先判空，再解析 JSON，再执行 JSON Schema 校验。JSON 合法、schema 合规和答案受原文支持，
是不同层次的检查。

**展开与边界**：LangChain `ProviderStrategy` 与 `ToolStrategy` 属于其结构化输出接口，当前代码未接入它们。
不能把使用 DeepSeek JSON mode 称为完成了 LangChain provider schema enforcement。依据：
[check_response](../src/w13rag/generation.py)、[DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、
[LangChain structured output](https://docs.langchain.com/oss/python/langchain/structured-output)。

## Q19. citation 能解析，为什么答案仍可能不正确？

**30 秒短答**：registry 能确认一个 ID 对应真实 source block，却不能确认该原文支持模型写出的 claim。
例如引用位置存在，但 claim 把“允许”读成“必须”，仍然错误。当前机械 `citation_precision` 实际计算的是
可解析引用比例，语义支撑需要另外检查。

**展开与边界**：展示时把字段解释为本项目的机械口径，避免把 `1.0` 读成“所有引用内容都支持答案”。
依据：[scoring.py 的 citation evaluator](../src/w13rag/scoring.py)、[人工语义工作表](./dev-semantic-checklist-worksheet.md)。

## Q20. 模型拒答就说明证据确实不足吗？

**30 秒短答**：拒答是模型输出的行为，是否应该拒答需要对照任务和语料判断。法语口语稿案例按预期拒答；
W13 D2 切换 MCP 的案例也拒答，却与冻结预期不符。因此需要同时展示符合预期的拒答和 false abstention，
不能把拒答本身当作质量保证。

**展开与边界**：top-k 没有找到答案不能证明整个语料无答案。BM25 记录的人工语义判定已完成（按 R1 口径通过 3/10，
仍不通过；该轮为授权链路示例），演示只能说明输出分支与既有预期的关系。依据：
[BM25 记录中的 no-answer-01 / priority-conflict-exception-01](../evidence/bm25-e2e/dev-bm25-e2e-top10-01.json)、
[BM25 判定素材](./dev-semantic-checklist-bm25-e2e.md)。

## Q21. 机械 8/10 和人工 4/10 为什么不同？

**30 秒短答**：机械 8/10 只说明八题通过了可以自动检查的条件。人工继续检查 claim 是否受来源支持、证据要求
是否覆盖，当前 full-context 在 R1 口径下只剩四题通过。人工检查补充内容判断，不能把已经失败的结构条件
改成通过。

**展开与边界**：4/10 是 D4 笔记中的人工诊断结论；原始 JSON 保留运行当时的八项 pending，没有伪装成后来
已经回填的机器记录。R1 的历史效力边界见 Q23。依据：[D4 §6.14](./day4-full-context-baseline-and-bm25.md)、
[full-context 原始 JSON](../evidence/baseline/dev-full-context-prompt-v1-json-output-01.json)。

## Q22. 为什么检索是八题，端到端是十题？

**30 秒短答**：十条 dev 里有两条无答案题，它们需要判断整份语料没有答案，不能用“命中哪条证据”作为检索
层通过要求。因此 retrieval-only 对八条适用题统计，端到端仍看完整十题的回答与拒答。两组比例在回答不同
问题，不能直接比较大小。

**展开与边界**：当前 `coverage_mean` 还包含无答案题的相邻边界 advisory spans，只作诊断；它不是八条适用题
的通过率。依据：[evaluate_item_retrieval](../src/w13rag/retrieval.py)、[retrieval 汇总脚本](../scripts/run-retrieval-eval.py)。

## Q23. R1 暴露了什么评估经验？

**30 秒短答**：R1 在运行后明确了证据覆盖的引用范围口径，所以本轮人工结果按诊断结论使用。它暴露出一个
实际问题：评估要求的 span 和系统的 source block 粒度可能不对齐，答案有相关引用也可能没满足预设范围。
后续运行前需要先把评估含义说明清楚。

**展开与边界**：本轮 10 题里 6 题不通过，其中 **4 题的直接失败点落在引用行范围上**——3 题
（`direct-answer-01`、`paraphrase-01`、`priority-conflict-exception-02`）语义层被判"没有落在 requirement span
内的引用"或覆盖不完整；1 题（`paraphrase-02`）机械层因跨块合并 `AGENTS.md#L185-L189` 不可解析。另外 1 题含
claim 内容本身不支持（`cross-document-02` 的 claim 7），1 题是预期回答却拒答（`priority-conflict-exception-01`）。
这组计数只描述本次 full-context 单轮运行，不能推广成所有路径的根因（BM25 与 dense 端到端已完成人工语义判定，
各通过 3/10，失败题与本次不完全相同）。
不能据此在展示时放宽现有规则或重判通过。新的评估版本、可接受来源范围和阈值仍由本人
决定。依据：[R1 效力与边界](../eval/scoring-rulings-r1.md)、
[D4 逐题诊断](./day4-full-context-baseline-and-bm25.md)、
[dev 判定 worksheet §11](./dev-semantic-checklist-worksheet.md)。

## Q24. 当前 81 条测试通过证明了什么？

**30 秒短答**：这些测试验证当前确定性实现的若干行为，包括 serialization、parser 切分、registry 不变式、
BM25、RRF、LangChain dense 接线的适配与契约边界、请求 payload 和评分分层。请求测试用 MockTransport，
dense 接线测试用合成向量与临时缓存，都可以离线执行。它们不能证明真实模型回答质量。

**展开与边界**：数字有三个时点——D4 阶段记录 70；D5 上午审核复跑 71；D5 完成 dense 接线后新增 10 条，
现为 **81 passed**。新增的 10 条覆盖前缀归属、缓存严格命中、identity 与存储键保护、并列顺序以及两条 dense
路径的合成对照，不加载 ONNX、不调用模型。冻结 Evidence Context 的重算比对是额外的回归检查。
自动检查通过不能代替本人对职责、取舍和故障的独立解释。依据：[tests](../tests/)、
[统一检查入口](../scripts/w13rag.sh)、[dense 接线冻结记录](./dense-langchain-wiring-freeze.md)。

## Q25. token estimate 与 provider usage 有什么区别？

**30 秒短答**：estimate 是本地 tokenizer 对构造输入的估算；usage 是服务端对实际请求返回的计量。
原始文档、加上标题和 wrapper 的 context、最终 messages 是不同对象，不能只拿原始文档 token 数判断请求
能否放下。当前计量和真实发送共用同一个消息组装函数。

**展开与边界**：原始语料约 18,697 estimated tokens，当前 full-context 实际请求约 44.7k prompt tokens；
这不构成 tokenizer 出错，因为两者输入对象不同。依据：[原始语料计量](../evidence/token-count-rules-c0a4b85.json)、
[组装输入计量](../evidence/input-budget/assembled-input-rules-c0a4b85-w13-rag-prompt-v1.json)、[assemble_messages](../src/w13rag/generation.py)。

## Q26. 输入减少 97% 就是费用减少 97% 吗？

**30 秒短答**：不能这样换算。同配置两次十题记录里，full-context 共 447,159 个 prompt tokens，BM25 是
12,723 个，输入总量减少约 97.15%。但 full-context 有大量缓存命中，BM25 的未缓存输入反而更多，还要计入
输出 token；当前没有据此完成实际账单比较。

**展开与边界**：保留 cached / uncached / output 三类计量，再按对应服务和时点的价格计算。展示只说输入规模
缩减，不用它代替费用节省。依据：[full-context usage](../evidence/baseline/dev-full-context-prompt-v1-json-output-01.json)、
[BM25 usage](../evidence/bm25-e2e/dev-bm25-e2e-top10-01.json)。

## Q27. 可以说 BM25 让回答更快吗？

**30 秒短答**：当前记录中 BM25 的调用延迟较低，但这只是不同时间的两次十题运行，输出长度、缓存和服务端
负载都可能不同。现阶段可以展示记录到的延迟，不把它说成受控实验已经证明的稳定加速。

**展开与边界**：端到端延迟还包括检索、组装和生成；`RunRecord.latency_ms` 覆盖本次 client 调用，不含之前的
检索阶段。dense 的查询毫秒记录也不能直接与生成秒级调用相减。依据：[run_item](../src/w13rag/generation.py)、
[dense performance](../evidence/retrieval/dev-dense-top10-01.json)。

## Q28. 文档中如果出现指令，系统会执行吗？

**30 秒短答**：当前 Prompt 明确把 Evidence Context 当作待引用的资料，而非新的执行指令；代码只负责读取、
检索、组装和模型调用，不提供执行文档命令的工具。这个分工降低了文档直接触发动作的范围，但不能仅靠提示词
就宣布已经解决 prompt injection。

**展开与边界**：当前没有做独立的攻击评估。wrapper 前置检查保护序列化边界，也不等于完整的注入防御。
依据：[Prompt v1](../prompts/rag-prompt-v1.md)、[registry wrapper 检查](../src/w13rag/registry.py)、[端到端入口](../scripts/run-bm25-e2e.py)。

## Q29. 为什么下一步考虑 LangGraph？

**30 秒短答**：当前 RAG 是固定步骤。以后如果需要根据结果决定是否再次检索、暂停给人工处理或恢复执行，就
需要明确状态和转移。LangGraph 提供这类工作流与 Agent 编排能力，已有的检索和生成函数可以成为候选节点。
当前尚未实现 LangGraph。

**展开与边界**：LangGraph 也能运行固定 workflow；使用图不自动意味着模型在自主决定流程。是否需要动态路径
要由具体任务证明。依据：[LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)、
[Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)。

## Q30. graph state 与模型 context 是同一个东西吗？

**30 秒短答**：graph state 是工作流在节点之间传递和更新的数据，模型 context 是某次调用实际发送的输入。
状态可以包含版本、检索结果或运行状态，但并非所有字段都应该交给模型。W13 已经把运行事实与模型输入分开，
这能帮助后续明确两者职责。

**展开与边界**：这里是在解释框架对象；W14 state 的字段、更新规则与终止条件尚未在本稿设计。
依据：[LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)、[W13 generation](../src/w13rag/generation.py)。

## Q31. checkpoint 能带来什么？

**30 秒短答**：checkpointer 保存某个 thread 的 graph state 快照，使继续会话、人工介入后的恢复和失败后的
恢复有状态依据。它和保存跨 thread 数据的 store 职责不同。选择内存实现只适合进程内演示，进程重启后的
持久性取决于所选存储实现。

**展开与边界**：当前 W13 没有 checkpoint。持久化也不会自动保证重复执行外部动作是安全的；这需要后续按
实际工具副作用设计。依据：[LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)。

## Q32. 把 retrieval 做成 Agent tool，会增加什么责任？

**30 秒短答**：检索函数仍负责返回证据；Agent 运行层要决定何时调用，并校验工具输入、限制可访问的资料，
记录调用和处理失败。模型提出工具调用不应自动获得额外访问权限。当前“输入 query，返回带来源结果”的
边界能复用，控制规则需要在 W14 另行冻结。

**展开与边界**：tool schema 描述调用形状，不能代替运行时授权。本文不给 W14 的预算、继续或终止判据。
依据：[当前 retrieval](../src/w13rag/retrieval.py)、[周计划的跨周边界](./week13-plan.md)、
[LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)。

## Q33. 为什么现在没用向量数据库？

**30 秒短答**：当前只有 572 个冻结向量，本地数组已经可以完整计算相似度，足以学习 embedding 与排序。
向量数据库主要在持久化、更新、过滤和较大规模检索时提供工程能力；是否引入要看这些需求，RAG 本身不要求
必须使用数据库。

**展开与边界**：LangChain 的 retriever 也不等同于 vector store；retriever 可以从不同来源返回 Document。
当前实现没有证明并发服务、持续维护或生产规模能力。依据：[dense 实现](../src/w13rag/retrieval_dense.py)、
[官方 retriever 定义](https://docs.langchain.com/oss/python/integrations/retrievers)。

## Q34. 如果文档会持续更新，需要补什么？

**30 秒短答**：需要明确新版本怎样替换旧版本，哪些块和向量必须重建，旧答案如何仍能找到当时的来源。
如果有访问权限，还要保证未授权内容不会进入检索结果和模型上下文。当前冻结快照解决的是可复核实验输入，
没有实现这些产品化能力。

**展开与边界**：内容身份、删除、更新和权限是后续设计问题，本稿不承诺新架构或实现时间。当前 embedding
缓存没有正文 hash，也进一步说明它不能直接承担通用更新流程。依据：[语料 manifest](../corpus/rules-c0a4b85/manifest.json)、
[缓存身份](../src/w13rag/retrieval_dense.py)、[范围边界](./week13-plan.md)。

## Q35. 后续改进怎样保持结论可信？

**30 秒短答**：先在 dev 上明确要验证的假设和失败位置，再冻结输入、配置与评估含义进行实验。query expansion、
reranker 或替换 embedding 都是可讨论的候选，但不会仅为了让已有题通过而同时叠加。首次 holdout 结果保留为
结果记录，不用于反向选择方案。

**展开与边界**：R1 的运行后澄清和既有 holdout 可见性限制已经公开登记，后续真正需要盲测时，应先确定访问
规则和新集合流程；本次不读取、修改或生成受保护题目。依据：[R1](../eval/scoring-rulings-r1.md)、
[公开可见性记录](../../incidents/2026-09-10-holdout-content-visibility.md)、[周计划](./week13-plan.md)。

## Q36. AI 实现了代码，本人的学习成果如何说明？

**30 秒短答**：这阶段看的是能否定义问题、理解数据流、作出有依据的取舍、review 实现和诊断失败。本人冻结
语义后，AI 可以实现并自测；本人仍负责 review 和最终验收。展示可以证明已有可运行成果和可复核经验，独立
掌握还要通过脱离讲稿的解释、合理修改或故障诊断来证明。

**展开与边界**：已完成的 A1–A8 review 与诊断记录按各自证据说明；没有发生的验收不在讲稿里补写。
本稿也不代填任何尚未完成的债务重建答案。依据：[协作所有权](../../AGENTS.md)、
[serialization review 证据](./serialization-review-A1-A8-evidence.md)、[当前进度审计](./day5-progress-audit.md)。

## Q37. 目前为什么没有达到预期分数？

**30 秒短答**：目前确实未达标，但几组分数衡量的对象不同。全语料与 BM25 端到端的机械结果都是 8/10，已经低于
至少九题通过的要求；全语料按 R1 做人工诊断是 4/10，BM25 与 dense 端到端的人工语义判定各通过 3/10。
检索则只看八条适用题，要求全部通过，目前最高 7/8。已观察到漏检、引用问题和错误拒答，不能把它们归为同一个根因。

**对应证据，不重新制定判据**：

| 对象 | 已观察到的结果 | 如何解释本轮未通过 | 尚不能据此判断 |
|---|---|---|---|
| Full-context，v1 + JSON 输出 | 机械 8/10；一题引用 ID 不可解析，一题预期回答却拒答；本人按 R1 诊断 4/10 | 两项机械失败已经使最终通过数最多为八；人工还发现来源支持或预设证据范围的覆盖问题 | 不能把所有失败归因于检索；这条路径没有 retrieval，也不能把 4/10 直接当作不受评估口径影响的模型能力分数 |
| BM25 top-10 端到端 | 机械 8/10；两题预期回答却拒答；人工语义判定后通过 3/10（dense 端到端同日另跑一轮：机械 7/10、人工语义 3/10） | 失败来自机械分支条件、R1 ② 包含性与语义内容覆盖；`item_pass_rate` 与 per-class 门禁都不满足 | 不能声称它与 full-context 质量相同，也不能把引用 ID 全部可解析说成答案全部受支持；两轮都是授权链路示例，不作质量验收 |
| Retrieval-only | 同八题，BM25 最好 7/8，dense 最好 5/8，hybrid 最好 7/8 | B4.1 要求全部适用题通过，九个配置都至少有一题未满足 | 不同于端到端 /10；命中按 span 交集检查，不代表已完整取得所有必要规则或生成了正确回答 |

R1 在该次 full-context 运行之后明确，因此 4/10 保留为**诊断结论**；本轮未通过已经有独立机械证据，不依赖
事后放宽或收紧人工口径。全部失败仍按已有记录保留，不在分享时改判。

**追问路径**：

```text
“为什么未达预期？” → Q37：先说明分数对象与已观察事实
  ├─ “相关资料没找到，怎么办？” → Q38：候选召回与排序
  ├─ “找到了，为何模型没用上？” → Q39：实际上下文
  ├─ “模型引用错或拒答错，怎么办？” → Q40：生成与运行波动
  └─ “评估范围不合适，是否应该改分？” → Q41：评估口径与新版本
```

依据：[full-context 原始记录](../evidence/baseline/dev-full-context-prompt-v1-json-output-01.json)、
[BM25 原始记录](../evidence/bm25-e2e/dev-bm25-e2e-top10-01.json)、[B4.1](./bm25-design-freeze.md)、
[R1](../eval/scoring-rulings-r1.md)、[D4 逐题诊断](./day4-full-context-baseline-and-bm25.md)。

## Q38. retrieval 层有哪些值得验证的改进方向？

**30 秒短答**：先区分候选里根本没有需要的证据，还是已有证据排名偏后。前者可讨论查询改写或更合适的
embedding；后者可讨论 reranker。它们针对不同问题，不能一并加入后只看总分。当前只是候选验证方向，
具体实验和条件还要由本人选择并冻结。

**已观察**：增大 top_k 找回了部分要求的证据，但九个已测配置中的 `paraphrase-01` 都未通过。
BM25 查询与相关规则的词项匹配有限；dense 的具体失败机制尚未隔离，不能套用同一个根因。

**候选对照与反证**：

| 候选方向 | 需要保持可比较的条件 | 观察什么；什么现象说明假设未获支持 |
|---|---|---|
| 查询改写或扩展 | 原始用户 query 和题集不变；检索 query 另行记录；固定 corpus、评分实现和 top_k；改写器不接收 expected answer 或预设证据范围 | 查看需要的证据是否进入候选及排名变化；若目标仍未召回、改写改变问题含义，或其它 dev 题明显退化，不能认定该方向有效 |
| 替换 embedding 配置 | 保持原文块、dev query、top_k 和评估口径；单独记录模型身份与输入处理 | 比较全体 dev 的证据命中与资源开销；若只出现分数数值变化而命中未改善，不支持“相似度更高所以更好” |
| 候选 reranking | 固定进入 reranker 的候选集合、query 与最终 top_k | 看已有相关块是否进入最终上下文；候选全集没有该块时，单靠重排不能新增它，不能据最终漏检否定或肯定排序能力 |

这里的观察项用于提出**可证伪的实验问题**，没有设定新的通过阈值，也不改变冻结 B1–B4 / D1–D4。
reranking 与 query rewrite 的职责区别可参照
[Microsoft semantic ranking](https://learn.microsoft.com/en-us/azure/search/semantic-search-overview)；
本项目未接入该服务。已有事实依据：[检索对照](./day4-full-context-baseline-and-bm25.md)、[当前 retrieval](../src/w13rag/retrieval.py)。

## Q39. context 层怎样验证“找到了但没提供好”？

**30 秒短答**：先检查需要的证据是否进入了实际发送的 context，再检查标题、原文和来源标识是否保留。
当前十条 BM25 输入能够按 hash 重建，说明没有发现相对 D4 记录的组装漂移；这不证明当初选择的块已经包含
足够语义。只有确认问题在上下文表达上，才值得做独立对照。

**已观察与未知**：parser 和 serialization 已通过确定性回归，当前没有证据可以把质量未达统一归为组装 bug。
较短的块和标题链是否影响理解，仍是待验证假设。引用 ID 存在于全局 registry，也不能代替它属于本次 context
的检查。

**候选对照与反证**：先固定同一组检索块、Prompt、模型与输出条件，在独立实验版本只改变一种上下文呈现因素，
例如块顺序；每次保存最终 context 和来源对应关系，再观察回答的来源支持是否稳定变化。若要补相邻规则，
明确记录新增哪些 source IDs，并将其视为另一项实验，不能声称检索集合保持不变。
如果原始与变体的响应波动交错、没有稳定的支持关系变化，就不能认定该呈现因素解决了问题。

任何新呈现、邻接补充或块边界变更，都不回写现有冻结 `model_content`、source ID 或历史证据；先由本人确认实验范围。
依据：[context assembly](../src/w13rag/retrieval.py)、[serialization](../src/w13rag/serialize.py)、
[当前离线重建入口](../scripts/demo-replay.py)。

## Q40. generation 层怎样验证 Prompt 或输出约束是否有效？

**30 秒短答**：先用相同输入观察模型自身的运行波动，再比较一个明确变更。当前 JSON 输出约束加入后的那轮
没有再出现格式问题，但引用和错误拒答仍存在；Prompt v2 也没有消除跨块引用。下一步可以讨论固定 context 的
多次运行和单因素对照，不能把换一个 Prompt 后的一次好结果当作可靠改进。

**候选对照与反证**：保存相同 corpus/context、模型请求与服务身份、输出上限和评估口径，先由本人确定运行次数，
再对照一个 Prompt 变更或一个输出机制变更。分别观察 JSON/schema、引用 ID 保真、来源支持与分支行为，
同时记录 usage 和延迟。如果改善只出现一次，或减少格式失败却增加错误拒答，只能记录各自变化，不能宣布整体质量提升。

**边界**：JSON mode 不等于 provider 严格执行 response schema；LangChain 的结构化输出接口也不能保证语义
正确。重试会改变调用次数和费用，当前冻结策略仍为不重试。本稿未选择新 Prompt、模型、重试策略或 trial 数量。
依据：[Prompt v2 记录](./day4-full-context-baseline-and-bm25.md)、[generation](../src/w13rag/generation.py)、
[LangChain structured output](https://docs.langchain.com/oss/python/langchain/structured-output)、
[DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/)。

## Q41. eval 层需要调整时，怎样避免为了提分而改规则？

**30 秒短答**：先解释任务究竟要求哪种证据，再检查判定口径是否准确表达了它。R1 暴露的 span 与 block
不对齐可以作为改进评估设计的输入，但旧结果保留不动。若确实需要新口径，应先由本人确认并冻结独立版本，
在新运行前存在，旧版和新版结果分别报告。

**候选验证与反证**：在进入新版本前，先用明确排除在正式 eval 之外的合成示例，检查几种容易混淆的情况：
ID 存在但没有进入本次 context、原文存在但不支持 claim、支持内容跨越多个 block、相关来源与预设 span 不完全
重合。本人决定这些情况应如何判定，再核对评估器是否忠实执行；AI 只整理结构或实现已确认规则。
如果新 evaluator 的输出只是因为阈值放宽而改变，就不能将分数变化解释为 RAG 功能改善。

**实验顺序的讨论边界**：先补清已有结果的语义与来源证据（BM25 与 dense 的语义判定已在 D5 完成，见 Q37 / Q42），
再根据发现选择 retrieval / context / generation 中的一个假设；是否启动以及具体顺序由本人确认。本日 demo 不执行这些实验，不读取 holdout，不根据首次 holdout
结果选择参数，也不承诺最终能提高多少分。
依据：[冻结评分契约](../eval/scoring-contract.md)、[R1](../eval/scoring-rulings-r1.md)、
[已有 dev 人工记录](./dev-semantic-checklist-worksheet.md)。

## Q42. dense 端到端跑过吗？结果是什么？

**30 秒短答**：跑过一轮，10 条真实调用，9 条 `ok`、1 条 `schema_error`；机械通过 7/10，context 1,195–1,654 字符，
`prompt_tokens` 合计 11,756，`citation_precision_min` 1.0，`split_status` 仍为 fail。那轮是本人授权的链路验证，
**不作质量验收**；人工语义判定已在 D5 完成：按 R1 口径通过 3/10，仍然不通过。

**展开与边界**：失败题是 `cross-document-01`（响应结构失败）、`cross-document-02`（预期回答却拒答）、
`priority-conflict-exception-01`（预期回答却拒答），与 BM25 那轮的失败题不同。因此不能说"接了框架之后质量变差"：
两轮的检索门禁本来就不同（dense 3/4/5 of 8、BM25 5/6/7 of 8），单次运行也无法区分运行间波动——这一轮出现
1 条 `schema_error`，BM25 那轮没有。依据：
[dense 端到端证据](../evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json)、
[dense 接线冻结记录](./dense-langchain-wiring-freeze.md)。

## Q43. dense 接入 LangChain 后，九配置对照的结论变了吗？

**30 秒短答**：没有变。接线与既有 `dense_retrieve` 在 10 条 dev 上 top-10 顺序与集合一致，分数差在 1e-7 量级；
原有九配置通过数（BM25 5/6/7、dense 3/4/5、hybrid 4/5/7 of 8）与门禁结论都保留不动。

**展开与边界**：没有为接线新增 retrieval-only 证据文件，理由是等价性已由脚本验证，再落一份文件只是既有
`dev-dense-top10-01.json` 的等价复制，还会让 retrieval 证据账目从九个有效配置变成十一个。接线前后有一处可
观察的边界现象：当 NumPy 路径分数精确相等、而框架的 float64 余弦不相等时，**top-10 之外**的相邻名次会翻转
（`cross-document-01` 第 110 名、`priority-conflict-exception-02` 第 527 名各一处）；top-10 与门禁判据不受影响。
另外框架的并列顺序不满足我们冻结的 `registry_index` 规则，所以排序仍由项目显式完成。
依据：[等价性验证脚本](../scripts/verify-dense-langchain-equiv.py)、[dense 接线冻结记录](./dense-langchain-wiring-freeze.md)。
