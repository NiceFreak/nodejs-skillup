# Week 13 计划：RAG Foundations（9/7-9/11）

> 建立：2026-09-06（Asia/Shanghai）。
>
> 术语修订：2026-09-06。移除没有跨厂商统一含义的 A/B/C 语料分级，改为按内容与范围直接命名；
> 同步把原先压缩的基线验收名称改写为全语料上下文基线评测及其明确完成条件。语料范围与执行顺序不变。
>
> 状态：执行中，当前为 D1。W13 继承 W12 已完成的 Python 3.12、真实模型客户端与版本化 Prompt
> 基线，但不把 W12 的信息提取 Prompt 当作 RAG Prompt。
>
> 协作模式：默认导师模式。AI 先解释术语、原理、职责边界和验证方式，再由本人完成 RAG 方案取舍、
> 评测设计、Prompt 内容、核心实现与核心断言。配置、依赖、Python/库 API 语法和机械证据整理按白名单处理。
>
> 本计划以每日需要完成的成果组织，不给具体任务预设时长。每天只保留一条主线和至多一个附加项；
> 主线未达到完成条件时，附加项不启动。

## 0. 当前输入与事实边界

### 0.1 已确认事实

- W12 五项交付与独立掌握已经收口；W13 可复用其 Python 3.12 环境、DeepSeek 客户端和测试入口。
- W12 的 [`prompt-v0.md`](../../week12-python-rag/prompts/prompt-v0.md) 用于用户注册信息提取，
  `Retrieved Context` 明确为无检索。它只证明 Prompt 已进入版本管理，不是 W13 的 RAG Prompt。
- 规则文档语料范围已由本人确认，并在 D1 从 source commit
  `c0a4b85c9065cbfb943584c914172d7819339791` 冻结为七文件 snapshot；共 76,149 bytes，raw corpus-only
  结果为 18,680 estimated tokens。完整清单与证据见 §2.1 和 D1 笔记。
- 仓库 Markdown 扩展语料目前只有 W12 D5 的规模盘点与排除类别；它作为条件扩展，语料快照、文件清单、token 计量和
  eval 尚未执行，也不作为 W13 核心 demo 的完成前提。
- W13 的代码、检索质量、生成质量、延迟和本地 dense runtime 当前都属于待验证，不写成已完成事实。

### 0.2 已继承决定

- 语料快照必须发生在第一道 eval 题建立之前。
- 规则文档语料是 D1-D5 的必做 corpus；全语料上下文基线、BM25 与 dense 的对照均使用同一个规则文档语料快照。
- 仓库 Markdown 扩展语料使用独立版本。只有核心主线已完成时才启动，且必须先冻结自己的 snapshot，再建立任何
  依赖它的 eval；不得把两套语料的结果混成同一组对照。
- 先完成全语料上下文基线评测，再实现 BM25 与 dense retrieval：规则文档语料能完整容纳时运行 baseline；不能容纳时
  保留容量不可行证据，不静默裁剪后仍称全语料上下文。两种结果都用于判断 RAG 的必要性边界。
- dev set 与 holdout set 使用物理分离的文件或目录，并共享同一 eval schema。dev set 用于本周迭代；holdout
  set 在 D4 最终冻结前不运行、不查看结果，也不用于选择方案或调参。D4 完成实现、配置和 eval 版本冻结后，
  以首次 holdout 运行作为当天最后一个实验动作；结果只供 D5 分析与验收，到 W16 回归前不再据此调参。
- 本周必须形成可独立重复运行的最小 RAG 链路；CLI 或等价命令入口即可，不新增 UI。
- BM25 是端到端 demo 的稳定实现。dense retrieval 必须学习并尝试实测，但不得成为 demo 的单点依赖。
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

- D4 收工前必须至少保留一次与冻结版本关联的真实 generation 成功证据，否则不能判定端到端 RAG 完成。
- D5 现场模型调用失败时，可以实时展示 retrieval 与 context assembly；此前同版本的 generation 输出只能
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
| D2 | ingestion、preprocessing、chunk、chunking、metadata、inverted index、BM25、ranking、retrieval result |
| D3 | context assembly、grounded generation、retrieval miss、prompt failure、generation failure |
| D4 | embedding、dense retrieval、ONNX Runtime、model revision、execution provider、vector normalization、similarity、truncation、cold start、p50/p95、RSS、holdout evaluation；条件项启动前再解释 hybrid retrieval 与 reciprocal rank fusion（RRF） |
| D5 | holdout evaluation、failure attribution、regression、evidence boundary |

D1 的具体解释与开工顺序见 [`day1-corpus-freeze-and-baseline.md`](./day1-corpus-freeze-and-baseline.md)。

## 5. 每日主线

### D1（9/7）：冻结输入、评测契约并完成全语料上下文基线评测

**主线**：先完成术语导览，再按固定依赖顺序完成规则文档语料快照、token 计量、本人 eval/Prompt
冻结和全语料上下文基线评测。

**完成结果**：同一来源版本上的 corpus、eval 与全语料上下文基线评测证据可以复核；能完整容纳时保留实际
baseline，不能容纳时保留容量不可行证据，并写出证据支持与不能支持的 RAG 必要性结论。

**附加项**：主线完整后才决定是否建立仓库 Markdown 扩展语料的独立快照、manifest 与 token 记录。未启动时保持
“候选扩展，未验证”，不转入 D2-D5 主线。

### D2（9/8）：建立可追溯的 BM25 retrieval

**主线**：先解释 ingestion、chunking、metadata、倒排索引与 BM25，再由本人实现从冻结文档到可检索
chunk 的确定性链路，并在冻结 dev set 上运行 retrieval eval。

**完成结果**：一个 query 能返回有排名的相关 chunk，并能定位回冻结快照中的实际来源；原始文档、chunk、
metadata 与检索结果之间的关系可以由本人讲清。

**附加项**：只在主线通过后比较一个本人预先选择的中文预处理或 chunk 变量；不并行展开多组参数搜索。

### D3（9/9）：完成 BM25 端到端 RAG v0

**主线**：在已验收的 BM25 retrieval 上接通 context assembly、本人冻结的 RAG Prompt、真实模型 generation、
citation 与 abstention，并重跑同一冻结 dev set；同时形成稳定命令或等价的可重复运行入口并保留原始证据。

**完成结果**：D3 的计划门槛是形成可重复运行的真实 BM25 RAG 纵向链路；retrieved evidence、assembled
context 与 final answer 可分别观察，引用能够返回冻结来源，另一环境可按记录的入口重新运行。

**附加项**：主线通过后才使用本人预先冻结的案例做一次 demo 预演；不新增 UI，也不临时挑选更好看的案例。

### D4（9/10）：完成 dense 对照、冻结稳定 demo 并首次运行 holdout

**主线**：若 D3 已通过，则先解释 D4 术语，再完成 dense runtime 门禁、dense retrieval 与同集对照，
随后回归 BM25 端到端链路；
若 D3 未通过，D4 唯一主线改为完成并稳定 BM25 RAG，当天不启动 dense。后一种情况必须把 W13 dense
范围标为未完成并记录去向，不能把“dense 不阻塞 W14”写成“dense 已完成”。

**完成结果**：D4 的最终阻断门槛是存在一条可独立重复运行的 demo 主路径和保留原始证据的备用路径。dense 失败时，
BM25 demo 仍成立；dense 只按实际证据标为成功、失败或未验证。只有实现、Prompt、retrieval 配置、eval 版本和
评分规则全部冻结后，才以冻结版本首次运行物理隔离的 holdout set，并保存原始结果；该运行是 D4 最后一个实验
动作，运行后不得修改本周方案。

**附加项**：BM25 与 dense 均通过后，才由本人决定是否做 hybrid/RRF；该项不能改变 D5 的入口。

### D5（9/11）：holdout 结果分析、失败归因与独立验收

**入口门禁**：D4 只有在稳定的 BM25 端到端实现、配置和 eval 版本均已冻结后，才能首次运行 holdout set。
若该门禁未过，D4 不消耗 holdout；D5 不补首次集成，直接记录 W13 未达到完整成果，并保留 holdout 给后续冻结
版本验收。

**主线**：门禁通过后，D5 使用 D4 保存的首次 holdout 原始结果逐题归因；随后由本人完成完整链路口述、故障
分析、合理变更影响预测和最终 demo 运行。最终 demo 使用预先冻结的 demo/dev 案例，不根据 holdout 结果临时
挑选案例。

**完成结果**：holdout 结果、失败归因、版本证据、能力边界与 W14 交接物全部落盘。D5 不新增核心实现、
不根据 holdout 结果调参，也不重写方案。

**附加项**：没有。D5 只收口本周已经形成的链路。

## 6. 依赖、顺延与砍范围规则

1. 当天主线未完成时，下一学习日先完成该主线，不把原计划任务直接叠加。
2. D1 未形成冻结 corpus、eval 与全语料上下文基线评测结果，D2 不开始 BM25 核心实现。
3. D2 发生溢出时，优先删除 chunk 变体和预处理对照，不修改已经冻结的规则文档语料快照或 eval。
   仓库 Markdown 扩展语料已在计划中固定为条件扩展，未启动不形成顺延项；一旦冻结并建立相关 eval，也不得事后缩小范围。
4. D3 未形成 BM25 端到端链路，D4 不启动 dense，先保证真实 RAG demo 在 D4 完成；dense 范围如实判为未完成。
5. dense 本地 runtime 失败时，按冻结门禁停止排障并评估 embedding API；不源码编译，不让 dense 阻塞 BM25。
6. D5 不承接首次端到端集成或首次 holdout 运行。D4 仍未形成稳定 RAG 时，不运行 holdout，W13 不能按完整
   成果验收。

范围不足时按以下顺序移除：

1. hybrid/RRF。
2. 量化 ONNX 对照和第二 embedding 模型。
3. 多组 chunk 或中文预处理变量。
4. 尚未启动的仓库 Markdown 扩展语料；已经冻结的 snapshot 与 eval 不得事后缩小。
5. dense 的增强实验；若 D3 入口已通过，保留至少一次真实尝试及边界记录。若 D3 未通过而未启动 dense，
   明确记为未执行，W13 判为部分完成。

不得删除：术语讲解、冻结 corpus/eval、全语料上下文基线评测、BM25 端到端链路、citation/abstention、
dev/holdout 隔离、逐题失败归因和本人独立掌握验收。

## 7. Eval 与证据规则

- snapshot 在第一道 eval 题之前冻结，避免根据题目反向选择语料。
- 题目、标签、指标、阈值、通过标准和核心断言由本人定义；AI 只解释概念并 review 可证伪性。
- 全语料上下文基线可运行时与 BM25、dense 使用同一冻结 dev set；BM25 与 dense 始终使用同一规则文档语料快照
  和冻结 dev set。每次变更保留变更前结果，不覆盖历史证据。
- dev/holdout 使用物理分离文件或目录，并共享同一 eval schema；D1-D4 的常规开发入口只读取 dev 路径。
- 五类行为均有冻结 corpus 依据：直接可回答、跨文档、近似表述、优先级/冲突/例外和无答案。每类在 dev 与
  holdout 中各 2 个非等价 items，共 20 题（dev 10、holdout 10）。
- holdout 题目由本人在 D1 创建并冻结，但在 D4 最终冻结前不运行、不用于方案选择或调参。D4 冻结后首次运行，
  D5 只分析保存的原始结果，不据此调整本周实现；其后作为冻结回归集留给 W16 比较，不再称为未见结果集。
- 每次运行关联 corpus、Prompt、模型、token 计量方法、retrieval 配置和实现版本；若生成模型没有公开且
  可复现的精确 tokenizer，估算结果与 provider 返回的实际 usage 分开记录。
- 若模型服务或本地层实际暴露 cache hit/miss，则记录其命中状态和可观察成本；若没有启用或没有可观察
  字段，明确写为不适用或不可观察，不从延迟差异推断缓存命中。
- 结果按事实、推断和待验证分开记录。一次运行成功只证明该次链路成功，不直接证明整体质量或掌握。
- 失败至少先分到 retrieval miss、context assembly、prompt 或 generation，再决定是否需要更细归因。
- 全语料上下文基线达到本人门槛时，后续 BM25/dense 仍作为教学对照；结论不得扩大为当前场景生产上必须使用 RAG。

## 8. Dense retrieval 的环境边界

- 默认候选为 `intfloat/multilingual-e5-small`，首选 ONNX Runtime `1.23.2` 与发布者 fp32 模型文件。
- D4 在解释相关术语后执行安装与 wheel/hash 冻结，不把环境任务提前叠加到 D1。
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

> 本节是执行期 checklist。当前为 D1 执行中，空框表示待做；D5 收口时每项必须勾选或写清结果与去向。

- [ ] 规则文档语料 snapshot、manifest、来源 commit、字节与 token 证据完整。
- [ ] eval 与 RAG Prompt 由本人冻结，dev/holdout 隔离有证据。
- [ ] 全语料上下文基线评测已完成：baseline 已运行，或规则文档语料容量不可行证据完整；RAG 必要性结论边界已写清。
- [ ] BM25 retrieval 可以定位到冻结来源。
- [ ] BM25 端到端 RAG 可以独立重复运行并展示 citation/abstention。
- [ ] dense retrieval 已完成同集对照；若未完成，本项保持未勾选并写明阻断与去向。
- [ ] D4 最终冻结后首次 holdout 已运行；D5 只分析原始结果，未据此调参。
- [ ] 逐题失败归因、质量、延迟、token 与成本证据已落盘。
- [ ] cache hit/miss 已按实际可观察性记录，或明确标为不适用/不可观察。
- [ ] 本人能讲清成功路径、两个失败路径和一项合理变更的影响范围。
- [ ] W15 D1 的 retrieval 确定性数据流延迟重建入口已写入 `LEARNING-STATE.md`。
- [ ] 当周未完成项均有明确去向；是否 commit 由本人决定。
