# Day 2 · 密码哈希 + 注册竖切（提前启动 Login 凭据验证）

> 今天完成 W4 主线第一段：定义注册契约、讲清密码哈希模型、设计历史用户兼容方案，并亲手实现 `POST /auth/register` 竖切；真实验证 201 / 400 / 409，数据库无明文密码，响应与普通查询都不泄露 hash。下午进度良好，提前启动了 D3 的 Login 凭据验证阶段：`POST /auth/login` 完成 bcrypt compare 与统一 401，真实验证通过。现有 2 个测试套件、6 个测试保持全绿。

---

## 1. 术语边界：Register / Login / Authorization

本周主题常被统称为 Auth，但三个行为必须分开：

```text
Register（身份 / 凭据登记）
→ 创建用户，把明文 password 经过 hash 后保存为 passwordHash

Login（身份认证）
→ 查找已有用户，用 compare 验证明文 password 与 passwordHash
→ 验证成功后才建立 session 或签发 token

Authorization / RBAC（授权 / 权限判断）
→ 用户身份已经确认后，判断他是否可以访问某个资源
```

D2 计划范围只有 Register，因此只调用 `hash`，不调用 `compare`。`compare` 属于 Login；今天下午提前进入了这一段（见第 7 节）。

---

## 2. 注册契约（最终版）

```text
路径：POST /auth/register
输入：{ name: string, email: string, password: string }，三项必填
成功：201 Created
成功响应：{ message: "created", data: { name, email } }
重复邮箱：409 Conflict，附具体原因
非法输入：400 Bad Request，附具体原因
数据库保存：_id、name、email（明文）、passwordHash（bcrypt 哈希值）
数据库禁止保存：明文 password
响应禁止出现：password、passwordHash
```

字段规则：

- `name`：非空、trim 后非空。
- `email`：必填 + 邮箱格式（mock 邮箱，主要验证 `@`，不做强校验）。
- `password`：非空、禁止纯空白、**最低 15 位**。

### 契约过程中的两次修正

1. **成功状态码：200 → 201。** 第一版契约写的是 200。回看已有代码后确认：创建成功语义是 `201 Created`，200 只表示请求成功，两者必须区分。
2. **「响应禁止出现」不是指状态码。** 它指响应体不允许携带的字段：明文密码、哈希密码以及一切用户不需要感知的内容。当前模型下返回 `name` 和 `email` 已经足够。

### 密码策略为什么是「15 位、不做组合规则」

- 当前 NIST 对无 MFA 的单因素密码建议最低 15 个字符，并明确**不建议**额外的大小写/数字/符号组合规则；同时建议拦截常见或已泄露密码。参考 [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)、[OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)。
- D2 只采用不增加实现复杂度的部分：最低 15 字符、不强制组合、不允许纯空白；`123456` 被长度规则天然排除。
- 常见密码 blocklist、限流放到 D4 Web 安全阶段。
- 这样做也避免了先允许弱密码、之后又推翻契约。

首版契约中「密码需包含大小写、数字、符号」的想法被上述标准否定；手机号字段对本周学习目标没有帮助，最终未引入。

---

## 3. 密码模型：为什么这么存

- **为什么不能存明文密码？** 泄露风险、撞库风险、内部窃取，且降低用户信任度。
- **为什么不用可逆加密？** 只要可逆，密钥泄露或内部人员就能还原全部密码。
- **salt 解决什么问题？** 增加扰动：相同密码加随机盐会产生不同的 hash，防止彩虹表和批量撞库。第一版回答「彻底的密码混淆」不准确——混淆是 hash 本身做的事，salt 解决的是「相同输入产生相同输出」这个可被利用的规律。
- **salt 需要保密吗？** 不需要。bcrypt 把 salt 直接编码在 hash 字符串里，`compare` 从中读取 salt、用同样参数重算后比较。
- **登录为什么用 `compare`，而不是重新 hash 后比较字符串？** 因为每次 hash 的随机盐不同，直接重新 hash 得到的字符串永远对不上；必须先从存量 hash 中取出 salt 再计算。第一版回答「保证一致性」方向对但没说到机制。

### 明文密码的流转路径

```text
POST 请求体携带明文
→ body parser
→ 校验中间件（只做格式校验）
→ Controller 读取 req.body
→ Service 调用 bcrypt 处理 hash + salt
→ Repository 保存 passwordHash 入库
```

明文 password 只存在于请求和 Service 内存中，绝不进入持久化模型。

### 职责归位（第一版答错的地方）

| 问题 | 第一版回答 | 修正后 |
|---|---|---|
| 谁调用 hash？ | Controller | **Service**（密码哈希是业务规则，不是 HTTP 关注点） |
| 谁读取 req.body？ | — | Controller |
| 谁保存 passwordHash？ | Repository | Repository |
| 谁决定返回哪些安全字段？ | — | Controller |

---

## 4. 分层设计与历史用户兼容

真实兼容问题：现有 2000 个 seed 用户没有密码，`POST /users` 也不接收密码。设计决策：

1. **`passwordHash` 在 Schema 中暂时 optional。** 必须在 Schema 中定义（否则无法保存），但不 required，兼容 seed 用户和普通 `POST /users`。不定义明文 `password` 字段。
2. **`select: false` 让普通查询默认查不到 `passwordHash`。** 这是 Mongoose 查询的默认投影。
3. **密码规则放在 auth service。** HTTP 校验中间件只做基本格式校验，具体业务策略（最低长度等）属于 service。
4. **复用现有 `repository.createUser`。** Repository 已经能保存任意 `userData`，并把 Mongoose ValidationError 和 E11000 翻译成业务错误（400 / 409），不需要因为功能名变成 auth 就复制一套数据库逻辑。

### 文件变化

新增：

1. `routes/auth.js` —— 注册路由，命名与现有 `routes/users.js`、`routes/reports.js` 一致。
2. `controllers/auth.js` —— 读取注册请求数据并返回安全响应。
3. `services/authService.js` —— 注册业务规则和密码哈希。
4. `middlewares/validateRegisterBodyMiddleware.js` —— 注册请求的 HTTP 输入校验。

修改：

1. `models/users.js` —— 新增 optional 的 `passwordHash` 并设 `select: false`。
2. `app.js` —— 挂载 auth router。
3. `package.json` / lockfile —— 安装 bcrypt。

不修改：`services/users.js`（普通 CRUD 不反向依赖 auth）、`repositories/users.js`（D2 复用 `createUser`，按邮箱查询留给 Login）。

复用：`validateHasRequestBodyMiddleware`、repository 的 `createUser`、现有领域错误和全局错误中间件。

顺带把 `controller/` 目录统一重命名为 `controllers/`，所有引用同步更新。

---

## 5. 注册竖切验证结果

2026-07-14 完成真实服务验证：

```text
无请求体：400
密码不足 15 位：400
首次注册：201
重复邮箱：409
现有测试：2 个测试套件、6 个测试通过
```

数据库检查确认：

- 新用户文档包含 bcrypt 格式的 `passwordHash`，没有明文 `password`。
- 注册响应只返回 `name/email`，不含 `password/passwordHash`。
- 应用 `GET /users` 查询时，`select: false` 默认排除了 `passwordHash`。
- 直接用 mongosh 查询集合**仍能看到** `passwordHash`：`select: false` 是 ODM 查询默认投影，不是数据库访问控制。

验证用的临时用户已删除，临时服务已关闭。

### 一个关键边界

> `select: false` 只影响之后的数据库**查询**。`new User(...).save()` 返回的当前文档对象仍然带有 `passwordHash`，所以注册响应必须由 Controller 主动构造安全字段，不能直接返回 Repository 的完整结果。

---

## 6. 提前启动 D3：Login 契约

进度提前，下午进入 Login 凭据验证阶段（JWT 仍留在 D3）。

```text
路径：POST /auth/login
输入：{ email, password }
成功：200，{ message: "Login successful", data: { userId, name, email } }
非法输入：400（请求体缺失、email 不过既有格式规则、password 为空或纯空白）
邮箱不存在：401 Invalid email or password
密码错误：401 Invalid email or password
历史无 passwordHash 用户：401 Invalid email or password
是否写数据库：不写，Login 是纯查询行为
```

关键设计判断：

1. **「邮箱不存在」和「密码错误」必须返回同一个 401 文案**，避免攻击者按响应差异枚举注册邮箱。
2. **历史无 hash 用户不静默补密码**：如果登录时悄悄把提交的密码写进无密码的老账号，任何人都能用任意密码「认领」这些账号，等于开放账号接管。统一按 401 处理。
3. **Login 不重复执行「最低 15 位」的注册强度策略**，只检查密码存在、类型正确、非空。否则密码策略将来升级时，旧密码正确的用户会无法登录。强度规则用于创建/修改密码，Login 只验证已有凭据。
4. **`compare` 返回 false 后由 Service 判定认证失败**，抛出业务错误 `InvalidCredentialsError`；Controller 只负责解析请求体、调用 service、返回响应。（第一版回答写的是 Controller，修正：认证成败是业务结论。）

### 各层数据流

```text
Repository：findUserByEmail + .select('+passwordHash') 显式取回 hash
            查到返回完整文档，查不到返回 null
Service：bcrypt.compare(明文密码, passwordHash)
         成功后只保留 _id / name / email 身份字段，passwordHash 不再向外传递
         失败抛 InvalidCredentialsError（统一 401）
Controller：解析请求体 → 调用 service → 返回响应
```

`select('+passwordHash')` 是现查的知识点：`select: false` 字段可以在单个查询中显式加回，但不能滥用——普通 GET 查询绝不允许用。

---

## 7. Login 凭据验证结果

2026-07-14 完成 Login 凭据验证与 HTTP 接线，真实服务结果：

```text
正确邮箱 + 正确密码：200
正确邮箱 + 错误密码：401 Invalid email or password
不存在邮箱：401 Invalid email or password
历史无 passwordHash 用户：401 Invalid email or password
无请求体：400
现有测试：2 个测试套件、6 个测试通过
```

成功响应只包含 `userId/name/email`；`passwordHash` 在 Service 完成 compare 后不再向 Controller 传递。Login 全程不写数据库。验证用的临时用户已删除，临时服务已关闭。

### 待 D4 验证：响应时间也可能泄露账号状态

本地观察：错误密码路径执行了 bcrypt，约 **314ms**；不存在用户直接失败，约 **2ms**。统一错误文案能阻止直接枚举，但攻击者仍可通过多次采样响应时间推断邮箱是否存在。当前阶段不扩展修复，D4 Web 安全时再评估 dummy hash、限流等方案。

---

## 8. 前端校验 vs 后端校验

自己提出的问题：这些校验前端也会做，后端重复做是性能考虑还是安全考虑？

结论：

- **前端校验**：主要改善用户体验（立即提示），顺带减少无效请求。
- **后端校验**：保证正确性和安全边界。
- 后端不能信任前端，因为请求可以绕过 React，直接用 Postman、curl 或脚本发送。**前端校验不是安全防线，后端校验才是最终权威。**

---

## 9. 今日暴露并修正的理解偏差

1. **创建成功用 201 不是 200**——已有代码里早已这么写，契约设计时却先写成 200，说明状态码语义还没有内化成设计直觉。
2. **salt 的作用答成「彻底的密码混淆」**——正确模型是「给相同密码引入随机性，破坏可预测映射」。
3. **compare 的机制答成「保证一致性」**——正确机制是从存量 hash 中读出 salt，用相同参数重算后比较；不能重新 hash 后比较字符串。
4. **hash 的调用层最初判断为 Controller**——密码哈希是业务规则，归 Service；Controller 只管 HTTP 输入输出。
5. **认证失败的判定层最初答成 Controller**——compare 结果的业务解释属于 Service。

这些点集中在「分层职责的稳定归位」上，与当前自评一致：数据库与分层衔接还不够顺，按既定策略只在具体链路遇到问题时补对应知识，不另开复习支线。

---

## 10. AI 辅助记录

- **辅助范围**：注册竖切的最小文件集合、命名、各层依赖方向，以及 D2 不引入 `compare/findByEmail` 的范围边界；Login 阶段的契约问题清单与 review。
- **援助级别与场景**：L2 骨架。本人先给出方案，AI 在 review 后整理并修正文件级结构；黑名单核心实现（hash 策略、compare 流程、统一 401 判断）全部由本人手写，AI 未提供任何可粘贴核心代码。
- **已记账**：注册竖切的文件职责与依赖方向，L2，见 `DEBT.md`（2026-07-14），本周验收前完成第一档 15–20 分钟注册调用链重建。
- **本人理解验证**：实现过程中复述了每层职责，并预测了加入登录时需要新增的数据库能力（按邮箱查询 + 显式取回 hash），后者在下午的 Login 实现中得到验证。
- **Postman 资产**：Auth 注册/登录文件夹、变量串联和基础 smoke 断言由 AI 维护，按最新规范属 API 展示资产白名单，不构成学习债务；自动化测试的场景与核心断言仍由本人完成。

---

## 11. 本日产出与复盘

**已完成：**

1. ✅ 注册契约、密码模型、历史用户兼容设计（含两轮 review 修正）。
2. ✅ `POST /auth/register` 竖切：route / controller / service / middleware 全部手写。
3. ✅ 真实验证注册 201 / 400 / 409；数据库无明文，响应与普通查询不泄露 hash。
4. ✅ `controller/` → `controllers/` 目录重命名，引用同步。
5. ✅ 提前完成 D3 的 Login 凭据验证：`findByEmailWithPasswordHash`、bcrypt compare、统一 401、历史无 hash 用户拒绝、HTTP 接线。
6. ✅ 真实验证 Login 200 / 401×3 / 400。
7. ✅ 现有 2 个测试套件、6 个测试保持通过。

**未完成 / 遗留：**

- ⬜ JWT 尚未开始（属 D3 主体）。
- ⬜ Login 计时枚举风险（314ms vs 2ms）留待 D4 评估。
- ⬜ 两条未还欠债：自然月报表边界；注册竖切文件职责。均需本周验收前第一档重建。

**复盘：**

D2 止步条件全部达成，且提前吃掉了 D3 最重的凭据验证部分，缓解了「D3 同时包含登录、JWT、鉴权中间件」的排期压力。契约先行的流程（先写契约 → review 修正 → 再动手）今天证明有效：两次状态码/字段级别的偏差都在写代码之前被拦住了。

---

## 12. 明日入口（D3 · JWT）

先定义再实现：

1. 明确 JWT 解决什么问题，以及它与 bcrypt compare 的边界。
2. 决定最小 payload、过期时间和 secret 来源，禁止放入敏感字段。
3. 登录成功后签发 token，更新最终响应契约。
4. 再单独设计 JWT 验证中间件和一个受保护接口，不与签发阶段混写。

D3 止步条件：登录成功/失败路径可演示；token 有明确 payload、密钥来源和过期时间；中间件只负责认证；**至少保护一个真实接口**。
