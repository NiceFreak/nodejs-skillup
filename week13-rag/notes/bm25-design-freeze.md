# W13 BM25 设计点冻结记录

> 建立：2026-09-10（D4）。用途：记录 W13 计划 §3.3 的 B1–B4 设计点的冻结过程与理由。
> 边界：本文件只记录本人已冻结的语义，AI 不代填。冻结后如需修改，按「新增条目 + 保留旧条目」处理，
> 不改写已冻结结论。

## 环境准备（2026-09-10）

| 项 | 值 |
|---|---|
| Python | 3.12.10（`week13-rag/.venv`） |
| langchain | 1.4.0 |
| langchain-core | 1.6.2 |
| langchain-community | 0.4.2 |
| rank-bm25 | 0.2.2 |
| retriever 入口 | `langchain_community.retrievers.BM25Retriever`（import 通过） |
| 框架演进事实 | pip 输出 `langchain-community is being sunset`，官方建议迁移到独立集成包。本阶段按「稳定最低接口」继续使用并记录该事实；若后续迁移，属实现变更，不改判定与契约 |
| 实测框架行为 | `default_preprocessing_func("一带一路 测试")` → `["一带一路", "测试"]`：默认按空白切分，**对中文不切分** → 中文场景必须自定义 `preprocess_func` |

## B1 `Document` 映射

### B1.1 `page_content` 的来源（2026-09-10 冻结）

**决定**：`page_content = model_content`（D3 冻结的模型可见正文，即 Evidence Context wrapper 内那段文本）。

**明确不做**：不二次切分、不去 Markdown 语法、不回到原始 Markdown 行范围。

**理由（本人给出）**：

- 与 D3 冻结的 Evidence Context 完全同源；进入 BM25 后只改变「哪些块被放进 wrapper」，不改变块内文本。
- 可直接验证：数量 = 572；逐块 `page_content` 与冻结 `model_content` 逐字节一致；`content_sha256` 可对齐。
- 不选原始 Markdown 行范围：会把未 normalization 的文本引入索引，与冻结模型可见内容产生两套文本口径。
- 不选「去 Markdown 语法」：会新增未冻结的文本变换规则，且破坏逐字节 / hash 可复现性。

**验证入口（待实现）**：映射后 `len(documents) == 572`，且逐块 `page_content` 与冻结 `model_content` 逐字节一致。

### B1.2 `metadata` 字段集合（2026-09-10 冻结）

**决定**：`metadata` 保存 6 个字段，全部来自冻结 registry，不新增语义：

| 字段 | 用途 |
|---|---|
| `source_id` | citation 身份；回查 registry 与 Evidence Context 的入口 |
| `content_sha256` | 内容指纹：去重、完整性核对、与冻结 hash 对齐 |
| `source_path` | 文档归属；诊断分组 |
| `line_start` / `line_end` | `source_span` 展平：R1 requirement 覆盖判定的位置计算、按位置排序 |
| `registry_index` | 冻结 registry 中的序号：分数并列时的确定性 tie-break，顺序本身是冻结证据 |

**本次同时确认的边界**：

- `context_spans` 不进 metadata：其内容已包含在 `model_content` 内，它只作来源证据，不参与索引。
- `score` 不进 metadata：属 retrieval result 的排序信息，由 B3 处理。
- `source_id` 只存一处：放 metadata，不另设 `Document.id`。

**验证入口（待实现）**：字段齐全；`len(documents) == 572`；`registry_index` 与 registry 数组下标一致。

### B1 完成判定（2026-09-10）

两个子问题（`page_content` 来源、`metadata` 字段集合）均已由本人冻结，B1 闭合。
## B2 中文 preprocessing

### B2.1 tokenization 方案（2026-09-10 冻结）

**决定**：中文连续字符切**相邻 bigram**；拉丁字母与数字按**非字母数字边界**切词。纯 Python 实现，无外部依赖。

**同一个 tokenizer 同时作用于 query 与 `page_content`**——否则打分不可比，检索无意义。

**理由（本人给出）**：与「冻结、可复现、无外部版本依赖」的整体纪律一致；不需要为一个会漂移的词典
（jieba + 词典版本）承担版本风险。

**框架事实（实测）**：`BM25Retriever` 的 `default_preprocessing_func` 按空白切分，对中文等于不切分
（`"一带一路 测试"` → `["一带一路", "测试"]`），因此必须通过 `preprocess_func` 自定义。

**边界**：tokenization 只影响**索引与查询的 token 序列**，不改变 `page_content` 字节
（B1.1 的逐字节等价约束继续成立）。

### B2.2 normalization 规则（2026-09-10 冻结）

**决定**：统一小写 + 全角转半角 + 所有非字母数字字符（含 `.` `/` `-` `_` `#` `:`）作词边界。

**边界**：normalization 只作用于 **token 序列**，不改动 `page_content`（B2.1 与 B1.1 的逐字节等价继续成立）。

**理由（本人给出）**：query 均为自然语言，切分让标识符片段（`hash`、`compare`、`l163`）可直接命中；
`L2`、`W13` 这类短编号在两种方案下都会成为独立 token，不受影响。

**未采用的方案**：整体标识符保留（召回低）；整体 + 部件双 token（索引膨胀、影响长度归一化）。

### B2 完成判定（2026-09-10）

tokenization 方案与 normalization 规则均已由本人冻结，B2 闭合。

## B3 ranking 与 context assembly

### B3.1 `top_k` 与并列处理（2026-09-10 冻结）

**决定**：`top_k = 10`；分数并列时按 `registry_index` 升序（冻结顺序）作确定性 tie-break。

**理由（本人给出）**：本批题最多 3 条 evidence requirement、跨文档题需覆盖 2 份文档；字符 bigram 的召回分布比词级
更散，需要一点冗余。预算不是约束（全语料 44,701 tokens vs 可用上限 895,904）。

**框架事实（实测源码）**：`BM25Retriever._get_relevant_documents` 调用
`self.vectorizer.get_top_n(self.preprocess_func(query), self.docs, n=self.k)`；返回的 Document **不含 score**，
分数需另外调用 `vectorizer.get_scores(...)` 取得。

### B3.2 context assembly 规则（2026-09-10 冻结）

**顺序决定**：retrieved blocks 按 **BM25 分数降序**进入 Evidence Context；分数并列时按 `registry_index` 升序。

**同时确认的规则**：

- 去重：按 `source_id` 去重（防御性；`BM25Retriever` 从唯一 `docs` 取 top-n，本身不重复）。
- 超预算：按分数从低到高裁剪至可用上限内，用冻结 tokenizer 计量，裁剪一旦发生即记录（预计不触发）。

**边界（必须写进阶段 5 结论）**：本方案的上下文顺序与 baseline（冻结 registry 顺序）不同，因此 BM25 与 baseline 的
对照差异同时包含「块集合」与「顺序」两项；若要单独隔离顺序因素，需另做一次把顺序改回 registry 顺序的对照。

### B3 完成判定（2026-09-10）

`top_k`、并列处理、去重、超预算与顺序均已由本人冻结，B3 闭合。

## B4 retrieval eval

### B4.1 命中定义与通过条件（2026-09-10 冻结）

**命中定义（交集口径）**：某条 `evidence_requirement` 被命中 = 至少一个 retrieved 块的 `source_span` 与该
requirement 的 `source_span` **有交集**（同一文档且行区间相交）；同时记录**覆盖行数与覆盖比例**作为诊断字段。

**item 通过条件**：该题**所有** `evidence_requirements` 都被命中。
**split 通过条件**：item 通过数 = 10/10。

**理由（本人给出）**：交集口径避开「块跨 span 边界即永不命中」的结构性死结，符合检索语义（把承载所需内容的块
带进来）；覆盖比例作为诊断，使「只带回片段」仍可见。

**已知结构性事实（本轮实测，须写入阶段 5 结论）**：requirement span 边界与冻结块边界不完全对齐——
`AGENTS.md#L101-L110` 覆盖 5 个块（L103、L105、L106、L107、L108），而承载「黑名单最高 L2」的
`AGENTS.md#L110-L111` 跨出该 span；`SHOWCASE-DEPLOY-PROTOCOL.md#L64-L90` 覆盖 16 个块。

### B4 完成判定（2026-09-10）

命中定义、item 通过条件与 split 通过条件均已由本人冻结。**B1–B4 全部冻结**，可进入 §3.4 实现阶段。

