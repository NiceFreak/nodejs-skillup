# 当前学习状态

> 最后更新：2026-07-28（Asia/Shanghai）

## 当前进度

- 当前周：**W6 · 测试与工程化 + 全栈整合 + 复盘收尾**。
- 当前 Day：**W6 Day 1 已完成，下一入口为 Day 2 / CI**；硬截止时间为 **2026-07-31**。
- 应用代码：`week2-express/src/`；本周计划与笔记：`week6-testing/notes/`。
- 展示前端：`week8-fullstack/src/frontend/`，属于白名单展示资产，不能替代后端学习验收。

## 最近验收

- W5 已完成：事件循环、主线程阻塞、threadpool、Stream / 背压、错误边界、graceful shutdown 与 Worker 使用边界均已形成实验或讲解证据。
- 2026-07-27 重新完成 Worker 对比：主线程版会拖延 heartbeat 与并发 `/ping`；Worker 版保持主线程响应，但不代表计算本身加速。
- `DEBT.md` ①–⑧均已还；最后一项注册竖切能准确复述 `Repository(11000 → EmailConflictError) → Service / Controller 透传 → Express 5 → 全局 error handler(409)`。
- W6 D1 已补齐认证流集成测试：已有 admin 真实登录后访问报表 `200`；新注册用户真实登录后访问 admin 报表 `403`。
- `auth-flow.test.js` 目标测试 2/2 通过，完整基线为 3 个套件 / 9 个测试全部通过，ESLint 0 errors。
- Week 8 已新增纯静态“测试闭环”tab，可视化覆盖增量、两条认证流、测试生命周期和证据边界；桌面 / 手机视口验证通过。
- 展示前端第一阶段可视化改造已完成：建立统一流程 / 资源 / 结果语义，认证页加入 401 / 403 / 200 端到端职责链与复习回忆门，OAuth2 补齐 `state` 校验和第一方会话交付边界；不改变 W6 Day 2 主线。
- 展示前端第二阶段可视化改造已完成：W5 统一四区 ownership map 并显式分开 threadpool / kernel I/O，W6 补齐覆盖拓扑、双认证链、证据矩阵与资源轴，W3 补齐真实六阶段 pipeline 形状和逐步复习揭示。
- 展示前端第三阶段可视化改造已完成：手机端补齐关系连续性，OAuth2 / 笔记加入预测后揭示，新增 W3 → W6 学习演进与全局唯一图例，并完成跨页一致性审查。
- 可视化三阶段已全部完成，恢复与验证基线记录在 `week8-fullstack/notes/visualization-optimization-roadmap.md`；展示前端暂无默认后续任务。
- 四问复盘和下午 demo 是非阻断记录 / 展示项，不影响 W6 启动。
- 状态文件精简、通用展示部署规范和 deploy skill 中文化已完成；不再占用 W6 学习主线。

详细的 W5 过程和证据见：

- `week5-nodejs-internals/notes/week5-completed-retrospective.md`
- `week5-nodejs-internals/notes/day5-error-boundaries-process-lifecycle.md`
- `DEBT.md`

## 当前主线

W6 Day 2 处理 CI 与集成测试的 MongoDB 环境契约，并让 CI 在明确、稳定的数据库来源上跑绿。

```text
认证关键路径集成测试已补齐
→ 对照 ci.yml 与测试数据库生命周期
→ 消除未使用的 MongoDB service 或内存库隐性下载依赖
→ CI 使用明确、稳定的 MongoDB 测试环境并跑绿
→ 全栈接线与最终总结
```

## 下一步

1. 对照 `.github/workflows/ci.yml` 与 `monthly-sales.test.js`、`auth-flow.test.js` 的数据库启动方式。
2. 本人先说明 CI 测试隔离、数据库来源和生命周期契约；再决定使用 `MONGODB_URI` service 还是 `mongodb-memory-server`。
3. 做最小调整并验证完整测试与 CI，之后进入全栈 demo 与总结。

## 当前风险

- CI 提供 MongoDB service，但现有集成测试固定启动 `mongodb-memory-server`，尚未读取 `MONGODB_URI`。
- `auth-flow.test.js` 的异常清理路径仍可能在数据库清理抛错时跳过 `JWT_SECRET` 恢复；正常路径已验证，不阻断 D1。
- 预期 `403` 会由全局 error handler 输出完整错误堆栈，造成测试 / CI 日志噪音，但不影响行为。
- 错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状；本周只在影响关键链路时处理。
- `week2-express/src/match-index-explain.js` 仍不可运行，但不是 W6 当前硬任务。
- Login timing、401/403 服务端原因日志、旧用户 role 行为与真实 OAuth2 接入均为已知非阻断遗留。
- 7/31 时间不足时先砍前端润色、附加 demo 和非关键单测，不压缩关键路径测试与 CI。

## 验证基线

- 后端：2026-07-27 在 `week2-express/src/` 运行 `npm test -- --runInBand auth-flow.test.js`，认证流 **1 个套件、2 个测试通过**；随后运行完整 `npm test -- --runInBand`，**3 个套件、9 个测试通过**，ESLint 0 errors。
- 前端：2026-07-28 运行 `yarn typecheck` 与 Pages 子路径生产构建通过；Playwright 最终矩阵覆盖 6 个 tab × 展示 / 复习 × 桌面 `1440 × 1000` / 手机 `390 × 844`，**24/24 通过**且无页面级横向溢出。401 / 403 / 200、OAuth callback、背压、shutdown、双测试流、聚合阶段揭示和笔记 reveal 均通过。当前仅完成本仓库源码与本地构建，未在本任务中发布 Pages。
- 当前工作区存在本轮学习记录和文档维护改动；恢复时必须先看 `git status --short`，不得覆盖用户改动。

## 恢复入口

新对话按顺序读取：

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. `README.md` 的 W6 部分、`week6-testing/notes/week6-plan.md`、`week6-testing/notes/day1-auth-flow-integration-testing.md`。
3. `git status --short`、当前步骤直接相关的代码和测试。
4. 仅在追溯结论时读取 W5 复盘或更早笔记；欠债状态只以 `DEBT.md` 为准。

## AI 协作边界

- W6 的测试场景选择、测试数据、核心断言、生命周期和端到端串联属于黑名单，AI 最高提供 L2；触发 L2 时按 `DEBT.md` 记账。
- CI 配置、展示前端、部署脚手架和记录整理属于白名单，AI 可做最小必要修改。
- 重建题一次性给出、集中作答、统一 review；不以重复确认或展示活动拖延当前周主线。
- 居家手机任务仍固定为每天 1–2 个时段、每段不超过 40 分钟；具体执行记录写入当天笔记，不再写入本状态文件。
