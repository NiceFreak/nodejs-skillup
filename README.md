# Node.js Skillup

记录一段 Node.js skillup 学习过程。目标方向：Full Stack Developer（BE: Node.js + MongoDB strong / FE: React general）。

学习以**每周可演示的 demo 或技术输出**为主线，进度通过本仓库的 commit 历史与下方清单追踪。

> **计划调整（2026-07-06）**：应公司要求，整体以 **7/31（周五）为 end date**，比原定八周提前两周。剩余排期从「6 周内容」收口为 **4 周**（W3–W6）。做法是**按优先级砍范围、保深度**，而非把内容前置挤压——挤压会让每周变浅，破坏「每周可演示 demo + 能脱离 AI 从空白重建」的验收标准。BE 主干（查询 / 认证 / 底层 / 测试）保持全深度；**全栈整合保留**为收尾 capstone（W1–W5 串成一个 demo + 复盘，前端基础 UI 由 AI 搭脚手架，属 `AGENTS.md` 允许的例外）；**AI 能力整合不单独占周**——整个学习过程本身（AI 作导师、可讲解可 review、核心自己写）已是 AI 能力的体现，在复盘中点明即可，有余力再补独立 AI demo（见文末 backlog）。

---

## 学习原则：如何使用 AI

这次 skillup 会用到 AI 辅助，因此定下一条规矩，确保学到的是真本事而非工具的代劳：**AI 可以讲解原理、可以 review，但核心代码我自己写；每个 demo 以「脱离 AI 从空白重建一遍」为真正的掌握标准。**

这条原则同时写入了仓库根目录的 [`AGENTS.md`](./AGENTS.md)，作为对在本仓库中运行的 AI agent（Codex、Claude Code 等）的实际约束——它们会被要求只讲解、不直接代写核心逻辑。

---

## 总进度

- [x] 第 1 周：MongoDB 基础 + 数据建模
- [x] 第 2 周：用 Express 从零搭建 RESTful API（连库 + 完整 CRUD 已通）
- [ ] 第 3 周（7/6–7/10）：Mongoose 进阶与查询优化 ← 进行中
- [ ] 第 4 周（7/13–7/17）：认证与鉴权
- [ ] 第 5 周（7/20–7/24）：Node.js 底层原理（核心）
- [ ] 第 6 周（7/27–7/31）：测试与工程化 + 全栈整合 demo + 复盘收尾
- [ ] ~~AI 能力整合（独立周）~~ → 不单独占周，能力由整个学习过程体现，复盘点明（见文末 backlog）

---

## 计划总览（收口版，end date 7/31）

| 周次 | 日期 | 主题 | 核心技术点 | 交付成果 |
|---|---|---|---|---|
| 1 | 已完成 | MongoDB 基础 + 数据建模 | 文档建模思维、嵌入 vs 引用、索引 | 订单系统建模设计 + explain 性能对比 |
| 2 | 已完成 | Express RESTful API | 中间件、请求生命周期、分层架构 | 完整 CRUD API，连通 MongoDB |
| 3 | 7/6–7/10 | Mongoose 进阶与查询优化 | ODM、聚合管道、查询性能 | 2–3 个复杂聚合场景 + 优化笔记 |
| 4 | 7/13–7/17 | 认证与鉴权 | JWT、OAuth2、RBAC、Web 安全 | 注册/登录/权限控制 + OAuth2 流程 |
| 5 | 7/20–7/24 | Node.js 底层原理（核心） | 事件循环、libuv、V8、流、worker threads | 体现底层理解的 demo + 原理说明 |
| 6 | 7/27–7/31 | 测试与工程化 + 全栈整合 + 复盘 | 单元/集成测试、CI；端到端串联；整体技术总结 | 测试套件 + CI 跑通 + 全栈 demo（前端轻量）+ 技术总结 |

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
- **复盘**从「W6 一次性大块」改为**每周五 15–30 min 滚动小结**，W6 只做汇总。
- **测试**从「W6 一次性补全」改为**随周随手写**（W3/W4 落地即补几个），也是更好的工程习惯；W5 核心周不塞测试。
- **CI 骨架 + 前端脚手架**属 `AGENTS.md` 允许 AI 直接给的脚手架，由 AI 提前备好，W6 直接用，不占本人时间；核心逻辑（测试用例、端到端串联、架构讲清）仍由本人完成。

### 移出本期的内容（backlog，7/31 后再评估）

- **AI 能力整合 · 独立 demo**（原 W7）：LLM API 集成、RAG、流式响应。**不单独占周**——公司一直在提 AI，但本期时间不足以单开一周；而 AI 能力已通过整个学习过程体现（AI 作导师、只讲解/review、核心自己写），在最终复盘里说明即可。若 7/31 后有余力，再单独补一个 AI 功能 demo。

> 空目录 `week7-ai/` 暂保留占位，不在本期排期内；`week8-fullstack/` 本期启用，用于全栈整合 demo。

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
├── week8-fullstack/       # W6 收尾用：src/frontend/ 前端脚手架(AI 搭) + README 说明分工
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

## Commit 习惯

- 每天至少一次 commit，记录当天产出。
- commit message 用简短描述，例如 `week1: 完成订单系统建模设计与取舍说明`。
- commit 历史即进度证明，便于自查与向团队展示。
