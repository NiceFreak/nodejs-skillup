import { test, expect, describe, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../app.js';
import Order from '../models/orders.js';
import User from '../models/users.js';

let mongoServer;
let authToken;       // admin token
let memberToken;     // member token
let testUserId;
let memberUserId;

// 【生命周期1】所有测试开始前：起内存库 + 连接 + 创建测试用户 + 生成测试 token
beforeAll(async () => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        process.env.JWT_SECRET = 'test-secret-key-with-sufficient-length-32-chars';
    }

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    console.log('uri: ', uri);
    await mongoose.connect(uri);

    // --- 创建 admin 用户 ---
    testUserId = new mongoose.Types.ObjectId().toString();
    const adminPasswordHash = await bcrypt.hash('AdminPassword123', 10);
    await User.create({
        _id: testUserId,
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'admin',
        passwordHash: adminPasswordHash,
    });
    const adminPayload = { sub: testUserId };
    authToken = jwt.sign(adminPayload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // --- 创建 member 用户（新增） ---
    memberUserId = new mongoose.Types.ObjectId().toString();
    const memberPasswordHash = await bcrypt.hash('MemberPassword123', 10);
    await User.create({
        _id: memberUserId,
        name: 'Test Member',
        email: 'member@test.com',
        role: 'member',          // 默认角色，但显式指定
        passwordHash: memberPasswordHash,
    });
    const memberPayload = { sub: memberUserId };
    memberToken = jwt.sign(memberPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
});

// 【生命周期2】所有测试结束后：断开 + 关掉内存库
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// 【生命周期3】每个测试前：清空 orders（保留 users 数据），塞入已知测试数据
beforeEach(async () => {
    const monthsAgo = (n) => {
        const d = new Date();
        d.setMonth(d.getMonth() - n);
        return d;
    };
    await Order.deleteMany({});
    await Order.insertMany([
        {
            userId: '6a4b124711f7c4ea59f83a59',
            status: 'completed',
            totalAmount: 299,
            createdAt: monthsAgo(0),
        },
        {
            userId: '6a4b124741f7c4ea59f83a59',
            status: 'completed',
            totalAmount: 99,
            createdAt: monthsAgo(1),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'completed',
            totalAmount: 120,
            createdAt: monthsAgo(2),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'canceled',
            totalAmount: 1200,
            createdAt: monthsAgo(3),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'completed',
            totalAmount: 444,
            createdAt: monthsAgo(4),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'pending',
            totalAmount: 324,
            createdAt: monthsAgo(5),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'completed',
            totalAmount: 777,
            createdAt: monthsAgo(6),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'completed',
            totalAmount: 777,
            createdAt: monthsAgo(6),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'completed',
            totalAmount: 777,
            createdAt: monthsAgo(4),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'completed',
            totalAmount: 777,
            createdAt: monthsAgo(5),
        },
        {
            userId: '6a4b433e09e80f26133a7382',
            status: 'completed',
            totalAmount: 777,
            createdAt: monthsAgo(3),
        },
    ]);
});

describe('GET /reports/monthly-sales', () => {
    test('admin token 应返回 200 和月度数据', async () => {
        const res = await request(app)
            .get('/reports/monthly-sales?status=completed&months=6')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(6);
        const twoOrderMonth = res.body.find((r) => r.orderCount === 2);
        expect(twoOrderMonth.totalSpending).toBe(1221);
        expect(twoOrderMonth.avgOrderValue).toBe(610.5);
        const totalOrders = res.body.reduce((sum, r) => sum + r.orderCount, 0);
        expect(totalOrders).toBe(7);
    });

    // 新增：member token 应返回 403
    test('member token 应返回 403 权限不足', async () => {
        const res = await request(app)
            .get('/reports/monthly-sales?status=completed&months=6')
            .set('Authorization', `Bearer ${memberToken}`);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: '权限不足' });
    });
});
