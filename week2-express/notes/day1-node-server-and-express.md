# Day 1 · 原生 HTTP → Express · 中间件管道

> Express 不是替代了 `http`，是**封装了 `http`**。手写原生 server 再用 Express 重写同一件事，才能看清它省掉了什么、为什么省。中间件管道（洋葱模型 + `next()`）是 Week 2 真正的地基。

---

## 1. 原生 `http` 模块

### 1.1 核心 API

```javascript
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
});
server.listen(3000);
```

- `req`（IncomingMessage）—— 请求对象，包含 `req.url`、`req.method` 等
- `res`（ServerResponse）—— 响应对象，用于写回数据
- `res.writeHead(statusCode, headers)` —— 发送响应头，**一旦发出不可逆**
- `res.end(data)` —— 结束响应。不调 `end()`，浏览器会一直转圈等待

### 1.2 踩过的坑

**`writeHead` 不能放在路由分支之前。** 如果所有分支共用一个 `writeHead(200)`，404 分支的状态码就永远是 200——状态码和内容对不上。正确做法：状态码用变量，`writeHead` 放在分支之后统一调用一次。

```javascript
let statusCode = 200;
let responseText = '';
switch (req.url) {
  case '/':      responseText = 'Hello, World!'; break;
  case '/about': responseText = 'About page';    break;
  default:       statusCode = 404; responseText = '404 Not Found';
}
res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
res.end(responseText);
```

**`res` 本质是一个流（stream）。** `end()` 是"关流"的动作，关了再写会抛 `ERR_STREAM_WRITE_AFTER_END`。响应一旦发出 / 结束，就不可逆。（Week 5 会正面讲 streams）

### 1.3 痛点：手动路由

区分不同 URL 需要自己写 `switch (req.url)`；如果还要区分 GET/POST，switch 会膨胀。这正是 Express 路由要解决的问题。

---

## 2. Express 对比：省掉了什么

### 2.1 最小骨架

```javascript
const express = require('express');
const app = express();

app.get('/health', (req, res) => { res.send('ok'); });
app.listen(3000);
```

### 2.2 三个核心差异

| 对比点 | 原生 http | Express |
|---|---|---|
| 路由 | 自己写 `switch (req.url)` | 声明式 `app.get('/path', handler)` |
| 响应头 | 手动 `res.writeHead(statusCode, headers)` | `res.send()` 自动设置 200、`Content-Type`、`Content-Length`、`ETag` |
| 404 兜底 | 自己在 `default:` 里写 | Express 默认返回 `Cannot GET /xxx` |

- `res.send(string)` 默认 `Content-Type: text/html`（不是 `text/plain`）
- `http.createServer` 藏进了 `app.listen` 底下——没消失，是被包起来了
- Express 的路由匹配本质是"挨个试、一个不中再试下一个"的链条——这就是**中间件管道**

---

## 3. 中间件管道（洋葱模型）

### 3.1 实验观察

```javascript
app.use((req, res, next) => {
  console.log('A: 进入');
  next();
  console.log('A: 离开');
});
// B、C 同理
```

打印顺序：`A进 → B进 → C进 → C离 → B离 → A离`

### 3.2 为什么"离开"是反序

**`next()` 是一个会"阻塞"到后续链条全部跑完才返回的调用。** A 调 `next()` 时不是结束，而是卡在这一行，等 B、C 全跑完才返回，然后才执行"A: 离开"。

本质是**函数调用栈**：A 调 B，B 调 C，C 到底了往回弹。进去时从外皮 A 穿到芯 C，出来时从芯 C 穿回外皮 A。**同一层的"进入"和"离开"包裹着它内部的一切**——这个"包裹"结构可用于计时、收尾。

### 3.3 `next()` 是命脉

注释掉 B 的 `next()` 后：`A进 → B进 → B离 → A离`，浏览器转圈。

- C 和后续路由**根本没执行**——`next()` 是传递棒，不交棒下一棒跑不了
- B 自己的函数体跑完了（"链条没往下走"和"已进入的中间件跑完自己"是两回事）
- 浏览器转圈——没有任何一环调用过 `res.send()` / `res.end()`，响应没结束

### 3.4 中间件铁律

> **一个中间件，要么调 `next()` 把请求往下传，要么自己产生响应（`res.send` 等）把请求了结。两件事必须做且只做其一。**
>
> - 都不做 → 请求卡死
> - 都做了 → 撞 `headers already sent` 错误

### 3.5 `app.use` 的陷阱：favicon 与 DevTools

一次浏览器访问，服务器实际收到**多个**请求（`/favicon.ico`、DevTools 的 `/.well-known/...`）。`app.use` 不带路径时对**所有请求**生效，这些自动请求也会穿过中间件链。带路径的 `app.use('/api', ...)` 可限制生效范围。

---

## 4. 实战：Logger 中间件

### 4.1 目标输出

```
GET /contact 200 - 3ms
```

### 4.2 为什么不能在 `next()` 之后直接量耗时

同步路由下，`next()` 之后量是准的。但 `async` 路由：

```javascript
app.get('/contact', async (req, res) => {
  await new Promise(r => setTimeout(r, 100));  // 模拟 100ms 异步操作
  res.send('Contact us');
});
```

`next()` 调用路由，路由遇到 `await` **立刻把控制权交还**（没等 100ms 就返回了），于是 `next()` 之后立刻算耗时——**量到 0ms，而真实耗时 100ms**。

> **`next()` 之后的代码，只能捕捉同步路由的结束，捕捉不到异步路由真正的"响应发出"时刻。**

### 4.3 正确解法：`res.on('finish')`

```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('logger:', req.method, req.url, res.statusCode, duration, 'ms');
  });
  next();
});
```

`res.on('finish')` 绑定的是"响应真正发出去"这个物理事实——不管路由是同步还是异步、正常还是出错，只要响应真的发出了，回调就触发。

---

## 5. EventEmitter：`res.on` 的本质

`res.on` 不是 Express 给的，是 Node 的 **EventEmitter** 给的。

- `res` 沿原型链往上是 EventEmitter（事件发射器）
- `res.on('finish', cb)` = 向 res **订阅** `'finish'` 事件，登记一个将来被回调的函数
- `res.emit('finish')` = 触发方（Express/Node 内部在响应结束时调用），所有听众的回调被挨个执行

**关键性质：注册不阻塞。** `res.on('finish', cb)` 瞬间执行完（只是把 cb 记到名单上），然后立刻往下走 `next()`。两件事时序不冲突——既能"登记一个未来才跑的计时结算"，又不耽误当下把请求放行。

| API | 作用 |
|---|---|
| `on('event', cb)` | 每次该事件触发都执行 cb |
| `once('event', cb)` | 只触发一次，之后自动注销 |
| `emit('event')` | 触发事件（通常由框架内部调用） |

> `'finish'` 不是唯一事件。客户端中途断开连接会发 `'close'`。EventEmitter 是 Node 地基之一，Week 5 会正面碰它。

---

## 6. 错误处理

### 6.1 同步 `throw`

```javascript
app.get('/boom', (req, res) => {
  throw new Error('炸了');
});
```

- Express **默认错误处理器**接住 throw，返回 **500** + 栈信息
- **抛错的人（路由）≠ 发响应的人（错误处理器）**——路由只 `throw`，发 500 是兜底替你做的
- 开发环境浏览器能看到完整栈；生产环境 Express 会隐藏栈
- Logger 照常打出 `500`——因为错误处理器发出了响应，`finish` 照常触发

### 6.2 异步 `throw` 与 Express 版本差异（重要）

```javascript
app.get('/boom', async (req, res) => {
  await new Promise(r => setTimeout(r, 50));
  throw new Error('async 炸了');
});
```

| 版本 | 行为 |
|---|---|
| **Express 4** | async 路由抛错**接不住**——`throw` 在 await 之后的异步阶段，Express 4 的 try/catch 只包同步层。结果：浏览器转圈、logger 不打、冒泡成 `unhandledRejection`。需要 `express-async-errors` 等补丁库 |
| **Express 5**（当前使用 v5.2.1） | **原生支持 async 错误处理**——路由返回的 Promise 被 reject 时，框架自动转交默认错误处理器。无需任何补丁 |

> **读旧资料的注意事项：** 网上大量教程是 v4 时代写的，会教你装 `express-async-errors` 或在每个 async 路由里套 `try/catch` + `next(err)`。在 v5 上这些是在**补一个已不存在的洞**。看到这类建议，先确认自己的版本。

验证版本的旁证：栈路径 `node_modules/router/...` 是 v5 的独立 router 包，v4 是 `express/lib/router`。

### 6.3 自定义错误处理中间件

Express 靠**函数参数个数**区分普通中间件和错误处理中间件——四个参数 `(err, req, res, next)` 即为错误处理。

```javascript
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || '错误';
  res.status(statusCode).json({ error: `${statusCode}: ${message}` });
  console.error('错误消息:', `${statusCode}: ${message}`);
});
```

**必须放在所有路由之后、`app.listen` 之前**——错误是路由执行时才产生的，处理它的人得排在产生它的人之后。

踩过的坑：
- 放在路由前面 → 永远不触发（普通流程里错误处理中间件被跳过，只有出错时才往后找）
- `res.statusCode` 是个会变的值，读取时机决定读到什么。在 `res.status(500)` **之前**读是 200，**之后**读才是 500

### 6.4 catch-all 404 兜底中间件

访问不存在的路径**没有 error 对象**产生，不会进错误处理中间件。需要在所有路由之后、错误处理中间件之前放一个 catch-all：

```javascript
app.use((req, res, next) => {
  const err = new Error(`路由 ${req.method} ${req.url} 不存在`);
  err.statusCode = 404;
  next(err);
});
```

- 自己不碰响应，只造 error + 挂 statusCode + `next(err)` 转交
- 错误处理中间件通过 `err.statusCode || 500` 自动分流——404 和 500 都从同一个出口出去（**单一出口模式**）

踩过的坑：
- `throw` 之后的代码是死代码——`throw` 一旦执行函数立刻中断
- `next(err)` 传的是 **error 对象**，不是数字——statusCode 必须**挂在 err 身上**
- 函数参数里漏写 `next` → `next is not defined`

---

## 7. 完整中间件链条

```
logger（最前：计时 + 记录，finish 时结算）
  → 各路由（/health /boom …）
    → catch-all（漏网的 → 造带 statusCode=404 的 err → next(err)）
      → error handler（唯一出口：读 err.statusCode 分流，404/500 都从这出去）
```

---

## 8. Day 1 核心收口

| 知识点 | 一句话 |
|---|---|
| 中间件铁律 | `next()` 传递 vs `res.send()` 了结，二选一，都不做则卡死 |
| 洋葱模型 | `next()` 是阻塞调用 → 函数调用栈 → 进顺出反 → "包裹"特性可用于计时/收尾 |
| 耗时计算 | `next()` 之后量会漏报异步；`res.on('finish')` 绑定物理事实，跨同步/异步/出错都准 |
| `res.on` 本质 | res 是 EventEmitter，`on` 是订阅，登记不阻塞，所以能和 `next()` 并存 |
| 错误处理 | 抛错的人 ≠ 发响应的人；错误处理中间件靠**四参数**识别，靠**位置**生效 |
| Express 5 彩蛋 | v5 原生接住 async 抛错，v4 不行；读旧资料注意版本差异 |
| 单一出口 | catch-all + error handler，所有错误响应从一个口子出去 |
| `res.statusCode` 时序 | 它是流动的值，读取时机决定读到什么——和 `writeHead` 不可逆是同一条主线 |

---

## 9. 埋下的伏笔

- `res` 是**流**——Week 5 讲 streams 时会回到 `write after end`
- **EventEmitter** —— Week 5 讲事件循环时正面碰它
- `app.use('/api', ...)` 带路径限制 —— 后续路由分组会用
- `res.on('close')` —— 客户端断开连接的处理
- `headers already sent` —— 忘了 `return` 导致重复响应时会撞
