# Node.js Skillup · 学习展板与经营报表管理后台

> 原第 8 周「全栈整合 + 复盘」，在 7/31 收口计划中并入 **第 6 周（7/27–7/31）** 的收尾。
> 2026-07-16 起提前接线管理后台；随后逐步加入 W3/W4/W5 学习展板。当前前端包含两个明确区域：
> 无需登录的**学习展板**用于展示和主动复习，受保护的**经营报表管理后台**用于验证真实 API、JWT 与 RBAC。

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

技术栈：**React 18 + TypeScript + Vite**，图表为手写 SVG；Markdown 速览使用
`react-markdown + remark-gfm`，直接读取仓库原文并保留 GFM 表格。

配套文档（`notes/`）：

- [`visualization-optimization-roadmap.md`](./notes/visualization-optimization-roadmap.md) —— 已完成的学习展板三阶段可视化优化路线、验证基线与恢复入口
- [`frontend-features-cheatsheet.md`](./notes/frontend-features-cheatsheet.md) —— 本前端实际用到的 ES2016+ / TS / React / CSS / Vite 能力速查表，核心语言模式可与代码内 `[标签]` 注释互相索引
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
# 构建：yarn build 产管理后台（默认）；VITE_SHOWCASE_ONLY=1 产学习展板——见下节「双入口构建产物」
# 统一用项目内 Yarn 3（见 .yarnrc.yml），不要用 npm install——绕过 yarn.lock 会造成依赖漂移
```

## 双入口构建产物（2026-08-13）

同一份源码按构建期开关产出两种独立入口产物，各自**从依赖树层面排除**另一侧模块：

| 构建 | 命令 | 产物入口 | 内容 |
|---|---|---|---|
| 管理后台（admin） | `yarn build` | `index.html`（默认）+ `admin.html` | 登录 / JWT / RBAC / 报表；不含展示树（15 份 .md、w9Facts 拓扑、W9 板） |
| 学习展板（showcase） | `VITE_SHOWCASE_ONLY=1 VITE_API_BASE="" yarn build` | `index.html`（默认）+ `showcase.html` | 零后端学习展板；不含管理后台（Dashboard / AuthView / api） |

- `index.html` 是两种构建共有的默认入口（部署根路径）：渲染哪个 App 由 `src/main.tsx` 的**构建期条件导入**决定，未选中分支是编译期 dead code，被 Rollup 从产物中移除。
- 命名入口 `admin.html` / `showcase.html` 是产物身份标记，分别指向 `src/main-admin.tsx` / `src/main-showcase.tsx`；缺失某个命名入口说明当前 dist 不是对应构建。
- App 拆成 `AppAdmin`（仅 Dashboard / 登录）与 `AppShowcase`（完整展板），登录表单抽到 `AuthView` 供 admin 版复用；组件与业务逻辑零改动。
- 收益：admin 构建的 chunk 从「必然包含整棵展示树」变为仅 AppAdmin / Dashboard / styles；面试问答稿 ×2、W9 部署笔记 ×6、`w9Facts` 拓扑数据不再进入管理后台产物。

跨域由 Vite dev proxy 解决（见 `vite.config.ts`，`/auth`、`/reports`、`/users` 转发到
`http://localhost:3000`），后端无需加 CORS。后端端口不同时设 `VITE_API_TARGET`。

## 页面与演示路径

- **内部学习展板 `#/showcase`**：无需登录，可查看认证与授权、OAuth2、数据库聚合、Node.js 运行时、测试闭环与学习笔记（面试准备页只在复习状态出现）；
  认证页先以同一条端到端链路对照 401 / 403 / 200 的停止点与职责归属。展示状态直接给出完整链路；复习状态先要求口述两道门和停止层，再展开核对。两种状态是认知任务区分，不是权限隔离。
- **学习演进与关系图例**：导航下方固定呈现 W3 数据查询 → W4 身份边界 → W5 运行时 → W6 测试证据 → 产出「讲得出口」；全站统一使用一处调用流、资源、成功、受控拒绝、异常与未测量图例。
- **逐帧时间轴**：凡是「按顺序发生的事」都由同一套播放控件驱动（播放 / 暂停 / 单步 / 重放 + 帧号解说），
  见 `framePlayer.tsx`。覆盖认证端到端链路、OAuth2 时序、W3 pipeline 阶段、W5 八个知识点与 W6 全栈轨道；
  笔记页不适用。关键价值是**能停在中间态**——例如 W5 知识点 2 停在「timer 已到期但 callback 仍未执行」那一帧。
  逐帧解说是 `role="status"`，自动播放时读屏用户同样能获知当前发生了什么；`prefers-reduced-motion` 下不自动播放。
- **URL 即状态**：`mode`、`tab` 与 W3/W5/W6 当前 `topic` 均写入 hash，可刷新保留和直接分享。例如
  `#/showcase?mode=review&tab=runtime&topic=backpressure` 会直接进入背压专题的主动回忆入口。
- **受保护管理后台 `#/admin`**：未登录时显示真实注册 / 登录表单；登录后访问 admin-only 经营报表。
- **实验媒介分工**：匿名浏览器验证完整用户旅程，Postman 验证 HTTP 契约与失败分支，代码与 MongoDB 核对职责和持久化边界。

- **登录 / 注册**：调 `POST /auth/login`（契约 v2 信封）与 `POST /auth/register`；新注册账号默认
  `member`。
- **报表看板（admin-only）**：筛选行（订单状态 / 月度窗口 / 天数窗口）→ KPI 行（总销售额、
  订单数、客单价、活跃客户）→ 月度销售趋势柱状图 + 客户消费 Top 8 条形图，每张图可切换表格
  视图；数据来自 `GET /reports/monthly-sales` 与 `GET /reports/customer-spending`。
- **OAuth2 流程页**：以三参与者时序展示授权码流程，区分经过浏览器的前信道、后端直连第三方的
  OAuth 后信道与第一方会话交付；同时显示 `state/code/access token/client_secret/JWT` 边界。复习态按当前起点 / 终点先预测信道和凭据，再揭示当前消息。这是 W4 的讲解型 demo，不接真实第三方登录。
- **数据库聚合页**：五个知识点覆盖分层、customer spending 六阶段 pipeline 形状、自然月边界、复合索引与 `$lookup` 外键索引；复习态逐步揭示下一 stage，事实 / 能证明 / 没有证明与图相邻保留。
- **Node.js 运行时页**：八个知识点分成“调度与慢点诊断”“大数据流生产边界”“错误与进程收口”三组；统一四区 ownership map 明确主线程、threadpool、kernel I/O 与应用资源，专题内继续下钻背压、`pipeline()`、Worker 和 graceful shutdown。展示状态直接呈现中性内容，
  复习状态先要求口述判断链，再展开来源、实测证据、不能外推的边界与待重建状态。
- **测试闭环页**：Day 1 并排对照“真实 admin Token → 报表 200”和“新注册用户 → 报表 403”两条链，用覆盖拓扑、证据矩阵和资源时间轴说明 fixture / `JWT_SECRET` / 内存库生命周期以及状态码边界；Day 2 展示 CI / 本地三路数据库来源、共享 `mongo:7` 下的 suite 级逻辑库隔离、`Model.init()` 初始化等待点、teardown 顺序与远端 CI 证据。Day 3 用同一条八段跨层轨道对照 admin `200`、member `403`、无 Token `401` 的停止点，分开呈现调用顺序、职责归属与返回值来源。Day 4 把 W3–W6 收束成一条论证：四维框架（契约 / 职责 / 证据 / 限制）→ 因果主线 → 十层交付物形状 → 三组受控实验 → 九条关键纠错 → 六条当前限制 → 能力归属时间线 → 最终验证。四个 Day 都支持复习状态先口述再展开核对，可用 `#/showcase?tab=testing&topic=day4` 直接进入 Day 4。
- **面试准备页（仅复习状态）**：这是个人面试材料，不进对外 demo —— 展示状态下这个 tab 不出现，带 `tab=interview` 的链接会自动进入复习状态，在该页切回展示状态则落回默认页。把 `interview-prep/` 两份问答稿的结论做成五块可视化——强项分层（面试往哪引，三档处理方式贯穿全板）、
  两处答错过的题（❌ 旧答法 → ✅ 正确答法，复习态先遮住正确侧让人自己找错）、三组能报的数字（受控变量 + 前后指标 + 能证明 / 不能外推）、
  追问应答树（十个入口问题各走哪条路、每条的坑）、覆盖矩阵（W1–W6 映射到问答稿章节 + 唯一挡路的下一步）。
  可用 `#/showcase?tab=interview&topic=pitfall` 直接进入该板块。这块板不新增技术结论，只重排问答稿里已有的判断。
- **学习笔记页**：直接读取 `interview-prep/` 两份问答稿、本 README、`notes/` 下 Markdown 与 W6 心智模型；
  支持 GFM 表格、代码块和外部链接，当前笔记也写入 URL，例如 `#/showcase?tab=notes&topic=qa`。复习态先口述文档问题、判断规则和证据边界，再展开原文核对；一次 reveal 不写入 URL。
- **鉴权链路演示面板**：一键发起「不带 token」与「带当前 token」的报表请求，把
  401（validateToken）/ 403（requireRole）/ 200 的真实响应记录成列表——W4 的
  RBAC 三条验证路径可现场复现。
- member 登录时看板降级为 403 说明卡（RBAC 正常工作的展示，不是错误页）。

**W4 D5 已完成的历史 demo 动线**：注册新账号 → 登录（member）→ 看板 403 + 演示面板 403 →
mongosh 提权（命令见根 README「常用命令」）→ 重新登录 → 看板出数据 + 演示面板 200。

**W5 展示建议动线**：事件循环六阶段 → 主线程 / 网络 I/O / threadpool 归属 → pbkdf2 分批 →
三类慢诊断 → 背压暂停/恢复 → `pipeline()` 失败统一收口。fd/readiness 用于讲清职责链；
epoll/kqueue/IOCP 差异、TCP 重组和 parser 内部仍作为止步边界。

## 验收标准（沿用原计划）

- demo 跑通整条链路：登录（鉴权）→ 报表数据（聚合查询）→ 401/403/200 三条路径。
- 技术总结讲清整体架构，并点明整个 skillup 过程如何借助并驾驭 AI。
- 前端不作为验收重点。

## Backlog

- AI 功能整合（智能总结等）：7/31 后如补 AI demo 再启用。
- 报表错误响应仍是 `{ error }` 旧信封；W6 全量迁移后同步前端 `readErrorMessage`（现已兼容两种形状，届时可简化）。
