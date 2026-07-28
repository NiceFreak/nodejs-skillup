import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import app from '../app.js';
import User from '../models/users.js';

const SUFFIX = '_b';
const EXPECTED_BASE_DB = 'skillup_test';

let mongoServer = null;
let useExternal = false;
let originalJwtSecret;

describe('认证流集成测试', () => {
    const adminEmail = 'admin@test.com';
    const adminPassword = 'AdminPass123456';

    beforeAll(async () => {
        originalJwtSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = 'test-secret-key-with-sufficient-length-32-chars';

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
            dbName = basePath + SUFFIX; // skillup_test_b
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

        // 全局连接
        if (useExternal) {
            await mongoose.connect(connectUri, { dbName });
        } else {
            await mongoose.connect(connectUri);
        }

        // 清理旧数据
        await mongoose.connection.db.dropDatabase();

        // ★ 等待 User 模型初始化完成
        await User.init();

        // 创建 admin 用户（测试所需 fixture）
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await User.create({
            name: 'Admin User',
            email: adminEmail,
            role: 'admin',
            passwordHash,
        });
    });

    afterAll(async () => {
        if (useExternal) {
            // 外部模式：先删除测试库，再断开连接
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

        // 恢复 JWT_SECRET
        if (originalJwtSecret !== undefined) {
            process.env.JWT_SECRET = originalJwtSecret;
        } else {
            delete process.env.JWT_SECRET;
        }
    });

    test('使用真实 admin 凭据登录，并用所得 token 访问受保护报表', async () => {
        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: adminEmail, password: adminPassword });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.payload).toBeDefined();
        expect(loginRes.body.payload.accessToken).toBeDefined();
        expect(typeof loginRes.body.payload.accessToken).toBe('string');
        expect(loginRes.body.payload.accessToken.length).toBeGreaterThan(0);

        const accessToken = loginRes.body.payload.accessToken;

        const reportRes = await request(app)
            .get('/reports/monthly-sales')
            .query({ status: 'completed', months: 6 })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(reportRes.status).toBe(200);
    });

    test('新注册用户登录后不能访问 admin 报表', async () => {
        const registerEmail = 'newmember@test.com';
        const registerPassword = 'NewMemberPass12345';
        const registerRes = await request(app)
            .post('/auth/register')
            .send({
                name: 'New Member',
                email: registerEmail,
                password: registerPassword,
            });

        expect(registerRes.status).toBe(201);
        expect(registerRes.body.data).toBeDefined();
        expect(registerRes.body.data.email).toBe(registerEmail);

        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: registerEmail, password: registerPassword });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.payload.accessToken).toBeDefined();
        const accessToken = loginRes.body.payload.accessToken;

        const reportRes = await request(app)
            .get('/reports/monthly-sales')
            .query({ status: 'completed', months: 6 })
            .set('Authorization', `Bearer ${accessToken}`);

        expect(reportRes.status).toBe(403);
        expect(reportRes.body).toEqual({ error: '权限不足' });
    });
});
