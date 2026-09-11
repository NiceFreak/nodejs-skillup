# W13 RAG 术语表（综合整理）

> 整理日期：2026-09-11。对象：`week13-rag/notes/` 下 D1–D5 全部学习笔记。
> 来源：D1 术语表（`day1-corpus-freeze-and-baseline.md` §2.2 / §2.3.1）、D3 术语表（`day3-freeze-serialization-contract.md` §10）、
> BM25 设计冻结（`bm25-design-freeze.md`）、dense 设计冻结（`dense-design-freeze.md`）、LangChain dense 接线冻结
> （`dense-langchain-wiring-freeze.md`）、代码导读（`rag-implementation-guide.md`）及 D2/D4/D5 各阶段笔记。
> 用途：把分散在各阶段笔记中的已确认术语归并到一份表，统一指称，便于查阅与复习。本表只对齐用词与解释，
> **不新增已冻结语义**；标「待验证」的词只给字面用法，不给规则结论。

---

## 1. RAG 总概念与链路

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| RAG（Retrieval-Augmented Generation，检索增强生成） | 从冻结语料检索相关证据 → 组装实际交给模型的上下文 → 模型依据上下文生成答案 → 返回可定位引用，或证据不足时拒答 | RAG 提供有来源、受证据约束的回答；它不是 Agent |
| retrieval（检索） | 根据 query 从 corpus 选择相关块的阶段；BM25 与 dense 都属检索 | full-context baseline 不筛选子集，因此没有 retrieval |
| generation（生成） | 模型依据 instructions、query 与 context 产生 answer、citations 或 abstention 的阶段 | thinking 会影响 generation 结果，但不会改变 retrieval 命中 |
| context（上下文） | 实际交给模型的证据文本，来自检索命中或全语料组装 | context 是模型输入，不是回答本身 |
| grounded generation（证据约束生成） | 要求回答受给定 context 中证据约束 | 模型语言流畅不表示有证据支持 |
| Agent | 由模型动态判断何时调用检索工具、是否继续、何时结束的编排范式 | W13 不实现 Agent；RAG 只负责提供来源知识，Agent 在 W14 才负责控制 |

---

## 2. 语料与来源（资料与版本）

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| 语料库（corpus） | 允许系统检索或作为模型上下文使用的文档集合 | 不是整个工作区，也不自动包含所有 Markdown |
| 语料快照（corpus snapshot） | 从一个明确来源版本复制出的固定输入集合；本实验为 `rules-c0a4b85` 七文件 | 文件清单不等于已复制并冻结的内容 |
| source commit | snapshot 的 Git 来源基线；本实验为 `c0a4b85…` | 当前工作树内容不能默认等同于某个 commit |
| manifest | 记录来源、normalization、逐文件路径/字节/SHA-256/Git blob 的清单 | `documents` 数组顺序是全语料顺序候选，不代表 relevance |
| normalization `repository-content-v1` | scope = "Neutral wording and placeholders…"，`sourceLinePositionsPreserved: true`；不移动既有正文行号 | **不触碰空白/换行**；它是内容改写，不是序列化 |
| 来源追溯（provenance） | 说明每份内容来自哪个 commit、路径和版本 | 是数据准备，不是 retrieval，也不是 generation |
| 语料构建（corpus construction） | 确定文档纳入/排除范围，并完成冻结、清理、切分和来源标记等输入准备 | 属于数据准备阶段 |
| 证据覆盖（evidence coverage） | 目标问题所需的支持证据是否存在于已构建 corpus 中 | corpus 有证据但 retrieval 未取回属 retrieval miss，不是 corpus 缺证据 |
| sourcePath / snapshotPath | 源仓库相对路径 / snapshot 内路径 | 两者指向不同位置，不可混用 |
| line_start / line_end | 基于 snapshot 文件的行号（全部 LF、无 BOM） | 1-based，包含两端 |

---

## 3. 模型输入容量与计量

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| 词元（token） | 模型和 tokenizer 处理文本时使用的计量单位 | byte、字符和 token 不能互相直接换算 |
| 分词器（tokenizer） | 把文本转换为 token 序列的具体实现 | 不同模型或版本可能得到不同 token 数；生成模型未必公开精确 tokenizer |
| 特殊 token（special token） | tokenizer 为角色、消息边界、开始或结束等协议结构保留的标记 | 用户未在正文键入，不表示它不占 token |
| 提示词渲染（prompt rendering） | 把结构化 messages、工具定义等转换成模型实际接收序列的过程 | API JSON 中可见文字不一定等于最终模型输入序列 |
| 指令（instructions） | 告诉模型任务、行为边界和输出约束的输入内容 | 不是用户问题，也不是支持答案的 corpus 证据 |
| 查询（query） | 本次希望系统回答或处理的问题 | 决定信息需求，但不是 retrieval 结果或证据 |
| 序列化语料（serialized corpus） | raw corpus 按确定规则拼装后真正准备进入 prompt 的文本，含来源标识和文档边界 | 不含消息角色包装，也不表示已经调用模型 |
| 上下文窗口（context window） | 一次模型请求可容纳输入与输出的总 token 上限 | 对冻结模型/API 是容量上限，不会随输入变长而缩小；变化的是占用量与剩余容量 |
| 上下文预算（context budget） | 从窗口中为 corpus 或 retrieved context 预留的可用部分 | 还要给 instructions、query、输出和安全余量留空间 |
| 语料专属 token 数（corpus-only token count） | 只计冻结 corpus，用于请求前判断完整语料能否进入 context budget | 不含 instructions、query、格式标记和模型输出 |
| 预留输出 token（reserved output tokens） | 为 generation 预留并在实验中固定的最大可用容量 | 受模型最大输出能力约束，但不取上限；预留量也不是实际生成量 |
| 安全余量（safety margin） | 为离线估算误差、线上渲染差异和输入小幅变化而主动不占用的容量 | 不是发送给模型的内容，也不是 provider 自动保证的空间 |
| 用量字段（usage） | 模型服务在真实请求结果中返回的输入、输出等用量记录 | 是该次请求的运行证据，不自动给出整个 corpus 的离线计量结果 |
| prompt_tokens | usage 中的输入 token 数 | 是 provider 返回的实际值；离线 estimate 不等于 provider usage |
| prompt cache | 命中/未命中表示本次输入中复用或新处理的 token；命中 token 仍在 prompt_tokens 和 context window 中 | 不能只凭延迟推断命中；命中不代表 generation 不重新执行 |
| 上下文压缩（compaction） | 由 harness 把较早会话状态压缩成更短表示，以便长任务继续 | 不等于 prompt cache，也不是 RAG retrieval；压缩会改变后续实际输入表示 |
| 上下文容量检查 | 检查指定输入能否放入已经冻结的预算 | “文件不大”不能替代有方法和边界的 token 计量 |

---

## 4. source block 与序列化契约

### 4.1 来源身份与内容组装

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| source block | Evidence Context 中带 source ID 的证据单元；语义粒度 = Markdown 段落或小节 | 不是固定长度的文件片段；同一小节含多条独立规则时按独立规则段落拆分 |
| `source_span` | 核心行范围，与 `source_id` 完全一致，标识核心规则冻结位置 | 不是“第几个序列化段落”；只定位到文档也未必足够精确 |
| source identifier / `source_id` | `corpus_id/source_path#Lstart-Lend`，标识核心 `source_span` 的冻结位置 | 身份 ≠ 内容验证；内容验证由 `content_sha256` 负责 |
| `context_spans` | 零到多个附加语境，`role` ∈ {`heading`, `table_header`}，保持原始顺序 | 已包含在 `model_content` 内，只作来源证据，不参与 BM25 索引 |
| `model_content` | 单个 block 实际提供给模型的组装文本（标题由外到内 → 必要表头 → 核心 span） | 是 D3 冻结的模型可见正文，与 BM25 `page_content` 逐字节同源 |
| Evidence Context | 送入 `<EVIDENCE_CONTEXT>` 的完整串 = 有序 blocks 集合 | 全语料 baseline 直接把它完整交给模型，跳过 query → retrieval |
| citation registry / `blocks` | 唯一持久化为有序 `blocks` 数组；entry 存 source_id、spans、model_content、content_sha256 | 是本实验实现称谓，不是所有 RAG 系统的标准组件名 |
| `content_sha256` | 对 `model_content` UTF-8 全字节计算的 SHA-256 | 验证组装文本可重复生成，不作身份 |
| blocks 排序 | manifest 文档顺序 → 核心 `line_start` → `line_end` 升序 | 不代表 relevance；重复 `source_id` 验证失败 |
| serialization（序列化） | 把结构化对象（spans / registry entry）转换成确定字节串 | D3 主线；区别于 corpus 的 normalization |
| source wrapper / block 边界 | 包裹单个 block、把 source ID 与正文绑定的外层格式（XML-like） | 使任意相邻 block 边界无歧义 |
| delimiter / 分隔符 | 区分相邻 block / 字段的标记字符序列 | 已冻结为 wrapper 标签 + 块间一个空行 |
| hash 字节边界 | `content_sha256` 计算依据的精确字节串范围与编码/换行约定 | 已冻结为 `model_content` UTF-8 全字节 |
| 确定性 Markdown parser | 不调用模型，从同一 snapshot 自动重算 blocks | 是 Markdown 子集，未证明任意 CommonMark 输入都正确 |

### 4.2 字节、编码与行结构

| 术语 | 含义 | 备注 |
|---|---|---|
| byte / 字节 | 8 bit 数据单元；hash 与文件体积基于字节而非字符 | std |
| character / 字符 | 文本语义单元，UTF-8 下可变长（一个中文常为 3 bytes） | std |
| UTF-8 | Unicode 的一种变长字节编码；本 snapshot 文本默认编码 | std |
| EOL（End of Line） | “行结束符”统称，决定一行在哪里结束 | std |
| LF（Line Feed） | `\n`（U+000A）；Unix/macOS/git 默认行结束符 | 本 snapshot 七文件全部为 LF |
| CR（Carriage Return） | `\r`（U+000D）；单独出现或作为 CRLF 的前半 | std |
| CRLF | `\r\n`（U+000D + U+000A）；Windows 传统行结束符 | 本 snapshot 无 CRLF |
| BOM（Byte Order Mark） | 文件开头的 U+FEFF；UTF-8 下体现为 EF BB BF 三字节 | 本 snapshot 无 BOM |
| line / 行 | 以 EOL 结束或以文件结尾结束的文本单元；`Lstart-Lend` 行号基于此 | D2 行号语义 |
| blank line / 空行 | 不含非空白字符的行；Markdown 中常作块级分隔 | std |
| whitespace / 空白 | 空格、tab、换行等不可见字符总称 | std |
| indentation / 缩进 | 行首空格或 tab；普通排版缩进与 fenced code / 列表内语义缩进不同 | 设计点 2 子规则对象 |
| trailing whitespace / 行尾空白 | 行末 EOL 前的空格/tab；对语义通常无关但对 hash 字节敏感 | 设计点 2 子规则对象 |

### 4.3 Markdown 块级结构

| 术语 | 含义 | 用法 |
|---|---|---|
| paragraph / 段落 | 连续非空行文本块 | source block 基本语义粒度 |
| heading / 标题 | `#` 起行，含层级 | 可作 `context_spans`（role=`heading`） |
| list item / 列表项 | `-` / `1.` 等起行，可嵌套 | 顶层列表项独立成 block，嵌套跟随父项 |
| fenced code block | ``` 围栏包裹的代码块；首行后可选语言标识 | 与紧邻前置说明共同成 block，只向前合并 |
| info string | fenced code 开围栏上的可选语言标识 | 围栏与 info string 原样进入 model_content |
| blockquote | `>` 前缀的引用容器 | source block 保留引用标记 |
| thematic break | `---` 等水平分隔 | 不进入模型可见内容，仅作禁止跨越合并的硬边界 |
| table / 表格行 + 表头 | GFM 表格；数据行各自成 block 并附带表头 | 表头可作 `context_spans`（role=`table_header`） |

### 4.4 处理动作

| 术语 | 字面含义 | 状态 |
|---|---|---|
| preserve / 保留 | 源文本字节原样进入 `model_content` | 基线 A 下为例外清单行为 |
| normalize / 规范化 | 把同类排版差异统一到约定格式（统一 LF、去行尾空白等） | 基线 A 默认行为 |
| collapse / 折叠 | 连续多个同类空白（如空行）收敛为一个 | 已确认：连续空行折叠为 1 个空行 |

---

## 5. 检索（retrieval）

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| retrieval | 根据 query 从 corpus 选择相关块的阶段 | 输出是候选，不是答案；排序分数不是正确概率 |
| BM25 | 按词项匹配相关性给文档排序的经典检索算法 | 分数是词项统计相关性，不是语义相似度，也不是正确概率 |
| `BM25Retriever` | LangChain 的 BM25 检索器入口（`langchain_community.retrievers.BM25Retriever`） | 返回的 Document 不含 score；score 需另调 `vectorizer.get_scores()` |
| preprocess_func | `BM25Retriever` 的自定义分词回调 | 默认按空白切分，对中文不切分，因此中文场景必须自定义 |
| tokenization（分词） | 中文连续字符切相邻 bigram；拉丁字母与数字按非字母数字边界切词 | 只影响索引与查询的 token 序列，不改变 `page_content` 字节 |
| bigram | 相邻两字符组成的 token 单元 | 纯 Python 实现，无外部词典依赖 |
| normalization（检索规范化） | 统一小写 + 全角转半角 + 所有非字母数字字符作词边界 | 只作用于 token 序列，不改动 `page_content` |
| top_k | 取得分最高的 k 个文档；本实验冻结为 10 | k 过小漏证据，过大引入无关内容并占用上下文 |
| tie-break（并列处理） | 分数并列时按 `registry_index` 升序作确定性排序 | 框架本身不实现该规则，由项目层显式执行 |
| vectorizer | `BM25Retriever` 底层的打分组件 | `get_top_n()` 取 top-k，`get_scores()` 取分数 |
| `Document`（LangChain） | LangChain 的文档对象，含 `page_content` 与 `metadata` | 本实验 `page_content = model_content`，逐字节同源 |
| `page_content` | `Document` 的正文字段 = D3 冻结的 `model_content` | 不二次切分、不去 Markdown 语法、不回到原始 Markdown 行范围 |
| `metadata` | `Document` 的元数据，含 6 个字段：source_id、content_sha256、source_path、line_start/line_end、registry_index | 全部来自冻结 registry，不新增语义；score 不进 metadata |
| `registry_index` | 冻结 registry 中的序号，用于分数并列时的确定性 tie-break | 顺序本身是冻结证据 |
| context assembly（上下文组装） | 把检索命中块按规则拼装成实际模型可见的 Evidence Context | 按分数降序进入，去重按 source_id，超预算按分数从低到高裁剪 |
| `RetrievalHit` | 检索结果条目，含身份 / 排名 / 分数 | 是项目内部结构，不是 LangChain 抽象 |
| `build_retrieval_context` | 由 hits + registry 生成实际模型可见证据字符串 | 复用冻结 wrapper，与全语料 baseline 的 Evidence Context 同格式 |
| dense retrieval | 用 embedding 向量相似度排序文档的检索方法 | 与 BM25 替换的是整个检索表示（分词、向量、相似度计算），不是只换打分公式 |
| hybrid retrieval | BM25 与 dense 的候选融合检索 | 本实验用 RRF 候选并集融合 |
| RRF（Reciprocal Rank Fusion） | 把多个 ranker 的排名倒数加权合并成最终排序 | 遍历两列表累加到同一 dict；任一 ranker 的 miss 不等于无法召回 |
| 交集命中（B4.1） | 某 evidence requirement 被命中 = 至少一个 retrieved 块的 source_span 与该 requirement 的 source_span 有交集 | 同时记录覆盖行数与覆盖比例作诊断 |

---

## 6. 向量与 embedding（含 LangChain 集成）

### 6.1 模型与向量

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| embedding（嵌入） | 把文本映射到固定维度向量，使语义相近的文本向量距离近 | embedding 不是答案，也不能证明 source span 支持 claim |
| embedding model | 生成 embedding 向量的模型；本实验为 `intfloat/multilingual-e5-small` | 模型能力与来源真实性需分开验证 |
| ONNX | 开放的机器学习模型交换格式 | 本实验用 fp32 ONNX 模型文件 |
| onnxruntime | 执行 ONNX 模型的运行时；本实验冻结 1.23.2 | 可用 provider 含 CoreML / Azure / CPU |
| `CPUExecutionProvider` | ONNX Runtime 的 CPU 执行 provider | D1 冻结值 |
| fp32 | 32 位浮点精度 | 与 float32 同义 |
| 输出维度 | embedding 向量长度；e5-small 为 384 | 由模型决定 |
| `input_ids` / `attention_mask` / `token_type_ids` | tokenizer 产出的模型输入张量 | XLM-R tokenizer 不产出 `token_type_ids`，按惯例补 0 |
| mean pooling（平均池化） | 对 `last_hidden_state` 按 `attention_mask` 加权平均得到句向量 | D2 冻结的池化方式 |
| L2 normalization | 对池化向量做 L2 归一化，使内积等价于 cosine | D2 冻结 |
| cosine similarity | 归一化向量内积度量的相似度 | 一般范围为 [-1,1]，不是 0–1 |
| `query: ` / `passage: ` 前缀 | e5 系列训练约定：query 加 `query: `，文档加 `passage: ` | 前缀影响相似度（实测同文本加/不加前缀 cosine ≈ 0.9797） |
| 缓存身份（cache identity） | 模型文件 sha256 + tokenizer sha256 + 最大长度 + 池化方式 + 归一化 + 块数 | 身份不一致即视为缓存失效并重算 |
| p50 / p95 | 查询延迟的分位数 | 是性能观察，不是质量指标 |
| RSS | 进程峰值内存占用 | dense 复算 572 passage 峰值约 2.2GB |

### 6.2 LangChain 接线

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| `Embeddings` | `langchain_core.embeddings.Embeddings` 抽象，负责 `embed_documents` / `embed_query` | adapter 只做向量化，不负责检索排序 |
| `InMemoryVectorStore` | `langchain_core.vectorstores.InMemoryVectorStore` 内存向量库 | 只承担向量存储与相似度检索；排序仍由项目层完成 |
| adapter（`E5Embeddings`） | 自定义 `Embeddings` 适配器，前缀在内部，文档侧命中缓存，查询侧现算 | 不新增向量数据库依赖 |
| `add_documents()` | 向量库写入路径，内部调用 `embed_documents(texts)` | 未传 `ids` 时以 `uuid4` 作存储键；重复键会静默覆盖 |
| `ids` | 向量库存储键；本实验冻结为 `source_id` | 装载前用唯一性断言挡住重复 |
| `similarity_search_with_score()` | 向量库检索路径，返回文档与相似度分数 | 内部走 cosine，`argsort()[::-1][:k]` 排序 |
| `_cosine_similarity()` | 向量库底层相似度计算 | 无 scipy/simsimd 时走 `np.dot / np.outer(norms)` 分支 |
| 并列顺序 | 框架对同分文档不实现「按 registry_index 升序」 | 项目层显式重排 |
| `RESOLVABLE_EPS` | 等价性判据中的分数差阈值（1e-6） | 分数差 ≤ 阈值的相邻对视为并列，允许顺序不同 |
| `load_cached_matrix()` | 以 identity 为门槛复用现有 `.npy` 缓存 | 身份不一致即抛错，不重算、不覆盖 `.npy` |
| `assert_unique_source_ids()` | 装载前挡住重复 source_id 的唯一性断言 | 防止 `add_documents` 静默覆盖 |
| 等价性判据（F9） | LangChain 路径与 `dense_retrieve` 的 top-10 顺序与集合一致 | 分数允许 float 末位差异 |
| `dump()` / `load()` | 向量库持久化接口 | 本实验不使用，避免形成第二份落盘向量副本 |
| `BaseRetriever` | LangChain 检索器抽象 | 本实验未接入；后续框架学习对象 |

---

## 7. 生成与运行状态

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| `assemble_messages` | 把 system（Prompt）+ context + query 组装成模型请求消息 | 是本地字符串组装，不是 LangChain Prompt/ChatModel |
| `run_item` | 执行单次模型调用并返回 `RunRecord` | W12 `DeepSeekClient` 复用，无重试 |
| `RunRecord` | 保存原始响应、状态与 usage 的运行记录 | 保存 provider 原始输出，不与当次输入脱离比较 |
| `status` | 响应解析状态：`ok` 加六种错误 | `ok` 只表示响应通过当前解析与 schema，不代表任务正确 |
| `schema_error` | 响应不满足 response schema 的错误状态 | 与答案错误、branch_match 是不同失败类型 |
| `branch_match` | 响应分支（answered/abstained）与预期不符的机械失败 | 机械条件，不依赖语义判定 |

---

## 8. 评估与判分（eval）

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| 评测（evaluation，eval） | 用预先定义的输入和判据检查系统行为 | 运行成功不等于回答正确 |
| 评测项（evaluation item） | 评测集中的一个独立样本，至少含一条 query 并关联预期行为或判据 | 不是整套 eval，也不是模型生成的答案 |
| 单题响应（per-item response） | 某冻结实验条件对一个 evaluation item 产生的一次模型输出 | 是待评对象，不是 reference answer 或汇总分数 |
| evidence requirement | 运行前冻结的证据标准：某题应命中的 source_span 集合 | 不进模型输入；区别于 retrieval 运行输出 |
| 预期分支（expected branch） | 该题应有的 answered 或 abstained 行为 | 运行前冻结；预期 abstained 被强行回答直接否决该 split |
| 开发集（dev set） | D2–D4 可反复运行、用于比较变更的题集 | 可据此改进系统，不能承担最终未见数据验收 |
| 留出集（holdout set） | 与 dev 物理隔离、实现与契约冻结前不运行的题集 | 本人知道自己写过的题目，不等于运行结果已见 |
| 基线（baseline） | 后续方案需与之比较的固定起点 | 基线不表示最佳方案 |
| 全语料上下文基线 | 不先检索，直接把声明范围内的全部冻结 corpus 交给模型回答 | 放不下时应记录不可行，不能裁剪后仍称全语料上下文 |
| 指标（metric） | 按明确规则汇总或比较运行结果的方法 | 指标名称本身不含合格边界 |
| 阈值（threshold） | 某个量化指标达到或未达到的分界值 | 阈值只是通过标准的一部分 |
| 通过标准（passing criteria） | 综合量化阈值、关键定性约束与失败条件后的完整验收规则 | 不能只写一个平均分，也不能看完结果后临时修改 |
| item / split | 单题级 / 整套（dev 或 holdout 各 10 题）的通过判定单元 | split 通过 = 适用题全部通过（本实验 8/8 适用题或 10/10） |
| verdict | 单题或整套的判定结论 | 由 evaluators 计算，不是模型自述 |
| 机械检查 | 由程序按确定规则判定（schema、branch、citation 可解析性） | 不等于语义正确 |
| 人工语义判定（R1 口径） | 由本人按冻结 checklist 判断 claim 是否被 context 支持 | 结论由本人给出；AI 只做机械预筛与回填 |
| `citation_precision` | 机械计算 identifier 可解析比例 | 不能代替 context membership 与语义支持判定 |
| `max_achievable` | 机械条件扣减后理论可达的最大通过率 | 门禁 0.9；`max_achievable < 0.9` 即不通过，无需语义判定 |

---

## 9. 回答约束

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| RAG 提示词（RAG Prompt） | 规定 instructions、query、context 与输出的关系，约束如何基于证据回答、引用或拒答 | W12 Prompt 处理注册信息且无 retrieved context，不能改名复用 |
| 响应格式/模式（response format/schema） | 约束模型输出各功能部分如何表示，使程序能确定性解析 | 格式有效只证明可解析，不证明答案或 citation 正确 |
| JSON Schema | 描述 JSON 数据类型、必填字段、枚举和嵌套结构的标准化契约语言 | provider Structured Outputs 往往只支持其子集 |
| JSON mode / JSON Output | provider 约束模型返回合法 JSON 文本的能力 | 合法 JSON 不自动满足应用字段、类型和语义要求 |
| 结构化输出（Structured Outputs） | provider 按声明 schema 约束模型输出结构的能力 | schema 遵守不证明答案事实正确 |
| 引用（citation） | 回答指向实际使用的冻结来源位置 | 模型输出看似真实的路径不等于引用有效 |
| 原子化论断（atomic claim） | 只表达一个可独立判断、可独立关联 citation 的结论单元 | 语义上单一不等于语法上必须恰好一句 |
| 引用标识（citation identifier） | 模型可见、可返回的受控稳定键 | 标识不是证据正文，也不应依赖序列化顺序 |
| 引用解析（citation resolution） | 检查 identifier 是否存在并映射到对应 source span | 映射成功只证明目标存在，不证明原文支持 claim |
| 引用正确性（citation correctness） | 检查已解析的 source span 是否实际支持关联 claim | 内容关系检查，不能由键值查表完成 |
| 拒答（abstention） | 证据不足或超出范围时明确不作无依据回答 | 拒答不是运行错误，也不等于所有不回答都正确 |
| 正常回答/拒答分支（answered/abstained） | 同一响应契约下两种互斥的合法结果形态 | 不是额外模型调用或新 pipeline 阶段 |
| 拒答原因代码（reason code） | 从预先冻结有限集合选择的机器可读拒答类别 | 不等于 HTTP status，也不能由模型任意创造新类别 |
| 拒答原因文本（reason text） | 与 reason code 一致的简短人类可读说明 | 不承担系统根因判定或完整诊断报告 |

---

## 10. 失败归因（各阶段）

| 术语 | 定义 / 用法 | 需要区分 |
|---|---|---|
| 语料证据缺口（corpus evidence gap） | 目标问题所需证据不在冻结 corpus 中 | 不是 retrieval miss；retriever 无法取回不存在的内容 |
| 检索遗漏（retrieval miss） | corpus 有支持证据，但 retrieval 没把合适内容取回 | full-context baseline 没有 retrieval，此项不适用 |
| 上下文组装失败（context assembly failure） | 已取回的证据在筛选、排序、截断或拼装后未正确进入模型输入 | 不能与「根本没检索到」混为一类 |
| 提示词失败（prompt failure） | 输入证据足够，但 Prompt 未清楚约束回答、引用或拒答 | 需与模型服务错误和证据不足分开 |
| 生成失败（generation failure） | generation 调用报错，或在输入与 Prompt 足够时仍产生错误输出 | 网络/API 失败与答案质量错误都在此阶段，但归因仍要分开记录 |
| 评测流程失败（evaluation pipeline failure） | response 本身可能正确，但 parser、registry lookup 或 scorer 实现/配置错误 | 不能把 evaluator 的 bug 记成模型或 retrieval 失败 |
