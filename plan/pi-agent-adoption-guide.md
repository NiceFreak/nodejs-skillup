# Pi coding agent 评估与引入指南

> 创建：2026-09-08。状态：**评估材料，不是已生效的计划变更**。
> 本文不修改 `README.md` 的周次排期，也不修改 `LEARNING-STATE.md` 的当前进度。
> W13 当前入口仍是 D2 同日延展已完成、等待确认进入 D3，与本文无关。

---

## 1. 本文的范围与证据边界

本文的技术对象是 **Pi coding agent**（npm scope `@earendil-works`），目的是判断它能否作为
W14「单 Agent harness」的**辅助阅读对象**，以及能否在学习之外作为日常工具使用。

证据分三级，全文按级标注：

| 等级 | 含义 | 本文中的来源 |
|---|---|---|
| 实测 | 本会话内实际执行命令得到 | npm registry 查询结果 |
| 文档陈述 | Pi 官方仓库 README 与 `packages/coding-agent/docs/` 的内容 | 各 `.md` 文件 |
| 检索来源 | 第三方文章或社区讨论的说法，未自行核对 | 见 §8 来源清单 |

**本文没有安装、也没有运行过 Pi。** 所有关于运行行为、token 效率和稳定性的说法都是文档陈述或
检索来源，不是实测结论。任何「适合 / 不适合」的判断在实际跑过之前都属于推断。

---

## 2. Pi 是什么

Pi 是一个终端 AI 编码 agent，同时对外提供 agent harness 的运行时和 SDK。它直接操作文件系统和
shell，不依附编辑器。

已实测的基本事实（2026-09-08 查询 npm registry）：

- 包名 `@earendil-works/pi-coding-agent`，latest 版本 **0.85.1**，license **MIT**，registry 最后更新
  **2026-09-05**，该包已发布 45 个版本（`pi-ai`、`pi-agent-core` 同为 45，三包同步发版）。

文档陈述的结构：

| 包 | 职责 |
|---|---|
| `@earendil-works/pi-ai` | 统一多 provider 的 LLM API |
| `@earendil-works/pi-agent-core` | agent 运行时，负责 tool calling 与状态管理 |
| `@earendil-works/pi-coding-agent` | 交互式 CLI，同时是可嵌入的 SDK |

设计取向（文档陈述）：

- 默认只给模型四个工具：`read`、`write`、`edit`、`bash`（`quickstart.md`）；`grep`、`find`、`ls`
  是附加的内置只读工具，通过 tool options 启用。`index.md` 把核心表述为 minimal core。
- **默认不内置 sub-agent、plan mode、权限确认弹窗和 MCP**。官方立场是这些应由 extension 提供，
  核心保持最小。
- 扩展分四层：extensions（TypeScript）、skills（Agent Skills 标准）、prompt templates、themes；
  打包为 Pi package 后经 npm 或 git 分发。
- session 存为 JSONL，条目带 `id` 与 `parentId` 形成树。`/tree` 的分支留在同一文件内，不产生新文件；
  `/fork` 与 `/clone` 会生成新的 session 文件。另有 `/compact` 压缩上下文和导出为 HTML。
- `providers.md` 列出 6 个订阅登录入口（含 Anthropic、OpenAI、GitHub Copilot）与 30 余个 API key
  provider（含 DeepSeek、Gemini），另有 llama.cpp 本地 router 与 custom provider。
  「无 SaaS 后端」是检索来源的说法，官方文档中未检索到对应陈述。

历史（检索来源）：由 Mario Zechner 创建，原在 `badlogic/pi-mono` 仓库以 `@mariozechner` scope 分发；
2026 年 5 月转入 Earendil Works，仓库与包名随之更改。星标数各来源说法不一致（有称 2026 年初 6 万+、
2026 年 8 月 9.1 万+），本会话无法访问 GitHub API 核对，因此**不作为判断依据**。

---

## 3. 官方文档清单与阅读顺序

官方文档位于 `earendil-works/pi` 仓库 `packages/coding-agent/docs/`；`docs.json` 导航与 `index.md`
共列出 30 篇 `.md`（逐个 URL 验证均可访问）。仓库网页目录无法枚举，不排除存在未挂进导航的文件。

**以下分组按本仓库关注点自拟**，不是官方分组。官方索引的分组为 Start here / Customization /
Programmatic usage / Reference / Platform setup / Development；`session-format.md` 官方归在 Reference。

| 分组 | 文件 | 与本仓库的相关度 |
|---|---|---|
| 入门 | `quickstart.md`、`usage.md` | 高，安装与首次会话 |
| 配置 | `providers.md`、`settings.md`、`keybindings.md` | 中 |
| 核心机制 | `sessions.md`、`compaction.md`、`session-format.md` | **高，W14/W16 直接相关** |
| 安全 | `security.md`、`containerization.md` | **高，使用前必读** |
| 本地模型 | `llama-cpp.md`、`models.md`、`custom-provider.md` | 中 |
| 扩展 | `extensions.md`、`skills.md`、`prompt-templates.md`、`themes.md`、`packages.md` | **高，W15 相关** |
| 程序化接入 | `sdk.md`、`rpc.md`、`json.md`、`tui.md` | **高，W14 相关** |
| 平台 | `windows.md`、`termux.md`、`tmux.md`、`terminal-setup.md`、`shell-aliases.md` | 低 |
| 开发 | `development.md`、`environment-variables.md`、`docs.json` | 低 |

**推荐阅读顺序**（与官方索引顺序不同，按本仓库的关注点重排）：

```text
security.md  → 先确定使用边界，再决定要不要装
quickstart.md → 装与不装的成本
sdk.md        → harness 的对外接口形状，最能说明"一个 agent 循环需要哪些抽象"
session-format.md + compaction.md → 状态与上下文如何持久化和裁剪
extensions.md → 扩展点在哪里
skills.md + packages.md → 生态的分发方式
```

---

## 4. 社区材料与生态现状

### 4.1 生态规模（实测）

2026-09-08 查询 npm registry，`keywords:pi-package` 检索报告约 **9,346** 条匹配；抽样翻到 from=4000
处返回的条目仍全部真实带该关键字（如 `pi-ste-writing`、`@zhafron/pi-mcp-tools`）。

这支持的结论：Pi 的第三方扩展分发已经达到千级量级。
这不支持的结论：不能据此判断其中有多少是活跃维护、被实际使用或质量可用。npm 检索总数含相关度
匹配，且未去除重复发布和实验性包。

抽样看到的功能分布（npm 描述原文，未安装验证）：

| 包 | 对应的默认缺失能力 |
|---|---|
| `pi-mcp-adapter`、`@zhafron/pi-mcp-tools` | MCP 接入 |
| `pi-subagents`、`@tintinweb/pi-subagents` | 子 agent 与工作流编排 |
| `pi-web-access` | 网页搜索、URL 抓取、PDF 提取 |
| `pi-lens` | LSP、linter、formatter、类型检查的实时反馈 |
| `pi-memory`、`@amaster.ai/pi-memory-mem0` | agent memory |
| `@plannotator/pi-extension` | 交互式 plan review |
| `@juicesharp/rpiv-ask-user-question` | 结构化提问 |
| `@trim21/personal-pi-extensions` | bwrap sandbox、workspace guard |
| `pi-background-tasks` | 后台 shell 任务、只读委派 agent |

这批包的 npm 描述与 §2 的设计取向一致：MCP、sub-agent、plan review 均有第三方扩展在做。
权限确认弹窗未在本次抽样中出现——`@juicesharp/rpiv-ask-user-question` 是结构化提问，
`@trim21/personal-pi-extensions` 是沙箱与 workspace guard，都不是权限确认。
这是抽样一致，不是验证；`usage.md` 列出的默认缺失项也不止本文引的四项（另含 to-dos、
background bash）。

### 4.2 官方包画廊

文档陈述：带 `pi-package` keyword 的包会出现在 `pi.dev/packages` 画廊，作者可以加 `video` 和
`image` 字段做预览。本会话的网络策略阻断了 `pi.dev`，画廊实际内容未核对。

### 4.3 社区批评意见

`earendil-works/pi` Discussion #3735 是一位首次使用者在 90 分钟安装体验后提出的负面反馈，要点：

1. 提交高度集中在单一开发者，长期维护有风险。
2. 文档分散在多个域名，指引含糊。
3. 本地 LLM 接入对新手门槛高，出现 `Error: 400 Unexpected message role` 这类未被文档覆盖的报错。
4. 域名、包名、仓库名命名不一致。
5. extension 安装缺少手动与 npm 两条路径的区分，需要 clone 整仓再 symlink 嵌套目录。
6. 首次启动不自动生成配置文件。

维护者一侧的回应强调这是刻意的可扩展设计，并指出转入 Earendil 后命名混乱会缓解；讨论中也有人
认为这种回应回避了文档问题本身。

这支持的结论：Pi 的**上手成本明显高于开箱即用的 agent CLI**，文档质量是已知的公开争议点。
这不支持的结论：不能据此判断当前版本 0.85.1 是否已修复上述各项；该讨论的时间点与当前版本的
对应关系未核对。

---

## 5. 与本仓库学习计划的关系

### 5.1 三个落点

| 周次 | 主题 | Pi 的用法 | 性质 |
|---|---|---|---|
| W14 | 单 Agent harness | 读 `pi-agent-core` 的 tool calling 循环与 `sdk.md` 的抽象划分，作为自写 harness 前的对照实现 | 阅读材料 |
| W15 | MCP | Pi 默认不带 MCP，接入必须自己写 extension 或读 `pi-mcp-adapter` 的实现 | 可选实操对象 |
| W16 | reliability / evals | JSONL session 树是现成的 trace 数据；`/fork` 支持同起点跑不同 prompt 版本 | 可选数据来源 |

W14 的用法与 W12 读 Bub 主链是同一类动作：读开源实现理解原理，然后合上代码自己重建。

### 5.2 W13 当前阶段：不引入

`pi-ai` 与本仓库 W12 建立的模型客户端属于同类抽象，可作对照阅读，但 W13 的 RAG Prompt v0 语义与
`rag-response-v1.schema.json` 刚冻结，尚未接入或运行模型。此时更换或叠加模型客户端会引入与
retrieval 无关的变量，破坏 eval 基线的可比性。

结论：W13 期间不引入 Pi 作为工具，也不把它排进当前日程。

### 5.3 与 `AGENTS.md` 硬线的关系

这是引入前必须先说清的边界，因为 Pi 的默认行为与本仓库的学习硬线存在直接冲突。

| `AGENTS.md` 要求 | Pi 的默认行为（文档陈述） | 冲突判断 |
|---|---|---|
| 黑名单核心代码由本人实现，AI 止步于伪代码骨架 | 默认无 plan mode、无权限确认弹窗，直接执行 `write` / `edit` | **直接冲突** |
| AI 给过骨架的知识点记入 `DEBT.md` | 无对应机制 | 需人工补 |
| 读源码理解原理属于允许范围 | 与工具无关 | 不冲突 |

可执行的处理方式，按约束强度排序：

1. **只读源码，不安装。** 无任何冲突，是 W14 落点的默认形态。
2. **安装后只用于 `AGENTS.md` 白名单显式列出的对象类型**（配置、脚手架、展板资产、
   Postman/`.http` 样例）。**判据是知识点，不是目录**：`AGENTS.md` §2 按知识点分类，全文没有
   目录级黑名单，因此「避开某个目录」不等于守住硬线。反例就在本文 §6：`week13-rag/eval/`
   属于黑名单（`AGENTS.md` 明确「eval 任务设计，不论用哪种语言实现都是黑名单」），
   而它不在任何 `week14-*` 路径下。
3. **写一个 extension 拦截黑名单目录的写入。** `extensions.md` 说明 extension 可以阻断 tool call
   （`{ block: true }`），因此在原理上可以对指定目录的 `write` / `edit` 返回拒绝。
   **这一条有两层未验证，不能当作防护**：一是拦截本身未实测；二是即使拦截生效，模型仍可用
   `bash` 写入同一目录，而 `security.md` 明确 Pi 无内置沙箱、真正的隔离边界只能来自 OS 或容器。
   因此它只是提示性护栏，必须与第 1、2 条叠加，不能作为放开安装的独立理由。

第 3 条如果验证成立，本身就是一个和 W14 主题重合的练习：写拦截器要求理解 harness 的事件模型。

---

## 6. 不占学习周次的最小引入路线

设计目标：总投入控制在半天以内，且在 W13 收口前不启动。

**阶段 A：只读，约 2 小时，W13 收口后、W14 开始前**

1. 读 `security.md` 和 `containerization.md`，确定使用边界。
2. 读 `sdk.md`，逐条回答：`AgentSession`、`ModelRuntime`、`SessionManager`、`DefaultResourceLoader`、
   `SettingsManager` 各自持有什么状态、边界如何划分。（`sdk.md` 的 Core Concepts 还列了
   `createAgentSessionRuntime` 等，这五个是本文选出的入口，不是全集。）
3. 读 `session-format.md` 和 `compaction.md`，回答：为什么用 `parentId` 树而不是多文件；
   `buildContextEntries()` 从叶到根回溯时，compaction 条目如何替换被摘要的区间。
4. 读 `extensions.md`，列出所有扩展点，标记哪些是 W14 自写 harness 时也必须有的。

阶段 A 的产出是一份对照笔记，不是可运行代码。这条路线不写 harness 代码，因此不触及黑名单。

**阶段 B：装在隔离环境里试跑，约 2 小时，W14 期间可选**

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 是官方 quickstart 给的写法。认证走 `/login`，或 `export ANTHROPIC_API_KEY=...`；
凭据落在 `~/.pi/agent/auth.json`。

`containerization.md` 的「Choose a pattern」表列出**四种**方案：

| 方案 | 隔离粒度 | 凭据处理（文档陈述） |
|---|---|---|
| Gondolin | 工具执行在本地 micro-VM，Pi 进程留在宿主 | 项目挂到 VM 的 `/workspace`；需要 Node ≥ 23.6.0 与 QEMU |
| Plain Docker | 整个 Pi 进程进容器 | API key 进容器 |
| Docker Sandboxes | 整个 Pi 进程进受管沙箱 | 沙箱内只拿到 sentinel 值，`sbx` 代理在出网时替换为真实凭据 |
| OpenShell | NVIDIA 的策略沙箱，可远程 | 配好推理路由后原始 API key 可留在沙箱外 |

选型说明：仓库 `.nvmrc` 固定 Node 24，本身已满足 Gondolin 的 Node ≥ 23.6.0，两者不冲突；
Gondolin 的实际成本是另装 QEMU、micro-VM 启动开销，以及示例扩展需要 `npm install`。
Plain Docker 的成本是 API key 进容器，`Docker Sandboxes` 正是为此设计的替代方案。
本仓库已有 `docker-compose.yml` 和 Docker 使用经验，**Plain Docker 上手最快**，但若不希望
API key 进容器，应直接用 Docker Sandboxes。

**挂载必须只读。** 官方 Plain Docker 示例的 `-v "$PWD:/workspace"` 与 Gondolin 的 `/workspace`
都会写穿到宿主文件，两者都不天然保护仓库目录。试跑用只读挂载：

```bash
docker run --rm -it -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace:ro" -v pi-agent-home:/root/.pi/agent pi-sandbox
```

**试跑任务的路径必须显式限定，不能笼统写「读某个 week 目录」。**

硬约束：**任何 agent 都不得读取 `week13-rag/eval/holdout/`。** `holdout/items.json` 内含 10 条
holdout query 及其 `expected_rule_conclusion`；`eval/scoring-contract.md` 的冻结条款把
「dev 常规运行读取了 holdout items」直接判为运行无效，且该污染不可逆。`AGENTS.md` 明确
「eval 任务设计，不论用哪种语言实现都是黑名单」，因此 `week13-rag/eval/` 整体不属于白名单。

可用的试跑范围（只读，且不触碰 eval 与 holdout）：`docker-compose.yml`、`.http` / Postman 样例、
`week13-rag/notes/week13-plan.md`。让它复述本周计划的阶段门禁顺序，本人核对复述与
`LEARNING-STATE.md` 是否一致。这测工具，也测它对本仓库文档的理解精度。

**阶段 C：W15/W16 期间按需展开**

- W15：读 `pi-mcp-adapter` 源码，或自写最小 MCP extension。
- W16：解析 `~/.pi/agent/sessions/` 下的 JSONL 作为 trace 输入。

阶段 B 和 C 都是可选项。阶段 A 未完成时不进入 B。

---

## 7. 学习之外的日常使用建议

### 7.1 适合 Pi 的场景

- **需要接自建或本地推理端点。** 支持 llama.cpp router 与 custom provider，代码可不经第三方
  服务。对公司数据不外流的要求友好。
- **需要把 agent 嵌进自己的程序。** 两条路径的形态不同，别混：SDK 的 `createAgentSession()` +
  `session.subscribe()` 是**进程内嵌入**；`--mode rpc`（stdin/stdout JSONL）与 `--mode json` 是
  **把 pi 当子进程**按协议集成。`rpc.md` 开头明确建议 Node.js 应用优先用 `AgentSession`
  而不是 spawn 子进程。
- **需要非交互批处理。** `pi -p "prompt"` 一次性执行，可进脚本或 CI。
- **工作流需要固定下来复用。** skills 走 Agent Skills 标准，与本仓库 `.claude/skills/` 下已有的
  部署类 skill 是同一套格式概念，迁移成本低（**格式兼容性未实测**）。

### 7.2 不适合的场景

- 想要开箱即用、默认带权限确认和 plan mode 的体验。这些要自己装扩展。
- 团队中有人不愿意读扩展源码。见下条安全约束。

### 7.3 安全约束（这一节的每一条都来自官方文档，不是推断）

`security.md` 与 `packages.md` 的明确陈述：

1. **内置工具和 TypeScript extension 以 Pi 进程相同的权限运行**，包含文件读写和 shell 执行。
   官方明确拒绝做进程内沙箱，理由是部分隔离会给人错误的安全感。
2. **Pi package 以完整系统访问权限运行。** extension 执行任意代码，skill 可以指示模型执行任何
   操作，包括运行可执行文件。官方要求安装第三方包前审阅源码。
3. **project trust 只管输入加载，不保证代码、提示词或模型输出安全。** 进入含 `.pi/settings.json`、
   `.pi/extensions`、系统提示词文件或项目 skill 的目录时会询问是否信任。
4. **信任询问只在交互式且 UI 可用时出现。** 官方原文：非交互模式（`-p`、`--mode json`、
   `--mode rpc`）**不显示信任提示**，行为由全局 `defaultProjectTrust` 决定（`ask` 为默认、
   `never`、`always`），可用 `--approve` / `--no-approve` 单次覆盖。§7.1 推荐的 `pi -p` 进 CI
   和 `--mode rpc` 嵌入正好都走这条路径，**没有信任询问兜底**。
5. **context 文件不受 project trust 约束。** `AGENTS.override.md`、`AGENTS.md`、`CLAUDE.md`
   无论是否信任项目都会加载（除非关闭 context 加载）。对本仓库的含义是：Pi 会自动读入
   `AGENTS.md`，即使你拒绝信任该项目。
6. **项目被信任后会自动装包。** `packages.md`：project settings 可以团队共享，pi 在启动时
   自动安装缺失的 pi package。这条会让下面「安装第三方包前读源码」的规则在该路径上失效。
7. **来自仓库文件、注释、文档、上下文文件或构建输出的 prompt injection 属于预期内的本地 agent
   风险，官方声明无法可靠防止。**

由此得到的使用规则：

- 处理不受信任的仓库，或无人值守运行时，放进容器 / VM / micro-VM，限制文件访问和凭据。
- 工作区尽量只读挂载，结果同步前先看 diff。
- 按需限制网络访问。
- 安装第三方包前读源码。生态有千级包但没有审核机制，`pi-package` 关键字不构成任何质量背书。

### 7.4 上手成本的现实预期

按 §4.3 的社区反馈，首次配置（尤其是本地模型）预计需要接近两小时，文档需要跨仓库和站点查找。
把这项成本计入排期，不要按十分钟估算。若时间预算不足，阶段 A 的纯阅读路线仍然成立，
W14 的对照阅读价值不依赖于是否安装。

---

## 8. 待验证项

以下条目在实际执行前保持未验证状态，不得在后续文档中升级为结论：

1. extension 能否可靠拦截对指定目录的 `write` / `edit`。即使拦截成立，也已知不覆盖 `bash`
   写入，因此不构成安全边界（见 §5.3 第 3 条）。
2. Pi 的 skill 格式与本仓库 `.claude/skills/` 下现有 skill 的实际兼容程度。`skills.md` 的示例
   演示过把 `.claude/skills` 配成 skill 目录，但本仓库的三个部署类 skill 未实际加载验证。
3. Discussion #3735 中列出的六项问题在 0.85.1 上各自的现状。该讨论原文本会话未能打开
   （`github.com` 网页返回 403），六项内容仅来自检索摘要。
4. `pi.dev/packages` 画廊的实际内容与筛选机制（本会话网络策略阻断该域名）。
5. 各来源给出的星标数与 token 效率说法，均未核对。
6. `packages/coding-agent/docs/` 是否存在未挂进 `docs.json` 导航的 `.md` 文件（目录无法枚举）。

---

## 9. 来源清单

官方（`earendil-works/pi` 仓库 `packages/coding-agent/docs/`）：

- [index.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/index.md)
- [quickstart.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/quickstart.md)
- [security.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/security.md)
- [containerization.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/containerization.md)
- [extensions.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/extensions.md)
- [skills.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/skills.md)
- [packages.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/packages.md)
- [sdk.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sdk.md)
- [session-format.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/session-format.md)
- [仓库首页](https://github.com/earendil-works/pi)

社区：

- [Discussion #3735：首次使用者的负面反馈](https://github.com/earendil-works/pi/discussions/3735)
- [Pi Coding Agent Review（Rost Glukhov）](https://www.glukhov.org/ai-devtools/pi/pi-coding-agent-review/)
- [Agent engineering: Pi（Roman Imankulov）](https://roman.pt/posts/pi-dev-version/)
- [Pi Coding Agent Tutorial 2026（daily.dev）](https://daily.dev/posts/pi-coding-agent-tutorial-2026-install-set-up-and-use-the-open-source-ai-coding-agent-knhg42cpy)
- [Setting Up and Using the Pi Coding Agent（DeepakNess）](https://deepakness.com/blog/pi-agent-setup/)
- [Pi Agent Deep Dive 2026（Koenig AI Academy）](https://academy.kspl.tech/blog/2026-06-05-pi-agent-deep-dive-2026)
- [Awesome Pi Coding Agent](https://awesome-pi.site/articles/)
- [Pi (AI agent) — Wikipedia](https://en.wikipedia.org/wiki/Pi_(AI_agent))

本会话的网络访问实况：可用的只有 `raw.githubusercontent.com` 与 `registry.npmjs.org`。
`github.com` 网页整体返回 403（含上面的 Discussion #3735 链接），`api.github.com` 同样 403；
`pi.dev`、`en.wikipedia.org`、`dev.to`、`www.glukhov.org`、`academy.kspl.tech`、
`awesome-pi.site`、`daily.dev`、`roman.pt`、`deepakness.com` 被代理策略阻断。

因此：**官方文档部分**（§9 第一组链接）已逐个取回原文核对；**社区部分**（第二组链接，含
Discussion #3735 的六项批评）全部只来自检索摘要，未打开原文。
