import mongoose from "mongoose";
import User from "./models/users.js";
import Order from "./models/orders.js";

/**
 * 订单种子脚本
 *
 * 运行：  node --env-file=.env seedOrders.js
 * 或：    npm run seed:orders
 *
 * 前置：先跑过 seedUsers.js（库里得有用户）。本脚本会从数据库读取真实用户，
 * 用他们的 _id 当 userId，这样订单一定能 join 上 users 集合，报表聚合才有意义。
 *
 * 每个用户随机生成若干订单，覆盖全部 status、跨越最近 8 个月的下单时间、
 * 带 1~4 个商品明细，方便 getCustomerSpending / getMonthlySalesTrend 出数据。
 */

const ORDERS_PER_USER_MIN = 3;
const ORDERS_PER_USER_MAX = 10;
const MONTHS_BACK = 8; // 订单时间分布在最近这些个月内
const RANDOM_SEED = 20260711;

// —— 可复现的伪随机数发生器 ——
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(RANDOM_SEED);

const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const randFloat = (min, max) => Math.round((rand() * (max - min) + min) * 100) / 100;

// status 加权：completed 最多，refunding 最少，贴近真实分布
const STATUS_POOL = [
    "completed", "completed", "completed", "completed", "completed",
    "pending", "pending", "pending",
    "canceled", "canceled",
    "refunded",
    "refunding",
];
const pickStatus = () => STATUS_POOL[Math.floor(rand() * STATUS_POOL.length)];

const products = [
    { name: "机械键盘", price: 399 },
    { name: "无线鼠标", price: 129 },
    { name: "27寸显示器", price: 1299 },
    { name: "人体工学椅", price: 899 },
    { name: "USB-C 扩展坞", price: 259 },
    { name: "降噪耳机", price: 1099 },
    { name: "移动固态硬盘 1TB", price: 549 },
    { name: "笔记本支架", price: 89 },
    { name: "4K 网络摄像头", price: 329 },
    { name: "无线充电器", price: 99 },
];

// 最近 MONTHS_BACK 个月内的随机时间点
function randomCreatedAt() {
    const now = Date.now();
    const earliest = now - MONTHS_BACK * 30 * 24 * 60 * 60 * 1000;
    return new Date(earliest + rand() * (now - earliest));
}

function buildOrdersForUser(userId) {
    const count = randInt(ORDERS_PER_USER_MIN, ORDERS_PER_USER_MAX);
    const orders = [];

    for (let i = 0; i < count; i++) {
        // 每单 1~4 个商品
        const itemCount = randInt(1, 4);
        const items = [];
        let totalAmount = 0;

        for (let j = 0; j < itemCount; j++) {
            const p = products[Math.floor(rand() * products.length)];
            const quantity = randInt(1, 3);
            // 价格上下浮动一点，制造分布
            const price = randFloat(p.price * 0.9, p.price * 1.1);
            totalAmount += price * quantity;
            items.push({
                productId: new mongoose.Types.ObjectId(),
                name: p.name,
                price,
                quantity,
            });
        }

        orders.push({
            userId,
            status: pickStatus(),
            totalAmount: Math.round(totalAmount * 100) / 100,
            items,
            createdAt: randomCreatedAt(),
        });
    }
    return orders;
}

async function seedOrders() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("缺少 MONGODB_URI 环境变量，请用 `node --env-file=.env seedOrders.js` 运行");
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);

        const users = await User.find({}, { _id: 1 });
        if (users.length === 0) {
            console.error("❌ 数据库里没有用户，请先运行  npm run seed:users");
            process.exitCode = 1;
            return;
        }

        const allOrders = users.flatMap((u) => buildOrdersForUser(u._id));

        // 清空旧订单，保证可重复运行
        await Order.deleteMany({});
        // timestamps: false —— 让 createdAt 用我们指定的值，而不是被插入时刻覆盖
        const inserted = await Order.insertMany(allOrders, { timestamps: false });

        console.log(`✅ seed orders done: 为 ${users.length} 个用户共插入 ${inserted.length} 笔订单`);

        // 顺手打印各状态数量，方便核对
        const byStatus = inserted.reduce((acc, o) => {
            acc[o.status] = (acc[o.status] || 0) + 1;
            return acc;
        }, {});
        console.log("   各状态订单数:", byStatus);
    } catch (err) {
        console.error("❌ seed orders failed:", err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedOrders();
