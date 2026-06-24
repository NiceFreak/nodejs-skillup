**Day 2 上午任务:增、改、删 + 更新操作符**

**第一组 · 增(Create)**
1. 用 `insertOne` 插入一个新人:name 叫 Frank,age 33,city 是 Guangzhou,score 80。
2. 回想昨天:`insertMany` 和 `insertOne` 的区别是什么?(口头答即可)
A: insertMany 同时插入多条数据, insertOne 插入一条数据
    db.practice.insertOne({ name: "Frank", age: 33, city: "Guangzhou", score: 80 })

**第二组 · 改(Update)——今天的重点**
更新必须用**操作符**,这是最容易踩坑的地方。
3. 把 Frank 的 score 改成 90。提示:`updateOne(筛选, { $set: { 字段: 新值 } })`。
    A: db.practice.updateOne({ name: "Frank" }, { $set: { score: 90 } })
4. 给 Alice 的 age 加 1(从 30 变 31)。提示:新操作符 `$inc`(increment,自增),`{ $inc: { age: 1 } }`。
    A: db.practice.updateOne({ name: "Alice" }, { $inc: { age: 1 } })
5. 给 Bob 的 tags 数组追加一个 "vip"。提示:新操作符 `$push`。
    A: db.practice.updateOne({ name: "Bob" }, { $push: { tags: "vip" }  })
6. **关键验证**:故意写一条**不带操作符**的更新——`db.practice.updateOne({ name: "Carol" }, { age: 99 })`,跑跑看会发生什么。(这条是让你踩坑用的,看完报错或结果再往下。)
    MongoInvalidArgumentError: Update document requires atomic operators
    at new UpdateOneOperation (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:2:5962015)
    at Collection.updateOne (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:2:5776006)
    at CompassServiceProvider.updateOne (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:132242)
    at Object.updateOne (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:694319)
    at Proxy.updateOne (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:595954)
    at async Proxy.updateOne (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:682513)
    at async Proxy.<anonymous> (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:684619)
    at async Proxy.<anonymous> (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:685010)
    at async evalmachine.<anonymous>:71:25
    at async ShellEvaluator.innerEval (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:857280)
    at async ShellEvaluator.customEval (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:857468)
    at async OpenContextRuntime.evaluate (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:10278)
    at async ElectronRuntime.evaluate (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:139:11635)
    at async evaluate (file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:2:6571066)
    at async file:///Applications/MongoDB%20Compass.app/Contents/Resources/app.asar.unpacked/node_modules/@mongosh/node-runtime-worker-thread/dist/worker-runtime.js:2:6566710

对,你触发的正是这个坑——`updateOne` 的第二个参数**必须带操作符**,你只给了 `{ age: 99 }` 这种纯数据、没有 `$set`,MongoDB 就报错 `Update document requires atomic operators`(更新文档需要原子操作符)。
先解释这个报错在说什么,再说它为什么是这么设计的:
**"atomic operators"指的就是 `$set`、`$inc`、`$push` 这类带 `$` 的更新操作符。** MongoDB 要求你**明确说出你要对文档做什么动作**——是设置某个字段($set)、是自增($inc)、还是往数组追加($push)。你直接写 `{ age: 99 }`,等于没说动作,只丢了一坨数据,MongoDB 不知道你想干嘛,所以拒绝。
**为什么卡得这么死?这其实是 MongoDB 在保护你。** 你可能以为 `{ age: 99 }` 的意思是"把 age 改成 99",但在旧版本的语义里,这种不带操作符的写法会被理解成"**用 `{ age: 99 }` 整个替换掉原来的文档**"——也就是说 Carol 的 name、city、score、tags **全没了**,只剩一个 `{ age: 99 }`。这是个灾难性的误操作。新版本干脆直接报错,逼你写清楚意图,就是为了防止你不小心把整条数据冲掉。
所以这个报错不是刁难,是一道安全闸。记住这个对比:
- `{ $set: { age: 99 } }` → 只改 age,其他字段不动 ✅(你要的)
- `{ age: 99 }` → 想整个替换(危险),新版直接拦下 ❌
现在你把第 6 条改对——加上 `$set` 让它正常工作:
```js
db.practice.updateOne({ name: "Carol" }, { $set: { age: 99 } })
```
跑通后,再回头把第 3、4、5 条做了(Frank 的 score 改 90、Alice 的 age 用 `$inc` 加 1、Bob 的 tags 用 `$push` 追加 "vip")。这三条分别练 `$set`、`$inc`、`$push`,把三个最常用的更新操作符一次过手。做完发我。
    A: db.practice.updateOne({ name: "Frank" }, { $set: { score: 90 } })
        db.practice.updateOne({ name: "Alice" }, { $inc: { age: 1 } })
        db.practice.updateOne({ name: "Bob" }, { $push: { tags: "vip" } })
7. $inc 也能做减法。 把 Dave 的 score 减 5。提示:$inc 没有专门的减法,负数就是减——{ $inc: { score: -5 } }。你试试。
    A: db.practice.updateOne({ name: "Dave" }, { $inc: { score: -5 } })
8. updateMany 批量更新。 把所有 Guangzhou 的人,都加一个字段 region: "South"。提示:updateMany(筛选, { $set: {...} }),和 updateOne 唯一区别是它会更新所有匹配的文档,不只第一条。注意这里 $set 一个原本不存在的字段会怎样——它会新增这个字段(MongoDB 文档不要求结构统一,这点和关系型很不一样)。
    A: db.practice.updateMany({ city: "Guangzhou" }, { $set: { region: "South" } } )
**第三组 · 删(Delete)**
9. 删掉 Frank。提示:`deleteOne(筛选)`。
    A: db.practice.deleteOne({ name: "Frank" })
10. 思考:`deleteOne` 和 `deleteMany` 的区别,以及为什么生产环境用 `deleteMany` 要格外小心?(口头答)
    A: deleteOne 只删除符合筛选条件下的一条数据, deleteMany 则是删除符合条件的所有数据, 如果删除是不可撤销的, 在生产环境中应当绝对禁用

补充: "绝对禁用"稍微说得满了。deleteMany 在生产里是**会用**的(比如清理过期数据、批量删除某用户的所有记录),不是禁用,而是要**带着保护机制用**。真正的危险不是 deleteMany 本身,而是:
**最致命的坑是筛选条件写错或写空。** 比如你想删某个用户的数据,本来该写 `deleteMany({ userId: "X" })`,结果手滑写成 `deleteMany({})`——空条件匹配**所有文档**,整个 collection 瞬间清空。这跟你刚才更新时那个"原子操作符"的保护是同一类问题:破坏性操作必须意图明确。
所以生产环境的实际做法是:删之前先用**同样的筛选条件跑一次 `find` 或 `countDocuments`**,看看到底会命中多少条、是不是你预期的数量,确认无误再把 find 换成 deleteMany。这就把"删错"挡在执行之前了。