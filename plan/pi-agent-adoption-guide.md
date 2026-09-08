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
| 文档陈述 | Pi 官方仓库 `packages/coding-agent/docs/` 的内容 | 各 `.md` 文件 |
| 检索来源 | 第三方文章或社区讨论的说法，未自行核对 | 见 §8 来源清单 |

**本文没有安装、也没有运行过 Pi。** 所有关于运行行为、token 效率和稳定性的说法都是文档陈述或
检索来源，不是实测结论。任何「适合 / 不适合」的判断在实际跑过之前都属于推断。

---

## 2. Pi 是什么

Pi 是一个终端 AI 编码 agent，同时对外提供 agent harness 的运行时和 SDK。它直接操作文件系统和
shell，不依附编辑器。

已实测的基本事实（2026-09-08 查询 npm registry）：

- 包名 `@earendil-works/pi-coding-agent`，latest 版本 **0.85.1**，license **MIT**，registry 最后更新
  **2026-09-05**，该 scope 下已发布 45 个版本。

文档陈述的结构：

| 包 | 职责 |
|---|---|
| `@earendil-works/pi-ai` | 统一多 provider 的 LLM API |
| `@earendil-works/pi-agent-core` | agent 运行时，负责 tool calling 与状态管理 |
| `@earendil-works/pi-coding-agent` | 交互式 CLI，同时是可嵌入的 SDK |

设计取向（文档陈述）：

- 默认只给模型四个工具：`read`、`write`、`edit`、`bash`；SDK 文档另列出 `grep`、`find`、`ls`
  也在内置工具集合中。系统提示词很短。
- **默认不内置 sub-agent、plan mode、权限确认弹窗和 MCP**。官方立场是这些应由 extension 提供，
  核心保持最小。
- 扩展分四层：extensions（TypeScript）、skills（Agent Skills 标准）、prompt templates、themes；
  打包为 Pi package 后经 npm 或 git 分发。
- session 存为 JSONL，条目带 `id` 与 `parentId` 形成树，因此分支不产生新文件；支持 `/tree` 导航、
  `/fork`、`/clone`、`/compact` 压缩上下文，以及导出为 HTML。
- 25+ provider，含 Anthropic / OpenAI 订阅登录、GitHub Copilot、DeepSeek、Gemini，以及本地
  llama.cpp router。无 SaaS 后端。

历史（检索来源）：由 Mario Zechner 创建，原在 `badlogic/pi-mono` 仓库以 `@mariozechner` scope 分发；
2026 年 5 月转入 Earendil Works，仓库与包名随之更改。星标数各来源说法不一致（有称 2026 年初 6 万+、
2026 年 8 月 9.1 万+），本会话无法访问 GitHub API 核对，因此**不作为判断依据**。

---

## 3. 官方文档清单与阅读顺序

官方文档共 31 篇，位于 `earendil-works/pi` 仓库 `packages/coding-agent/docs/`。官方索引给出的分组
如下，按用途标注与本仓库的相关度：

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
extensions.md → 扩展点在哪里，等价于"核心留了哪些缝"
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

| 包 | 补的是哪块默认缺失 |
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

这张表本身就是对 §2 那条设计取向的验证：官方默认砍掉的能力（MCP、sub-agent、plan mode、权限
确认），社区都以扩展形式补了回来。

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
| W15 | MCP | Pi 默认不带 MCP，接入必须自己写 extension 或读 `pi-mcp-adapter` 的实现 | 可选实操靶子 |
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
2. **安装但不进 `week14-*` 等黑名单目录。** 限定在白名单范围（配置、脚手架、展板资产、
   Postman/`.http` 样例）内使用。
3. **写一个 extension 拦截黑名单目录的写入。** `extensions.md` 说明 extension 可以拦截并阻断
   tool call，因此在原理上可以对黑名单目录的 `write` / `edit` 返回拒绝。**这一条未实测**，
   属于从文档描述的能力得出的推断。

第 3 条如果验证成立，本身就是一个和 W14 主题重合的练习：写拦截器要求理解 harness 的事件模型。

---

## 6. 不占学习周次的最小引入路线

设计目标：总投入控制在半天以内，且在 W13 收口前不启动。

**阶段 A：只读，约 2 小时，W13 收口后、W14 开始前**

1. 读 `security.md` 和 `containerization.md`，确定使用边界。
2. 读 `sdk.md`，逐条回答：`AgentSession`、`ModelRuntime`、`SessionManager`、`DefaultResourceLoader`、
   `SettingsManager` 各自持有什么状态，为什么要拆成五个而不是一个。
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

隔离方式按 `containerization.md`，三选一：

| 方案 | 隔离粒度 | 说明（文档陈述） |
|---|---|---|
| Gondolin | 工具执行在本地 micro-VM，Pi 进程留在宿主 | 项目挂到 VM 的 `/workspace`；需要 Node ≥ 23.6.0 与 QEMU |
| Docker | 整个 Pi 进程进容器 | API key 会进容器，用 named volume 避免暴露宿主认证文件 |
| OpenShell | NVIDIA 的策略沙箱，可远程 | 配好推理路由后原始 API key 可留在沙箱外 |

本仓库已有 `docker-compose.yml` 和 Docker 使用经验，**Docker 方案的额外成本最低**，建议先用它；
Gondolin 需要 Node 24 之外再装 QEMU，与仓库 `.nvmrc` 固定的 Node 24 LTS 是否共存未验证。

试跑任务建议选白名单范围内、且结果可独立验证的：让它读 `week13-rag/` 并复述 eval 契约，然后本人
核对复述与 `w13-eval-v1` 冻结内容是否一致。这同时测工具，也测它对本仓库文档的理解精度。

**阶段 C：W15/W16 期间按需展开**

- W15：读 `pi-mcp-adapter` 源码，或自写最小 MCP extension。
- W16：解析 `~/.pi/agent/sessions/` 下的 JSONL 作为 trace 输入。

阶段 B 和 C 都是可选项。阶段 A 未完成时不进入 B。

---

## 7. 学习之外的日常使用建议

### 7.1 适合 Pi 的场景

- **需要接自建或本地推理端点。** 支持 llama.cpp router 与 custom provider，无 SaaS 后端，
  代码不经第三方服务。对公司数据不外流的要求友好。
- **需要把 agent 嵌进自己的程序。** `sdk.md` 给出的 `createAgentSession()` + `session.subscribe()`
  事件流，加上 `--mode rpc`（stdin/stdout JSONL）和 `--mode json`，三种接入形态都有。
  三者都不要求把 CLI 当子进程包装。
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
4. **来自仓库文件、注释、文档、上下文文件或构建输出的 prompt injection 属于预期内的本地 agent
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

1. extension 能否可靠拦截对指定目录的 `write` / `edit`，从而在工具层面阻断 `AGENTS.md` 黑名单项。
2. Pi 的 skill 格式与本仓库 `.claude/skills/` 下现有 skill 的实际兼容程度。
3. Gondolin 所需的 QEMU 与仓库 `.nvmrc` 固定的 Node 24 LTS 能否共存。
4. Discussion #3735 中列出的六项问题在 0.85.1 上各自的现状。
5. `pi.dev/packages` 画廊的实际内容与筛选机制（本会话网络策略阻断该域名）。
6. 各来源给出的星标数与 token 效率说法，均未核对。

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

本会话的网络策略阻断了 `pi.dev`、`en.wikipedia.org`、`dev.to`、`www.glukhov.org`、
`academy.kspl.tech`、`awesome-pi.site`，这些来源的内容仅来自检索摘要，未打开原文核对。
