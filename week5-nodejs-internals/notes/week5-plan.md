# Week 5 计划 · Node.js 底层原理（7/20–7/24）

> W5 是核心保护周。目标不是把 Node.js 底层名词全部扫一遍，而是补上“每天写业务代码时依赖、但未必说得清”的运行时判断力：异步为什么按这个顺序执行、什么会阻塞事件循环、大文件为什么要用流、什么时候该把 CPU 密集任务移出主线程。本周不加测试平铺、不接新业务功能，只做可观测 demo + 原理说明 + 周复盘。

---

## 1. 本周核心问题

这周要回答的不是“我会不会写 Node.js 业务”，而是：

```text
我能不能从一段 Node.js 业务代码判断：
它会不会阻塞事件循环？
它的异步回调为什么按这个顺序执行？
慢点到底来自 I/O、CPU、线程池、数据库，还是代码结构？
大数据量时为什么要 stream，而不是一次性读进内存？
CPU 密集任务什么时候该交给 worker threads / child_process？
```

这也是对 Week3 问题的修正：先明确验收边界，再学概念；不能让“demo 跑通”伪装成“原理掌握”。

---

## 2. 必须真正搞懂的内容

### 2.1 事件循环与异步调度

必须能解释：

```text
同步代码
process.nextTick
Promise microtask
setTimeout
setImmediate
I/O callback
```

各自大概什么时候执行，为什么某些回调会先于另一些回调，为什么 microtask / nextTick 用错会饿死其他任务。

掌握标准：

- 能写一个最小脚本预测输出顺序。
- 能在预测错时解释错在哪个队列 / 阶段。
- 不靠背图，而是能用“调用栈 → microtask → event loop phase”推导。

### 2.2 libuv、I/O 与 CPU 阻塞

必须能解释：

```text
JS 主线程负责执行 JavaScript；
libuv 负责事件循环、I/O 抽象、定时器、线程池等底层协调；
异步 I/O 不等于开一个 JS 线程；
CPU 密集 JS 会阻塞事件循环；
部分异步任务会用到 libuv threadpool。
```

掌握标准：

- 能区分 I/O 慢、CPU 慢、线程池排队慢。
- 能用 demo 观察 CPU 阻塞导致 timer / request 延迟。
- 能说出 `UV_THREADPOOL_SIZE` 只影响部分线程池任务，不是“让 JS 变多线程”。

### 2.3 Stream 与背压

必须能解释：

```text
为什么大文件 / 大响应不能一次性读进内存；
Readable / Writable / Transform 大概怎么流动；
pipe / pipeline 解决什么；
backpressure 是什么；
highWaterMark / drain 大概表达什么信号；
stream error 为什么必须处理。
```

掌握标准：

- 能对比 `readFile` 与 stream 的内存模型。
- 能解释生产者过快、消费者过慢时为什么需要背压。
- 能讲清 `pipeline()` 为什么比裸 `pipe()` 更适合处理错误和生命周期。

### 2.4 错误与进程生命周期

必须能解释：

```text
同步 throw、Promise rejection、async handler error、stream error 的捕获边界；
Express 能捕获什么，捕获不了什么；
unhandledRejection / uncaughtException 代表什么级别的问题；
SIGTERM / graceful shutdown 为什么重要。
```

掌握标准：

- 能说清哪些错误会进 Express error handler，哪些会到进程级。
- 能解释为什么进程级异常不能简单吞掉继续跑。
- 能画出一次 graceful shutdown 的最小步骤。

### 2.5 Worker Threads / Child Process 的使用边界

必须能解释：

```text
worker threads / child_process 解决 CPU 密集或隔离执行问题；
它们不是普通 I/O 慢的默认解法；
线程通信和数据复制有成本；
小任务搬出去可能得不偿失。
```

掌握标准：

- 能判断一个任务是否应该移出主线程。
- 能用最小 demo 对比“主线程 CPU 阻塞”与“worker 执行后主线程仍可响应”。
- 不要求深入线程池实现或复杂任务调度。

---

## 3. 锦上添花 / 本周不追

以下内容只作为背景，不作为 W5 验收条件：

- libuv 源码阅读。
- V8 隐藏类、inline cache、JIT 优化细节。
- GC 深水区与完整调优参数。
- cluster 复杂部署策略。
- native addon / N-API。
- 手写任务调度器。
- flamegraph / clinic.js / autocannon 的完整性能分析链。
- 所有 event loop phase 的冷门边角。

这些可以进入 7/31 后 backlog；W5 不为了“显得底层”而加码。

---

## 4. 每日 Checklist

- [x] **D1（周一 7/20）· 事件循环最小模型**：用最小脚本观察并解释 `sync / nextTick / Promise / setTimeout / setImmediate` 的执行顺序；区分顶层代码与 I/O callback 中 `setTimeout` / `setImmediate` 的差异；产出一页事件循环心智模型。

- [ ] **D2（周二 7/21）· libuv、线程池与阻塞判断**：用 demo 观察 CPU 密集任务阻塞 timer / HTTP 响应；用 `fs` / `crypto` 类任务观察线程池排队；明确 `UV_THREADPOOL_SIZE` 的作用边界；产出“I/O 慢 vs CPU 慢 vs 线程池慢”的判断表。

- [ ] **D3（周三 7/22）· Stream 与背压**：对比一次性读文件与 stream 管道；观察 producer / consumer 速度不匹配时的背压信号；讲清 `pipe()`、`pipeline()`、`highWaterMark`、`drain`、stream error 的职责边界；产出一个文件处理或转发 demo。

- [ ] **D4（周四 7/23）· 错误边界与进程生命周期**：梳理同步错误、Promise rejection、Express async error、stream error、进程级异常的流转；设计 graceful shutdown 最小流程；产出一张“错误会被谁捕获”的表。

- [ ] **D5（周五 7/24）· Worker 边界 + 周复盘 + demo 串讲**：用一个 CPU 密集小任务对比主线程阻塞与 worker offload；明确 worker threads / child_process 适用场景与成本；整理本周 demo 讲稿和第 3 篇周复盘。

---

## 5. 每日止步条件

### D1

- 能不看答案预测一个事件循环脚本的输出顺序。
- 能解释至少一次预测错误来自哪个队列 / 阶段。
- 能说清 `nextTick` 与 Promise microtask 的优先级风险。

### D2

- 能用现象说明 CPU 密集 JS 会阻塞事件循环。
- 能区分“异步 I/O”与“JS 多线程”不是一回事。
- 能说清 `UV_THREADPOOL_SIZE` 不是万能性能开关。

### D3

- 能解释 `readFile` 和 stream 的内存差异。
- 能说明 backpressure 解决什么问题。
- 能处理并讲清 stream 错误和生命周期。

### D4

- 能说清 Express error handler 的捕获边界。
- 能区分业务错误、异步未捕获错误、进程级致命错误。
- 能画出 graceful shutdown 最小链路。

### D5

- 能判断一个任务是否该用 worker。
- 能讲清 worker 解决 CPU 阻塞，不是普通 I/O 慢的默认答案。
- 能串讲本周至少三个 demo：事件循环、阻塞/线程池、stream 或 worker。

---

## 6. 本周验收标准

W5 通过不以“写了多少 demo”为标准，而以能否讲清运行时判断为标准。

最低验收：

1. 能画出并讲清一个简化事件循环模型。
2. 能从一段代码判断是否会阻塞事件循环，并说明原因。
3. 能解释 I/O、CPU、threadpool、worker 的分工边界。
4. 能用 stream / backpressure 解释大文件处理为什么不能简单 `readFile`。
5. 能说明错误在哪一层被捕获，何时应让进程退出或做 graceful shutdown。
6. 能在 D5 脱离 AI 和文档串讲一个“Node.js 底层理解 demo”。

优秀验收：

- 能把 W5 原理映射回 Week2–4 的真实后端代码，例如：
  - bcrypt / jwt / MongoDB 查询中哪些是 CPU、哪些是 I/O；
  - Express 中间件里的 async error 如何进入全局错误处理；
  - 报表导出或日志处理为什么应该考虑 stream；
  - Login timing 风险里 bcrypt 耗时为什么会造成可观察差异。

---

## 7. 明确不做

- 不重构 Week2–4 主应用。
- 不新增业务 API。
- 不把 W5 做成完整性能优化周。
- 不引入 TypeScript。
- 不做 cluster / PM2 / Kubernetes 部署专题。
- 不为每个 demo 写完整测试；W5 只保护底层理解，W6 再做测试与工程化收口。

---

## 8. AI 协作方式

W5 属于 `AGENTS.md` 黑名单中的 Node.js 底层主题，援助上限 **L2**：

- AI 可以讲原理、拆问题、出题、review、给伪代码或实验步骤。
- 事件循环、流与背压、worker threads 等核心 demo 由本人自己写。
- 若 AI 给到 L2 骨架，需要按 `DEBT.md` 规则记账并安排延迟重建。
- 白名单工具性内容可以由 AI 处理，例如目录整理、笔记体例整理、demo 讲稿、命令说明。

协作重点：

```text
先预测
→ 再运行 demo
→ 对比输出
→ 解释为什么
→ 记录能迁移到业务代码的判断
```

W5 尤其避免“看完解释觉得懂了”。每个核心点必须至少有一个可观察现象作为证据。

---

## 9. 周复盘预设问题

D5 周复盘只回答四个问题：

1. 本周哪个 Node.js 底层模型最能改变我写业务代码的判断？
2. 哪个概念仍然只是“听懂了”，还不能独立推导？
3. 哪个 demo 最能证明我不是只会背名词？
4. W6 收口时，哪些测试 / CI / 全栈 demo 会用到 W5 的理解？
