# Day 5 · 还债重建 + Demo + OAuth2 流程 + 周复盘

> D5 是 W4 最后一个有效学习日。今天主线先收还债重建，再处理 Login 计时枚举结论、主线 demo、OAuth2 授权码流程说明与周复盘。W4 鉴权相关内容属黑名单，AI 只出题、验收、讲解和 review，不代写核心实现。

---

## 1. 今日目标

1. 还债重建 ②：注册调用链的文件职责与依赖方向。
2. 还债重建 ③：JWT 签发链路的配置校验与分层边界。
3. 还债重建 ④：RBAC 授权链路：`validateToken → requireRole → controller`，讲清 401/403 分界。
4. Login 计时枚举风险形成明确结论：修复，或写下暂不修复的理由与触发条件。
5. 主线 demo：register → login → member 403 → mongosh 提权 → admin 200。
6. OAuth2 授权码流程说明：state / redirect URI / code / token 的职责与威胁点。
7. 确认 `DEBT.md` 四条欠债状态，并写 W4 第 2 篇周复盘。

## 2. 当前优先级

```text
还债重建
→ Login 计时枚举结论
→ 主线 demo
→ OAuth2 流程说明
→ 周复盘与状态更新
```

OAuth2 保持流程说明级别，不实现第三方登录代码；响应信封迁移已降级 W6。

## 3. 重建记录

### 3.1 注册调用链（还债 ②）

- 档位：第一档，只看自己的一页纸笔记。
- AI 规则：过程中不提示，只在回答后验收。
- 结果：待记录。

### 3.2 JWT 签发链路（还债 ③）

- 档位：第一档，只看自己的一页纸笔记。
- AI 规则：过程中不提示，只在回答后验收。
- 结果：待记录。

### 3.3 RBAC 授权链路（还债 ④）

- 档位：第一档，只看自己的一页纸笔记。
- AI 规则：过程中不提示，只在回答后验收。
- 结果：待记录。

## 4. Login 计时枚举风险

- 现象：错误密码约 314ms，不存在用户约 2ms。
- 待形成结论：是否修复；若暂不修复，写清理由与触发条件。

## 5. Demo 记录

目标动线：

```text
register 新账号
→ login 得到 member token
→ 报表 / 前端看板返回 403
→ mongosh 提权为 admin
→ 重新 login
→ 报表 / 前端看板返回 200
```

验证结果：待记录。

## 6. OAuth2 授权码流程说明

待记录：state / redirect URI / code / token 的职责与威胁点。

## 7. 周复盘

- 已掌握点：待记录。
- 仍需验证的问题：待记录。
- 下周入口：待记录。


题目：注册调用链 / D2
请你从一个 POST /auth/register 请求开始，完整讲清：
1. HTTP 请求先经过哪些层？
2. 每一层的职责是什么？尤其区分 middleware / controller / service / repository / model。
3. 密码是在什么时候 hash 的？为什么不是 controller 做？
4. .save() 的调用顺序、职责归属、返回值来源分别是什么？
5. 成功响应为什么不能直接返回 savedUser？
6. 至少讲两个失败路径：比如 body 校验失败、邮箱重复、数据库异常。
7. 依赖方向应该是什么？哪一层不应该反向依赖哪一层？
你回答后我只做验收：通过 / 不通过 / 哪个点需要补证据。

回答: 
1. POST /auth/register 请求进入后: -> Express 应用 -> 全局中间件(日志, 错误响应, json parser), 挂载的对应路由 -> Routes -> /auth/register  -> 校验中间件 validateHasRequestBody, validateRegisterBody ->  Controller -> Service (二次校验) -> repositories -> Mongoose -> 写入 MongoDB
2. app.js: 全局中间件
routes: 定义路径与 HTTP 方法的映射, 声明该路径专属的中间件(按需,可多可少)和 用到的 Controller
中间件: 是一个大类, 在这条路径中, 我们当前主要是校验中间件: validateHasRequestBody(存在请求体), validateRegisterBody(请求体基本形状)
controllers: 与 http 请求相关, 请求进入时, 从 req.body 提取参数, 调用 Service, 并将 Service 的返回值包装成 HTTP 响应 (状态码、JSON 结构), 不参与任何业务判断
Service: 承载核心业务逻辑: 密码策略校验、调用 bcrypt 生成哈希、构造数据对象、调用 Repository 写入, 决定返回什么给 Controller (安全裁剪)
repositories:  封装数据库操作: 创建 Mongoose 文档, 调用 .save(), 捕获并翻译数据库层错误为业务领域的错误, (ValidationError → 400，E11000 → 409), 不包含业务规则
model: 定义 schema
3. password（明文）→ bcrypt.hash() → passwordHash → 传递给 Repository, 这一整套逻辑都在 Service, Controller 关心的是 http 请求, 对于这类业务规则不属于我们的切分
4. repository.createUser 中执行 new User(userData) 创建内存文档 → 调用 .save() → Mongoose 执行校验 → 向 MongoDB 发送 INSERT 命令
.save() 是 Mongoose 文档实例方法，属于 ODM 层。Repository 负责调用它，但具体执行由 Mongoose 完成
.save() 返回的是 MongoDB 写入成功后，被数据库返回信息（如 _id）填充后的完整 Mongoose 文档对象。Repository 直接 return newUser 将这个对象抛回给 Service
5. savedUser 是 数据库原始文档, 包含 passwordHash, _id 等安全信息
6. 输入校验失败（缺字段 / 邮箱格式错误）: validateRegisterBody中触发,在Controller就被拦截,报错 400
邮箱重复（E11000）:Repository 层 createUser 中的 try-catch 触发, 409
数据库连接失败: 500, server.js 
7. 依赖方向应该是 从外向内：Controller → Service → Repository → Model,反向依赖绝对禁止

补答 1：.save() 调用顺序、职责、返回值
调用顺序：
new User(userData) → 内存创建文档实例 → .save() → Mongoose 校验 → INSERT → 数据库返回 _id → Mongoose 更新内存实例 → resolve 返回该实例
职责归属：.save() 是 Mongoose 文档实例方法，属于 ODM 层,Repository 负责调用它，不负责构造返回值
返回值来源：返回的是 new User(userData) 创建的那个内存文档实例本身，.save() 只是把它持久化到数据库，并用数据库返回的 _id 等字段同步更新该实例,不是通过额外的 find 查询从数据库读回来的

补答 2：错误翻译链路
Mongoose/MongoDB 原生错误
  ↓
Repository：识别类型 → 翻译成领域错误（UserValidationError / EmailConflictError）
  ↓
Service：透传（不捕获）
  ↓
Controller：透传（不捕获）
  ↓
全局 Error Handler：识别领域错误类型 → 设置 HTTP 状态码（400 / 409 / 401 / 403）→ 返回响应
关键边界：
Repository 只做 语义翻译（原生错误 → 领域错误），不决定 HTTP 状态码
HTTP 状态码由 全局 Error Handler 统一映射，保证一致性

通过。**注册调用链（还债 ②）第一档重建通过**。

补答把两个阻断点都收住了：

- `.save()`：你已经区分清楚了调用顺序、Mongoose 职责归属、返回值来源，尤其是“返回的是内存 document 实例，不是额外 find 读回来的结果”。
- 错误链路：你已经把 repository 的“原生错误 → 领域错误”和 error handler 的“领域错误 → HTTP 状态码”分开了，这个分层现在是清楚的。

剩余小瑕疵不影响通过：原答案里还有“错误响应作为全局中间件正常经过”“在 Controller 就被拦截”这些旧表述，但补答已经覆盖核心误差。整理笔记时把原答案对应句子改掉即可。

下一题进入 **还债重建 ③：JWT 签发链路**。

请继续按第一档规则，只看自己的一页纸笔记，不看代码。回答放进同一个 D5 笔记后告诉我 review。

**题目：JWT 签发链路 / D3**

从 `POST /auth/login` 成功进入 Service 开始，讲清：

1. 登录成功前，Service 要验证哪些东西？
2. 为什么需要 `select('+passwordHash')`？它和注册时的 `select: false` 是什么关系？
3. `JWT_SECRET` 应该在哪里校验？为什么不放数据库连接或 controller？
4. token payload 放什么？明确不放什么？
5. `jwt.sign` 属于哪一层的职责？controller 负责什么？
6. 登录成功响应的边界是什么？为什么返回 token + 安全 user 摘要，而不是返回完整 user document？
7. 至少讲两个失败路径：邮箱不存在 / 密码错误 / 历史无 hash 用户 / secret 配置错误。
8. 依赖方向和配置依赖边界是什么？

回答:
### 还债重建③：JWT 签发链路

1. 登录成功前 Service 验证三件事
   用户是否存在: findByEmailWithPasswordHash 返回 null → 失败
   passwordHash: 是否存在（历史无 hash 用户 → 失败，不自动补充）
   bcrypt.compare: 是否匹配（不匹配 → 失败）

2. `select('+passwordHash')` 的原因
   Schema 中 `passwordHash` 设置了 `select: false`，默认查询不返回
   登录时必须拿到哈希值才能做 `compare`，所以显式覆盖默认投影
   注册时存进去，登录时取出来，只在这一条链路上取回

3. JWT_SECRET 校验位置
   在 server.js, app.js 启动阶段校验
   不放在数据库连接或 controller, 数据库连接是基础设施，controller 是 HTTP 适配层，都不应该关心认证密钥的存在性

4. token payload
   - 只放 `sub: userId`。
   - 不放 `passwordHash`、`email`、`name`、`role`、`addresses` 等任何可变的或敏感的信息
   review 修订: email/name 更准确说是“不必要的个人信息且可变”，不是和 passwordHash 同级的敏感凭据；role 的重点是权限快照会过期

5. jwt.sign 的职责归属
   - Service 层负责签发 token（登录成功后的业务产出）
   - Controller 只负责将 Service 的返回值包装成 HTTP 响应（201注册创建资源 / 200登录 + JSON 结构）。

6. 登录成功响应边界
   - 返回 `{ accessToken, user: { userId, name, email } }`
   - 不返回 `passwordHash`、`_id`（原始文档），也不返回完整 user document

7. 失败路径
   - 用户不存在：`findByEmailWithPasswordHash` 返回 `null` → `InvalidCredentialsError` → `401`
   - 密码错误：`bcrypt.compare` 返回 `false` → `InvalidCredentialsError` → `401`
   - 历史无 hash 用户：`userData.passwordHash` 为空 → `InvalidCredentialsError` → `401`
   - `JWT_SECRET` 未配置：启动阶段 `throw new JwtSecretConfigurationError()` → 进程退出（`500` 级别，不会进入登录流程）

8. 依赖方向
   Controller → Service → Repository → Model
   配置依赖边界：`JWT_SECRET` 在启动阶段被读取并检查，不存在时应用直接崩溃，不降级、不兜底、不走登录流程。

**Review 结论**

这次 **暂不判通过**，主要卡在 `JWT_SECRET` 配置校验边界。其他部分整体不错：`select('+passwordHash')`、最小 payload、token + 安全 user 摘要、统一 401 失败路径都讲清了。

**阻断性问题**

1. [day5-rebuild-oauth-demo-retrospective.md](/Users/nezha/Documents/nodejs-skillup/week4-auth/notes/day5-rebuild-oauth-demo-retrospective.md:169)  
   `JWT_SECRET` 校验位置少了一半，而且写了 `app.js`。

   按 D3 结论和当前代码，正确边界是：

   ```text
   server.js 启动阶段：fail fast，缺失或强度不足则进程退出
   authService 签发点：防御性兜底，处理测试或直接 import app 等绕过 server.js 的入口
   ```

   不是 `app.js`。`app.js` 是 Express app 组装和错误处理，不应该变成配置校验入口。

2. [day5-rebuild-oauth-demo-retrospective.md](/Users/nezha/Documents/nodejs-skillup/week4-auth/notes/day5-rebuild-oauth-demo-retrospective.md:189)  
   “`JWT_SECRET` 未配置一定启动失败，不进入登录流程”只覆盖了正常 `server.js` 启动入口。

   D3 债务里明确要求解释“各入口的配置依赖”。如果测试或其他模块直接 import `app`，可能绕过 `server.js`，所以 service 签发点仍要做一次防御性校验；此时错误会进入全局 error handler，表现为 500 级配置错误，而不是进程启动失败。

**锦上添花**

- [day5-rebuild-oauth-demo-retrospective.md](/Users/nezha/Documents/nodejs-skillup/week4-auth/notes/day5-rebuild-oauth-demo-retrospective.md:179)  
  Controller 包装 Login 成功响应时这里写 “201 / 200”，登录应是 `200`；`201` 属于注册创建资源。

- [day5-rebuild-oauth-demo-retrospective.md](/Users/nezha/Documents/nodejs-skillup/week4-auth/notes/day5-rebuild-oauth-demo-retrospective.md:175)  
  `email/name` 更准确说是“不必要的个人信息且可变”，不是和 `passwordHash` 同级的敏感凭据；`role` 的重点是权限快照会过期。

**验收**

JWT 签发链路 **待补答**。只补两点就行：

1. `JWT_SECRET` 的双重校验边界：`server.js` 和 `authService` 分别解决什么入口问题？
2. 如果绕过 `server.js` 直接 import `app`，secret 缺失时错误如何流转？


### 补答：JWT 签发链路（修正）

1. `JWT_SECRET` 双重校验边界

- `server.js` 启动阶段: 校验 `JWT_SECRET` 是否存在且强度足够。缺失时 进程直接退出（exit code 1），防止应用带着无效配置启动, 这是第一道防线，覆盖正常的 `npm start` / `npm run dev` 入口
- `authService` 签发点: `login` 函数中，调用 `jwt.sign` 前再做一次防御性校验。这是第二道防线，覆盖测试或 `server.js` 之外的入口（如直接导入 `app.js` 的场景）。此时无法让进程退出，所以抛出 `JwtSecretConfigurationError`，由全局 error handler 转为 `500` 响应

`app.js` 不是校验入口: 它负责 Express 组装和错误处理，配置校验放在 `server.js` 和 `authService`，`app.js` 只需要能消费已校验的 `process.env.JWT_SECRET`。

2. 绕过 `server.js` 时 secret 缺失的错误流转

当测试或模块直接 `import app`（绕过 `server.js`）时，`JWT_SECRET` 在 `authService.login` 中被校验：

authService.login()
  → 发现 JWT_SECRET 缺失或强度不足
  → throw new JwtSecretConfigurationError
  → Controller（没有 try-catch，直接透传）
  → Express 全局 error handler
  → 识别为 JwtSecretConfigurationError
  → statusCode = 500
  → 返回 JwtSecretConfigurationError 的报错信息

关键区别
`server.js` 入口：缺失 → **进程退出**（阻止启动）。
绕过 `server.js`（如测试）：缺失 → **500 响应**（无法退出进程，但确保不会执行 `jwt.sign`）

通过。**JWT 签发链路（还债 ③）第一档重建通过**。

补答已经把关键边界讲清了：

- `server.js`：正常启动入口的 fail fast，配置不对就不让服务启动。
- `authService.login`：签发点的防御性兜底，覆盖测试或直接 `import app` 这种绕过 `server.js` 的入口。
- `app.js`：不是配置校验入口，只负责 Express 组装和全局错误处理。
- 绕过 `server.js` 时：`authService` 抛 `JwtSecretConfigurationError` → controller 不捕获 → Express error handler → 500 响应，不执行 `jwt.sign`。

整理笔记时，把原答案里 “server.js, app.js 启动阶段校验” 和 “不走登录流程” 那两句改掉就很稳了。

下一题进入 **还债重建 ④：RBAC 授权链路**。

请按第一档规则继续，回答写入同一个 D5 笔记后叫我 review。

**题目：RBAC 授权链路 / D4**

请从一个请求访问 admin-only 报表接口开始，讲清：

1. 完整中间件链路：`validateToken → requireRole('admin') → 参数校验 → controller` 各自负责什么？
2. `validateToken` 成功后给后续链路留下什么？为什么 token payload 里仍然只放 `sub`？
3. `requireRole` 为什么要查数据库里的 `User.role`，而不是信任客户端或 token 里的 role？
4. 401 和 403 的分界是什么？分别举例。
5. `req.auth` 缺失、用户不存在 / role 不匹配、数据库异常，分别应该怎么流转？
6. 为什么首版 “catch 里统一转 AuthorizationError” 是阻断性问题？
7. 角色型路由授权和资源归属授权有什么区别？为什么 D4 只做前者？
8. 当前最小 RBAC 的范围边界是什么？哪些明确不做？

回答:
1. `validateToken` 从 Authorization 头提取 token，验证签名和过期，通过后把 `{ sub }` 挂到 `req.auth`，失败则 `next(AuthenticationError)`。`requireRole('admin')` 从 `req.auth.sub` 查数据库取 role，匹配则放行，不匹配抛 AuthorizationError，数据库异常透传。参数校验只检查查询参数形状，不管授权。Controller 只调 Service 返回响应，不参与授权判断。

2. `validateToken` 只留 `req.auth = { sub: userId }`。payload 只放 sub，不放 role/email/name。因为 role 放 token 会导致角色变更后旧 token 仍持有旧权限，要额外机制才能撤销。

3. `requireRole` 查数据库因为 token 只证明身份，不证明权限。角色是服务端持久状态，查库保证变更即时生效。客户端传的不可信，token 里的有快照问题，只有数据库是可信来源。

4. 401 是认证失败，无法确认身份。比如无 token、token 过期、签名无效。403 是身份已确认但权限不足。比如 member 访问 admin-only 报表。

5. `req.auth` 缺失：requireRole 中检测到，next AuthenticationError → error handler → 401。用户不存在或 role 不匹配：findUserRoleById 返回 null 或 role 不等于 admin，next AuthorizationError → error handler → 403。数据库异常：catch 中 next(err) 透传 → error handler → 500。

6. 首版 catch 统一转 AuthorizationError 把所有异常都变成权限不足，会误导排查。运维看到 403 以为是权限问题，实际可能是数据库挂了。修正后只有 role 不匹配才转 403。

7. 角色型授权与具体资源无关，只依赖角色，适合路由级拦截。资源归属型依赖具体资源归属关系，适合 Service 层判断。D4 只做前者，因为实现简单，能完整走通认证→授权→403 链路。资源归属型留到后续订单接口再做。

8. 当前最小 RBAC：User.role 字段、findUserRoleById、requireRole('admin') 中间件、两个报表 admin-only、自动测试覆盖 200/403。明确不做：权限表、多角色、资源归属授权、role 放 JWT payload。
订正: 自动测试覆盖 200/403”，更完整地说是 Jest 覆盖 admin 200 / member 403，Postman 资产覆盖 missing-token 401。


通过。**RBAC 授权链路（还债 ④）第一档重建通过**。

你这次几个关键点都讲准了：

- `validateToken` 只做认证，留下 `req.auth = { sub }`。
- `requireRole('admin')` 做角色型路由授权，角色来源查数据库，不信客户端，也不把 role 放 token。
- 401/403 分界清楚：不能确认身份是 401；身份确认但权限不足是 403。
- `req.auth` 缺失 → 401；role 不匹配 → 403；数据库异常 → 原样透传到 500，不伪装成 403。
- 首版 catch 统一转 `AuthorizationError` 为什么是阻断性问题，你讲到了核心：会把系统异常误报成权限不足，误导调用方和排查。
- 角色型授权 vs 资源归属授权的边界清楚，D4 只做前者。

小瑕疵不影响通过：你写“自动测试覆盖 200/403”，更完整地说是 Jest 覆盖 admin 200 / member 403，Postman 资产覆盖 missing-token 401。整理笔记时顺手改一下即可。

到这里，D5 三个重建单元都过了：注册、JWT、RBAC。下一步进入 **Login 计时枚举风险结论**。

请先在笔记里写你的判断，回答这三个点：

1. 当前现象：不存在用户约 2ms，错误密码约 314ms，风险是什么？
2. 今天是否修复？如果修，方向是什么；如果不修，为什么可接受？
3. 触发修复的条件是什么？例如公开登录入口、生产环境、攻击面扩大、加入限流前后等。

回答: 
1. 现象：用户不存在约2ms返回，错误密码约314ms返回，虽返回相同401文案，但响应时间差异可被统计计时区分。风险是攻击者可利用时间差枚举有效邮箱，为后续针对性攻击提供目标。

2. 今天不修复。当前是学习/demo 环境，登录入口未作为公网生产服务暴露，且今天主线优先级是 W4 收口。该风险记录为安全遗留，不记 DEBT。

3. 触发修复条件：登录入口进入生产/公网、出现扫描或枚举迹象、计划上线真实用户系统、或加入限流后仍希望降低计时侧信道。优先方案：不存在用户时执行一次 dummy bcrypt.compare；同时配合 IP/账号维度限流。