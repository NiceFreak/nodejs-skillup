import express from 'express';
import { usersRouter } from './routes/users.js';
import { reportRouter } from './routes/reports.js';
import { authRouter } from './routes/auth.js';
import {
    UserValidationError,
    EmailConflictError,
    AggregationError,
    InvalidCredentialsError,
    AuthenticationError,
    AuthorizationError,
} from './errors/userErrors.js';

const app = express();

// 中间件: logger —— 记录请求方法、路径、状态码、耗时
app.use((req, res, next) => {
    const start = Date.now();
    next();
    res.on('finish', () => {
        const method = req.method;
        const url = req.url;
        const statusCode = res.statusCode;
        const end = Date.now();
        const duration = end - start;
        console.log('logger: ', method, url, statusCode, duration, 'ms');
    });
});

// 中间件: json parser —— 解析请求体为 JSON
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.use('/users', usersRouter);

app.use('/reports', reportRouter);

app.use('/auth', authRouter);

// 中间件: catch-all —— 捕获所有未匹配的路由
app.use((req, res, next) => {
    const err = new Error(`路由 ${req.method} ${req.url} 不存在`);
    err.statusCode = 404;
    next(err); // 交给 error handler 处理
});

// 中间件: error handler —— 捕获错误, 返回对应状态码
app.use((err, req, res, next) => {
    // 业务错误 → HTTP 状态码映射
    switch (err.constructor) {
        case UserValidationError:
            // 注册时密码长度不足、格式错误等 → 400
            err.statusCode = 400;
            break;
        case InvalidCredentialsError:
            // 登录时邮箱不存在、密码错误、无 passwordHash → 401
            // 注意：此错误与 AuthenticationError 的文案不同，但状态码相同
            err.statusCode = 401;
            break;
        case AuthenticationError:
            // 访问受保护路由时 token 无效、过期、格式错误 → 401
            err.statusCode = 401;
            break;
        case AuthorizationError:
            // 用户权限不足
            err.statusCode = 403;
            break;
        case EmailConflictError:
            // 注册时邮箱已被占用 → 409
            err.statusCode = 409;
            break;
        case AggregationError:
            // 报表聚合查询失败 → 500
            err.statusCode = 500;
            break;
        default:
            // 其他未知错误 → 500
            break;
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || '服务器内部错误';
    res.status(statusCode).json({ error: message });
    console.error('Error: ', `${statusCode}: ${message}`);
});

export default app;
