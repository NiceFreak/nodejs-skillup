# W5 D5 · 错误边界与进程生命周期

> 日期：2026-07-24（2026-07-25 更正 Worker 部分）  
> 状态：D5（错误边界与进程生命周期）已验收。**更正：本文原称「Worker 最小对比提前完成并通过」，2026-07-25 本人澄清 W5 D6 实际未进行学习，该结论与其数字作废，Worker 对比退回 D6（7/27）待完成。** W5 总验收仍需等待 D6 的 Worker 对比、债务重建、脱稿串讲与四问复盘。  
> 原始逐轮学习记录保留在 [`day5-raw-learning-log.md`](./day5-raw-learning-log.md)。

## 今日目标与范围

唯一主线是回答两个生产问题：

1. 一个错误最先会被哪个边界接管，是否还在当前 HTTP 请求的可控范围内？
2. 收到计划内终止信号后，如何只启动一次关停链，并确保 HTTP 与数据库都有机会正常收口？

今天不下钻操作系统信号实现，不改造业务 API，也不把进程级监听器当作恢复机制。

## 先建立判断模型

判断错误时，不先背 API，而按下面顺序定位：

```text
错误发生在哪里
→ 它是否仍连接在 Express 调用栈或 handler 返回的 Promise 链上
→ 第一接管边界是谁
→ HTTP 响应是否尚可安全发送
→ 进程状态是否仍可信
```

这里最容易混淆的不是 `try/catch` 语法，而是错误是否仍属于当前控制流：

- Express handler 内同步 `throw`：Express 路由层同步捕获并交给 error handler。
- handler 返回或 `await` 的 rejected Promise：Express 5 观察到 rejection 并交给 error handler。
- handler 内未 `return` / `await` 的悬空 Promise：已经脱离 handler 返回链，Express 看不到。
- detached timer callback 内的 `throw`：已经脱离原请求调用栈，Express 看不到。
- `await pipeline()` 的 stream failure：先由 `pipeline()` 统一交付为 Promise rejection，再沿 handler Promise 链进入 Express。
- 裸 `pipe()` 中未监听的 stream `'error'`：没有稳定的请求级错误出口，可能升级为进程级异常。

## 最终产出：错误由谁捕获

| 场景 | 传播路径 | 第一接管边界 | HTTP 响应 | 进程决策 |
|---|---|---|---|---|
| `EmailConflictError` | Repository 翻译数据库错误 → Service / Controller 透传 → Express 5 → error handler | Express error handler | 返回 409 | 继续运行 |
| handler 内同步 `throw` | Express 路由层同步 `try/catch` → `next(err)` | Express error handler | 未发送响应时可返回错误 | 继续运行 |
| handler 返回 / `await` rejected Promise | handler Promise rejection → Express 5 → `next(err)` | Express error handler | 可返回错误 | 继续运行 |
| handler 内悬空 rejected Promise | 独立 Promise rejection，未连接 handler 返回链 | `unhandledRejection` 进程边界 | 通常不能依赖原请求补救 | 保守异常退出 |
| timer callback 内未捕获 `throw` | timers callback 抛错，脱离 Express 调用栈 | `uncaughtException` 进程边界 | 不能依赖原请求补救 | 异常退出 |
| `await pipeline()` 管理的 stream error | stream failure → pipeline Promise rejection → handler rejection → Express | Express error handler | 取决于 headers / stream 是否已发送或销毁 | 错误可控时继续运行 |
| 裸 `pipe()` 未监听 stream `'error'` | EventEmitter `'error'` 无监听 → 未捕获异常 | `uncaughtException` 进程边界 | 不保证可返回 | 异常退出 |
| `SIGTERM` / `SIGINT` | 系统信号 → 已注册信号监听器 → shutdown | 计划内信号边界 | 期限内允许已有请求排空 | 计划内退出 |

关键修正：普通 Express handler 的同步 `throw` 也会被 Express 捕获；不能把“非 async handler”误判为一定进入 `uncaughtException`。

## Graceful shutdown 最小链

当前实现落在 `week2-express/src/server.js`，目标不变量是：

```text
shuttingDown 一旦为 true
→ 启动链不能再 listen
→ 关停链只创建一次
→ HTTP 排空后才断开数据库
→ 一个 deadline 覆盖完整链路
```

实际链路：

```text
收到 SIGINT / SIGTERM
→ 防重入：重复信号只记录并忽略
→ 启动 30s 端到端 deadline
→ 等待 startupDone 落定
→ 若 HTTP server 已创建，等待 server.close()
→ 若数据库已连接，等待 disconnectDB()
→ 清除 deadline，设置 exitCode = 0，让事件循环自然退出

任一步失败 / deadline 到期
→ 记录错误
→ process.exit(1)
```

启动期竞争通过两个检查点收口：连接数据库前检查 `shuttingDown`；数据库连接完成后、`listen()` 前再次检查。这样信号落在启动窗口时，服务不会在关停开始后又重新接收请求。

进程级 fatal 边界使用另一套策略：`uncaughtException` / `unhandledRejection` 表示状态可能已不可信，原则是保留最小诊断后异常退出，由外部 supervisor 负责重启；不要把监听器写成“吞错继续运行”。日志 API 是否同步取决于输出目标，因此这里只承诺最小诊断，不承诺复杂异步刷盘。

## 验证证据

### D5 主线

- 八类场景捕获表完成并通过 review。
- 能区分业务错误、请求级框架错误、脱离请求链的异步错误、stream error 与计划内信号。
- 三次快速 `Ctrl-C` 的原始重复关停问题已修复：关停、MongoDB 断开、服务关闭各执行一次，后续信号被识别为“已在关闭中”。
- 启动期信号竞争、防重入、端到端 deadline、HTTP → DB 顺序和退出码边界已落实到真实 `server.js`。

### Worker 最小对比（作废 · 退回 D6）

> **2026-07-25 更正**：本节原记为「提前完成的 Worker 最小对比」，并列出一组 heartbeat / `/ping` 数字，声称对比通过。本人澄清 W5 D6 实际未进行学习，这些数字未经真正的「预测 → 实测 → 脱稿解释」学习流程验收，**一律作废，不作为掌握证据**。Worker 对比退回 D6（7/27）按重建梯子真正完成后再记录。
>
> `week5-nodejs-internals/src/server.mjs` 与 `src/fib-worker.mjs` 代码保留为脚手架，仅供 D6 时作为实验起点，本身不证明掌握。原始逐轮讨论仍保留在 [`day5-raw-learning-log.md`](./day5-raw-learning-log.md)（顶部已加同样更正说明），供追溯，不作为结论。

## 事实、推断与待验收

### 已验证事实

- Express 5 能接管同步 handler throw 与返回链上的 Promise rejection。
- 悬空 Promise 和 detached callback 不会自动回到 Express error handler。
- graceful shutdown 的重复信号与启动期竞争已经在真实服务实现中收口。
- （原此处的 Worker 对照观测已于 2026-07-25 作废，见上「Worker 最小对比（作废 · 退回 D6）」；不再列为已验证事实。）

### 受控推断

- `server.close()` 解决停止接收新连接并等待已有连接；它不替代数据库关闭，也不等于整个进程已经完成关停。
- （关于 Worker 改变 CPU 工作归属、保护主线程响应性的判断，属 D6 待学习内容，未经本人真正验收，暂不作为本文推断结论。）

### 仍待 D6 验收

- **最小 Worker 对比与使用边界**（此前误记已提前通过，2026-07-25 作废，退回本项）。
- CPU timer 测量基准、threadpool 证据边界和异步 bcrypt 执行归属的到期重建。
- 脱离 AI、笔记、展示板串讲至少三个运行时场景。
- Week 5 四问复盘的本人作答。

## AI 辅助与债务

- D5 错误边界与 shutdown：AI 只做 L1 场景拆解与 review，核心判断和实现由本人完成，不新增债务。
- Worker 最小对比：2026-07-25 更正，该学习实际未进行，此前记录作废，退回 D6；代码保留为脚手架，掌握验收留到 7/27。
- `pipeline()` 失败路径曾接受 L2 定向 review；本日第一档重建与掌握证据均已通过，该债务已还。
- 其余待重建项以根目录 `DEBT.md` 为准，安排在 2026-07-27 D6。

## 下一入口

2026-07-27 的 D6 只做掌握闸门：到期重建 → 三个运行时场景脱稿串讲 → 15 分钟四问复盘。展示板和讲稿只负责呈现已经验收的证据，不替代这三项。
