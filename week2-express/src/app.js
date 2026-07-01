import express from 'express';
import { connectDB } from './config/db.js';
import { listUsersRouter, createUserRouter } from './routes/users.js';
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

app.use('/users', listUsersRouter);

app.use('/users', createUserRouter);

// 中间件: catch-all —— 捕获所有未匹配的路由
app.use((req, res, next) => {
  const err = new Error(`路由 ${req.method} ${req.url} 不存在`);
  err.statusCode = 404;
  next(err);  // 交给 error handler 处理
});

// 中间件: error handler —— 捕获错误,返回 500
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || '错误';
  res.status(statusCode).json({ error: `${statusCode}: ${message}` });
  console.error('错误消息: ', `${statusCode}: ${message}`);
});

async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Express server running at http://localhost:${PORT}/`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();

