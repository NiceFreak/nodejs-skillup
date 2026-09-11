# W13 LangChain dense 接线与 dense 端到端：设计点冻结记录

> 建立：2026-09-11（D5）。用途：记录 W13 计划 §10 未勾选项「LangChain dense 接线」与「dense 端到端 generation」的语义冻结过程与已核实事实。
> 协作模式：AI Engineer 分阶段的实现方模式。AI 核实事实并给出候选与代价，取舍与运行口径由本人冻结；AI 不代填未确认项。
> 关联：[dense 检索冻结](./dense-design-freeze.md)、[BM25 冻结](./bm25-design-freeze.md)、[D5 学习笔记](./day5-dense-langchain-wiring.md)、[RAG 代码导读](./rag-implementation-guide.md)。

## 1. 已核实事实（2026-09-11，AI 本地实测；无模型调用）

| 对象 | 结果 | 依据 |
|---|---|---|
| 可用框架接口 | `langchain_core.embeddings.Embeddings`、`langchain_core.vectorstores.InMemoryVectorStore` | 项目 venv 内 import 成功 |
| 未安装 | faiss、chromadb、sentence_transformers、langchain_huggingface、langchain_onnx、langchain_openai、langchain_deepseek、scipy、simsimd | venv 包检查 |
| 版本 | langchain 1.4.0、langchain-core 1.6.2、langchain-community 0.4.2（import 时输出 sunset 弃用提示） | `pip list` |
| 向量库写入路径 | `add_documents()` 调用 `self.embedding.embed_documents(texts)`；未传 `ids` 时以 `uuid4` 作存储键 | langchain-core 源码 |
| 向量库检索路径 | `similarity_search_with_score()` → `_cosine_similarity()`（本机无 scipy/simsimd，走 `np.dot / np.outer(norms)` 分支）→ `similarity.argsort()[::-1][:k]` | langchain-core 源码 |
| 并列顺序 | 5 个同分文档：插入 A,B,C,D,E 返回 E,D,C,B,A；反插返回 A,B,C,D,E。框架不实现「并列按 `registry_index` 升序」 | 本地实测 |
| 现有向量缓存 | `week13-rag/.cache/embeddings/e5-small-passages-572.npy`（878,720 bytes，shape (572, 384)，float32，每行 L2 范数为 1）+ identity json（与 D1/D2 常量一致） | 文件读取与 identity json |
| dense 复算成本 | cache miss 时 572 个 passage：23.3s、24.5 passages/s、峰值 RSS 2.2GB、冷启动 2.5s；query p50 13.3ms | [dev-dense-top10-01](../evidence/retrieval/dev-dense-top10-01.json) 的 `performance` |
| dense 现状态 | dense 路径不使用 `Document`，直接以 registry entries + NumPy 矩阵检索 | [run-retrieval-eval.py](../scripts/run-retrieval-eval.py) |
| Document 约束 | 572 条 `Document.page_content == registry.model_content` 已被断言锁定 | [test_retrieval.py](../tests/test_retrieval.py) |
| 前缀影响 | 同文本加/不加 `passage: ` 前缀 cosine = 0.9797 | [dense 冻结记录](./dense-design-freeze.md) 的 D1/D2 功能验证 |

## 2. D-A 接线范围（2026-09-11 冻结）

**决定（本人冻结）**：自定义 `Embeddings` adapter 承担向量化；`InMemoryVectorStore` 承担向量存储与相似度检索；项目层保留文档映射、显式重排与 `RetrievalHit` 映射。旧 `dense_retrieve` 路径保留，作为等价性参照。

**AI 给出的依据（追溯用，非冻结内容）**：本周生态修订要求使用 LangChain 完成固定 RAG；候选 B（adapter 只做向量化）不调用向量库接口；候选 C（`BaseRetriever` 子类）在当前端到端入口为自定义函数 `retrieve()` 的前提下不减少任何现存工作。

**连带条款（本人一并确认）**：

1. 排序与并列顺序留在项目层：框架提供候选与分数，项目显式重排，并列按 `registry_index` 升序。
2. 向量来源唯一化：adapter 以 identity 为门槛复用现有 `.npy` 缓存；`InMemoryVectorStore` 只承担检索；旧 `dense_retrieve` 保留作参照。
3. 等价性判据：LangChain 路径与 `dense_retrieve` 的检索顺序一致且 top-k 集合一致；分数允许 float 末位差异。

**明确排除**：新增向量数据库依赖（faiss / chromadb）；generation 接 LangChain ChatModel/LCEL 不在本周收口清单内，默认排除，变更需本人另行冻结。

## 3. D-B e5 角色前缀落点（2026-09-11 冻结）

**决定（本人冻结）**：`passage: ` 与 `query: ` 前缀位于 adapter 内部（`embed_documents` 与 `embed_query` 各自加前缀）；`to_documents()` 原样复用，B1 的「`page_content` 与 `model_content` 逐字节同源」保持不变。

**选择时的对比依据**：两种落点的缓存复用性相同；差异只在是否保持单一 `Document` 表示与既有 572 条断言。候选 2（前缀写入 `page_content`）需要改述 B1 适用范围或分派既有断言，其收益是 adapter 的通用性，当前无使用场景。

## 4. D-C / D-D / D-F（2026-09-11 冻结）

**D-C adapter 缓存未命中与 identity 不一致的行为**：冻结 a1 + a2。

1. a1 未命中即失败：`embed_documents` 对不在冻结语料内的文本抛 `EmbeddingContractError`，错误包含未命中数量、首个未命中文本的 sha256 与可命中键数量。
2. a2 identity 不一致即失败：`load_cached_matrix()` 比对 identity json 与当前身份，不一致即抛错，**不重算、不覆盖** `.npy`；缺缓存文件同样失败。重算需本人显式声明。
3. 作用域：D-C 只约束文档侧；查询侧按 D2 现算，不缓存。

**D-D 向量库存储键**：冻结以冻结 `source_id` 作为 `ids`，并在装载前用唯一性断言挡住重复（`add_documents` 对重复键会静默覆盖）。不使用 `dump()` / `load()`：在 A 的连带条款 2 与 D-C a2 下，持久化会形成第二份落盘向量副本。

**D-F 断言清单与落点**：冻结方案 1。

| 组 | 位置 | 内容 |
|---|---|---|
| F1–F8、F11 | `tests/test_retrieval_dense_langchain.py`、既有套件 | 前缀归属、缓存逐元素命中、未命中失败、identity 保护、存储键与唯一性、并列顺序、合成 fixture 的两路径一致性 |
| F9、F10、F12 | `scripts/verify-dense-langchain-equiv.py` | 10 条 dev 的 top-10 顺序与集合、572 全排序、冻结对象 hash |

**F10 判据修正（2026-09-11，本篇 §5 有实测依据）**：F10 原为「572 全排序完全一致」，实测不可达。现判据为：分数差超过 `RESOLVABLE_EPS = 1e-6` 的相邻对顺序必须一致；差值在该阈值以内的相邻对视为两条路径无法分辨的并列，允许顺序不同，脚本记录位置与差值。**门禁仍是 F9 的 top-10 严格一致。**

## 5. 实现与验证证据（2026-09-11）

| 对象 | 结果 | 依据 |
|---|---|---|
| 实现 | `E5Embeddings`（前缀在 adapter 内、文档侧严格命中缓存、查询侧现算）、`load_cached_matrix()`、`assert_unique_source_ids()`、`build_dense_store()`、`dense_retrieve_langchain()` | [`src/w13rag/retrieval_dense_langchain.py`](../src/w13rag/retrieval_dense_langchain.py) |
| 确定性断言 | **81 passed**（原有 71 + 新增 10），本次实测耗时 2.39s；新增测试不加载 ONNX | `pytest week13-rag/tests -q` |
| F9 等价性 | 10/10 条 dev 的 top-10 **顺序与集合一致** | [`verify-dense-langchain-equiv.py`](../scripts/verify-dense-langchain-equiv.py) 输出 `order=True set=True` |
| 分数差异量级 | 两路径 top-10 分数最大绝对差 **7.31e-08** | 同上 `max_score_diff` |
| F10 | 8 条查询全排序完全一致；2 条出现并列位置翻转并记录 | 同上 `full_order=PASS / ALLOWED_NEAR_TIE` |
| F12 | 14 个冻结文件（向量缓存、identity、registry、manifest、10 份 retrieval evidence）hash 未变 | 同上 `[F12] frozen artifacts unchanged=True (files=14)` |
| 装载成本 | 572 个块的向量库装载 1.29s（文档侧只读缓存，未复算 23.3s 的 cache miss 路径） | 本地实测 |

**实测发现（F10 判据不可达的根因）**：两条路径的顺序差异只出现在 NumPy 路径**分数精确相等**（差 0.00e+00，走 `registry_index` 并列规则）而 LangChain 路径**不相等**（差 4.31e-08 / 1.53e-08）的位置，即第 110 名（`cross-document-01`）与第 527 名（`priority-conflict-exception-02`），均不影响 top-10。

同时实测否证了「把框架分数按 float32 量化即可复现并列」这一假设：`rules/TECHNICAL-WRITING-PROTOCOL.md#L110-L110` 的 f32(f64) 为 0.8454833627，而 NumPy 路径给出 0.8454833031，两者仍不等。原因是两条路径的表达式不同（float32 单位向量点积 vs float64 点积除以重算范数），量化框架结果无法还原另一侧。

## 6. 待验证项与边界（当前状态）

- **未完成**：dense 端到端 generation，依赖 D-E 冻结，尚未运行；因此检索替换后的回答、引用与拒答行为尚无证据。
- **容许范围**：F10 的容许只覆盖分数差 ≤ `RESOLVABLE_EPS` 的并列位置；它不是「全排序一致」，脚本每次都会打印实际位置与差值。
- **对照范围**：本次等价性验证使用已记录的 10 条 dev 查询与既有 `.npy` 缓存，不产生新的检索对照表，也不改变 9 配置检索门禁结论（dense 3–5/8）。
- **未做**：向量库持久化（`dump()`/`load()`）、reranker、query expansion、非冻结语料的 adapter 复用。

## 7. D-E dense 端到端运行口径（2026-09-11 冻结并已执行）

**决定（本人授权）**：按 BM25 e2e 同一口径执行 dense e2e——**链路可重复运行证据，不作质量验收**；不新增 LangChain 路径的 retrieval-only 证据文件。理由：F9 已证明两条路径 top-10 顺序与集合一致，新增文件只是既有 `dev-dense-top10-01.json` 的等价复制，还会把 retrieval 证据账目从「9 个有效配置 + 1 份缺陷版本」变成 11 份。

**实现**：`scripts/run-dense-langchain-e2e.py`，镜像 `run-bm25-e2e.py`（同一 `run_item()` / `evaluate_item()` / `build_retrieval_context()`），只把检索换成 `build_dense_store()` + `dense_retrieve_langchain()`；`run-bm25-e2e.py` 与其证据未改动。

**运行结果（2026-09-11，10 条真实调用，无重试）**：

| 项 | dense（LangChain 接线） | BM25（D4 记录，同题对照） |
|---|---|---|
| status | 9 `ok` + 1 `schema_error` | 10 `ok` |
| 机械通过 | 7/10 | 8/10 |
| 机械失败项 | `cross-document-01`（schema_error）、`cross-document-02`（branch_match）、`priority-conflict-exception-01`（branch_match） | `priority-conflict-exception-01`、`priority-conflict-exception-02` |
| `max_achievable_pass_rate` | 0.7 | 0.8 |
| `citation_precision_min` | 1.0 | 1.0 |
| context 字符数 | 1,195–1,654 | 1,332–2,020 |
| `prompt_tokens` 合计 | 11,756 | 12,723 |
| 向量库装载 | 0.895s / 572 键 | 不适用 |

证据文件：[dev-dense-langchain-e2e-top10.json](../evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json)（`purpose` 与 `gateNote` 已写明非质量验收与授权来源）。

**边界**：`split_status` 仍为 `fail`（`max_achievable 0.7 < 0.9`），检索门禁与 9 配置对照结论不变；人工语义判定已于同日完成（按 R1 口径通过 3/10，仍不通过，见 [dense 判定素材](./dev-semantic-checklist-dense-e2e.md)）；单次运行不能隔离运行间波动——本次 1 条 `schema_error` 在 BM25 那次没有出现，此差异不构成跨运行结论。
