# W5 D3 · 续接 D2：libuv Threadpool 归属与排队

> 日期：2026-07-22 ｜ 状态：已整理，**D2 主线完成**（CPU 阻塞、threadpool 排队、`UV_THREADPOOL_SIZE` 对照与三类慢判断均已验收）
>
> 本笔记由当天逐轮问答和 code review 整理而成。原始逐字记录保留在 Git 历史（整理前提交）中，本文件只保留结论、证据、关键纠错和援助边界。

## 今日目标与计划变化

- 从 7/21 被临时面试打断的位置恢复，补完 D2 的 threadpool 主线。
- 判断同步忙等、timer、网络 I/O 与 `crypto.pbkdf2()` 的执行归属。
- 本人设计并实现 8 个 `pbkdf2()` 任务的线程池排队实验。
- 只改变 `UV_THREADPOOL_SIZE`，观察任务完成时刻的分组变化。
- 产出“I/O 慢 vs 主线程阻塞 vs threadpool 排队”判断表。

原定 D3 主题是 Stream 与背压。由于 D2 跨日，今天按真实学习顺序续接 D2；Stream 顺延到 7/23，不把未学内容压缩进当天。

## 明确不做

- 不读 libuv 源码。
- 不继续下钻 `epoll` / `kqueue` / IOCP、TCP 重组或 Node HTTP parser。
- 不把 `UV_THREADPOOL_SIZE` 当作通用性能调优开关。
- 不提前进入 Stream、进程生命周期或 Worker Threads。

---

## 一页心智模型（本日核心产出）

```text
1. 发起
   JS 主线程通过 V8 执行异步 API 调用。

2. 底层工作
   普通网络 I/O：主要由 OS 非阻塞 I/O + libuv 监听就绪推进。
   部分 fs / crypto / dns / zlib：由 libuv threadpool 执行。
   timer：由 Node / libuv 跟踪时间，不使用 threadpool 执行 callback。

3. 回调
   底层完成只表示 callback 具备被调度的条件；
   callback 最终仍由 V8 在唯一的 JS 主线程和调用栈中执行。
```

一句话：**底层工作可以在 JS 主线程之外推进，但 JavaScript callback 仍要回到 JS 主线程执行。**

协作链路：

```text
JS 调用 Node API
→ Node 负责 API 语义与运行时整合
→ libuv 负责事件循环、跨平台 I/O 抽象与内部线程池
→ OS 提供实际 I/O 和线程调度能力
→ Node 安排 callback
→ V8 在 JS 主线程执行 callback
```

---

## 1. 任务归属判断

| 任务 / API | 主要机制 | 是否受 `UV_THREADPOOL_SIZE` 影响 |
|---|---|---|
| 同步 `while` 忙等 | JS 主线程，造成 event-loop blocking | 否 |
| `setTimeout` | timer 跟踪 + timers 调度机会 | 否 |
| `setImmediate` | check 阶段 | 否 |
| 普通 TCP / HTTP 网络 I/O | OS 非阻塞 I/O + poll | 否 |
| 异步 `fs` | 通常使用 libuv threadpool | 是 |
| `dns.lookup()` | libuv threadpool | 是 |
| 异步 `crypto.pbkdf2()` / `scrypt()` | libuv threadpool | 是 |
| 异步 `zlib` | libuv threadpool | 是 |

### 两类 worker 不能混淆

| libuv worker thread | `node:worker_threads` |
|---|---|
| Node 内部管理 | 业务代码显式创建 |
| 处理部分底层任务，不运行用户 JavaScript | 拥有独立 V8 isolate，可运行 JavaScript |
| 受 `UV_THREADPOOL_SIZE` 影响 | 不受 `UV_THREADPOOL_SIZE` 影响 |
| 不是新进程 | 也不是新进程，但与主线程隔离执行 JS |

“默认 4”描述的是 libuv threadpool 的 worker thread 数量，不是进程数，也不是 poll 队列数量。

---

## 2. Threadpool 排队实验

核心脚本：`week5-nodejs-internals/src/pbkdf2-test.js`，由本人设计、实现并修正。

### 2.1 实验设计

受控条件：

- 连续提交 8 个参数相同的异步 `crypto.pbkdf2()` 任务。
- Node 版本、运行机器、任务参数和提交方式保持相同。
- 唯一主动改变的变量是 `UV_THREADPOOL_SIZE=4` 或 `8`。
- 两组隔离运行，避免并行进程竞争 CPU 破坏对照。

运行前预测：

```text
SIZE=4：8 个任务超过 4 个 worker，callback elapsed 预期出现近似 4 + 4 两批。
SIZE=8：worker 数不少于任务数，callback elapsed 预期集中在一个窗口。
```

### 2.2 测量口径

脚本可以直接记录：

```text
共同起点：开始提交任务前
callback elapsed：callback 开始执行时间 - 共同起点
Total：最后一个 callback 内完成计数时再次取时钟 - 共同起点
```

`elapsed` 是端到端观测量，混合了：

```text
提交开销
+ threadpool 排队
+ 底层计算
+ 完成后等待 callback 调度
```

因此不能把它命名为“底层计算时间”或“精确排队时间”。普通 JavaScript API 没有记录 worker 实际取走任务和开始计算的时刻。

### 2.3 历史实测

```text
UV_THREADPOOL_SIZE=4
前 4 个 callback：70–79ms
后 4 个 callback：144–151ms
Total：151ms

UV_THREADPOOL_SIZE=8
8 个 callback：107–119ms
Total：119ms
```

### 2.4 事实、推断与未测量

**事实：**

- `SIZE=4` 的 callback elapsed 呈明显 4 + 4 两组。
- `SIZE=8` 的 callback elapsed 集中在一个较窄窗口。
- 调大 pool size 改变了本次实验的完成分组。

**推断：**

- 已知 `pbkdf2()` 使用 libuv threadpool，且任务参数一致、pool size 是唯一主动变量，因此结果强力支持：`SIZE=4` 时后 4 个任务等待 worker 释放，`SIZE=8` 时排队减少。
- 两批之间没有“前一整批全部完成后才统一开始下一批”的屏障；某个 worker 释放后即可接下一个等待任务。
- `SIZE=8` 未达到理想化的比例加速，可能与 CPU 竞争、操作系统调度和其他系统负载有关。

**未测量：**

- 每个 worker 实际开始和结束计算的时刻。
- 每个任务的精确排队时间。
- CPU 竞争、OS 调度和事件循环调度各自贡献了多少延迟。
- `SIZE=4` 与 `SIZE=8` 哪一组波动更大；这需要多轮样本，不能由一次对照判断。

### 2.5 `UV_THREADPOOL_SIZE` 的边界

调大 pool size 可以减少某些 threadpool 任务的排队，但不保证总耗时按比例下降：

- 物理 CPU 算力没有随 worker 数量增加。
- 更多 worker 可能竞争 CPU 并增加调度成本。
- `Total` 反映最后一个 callback 执行到完成计数附近的端到端时间，不能只归因于最后一个底层任务的计算时长。
- 它只影响使用 libuv threadpool 的任务，不会让 JavaScript 主线程变成多线程，也不会加速普通网络 I/O。

---

## 3. 三类“慢”的判断表

| 场景 | 典型观测 | 当前可执行的验证 | 证据边界 |
|---|---|---|---|
| **Threadpool 排队** | 同一 threadpool 的同构任务 callback elapsed 出现明显批次 | 保持任务一致，只改 pool size；批次变化支持排队归因 | 必须先确认 API 使用 threadpool；elapsed 不能直接量出排队时长 |
| **JS 主线程阻塞** | 阻塞期间 timer、I/O、threadpool 等 JavaScript callback 都无法执行 | 测量可疑同步代码段耗时，配合 timer / heartbeat 的 event-loop delay | callback 在阻塞解除后仍按各自队列和阶段调度，不保证同时执行或延迟相等；CPU 高不能单独证明主线程阻塞 |
| **外部 I/O 慢** | 已建立连接的请求等待远端响应较久，但本地 heartbeat 基本准时，调 pool size 无稳定影响 | 先把外部 I/O 等待作为工作假设，再结合客户端计时、服务端日志或 trace 分段定位 | heartbeat 准时只能反对“持续主线程阻塞是主因”；pool size 无效只能降低 threadpool 排队可能，不能绝对排除；当前证据无法区分远端处理、网络传输、拥塞或重传 |

排障时不是根据一个现象直接定案，而是：

```text
提出候选原因
→ 找能区分候选原因的观测
→ 一次只改变一个可控变量
→ 保留仍无法区分的部分
```

---

## 4. 关键纠错留痕

1. **同步忙等不进入 threadpool**：`while` 是同步 JavaScript，由 JS 主线程执行；它制造主线程阻塞，不是 threadpool 排队。
2. **不说“等待主线程结束”**：主线程后续还要执行 callback。准确说法是等待当前调用栈释放并获得事件循环调度机会。
3. **不虚构“异步调用栈”或“Poll I/O 队列”**：JavaScript callback 最终进入唯一的 JS 调用栈；当前实验只能说明完成通知交回事件循环。
4. **提交不等于开始执行**：循环连续调用 8 次 `pbkdf2()` 只证明任务被近乎连续提交，不证明 8 个 worker 同时开始计算。
5. **底层完成不等于 callback 执行**：记录时间的位置是 callback 已获得调度并开始执行之后。
6. **分组变化不等于比例加速**：pool size 从 4 调到 8 后批次消失，但总耗时不保证减半或单调下降。
7. **事实和解释分层**：完成时刻分组是事实；threadpool 排队是基于受控条件的推断；精确排队时间和调度贡献未测量。

---

## 5. 对正式工作的直接帮助

| 当前掌握 | 工作中的用途 |
|---|---|
| JS 主线程、OS I/O、libuv threadpool 的分工 | 收到性能问题时先判断慢点类别，不盲调参数 |
| timer 延迟实验 | 识别大 JSON 处理、复杂正则或同步计算造成的 event-loop blocking |
| `pbkdf2()` 分批实验 | 理解 `fs`、部分 crypto、DNS、zlib 任务为何可能争用同一线程池 |
| 网络 I/O 模型 | 知道慢 HTTP / 数据库请求通常不该默认用 Worker Threads 或调大 pool size |
| 事实 / 推断 / 未测量 | 写性能报告或事故复盘时避免过度归因 |

投入产出结论：到“能提出正确假设并知道该测什么”即止步。`epoll` / `kqueue` / IOCP 差异、TCP 重组和 HTTP parser 内部实现划入 7/31 后 backlog，不继续占用 W5。

---

## 6. 验证证据

```bash
node --check src/pbkdf2-test.js
UV_THREADPOOL_SIZE=4 node src/pbkdf2-test.js
UV_THREADPOOL_SIZE=8 node src/pbkdf2-test.js
```

- 语法检查通过。
- 本人实测得到 `SIZE=4` 两批、`SIZE=8` 一批的完成分布。
- AI 隔离复跑两轮得到相同分组趋势；不同轮次总耗时有波动，因此没有把单次耗时推广为性能保证。
- 最终 review：脚本逻辑、测量口径、职责归属和结论边界一致，无阻断性问题，可以验收。

## 7. AI 辅助记录

- L1 范围：运行时职责讲解、逐题校准、实验变量讨论和范围控制。
- L2 范围：AI 对 `pbkdf2-test.js` 与判断表做定向 review，指出“Poll I/O 队列”、提交 / 执行混淆、callback 时间口径及过度归因等具体位置，并给出“事实 / 推断 / 未测量”的收口结构。
- 核心归属：`pbkdf2-test.js` 的实验逻辑、注释修正、实际运行和最终解释均由本人完成；AI 未直接修改核心 demo。
- 本人理解验证：能够解释 4 + 4 分组、`elapsed` 的混合口径、pool size 的作用边界，并补完三类慢判断表。
- 延迟重建：2026-07-27 D6 按第一档只看本人一页纸笔记重建 threadpool 实验与证据边界；通过后仍需补至少两项掌握证据。已同步 `DEBT.md` 与 `LEARNING-STATE.md`。

## 8. 已完成 / 未完成

- 已完成：D2 全部主线，包括 CPU 阻塞、threadpool 归属、`pbkdf2()` 排队对照、`UV_THREADPOOL_SIZE` 边界和三类慢判断表。
- 未完成：原定 D3 的 Stream 与背压，按计划顺延到 7/23。
- 不计为未完成：更深的 OS / TCP / parser 内部实现，已明确移出本周范围。

## 9. 下一入口（D4）

从“大文件导出 / 文件转发”场景进入 Stream：先解释整块读取的内存和首字节风险，再建立 Readable / Writable、背压和 `pipeline()` 的最小模型；不回头下钻 D2 backlog。
