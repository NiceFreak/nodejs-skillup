# Week 1 · Day 2(上午)— 脱手实战练习

> **核心纪律**:不看昨天和上午的任何记录,**从零完成**。卡住先自己想、查官方文档,
> 实在过不去再问 AI——但问的是「**为什么**」,不是「语法是什么」。
>
> 这套练习的意义:**能脱离 AI 从空白重建,才算真的会**,而不是趁热记住。
> 哪一条要回去翻笔记才想得起来,那一条就是还没真正掌握、值得回头补的点。

---

## 练习一:CRUD 全流程综合(collection `rebuild`)

覆盖这两天学的全部:增、查(条件 / 数组 / 投影)、改(三个操作符)、删。

### 题目

1. 新建一个全新的 collection `rebuild`,自己造 5 条数据(含一个数字字段、一个数组字段)。
2. 查出数字字段大于某值的文档。
3. 查数组字段包含某个值的文档。
4. 查询并只返回其中两个字段、去掉 `_id`。
5. 用 `$set` 修改某条数据的一个字段。
6. 用 `$inc` 给某条数据的数字字段加 1。
7. 用 `$push` 给某条的数组字段追加一个值。
8. 删掉其中一条数据。

### 我的作答

```js
db.createCollection("rebuild")            // 搜索了创建 collection 的语法
db.rebuild.insertMany([
  { orderId: 1, amount: [1, 2, 3, 4, 5] },
  { orderId: 2, amount: [3, 4, 5, 6, 7] },
  { orderId: 3, amount: [7, 8, 9, 10, 11] },
  { orderId: 4, amount: [10, 11, 12, 14, 15] },
  { orderId: 5, amount: [0, 2, -1, 14, 5] },
])

db.rebuild.find({ orderId: { $gt: 2 } })          // 翻看了 $gt 的用法
db.rebuild.find({ amount: 5 })                     // 数组字段直接写值 = 包含该值
db.rebuild.find({}, { orderId: 1, amount: 1, _id: 0 })  // 投影
db.rebuild.updateOne({ orderId: 1 }, { $set: { amount: [3, 4, 5, 6, 7] } })  // 翻看了 $set
db.rebuild.updateOne({ orderId: 5 }, { $inc: { orderId: 1 } })
db.rebuild.updateOne({ orderId: 6 }, { $push: { amount: 99 } })
db.rebuild.deleteOne({ orderId: 6 })
```

### 复盘:发现的问题

- **`orderId` 作为主键 / 业务标识不能乱改。** 第 6 步用 `$inc` 把 `orderId` 从 5 改成了 6,
  这等于改掉了这条数据的「身份」。后面第 7、8 步只能去找 `orderId: 6`(那个被改出来的临时身份)才操作得到,逻辑很别扭。
  > **教训**:`$inc` 该作用在**业务字段**(score、amount、库存数量这种),
  > 而不是用来标识一条记录的 ID。**定位用稳定的 ID,改动只改业务字段。**

- **卡点标记**:第 1 步(建 collection)、第 5 步(`$set` 语法)、第 2 步(`$gt`)都翻了资料 —— 这三处是还没脱手的点。
  > 补充:其实 MongoDB **不需要先 `createCollection`**——第一次 `insertOne`/`insertMany` 时,
  > collection 会被**自动创建**。`createCollection` 只在需要预先设定特殊参数(如固定集合、校验规则)时才用得上。

---

## 练习二:专项练「更新」(收紧规则,逼出脱手)

把上面两个坑(改错对象、`$set` 翻笔记)填平。还是从空白来,规则收紧。

### 先重置数据(字段这次起得名副其实)

```js
db.rebuild.drop()
db.rebuild.insertMany([
  { userId: 1, name: "Alice", score: 50, tags: ["new"] },
  { userId: 2, name: "Bob",   score: 60, tags: ["new"] },
  { userId: 3, name: "Carol", score: 70, tags: ["vip"] }
])
```

### 核心纪律

> **永远用 `userId` 定位**(它是稳定标识,不准改它),要改的是 `score`、`name`、`tags` 这些**业务字段**。
> 这正是练习一暴露的问题的针对性矫正。

### 题目与作答(每条改完都用 `find` 验证一次)

> **额外要求**:做完每一条都 `find` 一次确认 —— 养成「**写操作前后用 `find` 确认**」的习惯。

```js
// 1. 把 Bob(userId 2)的 score 设为 65  —— 练 $set(改数字)
db.rebuild.updateOne({ userId: 2 }, { $set: { score: 65 } })
db.rebuild.find({ userId: 2 })

// 2. 给 Carol(userId 3)的 score 加 10  —— 练 $inc(加)
db.rebuild.updateOne({ userId: 3 }, { $inc: { score: 10 } })
db.rebuild.find({ userId: 3 })

// 3. 给 Alice(userId 1)的 score 减 5  —— 练 $inc(减,传负数)
db.rebuild.updateOne({ userId: 1 }, { $inc: { score: -5 } })
db.rebuild.find({ userId: 1 })

// 4. 给 Bob(userId 2)的 tags 追加 "active"  —— 练 $push
db.rebuild.updateOne({ userId: 2 }, { $push: { tags: "active" } })
db.rebuild.find({ userId: 2 })

// 5. 把 Alice(userId 1)的 name 改成 "Alicia"  —— 练 $set(改字符串)
db.rebuild.updateOne({ userId: 1 }, { $set: { name: "Alicia" } })
db.rebuild.find({ userId: 1 })
```

### 本轮收获

- 五条全程**用 `userId` 定位、只改业务字段**,练习一的「改错对象」问题没有再犯。
- 每步 `find` 验证,把「**写操作前后用 `find` 确认**」从知识变成了肌肉记忆。
- 操作符分工再过一遍:`$set` 改值(数字 / 字符串都行)、`$inc` 加减(负数为减)、`$push` 追加数组元素。

---

## 这两个练习共同验证的一条规矩

> **脱离 AI、从空白重建,才算真的会。**
> 翻了笔记的地方就是薄弱点 —— 把它们标出来,那才是值得回头反复练的。
