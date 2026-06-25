// Week 1 · 样例数据重建脚本(mongosh)
//
// 用途:一条命令重建 Week 1 笔记里用到的两套数据,方便随时复跑 explain 对比、
//       或脱手重做 CRUD / 索引实验。
//
// 这是「造数据」的脚手架,不含本周的学习目标(建模决策、explain 判读都在 notes/ 里)。
// day2-3 笔记已注明:下面这个生成 5 万条数据的 for 循环属于样板,直接用。
//
// 用法(先用 docker-compose 起好 MongoDB):
//   mongosh "mongodb://root:example@localhost:27017/shop?authSource=admin" seed.js
//
// 故意不在这里预建索引:索引/explain 实验需要从「无索引基线」开始逐步加索引,
// 建索引是实验的一部分,留在 notes/day2-3-index.md 里按步骤手动做,不在 seed 里替你做掉。

const target = db.getSiblingDB("shop");

// 1) practice —— day1/day2 的 CRUD、条件查询、投影练习用的小数据集
target.practice.drop();
target.practice.insertMany([
  { name: "Alice", age: 30, city: "Guangzhou", tags: ["vip", "new"], score: 88 },
  { name: "Bob",   age: 25, city: "Shenzhen",  tags: ["new"],        score: 72 },
  { name: "Carol", age: 35, city: "Guangzhou", tags: ["vip"],        score: 95 },
  { name: "Dave",  age: 28, city: "Beijing",   tags: [],             score: 60 },
  { name: "Eve",   age: 42, city: "Shenzhen",  tags: ["vip", "old"], score: 78 },
]);

// 2) bigdata —— day2-3 的索引 / explain 实验用的大数据集(5 万条)
//    分布:age 18~67 共 50 档,每档约 1000 条;city 3 个值,每个约 16667 条。
target.bigdata.drop();
const docs = [];
for (let i = 0; i < 50000; i++) {
  docs.push({
    name: "User" + i,
    age: 18 + (i % 50),
    city: ["Guangzhou", "Shenzhen", "Beijing"][i % 3],
  });
}
target.bigdata.insertMany(docs);

print("seed done:");
print("  practice:", target.practice.countDocuments(), "(应为 5)");
print("  bigdata :", target.bigdata.countDocuments(), "(应为 50000)");
