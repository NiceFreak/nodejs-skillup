Q1: **任务:不看昨天和上午的任何记录,从零完成下面这套。** 卡住了先自己想、查官方文档,实在过不去再来问 AI,但问的是"为什么",不是"语法是什么"。

1. 新建一个全新的 collection `rebuild`,自己造 5 条数据(字段自己定,但要包含:一个数字字段、一个数组字段)。
2. 查出数字字段大于某值的文档。
3. 查数组字段包含某个值的文档。
4. 查询并只返回其中两个字段、去掉 `_id`。
5. 用 `$set` 修改某条数据的一个字段。
6. 用 `$inc` 给某条数据的数字字段加 1。
7. 用 `$push` 给某条的数组字段追加一个值。
8. 删掉其中一条数据。

八条覆盖了你这两天学的全部:增、查(条件/数组/投影)、改(三个操作符)、删。

**验收标准:全程不回看提示和笔记,能独立写完并跑通。** 哪一条你卡住了、要回去翻笔记才想得起来,那一条就是你还没真正掌握的——把它标记下来,那才是值得回头补的点。

这个练习的意义就是你那条规矩的核心:**能脱离 AI 从空白重建,才算真的会,而不是趁热记住。** 现在开始,做完把你写的八条命令一起发我,我只看哪里有问题、哪里可以更好,不提前给你任何提示。

db.createCollection("rebuild") // 搜索了创建 collection 的语法
db.rebuild.insertMany([
    { orderId: 1, amount: [1, 2, 3, 4, 5] },
    { orderId: 2, amount: [3, 4, 5, 6, 7] },
    { orderId: 3, amount: [7, 8, 9, 10, 11] },
    { orderId: 4, amount: [10, 11, 12, 14, 15] },
    { orderId: 5, amount: [0, 2, -1, 14, 5] },
])
db.rebuild.find( { orderId: { $gt: 2 } } ) // 翻看了 $gt 的用法
db.rebuild.find( { amount: 5 } )
db.rebuild.find( {}, { orderId: 1, amount: 1, _id: 0 } )
db.rebuild.updateOne({ orderId: 1 }, { $set: { amount: [3, 4, 5, 6, 7] } }) // 翻看了 $set 的用法
db.rebuild.updateOne({ orderId: 5 }, { $inc: {orderId : 1} })
db.rebuild.updateOne({ orderId: 6 }, { $push: { amount: 99 } }) 
db.rebuild.deleteOne({ orderId: 6 }) 
存在问题: orderId 作为主键不能乱改

Q2: 这次专练"更新",目标是把刚才那两个坑(改错对象、$set 翻笔记)填平。还是从空白来,但我把规则收紧一点,逼出真正的脱手。

**先重置一下数据**(刚才 rebuild 被你改乱了,清掉重来,字段这次起得名副其实):

```js
db.rebuild.drop()
db.rebuild.insertMany([
  { userId: 1, name: "Alice", score: 50, tags: ["new"] },
  { userId: 2, name: "Bob",   score: 60, tags: ["new"] },
  { userId: 3, name: "Carol", score: 70, tags: ["vip"] }
])
```

**然后不看任何笔记和提示,独立完成下面五条更新任务。** 这次的核心纪律:**永远用 userId 定位(它是稳定标识,不准改它),要改的是 score、name、tags 这些业务字段。**

1. 把 Bob(userId 2)的 score 设为 65。
2. 给 Carol(userId 3)的 score 加 10。
3. 给 Alice(userId 1)的 score 减 5。
4. 给 Bob(userId 2)的 tags 追加一个 "active"。
5. 把 Alice(userId 1)的 name 改成 "Alicia"。
**额外要求,做完每一条都用 find 验证一次**——这正是我上午说的"写操作前后用 find 确认"的习惯,这次开始养成。比如改完第 1 条,`db.rebuild.find({ userId: 2 })` 看 score 是不是真的 65。
五条里,第 1 和第 5 练 `$set`(一个改数字、一个改字符串),第 2、3 练 `$inc`(加和减),第 4 练 `$push`。全程别回看笔记。
    1. db.rebuild.updateOne({ userId: 2 }, { $set: { score: 65 } })
        db.rebuild.find({ userId: 2 })
    2. db.rebuild.updateOne({ userId: 3 }, { $inc: { score: 10 } })
        db.rebuild.find({ userId: 3 })
    3, db.rebuild.updateOne({ userId: 1 }, { $inc: { score: -5 } })
        db.rebuild.find({ userId: 1 })
    4. db.rebuild.updateOne({ userId: 2 }, { $push: { tags: "active" } })
        db.rebuild.find({ userId: 2 })
    5. db.rebuild.updateOne({ userId: 1 }, { $set: { name: "Alicia" } })
        db.rebuild.find({ userId: 1 })