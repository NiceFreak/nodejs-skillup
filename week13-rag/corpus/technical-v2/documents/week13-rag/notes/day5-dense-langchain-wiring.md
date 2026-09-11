# W13 D5：LangChain dense 接线与 dense 端到端链路（计划内主线）

> 日期：2026-09-11（Asia/Shanghai）。触发：本人在 D5 明确「demo 演练自己来、不还债，先做本周规划内尚未完成的主线学习」。
> 设计点冻结与验证证据汇总见 [dense-langchain-wiring-freeze.md](./dense-langchain-wiring-freeze.md)；本文记录过程、决策依据与边界。
> 协作模式：AI Engineer 分阶段的实现方模式——术语与候选由 AI 讲解、取舍与运行口径由本人冻结、实现与自测由 AI 交付。
> 本文只记录 D5 主线学习、质量诊断和接线结论；演示脚本与追问材料另行维护。

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

1. 本人按 [D5 主讲稿](./day5-demo-script.md) 与 [追问准备](./day5-demo-qa.md) 执行演练并记录实际卡点。
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

## 11. RAG 质量诊断方案与 dev 逐题首轮诊断（2026-09-11）

本轮质量改进按以下顺序执行：

1. **benchmark 有效性审计**：核对 query、expected conclusion、evidence requirement、source block 与 R1
   是否相容；不先改 Prompt、chunk、retrieval 或阈值。
2. **检索上限诊断**：逐题核对目标 block 是否进入 top-k、是否进入实际 context，以及 retrieval-only 的交集命中
   与 R1 的 citation 包含要求是否产生层级差异。
3. **context / citation 诊断**：分别记录 citation 可解析、进入 context、落在 requirement 内和支持 claim，不能
   用 `citation_precision` 的 identifier 可解析率代替语义支持。
4. **生成稳定性实验**：在 dev 上单变量比较 schema、branch、claim 与 citation 行为；不读取或调参 holdout。
5. **冻结后回归**：只有 dev 的改动、配置和评分规则重新冻结后，才把 holdout 作为 regression 运行。

本阶段的 requirement、expected conclusion、阈值与 eval version 仍由本人决定；以下首轮结果只包含机械审计和
已有运行证据，不代替本人对题意与 claim 语义的最终确认。

| item | R1/source block 审计 | retrieval-only（B/D/H，k=10/20/30） | e2e 机械（BM25/dense） | 已有语义结果 | 首轮诊断入口 |
|---|---|---|---|---|---|
| `direct-answer-01` | **有疑点**：`L66-L72` 内有 `L68-L70` block，但 JWT 的核心 block 是 `L71-L76`；该 block 的 `model_content` 带有 `L66` 的标题语境，所以模型可看到 L2，但 R1 citation 仍越界 | `P/P/P` · `P/P/P` · `P/P/P` | `P/P` | `F/F` | 先确认 requirement 是否同时要求 L2 与 JWT；候选修正是扩大 span 至 `L66-L76` 或拆成两个 requirement，须进入新 eval version |
| `direct-answer-02` | 有内部 block | `P/P/P` · `P/P/P` · `P/P/P` | `P/P` | `P/P` | 当前没有首要缺陷；作为成功对照 |
| `cross-document-01` | 两个 requirement 均有内部 block | `P/P/P` · `F/F/P` · `P/P/P` | `P/F` | `F/F` | 分开检查 dense 召回与 dense 的 `schema_error`；BM25 的后续语义失败不能归因于 retrieval |
| `cross-document-02` | 两个 requirement 均有内部 block | `P/P/P` · `F/F/F` · `F/F/P` | `P/F` | `F/F` | BM25 已召回但 claim/evidence coverage 失败；dense 需同时检查召回和 branch |
| `paraphrase-01` | 有内部 block；语义范围需人工复核 | `F/F/F` · `F/F/F` · `F/F/F` | `P/P` | `F/F` | 9 个有效配置均未通过，是首要 retrieval 诊断对象；同时检查 R1 citation 与 requirement 的关系 |
| `paraphrase-02` | 有内部 block | `P/P/P` · `F/F/F` · `F/F/P` | `P/P` | `F/F` | 对照 BM25 与 dense 的失败集合，检查近似措辞、block 内容和 citation 覆盖是否分别失败 |
| `priority-conflict-exception-01` | 两个 requirement 均有内部 block | `F/P/P` · `P/P/P` · `P/P/P` | `F/F` | `F/F` | retrieval 随 k 改善，但两轮 e2e 都出现错误 abstention，优先查 generation branch |
| `priority-conflict-exception-02` | 三个 requirement 均有内部 block | `F/F/P` · `F/P/P` · `F/P/P` | `F/P` | `F/F` | BM25 是 branch failure；dense 是语义 coverage/citation failure，分层处理 |
| `no-answer-01` | source span 有内部 block；`corpus_absence` 不做 retrieval 命中 | `—/—/—` · `—/—/—` · `—/—/—` | `P/P` | `P/P` | 当前作为正确 abstention 对照 |
| `no-answer-02` | `corpus_absence`，无 source block 要求 | `—/—/—` · `—/—/—` · `—/—/—` | `P/P` | `P/P` | 当前作为正确 abstention 对照 |

表中 `P/F` 顺序分别为 `BM25 / dense`；retrieval 三组顺序分别为 `BM25 / dense / hybrid`，每组从左到右是
`k=10/20/30`。`e2e` 的机械和语义结果来自既有 D5 运行，未重新调用模型。

首轮结论：

- 当前 dev 题集没有“完全没有可引用 block”的普遍结构性问题；但 `direct-answer-01` 的 requirement 与 block
  边界存在具体疑点。其 `L71-L76` block 的 `model_content` 含 `L66` heading context，原文行本身却不包含 L2 标题；
  需要本人确认题意后再决定是否把 span 扩大到 `L66-L76` 或拆分 requirement，并进入新的 eval version。
- `paraphrase-01` 在 9 个有效 retrieval 配置中都失败，是最适合做检索根因实验的题目。
- `priority-conflict-exception-01` 的主要现象是 generation 层 false abstention，不应先用 retrieval 调参解释。
- retrieval-only 的交集命中与 R1 的 citation 包含判定并非同一层级；因此 `P` 不能直接推导端到端通过。

本表是诊断工作表，不修改 `w13-eval-v1`、R1、Prompt、registry 或历史 evidence。下一步先由本人确认
`direct-answer-01` 的 expected conclusion 与 evidence requirement；确认后再进入 `paraphrase-01` 的检索链路诊断。

## 12. 逐题复核修正版与重出题入口（2026-09-11）

### 12.1 复核范围与方法

本节是对 §11 首轮诊断的补充修正。已逐项核对 dev 题集、expected conclusion、evidence requirement、冻结
原文、572 条 registry、9 个 retrieval-only 配置，以及 full-context、BM25、dense 三组各 10 条实际响应。
未读取 holdout 题面、响应或衍生素材，也没有修改历史 evidence、`w13-eval-v1`、R1、Prompt 或阈值。

已复核的确定性事实：

- registry 的 572 条 `model_content` hash 全部一致；full-context Evidence Context 可重建，hash 与记录一致。
- BM25 与 dense 两个端到端运行的 20 个检索 context 均可由记录中的 hits 重建，字符数和 hash 均一致。
- 三组响应共有 48 个不同 citation identifier；除 full-context `paraphrase-02` 的未注册合并 ID
  `rules/AGENTS.md#L185-L189` 外，本轮没有发现已注册但未进入实际 context 的 citation。
- 7 份冻结文档都被 dev 的来源要求涉及：AGENTS 6 项、TECHNICAL-WRITING 3 项、SHOWCASE-VISUAL 1 项、
  DAILY-LEARNING-REPORT 1 项、LEARNING 1 项、SHOWCASE-DEPLOY 3 项、DAILY-SPEAKING 1 项。覆盖文件不等于
  每道题的证据范围已经相容。

### 12.2 逐题修正结论

| item | 题目/证据复核 | 当前可归因事实 |
|---|---|---|
| `direct-answer-01` | JWT block 是 `AGENTS L71-L76`，其 `model_content` 带 `L66` 标题语境；要求却截到 `L66-L72`。 | BM25、dense 均第 1 名取回正确 block，回答 L2 正确；主要是 span 与 R1 不相容，不是 retrieval miss。 |
| `direct-answer-02` | `TECH L118/L120` 可完整支持结论，边界相容。 | 三组都正确；保留为成功对照。多 claim 联合覆盖的人工口径仍需统一。 |
| `cross-document-01` | AGENTS `L163` 与 TECH `L118/L120` 均能独立提供规定；范围相容。 | BM25 找到关键 block；dense top-10 缺关键条款并有 schema error。旧 BM25 失败还涉及“未标注即违规”是否由一条 claim 直接覆盖的判定口径。 |
| `cross-document-02` | VISUAL 要求为 `L1-L10`，但“TECH 继续约束事实强度和句子表达”在 `L9-L11`，再次被范围截断。 | BM25 找到相关内容但有范围/覆盖问题；dense 确实缺文案职责证据；full-context 有一个不受引用支持的额外 claim。 |
| `paraphrase-01` | W2 block 为 `AGENTS L69`；援助阶梯的直接上限句是 `L110-L111`，要求却截止 L110。 | 9 个有效 retrieval 配置均未取回 W2 block。BM25 题目与 W2 block 的共同 token 只有“实现”，说明词面信号很弱；dense 根因仍待单变量实验。 |
| `paraphrase-02` | W5 block 为 `AGENTS L77`；同样受到 `L101-L110` 截断的影响。 | BM25 已回答 W5、L1 与 L2，主要失败是要求内引用覆盖；dense 缺少 W5/阶梯证据；full-context 创造了未注册合并 ID。 |
| `priority-conflict-exception-01` | 冻结能力表确实列出 W13=RAG、W15=MCP，优先级规则也存在；但“当前现行”可能要求实际状态，而语料不含当前 `LEARNING-STATE.md`。 | dense top-10 只有 W15，BM25 top-10 没有周主题映射；full-context 仍拒答。不能把三者统一归为 generation，题目范围/状态入口也需先校准。 |
| `priority-conflict-exception-02` | “构建成功不等于发布”与独立授权均有原文；第三项要求还要求完整列出发布前步骤，细于题面的一次判断。 | BM25 已看到 L94 的独立授权却拒答；dense 缺部分授权/验证事实；两者是不同失败。 |
| `no-answer-01` | 英语口语规范与整个冻结语料均没有法语长度/格式规则。 | 三组均正确拒答；理由应避免写成“没有 rules-c0a4b85”，改为“语料没有法语规则”。 |
| `no-answer-02` | 语料没有 subagent 参与该专项 review 的允许/禁止规则；一般 review 或人工验收条款不足以推出该权限。 | 三组均正确拒答；核心结论成立，理由需准确表述语料缺少专项规则。 |

### 12.3 横向阻断问题

1. `evidence_requirements` 的 span 多次切断包含标题的语义 block：JWT、VISUAL `L9-L11`、两道
   paraphrase 均受影响。不能通过调大 top-k 修复；需先由本人确认是否扩大 span、拆成多个 requirement，或在新
   eval version 中改写题目。
2. 人工工作表只展开 citation 的核心行，没有展示 `context_spans` / `model_content` 的标题语境。该展示缺口
   会把模型实际看到的证据误判为不存在。
3. R1 要求一条 claim 覆盖 requirement，但 requirement 含多个事实，而 atomic claim 又要求拆句；
   `direct-answer-02` 等题已经出现“多条 claim 联合覆盖”和“单条 claim 必须完整覆盖”口径不一致。
4. retrieval-only 的交集命中只证明范围有部分交集，不证明答案所需事实齐全。`7/8` 不能替代 context 内证据
   完整性检查。
5. `citation_precision` 当前只证明 identifier 能解析到全局 registry；它没有证明 citation 进入本题 context，
   也没有证明 citation 支持 claim。该实现缺口本轮未造成已注册越界引用，但必须在下一版评测前补齐。

### 12.4 后续顺序与重出题原则

执行顺序固定为：

1. 评测校准：先确认题目、expected conclusion、evidence requirement、block 边界和 claim 覆盖口径。
2. 检索诊断：逐题记录目标 block 的 rank、是否进入 context、是否满足完整证据要求；优先实验
   `paraphrase-01`。
3. context/citation 诊断：分开记录 ID 可解析、context membership、R1 包含性和语义支持。
4. generation 诊断：在 dev 上单变量观察 branch、schema、claim 原子性和 citation 行为。
5. 新题集冻结后再运行 holdout；旧题和旧结果保留为历史对照。

题目重做采用“AI 机械起草、本人冻结语义”的分工：AI 可以根据七份文档生成候选题、引用范围候选、JSON、ID、
hash、覆盖矩阵和 LangChain/LangGraph 框架对照；本人负责自然语言问题的真实意图、expected conclusion、
允许/拒答边界、evidence requirement、阈值和最终验收。AI 不把候选题自动放入 dev 或 holdout。

W13 题目优先覆盖 LangChain 固定 RAG 链路：`Document`、retriever、context assembly、citation、abstention
和 evaluation；LangGraph 的 state、终止、重试、trace 与 verifier 作为 W14 的有状态 harness 题目方向，
不把尚未实践的 LangGraph 行为伪装成 W13 事实。下一对话的启动提示词见
[`day5-rag-quality-recovery-prompt.md`](./day5-rag-quality-recovery-prompt.md)。

## 13. 评测校准追问与题目修订决定（2026-09-11）

### 13.1 本人确认的认知修正

- `source_span` 是 citation 的位置身份；`context_spans` 和 `model_content` 是提供给模型的标题或表头语境。
  模型实际看到标题，不代表 citation 可以引用超出核心 `source_span` 的行。
- 冻结 corpus、运行时状态和评测输入是不同对象。冻结 corpus 用于可重复的规则验证；“当前 W13 D2”属于动态
  状态，不能在没有状态输入或版本化状态快照时要求冻结语料证明。
- 在不增加题目数量的前提下，把一个题目的多个独立事实拆成多个 `source_span` requirement，比扩大一个
  混合 requirement 更容易定位失败，也更接近实际系统中的分层验证。

### 13.2 题目修订决定

本人认可以下方向，先保存为新版本候选，不改写 `w13-eval-v1`：

1. `direct-answer-01` 保留一个题目，拆成两个 requirement：
   - `AGENTS.md#L110-L111`：黑名单项最高援助级别为 L2；
   - `AGENTS.md#L71-L76`：JWT 签发与验证属于 W4 认证鉴权黑名单。
2. `priority-conflict-exception-01` 改为静态假设题，删除“当前处于 W13 D2”这一运行时状态前提，改为根据冻结的
   W13/W15 阶段映射和优先级规则判断是否可以直接切换到 MCP；结论收窄为现有三个 source span 直接支持的范围，
   不额外声称“正式修改计划”这一未单独列证的条件。
3. 题目数量、阈值、Prompt、response schema、R1 和旧 evidence 均不在本轮改变。候选文件为
   [`eval/candidates/w13-eval-v2-dev-items.json`](../eval/candidates/w13-eval-v2-dev-items.json)，尚未冻结，
   也没有扩展或重写 holdout。

### 13.3 框架实践边界

LangChain 的 `Document`、retriever、vector store 和 context assembly 适合用稳定的版本化文档验证；LangGraph 的
`State`、条件路由、终止和重试适合承载运行时状态与 workflow 控制。当前 W13 只采用前一层的静态题目；动态状态题
顺延到 W14 的 LangGraph 实践，并单独记录 state 输入和验证证据。

### 13.4 Holdout 风险边界

本轮没有读取 holdout 题面、答案或派生素材。冻结 verifier 只能确认 holdout 的结构、hash 和版本边界，不能发现
题意与 source block 不相容、动态状态混入或 requirement 过宽等语义问题。由于 holdout 与 dev 共用同一 schema、
source block 设计和出题方法，**不能假定 holdout 自动没有同类问题**；新 eval version 必须由本人重新确认 holdout
的题意、expected conclusion、evidence requirement、`corpus_absence` 和核心断言后，才能建立新的 holdout。

### 13.5 本节结论与下一入口

候选检查先捕获了两个可复现问题：顶层临时说明字段违反 `additionalProperties: false`，且拆分后题面仍只询问
援助级别。删除临时字段、把题面改为同时询问 W4 分类和 L2 上限后，候选 schema（按候选版本常量适配）通过，所有
候选 source span 的文件与行范围也存在；`git diff --check` 通过，冻结 v1 verifier 仍报告 10/10 且未读取 holdout。

因此当前可推进到 **v2 dev draft**，但不能宣称完整 v2 已冻结：正式 schema/manifest 仍是 v1，旧 evidence 与阈值未改，
holdout 题意无法由普通 agent 审计。下一入口是用候选题目做 dev retrieval-only 与端到端诊断；若发现语义或证据问题，
继续只改候选层。完整 v2 的 holdout 必须由本人在受保护边界内确认题意、判据和 requirement 后再建立。

本轮候选 retrieval-only 复跑结果为 **6/8 个适用题通过**；两个 `no_answer` 按契约记为不适用，失败项仍是未改动的
`paraphrase-01` 和 `priority-conflict-exception-02`。端到端入口当前读取正式 `eval/dev/items.json`，且本环境没有
`DEEPSEEK_API_KEY`；因此没有冒险改写冻结 dev 或伪造候选端到端结果。随后为 retrieval/BM25/dense 三个入口增加显式
`--items` 参数，默认仍为冻结 v1；候选 retrieval-only 已通过该真实入口复跑，端到端留到有凭据时执行。
