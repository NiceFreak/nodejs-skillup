# AI Engineer Reskill 五周总计划（W12-W16）

> 建立：2026-08-31（Asia/Shanghai）。
>
> 修订：2026-09-01。W13 增加全语料上下文基线评测与 RAG 必要性判断，W14 增加非 Agent 基线与 OpenAI Agents SDK
> 职责对照；自建 RAG 与 harness 明确为教学实现，不扩展为生产框架。
>
> 修订：2026-09-06。W13 最低成果补充为可重复运行的 BM25 端到端 RAG，D4 收工前完成稳定 demo；
> W13 规则文档语料按 W12 D5 本人确认的七份规则文档执行；移除没有跨厂商统一含义的 A/B/C 语料分级，
> 改为按内容与范围直接命名。每日任务见
> [`week13-plan.md`](../week13-rag/notes/week13-plan.md)。
>
> 修订：2026-09-08。Python 作为 AI 主链交付语言，TypeScript 用于 Pi/OpenCode 等原生工具与源码对照。
> W13 使用 LangChain 完成固定 RAG、BM25/dense 同集对照和首次 holdout；W14 使用 LangGraph 完成 agentic
> workflow。自定义实现缩为框架无关契约、可解释基线和必要 adapter；AI 可在本人冻结语义后实现并自测。
>
> 简洁执行表与按周参考链接见
> [`AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`](./AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx)。
>
> 本计划替换 2026-08-28 建立的 W12-W13 两周版方向。当前五周目标主线是 Python、RAG、AI Agent 与 MCP；既有 Node.js 全栈、MongoDB、
> AWS、Jenkins 和部署经验作为工程基础，不在本轮重复学习。
>
> 本文件定义五周能力结构、周间接口与范围上限。当周每日任务和唯一验收句仍由对应
> `weekN-*/notes/weekN-plan.md` 在周初冻结。标为「待本人落定」的正确性判断不由 AI 预填。

## 1. 已确认事实、决定与待验证项

### 1.1 已确认事实

- 本机是 `x86_64` Intel Core i7-1068NG7（4 核 8 线程）、32 GB 内存和集成显卡。Python 服务与
  小语料检索可实践；小型 CPU embedding 只确认具备小样本试验条件，安装兼容性、全量速度与质量仍需
  W13 D1 实测。本地大模型训练、GPU 推理和本地生成模型不进入主线。
- 当前系统 Python 是 3.9.6；Bub 当前项目约束要求 Python 3.12+。本轮使用项目级 Python，
  不替换系统 Python。
- 实际可用的 coding-agent 包括 VS Code Codex、Cline 与 Pi。Codex、Cline 与 Pi 可以滚动更新；OpenCode
  当前作为候选工具和源码参考。每次实验记录观察当时的版本或 source commit，不把某个安装版本固定为
  五周运行前提。Claude Code 不作为本机 hands-on 或验收依赖。
- `rg --files -g '*.md'` 在 2026-08-31 返回 138 个 Markdown，合计 2,672,927 bytes。
  该字节数不能直接推出 token 数；W13 使用实际选定模型或 tokenizer 重新测量。
- Agent 通用契约已由 `week7-ai/notes/single-agent-harness-lab-plan.md` 与 `BACKLOG.md` P0-2 冻结。
  终止状态集合、trace 原则、context/state/trace 分层、grader 优先级和安全边界不重新推导。
- 主模型 provider 沿用 DeepSeek，当前模型名使用 `deepseek-v4-flash`。具体 alias 所指模型快照、
  thinking 配置和 API 行为在运行 trace 中记录。
- DeepSeek Responses API 当前支持 function tool，但兼容表明确将内建 `mcp` tool 标为忽略；W15
  使用 MCP Python SDK 直接完成协议实践，不把 Responses API 当作 MCP 接入层。
- 当前 DeepSeek 官方 API 文档未提供 embedding endpoint 或 embedding model；dense retrieval 需要
  本地 embedding 或另一家 API。
- MCP 当前稳定规范是 `2026-07-28`。该版本移除了协议级 session 与 `initialize` 握手，采用
  `server/discover` 和每请求 `_meta`；`2025-11-25` 及更早版本保留为兼容性对照。
- 2026-09-25 是中秋假期，2026-10-01 至 10-07 是国庆假期。本计划不使用假期时间完成主线。

### 1.2 已拍板

- 五周顺序固定为 Python -> RAG -> Agent -> MCP -> reliability。
- Python 是 RAG、Agent、MCP 与 eval 主链的交付语言；TypeScript 用于 Pi/OpenCode 源码、原生 tool/extension
  与跨语言互操作。同一能力不做双语言复刻。
- 贯穿场景继续使用只读 Requirement Grounding Agent；目标是掌握，不是产品展示。
- W12 深读 Bub，但必修只覆盖 turn 生命周期、tape -> context 主链与 model/tool/harness 职责边界；
  hook 只跟主链实际经过的注册与调用，channel/provider 扩展不进入必修。DeepSeek Harness 不再进入五周主线。
- W13 embedding 默认以 `intfloat/multilingual-e5-small` 做 Intel CPU 多语言基线；
  `BAAI/bge-small-zh-v1.5` 只作中文回退候选。先测代表性小样本，只有原生 x86 runtime、速度、内存
  或质量不满足门槛时才换候选或使用 embedding API；`bge-m3` 不作为默认下载或主线依赖。
- W14 先保留非 Agent 固定 workflow 基线，再用 LangGraph 实现 agentic workflow，并保留 60-90 分钟
  OpenAI Agents SDK 职责对照，说明不同 SDK 接管了哪些 runtime 能力。真实 SDK run 只在凭据与网络可用时
  执行；失败即停止，不写 adapter，也不把运行成功作为 W14 验收依赖。
- W13 使用 LangChain Python 承载固定 RAG 的 `Document`、retriever、embedding/vector store 与模型接线；
  不允许框架改变已冻结的 source identifier、citation registry、`model_content`、Prompt/schema 或 eval。
- W14 使用 LangGraph Python 承载 state、node、edge、conditional edge 与 tool loop；先保留同题固定 workflow
  基线，再验证动态检索是否解决基线未解决的问题。LangGraph hands-on 不等于准确率必然提高。
- Prompt engineering、Agent memory、MCP/Skills 安装与运行调度、AI SDLC 作为横切必修能力嵌入
  W12-W16，不新增第六条主线或独立项目。
- VS Code Codex 与 Cline 都完成 W12 同题 hands-on；本人答案冻结前，两端都不得介入。W13-W16 将 Pi 作为
  滚动更新的 TypeScript 工具与源码参考，OpenCode 作为候选工具和源码参考；具体工具实验按当时可用版本记录。
- W12 D2（9/1，原定 D1）记录两个扩展的版本、provider、权限和规则来源。Codex 与 Cline 都应识别根
  `AGENTS.md`；不安装、升级或排障 Claude Code。
- 临时增加的假期学习时间只回填 stretch，不扩大主线。
- 不安排 Azure、OpenShift、前端、面试材料或展示型产品。

### 1.3 待运行验证

- 仓库 Markdown 扩展语料快照在 DeepSeek 与 embedding tokenizer 下的实际 token 数。
- 中文 BM25 的预处理方案及其在 dev 集上的行为。
- `multilingual-e5-small` 的原生 macOS x86 runtime 可安装性，以及在 Intel CPU 上的冷启动、代表性
  chunk 吞吐、查询 p50/p95、峰值 RSS、全量耗时估算和检索质量；fp32 与量化 ONNX 是否值得对照由
  同一冻结小样本实测决定。
- DeepSeek V4 thinking mode 与 function calling 的组合行为。
- MCP Inspector 官方文档已覆盖现代/旧版协商；本机版本、Node 前提与自建 server/client 的实际消息流
  仍需现场验证。
- OpenAI Agents SDK 的真实运行行为；凭据或网络不可用时只完成职责对照，并明确标为未运行验证。
- LangChain 与 LangGraph 当前版本同 DeepSeek OpenAI-compatible endpoint、冻结 response schema 和本机
  Python 3.12 的实际兼容性；未运行前只记录官方接口能力，不宣称本项目已经可用。
- VS Code Codex 与 Cline 连接自建 stdio server 时实际协商的协议版本和产品行为。产品客户端调用成功
  只证明互操作，不证明使用了 MCP `2026-07-28`；协议结论以 Python SDK 抓取的原始消息为准。

## 2. 五周能力目标

五周结束时，本人应能：

1. 阅读、修改和诊断中等复杂度的 Python AI 工程代码。
2. 解释 RAG 的 ingestion、预处理、检索、上下文构造、生成与评估边界。
3. 使用 LangChain 完成固定 RAG，并指出框架组件与本项目 source/citation/eval 契约的映射。
4. 使用 LangGraph 完成只读 agentic workflow，并解释 state、node、edge、tool、trace 与 verifier 的职责。
5. 区分模型、retrieval、tool、harness、MCP protocol 和 verifier 的职责与失败。
6. 从原始消息解释 MCP 新旧协议、server/client/host、transport 与错误语义。
7. 对同一任务执行多 trial、故障注入与确定性回归，不用单次成功代替可靠性结论。
8. 把 Prompt 作为可版本化、可评测的工程输入，区分 Prompt、检索、工具描述与模型失败。
9. 区分工作上下文、session state、持久 memory、RAG knowledge 与 trace，并解释隔离、保留、压缩、
   重置和删除策略。
10. 解释 MCP 与 Skills 的发现、安装、配置、信任和生命周期，以及前台、后台、定时、并发、重试、
   幂等和取消分别由哪一层负责。
11. 使用 Codex 及至少一种其它 coding agent，并走完一次有规格、权限、review、测试/eval、回滚与
    版本证据的 AI-assisted SDLC。

验收标准继续使用仓库已有定义：跑通只证明一次执行成功；掌握需要口述、合理修改、故障诊断和延迟重建。

### 2.1 框架实践与生产边界

- W13 的 LangChain 固定 RAG 与 W14 的 LangGraph agentic workflow 是必修 hands-on，不以阅读或概念对照
  代替。二者共享冻结任务、RAG 组件和 eval，以便比较职责而不是比较不同输入。
- 自定义 RAG 代码只保留 source/citation/serialization 契约、全语料上下文基线、可解释 BM25 对照或框架
  adapter；不实现向量数据库，也不复刻 LangChain 的通用抽象。
- 自定义 Agent 代码只保留非 Agent 固定 workflow 基线、外部 verifier/replay 等 LangGraph 外部确定性边界；
  不复刻通用 Agent framework、多 provider 抽象或 multi-agent orchestration。
- 本地实验只能证明指定版本、冻结语料和 eval 下的行为，不写成 production-grade AI experience。生产项目
  仍应根据领域约束、可观测性、部署和维护成本选择框架或自定义组件。
- DeepSeek 继续作为主模型 provider；Bub、Pi 与 OpenAI Agents SDK 用于实际工具体验、源码或职责对照，
  OpenCode 当前作为候选工具与源码参考；不要求复制其架构。

### 2.2 横切必修能力

| 能力 | 必须理解 | 最低 hands-on 放置 | 范围边界 |
|---|---|---|---|
| Prompt engineering | 指令层级；identity/instructions/examples/context 分区；结构化输出；grounding、citation、abstention；prompt injection；版本与回归 | W12 建 `prompt v0`；W13 区分检索失败与提示词失败；W14 对冻结 dev task 只改变一个 prompt 因素并重跑 eval；W16 做 prompt regression | Prompt 内容、样例和通过判据由本人确定；不以主观「感觉更好」替代冻结 eval |
| Agent memory management | 当前 context、session state、跨 session durable memory、RAG knowledge、trace 的职责差异；token budget、compaction/eviction、TTL、隔离、reset/delete、数据最小化、陈旧与投毒 | W14 完成有界 session state 的 read/write/reset/isolation 实验并观察一次 context 压缩或淘汰；W16 注入 stale durable-memory fixture 或跨 session state 泄漏并验证处置 | 不新增持久或向量 memory 服务；RAG 不自动等同 memory；验收确定性状态行为，不把模型复述差异作为通过标准 |
| 能力安装与运行调度 | MCP/Skill 的发现、local/project/user scope、版本、权限、信任、启停、升级与卸载；foreground/background/recurring/batch、并发、重试、幂等、取消与观测 | W15 将同一只读 MCP server 接入 Codex，并在 Cline/Pi/OpenCode 中至少选一端做互操作；完成一个小 Skill 的发现、触发、禁用和移除。W16 复用 multi-trial runner 观察有界并发、重试、取消和幂等 | 调度属于 harness/orchestrator，不属于 MCP core；产品工具只证明互操作，不代替 Python SDK 原始消息验收；不引入新调度服务 |
| AI SDLC 与 coding agents | explore/spec -> acceptance/eval -> context/permission -> plan -> change -> diff review -> deterministic tests + model eval -> security/privacy/dependency review -> release/rollback -> provenance | W12 本人先独立作答并冻结，再由 Codex/Cline review；W13-W16 允许 AI 按冻结契约实现，本人 review、修改或诊断；W16 让一个小型变更走完完整闭环 | Python 是主链交付语言；Pi/OpenCode 原生 tool/extension 可用 TypeScript；日用工具滚动更新，证据记录当时版本；不以生成代码量为目标 |

## 3. 五周排期

| 周次 | 日期与有效容量 | 主线 | 周最低交接物 |
|---|---|---|---|
| W12 | 8/31-9/4；8/31 用于本计划评审，有效 4 天（9/1-9/4） | Python 迁移增量、Bub 深读、真实模型客户端 | 可运行 Python 项目、Bub 报告、timeout/cancellation、`prompt v0`、VS Code Codex/Cline 同题只读任务 |
| W13 | 9/7-9/11，5 天 | LangChain 固定 RAG、BM25/dense 与 retrieval eval | 冻结 corpus/eval、LangChain BM25/dense RAG、grounding/citation/abstention、首次 holdout |
| W14 | 9/14-9/18，5 天 | LangGraph agentic workflow、trial 与 trace | 非 Agent 基线、LangGraph 只读 tool/state、脱敏 trace、verifier、prompt 对照 |
| W15 | 9/21-9/24，4 个常规学习日 | MCP 2026-07-28、旧版互操作、server/client | stdio tools/resources、新旧消息 diff、一次 MCP/Skill 生命周期实践 |
| W16 | 9/28-9/30，3 天 | 端到端串联、故障注入、回归与重建 | 全链路、prompt/memory 回归、调度观察、AI SDLC 闭环 |

`9/20` 不作为主线容量前提；如可用，只处理 W15 stretch。

## 4. 每周范围

### W12：Python for AI Engineering

**目标**：通过真实 Python Agent 项目建立阅读、修改、异步控制和故障诊断能力。

**必修**：

- 项目级 Python 3.12、依赖锁定、包/import、pytest 和类型检查入口。
- TypeScript -> Python 迁移增量：typing/Protocol、Pydantic/dataclass、异常传播、context manager、
  sync/async 边界。装饰器、生成器等只在 Bub 调用链实际遇到时学习。
- Bub 的 turn 生命周期、tape -> context rebuild 与 model/tool/harness 职责；hook 只跟主链实际经过的
  注册与调用，channel/provider 扩展为选修。
- 一次真实 DeepSeek 调用和一次最小工具调用；timeout 与 cancellation 各真实触发一次。
- 一份版本化 `prompt v0`，明确 instructions、input、examples、context 与 output schema 的边界。
- 对同一只读代码导航/review 任务，本人先独立作答并冻结，再交给 VS Code Codex 与 Cline；两个扩展
  的对照总计不超过 60-90 分钟，不能反向污染本人验收。

**不做**：RAG 实现、DeepSeek Harness 通读、完整 Agent loop、MCP、UI。

**验收方向**：本人在 D2（9/1，原定 D1）冻结一条可证伪验收句；AI 可提供未见过的 Python 诊断材料
作为验收题，但不提前提供答案。

### W13：RAG Foundations

**目标**：在冻结语料和留出题集（holdout set）上分离 retrieval 与 generation 的质量、成本和延迟，
并使用 LangChain 实现、解释和评测一条可重复运行的固定 RAG 链路。

**最低成果**：先冻结全语料 Evidence Context 的确定性输入契约，再在同一 snapshot 与 dev set 上完成框架无关
的全语料上下文基线，以及 LangChain BM25 和 dense 两条固定 RAG 链路。三者共享 Prompt/schema、context
assembler 和 eval。只有 Prompt、组装规则、BM25/dense 配置、eval、评分规则和实现全部冻结后，才首次运行
holdout；首次结果不得反向用于调参，后续只按预先冻结的 regression 节点复跑。具体题目、判据、Prompt
内容、数据结构与核心断言仍由本人冻结。

**RAG 必要性判断**：完成语料快照和 token 计量后，先对能放入目标模型上下文的语料运行全语料上下文基线。
若该基线已达到本人冻结的任务门槛，仍可继续 BM25/dense 作为受控学习对照，但结论必须写成
「教学实验」，不能据此宣称当前场景在生产上必须采用 RAG。

**语料范围**：

- 规则文档语料：W12 D5 由本人确认的七份约束与规则文档，是 D1-D5 的必做 corpus；全语料上下文基线、BM25 与
  dense 对照使用同一个规则文档语料快照。清单见 W13 周计划 §2.1。
- 仓库 Markdown 扩展语料：冻结 commit 下的 tracked Markdown 减显式排除清单，是独立版本的条件扩展，不是 W13 核心
  demo 的前提。只纳入单独 manifest 的显式 allowlist；`corpus/` 自身、题库与答案、W13 起的进行中笔记及
  allowlist 外路径均不读取；
  若启动，必须在建立依赖它的 eval 前单独冻结，不与规则文档语料结果混写。
- MCP 新旧规范不属于 W13 corpus，只在 W15 作为版本冲突与协议学习材料，不为它建立语料层级。

快照必须在第一道 eval 题建立前完成，并记录来源 commit、排除规则、文件清单、字节数和 token 数。

**必修**：

- LangChain `Document`、retriever、embedding/vector store 与模型接线；框架层不得改变冻结的 source ID、
  citation、serialization、Prompt/schema 或 eval 契约。
- 全语料上下文基线的效果上限、中文 BM25、dense retrieval。
- ingestion、chunking、metadata、citation、abstention 和 context budget。
- grounding prompt 与引用/拒答约束；失败分析必须区分 retrieval miss、context assembly、prompt 与 generation。
- RAG 是按需检索的外部知识来源，不把索引或检索结果直接称为 Agent 的 session/durable memory。
- dev/holdout 隔离；首次 holdout 只在全部配置与实现冻结后运行，不以该结果调参；W16 只按事先冻结的
  regression 规则复跑。
- 逐题失败分析，以及质量、延迟和 token 成本记录；只有实际层暴露 cache hit/miss 时才记录命中与成本，
  未启用或不可观察时明确记为不适用或不可观察。
- 从本周开始执行 eval-driven development：每次 retrieval、chunk、prompt 或模型变更都复用同一冻结
  dev 集并记录差异；W16 负责回归收口，不是 eval 的首次引入。

**条件项**：BM25 与 dense 各自可用、D4 demo 已稳定且不改变 D5 入口时，才考虑 hybrid/RRF。
reranker、向量数据库和 GraphRAG 不进入主线。

**Intel CPU 门禁**：默认候选是 `intfloat/multilingual-e5-small`；按模型卡使用 `query: ` / `passage: `
前缀、归一化向量，并记录 512-token 截断。`BAAI/bge-small-zh-v1.5` 只作中文回退，不用 `bge-m3`
起步。macOS x86 的 PyTorch 官方二进制停留在 2.2 版本线，ONNX Runtime 也已停止新版本的 macOS x86
二进制支持；PyPI 发布物核对到 `onnxruntime==1.23.2` 与 `torch==2.2.2` 均有 CPython 3.12/macOS x86_64
wheel。W13 复用项目 Python 3.12，以 ONNX 1.23.2 + 发布者 fp32 模型文件为首选，Torch 2.2.2 只作
兼容回退；真实安装与 wheel/hash 冻结统一放在进入 dense 阶段时，并在相关术语讲解后执行。
不允许解析到无 x86 wheel 的新版本，也不做源码编译。
先在同一冻结 chunk/query 小样本跑 fp32 正确性基线；量化 ONNX 仅在兼容文件可用时做同集对照，记录
模型 revision、文件、provider、线程、batch、token 长度/截断、冷启动、吞吐、查询 p50/p95、峰值 RSS
和质量，再估算仓库 Markdown 扩展语料全量时间。若安装失败、持续 swap/明显系统卡顿、全量估算超过本人冻结的最大可接受运行成本、
查询延迟不可交互或质量不过线，则停止本地 dense 排障并改用 embedding API；BM25 与冻结 eval 保留。
未形成一次可重复 dense 对照时，W13 不判定完整验收通过，也不把 dense 写成已掌握；可将它作为明确阻断带入
W14 的最低接口工作，但不得被 Agent 新内容掩盖。不为证明「本地部署」挤占 retrieval/eval 主线，CPU 上不使用
fp16/bf16 作为加速假设。

题目、标签、指标、阈值与通过标准属于本人语义所有权，必须由本人冻结；AI 可在确认后机械落盘和验证。

### W14：LangGraph Agentic Workflow

**目标**：先用非 Agent 基线验证任务是否需要动态工具决策，再用 LangGraph 把既有通用契约映射到
Python + RAG 场景中的最小可观察运行，不重复设计已经冻结的部分。

**继承**：终止状态集合、trace 原则、context/state/trace 三分、grader 优先级、安全与密钥边界。

**delta**：Python 运行时、文档语料、RAG 子系统、`clarification_required`、prompt 版本关联，以及有界
session state 的隔离、reset 与 context 淘汰观察。它们不改变已冻结的终止、工具、trace 与 verifier 通用契约。

**仍由本人冻结并验收**：任务级工具语义、预算数值、停止与停滞判据、verifier 判据、eval task 和核心断言。
AI 可以在这些语义确认后完成 LangGraph wiring、测试与机械记录；本人必须 review 数据流，并至少完成一次
相关修改或故障诊断。

**必修**：

- 对同一冻结任务先运行「单次模型调用 + retrieval」或固定 workflow 基线；只有冻结 eval 能显示动态
  工具选择解决了基线不能解决的问题，才把 Agent 作为该任务的必要架构。未证明时仍可完成教学实现，
  但结论必须保留该边界。
- structured output、function calling、工具参数验证、工具失败、取消与权限边界。
- system/developer prompt、工具描述与输入上下文的边界；在冻结 dev task 上只改变一个 prompt 因素，
  重新运行相同 eval 并保留前后版本。
- 有界 session state 的 write/read、隔离与 reset，以及 context token budget；观察一次 compaction 或
  eviction。durable memory 只学习 write/read/delete、TTL、数据最小化和陈旧/投毒边界，不在本周持久化实现。
- LangGraph state、node、edge、conditional edge 与 tool loop；JSONL trace、确定性 replay、外部 verifier
  和多 trial。
- DeepSeek V4 thinking/function calling 的真实行为验证。
- LangGraph 主链完成后，用 60-90 分钟对照 OpenAI Agents SDK 的 loop、state continuation、tool execution、
  handoff/approval 与 trace 职责；对照结果不要求新增 adapter 或第二套实现。

**条件项**：凭据与网络可用时运行一个最小 OpenAI Agents SDK 单工具任务；不可用时保留错误证据，职责
对照照常完成，并把真实 SDK 行为标为未验证。

W14 的 prompt 单变量对照 + session state/context 实验合计 timebox 半天；超时先砍真实 SDK run 与
额外 context 实验，不挤压非 Agent 基线、LangGraph、trace/verifier、多 trial 和 SDK 职责对照主线。

### W15：MCP 2026-07-28 与兼容性

**目标**：从消息层解释当前 MCP，并通过一次旧版兼容对照理解两代协议的差异。

**必修 hands-on（现代协议）**：

- host/client/server 与 JSON-RPC 请求、响应、通知。
- `server/discover`，以及每请求 `_meta` 中的协议版本和 client capabilities。
- stdio、tools discovery/call、resources list/read 与自建 client；Inspector 本机版本兼容时并行检查，
  不兼容时记录结果，不替代自建 client 验证。
- `UnsupportedProtocolVersionError`（`-32022`）和现代错误码分区。

**兼容对照 hands-on 一次**：

- 使用同一 `tools/call` 分别抓取 `2026-07-28` 与 `2025-11-25` 消息流。
- 对照现代 `server/discover`/per-request metadata 与旧版 `initialize`/session/capability negotiation。
- Python SDK client 使用默认 `auto` 探测现代协议；`legacy` 模式只用于强制旧版兼容实验。

**必须理解**：

- MRTR、所有 result 的必填 `resultType`、`input_required` 中间态与 `subscriptions/listen`。
- JSON-RPC protocol error、tool result `isError`、MRTR 中间态三层语义。
- `ttlMs`/`cacheScope`、实现自定义 `-32000..-32019`、规范保留 `-32020..-32099`、
  resource not found 使用 `-32602`，以及 Streamable HTTP 当前形态。

**认知**：tasks 扩展、Client ID Metadata Documents、HTTP+SSE deprecated、现代 HTTP 断流不再使用
`Last-Event-ID` 重放、OpenTelemetry `_meta` 传播。roots、sampling、protocol logging 只学习 deprecated
状态与迁移路径；`ping`、`logging/setLevel` 已移除，不为新实现增加依赖。

**安装与生命周期实践**：

- 理解 MCP 与 Skill 的不同职责，以及 local/project/user scope、来源信任、版本冻结、权限、启用、禁用、
  更新和移除。
- 将同一只读 stdio server 注册到 Codex，并在 Cline 或 Pi 中至少选一端完成发现、一次调用、禁用和移除；
  记录工具版本、配置 scope、权限提示、日志和实际能力。使用到的客户端确认根 `AGENTS.md` 已作为项目规则来源。
  产品客户端只用于互操作与生命周期观察，不代替 Python SDK 的协议消息验收。
- 检查一个已有的小型 Skill 的 `SKILL.md` 与资源加载边界，完成本地安装或注册、触发、禁用和移除；
  优先在 VS Code Codex 执行；Cline 当前扩展若已提供 Skills 面板再做同项对照，不为升级或缺失功能延长
  排障。不开发复杂 Skill，不把 Skill 当作 MCP server。产品客户端与 Skill 生命周期实践合计 90 分钟。

### W16：Reliability、Evals 与综合重建

**目标**：在三天内收口从 W13 开始积累的 eval、trace 与组合链路回归，验证可观察性和可归因性，
不新增产品功能。

- D1：连接 RAG、Agent 与 MCP，冻结可重复基线；记录 prompt/memory 版本关联与调度基线。
- D2：执行本人设计的故障注入并完成分层归因，覆盖 stale memory 或跨 session 泄漏，以及重试、取消、
  幂等中的至少一条失败路径。
- D3：按 W13 冻结规则复跑 holdout regression 与 prompt regression，完成确定性重建、事实收口与下一入口。

三天内用 60-90 分钟复用一项小型白名单变更走完 AI SDLC：先写规格和可证伪验收，再限定上下文与权限，review AI diff，
运行确定性测试和相关 eval，检查数据边界、依赖与 trace，最后记录发布或不发布判断、回滚方法和版本来源。该练习
复用综合链路，不新建产品，也不以生成代码量作为验收。

LangGraph/SDK 职责对照已在 W14 收口；direct tool/MCP 对照已在 W15 收口，W16 不重复执行。
FastAPI、Docker/CI 和 UI 均不属于三天主线。额外时间只回填这些 stretch，不新增必修项。

## 5. 周间接口与防级联规则

- W12 -> W13：Python 项目与模型 client 可运行、`prompt v0` 已版本化、VS Code Codex/Cline 同题任务完成
  即可；Bub 报告不阻塞 corpus 冻结。
- W13 -> W14：LangChain 上可重复运行的 BM25 端到端 RAG、冻结题集、citation/abstention 与失败归因证据
  是最低接口。dense 是 W13 完整验收项；若被运行环境阻断，可在明确记录未完成后进入 W14 的接口补齐，
  但不能静默删除或写成已掌握。
- W14 -> W15：一个 LangGraph 只读 retrieval tool + trace 落盘 + session reset/isolation 可验证即可；SDK 真实运行
  不阻塞 MCP，但 SDK 职责对照必须完成。
- W15 -> W16：stdio server + tools/resources 可调用即可；HTTP 与扩展能力不阻塞串联。

若最低接口未满足，下一周只修接口，不把上周全部未完成项平移。其余内容回到当周记录或 BACKLOG。

## 6. AI 协作与掌握证据

- 本人负责问题定义、架构与框架取舍、Prompt 变更假设、eval 语义与阈值、工具权限、正确性判据、核心断言、
  diff review、失败归因和最终验收。
- 上述语义冻结后，AI 可以实现 parser、retrieval、context assembly、LangChain/LangGraph wiring、MCP 胶水
  和测试，并按实现方标准提交等价环境自测证据；AI 生成实现本身不记学习债务。
- 每周掌握证据至少包含职责和数据流解释、实现 review，以及一次与当周主题相关的合理修改或故障诊断；
  不以空白手写代码量或单次运行成功作为验收。
- AI 在本人确认前代填语义、阈值、权限或核心断言时才按 `AGENTS.md` 记债并安排重建。

## 7. Trace 与版本证据

- 全量 trace 保存在 gitignored 本地目录。
- 仓库只保留脱敏代表样本；具体样本数量在 W14 D1 由本人冻结。
- 运行证据需关联模型 alias、当时解析到的版本/快照、thinking 配置、harness/Prompt/memory policy 版本
  和来源 commit；具体 trace schema 仍由本人冻结。
- corpus、Prompt、trace 与测试 fixture 只使用公开技术资料、仓库内可复现实验、合成样本和必要配置占位符；
  allowlist 外输入不读取或复制。密钥、真实凭据、可定位端点和本地绝对路径统一使用占位符。
- 项目依赖按 lockfile 固定并记录版本；Bub 等源码学习记录 source commit。Codex、Cline、Pi 等日用工具
  可以滚动更新，只记录实验当时观察到的版本并在升级后复核受影响结论；OpenCode 在实际采用前只记录参考来源。

## 8. 延迟重建

| 学习对象 | 延迟重建入口 |
|---|---|
| W12 Bub 与 Python 调用链 | W14 D1，15-20 分钟 |
| W13 retrieval 确定性数据流 | W15 D1，15-20 分钟 |
| W14 harness 确定性部分 | W16 D1，15-20 分钟 |
| W15 MCP 新旧协议主链 | 2026-10-12，15-20 分钟 |

W16 收口时将 MCP 重建日期写入 `LEARNING-STATE.md` 下一入口。重建只覆盖确定性部分，不把模型随机行为作为通过标准。

## 9. 砍范围顺序

时间不足时依次移除：

1. OpenAI Agents SDK 真实运行；60-90 分钟职责对照保留。
2. 本地量化生成模型。
3. MCP tasks、扩展与完整远程授权实践。
4. reranker。
5. hybrid/RRF。
6. Streamable HTTP hands-on。
7. FastAPI、Docker/CI 和任何 UI。

不可砍的周间最低交接：Python 复杂代码阅读与真实取消、冻结 corpus/eval、LangChain BM25 端到端 RAG、
LangChain dense 对照、首次 holdout、LangGraph agentic workflow、全语料上下文基线评测与 RAG 必要性判断、非 Agent 基线、
trace/verifier、多 trial、OpenAI Agents SDK 职责对照、MCP 现代 stdio tools/resources/client、故障归因
和延迟重建；一份版本化 prompt
及受控前后 eval；有界 memory 的隔离/reset 与故障注入；一次 MCP/Skill 生命周期实践；
一次小型白名单变更的 AI SDLC 闭环；W12 的 VS Code Codex/Cline 同题 hands-on。W15 产品客户端
至少完成一端互操作，另一端失败时保留诊断证据，不阻塞 Python SDK 协议验收。

W13 完整验收要求 dense retrieval 在同一规则文档语料快照与冻结题集上成功形成可重复对照，并在所有输入、
配置、实现与评分规则冻结后首次运行 holdout。若本地 runtime 与 API 路径均未形成成功运行，W13 只能判为
部分完成；稳定 BM25 端到端接口可满足 W14 的最低输入条件，但 dense 仍作为显式阻断补齐，不能写成已完成
或已掌握。holdout 不因日程压力提前运行，也不以首次结果反向调参。

## 10. 资料基线

完整的按周资料、用途与优先级见独立工作簿的 `References` sheet；下列链接只保留总计划的最小基线。

- [OpenAI Building Agents](https://developers.openai.com/tracks/building-agents)
- [OpenAI Running Agents](https://developers.openai.com/api/docs/guides/agents/running-agents)
- [OpenAI Retrieval](https://developers.openai.com/api/docs/guides/retrieval)
- [OpenAI Evaluation Best Practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [OpenAI Trace Grading](https://developers.openai.com/api/docs/guides/trace-grading)
- [OpenAI Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)
- [OpenAI Conversation State](https://developers.openai.com/api/docs/guides/conversation-state)
- [OpenAI Compaction](https://developers.openai.com/api/docs/guides/compaction)
- [OpenAI Codex Best Practices](https://learn.chatgpt.com/guides/best-practices)
- [OpenAI Codex IDE Extension](https://learn.chatgpt.com/docs/codex/ide)
- [OpenAI Build Skills](https://learn.chatgpt.com/docs/build-skills)
- [OpenAI Building an AI-Native Engineering Team](https://learn.chatgpt.com/guides/build-ai-native-engineering-team)
- [Anthropic Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- [Anthropic Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Cline Plan & Act](https://docs.cline.bot/core-workflows/plan-and-act)
- [Cline Skills](https://docs.cline.bot/customization/skills)
- [Cline MCP](https://docs.cline.bot/mcp/mcp-overview)
- [Cline Scheduling](https://docs.cline.bot/cli/scheduling)
- [Anthropic Agent Evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [LangChain Knowledge Base and RAG](https://docs.langchain.com/oss/python/langchain/knowledge-base)
- [LangGraph Workflows and Agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)
- [LangGraph Agentic RAG](https://docs.langchain.com/oss/python/langgraph/agentic-rag)
- [Pi](https://github.com/earendil-works/pi)
- [OpenCode Custom Tools](https://opencode.ai/docs/custom-tools/)
- [OpenCode MCP Servers](https://opencode.ai/docs/mcp-servers/)
- [MCP 2026-07-28 Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP 2026-07-28 Key Changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Python SDK Protocol Versions](https://py.sdk.modelcontextprotocol.io/protocol-versions/)
- [Bub](https://github.com/bubbuild/bub)
- [DeepSeek Models and Pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [intfloat multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small)
- [Sentence Transformers: Speeding up Inference](https://www.sbert.net/docs/sentence_transformer/usage/efficiency.html)
- [PyTorch macOS x86 Builds Deprecation](https://dev-discuss.pytorch.org/t/pytorch-macos-x86-builds-deprecation-starting-january-2024/1690)
- [ONNX Runtime 1.23.2 release files](https://pypi.org/project/onnxruntime/1.23.2/#files)
- [PyTorch 2.2.2 release files](https://pypi.org/project/torch/2.2.2/#files)
- [BAAI bge-small-zh-v1.5](https://huggingface.co/BAAI/bge-small-zh-v1.5)

## 11. 计划变更记录

- 2026-08-31：在两轮 AI review、仓库实测和官方资料复核后建立五周正式计划。
- 2026-08-31：吸收项目实践 review，将 Prompt、Agent memory、MCP/Skills 生命周期与调度、AI SDLC、
  coding-agent 使用作为横切必修能力嵌入既有五周；不新增周次或产品范围。
- 2026-08-31：按本人补充的真实环境，将工具 hands-on 修正为 VS Code Codex 与 Cline；Claude Code 和
  Codex App 不再作为运行依赖。W13 默认 embedding 改为 Intel x86 小样本可证伪试验，并加入 runtime、
  资源与退出门禁。
- 本次为 L1 规划与事实核对；未提供 Agent/RAG/MCP 黑名单核心逻辑的 L2 骨架，不新增学习债务。
- 2026-08-31（晚）：D1（8/31）全天用于本计划的评审与改建，W12 有效学习日改为 4 天（9/1-9/4）。
  W12 交付物不减，改排细节由 `week12-python-rag/notes/week12-plan.md` §3 承载；本文件只同步容量
  与决策冻结日（D1 -> D2）两处事实。
- 2026-09-01：按 Anthropic/OpenAI 官方工程资料复核学习路径。W13 增加全语料上下文基线评测与 RAG 必要性判断，并明确 eval
  从 W13 持续到 W16；W14 增加非 Agent 基线，将 DeepSeek Harness 抽样替换为 OpenAI Agents SDK
  职责对照。自建 RAG/harness 固定为最小教学实现，不新增通用框架、向量数据库、多 provider 抽象或
  multi-agent。该调整不改变五周顺序、日期和本人负责的正确性判断。
- 2026-09-08：按现实生态与五周目标重新审查载体和框架缺口。Python 保持 RAG/Agent/MCP/eval 主链，
  TypeScript 用于 Pi 与 OpenCode 等原生生态；W13 LangChain、W14 LangGraph 调整为必修 hands-on，恢复
  dense 与首次 holdout 的完整验收地位。自定义实现仅保留冻结契约、基线和 adapter。同步取消 AI Engineer
  阶段按手写代码量验收，改由本人语义冻结、review、修改/诊断和最终验收承担掌握证据。
