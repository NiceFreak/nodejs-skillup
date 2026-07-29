# 当前学习状态

> 最后更新：2026-07-29（Asia/Shanghai）

## 当前进度

- 当前周：**W6 · 测试与工程化 + 全栈整合 + 复盘收尾**。
- 当前 Day：**W6 Day 3 已完成，下一入口为整体技术总结**；硬截止时间为 **2026-07-31**。
- 应用代码：`week2-express/src/`；本周计划与笔记：`week6-testing/notes/`。
- 展示前端：`week8-fullstack/src/frontend/`，属于白名单展示资产，不能替代后端学习验收。

## 最近验收

- W5 已完成：事件循环、主线程阻塞、threadpool、Stream / 背压、错误边界、graceful shutdown 与 Worker 使用边界均已形成实验或讲解证据。
- 2026-07-27 重新完成 Worker 对比：主线程版会拖延 heartbeat 与并发 `/ping`；Worker 版保持主线程响应，但不代表计算本身加速。
- `DEBT.md` ①–⑧均已还；最后一项注册竖切能准确复述 `Repository(11000 → EmailConflictError) → Service / Controller 透传 → Express 5 → 全局 error handler(409)`。
- W6 D1 已补齐认证流集成测试：已有 admin 真实登录后访问报表 `200`；新注册用户真实登录后访问 admin 报表 `403`。
- `auth-flow.test.js` 目标测试 2/2 通过，完整基线为 3 个套件 / 9 个测试全部通过，ESLint 0 errors。
- W6 D2 已明确 CI 数据库契约：外部 `MONGODB_URI` 使用 `mongo:7`，本地缺少 URI 时使用 `MongoMemoryServer`，CI 缺 URI 或基础库名错误时连接前快速失败。
- 两个集成 suite 分别独占 `skillup_test_a` / `skillup_test_b`，并在 fixture 前等待相关 `Model.init()`；外部分支连续 5 轮无残留，远端 CI run #257 后端与前端 job 均成功。
- W6 Day 1 / Day 2 已收束为 [`week6-testing-ci-mental-model.md`](./week6-testing/notes/week6-testing-ci-mental-model.md)：主线是「测试证明行为可信，CI 让证据脱离本机重复执行」；学习展板测试闭环首屏已加入三层总览，桌面 / 手机验证通过。
- W6 D3 已完成全栈 demo 验收：真实 admin 登录后两个报表均返回 `200` 并成功渲染；member 登录成功后报表返回 `403` 并进入 `forbidden` 页面；无 token 探测返回 `401` 且不改变主页面状态。开发模式下两个报表各重复一次已确认来自 React `StrictMode`。
- D3 已能区分代码调用顺序、职责归属与返回值来源：JWT 只携带 `sub`，角色由 `requireRole` 查库；聚合由 MongoDB 执行，Mongoose 返回普通对象数组；Service 转换 Decimal128 DTO，前端再补齐空月份。
- Week 8 测试闭环页已加入 Day 1 / Day 2 分段与可分享的 `topic=ci` 状态；Day 2 可视化覆盖三路来源、双逻辑库、初始化竞争、资源轴和 CI 证据，展示 / 复习交互均已验证。
- Week 8 测试闭环页已补入 Day 3 与可分享的 `topic=fullstack` 状态：同一条八段跨层轨道对照 admin `200`、member `403`、无 Token `401` 的停止点，并分开呈现调用顺序、职责归属、返回值来源、身份边界与成功返回形状；展示 / 复习、桌面 / 手机、浅色 / 深色均已验证。
- Week 8 已新增纯静态“测试闭环”tab，可视化覆盖增量、两条认证流、测试生命周期和证据边界；桌面 / 手机视口验证通过。
- 展示前端第一阶段可视化改造已完成：建立统一流程 / 资源 / 结果语义，认证页加入 401 / 403 / 200 端到端职责链与复习回忆门，OAuth2 补齐 `state` 校验和第一方会话交付边界；不改变 W6 Day 2 主线。
- 展示前端第二阶段可视化改造已完成：W5 统一四区 ownership map 并显式分开 threadpool / kernel I/O，W6 补齐覆盖拓扑、双认证链、证据矩阵与资源轴，W3 补齐真实六阶段 pipeline 形状和逐步复习揭示。
- 展示前端第三阶段可视化改造已完成：手机端补齐关系连续性，OAuth2 / 笔记加入预测后揭示，新增 W3 → W6 学习演进与全局唯一图例，并完成跨页一致性审查。
- 可视化三阶段已全部完成，恢复与验证基线记录在 `week8-fullstack/notes/visualization-optimization-roadmap.md`。
- 2026-07-28 另做一轮展示前端审计（第四轮，白名单），只修可测量缺陷、不新增展示内容：深色依赖箭头对比度 1.65:1、`role="tablist"` 半实现（无 tabpanel / 方向键）、手机端 `summary` 点击目标仅 14–17px、手机端字号下限、`OAuth2FlowPanel` 耦合导致管理后台代码进入静态展板构建、标题靠部署脚本事后改写。审计结论与「明确不做」记录在同一份 roadmap 的第四轮小节。
- **展示前端到此为止**：剩余唯一候选是认证主链改真泳道，已评估为净收益但属「前端润色」，按 `week6-plan.md` §3 砍项顺序排在第一位，7/31 前不做，归入 backlog。
- 四问复盘和下午 demo 是非阻断记录 / 展示项，不影响 W6 启动。
- 状态文件精简、通用展示部署规范和 deploy skill 中文化已完成；不再占用 W6 学习主线。

详细的 W5 过程和证据见：

- `week5-nodejs-internals/notes/week5-completed-retrospective.md`
- `week5-nodejs-internals/notes/day5-error-boundaries-process-lifecycle.md`
- `DEBT.md`

## 当前主线

W6 进入最终总结：基于 W3/W4/W5 既有复盘与 W6 测试、CI、全栈验收证据，汇总整体技术链路与 AI 协作边界。

```text
认证关键路径集成测试已补齐
→ CI 数据库来源、隔离与生命周期已验收
→ 前后端契约与登录、权限、报表最小 demo 已验收
→ 汇总 W3/W4/W5/W6 技术证据
→ 完成最终总结
```

## 下一步

1. 汇总 W3 聚合与优化、W4 认证鉴权、W5 Node.js 底层三篇既有复盘。
2. 补入 W6 的测试可信度、CI 可重复性与 `401 / 403 / 200` 全栈验收证据。
3. 点明 AI 仅作导师 / reviewer、核心实现由本人完成，以及欠债与延迟重建如何防止能力外包。

## 当前风险

- CI 数据库来源与 suite 隔离已解决；异常清理路径若 `dropDatabase()` 或 `disconnect()` 抛错，后续资源释放或 `JWT_SECRET` 恢复仍可能跳过，正常路径不阻断。
- 预期 `403` 会由全局 error handler 输出完整错误堆栈，造成测试 / CI 日志噪音，但不影响行为。
- React 开发模式的 `StrictMode` 会让 Dashboard 首次挂载的两个报表请求各执行两次；生产构建不重复，当前不作为缺陷处理。
- 错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状；本周只在影响关键链路时处理。
- `week2-express/src/match-index-explain.js` 仍不可运行，但不是 W6 当前硬任务。
- Login timing、401/403 服务端原因日志、旧用户 role 行为与真实 OAuth2 接入均为已知非阻断遗留。
- 7/31 时间不足时先砍前端润色、附加 demo 和非关键单测，不压缩关键路径测试与 CI。

## 验证基线

- 后端：2026-07-28 本地默认并行 **3 个套件、9 个测试通过**，ESLint 0 errors；外部 MongoDB 分支连续 5 轮全部通过且无 suite 数据库残留；GitHub Actions [CI run #257](https://github.com/NiceFreak/nodejs-skillup/actions/runs/30342990043) 的 `test` / `frontend` job 均成功。
- 前端：2026-07-28 运行 `yarn typecheck` 与生产构建通过；新增 W6 Day 2 在桌面 `1440 × 1000` 与手机 `390 × 844` 完成截图检查，手机页面 `scrollWidth === clientWidth === 390`，复习态隐藏 / 展开证据正常。此前 Playwright 最终矩阵覆盖 6 个 tab × 展示 / 复习 × 桌面 / 手机共 **24/24 通过**。
- 前端第四轮审计（同日）复测：11 个视图 × 桌面 / 手机均无页面级横向溢出、无 console 错误；`tablist` / `tab` / `tabpanel` 经 CDP 可及性树确认已暴露，方向键与 Home/End 实测有效；桌面 10/11 视图高度逐像素不变（认证 tab 矮 6px，视觉无差异）。**仅完成源码与本地构建，未发布 Pages。**
- W6 主线总览（同日）复测：`typecheck`、生产构建通过；Playwright 在 `1440 × 1000` 与 `390 × 844` 验证 2/2 通过，两种视口均满足 `scrollWidth === clientWidth`、总览文字未越界且无 console error。**仅完成源码与本地构建，未发布 Pages。**
- W6 D3（2026-07-29）真实浏览器验收：admin `POST /auth/login → 200`，两类报表均 `GET → 200` 并渲染；member 登录 `200` 后两类报表均 `403`，页面进入 `forbidden`；无 token probe `GET → 401`，主页面仍保持 `forbidden`。开发模式报表请求因 `StrictMode` 各出现两次，与预测一致。
- W6 Day 3 展板（同日）复测：`yarn typecheck`、`VITE_SHOWCASE_ONLY=1 yarn build` 通过；生产静态预览在 `1440 × 1000` 与 `390 × 844` 均满足 `scrollWidth === clientWidth`、无 console error、无后端请求，三路径切换分别定位 `200 / 403 / 401`；手机路径停止点自动居中，复习态先隐藏后揭示。**仅完成源码与本地构建，未发布 Pages。**
- 恢复时必须先看 `git status --short`，不得覆盖用户改动。

## 恢复入口

新对话按顺序读取：

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. `README.md` 的 W6 部分、`week6-testing/notes/week6-plan.md`、`week6-testing/notes/day3-fullstack-integration-validation.md`。
3. `git status --short`、当前步骤直接相关的代码和测试。
4. 仅在追溯结论时读取 W5 复盘或更早笔记；欠债状态只以 `DEBT.md` 为准。
5. 7/31 后规划下一步时读 `BACKLOG.md`；它是候选任务优先级的唯一入口。

## AI 协作边界

- W6 的测试场景选择、测试数据、核心断言、生命周期和端到端串联属于黑名单，AI 最高提供 L2；触发 L2 时按 `DEBT.md` 记账。
- W6 D3 仅使用 L1 提问与既有代码 review；端到端预测、实测和链路讲解由本人完成，未触发新债务。
- CI 配置、展示前端、部署脚手架和记录整理属于白名单，AI 可做最小必要修改。
- 重建题一次性给出、集中作答、统一 review；不以重复确认或展示活动拖延当前周主线。
- 居家手机任务仍固定为每天 1–2 个时段、每段不超过 40 分钟；具体执行记录写入当天笔记，不再写入本状态文件。
