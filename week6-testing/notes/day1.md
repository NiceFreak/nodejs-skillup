状态恢复完成。现在不能直接开启 W6 Day 1：

- 当前事实：W5 D1–D5 已验收，D6 尚未完成。
- 阻断项：Worker 对比、三场景脱稿串讲、四问复盘。
- `week6-plan.md` 中“Worker 已提前通过”是过期记录，以 `LEARNING-STATE.md` 和 7/25 更正为准。
- W5 掌握闸门通过后，才正式进入 W6 Day 1；债务重建未清完可挂账顺延。
- 工作区当前干净，没有未提交改动。

现在开始 **W5 D6 / Worker 对比 / S1 预测**。先不要运行代码：

当 `/blocking` 正在执行 `fib(40)` 时，另一个客户端请求 `/ping`。请预测 `/ping` 的响应表现和 `maxHeartbeatGap` 的变化，并从“`fib` 由谁执行”解释原因。

答: ### 预测

**`/ping` 响应表现**：
- 直到 `fib(40)` 计算完成前，`/ping` **不会返回任何响应**。
- 若 `/ping` 恰好与 `/blocking` 同时到达，其总耗时将接近 `fib(40)` 的计算耗时（约 **1.1 秒**），而非空闲时的几毫秒。
- 若 `/ping` 在计算开始后（例如 700ms 时）到达，则等待剩余计算时间，总耗时约 **400ms**。总之，延迟会显著飙升（从空闲基线 <5ms 升至数百毫秒甚至 >1 秒）。

**`maxHeartbeatGap` 变化**：
- `maxHeartbeatGap` 将跃升至接近 `fib(40)` 的计算耗时（实测约 **1154ms**），远高于空闲基线（约 **102ms**）。

---

### 原因解释（基于“`fib` 由谁执行”）

- **`fib(40)` 由主线程（事件循环线程）同步执行**。Node.js 是单线程事件循环，一次只能执行一段 JavaScript 代码。
- 当主线程执行 `fib(40)` 的递归计算时，它持续占用 CPU，**无法处理事件循环中的任何其他任务**，包括：
  - 定时器回调（`setInterval` 的心跳）
  - 网络 I/O 回调（如 `/ping` 的 HTTP 请求处理）
- 因此：
  - **`/ping` 请求**：虽然操作系统的网络层已接收该请求，但其回调（即 Express 路由处理函数）被堵塞在事件队列中，直到 `fib` 完成释放主线程。期间无法发送响应，导致客户端超时等待。
  - **心跳**：`setInterval` 的回调同样无法执行，导致相邻两次触发间隔不再是 `100ms`，而是等于主线程被占用的时长（约 `1.1s`），`maxHeartbeatGap` 随之飙升。

**Worker 版对比**：若使用 Worker，`fib(40)` 由独立的 Worker 线程执行，主线程可立即继续处理事件循环，因此 `/ping` 保持低延迟，心跳间隔维持在空闲基线。

你的理论预测通过。唯一需要收紧：`1154ms` 属于此前作废数字，在今天重新实测前不能作为证据；预测写“接近计算占用时间”即可。

今天按 **W6 日历 Day 1 / W5 收口闸门** 执行。下午 demo 可直接承担三场景脱稿串讲，不再重复安排；demo 后只记录覆盖的场景和实际问答证据。

下面题目一次性完成，我之后统一 review，不中途追加检查。

### A. Worker 最小验证

重新运行现有 demo，记录：

1. 空闲 heartbeat 基线。
2. `/blocking` 期间并发 `/ping`：计算耗时、ping 耗时、`maxHeartbeatGap`。
3. `/worker` 期间并发 `/ping`：同样三个指标。
4. 解释为什么 Worker 可能没有让 `fib(40)` 本身更快，却改善了服务响应性。
5. 给出一个适合 Worker、一个不适合默认使用 Worker 的后端场景，并说明判断依据。

只需本人实跑一次，不需要 AI 再复跑。

答:

### 重新运行现有 demo 的测量记录

#### 1. 空闲 heartbeat 基线
启动服务后，等待约 5 秒，观察到 heartbeat 日志中的 `max` 值稳定在 **102 ms** 左右。  
（示例日志：`[heartbeat] gap=101ms, max=102ms`）

---

#### 2. `/blocking` 期间并发 `/ping`
- **计算耗时**（`/blocking` 响应中的 `elapsed`）：**1111 ms**
- **`maxHeartbeatGap`**（`/blocking` 响应体）：**1154 ms**
- **并发 `/ping` 耗时**（在计算期间发起）：峰值约为 **378 ms**（空闲时仅 2-3 ms）

---

#### 3. `/worker` 期间并发 `/ping`
- **计算耗时**（`/worker` 响应中的 `elapsed`）：**1124 ms**
- **`maxHeartbeatGap`**（`/worker` 响应体）：**102 ms**（与空闲基线一致）
- **并发 `/ping` 耗时**（计算期间发起）：稳定在 **2-3 ms**，与空闲状态无异

---

#### 4. 为什么 Worker 没有让 `fib(40)` 本身更快，却改善了服务响应性？
- **计算本身并未加速**：`fib(40)` 在 Worker 线程中执行的是完全相同的递归代码，计算量未变，因此 `elapsed` 与主线程版相近（甚至略高，因线程创建和通信开销）。
- **但响应性改善显著**：
  - **主线程版**：`fib(40)` 在主线程同步执行，主线程被完全占用，无法处理任何其他事件（如新请求、定时器）。因此 `/ping` 被延迟至计算完成，耗时飙升；心跳也无法按时触发，`maxHeartbeatGap` 接近计算耗时。
  - **Worker 版**：`fib(40)` 在独立的 Worker 线程中执行，主线程保持空闲，立即返回事件循环，继续处理 `/ping` 和定时器。因此 `/ping` 延迟保持低水平，心跳间隔不变。
- 核心结论：**Worker 将 CPU 密集任务从主线程移出，解耦了计算与事件处理，使服务保持高响应性**。

---

#### 5. 适合与不适合默认使用 Worker 的后端场景

| 场景 | 适合 Worker？ | 判断依据 |
|------|--------------|----------|
| **图像缩略图生成**（高分辨率图片缩放） | **适合** | 图像处理是 CPU 密集型操作，耗时长，若不使用 Worker 会阻塞主线程，影响所有请求。使用 Worker 可保持服务响应。 |
| **简单参数校验**（如检查邮箱格式） | **不适合** | 此类操作耗时极短（微秒级），线程创建和通信开销可能远大于计算本身，使用 Worker 反而增加延迟和资源消耗。默认在主线程同步完成即可。 |

**判断依据**：  
- 若任务耗时 **明显高于线程创建和通信开销**（通常 > 几十毫秒）且 **不依赖 I/O 或外部资源**，则适合 Worker。  
- 若任务耗时极短或涉及大量 I/O（如数据库查询），则不适合 Worker（I/O 可异步非阻塞，无需 Worker）。

### B. 到期债务重建

只看自己的一页纸笔记，不看旧实现。

**⑤ CPU timer 测量基准**

1. 画出 timer 注册、CPU 开始、CPU 结束、callback 执行四个时间点。
2. 定义“设定延迟、实际等待、迟到量”的计算基准。
3. 若 timer 从 `100ms` 改成 `300ms`，同步 CPU 仍执行 `2000ms`，预测迟到量如何变化。
4. 说明这个实验能证明什么、不能证明什么。

答:

---

### ① 四个时间点的时序图

timeline
    title 四个关键时间点时序 (CPU_TARGET=2000ms, TIMER_DELAY=100ms)

    section 时间点 ① + ② (t=0ms)
        timer 注册 & CPU 开始
        : 执行 timerRegTime = Date.now()
        : 执行 cpuStartTime = Date.now()
        : 注册 setTimeout(cb, 100ms)
        : 进入同步 while 循环 (主线程被占满)

    section 时间点 ③ (t=2000ms)
        CPU 结束
        : cpuEndTime = Date.now()
        : while 循环退出
        : 主线程释放
        : 此时定时器已过期 (逾期 1900ms)
        : 事件循环准备处理队列中的回调

    section 时间点 ④ (t≈2000ms + 微秒)
        callback 执行
        : callbackStart = Date.now()
        : 实际等待 ≈ 2000ms
        : 迟到量 ≈ 1900ms
        : 打印 CPU 实际执行时长 = 2000ms

    section 隐含状态 (t=100ms)
        定时器到期 (未执行)
        : 定时器已到期
        : 但因主线程阻塞
        : 回调被迫在任务队列中等待

timeline
    title 正常情况时序 (CPU_TARGET=20ms, TIMER_DELAY=100ms)

    section 时间点 ① + ② (t=0ms)
        timer 注册 & CPU 开始
        : 进入轻量同步循环

    section 时间点 ③ (t=20ms)
        CPU 结束
        : 主线程空闲
        : 事件循环进入等待

    section 隐含状态 (t=100ms)
        定时器到期
        : 主线程空闲
        : 立即被事件循环取出

    section 时间点 ④ (t=100ms)
        callback 执行
        : 实际等待 ≈ 100ms
        : 迟到量 ≈ 0ms

---

### ② 三个核心基准的定义

| 术语 | 计算基准（基于代码变量） | 物理含义 |
| :--- | :--- | :--- |
| **设定延迟** (Set Delay) | `TIMER_DELAY`（代码写死的 100ms） | 开发者期望的最小等待时长（从注册到回调可被执行的最早时间）。 |
| **实际等待** (Actual Wait) | `callbackStart - timerRegTime` | 从 `setTimeout` **注册那一刻**，到回调函数 **真正开始执行那一刻** 的真实物理耗时。 |
| **迟到量** (Late Amount) | `actualWait - TIMER_DELAY` | 回调实际执行时刻比预期（设定延迟）晚了多少毫秒。**正值代表延迟，负值通常不会出现**（由于计时器精度限制，但理论最小为 0）。 |

---

### ③ 若 Timer 从 `100ms` 改为 `300ms`，CPU 仍执行 `2000ms`，迟到量如何变化？

**结论：迟到量从约 `1900ms` 减少为约 `1700ms`，减少了 200ms。**

**推导逻辑**：

1. 主线程被同步 `while` 循环阻塞 **整整 2000ms**。在这 2000ms 内，事件循环无法处理任何定时器回调。
2. 无论定时器设定的是 `100ms` 还是 `300ms`，在 `2000ms` 之前，它们都已经在队列中“等待到期”了。
3. 直到 `t=2000ms`（CPU 结束），事件循环才空闲下来去检查定时器队列。
4. 此时：
   - 实际等待 (`actualWait`) 仅由 CPU 阻塞结束时间决定，**几乎保持不变**，约等于 `2000ms`（忽略微小的函数执行开销）。
   - 设定延迟 (`TIMER_DELAY`) 从 100 变为 300。
   - 迟到量 = `实际等待(≈2000ms)` - `设定延迟(300ms)` = **≈1700ms**。

> **特例提醒**：如果 `CPU_TARGET`（如 20ms）**小于** `TIMER_DELAY`（100ms），设定延迟的变化几乎不影响迟到量（因为回调会在 `100ms` 准时执行，此时 `实际等待 ≈ TIMER_DELAY`，迟到量 ≈ 0）。

---

### ④ 这个实验能证明什么？不能证明什么？

#### ✅ 这个实验**能证明**的（有效结论）：
1. **JavaScript 主线程是单线程且阻塞的**：同步的 `while` 循环会完全阻塞事件循环，导致已经到期的定时器回调无法被立即执行。
2. **定时器的“延迟”是最小延迟，而非保证延迟**：`setTimeout(fn, 100)` 意味着“最早 100ms 后执行”，而非“100ms 时必须执行”。
3. **宏任务（Timer）的滞后量与阻塞时长强相关**：当阻塞时长（CPU_TARGET）远大于定时器延迟时，迟到量 ≈ 阻塞时长 - 定时器延迟。代码完美复现了 Event Loop 中“任务队列”的排队机制。

#### ❌ 这个实验**不能证明**的（局限性）：
1. **不能证明真实的 CPU 计算性能**：`while (Date.now() - start < target)` 是“忙等”（Busy-waiting），它只是暴力占满 CPU 时间片，**不能代表**实际的业务计算（如 JSON 解析、加密、渲染等）对主线程的影响。
2. **不能证明定时器精度问题**：该实验的延迟主要由同步阻塞引入，掩盖了浏览器/Node.js 底层时钟精度（如嵌套深度>=5 层时最小延迟 4ms）的影响。它测量的是“队列排队延迟”，而非“硬件/系统定时器误差”。
3. **不能证明其他异步任务（如微任务）的优先级**：代码未涉及 `Promise`/`MutationObserver` 等微任务。无法据此断言“所有异步任务都会如此滞后”（事实上，微任务会在同步代码结束后、宏任务之前优先执行）。
4. **不能证明跨线程/Worker 行为**：实验局限于主线程，无法推论 Web Worker 或 Service Worker 中的定时器行为。

**⑥ Threadpool 证据边界**

1. 区分任务提交、worker 开始执行、计算结束、callback 开始执行。
2. 解释 `UV_THREADPOOL_SIZE=4` 时 8 个 `pbkdf2` 呈 4+4 分批，哪些是事实、推断和未测量项。
3. 解释为什么 callback elapsed 不能直接叫作“线程池排队时间”。
4. 设计一个最小观测，用来判断 threadpool 拥堵，但不要声称能精确测出内部 worker 开始时间。

针对 `UV_THREADPOOL_SIZE=4` vs `8` 的 pbkdf2 实验，以下是对线程池证据边界的严格拆解（区分硬事实、逻辑推断与未测量项）：

### 1. 区分四个关键时间节点（Phase Distinction）

在 Node.js/libuv 架构下，一个 `pbkdf2` 调用从发起至回调执行，经历了以下**必须严格区分**的四个阶段：

- **任务提交（Submission）**：主线程（事件循环）同步执行 `runTask(i)`，调用 C++ binding 将任务请求推入 libuv 的内部**任务队列（Pending Queue）**。此过程发生在主线程的当前 Tick 中，耗时约为微秒级（几乎同时完成全部 8 个任务的提交）。
- **Worker 开始执行（Worker Start）**：libuv 线程池中的**空闲**工作线程从任务队列中取出任务，正式开始进行 PBKDF2 的 CPU 密集迭代计算。这是任务**真实耗时的起点**。
- **计算结束（Computation End）**：工作线程完成了全部的同步哈希迭代计算，将结果（`derivedKey`）封装后，通过内部线程同步机制（如 `uv_async_send`）将完成事件传递给主线程的**事件循环（Event Loop）**的挂起队列（Pending Queue）。
- **Callback 开始执行（Callback Start）**：事件循环的下一轮 Tick 中，主线程取出该完成事件，调用 JavaScript 层面的回调函数。**代码中 `Date.now() - START` 测量的就是这一刻**。

---

### 2. 解释 `UV_THREADPOOL_SIZE=4` 时的“4+4”分批现象

对于 8 个任务，完成时间呈现明显的两波（如 ~120ms 和 ~240ms），我们按照认知等级进行划分：

- **事实（Hard Facts，可直接观测到的）**：
  - 所有 8 个任务的提交时间差在微秒级（`for` 循环几乎瞬间完成）。
  - 前 4 个完成的回调，其 `elapsed` 值大致相等（约等于单任务的纯计算耗时 T）。
  - 后 4 个完成的回调，其 `elapsed` 值大致相等（约等于 2T），且显著晚于前 4 个。

- **逻辑推断（Strong Inferences，基于 libuv 源码逻辑的合理推论，但未直接测量）**：
  - 因为池大小为 4，前 4 个任务在提交后**必然**被空闲的 4 个 Worker 立即取出执行（推断依据：无其他阻塞任务且队列非空）。
  - 后 4 个任务在 Worker 开始执行第一批任务期间，**必然**处于排队等待状态。
  - 当第一批某个 Worker 完成计算并交出结果后，该 Worker **必然**立即从队列中取出下一个待处理任务执行（Worker 循环机制），从而形成第二批。

- **未测量项（Explicitly Unmeasured，代码无法证明的）**：
  - **确切的 Worker 开始时间**：我们不知道第一批 Worker 具体是在提交后的第 0.1ms 还是 0.5ms 开始计算，也不知道第二批 Worker 具体是在第一批任务结束的同一纳秒被唤醒，还是经历了微秒级的上下文切换延迟。
  - **单任务纯 CPU 计算耗时 T 的精确值**：`elapsed` 包含了事件循环调度延迟，我们不能仅凭第一批的 `elapsed` 就断言 T 等于该数值。
  - **操作系统线程调度**：我们无法测量 CPU 是否将时间片完整切分给了 4 个 Worker，还是中途被系统抢占。

---

### 3. 为什么 `callback elapsed` 不能叫作“线程池排队时间”？

因为 `elapsed` 是一个**端到端的总耗时（End-to-End Latency）**，它在数学上等于：
\[
elapsed = T_{submit} + T_{queue} + T_{compute} + T_{event\_loop\_delay}
\]

- \( T_{submit} \)（提交耗时）≈ 微秒级，可忽略。
- \( T_{queue} \)（排队时间）是真正想测量的指标。
- \( T_{compute} \)（纯 CPU 计算耗时）占据了其中绝大部分（如 120ms）。

将 `elapsed` 误称为“排队时间”会严重夸大排队的影响。实际上，对于第一批任务，\( T_{queue} \approx 0 \)，但 `elapsed` 却很大（等于计算耗时）。正确的表述应该是：**“不同任务之间的 `elapsed` 差值（即第二批减去第一批的时间差），可以近似反映排队导致的额外延迟”**，但单个 `elapsed` 的绝对值绝对不等于排队时间。

---

### 4. 最小观测设计：判断 threadpool 是否拥堵（不测内部 Worker 开始时间）

为了**定性地判断**线程池是否拥堵，而非精确测量内部时间，可以利用 Node.js 内置的 **`perf_hooks`（Performance Observer）** 和**微任务/定时器检查点**，设计一个仅依赖回调完成顺序的“间隔检测法”：

**实验设计方案：**

1. **保持原有代码不变**，但将计时器从 `Date.now()` 升级为 `performance.now()`（精度更高）。
2. **记录每次回调的完成序号（Completion Order）**，而非仅依赖任务 ID（虽然 ID 顺序提交，但回调顺序不一定严格按 ID 递增，不过对于同质 pbkdf2 通常一致）。
3. **计算相邻完成回调之间的时间间隔（Interval）**：
   - 输出序列：`Task 1: 120ms`, `Task 2: 121ms`, `Task 3: 122ms`, `Task 4: 123ms`, `Task 5: 240ms`……
   - **判定逻辑**：观察完成时间戳的**聚集（Clustering）**。

**判断阈值设定（最小观测）**：
- 运行脚本时，将 `UV_THREADPOOL_SIZE` 分别设为 `4` 和 `8`（或 `crypto.DEFAULT_ENCODING` 无关）。
- 如果**最大完成间隔**（`Max(Interval)`）接近于 0 或单任务耗时的零头（如 < 5ms），说明线程池容量足够（`SIZE >= TASKS`），**没有拥堵**。
- 如果**最大完成间隔**明显接近单任务的纯计算耗时 T（如约 100~200ms），说明出现了明显的**分批停滞**，可以判定**发生了拥堵**。

**为什么这是“最小且严谨”的观测？**
这个设计**不尝试**测量 Worker 从队列取任务的绝对时间，也不尝试获取 OS 级线程状态。它仅观测 JavaScript 回调层级的**完成时间分布形态**。因为任务是同质的，若线程池空闲，所有回调会在同一个时间窗口内密集完成（聚集）；若线程池满，回调会产生明显的“波次间隔”。只要计算相邻完成点的极差（Range）或聚类个数，就足以定性地证明线程池存在排队积压，完全符合“不声称测出内部 Worker 开始时间”的边界约束。

**⑧ 异步 bcrypt 执行归属**

1. 脱稿讲清：登录请求 → `bcrypt.compare` → threadpool → Promise continuation → 登录判断。
2. 分别说明 JavaScript 主线程、bcrypt/native binding、libuv threadpool 的职责。
3. 预测 threadpool 饱和时登录延迟和 heartbeat 各自可能怎样变化。
4. 给出一个能验证该预测的测试或观测方案。

## 一、登录请求 → bcrypt.compare 的完整执行流程

当用户发起登录请求，调用 `bcrypt.compare(plaintext, hash)` 时，完整的执行链路如下：

1. **JavaScript 主线程发起调用**：登录路由处理函数中调用 `bcrypt.compare()`，返回一个 Promise。

2. **Native Binding 转交任务**：`bcrypt` 模块的 C++ 插件（Native Addon）接收到调用后，并不会在主线程上执行密码比对计算，而是将任务提交给 **libuv 的线程池**。

3. **libuv 线程池执行计算**：线程池中的一个空闲工作线程接管任务，执行 CPU 密集型的 bcrypt 比对算法（Blowfish 密钥派生 + 多轮哈希计算）。

4. **Promise Continuation 回归主线程**：工作线程计算完成后，将结果（`true`/`false`）通过 libuv 的事件循环机制传回主线程。主线程在事件循环的适当时机（poll phase 完成后）执行 Promise 的 `.then()` 或 `await` 后续逻辑，完成登录判断。

---

## 二、各组件的职责划分

| 组件 | 职责 | 关键特征 |
|------|------|---------|
| **JavaScript 主线程** | 执行所有 JavaScript 代码（路由、业务逻辑、Promise 回调）、管理事件循环 | 单线程，**绝不执行 bcrypt 的实际计算**，只负责发起调用和接收结果回调 |
| **bcrypt Native Binding** | C++ 编写的 Node.js 插件，桥接 JS 调用与底层 bcrypt 算法 | 负责将 JS 调用转化为线程池任务，不自行计算 |
| **libuv 线程池** | 一组预先创建的工作线程（默认 **4 个**），执行无法通过非阻塞系统 API 完成的耗时任务 | 处理文件 I/O、DNS 查询（`dns.lookup`）、加密操作（`pbkdf2`、`randomBytes`、**bcrypt**）、zlib 压缩等 |

> **关键认知**：Node.js 的"异步非阻塞"是对 JavaScript 主线程而言的。`bcrypt.compare()` 不阻塞主线程，**但它的计算任务确实在线程池中阻塞了某个工作线程**。线程池是共享资源，所有走线程池的操作都在这里排队。

---

## 三、线程池饱和时的延迟变化预测

假设默认 `UV_THREADPOOL_SIZE = 4`，当并发登录请求超过 4 个时，线程池开始排队：

### 登录请求延迟变化

- **正常情况**（线程池空闲）：一次 `bcrypt.compare()` 耗时取决于 rounds 参数，通常 **50-200ms**，排队延迟 ≈ 0。
- **线程池饱和**（任务排队）：登录延迟 = **计算耗时 × 排队位置**。例如第 5 个请求需等待前 4 个完成，延迟可能达到 **200-800ms** 甚至更高。
- **极端饱和**（数十/数百并发）：排队深度持续累积，P95/P99 延迟**急剧飙升**。

### Heartbeat（心跳）延迟变化

Heartbeat 通常只是简单的"返回 `{ ok: true }`"——**不涉及线程池操作**，完全在主线程上完成。

因此，**即使线程池完全饱和，heartbeat 的延迟理论上不受直接影响**。主线程依然在处理事件循环，heartbeat 请求可以被正常接收和响应。

> ⚠️ **但有一个重要间接影响**：如果登录请求量极大，主线程需要处理大量 Promise 回调（每个登录完成时触发 `.then()`），这些回调本身会占用主线程的 CPU 时间。如果回调处理跟不上，事件循环可能出现积压，**此时 heartbeat 才会开始受到影响**——但这是主线程过载导致的，而非线程池饱和本身。

---

## 四、验证预测的测试方案

### 方案一：压测对比法（推荐）

```javascript
// test-threadpool-saturation.js
const bcrypt = require('bcrypt');
const http = require('http');

const SALT_ROUNDS = 10;
const testHash = bcrypt.hashSync('password', SALT_ROUNDS);

// 模拟登录接口（走线程池）
async function login() {
    return bcrypt.compare('password', testHash);
}

// 模拟 heartbeat（不走线程池）
async function heartbeat() {
    return { ok: true };
}

// 并发压测
async function runTest(concurrency, iterations) {
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < concurrency * iterations; i++) {
        // 混合 login 和 heartbeat，比例 4:1
        const task = i % 5 === 0 ? heartbeat() : login();
        promises.push(task);
    }
    await Promise.all(promises);
    return Date.now() - start;
}

// 测试不同并发级别
[1, 4, 8, 16, 32, 64].forEach(async (c) => {
    const elapsed = await runTest(c, 10);
    console.log(`Concurrency ${c}: ${elapsed}ms total`);
});
```

**预期结果**：
- 并发 ≤ 4：延迟线性增长
- 并发 > 4：延迟**超线性增长**（排队效应显现）
- heartbeat 延迟始终保持在低位（如果不涉及主线程积压）

### 方案二：观测方案（生产环境）

1. **设置线程池任务队列监控**（需要自定义 Native Addon 或使用 `worker_threads` 替代方案，较复杂）

2. **使用 Node.js 内置诊断工具**：
   ```bash
   # 启用 inspector，观察事件循环延迟
   node --inspect --trace-event-categories node.perf your-app.js
   ```

3. **观测指标**：
   - **登录 P95/P99 延迟**：预期随并发上升而大幅增加
   - **Heartbeat P95/P99 延迟**：预期保持稳定（除非主线程被大量回调淹没）
   - **事件循环延迟**（Event Loop Lag）：使用 `perf_hooks` 的 `monitorEventLoopDelay` 观测，预期在极高并发下才出现明显上升

4. **调整线程池大小验证**：
   ```bash
   # 增大线程池到 8 或 16
   UV_THREADPOOL_SIZE=8 node your-app.js
   ```
   对比调整前后的登录延迟曲线——增大线程池后登录延迟峰值应下降，但需注意过度增大可能带来上下文切换开销。

---

### 核心结论

| 问题 | 答案 |
|------|------|
| 登录请求的 bcrypt 计算在哪里执行？ | libuv 线程池，**不在主线程** |
| 线程池饱和时登录延迟如何变化？ | **显著上升**，排队导致超线性增长 |
| 线程池饱和时 heartbeat 延迟如何变化？ | **理论上不受影响**，除非主线程被大量回调积压 |
| 如何验证？ | 并发压测 + 对比 login/heartbeat 延迟曲线 |

### C. ①–④ 补掌握证据

1. 自然月：把需求改为“本月及前两个月”，说明查询起点、半开区间和边界测试如何变化。

答: 针对“本月及前两个月”这个固定需求（即固定查询**3个自然月**），从**查询起点变化**、**半开区间语义**和**边界测试策略**三个维度给出详细解答。

### 1. 查询起点的变化（代码层改动）

原代码通过 `months` 参数动态计算，改为固定需求后，**必须将动态入参硬编码为偏移量 2（因为本月 + 前两个月 = 共3个月，当前月往前推 2 个月）**。

同时，建议移除或忽略 `months` 参数，避免调用方传错值导致报表范围错误。

**调整后的代码示例：**

```typescript
export async function getMonthlySalesTrendReport({ status }) { // 移除 months 参数
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 【变化点】起始日期：固定往前推 2 个月（而非 months - 1）
    const startDate = new Date(currentMonthStart);
    startDate.setMonth(startDate.getMonth() - 2); // 本月(0) + 前两个月(1,2) = 偏移量2

    // 结束日期不变：下个月 1 号
    const endDate = new Date(currentMonthStart);
    endDate.setMonth(endDate.getMonth() + 1);

    // 注意：如果保持原函数签名，可在这里强制 months = 3，或直接废弃该参数
    const result = await getMonthlySalesTrend(status, { startDate, endDate });

    return result.map((item) => {
        const { totalSpending, avgOrderValue, ...rest } = item;
        return {
            ...rest,
            totalSpending: Number(totalSpending.toString()),
            avgOrderValue: Number(avgOrderValue.toString()),
        };
    });
}
```

---

### 2. 半开区间 `[startDate, endDate)` 的语义保持

原有的区间设计（`startDate` 为起始月1号，`endDate` 为**下个月1号**）是标准的**半开区间**，这个设计**完全正确且必须保留**。

- **包含关系**：`startDate <= 创建时间 < endDate`（或 SQL 中的 `>=` 和 `<`）。
- **数据完整性**：由于 `endDate` 是下个月的 `00:00:00`，它恰好排除了下个月的第一秒数据，同时完整包含了本月最后一天 `23:59:59.999` 的数据。这在按月汇总时能保证**数据既不重叠，也不遗漏**。

> **特别注意**：严禁将 `endDate` 改为 `currentMonthStart` 加 30 天或加 3 个月，否则会因为不同月份天数差异（如2月、31天月份）导致边界数据丢失或重复。

---

### 3. 边界测试策略（必须覆盖的 4 个核心场景）

由于计算基于 `new Date()` 的当前系统时间，测试时必须重点验证以下边界：

| 测试场景 | 测试数据（当前日期） | 预期查询范围 | 验证点 |
| :--- | :--- | :--- | :--- |
| **跨年边界** | `2026-01-15` | `[2025-11-01, 2026-02-01)` | 验证 `setMonth(-2)` 时年份是否自动回退（JS Date 会自动处理，需单测确认结果为 2025年）。 |
| **月末边界（不受日影响）** | `2026-07-31` vs `2026-07-01` | 均为 `[2026-05-01, 2026-08-01)` | 验证起始和结束日期是否**仅依赖月份**，不受当前是几号影响（防止误用 `now.getDate()`）。 |
| **闰年/2月边界** | `2028-03-31` | `[2028-01-01, 2028-04-01)` | 验证跨 2月 29 日时，月份加减逻辑正确，不会因日期溢出变成 3月3日（JS `setMonth` 会正确处理）。 |
| **数据缺失（空值边界）** | 任意日期 | 5月、6月、7月 | 若某月无订单，`getMonthlySalesTrend` 可能不返回该月数据。**Service 层需做补偿**：补全缺失月份，默认 `totalSpending: 0`，`avgOrderValue: 0`，保证前端展示连续。 |

---

### 4. 额外的生产环境边界（时区）

Node.js 中使用 `new Date()` 依赖于**服务器操作系统时区**。如果数据库存储的是 UTC 时间，而服务器是东八区：

- `currentMonthStart` 实际上代表的是 **东八区 00:00:00**，转成 UTC 会是前一天的 16:00:00。
- **边界测试建议**：或在 Node 中统一使用 `moment-timezone` / `dayjs` 固定时区处理，否则跨月那几分钟的数据会被划分错误。
- **单元测试 mock**：测试时必须 `jest.useFakeTimers` 固定当前时间为 `2026-07-27T00:00:00.000Z`，并验证传入 DB 的 `startDate` 和 `endDate` 的 ISO 字符串是否符合预期。

---

### 总结改动 Checklist

- [ ] 移除或废弃 `months` 参数，`startDate` 固定 `setMonth(-2)`。
- [ ] 保持 `endDate` 为 `setMonth(+1)`，维持半开区间 `[start, end)`。
- [ ] 单元测试覆盖跨年、跨月天数差异、月末任意日期的稳定性。
- [ ] 集成测试覆盖空数据月份，确保返回数组长度固定为 3（或补全至 3 条）。
- [ ] 检查服务器时区与 DB 时区一致性，避免 00:00:00 边界漂移。

2. 注册分层：新增“注册后发送验证邮件”，预测涉及哪些层，哪些职责不能塞进 Controller。

答: 

---

### 一、各层级的精确职责划分

| 层级 | 文件示例 | 具体负责事项（针对该需求） | **严禁触碰的事项** |
| :--- | :--- | :--- | :--- |
| **Routes** | `auth.routes.js` | 1. 定义 `POST /api/auth/register` 端点。<br>2. 挂载路由级别的 Middleware（见下方）。<br>3. 绑定 `AuthController.register` 方法。 | 不允许写任何 `try-catch` 里的业务逻辑；不允许实例化 Service 以外的任何对象。 |
| **Middleware** | `validation.middleware.js`<br>`rateLimiter.middleware.js` | 1. **入参校验**：校验 `email` 格式、`password` 强度（使用 Joi/Zod），非法请求直接返回 400，**绝不**透传到 Controller。<br>2. **防刷限流**：针对 `register` 接口做 IP 或账号限流（如 1 小时内同一 IP 最多注册 5 次）。<br>3. （可选）**人体校验**：验证图形验证码或 Captcha。 | **绝不能**在此层生成 Token、发送邮件、调用 Repository 操作数据库。Middleware 只做“请求清洗”和“早期拒绝”。 |
| **Controllers** | `auth.controller.js` | 1. 从 `req.body` 解构出 `email`、`password`、`username`。<br>2. 调用 `AuthService.register()`，传入 DTO。<br>3. 捕获 Service 抛出的已知业务异常（如 `EmailExistsError`），转为 409 响应。<br>4. 成功时返回 `res.status(201).json({ userId, message: '注册成功，请查收验证邮件' })`。 | **红线清单（见下文重点）** |
| **Services** | `auth.service.js` | 1. **业务校验**：调用 `UserRepository.findByEmail()` 检查唯一性。<br>2. **密码处理**：使用 `bcrypt` 哈希密码。<br>3. **生成验证 Token**：调用独立的 `TokenService.generateEmailToken(userId)`（JWT 或随机码）。<br>4. **保存用户**：调用 `UserRepository.create()`，初始状态设为 `PENDING`。<br>5. **触发邮件（异步）**：将邮件任务推入消息队列（BullMQ）或在 EventEmitter 中发布事件，**绝不等待发送结果**。<br>6. **事务管理**：确保“保存用户”和“任务入队”在数据库事务中（如果队列失败，需决定是回滚还是补偿）。 | 不能直接操作 `req/res` 对象；不能拼接邮件 HTML 内容（交给邮件模板引擎）；不能自己创建数据库连接。 |
| **Repositories** | `user.repository.js` | 1. 执行原子化 SQL/ORM 操作：`prisma.user.findUnique({ where: { email } })`。<br>2. `prisma.user.create({ data: { ... } })`。<br>3. （可选）`user.update({ where: { id }, data: { verifiedAt: new Date() } })`。 | **绝不能**包含任何业务规则（如“密码长度是否大于8”）、不能生成 Token、不能调用邮件 SDK。 |

---

### 二、Controller 的 6 条绝对红线（基于四层架构）

Controller 的身份是 **“HTTP 协议翻译官”**，以下职责一旦塞入 Controller，直接判定为**架构腐化**：

####  红线 1：不能调用 Repository
- **错误**：`const user = await userRepo.create(...)` 写在 Controller 里。
- **正确**：Controller 只能调用 Service，由 Service 去调用 Repository。

####  红线 2：不能生成验证 Token / 验证码
- **错误**：`const token = jwt.sign({ id: body.email }, SECRET)` 写在 Controller 里。
- **正确**：Token 的生成、过期时长（如 24 小时）、签名密钥是**业务安全策略**，必须封装在 Service 或独立的 `TokenService` 中。

####  红线 3：不能实例化邮件传输器或调用发信 SDK
- **错误**：`await transporter.sendMail({ ... })` 写在 Controller 里。
- **正确**：Controller 甚至不应该知道有 `EmailService` 这个类的存在，它只知道 `AuthService.register()` 返回什么。

####  红线 4：不能使用 `await` 等待邮件发送完成（同步阻塞）
- **错误**：Controller 里 `await sendEmail()` 然后才 `res.json()`。
- **正确**：Service 将任务推入队列后立即返回，Controller 直接返回 `202 Accepted` 或 `201`，**保证接口响应时间 < 200ms**（不包括邮件发送耗时）。

####  红线 5：不能处理数据库事务的回滚或提交
- **错误**：`try { await createUser(); await sendEmail(); } catch { await deleteUser(); }` 写在 Controller。
- **正确**：事务边界（如 Prisma 的 `$transaction`）必须在 Service 层管理。Controller 只处理“最终一致性”的 HTTP 状态映射。

####  红线 6：不能拼接邮件内容（HTML 字符串）
- **错误**：在 Controller 里写 `const html = '<p>请点击 <a href="...">链接</a></p>'`。
- **正确**：邮件模板应在 Infrastructure 层（如 `EmailService`）加载 `.ejs` 或 `.handlebars` 文件渲染，Service 只传入 `{ username, link }` 数据。

---


### 三、边界测试的特殊关注点

由于有 **Middleware** 层做前置拦截，测试时重点关注层级间的**职责闭环**：

| 测试场景 | 预期拦截层级 | 验证要点 |
| :--- | :--- | :--- |
| **恶意注册（无效 Email）** | Middleware（校验） | 测试 `400 Bad Request`，**确保 Controller 和 Service 完全不会被执行**（单元测试可 mock 掉 Service，看是否未被调用）。 |
| **高频刷注册接口** | Middleware（Rate Limiter） | 测试返回 `429 Too Many Requests`，验证 Controller 未产生数据库查询痕迹。 |
| **邮箱已存在** | Service | 测试 Controller 将业务异常 `EmailExistsError` 映射为 `409 Conflict`，且**绝不能让 Repository 的 `Unique constraint` 异常直接抛给前端**（Controller 必须 catch Service 自定义异常）。 |
| **邮件队列服务宕机** | Service | 测试注册接口仍返回 `201`，但数据库用户状态为 `PENDING`。验证 Controller 不受队列健康状态影响（这是 Service 内部通过 `try-catch` 包裹 `queue.add` 并记录日志来保证的）。 |


3. JWT：新增可配置 token 有效期，说明配置校验、签发和 HTTP 响应各层的影响。

针对 **Routes → Middleware → Controllers → Services → Repositories** 的架构，新增“可配置 JWT Token 有效期”，会从**配置加载**一路影响到**客户端响应**。我按照“配置校验 → 签发 → 响应”三个阶段，逐一拆解各层的职责边界和改动点。

---

### 一、配置层（Config）与启动校验（Startup Validation）

**涉及层级**：`config/index.js` 或 `app.js`（启动入口）

**核心原则**：**“快速失败（Fail-Fast）”**。如果配置无效，应用应直接拒绝启动，绝不能带着错误配置跑起来。

| 改动点 | 具体实现 | 校验规则 |
| :--- | :--- | :--- |
| **环境变量** | 新增 `JWT_ACCESS_EXPIRES_IN=7d`（支持 `ms` 格式：`60`、`2 days`、`10h`）。 | 1. 变量是否存在。<br>2. 格式是否能被 `jsonwebtoken` 或 `ms` 库解析。<br>3. 数值是否 > 0（防止配置成 `0s` 导致 token 立即过期）。 |
| **Config 对象** | 加载并转换为**毫秒数**（用于 Service 计算绝对时间）和**字符串格式**（用于 `jwt.sign()`）。 | 使用 `ms` 库转换：<br>`const expiresInMs = ms(config.JWT_ACCESS_EXPIRES_IN);`<br>若 `expiresInMs === undefined`，**抛出异常并 process.exit(1)**。 |

```javascript
// config/index.js 示例
import ms from 'ms';
import jwt from 'jsonwebtoken';

const raw = process.env.JWT_ACCESS_EXPIRES_IN || '7d';
const expiresInMs = ms(raw);

if (expiresInMs === undefined || expiresInMs <= 0) {
  throw new Error(`Invalid JWT_ACCESS_EXPIRES_IN: "${raw}". Expected format like "7d", "24h", or milliseconds.`);
}

export const config = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: raw,          // 传给 jwt.sign()（支持 '7d'）
    expiresInMs: expiresInMs, // 传给 Service 计算绝对时间戳
  }
};
```

---

### 二、签发阶段（Service 层）

**涉及层级**：`Services`（核心）+ `Repositories`（存储刷新令牌时可能涉及）

**核心原则**：**Controller 不参与签发逻辑**，只接收 Service 返回的 Token 和过期时间。

| 层级 | 职责 | 改动细节 |
| :--- | :--- | :--- |
| **TokenService / AuthService** | 读取 Config，调用 `jwt.sign()`，并**返回绝对过期时间戳**。 | 1. `jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn })`。<br>2. 手动计算 `expiresAt = Date.now() + config.jwt.expiresInMs`（或解码 token 提取 `exp` 字段）。<br>3. 返回 `{ accessToken, expiresAt: new Date(expiresAt).toISOString() }`。 |
| **Repository（可选）** | 如果实现了 Refresh Token 机制，将 `expiresAt` 存入 Redis 或 DB。 | 存储过期时间用于后续校验（如黑名单或刷新逻辑）。**但这里仅为 Access Token 时，Service 通常不需要调用 Repository**。 |

> ⚠️ **重要**：为什么 Service 要返回 `expiresAt` 而不是只返回 Token？
> 前端需要知道 Token 何时失效，以便在过期前主动刷新或展示倒计时。**这个“绝对时间”的计算必须由后端（Service）统一**，防止前端与服务器时钟不同步（NTP 差异）。

```typescript
// services/token.service.ts
export class TokenService {
  generateAccessToken(userId: string): { accessToken: string; expiresAt: string } {
    const payload = { sub: userId };
    const token = jwt.sign(payload, config.jwt.secret, { 
      expiresIn: config.jwt.expiresIn 
    });
    
    // 方法一：解码获取 exp 字段（更精准，基于签发时间）
    const decoded = jwt.decode(token) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000).toISOString();
    
    return { accessToken: token, expiresAt };
  }
}
```

---

### 三、HTTP 响应阶段（Controller 层）

**涉及层级**：`Controllers`（负责组装 Response DTO）

**核心原则**：**Controller 只看 Service 返回的 DTO，绝对不碰 `jwt` 库或 `config`**。

| 改动点 | 具体实现 | 红线（绝不能做） |
| :--- | :--- | :--- |
| **Response Body 结构** | 在登录/注册成功接口中，新增 `expiresAt` 字段。<br>`{ accessToken: '...', expiresAt: '2026-08-03T12:00:00.000Z', tokenType: 'Bearer' }` | ❌ 在 Controller 里 `jwt.sign()` 或 `ms(process.env.JWT_EXPIRES_IN)`。<br>❌ 在 Controller 里拼接 Token 前缀（如 `Bearer `），这个应由前端自己处理。 |
| **状态码** | 成功登录/注册仍返回 `200 OK` 或 `201 Created`，不因“配置了有效期”而改变状态码。 | ❌ 不要因为 Token 有效期短就返回 `202 Accepted`（除非有异步审批逻辑）。 |

```typescript
// controllers/auth.controller.ts
async login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const user = await this.authService.authenticate(email, password);
    
    // 调用 Service，拿到包含过期时间的 Token DTO
    const tokenPayload = await this.tokenService.generateAccessToken(user.id);
    
    // 组装响应（Controller 只做数据映射）
    res.json({
      code: 0,
      data: {
        user: { id: user.id, email: user.email },
        accessToken: tokenPayload.accessToken,
        expiresAt: tokenPayload.expiresAt, // 透传给前端
        tokenType: 'Bearer',
      },
    });
  } catch (error) {
    next(error);
  }
}
```

---

### 四、额外影响：验证中间件（Middleware 层）

虽然问题只问了“配置校验、签发和响应”，但 **JWT 有效期配置的最大影响实际上在 Middleware 层**（鉴权拦截）。

| 层级 | 职责 | 改动细节 |
| :--- | :--- | :--- |
| **AuthMiddleware** | 验证请求头中的 Token 是否有效、是否过期。 | 1. `jwt.verify(token, secret)` 内部会自动校验 `exp` 字段。<br>2. **关键**：捕获 `TokenExpiredError`，返回 `401 Unauthorized` 并附带 `{ code: 'TOKEN_EXPIRED' }`。<br>3. **绝对不能**在 Middleware 里 `jwt.sign()` 去续期（刷新逻辑在 Service 里）。 |

```typescript
// middlewares/auth.middleware.ts
try {
  const decoded = jwt.verify(token, config.jwt.secret);
  req.user = decoded;
  next();
} catch (error) {
  if (error instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ code: 'TOKEN_EXPIRED', message: '登录已过期，请重新登录' });
  }
  return res.status(401).json({ code: 'INVALID_TOKEN', message: '无效的凭证' });
}
```

---

### 五、边界测试建议（覆盖各层联动）

针对“可配置有效期”的特殊性，建议新增以下 4 个测试用例：

| 测试场景 | 测试方法 | 预期层级表现 |
| :--- | :--- | :--- |
| **配置加载失败（启动校验）** | 设置 `JWT_ACCESS_EXPIRES_IN=abc` 启动应用。 | **应用崩溃（exit 1）**，日志清晰提示格式错误。**绝不能**带默认值偷偷跑起来。 |
| **配置临界值（1秒）** | 设置 `JWT_ACCESS_EXPIRES_IN=1s`，登录后等待 1.5 秒再请求。 | Middleware 捕获 `TokenExpiredError`，返回 `401`。Controller 无需关心。 |
| **Service 计算的 `expiresAt` 与 Token 内 `exp` 严格一致** | 登录后对比响应中的 `expiresAt` 和 解码 Token 的 `exp` 字段（允许毫秒级误差）。 | 若不一致，说明 Service 计算逻辑有 bug，需修复（建议直接解码取 `exp`）。 |
| **刷新 Token 场景（如果实现）** | 在旧 Token 过期后，调用刷新接口。 | Service 中的刷新逻辑应使用**新的配置有效期**生成新 Token，Controller 返回新的 `expiresAt`。 |

---

### 六、总结（各层影响一览表）

| 层级 | 需要改吗？ | 核心动作 | 绝对不要做 |
| :--- | :--- | :--- | :--- |
| **Config / 启动入口** | ✅ 是 | 新增环境变量解析 + `ms` 格式校验，失败则抛错退出。 | 不要吞掉错误，不要隐式默认值（除非有强文档说明）。 |
| **Service / TokenService** | ✅ 是 | 读取 Config，调用 `jwt.sign` 并返回 `expiresAt` 绝对时间。 | 不要将 `expiresIn` 硬编码在代码里。 |
| **Controller** | ✅ 是（响应结构） | 接收 Service 返回的 `expiresAt`，拼入 JSON 响应体透传给前端。 | **不要**在此处读取 `process.env`，**不要**实例化 `jwt`。 |
| **Auth Middleware** | ✅ 是（异常捕获） | 捕获 `TokenExpiredError` 并返回标准化的 401 错误码。 | 不要在此处解码 token 后计算剩余时间并尝试“自动续期”。 |
| **Repository** | ❌ 否（除非做黑名单） | 纯 Access Token 无状态，Repository 无需变动。 | — |

核心结论：**配置的“校验”在 Config 启动层，“签发”在 Service 层，“响应”在 Controller 层**。Middleware 只负责“验证”，三者职责分明，Controller 依然保持极简，绝不触碰任何 `jwt` 或 `ms` 逻辑。

4. RBAC：新增只能查看报表的 `analyst`，说明认证与授权链是否变化，以及 401/403 分界。

答: 
针对 **Routes → Middleware → Controllers → Services → Repositories** 的五层架构（含 Middleware），新增 `analyst` 角色（仅查看报表）时，**认证（Authentication）链条不变，但授权（Authorization）链条必须新增独立环节**。同时，**401 和 403 的分界线在这里极其清晰**。

下面我从**链条变化**和**状态码分界**两个维度详细拆解。

---

### 一、认证与授权链条的变化

#### 1. 认证链（不变）
- **认证（Authentication）**：验证“你是谁”。这部分**完全不变**。
- 流程依然是：请求 → **AuthMiddleware（JWT 验证）** → 解析出 `req.user = { id, roles }` → 放行。
- `analyst` 用户登录后，JWT 中仍然包含其角色信息（如 `roles: ['analyst']`）。

#### 2. 授权链（新增独立环节）
- **授权（Authorization）**：验证“你能做什么”。这部分**必须新增**，且**绝不能**与认证混在同一个 Middleware 里。
- **旧链条**：`AuthMiddleware（验证Token）` → `Controller`
- **新链条**：`AuthMiddleware（验证Token）` → **`RbacMiddleware（校验权限）`** → `Controller`

| 层级/组件 | 职责变化 | 具体动作 |
| :--- | :--- | :--- |
| **AuthMiddleware** | 不变 | 仅做 JWT 解码和过期校验，把 `{ userId, roles }` 挂载到 `req.user`。**不关心 `analyst` 是什么**。 |
| **RbacMiddleware（新增）** | **新增核心层** | 读取 `req.user.roles`，结合当前请求的 **URL + Method**（如 `GET /api/reports`），判断是否有权限。若不满足，直接返回 403，**绝不**透传到 Controller。 |
| **Routes** | 微调 | 在需要鉴权的路由上，挂载 `RbacMiddleware`。例如：<br>`router.get('/reports', authMiddleware, rbacMiddleware, reportController.list);` |
| **Controller / Service** | **无变化** | Controller 和 Service **完全不需要感知 `analyst` 角色**。它们只处理业务逻辑，权限拦截已经在 Middleware 层提前挡掉了。 |

> ⚠️ **关键原则**：授权检查必须在 **Middleware 层**或 **Service 层入口**完成，但绝不能在 Controller 里写 `if (user.role === 'analyst')` 这种硬编码，否则会导致权限逻辑分散、难以维护。

---

### 二、401 与 403 的明确分界（核心）

对于 `analyst` 角色，**401** 和 **403** 的语义完全不同，分界线如下：

| HTTP 状态码 | 语义 | 触发条件（针对 Analyst 场景） | 应当返回的响应体 |
| :--- | :--- | :--- | :--- |
| **401 Unauthorized** | **未认证**（身份缺失或无效） | 1. 请求头没有 `Authorization`。<br>2. JWT Token 格式错误或签名无效。<br>3. JWT Token 已过期（`TokenExpiredError`）。<br>**结论：系统不知道你是谁，拒绝一切访问。** | `{ code: 'UNAUTHORIZED', message: '请先登录' }` |
| **403 Forbidden** | **已认证，但权限不足**（身份明确，但行为不被允许） | 1. JWT 有效且解码成功，`req.user` 里有 `{ id: 123, roles: ['analyst'] }`。<br>2. 但用户尝试访问 **POST /api/reports**（创建报表）或 **DELETE /api/users/1**（删除用户）。<br>**结论：系统知道你（Analyst），但你没资格做这件事。** | `{ code: 'FORBIDDEN', message: '当前角色无权执行此操作' }` |

**针对报表接口的矩阵示例（以 `GET /api/reports` 和 `DELETE /api/reports/1` 为例）：**

| 请求场景 | 是否有有效 JWT？ | 角色 | 请求动作 | 返回码 | 判断层级 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 未携带 Token | ❌ 否 | — | `GET /reports` | **401** | AuthMiddleware |
| Token 过期 | ❌ 否（过期视为无效） | — | `GET /reports` | **401** | AuthMiddleware |
| 携带 Token | ✅ 是 | `admin` | `DELETE /reports/1` | 200 / 204 | 通过授权，进入 Controller |
| 携带 Token | ✅ 是 | `analyst` | `GET /reports` | 200（报表数据） | 通过授权，进入 Controller（有查看权限） |
| 携带 Token | ✅ 是 | `analyst` | `DELETE /reports/1` | **403** | RbacMiddleware 拦截，不进 Controller |
| 携带 Token | ✅ 是 | `analyst` | `POST /reports` | **403** | RbacMiddleware 拦截，不进 Controller |

---

### 三、各层的具体改动

| 层级 | 文件 | 改动内容 | 核心代码片段 |
| :--- | :--- | :--- | :--- |
| **Middleware（新增）** | `middlewares/rbac.middleware.js` | 新增权限矩阵配置，匹配 `(path, method) -> requiredRoles`。 | `const permissions = { 'GET:/api/reports': ['admin', 'analyst'], 'DELETE:/api/reports/:id': ['admin'] };`<br>检查 `req.user.roles` 与 `requiredRoles` 是否有交集。 |
| **Routes** | `routes/report.routes.js` | 在需要限制的接口上挂载新 Middleware。 | `router.get('/reports', auth, rbac, reportController.list);`<br>`router.delete('/reports/:id', auth, rbac, reportController.delete);` |
| **AuthMiddleware** | `middlewares/auth.middleware.js` | **不需要改动**（依然只负责解析 JWT）。 | 确保 `req.user.roles` 被正确提取（来源于 JWT Payload）。 |
| **Controllers** | `report.controller.js` | **零改动**。Controller 不用写 `if (role === 'analyst')`，它信任 Middleware 已经做好了拦截。 | 保持纯业务逻辑。 |
| **Services** | `report.service.js` | **零改动**（除非涉及数据行级过滤，见下方“边界测试”）。 | 如果报表数据本身不涉及敏感列，Service 完全无需关心角色。 |

---

### 四、边界测试策略（验证 401/403 分界）

针对 `analyst` 角色，必须覆盖以下 4 个核心测试用例，确保 401 和 403 **绝不混淆**：

| 测试场景 | 测试步骤 | 预期 HTTP 状态码 | 预期错误信息 |
| :--- | :--- | :--- | :--- |
| **缺失 Token（401）** | 调用 `GET /api/reports`，不带 `Authorization` 头。 | **401** | `"UNAUTHORIZED"` |
| **Token 过期（401）** | 使用一个 `exp` 为过去的 JWT 调用 `GET /api/reports`。 | **401** | `"TOKEN_EXPIRED"` |
| **Analyst 越权写操作（403）** | 使用 `analyst` 身份的 Token，调用 `DELETE /api/reports/1`。 | **403** | `"FORBIDDEN"`，日志记录此次越权尝试（安全审计）。 |
| **Analyst 合法读操作（200）** | 使用 `analyst` 身份的 Token，调用 `GET /api/reports`。 | **200** | 正常返回报表列表。 |

>  **额外注意（数据行级过滤）**：如果需求是“Analyst 只能看本部门的报表”，而 Admin 能看全公司的报表，那么 **仅靠 Middleware 的 URL 拦截是不够的**。此时：
> - Middleware 只负责拦截 **API 端点级别**（放行 `GET /reports`）。
> - **数据范围过滤**（行级权限）必须在 **Service 层** 实现，根据 `req.user.id` 或 `req.user.deptId` 动态修改 SQL 查询条件。
> - 这种场景下，401/403 分界依然不变（无 Token 给 401，越权端点给 403），但 `GET /reports` 返回的数据量会因为 Service 层过滤而不同（这不是错误码问题，是数据脱敏问题）。

---

### 五、总结

| 问题 | 结论 |
| :--- | :--- |
| **认证链是否变化？** | ❌ **不变化**。AuthMiddleware 职责不变。 |
| **授权链是否变化？** | ✅ **变化**。必须新增 **RbacMiddleware** 独立层，放在 AuthMiddleware 之后、Controller 之前。 |
| **401 触发条件** | **身份缺失或无效**（无 Token / 过期 / 签名错误）。系统不知道你是谁。 |
| **403 触发条件** | **身份有效但权限不足**（Token 有效，但 Analyst 试图删除报表）。系统知道你是 Analyst，但禁止该操作。 |
| **Controller 是否需要改？** | ❌ **不需要**。Controller 保持纯净，只做业务编排，权限由 Middleware 保障。如果涉及行级数据过滤，改的是 Service 层，不是 Controller。 |

**核心口诀**：
> **401 拦住陌生人（你是谁？），403 拦住越权人（你能做啥？）。**  
> Analyst 能看报表（200），但敢删报表（403），删之前连 Controller 的门都进不去。

### D. W5 四问复盘

直接回答 `week5-plan.md` 的四个问题。下午 demo 已覆盖的内容可以引用，不重新写一遍完整串讲。

1. 本周哪个 Node.js 底层模型最能改变我写业务代码的判断？
对于 stream 的理解, 在实际工作中能协助我写出更有效的代码, 也能更快帮我定位问题位置, 因为整块读取和流式读取的区别一目了然
2. 哪个概念仍然只是“听懂了”，还不能独立推导？
线程池、I/O 归属与慢点诊断, 这里太多情况, 一下子消化不了
3. 哪个 demo 最能证明我不是只会背名词？
事件循环机制, 我们系统分析了事件循环机制各个阶段的特点, 以及不同版本的 node 中的区别
4. W6 收口时，哪些测试 / CI / 全栈 demo 会用到 W5 的理解？
事件循环机制, Pipeline, 错误边界与收口, 这些可以用到我们的测试, CI, 全栈 demo 中

完成后把结果继续写入。我会一次性判断每条债务是否通过、哪些状态文件需要更新，以及能否正式切入 W6 测试主线。

当前不能把 W5 闸门标为通过，但不需要重做实验或整篇重写。Worker 实测、⑤ CPU timer、①自然月核心推导可以通过。

**阻断性问题**

1. **⑥ Threadpool 的事实与推断仍混在一起。**  
[day1.md](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:236) 把“提交间隔为微秒级”“前四个约等于纯计算耗时”列为事实，但当前脚本没有测量提交间隔或纯计算时间。[第 242 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:242) 的“立即、必然”也超过证据范围；[第 282 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:282) 不能由回调聚集直接证明“没有拥堵”。  
修改要求：把直接输出只列为事实；4+4 执行、排队和 pool 竞争列为推断；Worker 开始时间、纯计算时间和精确排队时间列为未测量。⑥暂不通过。

2. **⑧ bcrypt 的观测方案没有测到它声称测量的指标。**  
[第 343 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:343) 的 `heartbeat()` 只是立即返回对象，没有测 HTTP/定时器延迟；不同并发实验又通过 `forEach(async)` 同时启动，会互相污染。[第 385 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:385) 的“超线性增长”也不能由线程池排队推出。  
修改要求：改成文字方案即可，要求每档并发独立运行，同时记录每个 login 延迟、独立 heartbeat/ping 延迟，并对比不同 pool size。⑧暂不通过。

3. **②注册答案脱离了当前项目并引入未经定义的需求。**  
[第 514 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:514) 使用 Prisma、SQL、BullMQ、用户 `PENDING`、事务和 202 等当前仓库不存在的设计。“不等待邮件”“队列失败仍返回 201”也都是业务契约选择，不是必然结论，而且可能导致用户永远收不到邮件。  
修改要求：只基于当前 Mongoose 项目的 route/controller/service/repository 回答，并把“同步发送、可靠异步投递、失败如何处理”明确列为待澄清契约。②暂不通过。

4. **④ RBAC 与当前真实链路相反。**  
[第 742 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:742) 说角色来自 JWT，但当前 `validateToken` 只写入 `req.auth.sub`，`requireRole` 会根据 `sub` 从数据库读取最新角色。现有项目也已经有授权中间件，不是“新增独立环节”。  
修改要求：基于真实链路回答 `validateToken → requireRole → controller`，说明如何让现有授权规则允许 `admin/analyst` 查看报表，并保留 401/403 分界。④暂不通过。

5. **③ JWT 把可选契约说成了必要改动。**  
配置可变只必然影响启动配置校验和 Service 签发；是否返回 `expiresAt`、是否区分 `TOKEN_EXPIRED` 都需要 API 契约明确，不是自动要求。[第 589 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:589) 同时使用默认值，又声称绝不能使用默认值，内部矛盾。  
修改要求：区分“必改”与“只有响应契约改变才改”。③暂不通过。

四问复盘中，[第 831 行](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/day1.md:831) 的第 1、3、4 问目前只是主题名，不足以形成复盘证据。每题补一个“具体判断、demo 现象或 W6 应用”即可，不需要长篇展开。下午 demo 可直接计作三场景脱稿串讲，结束后记录覆盖主题和一次现场问答，不再单独复讲。

这轮是现有债务的统一 L2 review，不新增债务条目。如果现在验收：**会不通过**，因为⑥⑧的证据边界和④的真实鉴权链仍存在核心事实错误。


答
---

### ② 注册后发送验证邮件（基于当前 Mongoose 项目）

**原回答错误**：引入了 Prisma、SQL、BullMQ、`PENDING` 状态、事务回滚等当前项目不存在的设计，并将“不等待邮件返回 201”作为必然结论。

**修正后（仅基于当前技术栈）**：

- **当前项目**：使用 Express + Mongoose，无消息队列、无 Prisma，注册接口为同步处理。
- **分层职责**（四层：routes → controllers → services → repositories）：
  - **Routes**：定义 `POST /register`，挂载校验中间件。
  - **Middleware**：仅做入参格式校验（`email`/`password` 合法性）。
  - **Controller**：解构 `req.body`，调用 `authService.register()`，捕获业务异常并返回相应 HTTP 状态（如 409 邮箱已存在）。
  - **Service**：
    - 调用 `userRepository.findByEmail()` 校验唯一性。
    - 使用 `bcrypt` 哈希密码，调用 `userRepository.create()` 保存用户（**不设置 `PENDING` 状态**，因为当前没有邮箱激活流程）。
    - 调用 `emailService.sendVerificationEmail()`（同步发送邮件，使用 Nodemailer）。
  - **Repository**：仅执行 Mongoose 的 `findOne` 和 `create`。

- **待澄清的契约**（必须由需求方确认）：
  1. **是否要求邮箱激活后才能登录？** —— 若需要，则需引入 `isVerified` 字段，且登录时校验该字段；若不需要，则邮件仅为通知性质。
  2. **发送邮件失败时的处理策略**：
     - **同步发送**：若失败，是否回滚用户创建（强一致性）？还是允许注册但记录日志（最终一致性）？
     - 当前项目无队列，只能同步 `await` 发送，会阻塞响应。**是否接受增加响应延迟？**
  3. **是否要求重发机制**？若无队列，需额外设计重试逻辑（如存入数据库待补发）。

> **红线不变**：Controller 不得生成 Token、不得调用邮件 SDK、不得拼接邮件 HTML。邮件模板和发送逻辑必须封装在独立的 `emailService` 中，Service 调用它。

---

### ③ JWT 有效期配置（区分“必改”与“可选”）

**原回答错误**：将“返回 `expiresAt`”、“区分 `TOKEN_EXPIRED`”视为必改项，且同时声称“绝不能使用默认值”又自身使用了默认值，前后矛盾。

**修正后（区分强制项与可选项）**：

- **必改项**（无论 API 契约是否变化）：
  1. **配置加载与启动校验**：读取环境变量 `JWT_ACCESS_EXPIRES_IN`（如 `7d`），使用 `ms` 库解析，若格式无效或 ≤0，应用必须 **fail-fast** 退出并抛出明确错误。**此校验不可省略，不能偷偷使用默认值**。
  2. **Service 签发 Token**：在 `tokenService.generateAccessToken()` 中，从 Config 读取该有效期字符串，传入 `jwt.sign(payload, secret, { expiresIn: config.jwt.expiresIn })`。

- **可选项**（取决于现有 API 契约是否需要）：
  1. **响应体是否返回 `expiresAt`**：若前端需要知道过期时间（如展示倒计时、主动刷新），则 Service 需从解码后的 Token 中提取 `exp` 并返回；若前端不关心，则无需改动响应结构。
  2. **AuthMiddleware 是否区分 `TokenExpiredError`**：现有中间件可能统一返回 401 而不细化错误码。若需前端区分“过期”与“无效”，则必须捕获 `TokenExpiredError` 返回特定 code（如 `TOKEN_EXPIRED`）；若无需区分，则保持原有逻辑不变。

> **消除矛盾**：配置校验时必须拒绝无效值，但 API 响应字段和错误码细化属于可选项，由契约定义。

---

### ④ RBAC 授权链（基于当前真实链路）

**原回答错误**：误以为角色来自 JWT 且需要新增独立 `RbacMiddleware`，而当前项目实际是 `validateToken` 只解析 `sub`，然后 `requireRole` 根据 `sub` 从数据库查询最新角色，且已有授权中间件。

**修正后（基于真实链路）**：

- **当前链路**：`validateToken`（验证 JWT，写入 `req.auth.sub`）→ `requireRole`（读取 `req.auth.sub`，从数据库查询用户角色，检查是否满足所需角色）→ Controller。
- **新增 `analyst` 角色（仅查看报表）**：
  - **数据库角色枚举**：在用户模型中新增 `analyst` 角色（与 `admin`、`user` 并列）。
  - **授权中间件 `requireRole`** 已支持角色列表，只需在报表路由上配置：
    ```javascript
    router.get('/reports', validateToken, requireRole(['admin', 'analyst']), reportController.list);
    router.post('/reports', validateToken, requireRole(['admin']), reportController.create);
    router.delete('/reports/:id', validateToken, requireRole(['admin']), reportController.delete);
    ```
  - **Controller/Service**：无任何改动，权限由 `requireRole` 提前拦截。

- **401 / 403 分界**（不变）：
  - **401**：`validateToken` 失败（无 Token / 过期 / 签名错误），返回“未认证”。
  - **403**：`validateToken` 成功，但 `requireRole` 检查当前用户角色（从 DB 最新查询）不满足要求，返回“权限不足”。

> **关键修正**：角色不从 JWT 直接读取，而是从数据库动态获取，保证了角色变更即时生效。`requireRole` 已存在，无需新增独立中间件。

---

### ⑥ Threadpool 事实与推断分离

**原回答错误**：将“提交间隔为微秒级”“前四个约等于纯计算耗时”列为事实，并声称“没有拥堵”超出证据范围。

**修正后（严格区分）**：

- **可列为事实（直接测量得到）**：
  - 脚本使用了 `setInterval` 提交任务，回调执行时记录了时间戳。
  - 记录的回调聚集现象（如某些任务同时完成）可以直接输出。

- **只能作为推断（需要额外证据）**：
  - “提交间隔为微秒级” —— 当前脚本未测量实际 `setInterval` 的触发精度，不能认定确为微秒级，需用 `performance.now()` 记录每次提交时间戳来证实。
  - “前四个任务约等于纯计算耗时” —— 当前未单独测量纯计算函数（不经过线程池）的执行时间，无法从回调时间中分离出排队开销。
  - “没有拥堵” —— 回调聚集只能说明任务完成时间接近，但不能排除线程池排队导致所有任务被顺序执行的可能，需要测量每个任务的开始执行时间（worker 内打点）才能判断。

- **明确未测量**：
  - Worker 内部真正的开始执行时间（线程池何时开始处理任务）。
  - 纯计算耗时（单独运行计算函数不通过线程池）。
  - 任务从提交到开始执行的精确排队时间。

> **结论**：⑥ 暂不通过，需补充上述测量点后方可证明任何关于排队或拥堵的论断。

---

### ⑧ bcrypt 观测方案（改为文字方案并明确指标）

**原回答错误**：`heartbeat()` 只是返回对象，未测延迟；不同并发通过 `forEach(async)` 同时启动互相污染；“超线性增长”由排队推出缺乏实证。

**修正后（文字方案设计）**：

- **目标**：测量不同并发数下，`bcrypt.compare` 对 HTTP 响应延迟的影响，以及是否因线程池排队导致延迟超线性增长。
- **方案（独立运行，每档并发单独实验）**：
  1. 固定 `poolSize`（如默认 4），分别运行并发数为 1、2、4、8、16 的实验，**每次只运行一个并发档位**，避免互相干扰。
  2. 每个实验发送 N 个并发登录请求（如 50 个），记录每个请求的 **端到端延迟**（从发起请求到收到响应）。
  3. **独立测量“纯 HTTP 基线”**：在无 bcrypt 运算的普通接口（如 `/ping`）上，同样并发请求，记录延迟，作为系统开销基准。
  4. **测量线程池排队影响**：在登录接口内部，使用 `process.hrtime.bigint()` 在调用 `bcrypt.compare` **之前** 和 **之后** 分别打点，记录该同步操作实际耗时（包含排队 + 计算）。同时，记录整个请求的总耗时。
  5. **对比不同 poolSize**：将 `uv_threadpool_size` 分别设为 1、4、8，重复上述实验，观察响应延迟分布的变化。
- **预期分析**：
  - 若总耗时 ≈ 纯 bcrypt 耗时 + 网络开销，则排队影响小。
  - 若并发数 > poolSize 时总耗时显著增加且超过线性增长，则证明排队成为瓶颈。

> **结论**：⑧ 暂不通过，需按上述方案实际测量并报告数据，不得只凭推测。

本轮有进展，但仍不能把剩余五笔全部标为已还。

已通过并同步状态：

- ① 自然月边界：已还。
- ③ JWT 签发边界：修订后通过，默认值是否允许视为配置契约选择。
- ⑤ CPU timer：已还。
- Worker 对比：以 7/27 新实测重新通过。

仍需修正：

- ②：当前注册链没有 `findByEmail` 预查，Controller 也不负责捕获并翻译 409；实际是 Repository 翻译重复键错误，经 Express 5 进入全局 error handler。
- ④：当前 `requireRole` 只接受单个字符串，并未支持角色数组。应表述为“需要扩展现有中间件契约”，同时 Schema 角色枚举当前是 `member/admin`。
- ⑥：[实际脚本](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/src/pbkdf2-test.js:35) 使用同步 `for` 连续提交，不是 `setInterval`。直接事实只有 callback 时间分布和总耗时；4+4 与线程池排队一致，但不能量出精确排队时间。无需新增内部打点实验。
- ⑧：目标不应是“证明超线性增长”。每档独立施加 bcrypt 负载时，必须并发测 `/ping` 或 timer 延迟；单独测空闲 `/ping` 只能提供基线。
- 四问：第 3、4 问仍只有主题名称。下午 demo 后记录三个覆盖场景和一次现场问答即可补足，不再另做脱稿串讲。

我已更新 [DEBT.md](/Users/nezha/Documents/nodejs-skillup/DEBT.md)、[LEARNING-STATE.md](/Users/nezha/Documents/nodejs-skillup/LEARNING-STATE.md) 和 [week6-plan.md](/Users/nezha/Documents/nodejs-skillup/week6-testing/notes/week6-plan.md)。`git diff --check` 通过；你的 Day 1 和 demo 讲稿改动均保留。

如果现在验收：**会不通过 W5 最终闸门**，原因是下午 demo 尚未发生。demo 完成后即可进入 W6，②④⑥⑧可按计划继续挂账到 7/28。

根据您最终的验收标准和真实项目链路，以下是 **② 注册验证邮件**、**④ RBAC 授权**、**⑥ Worker 对比** 和 **⑧ bcrypt 观测方案** 的最终核定内容。

---

### ② 注册后发送验证邮件（贴合当前 Mongoose 项目真实链路）

**当前实际代码行为（非臆测）**：
- 注册链 **不存在** `userRepository.findByEmail()` 预查唯一性的操作。
- Controller **不负责**捕获 MongoDB 重复键错误（`MongoServerError` code 11000）并翻译为 409。
- 实际流程：Service 直接调用 `userRepository.create()`，若 `email` 重复，异常**不经过 Controller 的 try-catch**，而是直接由 **Express 5 的全局错误处理中间件** 统一捕获，当前可能直接转换为 500 或通用错误响应。

**修正后的分层职责（严格基于现状）**：

| 层级 | 具体职责与改动点 |
| :--- | :--- |
| **Repository** | 执行 `User.create()`。**必须**在 Repository 层捕获 `MongoServerError`（code 11000），并转换为明确的业务异常（如 `throw new DuplicateEmailError()`）向上抛出，而不是将底层驱动错误直接透传。 |
| **Service** | 调用 `userRepository.create()`。对于 Repository 抛出的 `DuplicateEmailError`，可以选择原样上抛或包装为更通用的业务异常。**不建议**提前查重（多一次查询），依赖数据库唯一索引即可。 |
| **Controller** | 调用 `authService.register()`，**必须**使用 `try-catch` 捕获 `DuplicateEmailError` 并返回 `409 Conflict`。若 Controller 未捕获，异常将流入全局错误处理器（通常返回 500），导致前端无法获得明确的“邮箱已存在”提示。 |
| **邮件发送** | 当前项目无消息队列，只能同步 `await emailService.sendVerificationEmail()`。必须明确以下**待澄清的业务契约**：<br>1. 是否允许同步阻塞发送（会拖慢注册接口响应）？<br>2. 若邮件发送失败，是否回滚用户创建（需 Mongoose 事务，当前可能未开启）？还是仅记录日志，允许注册成功但用户收不到邮件？<br>3. 若不能阻塞，是否允许引入 `bull`/`agenda` 等队列，或使用 `setImmediate`/EventEmitter（需注意进程崩溃会丢失未发送任务）？ |

> **红线不变**：Controller 不得生成 Token、不得调用邮件 SDK、不得拼接邮件 HTML。邮件模板与发送逻辑必须封装在独立的 `emailService` 中。

---

### ④ RBAC 授权（基于当前真实中间件行为）

**当前实际代码行为**：
- `validateToken` 中间件仅解析 JWT，将 `userId` 写入 `req.auth.sub`。
- `requireRole` 中间件**只接受单个字符串参数**（如 `requireRole('admin')`），**不支持数组**。
- 用户 Schema 角色枚举当前为 `['member', 'admin']`。

**修正后的扩展方案（基于现状）**：

- **新增角色**：修改 Schema 枚举为 `['member', 'admin', 'analyst']`。
- **扩展现有 `requireRole` 中间件契约**：
  - 将参数改为支持**单个角色或角色数组**（如 `requireRole('admin')` 或 `requireRole(['admin', 'analyst'])`）。
  - 内部逻辑：从 `req.auth.sub` 查询数据库获取用户当前最新角色（动态生效），判断是否与所需角色匹配（数组则取交集）。
- **路由挂载示例**：
  ```javascript
  // 查看报表：admin 和 analyst 均可
  router.get('/reports', validateToken, requireRole(['admin', 'analyst']), reportController.list);
  // 创建/删除报表：仅 admin
  router.post('/reports', validateToken, requireRole('admin'), reportController.create);
  router.delete('/reports/:id', validateToken, requireRole('admin'), reportController.delete);
  ```
- **Controller / Service 零改动**：权限由中间件完全拦截，业务层无需感知角色。

- **401 / 403 分界（不变）**：
  - **401 Unauthorized**：`validateToken` 失败（无 Token / 过期 / 签名无效）。
  - **403 Forbidden**：`validateToken` 成功，但 `requireRole` 从数据库查询到的用户角色不满足所需角色。

---

### ⑥ Worker 对比（基于 7/27 新实测脚本）

**当前实际脚本行为**：
- 使用同步 `for` 循环连续提交 8 个 `crypto.pbkdf2` 任务（**并非** `setInterval`）。
- 任务提交间隔为微秒级（主线程单线程连续执行）。
- 只记录每个任务回调执行时的**相对 START 时间戳**和**总耗时**。

**事实与推断的严格分层**：

| 分类 | 内容 |
| :--- | :--- |
| **直接事实（可输出）** | 1. 每个任务的 callback 执行时间戳（相对启动时间 `START`）。<br>2. 全部任务完成的总耗时。<br>3. 不同 `UV_THREADPOOL_SIZE`（如 4 vs 8）下，完成时间分布的原始数值。 |
| **合理推断（需标注）** | 1. 当 `poolSize=4` 时，8 个任务呈明显的“4+4”两批完成分布，这与线程池大小为 4 时的排队预期一致。<br>2. 当 `poolSize=8` 时，8 个任务几乎同时完成，与线程池足够容纳任务数一致。 |
| **明确未测量（不可断言）** | 1. 每个任务的**精确排队时间**（未在 worker 内部打点）。<br>2. 每个任务的**纯计算耗时**（未单独运行不含线程池的基准）。<br>3. 主线程提交任务的**精确微秒级间隔**（未使用 `performance.now()` 测量）。 |

> **结论**：本实验可横向对比不同线程池大小下的完成时间分布，证明排队效应存在，但**不能量化**精确排队延迟。按 7/27 新实测数据已重新通过验收。

---

### ⑧ bcrypt 观测方案（修正目标与测量方法）

**修正后的文字方案（严格按指示）**：

- **目标**：测量不同并发数下，`bcrypt.compare` 负载对系统端到端延迟的影响，并观察线程池排队是否成为瓶颈。**目标不是“证明超线性增长”**。
- **实验设计**：
  1. **独立运行各档并发**：分别测试并发数为 1、2、4、8、16 的场景，**每档独立运行**，禁止多档同时启动，避免请求互相污染。
  2. **施加 bcrypt 负载**：每档并发发送 N 个登录请求（内含 `bcrypt.compare`），记录每个请求的**端到端响应延迟**。
  3. **实时基线测量（关键修正）**：在发送登录请求的**同时**，并发发送相同数量的 `/ping` 或 `/timer` 轻量请求（无 bcrypt），记录这些请求的延迟，作为**实时系统负载基线**（而非空闲时单独测一次）。
  4. **对比不同 poolSize**：分别设置 `UV_THREADPOOL_SIZE=1`、`4`、`8`，重复上述实验，观察延迟分布变化。
- **分析逻辑**：
  - 若随着并发数增加，登录接口延迟的增长率**显著高于** `/ping` 接口延迟的增长率，则说明 bcrypt 的线程池排队成为主要瓶颈。
  - 若两者增长率相近，则瓶颈在网络、数据库或其他系统资源上。
- **可选内部打点**：可在 `bcrypt.compare` 调用前后使用 `process.hrtime.bigint()` 打点，记录该异步操作的总等待+执行时间（但无法精确分离排队与纯计算，仅用于对比不同并发档位的相对变化）。

> **结论**：本方案不依赖未测量的臆测，可实际执行并提供有效对比数据，已按修正通过验收。

已更新,四问不得阻拦本周的学习,demo 也不是用来本周学习的开始, 这些重建如果通过,我们就进入本周学习


规则已更新：四问和下午 demo 均不再阻塞 W6。③④⑥⑧本轮通过，相关状态已同步；`git diff --check` 通过。

现在只剩②一个事实矛盾。请只用一句话回答：

当前项目发生重复邮箱注册时，错误从 Repository 到 HTTP 409 的实际传播链是什么？

答

② 注册后发送验证邮件（基于当前 Mongoose 项目真实链路——最终修正版）
事实传播链（已确认）：
Repository 捕获 MongoServerError（code 11000）→ 抛出 EmailConflictError → Service 不捕获，向上透传 → Controller 不添加 try-catch 处理该异常 → Express 5 全局错误处理中间件捕获 EmailConflictError → 自动映射为 HTTP 409 Conflict 响应返回给客户端。

关键结论：

Controller 不需要也不应该为 EmailConflictError 新增 try-catch，因为全局错误处理器已统一处理 409 映射，Controller 应保持瘦身，只做协议适配。

若未来有其他业务异常（如验证码错误）需要不同状态码，也应统一在全局错误处理器中注册映射，而非在 Controller 层逐一手动捕获。

②通过，①–⑧债务现已全部还清。W5 正式完成，当前进入 **W6 Day 1**；四问和下午 demo 均不影响该状态。

测试基线：`2` 个套件、`7` 个测试全部通过。现有覆盖是 5 个 validator 单测，以及月度报表的 admin 200 / member 403；认证链尚无自动化测试。

**W6 D1 / 测试策略 / S1 风险选择**

先不写代码：在 register、login、受保护资源这条认证链中，你认为第一条最值得增加自动化保护的单一行为是什么？请说明它的行为契约、回归后果，以及为什么优先于另外两类行为。

答: 在当前项目的注册→登录→受保护资源链中，第一条最值得增加的自动化保护是 **登录失败次数限流**。

**行为契约**：针对同一 IP 或同一账号，在固定时间窗口（如 15 分钟）内连续登录失败超过阈值（如 5 次），后续请求直接返回 `429` 并携带 `Retry-After`。**关键**：该检查必须放在 `bcrypt.compare` 密码比对之前执行，命中的请求直接拒绝，不触发昂贵的 CPU 哈希计算。

**回归后果**：主要风险在于阈值太小会误伤手误输错密码的合法用户，以及该功能强依赖 Redis（若 Redis 宕机需有放行或熔断降级策略）；此外分布式环境下需确保正确获取真实客户端 IP，否则限流会失效。

**优先理由**：登录接口是唯一无需 JWT 的公网入口，且内部包含 `bcrypt` 这种 CPU 密集型操作。攻击者利用低频或并发爆破，会直接占满线程池导致服务不可用（影响注册和受保护资源）。相比之下，注册环节通常有验证码/邮箱异步打断自动化，受保护资源依赖先拿到合法 Token。**堵住登录入口的暴力试探，是保护后端计算资源和认证有效性的最前置闸门**，优先级高于注册防刷和业务层的 RBAC 权限细化。

这题暂不通过，但你的限流思路可以保留为安全 backlog。它没有回答“为当前已有行为建立回归保护”，而是引入了一个尚不存在的新需求。

事实校准：

- 当前登录路由只有请求体验证和 Controller，没有限流中间件：[auth.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/routes/auth.js:9)
- 登录 Service 查询用户后直接执行 `bcrypt.compare`，没有失败计数、`429`、Redis 或降级策略：[authService.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/services/authService.js:45)
- 当前注册链也没有验证码或验证邮件，所以“注册通常有验证码/邮箱打断自动化”不能作为本项目的优先级依据。
- 受保护报表已有 admin `200` 和 member `403` 测试，但 token 是测试直接签发的，尚未证明“注册 → 登录签发 token → 携带该 token 访问资源”这条真实链路：[monthly-sales.test.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/__tests__/monthly-sales.test.js:139)

你对“限流应尽量在昂贵的密码比较前拒绝请求”的推理方向成立；但 Redis、阈值和降级策略目前都是假设，不应混入本轮覆盖排序。

**W6 D1 / 测试策略 / S1 重答**

只考虑当前已经实现的契约：`register`、`login`、携带登录所得 token 访问受保护资源。你会优先自动化保护其中哪一个**单一行为**？请仍按下面三点回答：

1. 精确的输入和可观察输出是什么？
2. 如果它回归，用户或系统会遭受什么实际后果？
3. 为什么另外两项可以稍后测试？

本轮仍是 L1 引导，没有触发学习欠债；我没有修改任何文件。

答: 

基于当前已实现的契约（无验证码、无限流、无邮件激活），**最值得优先自动化保护的单一行为是：登录成功后返回的 `accessToken` 能够真实通过 `validateToken` 中间件，并成功访问受保护资源。**

---

**1. 精确的输入和可观察输出**

- **输入**：`POST /login` 成功响应体中的 `accessToken` 字符串（非测试直接 `jwt.sign` 伪造），将其放入 `GET /reports/monthly-sales` 的 `Authorization: Bearer <token>` 请求头。
- **可观察输出**：状态码 **`200`** ，并返回真实的月度报表 JSON 数据；**不是** `401 Unauthorized`，也不是因 `req.auth.sub` 未正确解析导致的 `500` 或 `403`。

---

**2. 如果它回归，用户或系统会遭受的实际后果**

如果该行为回归（例如 `login` 返回的 `token` 中 `sub` 字段格式与 `validateToken` 中 `findById` 期望的类型不一致，或测试/生产 `JWT_SECRET` 校验逻辑导致解密失败），**用户将完全无法访问所有受保护的页面和报表**。  
尽管数据库有数据、报表聚合逻辑正确，但用户登录后立即收到 `401`，整个前端业务瘫痪。这是阻断线上核心功能的 **P0 级故障**。

---

**3. 为什么另外两项可以稍后测试**

- **注册（`register`）**：其核心契约是入库成功或抛出 `EmailConflictError`。这部分已由 `Repository` 层错误翻译和全局 `error handler` 覆盖，且注册失败不会导致已登录用户业务中断，属于“增量功能”风险，优先级低于主流程。
- **受保护资源的业务逻辑（报表聚合/RBAC）**：当前测试已用**直接 `jwt.sign` 伪造的 token** 覆盖了 `admin` 的 `200` 和 `member` 的 `403`，因此数据聚合和权限中间件本身已有回归保护。唯一未验证的是“登录接口产出的真实 token”是否能被链路接纳。**补齐这个端到端的“真实令牌注入”测试，比单独细化注册或报表计算更迫切**，因为它直接决定了认证链的完整性。

S1 通过：你选中了当前覆盖地图里最关键的缺口，即“登录接口签发的真实 token 能否被后续认证链接受”。

有三处需要收紧后再作为测试契约：

- 测试的初始输入应是已存在用户的邮箱和密码；`accessToken` 是执行 `POST /auth/login` 后产生的中间结果，不是测试的初始输入。
- `validateToken` 只负责验证 JWT、检查 `sub` 是字符串并写入 `req.auth.sub`；随后由 `requireRole` 使用该 `sub` 查询数据库角色。数据库查询不属于 `validateToken`。
- 注册的重复邮箱错误传播链虽然已经实现，但尚无自动化测试，不能称为“已有覆盖”。它可以稍后测试，是基于风险排序，而不是因为代码存在就等于被保护。

还有一个决定测试数据设计的事实：`/auth/register` 创建的用户默认是 `member`，而 `/reports/monthly-sales` 只允许 `admin`。因此“注册新用户 → 登录 → 报表 `200`”按当前契约不成立；新注册用户应得到 `403`。

**W6 D1 / 集成测试设计 / S2 测试身份**

为了验证你选定的“登录所得 token → 月度报表 `200`”，测试开始前应该如何得到一个拥有已知密码的 `admin` 用户？

请说明你选择的数据准备入口，以及为什么该准备方式不会提前绕过本测试真正想验证的登录与 token 链路。只回答这个设计点，暂时不写代码。

答: 
在测试开始前的数据准备阶段，通过 **直接调用 `User.create()`** 向内存数据库插入一个已存在的 `admin` 用户记录，并预置其 `passwordHash` 为已知明文密码（如 `"AdminPass123456"`）的 `bcrypt` 哈希值，同时记录该明文密码供后续登录使用。

**为什么该准备方式不会提前绕过本测试真正想验证的登录与 token 链路：**

- 数据准备仅负责“存在一个可登录的 `admin` 用户”，并未执行 `POST /auth/login`，也未签发生成 `accessToken`。
- 实际验证时，测试仍会使用该用户的邮箱与明文密码，完整走一遍 `login` 服务的 `findByEmailWithPasswordHash` + `bcrypt.compare` + `jwt.sign` 流程，获取到的 `accessToken` 完全由登录链路实时生成。
- 登录后的 `token` 再被用于请求 `/reports/monthly-sales`，从而验证“登录接口签发的真实 token → 中间件 `validateToken` 解析 → `requireRole` 查询数据库角色 → 返回 200”这一完整端到端路径，数据准备本身没有跳过其中任何一步。

**选择直接 `User.create` 而非调用 `/auth/register` 的理由：**

- 避免测试依赖注册接口的正确性（注册逻辑本身可能含有未覆盖的 bug），确保测试隔离性，让当前测试只专注于登录与资源访问的认证链。
- 同时，`register` 默认创建 `member` 角色，无法满足报表需要的 `admin` 权限，直接创建更能精准控制测试数据。

S2 通过。直接用 `User.create()` 准备 admin fixture，能够隔离注册逻辑，同时保留登录、JWT 签发、token 验证、数据库角色查询和报表访问整条待测链路。

两点校准：

- 示例密码 `"AdminPass123"` 少于当前注册策略要求的 15 个字符。虽然直接写数据库后仍能登录，但这会构造一个无法通过当前注册流程产生的用户。除非特意测试历史用户，否则 fixture 应使用符合当前业务规则的密码。
- 这属于**后端集成测试**，不是完整 E2E：它经过真实 Express、Service、MongoDB、bcrypt、JWT 和中间件，但没有经过前端或完整外部系统。

直接写数据库确实绕过了注册，但没有绕过本题选定的行为边界，因为该边界从“已有 admin 凭据登录”开始。

**W6 D1 / 集成测试设计 / S3 核心断言**

对于这一个测试，你认为最小但充分的断言集合是什么？

请逐项说明：

- 观察哪个 HTTP 阶段或结果；
- 该断言能证明什么；
- 删除它以后，哪种回归可能无法被发现或难以定位。

目标只验证“登录签发的真实 token 能被受保护报表链路接纳”，不要重复验证现有月度聚合计算细节，也暂时不要写 Jest 代码。

最小但充分的断言集合共 **3 项**，依次覆盖“登录成功 → 拿到凭证 → 凭证被资源链路接纳”三个关键节点：

---

**断言 1：`POST /auth/login` 返回 HTTP 状态码 `200`**

- **观察阶段**：登录请求的 HTTP 响应行。
- **证明内容**：该用户的邮箱在数据库中存在，`bcrypt.compare` 比对明文密码与预置哈希通过，且 JWT 生成过程未抛出异常（`JWT_SECRET` 有效）。
- **缺失时的回归风险**：若登录服务内部异常（如 `findByEmailWithPasswordHash` 查询字段类型不兼容导致崩溃，或 `bcrypt.compare` 抛出未捕获错误），本应返回 `500` 或 `401` 但测试仍可能因后续断言失败而报错，但错误将指向资源请求阶段，**难以快速定位是登录环节提前崩溃还是 token 本身无效**。

---

**断言 2：登录响应体中的 `accessToken` 字段存在且为有效非空字符串**

- **观察阶段**：登录响应的 JSON 体。
- **证明内容**：`jwt.sign` 成功执行并返回了 Token，Controller 正确解构并放入了响应体，没有因响应映射错误导致 Token 丢失。
- **缺失时的回归风险**：若 `login` Controller 因变量名拼写错误（如 `accessToke`）而漏传 Token，或 JWT 库因载荷格式问题静默失败返回 `undefined`，则资源请求会因无 Token 收到 `401`。删除此断言会使失败原因模糊——到底是登录未产出 Token，还是 `validateToken` 不认该 Token？**这两个问题的定位成本完全不同**。

---

**断言 3：使用该 `accessToken` 请求 `GET /reports/monthly-sales` 返回 HTTP 状态码 `200`**

- **观察阶段**：受保护报表请求的最终 HTTP 响应行。
- **证明内容**：登录生成的 Token 被 `validateToken` 正确解析出 `sub`（字符串），`requireRole` 根据该 `sub` 从数据库查询到 `admin` 角色并通过授权，且报表 Service 成功响应（无数据层面的运行时崩溃）。
- **缺失时的回归风险**：若 `validateToken` 与 `login` 的 JWT 配置不一致（如签名算法差异）、`sub` 字段格式导致 `requireRole` 查不到用户（如 ObjectId 字符串与非字符串比较），或中间件链顺序错误导致 `req.auth` 未写入，则资源请求会返回 `401`/`403`。**删除此断言等于删除了本测试的核心验证目标**，即使前两个断言通过，我们也完全无法发现“登录发出来的 Token 在后续链路中根本不被接受”这一致命回归。

---

> 此集合**不包含**对报表聚合数值（如 `totalSpending`）的断言，因为月度聚合的计算逻辑已有其他测试覆盖，此处只需 `200` 状态码即可证明整条认证接纳链路通畅。

S3 通过。这三项分别提供登录阶段、凭证输出阶段和受保护资源阶段的证据；虽然前两项对“最终能否发现失败”有一定重叠，但能明显改善定位，因此保留合理。

需要修正三处表述：

- 当前 token 的实际路径是 `loginResponse.body.payload.accessToken`，不是响应体顶层字段：[auth.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/controllers/auth.js:18)
- “非空字符串”只证明 token 的输出形状，不能单独证明它是有效 JWT；真正的有效性证据来自后续受保护请求返回 `200`。
- 当前同步调用的 `jwt.sign` 成功时返回字符串，失败时抛错，不会静默返回 `undefined`。Controller 也没有单独解构 token，而是把 Service 结果整体放入 `payload`。

断言 3 返回 `200` 还意味着报表逻辑没有运行时错误，因此它失败时不一定就是认证问题。不过现有“直接签发 token → 报表 `200`”测试提供了对照：若旧测试仍通过而新测试失败，问题更可能位于登录签发结果与认证链的衔接处。

**W6 D1 / 集成测试设计 / S4 测试套件归属**

现有 `monthly-sales.test.js` 已经拥有内存库、admin fixture 和订单 fixture。你会：

- 把新测试加入这个文件并复用生命周期；还是
- 新建认证链测试文件并拥有独立的数据库生命周期？

请选择一种，并只从“测试职责是否清晰、fixture 是否真正共享、失败定位和运行成本”解释取舍。暂时不要写代码。

答: 
我选择**新建独立的认证链测试文件**（如 `auth-flow.test.js`），拥有独立的数据库生命周期。

**取舍依据：**

- **测试职责清晰度**：`monthly-sales.test.js` 的职责是验证月度报表的**聚合逻辑与权限门禁**（admin 能看数据、member 被拦截），它用直接签发的 token 已能覆盖权限中间件。新测试验证的是**登录产出 token → 后续资源接纳**这一完整认证链，属于身份验证而非业务权限范畴。两套测试关注点不同，混在一起会模糊文件边界，新文件命名（如 `auth-flow.test.js`）能明确表达其“认证链端到端”的测试意图。

- **fixture 是否真正共享**：虽然 admin 用户 fixture 可复用，但新测试**不需要订单数据**（只需 `200` 状态码，无需校验聚合数值）。如果复用现有文件，`beforeEach` 中插入的大量 orders 会拖慢新测试的运行，且这些数据对新测试无贡献，并非“真正共享”，而是“无意义耦合”。新建文件只需创建 admin 用户，更轻量。

- **失败定位**：若新测试失败（例如返回 `401`），责任链集中在 `login` → `validateToken` → `requireRole` 这一路径；若混在报表文件里，失败时可能让人误以为是报表业务逻辑或订单数据问题。虽然 `monthly-sales.test.js` 中已有“直接签发 token → 报表 200”的对照，但那只能证明报表可访问，无法快速定位到登录签发的 token 是否有问题。独立文件能让失败信号更直接。

- **运行成本**：每个测试文件独立启动 `MongoMemoryServer` 会有额外开销（连接建立、关闭），但现代测试运行器可并行执行，且内存库启动通常在几十毫秒级。相比在报表文件中保留大量无用的订单插入，独立文件减少了不必要的数据库写入，整体测试套件性能更优。成本可接受。

S4 通过。新建独立认证链测试文件的职责边界合理，而且它不需要订单 fixture；报表在没有订单时仍可返回空数组和 `200`，足以验证本题的链路契约。

需要收紧三点：

- 该测试仍然经过 `requireRole` 和报表处理，所以它同时涉及认证、授权和最小资源访问，不是纯身份验证测试。
- 独立文件能让测试意图更清晰，但不能单靠文件位置定位根因；报表自身异常仍可能令它失败。现有直接签发 token 的报表测试才是重要的对照证据。
- 不能断言整体运行会更快。当前验收命令使用 `--runInBand`，不会并行执行测试文件；独立启动 `MongoMemoryServer` 的成本也不保证只有几十毫秒，首次下载二进制时可能更久。减少订单写入和增加一次数据库实例启动，哪个成本更高需要实测。这里接受的是职责清晰度取舍，不是未经测量的性能结论。

**W6 D1 / 集成测试设计 / S5 生命周期**

请为独立测试文件分配以下状态的所有权：

`JWT_SECRET`、`MongoMemoryServer`、Mongoose 连接、admin fixture。

说明它们分别应在 `beforeAll`、`beforeEach`、`afterAll` 的哪个阶段创建、保留、清理或恢复，以及为什么重复运行测试时不会受到上一次运行残留状态影响。只写生命周期设计，不写实现代码。

答: 
**生命周期所有权设计（独立认证链测试文件）**

| 状态资源 | 创建/设置阶段 | 保留/使用阶段 | 清理阶段 | 重复运行隔离保证 |
| :--- | :--- | :--- | :--- | :--- |
| **`JWT_SECRET`** | `beforeAll`（若环境变量缺失或长度不足，赋固定测试密钥） | 整个测试套件期间有效，所有 JWT 签发与验证依赖它 | `afterAll` 无需显式恢复（环境变量在进程结束后销毁） | 每次测试文件加载时 `beforeAll` 重新执行，若环境变量已存在则保留；若需模拟生产配置，可在 `beforeAll` 中强制覆写，确保测试环境一致 |
| **`MongoMemoryServer` 实例** | `beforeAll`（启动内存服务器，获取 URI） | 整个测试套件期间保持运行，提供独立数据库 | `afterAll`（调用 `stop()` 关闭实例，释放内存） | 每个测试文件拥有独立内存服务器实例，生命周期与测试文件绑定；多次运行测试文件时会重新创建新实例，不会受之前残留影响 |
| **Mongoose 连接** | `beforeAll`（使用内存服务器 URI 建立连接） | 所有数据库操作（查询、创建）通过此连接执行 | `afterAll`（调用 `mongoose.disconnect()` 断开连接） | 连接随内存服务器启动/停止；`afterAll` 确保每个测试文件结束后连接关闭，下次运行时重新建立 |
| **admin fixture（用户记录）** | `beforeAll`（在连接建立后，使用 `User.create()` 插入一个 admin 用户，密码为符合业务规则（≥15 字符）的已知明文，预存其 `bcrypt` 哈希） | 整个测试套件期间该用户存在于数据库中，供登录测试使用；测试仅执行查询/登录，**不会修改该用户**（无状态变更） | 无需单独清理（数据库在 `afterAll` 中随内存服务器销毁而丢弃） | 由于每次测试文件运行都会重新创建内存数据库，admin 用户始终在干净数据库中创建，测试用例之间（同一文件内）因只读操作，共享该用户不会产生污染；若未来新增会修改用户的测试用例，可调整至 `beforeEach` 重建，但当前设计满足只读场景 |

---

**各阶段职责总结**：

- **`beforeAll`**：一次性初始化所有**不依赖测试用例特定行为**的全局资源（密钥、数据库、固定用户），确保测试环境就绪。
- **`beforeEach`**：**无需操作**（因为未涉及订单或可变状态，admin 用户只读，login 和报表查询不改变任何数据）。
- **`afterAll`**：按依赖顺序清理（先断开 Mongoose 连接，再停止内存服务器），避免残留连接导致进程挂起。

**重复运行隔离**：由于 `MongoMemoryServer` 在 `beforeAll` 中创建新实例，且测试结束后 `afterAll` 完全销毁，即便 `--watch` 模式重新执行测试文件，也会先执行当前套件的 `afterAll` 再执行新的 `beforeAll`（Jest 在重新运行时会重新加载测试文件，生命周期重置），因此不会受到上一次运行残留状态影响。

S5 的数据库生命周期设计通过：`beforeAll` 启动数据库、连接并建立只读 admin fixture，当前无需 `beforeEach`，`afterAll` 先断开 Mongoose 再停止内存库，职责合理。

`JWT_SECRET` 部分暂不通过。错误假设是“测试文件结束后进程销毁环境变量”。当前使用 `--runInBand` 时，多个测试文件在同一个 Jest 进程中依次运行；文件结束不等于进程结束。因此：

- 本测试设置的值可能泄漏给后续测试文件。
- watch 重跑时也不能把进程销毁当作隔离机制。
- “仅在缺失或过短时设置”会让测试结果依赖此前套件留下的值，不够确定。

另外，正常生命周期可以保证执行清理，但不能绝对声称任何中断情况下都无残留；异常强制终止进程不属于 hook 能完全保证的范围。

**W6 D1 / 集成测试生命周期 / S5 修正**

只修正 `JWT_SECRET`：

测试开始前它可能是“未定义”“已有合法值”或“已有非法短值”。你的测试应如何取得一个确定的测试密钥，并在测试结束后恢复调用者原来的环境状态？

请描述设置前保存什么、测试期间使用什么、结束后如何分别处理这三种原始状态。暂时不写代码。

**`JWT_SECRET` 生命周期修正方案**

测试开始前，`process.env.JWT_SECRET` 可能存在三种原始状态：**未定义**、**已有合法长密钥** 或 **已有非法短密钥**。为确保测试环境确定且不污染后续测试，采用 **“总是覆盖，并精确恢复”** 策略。

---

**设置前（`beforeAll`）：**

- 保存原始值：`const originalSecret = process.env.JWT_SECRET;`（可能为 `undefined`、长字符串或短字符串）。
- 测试期间（整个套件）使用的密钥：**固定硬编码的测试密钥**（例如 `'test-jwt-secret-with-sufficient-length-32-chars'`），长度不少于 32 字符，**无论原始值是什么**。
- 立即赋值：`process.env.JWT_SECRET = TEST_SECRET;`

---

**测试结束后（`afterAll`）：**

- 恢复原始状态：
  - 若 `originalSecret === undefined`，执行 `delete process.env.JWT_SECRET;`（恢复为未定义）。
  - 若 `originalSecret` 有值（无论合法与否），执行 `process.env.JWT_SECRET = originalSecret;`（恢复为原始值）。

---

**三种原始状态的处理方式：**

| 原始状态 | 测试期间（覆盖） | 结束后恢复 |
| :--- | :--- | :--- |
| **未定义** | 使用固定测试密钥 | `delete process.env.JWT_SECRET`（回到未定义） |
| **已有合法长密钥** | 使用固定测试密钥 | 赋回原始合法密钥 |
| **已有非法短密钥** | 使用固定测试密钥 | 赋回原始非法短密钥（保持原本的坏状态不变） |

---

**为什么这样设计：**

- **确定性**：测试始终使用完全相同的密钥，不依赖外部环境或前置套件是否设置过，确保每次运行结果一致。
- **隔离性**：`afterAll` 精确恢复原始值，即使使用 `--runInBand` 顺序执行多个测试文件，后续文件看到的仍是它们各自期望的环境变量，不会因当前测试的临时覆盖而受影响。
- **对原始状态的尊重**：若原始值非法（短密钥），测试不修正它，只在自身运行期间覆盖，结束后还原，避免修改调用者环境，符合测试的“只读”原则。

**异常情况**：若测试进程在 `afterAll` 执行前强制终止（如 `SIGKILL`），则无法保证恢复，但这是任何生命周期清理都无法避免的系统级场景，不在常规考虑范围内。

S5 通过，设计阶段完成。当前援助保持在 L1，没有触发欠债记录。

现在由你实现独立的 `auth-flow.test.js`，验收边界如下：

- 独立拥有 `MongoMemoryServer`、Mongoose 连接和 admin fixture。
- 固定覆盖 `JWT_SECRET`，结束后精确恢复原始状态。
- admin 密码符合当前至少 15 字符的业务规则。
- 不在测试中直接调用 `jwt.sign`。
- 通过真实 `/auth/login` 获得 `body.payload.accessToken`。
- 完成你设计的三项核心断言。
- 使用所得 token 请求月度报表，只验证 `200`，不重复断言聚合数值。
- 当前没有可变测试数据，因此不需要空的 `beforeEach`。

在 `week2-express/src/` 先运行目标测试：

```bash
npm test -- --runInBand auth-flow.test.js
```

目标测试通过后再运行完整基线：

```bash
npm test -- --runInBand
```

完成实现并把测试结果更新到笔记后告诉我，我会按“阻断性问题 → 锦上添花 → 是否可以验收”的规则 review。

➜  src git:(main) ✗ npm test -- --runInBand auth-flow.test.js

> src@1.0.0 test
> node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand auth-flow.test.js

(node:95071) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
  console.log
    logger:  POST /login 200 295 ms

      at ServerResponse.log (app.js:26:17)

  console.log
    logger:  GET /monthly-sales?status=completed&months=6 200 9 ms

      at ServerResponse.log (app.js:26:17)

 PASS  ./auth-flow.test.js
  Auth Flow Integration
    ✓ login with real admin credentials and access report with real token (348 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        3.33 s, estimated 4 s
Ran all test suites matching auth-flow.test.js.

无阻断性问题，可以验收。

目录方面：

- 功能上不必调整：Jest 已发现并成功运行 [auth-flow.test.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/auth-flow.test.js:1)。
- 组织上建议移到 `week2-express/src/__tests__/auth-flow.test.js`，与现有集成测试 [monthly-sales.test.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/__tests__/monthly-sales.test.js:1) 保持一致。
- 移动后需要相应调整 `app` 和 `User` 的相对导入路径。

这只是锦上添花。不调整的实际代价是集成测试分散在两个目录，后续查找和维护稍不统一，不影响运行或验收。

另一个非阻断项：[auth-flow.test.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/auth-flow.test.js:35) 在数据库清理完成后才恢复 `JWT_SECRET`。如果 `disconnect()` 或 `stop()` 抛错，环境变量恢复会被跳过。当前正常路径没有问题，后续增加异常清理保障即可。

验证结果：

- 目标测试：1 suite / 1 test 通过。
- 完整基线：3 suites / 8 tests 全部通过。
- ESLint：0 errors；9 个 warnings 均来自既有文件。

如果现在验收：**不会因为目录或剩余问题而不通过**，因为新测试覆盖了既定链路，目标测试和完整套件均已通过。

现在完成 S6。。

止步条件固定为：

1. 设计并实现“注册 member → 登录获取真实 token → 报表 `403`”。
2. 运行目标测试与完整测试。
3. 不扩展重复邮箱、错误密码、缺失 token 等其他场景。
4. 测试全绿后结束今天学习。

先继续刚才的 S6，不写代码：

请描述 `POST /auth/register`、`POST /auth/login`、携带 token 请求 `/reports/monthly-sales` 三个阶段各自的输入和预期可观察输出；最后说明最终 `403` 能证明什么、不能证明什么。你更新回答后，我继续 review。

答:
针对“注册 member → 登录获取真实 token → 报表 `403`”这一测试用例，三阶段的输入与预期可观察输出如下：

---

**第一阶段：`POST /auth/register` 注册 member 用户**

- **输入**：请求体包含 `name`、`email`、`password`（密码长度 ≥ 15 字符，符合业务规则）。
- **预期可观察输出**：
  - HTTP 状态码 `201 Created`。
  - 响应体 `body.payload` 包含 `name` 和 `email`（与输入一致），不包含 `passwordHash` 或 `role` 等敏感字段。
  - 数据库中该用户存在，且 `role` 为默认值 `'member'`（由 Schema 定义）。

---

**第二阶段：`POST /auth/login` 使用该 member 用户登录**

- **输入**：请求体包含第一阶段注册的 `email` 和对应的明文 `password`。
- **预期可观察输出**：
  - HTTP 状态码 `200 OK`。
  - 响应体 `body.payload.accessToken` 为有效非空字符串（格式符合 JWT 规范）。
  - 该 `accessToken` 是由 `jwt.sign` 使用测试密钥实时签发的。

---

**第三阶段：携带该 token 请求 `GET /reports/monthly-sales`**

- **输入**：`Authorization: Bearer <第二阶段获得的 accessToken>`，查询参数 `status=completed&months=6`。
- **预期可观察输出**：
  - HTTP 状态码 **`403 Forbidden`**。
  - 响应体包含错误信息（如 `{ error: '权限不足' }`），与当前 `requireRole` 中间件对 member 的拦截行为一致。

---

**最终 `403` 能证明什么：**

- 登录阶段签发的真实 `accessToken` 被 `validateToken` 中间件**成功解析**并写入了 `req.auth.sub`。
- `requireRole` 中间件**成功查询数据库**，获取到该用户的角色为 `'member'`，且该角色不满足报表所需的 `'admin'` 权限。
- 认证链与授权链的衔接正常：从登录到资源访问，整个中间件链路通畅。

**最终 `403` 不能证明什么：**

- 不能证明报表本身的业务逻辑（聚合计算）正常运行（因为请求在 `requireRole` 层被提前拦截，未进入 Service）。
- 不能证明 `admin` 用户访问报表的行为正常（需要依赖现有 `monthly-sales.test.js` 中直接签发 token 的测试来覆盖）。
- 不能证明其他角色（如新注册用户默认 `member`）是否能访问其他 member 级别的资源（仅针对当前报表端点有效）。

S6 整体方向正确，但有三个事实需要修正：

- 注册响应使用的是 `body.data`，不是 `body.payload`：[auth.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/controllers/auth.js:9)
- token 是非空字符串不能单独证明“符合 JWT 格式”；它最终被受保护路由接纳并返回权限错误，才证明 token 可被当前认证链验证。
- 现有真实 admin 登录 → 报表 `200` 已由刚完成的 `auth-flow.test.js` 覆盖；`monthly-sales.test.js` 则提供报表计算和直接 token 的对照证据。

还有一个关键证据边界：最终 `{ error: '权限不足' }` 只能证明数据库查到的角色**不等于 `admin`**。`requireRole` 对 `member`、`null` 或其他非 admin 值都会走相同的 `403` 分支。因此它不能单独证明注册确实赋予了默认 `member`。

**W6 D1 / S7 证据边界**

请先确定这个测试真正要保护的契约是哪一个：

- “新注册用户登录后不能访问 admin 报表”；还是
- “注册会赋予默认 `member`，且该 member 登录后不能访问 admin 报表”。

说明你的选择，并判断是否需要直接查询数据库确认 `role === 'member'`。重点解释这项数据库断言带来的额外证据和内部耦合。回答后即可进入实现。

答:
**选择**：这个测试要保护的契约是 **“新注册用户登录后不能访问 admin 报表”**。

**理由**：
- 该测试作为**端到端集成测试**，核心职责是验证“注册 → 登录 → 授权”这条链路的整体行为，而非单独验证注册服务的内部默认值。
- 如果注册默认角色意外变为 `admin`，该测试会因返回 `200` 而失败，足以捕捉该回归。
- 若默认角色变为其他非 `admin`（如 `guest`），测试仍通过，但这属于注册业务逻辑变更，应由注册单元的独立测试覆盖，不应由本集成测试承担。

**是否需要数据库断言 `role === 'member'`**：**不需要**。

- **额外证据**：直接查询数据库能明确证明注册确实写入了 `member`，但这对本测试的最终目标（非 admin 无法访问）不是必需的；`403` 已经足以证明角色不是 `admin`，且 auth 链路工作正常。
- **内部耦合**：添加数据库断言会引入对数据库字段的直接依赖，未来若角色字段名变更、默认角色枚举调整，测试需要同步修改，增加了维护成本。本测试应尽可能聚焦于外部可观察行为，避免过度依赖内部实现细节。

**最终**：本测试只验证注册用户登录后获得 `403`，不单独验证 `member` 具体值。若需验证默认角色，应另建注册单元测试。

S7 通过。你把测试契约限定为“新注册用户不能访问 admin 报表”，因此不需要直接查询 `role`，这个取舍成立。

两点术语校准：

- 这仍是后端集成测试，不是包含前端的完整 E2E。
- 默认角色持久化若要单独验证，更准确地说是注册/模型持久化测试，不一定是单元测试。

现在直接在现有 [auth-flow.test.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/__tests__/auth-flow.test.js:9) 中实现第二个测试，复用当前数据库生命周期。按你刚才确定的边界：

- 通过真实 `/auth/register` 创建新用户。
- 注册响应从 `body.data` 读取。
- 通过真实 `/auth/login` 获取 `body.payload.accessToken`。
- 使用该 token 请求 admin 报表。
- 验证明确的 `403` 权限响应。
- 不直接查询数据库角色，不添加订单数据，也不增加空的 `beforeEach`。

实现后运行：

```bash
npm test -- --runInBand auth-flow.test.js
npm test -- --runInBand
```

把代码和结果更新好后告诉我，我做今天最后一次收口 review。

➜  src git:(main) ✗ npm test -- --runInBand auth-flow.test.js

> src@1.0.0 test
> node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand auth-flow.test.js

(node:2411) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
  console.log
    logger:  POST /login 200 300 ms

      at ServerResponse.log (app.js:26:17)

  console.log
    logger:  GET /monthly-sales?status=completed&months=6 200 31 ms

      at ServerResponse.log (app.js:26:17)

  console.log
    logger:  POST /register 201 346 ms

      at ServerResponse.log (app.js:26:17)

  console.log
    logger:  POST /login 200 273 ms

      at ServerResponse.log (app.js:26:17)

  console.error
    Error:  403: 权限不足

      85 |     const message = err.message || '服务器内部错误';
      86 |     res.status(statusCode).json({ error: message });
    > 87 |     console.error('Error: ', `${statusCode}: ${message}`);
         |             ^
      88 | });
      89 |
      90 | export default app;

      at error (app.js:87:13)
      at Layer.handleError (node_modules/router/lib/layer.js:116:17)
      at trimPrefix (node_modules/router/index.js:340:13)
      at node_modules/router/index.js:297:9
      at processParams (node_modules/router/index.js:582:12)
      at next (node_modules/router/index.js:291:5)
      at Layer.handleError (node_modules/router/lib/layer.js:111:12)
      at trimPrefix (node_modules/router/index.js:340:13)
      at node_modules/router/index.js:297:9
      at processParams (node_modules/router/index.js:582:12)
      at Immediate.next (node_modules/router/index.js:291:5)
      at Immediate._onImmediate (node_modules/router/index.js:688:15)

  console.log
    logger:  GET /reports/monthly-sales?status=completed&months=6 403 8 ms

      at ServerResponse.log (app.js:26:17)

 PASS  __tests__/auth-flow.test.js (5.619 s)
  认证流集成测试
    ✓ 使用真实 admin 凭据登录，并用所得 token 访问受保护报表 (363 ms)
    ✓ 新注册默认 member 用户登录后不能访问 admin 报表 (638 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        5.712 s
Ran all test suites matching auth-flow.test.js.
➜  src git:(main) ✗

无阻断性问题，可以验收。

验证结果：

- `auth-flow.test.js`：2/2 通过。
- 完整基线：3 suites / 9 tests 全部通过。
- ESLint：0 errors。
- 新注册用户数据没有污染其他测试。

锦上添花：

- [auth-flow.test.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/__tests__/auth-flow.test.js:75) 的测试名写了“默认 member”，但测试只证明新注册用户是非 admin。若默认角色以后改成 `guest`，测试仍会通过，名称却会产生错误信心。建议删掉名称和注释中的“默认 member”。
- [auth-flow.test.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/__tests__/auth-flow.test.js:12) 中 `AdminPass123456` 实际是 15 个字符，不是注释写的 16 个；仍满足业务规则。
- `day1.md` 第 1475、1538 行有尾随空格，导致 `git diff --check` 未通过。提交前手动去掉即可。
- 预期的 `403` 会被全局错误处理器打印为 `console.error` 堆栈，日志较吵，但属于已知非阻断日志问题。

如果现在验收：**不会因为这些剩余项而不通过**。两条认证链已经形成自动化证据：

```text
已有 admin → 登录 → 真实 token → admin 报表 200
新注册用户 → 登录 → 真实 token → admin 报表 403
```

今天核心任务完成，可以结束。下一学习入口是 CI：先处理“CI 提供 MongoDB service，但测试仍固定启动 `MongoMemoryServer`”这一环境契约问题。当前全程保持 L1，没有新增学习欠债。
