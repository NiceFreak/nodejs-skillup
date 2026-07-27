import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import app from '../app.js';
import User from '../models/users.js';

describe('认证流集成测试', () => {
    let mongoServer;
    const adminEmail = 'admin@test.com';
    const adminPassword = 'AdminPass123456'; // 15 字符，符合业务规则
    let originalJwtSecret;

    beforeAll(async () => {
        // 保存并覆盖 JWT_SECRET，确保测试密钥确定
        originalJwtSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = 'test-secret-key-with-sufficient-length-32-chars';

        // 启动内存数据库
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        await mongoose.connect(uri);

        // 创建 admin 用户（只读 fixture）
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await User.create({
            name: 'Admin User',
            email: adminEmail,
            role: 'admin',
            passwordHash,
        });
    });

    afterAll(async () => {
        // 清理：先断开连接，再停止内存服务器
        await mongoose.disconnect();
        await mongoServer.stop();

        // 精确恢复 JWT_SECRET 原始状态
        if (originalJwtSecret !== undefined) {
            process.env.JWT_SECRET = originalJwtSecret;
        } else {
            delete process.env.JWT_SECRET;
        }
    });

    test('使用真实 admin 凭据登录，并用所得 token 访问受保护报表', async () => {
        // 第一步：登录，获取真实 token
        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: adminEmail, password: adminPassword });

        // 断言 1：登录成功
        expect(loginRes.status).toBe(200);

        // 断言 2：响应体中包含有效 accessToken
        expect(loginRes.body.payload).toBeDefined();
        expect(loginRes.body.payload.accessToken).toBeDefined();
        expect(typeof loginRes.body.payload.accessToken).toBe('string');
        expect(loginRes.body.payload.accessToken.length).toBeGreaterThan(0);

        const accessToken = loginRes.body.payload.accessToken;

        // 第二步：使用真实 token 访问受保护报表
        const reportRes = await request(app)
            .get('/reports/monthly-sales')
            .query({ status: 'completed', months: 6 })
            .set('Authorization', `Bearer ${accessToken}`);

        // 断言 3：受保护资源接受该 token 并正常返回
        expect(reportRes.status).toBe(200);
    });

    test('新注册用户登录后不能访问 admin 报表', async () => {
        // 第一步：注册一个新用户
        const registerEmail = 'newmember@test.com';
        const registerPassword = 'NewMemberPass12345'; // 15 字符以上
        const registerRes = await request(app)
            .post('/auth/register')
            .send({
                name: 'New Member',
                email: registerEmail,
                password: registerPassword,
            });

        // 注册成功
        expect(registerRes.status).toBe(201);
        expect(registerRes.body.data).toBeDefined();
        expect(registerRes.body.data.email).toBe(registerEmail);

        // 第二步：使用该用户登录
        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: registerEmail, password: registerPassword });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.payload.accessToken).toBeDefined();
        const accessToken = loginRes.body.payload.accessToken;

        // 第三步：携带 token 访问 admin 报表，预期 403
        const reportRes = await request(app)
            .get('/reports/monthly-sales')
            .query({ status: 'completed', months: 6 })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(reportRes.status).toBe(403);
        expect(reportRes.body).toEqual({ error: '权限不足' });
    });
});
