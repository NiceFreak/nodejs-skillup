// **阶段1 `$match` —— 你要填两个条件:**

// - status 的条件最简单:`status: "completed"` 这种直接等值匹配,不需要 `$eq`(虽然用也行)。
// - createdAt 要用范围运算符。"最近30天" = "createdAt 大于等于 30天前那个时刻"。30天前怎么算你上午知道了:`new Date(Date.now() - 30*24*60*60*1000)`。把它放进 `$gte`。
// - 提示:`$gte` 的写法是 `字段: { $gte: 值 }`。

// **你自己想:** 只要 `$gte`(大于等于30天前)就够了吗?需不需要再加个"小于等于今天"的上界?想想你的数据里有没有"未来"的订单——没有的话上界要不要无所谓,但为什么?(这是个可以想的点,不影响这次结果)

// **阶段2 `$group` —— 最核心,填一个分组键 + 三个统计字段:**

// 关键提示:
// - `_id` 是分组依据。你要按客户分,所以是 `"$userId"`(**带 `$` 前缀**——聚合里引用字段值必须带 `$`,这点上午强调过)。
// - `orderCount`(订单数):`$sum` 传固定值 `1` → 每条文档累加 1,就是计数。写法 `{ $sum: 1 }`。
// - `totalSpending`(总额):`$sum` 传**字段引用** → `{ $sum: "$totalAmount" }`。注意这里是 `"$totalAmount"` 带引号带 `$`,和上面传 `1` 不一样——一个是"对这个字段求和",一个是"每条加个常数"。
// - `avgOrderValue`(均值):`$avg` 传字段引用 → `{ $avg: "$totalAmount" }`。

// 字段名(`orderCount`/`totalSpending`/`avgOrderValue`)是你**自定义的输出名**,想叫什么叫什么,我这是举例。

// **阶段3 `$sort` —— 填按哪个字段、什么方向:**

// - 按"总消费金额降序"。总消费金额是你 `$group` 里造出来的那个字段(比如我上面叫 `totalSpending`)。
// - 降序 = `-1`,升序 = `1`。
// - 写法 `{ 字段名: -1 }`。
// - **关键理解**:这里能按 `totalSpending` 排,正是因为它是 `$group` 产出的字段,而 `$sort` 在 `$group` 之后——呼应你上午想通的"排序对象是分组产物"。

// **现在你把这三个阶段的空填满,拼成完整的 `db.orders.aggregate([...])`,在 mongosh 里跑。**

// 跑出来对照你的预测:
// - **应该 4 个分组**(u1/u2/u3/u4,u5 没订单不出现)
// - **u2 排第一**,totalSpending = `5432.1`
// - u3 有 2 条(orderCount=2),其余各 1 条
// - 顺序 u2 > u3 > u4 > u1

// **一个提前打预防针:** 结果里 `totalSpending`/`avgOrderValue` 可能显示成 `Decimal128("5432.1")` 这种带类型的样子,不是纯数字——这是我之前说的 Decimal128 特性,正常现象,别以为出错了。
import mongoose from 'mongoose';
import Order from './models/orders.js';

// async function runReport() {
//     try {
//         // 1. 连接（和 seed.js 一样，读 process.env.MONGODB_URI）
//         await mongoose.connect(process.env.MONGODB_URI);

//         // 2. 跑聚合（把你 mongosh 验证过的三阶段搬进来）
//         const result = await Order.aggregate([
//             {
//                 $match: {
//                     status: "completed",
//                     createdAt: {
//                         $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
//                     }
//                 }
//             },

//             {
//                 $group: {
//                     _id: "$userId",
//                     orderCount: {
//                         $sum: 1
//                     },
//                     totalSpending: {
//                         $sum: "$totalAmount"
//                     },
//                     avgOrderValue: {
//                         $avg: "$totalAmount"
//                     }
//                 }
//             },

//             {
//                 $sort: {
//                     totalSpending: -1,
//                 }
//             }
//         ]);

//         // 3. 打印结果
//         console.log(JSON.stringify(result, null, 2));
//     } catch (err) {
//         console.error("report failed:", err);
//     } finally {
//         // 4. 断开
//         await mongoose.disconnect();
//     }
// }

// async function runReport() {
//     try {
//         // 1. 连接（和 seed.js 一样，读 process.env.MONGODB_URI）
//         await mongoose.connect(process.env.MONGODB_URI);

//         // 2. 跑聚合（把你 mongosh 验证过的三阶段搬进来）
//         const result = await Order.aggregate([
//             {
//                 $match: {
//                     status: 'completed',
//                     createdAt: {
//                         $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
//                     }
//                 }
//             },
//             {
//                 $group: {
//                     _id: {
//                         year: { $year: "$createdAt" },
//                         month: { $month: "$createdAt" }
//                     },
//                     orderCount: {
//                         $sum: 1
//                     },
//                     totalSpending: {
//                         $sum: "$totalAmount"
//                     },
//                     avgOrderValue: {
//                         $avg: "$totalAmount"
//                     }
//                 }
//             },
//             {
//                 $sort: {
//                     "_id.year": 1,
//                     "_id.month": 1
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     orderCount: 1,
//                     totalSpending: 1,
//                     avgOrderValue: 1,
//                     year: "$_id.year",
//                     month: "$_id.month"
//                 }
//             },
//         ]);

//         // 3. 打印结果
//         console.log(JSON.stringify(result, null, 2));
//     } catch (err) {
//         console.error("report failed:", err);
//     } finally {
//         // 4. 断开
//         await mongoose.disconnect();
//     }
// }

async function runReport() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const result = await Order.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
            },
            {
                $group: {
                    _id: '$userId',
                    orderCount: {
                        $sum: 1,
                    },
                    totalSpending: {
                        $sum: '$totalAmount',
                    },
                    avgOrderValue: {
                        $avg: '$totalAmount',
                    },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId', // order 的 userId
                    foreignField: 'name', // ← 故意关联 user 的 name(没索引!)
                    as: 'userInfo',
                },
            },
            {
                $unwind: '$userInfo',
            },
            {
                $project: {
                    _id: 0,
                    orderCount: 1,
                    totalSpending: 1,
                    avgOrderValue: 1,
                    userId: '$_id',
                    customerName: '$userInfo.name',
                    customerEmail: '$userInfo.email',
                },
            },
            {
                $sort: {
                    totalSpending: -1,
                },
            },
        ]).explain('executionStats');

        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('report failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runReport();
