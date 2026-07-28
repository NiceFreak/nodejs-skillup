import { test, expect, describe, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../app.js';
import Order from '../models/orders.js';
import User from '../models/users.js';

const SUFFIX = '_a';
const EXPECTED_BASE_DB = 'skillup_test';

let mongoServer = null;
let useExternal = false;

let authToken;
let memberToken;
let testUserId;
let memberUserId;

beforeAll(async () => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        process.env.JWT_SECRET = 'test-secret-key-with-sufficient-length-32-chars';
    }

    const rawUri = process.env.MONGODB_URI;
    let connectUri;
    let dbName;

    if (rawUri) {
        const url = new URL(rawUri);
        const basePath = url.pathname.replace(/^\//, '');
        if (basePath !== EXPECTED_BASE_DB) {
            throw new Error(
                `Invalid test database: expected base name "${EXPECTED_BASE_DB}", got "${basePath}"`
            );
        }
        url.pathname = '';
        connectUri = url.toString();
        dbName = basePath + SUFFIX; // skillup_test_a
        useExternal = true;
        mongoServer = null;
    } else {
        if (process.env.CI) {
            throw new Error('MONGODB_URI is required in CI environment');
        }
        mongoServer = await MongoMemoryServer.create();
        connectUri = mongoServer.getUri();
        dbName = undefined;
        useExternal = false;
    }

    // 全局连接，指定 dbName（外部模式）或留空（内存模式）
    if (useExternal) {
        await mongoose.connect(connectUri, { dbName });
    } else {
        await mongoose.connect(connectUri);
    }

    // 清理旧数据
    await mongoose.connection.db.dropDatabase();

    // ★ 等待模型初始化完成（索引和集合结构），确保没有后台任务残留
    await User.init();
    await Order.init();

    // 创建 admin 用户
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

    // 创建 member 用户
    memberUserId = new mongoose.Types.ObjectId().toString();
    const memberPasswordHash = await bcrypt.hash('MemberPassword123', 10);
    await User.create({
        _id: memberUserId,
        name: 'Test Member',
        email: 'member@test.com',
        role: 'member',
        passwordHash: memberPasswordHash,
    });
    const memberPayload = { sub: memberUserId };
    memberToken = jwt.sign(memberPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
    if (useExternal) {
        // 外部模式：先删除整个测试库，再断开连接
        if (mongoose.connection.db) {
            await mongoose.connection.db.dropDatabase();
        }
        await mongoose.disconnect();
    } else {
        // 内存模式：先断开连接，再停止服务器
        await mongoose.disconnect();
        if (mongoServer) {
            await mongoServer.stop();
        }
    }
});

beforeEach(async () => {
    const monthsAgo = (n) => {
        const d = new Date();
        d.setMonth(d.getMonth() - n);
        return d;
    };
    await Order.deleteMany({});
    await Order.insertMany([
        { userId: '6a4b124711f7c4ea59f83a59', status: 'completed', totalAmount: 299, createdAt: monthsAgo(0) },
        { userId: '6a4b124741f7c4ea59f83a59', status: 'completed', totalAmount: 99, createdAt: monthsAgo(1) },
        { userId: '6a4b433e09e80f26133a7382', status: 'completed', totalAmount: 120, createdAt: monthsAgo(2) },
        { userId: '6a4b433e09e80f26133a7382', status: 'canceled', totalAmount: 1200, createdAt: monthsAgo(3) },
        { userId: '6a4b433e09e80f26133a7382', status: 'completed', totalAmount: 444, createdAt: monthsAgo(4) },
        { userId: '6a4b433e09e80f26133a7382', status: 'pending', totalAmount: 324, createdAt: monthsAgo(5) },
        { userId: '6a4b433e09e80f26133a7382', status: 'completed', totalAmount: 777, createdAt: monthsAgo(6) },
        { userId: '6a4b433e09e80f26133a7382', status: 'completed', totalAmount: 777, createdAt: monthsAgo(6) },
        { userId: '6a4b433e09e80f26133a7382', status: 'completed', totalAmount: 777, createdAt: monthsAgo(4) },
        { userId: '6a4b433e09e80f26133a7382', status: 'completed', totalAmount: 777, createdAt: monthsAgo(5) },
        { userId: '6a4b433e09e80f26133a7382', status: 'completed', totalAmount: 777, createdAt: monthsAgo(3) },
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

    test('member token 应返回 403 权限不足', async () => {
        const res = await request(app)
            .get('/reports/monthly-sales?status=completed&months=6')
            .set('Authorization', `Bearer ${memberToken}`);
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: '权限不足' });
    });
});
