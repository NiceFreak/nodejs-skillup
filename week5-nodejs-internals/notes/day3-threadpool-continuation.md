# Week 5 Day 3 · 续接 D2：libuv Threadpool 归属与排队

2026-07-22 从前一天被临时面试打断的位置恢复。今天先补完 D2 尚未完成的 threadpool 排队、`UV_THREADPOOL_SIZE` 对照与判断表，再决定是否进入原定 D3 的 Stream 与背压；不把跨日续接伪记为 2026-07-21 已完成。

## 今日主线

- 先判断同步忙等任务实际在哪里执行，以及它为什么不能用于观察 libuv threadpool 排队。
- 再判断适合实验的 `fs` / `crypto` 任务由谁执行，并在运行前预测线程池饱和时的完成节奏。
- 由本人设计并实现 threadpool 排队对照，验证 `UV_THREADPOOL_SIZE` 的作用边界。
- 补完“I/O 慢 vs CPU 慢 vs 线程池慢”判断表。

## 计划变化

- 原计划 D3 主题是 Stream 与背压。
- 由于 D2 在 CPU 阻塞实验验收后被打断，D3 按真实学习顺序先续接 D2 未完成部分。
- Stream 与背压是否在今天开始，等 threadpool 主线收口后再按实际时间决定。

## 恢复基线

事实：D2 的 CPU 阻塞实验已验收。隔离复验得到 `20ms -> wait 100ms / late 0ms`、`2000ms -> wait 2004ms / late 1904ms`；尚未完成 threadpool 排队实验、`UV_THREADPOOL_SIZE` 对照和判断表。

## 问答记录

**D2 延续 / 阶段 2 · Threadpool 归属**

为什么不能继续使用这个同步忙等任务来观察 libuv threadpool 排队？请只从“它在哪里执行”和“它实际会制造什么现象”两点回答。

答: 为什么不能继续使用这个同步忙等任务来观察 libuv threadpool 排队？
1. 它在哪里执行: 以 /src/cpu-blocking.js 为例,这个同步忙等任务中, libuv threadpool 会在 timerRegTime 时就注册, 但是 callback 在 actualWait 后才开始执行. 它在异步调用中执行
2.  它实际会制造什么现象: 会一直排队, 等主线程执行完成后,异步事件循环慢慢执行这些 callbacks, 拖慢整体节奏

当前回答暂不通过。先只纠正“执行位置”：

- `timerRegTime = Date.now()` 只是记录一个时间戳，不会注册 threadpool。
- `setTimeout(...)` 注册 timer，也不等于把后面的同步忙等任务提交给 threadpool。
- 真正待判断的任务是 `while` 忙等；它作为同步 JavaScript，在唯一的 JS 主线程和调用栈上执行。

**D2 延续 / 阶段 2 · Threadpool 归属 · 纠正题 1**

只回答执行位置：`while` 忙等从开始到结束由谁执行？它有没有进入 libuv threadpool？

## 已完成 / 未完成

- 已完成：恢复状态，并把跨日问答归档到真实发生日期。
- 未完成：执行位置纠正题、忙等实际现象纠正、threadpool 排队实验、`UV_THREADPOOL_SIZE` 对照、判断表。

## 下一入口

- 先回答“Threadpool 归属 · 纠正题 1”，只处理同步 `while` 忙等的执行位置。
