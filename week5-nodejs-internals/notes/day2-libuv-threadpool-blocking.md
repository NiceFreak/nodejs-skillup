# W5 D2 · CPU 密集 JavaScript 与 Timer 延迟

> 日期：2026-07-21 ｜ 状态：已整理，**D2 当日学习完成**（CPU 阻塞模型与 20ms / 2000ms 对照实验通过；threadpool 主线因临时面试中断，顺延 D3）
>
> 本笔记由当天逐轮问答和 code review 整理而成。原始逐字记录保留在 Git 历史（整理前提交）中，本文件只保留结论、证据、关键纠错和援助边界。

## 今日目标与计划变化

- 从 D1 的“callback 何时被调度”推进到“同步 CPU 任务为什么会让 callback 迟到”。
- 建立 timer 注册、CPU 执行、timer 到期和 callback 执行之间的时间关系。
- 本人实现 20ms / 2000ms 两组受控实验，观察同步 CPU 任务对 100ms timer 的影响。
- 区分“timer 已到期”和“callback 已执行”不是一回事。

原计划还包括 threadpool 归属、`UV_THREADPOOL_SIZE` 对照和三类慢判断表。2026-07-21 因临时面试暂停，今天只收口 CPU 阻塞实验；剩余内容按真实进度放到 7/22 的 D3，不通过赶工压缩实验。

## 明确不做

- 不在今天开始 threadpool 排队实验。
- 不进入 Stream、错误生命周期或 Worker Threads。
- 不修改 Week2–4 主应用。
- 不用并行运行的两个 Node 进程作为受控对照。

## 开始前基线

事实（2026-07-21）：

```text
Node：v24.16.0
npm run day1：通过
本次顶层样本：start → end → nextTick → promise → setImmediate → setTimeout
```

最后两项只是本次运行样本，不表示顶层 `setImmediate` / `setTimeout(0)` 存在固定顺序。

---

## 一页心智模型（本日核心产出）

```text
t=0ms
注册 100ms timer
→ 立即开始同步 CPU 任务

timer 计时与 CPU 任务占用调用栈在墙上时间中重叠推进

若 CPU 约 20ms：
  CPU 先返回
  → 调用栈释放
  → timer 到 100ms 阈值后，callback 等待 timers 调度机会
  → 实际等待约 100ms，迟到接近 0ms

若 CPU 约 2000ms：
  timer 在 100ms 已达到阈值
  → 同步 CPU 任务仍占用唯一的 JS 调用栈
  → callback 只能等待
  → CPU 在约 2000ms 返回
  → 调用栈释放、检查点完成、事件循环到达 timers 调度机会
  → callback 才进入调用栈
  → 实际等待约 2000ms，迟到约 1900ms
```

一句话：**timer delay 是最早可调度阈值，不是执行保证；同步 CPU 任务不返回，任何 JavaScript callback 都无法进入唯一的 JS 调用栈。**

---

## 1. CPU 阻塞与 Timer 调度

同步 `while` 忙等从开始到结束都由 JS 主线程执行。它不会进入 libuv threadpool，也不会产生另一条“异步调用栈”。

完整调度链：

```text
setTimeout() 在 JS 主线程中完成 timer 注册
→ JS 主线程继续执行同步 CPU 任务
→ timer 达到时间阈值，但当前调用栈仍未释放
→ callback 只具备被调度的条件，不能插入同步代码中间
→ CPU 任务返回，调用栈清空
→ callback 边界检查点处理 nextTick queue 与 V8 microtask queue
→ 事件循环到达 timers 调度机会
→ 到期 timer callback 进入唯一的 JS 调用栈执行
```

需要区分三件事：

| 概念 | 含义 |
|---|---|
| timer 注册 | Node / libuv 开始跟踪最早可调度时间 |
| timer 到期 | 时间阈值已满足，callback 具备后续被调度的条件 |
| callback 执行 | callback 已获得调度机会并进入 JS 调用栈 |

“到期”不等于“正在某个 JS 可见队列里”，本实验没有观测内部队列位置，因此不对它作额外断言。

---

## 2. 20ms / 2000ms 对照实验

核心脚本：`week5-nodejs-internals/src/cpu-blocking.js`，由本人设计、实现并修正。

### 2.1 受控设计

两组实验保持相同：

- timer delay 固定为 100ms。
- 使用相同形式的同步 `while` 忙等。
- 测量公式和日志位置相同。
- 两组隔离运行。

唯一主动改变的变量：

```text
CPU_TARGET = 20ms
CPU_TARGET = 2000ms
```

20ms 组不是“没有阻塞”，而是同步阻塞在 timer 到期前已经结束；2000ms 组则让 timer 到期后继续等待调用栈释放。

### 2.2 四个时间点

```text
1. timerRegTime：调用 setTimeout() 前的注册基准
2. cpuStartTime：同步 CPU 任务开始
3. cpuEndTime：同步 CPU 任务结束
4. callbackStart：timer callback 开始执行
```

计算口径：

```text
CPU 实际执行时长 = cpuEndTime - cpuStartTime
callback 实际等待 = callbackStart - timerRegTime
timer 迟到量 = callback 实际等待 - TIMER_DELAY
```

这三个量各自回答不同问题：CPU 忙等实际执行了多久、callback 从 timer 注册起等了多久、以及它相对 100ms 阈值晚了多久。

### 2.3 运行前预测

```text
CPU 20ms：
  callback 实际等待 ≈ 100ms
  timer 迟到量 ≈ 0ms

CPU 2000ms：
  callback 实际等待 ≈ 2000ms
  timer 迟到量 ≈ 2000ms - 100ms = 1900ms
```

不能预测为 `100ms + 2000ms = 2100ms`。timer 计时和 CPU 任务从近似相同的起点重叠经过，不是 CPU 结束后 timer 才开始倒计时。

### 2.4 历史实测

| 运行者 / 组别 | CPU 实际时长 | callback 实际等待 | timer 迟到量 |
|---|---:|---:|---:|
| 本人 · 20ms | 20ms | 101ms | 1ms |
| 本人 · 2000ms | 2000ms | 2011ms | 1911ms |
| AI 隔离复验 · 20ms | 20ms | 100ms | 0ms |
| AI 同源 2000ms 复验 | 2000ms | 2004ms | 1904ms |

具体几毫秒差异受时钟精度、日志和运行时调度影响；本实验关注的是两组量级和因果关系，不把单次数字当作性能保证。

---

## 3. 事实、推断与未测量

**事实：**

- 20ms 组的 callback 实际等待接近 timer 的 100ms 阈值。
- 2000ms 组的 callback 实际等待接近 CPU 任务时长，迟到约 1900ms。
- 两组只改变 CPU 目标时长，现象可在隔离运行中复现。

**推断：**

- 当同步 CPU 任务超过 timer 阈值时，callback 的主要等待来自 JS 调用栈持续被同步代码占用。
- 当前现象支持“同步 CPU 任务阻塞事件循环”，而不是 timer 自身计时变成 2000ms。

**未测量：**

- 真实 HTTP 服务的 event-loop delay、吞吐和 p99 延迟。
- 不同 CPU 密集算法、机器负载和 Node 版本下的具体延迟。
- callback 获得调度前各内部步骤分别贡献了多少毫秒。

---

## 4. 关键纠错留痕

1. **不是“主线程非空”**：准确说法是同步任务尚未返回、JS 调用栈未清空。
2. **不存在“异步调用栈”**：调试器的 async stack trace 是因果视图，不代表运行时有第二条异步调用栈。
3. **调用栈清空不代表 timer 立即执行**：还要完成 callback 边界检查点，并等事件循环到达 timers 调度机会。
4. **100ms 与 2000ms 不能相加**：timer 计时和 CPU 执行在墙上时间中重叠。
5. **测量必须使用正确基准**：首版把共同 `start` 放在预测日志之前，导致 CPU 时长和 callback 等待混入注册前开销，趋势虽对但指标标签不成立。
6. **两组实验不能并行运行**：两个 Node 进程会竞争 CPU，引入第二个变量，不能作为正式受控证据。

---

## 5. 对正式工作的直接帮助

| 代码或现象 | 当前判断 |
|---|---|
| 大 JSON 同步序列化、复杂正则、长循环 | 可能长期占用 JS 调用栈，使 timer、I/O 和请求 callback 整体推迟 |
| timer 明显迟到 | 只能作为 event-loop delay 线索，需结合可疑同步代码段耗时继续定位 |
| CPU 使用率高 | 不能单独证明 JS 主线程阻塞；后续还要区分 libuv worker 或 Worker Threads 消耗 CPU |
| 单次 timer 抖动几毫秒 | 不能直接归因于业务阻塞，应看持续时间、对照组和重复样本 |

本日建立的是最小因果模型。threadpool 排队与外部 I/O 慢在 D3 补全，Worker Threads 的边界留到 D6。

---

## 6. 验证证据

```bash
node --check src/cpu-blocking.js
node src/cpu-blocking.js
```

- 语法检查通过。
- 20ms / 2000ms 两组隔离运行，输出符合运行前预测。
- 四个时间点和三个计算公式与日志标签一致。
- 最终 review：代码、测量口径、对照变量和输出证据闭环，无阻断性问题，可以验收。

## 7. AI 辅助记录

- L1 范围：主线程 / 调用栈术语校准、时间关系拆解、对照实验提问和验收。
- L2 范围：本人完成首版实验后，AI 定位 `start` 早于预测日志和 timer 注册，使“实际等待”混入注册前开销；AI 给出四个时间点与三个计算口径，未直接修改核心脚本。
- 核心归属：实验设计、代码修正、20ms / 2000ms 实际运行与最终解释均由本人完成。
- 本人理解验证：能够解释两个时间段为何重叠、实际等待与迟到量的区别，并独立修正测量基准后复跑两组对照。
- 延迟重建：2026-07-27 D6 按第一档只看本人一页纸笔记重建 timer 测量模型；通过后仍需补至少两项掌握证据。已同步 `DEBT.md` 与 `LEARNING-STATE.md`。

## 8. 已完成 / 未完成

- 已完成：D1 基线复验、CPU 阻塞最小模型、20ms / 2000ms 受控对照、测量基准修正与验证。
- 未完成并顺延：threadpool 任务归属、`pbkdf2()` 排队实验、`UV_THREADPOOL_SIZE` 边界和三类慢判断表；这些在 2026-07-22 D3 继续并最终完成。
- 不计为掌握失败：7/21 临时面试属于外部中断，未通过压缩后续学习补进度。

## 9. 下一入口（D3）

先判断同步 `while` 为什么不能观察 libuv threadpool 排队，再选择确定使用 threadpool 的异步任务，设计只改变 `UV_THREADPOOL_SIZE` 的受控实验。
