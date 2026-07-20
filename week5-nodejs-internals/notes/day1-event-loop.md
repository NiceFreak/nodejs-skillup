# W5 D1 · 事件循环最小模型

> 日期：2026-07-20
>
> 状态：进行中。今天只处理顶层代码与 I/O callback 中的异步调度顺序；先预测，再运行，再解释。

## 今日目标

- 用最小脚本观察 `sync`、`process.nextTick`、Promise microtask、`setTimeout`、`setImmediate`。
- 区分顶层代码与 I/O callback 中 timer / immediate 的顺序。
- 形成一页事件循环心智模型。

## 明确不做

- libuv 线程池实验。
- stream、错误生命周期、worker threads。
- Week2–4 主应用改造。

## 自己的预测或设计

待记录。

## 实现与观察

待记录。

## 解释与修正

待记录。

## 验证证据

待记录。

## 已完成 / 未完成

待记录。

## 明日入口

待记录。


以下为 day 1 问答记录. 总体结构为一问一答, 需要在笔记整理时优化.

已切换到 W5 D1，状态入口和当天笔记已更新；本机 Node.js 为 `v24.16.0`，原工作区干净，文档 diff 检查通过。

现在开始「事件循环 / D1-A：顶层调度」：

请在 `week5-nodejs-internals/src/` 自己写一个最小脚本，包含同步日志，以及各一个 `process.nextTick`、Promise microtask、`setTimeout(..., 0)`、`setImmediate`。**先不要运行。**

唯一问题：你预测完整输出顺序是什么？把脚本和预测一起发来，我只验收预测和推理，不直接给实现或答案。

A: 这个问题比较大, 请先拆解为更细致的问题

刚才的问题混合了“写脚本、预测五类任务、解释队列、比较执行阶段”，确实需要拆开。

D1 将依次处理：

1. 同步代码与异步回调的边界
2. “注册回调”和“执行回调”的区别
3. `process.nextTick` 与 Promise microtask
4. 顶层代码中的 `setTimeout` 与 `setImmediate`
5. I/O callback 中的 timer 与 immediate
6. microtask / nextTick 饥饿风险
7. 最后才组合成完整预测题

现在只做「事件循环 / D1-1：同步代码边界」。

假设 Node.js 正在执行一个文件：

```text
打印 A
安排一个异步回调
打印 B
```

唯一问题：在这个文件的同步代码执行完之前，那个异步回调会不会插到 A 和 B 中间执行？请只回答“会 / 不会”，再说一句理由。

A: 我先不查资料, 凭借记忆回答, 如果错误请直接纠正. Node.js 总体是单线程, 但是通过 libuv 引入了多进程机制, 总体而言, 事件循环机制分为六个阶段: pendings callbacks, timers, idle/prepare, poll, closing callbacks. 因此, 若我理解无误, 假设 Node.js 正在执行一个文件, 在这个文件的同步代码执行完之前, 那个异步回调不会插到  A 和 B 中间执行, 而是放入异步进程池, 异步执行结束后返回结果.
刚刚再次暴露了问题拆解粒度的问题, 同时请给我一套搭建运行 week5 脚本的环境的代码, 我现在先完成这一步.

Week 5 运行环境已建立：

- [package.json](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/package.json) 提供 `npm run day1` 和 `npm run day1:watch`
- [README.md](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/README.md) 记录环境准备方式
- 没有第三方依赖，不需要 `npm install`
- 核心脚本保持空白，也没有提前运行
- 配置解析与 diff 检查通过

D1-1 结论正确，可以通过：异步回调不会插入 A 和 B 之间。

但理由需要纠正：

- 更准确地说，是 JavaScript 在一个 Node.js isolate 中通常由一个主线程执行，不是整个 Node.js 只有一个线程。
- libuv 提供事件循环、I/O 抽象和供部分任务使用的线程池，不是“多进程机制”。
- 不存在统一的“异步进程池”。不同任务可能交给操作系统异步 I/O、libuv 线程池，或者只是等待对应事件循环阶段。
- 异步工作完成，不代表回调立即执行。回调最终仍要等当前 JavaScript 调用栈清空，再由主线程执行。
- 你列出的阶段少了 `check`。简化顺序是：`timers → pending callbacks → idle/prepare → poll → check → close callbacks`。

现在只进入「事件循环 / D1-2：注册与执行」。

唯一问题：Node.js 在顶层代码中遇到“安排一个异步回调”时，**当场完成的是回调注册，还是回调函数体的执行？** 二选一，并说明另一件事要等到什么时候发生。