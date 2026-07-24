当前：W5 D5（7/24）。D4 Stream 与背压已通过，工作区干净。  
今天唯一主线：错误捕获边界与 graceful shutdown。  
今天不做：Worker、操作系统信号实现细节、Week2–4 应用改造。  
止步条件：能独立完成“错误由谁捕获”表，并画出 graceful shutdown 最小链路。

先完成到期重建，限时 15–20 分钟：

1. 只看你自己的一页纸笔记，不看旧代码、完整日记或 AI 解释。
2. 从空白重建 `pipeline()` 的成功路径和输出端失败路径。
3. 运行并保留真实输出。
4. 完成后发我：
   - 新文件路径；
   - 两条路径的运行结果；
   - 为什么失败目标必须在运行前已经是目录；
   - 错误由哪里收到，以及各 stream 最终是什么状态。

重建过程中我只负责出题和验收，不提供提示。

答: week5-nodejs-internals/src/pipeline-rebuild.js

## 设计理由（基于一页笔记）

### 1. 流式处理（分块处理）→ 选择 `fs.createReadStream` / `fs.createWriteStream`
- **笔记原文**：*“Readable 逐块产生 chunk → Writable 逐块接收和处理 → 数据不要求完整驻留内存 → 可更早交付首个 chunk”*
- **代码体现**：使用文件流而非 `fs.readFileSync` 一次性读取，数据以 `chunk`（默认 64KB）为单位流动。Transform 逐块处理，写入也是逐块进行。这在处理大文件时能有效控制内存占用，且首字节可在读取完成前即开始处理。
- **额外考量**：真实文件 I/O 能自然产生背压（磁盘写入慢时，`write()` 返回 `false`），比纯内存数据更贴近生产环境。

---

### 2. 背压（速度协调）→ 依赖 `pipeline` 内部机制，不手动干预
- **笔记原文**：*“背压 producer 比 consumer 快 → Writable 内部积压 → write(chunk) 返回 false → producer 停止 → 'drain' 恢复”*
- **代码体现**：我们没有手动监听 `drain` 或调用 `pause()`/`resume()`，而是直接使用 `pipeline`。`pipeline` 会自动在 `Readable` 和 `Writable` 之间建立背压传递，当 `Writable` 写入慢时，它会暂停 `Readable` 的读取，避免内存溢出。Transform 作为中间件也参与背压协调，无需额外代码。

---

### 3. 生产链路统一收口 → 使用 `pipeline()` 而非 `pipe()`
- **笔记原文**：*“pipe()：连接数据流并协调常规背压。pipeline()：在此基础上统一成功 / 失败出口和链路清理。”*
- **代码体现**：
  - 成功路径：`pipelineAsync` 返回的 Promise 在全部数据传输完成时 resolve，我们在此之后进行完整性校验，这对应“统一成功出口”。
  - 失败路径：当 `Writable` 打开目录触发 `EISDIR` 错误时，`pipeline` 会立即捕获错误并**自动销毁所有流**。我们通过检查 `destroyed` 属性（均为 `true`）实证了“资源清理”这一关键能力，这是 `pipe()` 无法自动做到的。
- **额外**：即使我们在成功路径中没有显式监听错误，`pipeline` 也会将错误传播到 Promise 的 reject，方便 `try/catch` 统一处理。

---

### 4. Transform 的设计体现“数据流经链路”和“无完整驻留”
- **笔记原文**：*“Transform 逐块接收和处理”*（虽然笔记未明确提及 Transform，但隐含在流式处理中）
- **代码体现**：我们使用 `Transform` 逐字节转换小写为大写，每个 `chunk` 独立处理，不依赖全局状态（如完整的文件内容）。这保持了流的纯函数特性，且内存占用仅与 `chunk` 大小相关，不随文件增长而增加。

---

### 5. 验证设计 → 证明“成功”与“清理”
- **笔记原文**：*“pipeline() 解决整条链路的完成、错误和资源收口”*
- **代码体现**：
  - **成功验证**：通过比较输入/输出字节数和内容（`Buffer.equals`），证明数据完整无损地流经了整个链路，链路正常完成。
  - **清理验证**：在失败路径中打印 `destroyed` 状态，用实证数据证明“资源收口”确实发生，这是笔记中“解决资源收口”的直观证明。

---

### 6. 失败场景选择“目录写入”而非“回调抛错”
- **笔记原文**：并未限制失败类型，但强调“输出端失败路径”。
- **设计考量**：选择系统级错误 `EISDIR` 比手动 `callback(new Error)` 更真实，能验证 `pipeline` 处理 I/O 错误的稳健性。同时，它触发了 `Writable` 在 `open` 阶段就失败，这属于“输出端”的早期错误，能展示 `pipeline` 在任意阶段出错时都能及时清理上游流（`Readable` 和 `Transform` 也被销毁）。

---

### 7. 异步风格与日志
- **笔记**：未提及，但作为工程实践，使用 `async/await` + `promisify` 使异步流程清晰可读；添加生命周期日志有助于观察流事件顺序，验证背压和清理的时机。

➜  src git:(main) ✗ node pipeline-rebuild.js
[setup] 输入文件已创建: /Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/src/input-rebuild.txt

========== 成功路径 ==========
[success] Transform ended
[success] Readable closed
[success] Writable closed
[success] pipeline 完成
[success] 输入大小: 124 B, 输出大小: 124 B
[success] 大小一致: true
[success] 内容转大写匹配: true

========== 失败路径（输出端为目录） ==========
[failure] Writable closed
[failure] Readable closed
[failure] ✅ 捕获错误: EISDIR - EISDIR: illegal operation on a directory, open '/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/src'
[failure] Readable destroyed: true
[failure] Transform destroyed: true
[failure] Writable destroyed: true

[cleanup] 临时文件已删除

独立复跑结果与笔记一致：

- 成功路径：124 B → 124 B，内容验证通过。
- 失败路径：Promise 出口收到 `EISDIR`。
- 捕获错误时三个 stream 的 `destroyed` 均为 `true`。
- 进程正常退出，临时文件已清理。

行为验收通过，接下来验收是否能独立推导。

**重建验收 R1｜失败注入**

假设把失败目标改为一个运行前不存在的路径：

```text
path.join(__dirname, 'new-output-target')
```

请预测实际行为，并解释为什么这个目标不能可靠地验证“输出端失败”。只回答这个设计点。

答:
将失败目标改为 `path.join(__dirname, 'new-output-target')` 后，**实际行为是 `pipeline` 会成功执行，而不会报错**。

因为这是一个**不存在的路径**，`fs.createWriteStream` 的默认行为是**自动创建该文件**（写入模式 `'w'`），而非报错。数据会正常写入这个新文件，`pipeline` 完成，失败路径不会被触发。

---

**为什么这个目标不能可靠地验证“输出端失败”？**

因为**“路径不存在”本身不是“输出端写入失败”的充分条件**，它反而会触发操作系统的“创建”兜底逻辑，导致测试结果从“预期失败”变成“意外成功”。

要可靠地让输出端失败，必须依赖**操作系统在打开或写入时必然拒绝的硬性条件**，例如：

- **路径指向一个已存在的目录**（`EISDIR`）
- **路径指向一个只读目录或无权写入的文件**（`EACCESS` / `EPERM`）
- **磁盘空间已满**（`ENOSPC`，虽难模拟但逻辑可靠）

而“不存在的路径”是可被 `fs` 模块自动修复的，它的行为取决于运行环境（是否有父目录权限、磁盘空间等），不满足故障注入的**确定性**要求，因此不能作为验证“输出端失败”的可靠设计点。

R1 通过。你正确推导出了：

```text
父目录存在且可写
→ createWriteStream 默认以 flags: 'w' 打开
→ 底层打开操作可创建普通文件
→ pipeline 正常完成
→ 没有验证到输出端失败
```

两处精度修正，不影响通过：

- 不是 `fs` “自动修复路径”，而是默认打开标志允许底层文件打开操作创建文件。
- 权限错误码拼写是 `EACCES`；而且权限注入容易受运行用户和平台影响，当前实验中“已存在目录”更确定。

**重建验收 R2｜错误交付边界**

你的笔记写“`pipeline` 捕获错误”。请更精确地说明：从 Writable 打开目录失败开始，错误经过什么路径，最终为什么会进入 `runFailure()` 的 `catch`？

只回答错误交付链，不讨论资源销毁。

答: 错误交付链如下（精确到事件与回调层级）：

1. **底层系统调用失败**  
   `fs.createWriteStream(目录路径)` 未立即打开文件，但在 `pipeline` 开始消费数据（或内部触发写入初始化）时，底层会执行 `fs.open(目录路径, 'w')`。操作系统返回 `EISDIR` 错误。

2. **Writable 内部转换为事件**  
   `fs.open` 的回调收到系统错误后，`WriteStream` 内部将该错误转换为 `'error'` 事件发射到自身实例上。

3. **pipeline 内部预置监听器捕获**  
   `pipeline` 在初始化阶段，已向所有传入的流（`Readable`、`Transform`、`Writable`）注册了**一次性 `'error'` 监听器**。因此，`Writable` 发出的 `'error'` 事件会被 `pipeline` 的内部错误处理器精准捕获。

4. **回调链路触发**  
   `pipeline` 的内部错误处理器收到错误后，立即调用 `pipeline` 的**完成回调函数**（即 `pipeline(streams, callback)` 中的 `callback`），并将 `EISDIR` 错误作为第一个实参传入。

5. **promisify 将回调转化为 Promise 拒绝**  
   由于我们使用的是 `promisify(pipeline)`，该工具函数会将 `callback(err, result)` 的调用模式转换为 Promise 的 `reject(err)`。因此，当内部回调被调用时，返回的 Promise 进入拒绝状态。

6. **async/await 抛出异常并进入 catch**  
   `runFailure` 中的 `await pipelineAsync(...)` 相当于等待 Promise 决议。当 Promise 被拒绝时，该拒绝被转换为同步异常抛出，并被外层 `try` 捕获，最终进入 `catch(err)` 块——此时的 `err` 对象即携带 `EISDIR` 的系统错误。

核心结论：错误传递路径为 **操作系统错误 → Writable 实例 `'error'` 事件 → pipeline 内部监听器 → pipeline 回调 → promisify 生成的 Promise 拒绝 → async/await 的 catch 捕获**。

R2 通过，错误交付主链正确。三处精度修正：

- `createWriteStream()` 创建后就可能异步发起打开文件，不应绑定为“开始消费数据后才打开”。
- 不需要依赖“内部注册一次性监听器”这类实现细节；稳定契约是 `pipeline()` 观察链路失败，并通过完成回调交付错误。
- Promise rejection 不会变成“同步异常”；它会使 async 函数在 `await` 恢复执行时以抛出方式继续，因此进入 `catch`。

下面是本轮全部剩余问题，不再追加。无需修改代码，集中回答后我一次性 review。

**R3｜成功证据边界**

当前的 124 B 大小比较和内容比较分别证明了什么？它们能否证明背压确实发生、内存始终有界？为什么？

**R4｜资源收口证据**

失败出口中三个 `destroyed === true` 精确证明了什么？它是否单独足以证明所有底层文件描述符都已关闭、没有残留副作用？

**R5｜整段程序的内存边界**

处理链路使用 Stream，但准备输入和成功校验使用了 `writeFileSync`、`readFileSync`。若文件变成数 GB，这会怎样影响“该脚本内存受控”的结论？这是否否定了 pipeline 本身的流式处理？

**R6｜需求变化预测**

假设需求改成“输入可能包含任意 UTF-8 文本，并把所有语言中可大写的字符转成大写”。当前逐字节 ASCII Transform 和 `toUpperCase()` 验证器会出现什么契约分歧？需要先重新决定什么，才能修改实现和验证？

完成后回复“已回答”，我会统一给出：

```text
阻断性问题
→ 精度修正
→ 第一档重建是否通过
→ DEBT 状态与下一学习入口
```
已回答:
**R3｜成功证据边界**

- **124 B 大小比较**证明：数据在流经整个链路后，**字节总数未发生净变化**（无丢失或多余字节）。但该证据**无法排除**数据内容被错误修改但长度保持相同的情况，例如两个字节互换。
- **内容比较（Buffer.equals 检查转换后大写）**证明：数据**按预期转换规则被正确应用**，且顺序完全一致，确保内容语义正确。
- **这两个证据均不能证明背压实际发生**，因为背压触发取决于消费者写入速度是否慢于生产者读取速度；本测试数据仅有 124 B，可能从未触发内部缓冲区积压，`pipeline` 可能始终处于“畅通”状态。它们也不能证明内存始终有界，因为“有界”是流式处理的特性，但该测试未监控实际内存占用或水位；即使未触发背压，流式处理仍按块处理，内存占用相对固定，但这两个证据并未对此进行验证。它们仅证明**数据正确性和传输完整性**，不涉及背压与内存界限。

---

**R4｜资源收口证据**

- `destroyed === true` 精确证明：错误发生后，`pipeline` **调用了每个流的 `destroy()` 方法**，即显式发起了资源销毁请求，并将流内部状态标记为已销毁。
- **它单独不足以证明所有底层文件描述符已确实关闭、无残留副作用**，因为：
  - `destroy()` 是异步操作，调用后可能尚未完成关闭；`destroyed` 标志在调用时立即设置为 `true`，而不等待底层 `close` 完成。
  - 在某些异常情况下，`destroy()` 可能失败或未能释放所有系统资源（如句柄泄漏），但这种情况极少且通常会被 Node.js 处理。
  - 要完整证明资源释放，需额外监听 `'close'` 事件或检查 `fd` 是否为 `null` 等，但当前代码仅依赖 `destroyed` 属性，属于“销毁请求已发出”的佐证，而非“销毁完成”的确证。

---

**R5｜整段程序的内存边界**

- 准备输入（`writeFileSync`）和成功校验（`readFileSync`）会将整个文件内容一次性加载到内存（各自占用一份完整 Buffer）。若文件增至数 GB，这些操作将**使脚本内存飙升至文件大小量级**，可能导致内存溢出（OOM）或严重性能下降，从而破坏“脚本内存受控”的整体结论。
- 这**并不否定 `pipeline` 本身的流式处理**——`pipeline` 部分确实逐块处理，内存占用随 `chunk` 大小而定，与文件总大小无关。但整个程序作为一个整体，**前后处理环节破坏了流式特性**，因此脚本并非完全内存受控。`pipeline` 的流式优势在大文件场景下依然成立，但若前后处理采用全量加载，则整体瓶颈转移至这些同步 I/O 操作上。

---

**R6｜需求变化预测**

- 当前 Transform 逐字节检测 `0x61-0x7a` 范围，仅转换 **ASCII 小写拉丁字母**；验证器使用 `toUpperCase()`，该方法是 **Unicode 感知**的，会将多字节 UTF-8 中的可大写字符（如 `é`→`É`，`ß`→`SS`）进行转换。
- **契约分歧**：对于包含非 ASCII 小写字符的输入，Transform 不转换它们，而验证器预期它们被转换，导致**内容比较失败**（`expected` 包含大写，实际输出仍为小写）。
- 要修正此分歧，需**先重新决定转换规则**：
  1. 是否必须支持完整 Unicode 大小写转换（包括多字符映射，如 `ß`→`SS`）？
  2. 是否考虑区域设置（locale），例如土耳其语 `i`→`İ` 的特殊规则？
  3. 是否允许 Transform 内部使用 `String.prototype.toUpperCase`（可能涉及字符串解码/编码）而非逐字节操作？
- 只有明确上述语义后，才能相应调整 Transform 实现和验证逻辑，确保两者基于同一转换规则。

---

## `pipeline()` 第一档重建统一 Review

### 阻断性问题

无阻断性问题，第一档重建通过。

依据：本人从空白完成成功 / 输出端失败链路；本人运行与 AI 独立复跑结果一致；R1–R6 能独立解释失败目标、错误交付、数据正确性证据、资源收口证据、整段程序的内存边界和需求变化影响。

### 精度修正

1. `destroyed === true` 证明 stream 已进入销毁状态，不单独证明底层资源已经完成关闭；当前 Readable / Writable 的 `close` 日志提供了更进一步的当前运行证据，但仍不应推广为任意资源均无副作用。
2. `pipeline()` 的流式内存优势是“内存不随文件总大小线性增长”，不是“只占一个 chunk”。链路各阶段可以各自缓冲数据，Transform 还会分配输出 Buffer；结论成立依赖背压被遵守且没有额外全量累积。
3. 任意 UTF-8 大小写转换除了先定义 Unicode / locale 契约，还必须处理多字节字符跨 chunk 边界；不能直接对每个任意 chunk 独立 `toString().toUpperCase()`，需要有状态的流式解码。

### 掌握证据与债务结论

- 证据一：不看旧实现，复述并重建数据流、统一错误出口和失败目标取舍。
- 证据二：预测“任意 UTF-8 大小写转换”会同时改变 Transform 契约与验证契约，并识别 Unicode / locale 决策。
- 证据三：为输出端失败选择运行前已存在目录，解释不存在路径为何不能构成确定失败条件。
- `DEBT.md` 中 2026-07-23 的 `pipeline()` 失败注入债务更新为 **已还**。

### 后续重建协作调整

重建限时包含完整作答。后续由 AI 在开始时一次性给出全部验收题，学习者集中回答，AI 再统一 review；不再多轮追加问题。

`pipeline()` 重建已正式通过，相关债务已更新为“已还”。剩余精度修正已写入 [Day 5 笔记](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day5-.md)，不会影响通过结论。

当前项目使用 Express 5.2.1，且已经有全局 error handler 和一版 graceful shutdown，今天可以直接用真实代码学习，不需要另造大型 demo。

**错误边界 / E1：请求范围内的业务错误**

注册请求中，Repository 因重复邮箱抛出 `EmailConflictError`。请根据当前代码讲清这条链：

```text
Repository 抛错
→ Service
→ async Controller
→ Express 5
→ error handler
→ HTTP 409
```

回答时明确区分：

```text
代码调用顺序
职责归属
HTTP 响应值从哪里产生
```

最后判断：这类错误是否应该导致 Node.js 进程退出？为什么？

只回答这个场景，暂时不讨论未捕获异常。

答: 
### 错误链路分解（基于 Express 5.2.1 与当前架构）

---

#### 1. 代码调用顺序（从上至下）

```
HTTP 请求 → 路由匹配 → Controller（async） → Service → Repository
                                                              ↓ 抛错 EmailConflictError
                                                              ↓ 向上冒泡
Controller 未捕获 → 错误冒泡至 Express 5 异步错误捕获层
                                                              ↓
Express 5 将错误传递给注册的全局 error handler 中间件
                                                              ↓
error handler 识别错误类型 → 构造 HTTP 409 响应
```

---

#### 2. 职责归属

| 层级               | 职责                                                                 |
|--------------------|----------------------------------------------------------------------|
| **Repository**     | 数据唯一性约束检查，若重复则抛出领域层业务错误 `EmailConflictError`。 |
| **Service**        | 封装业务规则，通常直接透传 Repository 错误，或可将其包装为业务异常。 |
| **Controller**     | 接收请求参数，调用 Service，**不 try-catch**，依赖框架处理错误。      |
| **Express 5**      | 利用原生 `async` 支持，自动捕获 `async` 路由中未处理的异常，并将其转发至错误处理中间件链。 |
| **error handler**  | 根据错误类型（如 `instanceof EmailConflictError`）决定 HTTP 状态码（409）和响应体结构，序列化并发送回客户端。 |

---

#### 3. HTTP 响应值产生位置

- **状态码 `409` 和响应体内容**均 **在全局 error handler 中间件中构造**。
- error handler 会判断错误类型，并调用 `res.status(409).json({ error: 'Email already exists' })` 或类似方式生成最终响应。

---

#### 4. 这类错误是否应导致 Node.js 进程退出？

**否。**  
`EmailConflictError` 属于 **可预测的业务异常**，其发生表示客户端请求不符合业务约束，是正常的错误流，并非程序自身的 bug 或未捕获的系统级故障。  
- Node.js 进程应继续运行，正常处理后续请求。  
- 仅当出现 **未捕获的异常**（如 `ReferenceError`、`SyntaxError` 或底层系统致命错误）且未妥善处理时，才考虑进程退出；Express 的错误处理机制恰好将业务异常与进程崩溃解耦。  
- 该场景下，进程状态依然稳定，无需重启。

E1 的主链理解正确，但暂时不能通过，有一个会影响后续学习的边界误判。

精度问题：

- 唯一性由数据库索引判定；Repository 捕获 `11000`，再翻译成 `EmailConflictError`，不是 Repository 自己执行唯一性检查。见 [users.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/repositories/users.js:28)。
- 当前 error handler 使用 `switch (err.constructor)`，不是 `instanceof`；响应内容来自 `err.message`，不是固定的英文文案。见 [app.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/app.js:51)。

阻断点是：**是否退出不能单凭 `ReferenceError`、`SyntaxError` 等错误类型判断，而要看错误是否被当前边界接管，以及进程状态是否仍可信。** `ReferenceError` 也可能被 Express error handler 接管；`SyntaxError` 也可能只是请求 JSON 解析失败。

**错误边界 / E1 修正题**

比较以下两个 Express 5 场景：

```js
app.get('/a', async (req, res) => {
    missingVariable;
});

app.get('/b', (req, res) => {
    setTimeout(() => {
        missingVariable;
    }, 0);
    res.end();
});
```

分别说明错误会到达：

```text
Express error handler
或
进程级 uncaughtException
```

并解释决定差异的是哪条异步边界，而不是错误类型。只回答这个设计点。

答: ### 错误边界 / E1 修正题

**场景 A：`app.get('/a', async (req, res) => { missingVariable; });`**

- **错误到达**：**Express error handler**
- **机制**：由于处理函数被标记为 `async`，函数体内部的同步抛出会被 `async/await` 运行时自动捕获，并转换为返回的 Promise 拒绝（Rejection）。Express 5 原生支持在路由处理中监听返回的 Promise，一旦 Promise 被拒绝，框架会**自动调用 `next(err)`**，将错误传入错误处理中间件链。

---

**场景 B：`app.get('/b', (req, res) => { setTimeout(() => { missingVariable; }, 0); res.end(); });`**

- **错误到达**：**进程级 `uncaughtException`**
- **机制**：处理函数是普通回调（非 `async`），执行 `setTimeout` 后立即调用 `res.end()` 返回，**原始请求同步执行流已结束**。`setTimeout` 的回调在下一个事件循环（Tick）中被执行，此时**已完全脱离 Express 的请求-响应上下文和中间件栈**。Express 无法捕获该栈外抛出的异常，因此错误逃逸至 Node.js 全局，触发 `process.on('uncaughtException')` 或导致进程崩溃。

---

**决定差异的核心异步边界（而非错误类型）**

两者抛出的同样是 `ReferenceError`，差异根源在于**错误抛出的执行上下文是否仍在 Express 框架管理的同步调用栈 + Promise 链内**：

- **场景 A**：`async` 关键字在**函数入口**处构建了异步边界，将同步抛出转换为 `Promise.reject`，使错误保留在 Express 通过 `next()` 管理的可控链路上。
- **场景 B**：`setTimeout` 在**时间轴上**构建了异步边界，将错误抛出推迟至**帧栈（Tick）分离**的时刻，原始调用的上下文（`req`/`res` 已结束）不复存在，错误无法通过 `next` 传递。

E1 通过。你已经抓住决定因素：**错误是否仍位于 Express 能观察到的调用链或返回 Promise 链中**，而不是错误的 class。

两处措辞修正：

- `setTimeout(..., 0)` 是在后续 timers 阶段满足条件后执行，不要称为“下一个 tick”；`nextTick` 在 Node.js 中有专门含义。
- `req`/`res` 对象不一定消失，闭包仍可引用它们；真正断开的是**错误传播链**。当前 `server.js` 没有注册 `uncaughtException` listener，因此场景 B 默认会终止进程。

**错误边界 / E2：悬空 Promise**

预测下面两条路由的错误去向：

```js
app.get('/returned', (req, res) => {
    return Promise.reject(new Error('boom'));
});

app.get('/floating', async (req, res) => {
    Promise.reject(new Error('boom'));
    res.end();
});
```

分别判断它们会进入：

```text
Express error handler
或
进程级 unhandledRejection
```

核心解释：为什么两者都创建了 rejected Promise，但 Express 5 只能观察到其中一个？只回答这个设计点。

答: ### 错误边界 / E2 悬空 Promise

---

#### 错误去向预测

| 路由 | 错误到达 |
|------|---------|
| `app.get('/returned', (req, res) => { return Promise.reject(new Error('boom')); });` | **Express error handler** |
| `app.get('/floating', async (req, res) => { Promise.reject(new Error('boom')); res.end(); });` | **进程级 `unhandledRejection`** |

---

#### 核心解释

两者确实都创建了 rejected Promise，但 Express 5 只能观察到 **`/returned`** 路由中的 Promise，原因在于：

- **Express 5 对路由处理函数的返回值进行类型检查**：如果处理函数返回一个 **Promise 对象**，框架会主动 `await` 该 Promise 并将任何拒绝通过 `next(err)` 转发到错误处理中间件。`/returned` 路由显式 `return` 了这个 Promise，所以它被纳入 Express 的异步流控制。

- **`/floating` 路由中，`Promise.reject()` 没有被 `return` 或 `await`**：虽然路由函数是 `async`（自身隐式返回一个 Promise），但该隐式 Promise 的决议取决于函数体内是否抛出异常或返回某个值。本例中函数执行完毕，没有抛出异常，也没有返回一个 rejected Promise，因此 Express 看到的只是 **一个成功完成的 Promise**（`res.end()` 已调用），完全不知道内部有一个独立的、未被关联的 rejected Promise。

- **独立 Promise 的拒绝**发生在 Express 的异步边界之外，没有与请求-响应链挂钩，因此不会被 Express 捕获，而是触发 `unhandledRejection` 事件（若未注册监听器则进程可能随后崩溃）。

---

#### 决定因素

**决定差异的不是 Promise 是否被拒绝，而是该 Promise 是否作为路由处理函数的返回值被 Express 接管**。只有**与 Express 返回的 Promise 链直接连接**的拒绝才能被框架捕获；内部悬空的 Promise 完全脱离该链路。

E2 通过。核心判断准确：`async` 只保证 handler 自己返回 Promise，不会自动收养函数体里未 `return`、未 `await` 的 Promise。

一处精度修正：不必把 Express 5 描述成“类型检查后主动 `await`”；稳定契约是 Express 会观察 handler 返回的 Promise/thenable，并把 rejection 交给 `next(err)`。当前 Node 24 默认配置下，悬空 rejection 若没有进程级处理，通常会进一步导致进程异常退出，不只是停留在日志事件。

**错误边界 / E3：Stream error**

比较两个 Express 5 handler。假设 `missing.txt` 不存在：

```js
app.get('/pipeline', async (req, res) => {
    await pipeline(
        fs.createReadStream('missing.txt'),
        fs.createWriteStream('output.txt')
    );
    res.end('done');
});

app.get('/pipe', (req, res) => {
    fs.createReadStream('missing.txt')
        .pipe(fs.createWriteStream('output.txt'));
    res.end('started');
});
```

这里的 `pipeline` 来自 `node:stream/promises`。

分别预测错误会进入 Express error handler，还是逃到进程级边界。解释为什么 `pipe()` 能协调背压，却不等于统一接管整条链路的错误。只回答这个设计点。

答: ### 错误边界 / E3：Stream error

---

#### 错误去向预测

| 路由 | 错误到达 |
|------|---------|
| `app.get('/pipeline', async (req, res) => { await pipeline(...); ... });` | **Express error handler** |
| `app.get('/pipe', (req, res) => { fs.createReadStream('missing.txt').pipe(...); res.end('started'); });` | **进程级 uncaughtException**（若无监听则进程退出） |

---

#### 为什么 `pipe()` 能协调背压，却不等于统一接管整条链路的错误？

- **`pipe()` 的职责范围**：它只在两个流之间建立**数据管道和背压传递**（自动暂停/恢复读取），但**不接管错误处理**。每个流的错误需单独通过 `.on('error')` 监听，或者使用 `pipeline` 来统一管理。

- **错误传播差异**：
  - `pipeline`（来自 `node:stream/promises`）返回一个 **Promise**，该 Promise 会在任意流发生错误时被拒绝，并自动销毁所有流。在 Express 5 中，`async` handler 返回的 Promise 被框架观察，因此 rejection 会被框架捕获并转发到 `next(err)`，最终进入 error handler。
  - `pipe()` 调用后，它不返回 Promise，且文件流打开文件的操作是**异步发生**的（不在当前事件循环）。当文件不存在时，错误在未来的事件循环中触发 `'error'` 事件，但该事件**没有与 Express 的请求-响应链或 Promise 链绑定**，因此 Express 无法捕获，错误直接逃逸至进程级。

- **关键设计点**：`pipe()` 的设计目标是**数据传输和背压控制**，并非完整的**链路生命周期管理**。错误处理是额外职责，需要显式实现。`pipeline` 则封装了错误转发、资源清理和完成回调，成为“统一接管整条链路”的完整方案。

E3 通过。判断链准确：

```text
pipeline rejection
→ await 失败
→ async handler 返回的 Promise rejection
→ Express 5 error handler
```

裸 `pipe()` 中，缺失输入文件使 ReadStream 发出未监听的 `'error'`；EventEmitter 的未监听 `'error'` 会被 Node 抛出，继而到达进程级 `uncaughtException`。另外，`pipe()` 会返回目标 Writable，只是不会返回代表整条链路完成状态的 Promise；输出文件也可能已被创建并残留。

**错误边界 / E4：进程级监听器是不是恢复机制**

假设加入：

```js
process.on('uncaughtException', (err) => {
    console.error(err);
});

process.on('unhandledRejection', (reason) => {
    console.error(reason);
});
```

请判断：

1. 这是否意味着记录日志后，服务可以安全地继续接收请求？
2. 为什么“错误被进程级监听器观察到”不等于“错误已经恢复”？
3. 这两个监听器在生产服务中更适合作为什么边界？

本题只讨论进程级最后边界，不设计 graceful shutdown 顺序。

答:
### 错误边界 / E4：进程级监听器是不是恢复机制

---

#### 1. 记录日志后，服务是否可以安全地继续接收请求？

**不能。**

- Node.js 在 `uncaughtException` 或 `unhandledRejection` 触发后，进程状态被明确标记为 **"unstable"** 或 **"dirty"**。此时：
  - 可能仍有未完成的 I/O 操作、断开的网络连接或处于不一致状态的资源（数据库连接池、文件句柄）。
  - 事件循环中可能残留副作用（如部分执行的中间件、未清理的闭包变量），导致后续请求行为不可预测。
  - 官方文档明确指出，在 `uncaughtException` 后恢复操作是**不安全的**，`unhandledRejection` 同样如此（尽管轻微，但通常仍被视为不可信状态）。

继续接收请求可能导致：
- 请求处理返回错乱数据。
- 内存泄漏或资源耗尽。
- 原有错误的影响蔓延至其他请求。

---

#### 2. 为什么“错误被进程级监听器观察到”不等于“错误已经恢复”？

因为**观察**与**恢复**在语义上完全独立：

- **观察到**：监听器捕获到错误对象，说明我们**知道了该错误的存在**。
- **恢复**：意味着错误的影响已被彻底消除——相关异步事务的上下文被清理、资源被正确释放、系统状态被回滚到一致点。

`uncaughtException` / `unhandledRejection` 发生时，**错误已经脱离了所有可控的上下文边界**（请求链、Promise 链、流句柄等）：
- 没有调用栈延续可用于“撤销”已执行的副作用。
- 无法安全地判断哪些资源已被分配/释放，哪些仍然悬空。
- 进程本身可能处于半初始化或半处理状态，例如部分写入的文件、锁未释放等。

监听器记录日志只是**做了诊断归档**，并未触及上述任何恢复逻辑；进程状态依然“被污染”，不可恢复。

---

#### 3. 这两个监听器在生产服务中更适合作为什么边界？

它们最适合作为**进程生命周期的最后一层防护边界**，具体定位为：

- **诊断证据收集点**：在进程终止前，捕获完整的错误堆栈、上下文信息、环境快照，用于事后故障排查和监控告警（而非维持服务可用性）。
- **进程健康信号触发点**：记录错误后，让进程继续运行**仅用于优雅出口准备**（如向外部负载均衡器注销节点、完成已有请求的收尾），而不是接收新请求。逻辑上应依赖外部进程管理器（如 Kubernetes、PM2）根据进程退出码或健康检查来重新拉起实例。

本质上，它们是一个 **"告知系统该实例已崩溃"** 的哨兵，而不是一个 **"修复业务错误"** 的工具。

E4 的核心结论通过：进程级监听器是最后观测与终止边界，不是业务恢复机制。

但要把两个事件和 `SIGTERM` 分开：

- Node 不会真的给进程设置一个 `unstable`/`dirty` 标记；“状态不再可信”是工程判断。
- `uncaughtException` 表示异常已经逃出正常边界。此时不应假设还能可靠地完成复杂异步排空，通常只做必要的同步记录与清理，然后退出。
- `unhandledRejection` 只严格证明某个 rejection 在规定时机没有处理者；它不逐例证明业务状态已经损坏。生产中通常仍将其视为程序缺陷并终止实例，这是保守策略。
- `SIGTERM` 是计划内关停，进程状态仍可信，才适合执行完整的“停止接流量 → 排空请求 → 关闭依赖”。
- 外部进程管理器负责重新拉起，不应把 PM2/Kubernetes 当作进程内监听器本身的职责。

**进程生命周期 / G1：读懂当前关停链**

根据 [server.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:26)，讲清当前收到 `SIGTERM` 后的真实执行顺序：

```text
process signal listener
→ gracefulShutdown()
→ server.close(...)
→ ?
→ disconnectDB()
→ process.exit(...)
```

回答时区分：

```text
代码调用顺序
process / HTTP server / Mongoose 各自职责
server.close 回调和 disconnectDB Promise 分别证明什么完成了
```

本题只还原当前代码，不评价缺陷，也不提出修改。

答: ### 进程生命周期 / G1：当前关停链（收到 `SIGTERM` 后）

---

#### 代码调用顺序（实际执行路径）

```
收到 SIGTERM 信号
→ process.on('SIGTERM', listener) 触发
→ listener 调用 gracefulShutdown('终止信号(SIGTERM)')
→ gracefulShutdown 执行：
   ├─ 打印 "收到 终止信号(SIGTERM). 优雅关闭中..."
   ├─ 调用 server.close(async callback)
   │   ├─ server.close 同步返回（立即继续）
   │   └─ 内部开始停止接受新连接，等待现有连接关闭
   └─ gracefulShutdown 函数返回（返回 Promise 但被丢弃）
→ 当前事件循环迭代结束
→ 随后，HTTP 服务器完成所有连接关闭后，执行传入 server.close 的 async 回调
   ├─ 执行 await disconnectDB()
   │   ├─ 等待 Mongoose 断开连接完成
   │   └─ 完成后打印 "终止信号(SIGTERM) 服务关闭"
   └─ 调用 process.exit(0)
→ 若断开数据库过程中抛错，进入 catch，打印错误并 process.exit(1)
```

---

#### 各组件职责

| 组件                  | 职责                                                                 |
|-----------------------|----------------------------------------------------------------------|
| **process 信号监听器** | 捕获操作系统发送的 `SIGTERM`，启动关停流程。                          |
| **gracefulShutdown**  | 协调关停步骤（打印日志、调用 `server.close`、数据库断开）。           |
| **HTTP Server**       | 通过 `server.close()` 停止接收新连接，并等待现有请求处理完毕。        |
| **Mongoose**          | 通过 `disconnectDB()` 关闭数据库连接池，释放资源。                    |
| **process.exit**      | 显式终止进程，返回退出码（0 表示成功，1 表示失败）。                  |

---

#### 回调与 Promise 证明的内容

- **`server.close` 回调被执行**：证明 **HTTP 服务器已经完成了关闭过程**——不再接受新连接，且所有进行中的请求/连接已正常结束（或已超时/被关闭）。
- **`await disconnectDB()` 完成（成功 resolve）**：证明 **MongoDB 连接已断开**，数据库连接池被清空，底层网络连接已释放，没有残留数据库会话。

---

#### 关键流转点

- `server.close` 的回调是异步触发的，并且内部使用了 `await`，因此数据库断开操作会在服务器关闭后才开始执行。
- `gracefulShutdown` 是 `async` 但未被 `await`，它返回的 Promise 没有被监听器或任何地方处理；这意味着监听器不会等待整个关停流程完成，但关停流程本身仍会在后台继续执行（因为回调已注册在事件循环中）。

G1 通过。当前调用顺序和三方职责基本准确。

精度修正：

- `server.close()` 没有内置业务超时，所以回调触发不代表“请求已超时”；若连接一直不结束，回调可能一直不执行。
- 回调表示 HTTP server 达到关闭完成条件，不等于每个请求都“成功完成”。
- `disconnectDB()` resolve 是 Mongoose 关闭 API 的完成信号，不能扩大为独立证明操作系统和数据库端绝无残留状态。
- 当前外层 `gracefulShutdown()` 虽标为 `async`，但没有等待 `server.close` 回调，因此它的 Promise 会在注册回调后立即 resolve；回调中的 async 工作并没有连接到外层 Promise。

**进程生命周期 / G2：当前实现的失败边界**

集中预测下面四种情况，无需修改代码：

1. `connectDB()` 尚未完成、`server` 仍为 `null` 时收到 `SIGTERM`。
2. 第一次 shutdown 尚未完成时，又收到一次 `SIGINT` 或 `SIGTERM`。
3. 某个 HTTP 请求或连接一直不结束。
4. `disconnectDB()` reject。

对每种情况写出：

```text
当前代码实际会怎样
→ 是否可能无法正常退出
→ 属于阻断性问题还是锦上添花
```

最后给出你认为这版 shutdown 最少必须补齐的保护能力。一次回答后我统一 review。

回答: ### 进程生命周期 / G2：当前实现的失败边界

---

#### 情况 1：`connectDB()` 尚未完成、`server` 仍为 `null` 时收到 `SIGTERM`

- **当前代码实际会怎样**：  
  `gracefulShutdown` 被调用后，立即执行 `server.close(async () => { ... })`。由于 `server` 为 `null`，访问 `null.close` 会抛出 `TypeError`（同步异常）。没有 `try-catch` 包裹，该异常触发 `uncaughtException`，Node.js 默认打印错误并退出进程（非零码）。

- **是否可能无法正常退出**：  
  会退出（因为 `uncaughtException` 导致进程崩溃），但**异常退出**，未执行任何关停清理（数据库连接可能仍在建立中，不会关闭）。

- **属于阻断性问题还是锦上添花**：  
  **阻断性问题**——启动阶段收到信号是生产常见场景，当前代码会导致非预期崩溃且无完整日志。

---

#### 情况 2：第一次 shutdown 尚未完成时，又收到一次 `SIGINT` 或 `SIGTERM`

- **当前代码实际会怎样**：  
  `gracefulShutdown` 没有防重入。第二次信号触发会再次调用 `server.close`。  
  - 若服务器仍处于关闭中（`server._handle` 存在），`close` 会注册第二个回调，在关闭完成后两个回调依次执行（按注册顺序）。  
  - 第二个回调会再次尝试 `disconnectDB()`，可能导致并发断开或重复调用，Mongoose 可能抛出错误（如连接已关闭），被 `catch` 捕获后执行 `process.exit(1)`。

- **是否可能无法正常退出**：  
  进程最终会退出（两个回调均执行后退出，或第二个回调 catch 后 exit），但退出码可能为 1（非预期）。不会导致卡死。

- **属于阻断性问题还是锦上添花**：  
  **锦上添花**——虽可能污染日志和退出码，但不影响进程最终终止。

---

#### 情况 3：某个 HTTP 请求或连接一直不结束

- **当前代码实际会怎样**：  
  `server.close()` 停止接受新连接，但**不会主动断开现有连接**，会等待所有连接自然结束。若存在长轮询、WebSocket 或挂起的请求永不完成，则 `close` 回调**永远不执行**。后续 `disconnectDB()` 和 `process.exit(0)` 均不会执行，进程永远挂起。

- **是否可能无法正常退出**：  
  **是**，进程无法退出，只能外部强制 `SIGKILL`。

- **属于阻断性问题还是锦上添花**：  
  **阻断性问题**——生产中不可避免会有长连接，当前实现无法保证优雅关闭超时。

---

#### 情况 4：`disconnectDB()` reject

- **当前代码实际会怎样**：  
  `await disconnectDB()` 抛出异常，进入 `catch` 分支，打印错误后执行 `process.exit(1)`，进程立即退出（非零码）。数据库连接可能未完全关闭，但进程终止后操作系统会回收资源。

- **是否可能无法正常退出**：  
  进程会退出（因为有 `process.exit`），不会卡死。

- **属于阻断性问题还是锦上添花**：  
  **锦上添花**——关闭失败不影响进程终止，但退出码表示异常，可被外部感知。

---

#### 最少必须补齐的保护能力

综合以上，为确保关停流程**永不卡死且始终能退出**，本版本至少需要：

1. **`server` 非空检查**：在 `gracefulShutdown` 内对 `server` 判空，若为 `null` 则直接执行 `disconnectDB()` 并退出（或记录后退出），避免崩溃。
2. **关闭超时强制退出**：为 `server.close` 设置最大等待时间（如 30 秒），超时后直接 `process.exit(1)`，确保即使连接不结束也能退出。

防重入和 `disconnectDB` 失败处理属于优化项，暂不作为“最少必须”。

G2 有两项判断正确、两项需要修正，因此当前还不能收口。

**阻断性问题**

- 场景 1：`gracefulShutdown()` 是 `async`。访问 `null.close` 虽发生在同步语句中，但会使该 async 函数返回 rejected Promise；信号监听器没有处理它，所以首先形成 `unhandledRejection`，再按当前 Node 默认策略导致异常退出。
- 场景 2：不能依赖 `server._handle`、回调执行次数或假设 Mongoose 重复断开一定报错，这些都不是当前证据。确定事实是流程没有防重入，可能并发启动多次关闭、重复日志和竞争退出。因此幂等保护属于最小可靠关停的一部分，不只是锦上添花。
- 场景 3：判断正确。没有强制截止时间，活动请求不结束时，关闭链可能永远到不了数据库断开。
- 场景 4：判断正确，而且当前已经处理，不构成剩余问题：记录失败并以非零码退出。

**进程生命周期 / G3：设计最小关停链**

请用流程图式文字重新设计，不写代码。设计必须明确处理：

```text
启动期 server 尚不存在
重复收到信号
活动请求超过关停期限
HTTP 关闭成功
数据库关闭失败
```

对每个出口标出退出码，并说明超时机制解决的是“保证退出”还是“保证所有请求成功完成”。

另外，`SIGTERM` 的计划内完整排空与 `uncaughtException` 的快速失败必须分成两条链，不能共用同一套异步恢复假设。

答: 

#### 两条独立链路的入口与假设

| 触发源 | 进程状态假设 | 策略目标 |
|--------|------------|----------|
| `SIGTERM` / `SIGINT`（计划内） | 状态**可信**，业务逻辑正常流转中 | **优雅排空**：尝试完成已有请求，释放资源，尽量以 `0` 退出 |
| `uncaughtException` / `unhandledRejection`（崩溃） | 状态**不可信**，脱离可控上下文 | **快速失败**：只做同步诊断，立即终止，不假设能安全执行异步操作 |

两条链路**不得共用同一个异步关停函数**，因为崩溃场景下执行 `server.close` 或 `disconnectDB` 可能触发二次错误或死锁。

---

#### 链路 A：计划内关停（`SIGTERM` / `SIGINT`）

```
收到 SIGTERM
    ↓
检查防重入标志 isClosing
    ├─ 若为 true → 忽略本次信号（保留原关停流程继续）
    └─ 若为 false → 设置 isClosing = true，进入关停流程
    ↓
检查 server 是否存在
    ├─ 若为 null（启动未完成） → 跳过 HTTP 关闭，直接进入数据库断开阶段
    └─ 若存在 → 启动关停超时定时器（如 30s），然后调用 server.close(callback)
    ↓
┌─────────────────────────────────────────────────────────┐
│ 并行等待两个互斥条件（谁先到谁生效）：                   │
│ ① server.close 回调触发（HTTP 连接已排空）             │
│ ② 关停超时定时器到期                                   │
└─────────────────────────────────────────────────────────┘
    ├─ 若 ② 先到期 → 记录“关停超时，强制退出” → process.exit(1)
    │   （超时解决的是“保证退出”，而非“保证请求成功完成”）
    │
    └─ 若 ① 先触发（HTTP 关闭成功）→ 清除超时定时器，进入数据库断开
    ↓
┌─────────────────────────────────────────────────────────┐
│ 执行 disconnectDB()                                    │
│    ├─ 成功（resolve） → 记录日志 → process.exit(0)     │
│    └─ 失败（reject）  → 记录错误 → process.exit(1)     │
└─────────────────────────────────────────────────────────┘
```

**退出码说明**：
- `0`：HTTP 连接排空完成 **且** 数据库连接正常释放。
- `1`：关停超时（活动连接卡死） **或** 数据库断开失败。

**超时机制的本质**：  
它解决的是 **“保证退出”**（防止进程永久挂起），而不是“保证请求成功完成”。超时到达时，未完成的请求会被强制中断，进程退出，这是 **最坏情况下的逃生舱**，而非正常排空路径。

---

#### 链路 B：快速失败（`uncaughtException` / `unhandledRejection`）

```
触发崩溃事件
    ↓
（此时状态不可信，不能安全执行异步操作）
    ↓
同步记录错误堆栈 / 关键上下文（尽量使用同步写，避免异步 I/O）
    ↓
设置硬超时（如 1s），若进程未退出则强制 `process.exit(1)`
    ↓
立即调用 `process.exit(1)`（注意：若事件循环中仍有排队的异步请求，exit 会直接截断，但这是必要代价）
```

**核心原则**：  
- **不调用** `server.close()`（可能阻塞或二次触发错误）  
- **不调用** `disconnectDB()`（Mongoose 可能已处于半损坏状态）  
- **不等待** 任何 Promise  
- 退出码固定为 `1`，由外部进程管理器（PM2/K8s）负责重启。

---

#### 五类边界情况处理对照表

| 边界情况 | 链路 A（计划内）处理方式 | 链路 B（崩溃）处理方式 |
|---------|------------------------|----------------------|
| **启动期 server 尚不存在** | `server` 判空，跳过 HTTP 关闭，直接执行 `disconnectDB` 并退出（有 DB 连接则关闭，无则直接退出）。 | 进程已崩溃，不存在“启动期关停”概念；直接同步 exit。 |
| **重复收到信号** | `isClosing` 防重入标志保证后续信号被忽略，避免并发关闭竞争。 | 崩溃时已不受信号控制，退出由进程管理器接管。 |
| **活动请求超过关停期限** | 30s 超时定时器触发 `exit(1)`，强制终止，**保证退出**。 | 不适用（无排空阶段）。 |
| **HTTP 关闭成功** | 清除超时定时器，正常进入数据库断开阶段，目标 `exit(0)`。 | 不适用。 |
| **数据库关闭失败** | 捕获 `disconnectDB` 的 reject，记录错误后 `exit(1)`，退出码告知外部该实例未完全清理。 | 不适用（不调用 DB 关闭）。 |

---

#### 总结

- **超时机制是“保底退出”**，不是“保成功完成”。
- **计划内关停与崩溃快速失败必须严格分离**：崩溃场景下，进程状态已不可信，执行异步排空可能引入二次错误；计划内关停才能依赖 `server.close` 和 `disconnectDB` 这些异步恢复假设。
- 最小关停链的核心保护能力包括：**防重入、server 空检查、强制超时退出**。这三项缺一不可，否则无法保证在任何情况下进程都能按时终止。

G3 主体结构正确，但有一个阻断性遗漏，因此暂未通过。

**阻断点：超时只覆盖了 HTTP 排空**

你的流程在 `server.close` 成功后就清除定时器，再执行 `disconnectDB()`。如果 HTTP 用 2 秒关闭，而 `disconnectDB()` 永远不 settle，进程仍会永久挂起。这与“保证关停最终结束”的目标冲突。

另外两处精度问题：

- 崩溃链中“设置 1 秒定时器后立即 `process.exit(1)`”是互斥策略：立即退出时定时器永远没有机会执行。要么同步记录后立即退出；要么允许极少量 best-effort 收尾，并由硬期限兜底。
- 应用内定时器也不是绝对保证：若 event loop 被永久同步阻塞，它不会执行。真正的最终强杀期限来自外部 supervisor/orchestrator。
- 将 `unhandledRejection` 视为 fatal 是这里选择的生产策略，不是每次 rejection 都已证明状态损坏的运行时事实。

**G3 修正题**

只重写两个部分：

1. 把关停期限改成覆盖从收到信号到 HTTP 与数据库全部关闭的**端到端期限**，说明在哪个唯一成功出口才能清除它。
2. 为 fatal 链在“同步记录后立即退出”和“短暂 best-effort 收尾 + 硬期限”中选择一种一致策略，并说明理由。

不需要重写其余流程。

答:

重写两部分

---

#### 修正 1：端到端关停期限（覆盖 HTTP 排空 + 数据库断开）

```
收到 SIGTERM
    ↓
设置防重入标志 isClosing = true
    ↓
启动端到端强制退出定时器（如 30s）
    → 超时回调：记录 "端到端关停超时，强制退出" → process.exit(1)
    → 该定时器是进程最终终止的保底手段
    ↓
检查 server 是否存在
    ├─ 若为 null → 跳过 server.close，直接进入数据库断开阶段
    └─ 若存在 → 调用 server.close(callback)，等待 HTTP 连接排空
    ↓
server.close 回调触发（HTTP 排空完成）
    ├─ 注意：不在此处清除端到端定时器
    └─ 进入数据库断开阶段
    ↓
执行 disconnectDB()
    ├─ 成功（resolve）→ **唯一成功出口**：清除端到端定时器 → process.exit(0)
    └─ 失败（reject）→ 清除端到端定时器 → process.exit(1)
```

**唯一清除端到端定时器的出口**：
- **只有**在 `disconnectDB()` 完成（无论是成功 `resolve` 还是失败 `reject`）并准备调用 `process.exit` 时，才清除该定时器。
- `server.close` 成功本身**不清除**定时器，因为随后还有数据库断开步骤可能卡住。定时器贯穿整个关停流程，从收到信号到最终 `process.exit` 的**全过程**。若任意一步卡住超过 30 秒，定时器都会触发强制退出。

---

#### 修正 2：Fatal 链策略选择

选择 **“同步记录后立即退出”**，不执行任何异步最佳努力收尾。

**理由**：
- `uncaughtException` 发生时，错误已脱离所有可控上下文，进程状态不可信。调用 `server.close` 或 `disconnectDB` 等异步操作可能触发二次错误、死锁或无限期挂起，反而阻止进程退出。
- 应用内“硬期限”定时器在 event loop 被同步阻塞时**不会触发**（如死循环或同步 I/O），因此不能作为可靠保底。真正的最终强杀只能由外部 supervisor（如 K8s `terminationGracePeriodSeconds`、PM2 超时）提供。
- 在不可信状态下，最安全的做法是**同步记录必要诊断信息**（`console.error` 堆栈）并立即 `process.exit(1)`，让外部进程管理器负责重启，避免在废墟上做危险操作。

G3 修正通过。端到端期限现在覆盖 HTTP 排空和数据库断开，fatal 链也选择了自洽的“同步记录后立即退出”。

两点精度收口：

- 定时器应在任一最终退出分支到达时结束；真正的成功出口只有“HTTP 关闭完成且 DB 断开 resolve → exit 0”。
- `console.error()` 是否同步取决于输出目标。这里把它理解为“只做最小诊断，不等待复杂异步收尾”，不要把具体日志 API 当成同步保证。

**D5 最终产出：错误由谁捕获**

请把今天内容整理成一张表，至少包含以下场景：

1. `EmailConflictError` 请求级业务错误。
2. Express handler 内同步 `throw`。
3. handler 返回或 `await` 的 rejected Promise。
4. handler 内悬空 rejected Promise。
5. `setTimeout` callback 内未捕获 `throw`。
6. 被 `await pipeline()` 管理的 stream error。
7. 裸 `pipe()` 中未监听的 stream `'error'`。
8. `SIGTERM`，注明它不是异常。

表格列固定为：

```text
场景
→ 错误/信号如何传播
→ 第一接管边界
→ 是否还能返回 HTTP 响应
→ 进程应继续、计划内退出还是异常退出
```

表后附上刚通过的 graceful shutdown 最小链即可。完成后我做一次最终 review，不再追加新知识题。

答: 
### D5 最终产出：错误由谁捕获

| 场景 | 错误/信号如何传播 | 第一接管边界 | 是否还能返回 HTTP 响应 | 进程应继续、计划内退出还是异常退出 |
|------|------------------|-------------|----------------------|--------------------------------|
| **1. `EmailConflictError` 请求级业务错误** | Repository 捕获 MongoDB 11000 后翻译并抛出 → Service 透传 → Controller（async）未捕获 → Express 5 捕获 async handler 返回的 Promise rejection 并调用 `next(err)` → 全局 error handler 根据错误类映射为 409 | Express 错误处理中间件 | **是**（返回 409 错误响应） | **继续运行**（进程状态正常，业务错误可预期） |
| **2. Express handler 内同步 `throw`** | 在非 async handler 中抛出 → 未被 try-catch 捕获 → Express 5 因同步错误没有 Promise 可观察 → 错误直接触发 `uncaughtException`（若无监听则进程退出） | 进程级 `uncaughtException`（若已注册监听） | **否**（响应尚未发送或可能部分发送，但错误已逃逸） | **异常退出**（进程状态可能不一致，不应继续） |
| **3. handler 返回或 `await` 的 rejected Promise** | async handler 中 `throw` 或 `return Promise.reject()` → 该 Promise 被 Express 5 观察 → rejection 转为调用 `next(err)` → 进入 error handler | Express 错误处理中间件 | **是**（通过 error handler 返回错误码和消息） | **继续运行**（错误在可控边界内） |
| **4. handler 内悬空 rejected Promise** | async handler 中创建 Promise 但未 `return`/`await` → 该 Promise 独立 rejected，不与 handler 返回的 Promise 链绑定 → Express 无法观察到 → 触发 `unhandledRejection` | 进程级 `unhandledRejection`（若无监听则默认可能退出） | **否**（错误发生在请求生命周期之外，响应可能已结束） | **异常退出**（生产策略通常视为缺陷，保守终止） |
| **5. `setTimeout` callback 内未捕获 `throw`** | 错误在 timers 阶段抛出，脱离 Express 同步调用栈和 Promise 链 → 无法通过 `next(err)` 传递 → 触发 `uncaughtException` | 进程级 `uncaughtException` | **否**（原始响应可能已发送，错误发生在后续事件循环） | **异常退出**（进程状态不可信） |
| **6. 被 `await pipeline()` 管理的 stream error** | `pipeline` 返回的 Promise 拒绝（如 ReadStream 找不到文件）→ `await` 失败 → async handler 返回的 Promise 拒绝 → Express 5 捕获并调用 `next(err)` → 进入 error handler | Express 错误处理中间件 | **是**（通过 error handler 返回错误响应） | **继续运行**（错误在框架可控边界内，资源已自动清理） |
| **7. 裸 `pipe()` 中未监听的 stream `'error'`** | 如 `createReadStream('missing.txt').pipe(...)` 中 ReadStream 触发 `'error'` 事件且无监听器 → EventEmitter 未捕获错误 → Node.js 抛出 → 触发 `uncaughtException` | 进程级 `uncaughtException` | **否**（错误脱离请求上下文，响应可能已发送） | **异常退出**（进程状态不确定，且可能残留输出文件） |
| **8. `SIGTERM`** | 操作系统或进程管理器发送信号 → `process.on('SIGTERM')` 监听器触发 → 执行关停流程 | 进程级信号监听器（计划内） | **取决于关停时机**：若在请求处理中，可能无法正常返回（取决于是否等待现有请求） | **计划内退出**（正常终止，退出码 0 或 1 反映关停结果） |

---

### 刚通过的 graceful shutdown 最小链（修正后）

**计划内关停（`SIGTERM` / `SIGINT`）端到端流程**：

```
收到 SIGTERM
  → 检查防重入标志 isClosing，若已为 true 则忽略；否则置 true
  → 启动端到端强制退出定时器（例如 30s），超时即记录后 process.exit(1)
  → 若 server 为 null（启动未完成），跳过 HTTP 关闭，直接进入数据库断开阶段
  → 否则调用 server.close(callback)，等待 HTTP 连接排空
  → server.close 回调触发（HTTP 排空完成），注意 **不清除定时器**
  → 执行 await disconnectDB()
      ├─ resolve → 清除定时器 → process.exit(0)  （唯一正常退出出口）
      └─ reject  → 清除定时器 → process.exit(1)  （关闭失败但退出）
```

**快速失败链（`uncaughtException` / `unhandledRejection`）**：

- **同步记录最小诊断信息**（不依赖异步 I/O）
- **立即调用 `process.exit(1)`**，不执行任何异步清理或关停操作（进程状态已不可信）
- 外部进程管理器（K8s/PM2）负责超时强杀与实例重启，应用内不依赖硬期限兜底(此处通过查阅资料获取, 我没有 K8S 等技术背景)

最终表暂不能验收，有 1 个阻断性问题。

**阻断性问题**

第 2 行错误。普通 Express handler 内的同步 `throw` 会被 Express 路由层的同步 `try/catch` 捕获，然后执行 `next(err)`，进入 error handler；不要求 handler 是 `async`。当前安装版本的直接证据见 [layer.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/layer.js:150)。

正确链路应是：

```text
普通 handler 同步 throw
→ Express 调用 handler 外层的 try/catch
→ next(err)
→ error handler
→ 若响应尚未发送，可以返回 HTTP 错误响应
→ 进程继续运行
```

**需要收紧**

- 第 6 行：在本题“文件 → 文件，尚未发送响应”的示例中可以返回 HTTP 错误；若 `res` 本身位于 `pipeline()` 中并已被销毁或 headers 已发送，则不能保证 error handler 还能发送 JSON。
- 第 8 行：`server.close()` 后，已有请求可在端到端期限内完成响应；新连接不再接收。超时后未完成请求会被强制中断。

请只修正表格的第 2、6、8 行。现在验收会不通过，因为第 2 行把 Express 的核心捕获边界写反了；其余主线已达到要求。

答: 修正后的版本

---

| 场景 | 错误/信号如何传播 | 第一接管边界 | 是否还能返回 HTTP 响应 | 进程应继续、计划内退出还是异常退出 |
|------|------------------|-------------|----------------------|--------------------------------|
| **1. `EmailConflictError` 请求级业务错误** | Repository 捕获 MongoDB 11000 后翻译并抛出 → Service 透传 → Controller（async）未捕获 → Express 5 捕获 async handler 返回的 Promise rejection 并调用 `next(err)` → 全局 error handler 根据错误类映射为 409 | Express 错误处理中间件 | **是**（返回 409 错误响应） | **继续运行**（进程状态正常，业务错误可预期） |
| **2. Express handler 内同步 `throw`** | 普通 handler（非 async）内同步抛出 → Express 路由层（`Layer.handleRequest`）的 `try/catch` 捕获 → 调用 `next(err)` → 进入 error handler | Express 错误处理中间件 | **是**（若响应尚未发送，error handler 可返回错误响应） | **继续运行**（错误被框架正常接管，不影响进程稳定性） |
| **3. handler 返回或 `await` 的 rejected Promise** | async handler 中 `throw` 或 `return Promise.reject()` → 该 Promise 被 Express 5 观察 → rejection 转为调用 `next(err)` → 进入 error handler | Express 错误处理中间件 | **是**（通过 error handler 返回错误码和消息） | **继续运行**（错误在可控边界内） |
| **4. handler 内悬空 rejected Promise** | async handler 中创建 Promise 但未 `return`/`await` → 该 Promise 独立 rejected，不与 handler 返回的 Promise 链绑定 → Express 无法观察到 → 触发 `unhandledRejection` | 进程级 `unhandledRejection`（若无监听则默认可能退出） | **否**（错误发生在请求生命周期之外，响应可能已结束） | **异常退出**（生产策略通常视为缺陷，保守终止） |
| **5. `setTimeout` callback 内未捕获 `throw`** | 错误在 timers 阶段抛出，脱离 Express 同步调用栈和 Promise 链 → 无法通过 `next(err)` 传递 → 触发 `uncaughtException` | 进程级 `uncaughtException` | **否**（原始响应可能已发送，错误发生在后续事件循环） | **异常退出**（进程状态不可信） |
| **6. 被 `await pipeline()` 管理的 stream error** | `pipeline` 返回的 Promise 拒绝（如 ReadStream 找不到文件）→ `await` 失败 → async handler 返回的 Promise 拒绝 → Express 5 捕获并调用 `next(err)` → 进入 error handler | Express 错误处理中间件 | **取决于响应状态**：若响应尚未发送且流未被销毁，可返回错误；若响应已发送或流被销毁，则无法保证 | **继续运行**（错误在框架可控边界内，资源已自动清理） |
| **7. 裸 `pipe()` 中未监听的 stream `'error'`** | 如 `createReadStream('missing.txt').pipe(...)` 中 ReadStream 触发 `'error'` 事件且无监听器 → EventEmitter 未捕获错误 → Node.js 抛出 → 触发 `uncaughtException` | 进程级 `uncaughtException` | **否**（错误脱离请求上下文，响应可能已发送） | **异常退出**（进程状态不确定，且可能残留输出文件） |
| **8. `SIGTERM`** | 操作系统或进程管理器发送信号 → `process.on('SIGTERM')` 监听器触发 → 执行关停流程（端到端期限、HTTP 排空、数据库断开） | 进程级信号监听器（计划内） | **在端到端期限内**：已有请求可正常完成并发送响应；超时后未完成请求被强制中断，无法保证响应 | **计划内退出**（正常终止，退出码 0 或 1 反映关停结果） |

---

### 刚通过的 graceful shutdown 最小链（修正后）

**计划内关停（`SIGTERM` / `SIGINT`）端到端流程**：

```
收到 SIGTERM
  → 检查防重入标志 isClosing，若已为 true 则忽略；否则置 true
  → 启动端到端强制退出定时器（例如 30s），超时即记录后 process.exit(1)
  → 若 server 为 null（启动未完成），跳过 HTTP 关闭，直接进入数据库断开阶段
  → 否则调用 server.close(callback)，等待 HTTP 连接排空
  → server.close 回调触发（HTTP 排空完成），注意 **不清除定时器**
  → 执行 await disconnectDB()
      ├─ resolve → 清除定时器 → process.exit(0)  （唯一正常退出出口）
      └─ reject  → 清除定时器 → process.exit(1)  （关闭失败但退出）
```

**快速失败链（`uncaughtException` / `unhandledRejection`）**：

- **同步记录最小诊断信息**（不依赖异步 I/O）
- **立即调用 `process.exit(1)`**，不执行任何异步清理或关停操作（进程状态已不可信）
- 外部进程管理器（K8s/PM2）负责超时强杀与实例重启，应用内不依赖硬期限兜底

D5 无阻断性问题，可以验收。现在验收不会因剩余问题不通过，因为本日目标是完成错误捕获表与 shutdown 设计，不是改造主应用。

已完成：

- [Day 5 学习笔记](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day5-error-boundaries-process-lifecycle.md)
- [Week 5 计划](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/week5-plan.md) 已勾选 D5
- [当前学习状态](/Users/nezha/Documents/nodejs-skillup/LEARNING-STATE.md) 已转向 7/27 的 D6
- [Day 5 英语口语稿](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day5-english-speaking.md)，147 词
- `pipeline-rebuild.js` 成功与失败路径已再次复跑通过
- `git diff --check` 通过

已知边界：当前 `server.js` 尚未实现启动期判空、防重入和端到端关停期限，已记录为最终工程收口时重新判断的实现差距。7/25–7/26 按计划休息，7/27 从最小 Worker 边界开始 D6。

今日进度比预计更快, 我贴出一个真实问题: 关闭后端服务时的日志: ^C收到 中断信号(SIGINT). 优雅关闭中...
收到 中断信号(SIGINT). 优雅关闭中...
收到 中断信号(SIGINT). 优雅关闭中...
Disconnected from MongoDB
Disconnected from MongoDB
Disconnected from MongoDB
中断信号(SIGINT) 服务关闭
➜  src git:(main) ✗ 如何结合今日的学习优化

这段日志正好验证了今天识别出的**关停流程缺少防重入**，不是 MongoDB 自己重复断开。

真实链路是：

```text
SIGINT 到达 3 次
→ signal listener 调用 gracefulShutdown() 3 次
→ server.close() 注册 3 个完成回调
→ HTTP server 关闭完成
→ 3 个回调分别调用 disconnectDB()
→ 打印 3 次 Disconnected from MongoDB
→ 第一个回调执行 process.exit(0)
→ 其余回调来不及打印“服务关闭”
```

对应代码在 [server.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:26)。日志已经把之前的“可能发生重复关闭”从推断变成了实测事实。

最小优化目标是把 shutdown 变成 **single-flight 状态转换**：

```text
running
→ 第一次信号：同步切换为 shutting-down，启动唯一关停链
→ 后续信号：不得再次调用 server.close / disconnectDB
→ HTTP 关闭完成
→ DB 只断开一次
→ exited
```

建议你自己实现以下行为：

1. 在任何异步动作前同步设置“正在关闭”状态，避免两个信号同时穿过检查。
2. 保存并复用唯一的 shutdown Promise，确保整个关停链只创建一次。
3. 明确重复信号策略：
   - 稳妥方案：记录“已在关闭中”，忽略后续信号。
   - 开发体验方案：第一次优雅关闭，第二次明确强制 `exit(1)`。
4. 端到端 deadline 从第一次信号开始，覆盖 HTTP 和 MongoDB，不能在 `server.close` 后提前清除。
5. 正常完成时设置成功退出码并让进程自然退出；deadline 或关闭失败才强制非零退出，避免截断尚未刷出的日志。
6. 保留 `server === null` 的启动期分支。

实现后的手动验收：

```text
快速按三次 Ctrl-C
→ “优雅关闭中”只出现一次
→ “Disconnected from MongoDB”只出现一次
→ “服务关闭”只出现一次
→ 没有 unhandledRejection
→ 退出码符合你选择的重复信号策略
```

这是 W5 核心生命周期逻辑，代码仍由你完成。完成后我按阻断性问题标准 review。

答: 
根据今日学习的错误边界与关停原则，优化后的 server.js 实现了 single-flight 关停、端到端 deadline 和明确的重复信号策略。主要改动如下：

1. 防重入：使用 shuttingDown 标志，首次信号触发唯一关停链，后续信号记录后忽略。

2. 端到端 deadline：从收到信号起设置 30 秒硬期限，覆盖 HTTP 排空和 DB 断开，期限内任意步骤未完成则强制退出。

3. HTTP 关闭与 DB 断开串行：server.close 完成后再断开 MongoDB，避免资源竞争。

4. 退出码控制：正常完成设 process.exitCode = 0 并允许事件循环自然退出（附加 100ms 延迟确保日志冲刷）；超时或异常则 process.exit(1)。

5. 启动期 server === null 处理：跳过 server.close，直接尝试断开 DB，保证服务未完全启动时也能干净退出。

关键设计决策：

重复信号策略：采用“忽略后续信号”的稳妥方案，避免意外强制退出破坏已有请求。

超时机制：覆盖整个关停过程，确保进程最终一定退出，且 server.close 成功不清除 deadline，只有 DB 断开后（成功或失败）才清除。

退出码：正常完成设 process.exitCode = 0 并延迟退出，保证日志完整输出；超时或异常用 process.exit(1) 告知外部管理器。

启动期分支：server === null 时跳过 HTTP 关闭，直接尝试断开 DB，避免 null.close 崩溃。

实际运行日志: ➜  src git:(main) ✗ npm run dev

> src@1.0.0 dev
> node --env-file=.env --watch server.js

服务运行端口: 3000
^C收到 中断信号(SIGINT). 优雅关闭中...
Disconnected from MongoDB
中断信号(SIGINT) 服务关闭
收到 中断信号(SIGINT)，但已在关闭中，忽略
收到 中断信号(SIGINT)，但已在关闭中，忽略
➜  src git:(main) ✗
➜  src git:(main) ✗
➜  src git:(main) ✗

**阻断性问题**

1. 启动与关停仍存在竞争。[server.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:15) 的 `connectDB()` 完成后会直接执行 `app.listen()`；而关停链在 `server === null` 时会跳过 HTTP 关闭。若信号恰好发生在数据库连接完成附近，关停已经开始，`startServer()` 仍可能继续监听端口。

需要满足这个不变量：

```text
shuttingDown 一旦变为 true
→ startServer 后续绝不能再开始接收请求
```

请由你决定如何协调启动 Promise 与 shutdown 状态，并自行修改。

**锦上添花**

- [server.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:60) 同时设置 `exitCode = 0`，又在 100ms 后强制 `process.exit(0)`。“自然退出”和“定时强退”是两种策略。当前写法可能截断尚未完成的日志，并掩盖残留 handle；不改不影响本次重复关闭修复，但会降低排障可信度。
- [server.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:74) 的空 `.catch()` 会吞掉未来未被内部 `try/catch` 覆盖的 rejection。当前路径已有内部错误处理，所以它是冗余的；未来扩展时可能让错误只表现为 30 秒后超时。

**验证结果**

- ESLint：通过。
- 测试：2 个 suite、7 个测试全部通过。
- 正常关停：只断开一次 MongoDB。
- 未完成 HTTP 请求期间发送三次 `SIGINT`：一次启动关停、两次明确忽略、30 秒后强制退出；防重入与端到端期限均得到实测支持。

原始“三次断开 MongoDB”问题已经解决。但如果按今天完整的 graceful shutdown 设计验收，**会不通过**，因为启动期信号竞争仍可能让服务在关停开始后继续 `listen()`。

针对启动竞争问题，已修改 server.js，通过引入 dbConnected 标志和启动前检查，保证 shuttingDown 一旦为真，startServer 不会再调用 app.listen()。同时移除了冗余的空 .catch()，并改用直接 process.exit() 确保日志完整冲刷。

关键修复点：

startServer 在 connectDB 前后及 listen 后均检查 shuttingDown，一旦为真则放弃启动并退出，确保不会在关停开始后继续监听端口。

新增 dbConnected 标志，供关停链判断数据库是否已建立，避免在连接尚未完成时错误调用 disconnectDB。

移除空 .catch()，所有异步错误已在 performShutdown 内部完整处理。

正常完成直接 process.exit(0)（同步退出），无需额外延迟，Node.js 会在退出前冲刷标准输出缓冲区，保证日志完整。

保持端到端 deadline，保证无论何种情况进程最终退出。

实际日志:
➜  src git:(main) ✗ npm run dev

> src@1.0.0 dev
> node --env-file=.env --watch server.js

服务运行端口: 3000
^C收到 中断信号(SIGINT). 优雅关闭中...
Disconnected from MongoDB
中断信号(SIGINT) 服务关闭
➜  src git:(main) ✗
➜  src git:(main) ✗
➜  src git:(main) ✗

启动竞争已经解决，重复 SIGINT 也仍然只会启动一条关停链。但完整 review 还有一个阻断点。
阻断性问题
[server.js (line 92)](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:92) 在打印完成日志后立即调用 process.exit(0)。你在笔记中写它会“保证日志完整冲刷”，这与 Node.js 的实际契约相反：process.exit() 会同步强制退出，即使 stdout/stderr 仍有异步写入；当前日志完整只能证明这次终端运行成功，不能推广为保证。Node.js 24 官方说明
需要重新选择并明确契约：
自然退出
→ 设置 exitCode，等待已知 handle 结束

强制退出
→ process.exit(code)，接受可能截断日志或其他异步工作
锦上添花
[server.js (line 34)](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:34) 仍有一个空 .catch()，所以“已移除空 catch”与代码不一致。代价是该分支的 DB 关闭错误会失去诊断信息。
listen() 后的 shuttingDown 检查在当前单线程同步片段中不可被信号回调插入；若未来变得可达，它又会绕过主关停链单独调用 server.close()。当前不影响运行，但增加了状态分支。
验证结果：
ESLint 通过。
2 个测试套件、7 个测试通过。
活动请求期间连续三次 SIGINT：一次开始、两次忽略、30 秒后强制退出。
启动期信号未能稳定做出运行时复现；该部分目前依据代码路径 review。
如果只验收原始“三次断开 MongoDB”问题，不会不通过，问题已解决。如果验收完整 graceful shutdown，会不通过，因为正常出口对日志冲刷的结论仍是错误事实。

答: 针对 review 指出的日志冲刷问题，我已修改 正常完成路径 不再调用 process.exit()，而是清除 deadline 定时器、设置 process.exitCode = 0，让事件循环自然退出，从而允许 stdout/stderr 的缓冲完全冲刷。超时及异常路径仍保持 process.exit(1) 强制退出，因为此类情况优先保证进程终止，日志完整性次要。

同时，我移除了空 .catch()，将断开数据库的错误显式记录，避免诊断丢失。启动竞争检查中，若因 shuttingDown 放弃启动，也改为自然退出（exitCode = 1）并清理可能已建立的连接。 listen 后的冗余 shuttingDown 检查已移除（该分支在单线程同步片段不可达，且易混淆状态）。

关键改动：

正常完成：不再 process.exit(0)，改为 clearTimeout(deadline) 并设置 process.exitCode = 0，随后 performShutdown 返回，事件循环因无等待任务而自然退出，stdout/stderr 缓冲被完整冲刷。

启动竞争路径：放弃启动时，若已连接数据库则尝试断开并记录错误，最后设置 process.exitCode = 1 并返回，允许进程自然退出（无其他待处理工作）。

启动失败（如 JWT 校验或 DB 连接异常）仍保留 process.exit(1)，因为此时服务未运行，强制退出是合理的。

空 .catch() 已移除，断开数据库的错误会被捕获并记录。

冗余 listen 后检查 已移除，避免状态分支。

日志:
➜  src git:(main) ✗ npm run dev

> src@1.0.0 dev
> node --env-file=.env --watch server.js

服务运行端口: 3000
^C收到 中断信号(SIGINT). 优雅关闭中...
Disconnected from MongoDB
中断信号(SIGINT) 服务关闭
➜  src git:(main) ✗
➜  src git:(main) ✗

**阻断性问题**

启动期关停仍会绕过端到端 deadline。

当前在 [server.js](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:78) 判断 `server === null && dbConnected === false` 后：

```text
清除 30 秒 deadline
→ 设置 exitCode = 0
→ gracefulShutdown 返回
```

但此时 [connectDB()](/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:24) 可能仍在等待，继续持有 socket/timer，进程不会自然退出。

我做了受控复现：

```text
MongoDB 握手保持 pending，超时设为 60 秒
→ 发送 SIGINT
→ 输出“服务尚未完全启动，立即退出”
→ 进程没有退出
→ 30 秒 deadline 已被清除，因此也没有强退
→ 约 60 秒后 connectDB 失败
→ startServer 打印“服务启动失败”并 exit(1)
```

这证明 `dbConnected` 只能区分“连接完成/未完成”，不能区分“尚未开始/正在连接”。需要保证：

```text
启动 Promise 尚未 settle
→ shutdown 不能提前清除端到端 deadline
→ startServer 后续结果也不能绕过或覆盖已开始的关停决策
```

具体实现仍由你决定，可以围绕“显式表示 connecting 状态”或“让 shutdown 协调启动 Promise”推导。

**已通过**

- 正常关停使用 `process.exitCode = 0` 后可自然退出，日志完整。
- 空 `.catch()` 已移除。
- 多余的 listen 后检查已移除。
- ESLint 通过。
- 2 个测试套件、7 个测试通过。
- 防重入与活动请求超时路径保持有效。

如果现在验收，**会不通过**，唯一阻断点是启动期间的 pending 连接绕过 30 秒 deadline。

