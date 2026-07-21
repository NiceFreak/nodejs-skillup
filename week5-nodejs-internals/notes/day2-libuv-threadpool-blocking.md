# Week 5 Day 2 · libuv、线程池与阻塞判断

今天从 D1 的“回调何时被调度”推进到“异步工作在哪里执行、慢在哪里发生”。核心产出不是背 API 清单，而是用可观察实验区分 CPU 密集 JavaScript、异步 I/O 与 libuv threadpool 排队。

## 今日目标

- 用现象说明 CPU 密集的同步 JavaScript 会阻塞事件循环。
- 区分异步 I/O 与 JavaScript 多线程不是一回事。
- 观察部分 `fs` / `crypto` 任务在线程池中的排队现象。
- 说明 `UV_THREADPOOL_SIZE` 的作用边界。
- 产出“I/O 慢 vs CPU 慢 vs 线程池慢”判断表。

## 明确不做

- Stream 与背压（D3）。
- 错误边界与 graceful shutdown（D4）。
- Worker Threads / Child Process（D5）。
- Week2–4 主应用改造。

## 开始前基线

事实（2026-07-21）：

```text
Node: v24.16.0
npm run day1: 通过
本次观测: start → end → nextTick → promise → setImmediate → setTimeout
```

最后两项只是本次顶层运行样本，不表示固定顺序。

## 第一阶段 · CPU 阻塞

### 开始前回答

问题：CPU 密集的同步 JavaScript 执行期间，即使一个 timer 已经到期，它的 callback 为什么仍不能运行？

我的回答：

> 待填写。

### 实验前预测

> 待本人写下 timer 预计延迟、输出顺序及理由后再实现和运行。

## 第二阶段 · libuv threadpool 排队

### 实验前预测

> 待第一阶段验收后再展开；先判断待测 API 的工作由谁执行，再预测并发任务的完成分组。

## 判断表

> 待实验后根据证据填写，不预先抄结论。

## 验证证据

- 本人修正测量基准后运行：CPU `20ms` 时 callback 实际等待 `101ms`、迟到 `1ms`；CPU `2000ms` 时 callback 实际等待 `2011ms`、迟到 `1911ms`。
- AI review 独立复验：语法检查通过；隔离运行时 CPU `20ms` 对应等待 `100ms`、迟到 `0ms`，同源 `2000ms` 变体对应等待 `2004ms`、迟到 `1904ms`。
- 并行运行两组会引入进程间 CPU 竞争，因此不作为受控对照证据；正式结论采用隔离运行结果。

## 已完成 / 未完成

- 已完成：状态恢复、D1 最小基线复验、D2 范围确认、CPU 阻塞测量模型与 20ms / 2000ms 对照实验。
- 未完成：线程池排队实验、`UV_THREADPOOL_SIZE` 对照、判断表与当天收口。
- 计划变化：2026-07-21 因临时面试暂停学习；恢复入口固定为 threadpool 归属判断，不把外部中断记为掌握失败，也不通过赶工压缩后续实验。

## AI 辅助记录

- 前期状态恢复、范围拆分、时间关系纠正和出题属于 L1 引导。
- AI 辅助范围：CPU 阻塞 demo 的 timer 测量基准；未修改核心脚本。
- 援助级别与场景：L2 定向 review。本人完成 20ms / 2000ms 对照后，AI 指出计时基准早于预测日志和 timer 注册，导致“实际等待”包含注册前开销。
- 本人理解验证：已独立修正四个时间点并重跑两组对照，当前实验验收通过；仍需按计划完成 2026-07-24 延迟重建和至少两项掌握证据后还债。
- 延迟重建日期：2026-07-24，按第一档只看本人一页笔记重建该测量模型；已同步 `DEBT.md` 与 `LEARNING-STATE.md`。

先问答, 最后再整理.

W5 D2 已开始，状态和今日笔记已同步。D1 基线复验通过，当前无阻塞。

**D2 / 阶段 1：CPU 阻塞**

请先只回答一个问题，不写代码：

> CPU 密集的同步 JavaScript 正在执行时，即使某个 timer 已经到期，它的 callback 为什么仍然不能运行？

请从“JS 主线程、调用栈、timer 到期、callback 获得执行机会”这四点串起来解释。

A: JS 主线程是单线程的, CPU 密集的同步 JavaScript 正在执行时, 意味着主线程的调用栈很难处于非空状态, 始终在运行同步代码, 即使某个 timer 已经到期, 只要 JS 调用栈非空, 它的 callback 就还是只具备被调度的资格, 等待被调用, 仍需等待事件循环进入相应调度机会，才能被压入唯一的 JS 调用栈执行. 按照我们昨天的推理, 以 setTimeout(cb, 0) 为例, 0 代表的是最小等待时间,而不是保证立即执行, 只意味着当轮到异步回调可调用时最快运行. 

方向正确，但暂时不能通过，有两个模型用词需要纠正：

- 不是“主线程非空”，而是 **JS 调用栈非空**。同步 CPU 任务返回前，当前栈帧一直占据执行权。
- 不存在“异步调用栈”。timer 到期只表示 callback **具备被调度的资格**；它仍需等待事件循环进入相应调度机会，才能被压入唯一的 JS 调用栈执行。

你对 `setTimeout(0)` 的理解正确：它表达最早可调度阈值，不保证立即执行。

**D2 / 阶段 1 · 纠正题**

请重新组织最后一段，只串这条因果链：

```text
同步 CPU 任务未返回
→ JS 调用栈未清空
→ timer 虽已到期但只能等待
→ callback 何时才能进入调用栈
```
A: 同步 CPU 任务未返回 -> JS 调用栈未清空 -> timer 虽已到期但只能等待 -> JS 调用栈清空 -> callback 进入调用栈

前半段正确，但因果链还差一个必要条件：

```text
JS 调用栈清空 ≠ timer callback 立刻进入调用栈
```

调用栈清空只是“可以调度”的前提，不保证 timer 就是下一个执行者。

**D2 / 阶段 1 · 补充题**

JS 调用栈清空后，timer callback 真正进入调用栈之前，事件循环还必须满足什么条件？只补这一环。

A: 
nextTick, 微任务(promise) 等更高优先级的任务在 callback 边界的检查点被清空后, 轮到 timers

这一环通过。完整链路成立：

```text
同步 CPU 任务未返回
→ JS 调用栈未清空
→ timer 到期但无法执行
→ 调用栈清空
→ 检查点清空 nextTick queue 和 microtask queue
→ 事件循环到达 timers 调度机会
→ 到期 timer callback 进入 JS 调用栈
```

术语上注意：`nextTick` 和 Promise microtask 不属于 libuv 的事件循环阶段，而是在 callback 边界的检查点被清空。

**D2 / CPU 阻塞实验 · 观测设计**

先不写代码。为了证明“timer 的延迟来自同步 CPU 任务阻塞”，你准备记录哪两个时间点，并预期它们之间呈现什么关系？

A: 在 js 主线程中记录运行结束的时间点, 再记录 timer  callback  的调用时间点, 呈现两者的延迟/阻塞关系

这个设计还不能证明阻塞时长。CPU 任务结束时间与 timer callback 时间通常非常接近，只能说明“CPU 结束后 timer 才运行”，无法计算 timer 从注册到执行究竟晚了多久。

需要一个共同基准时间。

**D2 / CPU 阻塞实验 · 纠正题**

timer callback 的实际等待时间，应当用 callback 的执行时间减去哪一个时间点？这个差值又应与哪两个预期时长比较？

A: callback 进入异步调用栈的时间, 与真正调用的时间的差值, 就是timer callback 的实际等待时间. 这个差值应该与 加入这是 js 主线程中的同步事件的预期发生时长, 作为异步进入事件循环机制到出来后 js 主线程跑了多长时间来对比

这次回答还不能通过，核心问题是时间点选错了。

不存在“异步调用栈”。timer 注册后，callback 只是被保存，满足条件后等待调度，最终进入唯一的 JS 调用栈。

正确的观测量是：

```text
实际等待时间 = callback 开始执行时间 - timer 注册时间
timer 迟到量 = 实际等待时间 - timer 设定延迟
```

实际等待时间需要与两个量比较：

1. timer 的设定延迟。
2. 同步 CPU 任务的实际执行时长。

**D2 / CPU 阻塞实验 · 再答**

如果 timer 设定为 `100ms`，紧接着运行约 `2000ms` 的同步 CPU 任务，你预期：

> timer 的实际等待时间和迟到量分别大约是多少？为什么？

答: 
实际等待时间 = callback 开始执行时间 - timer 注册时间, 2100ms 以上
timer 迟到量 = 实际等待时间 - timer 设定延迟, 1900ms 左右
另一个问题: 异步调用栈我这两天多次使用, 这是错的吗?

是的，“异步调用栈”这个说法在我们当前讨论的 Node.js 运行时模型中是错的。

一个 Node.js 主线程只有一个 JS 调用栈。异步 callback 在执行前可能由 timer、I/O、线程池完成队列等机制保存和等待；获得调度机会后，才进入这个唯一的调用栈。

调试器里的 **async stack trace** 是为了串联异步因果关系生成的调试视图，不代表运行时存在另一个“异步调用栈”。Worker Thread 则拥有自己的线程、isolate 和调用栈，也不叫异步调用栈。

你的“迟到约 `1900ms`”正确，但“实际等待 `2100ms` 以上”不正确：

```text
t=0ms       注册 timer，并立即开始 CPU 任务
t=100ms     timer 到期，但调用栈仍被占用
t≈2000ms    CPU 任务结束，callback 随后获得执行机会

实际等待时间 ≈ 2000ms
迟到量       ≈ 2000ms - 100ms = 1900ms
```

`100ms` timer 等待和 `2000ms` CPU 执行在墙上时间中是重叠的，不能相加。

**D2 / CPU 阻塞实验 · 最后一问**

为什么这里的实际等待时间接近 `2000ms`，而不是 `100ms + 2000ms`？只解释这两个时间段的关系。

A: 因为 CPU 任务（2000ms）远长于计时器倒计时（100ms），所以timer 已达到调度阈值，callback 具备被调度的资格，但仍在等待主线程和 timers 调度机会, 直到 t≈2000ms CPU 任务释放主线程，callback 才获得执行机会, 如果把两者相加（100ms + 2000ms），隐含的前提是 “CPU 任务执行完，计时器才开始倒计时”, 但事实上计时器的倒计时与 CPU 任务的执行是同时发生的, 因此，callback 的实际等待时长由两者中结束较晚的那个决定, 也就是 2000ms, 不能简单理解为相加

这次通过。你的因果关系完整：两个计时过程从近似相同的起点并行经过，callback 的执行受结束较晚的 CPU 阻塞限制，因此不能相加。

术语再收紧一点：“timer 到齐了、在队列里干等”建议改为：

> timer 已达到调度阈值，callback 具备被调度的资格，但仍在等待主线程和 timers 调度机会。

因为我们没有证据证明它当时具体位于某个 JS 可见队列。

**D2 / CPU 阻塞实验 · 对照设计**

为了把 timer 延迟明确归因于同步 CPU 任务，你准备设置怎样的对照组？两次运行中保持什么相同，只改变哪一个变量？

A: 我想设计这样的一个对照组, timer 不变, 只改变 CPU 任务的时长, 2000ms (> 100ms) 和 20ms(<100ms)

这个对照设计通过。它验证的是：

```text
timer 固定为 100ms
CPU 约 20ms    → CPU 先结束，callback 实际等待应接近 100ms
CPU 约 2000ms  → timer 先到期，callback 实际等待应接近 2000ms
```

需要保证两组使用相同的同步 CPU 任务形式，只改变目标执行时长。`20ms` 组不是“完全没有阻塞”，而是“阻塞在 timer 到期前已经结束”的对照组。

现在可以由你实现最小实验。运行前先记录上述预测；运行后记录四项证据：

- timer 设定延迟
- CPU 实际执行时长
- callback 实际等待时间
- timer 迟到量

暂时只完成这个 CPU 阻塞实验，不进入 threadpool。

A: src git:(main) ✗ node cpu-blocking.js
[预测] CPU任务 2000ms, timer 100ms
CPU任务结束，实际耗时: 2000 ms
--- timer callback ---
实际等待:  2003 ms
迟到量:  1903 ms
➜  src git:(main) ✗ node cpu-blocking.js
[预测] CPU任务 20ms, timer 100ms
CPU任务结束，实际耗时: 20 ms
--- timer callback ---
实际等待:  108 ms
迟到量:  8 ms

当前有 1 个阻断性问题：测量基准不准确。

在 [cpu-blocking.js](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/src/cpu-blocking.js:5) 中，`start` 早于预测日志、timer 注册和 CPU 循环，因此：

- “CPU 实际耗时”混入了预测日志等开销。
- “callback 实际等待”不是从 timer 注册开始计算。
- CPU 循环的目标时长也受前置开销影响。

我独立运行当前 `20ms` 版本得到：CPU `26ms`、等待 `127ms`、迟到 `27ms`。趋势正确，但指标口径不能支持精确结论。

请自行调整为四个明确时间点：

```text
timer 注册时间
CPU 开始时间
CPU 结束时间
callback 开始时间
```

然后分别计算：

```text
CPU 实际时长 = CPU 结束 - CPU 开始
callback 实际等待 = callback 开始 - timer 注册
timer 迟到量 = callback 实际等待 - 设定延迟
```

重新运行 `20ms` 和 `2000ms` 两组即可。除此之外无阻断性问题；忙等形式、单一变量和两组现象都符合实验目标。

如果现在验收：**会不通过**，因为测量标签与实际基准不一致；修正并重跑后即可重新验收。

➜  src git:(main) ✗ node cpu-blocking.js
CPU 任务结束，实际耗时: 2000 ms
--- timer callback 执行 ---
callback 实际等待时间: 2011 ms
timer 迟到量: 1911 ms
CPU 实际执行时长: 2000 ms
➜  src git:(main) ✗ node cpu-blocking.js
CPU 任务结束，实际耗时: 20 ms
--- timer callback 执行 ---
callback 实际等待时间: 101 ms
timer 迟到量: 1 ms
CPU 实际执行时长: 20 ms

无阻断性问题，可以验收。

修正后的 [cpu-blocking.js](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/src/cpu-blocking.js:6) 已正确区分 timer 注册、CPU 开始/结束和 callback 开始四个时间点，三个计算口径一致。

验证证据：

- `node --check` 通过。
- 隔离运行：`20ms → wait 100ms / late 0ms`。
- 同源 `2000ms` 对照：`wait 2004ms / late 1904ms`。
- 结果支持“同步 CPU 任务超过 timer 阈值后，callback 仍需等待调用栈释放”的结论。
- 当前范围内没有需要列出的锦上添花项。

如果现在验收：**不会**，因为代码、测量口径、对照变量和输出证据都已闭环。状态与 [当天笔记](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day2-libuv-threadpool-blocking.md) 已收口；L2 债务仍按计划在 7/24 延迟重建。

**D2 / 阶段 2 · Threadpool 归属**

为什么不能继续使用这个同步忙等任务来观察 libuv threadpool 排队？请只从“它在哪里执行”和“它实际会制造什么现象”两点回答。

答:
