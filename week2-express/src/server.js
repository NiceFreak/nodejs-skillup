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
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}/`);
});