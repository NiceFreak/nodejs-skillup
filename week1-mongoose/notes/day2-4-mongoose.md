# Week 1 · Day 2(收尾)— Mongoose 入门:Schema 校验与 CRUD

> 本周最后一块。承接前两天的原生 MongoDB(Compass/mongosh),这次在代码层用 Mongoose(ODM)把"随便存"变成"按规矩存",并亲手证明 Schema 校验真的在拦你。
>
> 配套可运行代码:[`../src/index.js`](../src/index.js)(连库 + Schema + CRUD + 三个违规验证)。

---

## 1. Mongoose / ODM 是什么:为什么需要它

前两天在 shell 里直接 `db.practice.insertOne({...})`,MongoDB 不管你塞什么结构、什么类型——还记得那个 `20.0` 被存成 `Int32` 的坑吗?**类型听天由命。**

**Mongoose 在你的代码和数据库之间加了一层 Schema**:先声明"这个集合的文档应该长什么样(哪些字段、什么类型、哪些必填)",之后所有写入都会被这层校验和转换。这就是 ODM(Object-Document Mapping)的核心价值——**把"随便存"变成"按规矩存"**,正好治前两天踩的类型不可靠的坑。

---

## 2. 最小链路:连接 → Schema → Model → CRUD → 断开

一条最小可运行链路的骨架(完整实现见 `src/index.js`):

```js
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect("mongodb://root:example@localhost:27017/shop?authSource=admin");

  const userSchema = new mongoose.Schema({
    name:  { type: String, required: true },  // 必填
    age:   { type: Number, min: 0 },          // 最小值约束
    city:  { type: String },
    email: { type: String, unique: true },    // 唯一(注意:这其实是数据库索引,见第 4 节)
  });

  const User = mongoose.model("User", userSchema);  // 注册并返回 Model,一句到位
  // ...CRUD...
  await mongoose.disconnect();
}
main().catch(console.error);
```

### 这一步踩过 / 纠正过的点

| 坑 | 现象 | 正确写法 |
|---|---|---|
| `await` 了但没接结果 | `await User.find(...)` 屏幕什么都不打印,以为没生效 | `const users = await User.find(...); console.log(users)` —— shell 会自动回显,写代码不会,得自己打印 |
| Model 注册绕了一步 | 先 `mongoose.model("User", schema)` 再 `mongoose.model("User")` 取一次 | `mongoose.model("User", schema)` 本身就返回 Model,一句搞定 |
| update 没带操作符 | `updateOne({...}, { age: 26 })` —— 前两天 shell 里 `atomic operators` 那个老坑复发 | `updateOne({...}, { $set: { age: 26 } })`。Mongoose 有时会"容忍"不写 `$set`(内部帮你补),但别依赖,显式写才可控 |
| 重复运行报错 | `email` 有 `unique`,第二次跑 create 同样的 email 会 `E11000` | 不是 bug,是 unique 在生效。`main` 开头加 `await User.deleteMany({})` 清旧数据再重建 |

---

## 3. ODM 价值的高光时刻:故意违反 Schema,看它怎么拦

光定义约束、不验证,等于没确认它生效。用三条"违规" create(各自 try-catch)亲手验证:

| 违规场景 | 预测拦截层 | 实际报错(关键特征) |
|---|---|---|
| 缺 `name`(违反 required) | Mongoose 应用层 | `User validation failed: name: Path \`name\` is required.` |
| `age: -5`(违反 min) | Mongoose 应用层 | `User validation failed: age: ... less than minimum allowed value (0).` |
| 两条相同 `email`(违反 unique) | 数据库层 | `E11000 duplicate key error ... index: email_1 dup key` |

三条预测全部命中。前两条是 `validation failed`,第三条是 `E11000`——**报错长得完全不一样**,这正是关键线索。

---

## 4. 本日最深的认知:两层防线(应用层校验 vs 数据库层约束)

> ✍️ **这一节请用你自己的话复述后再定稿**(AGENTS.md 的"脱手重建"练习)。下面是参考要点,别照抄,合上笔记自己讲一遍再写。

参考要点:

- **`required` / `min` / `max` / `enum` 是 Mongoose 的"应用层校验"**:写入数据库**之前**就在代码层检查,抛 Mongoose 的 `ValidationError`(友好报错)。根本没碰数据库。
- **`unique` 不是校验器,而是"数据库层约束"**:靠 MongoDB 的唯一索引,要真的尝试写入、由数据库拦下,抛 `E11000`。
- **三个实际后果**:
  1. 唯一索引必须真的建好约束才生效。Mongoose 自动建索引是**异步、不保证时机**的——collection 已有数据或索引还没建完时,unique 可能暂时漏过重复。生产常 `autoIndex: false`,改成部署时显式建,保证可控。
  2. 处理"重复"错误时不能只 catch `ValidationError`,还得专门处理 `E11000`——两类错误分开处理。
  3. 报错信息格式不同,前端/日志的错误处理要分别对待。

一句话:**Mongoose 校验(写入前、友好报错)和数据库约束(唯一索引、`E11000`)是两层不同的防线,防线不同、报错不同、处理方式也不同。**

---

## 术语对照

| 中文 | 英文 | 备注 |
|---|---|---|
| 对象-文档映射 | ODM (Object-Document Mapping) | Mongoose 的本质定位 |
| 模式 / 约束声明 | Schema | 声明文档结构与校验规则 |
| 应用层校验 | schema validation | required/min/max/enum,抛 ValidationError |
| 数据库唯一约束 | unique index | 抛 E11000,非 Mongoose 校验 |
