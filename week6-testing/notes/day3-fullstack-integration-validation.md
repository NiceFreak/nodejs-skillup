# W6 Day 3 · 全栈联调验收：401 / 403 / 200 跨层闭环

> 日期：2026-07-29
>
> 结果：已完成，**无阻断性问题，可以验收**
>
> 主线：对照前后端真实契约，运行并讲清 admin `200`、member `403`、无 token `401` 三条链路。
>
> 本笔记由当天逐轮问答、代码核对和浏览器实测整理而成。原始问答不再保留在正文中，本文件只记录最终结论、本人理解、纠错过程、验证证据和剩余边界。

## 今日摘要

今天没有新增应用代码。前端 API 接线已于 2026-07-16 作为白名单展示资产完成；当前前后端路径、请求体、响应形状和认证 header 静态对齐，真实运行也没有暴露需要修改的契约缺口。因此，今天准确的任务名称不是“接线开发”，而是**全栈联调与验收**。

最终验证了三条真实路径：

```text
无 token
→ validateToken 停止
→ 401

member 登录 200
→ token 有效
→ requireRole('admin') 查库后拒绝
→ 报表 403

admin 登录 200
→ token 有效
→ 数据库角色为 admin
→ 两个报表 200
→ 页面成功渲染
```

同时完成端到端脱稿讲解，能够分开说明代码调用顺序、各层职责和返回值来源。当天 AI 援助为 L1 提问、事实校准和既有代码 review，没有新增学习债务。

## 1. 今日目标与范围

### 目标

1. 对照前端 API 与后端真实路由，确认登录和报表契约。
2. 运行最小成功主链：admin 登录后访问受保护报表并渲染数据。
3. 运行一个授权失败路径：member 登录成功后访问 admin-only 报表得到 `403`。
4. 补齐项目总验收需要的无 token `401` 路径。
5. 脱离代码讲清跨层调用顺序、职责归属、返回值来源和契约变更影响。

### 计划定位修正

原计划使用“全栈接线”描述当天任务，但当前事实是：

- [`api.ts`](../../week8-fullstack/src/frontend/src/api.ts) 已封装登录、注册、Bearer token 和两个报表请求。
- [`vite.config.ts`](../../week8-fullstack/src/frontend/vite.config.ts) 已将 `/auth`、`/reports`、`/users` 代理到后端 `3000` 端口。
- 前端脚手架和 API 接线属于 `AGENTS.md` 白名单，早于 W6 Day 3 完成。
- 今日静态核对与运行验证均未发现需要修复的契约不一致。

因此今天的实际交付是：

```text
已有接线代码
→ 静态契约核对
→ 运行时联调
→ 失败路径验证
→ 跨层讲解验收
```

“没有改代码”不是缺少产出。实际工作中的联调结果可以是现有实现完全兼容；不应为了表现工作量而制造无必要修改。

### 明确不做

- 不新增前端功能或视觉润色。
- 不修改后端认证、授权或聚合逻辑。
- 不新增自动化测试；Day 1 已补齐关键认证流测试。
- 不实现生产 CORS；当前没有跨域生产部署目标。
- 不扩展 W3 遗留实验或非关键错误响应统一工作。

---

## 2. 静态契约盘点

### 2.1 登录接口

最终请求路径来自两层组合：

```text
app.use('/auth', authRouter)
+
router.post('/login', ...)
=
POST /auth/login
```

请求契约：

```text
POST /auth/login
Content-Type: application/json

{
  "email": "string",
  "password": "string"
}
```

成功响应：

```text
status: 200

{
  code,
  message,
  payload: {
    accessToken,
    user: { userId, name, email }
  }
}
```

前端 `login()` 解开响应信封，只向 `AuthView` 返回 `payload`。当前运行逻辑不读取 `code` 和 `message`；类型允许访问某字段，不等于运行时实际消费该字段。

安全用户摘要不包含 `role`。JWT payload 也只包含 `sub`，不包含角色：

```text
JWT 证明：当前 token 对应哪个用户
数据库角色决定：该用户当前是否有 admin 权限
```

### 2.2 月度报表接口

```text
GET /reports/monthly-sales?months=6&status=completed
Authorization: Bearer <accessToken>
```

成功响应是裸数组，不是登录接口那样的信封：

```text
[
  {
    year,
    month,
    orderCount,
    totalSpending,
    avgOrderValue
  }
]
```

### 2.3 客户消费报表接口

```text
GET /reports/customer-spending?days=30&status=completed
Authorization: Bearer <accessToken>
```

成功响应同样是裸数组，单行字段为：

```text
{
  userId,
  customerName,
  customerEmail,
  orderCount,
  totalSpending,
  avgOrderValue
}
```

### 2.4 浏览器地址与后端目标不是同一观察点

前端使用相对 URL，因此浏览器 Network 中看到的是：

```text
http://localhost:5173/auth/login
http://localhost:5173/reports/*
```

实际开发链路是：

```text
浏览器 → localhost:5173
Vite dev proxy → localhost:3000
Express → MongoDB
```

浏览器没有直接请求 `3000`。Vite 到后端的转发发生在开发服务器一侧；后端 logger 收到请求，才是代理确实到达 Express 的服务端证据。

---

## 3. 成功主链：admin → 报表 200

### 3.1 为什么起点必须是 admin

最初把成功路径定义为“member 登录返回 `200`”，但这只证明登录成功，没有证明：

- token 被后续请求携带；
- token 能被 `validateToken` 接纳；
- 授权中间件能够放行；
- 报表 Service / Repository 能返回数据；
- 前端能够消费并渲染响应。

完整成功终点是 admin-only 报表返回 `200` 并显示数据，因此成功路径必须使用数据库角色为 `admin` 的账号：

```text
admin 登录
→ 获得 accessToken
→ 携带 token 请求两个报表
→ 认证通过
→ 查库授权通过
→ 聚合返回数组
→ 页面渲染 KPI 和图表
```

### 3.2 页面初始化请求

`Dashboard` 默认筛选状态来自真实组件代码：

```text
status = completed
months = 6
days = 30
```

组件挂载后，`load()` 使用 `Promise.all` 并发发出：

```text
GET /reports/monthly-sales?months=6&status=completed
GET /reports/customer-spending?days=30&status=completed
```

两个请求互不依赖，因此没有串行等待的必要。

### 3.3 React StrictMode 的开发环境现象

当前入口使用 React `StrictMode`。开发模式下，首次挂载的 effect 会额外执行一轮；代码没有取消已发出的请求，因此 Network 中出现两批报表请求：

```text
业务逻辑：2 个并发报表请求
开发实测：2 批 × 2 个 = 4 个报表请求
```

登录来自用户提交事件，不会因为 `StrictMode` 被重复触发。因此一次登录后的开发环境请求总数是：

```text
1 × POST /auth/login
2 × GET /reports/monthly-sales
2 × GET /reports/customer-spending
```

这不是生产契约错误。生产构建不会因为该开发检查重复执行这轮 effect。

### 3.4 实测证据

```text
POST http://localhost:5173/auth/login
→ 200

GET http://localhost:5173/reports/monthly-sales?months=6&status=completed
→ 200 × 2

GET http://localhost:5173/reports/customer-spending?days=30&status=completed
→ 200 × 2
```

页面结果：

- KPI 行成功显示。
- 月度销售趋势成功显示。
- 客户消费 Top 图表成功显示。

成功主链达到既定终点，可以验收。

---

## 4. 权限失败路径：member → 报表 403

### 4.1 运行前预测与纠正

最终预测：

```text
member 登录                         → 200
两个报表请求（开发模式各执行两次） → 403 × 4
Dashboard access                   → forbidden
页面                               → 显示 403 说明框，不显示报表
```

两处重要纠正：

1. 登录响应的 `user` 不包含 `role`。前端不能在登录成功时提前知道当前角色。
2. `Dashboard` 捕获 `ApiError(403)` 后执行 `setAccess('forbidden')`，不是通用的 `error` 状态。

角色判断发生在后续报表请求中：`requireRole('admin')` 使用 JWT 的 `sub` 查询数据库当前角色。这个设计以每次请求增加一次数据库查询为代价，换取角色撤销或变更能在下一次请求立即生效，不必等待旧 JWT 过期。

### 4.2 实测证据

```text
POST http://localhost:5173/auth/login
→ 200

GET http://localhost:5173/reports/monthly-sales?months=6&status=completed
→ 403 × 2

GET http://localhost:5173/reports/customer-spending?days=30&status=completed
→ 403 × 2
```

页面实际进入 `forbidden`：

- 显示“403 权限不足”说明框。
- KPI 和两个报表隐藏。
- 筛选行保留。
- 鉴权演示面板保留。

这证明身份认证已成功，但当前数据库角色不满足 admin-only 资源要求。它不证明登录响应或 JWT 中含有 `member` 角色。

---

## 5. 认证失败路径：无 token → 401

在 member 的 `forbidden` 页面点击鉴权演示面板的“不带 token 请求报表”。该按钮使用独立的 `probe()` 请求，不触发 Dashboard 的 `load()`，因此只发送一个请求。

实测：

```text
GET /reports/monthly-sales?months=6&status=completed
→ 401 Unauthorized

响应：
{ "error": "Token 无效或已过期" }
```

停止点：

```text
validateToken
→ next(new AuthenticationError())
→ Express 错误传播
→ 全局 error handler 映射 401
```

`requireRole`、参数校验、Controller 和后续报表链均不会执行。

`probe()` 将结果写入鉴权演示面板自己的 `log` 状态，没有调用 `setAccess`。因此主页面仍保持 `forbidden`，报表仍隐藏，筛选行和演示面板继续保留。

---

## 6. 代码调用顺序

### 6.1 登录请求进入后端

```text
POST /auth/login
→ app.use('/auth', authRouter)
→ router.post('/login', ...)
→ validateHasRequestBody
→ validateLoginBody
→ loginController
→ loginService
→ findByEmailWithPasswordHash
→ User.findOne({ email }).select('+passwordHash')
→ bcrypt.compare
→ jwt.sign({ sub }, secret, { expiresIn: '1h' })
→ Service 返回 { accessToken, user }
→ Controller 返回 200 响应信封
```

`findByEmailWithPasswordHash` 返回包含 `passwordHash` 的 Mongoose user document 或 `null`。`bcrypt.compare` 返回密码是否匹配的布尔结果；`jwt.sign` 返回签发后的字符串 token。这三个返回值不能压成同一个“登录验证结果”。

### 6.2 登录响应交给前端状态

```text
login() 解析响应并返回 payload
→ AuthView.handleSubmit 得到 { accessToken, user }
→ token.set(accessToken)
→ localStorage['skillup_token']
→ onSuccess(user)
→ App.handleLogin(user)
→ localStorage['skillup_user']
→ setUser(user)
→ App 重新渲染
→ 当前 hash 仍是 #/admin
→ 条件渲染从 AuthView 切到 Dashboard
```

登录后没有执行路由跳转；用户提交表单时本来就在 `#/admin`。`token.set` 写入的是 `localStorage`，不是临时内存。

### 6.3 报表请求与后端处理

```text
Dashboard 挂载
→ useEffect 调用 load
→ Promise.all 并发调用两个 API 包装函数
→ 公共 request() 从 localStorage 读取 token
→ 添加 Authorization: Bearer <token>
→ Vite proxy 转发到 Express
→ validateToken 验证 token 并写入 req.auth.sub
→ requireRole('admin') 根据 sub 查询数据库角色
→ 参数校验写入 req.months / req.days / req.status
→ Controller 读取已校验参数
→ Service 计算查询边界
→ Repository 调用 Order.aggregate(pipeline)
→ MongoDB 执行聚合
```

### 6.4 报表结果回到页面

```text
MongoDB 返回聚合结果
→ Mongoose 使用的 MongoDB Node.js driver 反序列化为普通 JavaScript 对象数组
→ Repository 返回数组
→ Service 将 Decimal128 金额转换为 Number
→ Controller res.json(array)
→ 公共 request() 先检查 res.ok
→ 成功时解析 res.json()
→ 两个 API 包装函数分别返回数组
→ Promise.all 得到 [m, c]
→ fillMonths(m, months) 补齐无订单月份
→ setMonthly(补齐后的数组)
→ setCustomers(c)
→ setAccess('admin')
→ React 重新渲染报表
```

后端月度聚合只返回有数据的月份。`fillMonths` 把稀疏结果补成“当前月 + 此前 N-1 个月”的连续窗口，缺失月份使用零值记录，保证图表时间轴完整。

---

## 7. 职责归属与返回值来源

| 层 | 当前职责 | 不负责什么 |
|---|---|---|
| 浏览器前端 | 收集登录输入、保存 token、发送请求、处理页面状态并渲染数据 | 不决定用户是否有 admin 权限，不执行数据库查询 |
| Vite proxy | 在开发环境把同源相对路径转发到后端；`changeOrigin` 可改写代理请求的 Host | 不处理认证、授权或业务数据 |
| `validateToken` | 验证 Bearer token，提取 `sub` 并写入 `req.auth` | 不决定角色权限，不直接映射 HTTP 401 |
| `requireRole` | 根据 `sub` 查数据库角色并执行授权判断 | 不直接发送 403 响应 |
| 参数校验中间件 | 校验并转换 query，将结果挂到 `req` | 不查询报表数据 |
| Controller | 提取已校验输入、调用 Service、决定成功响应的 HTTP 表达 | 不计算日期边界，不构建聚合管道 |
| Service | 计算日期范围、调用 Repository、把 Decimal128 金额转换为 DTO Number | 不拼 HTTP 响应，不直接执行 MongoDB pipeline |
| Repository / Mongoose | 用 Mongoose API 定义并发起报表数据访问，返回聚合结果 | 不决定 HTTP 状态或前端展示 |
| MongoDB | 在数据库服务端执行 `$match / $group / $sort / $project` 等阶段 | 不理解 JWT、Express 或 React 页面状态 |
| 全局 error handler | 把已传播到此处的业务错误翻译成 HTTP 状态和 `{ error }` 响应 | 不执行认证或授权决策 |

### 聚合返回值边界

`await Order.aggregate(pipeline)` 需要精确拆开：

```text
Repository：定义 pipeline 并调用 Mongoose Aggregate API
Mongoose / MongoDB Node.js driver：发送聚合命令并反序列化数据库响应
MongoDB：真正执行 pipeline
await 结果：普通 JavaScript 对象数组，不是 Mongoose document
```

聚合结果不会经过 document hydration，因此没有 `save()` 等实例方法，也不自动应用 document 实例行为。Service 对返回对象执行 `map` 和字段转换，不会触发数据库更新。

### 授权错误翻译边界

数据库角色不是 admin 时：

```text
requireRole
→ 构造 AuthorizationError
→ next(err)

Express
→ 跳过后续正常处理器
→ 把错误交给全局 error handler

全局 error handler
→ AuthorizationError 映射为 403
→ 返回 { error: '权限不足' }
```

授权决策、错误传播和 HTTP 翻译属于三个不同职责。

---

## 8. 关键纠错与保留模型

### 纠错 1：登录 200 不是完整成功主链

登录成功只证明凭据验证和 token 签发没有失败。只有 token 被受保护资源接纳、授权通过、报表返回并被页面消费，才能证明跨层契约闭环。

### 纠错 2：浏览器 Network 不会显示代理后的 3000 地址

浏览器请求的是 Vite 的 `5173` 同源地址。代理后的后端目标属于 Vite 服务端行为，不能用浏览器 URL 直接证明。

### 纠错 3：身份摘要、JWT 和数据库角色不能混为一体

```text
登录响应 user：userId / name / email
JWT payload：sub
授权角色：requireRole 根据 sub 实时查库得到
```

### 纠错 4：Promise.all 的失败不等于取消请求

若两个报表中一个拒绝，`Promise.all` 立即进入 `catch`，成功分支的 `setMonthly / setCustomers / setAccess('admin')` 不执行；但另一个已经发出的 HTTP 请求不会被自动取消。

### 纠错 5：前端状态必须按真实分支描述

`403` 映射到 `forbidden`，`401` 映射到 `unauthorized`，其他失败映射到 `error`。不能用泛化的 `setError(true)` 代替当前状态机事实。

### 本日保留的思维模型

```text
先定义端到端可观察终点
→ 静态核对 method / path / body / header / response
→ 运行前预测请求数量、状态码和停止层
→ 用 Network 与页面状态验证
→ 分开讲调用顺序、职责归属和返回值来源
→ 用需求变更预测检查层间耦合
```

---

## 9. 响应契约变更影响预测

假设月度报表从裸数组改为：

```json
{ "data": [] }
```

必须修改：

- 后端 Controller：负责把 Service 数组包装为 HTTP 响应信封。
- 前端 HTTP 响应类型：必须描述新的 `{ data: MonthlySalesRow[] }` 形状。
- 前端 API 包装层：可以在这里解开 `data`，继续向 Dashboard 暴露数组。

条件修改：

- 若 API 包装层继续返回 `MonthlySalesRow[]`，Dashboard 无需修改。
- 若 API 包装层把整个信封向上传递，Dashboard 才需要读取 `.data`，公开返回类型也随之改变。

不需要修改：

- Service、Repository、Mongoose 和 MongoDB；内部 DTO 数组与查询不变。
- 认证、授权和参数校验中间件；它们不构建成功响应形状。
- 公共 `request()`；它负责通用的状态检查与 JSON 解析，不应理解具体业务信封。

核心判断：这是 HTTP 表示层契约变化，不应无条件扩散到业务和数据访问层。

---

## 10. CORS 边界与当前取舍

### 当前为什么没有 CORS 问题

开发环境使用同源代理：

```text
浏览器 → http://localhost:5173/reports/*
Vite proxy → http://localhost:3000/reports/*
```

浏览器只面对 `5173`，Vite 到 Express 是服务端转发，因此当前后端不需要为了本地 demo 增加 CORS 响应头。

### 现在需要掌握的范围

- Origin 由协议、主机和端口共同决定。
- 前后端位于不同 Origin 时，浏览器才会执行跨域响应检查。
- 非简单请求可能先发送 `OPTIONS` preflight。
- CORS 是浏览器访问控制，不是认证或授权；它挡不住 curl、Postman 或其他服务端客户端。
- 生产环境可以配置明确 Origin allowlist，也可以通过反向代理保持同源。
- 没有部署拓扑时，不应先加入宽泛的 `Access-Control-Allow-Origin: *`。

### 当前决定

现在理解原理边界，不实现 CORS。后端上线、跨域部署、allowlist 和 preflight 实测继续保留在 7/31 后 backlog。当前引入 CORS 配置不会增加 W6 的验收证据，反而会增加未经真实部署验证的配置。

---

## 11. 验证证据与证据边界

### 已验证事实

- 后端 `http://localhost:3000/` 返回 `200`。
- 前端 `http://localhost:5173/` 返回 `200`。
- admin 登录 `200`，两类报表均 `200` 并成功渲染。
- member 登录 `200`，两类报表均 `403`，页面进入 `forbidden`。
- 无 token probe 返回 `401`，且不改变主页面 `forbidden` 状态。
- React 开发模式的四个报表请求符合 `StrictMode` 预测。
- `git diff --check` 通过。

### 今日没有验证

- 没有修改应用源码，因此没有因 Day 3 改动重跑自动化测试、ESLint、typecheck 或生产构建。
- 没有验证跨域生产部署、CORS allowlist 或 preflight。
- 没有注入真实报表 `500`；只根据当前 `Promise.all` 和状态分支完成代码级预测。
- 没有证明生产环境性能、请求吞吐或最优并发策略。

---

## 12. Review 收口

### 阻断性问题

无阻断性问题，可以验收。

依据：前后端静态契约一致；admin `200`、member `403`、无 token `401` 三条路径均有真实浏览器证据；本人能够区分调用顺序、职责归属和返回值来源，并能预测响应信封变化的影响范围。

### 锦上添花

- React `StrictMode` 令开发环境首次挂载时重复报表请求。不改的实际代价是本地 Network 和后端日志更吵，并产生额外开发环境查询；生产构建不受该额外 effect 检查影响。
- 错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状。不改的实际代价是前端错误解析需要兼容两种信封，后续新增消费者也必须知道该差异。
- Dashboard 用一个 `Promise.all` 管理两个报表。不改的实际代价是任一报表失败时页面不展示另一份可能已成功的数据；当前产品没有要求部分降级。

如果现在验收：**不会因为这些剩余项而不通过**。它们不破坏当前最小 demo 和三条状态路径。

---

## 13. 已完成 / 未完成

### 已完成

- [x] 静态核对登录与两个报表接口契约。
- [x] admin 登录 → 两个报表 `200` → 页面渲染。
- [x] member 登录 → 两个报表 `403` → `forbidden` 页面。
- [x] 无 token → `401`，且 probe 局部状态不污染主页面。
- [x] 解释 React `StrictMode` 的开发环境重复请求。
- [x] 脱稿讲清调用顺序、职责归属与返回值来源。
- [x] 预测报表响应信封变化的影响范围。
- [x] 明确 CORS 当前只学边界、不做实现。

### 未完成 / 下一阶段

- [ ] 汇总 W3 / W4 / W5 / W6 的整体技术总结。
- [ ] 完成 Week 6 最终工程验证与状态收口。

### 明确移出本期

- 生产后端部署与 CORS 实现。
- 前端润色和附加 demo。
- W3 遗留索引 / 聚合实验。

---

## 14. AI 辅助与债务

- AI 负责逐题 review、事实校准、前端白名单代码解释和学习记录整理。
- 成功 / 失败路径选择、运行前预测、浏览器实测、跨层讲解和变更影响判断由本人完成。
- 当天未提供认证、授权、聚合或端到端核心逻辑的可运行实现。
- 援助保持在 L1 提问与既有代码 review，未触发新的 L2 / L3 / L4 学习债务。
- `DEBT.md` 现有条目仍全部为已还状态。

## 15. 下一入口

进入 W6 整体技术总结：

1. 汇总 W3 聚合与优化、W4 认证鉴权、W5 Node.js 底层三篇既有复盘。
2. 补入 W6 的测试可信度、CI 可重复性与 `401 / 403 / 200` 全栈验收证据。
3. 说明 AI 作为导师 / reviewer 的边界，以及欠债与延迟重建如何避免把核心能力外包。
4. 总结完成后运行后端完整测试与 lint、前端 typecheck 与生产构建，再更新 Week 6 最终状态。

止步条件：整体技术总结能够从契约、职责、证据和限制四个维度串起 W3–W6，并通过最终工程验证。
