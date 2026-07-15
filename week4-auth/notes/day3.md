# Day 3 · JWT 签发契约

> D2 已完成 Login 凭据验证：邮箱与密码通过 `bcrypt.compare` 后，可以确认本次登录者的身份。D3 在此基础上加入 JWT：登录成功时签发短期身份凭证，后续再实现验证中间件和受保护接口。本篇先固定签发契约，不提前混入 RBAC。

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

---

## 4. 与旧响应的兼容性

旧 Login 成功响应为：

```json
{
  "message": "Login successful",
  "data": {
    "userId": "...",
    "name": "...",
    "email": "..."
  }
}
```

改用 v2 不会导致 Express 自身报错，只要 Controller 按新结构返回即可；但它会破坏依赖旧字段路径的客户端契约：

- `body.data.userId` 需要改为 `body.payload.user.userId`。
- Postman 登录成功断言需要改读 `body.payload.user`。
- Postman 需要从 `body.payload.accessToken` 保存 token，供后续 Bearer 请求使用。
- 其他尚未迁移的 API 会暂时保留旧响应，等 D4 再批量统一。

当前仓库没有正式前端消费 Login，已知调用方只有 Postman，因此迁移范围可控。实现 JWT 后同步更新 Postman，即可恢复展示与 smoke 验证；旧客户端如果不同步则会因读取不到 `data` 而失败。

---

## 5. 为什么后续请求不再重复提交密码

密码是长期主凭据，只用于 Login 时确认身份。每次受保护请求都重复提交密码，会增加长期凭据在网络、日志或错误处理路径中暴露的次数，也会让资源接口反复接触密码验证和存储层。

JWT 是有明确过期时间的短期 Bearer 凭证，用于后续高频身份识别。这样减少了密码暴露频率，也分开了长期凭据验证与短期请求认证的职责。

这不意味着 JWT 天然防窃取：安全仍依赖 HTTPS、较短有效期和正确的客户端存储策略。普通无状态 JWT 也不能直接吊销；denylist、token version 或查询数据库都能增强撤销能力，但会引入额外状态或查询成本，本阶段不实现。

---

## 6. 为什么今天不把 role 放进 token

当前用户模型尚未引入角色，D3 只解决身份认证，不提前实现权限控制。

角色写进 JWT 后会成为签发时的权限快照。如果数据库中的角色随后被降级，旧 token 仍携带原角色，并可能在过期前继续获得旧权限。缩短有效期、检查数据库当前角色、denylist 或 token version 可以缓解，但各有额外成本。因此今天的 token 只保留 `sub`，RBAC 留到 D4 单独设计。

---

## 7. 契约推导中答错的地方

这份契约经过多轮回答才稳定，主要修正了以下误区：

1. 曾把 JWT 说成「维持登录状态」甚至让 HTTP 从无状态变成有状态；修正为服务端逐次验证的无状态身份凭证。
2. 曾认为 token 能证明请求者始终是登录本人；修正为它只能证明 token 合法，无法识别 token 是否被盗。
3. 曾把 `userId/sub/email` 全放进 payload；修正为最小 payload 只保留标准声明 `sub`。
4. 曾把「secret 从哪里读取」答成「token 从请求头解析」；修正为 secret 来自 `process.env.JWT_SECRET`，Bearer token 的提取属于后续验证中间件。
5. 曾认为普通 JWT 可以被服务端直接吊销；修正为无状态 JWT 需要额外撤销机制，当前主要依赖过期时间。
6. 曾把 JWT 等同于授权；修正为 JWT 在本阶段只提供身份声明，资源权限由后续 RBAC 判断。
7. 最初凭印象选择 15 分钟；结合当前没有 refresh token 的约束，最终选择 1 小时。

---

## 8. 下一步

先只实现 Login 成功后的 JWT 签发和 v2 成功响应，不同时编写验证中间件。签发真实可验证后，再进入 Bearer token 的提取、验证和错误分支设计。
