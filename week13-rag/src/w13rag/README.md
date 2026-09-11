# w13rag 包导读（W13 RAG Foundations）

> 更新：2026-09-11。范围：`src/w13rag/` 的包入口与 11 个功能模块——输入处理 5 个、检索 4 个、生成与评估 2 个。
>
> 阅读顺序建议：
>
> 1. **先看 [§1 包结构](#1-包结构与依赖方向) 与 [§2 两条数据流](#2-两条数据流)**：建立全包地图，知道哪个模块在哪一段负责什么。
> 2. 需要检索 / 生成 / 评估的职责与取舍时，读 [`RAG 代码导读：从来源块到回答与评估`](../../notes/rag-implementation-guide.md)（含实际 LangChain 调用与当前限制）。
> 3. 需要输入处理（serialization）细节与 Python → TypeScript 对照时，读本文 [§3](#3-输入处理模块serialization-细节) 与 [§7](#7-python--typescript-概念映射)。
> 4. 需要跑命令或找入口时，读 [`scripts/README.md`](../../scripts/README.md)（每个脚本的用途、输入输出与安全边界）。
>
> 路径约定：模块短名均指当前目录 `src/w13rag/`；`corpus/`、`notes/`、`tests/`、`scripts/`、`evidence/`、
> `prompts/`、`config/` 均以 `week13-rag/` 为基准。本文命令统一从 `week13-rag/` 执行。
>
> 契约依据（按建立日期）：语料冻结 [`manifest.json`](../../corpus/rules-c0a4b85/manifest.json)（2026-09-07）；
> eval `w13-eval-v1`（2026-09-08）；serialization 单一规范
> [`day3-freeze-serialization-contract.md`](../../notes/day3-freeze-serialization-contract.md) §6.2.0（2026-09-09）；
> source block / registry 语义 [`day2-freeze-eval-contract.md`](../../notes/day2-freeze-eval-contract.md) §6.1（2026-09-08）。
> 判据 #1–#7 逐字见 [`serialization-criteria-confirm-checklist.md`](../../notes/serialization-criteria-confirm-checklist.md)（已确认）。

## 1. 包结构与依赖方向

| 层 | 模块 | 职责 | 主要输入 → 输出 |
|---|---|---|---|
| 入口 | [`__init__.py`](./__init__.py) | 包标记 + 一句说明 | — |
| 输入处理 | [`source.py`](./source.py) | 读取快照文档字节，建立行模型 | `snapshotPath` → `SourceDoc` |
| 输入处理 | [`serialize.py`](./serialize.py) | 行规范化、`model_content`、hash、wrapper、Evidence Context 纯函数 | `SourceDoc` + 行号 → `str` / hash |
| 输入处理 | [`parser.py`](./parser.py) | 确定性 Markdown 块切分 | `SourceDoc` → `list[BlockInfo]` + `code_lines` |
| 输入处理 | [`registry.py`](./registry.py) | 把 `BlockInfo` 变 registry entry；排序、查重、前置条件；拼整串 | `(doc, blocks, code_lines)` → entries / 整串 |
| 输入处理 | [`cli.py`](./cli.py) | 命令行入口 `build` / `verify`；逐文档审计；写证据文件 | `snapshot_root` → 证据文件 |
| 检索 | [`retrieval.py`](./retrieval.py) | BM25 词项检索、确定性排序、命中判定 | registry + query → `list[RetrievalHit]` |
| 检索 | [`retrieval_dense.py`](./retrieval_dense.py) | e5-small ONNX 向量化、向量缓存、相似度检索 | registry + query → `list[RetrievalHit]` |
| 检索 | [`retrieval_dense_langchain.py`](./retrieval_dense_langchain.py) | LangChain `Embeddings` adapter + 内存向量库接线 | `Document` 列表 → `list[RetrievalHit]` |
| 检索 | [`retrieval_hybrid.py`](./retrieval_hybrid.py) | RRF 排名融合（候选并集） | 两个 ranker 的 `RetrievalHit` → `list[RetrievalHit]` |
| 生成 | [`generation.py`](./generation.py) | 请求组装、模型客户端复用、响应解析与失败分层 | context + query → `RunRecord` |
| 评估 | [`scoring.py`](./scoring.py) | 运行事实 / 评估器结果 / 判定三层，机械检查与语义槽位 | `RunRecord` + registry → `ItemEvaluation` / split 状态 |

包内依赖方向（`A -> B` 表示 A 导入并依赖 B；检索四模块都复用 `RetrievalHit` 作为统一结果形状）：

```text
source.py                     -> （无包内依赖）
serialize.py                  -> source.py
parser.py                     -> source.py
registry.py                   -> parser.py, serialize.py, source.py
cli.py                        -> parser.py, registry.py, serialize.py, source.py
retrieval.py                  -> serialize.py（复用 wrapper 与整串规则）
retrieval_dense.py            -> retrieval.py（命中形状与判定）
retrieval_dense_langchain.py  -> retrieval.py, retrieval_dense.py（向量化实现）
retrieval_hybrid.py           -> retrieval.py
generation.py                 -> （无包内导入；导入上一阶段客户端包 src.clients 与 httpx / jsonschema）
scoring.py                    -> （无包内导入；自行定义七态常量，并读取冻结 registry 文件）
```

输入处理五模块是**纯确定性**的：不调用模型、不读 `eval/`，只处理字节与行号。检索四模块不调用生成模型，
只读冻结 registry 与 `eval/dev/`。**只有 `generation.py` 会发起模型请求**（经上一阶段客户端包发送）；
`scoring.py` 不发起任何请求，也不与包内模块互相导入——它只读运行记录与冻结 registry。

## 2. 两条数据流

### 2.1 构建链（确定性，可逐字节重现）

```text
manifest.json（documents 顺序 = registry 文档顺序）
  + 每份文档 documents/*.md
  → source.read_doc()                      → SourceDoc（lines=每行内容，has_lf=每行后是否有 LF）
  → parser.parse_blocks()                  → [BlockInfo] + code_lines(1-based 集合)
  → registry.entry_from_block()/build_entries()
       entry = {
         source_id,                        // rules/<path>#Lstart-Lend（只标核心行范围）
         source_span,                      // 与 source_id 行范围一致
         context_spans,                    // role ∈ {heading, table_header}
         model_content,                    // = serialize.build_model_content(...)
         content_sha256,                   // = serialize.content_sha256(model_content)
       }
  → registry.evidence_context_string()     // 每个 entry 经 wrapper 包裹后按序拼整串
  → cli.run()：两遍构建比对（byte-identical）+ audit + 写 4 个证据文件
```

产物 `registry-*.json` 与整串 `evidence-context-*.txt` 是后面两条链路的共同输入：全语料路径直接使用整串，
检索路径按命中结果从同一 registry 取回正文。

### 2.2 问答链（含一次模型调用）

```text
冻结 registry ─┬─ retrieval.retrieve() / dense / hybrid   → [RetrievalHit]（身份 + 排名 + 分数）
               │        → build_retrieval_context()        → 本次 Evidence Context（复用同一 wrapper）
               └─ evidence-context-*.txt（全语料路径）      → 同一 Evidence Context 位置
                                                          ↓
query ─────────────────────────────────────────→ generation.assemble_messages()（唯一组装入口）
                                                          ↓
                                          generation.run_item() → RunRecord（状态 / 原始响应 / usage）
                                                          ↓
                              scoring.evaluate_item()（机械检查 + 人工语义槽位）→ verdict 与 evidence JSON
```

两条输入路径的差别只在「哪些块进入 Context」：全语料路径跳过检索，检索路径按命中顺序组装。Prompt、
response schema、组件与判定函数完全相同，所以两者的结果可用于对照，但不能互相替代质量结论。

## 3. 输入处理模块（serialization 细节）

### 本节范围与两条约定

前面 §2.1 已给出构建链；本节其余部分逐模块说明实现细节与判据对应关系，供读码与 review 使用。

关键约定（处处要对得上契约，否则就是 bug）：

- **契约输出的行号全部 1-based，范围含两端**（2026-09-08 冻结的 source identifier）。`SourceDoc.lines` 和 parser 的扫描索引
  使用 0-based；parser 在产出 `BlockInfo` / `code_lines` 时转换为 1-based，`line k = lines[k-1]`。
- **hash 对象 = `model_content` 的 UTF-8 全字节**，不含 wrapper / 组装层 / 运行元数据。
- heading / table_header 只进 `context_spans`，**不扩大 `source_id` 的行范围**。
- `model_content` 字节决定 `content_sha256`；「内容变了 hash 变、位置变了 source_id 变」——身份与指纹分离。

### 各模块细节（`source` / `serialize` / `parser` / `registry` / `cli`）

#### `source.py` — 读取与行模型

```python
@dataclass(frozen=True)
class SourceDoc:
    corpus_id: str            # manifest.corpusId，如 "rules"
    source_path: str          # manifest.sourcePath，如 "AGENTS.md"
    snapshot_path: str        # manifest.snapshotPath，如 "documents/AGENTS.md"
    lines: tuple[str, ...]    # 每行内容（0-based 内部；对外行号 1-based）
    has_lf: tuple[bool, ...]  # 每行原文后面是否真有 LF
    # @property line_count  → len(lines)
    # line_text(line_no)    → lines[line_no - 1]  # 注意 -1
```

`read_doc()`：剥 BOM → decode UTF-8 → CRLF/CR 归一到 LF → `split("\n")`；
以 `\n` 结尾时 split 会多一个空串元素，`pop()` 掉；最后一行无 LF 时 `has_lf[-1]=False`。
这个「是否有 LF」信息用于让 hash 精确到字节（D3 判据 #2 的末尾 LF 规则）。

`frozen=True`：实例不可变，保证后续 hash/比对的基础输入不会被意外改动。
这是装饰器，不是继承。

#### `serialize.py` — 确定性纯函数（不读文件、不依赖 parser）

| 函数 | 作用 |
|---|---|
| `normalize_plain_line(raw)` | 普通行规范化：单个行尾空格或含 tab 的尾随空白删除；纯空格尾缀 ≥2 时规范为恰 2 个空格（hard break）；行首缩进原样 |
| `build_model_content(doc, *, headings, headers, core_start, core_end, code_lines=(), quote=False)` | 按 外→内标题→表头→核心行 拼一个 block 的模型正文；code/quote 行逐字保真 |
| `content_sha256(model_content)` | `sha256(model_content.encode("utf-8")).hexdigest()` |
| `serialize_source_block(source_id, model_content)` | 精确 wrapper 字节（开标签+LF+正文+`</source>`） |
| `assemble_evidence_context(serialized_blocks)` | 块间恰一个空行连接，首尾无空行；空输入输出空串 |

#### `parser.py` — 确定性 Markdown 结构分类与 block 边界

- 正则一行一个块类型：`_MARK_RE`(列表项) / `_HEADING_RE`(标题) / `_HR_RE`(thematic break) /
  `_DELIM_RE`(表格分隔行) / `_ROWLIKE_RE`(表格行)。
- `_code_ranges`/`_code_set`：先扫出 fenced code 配对区间，代码行整段逐字、不参与普通扫描。
- `_indent`/`_heading_level`/`_trim_trailing_blanks`/`_strip_quote`：小工具。
- `_list_island`：列表岛切分，顶层项含嵌套；返回 `(items, stop)`，`stop` 不消费、交回主循环。
- `parse_blocks(doc)`：主函数。维护 `head_stack`（当前小节标题链），逐行分派到
  代码（可并入紧邻前置段）/标题/`---`/`>` 引文/表格/列表/段落。
- `_mini_scan_inner` + `_parse_quote_region`：剥除一层 `>` 后，用内部 scanner 处理段落、顶层列表和 fenced code，
  再映射回原文行号并产出 `quote_*` 类型、`quote=True`（`model_content` 保留原文 `>`）。这里没有递归调用
  `parse_blocks` 或 `_parse_quote_region`；冻结语料也没有嵌套 `>>` 或引文内表格。

#### `registry.py` — entry 语义与组装

`WRAPPER_FORBIDDEN = ("<source", "</source>")`：正文不得含字面 `<source`（前缀守卫，不带 `>`，
同时拦截 `<source>` 与 `<source id=…>`）或 `</source>`，违反则构建失败。
`build_entries` 按 manifest 文档顺序 → 文档内 core 行号排序；重复 `source_id` 抛错。

#### `cli.py` — 入口 / 审计 / 证据

- `build_once`：manifest 顺序逐文档 `read_doc → parse_blocks`，再 `build_entries` + 整串。
- `audit_document`：算每行是否被 core 覆盖、是否重复；排除结构性行（空行/标题/`---`/表头分隔行）。
- `run`（build 子命令）：`_two_pass` 两遍构建比对 `byte-identical`，写 4 个文件：
  registry JSON / evidence-context txt / .sha256 / criteria-report md。
- `cmd_verify`：内存重建并执行覆盖审计；比较 fresh Evidence Context 与磁盘上的
  `evidence-context-*.txt`，以及可选冻结基准。它不比较 registry JSON、生成的 `.sha256` 文件或
  criteria report；已比较对象不一致时 FAIL 并以非零退出码结束。
- `_line_class_is_structural`：审计里判定结构性行（与 parser 的分类保持一致）。

## 4. 检索模块

四个检索模块共享同一结果形状 `RetrievalHit`（来源身份、排名、分数），因此可以互相对照、也可以互换接入
`build_retrieval_context()`。它们都不调用生成模型，只读冻结 registry 与 `eval/dev/`。

### `retrieval.py` — BM25（默认端到端检索路径）

| 冻结设计点 | 实现 |
|---|---|
| `page_content` | registry 的 `model_content`（与模型可见正文逐字节同源） |
| metadata | `source_id` / `content_sha256` / `source_path` / `line_start` / `line_end` / `registry_index` |
| 分词 | 中文连续字符切相邻 bigram；拉丁字母与数字按非字母数字边界切词 |
| 规范化 | NFKC（含全角转半角）+ 小写；非字母数字字符作词边界 |
| 排序 | 分数降序；**并列按 `registry_index` 升序**；按 `source_id` 去重 |
| `top_k` | 默认 10，评估时另跑 20 / 30 |
| 预算 | 超预算只报告，不在本模块裁剪（组装函数当前也未实现裁剪） |
| 命中判定 | retrieved 块与 requirement span **有交集**即命中，同时记录覆盖行数与比例 |

为什么自己排序而不是直接用 `BM25Retriever.get_top_n`：`rank_bm25` 不保证并列顺序稳定，而约定要求
「并列按 `registry_index` 升序」的可复现规则。因此仍用 `BM25Retriever` 装载 `docs` 与 `vectorizer`
（保留框架接线），取分与排序由本模块显式完成。

主要符号：`tokenize` / `load_registry` / `to_documents` / `build_retriever` / `retrieve` /
`build_retrieval_context` / `requirement_recall` / `evaluate_item_retrieval`。后两个是检索评分的公共实现，
dense 与 hybrid 直接复用，不各自另立门禁。

### `retrieval_dense.py` — e5-small ONNX 向量检索

- 模型与运行时：`intfloat/multilingual-e5-small` + `onnxruntime`，fp32 ONNX，`CPUExecutionProvider`。
- 文本处理：`query: ` / `passage: ` 前缀；最大长度 512（超长截断并记录）；mean pooling（按 attention mask 加权）；L2 归一化。
- 相似度：归一化内积（等价 cosine）；`top_k` 默认 10，另跑 20 / 30 曲线。
- 缓存：`build_corpus_embeddings()` 落盘全语料 572 个向量；缓存身份包含模型 / tokenizer / 最大长度 / 池化 /
  归一化 / 块数，身份不一致即重算。
- **已知限制**：缓存身份不含语料内容 hash，也不含 entry 顺序。同块数换内容或重排语料时缓存不会自动失效，
  当前依赖「语料快照不变」这一前提。

### `retrieval_dense_langchain.py` — LangChain 接线

- 自定义 `Embeddings` adapter 承担向量化（前缀在 adapter 内部），`InMemoryVectorStore` 承担向量存储与相似度检索，
  存储键使用冻结 `source_id`。
- 排序、并列顺序与 `RetrievalHit` 映射仍留在项目层：框架返回的并列顺序不满足 `registry_index` 规则。
- 旧的 `dense_retrieve` 路径保留作等价性参照；`scripts/verify-dense-langchain-equiv.py` 核对两条路径在 dev 查询上的
  top-10 顺序与集合是否一致（记录到分数最大绝对差），并核对冻结对象 hash 未变。

### `retrieval_hybrid.py` — RRF 排名融合

- 固定参数：`RRF_K = 60`，每个 ranker 各取 50 个候选，融合后取 `top_k`。
- 两个候选列表**取并集**：只有两个池都未召回时才会缺失；单个 ranker 的 miss 不会直接丢掉该块。
- 定位：计划外扩展项。融合未通过门禁时如实记录为「扩展项未达标」，不继续叠加新方法。

## 5. 生成与评估模块

### `generation.py` — 请求组装、客户端复用与失败分层

- **Prompt**：默认 `prompts/rag-prompt-v1.md`（已置 frozen）。`v0` / `v1` / `v2` 全部保留可追溯；
  `W13_PROMPT_PATH` 可指向任一版本复现对应证据。`v2` 实测未达成目标并已回滚为默认之外的版本。
- **生成配置**：[`config/model-policy-v1.md`](../../config/model-policy-v1.md)——模型、`thinking`、`max_tokens`、
  `response_format` 四项都冻结在同一份策略文件里；请求别名与实际服务身份分别记录。
- **唯一组装入口**：`assemble_messages()`。计量用的输入与实际发送的输入走同一个函数，避免两者漂移。
- **失败分层**：`status` 为 `ok` 加六类错误（`empty_content` / `json_error` / `schema_error` /
  `http_error` / `timeout_error` / `transport_error`）。`status=ok` 只表示本次响应通过了解析与结构校验。
- 边界：只读 `eval/dev/`；不读 holdout；不修改冻结的 Prompt、Evidence Context 与配置；当前策略为不重试。

### `scoring.py` — 运行事实 / 评估器结果 / 判定

三层各自独立，互不覆盖：

1. **`run`（运行事实）**：一次调用实际发生了什么。`status` 沿用 `generation` 的七态；`retryable` 是失败分类字段，
   为后续 harness 接口准备。当前冻结策略是 `no-retry`，该字段不代表本次会自动重试。
2. **`evaluators`（评估器结果）**：每个评估器独立产出 `key` / `applies` / `skip_reason` / `passed` / `score` / `comment`。
   `applies=False` 表示本次没有可评对象（例如结构失败时没有可判定的结论）；`passed=None` 表示有可评对象但尚未判定
   （人工语义清单未填）。
3. **`verdict`（判定）**：由单一函数按契约的**合取**得出。判定规则只存在于 [`eval/scoring-contract.md`](../../eval/scoring-contract.md)
   与该函数内；入口文件与工作表不得重述规则，`eval/scripts/verify-decision-entry.mjs` 守住这一点。
   阈值常量集中在模块顶部：`DEV_MIN_PASS = 9`、`PER_CLASS_MIN_PASS = 1`、`CITATION_PRECISION_THRESHOLD = 1.0`。

判定未完成时 `Verdict.result is None`，`pending` 列出待判定的评估器。这**不是第三种通过状态**：契约规定的是通过
条件，未完成即不能宣布通过，也不等于失败。边界：不调用模型、不读 holdout、不修改任何冻结对象。

## 6. 周边文件与验证命令

| 文件 | 作用 |
|---|---|
| [`tests/conftest.py`](../../tests/conftest.py) | 把 `src` 加入 `sys.path`（week13 未安装为包，pytest 靠它 import） |
| [`tests/test_fixture_serialization.py`](../../tests/test_fixture_serialization.py) | fixture A/B/C/D 的 `model_content` / hash / wrapper / 整串字节回归 |
| [`tests/test_registry_real.py`](../../tests/test_registry_real.py) | 真实语料不变式：无遗漏/重复、双跑一致、hash 复算、wrapper 前置条件 |
| [`tests/test_parser_segmentation.py`](../../tests/test_parser_segmentation.py) | parser 块切分与行号归属 |
| [`tests/test_retrieval.py`](../../tests/test_retrieval.py) | BM25 分词、排序、并列、去重与命中判定 |
| [`tests/test_retrieval_hybrid.py`](../../tests/test_retrieval_hybrid.py) | RRF 融合的候选并集与排名 |
| [`tests/test_retrieval_dense_langchain.py`](../../tests/test_retrieval_dense_langchain.py) | LangChain 接线的 adapter、存储键与命中映射 |
| [`tests/test_generation_payload.py`](../../tests/test_generation_payload.py) | 消息组装、输入计量与响应检查的纯函数部分 |
| [`tests/test_scoring.py`](../../tests/test_scoring.py) | 机械评估器与判定合取语义 |
| [`scripts/README.md`](../../scripts/README.md) | **运维入口导读**：每个脚本的用途、输入输出、是否调用模型、安全边界 |
| [`scripts/w13rag.sh`](../../scripts/w13rag.sh) | CLI：`test` / `build` / `check` / `verify` / `guard` |
| [`scripts/inspect-block.sh`](../../scripts/inspect-block.sh) | 打印单个 registry entry（review 用） |
| [`prompts/`](../../prompts/) | Prompt 版本文件（`v0` / `v1` / `v2`，默认 `v1`，已置 frozen） |
| [`config/model-policy-v1.md`](../../config/model-policy-v1.md) | 生成配置与模型策略（请求参数、思考模式、输出上限） |
| [`schemas/`](../../schemas/) | response schema 与输入侧约束 |
| [`eval/`](../../eval/) | 冻结判分契约、口径记录与 dev / holdout 题集（holdout 受保护） |
| [`evidence/serialization/`](../../evidence/serialization/) | 产物：registry JSON、整串 txt、sha256、criteria-report、`frozen-*.sha256` 冻结基准 |
| `.cache/`（不入库） | e5 ONNX 模型与向量缓存；缓存身份校验代码在 `retrieval_dense.py` |

运行：

```bash
./scripts/w13rag.sh test                          # pytest：输入处理回归 + 真实语料不变式 + 检索/评分
./scripts/w13rag.sh build                         # 构建 registry / Evidence Context + 证据落盘
FROZEN_SHA256=evidence/serialization/frozen-rules-c0a4b85.sha256 \
  ./scripts/w13rag.sh verify                      # fresh vs on-disk Evidence Context vs 冻结基准
./scripts/w13rag.sh guard                         # 判定入口必须引用契约，且不得重述判定规则
./scripts/inspect-block.sh rules/AGENTS.md#L47-L58  # 查单个 block
```

`tests` 走 `conftest.py` 调包内函数；`scripts/w13rag.sh` 分别提供测试、构建、冻结基准验证与 guard 入口。
其中 build/verify 调用 `python -m w13rag.cli` 并注入 `PYTHONPATH=src`；它不是 generation runner。

**其它入口**（检索评估、端到端、holdout、展示回放、人工判定素材）不在本节全部展开：
每个脚本的用途、输入输出、是否调用模型、会写哪些证据文件与安全边界见 [`scripts/README.md`](../../scripts/README.md)。
其中 `run-holdout-eval.py` 是唯一允许读取受保护 `eval/holdout/` 的通道，且终端不回显题面。

## 7. Python → TypeScript 概念映射

本节服务「从 TS 背景读 Python」，示例来自输入处理层；检索 / 生成 / 评估层使用同样的语言规则，只是数据结构不同。

### 7.1 语言/库对照表

| Python | TypeScript | 备注 |
|---|---|---|
| 一个 `.py` 模块 | 一个 ESM 文件 | 依赖方向保持一致 |
| `from .source import SourceDoc` | `import { SourceDoc } from './source.ts'` | — |
| `@dataclass`（生成构造/比较） | `interface`（纯形状）或手写 class | 只读数据用 interface |
| `@dataclass(frozen=True)` | `interface` 全字段 `readonly`；需要运行时约束时使用 `Object.freeze` | `readonly` 只在编译期生效；`Object.freeze` 是浅冻结 |
| `field(default_factory=list)` | 构造时 `this.x = []`；不用模块级共享数组 | Python 可变默认值坑 → TS 是每实例引用 |
| `@property` | class 的 `get x()` | — |
| `tuple[str, ...]` / `tuple[int,int]` | `readonly string[]` / `readonly [number, number]` | tuple 有限长可用元组类型 |
| `list[str]` / `dict` | `string[]` / `interface` 或 `Record<string,…>` | registry entry 应写 interface |
| `set[int]` | `Set<number>` | 只做存在性检查，不依赖顺序 |
| `str.replace/split/startswith` | `string.replace/split/startsWith` | — |
| `re.compile(r"…").match(s)` | `new RegExp("…").exec(s)` 或 `s.match(re)` | `^` 锚点行为一致；注意 g 标志与 lastIndex |
| `pathlib.Path` | `node:path`（join/resolve）+ `node:fs` | `Path / "x"` → `path.join(p, 'x')` |
| `raw.decode("utf-8")` / `.encode()` | `Buffer.from(bytes).toString('utf8')` / `Buffer.from(str,'utf8')` | BOM 剥除同理 |
| `hashlib.sha256(x).hexdigest()` | `crypto.createHash('sha256').update(x, 'utf8').digest('hex')` | 也可显式传 `Buffer.from(x, 'utf8')`；关键是 UTF-8 字节一致 |
| `json.loads / json.dumps` | `JSON.parse / JSON.stringify` | 键序：stringify 按插入序，需固定 |
| `argparse` subparsers | commander/yargs 或手写 `process.argv` | 本项目可用 commander |
| 对外 1-based 行号 | 无内建支持，靠命名与注释约定 | 数组/扫描索引仍为 0-based；在 parser 输出边界转换 |
| `int \| None` | `number \| null` | — |

### 7.2 各模块的 TS 关键形状（签名级示意，非完整实现）

```ts
// source.ts
export interface SourceDoc {
  readonly corpusId: string;
  readonly sourcePath: string;
  readonly snapshotPath: string;
  readonly lines: readonly string[];      // 0-based internal；public 行号 1-based
  readonly hasLf: readonly boolean[];     // lines[i] 后是否带 LF
  readonly lineCount: number;             // getter
  lineText(lineNo: number): string;       // lines[lineNo - 1]
}
export function readDoc(snapshotRoot: string, corpusId: string,
                        sourcePath: string, snapshotPath: string): SourceDoc;
```

```ts
// serialize.ts
export function normalizePlainLine(raw: string): string;
export interface BuildContentOptions {
  headings: readonly number[];
  headers: readonly number[];
  coreStart: number;             // 1-based inclusive
  coreEnd: number;
  codeLines?: ReadonlySet<number>;
  quote?: boolean;
}
export function buildModelContent(doc: SourceDoc, o: BuildContentOptions): string;
export function contentSha256(modelContent: string): string;   // crypto sha256 hex
export function serializeSourceBlock(sourceId: string, modelContent: string): string;
export function assembleEvidenceContext(serializedBlocks: readonly string[]): string;
```

```ts
// parser.ts
export type BlockKind =
  | 'paragraph' | 'list_item' | 'code' | 'table_row'
  | 'quote_para' | 'quote_list' | 'quote_code';
export interface BlockInfo {
  kind: BlockKind;
  coreStart: number;  coreEnd: number;        // 1-based inclusive
  headings: number[];                          // outer -> inner
  headers: number[];
  codeSpans: Array<readonly [number, number]>;
  quote: boolean;
}
export function parseBlocks(doc: SourceDoc): { blocks: BlockInfo[]; codeLines: Set<number> };
// 逐条迁移并用相同 fixture 验证：_MARK_RE / _HEADING_RE / _HR_RE / _DELIM_RE / _ROWLIKE_RE
```

```ts
// registry.ts
export type ContextRole = 'heading' | 'table_header';
export interface ContextSpan { sourcePath: string; lineStart: number; lineEnd: number; role: ContextRole; }
export interface RegistryEntry {
  sourceId: string;                            // rules/<path>#Lstart-Lend
  sourceSpan: { sourcePath: string; lineStart: number; lineEnd: number };
  contextSpans: ContextSpan[];
  modelContent: string;
  contentSha256: string;
}
export const WRAPPER_FORBIDDEN = ['<source', '</source>'] as const;
export function buildEntries(
  docsBlocks: Array<[SourceDoc, BlockInfo[], Set<number>]>
): RegistryEntry[];
export function evidenceContextString(entries: RegistryEntry[]): string;
```

```ts
// cli.ts（示意）
export function buildOnce(snapshotRoot: string):
  { docsBlocks: Array<[SourceDoc, BlockInfo[], Set<number>]>; entries: RegistryEntry[];
    context: string; audits: Record<string, Audit>; };
export function runBuild(snapshotRoot: string, outDir: string): Summary;   // 两遍比对 + 写文件
export function verify(snapshotRoot: string, outDir: string,
                       frozenSha256?: string): void;                        // 不一致 process.exit(1)
```

### 7.3 翻译到 TS 时要额外小心的事

1. **确定性 / 键序**：当前 `content_sha256` 只计算 `model_content` 的 UTF-8 字节，不计算 registry JSON。
   TS 迁移时不要改成对整个 entry 做 `JSON.stringify` 后计算内容 hash；若要逐字节比较 registry JSON，需另行
   固定字段构造和序列化格式。
2. **正则语义**：Python `re.match` 从头匹配、无 `g` 状态；JS `RegExp.exec` 若带 `g` 会共享
   `lastIndex`，容易出隐式 bug——用无 `g` 正则或每次新建。
3. **1-based 行号**：TS 数组和 parser 扫描索引保持 0-based；在构造 `BlockInfo` 与 `codeLines` 的输出边界统一
   转换为 1-based。registry 只接收 1-based span，不再二次换算。
4. **不可变**：`readonly` 只提供编译期约束，`Object.freeze` 只做浅冻结。若需要匹配 `SourceDoc` 中 tuple 的
   运行时不可变性，还要冻结或复制嵌套数组；也可以明确采用只读约定并用测试守住输入不被修改。
5. **Buffer vs string**：hash 前必须保证 utf-8 字节一致（Python `str.encode('utf-8')` ↔
   TS `Buffer.from(str, 'utf8')`），换行统一 LF 后再算。

## 8. 当前限制与边界

本节列出写文档时必须一起交代的前提；这些限制不因文档更新而消失。

- **预算裁剪未实现**：`build_retrieval_context()` 只按命中顺序拼接，没有按 token 预算计量或裁剪的分支。
  当前输入未触发预算压力，但这不代表该能力已具备或已验证。
- **dense 缓存身份不含语料内容**：缓存身份包含模型 / tokenizer / 长度 / 池化 / 归一化 / 块数，不含语料内容 hash
  或 entry 顺序；同块数换内容或重排语料时缓存不会自动失效。当前依赖「语料快照不变」这一前提。
- **机械引用可解析率 ≠ 原文支持率**：`scoring.py` 的 `citation_precision` 只计算 identifier 能否解析到冻结 span；
  原文是否支持结论属于人工判定，两者不能互相替代。
- **语料规模与代表性**：7 份文档、572 个 source block、单一领域。结论只在这次语料与配置内成立，不外推到生产
  规模或多领域。
- **框架使用范围**：LangChain 已承接 `Document`、`BM25Retriever`，以及 dense 的 `Embeddings` 与内存向量库；
  生成仍走直接调用路径，未使用 LCEL；LangGraph 的 state、条件边与持久化均未实施。
- **本地模型来源**：e5-small 模型文件来自社区镜像，未与官方 hash 交叉验证；功能验证通过不等同于来源真实性证明。
- **holdout 边界**：`eval/holdout/` 属受保护内容。只有 [`scripts/run-holdout-eval.py`](../../scripts/run-holdout-eval.py)
  允许读取，且终端不回显题面；其它工具、脚本与文档不得直接读取、搜索或输出其内容。
- **文档更新口径**：本文描述当前实现状态。冻结契约、判分阈值与历史证据的变更走新版本，不在本文就地改写历史结论；
  代码变更后应先核对本文与 [`notes/rag-implementation-guide.md`](../../notes/rag-implementation-guide.md) 的对应段落。
