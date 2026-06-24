# Week 1 · Day 2(上午)— CRUD:增、改、删 + 更新操作符

> **今日核心**:所有更新操作都**必须使用「原子操作符」**(`$set` / `$inc` / `$push` 这类带 `$` 的关键字)。
> 这是新手最容易踩的坑,本篇用一个故意写错的例子把它彻底讲透。

---

## 一、增(Create)

### 1. 用 `insertOne` 插入一条新数据

> 要求:name = Frank,age = 33,city = Guangzhou,score = 80。

```js
db.practice.insertOne({ name: "Frank", age: 33, city: "Guangzhou", score: 80 })
```

### 2. `insertOne` 与 `insertMany` 的区别

- `insertOne(doc)`:插入**单条**文档,参数是一个对象 `{}`。
- `insertMany([doc1, doc2, ...])`:插入**多条**文档,参数是一个数组 `[]`。

**扩充**:
- 两者插入时如果没写 `_id`,MongoDB 会自动生成一个 `ObjectId` 作为主键。
- `insertMany` 默认是**有序插入**(`ordered: true`):一旦中间某条出错,后面的就不再插入;
  传 `{ ordered: false }` 可以让它「跳过出错的、继续插剩下的」。
- 返回值里能拿到 `insertedId` / `insertedIds`,需要的话可以用来确认写入结果。

---

## 二、改(Update)—— 今天的重点

> **铁律**:`updateOne` / `updateMany` 的第二个参数**必须带操作符**,不能直接丢一坨数据进去。

### 3. `$set`:设置/修改字段的值

> 把 Frank 的 score 改成 90。

```js
db.practice.updateOne({ name: "Frank" }, { $set: { score: 90 } })
```

### 4. `$inc`:数字自增

> 给 Alice 的 age 加 1(30 → 31)。

```js
db.practice.updateOne({ name: "Alice" }, { $inc: { age: 1 } })
```

`$inc` = increment(自增),专门用来对数字字段做加减。

### 5. `$push`:往数组追加元素

> 给 Bob 的 tags 数组追加一个 "vip"。

```js
db.practice.updateOne({ name: "Bob" }, { $push: { tags: "vip" } })
```

### 6.⚠️ 关键踩坑:不带操作符的更新会报错

> 故意写一条**不带操作符**的更新,看看会发生什么:
> `db.practice.updateOne({ name: "Carol" }, { age: 99 })`

**报错结果**:

```
MongoInvalidArgumentError: Update document requires atomic operators
```

**这个报错在说什么?**

「atomic operators(原子操作符)」指的就是 `$set`、`$inc`、`$push` 这类带 `$` 的更新操作符。
MongoDB 要求你**明确说出你想对文档做什么动作**——是设置某个字段(`$set`)、是自增(`$inc`)、
还是往数组追加(`$push`)。直接写 `{ age: 99 }` 等于没说动作,只丢了一坨数据,MongoDB 不知道你要干嘛,所以拒绝。

**为什么卡得这么死?这其实是 MongoDB 在保护你。**

你以为 `{ age: 99 }` 的意思是「把 age 改成 99」,但在旧版本的语义里,这种不带操作符的写法会被理解成
**「用 `{ age: 99 }` 整个替换掉原来的文档」**——也就是说 Carol 的 name、city、score、tags **全没了**,
只剩一个 `{ age: 99 }`。这是灾难性的误操作。新版本干脆直接报错,逼你写清楚意图,防止把整条数据冲掉。

**记住这个对比:**

| 写法 | 含义 | 结果 |
|---|---|---|
| `{ $set: { age: 99 } }` | 只改 age,其他字段不动 | ✅ 你要的 |
| `{ age: 99 }` | 想整个替换(危险) | ❌ 新版直接拦下 |

**改对后:**

```js
db.practice.updateOne({ name: "Carol" }, { $set: { age: 99 } })
```

### 7. `$inc` 做减法:负数就是减

> 把 Dave 的 score 减 5。

```js
db.practice.updateOne({ name: "Dave" }, { $inc: { score: -5 } })
```

`$inc` 没有专门的减法操作符,**传负数就是减**。

### 8. `updateMany`:批量更新

> 把所有 Guangzhou 的人都加一个字段 `region: "South"`。

```js
db.practice.updateMany({ city: "Guangzhou" }, { $set: { region: "South" } })
```

- `updateMany` 与 `updateOne` 的唯一区别:它会更新**所有匹配**的文档,不只第一条。
- `$set` 一个**原本不存在的字段**时,会直接**新增**这个字段。
  MongoDB 的文档不要求结构统一(无固定 schema),这点和关系型数据库很不一样。

**扩充——更新操作的返回值**:每次 update 都会返回类似
`{ matchedCount, modifiedCount, ... }`,
- `matchedCount`:筛选条件命中了几条;
- `modifiedCount`:实际被改动了几条。
养成看返回值的习惯——如果 `matchedCount` 是 0,说明筛选条件根本没匹配到东西,改了个寂寞。

---

## 三、删(Delete)

### 9. `deleteOne`:删除单条

> 删掉 Frank。

```js
db.practice.deleteOne({ name: "Frank" })
```

### 10. `deleteOne` vs `deleteMany`,以及生产环境的注意事项

- `deleteOne(筛选)`:只删除匹配到的**第一条**。
- `deleteMany(筛选)`:删除**所有**匹配的文档。

**生产环境为什么要格外小心?**

`deleteMany` 在生产里是**会用**的(清理过期数据、删除某用户的全部记录等),并不是禁用,
而是要**带着保护机制用**。真正的危险不是 `deleteMany` 本身,而是:

> **最致命的坑是筛选条件写错或写空。**
> 本该写 `deleteMany({ userId: "X" })`,手滑写成 `deleteMany({})`——
> 空条件匹配**所有文档**,整个 collection 瞬间清空。

这和第 6 条那个「原子操作符」的保护是同一类问题:**破坏性操作必须意图明确**。

**生产环境的实际做法**:删之前先用**同样的筛选条件**跑一次 `find` 或 `countDocuments`,
确认会命中多少条、是不是预期的数量,核对无误后再把 `find` 换成 `deleteMany`。这样就把「删错」挡在执行之前了。

```js
// 删之前先确认命中数量
db.practice.countDocuments({ userId: "X" })
// 数量对得上,再执行删除
db.practice.deleteMany({ userId: "X" })
```

---

## 小结:三个最常用的更新操作符

| 操作符 | 作用 | 例子 |
|---|---|---|
| `$set` | 设置/修改字段的值(字段不存在则新增) | `{ $set: { score: 90 } }` |
| `$inc` | 数字加减(负数为减) | `{ $inc: { age: 1 } }` |
| `$push` | 往数组追加元素 | `{ $push: { tags: "vip" } }` |

**一句话记忆**:**写操作(改/删)前后,用 `find` / `countDocuments` 确认** —— 这是贯穿今天所有内容的安全习惯。
