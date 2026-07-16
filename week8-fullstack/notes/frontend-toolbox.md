# 前端实用能力工具箱（全栈视角）

> 目标：做全栈项目时「这一类问题该拿哪个轮子」的速查，不自己造轮子。
> 按 2026-07 生态现状整理（来源见文末），选型标注了「默认选它」和「什么时候换」。
> 不求最全；白名单展示资产，AI 整理维护。本仓库前端见 `frontend-features-cheatsheet.md`。

## 1. 框架与脚手架

| 场景 | 默认选择 | 说明 |
|---|---|---|
| SPA / 后台管理 | **Vite + React** | CRA 已废弃，React 官方推荐 SPA 用 Vite；本仓库即此组合 |
| 需要 SSR / SEO / 全栈路由 | **Next.js**（App Router + Turbopack） | 元框架留存率第一；服务端组件适合内容型站点 |
| 轻量替代 | Vue 3 + Vite / SvelteKit | 团队栈决定；概念都相通（组件、响应式状态、路由） |

React 19 注意点：**React Compiler 自动做记忆化**，`useMemo/useCallback/React.memo`
手写场景大幅减少——本仓库是 React 18 所以仍手写（速查表第三节），升级后可逐步删。

## 2. 状态管理与数据获取（2026 共识：服务端状态和客户端状态分开管）

| 问题 | 默认选择 | 说明 |
|---|---|---|
| 服务端数据（拉取/缓存/重试/失效） | **TanStack Query** | loading/error/缓存失效/竞态/乐观更新全部开箱；「怎么 fetch」的标准答案 |
| 客户端全局状态 | **Zustand** | 极小 API；抽走异步逻辑后剩下的全局状态通常很少 |
| URL 即状态（筛选、分页） | **nuqs** | 把 query string 当 useState 用，可分享、可回退 |
| 大型/规范化需求 | Redux Toolkit | 仍活跃，但新项目一般 Zustand + Query 就够 |

本仓库的 `Dashboard.tsx` 手写了 loading/403/刷新保帧——正是 TanStack Query
帮你做掉的那类事，适合作为「为什么需要它」的对照样本。

## 3. UI 与样式

| 问题 | 默认选择 | 说明 |
|---|---|---|
| 组件库 | **shadcn/ui**（+ Radix + Tailwind） | 2026 事实标准：组件是复制进项目的源码而非黑盒依赖，AI 工具（v0/Claude Code/Cursor）默认生成它 |
| 原子化 CSS | **Tailwind CSS** | 配合组件库；小项目手写 CSS 变量也够（如本仓库 styles.css 的亮/暗 token） |
| 后台管理成品 | Ant Design / MUI | 需要「拿来即用的完整企业组件」时仍是快路径 |
| 图标 | lucide-react / iconify | shadcn 生态默认 lucide |

## 4. 数据可视化

| 场景 | 选择 | 说明 |
|---|---|---|
| React 项目常规图表 | **Recharts** | 声明式、上手快；shadcn/ui 的 charts 即基于它 |
| 大数据量 / 图型丰富 / 中文文档 | **Apache ECharts** | Canvas 渲染，性能和图型覆盖最广 |
| 完全定制 | **visx**（Airbnb）/ D3 | D3 当「可视化数学库」用，渲染交给 React |
| 两三种简单图型 | 手写 SVG | 本仓库 `charts.tsx` 的做法：省依赖、全控制；图一多就换库 |

无论用哪个：单系列别上彩虹色、双 Y 轴是反模式、图表要配表格视图（可访问性）——
这些设计规则不随库变。

## 5. 表单与校验

| 问题 | 默认选择 | 说明 |
|---|---|---|
| 表单状态 | **React Hook Form** | 非受控为主，性能好、样板少 |
| Schema 校验 | **Zod** | 一份 schema 同时产出 TS 类型 + 运行时校验；`z.infer<typeof schema>` |
| 前后端共享校验 | Zod schema 放共享包 | 与后端「所有输入都要校验」原则打通（W2/W4 学的服务端校验不可省） |

简单表单（如本仓库登录框）用 `FormData` + 原生 required 就够，别过度工程。

## 6. 测试与质量

| 层 | 默认选择 | 说明 |
|---|---|---|
| 单元/组件测试 | **Vitest + React Testing Library** | Vitest 与 Vite 同配置；RTL 按用户视角查询 DOM |
| E2E | **Playwright** | 本仓库验证截图即用其 Chromium；trace/录制调试体验好 |
| API mock | **MSW**（Mock Service Worker） | 拦网络层而非改代码，同一套 mock 供测试和开发 |
| Lint/格式化 | ESLint + Prettier（新趋势：**oxlint/Biome**，Rust 系快 50–100×） | 本仓库后端已配 ESLint+Prettier，前端可复用一套约定 |
| 错误监控 | Sentry | 全栈同一平台看前后端报错 |

## 7. AI 辅助前端开发（生态现状）

| 工具 | 定位 |
|---|---|
| **Claude Code** | 终端/IDE 里的 agent：读写真实代码库、跑命令、自验证；配合项目里的 `AGENTS.md`/skills 约束行为（本仓库的协作方式即是） |
| **v0.dev** | 文本 → shadcn/ui 页面原型，适合快速出 UI 初稿再搬进项目 |
| **Cursor / Windsurf / Copilot** | IDE 内补全与 agent 模式，日常编辑器路径 |
| **shadcn MCP / skills** | 让 agent 直接按 shadcn 正确姿势装配组件 |

要点：AI 生成 UI 的公共语言是「shadcn/ui + Tailwind + TS 源码文件」——组件以源码形式
进仓库，AI 和人都能改。这也是本仓库前端走「白名单 AI 搭建 + 人负责讲清链路」分工的
生态背景。

## 8. 资源清单（去哪里找轮子和讨论）

- 路线图：roadmap.sh/frontend（体系化查漏）
- 聚合列表：GitHub `awesome-react`、`awesome-vite`（先搜 awesome-xxx 再造轮子）
- React+TS 惯用法：`react-typescript-cheatsheet`（GitHub 同名仓库）
- 生态动向：State of JS / State of React 年度调查；TanStack、shadcn 官方文档的 guides 区
- 讨论区：对应库的 GitHub Discussions、r/reactjs；AI 工具类看 Anthropic docs 与社区目录

## 参考来源（2026-07 检索）

- [TanStack Query 官方：是否取代客户端状态管理](https://tanstack.com/query/v5/docs/framework/react/guides/does-this-replace-client-state)
- [TanStack in 2026: A Developer's Decision Guide](https://www.codewithseb.com/blog/tanstack-ecosystem-complete-guide-2026)
- [My React ecosystem stack in 2026](https://www.felgus.dev/blog/react-stack-2026)
- [My Frontend Stack In 2026（含 oxlint/MSW/Vitest/Playwright 全清单）](https://thetshaped.dev/p/my-frontend-stack-in-2026-react-nextjs-pnpm-vite-ts-tailwind-storybook-tanstack-zustand-zod-oxlint-oxfmt-msw-vitest-playright-sentry)
- [React 官方版本页（React 19.x 现状）](https://react.dev/versions)
- [Vite vs Next.js 2026](https://designrevision.com/blog/vite-vs-nextjs)
- [The Rise of shadcn/ui (2026)](https://www.shadcndeck.com/blog/rise-of-shadcn-ui-2026)
- [shadcn/ui Skills（AI 集成）](https://ui.shadcn.com/docs/skills)
- [Best AI Coding Tools 2026](https://automationatlas.io/rankings/best-ai-coding-tools-2026/)
- [9 best frontend AI tools for developers in 2026](https://www.eesel.ai/blog/frontend-ai-tools-developers)
