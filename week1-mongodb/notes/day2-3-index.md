# Week 1 · Day 2 — 索引与查询性能(explain · 最左前缀 · 覆盖查询)

> **目标**:亲手造大数据,用 `explain` 把「索引到底快在哪」「复合索引的字段顺序怎么影响查询」
> 「覆盖查询为什么能免回表」三件事,用具体数字和对照实验**证**出来,而不是背结论。
>
> 阅读约定:下午每个实验都按 **实验设计 → 我的猜测 → 关键结果(只留 explain 里有用的字段)→ 结论** 来记。

---

# 上午 · 索引基础与 explain 入门

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

> 数据分布(后面算扫描数会反复用到):age 有 50 个档(18~67),每档约 **1000** 条;
> city 有 3 个值,每个约 **16667** 条。

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
> `COLLSCAN` = Collection Scan(全表扫描):没有索引,只能从头到尾一条条翻完整个集合。

## 第三步 · 给 age 建索引,再跑同样的 explain

```js
db.bigdata.createIndex({ age: 1 })          // 1 = 升序
db.bigdata.find({ age: 42 }).explain("executionStats")
```

和基线对比:

|  | 无索引(基线) | 有索引 |
|---|---|---|
| `stage` | `COLLSCAN` | **`IXSCAN`(外层套 `FETCH`)** |
| 扫描文档数 `totalDocsExamined` | 50000 | **1000** |
| 耗时 `executionTimeMillis` | 27ms | **4ms** |

`totalDocsExamined` 从 **5 万降到 1000** —— 这就是索引的核心价值:它不再一条条翻全部数据,
而是通过索引**直接定位**到 age=42 的那 1000 条。

> ⚠️ **限定一下**:这里「扫描数 ≈ 结果数」之所以成立,是因为这是个**等值精确匹配**。
> 范围查询、低选择性索引、或需要额外过滤/回表的场景下,`totalDocsExamined` 不一定等于结果数。
> 真正该信的硬指标是「扫描数」这个相对量,绝对耗时(ms)受机器和缓存影响,只作参考。

## 关键细节 · `FETCH` 与 `IXSCAN` 的分工

建索引后,`winningPlan` 的 stage 不是单纯的 `IXSCAN`,而是 `FETCH` 套着 `IXSCAN`:

```
FETCH
  └── IXSCAN   ← inputStage 里面这层
```

- **`IXSCAN`(Index Scan,索引扫描)**:先在索引里快速找到 age=42 对应的位置。
  索引里**只存了 age 的值和指向文档的指针**,没有完整文档。
- **`FETCH`(回表)**:拿着 `IXSCAN` 找到的指针,回到集合里把**完整文档**捞出来
  (因为 `find` 要的是整条数据,不只是 age 一个字段)。

所以 `FETCH → IXSCAN` 的意思是:**用索引定位,再回表取完整数据。** 只要看到 `IXSCAN`,就说明索引真的被用上了。

## 上午留的悬念 · 覆盖查询(Covered Query)

> **如果查询只需要 age 这一个字段**(投影 `{ age: 1, _id: 0 }`),MongoDB 还需要 `FETCH` 回表吗?

先记着这个疑问 —— **答案在下午「覆盖查询」一节用实验揭晓**。

## 上午小结

| 维度 | 无索引 | 有索引 |
|---|---|---|
| 执行方式 | `COLLSCAN`(全表扫描) | `IXSCAN` + `FETCH`(索引定位 + 回表) |
| 扫描文档数 | 50000 | 1000 |
| 耗时 | 27ms | 4ms |

**一句话**:索引让查询从「翻遍全表」变成「直接定位到目标」,扫描量从全表降到约等于结果数(等值查询下),这就是它快的根本原因。

---

# 下午 · 复合索引的字段顺序(最左前缀)+ 覆盖查询

## 实验一 · 复合索引 `{city:1, age:1}` 服务哪些查询?

### 实验设计

`bigdata` 上现在已有一个 `{ age: 1 }` 单字段索引。再加一个**复合索引**做对比,注意字段顺序是**先 city、后 age**:

```js
db.bigdata.createIndex({ city: 1, age: 1 })   // 返回索引名:city_1_age_1
```

然后跑三个查询,各看 `stage` 和 `totalDocsExamined`:

```js
// A:只按 city 查
db.bigdata.find({ city: "Guangzhou" }).explain("executionStats")
// B:按 city + age 一起查
db.bigdata.find({ city: "Guangzhou", age: 42 }).explain("executionStats")
// C:只按 age 查
db.bigdata.find({ age: 42 }).explain("executionStats")
```

### 我的猜测

> 三个查询都会进索引、不会出现 COLLSCAN;C 会受上午建的单独 `{age:1}` 索引影响,走那个单独索引。

### 关键结果

| 查询 | 命中的索引 | indexBounds | totalDocsExamined | nReturned |
|---|---|---|---|---|
| A 只查 city | `city_1_age_1` | city `["Guangzhou"]`,age `[MinKey, MaxKey]` | **16667** | 16667 |
| B 查 city+age | `city_1_age_1` | city `["Guangzhou"]`,age `[42, 42]` | **334** | 334 |
| C 只查 age | **`age_1`**(不是复合索引) | age `[42, 42]` | 1000 | 1000 |

> B 的 `rejectedPlans` 里能看到 MongoDB 其实也考虑过用 `age_1`,但最终选了 `city_1_age_1`(两段都精确,更优)。

### 结论:三个查询都「走了索引」,但走的不是同一个,效率也天差地别

关键看 `totalDocsExamined`,而不是「有没有走索引」:

- **A(只查 city)**:用上了复合索引,但 age 那一截是 `[MinKey, MaxKey]`(整个范围),
  等于只靠 city 定位、把广州的人**全扫了**(16667 条)。能用上,是因为 **city 正好是复合索引的最左字段**。
- **B(查 city+age)**:两个字段都精确命中(334 条),这是复合索引**最理想**的用法。
- **C(只查 age)**:走的是 `age_1`,**不是** `city_1_age_1` —— 这正是「最左前缀」的体现(见下)。

## 最左前缀原则(leftmost prefix)

把复合索引 `{city:1, age:1}` 想象成一本**先按城市、再按年龄排序的通讯录**:

| 查询 | 能否用这本通讯录 | 原因 |
|---|---|---|
| 查「广州的人」(A) | ✅ 能,但要整段扫 | 翻到广州那一段即可,但段内没按其他条件细分 |
| 查「广州 + 42 岁」(B) | ✅ 最理想 | 先翻到广州、再在广州段里按年龄精确定位 |
| 查「所有 42 岁的人」(C) | ❌ 用不上 | 通讯录**先按城市排**,42 岁的人散落在各城市段里,无法直接定位 |

**这就是最左前缀**:复合索引 `{city, age}` 能服务「查 city」和「查 city+age」,但**服务不了「只查 age」**,
因为 age 不是最左字段。C 之所以还能走索引,纯粹是因为上午**单独建过 `age_1`** 在救场。

### 对照实验:删掉 `age_1`,再跑 C,亲手验证最左前缀

```js
db.bigdata.dropIndex("age_1")                       // 排除单独索引的干扰
db.bigdata.find({ age: 42 }).explain("executionStats")
```

- **我的猜测**:只剩 `{city,age}` 复合索引,age 不是最左,C 应当找不到可用索引 → `COLLSCAN`。
- **结果**:`stage: COLLSCAN`,`totalKeysExamined: 0`,`totalDocsExamined: 50000`。✅ 猜对了。
- **结论**:**复合索引救不了非最左字段的查询**。如果当初没单独建 `age_1`,C 从一开始就只能全表扫。

> 实验做完记得把 `age_1` 重新建回来(下一个实验要用):`db.bigdata.createIndex({ age: 1 })`

### 字段顺序的实践原则

- **先服务查询的最左前缀形态**:字段顺序必须能匹配你实际查询的前缀。
  把「最常用作**精确匹配**的字段」放在左边;经常单独查的字段,要么放复合索引最左,要么单独建索引(这就是 `age_1` 当初救场的意义)。
- 在「满足查询前缀」这个前提下,再让**选择性高(重复值少、区分度大)的字段靠左**——它能在第一段就过滤掉更多数据,后面段要查的范围就小了。
  > ⚠️ 注意顺序:**查询前缀是硬约束,选择性只是次级 tiebreaker**。若只按选择性排、却不匹配查询前缀,索引照样用不上。
  > (进阶规则:ESR —— Equality → Sort → Range,以后做排序/范围查询时再深入。)
- 类比 MySQL:MySQL 的复合索引同样遵循最左匹配原则,思路一致。

## 实验二 · 覆盖查询(Covered Query)—— 揭晓上午的悬念

### 实验设计

```js
db.bigdata.createIndex({ age: 1 })   // 确保 age_1 在
// 只投影 age、且去掉 _id(关键:_id 不在 age 索引里,留着它就得回表)
db.bigdata.find({ age: 42 }, { age: 1, _id: 0 }).explain("executionStats")
```

- **我的猜测**:winningPlan 里只剩 IXSCAN、没有 FETCH,因为要的字段(age)索引里全有、又排除了 _id。

### 关键结果

```
winningPlan:
  PROJECTION_COVERED            ← FETCH 消失了!
    └── IXSCAN (age_1, age:[42,42])
totalKeysExamined: 1000
totalDocsExamined: 0           ← 全程没碰集合
```

### 结论:字段全在索引里 → 免回表,这是索引的最高效形态

- `IXSCAN` 在索引里定位 age=42 → `PROJECTION_COVERED` 直接从索引返回 age 的值,**全程没有 FETCH**。
- 对比下午前面所有查询都是 `FETCH → IXSCAN`(定位后回表),这次是 `PROJECTION_COVERED → IXSCAN`,**完全不碰集合**。
- **最硬的证据是 `totalDocsExamined: 0`**,而不是 stage 的名字。

### 反证:把 `_id: 0` 去掉,看 FETCH 怎么回来

```js
db.bigdata.find({ age: 42 }, { age: 1 }).explain("executionStats")   // 没去掉 _id
```

结果:`PROJECTION_SIMPLE → FETCH → IXSCAN`,`totalDocsExamined: 1000`。
—— 因为 `_id` 不在 age 索引里,为了取 `_id` 必须回表,覆盖查询被打破。✅ 反向验证成立。

### 覆盖查询的触发条件

1. **投影要返回的字段**全部在某个索引里;
2. **筛选条件用到的字段**也在该索引里;
3. **`_id` 显式排除**(`_id: 0`),除非 `_id` 本身在索引里。

> 实践价值:高频的关键查询,有时会故意把「要返回的字段」也加进复合索引,就为了触发覆盖查询、把回表也省掉。

---

# explain 的 stage 名词表(查询的「执行流水线」)

`winningPlan` 的 `stage` 是 MongoDB 执行查询时经过的一道道「工序」。先记今天遇到的核心四个:

| stage | 含义 | 信号 |
|---|---|---|
| `COLLSCAN` | 集合扫描:无可用索引,逐条读完整文档检查 | 通常意味着「这里缺个索引」 |
| `IXSCAN` | 索引扫描:在索引里定位(只拿到值 + 指针,非完整文档) | 索引被用上了 |
| `FETCH` | 回表:拿指针回集合捞完整文档 | 几乎总和 IXSCAN 成对出现 |
| `PROJECTION_COVERED` | 覆盖查询:字段全在索引里,免回表 | 最高效,`totalDocsExamined: 0` |

**用「图书馆找书」串成一个画面:**

- **COLLSCAN** = 没有目录,从第一个书架开始**一本本翻、边翻边看内容**,直到翻完。
- **IXSCAN** = 查目录卡片,卡片上写着书名和「在 3 区 5 排」(指针),但卡片本身不是书。
- **FETCH** = 拿着「3 区 5 排」这个位置,走过去把书取下来。
- **PROJECTION_COVERED** = 你只想知道书名,而目录卡片上就写着书名 —— 看卡片就够了,根本不用去取书。

**几个之后(聚合、排序、分页时)会遇到的 stage,先混个眼熟:**

- `SORT`:在内存里排序。排序字段没有索引支持时,MongoDB 现场排,数据量大很耗内存(甚至超限报错)。看到它通常是「排序字段该建索引」的信号。
- `LIMIT` / `SKIP`:对应 `.limit()` / `.skip()`,限制条数、跳过前 N 条(分页)。
- `PROJECTION_SIMPLE` / `PROJECTION_DEFAULT`:处理投影,但和 COVERED 不同 —— 它仍要 FETCH 完整文档再挑字段,没省掉回表。
- `FETCH + filter`:用索引定位后,回表时还要再用某个条件过滤一遍(那个条件没在索引里)。今天 B 的 `rejectedPlans` 里见过。

**读 explain 做优化判断的目光顺序:**

1. 是 `COLLSCAN` 吗?→ 是,大概率缺索引,最该警惕。
2. 是 `IXSCAN` 吗?→ 好,用上索引了。
3. 能做到 `PROJECTION_COVERED` 吗?→ 高频关键查询能的话更快。
4. 有没有意外的 `SORT`?→ 有就考虑给排序字段加索引。

外加硬指标 `totalDocsExamined`:越接近 `nReturned`(实际返回数),索引越精准;差得越远(扫一堆、返回没几条),说明索引没建好或没建。

---

# 今日总结:我自己证出来的五点

1. **索引基础**:COLLSCAN 50000 → IXSCAN 1000,扫描数是索引价值的硬证据。
2. **FETCH + IXSCAN 两层分工**:索引定位 + 回表取完整文档。
3. **复合索引 + 最左前缀**:用对照实验证明了 `{city,age}` 救不了「只查 age」(删 `age_1` 后 C 退回 COLLSCAN/50000)。
4. **字段顺序的实践原则**:先匹配查询前缀,再让选择性高的靠左。
5. **覆盖查询 `PROJECTION_COVERED`**:字段全在索引里就免回表,硬证据是 `totalDocsExamined: 0`(`_id:0` 是关键开关)。

> 后三点(最左前缀、字段顺序、覆盖查询)是面试高频、且很多人只停在「知道要建索引」答不出的深度。
> 用 explain 一步步**实验证**出来的
