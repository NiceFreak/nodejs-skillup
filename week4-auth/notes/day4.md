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

流程：请求授权 / 阶段：D4 最小 RBAC / 设计点 1：401 语义
只回答 401，不回答 403：
访问受保护接口时，哪些情况应该返回 401 Unauthorized？
请用一句判断标准 + 2 到 4 个例子回答。

401 Unauthorized: 凭证有问题/无凭证
举例:
1. 未携带 authorization 字段
2. authorization 携带, 但是格式有问题
3. token 过期
4. 用户未注册, 
5. 在我们当前的场景下, 2000 个无密码用户也会报 401

AI 检查:

- 判断标准“凭证有问题 / 无凭证”成立。
- 例 1–3 属于“访问受保护接口”的 401：未携带 Authorization、Authorization 格式错误、token 过期 / 无效。
- 例 4 需要补前提：只有当前认证 / 授权链路会根据 token 的 `sub` 查库，并发现用户不存在时，才属于访问受保护接口的 401；当前 D3 的 `validateToken` 不查库，只验证 token 本身。
- 例 5 属于登录凭据验证阶段的 401（用 email/password 换 token 失败），不是访问受保护接口阶段的 401。后续问答要继续区分“登录-凭据验证”和“请求认证 / 授权”两个流程。

流程：请求授权 / 阶段：D4 最小 RBAC / 设计点 2：403 语义
现在只回答 403：
当客户端访问一个受保护接口时，什么情况下应该返回 403 Forbidden？
请用一句判断标准 + 2 到 4 个例子回答。重点区分：
401：我不能确认你是谁
403：我确认你是谁，但你不能做这件事

回答: 我们当前已实现的内容中, 我能想到的 403 场景较少, 最可能发生的是, 我们后续把订单查询完善后,登录 A 用户后, 如果用这个账户去查询别人的订单, 就报 403. 但是这也和我之前的实际工作不符: 我之前所在的大型电商项目中, 有专门的访客订单查询页: 只要能提供具体订单号和手机/邮箱等凭据, 查询操作不会被阻拦.因此这个问题我需要更明确的指导

检查结论：你的回答方向是对的，而且这里主动要求指导是合理的。

你已经抓住了 403 的核心：

```text
能确认你是谁，但你没有权限访问这个资源或执行这个动作。
```

你举的例子也成立：

```text
登录 A 用户，访问 B 用户的订单详情 → 403
```

但你提到“访客凭订单号 + 手机/邮箱查订单”也很重要，它说明：**403 不是看资源是不是别人的，而是看当前接口契约允许谁用什么凭据访问。**

也就是说：

```text
接口 A：/me/orders/:id
契约：只能登录用户访问自己的订单
A 用户查 B 用户订单 → 403

接口 B：/guest/orders/query
契约：允许访客凭订单号 + 手机/邮箱查询
未登录但凭据匹配 → 200
凭据不匹配 → 可能 404 / 400 / 401，取决于契约
```

所以 403 的判断标准可以写成：

```text
身份已经确认，但根据当前接口的授权规则，这个身份没有权限访问目标资源或执行目标动作。
```

常见例子：

```text
普通用户访问 admin-only 接口
A 用户访问 B 用户的私有订单
member 用户执行 seller / admin 才能执行的操作
token 有效，但角色不满足路由要求
```

这不是和你实际工作冲突，而是**接口契约不同**。大型电商的访客查单页本质上是另一个授权模型：它不是“无权限也给查”，而是“订单号 + 手机/邮箱”被设计成这条接口的访问凭据。

下一步我们定 D4 最小 RBAC 的范围：先选一种规则做。我的建议是先做 **角色型 403**，比资源归属型更适合今天最小闭环。

但是我们目前没有 role

对，这就是现在进入 RBAC 前必须先定的设计点：**可信角色来源**。

目前没有 `role`，所以不能凭空做“admin-only”。我们有三个选择：

```text
方案 A：给 User model 增加 role 字段
方案 B：临时把 role 放进 JWT
方案 C：先不做角色型 RBAC，改做资源归属型授权
```

我建议今天选 **方案 A：User model 增加最小 role 字段**，但只做最小：

```text
role: 'member' | 'admin'
默认 member
```

理由：

- RBAC 本来就是 Role-Based Access Control，没有 role 就只能做“资源归属授权”，那不是典型 RBAC
- 把 role 放 JWT 会引入“角色变更后旧 token 仍然有效”的快照问题，今天会分散注意力
- 从数据库查当前用户 role 更符合“可信来源来自服务端持久化状态”
- 默认 `member` 可以兼容现有注册用户

但这属于 W4 黑名单里的 RBAC 设计，我不能直接替你写实现。我们先只定契约。

**流程：请求授权 / 阶段：D4 最小 RBAC / 设计点 3：可信角色来源**

请你回答：

今天最小 RBAC 中，角色应该从哪里来？

```text
A. JWT payload 里的 role
B. 数据库 User.role
C. 请求体 / query / header 里客户端传来的 role
```

你选哪个？为什么另外两个不适合？

回答: 我选 B, 放在数据库中才是最合理的方案,在 User Schema 中增加 role 字段. 对于 C , 服务端不能直接相信前端发来的数据, 所有内容都要校验. 对于 A, 放在 JWT 中签发,那在过期前角色都固定了, 如果要改动, 我们又要延伸出一大段代码. 这是我判断的理由.

检查结论：可以通过。

你的选择和理由都成立：

```text
选 B：数据库 User.role
```

理由完整：

- C 不可信：客户端传来的 `role` 可以伪造，不能作为授权依据
- A 有快照问题：JWT 一旦签发，`role` 在过期前固定；角色变更不能实时生效，除非引入 token version、查库、denylist、缩短有效期等额外机制
- B 更可信：角色来自服务端持久化状态，授权时查当前用户角色

补一个小边界：**“所有内容都要校验”不等于“所有内容都可信”**。请求体里的 role 即使格式校验通过，也只能说明它长得像 role，不能说明用户真的拥有这个 role。

所以今天契约可以定为：

```text
角色来源：数据库 User.role
角色集合：member / admin
默认角色：member
授权判断：token 只证明 sub；后续授权用 sub 查数据库当前 role
```

下一步设计点：**最小 RBAC 放在哪一层做**。  
这一步很关键，因为“角色型路由权限”和“资源归属权限”位置不一样。

回答: 新增一个中间件, 在 validateToken 之后, 进入 Controller 之前调用. 符合我们当前的分层和 Express 的拓展性, 改动也较小. 

检查结论：你的回答**对一半，可以作为今天最小 RBAC 的方案通过**，但要补清边界。

你说：

```text
新增一个中间件，在 validateToken 之后、Controller 之前调用
```

这适合处理：

```text
角色型、路由级权限
```

例如：

```text
GET /admin/reports
需要 admin
validateToken → requireRole('admin') → controller
```

因为它只需要知道：

```text
当前用户是谁
当前用户 role 是什么
这个路由要求什么 role
```

但它不适合处理所有授权问题。比如：

```text
A 用户访问 B 用户订单
```

这类是**资源归属权限**，通常要查具体订单属于谁，判断应放在 service 层更合适：

```text
validateToken → controller → service 查订单并判断 owner
```

所以今天的契约要写得更精确：

```text
D4 最小 RBAC 只做角色型路由权限：
validateToken → requireRole('admin') → controller

资源归属授权暂不做，后续放 service 层。
```

这样你的方案就是成立的，而且范围收得住。下一步可以开始设计最小代码结构了，但我只能给 L2 骨架，不给完整实现。

很好，这里先补概念，不急着写代码。

**先分清三个词**

```text
认证 Authentication：你是谁？
授权 Authorization：你能做什么？
RBAC：授权的一种方式，用“角色”判断权限
```

你现在已经有了认证：

```text
validateToken
→ 验证 JWT
→ 得到 req.auth.sub
→ 回答“你是谁”
```

接下来授权要回答：

```text
这个已认证用户，能不能访问这个接口 / 资源 / 动作？
```

**授权常见两类**

第一类：**角色型授权**

判断依据是“你的角色够不够”。

```text
admin 可以访问后台报表
member 不可以访问后台报表
```

特点：

```text
只需要知道用户 role
不需要知道某条具体资源属于谁
适合放在路由中间件
```

链路像这样：

```text
validateToken
→ requireRole('admin')
→ controller
```

例子：

```text
GET /admin/reports
DELETE /admin/users/:id
POST /products
```

如果 token 有效，但用户 role 是 `member`，访问 admin-only 接口：

```text
403
```

第二类：**资源归属授权**

判断依据不是“你是什么角色”，而是“这个资源是不是你能操作的”。

```text
A 用户只能看自己的订单
B 用户不能看 A 用户的订单
```

特点：

```text
必须查具体资源
需要知道订单 owner / userId / tenantId
通常放 service 层
```

链路像这样：

```text
validateToken
→ controller
→ service 查订单
→ service 判断 order.userId 是否等于 req.auth.sub
```

例子：

```text
GET /me/orders/:orderId
PUT /me/addresses/:addressId
DELETE /me/payment-methods/:id
```

如果 token 有效，但订单属于别人：

```text
403
```

**为什么资源归属不适合普通中间件**

因为普通中间件通常只看：

```text
req.auth
req.params
req.body
```

但它不知道：

```text
这个 orderId 对应的订单到底属于谁
这个地址是不是当前用户的
这个资源是否已经被删除
```

这些都要查数据库，而查资源、解释业务状态，本来就是 service 的职责。

**今天最小 RBAC 做哪种**

今天建议只做第一类：

```text
角色型授权
```

也就是：

```text
User.role = member/admin
validateToken 负责认证
requireRole('admin') 负责路由级授权
```

暂时不做：

```text
A 用户访问 B 用户订单
```

因为那是资源归属授权，不是今天的最小 RBAC。

你可以把今天的边界记成：

```text
D4 RBAC 只解决“这个角色能不能进这个接口”
不解决“这个用户能不能操作这条具体资源”
```

好的, 那我们先实现 role 的引入, 以及中间件的实现, 具体接入哪个 api 或者新增配合验证的 api,放在下一步

合理，而且这个拆法是对的。

你现在的规划是：

```text
先实现 role 字段
先实现授权中间件
暂时不接入具体 API
下一步再决定接哪个 API 或新增验证 API
```

我认为这是合理的，原因有三点：

1. **它把“能力准备”和“业务接线”分开了**  
   `role` 和 `requireRole` 是授权基础设施；接哪个 API 是业务契约。分开做能避免一边想模型、一边想接口场景，脑子里搅成一团。

2. **它符合最小 RBAC 的推进顺序**  
   先有可信角色来源：

   ```text
   User.role
   ```

   再有通用授权判断：

   ```text
   validateToken → requireRole(...)
   ```

   最后才决定：

   ```text
   哪条路由需要 admin
   ```

3. **它暂时不扩大资源归属授权范围**  
   你没有跳去做“用户只能查自己的订单”，这是好的。那会引入资源 owner、service 层判断、订单接口契约，今天会变大。

需要注意的边界：

```text
中间件不接入 API 时，暂时无法完整验证 403 行为
```

所以它只能算“结构准备完成”，不能算“RBAC 闭环完成”。D4 验收仍然需要下一步至少接一条路由或测试用临时路由，让：

```text
member → 403
admin → 200
```

跑通。

我的判断：

```text
规划合理，可以进入实现。
```

但实现时范围要卡住：

```text
只加 role 字段
只加查当前用户 role 所需的最小 repository 能力
只加 requireRole 中间件
不改 JWT payload
不做资源归属授权
不扩展权限表 / permission model
```

这一步你自己写；写完我 review。

**Review 结论**

有 1 个阻断性问题，修完后可以接入。

**🔴 阻断性**

[validateRoleMiddleware.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/middlewares/validateRoleMiddleware.js:20) 把所有异常都转成了 `AuthorizationError`，也就是 403。

这会把不同类型的问题混成“权限不足”：

```text
数据库查询失败 → 现在会变 403
userId 格式异常导致查询报错 → 现在会变 403
代码 bug / repository 抛错 → 现在也会变 403
```

这属于错误分层会误导调用方。403 只能表达：

```text
身份已确认，但 role 不满足要求
```

不是“授权过程中任何异常”。建议你自己改成：

```text
role 查询正常完成，但 role !== requiredRole → AuthorizationError / 403
role 查询本身抛错 → 交给全局错误处理，不要伪装成 403
```

另一个边界也建议一起想清楚：`req.auth.sub` 不存在时，更像认证前置条件没满足，应偏向 401 或开发接线错误，而不是 403。

**🟡 锦上添花**

[repositories/users.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/repositories/users.js:16) 的 `findUserRoleById` 返回 `role | null`，对于今天够用。代价是中间件无法区分：

```text
用户不存在
用户存在但 role 缺失
```

当前最小 RBAC 可以先接受；后续如果要更精确区分 401/403 或记录安全日志，再返回用户摘要会更清楚。

[models/users.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/models/users.js:23) 的 `role` 字段设计是合理的：`enum + default member`，可以兼容新注册用户。老用户读取时是否自动有默认值，后面接 API 验证时要实际确认一下。

**能否接入**

现在**不建议直接接入**，先修 catch 里把所有错误变 403 的问题。修完后可以接入一条最小路由验证：

```text
validateToken → requireRole('admin') → controller
```

验证已跑：

```text
npm run lint
0 errors, 9 existing warnings

npm test -- --runInBand
2 suites, 6 tests passed
```

如果现在就要验收，我会因为错误分层问题不通过；修完这个点，基础结构就可以进入接线阶段。

阻断性问题已修掉，可以进入接入阶段。

**Review 结论**

无阻断性问题，可以验收当前“role 引入 + 授权中间件基础结构”。

你现在的中间件分层是对的：

```text
req.auth 缺失 → AuthenticationError → 401
role 查询成功但不匹配 → AuthorizationError → 403
数据库异常 / 查询异常 → 原样 next(err) → 全局错误处理
```

这比上一版正确，避免了把系统异常伪装成 403。

**锦上添花**

`findUserRoleById` 现在返回 `role | null`，够今天用。代价是暂时不区分“用户不存在”和“用户存在但 role 异常/缺失”。最小 RBAC 可以接受，后续如果要做更细的安全日志或用户吊销语义，再细化。

`role` 字段 `enum + default member` 合理，可以接入。老数据是否会在查询时拿到默认值，需要接入后用真实请求验证一下。

验证已通过：

```text
npm run lint
0 errors, 9 existing warnings

npm test -- --runInBand
2 suites, 6 tests passed
```

如果现在就要验收，我不会因为剩余问题拦住。下一步可以选择接入方式：接到现有报表 API，或新增一个最小 admin-only 验证 API。

选择方案 A 吧,创建一个 admin 账户,接入到财务报表 api

阻断性问题已修掉，可以进入接入阶段。

**Review 结论**

无阻断性问题，可以验收当前“role 引入 + 授权中间件基础结构”。

你现在的中间件分层是对的：

```text
req.auth 缺失 → AuthenticationError → 401
role 查询成功但不匹配 → AuthorizationError → 403
数据库异常 / 查询异常 → 原样 next(err) → 全局错误处理
```

这比上一版正确，避免了把系统异常伪装成 403。

**锦上添花**

`findUserRoleById` 现在返回 `role | null`，够今天用。代价是暂时不区分“用户不存在”和“用户存在但 role 异常/缺失”。最小 RBAC 可以接受，后续如果要做更细的安全日志或用户吊销语义，再细化。

`role` 字段 `enum + default member` 合理，可以接入。老数据是否会在查询时拿到默认值，需要接入后用真实请求验证一下。

验证已通过：

```text
npm run lint
0 errors, 9 existing warnings

npm test -- --runInBand
2 suites, 6 tests passed
```

如果现在就要验收，我不会因为剩余问题拦住。下一步可以选择接入方式：接到现有报表 API，或新增一个最小 admin-only 验证 API。

方案 A 合理，而且今天建议这样收范围：

```text
创建一个 admin 账号
把两个 /reports API 都接成 admin-only
不新增业务 API
不做资源归属授权
不把 role 放进 JWT
```

**接线顺序**

1. `routes/reports.js`

在现有链路里插入 `requireRole('admin')`：

```text
validateToken
→ requireRole('admin')
→ validateDays/validateMonths
→ validateStatus
→ controller
```

两个报表都可以接，因为它们本质上都是财务/经营报表。接一个也能验证，但接两个契约更一致。

2. admin 账号创建

不要开放“注册时传 role”。注册接口继续默认 `member`，避免客户端自我提权。

建议流程：

```text
先用现有 register 创建一个账号
再用 mongosh 把这个账号 role 改成 admin
```

这是演示/种子数据操作，不是公开 API。

3. 验证路径

至少跑三条：

```text
无 token 请求报表 → 401
member token 请求报表 → 403
admin token 请求报表 → 200
```

这三条能完整证明：

```text
认证失败 ≠ 授权失败
身份有效但角色不足 = 403
admin 角色可访问财务报表
```

**注意点**

- `requireRole('admin')` 必须在 `validateToken` 后面
- 不要让请求体、query、header 里的 `role` 参与授权
- 不要改 JWT payload；token 仍只放 `sub`
- 如果老用户没有 role，按当前设计会被视为非 admin，访问报表 403，这对今天是可接受的

我已按规则把这次 RBAC L2 援助记入 `DEBT.md` 和 `LEARNING-STATE.md`。

当前测试结果:
missing token → 401
memberAccessToken → 403
adminAccessToken → 200