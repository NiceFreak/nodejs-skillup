# Day 3 · JWT 签发 + 验证中间件 + 报表接口受保护

> 今天完成 W4 主线第二段：上午固定 JWT 签发契约，下午实现签发（`jsonwebtoken`、最小 payload、1 小时有效期、secret 双重校验）并把 Login 成功响应迁移到契约 v2；随后推导验证中间件契约并实现 `validateToken`，两个报表接口全部改为先认证再校验参数。傍晚推送后 CI 红灯——集成测试没带 token 被自己的新中间件拦下 401，晚间修复测试并引入 ESLint + Prettier。D3 三项门槛全部达成：登录能签发 JWT、中间件能验证 JWT、真实接口受保护；测试保持 2 套件 / 6 测试全绿。

---

## 1. JWT 在当前链路中的职责

```text
客户端提交 email + password
→ Login 验证长期凭据
→ 验证成功后签发短期 access token
→ 客户端在后续受保护请求中携带 Bearer token
→ 服务端逐次验证 token，并从 sub 恢复身份声明
```

JWT 是无状态身份验证凭证：服务端不保存登录 session，而是独立验证每次请求携带的 token 是否由自己签发、是否被篡改、是否过期。

它只能证明「这个 token 合法且声明的主体是某个用户」，不能证明当前使用者仍是最初登录的人。Bearer token 一旦被窃取，攻击者在其有效期内同样可以使用。

接口是否需要 token 由接口用途决定，与 `GET`、`POST`、`PUT` 或 `DELETE` 等 HTTP 方法无关。

---

## 2. JWT 签发契约（最终版）

```text
签发时机：email/password 验证成功之后
token 类型：access token
payload：只放 sub，值为 userData._id.toString()
有效期：1 小时
签名密钥：process.env.JWT_SECRET
密钥缺失：应用启动失败并抛出明确配置错误
本阶段不放：email、name、role、password、passwordHash、addresses
```

选择 1 小时而不是最初设想的 15 分钟，是因为当前没有 refresh token。15 分钟过期会要求用户频繁重新输入密码；1 小时在本阶段的安全窗口与使用成本之间更合适。以后引入 refresh token 时可以重新缩短 access token 有效期。

`sub` 已经承载用户 ID，因此不再额外放一个重复的 `userId`。`email/name` 会变化，也不是恢复主体身份的必要字段；JWT payload 可以被客户端读取，不应放入不必要的个人信息或任何敏感数据。

当前启动命令 `node --env-file=.env server.js` 会把 `.env` 内容注入 `process.env`，业务代码实际读取的是 `process.env.JWT_SECRET`。不能自动生成或提供默认 secret，否则重启后旧 token 可能全部失效，错误配置也会被静默掩盖。

---

## 3. Login 成功响应（契约 v2）

从 D3 的 Login 成功响应开始采用已经确定的 v2 信封：

```json
{
  "code": 200,
  "message": "登录成功",
  "payload": {
    "accessToken": "<JWT>",
    "user": {
      "userId": "<MongoDB ObjectId string>",
      "name": "<name>",
      "email": "<email>"
    }
  }
}
```

安全边界：响应与 token payload 都不得出现 `password` 或 `passwordHash`。响应中的 `user` 是给客户端展示和保存的安全用户摘要；token payload 则只承担身份声明，两者不要混为一谈。

失败契约保持 D2 的结论：邮箱不存在、密码错误和历史无 `passwordHash` 用户统一返回 401，不泄露账号是否存在。错误信封的全量迁移仍按计划在 D4 统一处理。

旧响应（`{ message, data: { userId, name, email } }`）改为 v2 后不会导致 Express 自身报错，但会破坏依赖旧字段路径的客户端契约：`body.data.userId` → `body.payload.user.userId`。当前已知消费方只有 Postman 与集成测试，迁移范围可控，Postman 断言已同步（见第 9 节）。

---

## 4. 为什么后续请求不再重复提交密码

密码是长期主凭据，只用于 Login 时确认身份。每次受保护请求都重复提交密码，会增加长期凭据在网络、日志或错误处理路径中暴露的次数，也会让资源接口反复接触密码验证和存储层。

JWT 是有明确过期时间的短期 Bearer 凭证，用于后续高频身份识别。这样减少了密码暴露频率，也分开了长期凭据验证与短期请求认证的职责。

这不意味着 JWT 天然防窃取：安全仍依赖 HTTPS、较短有效期和正确的客户端存储策略。普通无状态 JWT 也不能直接吊销；denylist、token version 或查询数据库都能增强撤销能力，但会引入额外状态或查询成本，本阶段不实现。

### 为什么今天不把 role 放进 token

当前用户模型尚未引入角色，D3 只解决身份认证，不提前实现权限控制。角色写进 JWT 后会成为签发时的权限快照：如果数据库中的角色随后被降级，旧 token 仍携带原角色，并可能在过期前继续获得旧权限。缩短有效期、检查数据库当前角色、denylist 或 token version 可以缓解，但各有额外成本。因此今天的 token 只保留 `sub`，RBAC 留到 D4 单独设计。

---

## 5. 签发契约推导中答错的地方

这份契约经过多轮回答才稳定，主要修正了以下误区：

1. 曾把 JWT 说成「维持登录状态」甚至让 HTTP 从无状态变成有状态；修正为服务端逐次验证的无状态身份凭证。
2. 曾认为 token 能证明请求者始终是登录本人；修正为它只能证明 token 合法，无法识别 token 是否被盗。
3. 曾把 `userId/sub/email` 全放进 payload；修正为最小 payload 只保留标准声明 `sub`。
4. 曾把「secret 从哪里读取」答成「token 从请求头解析」；修正为 secret 来自 `process.env.JWT_SECRET`，Bearer token 的提取属于验证中间件。
5. 曾认为普通 JWT 可以被服务端直接吊销；修正为无状态 JWT 需要额外撤销机制，当前主要依赖过期时间。
6. 曾把 JWT 等同于授权；修正为 JWT 在本阶段只提供身份声明，资源权限由后续 RBAC 判断。
7. 最初凭印象选择 15 分钟；结合当前没有 refresh token 的约束，最终选择 1 小时。

---

## 6. 签发实现与验收

`services/authService.js` 在 `bcrypt.compare` 通过后签发：payload 只有 `sub: userData._id.toString()`，`expiresIn: '1h'`，Service 返回 `{ accessToken, user: { userId, name, email } }`，`passwordHash` 不再向外传递。Controller 按 v2 信封组装响应。

### 配置校验的归位（首版被 review 打回的地方）

首版把 JWT secret 校验误放进了数据库连接逻辑——secret 与 MongoDB 无关，数据库连接不应该依赖它。修正后的结构：

```text
server.js 启动时：JWT_SECRET 缺失或长度 < 32 → 抛 JwtSecretConfigurationError，进程直接退出
  （fail fast：配置错误不允许服务带病启动，且先于 connectDB 检查）
authService 签发点：同样的校验再做一次
  （防御性兜底：Service 不假设自己一定运行在完整启动流程之后，例如测试直接 import app）
```

顺带把 server.js 的启动/优雅关闭日志统一为中文，与本周「API 报错文案统一为中文」保持一致。

### 验收结果（真实服务）

- Login 正确凭据返回 v2 响应；解码 token 后 `sub` 与用户 `_id` 一致，`exp - iat = 3600`。
- 错误密码仍为统一 401，未受迁移影响。
- 新增 `JwtSecretConfigurationError`（「未配置 JWT SECRET 或其强度不足"）；secret 置空启动服务，进程按预期失败退出。

---

## 7. 验证中间件契约

签发验收后，先回答契约问题再动手（问答原始记录整理如下）：

```text
读取位置：req.headers.authorization，精确格式 Authorization: Bearer <token>
          「Bearer + 空格」为项目严格契约，不做大小写兼容
成功后：只保留最小身份声明 sub，写入自定义字段 req.auth = { sub }
        iat/exp 是 token 自身的生命周期信息，业务用不到，不透传
失败分支：缺失 Authorization、scheme/空 token 格式错误、JWT 结构错误、
          签名无效、token 过期 → 全部 401
          对客户端统一使用同一条文案，不区分具体原因（服务端日志可记录）
是否查库：不查。sub 已提供身份，当前阶段中间件保持无状态是最佳实践；
          这是本项目的契约选择，不是普适结论——需要即时吊销或实时角色的系统会选择查库
成功必须 next()，失败走 next(error) 进全局错误处理器，绝不能继续放行
```

### 认证与授权的分层图

```text
认证中间件      → 验证 token，回答「你是谁」
通用授权中间件  → 判断 admin/member 等路由级权限，回答「这个角色能否进入该接口」
Controller     → 读取 HTTP 输入，调用 Service，组织 HTTP 响应
Service        → 依据资源与业务规则授权，如「当前用户是否拥有这笔订单」
```

推导中的一个自我修正：原题把「保留哪些身份声明」和「挂到 req 哪个字段」混成一问，实际是两层语义——前者是 payload 取舍问题（只留 `sub`），后者是 Express 约定问题（中间件自定义 `req.auth`，不污染已有字段）。

---

## 8. 验证中间件实现与接线

`middlewares/validateTokenMiddleware.js`：

```text
无 Authorization 头            → next(new AuthenticationError())
不以 'Bearer ' 开头            → next(new AuthenticationError())
slice(7) 取出 token
JWT_SECRET 缺失或 < 32 位      → next(new JwtSecretConfigurationError())
jwt.verify 抛错（篡改/过期/结构错误）→ next(new AuthenticationError())
decoded.sub 缺失或非 string    → next(new AuthenticationError())
全部通过                        → req.auth = { sub }; next()
```

`AuthenticationError` 统一文案「Token 无效或已过期」。它与登录失败的 `InvalidCredentialsError` 状态码相同（都是 401）但文案不同：前者面向「凭 token 访问受保护资源」，后者面向「凭密码换取 token」，是两个不同阶段的失败。

接线与配套修改：

- `routes/reports.js`：两个报表路由（customer-spending、monthly-sales）都改为 `validateToken` → 参数校验 → Controller，**先认证再校验参数**——未认证的请求无权知道自己的参数错没错。
- `app.js` 全局错误处理器从 if/else 链重构为按 `err.constructor` 的 switch 映射（400/401/409/500），每个分支注明触发场景，新增 `AuthenticationError → 401`。

真实验证：无 token 请求报表返回 401，未进入报表查询；带登录签发的 token 返回 200。

---

## 9. CI 红灯复盘：保护接口是破坏性变更

17:46 推送后 CI 失败，这是本仓库 CI 第一次因自己的功能改动挂红：

```text
● GET /reports/monthly-sales › 返回按月分组的销售统计
  expect(res.status).toBe(200)
  Expected: 200
  Received: 401    ← 服务端日志：Token 无效或已过期
```

原因：给报表路由加 `validateToken` 时，只同步了 Postman 资产，忘了集成测试也是报表接口的消费方——测试裸请求被自己的新中间件按契约拦下。中间件行为完全正确，错的是消费方没跟上。

修复（`__tests__/monthly-sales.test.js`）：

- `beforeAll` 中若无满足强度的 `JWT_SECRET` 则为测试环境注入一个 ≥ 32 位的值——对应 Service 的防御性校验：测试直接 import app，不经过 server.js 启动检查。
- 用 `jwt.sign({ sub: 'test-user-id' })` 生成 1 小时有效期的测试 token；报表接口不依赖具体 userId，`sub` 用占位字符串即可。
- 请求补 `.set('Authorization', 'Bearer ' + authToken)` 形式的认证头。

修复后 CI 恢复绿灯，之后（含 lint 提交）连续保持 success。

**教训**：给存量接口加认证等同于修改接口契约，是对所有消费方的破坏性变更。动手前应先盘点消费方清单——本次有 Postman 和集成测试两个，只记得前者。这与 D2「后端不能信任前端」是同一枚硬币的另一面：接口的每个消费方都要按契约变更逐一对齐，测试也是消费方。

顺带修掉一处 Postman 资产漂移：YAML 集合误删了 `legacyUserEmail/legacyUserId` 变量声明，与 JSON 导出不一致（不影响按序执行，运行时 `pm.collectionVariables.set` 会自动创建，属一致性问题），已补回对齐。

---

## 10. 工程化收尾：引入 ESLint + Prettier

CI 事件暴露出「本地没有统一检查」的问题，晚间给 `week2-express/src` 引入 lint（配置属白名单，可由 AI 直接提供）：

- ESLint 10 flat config：`@eslint/js` recommended + `globals`（node/jest 分区）+ `eslint-config-prettier` 置底防止规则打架。
- 规则取舍：`no-console: off`（学习项目保留日志）；`no-unused-vars` 降为 warn 且忽略函数参数与 catch 变量（Express 错误处理器签名必须保留 4 参）。
- 两个已知债务文件降级不阻塞：`match-index-explain.js`（W3 遗留，混用 mongosh 全局）`no-undef: warn`；`node-server.js`（旧底层 demo）`no-useless-assignment: warn`。
- `package.json` 新增 `lint / lint:fix / format / format:check`；`.prettierignore` 排除 postman 资产与 lockfile。
- 全量 format 触及 20+ 文件（缩进/引号/分号统一），属一次性噪音提交，与功能改动分开提交。

---

## 11. Postman 资产同步

两份资产（YAML 目录与 JSON 导出）已同步，均由 AI 维护（白名单 API 展示资产）：

- 「七、Auth 登录 · 2. 正确凭据」：断言迁移到 v2（`code/message/payload`）、校验 `accessToken` 非空与安全用户摘要，并自动保存 collection variable `accessToken`。
- 「五、聚合报表」4 个请求全部携带 `Authorization: Bearer {{accessToken}}`；使用流程变为：先跑登录第 2 条拿 token，再跑报表。
- 新增「5. Monthly sales - missing token」：故意不带 Authorization，断言 401 与 error 文案，覆盖中间件保护行为。

---

## 12. AI 辅助记录

- **辅助范围**：签发契约与验证中间件契约的问题清单与 review；首版签发实现的 review（定位 secret 校验误放数据库连接、Service 重复校验的定性、Controller 未迁移 v2）；CI 失败根因定位（指出测试未带 token 被新中间件拦截）。
- **援助级别与场景**：L2（契约问答、review、定向提示）。`jwt.sign/jwt.verify` 调用、中间件全部分支、错误映射重构均由本人手写；CI 修复的测试改动由本人完成，AI 只提供诊断结论。
- **已记账**：JWT 签发链路的配置校验与分层边界，L2，见 `DEBT.md`（2026-07-15）；D5 上午第一档重建。
- **白名单项（不记账）**：ESLint/Prettier 配置、Postman 两份资产同步与漂移修复。
- **本人理解验证**：中间件契约六问先答后对（见第 7 节）；实现前预测了「测试会成为第二个消费方」的对齐点——但只在 Postman 上执行了，此偏差已在第 9 节复盘。
- **本周提问质量问题（流程改进项，本人发现）**：AI 引导式提问语义不精确，把多个设计点并入一问，已实际造成两次混淆——① D2/D3 交界处，凭据验证（bcrypt compare）与 JWT 签发被放进同一轮设计提问，两个分属不同阶段的流程在思考中混到一起，注册/登录的边界也被带偏；② 今天中间件契约第 2 问把「保留哪些身份声明」（payload 取舍）与「挂到 req 哪个字段」（Express 约定）混成一问，靠本人当场拆开才答清（见第 7 节）。改进约定：引导式提问一问只放一个设计点，并显式标注所属流程与阶段；纳入 D5 周复盘，待固化进 `AGENTS.md`。

---

## 13. 本日产出与复盘

**已完成：**

1. ✅ JWT 签发契约推导（含 7 处误区修正）与实现：最小 payload、1h 有效期、secret 启动/签发双重校验、fail fast。
2. ✅ Login 成功响应迁移契约 v2：`{ code, message, payload: { accessToken, user } }`。
3. ✅ 验证中间件契约推导 + `validateToken` 实现：严格 Bearer 格式、统一 401、`req.auth.sub`、无状态不查库。
4. ✅ 两个报表接口受保护，先认证后校验参数；错误处理器重构为 constructor switch。
5. ✅ CI 红灯定位与修复：集成测试接入合法测试 token，理解「加认证 = 破坏性契约变更」。
6. ✅ 引入 ESLint + Prettier 与配套 npm scripts。
7. ✅ Postman 两份资产同步 v2 与 Bearer 流程，新增 missing-token 401 用例，修复变量声明漂移。
8. ✅ 测试基线保持 2 套件 / 6 测试通过，main 分支 CI 绿。

**未完成 / 遗留：**

- ⬜ 中间件契约写明「服务端日志可记录 401 具体原因」，当前实现 catch 直接吞掉 `err`，尚未落地——D4 顺手补。
- ⬜ 错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状并存，全量信封迁移按计划排 D4，时间不足降级 W6。
- ⬜ 自然月边界第一档重建因时间过晚顺延 D4 上午（显式计划调整，不伪记完成）；注册调用链、JWT 签发链路两档重建在 D5。
- ⬜ Login 计时枚举风险（314ms vs 2ms）仍待 D4 评估。

**复盘：**

D3 三项门槛（登录签发 JWT、中间件验证 JWT、真实接口受保护）全部达成，D2 提前吃掉凭据验证的减负效果兑现——今天得以专注 JWT 一件事。CI 红灯是今天最有价值的意外：契约先行拦住了设计层面的错误，但「消费方盘点」这一步不在契约模板里，靠 CI 兜住了。它同时验证了两件事——集成测试真的在履行守门职责，以及自己的中间件行为与契约完全一致（拦下的请求恰好是该拦的）。

本周另一个实际发生的问题在提问侧而非代码侧：AI 引导式提问两次把多个设计点合并成一问（compare 与 JWT 签发同轮、中间件契约第 2 问两问合一），造成流程混淆。能当场把混在一起的问题拆开，本身是分层意识在起作用；但提问的精度不该依赖回答者当场纠偏，改进约定已记录在第 12 节，待 D5 周复盘固化。

---

## 14. 明日入口（D4 · RBAC + 安全失败路径）

1. 上午第一项：15–20 分钟自然月报表边界第一档重建（还债 ①），过程中 AI 不提示，只在结束后验收。
2. 区分 401 与 403，确定可信角色来源（token 快照 vs 查库），实现一个最小 RBAC 规则。
3. 自行设计并覆盖 1–2 条关键失败路径测试：无 token、非法/过期 token、权限不足。
4. Login 计时枚举风险至少形成结论（dummy hash / 限流，允许只出结论不落代码）。
5. 响应信封全量迁移仅在主线完成后进行；顺手补 401 的服务端原因日志。

D4 止步条件：401/403 语义可演示并讲清；至少一个接口有角色门槛；关键失败路径有测试覆盖。
