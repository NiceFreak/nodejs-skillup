# Day 4 · CRUD 收尾 · Update / Delete + 测试清单实战 + 优雅关闭 / 校验中间件

> Day 3 把 Read/Create 接了真库、串起了错误翻译分层。今天分上下午两段：**上午**用一次闭卷复盘倒查出两个理解偏差（404 路径 vs 400/409 路径被混成了一条），再用一份手写测试清单把 POST /users 的"期望行为"和"当前实际行为"逐条对照、补齐 Update（PATCH）、Delete；**下午**补齐 Week 2 收尾的最后两项——优雅关闭、校验中间件重构，重构过程中第一次真正让 service 层装进了业务逻辑，也撞上并修好一个"新建错误类忘记注册"的坑。**Week 2 五个端点 + 收尾项，今天全部完成。**

---

## 1. 热身：闭卷复盘 `GET /users/{合法但不存在的id}` → 404

任务：关掉代码和笔记，凭记忆把这条链从头到尾讲一遍，覆盖五个点——route 匹配、controller 格式校验、service 透传、repository 调用了 Mongoose 哪个方法/返回什么、"查不到"在哪一层被翻译成 404。

**复盘结果：前三步（route → controller 格式校验 → service 透传）讲得清晰，没有问题。第 4、5 步暴露出两个理解偏差，而且是连锁的——第一个直接导致了第二个。**

### 1.1 偏差一：把"没找到"和"出错了"当成了同一种情况

| 我的原始表述 | 实际情况 |
|---|---|
| repository 用 `findOne` 查 | 应该是 **`findById`**——按 `_id` 查单条的专用方法（内部等价于 `findOne({_id: id})`，语义更明确） |
| 查不到时"返回的是一个可以 error" | 查不到时返回的是 **`null`**，不是 error，也不会抛错。"没找到"是数据库查询正常、合法的结果 |

**根因**：把"业务上没找到"（合法结果）和"程序出错了"（异常）当成了同一种情况，这个混淆直接连锁出了第二个偏差。

### 1.2 偏差二：以为 404 也走错误中间件

我原始的说法是"这个 error 能被错误中间件处理，因此在这里被翻译为 404"——**错的，而且是系统性的方向错误**。

真实情况：`findById` 返回 `null` → repository **原样返回**（Day 3 笔记里"repository 不做转换，取到什么返什么"这条原则）→ `null` 顺着**正常返回路径**一路到 controller → **controller 主动判断 `if (!user) return res.status(404)`**。全程没有 throw、没有 next(err)，是一次普通的函数返回，**完全没有经过错误中间件**。

### 1.3 核心结论：两条互斥的响应路径

这是今天最重要的一条修正，两条路径的**触发方式**完全不同：

| | 触发方式 | 谁在动作 | 例子 |
|---|---|---|---|
| **404 路径** | 业务查询合法地"没找到" → 返回 `null` → **controller 主动判断**，`res.status(404)` | controller | `GET /users/:id` 查不到 |
| **400/409/500 路径** | **repository 主动 `throw`** 领域错误 → 冒泡到错误中间件 → 中间件 `res.status(...)` | repository（抛）+ 错误中间件（接） | E11000 → 409，ValidationError → 400 |

> 这两条路径**互斥**：一次请求要么走 controller 判断后返回，要么走抛错冒泡到错误中间件，不会同时发生。写测试 case 时先判断这一条走哪条路径，直接决定该去哪个文件验证。

第一次复述时还多说错一句——"错误最后从 controller 抛出"，这也是不对的：**controller 完全没有拦截、也没有转发这个错误的动作，它只是错误冒泡路径经过的一层。** 唯一主动 `throw` 的只有 repository，之后全靠"没人 catch 就自动往外冒泡"这个 Express 5 特性一路冒到错误中间件。

```
repository 抛出领域错误(EmailConflictError / UserValidationError)
  → 顺着 async 链冒泡
  → controller 没有 catch 它（Express 5 自动捕获 async 函数里的 throw）
  → 跳过 controller、跳过所有普通中间件
  → 直接被 app.js 那个四参数错误中间件接住
  → 中间件里判断 instanceof、赋 statusCode、res.status().json()
```

### 1.4 澄清一个真实的困惑：网上的分层架构图为什么只画"response 从 controller 出去"？

**那幅图没有错，我的实现也没有错——图只画了"正常业务响应"这一条路径，没画错误路径。**

项目里实际有**两个"发响应"的出口**：

1. **正常路径出口：controller**——`res.status(201/404).json(...)`，我手写的判断逻辑，全部发生在 controller 文件里。service/repository 全程没碰过 `res`，这条原则从 Day 2 守到现在没破过。
2. **错误路径出口：错误中间件**（app.js 里那个四参数函数）——同样调用 `res.status(...).json(...)`，但这段代码**不在 controller 文件里**。

网上很多教程画的是**理想化的 happy-path**，默认没引入全局错误中间件、或者把错误处理简化掉了，所以图是**不完整**，不是错。一句话消掉矛盾：**"response 从『离用户最近、真正处理这次请求结果的那个函数』出去"——大多数时候是 controller，一旦发生了 controller 自己没 catch 的错误，这个角色就换成了错误中间件。**

---

## 2. POST /users：Constrained 层测试清单

目标：不假 AI 之手，自己手写测试 case（输入 / 期望状态码+理由 / 期望 body），并标注每条走哪条响应路径；不确定的标"待验证"，然后**实测**去证实或推翻，而不是靠记忆或感觉判断。

清单跑完一轮后，逐条对照代码，暴露出下面这些"期望 vs 实际"的 gap：

| # | Case | 我最初的判断 | 实测/对照代码后的结论 |
|---|---|---|---|
| 1 | 错误响应体字段名 | `{code, message}` | 记错了，实际是 `{ error: message }`（app.js 错误中间件），没有 `code` 字段 |
| 2 | 缺失必填字段的 body | `400 name is required` | 实际走的是 `UserValidationError`，message 是 Mongoose 原生 `ValidationError` 的完整信息（一大段，非手写简洁文案）——直接透传给客户端是否合适，记为待讨论的设计点 |
| 3 | addresses 子文档缺字段（如只传 `recipient`，缺 `phone/city/province/detailAddress`） | 以为"可以通过" | **实测证伪：400**。子文档里每个字段都有 `required: true`，触发校验和顶层字段是同一套机制，不是"数组没 required 就整体放行" |
| 4 | addresses 传空数组 `[]` | 应该拒绝 | 实测：**201，允许创建成功**。Mongoose 的 `required` 只管"字段存不存在"，不管数组长度，这不是 bug，是当前允许的行为 |
| 5 | addresses 完全不传 | 可以通过 | 实测：**201，且自动落库为 `[]`**（Mongoose 对数组类型字段的默认行为——不传也会初始化成空数组，不是 `undefined`） |
| 6 | email 格式错误（如缺 `@`） | 期望 400 | **当时实际是 201**——Model 没加格式校验，Mongoose 不会自动校验字符串格式，非法邮箱能直接存进去。**这是清单挖出的唯一真 gap** |
| 7 | schema 外字段（如塞一个 `vip: true`） | 以为会拒绝 | 实测：**201，字段被静默丢弃**。Mongoose 默认 `strict: true`——既不报错也不保留，第三种行为 |

### 2.1 两个需要业务判断、不是技术判断的点

**addresses 子文档 vs 数组整体**（呼应 case 3/4/5）：`required` 只管"这个字段存在还是不存在"，不管"数组里有几个元素、内容对不对"。数组本身的"最少几个元素"要靠自定义 `validate` 函数，不是内置 `required` 的职责。

**要不要拒绝空 addresses？**——决定：**不拒绝**。理由：新注册用户还没填收货地址是合理场景，空 `addresses` 应该合法，不该在数据层面堵死。

### 2.2 清单最终结论（阻断/非阻断判断）

| Case | 当前实际行为 | 期望行为 | 状态 |
|---|---|---|---|
| email 重复 | 409, `{error: "..."}` | 一致 | ✓ 已对 |
| 缺失必填字段 (name/email) | 400, `{error: "..."}` | 一致 | ✓ 已对 |
| addresses 子文档缺字段 | 400 | 400 | ✓ 已对（清单原判断错了，已用实测纠正） |
| addresses 空数组 | 201，允许 | 允许（已决定） | ✓ 已定案，不改代码 |
| addresses 完全不传 | 201，自动变 `[]` | 可接受 | 记录，非 bug |
| email 格式错误 | 201，不校验 | 400（格式非法应拒绝） | 🔴 明确 gap，今天补 |
| schema 外字段 (vip) | 201，静默丢弃 | 视情况 | 记录，Mongoose 默认行为，非 bug |
| 响应格式 `{error}` vs `{code,message}` | `{error}` | 想改成 `{code,message}` | 🟡 设计决定，改动面大（要连带改所有成功响应），留 TODO |

**真正的红色阻断项只有一个：email 格式校验缺失。** 其余都是"已确认符合预期"或"已做出业务判断"或"值得做但不阻塞的设计改进"。

---

## 3. 补齐 email 格式校验

**加在 Model 层，不是 controller**——延续 Day 3 定下的原则（3.5c "删掉 controller 手动校验，Model 做单一校验源"），email 格式和 required 性质上是同一类东西（业务字段校验），该长在同一处。

```js
// models/users.js
email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please fill a valid email address']
}
```

`match` 不匹配时自动抛 `ValidationError`，走的是和 `required` 完全同一条错误通道，复用已有的 400 处理链，不用改错误中间件、不用改 repository。

验证三条：
1. 传 `notanemail` → 400（不再是 201）
2. 传合法邮箱 → 仍然 201
3. **重复邮箱那条依然 409**——因为 email 同时有 `match` 和 `unique` 两个约束，要确认合法格式但重复的邮箱走的还是 E11000 → 409，没被 `match` 校验干扰

三条全过，这个 TODO 清干净。

---

## 4. Delete：`DELETE /users/:id`

四层加函数，复用已有模式（下面这版是**当时**的实现；下午做校验中间件重构后，controller 里的 ObjectId 判断被挪走了，见 §8）：

```js
// routes/users.js
usersRouter.delete('/:id', deleteUserController);
```

```js
// controller/users.js（重构前）
export async function deleteUserController(req, res) {
    const { id } = req.params;
    if (!validateObjectId(id)) {
        return res.status(400).json({ error: `Invalid user id format: ${id}` });
    }
    const deletedUser = await deleteUserService(id);
    if (!deletedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json({ message: `User with id ${id} deleted successfully` });
}
```

```js
// services/users.js —— 纯透传
export async function deleteUserService(id) {
    return deleteUser(id);
}
```

```js
// repositories/users.js
export async function deleteUser(id) {
    const deletedUser = await User.findByIdAndDelete(id);
    return deletedUser;   // 查不到时是 null，套用今天热身理清的那条"404 是谁在主动判断"
}
```

### 4.1 两个设计判断

**删除不存在的 id → 404**：跟 Read 的模型完全一样——`findByIdAndDelete` 查不到返回 `null`，controller 判断后主动 `res.status(404)`。

**删除成功返回什么？** 两种业界常见做法：`204 No Content`（没什么可给的）vs `200 + 返回被删对象/一句提示`。**决定：`200 + { message: "..." }`**——告诉客户端"删除成功"这件事，但不返回被删对象本身（返回对象能让客户端知道"删的是谁"，返回 message 只确认"删除成功"，两种信息量不同，这里选后者）。

### 4.2 顺手做的收口：抽取共享校验函数

之前 Read/Create 各自内联写了一遍 ObjectId 校验正则，这次抽成共享函数：

```js
// utils/validators.js
export const validateObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
```

三条边界测试（合法且存在的 id → 200；合法但不存在 → 404；格式非法 → 400）全部通过，Compass 里确认数据被正确删除。

---

## 5. Update：`PATCH /users/:id`

### 5.1 PUT 还是 PATCH？

- **PUT**：整体替换语义——客户端传完整资源，服务器整体覆盖。
- **PATCH**：局部更新语义——客户端只传想改的字段，其余不变。

**决定：先做 PATCH。** 真实场景里"只改一个 age 却要求把 name/email/addresses 全部重传"不合理，PATCH 更贴合大多数真实需求，业界也更常见只提供 PATCH。

### 5.2 实现（当时版本，同样在下午被重构，见 §8/§9）

```js
// routes/users.js
usersRouter.patch('/:id', updateUserController);
```

```js
// controller/users.js（重构前）
export async function updateUserController(req, res) {
    const { id } = req.params;
    if (!validateObjectId(id)) {
        return res.status(400).json({ error: `Invalid user id format: ${id}` });
    }
    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }
    const updatedUser = await updateUserService(id, req.body);
    if (!updatedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json(updatedUser);
}
```

```js
// repositories/users.js —— 错误翻译逻辑和 Create 几乎一模一样，直接复用
export async function updateUser(id, updateData) {
    try {
        const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        return updatedUser;
    } catch (error) {
        if (error.name === 'ValidationError') {
            throw new UserValidationError(`User Validation Error: ${error.message}`, { cause: error });
        } else if (error.code === 11000) {
            const email = Object.entries(error.keyValue).map(([key, value]) => `${key}: ${value}`).join(', ');
            throw new EmailConflictError(`User with ${email} already exists`, { cause: error });
        }
        throw error;
    }
}
```

### 5.3 `findByIdAndUpdate` 的两个关键 option

| Option | 作用 | 不设的后果 |
|---|---|---|
| `new: true` | 返回**更新后**的文档 | 默认返回更新前的旧文档——`res.json()` 出去的就是"没改之前的样子"，客户端会以为没生效 |
| `runValidators: true` | 更新时重新跑 Schema 校验（required / unique / match） | 默认**不会**重新校验，改成重复 email 会被静默写进去，409 根本不会触发 |

### 5.4 验证

四条测试全部符合预期：
1. 合法更新一个字段 → 200 + 更新后的对象
2. 非法 id 格式 → 400
3. 不存在的 id → 404
4. 改成重复邮箱 → **409**（验证错误翻译分层不是 Create 专属，是通用机制——只要是"操作数据库"这个动作，insert 还是 update 都会触发同一套翻译逻辑）

### 5.5 顺手做的两处收口

- **主动加了 `if (!req.body)` 校验**——延续 Day 3 5.1(a) 的经验（"req.body 缺失应该是 400"），这次直接用在了 Update 上。
- **把 `validateObjectId` 从 controller 挪到 `utils/validators.js`**——因为 Update 也要用同一个校验函数，抽到独立的工具文件比继续内联复制更合理，呼应 Day 3 把 `db.js` 放进 `config/` 的思路：基础设施/工具类的东西单独归位，不塞进四层业务分层里。

---

## 6. PUT 要不要写？

三个选项都站得住：

- **A. 不写**：PATCH 已覆盖目前所有真实更新场景（改姓名/年龄/邮箱，本质都是"改几个字段"），没有一次是"整体替换"。写 PUT 纯粹是为了方法名齐全，没有真实场景撑着。
- **B. 写，但复用 PATCH 的实现**：只加一行路由 `usersRouter.put('/:id', updateUserController)`，成本极低，但语义不对——挂着"整体替换"的名字，干的是"局部更新"的事。
- **C. 写一个真正符合 PUT 语义的实现**：要求 body 带全部必填字段，否则 400。今天没有任何真实 case 需要这种严格性，纯粹为了教科书式完整性。

**决定：A，不写 PUT。**

理由不是偷懒，是延续这几天一直在练习的判断力——"有没有真实场景撑着"（呼应 Day 2 那道"controller 校验删不删"的取舍，以及今天 §2.1 "空 addresses 要不要拒绝"的判断，都是同一种"看场景不看清单"的方式）。为了 CRUD 方法论齐全而写 PUT，恰恰是这几天一直在避免的"为了完整而完整"。

> 如果 demo 被问到"为什么没有 PUT"：**"PATCH 覆盖了目前的更新场景，PUT 的整体替换语义暂时没有真实需求，等场景出现再补——这是有意识的取舍，不是漏掉了。"**

---

## 7. 优雅关闭（Graceful Shutdown）

### 7.1 为什么需要

现在 server 停止的方式是终端 `Ctrl+C`，进程直接死掉。**问题**：如果这时候正好有请求在处理中（比如正在写数据库），进程说停就停，请求可能被拦腰截断，数据库连接也没来得及好好关闭。优雅关闭要做的事：收到"该停了"的信号后，**先不接新请求、把手头正在处理的请求做完、断开数据库连接，再真正退出**。

涉及两个新东西：**进程信号**，以及一个之前定义了但从没被调用过的函数——`disconnectDB`。

### 7.2 两个关键机制

- **进程信号**：Node 能监听操作系统发给它的信号——`SIGINT`（终端 `Ctrl+C` 发的）和 `SIGTERM`（Docker/生产环境要停止容器时发的、更正式的"请优雅退出"信号），用 `process.on(signal, callback)` 监听。
- **`server.close()`**：`app.listen()` 返回的 server 对象有这个方法——**停止接收新连接，但等现有连接处理完**才触发回调，不是立刻的。这正是"优雅"的关键，用它而不是直接 `process.exit()`。

### 7.3 正确顺序

**想清楚顺序，这是这一环节真正的设计题**：如果**先**断开数据库、**后**处理完正在跑的请求，会发生什么？——那个正在处理中的请求这时候想查数据库，库已经断了，顺序反了会出新 bug。正确顺序：

```
process.on('SIGINT'/'SIGTERM', 处理函数)

处理函数里：
  1. 打印"收到关闭信号，开始优雅关闭..."
  2. 调用 server.close() —— 停止接收新请求，等现有请求处理完
  3. server.close 的回调里（这才是处理完的时机）：
     - 调用 disconnectDB()
     - 打印"已关闭"
     - process.exit(0)
```

### 7.4 迭代过程：从能跑到干净

**第一版**给 `SIGINT`、`SIGTERM` 各写了一个几乎相同的处理函数，并把 `server` 挂在 `app.locals.server` 上传递给回调。review 出两个问题：

**问题 1（明显重复）**：两个信号的处理逻辑完全相同（`server.close()` → `disconnectDB()` → `process.exit()`），只有打印的信号名字符串不同——典型的"该抽出来"信号。抽成共享函数 `gracefulShutdown(signal)`，两个 `process.on` 都调用它，信号名作为参数传入。

**问题 2（设计选择，不是 bug）**：`app.locals` 本来是给模板引擎/视图层传共享展示数据用的，用它存"运维用的内部对象"语义上不对口。根因是 `server` 是 `startServer()` 函数**内部**的局部变量，外部的 `process.on` 回调访问不到，才不得不借 `app.locals` 中转。**更干净的做法**：把 `server` 提到**模块级作用域**，`startServer()` 内部只负责赋值（去掉 `const`），`process.on` 回调直接访问这个外层变量，不用绕道。

**最终版**（`app.js`）：

```js
let server = null;

async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await disconnectDB();
      console.log(`${signal} Server closed`);
      process.exit(0);
    } catch (err) {
      console.error('Error during disconnecting from MongoDB:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
```

```js
// config/db.js —— disconnectDB 终于被用上
const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (err) {
        throw new DatabaseConnectionError('Failed to disconnect from the database', { cause: err });
    }
};

export { connectDB, disconnectDB };
```

一个顺手统一的风格点：`gracefulShutdown` 里把 `.then/.catch` 换成了 `try/catch + await`——跟 Day 3 db.js 那次"发现 await 和 .then 混用该统一"是同一个习惯的延续。

另一个小地方：变量声明最初写的是 `var server = null`，这三天写的代码里从没出现过 `var`（都是 `const`/`let`），`var` 的作用域规则（函数作用域）和 `let`（块作用域）不同，现代 JS 项目一般不用它。这里需要的是"稍后会被重新赋值的变量"，改成 `let server = null`，不影响运行，但保持风格一致。

### 7.5 验证

启动 server，`Ctrl+C`，依次看到："Received SIGINT..." → "Disconnected from MongoDB" → "SIGINT Server closed" → 进程干净退出，不是生硬中断。顺序符合预期。

---

## 8. 校验中间件重构

### 8.1 目标

这不是新知识，是"把已经做过的事重新归位"。之前的处理链——`req.body` 缺失校验（`if (!req.body)`）、ObjectId 格式校验（`validateObjectId`）——**都写在 controller 里，逐个函数各自判断一次**。这类校验有个共同特征：**不需要碰 service、不需要碰数据库，只看 `req` 本身就能判断对不对**——这正是"中间件"该干的事：在请求真正进入业务逻辑之前，先把关一道。这一步是**重构**，行为不应该变，变的是"谁在什么时候做这件事"。

中间件的模式（Day 1 已经写过 logger、错误处理这些）：`(req, res, next)` 三参数函数——校验通过就调 `next()` 放行；不通过就直接 `res.status(400).json(...)`，不调 `next()`，请求到此为止，不会走到 controller。

### 8.2 设计要点

1. **纯函数 vs 中间件是两个抽象层级**：`validateObjectId(id)` 是"给个字符串、返回 true/false"的纯判断函数，不碰 `req`/`res`；"中间件"是"知道怎么从 `req` 取值、怎么用 `res` 回应"的一层包装。两者可以分开放——新建 `middlewares/` 目录专门存放这类中间件，`utils/` 继续存纯函数。
2. **固定读 `req.params.id`**：三个用到 ObjectId 校验的路由（`GET/:id`、`PATCH/:id`、`DELETE/:id`）都是从 `req.params.id` 取值，中间件可以直接写死读这个字段，不用做成通用参数名。
3. **一个路由可以挂多个处理函数**，前一个 `next()` 放行才轮到后一个：

```js
usersRouter.get('/:id', validateIdMiddleware, listUsersController);
```

这跟 Day 1 学的洋葱模型是同一个道理——前一个不放行，后一个永远轮不到。

### 8.3 实现

```js
// middlewares/validateIdParamMiddleware.js
import { validateObjectId } from "../utils/validators.js";

export const validateIdParam = (req, res, next) => {
  const { id } = req.params;
  if (!validateObjectId(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
};
```

```js
// middlewares/validateHasRequestBodyMiddleware.js
import { hasRequestBody } from '../utils/validators.js';

export const validateHasRequestBody = (req, res, next) => {
    if (!hasRequestBody(req.body)) {
        return res.status(400).json({ error: 'Request body is missing' });
    }
    next();
};
```

```js
// routes/users.js
usersRouter.get('/:id', validateIdParam, listUsersController);
usersRouter.post('/', validateHasRequestBody, createUserController);
usersRouter.delete('/:id', validateIdParam, deleteUserController);
usersRouter.patch('/:id', validateIdParam, validateHasRequestBody, updateUserController);
```

对应地，**把三个 controller 函数里原来那段 `if (!validateObjectId(id))...` 的判断删掉**——中间件已经在它们之前拦过了，能进到 controller 说明 id 一定合法，留着不删就是重复的、过时的校验，容易造成误解。

验证：格式非法的 id 访问三个端点，依然 400，只是现在是中间件挡的，不是 controller——**行为不变，结构变了**。

### 8.4 一个中间件顺手做多了：`setUpdateDataWhitelistMiddleware`

第一版重构范围比预期更大：除了 ObjectId、body 存在性两个中间件，还顺手把"从 `req.body` 里挑出 name/email/age/addresses、组装成 `req.updateData`"这个动作也做成了中间件：

```js
// middlewares/setUpdateDataWhitelistMiddleware.js（后来被删除，见 §9）
export const setUpdateDataWhitelist = (req, res, next) => {
    const { name, email, age, addresses } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (age !== undefined) updateData.age = age;
    if (addresses !== undefined) updateData.addresses = addresses;
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided to update' });
    }
    req.updateData = updateData;
    next();
};
```

**这个中间件命名和另外两个不一样**——`validateIdParam`、`validateHasRequestBody` 是"看一眼、判断真假"的**校验**动作；`setUpdateDataWhitelist` 是"重新组装数据、产出一个新东西"的**加工**动作，性质不同。**命名已经在诚实地提示这个职责差异**（`validate...` vs `set...`）——这也是 Day 2 学到的"好命名会自己说真话"那条原则的延续，只是当时没细想，后来才把这个差异明确讨论出来（见 §9）。

---

## 9. 字段白名单该放哪层：一把判断标尺

### 9.1 问题

`setUpdateDataWhitelist` 做的不是"合法就放行、不合法就拦"的纯校验，它在**主动加工数据**——这跟前两个中间件性质不一样。由此引出一个真正的设计问题：**"哪些字段允许被更新"，到底该是 route 层中间件干的事，还是 controller/service 该干的事？**

两种观点：
- **支持放中间件**：这是"进入业务逻辑前的数据清洗"，跟校验属于同一类"入口把关"，能让 controller 更干净。
- **支持放 service**：**"哪些字段允许被更新"其实是业务规则，不是 HTTP 层面的东西**。如果将来 Model 加了新字段（比如 `phone`），要记得同时去改中间件里的白名单列表，不然新字段永远更新不了、还会静默报"没有效字段"的 400——这个 bug 很隐蔽。本质上是"字段清单写了两处潜在的地方"（Model 定义了字段、中间件又重复列了一遍），容易不同步，跟 Create 时想通的"单一校验源"是同一类风险。

### 9.2 判断标尺

**"这件事，是在描述『HTTP 请求长什么样』，还是在描述『这个业务允许发生什么』？"**

- `req.params.id` 格式对不对——这是"HTTP 请求长什么样"，跟业务规则无关，不管业务是电商还是社交软件，ObjectId 格式校验都一样。**这类东西留在 controller/中间件，不该进 service。**
- "用户允许被更新哪些字段"——这**不是**"请求长什么样"，是"**这个业务规则里，User 这个东西，允许谁改、改什么**"。换一个业务（比如库存系统），这个规则可能完全不同。**这是业务规则，业务规则是 service 该管的东西。**

配套的检验角度：**换一个完全不同的业务，这段逻辑还成立吗？**
- ObjectId 格式校验——换成图书管理系统，一样成立（格式规则不关心业务是什么）。
- "User 允许改 name/email/age/addresses"——换成图书管理系统，这条规则**根本不存在**，变成"Book 允许改书名、库存"之类完全不同的东西。**跟业务强绑定、换个业务就变的，是业务规则，归 service；跟业务无关、放哪个项目都一样的，不归 service。**

一句话总结：**service 关心的是"业务规则怎么定"，不是"这次 HTTP 请求长什么样"。**

### 9.3 一次迟到的顿悟：service 层三天来第一次真正装东西

这次讨论也倒查出一个更根本的困惑：这三天 service 层做的事**100% 都是"原样把参数传给 repository、原样把结果传回去"**（`listAllUsersService`、`createUserService`、`deleteUserService` 全是纯转发），从没真正在 service 里写过一行业务逻辑。这不是理解力问题，是**还没有一个真实场景逼着必须往 service 里塞东西**——空对着一个"业务逻辑的预留位"，自然想象不出它具体该装什么。字段白名单这件事，恰好是第一次这样的真实场景。

### 9.4 迁移：白名单搬进 service

```js
// services/users.js
export async function updateUserService(id, updateData) {
    if (Object.keys(updateData).length === 0) {
        throw new UserValidationError('No valid fields provided for update');
    }
    const allowedFields = ['name', 'email', 'age', 'addresses'];
    const filteredUpdateData = {};
    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            filteredUpdateData[field] = updateData[field];
        }
    }
    return updateUser(id, filteredUpdateData);
}
```

配套调整：
- **controller 简化**：不再需要 `req.updateData`，直接把 `req.body` 传给 `updateUserService`。
- **route 清理**：`setUpdateDataWhitelistMiddleware.js` 整个删掉，路由上也去掉这一步挂载。
- **"没有效字段"的判断也跟着搬进 service**——这本质上也是业务规则（允许更新的字段一个都没传，这个更新请求没有意义），按同一把尺子该跟白名单待在一起。但 **service 不能直接 `res.status(400)`**（service 不碰 `res`，Day 2 定下的铁律没破），所以用 Create/Update 已经很熟的机制表达"这个操作不该继续"——**抛一个领域错误**，让它冒泡到错误中间件。

### 9.5 撞上的坑：新建错误类忘记在 app.js 注册

第一版迁移时新建了一个专门的错误类 `NoValidFieldsWhenUpdatingError` 并在 service 里抛出，但实测发现它没有被正确翻译成 400，而是掉进了 **500**。

**排查思路**：对比 `EmailConflictError`/`UserValidationError` 当初的建立过程——那两个类不只是在 `errors/` 里定义，还**同步**在 `app.js` 错误中间件里加了 `instanceof` 判断分支。**这次只做了定义这一步，注册分支这步漏掉了**——错误中间件根本不认识这个新类，它没被赋过 `statusCode`，自然落到兜底的 500。去检查 `app.js`，确认就是这个原因。

**最终决定：不新建专门的类，直接复用 `UserValidationError`。**

理由：`NoValidFieldsWhenUpdatingError` 和 `UserValidationError` 语义上是同一类东西——都是"客户端提交的数据不符合要求"，状态码都是 400，区别只是触发原因不同（字段值不合法 vs 压根没给任何有效字段）。从调用方角度看，处理方式完全一样。**新建一个专门类的代价这次已经亲手体会到了**——每多一个领域错误类，就多一处要在 `app.js` 里注册的地方，多一个"忘记注册"的风险点。少建一个类，能换来少一处维护成本。

```js
// services/users.js —— 最终版本
if (Object.keys(updateData).length === 0) {
    throw new UserValidationError('No valid fields provided for update');
}
```

**这条经验比这次具体的 bug 更值钱，值得记牢：每新建一个领域错误类，必须同步在 app.js 错误中间件里注册 instanceof 分支，否则会静默掉进 500。** 以后加第四个、第五个错误类时，这是自查清单第一条；如果新错误的语义和已有类同属一个大类（比如都是"请求数据不合法"），优先考虑复用而不是新建。

改完重新测：PATCH 传合法字段 → 200；PATCH 传空对象或全是垃圾字段 → 400（不再是 500）；PATCH 改成重复 email → 依然 409（错误链没被弄断）。三条全过。

---

## 10. Week 2 交付物：完整架构总览

### 10.1 五个端点

```
GET    /users        → 200 列表
GET    /users/:id    → 200 单个 / 400 格式错 / 404 不存在
POST   /users        → 201 创建 / 400 校验失败 / 409 重复
PATCH  /users/:id    → 200 更新 / 400 格式错/body缺失/无有效字段 / 404 不存在 / 409 重复
DELETE /users/:id    → 200 删除 / 400 格式错 / 404 不存在
```

### 10.2 请求经过的中间件链（重构后的最终版本）

```
GET    /users                                          → listUsersController
GET    /users/:id    → validateIdParam                 → listUsersController
POST   /users        → validateHasRequestBody           → createUserController
PATCH  /users/:id    → validateIdParam → validateHasRequestBody → updateUserController（白名单过滤在 service 内部）
DELETE /users/:id    → validateIdParam                 → deleteUserController
```

route 层现在读起来像一份清单，一眼能看出每个端点经过了哪些关卡；controller 变薄，只剩"调 service、把结果翻译成 HTTP 响应"这一件事。

### 10.3 目录结构（最终）

```
src/
├── app.js                 # 挂载中间件、路由、错误中间件、优雅关闭
├── config/db.js           # connectDB / disconnectDB
├── middlewares/
│   ├── validateIdParamMiddleware.js
│   └── validateHasRequestBodyMiddleware.js
├── models/users.js
├── routes/users.js
├── controller/users.js
├── services/users.js       # 现在真正装了业务规则(字段白名单)，不再是纯透传空壳
├── repositories/users.js
├── errors/userErrors.js
└── utils/validators.js     # 纯函数：validateObjectId、hasRequestBody
```

统一的 ObjectId 校验、统一的错误翻译分层、统一的 400/404/409 语义，加上今天下午收口的优雅关闭和校验中间件——是一套真正一致、结构清晰的 API，不是五个各自为政的接口拼凑起来的。

> 一个观察到但不影响功能的小变化：中间件版 `validateIdParam` 返回的错误信息是固定的 `'Invalid ID format'`，比重构前 controller 里 `` `Invalid user id format: ${id}` `` 少了具体的 id 值。测试集里没有断言具体文案，不影响现有测试，但记一笔——以后如果要恢复更详细的报错信息，知道去 `middlewares/validateIdParamMiddleware.js` 改。

---

## 11. Day 4 核心收口

| 知识点 | 一句话 |
|---|---|
| 404 路径 | 业务合法地"没找到" → 返回 `null` → **controller 主动判断**返回，不经过错误中间件 |
| 400/409/500 路径 | **repository 主动 `throw`** 领域错误 → 冒泡（中间层不 catch）→ 错误中间件统一 `res.status().json()` |
| 两条路径互斥 | 一次请求只会走其中一条；写 case 前先判断走哪条，决定去哪个文件验证 |
| "response 从 controller 出去" | 只对正常路径成立；网上分层图大多只画 happy path，没画错误路径的第二个出口 |
| 测试清单的价值 | 不是纸上猜，是拿真代码实测，把"期望"和"当前实际"分栏对照，才能挖出真 gap |
| addresses 子文档 required | 和顶层字段是同一套校验机制，"数组本身不 required"≠"数组内元素不校验" |
| 数组类型默认值 | Mongoose 对 `[...]` 类型字段不传也会初始化成 `[]`，不是 `undefined` |
| Mongoose `strict` 默认行为 | schema 外字段静默丢弃，既不报错也不保留 |
| email 格式校验 | 用 `match` 选项，走和 `required` 相同的错误通道，不用改错误中间件 |
| `findByIdAndUpdate` 两个 option | `new: true` 返回更新后文档；`runValidators: true` 才会重新校验 unique/required |
| 错误翻译分层是通用的 | Create/Update 共用同一套 try/catch 翻译逻辑，不是为 Create 量身定做 |
| PUT 的取舍 | 没有真实场景就不写，比"顺手写全"更有含金量 |
| 优雅关闭顺序 | 先 `server.close()` 停止接收新请求 → 等现有请求处理完 → 断开数据库 → `process.exit()`；顺序反了会让处理中的请求在库已断开时还想查库 |
| 进程信号 | `SIGINT`（Ctrl+C）、`SIGTERM`（容器/编排系统发的正式停止信号），用 `process.on` 监听 |
| 中间件命名差异 | `validate...`（校验型，判断真假）vs `set...`（加工型，重新组装数据）——命名不同本身在提示职责不同 |
| service 边界判断标尺 | "这件事在描述 HTTP 请求长什么样，还是业务允许发生什么" ——换个业务还成立就不归 service，会变就归 service |
| service 从空壳到装东西 | 字段白名单是三天来第一次让 service 有了真正的业务逻辑 |
| 新建错误类的隐藏成本 | 每个新类都要求在 app.js 同步注册 `instanceof` 分支，忘记就静默掉进 500 |
| 错误类要不要精细拆分 | 语义同属一类（如"请求数据不合法"）时，复用已有错误类比新建专用类更省维护成本 |

---

## 12. 遗留 TODO

- **响应格式统一**：现在错误是 `{ error: message }`，成功是直接返回资源对象本身。若要统一成 `{ code, message }`，是一次全局响应格式重构（错误中间件 + 所有 controller 的成功响应都要改），不是改一行字段名——先记 TODO，不顺手改，避免改一半、新旧格式混用。
- **Mongoose 原生 ValidationError message 直接透传给客户端**：面向开发者、偏冗长，生产环境是否合适需要讨论，暂不处理。
- **PUT `/users/:id` 暂未实现**：PATCH 已覆盖局部更新场景，等出现"整体替换"的真实需求再补；补的话要注意语义要求 body 带全部必填字段，不能直接复用 PATCH 逻辑。
- ~~**优雅关闭**~~：已完成（§7）。
- ~~**校验中间件**~~：已完成（§8/§9）。
</content>
