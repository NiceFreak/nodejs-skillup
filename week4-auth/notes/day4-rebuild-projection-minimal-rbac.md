# Day 4 · 自然月边界重建 + 投影模型校准 + 最小 RBAC（401/403）

> 今天完成 W4 主线第三段：上午先做自然月报表边界第一档重建（还债 ①，通过），随后用 `findOneAndUpdate` 预测实验校准 D3 深夜暴露的投影理解偏差；下午进入最小 RBAC 主线——推导 401/403 语义、确定可信角色来源（数据库 `User.role`）、实现 `requireRole` 授权中间件（首版 review 因错误分层被打回后修正），把两个报表接口接成 admin-only，真实验证无 token 401 / member 403 / admin 200 三条路径，并新增 member 403 集成测试。D4 三项止步条件全部达成；Login 计时枚举结论顺延 D5，响应信封迁移按计划降级 W6。

---

## 1. 自然月边界第一档重建（还债 ①）

按 `DEBT.md` 2026-07-13 条目执行：第一档（只看一页纸笔记）、15–20 分钟、过程中 AI 不提示、结束后验收。验收采用四问：

1. **2026-07-16、`months=6` 覆盖哪些月份？为什么起点移动 `months - 1`？** 答：2–7 月。查询是从当前月起回溯的过程：`new Date(now.getFullYear(), now.getMonth(), 1)` 先取到 7 月起点（当前月已占一个名额），再回退 `months - 1 = 5` 个月到 2 月，正好 6 个自然月。
2. **为什么用 `$gte start + $lt end` 而不是 `$lte end`？** 答：左闭右开半开区间，精确限定查询范围——查几个月就是几个月。
3. **相邻自然月区间为什么不能重叠？** 答：防止同一条数据被重复统计。边界例子：`8-01T00:00:00.000Z` 这个时间点用 `$lt` 才不会被统计进 7 月报表。
4. **`startDate/endDate` 在哪一层算？** 答：service 层，这是业务决定的内容；repository 只负责聚合管道。

**重建结果**：

- 通过方式：回忆 + 推导——理解 API 含义后能当场给出论断。
- 验收结论：**第一档重建通过**。本次验收目标是能否从自然月契约、`months - 1` 和半开区间推导出边界行为，没有实际重写代码不影响本单元通过；但按 `DEBT.md` 还债标准，仍需补至少一项掌握证据后才能把该债务标为「已还」。

---

## 2. 投影模型校准（D3 深夜讨论整理）

### 2.1 检验题与原回答

**题**：为什么 `select: false` 拦不住 `save()` 返回的文档？

**原回答（本人）**：Mongoose 的 select 是读写数据时的中间层操作，MongoDB 本身不认这一套；最终行为发生在 MongoDB，所以拦不住。类比 virtual DOM 与真实 DOM。

**判定**：结构对，机制偏。「中间层的规则只在中间层存在，绕过它就不生效」这个判断是对的——它准确解释了 mongosh 直查能看到 `passwordHash`；但对 save 现象的解释用错了机制。

### 2.2 修正一：投影是 MongoDB 原生功能

「MongoDB 不认这一套」不成立。投影本身是数据库原生能力：`db.users.find({}, { passwordHash: 0 })`。Mongoose 做的事是把 schema 里的 `select: false` **编译成原生投影、随每次查询下发**——字段在数据库那头就被裁掉，不是拿回 Node 再删。

准确的分层表述：MongoDB 不知道你的 **schema 规则**（「默认排除」这个策略是 Mongoose 的），但执行排除的**机制**是它原生的。若按「先传回来再隐藏」理解，网络开销、covered query 等后续推导全会跑偏。

### 2.3 修正二：save 返回的是内存对象，写路径没有投影工序

save 返回带 hash 的真正原因：**投影是「读」路径上的一道工序，save 是写，全程不存在投影工序**。严格说，save 返回的文档不是「MongoDB 返回的」——它就是 `new User(...)` 在 Node 内存里构造的那个对象本身，save 把它送出去落库后原样交还。没有东西「带着 hash 逃过了过滤」，因为压根没发生一次需要过滤的读取。

顺带修正：`select` 只影响**读**，与写无关（原表述「读写数据时的操作」不准确）。

### 2.4 比喻校准：不是 vDOM，更像 axios 默认参数

vDOM 比喻结构上沾边（两层、绕过抽象层规则失效），但方向反了：vDOM 模型里 vDOM 是状态源；而这里 **MongoDB 才是事实源**，Mongoose 是电线上的翻译官，不是被 diff 的镜像。

更贴的比喻（来自本人前端经验）：**axios 实例的默认参数/拦截器**——所有 GET 出去默认带「不要 passwordHash」（服务端照此裁剪 = 原生投影），单次可显式覆盖（`select('+passwordHash')`）；save 的场景则相当于自己组装的请求体对象，发送成功后它还在局部变量里，GET 侧的拦截器与它无关。

### 2.5 底图：一次查询 = 筛选 + 投影 + 游标修饰

```text
筛选（filter）    → 哪些文档入选           find 的第一个参数
投影（projection）→ 入选文档露出哪些字段    find 的第二个参数 / select()
游标修饰          → 顺序与数量             sort / skip / limit
```

三件事都在 MongoDB 服务端完成。归位本周写过的东西：

- `select: false` = Mongoose 层的**默认投影**：生成查询时默认排除该字段。只作用于查询路径 → save 拿到的是内存对象；mongosh 不经过 Mongoose，这层默认根本不存在。
- `select('+passwordHash')` = 对默认投影的**单次覆盖**，语义是「默认之上加回这个字段」，不是「只要这个字段」。
- 推论（W3 遗留实验的入口）：投影发生在服务端 → 若查询所需字段全在某个索引里，可以只扫索引不碰文档（covered query，`explain` 的 stage 不同）。等 `match-index-explain.js` 修好后可验证。

---

## 3. findOneAndUpdate 预测实验（先预测后验证）

**问题**：`findOneAndUpdate` 是「写」操作，但返回的文档是从服务端读回来的——默认带不带 `passwordHash`？

**旧模型预测**（「MongoDB 真实返回什么，Mongoose 拦不住」）：MongoDB 直接返回完整文档给 Mongoose，里面有 `passwordHash`——但又认定 Mongoose 到 repository 时能把数据清洗干净，这里对 Node.js 和 MongoDB 的理解都存在偏差。

**新模型预测**（「看返回值来自哪里」）：`select: false` 作为 Mongoose 的投影规则，发到 MongoDB 后会被处理为原生投影语法，返回的文档实际上是投影后的；服务端还能看到 `passwordHash` 只是因为内存中还有那个临时变量。所以预测默认返回的文档**不带** `passwordHash`。

**验证结果**：

```text
defaultHasPasswordHash: false
explicitHasPasswordHash: true
defaultKeys: _id, name, email, addresses, __v
explicitKeys: _id, name, email, passwordHash, addresses, __v
```

**结论**：`findOneAndUpdate` 虽然是写操作，但它返回的文档来自服务端读回的结果，默认会经过 Mongoose 的 `select: false` 投影规则；显式 `.select("+passwordHash")` 才会把字段加回来。实验支持新模型。判别标准可以固化为一句话：**看返回值来自哪里——手里的内存对象不经过投影，服务端读回的文档才经过投影**。

API 细节：当前 Mongoose 提醒 `new` 选项已弃用，后续示例用 `returnDocument: "after"` 表达返回更新后的文档。

### 3.1 追问整理：投影、写入返回值与 API 无状态的边界

**`.select("+passwordHash")` 的真实过程**——不是 Mongoose 从自己内存里取字段再拼接：

```text
Mongoose 读取 schema：passwordHash 默认 select:false
→ 生成查询时默认带上「排除 passwordHash」的投影
→ 本次查询写了 .select("+passwordHash")
→ Mongoose 覆盖默认排除规则
→ MongoDB 直接返回包含 passwordHash 的文档
→ Mongoose 把返回结果包装成 Mongoose document
```

**注册与登录是两个不同场景**：注册链路关注「写入安全凭据」，登录链路关注「读取 hash 验证凭据」。它们共享数据库状态，但不是靠某次请求的内存对象互相传递数据。

**API 无状态的准确边界**——「每个 API 完全独立、互相不关联」说过头了：

```text
每次 HTTP 请求在执行过程上是独立的；
但它们可以通过共享持久化状态发生业务关联。
API 执行无状态，业务数据有状态，
通过数据库、token、外部存储等明确媒介发生关系。
```

JWT 也是同一类思路：登录 API 签发 token；受保护 API 不记得「刚刚登录过」，它只验证本次请求带来的 token。

**`.save()` 的职责与时序**：`.save()` 是 Mongoose document 上的方法，语义是「把当前 Node 内存里的 document 持久化到 MongoDB」。关键区分：

```text
new User(...)      → 在 Node 内存里构造 Mongoose document
user.save()        → Mongoose 发起写入，并等待 MongoDB 完成
User.findOne(...)  → 从 MongoDB 读文档，受 select:false 影响
```

`select: false` 不影响 `save()` 返回值；安全边界不能放在 `select: false` 上，而要放在 service/controller 组装响应时。

**AI 表达偏差与修正**：AI 先前的「简明注册链路」把 `.save()` 写成 MongoDB 入库之后才发生的动作，混淆了代码调用顺序与 `await` 的返回时机。修正后的注册链路明确了：`save()` 发起写入 → MongoDB 完成入库 → `save()` resolve 返回当前内存 document。后续约束（已在 `AGENTS.md`「跨层链路讲解」固化）：讲跨层链路必须显式区分**代码调用顺序、职责归属、返回值来源**三件事，不能为了简明压扁。本次属概念解释偏差与即时修正，未给黑名单实现骨架，不记入 `DEBT.md`。

---

## 4. 401/403 语义推导（RBAC 设计点 1/2）

### 401：凭证有问题 / 无凭证

判断标准成立：「我不能确认你是谁」。有效例子（访问受保护接口阶段）：未携带 Authorization、Authorization 格式错误、token 过期/无效。

两处需要区分流程的例子：

- 「用户未注册」只有当认证/授权链路根据 token 的 `sub` 查库并发现用户不存在时，才属于受保护接口的 401；当前 `validateToken` 不查库，只验证 token 本身。
- 「2000 个无密码历史用户」属于**登录-凭据验证**阶段的 401（用 email/password 换 token 失败），不是**请求认证/授权**阶段的 401。两个流程要持续分开。

### 403：身份已确认，但授权规则不放行

判断标准：**身份已经确认，但根据当前接口的授权规则，这个身份没有权限访问目标资源或执行目标动作。**

推导中最有价值的一问来自本人的实际工作经验：大型电商有「访客凭订单号 + 手机/邮箱查单」页，看似与「查别人订单 → 403」矛盾。结论是不矛盾——**403 不是看资源是不是别人的，而是看当前接口契约允许谁用什么凭据访问**：

```text
接口 A：/me/orders/:id
契约：只能登录用户访问自己的订单 → A 查 B 的订单 → 403

接口 B：/guest/orders/query
契约：允许访客凭订单号 + 手机/邮箱查询 → 凭据匹配 → 200
```

访客查单不是「无权限也给查」，而是订单号 + 手机/邮箱被设计成这条接口的访问凭据——授权模型由接口契约定义。

常见 403：普通用户访问 admin-only 接口、A 用户访问 B 用户私有订单、token 有效但角色不满足路由要求。

---

## 5. 可信角色来源（RBAC 设计点 3）

当前没有 `role` 字段，三个候选：

```text
A. JWT payload 里的 role
B. 数据库 User.role        ← 选择
C. 客户端传来的 role
```

选 B 的推导（先答后对，通过）：

- C 不可信：服务端不能直接相信前端发来的数据。补充边界：**「所有内容都要校验」不等于「所有内容都可信」**——请求体里的 role 即使格式校验通过，也只能说明它长得像 role，不能说明用户真的拥有它。
- A 有快照问题：JWT 一旦签发，role 在过期前固定；角色变更不能实时生效，除非引入 token version、查库、denylist 等额外机制（与 D3「不把 role 放进 token」的结论一致）。
- B 更可信：角色来自服务端持久化状态，授权时查当前用户角色。

**今日契约**：

```text
角色来源：数据库 User.role
角色集合：member / admin，默认 member
授权判断：token 只证明 sub；授权用 sub 查数据库当前 role
```

---

## 6. 授权放在哪一层（RBAC 设计点 4）

先分清三个词：认证 Authentication 回答「你是谁」；授权 Authorization 回答「你能做什么」；RBAC 是授权的一种方式，用角色判断。授权常见两类，位置不同：

```text
角色型授权（路由级）：只需要知道用户 role 和路由要求
  validateToken → requireRole('admin') → controller
  例：GET /admin/reports、DELETE /admin/users/:id

资源归属授权（资源级）：必须查具体资源的 owner，属 service 职责
  validateToken → controller → service 查订单并判断 owner
  例：GET /me/orders/:orderId
```

资源归属不适合普通中间件：中间件只看得到 `req.auth/params/body`，不知道具体资源属于谁；查资源、解释业务状态本来就是 service 的事。

**D4 边界**：只做角色型路由权限，`validateToken → requireRole('admin') → controller`；资源归属授权暂不做，后续放 service 层。可以记成一句话：**D4 RBAC 只解决「这个角色能不能进这个接口」，不解决「这个用户能不能操作这条具体资源」**。

实现拆法（本人规划，review 通过）：先实现 role 字段和授权中间件（能力准备），暂不接入 API（业务接线），下一步再决定接哪个接口。范围硬约束：只加 role 字段、只加查询当前用户 role 的最小 repository 能力、只加 `requireRole` 中间件；不改 JWT payload、不做资源归属授权、不扩展权限表。注意：中间件未接入时只能算「结构准备完成」，不算 RBAC 闭环——验收仍需至少一条路由跑通 member 403 / admin 200。

---

## 7. 实现与 review：错误分层被打回一次

本人实现（AI 只 review）：

- `models/users.js`：`role: { type: String, enum: ['member', 'admin'], default: 'member' }`——enum + default 兼容新注册用户。
- `repositories/users.js`：`findUserRoleById(userId)` 用原生投影 `{ role: 1, _id: 0 }` 只取 role，返回 `role | null`。
- `middlewares/validateRoleMiddleware.js`：`requireRole(requiredRole)` 工厂函数，前置条件是 `validateToken` 已执行。
- `errors/userErrors.js` 新增 `AuthorizationError`（「权限不足」）；`app.js` 错误处理器 switch 新增 `AuthorizationError → 403`。

### 首版 review：🔴 阻断性——所有异常都变成了 403

首版中间件把 catch 到的所有异常都转成 `AuthorizationError`，数据库查询失败、userId 格式异常、repository 抛错全部会伪装成「权限不足」。这属于**错误分层会误导调用方**（`AGENTS.md` review 准则中的阻断性分类）：403 只能表达「身份已确认，但 role 不满足要求」，不是「授权过程中的任何异常」。

修正后的分层（复查通过，无阻断性问题）：

```text
req.auth 缺失            → AuthenticationError → 401（认证前置条件未满足，不是 403）
role 查询成功但不匹配     → AuthorizationError  → 403
数据库异常 / 查询异常     → 原样 next(err) → 全局错误处理
```

🟡 锦上添花（接受代价，暂不改）：`findUserRoleById` 返回 `role | null`，中间件暂无法区分「用户不存在」与「用户存在但 role 缺失」；今天的最小 RBAC 够用，后续要做更细的安全日志或用户吊销语义时再返回用户摘要。

---

## 8. 接线与真实验证

选定方案：不新增验证 API，把现有两个报表接口接成 admin-only（它们本质都是财务/经营报表，接两个契约更一致）。范围收口：不新增业务 API、不做资源归属授权、不把 role 放进 JWT。

`routes/reports.js` 两条路由的链路：

```text
validateToken → requireRole('admin') → validateDays/validateMonths → validateStatus → controller
```

admin 账号创建：**不开放「注册时传 role」**——注册接口继续默认 member，避免客户端自我提权。流程为先用现有 register 创建账号，再用 mongosh 提权（属演示/种子数据操作，不是公开 API；命令已记入根 `README.md`「常用命令」）：

```javascript
db.users.updateOne({ email: <账户邮箱> }, { $set: { role: "admin" } })
```

**真实验证三条路径全部符合预期**：

```text
无 token 请求报表       → 401
member token 请求报表   → 403
admin token 请求报表    → 200
```

这三条完整证明：认证失败 ≠ 授权失败；身份有效但角色不足 = 403；admin 角色可访问财务报表。

遗留验证点：老用户文档里没有 role 字段时，按当前设计读取会拿到 schema 默认值、被视为非 admin（403），对今天可接受；真实老数据的行为待后续实际确认。

---

## 9. 测试与资产同步

### 集成测试（本人实现）

`__tests__/monthly-sales.test.js` 重构：`beforeAll` 创建 admin、member 两个真实用户文档（含 bcrypt hash 与显式 role），分别签发测试 token；新增关键失败路径测试：

```text
member token 请求 monthly-sales → 403，body 为 { error: '权限不足' }
```

原 200 用例改用 admin token。无 token 401 路径由 D3 新增的 Postman 用例继续覆盖。测试基线从 2 套件 / 6 测试变为 **2 套件 / 7 测试**。

### Postman 资产（AI 维护，白名单）

- 「七、Auth 登录」新增「admin 凭据」登录请求，自动保存 `adminAccessToken`。
- 「五、聚合报表」4 个请求改用 admin token；新增「Monthly sales - member forbidden」断言 403 与「权限不足」文案。
- YAML 目录与 JSON 导出已同步。

### 上午顺带的工程化小项

- 根 `README.md` 新增「常用命令」：MongoDB 与 SQL 概念对照、mongosh 连接/建索引/查索引、索引方向表、账户提升 admin 命令。
- `week2-express/src/reports.js`（W3 遗留 explain 实验脚本）改为按 stage 打印聚合性能摘要（nReturned / totalDocsExamined / totalKeysExamined / 耗时 / `$lookup` 索引使用），移除了故意用 name 关联导致覆盖 `userInfo` 的第二个 `$lookup`。属 W3 遗留实验优化，不占 W4 主线。

---

## 10. AI 辅助记录

- **辅助范围**：三个 RBAC 设计点的引导式问答与判定（401 语义、403 语义、可信角色来源）、授权分层讲解（角色型 vs 资源归属）、role/requireRole 首版与修正版 review（定位错误分层阻断性问题）、接线顺序与验证路径建议；自然月边界重建的出题与验收（过程中未提示）。
- **援助级别与场景**：L2（引导式问答、review、定向提示、接入范围建议）。role 字段、`findUserRoleById`、`requireRole` 中间件、错误映射、路由接线、集成测试均由本人手写；AI 未提供任何 RBAC 核心实现。
- **已记账**：最小 RBAC（数据库角色来源、授权中间件、admin-only 报表接线），L2，见 `DEBT.md`（2026-07-16）；D5 上午或周验收前第一档重建：只看笔记重画 `validateToken → requireRole → controller` 链路并解释 401/403 分界。
- **白名单项（不记账）**：Postman 两份资产同步、README 常用命令、mongosh 提权命令样板。
- **AI 表达偏差记录（本日两处，均已即时修正）**：① 「简明注册链路」把 `.save()` 的调用时序与 MongoDB 入库完成压扁成一层（见 3.1），修正为显式区分调用顺序/职责归属/返回值来源，约束已在 `AGENTS.md`「跨层链路讲解」固化；② 对本次 RBAC 会话无提问合并问题——本日引导式提问按「一问一个设计点、标注流程与阶段」执行，未再出现 D3 的两问合一。
- **本人理解验证**：401/403 语义、角色来源、授权分层四个设计点全部先答后对；403 推导中主动引入访客查单反例并要求指导，把「403 由接口契约定义」这一层想透；投影新旧模型对照实验先预测后验证，新模型预测与实际一致。

---

## 11. 本日产出与复盘

**已完成：**

1. ✅ 自然月边界第一档重建通过（还债 ①，回忆 + 推导；待补掌握证据后方可标已还）。
2. ✅ 投影理解模型校准：投影是 MongoDB 原生功能、save 返回内存对象、`findOneAndUpdate` 预测实验支持新模型。
3. ✅ 401/403 语义推导：401 = 不能确认你是谁（区分登录凭据验证与请求认证两个流程）；403 = 身份确认但接口契约的授权规则不放行。
4. ✅ 可信角色来源契约：数据库 `User.role`（member/admin，默认 member），token 仍只放 `sub`。
5. ✅ `requireRole` 授权中间件：首版错误分层问题（所有异常伪装 403）被 review 打回后修正为 401/403/透传三分。
6. ✅ 两个报表接口接成 admin-only；真实验证 无 token 401 / member 403 / admin 200。
7. ✅ 新增 member 403 集成测试；测试基线 2 套件 / 7 测试通过；lint 0 errors。
8. ✅ Postman 资产同步 admin 凭据与 member forbidden 用例。

**未完成 / 遗留：**

- ⬜ **Login 计时枚举风险结论未形成**（错误密码约 314ms vs 不存在用户约 2ms；dummy hash / 限流评估），顺延 D5——显式计划调整，不伪记完成。
- ⬜ 响应信封全量迁移未做，按计划降级 W6（403 响应仍是 `{ error }` 旧格式，见 `errors/userErrors.js` TODO）。
- ⬜ 401/403 的服务端原因日志（D3 遗留）仍未落地。
- ⬜ 老用户文档无 role 字段时的默认值行为未用真实数据确认。

**复盘：**

D4 三项止步条件全部达成：401/403 语义可演示并讲清（三条路径真实跑通）、两个接口有角色门槛、关键失败路径有测试覆盖（Jest 403 + Postman 401）。今天最有价值的收获有两个：一是 403 推导中用自己的电商工作经验（访客查单）对撞出「授权模型由接口契约定义」，比背标准答案深一层；二是首版中间件的错误分层问题——把系统异常伪装成 403 会误导调用方，这与 D3 的「错误翻译分层」是同一条原则在授权场景的重现，说明该原则还没有内化成写代码时的默认动作，RBAC 重建时要重点自查这一点。

投影讨论收获了一个可复用的判别句式：「看返回值来自哪里」——内存对象不经过投影，服务端读回的文档才经过。它同时解释了 save、`findOneAndUpdate`、mongosh 三个此前各自孤立的现象。

计时枚举顺延意味着 D5 更满：两个第一档重建 + RBAC 重建 + 计时枚举结论 + demo + OAuth2 流程 + 周复盘。需要在 D5 开工时先排优先级，OAuth2 按周三门槛结论可保持流程说明级别，不写代码。

---

## 12. 明日入口（D5 · 还债 + OAuth2 流程 + Demo + 周复盘）

1. 上午还债重建（第一档，各 15–20 分钟，AI 不提示只验收）：② 注册调用链的文件职责与依赖方向；③ JWT 签发链路的配置校验与分层边界；④ RBAC 授权链路（重画 `validateToken → requireRole → controller`，讲清 401/403 分界）。
2. Login 计时枚举风险形成明确结论：修复，或写下暂不修复的理由与触发条件。
3. 主线 demo：从注册走到受保护接口（register → login → member 403 → 提权 → admin 200）。
4. OAuth2 授权码流程说明：讲清 state / redirect URI / code / token 的职责与威胁点，不实现第三方登录代码。
5. 确认 `DEBT.md` 四条欠债状态（含自然月边界的补证据），写第 2 篇周复盘：明确一个已掌握点和一个仍需验证的问题。

D5 止步条件：demo 可完整走通；OAuth2 能讲清流程和威胁点；重建单元完成并记录通过与否；周复盘落笔。
