# W13 D2（9/8）：冻结 eval 契约

> 建立：2026-09-08（Asia/Shanghai）。
>
> 状态：已完成（D2 及同日延展；本人随后已明确进入 D3）。`w13-eval-v1` 的题意、判分契约、dev/holdout 物理隔离、共享 schema 与
> hash 已冻结；随后按本人决定在 D2 内补充 RAG Prompt v0 语义与 response schema，并确认 source block
> 使用 Markdown 段落或小节的语义粒度；同一小节包含多条可独立成立的规则时，按独立规则段落拆分。
> 标题层级按模型能否仅凭正文确定规则适用对象和结论决定是否进入模型可见内容。精确边界的可重复记录方式
> 已确认由不调用模型的确定性 Markdown parser 承担；Markdown 列表按顶层列表项拆分，嵌套内容跟随父项。
> fenced code block 与同一小节中直接说明其含义的相邻内容共同形成 source block。
> 机械邻接固定为向前合并同一小节中紧邻的 Markdown 内容块；前面只有标题时使用必要标题层级，不向后搜索。
> 表格按数据行拆分，每行附带表头。blockquote 作为容器递归应用内部规则，并保留引用标记与必要标题语境。
> thematic break 不生成 source block 或进入模型可见内容，但作为禁止跨越合并的硬边界；冻结 corpus 的实际
> 块级结构覆盖复核已完成。source identifier 使用 `corpus_id/source_path#Lstart-Lend` 标识核心规则在冻结
> snapshot 中的位置；附加标题或表头只进入 citation registry，内容 hash 负责完整性验证。registry 为每个
> block 记录一个核心 `source_span` 与零到多个有 `role` 且保持原始顺序的 `context_spans`，并另存实际
> `model_content` 及其 hash。registry 唯一持久化为有序 `blocks` 数组，运行时按需派生 Map，不额外保存
> `blocks_by_id`，也不记录会破坏重算一致性的生成时间。`blocks` 按 manifest 文档顺序、核心起始行、核心
> 结束行排序；重复 `source_id` 直接验证失败。至此 source block、identifier 与 registry 的 D2 设计契约闭合。
> D2 收口时未运行模型或 holdout。后续阶段状态以 `LEARNING-STATE.md` 为准。
>
> 本文件是 D2 阶段工作表与执行记录，不要求用一个自然日强行完成。D1 未完成项不再整体打包进 D2；D2
> 只处理 eval 契约。后续是否进入 RAG Prompt 与全语料上下文基线，由本文件的退出门禁决定。
>
> 协作模式：导师模式。题目语义、指标、阈值、通过标准和核心断言由本人冻结；AI 负责术语讲解、事实核对、
> 冻结来源定位，以及 schema 排版、稳定 ID、JSON 和 hash 等机械工作。

## 1. 当前事实

- 规则文档语料 snapshot `rules-c0a4b85` 已冻结；以 source commit 为基线并显式记录不移动既有正文行号的
  `repository-content-v1` normalization，7 个文件共 76,243 bytes。
- raw corpus-only 结果为 18,697 estimated tokens；完整 serialized input 与 provider usage 尚未产生。
- evaluation item 的最小结构、五类行为、dev/holdout 物理隔离与 20 题规模已冻结为 `w13-eval-v1`。
- answered/abstained 单题条件、人工语义 checklist、metrics、thresholds 与整套 passing criteria 已由本人冻结。
- 原 D2 完成对象不包含 RAG Prompt；eval 完成后，本人明确把 RAG Prompt v0 语义与 response schema 作为
  D2 同日延展。serialization、最终 context budget 和全语料上下文 baseline 尚未开始。
- 本人已确认 source block 使用 Markdown 段落或小节的语义粒度；同一小节包含多条可独立成立的规则时，
  按独立规则段落拆分，以提供明确的引用边界。正文不能独立说明规则适用对象和结论时，必要的 Markdown
  标题层级必须进入模型可见内容。本人已确认使用不调用模型的确定性 Markdown parser 自动重算边界，减少
  逐块人工核查；列表按顶层列表项形成 source blocks，嵌套内容跟随父项。fenced code block 不因依赖语境
  而排除，且不生成缺少必要语境的
  独立代码 block；它只向前合并同一小节中紧邻的 Markdown 内容块，前面只有标题时使用必要标题层级，不向后
  搜索说明内容。表格的每个数据行分别形成 source block，并附带同一份表头。blockquote 内部递归应用已经
  确认的段落、列表与 fenced code block 规则，同时保留引用标记与必要标题语境。thematic break 不形成证据
  内容，但作为禁止跨越合并的硬边界；实际块级结构覆盖复核已经完成。source identifier 的身份语义已经确认，
  citation registry 的核心规则与补充语境来源映射及顶层存储形状也已确认；尚未生成 source IDs 或开始
  serialization。registry 的确定性排序与重复 ID 失败规则已确认，D2 设计契约闭合。

## 2. 唯一完成对象

**完成对象**：一个版本明确、dev/holdout 物理隔离且可以被确定性读取的 eval 契约。

完成条件：

1. 20 条题目均包含准确 query、预期分支、预期规则结论和 evidence requirements。
2. dev 与 holdout 各 10 条，覆盖相同五类行为，但 query 非等价。
3. metrics、thresholds、item-level passing criteria 与整套 eval 的 passing criteria 已由本人冻结。
4. 每个判据都说明从模型输出、registry 或冻结 source span 中观察什么，不使用主观表述。
5. dev/holdout 使用不同文件或目录并共享同一 schema；所有常规开发入口只能读取 dev。
6. eval 版本、稳定 ID、source span identifier 和 hash 可复核；holdout 未运行、未查看结果。

任一项缺失，D2 阶段按未完成记录；下一学习日继续本对象，不并行启动 Prompt 或 baseline。

## 3. 开工门禁

- [x] 已按 `LEARNING-PROTOCOL.md` 恢复状态，并读取本文件、D1 收口、周计划与 `git status --short`；
  开工时工作树干净，当前 HEAD 为 `29c22fc`。
- [x] 正式题目只引用 `rules-c0a4b85`；manifest 仍绑定 source commit `c0a4b85c9065cbfb943584c914172d7819339791`，
  现行协作规范只约束协作，不回填 snapshot。
- [x] 开工时尚未创建 eval runner 或 holdout 文件；D2 不运行模型，后续机械落盘仍须验证常规入口只读取 dev。
- [x] 本阶段只冻结 eval，不追加 RAG Prompt、容量、BM25、dense 或展示工作。

## 4. 执行顺序

### 4.1 冻结剩余题意

- [x] “直接可回答”类的 `dev-1`、`dev-2`、`holdout-1`、`holdout-2` 已由本人确认题意；AI 已完成
  source span 定位与当前机械结构。
- [x] “跨文档”类的 dev 2 题与 holdout 2 题已由本人确认题意；AI 已核对每题包含至少两个冻结文档的
  evidence requirements，并完成当前机械结构。
- [x] “近似表述”“优先级/冲突/例外”和“无答案”三类共 12 题已一次提交、一次 review 并由本人确认；
  `no_answer` 的最后一题按本人确认的 fallback 改为冻结 corpus 未记录的服务器操作系统版本问题。
- [x] 本人对每题提供准确 query、预期分支和一条预期规则结论；结论存疑时显式标注，由 AI 依据 snapshot
  核对，不据此替本人另选题目。
- [x] 每题只处理一个设计点；需要多个规则才能成立的结论已明确 evidence requirements，没有把多个独立问题
  塞进一题。
- [x] 每批确认后立即固定语义；AI 已批量定位 source spans 并处理当前机械结构，未要求本人逐字段录入。

### 4.2 冻结判分契约

- [x] 本人已冻结五类题目的通用与题目级 item passing criteria；当前 evidence requirements 全部必需，
  真正等价的来源才允许显式替代，`w13-eval-v1` 没有替代组。
- [x] 本人已冻结全局 metrics、thresholds 与整套 eval 的 passing criteria：每个 split 独立要求至少 9/10，
  每类至少 1/2，citation precision 为 `1.0`；两个 split 不跨集平均。
- [x] answered 与 abstained 分支的可观察行为已冻结：answered 为 1 至 10 条 atomic claims 且每条关联
  citation；abstained 不返回 claims 或 citation，只使用 `insufficient_corpus_evidence` 与一致的简短文本。
- [x] 预期 abstained 的题目被强行回答会直接否决该 split；`corpus_absence` 是评测者预先冻结的判分依据。
- [x] 机械检查与人工语义 checklist 的职责已分开；全语料上下文 baseline 没有 retrieval，不预建 retrieval
  miss 结论。

### 4.3 机械落盘与隔离验证

- [x] AI 已根据本人确认的语义生成共享 schema、dev/holdout 文件、稳定 ID、source span identifiers、
  判分契约与 manifest hash。
- [x] dev/holdout 数量、行为类型覆盖、ID/query 唯一性、结构、source span 和 hash 验证已通过。
- [x] 默认验证入口只读取 dev；只有显式 `--all` 才执行 D2 双 split 静态契约检查。本阶段未运行模型，
  未产生或查看 holdout 输出。
- [x] eval version `w13-eval-v1` 与验证命令已保存，D3 可以直接读取冻结 dev set。

## 5. 响应式执行规则

1. 每条 evaluation item 只处理一个设计点；不要求每题单独占用一轮对话。同一行为类型或共享同一概念前提的
   题目，可以把必要讲解、题意提交、批量 review 和来源核对合并为一轮；只有会改变契约的歧义才单独确认。
2. 计划外练习必须先标明并由本人确认；补充讲解结束后返回当前未完成项。
3. AI 的来源搜索、机械落盘和验证尽量批量执行；等待时间视为实际日历成本，不利用等待新增学习支线。
4. 每完成一类题意或一个门禁才更新本文件；不按对话轮次追加流水账。
5. 本人无需定向翻阅来源以确认 API 或格式细节；但 query、预期行为和规则结论仍由本人决定。
6. 当日精力不足或对话等待导致未完成时，停在当前门禁并记录下一入口，不压缩判据、不由 AI 代填，也不
   叠加 D3 工作。

## 6. D2 原边界与同日延展

- 原边界是在 eval 门禁通过前不设计或实现 RAG Prompt、response schema、serialization、context budget 或
  full-context baseline；该边界在 eval 冻结期间得到遵守。
- eval 完成后，本人明确继续 D2，并确认 RAG Prompt v0 的十项语义；AI 已机械创建独立 Prompt 与 response schema。
- source block 已确认使用 Markdown 段落或小节的语义粒度；同一小节包含多条可独立成立的规则时按规则段落
  拆分。正文依赖标题才能确定适用对象或结论时，必要标题层级进入模型可见内容。边界由不调用模型的确定性
  Markdown parser 自动重算；列表按顶层列表项拆分，嵌套内容跟随父项；fenced code block 与同一小节中直接
  说明其含义的相邻内容共同形成 source block；表格、blockquote 与 thematic break 规则均已确认。冻结 corpus
  的实际块级结构覆盖复核已完成。serialization、citation registry、context budget 和 baseline 尚未开始。
- 不实现 ingestion、chunking、BM25、context assembly、generation 或 citation registry。
- 不运行 holdout，不查看 holdout 结果，不根据 holdout 调参。
- 不启动 dense、hybrid/RRF、仓库 Markdown 扩展语料、UI、学习展板或分享排练。
- 不自动 commit、push 或 merge。

### 6.1 Source block 概念边界与粒度决定

- **原理解歧义**：`evidence requirement` 与 `retrieval result` 在未先解释职责时和三种粒度连续出现，容易被
  理解为整份文档、Markdown 段落或小节、单行分别对应三个概念。
- **澄清后的职责**：`evidence requirement` 是评测者在运行前冻结的证据标准，不发送给模型；source block
  是实际进入 Evidence Context、带 source ID 的证据单元；`retrieval result` 是 retrieval 针对 query 产生的
  运行输出，经过 context assembly 后才决定哪些内容实际进入 Evidence Context。
- **本人决定**：source block 使用 Markdown 段落或小节的语义粒度。理由是它能保留一条规则所需的上下文，
  同时提供比整份文档更明确、比单行更完整的引用边界，适合当前规则文档语料。
- **段落拆分条件**：同一 Markdown 小节包含多条可独立成立的规则时，按独立规则段落拆成多个 source blocks，
  以提供明确的引用边界。
- **标题层级原则**：每个 source block 必须让模型独立确定规则的适用对象和结论。规则正文脱离标题仍完整时
  只使用正文；正文依赖标题时，把必要的 Markdown 标题层级一并放入模型可见内容。规则段落可以不依赖同一
  小节中的其它规则，但仍然依赖所属标题；此时独立的是标题与正文组成的 source block，不是正文自身。
- **可重复生成方式**：本人确认使用不调用模型的确定性 Markdown parser，从同一 snapshot 自动重算 source
  blocks。机械检查负责正文无遗漏或重复、冻结行范围可回读，以及 IDs/hashes 重跑一致；semantic boundary
  是否有效由后续 dev eval 暴露，不逐块执行人工语义切分。该 preprocessing 不属于 Agent，Agent harness
  仍保留在 W14。
- **列表规则**：每个顶层 Markdown 列表项分别形成 source block；属于该列表项的嵌套列表和续行跟随父项，
  不单独切分。该规则用更精确的引用边界保留例外与所属规则的关系。
- **Fenced code block 规则**：fenced code block 不因依赖语境而从冻结 corpus 排除；它与同一小节中直接说明
  其含义的相邻内容共同形成 source block，不生成缺少必要语境的独立代码 block。代码进入 Evidence Context
  不等于模型必须引用；只有代码实际支持 claim 时才返回对应 citation identifier。确定性 parser 只向前合并
  同一小节中紧邻代码的 Markdown 内容块；若前面只有标题，则使用必要标题层级与代码共同形成 source block；
  不向后搜索说明内容。
- **表格规则**：每个 Markdown 表格数据行分别形成 source block，并为每行附带同一份表头。该规则提高行级
  引用边界的精确度，同时保留各单元格的列语义；重复表头产生的 token 增量在 assembled input 计量时记录。
- **Blockquote 规则**：blockquote 作为容器，内部递归应用已确认的段落、顶层列表项、嵌套内容与 fenced code
  block 规则；生成的 source block 保留 blockquote 标记与必要标题语境。单行 blockquote 仍只形成一个 block，
  不因递归处理被继续拆分。
- **Thematic break 规则**：Markdown thematic break（`---`）不生成 source block，也不进入模型可见内容；
  它作为硬边界，禁止前后内容因邻接规则合并。冻结 corpus 的静态扫描未发现需要新增规则的其它独立块级内容；
  缩进行是列表续行，类 HTML 占位内容位于 fenced code block 内，均由现有规则覆盖。
- **Source identifier 规则**：`source_id` 使用
  `corpus_id/source_path#Lstart-Lend`，标识核心规则在冻结 snapshot 中的原始位置。必要标题或复制表头只记录在
  citation registry，不扩大 identifier 的行范围；模型可见内容的 hash 用于完整性校验，不作为身份。该格式
  与冻结 eval 已使用的 `span_id` 位置格式保持一致，但 eval 的预期证据范围不因此自动等同于最终 source block。
- **Citation registry 来源映射**：每个 source block 记录一个核心 `source_span`，其路径与行范围必须和
  `source_id` 完全一致；零到多个 `context_spans` 按原始来源顺序排列，`role` 限定为 `heading` 或
  `table_header`。`model_content` 保存实际提供给模型的组装文本，`content_sha256` 只验证该文本可重复生成。
  fenced code block 与紧邻前置说明共同形成连续的核心 `source_span`，不作为附加语境拆开记录。
- **Citation registry 顶层形状**：有序 `blocks` 数组是唯一持久化格式；每个 entry 自带 `source_id`，加载后
  按需构建 `Map<source_id, entry>`。不额外持久化 `blocks_by_id`，避免两份索引产生漂移；不记录生成时间，
  避免同一 snapshot 的重算结果仅因时间字段变化而不同。
- **Citation registry 排序**：`blocks` 先按冻结 corpus manifest 中的 `documents` 顺序排列，同一文件内再按
  核心 `source_span.line_start`、`source_span.line_end` 升序排列。`context_spans` 不参与排序；重复
  `source_id` 必须使验证失败，不得在运行时 Map 中静默覆盖。该顺序表示原始语料顺序，不代表 retrieval relevance。

### 6.2 D1 未完成对象的当前承接状态

| D1 于 9/7 未完成的对象 | 9/8 当前结果 | 状态 | 后续门禁 |
|---|---|---|---|
| eval 剩余题意、判分契约与冻结文件 | `w13-eval-v1` 已冻结，静态结构与隔离验证通过 | 已完成；D2 原完成对象 | 不再修改或运行 holdout |
| RAG Prompt 与 response schema | Prompt v0 十项语义已确认，response schema 已静态 compile | 已完成；D2 同日延展 | 接线后仍需验证模型实际响应 |
| source block 与 corpus serialization | 语义粒度、标题原则、确定性 parser 方向，以及列表、fenced code block、表格、blockquote 与 thematic break 规则已确认；source identifier 使用冻结位置作为身份 | 实际块级结构覆盖，以及 identifier 与 registry 设计契约已完成；D2 同日延展 | D3 只冻结 serialization 契约；parser 产出验证在契约闭合后开始 |
| assembled input 计量与最终 context budget | 尚未开始 | 未开始；D3 | 依赖 serialization |
| 全语料上下文 baseline | 尚未运行 | 未开始；D3 | 依赖容量门禁与客户端接线验证 |
| RAG 必要性边界结论 | 尚未形成 | 未开始；D3 | 依赖 baseline 证据 |

D2 延展不会覆盖 D1 的全部未完成链路。当前只继续冻结 source block 解析契约；serialization、最终 context
budget、baseline 与 RAG 必要性结论仍按周计划进入 D3。

## 7. 证据记录

| 对象 | 版本或输入 | 原始证据位置 | 观察 | 结论与边界 |
|---|---|---|---|---|
| 题意 | 20/20 已确认；五类行为题意完成 | `week13-rag/eval/dev/items.json`、`week13-rag/eval/holdout/items.json` | dev/holdout 各 10 题；每个 split 的五类行为各 2 题；query、规则结论和 evidence requirements 已确认 | 题意阶段与判分契约均已完成 |
| 判分契约 | `w13-eval-v1` | `week13-rag/eval/scoring-contract.md` | answered/abstained、人工语义 checklist、六项 metrics、9/10 split threshold、每类 1/2、no-answer 零容忍已冻结 | 判分语义完成；RAG response schema 在 D2 延展中机械落盘，serialization 尚未开始 |
| dev/holdout schema 与文件 | `w13-eval-v1`；`frozen` | `week13-rag/eval/schemas/evaluation-set.schema.json`、两个 split 文件、`manifest.json` | dev/holdout 各 10 题；共享 schema；五类行为各 2 题；文件 SHA-256 与 contract hash 已记录 | eval 输入与版本边界已冻结 |
| 隔离与机械验证 | Node.js `v24.16.0` | `node week13-rag/eval/scripts/verify-contract.mjs`；加 `--all` 执行 D2 静态全量检查 | 默认 dev：10/10、每类 2、hash 通过且未读取 holdout；显式全量：20/20、两 split 各 10、每类 2、source span 与 hash 通过 | D2 机械门禁通过；未运行模型或 holdout 输出 |
| D2 Prompt 延展 | `w13-rag-prompt-v0` / `rag-response-v1` | `week13-rag/prompts/rag-prompt-v0.md`、`week13-rag/schemas/rag-response-v1.schema.json` | 本人确认十项 Prompt 语义；W12 用户注册 Prompt 不复用；response schema 通过 JSON 解析与 Ajv Draft 2020-12 compile | Prompt 语义与输出结构已冻结；尚未接入模型，不能声称模型遵守 schema |
| source block 粒度 | Markdown 段落或小节；确定性 parser | 本文件 §6.1 | 多条独立规则按规则段落拆分；列表按顶层项拆分；fenced code block 只向前合并紧邻内容；表格按数据行拆分并附带表头；blockquote 递归应用内部规则；thematic break 仅作硬边界 | 实际块级结构覆盖复核已完成；serialization 未开始 |
| source identifier | `corpus_id/source_path#Lstart-Lend` | 本文件 §6.1；冻结 corpus snapshot | 核心规则位置形成身份；附加语境只进 registry；模型可见内容 hash 负责完整性 | identifier 语义已确认；尚未生成 registry |
| citation registry 来源映射 | 每个 block 一个 `source_span`，零到多个 `context_spans` | 本文件 §6.1；冻结 corpus snapshot | core span 与 identifier 一致；context span 带 `heading` 或 `table_header` role；另存模型可见内容及 hash | 来源映射已确认；尚未生成 registry |
| citation registry 顶层形状与排序 | 有序 `blocks` 数组 | 本文件 §6.1 | entry 自带 ID；Map 仅在运行时派生；不保存生成时间；按 manifest 文档顺序与核心行范围排序；重复 ID 失败 | registry 设计契约已确认；尚未生成 registry |

## 8. 收尾清单

- [x] §2 六项完成条件全部通过。
- [x] holdout 未运行，未产生或查看结果，未用于设计或调参。
- [x] eval 收口前未启动 Prompt；收口后按本人决定完成 D2 Prompt 延展。未启动 serialization、baseline、
  BM25、dense、展板或分享排练。
- [x] 事实、推断、本人决定和待验证项已分开记录。
- [x] `week13-plan.md` 与 `LEARNING-STATE.md` 已按实际结果更新。
- [x] 是否 commit 由本人决定；AI 未自动 commit、push 或 merge。

## 9. D2 延展的当前入口

§2 的 eval 契约已经完整冻结。本人随后在 D2 内确认 RAG Prompt v0 的十项语义，AI 已机械创建独立 Prompt 与
response schema。source block 已确认使用 Markdown 段落或小节的语义粒度；同一小节包含多条可独立成立的
规则时按规则段落拆分，正文缺少完整适用对象或结论时携带必要标题层级。本人已确认由不调用模型的确定性
Markdown parser 自动重算 source blocks，列表按顶层项拆分且嵌套内容跟随父项；Agent harness 不提前进入
W13。fenced code block 与同一小节中直接说明其含义的相邻内容共同形成 source block。其机械邻接条件已经确认；
表格按数据行拆分并为每行附带表头；blockquote 作为容器递归应用内部规则；
thematic break 不进入模型可见内容并作为硬边界。冻结 corpus 的实际块级结构覆盖复核已经完成，source
identifier 与 citation registry 设计契约也已闭合。本人随后已明确进入 D3；D3 当前状态和下一设计点只以
`LEARNING-STATE.md` 为准。本 D2 记录不承载后续 parser、serialization、容量判断、baseline 或 BM25 结果。
