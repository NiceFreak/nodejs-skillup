# W6 Day 4 · W3–W6 整体技术总结

> 日期：2026-07-30
> 状态：已完成，**无阻断性问题，可以验收**
> 主线：从业务链路、职责边界、实验证据、验证系统和能力归属五个维度，把 W3–W6 收束为一个可讲清、可验证、不过度外推的工程闭环。
> 原始过程：见 [`day4-raw-learning-log.md`](./day4-raw-learning-log.md)。

## 今日摘要

Day 3 已提前完成全栈联调，因此 Day 4 没有继续增加功能，而是把 W3 聚合与优化、W4 认证鉴权、W5 Node.js 运行时、W6 测试与 CI 串成一条有因果关系的技术主线。

本人最终能够从以下四个维度完成总结：

```text
契约：系统对用户承诺什么结果
职责：每一层为什么只承担当前工作
证据：哪些结论由测试或受控实验支持
限制：哪些结果不能外推到生产环境
```

当天没有修改应用核心代码。AI 只做 L1 提问、既有代码与记录核对、事实校准和白名单笔记整理，没有新增 L2 学习债务。

## 1. 最终技术主线

系统跑通了一条从注册、登录到访问聚合报表的完整业务链路。注册只创建默认 `member` 账号，不签发令牌；登录验证凭据成功后签发 JWT，业务自定义 payload 只放 `sub`、不放 role，`jsonwebtoken` 另生成 `iat` 和 `exp`；后续报表请求再根据 `sub` 查询数据库当前角色，admin 获得聚合报表结果 `200`，member 停在授权层并得到 `403`，无 token 请求停在认证层并得到 `401`。

分层边界上，`validateToken` 只确认请求身份并留下 `req.auth.sub`，`requireRole('admin')` 根据 `sub` 查询当前角色并执行授权。这个选择以每个受保护请求增加一次数据库查询为代价，换取角色变更能在下一次请求立即生效。

报表链路把业务意图与数据库实现分开：Service 解释“最近 N 个自然月”并计算 `[startDate, endDate)`；Repository 使用这些边界构造 MongoDB 聚合管道。MongoDB 执行 pipeline，Mongoose / driver 返回普通 JavaScript 对象数组，Service 再把金额从 `Decimal128` 转为 `Number`；后端仍返回稀疏月份数组，前端 `fillMonths()` 才把它转换为图表需要的连续时间轴。

W3 用同一条 `$lookup` 关联 `users.name` 的受控前后实验说明索引如何降低查询工作量；W5 用同一个 `fib(40)` 在主线程与 Worker 中执行的对照说明“计算总耗时”和“服务响应性”不是同一个指标。

W6 在原有直接签发 token 的报表测试之外，新增真实登录 token 的认证流测试：已有 admin 登录后访问报表得到 `200`，新注册用户登录后访问同一 admin-only 报表得到 `403`。CI 再让这些证据在独立 runner 与 `mongo:7` service 中重复执行，并用 suite 独占逻辑数据库和显式清理防止历史数据、并发和异步初始化污染结果。

AI 协作采用“黑名单核心本人实现、L2 援助记债、延迟重建还债”的边界。自然月报表案例中，AI 给到 L2 定向提示后本人完成 Service、Repository 和测试修正；第一档重建于 2026-07-16 通过，2026-07-27 又在没有 AI 补充提示的情况下独立推导需求变化和跨年/月末边界，形成能力没有被外包的后续证据。

当前成果仍是受控学习项目。它证明本地与 CI 中的关键链路、分层判断和实验方法成立，不证明生产吞吐、最优 Worker 数量、完整安全防护或生产部署拓扑已经验收。

## 2. 端到端调用顺序

以 admin 已登录后加载月度报表为例：

```text
Dashboard useEffect
→ load()
→ fetchMonthlySales(months, status)
→ request() 从 localStorage 读取 token
→ GET /reports/monthly-sales?months=6&status=completed
→ Vite dev proxy
→ Express /reports router
→ validateToken
→ requireRole('admin')
→ validateMonthsParam
→ validateStatusParam
→ getMonthlySalesTrendReportController
→ getMonthlySalesTrendReport
→ getMonthlySalesTrend
→ Order.aggregate([...])
→ MongoDB 执行 pipeline
→ Repository 返回普通对象数组
→ Service 将 Decimal128 转为 Number
→ Controller res.json(array)
→ request() 检查 res.ok 并解析 JSON
→ fillMonths() 补齐视图月份
→ setMonthly()
→ React 重新渲染报表
```

这条顺序不能压成“前端请求数据库”。Vite 只负责开发代理；认证、授权和成功响应属于不同边界；Repository 调用 Mongoose API，MongoDB 才是聚合的执行者。

## 3. 关键职责与返回值

| 层 | 当前职责 | 返回值或交付物 |
|---|---|---|
| 前端 | 保存 token、发请求、管理页面状态、补齐视图时间轴 | 连续月份图表数据与页面状态 |
| Vite proxy | 将浏览器同源相对路径转发到后端 | 代理后的 HTTP 请求 / 响应 |
| `validateToken` | 验证 Bearer token，提取 `sub` | `req.auth = { sub }` 或认证错误 |
| `requireRole` | 查询数据库当前角色并判断 admin 权限 | 放行或授权错误 |
| 参数中间件 | 校验并转换 query | `req.months` / `req.status` |
| Controller | 读取已校验输入，调用 Service，表达成功 HTTP 响应 | JSON 数组 |
| Service | 计算自然月边界，转换金额 DTO | 金额为 Number 的稀疏报表数组 |
| Repository / Mongoose | 定义并发起聚合数据访问 | 含 Decimal128 的普通对象数组 |
| MongoDB | 执行 `$match / $group / $sort / $project` | 聚合结果 |
| 全局 error handler | 把传播到此处的领域错误翻译成 HTTP | `401 / 403 / 409 / 500` 等响应 |

`await Order.aggregate(...)` 不返回 Mongoose document：聚合结果不会经过 document hydration，没有 `.save()` 等实例方法，也不会因为 Service 对数组执行 `.map()` 而写回数据库。

## 4. 三组代表证据

### 4.1 W3：索引改变查询工作量

受控变量是 `users.name` 是否存在索引；查询和数据集保持一致：

| `$lookup` 指标 | 建索引前 | 建 `name_1` 后 |
|---|---:|---:|
| `collectionScans` | 3 | 0 |
| `indexesUsed` | `[]` | `["name_1"]` |
| `totalDocsExamined` | 15 | 0 |
| `executionTimeMillisEstimate` | 12 ms | 3 ms |

这些事实支持“当前查询因新增 foreignField 索引而改变执行计划并减少文档扫描量”。它们不能推出所有 `$lookup` 都需要同一索引，也不能把本机毫秒数外推为生产性能。该 `name` 关联与索引仅用于实验，完成后已清理；正式报表仍通过自带索引的 `_id` 关联。

### 4.2 W5：Worker 保护响应性，不等于单任务加速

| 场景 | `fib(40)` | 并发 `/ping` | `maxHeartbeatGap` |
|---|---:|---:|---:|
| 空闲基线 | - | 约 2–3 ms | 约 102 ms |
| 主线程 `/blocking` | 1111 ms | 峰值约 378 ms | 1154 ms |
| `/worker` | 1124 ms | 约 2–3 ms | 102 ms |

主线程版拖延 timer callback 与并发 HTTP 请求；Worker 版让主线程继续推进事件循环。本次单任务实验没有显示计算加速，Worker 略长的总耗时也只能说可能包含线程创建、通信和调度噪音。`378 ms` 的 `/ping` 在计算已经开始后才发出，因此不是完整阻塞时长。

### 4.3 W6：行为可信与证据可重复

认证流的最小正反证据是：

```text
已有 admin fixture
→ POST /auth/login
→ 真实 accessToken
→ GET /reports/monthly-sales
→ 200

POST /auth/register
→ 默认 member
→ POST /auth/login
→ 真实 accessToken
→ GET /reports/monthly-sales
→ 403
```

admin 成功链不能单独证明授权正确，因为“所有登录用户都放行”的错误实现也会让它通过；member `403` 是必要反例。认证流测试只保护真实 token 与资源链的衔接，聚合数值仍由原有报表集成测试负责。

CI 的资源生命周期是：

```text
GitHub 创建临时 runner
→ test job 启动全新 mongo:7 service
→ MONGODB_URI 指向 runner 的 127.0.0.1
→ monthly-sales suite 独占 skillup_test_a
→ auth-flow suite 独占 skillup_test_b
→ 等待相关 Model.init()
→ 执行测试
→ dropDatabase + Mongoose disconnect
→ job 结束，runner 与容器销毁
```

`--runInBand` 只改变调度顺序，不提供数据隔离；测试全绿也不自动证明异步资源已经清理。因此逻辑库隔离、`Model.init()` 等待点和 teardown 都属于可信证据的一部分。

## 5. 关键纠错

| 初始说法 | 问题 | 最终结论 |
|---|---|---|
| 学到持续发布和事故处理 | 超出已有证据 | 当前完成 CI、错误边界与进程生命周期学习，不声称 CD 或生产事故处置 |
| 注册后 JWT 发 token | 调用顺序错误 | 注册不发 token，登录成功才签发 JWT |
| 登录后决定能看什么 | 混淆认证与授权 | 登录确认身份；受保护请求由 `requireRole` 决定权限 |
| admin `200` 足以证明授权 | 缺少反例 | 必须与真实 member `403` 组成正反证据 |
| Repository 返回最终 DTO | 返回边界错误 | Repository 返回普通对象数组；Service 转换 Decimal128；前端补月份 |
| 使用未记录的 1.2s → 0.15s | 把合理示例冒充事实 | 只使用 W3 Day 5 可追溯的 explain 原始指标 |
| `_id_` 单点结果证明建索引有效 | 没有无索引对照 | `_id_` 结果只证明当前走索引；因果结论使用 `name` 前后实验 |
| 简单跨域 GET 可能侥幸通过 | 混淆 preflight 与 CORS 响应检查 | 简单请求只是不预检；缺少允许源时浏览器仍不向 JS 交付响应 |
| Worker 不会加速计算 | 过度外推单次实验 | 本次单任务实验没有显示计算加速 |

## 6. 当前限制

- 生产部署拓扑尚未确定和验证。本地 Vite proxy 保持浏览器同源；若生产前后端分属不同 Origin，需要配置并实测 CORS allowlist、允许方法与 header、preflight 和实际请求。同源反向代理部署则不需要 CORS。
- Login timing 仍可能泄露邮箱是否存在；当前 demo 未公网开放，因此记录为安全遗留，不冒充已解决。
- 错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状；前端需要兼容两种契约。
- Dashboard 使用一个 `Promise.all` 管理两份报表；任一失败时不展示另一份可能成功的数据，当前没有部分降级需求。
- CI 异常 teardown 路径仍可能因前一步抛错而跳过后续清理或环境变量恢复；正常路径已验证，不代表故障注入已完成。
- 当前实验不能证明生产吞吐、最佳索引集合、最优 Worker 数量或真实 OAuth2 已接入。

## 7. AI 协作与债务

代表案例是自然月报表边界：

```text
2026-07-13：AI 给到 L2 定向提示并记入 DEBT.md
→ 本人修改 Service / Repository 与测试数据、断言
→ 2026-07-16：第一档重建通过（允许查看本人一页纸笔记）
→ 2026-07-27：无 AI 补充提示，独立推导“三个自然月”变更及跨年 / 月末影响
→ 债务已还
```

这比“代码是本人提交的”更能证明能力归属。代码质量本身不能排除外包；延迟后能复述数据流、预测变更影响并设计失败路径，才是掌握证据。

Day 4 本身只使用 L1 提问、review 与事实核对，没有新增 `DEBT.md` 条目。

## 8. 最终验证

2026-07-30 运行：

- 后端 `npm test -- --runInBand`：3 个套件、9 个测试全部通过。
- 后端 `npm run lint`：0 errors，9 个既有 warnings。
- 前端 `yarn typecheck`：通过。
- 前端 `VITE_SHOWCASE_ONLY=1 yarn build --base=/skillup-week8/`：通过。
- `git diff --check`：通过。
- 技术英语口语稿正文 138 词，符合 120–150 词要求。

## 9. 验收结论与下一入口

### 阻断性问题

无阻断性问题，可以验收。

依据：本人能以实际业务终点组织 W3–W6，而不是罗列技术名词；能分开代码调用顺序、职责归属与返回值来源；能用可追溯实验和测试说明结论，并主动限制外推范围；最终工程验证全部通过。

### 锦上添花

- Demo 现场仍需按 [`week6-demo-script.md`](./week6-demo-script.md) 完成一次计时彩排。不彩排的实际代价是内容过多时容易超时，但不改变当前技术总结已经通过的事实。
- 正式笔记文件与原始学习记录分开。不保留原始记录不会影响验收，但会失去结论如何被纠正的追溯证据，因此本次选择保留。

如果现在验收：**不会因为剩余项而不通过**。下一入口是按 Week 6 demo 讲稿完成一次约 10 分钟的最终演示彩排，然后做 W6 / 全期状态收口。
