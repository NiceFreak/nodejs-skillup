import express from 'express';
import { connectDB, disconnectDB } from './config/db.js';
import { usersRouter } from './routes/users.js';
import { reportRouter } from './routes/reports.js';
import { UserValidationError, EmailConflictError, AggregationError } from './errors/userErrors.js';

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

// 中间件: catch-all —— 捕获所有未匹配的路由
app.use((req, res, next) => {
  const err = new Error(`路由 ${req.method} ${req.url} 不存在`);
  err.statusCode = 404;
  next(err);  // 交给 error handler 处理
});

// 中间件: error handler —— 捕获错误,返回 500
// Mongoose ValidationError, 返回 400
// EmailConflictError, 返回 409
app.use((err, req, res, next) => {
  if (err instanceof UserValidationError) {
    err.statusCode = 400;
  } else if (err instanceof EmailConflictError) {
    err.statusCode = 409;
  } else if (err instanceof AggregationError) {
    err.statusCode = 500;
  }
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({ error: message });
  console.error('Error: ', `${statusCode}: ${message}`);
});

let server = null;

async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await disconnectDB();
      console.log(`${signal} Server closed`);
      process.exit(0);
    } catch (err) {
      console.error('Error during disconnecting from MongoDB:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


