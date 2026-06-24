const mongoose = require("mongoose");

async function main() {
  // 1. 连接数据库(连接字符串你前两天用过,shop 库)
  await mongoose.connect("mongodb://root:example@localhost:27017/shop?authSource=admin")

  // 2. 定义 Schema —— 这是今天的核心,你自己写
  //    定义一个 User,要求:
  //    - name: 字符串,必填(required)
  //    - age: 数字,最小值 0(min)
  //    - city: 字符串
  //    - email: 字符串,唯一(unique)
  const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, min: 0 },
    city: { type: String },
    email: { type: String, unique: true }
  });

  // 3. 从 Schema 创建 Model
  // 在 shop 库中创建 users 集合,并且集合中的文档必须符合 userSchema 的约束
  const User = mongoose.model("User", userSchema)
  await User.deleteMany({}) // 清空 users 集合,方便测试

  // 4. 用 Model 做 CRUD(自己写至少 create + find)
  // Create
  await User.create({ name: "Alice", age: 25, city: "New York", email: "alice@example.com" })
  await User.create({ name: "Bob", age: 30, city: "Los Angeles", email: "bob@example.com" })
  await User.create({ name: "Charlie", age: 22, city: "New York", email: "charlie@example.com" })
  await User.create({ name: "David", age: 28, city: "Chicago", email: "david@example.com" })
  await User.create({ name: "Eve", age: 35, city: "New York", email: "eve@example.com" })

  // Find
  const results1 = await User.find({ city: "New York" })
  console.log("Users in New York: ", results1)
  const results2 = await User.find({ age: { $gt: 25 } })
  console.log("Users older than 25: ", results2)

  // Update
  await User.updateOne({ name: "Alice" }, { $set: { age: 26 } })

  // Delete
  await User.deleteOne({ name: "Bob" })

  // **任务:故意违反 Schema,看 Mongoose 怎么拦你。** 在你现有代码的 create 之后,加几条"违规"的 create,每条单独 try-catch 起来打印错误(这样一条报错不会中断后面的)。三个违规场景,你自己写:

  // 1. **违反 required**:create 一个**没有 name** 的用户(只给 age、city、email)。
  // 2. **违反 min**:create 一个 **age 为 -5** 的用户。
  // 3. **违反 unique**:create 两个**相同 email** 的用户。
  // **写之前先预测**:这三条违规,你觉得哪些会在 Mongoose 这一层就被拦下(根本到不了数据库)、哪些是数据库层面拦的?
  // 提示一个值得注意的差异:**required 和 min 是 Mongoose 的 Schema 校验**(在代码层、写入数据库之前就检查);
  // 而 **unique 其实不是 Schema 校验,它是数据库的索引约束**(要真的尝试写入、由 MongoDB 的唯一索引拦下)。
  // 这个区别有实际后果——unique 的报错信息长得和前两个不一样(你会看到 `E11000 duplicate key`,而不是 Mongoose 的校验错误)。

  try {
    await User.create({ age: 20, city: "Test City", email: "test@example.com" })
  } catch (err) {
    console.log("违反 required:", err.message)
    // 猜测: 违反 required 会在 Mongoose 这一层被拦下,不会到数据库层面
  }

  try {
    await User.create({ name: "Frank", age: -5, city: "Test City", email: "frank@example.com" })
  } catch (err) {
    console.log("违反 min:", err.message)
    // 猜测: 违反 min 会在 Mongoose 这一层被拦下,不会到数据库层面
  }

  try {
    await User.create({ name: "Grace", age: 25, city: "Test City", email: "grace@example.com" })
    await User.create({ name: "Henry", age: 30, city: "Test City", email: "grace@example.com" })
  } catch (err) {
    console.log("违反 unique:", err.message)
    // 猜测: 违反 unique 会在数据库层面被拦下,因为 Mongoose 不会检查唯一性
  }

  // 实际输出
  // 违反 required: User validation failed: name: Path `name` is required.
  // 违反 min: User validation failed: age: Path `age` (-5) is less than minimum allowed value (0).
  // 违反 unique: E11000 duplicate key error collection: shop.users index: email_1 dup key: { email: "grace@example.com" }

  // 5. 断开连接
  await mongoose.disconnect()
}

main().catch(console.error);