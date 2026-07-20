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

### 0.1 三种展示媒介怎么选

同一个知识点经常有三种呈现方式：前端 UI、代码、Postman。选哪个不是随意的，原则如下：

- **前端 UI**：用于呈现"结果"——观众要先看到一个真实存在的产品行为（注册成功提示、403 卡片、admin 报表出图），才能对接下来的原理讲解产生代入感。主线每一步都从 UI 现象开始。
- **代码**：用于回答"为什么/怎么做到的"——UI 现象出现之后，切到具体文件、具体行号，讲分层职责或设计决策。不要先讲代码再讲现象，观众会先问"这是给谁用的"。
- **Postman**：用于快速复现 UI 上操作繁琐或本身不会触发的边界/错误场景（重复邮箱 409、密码错误 vs 邮箱不存在的 401 对比、缺 token 的 401），或者需要逐字展示 response body 时。Postman 请求已经在 `week2-express/src/users.postman_collection.json` 里按文件夹分好（六、Auth 注册；七、Auth 登录），现场直接点选对应请求即可，不用临时敲。

默认节奏：**UI 出现象 → 代码讲原理 → 需要错误分支时切 Postman 复现 → 切回 UI 继续主线**。避免在主线中间长时间停留在 Postman，观众会跟丢"我们在验证什么"。

### 0.2 这次的目标：约十分钟的自信讲述

本周定位调整：近几周展示基本没有观众追问，所以这次**不为"应对追问"做准备**，而是把一条约十分钟的主线讲顺、讲稳。据此四条：

**1. 时间预算（约 10 分钟；OAuth2 是唯一需要主动控时的大块）**

```text
开场一句话              ~20s
Step 1 注册             ~1min
Step 2 登录 / JWT       ~1.5min   ← 自建认证的核心，值得多停
Step 3 member 403       ~1min
Step 4 面板 401/403     ~45s
Step 5 mongosh 提权     ~30s
Step 6 admin 200        ~1min
Step 7 OAuth2           ~2.5–3min ← 讲解型，最容易超时，见下方核心/可选分层
收尾一句话              ~20s
```

Step 7 若把 6 步 + 边界表 + 威胁点全讲透会到 5 分钟。**核心必讲**：6 步流程（重点讲第 4 步"client_secret 必须在后端"、第 6 步"和 Step 2 是同一套 JWT 签发"）＋ 一句"三种凭据不能混用"。边界表逐行念、威胁点四条反问属**时间够才讲**；紧了就一句带过："这些页面上都列了，重点是刚说的两条。"

**2. 所有"引导追问"都是自答式，不等观众回答**

讲稿里标的"引导追问"不是真抛给观众等人接——近几周没人接，空场等待正是卡壳的诱因。正确用法：自己问一句 → 停半拍 → 自己答，问句只为给答案做铺垫、制造节奏。心里预设"没人会答"，就不会因冷场而慌。

**3. 卡壳时的锚点：低头看当前 Step 的「观察点」框**

每个 Step 末尾的 `观察点` 框写的就是"这一步要让观众看到什么"。真的脑子空了，别硬想台词——看一眼当前步骤的观察点框，它会告诉你"我在证明什么、屏幕上该出现什么"，顺着那句往回接就能续上。演示前把每个观察点框读熟，它是本讲稿内置的防卡壳锚。

**4. 记熟开场白与收尾白（开口第一句和收尾最容易慌，背下来最稳）**

开场白：

> "这个 demo 大概十分钟，走通一条链路：注册一个新账号 → 这个账号因为权限不够被拦在报表外面 → 提权之后正常拿到数据；最后讲一下第三方登录 OAuth2 的流程。"

收尾白：

> "所以整条链路证明的是：身份用密码验证、用 JWT 携带，权限每次请求实时查数据库——401 和 403 分别卡在'你是谁'和'你能不能'这两道门上。这就是这周做的认证与鉴权。"

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

展示媒介：**前端 UI（主线）→ 代码讲分层 → Postman 补边界场景**

- **必落词**：`POST /auth/register` · controller / service / repository 分层 · `bcrypt.hash` · 默认 `role = member` · 注册不收 role
- **串场（收尾接 Step 2）**：「密码已经哈希存进库了——下一步就是拿明文密码来验证它。」

操作：

1. 打开前端。
2. 切到"注册"。
3. 输入姓名、邮箱、密码。
4. 提交后回到登录。

要讲清（先给出现象，再切代码逐层对应）：

- 注册请求进入 `POST /auth/register`。
- `controllers/auth.js` 的 `registerController`：只读 HTTP 输入（`name/email/password`），调用 service，组织响应，不掺业务逻辑。
- `services/authService.js` 的 `register`（第 12–42 行）：密码策略校验（长度 ≥ 15）、`bcrypt.hash(password, 12)`、只把 `name/email/passwordHash` 三个字段组进 `userData`，最后只返回 `name/email` 两个安全字段。
- repository 负责创建 Mongoose document 并 `.save()`。
- 新注册用户默认 `role = member`，注册接口**不接收**客户端传来的 role——因为 `register` 函数的入参解构就只取了 `{ name, email, password }`，`userData` 里根本没有 role 字段，不是运行时校验挡掉的，是源头没给它进来的机会。

引导追问（讲完代码后现场问一句，再自己接）：

> "如果我在注册请求体里手动加一个 `role: "admin"`，会发生什么？"

答案：会被静默忽略。这是比"校验拒绝"更强的防御——没有校验分支意味着没有绕过校验的攻击面。有余量可以现场用 Postman 验证。

展示 Postman（边界场景，UI 里操作繁琐或本身不触发，切到"六、Auth 注册"文件夹）：

- `4. Register - duplicate email`：复现 409，讲清邮箱唯一性冲突的语义。
- `5. Register - password too short`：复现 400，对应刚讲的密码策略校验。
- 如果想现场验证上面"role 会被忽略"的追问：复制任意一个 Register 请求，在 body 里加 `"role": "admin"`，发送后展示 201 响应的 `data` 里没有 role 字段，再用 mongosh `findOne` 确认数据库里也没有——比口头讲更有说服力。

观察点：

```text
注册成功提示：注册成功，请直接登录（新账号默认角色 member）。
Postman：duplicate email → 409；password too short → 400。
```

### Step 2：登录并拿到 token

展示媒介：**前端 UI（主线）→ 代码讲 JWT 签发 → Postman 对比 401 文案 → （可选）终端解码 token**

- **必落词**：`select("+passwordHash")` · `bcrypt.compare` · JWT payload 只放 `sub` · `expiresIn: '1h'` · 统一 401 · 反枚举
- **串场（埋伏笔 → Step 3）**：「注意 payload 里不放 role——这个设计等一下 403 那步会用到。」

操作：

1. 输入刚注册的邮箱和密码。
2. 点击登录。

要讲清（`services/authService.js` 第 45–77 行 `login`）：

- 登录阶段用长期凭据 email/password 换短期 access token。
- repository 层 `findByEmailWithPasswordHash` 通过 `select("+passwordHash")` 显式取回 hash——默认查询不带 hash，这里是唯一一处主动打开的口子，做完 `bcrypt.compare` 立刻用完即弃。
- JWT payload（第 63–65 行）只放 `sub`（用户 id 字符串），不放 role、email、name、passwordHash。
- `jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })`：密钥来自环境变量，1 小时过期。
- controller 返回 `accessToken` + 安全 user 摘要（`userId/name/email`，同样不含 role）。

引导追问：

> "为什么 payload 里不放 role？以后要判断权限的时候不是更方便吗？"

答案：如果 role 放进 token，服务器提权后（Step 5 的 mongosh 操作）旧 token 依然带着旧 role，直到过期前都无法反映最新权限；把 role 的判断放到每次请求实时查库（Step 3 会讲到 `requireRole`），才能保证"数据库当前状态"是唯一可信来源。这一点是 Step 2 和 Step 3 之间的关键呼应，讲的时候可以先埋个伏笔："这个设计决定我们等下在 403 那一步会用到"。

展示 Postman（对比着讲，比分开点开更有冲击力，切到"七、Auth 登录"文件夹）：

- `3. Login - 错误密码` 与 `4. Login - 不存在的邮箱`：两个请求依次发送，让观众看到状态码都是 401，返回文案都是同一句 `邮箱或密码错误`（对应 `errors/userErrors.js` 的 `InvalidCredentialsError`）。

  引导追问：

  > "密码错误"和"账号不存在"明明是两种完全不同的情况，为什么返回一模一样的信息？

  答案：这是反枚举（anti-enumeration）设计——如果两种情况文案不同，攻击者可以靠响应差异批量探测哪些邮箱已注册。统一文案是故意的，不是没写全。

  可以顺带提一句已知但暂不修复的安全债务：登录路径存在**计时枚举**风险（错误密码约 314ms 因为真的跑了一次 `bcrypt.compare`，不存在的邮箱约 2ms 因为提前 return），响应内容一致但耗时不同仍可被计时攻击区分。本周结论是记为安全遗留，优先方案是 dummy bcrypt compare + 限流，暂不实现。讲这一点是为了体现"讲清边界比假装没有问题更重要"，不是漏洞展示。

- （可选，讲台效果好但非必需）`2. Login - 正确凭据` 成功后，在终端跑一行代码把 `accessToken` 解码出来，直接给观众看 payload 里只有 `sub`：

  ```bash
  node -e "const t=process.argv[1]; console.log(JSON.parse(Buffer.from(t.split('.')[1],'base64url')))" "<把 Postman 里拿到的 accessToken 粘进来>"
  ```

  这一步比口头说"payload 只放 sub"更直观，是"眼见为实"的证据点。

观察点：

```text
页面进入 Dashboard，但 member 账号看不到报表数据。
Postman：错误密码 401 与不存在邮箱 401 文案完全一致。
（可选）终端解码：payload = { sub: "<userId>", iat, exp }，无 role/email/name。
```

### Step 3：member 访问 admin-only 报表得到 403

展示媒介：**前端 UI（主线）→ 代码讲中间件链 → Postman 复现（可选）**

- **必落词**：`validateToken → requireRole("admin")` · `req.auth.sub` · 现查数据库 `User.role` · 403 不是 401
- **串场（回指 Step 2 的伏笔）**：「还记得 token 里没放 role 吗——所以权限只能每次现查库，这就是刚才那个伏笔。」

操作：

1. 登录后观察看板区域。
2. member 账号应看到 403 说明卡。

要讲清（`middlewares/validateRoleMiddleware.js` 的 `requireRole`）：

- token 有效，说明身份已确认（`validateToken` 已经放行）。
- 报表接口接线为 `validateToken → requireRole("admin") → 参数校验 → controller`。
- `requireRole` 不读 token 里的任何权限字段，而是用 `req.auth.sub` 现查数据库中当前的 `User.role`——这正是 Step 2 埋下的伏笔：role 判断永远看数据库当前状态，不看 token 里的旧信息。
- 当前 role 是 member，不满足 admin-only 路由要求，所以是 403（不是 401——身份没问题，是权限不够）。

展示 Postman（可选，UI 已经能看到 403 卡片，这里主要是想让观众看到裸的 HTTP 状态码和 body，不想临时敲请求时用）：切到"五、聚合报表"文件夹的 `6. Monthly sales - member forbidden`，和前端 403 卡片对照着看，同一个语义对应同一个状态码。

观察点：

```text
403 权限不足
当前账号角色是 member，报表 API 要求 admin。
```

### Step 4：演示面板复现 401 / 403

展示媒介：**前端 UI（`AuthProbePanel` 本身就是为这一步做的，不需要切 Postman）**

- **必落词**：无 token → 401 · member token → 403 · `AuthenticationError` · 「身份 vs 权限」两道门
- **串场（回指 Step 3）**：「401 卡在'你是谁'，403 卡在'你能不能'——和刚才那张 403 报表卡片是同一条线。」

操作：

1. 在鉴权链路演示面板触发"不带 token"的请求。
2. 再触发"带当前 token"的请求。

要讲清（对照 `middlewares/validateTokenMiddleware.js`）：

- 无 token：`validateToken` 里 `authHeader` 为空，直接 `next(new AuthenticationError())`，返回 401——连"你是谁"都没法确认。
- member token：`validateToken` 通过（`jwt.verify` 成功、`sub` 存在），进入 `requireRole`，查库发现 role 不是 admin，返回 403。
- 401 和 403 的分界不是"有没有资源"，而是"身份是否已确认、授权规则是否放行"——这句话讲完可以直接回指 Step 3 的结论，强化两次听到同一个结论的记忆点。

如果面板现场故障，兜底方案：切到 Postman"五、聚合报表"文件夹的 `5. Monthly sales - missing token`，效果等价。

观察点：

```text
无 token → 401
带 member token → 403
```

### Step 5：用 mongosh 提权为 admin

展示媒介：**mongosh 终端（运维/种子动作，不是业务 API）**

- **必落词**：`updateOne` `$set` role · 运维动作非公开 API · 防客户端自我提权 · 角色来源 = 数据库当前状态
- **串场（→ Step 6）**：「role 已经改在库里了——重新登录，服务端这次就会按 admin 放行。」

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

展示媒介：**前端 UI（主线，admin 视角回到报表）**

- **必落词**：登录仍只签 `sub` · `requireRole` 查当前 role · 两个 admin-only 报表 API · W3 聚合 × W4 鉴权接通
- **串场（回指 Step 2 / 3，收束主线）**：「token 的签发逻辑一个字没改，变的只是库里的 role——这就是'权限查库'的价值。」

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

### Step 7：切到 OAuth2 流程页

展示媒介：**只用前端 `OAuth2 流程` tab（图 + 表），不展示代码，也不用 Postman**

- **必落词**：授权码流程 · `code`（一次性换票）· `access token`（访问第三方）· `client_secret`（只在后端）· 本系统 JWT · `state` · `redirect_uri`
- **串场（回指 Step 2）**：「第 6 步签发本系统 JWT，和 Step 2 的登录是同一套代码——身份来源变了，token 约定没变。」
- **控时**：核心必讲 = 7.1 类比 + 7.2 六步（重点第 4、6 步）+ 一句「三种凭据不能混用」；7.3 表 / 7.4 威胁点 = 时间够才讲。

这一步和前面六步性质不同，开场先对观众明说，不要让人以为接下来会看到真实跳转：

> "接下来这段是讲解型演示，不会真的跳到 GitHub / Google 登录。这是本周主动的范围取舍——周三门槛只要求讲清流程和威胁点，没有要求接入真实第三方登录，所以这周没有写第三方登录代码。"

这句话本身就是一个诚实边界的展示点，比含糊带过更能建立信任。如果有人现场问"能看下代码吗"/"能实际跳转试试吗"，直接照这个逻辑回答："这周止步于流程级掌握（对应 `week4-plan.md` 周三取舍门槛），没有实现，可以留到之后的迭代"——不要临场编代码或跳过问题。

操作：

1. 在 Dashboard 顶部切到 `OAuth2 流程` tab。
2. 按页面从上到下讲：授权码流程（6 步）→ 凭据边界表 → 威胁点列表。

#### 7.1 讲一个类比先定基调 · 【核心，一句也行】

讲 6 步之前先给一个生活类比，帮观众建立直觉，再回来对号入座：

> "把它想成机场值机：你在值机柜台（授权服务器）验证身份后，柜台给你一张登机牌存根条码（`code`）——这个条码本身不能登机，你要拿它去登机口换真正的登机牌（`access token`）才能登机（访问资源）。条码和登机牌是两个东西，职责不同、生命周期也不同。"

#### 7.2 逐步讲解 6 步流程 · 【核心必讲，重点第 4、6 步】（对照页面 `flow-list` 从上到下念，每步讲完停一下）

1. **注册 OAuth App**：开发者配置阶段，**部署前一次性完成**的动作，登记 `redirect_uri`，拿到 `client_id`（公开）和 `client_secret`（保密）。强调这一步和后面 5 步不在同一个时间线上——这一步只发生一次，后面 5 步每次用户登录都会走一遍。
2. **跳转授权页**：用户点击第三方登录，浏览器带着 `client_id`、`redirect_uri`、`state` **离开我们的域名**，跳到 GitHub/Google。这是用户能亲眼感知的信任转移点——地址栏变了，说明接下来是在对方的地盘上验证身份，不是我们代验证。`state` 在这一步生成并记下来，等 callback 回来时核对。
3. **callback 收 code**：第三方验证完用户身份后，把浏览器重定向回我们的 `redirect_uri`，URL 上带一个一次性的 `code`。强调 `code` 只是"证明用户刚刚在第三方那边验证过"，本身不能拿去访问任何资源——呼应 7.1 的类比，这就是登机牌存根。
4. **后端换 access token**：我们的后端拿 `code + client_secret` 向第三方换 `access token`。**这一步必须在后端做**，因为要用到 `client_secret`；如果放到浏览器 JS 里做，`client_secret` 就会暴露给任何打开开发者工具的人。这是本节最重要的一句话，讲慢一点。
5. **请求用户资料**：后端用换来的第三方 `access token` 去请求对方的资源服务器，拿到 `providerUserId` 等资料。强调这个 `access token` 的作用域仅限于"访问第三方的资源"，和"访问我们自己系统的权限"完全无关。
6. **签发本系统 JWT**：根据 `provider + providerUserId` 创建或绑定本地用户，再签发**我们自己的** JWT 给前端。讲到这里明确回指 Step 2：

   > "这一步签发 JWT 的逻辑，和刚才 Step 2 讲的登录签发是同一套代码路径——只是身份的来源从'邮箱密码验证通过'换成了'第三方验证通过'，token 的 payload 设计（只放 `sub`）、签名密钥、过期时间，这些约定完全不变。"

   这是整个 OAuth2 讲解里唯一一处把两条主线（自建认证 / OAuth2）实际接起来的地方，务必讲到，否则观众会觉得这是两套互不相关的知识。

#### 7.3 讲凭据边界表 · 【时间够才讲，紧了一句"页面上都列了"带过】（逐行念，强调"谁能碰到"）

| 内容 | 讲解重点 |
|---|---|
| `code` | 经浏览器传递，短期一次性，泄露了顶多被换一次 token，还要赶在过期前 |
| `access token` | 只存在于后端，绝不下发给前端，也不等价于本系统的登录凭据 |
| `client_secret` | 只在后端换 token 那一步用一次，**任何情况下不能进浏览器**——进了浏览器就等于公开了 |
| 本系统 JWT | 和前面三个都不是同一类东西，是我们自己签发的，权限判断仍然走 Step 3 讲的 `requireRole` 查库逻辑 |

引导句：讲完表格问一句"这四种凭据里，哪一种如果泄露，后果最严重？"——等观众答，正确答案是 `client_secret`（等于任何人都能冒充我们的应用后端），借此过渡到威胁点。

#### 7.4 讲威胁点 · 【时间够才讲，最少保留 `client_secret` 一条】（用"如果没有会怎样"的反问句式，逐条讲比逐条念更有效）

- "如果没有 `state` 会怎样？"→ 攻击者可以诱导受害者用攻击者自己申请的 `code` 完成登录，把受害者的账号和攻击者的第三方身份绑在一起（CSRF 式的 callback 注入）。`state` 就是用来确认这个 callback 确实对应"我们自己刚刚发起"的那次跳转。
- "如果 `redirect_uri` 不做白名单校验会怎样？"→ `code` 可能被送到攻击者控制的地址，直接被攻击者换成 access token。
- "如果 `client_secret` 泄露会怎样？"→ 回到 7.3 的答案，任何人都能冒充我们的应用后端换 token。
- 第三方 token 和本系统 JWT 分属两个权限域，**不能混用**——这句收尾，呼应整节课的主线：无论身份从哪来，本系统内部的权限判断永远只认自己签发的 JWT + 数据库里的 role。

观察点：

```text
OAuth2 流程 tab 展示 6 步授权码流程，且第 6 步与 Step 2 的 JWT 签发逻辑显式挂钩。
凭据边界表区分 code / access token / client_secret / 本系统 JWT，讲清"谁能碰到"。
威胁点用反问句式讲完 state / redirect_uri / client_secret / token 边界，观众能接住反问。
开场已声明本段为讲解型 demo，Q&A 环节对"能看代码吗"类问题有现成回应。
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
oauth2 flow tab:
```

## 6. 本 demo 证明什么

运行型 demo 证明：

```text
密码哈希与注册 ✅
登录凭据验证 ✅
JWT 签发 ✅
Bearer token 认证 ✅
admin-only 路由授权 ✅
401 / 403 / 200 三条路径 ✅
报表聚合接口接入真实权限边界 ✅
```

讲解型 demo 证明：

```text
OAuth2 授权码流程 ✅
开发者配置阶段与用户登录阶段的区别 ✅
code / access token / client_secret / 本系统 JWT 的边界 ✅
state 与 redirect_uri 的安全作用 ✅
第三方登录态与本系统登录态隔离 ✅
```

本 demo 不证明：

```text
OAuth2 第三方登录实现
资源归属授权
权限表 / 多角色权限系统
响应信封全量统一
生产级反枚举与限流策略
```
