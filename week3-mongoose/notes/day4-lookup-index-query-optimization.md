# Day 4 · 查询优化深挖 · `$lookup` 关联性能与 explain 判读

> 本周查询优化的收官日。核心一句话：**用 explain 看清代价,再针对性优化**。今天把 Day 1 只做过的「单集合 `$match` explain」升级为「带 `$lookup` 的完整管道 explain」,聚焦一个新维度——**关联性能**。过程中先纠正了一个关键认知误区(误以为 `_id` 没索引),再亲眼验证 `_id_` 默认索引存在,最后用 explain 坐实结论:客户消费报表的 `$lookup` 关联 user 主键 `_id`,`collectionScans: 0` + `indexesUsed: ["_id_"]`,走主键索引、零全表扫描,高效。判断 `$lookup` 性能的两个关键字段:**`collectionScans`(应为 0)** 与 **`indexesUsed`(应非空)**。

---

## 1. 热身问题与今日主线

被关联的 `$lookup`(客户消费报表最后一段):

```js
{ $lookup: {
    from: "users",
    localField: "_id",     // $group 后的 _id,即 userId
    foreignField: "_id",   // user 的主键
    as: "userInfo"
}}
```

**热身判断(先自己想):** `foreignField` 是 user 的 `_id`(主键)。user 的 `_id` 有没有索引?这个 `$lookup` 关联时,在 user 那边是**走索引还是全表扫**?

> ⚠️ 我第一次判断**错了**——误以为「`_id` 没专门建过索引 = 没索引」,进而以为这个 `$lookup` 不高效。这是个基础性的概念错误,纠正见第 2 节。

**今日三步走:**

1. 纠正认知:确认 `_id` 默认自带索引(第 2–3 节)。
2. 给带 `$lookup` 的完整管道跑 `explain("executionStats")`,读关联维度(第 4–5 节)。
3. 归纳 `$lookup` 性能的普遍规律(第 6 节);对照实验入 backlog(第 8 节)。

---

## 2. 概念纠偏:`_id` 永远自带索引

**每个 MongoDB 文档的 `_id` 都自带一个索引,而且是唯一索引,自动创建、无法删除。** 这是 MongoDB 的铁律,也是为什么用 `_id` 查文档(`findById`)总是很快。

**为什么容易记反?** 看到 `_id` 就联想到「没写过建索引的代码」,忘了它是**默认自带**的。对比 Day 2 用 `mongoose.set('debug', true)` 时,启动打印过:

```
Mongoose: users.createIndex({ email: 1 }, { unique: true })
```

那是 `email` 的索引——**显式建的**才会打印。`_id` 的索引看不到 Mongoose 建,正因为它**不需要建**:MongoDB 在创建任何集合时自动为 `_id` 建好唯一索引。

**纠正后的心智模型地基:**

- **`_id` 永远有索引**(自动、唯一、删不掉)→ 用 `_id`/主键查或关联,天然快。
- 其它字段(`email`、`userId`、`createdAt`……)**默认没索引**,要自己建(如 Day 1 的 `status_1_createdAt_1`、这里的 `email_1`)。

---

## 3. 亲眼验证:`getIndexes()`

不靠记忆,直接看:

```js
use week2
db.users.getIndexes()
// [
//   { v: 2, key: { _id: 1 },   name: '_id_' },
//   { v: 2, key: { email: 1 }, name: 'email_1', unique: true }
// ]
```

- `_id_`(key `{ _id: 1 }`):MongoDB 自动建的默认主键索引,没写过任何代码它就在。**这就把「_id 没索引」的误判纠正过来了。**
- `email_1 unique: true`:正是 Day 2 debug 时看到的那条 `createIndex`,也是 email 不能重复的原因(唯一约束在数据库层强制)。

**结论:** `$lookup` 关联 user 的 `_id`(主键,有索引)→ 走索引精准定位,不是全表扫。这是最理想的关联方式——**关联主键,天然高效。**

---

## 4. 带 `$lookup` 的完整管道 explain

> 踩坑提醒:前两次跑的 explain 管道**没带 `$lookup`**(还停在只有 `$match → $group → $sort` 的早期版本),自然看不到关联性能。要 explain 的是 Day 2 竖切进 repository 的 `getCustomerSpending` 那个**完整管道**(含 `$lookup + $unwind + $project`)。详见第 7 节。

完整管道 + `.explain("executionStats")`:

```js
[
  { $match: { status: "completed", createdAt: { $gte: /* 30天前 */ } } },
  { $group: { _id: "$userId", orderCount: { $sum: 1 },
              totalSpending: { $sum: "$totalAmount" },
              avgOrderValue: { $avg: "$totalAmount" } } },
  { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
  { $unwind: "$userInfo" },
  { $project: { _id: 0, orderCount: 1, totalSpending: 1, avgOrderValue: 1,
                userId: "$_id", customerName: "$userInfo.name", customerEmail: "$userInfo.email" } },
  { $sort: { totalSpending: -1 } }
]
```

explain 输出很长,但**该看的就三部分**,其余(`slotBasedPlan` 那一大坨底层执行细节)是噪音:

**① `$match` 阶段——沿用 Day 1 的最优索引:**

```
stage: IXSCAN, indexName: "status_1_createdAt_1"
totalKeysExamined: 4, totalDocsExamined: 4, nReturned: 3
```

走的还是 Day 1 建的复合索引 `status_1_createdAt_1`,`IXSCAN`(非 `COLLSCAN`),高效。

**② `$lookup` 阶段——关联性能就看这里(今日题眼):**

```json
"$lookup": { "from": "users", "localField": "_id", "foreignField": "_id", ... },
"totalDocsExamined": 3,
"totalKeysExamined": 3,
"collectionScans": 0,          // ← 关键!零全表扫描
"indexesUsed": [ "_id_" ]      // ← 关键!用了 _id_ 主键索引
```

**③ 尾部 `$project` / `$sort`:** 内存内完成,`usedDisk: false`、`spills: 0`,数据量小无溢写,无需关注。

---

## 5. 判读 `$lookup` 性能:只看两个字段

`$lookup` 阶段有**专门的汇总字段**,不用啃底层执行计划,直接看:

| 字段 | 本次值 | 含义 | 健康标准 |
|---|---|---|---|
| `indexesUsed` | `["_id_"]` | 关联用了哪个索引 | **非空**(空 = 没用索引 = 危险) |
| `collectionScans` | `0` | 关联对被关联集合做了几次全表扫描 | **0**(>0 = 关联字段没索引 = 慢) |
| `totalKeysExamined` / `totalDocsExamined` / `nReturned` | `3 / 3 / 3` | 扫索引键 / 取文档 / 返回条数 | **三数相等 = 零浪费**(同 Day 1) |

**一句话判断 `$lookup` 性能:看 `collectionScans` 是不是 0、`indexesUsed` 里有没有东西。** 本次 `collectionScans: 0` + 用了 `_id_`,满分。

> 💡 这与 Day 1「三数相等 = 最优索引」是同一把尺子,只是从单集合 `$match` 挪到了关联维度。

---

## 6. `$lookup` 性能的普遍规律(面试考点)

`$lookup` 高不高效,**取决于关联的那个 `foreignField` 有没有索引**:

- 关联**有索引的字段**(主键 `_id`、或显式建了索引的字段)→ 走索引 → 高效 ← **本报表这样**。
- 关联**无索引的字段**(user 的 `name`、某个普通字段)→ 全表扫描 → 慢。**这才是 `$lookup` 常见的性能杀手。**

**面试问答定式:**

> Q:「你的 `$lookup` 慢怎么优化?」
> A:「看关联字段(`foreignField`)有没有索引,没有就给它建索引。」

---

## 7. 过程踩坑:连着跑错两次管道

今天状态一般,explain 前后跑错两次,记录以备复盘:

| 现象 | 根因 | 正解 |
|---|---|---|
| explain 里没有 `$lookup` 阶段 | `reports.js` 的管道还是早期版(只 `$match → $group → $sort`) | 换成 Day 2 `getCustomerSpending` 的完整管道(含 `$lookup + $unwind + $project`) |
| 想分析关联却看的是 `command.pipeline` 里没有 `$lookup` 的那版 | 同上,管道本身就没带关联 | 先确认管道内容,再 explain |

> 🔑 教训:explain 前先**核对 `command.pipeline` 段**,确认跑的确实是要分析的那版管道,别对着错的执行计划分析半天。

---

## 8. 本日产出与待办

**已完成(查询优化收官,素材齐了):**

1. ✅ 纠正认知:`_id` 默认自带唯一索引(`_id_`),`getIndexes()` 亲验。
2. ✅ 带 `$lookup` 的完整管道 explain:`collectionScans: 0` + `indexesUsed: ["_id_"]`,坐实「关联主键 = 走索引 = 快」。
3. ✅ 提炼判读法:`$lookup` 性能只看 `collectionScans`(应 0)与 `indexesUsed`(应非空)。

**关键结论(记档):**

> 客户消费报表的 `$lookup` 关联 user 主键 `_id`,explain 显示 `collectionScans: 0`、`indexesUsed: ["_id_"]`,走主键索引、零全表扫描,高效。判断 `$lookup` 性能的关键字段:`collectionScans`(应为 0)和 `indexesUsed`(应非空)。

**本周查询优化整体到此够了:** Day 1 的「加索引前后对比」(`COLLSCAN → IXSCAN`)+ 今天的「`$lookup` 关联性能怎么看」,查询优化笔记的素材已齐。

**待办 / backlog:**

- [ ] **对照实验(入 backlog,今天不做)**:故意关联一个**无索引字段**(如 order 的 `userId`,`db.orders.getIndexes()` 确认它只有 `status_1_createdAt_1`、无 `userId` 索引),explain 看它 `collectionScans > 0` / 全表扫描;再给该字段建索引,explain 看它变快。这是 Day 1「加索引前后」套路用在**关联**上,做出来查询优化笔记就有「关联性能」这个有分量的章节。
