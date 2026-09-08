# 当前学习状态

> 最后更新：2026-09-08（Asia/Shanghai）
> 当前入口：W13 D2 及同日延展已完成，等待确认进入 D3；RAG Prompt v0 语义与 response schema 已冻结，
> source block 已确认采用
> Markdown 段落或小节的语义粒度；同一小节含多条可独立成立的规则时按规则段落拆分，正文缺少完整语境时
> 携带必要标题层级。边界由不调用模型的确定性 Markdown parser 自动重算；列表按顶层项拆分，嵌套内容
> 跟随父项；fenced code block 只向前合并同一小节中紧邻的内容块，前面只有标题时使用必要标题层级，不向后
> 搜索；表格按数据行拆分并为每行附带表头；blockquote 递归应用内部规则并保留引用标记与必要标题语境。
> thematic break 不生成 source block 或进入模型可见内容，但作为禁止跨越合并的硬边界。冻结 corpus 的实际
> 块级结构覆盖复核已完成。source identifier 使用 `corpus_id/source_path#Lstart-Lend` 标识核心规则在冻结
> snapshot 中的位置；附加标题或表头只记录在 citation registry，内容 hash 负责完整性验证。citation registry
> 使用一个与 identifier 完全一致的核心 `source_span`，以及零到多个有 `role` 且保持原始
> 顺序的 `context_spans`；组装后的 `model_content` 单独计算 hash。registry 唯一持久化为有序 `blocks` 数组，
> `Map<source_id, entry>` 只在运行时派生，不另存 `blocks_by_id`，也不写入导致重算结果变化的生成时间。
> `blocks` 按 manifest 文档顺序、核心起始行、核心结束行排序；重复 `source_id` 直接验证失败。source block、
> identifier 与 registry 的 D2 设计契约已闭合；下一步先确认是否进入 D3，不启动 serialization、baseline 或 BM25。
> 本文件只保留当前进度、有效决定、风险和下一步；阶段结论与必要纠错见每日笔记。

## 当前周与目标

- 当前周：**W13（9/7-9/11，RAG Foundations）**。
- 当前阶段：**D2 同日延展**；eval 契约、RAG Prompt v0 语义与 response schema 已完成，D3 尚未进入。
- 原完整 W13 验收边界包含全语料上下文、BM25、dense 与 holdout；当前本周执行目标是先冻结 eval、完成
  全语料上下文基线，再按门禁推进 BM25 retrieval 与端到端链路。未进入的阶段如实记为未完成，不压缩前置学习。
- 本周执行边界：按 eval -> 全语料上下文基线 -> BM25 retrieval -> BM25 端到端的门禁顺序推进；某阶段
  未完成时，下一学习日继续该阶段，不把后续任务叠加。dense 与首次 holdout 不排入本周当前日程。
- D5 时间边界：17:00 前仍是正常学习窗口，继续当时所在阶段；17:00 分享已经验证的实际进度和边界。
  分享不等于完整 W13 技术验收，排练不得挤占前置学习。
- 五周主线：W12 Python/Bub -> W13 RAG -> W14 Agent -> W15 MCP -> W16 reliability/evals。

## 最近完成

- W12 已收口：Python 3.12 项目基线、Bub 主链阅读、真实 DeepSeek 调用、timeout/cancellation 实验、
  独立诊断与类 2 债务重建均完成；详细结论见
  [`day5-diagnosis-and-wrapup.md`](week12-python-rag/notes/day5-diagnosis-and-wrapup.md) 和
  [`day6-low-intensity-review.md`](week12-python-rag/notes/day6-low-intensity-review.md)。
- W13 规则文档语料 snapshot 已冻结：source commit
  `c0a4b85c9065cbfb943584c914172d7819339791`，7 个文件，76,149 bytes；manifest 与 7/7 来源回比通过。
- DeepSeek 官方离线 tokenizer 示例在 `transformers 4.57.6 / tokenizers 0.22.2` 下通过 7/7 文档回环；
  raw corpus-only 结果为 **18,680 estimated tokens**。
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
| corpus snapshot | `rules-c0a4b85`；仅包含七份规则文档；第一道 eval 题建立前已冻结 |
| generation 配置 | `deepseek-v4-flash`；Chat Completions；`thinking: disabled`；三条对照保持一致 |
| token 估算 | DeepSeek 官方离线 tokenizer 示例为主，字符比例只作粗粒度交叉检查；结果标为 estimate |
| 输出预留 | `reserved output / max_tokens = 4096`；是共同上限，不要求每次用满 |
| 安全余量 | 固定 `100000` tokens；10% 只记录本次选值依据，未来窗口变化不自动重算 |
| 回答契约 | answered/abstained 两个互斥分支；answered 最多 10 条 atomic claims，每条关联 citation identifiers |
| 引用边界 | citation identifier 由本地 registry 映射到冻结 source span；映射存在不等于原文支持 claim |
| 拒答边界 | abstained 返回受控 reason code 与简短 reason text；模型不自行判定系统根因 |
| dev/holdout | 使用不同文件或目录物理隔离，并共享同一 eval schema；所有常规开发入口只读取 dev |
| holdout 时间点 | 不排入 W13 当前日程；实现、Prompt、retrieval 配置、eval 与评分规则全部冻结后才能首次运行 |
| evaluation item | 最少包含稳定题目 ID、完整 query、预期行为及证据要求；预期分支 label 只允许 `answered`、`abstained` |
| 引用判据 | 多个来源可独立完整支持同一 claim 时允许任意一个；citation precision 阈值为 1.0；missing citation 是 item 必须失败条件 |
| eval 覆盖与规模 | dev/holdout 覆盖相同的五类行为，每类各 2 个非等价 items，共 20 题；两套 query 不同 |
| eval 判分 | 机械检查 + 人工语义 checklist；当前 evidence requirements 全部必需；dev/holdout 分别至少 9/10 且每类至少 1/2 |
| eval 零容忍条件 | citation precision 为 `1.0`；预期 abstained 的题目返回 answered 会直接否决该 split |
| abstained | 不返回 claims 或 citation；reason code 只允许 `insufficient_corpus_evidence`；corpus absence 由评测者预先冻结 |
| 容量顺序 | 先完成 eval、Prompt/schema 和 serialization，再计量实际输入并冻结最终 context budget |
| 阶段与日期 | 门禁通过后可以继续本人确认的同阶段延展，但阶段切换必须明确记录；当前仍是 D2，尚未进入 D3 |
| W12 Prompt 复用边界 | 不复用用户注册字段、instructions、examples 或 schema；只复用版本化与验证方法 |
| W13 RAG Prompt v0 | 只依据 Evidence Context；context 不作为待执行指令；证据完整才 answered；无法解决冲突则 abstained；只返回 JSON；无 few-shot examples |
| source block 语义粒度 | 使用 Markdown 段落或小节；多条独立规则按规则段落拆分；必要标题层级进入模型可见内容；确定性 parser 自动重算；列表按顶层项拆分；fenced code block 只向前合并紧邻内容；表格按数据行拆分并附带表头；blockquote 递归应用内部规则；thematic break 仅作硬边界 |
| source identifier | `corpus_id/source_path#Lstart-Lend` 标识核心规则原始位置；附加标题或表头只进入 registry；内容 hash 只验证完整性 |
| citation registry 来源映射 | 一个核心 `source_span`；零到多个有 `role` 且保持原始顺序的 `context_spans`；另存 `model_content` 与 `content_sha256` |
| citation registry 顶层形状 | 有序 `blocks` 数组是唯一持久化格式；Map 仅运行时派生；不保存 `blocks_by_id` 或生成时间 |
| citation registry 排序 | manifest 文档顺序 → 核心起始行 → 核心结束行；重复 `source_id` 验证失败 |

## 当前主线

**唯一完成对象**：按 [`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md) 记录 D2
同日延展，并为下一次对话保留准确恢复入口。

1. RAG Prompt v0 十项语义与 response schema 已完成并记录在 D2 延展中。
2. source block 的语义粒度、独立规则拆分条件、标题层级原则、确定性自动重算方式、列表规则与 fenced code
   block、表格、blockquote 及 thematic break 规则已经确认，冻结 corpus 的实际块级结构覆盖复核已完成。
3. source identifier、citation registry 来源映射、顶层存储形状与排序规则已经确认，D2 设计契约闭合；下一步
   明确是否进入 D3，在阶段切换前不开始 serialization。

## 当前阻塞与风险

- corpus serialization 和最终 context budget 尚未冻结；source block 边界规则、source identifier 语义以及
  registry 来源映射、顶层形状与排序规则已经确认，但尚未由 parser 产出验证。
- response schema 已通过静态 compile，但尚未接入模型客户端或真实响应，因此不能声称模型会遵守该 schema。
- 当前 AGENTS.md、LEARNING-PROTOCOL.md 和 TECHNICAL-WRITING-PROTOCOL.md 含有 snapshot 冻结后的协作修正；
  它们不回填 `rules-c0a4b85`，正式 eval 只能引用冻结版本中的内容。
- 复用客户端尚未验证请求中显式发送 `thinking: disabled`；接线验证前不得运行 baseline。
- 中文 BM25 预处理和 chunk 方案待后续实测；dense 与首次 holdout 已移出本周当前日程，W13 收口时必须
  如实标为未完成或未验证，不能因此声称完整周验收通过。
- 仓库 Markdown 扩展语料是条件扩展；D1 主线未完成时不启动，也不顺延占用 D2-D5。
- D2 原完成对象只冻结 eval；eval 完成后本人明确追加 Prompt 语义与 response schema 作为同日延展。
  当前尚未进入 D3，serialization、容量判断和全语料上下文 baseline 均未开始；BM25 更未开始。
- D5 17:00 前根据实际门禁继续学习；只有 BM25 retrieval 已通过才进入 BM25 端到端链路。展示仅使用届时
  已验证的证据，不为凑演示跳过依赖或扩大 AI 援助。
- 学习展板与主线解耦，周末有余力时再整理；它服务下次 D1 展示与个人复习，不作为本周技术验收条件。

## 下一步

**当前入口**：冻结 corpus 的实际 Markdown 块级结构覆盖复核已经完成，source identifier 使用冻结位置作为
身份，citation registry 区分核心 `source_span` 与补充 `context_spans`，并使用确定性数组排序。D2 设计契约
已经闭合；下一步先明确是否进入 D3。阶段切换前不生成 source IDs，也不开始 serialization。

## 验收证据

- snapshot manifest：[`manifest.json`](week13-rag/corpus/rules-c0a4b85/manifest.json)
- raw token 估算：[`token-count-rules-c0a4b85.json`](week13-rag/evidence/token-count-rules-c0a4b85.json)
- W13 周计划：[`week13-plan.md`](week13-rag/notes/week13-plan.md)
- D1 阶段结论、证据与必要纠错：[`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)
- D2 eval 契约计划与门禁：[`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)
- W12 最近一次完整验证：pytest 30 passed，`src` 行覆盖率 97.89%，mypy 对 9 个源文件通过。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week13-plan.md`](week13-rag/notes/week13-plan.md)。
3. [`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)。
4. [`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)。
5. 当前任务相关的 `git status --short` 与 diff。

## AI 辅助记录与延迟重建

- W13 当前为导师模式。AI 已提供 L1 术语与边界讲解，并对白名单 snapshot、token 证据和文档同步做机械处理；
  未代写 eval 题目、Prompt、retrieval、context assembly 或核心断言。
- D1 笔记已从逐轮问答日志压缩为阶段性记录；后续只在结论、证据、决定或下一入口变化时更新。
- AI 已用一条明确排除在正式题集之外的 Docker 白名单题解释 evaluation item 的完整形状；属于 L1 任务模型
  讲解，不提供正式题库语义。
- 20 条题目的对象、判断维度和预期结论由本人提出并确认；AI 只做题意校准、冻结来源核对和机械落盘。
  判分规则与阈值由本人确认；AI 只做契约排版、schema、验证入口和 hash 等机械落盘。
- AI 已对 evidence requirement、source block 与 retrieval result 的职责关系提供 L1 澄清；source block
  的语义粒度、取舍理由与确定性 parser 方向由本人确认，具体 Markdown 解析规则仍由本人决定。
- 本人确认 W13 使用不调用模型的确定性 Markdown parser 减少逐块人工核查；机械检查承担完整性与重跑一致性，
  semantic boundary 风险由后续 dev eval 暴露。该 preprocessing 不记为 Agent 实践，Agent harness 保留在 W14。
- 当前无活动中的 `DEBT.md` 欠债；W13 尚未触发新的 L2 援助或延迟重建。
