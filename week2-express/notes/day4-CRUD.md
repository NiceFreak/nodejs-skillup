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

var server = null;

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

重复代码消掉了,`server` 也不再借道 `app.locals`,两个问题都处理对了。而且你把 `gracefulShutdown` 里的 `.then/.catch` 换成了 `try/catch + await`——这个我没要求,你自己顺手统一了风格,跟你 Day 3 db.js 那次"发现 await 和 .then 混用该统一"是同一个习惯的延续。

一个小地方,不是错,是可以更好:**`var server = null`——你在这三天写的所有代码里,应该都是用 `const`/`let`,这里冒出一个 `var`。** `var` 是老写法,作用域规则和 `let` 不同(函数作用域 vs 块作用域),现代 JS 项目一般不用它。这里你需要的是"稍后会被重新赋值的变量",应该用 `let server = null`,不是 `var`。改一个词,不影响运行,但保持风格一致。

其余结构都对:`server` 声明在模块顶层、`startServer()` 内部赋值、`gracefulShutdown` 直接访问,不再绕路;两个信号共用同一个函数,只是传入不同的信号名字符串。

**验证一下(如果还没测):** 启动 server,`Ctrl+C`,应该依次看到 "Received SIGINT..." → "Disconnected from MongoDB" → "SIGINT Server closed" → 进程干净退出,不是那种生硬中断。测一下,确认这个顺序对。

优雅关闭这块可以收了。把 `var` 改成 `let`,然后进下一项——**校验中间件**。

---

## 2. 校验中间件

这个不是新知识,是"把已经做过的事重新归位"。回想你今天的处理链:body 缺失校验(`if (!req.body)`)、ObjectId 格式校验(`validateObjectId`)——**这些校验现在都写在 controller 里,逐个函数各自判断一次。** 校验中间件要做的事,是把这类"进入业务逻辑之前的把关"抽成**独立的中间件函数**,让它在请求到达 controller **之前**就做完,而不是让每个 controller 自己判断。

进校验中间件。这块是**重构**,不是新增功能——目标是把散落在各个 controller 里的"进入业务逻辑之前的把关"抽成独立的中间件函数,让请求在到达 controller **之前**就被拦截。跑通的行为不应该变,变的是"谁在什么时候做这件事"。

**先盘一下你现在有哪些"校验",分散在哪:**

1. **ObjectId 格式校验**——`validateObjectId`,现在在 Read(单个)、Delete、Update 的 controller 里,各自手动调用一次判断。
2. **`req.body` 缺失校验**——Update 里有一个 `if (!req.body)`,Create 里(按你 5.1a 那条 TODO)应该也要有,但你当时没细说加没加。

**这些校验有个共同特征:它们不需要碰 service、不需要碰数据库,只看 `req` 本身就能判断对不对。这正是"中间件"该干的事——在请求真正进入业务逻辑之前,先把关一道。**

**中间件长什么样,你已经很熟了(Day 1 就写过 logger、错误处理这些):** 一个普通中间件是 `(req, res, next)` 三参数函数。**校验中间件的模式是:校验通过就调 `next()` 放行;校验不通过就直接 `res.status(400).json(...)`,不调 `next()`,请求到此为止,不会往下走到 controller。**

**动手前,几个你要自己想清楚的设计点:**

1. **ObjectId 校验中间件放哪个文件?** 你已经有 `utils/validators.js` 存了那个纯函数 `validateObjectId`。中间件本身(接收 req/res/next、调用这个纯函数、决定要不要 next)是不是应该是一个新的东西,还是也放在同一个文件?——想一下这两者的区别:`validateObjectId(id)` 是一个"纯粹的判断函数"(给个字符串,返回 true/false,不碰 req/res);而"中间件"是"知道怎么从 req 里取 id、怎么用 res 回应"的一层包装。这是两个不同抽象层级的东西,可以放一起,也可以分开,你判断。常见做法是单独一个 `middlewares/` 目录存放这类中间件。

2. **中间件怎么"知道"要从 `req.params.id` 里取值?** 你现在三个用到它的路由(`GET /users/:id`、`PATCH /users/:id`、`DELETE /users/:id`)恰好都是从 `req.params.id` 取——所以这个中间件可以写成"固定读 `req.params.id`",不用做成通用参数名。

3. **中间件在 route 里怎么挂?** Express 允许一个路由挂**多个**处理函数,前面的处理完调 `next()` 才轮到后面的。想一下写法大概是:

   ```js
   usersRouter.get('/:id', validateIdMiddleware, listUsersController);
   ```

   校验中间件排在 controller **前面**——这跟你 Day 1 学的洋葱模型是同一个道理,前一个不放行,后一个永远轮不到。

**建议的做法(你写,不给完整代码):**

在 `middlewares/`(新建目录)建一个文件,写一个函数,形状大概是:

```js
export function validateIdParam(req, res, next) {
    // 从 req.params.id 取值
    // 调用 validateObjectId 判断
    // 不合法 → res.status(400)...，不调 next
    // 合法 → next()
}
```

然后:
- 三个用到 id 的路由(`GET /:id`、`PATCH /:id`、`DELETE /:id`)都在 route 层挂上这个中间件。
- **对应地,把三个 controller 函数里原来那段 `if (!validateObjectId(id))...` 的判断删掉**——因为中间件已经在它们之前拦过了,能进到 controller 说明 id 一定合法,不需要再判断一次。**这一步很关键,别漏——留着不删就是重复校验,而且是"过时的"重复,容易造成误解。**

**Create 那边,`req.body` 缺失的校验(如果还没加)也可以照这个模式做一个中间件**,想一想能不能和 Update 的那个 `if (!req.body)` 合并成同一个中间件,两条路由(POST、PATCH)都挂上——这个你自己判断要不要一起做,或者先只处理 ObjectId 这一个,分两步走都行。

---

先写 ObjectId 那个校验中间件,建文件、写中间件函数、改三条路由的挂载、删掉三个 controller 里的重复判断。写完测:格式非法的 id 访问三个端点,应该还是 400,只是现在是中间件挡的,不是 controller。行为不变,结构变了。

写完发我看,或者自己验证过没问题也可以直接说,我们再决定要不要顺手把 body 校验也做成中间件。

week2-express/src/middlewares/setUpdateDataWhitelistMiddleware.js
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

week2-express/src/middlewares/validateHasRequestBodyMiddleware.js
import { hasRequestBody } from '../utils/validators.js';

export const validateHasRequestBody = (req, res, next) => {
    if (!hasRequestBody(req.body)) {
        return res.status(400).json({ error: 'Request body is missing' });
    }
    next();
};

week2-express/src/middlewares/validateIdParamMiddleware.js
import { validateObjectId } from "../utils/validators.js";

export const validateIdParam = (req, res, next) => {
  const { id } = req.params;
  if (!validateObjectId(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
};
week2-express/src/routes/users.js
import express from 'express';
import { 
    listUsersController, 
    createUserController, 
    deleteUserController, 
    updateUserController
} from '../controller/users.js';
import { validateIdParam } from '../middlewares/validateIdParamMiddleware.js';
import { validateHasRequestBody } from '../middlewares/validateHasRequestBodyMiddleware.js';
import { setUpdateDataWhitelist } from '../middlewares/setUpdateDataWhitelistMiddleware.js';

const usersRouter = express.Router();

// GET /users
usersRouter.get('/', listUsersController);

// GET /users/:id
usersRouter.get('/:id', validateIdParam, listUsersController);

// POST /users
usersRouter.post('/', validateHasRequestBody, createUserController);

// DELETE /users/:id
usersRouter.delete('/:id', validateIdParam, deleteUserController);

// PATCH /users/:id
usersRouter.patch('/:id', validateIdParam, validateHasRequestBody, setUpdateDataWhitelist, updateUserController);

export { usersRouter };
week2-express/src/controller/users.js
import {
    listAllUsersService,
    listUserByIdService,
    createUserService,
    deleteUserService,
    updateUserService,
} from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (!id) {
        const users = await listAllUsersService();
        return res.json(users);
    } else {
        const user = await listUserByIdService(id);
        if (!user) {
            return res.status(404).json({ error: `User with id ${id} not found` });
        }
        return res.json(user);
    }
}

export async function createUserController(req, res) {
    const { name, email, age, addresses } = req.body;
    const newUser = await createUserService({ name, email, age, addresses });
    return res.status(201).json(newUser);
}

export async function deleteUserController(req, res) {
    const { id } = req.params;
    const deletedUser = await deleteUserService(id);
    if (!deletedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json({ message: `User with id ${id} deleted successfully` });
}

export async function updateUserController(req, res) {
    const { id } = req.params;
    const updateData = req.updateData;
    const updatedUser = await updateUserService(id, updateData);
    if (!updatedUser) {
        return res.status(404).json({ error: `User with id ${id} not found` });
    }
    return res.status(200).json(updatedUser);
}

这一版做得比我要求的范围更大,而且方向是对的——你不只做了 ObjectId 校验中间件,还顺手把 body 校验、甚至一个全新的"更新数据白名单过滤"都做成了中间件。route 层现在读起来像一份清单,一眼就能看出每个端点经过了哪些关卡,这是校验中间件真正的价值所在。逐个过,有对的要确认、也有一个需要认真讨论的设计问题。

**先确认对的部分:**

- **`validateIdParam`**:结构对,三条路由(`GET/:id`、`DELETE/:id`、`PATCH/:id`)都挂了,`GET /` (列表)没挂——这个判断是对的,因为列表接口没有 `:id` 需要校验。controller 里的重复判断你也删掉了(`listUsersController`、`deleteUserController`、`updateUserController` 里都不再有 `validateObjectId` 调用)。✓ 干净利落。

- **`validateHasRequestBody`**:抽成了共享中间件,`POST` 和 `PATCH` 都挂上了,而不是像之前那样在两个 controller 里各写一次 `if (!req.body)`。✓

- **`Object.keys(updateData).length === 0` 返回 400**:这是个好的补充判断——如果 PATCH 传了一个 body,但里面没有一个字段是 schema 认识的(比如全是垃圾字段或者是空对象 `{}`),没有中间件拦的话,`findByIdAndUpdate(id, {})` 会"更新"却什么都没改,这种请求语义上是可疑的、该被拒绝。你这个判断补上了 `validateHasRequestBody` 没覆盖到的空隙(它只挡"body 完全不存在",这个挡的是"body 存在但没有效字段")。

**现在说需要认真讨论的部分:`setUpdateDataWhitelist` 这个中间件——它做的事,已经超出"校验"的范畴了,这里有个职责归属问题要想清楚。**

这个中间件做的不是"合法就放行、不合法就拦"这种纯校验动作,它在**主动加工数据**:从 `req.body` 里挑出几个认识的字段、组装成一个新对象 `updateData`、挂到 `req.updateData` 上。这跟前两个中间件的性质不一样——前两个是"看一眼、判断真假",这个是"重新组装数据、产出一个新东西"。

**这引出一个你该自己判断的问题:字段白名单过滤,到底该是 route 层的中间件干的事,还是 controller/service 该干的事?**

两种观点,你来选,不是我替你定:

- **支持放在中间件的理由**:这是"进入业务逻辑前的数据清洗",跟校验属于同一类"入口把关"的动作,放在 route 层能让 controller 更干净(直接拿到已经处理好的 `req.updateData`,不用自己过滤)。
- **支持放在 controller/service 的理由**:**"哪些字段允许被更新"其实是业务规则,不是 HTTP 层面的东西**。想一下——如果将来 Schema 加了新字段(比如 `phone`),你要记得同时去改这个中间件里的白名单列表,不然新字段永远更新不了、还会静默报"没有效字段"的 400,而这个 bug 很隐蔽(不报错、行为诡异,不容易联想到是白名单漏了)。这跟你之前做 Create 时想通的"单一校验源"是同一类风险——**字段清单现在写了两处潜在的地方(Model 定义了字段、中间件又重复列了一遍字段)**,容易不同步。

**我个人倾向于第二种判断(不是标准答案,是给你参考):这类"哪些字段能被更新"的逻辑,更贴近业务规则,长期看放在 service 层更安全**——但你现在这样放在中间件里,**功能完全没问题,能跑、能防护、逻辑对**,只是长期维护性上,你要意识到"字段列表写死在这里"这件事的代价。

**这个不用今天改**,但请你想清楚、能回答:如果被问到"为什么白名单过滤放在中间件而不是 service",你的理由是什么?——这跟之前 controller 校验删不删是同一种"设计取舍题",只要你想清楚了、有站得住的理由,放哪都可以接受。

**另一个小提醒(不是错,是命名一致性):** 你三个中间件文件名是 `setUpdateDataWhitelistMiddleware.js`、`validateHasRequestBodyMiddleware.js`、`validateIdParamMiddleware.js`——注意到没有,前两个是"动词开头描述功能"(`validate...`),第一个却是"set..."(设置/组装)。这恰好从命名上就已经在提示你:**这三个东西不是同一类东西**,前两个是校验、第三个是数据加工。命名其实已经诚实地告诉你了这个职责差异,只是刚才我们把它明确讨论出来了而已——好的命名有这种"自己说真话"的效果,这也是 Day 2 你学到的那条原则的延续。

---

**收一下:**
- ObjectId 校验和 body 存在性校验,抽成中间件这步完全正确,route 层现在清晰、controller 变薄了,这是校验中间件该有的效果。
- `setUpdateDataWhitelist` 功能没问题,但请你想清楚"字段白名单该归中间件管还是归 service/业务规则管"这个取舍,今天不用动,但要能讲出理由。

**Week 2 到这里,交付物、错误分层、优雅关闭、校验中间件全部完成,而且每一步的设计取舍你都能讲出理由——这已经远超"交付物达标"的水平了。**

我没放 service 是因为我对 service 不够理解，如果现在这样处理不合适我也可以改

这个坦白很重要,而且指向的问题比"放哪一层"更根本——你说"对 service 不够理解",这值得停下来正面处理,而不是绕过去先改代码。改代码解决不了理解问题,只会让你在下一个类似判断点又卡住。

**先说结论:你现在放中间件的做法,不需要因为"不理解 service"而改——但你需要补的是对 service 边界的理解,理解补上后,这个放置对不对,你自己就能判断,不用我告诉你。**

**我们退一步,看看你对 service 到底哪里含糊。** 回想你这三天里 service 层实际发生过的事:

- Read:`listAllUsersService`、`listUserByIdService`——纯转发给 repository。
- Create:`createUserService`——纯转发。
- Delete/Update:同样纯转发。

**你几天下来,service 层做的事 100% 都是"原样把参数传给 repository、原样把结果传回去"。你从来没有亲手在 service 里写过一行"真正的业务逻辑"。** 这就是你"不够理解"的根源——不是你笨,是**你还没有一个真实场景,逼你必须往 service 里塞东西**。空对着一个"业务逻辑的预留位",你当然想象不出它具体该装什么、边界在哪。这不是理解力问题,是"还没遇到需要它的时刻"。

**那"字段白名单该不该放 service"这件事,能不能成为那个"逼你写点真东西进 service"的场景?** 我认为可以,而且正合适——因为它不复杂,能让你亲手体会一次"service 到底该管什么"。

**给你一个判断 service 边界的实用标尺,不是定义,是可操作的问题:**

**"这件事,是在描述『HTTP 请求长什么样』,还是在描述『这个业务允许发生什么』?"**

- `req.params.id` 格式对不对——这是"HTTP 请求长什么样"(URL 里的东西合不合法),跟业务规则无关,不管你的业务是电商还是社交软件,ObjectId 格式校验都一样。**这类东西留在 controller/中间件,不该进 service**——你已经做对了。
- "用户允许被更新哪些字段"——这**不是**"请求长什么样",这是"**这个业务规则里,User 这个东西,允许谁改、改什么**"。换一个业务(比如库存系统),这个规则可能完全不同。**这是业务规则,业务规则是 service 该管的东西。**

**用这把尺子,你现在能不能自己回答:白名单过滤该放哪?**

我猜你现在应该能答出来了——它更贴近第二类。那具体怎么挪,给你方向(你写):

- **service 新增一个函数**,比如 `updateUserService(id, rawData)`,**在 service 内部**做白名单过滤(挑出 name/email/age/addresses),再调 repository。
- **中间件那边**,`setUpdateDataWhitelist` 可以整个删掉,或者简化成只做"body 里至少有一个 key"这种最基础的存在性检查(如果你觉得还有必要的话)。
- **controller** 不再需要 `req.updateData`,直接把 `req.body` 原样传给 `updateUserService`,白名单这道关由 service 内部处理。

**这样做的好处,回到你自己刚才提出的顾虑**:以后 Model 加新字段(比如 phone),你只需要改**一个地方**(service 里的白名单列表),而不是"记得同时改中间件"——因为白名单和它管理的业务对象(User)现在待在同一层。

**你决定要不要现在动手改。** 这不是必须今天做的事——你今天已经做了很多,如果状态到了,改这个不难(就是把几行代码从中间件搬到 service);如果想留到 Day 5 一起处理也完全可以,记个 TODO。

但**理解层面的这个尺子("HTTP 长什么样" vs "业务允许什么"),希望你先记住**——它比"这次白名单放哪"重要得多,以后每次纠结"这段代码该放 controller/中间件,还是 service",都可以拿这把尺子量一下。

service 更关注业务是吗

对,一句话就是这样——**service 关心的是"业务规则怎么定",不是"这次 HTTP 请求长什么样"。**

再帮你把这句话钉得更牢一点,配上你这几天亲手写过的东西做对照,这样它不是一句抽象的话,是你能对号入座的东西:

**"HTTP 请求长什么样"——这些活儿轮不到 service,前面几层就该拦下:**
- id 是不是合法的 ObjectId 格式 → route/中间件
- body 存不存在、是不是有效对象 → route/中间件
- 状态码该是 200 还是 404 → controller(它管的是"把业务结果翻译成 HTTP 语言")

**"业务允许发生什么"——这些才是 service 的地盘,虽然你现在几个 service 函数都还没真正用上:**
- 一个 User 允许被更新哪些字段(今天这个例子)
- 创建用户时,要不要顺带做点别的事(比如以后加"发欢迎邮件"、"密码要不要加密存")
- 如果有权限系统:这个操作,当前用户有没有资格做(这是业务规则,不是格式对不对)
- 多个 repository 需要配合完成一件事时(比如"下单"要同时改库存 repository 和订单 repository),**由 service 来编排这几个动作的先后顺序**——这才是 service 真正扛业务复杂度的地方,你现在项目还没到这个规模,所以感受不到。

**再补一个判断角度,帮你巩固:换一个完全不同的业务,这段逻辑还成立吗?**

- ObjectId 格式校验——换成图书管理系统,一样成立(格式规则不关心业务是什么)。
- "User 允许改 name/email/age/addresses"——换成图书管理系统,这条规则**根本不存在**,变成了"Book 允许改书名、库存"之类完全不同的东西。**跟业务强绑定、换个业务就变的,就是业务规则,归 service。跟业务无关、放哪个项目都一样的,不归 service。**

你这句总结是对的,而且抓住了核心。这把尺子你握住了之后,以后再遇到"这段该放哪层"的纠结,先问自己这一句"换个业务,这条还成立吗",答案通常就出来了。

目标:白名单过滤从中间件搬进 service,controller 不再依赖 `req.updateData`,直接把原始 `req.body` 传给 service。

**分三步改,你来写:**

**1. service:`updateUserService` 内部加白名单过滤**

现在的 `updateUserService(id, updateData)` 是纯转发。改成它自己负责"从传进来的原始数据里,挑出允许更新的字段"。逻辑跟你中间件里写的那段一样,只是**搬家**,不是重新设计:

```js
export async function updateUserService(id, rawData) {
    // 这里做白名单过滤：从 rawData 里挑出 name/email/age/addresses
    // 组装成 updateData
    // 调 repository 的 updateUser(id, updateData)
}
```

一个你要想清楚的点:**"没有一个有效字段"这个判断(`Object.keys(updateData).length === 0` 返回 400),现在也要跟着搬进 service 吗?** ——想一下:这个判断本质上也是"业务规则"(允许更新的字段一个都没传,这个更新请求没有意义),按你刚才自己想通的那把尺子,它应该跟白名单待在一起,一起搬进 service。但 **service 不能直接 `res.status(400)`**——service 不碰 res,这是你从 Day 2 守到现在的铁律。**那 service 发现"没有有效字段"时,该怎么把这个情况告诉 controller?** 回想 Create/Update 已经用过的模式:service/repository 想表达"这个操作不该继续"时,是怎么做的?(提示:不是 return 一个特殊值让 controller 猜,是用你已经很熟的那套机制——抛一个领域错误)

**2. controller:简化**

`updateUserController` 不再需要 `req.updateData`,直接把 `req.body` 传给 `updateUserService`。如果 service 那边选择用抛错误的方式处理"没有效字段",controller **不需要**手动 try/catch 它——回想 Express 5 的特性,这类错误怎么自动被接住的。

**3. route + 中间件:清理**

`setUpdateDataWhitelist` 这个中间件文件,现在的职责被 service 接管了,该怎么处理这个文件和这行注册代码?(删掉,还是留着但改成别的用途——你判断)

---

**几个具体要你自己决定的小问题:**

- 白名单过滤那个逻辑,要不要抽成一个独立的辅助函数(比如 `pickUpdatableFields(rawData)`),让 `updateUserService` 读起来更清爽?还是直接写在函数体里?这次数据量小,你自己判断值不值得多抽一层。
- 如果选择"没有效字段就抛错误",这个错误该用哪个类?你已经有 `UserValidationError` 了——这种"请求语义上不对、该是 400"的情况,复用它合适吗?

写完之后,测三件事保证行为没变:
1. PATCH 传合法字段(比如改 age)→ 200,正常更新
2. PATCH 传空对象 `{}` 或者全是垃圾字段 → 还是 400(只是现在报错的位置和方式变了)
3. PATCH 一个存在的字段改成重复 email → 还是 409(确认没把这条错误链弄断)

自己写,卡在"怎么让 service 的错误被 controller 自动接住"或者别的地方,再问我。

export async function updateUserService(id, updateData) {
    // Whitelist updatable fields so a client can't slip in `_id`, `__v`,
    // or other fields via PATCH (same principle as createUserService).
    if (Object.keys(updateData).length === 0) {
        throw new NoValidFieldsWhenUpdatingError('No valid fields provided to update');
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
我测了一下 NoValidFieldsWhenUpdatingError 似乎进不到
好,精准定位到问题了——`NoValidFieldsWhenUpdatingError` 抛出来了,但没有被翻译成合适的响应,大概率直接掉进了 **500**,而不是你期望的 400。这是个真实的、可预期的缺口,我们来定位并修。

**先确认原因(不是猜,是顺着链路推):**

你在 `errors/userErrors.js` 里新建了这个类,但你有没有做这两件事——**这是关键排查点**:

1. **`app.js` 的错误中间件里,有没有 `import` 这个新类、并且加了 `instanceof NoValidFieldsWhenUpdatingError` 的判断分支?**

回想你 Create 那套错误翻译链的完整结构(笔记第 3.4 节):

```js
app.use((err, req, res, next) => {
  if (err instanceof UserValidationError) {
    err.statusCode = 400;
  } else if (err instanceof EmailConflictError) {
    err.statusCode = 409;
  }
  // ...
});
```

**这里只认识 `UserValidationError` 和 `EmailConflictError` 两个类。你新建的 `NoValidFieldsWhenUpdatingError` 是第三个领域错误类,但如果 app.js 里没有专门加一个 `else if (err instanceof NoValidFieldsWhenUpdatingError) { err.statusCode = 400; }` 这样的分支,错误中间件根本不认识它——它会走到最后那个兜底 `err.statusCode || 500`,因为这个新错误类没有被赋过 `statusCode`,自然落到 500。**

这跟你之前建 `EmailConflictError`/`UserValidationError` 时的完整步骤对比一下:那两个类,你不只是在 `errors/` 里定义了它们,还**同步**在 `app.js` 里加了识别分支。这次你只做了定义这一步,注册分支这步大概率漏掉了。

**去检查 `app.js` 的错误中间件,看有没有这个新类的判断分支——我几乎确定这就是答案。**

---

**如果确认是这个原因,改法很直接:**

在 `app.js` 里 `import` 这个新错误类,然后在错误中间件的判断链里加一个分支:

```js
import { EmailConflictError, UserValidationError, NoValidFieldsWhenUpdatingError } from './errors/userErrors.js';

app.use((err, req, res, next) => {
  if (err instanceof UserValidationError) {
    err.statusCode = 400;
  } else if (err instanceof EmailConflictError) {
    err.statusCode = 409;
  } else if (err instanceof NoValidFieldsWhenUpdatingError) {
    err.statusCode = 400;
  }
  ...
});
```

**但这里有个更值得你想一下的设计问题,顺手一起处理:**

`NoValidFieldsWhenUpdatingError` 和 `UserValidationError` **状态码都是 400**——一个是"没有有效字段可更新",一个是"字段值不符合校验规则",两者语义上其实都属于"客户端提交的数据有问题"。**你要不要干脆直接复用 `UserValidationError`,而不是新建一个类?**

- **新建一个专门的类**:好处是错误类型更精确(以后如果想给"没有效字段"这种情况单独加日志、单独统计,更方便区分)。
- **复用 `UserValidationError`**:好处是少一个类要维护、少一处要在 app.js 里注册,而且反正状态码相同、语义也算是同一大类("请求数据不合法")。

**这个我不替你定,但提醒你:这正是"每加一个新的领域错误类,都要记得在 app.js 里同步注册"这件事的维护成本**——类越多,越容易在某处漏掉(就像这次)。如果这种"我要不要新建一个错误类"的判断经常出现,你可以考虑:错误类别不用分得太细,归到几个大类(比如"校验类错误"统一用 `UserValidationError`),减少这种"忘记注册"的机会。这个取舍你来定。

---

**先去 `app.js` 确认是不是漏了这个分支,加上(或者决定复用现有类),然后重新测一次 PATCH 空对象/无有效字段的 case,确认这次是 400 而不是 500。** 确认结果告诉我。

确实是 app.js 中没引入

找到了就好——这正是"新建错误类"这个动作里最容易漏的一步,你自己揪出来了。

补上就行:`import` 这个新类,在错误中间件里加判断分支,给它赋 400(或者你决定改用复用 `UserValidationError` 也行,你自己权衡后选一个)。改完重新测一次 PATCH 传空对象或全是垃圾字段,确认这次是 400 而不是掉进 500。

顺手把这次踩的坑记一句进笔记(或者 TODO 里),它比这次具体的 bug 更值钱:**"每新建一个领域错误类,必须同步在 app.js 错误中间件里注册 instanceof 分支,否则会静默掉进 500。"** ——这条经验你已经在实践中撞出来了,值得留住,以后加第四个、第五个错误类时,这会是你的自查清单第一条。

改完测过之后,白名单挪 service 这件事就彻底收口了——service 现在真正装进了第一块业务逻辑,而且是你自己想明白"这该归 service"之后主动做的。这算是今天最后一块拼图。

今天这一整天,从热身到测试清单到 U/D 到优雅关闭到校验中间件重构再到这次错误注册的坑,外加一场 Docker 事故,量非常大、也非常扎实。改完确认没问题,今天真的可以收工了。

抱歉,我确实提过一处可以优化,但没讲完就被 Docker 那件事打断了,漏了收尾——欠你的,现在补上。

我说的优化点是:**`NoValidFieldsWhenUpdatingError` 要不要干脆别新建,直接复用 `UserValidationError`。**

**理由回顾:**

这两个错误在语义上是同一类东西——都是"客户端提交的数据不符合要求",状态码都是 400。区别只是触发原因不同(一个是"字段值本身不合法",一个是"压根没给任何有效字段")。**从调用方(前端/客户端)的角度看,这两种情况它拿到的处理方式是一样的:400,提示用户"你的输入有问题",没有本质区别。**

**新建一个专门类的代价,你这次已经亲手体会到了:** 每多一个领域错误类,就多一处要在 `app.js` 里注册 `instanceof` 分支——你这次就漏了这一步。**类越多,这种"忘记注册"的风险点就越多。**

**所以我的建议(不是必须,是个可以考虑的简化):**

把 `NoValidFieldsWhenUpdatingError` 这个类删掉,在 service 里直接抛 `UserValidationError`:

```js
if (Object.keys(updateData).length === 0) {
    throw new UserValidationError('No valid fields provided to update');
}
```

这样少一个类、少一处要在 app.js 注册的地方,而且语义上完全说得通——"没有有效字段"本来就是一种"校验没通过"的情况,归进 `UserValidationError` 不牵强。

**这不是强制的,是个取舍。** 你如果觉得"以后我想单独统计有多少请求是因为'没有效字段'被拒的,跟因为'字段格式错'被拒的分开看",那保留专门的类也有道理。**这个决定你来做**——两种都对,我只是想让你看到"少建一个类,能换来少一处维护成本"这个权衡摆在你面前。

要改的话很简单:删掉 `NoValidFieldsWhenUpdatingError` 这个类和它在 app.js 里刚加的分支,service 里改成抛 `UserValidationError`。不想改也完全可以,现在这版能跑、逻辑对,只是多了一个类要维护。
