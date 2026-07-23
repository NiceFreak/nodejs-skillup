# 经营报表管理后台 · 验收展示前端

> 原第 8 周「全栈整合 + 复盘」，在 7/31 收口计划中并入 **第 6 周（7/27–7/31）** 的收尾。
> 2026-07-16（W4 D4 后）应仓库主人要求提前完整接线：后端已有两个报表 API + JWT 认证 + 最小
> RBAC，本前端把它们接成可演示的**管理后台**（登录 → 数据可视化看板 → 鉴权链路演示），
> 直接服务 W4 D5 demo 与 W6 验收。

## 分工（2026-07-16 更新）

按 `AGENTS.md` 白名单与 2026-07-15 决策（前端仅为展示、AI 搭建、本人不写），**前端全部由 AI
搭建和维护，包括 API 接线**——原 `api.ts` 留给 W6 的接线 TODO 已按仓库主人要求由 AI 完成。
仍属于本人的学习任务：

| 部分 | 谁来做 |
|---|---|
| `src/frontend/` 全部：工程、页面、图表、API 接线 | ✅ AI 搭建维护 |
| 后端 API、鉴权与聚合逻辑（`week2-express/src/`） | 🧑 本人（黑名单，已在 W2–W4 完成） |
| 端到端链路的**验收讲解**：脱离代码讲清登录 → token → 401/403 → 报表数据流经各层 | 🧑 本人（W6） |
| 技术总结 / 周复盘 | 🧑 本人 |

技术栈：**React 18 + TypeScript + Vite**，图表为手写 SVG（零图表依赖）。

配套文档（`notes/`）：

- [`frontend-features-cheatsheet.md`](./notes/frontend-features-cheatsheet.md) —— 本前端实际用到的 ES2016+ / TS / React / Vite 能力速查表，与代码内 `[标签]` 注释互相索引
- [`frontend-toolbox.md`](./notes/frontend-toolbox.md) —— 全栈视角的前端实用工具箱（选型 + 生态资源，2026-07 现状）
- [`react-hooks-interview-map.md`](./notes/react-hooks-interview-map.md) —— Hooks 面试地图（给写惯 React 16 类组件的人）：心智模型转换、高频陷阱、考点与本仓库代码的对照
- [`legacy-projects-and-staying-current.md`](./notes/legacy-projects-and-staying-current.md) —— 存量项目生存指南 & 「我脱节了吗」校准：两个世界、可证伪的自我校准信号、存量经验的面试叙事

## 怎么跑

```bash
# 1. 起后端（week2-express/src，需要 MongoDB 与 .env 里的 JWT_SECRET）
cd week2-express/src && node --env-file=.env server.js   # 默认 3000 端口

# 2. 起前端
cd week8-fullstack/src/frontend
yarn install --immutable
yarn dev           # http://localhost:5173
# 其他脚本：yarn build（tsc + vite build）、yarn typecheck
# 统一用项目内 Yarn 3（见 .yarnrc.yml），不要用 npm install——绕过 yarn.lock 会造成依赖漂移
```

跨域由 Vite dev proxy 解决（见 `vite.config.ts`，`/auth`、`/reports`、`/users` 转发到
`http://localhost:3000`），后端无需加 CORS。后端端口不同时设 `VITE_API_TARGET`。

## 页面与演示路径

- **内部学习展板 `#/showcase`**：无需登录，可查看认证与授权、OAuth2、数据库聚合、Node.js 运行时知识；
  默认展示状态只显示中性技术内容，复习状态额外展开个人学习记录。两种状态是内容呈现区分，不是权限隔离。
- **受保护管理后台 `#/admin`**：未登录时显示真实注册 / 登录表单；登录后访问 admin-only 经营报表。
- **实验媒介分工**：匿名浏览器验证完整用户旅程，Postman 验证 HTTP 契约与失败分支，代码与 MongoDB 核对职责和持久化边界。

- **登录 / 注册**：调 `POST /auth/login`（契约 v2 信封）与 `POST /auth/register`；新注册账号默认
  `member`。
- **报表看板（admin-only）**：筛选行（订单状态 / 月度窗口 / 天数窗口）→ KPI 行（总销售额、
  订单数、客单价、活跃客户）→ 月度销售趋势柱状图 + 客户消费 Top 8 条形图，每张图可切换表格
  视图；数据来自 `GET /reports/monthly-sales` 与 `GET /reports/customer-spending`。
- **OAuth2 流程页**：以 tab 形式展示授权码流程、`code/access token/client_secret/JWT` 边界与
  `state/redirect_uri` 威胁点；这是 W4 的讲解型 demo，不接真实第三方登录。
- **鉴权链路演示面板**：一键发起「不带 token」与「带当前 token」的报表请求，把
  401（validateToken）/ 403（requireRole）/ 200 的真实响应记录成列表——W4 的
  RBAC 三条验证路径可现场复现。
- member 登录时看板降级为 403 说明卡（RBAC 正常工作的展示，不是错误页）。

**D5/验收 demo 建议动线**：注册新账号 → 登录（member）→ 看板 403 + 演示面板 403 →
mongosh 提权（命令见根 README「常用命令」）→ 重新登录 → 看板出数据 + 演示面板 200。

## 验收标准（沿用原计划）

- demo 跑通整条链路：登录（鉴权）→ 报表数据（聚合查询）→ 401/403/200 三条路径。
- 技术总结讲清整体架构，并点明整个 skillup 过程如何借助并驾驭 AI。
- 前端不作为验收重点。

## Backlog

- AI 功能整合（智能总结等）：7/31 后如补 AI demo 再启用。
- 报表错误响应仍是 `{ error }` 旧信封；W6 全量迁移后同步前端 `readErrorMessage`（现已兼容两种形状，届时可简化）。
