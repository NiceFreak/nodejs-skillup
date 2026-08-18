import express from 'express';
import crypto from 'node:crypto';
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
import { logger } from './config/logger.js';

const app = express();

// ---------- 请求日志中间件（含 requestId 生成 & 回写） ----------
app.use((req, res, next) => {
    const start = Date.now(); // 计时起点：中间件入口

    // 决定 requestId：Nginx 传的优先，否则本地兜底生成
    const nginxId = req.headers['x-request-id'];
    const requestId = nginxId || `local-${crypto.randomUUID()}`;
    // 挂到 req 上，供后续 error handler 等使用
    req.requestId = requestId;

    // ① 回写响应头（必须在 next() 之前）
    res.setHeader('X-Request-Id', requestId);

    // ② 注册 finish / close 监听（也必须在 next() 之前）
    let logged = false; // 去重标志

    res.on('finish', () => {
        if (logged) return;
        logged = true;

        const duration = Date.now() - start;
        const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
            req.ip ||
            req.socket?.remoteAddress;

        logger.info({
            method: req.method,
            path: req.path || req.url,
            statusCode: res.statusCode,
            requestId: req.requestId,
            duration,
            ip,
            ua: req.headers['user-agent'] || '',
            errorType: null, // 正常请求无错误类型
            requestStatus: 'finish',
        });
    });

    res.on('close', () => {
        if (logged) return;
        logged = true;

        const duration = Date.now() - start;
        const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) ||
            req.ip ||
            req.socket?.remoteAddress;

        logger.info({
            method: req.method,
            path: req.path || req.url,
            statusCode: res.statusCode || 0, // close 时可能尚未设置 statusCode
            requestId: req.requestId,
            duration,
            ip,
            ua: req.headers['user-agent'] || '',
            errorType: null,
            requestStatus: 'close',
        });
    });

    // ③ 继续向下传递
    next();
});

// ---------- 其他中间件 ----------
app.use(express.json());

// ---------- /health 探针（放在业务路由之前） ----------
app.get('/health', (req, res) => {
    // 不读 mongoose，只反映 HTTP 层是否活着
    res.status(200).json({ status: 'ok' });
    // 用 debug 级别，避免探针刷屏（默认 info 不输出）
    logger.debug({ path: '/health', statusCode: 200, requestId: req.requestId }, 'health check');
});

// ---------- 业务路由 ----------
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.use('/users', usersRouter);
app.use('/reports', reportRouter);
app.use('/auth', authRouter);

// ---------- catch-all（404） ----------
app.use((req, res, next) => {
    const err = new Error(`路由 ${req.method} ${req.path} 不存在`);
    err.statusCode = 404;
    next(err);
});

// ---------- error handler（用 pino 替换 console.error） ----------
app.use((err, req, res, next) => {
    // 1. 业务错误 → HTTP 状态码映射（保持不变）
    switch (err.constructor) {
        case UserValidationError:
            err.statusCode = 400;
            break;
        case InvalidCredentialsError:
            err.statusCode = 401;
            break;
        case AuthenticationError:
            err.statusCode = 401;
            break;
        case AuthorizationError:
            err.statusCode = 403;
            break;
        case EmailConflictError:
            err.statusCode = 409;
            break;
        case AggregationError:
            err.statusCode = 500;
            break;
        default:
            break;
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || '服务器内部错误';

    // 2. 用 pino 记录，带上 requestId 和错误类名
    const logData = {
        requestId: req.requestId || 'missing-request-id',
        errorType: err.constructor.name,
        statusCode,
        path: req.path || req.url,
        method: req.method,
    };

    if (statusCode >= 500) {
        logger.error(logData, 'request failed');
    } else {
        // 4xx 属于预期拒绝，记 warn
        logger.warn(logData, 'request failed (client error)');
    }

    // 3. 响应逻辑保持不变
    res.status(statusCode).json({ error: message });
});

export default app;
