# Node.js Skillup

记录一段为期 8 周的 Node.js skillup 学习过程。目标方向：Full Stack Developer（BE: Node.js + MongoDB strong / FE: React general）。

学习以**每周可演示的 demo 或技术输出**为主线，进度通过本仓库的 commit 历史与下方清单追踪。

---

## 学习原则：如何使用 AI

这次 skillup 会用到 AI 辅助，因此定下一条规矩，确保学到的是真本事而非工具的代劳：**AI 可以讲解原理、可以 review，但核心代码我自己写；每个 demo 以「脱离 AI 从空白重建一遍」为真正的掌握标准。**

这条原则同时写入了仓库根目录的 [`AGENTS.md`](./AGENTS.md)，作为对在本仓库中运行的 AI agent（Codex、Claude Code 等）的实际约束——它们会被要求只讲解、不直接代写核心逻辑。

---

## 总进度

- [ ] 第 1 周：MongoDB 基础 + 数据建模
- [ ] 第 2 周：用 Express 从零搭建 RESTful API
- [ ] 第 3 周：Mongoose 进阶与查询优化
- [ ] 第 4 周：认证与鉴权
- [ ] 第 5 周：Node.js 底层原理（核心）
- [ ] 第 6 周：测试与工程化
- [ ] 第 7 周：AI 能力整合
- [ ] 第 8 周：全栈整合 + 复盘

---

## 八周计划总览

| 周次 | 主题 | 核心技术点 | 交付成果 |
|---|---|---|---|
| 1 | MongoDB 基础 + 数据建模 | 文档建模思维、嵌入 vs 引用、索引 | 订单系统建模设计 + explain 性能对比 |
| 2 | Express RESTful API | 中间件、请求生命周期、分层架构 | 完整 CRUD API，连通 MongoDB |
| 3 | Mongoose 进阶与查询优化 | ODM、聚合管道、查询性能 | 2–3 个复杂聚合场景 + 优化笔记 |
| 4 | 认证与鉴权 | JWT、OAuth2、RBAC、Web 安全 | 注册/登录/权限控制 + OAuth2 流程 |
| 5 | Node.js 底层原理（核心） | 事件循环、libuv、V8、流、worker threads | 体现底层理解的 demo + 原理说明 |
| 6 | 测试与工程化 | 单元/集成测试、CI | 测试套件 + CI 跑通 |
| 7 | AI 能力整合 | LLM API 集成、RAG、流式响应 | AI 功能 demo |
| 8 | 全栈整合 + 复盘 | 端到端串联、架构收口 | 全栈 demo（前端轻量）+ 技术总结 |

> 并行线：每周阅读 1–2 篇英文技术文档 / 写一段英文技术总结。

---

## 目录结构

```
nodejs-skillup/
├── README.md              # 本文件，学习总览与进度
├── week1-mongodb/
│   ├── notes/             # 概念笔记、建模取舍说明、explain 对比记录
│   ├── docker-compose.yml # MongoDB 环境
│   └── src/               # seed 脚本(造数据)
├── week1-mongoose/        # Mongoose 入门(提前在第 1 周完成)
│   ├── notes/             # Schema 校验、两层防线笔记
│   └── src/               # 可运行 demo(连库 + Schema + CRUD + 校验验证)
├── week2-express/
├── week3-mongoose/
├── ...
└── week8-fullstack/
```

每周一个目录，内部统一用 `notes/`（笔记与文字产出）和 `src/`（代码）两层，保持一致。

---

## 当前周：第 1 周验收清单

- [ ] Docker 跑起来的 MongoDB 实例 + 能用 Compass 连上（环境已就绪，缺一张 Compass 连接截图）
- [x] 一份常用查询速查笔记
- [ ] 订单系统文档结构设计（把建模决策写成一组示例文档 JSON，待补）
- [x] 建模取舍说明笔记（每个嵌入/引用决策写明理由）
- [x] `explain()` 索引前后性能对比记录
- [x] Mongoose 入门：Schema 校验与 CRUD（提前完成，见 `week1-mongoose/`）

> 原计划放到第 2 周开头的 Mongoose 入门，已提前在第 1 周完成（`week1-mongoose/`）。
> 第 3 周的「Mongoose 进阶与查询优化」(聚合管道等) 仍按原计划单独进行。

---

## Commit 习惯

- 每天至少一次 commit，记录当天产出。
- commit message 用简短描述，例如 `week1: 完成订单系统建模设计与取舍说明`。
- commit 历史即进度证明，便于自查与向团队展示。
