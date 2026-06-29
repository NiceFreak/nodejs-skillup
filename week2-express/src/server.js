const express = require('express');
const app = express();

// app.use((req, res, next) => {
//   console.log('A: 进入', req.method, req.url);  // ← 加上 req.url
//   next();
//   console.log('A: 离开');
// });

// app.use((req, res, next) => {
//   console.log('B: 进入');
//   next();
// 注释 next() 后, 终端返回
// A: 进入
// B: 进入
// B: 离开
// A: 离开
// 浏览器访问一直 loading
//   console.log('B: 离开');
// });

// app.use((req, res, next) => {
//   console.log('C: 进入');
//   next();
//   console.log('C: 离开');
// });

// A: 进入
// B: 进入
// C: 进入
// C: 离开
// B: 离开
// A: 离开
// A: 进入
// B: 进入
// C: 进入
// C: 离开
// B: 离开
// A: 离开

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

app.get('/health', (req, res) => {
  res.send('ok');
});

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.get('/about', (req, res) => {
  res.send('This is a simple Express server.');
});

app.get('/contact', (req, res) => {
  res.send('Contact us at contact@example.com');
});

app.get('/boom', async (req, res) => {
  await new Promise(r => setTimeout(r, 50));
  throw new Error('async 炸了');
});

// 中间件: catch-all —— 捕获所有未匹配的路由
app.use((req, res) => {
  const statusCode = 404;
  throw new Error(req.url + ' Not Found');
  next(err.statusCode); // 传给 error handler
});

// 中间件: error handler —— 捕获错误,返回 500
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || '错误';
  res.status(statusCode).json({ error: `${statusCode}: ${message}` });
  console.error('错误消息: ', `${statusCode}: ${message}`);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}/`);
});