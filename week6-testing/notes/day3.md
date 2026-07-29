当前是 **W6 Day 3（7/29）**，Day 2 的测试与 CI 已验收，且无未还学习债。  
今天唯一主线：打通并验证最小全栈 demo；前端润色、额外测试和部署都不做。  
代码事实：前端已有登录、注册、Bearer token 和两个报表 API 的封装，Vite proxy 指向后端 `3000` 端口。  
静态契约看起来已对齐，但“真实启动后能否端到端工作”尚未验证。

**全栈接线 / D3.1：**你认为今天最小的**成功主链**应该从哪个用户动作开始、以哪个可观察结果结束？先只描述成功路径，不谈失败路径。

答: 从已有的按照最新契约产生的 member 账号登录开始, 观察到 login 成功, 浏览器观察到 console 中 API 指向 我们启动的后端服务器 3000 端口, 且返回 200 登录成功, 为观察路径

这个回答还不能作为 Day 3 的成功主链，原因有两点：

1. **终点过早**：登录 `200` 只证明认证与 JWT 签发成功，没有证明 token 被后续请求携带，也没有串到受保护报表和聚合结果。
2. **观察口径有误**：前端请求使用相对路径。浏览器 Network 通常看到的是 `localhost:5173/auth/login`；Vite 在服务端把它代理到 `localhost:3000`。后端 logger 收到请求，才是代理确实到达后端的证据。

跨层关系要分开：

```text
调用顺序：提交登录 → 获得 token → 携带 token 请求报表 → 页面渲染数据
职责归属：浏览器发请求；Vite 转发；Express 认证、授权并调用报表链路
返回值来源：登录响应来自 auth service；报表数组来自 MongoDB 聚合结果
```

**全栈接线 / D3.1 追问：**如果成功主链必须以 admin-only 报表返回 `200` 并在页面显示数据为终点，发起登录的账号应该是 `member` 还是 `admin`？为什么？

答: **应该用 `admin` 账号登录。**

**原因**：成功主链的终点定义为“`admin-only` 报表返回 `200` 并在页面显示数据”。该报表接口在授权层必然校验当前用户的角色是否为 `admin`。只有使用 `admin` 账号登录，获得的 JWT 才能通过该权限校验，从而让后端返回报表数组并让前端渲染。若使用 `member` 登录，即使登录成功并获得 token，后续请求 `admin-only` 报表会因权限不足被拒绝（如 `403`），无法达成“返回 200 并显示数据”的终点，主链即告失败。

因此，今天的最小成功路径必须是：**`admin` 登录 → 获取 token → 请求 `admin-only` 报表 → 后端鉴权通过 → 返回报表数据 → 页面渲染出数据**。

D3.1 通过，成功主链范围正确。

有一处需要精确：当前 JWT **不携带 `role`**，只携带用户标识 `sub`。`validateToken` 验证 token 后写入 `req.auth.sub`；随后 `requireRole('admin')` 根据该 `sub` 从 MongoDB 查询用户当前角色。因此，admin 能通过不是因为 JWT 声明了 admin，而是因为 token 证明身份后，数据库中的实时角色为 admin。

**请求授权 / D3.2：**为什么当前实现选择在每次报表请求时查数据库角色，而不是直接信任 JWT 中的角色？请只说明一个核心取舍。

答：核心取舍是**权限变更的实时性** vs **请求延迟与数据库负载**。当前实现选择查数据库，是为了保证管理员角色一旦被撤销（或用户角色发生变更），下一次受保护请求就能立即生效，无需等待 JWT 过期；这牺牲了无状态带来的性能优势，换取了更严格的即时权限控制，适合管理后台这类对授权时效敏感的模块。

D3.2 通过。你说清了核心取舍：**数据库实时角色以额外查询成本换取权限变更立即生效**。这也准确限定了当前方案适合管理后台，而不是无条件适合所有接口。

接下来进入静态契约盘点。

**前后端契约 / D3.3：**针对成功主链的第一跳 `login`，请对照真实代码列出：

```text
请求：HTTP method + path + body
成功响应：status + 前端实际读取的字段
```

先只检查登录接口，不讨论报表。

答: 根据提供的真实代码，登录接口契约如下：

```text
请求：POST /login
      body: { email: string, password: string }

成功响应：status 200
          前端实际读取的字段：payload.accessToken, payload.user.userId, payload.user.name, payload.user.email
          （也可读取 code 和 message，但业务逻辑主要使用上述字段）
```

D3.3 暂未通过，问题在请求路径。

`routes/auth.js` 中定义的是路由器内部路径 `/login`，但 `app.js` 将整个 router 挂载在 `/auth`：

```text
app.use('/auth', authRouter)
+
router.post('/login', ...)
=
POST /auth/login
```

其余部分正确：body 是 `{ email, password }`，成功状态是 `200`，前端从 `payload` 中取得 `accessToken` 与 `user`。需要再精确一点：当前 `login()` **没有读取** `code` 和 `message`，TypeScript 类型允许访问不等于运行时实际消费。

**前后端契约 / D3.3 修正：**请只回答最终登录路径，并分别说明 `/auth` 和 `/login` 来自哪一层。
D3.3 暂未通过，问题在请求路径。

`routes/auth.js` 中定义的是路由器内部路径 `/login`，但 `app.js` 将整个 router 挂载在 `/auth`：

```text
app.use('/auth', authRouter)
+
router.post('/login', ...)
=
POST /auth/login
```

其余部分正确：body 是 `{ email, password }`，成功状态是 `200`，前端从 `payload` 中取得 `accessToken` 与 `user`。需要再精确一点：当前 `login()` **没有读取** `code` 和 `message`，TypeScript 类型允许访问不等于运行时实际消费。

**前后端契约 / D3.3 修正：**请只回答最终登录路径，并分别说明 `/auth` 和 `/login` 来自哪一层。

答: 最终登录路径：`POST /auth/login`

- `/auth` 来自 **挂载层（app.js）**：`app.use('/auth', authRouter)` 将整个认证路由器挂载在 `/auth` 前缀下。
- `/login` 来自 **路由层（routes/auth.js）**：`router.post('/login', ...)` 定义的路由器内部路径。

D3.3 通过。你已经准确区分了应用级挂载前缀和 Router 内部路径。

**前后端契约 / D3.4：**现在检查成功主链的第二跳 `monthly-sales`。请对照真实代码列出：

```text
请求：HTTP method + 最终 path + query + 认证 header
成功响应：status + body 顶层形状 + 单行字段
```

先只陈述接口契约，不解释中间件执行过程。

答: 最终路径：`GET /reports/monthly-sales`

```text
请求：
  HTTP method: GET
  最终 path: /reports/monthly-sales
  query: { status: string, months: number }
  认证 header: Authorization: Bearer <accessToken>

成功响应：
  status: 200
  body 顶层形状: 数组（Array）
  单行字段: { year: number, month: number, orderCount: number, totalSpending: number, avgOrderValue: number }
```

D3.4 通过。响应是**裸数组**，不是登录接口那样的信封；单行字段也与前端类型一致。当前页面默认 query 是 `months=6&status=completed`。

**页面初始化 / D3.5：**admin 登录成功、`Dashboard` 首次挂载后，页面逻辑上会发出几个报表请求？它们是串行还是并发？请写出这几个请求的完整 path 与 query。先按组件业务逻辑回答，暂不考虑 React 开发模式的额外行为。

答: 
根据组件业务逻辑（Dashboard 作为管理后台通常会同时展示两个核心指标），页面首次挂载时会发出 **2 个并发**的报表请求（互不依赖，无需串行等待）：

1. `GET /reports/monthly-sales?months=6&status=completed`
2. `GET /reports/customer-spending?days=30&status=completed`（注：`days` 默认值假定为 30，具体由前端常量定义；`status` 沿用 completed）

D3.5 通过。两个请求由 `Promise.all` 并发启动。

其中 `days=30` 不是假定值，而是 [Dashboard.tsx](/Users/nezha/Documents/nodejs-skillup/week8-fullstack/src/frontend/src/Dashboard.tsx:60) 的已验证初始状态；`months=6` 和 `status=completed` 也来自同一处。

运行时先记住一个观察陷阱：当前前端启用了 React `StrictMode`。开发模式下，首次挂载的 effect 会额外执行一次；由于这里没有取消请求，Network 可能看到 **两批共四个报表请求**。这不代表业务逻辑设计了四个请求，生产构建正常只执行一批。

**运行前预测 / D3.6：**如果两个并发报表请求中，一个成功返回 `200`，另一个失败返回 `500`，根据当前 `Promise.all` 和 `catch`，页面最终会显示部分报表，还是整体进入错误状态？为什么？

答: 根据当前 `Promise.all` 与 `catch` 的处理模式，**页面最终会整体进入错误状态，不会显示部分报表**。

原因是 `Promise.all` 具有“快速失败”特性：只要其中一个请求被拒绝（如返回 `500`），整个 `Promise.all` 立即拒绝并进入 `catch` 分支。在该分支中，通常会设置全局错误状态（如 `setError(true)`），而两个报表的数据状态均不会被更新（或可能被重置），因此 UI 不会渲染任何报表数据，而是展示错误提示。

D3.6 通过。精确行为是：

- 任一 Promise 拒绝后，`Promise.all` 进入 `catch`。
- 当前代码执行 `setAccess("error")`，因此页面整体显示错误状态。
- 另一个请求不会被自动取消；它即使最终返回 `200`，结果也不会进入后续的 `setMonthly` / `setCustomers`。

当前环境已就绪：后端 `3000` 和前端 `5173` 均返回 `200`，不需要重新启动。

**真实运行 / D3.7：**打开 [http://localhost:5173/#/admin](http://localhost:5173/#/admin)，执行刚才定义的 admin 成功主链。完成后记录实际结果是否到达“两个报表返回 `200` 且页面显示数据”，以及实际现象与预测有无差异。

答: http://localhost:5173/auth/login POST 200
http://localhost:5173/reports/monthly-sales?months=6&status=completed GET 200
http://localhost:5173/reports/customer-spending?days=30&status=completed GET 200
http://localhost:5173/reports/monthly-sales?months=6&status=completed GET 200
http://localhost:5173/reports/customer-spending?days=30&status=completed GET 200
页面渲染成功

登录来自用户提交事件，StrictMode 不会重复触发事件处理函数。
两个报表来自 useEffect，开发模式下额外执行一轮，所以各出现两次。
浏览器显示 localhost:5173 也符合 Vite proxy 的边界；转发到 3000 发生在 Vite 服务端。
页面渲染成功是 UI 证据，但还缺直接的 HTTP 状态证据。
**真实运行 / D3.7 修正：**请查看 Network 的 Method 和 Status，确认登录的一个请求及四个报表请求分别是什么状态码。只记录实际值。

D3.7 通过，成功主链可以验收。

已验证事实：

```text
POST /auth/login                                      → 200
GET /reports/monthly-sales?...                        → 200 × 2
GET /reports/customer-spending?...                    → 200 × 2
页面成功渲染报表数据
```

重复请求符合开发模式 `StrictMode` 的预测，不是契约错误。

现在补计划要求的一个权限失败路径。

**权限失败路径 / D3.8：**如果改用现有 `member` 账号登录，请预测登录请求、两个报表请求和页面最终状态分别是什么。只写预期结果，暂不执行。

预期结果：

- **登录请求**：`POST /auth/login` → `200`，成功返回 `accessToken` 及用户信息（`role` 为 `member`）。
- **两个报表请求**（并发发出）：
  - `GET /reports/monthly-sales?months=6&status=completed`
  - `GET /reports/customer-spending?days=30&status=completed`
  
  由于 `requireRole('admin')` 中间件根据 `sub` 查询数据库，发现用户角色为 `member`，与 `admin` 不符，因此两个请求**均返回 `403`**（`AuthorizationError`）。

- **页面最终状态**：`Promise.all` 因任一请求 `403` 而立即进入 `catch`，执行 `setAccess("error")`，页面**整体显示错误状态**，不渲染任何报表数据。另一个请求即使后续返回 `403` 也不会被处理，结果被忽略。

D3.8 暂未通过，有两个独立问题，我们先修第一个。

**登录响应边界 / D3.8a：**登录返回的 `user` 中没有 `role`。当前安全用户摘要只有：

```text
userId
name
email
```

数据库中的 `member` 角色只在后续 `requireRole('admin')` 查询时参与判断，前端不会从登录响应提前知道角色。

请只修正 member 登录成功后的响应描述：前端实际获得什么，不能获得什么？

答: 修正后的预期结果（仅登录响应部分）：

- **登录请求**：`POST /auth/login` → `200`，成功返回 `accessToken` 及 `user` 对象，该对象**仅包含** `userId`、`name`、`email`，**不包含** `role` 字段。前端无法从登录响应中获知当前用户的角色。

D3.8a 通过。登录响应只交付身份摘要和 token，不交付授权角色；前端是在访问资源后，通过 `403` 得知当前身份不满足权限要求。

现在修第二个问题。

**权限失败 UI / D3.8b：**当前 `Dashboard` 捕获 `ApiError(403)` 后，会把 `access` 设置成哪个状态？页面随后显示什么？只按真实代码回答。

答: 根据真实代码，当捕获到 `ApiError(403)` 时：

- `setAccess("forbidden")`
- 页面渲染对应 `access === "forbidden"` 的条件分支，显示一个带有 `403 权限不足` 标题的说明框，内容解释当前角色是 `member`，需要 `admin` 角色，并提示如何提权。  
- 报表数据（KPI、图表、表格）不会渲染，但筛选行和鉴权演示面板仍保留。

D3.8b 通过。修正后的完整预测是：

```text
member 登录                         → 200
两个报表请求（开发模式各执行两次） → 403 × 4
Dashboard access                   → forbidden
页面                               → 显示 403 说明框，不显示报表
```

筛选行和鉴权演示面板仍保留，这说明页面是权限降级状态，不是通用异常页。

**真实运行 / D3.9：**登出 admin，清空 Network 记录后使用现有 member 登录。记录登录与报表请求的实际 Method / Status，以及页面最终显示状态。然后说明实际结果是否符合预测。

http://localhost:5173/auth/login POST 200
http://localhost:5173/reports/monthly-sales?months=6&status=completed GET 403 Forbidden
http://localhost:5173/reports/customer-spending?days=30&status=completed GET 403 Forbidden
http://localhost:5173/reports/monthly-sales?months=6&status=completed GET 403 Forbidden
http://localhost:5173/reports/customer-spending?days=30&status=completed GET 403 Forbidden

D3.9 的 HTTP 部分符合预测：

```text
POST login → 200
GET monthly-sales → 403 × 2
GET customer-spending → 403 × 2
```

这证明认证成功、授权被拒绝，且开发模式请求次数也符合 `StrictMode` 预测。

还缺题目要求的页面证据。

**真实运行 / D3.9 补充：**页面最终实际显示了什么？请确认是否出现 `403 权限不足` 说明框、报表是否隐藏，以及筛选行与鉴权演示面板是否仍保留。只记录观察事实。

403 权限不足
当前账号角色是 member，报表 API 要求 admin。这正是最小 RBAC 在工作：token 有效（身份已确认），但服务端查库得到的角色不满足路由要求。 用 mongosh 将账号提权为 admin 后重新登录即可查看报表（命令见根 README「常用命令」）。

鉴权链路演示
validateToken（认证 401）→ requireRole('admin')（授权 403）→ controller（200）

不带 token 请求报表
带当前 token 请求报表

是的, 报表隐藏, 鉴权演示面板仍保留。

D3.9 通过。权限失败路径已形成完整证据：登录 `200`、报表 `403 × 4`、页面进入 `forbidden`，报表隐藏而鉴权演示面板保留。成功路径与一个权限失败路径均已跑通。

现在进入本人负责的“端到端链路验收讲解”。

**脱稿讲解 / D3.10：**不看代码和笔记，按实际先后顺序讲清：

```text
admin 提交登录
→ 页面最终渲染两个报表
```

这次只讲**代码调用顺序**，不要解释各层职责，也不要展开失败路径。

答: 从 admin 提交登录到页面渲染两个报表的代码调用顺序：

1. 用户点击登录按钮 → 前端调用 `login` API 函数，发起 `POST /auth/login` 请求，请求体为 `{ email, password }`。

2. 后端 `authRouter` 匹配到 `/login` 路由，执行 `loginController`。

3. `loginController` 调用 `loginService`，后者验证邮箱密码、生成 JWT，返回 `{ accessToken, user }`。

4. 前端收到 `200` 响应，将 `accessToken` 存入内存（`token.set`），并跳转路由至 `/admin`。

5. `Dashboard` 组件挂载，`useEffect` 执行，调用 `load` 函数。

6. `load` 内部使用 `Promise.all` 并发调用 `fetchMonthlySales(months, status)` 和 `fetchCustomerSpending(days, status)`。

7. `fetchMonthlySales` 发起 `GET /reports/monthly-sales?months=6&status=completed`，请求头携带 `Authorization: Bearer <token>`。

8. `fetchCustomerSpending` 发起 `GET /reports/customer-spending?days=30&status=completed`，同样携带 Bearer token。

9. 后端 `reportRouter` 匹配到 `/monthly-sales`，依次执行 `validateToken`（验证 JWT，将 `sub` 挂载到 `req.auth`）、`requireRole('admin')`（根据 `sub` 查数据库角色，确认为 admin）、`validateMonthsParam`、`validateStatusParam`，最后执行 `getMonthlySalesTrendReportController`。

10. 后端 `reportRouter` 同样匹配到 `/customer-spending`，依次执行 `validateToken`、`requireRole('admin')`（查库确认 admin）、`validateDaysParam`、`validateStatusParam`，最后执行 `getCustomerSpendingReportController`。

11. 两个控制器分别调用 `orderService` 中的 `getMonthlySalesTrendReport` 和 `getCustomerSpendingReport`，两者再调用 `repositories/users.js` 中的 MongoDB 聚合查询，返回报表数据数组。

12. 两个请求均返回 `200`，响应体为裸数组。前端 `Promise.all` 成功，将结果分别存入 `setMonthly` 和 `setCustomers`。

13. `access` 状态被设置为 `"admin"`，页面重新渲染，KPI 行、月度趋势图表、客户消费 Top 图表全部显示数据。

D3.10 暂未通过。主干正确，但第 4 步有两个前端事实错误，我们先只修这一处：

- `token.set(accessToken)` 写入的是 `localStorage`，不是内存。
- 登录成功后没有执行路由跳转；用户本来就在 `#/admin`。`onSuccess(user)` 最终更新 `App` 的 `user` 状态，使条件渲染从 `AuthView` 切换为 `Dashboard`。
- `user` 摘要也会写入 `localStorage`，用于刷新后恢复界面登录状态。

**前端状态交接 / D3.10a：**请只重写“前端收到登录 `200` 后，到 `Dashboard` 挂载前”的实际调用顺序。

答: 前端收到登录 `200` 后，到 `Dashboard` 挂载前的实际调用顺序：

---

1. 登录 API 请求成功，响应体为 `{ code, message, payload: { accessToken, user } }`。

2. 调用 `login` 函数时传入的 `onSuccess` 回调执行，传入 `user` 对象。

3. `onSuccess` 内部：
   - 调用 `token.set(accessToken)`，将 `accessToken` 写入 `localStorage`。
   - 调用 `user.set(user)`，将 `user` 摘要（`userId`、`name`、`email`）写入 `localStorage`。
   - 调用 `setUser(user)` 更新 `App` 组件中的 `user` 状态。

4. `App` 组件因 `user` 状态变化重新渲染，条件渲染判断 `user` 存在，从 `AuthView` 切换为 `Dashboard`。

5. `Dashboard` 挂载，此时组件内部可通过 `token.get()` 从 `localStorage` 读取 `accessToken` 用于后续请求。

D3.10a 仍未通过，函数边界混在了一起：

- `login()` 先解开响应信封并返回 `res.payload`；`AuthView` 得到的是 `{ accessToken, user }`，不是完整响应。
- `token.set(accessToken)` 在 `AuthView.handleSubmit` 中执行，发生在 `onSuccess(user)` **之前**。
- `onSuccess` 对应 `App.handleLogin`，它只负责保存用户摘要并调用 `setUser`。
- 当前代码没有 `user.set()`；用户摘要通过原生 `localStorage.setItem()` 保存。
- 后续是公共 `request()` 读取 token，不是 `Dashboard` 挂载时直接读取。

**前端状态交接 / D3.10a 再修正：**请按照下面这些真实函数边界重新排列顺序：

```text
login()
AuthView.handleSubmit
token.set
onSuccess / App.handleLogin
localStorage.setItem
setUser
App 重新渲染
Dashboard 挂载
```

只写顺序和每一步传递的数据。

答:
1. `login()` 发起 `POST /auth/login`，收到响应后解析信封，返回 `res.payload`（即 `{ accessToken, user }`）给调用者。

2. `AuthView.handleSubmit` 接收到 `login()` 返回的 `{ accessToken, user }`。

3. `AuthView.handleSubmit` 调用 `token.set(accessToken)`，将 `accessToken` 写入 `localStorage`（键名如 `token`）。

4. 紧接着调用 `onSuccess(user)`，这里的 `onSuccess` 是 `App` 传入的 `handleLogin`。

5. `App.handleLogin(user)` 执行：调用原生 `localStorage.setItem('user', JSON.stringify(user))` 保存用户摘要（含 `userId`, `name`, `email`），并调用 `setUser(user)` 更新 `App` 的 `user` 状态。

6. `setUser` 触发 `App` 重新渲染，此时 `user` 从 `null` 变为有值，条件渲染从 `<AuthView />` 切换为 `<Dashboard />`。

7. `Dashboard` 组件挂载。后续其内部请求将通过公共 `request()` 函数从 `localStorage` 读取 token（由 `token.get()` 获取），但这发生在挂载后的 `useEffect` 中，不属于“挂载前”阶段。

D3.10a 的调用顺序通过。只有两个字面值需校正：

```text
token key: skillup_token
user key:  skillup_user
```

不是 `token` 和 `user`。这不改变你已经讲对的状态交接链。

原 D3.10 的下一个缺口是登录请求在后端直接从 Router 跳到了 Controller，遗漏了路由中间件。

**登录调用顺序 / D3.10b：**只写 `POST /auth/login` 从进入 Express 到调用 `loginController` 之前的实际调用顺序。不要继续展开 Service。

答:
`POST /auth/login` 从进入 Express 到调用 `loginController` 之前的实际调用顺序：

1. 请求到达 Express，`app.use('/auth', authRouter)` 匹配路径前缀，将请求转发给 `authRouter`。
2. `authRouter` 内部匹配 `router.post('/login', ...)`，命中该路由。
3. 按定义顺序，首先执行 **`validateHasRequestBody`** 中间件：检查请求体是否存在（`req.body` 非空），若为空则直接返回 `400`，否则继续。
4. 接着执行 **`validateLoginBody`** 中间件：校验请求体中的 `email` 和 `password` 字段是否存在且为字符串，若不符合则返回 `400`，否则继续。
5. 最后，中间件链通过，调用 **`loginController`**。

D3.10b 通过。你准确还原了：

```text
应用挂载匹配
→ Router 路由匹配
→ validateHasRequestBody
→ validateLoginBody
→ loginController
```

这些校验中间件在失败时直接返回 `400`，不会进入 Controller。

**登录调用顺序 / D3.10c：**从 `loginController` 调用 Service 开始，到 Controller 获得 `{ accessToken, user }` 为止，请按顺序写出 Service、Repository、Mongoose 查询、密码比较和 JWT 签发之间的调用链。仍然只讲调用顺序。

答: 好的。从 `loginController` 调用 Service 到 Controller 获得 `{ accessToken, user }` 的调用顺序：

---

1. `loginController` 调用 `loginService({ email, password })`

2. `loginService` 调用 `findByEmailWithPasswordHash(email)`（来自 `repositories/users.js`）

3. `findByEmailWithPasswordHash` 执行 Mongoose 查询：`User.findOne({ email }).select('+passwordHash')`，返回用户文档（含 `passwordHash`）或 `null`

4. `loginService` 检查返回结果：若 `!userData || !userData.passwordHash`，抛出 `InvalidCredentialsError`

5. `loginService` 调用 `bcrypt.compare(password, userData.passwordHash)` 比较明文与哈希

6. 若密码不匹配，抛出 `InvalidCredentialsError`

7. `loginService` 读取 `process.env.JWT_SECRET`，若缺失或长度不足，抛出 `JwtSecretConfigurationError`

8. `loginService` 构造 JWT payload：`{ sub: userData._id.toString() }`

9. `loginService` 调用 `jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })` 签发 `accessToken`

10. `loginService` 组装返回值：`{ accessToken, user: { userId: userData._id, name: userData.name, email: userData.email } }`，返回给 `loginController`

11. `loginController` 获得该返回值，将其放入响应体 `{ code: 200, message: '登录成功', payload: result }` 返回

D3.10c 通过。你已经正确区分：

```text
Repository / Mongoose 返回用户 document
→ bcrypt.compare 返回匹配结果
→ jwt.sign 生成 accessToken
→ Service 组装安全摘要
→ Controller 包装 HTTP 响应
```

**报表返回顺序 / D3.10d：**从两个 Repository 聚合查询各自返回结果开始，到 Dashboard 设置 `access = "admin"` 为止，请按顺序讲清 Service、Controller、公共 `request()`、`Promise.all` 和前端状态更新。只讲调用顺序。

答:
好的，从两个 Repository 聚合查询返回结果到 Dashboard 设置 `access = "admin"` 的调用顺序：

---

1. **Repository 层**：`getMonthlySalesTrend()` 与 `getCustomerSpending()` 各自的 MongoDB 聚合查询完成，返回原始结果数组（含 `_id`、`totalSpending` 等大整数/Decimal 类型）给对应的 Service。

2. **Service 层**：`getMonthlySalesTrendReport()` 和 `getCustomerSpendingReport()` 分别接收 Repository 返回的数组，对每个元素执行 `map` 转换（将 `totalSpending` 和 `avgOrderValue` 通过 `Number.toString()` 转为普通 Number），将转换后的数组返回给对应的 Controller。

3. **Controller 层**：`getMonthlySalesTrendReportController` 与 `getCustomerSpendingReportController` 各自接收 Service 返回的数组，调用 `res.json(数组)` 将 HTTP 200 响应（裸数组）发送给前端。

4. **前端公共 `request()` 函数**：接收到 HTTP 响应后，解析 `response.json()` 得到数组，检查状态码（200），将数组返回给具体的 API 包装函数（`fetchMonthlySales` / `fetchCustomerSpending`）。

5. **API 包装函数**：将数组返回，作为 `Dashboard` 中 `await Promise.all([...])` 的 resolved 值。

6. **`Promise.all`**：等待两个请求都 resolve，解构赋值得到 `[m, c]`（两个数组）。

7. **状态更新（按顺序执行）**：
   - 调用 `setMonthly(m)`，更新月度报表数据状态。
   - 调用 `setCustomers(c)`，更新客户消费数据状态。
   - 调用 `setAccess("admin")`，将访问状态标记为 admin。

8. React 批量更新状态后触发重渲染，页面显示报表数据。

D3.10d 暂未通过，有三处事实错误，先修 Repository → Service 这一段：

- 两个聚合管道最终都通过 `$project: { _id: 0, ... }` 移除了 `_id`，所以返回结果不含 `_id`。
- Service 的转换是 `Number(value.toString())`，不是 `Number.toString()`。
- Service 只把 `totalSpending` 与 `avgOrderValue` 转为普通 `Number`，其余字段展开保留。

**报表 DTO / D3.10d-1：**请只重写 Repository 返回数组后，Service 如何转换并返回 DTO 数组。区分 Repository 返回值和 Service 返回值。

答: 

**Repository 返回值**：  
- 两个聚合查询（`getMonthlySalesTrend` 与 `getCustomerSpending`）均通过 `$project` 移除 `_id`，返回的对象字段不包含 `_id`。  
- 例如月度趋势：`{ year, month, orderCount, totalSpending, avgOrderValue }`（`totalSpending` 与 `avgOrderValue` 可能是 MongoDB 的 `NumberDecimal` 或大整数类型）。  
- 客户消费：`{ userId, customerName, customerEmail, orderCount, totalSpending, avgOrderValue }`（同样，金额字段为原始数值类型）。

---

**Service 转换并返回 DTO 数组**：  
- `getMonthlySalesTrendReport` 接收 Repository 返回的数组 `result`，调用 `result.map(item => { ... })`。  
- 对每个 `item`，解构出 `{ totalSpending, avgOrderValue, ...rest }`（`rest` 包含其余字段，如 `year`, `month`, `orderCount`）。  
- 将 `totalSpending` 和 `avgOrderValue` 通过 `Number(value.toString())` 转为普通 JS `Number` 类型。  
- 返回新对象：`{ ...rest, totalSpending: Number(totalSpending.toString()), avgOrderValue: Number(avgOrderValue.toString()) }`。  
- 该转换后的对象数组作为 Service 的返回值，字段与 Repository 返回值一致，但金额字段已强制转换为 `Number`。  
- `getCustomerSpendingReport` 同理，转换 `totalSpending` 与 `avgOrderValue`，其余字段（`userId`, `customerName`, `customerEmail`, `orderCount`）展开保留。

D3.10d-1 通过。再收紧一个事实：`Order.totalAmount` 的 Schema 类型明确是 `Decimal128`，因此这里不是不确定的“大整数类型”；聚合金额结果来自 Decimal128 运算。

接着修第二处。

**HTTP 响应交接 / D3.10d-2：**报表 Controller 调用 `res.json(array)` 后，公共 `request()` 按什么顺序处理 `Response`，并最终把什么交给具体 API 包装函数？请区分成功与非 2xx 的分叉，但不要展开 Dashboard 状态。

答: 从报表 Controller 调用 `res.json(array)` 后，公共 `request()` 处理 `Response` 并交给具体 API 包装函数的顺序如下：

1. **`request()` 内部调用 `fetch(url, options)`**，其中 `options` 已从 `localStorage`（键 `skillup_token`）读取 token 并挂载 `Authorization: Bearer <token>` 头。

2. **等待 `fetch` 返回 `Response` 对象**（此时 HTTP 响应已到达，但尚未解析 body）。

3. **检查 `response.ok`**（即 `response.status` 是否在 200–299 范围内）：

   - **成功路径（2xx）**：
     - 调用 `await response.json()` 解析响应体（此时为 Controller 返回的裸数组）。
     - `request()` 将**解析后的数组**直接返回给具体 API 包装函数（如 `fetchMonthlySales` / `fetchCustomerSpending`）。

   - **非 2xx 路径（如 403、500）**：
     - 调用 `await response.json()`（或 `text()`）提取错误体。
     - 构造 `ApiError` 实例，携带 `status`（状态码）和解析出的错误体（后端返回的 `{ error: string }`）。
     - **抛出**该 `ApiError`，`request()` 不返回任何值；异常沿调用栈向上传播，由具体 API 包装函数原样抛出，最终被 `Dashboard` 的 `catch` 捕获。

     D3.10d-2 的顺序通过：

```text
fetch
→ 获得未解析的 Response
→ 先检查 res.ok
→ 成功时解析 JSON 并返回数组
```

错误分支有两处需精确：

- 当前实现只尝试 `res.json()`，解析失败回退 `{}`，没有调用 `text()`。
- `ApiError` 保存的是 `status` 和由 `readErrorMessage()` 提取出的**消息字符串**，不是整个错误体。

**前端状态更新 / D3.10d-3：**`Promise.all` 得到 `[m, c]` 后，到 `setAccess("admin")` 为止，实际调用顺序是什么？注意月度数组不能直接写入状态。解释中间那一步解决什么数据形状问题。

答: 
`Promise.all` 得到 `[m, c]` 后，到 `setAccess("admin")` 为止的实际调用顺序：

---

1. `Promise.all` 解构赋值获得 `m`（月度趋势数组）和 `c`（客户消费数组），两者均为裸数组。

2. 调用 **`fillMonths(m, months)`**，将 `m` 和当前 `months` 窗口值传入。

3. `fillMonths` 内部做三件事：
   - 根据当前日期和 `months` 生成目标月份列表（如 `months=6` → 生成过去 5 个月 + 本月，共 6 个自然月）。
   - 对每个目标月份，在 `m` 数组中查找匹配的 `{ year, month }`。
   - 命中则保留原值；未命中则补一条完整记录：`{ year, month, orderCount: 0, totalSpending: 0, avgOrderValue: 0 }`。
   - 返回补全后的 6 条记录数组（顺序从旧到新）。

4. 调用 **`setMonthly(补齐后的数组)`**，存入 state。

5. 调用 **`setCustomers(c)`**，客户数组直接存入 state（无补齐处理）。

6. 最后调用 **`setAccess("admin")`**。

---

中间 `fillMonths` 解决的数据形状问题：**后端聚合只返回有数据的月份，缺失月份不在响应中**。若直接将 `m` 存入 state，月度图表会在时间轴上出现断层（如 1 月、3 月有数据，2 月空缺），导致图表不连续或 X 轴错位。`fillMonths` 将响应数组“膨胀”为固定长度的连续月份序列，保证图表 X 轴完整展示 N 个自然月。

D3.10d-3 通过。你准确说明了后端返回稀疏月份、前端补成固定自然月窗口的交接边界。

至此 D3.10 通过：修正后的答案已能按真实顺序讲清登录、状态交接、并发报表、后端查询、DTO 转换和页面渲染。

现在切换维度，不再重复调用顺序。

**职责归属 / D3.11：**以一次成功的 `GET /reports/monthly-sales` 为例，分别说明浏览器前端、Vite proxy、Express 中间件、Controller、Service、Repository/Mongoose 和 MongoDB 各自负责什么。只讲职责，不复述调用步骤。

答:
以一次成功的 `GET /reports/monthly-sales` 为例，各层职责如下：

---

- **浏览器前端**  
  负责发起请求、携带 `Authorization: Bearer <token>` 头、接收响应裸数组，并将数据交给图表/表格组件渲染。不参与鉴权决策，也不处理数据库查询。

- **Vite proxy**  
  负责在开发环境中将 `http://localhost:5173/reports/monthly-sales` 代理到后端 `http://localhost:3000/reports/monthly-sales`，解决跨域问题，不修改请求或响应内容。

- **Express 中间件**（`validateToken`、`requireRole`、`validateMonthsParam`、`validateStatusParam`）  
  - `validateToken`：验证 JWT 有效性，解析出 `sub` 并挂载到 `req.auth`。  
  - `requireRole('admin')`：根据 `req.auth.sub` 查询数据库获取用户角色，若与 `admin` 不符则终止请求并返回 `403`；若通过则允许继续。  
  - `validateMonthsParam` 与 `validateStatusParam`：校验查询参数 `months` 和 `status` 的类型与取值范围，转换后挂载到 `req` 供后续使用。

- **Controller**（`getMonthlySalesTrendReportController`）  
  负责从 `req` 提取已校验的参数（`status`、`months`），调用 Service，并以 `res.json()` 返回 Service 转换后的裸数组。不包含业务逻辑或数据转换。

- **Service**（`getMonthlySalesTrendReport`）  
  负责根据 `status` 和 `months` 计算日期范围（当前月回溯 `months-1` 个月至下个月初），调用 Repository，并将 Repository 返回的 MongoDB `Decimal128` 金额字段转换为普通 `Number` 类型，形成 DTO 数组返回给 Controller。业务规则（如窗口边界）封装在此层。

- **Repository/Mongoose**（`getMonthlySalesTrend`）  
  负责使用 Mongoose 的 `Order.aggregate()` 构建聚合管道（`$match`、`$group`、`$sort`、`$project`），执行查询并返回 MongoDB 聚合结果（原始文档，含 `Decimal128` 类型）。不包含业务逻辑，仅做数据访问。

- **MongoDB**  
  负责执行聚合查询，按 `status` 过滤订单，按年月分组汇总 `orderCount`、`totalSpending`、`avgOrderValue`，并按年月排序返回结果集。负责数据存储与查询效率，不关心上层业务语义。

D3.11 主体正确，但授权失败的职责被压扁了。`requireRole` 并不直接“返回 403”；这会混淆授权判断与 HTTP 错误翻译。

另外一个非阻断精度点：Vite 配置了 `changeOrigin: true`，因此可能改写代理请求的 `Host`，但不会改业务 path、query 或响应 body。

**错误翻译职责 / D3.11a：**当数据库角色不是 `admin` 时，请区分：

```text
requireRole 负责什么
Express 的错误传播负责什么
全局 error handler 负责什么
```

只讲这三个职责，不展开其他层。

答: 
当数据库角色不是 `admin` 时，三层的职责分工如下：

- **`requireRole`**：负责执行授权判断——根据 `req.auth.sub` 查询数据库获取用户角色，比对是否等于 `requiredRole`。若不符，则**构造 `AuthorizationError` 实例，并通过 `next(err)` 传递给 Express 错误处理链**；它不直接发送 HTTP 响应，也不负责状态码或响应体格式。

- **Express 错误传播**：负责将 `next(err)` 传入的错误沿中间件链向后传递，**跳过后续的正常路由/中间件**，最终到达已注册的全局错误处理中间件。它不修改错误对象，只负责路由和传递。

- **全局 error handler**：负责**接收错误对象**，根据其类型（`AuthorizationError`）映射为对应的 HTTP 状态码（`403`），并将错误消息（`error.message`）封装为 `{ error: string }` 格式的 JSON 响应，通过 `res.status(403).json(...)` 发送给客户端。它不参与授权判断，只负责将业务错误翻译为 HTTP 响应。

D3.11a 通过。你已经准确拆开了授权决策、Express 错误传播和 HTTP 响应映射。

D3.11 还剩一个边界：原回答把聚合结果称为“原始文档”，并容易让人误以为 Mongoose 执行了聚合。

**返回值来源 / D3.12：**对于 `await Order.aggregate(pipeline)`，分别说明：

```text
Repository 代码做了什么
Mongoose 做了什么
MongoDB 做了什么
await 最终拿到的是 Mongoose document 还是普通对象
```

只回答这一个返回值边界。

答: 对于 `await Order.aggregate(pipeline)`，各层职责和返回值性质如下：

- **Repository 代码**：定义聚合管道阶段（`$match`、`$group`、`$project` 等），调用 `Order.aggregate(pipeline)` 并 `await` 其执行结果，最后将结果数组直接返回给 Service。它不负责转换结果格式。

- **Mongoose**：将 JavaScript 管道定义编译为 MongoDB 驱动程序可识别的命令，发送查询请求；收到结果后，**跳过 Mongoose 文档水合（hydration）过程**，不将每条记录包装为 Model 实例，也不触发虚拟属性或实例方法。

- **MongoDB**：在数据库服务端执行聚合管道（过滤、分组、排序、投影等），将计算结果以 BSON 文档格式返回给 Mongoose 驱动。

- **`await` 最终拿到的是**：**普通 JavaScript 对象（Plain Old JavaScript Object）数组**，**不是 Mongoose Document 实例**。这些对象不含 `save()`、`update()` 等模型方法，也不包含虚拟属性或 Schema 定义的 getter/setter。因此 Service 层可以直接用 `map` 解构并转换字段，而不会意外触发数据库更新。

D3.12 通过，D3.11 的职责归属也随之通过。你已经明确：

```text
Repository 定义并发起数据访问
Mongoose 将调用交给驱动且不水合聚合结果
MongoDB 服务端执行 pipeline
await 获得普通对象数组
Service 再完成 DTO 转换
```

Day 3 主线已满足“成功路径 + 权限失败路径”。为了达到项目总验收中的 `401 / 403 / 200` 三条路径，还差一次认证失败验证。

**认证失败预测 / D3.13：**在当前 member 页面点击鉴权演示面板的“不带 token 请求报表”，预测请求数量、状态码、停止在哪个中间件，以及它是否会改变 Dashboard 当前的 `forbidden` 状态。先预测，不执行。

答: 在当前 `forbidden` 页面点击“不带 token 请求报表”的预测：

---

- **请求数量**：1 个（鉴权演示面板的 `probe` 独立于 Dashboard 主加载逻辑，不触发 `load` 函数，因此仅该面板自身发起一次请求）。

- **状态码**：`401`（`validateToken` 检查到请求头无 `Authorization` 或格式非法，抛出 `AuthenticationError`，全局 error handler 映射为 401）。

- **停止在哪个中间件**：`validateToken`。因为 `requireRole('admin')` 依赖 `req.auth.sub`，而 `validateToken` 在未认证时就已终止请求，不会执行后续中间件。

- **是否会改变 Dashboard 当前的 `forbidden` 状态**：**不会**。该请求由鉴权演示面板的 `probe` 函数独立发起，其响应结果仅记录在该面板的 `log` 表中（通过 `setLog` 更新），不涉及 Dashboard 的 `access` 状态。页面主区域仍保持 `forbidden` 显示，不受此探测请求影响。

D3.13 通过，预测边界正确。只有措辞修正：`validateToken` 不是 `throw`，而是调用 `next(new AuthenticationError())`，再由全局 error handler 映射为 `401`。

**认证失败实测 / D3.14：**现在点击“不带 token 请求报表”，记录 Network 中实际的 Method / path / Status、演示面板新增的响应记录，以及主页面是否仍保持 `forbidden`。最后说明实测是否符合预测。

答: http://localhost:5173/reports/monthly-sales?months=6&status=completed
GET 401 Unauthorized
时间	请求	状态	响应
15:19:31	不带 token 请求	✕ 401	{"error":"Token 无效或已过期"}
主页面状态：

仍保持 forbidden，主 Dashboard 区域仍显示 403 说明框，报表完全隐藏，筛选行和鉴权演示面板保留。该探测请求不触发 setAccess，因此不影响主状态。符合预期

D3.14 通过。`401 / 403 / 200` 三条路径现在都有真实运行证据：

```text
无 token       → validateToken 停止 → 401
member token   → requireRole 停止   → 403
admin token    → Controller/Service/Repository → 200 + 页面报表
```

最后做需求变更影响预测，完成 Day 3 的掌握验收。

**变更影响 / D3.15：**假设月度报表成功响应从裸数组改为：

```json
{ "data": [/* monthly rows */] }
```

哪些前后端层必须修改，哪些层不需要修改？只判断影响范围和原因，不写代码。

答: 
根据响应格式从裸数组改为 `{ "data": [/* monthly rows */] }`，影响范围和原因如下：

---

**必须修改的层**：

- **后端 Controller**：原来直接 `res.json(array)`，现在需改为 `res.json({ data: array })`。因为 HTTP 响应的形状是由 Controller 决定的。

- **前端 API 包装函数（如 `fetchMonthlySales`）**：原来 `request()` 返回数组并直接透传，现在需要从响应对象的 `data` 字段提取数组。可在该函数内解构 `const { data } = await request(...)` 再返回 `data`。

- **前端 TypeScript 类型定义**：原来 `fetchMonthlySales` 声明返回 `Promise<MonthlySalesRow[]>`，现在需修改为 `Promise<{ data: MonthlySalesRow[] }>` 或调整接口定义。

- **前端 Dashboard 主逻辑**：如果 API 包装函数不帮提取（直接返回完整对象），则 `Promise.all` 解构后 `m` 是对象而非数组，需改为 `const m = monthlyResult.data`。但若在 API 包装函数内提取，则 Dashboard 层无感知。

---

**不需要修改的层**：

- **后端 Service**：返回的数据结构（DTO 数组）不变，只负责转换金额字段和日期范围计算，与响应信封无关。

- **后端 Repository / Mongoose / MongoDB**：聚合查询返回的普通对象数组不变，不关心上层如何包装响应。

- **Express 中间件**（`validateToken`、`requireRole`、参数校验等）：只处理请求和授权，不参与响应格式构建，无需修改。

- **前端 `request()` 通用函数**：只负责解析 JSON 并返回任意对象，不关心具体形状；错误处理也无需改动，除非错误响应格式也变化。

---

**核心判断依据**：响应格式变化属于 **“表示层”契约变更**，影响的是直接读写 HTTP 响应的地方（Controller 和前端 API 调用层），业务逻辑层（Service/Repository）和通用工具层（request）保持隔离，因此不受波及。

W6 Day 3 已通过验收，无阻断性问题；现在验收不会因剩余问题不通过。

已完成：

- admin 报表链路 `200` 并成功渲染
- member 授权失败 `403`
- 无 token 认证失败 `401`
- 调用顺序、职责归属、返回值来源和契约变更影响讲解通过
- 更新 [LEARNING-STATE.md](/Users/nezha/Documents/nodejs-skillup/LEARNING-STATE.md) 与 [week6-plan.md](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/week6-plan.md)
- 生成 145 词的 [Day 3 英语口语稿](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day3-english-speaking.md)

未修改业务代码，因此未重跑自动化测试；真实浏览器验收已完成，`git diff --check` 通过。下一入口是整体技术总结。