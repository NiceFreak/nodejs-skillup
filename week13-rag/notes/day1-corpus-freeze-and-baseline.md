# W13 D1：冻结 corpus、eval 并完成全语料上下文基线评测（9/7）

> 建立：2026-09-06（Asia/Shanghai）。
>
> 状态：执行中。仓库状态恢复、A 组术语讲解与规则文档语料 snapshot 已完成；token 计量、eval、
> RAG Prompt 和全语料上下文基线评测尚未执行。
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
  [`rules-c0a4b85`](../corpus/rules-c0a4b85/manifest.json)：7 个文件，共 76,149 bytes。
  manifest 记录原始路径、快照路径、SHA-256 与 Git blob；七个文件均已逐字节回比 source commit。

### 1.2 待查证或待运行

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
| 留出集（holdout set） | 本人在 D1 创建并冻结、D2-D4 不运行且不用于选择方案或调参、D5 才首次运行的题集 | 本人知道自己写过的题目，不等于运行结果已见；D5 后它成为冻结回归集 |
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

D1 只要求先能识别这些阶段，D3 接通 retrieval 与 generation 后再结合真实链路深入讲解和归因。

### 2.3 术语讲解完成记录

> 9/7 执行时填写。未解释或仍不清楚的术语写明下一步，不用“已了解”概括全部内容。

| 概念组 | 本人当前理解或问题 | 讲解后状态 |
|---|---|---|
| 资料与版本 | 本人能区分 corpus 的逻辑范围与 snapshot 的固定实验输入；追问 manifest/eval、retrieval 和 BM25 top-k chunks，并修正“冻结导致无 retrieval”为“全量输入不筛选子集” | A 组已完成；eval 只讲了定义，完整 C 组仍待执行；BM25 实现与 k 的选择留到 D2 |
| 模型输入容量 | 本人能区分 context window 与 context budget；追问 prompt cache、usage 计量关系、provider 可迁移性、thinking 与 compaction，并冻结 `deepseek-v4-flash + non-thinking` | B 组术语、模式决策与 raw corpus-only estimate 已完成；最终 assembled-input budget 移至 §4.6 后按实际对象冻结 |
| 评测与对照 | 待本人填写 | 待执行 |
| 回答约束 | 待本人填写 | 待执行 |
| 失败所在阶段 | 待本人填写 | 待执行 |

#### 2.3.1 A 组讲解与追问记录

1. **本人初始理解**：corpus 是七份文档的逻辑集合；snapshot 进一步绑定到特定 commit，后续源文档更新
   不改变本次实验输入。该理解正确。
2. **manifest 追问**：manifest 是 snapshot 的结构化清单，不是新的 RAG 概念。本次 manifest 记录
   source commit、原始路径、快照路径、字节、SHA-256 与 Git blob；只有文件名列表不能证明内容已固定。
3. **eval 追问**：eval 是 evaluation，使用预先定义的输入和判据检查系统行为；“请求成功返回”不等于
   回答正确。label、metric、threshold 与 passing criteria 留在 C 组逐项讲解。
4. **snapshot 顺序修正**：本人先概括为“控制变量”，方向正确；进一步修正为 snapshot 必须先于第一道
   eval 题，避免看到题目后补入对应材料，使 corpus 对题目产生选择偏差并污染后续比较。
5. **retrieval 因果修正**：retrieval 是检索，不是解析。全语料上下文基线不含 retrieval 的原因是它不筛选
   子集，直接把完整 snapshot 组装进模型输入；不是因为 corpus 已冻结，BM25 与 dense 同样使用冻结输入。
6. **英文名称查证**：`全语料上下文基线` 是本计划对操作和完成条件的直接描述，不是唯一行业术语。
   Google Research 使用过 `full-context`，其他研究也使用 `long-context (LC)`；本计划可用
   `full-corpus context baseline` 作描述性英文，但不声明它是统一术语。来源：
   [Google Research](https://research.google/blog/chain-of-agents-large-language-models-collaborating-on-long-context-tasks/)、
   [EMNLP 2024](https://aclanthology.org/anthology-files/anthology-files/pdf/emnlp/2024.emnlp-industry.66.pdf)。
7. **跨 Day 术语追问**：query 是交给 retriever 的查询输入，最小实现中可以等于 user question；chunk 是
   带来源 metadata、能定位回 snapshot 的检索单元；embedding 是 embedding model 生成的 dense vector，
   用于相似度排序，不是答案或正确性证明；generation 是模型依据 instructions、query 与 context 生成
   answer、citation 或 abstention 的阶段。BM25 实现细节留到 D2，dense runtime 与向量计算留到 D4。
8. **`BM25 top-k chunks` 追问**：D2 会先把 snapshot 切成多个 chunks，并为它们建立 BM25 可检索索引。
   收到 query 后，BM25 给每个候选 chunk 一个词项匹配相关性分数，按分数从高到低排序；`top-k chunks`
   就是排序后取前 `k` 个 chunk。它不是前 `k` 个文件或 token，BM25 分数也不是正确概率。`k` 是待冻结的
   检索配置：太小可能漏掉证据，太大会带入更多无关内容并占用 context budget；具体取值由本人在 D2 根据
   冻结 dev set 的 retrieval evaluation 决定，本次只解释术语。

#### 2.3.2 B 组讲解与追问记录

1. **已讲解边界**：token 是模型处理文本的计量单位；tokenizer 把文本转换为 token 序列；usage 是真实
   API 请求返回的输入、输出与总 token 运行证据。corpus-only 离线计量、完整组装输入计量与 provider
   usage 是三个不同对象，不能混写。
2. **本人复述**：context window 是单次请求中输入与生成共同受限的总 token 容量；context budget 是本次
   实验从该窗口中分配给 corpus 或 retrieved context 的容量。该区分正确。
3. **经验判断修正**：本人根据使用经验判断“当前主流大模型的 context window 大多约为 1M”。该说法没有
   冻结“主流”的模型范围，也未逐项查证，不作为事实。D1 当前只记录目标模型的可核实参数：DeepSeek
   官方页面在 2026-09-07 将 `deepseek-v4-flash` 的 context length 标为 1M、最大输出标为 384K；
   具体实验仍需冻结模型 ID、模式、输出预留与安全余量。来源：
   [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)。
4. **现行配置修正**：W12 真实调用已经使用 `deepseek-v4-flash`，但复用客户端默认值与 `.env.example`
   仍写 `deepseek-chat`。DeepSeek 官方已说明旧名称退出；当前代码默认值已改为 `deepseek-v4-flash`。
   历史 D4 笔记继续保留“当时骨架默认 `deepseek-chat`”这一历史事实。修正后完整 pytest 为 30 passed、
   覆盖率 97.89%，`python -m mypy src` 对 9 个源文件检查通过。来源：
   [DeepSeek V4 发布说明](https://api-docs.deepseek.com/news/news260424/)。
5. **prompt cache 追问**：本人尝试类比 Web 静态资源缓存。两者都复用已有结果以减少重复处理，这是有限
   类比；DeepSeek context cache 的实际对象是已经持久化且匹配的输入 token 前缀，不是浏览器本地保存的
   静态资源，也不复用上一次生成答案。请求仍需发送完整输入，命中 token 仍占 `prompt_tokens` 与 context
   window；命中影响的是 provider 的重复计算、首 token 延迟和计费。`prompt_cache_hit_tokens` 是本次输入
   中命中缓存的 token 数，`prompt_cache_miss_tokens` 是未命中的 token 数，二者之和等于
   `prompt_tokens`。缓存由 provider 自动管理、尽力命中，输出仍重新生成。来源：
   [DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)、
   [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)。
6. **usage 与 corpus-only token count 修正**：本人判断 corpus-only token count 被 usage 包含且理论上更小，
   因而 usage 替代它会“不精确”。该判断只在完整 snapshot 确实进入某次全语料上下文请求时部分成立：该次
   `prompt_tokens` 还包含 instructions、query、分隔符和输出约束，`total_tokens` 进一步包含 generation。
   对 BM25/dense 请求，输入只包含 retrieved chunks，完整 corpus token count 并不包含在该次 usage 中。
   即使 full-context 请求的 usage 是精确运行证据，它也不能把 corpus 部分从完整序列中单独拆出；不同拼装
   边界还可能改变 tokenizer 的切分。因此不能替代的根因是计量对象与阶段不同，不只是数值不够精确。
7. **跨 provider/runtime 迁移性追问**：本人担心只 hands-on DeepSeek 会把单一厂商的说法误当成 AI/RAG
   工程。这里要分两层：retrieval、chunk、embedding、context assembly、generation、grounding、citation、
   abstention 与 eval 是可迁移的系统概念；模型 ID、tokenizer、窗口上限、请求/响应 schema、usage 字段、
   prompt cache 的命中条件与计费则属于 provider/model/runtime 具体契约。OpenAI、Anthropic 与 DeepSeek
   都提供 prompt cache 相关用量，但字段拆分并不相同；Ollama 也使用自己的输入、缓存输入和输出计数字段。
   另外，Ollama 是模型运行与服务工具（既可运行本地模型，也有云模型入口），不是模型；Qwen 是模型家族，
   可从本地路径加载，也不能一概称为“本地小模型”。W13 只把 DeepSeek 用作 generation provider；BM25 不依赖它，D4 的
   `multilingual-e5-small` + ONNX Runtime dense retrieval 也是独立本地链路。因此冻结一个 generation model
   是为了保持本次对照变量稳定，不是把 DeepSeek 文档当作 RAG 唯一标准。当前先用各家官方文档核对语义
   边界，不在 D1 扩张成多 provider 接入。来源：
   [DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)、
   [OpenAI Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)、
   [Anthropic Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)、
   [Ollama Usage](https://docs.ollama.com/api/usage)、
   [Ollama Context length](https://docs.ollama.com/context-length)、
   [Qwen Transformers](https://qwen.readthedocs.io/en/stable/inference/transformers.html)。
8. **BM25 与 generation 请求的阶段拆分**：在当前 W13 方案中，BM25 是本地 retrieval，不会调用生成模型，
   因此这一阶段没有 DeepSeek `usage`。更准确的链路是：完整 corpus 在本地经过 chunking 和 indexing；query
   交给 BM25 排序后只返回 top-k chunks；context assembly 再把 instructions、query、top-k chunks、来源
   metadata 和输出约束组成 prompt，只有这个 prompt 被发送到 generation API。模型服务只能统计这次实际收到
   的输入和生成的输出；未入选、未发送的 corpus 内容不在本次 `usage` 中。

   ```text
   完整 corpus -> 本地 chunking/indexing -> BM25(query) -> top-k chunks
                                                           |
   instructions + query + top-k chunks + 输出约束 ---------+-> generation API -> answer + usage
   ```

9. **为什么要对 token count 敏感**：各计数解决的问题不同，不能统一解释为“准确度”或“成本”。

   | 计量对象 | 主要功能 | 不能证明什么 |
   |---|---|---|
   | corpus-only token count | 请求前做容量规划，判断完整 snapshot 能否放入分给语料的 context budget | 不能证明回答正确，也不是某次请求的完整输入量 |
   | 实际输入 token 数 | 检查组装后的完整 prompt 是否超出 context window，并记录真实输入规模 | 不能单独说明哪些输入是有效证据 |
   | cache hit/miss token 数 | 解释同一输入规模下的重复计算、延迟和计费差异 | cache hit 不提高证据相关性或答案正确率 |
   | 输出 token 数 | 检查输出预留、停止原因与生成成本 | 输出更长不等于答案更好 |
   | eval 结果 | 用冻结题目和判据衡量 retrieval 与 answer 是否正确 | 不能由 token count 替代 |

   因此 D1 计算 corpus-only token count 的首要目的，是判断全语料上下文基线在已冻结 context budget 内是否
   可行；成本与延迟是后续运行时用途。token 数可能通过截断、证据遗漏或无关上下文间接影响回答质量，但
   token 数与准确度没有单调关系，质量结论必须来自 eval。后续讲解采用“中文术语（英文原词）+ 解决的问题
   + 输入/输出 + 不代表什么”的顺序，不再只用英文名串联关系。
10. **本人复述与关键修正**：本人已经识别出预处理和 BM25 retrieval 在本地完成，因此不进入 generation
    provider 返回的 `usage`；但把“完整 corpus、top-k chunks 都会占用 context window”放在一起仍不准确。
    在 BM25 RAG 请求中，完整 corpus 只占本地文件、索引和运行资源；只有选中的 top-k chunks 在 context
    assembly 后实际进入 prompt，才占用本次 generation 的 context window，也进入输入 token 统计。全语料
    上下文基线是另一种路径：它不筛选子集，完整 corpus 被实际发送，所以完整 corpus 才占用该次请求的
    context window。固定窗口内 retrieved context 越大，留给同一次请求中其它输入和输出的预算越少；这不
    表示其它独立请求的窗口会变小。模型服务未统计完整 corpus 的直接原因不是它“在本地处理过”，而是它
    没有进入该次请求；本地仍可按冻结的 token 计量方法对 corpus-only token count 做请求前估算或计算。
    BM25 为检索切分的词项服务于匹配和排序，不等同于生成模型 tokenizer 切出的 token；context budget 必须
    使用与目标生成模型兼容并明确记录误差边界的计量口径。
11. **本人确认**：本人已明确回答，在 BM25 RAG 中是实际发送的 top-k chunks 占用生成模型的 context
    window；完整 corpus 不会沿该路径整体进入窗口。该项理解确认通过。B 组下一项只处理离线精确计量、
    离线估算与真实请求 `usage` 的证据边界。
12. **精确值、估算值与运行证据**：离线精确 token count 的前提是公开 tokenizer 及其版本、prompt 渲染方式
    都与线上目标模型一致；否则只能得到离线估算。DeepSeek 官方提供可离线运行的 tokenizer 示例，也明确说明
    不同模型的 tokenization 会变化、实际处理量以 API 返回的 `usage` 为准；但页面的 `estimate only` 提示位于
    图像 token 计量段，不能直接扩大成对文本示例的官方定性。基于尚未验证离线示例与线上 prompt 渲染完全
    一致这一事实，D1 保守地把它作为 corpus-only 的可复现估算方法并记录误差边界，不标成线上精确值。真实请求
    `usage` 是该次完整 prompt 的实际运行证据，但仍不能单独拆出 corpus-only 部分。来源：
    [DeepSeek Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage/)。
13. **本人确认**：本人判断官方离线 tokenizer 示例得到的 corpus token count 应记录为估算值，并能从“尚未
    验证 tokenizer、特殊 token 与 prompt 渲染和线上链路完全一致”推出不能声称精确值。该项理解确认通过。
14. **新术语的功能补充**：特殊 token 是 tokenizer 为消息角色、轮次边界、序列开始/结束等协议结构保留的
    标记；它们可能不是用户正文中的可见文字，但仍可能进入模型 token 序列。提示词渲染是把 API 中的
    `system`/`user`/`assistant` messages、工具定义和其它配置转换成模型实际接收序列的过程。它解决“结构化
    API 数据怎样变成模型输入”的问题，输出才是 tokenizer 最终处理的对象。因此仅对七份 Markdown 原文计数，
    既不包含特殊 token，也不等于完整请求 token 数。
15. **目标模式的现状与作用**：当前复用客户端向 `/chat/completions` 发送 `model`、`messages` 和可选 tools，
    没有显式设置 `thinking` 或 `reasoning_effort`。DeepSeek 当前官方契约是 thinking 默认 enabled、effort
    默认 high；思考模式会先产生 `reasoning_content` 再产生最终 `content`，非思考模式则关闭这一阶段。
    该选择会影响输出结构、生成 token、延迟与可能的答案质量，因此必须在 baseline 前显式冻结，并在
    full-context、BM25 与 dense 对照中保持一致。若当前实验的首要观察对象是 retrieval，非思考模式更容易
    隔离检索差异、控制输出成本；思考 high 也可以作为基线，但不能依赖未记录的 provider 默认值。来源：
    [DeepSeek Thinking Mode](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)。
16. **thinking 是否无助于本周观察**：不是。若把 full-context、BM25 与 dense 视为三个实验条件，本周希望
    主动改变的是 retrieval strategy；模型、thinking mode、Prompt 与题集都应作为 controlled variables 固定。
    thinking 不会改变 BM25 已经返回的 top-k chunks，因此无助于证明 retrieval 本身是否命中正确证据；但它会
    影响 generation 如何综合证据、遵守引用/拒答约束，以及端到端答案、输出 token 和延迟。若只看最终答案，
    更强的推理还可能依靠模型已有知识或对残缺证据作推断，遮住 retrieval miss；所以本周必须同时保留
    retrieval evaluation 和 end-to-end evaluation。non-thinking 适合作为隔离 retrieval 差异的主对照，
    thinking 则适合在主线稳定后作为独立 generation 变量；最终模式仍待本人冻结。
17. **Codex/Cline 上下文压缩追问**：context compaction 是 agent harness 的上下文管理功能，不是底层模型自行
    弹出提示。它把较早的对话、工具结果与决定压缩成更短的后续输入，以释放 token 空间；这与 prompt cache
    只复用相同输入前缀的计算不同。当前本机 Codex CLI 0.135.0 配置使用 `gpt-5.6-sol`、reasoning high，未显式
    配置 auto-compact 阈值；OpenAI 官方给该模型标注 1.05M context window，并将 compaction 用于长会话和
    tool-heavy workflow。Cline 官方也会监控 token 并在接近窗口时自动压缩；对不能使用其 LLM-based summary
    的模型会退回规则截断。因当前环境没有可读取的 Cline CLI/任务配置，不能确认本人 Cline 中的 DeepSeek
    adapter、申报窗口、Auto Compact 开关与阈值，也不能断言它从未压缩。两边提示频率差异目前只能归因候选为：
    harness 阈值不同、实际送入的 system/rules/文件/工具输出量不同、Cline 使用 compact prompt，或其截断路径
    没有显示同样提示；不能仅凭提示频率归因到 DeepSeek 与 GPT 的模型能力。当前学习对话包含长规则文本、文件
    读取与多轮工具结果，属于更容易触发 compaction 的 workload。来源：
    [OpenAI model compaction](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2)、
    [OpenAI GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)、
    [Cline Auto Compact](https://docs.cline.bot/features/auto-compact)、
    [Cline task context](https://docs.cline.bot/core-workflows/task-management)。
18. **本人冻结目标模式**：本周 full-context、BM25 与 dense 三条对照统一使用
    `deepseek-v4-flash + non-thinking`，不依赖 provider 的 enabled/high 默认值。这里冻结的是请求中的 model ID
    与 thinking 配置，不等同于持有不可变的服务端模型权重；运行证据仍需记录日期、响应中的 model 与
    `system_fingerprint`。当前复用客户端尚未显式发送 `thinking: disabled`，因此该冻结决定已经记录，但执行
    约束尚未接入；在修正并验证前不得运行 baseline。
19. **本人冻结离线估算方法**：本人确认把 DeepSeek 官方离线 tokenizer 示例作为本次 corpus-only token
    estimate 的首选方法。相较按字符数套比例，它实际执行与目标
    模型相关的 tokenization，粒度更细；相较借用其它模型家族的 tokenizer，它减少了词表和切分规则不一致
    带来的系统性偏差；相较真实 API `usage`，它可以离线、逐文件、无生成请求地重复计量，并能单独报告 corpus
    而不是整个 prompt。这里的“更有利”只表示更接近目标模型且更容易复现，不把结果升级为线上精确值：官方
    示例与托管模型的具体 tokenizer 版本、特殊 token 和线上 prompt rendering 是否完全一致仍未验证。执行前
    还应检查下载内容与依赖，并冻结来源 URL、获取日期、文件 SHA-256 和运行版本。D1 应区分两个结果：七份
    snapshot 原文的逐文件估算及合计；待 full-context 的 corpus serialization（文件名、分隔符等）冻结后，
    再估算实际组装的 corpus context。后续真实请求的 `usage` 只作为完整请求的运行证据；官方字符比例仅作为
    粗粒度交叉检查，不作为主计量结果。
20. **官方包执行前检查**：2026-09-07 从官方文档当前链接获取 `deepseek_v4_tokenizer.zip`，下载物为
    1,911,504 bytes，SHA-256 为 `e7310d1dafe0a86d8a5629fe78a7c763760f651db9b8682718a1781dcd6fe495`；HTTP
    `Last-Modified` 为 2026-08-28，`ETag` 为 `6755c7694b8a3ec0bcf4815d77053572`。压缩包只含示例
    `deepseek_tokenizer.py`、`tokenizer_config.json` 和 `tokenizer.json`：示例从本地目录调用
    `transformers.AutoTokenizer`，但只写了 `pip3 install transformers`，没有锁定依赖版本；压缩包内也没有
    LICENSE 文件。当前 W12 虚拟环境没有安装 `transformers`，因此执行前检查时尚未运行示例或 corpus 计量。配置中的
    `model_max_length: 16384` 与当前模型文档的 1M context window 不一致，只能视作 tokenizer 包元数据，不能
    替代已单独查证的模型窗口来源。下载物暂存于 `/tmp`，没有加入 corpus 或仓库。
21. **corpus-only 是否加入特殊 token**：这是由计量对象决定、存在标准口径的理解题，不是开放式契约设计。
    本人能正确复述特殊 token 用于消息角色、轮次与序列边界，也可能占用 token；但首次判断认为应给七份
    Markdown 分别加入开始/结束 token，以标记“对话结构”。这里混淆了文档边界与对话消息边界。七份原文自身
    不各自构成一轮对话，因此 raw corpus-only estimate 应对每份原文使用不自动加入特殊 token 的口径；否则会
    人为重复计算七组并不存在的消息包装。若 full-context 方案把七份文档放进同一个 user message，角色和消息
    边界由整条 message 的 prompt rendering 添加；若应用明确把每份文档做成独立 message，才会出现逐条消息
    包装，但它仍属于 assembled prompt input，不属于 raw corpus-only。应用添加的文件名、标题和分隔符是
    context assembly 的可见结构文本，也不等于 tokenizer 自动加入的特殊 token。本人随后复述确认七份文档
    不是七轮对话，因此 raw corpus-only 应排除特殊 token，该核心判断通过。复述中提到的“是否在本地计算七次
    BM25”不是判断依据：逐文件调用 tokenizer 七次仍可全部排除特殊 token，BM25 的分词与排序也不参与 D1 的
    generation tokenizer 计量。
22. **raw corpus-only estimate 已执行**：使用隔离的 Python 3.12.10 环境。首次按当前最新版
    `transformers 5.16.1 / tokenizers 0.23.2` 运行时，官方 `Hello!` smoke 虽返回 `[19923, 3]`，但中文编码为
    空序列、英文空格被丢弃，encode/decode 回环失败；所得 3,800 立即判为无效结果，没有进入结论。改用
    `transformers 4.57.6 / tokenizers 0.22.2` 后，官方 smoke 仍返回 `[19923, 3]`，中英文样本与 7/7 文档回环
    均通过。按 manifest 逐文件读取、验证原字节并使用 `add_special_tokens=False`，七份原文合计得到 **18,680
    estimated tokens**；无分隔符直接拼接也为 18,680。运行时 `18680 > 16384` 警告来自包内旧
    `model_max_length`，不用于判断目标 `deepseek-v4-flash` 的 1M context window。完整逐文件结果、运行版本、
    artifact/manifest 哈希与无效兼容性尝试见
    [`token-count-rules-c0a4b85.json`](../evidence/token-count-rules-c0a4b85.json)。该结果仍不包含文件名、分隔符、
    instructions、query、消息包装或输出预算，也不是 provider `usage`；assembled corpus context 和固定运行入口
    尚待完成。
23. **citation 应指向转换前还是转换后**：本人能复述 citation 必须指向实际使用的冻结来源位置，并提出至少
    保留“出自转换前哪一段文档”以便人工复核；该方向正确，但还缺模型可见的中间标识。冻结 snapshot 中的原文
    位置是 citation 的权威目标；serialized context 是把证据送进模型的载体。模型不能直接引用它在 prompt 中
    看不到的外部位置，因此每个可引用证据单元需要一个 prompt-visible citation handle，并由确定映射把该 handle
    解析回 snapshot 中的 document identity 与 source span。snapshot/commit 可以作为整次运行的全局版本信息，
    不一定在每个块里重复；但只写“第 3 段”或按 prompt 顺序编号不稳定，重排后就可能指向别处。full-context
    baseline 即使没有 retrieval，也可以划分可引用的 source blocks；它们是 citation granularity，不自动等于
    D2 用于检索的 chunks。引用有效至少包含三个判断：输出的 handle 符合约定、handle 能在 registry 中解析到
    冻结位置、该位置的内容确实支持对应论断。前两项可做确定性校验，第三项属于 citation correctness eval。
    本轮只完成 L1 原理讲解，具体 handle、source span 粒度与输出格式仍由本人设计和冻结。
24. **来源标识稳定性确认**：本人正确判断序列化顺序改变后，“第 3 段”不能继续作为稳定来源标识，因为它是
    相对于 prompt 排列顺序的位置编号；重排后同一编号可能对应另一段内容。复述中的“来源追踪元数据只要
    序列化顺序改变就可能指向其它内容”需要修正：设计正确的 provenance metadata、snapshot identity、document
    identity 与冻结 source span 不应随序列化顺序改变，它们正是稳定解析的依据。变化的是 order-dependent
    locator，不是来源事实本身。该稳定性核心判断通过，下一步由本人设计 citation 最小契约。
25. **citation 最小契约首次回答与 D1 进度核对**：本人回答每个 source block 至少需要 provenance metadata
    与稳定来源标识。方向接近，但 provenance metadata 是一组来源证明信息，且 snapshot ID、commit、文件哈希
    等可以按整次运行全局保存，不能替代 block 自身的精确定位。每个可引用 block 至少需要两个功能角色：一是
    模型可见并可输出的稳定 citation identifier；二是能解析到冻结 document identity 与 source span 的 source
    locator。二者的确定映射用于回到原文；全局 provenance metadata 用于证明该原文属于哪个冻结版本。具体字段
    与 span 粒度仍未由本人冻结。当前 D1：§4.1-§4.3 全部完成；§4.4 完成 6/8，只差 context budget 与容量
    结论；§4.5 eval、§4.6 RAG Prompt、§4.7 baseline 和 §4.8 必要性结论均未开始；§4.9 是不阻断主线的附加项。
26. **citation 复述确认与 context budget 组成首次回答**：本人已准确复述每个 source block 需要稳定 citation
    identifier 与 source locator；这是功能角色理解确认，具体字段形状仍留到 §4.6 冻结。本人随后回答 1M
    context window 除 raw corpus 外还需为特殊 token、prompt rendering、instructions 和 query 预留 token。
    输入侧方向正确，但 prompt rendering 是把结构化 messages 转成模型输入序列的过程，不是与特殊 token/消息
    包装并列的另一份内容，必须按其产物计量以免重复。完整预算还应包含 corpus serialization 添加的来源标识、
    文件名与分隔符、预留的 generation output tokens，以及覆盖离线 estimate 与线上实际计量偏差的 safety
    margin。当前关系可写为：`context window >= instructions + query + serialized corpus + message/rendering
    overhead + reserved output + safety margin`，其中 `serialized corpus = raw corpus + citation labels/delimiters`。
    本轮仍未冻结各项数值，也未形成容量结论。
27. **context budget 组成展开与输出容量判断**：`instructions` 规定模型要做什么、遵守什么边界；`query` 是
    本次待回答的问题；`serialized corpus` 是七份原文按确定规则拼成的实际语料文本；`message/rendering
    overhead` 是 messages 经 prompt rendering 后新增的角色、边界与特殊 token；`reserved output` 是为
    generation 预留的最大容量，不等于一定生成或实际计费的 token；`safety margin` 是为离线 estimate 与线上
    渲染差异、输入小幅变化主动留下的未使用容量。serialized corpus 内，citation labels 是模型可见并可输出的
    稳定来源标识，filenames 是帮助识别文档身份的冻结文件名或 source path，delimiters 是区分文档开始/结束的
    可见分隔文本；三者都是 context assembly 内容，delimiter 不等于 tokenizer 的特殊 token。本人判断若 input
    恰好占满 1M context window，就无法生成结果，因为窗口已经用完；容量关系判断正确。更精确地说，官方 API
    约束 input tokens 与 generated tokens 的总长度不超过 context length，因此此时没有可供 generation 使用的
    token；服务端的可观察行为可能是在生成前拒绝请求，而不保证返回一条空答案。本实验应在请求前判为容量
    不可行，不依赖 provider 静默裁剪。来源：
    [DeepSeek Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)。
28. **reserved output 如何设定**：本人正确选择根据本次 baseline 所需答案长度设定，而不是直接占满模型允许
    的最大输出长度；但后续理由把最大输出能力称为“理想值”，并认为 query 与 RAG corpus 会使 context window
    逐渐变化。需要修正为三层：context window 是冻结模型/API 条件下的总容量上限；input occupancy 是本次实际
    输入占用，会随 query 和实际发送的 context 改变；remaining capacity 是扣除输入后可供输出的剩余空间。
    模型最大输出长度是 provider/model capability limit，不是推荐值或理想值。本实验的 reserved output 应由
    eval 所需的最大合格答案长度决定、不得超过模型能力和剩余容量，并作为 full-context、BM25、dense 对照中的
    固定 controlled variable；实际 completion tokens 可以小于该预留值。当前 eval 输出要求尚未冻结，因此
    `max_tokens` 的具体数值仍待本人决定，不能先拍数值再让 eval 迎合它。
29. **query 变化与固定 `max_tokens`**：本人正确复述 context window 是固定容量，三条对照固定 `max_tokens`
    可以避免某条路径因更多输出容量而占便宜，实际回答可以提前结束。补充配对边界：不同 eval 题目的 query
    内容和 token 长度可以自然不同；但同一道题在 full-context、BM25、dense 三条路径中必须使用完全相同的
    query，否则同时改变了 retrieval strategy 与问题输入，不能归因。`max_tokens` 至少必须在同题的三条配对
    运行中相同；本实验为降低变量数量，计划使用全局固定值。若某条路径的实际输入、固定输出预留与安全余量
    合计超窗，应把该条件记为容量不可行，不能只为它临时降低 `max_tokens`。该理解确认通过；下一步先由本人定义
    baseline 单题回答的 output envelope，再换算并冻结 reserved output 数值。
30. **“baseline 的单题回答”是什么意思**：这是组合表达，不是一个独立行业术语。evaluation item 是 eval set
    中的一道独立样本，本周至少包含一条 query，并在冻结契约中关联预期行为或判据；baseline run 是在固定
    corpus snapshot、Prompt、模型与生成配置下运行该题；per-item response 是该次运行返回的一条模型输出。因此
    “full-context baseline 的单题回答”就是把完整 serialized corpus 与某一道 query 按固定 Prompt 发送后得到的
    一次回答。它不是该题的 reference answer 或 label，不代表整套 eval 结果，也不是汇总 metric。后续对同一道
    evaluation item 运行 BM25 与 dense，会各自产生对应的 per-item response，用于配对比较。此前问题是在询问
    每条这样的模型输出需要具备什么结构，才能被确定性解析和评测；目前只完成术语讲解，尚未要求本人作答。
31. **单题响应的最小内容首次回答**：本人明确说明缺乏相关认知后，尝试提出回答正文、所引用内容、如何
    review/证实或证伪，以及预期回答与实际回答的差异。前两项属于正确方向；后两项混入了 evaluator 的职责。
    RAG 没有跨系统唯一的响应 schema，具体字段名和 JSON/文本格式由任务契约决定；但常见的最小功能角色是：
    输出 answer，或在证据不足时输出可区分的 abstention；并为有事实主张的答案输出符合约定的 citations。
    response format/schema 使这些角色可被程序确定性解析，但格式通过不代表语义正确。模型不应看到并复述隐藏的
    expected answer，也不应负责计算 expected/actual diff 或宣布自己通过；这些属于 response 之后的 evaluation
    record。运行层还需另存 item ID、原始响应、解析结果、模型/Prompt 版本、`finish_reason`、usage 与 latency，
    同样不要求模型把它们写进回答正文。本人的回答遗漏了 abstention/status，并把 model output、run evidence 与
    evaluation result 合在一起；本轮完成 L1 分层讲解，具体响应字段与格式尚未冻结。
32. **相对主流的 schema 定义方式**：本人追问虽然 RAG 没有唯一响应 schema，是否仍有主流定义方式，并正确
    理解“可解析、可追溯、能表达证据不足”是独立于文件格式的要求；随后把 model response 概括为回答本身与其
    使用的语料引用。需要补充：证据不足时响应不一定有 answer，必须有可确定解析的 answered/abstained 分支；
    citations 应表示实际支持回答论断的受控 source identifiers，不是把所有进入 context 的语料都列出。跨语言、
    跨 provider 相对通用的契约描述是 JSON Schema，也常由 Pydantic、Zod 等语言类型工具生成；但不存在 RAG
    专属的标准字段名。常见最小功能形状是 status、answer/abstention 与 citations；简单答案可用 answer 加平铺
    citations，多事实答案若需要逐项核验，可把 citation 关联到各 claim，代价是 schema 和输出更复杂。本实验的
    具体取舍仍由本人冻结。实现能力需分 provider：OpenAI Structured Outputs 与 Anthropic Structured Outputs
    当前都支持按各自受限 JSON Schema 约束输出；DeepSeek 当前 JSON Output 文档只说明 `json_object` 保证合法
    JSON，并要求 Prompt 包含 `json` 与期望格式示例，且提示可能返回空内容，不能据此声称精确 schema adherence。
    因此本实验若使用 DeepSeek，应在应用侧保留三道独立门禁：JSON syntax validity、local schema validity、
    semantic correctness；前两道通过仍不能替代 answer/citation/abstention eval。来源：
    [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)、
    [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode)、
    [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、
    [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)。
33. **本人冻结 claim-level citation 原则**：对于可能同时包含多条规则结论的回答，本人选择让每条 claim 分别
    关联 citations，以便逐项确认哪条证据支持哪条论断。本人联想到论文正文中的引用序号和文末参考文献表；这是
    有限类比：正文标识与参考列表的映射类似 citation identifier 到 registry 的映射，但本实验还必须解析到冻结
    snapshot 的 document identity 与 source span，不能只列文献名或看似真实的段落位置。claim-level 结构提高
    可追溯性和 citation correctness eval 的定位能力，也会增加 schema 复杂度、输出 token 和部分字段缺失的
    失败面。一条 claim 可以有多个支持来源，同一来源也可支持多条 claim；关键是关联必须显式。当前只冻结引用
    粒度原则，具体 JSON 字段、引用标识和 source span 粒度仍待本人设计。
34. **受控 citation identifier 与本地 registry 的职责**：本人认为模型只返回 identifier 可以节省输出 token；
    corpus 已冻结，固定来源元数据也没有必要在每次调用时重复生成。这两个理由成立，分别对应输出效率与静态
    元数据复用。更关键的 correctness 理由是把模型任务限制为选择 prompt 中已有的受控 identifier，而不是自由
    生成文件路径、行号或段落描述；模型仍可能输出未知 identifier，但本地程序可以用有限允许集合立即判为无效。
    registry 则以确定性映射把有效 identifier 展开为 snapshot identity、document identity 和 source span，避免
    “字符串看似真实”被误当作有效引用，并把展示所需的完整来源信息与模型响应解耦。因此 identifier 不是引用
    证据本身，而是解析到冻结证据位置的稳定键。该理解完成 L1 校准；identifier 格式与 registry 字段仍未冻结。
35. **未知 citation identifier 的现象与归因**：本人追问未知 identifier 是否可能分别来自模型编造引用或本地
    文件不完整，并询问 RAG 是否也会产生 hallucination。RAG 会出现 hallucination：retrieval 只提供候选证据，
    不保证 generation 一定遵守证据、正确归纳或正确引用。未知 identifier 的直接可观察结论应记为 citation
    resolution failure，而不是“没有引用”；缺少或为空的 citations 才是 missing citation。仅凭未知 identifier
    不能确定根因，候选原因至少包括模型生成了允许集合外的标识，以及 prompt serialization、registry、snapshot
    版本或解析/规范化逻辑不一致。若预运行校验已经证明每个 prompt-visible identifier 都存在于 registry、每个
    registry 条目都解析到通过 hash/manifest 校验的冻结 source span，则运行后新出现的未知 identifier 可以归为
    model output 的 invalid citation；更口语地可称 citation hallucination，但实验记录应优先使用可直接验证的
    失败名称。若 intended corpus 本身漏掉了一份文档，它首先属于 corpus construction/evidence coverage 问题，
    通常导致缺少证据或应当 abstain，并不自动解释某个未知 identifier。具体失败标签仍待 eval 契约阶段冻结。
36. **术语补课、迁移类比与原题校准**：本人指出 citation identifier、registry、corpus construction、evidence
    coverage 与 source span 尚未得到足够解释，要求后续新术语先给功能说明，并在存在 Web/软件工程/传统运维
    对应关系时优先附上明确标注的迁移类比。已在 §2.2 补齐正式定义；类比只帮助迁移，不能取代术语：citation
    identifier 类似响应中的 foreign key，citation registry 类似本地受控 lookup table，source span 类似冻结文件
    中可由 start/end 确定读取的 slice；corpus construction 类似数据 ETL/build pipeline，evidence coverage 类似
    检查构建产物是否包含目标查询所需原始数据。本人对原题的首次理解是：模型返回的来源存在，但另行返回的
    source span 与 registry 不吻合，因此 registry 可以对比发现。该回答改变了原题条件：当前设计让模型只返回
    identifier，权威 source span 由 registry 给出，并不存在两份位置供比较。若 identifier 存在且成功映射，引用
    解析已经通过；当映射到的原文不支持 claim 时，失败的是 citation correctness，普通 registry 查表不能判断
    文本与 claim 的语义支持关系。若未来让模型同时返回 identifier 和位置，registry 确实可以发现两者不一致，
    但这是重复表达同一事实，会增加 token 与新的不一致失败面，本轮不据此改变已定原则。
37. **既有资料复核实践与 RAG 规范的重叠边界**：本人准确复述 registry 查表只能证明引用指向真实存在的位置，
    不能证明该位置支持结论；随后追问过去让 review subagent 实际访问资料链接，并分别标注链接可访问性、agent
    是否实际访问、页面内容是否符合资料描述，是否已在无意中实践 RAG 规范。该流程确实覆盖三类 RAG 工程常见
    检查，但三者不能互相替代：source accessibility/link validation 只证明检查时能够取得页面；execution/tool
    trace 证明 agent 确实发起访问并得到某个结果；citation correctness 检查取得的内容是否支持关联 claim。
    review subagent 在这里承担 verifier/evaluator 角色，即在生成后再次检查，而不是 retrieval 本身。只有当外部
    资料先被检索并作为 context 提供给生成模型时，整条回答链路才具备 retrieval-augmented generation 的核心
    结构；若只是回答完成后检查链接，更准确的名称是 post-generation source verification。迁移类比：HTTP 请求
    成功类似 citation identifier 可以解析，但 HTTP 200 不证明页面支持业务结论，正如外键存在不证明关联记录
    满足业务规则。该实践提高可信度，但 subagent 判断仍可能出错，且在线页面会变更；若用于可重复 eval，还需
    保存获取时间及内容 snapshot/hash，不能只保留 URL 或 reviewer 的结论。
38. **本人识别临时出题偏离 D1 主线**：AI 在回答既有资料复核实践后提出“回答生成后访问链接属于 retrieval
    还是 post-generation source verification”，本人追问这是否为原计划问题，并准确识别它是根据刚才补充内容
    临时生成的延伸题。该题不是 D1 原定执行清单的一部分；AI 不应把用于连接既有经验的补充说明继续扩张成新的
    考核支线，现撤回且不要求本人回答。正式下一入口保持为 §4.4：冻结 instructions、query、reserved output 与
    safety margin 的分配，据此得到 context budget，并判断七份规则文档语料能否完整容纳；完成后才进入 §4.5
    eval 契约。
39. **baseline 单题 output envelope 首次回答**：本人提出不把 context budget 公式中减去的预留内容重新返回，
    只返回符合契约需要的全部内容。其“不回显输入或静态配置”方向正确：模型响应不应复制 instructions、query、
    整份 corpus、registry、Prompt 渲染结构或预算说明，正如 Web API response 通常不回显 request body、路由
    配置和服务器容量。但括号中的表述需修正：reserved output 是为响应预留的容量，message/rendering overhead
    是协议开销，safety margin 是主动留白，它们都不是可供模型重新返回的文本。“返回契约要求的全部内容”仍是
    循环定义，尚未说明回答分支中除 claim 与 citation identifier 外是否需要简短依据，也未给出最长合格范围，
    因而目前还不能据此换算或冻结 reserved output tokens。下一步只收窄这一项，不提前设计 eval 题目内容。
40. **正常回答不生成额外证据说明**：本人选择 answered 分支只保留 claim 与其 citation identifiers，不要求模型
    为每条 claim 另写“为什么引用支持结论”的说明；理由是人工核验时，重复解释会增加输出并稀释对 claim 与
    实际证据的注意力。这是由当前读者与核验流程决定的合理契约选择，不是所有 RAG 系统的通用最佳答案。即使
    后续由另一个 AI 复核，也应优先把 claim 与 registry 解析出的权威 source span 直接交给 verifier，而不是把
    生成模型自己的解释当作证据，以免重复文本或错误转述影响复核。模型生成的 evidence explanation 与本地读取
    的 evidence excerpt 必须区分：前者本实验不要求，后者可由运行/评测层按 identifier 确定展示，不计入模型
    completion tokens。当前 answered 分支的必要内容已收窄为 claim-level `claim + citation identifiers`；最多
    claims 数、abstained 分支内容和最长合格范围仍待本人冻结。
41. **abstained branch 术语补课与原因要求**：本人指出 AI 此前只解释过题目中的“拒答”，没有先解释
    `abstained branch`，本人只能从题面推断其含义。该顺序不符合先讲解再提问的约束，现补正：answered branch
    与 abstained branch 是同一 response contract 下两种互斥结果形态，类似 Web API 根据结果返回成功或受控失败
    的不同 response variant，不表示再次调用模型。本人决定拒答时必须给简短原因，以便后续观察和改进；该决定
    对当前实验成立。边界是模型只能描述它可见的现象，例如当前 context 没有足够证据，不能仅凭自述断定根因是
    retrieval miss、corpus evidence coverage、Prompt 或 generation。改进方向应结合运行 trace、实际 context 与
    evaluation record 归因。当前 abstained 分支已确定包含明确拒答状态与简短原因；原因的自由文本/受控类别表示
    方式及最长范围仍待本人冻结。
42. **拒答原因采用受控 code 与简短 text**：本人选择 abstained branch 同时返回受控 `reason code` 和简短
    `reason text`，并将其类比为 HTTP 响应格式中 code 便于归类、text 便于初步理解；该职责判断准确。类比边界
    是这里的 reason code 更接近 HTTP response body 内的应用错误码，而不是 HTTP status code：模型 API 调用在
    传输层可以成功返回 HTTP 200，但业务响应仍可表示 abstained。reason code 必须来自预先冻结的有限集合，供
    程序确定性解析与汇总；reason text 面向人工阅读并与 code 一致，但两者都只表达当前证据状态，不替代系统
    根因归因。具体 code 枚举仍待 eval 可观察条件明确后由本人冻结，不在此处由 AI 预填。
43. **单题最多 10 条 claims 与分页类比边界**：本人询问 maximum claim count 是否可以类比分页，并选择每个
    evaluation item 最多返回 10 条 claims，超过时“分段返回”。`10` 已作为本实验 answered 分支的条目上限。
    page size 类比只在“限制一次返回的条目数”这一点成立：传统分页面对已经存在、可稳定排序的记录集合；claims
    是模型本次生成的语义结论，跨调用不保证稳定顺序，也可能重复或遗漏。若“分段返回”表示同一道题自动多次
    调用模型续写，就会新增 cursor/continuation 状态、额外 usage 和新的对照变量，不在当前 D1 baseline 计划内。
    更小且可重复的处理是 eval 设计阶段把预期超过 10 条 claims 的宽问题拆成多个 evaluation items；本人所说的
    “分段”究竟指预先拆题还是运行时多次生成，尚待确认，在确认前不引入分页协议。
44. **超过 claim 上限时采用 eval 设计阶段拆题**：本人确认“分段”指在 eval 设计阶段把过宽问题预先拆成多个
    evaluation items，而不是让同一道题通过多次模型调用继续生成。每个拆分后的 item 都是独立 query、独立
    per-item response 和独立运行证据，并继续遵守最多 10 条 claims；full-context、BM25、dense 对同一个 item
    使用相同 query 与输出上限。该选择不引入分页字段、cursor 或 continuation 状态，也避免多次生成造成 claims
    重复、遗漏或顺序漂移。单题 claim 数与超限处理现已冻结；claim 文本和总响应的最长范围仍待确定。
45. **“每条 claim 一句”的收益与代价**：本人在决定前追问限制为一句的好处，以及不这样限制是否也有收益。
    真正需要优先冻结的是 atomic claim：每个 claim 只表达一个可独立核验、可独立关联 citations 的结论，类似
    单元测试中的一个核心断言；它不等于语法上必须恰好一句。严格一句的收益是输出紧凑、claim-citation 对齐更
    清楚、人工逐项核验更快，也降低一个 claim 混入多个支持状态不同的结论，并有助于估算 token。代价是复杂
    规则中的适用条件、例外和范围可能被压掉，或被迫写成难读的超长句。允许有限的多句文本可以保留必要限定并
    提高自然可读性，但若完全不设边界，会重新引入多论断混写、引用归属不清和输出大小不可控。因此较稳妥的
    候选原则是“一个可独立核验的语义结论，可包含表达该结论所必需的限定”，再用总响应 token 上限控制容量；
    这是取舍说明，不替本人冻结最终规则。
46. **本人冻结 atomic claim 文本原则**：本人确认“一个可独立核验的结论，可以保留必要条件和例外，但不机械
    限制为一句”的契约合理，并认为已有 code 后 claim text 可以相对灵活。结论本身已冻结，但理由需要分层：
    目前设计的 reason code 只属于 abstained branch，不约束 answered branch 的 claim text；正常回答的灵活性
    来自 atomic claim 语义边界、最多 10 条、逐 claim citations 和不生成额外证据说明共同约束。当前没有设计
    claim code，也不因本次确认新增字段。claim 文本不设机械句数限制，但仍不得混入第二个独立结论、原文摘录
    或证据说明；总响应 token 上限继续承担硬容量边界。
47. **`max_tokens` 没有统一行业数值，可暂定但必须在计分前冻结**：本人追问行业标准，并询问能否先暂定、等
    本周 demo 完成后再判断。跨模型、任务和 response contract 不存在统一推荐数值；provider 公布的最大输出是
    capability limit，`2048/4096/8192` 只是常见容量档位，不是行业标准。可以把候选值标为 provisional，并在
    正式计分前进行 calibration：先依据当前 output envelope 构造最大形状样本并离线计量，必要时只用 dev/pilot
    运行观察是否发生 truncation；类比在 staging 环境校准 response body 限制。门禁是首次计分的 full-context
    baseline 前必须冻结同一个 `max_tokens`，BM25 与 dense 沿用。若看过可比结果后修改，应建立新配置版本并重跑
    全部比较路径，不能只给失败路径扩容；holdout 结果不得用于选择该值。因此“等 demo 做完”若指正式 D3/D4
    结果之后再挑有利数值则太晚，若指计分前的非计分 calibration 则可行。当前仍未选 provisional 或 frozen 数值。
48. **本人冻结三条对照的 `max_tokens = 4096`**：本人决定 full-context、BM25、dense 共同使用 4096 作为
    reserved output 与 generation `max_tokens`，理由是它不要求每次输出用满，因此先保留较宽余量。该理解正确：
    4096 是每次请求的输出上限和容量规划预留，不是目标长度；模型可以提前结束，实际 completion usage 按实际
    生成量记录，不因预留上限自动按 4096 计费。但 context budget 计算必须完整扣除 4096，且更大上限可能允许
    更冗长输出或更高最坏情况成本。该值现为 frozen，不再称 provisional；若后续 dev 证据证明不足，必须建立新
    配置版本并重跑全部可比路径，不得单独扩容某一条路径，也不得依据 holdout 结果选值。
49. **safety margin 采用固定 token 数**：本人选择以固定 token 数表示安全余量，而不是按 1M context window
    的百分比计算。该选择使当前冻结模型下的预算公式与审计记录更直接；代价是未来若更换不同 context window
    的模型，需要重新评估而不能机械沿用。safety margin 与 reserved output 职责不同，前者覆盖离线估算、线上
    rendering 和小幅输入变化的不确定性，后者为 generation 留出容量；两项都需从窗口中扣除，但 safety margin
    不是实际发送内容，也不进入 usage。当前只冻结计量方式，固定 token 数值仍待本人决定。
50. **本人冻结 safety margin 为 100,000 tokens**：本人选择当前 1M context window 的 10% 作为数值。按上一轮
    已冻结的固定 token 表示方式，实验配置记录为固定 `100000`，10% 只说明这次选值依据；未来若更换 context
    window，不自动按比例重算。扣除 `reserved output = 4096` 与 `safety margin = 100000` 后，当前剩余
    `1,000,000 - 4,096 - 100,000 = 895,904` tokens；这仍包含待分配的 instructions、query、message/rendering
    overhead 与 serialized corpus，不能把 895,904 直接称为最终 corpus context budget。
51. **non-corpus input allowance 术语、合并取舍与实践边界**：本人指出该概念尚未解释，并追问合并的收益及
    是否符合最佳实践。该名称不是行业或 provider 固定术语，而是本实验的本地预算分组：为 instructions、query
    与 message/rendering overhead 共同设置输入 token 总上限。迁移类比是 Web 请求为 headers、参数与协议包装
    设置一个总体 request-envelope 预算，或服务设置总内存上限；它不表示这些内容被拼成同一个字段。合并的收益
    是避免 Prompt/eval 尚未完成时猜三个缺乏依据的子上限，只要总和不超额就能完成容量门禁，并简化三条对照的
    一致配置。损失是仅看总数会掩盖某一组成异常膨胀，也无法说明 query 与 instructions 各自占用。不存在要求
    必须合并的通用最佳实践；生产系统常按风险采用总上限、子预算或优先级。对当前小型固定实验，更稳妥的组合是
    **总额约束、分项观测**：用一个 combined allowance 做请求前容量门禁，同时在 prompt 完成和真实运行后分别
    记录 instructions、query 与 rendering 的 estimate/usage 证据。该方式不把合并预算冒充实际 token count，
    也允许定位异常。本人尚未确认是否采用，数值也未冻结。
52. **本人采用合并上限与分项观测，并纠正本地术语预警违规**：本人认为该方式值得采用，同时明确指出 AI
    不能将自创概念毫无预警地抛出。该批评成立：AI 先使用 `non-corpus input allowance` 提问，之后才声明它是
    本地预算分组，违反了正式术语或直接描述先行、本地称谓必须在首次出现时标明的约束。现不把该简称作为后续
    唯一指称，术语表与决定表均改用完整描述：instructions、query 与 message/rendering overhead 共用一个 token
    总上限做容量门禁，同时分别记录三项估算值和真实运行证据。今后若确需本地名称，必须先明确“非行业术语/
    本实验称谓”、解释组成和边界，再用于讨论或提问；不得让本人通过题面猜测。方法已经冻结，合并上限数值
    仍待本人决定。
53. **合并输入上限没有通用比例，5% 是宽松策略值**：本人说明对数值没有概念，追问一般取值并提出 5%。没有
    跨模型、Prompt 和任务统一的比例；正常实际占用应在 Prompt/query 完成后计量，不能用“通常为窗口百分之几”
    替代证据。当前 1M 窗口的 5% 等于 50,000 tokens，作为 instructions、query 与 message/rendering overhead
    的共同硬上限可以使用，但对短 instructions、单条 query 和少量消息包装而言非常宽松，更接近防止极端膨胀
    的保险线，不是正常 usage 估计。它不会令每次请求自动消耗 50,000 tokens，但会把 corpus context budget
    再减少 50,000，并允许这三项在门禁触发前增长到较大规模。相较之下，10,000–20,000 更有约束力；二者也
    不是行业标准。本人尚未明确确认是否冻结 5%/50,000，决定表保持数值待定。
54. **本人纠正 context budget 的依赖顺序，最终容量门禁移至 Prompt 后**：本人指出如果 instructions、query
    与 rendering 的数值因依赖对象尚未形成而无法冻结，就应先完成可确定部分，再回来计量和冻结，并追问原顺序
    是否属于最佳实践。该质疑成立：§4.4 先冻结全部数值是本地计划设计决定，不是行业标准；AI 继续要求在
    eval/Prompt 前猜比例，造成了依赖倒置。更合理的实验顺序是先冻结 snapshot/raw token 事实，再冻结 eval 与
    Prompt，随后对实际 serialized input 计量、冻结输入上限和最终 context budget，最后才运行计分 baseline。
    类似性能测试先定义真实 request/schema，再测 payload 并锁定资源限制，锁定必须发生在 benchmark 前，而非
    request 尚不存在时。本文件现将 §4.4 收口为 raw corpus 与容量前置事实，最终预算和完整容纳判断移动到 §4.6
    末尾、作为 §4.7 的硬门禁。已经由本人冻结的 `max_tokens = 4096` 与 safety margin `100000` 保留；此前提出
    的 5%/50,000 合并输入上限没有冻结，不再要求此时决定。

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
- 个人面试材料。
- 公司资料、PII、密钥和本地环境文件。

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
| dev/holdout 的隔离方式 | 待本人填写 |
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
- [x] manifest 已记录 source commit、原始路径、快照路径、字节、SHA-256 与 Git blob。
- [x] 实测 7 个文件，共 76,149 bytes；未沿用 W12 历史体积。
- [x] 精确 allowlist 从范围上排除了题库/答案、W13 进行中笔记、个人面试资料、公司资料和环境文件；
  强特征密钥、私钥、带凭据 MongoDB URI 与邮箱扫描无命中。

**顺序硬线**：本节完成前不得创建第一道 eval 题。

### 4.4 运行 raw corpus token 计量并记录容量前置事实

- [x] 执行前完成 §2.2 B 组讲解，能区分 byte、token、估算值、provider usage、context window 与
  本人分配的 context budget。
- [x] 查证并记录目标生成模型与 context window 的来源；它是外部事实，不由本人自行设定。
- [x] 本人冻结 `deepseek-v4-flash + non-thinking`；当前客户端显式发送 `thinking: disabled` 的接线与验证待完成，
  未完成前不运行 baseline。
- [x] DeepSeek 提供官方离线 tokenizer 示例，并要求以 API `usage` 为实际处理量依据；因尚未验证该示例与
  线上 prompt 渲染完全一致，本实验将离线结果保守记录为 estimate，不写成线上精确 token count。
- [x] 本人冻结以官方离线 tokenizer 示例为主估算方法、官方字符比例只作粗粒度交叉检查；来源 URL、获取
  日期、下载文件 SHA-256、执行结果与依赖/运行版本均已记录；真实请求后另存 provider `usage` 运行证据。
- [x] 规则文档语料 raw corpus-only estimate 为 18,680 tokens；逐文件结果和兼容性验证已独立保存，没有混入
  历史字节数或尚未启动的仓库 Markdown 扩展语料。
- [x] 本人已冻结三条路径共同使用 `reserved output / max_tokens = 4096`，并冻结固定 safety margin
  `100000` tokens。
- [x] instructions、query 与 message/rendering overhead 的上限及最终 context budget 依赖实际 eval/Prompt；
  不在对象形成前猜数，最终计量与完整容纳判断移动到 §4.6 末尾。

**阶段边界**：本节完成 raw corpus 与容量前置事实，不据此提前宣布完整 prompt 可容纳；§4.6 的最终容量门禁
未通过时，不运行全语料上下文 baseline。

### 4.5 本人冻结 eval 契约

- [ ] 设计前完成 §2.2 C/E 组讲解，能区分 label、metric、threshold、passing criteria 与四个失败阶段。
- [ ] 只基于已冻结 snapshot 建立题目，不反向改动 corpus 迎合题目。
- [ ] 本人定义 dev/holdout 边界，并保留 holdout 冻结版本以及 D2-D4 未运行、未用于选择或调参的记录。
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
| source commit / snapshot | `c0a4b85c9065cbfb943584c914172d7819339791` / `rules-c0a4b85` | `week13-rag/corpus/rules-c0a4b85/manifest.json` | 7 文件，76,149 bytes；manifest 汇总通过；7/7 文件字节、SHA-256、Git blob 与 source commit 一致；强特征敏感内容扫描无命中 | 规则文档语料 snapshot 已冻结；不能据此推出 token 数、上下文可容纳性或回答质量 |
| generation 配置 | `deepseek-v4-flash` / Chat Completions / non-thinking | 本文件 §2.3.2、§3.3；实际请求证据待生成 | 本人已冻结请求配置；当前客户端尚未显式发送 `thinking: disabled` | 冻结 model ID 不等于冻结服务端权重；接线验证和运行时 model/`system_fingerprint` 记录仍待完成 |
| token 计量方法 / token count | DeepSeek 官方离线 tokenizer 示例；字符比例仅作粗粒度交叉检查 | [`token-count-rules-c0a4b85.json`](../evidence/token-count-rules-c0a4b85.json)；[DeepSeek Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage/) | `transformers 4.57.6 / tokenizers 0.22.2` 下 7/7 回环通过；raw corpus-only = 18,680 estimated tokens；5.16.1 兼容性失败结果已拒绝 | 排除特殊 token 与 prompt/context assembly；不能用包内 `model_max_length` 替代模型窗口来源，也不能替代完整请求的 provider `usage` |
| eval / dev-holdout | 待填写 | 待填写 | 待填写 | 待填写 |
| RAG Prompt | 待填写 | 待填写 | 待填写 | 待填写 |
| 全语料上下文基线评测 | 待填写 | 待填写 | 待填写 | 待填写 |
| 仓库 Markdown 扩展语料 | 待启动、完成或明确不进入主线 | 待填写 | 待填写 | 待填写 |

## 6. 自动顺延规则

- 术语仍不清楚：停在对应概念组继续讲解，不用猜测换取后续清单进度。
- snapshot 未冻结：D2 第一入口继续 snapshot，BM25 不开始。
- 上下文容量未确认：不运行全语料上下文基线，不用历史字节数替代。
- eval 或 RAG Prompt 未由本人冻结：不运行 baseline，AI 不代填以推进进度。
- 全语料上下文基线评测没有实际 baseline 或完整的容量不可行证据：D2 第一入口先完成该评测；删除 D2 的
  变量对照，不叠加原任务。
- 仓库 Markdown 扩展语料未启动或未形成完整版本：不进入 W13 必做对照，也不顺延占用 D2-D5；以后重启时建立并标明独立版本。

## 7. D1 明确不做

- 不实现 BM25、dense retrieval、chunking、ranking 或 context assembly。
- 不安装 ONNX Runtime、embedding 模型或提前验证 dense runtime；这些工作留在 D4 术语讲解之后。
- 不运行 holdout，不查看 holdout 运行结果，不根据 holdout 选择方案或调参。
- 不实现 hybrid/RRF、reranker、向量数据库或 GraphRAG。
- 不开始 W14 Agent、tool contract、loop、trace、verifier、MCP 或 session memory。
- 不新增 UI、展示板、Docker/CI 或部署。
- 不为追求完成数量跳过术语解释、本人冻结或证据记录。
- 不自动 commit、push 或 merge。

## 8. D1 收尾清单

> 当前为执行中，空框表示待做。D1 收工时必须勾选，或在同一行写明实际结果与去向。

- [ ] 五组术语均在对应任务开始前完成讲解，未把新术语作为本人已知前提。
- [x] source commit 与开工时工作树边界已确认；snapshot、现行模型 ID 修正与此前笔记记录已提交于
  `255357d`，本轮 prompt cache 追问回填尚未提交。该提交未运行全语料上下文 baseline。
- [x] 规则文档语料 snapshot 在第一道 eval 题之前冻结，manifest、逐文件回比与敏感内容检查有证据。
- [ ] token 计量方法与不确定性已记录；估算结果和 provider usage 未混写，上下文容量结论有明确适用范围。
- [ ] eval 题目、标签、指标、阈值和通过标准由本人冻结；holdout 保持未运行。
- [ ] W13 RAG Prompt 由本人独立版本化，未复用 W12 信息提取 Prompt 冒充 RAG Prompt。
- [ ] 全语料上下文基线评测已完成：完整规则文档语料 baseline 已运行，或容量不可行证据可复核。
- [ ] RAG 必要性结论同时写明支持范围与不能支持的结论。
- [ ] 仓库 Markdown 扩展语料已按实际状态记为完成、未启动或不进入主线，没有与规则文档语料结果混写。
- [ ] 当天事实、推断、待验证和未完成去向已分开记录。
- [ ] `week13-plan.md` 与 `LEARNING-STATE.md` 已按实际结果更新；是否 commit 由本人决定。

## 9. AI 辅助记录

> 9/7 执行中：AI 以导师模式完成 D1 链路与 A 组术语讲解；本人复述 corpus/snapshot、冻结顺序与
> 全语料上下文基线不含 retrieval 的原因。本人确认七文件范围与 source commit 后，AI 以白名单机械处理
> 从 Git object 提取 snapshot、生成 manifest，并验证 7/7 文件的字节、SHA-256、Git blob 与来源内容。
> 尚未设计 eval、RAG Prompt、context budget、检索方案或核心断言，未提供黑名单 L2，不新增债务。
