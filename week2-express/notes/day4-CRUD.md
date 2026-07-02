# Day 4 · CRUD 收尾 · Update / Delete + 测试清单实战

> Day 3 把 Read/Create 接了真库、串起了错误翻译分层。今天两条主线：①用一次**闭卷复盘**倒查出两个理解偏差（404 路径 vs 400/409 路径被混成了一条）②用一份**手写测试清单**把 POST /users 的"期望行为"和"当前实际行为"逐条对照，揪出真 gap，再补齐 Update（PATCH）、Delete——**Week 2 五个端点今天全部收口。**

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

四层加函数，复用已有模式：

```js
// routes/users.js
usersRouter.delete('/:id', deleteUserController);
```

```js
// controller/users.js
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

### 5.2 实现

```js
// routes/users.js
usersRouter.patch('/:id', updateUserController);
```

```js
// controller/users.js
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

## 7. Week 2 交付物：五个端点全部收口

```
GET    /users        → 200 列表
GET    /users/:id    → 200 单个 / 400 格式错 / 404 不存在
POST   /users        → 201 创建 / 400 校验失败 / 409 重复
PATCH  /users/:id    → 200 更新 / 400 格式错或body缺失 / 404 不存在 / 409 重复
DELETE /users/:id    → 200 删除 / 400 格式错 / 404 不存在
```

统一的 ObjectId 校验、统一的错误翻译分层、统一的 400/404/409 语义——是一套真正一致的 API，不是五个各自为政的接口拼凑起来的。今天全程 Update/Delete 都是独立完成、独立测试、独立发现并抽取公共函数（`validateObjectId`）。

---

## 8. Day 4 核心收口

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
| 工具函数归位 | `validateObjectId` 抽到 `utils/validators.js`，不塞进某一层业务文件里 |
| PUT 的取舍 | 没有真实场景就不写，比"顺手写全"更有含金量 |

---

## 9. 遗留 TODO

- **响应格式统一**：现在错误是 `{ error: message }`，成功是直接返回资源对象本身。若要统一成 `{ code, message }`，是一次全局响应格式重构（错误中间件 + 所有 controller 的成功响应都要改），不是改一行字段名——先记 TODO，不顺手改，避免改一半、新旧格式混用。
- **Mongoose 原生 ValidationError message 直接透传给客户端**：面向开发者、偏冗长，生产环境是否合适需要讨论，今天暂不处理。
- **PUT `/users/:id` 暂未实现**：PATCH 已覆盖局部更新场景，等出现"整体替换"的真实需求再补；补的话要注意语义要求 body 带全部必填字段，不能直接复用 PATCH 逻辑。
- **优雅关闭**（Day 3 埋下的伏笔，仍未做）：`db.js` 监听 `SIGINT`/`SIGTERM`，先断开连接再退出进程。

优雅关闭是新知识点(但概念简单),校验中间件是把已经做过的事重新归位。按这个顺序做:优雅关闭先(相对独立、能完整收尾一个概念),校验中间件后(涉及挪代码,需要更细心)。

---

## 1. 优雅关闭(Graceful Shutdown)

**先说清楚这个东西解决什么问题,你才知道为什么要做。**

现在你的 server 是怎么停的?大概率是终端 `Ctrl+C`,进程直接死掉。**问题在于:如果这时候正好有个请求在处理中(比如正在写数据库),进程说停就停,这个请求可能被拦腰截断,数据库连接也没来得及好好关闭。** 优雅关闭要做的事是:收到"该停了"的信号后,**先不接新请求、把手头正在处理的请求做完、断开数据库连接,再真正退出**。

**这涉及一个你之前只是定义、没有用起来的东西——`disconnectDB`,以及一个新概念:进程信号。**

**你要自己想清楚、自己写的部分:**

1. **怎么"知道"该关闭了?** —— Node 进程能监听操作系统发给它的信号,最常见的是 `SIGINT`(你按 Ctrl+C 时发的)和 `SIGTERM`(比如 Docker/生产环境要停止容器时发的,更正式的"请优雅退出"信号)。用 `process.on('SIGINT', 回调)` 和 `process.on('SIGTERM', 回调)` 监听。查一下这两个怎么用。

2. **收到信号后,按什么顺序做事?** 想清楚这个顺序,这是本环节真正的设计题:
   - 先做什么(停止接收新连接?断开数据库?)
   - 后做什么
   - 想一想:如果**先**断开数据库、**后**处理完正在跑的请求,会发生什么问题?(那个正在处理中的请求,这时候想查数据库,库已经断了——所以顺序反了会出新 bug。这个想清楚,你就知道正确顺序该是什么。)

3. **`disconnectDB` 现在有用武之地了。** 之前你定义了它、没调用,现在这就是它该出场的地方。

4. **`app.listen()` 返回的对象,有一个 `.close()` 方法**——这是"停止接收新连接、但等现有连接处理完"的关键方法,你需要用它,而不是直接 `process.exit()`。查一下 `server.close()` 的用法和它接受的回调时机。

**给你一个大致骨架方向(不是代码,是结构思路):**

```
process.on('SIGINT', 一个处理函数)
process.on('SIGTERM', 同一个处理函数)

这个处理函数里:
  1. 打印一句"收到关闭信号,开始优雅关闭..."
  2. 调用 server.close() —— 停止接收新请求,等现有请求处理完
  3. server.close 的回调里（这是它处理完的时机）：
     - 调用 disconnectDB()
     - 打印"已关闭"
     - process.exit(0)
```

**一个你需要留意的细节:** `app.listen(PORT, callback)` 这行代码,现在返回值你有没有保存?你需要拿到这个返回的 `server` 对象,才能调用 `.close()`。看一下你现在 `startServer` 函数里 `app.listen(...)` 那行,要不要改成 `const server = app.listen(...)`。

**写完怎么验证:** 启动 server,在终端按 `Ctrl+C`,应该看到你打印的"收到关闭信号"→ 库断开的日志(如果 `disconnectDB` 里有打印的话)→ 进程正常退出(不是那种生硬的直接终止)。

---

先做优雅关闭,写完发我,或者自己觉得测通了也可以直接说,我们再进校验中间件那部分。卡在信号监听或 `server.close()` 用法,随时问。

db.js
const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (err) {
        throw new DatabaseConnectionError('Failed to disconnect from the database', { cause: err });
    }
};

export { connectDB, disconnectDB };

---
app.js
async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    // 将 server 对象暴露到外部，以便在 SIGINT 或 SIGTERM 信号时关闭服务器
    app.locals.server = server;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();

// 优雅关闭服务器
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  app.locals.server.close(() => {
    disconnectDB().then(() => {
      console.log('SIGINT Server closed');
      process.exit(0);
    }).catch((err) => {
      console.error('Error during disconnecting from MongoDB:', err);
      process.exit(1);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  app.locals.server.close(() => {
    disconnectDB().then(() => {
      console.log('SIGTERM Server closed');
      process.exit(0);
    }).catch((err) => {
      console.error('Error during disconnecting from MongoDB:', err);
      process.exit(1);
    });
  });
});

顺序完全对——`server.close()` 先停止接收新连接、等现有请求处理完,回调里才 `disconnectDB()`,最后才 `process.exit(0)`。这个因果链你想清楚了,没有反。`disconnectDB` 也终于从"定义了没人用"的死代码,变成真正被调用的东西了。

但这版有两处值得挑,一处是**明显的重复**,另一处是**藏得较深的设计选择**,都值得你处理一下。

**问题 1(重复代码,一眼能看出来):`SIGINT` 和 `SIGTERM` 的处理函数几乎一模一样。**

对比这两段,除了打印的信号名字符串("SIGINT" vs "SIGTERM")不一样,逻辑**完全相同**——`server.close()` → `disconnectDB()` → `process.exit(0)/1`。这正是我们这三天反复强调的那类信号:**看到两段几乎相同的代码,就该抽出来。**

想一下怎么处理:能不能写一个共享的关闭函数 `gracefulShutdown(signal)`,把信号名当参数传进去,两个 `process.on` 都调用同一个函数?这跟你今天上午把 `validateObjectId` 抽到 `utils/` 是同一个动作,只是这次抽的是"关闭逻辑"而不是"校验逻辑"。自己重构一下,应该不难。

**问题 2(更值得想的一处,不是 bug,是设计判断):你把 `server` 挂在了 `app.locals.server` 上。**

`app.locals` 这个东西,本来的用途是**给模板引擎/视图层传共享数据**(比如网站名称、当前年份这类跨请求都要用的展示数据),严格来说不是给你存"运维用的内部对象"设计的。你现在用它来传递 `server` 实例给 `process.on` 的回调,能跑,但语义上有点像"借用了一个不太对口的抽屉"。

**想一下更贴合的做法:** `startServer` 和 `process.on(...)` 那两段代码,现在是不是在**同一个作用域**里?如果它们在同一个文件、同一层作用域,`server` 这个变量能不能直接作为一个**模块级变量**被两边共享,不需要绕道 `app.locals`?

这里有个结构性的问题需要你想清楚:**你的 `process.on('SIGINT', ...)` 现在写在 `startServer()` 函数外面、和 `startServer()` 平级。但 `server` 这个变量是在 `startServer()` 函数**内部**创建的(`const server = app.listen(...)`)——函数内部的变量,外部本来是访问不到的,这就是为什么你不得不借用 `app.locals` 这个"全局可访问的地方"来传递它。**

**更干净的做法是调整代码结构:** 把 `server` 声明提到**函数外层**(模块作用域),`startServer()` 内部**赋值**给它,而不是用 `const` 在函数内部声明。这样 `process.on` 的回调直接访问这个外层变量就行,不需要经过 `app.locals` 中转。想一下这个结构怎么调整——把 `let server` 放在文件顶部,`startServer` 内部改成 `server = app.listen(...)`(去掉 const),两处都能直接用同一个变量。

**这两个问题都不影响功能——你现在这版是能跑的。** 但这次改进属于"代码组织是否清晰"层面,值得处理,尤其是第一个重复代码的问题,改起来也快。

自己改这两处,改完可以自己验证:`Ctrl+C` 触发,能不能看到"收到信号 → server closed → disconnected"这条日志顺序;改完代码量应该比现在少,逻辑没变。改完发我或者自己确认没问题就往下走。