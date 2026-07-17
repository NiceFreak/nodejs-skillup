# W4 D5 Demo 讲稿 · 注册登录到最小 RBAC

> 定位：这是 W4 D5 的演示操作清单与讲稿提示。前端展示后台由 AI 搭建维护；后端认证、鉴权与聚合逻辑由本人实现并负责讲清。

---

## 0. 使用策略

讲稿先写，再演示，再回填实测结果。

原因：

- 先写可以把演示范围固定住，避免现场临时加需求。
- 先写能明确每一步要证明什么：注册、登录、JWT、401、403、admin 200。
- 演示后再回填真实状态码、账号、命令结果，避免讲稿变成脱离事实的“理想流程”。

本讲稿不是背诵答案；每一步只给提示点，现场讲解仍以本人对链路的理解为准。

## 1. 演示前准备

### 1.1 后端

```bash
cd week2-express/src
node --env-file=.env server.js
```

要求：

- MongoDB 正常运行。
- `.env` 中有强度足够的 `JWT_SECRET`。
- 后端默认监听 `http://localhost:3000`。

### 1.2 前端

```bash
cd week8-fullstack/src/frontend
yarn install --immutable
yarn dev
```

前端地址：

```text
http://localhost:5173
```

说明：

- 前端请求 `/auth`、`/reports`，由 Vite proxy 转发到后端。
- 前端只是展示资产，不作为本周核心学习目标。

### 1.3 mongosh

```bash
mongosh -u root -p --authenticationDatabase admin
```

进入应用数据库后准备提权命令：

```javascript
db.users.updateOne(
  { email: "<演示账号邮箱>" },
  { $set: { role: "admin" } }
)
```

## 2. Demo 主线

```text
注册新账号
→ 登录，新账号默认为 member
→ member 请求 admin-only 报表，看到 403
→ 演示面板发起无 token 请求，看到 401
→ mongosh 提权为 admin
→ 重新登录
→ admin 请求报表，看到 200 与图表数据
```

## 3. 分步讲稿

### Step 1：注册新账号

操作：

1. 打开前端。
2. 切到“注册”。
3. 输入姓名、邮箱、密码。
4. 提交后回到登录。

要讲清：

- 注册请求进入 `POST /auth/register`。
- controller 只读 HTTP 输入并组织响应。
- service 负责密码策略、`bcrypt.hash` 和安全返回字段。
- repository 负责创建 Mongoose document 并 `.save()`。
- 新注册用户默认 `role = member`，注册接口不接收客户端传来的 role。

观察点：

```text
注册成功提示：注册成功，请直接登录（新账号默认角色 member）。
```

### Step 2：登录并拿到 token

操作：

1. 输入刚注册的邮箱和密码。
2. 点击登录。

要讲清：

- 登录阶段用长期凭据 email/password 换短期 access token。
- service 通过 `select("+passwordHash")` 显式取回 hash 做 `bcrypt.compare`。
- JWT payload 只放 `sub`，不放 role、email、name、passwordHash。
- controller 返回 token + 安全 user 摘要。

观察点：

```text
页面进入 Dashboard，但 member 账号看不到报表数据。
```

### Step 3：member 访问 admin-only 报表得到 403

操作：

1. 登录后观察看板区域。
2. member 账号应看到 403 说明卡。

要讲清：

- token 有效，说明身份已确认。
- 报表接口接线为 `validateToken → requireRole("admin") → 参数校验 → controller`。
- `requireRole` 用 `req.auth.sub` 查数据库中的当前 `User.role`。
- 当前 role 是 member，不满足 admin-only 路由要求，所以是 403。

观察点：

```text
403 权限不足
当前账号角色是 member，报表 API 要求 admin。
```

### Step 4：演示面板复现 401 / 403

操作：

1. 在鉴权链路演示面板触发“不带 token”的请求。
2. 再触发“带当前 token”的请求。

要讲清：

- 无 token：`validateToken` 无法确认身份，返回 401。
- member token：`validateToken` 通过，`requireRole` 不通过，返回 403。
- 401 和 403 的分界不是“有没有资源”，而是“身份是否已确认、授权规则是否放行”。

观察点：

```text
无 token → 401
带 member token → 403
```

### Step 5：用 mongosh 提权为 admin

操作：

```javascript
db.users.updateOne(
  { email: "<演示账号邮箱>" },
  { $set: { role: "admin" } }
)
```

要讲清：

- 不开放注册时传 role，是为了防止客户端自我提权。
- 当前演示用 mongosh 做种子/运维动作，不是公开业务 API。
- 角色来源是数据库当前状态，因此重新登录后服务端会按 admin 放行。

观察点：

```text
matchedCount: 1
modifiedCount: 1
```

### Step 6：重新登录并访问报表得到 200

操作：

1. 前端登出。
2. 用同一账号重新登录。
3. 观察报表看板和演示面板。

要讲清：

- 登录仍只签发 `sub`，token 不携带 role。
- admin 判断发生在后续请求的 `requireRole`，查的是数据库当前 role。
- 报表数据来自两个 admin-only API：
  - `GET /reports/monthly-sales`
  - `GET /reports/customer-spending`
- 月度趋势证明 W3 聚合链路仍可用；admin-only 证明 W4 鉴权链路已接入真实业务接口。

观察点：

```text
看板出现 KPI、月度趋势、客户消费 Top 8。
演示面板带当前 token 请求 → 200。
```

## 4. 现场故障检查

### 前端打不开

检查：

```bash
cd week8-fullstack/src/frontend
yarn dev
```

默认地址是 `http://localhost:5173`。

### 登录报 500

优先检查：

```bash
cd week2-express/src
node --env-file=.env server.js
```

确认 `.env` 有 `JWT_SECRET`，且长度不少于 32。

### 报表一直 401

可能原因：

- 没登录。
- token 过期或 localStorage 脏了。
- 后端重启后 secret 变了。

处理：

```text
登出 → 重新登录
```

### 提权后仍是 403

可能原因：

- 没重新登录。
- 提权命令打到了错误数据库。
- email 写错。

检查：

```javascript
db.users.findOne(
  { email: "<演示账号邮箱>" },
  { email: 1, role: 1 }
)
```

## 5. 实测记录

演示账号：

```text
email:
password:
```

结果：

```text
register:
login as member:
member dashboard:
probe without token:
probe with member token:
mongosh update:
login as admin:
admin dashboard:
probe with admin token:
```

## 6. 本 demo 证明什么

```text
密码哈希与注册 ✅
登录凭据验证 ✅
JWT 签发 ✅
Bearer token 认证 ✅
admin-only 路由授权 ✅
401 / 403 / 200 三条路径 ✅
报表聚合接口接入真实权限边界 ✅
```

本 demo 不证明：

```text
OAuth2 第三方登录实现
资源归属授权
权限表 / 多角色权限系统
响应信封全量统一
生产级反枚举与限流策略
```
