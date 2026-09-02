# W12 D3（9/2 周三）：Bub 入口与主链深读

> 建立：2026-09-02（Asia/Shanghai）。本文件是 D3 的单日计划与当日笔记载体。计划部分由 AI 按
> 实现方模式（白名单文档）预排；阅读结论的实质判断由本人先答 + AI 验收。2026-09-02 执行期中
> 本人裁定：对话中已冻结内容的笔记誊写属 AI 记录员职责；本人未产出的认知空白（对照偏差、
> 对象创建关系、主链未跟部分）由 AI 保留，不预填。
>
> 上游依据：[`week12-plan.md`](./week12-plan.md) §3（D3）、§2.1、§7、§9；D2 冻结的六项决策见
> [`day2-freeze-and-baseline.md`](./day2-freeze-and-baseline.md) §3。
>
> 前置状态（D2 收口事实）：Python 3.12.10 基线可运行（`pytest -v` 6 passed）；`prompt v0` 已落盘；
> Bub 来源 commit 已冻结 `33c417a`（`~/Documents/bub`，detached HEAD，`git status` 干净）；
> DEBT 类 2 第一档盲重建**卡档，待还**。

## 1. 今日目标与止步条件

主线一句话：在冻结的 `33c417a` 上定位 Bub 的入口与一次 turn 的边界，跟完 turn lifecycle、
tape -> context rebuild 与 model/tool/harness 职责三条主链，并把结论写成带 `文件:行` 锚点、
分层标注的阅读报告草稿。

当日必须收口（任一不满足则当天不算完成，按实际状态记录去向）：

- DEBT 类 2 第一档再重建有明确的通过或卡档结论（第一入口，仍从第一档开始）。
- Bub 入口与一次 turn 的开始/结束判定条件已定位到 `文件:行`。
- 三条主链（turn lifecycle / tape -> context rebuild / model·tool·harness 职责边界）的调用顺序草稿落盘。
- 阅读报告草稿中每条结论都带 `事实 / 推断 / 待验证` 标记。
- `LEARNING-STATE.md` 更新，写出 D4 第一个动作。

可顺延项与去向：

- 主链未跟完 → 记录停在哪一层，占用 D4 机动时段（最多 90 分钟），不自动降档（周计划 §9.1）。
- hook 的非主链扩展点、channel/provider 扩展 → 选修；只在三条主链提前收口时抽样，不占 D4 机动时段。
- typing/Protocol（D2 未覆盖）→ 随本日 Bub 调用链现场展开；主链吃紧时顺延到 D4/D5。
- Codex/Cline 的 provider 与权限模式补记 → D3–D5 机动，不占本日主线时段。
- 运行验证（跑起来才能确认的行为）→ 一律记为「待验证」交给 D4，本日只读源码。

止步条件沿用 D2 决策 4：P0 任务连续 2 个番茄钟无实质进展（无新推断、无新实验、无新笔记）即记卡点并
降档至确定性任务；17:00 前工作区仍有未说明的脏文件视为违反止步条件。

## 2. 本日明确不做

- 不实现 Agent loop、终止状态机、trace、verifier（黑名单边界不因 Python 或阅读任务改变）。
- 不做真实模型调用、工具调用、timeout/cancellation 实验（D4）。
- 不做检索、corpus 快照、题库与 eval（W13）。
- 不修改 Bub 仓库：只读 `~/Documents/bub`，保持 detached HEAD `33c417a`，不 commit、不切分支、不装依赖到系统环境。
- 不用 coding agent 代读或代写阅读结论；本周 coding-agent 保持只读，且同题诊断在 D5 才开始。
- 不把 channel/provider 扩展当作必修补齐。

## 3. 第一入口：DEBT 类 2 第一档再重建（盲，AI 出题、本人作答）

D2 第一档判定为卡档（记录见 `DEBT.md` 与 `day2-freeze-and-baseline.md` §5），本次仍为第一档，
连续两次通过才升档。执行方式固定：

- [ ] 不打开 `week11-ci/src/reproduce-close-race.js`、`week11-ci/notes/day4-rollback-drill.md` 与 D2 的 L1 讲解，先口述三点：
  1. 探测时机为何必须在 close 前发起（本案的探测是什么动作、观察什么信号）。
  2. inCallback / afterListen / sync 三种 close 时序各自的竞争语义与**实测结果**。
  3. EADDRINUSE 注入为何必须绑同地址（含地址族与通配/具体形态的区别）。
- [ ] 本人答案冻结后再由 AI 对照源码与 D2 记录验收，判定通过或卡档。
- [ ] 结论写入本文件 §8 并同步 `DEBT.md` 状态；再次卡档则另排，不挤占 Bub 主链（周计划 §9.4）。

时间上限 45 分钟；超时按卡档处理并进入 §4。

## 4. 上午：Bub 入口与对象创建关系

### 4.1 读前预测（本人填写，先答后对）

进入源码前先按 Node/TypeScript 经验写下预测，读完后与源码事实对照，偏差按
「原判断 -> 实际现象 -> 关键证据 -> 偏差类型 -> 修正与待验证项」留痕：

- 预测 1：一次 turn 由谁触发、在哪一层结束。
- 预测 2：对话历史以什么形态保存，模型每次拿到的 context 是累积的还是重建的。
- 预测 3：决定「调哪个工具」和「执行工具」的是不是同一个对象。

**本人盲答（2026-09-02，读源码前，按 Node/TypeScript 经验）**：

- 预测 1：类比 TS/HTTP——一次 turn 类似 http 请求，在前端界面发起 fetch，服务端接收请求后处理好
  数据返回给前端完成处理。
- 预测 2：对话历史以 json 或某种约定好的格式保存；模型每次拿到的 context 是重建的。
- 预测 3：决定「调哪个工具」和「执行工具」的不是同一个对象。

**与源码对照的偏差留痕（2026-09-02 已对照，格式：原判断 -> 实际现象 -> 偏差类型）**：

- 预测 1（turn ≈ HTTP 单次往返）：实际 = 触发（用户消息进 process_inbound）与收尾（loop 判定
  模型不再产出工具调用、纯文本结束）结构相似，但内部是**多 step 工作流**——每次模型调用是一个
  step，可经历多轮工具往返后才收尾。偏差类型 = 结构类比成立、粒度不足（漏内部循环）。
- 预测 2（历史以 json/约定格式保存，context 重建）：实际 = tape 以 `TapeEntry`（kind/payload/meta）
  append-only 分层事件存 store；context 每次经 `read_messages` 重建。方向对；形态比"json 对话"
  更精确（含 tool_call/tool_result/anchor/event，且读侧有 anchor 裁剪）。
- 预测 3（决策 ≠ 执行）：实际 = **三层分离**：模型决策（tool_calls）→ ToolExecutor 执行 →
  record_chat 落盘（harness 统一做）。"不是同一对象"方向对，完整形态是三对象/三层。

### 4.2 定位清单

- [x] CLI / framework 入口（2026-09-02 定位，调用链见 §8 上午记录）：参数解析 / 应用初始化 /
  第一次 turn 触发点分别位于 `__main__.py` L45-46（`app()` 由 Typer 解析 sys.argv）/
  `__main__.py` L43（模块级 `create_cli_app()` 调用链）与 `cli.py` L59（`process_inbound(inbound)`）。
- [x] 一次 turn 的开始与结束判定（2026-09-02，见 §8 下午记录）：靠函数返回 `TurnResult`（turn.py
  L13-21）；结束分支三条（正常 return / 普通异常重抛 / `CancelledError` 直穿）。
- [x] 主要对象的创建关系（2026-09-02 已誊写对话冻结部分，未跟全点见下行）：
  - `BubFramework.__init__`（framework.py L50-61）：持有 pluggy PluginManager / HookRuntime /
    AgentHooks / ChannelRouter / TapeStore / SteeringInbox，生命周期跨 turn。
  - `Agent.__init__`（agent.py L47-50）：创建 `ModelRunner(settings, hooks=framework.get_agent_hooks())`。
  - `Agent.tape`（cached_property，agent.py L52-66）：从 `framework.get_tape_store()`（无则
    InMemoryTapeStore → AsyncTapeStoreAdapter）创建 `Tape(bub.home/"tapes", store, build_tape_context(), sidecars)`。
  - `run_stream`（agent.py L105-113）：`session_tape`（tape.py L517-522，workspace hash + session id
    hash → tape_name）→ `fork_tape(merge_back=...)`（L112，流消费完写回）→ `ensure_bootstrap_anchor`（L113）。
  - 未跟全：Agent 实例由谁持有/按 session 复用（hook_impl `_get_agent` 未读）；tool REGISTRY 定义位置
    （tools.py，未读）;store 的持久化实现（store.py，未读）。
- [x] 记录形态：调用顺序清单 + `文件:行` 锚点，不摘抄大段源码；每条注明信息来源是源码还是推断
  （本日执行记录已按此形态落盘，§6 报告草稿另收口）。

上午产出以「能画出一次 turn 的对象与调用顺序」为准，不追求覆盖全部模块。

## 5. 下午：三条主链

只跟以下主链，其余按 §2 与周计划 §7 顺序砍：

- [x] **turn lifecycle**（2026-09-02 已落盘，见 §8 下午 ①）：一次 turn 从触发到结束经过的函数序列
  已跟（process_inbound → hooks → Agent loop → ModelRunner）；中间状态在 TurnState（可变 dict）+
  StreamState；异常 = framework L175 except → notify_error → raise；取消 = CancelledError 直穿到
  调用方（不匹配 except Exception）；普通异常在 agent loop 层先看 auto_handoff 再决定重试或 raise。
- [x] **tape 追加**（2026-09-02，见 §8 下午 ②）：7 种 kind 事件；追加发生在模型/工具调用之后
  （record_chat）；frozen 不可变、append-only，id 由 store 分配。
- [x] **context rebuild**（2026-09-02，见 §8 下午 ③）：入口 `Tape.read_messages()`（tape.py L300）；
  在模型调用前触发；anchor 裁剪 + context=False 过滤；只挑 kind=="message" 转 OpenAI dict。
- [x] **model / tool / harness 职责边界**（2026-09-02，见 §8 下午 ④）：model 决策（tool_calls）、
  ToolExecutor 执行、harness 编排并落盘；错误恢复在 agent loop（auto_handoff）与 framework
  （except→raise）层；调用全异步（async/await）。
- [ ] **hook（仅主链经过部分）**：注册时机已见（framework.load_hooks L75-99 + @hookimpl）；主链
  调用点散见各层（build_prompt / save_state / run_model_stream / dispatch_outbound / before_llm_call /
  continue_prompt / system_prompt / build_tape_context）；「能改写哪些输入输出」的逐点收口留 §6 报告。

Python 语法在此处按需现场展开（白名单）：typing/Protocol、async/await 与 `async with` 的读法只解释
到「读懂这段调用链」为止，不做语法通览。

## 6. 阅读报告的落盘形态

- [x] 建立 `week12-python-rag/notes/bub-reading-report.md`（2026-09-02 草稿 v0 由 AI 按本人裁定
  誊写，见 §11；本人 review 与补充判断待办，AI 后续只 review 表达与事实分层，不代写结论）。
- [x] 主链部分当天起草（v0 已含 §0-§9 主链全部，收口仍在 D5）。
- [x] 每条结论按周计划 §3 的五项要求写清：代码调用顺序 / 职责归属 / 返回值或状态来源 /
  已由源码确认的事实 / 仍需运行验证的行为（报告内按「事实 / 推断 / 待验证」标注）。
- [x] 结论一律带 `文件:行` 锚点，并标注来源版本 `33c417a`。
- [x] 闭合问题候选：报告 §7 已列 C1-C3；**本日已选定 C1**（step 循环收敛性），理由 = 可纯本地
  mock（fake model client 注入固定 tool_calls），不依赖外部 provider，适合 D4 机动时段快速收口。
  C2/C3 为备选（C3 依赖真实模型调用）。展开验证 D4。

信任边界沿用 D2 决策 5：并发、GIL、内存与引用计数相关结论必须对照 CPython 源码；库未写明的行为和
运行期行为必须最小实验确认，不允许纯推断写进报告。

## 7. 时间分配与降档顺序

| 时段 | 任务 | 上限 | 溢出处理 |
|---|---|---|---|
| 上午第 1 段 | DEBT 类 2 第一档再重建（§3） | 45 分钟 | 超时判卡档，另排，不追加时间 |
| 上午其余 | Bub 入口与对象创建关系（§4） | 至午休 | 未完成则压缩 §5 的 hook 部分 |
| 下午第 1–2 段 | turn lifecycle + tape 追加（§5） | 2 个番茄钟 | 顺延至 D4 机动时段 |
| 下午第 3 段 | context rebuild + model/tool/harness 职责（§5） | 1–2 个番茄钟 | 同上 |
| 下午末段 | 报告草稿、闭合问题候选、状态收口（§6、§9） | 45 分钟 | 不可压缩 |

降档顺序（周计划 §7）：channel 细节 -> hook 非主链扩展点与 provider 扩展 -> 未被主链使用的 Python 特性。
不可砍：DEBT 重建、turn/tape -> context 主链与 model/tool/harness 职责、报告草稿与状态收口。

## 8. 执行记录（当日滚动填写）

按「目标 -> 操作 -> 观察 -> 结论 -> 边界」记录，随做随记，不攒到收口（2026-09-01 本人约定）。
事实、推断、待验证三级必须显式区分。

### 第一入口：DEBT 类 2 第一档再重建

- **本人答案要点（2026-09-02 盲答）**：
  - 题 1：探测必须在 close 前发起——close 完成后端口已回收、探测恒 refused，失去区分「从未绑定成功」与「绑定后关闭」的能力；探测 = `net.connect` 独立连接尝试，观察 connected / refused / timeout 三态。
  - 题 2：inCallback = close 在 listen 回调内调度，无竞争窗口；afterListen = close 在 `setImmediate` 发起，认为 bind 完成回调优先触发 listening（falseActive=0）；sync = 同步 close 抹掉挂起的 listen、listening 回调 0 触发、假 active 为 0。
  - 题 3：同地址 = 地址族 + IP 字面量形态 + 端口；IPv6 通配 `*:3002` 不挡 IPv4 `127.0.0.1:3002`（bindv6only=0 系统下）；修复 = `listen(3002, '127.0.0.1')` 精确抢占。
- **AI 验收结论（2026-09-02）**：**第一档再次卡档**。题 1 ✅、题 3 ✅ 完整；题 2 部分正确：inCallback / sync 语义与实测正确，但（a）afterListen 机制表述有 Node 事件循环事实错误——误称「bind 完成回调和 setImmediate 的 close 位于同一 check 阶段」，实际 bind 完成由 poll 阶段观察、listening 经 nextTick 微任务派发、恒先于 check 阶段的 setImmediate close，falseActive=0 是阶段顺序保证的确定性结果而非窄窗口未抓到；（b）**仍未触及 sync 收尾兜底**（D2 已点出的缺失项）——`server.close()` 在服务未启动时抛 `ERR_SERVER_NOT_RUNNING` 需 catch、close 回调置 closeDone、短兜底在 cb 未触发时把 probe 置 timeout 并无条件 finish（`week11-ci/src/reproduce-close-race.js` v7 L110-129）。
- **L1 讲解（2026-09-02 AI，失败后按重建梯子从 L1 重新开始）**：见当日对话记录；本人消化后需在「本人理解验证」补复述。
- **DEBT.md 状态去向**：已更新为「卡档，待还」，再再重建另排 D4/D5 机动，仍第一档。
- **本人理解验证（2026-09-02，L1 讲解后复述，AI 逐句核对通过）**：
  - ① afterListen 机制：`server.listen()` 发起异步绑定，底层 bind/listen 完成由 **poll 阶段**观察 fd readiness → `'listening'` 事件经 **process.nextTick 微任务**派发 → 事件循环在切换到下一阶段前先清空微任务队列 → **check 阶段**的 setImmediate close 后执行。`falseActive=0` 是阶段顺序保证的确定性结果，不是窄窗口未抓到；已修正「bind 完成回调和 setImmediate 同一 check 阶段」的错误。
  - ② sync 三层收尾：`server.close()` 同步取消挂起的 listen → `'listening'` 回调永不触发 → probe 从未发起、`probeResult` 保持 `'pending'`。三个出口缺一可能悬挂：catch（`ERR_SERVER_NOT_RUNNING`，置 closeDone + probe 置 timeout + finish）/ close 回调（置 closeDone，probe 非 pending 则 finish）/ 短兜底（`SYNC_CLOSE_TIMEOUT` 50ms 无条件 finish，不依赖 closeDone）。probe 置 `'timeout'` 表示「未测到」而非超时，不污染统计；3s 全局 timer 为最终保险。
  - 掌握证据状态：理解复述已达标；还债仍需重建通过（第一档连续两次）。

### 上午：Bub 入口与对象创建关系

**入口调用链（2026-09-02 源码定位，来源：`~/Documents/bub` @ `33c417a`，全部为源码事实）**：

```text
bub run "hello"
→ pyproject.toml L47-48 [project.scripts]：bub = "bub.__main__:app"（入口声明）
→ __main__.py L43 app = create_cli_app()：模块级语句，import/运行即执行（Python 语义）
    内部：L30 BubFramework() 实例化 → L31 framework.load_hooks() → L32 framework.create_cli_app()
→ framework.py L101-115 create_cli_app()（BubFramework 方法）：L103 建 typer.Typer(name="bub")；
    L105-112 @app.callback 全局回调 _main（--workspace option；L112 ctx.obj = self 注入实例）；
    L114 hook call_many_sync("register_cli_commands", ...)
→ hook_impl.py L245-256 register_cli_commands（hook 实现）：L248 app.command("run")(cli.run)
→ __main__.py L45-46 if __name__ == "__main__": app()：Typer 读 sys.argv 分发到 run 命令
→ builtin/cli.py L38-67 run() 命令回调：L48 ctx.ensure_object(BubFramework) 取回实例；
    L49-55 构造 ChannelMessage（inbound）；L61 asyncio.run(_run()) 手动起事件循环；
    L58 async with framework.running() 起 tape store / steering inbox；
    L59 framework.process_inbound(inbound)  ← 第一次 turn 触发点
```

**入口定位的初始偏差（先答后对留痕）**：

- 原判断：`app` 是 create_cli_app 对象、来自 create_cli_app 模块 → 实际 `create_cli_app` 是
  `__main__.py` L28-40 的模块级函数；`app`（L43）是它的返回值 `typer.Typer` 实例。同名方法
  `framework.create_cli_app()` 位于 framework.py L101，两处需区分。
- 原判断：参数解析在 `__main__.py` L32、初始化在 L46 → 实际 L32 是命令注册（经 register_cli_commands
  hook），参数解析发生在 L46 `app()`（Typer 读 sys.argv）；应用初始化在 L43 模块级调用链内完成。
- 原判断：第一次 turn 触发点是「BubFramework 函数」→ 实际 `BubFramework` 是类（framework.py L47），
  实例化不触发 turn；触发点在 cli.py L59 `process_inbound(inbound)`。

**对象创建关系（未完成）**：已确认 `BubFramework.__init__`（framework.py L50-61）持有 pluggy
PluginManager / HookRuntime / AgentHooks / ChannelRouter / TapeStore / SteeringInbox；
session / tape / context / model client / tool 注册表的创建与持有关系未跟，随 §5 主链。

### 下午：三条主链

**turn lifecycle ①：一次 turn 的开始/结束边界（2026-09-02 已落盘，来源：源码）**

入口：`process_inbound`（framework.py L144，async def，返回 TurnResult），由 cli.py L59 调用。

函数序列（framework.py）：
- L148 `resolve_session(inbound)`（首个 await 动作）→ L149-150 `if isinstance(inbound, dict):`
  `inbound.setdefault("session_id", session_id)`
- L151 `build_state` → L152 `build_prompt` → L153 `model_output = ""` 先置空
- L154-163 内层 try/finally：L155 `_run_model`；L156-163 `finally` 无条件 `save_state`
  hook（_run_model 抛异常时 save_state 仍执行，model_output 为该时刻值/空串）
- L165 `_collect_outbounds`（定义未读，待 §5 ③-④）→ L166-167 for 循环逐条 `dispatch_outbound` hook
- L168-174 构造并返回 `TurnResult(session_id / prompt / model_output / outbounds / state)`

中间状态存放：`TurnState`（turn.py L10，`type TurnState = dict[str, Any]`，可变 dict），由 `build_state`
（framework.py L135-142）汇集 load_state hook 返回，在 turn 内流转，最终作为 TurnResult 字段带出。

结束分支三条：
1. 正常：L168-174 return `TurnResult`（frozen dataclass，turn.py L13-21；不可变交付物，含 state 快照）。
2. 普通异常：内层 finally 先跑（save_state）→ L175 `except Exception` 捕获 → L176 logger.exception →
   L177 `notify_error(stage="turn", ...)` → L178 `raise` 重抛给调用方。
3. 取消：`asyncio.CancelledError` 在 Python 3.8+ 继承 `BaseException`、不匹配 `except Exception`
   （机制判定，源码证据为 except 类型；运行验证属 D4）→ finally 仍落盘 save_state → 异常直穿到调用方，
   无 notify_error / logger.exception。

本人初答偏差（AI 验收校准）：初答只列 2 条结束分支、漏取消路径；行号整体偏 1-3 行；漏 L149-150
dict 分支。`TurnState` vs `TurnResult` 的「可变草稿纸 vs frozen 快照」区分初答正确。

**tape 追加 ②（2026-09-02 陪读落盘，来源：源码 tape.py / model_runner.py）**：

数据模型（tape.py，全 frozen dataclass）：
- `TapeEntry`（L84-129）：id / kind / payload / meta / date。kind 由 7 个工厂方法产生：`message`、
  `system`、`anchor`、`tool_call`、`tool_result`、`error`、`event`。
- `TapeContext`（L143-157）：context 选择规则——anchor（`LAST_ANCHOR` 默认 = 最近 anchor 之后 /
  具体名 / None = 全量）、select（自定义覆盖默认）、state。
- `Tape`（L197-535）：持有 store 与 context 的句柄，自身不存数据，追加/读取委托 store。

追加时机（源码事实）：`record_chat` 在模型/工具调用**完成之后**调用（model_runner.py L251 有工具
路径、L270 纯文本路径；`before_llm_call` 返回 decision 时 L198 也走 record_chat 替代真实调用）。
`record_chat`（model_runner L359-389 → tape.py L323-366）一次按序追加：`system` → [context_error]
→ 每条 new_messages（message）→ `tool_call` → `tool_result` → `error` → assistant message
（response_text）→ `event("run", {status/usage/provider/model})` 汇总条目。

不可变与顺序：TapeEntry/Tape 均 frozen，只追加不修改（模块 docstring「Append-only tape」）；id 在
工厂方法中为 0，真正 id 由 store append 时分配（待 store.py 验证）。

**context rebuild ③（2026-09-02 陪读落盘，来源：源码）**：

入口 = `Tape.read_messages()`（tape.py L300），在每次模型调用**前**由 `build_messages`（model_runner
L310-337，其 L322 调 read_messages）触发。链路：L301 context.build_query（anchor 规则）→
L302 store.fetch_all → L303 过滤 `meta.context is not False` → L304/L165-173 `_default_messages`
只挑 kind=="message" 的条目转 OpenAI dict。结果：context 是每次从 tape 存储重读重建，非累积缓存
（支持预测 2）；`tool_call`/`tool_result` 的 kind 不进模型 messages，只存在于 tape（谁读 tool
记录 → 主链 ④）。

**model·tool·harness 职责 ④ / hook ⑤（2026-09-02 陪读完成，来源：源码 agent.py / model_runner.py / hook_impl.py）**：

全链路闭合（代码调用顺序，framework 层 → agent 层）：
`process_inbound`（framework L144）→ L155 `_run_model` → L204 hook `run_model_stream` →
`hook_impl.py` L229 run_model_stream → L230 `Agent.run_stream` → L121 `_agent_loop` →
L192 `_stream_events_with_auto_handoff` → L220 `_run_once` → L341 `_run_once_stream` →
L376 `ModelRunner.run` → L310 build_messages（read_messages 重建 context）→ llm.acompletion →
有 tool_calls：ToolExecutor 执行 → record_chat 落盘；无 tool_calls：record_chat 落盘 → final 事件。

Agent loop 三个判定点（agent.py L202-309）：
1. 继续与否（L242）：`should_continue = bool(tool_calls or tool_results)`——模型产出工具调用则
   继续下一 step（工具结果经下轮 read_messages 进 context）；只出文本则停。
2. 停止（L286-296）：`should_continue or= _has_steering_messages(...)`（其他 channel 插话也继续）；
   False 则记 `loop.step status=ok` 并 return。
3. 异常（L243-280）：context length 超限 → `handoff("auto_handoff/context_overflow")` 重置 anchor →
   next_prompt=原 prompt 重试（MAX_AUTO_HANDOFF_RETRIES 内）；其他异常记 error 后 raise。
兜底：step 数超 `settings.max_steps` → `RuntimeError("max_steps_reached")`（L309）。

职责归属表（主链 ④ 核心结论）：
| 对象 | 角色 | 决定什么 |
|---|---|---|
| model（any_llm） | 输出文本或 tool_calls | 「下一步做什么」的决策者 |
| Tool / REGISTRY / ToolExecutor（tools.py） | 能力注册表与执行器 | 未知工具名 → placeholder 抛错供 hook 恢复（model_runner L504-525） |
| Agent（agent.py） | 编排 step 循环 / 停止 / auto-handoff | 「何时继续 / 停 / 重置」 |
| ModelRunner（model_runner.py） | 单次模型步：重建 context / 调模型 / 执行工具 / record_chat | 「一次模型往返怎么跑完并记录」 |
| BubFramework（framework.py） | turn 边界 / hook 路由 / save_state | 「inbound → TurnResult 容器」 |

turn 与 step 是两个层级：turn = 一个 inbound → TurnResult（framework 层）；step = turn 内一次
「模型调用 + 可能工具执行」循环迭代；一个 turn 通常是多 step 直到模型纯文本收尾。

hook ⑤ 主链经过部分（注册与调用点已见，改写能力待 §6 逐点收口）：
- 注册时机：`framework.load_hooks`（L75-99，builtin 先注册 + entry-point 后注册）→
  hook_impl.py L195+ 的 `@hookimpl` 方法即实现。
- 主链调用点：build_prompt（framework L121 call_first）/ load_state（L137-138 call_many）/
  save_state（L157 call_many）/ run_model_stream（hook_impl L229）/ dispatch_outbound（L167 call_many）/
  continue_prompt（framework L130）/ system_prompt（framework L388）/ build_tape_context（L393）。
- 能改写什么（主链观察）：build_prompt 改写模型输入 prompt；continue_prompt 决定下一 step prompt；
  save_state 收到 state（异常也执行）；system_prompt 拼接块；before_llm_call（model_runner L187-208）
  可拦截或替代真实 llm 调用。

### 额外经验与拓展

**Python 语法现场展开（白名单，按入口链需要展开，2026-09-02）**：

- 模块顶层代码在 import 时执行；`if __name__ == "__main__"` 只区分「直接运行 vs 被 import」（对应
  Node CommonJS `require.main === module`）。`__main__.py` L43 位于 `if` 外，故 import 即执行初始化。
- 实验事实（2026-09-02，`week12-python-rag/.venv/bin/python`）：
  - `python src/tmp_main.py`（内部 `import tmp_mod`）输出 `module loaded` + `done`，无 `running as main`
    —— tmp_mod 顶层 print 执行、`__name__ == "tmp_mod"` 使门关闭。
  - `python src/tmp_mod.py` 输出 `module loaded` + `running as main` —— 直接运行时门打开。
  - 实验文件已删除（不留在 src 包内；临时脚本若在包目录内且 mypy 扫 `src/` 会被纳入检查）。
- 函数/方法/类/实例/返回值四层：`def` 定义函数；class 内 `def` 是方法（首参 self）；`BubFramework()`
  实例化触发 `__init__`；`app = create_cli_app()` 绑定的是调用返回值（typer.Typer 实例），不是函数对象。
- typer 是 CLI 分发器，与 Express 同构（本人用 Express 词汇收口，AI 验收通过）：
  命令注册 `app.command("run")(cli.run)` ≈ Express 路由注册；`app()` 解析 sys.argv ≈ Express 匹配请求；
  `ctx.obj` ≈ 中间件挂 `req.db`；`@app.callback` ≈ 全局中间件。参数映射：位置参数 / `--option` →
  函数签名。
- 异步模型差异（跨层）：Node 运行时常驻 libuv 事件循环，Express 只注册回调；Python 无常驻事件循环，
  CLI 同步函数内需 `asyncio.run()`（cli.py L61）显式创建并运行一个循环到结束。D4 展开 timeout/cancellation。

**延伸沉淀 A：Bub 是什么 / 解决什么问题（2026-09-02，来源：README + 已读源码）**：
- README 自定位「A hook-first runtime for agents that live alongside people」；起源 = 群聊场景，
  多人类 + agent 同对话协作，无隐藏状态。三设计承诺：每 turn 阶段是 pluggy hook / context 从
  append-only tape 重建 / 同一 pipeline 驱动 CLI+Telegram+自定义 channel。
- 心智模型：对话历史不是"存起来的记忆"，是"可随时重算的投影"（tape=事件真相源，context=每次
  现算的投影，anchor=游标，handoff=换游标）。对应后端事件溯源 + 现查投影。

**延伸沉淀 B：Bub 概念 ↔ 传统 Web 术语对照（2026-09-02 本人要求映射，用于自解释）**：

| Bub 概念 | 熟悉的说法 | 失效点 |
|---|---|---|
| turn | 一次请求处理周期 | 内部是多步工作流，非单次往返 |
| TurnResult | response DTO | — |
| tape | 事件日志 / 真相源（append-only） | — |
| context 重建 | 每次请求现查投影 | 因 LLM 无状态，是契约而非取舍 |
| anchor | 游标 / checkpoint | — |
| step 循环 | 多步异步编排 | 决策者是模型不是写死的 if |
| model 决策 | 业务决策 | 决策被外包给 LLM，代码只剩解析 tool_calls |
| Tool | Service / Adapter | — |
| hooks | 中间件 / 插件 | — |
| record_chat | DAO 写库 | — |

**延伸沉淀 C：OpenAI / Anthropic 定义的 harness 实践对照（2026-09-02）**：
- 共识：harness = 模型以外执行外壳（上下文管理 / 工具暴露 / 循环控制 / 安全 / 失败恢复）；
  model 思考，harness 让思考变成可靠行动。
- Anthropic《Building effective agents》(2024-12，已抓取原文)：区分 workflow（预定义代码路径编排）
  vs agent（LLM 动态指挥过程）；推荐最小 model loop；反对框架抽象层遮蔽 prompts；工具接口按 ACI
  设计（docstring / example / 防错参数，SWE-bench 例：强制绝对路径）。
- Anthropic《Effective harnesses for long-running agents》(2025-11，已抓取原文)：长任务跨 context
  window = 每 session 无记忆；失败模式一 one-shot 中途耗尽、失败模式二过早宣布完成；对策 =
  initializer agent + coding agent 增量进展 + 留 artifacts + clean state（可 merge 的定义）；
  feature list 自证（测试通过才算 passing）；init.sh 固化运行方式。
- OpenAI《Harness engineering》(2025-09)：原文 403 未能抓取，**待核验**；二手了解 = 主张模型能力
  已非瓶颈、harness 决定 agent 产品成败（Codex 产品化：上下文/工具面/sandbox/任务状态机）。
- Bub 对照：tape+anchor+handoff ≈ Anthropic 的跨 session artifacts（但宿主不同：文件系统工件 vs
  结构化事件日志）；agent.py loop 停止语义 ≈ 自证判断的雏形；auto_handoff ≈ context 超限恢复。
  分歧点 = 交接工件形态取决于宿主（代码库 vs 消息型会话）。

**延伸沉淀 D：Bub vs Cline / DeepSeek 接入（2026-09-02 工具使用经验）**：
- 接入形态：DeepSeek 是显式支持 provider（hook_impl L41）；用 `BUB_MODEL=deepseek:<model_id>` +
  `BUB_API_KEY`（或 provider 级 `BUB_DEEPSEEK_API_KEY`）+ 可选 `BUB_API_BASE`。模型 ID 拼写与
  base 默认值未能在本机跑 any_llm 验证，**待运行验证**。
- Bub vs Cline：宿主不同（独立 runtime + channel vs VS Code 扩展）；Cline 长在编辑器（diff/
  lint/terminal 联动），Bub 是"terminal worker"形态（给任务 → 后台做完 → 验收），无编辑器内
  diff 范式。W12-W16 角色分开：Bub=深读对象（D4 真实 DeepSeek 实验是本人自写 Python client，
  不经 Bub）；Cline/Codex=D5 只读对照工具。

### 当日未完成与去向（2026-09-02 半程滚动，收口时再核对）

- §5 主链 turn lifecycle / tape 追加 / context rebuild / model·tool·harness 均已落盘（§8 下午
  ①-④）；hook ⑤ 主链经过部分调用点已见，「改写能力」逐点收口留 §6 报告。
- 未跟：Agent 实例持有/复用（hook_impl `_get_agent`）、tools.py REGISTRY 细节、store.py 持久化、
  skills/sidecar/spill（非主链，选修）。
- §6 阅读报告草稿与闭合问题候选：未开始（本日主链材料已齐，下一步）。
- 运行验证（`CancelledError` 直穿、`bub run` 真实执行、typer 参数映射、DeepSeek 模型 ID 拼写）：
  标待验证，属 D4。
- 入口定位耗时超预期（Python 基础补课占上午），主链推进延迟，按周计划 §9.1 顺延而非降档。

## 9. 收尾清单

- [ ] `DEBT.md` 类 2 条目状态更新（通过 / 再次卡档，勾选时补一句实际结果）。
- [ ] `week12-plan.md` §3 D3 清单勾选，未完成项写去向。
- [ ] 阅读报告草稿落盘，主链部分与闭合问题候选可被 D5 直接接续。
- [ ] `LEARNING-STATE.md` 更新：当天结论与 D4 第一动作。
- [ ] 按 `DAILY-SPEAKING-PROTOCOL.md` 生成当天口语稿（`day3-english-speaking.md`）。
- [ ] git diff 检查无敏感信息（DeepSeek key、公司资料、PII）；是否 commit 由本人决定。

## 10. 明日入口（D4，9/3 周四）

先用机动时段（最多 90 分钟，仅在本日主链未跟完时使用）收 Bub 主链残余；随后进入 async/await、task、
timeout、cancellation 与资源清理，用冻结的 `prompt v0` 完成一次真实 DeepSeek 调用和一次最小工具调用，
timeout 与 cancellation 各真实触发一次，并验证测试结束后无残留 task、连接或未处理异常。
前置条件：本文件 §5 主链草稿已落盘、`prompt v0` 可用、DeepSeek key 仍只存在于 gitignored 本地环境。

## 11. AI 辅助记录

- 2026-09-02（D3 执行期，Bub 主链 + 延伸）：按本人裁定继续誊写对话冻结内容——§4.1 预测对照、
  §4.2 对象创建关系、§5 四条主链勾选与收口、§8 下午 ④/⑤、§8 延伸沉淀 A-D（Bub 定位 / Web 术语
  对照 / OpenAI+Anthropic harness 实践对照 / Bub vs Cline 与 DeepSeek 接入）。阅读结论实质判断均由
  本人先答 + AI 验收或 AI 陪读讲解后经本人确认；OpenAI 原文未能抓取，笔记中已标「待核验」。
  认知空白保留待本人。未给黑名单 L2 骨架，不新增债务。
- 2026-09-02（D3 执行期，Bub 部分）：本人裁定「对话中已冻结内容的笔记整理属 AI 记录员职责」。AI 将本日
  对话已冻结内容誊写入 §4.1/§4.2/§8（本人盲答预测原文、入口定位与偏差留痕、turn 边界、Python 语法展开与
  实验事实）；阅读结论的实质判断均由本人先答 + AI 验收。认知空白（§4.1 对照偏差、对象创建关系、主链
  ②-⑤）保留待本人。未给黑名单 L2 骨架，不新增债务。
- 2026-09-02：AI 以实现方模式（白名单文档）按 `week12-plan.md` §3 预排本日计划，并出 DEBT 类 2 第一档
  重建题目。未提供 Bub 阅读结论、未预填本人预测与决策、未给黑名单 L2 骨架，不新增债务。
