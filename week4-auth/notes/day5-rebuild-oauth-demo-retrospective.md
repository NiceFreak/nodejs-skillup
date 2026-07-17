# Day 5 · 还债重建 + OAuth2 流程 + W4 周复盘

> D5 是 W4 最后一个有效学习日。今天先完成注册 / JWT / RBAC 三个第一档重建，再对 Login 计时枚举风险形成结论，随后学习 OAuth2 授权码流程并同步为展示材料，最后做 W4 周复盘与 Week3 协作问题回看。W4 鉴权相关内容属黑名单，AI 只出题、验收、讲解和 review，不代写核心实现；`week8-fullstack/` 展示前端与 demo 讲稿属于白名单展示资产。

---

## 1. 今日目标与实际取舍

原计划：

1. 还债重建 ②：注册调用链的文件职责与依赖方向。
2. 还债重建 ③：JWT 签发链路的配置校验与分层边界。
3. 还债重建 ④：RBAC 授权链路：`validateToken → requireRole → controller`，讲清 401/403 分界。
4. Login 计时枚举风险形成明确结论。
5. 主线 demo：register → login → member 403 → mongosh 提权 → admin 200。
6. OAuth2 授权码流程说明：`state` / `redirect_uri` / `code` / `access token` 的职责与威胁点。
7. 确认 `DEBT.md` 四条欠债状态，并写 W4 周复盘。

实际完成：

- 三个第一档重建均通过：注册调用链、JWT 签发链路、RBAC 授权链路。
- Login 计时枚举形成明确结论：今天不修，记录为安全遗留；触发条件明确。
- OAuth2 完成流程级学习，不写第三方登录代码；学习成果已同步到 Week8 展示前端的一个 tab。
- Demo 讲稿按周命名为 `week4-auth/notes/week4-demo-script.md`，不再使用 day 级命名。
- 周复盘完成；Week3 数据库线进入回看，不新增学习债务，只澄清问题。

未完成 / 顺延：

- 主线 demo 今天没有重新实跑；当前项目代码用户已确认可运行，后续 demo 前再按讲稿跑一遍。
- `DEBT.md` 状态未在本笔记中直接改写；D5 只记录重建通过事实，是否标「已还」仍按 DEBT 证据标准单独确认。

---

## 2. 还债重建记录

### 2.1 注册调用链（还债 ②）——第一档通过

档位：第一档，只看自己的一页纸笔记。  
AI 规则：过程中不提示，只在回答后验收。

题目要求从 `POST /auth/register` 开始讲清：

- 请求经过哪些层；
- middleware / controller / service / repository / model 的职责；
- 密码何时 hash，为什么不是 controller 做；
- `.save()` 的调用顺序、职责归属、返回值来源；
- 为什么成功响应不能直接返回 `savedUser`；
- 至少两个失败路径；
- 依赖方向。

本人重建出的主链路：

```text
Express app
→ route
→ validateHasRequestBody / validateRegisterBody
→ controller
→ service
→ repository
→ Mongoose model / document
→ MongoDB
```

关键职责：

- route：声明 HTTP 方法、路径、中间件和 controller。
- middleware：校验请求体存在、字段形状和基础格式。
- controller：从 HTTP 请求中取参数，调用 service，把 service 结果包装成 HTTP 响应。
- service：承载注册业务规则，包括密码策略、`bcrypt.hash()`、构造写入数据、安全裁剪返回值。
- repository：封装数据库操作，创建 Mongoose document，调用 `.save()`，把 Mongoose / MongoDB 原生错误翻译成领域错误。
- model：定义 schema、字段类型、校验器、默认值、投影策略等。

补正后的 `.save()` 模型：

```text
new User(userData)
→ 在 Node 内存里创建 Mongoose document
→ document.save()
→ Mongoose 执行校验并向 MongoDB 发起 insert
→ MongoDB 写入成功并返回 _id 等写入结果
→ Mongoose 把结果同步回原 document 实例
→ save resolve 返回这个内存 document 实例
```

`.save()` 是 Mongoose document 实例方法，属于 ODM 层；repository 负责调用它，但不构造它的返回值。它不是额外执行一次 `find` 从数据库读回完整用户。

错误翻译链路：

```text
Mongoose / MongoDB 原生错误
→ repository 识别并翻译成领域错误
→ service 透传
→ controller 透传
→ 全局 error handler 映射 HTTP 状态码和响应
```

关键边界：

- repository 做「原生错误 → 领域错误」。
- 全局 error handler 做「领域错误 → HTTP 状态码」。
- service / controller 不把数据库错误伪装成 HTTP 响应。

验收结论：通过。注册调用链第一档重建通过。

---

### 2.2 JWT 签发链路（还债 ③）——补答后通过

档位：第一档，只看自己的一页纸笔记。  
第一次回答未通过，原因是 `JWT_SECRET` 配置校验边界说漏了一半，并误把 `app.js` 说成校验入口；补答后通过。

登录成功前 service 要验证：

- 用户是否存在：`findByEmailWithPasswordHash(email)` 返回 `null` 则失败。
- 用户是否有 `passwordHash`：历史无 hash 用户失败，不自动补。
- 密码是否匹配：`bcrypt.compare()` 返回 `false` 则失败。

`select('+passwordHash')` 的意义：

```text
schema 中 passwordHash 设置 select:false
→ 默认查询不返回 passwordHash
→ 登录链路必须拿 hash 做 compare
→ 本次查询显式 +passwordHash 加回
```

注册时负责写入 hash；登录时只在这一条链路显式取回 hash。这个字段不能默认暴露给普通查询。

JWT payload 边界：

```text
只放：sub = userId
不放：passwordHash、role、email、name、addresses 等
```

修正理解：

- `passwordHash` 是敏感凭据材料，绝不能放 token。
- `role` 不放 token，是为了避免权限快照过期；角色变更应查数据库当前状态。
- `email/name` 更准确说是不必要、可变的个人信息，不是和 `passwordHash` 同级的敏感凭据。

`JWT_SECRET` 的双重校验边界：

```text
server.js 启动阶段：
  正常 npm start / npm run dev 入口的 fail fast。
  secret 缺失或强度不足时，进程直接退出，防止服务带病启动。

authService.login 签发点：
  防御性兜底。
  覆盖测试或直接 import app 等绕过 server.js 的入口。
  secret 缺失时抛 JwtSecretConfigurationError，由全局 error handler 返回 500。

app.js：
  只负责 Express app 组装和错误处理，不是配置校验入口。
```

绕过 `server.js` 时的错误流转：

```text
authService.login()
→ 发现 JWT_SECRET 缺失或强度不足
→ throw JwtSecretConfigurationError
→ controller 不捕获，透传
→ Express 全局 error handler
→ 500 配置错误响应
→ 不执行 jwt.sign()
```

登录成功响应边界：

```text
{
  accessToken,
  user: { userId, name, email }
}
```

不返回完整 user document，不返回 `passwordHash`，也不把 Mongoose document 原样交给前端。

验收结论：补答后通过。JWT 签发链路第一档重建通过。

---

### 2.3 RBAC 授权链路（还债 ④）——第一档通过

档位：第一档，只看自己的一页纸笔记。  
题目要求从 admin-only 报表接口开始讲清 `validateToken → requireRole('admin') → 参数校验 → controller`。

完整链路：

```text
validateToken
→ requireRole('admin')
→ validateStatus / validateMonths / validateDays 等参数校验
→ controller
→ service
→ repository
```

职责：

- `validateToken`：从 `Authorization` header 提取 Bearer token，验证签名和过期时间；成功后留下 `req.auth = { sub }`。
- `requireRole('admin')`：用 `req.auth.sub` 查数据库中的 `User.role`；角色匹配则放行，角色不匹配则 403。
- 参数校验：只管 query/body/params 的形状和枚举值，不管认证授权。
- controller：调用 service 并返回响应，不参与授权判断。

为什么 token payload 仍只放 `sub`：

```text
token 证明身份；
role 是授权决策需要的当前服务端状态；
如果 role 放 token，角色变更后旧 token 会继续持有旧权限快照。
```

角色可信来源：

- 客户端传来的 role 不可信。
- token 里的 role 有快照过期问题。
- 数据库 `User.role` 是服务端当前持久化状态，本次最小 RBAC 选择它作为可信来源。

401 / 403 分界：

```text
401：我不能确认你是谁。
  例：无 token、token 过期、签名无效、req.auth 缺失。

403：我知道你是谁，但你不能做这件事。
  例：member 访问 admin-only 报表。
```

异常流转：

```text
req.auth 缺失
→ AuthenticationError
→ 401

用户不存在 / role 不匹配
→ AuthorizationError
→ 403

数据库异常
→ 原样 next(err)
→ 全局 error handler
→ 500
```

为什么首版 `catch` 统一转 `AuthorizationError` 是阻断性问题：

```text
数据库挂了 / 查询异常 / 系统错误
如果都被伪装成 403，
调用方和运维会以为只是权限不足，
错误分层被破坏，排查方向会错。
```

角色型授权 vs 资源归属授权：

- 角色型授权：只依赖身份角色和路由契约，适合中间件，例如 admin-only 报表。
- 资源归属授权：必须查具体资源 owner，适合 service 层，例如用户只能看自己的订单。

D4 只做前者：目标是最小闭环跑通认证 → 授权 → 403；不做权限表、多角色系统、资源归属授权，也不把 role 放 JWT payload。

验收结论：通过。RBAC 授权链路第一档重建通过。

---

## 3. Login 计时枚举风险结论

现象：

```text
不存在用户：约 2ms 返回 401
错误密码：约 314ms 返回 401
```

虽然响应文案相同，但响应时间差异可被统计利用。攻击者可以通过大量请求推断哪些邮箱真实存在，为后续撞库、钓鱼或针对性攻击提供目标。

今日结论：**今天不修复**。

理由：

- 当前是学习 / demo 环境。
- 登录入口未作为公网生产服务暴露。
- 今天主线优先级是 W4 收口、OAuth2 流程和周复盘。
- 记录为安全遗留，不新增 DEBT。

触发修复条件：

- 登录入口进入生产或公网。
- 出现扫描、枚举或异常登录尝试。
- 准备接真实用户系统。
- 加入限流后仍希望降低 timing side channel。

优先修复方向：

```text
不存在用户时也执行一次 dummy bcrypt.compare
→ 拉平“用户不存在”和“密码错误”的时间差
→ 同时配合 IP / 账号维度限流
```

---

## 4. OAuth2 授权码流程学习

### 4.1 OAuth2 解决的核心问题

最初理解偏差：

```text
以为第三方可能发来密码哈希或某种约定格式，
OAuth2 是不同鉴权体系之间对齐密码 / 哈希。
```

修正后：

```text
OAuth2 解决的是：
用户不把第三方密码交给我们的系统；
而是在第三方完成登录与授权后，
让我们的系统拿到一个受限、可过期、可撤销的授权结果。
```

GitHub / Google 不会把密码或密码哈希发给我们。哈希也是第三方认证体系中的敏感内部材料，不能当成普通凭据跨系统流转。

边界补充：

- OAuth2 本身偏授权协议。
- 真正标准化“第三方登录身份”的是 OpenID Connect。
- 常见 GitHub 登录通常是用 OAuth2 拿 access token，再请求用户资料，最后绑定本地账号并建立本系统登录态。

---

### 4.2 授权码流程角色与主链路

参与方：

```text
用户浏览器
我们的前端 / 后端
GitHub 授权服务器
GitHub 资源服务器
```

流程：

```text
1. 用户在我们的页面点击“使用 GitHub 登录”
2. 我们的前端 / 后端把浏览器重定向到 GitHub 授权地址
3. 用户在 GitHub 页面登录并确认授权
4. GitHub 授权服务器通过浏览器重定向回我们的 callback，并在 URL 上带 code
5. 我们的后端 callback API 收到 code
6. 我们的后端用 code + client_secret 向 GitHub 授权服务器换 access token
7. 我们的后端用 access token 请求 GitHub 资源服务器的用户资料接口
8. 我们根据 GitHub user id 创建或绑定本地用户，email 只作展示或辅助绑定
9. 我们给自己的前端建立本系统登录态，例如签发我们自己的 JWT
```

关键区分：

```text
code 来自授权服务器，经浏览器重定向带回 callback。
access token 由我们的后端用 code + client_secret 向授权服务器换来。
用户资料来自资源服务器。
本系统 JWT 由我们自己签发，用于访问我们自己的 API。
```

第三方多服务器流转的学习价值：

```text
授权服务器负责发放受限凭据；
资源服务器负责按凭据交付被授权的数据；
我们的系统用这些数据建立自己的用户身份。
```

它帮助我避免把 OAuth2 理解成“GitHub 直接告诉我们用户是谁”。更准确是：

```text
GitHub 先确认用户授权
→ 我们拿到受限 access token
→ 我们再用 token 去访问被授权的用户资料
→ 我们据此识别 / 绑定本地用户
```

---

### 4.3 code 与 access token 的边界

结论：

```text
code 和 access token 是解耦的职责边界，
但不是无关系的两个东西。
```

区别：

```text
code：
  一次性、短期、经浏览器 URL 带回的换票凭据。
  它不直接用于访问资源。

access token：
  后端用 code 换来的受限凭据。
  用于访问 GitHub 资源服务器上的被授权资源。
```

这个拆分的安全价值：

```text
浏览器只带 code 回来；
真正敏感的 code → token 交换发生在后端；
access token 不应该直接暴露在浏览器跳转 URL 里。
```

---

### 4.4 state：随机 nonce / 流程关联 ID

最初类比偏差：

- 把 `state` 类比为“订单状态 status”，像 pending → completed。
- 后来又类比成 `traceId`，用于追踪请求。

修正后：

```text
state 不是业务状态，而是一次 OAuth 登录流程的随机 nonce / 关联 ID。
它的作用不是排查日志，而是安全校验：
证明 callback 对应我们刚刚发起的那次跳转。
校验失败时必须拒绝流程，防止 OAuth 登录 CSRF / 回调串线。
```

流程：

```text
我们发起 OAuth 登录前生成随机 state
→ 暂存在服务端 session / cookie / 其他状态存储中
→ 跳转 GitHub 时带上 state
→ GitHub callback 回来时也带回 state
→ 我们校验 callback 中的 state 是否与之前保存的一致
→ 一致才继续，不一致直接拒绝
```

和 `traceId` 的区别：

```text
traceId 主要用于观测和排查问题；
state 主要用于安全校验，必须随机、不可预测、匹配失败要拒绝。
```

---

### 4.5 OAuth App 注册：client_id / client_secret / redirect_uri

今天补齐了一个之前不知道的前置阶段：

```text
A. 开发者配置阶段：我们的系统先去第三方平台注册一个 OAuth App
B. 用户登录阶段：用户点击“使用 GitHub 登录”后走授权码流程
```

开发者配置阶段类似在支付平台开商户：

```text
注册 OAuth App
→ 获得 client_id / client_secret
→ 登记 redirect_uri
```

最终订正：

```text
OAuth App 注册类似在支付平台开商户：
client_id 像 merchant_id，公开标识这个应用；
client_secret 像 secret_key，只给后端换 token 时证明应用身份；
redirect_uri 像支付回调白名单，限制 code 只能回到我们登记过的 callback。
```

边界：

- `client_id` 是公开应用标识，可以出现在浏览器跳转 URL 中；它标识的是 OAuth App，不是用户。
- `client_secret` 是应用密钥，只能放后端，不能放前端。
- `redirect_uri` 通常是后端 callback API，不一定是页面地址。

---

### 4.6 redirect_uri 风险

为什么必须提前登记：

```text
授权服务器必须知道：
这个 client_id 允许把 code 回调到哪些地址。
```

为什么登录时传来的 `redirect_uri` 必须和登记值匹配：

```text
只校验 client_id 不够。
攻击者可以拿我们的 client_id 发起授权请求，
但把 redirect_uri 改成自己的服务器。
如果授权服务器不校验，code 就会被送到攻击者控制的地址。
```

风险：

```text
用户授权后
→ GitHub 带 code 跳到 https://evil.com/callback
→ 攻击者截获 code
```

修正后的精确表述：

```text
如果 redirect_uri 能被改成 evil.com，攻击者至少能截获 code。
在保密客户端场景下，因为攻击者没有 client_secret，理论上不能直接换 token；
但 code 泄露本身已经破坏授权码流程安全边界。
如果 client_secret 泄露，或是无 secret 的公共客户端且缺少 PKCE，
攻击者就可能进一步换取 access token。
```

一句话总结：

```text
redirect_uri 白名单的目的，是确保授权服务器只把 code 发回我们控制的 callback；
否则攻击者可以截获 code，并在其他防线薄弱时进一步换 token 或造成账号绑定串线。
```

和 `state` 的区别：

```text
redirect_uri：这个 code 要回到哪个网站 / 路径？是不是我们注册过的地址？
state：这个 callback 是不是我们刚刚发起的那一次登录流程？
```

---

### 4.7 为什么 code 换 token 必须发生在后端

结论：

```text
client_secret 不能暴露；
GitHub access token 是访问 GitHub 资源的凭证；
我们自己的 JWT 是访问我们系统资源的凭证。
```

为什么不是前端拿 code 直接换 access token：

- 换 token 需要 `client_secret`。
- 浏览器是公开环境，前端代码和请求都可被查看。
- `client_secret` 放前端等于公开。
- `code → access token` 是敏感交换，应放在后端。

为什么不能把 GitHub access token 当成本系统 token：

```text
GitHub access token 代表：
  用户允许我们的应用访问 GitHub 那边的某些资源。

我们的 JWT 代表：
  用户已经在我们系统建立了本地登录态，可以访问我们自己的 API。
```

修正后的表述：

```text
GitHub access token 可以帮助我们获取 GitHub 用户资料，从而建立本地身份；
但它本身不应该直接成为我们系统 API 的认证 token。
```

OAuth2 最低学习要求达成：

- 能讲清授权码流程。
- 能区分 `state`、`redirect_uri`、`code`、`access token`。
- 能解释 `client_id` / `client_secret` / OAuth App 注册。
- 能说明第三方 access token 与本系统 JWT 的边界。

---

## 5. Demo 与展示资产

今天未实跑完整 demo，但完成了展示资产整理：

- demo 讲稿文件按周命名：`week4-auth/notes/week4-demo-script.md`。
- Week8 展示前端增加 OAuth2 流程 tab，用于展示本周“第三方登录流程理解”成果。
- 当前项目代码用户确认可运行；正式演示前再按讲稿跑一遍。

Demo 主线仍是：

```text
register 新账号
→ login 得到 member token
→ member 访问报表返回 403
→ mongosh 提权为 admin
→ admin 重新 login
→ 报表 / 前端看板返回 200
→ OAuth2 tab 讲清第三方登录授权码流程
```

---

## 6. W4 周复盘

### 6.1 W4 最确定掌握的点

最确定掌握的是认证鉴权链路的分层边界：

```text
validateToken
→ requireRole
→ controller
→ service
→ repository
```

现在能区分：

- `validateToken`：认证，确认 token 是否有效，留下 `req.auth = { sub }`。
- `requireRole`：角色型授权，查数据库当前 role，判断是否能进入接口。
- controller：HTTP 适配层，不承载业务判断。
- service：业务规则层，负责凭据验证、token 签发、响应数据安全裁剪等。
- repository：数据库访问与原生错误翻译。

错误分层也更稳定：

```text
认证失败 → 401
授权不足 → 403
系统异常 → 500
```

这周也确认了一个协作层面的收获：当 AI 指引精度不足造成困惑时，不能把问题全部归因到自己；需要同时 review AI 的问题拆分、提问方式和验收标准。

### 6.2 仍需验证或延后补的问题

W3 数据库与聚合优化缺口仍需回看：

- `covered query` 尚未验证。
- `match-index-explain.js` 仍不可运行。
- 索引实验和 explain 结论需要更细致复盘。
- Week3 学习收益不佳，需要区分个人理解缺口与 AI 拆题 / review 不足。

W4 工程遗留：

- API 响应信封全量迁移顺延 W6。
- Login 计时枚举修复条件已记录，暂不实现。
- 401/403 服务端原因日志未落地。

### 6.3 最容易混淆的边界

最容易混淆的是 401 和 403。

当前区分：

```text
401：我不知道你是谁。
403：我知道你是谁，但你做不了这件事。
```

代码映射：

```text
validateToken 失败
→ AuthenticationError
→ 401

requireRole 角色不匹配
→ AuthorizationError
→ 403
```

同时要注意：登录接口的“邮箱不存在 / 密码错误 / 历史无 hash 用户”也是 401，但它发生在“凭据换 token”的登录阶段，不是受保护接口中的 `validateToken` 阶段。

### 6.4 W5 入口

W5 从 Node.js 事件循环开始。

第一步不是写复杂 demo，而是用一个最小脚本观察：

```text
同步代码
Promise microtask
setTimeout
setImmediate
```

目标是先建立：

```text
调用栈
→ microtask queue
→ macrotask / event loop phase
```

之后再进入 libuv、流与 worker threads。

---

## 7. Week3 协作复盘：问题归因收口

今天对 Week3 的回看不以增加学习债务为目的，而是厘清问题。

总体结论：

```text
Week3 学习收益不佳，是双方配合问题。
本人没有足够认真对待数据库思维；
AI 高估了本人的数据库基础认知；
最终导致任务虽然跑通，但部分关键边界没有被充分验收。
```

这是客观协作事实，不写成过度自我贬低。更可行动的表述是：

```text
数据库线需要更慢的契约澄清、更具体的样例日期、更硬的边界测试和更谨慎的 explain 结论。
AI 后续不能默认我已经具备数据库优化基础；
我后续也不能把“API 能跑通”当作数据库思维已经建立。
```

已发现的 Week3 问题方向：

1. `months=6` 当时没有精确定义为“包含当前月在内最近 6 个自然月”，后来才在 W4 修正为 `[startDate, endDate)`。
2. Week3 复盘中“查询优化就是字段有没有索引”有启发，但表达过满；还需要补选择性、排序、投影、数据量、优化器选择等限定。
3. CI 提供的 `MONGODB_URI` 未被集成测试使用，`mongo:7` service 处于空转状态；W6 需要收口。
4. `match-index-explain.js` 混用 Node/Mongoose 与 mongosh API，不可作为可运行工具。
5. Week3 笔记中残留部分 AI 回复口吻和教学脚本痕迹，后续整理最终复盘素材时需要清理。

后续反思约束：

- 可以承认“没有认真对待数据库思维”这个事实。
- 不把它扩展成“我不行 / 我基础差所以学不好”这类人格化结论。
- 所有反思都落到可验证动作：补哪个实验、讲清哪个边界、修复哪个脚本、增加哪个测试。

---

## 8. 验证与状态

今日验证记录：

- 后端当前测试：`npm test -- --runInBand`，结果 `2 suites / 7 tests passed`。
- 前端 OAuth2 tab 与 demo 资产此前已通过 `yarn typecheck` 与 `yarn build`。
- demo 未在今天重新完整跑一遍，正式演示前再按 `week4-demo-script.md` 走一遍。

当前欠债状态：

- ② 注册调用链：第一档重建通过。
- ③ JWT 签发链路：补答后第一档重建通过。
- ④ RBAC 授权链路：第一档重建通过。
- 是否标记为“已还”仍按 `DEBT.md` 标准：重建通过 + 至少两项掌握证据。今天不在本笔记中直接改 DEBT 状态。

AI 辅助范围：

- W4 鉴权核心：AI 只做 L1/L2 讲解、出题、验收、review，没有直接代写核心实现。
- OAuth2：流程级讲解与纠偏，不实现第三方登录代码。
- 展示前端与 demo 讲稿：白名单展示资产，由 AI 维护。

---

## 9. 下一步

1. 继续主线，进入 W5：事件循环最小观测脚本。
2. Week3 回看后续只保留必要问题，不把复盘扩展成无限打磨。
3. W6 再统一处理：响应信封、CI `MONGODB_URI`、集成测试策略、全栈 demo 收口。
