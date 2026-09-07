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

#### B. 模型输入容量

| 术语 | D1 中的含义 | 需要区分 |
|---|---|---|
| 词元（token） | 模型和 tokenizer 处理文本时使用的计量单位 | byte、字符和 token 不能互相直接换算 |
| 分词器（tokenizer） | 把文本转换为 token 序列的具体实现 | 不同模型或版本可能得到不同 token 数；生成模型未必公开精确 tokenizer |
| 用量字段（usage） | 模型服务在真实请求结果中返回的输入、输出等用量记录 | 它是该次请求的运行证据，不自动给出整个 corpus 的离线计量结果 |
| 上下文窗口（context window） | 一次模型请求可容纳输入与输出的总 token 上限 | 它不是全部都可分配给 corpus |
| 上下文预算（context budget） | 从窗口中为 corpus 或 retrieved context 预留的可用部分 | 还要给 instructions、query、输出和安全余量留空间 |
| 上下文容量检查 | 检查指定输入能否放入已经冻结的预算 | “文件不大”不能替代有方法和边界的 token 计量 |

#### C. 评测与对照

| 术语 | D1 中的含义 | 需要区分 |
|---|---|---|
| 评测（evaluation，eval） | 用预先定义的输入和判据检查系统行为 | 运行成功不等于回答正确 |
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
| 证据约束生成（grounded generation） | 要求回答受给定 context 中的证据约束 | 模型语言流畅不表示有证据支持 |
| 引用（citation） | 回答指向实际使用的冻结来源位置 | 模型输出一个看似真实的路径不等于引用有效 |
| 拒答（abstention） | 证据不足或超出范围时明确不作无依据回答 | 拒答不是运行错误，也不等于所有不回答都正确 |

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
| 资料与版本 | 本人能区分 corpus 的逻辑范围与 snapshot 的固定实验输入；追问 manifest/eval，并修正“冻结导致无 retrieval”为“全量输入不筛选子集” | A 组已完成；eval 只讲了定义，完整 C 组仍待执行 |
| 模型输入容量 | 本人能区分 context window 的模型总容量与 context budget 的实验分配；提出“主流模型大多为 1M”的经验判断 | B 组执行中；广泛判断未冻结模型范围、未核实，不作为事实入档；token/tokenizer/usage 仍待确认 |
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

### 4.4 运行 token 计量并检查上下文容量

- [ ] 执行前完成 §2.2 B 组讲解，能区分 byte、token、估算值、provider usage、context window 与
  本人分配的 context budget。
- [ ] 查证并记录目标生成模型与 context window 的来源；它是外部事实，不由本人自行设定。
- [ ] 记录目标生成模型是否提供公开且可复现的精确 tokenizer。
- [ ] 若精确 tokenizer 可用，使用它计量实际 snapshot；若不可用，明确记录所用估算方法及误差边界，
  并在真实请求后把 provider 返回的 usage 作为单独运行证据。估算值不得写成精确 token 事实。
- [ ] 保留规则文档语料 snapshot 的实际结果，不把历史字节数或尚未启动的仓库 Markdown 扩展语料候选范围混入。
- [ ] 本人冻结为 instructions、query、输出和安全余量保留的部分，据此得到可用 context budget。
- [ ] 判断规则文档语料是否可以完整进入模型上下文；请求超限时不静默截断或改称全量。

**前置条件**：context window 来源、token 计量方法、计量对象和 context budget 未记录，不运行全语料上下文基线。

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
| token 计量方法 / token count | 待填写 | 待填写 | 待填写 | 待填写 |
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
- [x] source commit 与开工时工作树边界已确认；开工后新增 snapshot 与本笔记记录，均未提交。
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
