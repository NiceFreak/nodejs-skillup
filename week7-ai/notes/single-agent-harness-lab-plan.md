# 本地单 Agent Harness Lab · MVP 方案

> 状态：方向已确认，尚未实现  
> 日期：2026-07-27（Asia/Shanghai）  
> 位置：`week7-ai/`  
> 性质：独立、本地运行的 AI 工程实验，不进入 GitHub Pages，不改变 W6 主线与 2026-07-31 截止安排  
> 替代关系：本文整体替代已提交的第一版「AI 推理对比台」方案

## 1. 结论

第一版只比较 DeepSeek 的非思考和思考模式，能够展示 API 差异，但很快会退化成一次性的回答对比，不能充分利用仓库现有的前端、后端、数据库和测试资产。

新版改为构建一个真实的本地单 Agent harness：

```text
用户给出一个本地全栈故障或核查目标
→ DeepSeek 在受控循环中选择工具
→ 工具读取本地系统的真实结果
→ Agent 根据新证据修正判断
→ Agent 提交带证据的诊断结论
→ 外部 verifier 判断是否完成，而不是相信 Agent 自述
```

它不是通用聊天机器人，也不是让模型自由操作仓库的 coding agent。MVP 的定位是：

> 用基础 UI 直观展示单 Agent 如何观察环境、选择工具、积累证据、修正判断、停止，并接受外部验证。

## 2. 为什么当前仓库适合做 Harness Lab

当前仓库已经具有一套基本可用、可验证的真实环境：

- `week2-express/src/`：Express API、JWT / RBAC、报表查询和 MongoDB 接线；
- `week2-express/src/__tests__/`：可重复运行的集成测试；
- `week8-fullstack/src/frontend/`：可启动、可构建的真实前端；
- MongoDB / `mongodb-memory-server`：可以提供环境状态和结果事实；
- ESLint、TypeScript、Vite build 和 CI：可以提供确定性验证信号；
- 根目录协议、状态文件和每日笔记：已经形成仓库内的结构化上下文。

因此不需要为展示 Agent 而虚构天气、待办事项或客服数据。现有系统本身就能充当 Agent 的观察环境和验证对象。

## 3. 四个层次

### 3.1 Model

DeepSeek 负责根据当前目标、已有证据和可用工具决定下一步。模型本身不直接访问文件、终端、数据库或浏览器。

### 3.2 Agent harness

`week7-ai` 中包围模型的一次运行环境，负责：

- 提供 instructions 和当前任务；
- 暴露受限工具；
- 校验 tool call 参数；
- 执行工具并把安全结果返回模型；
- 记录完整 trace；
- 执行预算、超时、取消和停止规则。

### 3.3 Agent loop

一次任务内部的循环：

```text
观察当前状态
→ 选择一个工具或提交结论
→ 获取工具结果
→ 更新判断
→ 继续、完成或停止
```

循环次数多不代表效果好。每一步都应增加新证据；重复调用同一工具却没有新增信息，应被视为停滞信号。

### 3.4 Evaluation harness / 外层 loop

负责重复运行任务并判断 harness + model 的整体表现：

```text
载入场景
→ 重置目标环境
→ 运行单 Agent
→ 检查 trace 和真实 outcome
→ 记录 trial
→ 重试、比较版本或交给人工
```

MVP 先完成一个 Agent run 和一个可重复场景。批量 trial、版本比较和持续改进属于下一阶段，不在第一步同时铺开。

## 4. 与学习主线及 AI 协作边界

### 4.1 不影响 W6

- 不修改 `week2-express/` 的核心实现。
- 不修改现有 W6 测试场景和核心断言。
- 不修改 `week8-fullstack/` 的现有功能和 Pages 构建。
- 不把 Harness Lab 的完成状态写成 W1-W6 的掌握证据。
- Harness Lab 未完成时不阻塞 W6、全栈 demo 或 7 月 31 日收口。

### 4.2 第一版协作结论不再适用

第一版的主要内容是 UI 和 DeepSeek 特定 API 接线，可以归入展示与纯 API 细节。新版新增了以下可迁移能力：

- Agent loop 控制；
- 工具权限和工具契约设计；
- context / state 管理；
- 停止、重试和升级规则；
- eval 场景、grader 和成功标准。

这些设计换语言和模型后仍然成立，也属于 AI / 全栈工程中需要讲清的核心逻辑。因此不能继续笼统写成「全部由 AI 代写且不需要本人掌握」。

### 4.3 分工

AI 可以直接处理的白名单部分：

- 项目初始化、依赖、scripts、`.env.example` 和 `.gitignore`；
- DeepSeek 请求字段、tool call 消息拼接等纯 API 语法；
- 基础 UI、响应式布局、trace 可视化和样式；
- 不承载核心判断的配置胶水；
- 对本人实现的核心 loop 进行 review。

仓库主人需要负责的核心部分：

- 第一个场景为什么需要 Agent，而不是确定性脚本；
- Agent 能用哪些工具、为什么不能用其他工具；
- 每个工具的输入、输出和权限边界；
- loop 在什么条件下继续、完成、失败或交还人工；
- 什么环境事实才算 outcome；
- grader 检查什么，以及为什么足以支持验收。

若 AI 对这些核心部分给到 L2 骨架，按根 `AGENTS.md` 记债并安排重建。

## 5. MVP 使用场景

### 5.1 方向

MVP 选择「本地全栈故障诊断 / 核查」，不选择自由聊天或自动改代码。

用户可以：

- 从少量预设场景中选择一个；或
- 输入一个边界明确的本地故障现象。

Agent 通过受限工具收集证据，最后输出结构化诊断：

- `status`：完成、证据不足或需要人工；
- `summary`：当前最可能的结论；
- `evidence`：引用本次真实 tool result；
- `ruledOut`：哪些候选原因已被证据排除；
- `nextAction`：下一步建议，但不自动执行源码修改。

字段名是当前产品契约方向，不代表核心 loop 的实现已经确定。

### 5.2 为什么不先做自动修复

诊断阶段已经能覆盖 harness 的主要实践：工具选择、上下文更新、trace、停止规则和 outcome 验证。直接加入源码修改会同时引入：

- 任意 shell 和文件写权限；
- Git 状态隔离与回滚；
- 代码 review 和回归测试循环；
- W1-W6 黑名单核心代码被 Agent 修改的风险；
- 更大的误操作和密钥泄露面。

这些复杂度不是证明单 Agent loop 成立所必需的，留在后续独立评估。

## 6. 用户流程与基础 UI

```text
选择场景 / 输入故障现象
→ 查看本次目标、工具权限和运行边界
→ 点击「开始诊断」
→ 实时观察 Agent step 与 tool call
→ 必要时人工取消
→ 查看最终结论、证据、verifier 结果和停止原因
→ 展开完整 trace 或重新运行同一场景
```

页面布局方向：

```text
┌────────────────────────────────────────────────────────────┐
│ Single Agent Harness Lab                     本地只读实验  │
├──────────────────┬─────────────────────────────────────────┤
│ 场景与运行控制   │ Agent Trace                             │
│                  │ Step 1 · 判断                           │
│ 目标             │ Step 2 · tool: check_environment        │
│ 可用工具         │ Step 3 · observation                    │
│ 运行边界         │ Step 4 · tool: request_local_api        │
│                  │ ...                                     │
│ [开始] [取消]    │                                         │
├──────────────────┴─────────────────────────────────────────┤
│ Outcome                                                     │
│ 结论 · 证据 · 已排除项 · Verifier · 停止原因 · 运行指标     │
└────────────────────────────────────────────────────────────┘
```

移动端改为单列，顺序固定为：场景与权限 → 当前运行 → trace → outcome。动态内容只能在 trace 区内部增长，不能遮挡运行控制。

## 7. 系统边界

```text
Browser UI
    │
    ▼
week7-ai local harness server
    ├── DeepSeek client
    ├── loop controller
    ├── tool registry / permission checks
    ├── trace recorder
    └── verifier runner
           │
           ├── local API target       week2 Express
           ├── allowlisted checks     test / lint / build
           ├── read-only DB facts     test database only
           └── browser observation    later phase
```

`week7-ai` 是控制面；week2 / week8 / MongoDB 是被观察环境。控制面可以启动或请求允许的本地进程，但不把 harness 逻辑写入现有业务应用。

## 8. 工具设计原则

第一版不预先锁死完整工具列表。确定第一个场景后，只实现完成该场景所需的最少工具。

候选工具能力包括：

- 检查前端、后端和数据库是否可达；
- 对 allowlist 中的本地 API 发起请求；
- 运行 allowlist 中的项目检查；
- 读取经过裁剪和脱敏的本地日志；
- 查询预定义、只读的测试数据库事实；
- 提交结构化诊断并结束运行。

所有工具必须满足：

- 名称能够区分用途，避免多个工具语义重叠；
- 输入使用显式 schema，并在执行前由普通代码校验；
- 服务端自行注入凭据，模型不接触 secret 或完整 token；
- 输出只包含完成任务所需的上下文，支持过滤、截断或分页；
- 错误返回可操作原因，不返回堆叠的大段内部信息；
- 工具结果属于不可信输入，进入模型上下文前执行裁剪和脱敏。

MVP 明确禁止：

- 任意 shell command；
- 任意文件路径读取；
- 任意 MongoDB query / aggregation；
- 写数据库；
- 修改源码；
- Git commit / push；
- 访问 allowlist 之外的网络地址。

## 9. Context、State 与 Trace

### 9.1 Context

Agent 首次只接收：

- 当前场景和成功定义；
- 简短的系统地图；
- 当前可用工具定义；
- 权限与停止边界。

更深信息通过工具按需获取，不把根 `AGENTS.md`、全部笔记、全部源码或完整日志一次性塞进 prompt。

### 9.2 State

运行状态必须由 harness 持有，不能只存在于模型自然语言中。至少区分：

- 当前 run / scenario；
- 已使用工具和 observation；
- 当前运行状态；
- 已消耗的步骤、时间和 Token；
- 完成、停止或失败原因。

### 9.3 Trace

每次 trial 保存：

- 初始任务和 harness 版本；
- 模型与配置；
- 每轮 assistant message；
- tool name、经校验的参数和脱敏结果；
- 最终提交；
- verifier 结果；
- 耗时、Token 和停止原因。

本地运行记录放在 gitignored 目录，不进入 GitHub、Week8 bundle 或 Pages 产物。UI 可以浏览本次记录；跨运行持久化和历史筛选是否进入 MVP，在实施前由仓库主人决定。

## 10. 停止、失败与人工控制

一个 run 只能以明确状态结束：

- `completed`：Agent 已提交结论，且 verifier 接受所需证据；
- `insufficient_evidence`：工具范围内无法取得足够证据；
- `budget_exceeded`：达到步骤、时间或 Token 上限；
- `tool_failure`：关键工具连续失败，继续循环没有新信息；
- `cancelled`：用户主动取消；
- `needs_human`：需要权限、产品判断或高风险动作。

Agent 的自然语言「已经完成」只是一项 claim。生命周期状态由 harness 和 verifier 决定。

具体预算值、重试次数和停滞判据属于核心 loop 设计，在实现前由仓库主人确定并解释，不在方案文档里替代其判断。

## 11. Evaluation 设计原则

采用以下术语：

- `task`：一个输入与成功标准明确的场景；
- `trial`：该 task 的一次独立运行；
- `trace`：trial 的完整模型与工具轨迹；
- `outcome`：运行后环境中的真实结果；
- `grader`：检查 trace 或 outcome 的验证逻辑；
- `suite`：同类 task 的集合。

优先级：

```text
代码 / 环境事实 grader
→ 基于 rubric 的 LLM grader
→ 人工抽查与校准
```

状态码、测试结果、数据库事实、工具是否越权等应由确定性 grader 判断。LLM grader 只适合补充评价解释是否清晰、证据覆盖是否充分，不能替代客观结果。

模型具有非确定性。同一 task 在形成正式结论前应运行多个 trial，记录成功率、平均步骤、工具错误、耗时和 Token，而不是用一次漂亮演示判断 harness 已可靠。

第一个 task、预期 outcome 和核心 grader 属于测试 / AI 工程核心，由仓库主人定义。AI 可以提供原理讲解和 review，但不代写成功标准或核心断言。

## 12. 密钥、安全与发布边界

DeepSeek key 放在 `week7-ai/.env`，由本地 harness server 读取：

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

约束：

- key 不使用 `VITE_` 前缀；
- key 不进入浏览器源码、URL、存储、trace 或错误提示；
- key 不进入 `week8-fullstack`；
- 浏览器只请求本地 harness；
- `week7-ai/.env` 必须继续被根 `.gitignore` 忽略；
- 实现后验证 `git check-ignore -v week7-ai/.env` 和 `git status --short`；
- 从 `week2-express/src/.env` 移除重复的 DeepSeek 配置，保留 MongoDB / JWT 配置；
- Harness Lab 不加入 GitHub Pages 构建、复制或部署步骤；
- 若未来需要公开部署，重新做身份、权限、配额、隔离和审计设计，不沿用本地信任模型。

安全边界首先由普通代码和运行环境保证，prompt 中的「不要执行危险操作」只能作为补充。

## 13. 分阶段落地

### Phase 0 · 场景与契约

- 仓库主人选定一个确实需要 Agent 判断的本地场景；
- 定义目标、允许证据、工具边界、outcome 和停止状态；
- 证明它不是一个更适合普通脚本的固定流程。

### Phase 1 · 单次可观察 Agent run

- 建立本地 harness server 与 DeepSeek tool-call 循环；
- 只接入完成首个场景所需的最少工具；
- UI 展示实时 trace、取消、最终提交和停止原因；
- 完成 key 隔离和基础错误收口。

### Phase 2 · Verifier 与 replay

- 加入确定性 grader；
- 保存脱敏 trace；
- 能重跑同一 task 并比较 trial；
- 记录 harness / prompt / tool schema 版本。

### Phase 3 · 扩展环境观察

只有 Phase 1-2 显示明确缺口时再选择：

- Playwright 浏览器观察；
- 更多只读数据库事实；
- 多场景 suite；
- LLM rubric grader；
- 定期运行的外层 loop。

不因为 DeepSeek 调用便宜就同时加入所有能力。这里的首要约束是验证有效性、权限边界和可解释性，而不是单次 Token 成本。

## 14. MVP 验收标准

### Agent 行为

- DeepSeek 至少根据一次真实 tool result 决定下一步，而不是单轮生成报告；
- tool call 参数经过普通代码校验；
- trace 能还原目标、工具、observation、最终提交和停止原因；
- Agent 无法调用未注册工具或扩大工具权限；
- 一侧工具失败时，run 按既定规则继续、停止或交还人工，不无限重试。

### Verifier

- `completed` 必须绑定当前 run 的真实证据；
- Agent 自述成功但缺少 required evidence 时不能通过；
- 相同 task 可以重置并重跑；
- verifier 结果和 Agent 最终结论在 UI 中分开显示。

### 安全与隔离

- 浏览器、trace、源码和构建产物中没有真实 DeepSeek key；
- 没有任意 shell、任意文件、任意数据库或源码写入能力；
- week2 / week8 的现有代码和 Pages 发布产物保持不变；
- 本地运行产生的 trace 和临时状态被 Git 忽略。

### 工程与 UI

- 本地 harness 和 UI 可通过明确 scripts 启动；
- TypeScript、lint 和 build 通过；
- 空闲、运行、工具等待、完成、失败、取消状态可区分；
- 桌面和移动视口无重叠、页面级横向溢出或不可操作控件。

## 15. 明确不做

- 通用聊天机器人；
- 单纯比较 thinking / non-thinking 输出；
- 多 Agent 编排；
- RAG、embedding 或向量数据库；
- 任意 MCP 工具市场接入；
- 自主修改 week2 / week8；
- 自动提交、推送或部署；
- 生产数据库或线上服务访问；
- 无预算、无 verifier 的无限循环；
- GitHub Pages 或其他公开部署；
- 把 Agent 的解释当成客观 outcome；
- 为未来扩展预先建立通用工作流平台。

## 16. 参考资料

- [OpenAI · A practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)
- [OpenAI · Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
- [Anthropic · Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic · Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic · Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic · Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Anthropic · Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Anthropic · How we contain Claude across products](https://www.anthropic.com/engineering/how-we-contain-claude)
- [DeepSeek · Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)

本文只沉淀当前方向。Phase 0 的具体场景、工具契约、停止预算和 grader 尚未由仓库主人确定，因此不能据本文宣称实现已经开始或 MVP 契约已经完成。
