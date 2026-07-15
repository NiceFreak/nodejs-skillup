import express from 'express';
import { usersRouter } from './routes/users.js';
import { reportRouter } from './routes/reports.js';
import { authRouter } from './routes/auth.js';
import {
  UserValidationError,
  EmailConflictError,
  AggregationError,
  InvalidCredentialsError,
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
  next(err);  // 交给 error handler 处理
});

// 中间件: error handler —— 捕获错误,返回 500
// Mongoose ValidationError, 返回 400
// 登录校验错误: 401
// EmailConflictError, 返回 409
app.use((err, req, res, next) => {
  if (err instanceof UserValidationError) {
    err.statusCode = 400;
  } else if (err instanceof InvalidCredentialsError) {
    err.statusCode = 401;
  } else if (err instanceof EmailConflictError) {
    err.statusCode = 409;
  } else if (err instanceof AggregationError) {
    err.statusCode = 500;
  }
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  res.status(statusCode).json({ error: message });
  console.error('Error: ', `${statusCode}: ${message}`);
});

export default app;
