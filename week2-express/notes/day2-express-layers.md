# Day 2 · 分层架构 · route / controller / service / repository

> 今天不是新 API，是**结构重构**。昨天 server.js 里路由、业务、数据揉在一起也能跑——分层要解决的是「长大之后」的问题：20 个端点、换数据库、写测试。先想清楚**为什么分层**，再动手，否则会拆成「目录变多但职责还是混的」假分层。本篇按「概念地基 → 一个端点穿四层 → 命名打磨 → Router 收口 → 多端点与参数 → 状态码语义」推进，对应真实项目里 RESTful API 的骨架。

---

## 1. 四层职责

| 层 | 职责 | 碰什么 | 不碰什么 |
|---|---|---|---|
| **route** | 请求入口：匹配 URL，把请求分发给对应 controller | 路由表 | 业务、数据 |
| **controller** | **翻译官**：读 `req` 拿参数 → 调 service 拿业务结果 → 包成 `res.json()` | `req` / `res` | 业务决策、数据库 |
| **service** | 纯业务逻辑：接收普通参数，执行业务，需要数据时调 repository | 普通数据 | `req` / `res`、数据库细节 |
| **repository** | 数据访问：只负责存取数据，把结果返回给 service | 数据库（今天是写死数组） | 业务、HTTP |

### 1.1 controller 是翻译官，不是收发室

最容易概括漏的一层。controller 不是「收 req、发 res」两头那么简单，**中间最重要的动作是调 service**：

```
读 req 拿参数  →  调 service 拿到业务结果  →  把结果包成 res.json()
（HTTP 世界）      （业务世界，普通参数）        （翻译回 HTTP 世界）
```

把它理解成「收发室」的危险：会忍不住在 controller 里写业务逻辑、查数据库，分层当场破坏。它的定位是**翻译**：HTTP 世界（req/res）↔ 业务世界（普通参数/数据）。它自己不做决策、不碰数据。

### 1.2 一把检验越界的尺子

> **只有 controller 碰 `req` / `res`。service 和 repository 里不应该出现这两个词。**

写完全局搜一下 `req` / `res`，如果它们出现在 service 或 repository 里，就是越界了。这是检验分层有没有做对的最简单的尺子。

---

## 2. 为什么调用必须单向

调用方向只能 `route → controller → service → repository`，反过来不行（尤其 repository 不能反过来调 service）。

### 2.1 真正的理由：依赖方向

单向的根据是**依赖方向**：上层依赖下层（controller 需要 service、service 需要 repository），但**下层不应该知道上层的存在**。

repository 为什么不能调 service？它的全部职责是「我只管存取数据，不关心谁用我、用来干嘛」。一旦反过来调 service，等于数据访问层开始掺和业务逻辑：

- 两层职责糊在一起 → 换数据库时又得动业务代码，分层的好处当场报废
- 形成**循环依赖**（service 调 repository，repository 又调 service）→ 结构乱掉

### 2.2 纠偏：单向跟「洋葱模型」无关

> 容易搭错的因果：「因为 Express 是洋葱模型，所以必须单向」——**这两个不是一回事**。

| | 讲的是什么 | 方向 | 跟 Express 的关系 |
|---|---|---|---|
| **洋葱模型** | 中间件怎么串（Day 1 那条 logger → 路由 → catch-all → error handler） | 请求**横向**穿过一串中间件 | 是 Express 特性 |
| **分层单向** | 代码从 route 往下调到 repository | 处理时**纵向**逐层下调 | **软件架构原则**，换任何框架/语言都一样 |

一句话记牢：**单向不是因为 Express，是因为「下层不该认识上层」。**

---

## 3. 分层到底解决什么

| 收益 | 说明 |
|---|---|
| **可归类** | route 引入后 API 按 RESTful 归类，可读性、可维护性提高 |
| **解耦** | controller 只专注 req/res，不掺业务 |
| **换库只动一层** | service 是纯业务、不碰数据库细节 → 换数据库时 route/controller/service 几乎不动，只改 repository（**最值钱的回报**） |
| **可测试性** | service 是纯业务逻辑、不碰 req/res、不碰真库 → 喂普通参数就能**单独测**，不用起 HTTP 服务器、不用连数据库（Week 6 写测试时回到这点） |

---

## 4. 一个端点穿四层（`GET /users`）

### 4.1 目录组织：按资源分层

```
src/
├── app.js                 # 只负责装配：挂中间件 + 挂 router + listen
├── routes/users.js        # URL → controller
├── controller/users.js    # 碰 req/res，调 service
├── services/users.js      # 纯业务，调 repository
└── repositories/users.js  # 数据访问（今天写死数组）
```

### 4.2 写的顺序：从下往上 repository → service → controller → route

顺着依赖的**反方向**写。理由：repository 最底层、谁也不依赖（只依赖写死的数组），先落地它，上面三层才有东西可调。每往上一层，要依赖的下层都已就绪——不会出现「要调的 controller 还不存在，只能写一半空着」。

最后回 `app.js` 把 router 挂上去，主文件瘦身。

### 4.3 一个会撞到的困惑：service「薄得像没用」

今天 `GET /users` 没有业务逻辑，service 只是把 repository 的结果原样往上传，会觉得这层多余。

> **薄 ≠ 该删。** service 是「业务逻辑的预留位」。

今天没逻辑，但明天要加「只返回激活用户」「按权限过滤」「组合多个 repository 的数据」，这些都长在 service 里。现在留着空架子，是给未来的逻辑留位置。今天图省事让 controller 直接调 repository、跳过 service，以后加业务逻辑就得回头重构。

---

## 5. 命名打磨：让职责自解释

跑通之后，命名有几处会**误导对分层的理解**，趁结构还小纠掉。

### 5.1 按资源命名文件，按操作命名函数

按「用例」命名文件（`getUsersData.js`）会让分层崩掉：下周加 `POST /users`、`DELETE /users/:id`，难道每层再建 `createUsersData.js`、`deleteUsersData.js`？文件会爆炸，同一资源的逻辑散落一堆文件里。

> 惯例：**文件按资源（数据实体）命名**（每层一个 `users.js`），**函数按操作命名**（`findAll` / `create` / `remove` …）。

这样 `POST /users` `DELETE /users/:id` 都往各层的 `users.js` 里加函数，不新建文件。

### 5.2 函数名不能「说谎」

```js
// ❌ 名字叫 create，干的却是读取
export async function createUsersData(req, res) {
    const users = await getUsersData();
    res.json(users);   // 实际在「读取并返回」
}
```

`create` 是 POST 的语义，这个函数却在读列表——**名字和行为相反**。等真加了 `POST /users` 会撞名、会自己搞混。读列表就叫 `getAll` / `list` / `findAll`。

### 5.3 三层别用同一个函数名

route、service 都叫 `getUsersData`，读代码时一眼看不出「现在在哪层」。按各层职责区分：

- controller 体现「处理请求」：`listUsersController`
- service 体现「业务」：`listAllUsersService` / `getAll`
- repository 体现「数据访问」：`findAll`

### 5.4 async 链：今天多余，但留着

每层都 `async` / `await`，但今天 repository 是写死数组、**没有真异步**，严格说多余。**留着**——Day 3 连真库后 repository 里 `await db.find()` 是真异步，现在留着 async 链到时无缝衔接。这不是错，是提前为异步铺路。

---

## 6. `express.Router()` 收口

### 6.1 挂载点 + 子路径分离

Router 是「一组路由的集合」。两个关键点：

1. **用 `app.use` 挂，不是 `app.get`。** `app.get` 是挂单个处理函数的，用它挂 Router 是错配，还会把路径写死、废掉 Router 的灵活性。
2. **挂载点和子路径分离**：挂载点吃掉前缀，router 内部只写**相对路径**。

```js
// app.js —— 声明「凡是 /users 开头的，交给这个 router」
app.use('/users', listUsersRouter);
```

```js
// routes/users.js —— 内部只写相对路径，/users 已被挂载点吃掉
import express from 'express';
import { listUsersController } from '../controller/users.js';

const listUsersRouter = express.Router();

listUsersRouter.get('/', async (req, res) => {        // → GET /users
    await listUsersController(req, res);
});

listUsersRouter.get('/:id', async (req, res) => {     // → GET /users/:id
    await listUsersController(req, res);
});

export { listUsersRouter };
```

### 6.2 踩过的坑

- **路径写重复**：在 router 里写 `'/users/:id'` 再用 `app.use('/users', ...)` 挂 → 实际路径变成 `/users/users/:id`，`/users` 匹配不上、报 404。router 里只写 `'/'` 和 `'/:id'`。
- **漏注册列表路由**：只写了 `'/:id'`，没写 `'/'` → 请求 `/users` 本身没有路由能匹配，连 controller 都进不去，直接 404。`'/'` 和 `'/:id'` 两条都要有。

---

## 7. 多端点与路径参数

### 7.1 参数怎么逐层往下传

| 层 | 做什么 |
|---|---|
| route | 路径写 `'/:id'` |
| controller | 从 `req.params` 拿 `id`（`req.params` 是 Express 解析路径参数的地方） |
| service | 接收 `id`，传给 repository |
| repository | 在数据里按 `id` 找一个 |

### 7.2 形状区分：列表返数组，单个返对象

把「查全部」和「查单个」塞进**同一个函数**（`findAllUsers(id)`，id 空查全部、有值查单个）是坏味道——两件事**语义不同、返回形状不同、找不到的处理也不同**。拆成两个：

```js
// repositories/users.js
const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
];

export async function findAll() {
    return users;                 // 列表 → 数组
}

export async function findById(id) {
    return users.find(u => u.id === parseInt(id));   // 单个 → 对象或 undefined（不裹数组）
}
```

> 单个查找返回 `[user]` 是错的——数组是「列表」的形状。「查一个用户」就该返回**一个对象或 null/undefined**。

### 7.3 service 也拆，消掉重复的 if/else

如果 controller 有一个 `if (!id)` 分支、service 里**又有一个** `if (!id)`，**同一判断写了两遍**——这是职责重叠的信号。controller 已经知道「有没有 id」（从 `req.params` 读的），就该**直接调对应的 service 方法**，而不是把 id 传给一个「万能 service」让它再判断一次。

```js
// services/users.js —— 一个方法一件事，不再靠可选参数 id=null 分流
import { findAll, findById } from '../repositories/users.js';

export async function listAllUsersService() {
    return await findAll();
}

export async function listUserByIdService(id) {
    return await findById(id);
}
```

「用一个可选参数 `id=null` 让函数干两件事」是常见的味道：函数有了两种模式，调用者得知道「传 null 会怎样」。拆成两个意图明确的函数，读代码的人一眼就懂，也和 repository 的 `findAll` / `findById` 对齐。

---

## 8. 状态码语义：404 与 400 落在哪一层

### 8.1 「找不到」该在哪一层变成 404

访问不存在的资源（`/users/3`）该返回 **404 Not Found**，而不是 `200 + 空数组`——空数组的意思是「查询成功，结果为空」，跟「这个资源不存在」是两回事，客户端拿到 200 会以为成功了。

落层规则：

- **repository** 返回 `undefined`（它只管「找没找到」，**不懂 HTTP**）
- **controller** 拿到 falsy → 翻译成 404（404 是 HTTP 概念，**只有 controller 碰 HTTP**）

> 判断「有没有」在底层；「返回 404」必须在 controller。service 和 repository 里都不该出现 `404` 这个数字、不该碰 `res`。这是「谁懂 HTTP」那把尺子的直接应用。

### 8.2 400 vs 404：是请求错，还是东西不在

| 请求 | 含义 | 状态码 |
|---|---|---|
| `/users/abc` | id 根本不是数字 → **请求格式就错了** | **400 Bad Request** |
| `/users/3` | id 合法，但查无此人 → **请求没错，资源不存在** | **404 Not Found** |

参数校验属于「HTTP 入口的把关」，放在 **controller**，在碰 service/repository 之前就拦掉非法输入，底层拿到的都是干净的。

```js
// controller/users.js
import { listAllUsersService, listUserByIdService } from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (id && isNaN(parseInt(id))) {
        return res.status(400).json({ error: `Invalid id: ${id}` });   // 不是数字 → 400
    }
    if (!id) {
        const users = await listAllUsersService();
        return res.json(users);                                        // 列表
    } else {
        const user = await listUserByIdService(id);
        if (!user) {
            return res.status(404).json({ error: `User with id ${id} not found` });  // 查无此人 → 404
        }
        return res.json(user);                                         // 单个
    }
}
```

### 8.3 坑：`if (id && isNaN(...))` 里的 `id &&` 不能删

`isNaN(parseInt(undefined))` = `isNaN(NaN)` = `true`。如果删掉 `id &&`，访问 `/users`（无 id）时 `id` 是 `undefined`，会被**误判成 400**。`id &&` 挡住了「没 id」的情况，是必要的。

> 旁注：`/users/abc` 不加校验时也「碰巧」对——`parseInt('abc')` 是 `NaN`，`NaN === 任何数` 都 false → `findById` 返回 `undefined` → controller 回 404。但那是「撞对的」，不是「设计对的」，所以显式用 400 区分开。

---

## 9. 完整调用链条

```
GET /users         → router '/'    → controller（无 id）→ listAllUsersService → findAll  → 数组
GET /users/1       → router '/:id' → controller（有 id）→ listUserByIdService → findById → 对象
GET /users/3       → router '/:id' → controller 拿到 undefined → 404
GET /users/abc     → router '/:id' → controller 校验失败 → 400
```

依赖方向（纵向，单向）：

```
app.js（装配）
  └─ routes/users.js（URL → controller）
       └─ controller/users.js（碰 req/res，校验，调 service）
            └─ services/users.js（纯业务）
                 └─ repositories/users.js（数据访问）
```

---

## 10. Day 2 核心收口

| 知识点 | 一句话 |
|---|---|
| 四层职责 | route 分发 / controller 翻译 / service 业务 / repository 数据 |
| controller 定位 | 翻译官（HTTP ↔ 业务），不是收发室；中间动作是调 service |
| 越界尺子 | `req` / `res` 只能出现在 controller |
| 单向调用 | 因为「下层不该认识上层」（依赖方向），跟洋葱模型无关 |
| 分层回报 | 换库只动 repository；service 纯业务 → 可单独测 |
| service 薄 | 薄 ≠ 该删，它是业务逻辑的预留位 |
| 命名 | 文件按资源、函数按操作；名字不能说谎；三层别重名 |
| Router 收口 | `app.use('/users', router)` + 内部相对路径 `'/'` `'/:id'` |
| 形状区分 | `findAll` 返数组、`findById` 返对象或 undefined（不裹数组） |
| 一个函数一件事 | service 拆 `listAll` / `listById`，消掉重复 if/else 与 `id=null` 分流 |
| 404 落层 | repository 返 undefined，controller 翻译成 404 |
| 400 vs 404 | 请求格式错 = 400；资源不存在 = 404；校验落 controller |

---

## 11. 埋下的伏笔

- **真数据库** —— Day 3 把 repository 的写死数组换成 Mongoose 查询，上面三层几乎不用动（亲眼验证分层回报）
- **写操作** —— `POST / PUT / DELETE` 各层加函数（不新建文件），会用到请求体解析（`express.json()`）
- **请求校验** —— 今天的 `isNaN` 是雏形，后续用专门的校验中间件统一把关
- **可测试性** —— Week 6 单独测 service（纯业务、不起 HTTP、不连库）
