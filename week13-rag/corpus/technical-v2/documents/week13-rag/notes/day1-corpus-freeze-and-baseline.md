# W13 D1：冻结 corpus、eval 并完成全语料上下文基线评测（9/7）

> 建立：2026-09-06（Asia/Shanghai）。
>
> 状态：**D1 已按部分完成收口**。9/7 已完成规则文档语料 snapshot、raw corpus-only token estimate
> （18,697）与前置讲解；eval 仅确认 1/20 题意，Prompt、serialization、完整输入容量与 baseline 当日未完成。
> 本文保留 D1 及 9/8 初次容量调整的历史计划；后续计划已继续修订，当前进度以根 `LEARNING-STATE.md` 为准。
>
> 周计划：[`week13-plan.md`](./week13-plan.md)。
>
> 协作模式：默认导师模式。D1 首先由 AI 解释术语，不默认本人已经知道新主题的概念；随后 corpus 范围、
> eval、Prompt、context budget 与正确性判断均由本人冻结。AI 只对配置、命令、Python/库 API 语法和
> 已确认清单的机械处理提供白名单实现。
>
> 本计划按依赖顺序和完成证据组织，不为具体任务预设时间。

## 0. D1 要解决的问题

D1 不实现 BM25 或 dense retrieval。当天要先建立一个可以公平比较后续方案的实验起点：固定使用哪些文档，
确认它们在目标模型下占多少 token，由本人定义什么叫答对，再判断并运行不经过检索的全语料上下文基线。

```text
术语讲解
  -> 语料快照
  -> token 计量与上下文容量检查
  -> 本人冻结 eval 与 RAG Prompt
  -> 全语料上下文基线
  -> RAG 必要性边界结论
```

**今日唯一主线**：完成上面整条依赖链，并保留可复现证据。

**主线完成句**：

> 在第一道 eval 题建立前已冻结 corpus；随后使用已记录的 token 计量方法，并区分精确值、估算值与模型
> 服务返回的 usage。本人冻结 dev/holdout、评测判据与 RAG Prompt，并在 dev set 上完成可复现的
> 全语料上下文基线评测：规则文档语料能完整容纳时运行 baseline，不能容纳时保留容量不可行证据；结论明确写出
> 证据支持什么、不能支持什么。

**附加项**：只有主线完整后，才决定是否为仓库 Markdown 扩展语料建立独立 snapshot、manifest 与 token 记录。它不是
D1 必做项；未启动或未形成完整版本时，不进入 D2-D5 的核心对照，也不形成顺延任务。

## 1. 开工状态

### 1.1 已确认事实

- W12 Python 3.12、测试入口与 DeepSeek 客户端已经运行验证；具体证据见
  [`day5-diagnosis-and-wrapup.md`](../../week12-python-rag/notes/day5-diagnosis-and-wrapup.md) §5.6/§5.8。
- 规则文档语料的七份文件已经由本人确认；D1 仍需从实际 source commit 重新生成快照与体积证据。
- 仓库 Markdown 扩展语料只有历史规模盘点和排除类别，没有语料快照或 token 结果。
- W12 [`prompt-v0.md`](../../week12-python-rag/prompts/prompt-v0.md) 的任务是用户注册信息提取，
  不是 RAG Prompt，也不能直接作为全语料上下文基线的正确性契约。
- 开工时 `main` 与 `origin/main` 对齐，工作树无未提交改动；本人确认以
  `c0a4b85c9065cbfb943584c914172d7819339791` 作为规则文档语料的 source commit。
- 规则文档语料 snapshot 已从该 commit 的 Git object 提取到
  [`rules-c0a4b85`](../corpus/rules-c0a4b85/manifest.json)，随后执行不移动既有正文行号的 `repository-content-v1`
  normalization：7 个文件，共 76,243 bytes。manifest 记录来源基线、normalization、原始路径、快照路径、
  SHA-256 与 Git blob；当前内容逐文件完整性验证通过。

### 1.2 开工时的待查证或待运行项（结果见 §10）

- 规则文档语料的 token 数；snapshot、manifest 和字节数已经实测。
- 目标模型、context window 的来源和 token 计量方法。
- 全语料上下文基线的质量、延迟、token 使用和 RAG 必要性结论。

### 1.3 待本人冻结的决定

- instructions、query、输出和安全余量如何分配，以及由此得到的 context budget。
- eval 题目、标签、指标、阈值与完整通过标准。
- RAG Prompt 内容及 grounding、citation、abstention 的正确性要求。
- 根据哪些已冻结结果判断 RAG 的必要性边界。

## 2. 术语讲解必须先于对应任务

### 2.1 开工方式

本人当天的第一个学习动作，是先用白话看懂 §0 的整条链路，再讲解 §2.2 A 组。其余概念不一次性灌输，
而是在第一次用于判断或操作之前分组讲解。每组必须说明：

1. 通用技术术语的中英文名称；非行业固定术语的组合表达必须展开实际操作和完成条件，不作为新的 RAG 概念。
2. 它解决什么问题。
3. 输入、输出和职责边界。
4. 它在 D1 哪一步出现。
5. 最容易与哪个概念混淆。

本人可以在每组后追问。A 组未完成前不执行 snapshot；B 组未完成前不选择 tokenizer 或判断上下文容量；
C/E 组未完成前不设计 eval 或给失败分类；D 组未完成前不设计 RAG Prompt。讲解后的简短复述只用于
确认双方理解一致，不是预设知识考试。

`corpus`、`token`、`tokenizer`、`eval` 等是通用技术术语；`语料快照`、`上下文容量检查`和
`全语料上下文基线`只是直接描述版本固定、容量检查和基线实验的组合表达，不定义额外的 RAG 分类。

### 2.2 D1 术语表

#### A. 资料与版本

| 术语 | D1 中的含义 | 需要区分 |
|---|---|---|
| 语料库（corpus） | 允许系统检索或作为模型上下文使用的文档集合 | 不是整个工作区，也不自动包含所有 Markdown |
| 语料快照（corpus snapshot） | 从一个明确来源版本复制出的固定输入集合 | 文件清单不等于已经复制并冻结的内容 |
| 来源追溯（provenance） | 说明每份内容来自哪个 commit、路径和版本 | 当前工作树内容不能默认等同于某个 commit |
| 语料构建（corpus construction） | 确定文档纳入/排除范围，并完成冻结、清理、切分和来源标记等输入准备过程 | 属于数据准备；不是 retrieval，也不是 generation |
| 证据覆盖（evidence coverage） | 目标问题所需的支持证据是否存在于已构建 corpus 中 | corpus 有证据但 retrieval 未取回属于 retrieval miss，不是 corpus 缺证据 |

#### B. 模型输入容量与计量

| 术语 | D1 中的含义 | 需要区分 |
|---|---|---|
| 词元（token） | 模型和 tokenizer 处理文本时使用的计量单位 | byte、字符和 token 不能互相直接换算 |
| 分词器（tokenizer） | 把文本转换为 token 序列的具体实现 | 不同模型或版本可能得到不同 token 数；生成模型未必公开精确 tokenizer |
| 特殊 token（special token） | tokenizer 为角色、消息边界、开始或结束等协议结构保留的标记 | 用户未在正文中键入，不表示它不占 token |
| 提示词渲染（prompt rendering） | 把结构化 messages、工具定义等转换成模型实际接收序列的过程 | API JSON 中可见文字不一定等于最终模型输入序列 |
| 指令（instructions） | 告诉模型任务、行为边界和输出约束的输入内容 | 它不是用户问题，也不是支持答案的 corpus 证据 |
| 查询（query） | 本次希望系统回答或处理的问题 | 它决定信息需求，但不是 retrieval 结果或证据 |
| 序列化语料（serialized corpus） | raw corpus 按确定规则拼装后真正准备进入 prompt 的文本，包括所需来源标识和文档边界 | 它不包含消息角色包装，也不表示已经调用模型 |
| 消息/渲染开销（message/rendering overhead） | prompt rendering 产生的角色标记、消息边界和其它特殊 token 所占容量 | rendering 是过程，overhead 才是计量结果，二者不能重复相加 |
| instructions、query 与 message/rendering overhead 的合并输入预算（本实验预算分组） | 为这三项共同设置的输入 token 总上限 | 没有对应的统一行业术语；不是 provider 字段、实际 usage，也不表示三项被拼成一个输入字段 |
| 预留输出 token（reserved output tokens） | 按本次任务需要为 generation 预留并在实验中固定的最大可用容量 | 受模型最大输出能力约束，但不必取能力上限；预留量也不是实际生成量 |
| 安全余量（safety margin） | 为离线估算误差、线上渲染差异和输入小幅变化而主动不占用的容量 | 它不是发送给模型的内容，也不是 provider 自动保证的空间 |
| 语料专属 token 数（corpus-only token count） | 只计冻结 corpus，用于请求前判断完整语料能否进入 context budget | 不包含 instructions、query、格式标记和模型输出 |
| 用量字段（usage） | 模型服务在真实请求结果中返回的输入、输出等用量记录 | 它是该次请求的运行证据，不自动给出整个 corpus 的离线计量结果 |
| 上下文窗口（context window） | 一次模型请求可容纳输入与输出的总 token 上限 | 对冻结的模型/API 条件是容量上限，不会因某次 query 或 corpus 变长而逐渐缩小；变化的是占用量与剩余容量 |
| 上下文预算（context budget） | 从窗口中为 corpus 或 retrieved context 预留的可用部分 | 还要给 instructions、query、输出和安全余量留空间 |
| 上下文压缩（context compaction） | 由 harness 把较早的会话状态压缩成更短表示，以便长任务继续 | 不等于 prompt cache，也不是 RAG retrieval；压缩会改变后续实际输入表示 |
| 上下文容量检查 | 检查指定输入能否放入已经冻结的预算 | “文件不大”不能替代有方法和边界的 token 计量 |

#### C. 评测与对照

| 术语 | D1 中的含义 | 需要区分 |
|---|---|---|
| 评测（evaluation，eval） | 用预先定义的输入和判据检查系统行为 | 运行成功不等于回答正确 |
| 评测项（evaluation item） | 评测集中的一个独立样本，至少包含一条 query，并关联该题的预期行为或判据 | 它不是整套 eval，也不是模型生成的答案 |
| 单题响应（per-item response） | 某个已冻结实验条件对一个 evaluation item 产生的一次模型输出 | 它是待评对象，不是 reference answer、label 或汇总分数 |
| 输出边界（output envelope） | 规定单题响应允许包含的功能内容、明确排除项与最长合格范围 | 类似 Web API 的 response contract 与 payload size 边界；不是参考答案或实际 token 用量 |
| 单题 claim 数上限（maximum claim count） | answered 分支一次最多允许返回的独立规则结论数量 | 与 API page size 都限制条目数，但不自动引入分页、cursor 或后续模型调用 |
| 评测记录（evaluation record） | 把 item identity、预期判据、实际响应、解析结果和各项检查结论关联起来的实验记录 | 它由评测流程产生，不应要求模型自己填写预期与实际差异 |
| 标签（label） | 与一道题绑定的预期类别、行为或应命中的来源目标 | 它不是模型实际输出，也不等于完整答案文本 |
| 指标（metric） | 按明确规则汇总或比较运行结果的方法 | 指标名称本身不包含合格边界 |
| 阈值（threshold） | 某个量化指标达到或未达到的分界值 | 阈值只是通过标准的一部分 |
| 通过标准（passing criteria） | 综合量化阈值、关键定性约束与失败条件后作出验收判断的完整规则 | 不能只写一个平均分，也不能在看完结果后临时修改 |
| 开发集（development set，dev set） | D2-D4 可以反复运行，用于比较变更的题集 | 可以据此改进系统，因此不能承担最终未见数据验收 |
| 留出集（holdout set） | 本人在 eval 阶段创建并冻结，与 dev 物理隔离；实现和全部相关契约冻结前不运行且不用于选择方案或调参 | 本人知道自己写过的题目，不等于运行结果已见；9/8 修订后首次运行不排入 W13 当前日程 |
| 基线（baseline） | 后续方案需要与之比较的固定起点 | 基线不表示最佳方案 |
| 全语料上下文基线 | 不先检索，直接把声明范围内的全部冻结 corpus 交给模型回答 | 规则文档语料放不下时应记录不可行，不能裁剪后仍把结果称为全语料上下文 |

#### D. 回答约束

| 术语 | D1 中的含义 | 需要区分 |
|---|---|---|
| RAG 提示词（RAG Prompt） | 规定 instructions、query、context 与输出的关系，并约束模型如何基于证据回答、引用或拒答 | W12 Prompt 处理注册信息提取且没有 retrieved context，职责不同，不能直接改名复用 |
| 响应格式/模式（response format/schema） | 约束模型输出中各功能部分如何表示，使程序能够确定性解析 | 格式有效只证明可解析，不证明答案或 citation 正确 |
| JSON Schema | 描述 JSON 数据类型、必填字段、枚举和嵌套结构等约束的标准化契约语言 | 它不是 RAG 专属 schema；provider 的 Structured Outputs 往往只支持其子集 |
| JSON mode / JSON Output | provider 约束模型返回合法 JSON 文本的能力 | 合法 JSON 不自动满足应用字段、类型和语义要求 |
| 结构化输出（Structured Outputs） | provider 按声明的 schema 约束模型输出结构的能力 | schema adherence 仍不证明答案事实正确；不同 provider 的参数与支持子集不同 |
| 证据约束生成（grounded generation） | 要求回答受给定 context 中的证据约束 | 模型语言流畅不表示有证据支持 |
| 引用（citation） | 回答指向实际使用的冻结来源位置 | 模型输出一个看似真实的路径不等于引用有效 |
| 原子化论断（atomic claim） | 只表达一个可独立判断、可独立关联 citation 的结论单元 | 类似单元测试中的一个核心断言；语义上单一不等于语法上必须恰好一句 |
| 引用标识（citation identifier） | 模型可见、可返回的受控稳定键，用于指向一个可引用来源块 | 标识不是证据正文，也不应依赖 source block 的序列化顺序 |
| 引用注册表（citation registry） | 本实验维护的本地映射表，把 citation identifier 确定性解析为冻结来源位置 | 是本实验的实现称谓，不是所有 RAG 系统都必须采用的标准组件名 |
| 来源范围（source span） | 冻结文档中一段有明确起止边界、可回读核验的原文范围 | 不是“第几个序列化段落”；只定位到文档也未必足够精确 |
| 引用解析（citation resolution） | 检查 identifier 是否存在，并通过 registry 找到对应 source span | 映射成功只证明引用目标存在，不证明该原文支持 claim |
| 引用正确性（citation correctness） | 检查已解析的 source span 是否实际支持与它关联的 claim | 这是内容关系检查，不能由键值查表本身完成 |
| 拒答（abstention） | 证据不足或超出范围时明确不作无依据回答 | 拒答不是运行错误，也不等于所有不回答都正确 |
| 正常回答/拒答分支（answered/abstained branch） | 同一响应契约下两种互斥的合法结果形态：有证据时回答，证据不足时拒答 | 类似 Web API 按结果返回不同 response variant；不是额外模型调用或新的 pipeline 阶段 |
| 简短拒答原因（abstention reason） | 面向使用者说明当前提供的证据为何不足 | 不是模型内部推理，也不能单凭模型自述确定 retrieval、corpus 或 Prompt 的系统根因 |
| 拒答原因代码（reason code） | 从预先冻结的有限集合中选择的机器可读拒答类别 | 类似 response body 中的应用错误码，不等于 HTTP status，也不能由模型任意创造新类别 |
| 拒答原因文本（reason text） | 与 reason code 一致的简短人类可读说明 | 用于初步理解，不承担系统根因判定或完整诊断报告 |

#### E. 失败所在阶段

| 术语 | D1 中的含义 | 需要区分 |
|---|---|---|
| 检索遗漏（retrieval miss） | corpus 中有支持证据，但 retrieval 没有把合适内容取回 | D1 的全语料上下文基线没有 retrieval，因此不适用 |
| 上下文组装失败（context assembly failure） | 已取回的证据在筛选、排序、截断或拼装后没有正确进入模型输入 | 不能把它和“根本没检索到”混为一类 |
| 提示词失败（prompt failure） | 输入证据足够，但 Prompt 没有清楚约束回答、引用或拒答行为 | 需要与模型服务错误和证据不足分开 |
| 生成失败（generation failure） | generation 调用报错，或在输入与 Prompt 足以支持正确行为时仍产生错误输出 | 网络/API 失败与答案质量错误都在 generation 阶段，但后续归因仍要分开记录 |
| 语料证据缺口（corpus evidence gap，四阶段前置问题） | 目标问题所需证据不在冻结 corpus 中 | 不是 retrieval miss；retriever 无法取回不存在的内容 |
| 评测流程失败（evaluation pipeline failure，四阶段之外） | response 本身可能正确，但 parser、registry lookup 或 scorer 实现/配置错误 | 不能把 evaluator 的 bug 记成模型或 retrieval 失败 |

D1 只要求先能识别这些阶段，D3 接通 retrieval 与 generation 后再结合真实链路深入讲解和归因。

### 2.3 术语讲解完成记录

> 9/7 执行时填写。未解释或仍不清楚的术语写明下一步，不用“已了解”概括全部内容。

| 概念组 | 本人当前理解或问题 | 讲解后状态 |
|---|---|---|
| 资料与版本 | 本人能区分 corpus 的逻辑范围与 snapshot 的固定实验输入；追问 manifest/eval、retrieval 和 BM25 top-k chunks，并修正“冻结导致无 retrieval”为“全量输入不筛选子集” | A 组已完成；BM25 实现与 k 的选择留到 D2 |
| 模型输入容量 | 本人能区分 context window 与 context budget；追问 prompt cache、usage 计量关系、provider 可迁移性、thinking 与 compaction，并冻结 `deepseek-v4-flash + non-thinking` | B 组术语、模式决策与 raw corpus-only estimate 已完成；最终 assembled-input budget 移至 §4.6 后按实际对象冻结 |
| 评测与对照 | 本人将 eval 类比测试用例，理解 AI 输出允许多种有效表达；追问为何 RAG/AI 工程需要测试、运维和持续开发理念 | 本人确认表述校准并要求进入下一步；C 组术语门禁通过，具体 eval 尚未设计 |
| 回答约束 | 本人已冻结 answered/abstained 分支、atomic claim、claim-level citations、10 条 claim 上限和拒答原因形状 | D 组基础契约已完成；具体 schema、reason code 与 identifier 格式待冻结 |
| 失败所在阶段 | 本人理解测试失败需要总结 failure 原因；已用同一规则查询贯穿 corpus、retrieval、assembly、Prompt、generation 与 evaluator | 本人确认表述校准并要求进入下一步；E 组术语门禁通过，根因仍须由分层证据支持 |

#### 2.3.1 已确认的术语与机制

| 主题 | 当前结论 | 不能由此推出 |
|---|---|---|
| corpus / corpus snapshot / manifest | corpus 是本次纳入的七份规则文档；snapshot 绑定来源 commit 和文件内容；manifest 记录来源路径、快照路径、字节数、hash 与 Git blob，供完整性校验 | 文件名清单本身不能证明内容已冻结；snapshot 也不能证明语料足以回答所有问题 |
| retrieval | retrieval 是根据 query 从 corpus 选择相关 chunks 的阶段；BM25 与 dense 都有 retrieval | full-context baseline 不筛选子集，因此没有 retrieval；原因不是 corpus 已冻结 |
| query / chunk | query 是检索与回答使用的问题输入；chunk 是带来源定位信息的检索单元 | chunk 不是固定长度的文件片段同义词，具体切分策略留到 D2 |
| BM25 top-k chunks | BM25 按词项匹配相关性给 chunks 排序，top-k 是取得分最高的 k 个 chunks | 分数不是正确概率；k 过小会漏证据，过大会引入无关内容并占用上下文 |
| dense retrieval / embedding | embedding model 把 query 和 chunks 转成 dense vectors，通过向量相似度排序 chunks | embedding 不是答案，也不能证明 source span 支持 claim；模型、前缀、归一化和截断留到 D4 实测 |
| context window / context budget | context window 是单次请求中 input 与 generation 共同受限的 token 容量；context budget 是实验为 corpus 或 retrieved context 分配的容量 | 输入增大时变化的是占用和剩余容量，不是同一冻结模型条件下的窗口上限 |
| token / tokenizer / usage | tokenizer 把文本编码为 token；provider usage 是一次真实 API 请求的输入、输出和总 token 统计 | raw corpus-only estimate、assembled input estimate 和真实 usage 是不同计量对象，不能互相替代 |
| prompt cache | cache hit/miss 表示本次输入中复用或新处理的 token；命中 token 仍在 prompt_tokens 和 context window 中，generation 仍重新执行 | Web 静态资源缓存只能作有限类比；不能只凭延迟推断命中 |
| generation / thinking | generation 是模型依据 instructions、query 与 context 产生 answer、citations 或 abstention；thinking 会影响 generation 与端到端结果 | thinking 不会改变 retrieval 命中；本周把它固定为 controlled variable |
| compaction | compaction 是 Codex、Cline 等 harness 对会话历史进行摘要或裁剪的上下文管理行为 | 它不是 prompt cache，也不能只凭提示频率判断底层模型 context window 大小 |
| serialization / citation | serialized corpus 是把文档、citation labels、filenames 和 delimiters 组装成可发送文本；模型返回受控 citation identifier，本地 registry 将其映射到冻结 document identity 与 source span | registry 查表成功只证明标识指向真实位置，不能证明该位置支持 claim |
| eval | evaluation item 是运行前冻结的单题定义；per-item response 是模型输出；evaluation record 保存 expected、actual 与检查结果；metric、threshold 和 passing criteria 分别负责量化、分界和最终验收 | RAG 没有跨系统唯一 response schema；JSON 合法也不等于 schema 与语义正确 |
| failure attribution | corpus evidence gap、retrieval miss、context assembly failure、prompt failure、generation failure 和 evaluation pipeline failure 必须根据各阶段证据区分 | 最终回答正确或错误都不能单独证明根因；full-context baseline 的 retrieval 项为不适用 |

术语外部依据保留为：
[DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)、
[DeepSeek Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage/)、
[DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)、
[DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)、
[Google Research 的 full-context 用法](https://research.google/blog/chain-of-agents-large-language-models-collaborating-on-long-context-tasks/)和
[EMNLP 2024 的 long-context 对照](https://aclanthology.org/anthology-files/anthology-files/pdf/emnlp/2024.emnlp-industry.66.pdf)。
“全语料上下文基线”是本实验的描述性中文名称，可对应 full-corpus context baseline，不声明为统一行业术语。

#### 2.3.2 本人理解中的关键修正

| 原判断或疑问 | 修正后的结论 |
|---|---|
| snapshot 主要用于控制变量 | 方向正确；还必须在第一道 eval 题之前冻结，避免根据题目补语料造成选择偏差 |
| full-context 没有 retrieval 是因为 corpus 已冻结 | 原因是它不筛选子集，直接发送完整 serialized corpus；BM25/dense 同样使用冻结 corpus |
| BM25 请求 usage 应包含完整 corpus | 只有实际发送的 instructions、query 和 top-k chunks 等进入该请求 usage；本地未入选 corpus 不进入模型窗口 |
| 完整 corpus 和 top-k chunks 都占 BM25 请求窗口 | 只有实际组装发送的 top-k chunks 占该次 generation 请求窗口；完整 corpus 只整体进入 full-context 请求 |
| 离线 tokenizer 可以得到线上精确 token 数 | 未验证 tokenizer 版本、特殊 token 和 prompt rendering 与线上完全一致，因此记为 estimate |
| 七份文档应分别加入对话 special tokens | raw corpus-only 计量排除 special tokens；文件边界由可见 labels/filenames/delimiters 表达，消息包装属于 assembled input |
| query 变化会使 context window 变化 | 变化的是 input occupancy 与 remaining capacity；窗口上限在冻结模型条件下不变 |
| 模型最大输出是理想回答长度 | 它是 capability limit；本实验的 reserved output/max_tokens 是容量预留与公平对照上限，回答可以提前结束 |
| registry 可以判断引用是否支持 claim | registry 只确定性解析 identifier；citation correctness 还要核对 source span 内容与 claim 的关系 |
| unknown citation identifier 只有模型编造或本地文件缺失两种原因 | 直接事实是 citation resolution failure；根因还可能是 serialization、registry、snapshot 或 parser 不一致 |
| claim 正确即可放行 missing citation | answered claim 缺少必要 citation 时 item 必须失败，且不能被其它汇总分数抵消 |
| 同一 claim 只能有一个正确 source span | 多个来源若能独立完整支持同一 claim，应允许任意一个；必须联合多处才能成立时才使用全部必要证据 |

#### 2.3.3 已冻结的实验决定与实测事实

- snapshot 以 c0a4b85c9065cbfb943584c914172d7819339791 为来源基线，只含七份规则文档，并显式记录
  `repository-content-v1` normalization；7 个文件共 76,243 bytes。manifest 汇总与当前内容的逐文件
  字节/SHA-256/Git blob 校验均通过。
- DeepSeek 官方离线 tokenizer 示例采用 transformers 4.57.6 与 tokenizers 0.22.2；7/7 文档回环通过，
  raw corpus-only 为 18,697 estimated tokens。5.16.1/0.23.2 的 3,800 token 结果因中文和空格回环失败而拒绝。
- generation 配置冻结为 deepseek-v4-flash、Chat Completions、thinking disabled；full-context、BM25 和
  dense 保持一致。客户端仍需在 baseline 前验证确实发送 thinking disabled。
- 三条路径共同使用 reserved output/max_tokens 4096；安全余量固定 100,000 tokens。instructions、query 和
  message/rendering overhead 的共同上限等实际 Prompt 与 schema 形成后再计量冻结。
- response 使用 answered/abstained 两个互斥分支。answered 最多 10 条 atomic claims，每条关联 citation
  identifiers，不要求模型生成证据说明；abstained 返回受控 reason code 与简短 reason text。
- citation precision 通过阈值为 1.0。answered claim 零 citation 时 precision 记为无法计算，同时触发
  missing citation 必须失败；claim correctness 与 citation precision 分开记录。
- dev 与 holdout 物理隔离并共享 schema。实现、Prompt、retrieval 配置、eval 版本和评分规则全部冻结前不得
  运行 holdout；9/8 容量修订后，首次运行不排入 W13 当前日程。
- dev 与 holdout 使用不同 query，但覆盖相同行为类型。冻结 corpus 能支持直接可回答、跨文档、近似表述、
  优先级/冲突/例外和无答案五类；每类在两个 split 各 2 题，总计 20 题。
- 优先级/冲突/例外类已有来源依据：LEARNING-PROTOCOL.md §6 的正文/清单证据优先级、
  DAILY-LEARNING-REPORT-PROTOCOL.md §2 的用户指定范围优先级，以及 SHOWCASE-DEPLOY-PROTOCOL.md
  §3/§4 的一般规则、8081 例外和 Pages 边界。
- 9/7 后对当前协议的一般更新不会自动回填 snapshot；9/8 仅按仓库内容边界执行并记录
  `repository-content-v1` normalization，其它工作树变化仍不属于 `rules-c0a4b85`。
- demo 只使用题集中预先冻结的少量案例，不反向限制 eval 规模。本人负责题目的 query、预期分支、规则结论和
  证据位置思路；AI 在语义确认后负责 JSON、schema 排版、identifier、source span 定位和 hash 等机械工作。
- “直接可回答”类 `dev-1` 的题意已由本人冻结：query 为“JWT 签发与验证流程的最高援助级别是什么？”，
  预期分支为 `answered`，预期规则结论为“JWT 签发与验证流程的最高援助级别是 L2”。来源思路指向
  `rules-c0a4b85` 中 `AGENTS.md` 的“黑名单”标题及 W4 认证鉴权条目；正式 ID、source span identifier、
  eval schema 和 hash 尚未创建。

#### 2.3.4 尚未完成与下一入口

- 20 条 evaluation items 中仅 `dev-1` 的 query、预期分支、规则结论和来源思路已冻结；其余 19 条题意、
  全部 item 的正式结构与版本尚未冻结。
- metric、其余 threshold、passing criteria、reason code 枚举、citation identifier 格式和 source span 粒度尚未冻结。
- RAG Prompt、response schema 与 corpus serialization 尚未建立，因此最终 context budget 仍不能计算。
- 教学示例已经说明 evaluation item 解决什么问题以及各字段如何配合；D2 从“直接可回答”类剩余 3 题继续，
  后续仍按一个行为类型一批四题提交正式题意。JSON 录入和代码实现不是这一阶段的学习主线。

#### 2.3.5 Evaluation item 教学示例（明确不进入正式题集）

示例 query 为“在本仓库中，AI 是否可以直接实现 Docker/docker-compose 配置？”。预期分支是 answered；
预期规则结论是 Docker/docker-compose 配置属于白名单，AI 可以直接实现；来源思路是冻结 AGENTS.md §2
“白名单：可由 AI 直接实现”中的对应条目。后续由 registry 为该 source span 分配实际 citation identifier。

该 item 用来检查三条路径面对同一 query 时，是否进入 answered 分支、给出符合冻结规则的 claim，并引用实际
支持该 claim 的 source span。full-context 直接看到完整 corpus；BM25/dense 必须先取回包含该规则的 chunk。
因此同一道题可以分别暴露 retrieval、context assembly、generation 或 citation 评测问题。

本人提出的“直接提供代码是黑名单还是白名单？”可以作为 query，但不适合当前“直接可回答”类的首批题：
黑白名单分类的是具体任务内容，不是“提供代码”这个动作。该问法会同时触发白名单、黑名单、未列出项默认处理
和援助等级，预期答案需要多个条件，不利于定位单一失败。正式题目应先指定待判断的具体任务，再冻结对应规则
结论和来源思路。该 Docker 示例只用于讲解，不计入 20 题，也不能改 ID 后进入 dev 或 holdout。

### 2.4 9/7 协作问题与执行修正

| 暴露的问题 | 性质判断 | 执行修正与落点 |
|---|---|---|
| 本地称谓在未说明性质和边界前进入提问 | 已有规范未遵守，不是缺少术语规则 | 继续执行 `AGENTS.md` §4 与 `TECHNICAL-WRITING-PROTOCOL.md` §3.6；本笔记保留违规事实，不重复发明规则 |
| 基于本人追问临时增加巩固题，偏离 D1 原定顺序 | 本周引导流程缺少明确回归规则 | `week13-plan.md` §9 规定计划外练习需先标明并确认，补充讲解后回到最近未完成项 |
| 在 eval、Prompt 和 serialization 尚未形成时要求冻结依赖它们的输入预算 | D1 执行顺序错误 | §4.4 只冻结 raw token 事实；最终计量和容量门禁移动到 §4.6 |
| `LEARNING-STATE.md` 累计完整问答和历史执行记录 | 通用状态恢复职责偏离 | `LEARNING-PROTOCOL.md` §5 改为替换失效状态，只保留当前入口、有效风险和活动债务；状态文件本轮同步压缩 |
| D1 笔记按 73 次问答持续追加，达到 1000 行 | 通用学习记录与技术文案职责偏离 | 将 §2.3 合并为术语机制、关键纠错、冻结事实和未完成入口；`LEARNING-PROTOCOL.md` §4 与 `TECHNICAL-WRITING-PROTOCOL.md` §4 禁止把每日笔记写成聊天流水账 |
| 在未展示完整 evaluation item 前要求本人直接设计 20 题 | 引导顺序缺少任务形状 | `AGENTS.md` §4 与本周计划规定：先给一个不进入正式题集的完整示例，再由本人冻结正式题目语义；机械 JSON 不作为学习主线 |
| 当前协作规范在 snapshot 冻结后发生变化 | 正常的版本边界，不是 snapshot 缺陷 | 新规则只约束后续协作，不回填 `rules-c0a4b85`；正式 eval 仍只以冻结版本中的内容为证据 |

## 3. D1 输入与所有权

### 3.1 规则文档语料的七份文件

- `AGENTS.md`
- `TECHNICAL-WRITING-PROTOCOL.md`
- `SHOWCASE-VISUAL-PROTOCOL.md`
- `DAILY-SPEAKING-PROTOCOL.md`
- `SHOWCASE-DEPLOY-PROTOCOL.md`
- `LEARNING-PROTOCOL.md`
- `DAILY-LEARNING-REPORT-PROTOCOL.md`

### 3.2 仓库 Markdown 扩展语料已继承的排除类别

- 快照目录自身。
- 题库、答案和评测结果。
- W13 起的进行中笔记。
- allowlist 外的所有仓库路径与外部输入。
- 密钥、真实凭据、可定位端点和本地绝对路径。

### 3.3 本人必须冻结但本计划不预填

| 决策 | D1 记录 |
|---|---|
| 规则文档语料的 source commit 与 snapshot 边界 | `c0a4b85c9065cbfb943584c914172d7819339791`；只含 §3.1 七份文件 |
| 目标 generation 配置 | `deepseek-v4-flash`；Chat Completions；`thinking: disabled`（non-thinking）；full-context、BM25、dense 保持一致 |
| reserved output / `max_tokens` | 4096；三条对照共同使用；是输出上限与容量预留，不要求实际生成到上限 |
| safety margin | 固定 100,000 tokens；选择依据是当前 1M context window 的 10%，未来窗口变化时不自动重算 |
| instructions/query/rendering 预算方式 | 三项共用一个 token 总上限做容量门禁，同时分别记录各项估算值和真实运行证据；合并上限数值待冻结 |
| corpus-only token 估算方法 | DeepSeek 官方离线 tokenizer 示例为主；官方字符比例只作粗粒度交叉检查；结果标为 estimate |
| citation granularity 原则 | claim-level citations；每条 claim 显式关联支持它的来源；具体 schema 与 source span 粒度待冻结 |
| 正常回答中的证据说明 | 不要求模型生成；answered 分支保留 claim 与 citation identifiers，权威 source span 由本地 registry 解析并在响应之外用于核验 |
| claim 文本原则 | 每条只表达一个可独立核验的结论，可保留必要条件、例外和适用范围；不机械限制为一句，不含第二个独立结论、证据说明或原文摘录 |
| 单题 claim 数上限 | answered 分支最多 10 条；预计超出时在 eval 设计阶段预先拆成多个独立 items，不做运行时分页或多次续写 |
| 拒答响应内容 | 必须明确标记 abstained，并返回受控 reason code 与简短 reason text；二者只描述当前证据不足，不由模型自判系统根因；具体 code 枚举待冻结 |
| 是否启动仓库 Markdown 扩展语料；若启动，其独立版本与边界文件 | 待本人填写 |
| dev/holdout 的隔离方式 | 物理隔离：使用不同文件或目录，共享同一 eval schema；D1-D4 常规入口只读取 dev |
| evaluation item 最小信息 | 稳定题目 ID、完整 query、预期行为及证据要求；comparison method 和运行时间不写入 item |
| 预期响应分支 label | 受控枚举，只允许 `answered`、`abstained`；用于确定性解析和选择分支判据 |
| citation precision threshold | `1.0`；每条返回 citation 都必须满足解析、实际进入 context 和支持对应 claim 三项条件 |
| answered claim 零 citation | precision 记录为无法计算，并单独判定缺少必要 citation；不把 `0/0` 改写为数值 |
| missing citation passing criterion | answered item 缺少必要 citation 时整个 item 必须失败；其它分数不能抵消 |
| dev/holdout 行为覆盖 | 使用不同 query，但覆盖冻结 corpus 实际支持的相同行为类型；不制造无证据的题型 |
| eval 规模 | 五类均有冻结 corpus 依据；每类在 dev/holdout 各 2 个非等价 items，共 20 题（dev 10、holdout 10） |
| eval 题目、标签、指标、阈值和通过标准 | 待本人填写 |
| 为其它输入保留多少 token、由此得到的 context budget，以及规则文档语料是否可完整容纳 | 待本人填写 |
| RAG Prompt 内容及 grounding/citation/abstention 的正确性要求 | 待本人填写 |
| 如何根据冻结结果判断当前任务是否需要 RAG | 待本人填写 |

## 4. 执行顺序

### 4.1 恢复状态并确认 snapshot 来源

- [x] AI 先完成仓库状态恢复；这是执行前检查，未向本人提出 RAG 设计问题。
- [x] 读取 `AGENTS.md`、`LEARNING-PROTOCOL.md`、`LEARNING-STATE.md`、周计划和本文件。
- [x] 查看 `git status --short` 与实际 HEAD；开工时工作树干净，HEAD 为 `c0a4b85`。
- [x] 本人确认 snapshot 使用 source commit `c0a4b85c9065cbfb943584c914172d7819339791`。
- [x] snapshot 使用七文件显式 allowlist；未读取或写入 `.env`，强特征密钥、私钥、带凭据 MongoDB URI
  和邮箱扫描无命中。

**前置条件**：source commit 和工作树边界未确认，不创建语料快照。

### 4.2 看懂 D1 链路并完成第一组术语

- [x] 本人当天先看懂 §0 链路；AI 已解释全语料上下文、BM25、dense、retrieval、context window、
  generation、chunk、query 与 embedding 的概览，深入内容仍按对应 Day 展开。
- [x] 完成 §2.2 A 组“资料与版本”的讲解。
- [x] 本人追问 manifest、eval 与 dense 中间链路；AI 逐项解释并修正“冻结导致无 retrieval”的因果。
- [x] 本人能区分 corpus 与 snapshot，并能说明 snapshot 先于 eval 是为固定变量、避免按题补语料。

**门禁**：白话链路与 A 组未讲清，不执行 snapshot；后续各组仍按首次使用门禁讲解。

### 4.3 冻结语料快照

- [x] 本人确认规则文档语料的七份文件与 source commit `c0a4b85c9065cbfb943584c914172d7819339791`。
- [x] 从 source commit 的 Git object 生成 [`rules-c0a4b85`](../corpus/rules-c0a4b85/manifest.json)
  独立快照；使用显式 allowlist，未从快照目录递归收集。
- [x] manifest 已记录 source commit 基线、normalization、原始路径、快照路径、字节、SHA-256 与 Git blob。
- [x] normalization 后实测 7 个文件，共 76,243 bytes；未沿用 W12 历史体积。
- [x] 精确 allowlist 从范围上排除了题库/答案、W13 进行中笔记、其它仓库路径和外部输入；
  可定位值与凭据模式扫描无命中。

**顺序硬线**：本节完成前不得创建第一道 eval 题。

### 4.4 运行 raw corpus token 计量并记录容量前置事实

- [x] 执行前完成 §2.2 B 组讲解，能区分 byte、token、估算值、provider usage、context window 与
  本人分配的 context budget。
- [x] 查证并记录目标生成模型与 context window 的来源；它是外部事实，不由本人自行设定。
      （2026-09-10 补充：本条执行时来源未落盘；现记录为官方 Models & Pricing 的 `CONTEXT LENGTH 1M`
      与 `MAX OUTPUT MAXIMUM: 384K`（检索 2026-09-10），见 D4 笔记 §6.3。）
- [x] 本人冻结 `deepseek-v4-flash + non-thinking`；当前客户端显式发送 `thinking: disabled` 的接线与验证待完成，
  未完成前不运行 baseline。
- [x] DeepSeek 提供官方离线 tokenizer 示例，并要求以 API `usage` 为实际处理量依据；因尚未验证该示例与
  线上 prompt 渲染完全一致，本实验将离线结果保守记录为 estimate，不写成线上精确 token count。
- [x] 本人冻结以官方离线 tokenizer 示例为主估算方法、官方字符比例只作粗粒度交叉检查；来源 URL、获取
  日期、下载文件 SHA-256、执行结果与依赖/运行版本均已记录；真实请求后另存 provider `usage` 运行证据。
- [x] 规则文档语料 raw corpus-only estimate 为 18,697 tokens；逐文件结果和兼容性验证已独立保存，没有混入
  历史字节数或尚未启动的仓库 Markdown 扩展语料。
- [x] 本人已冻结三条路径共同使用 `reserved output / max_tokens = 4096`，并冻结固定 safety margin
  `100000` tokens。
- [x] instructions、query 与 message/rendering overhead 的上限及最终 context budget 依赖实际 eval/Prompt；
  不在对象形成前猜数，最终计量与完整容纳判断移动到 §4.6 末尾。

**阶段边界**：本节完成 raw corpus 与容量前置事实，不据此提前宣布完整 prompt 可容纳；§4.6 的最终容量门禁
未通过时，不运行全语料上下文 baseline。

### 4.5 本人冻结 eval 契约

- [x] 设计前完成 §2.2 C/E 组讲解，能区分 label、metric、threshold、passing criteria 与四个失败阶段；本人
  已确认表述校准并进入下一步，不据此宣称完整掌握。
- [ ] 只基于已冻结 snapshot 建立题目，不反向改动 corpus 迎合题目。
- [x] 本人冻结 dev/holdout 物理隔离；holdout 保留冻结版本，在实现与全部相关契约冻结前不运行、不查看且
  不用于选择或调参；9/8 修订后首次运行不排入 W13 当前日程。
- [x] 本人冻结 evaluation item 的最小功能信息：稳定 ID、完整 query、预期行为及证据要求。
- [x] 本人冻结五类行为在 dev/holdout 各 2 题，共 20 题；讲解示例不计入题集。
- [ ] 本人填写题目、标签、指标、阈值与通过标准；AI 不提供候选答案或核心断言。
- [ ] 每个判据说明如何从输出或来源中观察，不用“看起来不错”作为通过条件。
- [ ] 记录哪些失败属于 retrieval、context assembly、prompt 或 generation；D1 baseline 没有 retrieval，
  因此不得把其失败记成 retrieval miss。

### 4.6 本人冻结 W13 RAG Prompt

- [ ] 设计前完成 §2.2 D 组讲解，能说明 RAG Prompt 相比 W12 信息提取 Prompt 增加了什么职责。
- [ ] 新建独立版本，不覆盖或改称 W12 的用户注册信息提取 `prompt v0`。
- [ ] 本人写明 instructions、query、context 与 output 之间的边界。
- [ ] 本人定义 grounding、citation 和 abstention 的正确性要求。
- [ ] 关联适用模型、corpus snapshot、eval 版本与变更理由。
- [ ] 使用冻结 Prompt、response schema、corpus serialization 与 dev queries 计量实际 instructions、各 query、
  citation labels/delimiters 和可复现的 message/rendering overhead estimate；不把 raw corpus-only 与完整输入混写。
- [ ] 本人据实冻结 instructions、query 与 message/rendering overhead 共用的 token 上限，计算最终 corpus
  context budget，并判断完整 serialized corpus 是否可容纳；超限时不静默截断或仍称 full-context。

**运行门禁**：上述实际输入计量、最终 context budget 与完整容纳结论未记录，不进入 §4.7。

### 4.7 完成全语料上下文基线评测

- [ ] 规则文档语料可完整容纳时，只运行冻结 dev set，不运行或查看 holdout 结果；实际输入必须是完整规则文档语料。
- [ ] 保留每题输入、原始输出、解析/判分结果、延迟、token 使用与模型/Prompt 版本。
- [ ] 逐题记录观察，不用汇总分数掩盖 citation、abstention 或证据边界错误。
- [ ] 固定运行入口、配置和证据位置，使后续能够重跑；D1 不以额外重复整套随机 generation 来冒充
  输出必然一致，真正的重复运行与 demo 稳定性在 D3-D4 验证。
- [ ] 规则文档语料不可完整容纳时，不运行裁剪后的全语料上下文基线；保留 context window 来源、预算决定、token 计量与
  超限差额，本节以“容量不可行”收口。

### 4.8 写出 RAG 必要性边界

- [ ] 写明全语料上下文基线结果支持的结论。
- [ ] 写明它不能支持的结论，包括未覆盖的 corpus、题型、成本或运行条件。
- [ ] 若全语料上下文基线达到本人门槛，后续 BM25/dense 仍作为教学对照，不声称当前场景生产上必须使用 RAG。
- [ ] 若全语料上下文基线未达到门槛，只能说明该冻结条件下基线未达标，不能提前断言 RAG 一定解决问题。

### 4.9 附加项：仓库 Markdown 扩展语料独立快照

仅当 §4.1-§4.8 全部完成后执行：

- [ ] 本人决定是否启动仓库 Markdown 扩展语料；未启动就记录“候选扩展，未验证”。
- [ ] 若启动，先确认纳入/排除边界，再建立与规则文档语料分开的 snapshot 与 manifest。
- [ ] 在建立任何依赖仓库 Markdown 扩展语料的 eval 前完成冻结，并单独记录文件数、字节数、token 方法与结果。
- [ ] 若当天未形成完整版本，记录为“不进入 W13 必做对照”，不把半成品并入规则文档语料，也不顺延到 D2-D5。

## 5. 证据记录区

> 9/7 按实际结果填写。没有运行的项标为待验证，不预填成功。

| 对象 | 版本或输入 | 原始证据位置 | 观察 | 结论与边界 |
|---|---|---|---|---|
| source commit / snapshot | `c0a4b85c9065cbfb943584c914172d7819339791` / `rules-c0a4b85` / `repository-content-v1` | `week13-rag/corpus/rules-c0a4b85/manifest.json` | 7 文件，76,243 bytes；来源 commit 作为基线；normalization 不移动既有正文行号；manifest 当前内容完整性验证通过 | 规则文档语料 snapshot 已冻结；不能据此推出 token 数、上下文可容纳性或回答质量 |
| generation 配置 | `deepseek-v4-flash` / Chat Completions / non-thinking | 本文件 §2.3.2、§3.3；实际请求证据待生成 | 本人已冻结请求配置；当前客户端尚未显式发送 `thinking: disabled` | 冻结 model ID 不等于冻结服务端权重；接线验证和运行时 model/`system_fingerprint` 记录仍待完成 |
| token 计量方法 / token count | DeepSeek 官方离线 tokenizer 示例；字符比例仅作粗粒度交叉检查 | [`token-count-rules-c0a4b85.json`](../evidence/token-count-rules-c0a4b85.json)；[DeepSeek Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage/) | `transformers 4.57.6 / tokenizers 0.22.2` 下 7/7 回环通过；raw corpus-only = 18,697 estimated tokens；5.16.1 兼容性失败结果已拒绝 | 排除特殊 token 与 prompt/context assembly；不能用包内 `model_max_length` 替代模型窗口来源，也不能替代完整请求的 provider `usage` |
| eval / dev-holdout | 物理隔离；共享 schema；`dev-1` 题意已确认，其余待填写 | 文件与冻结证据待创建 | 隔离方式已冻结；1/20 题意已确认，正式 eval 尚未创建 | 首次运行不排入 W13 当前日程；前置契约与实现全部冻结后才能运行 |
| RAG Prompt | 待填写 | 待填写 | 待填写 | 待填写 |
| 全语料上下文基线评测 | 待填写 | 待填写 | 待填写 | 待填写 |
| 仓库 Markdown 扩展语料 | 待启动、完成或明确不进入主线 | 待填写 | 待填写 | 待填写 |

> 更正（2026-09-10，D4 实测发现）：本行原声明来源 URL、依赖与运行版本「均已记录」，据此可复现。D4 重建
> tokenizer 运行时时发现记录的 `pipFreeze` 含 `filelock==3.32.5`，该版本在 PyPI 不可解析，因此**无法按记录
> 逐包复现**；等价性改由复现本行的逐文件 token 数（4174/2032/649/3076/2994/3086/2686 = 18,697）证明。
> 同时 context window 的外部来源当时未落盘，现记录为官方 `CONTEXT LENGTH 1M`（检索 2026-09-10）。
> 详见 [`day4-full-context-baseline-and-bm25.md`](./day4-full-context-baseline-and-bm25.md) §6.3 与 §6.7。

## 6. 当时的自动顺延规则（历史计划）

- 术语仍不清楚：停在对应概念组继续讲解，不用猜测换取后续清单进度。
- snapshot 未冻结：D2 第一入口继续 snapshot，BM25 不开始。
- 上下文容量未确认：不运行全语料上下文基线，不用历史字节数替代。
- eval 或 RAG Prompt 未由本人冻结：不运行 baseline，AI 不代填以推进进度。
- D4 实现、Prompt、retrieval 配置、eval 版本或评分规则未全部冻结：不运行 holdout；D5 不补首次运行。
- 全语料上下文基线评测没有实际 baseline 或完整的容量不可行证据：D2 第一入口先完成该评测；删除 D2 的
  变量对照，不叠加原任务。
- 仓库 Markdown 扩展语料未启动或未形成完整版本：不进入 W13 必做对照，也不顺延占用 D2-D5；以后重启时建立并标明独立版本。

## 7. D1 明确不做

- 不实现 BM25、dense retrieval、chunking、ranking 或 context assembly。
- 不安装 ONNX Runtime、embedding 模型或提前验证 dense runtime；9/8 容量调整后，dense 不再进入 W13
  当前日程，按未执行或未验证收口。
- 不运行 holdout，不查看 holdout 运行结果，不根据 holdout 选择方案或调参。
- 不实现 hybrid/RRF、reranker、向量数据库或 GraphRAG。
- 不开始 W14 Agent、tool contract、loop、trace、verifier、MCP 或 session memory。
- 不新增 UI、展示板、Docker/CI 或部署。
- 不为追求完成数量跳过术语解释、本人冻结或证据记录。
- 不自动 commit、push 或 merge。

## 8. D1 收尾清单

> 2026-09-07 已收工。勾选表示该项已完成，未勾选项在同一行记录实际结果与去向。

- [ ] 五组术语未全部完成：corpus/snapshot、token/容量、eval/citation 与失败阶段等前置讲解已完成；
  RAG Prompt 的 D 组完整形状讲解进入 eval 契约通过后的下一阶段，且必须发生在本人设计前。
- [x] source commit 与开工时工作树边界已确认；snapshot、现行模型 ID 修正与此前笔记记录已提交于
  `255357d`，本轮 prompt cache 追问回填尚未提交。该提交未运行全语料上下文 baseline。
- [x] 规则文档语料 snapshot 在第一道 eval 题之前冻结；当前 manifest、normalization 与逐文件完整性校验有证据。
- [ ] token 计量方法与不确定性已记录，raw corpus-only estimate 与 provider usage 未混写；最终 context
  budget 依赖 Prompt/schema/serialization，尚未形成，进入 eval 契约通过后的下一阶段。
- [ ] eval 未冻结：20 条中仅 `dev-1` 题意已确认；其余题意、schema、指标、阈值和通过标准进入
  D2 唯一完成对象。holdout 未运行、未查看。
- [ ] W13 RAG Prompt 尚未建立；进入 D3 目标，但仅在 eval 契约通过后开始。
- [ ] 全语料上下文基线评测未运行，也未形成容量不可行证据；进入 D3 目标，但仅在 eval 契约通过后开始。
- [ ] RAG 必要性结论尚无 baseline 证据；随全语料上下文基线阶段完成。
- [x] 仓库 Markdown 扩展语料未启动，不进入 W13 必做对照，也不顺延占用 D2-D5。
- [x] 当天事实、决定、待验证项和未完成去向已分开记录；D1 判定为未完成。
- [x] `week13-plan.md` 与 `LEARNING-STATE.md` 已按实际结果更新；新增 D2 工作表，是否 commit 由本人决定。

## 9. AI 辅助记录

> 9/7：AI 以导师模式完成 D1 链路、术语与 evaluation item 形状讲解；本人复述 corpus/snapshot、冻结顺序与
> 全语料上下文基线不含 retrieval 的原因。本人确认七文件范围与 source commit 后，AI 以白名单机械处理
> snapshot、manifest 与 token 证据。`dev-1` 的对象、判断维度和预期结论由本人提出，AI 核对冻结来源并
> 整理为当前记录；未代写其余 eval、RAG Prompt、context budget、检索方案或核心断言。未提供黑名单 L2，
> 不新增债务。

## 10. 9/7 收口与 9/8 容量修订

> 后续结果（2026-09-11 补充）：以下“dense 与首次 holdout 不排入本周”属于 9/8 的一次历史调整，随后被
> 同日框架范围修订取代；D4 已实际完成 dense 对照、首次 holdout 与 BM25 端到端运行。详见
> [`day4-full-context-baseline-and-bm25.md`](./day4-full-context-baseline-and-bm25.md) §6.17–§6.21。
> D5 的当前目标与顺序以新日计划为准，历史入口不再作为待办。

- **已完成事实**：规则文档语料 snapshot、manifest、来源基线、normalization、逐文件完整性校验、raw corpus-only token
  estimate 与主要前置术语讲解已完成；`dev-1` 题意已由本人确认。
- **未完成事实**：eval 仅完成 1/20 题意，RAG Prompt/response schema、serialization、最终 context budget、
  全语料上下文 baseline 与 RAG 必要性结论均未形成。
- **9/7 收口时决定**：D2 原本承接 eval、Prompt、容量和 baseline，不叠加 BM25。
- **9/8 容量修订**：上述单日对象仍包含多条依赖工作流，不能真实反映精力和对话等待成本。D2 现只冻结
  eval 契约，执行工作表见 [`day2-freeze-eval-contract.md`](./day2-freeze-eval-contract.md)。D3 目标为
  RAG Prompt、response schema、serialization、容量和全语料上下文 baseline；D4 目标为 BM25 retrieval；
  D5 17:00 前按实际门禁继续主线并分享届时已验证的证据。dense 与首次 holdout 不排入本周当前日程。
- **展示边界**：D5 分享准备不替代主线学习；学习展板移为周末条件项，服务下一次 D1 展示与个人复习，
  不作为 W13 技术验收条件。
- **版本边界**：正式 eval 只引用 `rules-c0a4b85`；9/7 snapshot 冻结后的现行协作规范只约束后续协作。
- **收口前工作树**：`git status --short` 无输出；本次 D1 收口、D2 计划和状态同步为新的未提交文档改动。
- **下一入口**：9/8 先按 D2 §3 恢复状态，再从“直接可回答”类剩余 3 条题意继续；不新增复习题或
  计划外支线。
