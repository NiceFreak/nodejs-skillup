// 订单系统验证查询 —— 跑业务查询,确认建模是对的。
// 与 seed.js 分工:seed 负责造数据,index 负责跑查询。两者都 import 同一套 Model。
//
// 机制已搭好;⚠️ 查询内容是你的产出,按 TODO 填,我不代写。
//
// 用法(先 npm run seed 铺好数据):
//   npm start        (即 node index.js)

const { connect, disconnect } = require("./db");
const User = require("./models/user.model");
const Order = require("./models/order.model");

async function main() {
  await connect();

  // a) 查某个 user 的所有 order —— 验证「引用」方向
  //    提示:先拿到一个 user(User.findOne(...)),再 Order.find({ 引用字段: user._id })
  // TODO(你来写)
  const user = await User.findOne({ email: "alice@example.com" });
  const orders = await Order.find({ userId: user._id });
  
  if(!user) {
    console.log("Run npm run seed first to create users and orders.");
    await disconnect();
    return;
  }

  console.log("User orders:", orders);

  // b) 取一条 order,确认快照字段独立于商品本体
  //    思路:看 order 里存的 name/price 是不是「下单那一刻」的值;
  //          就算你去改对应商品本体,这条 order 的快照也不应跟着变。
  // TODO(你来写)
  // 降序取最新订单
  const order = await Order.findOne({ userId: user._id }).sort({ createdAt: -1 })

  console.log("Order details:", order);
  console.log("itesms[].name/price 是下单时的快照,不随商品本体变动而变动");

  await disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
