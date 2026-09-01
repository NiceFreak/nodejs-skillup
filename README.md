# Node.js Skillup

记录一段 Node.js skillup 学习过程。目标方向：Full Stack Developer（BE: Node.js + MongoDB strong / FE: React general）。

学习以**每周可演示的 demo 或技术输出**为主线，进度通过本仓库的 commit 历史与下方清单追踪。

> **计划调整（2026-07-06）**：应公司要求，整体以 **7/31（周五）为 end date**，比原定八周提前两周。剩余排期从「6 周内容」收口为 **4 周**（W3–W6）。做法是**按优先级砍范围、保深度**，而非把内容前置挤压——挤压会让每周变浅，破坏「每周可演示 demo + 能脱离 AI 从空白重建」的验收标准。BE 主干（查询 / 认证 / 底层 / 测试）保持全深度；**全栈整合保留**为收尾 capstone（W1–W5 串成一个 demo + 复盘，前端基础 UI 由 AI 搭脚手架，属 `AGENTS.md` 允许的例外）；**AI 能力整合不单独占周**——整个学习过程本身（AI 作导师、可讲解可 review、核心自己写）已是 AI 能力的体现，在复盘中点明即可，有余力再补独立 AI demo（见文末 backlog）。

> **第二轮（2026-08-10 起）**：第一轮已按 7/31 收口。第二轮原定 5 周（8/10-9/11），先补齐服务端交付链路与 AI 协作能力；W9-W11 收口后，2026-08-31 起转入独立的五周 AI Engineer reskill，学习时间线延长到 W16。排期与周次对照见下方总览。
>
> **方向调整（2026-08-28）**：第二轮原定目标对齐在招的两个方向（React + Node.js / React + Java）。因新的岗位方向，W12–W13 改为 **Python / AI Agent / RAG 主线**：**Java 已与 manager 沟通后移出本轮**（W9 jar 与 W11 Maven job 两处锚点同时作废），**React / Next 深化降级为长线路线**，不占本轮周次。岗位要求的兜底项（全栈、部署流水线）由 W9–W11 的既有成果承担。
>
> **五周扩展（2026-08-31）**：公司将 AI Engineer reskill 窗口扩展为五周。W12-W16 依次学习 Python、RAG、单 Agent harness、MCP 与 reliability/evals；Prompt engineering、Agent memory、MCP/Skills 生命周期与调度、AI SDLC、VS Code Codex/Cline 作为横切必修能力嵌入各周，不新增主线。Azure、OpenShift、前端和面试材料不进入主线。简洁执行表与参考链接见 [`AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`](./plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx)，完整能力结构与节假日容量见 [`ai-engineer-reskill-5-week-plan.md`](./plan/ai-engineer-reskill-5-week-plan.md)。

---

## 学习原则：如何使用 AI

这次 skillup 会用到 AI 辅助，因此定下一条规矩，确保学到的是真本事而非工具的代劳：**AI 可以讲解原理、可以 review，但黑名单里的核心代码我自己写——卡壳时 AI 按阶梯给援助，黑名单项止步于伪代码骨架（L2），且这条上限不接受对话当场的「这次例外」。每个核心 demo 以「理解、复盘，并最终脱离 AI 和文档从空白重建」为掌握标准；AI 给过骨架的知识点记入 [`DEBT.md`](./DEBT.md)，按重建梯子还债。**

黑白名单、辅助阶梯和重建梯子写在仓库根目录的 [`AGENTS.md`](./AGENTS.md)。VS Code Codex 与 Cline 都使用该文件作为项目规则入口，首次实操需在各自界面确认已加载。跨天、跨对话的状态恢复流程见 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md)，当前进度统一从 [`LEARNING-STATE.md`](./LEARNING-STATE.md) 读取。

---

## 本地环境版本

本仓库用根目录 [`.nvmrc`](./.nvmrc) 固定 Node.js 主版本：

```bash
nvm install
nvm use
node --version
corepack enable
```

当前选择 **Node 24 LTS**。前端展示项目 `week8-fullstack/src/frontend/` 另用项目内 Yarn 3.2.0（见该目录的 `.yarnrc.yml` 和 `packageManager`），并使用传统 `node_modules` 安装模式。

---

## 总进度

- [x] 第 1 周：MongoDB 基础 + 数据建模
- [x] 第 2 周：用 Express 从零搭建 RESTful API（连库 + 完整 CRUD 已通）
- [x] 第 3 周（7/6–7/10）：Mongoose 进阶与查询优化（3 个聚合场景 + explain 索引优化已完成）
- [x] 第 4 周（7/13–7/17）：认证与鉴权
- [x] 第 5 周（7/20–7/27 收口）：Node.js 底层原理（核心）
- [x] 第 6 周（7/27–7/31）：测试与工程化 + 全栈整合 demo + 复盘收尾
- [ ] ~~AI 能力整合（原独立周）~~ → 2026-08-31 已改为 W12-W16 五周 AI Engineer 主线

**第二轮与 AI reskill（8/10 起；W12 转入独立五周计划，见下方总览）**

- [x] 第 9 周（8/10–8/14）：从零到线上 - 部署链路
- [x] 第 10 周（8/17–8/21）：可观测性与线上排障
- [x] 第 11 周（8/24–8/28）：CI 流水线与自动化发布
- [ ] 第 12 周（8/31–9/4）：Python for AI Engineering + Bub 深读
- [ ] 第 13 周（9/7–9/11）：RAG Foundations
- [ ] 第 14 周（9/14–9/18）：Tool + Single-Agent Harness
- [ ] 第 15 周（9/21–9/24）：MCP 2026-07-28 + 旧版兼容对照
- [ ] 第 16 周（9/28–9/30）：Reliability、Evals 与综合重建

> **周次编号说明**：第 7、8 周没有作为学习周执行。原始 W7 只保留 harness 方案，W8 全栈整合并入 W6 收尾；目录继续保留原编号。第二轮历史 Excel 使用第 1-5 周编号；独立 AI reskill 工作簿直接使用仓库全局周次 W12-W16。

---

## 计划总览（收口版，end date 7/31）

| 周次 | 日期 | 主题 | 核心技术点 | 交付成果 |
|---|---|---|---|---|
| 1 | 已完成 | MongoDB 基础 + 数据建模 | 文档建模思维、嵌入 vs 引用、索引 | 订单系统建模设计 + explain 性能对比 |
| 2 | 已完成 | Express RESTful API | 中间件、请求生命周期、分层架构 | 完整 CRUD API，连通 MongoDB |
| 3 | 7/6–7/10 | Mongoose 进阶与查询优化 | ODM、聚合管道、查询性能 | 2–3 个复杂聚合场景 + 优化笔记 |
| 4 | 7/13–7/17 | 认证与鉴权 | JWT、OAuth2、RBAC、Web 安全 | 注册/登录/权限控制 + OAuth2 流程 |
| 5 | 7/20–7/27 收口 | Node.js 底层原理（核心） | 事件循环、libuv、V8、流、worker threads | 体现底层理解的 demo + 原理说明 |
| 6 | 已完成 | 测试与工程化 + 全栈整合 + 复盘 | 单元/集成测试、CI；端到端串联；整体技术总结 | 测试套件 + CI 跑通 + 全栈 demo（前端轻量）+ 技术总结 |

> 并行线：每周阅读 1–2 篇英文技术文档 / 写一段英文技术总结。

### 工作量平铺（避免 W5/W6 堆积）

W5 底层是核心大头、W6 又是收尾周，若把测试与复盘都压在最后会失衡。策略是**把「不占学习脑力」或「本该顺手做」的部分前置摊开**，W5 只保护核心、W6 只做收口：

| 周 | 主学习产出（大头） | 平铺进来的附加（轻量 / 前置） |
|---|---|---|
| **W3** 查询（有余量） | 聚合优化 2–3 场景 + 优化笔记 | 起「测试随手写」习惯（给查询/CRUD 补 1–2 测试）；写**第 1 篇周复盘**。*（并行：AI 提前搭好 CI 骨架 + 前端脚手架，备用）* |
| **W4** 认证（较满） | JWT/OAuth2/RBAC + Web 安全 | 给认证关键路径补 1–2 测试；写**第 2 篇周复盘** |
| **W5** 底层（核心 · **保护，不加码**） | 事件循环/libuv/流/worker threads | **只写第 3 篇周复盘**（15–30 min），不塞测试、不加别的 |
| **W6** 收尾（**已瘦身**） | 集成测试补全 + CI 跑绿；全栈端到端接线 + demo | 汇总前三周复盘 → 技术总结（**不从零写**），点明整个过程如何驾驭 AI |

要点：
- **复盘**从「W6 一次性大块」改为**每周收口时 15–30 min 滚动小结**，W6 只做汇总；不为守住“周五”形式占用碎片周末。
- **测试**从「W6 一次性补全」改为**随周随手写**（W3/W4 落地即补几个），也是更好的工程习惯；W5 核心周不塞测试。
- **CI 骨架 + 前端脚手架**属 `AGENTS.md` 允许 AI 直接给的脚手架，由 AI 提前备好，W6 直接用，不占本人时间；核心逻辑（测试用例、端到端串联、架构讲清）仍由本人完成。
- **W6 CI 数据库契约（已收口）**：集成测试现在优先读取 `MONGODB_URI`，本地缺少 URI 时回落 `mongodb-memory-server`；CI 显式连接 job 自带的 `mongo:7`，不再依赖 runner 临时下载 MongoDB 二进制。两个集成 suite 使用独立逻辑库，远端 CI 与外部分支重复运行均已验证。

### 移出本期的内容（backlog，7/31 后再评估）

> 优先级排序统一见根目录 [`BACKLOG.md`](./BACKLOG.md)（2026-07-29 建立，功利口径：
> 面试加分 > 真实项目 > 原理深挖）。本节保留各条的完整背景与决策理由，不重复排序。

- **AI 能力整合 · 独立 demo**（原 W7）：方向已收敛为本地只读的单 Agent Harness Lab，方案见 [`week7-ai/notes/single-agent-harness-lab-plan.md`](./week7-ai/notes/single-agent-harness-lab-plan.md)。本条于 2026-08-28 进入 W12-W13，两天后随学习窗口扩展进入 W12-W16 主线；通用契约沿用，任务级工具、预算、停止判据与 grader 仍由本人确定。
- **TypeScript 迁移练习**（2026-07-15 决策，W4 期间提出）：本期不引入 TS——理由：① 注意力是瓶颈，TS + Mongoose 的类型摩擦会精确落在当前最薄弱的数据库层，报错的信号与噪音混在一起；② 中途迁移学到的是「让编译器闭嘴」而不是类型系统；③ W6 是已瘦身的收尾保护周，不加码（否决「放 W6」的方案）。7/31 后的做法：**把 auth 竖切迁移为 TS，作为学 TS 的第一个练习**——迁移一段能空白重建的代码，认知负荷全部落在类型上，同时用类型把 W4 的契约（service 返回形状、`req.auth`、错误收窄）再验收一遍。前置条件：auth 相关欠债已还清。
- **后端上线 + CORS**（2026-07-24 提出）：本期后端跨域由 Vite dev proxy **有意绕开**（`vite.config.ts` 同源转发，后端零改动），CORS 因此从不是学习主题。零后端学习展板已发布到 GitHub Pages（见 `week8-fullstack/notes/deploy-pipeline.md`），但需要后端的管理后台是纯静态托管跑不了的。7/31 后若要让后台真链路上线，属新工程主题：选免费额度（MongoDB Atlas M0 + Render）或付费轻量（腾讯云/阿里云香港区免备案），并在后端加 CORS 中间件（`app.use(cors({ origin: <Pages 域名> }))`）+ 前端设 `VITE_API_BASE` 重构建。CORS 概念（同源策略 / 预检 / 为何 dev proxy 把它藏起来）值得在复盘点明。

> `week7-ai/` 只沉淀 Harness Lab 通用方案；实际 Python harness 安排在 W14。`week8-fullstack/` 保留既有全栈展示资产，本轮不新增前端主线。

---

## 第二轮与 AI Reskill 计划总览（8/10 起）

第一轮以 7/31 收口（W1-W6，上表）。第二轮历史输入是 [`Nodejs_Skillup_Plan_202608.xlsx`](./plan/Nodejs_Skillup_Plan_202608.xlsx)，最初按 5 周规划；W9-W11 已完成部署、排障和 CI。2026-08-31 起的 W12-W16 改用独立 [`AI Engineer Reskill 五周工作簿`](./plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx)。两个工作簿分别保留各自范围，不合并改写。

| 计划内序号 | 仓库周次 | 日期 | 主题 | 交付成果 | 状态 |
|---|---|---|---|---|---|
| 第二轮 · 第 1 周 | W9 | 8/10–8/14 | 从零到线上：部署链路 | 公网可访问的 HTTPS Node 服务 + 可复现部署文档；MongoDB 同机、仅本机访问 | ✅ 已收口 |
| 第二轮 · 第 2 周 | W10 | 8/17–8/21 | 可观测性与线上排障 | 日志关联 + 四项检查 + 三类故障演练 + 排障 runbook | ✅ 已收口 |
| 第二轮 · 第 3 周 | W11 | 8/24–8/28 | CI 流水线与自动化发布 | Jenkins 从零搭建 + 构建-测试-部署流水线 + 回滚策略 | ✅ 已收口（8/28） |
| AI 五周 · 第 1 周 | W12 | 8/31-9/4 | Python for AI Engineering + Bub 深读 | Python 项目基线 + Bub 阅读报告 + timeout/cancellation 真实记录 | 未开始 |
| AI 五周 · 第 2 周 | W13 | 9/7-9/11 | RAG Foundations | 冻结 corpus/eval + full-context/BM25/dense 对照 + 逐题失败分析 | 未开始 |
| AI 五周 · 第 3 周 | W14 | 9/14-9/18 | Tool + Single-Agent Harness | 只读 retrieval tool + JSONL trace + verifier + 多 trial | 未开始 |
| AI 五周 · 第 4 周 | W15 | 9/21-9/24 | MCP 2026-07-28 + 旧版兼容 | stdio server/client + tools/resources + 新旧消息流对照 | 未开始 |
| AI 五周 · 第 5 周 | W16 | 9/28-9/30 | Reliability、Evals 与综合重建 | 端到端串联 + 故障归因 + holdout 回归 + 确定性重建 | 未开始 |

W9-W11 是一条连续主线（手工部署 -> 会看会修 -> 自动化发布）。W12-W16 是独立依赖链（Python -> RAG -> Agent -> MCP -> reliability），Prompt、Agent memory、MCP/Skills 生命周期与调度、AI SDLC、VS Code Codex/Cline 作为横切能力进入既有实验；每周定义最低交接物，上一周的 stretch 不顺延阻塞下一周。9/25 与 10/1-10/7 的假期不承担主线容量。

2026-09-01 范围修订：W13 在构建检索前先执行 full-context 必要性门禁，W14 在自建最小 harness 前先跑
同题非 Agent 基线，并在自建后完成 OpenAI Agents SDK 职责对照。自建 RAG/harness 只作为教学实现，
不扩展为向量数据库、通用 Agent framework、多 provider 抽象或 multi-agent 系统；W16 负责收口从 W13
开始持续积累的 eval 与回归证据。

> 并行线不新增 AI 主题。Java 已退出；英语沿用 `DAILY-SPEAKING-PROTOCOL.md` 的现有节奏，不作为 AI 主线交付物或面试材料。

---

## 目录结构

```
nodejs-skillup/
├── README.md              # 本文件，学习总览与进度
├── week1-mongodb/
│   ├── notes/             # 概念笔记、建模取舍说明、explain 对比记录
│   └── src/               # seed 脚本(造数据)
├── week1-mongoose/        # Mongoose 入门(提前在第 1 周完成)
│   ├── notes/             # Schema 校验、两层防线笔记
│   └── src/               # 可运行 demo(连库 + Schema + CRUD + 校验验证)
├── week2-express/
├── week3-mongoose/        # notes/week3-plan.md 有本周每日 checklist（含平铺任务）
├── ...
├── week8-fullstack/       # W6 收尾用：src/frontend/ React+TS+Vite 脚手架(AI 搭) + README 说明分工
│                          # 也承载学习展板（src/frontend/src/W*Board.tsx，复习态资产）
├── week9-deployment/      # 第二轮 W9：部署链路（D1–D5 笔记、权限速查表、Nginx 站点副本）
├── week10-observability/  # 第二轮 W10：可观测性（notes/runbook.md、四项检查脚本与 systemd unit 副本）
├── week11-ci/             # 第二轮 W11：CI 流水线与自动化发布（notes/week11-plan.md 起步）
├── interview-prep/        # 面试问答稿与 DB 自测稿（展板「面试准备」板的配套文稿）
├── incidents/             # 事故复盘（CI 相关）
├── plan/                  # 各轮计划表格存档与对照说明（见 plan/README.md）
├── .github/workflows/     # ci.yml —— CI 骨架(AI 搭)，有测试才跑、否则跳过
└── docker-compose.yml # MongoDB 环境
```

每周一个目录，内部统一用 `notes/`（笔记与文字产出）和 `src/`（代码）两层，保持一致。

---

## 第 1 周验收清单（已完成 ✓）

- [x] Docker 跑起来的 MongoDB 实例 + 能用 Compass 连上
- [x] 一份常用查询速查笔记
- [x] 订单系统文档结构设计（建模决策已用 Mongoose 落成真实文档，见 `week1-mongodb/order-system/`）
- [x] 建模取舍说明笔记（每个嵌入/引用决策写明理由）
- [x] `explain()` 索引前后性能对比记录
- [x] Mongoose 入门：Schema 校验与 CRUD（提前完成，见 `week1-mongoose/`）

> 原计划放到第 2 周开头的 Mongoose 入门，已提前在第 1 周完成（`week1-mongoose/`）。
> 第 3 周的「Mongoose 进阶与查询优化」(聚合管道等) 仍按原计划单独进行。

---

## 第 2 周进度（已完成 ✓）

- [x] Day 1：原生 `http` → Express，中间件管道（洋葱模型 + `next()`）
- [x] Day 2：分层架构（route / controller / service / repository）+ Router 收口 + 400/404 语义
- [x] Day 3：Mongoose 连库（`config/db.js` + 启动顺序）+ Read/Create 接真库 + 错误翻译分层（400/409/500）
- [x] Day 4+：Update / Delete，补齐完整 CRUD
- [x] 收尾：`users.http` 五端点手动测试集、优雅关闭（SIGINT/SIGTERM）、校验中间件

> 交付目标：完整 CRUD API + 连通 MongoDB。Read（列表/单个/400/404 边界）与 Create（201 + E11000→409 + ValidationError→400）已跑通并落笔记，见 `week2-express/notes/`。

---

## 第 3 周进度（已完成 ✓）

- [x] Day 1：聚合基础 `$match → $group → $sort`（客户消费统计报表）+ `explain` + 复合索引把慢查询变成 `COLLSCAN → IXSCAN` 的可对比证据
- [x] Day 2：多阶段管道 `$lookup → $unwind → $project` 关联查询 + populate/N+1 对比 + 首个单元测试
- [x] Day 3：月度趋势聚合（`$year`/`$month` 分组、跨年正确性，**脱离引导独立设计**）+ 从零搭集成测试（`mongodb-memory-server` + Supertest + 生命周期钩子）
- [x] Day 4：`$lookup` 关联性能 `explain("executionStats")`，坐实「关联主键走 `_id_` 索引 = 快」（`collectionScans: 0`）
- [x] Day 5：收官对照实验——关联无索引 `name` 字段全表扫（`collectionScans: 3`），建 `name_1` 索引后走索引（`3 → 0`）；demo 自测通过
- [x] 平铺任务：单元测试（`validateStatus` / `validatePositiveInt`）+ 集成测试（`monthly-sales` 全链路）；第 1 篇周复盘中文稿落笔

> 交付目标：2–3 个复杂聚合场景（已达 3 个）+ 一篇查询优化笔记（索引对 `explain` 的影响，已成篇）+ 能脱离 AI 从空白重建聚合 demo（月度趋势为独立设计）。均达标，见 `week3-mongoose/notes/`。
>
> **配套数据资产**：`week2-express/src/seedUsers.js` + `seedOrders.js` 造出真实电商量级数据（2000 用户 / ~4500 订单，含幂律复购、爆款 Zipf、618/双11 大促尖峰），让查询优化的性能对比更有观感。剩余 backlog（explain 建索引前后耗时量化脚本等）见 `week3-mongoose/notes/week3-plan.md`。

---

## 第 9 周进度（第二轮第 1 周 · 已完成 ✓）

**从零到线上：部署链路**（8/10–8/14）。目标机器：腾讯云轻量应用服务器，首尔二区，Ubuntu 22.04，2 核 / 2 GB / 40 GB，swap = 0。

- [x] D1（8/10）**冻结契约**：验收接口、端口表、失败路径、进程守护选型 —— [`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)
- [x] D2（8/11–8/12）**主机与 Node 内部服务**：最小权限用户、SSH 与 ufw、Node 运行时、systemd 七条契约 —— [`day2-host-and-node-service.md`](./week9-deployment/notes/day2-host-and-node-service.md)
- [x] D3（8/12）**收掉 D2 尾巴 + MongoDB 接通**：seed（2000 用户 / 5057 订单）、服务器内端到端 200、重启恢复、欠账补验、实测 RSS —— [`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md)
- [x] D4（8/12–8/13）**公网链路**三条子线：HTTP 反代 + ufw、公网 URL 面收敛 + 8080 管理后台 + HTTPS 签发、8081 学习展板独立部署 + 登录门禁
- [x] D5（8/14）**收口**：冷启动自愈、信任边界复核、能力检验 8 处当场修正、Q8 安全债还清、admin 迁 443 —— [`day5-rebuild-closeout.md`](./week9-deployment/notes/day5-rebuild-closeout.md)

> 交付成果：一个公网可访问的 HTTPS Node 服务（Nginx 反代 → systemd 守护的 Node → 同机且仅本机访问的 MongoDB），证书有效期至 2026-11-11、续期 timer 已验证；部署过程写成可复现文档。
> **Java stretch 未执行**（主线优先，未完成不阻断本周验收），并入 W11。
> 配套：[`server-permission-cheatsheet.md`](./week9-deployment/notes/server-permission-cheatsheet.md)（三种身份、属主表与 12 条坑族）、[`day5-demo-script.md`](./week9-deployment/notes/day5-demo-script.md)（8 分钟 demo 动线）、[`week9-roadmap-d1-d4.md`](./week9-deployment/notes/week9-roadmap-d1-d4.md)（全周浓缩地图 + 32 条认知修正 + 术语白话对照）。

---

## 第 10 周进度（第二轮第 2 周 · 已完成 ✓）

**可观测性与线上排障**（8/17–8/21）。在 W9 的环境之上加观测能力，不重新论证部署链路。

- [x] D1（8/17）**冻结观测契约**：记什么 / 不记什么 / 谁来关联 / 什么算红 / 哪些故障可以真做 —— 15 / 15 决策全部拍板
- [x] D2（8/18）**日志改造上线**：pino 结构化日志 + `requestId` 串起 Nginx 与 Node 两条日志流 + 脱敏；契约按 4 份 site 计数，实施单位是 **9 个反代 location**
- [x] D3（8/19）**四项检查 + systemd timer**（进程 / 内存 / 磁盘 / 证书），每项都亲手弄红一次并还原
- [x] D4（8/20）**三类故障真注入生产机**（反代配置错 / 端口占用 / 磁盘逼近满），五段式记录 + 预测 vs 实测偏差归因
- [x] D5（8/21）**runbook 成篇** + 隔一天不看笔记盲测两类故障走通（0 次翻笔记）+ check-disk 判据改字节级

> 交付成果：[`runbook.md`](./week10-observability/notes/runbook.md) —— 三类故障各自的症状 / 首查命令 / 判定分叉 / 修复 / 预防，加通用首查、三条监控盲区与速查表。
>
> **本周最主要的发现**：「假输入能红 ≠ 真条件该红」。D3 的弄红全部是假输入（改阈值、假证书），D4 三类真注入当场推翻了「检查脚本可信」这个前提，挖出三个监控盲区：
> - ① `df -BG` 取整——磁盘真降到 3.84 GiB 仍报绿。**已修**（判据改字节级，15:18 拿到「该红就红」实证）。
> - ② check-app 不探反代语义——443 根路径已经 502，四项检查仍全绿。**转 W11**（CI 部署验证）。
> - ③ nodeapp「假 active」——端口冲突时进程 active 但无监听、健康检查连不上。方向已定，**机制未验证，转 W11** 最小样本复现。

---

## 第 11 周计划（第二轮第 3 周 · D1 进行中）

**CI 流水线与自动化发布**（8/24–8/28）。把停留在使用层的 Jenkins 变成能独立从零搭建；**部署目标沿用 W9 的服务器**，不重复搭建云主机。

- Jenkins 从零安装与配置（controller 默认运行在开发机，不与 2 GB 的部署目标同机）
- Jenkinsfile 编写；构建 - 测试 - 部署流水线；凭据管理与环境分离；回滚策略
- 并入 W9 未做的 **Java stretch**（最小 Spring Boot jar + systemd + Nginx location）与 **Maven 构建 job**
- 延伸项（主线完成后再做）：构建产物存储（AWS S3 + IAM role，最小面）、用 Docker 统一构建环境

> 现成输入：W10 的**四项检查 + 五面基线 curl** = 流水线的部署后验证步骤（runbook 速查表是现成输入）；**runbook 的「预防」列** = 回滚策略输入。
> 承接 W10 两项未完：盲区②（check-app 反代可达性）补监控设计、类 2「假 active」最小样本复现与修复。
> 计划文件 [`week11-ci/notes/week11-plan.md`](./week11-ci/notes/week11-plan.md) 已于 **2026-08-24（D1）建立**，§5 的十八条决策待本人拍板后冻结成 `day1-release-contract.md`；当前进度以 [`LEARNING-STATE.md`](./LEARNING-STATE.md) 为准。
> 核对 Excel 时发现：第 3 周那一行的「验收标准」列写的是四条交付成果，**表里没有独立的 W11 验收标准句**（W9 / W10 各有一句），因此本周验收判据在计划 §7 自定。

---

## 常用命令

### MongoDB 与 SQL 概念对照

| MongoDB | SQL / 关系型数据库 |
|---|---|
| Database（数据库） | Database（数据库） |
| Collection（集合） | Table（表） |
| Document（文档） | Row（行） |

### mongosh 常用命令

1. 从终端连入测试数据库：

   ```bash
   mongosh -u root -p --authenticationDatabase admin
   ```

   执行后按提示输入密码。

2. 查看所有数据库：

   ```javascript
   show dbs
   ```

3. 选择 `week2` 数据库：

   ```javascript
   use week2
   ```

4. 新建索引：

   ```javascript
   db.<collection 具体命名>.createIndex({ <字段>: 1 })
   ```

5. 查看已存在的索引：

   ```javascript
   db.<collection 具体命名>.getIndexes()
   ```

6. 将账户提升为 admin

   ```javascript
   db.users.updateOne(
        { email: <账户邮箱> },
        { $set: { role: "admin" } }
    )
   ```

### 索引方向

| 值 | 含义 | 示例 |
|---|---|---|
| `1` | 升序（Ascending） | 数字从小到大、字符串 A 到 Z、日期从旧到新 |
| `-1` | 降序（Descending） | 数字从大到小、字符串 Z 到 A、日期从新到旧 |

---

## Commit 习惯

- 每天至少一次 commit，记录当天产出。
- commit message 用简短描述，例如 `week1: 完成订单系统建模设计与取舍说明`。
- commit 历史即进度证明，便于自查与向团队展示。
