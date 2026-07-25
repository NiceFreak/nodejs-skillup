# Week 5 Demo 讲稿 · Node.js 运行时判断

> 目标时长：10 分钟  
> 展示媒介：Week 8 前端的「W5 运行时」页为主，终端只保留为备用证据。  
> 状态边界：只展示已验收结论；D6 重建和脱稿串讲尚未完成，不在现场宣称 W5 已最终结课。
>
> **2026-07-25 更正**：本讲稿原以「Worker 对照」开场并给出一组 heartbeat / `/ping` 数字。本人澄清 **W5 D6 实际未进行学习**，Worker 对照未验收、数字作废。在 D6 真正完成前，**现场不讲 Worker 站**，改从「threadpool」开场；下文 Worker 段保留但标注为「作废 · 跳过」。相应时间轴请把 0:40–3:00 顺延给已验收三站，或压缩总时长。

## 内容选择

这次不按 Day 1 到 Day 5 顺序报流水账，只讲一个问题：

> 当 Node.js 服务变慢或准备退出时，我怎样判断工作在哪里、哪里积压、应该由谁收口？

前端推荐路径原为四站，2026-07-25 更正后现场只走已验收三站（Worker 站作废、退回 D6）：

```text
（原第 1 站 Worker 对照 —— 作废 · 跳过）
threadpool
→ backpressure
→ 错误与 shutdown
```

事件循环、CPU timer、整块读取与 pipeline 留作支撑页，不主动展开。这样现场用已验收内容形成判断链，不会压缩成八个名词各讲半分钟，也不把未验收的 Worker 当已验收讲。

## 时间轴

> 2026-07-25 更正：删去 0:40–3:00 的 Worker 站，其余各站前移，总时长约 7.5 分钟；如需凑满 10 分钟，可在 threadpool / backpressure 上多留追问时间。

| 时间 | 页面 | 必须证明 |
|---|---|---|
| 0:00–0:30 | 开场 | Node 单主线程不等于所有工作都在主线程执行 |
| ~~0:40–3:00~~ | ~~Worker 对照~~ | **作废 · 跳过（退回 D6）** |
| 0:30–2:30 | threadpool | 异步任务归属不同，pool size 不是万能性能开关 |
| 2:30–4:45 | backpressure | consumer 更慢时要让 producer 停，而不是无限积压 |
| 4:45–6:50 | 错误与 shutdown | 请求级错误、fatal 错误、计划内信号必须分开收口 |
| 6:50–7:30 | 收尾 | 用一条诊断顺序串回真实后端工作 |

## 演示前准备

```bash
cd week8-fullstack/src/frontend
yarn dev
```

打开终端打印的本地地址，进入「W5 运行时」。展示页顶部的“10 分钟推荐路径”就是现场导航。

终端备用命令，不作为默认现场主线：

```bash
cd week5-nodejs-internals
node src/stream-test.js
# node src/server.mjs  # Worker 对照脚本，已作废、退回 D6，现场不演示
```

~~Worker 备用 demo 需要另一个终端在计算期间发 `/ping`。~~（2026-07-25 更正：Worker 对照未验收、退回 D6，现场不演示，也不引用其数字。）

## 0:00–0:30 开场

开场白：

> “这一周我没有把重点放在背 Node.js 底层名词，而是练一条运行时判断链：服务变慢时，先判断工作由谁执行；数据积压时，判断 producer 和 consumer 是否失衡；发生错误或终止信号时，判断应该在哪个边界收口。接下来我用几个页面把这条链走完。”

> 2026-07-25 更正：原开场直接切「Worker 对照」，该站已作废；现改为直接切「线程池、I/O 归属与慢点诊断」站。

切到已验收第 1 站「线程池、I/O 归属与慢点诊断」（threadpool）。

## ~~0:40–3:00 Worker 对照~~（作废 · 跳过，退回 D6）

> **2026-07-25 更正**：本站原以「主线程 vs Worker 对照」讲执行归属，并给出 heartbeat gap `1160ms→102ms`、`/ping` `378ms→2ms` 等数字。本人澄清 W5 D6 实际未进行学习，这些结论与数字未经真正验收，**作废，现场不讲**。Worker 对照退回 D6（7/27）真正完成后再决定是否补回本站。以下原文只作追溯，不作现场脚本。

~~先讲实验契约：两组路由执行相同的 `fib(40)`，一组在主线程算、一组交给 Worker，观察计算期间主线程能否继续处理 heartbeat 和 `/ping`；原记录数字与结论见 git 历史，已作废。~~

## 0:30–2:30 Threadpool

切到已验收第 1 站「线程池、I/O 归属与慢点诊断」。

先指任务归属表：

- 同步 JavaScript 在主线程。
- 异步 `pbkdf2`、部分 `fs` / `zlib` / `dns.lookup` 和当前项目异步 bcrypt 使用 threadpool。
- 已建连接上的普通 HTTP / MongoDB 网络等待主要走 OS 非阻塞 I/O + libuv poll，不默认占用 threadpool worker。

再指两组实测：

> “我连续提交 8 个相同 pbkdf2。SIZE=4 时 callback elapsed 出现 4+4 两批，总时间 151ms；SIZE=8 时聚成一批，总时间 119ms。这个实验支持存在共享 worker 排队，但 elapsed 不能直接量出任务真正开始时间和精确排队时长。”

必须落下的结论：

> “调大 pool size 能改变分组，却不保证耗时按比例缩短，因为 CPU 核心数没有增加。排障时要先确认 API 归属，再设计能区分主线程阻塞、threadpool 排队和外部 I/O 等待的测量。”

转场：

> “下一类慢不是计算放错线程，而是数据生产得比下游消费更快。”

## 5:00–7:15 Backpressure

切到推荐路径第 3 站「背压：让快生产者停下来」，播放或逐步点击动画。

先给配置：producer 每 10ms 产生一个 chunk，consumer 每 50ms 完成一个，`highWaterMark = 5 bytes`。

按动画讲链路：

```text
write() 接纳当前 chunk，但返回 false
→ producer 停止继续写
→ consumer 与 heartbeat 仍继续
→ buffer 降下来后触发 drain
→ producer 恢复
```

指向结果：30 次 write、6 次 false、5 次 drain，`writableLength` 重复 1→5→0。

必须落下的两个精度点：

> “false 不代表当前 chunk 写失败，它表示当前 chunk 已接纳，但后续生产必须暂停。`highWaterMark` 是背压阈值，不是永不超过的硬内存上限；`drain` 也只代表本地 Writable 可以继续接收，不代表远端已经收到。”

解释为什么最后只有 5 次 drain：第 30 次 false 后已经没有下一块要生产，调用 `end()` 后 Writable 消化剩余数据并用 `finish` 收口。

转场：

> “到这里解决了正常流动。最后一个问题是：失败或终止时，谁负责把链路关干净？”

## 7:15–9:20 错误与 Shutdown

切到推荐路径第 4 站「错误边界与进程收口」。

不逐行念八类表，只讲三层：

1. 仍在 Express 同步调用栈或 handler 返回 Promise 上的错误，交给 error handler，可以转换成 HTTP 响应，进程继续。
2. 悬空 Promise、detached timer throw、未监听的 EventEmitter `'error'` 已逃出请求边界，进入 fatal 策略；进程级监听器不是吞错恢复机制。
3. `SIGTERM` / `SIGINT` 是计划内信号，不是异常，进入 graceful shutdown。

指着 shutdown 流程讲：

```text
第一次信号锁定 single-flight
→ 30 秒 deadline 从头覆盖到尾
→ 等启动状态落定
→ HTTP 停止接收并排空
→ 数据库断开
→ exitCode = 0，自然退出
```

失败或超时则退出码为 1。补一句真实修复：原服务连续按三次 `Ctrl-C` 会触发三次 MongoDB 断开；加入防重入与唯一关停链后，只执行一次，其余信号明确忽略。

## 9:20–10:00 收尾

收尾白：

> “所以我现在 review Node.js 后端时，会按同一个顺序判断：第一，工作在哪执行，主线程还能不能推进 callback；第二，数据是否因为速度差在内存里积压；第三，成功、失败和终止分别由哪个边界收口。threadpool、backpressure 和 graceful shutdown 不是三个孤立 API，而是这几步判断在不同问题上的落点。”

> 2026-07-25 更正：收尾原把 Worker 与 threadpool / backpressure / shutdown 并列为「四个 API」的落点。Worker 对照未验收、退回 D6，收尾暂只串已验收三站；D6 完成后再把「工作在哪执行」的 Worker 落点补回。

状态边界：

> “这些页面只展示已经完成和实测的内容；Week 5 最终验收还差 D6 的延迟重建和脱稿串讲，我不会用展示页替代那一步。”

## 超时与卡壳策略

- 8 分钟时还没进入 shutdown：threadpool 只保留 4+4 / 一批与“pool size 非万能开关”两句。
- backpressure 动画未播放：直接指 30 / 6 / 5 / 1→5→0 四个结果讲判断链。
- ~~Worker 现场复跑失败：使用页面上的本人原始实测。~~（2026-07-25 更正：Worker 站已作废、退回 D6，现场不涉及。）
- 卡壳锚点只有三句：主线程是否响应；producer 是否停产；谁负责收口。
