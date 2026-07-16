# Day 4 · 开工入口与工作文档（2026-07-16）

> 本文件是 D4 的开工入口：第 1 节是今天第一项——自然月边界第一档重建的任务卡；第 2 节是昨晚（D3 深夜）关于投影的讨论整理；第 3 节是配套的动手验证实验；第 4 节接回 RBAC 主线。当天过程直接记在本文件，晚间再按惯例整理成正式笔记。

---

## 1. 第一项：自然月边界第一档重建（还债 ①）

任务卡（对应 `DEBT.md` 2026-07-13 条目）：

```text
范围：滚动窗口 vs 自然月契约、$gte/$lt 半开区间、起点移动 months - 1
档位：第一档——只看自己的一页纸笔记
时长：15–20 分钟
过程：AI 不提示，结束后由 AI 验收
重点：解释相邻区间为何不能重叠
```

**通过标准**（2026-07-15 晚本人自定，已固化进 `AGENTS.md` 重建梯子）：

- 能从原理**当场推导**，而不是复述既有解释。
- 自查发现是在「回忆上次看到的讲解」而非推导时，**自判不过**，按卡档记入 `DEBT.md`——这是梯子的诊断功能在正常工作，不是失败。
- 无论过没过，结束后在本文件记一句：这次用的是哪种通过方式（推导 / 回忆 / 卡档）。

> 按约定，本节只有任务卡，不含任何知识内容——重建结束后，AI 会完整讲解这个主题。

**重建结果记录（开工后填写）**：

- [x] 通过方式：回忆 + 推导；理解 API 的含义后给出论断。
- [x] 验收结论：第一档重建通过。没有实际重写代码不影响本单元通过，因为本次验收目标是能否从自然月契约、`months - 1` 和 `$gte/$lt` 半开区间推导出边界行为；但按 `DEBT.md` 还债标准，仍需补至少一项额外掌握证据后才能把债务状态标为“已还”。

---

## 2. 投影讨论整理（D3 深夜）

### 2.1 检验题与本人回答

**题**：为什么 `select: false` 拦不住 `save()` 返回的文档？

**本人回答（原意）**：Mongoose 的 select 是读写数据时的中间层操作，MongoDB 本身不认这一套、不是原生功能；最终真正的行为发生在 MongoDB 中，所以拦不住返回的文档。类比 virtual DOM 与真实 DOM 的关系。

**判定**：结构对，机制偏。「中间层的规则只在中间层存在，绕过它就不生效」这个判断是对的——它准确解释了 **mongosh 直查看得到 `passwordHash`** 这个现象。但对 save 现象的解释用错了机制，见下面两处修正。

### 2.2 修正一：投影是 MongoDB 原生功能

「MongoDB 不认这一套」不成立。投影本身是数据库原生能力：`db.users.find({}, { passwordHash: 0 })`。Mongoose 做的事是把 schema 里的 `select: false` **编译成原生投影、随每次查询下发**——字段在数据库那头就被裁掉，不是拿回 Node 再删。

准确的分层表述：MongoDB 不知道你的 **schema 规则**（「默认排除」这个策略是 Mongoose 的），但执行排除的**机制**是它原生的。这个区别影响后续推理：若按「先传回来再隐藏」理解，网络开销、covered query 等推导全会跑偏。

### 2.3 修正二：save 返回的是内存对象，写路径没有投影工序

save 返回带 hash 的真正原因：**投影是「读」这条路径上的一道工序，save 是写，全程不存在投影这道工序**。而且严格说，save 返回的文档不是「MongoDB 返回的」——它就是你在 Node 内存里 `new User(...)` 构造的那个对象本身，save 把它送出去落库后原样交还。没有东西「带着 hash 逃过了过滤」，因为压根没发生一次需要过滤的读取。

顺带修正：`select` 只影响**读**，与写无关（本人原表述是「读写数据时的操作」）。

### 2.4 比喻校准：不是 vDOM，更像 axios 默认参数

vDOM 比喻结构上沾边（两层、绕过抽象层规则失效），但方向反了：vDOM 模型里 vDOM 是状态源、负责把变更同步到真实 DOM；而这里 **MongoDB 才是事实源**，Mongoose 是电线上的翻译官，不是被 diff 的镜像。

更贴的比喻（来自本人前端经验）：**axios 实例的默认参数/拦截器**——所有 GET 出去默认带「不要 passwordHash」（服务端照此裁剪 = 原生投影），单次可显式覆盖（`select('+passwordHash')`）；save 的场景则相当于你自己组装的请求体对象，发送成功后它还在你的局部变量里，GET 侧的拦截器与它无关。

### 2.5 底图：一次查询 = 筛选 + 投影 + 游标修饰

```text
筛选（filter）    → 哪些文档入选           find 的第一个参数
投影（projection）→ 入选文档露出哪些字段    find 的第二个参数 / select()
游标修饰          → 顺序与数量             sort / skip / limit
```

三件事都在 MongoDB 服务端完成。归位本周写过的东西：

- `select: false` = Mongoose 层的**默认投影**：生成查询时默认排除该字段。只作用于查询路径 → save 拿到的是内存对象（2.3）；mongosh 不经过 Mongoose，这层默认根本不存在。
- `select('+passwordHash')` = 对默认投影的**单次覆盖**，语义是「默认之上加回这个字段」，不是「只要这个字段」。
- 推论（W3 遗留实验的入口）：投影发生在服务端 → 若查询所需字段全在某个索引里，可以只扫索引不碰文档（covered query，`explain` 的 stage 不同）。等 `match-index-explain.js` 修好后可验证。

---

## 3. 动手验证：findOneAndUpdate 预测实验

**问题**：`findOneAndUpdate` 返回的文档，带不带 `passwordHash`？注意它是「写」操作，但返回的文档是**从服务端读回来的**。

步骤（先预测后验证，预测写下来再跑代码）：

1. 用**旧模型**（「真实行为在 MongoDB，拦不住」）推一个预测：____
2. 用**新模型**（「返回对象是经过服务端读取+投影回来的，还是手里的内存对象？」）推一个预测：____
3. 写约 5 行脚本验证（临时脚本或测试均可，注意别污染真实数据）。
4. 记录哪个模型预测对了；若与直觉不符，回到 2.2 / 2.3 找原因。

**实验结果记录（开工后填写）**：

- [ ] 旧模型预测：
- [ ] 新模型预测：
- [ ] 实际结果：

---

## 4. 重建与实验之后的主线（接 day3 笔记第 14 节）

1. 定义并实现最小 RBAC：区分 401 与 403，确定可信角色来源（token 快照 vs 查库），一个最小角色规则。
2. 自行设计并覆盖 1–2 条关键失败路径测试：无 token、非法/过期 token、权限不足。
3. Login 计时枚举风险至少形成结论（dummy hash / 限流，允许只出结论不落代码）。
4. 响应信封全量迁移仅在主线完成后进行；顺手补 401 的服务端原因日志（day3 笔记遗留项）。

正式开始学习: 

D4 止步条件：401/403 语义可演示并讲清；至少一个接口有角色门槛；关键失败路径有测试覆盖。

请你直接回答这 4 点：
1. 假设今天是 2026-07-16，months=6，月度报表应该覆盖哪些月份？为什么起点要移动 months - 1？
2. 为什么查询区间用 $gte start + $lt end，而不是 $lte end？
3. 相邻自然月区间为什么不能重叠？请举一个边界时间点说明。
4. startDate/endDate 应该在哪一层算？repository 应该只负责什么？

我的回答:
1. 假设今天是 2026-07-16，months=6, 度报表应该覆盖哪些月份 2 - 7 月的报表, 起点移动 months - 1, 是因为我们的查询是一个回溯, 逐渐回退的过程: 假设今天是 2026-07-16, 起始的月份 7 已经包含在里面对应的具体代码是这里:
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

在这个情况下, currentMonthStart 计算出的起始值是 7 月, 之后我们回退到 6, 5, 4, 3, 2, months - 1 = 5, 返回值符合传入的 6 个月报表.
2. $gte, 大于等于, $lt, 小于, 是由左闭右开的半开区间, 是为了精确限定查询范围, 我们查几个月, 就是几个月.
3. 防止同一条数据被重复统计, 假入时间边界是 8.1 00:00:00.000Z, 使用 lt 可以精确避免这类边界条件被统计到 7 月的报表.
4. service 层, 这是业务决定的内容, repository 应该只负责 聚合管道

下一步按 Day4 文档走：findOneAndUpdate 预测实验。先不跑代码，先预测。
问题：findOneAndUpdate 返回的文档，默认会不会带 passwordHash？
请你先写两句预测：
1. 用旧模型推：如果理解成“MongoDB 真实返回什么，Mongoose 拦不住”，你预测会不会带？
2. 用新模型推：如果理解成“这是一次写操作，但返回值是从服务端读回来的文档，会经过查询投影规则”，你预测会不会带？
只要预测，不要先验证。然后我们再跑最小脚本看哪个模型对。
这里的“旧模型”不是指你代码里写过的 `findOne / findAll` 那种 repository 模式。

它指的是你昨晚对 `select: false` 的**旧理解模型**：

```text
Mongoose 是中间层；
MongoDB 才是真实执行者；
MongoDB 不认识 select:false；
所以 Mongoose 拦不住 passwordHash 返回。
```

这个模型能解释一部分现象，比如：

```text
mongosh 直接查库能看到 passwordHash
```

但它解释不了 `save()` 返回为什么带 `passwordHash`，因为 `save()` 返回的不是一次“读查询结果”，而是你 Node 内存里的那个文档对象。

现在我们要用 `findOneAndUpdate` 卡一下边界：

```text
它名字里有 update，是写；
但它的返回值又像一次读出来的文档。
```

所以这里的“新模型”是：

```text
要看返回值来自哪里：
- 如果是手里的内存对象，select:false 不会过滤
- 如果是服务端查询返回的文档，Mongoose 的默认投影可能会参与
```

你现在只需要预测：`findOneAndUpdate` 默认返回的那个文档，更像哪一类。

回答: 
1. 用旧模型推：如果理解成“MongoDB 真实返回什么，Mongoose 拦不住”，你预测会不会带？
按照原有的理解, MongoDB 直接返回了完整文档给 Mongoose, 里面有 passwordHash, 但是我又认定 Mongoose 到 repository 时能把数据清洗干净, 这里是对 nodejs 和 MongoDB 的理解都存在偏差
2. 用新模型推：如果理解成“这是一次写操作，但返回值是从服务端读回来的文档，会经过查询投影规则”，你预测会不会带？
按照新模型理解, select:false 作为 Mongoose 的投影规则, 发到 MongoDB 后会 MongoDB 会将其处理为真实的原生投影语法, 然后返回的文档中, 实际上是处理好的文档, 而我们在服务端还能看到 passwordHash, 则是因为我们的内存中还有这个临时变量(便于我自己理解的前端术语). 所以我预测 findOneAndUpdate 默认返回的那个文档, 实际上是投影后的

验证结果:

```text
defaultHasPasswordHash: false
explicitHasPasswordHash: true
defaultKeys: _id, name, email, addresses, __v
explicitKeys: _id, name, email, passwordHash, addresses, __v
```

结论: `findOneAndUpdate` 虽然是写操作, 但它返回的文档来自服务端读回的结果, 默认会经过 Mongoose 的 `select: false` 投影规则; 显式 `.select("+passwordHash")` 才会把字段加回来。这个实验支持新模型。

API 细节: 当前 Mongoose 提醒 `new` 选项已弃用, 后续示例用 `returnDocument: "after"` 表达返回更新后的文档。

### 3.1 追问整理：`select:false`、`.select("+passwordHash")`、`.save()` 与 API 无状态边界

本段整理一轮临场追问。重点不是新增功能，而是校准 Mongoose 查询投影、写入返回值、HTTP API 无状态之间的边界。

#### `select:false` 与 `.select("+passwordHash")`

确认点：

```text
select:false 是 Mongoose schema 规则
.select("+passwordHash") 是 Mongoose 查询 API
```

修正点：`.select("+passwordHash")` 不是让 Mongoose 从自己的内存里取 `passwordHash`，再和 MongoDB 返回的文档拼接。更准确的过程是：

```text
Mongoose 读取 schema：passwordHash 默认 select:false
→ 生成查询时默认带上“排除 passwordHash”的投影
→ 如果本次查询写了 .select("+passwordHash")
→ Mongoose 覆盖默认排除规则
→ MongoDB 直接返回包含 passwordHash 的文档
→ Mongoose 把返回结果包装成 Mongoose document
```

因此，`+passwordHash` 的含义是：**这次查询允许 MongoDB 把默认隐藏字段也返回**。

#### 注册与登录是两个不同场景

注册链路关注“写入安全凭据”，登录链路关注“读取 hash 验证凭据”。它们共享数据库状态，但不是靠某次请求的内存对象互相传递数据。

```text
注册 API：创建账号，把 passwordHash 入库，不把敏感字段返回客户端
登录 API：显式读取 passwordHash，bcrypt.compare 后签发 token
```

登录查询链路：

```text
HTTP POST /auth/login
→ route 校验请求格式
→ controller 取 email/password
→ service 决定要验证凭据
→ repository 用 findOne(email).select("+passwordHash")
→ MongoDB 返回包含 passwordHash 的用户文档
→ service 用 bcrypt.compare(password, passwordHash)
→ 成功后签发 JWT
→ controller 返回 accessToken + 安全 user 摘要
```

#### API 无状态的准确边界

“每个 API 完全独立、互相不关联”说过头了。更准确的表述：

```text
每次 HTTP 请求在执行过程上是独立的；
但它们可以通过共享持久化状态发生业务关联。
```

可记为：

```text
API 执行无状态
业务数据有状态
职责各负其职
通过数据库、token、外部存储等明确媒介发生关系
```

JWT 也是同一类思路：登录 API 签发 token；受保护 API 不记得“刚刚登录过”，它只验证本次请求带来的 token。

#### `.save()` 的职责与时序

`.save()` 是 Mongoose document 上的方法，核心语义是：

```text
把当前 Node 内存里的 Mongoose document 持久化到 MongoDB
```

常见形态：

```js
const user = new User({
    name,
    email,
    passwordHash,
});

const savedUser = await user.save();
```

关键区分：

```text
new User(...)      → 在 Node 内存里构造 Mongoose document
user.save()        → Mongoose 发起写入，并等待 MongoDB 完成
User.findOne(...)  → 从 MongoDB 读文档，受 select:false 影响
```

`select:false` 不影响 `save()` 返回值，因为它主要作用于查询路径；`save()` 返回的通常仍是当前这个 Mongoose document，因此可能仍带有 `passwordHash`。安全边界不能放在 `select:false` 上，而要放在 service/controller 组装响应时。

#### AI 回答偏差与修正

偏差：AI 先前给出的“简明注册链路”把步骤写成：

```text
repository create 用户，把 passwordHash 写入 MongoDB
→ MongoDB 入库
→ save 返回内存里的 document
```

这个表述混淆了两层语义：从代码调用顺序看，`.save()` 是 Mongoose 方法，发生在 MongoDB 完成入库之前；从 `await save()` 的返回时机看，它要等 MongoDB 写入完成后才 resolve。

修正后的注册链路：

```text
HTTP POST /auth/register
→ route 校验请求格式
→ controller 取 HTTP 输入
→ service 做业务决策：校验密码策略、bcrypt hash
→ repository new User(...) / User.create(...)
→ Mongoose document.save()
→ Mongoose 把写入命令发给 MongoDB
→ MongoDB 完成入库并返回写入结果
→ save() resolve，返回当前 Mongoose document
→ service/controller 组装安全响应，不能把 passwordHash 返回给客户端
```

后续约束：AI 讲跨层链路时必须显式区分三件事，不能为了“简明”把它们压扁：

```text
代码调用顺序：什么时候调用某个方法
职责归属：这个方法属于 Mongoose、MongoDB、Service 还是 Controller
返回值来源：返回的是内存对象、数据库读结果，还是库包装后的 document
```

本次属于概念解释偏差与即时修正，未给黑名单核心实现骨架，不记入 `DEBT.md`；但作为 D4 的 AI 表达偏差记录，后续继续按 `AGENTS.md` 的“一问一个设计点、标注流程与阶段、不预设已掌握领域”执行。
