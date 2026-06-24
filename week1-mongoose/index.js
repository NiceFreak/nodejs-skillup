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
  mongoose.model("User", userSchema)
  // 在 shop 库中创建 users 集合,并且集合中的文档必须符合 userSchema 的约束
  const User = mongoose.model("User")

  // 4. 用 Model 做 CRUD(自己写至少 create + find)
  // Create
  await User.create({ name: "Alice", age: 25, city: "New York", email: "alice@example.com" })
  await User.create({ name: "Bob", age: 30, city: "Los Angeles", email: "bob@example.com" })
  await User.create({ name: "Charlie", age: 22, city: "New York", email: "charlie@example.com" })
  await User.create({ name: "David", age: 28, city: "Chicago", email: "david@example.com" })
  await User.create({ name: "Eve", age: 35, city: "New York", email: "eve@example.com" })

  // Find
  await User.find({ city: "New York" })
  await User.find({ age: { $gt: 25 } })

  // Update
  await User.updateOne({ name: "Alice" }, { age: 26 })

  // Delete
  await User.deleteOne({ name: "Bob" })


  // 5. 断开连接
  await mongoose.disconnect()
}

main().catch(console.error);