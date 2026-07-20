# DB 复盘自答稿 · MongoDB / 聚合 / 索引（W3 救回强项）

> 生成日期：2026-07-20 ｜ 配套主问答稿：`interview-prep/backend-qa-sheet.md` 第 4 节
>
> **用法**：这不是拿来读的，是拿来**自测**的。每题先**合上答案、自己讲一遍**，讲不出或讲错的，才是你没复盘固化的点——重点看那些。目标是把数据库从"做过"救回"讲得出"，复盘完就把主问答稿第 4 节的 ⚠️ 定位调回可主动亮的强项。
>
> **一个心态锚**：你在 DB 上最稳的其实是**分层判断力**（管道代码归 repository、业务参数归 service）——那是你 Express 强项的延伸。被追问 DB 细节卡住时，把话往"分层/用指标说话"这套你熟的方法论上引。

---

## 0. 30 秒自测清单（先只看问题，能一句话答上来的打勾）

```text
[ ] 为什么要用聚合管道，而不是 find()？
[ ] $match 为什么要放最前？（两个层面）
[ ] 聚合管道代码放哪一层？业务参数呢？
[ ] $lookup 的结果为什么是数组？怎么处理？
[ ] N+1 是什么？populate 有没有 N+1？
[ ] 查询慢怎么优化？用什么看？
[ ] explain 里哪几个数字相等代表最优？
[ ] _id 有没有索引？
[ ] $lookup 慢怎么优化？
[ ] 复合索引字段顺序怎么定？（ESR）
```

打不到 7 个勾，就按下面逐题复盘。

---

## 1. 聚合基础

### Q1. 为什么用聚合管道，不用 `find()`？
**A:** `find()` 只能对**单个文档**过滤和投影，**做不到跨文档聚合**（把 100 条订单算成一条"总额"）。聚合管道是一条**单向直线的流水线**，数据一站一站往下流，能在流动中分组、统计、关联。
**⚠️ 别用洋葱模型类比**：洋葱模型（Express 中间件）是嵌套包裹、`next()` 前后都能插代码、有"返回"；管道是单向直线，没有返回。

### Q2. 三阶段管道，`$sum: 1` 和 `$sum: "$totalAmount"` 区别？
**A:** `$match`（过滤）→ `$group`（分组统计）→ `$sort`（排序）。`$sum: 1` 是每条加常数 1 = **计数**；`$sum: "$totalAmount"` 是对字段值求和——**字段引用必须带 `$`**（`"$totalAmount"` 取值，`"totalAmount"` 是名字）。聚合是**声明式**，不是 JS 的 `+=` 循环。
**★ 易错**：`$sort` 必须放 `$group` **之后**，因为排序键（总额）是 `$group` 算出来的新字段，之前不存在。`$group` 之后文档形状变了——只剩 `_id` 和新造字段，原始字段没了。

### Q3. `$match` 为什么放最前？
**A:** 两个层面：① **索引层面**——只有 `$match` 是**第一站**时才能吃到集合索引，减少从磁盘/内存读的文档数；② **内存层面**——`$group`/`$sort` 默认在内存跑（超 100MB 报错，除非 `allowDiskUse`），`$match` 提前能大幅减少流入这些"重"操作的文档量。

---

## 2. 聚合分层（★ 你最稳的锚，被追问就往这引）

### Q4. 一整段聚合管道该放哪一层？
**A:** 拆成两件事归位：**那段 `aggregate([...])` 管道代码**是"怎么从库里查"的实现细节 → **repository**（唯一碰数据库的地方，和把 `find()` 放 repository 同理）；**"要一份怎样的报表"**（筛几天、什么状态、要哪些指标）是业务意图 → **service**。判据和 Express 分层同一套：问它是"数据库实现细节"还是"业务规则"。
**具体例子**："最近 30 天"是业务规则，service 持有并算出时间边界 `new Date(Date.now() - days*24*60*60*1000)`，把算好的 `date + status` 传给 repository；repository 只管把参数填进 `$match`，不关心为什么是 30 天。
**⚠️ 我一开始的错**：以为整段管道放 service（因为"它表达了业务要什么"）——漏了它其实含"业务意图 + 具体查询"两部分。

---

## 3. `$lookup` 关联查询

### Q5. `$lookup` 的字段，为什么结果是数组？
**A:** 四个字段：`from`（被关联集合）、`localField`、`foreignField`、`as`（结果放进的新字段）。`$lookup` 按"一对多"设计，结果**永远用数组包着**，哪怕一对一也是 `[{...}]`——所以后面接 `$unwind` 把数组炸成对象，再用 `$project` 裁字段。
**★ 易错三连**：① `from` 填**集合真实名**（Mongoose 把 Model `User` 小写复数化成 `users`），**填错静默返回空数组、不报错**；② `$project` 里其他字段"不写就没有"，唯独 `_id` **不写也在**，要显式 `_id: 0` 排除；③ `$lookup` 不自动 cast 类型，关联键两边类型要一致（seed 时 userId 要存成真 ObjectId）。

---

## 4. populate vs `$lookup` 与 N+1（★★ 你自评最生疏，重点背牢）

### Q6. N+1 是什么？
**A:** 查列表时先查 1 次拿到 N 条，再**对每一条各查 1 次**关联数据，共 **1 + N** 次数据库往返。经典现场是手动天真地循环关联：
```js
const orders = await Order.find();                  // 1 次
for (const o of orders) {
  o.user = await User.findById(o.userId);           // 每条查 1 次 → N 次
}                                                    // 共 1+N 次，灾难
```
它是通用反模式，不是某数据库特有；关系型 ORM 懒加载（`order.user`）也是 N+1 经典发源地。

### Q7. populate 有没有 N+1？（★ 最容易说错的一题）
**A:** **没有。** 现代 Mongoose 的 `populate` 用 **`$in` 批量查**，不是逐条：
```js
User.find({ _id: { $in: [id1, id2, ...] } })        // 1 次批量，非 N 次
```
所以三种做法：手动循环 `findById` = **1+N（有 N+1，灾难）**；`populate` = **1+1（$in 批量，无 N+1）**，代价是 2 次往返而非查询次数；`$lookup` = **1 次**（数据库内部关联）。
**⚠️ 面试别说错**："populate 有 N+1 所以不好"是**错的**。准确说：**手动逐条关联才有 N+1，populate 用 `$in` 避开了**。
**证据（我实测过）**：`mongoose.set('debug', true)` 后跑 populate，14 个订单只发 **2 条查询**，第二条是 `users.find({_id: {$in: [4个id]}})`——而且 Mongoose 还**去重**了（14 单只属 4 个 user，$in 只带 4 个）。

### Q8. populate 和 `$lookup` 怎么选？
**A:** 层级不同是一切差异的根：`$lookup` 是**数据库层**操作、一次返回、能在管道里接 `$group`/`$project` 做聚合裁剪；`populate` 是 **Mongoose（应用层/ODM）**功能、数据库不知道它存在、只"取出引用文档"不聚合、2 次往返。选择：只是取出引用文档 → populate（简洁）；关联 + 聚合统计一体 → `$lookup`。

---

## 5. explain 与索引优化（★★ 你能用数据说话的地方，但细节要复盘）

### Q9. 查询慢怎么优化？用什么看？
**A:** 不靠直觉，用 `.explain("executionStats")` 看硬指标。核心原则一句话：**你查的字段有没有索引**——它贯穿 `$match` 和 `$lookup`，是一件事的两个应用。
**关键指标**：`stage` 是 `COLLSCAN`（全表扫描，没走索引）还是 `IXSCAN`（走索引）；`totalDocsExamined`、`totalKeysExamined`、`nReturned`。
**★ 三数相等 = 最优**：`totalKeysExamined = totalDocsExamined = nReturned` 三者相等 = 每一步零浪费。keys 远大于 nReturned → 索引扫了无用条目；docs 大于 keys → 取了文档又被过滤。
**我做过的对照**：`$match` 加索引前 `COLLSCAN`、扫 14 拿 5（浪费 9）；建 `{status:1, createdAt:1}` 后 `IXSCAN`、`totalDocsExamined` 14→5、三数相等。

### Q10. `_id` 有没有索引？
**A:** **永远有**——每个集合的 `_id` 自带一个**唯一索引**（`_id_`），自动创建、无法删除。所以用 `_id`/主键查或关联天然快。其它字段（email、userId、createdAt）**默认没索引**，要自己建。
**⚠️ 别记反**：看到 `_id` 容易联想到"没写过建索引代码 = 没索引"，错——它是默认自带的，`getIndexes()` 能亲眼看到 `{ key: {_id:1}, name: '_id_' }`。

### Q11. 复合索引字段顺序怎么定？
**A:** **ESR 原则：Equality → Sort → Range**，等值字段在前、范围字段在后。例：`status: "completed"` 是等值 → 放前，`createdAt: { $gte }` 是范围 → 放后，所以建 `{ status: 1, createdAt: 1 }`。原理：索引像字典排序，先按 status 排让 completed 连续聚在一起，再在这段里按 createdAt 切范围，利用率最高；范围在前会打折。
**⚠️ 别混**：ESR 是**复合索引字段排列顺序**的原则；"$lookup 放 $group 之后减少参与关联的文档数"是**管道阶段顺序**的优化，两个不同的东西，别都叫 ESR。
**◇ 顺带**：若查询要的字段索引里全有，可省掉 FETCH，叫**覆盖查询（covered query）**；小数据量下优化器可能故意不走索引（觉得全表更省），索引价值随数据量增大才显著。

### Q12. `$lookup` 慢怎么优化？
**A:** 看**关联的 `foreignField` 有没有索引**，没有就给它建。判读只看两个字段：`collectionScans` 应为 **0**（>0 = 关联字段没索引 = 全表扫 = 慢），`indexesUsed` 应**非空**。我做的报表关联 user 主键 `_id`（自带索引），explain 是 `collectionScans: 0`、`indexesUsed: ["_id_"]`，满分。关联无索引字段（如 user 的 name）才是 `$lookup` 常见的性能杀手。

---

## 6. 面试速答定式（一句话弹药）

| 问题 | 一句话 |
|---|---|
| 为什么用聚合不用 find | find 做不到跨文档聚合 |
| $match 为什么放最前 | 吃索引 + 减少流入 $group/$sort 的文档量 |
| 聚合代码放哪层 | 管道代码归 repository，业务参数归 service |
| $lookup 结果为什么是数组 | 按一对多设计，用 $unwind 炸开 |
| populate 有 N+1 吗 | 没有，用 $in 批量（1+1）；手动逐条才有（1+N） |
| 查询慢怎么优化 | explain 看 COLLSCAN/IXSCAN、docsExamined，给查的字段建索引 |
| 什么算最优索引 | keys = docs = nReturned 三数相等 |
| _id 有索引吗 | 永远有，自动唯一索引，删不掉 |
| $lookup 慢怎么优化 | 给关联的 foreignField 建索引；看 collectionScans 是否为 0 |
| 复合索引顺序 | ESR：等值在前、范围在后 |

---

## 7. 最容易说错的 5 句（背下来，这几句错了最掉分）

1. ❌"populate 有 N+1" → ✅ populate 用 `$in` 批量、无 N+1；**手动逐条循环**才有。
2. ❌"`_id` 没建过索引所以没有" → ✅ `_id` 永远自带唯一索引。
3. ❌"整段聚合管道放 service" → ✅ 管道代码归 repository，业务参数归 service。
4. ❌"管道顺序优化叫 ESR" → ✅ ESR 是复合索引字段顺序；管道阶段顺序是另一回事。
5. ❌"$lookup 的 from 填 Model 名 User" → ✅ 填集合真实名 `users`（小写复数），填错静默返回空。

---

> 复盘完之后：把 `backend-qa-sheet.md` 第 4 节和第 0 节顶部的 DB 定位，从 ⚠️"做过但生疏"调回 ✅"可主动亮"。如果只来得及背一块，背第 4 节 N+1（Q6/Q7）和第 5 节 explain 三数相等（Q9）——这两个最常问、也最能体现你"用指标而非直觉"。
