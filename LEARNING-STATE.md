# 当前学习状态

> 最后更新：2026-09-10（Asia/Shanghai）
> 当前入口：W13 D4 已完成阶段 1–5 并写出阶段 5 结论。四类路径结果：全语料 full-context **机械 8/10、人工判定 4/10**；
> BM25 retrieval **5–7/8**（top_k 10/20/30）；dense **3–5/8**；hybrid（计划外扩展项，RRF）**4–7/8**。
> **四类路径均未通过门禁**，`paraphrase-01` 在全部 12 个检索配置下都失败（词汇鸿沟）。结论与全部边界见 D4 笔记 §6.19；
> 判定口径 R1 见 [`scoring-rulings-r1.md`](week13-rag/eval/scoring-rulings-r1.md)。
> 工程现状：`w13rag.sh check` = **70 passed** + 冻结基准 `8a02c665…` 三一致 + `guard` 通过；W12 = 35 passed、覆盖率 98.00%。
> **未完成三项**：BM25/dense 端到端 generation（前置 retrieval 门禁未通过）、首次 holdout（未运行）、展板与分享排练。
> 下一步 = ① 由本人决定是否在检索未达标的前提下运行首次 holdout；② 或按阶段 5 结论收口并把端到端记为未完成。
> 冻结链：B1–B4（[`bm25-design-freeze.md`](week13-rag/notes/bm25-design-freeze.md)）、D1–D4 + H1
> （[`dense-design-freeze.md`](week13-rag/notes/dense-design-freeze.md)）、模型与 JSON 输出约束
> （[`model-policy-v1.md`](week13-rag/config/model-policy-v1.md) §1、§2.1）。
> 本文件只保留当前进度、有效决定、风险和下一步；阶段结论与必要纠错见每日笔记。

## 当前周与目标

- 当前周：**W13（9/7-9/11，RAG Foundations）**。
- 当前阶段：**D4 阶段 1–3 已闭合，阶段 4（全语料上下文 dev baseline）未开工**。serialization 实现里程碑（L1）
  已由本人签认（A1–A8 全部「符合」，16 条全语料不变式通过）；输入计量与 context budget 已完成并确认当前冻结
  条件可完整容纳；客户端接线与失败分层已验证（W13 侧 24 passed，W12 侧 32 passed）。D2 的 eval、Prompt/schema
  与 source block/source identifier/citation registry 已闭合；D3 serialization 契约与判据 #1–#7 已冻结。
  尚未进入 baseline、BM25、dense。
- W13 使用 LangChain Python 完成固定 RAG；框架不得改变冻结 corpus、source identifier、citation registry、
  `model_content`、Prompt/schema 或 eval 契约。
- 完整 W13 验收包含框架无关的全语料上下文基线、LangChain BM25 与 dense 同集对照，以及全部输入、配置、
  实现和评分规则冻结后的首次 holdout。首次结果不得反向用于调参；后续只按预先冻结的 regression 节点复跑。
- 本周按 serialization -> parser/输入计量与全语料上下文基线 -> LangChain BM25 端到端 -> LangChain dense
  -> 冻结后首次 holdout 的门禁顺序推进；前一阶段未完成时不叠加下一阶段。
- D5 时间边界：17:00 前仍是正常学习窗口，继续当时所在阶段；17:00 分享已经验证的实际进度和边界。
  分享不等于完整 W13 技术验收，排练不得挤占前置学习。
- 五周主线：W12 Python/Bub -> W13 LangChain RAG -> W14 LangGraph Agent -> W15 MCP -> W16 reliability/evals。

## 最近完成

- D4（9/10）阶段 4 dev baseline 已运行（10 条真实调用，`evidence/baseline/dev-full-context-prompt-v1-01.json`）：
  **机械通过 7/10（阈值 ≥9/10，未达）**；`citation_precision_min = 1.0`、无 missing citation、无
  `abstained_but_answered`（零容忍未触发）。失败 3 条：2 条响应格式/解析（answered 分支多出 `reason_code: null`；
  响应被 ```json 围栏包裹），1 条生成层 false abstention（priority-conflict-01）。按阶段 5 规则只能得出
  「当前 full-context 路径未达冻结阈值」，**不能**据此认定需要 retrieval。逐题归因见 D4 笔记 §6.10。
- D4（9/10）Prompt v1 落盘（本人确认 A 方案）：§1 增加第 11 条（响应键契约）与第 12 条（claims 1–10、
  citations 非空不重复）；§2 之后与 v0 逐字节相同。计量重跑：最大渲染请求 44,572 → **44,701** tokens，
  仍可完整容纳（余量 851,203）。v0 计量证据按版本改名保留。
- D4（9/10）阶段 4 smoke（1 条真实调用）完成并暴露一条阻断发现：链路与身份字段全部落地——请求侧
  `deepseek-v4-flash` / `thinking={"type":"disabled"}` / `max_tokens=4096`；服务端 `served_model=deepseek-flash`、
  `system_fingerprint=aeb56401…`；provider `usage.prompt_tokens=44553` 与离线 estimate 44,551 相差 **+2（0.004%）**；
  `prompt_cache_hit_tokens=0`（可观察）。**阻断**：响应落 `schema_error`——模型返回 `status` 而非 `branch`、
  另加顶层 `citations` 与 `schema_version`；根因是冻结 Prompt 的 §1 未规定响应键名，而 §3 的示例被明确排除在
  请求之外。失败阶段归 **prompt（输入契约不完整）**。待本人决定处理方式（见 D4 笔记 §6.9）。
- D4（9/10）阶段 4 脚手架就绪：`src/w13rag/scoring.py`（机械评分，含 citation 可解析性与 precision、
  abstained-but-answered 零容忍标记）、`scripts/run-dev-baseline.py`（复用 `run_item`，逐题落盘请求/身份/usage/
  延迟/原始响应/评分），新增 6 条评分单测；W13 共 **30 passed**。
- D4（9/10）阶段 3 客户端接线验证：W12 `DeepSeekClient.chat()` 新增 `model` / `thinking` / `max_tokens`
  （W12 32 passed，覆盖率 97.97%）；W13 新增 `src/w13rag/generation.py`（唯一组装入口 + 六态失败分层 +
  服务端身份记录）与 8 条 payload / 失败分层用例；`w13rag.sh check` = **24 passed** + 冻结基准三一致。
  官方核对的请求形状：`{"thinking": {"type": "disabled"}}` 是请求体顶层字段，且思考模式默认开启。
  计量脚本改为复用同一组装函数后，计量证据**逐字节不变**（sha256 `1ba58582…`）。
- D4（9/10）测试/门禁缺口已修复：`w13rag.sh check` 并入绝对基准校验（`[3/3] frozen verify`），新增
  `tests/test_parser_segmentation.py`（5 条 parser 切分用例）。可证伪验证：重放「去掉 A3 合并」时，修复前是
  `9 passed` 全绿，修复后 check 在第一步即 `2 failed, 14 passed`，还原后回到 `16 passed` + 三一致。根因分层登记见
  [`day4-full-context-baseline-and-bm25.md`](week13-rag/notes/day4-full-context-baseline-and-bm25.md) §6.6、§6.7。
- D4（9/10）阶段 2 输入计量与 context budget：按 C1 逐条组装 10 条 dev query 的完整请求——system instructions
  268 tokens + 完整 Evidence Context 44,247 tokens + 单条 query 12–33 tokens；完整渲染请求 44,551–44,572
  （模板开销固定 3 tokens）；可用上限 895,904 → **可完整容纳**，余量 851,332。证据
  [`assembled-input-rules-c0a4b85.json`](week13-rag/evidence/input-budget/assembled-input-rules-c0a4b85.json)；
  重跑入口 [`measure-input-budget.py`](week13-rag/scripts/measure-input-budget.py)。
- D4（9/10）tokenizer 运行时按 D1 记录重建：官方归档 sha256 `e7310d1d…` 与 D1 证据一致；smoke `[19923, 3]`
  与逐文件 token（4174/2032/649/3076/2994/3086/2686 = 18,697）**全部复现**，据此证明环境等价。同时发现 D1
  记录的 `pipFreeze` 含不可解析的 `filelock==3.32.5`（py3.12 实际解析为 3.32.6）。
- D4（9/10）context window 来源已记录：官方 Models & Pricing 的 `CONTEXT LENGTH 1M`、`MAX OUTPUT MAXIMUM: 384K`
  （检索 2026-09-10），与既有冻结值一致；官方字符比例 `1 English char ≈ 0.3 token`、`1 Chinese char ≈ 0.6 token`
  仅作粗粒度交叉检查。
- D4（9/10）serialization 实现 review 收口：A1–A8 由本人全部签认「符合」（16 条全语料不变式通过；步骤 C
  两个破坏性实验按预测变红并已还原）；A3 追加 fixture D——fenced code 逐字保真的可判别用例，tests 9 → 11 passed；
  整串基准未变。证据 [`serialization-review-A1-A8-evidence.md`](week13-rag/notes/serialization-review-A1-A8-evidence.md)；
  只读重跑入口 [`verify-a1-a8.py`](week13-rag/scripts/verify-a1-a8.py)。
- D4（9/10）判定线事实：`w13rag.sh test` 对 A1 / A3 两类退化都是全绿（两个破坏性实验中均为 `9 passed`），
  只有冻结基准 `verify` 与独立重算会红；已用 `verify-a1-a8.py` 补足这层保护。
- D4（9/10）C1 由本人冻结为「是」：按 10 条 dev query 分别组装完整请求并逐条估算，取最大输入占用为门禁值。
- D3 serialization 契约冻结闭合（9/9）：设计点 1-6 全部确认（点 2 = 基线 A 规范化优先 + 8 子规则；点 3 =
  XML-like wrapper 4 子规则；点 4 = hash 3 子规则；点 5 = 组装职责复核；点 6 = 七条判据清单 + 全串基准延迟
  冻结）；单一规范、合成 fixture A/B/C 与期望 hash、静态一致性复核已完成，详见
  [`day3-freeze-serialization-contract.md`](week13-rag/notes/day3-freeze-serialization-contract.md)。
  未实现 parser、未做真实语料判据/计量/baseline/BM25（符合 D3 止步条件）。
- serialization 实现里程碑（9/9，D3 内提前分摊完成）：确定性 parser / citation registry / Evidence Context
  实现并自测——tests 9 passed（fixture A/B/C 字节/hash + 真实语料不变式）；7 文件 uncovered/duplicated=0；
  572 blocks；Evidence Context 89,854 chars；two-pass byte-identical；整串 sha `8a02c665…`。判据 #1–#7 逐字
  由本人确认（`notes/serialization-criteria-confirm-checklist.md`），整串基准已冻结
  （`evidence/serialization/frozen-rules-c0a4b85.sha256`）。CLI `scripts/w13rag.sh`（test/build/check/verify）。
- python 代码 review（9/9）：source/parser/cli 三文件已 review（答疑 Q1–Q12 已关闭，学习注释已清理）；
  README 包导读 + py→TS 映射与 `scripts/inspect-block.sh` 已就绪；语义点 A1–A8 批注与实现 diff 正式
  结论未回填到 review 工作表 → L1 验收待闭合。
- W12 已收口：Python 3.12 项目基线、Bub 主链阅读、真实 DeepSeek 调用、timeout/cancellation 实验、
  独立诊断与类 2 债务重建均完成；详细结论见
  [`day5-diagnosis-and-wrapup.md`](week12-python-rag/notes/day5-diagnosis-and-wrapup.md) 和
  [`day6-low-intensity-review.md`](week12-python-rag/notes/day6-low-intensity-review.md)。
- W13 规则文档语料 snapshot 已冻结：以 source commit
  `c0a4b85c9065cbfb943584c914172d7819339791` 为基线，并记录不移动既有正文行号的 `repository-content-v1`
  normalization；7 个文件共 76,243 bytes，manifest 逐文件完整性验证通过。
- DeepSeek 官方离线 tokenizer 示例在 `transformers 4.57.6 / tokenizers 0.22.2` 下通过 7/7 文档回环；
  raw corpus-only 结果为 **18,697 estimated tokens**。
- D1 的 corpus/snapshot、retrieval、context window/context budget、usage、citation、eval 与失败阶段等
  前置讲解已完成；这表示可以进入契约设计，不表示相关能力已经完成独立验收。
- 20 条 eval 题意已由本人确认：dev/holdout 各 10 题，五类行为在每个 split 中各 2 题；当前结构检查已验证
  ID/query 唯一、split/branch 对齐与 source span 边界。
- `w13-eval-v1` 已冻结：判分契约、共享 schema、dev/holdout 文件与 manifest hash 已完成；默认验证入口只读
  dev，双 split 静态结构与 hash 验证通过，未运行模型或 holdout。
- W12 `prompt-v0.md` 的任务是把非结构化用户注册信息提取为 `UserCreate + Address` JSON，与 W13 RAG
  问答没有语义继承关系；W13 只复用其版本化、固定输入、结构校验和结果记录方法，以及现有模型客户端。
- 本人已一次确认 W13 RAG Prompt v0 的十项语义；`rag-prompt-v0.md` 与 `rag-response-v1.schema.json`
  已独立创建，response schema 通过 JSON 解析与 Ajv Draft 2020-12 compile，尚未接入或运行模型。
- 本人已确认 source block 使用 Markdown 段落或小节的语义粒度；同一小节包含多条可独立成立的规则时，
  按独立规则段落拆分，以提供明确的引用边界。正文不能独立说明规则适用对象和结论时，必要的 Markdown
  标题层级进入模型可见内容；source blocks 由不调用模型的确定性 Markdown parser 自动重算。列表按顶层
  列表项拆分，嵌套内容跟随父项；fenced code block 与直接说明其含义的相邻内容共同形成 source block；
  机械邻接固定为只向前合并同一小节中紧邻的内容块，前面只有标题时使用必要标题层级，不向后搜索；表格按
  数据行拆分并为每行附带表头；blockquote 作为容器递归应用内部规则，并保留引用标记与必要标题语境；
  thematic break 不形成证据内容，但作为禁止跨越合并的硬边界。冻结 corpus 的实际块级结构覆盖复核已完成。
- 本人已确认 source identifier 使用 `corpus_id/source_path#Lstart-Lend` 标识核心规则在冻结 snapshot 中的原始
  位置。必要标题或复制表头只记录在 citation registry，不扩大 identifier 的行范围；模型可见内容的 hash
  用于完整性校验，不作为身份。
- 本人已确认 citation registry 为每个 block 记录一个与 source identifier 行范围完全一致的核心
  `source_span`，以及零到多个按原始顺序排列的 `context_spans`；附加语境的 `role` 限定为 `heading` 或
  `table_header`。`model_content` 是实际提供给模型的组装文本，`content_sha256` 验证其可重复性。
- 本人已确认 citation registry 使用有序 `blocks` 数组作为唯一持久化格式；每个 entry 自带 `source_id`，
  运行时按需构建 `Map<source_id, entry>`，不额外持久化 `blocks_by_id`。registry 不记录生成时间，避免同一
  snapshot 的重算结果仅因时间字段变化而不同。
- 本人已确认 `blocks` 依次按冻结 manifest 的文档顺序、核心 `source_span.line_start`、核心
  `source_span.line_end` 排序；`context_spans` 不参与排序。重复 `source_id` 不得静默覆盖，必须验证失败。
- D1 于 9/7 收工时判定未完成：eval 仅完成 1/20 题意，RAG Prompt、完整输入容量门禁、全语料上下文
  baseline 和 RAG 必要性结论均未形成。

## 已冻结决定

| 对象 | 当前决定 |
|---|---|
| corpus snapshot | `rules-c0a4b85`；仅包含七份规则文档；以 source commit 为基线并显式记录 `repository-content-v1` normalization；第一道 eval 题建立前已冻结 |
| generation 配置 | `deepseek-v4-flash`；Chat Completions；`thinking: disabled`；三条对照保持一致 |
| token 估算 | DeepSeek 官方离线 tokenizer 示例为主，字符比例只作粗粒度交叉检查；结果标为 estimate |
| 输出预留 | `reserved output / max_tokens = 4096`；是共同上限，不要求每次用满 |
| 安全余量 | 固定 `100000` tokens；10% 只记录本次选值依据，未来窗口变化不自动重算 |
| 回答契约 | answered/abstained 两个互斥分支；answered 最多 10 条 atomic claims，每条关联 citation identifiers |
| 引用边界 | citation identifier 由本地 registry 映射到冻结 source span；映射存在不等于原文支持 claim |
| 拒答边界 | abstained 返回受控 reason code 与简短 reason text；模型不自行判定系统根因 |
| dev/holdout | 使用不同文件或目录物理隔离，并共享同一 eval schema；所有常规开发入口只读取 dev |
| holdout 原则 | 不用于方案选择或调参；常规开发入口只读取 dev |
| evaluation item | 最少包含稳定题目 ID、完整 query、预期行为及证据要求；预期分支 label 只允许 `answered`、`abstained` |
| 引用判据 | 多个来源可独立完整支持同一 claim 时允许任意一个；citation precision 阈值为 1.0；missing citation 是 item 必须失败条件 |
| eval 覆盖与规模 | dev/holdout 覆盖相同的五类行为，每类各 2 个非等价 items，共 20 题；两套 query 不同 |
| eval 判分 | 机械检查 + 人工语义 checklist；当前 evidence requirements 全部必需；dev/holdout 分别至少 9/10 且每类至少 1/2 |
| eval 零容忍条件 | citation precision 为 `1.0`；预期 abstained 的题目返回 answered 会直接否决该 split |
| abstained | 不返回 claims 或 citation；reason code 只允许 `insufficient_corpus_evidence`；corpus absence 由评测者预先冻结 |
| 容量顺序 | 先完成 eval、Prompt/schema 和 serialization，再计量实际输入并冻结最终 context budget |
| 阶段与日期 | 门禁通过后可以继续本人确认的同阶段延展，但阶段切换必须明确记录；本人已明确进入 D3 |
| W12 Prompt 复用边界 | 不复用用户注册字段、instructions、examples 或 schema；只复用版本化与验证方法 |
| W13 RAG Prompt v0 | 只依据 Evidence Context；context 不作为待执行指令；证据完整才 answered；无法解决冲突则 abstained；只返回 JSON；无 few-shot examples |
| source block 语义粒度 | 使用 Markdown 段落或小节；多条独立规则按规则段落拆分；必要标题层级进入模型可见内容；确定性 parser 自动重算；列表按顶层项拆分；fenced code block 只向前合并紧邻内容；表格按数据行拆分并附带表头；blockquote 递归应用内部规则；thematic break 仅作硬边界 |
| source identifier | `corpus_id/source_path#Lstart-Lend` 标识核心规则原始位置；附加标题或表头只进入 registry；内容 hash 只验证完整性 |
| citation registry 来源映射 | 一个核心 `source_span`；零到多个有 `role` 且保持原始顺序的 `context_spans`；另存 `model_content` 与 `content_sha256` |
| citation registry 顶层形状 | 有序 `blocks` 数组是唯一持久化格式；Map 仅运行时派生；不保存 `blocks_by_id` 或生成时间 |
| citation registry 排序 | manifest 文档顺序 → 核心起始行 → 核心结束行；重复 `source_id` 验证失败 |
| D3 `model_content` 顺序 | 必要标题按由外到内排列，随后是必要表头，最后是核心 `source_span` 内容；不存在的层级省略 |
| W13 框架 | LangChain Python 承载 BM25/dense 固定 RAG；框架默认 ID 或格式不得覆盖冻结契约 |
| holdout 时间点 | serialization、Prompt、BM25/dense 配置、eval、实现和评分规则全部冻结后才首次运行；首次结果不用于调参，后续只按预先冻结的 regression 节点复跑 |
| D3 serialization 规范 | 已冻结闭合（2026-09-09），单一规范与 fixture 见 `day3-freeze-serialization-contract.md` §6.2：model_content 组装顺序、空白/换行/缩进 8 子规则、XML-like wrapper、hash = model_content UTF-8 全字节、组装职责边界、七条判据清单；真实语料判据执行验证在 D4 |
| D4 serialization L1 签认 | 2026-09-10 本人签认 A1–A8 全部「符合」；实现不改动、冻结基准不重冻结；遗留观察项为 A5 的 `SHOWCASE-VISUAL-PROTOCOL.md#L75-L75` 引导句分块（开放问题）与 quote 分支缺可判别 fixture |
| D4 容量门禁方法（C1） | 对 10 条 dev query 分别组装完整请求、逐条估算，以最大输入占用作为门禁值；不可容纳时保存证据并明确未运行 baseline |
| D4 context window 来源 | 官方 Models & Pricing `CONTEXT LENGTH 1M`、`MAX OUTPUT MAXIMUM: 384K`（检索 2026-09-10）；与既有冻结值 1M 一致，本次未改动冻结决定 |
| D4 输入计量环境身份 | 归档 `deepseek_v4_tokenizer.zip` sha256 `e7310d1d…`（与 D1 一致）+ `tokenizer.json` sha256 `89085f12…`；runtime `python 3.12.10 / transformers 4.57.6 / tokenizers 0.22.2`（+`jinja2 3.1.6`，仅渲染模板用）；等价性由复现 D1 的逐文件 token 数证明 |
| D4 生成模型策略 | 请求字段保留 `deepseek-v4-flash`（官方标注为 legacy name、已由 `DeepSeek-V4.1-Flash` 提供服务）；阶段 3 起运行证据必填 `requested_model` / `served_model` / `system_fingerprint` / `usage` / `created`；结论绑定实际服务模型；换模型后的重跑比较登记为 W16 升级演练。记录载体 [`model-policy-v1.md`](week13-rag/config/model-policy-v1.md) |

## 当前主线

**D4 阶段 1–3 已闭合；阶段 4（全语料上下文 dev baseline）未开工**。剩余完成条件：
1. 取得真实调用授权后，用 `run_item` 跑 10 条 dev items，逐题落盘运行证据（含 `requested_model` /
   `served_model` / `system_fingerprint` / `usage` / `latency_ms`），并用 provider `usage` 与离线 estimate
   交叉检查（两者分字段）。
2. 按 `w13-eval-v1` 做机械评分与人工语义 checklist，写出 baseline 结论及其不能支持的范围。
3. baseline 证据形成后进入 LangChain BM25（先解释框架映射，由本人冻结 chunk/retrieval 取舍，再由 AI 接线并自测）。
4. 首次 holdout 只能在全部冻结后运行；模型升级后的重跑比较归入 W16（见
   [`model-policy-v1.md`](week13-rag/config/model-policy-v1.md)）。

D4 执行记录（阶段 1、阶段 2 与前置补齐）见
[`day4-full-context-baseline-and-bm25.md`](week13-rag/notes/day4-full-context-baseline-and-bm25.md) §6。

D4 阶段 1 的收口与验证证据：
- review 收口与 A1–A8 签认：[`serialization-implementation-review-worksheet.md`](week13-rag/notes/serialization-implementation-review-worksheet.md)
- 验证证据与破坏性实验输出：[`serialization-review-A1-A8-evidence.md`](week13-rag/notes/serialization-review-A1-A8-evidence.md)

（serialization 契约与判据确认清单见下方「验收证据」。）

## 当前阻塞与风险

- 阶段 2 前置缺口已补齐（2026-09-10）：tokenizer 运行时按 D1 记录重建并复现其逐文件 token 数；context window
  来源记录为官方 `CONTEXT LENGTH 1M`。遗留事实：D1 的 `pipFreeze` 含不可解析的 `filelock==3.32.5`，该 freeze
  无法逐包复现，等价性改由实测数字证明（见 D4 笔记 §6.3 与输入计量证据文件）。
- **阶段 4 阻断（2026-09-10）**：smoke 的真实响应落 `schema_error`——模型返回 `status` 而非 `branch`、并多出顶层
  `citations` 与 `schema_version`。根因是冻结 Prompt §1（唯一发送给模型的内容）未规定响应键名，而 §3 的键名示例
  被明确排除在请求之外；失败阶段归 prompt（输入契约不完整）。处理方式待本人决定（Prompt v1 补键契约 / 放宽
  schema / 记录为已知限制），见 D4 笔记 §6.9。修好前不跑满 10 条 dev。
- **阶段 4 结果（2026-09-10）**：dev baseline 机械通过 7/10，未达冻结阈值（≥9/10 且每类 ≥1/2；cross_document 0/2）。
  失败 3 条已分层归因：2 条响应格式/解析、1 条生成层 false abstention；`citation_precision_min = 1.0`。按阶段 5
  规则不得据此推出「需要 retrieval」。候选硬化项（Prompt v2 / JSON 输出约束）待本人决定，见 D4 笔记 §6.10。
- 阶段 4 前置：需要 `.env` 中的 API key 与真实调用授权；smoke 与 10 条 baseline 均已完成真实调用，凭据由
  W12 `load_env()` 加载，AI 未读取或打印其值。
- 模型退役已登记并决定（2026-09-10）：保留请求字段 `deepseek-v4-flash`，运行证据记录服务端身份，结论绑定
  `served_model`；换模型后的重跑比较归入 W16。记录载体 [`model-policy-v1.md`](week13-rag/config/model-policy-v1.md)；
  长期判断（托管模型无法位级冻结，可复现性来自「冻结输入 + 记录身份 + 评测门禁」）见 D4 笔记 §6.5。
- serialization 实现 L1 已闭合：判据 #1–#7 通过、整串基准 `8a02c665…` 冻结；原「`w13rag.sh test` 无法识别
  A1/A3 类退化」的测试/门禁缺口已修复（`check` 含 frozen 校验 + 新增 parser fixture，已用重放实验证明会红），
  全语料级仍由 `scripts/verify-a1-a8.py` 独立核对。
- 语义边界质量（含 A5 的 `SHOWCASE-VISUAL-PROTOCOL.md#L75-L75` 引导句分块）仍由 dev eval 暴露
  （D2 声明，非本阶段阻断）。
- response schema 已静态 compile，未接入模型客户端；复用客户端尚未验证显式发送 `thinking: disabled`；
  接线验证前不得运行 baseline。
- 当前 AGENTS.md、LEARNING-PROTOCOL.md 与 TECHNICAL-WRITING-PROTOCOL.md 含 snapshot 冻结后的协作修正，不
  回填 `rules-c0a4b85`；正式 eval 只能引用冻结版本。
- 中文 BM25 预处理、LangChain 接线与 chunk 方案待 D4 实测；dense 与首次 holdout 是完整 W13 验收项，
  未完成时必须如实判定部分完成。
- 仓库 Markdown 扩展语料保持"候选扩展，未验证"，不启动、不顺延占用主线。
- D5 17:00 分享门禁：分享只使用届时已验证证据，不为演示跳过依赖或扩大 AI 援助。学习展板与主线解耦，
  周末有余力时再整理。

## 下一步

**当前入口**：阶段 1–3 已闭合；阶段 4 已运行并**未达冻结阈值**（机械 7/10，cross_document 0/2）；
Prompt v1 已落盘且键契约问题解决。
下一步按顺序：① 本人按 [`dev-semantic-checklist-worksheet.md`](week13-rag/notes/dev-semantic-checklist-worksheet.md)
做逐题语义判定（重点 cross-document-01/02、priority-conflict-01）；② 决定候选硬化项（Prompt v2 明确 answered
分支键集合 / 请求级 JSON 输出约束）；③ 阶段 5 写 baseline 结论；④ LangChain BM25；⑤ dense；
⑥ 全部冻结后运行首次 holdout。

## 验收证据

- snapshot manifest：[`manifest.json`](week13-rag/corpus/rules-c0a4b85/manifest.json)
- raw token 估算：[`token-count-rules-c0a4b85.json`](week13-rag/evidence/token-count-rules-c0a4b85.json)
- W13 周计划：[`week13-plan.md`](week13-rag/notes/week13-plan.md)
- D1 阶段结论、证据与必要纠错：[`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)
- D2 eval 契约计划与门禁：[`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)
- D3 serialization 契约工作表：[`day3-freeze-serialization-contract.md`](week13-rag/notes/day3-freeze-serialization-contract.md)
- D4 全语料上下文 baseline 与 LangChain BM25 计划：
  [`day4-full-context-baseline-and-bm25.md`](week13-rag/notes/day4-full-context-baseline-and-bm25.md)
- serialization 实现证据：[`evidence/serialization/`](week13-rag/evidence/serialization/)（registry 572 blocks、
  整串 txt/sha256、criteria-report、冻结基准 `frozen-rules-c0a4b85.sha256` = `8a02c665…`）
- A1–A8 验证证据与破坏性实验输出：[`serialization-review-A1-A8-evidence.md`](week13-rag/notes/serialization-review-A1-A8-evidence.md)
- 输入计量证据（C1 门禁）：[`assembled-input-rules-c0a4b85.json`](week13-rag/evidence/input-budget/assembled-input-rules-c0a4b85.json)；重跑入口 [`measure-input-budget.py`](week13-rag/scripts/measure-input-budget.py)
- 接线与失败分层：[`generation.py`](week13-rag/src/w13rag/generation.py) + [`test_generation_payload.py`](week13-rag/tests/test_generation_payload.py)（payload 捕获 + JSON/schema/HTTP/timeout 四类互斥）
- 生成模型策略：[`model-policy-v1.md`](week13-rag/config/model-policy-v1.md)
- dev baseline 运行证据（10 条真实调用）：[`dev-full-context-prompt-v1-01.json`](week13-rag/evidence/baseline/dev-full-context-prompt-v1-01.json)
- 逐题人工语义 checklist 素材：[`dev-semantic-checklist-worksheet.md`](week13-rag/notes/dev-semantic-checklist-worksheet.md)
- 只读重跑入口：[`verify-a1-a8.py`](week13-rag/scripts/verify-a1-a8.py)（16 条不变式，PASS/FAIL 退出码）
- review 工作表（A1–A8 签认 + 收口记录）：[`serialization-implementation-review-worksheet.md`](week13-rag/notes/serialization-implementation-review-worksheet.md)
- 判据确认清单：[`serialization-criteria-confirm-checklist.md`](week13-rag/notes/serialization-criteria-confirm-checklist.md)
- W12 最近一次完整验证：pytest 30 passed，`src` 行覆盖率 97.89%，mypy 对 9 个源文件通过。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week13-plan.md`](week13-rag/notes/week13-plan.md)。
3. [`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)。
4. [`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)。
5. [`day3-freeze-serialization-contract.md`](week13-rag/notes/day3-freeze-serialization-contract.md)。
6. [`day4-full-context-baseline-and-bm25.md`](week13-rag/notes/day4-full-context-baseline-and-bm25.md)（含 §6 执行记录）。
7. [`dev-semantic-checklist-worksheet.md`](week13-rag/notes/dev-semantic-checklist-worksheet.md)——阶段 5 的逐题语义素材。
8. 当前任务相关的 `git status --short` 与 diff。

## AI 辅助记录与延迟重建

- W13 当前为 AI Engineer 分阶段模式。AI 已先讲解术语与边界，并对已确认契约做机械落盘；本人拥有 eval、
  Prompt、serialization、框架取舍和核心断言，语义冻结后 AI 可以实现并自测，本人负责 review、修改/诊断与验收。
- D1 笔记已从逐轮问答日志压缩为阶段性记录；后续只在结论、证据、决定或下一入口变化时更新。
- AI 已用一条明确排除在正式题集之外的 Docker 白名单题解释 evaluation item 的完整形状；属于 L1 任务模型
  讲解，不提供正式题库语义。
- 20 条题目的对象、判断维度和预期结论由本人提出并确认；AI 只做题意校准、冻结来源核对和机械落盘。
  判分规则与阈值由本人确认；AI 只做契约排版、schema、验证入口和 hash 等机械落盘。
- AI 已对 evidence requirement、source block 与 retrieval result 的职责关系提供 L1 澄清；source block
  的语义粒度、取舍理由与确定性 parser 方向由本人确认，具体 Markdown 解析规则仍由本人决定。
- 本人确认 W13 使用不调用模型的确定性 Markdown parser 减少逐块人工核查；机械检查承担完整性与重跑一致性，
  semantic boundary 风险由后续 dev eval 暴露。该 preprocessing 不记为 Agent 实践，Agent harness 保留在 W14。
- D3（9/9）：本人逐点确认 serialization 语义（设计点 2-6 子规则、wrapper、hash、职责、判据清单）；AI 只做
  讲解与 §6.2 机械合并、合成 fixture 构造与期望 hash 计算、§6.3 静态复核记录。语义冻结前不实现 parser；
  未触发需记 `DEBT.md` 的欠债。
- **当前有活动中的 `DEBT.md` 欠债（2026-09-10，未还）**：判定入口偏离已冻结 eval 契约，详见下方 AI 辅助记录末条。
- 本轮规则与计划修订不代填尚未确认的 D3 语义。
- D4 前置分摊（9/9）：本人冻结判据 #1–#7 逐字语义并逐条确认（判据 3 保留 `<source` 前缀守卫）；AI 实现
  parser/registry/Evidence Context 并自测（fixture 回归 + 真实语料不变式 + two-pass），机械执行判据追认记录、
  整串基准冻结与状态同步；语义与判据未由 AI 代填，未触发 `DEBT.md`。
- D4（9/10）：A1–A8 的验证执行与两个破坏性实验由 AI 完成（16 条不变式、预测先落盘、改动后全部还原），
  fixture D 也是本人决定后由 AI 追加；**「符合」的签认结论由本人做出**，AI 未代填。C1 由本人冻结（是）。
- D4（9/10）阶段 2 前置缺口由 AI 只读核对发现并报告：未下载外部归档、未安装依赖、未产出任何 token 估算值，
  避免产出不可复核的计量结果。未触发需记 `DEBT.md` 的欠债。
- D4（9/10）阶段 2 由 AI 执行：重新获取官方 tokenizer 归档（先校验 sha256 与 D1 一致再使用）、在
  `week13-rag/.venv`（python3.12.10）安装 `transformers 4.57.6` / `tokenizers 0.22.2` 与模板渲染所需的
  `jinja2`，实现并运行计量脚本。等价性用**复现 D1 实测 token 数**验证，而不是只声明版本相同。C1 口径、
  冻结窗口与冻结值由本人确认；AI 未改 Prompt、Evidence Context 或冻结配置。`.cache/` 与 `.venv/` 均被
  `.gitignore` 覆盖，未把二进制资产纳入版本控制。未触发需记 `DEBT.md` 的欠债。
- D4（9/10）测试/门禁缺口修复由本人指定排入本次：AI 改 `w13rag.sh check`、新增 parser fixture 用例，并按
  「验证方法必须能触发目标机制」重放实验 1 证明修复后会红、还原后恢复全绿。根因分层由 AI 整理、本人确认
  排期；未触发需记 `DEBT.md` 的欠债。
- D4（9/10）阶段 3 由 AI 实现并自测：扩展 W12 客户端的 `model` / `thinking` / `max_tokens`（W12 32 passed）、
  新增 W13 `generation.py` 与 8 条用例、把计量脚本收敛到同一组装函数（计量证据逐字节不变）。官方 Thinking Mode
  的请求形状由 AI 查证并落盘，是否采用由冻结契约决定、语义未被改动。未读取 `.env`、未发起真实调用、
  未读 holdout；未触发需记 `DEBT.md` 的欠债。
- D4（9/10）**判定入口偏离已冻结 eval 契约**，已记 `DEBT.md`（未还）：AI 生成的
  [`dev-semantic-checklist-worksheet.md`](week13-rag/notes/dev-semantic-checklist-worksheet.md) 在契约外重述判定
  规则——L23 把 `scoring-contract.md` §2 的逐题合取写成「机械+语义合计 ≥9/10」，L21 与每题模板 L67 把机械失败
  开放为「语义失败或格式/解析噪声」待定项，L651-L652 让 per-class 门禁取决于该定性；阶段 5 起始问（D0）进一步
  把已冻结规则列为待决项，该选项已撤回。**未发生改判**（判定框全空、结论未写出）；但按该口径改判会触发契约
  §7 L107 的「运行无效」。item 3 / item 4 按契约 §2 L40 与 §7 L109 维持失败，其 claims 只作归因材料（response
  parsing / response schema），人工语义判定只在可解析的题上进行。incident 记录待修复后再写。
- D4（9/10）判定入口修正：`dev-semantic-checklist-worksheet.md` 已按契约拉回——§0 声明唯一规则来源并删除自定
  判定线、10 处题内模板行改为归因口径、§11 通过数改按契约 §6。判定语义未新增或放宽；`scoring.py` 的
  `needs_human_semantic_review` 的语义仍待确认与改造。判定入口护栏已加：
  `eval/scripts/verify-decision-entry.mjs`（入口须引用 `scoring-contract.md`，不得命中 4 条规则重述模式）+
  `w13rag.sh guard`；可证伪验证：写回越界句 → exit 1、移除契约引用 → exit 1、正常入口 → exit 0。
- D4（9/10）评估层重构（本人冻结方案 A，AI 实现并自测，以 LangChain / LangGraph 为参照）：`src/w13rag/scoring.py`
  改为 `run` / `evaluators` / `verdict` 三层，判定收敛到单一 `decide_item()`（任一适用条件为 False 即 fail，
  结构失败不可能被语义判定翻转），`summarize()` 输出 `pass` / `fail` / `incomplete` 与 `max_achievable_pass_rate`。
  自测 44 passed；`w13rag.sh check` 与冻结基准 `8a02c665…` 三一致；`scripts/rescore-baseline.py` 离线重评旧证据
  复现 `mechanical.passed=7` 与同样 3 条失败（等价性证据）。旧证据不重写，新结构用于后续运行的 `-scoring-v2`。
- D4（9/10）硬化项（单因素，本人冻结顺序）：只加 provider 原生 JSON 输出约束，Prompt 不动。W12 `DeepSeekClient`
  增加 `response_format` 透传（35 passed，覆盖率 98.00%，mypy 9 文件通过）；W13 新增 `FROZEN_RESPONSE_FORMAT` 与
  第七态 `empty_content`（官方提示可能返回空内容），由 payload 用例证明字段确实发出（45 passed，`check` 与冻结
  基准三一致，`guard` 通过）；字段已登记 [`model-policy-v1.md`](week13-rag/config/model-policy-v1.md) §2.1。
  **待授权**：真实调用重跑 dev（10 条）以取得新证据；`§3 示例是否并入 §1` 的决定留到重跑数据之后。
- 剩余：worksheet 逐题语义判定、重跑后的阶段 5 结论、BM25。

- D4（9/10）dev 判定收口（本人逐条判定，AI 只贴素材与回填）：新证据
  `dev-full-context-prompt-v1-json-output-01.json`（Prompt v1 + `response_format`，10 条真实调用）。机械 8/10、
  格式类失败清零；10 条人工判定后通过 4 条（2、3、9、10），**split 未通过**。判定口径 R1 于运行后澄清并记录在
  [`scoring-rulings-r1.md`](week13-rag/eval/scoring-rulings-r1.md)。失败归因分布与结构性观察见 D4 笔记 §6.14；
  旧证据未重写。未触发 `DEBT.md` 新欠债。

- D4（9/10）Prompt v2 实验（本人选定的单因素变更，AI 实现并自测）：§1 新增第 13 条 citation 粒度约束，用 v2 重跑
  dev（10 条真实调用）→ 机械 7/10、`precision_min` 0.8，跨块合并未消除（3 处）。**假设未成立**；因运行间波动，
  单次运行不足以归因，故未作 v1/v2 优劣结论。默认已回滚到 v1（`W13_PROMPT_PATH` 可指向 v0/v1/v2），v2 文件与
  两轮证据全部保留。未触发 `DEBT.md` 新欠债。

- D4（9/10）BM25 / dense / hybrid 三段实现与同集对照（本人逐项冻结 B1–B4、D1–D4、H1；AI 实现并自测）：
  `src/w13rag/retrieval.py`、`retrieval_dense.py`、`retrieval_hybrid.py` + `scripts/verify-e5-onnx.py`、
  `scripts/run-retrieval-eval.py`（双后端 + hybrid）+ 44 条检索类测试（全量 70 passed）。结果：BM25 5–7/8、
  dense 3–5/8、hybrid 4–7/8，均未过 B4.1 门禁；hybrid 按预设退出条件记为「扩展项未达标」。
  dense 模型来自社区镜像 `hf-mirror.com`（**未与官方 hash 交叉验证**，已在冻结记录中标明）。
  阶段 5 结论见 D4 笔记 §6.19；**未触发** `DEBT.md` 新欠债（全部语义由本人冻结）。
- 延迟重建入口（W15 或更早第一个 15–20 分钟单元）：不看代码重建 **retrieval 确定性数据流**——
  `registry entry -> Document(page_content=model_content, metadata 6 字段) -> tokenize/embed -> 打分排序(并列按
  registry_index) -> top_k 候选 -> requirement_recall(交集口径) -> item/split 判定`，并解释「retrieval result 与
  Evidence Context 的区别」。
