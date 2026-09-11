# Week 13 计划：RAG Foundations（9/7-9/11）

> 建立：2026-09-06（Asia/Shanghai）。
>
> 术语修订：2026-09-06。移除没有跨厂商统一含义的 A/B/C 语料分级，改为按内容与范围直接命名；
> 同步把原先压缩的基线验收名称改写为全语料上下文基线评测及其明确完成条件。语料范围与执行顺序不变。
>
> 状态更新：2026-09-11。D1–D3 已完成冻结输入、eval 与 serialization；D4 已完成容量/payload 验证、
> full-context dev、BM25/dense/hybrid 检索对照、首次 holdout 与 BM25 端到端链路运行。
> full-context v1 + JSON 输出机械 8/10，按运行后澄清的 R1 人工诊断为 4/10；BM25 e2e 机械 8/10，人工语义判定已于 D5 完成（3/10，仍不通过）。
> 9 个有效检索配置均未过 B4.1；D5 已完成 **LangChain dense 接线**（`E5Embeddings` + `InMemoryVectorStore`）与 **dense 端到端链路运行**
> （10 条真实调用，机械 7/10，链路证据不作质量验收）。接线与 `dense_retrieve` 在 10 条 dev 上 top-10 顺序与集合一致，分数差 ≤ 7.31e-08。
> 记录见 [dense-langchain-wiring-freeze.md](./dense-langchain-wiring-freeze.md) 与 [D5 接线笔记](./day5-dense-langchain-wiring.md)。
> **完整 W13 质量验收未通过。D5 主线改为上午优先 demo 演练，主讲 15 分钟以内，追问另计。**
> 目标纠偏：原规则文档语料与题集保留为历史实验和排障证据；D6 后续转向任务代表性的 technical/framework corpus，
> 以可解释、可诊断、能嵌入 agent harness 的 LangChain RAG 最小垂直切片为新目标。固定 LangChain 链与后续
> LangGraph 状态编排分开验收；本次纠偏不回写 `w13-eval-v1`、旧 evidence 或 holdout。
> [D5 学习笔记](./day5-dense-langchain-wiring.md)、[主讲稿](./day5-demo-script.md)、[技术追问](./day5-demo-qa.md)。
> D4 的历史阶段记录见 [D4 笔记](./day4-full-context-baseline-and-bm25.md) §6，本次纠错见 [审核记录](./day5-progress-audit.md)。
> W13 只复用 W12 客户端与版本化/验证方法，不复用其用户注册 Prompt 的字段或语义。
>
> 协作模式：AI Engineer 分阶段模式。AI 先解释术语、原理、职责边界和验证方式；本人冻结 RAG 方案取舍、
> 评测语义、Prompt、序列化契约和核心断言后，AI 可以实现并自测。本人负责 review、修改或诊断和最终验收。
>
> 生态修订：W13 使用 LangChain Python 完成固定 RAG。框架不得改变冻结 corpus、source identifier、citation
> registry、`model_content`、Prompt/schema 或 eval 契约；BM25、dense 和首次 holdout 均保留为完整周验收项。
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
- 规则文档语料范围已由本人确认，并在 D1 以 source commit
  `c0a4b85c9065cbfb943584c914172d7819339791` 为基线冻结七文件 snapshot；随后按仓库内容边界执行
  不移动既有正文行号的 `repository-content-v1` normalization。当前共 76,243 bytes，raw corpus-only 结果为
  18,697 estimated tokens。完整清单与证据见 §2.1 和 D1 笔记。
- 仓库 Markdown 扩展语料目前只有 W12 D5 的规模盘点与排除类别；它作为条件扩展，语料快照、文件清单、token 计量和
  eval 尚未执行，也不作为 W13 核心 demo 的完成前提。
- 截至 D4，确定性代码、真实调用与本地 dense 对照已有运行证据；质量门禁未通过。dense 的 LangChain 接线、dense 端到端运行与 BM25/dense 人工语义判定均已在 D5 完成；本人完整掌握仍待完成。

### 0.2 已继承决定

- 语料快照必须发生在第一道 eval 题建立之前。
- 规则文档语料是 D1-D5 的必做 corpus；全语料上下文基线、BM25 与 dense 使用同一个规则文档语料快照和
  冻结 eval，不能另换输入后写成同组对照。
- 仓库 Markdown 扩展语料使用独立版本。只有核心主线已完成时才启动，且必须先冻结自己的 snapshot，再建立任何
  依赖它的 eval；不得把两套语料的结果混成同一组对照。
- 先完成全语料上下文基线评测，再实现 retrieval：规则文档语料能完整容纳时运行 baseline；不能容纳时
  保留容量不可行证据，不静默裁剪后仍称全语料上下文。BM25 与 dense 都在 LangChain 上完成同集对照；
  baseline 结果用于判断 RAG 的必要性边界。
- dev set 与 holdout set 使用物理分离的文件或目录，并共享同一 eval schema。dev set 用于本周迭代；holdout
  不用于选择方案或调参。只有 serialization、实现、Prompt、BM25/dense 配置、eval 版本和评分规则全部冻结
  后才能首次运行；首次结果不得反向用于调参，后续只按预先冻结的 regression 节点复跑。
- 本周必须形成可独立重复运行的最小 RAG 链路；CLI 或等价命令入口即可，不新增 UI。
- LangChain BM25 是端到端 demo 的稳定最低接口；dense retrieval 与首次 holdout 是完整 W13 验收项。
  环境阻断时可以如实判定部分完成，但不能从计划中删除或写成已掌握。
- 自定义实现只保留框架无关契约、全语料上下文基线、可解释检索对照和必要 adapter；不复刻 LangChain
  通用抽象，不扩展为向量数据库或 Agent。

## 1. 本周到底在完成什么

RAG 的完整名称是检索增强生成（Retrieval-Augmented Generation）。本周要设计、建立并观察下面这条链路：

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
- allowlist 外的所有仓库路径与外部输入。
- 密钥、真实凭据、可定位端点和本地绝对路径。

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

**周目标**：在冻结 corpus 与本人定义的 eval 上，使用 LangChain 实现、解释并评测一条可复现的固定 RAG 链路；
能够区分 retrieval、context assembly、prompt 与 generation 各自的职责和失败。

**完整周验收句**：

> 对同一个规则文档语料快照和冻结题集，全语料上下文基线、LangChain BM25 RAG 与 LangChain dense RAG
> 可以重复运行；端到端链路能够展示检索证据、实际上下文、带来源答案或拒答。全部输入、配置、实现和评分
> 规则冻结后才首次运行 holdout，本人依据预先冻结的判据解释结果与边界，不用首次结果反向调参；后续只按
> 预先冻结的 regression 节点复跑。

这句话定义完整周验收边界。题目、标签、指标、阈值、通过标准、Prompt 内容和核心断言仍由本人在 D1 冻结。
若 dense 因本地 runtime 与 API 路径都不可用而未形成对照，BM25 demo 和 W14 最低接口可以单独判定完成，
但 W13 的 dense 学习范围必须判为未完成或未验证，不能判定完整周验收通过。

### 3.1 最低交付物

1. **冻结规则文档语料**：语料快照、来源 commit、manifest、字节与 token 证据可追溯。
2. **冻结 eval**：dev/holdout 物理隔离并共享同一 schema；题目、标签、指标、阈值与通过标准由本人签认。
3. **全语料上下文基线评测**：规则文档语料可完整容纳时只在冻结 dev set 上运行 baseline；不可容纳时保留窗口来源、
   计量方法和超限证据。不得把裁剪后的输入称为全语料上下文。
4. **BM25 端到端 RAG**：从 query 到 retrieval、context assembly、generation、citation/abstention 可运行。
5. **LangChain 框架映射**：`Document`、retriever、embedding/vector store 与模型接线明确映射到冻结契约，
   不让框架生成的临时 ID 或默认格式取代 source/citation/serialization 设计。
6. **dense 对照**：在同一冻结输入上完成可复现对照；若本地与 API 路径均不可用，保留真实阻断证据并明确未掌握边界。
7. **首次 holdout**：所有输入、配置、实现和评分规则冻结后才运行；不根据首次结果调参，后续只按预先冻结
   的 regression 节点复跑。
8. **失败分析与掌握证据**：逐题区分失败所在阶段；本人能脱离实现讲清成功路径、两个失败路径，review
   框架接线，并完成一次合理修改或故障诊断。

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
| D3 | RAG Prompt、grounding、citation、abstention、response schema、serialization 与 Evidence Context；门禁未过时继续 D2 |
| D4 | LangChain `Document`/retriever、ingestion、preprocessing、chunk、chunking、metadata、inverted index、BM25、ranking、retrieval result 与全语料上下文基线；门禁未过时继续前一阶段 |
| D5 | 复用已学的 RAG 数据流、citation/abstention 与评测口径，讲清 LangChain 已有接口与 LangGraph 后续映射；陌生概念只作讲解，不自动进入新阶段 |

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
与 response schema 已机械落盘，schema 通过 Draft 2020-12 compile。source block 边界、source identifier
与 citation registry 设计契约随后闭合；serialization、容量判断、baseline 和 BM25 均未开始。

### D3（目标 9/9；9/8 已进入）：冻结 `model_content` 与全语料 Evidence Context 组装契约

**入口状态**：已明确进入。eval、Prompt v0、response schema、source block 边界、source identifier 与 citation
registry 设计契约均已冻结。本人已确认 `model_content` 内必要标题按由外到内排列，随后是必要表头，最后是
核心 `source_span` 内容，缺失项省略；换行/空白、source wrapper、hash 边界、全语料 block 顺序和自动验证
判据尚待逐项确认。

**主线**：逐项冻结 `model_content` 与全语料 Evidence Context 的确定性 serialization：内容顺序、空白保留、
source wrapper/边界、hash 精确字节边界、全语料 block 顺序，以及逐字节一致、无遗漏/重复、来源可回读和
hash 可重算的机械判据。

**完成结果**：一份明确、可自动验证且不依赖模型的输入输出契约，足以让后续 parser 实现不再补做语义决定。
当天未完成时继续本阶段，不实现 parser，不做输入 token/context budget，不运行模型或 baseline。

**附加项**：无。不实现 parser/retrieval，不修改模型客户端，不启动展板或分享排练。

**9/9 实际结果**：设计点 1-6 全部闭合（§6.1 累积规则）：点 2 = 基线 A 规范化优先 + 7 子规则（EOL 统一 LF、
行尾空白 CommonMark 归一、空行折叠为 1、行首缩进原样、span 拼接逐字、fenced code 围栏保留、blockquote 标记
原样）；点 3 = XML-like wrapper 4 子规则；点 4 = hash 3 子规则；点 5 = 组装职责复核；点 6 = 七条判据清单 +
全串基准延迟冻结。§6.2.0 单一规范、§6.2.1 合成 fixture A/B/C 与期望 hash、§6.3 静态复核已完成。真实语料判据
执行验证、输入计量/context budget、baseline 与 BM25 均未开始（符合 D3 止步条件）。剩余收尾：掌握验证与
plan/LEARNING-STATE 同步。

### D4（9/10）：全语料上下文基线与 LangChain BM25 RAG

详细执行计划与工作表见
[`day4-full-context-baseline-and-bm25.md`](./day4-full-context-baseline-and-bm25.md)。

**D4 开工时入口（历史）**：D3 serialization 契约、parser/registry/Evidence Context 实现、真实语料机械判据与整串基准
已完成；当时首先关闭 A1–A8 review。**实际结果**：A1–A8 已签认，阶段 1–5 已形成证据；详细结果见 D4 §6。

**核心完成对象**：关闭 serialization L1 验收；由本人确认完整输入容量口径；完成 serialized 输入计量、
context budget、客户端 `thinking: disabled` 接线验证，以及全语料上下文 dev baseline 结果或容量不可行证据。

**条件附加项**：核心完成对象闭合后，解释 LangChain `Document`、retriever、ingestion、chunking、metadata、
倒排索引与 BM25。本人逐项冻结 `Document` 映射、中文 preprocessing、ranking/context assembly 和 retrieval
eval 判据后，由 AI 完成 LangChain 接线并先运行 dev retrieval-only eval；该门禁通过后才进入真实 generation。

**完成结果**：D4 核心完成要求全语料上下文 baseline 结果或容量不可行证据可以复核，并由本人完成失败归因与
证据边界判断。BM25 当日完成时，端到端链路还需可重复运行并定位回冻结来源；未完成时按详细计划记录下一入口，
不反向把 W13 写成完整验收通过。

**D4 原定范围（历史）**：不比较 chunk 变体，不运行 holdout 或 dense，不启动扩展语料、展板或分享排练。
**实际延展**：D4 已进行了 dense、hybrid 和首次 holdout；BM25 端到端按本人明确的链路演示例外执行。
这些运行事实不表示此前质量门禁通过，不反向改写原计划；D4 §6.17–§6.21 保留执行依据与边界。

### D5（9/11）：RAG 成果 demo、讲解与追问演练

**计划变更（9/11）**：上午第一优先完成 demo 演练，复用 D4 已验证成果。主讲按 14 分钟编排、
保留 1 分钟操作余量，技术追问与开放讨论不计入 15 分钟。原 17:00 分享入口保留，上午先达到完整可展示状态。
本决定替代旧 D5 “17:00 前持续推进后续阶段、展板仅周末”的安排，不改变技术评测门禁。

**唯一主线**：按 [主讲稿](./day5-demo-script.md) 与 [技术追问](./day5-demo-qa.md) 完成主讲计时演练、脱稿演练与追问练习。
展示 RAG 数据流、可回源回答/拒答、同集检索与输入规模，以及 LangChain 已有接口到 LangGraph 后续职责的映射。
[主讲稿](./day5-demo-script.md) 提供页面/命令/过渡/备用路径；[追问稿](./day5-demo-qa.md) 单独准备技术细节。

**展示资产**：先审核并补齐 [RAG 代码导读](./rag-implementation-guide.md)，再创建整体路线图、数据流、实现职责、
证据回放、检索对照和框架衔接六专题，按能力关系组织；
图形与主画面文案应脱离笔记也能理解，内部标识下沉证据详情。按根级视觉规范验证；它不新增 RAG 应用功能，
也不作为 W13 质量或本人掌握通过的证据。本地演练页可调用固定离线重算脚本，历史生成回放与现场本地检索重算必须明确标注。
主讲与追问均准备分数未达预期的解释，后续优化保持候选验证方向，不在演示前擅自冻结或执行新实验。

**完成结果**：本人留下实际时长、卡点、回答过的问题和未完成能力；分享后同步日计划与状态。
在本人执行前，演练/分享/掌握验收保持待完成。完整 W13 验收仍由 §3 的技术条件判断。

**至多一个附加项**：演练与分享主线完成后，完成既有债务重建（BM25/dense 端到端人工语义判定已于 D5 完成）。
无余力则顺延；不提前启动 W14，不读取 holdout，不为展示新增模型调用、语料或调参。

## 6. 依赖、顺延与砍范围规则

1. 当天主线未完成时，下一学习日先完成该阶段，不把日期标签对应的后续任务叠加。
2. D2 冻结 eval，并在同日延展中闭合 Prompt/schema/source/citation 契约；门禁未通过时不进入 D3。
3. D3 serialization 契约未完成时，不实现 parser、计量或 baseline；全语料上下文基线证据包未完成时，
   不开始 BM25。进入 BM25 后发生溢出时，不启动 chunk 变体和预处理对照，
   不修改已经冻结的规则文档语料快照或 eval。
   仓库 Markdown 扩展语料已在计划中固定为条件扩展，未启动不形成顺延项；一旦冻结并建立相关 eval，也不得事后缩小范围。
4. 常规质量路径仍要求 BM25 retrieval 通过后进入端到端验收；D4 §6.21 本人明确授权的例外仅用于链路可重复运行展示，不能当作门禁通过。D5 复用其记录，不借演练重开调参。
5. 原定技术依赖为 BM25 端到端通过后进入 dense；D4 已形成未过门禁下的 dense 对照与首次 holdout 记录，不能把运行事实当作依赖已经通过。完整 LangChain dense 接线与生成仍待补；首次 holdout 已结束，不用于调参，后续只按预先冻结的 regression 节点复跑。
6. D5 按本次决定以分享演练为主线；必要展板服务已验证成果，不能替代技术证据和本人掌握。其它视觉扩展继续作为周末条件项。

范围不足时按以下顺序移除：

1. hybrid/RRF。
2. 量化 ONNX 对照和第二 embedding 模型。
3. 多组 chunk 或中文预处理变量。
4. 尚未启动的仓库 Markdown 扩展语料；已经冻结的 snapshot 与 eval 不得事后缩小。

不得删除：术语讲解、冻结 corpus/eval/serialization、全语料上下文基线评测、LangChain BM25 端到端链路、
LangChain dense 同集对照、首次 holdout、citation/abstention、dev/holdout 隔离、逐题失败归因和本人掌握验收。

## 7. Eval 与证据规则

- snapshot 在第一道 eval 题之前冻结，避免根据题目反向选择语料。
- 题目、标签、指标、阈值、通过标准和核心断言由本人定义；AI 只解释概念并 review 可证伪性。
- 全语料上下文基线可运行时与 BM25、dense 使用同一冻结 dev set；BM25 与 dense 始终使用同一规则文档语料快照
  和冻结 dev set。每次变更保留变更前结果，不覆盖历史证据。
- dev/holdout 使用物理分离文件或目录，并共享同一 eval schema；所有常规开发入口只读取 dev 路径。
- 五类行为均有冻结 corpus 依据：直接可回答、跨文档、近似表述、优先级/冲突/例外和无答案。每类在 dev 与
  holdout 中各 2 个非等价 items，共 20 题（dev 10、holdout 10）。
- dev/holdout 题意由本人确认，AI 在 D2 按已确认题意生成文件、稳定 ID、source span identifier 与 hash；
  该版题面早于访问保护规则存在，可见性边界见 [既有事件记录](../../incidents/2026-09-10-holdout-content-visibility.md)。
  holdout 不用于方案选择或调参。首次运行只能发生在 serialization、实现、
  Prompt、BM25/dense 配置、eval 版本和评分规则全部冻结之后；运行后它成为冻结回归集，不再称为未见结果集，
  首次结果不得反向用于调参，后续只按预先冻结的 regression 节点复跑。
- 每次运行关联 corpus、Prompt、模型、token 计量方法、retrieval 配置和实现版本；若生成模型没有公开且
  可复现的精确 tokenizer，估算结果与 provider 返回的实际 usage 分开记录。
- 若模型服务或本地层实际暴露 cache hit/miss，则记录其命中状态和可观察成本；若没有启用或没有可观察
  字段，明确写为不适用或不可观察，不从延迟差异推断缓存命中。
- 结果按事实、推断和待验证分开记录。一次运行成功只证明该次链路成功，不直接证明整体质量或掌握。
- 失败至少先分到 retrieval miss、context assembly、prompt 或 generation，再决定是否需要更细归因。
- 全语料上下文基线达到本人门槛时，后续 BM25/dense 仍作为教学对照；结论不得扩大为当前场景生产上必须使用 RAG。

## 8. Dense retrieval 的环境边界

- 默认候选为 `intfloat/multilingual-e5-small`，首选 ONNX Runtime `1.23.2` 与发布者 fp32 模型文件。
- 进入 dense 阶段时，必须先解释相关术语，再执行安装与 wheel/hash 冻结；不与未完成的 BM25 主线叠加。
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
| serialization、chunk、retrieval、ranking、context assembly 的语义与验收 | 本人冻结；AI 不在确认前代填 |
| parser、retrieval、LangChain wiring、测试与机械实现 | 语义冻结后 AI 可实现、自测并提交 diff 供本人 review |
| 运行证据整理与文档同步 | AI 可按已发生事实协助，不代写结果或掌握结论 |

若 AI 在本人确认前代填架构取舍、Prompt/eval 语义、阈值、权限或核心断言，必须同步更新 `DEBT.md`、当天笔记
和 `LEARNING-STATE.md`；语义冻结后的实现方交付不记学习债务。

本人追问产生的补充讲解默认不是新的考核题。AI 必须标明当前问题属于计划中的哪个步骤；需要临时巩固时，先说明
它是计划外练习并取得本人确认。补充讲解结束后返回最近一个未完成的计划项，不把相关经验自动扩张为新的学习支线。

建立 eval items 时，本人可以在对话中按同一设计点批量给出准确 query、预期分支、规则结论和证据位置思路，
不承担 JSON 录入、schema 排版、identifier 机械核对或 hash 计算。AI 只在本人确认语义后执行这些机械工作；
query 的准确措辞会直接影响 retrieval 对照，不属于纯格式工作，仍由本人确定。

首次开始正式题目设计前，AI 先用一个明确排除在 dev/holdout 之外的完整示例说明 evaluation item 解决的问题、
query、expected behavior、规则结论和 evidence requirement 如何配合。示例不计入 20 题，也不得直接改名后进入
题集；本人理解结构后，再按一个行为类型一批四题提交正式语义。

## 10. 周收口清单

> 本节是执行期 checklist（2026-09-10 D4 收口时更新）。未勾选项已写明实际结果与去向。

- [x] 规则文档语料 snapshot、manifest、来源 commit、字节与 token 证据完整。（D1）
- [x] eval 与 RAG Prompt 由本人冻结，dev/holdout 隔离有证据。（D2；默认 Prompt 回到 `w13-rag-prompt-v1`，v2 已回滚）
- [x] 全语料上下文基线评测已完成并写出结论边界。（D4 §6.14 / §6.19：机械 8/10、人工判定 4/10，未达阈值）
- [x] BM25 retrieval 可以定位到冻结来源。（检索结果全部为冻结 `source_id`；但 retrieval 门禁未通过，见下两项）
- [x] **BM25 端到端 RAG 已执行（2026-09-10，本人决定的计划变更）**：目的是链路可重复运行证据，**不用于质量验收**。10 条均 `status=ok`，机械 8/10、`citation_precision_min = 1.0`、context 1,332–2,020 字符（全语料为 89,854）。`split_status` 仍为 `fail`，retrieval 门禁结论不变（D4 笔记 §6.21）。
- [x] dense retrieval 已完成同集对照。（D4 §6.17：3–5/8，未达阈值；直接 ONNX/NumPy 路径）
- [x] **LangChain dense 接线与 dense 端到端 generation 已完成（2026-09-11，本人授权的链路演示例外）**：`E5Embeddings` + `InMemoryVectorStore` 接线，与 `dense_retrieve` 在 10 条 dev 上 top-10 顺序与集合一致（分数差 ≤ 7.31e-08；F12 冻结对象未变）；dense e2e 10 条真实调用：9 `ok` + 1 `schema_error`、机械 7/10、`max_achievable` 0.7 → **链路证据，不作质量验收**。记录见 [dense-langchain-wiring-freeze.md](./dense-langchain-wiring-freeze.md)。
- [x] **首次 holdout 已运行（2026-09-10，本人声明实现冻结后）**：10 条均 `status=ok`，机械通过 **8/10**；两条由机械条件失败（`paraphrase-02` citation 不可解析、`priority-conflict-01` 期望 answered 却 abstained）→ `max_achievable = 0.8 < 0.9` → **未通过**（结论不依赖语义判定）。逐题人工语义判定待补（素材已生成在本地，未入库）。
- [x] baseline 逐题诊断、token usage 与已有延迟记录可追溯；retrieval 9 个有效配置、10 份文件（含 1 份缺陷版本）。成本账单与稳定延迟收益未验证；BM25/dense 端到端的人工语义判定已在 D5 完成且均未通过（各 3/10），不写成全部完成。
- [x] cache hit/miss 已按实际可观察性记录。（`prompt_cache_hit_tokens` 可观察到 0 → 44k 量级）
- [ ] **本人能讲清成功路径、两个失败路径和一项合理变更的影响范围** —— 待本人确认（AI 不代填）。
- [x] W15 D1 的 retrieval 确定性数据流延迟重建入口已写入 `LEARNING-STATE.md`。（本轮已写入）
- [x] 当周未完成项均有明确去向。D4 历史提交见 Git；本次 D5 准备修改尚未提交或部署。
- [ ] D5 主讲与追问演练、分享实际记录 —— 材料已准备，待本人执行并记录时长与卡点。
