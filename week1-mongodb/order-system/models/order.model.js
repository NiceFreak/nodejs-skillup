// Order Model —— ⚠️ 核心:Schema 字段是你的建模产出,由你填,我不代写。
//
// 对照 day1 的两个决策:
//
//   决策 1(订单 ↔ 用户:引用):
//     - 用什么字段指向 user?存什么类型?
//       提示:引用通常存对方的 _id。去查 mongoose 关键词:ObjectId、ref。
//       想清楚「存 _id」之后,之后怎么 find 回去(index.js 里要用到)。
//
//   决策 3(商品价格、收货地址:快照):
//     - items / 收货地址要存「下单那一刻复制的一份」,而不是只存一个会变的引用。
//       即把 name / price 等直接嵌进 order;通常 productId(引用)与 name/price(快照)并存。
//     - 自问:如果商品本体之后改名涨价,这条 order 应不应该跟着变?答案决定你存什么。
//
//   ⚠️ 金额别用浮点(day1 第 3 节那个 0.1+0.2≠0.3 的坑):
//       用整数(以「分」为单位)或 Decimal128。

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  // TODO(你来写):
  //   userId            —— 引用 user
  //   items             —— 商品快照数组(productId 引用 + name/price 快照)
  //   shippingAddress   —— 收货地址快照
  //   amount            —— 金额(整数分 / Decimal128,不要 Double)
  //   createdAt         —— 下单时间
});

module.exports = mongoose.model("Order", orderSchema);
