# 当前学习状态

> 最后更新：2026-07-27（Asia/Shanghai）

## 当前进度

- 当前周：**W6 · 测试与工程化 + 全栈整合 + 复盘收尾**。
- 当前 Day：**W6 Day 1 已开启**；硬截止时间为 **2026-07-31**。
- 应用代码：`week2-express/src/`；本周计划与笔记：`week6-testing/notes/`。
- 展示前端：`week8-fullstack/src/frontend/`，属于白名单展示资产，不能替代后端学习验收。

## 最近验收

- W5 已完成：事件循环、主线程阻塞、threadpool、Stream / 背压、错误边界、graceful shutdown 与 Worker 使用边界均已形成实验或讲解证据。
- 2026-07-27 重新完成 Worker 对比：主线程版会拖延 heartbeat 与并发 `/ping`；Worker 版保持主线程响应，但不代表计算本身加速。
- `DEBT.md` ①–⑧均已还；最后一项注册竖切能准确复述 `Repository(11000 → EmailConflictError) → Service / Controller 透传 → Express 5 → 全局 error handler(409)`。
- 四问复盘和下午 demo 是非阻断记录 / 展示项，不影响 W6 启动。
- 状态文件精简、通用展示部署规范和 deploy skill 中文化已完成；不再占用 W6 学习主线。

详细的 W5 过程和证据见：

- `week5-nodejs-internals/notes/week5-completed-retrospective.md`
- `week5-nodejs-internals/notes/day5-error-boundaries-process-lifecycle.md`
- `DEBT.md`

## 当前主线

W6 Day 1 先建立真实测试覆盖地图，再由本人选择关键路径、测试数据和核心断言。

```text
现有测试基线
→ 已有行为 / 已有覆盖 / 未保护风险
→ 认证关键路径集成测试
→ CI 使用稳定的 MongoDB 测试环境并跑绿
→ 全栈接线与最终总结
```

## 下一步

1. 回到 W6 D1 风险选择题：在 register、login、受保护资源中选择第一条需要自动化保护的行为，并说明契约、回归后果与优先级。
2. 本人实现所选测试的场景、数据与核心断言；AI 只做 L1/L2 引导和 review。
3. 测试补全后处理 CI 的 `MONGODB_URI` / `mongodb-memory-server` 选择，再进入全栈 demo 与总结。

## 当前风险

- 认证 register / login / 受保护资源串联尚无自动化测试。
- CI 提供 MongoDB service，但现有集成测试固定启动 `mongodb-memory-server`，尚未读取 `MONGODB_URI`。
- 错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状；本周只在影响关键链路时处理。
- `week2-express/src/match-index-explain.js` 仍不可运行，但不是 W6 当前硬任务。
- Login timing、401/403 服务端原因日志、旧用户 role 行为与真实 OAuth2 接入均为已知非阻断遗留。
- 7/31 时间不足时先砍前端润色、附加 demo 和非关键单测，不压缩关键路径测试与 CI。

## 验证基线

- 后端：2026-07-27 在 `week2-express/src/` 运行 `npm test -- --runInBand`，**2 个套件、7 个测试通过**；覆盖 5 个 validator 单测及月度报表 admin 200 / member 403。
- 前端：最近一次 `yarn typecheck` 与 `yarn build` 通过；部署前必须按 `SHOWCASE-DEPLOY-PROTOCOL.md` 重新验证。
- 当前工作区存在本轮学习记录和文档维护改动；恢复时必须先看 `git status --short`，不得覆盖用户改动。

## 恢复入口

新对话按顺序读取：

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. `README.md` 的 W6 部分、`week6-testing/notes/week6-plan.md`、`week6-testing/notes/day1.md`。
3. `git status --short`、当前步骤直接相关的代码和测试。
4. 仅在追溯结论时读取 W5 复盘或更早笔记；欠债状态只以 `DEBT.md` 为准。

## AI 协作边界

- W6 的测试场景选择、测试数据、核心断言、生命周期和端到端串联属于黑名单，AI 最高提供 L2；触发 L2 时按 `DEBT.md` 记账。
- CI 配置、展示前端、部署脚手架和记录整理属于白名单，AI 可做最小必要修改。
- 重建题一次性给出、集中作答、统一 review；不以重复确认或展示活动拖延当前周主线。
- 居家手机任务仍固定为每天 1–2 个时段、每段不超过 40 分钟；具体执行记录写入当天笔记，不再写入本状态文件。
