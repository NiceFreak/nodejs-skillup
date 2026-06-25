# Week 1 · MongoDB 现场演示讲稿(≤10 分钟)

> 现场实时演示,有观众。重点展示**判断力**,不是"我会敲命令"。
> 讲稿命令均取自本仓库真实代码,可直接粘贴。每环节:**命令 → 口播 → 预期输出 → 检查点 → 追问预案**。

---

## 0. 演示前检查清单(开场前 2 分钟,私下做完)

```bash
# 1) 起库
cd week1-mongodb && docker compose up -d

# 2) 重置两套数据到已知状态
mongosh "mongodb://root:example@localhost:27017/shop?authSource=admin" src/seed.js   # practice + bigdata(无索引基线)
cd order-system && npm install && npm run seed && cd ..                                # users(3) + orders(5)

# 3) 确认连得上(随便数一下)
mongosh "mongodb://root:example@localhost:27017/shop?authSource=admin" --eval 'db.getSiblingDB("shop").bigdata.countDocuments()'
```

- 终端开三个:**A = mongosh 交互窗**(用于环节②),**B, C = 项目目录**(用于环节①③跑 node)。
- ⚠️ **全局硬规则**:环节①(订单)的 `npm run seed` → `npm start` 要**连着跑**,中间**不要**插环节③的 mongoose demo——③会清空 `shop.users`,把订单引用的用户删掉。保险做法:每次 `npm start` 前先 `npm run seed`。

📸 环境就绪截图(也是验收证据):

![Compass 已连接 + shop 库 + bigdata 50000](docs/01-compass-connected.png)

---

## 开场(约 30 秒)

> "这周主题是 MongoDB。我不按‘学了哪些命令’讲,按**做了哪些设计判断**讲,分三块:一是订单系统的**建模取舍**——嵌入、引用、快照怎么选;二是**索引与 explain**,用扫描数据量证明索引到底快在哪;三是 Mongoose 的**两层防线**,Schema 校验和数据库约束的分工。三块都有可跑的代码,我现场演示。"

---

## 环节 ①:数据建模(订单系统)— 约 2.5 分钟【判断力核心】

### 要跑的命令(终端 B)

```bash
cd week1-mongodb/order-system
npm run seed     # 重置:3 个 user、5 条 order
npm start        # 跑验证查询
```

要展示的 Schema(打开 `order-system/models/order.model.js`,讲第 27–42 行):

```js
userId: { type: ObjectId, ref: "User", required: true },   // 决策1:引用
items: [{ productId: ObjectId, name, price: Decimal128, quantity }],  // 决策3:productId 引用 + name/price 快照
shippingAddress: { recipient, phone, province, city, detailAddress }, // 决策3:地址快照
amount: { type: Decimal128 },                              // 金额不用 Double
```

### 口播词(讲"为什么",不复述字段)

> "三个建模决策,每个背后是一组判断:
> **① 订单 ↔ 用户用引用**——因为一个用户的订单数**无上限增长**,无上限的东西绝不能嵌进父文档(16MB 上限),所以订单是独立文档,只存一个 `userId` 指回去。
> **② 地址嵌进用户**——注意它**也是一对多**,但我没用引用。判断不能停在‘一对多就引用’:地址**量级有上限、从不脱离用户单独查、也不被别人共享**,三个维度都指向嵌入。这就是为什么你看到 `addresses` 是个子文档数组。
> **③ 订单里的商品和地址用快照**——下单这一刻我把 `name`、`price` **复制一份冻进订单**,而不是只存引用。因为成交价是**历史事实**,商品之后涨价改名,这条订单不能变。注意我让 `productId`(引用,便于跳商品详情)和 `name/price`(快照)**并存**,两者不矛盾。
> 还有金额我用的是 `Decimal128` 不是 `Double`——浮点存钱会有 `0.1+0.2≠0.3` 的精度坑。"

(运行 `npm start`)
> "查询验证两件事:一是用 `userId` 能把 Alice 的所有订单查回来,**引用方向是通的**;二是订单里存的是下单时的快照值。"

### 预期输出

`npm run seed`:
```
seed done:
  users : 3
  orders: 5
```
`npm start`:
```
User orders: [ ... Alice 的 3 条订单 ... ]
Order details: { ... 一条订单,含 items[].name/price 快照、shippingAddress 快照 ... }
items[].name/price 是下单时的快照,不随商品本体变动而变动
```

📸 备份截图(现场挂了顶上):

![一条 order 文档:userId 引用 + items/shippingAddress 快照 + amount 为 Decimal128](docs/02-order-document.png)

![一条 user 文档:addresses 嵌入数组](docs/03-user-addresses.png)

### 检查点
- `npm start` 前必须先 `npm run seed`(见全局硬规则),否则 `User orders` 为空。
- "Order details" 取的是 `createdAt` 最新的一条;`insertMany` 时间戳可能相同,**具体哪条不固定**——别口播"这条是 Product E",说"Alice 的一条订单"即可。

### 可能被追问 + 怎么答
- **"为什么不用关系型?"** → "订单场景天然契合文档:一起读的数据放一起,省 join(MongoDB 没有高效 join);快照需求用嵌入很自然。但我不教条——**强一致事务、复杂多表 join 关系型更合适**,这里是按读取模式选的。"
- **"地址是一对多,为什么不引用?"** → 复述口播②的三维度(有上限/不独立查/不共享)。"‘一对多’只是起点,不是判据。"
- **"快照冗余,值得吗?"** → "用空间换**历史不可变**。而且我 `productId` 引用 + 快照并存,既能跳详情又能定格成交价,没有二选一。"

---

## 环节 ②:索引与 explain — 约 4.5 分钟【先慢后快,当面对比】

> 关键:**先给无索引基线(慢),再当场建索引(快)**——对比就是看点。盯 `totalDocsExamined`,不是 stage 名字。
> 三小步:**(1)(2) 基础对比 → (3) 最左前缀 → (4) 覆盖查询**。

### 要跑的命令(终端 A,mongosh 交互窗内)

```js
mongosh "mongodb://root:example@localhost:27017/shop?authSource=admin"
use shop

// (1) 无索引基线
db.bigdata.find({ age: 42 }).explain("executionStats")

// (2) 当场建索引,再跑同一条
db.bigdata.createIndex({ age: 1 })
db.bigdata.find({ age: 42 }).explain("executionStats")

// (3) 最左前缀:建复合索引 {city, age}(先 city 后 age)
db.bigdata.createIndex({ city: 1, age: 1 })
db.bigdata.find({ city: "Guangzhou", age: 42 }).explain("executionStats")  // city+age:两段精确,最理想
db.bigdata.find({ age: 42 }).explain("executionStats")                      // 只查 age:此刻靠单独的 age_1 救场
//   关键证明:删掉 age_1,只剩复合索引,再只查 age →
db.bigdata.dropIndex("age_1")
db.bigdata.find({ age: 42 }).explain("executionStats")                      // 退回 COLLSCAN!
db.bigdata.createIndex({ age: 1 })                                          // 演示完建回来(覆盖查询要用)

// (4) 覆盖查询:只要 age、且去掉 _id
db.bigdata.find({ age: 42 }, { age: 1, _id: 0 }).explain("executionStats")
```

### 口播词

> (1) "5 万条数据,先不建索引查 age=42,看三个值:`stage` 是 `COLLSCAN` 全表扫,`totalDocsExamined` 是 **50000**——为了找这 1000 条,它把整个集合翻了一遍。"
> (2) "现在当场建索引,同一条查询再跑。`stage` 变成 `IXSCAN` 外套 `FETCH`,`totalDocsExamined` 从 5 万掉到 **1000**——索引让它**直接定位**而不是逐条翻。这从 50000 到 1000 才是索引价值的硬证据。`FETCH` 是回表:索引里只有 age 和指针,要完整文档得回集合取。"
> (3) "接着讲复合索引的**字段顺序**。我建 `{city, age}`,顺序先 city 后 age。查 city+age,两段都精确命中,扫 **334** 条,这是复合索引最理想的用法。
> 但**只查 age** 呢?它走的是上一步那个单独的 `age_1`,**不是**这个复合索引。为什么?把 `{city,age}` 想成一本**先按城市、再按年龄排的通讯录**——你不给城市,42 岁的人散落在各个城市段里,没法直接定位。这就是**最左前缀**:复合索引只服务它的最左前缀,age 不是最左,用不上。
> 我证给你看:把单独的 `age_1` 删掉,只剩复合索引,再只查 age——直接退回 `COLLSCAN`,扫满 5 万。**复合索引救不了非最左字段的查询**,这下是实验证的不是背的。我把 age_1 建回来,下一步要用。"
> (4) "最后:如果我**只要 age 字段、并去掉 \_id**,会怎样?`stage` 是 `PROJECTION_COVERED`,`totalDocsExamined` 是 **0**——全程没碰集合。要的字段索引里全有,连回表都省了,这叫覆盖查询。`_id:0` 是关键开关,留着它就得回表取 \_id。"

### 预期输出(只读这几个字段)

| 步骤 | stage | totalDocsExamined |
|---|---|---|
| (1) 无索引 | `COLLSCAN` | **50000** |
| (2) 有索引 | `IXSCAN`(外层 `FETCH`) | **1000** |
| (3) city+age(复合) | `IXSCAN` | **334** |
| (3) 只查 age(age_1 在) | `IXSCAN`(走 `age_1`) | **1000** |
| (3) 删 age_1 后只查 age | `COLLSCAN` | **50000** |
| (4) 覆盖查询 | `PROJECTION_COVERED` | **0** |

📸 备份截图(只截 stage + totalDocsExamined 两个字段即可):

![无索引:COLLSCAN / 50000](docs/04-explain-collscan.png)

![有索引:IXSCAN / 1000](docs/05-explain-ixscan.png)

![删 age_1 后只查 age:退回 COLLSCAN / 50000(最左前缀证明)](docs/06-leftmost-collscan.png)

![覆盖查询:PROJECTION_COVERED / 0](docs/07-explain-covered.png)

### 检查点
- 跑(1)前确认 `bigdata` 上**没有 age 索引**——`src/seed.js` 用 `drop()` 重置时会连索引一起清,所以演示前重跑过 seed 就是干净基线。若(1)直接出 `IXSCAN`,说明索引没清,`db.bigdata.dropIndex("age_1")` 后重来。
- (3) 删 age_1 后只查 age 退回 `COLLSCAN` 是**预期的**,别慌——这正是要展示的证明。**务必跑完那行 `createIndex({age:1})` 把它建回来**,否则(4)覆盖查询出不来。
- 绝对耗时(ms)受机器/缓存影响,**别拿耗时当卖点**,只讲扫描数。

### 可能被追问 + 怎么答
- **"字段顺序除了最左前缀还看什么?"** → "最左前缀是**硬约束**(刚才证了 age 不是最左就用不上)。在满足查询前缀的前提下,再让**选择性高、区分度大的字段靠左**当次级 tiebreaker,第一段就过滤掉更多数据。进阶规则是 ESR——Equality → Sort → Range。但顺序不能反过来:只按选择性排却不匹配查询前缀,索引照样用不上。"
- **"为什么信扫描数不信耗时/stage 名?"** → "耗时受机器和缓存波动;`totalDocsExamined` 是相对硬指标,越接近返回数索引越准。等值匹配下扫描≈结果数,但范围查询不一定。"
- **"覆盖查询有代价吗?"** → "要把返回字段也塞进索引,索引变大、写入变慢。只对**高频关键查询**才值得这么换。"

---

## 环节 ③:Mongoose 两层防线 — 约 2 分钟【最深的认知】

### 要跑的命令(终端 C)

```bash
cd week1-mongoose/src
node index.js
```

要点代码(`week1-mongoose/src/index.js`):Schema 里 `name: required`、`age: min:0`、`email: unique`;末尾三段 try-catch 故意违规。

### 口播词

> "Schema 定了约束,但光定义不验证等于没确认。我故意写三条违规数据,关键是看**它们被哪一层拦下**:
> 缺 name、age=-5 这两条,报的是 `validation failed`——这是 **Mongoose 的应用层校验**,在写进数据库**之前**就拦了。
> 但重复 email 那条不一样,报的是 `E11000 duplicate key`——这是 **MongoDB 数据库层**的唯一索引拦的,数据是真的尝试写入了才被挡回来。
> 所以 `unique` 其实**不是** Schema 校验器,它是数据库索引约束。两层防线、报错格式都不同——这有实际后果:生产环境处理‘重复’不能只 catch ValidationError,得专门处理 E11000。很多人用 Mongoose 一年没分清这个。"

### 预期输出(末尾三行)

```
违反 required: User validation failed: name: Path `name` is required.
违反 min: User validation failed: age: Path `age` (-5) is less than minimum allowed value (0).
违反 unique: E11000 duplicate key error collection: shop.users index: email_1 dup key: { email: "grace@example.com" }
```

📸 备份截图(两条 `validation failed` 与一条 `E11000` 并排可见):

![两层防线:ValidationError vs E11000](docs/08-two-layer-defense.png)

### 检查点
- 前两行含 `validation failed`,第三行是 `E11000`——这个"长得不一样"就是演示要点,口播时点出来。
- 极少数情况:**全新数据库首跑**,唯一索引可能还没建好,E11000 不出现——再 `node index.js` 跑一次即可(索引已建)。
- 跑完这段后若要回去演示环节①,记得**重跑 `order-system` 的 `npm run seed`**(本段清空了 users)。

### 可能被追问 + 怎么答
- **"unique 为什么是 E11000 不是校验错误?"** → "因为它不是 Mongoose 校验器,而是数据库的唯一索引。Mongoose 看到 `unique:true` 会帮你**异步建索引**,时机不保证——生产常 `autoIndex:false` 改成部署时显式建,保证可控。"
- **"那 Schema 校验能不能替代数据库约束?"** → "不能。应用层校验能被绕过(直接写库、并发竞态),唯一性这种**必须**有数据库层兜底。两层各管一段,不是冗余。"

---

## 收尾(约 1 分钟)

> "三块串起来其实是一条线——**判断 → 验证**:
> 建模上,我不靠‘一对多就引用’的口诀,而是按量级/独立查/共享/历史四个维度逐个判断,所以地址嵌入、订单引用、价格快照各有理由。
> 索引上,我不停在‘要建索引’,而是用 `explain` 的扫描数把‘快在哪’、最左前缀、覆盖查询一步步**证**出来。
> Mongoose 上,我把 Schema 校验和数据库唯一约束**分清成两层防线**,知道它们报错不同、处理也不同。
> 这周的代码和笔记都在仓库里,每个 demo 我都能脱离 AI 从空白重建——这是我给自己定的掌握标准。"

---

### 时间分配
开场 0.5′ + 建模 2.5′ + 索引 4.5′ + Mongoose 2′ + 收尾 0.5′ ≈ **10′**。
超时优先砍(按顺序):① 不打开 Schema 文件、口播带过 → ④ 覆盖查询并进 (2) 一句话讲完 → ① 的 `npm start` 输出快速扫一眼。**最左前缀 (3) 不砍**——它是本环节判断力的重点。
