# 当前学习状态

> 最后更新：2026-09-09（Asia/Shanghai）
> 当前入口：W13 D3 完成（9/9）：D3 serialization 契约冻结闭合；D4 前置分摊——确定性 parser / citation
> registry / Evidence Context 实现并自测（tests 9 passed、572 blocks、真实整串 sha256 `8a02c665…` 双跑一致、
> 覆盖审计 0），判据 #1–#7 逐字已确认，整串基准已冻结
> （`week13-rag/evidence/serialization/frozen-rules-c0a4b85.sha256`）。代码 review 已完成（source/parser/cli
> + README 导读 + review 工作表），语义点 A1–A8 批注未回填 → **L1 验收未正式闭合**。下一步 = 回填 A1–A8
> 批注 → serialized 输入计量与 context budget → 全语料上下文 dev baseline 门禁。
> D4 详细计划已建立（9/9），但 D4 尚未开始；计划使用“baseline 核心完成对象 + 条件 BM25 附加项”，不把
> 未闭合门禁叠加到日历任务。
> 本文件只保留当前进度、有效决定、风险和下一步；阶段结论与必要纠错见每日笔记。

## 当前周与目标

- 当前周：**W13（9/7-9/11，RAG Foundations）**。
- 当前阶段：**D3 已收口；D4 serialization 实现里程碑（L1）已完成并自测**（parser/registry/Evidence Context、
  fixture 回归、真实语料判据执行、整串基准冻结；判据 #1–#7 已由本人确认）。D2 的 eval、Prompt/schema、source
  block/source identifier/citation registry 已闭合。尚未进入输入计量/context budget、baseline、BM25/dense。
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

## 当前主线

**serialization 实现里程碑（L1）已实现并自测；代码 review 已完成，验收待闭合**。剩余完成条件：
1. 本人回填 review 工作表语义点 A1–A8 批注（符合/有疑问/需改动），需要改动则改实现 → 重跑 → 必要时重冻结
   整串基准；回填完成即正式闭合 L1。
2. serialized 输入计量与 context budget（整串 89,854 chars → estimated tokens，复用 W12 tokenizer 流程）。
3. 客户端接线验证显式 `thinking: disabled` 后，进入全语料上下文 dev baseline 门禁。
4. baseline 证据形成后进入 LangChain BM25（先解释框架映射，由本人冻结 chunk/retrieval 取舍，再由 AI 接线并自测）。

D4 详细执行顺序、完成对象和止步条件见
[`day4-full-context-baseline-and-bm25.md`](week13-rag/notes/day4-full-context-baseline-and-bm25.md)。

serialization 契约与实现证据：
- 契约：[`day3-freeze-serialization-contract.md`](week13-rag/notes/day3-freeze-serialization-contract.md)
- 判据确认清单：[`serialization-criteria-confirm-checklist.md`](week13-rag/notes/serialization-criteria-confirm-checklist.md)

## 当前阻塞与风险

- 真实语料判据 #1-#7 已执行并通过（7 文件 uncovered/duplicated=0；572 blocks；整串 sha `8a02c665…` 双跑一致），
  判据逐字已确认、整串基准已冻结。代码 review 已完成；语义点 A1–A8 批注未回填，L1 未正式闭合。语义边界质量
  由 dev eval 暴露（D2 声明，非本阶段阻断）。
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

**当前入口**：serialization 实现里程碑（L1）已实现并自测，代码 review 完成；判据确认与整串基准冻结完成。
D4 第一动作 = 本人回填 review 工作表 A1–A8 批注（决定是否需要实现改动/重冻结），随后按顺序：
① 回填 A1–A8 → L1 闭合；② serialized 输入计量与 context budget；③ 客户端接线验证 `thinking: disabled`
→ 全语料上下文 dev baseline；④ LangChain BM25。

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
- 判据确认清单：[`serialization-criteria-confirm-checklist.md`](week13-rag/notes/serialization-criteria-confirm-checklist.md)
- W12 最近一次完整验证：pytest 30 passed，`src` 行覆盖率 97.89%，mypy 对 9 个源文件通过。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week13-plan.md`](week13-rag/notes/week13-plan.md)。
3. [`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)。
4. [`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)。
5. [`day3-freeze-serialization-contract.md`](week13-rag/notes/day3-freeze-serialization-contract.md)。
6. [`day4-full-context-baseline-and-bm25.md`](week13-rag/notes/day4-full-context-baseline-and-bm25.md)。
7. 当前任务相关的 `git status --short` 与 diff。

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
- 当前无活动中的 `DEBT.md` 欠债；本轮规则与计划修订不代填尚未确认的 D3 语义。
- D4 前置分摊（9/9）：本人冻结判据 #1–#7 逐字语义并逐条确认（判据 3 保留 `<source` 前缀守卫）；AI 实现
  parser/registry/Evidence Context 并自测（fixture 回归 + 真实语料不变式 + two-pass），机械执行判据追认记录、
  整串基准冻结与状态同步；语义与判据未由 AI 代填，未触发 `DEBT.md`。
