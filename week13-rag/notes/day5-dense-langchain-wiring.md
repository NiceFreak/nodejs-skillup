# W13 D5：LangChain dense 接线与 dense 端到端链路（计划内主线）

> 日期：2026-09-11（Asia/Shanghai）。触发：本人在 D5 明确「demo 演练自己来、不还债，先做本周规划内尚未完成的主线学习」。
> 设计点冻结与验证证据汇总见 [dense-langchain-wiring-freeze.md](./dense-langchain-wiring-freeze.md)；本文记录过程、决策依据与边界。
> 协作模式：AI Engineer 分阶段的实现方模式——术语与候选由 AI 讲解、取舍与运行口径由本人冻结、实现与自测由 AI 交付。
> 与同日 [demo 笔记](./day5-demo-and-wrapup.md) 是两件独立的事：本文不填本人演练记录，demo 笔记不承担接线结论。

## 1. 今日目标与计划变化

- 目标：完成周计划 §10 未勾选项「LangChain dense 接线」与「dense 端到端 generation」。
- 计划变化：D5 原主线是本人执行的 demo 演练；本次主线学习由本人在同日指定插入，演练安排与 §6 记录表不变。
- 明确不做：不还 `DEBT.md` 2026-09-10 的条目（保持未还）；不新增向量数据库依赖（faiss / chromadb）；generation 不接 ChatModel / LCEL；不新增 LangChain 路径的 retrieval-only 证据文件。

## 2. 概念与职责（实现前的 L1 讲解要点）

| 术语 | 职责 | 在本链路中的位置 |
|---|---|---|
| `Embeddings` | 只做「文本 → 向量」，查询与文档两个入口 | `E5Embeddings.embed_documents` / `embed_query` |
| `VectorStore` | 存向量 + 按向量找近邻 | `InMemoryVectorStore.add_documents` / `similarity_search_with_score` |
| `Retriever` / `Document` | 「query → list[Document]」的统一取数抽象与公共数据单位 | BM25 路径的 `BM25Retriever`；本链路用 `Document` 承载 B1 映射 |

框架不承担的部分（仍属项目契约）：切块、来源身份、排序与并列规则、Evidence Context 组装、通过标准。

## 3. 本人冻结的语义

| 编号 | 冻结内容 | 依据 |
|---|---|---|
| D-A | adapter 做向量化 + `InMemoryVectorStore` 承担存储与检索；排序与 `RetrievalHit` 映射留在项目层；旧 `dense_retrieve` 保留作等价性参照 | 本周生态修订要求用 LangChain 完成固定 RAG；`BM25Retriever` 装载 + 项目显式排序已是既有模式 |
| D-B | `passage: ` / `query: ` 前缀位于 adapter 内部，`to_documents()` 原样复用 | 保持单一 `Document` 表示与 572 条 `page_content == model_content` 断言 |
| D-C | 未命中即失败；identity 不一致也即失败，不静默重算、不覆盖 `.npy` | 让「向量来源唯一」成为被强制的不变量，而不是意图 |
| D-D | 向量库存储键 = 冻结 `source_id`，并加唯一性断言 | 框架键与冻结 citation 身份显式绑定；`add_documents` 对重复键会静默覆盖 |
| D-F | F1–F8 + 回归进 `pytest`；F9/F10/F12 进 `verify-dense-langchain-equiv.py` | 保持测试套件的确定性、无 ONNX 特性（原 71 项 0.65s） |
| D-E | 授权执行 dense e2e（链路证据、不作质量验收）；不新增 retrieval-only 证据 | 计划 §3.4 的门禁例外需明确授权；等价性已由 F9 覆盖，重复落盘无新信息 |

F10 判据在实测后修正为「分数差超过 `1e-6` 的相邻对顺序必须一致；阈值内视为不可分辨的并列」，门禁仍是 top-10 严格一致。

## 4. 实现

| 文件 | 内容 |
|---|---|
| [`src/w13rag/retrieval_dense_langchain.py`](../src/w13rag/retrieval_dense_langchain.py) | `E5Embeddings`、`load_cached_matrix()`、`assert_unique_source_ids()`、`build_dense_store()`、`dense_retrieve_langchain()` |
| [`tests/test_retrieval_dense_langchain.py`](../tests/test_retrieval_dense_langchain.py) | F1–F8 的 10 项确定性断言 |
| [`scripts/verify-dense-langchain-equiv.py`](../scripts/verify-dense-langchain-equiv.py) | F9 / F10 / F12 |
| [`scripts/run-dense-langchain-e2e.py`](../scripts/run-dense-langchain-e2e.py) | dense e2e 运行器，镜像 `run-bm25-e2e.py` |

`run-bm25-e2e.py`、`retrieval_dense.py` 与所有冻结对象未改动。

## 5. 错误现象与根因

1. **F10 原判据（572 全排序完全一致）不可达**。现象：`cross-document-01` 第 110 名与 `priority-conflict-exception-02` 第 527 名顺序不同。根因：NumPy 路径在该处**分数精确相等**（差 0.00e+00，走 `registry_index` 并列规则），LangChain 的 float64 余弦把它们分成 4.31e-08 / 1.53e-08 的不等值，于是「并列」不再成立。处理：判据修正为可分辨范围内一致，脚本记录位置与差值；top-10 判据不受影响。
2. **「float32 量化框架分数即可复现并列」这一假设被实测否证**：`rules/TECHNICAL-WRITING-PROTOCOL.md#L110-L110` 的 f32(f64) 为 0.8454833627，NumPy 路径为 0.8454833031。两条路径表达式不同（float32 单位向量点积 vs float64 点积除以重算范数），量化一侧无法还原另一侧。
3. **三个 pytest 失败来自测试 fixture，不是实现**：F6/F7/F8 调 `build_dense_store` 时未注入合成 identity，于是拿合成缓存去比真实模型 identity，被 D-C a2 正确拦下。修正 fixture 后 81 项全通过——这条同时说明 a2 的门槛真的会触发。

## 6. 验证证据

```bash
# 确定性断言：本次 81 passed（原有 71 + 新增 10），耗时 2.39s
week13-rag/.venv/bin/python -B -m pytest week13-rag/tests -q -p no:cacheprovider

# F9 / F10 / F12：10/10 order=True set=True；near_tie_queries=2；max_score_diff=7.31e-08；冻结对象 14 个未变
week13-rag/.venv/bin/python -B week13-rag/scripts/verify-dense-langchain-equiv.py

# dense e2e：10 条真实调用（需 .env 凭据），输出 evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json
week13-rag/.venv/bin/python -B week13-rag/scripts/run-dense-langchain-e2e.py --k 10
```

| 项 | dense（LangChain 接线） | BM25（D4 记录，同 10 题） |
|---|---|---|
| status | 9 `ok` + 1 `schema_error` | 10 `ok` |
| 机械通过 | 7/10 | 8/10 |
| context 字符数 | 1,195–1,654 | 1,332–2,020 |
| `prompt_tokens` 合计 | 11,756 | 12,723 |
| `citation_precision_min` / `split_status` | 1.0 / `fail` | 1.0 / `fail` |

**事实**：以上三组命令的输出；向量库装载 0.895s / 572 键；接线与 `dense_retrieve` 的 top-10 完全一致。

**推断（待验证）**：本次出现的 1 条 `schema_error` 与 BM25 那次的 10/10 `ok` 之差，可能属于运行间波动或输入差异；没有重复运行，不能归因。

**待验证**：dense e2e 的人工语义判定；跨运行稳定性；`context assembly` 的 B3 超预算裁剪仍未实现（现有输入未触发预算压力）。

## 7. 已完成 / 未完成

- 已完成：周计划 §10 的两项未勾选项；D-A…D-E 冻结与执行；6 个新文件（1 模块、1 测试、2 脚本、1 冻结记录、1 本笔记）。
- 未完成：本人掌握验收（成功路径、两个失败路径、变更影响范围）；demo 演练与分享记录；BM25 e2e 与 dense e2e 的人工语义判定；`DEBT.md` 2026-09-10 条目仍未还。

## 8. 下一入口

1. 本人按 [demo 笔记 §2](./day5-demo-and-wrapup.md) 执行演练并填写 §6 记录表。
2. **材料事实同步（需要本人决定是否在分享前改）**：[主讲稿](./day5-demo-script.md) 的 `10:00–13:00` 框架段、[追问附录](./day5-demo-qa.md)、[RAG 代码导读](./rag-implementation-guide.md) 与展板 `rag-framework` 页目前仍把 dense 描述为「直接 ONNX/NumPy、尚未接入 LangChain `Embeddings` / `VectorStore`」。接线完成后这些表述已过期，按 `TECHNICAL-WRITING-PROTOCOL.md` §2.4 需要补实际结果。
3. 人工语义判定（BM25 e2e 与 dense e2e 各自的 dev 响应）。
4. `DEBT.md` 2026-09-10 的 eval 合取判定第一档重建（本人执行，AI 只出题验收）。
5. 日终流程：口语稿、日日报与状态文件收口。

## 9. 语义判定素材与机械预筛（2026-09-11）

为降低本人判定成本，本轮新增 `scripts/prescreen-r1-coverage.py`：它只做程序职责范围内的事——citation
可解析性、与本次 context 的成员关系、R1 ② 的包含性（citation 行范围是否完整落在 requirement span 内）。
判定素材由 `build-semantic-worksheet.py` 生成。**预筛不给出「通过 / 不通过」，结论仍由本人填写。**

| 运行 | span requirement | 按 R1 ② 机械确定未覆盖 | advisory（无答案题，契约 §1） | 仍需本人判 claim 支持的题 | 待判 claim |
|---|---|---|---|---|---|
| BM25 e2e | 16 | 7 | 1 | 4（`direct-answer-02`、`cross-document-01`、`cross-document-02`、`paraphrase-02`）+ 2 题只判 reason text | 18 |
| dense e2e | 16 | 12 | 1 | 1（`direct-answer-02`）+ 2 题只判 reason text | 5 |

产物：

- `notes/dev-prescreen-bm25-e2e.md`、`notes/dev-prescreen-dense-e2e.md`
- `notes/dev-semantic-checklist-bm25-e2e.md`、`notes/dev-semantic-checklist-dense-e2e.md`

**交叉核对（预筛能触发目标机制的证据）**：`w13-dev-direct-answer-01` 的 citation `rules/AGENTS.md#L71-L76`
相对 requirement `AGENTS.md#L66-L72` 越界，与 [D4 人工诊断](./day4-full-context-baseline-and-bm25.md) 记录的
失败形态一致（同一类越界引用）。这说明预筛复现了人工判定的失败类别，不是无用指标。

**边界**：预筛没有自动化测试（仓库惯例不为 `scripts/` 加测试）；它只做机械判定，不替代本人的语义判定；
BM25 的 2 题与 dense 的 5 题里已机械确定失败的条目仍按契约只作归因材料。

## 10. BM25 / dense 人工语义判定与运行有效性复核（2026-09-11）

判定结论**由本人给出，AI 只做回填与状态同步**（与 D4 同）。判定素材与机械预筛：

- `notes/dev-semantic-checklist-bm25-e2e.md`、`notes/dev-semantic-checklist-dense-e2e.md`
- `notes/dev-prescreen-bm25-e2e.md`、`notes/dev-prescreen-dense-e2e.md`

**结果**：按 R1 口径 BM25 与 dense 各通过 **3/10**；两轮 §6.4 `item_pass_rate` 与 §6.5 per-class 不满足，
§6.2 与 §6.3 满足 → 两次运行都不能通过（且都是本人授权的链路演示例外，只作链路证据）。两轮均通过仓库的判定入口守门
（`eval/scripts/verify-decision-entry.mjs`，工作表只引用契约、不重述规则）。

**§6.1 运行有效性复核（AI 执行）**

| §7 条件 | 结果 |
|---|---|
| hash 与冻结一致 | 两轮的 response schema sha256、corpus manifest sha256、prompt system-instructions sha256 全部一致；prompt 版本 `w13-rag-prompt-v1` |
| 10 个 item ID 各有一次可归属结果 | 10/10（两轮） |
| 未读 holdout | 两轮 itemId 均为 `w13-dev-*`；`load_dev_items()` 对非 dev split 抛错 |
| 实际 context 可复核 | 按记录的 top-k 重建 hits → `build_retrieval_context()`，sha256 与字符数 **10/10 复现**（BM25、dense 各一轮） |
| 运行后未新增/修改评分规则 | R1 冻结于 2026-09-10，早于两轮运行（`createdAt`：2026-09-11 00:49 / 11:12） |

**边界**：运行证据 JSON 不回调，其 `verdict` 保持运行当时状态（BM25 `0 passed / 2 failed / 8 pending`，dense `0 / 3 / 7`）；
工作表里的 3/10 是本次人工判定的结论。两次判定的失败形态同类：引用落在相关但不同的行上
（详见两份素材 §11 的观察记录），仍不是单因素实验，不能宣布根因已隔离。
