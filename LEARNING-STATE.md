# 当前学习状态

> 最后更新：2026-07-31（Asia/Shanghai）

## 当前进度

- 当前周：**W6 已完成；本期 W1–W6 学习计划已于 2026-07-31 收口**。
- 当前 Day：**W6 Day 5 已完成**。最终 demo 彩排由本人确认完成；实际时长与逐项结果未提供，不补写未经确认的细节。
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
- D3 已能区分代码调用顺序、职责归属与返回值来源：JWT 的业务自定义 claim 只放 `sub`、不放 role（库另生成 `iat` / `exp`），角色由 `requireRole` 查库；聚合由 MongoDB 执行，Mongoose 返回普通对象数组；Service 转换 Decimal128 DTO，前端再补齐空月份。
- W6 D4 已完成整体技术总结：本人能以注册 / 登录 / 报表 `200 / 403 / 401` 业务终点组织 W3–W6，分开说明调用顺序、职责、返回值、实测事实、受控推断与不能外推的限制；正式结论见 [`day4-overall-technical-summary.md`](./week6-testing/notes/day4-overall-technical-summary.md)，逐轮纠错保留在 [`day4-raw-learning-log.md`](./week6-testing/notes/day4-raw-learning-log.md)。
- D4 关键校准已收口：W6 是在直接签 token 的报表测试之外**新增**真实登录链测试；Worker 结论限定为“本次单任务实验未显示计算加速”；W3 只使用 Day 5 可追溯的 `name` 索引 explain 前后指标；CORS 被限定为生产跨 Origin 拓扑下的条件性要求。
- Week 6 最终 demo 讲稿已建立为 [`week6-demo-script.md`](./week6-testing/notes/week6-demo-script.md)；本人于 2026-07-31 确认彩排完成，收口记录见 [`day5-final-demo-rehearsal-and-closeout.md`](./week6-testing/notes/day5-final-demo-rehearsal-and-closeout.md)。
- 2026-07-30 讲稿随展板同步更新：预开页面补入 `topic=day4`；收尾改用整体总结页第一屏（四个维度即收尾白的顺序，换画面不加内容）；8 分钟超时预案改为「用 day4 的三组受控实验一屏讲完」，省掉 W3 / W5 两次跨 tab 切页；新增一条现场纪律——全程保持展示状态，复习状态会露出个人面试材料。彩排验收清单相应加一条。
- Week 8 测试闭环页已加入 Day 1 / Day 2 分段与可分享的 `topic=ci` 状态；Day 2 可视化覆盖三路来源、双逻辑库、初始化竞争、资源轴和 CI 证据，展示 / 复习交互均已验证。
- Week 8 测试闭环页已补入 Day 3 与可分享的 `topic=fullstack` 状态：同一条八段跨层轨道对照 admin `200`、member `403`、无 Token `401` 的停止点，并分开呈现调用顺序、职责归属、返回值来源、身份边界与成功返回形状；展示 / 复习、桌面 / 手机、浅色 / 深色均已验证。
- Week 8 已新增纯静态“测试闭环”tab，可视化覆盖增量、两条认证流、测试生命周期和证据边界；桌面 / 手机视口验证通过。
- 展示前端第一阶段可视化改造已完成：建立统一流程 / 资源 / 结果语义，认证页加入 401 / 403 / 200 端到端职责链与复习回忆门，OAuth2 补齐 `state` 校验和第一方会话交付边界；不改变 W6 Day 2 主线。
- 展示前端第二阶段可视化改造已完成：W5 统一四区 ownership map 并显式分开 threadpool / kernel I/O，W6 补齐覆盖拓扑、双认证链、证据矩阵与资源轴，W3 补齐真实六阶段 pipeline 形状和逐步复习揭示。
- 展示前端第三阶段可视化改造已完成：手机端补齐关系连续性，OAuth2 / 笔记加入预测后揭示，新增 W3 → W6 学习演进与全局唯一图例，并完成跨页一致性审查。
- 可视化三阶段已全部完成，恢复与验证基线记录在 `week8-fullstack/notes/visualization-optimization-roadmap.md`。
- 2026-07-29 完成第五轮展示前端改造（白名单）并**已发布 Pages**：把 W5 大数据流生产边界组的逐帧表达推广到除笔记 tab 外的全部展示内容（知识点 1/2/3/7/8 补齐播放器与逐帧解说，认证链 / OAuth2 / W3 pipeline / W6 全栈轨道接入同一套时间轴），`useFramePlayer` 从 `W5Board.tsx` 私有实现抽为共享 `framePlayer.tsx`，并修复桌面态低于 WCAG 24×24 的点击目标。源码 [PR #59](https://github.com/NiceFreak/nodejs-skillup/pull/59) 与 Pages [PR #23](https://github.com/NiceFreak/nicefreak.github.io/pull/23) 均已合并。
- 2026-07-28 另做一轮展示前端审计（第四轮，白名单），只修可测量缺陷、不新增展示内容：深色依赖箭头对比度 1.65:1、`role="tablist"` 半实现（无 tabpanel / 方向键）、手机端 `summary` 点击目标仅 14–17px、手机端字号下限、`OAuth2FlowPanel` 耦合导致管理后台代码进入静态展板构建、标题靠部署脚本事后改写。审计结论与「明确不做」记录在同一份 roadmap 的第四轮小节。
- 2026-07-30 面试材料更新：`interview-prep/backend-qa-sheet.md` 从 W1–W5 扩到 W1–W6（18 → 37 题），修掉两处与仓库自身已验收结论矛盾的答法（`bcrypt.compare` 误记为阻塞主线程、populate 误记为有 N+1），新增测试与 CI、AI 协作边界两节并重写前端节。DB 定位维持 ⚠️：`db-review-sheet.md` 已建但确认尚未自测，该自测登记为 `BACKLOG.md` **P0-0**。
- 2026-07-30 应用户单独要求完成第六轮展示前端改造（白名单）：① 新增 **W6 Day 4 板**（`#/showcase?tab=testing&topic=day4`），把 `day4-overall-technical-summary.md` 做成一条论证——四维框架、因果主线、十层交付物形状、三组受控实验、九条关键纠错、六条当前限制、能力归属时间线、最终验证；② 新增**只在复习状态出现**的 `interview` tab（强项分层 / 两处硬伤 / 三组数字 / 追问应答树 / 覆盖矩阵），并把两份问答稿接进笔记 tab 供手机阅读；③ 抽出 `evidenceSets.ts` 作为 W3 / W5 / W6 三组实验数字的唯一来源，两块板共用以防漂移。**已发布 Pages**：源码 [PR #61](https://github.com/NiceFreak/nodejs-skillup/pull/61) 与 Pages [PR #25](https://github.com/NiceFreak/nicefreak.github.io/pull/25) 均已合并，`pages build and deployment` 对 `340b04e4` 报 success，本人已初步核验线上更新完成。详见 `week8-fullstack/notes/visualization-optimization-roadmap.md` 第六轮。
- **展示前端默认到此为止**：剩余候选是认证主链改真泳道，已评估为净收益但属「前端润色」，按 `week6-plan.md` §3 砍项顺序排在第一位，7/31 前不做，归入 backlog。（第六轮面试准备板是用户单独要求的例外，不改变这条默认约定。）
- 四问复盘和下午 demo 是非阻断记录 / 展示项，不影响 W6 启动。
- 状态文件精简、通用展示部署规范和 deploy skill 中文化已完成；不再占用 W6 学习主线。

详细的 W5 过程和证据见：

- `week5-nodejs-internals/notes/week5-completed-retrospective.md`
- `week5-nodejs-internals/notes/day5-error-boundaries-process-lifecycle.md`
- `DEBT.md`

## 当前主线

本期 W1–W6 已完成，没有仍在执行的学习主线。测试套件、CI、全栈 demo、整体技术总结与最终彩排均已收口；7/31 后的新任务只能从 [`BACKLOG.md`](./BACKLOG.md) 重新选择，不自动延长 W6。

```text
W1–W6 已完成
→ 保留现有验收证据与已知限制
→ 需要继续时从 BACKLOG.md 选择新的独立任务
```

## 下一步

1. 当前没有必须继续的 W6 动作。
2. 下一次启动新任务时先读 [`BACKLOG.md`](./BACKLOG.md)；当前最高优先级入口是 P0-0 数据库面试自测，但必须由本人明确选择后再开始。
3. 已知限制继续作为 backlog 或项目边界保留，不因本期结束而冒充已解决。

## 当前风险

- CI 数据库来源与 suite 隔离已解决；异常清理路径若 `dropDatabase()` 或 `disconnect()` 抛错，后续资源释放或 `JWT_SECRET` 恢复仍可能跳过，正常路径不阻断。
- 预期 `403` 会由全局 error handler 输出完整错误堆栈，造成测试 / CI 日志噪音，但不影响行为。
- React 开发模式的 `StrictMode` 会让 Dashboard 首次挂载的两个报表请求各执行两次；生产构建不重复，当前不作为缺陷处理。
- 错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状；W6 已在不统一该契约的前提下收口。
- `week2-express/src/match-index-explain.js` 仍不可运行，作为 W6 范围外遗留保留。
- Login timing、401/403 服务端原因日志、旧用户 role 行为与真实 OAuth2 接入均为已知非阻断遗留。
- 生产部署拓扑尚未验证：本地 Vite proxy 保持同源；只有前后端分属不同 Origin 时才需要实现并实测 CORS，不能把 CORS 当作认证或无条件的生产必需项。

## 验证基线

- 最终工程验证（2026-07-31）：后端 `npm test -- --runInBand` 为 **3 个套件、9 个测试通过**；ESLint 0 errors、9 个既有 warnings；前端 `yarn typecheck` 与 `VITE_SHOWCASE_ONLY=1 yarn build --base=/skillup-week8/` 通过。状态记录更新后另运行 `git diff --check`。
- CI / 外部分支：外部 MongoDB 分支连续 5 轮全部通过且无 suite 数据库残留；GitHub Actions [CI run #257](https://github.com/NiceFreak/nodejs-skillup/actions/runs/30342990043) 的 `test` / `frontend` job 均成功。
- 前端：2026-07-28 运行 `yarn typecheck` 与生产构建通过；新增 W6 Day 2 在桌面 `1440 × 1000` 与手机 `390 × 844` 完成截图检查，手机页面 `scrollWidth === clientWidth === 390`，复习态隐藏 / 展开证据正常。此前 Playwright 最终矩阵覆盖 6 个 tab × 展示 / 复习 × 桌面 / 手机共 **24/24 通过**。
- 前端第四轮审计（同日）复测：11 个视图 × 桌面 / 手机均无页面级横向溢出、无 console 错误；`tablist` / `tab` / `tabpanel` 经 CDP 可及性树确认已暴露，方向键与 Home/End 实测有效；桌面 10/11 视图高度逐像素不变（认证 tab 矮 6px，视觉无差异）。**该轮仅完成源码与本地构建，当时未发布 Pages。**
- W6 主线总览（同日）复测：`typecheck`、生产构建通过；Playwright 在 `1440 × 1000` 与 `390 × 844` 验证 2/2 通过，两种视口均满足 `scrollWidth === clientWidth`、总览文字未越界且无 console error。**该轮仅完成源码与本地构建，当时未发布 Pages。**
- W6 D3（2026-07-29）真实浏览器验收：admin `POST /auth/login → 200`，两类报表均 `GET → 200` 并渲染；member 登录 `200` 后两类报表均 `403`，页面进入 `forbidden`；无 token probe `GET → 401`，主页面仍保持 `forbidden`。开发模式报表请求因 `StrictMode` 各出现两次，与预测一致。
- W6 Day 3 展板（同日）复测：`yarn typecheck`、`VITE_SHOWCASE_ONLY=1 yarn build` 通过；生产静态预览在 `1440 × 1000` 与 `390 × 844` 均满足 `scrollWidth === clientWidth`、无 console error、无后端请求，三路径切换分别定位 `200 / 403 / 401`；手机路径停止点自动居中，复习态先隐藏后揭示。**该轮仅完成源码与本地构建，当时未发布 Pages。**
- 第五轮逐帧改造（2026-07-29）：`yarn typecheck` 与 `VITE_SHOWCASE_ONLY=1 yarn build --base=/skillup-week8/` 通过；**针对生产静态产物**（本地服务 Pages 仓库根目录、走真实子路径）在 `1440 × 1000` 与 `390 × 844` 验证 17 条路由 / 状态：无页面级横向溢出、无 console error、后端请求数 0、触控目标均 ≥ 24×24；`#/admin` 深链不渲染登录表单且无可点击后台入口；另有 16 项交互断言通过。**已发布**：Pages PR 合并后 `pages build and deployment` 对 `58b0469` 报 success（2026-07-29 10:45Z）。本会话所在环境的网络策略拒绝访问 `nicefreak.github.io`，线上 URL 未由本会话直接取回核对，发布结论以 GitHub 的部署记录为准。
- 第六轮 Day 4 板与面试准备板（2026-07-30）：`yarn typecheck` 与 `VITE_SHOWCASE_ONLY=1 yarn build --base=/skillup-week8/` 通过；**针对生产静态产物**（本地服务 Pages 仓库根目录、走真实子路径）在 `1440 × 1000` 与 `390 × 844` 验证 28 项页面级检查（W6 四个 Day × 展示 / 复习、Day 4 全展开态、面试板 5 个板块）：无页面级横向溢出、无 console error、后端请求数 0、可点击目标 ≥ 24×24；另有 8 项断言（含「展示状态下面试 tab 不出现」与「两块板渲染出的实验指标完全一致」），合计 **36/36**。桌面浅色 / 深色与手机浅色均已截图核对。**已发布**：Pages PR 合并后 `pages build and deployment` 对 `340b04e4` 报 success（2026-07-30 10:54Z），本人已初步核验。本会话所在环境的网络策略拒绝访问 `nicefreak.github.io`，线上 URL 未由本会话直接取回核对。
- 恢复时必须先看 `git status --short`，不得覆盖用户改动。

## 恢复入口

新对话按顺序读取：

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. `README.md` 的 W6 部分、`week6-testing/notes/week6-plan.md`、`week6-testing/notes/day5-final-demo-rehearsal-and-closeout.md`。
3. `git status --short`、当前步骤直接相关的代码和测试。
4. 仅在追溯结论时读取 W5 复盘或更早笔记；欠债状态只以 `DEBT.md` 为准。
5. 规划下一步时读 `BACKLOG.md`；它是候选任务优先级的唯一入口。

## AI 协作边界

- W6 的测试场景选择、测试数据、核心断言、生命周期和端到端串联属于黑名单，AI 最高提供 L2；触发 L2 时按 `DEBT.md` 记账。
- W6 D3 仅使用 L1 提问与既有代码 review；端到端预测、实测和链路讲解由本人完成，未触发新债务。
- W6 D4 仅使用 L1 单点提问、既有代码 / 笔记事实核对与白名单记录整理；最终技术主线、实验边界和 AI 能力归属由本人回答，未触发新债务。
- CI 配置、展示前端、部署脚手架和记录整理属于白名单，AI 可做最小必要修改。
- 重建题一次性给出、集中作答、统一 review；不以重复确认或展示活动拖延当前周主线。
- 居家手机任务仍固定为每天 1–2 个时段、每段不超过 40 分钟；具体执行记录写入当天笔记，不再写入本状态文件。
