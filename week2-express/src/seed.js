import mongoose from "mongoose";
import Order from "./models/orders.js";

const ObjectId = (id) => new mongoose.Types.ObjectId(id);

const orders = [
    // user 1
    // 0
    {
        userId: ObjectId('6a4b124741f7c4ea59f83a59'),
        status: 'completed',
        totalAmount: 1299.99,
        createdAt: new Date('2026-07-01T14:00:00')
    },
    // 1
    {
        userId: ObjectId('6a4b124741f7c4ea59f83a59'),
        status: 'pending',
        totalAmount: 299.3,
        createdAt: new Date('2026-07-02T13:00:00')
    },
    // 2
    {
        userId: ObjectId('6a4b124741f7c4ea59f83a59'),
        status: 'completed',
        totalAmount: 99,
        createdAt: new Date('2026-01-01T14:00:00')
    },
    // 3
    {
        userId: ObjectId('6a4b124741f7c4ea59f83a59'),
        status: 'canceled',
        totalAmount: 549,
        createdAt: new Date('2026-05-21T04:00:00')
    },
    // 4
    {
        userId: ObjectId('6a4b124741f7c4ea59f83a59'),
        status: 'refunded',
        totalAmount: 999.99,
        createdAt: new Date('2026-07-04T11:00:00')
    },
    // user 2
    // 5
    {
        userId: ObjectId('6a4b124841f7c4ea59f83a5b'),
        status: 'completed',
        totalAmount: 9.9,
        createdAt: new Date('2026-05-18T19:00:00')
    },
    // 6
    {
        userId: ObjectId('6a4b124841f7c4ea59f83a5b'),
        status: 'pending',
        totalAmount: 700,
        createdAt: new Date('2026-05-01T19:00:00')
    },
    // 7
    {
        userId: ObjectId('6a4b124841f7c4ea59f83a5b'),
        status: 'refunding',
        totalAmount: 9800.98,
        createdAt: new Date('2026-06-05T14:00:00')
    },
    // 8
    {
        userId: ObjectId('6a4b124841f7c4ea59f83a5b'),
        status: 'completed',
        totalAmount: 5432.1,
        createdAt: new Date('2026-06-06T20:00:00')
    },
    // user 3
    // 9
    {
        userId: ObjectId('6a4b124941f7c4ea59f83a5d'),
        status: 'completed',
        totalAmount: 2999,
        createdAt: new Date('2026-06-18T14:00:00')
    },
    // 10
    {
        userId: ObjectId('6a4b124941f7c4ea59f83a5d'),
        status: 'pending',
        totalAmount: 666,
        createdAt: new Date('2026-06-21T21:00:00')
    },
    // 11
    {
        userId: ObjectId('6a4b124941f7c4ea59f83a5d'),
        status: 'completed',
        totalAmount: 777.77,
        createdAt: new Date('2026-06-25T19:00:00')
    },
    // user 4
    // 12
    {
        userId: ObjectId('6a4b433e09e80f26133a7382'),
        status: 'completed',
        totalAmount: 1500,
        createdAt: new Date('2026-07-06T14:00:00')
    },
    // 13
    {
        userId: ObjectId('6a4b433e09e80f26133a7382'),
        status: 'canceled',
        totalAmount: 1299.99,
        createdAt: new Date('2026-07-03T13:00:00')
    },
];

async function seed() {
    try {
        // 1. 连接数据库
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);   // ← 见下面说明

        // // 2. 清空旧订单（可选但推荐）
        await Order.deleteMany({});            // ← 想清楚为什么要这步

        // // 3. 插入
        await Order.insertMany(orders, { timestamps: false }); // ← 关键：这里要不要加选项？

        console.log("seed done");
    } catch (err) {
        console.error("seed failed:", err);
    } finally {
        // 4. 断开连接
        await mongoose.disconnect();
    }
}

seed();