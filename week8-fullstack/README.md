# Week 6 收尾 · 全栈整合 Demo

> 原第 8 周「全栈整合 + 复盘」，在 7/31 收口计划中并入 **第 6 周（7/27–7/31）** 的收尾。
> 目标：把 W1–W5 的后端产出（MongoDB 建模、CRUD API、聚合查询、认证鉴权、底层优化）
> 接成**一条端到端链路**，配一个最简验收前端，再写整体技术总结 / 复盘。

## 这份脚手架里，哪些是 AI 搭的、哪些是你要做的

按 `AGENTS.md`：**前端验收界面脚手架**可以由 AI 直接给。前端不属于本期学习目标，只负责展示后端成果；
但**端到端串联、后端契约理解和验收讲解**是本周的学习点，属于你的核心任务，AI 不代写。

| 部分 | 谁来做 |
|---|---|
| `src/frontend/` 的壳：React + TS 工程、页面布局、视图切换、状态与渲染 | ✅ AI 已搭好 |
| `src/frontend/src/api.ts` 里的真实端点接线（`login()` / `fetchList()` 的 TODO） | 🧑 你来接（对着自己 W2/W4 的后端路由） |
| 后端各能力整合进同一个服务、跑通整条链路 | 🧑 你来做 |
| 技术总结 / 复盘（汇总前三周的周复盘） | 🧑 你来写 |

技术栈：**React 18 + TypeScript + Vite**，最小可运行。

## 怎么跑

```bash
cd week8-fullstack/src/frontend
npm install
npm run dev        # http://localhost:5173
# 其他脚本：npm run build（tsc + vite build）、npm run typecheck
```

后端另起（你 W2/W4 的服务）。接线时若遇跨域，在后端加 CORS，或在 `vite.config.ts` 里配 `server.proxy`。

## 验收标准（沿用原计划）

- demo 跑通整条链路：登录（鉴权）→ 拉取列表（数据操作）。
- 技术总结讲清整体架构，并点明整个 skillup 过程如何借助并驾驭 AI。
- 前端不作为验收重点。

## 页面

3 个视图占位：**登录 / 列表 / AI 功能（backlog，禁用占位）**。
AI 功能整合已移入 backlog，7/31 后如补 AI demo 再启用那块。
