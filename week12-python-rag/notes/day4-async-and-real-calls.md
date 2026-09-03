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

- [ ] DEBT 类 2 第一档（第三次）有明确的通过或卡档结论。
- [ ] 一次**真实** DeepSeek 调用完成：记录模型 ID、`prompt v0` 版本、实际输入边界与输出是否符合
      schema。真实不可用时按周计划 §9.3 处理（保留错误证据 + fake client 验证本地生命周期，
      **不得把 fake 成功写成 API 已验证**）。
- [ ] 一次**最小工具调用**完成：只观察 Python API 形态、异步生命周期与客户端行为，不实现 Agent loop。
- [ ] **timeout 真实触发一次**、**cancellation 真实触发一次**，各按「操作 -> 观察 -> 结论 -> 未验证边界」
      记录（周计划 §1 交付物 3）。
- [ ] 资源清理证据：测试/脚本结束后无残留 task、无未关闭连接、无未处理异常，且证据是**观察到的输出**
      而不是「没报错所以没问题」。
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

**本人盲答（待填，实验前写）**：

### 5.2 学习清单（按需现场展开，不做语法通览）

- [ ] `async def` / `await` / `asyncio.run` 的调用边界，与 Node 顶层 async 的差别。
- [ ] `asyncio.create_task` 的「创建即调度」语义；被丢弃的 task 引用会怎样。
- [ ] `asyncio.timeout`（3.11+）与 `asyncio.wait_for` 的关系：超时**如何**实现，调用方看到的异常
  与被包住的协程内部看到的异常是否同一个。
- [ ] `CancelledError` 的继承位置与「不被 `except Exception` 捕获」的后果（对照 D3 在 Bub
  `framework.py` L175 读到的 `except Exception -> notify_error -> raise` 与「CancelledError 直穿」结论）。
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

### 前置：脚手架与依赖（§4）

### 主线 A：async 迁移增量与预测对照（§5）

### 主线 B：真实模型调用与最小工具调用（§6）

### 主线 C：timeout / cancellation / 资源清理（§7）

### 条件时段：Bub 残余与 C1（§8）

### 当日未完成与去向

## 12. 收尾清单

- [ ] `DEBT.md` 类 2 条目状态更新（通过 / 第三次卡档；勾选时补一句实际结果与本次口径）。
- [ ] `week12-plan.md` §3 D4 清单勾选，未完成项写去向。
- [ ] 真实调用与两个失败实验的结论已落 §11，且每条标注 `事实 / 推断 / 待验证`。
- [ ] 新增代码与测试全绿：`pytest -v`、`mypy src`、`python -m src.smoke` 退出码 0。
- [ ] `LEARNING-STATE.md` 更新：当天结论与 D5 第一动作。
- [ ] 按 `DAILY-SPEAKING-PROTOCOL.md` 生成当天口语稿（`day4-english-speaking.md`）；一并决定
      `day3-english-speaking.md` 补或不补。
- [ ] git diff 检查无敏感信息（DeepSeek key、`.env`、公司资料、PII）；是否 commit 由本人决定。

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
