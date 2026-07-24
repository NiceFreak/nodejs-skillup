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