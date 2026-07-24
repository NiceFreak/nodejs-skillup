# Week 5 已完成内容阶段复盘

> 截止：2026-07-24  
> 口径：D1–D5 已完成，Worker 最小对比已提前通过；D6 的债务重建、脱稿串讲与四问本人复盘尚未完成。因此本文是“已完成内容复盘”，不是 W5 最终结课证明。

## 一句话结论

本周形成的不是一组孤立名词，而是一条运行时诊断路径：先判断工作由谁执行、主线程是否还能推进 callback，再判断数据生产速度是否超过消费能力，最后判断失败应该在请求、stream 还是进程边界收口。

## 已完成能力地图

| 主题 | 已完成的判断 | 证据 | 不能外推 |
|---|---|---|---|
| 事件循环 | 同步栈结束后，结合 nextTick、microtask 与 libuv phase 判断 callback 机会 | CommonJS / ESM、顶层 timer / immediate、I/O callback 内顺序与饥饿实验 | 顶层 timer / immediate 没有固定先后；简化六阶段图不是逐格时间表 |
| 主线程阻塞 | timer 到期不等于 callback 准点执行；同步 CPU 未释放调用栈时所有 JS callback 都会迟到 | 20ms / 2000ms CPU 对照：100ms timer 的迟到量为 0ms / 1904ms | 受控实验不能给任意机器固定延迟 |
| threadpool | 区分 JS 主线程、libuv threadpool 与普通网络 I/O；pool size 只影响部分任务并发 | 8 个 pbkdf2：SIZE=4 呈 4+4 两批，SIZE=8 聚为一批 | callback elapsed 不是精确排队时长；pool 变大不保证总耗时同比下降 |
| Stream 内存模型 | 大数据可逐块产生、处理和交付，不要求完整 materialize | Readable / Writable 模型与真实文件 pipeline | 本周未用 GB 级文件实测 RSS、吞吐或 TTFB |
| 背压 | `write() === false` 后停止继续生产，等待 `drain` 再恢复 | 30 chunks 实验：false 6 次、drain 5 次、`writableLength` 呈 1→5→0 | `highWaterMark` 是阈值，不是硬内存上限；`drain` 不代表远端已收到 |
| pipeline | 多段 stream 的完成、错误传播与相关 stream 清理由一个出口收口 | 成功 102B→102B；失败收到 EISDIR，三个 stream 均 `destroyed: true`；延迟重建通过 | `destroyed` 不单独证明任意底层资源已完全关闭 |
| 错误边界 | 先看错误是否仍连接 Express 调用栈 / handler Promise，再决定请求级或进程级处理 | 八类“错误由谁捕获”表与真实 Express 5 代码核对 | 进程级监听器不是恢复机制；已开始发送响应时不能保证再发 JSON 错误 |
| Worker | CPU 工作移出主线程可以保护 heartbeat 与其他请求响应，不保证任务更快 | `fib(40)`：heartbeat gap 1160ms→102ms；并发 `/ping` 378ms→2ms | 单次 elapsed 不足以量化线程创建、消息复制或调度成本 |

## 三条可迁移判断链

### 1. 服务变慢时，先定位执行归属

```text
同步 JS 长任务
→ 主线程 callback 全面迟到

异步 crypto / fs 等 threadpool 任务堆积
→ callback elapsed 可能分批，但主线程 heartbeat 未必持续阻塞

普通网络 I/O 等待
→ 主线程可继续工作，需要用客户端 / 服务端分段日志或 trace 继续定位
```

这条链会直接改变后端排障方式：CPU 高并不自动等于主线程阻塞，异步也不自动等于没有资源竞争。

### 2. 处理大数据时，先问是否必须完整 materialize

```text
不需要完整内容
→ Readable → Transform → Writable
→ consumer 变慢时遵守背压
→ 多段链路用 pipeline 统一收口
```

业务映射是报表导出、对象存储转发、日志处理和大响应下载。选择 Stream 的理由不只是“省内存”，还包括更早交付、速度协调与错误生命周期。

### 3. 发生错误时，先找第一接管边界

```text
仍在 Express 调用栈 / 返回 Promise
→ 请求级 error handler

仍在 pipeline Promise
→ 统一 stream failure → 请求级或上层 catch

脱离请求链 / 未监听 EventEmitter error
→ 进程级 fatal 边界

SIGTERM / SIGINT
→ 计划内 shutdown，不是异常
```

## 本周最有证明力的 demo

选择主线程 vs Worker 对照作为主 demo。理由不是它最“底层”，而是它同时形成三类证据：相同 CPU 工作、主线程 heartbeat、独立 HTTP `/ping`。它直接证明“任务耗时接近，但服务响应性完全不同”，能避免把 Worker 错讲成性能加速器。

背压 demo 作为第二证据：它展示另一类生产风险不是“主线程被阻塞”，而是 producer 与 consumer 速率不匹配。heartbeat 在暂停窗口仍继续，是排除主线程阻塞的关键对照。

## 范围取舍

10 分钟展示不逐项讲八个专题，也不现场跑所有脚本。推荐只走四站：

```text
Worker 对照（执行归属）
→ threadpool（不是所有异步都一样）
→ backpressure（不是所有慢都靠加线程）
→ 错误与 shutdown（生产链路如何结束）
```

事件循环、CPU timer、Stream 内存模型与 pipeline 作为四站背后的证据页，追问时再展开。这样既覆盖本周核心，又不会把展示变成名词巡游。

## 未完成与风险

- D6 尚未完成，所以不能写“Week 5 已最终验收”。
- `DEBT.md` 中 CPU timer 测量、threadpool 证据边界、异步 bcrypt 执行归属仍待 7/27 第一档重建。
- W4 的四条债务已重建通过但待补掌握证据，同样留到 D6。
- 当前 Worker demo 使用全局 heartbeat 状态，前提是串行实验；不能作为并发生产实现。
- 当前大文件内存优势主要是模型判断，没有 GB 级并发 benchmark。

## 进入 W6 前的唯一闸门

```text
到期债务重建通过
→ 不看展示板串讲三个运行时场景
→ 本人回答四问复盘
→ 才能把 W5 状态改为最终完成
```
