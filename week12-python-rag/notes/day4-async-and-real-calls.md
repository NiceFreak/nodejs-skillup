# W12 D4（9/3 周四）：异步生命周期、真实模型调用与真实失败

> 建立：2026-09-03（Asia/Shanghai）。本文件是 D4 的单日计划与当日笔记载体。计划部分由 AI 按
> 实现方模式（白名单文档）预排；实验脚手架属白名单（asyncio / HTTP SDK / pytest 写法），
> 可由 AI 实现并附自测证据；**timeout / cancellation 的实验结论与运行事实判断由本人产出**
> （周计划 §6 表），AI 只 review 表达与证据分层，不预填预测区与执行记录。
>
> 上游依据：[`week12-plan.md`](./week12-plan.md) §3（D4）、§1（交付物 3、4）、§2.1、§7、§9.3；
> D2 冻结的六项决策见 [`day2-freeze-and-baseline.md`](./day2-freeze-and-baseline.md) §3
> （尤其决策 5「运行信任边界」）；D3 结论与待验证清单见
> [`day3-bub-main-chain.md`](./day3-bub-main-chain.md) 与
> [`bub-reading-report.md`](./bub-reading-report.md) §7、§8。

> 行号版本注记（2026-09-04 版式标注）：本文件涉及 Bub 源码的引用均标「`文件 当时 Lxx`」或「当时
> Lxx」，指 `github.com/bubbuild/bub` commit `33c417a` 快照当时的行号（当日读码/验证记录），
> 不作为跨版本普适位置；复核命令：`git clone https://github.com/bubbuild/bub && git checkout 33c417a`。


## 0. 前置状态（D3 收口事实，本日开工基线）

- **Bub 三条主链已落盘**：turn lifecycle、tape 追加、context rebuild、model/tool/harness 职责
  四项已勾选（`day3-bub-main-chain.md` §5、§8 下午 ①-④）；hook ⑤ 只完成「注册时机 + 主链调用点」，
  「能改写哪些输入输出」的逐点收口仍挂在报告 §6。
- **阅读报告草稿 v0 已落盘**（`bub-reading-report.md` §0-§9，来源版本 `33c417a`）；本人 review
  与实质判断补充待办，收口仍在 D5。
- **闭合问题已选定 C1**（step 循环收敛性，报告 §7）：验证手段为纯本地 mock（fake model client
  注入固定 tool_calls），**验证时段归本日或 D5**。
- **DEBT 类 2 第二次卡档**（`DEBT.md`，2026-09-02）：题 1 / 题 3 已完整，题 2 的两处未过——
  afterListen 的事件循环阶段顺序推导有事实错误、**sync 收尾兜底仍未触及**。再重建排在 D4/D5 机动，
  **仍第一档**。
- **Python 基线可运行**：3.12.10、`pytest -v` 6 passed、`mypy src` Success；`prompt v0` 已版本化
  （`prompts/prompt-v0.md`，schema 与 `UserCreate` 对齐）。
- **依赖缺口（本日前置，白名单）**：`requirements.lock` 当前只有 pydantic / pytest / pytest-asyncio /
  mypy 系，**没有 HTTP client**（真实调用前必须补）；也**没有 pytest-cov**，而 D2 决策 1 的验收句
  含「覆盖率 ≥ 90%」——D5 验收前必须可用。
- **D3 收尾未完成项（顺延，非主线）**：`day3-english-speaking.md` 未生成；`week12-plan.md` §3 D3
  勾选已由本次计划提交同步补齐。

## 1. 今日目标与止步条件

主线一句话：把 D3 只在源码上读到的异步行为，在**本项目自己的最小代码**上真实跑一遍——完成一次真实
DeepSeek 调用与一次最小工具调用，让 timeout 与 cancellation 各真实触发一次，并用证据证明进程收尾时
没有残留 task、未关闭连接或未处理异常。

当日必须收口（任一不满足则当天不算完成，按实际状态记录去向）：

- [x] DEBT 类 2 第一档（第三次）有明确的通过或卡档结论。—— **通过**（连续通过第 1 次），上午执行，`DEBT.md` 已记录。
- [x] 一次**真实** DeepSeek 调用完成：记录模型 ID、`prompt v0` 版本、实际输入边界与输出是否符合
      schema。真实不可用时按周计划 §9.3 处理（保留错误证据 + fake client 验证本地生命周期，
      **不得把 fake 成功写成 API 已验证**）。—— `deepseek_v4-flash` 10 次真实调用，见 §11 §6.1。
- [x] 一次**最小工具调用**完成：只观察 Python API 形态、异步生命周期与客户端行为，不实现 Agent loop。
      —— `tool_call_demo.py` 一次往返，见 §11 §6.2；与 Bub 三层分离的对照结论已补（见 §11 §6.2，待本人确认）。
- [x] **timeout 真实触发一次**、**cancellation 真实触发一次**，各按「操作 -> 观察 -> 结论 -> 未验证边界」
      记录（周计划 §1 交付物 3）。—— C-1（read timeout 含可证伪对照）+ C-2（请求中 cancel）均真实触发，
      见 §11 主线 C；未验证边界已随各条标注。
- [x] 资源清理证据：测试/脚本结束后无残留 task、无未关闭连接、无未处理异常，且证据是**观察到的输出**
      而不是「没报错所以没问题」。—— C-3 证据 1（all_tasks 仅剩当前）+ 证据 2（非主线程无）+
      两场景 is_closed=True + `-W error` exit 0，见 §11。
- [ ] `LEARNING-STATE.md` 更新，写出 D5 第一个动作。

可顺延项与去向：

- Bub 机动时段（§8，最多 90 分钟）：hook ⑤ 收口 + 闭合问题 C1 最小实验。**与主线 B/C 冲突时先保主线**，
  C1 顺延到 D5（报告 D5 收口前必须有结论，不能悬空）。
- Codex/Cline 的 provider 与权限模式补记（D2 遗留，D3-D5 机动）→ 不占本日主线时段。
- typing/Protocol（D2 未覆盖）→ 随本日异步代码现场展开（如 fake client 与真实 client 的共同协议）；
  吃紧则顺延 D5。
- pytest-cov 接入与覆盖率口径 → 白名单配置，可放到本日末段或 D5 开头，但**必须在 D5 验收前可用**。
- `day3-english-speaking.md` → 与本日口语稿一并处理或明确记为不补。

止步条件沿用 D2 决策 4：P0 任务连续 2 个番茄钟无实质进展（无新推断、无新实验、无新笔记）即记卡点并
降档至确定性任务；17:00 前工作区仍有未说明的脏文件视为违反止步条件。

**额外止步条件（本日特有）**：真实 API 连续两次失败且失败类型相同（同一错误码/同一层），即停止重试，
按 §9.3 转 fake client 路径并保留证据；不把整个下午耗在账号、余额或网络问题上。

## 2. 本日明确不做

- 不实现 Agent loop、终止状态机、trace、verifier、trial（黑名单边界不因语言或"只是个 demo"改变）。
  本日的工具调用是**一次**模型 -> 工具 -> 结果的观察，不做循环、不做终止判定。
- 不做 prompt 调参与多轮对照（W14 才在冻结 dev task 上做单变量前后对照）；本日只**使用**冻结的 `prompt v0`。
- 不做检索、corpus 快照、embedding、题库与 eval（W13）。
- 不修改 Bub 仓库：只读 `~/Documents/bub`，保持 detached HEAD `33c417a`；C1 实验在**本项目内**用
  最小 fake client 复现结构，不改 Bub 源码、不装依赖到系统环境。
- 不引入 FastAPI、UI、Docker、CI 与部署。
- 不把 key 写进代码、笔记、测试或 git 历史：只从 gitignored 本地环境读取；记录里出现的任何请求样例
  必须脱敏。
- 不自动 commit / push / merge；不让 coding agent 代写本日的实验结论（本周 coding-agent 只读，
  同题诊断在 D5）。

## 3. 第一入口：DEBT 类 2 第一档第三次重建（盲，AI 出题、本人作答）

前两次判定均为卡档（2026-09-01 D2、2026-09-02 D3，记录见 `DEBT.md` 与两日笔记）。本次**仍为第一档**，
按 `AGENTS.md` §6「某档连续两次通过才升档」执行。

执行方式：

- [ ] 不打开 `week11-ci/src/reproduce-close-race.js`、`week11-ci/notes/day4-rollback-drill.md`、
      D2/D3 的 L1 讲解与 `DEBT.md` 里的答案摘要，先口述。
- [ ] 题目范围由 AI 当场出，**不提前公布**；AI 在验收结束前不提示。
- [ ] 通过标准是**从原理当场推导**，不是复述前两次的讲解；自查发现自己在回忆讲解即自判不过。

**待本人拍板（AI 不预填）**：本次题面口径二选一，影响"连续两次通过"如何计数——

1. **完整第一档三题**（探测时机 / 三种 close 时序与实测 / 同地址注入），上限 25 分钟；通过即计入
   连续通过第 1 次。
2. **聚焦补漏**（只考 D3 未过的两点：afterListen 的阶段顺序推导、sync 收尾兜底三条），上限
   15-20 分钟（符合 `AGENTS.md` §6「每天一个 15-20 分钟小单元」）；通过**不计入**连续通过，
   D5 仍需做一次完整第一档。

超时按卡档处理，另排，不追加时间，不挤占 §6/§7 主线。

## 4. 前置：实验脚手架与依赖（白名单，上限 30 分钟）

本节属周计划 §6 白名单（Python / asyncio / HTTP SDK / pytest 写法、依赖与 `.env.example`），
可由 AI 按实现方模式交付，但**必须附等价环境自测输出**（`AGENTS.md` §2 交付标准第 5 条）。

- [ ] 选定 HTTP 通路并写进 `pyproject.toml` + 重新锁定 `requirements.lock`：
      `httpx`（裸 HTTP，timeout 分层可控）或 `openai`（DeepSeek 兼容 OpenAI 协议，工具调用结构现成）。
      **取舍待本人拍板**：裸 `httpx` 能看清 connect/read/write/pool 四层 timeout 与连接关闭；
      `openai` SDK 少写解析代码但把超时与重试藏在内部（本日要观察的正是这一层）。
- [ ] `.env.example` 落盘（只写变量名，不写值）；真实 key 仍只存在于 gitignored 的本地 `.env`。
- [ ] 最小客户端骨架：一个 `async` 调用函数 + 一个显式生命周期入口（`async with` / `aclose()`），
      base_url、模型 ID、timeout 全部可注入。
- [ ] fake client：与真实 client 共用同一调用协议（typing/Protocol 现场展开点），用于 §7 的确定性
      触发与 §8 的 C1 实验。
- [ ] 自测门槛：`pytest -v` 仍全绿、`mypy src` Success，**且新增依赖后 `python -m src.smoke` 退出码
      仍为 0**（D2 决策 2 的冒烟判据不因新依赖失效）。

**待运行确认（不预设）**：DeepSeek 的 base_url、当前可用模型 ID 拼写与工具调用字段形态，以当天官方
文档与真实响应为准（`bub-reading-report.md` §8 已把「DeepSeek 模型 ID 拼写」列为待验证项）。

## 5. 主线 A：async 迁移增量（TypeScript -> Python）

### 5.1 读前预测（本人填写，先答后对）

写实验代码前先按 Node/TypeScript 经验盲答，跑完实验后按
「原判断 -> 实际现象 -> 关键证据 -> 偏差类型 -> 修正与待验证项」留痕：

- 预测 1：Node 的事件循环与 Python 的 `asyncio` event loop，在「谁驱动 I/O 回调」和「什么时候让出
  控制权」上有什么差别？一个纯 CPU 的循环会不会阻塞另一个正在 await 的协程？
- 预测 2：`task.cancel()` 之后，协程内部具体发生什么？异常在哪一行抛出？`try/finally` 与
  `async with` 的清理代码会不会执行？
- 预测 3：一次带 timeout 的 HTTP 请求超时后，**连接**处于什么状态？谁负责关闭它？
- 预测 4：进程退出时还有未完成的 task，会看到什么现象？（对照 Node 里未 settle 的 Promise）

**本人盲答（2026-09-03 上午誊录；预测 v2 按「一问一个设计点」拆分，P-1/P-2/P-3 已答，P-4 移 C-1 当场预测，P-5 属经验知识直接讲）**：

P-1 · CPU 忙循环 vs await 让出 —— 结论：永远不会。理由（原话要点）：
- asyncio 调度核心 = 事件循环每次迭代 `_run_once`：计算最近定时器超时时间 → `selector.select(timeout)` 阻塞等待 → 就绪 handle 入 `_ready` 队列 → 逐个执行回调（含恢复协程 `coro.send(None)`）。
- `task_a` 的 `while True: pass` 无 await/yield，正占用事件循环线程的字节码执行权；循环不退出即永不返回 `run_forever` 循环体去执行下一次 `select()`。
- `task_b` 的 `sleep(0.1)` 经 `loop.call_later` 注册定时器回调，依赖事件循环下一次迭代检查堆顶时间戳；循环无法进入下一次迭代，该定时器永不弹出执行。

P-2 · task.cancel() 传播路径（盲答原文见对话，要点）：
1. 感知位置 = 协程下一次执行 await 表达式那一行（正挂起在 `await event.wait()` 时，恢复经调度器 `coro.throw(asyncio.CancelledError)`）；`CancelledError` 继承 `BaseException` 不继承 `Exception`，`except Exception` 捕不到。
2. `finally` / `async with` 的 `__aexit__` 一定执行——CPython 异常展开语义（执行流碰到块），与 asyncio 无关。
3. 清理中再 await：原判断「风险一：内部再抛 CancelledError 打断清理；风险二：await 永不返回则悬挂；建议 `asyncio.shield()`」。AI review 后按 3.12 实测修正——**单次取消下 finally 中普通 await 正常完成**，再抛仅在第二次 cancel 注入时成立（详见 §11 主线 A）。

P-3 · Node vs asyncio 的 I/O 唤醒对照（本人原表誊录）：

| 维度 | Node.js (libuv) | Python asyncio (selector) |
|---|---|---|
| fs.readFile 完成回调由谁执行 | libuv 线程池执行阻塞文件操作；完成后经 async 通知主线程执行回调 | 无原生 AIO，用 `run_in_executor(ThreadPoolExecutor)`；线程完成经 `Future.set_result` 唤醒，由 selector 监听 self-pipe（`self._csock`）触发 `_ready` 队列调度 |
| socket 可读后协程如何唤醒 | epoll/kqueue 检测 fd 可读 → I/O watcher 回调执行 → 回调内 resolve JS Promise | `selector.select()` 返回就绪列表 → 调 fd 注册回调（如 `Transport._read_ready`）→ `Future.set_result` 恢复协程 `send()` |
| 谁驱动调度 | `uv_run` 的 while 循环，每次迭代一个阶段 | `BaseEventLoop._run_once`，单次迭代完成 select + `_ready` 消费 |
| 本质 | 两者同构：IO 就绪 → 入队 → 主线程执行回调 → 恢复协程/Promise；差异在线程池是否内置（libuv 内置，asyncio 需显式 `run_in_executor`） | 同左 |

P-4 · read timeout 后连接状态与归属：未盲答；按拆分移到 §7 C-1 实验当场预测（答案依赖 httpx/httpcore 内部，属库未写明行为须最小实验确认）。
P-5 · 进程退出时 pending task 现象：未盲答；按经验知识规则不考核先答，直接讲（待 C-3 收尾或当场展开）。

### 5.2 学习清单（按需现场展开，不做语法通览）

- [ ] `async def` / `await` / `asyncio.run` 的调用边界，与 Node 顶层 async 的差别。
- [ ] `asyncio.create_task` 的「创建即调度」语义；被丢弃的 task 引用会怎样。
- [ ] `asyncio.timeout`（3.11+）与 `asyncio.wait_for` 的关系：超时**如何**实现，调用方看到的异常
  与被包住的协程内部看到的异常是否同一个。
- [ ] `CancelledError` 的继承位置与「不被 `except Exception` 捕获」的后果（对照 D3 在 Bub
  `framework.py` 当时 L175 读到的 `except Exception -> notify_error -> raise` 与「CancelledError 直穿」结论）。
- [ ] `try/finally`、`async with` / `__aexit__` 在正常、异常、取消三条路径上的执行差别。
- [ ] `asyncio.gather` 的 `return_exceptions` 与「一个失败其余怎么办」。
- [ ] pytest 侧：`pytest-asyncio` 的模式配置与异步测试写法；如何让**警告变成失败**以捕获资源泄漏。

D3 的源码结论在这里第一次获得运行验证机会：Bub 的取消传播判断（报告 §2、§8 待验证清单第 2 条）
可以在本项目的最小代码上先证明语言层行为，再决定哪些还需要在 Bub 上跑（属 D5 或 W14 重建）。

## 6. 主线 B：真实模型调用与最小工具调用

### 6.1 真实模型调用（使用冻结的 `prompt v0`）

- [ ] 输入固定为 `prompts/prompt-v0.md` 的 instructions + 一段**由本人当场给定**的非结构化文本；
      不临时改 prompt（改动要改就升版本并写变更理由，本日不做调参）。
- [ ] 记录表（每次调用一行）：

```text
时间 | 模型 ID | prompt 版本 | 输入摘要（脱敏） | 输出是否合法 JSON | 是否符合 UserCreate schema | 耗时 | 失败模式
```

- [ ] 用 Pydantic 对输出做一次真实校验（`UserCreate` 已在 D2 建立），记录**校验失败**时的错误形态——
      这是 prompt v0 的第一份真实证据，不是"看起来对"。
- [ ] 明确写出**输入边界**：这次调用实际把哪些内容送给了模型（instructions / examples / user input），
      哪些没送。

### 6.2 最小工具调用

- [ ] 定义**一个**本地函数作为工具（例如按 email 查用户的纯本地实现），给出工具 schema。
- [ ] 观察并记录：模型返回的 `tool_calls` 结构、参数是否可直接反序列化、执行工具后结果**由谁**、
      以什么形态回传（本日只做一次往返，不回灌成循环）。
- [ ] 与 D3 的源码结论对照：Bub 的三层分离（模型决策 -> ToolExecutor 执行 -> harness 落盘，
      报告 §5）在这个最小实现里对应哪几行、少了哪一层。**对照结论由本人写**。

失败也是交付物：真实调用失败时记录错误码、发生在哪一层（DNS / TLS / HTTP / 协议 / schema）、
重试是否同类型，然后按 §1 的额外止步条件转 fake 路径。

## 7. 主线 C：timeout、cancellation 与资源清理（本日核心交付物）

三个实验各自独立，每个都按「目标 -> 操作 -> 观察 -> 结论 -> 边界」记录，**随做随记**。

- [ ] **C-1 timeout 真实触发**：让一次真实（或可控慢速）请求超时。需要答出：哪一层的 timeout 先触发
      （连接 / 读 / 总时长）、调用方收到什么异常、协程内部收到什么异常、连接是否被关闭。
      **可证伪设计**：把 timeout 调到明显大于实际耗时时，同一段代码必须不再触发——否则证明的是别的东西。
- [ ] **C-2 cancellation 真实触发**：在请求进行中 `task.cancel()`。需要答出：`CancelledError` 在哪个
      await 点抛出、`finally` / `__aexit__` 是否执行、清理代码里再 `await` 会发生什么、
      调用方 `await task` 时看到什么。
- [ ] **C-3 收尾无残留（证据式验收）**：至少两项**观察到的**证据，例如
      `asyncio.all_tasks()` 在收尾点为空、client 处于已关闭状态、无
      `Task was destroyed but it is pending!` / 未关闭连接的警告、把警告配置为错误后测试仍全绿。
      **不接受**「运行没报错」作为结论。

信任边界沿用 D2 决策 5：并发、GIL、内存与引用计数相关结论必须对照 CPython 源码；库未写明的行为
（含 SDK 内部重试、连接池归还时机）必须最小实验确认，不允许纯推断写进结论。每条结论标注
`事实 / 推断 / 待验证`。

## 8. 条件时段：Bub 残余与闭合问题 C1（最多 90 分钟，可整体顺延）

仅在 §3-§7 收口后仍有时间时执行；与主线冲突一律先保主线（周计划 §9.1）。

- [ ] hook ⑤ 收口：把 D3 已定位的调用点逐点写清「能改写哪些输入输出」，补进报告 §6。
- [ ] 闭合问题 C1（step 循环收敛性）：用固定 tool_calls 的 fake model client 观察
      `should_continue` 的收敛行为，验证是否只有 `max_steps` 兜底能终止。按报告 §7 的
      「假设 -> 源码定位 + 最小实验 -> 结论」三段式落盘。
- [ ] 顺手可做：报告 §8 待验证清单里**本地可测**的条目（如 `CancelledError` 直穿时 finally 的
      save_state 是否执行）在本项目的等价最小结构上先验证，标明「等价结构验证」而非「Bub 已验证」。

不属本时段：channel/provider 扩展、store.py 持久化细节、skills/sidecar/spill（选修，见 D3 §8）。

## 9. 落盘形态与文件清单

| 产物 | 路径 | 归属 |
|---|---|---|
| 异步实验代码与 fake/真实 client | `week12-python-rag/src/`（新增模块） | 白名单，AI 可实现 + 自测证据 |
| 异步生命周期测试 | `week12-python-rag/tests/`（新增） | 白名单实现；**断言口径由本人定** |
| `.env.example` | `week12-python-rag/.env.example` | 白名单 |
| 依赖变更 | `pyproject.toml`、`requirements.lock` | 白名单 |
| 本日实验记录与结论 | 本文件 §11 | **本人** |
| prompt v0 使用记录 | 本文件 §11（必要时回写 `prompts/prompt-v0.md` 的变更理由） | **本人** |
| Bub 报告增补（如做 §8） | `bub-reading-report.md` §6/§7/§8 | **本人**（AI 只 review） |

## 10. 时间分配与降档顺序

| 时段 | 任务 | 上限 | 溢出处理 |
|---|---|---|---|
| 上午第 1 段 | DEBT 类 2 第一档第三次重建（§3） | 15-25 分钟（按 §3 口径） | 超时判卡档，另排，不追加 |
| 上午第 2 段 | 实验脚手架与依赖（§4） | 30 分钟 | 白名单，卡住即由 AI 解除阻塞（周计划 §9.2） |
| 上午其余 | async 迁移增量 §5（预测 + 学习清单） | 至午休 | 未完成的清单项随 §7 实验现场展开 |
| 下午第 1 段 | 真实模型调用 + 最小工具调用（§6） | 1-2 个番茄钟 | 连续两次同类型失败即转 fake 路径 |
| 下午第 2-3 段 | timeout / cancellation / 资源清理（§7） | 2 个番茄钟 | **不可压缩**，必要时砍 §8 |
| 下午第 4 段 | 条件时段：Bub 残余与 C1（§8） | ≤90 分钟 | 整体顺延 D5 |
| 下午末段 | 结论收口、状态更新（§11、§12） | 45 分钟 | 不可压缩 |

降档顺序（周计划 §7）：Bub channel 细节 -> hook 非主链扩展点与 provider 扩展 -> 未被主链使用的
Python 特性 -> W13 corpus 排除类别预盘点。
不可砍：DEBT 重建、真实 timeout / cancellation、冒烟测试、`prompt v0` 的真实使用记录、状态收口。

## 11. 执行记录（当日滚动填写）

按「目标 -> 操作 -> 观察 -> 结论 -> 边界」记录，随做随记，不攒到收口（2026-09-01 本人约定）。
事实、推断、待验证三级必须显式区分；命令与输出保留原文（含失败输出），key 与 PII 脱敏。

### 第一入口：DEBT 类 2 第一档第三次重建

- **口径（本人拍板）**：完整第一档三题，上限 25 分钟，通过计入连续通过第 1 次（D4 计划 §3 选项 1）。
- **题面（AI 当场出）**：① 探测时机/动作/信号；② inCallback / afterListen / sync 三种 close 时序的竞争语义、实测与 sync 收尾兜底；③ 同地址注入。
- **本人作答要点（2026-09-03 盲答）**：见对话誊录 §5.1 预测区之后。验收对照 DEBT.md 前两次卡档点：afterListen 用 poll 观察 bind 完成 → listening 经 nextTick 派发 → 恒先于 check 阶段 setImmediate close，判定 falseActive=0 是阶段顺序保证的确定性结果；sync 三层兜底（catch `ERR_SERVER_NOT_RUNNING` / close 回调置 closeDone / `SYNC_CLOSE_TIMEOUT` 50ms 不依赖 closeDone 无条件 finish）已完整触及。
- **AI 验收结论（2026-09-03）**：三题全部通过。题 1 一处次要瑕疵不改判——等 close 完成后对曾监听端口 connect 是立即 `ECONNREFUSED`（无其他监听者），不会随回收时序变 connected；`TIME_WAIT` 属连接层，监听 socket 关闭不产生。
- **判定**：第一档第三次重建通过 = **连续通过第 1 次**。彻底还清仍需 D5 完整第一档连续第 2 次 + 欠债还债两项掌握证据。`DEBT.md` 状态更新归当日收尾（§12）。

### 前置：脚手架与依赖（§4）

- **HTTP 通路（本人拍板）**：`httpx` 裸 HTTP——timeout 分层（connect/read/write/pool）可见、能观察连接关闭；不用 `openai` SDK（超时与重试被封装，本日观察对象正是该层）。
- **事实缺口与处理**：计划 §6.1 假定 `UserCreate` 已在 D2 建立，实际仓库未落盘（src 只有 `unit5_demo.py` 三字段 `User`，无 addresses）。处理：按冻结 `prompts/prompt-v0.md` §5 TS schema 机械翻译为 `src/users/models.py`（`Address` + `UserCreate`，`email` 用 `Field(pattern=r"^\S+@\S+\.\S+$")`），待本人 §6.1 使用时确认与 UserCreate 原意一致。
- **交付文件（AI 实现方，白名单）**：`src/clients.py`（`ToolCall`/`ChatResult` dataclass、`ModelClient` Protocol、`DeepSeekClient`（httpx 裸 HTTP，base_url/model/timeout/transport 全注入，HTTP>=400 → `DeepSeekAPIError`）、`FakeClient`（确定性：error/hang/delay/result 行为 + 记录 calls，供 §7/§8））；`src/config.py`（极简 .env 读取：环境变量优先 → 根 .env KEY=VALUE，无引号展开）；`.env.example`（只写变量名）；`tests/test_clients.py`（11 项，断言 Python/httpx 文档化语义 + 脚手架行为，不替代 §5/§7 本人观察结论）。
- **自测门槛（2026-09-03，事实）**：`pytest -v` → **16 passed**（10 clients + 2 smoke + 4 users）；`mypy src` → Success（9 source files）；`python -m src.smoke` → `[smoke] OK: python=3.12.10 pydantic=2.13.5`，exit **0**。`requirements.lock` 16→22 行（httpx 0.28.1 + anyio/httpcore/h11/certifi/idna）。
- **Key 现状（事实）**：week12 无 `.env`；key 在 `week2-express/src/.env`（gitignored）。D4 §6 真实调用前需把 key 放 `week12/.env` 或 export（待本人）。
- **待运行确认**：DeepSeek 模型 ID 拼写与 base_url 以当天官方文档/真实响应为准（骨架默认 `deepseek-chat` / `https://api.deepseek.com`，可注入）。

### 主线 A：async 迁移增量与预测对照（§5）

**P-1 实验（CPU 忙循环 vs await 让出）— 脚本 `experiments/p1_cpu_vs_await.py`**

- 操作：`cpu_burn(0.5)`（无 await 忙循环）与 `sleeper`（`sleep(0.1)` 后打印）两个 task 经 `asyncio.create_task` 同启，`gather` 等待。
- 观察（2026-09-03 运行输出，事实）：
  ```
  [main]     开始 @ 89684.767
  [cpu_burn] 结束 @ 89685.267   ← 忙循环占满 0.5s，期间无任何其它输出
  [sleeper]  启动 @ 89685.267   ← 与 cpu_burn 结束同一时刻
  [sleeper]  醒了 @ 89685.368   ← 启动后 0.101s，sleep(0.1) 计时本身正常
  [main]     结束 @ 89685.368
  ```
- 结论（事实支持）：`sleeper` 醒来在 ~0.6s 而非 0.1s；且 **`sleeper` 的第一行打印也被推迟到 `cpu_burn` 让出之后**（时间戳相等）——`create_task` 只入调度队列，协程体要等当前协程让出后才执行。
- AI review 校准（可精确化点，不改判）：① `select(timeout)` 在只有定时器时阻塞至 timeout 上限后返回空列表，随后 `_run_once` 才处理定时器堆；② 协程恢复完整链 = sleep 定时器到点 → future `set_result` → `Task.__step` 被调度 → `coro.send()`。
- 对照 Node：`while(true){}` 同样卡死 libuv 循环，两者同构。
- **本人对照去向**：已由「预测对照总表」+ 本人运行级确认覆盖（2026-09-03，含「无限 vs 有限」「create_task 首行延迟」两点）；偏差吸收最终验证归 D5。

**P-2 实验（task.cancel() 传播路径）— 脚本 `experiments/p2_cancel_path.py`**

- 操作：四场景（A 单次 cancel / B finally 中普通 await / C 清理期二次 cancel / D 清理 await 永不完成）。
- 观察（2026-09-03 本人运行输出与预跑一致，事实）：A：`__aexit__(exc_type=CancelledError)` → `except CancelledError` → `finally` → 外部 CancelledError，`cancelled=True done=True`；`except Exception` 未触发。B：finally 中 `sleep(0.1)` **+101ms 正常完成**，未被自动再次打断，随后原 CancelledError 继续传播。C：清理期间第二次 `cancel()` **+51ms 立即打断**清理 sleep。D：清理 await 永不完成 → 悬挂 `done=False cancelled=False`；第二次 cancel 注入后恢复 `done=True`。
- AI review 校准（按 3.12.10 实测修正本人预测第 3 点）：「finally 中再 await 会再抛 CancelledError」**在单次取消下不成立**（B 场景）；成立条件 = 第二次 cancel 注入（C）或清理 await 目标自身被外部取消。悬挂状态细节修正：悬挂时 `cancelled()=False`（任务停在 PENDING，未转取消完成态）。`shield` 语义 = 保护清理 await 不被后续/外部新取消打断；另注意 3.11+ `asyncio.timeout` 恢复任务用的是 `uncancel()` 而非 shield。
- **本人对照去向**：B 场景偏差分析与三个校准点复述确认的最终验证归 D5 重建/收尾（现象层已由本人运行输出确认，2026-09-03）。

**P-3 概念对照（Node vs asyncio I/O 唤醒）**

- 本人口述表格已誊录 §5.1。AI review 两处校准（本人运行级确认 2026-09-03，最终验证归 D5）：① libuv 线程池完成通知经 async handle（`uv_async_send`）在 **poll 阶段**由 I/O watcher 触发，不在 pending 阶段——pending 处理的是上轮遗留完成回调（可查 libuv `deps/uv/src/unix/async.c` 复核）；② asyncio 网络 socket 走 **原生非阻塞 + selector** 路径（本项目 httpx 正走此路），`run_in_executor` 只用于文件/CPU 阻塞操作——`fs.readFile` 的对应物是 executor，`net.connect` 的对应物是 selector 原生路径。补充：asyncio 还有 `ProactorEventLoop`（Windows IOCP），selector 是 Unix 默认后端。

**§5.2 学习清单状态**：async/await/`asyncio.run` 边界（P-1 部分覆盖）、create_task 创建即调度（P-1 覆盖）、CancelledError 继承位置与 except Exception（P-2 覆盖）、try/finally/async with 三路径（P-2 覆盖 + D2 unit7 基础）、`asyncio.timeout` 与 wait_for 关系（C-1 展开）、gather `return_exceptions`（已实验，见 §11 主线 A gather 记录）、pytest-asyncio STRICT（脚手架已用）。

**预测对照总表（2026-09-03 整理；三列来源分离，本人确认列待填）**：

| 预测 | 原判断（本人盲答） | 实际现象（实验输出，事实） | 偏差判定（AI review，待本人确认） | 本人确认/修正 |
|---|---|---|---|---|
| P-1 CPU 忙循环 vs await 让出 | `run_once` 不迭代 → `select()` 不再执行 → sleep 定时器永不弹出，「永远不会」 | 有限忙循环 0.5s 版本：sleeper 醒在 ~0.6s；sleeper 首行打印也推迟到 cpu_burn 结束同刻（时间戳相等） | 方向正确。两处需补：①「永不」只对无限忙循环成立，有限版本是「推迟到让出后」；② 未提 `create_task` 只入调度队列，协程体首行也要等让出后才执行 | 本人运行级确认（2026-09-03）；偏差吸收归 D5 |
| P-2-1 cancel 注入点与类型 | 下一次 await 表达式那一行；`coro.throw(CancelledError)`；`except Exception` 捕不到 | 场景 A：`__aexit__`、`except CancelledError`、`finally` 顺序执行；`except Exception` 未触发 | 无偏差 | 本人运行级确认 |
| P-2-2 finally/async with 清理 | 一定执行（CPython 展开语义） | A：`__aexit__(exc_type=CancelledError)` 与 finally 均执行 | 无偏差 | 本人运行级确认 |
| P-2-3 清理中再 await | 风险一：再抛 CancelledError 打断清理；风险二：await 永不返回则悬挂；建议 shield | B：finally 中 `sleep(0.1)` +101ms **正常完成**，不被自动再打断；C：清理期二次 cancel **+51ms 立即打断**；D：清理 await 永不完成 → 悬挂 `done=False cancelled=False`，二次 cancel 恢复 | 偏差：风险一过强——「再抛」仅在**第二次 cancel 注入**（C）或清理 await 目标被外部取消时成立；单次取消下普通 await 能完成。风险二成立但状态细节错——悬挂时 `cancelled()=False`（停在 PENDING），不是取消完成态。shield 语义 = 防后续/外部新取消；3.11+ `asyncio.timeout` 恢复用 `uncancel()` | 本人运行级确认 |
| P-3 Node vs asyncio I/O 唤醒 | 对照表见 §5.1（fs.readFile→async 通知主线程；socket→watcher/selector 恢复） | 无运行实验（概念对照） | 两处修正：① libuv 线程池完成通知经 async handle 在 **poll 阶段**触发，非 pending 阶段；② asyncio 网络 socket 是原生非阻塞 + selector 路径，`run_in_executor` 只用于文件/CPU 阻塞 | 本人运行级确认 |

**§5 预测对照收口（2026-09-03）**：本人选定「本人运行级确认」记账——P-1/P-2/P-3 与 gather 已本人运行且输出与 AI 预跑一致，现象层确认成立；偏差吸收（P-1「永不」→「推迟」与 create_task 首行延迟、P-2-3 单次取消下 finally 普通 await 不被自动打断、P-3 poll 阶段与原生非阻塞路径修正）的**最终验证归 D5 重建/收尾**，此处为去向标注而非已完成吸收。

**本人亲自运行记录（2026-09-03，事实）**：本人运行 P-1 忙循环版与让出版、P-3 线程观察脚本，输出与 AI 预跑一致（本人运行时间戳为 90478.x 段；忙循环版 sleeper 启动与 cpu_burn 结束同刻 90478.503、醒 +0.100s；让出版 sleeper 启动即 90478.755、醒 +0.101s、pauser 结束 +0.501s；P-3 网络 I/O 期间线程仅 MainThread + 哑 server 辅助线程，`asyncio_0` 仅 executor 段出现）。

**gather 实验（§5.2 收尾项）— 脚本 `experiments/gather_demo.py`，AI 预跑 + 本人运行（2026-09-03，事实）**

- 操作：child = slow_ok(0.3s 返回) / fast_fail(0.05s 抛 ValueError) / late_ok(0.6s 返回)，分别用默认与 `return_exceptions=True` 跑 `gather`。
- 观察（事实）：
  ```
  [A] 默认 return_exceptions=False
    [90614.930] fast_fail 抛异常
    [90614.930] [A] gather 抛 ValueError: boom-fast   ← 与 fast_fail 同刻，不等 0.3s/0.6s
    [90614.930] [A] 已从 gather 返回；此刻 t3.done()=False
    [90615.179] slow_ok 完成
    [90615.479] late_ok 完成
    [90615.480] [A] late_ok 后台继续完成，await t3 = late_ok
  [B] return_exceptions=True
    [90616.081] [B] gather 返回（全部完成才返回）: kinds=['str', 'ValueError', 'str']
  ```
- 现象要点（供本人对照解读）：默认模式 gather 在第一个子任务失败时**立即**把异常传给调用方、不等待其余；其余子任务**不被取消**、继续后台完成（本实验保留 task 引用 await 收尾，无 pending 警告）。`return_exceptions=True` 时等**全部完成**才返回，异常以异常对象进入结果列表。
- 与 Node 对照提示（待本人展开）：`Promise.all` ≈ gather 默认（首个 rejection 即 reject，其余 promise 继续）；`Promise.allSettled` ≈ `return_exceptions=True`；差异在未处理的子任务异常——Node 触发 `unhandledRejection`，Python 在子任务异常未被 retrieve 时于 gc 打 `Task exception was never retrieved`。
- **本人对照去向**：本人运行 gather_demo 输出一致（2026-09-03，现象层确认）；A/B 一句话解读与 Node 对照（`Promise.all` / `allSettled` / `unhandledRejection` vs `Task exception was never retrieved`）的最终验证归 D5/收尾。

### 主线 B：真实模型调用与最小工具调用（§6）

**§6 前置连通性测试（2026-09-03，事实）**：`experiments/deepseek_ping.py` 真实请求成功——`base_url=https://api.deepseek.com`、`model=deepseek-v4-flash`（本人 .env 设置，API 回显确认拼写可用）、耗时 2.28s、`content='OK'`。key 只存于 gitignored `.env`，脚本输出脱敏。**回答 bub-reading-report §8 待验证项**：DeepSeek V4 线模型 ID 可用形态 = `deepseek-v4-flash`。

**§6.1 Prompt v0 首验记录（2026-09-03；运行事实 + 本人草稿结论 + AI review 校准分层）**

- **运行**：`experiments/run_prompt_v0_cases.py` 真实调用 10 次（无 API 错误），模型 `deepseek-v4-flash`。变量 = 是否发送 §3 few-shot examples（带 / `--bare`）。输入集 = 本人 5 组（完整 / 缺省 / 中文 role / 默认 role / 非法邮箱诱饵）。通过标准按 prompt-v0：≥5s 单列不计入通过率。
- **结果表（冻结口径：格式/结构按「有效样本 = 非超时」计）**：

  | 条件 | 格式通过率 | 结构通过率 | 超时数(≥5s) | 有效样本 |
  |---|---|---|---|---|
  | 带 examples | 3/3 (100%) | 3/3 (100%) | 2（case3/case5） | 3 |
  | 不带 examples | 3/3 (100%) | 2/3 (67%) | 2（case1/case3） | 3 |

  case 明细：case1 完整→valid；case2 缺省→valid；case3 中文「管理员」→**推断为 `admin` valid**（正向证据）；case4 role 缺省→默认 `member` valid；case5 非法邮箱→`valid=False`，`loc=('email',) type=string_type`。
- **case5 失败根因（dump 证据，事实）**：两种 examples 配置下模型均输出 `"email": null`（examples=True 时另含 `age:null`/`addresses:null`）。Pydantic `UserCreate.email` 为必填 `str`（`Field(pattern=...)`，非 EmailStr），收到显式 `null` → `type=string_type`（不是 `missing`）。模型行为 = 识别邮箱非法后「宁 null 不乱编」，遵守 prompt「不要凭空编造」。
- **本人结论（草稿，2026-09-03 待定稿）**：① few-shot 对结构完整率有正向提升（100% vs 67%）；② case3/case4 的角色推断符合预期；③ case5 根因是 prompt「必填 + 缺失可 null/省略」的自相矛盾被模型以 null 兑现，非模型提取能力问题；④ 超时集中在较长输入/复杂推理（~1/3），后续可考虑模型选择或阈值。
- **AI review 校准（不改判，已与本人确认）**：① 仓库字段是 `str+pattern` 非 `EmailStr`；② 通过率统一用冻结口径（超时不计入），格式列非 5/5 而是 3/3；③「把 email 改 Optional 修 case5」的方案 D 属 W14 单变量调参范围且会改 D2 冻结契约，本日不做——case5 记为「prompt 对非法输入未定义行为」的边界证据，随 prompt v0 版本演进处理。

**§6.2 最小工具调用记录（2026-09-03；`experiments/tool_call_demo.py`，事实）**

- 工具：`lookup_user_by_email`（本地 dict 查询，虚构数据），给出 OpenAI/DeepSeek 兼容 schema（`type:function` + parameters.email required）。
- 观察（事实）：单次带 `tools` 的真实调用，耗时 2617ms；`content=''`（模型未给文本，选择调用工具）；`tool_calls` 数量 1，`id=call_00_937VPqXQVYq5TLXzc2uM1034`，`name=lookup_user_by_email`，`arguments(raw)='{"email": "lisi@work.com"}'` 可直接 `json.loads`；工具**由调用方执行**得 `{'name':'李四','email':'lisi@work.com','role':'admin'}`；本日只做一次往返，未回灌成循环。
- 观察点：模型决策与内容分离（tool_calls 而非 content）；arguments 是协议 JSON 字符串；工具执行归调用方/harness 侧（模型不执行）。
- **三层对照结论（补 §6.2 欠账；AI 初稿 + 本人确认两轮校准后定稿）**：
  - 我们最小实现与 Bub 的报告 §5 三层分离逐行对应（注意**文件归属**：库与调用方是两层）：
    - **模型决策层**：`tool_call_demo.py` L56 `client.chat(messages, tools=[TOOL_SCHEMA])` + `clients.py` 的响应解析（gateway）。`clients.py` 职责边界 = 纯模型层，**不含也不该含工具执行**（它不知道有哪些工具）。
    - **工具执行层**：`tool_call_demo.py` L70-72 main() 手动调本地函数 `lookup_user_by_email(**args)`（调用方执行，无注册表、无 `tool_results` 回填——docstring 明示只做一次往返）。Bub 侧对应 tools.py REGISTRY + ToolExecutor + ModelRunner 内回填。
    - **编排/落盘层**：我们项目**无任何文件承担**（无 Agent step 循环、无 tape、无 hook/state/outbound）。注意：不要把 Bub 的「Agent 层 / _run_once」术语说成我们自己的代码——缺的正是那个编排角色。
  - 「少了哪一层」一句话：**有 model 决策（库）+ 一次手动工具执行（实验脚本调用方），无独立工具运行时（注册表/回填），无 Agent 编排与落盘**——clients.py 无工具执行是职责正确，不是缺失。
  - 与 Cline 对照：Cline = 完整 coding-agent harness（plan/act 循环 + 终止判定 + 内置工具集执行 + 权限确认 + 文件系统/会话落盘 + MCP），≈ Bub 的 framework+agent+tool 全集再加 coding 专用工具；本项目的 `src/clients.py` 只是两者「模型客户端」那一小层的替身。真正要体验「Cline 的 agent 用法」差异，落在 D5 同题只读 review（本人先答 → Codex/Cline 后答 → 对照记录）。

### 主线 C：timeout / cancellation / 资源清理（§7）

**脚手架（白名单，2026-09-03 AI 实现 + 预跑自测）**：新增 `experiments/_slow_server.py`
（本地单连接慢速 HTTP server：accept -> 读完请求 -> hold N 秒不响应 -> 可选发 OpenAI 格式响应；
hold 期间探测 FIN 时间戳，回答「连接何时被客户端关闭」）、`c1_read_timeout.py`、
`c2_cancel_inflight.py`、`c3_cleanup_evidence.py`。运行方式 `-m experiments.*`（experiments 已加
`__init__.py`）。另有插曲：`test_deepseek_accepts_layer_timeout_object` 原断言依赖本机 `.env`
（`DEEPSEEK_MODEL=deepseek-v4-flash` 导致失败），已改为显式传 `model`（隔离环境），pytest 16 passed /
mypy Success / smoke exit 0。

**AI 预跑输出（2026-09-03，白名单自测证据；结论判定与解读归本人，先盲答后对照）**：

- C-1（read timeout，server hold=3.0s）：case A read=0.5s -> `httpx.ReadTimeout`（MRO：
  `ReadTimeout -> TimeoutException -> TransportError -> RequestError -> HTTPError`），耗时 0.655s，
  client is_closed=True，server 侧 FIN 在请求到达后约 0.5s 观察到（客户端超时即关连接）；case B read=5.0s
  -> 同代码成功返回 `content='ok'`（耗时 3.08s，不触发）——**可证伪成立**。
- C-2（请求挂读时 task.cancel()）：finally 立即进入、其中 sleep(0.1) 正常完成（单次取消不自动再打断，
  同 P-2 B）；调用方 await task 收到 CancelledError、`cancelled=True done=True`；async with 退出 aclose
  执行、is_closed=True；server 侧 FIN 与取消同刻（t≈0.44s）观察到。
- C-3：`-W error::RuntimeWarning` 下 timeout+cancel 场景跑完 exit 0；收尾点
  `asyncio.all_tasks()` 仅剩当前任务、无非主线程存活。

**本人执行与结论（先答后对；逐条标 `事实/推断/待验证`）**：

**C-1 read timeout 对照（2026-09-03，本人亲跑 `c1_read_timeout.py` 后确认）**：

- 预测 1「卡在等响应头」✅——server 事件 `request received` 后无数据到达，read 计时启动并到点。
- 预测 2「read 最先触发」机制修正——connect/write 已完成、各自计时器停止，read 计时在进入等响应阶段才启动；**触发哪层 = 当前卡在哪一步，timeout 值小不是原因**（若 server 不 accept 则 read 再小也不触发，因尚未到读阶段）。偏差 A 自查：盲答中「read 走线程处理」为本人表述错误，与上午 P-3 亲跑实测（selector 原生路径、网络 I/O 无线程池）矛盾，判定 P-3 结论有效、本人当时说法错。
- 预测 3「客户端负责关闭」✅，理由修正——连接是通的，**响应不来**导致 read 超时，客户端超时后主动发 FIN（server A 侧 FIN 恰在 request 后 ~0.50s 观察到，`事实`）。
- 预测 4「连接会挂掉」❌ 被 case B 反驳——read=5.0s、同一慢 server（hold=3s 后正常响应）成功返回 `content='ok'`、无 FIN（`事实`）。case B 不挂 → 可证伪成立，「挂」的因果归 read 超时而非 server/连接本身问题。
- 经验知识已记录：异常 `httpx.ReadTimeout`，MRO = ReadTimeout -> TimeoutException -> TransportError -> RequestError -> HTTPError（实验输出 `事实`）；捕获用 `httpx.TimeoutException`。

**C-2 cancellation 预测留痕（2026-09-03，本人盲答；尚未运行对照）**：

1. 注入点：取消注入最内层挂起点（httpx 内部读等待），`call()` 协程感知于 `await client.chat(...)` 行并沿栈传播；与 C-1 的差异待实验确认（C-1 = 内部计时转 ReadTimeout，非外部注入 CancelledError）。
2. finally 必执行、其中 `sleep(0.1)` 正常完成；依据 = **P-2 场景 B**（单次取消不自动再打断；AI review 校准：盲答引用的 C/D 场景不适用——C 是清理期二次外部取消、D 是清理 await 永不完成）。
3. `async with client.__aexit__`（→ aclose）会执行——因 async with 在外层 main（未被取消），main 捕获 CancelledError 后正常退出；若被跳过则连接不关、server hold 至超时 → 资源泄露。
4. 类比 C-1：客户端应立刻 FIN、server 侧可见；「与 C-1 完全一致」降为**待验证**（超时 vs 外部取消的清理触发路径可能不同，以 server FIN 时间戳为证）。

**C-2 cancellation 对照（2026-09-03，本人亲跑 `c2_cancel_inflight.py` 后确认）**：

- 预测 1 ✅：cancel t+0.469 → finally t+0.470（~1ms 内沿栈传播到 `call()` 的 `await client.chat(...)`）。
- 预测 2 ✅：finally 中 `sleep(0.1)` 到 t+0.571 正常完成，未被自动再次打断（P-2 场景 B 在真实 HTTP 取消上复现）。
- 预测 3 ✅：main 捕获 CancelledError 后正常退出 `async with`（t+0.571→0.572）→ `__aexit__`/`aclose` 执行，is_closed=True。
- 预测 4 ✅：cancel t+0.469 → server 侧 FIN t+0.470（~1ms），客户端立即关闭。
- **固化结论（连接级 vs 业务级清理分层）**：FIN（t+0.470）早于业务 `finally` 的 sleep 完成（t+0.571）与 `aclose`——进行中连接的关闭由 httpx/httpcore 内部在 CancelledError 传播路径上完成，异常到达业务代码时连接已关闭；业务 `finally`/`async with` 负责 client 级资源与自身状态清理。C-1 超时与 C-2 取消**最终行为一致**（都立即 FIN），但触发源不同（httpx 内部计时转 ReadTimeout vs 外部注入 CancelledError）。与 Node 无直接类比（JS 取消走事件/无异常注入式结构化清理）。

**C-3 收尾无残留对照（2026-09-03，本人亲跑 `c3_cleanup_evidence.py`）**：

- 输出事实：timeout 场景 is_closed=True、cancel 场景 is_closed=True；证据 1 收尾点 `asyncio.all_tasks()` 共 1 个（仅当前任务）、0 残留；证据 2 非主线程无；`-W error::RuntimeWarning` 下 exit 0。
- 与 P-4 对照：同一 `-W error` 参数下泄漏脚本 exit 也为 0（Task destroyed 警告走 exception handler，不经 warnings 系统）——因此 C-3 的「无残留」主要由证据 1（all_tasks 空）+ 场景内 is_closed 承担，`-W error` 只排除另一类 RuntimeWarning。
- 结论（事实分层）：本日三个实验的代码路径收尾无残留 task、无未关闭 client、无被 `-W error` 捕获的警告（`事实`）；与 Node 退出语义的差异（pending Promise 静默 vs asyncio.run 主动 cancel）为 D5 重建/口述范围。

**P-4 现象（2026-09-03 实测 `p4_leak_demo.py` + 两种构造）**：

- 预测（机制部分）✅：`asyncio.run` 收尾自动取消残留 task → 不阻止进程退出、默认 exit 0；但简单「create_task 不 await」被 run 兜住，**看不到任何警告**（实测无 stderr 输出）。
- 经验事实 1：「Task was destroyed but it is pending!」需要 task 逃逸 run 的清理（手动 `loop` + `close()` 前不 cancel）才出现，形态 = 两行 stderr（message + task repr）。
- 经验事实 2：该警告走 event loop **exception handler**、不经 warnings 系统 → `-W error::RuntimeWarning` **拦不住**（实测 exit 仍 0）。C-3 的 `-W error` 验证的是另一类 RuntimeWarning（如 coroutine never awaited），「无 Task destroyed」靠收尾点 all_tasks 为空 + 无 stderr 证明。
- 构造 2（loop 运行中丢引用 + gc.collect()）未复现警告，不做结论。






### 条件时段：Bub 残余与 C1（§8）

**C1 step 循环收敛性（2026-09-03，等价结构验证完成）**：

- **假设（本人拟定）**：若 fake 模型每轮 final 事件都带非空 `tool_calls`（即便与上轮完全相同），则 `should_continue` 恒 True、无 steering 介入，循环必在 step=max_steps 触发 `RuntimeError("max_steps_reached=...")`；若某轮 `tool_calls` 为空则自然 return。
- **源码定位**：`agent.py` `_stream_events_with_auto_handoff` step 循环体（bub@33c417a，当时
  L214-309）——`for step in range(1, max_steps+1)`（当时 L214）→ `should_continue =
  bool(tool_calls or tool_results)`（当时 L242）→ `not should_continue` 则自然 return（当时
  L286）→ L309 循环耗尽 `RuntimeError` 兜底。**无停滞检测**（对照 week7-ai 停滞判据）。
- **最小实验**（本人手写 `experiments/c1_step_loop.py`，FakeClient 注入；AI 仅做源码讲解与 review，未代写循环）：实验组 `behaviors=[恒 tool_call]` 跑满 step 1-3 均 `should_continue=True` → 捕获 `RuntimeError: max_steps_reached=3`；对照组 `behaviors=[tool_call, text]` step1 continue、step2 空 tool_calls → 自然 return 无异常。两组 `max_steps=3` 相同，唯一变量 = 第 2 轮 final 的 `tool_calls` 是否为空。
- **结论（等价结构验证，非 Bub 真实运行）**：假设成立——Bub 的 step 循环对「模型重复产出同一工具调用」无停滞检测，**唯一终止路径 = max_steps 兜底 RuntimeError（agent.py，bub@33c417a，当时 L309）**；对照组证明自然终止路径存在且与异常路径互斥。实验组捕获行为部分回答报告 §8「max_steps 触发后调用方如何收到」：RuntimeError 从循环内传出、调用方可捕获（等价结构层）。
- **覆盖边界（如实标注）**：只覆盖 `should_continue` 判定（agent.py，bub@33c417a，当时 L242）的 `tool_calls` 分支（`tool_results` 未覆盖）；**未覆盖 steering 分支（agent.py，bub@33c417a，当时 L285）**（实验条件限定无 steering 消息）；`next_prompt` 用占位（判定不依赖 prompt 内容）；auto_handoff/context-overflow 旁路不涉及。
- hook ⑤ 逐点收口：本次未做（报告 §6 表格已收口 M1，D5 只复核新增 hookimpl）。

### 当日未完成与去向

- `day3-english-speaking.md` 未生成（2026-09-02 顺延至今）——与 `day4-english-speaking.md` 一并由本人决定补或不补（见 §12 口语稿项）。
- pytest-cov 接入与覆盖率口径：未做，D5 开头补（D2 决策 1 验收句含覆盖率 ≥ 90%，D5 验收前必须可用）。
- §6.2「最小工具调用与 Bub 三层分离对照」：本人结论未落笔（笔记 §11 §6.2 已留「待本人补」），顺延 D5 报告收口时对照。
- Codex/Cline 的 provider 与权限模式补记（D2 遗留，D3-D5 机动）：未做，顺延 D5（与 D5 coding-agent 同题任务一并记录）。
- hook ⑤ 逐点收口：报告 §6 M1 表格已提前收口，D5 只复核新增 hookimpl。

## 12. 收尾清单

- [x] `DEBT.md` 类 2 条目状态更新——上午随 `15a54b9` 追加「D4 通过（连续通过第 1 次）」，状态待还 D5（还需下一次完整第一档 + 掌握证据）。
- [x] `week12-plan.md` §3 D4 清单勾选，未完成项写去向。—— 8/8 勾选完成，pytest-cov 顺延 D5 并已注去向。
- [x] 真实调用与两个失败实验的结论已落 §11，且每条标注 `事实 / 推断 / 待验证`。—— C-1/C-2/C-3/P-4/C1 均落盘并分层标注；§6.1 为本人草稿 + AI review 校准。
- [x] 新增代码与测试全绿：`pytest -v`、`mypy src`、`python -m src.smoke` 退出码 0。—— pytest 16 passed / mypy Success（9 files）/ smoke exit 0（收口时实测）。
- [x] `LEARNING-STATE.md` 更新：当天结论与 D5 第一动作。—— 已更新：D4 收口 + D5 入口（下一步区）。
- [x] 按 `DAILY-SPEAKING-PROTOCOL.md` 生成当天口语稿（`day4-english-speaking.md`）；一并决定
      `day3-english-speaking.md` 补或不补。—— `day4-english-speaking.md` 已生成（141 词）；`day3-english-speaking.md` 已补（149 词）。
- [x] git diff 检查无敏感信息（DeepSeek key、`.env`、公司资料、PII）；是否 commit 由本人决定。—— 扫描通过（tracked 无 `.env`、diff/notes/experiments 无真实 key，仅测试假值 `sk-test` 与模型名 `deepseek-v4-flash`）；**是否 commit 由本人决定**。

## 13. 明日入口（D5，9/4 周五）

D5 是本周收口日（周计划 §3 D5）：完成 Bub 阅读报告并复核事实/推断/待验证标记；**本人先独立诊断**
一段未提前见过的 Python 异步或资源管理代码并冻结答案，之后 VS Code Codex 与 Cline 才对同一输入做
只读 review（合计 60-90 分钟），记录 context / 权限 / 计划 / 扩展 / 验证差异；按 D2 决策 1 的唯一
验收句验收五项交付物；只盘点 tracked Markdown 规模与排除类别作为 W13 输入；更新 `LEARNING-STATE.md`
（含 W13 第一入口与 W14 Bub 重建日期）。

D5 前置条件：本日的真实调用与两个失败实验已有结论、`pytest-cov` 可用（验收句含覆盖率 ≥ 90%）、
Bub 报告的闭合问题至少有一条完成验证。

## 14. AI 辅助记录

- 2026-09-03：AI 以实现方模式（白名单文档）按 `week12-plan.md` §3 预排本日计划，并同步
  `week12-plan.md` §3 的 D3 执行事实与 D4 可勾选清单、`LEARNING-STATE.md` 入口。计划只写
  「做什么、证明什么、怎么记录」；读前预测、实验结论、DEBT 重建题面与本人决策（§3 口径、§4 HTTP
  通路取舍）均未预填。未提供 Agent loop、终止状态机、工具契约、trace、verifier 的 L2 骨架，
  **不新增债务**。
