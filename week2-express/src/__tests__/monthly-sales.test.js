import { test, expect, describe, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import Order from '../models/orders.js';

let mongoServer;
let authToken;

// 【生命周期1】所有测试开始前：起内存库 + 连接 + 生成测试 token
beforeAll(async () => {
    // 为测试环境设置一个强度足够的 JWT_SECRET
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        process.env.JWT_SECRET = 'test-secret-key-with-sufficient-length-32-chars';
    }
    // 生成有效 token（sub 可以是任意字符串，报表接口不依赖 userId）
    const payload = { sub: 'test-user-id' };
    authToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    console.log('uri: ', uri);
    await mongoose.connect(uri);
});

// 【生命周期2】所有测试结束后：断开 + 关掉内存库
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// 【生命周期3】每个测试前：清空 + 塞入已知测试数据
beforeEach(async () => {
    const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
    await Order.deleteMany({});
    await Order.insertMany([
        {
            "userId": "6a4b124711f7c4ea59f83a59",
            "status": "completed",
            "totalAmount": 299,
            "createdAt": monthsAgo(0),
        },
        {
            "userId": "6a4b124741f7c4ea59f83a59",
            "status": "completed",
            "totalAmount": 99,
            "createdAt": monthsAgo(1),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "completed",
            "totalAmount": 120,
            "createdAt": monthsAgo(2),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "canceled",
            "totalAmount": 1200,
            "createdAt": monthsAgo(3),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "completed",
            "totalAmount": 444,
            "createdAt": monthsAgo(4),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "pending",
            "totalAmount": 324,
            "createdAt": monthsAgo(5),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "completed",
            "totalAmount": 777,
            "createdAt": monthsAgo(6),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "completed",
            "totalAmount": 777,
            "createdAt": monthsAgo(6),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "completed",
            "totalAmount": 777,
            "createdAt": monthsAgo(4),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "completed",
            "totalAmount": 777,
            "createdAt": monthsAgo(5),
        },
        {
            "userId": "6a4b433e09e80f26133a7382",
            "status": "completed",
            "totalAmount": 777,
            "createdAt": monthsAgo(3),
        },
    ]);
});

describe('GET /reports/monthly-sales', () => {
    test('返回按月分组的销售统计', async () => {
        const res = await request(app)
            .get('/reports/monthly-sales?status=completed&months=6')
            .set('Authorization', `Bearer ${authToken}`); // 添加认证头

        expect(res.status).toBe(200);
        // 断言:有 6 个月份分组
        expect(res.body).toHaveLength(6);
        const twoOrderMonth = res.body.find(r => r.orderCount === 2);
        expect(twoOrderMonth.totalSpending).toBe(1221);
        expect(twoOrderMonth.avgOrderValue).toBe(610.5);
        // 断言:所有月份都是 completed 统计(canceled/pending 被排除),completed 共 7 单
        const totalOrders = res.body.reduce((sum, r) => sum + r.orderCount, 0);
        expect(totalOrders).toBe(7);
    });
});
