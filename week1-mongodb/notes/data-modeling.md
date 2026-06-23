# Day 1 · MongoDB 基础与数据建模

> 文档型数据库。`collection` / `document` 可类比关系型的「表 / 行」，但建模思路不同：关系型先规范化拆表、查询时 join 拼回；文档型倾向把「会一起被读取的数据」放在一起，用空间换查询效率（MongoDB 没有高效 join）。

---

## 1. 建模判断框架

**落地手段只有两种：嵌入（embed）和引用（reference）。** 快照是嵌入的一个特殊变体。

| 手段 | 做法 | 典型场景 |
|---|---|---|
| 嵌入 embed | 子数据直接放进父文档 | 一对少、总是一起读、不被共享 |
| 引用 reference | 子数据独立成文档，用 id 关联 | 一对多、可能无上限增长、需独立查询 |
| 快照 snapshot（嵌入的变体） | 复制一份「定格的」数据嵌入，而非实时引用 | 需要固定历史事实（如成交价） |

**关键：「一对多 / 一对少」只是起点，不是判断的全部。** 真正决定用嵌入还是引用，要综合这几个维度：

1. **量级**——是否有上限？无上限增长的数组绝不嵌入（文档有 16MB 上限）。
2. **是否独立查询**——子数据会脱离父数据单独查吗？会 → 倾向引用。
3. **是否被共享**——同一份数据被多个文档引用吗？是 → 倾向引用。
4. **是否需定格历史**——要保留某一刻的事实吗？是 → 快照。

> 反例提醒：收货地址是「一对多」（一个用户多个地址），但因为量级有上限、不独立查、不共享，所以**嵌入**而非引用。只记「一对多就引用」会做出错误设计。

---

## 2. 订单系统三个决策

**决策 1 · 订单 ↔ 用户：引用**
- `ordersCollection` 与 `usersCollection` 分开，每个 order 存一个 `userId` 引用关联。
- 理由：一个用户可有大量订单，且订单数量**无上限增长**，因此每个订单必须是独立 document，不能嵌进用户。

**决策 2 · 用户 ↔ 收货地址：嵌入**
- 收货地址作为一个数组字段**嵌入** user document。
- 理由：地址数量**有上限**（一对少）；总是和用户一起读、不会脱离用户单独查；只属于当前用户、不与他人共享。三个维度都指向嵌入。

**决策 3 · 订单中的商品价格与收货地址：快照**
- 订单创建时，把商品信息和收货地址**复制一份快照**存进订单。
- 理由：保存用户下单那一刻的信息，把交易事实**固定**下来，对抗商品信息之后的变动（涨价、改名）和地址的修改/删除。
- 通常 `productId`（引用，便于跳回商品详情）与 `name`/`price`（快照）**并存**。

---

## 3. 写入类型不可靠 → 需代码层管控

当前版本的 MongoDB Compass 客户端，**数据写入的实际类型由客户端推断**，不可靠。

- 实测：在 Compass Shell 输入 `20.0`，会被存为 **Int32**（客户端把整数值的数优化成了 int），而非预期的 Double。
- 验证过程：用 `$type` 聚合确认真实 BSON 类型（不信界面显示）；构造 `20.5` 和 `Double(20)` 对照，两者均存为 Double，证明 MongoDB 本身能存 Double，int 只是默认推断行为。
- **结论**：类型不能听天由命，需在代码层（第 2 周的 Mongoose Schema）统一管控。
- **直接影响建模**：金额字段（price、totalAmount）**不要用 Double**（浮点精度问题，如 `0.1 + 0.2 ≠ 0.3`）。用 `Decimal128`，或以「分」为单位存整数。

---

## 4. 多对多设计：在线课程平台（学生 ↔ 课程）

**题目**：一个学生可选多门课，一门课有多个学生（典型多对多）。学生可能选 50 门课，热门课可能有 5000 学生——设计要扛得住「无上限数组」。

### 推演过程（记录判断力，而非只记结论）

**初版**：建 `students`、`courses`、`arrangement` 三个 collection；student 存 `courseIds` + `arrangementIds`，course 存 `arrangementIds`，arrangement 为 `{ arrangementId, courseId, studentIds[] }`。
- ✅ 对：引入第三个 collection（中间表）承载关系，没把 5000 学生硬塞进课程。
- ❌ 问题一：student 里 `courseIds` 和 `arrangementIds` 冗余，信息两处记录、需同步。
- ❌ 问题二：arrangement 的 `studentIds[]` 又是无上限数组，热门课会撑爆。

**第二版**：arrangement 改为「一条选课记录一个文档」`{ arrangementId, courseId, studentId }`，消掉无限数组。
- ✅ 无限数组问题解决（迁移自「博客评论：每条评论一个独立文档」的思路）。
- ❌ 但 student / course 仍各留 `arrangementIds` 数组 → 一次选课要写三处，任一处写失败即数据不一致，是 bug 温床。

**最终版**：删掉 student / course 里的 `arrangementIds`，两个本体只管自己的属性，关系只存在 arrangement 一处。

```
student:     { studentId, ...属性 }
course:      { courseId, ...属性 }
arrangement: { arrangementId, courseId, studentId }   // 中间表，只存关系
```

### 核心原则

**中间表（连接表）：关系只存一处，两边本体不存关系，双向查询靠查中间表的不同字段。** 选课时只写一个文档，无同步、无不一致风险。

### 配套查询与索引

```js
db.arrangement.find({ studentId: A, courseId: X })  // A 是否选了 X，一步到位
db.arrangement.find({ studentId: A })               // A 选的所有课
db.arrangement.find({ courseId: X })                // X 的所有学生
```

- `studentId`、`courseId` 两个方向都频繁查 → **都该建索引**。
- 可建 `{ studentId, courseId }` 复合索引 + `unique`，顺带保证「同一学生不能重复选同一门课」。

### 延伸（留印象）

中间表除了存关系，还能挂**关系本身的属性**——选课时间、成绩、出勤。这些既不属于学生本体、也不属于课程本体，而属于「这一次选课」。真实选课系统的成绩就存在这里。

---

## 5. 查询语句速查（自己敲过的）

> 练习数据见文末。`$gt` 大于。

### 筛选（挑哪些文档）

```js
// 等值
db.practice.find({ city: "Guangzhou" })

// 比较：$gt 大于 / $gte 大于等于 / $lte 小于等于
db.practice.find({ city: "Guangzhou", age: { $gt: 28 } })
db.practice.find({ age: { $gte: 25, $lte: 35 } })   // 闭区间，含边界

// 多条件并列 = 且(AND)
db.practice.find({ city: "Guangzhou", score: { $gt: 85 } })

// 数组字段：直接写值，MongoDB 自动在数组里找
db.practice.find({ tags: "vip" })

// $in 多选一：字段匹配数组里任意一个值
db.practice.find({ city: { $in: ["Guangzhou", "Shenzhen"] } })

// $ne 取反（注意：也会匹配"无此字段"的文档）
db.practice.find({ city: { $ne: "Beijing" } })

// $exists 字段是否存在（清洗脏数据常用）
db.practice.find({ score: { $exists: true } })
```

### 投影 projection（控制返回什么字段）

`find` 第二个参数控制返回字段。`1`/`true` = 要，`0`/`false` = 不要。

```js
db.practice.find({}, { name: 1, score: 1 })          // 只要 name、score（但仍带 _id）
db.practice.find({}, { name: 1, score: 1, _id: 0 })  // 显式关掉 _id
```

**结构：** `.find({ 筛选条件 }, { 投影: 1/0 })`

**两条规则：**
- 投影里 `1` 和 `0` **不能混用**——「只要哪些」和「只是不要哪些」是矛盾指令，会报错。
- **唯一例外是 `_id`**：它默认总会返回，可在一堆 `1` 中单独写 `_id: 0` 关掉。

> 踩坑记录：投影写法本身一听就懂，卡了三次都卡在「参数位置」——投影要放第二个参数，第一个参数是筛选条件（要所有人就用空 `{}`）。手感只能靠自己敲错改对长出来。

### 练习数据

```js
db.practice.insertMany([
  { name: "Alice", age: 30, city: "Guangzhou", tags: ["vip", "new"], score: 88 },
  { name: "Bob",   age: 25, city: "Shenzhen",  tags: ["new"],        score: 72 },
  { name: "Carol", age: 35, city: "Guangzhou", tags: ["vip"],        score: 95 },
  { name: "Dave",  age: 28, city: "Beijing",   tags: [],             score: 60 },
  { name: "Eve",   age: 42, city: "Shenzhen",  tags: ["vip", "old"], score: 78 }
])
```

---

## 术语对照（查文档用英文）

| 中文 | 英文 | 备注 |
|---|---|---|
| 投影 | projection | 官方中文文档常不译，搜 `mongodb find projection` |
| 中间表 / 连接表 | junction / join collection | 承载多对多关系 |
| 快照 | snapshot | 定格历史的嵌入 |
| 复合索引 | compound index | 多字段索引 |
