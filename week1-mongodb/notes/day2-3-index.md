# Week 1 · Day 2(上午)— 索引初探:用 explain 看懂索引的价值

> **目标**:亲手造一批大数据,用 `explain` 对比「有索引 / 无索引」的执行差异,
> 把「索引到底快在哪」用具体数字钉死。

---

## 第一步 · 造一批足够大的测试数据

数据量太小,索引的差异看不出来,所以要造几万条。下面这个 `for` 循环属于样板,直接用:

```js
db.bigdata.drop()   // 先清掉可能存在的旧数据

const docs = []
for (let i = 0; i < 50000; i++) {
  docs.push({
    name: "User" + i,
    age: 18 + (i % 50),                      // 18~67 之间循环
    city: ["Guangzhou", "Shenzhen", "Beijing"][i % 3]
  })
}
db.bigdata.insertMany(docs)

db.bigdata.countDocuments()   // 确认插进去了,应该是 50000
```

跑完确认返回 **50000**。

---

## 第二步 · 测「无索引」的基线

现在 `bigdata` 上没有任何索引(除了默认的 `_id`)。对一个按 age 的查询跑 `explain`:

```js
db.bigdata.find({ age: 42 }).explain("executionStats")
```

返回内容很长,**只需要找这三个值**:

| 关注的字段 | 含义 | 基线结果 |
|---|---|---|
| `winningPlan.stage` | 用了哪种执行方式 | **`COLLSCAN`** |
| `executionStats.totalDocsExamined` | 实际扫描了多少文档 | **50000** |
| `executionStats.executionTimeMillis` | 耗时多少毫秒 | **27** |

> 先把「没有索引时有多慢、扫描了多少」这个基线钉死,等会建了索引再对比,差异才有冲击力。
>
> `COLLSCAN` = Collection Scan(全表扫描):没有索引,只能从头到尾一条条翻完整个集合。

---

## 第三步 · 给 age 建索引,再跑同样的 explain

```js
db.bigdata.createIndex({ age: 1 })          // 1 = 升序
db.bigdata.find({ age: 42 }).explain("executionStats")
```

还是找那三个值,和基线对比:

|  | 无索引(基线) | 有索引 |
|---|---|---|
| `stage` | `COLLSCAN` | **`IXSCAN`(外层套 `FETCH`)** |
| 扫描文档数 `totalDocsExamined` | 50000 | **1000** |
| 耗时 `executionTimeMillis` | 27ms | **4ms** |

`totalDocsExamined` 从 **5 万降到 1000** —— 这就是索引的核心价值:
它不再一条条翻全部数据,而是通过索引**直接定位**到 age=42 的那 1000 条
(5 万条里 age 在 18~67 循环,42 这一档正好约 1000 条)。
**扫描数从「全表」变成「正好等于结果数」,这是索引生效最硬的证据。** 耗时也跟着从 27ms 降到 4ms。

---

## 关键细节 · `FETCH` 与 `IXSCAN` 的分工

建索引后,`winningPlan` 的 stage 不是单纯的 `IXSCAN`,而是 `FETCH` 套着 `IXSCAN`:

```
FETCH
  └── IXSCAN   ← inputStage 里面这层
```

实际 explain 输出里确认到的:

```
executionStages.stage             = FETCH
executionStages.inputStage.stage  = IXSCAN
```

两层的分工(这是个值得真懂的点):

- **`IXSCAN`(Index Scan,索引扫描)**:先在索引里快速找到 age=42 对应的位置。
  索引里**只存了 age 的值和指向文档的指针**,没有完整文档。
- **`FETCH`(回表)**:拿着 `IXSCAN` 找到的指针,回到集合里把**完整文档**捞出来
  (因为 `find` 要的是整条数据,不只是 age 一个字段)。

所以 `FETCH → IXSCAN` 的意思是:**用索引定位,再回表取完整数据。**
这和无索引时的 `COLLSCAN`(直接硬扫全表)是本质区别 —— 只要看到 `IXSCAN`,就说明索引真的被用上了。

---

## 留个伏笔 · 覆盖查询(Covered Query)

> **如果查询只需要 age 这一个字段**(用投影 `{ age: 1, _id: 0 }`),
> MongoDB 还需要 `FETCH` 回表吗?还是光靠索引本身就够了?

答案下午揭晓 —— 它叫**「覆盖查询(Covered Query)」**:
当查询要的字段全都在索引里时,**可以跳过 `FETCH`、直接从索引返回结果**,连回表都省了,更快。
这是复合索引深度的一部分,先记着这个疑问。

---

## 小结

| 维度 | 无索引 | 有索引 |
|---|---|---|
| 执行方式 | `COLLSCAN`(全表扫描) | `IXSCAN` + `FETCH`(索引定位 + 回表) |
| 扫描文档数 | 50000 | 1000 |
| 耗时 | 27ms | 4ms |

**一句话**:索引让查询从「翻遍全表」变成「直接定位到目标」,
扫描量从全表降到约等于结果数,这就是它快的根本原因。
`explain("executionStats")` 是验证索引是否真正生效的标准手段。
