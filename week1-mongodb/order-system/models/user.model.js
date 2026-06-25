// User Model —— ⚠️ 核心:Schema 字段是你的建模产出,由你填,我不代写。
//
// 对照 day1 决策 2(收货地址:嵌入):
//   - addresses 该怎么表达「嵌入」?
//     提示:在 Schema 里,字段值可以是一个「子文档数组」—— 数组里每个元素是一个有结构的对象。
//           去查 mongoose 关键词:embedded documents / subdocument array。
//   - 一个地址有哪些字段?(收件人、电话、省/市、详细地址……由你定)
//   - 想一下:地址要不要单独的 _id?嵌入子文档默认会带,够不够用?
//
// 其他用户字段(name / email 等)也由你定,约束写法(required/unique 等)可参考
// week1-mongoose/src/index.js 里 User 的写法。

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // TODO(你来写):name、email…… 以及 addresses(嵌入的子文档数组)
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  addresses: [{
    recipient: { type: String, required: true },
    phone: { type: String, required: true },
    province: { type: String, required: true },
    city: { type: String, required: true },
    detailAddress: { type: String, required: true },
  }],
});

module.exports = mongoose.model("User", userSchema);
