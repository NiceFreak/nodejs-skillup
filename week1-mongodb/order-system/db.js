// 连接 / 断开 —— 机制(样板)。seed.js 和 index.js 都复用这里,连接串只写一处。
const mongoose = require("mongoose");

const MONGODB_URI =
  "mongodb://root:example@localhost:27017/shop?authSource=admin";

async function connect() {
  await mongoose.connect(MONGODB_URI);
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
