# Week 13 计划：RAG Foundations（9/7-9/11）

> 建立：2026-09-06（Asia/Shanghai）。
>
> 术语修订：2026-09-06。移除没有跨厂商统一含义的 A/B/C 语料分级，改为按内容与范围直接命名；
> 同步把原先压缩的基线验收名称改写为全语料上下文基线评测及其明确完成条件。语料范围与执行顺序不变。
>
> 状态：执行中。D1 于 9/7 未完成；D2 于 9/8 完成 eval 契约冻结，并按本人决定在 D2 内延展到 RAG Prompt
> v0 语义与 response schema。当前尚未进入 D3。W13 继承 W12 已完成的 Python 3.12、真实模型客户端和
> 实验记录方法；W12 的用户注册信息提取 Prompt 不作为 W13 RAG Prompt 的输入、语义模板或初始版本。
>
> 协作模式：默认导师模式。AI 先解释术语、原理、职责边界和验证方式，再由本人完成 RAG 方案取舍、
> 评测设计、Prompt 内容、核心实现与核心断言。配置、依赖、Python/库 API 语法和机械证据整理按白名单处理。
>
> 9/8 容量修订：本计划按阶段完成对象组织，不假设整天持续高强度学习，也把对话等待计入实际日历成本。
> 任一时点只保留一条活动主线；当前阶段未完成时不启动后续阶段。门禁通过允许继续后续依赖，但阶段切换必须
> 由当前计划与状态明确记录，不能仅根据已经开始讲解就推断进入下一阶段。

## 0. 当前输入与事实边界

### 0.1 已确认事实

- W12 五项交付与独立掌握已经收口；W13 可复用其 Python 3.12 环境、DeepSeek 客户端和测试入口。
- W12 的 [`prompt-v0.md`](../../week12-python-rag/prompts/prompt-v0.md) 用于把非结构化用户注册信息提取为
  `UserCreate + Address` JSON，`Retrieved Context` 明确为无检索。W13 只复用它已经验证过的 Prompt 版本化、
  固定输入、结构校验和结果记录方法；不复用其用户注册字段、instructions、examples 或 output schema。
- 规则文档语料范围已由本人确认，并在 D1 从 source commit
  `c0a4b85c9065cbfb943584c914172d7819339791` 冻结为七文件 snapshot；共 76,149 bytes，raw corpus-only
  结果为 18,680 estimated tokens。完整清单与证据见 §2.1 和 D1 笔记。
- 仓库 Markdown 扩展语料目前只有 W12 D5 的规模盘点与排除类别；它作为条件扩展，语料快照、文件清单、token 计量和
  eval 尚未执行，也不作为 W13 核心 demo 的完成前提。
- W13 的代码、检索质量、生成质量、延迟和本地 dense runtime 当前都属于待验证，不写成已完成事实。

### 0.2 已继承决定

- 语料快照必须发生在第一道 eval 题建立之前。
- 规则文档语料是 D1-D5 的必做 corpus；全语料上下文基线与 BM25 使用同一个规则文档语料快照。dense 若在
  后续重新排入，也必须复用该 snapshot 与冻结 eval，不能另换输入后写成同组对照。
- 仓库 Markdown 扩展语料使用独立版本。只有核心主线已完成时才启动，且必须先冻结自己的 snapshot，再建立任何
  依赖它的 eval；不得把两套语料的结果混成同一组对照。
- 先完成全语料上下文基线评测，再实现 retrieval：规则文档语料能完整容纳时运行 baseline；不能容纳时
  保留容量不可行证据，不静默裁剪后仍称全语料上下文。9/7 调整后的本周 retrieval 主线只保留 BM25；dense
  作为未完成的原周目标记录。两种 baseline 结果都用于判断 RAG 的必要性边界。
- dev set 与 holdout set 使用物理分离的文件或目录，并共享同一 eval schema。dev set 用于本周迭代；holdout
  不排入 W13 当前日程，也不用于选择方案或调参。只有实现、Prompt、retrieval 配置、eval 版本和评分规则
  全部冻结后才能首次运行。
- 本周必须形成可独立重复运行的最小 RAG 链路；CLI 或等价命令入口即可，不新增 UI。
- BM25 是端到端 demo 的稳定目标。dense retrieval 与首次 holdout 不排入 W13 当前日程，收口时按未完成
  或未验证记录，且 W13 不判定完整周验收通过。
- 自建实现只覆盖理解 RAG 所需的最小机制，不扩展为向量数据库、通用框架或 Agent。

## 1. 本周到底在完成什么

RAG 的完整名称是检索增强生成（Retrieval-Augmented Generation）。本周要亲手建立并观察下面这条链路：

```text
用户问题
  -> 从冻结语料中检索相关证据
  -> 组装实际交给模型的上下文
  -> 模型依据上下文生成答案
  -> 返回可定位的引用，或在证据不足时拒答
```

本周不是在实现 Agent。RAG 负责提供有来源的知识和受证据约束的回答；Agent 在 W14 才负责判断何时调用
检索工具、是否继续调用以及何时结束。

D1 暂不实现检索。D1 先固定实验输入、评测规则和无检索基线，保证 D2-D5 的不同方案是在同一组问题、
同一份语料和可追溯版本上比较。

## 2. 语料范围

### 2.1 规则文档语料

规则文档语料用于全语料上下文基线、可定位引用、证据不足拒答和冲突处理。七份文件为：

1. `AGENTS.md`
2. `TECHNICAL-WRITING-PROTOCOL.md`
3. `SHOWCASE-VISUAL-PROTOCOL.md`
4. `DAILY-SPEAKING-PROTOCOL.md`
5. `SHOWCASE-DEPLOY-PROTOCOL.md`
6. `LEARNING-PROTOCOL.md`
7. `DAILY-LEARNING-REPORT-PROTOCOL.md`

D1 已按实际冻结快照记录逐文件字节和 token estimate，没有沿用 W12 的历史体积作为当前结果。

### 2.2 仓库 Markdown 扩展语料

候选范围是冻结来源 commit 下的 tracked Markdown 减去本人确认的排除清单。它不进入 D1 主线和
W13 核心验收；只有当天主线已经完成时才作为独立版本启动。已继承的排除类别为：

- 快照目录自身。
- 题库、答案和评测结果。
- W13 起的进行中笔记。
- 个人面试材料。
- 公司资料、PII、密钥和本地环境文件。

具体纳入文件、边界文件与例外项由本人在实际启动扩展语料前确认；AI 不根据文件名替本人推断敏感性。
若本周未启动，保持“候选扩展，未验证”，不顺延占用 D2-D5 主线。

### 2.3 W13 范围外资料

MCP 新旧规范只在 W15 用作协议学习材料，不进入 W13 corpus 或验收，因此不再为它建立没有行业依据的语料层级。

### 2.4 术语依据与语料规模判断

此前的 A/B/C 语料分级没有跨厂商统一的 RAG 含义。本计划不再使用该本地分级，改用能直接说明内容和范围的
`规则文档语料`、`仓库 Markdown 扩展语料` 与 `MCP 规范资料`。官方资料中的常见对象名称包括：

- NIST 使用 `knowledge base` 描述 RAG 检索的信息集合。
- Google Vertex AI 使用 `RAG corpus` 与 `RAG file`。
- Azure RAG 指南使用 `data source`、`document`、`chunk`、`search index` 与 `test query`。
- AWS 使用 `data source`、`document`、`chunk` 与 `knowledge base`。

参考：[NIST RAG glossary](https://csrc.nist.gov/glossary/term/retrieval_augmented_generation)、
[Google Vertex AI RAG quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-quickstart)、
[Azure RAG design and evaluation guide](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/rag/rag-solution-design-and-evaluation-guide)、
[AWS RAG documentation best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/writing-best-practices-rag/best-practices.html)。

七份文件足以启动并跑通本周的最小教学实现和同条件实验；在实际 chunk 与 retrieval evaluation 出现前，
尚不能确认它足以形成有区分度的 BM25/dense 质量对照。它只能代表小型、同领域的规则文档语料，不能证明
生产规模、异构数据源或持续更新场景。是否需要扩大语料不按文件数决定，而按下列证据判断：

- chunk 是否提供了足够的独立检索单元，并保留返回原文位置所需的 metadata。
- dev/holdout query 是否覆盖实际任务，包括可回答、跨文档、近似表述、冲突和无答案情形。
- retrieval evaluation 能否暴露 BM25 与 dense 的检索差异，而不是只验证链路可以运行。
- 全语料上下文基线是否已经达到本人预先冻结的通过标准。

在这些结果出现前，不复制、拆散或生成内容来增加文件数。若规则文档语料不能形成代表性查询或检索差异，才把
仓库 Markdown 扩展语料作为独立 corpus version 启动；它必须单独冻结、单独建立 eval，结果不得与规则文档语料混写。

## 3. 周目标与完成定义

**周目标**：在冻结 corpus 与本人定义的 eval 上，独立实现、解释并评测一条可复现的最小 RAG 链路；
能够区分 retrieval、context assembly、prompt 与 generation 各自的职责和失败。

**完整周验收句**：

> 对同一个规则文档语料快照和冻结题集，全语料上下文基线评测有可复核结果，BM25 RAG 与 dense retrieval 对照
> 可以重复运行；其中 BM25 端到端链路能够展示检索证据、实际上下文、带来源答案或拒答，并由本人依据
> 预先冻结的判据解释结果与边界。

这句话定义完整周验收边界。题目、标签、指标、阈值、通过标准、Prompt 内容和核心断言仍由本人在 D1 冻结。
若 dense 因本地 runtime 与 API 路径都不可用而未形成对照，BM25 demo 和 W14 最低接口可以单独判定完成，
但 W13 的 dense 学习范围必须判为未完成或未验证，不能判定完整周验收通过。

### 3.1 最低交付物

1. **冻结规则文档语料**：语料快照、来源 commit、manifest、字节与 token 证据可追溯。
2. **冻结 eval**：dev/holdout 物理隔离并共享同一 schema；题目、标签、指标、阈值与通过标准由本人签认。
3. **全语料上下文基线评测**：规则文档语料可完整容纳时只在冻结 dev set 上运行 baseline；不可容纳时保留窗口来源、
   计量方法和超限证据。不得把裁剪后的输入称为全语料上下文。
4. **BM25 端到端 RAG**：从 query 到 retrieval、context assembly、generation、citation/abstention 可运行。
5. **dense 对照**：在同一冻结输入上完成可复现对照；若本地与 API 路径均不可用，保留真实阻断证据并明确未掌握边界。
6. **失败分析与掌握证据**：逐题区分失败所在阶段；本人能脱离实现讲清成功路径、两个失败路径和一项变更影响。

### 3.2 Demo 的最低可观察内容

不要求 UI。一个稳定命令或等价入口需要让观察者区分以下对象，具体字段结构由本人确定：

- 本次运行使用的 corpus、Prompt、模型和实现版本。
- 输入 query。
- retrieval 返回的证据及其来源定位。
- retrieval 结果中实际进入模型的 context。
- 模型生成的 answer，或证据不足时的 abstention。
- citation 对应的冻结来源，不接受只有模型生成的引用文字。
- 至少一个成功案例和一个失败或边界案例；具体案例由本人预先冻结，不根据最终结果临时挑选。

### 3.3 模型调用失败时的证据边界

- BM25 端到端阶段收工前必须至少保留一次与冻结版本关联的真实 generation 成功证据，否则不能判定端到端
  RAG 完成。
- D5 分享时模型调用失败，可以实时展示 retrieval 与 context assembly；此前同版本的 generation 输出只能
  称为已记录证据，不能称为本次现场端到端运行。
- 整周从未成功完成真实 generation 时，只能判定 retrieval/context 子链完成，不能用截图、缓存文本或
  演示讲稿替代端到端结果。

## 4. 术语与讲解契约

本周不预设本人已经理解新术语。每天第一次进入新概念时，按以下顺序开始：

```text
AI 给出官方术语与中文解释
  -> 说明它解决的问题、输入、输出和职责边界
  -> 用当前仓库中的对象举例
  -> 本人指出仍不清楚之处
  -> 再进入设计、实现或验收
```

- 讲解发生在要求本人作设计判断之前，不把第一次听到的术语当作可推导考题。
- 每次只处理一个设计点；需要多个判断时拆开提问。
- 本人听完后的复述用于检查理解，不把记住英文拼写当作掌握证据。
- 工具报错形态、模型实际行为和特定 runtime 行为属于经验事实，先讲解或实测，不要求本人猜。

| Day | 开工前需要先解释的术语范围 |
|---|---|
| D1 | corpus、versioned corpus snapshot、provenance、token、tokenizer、usage、context window、context budget、eval、label、metric、threshold、passing criteria、dev set、holdout set、baseline、RAG Prompt、grounding、citation、abstention，以及全语料上下文基线和 retrieval/context assembly/prompt/generation 四个失败阶段的概览 |
| D2 | evaluation item、label、metric、threshold、passing criteria、dev set、holdout set；不开始 Prompt 或 BM25 新术语 |
| D3 | RAG Prompt、grounding、citation、abstention、response schema、serialization 与全语料上下文基线；门禁未过时继续 D2 |
| D4 | ingestion、preprocessing、chunk、chunking、metadata、inverted index、BM25、ranking、retrieval result；门禁未过时继续前一阶段 |
| D5 | context assembly、grounded generation、retrieval miss、prompt failure、generation failure、evidence boundary；仅在前置门禁通过时进入 |

D1 的具体解释与开工顺序见 [`day1-corpus-freeze-and-baseline.md`](./day1-corpus-freeze-and-baseline.md)。

## 5. 阶段主线

以下 D1-D5 保留原计划的顺序标识和目标日期，但执行由入口门禁与明确的阶段状态共同决定。前一阶段提前完成时
可以在同一日继续经本人确认的延展工作，但不自动改变阶段标签；前一阶段未完成时也不因日期变化自动切换。

### D1（9/7）：冻结输入、评测契约并完成全语料上下文基线评测

**主线**：先完成术语导览，再按固定依赖顺序完成规则文档语料快照、token 计量、本人 eval/Prompt
冻结和全语料上下文基线评测。

**完成结果**：同一来源版本上的 corpus、eval 与全语料上下文基线评测证据可以复核；能完整容纳时保留实际
baseline，不能容纳时保留容量不可行证据，并写出证据支持与不能支持的 RAG 必要性结论。

**附加项**：主线完整后才决定是否建立仓库 Markdown 扩展语料的独立快照、manifest 与 token 记录。未启动时保持
“候选扩展，未验证”，不转入 D2-D5 主线。

**9/7 实际结果**：snapshot、manifest、raw corpus-only token estimate 与主要前置讲解已完成；eval 仅完成
1/20 题意，RAG Prompt/response schema、最终 context budget、baseline 和 RAG 必要性结论未完成。
仓库 Markdown 扩展语料未启动。D1 判定为未完成，剩余主线由 D2 承接。

### D2（9/8）：冻结 eval 契约

**主线**：按 [`day2-freeze-eval-contract.md`](./day2-freeze-eval-contract.md) 冻结 20 条题意、metrics、
thresholds、item-level 与整套 eval 的 passing criteria，并完成 dev/holdout 的 schema、稳定 ID、source span、
hash 与物理隔离验证。

**完成结果**：形成版本明确、可以被确定性读取和复核的 eval 契约。任一门禁未通过，下一学习日继续该对象；
不通过压缩判据或由 AI 代填语义来维持日历进度。

**9/8 实际结果**：`w13-eval-v1` 已冻结。dev/holdout 各 10 题、五类行为各 2 题；两个 split 分别要求
至少 9/10 且每类至少 1/2，citation precision 为 `1.0`，预期 abstained 的题目强行作答会直接否决该 split。
默认验证入口只读取 dev；双 split 静态结构、source span 与 hash 验证通过。未运行模型或 holdout。

**9/8 同日延展**：eval 门禁通过后，本人决定继续 D2。本人确认了 RAG Prompt v0 的十项语义；独立 Prompt
与 response schema 已机械落盘，schema 通过 Draft 2020-12 compile。source block 尚未确认，serialization、
容量判断、baseline 和 BM25 均未开始。这次延展不记为已经进入 D3。

### D3（9/9）：冻结 RAG 输入输出并完成全语料上下文基线

**入口状态**：尚未进入。eval 契约已经完整冻结，Prompt v0 语义与 response schema 已在 D2 延展中完成；
source block、serialization、容量判断和 baseline 尚未开始。

**主线**：进入本阶段后，先从已经冻结的 W13 RAG Prompt 与 response schema 恢复输入输出边界，再由本人
决定 source block 粒度。随后完成 serialization、实际输入计量和 context budget。容量可行时只在冻结 dev set
上运行全语料上下文 baseline；不可行时保存完整容量证据，并写出 RAG 必要性结论及其边界。

**完成结果**：一份可复核的全语料上下文基线证据包。当天未完成时继续本阶段，不开始 BM25。

**附加项**：无。不实现 retrieval，不启动展板或分享排练。

### D4（9/10）：建立可追溯的 BM25 retrieval

**入口门禁**：全语料上下文基线证据包已经完成。门禁未通过时继续前一阶段，不开始 BM25。

**主线**：先解释 ingestion、chunking、metadata、倒排索引与 BM25，再由本人实现从冻结文档到可检索
chunk 的确定性链路，并在冻结 dev set 上运行 retrieval eval。

**完成结果**：一个 query 能返回有排名的相关 chunk，并能定位回冻结快照中的实际来源；原始文档、chunk、
metadata 与 retrieval result 之间的关系可以由本人讲清。

**附加项**：无。不比较 chunk 变体，不接 generation，不运行 holdout 或 dense。

### D5（9/11）：继续主线并在 17:00 分享实际证据

**学习窗口**：17:00 前继续当时所在阶段。若 BM25 retrieval 的完成条件已经通过，目标是接通 context
assembly、本人冻结的 RAG Prompt、真实 generation、citation 与 abstention，并在 dev 上保留可重复运行证据；
若前置门禁未通过，则继续完成当前阶段，不跳步进入端到端实现。

**分享边界**：17:00 只分享届时已经验证的实际进度、证据和未完成边界。分享性质高于每周 D1 汇报，但不等于
完整 W13 技术验收。排练只检查固定的已验证路径、命令与证据可访问、一个失败或边界案例，以及一次不中断讲述；
不新增功能、不制作展板，也不为展示运行 holdout。

**完成结果**：保存截至 17:00 的阶段结果、失败归因、能力边界与下一入口。首次 holdout 与 dense 均不在
本周当前日程内；缺少它们时，W13 只能按部分完成记录。

**周末条件项**：主线学习后的精力与时间允许时，再整理学习展板。展板服务下一次 D1 展示与个人复习，和
技术主线解耦，不作为 W13 验收条件，也不要求以加班补齐。

## 6. 依赖、顺延与砍范围规则

1. 当天主线未完成时，下一学习日先完成该阶段，不把日期标签对应的后续任务叠加。
2. D2 只冻结 eval；eval 门禁未通过时，不开始 RAG Prompt 或全语料上下文 baseline。
3. 全语料上下文基线证据包未完成时，不开始 BM25。进入 BM25 后发生溢出时，不启动 chunk 变体和预处理对照，
   不修改已经冻结的规则文档语料快照或 eval。
   仓库 Markdown 扩展语料已在计划中固定为条件扩展，未启动不形成顺延项；一旦冻结并建立相关 eval，也不得事后缩小范围。
4. 只有 BM25 retrieval 已通过才进入 BM25 端到端链路；D5 可以承接这一主线，但不得为了 17:00 分享跳过门禁。
5. dense 与首次 holdout 不排入本周当前日程，收口时如实记录为未完成或未验证；不以展示需要为理由临时加入。
6. 分享准备和周末展板都不能替代技术证据，也不能反向挤占未完成的主线学习。

范围不足时按以下顺序移除：

1. hybrid/RRF。
2. 量化 ONNX 对照和第二 embedding 模型。
3. 多组 chunk 或中文预处理变量。
4. 尚未启动的仓库 Markdown 扩展语料；已经冻结的 snapshot 与 eval 不得事后缩小。
5. dense retrieval 对照与首次 holdout；9/8 已从本周当前日程移除，收口时明确记为未完成或未验证，
   W13 判为部分完成。

不得删除：术语讲解、冻结 corpus/eval、全语料上下文基线评测、BM25 端到端链路、citation/abstention、
dev/holdout 隔离、逐题失败归因和本人独立掌握验收。

## 7. Eval 与证据规则

- snapshot 在第一道 eval 题之前冻结，避免根据题目反向选择语料。
- 题目、标签、指标、阈值、通过标准和核心断言由本人定义；AI 只解释概念并 review 可证伪性。
- 全语料上下文基线可运行时与 BM25、dense 使用同一冻结 dev set；BM25 与 dense 始终使用同一规则文档语料快照
  和冻结 dev set。每次变更保留变更前结果，不覆盖历史证据。
- dev/holdout 使用物理分离文件或目录，并共享同一 eval schema；所有常规开发入口只读取 dev 路径。
- 五类行为均有冻结 corpus 依据：直接可回答、跨文档、近似表述、优先级/冲突/例外和无答案。每类在 dev 与
  holdout 中各 2 个非等价 items，共 20 题（dev 10、holdout 10）。
- holdout 题目由本人在 eval 阶段创建并冻结，但本周不运行、不用于方案选择或调参。首次运行只能发生在实现、
  Prompt、retrieval 配置、eval 版本和评分规则全部冻结之后；运行后它成为冻结回归集，不再称为未见结果集。
- 每次运行关联 corpus、Prompt、模型、token 计量方法、retrieval 配置和实现版本；若生成模型没有公开且
  可复现的精确 tokenizer，估算结果与 provider 返回的实际 usage 分开记录。
- 若模型服务或本地层实际暴露 cache hit/miss，则记录其命中状态和可观察成本；若没有启用或没有可观察
  字段，明确写为不适用或不可观察，不从延迟差异推断缓存命中。
- 结果按事实、推断和待验证分开记录。一次运行成功只证明该次链路成功，不直接证明整体质量或掌握。
- 失败至少先分到 retrieval miss、context assembly、prompt 或 generation，再决定是否需要更细归因。
- 全语料上下文基线达到本人门槛时，后续 BM25/dense 仍作为教学对照；结论不得扩大为当前场景生产上必须使用 RAG。

## 8. Dense retrieval 的环境边界

- 9/8 容量调整后，本节不再进入 W13 当前日程；以下内容保留为原计划技术边界，不表示本周已执行。
- 默认候选为 `intfloat/multilingual-e5-small`，首选 ONNX Runtime `1.23.2` 与发布者 fp32 模型文件。
- 重新排入某个学习日时，必须先解释相关术语，再执行安装与 wheel/hash 冻结；不与 BM25 主线叠加。
- 同一冻结小样本先验证正确性，再记录运行 provider、线程、batch、截断、冷启动、吞吐、查询 p50/p95、
  峰值 RSS、质量和仓库 Markdown 扩展语料全量估算。
- 安装失败、明显系统资源问题、运行成本超过本人冻结上限或质量不达标时停止本地排障，再评估 embedding API。
- 本地与 API 路径均不可用时，BM25 端到端 demo 仍可作为 W14 接口；dense 只能写为未完成或未验证，
  不得写成已经掌握。

## 9. AI 协作与所有权

| 内容 | 归属与援助边界 |
|---|---|
| 术语、原理、职责边界、失败分类 | AI 可做 L1 讲解；讲解先于设计问题 |
| corpus 最终范围与敏感性判断 | 本人决定；AI 可执行已确认清单的机械快照 |
| eval 题目、标签、指标、阈值、通过标准 | 本人完成；AI 不预填 |
| RAG Prompt 内容与引用/拒答正确性 | 本人完成；AI 可 review 表达和证据边界 |
| chunk、retrieval、ranking、context assembly 的方案与核心实现 | 本人完成；卡住后按辅助阶梯处理 |
| Python、测试框架、SDK、依赖与配置 API 细节 | 白名单；AI 可提供最小必要实现 |
| 运行证据整理与文档同步 | AI 可按已发生事实协助，不代写结果或掌握结论 |

若 AI 对黑名单内容给到 L2，必须同步更新 `DEBT.md`、当天笔记和 `LEARNING-STATE.md`；计划本身不预支援助。

本人追问产生的补充讲解默认不是新的考核题。AI 必须标明当前问题属于计划中的哪个步骤；需要临时巩固时，先说明
它是计划外练习并取得本人确认。补充讲解结束后返回最近一个未完成的计划项，不把相关经验自动扩张为新的学习支线。

建立 eval items 时，本人可以在对话中按同一设计点批量给出准确 query、预期分支、规则结论和证据位置思路，
不承担 JSON 录入、schema 排版、identifier 机械核对或 hash 计算。AI 只在本人确认语义后执行这些机械工作；
query 的准确措辞会直接影响 retrieval 对照，不属于纯格式工作，仍由本人确定。

首次开始正式题目设计前，AI 先用一个明确排除在 dev/holdout 之外的完整示例说明 evaluation item 解决的问题、
query、expected behavior、规则结论和 evidence requirement 如何配合。示例不计入 20 题，也不得直接改名后进入
题集；本人理解结构后，再按一个行为类型一批四题提交正式语义。

## 10. 周收口清单

> 本节是执行期 checklist。当前为 D2 eval 阶段，空框表示待做；D5 收口时每项必须勾选或写清结果与去向。

- [ ] 规则文档语料 snapshot、manifest、来源 commit、字节与 token 证据完整。
- [ ] eval 与 RAG Prompt 由本人冻结，dev/holdout 隔离有证据。
- [ ] 全语料上下文基线评测已完成：baseline 已运行，或规则文档语料容量不可行证据完整；RAG 必要性结论边界已写清。
- [ ] BM25 retrieval 可以定位到冻结来源。
- [ ] BM25 端到端 RAG 可以独立重复运行并展示 citation/abstention。
- [ ] dense retrieval 已完成同集对照；若未完成，本项保持未勾选并写明阻断与去向。
- [ ] 首次 holdout 已运行；若本周未运行，本项保持未勾选并写明前置门禁与去向。
- [ ] 逐题失败归因、质量、延迟、token 与成本证据已落盘。
- [ ] cache hit/miss 已按实际可观察性记录，或明确标为不适用/不可观察。
- [ ] 本人能讲清成功路径、两个失败路径和一项合理变更的影响范围。
- [ ] W15 D1 的 retrieval 确定性数据流延迟重建入口已写入 `LEARNING-STATE.md`。
- [ ] 当周未完成项均有明确去向；是否 commit 由本人决定。
