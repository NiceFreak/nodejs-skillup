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