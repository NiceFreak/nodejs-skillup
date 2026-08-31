# AI Engineer Reskill 五周总计划（W12-W16）

> 建立：2026-08-31（Asia/Shanghai）。
>
> 简洁执行表与按周参考链接见
> [`AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`](./AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx)。
>
> 本计划替换 2026-08-28 建立的 W12-W13 两周版方向。变更原因是公司将 AI Engineer reskill
> 学习窗口扩展为五周。岗位主线是 Python、RAG、AI Agent 与 MCP；既有 Node.js 全栈、MongoDB、
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
- 实际可用的 coding-agent 界面是 VS Code Codex 扩展 `openai.chatgpt 26.5825.51511`（Darwin x64）
  与 Cline 扩展 `saoudrizwan.claude-dev 4.1.16`。Claude Code 受公司防火墙限制，Codex App 不支持
  本机 Intel 架构；二者均不作为 hands-on 或验收依赖。
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
- 贯穿场景继续使用只读 Requirement Grounding Agent；目标是掌握，不是产品展示。
- W12 深读 Bub；DeepSeek Harness 抽样移到 W14，并列入可砍范围。
- W13 embedding 默认以 `intfloat/multilingual-e5-small` 做 Intel CPU 多语言基线；
  `BAAI/bge-small-zh-v1.5` 只作中文回退候选。先测代表性小样本，只有原生 x86 runtime、速度、内存
  或质量不满足门槛时才换候选或使用 embedding API；`bge-m3` 不作为默认下载或主线依赖。
- OpenAI Agents SDK 只保留最多半天的 compatibility spike：单工具任务跑不通即停止，不写适配层，
  且不作为 W14 验收依赖。
- Prompt engineering、Agent memory、MCP/Skills 安装与运行调度、AI SDLC 作为横切必修能力嵌入
  W12-W16，不新增第六条主线或独立项目。
- VS Code Codex 与 Cline 都完成 W12 同题 hands-on；本人答案冻结前，两端都不得介入。
- W12 D2（9/1，原定 D1）记录两个扩展的版本、provider、权限和规则来源。Codex 与 Cline 都应识别根 `AGENTS.md`；
  不安装、升级或排障 Claude Code，不尝试绕过公司防火墙。
- 临时增加的假期学习时间只回填 stretch，不扩大主线。
- 不安排 Azure、OpenShift、前端、面试材料或展示型产品。

### 1.3 待运行验证

- Tier B 快照在 DeepSeek 与 embedding tokenizer 下的实际 token 数。
- 中文 BM25 的预处理方案及其在 dev 集上的行为。
- `multilingual-e5-small` 的原生 macOS x86 runtime 可安装性，以及在 Intel CPU 上的冷启动、代表性
  chunk 吞吐、查询 p50/p95、峰值 RSS、全量耗时估算和检索质量；fp32 与量化 ONNX 是否值得对照由
  同一冻结小样本实测决定。
- DeepSeek V4 thinking mode 与 function calling 的组合行为。
- MCP Inspector 官方文档已覆盖现代/旧版协商；本机版本、Node 前提与自建 server/client 的实际消息流
  仍需现场验证。
- OpenAI Agents SDK 与 DeepSeek Responses API 的实际兼容性。
- VS Code Codex 与 Cline 连接自建 stdio server 时实际协商的协议版本和产品行为。产品客户端调用成功
  只证明互操作，不证明使用了 MCP `2026-07-28`；协议结论以 Python SDK 抓取的原始消息为准。

## 2. 五周能力目标

五周结束时，本人应能：

1. 阅读、修改和诊断中等复杂度的 Python AI 工程代码。
2. 解释 RAG 的 ingestion、预处理、检索、上下文构造、生成与评估边界。
3. 区分模型、retrieval、tool、harness、MCP protocol 和 verifier 的职责与失败。
4. 实现并解释一个只读单 Agent harness 的确定性控制部分。
5. 从原始消息解释 MCP 新旧协议、server/client/host、transport 与错误语义。
6. 对同一任务执行多 trial、故障注入与确定性回归，不用单次成功代替可靠性结论。
7. 把 Prompt 作为可版本化、可评测的工程输入，区分 Prompt、检索、工具描述与模型失败。
8. 区分工作上下文、session state、持久 memory、RAG knowledge 与 trace，并解释隔离、保留、压缩、
   重置和删除策略。
9. 解释 MCP 与 Skills 的发现、安装、配置、信任和生命周期，以及前台、后台、定时、并发、重试、
   幂等和取消分别由哪一层负责。
10. 使用 VS Code Codex 与 Cline，并走完一次有规格、权限、review、测试/eval、回滚与
    版本证据的 AI-assisted SDLC。

验收标准继续使用仓库已有定义：跑通只证明一次执行成功；掌握需要口述、合理修改、故障诊断和延迟重建。

### 2.1 横切必修能力

| 能力 | 必须理解 | 最低 hands-on 放置 | 范围边界 |
|---|---|---|---|
| Prompt engineering | 指令层级；identity/instructions/examples/context 分区；结构化输出；grounding、citation、abstention；prompt injection；版本与回归 | W12 建 `prompt v0`；W13 区分检索失败与提示词失败；W14 对冻结 dev task 只改变一个 prompt 因素并重跑 eval；W16 做 prompt regression | Prompt 内容、样例和通过判据由本人确定；不以主观「感觉更好」替代冻结 eval |
| Agent memory management | 当前 context、session state、跨 session durable memory、RAG knowledge、trace 的职责差异；token budget、compaction/eviction、TTL、隔离、reset/delete、隐私、陈旧与投毒 | W14 完成有界 session state 的 read/write/reset/isolation 实验并观察一次 context 压缩或淘汰；W16 注入 stale durable-memory fixture 或跨 session state 泄漏并验证处置 | 不新增持久或向量 memory 服务；RAG 不自动等同 memory；验收确定性状态行为，不把模型复述差异作为通过标准 |
| 能力安装与运行调度 | MCP/Skill 的发现、local/project/user scope、版本、权限、信任、启停、升级与卸载；foreground/background/recurring/batch、并发、重试、幂等、取消与观测 | W15 将同一只读 MCP server 分别接入 VS Code Codex 与 Cline，并完成一个小 Skill 的发现、触发、禁用和移除。W16 复用 multi-trial runner 观察有界并发、重试、取消和幂等 | 调度属于 harness/orchestrator，不属于 MCP core；Cline 定时调度当前不适用于 VS Code 扩展，只作认知；不引入 Airflow、Celery 或新调度服务 |
| AI SDLC 与 coding agents | explore/spec -> acceptance/eval -> context/permission -> plan -> change -> diff review -> deterministic tests + model eval -> security/privacy/dependency review -> release/rollback -> provenance | W12 本人先独立作答并冻结，再让 VS Code Codex 与 Cline review 同一只读任务；W16 让一个小型白名单变更走完上述闭环 | 不以生成代码量为目标；「AI-assisted engineering」与无门禁 vibe coding 的差异由所有权、证据和质量门决定 |

## 3. 五周排期

| 周次 | 日期与有效容量 | 主线 | 周最低交接物 |
|---|---|---|---|
| W12 | 8/31-9/4；8/31 用于本计划评审，有效 4 天（9/1-9/4） | Python 迁移增量、Bub 深读、真实模型客户端 | 可运行 Python 项目、Bub 报告、timeout/cancellation、`prompt v0`、VS Code Codex/Cline 同题只读任务 |
| W13 | 9/7-9/11，5 天 | 分层语料、中文检索、dense 与 retrieval eval | 冻结 corpus/eval、可用 BM25、grounding prompt、可复现基线 |
| W14 | 9/14-9/18，5 天 | 继承 harness 契约、实现单 Agent、trial 与 trace | 只读 tool、脱敏 trace、verifier、prompt 对照、session reset/isolation |
| W15 | 9/21-9/24，4 个常规学习日 | MCP 2026-07-28、旧版互操作、server/client | stdio tools/resources、新旧消息 diff、一次 MCP/Skill 生命周期实践 |
| W16 | 9/28-9/30，3 天 | 端到端串联、故障注入、回归与重建 | 全链路、prompt/memory 回归、调度观察、AI SDLC 闭环 |

`9/20` 是否属于公司学习日不作为主线容量前提；如可用，只处理 W15 stretch。

## 4. 每周范围

### W12：Python for AI Engineering

**目标**：通过真实 Python Agent 项目建立阅读、修改、异步控制和故障诊断能力。

**必修**：

- 项目级 Python 3.12、依赖锁定、包/import、pytest 和类型检查入口。
- TypeScript -> Python 迁移增量：typing/Protocol、Pydantic/dataclass、异常传播、context manager、
  sync/async 边界。装饰器、生成器等只在 Bub 调用链实际遇到时学习。
- Bub 的 turn、hook、tape、context rebuild、model/tool/channel 职责。
- 一次真实 DeepSeek 调用和一次最小工具调用；timeout 与 cancellation 各真实触发一次。
- 一份版本化 `prompt v0`，明确 instructions、input、examples、context 与 output schema 的边界。
- 对同一只读代码导航/review 任务，本人先独立作答并冻结，再交给 VS Code Codex 与 Cline；两个扩展
  的对照总计不超过 60-90 分钟，不能反向污染本人验收。

**不做**：RAG 实现、DeepSeek Harness 通读、完整 Agent loop、MCP、UI。

**验收方向**：本人在 D2（9/1，原定 D1）冻结一条可证伪验收句；AI 可提供未见过的 Python 诊断材料
作为验收题，但不提前提供答案。

### W13：RAG Foundations

**目标**：在冻结语料和 held-out 题集上分离 retrieval 与 generation 的质量、成本和延迟。

**语料分层**：

- Tier A：原六份协议文档。用途是字符区间判分、拒答、冲突题和小语料 full-context 基线。
- Tier B：冻结 commit 下的 tracked Markdown 减显式排除清单。排除 `corpus/` 自身、题库与答案、
  W13 起的进行中笔记、个人面试资料和任何公司资料/PII。
- Tier C：MCP 新旧规范。只在 W15 作为版本冲突与协议学习材料，不阻断 W13。

快照必须在第一道 eval 题建立前完成，并记录来源 commit、排除规则、文件清单、字节数和 token 数。

**必修**：

- full-context 质量上限锚点、中文 BM25、dense retrieval。
- ingestion、chunking、metadata、citation、abstention 和 context budget。
- grounding prompt 与引用/拒答约束；失败分析必须区分 retrieval miss、context assembly、prompt 与 generation。
- RAG 是按需检索的外部知识来源，不把索引或检索结果直接称为 Agent 的 session/durable memory。
- dev/holdout 隔离；holdout 只在 W13 收口和 W16 回归运行。
- 逐题失败分析，以及质量、延迟、token、cache hit/miss 成本记录。

**条件项**：BM25 与 dense 各自可用后，最多半天做 hybrid/RRF。reranker、向量数据库和 GraphRAG 不进入主线。

**Intel CPU 门禁**：默认候选是 `intfloat/multilingual-e5-small`；按模型卡使用 `query: ` / `passage: `
前缀、归一化向量，并记录 512-token 截断。`BAAI/bge-small-zh-v1.5` 只作中文回退，不用 `bge-m3`
起步。macOS x86 的 PyTorch 官方二进制停留在 2.2 版本线，ONNX Runtime 也已停止新版本的 macOS x86
二进制支持；PyPI 发布物核对到 `onnxruntime==1.23.2` 与 `torch==2.2.2` 均有 CPython 3.12/macOS x86_64
wheel。W13 复用项目 Python 3.12，以 ONNX 1.23.2 + 发布者 fp32 模型文件为首选，Torch 2.2.2 只作
兼容回退；D1 仍需真实安装并冻结 wheel/hash，不允许解析到无 x86 wheel 的新版本，也不做源码编译。
先在同一冻结 chunk/query 小样本跑 fp32 正确性基线；量化 ONNX 仅在兼容文件可用时做同集对照，记录
模型 revision、文件、provider、线程、batch、token 长度/截断、冷启动、吞吐、查询 p50/p95、峰值 RSS
和质量，再估算 Tier B 全量时间。若安装失败、持续 swap/明显系统卡顿、全量估算超过本人冻结的时间盒、
查询延迟不可交互或质量不过线，则停止本地 dense 排障并改用 embedding API；BM25 与冻结 eval 保留，
dense 不阻塞 W14。不为证明「本地部署」挤占 retrieval/eval 主线，CPU 上不使用 fp16/bf16 作为加速假设。

题目、标签、指标、阈值与通过标准属于黑名单，由本人在 D1 冻结。

### W14：Tool 与 Single-Agent Harness

**目标**：实现既有通用契约在 Python + RAG 场景中的最小可观察运行，不重复设计已经冻结的部分。

**继承**：终止状态集合、trace 原则、context/state/trace 三分、grader 优先级、安全与密钥边界。

**delta**：Python 运行时、文档语料、RAG 子系统、`clarification_required`、prompt 版本关联，以及有界
session state 的隔离、reset 与 context 淘汰观察。它们不改变已冻结的终止、工具、trace 与 verifier 通用契约。

**仍由本人完成**：任务级工具语义、预算数值、停止与停滞判据、verifier 判据、eval task 和核心断言。

**必修**：

- structured output、function calling、工具参数验证、工具失败、取消与权限边界。
- system/developer prompt、工具描述与输入上下文的边界；在冻结 dev task 上只改变一个 prompt 因素，
  重新运行相同 eval 并保留前后版本。
- 有界 session state 的 write/read、隔离与 reset，以及 context token budget；观察一次 compaction 或
  eviction。durable memory 只学习 write/read/delete、TTL、隐私和陈旧/投毒边界，不在本周持久化实现。
- 单 Agent loop、JSONL trace、确定性 replay、外部 verifier 和多 trial。
- DeepSeek V4 thinking/function calling 的真实行为验证。
- DeepSeek Harness 只抽样 lifecycle、session log 与 tool pipeline，作为大型 harness 对照。

**条件项**：OpenAI Agents SDK compatibility spike 最多半天。失败即停止，不增加 adapter。

W14 的 prompt 单变量对照 + session state/context 实验合计 timebox 半天；超时先砍 SDK spike 与
DeepSeek Harness 额外抽样，不挤压 harness、trace/verifier 和多 trial 主线。

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
- 将同一只读 stdio server 分别注册到 VS Code Codex 与 Cline，完成发现、一次调用、禁用和移除；记录
  扩展版本、配置 scope、权限提示、日志和实际能力。两端都确认根 `AGENTS.md` 已作为项目规则来源。
  产品客户端只用于互操作与生命周期观察，不代替 Python SDK 的协议消息验收。
- 检查一个已有的小型 Skill 的 `SKILL.md` 与资源加载边界，完成本地安装或注册、触发、禁用和移除；
  优先在 VS Code Codex 执行；Cline 当前扩展若已提供 Skills 面板再做同项对照，不为升级或缺失功能延长
  排障。不开发复杂 Skill，不把 Skill 当作 MCP server。产品客户端与 Skill 生命周期实践合计 90 分钟。

### W16：Reliability、Evals 与综合重建

**目标**：在三天内验证组合链路的可观察性和可回归性，不新增产品功能。

- D1：连接 RAG、Agent 与 MCP，冻结可重复基线；记录 prompt/memory 版本关联与调度基线。
- D2：执行本人设计的故障注入并完成分层归因，覆盖 stale memory 或跨 session 泄漏，以及重试、取消、
  幂等中的至少一条失败路径。
- D3：运行 holdout 与 prompt regression，完成确定性重建、事实收口与下一入口。

三天内用 60-90 分钟复用一项小型白名单变更走完 AI SDLC：先写规格和可证伪验收，再限定上下文与权限，review AI diff，
运行确定性测试和相关 eval，检查隐私/依赖/trace，最后记录发布或不发布判断、回滚方法和版本来源。该练习
复用综合链路，不新建产品，也不以生成代码量作为验收。

手写 harness/SDK 对照已在 W14 收口；direct tool/MCP 对照已在 W15 收口，W16 不重复执行。
FastAPI、Docker/CI 和 UI 均不属于三天主线。额外时间只回填这些 stretch，不新增必修项。

## 5. 周间接口与防级联规则

- W12 -> W13：Python 项目与模型 client 可运行、`prompt v0` 已版本化、VS Code Codex/Cline 同题任务完成
  即可；Bub 报告不阻塞 corpus 冻结。
- W13 -> W14：一个可用 BM25 入口 + 冻结题集即可；dense/hybrid 未调完不阻塞 Agent。
- W14 -> W15：一个只读 retrieval tool + trace 落盘 + session reset/isolation 可验证即可；SDK spike
  不阻塞 MCP。
- W15 -> W16：stdio server + tools/resources 可调用即可；HTTP 与扩展能力不阻塞串联。

若最低接口未满足，下一周只修接口，不把上周全部未完成项平移。其余内容回到当周记录或 BACKLOG。

## 6. AI 协作与债务预算

- Python、Pydantic、pytest、SDK、配置和脚手架属于白名单，可由 AI 提供最小实现。
- RAG 方案取舍、eval 题目与判据、Agent loop、终止与停滞判断、工具权限、trace 字段选择、
  verifier、prompt 内容与 memory/scheduling 正确性判据和核心断言由本人负责。
- `loop 控制流`与`终止状态机`维持 L1-only。
- 工具契约、trace schema、verifier、eval task 如请求 L2，必须逐项记入 `DEBT.md`，并安排两周后的重建。
- 债务预算不是使用配额。债务增加影响周验收时，先砍范围，不提高援助等级。

## 7. Trace、隐私与版本冻结

- 全量 trace 保存在 gitignored 本地目录。
- 仓库只保留脱敏代表样本；具体样本数量在 W14 D1 由本人冻结。
- 运行证据需关联模型 alias、当时解析到的版本/快照、thinking 配置、harness/Prompt/memory policy 版本
  和来源 commit；具体 trace schema 仍由本人冻结。
- 公司资料、PII、密钥和本地绝对敏感路径不进入 corpus、trace、仓库或第三方 API。
- Bub、DeepSeek Harness、MCP SDK 和外部规范均记录 commit 或包版本，避免五周内漂移。

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

1. OpenAI Agents SDK spike。
2. DeepSeek Harness 第三条以外的抽样链路。
3. 本地量化生成模型。
4. MCP tasks、扩展与完整远程授权实践。
5. reranker。
6. hybrid/RRF。
7. Streamable HTTP hands-on。
8. FastAPI、Docker/CI 和任何 UI。

不可砍：Python 复杂代码阅读与真实取消、冻结 corpus/eval、BM25 和 dense 基线、显式单 Agent harness、
trace/verifier、多 trial、MCP 现代 stdio tools/resources/client、故障归因和延迟重建；一份版本化 prompt
及受控前后 eval；有界 memory 的隔离/reset 与故障注入；一次 MCP/Skill 生命周期实践；
一次小型白名单变更的 AI SDLC 闭环；W12 的 VS Code Codex/Cline 同题 hands-on。W15 产品客户端
至少完成一端互操作，另一端失败时保留诊断证据，不阻塞 Python SDK 协议验收。

## 10. 资料基线

完整的按周资料、用途与优先级见独立工作簿的 `References` sheet；下列链接只保留总计划的最小基线。

- [OpenAI Building Agents](https://developers.openai.com/tracks/building-agents)
- [OpenAI Prompt Engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)
- [OpenAI Conversation State](https://developers.openai.com/api/docs/guides/conversation-state)
- [OpenAI Compaction](https://developers.openai.com/api/docs/guides/compaction)
- [OpenAI Codex Best Practices](https://learn.chatgpt.com/guides/best-practices)
- [OpenAI Codex IDE Extension](https://learn.chatgpt.com/docs/codex/ide)
- [OpenAI Build Skills](https://learn.chatgpt.com/docs/build-skills)
- [OpenAI Building an AI-Native Engineering Team](https://learn.chatgpt.com/guides/build-ai-native-engineering-team)
- [Anthropic Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Cline Plan & Act](https://docs.cline.bot/core-workflows/plan-and-act)
- [Cline Skills](https://docs.cline.bot/customization/skills)
- [Cline MCP](https://docs.cline.bot/mcp/mcp-overview)
- [Cline Scheduling](https://docs.cline.bot/cli/scheduling)
- [Anthropic Agent Evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [MCP 2026-07-28 Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP 2026-07-28 Key Changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Python SDK Protocol Versions](https://py.sdk.modelcontextprotocol.io/protocol-versions/)
- [Bub](https://github.com/bubbuild/bub)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/)
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
