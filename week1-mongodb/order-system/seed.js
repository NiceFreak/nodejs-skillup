// 订单系统 seed —— 造数据脚本。
// 职责单一:把数据放进去(幂等,可重复跑)。不在这里跑业务查询(那是 index.js 的活)。
//
// 机制(连接 / 清空 / 写入 / 验证 / 断开)已搭好;
// ⚠️ 数据内容是你的建模产出,按 TODO 填,我不代写。
//
// 用法:
//   npm install
//   先确保 MongoDB 在跑(见 ../docker-compose.yml)
//   npm run seed

const mongoose = require("mongoose");
const { connect, disconnect } = require("./db");
const User = require("./models/user.model");
const Order = require("./models/order.model");

async function seed() {
  await connect();

  // 1) 清空(幂等)。想一下:order 引用了 user,先清谁、后清谁?
  //    先清 order,再清 user。否则 order 里引用的 userId 会找不到,报错
  await Order.deleteMany({});
  await User.deleteMany({});

  // 2) 造 user —— 你来写(2~3 个,含嵌入的 addresses)
  //    insertMany 返回创建好的文档数组(带 _id),下一步建 order 要用到这些 _id。
  const users = await User.insertMany([
    // TODO(你来写):2~3 个 user
    {
      name: "Alice",
      email: "alice@example.com",
      addresses: [
        {
          recipient: "Alice",
          phone: "13800138000",
          province: "Guangdong",
          city: "Guangzhou",
          detailAddress: "123 Main St"
        }
      ]
    },
    {
      name: "Bob",
      email: "bob@example.com",
      addresses: [
        {
          recipient: "Bob",
          phone: "13800138001",
          province: "Beijing",
          city: "Beijing",
          detailAddress: "456 Second St"
        }
      ]
    },
    {
      name: "Charlie",
      email: "charlie@example.com",
      addresses: [
        {
          recipient: "Charlie",
          phone: "13800138002",
          province: "Shanghai",
          city: "Shanghai",
          detailAddress: "789 Third St"
        }
      ]
    },
  ]);

  // 3) 造 order —— 你来写
  //    难点(这次的真正练点):order 的引用字段要指向上一步某个 user 的 _id。
  //    例如 users[0]._id —— 把它接到 order 的引用字段上。
  //    快照字段(商品 name/price、收货地址)直接复制一份塞进 order。
  const orders = await Order.insertMany([
    // TODO(你来写):几条 order,引用字段指向 users 里某个 _id
    {
      userId: users[0]._id,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Product A",
          price: mongoose.Types.Decimal128.fromString("100.00"),
          quantity: 2
        }
      ],
      shippingAddress: users[0].addresses[0],
      amount: mongoose.Types.Decimal128.fromString("200.00")
    },
    {
      userId: users[1]._id,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Product B",
          price: mongoose.Types.Decimal128.fromString("50.00"),
          quantity: 1
        }
      ],
      shippingAddress: users[1].addresses[0],
      amount: mongoose.Types.Decimal128.fromString("50.00")
    },
    {
      userId: users[2]._id,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Product C",
          price: mongoose.Types.Decimal128.fromString("75.00"),
          quantity: 3
        }
      ],
      shippingAddress: users[2].addresses[0],
      amount: mongoose.Types.Decimal128.fromString("225.00")
    },
    {
      userId: users[0]._id,
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          name: "Product D",
          price: mongoose.Types.Decimal128.fromString("100.00"),
          quantity: 1
        }
      ],
      shippingAddress: users[0].addresses[0],
      amount: mongoose.Types.Decimal128.fromString("100.00")
    },
  ]);

  // 4) 验证写入
  console.log("seed done:");
  console.log("  users :", await User.countDocuments());
  console.log("  orders:", await Order.countDocuments());

  await disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
