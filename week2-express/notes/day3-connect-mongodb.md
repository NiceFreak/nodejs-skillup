# Day 3 · 接真库 · Mongoose 连接 + Read/Create + 错误分层

> Day 2 把四层骨架搭好了，但 repository 还是写死数组。今天把它换成真 Mongoose——**一路上会亲眼看到 Day 2 分层的回报兑现：换数据源只动 repository，service/route 一字不改。** 三条主线：①连库单独立住（基础设施层）②Read 接真库（撞 ObjectId）③Create（今天信息量最大，把 Week 1 的 Schema 校验和「错误翻译分层」全串起来）。核心原则贯穿始终：**数据库的实现细节（错误码、ObjectId）只能出现在离它最近的那层，越往上越是业务语言。**

---

## 1. 连接 MongoDB：基础设施单独立住

第一步只做一件事：**让 Mongoose 在 app 启动时连上 `shop` 库，并感知连接成功还是失败。** 不碰 repository、不碰 CRUD——先把「连上」单独跑通，把连库和改数据两个坑分开撞。

### 1.1 密码放哪：绝不硬编码

Compass 那串连接字符串带明文密码 `root:example`。第一个决定：**别把它写进 `.js` 源码**（会随 git 泄露）。

- 用 `.env` 放连接字符串：`MONGODB_URI=mongodb://root:example@localhost:27017/shop?authSource=admin`
- `.env` 加进 `.gitignore`——**密码绝不进版本库**
- 代码里用 `process.env.MONGODB_URI` 读

加载 `.env` 的方式两选一：Node 20.6+ 原生 `node --env-file=.env`，或用 `dotenv` 包。查了 Node 版本确认支持，**选原生 `--env-file`，省一个依赖**。

```json
// package.json
"scripts": {
  "start": "node --env-file=.env app.js",
  "dev":   "node --env-file=.env --watch app.js"
}
```

> 加载 `.env` 的时机要在连接之前完成——`db.js` 里读 `process.env.MONGODB_URI` 的前提是 `.env` 已经被加载。用 `--env-file` 时 Node 在跑脚本前就注入了，顺序天然对。

### 1.2 连接代码放哪：`config/db.js`

**连接是基础设施，不属于任何一层业务，所以别塞进 route/controller/service/repository。** 它该有自己的位置。

在 `src/` 下建 `config/`，里面 `db.js` 专门负责连接，导出一个 `connectDB` 函数。这延续 Day 2「每个东西有明确归属」的思路，而且以后要加别的基础设施（比如环境变量校验），`config/` 正好收纳。

```
src/
├── config/
│   └── db.js          ← connectDB 在这
├── routes/
├── controller/
├── services/
├── repositories/
├── app.js             ← import 并调用 connectDB
└── .env               ← 连接字符串（不进 git）
```

### 1.3 连接本身：async + 错误感知

- **执行一次**：app 启动时连一次，不是每次请求都连。
- **是异步的**：`mongoose.connect` 返回 Promise，要 `await`。
- **感知成功/失败**：连失败（密码错、漏 authSource、Mongo 没跑）要**捕获并让上层知道**，而不是静默挂掉。

```js
// config/db.js
import mongoose from "mongoose";

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    try {
        await mongoose.connect(uri);
    } catch (err) {
        throw err;   // 交给启动逻辑决定要不要 exit
    }
}

export { connectDB };
```

> **谁负责 `process.exit`？** connectDB 只管「连不上就把错误抛出去」，是否退出进程由启动逻辑（app.js）决定。这样 connectDB 更纯、也更好复用（比如测试里想连库但不想它把进程杀了）。

### 1.4 故意制造失败：验证错误处理不是摆设

连通后，**故意删掉连接字符串里的 `?authSource=admin`**，重启观察：

```
MongoDB connection error: MongoServerError: Authentication failed.
  ...
  code: 18, codeName: 'AuthenticationFailed'
```

这一步同时验证了两件事：
1. **错误处理真的在工作**——认证失败（code 18）被 catch 到、打印、进程退出，没有静默 crash。✓
2. **`authSource=admin` 确实必需**——少了它，Mongo 不知道去 admin 库验证 root 账号，直接认证失败。以后连任何带认证的 Mongo 都会记得检查它。✓

验证完加回去。

### 1.5 踩过的坑：启动顺序反了

第一版把 `connectDB()` 放进了 `app.listen` 的回调里：

```js
// ❌ 顺序反了
app.listen(PORT, async () => {
  await connectDB();
  console.log(`Express server running...`);
});
```

问题：`app.listen` **先**执行，server 立刻开始监听端口收请求，**然后**回调里才去连库。这留下一个**时间窗口**——server 已在收请求，但库还没就绪。而这次认证失败时 `process.exit(1)` 直接杀进程，所以浏览器访问看到「localhost 拒绝连接」（进程没了）。

> **正确顺序：先连库，连成功了再起 server。** 库是 app 的命根子，库不通 server 起来也没法干活。

改法是把启动逻辑包成一个 async 函数，`await connectDB()` 过了才 `app.listen`：

```js
// app.js —— 先连库，成功后才 listen
async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Express server running at http://localhost:${PORT}/`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();
```

这样保证：**库不通，server 根本不会起；库通了，server 起来就是完全就绪的状态。** 验收的直接证据就是终端两句话的先后——正常时**先** `MongoDB connected`、**再** `Express server running`；连接串搞错时，第二句压根不出现。

> **顺带纠一个可读性问题**：第一版 connectDB 里 `await mongoose.connect(uri).then(...).catch(...)` 把 `await` 和 `.then/.catch` 两种异步写法叠着用。能跑但风格混乱，既然函数是 `async`，统一成 `try/catch + await`。

---

## 2. Read：把 repository 接到真库

进入 Day 2 分层回报兑现的时刻：**只动 repository，controller/service/route 几乎不用改，数据就从假数组变成真 Mongo。** 分两小步：先建 Model，再改 repository。

### 2.1 建 User 的 Schema / Model

Model 是「数据的形状定义 + 校验」，最贴近数据库，放 `src/models/users.js`。

> **Model ≠ repository**：Model 定义「数据长什么样 + 校验」，repository 定义「怎么增删改查」。别混。

```js
// models/users.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:  { type: String, required: true },
    email: { type: String, required: true, unique: true },
    age:   { type: Number, required: false },
    addresses: [{                        // 嵌入子文档（Week 1 嵌入建模的应用）
        recipient:     { type: String, required: true },
        phone:         { type: String, required: true },
        province:      { type: String, required: true },
        city:          { type: String, required: true },
        detailAddress: { type: String, required: true }
    }]
});

const User = mongoose.model("User", userSchema);
export default User;
```

两个关键决定：

| 决定 | 结论 | 连锁影响 |
|---|---|---|
| 用 Mongo 的 `_id` 还是自建数字 `id`？ | **用 Mongo 原生 `_id`**（ObjectId），别跟惯例对着干 | Day 2 的 `parseInt(id)` 逻辑作废——`_id` 是 24 位十六进制，不是数字，校验和查询都得跟着变 |
| 字段加约束吗？ | `name`/`email` 加 `required`、`email` 加 `unique`（用上 Week 1 的 Schema 校验） | `unique` 会连到 Week 1 撞过的 E11000（下一节 Create 会用到） |

### 2.2 改 repository：数组 → Model

```js
// repositories/users.js
import User from '../models/users.js';

export async function findAll() {
    const users = await User.find();     // 列表 → 数组
    return users;
}

export async function findById(id) {
    const user = await User.findById(id); // 查不到时返回 null
    return user;                          // 原样返回（含 null），让 controller 处理
}
```

### 2.3 踩过的坑

**坑 1：`findById` 别急着 `.toObject()`。**

第一版写成 `return user.toObject()`。但 `findById` 查不到时返回 `null`，`null.toObject()` 会抛 `TypeError`——controller 里精心写的 `if (!user) return 404` 分支永远轮不到，因为 repository 先崩了。

> **两个层面**：①直接修——`.toObject()` 只在 user 存在时调；②更该问的是「这层该不该做转换」。repository 只管取数据，取到什么返什么（文档或 null），转换别在这掺和。而且 `res.json(user)` 能直接序列化 Mongoose 文档，**`.toObject()` 本就多余**。结论：`return user`。

**坑 2：ObjectId 让 Day 2 的数字校验失效。**

Day 2 controller 用 `isNaN(parseInt(id))` 校验数字 id。换成 ObjectId 后：`/users/1` 里 `1` 不是合法 ObjectId，`User.findById('1')` 会**抛 CastError**（不是返回 null）。

解法是把校验换成 **ObjectId 格式预校验**（24 位十六进制），在进 repository 之前就挡掉非法 id，顺便**绕过** CastError：

```js
// controller/users.js
if (id && !/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ error: `Invalid user id format: ${id}` });
}
```

> controller 改动**不违背**「换库只动 repository」——它改是因为 **id 的类型真的变了**（数字 → ObjectId），校验本就该跟着数据变。这是合理的连锁，不是分层失效。

### 2.4 边界验收：400 vs 404 分得干干净净

| 请求 | 结果 | 说明 |
|---|---|---|
| `GET /users` | 200 + 数组 | 三条真实 Mongo 数据，带 `_id`、嵌套 addresses、`__v` |
| `GET /users/{合法_id}` | 200 + 对象 | 单个用户 |
| `GET /users/1` | **400** | 格式非法，格式校验挡住 |
| `GET /users/{合法但不存在的id}` | **404** | 格式对但资源不存在 |

> 最见功力的是最后一条：用了一个 Alice **address 子文档的 `_id`**——格式完全合法（24 位十六进制），但它不是任何 User 的 `_id`。格式校验放行 → `findById` 查不到 → 返回 null → controller 回 404。**「格式对但资源不存在 → 404」和「格式就错 → 400」区分得干干净净。**

**分层回报兑现**：这一路从假数组换到真 Mongo，改了 Model（新增）、repository（换 `User.find`/`findById`）、controller（校验换成 ObjectId 格式）。而 **service 和 route 两层一个字都没动**。这正是 Day 2 论证过的「换数据库只动 repository」——今天不是听说，是亲眼看到。

---

## 3. Create：今天信息量最大的端点

`POST /users` 带来一串「第一次」：第一次处理 `req.body`、第一次让 Schema 校验在 API 层上场、第一次撞 E11000、第一次用 201 Created。它把 Week 1 的 Schema 校验全串起来了。

### 3.1 让 Express 读懂 JSON 请求体

GET 的数据在 URL（`req.params`），POST 的数据在**请求体**里，通常是 JSON。但 **Express 默认不解析请求体**——不配东西，`req.body` 是 `undefined`。

```js
// app.js —— 挂在路由之前
app.use(express.json());
```

> **位置很关键**：得在路由之前挂（回想洋葱模型——请求要先被解析，后面的 controller 才拿得到 `req.body`）。
> **为什么不默认开启？** 不是所有请求都是 JSON（有表单、有文件流），Express 让你按需选解析器——呼应 Day 1「Express 是薄封装、按需组装」。

### 3.2 四层各加一个 create 函数

一条链穿下来，每层加对应函数（route 用 `.post`）：

```js
// routes/users.js —— 直接挂 controller，不包 async arrow
createUserRouter.post('/', createUserController);
```

```js
// controller/users.js —— 只负责 HTTP 输入输出
export async function createUserController(req, res) {
    const { name, email, age, addresses } = req.body;
    const newUser = await createUserService({ name, email, age, addresses });
    return res.status(201).json(newUser);   // 创建成功用 201，返回新用户（带 _id）
}
```

```js
// services/users.js —— 今天纯透传（业务逻辑的预留位）
export async function createUserService(userData) {
    return await createUser(userData);
}
```

```js
// repositories/users.js —— 创建 + 错误翻译（见 3.4）
export async function createUser(userData) {
    try {
        const newUser = new User(userData);
        await newUser.save();
        return newUser;
    } catch (error) { /* 翻译错误，见下 */ }
}
```

> **路由不用包 async arrow**：controller 本身已处理 `req/res`，`createUserRouter.post('/', createUserController)` 就够。而且本项目用 **Express 5**——async handler 里 throw/reject 的错误会**自动进入 error 中间件**，不用每个 controller 各写一遍 try/catch。这是本周的核心概念之一。

### 3.3 状态码：201 Created

创建成功用 **201**（不是 200），并返回新创建的用户（带 Mongo 生成的 `_id`），让客户端知道创建结果。

### 3.4 核心：错误翻译发生在离它最近的那层

Create 有两个必然撞的错误，它们都是「数据库的内部细节」，不能让它裸奔到上层：

| 错误 | 来源 | 该返回的状态码 | 不处理会怎样 |
|---|---|---|---|
| Schema 校验失败（缺 required 字段） | Mongoose `ValidationError` | **400**（客户端的错） | 掉进默认 500 |
| email 重复（Week 1 的老朋友） | Mongo `E11000`（`err.code === 11000`） | **409 Conflict** | 掉进默认 500 |

**做法：在 repository（离 Mongo 最近处）把它们翻译成领域错误，上层只认业务概念。**

```js
// errors/userErrors.js —— 自定义领域错误
export class EmailConflictError extends Error {
    constructor(message) { super(message); this.name = "EmailConflictError"; }
}
export class UserValidationError extends Error {
    constructor(message) { super(message); this.name = "UserValidationError"; }
}
```

```js
// repositories/users.js —— 11000 只出现在这里
export async function createUser(userData) {
    try {
        const newUser = new User(userData);
        await newUser.save();
        return newUser;
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new UserValidationError(`User Validation Error: ${error.message}`);
        } else if (error.code === 11000) {
            const email = error.keyValue.email;
            throw new EmailConflictError(`User with email ${email} already exists`);
        }
        throw error;   // 未知错误原样抛
    }
}
```

```js
// app.js —— error 中间件统一映射成 HTTP 响应
app.use((err, req, res, next) => {
  if (err instanceof UserValidationError) {
    err.statusCode = 400;
  } else if (err instanceof EmailConflictError) {
    err.statusCode = 409;
  }
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({ error: message });
  console.error('Error: ', `${statusCode}: ${message}`);
});
```

错误流向：

```
重复邮箱：  Mongo 11000        → repository 翻译成 EmailConflictError  → error 中间件 → 409
校验失败：  Mongoose ValidationError → repository 翻译成 UserValidationError → error 中间件 → 400
未知错误：  原样 throw          → error 中间件 → 500
```

> **这是 Day 3 最值钱的一课**：`11000` 这个 Mongo 专属错误码**只出现在 repository**。往上走，service/controller/app.js 谁都不认识 `11000`，只认识 `EmailConflictError`、`UserValidationError` 这些**业务概念**。这跟 Day 2「数据访问细节别泄漏到上层」是同一条原则，只是这次泄漏的候选物是「数据库错误码」——你把它挡在了 repository。

### 3.5 两个设计取舍（review 后落定的决定）

**（a）自定义错误改名 `ValidationError` → `UserValidationError`。**
最初自定义类和 Mongoose 内置的 `ValidationError` 同名，而 repository 里正是靠 `error.name === 'ValidationError'` 判断 Mongoose 的错、再抛出自己的——两个同名类在同一段逻辑里一进一出，读日志或用 `instanceof` 时会分不清。改名消歧义，成本低收益清楚。**已改。**

**（b）app.js 用 `instanceof` 而非 `err.name` 判断类型。**
`err.name === 'EmailConflictError'`（字符串/鸭子类型）脆弱：拼错不报错（静默走到 500）、重构改类名时字符串不跟着变。`instanceof EmailConflictError` 是真类型判断，需要 app.js import 那些错误类，换来更可靠的判断。**已升级为 `instanceof`。**

**（c）controller 手动校验删除，Model 做单一校验源。**
最初 controller 有一道 `if (!name || !email) return 400`。但 Model 里 `name`/`email` 已是 `required`，`User.save()` 会抛 ValidationError、最终也返回 400——**校验规则写了两处**，Model 加字段时 controller 不会自动跟着变，容易不一致。权衡后**删掉 controller 这道**，让 Model 当唯一校验源（ValidationError 已能正确翻译成 400）。

> **（d）service 纯透传保留。** service 现在只转发给 repository，看着多余，但它是**业务逻辑的预留位**（密码哈希、发欢迎邮件、编排多 repository）。Day 2 已想通这点，保留。

---

## 4. 手动测试：怎么发 POST 请求

浏览器地址栏只能发 GET，POST（带请求体、设方法）发不了，需要工具。项目里建了 `users.http`（VS Code REST Client 插件），把五个 CRUD 端点都写进去，既是手动测试集，也是 demo 现场演示 CRUD 的现成脚本（不含密码，值得进 git）。

curl 版本（帮你看清请求的每个部件）：

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com"}'
```

| 部件 | 对应代码里的什么 |
|---|---|
| `-X POST` | route 的 `.post` |
| `-H "Content-Type: application/json"` | `express.json()` 看到这个头才解析 body——不带它 `req.body` 可能是空 |
| `-d '{...}'` | controller 读的 `req.body` |

**验证 Create 的完整节奏**：
1. POST 一个全新合法用户 → 期望 **201** + 新用户（带 `_id`）。
2. 去 **Compass 刷新**确认数据真落库了（眼见为实，不只是接口返回好看）。
3. POST 重复 email → 期望 **409**；POST 缺 email → 期望 **400**。把错误链路实测一遍。

> 教训：**写完接口尽早用工具打一发**，别攒到最后——盲写的错误处理直到用工具发请求才第一次被真正验证，否则对不对全靠脑补。

---

## 5. 复盘：review 发现并修掉的点（重建时的自查清单）

Day 3 收尾对源码做了几轮 review，下面这些**不是会崩的 bug**，但都是「重建一遍时容易再犯」的点。均已修正，连同「改法/结论」一起记成自查清单。

### 5.1 robustness

**（a）`req.body` 缺失时该是 400，不是 500。**
`createUserController` 直接 `const { name, email } = req.body`。若客户端 POST **不带 `Content-Type: application/json`**，`express.json()` 不解析，`req.body` 可能不是对象，解构抛 `TypeError` → Express 5 冒泡 → error 中间件 → **500**。但「请求格式不对」语义上是 **400**。
→ **改法**：进 service 前在 controller 先挡 `if (!req.body) return 400`（HTTP 入口把关，符合 Day 2 落层规则）。这正是第 4 节 curl「故意不带 header 试一次」会暴露的现象。

> **和 3.5(c)「删掉 controller 手动校验」不矛盾**——两道校验性质不同：3.5(c) 删的是**业务校验**（name/email 的值对不对，交 Model 单一负责）；这里留的是**格式校验**（body 本身是不是有效对象，坏在 HTTP 层、Model 还没轮到）。判据：空对象 `{}` 是合法请求，应放行给 Model 报 400，所以只挡 `undefined/null`。

**（b）`config/db.js` 的 try/catch 别空转，且包装错误要保留原因。**
最初写成 `catch (err) { throw err }`——捕获后原样抛出，和不写 try/catch 完全等价，纯噪音。改成抛领域错误 `DatabaseConnectionError` 后，又踩了第二个坑：**只给一句笼统 message，把原始 `err` 丢了**，连库失败的真正原因（认证失败 / URI 错 / Mongo 没起）全看不到，直接削弱 1.4 节的排查价值。
→ **改法**：`throw new DatabaseConnectionError('...', { cause: err })`，错误类构造函数用 `constructor(message, options)` + `super(message, options)` 透传。这样类型是领域错误、但 `console.error(err)` 仍能顺 `cause` 链挖到底层原因。

**（c）`error.keyValue.email` 写死字段名。**
repository 翻译 E11000 时取 `error.keyValue.email`，等于假设「冲突的一定是 email」。将来别的字段加 `unique` 就报错。
→ **改法**：从 `error.keyValue` 动态取——`Object.entries(error.keyValue).map(([k,v]) => \`${k}: ${v}\`).join(', ')`。同时**消息模板里别再写死「email」这个词**（否则动态提取被抵消），改成 `User with ${...} already exists`，字段无关。

> 语法备注：`Object.entries(obj)`（ES2017）把对象转成 `[[键, 值], ...]` 数组；`([k, v]) => ...` 是把每个 `[键, 值]` 子数组解构成两个参数。

### 5.2 可选打磨（已顺手做掉）

**（d）两个 Router 挂在同一路径 → 合并成一个 `usersRouter`。**
同一资源拆成 `listUsersRouter` / `createUserRouter` 没必要。合成一个 `usersRouter` 同时挂 `.get('/')` / `.get('/:id')` / `.post('/')`，更内聚，符合 Day 2「每层一个 `users.js`、按资源组织」；Update/Delete 加进来收益更明显。

**（e）`service` 里 `return await` 的 `await` 多余。**
无 try/catch 包着时，`return await findAll()` 和 `return findAll()` 等价，已统一为 `return findAll()`。

### 5.3 两条通用经验（比单点修复更值钱）

**（1）`catch` 里只有 `throw`（原样抛）= 这个 try/catch 可以删。**
`try { ... } catch (e) { throw e }` 和不写完全等价。try/catch 只有在 catch 里**真做事**（记日志、翻译成领域错误、补上下文）时才有价值，否则就是噪音。这一坑在 db.js 删掉后、又在 service 里复制了一遍——所以把它记成模式:**看到「catch 里只有 throw」就该警觉。**

**（2）包装错误要保留 `cause`，别把底层信息吞掉。**
把底层错误翻译成领域错误（可读性、分层）是对的，但翻译时若只给一句笼统 message、丢掉原始 error，排查时就抓瞎。用 Error 的 `{ cause }` 机制：**对外是领域错误的类型和话术，对内仍能顺 `cause` 链挖到根因。** 两全，别二选一。
（注意：`super(message, options)` 时 Node 原生已从 `options.cause` 设好 `this.cause`，无需再手写 `this.cause = options?.cause`。已在 Node 22 实测确认。）

> 语法备注：`{ cause }` 是 Error 的第二参数，**ES2022 / Node 16.9+** 才支持（本项目 Node 22，稳）；`?.`（可选链，ES2020）表示「左边是 `null`/`undefined` 就短路返回 `undefined`、不报错」。

---

## 6. Day 3 核心收口

| 知识点 | 一句话 |
|---|---|
| 连接是基础设施 | 单独放 `config/db.js`，不属于任何业务层 |
| 密码管理 | `.env` + `process.env`，`.env` 进 `.gitignore`，密码绝不进 git |
| 加载 .env | Node 原生 `--env-file`（省依赖）vs `dotenv`，加载要在连接之前 |
| 启动顺序 | **先 `await connectDB()`，成功后才 `app.listen`**；库不通 server 不起 |
| connectDB 职责 | 只管连+抛错，是否 `exit` 交给启动逻辑决定 |
| Model ≠ repository | Model 定义数据形状+校验，repository 定义增删改查 |
| 用 `_id` | 用 Mongo 原生 ObjectId，别自建数字 id（连带 `parseInt` 校验作废） |
| repository 不做转换 | 取到什么返什么（文档或 null），别 `.toObject()`；转换不是它的事 |
| ObjectId 校验 | 用 24 位十六进制正则预校验挡非法 id，绕过 CastError |
| 400 vs 404 | 格式错 = 400；格式对但资源不存在 = 404 |
| `express.json()` | 挂在路由之前，否则 `req.body` 是 undefined |
| 201 Created | 创建成功用 201，返回新用户（带 _id） |
| **错误翻译分层** | 数据库错误码（11000）只在 repository 出现，上层只认领域错误 |
| Express 5 | async handler 的 throw/reject 自动进 error 中间件，省掉重复 try/catch |
| 领域错误命名 | 避开与 Mongoose 内置 `ValidationError` 同名，用 `UserValidationError` |
| 类型判断 | app.js 用 `instanceof` 而非 `err.name`（可靠 vs 脆弱） |
| 单一校验源 | 删 controller 手动校验，Model `required` 做唯一校验源 |
| service 薄 | 纯透传保留，是业务逻辑的预留位 |

---

## 7. 完整调用链条

```
GET  /users        → router '/'    → listUsersController（无 id）    → listAllUsersService  → findAll   → 数组
GET  /users/{id}   → router '/:id' → listUsersController（校验 id）  → listUserByIdService  → findById  → 对象 / null→404
GET  /users/1      → router '/:id' → controller 格式校验失败         → 400
POST /users        → router '/'    → createUserController（req.body）→ createUserService    → createUser→ 201
                                                                                              ├ ValidationError → 400
                                                                                              └ E11000          → 409
```

错误翻译方向（越往上越业务）：

```
Mongo/Mongoose 原始错误（11000 / ValidationError）
  └─ repository：翻译成领域错误（EmailConflictError / UserValidationError）
       └─ service / controller：只认领域错误，不认错误码
            └─ app.js error 中间件：领域错误 → HTTP 状态码（409 / 400 / 500）
```

---

## 8. 埋下的伏笔

- **Update / Delete** —— `PUT / PATCH / DELETE` 各层加函数（不新建文件），会复用今天的 ObjectId 校验和错误翻译
- **优雅关闭** —— `db.js` 里留了 TODO：监听 `SIGINT` / `SIGTERM`，先 `disconnectDB` 再 `process.exit`（今天不岔开主线）
- **校验中间件** —— 现在校验交给 Model，后续可用专门的校验中间件在入口统一把关
- **service 承载业务** —— 今天纯透传，将来密码哈希、多 repository 编排、业务错误翻译可上移到 service
- **可测试性** —— Week 6 单独测 service（纯业务、不起 HTTP、不连库），今天的分层为此铺路
</content>
</invoke>
