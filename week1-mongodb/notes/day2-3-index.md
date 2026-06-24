**第一步 · 造一批足够大的测试数据**

数据量太小,索引的差异看不出来,所以要造几万条。这个 `for` 循环属于样板,直接用:

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

跑完确认返回 50000。

**第二步 · 测"无索引"的基线**

现在 `bigdata` 上没有任何索引(除了默认的 `_id`)。对一个按 age 的查询跑 explain,看它在没有索引时怎么执行:

```js
db.bigdata.find({ age: 42 }).explain("executionStats")
```

**返回内容很长,你只需要找这三个值**(昨天我们看过,这次自己找):

1. `winningPlan` 里的 `stage` —— 是 `COLLSCAN` 还是 `IXSCAN`?
2. `executionStats.totalDocsExamined` —— 实际扫描了多少文档?
3. `executionStats.executionTimeMillis` —— 耗时多少毫秒?

把这三个值找出来,发我。**先别建索引**——我们要先把"没有索引时有多慢、扫描了多少"这个基线钉死,等会后建了索引再对比,差异才有冲击力。

1. COLLSCAN
2. 50000
3. 27

**给 age 建索引,然后跑同样的 explain:**

```js
db.bigdata.createIndex({ age: 1 })
db.bigdata.find({ age: 42 }).explain("executionStats")
```

还是找那三个值,和基线对比:
1. `stage` —— 还是 COLLSCAN 吗?
2. `totalDocsExamined` —— 从 50000 变成多少?
3. `executionTimeMillis` —— 变化?

1. FETCH
2. 1000
3. 4

三个数字一对比,索引的价值一目了然。但你注意到第 1 个值的变化了吗——它藏着一个值得搞懂的细节,我先确认你看到的完整信息。

**先看最有冲击力的对比:**

| | 无索引(基线) | 有索引 |
|---|---|---|
| 扫描文档数 | 50000 | **1000** |
| 耗时 | 27ms | **4ms** |

`totalDocsExamined` 从 **5 万降到 1000**——这就是索引的核心价值:它不再一条条翻全部数据,而是通过索引直接定位到 age=42 的那 1000 条(5 万条里 age 在 18-67 循环,42 这一档正好约 1000 条)。扫描数从"全表"变成"正好等于结果数",这是索引生效最硬的证据。耗时也跟着从 27ms 降到 4ms。

**现在说第 1 个值那个细节——你看到的是 `FETCH`,我得跟你确认完整的。**

无索引时是 `COLLSCAN`,现在变成 `FETCH`。但 `FETCH` 通常不是单独出现的,它一般是套在 `IXSCAN` 外面的——完整的 `winningPlan` 结构通常长这样:

```
FETCH
  └── IXSCAN   ← 里面这层
```

这两层的分工是这样(这是个值得懂的点):

- **`IXSCAN`**(索引扫描)= 先在索引里快速找到 age=42 对应的位置。索引里只存了 age 的值和指向文档的指针,没有完整文档。
- **`FETCH`** = 拿着 IXSCAN 找到的指针,回到集合里把**完整文档**捞出来(因为你 `find` 要的是整条数据,不只是 age)。

所以 `FETCH → IXSCAN` 的意思是:用索引定位,再回表取完整数据。这跟昨天的 `COLLSCAN`(没有索引、直接硬扫全表)是本质区别。

**你回去看一眼**:在 explain 输出的 `winningPlan` 里,`FETCH` 下面是不是有个 `inputStage`,它的 `stage` 是 `IXSCAN`?确认一下,因为这能验证索引是真的被用上了(IXSCAN 在,就是用上了)。

这里还埋着一个延伸问题,先给你留个印象,复合索引时会用到:**如果你的查询只需要 age 这一个字段(用投影 `{age:1, _id:0}`),MongoDB 还需要 FETCH 回表吗?** 还是说光靠索引本身就够了?——这个先别答,记着这个疑问,下午揭晓(它叫"覆盖查询",是复合索引深度的一部分)。

先确认那个 IXSCAN 在不在,这一小时的核心就拿下了。
executionStages.stage = FETCH
executionStages.inputStage.stage = IXSCAN

无索引 | 有索引
COLLSCAN | IXSCAN
50000 | 1000
27 | 4 

IXSCAN 从索引里拿到 age = 42 的位置, 再通过 FETCH 找到 document, 比基线扫描的速度大大提高