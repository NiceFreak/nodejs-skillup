# W5 D4 · Stream、背压与生产边界

> 日期：2026-07-23 ｜ 状态：已整理，**D4 完成**（整块读取风险、Readable / Writable、背压、可观察 demo 与 `pipeline()` 成功 / 失败路径均已验收）
>
> 本笔记由当天分段学习、逐轮问答和 code review 整理而成。原始逐字记录保留在 Git 历史（整理前提交）中，本文件只保留结论、证据、关键纠错和援助边界。

## 今日目标

围绕“大文件导出 / 文件转发”这一类正式 Node.js 后端任务，建立可用于实现、code review 和故障排查的最小 Stream 模型：

```text
整块读取的工作风险
→ Readable / Writable 数据流
→ producer / consumer 速度差
→ backpressure 信号与恢复
→ 本人实现可观察 demo
→ pipe() / pipeline() 的错误与生命周期边界
```

## 明确不做

- 不读 Node Stream 源码，不下钻 `_read()` / `_write()` 内部实现。
- 不讨论 TCP 背压链路、Web Streams 或复杂自定义 Stream。
- 不做精细 GC、吞吐 benchmark 或 highWaterMark 参数调优。
- 不修改 Week2–4 主应用，不新增导出 API。
- 不把 D5 错误边界或 D6 Worker Threads 提前混入今天。

---

## 一页心智模型（本日核心产出）

```text
整块读取
  readFile() 完成后，回调一次拿到完整 Buffer
  → 单请求可能同时持有完整文件内容
  → 并发重叠时内存压力随文件大小和并发量上升
  → 如果拿到完整结果后才响应，首字节要等完整读取结束

流式处理
  Readable 逐块产生 chunk
  → Writable 逐块接收和处理
  → 数据不要求完整驻留内存
  → 可更早交付首个 chunk

背压
  producer 比 consumer 快
  → Writable 内部未完成数据增加
  → write(chunk) 返回 false
  → producer 停止继续取数 / 产出 / 写入
  → consumer 继续消化积压
  → 'drain' 表示可以恢复写入

生产链路
  pipe()：连接数据流并协调常规背压
  pipeline()：在此基础上统一成功 / 失败出口和链路清理
```

一句话：**Stream 解决分块处理，背压解决速度协调，`pipeline()` 解决整条链路的完成、错误和资源收口。**

---

## 1. 整块读取的业务风险

### 1.1 内存模型

`fs.readFile()` 的回调拿到的是完整文件内容。若多个大文件请求的读取和响应时间重叠，多个完整 `Buffer` 可能同时驻留在进程中，内存峰值近似受以下因素共同影响：

```text
单文件大小 × 重叠请求数 + 其他进程内存
```

这里不能把 `Buffer` 简单说成 V8 heap 对象：

- `Buffer` 的二进制数据通常反映在 `process.memoryUsage()` 的 `external` / `arrayBuffers`。
- V8 heap 中仍有包装对象和引用，但大块二进制数据不等同于 `heapUsed`。
- 排查 Buffer 压力时应同时看 `heapUsed`、`external`、`arrayBuffers` 和 RSS，不能只看 V8 heap limit。

### 1.2 并发与失败边界

并发整块读取会提高内存压力，但本日没有实测具体崩溃方式。最终可能表现为 Node 分配失败、操作系统终止进程、系统换页或整体延迟恶化，取决于容器限制、物理内存、操作系统和其他负载。

因此准确结论是：**整块读取在大文件和并发重叠下有显著内存风险**，不能仅凭一个过时的 heap limit 数字断言必然如何崩溃。

### 1.3 首字节时间

若代码必须等 `readFile()` 回调拿到完整文件后才开始响应，则首字节等待覆盖整个文件读取过程。Stream 可以在第一个 chunk 到达后开始处理和发送，不必等完整文件 materialize。

未测量边界：本日没有用 2 GB 文件或并发请求实测 RSS、吞吐和首字节时间；相关数字只用于建立风险模型。

---

## 2. Readable / Writable 最小模型

| 概念 | 本日采用的定义 | 文件转发示例 |
|---|---|---|
| producer / Readable | 产生或读取数据的一端 | 文件读取流 |
| consumer / Writable | 接收并处理数据的一端 | 文件写入流或 HTTP response |
| chunk | 一次在流中交付和处理的数据单元 | 一段 `Buffer` |
| internal buffer | producer 与 consumer 速度不一致时，流内部暂存尚未完成数据的区域 | Writable 尚未处理完的数据 |
| Node `Buffer` | JavaScript 中常见的二进制数据对象 | chunk 的一种常见表示 |
| Transform | 同时消费上游、转换数据并向下游生产 | 边读边转大写 |

关键边界：

- chunk 表示“一次处理的数据单元”，从 Readable 交给 Writable 后仍然是 chunk，不因位置变化失去这个身份。
- internal buffer 只能保存已经产生并交给流、但尚未完成的数据，不能保存“未来还没产生的数据”。
- buffer 是缓冲机制或区域；`Buffer` 是 JavaScript 对象类型，两者不能混用。

---

## 3. 背压控制链

### 3.1 为什么需要背压

当 producer 的平均字节生产速率持续高于 consumer 的处理速率：

```text
进入的数据 > 完成的数据
→ 未完成数据持续积累
→ 内部缓冲与进程内存上涨
→ 延迟、GC 压力和 OOM 风险增加
```

背压是 consumer / Writable 反向通知 producer 降速的反馈机制。它不是让 consumer 突然变快，而是阻止上游无限制扩大积压。

### 3.2 `write() === false`

```text
producer 调用 write(chunk)
→ Writable 接纳当前 chunk
→ 接纳后的未完成数据达到压力条件
→ write() 返回 false
→ producer 不再继续写后续 chunk
```

`false` 不表示当前 chunk 被拒绝或写入失败；它表示当前 chunk 已被接纳，但调用方必须暂停后续写入。

### 3.3 `highWaterMark`

`highWaterMark` 是触发背压判断的阈值，不是禁止内存超过的硬上限。一个 chunk 会先被接纳，再形成 `write()` 的布尔结果，因此未完成数据可能短暂达到或超过该阈值。

它也不是“最优性能值”。本日只学习信号语义，不讨论如何为生产负载调参。

### 3.4 `'drain'`

producer 因 `false` 暂停后，Writable 在内部积压回到可安全继续写入的状态时发出 `'drain'`：

```text
write() 返回 false
→ producer 暂停
→ consumer 继续完成数据
→ 'drain'
→ producer 恢复写入
```

`'drain'` 只提供“本地 Writable 可以继续接收数据”的许可，不证明：

- 所有数据已到达最终客户端。
- 客户端已经处理或确认数据。
- 整条业务操作已经成功。

---

## 4. 可观察背压 demo

核心脚本：`week5-nodejs-internals/src/stream-test.js`，由本人设计、实现并修正。

### 4.1 实验设计

配置：

```text
producer：每 10ms 产生 1 字节 chunk
consumer：每个 chunk 用 50ms 异步完成
highWaterMark：5 字节
总量：30 个 chunk
```

用异步延迟制造慢 consumer，而不是同步忙等，原因是：等待期间 event loop 仍能处理 heartbeat 和其他 callback，不会把主线程阻塞误判为背压。

自定义 Writable 只有在异步处理结束后才调用 `_write()` 的 callback。若提前 callback，Writable 会认为当前 chunk 已完成，实验中的“慢 consumer”就不真实。

### 4.2 验收证据设计

仅看到程序变慢不能证明背压。必须同时观察：

```text
write() 返回 false
→ producer write 停止
→ 暂停窗口内 consumer / heartbeat 继续
→ 'drain' 出现
→ producer 才恢复 write
```

这组证据排除了“整个 event loop 被同步代码卡住”的替代解释。

还要连续观察 `writableLength`，确认多轮暂停 / 恢复期间峰值没有持续抬升。只记录开始和结束内存值无法排除中途出现过危险峰值。

### 4.3 实测结果

- 共调用 `write()` 30 次。
- 第 5、10、15、20、25、30 次均返回 `false`，共 6 次。
- 前 5 次 `false` 后均出现完整的“producer 暂停 → consumer / heartbeat 继续 → `'drain'` → producer 恢复”。
- `writableLength` 在每轮中重复出现 `1 → 5 → 0`，没有观察到峰值随运行时间持续抬升。
- 第 30 次 `false` 后 producer 已无更多数据，调用 `end()`；consumer 完成剩余数据后触发 `finish`，因此只有 5 次 `'drain'`。

有限实验边界：这些结果支持“当前受控配置下积压有界”，不能证明任意输入、任意运行时间或任意生产环境负载下永远有界。

### 4.4 `writableLength` 的关键纠错

首版使用手工计数器表示“当前缓冲”，但它的更新时间晚于 `write()` 内同步触发 `_write()` 的时刻，不能直接代表 Node Stream 内部状态。最终改为读取 `writable.writableLength`。

在本机 Node 24 的当前 demo 中，观测到：

```text
_write() 开始处理第一个 chunk：writableLength = 1
producer 继续写到阈值：writableLength = 5
当前 chunk 的异步处理结束、但 callback 尚未调用：仍为 5
callback 调用后：当前 chunk 被确认完成，后续值逐步下降
最后一个未完成 chunk callback 后：drain 时为 0
```

因此本日采用的实验解释是：`writableLength` 反映 Writable 已接纳、但尚未完成的数据量；当前正在 `_write()` 中且尚未 callback 的 chunk 仍计入。这个解释来自当前 Node 24 行为与输出，不把手工计数器当作内部实现事实。

### 4.5 最后一次 `false` 后为什么可以 `end()`

`write() === false` 的约束是：**若还有更多数据要写，必须等待 `'drain'` 后再继续写。** 第 30 个 chunk 已是最后一个，producer 不再需要恢复生产，可以调用 `end()` 声明输入结束。Writable 会先处理完已接纳数据，再触发 `finish`；这没有绕过背压，也没有丢弃数据。

---

## 5. `pipe()` 与 `pipeline()` 的生产边界

### 5.1 `pipe()` 解决什么

`readable.pipe(writable)` 自动完成：

- 从 Readable 读取 chunk 并写入 Writable。
- 在下游 `write()` 返回 `false` 时暂停上游。
- 在下游可继续写入时恢复上游。
- 在正常读取结束时结束目标 Writable（除非显式配置例外）。

它减少了手写 `write(false)` / pause / `'drain'` / resume 控制链，但不能据此假设整条链路的所有错误都会被统一转发、所有资源都会自动按预期清理。

### 5.2 为什么生产链路优先考虑 `pipeline()`

`pipeline()` 把 Readable、Transform 和 Writable 作为一条链路管理：

- 成功时提供统一完成出口。
- 任一环节失败时把错误送到统一失败出口。
- 销毁仍未完成的相关 streams，减少文件句柄或半开链路残留。

选择它的核心理由不是写法更短，而是**错误传播、资源清理和完成语义集中**。

### 5.3 最小 `pipeline()` demo

核心脚本：`week5-nodejs-internals/src/minimal-pipeline.js`，由本人设计、实现并修正。

成功契约：

```text
输入文件 → Transform（ASCII a-z 转 A-Z）→ 输出文件
输入 / 输出字节数相同
除 ASCII 小写转大写外，其余字节和位置不变
```

实测：输入和输出均为 102 字节，字节数比较为 `true`，内容匹配预期为 `true`。

失败契约：

```text
输出目标使用运行前已存在的目录 __dirname
→ 当前 macOS 环境打开输出端失败并得到 EISDIR
→ pipeline() 的 Promise 出口收到错误
→ Readable / Transform / Writable 均为 destroyed: true
→ 错误被处理，进程正常退出
```

环境边界：`EISDIR` 是当前 macOS 验收事实，不把具体错误码推广为所有平台的保证。跨平台契约是“已存在目录作为文件输出目标时，输出端打开失败并由统一出口收到错误”。

### 5.4 失败注入纠错

首版写成：

```text
path.join(__dirname, 'src')
```

由于脚本本身已经位于 `src/`，该路径实际是尚不存在的 `src/src`。`createWriteStream()` 将它创建成普通文件，失败路径反而正常完成，预期 `EISDIR` 没有发生。

失败注入必须满足：目标在运行前已经是一个目录。最终由本人改为 `FAIL_OUTPUT = __dirname`，删除误创建文件并重新运行，失败证据闭环。

---

## 6. 工作判断与排障入口

| 工作问题 | 第一判断 | 下一步证据 |
|---|---|---|
| 大文件导出是否使用 `readFile()` | 先问是否必须完整 materialize；若可逐块处理，优先评估 Stream | 文件大小、并发重叠、RSS / external、首字节时间 |
| 进程内存持续上涨 | 分开考虑“整块内容并发驻留”和“未遵守背压导致积压” | `heapUsed` / `external` / `arrayBuffers` / RSS，加上 `writableLength` 时间序列 |
| producer 比 consumer 快 | 检查 `write(false)` 后是否真正停产 | false 到 drain 之间的 producer、consumer 和 heartbeat 日志 |
| 多段 stream 链路进入生产 | 检查是否有统一成功 / 失败出口和失败后资源清理 | 注入读端 / 写端错误，观察错误出口、close / destroyed 状态 |

---

## 7. 验证证据

```bash
node src/stream-test.js
node src/minimal-pipeline.js
```

- 背压 demo：30 次 write、6 次 `false`、5 次 `'drain'`，heartbeat 持续，最终正常 `finish`。
- `pipeline()` 成功路径：102 字节输入 / 输出，转换契约通过。
- `pipeline()` 失败路径：统一出口捕获 `EISDIR`，三个 streams 均为 `destroyed: true`。
- 本人运行与 AI 独立复跑结果一致。
- 最终 review：D4 无阻断性问题，可以验收。

## 8. 关键纠错留痕

1. **`Buffer` 不等于 V8 heap**：大块二进制压力主要还要看 external / arrayBuffers / RSS。
2. **完全静默不能证明背压**：它也可能意味着 event loop 被阻塞；必须看到 producer 停止而 consumer / heartbeat 继续。
3. **`false` 不等于写入失败**：当前 chunk 已接纳，暂停约束针对后续写入。
4. **`highWaterMark` 不是硬内存上限**：它是背压阈值，不禁止短暂达到或超过。
5. **`'drain'` 不等于客户端已收到**：它只是本地恢复写入信号。
6. **手工计数器不等于 Stream 内部指标**：时序和语义不同，最终使用 `writableLength` 并按实测解释。
7. **6 次 `false` 不要求 6 次 `'drain'`**：最后一次已无后续数据，`end()` 后以 `finish` 收口。
8. **预期输出不是运行证据**：首次 `pipeline()` 失败路径实际成功，必须修正路径并保留真实错误输出后才能验收。

## 9. AI 辅助记录

- S1–S4 主要为 L1：原理拆解、一次一个设计点、证据边界 review 和范围控制。
- S5 为 L2 定向 review：AI 精确指出 `FAIL_OUTPUT` 实际解析为可新建的 `src/src` 文件，因此预期输出端错误未发生；未直接修改核心 demo。
- 核心归属：两个 demo 的实验逻辑、实现、修正和实测均由本人完成。
- 本人理解验证：能够解释背压控制链、`writableLength` 时序、最后一次 `false` 的终止路径，以及失败目标必须在运行前已是目录。
- 延迟重建：2026-07-24 D5 开始前按第一档只看本人一页纸笔记，重建 `pipeline()` 成功 / 输出端失败路径；通过后仍需补至少两项掌握证据。已同步 `DEBT.md` 与 `LEARNING-STATE.md`。
- 当日展示审查追加一项 L2 纠错：D1 笔记把当前项目异步 `bcrypt.hash/compare` 归为占用 JS 主线程，但本地 bcrypt 6.0.0 的异步 API 使用 threadpool。AI 只修正白名单展示层并给出本地依赖证据，不代改本人事件循环笔记；安排 7/27 与 threadpool 债务一起重建任务归属。

## 10. 已完成 / 未完成

- 已完成：整块读取风险、Readable / Writable 模型、背压控制链、可观察背压 demo、`pipe()` / `pipeline()` 边界及成功 / 失败实证。
- 未完成：无 D4 主线遗留。
- 不计为未完成：Stream 源码、TCP 背压、Web Streams 和精细性能调优，均为当天明确不做项。

## 11. 下一入口（D5）

先用 15–20 分钟完成 `pipeline()` 成功 / 输出端失败路径的第一档延迟重建；随后进入同步 throw、Promise rejection、Express async error、stream error 与进程级异常的捕获边界，并设计 graceful shutdown 最小顺序。
