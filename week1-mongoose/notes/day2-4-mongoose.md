起 Mongoose 的头。还是老规矩,**我给方向和提示,核心代码你自己写**(尤其 Schema 定义,那是这块要练的能力,不是样板)。

**第一步 · 建项目 + 装 mongoose**(这步是样板,直接用):

```bash
mkdir week1-mongoose && cd week1-mongoose
npm init -y
npm install mongoose
```

**第二步 · 理解你要写什么,再动手**

在写代码前,先建立一个核心认知——**Mongoose 和你前两天用的原生操作,本质区别在哪?**

你在 Compass shell 里直接 `db.practice.insertOne({...})`,MongoDB 不管你塞什么结构、什么类型(还记得那个 `20.0` 被存成 int 的坑吗)。**Mongoose 在你的代码和数据库之间加了一层"Schema"**——你先声明"这个 collection 的文档应该长什么样(哪些字段、什么类型、哪些必填)",之后所有写入都会被这层 Schema 校验和转换。这就是 ODM(Object-Document Mapping)的核心价值:**把"随便存"变成"按规矩存"**,正好治你前两天踩的类型不可靠的坑。

**第三步 · 你来写:第一个连接 + Schema + CRUD**

新建一个 `index.js`,我给你**结构骨架和提示**,具体内容你填(尤其 Schema 字段):

```js
const mongoose = require("mongoose");

async function main() {
  // 1. 连接数据库(连接字符串你前两天用过,shop 库)
  //    提示:await mongoose.connect("mongodb://root:example@localhost:27017/shop?authSource=admin")

  // 2. 定义 Schema —— 这是今天的核心,你自己写
  //    定义一个 User,要求:
  //    - name: 字符串,必填(required)
  //    - age: 数字,最小值 0(min)
  //    - city: 字符串
  //    - email: 字符串,唯一(unique)
  //    提示:new mongoose.Schema({ 字段: { type: ..., required: ..., ... } })

  // 3. 从 Schema 创建 Model
  //    提示:mongoose.model("User", userSchema)

  // 4. 用 Model 做 CRUD(自己写至少 create + find)
  //    create: await User.create({ ... })
  //    find:   await User.find({ city: "..." })

  // 5. 断开连接
  //    提示:await mongoose.disconnect()
}

main().catch(console.error);
```

运行:`node index.js`

**先把"连接 + 定义 User Schema + create 一条 + find 出来 + 断开"这条最小链路跑通。** 重点在 Schema 那段你自己写——把上面注释里的字段要求翻译成 Mongoose 语法。

卡住的话,先查 Mongoose 官方文档(关键词 `mongoose schema`、`mongoose connect`),实在过不去再问我"为什么",不是"语法抄给我"。

写完把你的 `index.js` 和运行结果发我。开始吧。

代码质量很高,跑通了基本没问题,而且你做了几件超出要求的事(自己加了 update 和 delete)。但有几个点值得抠——其中一个是真 bug,会让你看不到结果;其他是 Mongoose 的"地道写法",现在纠正了能少走弯路。

**先说一个让你"看不到结果"的问题(不是报错,但你白跑了):**

你的 `find`、`create` 都 `await` 了,但**没有把结果打印出来**:

```js
await User.find({ city: "New York" })   // 查到了,但结果丢了,你看不到
```

`await` 只是等它执行完,结果需要接住并 `console.log` 才看得见。改成:

```js
const users = await User.find({ city: "New York" })
console.log(users)
```

否则你运行 `node index.js`,屏幕上什么都没有,你不知道到底成没成。**这是新手很常见的"以为没生效,其实是没打印"**——和你前两天在 shell 里不一样,shell 会自动回显,写代码不会,得自己打印。

**第二个,Mongoose 的"地道写法",你绕了一小步:**

```js
mongoose.model("User", userSchema)      // 注册
const User = mongoose.model("User")     // 又取一次
```

你分成了两句——先注册、再取出来。功能上没错,但 `mongoose.model("User", userSchema)` **本身就返回这个 Model**,可以一句搞定:

```js
const User = mongoose.model("User", userSchema)
```

你那句注释写得其实很准("在 shop 库中创建 users 集合,文档必须符合 userSchema 约束")——说明你理解了它在干嘛,只是写法上多绕了一步。

**第三个,你的 update 又踩回前两天那个坑了!**

```js
await User.updateOne({ name: "Alice" }, { age: 26 })   // ⚠️ 没带操作符
```

还记得前两天 shell 里 `{ age: 99 }` 报的那个 `atomic operators` 错吗?这里同样的问题——该用 `$set`:

```js
await User.updateOne({ name: "Alice" }, { $set: { age: 26 } })
```

有意思的是:Mongoose 在某些情况下会"容忍"你不写 `$set`(它内部帮你补),所以你这条**可能没报错**——但别依赖这个,显式写 `$set` 才是对的、可控的。你这条恰好暴露了"Mongoose 有时会替你兜底,反而让你养成模糊习惯"——保持你 shell 里那个严谨,显式写操作符。

**一个会让你第二次运行就报错的坑(提前告诉你):**

你 `email` 设了 `unique: true`,而且 create 了固定的 email。**第一次运行能成,第二次运行会报错**——因为数据库里已经有 alice@example.com 了,再 create 一条同样的 email,违反唯一约束。这不是 bug,是 unique 在正常工作。等你第二次跑遇到 `E11000 duplicate key` 错误时,别慌,那正是 unique 生效的证据。解决办法:每次运行前先清空,或者在 main 开头加一句 `await User.deleteMany({})`(把旧数据清掉再重新 create)。

---

**总结一下你这版:**

核心能力(定义 Schema、连库、CRUD)都对,Schema 那段——required、min、unique 全部翻译正确,这是今天要练的重点,你拿下了。问题集中在两类:**一是没打印结果(看不到效果)**,二是**update 没显式带 `$set`**(老坑复发)。

你改三个地方再跑一次:① 给 find/create 的结果加 `console.log`,② update 加 `$set`,③ main 开头加 `await User.deleteMany({})` 避免重复运行报错。

跑通后你应该能在终端看到查询结果打印出来。把改完的运行输出发我——重点看你能不能观察到 Mongoose 的 Schema 校验在起作用(下一步我会让你故意违反 Schema,比如存一个缺 name 的、或 age 为负的,看 Mongoose 怎么拦你,那才是 ODM 价值的高光时刻)。

这版干净了,三个问题都改对了:`$set` 加上了、结果打印了、`deleteMany({})` 也加了避免重复运行报错。Mongoose 的最小链路你完整跑通了——连库、定义带约束的 Schema、CRUD,这一块的基础你拿下了。

现在到 ODM 价值的**高光时刻**:你定义的那些 Schema 约束(required、min、unique),到底是不是真的在拦你?光定义不验证,等于没确认它生效。这一步你来证。

**任务:故意违反 Schema,看 Mongoose 怎么拦你。** 在你现有代码的 create 之后,加几条"违规"的 create,每条单独 try-catch 起来打印错误(这样一条报错不会中断后面的)。三个违规场景,你自己写:

1. **违反 required**:create 一个**没有 name** 的用户(只给 age、city、email)。
2. **违反 min**:create 一个 **age 为 -5** 的用户。
3. **违反 unique**:create 两个**相同 email** 的用户。

提示结构(你填具体内容):

```js
try {
  await User.create({ /* 没有 name 的用户 */ })
} catch (err) {
  console.log("违反 required:", err.message)
}
```

三个分别用三个 try-catch。

**写之前先预测**:这三条违规,你觉得哪些会在 Mongoose 这一层就被拦下(根本到不了数据库)、哪些是数据库层面拦的?

提示一个值得注意的差异:**required 和 min 是 Mongoose 的 Schema 校验**(在代码层、写入数据库之前就检查);而 **unique 其实不是 Schema 校验,它是数据库的索引约束**(要真的尝试写入、由 MongoDB 的唯一索引拦下)。这个区别有实际后果——unique 的报错信息长得和前两个不一样(你会看到 `E11000 duplicate key`,而不是 Mongoose 的校验错误)。

先猜哪些是 Mongoose 拦的、哪些是数据库拦的,然后写代码验证,把三条的报错信息发我。你会亲眼看到"两层防线"长得不一样——这正是理解 Mongoose 和 MongoDB 分工的关键。

三个猜测全对,代码也写对了——你已经准确理解了"Mongoose 校验"和"数据库约束"是两层不同的防线。把你应该看到的运行结果对一下,确认你的理解和实际输出吻合:

**违反 required**(没有 name):报错信息大概长这样——
`User validation failed: name: Path \`name\` is required.`
这是 **Mongoose 的校验错误**(ValidationError),关键词是 `validation failed`。它在代码层就拦下了,根本没碰数据库。

**违反 min**(age -5):
`User validation failed: age: Path \`age\` (-5) is less than minimum allowed value (0).`
同样是 Mongoose 的 ValidationError,和 required 是同一类、同一层。

**违反 unique**(重复 email):
`E11000 duplicate key error collection: shop.users index: email_1 dup key: { email: "grace@example.com" }`
**完全不一样**——这是 MongoDB 数据库抛的错(`E11000`),不是 Mongoose 校验。它是真的尝试写入了、被数据库的唯一索引拦下的。

你回去核对一下实际输出,是不是前两个是 `validation failed`、第三个是 `E11000`?如果是,你就亲眼证实了**两层防线长得不一样**。

**现在说这个区别的实际后果(这是今天最有价值的认知,比"会用 Mongoose"更深):**

既然 unique 不是 Mongoose 校验、而是靠数据库的唯一索引,那就有一个**坑**:这个唯一索引**必须真的在数据库里建好了,约束才生效**。Mongoose 看到你写 `unique: true`,会尝试帮你自动建这个索引——但这有两个陷阱:

1. **自动建索引是异步的、不保证时机。** 如果你的 collection 已经有数据、或者程序刚启动索引还没建完,这期间 unique 可能暂时不生效,漏进重复数据。生产环境通常会**关掉自动建索引**(`autoIndex: false`),改成手动/部署时显式建,以保证可控。

2. **`unique: true` 不是"校验器"**,所以它不会触发 Mongoose 那套友好的 ValidationError,而是抛数据库的 `E11000`。这意味着你在代码里处理"重复"这种错误时,**不能只 catch ValidationError**,还得专门处理 `E11000`——两类错误要分开处理。

一句话总结今天这个高光认知:**Mongoose 的 required/min/max/enum 这些是"应用层校验"(写入前、友好报错);unique 是"数据库层约束"(靠唯一索引、报 E11000)。两者防线不同、报错不同、处理方式也不同。** 很多人用 Mongoose 一年都没分清这个,你第一天就用实验把它证清楚了。

---

**到这里,Mongoose 的核心你今天全部拿下了**,而且远不止"会用":

- 定义带约束的 Schema(required/min/unique)✅
- 连库 + 完整 CRUD ✅
- 显式 `$set`(没再踩原子操作符的坑)✅
- **证明了 Schema 校验真的在拦你** ✅
- **分清了应用层校验 vs 数据库层约束两层防线** ✅(今天最深的点)

这块原本是 Week 1 计划里"留给明天"的内容,你今天会开完后用两小时不到就啃下来了,而且啃到了大多数人没注意的深度。

**Week 1 的全部新内容到此其实就学完了**——环境、概念、建模、CRUD、索引、Mongoose,六块全齐。你比原计划提前了不少。

现在该收尾了:把 Mongoose 这块整理进笔记,重点记那个"两层防线"的认知(用你自己的话),还有你这段验证代码可以留作 demo 素材。然后 commit(`feat: Mongoose 基础 - Schema 校验与 CRUD`,这次有代码产出,用 `feat` 不是 `docs`)。
