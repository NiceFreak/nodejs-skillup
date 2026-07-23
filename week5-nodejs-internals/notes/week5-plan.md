# Week 5 计划 · Node.js 底层原理（7/20–7/25）

> W5 是核心保护周。目标不是把 Node.js 底层名词全部扫一遍，而是补上“每天写业务代码时依赖、但未必说得清”的运行时判断力：异步为什么按这个顺序执行、什么会阻塞事件循环、大文件为什么要用流、什么时候该把 CPU 密集任务移出主线程。本周不加测试平铺、不接新业务功能，只做可观测 demo + 原理说明 + 周复盘。

> 2026-07-23 调整：D2 因临时面试与无效下钻跨日，原定 D3 主题顺延到 D4。为避免再次跳步，W5 延长到周六 7/25：D4 只学 Stream，D5 只学错误与进程生命周期，D6 完成 Worker、重建与周验收。W6 仍从 7/27 开始，不受影响。

## 正式工作导向

本周不是为背诵底层术语或只应付面试。每个主题都必须落到潜在 Node.js 后端工作的三类判断：

1. **实现判断**：面对大文件导出、下游 I/O、CPU 密集任务时，能选择不会破坏服务稳定性的实现方向。
2. **Review 判断**：能识别整文件读入内存、忽略背压、吞掉异步错误、在主线程执行重计算等风险，并说明实际后果。
3. **排障判断**：能根据 event-loop delay、内存、任务完成分布和错误边界先提出可验证假设，不凭单一现象过度归因。

面试表达和 demo 只是上述能力的证据，不是学习目的。验收优先问“上线后会发生什么、如何观察、由谁负责处理”，再问术语。

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

- [x] **D2–D3（7/21–7/22）· libuv、线程池与阻塞判断**：用 demo 观察 CPU 密集任务阻塞 timer / HTTP 响应；用 `fs` / `crypto` 类任务观察线程池排队；明确 `UV_THREADPOOL_SIZE` 的作用边界；产出“I/O 慢 vs CPU 慢 vs 线程池慢”的判断表。因临时面试跨日完成，后半段超范围下钻已止损。

- [ ] **D4（周四 7/23）· Stream 与背压**：从“大文件导出 / 文件转发”的工作场景出发，对比一次性读文件与 stream 管道；观察 producer / consumer 速度不匹配时的背压信号；讲清 `pipe()`、`pipeline()`、`highWaterMark`、`drain`、stream error 的职责边界；产出一个本人实现的最小文件处理 demo。

- [ ] **D5（周五 7/24）· 错误边界与进程生命周期**：梳理同步错误、Promise rejection、Express async error、stream error、进程级异常的流转；设计 graceful shutdown 最小流程；产出一张“错误会被谁捕获”的表。

- [ ] **D6（周六 7/25）· Worker 边界 + 重建 + 周复盘**：用一个 CPU 密集小任务对比主线程阻塞与 worker offload；明确 worker threads / child_process 适用场景与成本；完成到期债务的第一档重建和掌握证据；整理本周 demo 讲稿和第 3 篇周复盘。

### D4 分段路线与闸门

D4 一次只推进一个判断点；当前闸门未通过，不开启下一段。

| 阶段 | 只解决的问题 | 工作产出 | 通过后才进入 |
|---|---|---|---|
| S1 业务风险 | 为什么大文件不能默认整块读入内存 | 能说明整块读取对内存、并发和首字节时间的影响 | S2 |
| S2 最小模型 | 数据如何从 Readable 流向 Writable | 能用 producer、consumer、chunk、buffer 讲清数据流 | S3 |
| S3 背压信号 | 消费者更慢时，生产者如何知道该停 | 能解释 `write() === false`、暂停生产和 `drain` 恢复之间的关系 | S4 |
| S4 证据 demo | 如何证明整块读取与流式处理的行为不同 | 本人先预测并实现最小 demo，保留内存现象和背压现象 | S5 |
| S5 生产边界 | 为什么生产代码优先考虑 `pipeline()` | 能解释成功、读失败、写失败时资源和错误由谁收口 | D4 验收 |

D4 的词汇和深度上限：

- 必须：`Readable`、`Writable`、chunk、buffer、backpressure、`highWaterMark`、`drain`、`pipe()`、`pipeline()`、stream error。
- 只作映射、不展开：`Transform`，用于理解“边读边转换”的工作场景。
- 明确不进入：Node Stream 源码、`_read/_write` 内部实现、TCP 背压链路、Web Streams、复杂自定义 Stream、精细 GC / benchmark 调优。
- 新概念只有在回答当前工作判断所必需时才引入；资料查询只查 API 表达，不把查询结果扩成新学习支线。

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

### D4 · Stream

- 能解释 `readFile` 和 stream 的内存差异。
- 能说明 backpressure 解决什么问题。
- 能处理并讲清 stream 错误和生命周期。

### D5 · 错误与生命周期

- 能说清 Express error handler 的捕获边界。
- 能区分业务错误、异步未捕获错误、进程级致命错误。
- 能画出 graceful shutdown 最小链路。

### D6 · Worker 与周验收

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
6. 能在 D6 脱离 AI 和文档串讲一个“Node.js 底层理解 demo”。

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

D6 周复盘只回答四个问题：

1. 本周哪个 Node.js 底层模型最能改变我写业务代码的判断？
2. 哪个概念仍然只是“听懂了”，还不能独立推导？
3. 哪个 demo 最能证明我不是只会背名词？
4. W6 收口时，哪些测试 / CI / 全栈 demo 会用到 W5 的理解？

是的，当前真实状态应明确写成：

```text
日历位置：W5 D3
内容进度：D2 刚刚系统完成
原定 D3 Stream 与背压：0 进展
```

不能因为笔记文件叫 Day 3，就把 Stream 算作已开始。

需要查资料本身不代表失败。`pbkdf2` API、fd、socket 等首次出现时允许查询；但后半段已经进入 poll、TCP、HTTP parser 的实现细节，超出了 D2 止步条件。这里有一部分是我出题跨度过大造成的，不应把时间成本全部归因于你掌握不足。

**真实进度风险**

7/22 收口时比计划落后一个完整主题，原安排只剩 D4、D5 两天：

- D4：必须把 Stream 与背压作为唯一主线。
- 原 D5：Worker demo、错误/进程生命周期和周复盘会挤在一起。
- 当前没有余量再做 fd、epoll、HTTP parser 等扩展。
- 7/23 已决定增加 D6，把错误生命周期与 Worker 拆开；若再发生中断，仍应顺延，而不是把未掌握内容标为完成。

**D4–D6 收口方案**

D4 只做：

```text
readFile vs stream 内存模型
→ producer / consumer 速度差
→ backpressure
→ pipe vs pipeline
→ stream error
→ 最小 demo
```

不学习 stream 源码、自定义复杂流或冷门事件。

D5 做错误边界与 graceful shutdown；D6 做：

```text
主线程 CPU vs worker offload
→ worker / child_process 边界
→ W5 串讲和复盘
```

7/22 不再开启 Stream；7/23 从 D4 S1 的工作场景进入。D4 不以覆盖术语数量验收，以能对真实后端文件链路作出实现、review 和排障判断为准。
