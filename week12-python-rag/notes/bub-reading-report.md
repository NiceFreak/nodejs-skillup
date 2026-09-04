# Bub 阅读报告（turn lifecycle · tape → context · model/tool/harness 职责）

> 状态：**v0（2026-09-02 D3 誊写）→ 2026-09-04 收口 v1**。2026-09-04 完成行号降级版式改造
> （正文行号下沉为证据锚）与 day5 §5.1 Q2 事实修正回填（§0/§4/§7 C3/§8 同步），改造经本人
> review 通过（无阻断问题）；报告最终收口结论由本人 D5 §5.7 落笔。内容主体来自当日已冻结执行
> 记录（`day3-bub-main-chain.md` §8）与源码定位。
> 来源版本：`~/Documents/bub` @ `33c417a`（detached HEAD，= `github.com/bubbuild/bub` HEAD）。复核命令：
> `git clone https://github.com/bubbuild/bub && git checkout 33c417a`。
>
> 证据等级：每条结论标注 **事实（源码确认）/ 推断 / 待验证（运行确认）**。
> 行号引用规则（2026-09-04 起）：正文只写机制、职责与稳定符号名（类/函数名）；确实需要精确复核的
> 位置用 `符号名（文件，bub@33c417a，当时 Lxx）` 作证据辅助（「当时 Lxx」= 该版本快照内的行号）。
> 展板遗留（不在本报告正文范围）：B3（tape-context）主图仍为 Q2 修正前的旧语义，见
> `w12-ai-visualization-plan.md` §10.3；其与报告/笔记侧的视觉同步待独立设计。
> 运行验证项全部属 D4/D5，本报告只定位与提出。

## 0. 摘要（结论先行）

- Bub 是一次 inbound 消息走一个 turn 管线的 hook-first runtime：每个 turn 阶段是 pluggy hook。
- context 从 append-only tape **每次现算重建**，不是可变 session state；模型看到什么由 anchor 规则、
  context 标记与默认渲染规则决定（默认 `_select_messages`，见 §4）。
- 一个 turn 是 framework 层边界（`process_inbound` → `TurnResult`），内部是 Agent 层多 step 循环：
  **模型产出 tool_calls 就继续，纯文本就停**。
- 职责三分：model 决策（输出 tool_calls）、Tool 执行、harness（framework + Agent + ModelRunner）
  编排与落盘。
- 层级提示：**一个 turn 可包含多个 step**，直到模型不再产出 tool_calls（turn > step，见 §2/§5）。

### 0.1 术语与 Web 映照（阅读地图）

阅读门槛说明：本报告以编程语言原名书写（不强行翻译代码标识符），术语中译按**理解助记**提供，
非官方标准译名；「Web 映照」帮助把 AI 工程概念对应到传统 Web/后端开发熟悉的模式。译名仅在极少数
无对应物处保留原名加括号说明。

| 术语 | 中文助记 | Web / 软件开发映照 |
|---|---|---|
| turn | 回合（一次入站消息处理） | HTTP 请求处理周期（controller 从 req 到 res） |
| step | 步骤（一次模型调用循环） | 一次异步子任务（如编排里一次外部服务调用） |
| harness | 执行外壳（无标准译名） | 应用骨架 / 编排层（承载 model 的工程脚手架） |
| agent | 智能体 | 自主决策的"业务编排"，但决策来自模型而非写死 if |
| workflow | 工作流 | 预定义代码路径编排（对比 agent 的动态指挥） |
| tape | 记录带（事件带） | append-only 事件日志 / 事件溯源库（真相源） |
| context | 上下文（模型输入） | 每次请求现查现组的读模型投影（非缓存） |
| anchor | 锚点 | 游标 / checkpoint：`WHERE date > anchor` |
| handoff | 交接 | 重置游标截断历史，另起会话窗口 |
| hook | 钩子 | 中间件 / 插件扩展点 |
| inbound / outbound | 入站 / 出站消息 | request / response |
| tool / tool_calls | 工具 / 工具调用 | 可调用服务接口 / RPC 意图（由模型发出） |
| ToolExecutor / REGISTRY | 工具执行器 / 注册表 | 服务适配层 / 服务注册表 |
| payload / meta | 负载 / 元数据 | 消息 body / 消息头（近似） |
| envelope | 信封封装 | 带路由字段的消息包装 |
| session | 会话 | 会话（按 id 关联一段 tape） |
| state | 状态 | 可变上下文（但有边界、随 turn 落盘，不跨 turn 隐式共享） |
| frozen / dataclass | 冻结 / 数据类 | immutable / 结构化数据对象 |
| skills | 技能 | 可发现的命令集 / 插件 |
| channel | 渠道 | 消息通道（CLI / Telegram 等 transport 层） |
| sidecar | 边车 | 附加数据源 / 伴随存储 |
| model（client） | 模型（客户端） | 决策引擎（LLM 客户端抽象，如 any_llm） |

## 1. 入口链：从 CLI 命令到第一次 turn

**主路径调用顺序（事实）**：

```text
bub run "hello"
→ 可执行入口由打包配置声明：bub = "bub.__main__:app"
   —— console wrapper 的生成与调用形态待运行验证
→ 导入 bub/__main__ 即执行模块级语句 app = create_cli_app()
   （import 与 python -m 两条路径都会执行；create_cli_app 是 __main__.py 的模块级函数）
→ create_cli_app() 内部：
     BubFramework() 实例化（持有 pluggy 管理器 / hooks / 各 store 句柄）
     → framework.load_hooks()（builtin 先注册，entry-point 插件后注册）
     → framework.create_cli_app()（BubFramework 类方法，与模块级同名函数需区分）建 typer 应用
→ register_cli_commands（hook 实现）注册 run 子命令：app.command("run")(cli.run)
→ 仅 python -m 直接执行时 __name__ == "__main__" 门打开 → app() 由 Typer 读 sys.argv 分发到 run 命令
→ cli.run() 命令回调：
     ctx.ensure_object(BubFramework) 取回 framework 实例
     → 构造 ChannelMessage（inbound）
     → asyncio.run(_run())：同步函数内显式起事件循环
     → async with framework.running()：起 tape store / steering inbox
     → framework.process_inbound(inbound)   ← 第一次 turn 触发点
```

**职责归属（事实）**：`[project.scripts]` 入口声明属打包配置；`create_cli_app` 是 `__main__.py` 的
模块级初始化函数，其内部调用的 `framework.create_cli_app()` 是 `BubFramework` 类方法（两个同名对象
需区分）；参数解析归 typer 库，触发点是 `app()`。

**返回值来源（事实）**：`__main__.py` 的 `app` = `create_cli_app()` 的返回值（`typer.Typer` 实例），
不是函数对象。

**证据锚（精确复核用）**：
- 入口声明：`[project.scripts] bub = "bub.__main__:app"`（pyproject.toml，bub@33c417a，当时 L47-48）
- 模块级建 app 与三步初始化：`app = create_cli_app()`（__main__.py，bub@33c417a，当时 L43；L30-32
  为 BubFramework 实例化 / load_hooks / framework.create_cli_app 调用链）
- `__name__` 门：`if __name__ == "__main__": app()`（__main__.py，bub@33c417a，当时 L45-46）
- run 命令注册：`register_cli_commands`（hook_impl.py，bub@33c417a，当时 L245-256）
- run 回调与触发点：`cli.run`（builtin/cli.py，bub@33c417a，当时 L38-67；process_inbound 调用点当时 L59）

**待运行验证**：`bub run` 真实执行时的参数映射（位置参数 message / `--channel` 等）。

## 2. turn lifecycle ①：一次 turn 的开始/结束

**入口与函数序列（事实）**：

```text
framework.process_inbound(inbound)   （async def → TurnResult，由 cli.run 调用）
→ resolve_session(inbound)（首个 await 动作）
→ 若 inbound 是 dict：setdefault("session_id", session_id)
→ build_state：state 预置 workspace/steering_inbox + 合并 load_state hook 返回
→ build_prompt：call_first build_prompt hook，缺省取 content_of(message)
→ model_output = ""
→ 进入内层 try/finally：
    _run_model —— 非流式走 run_model hook；流式走 run_model_stream
    finally 内 call_many("save_state", ...) 无条件执行（_run_model 抛异常也执行）
→ _collect_outbounds → for 逐条 call_many("dispatch_outbound", ...)
→ 构造并返回 TurnResult(session_id/prompt/model_output/outbounds/state)
```

**中间状态存放（事实）**：`TurnState`（`type TurnState = dict[str, Any]`，可变 dict）是 turn 内流转的
草稿纸；`TurnResult`（frozen dataclass）是不可变交付物，含 state 快照。

**结束分支三条（事实/机制判定）**：

| 分支 | 结束路径 | 结果 |
|---|---|---|
| 正常 | 构造并返回 `TurnResult` | 返回给调用方 |
| 普通异常 | 内层 finally 先跑（save_state）→ `except Exception` → logger.exception → notify_error(stage="turn") → raise | 重抛给调用方 |
| 取消 | `asyncio.CancelledError`（Python 3.8+ 继承 `BaseException`）不匹配 `except Exception` → finally 仍落盘 → 直穿到调用方，无 notify_error | 向调用方传播（运行验证属 D4） |

**turn 内部：step 循环**（见 §5 主链 ④）。turn = inbound → TurnResult 的框架层边界；step = turn 内
一次「模型调用 + 可能工具执行」的循环迭代。

**证据锚（精确复核用）**：
- `process_inbound` 整段（framework.py，bub@33c417a，当时 L144-178）；finally 内 save_state 的
  无条件范围（framework.py，bub@33c417a，当时 L154-163）；`except Exception → notify_error →
  raise`（framework.py，bub@33c417a，当时 L175-178）
- `TurnState`（turn.py，bub@33c417a，当时 L10）；`TurnResult`（turn.py，bub@33c417a，当时 L13-21）

**待运行验证**：`CancelledError` 直穿行为（取消时 finally 落盘是否如源码判定）。

## 3. tape 追加 ②：事件类型、时机、不可变与顺序

**数据模型（事实，全 frozen dataclass）**：

- `TapeEntry`：字段 id / kind / payload / meta / date；kind 由 7 个工厂方法产生——`message`
  （OpenAI 格式 dict）、`system`、`anchor`、`tool_call`、`tool_result`、`error`、`event`。
- `TapeContext`：context 选择规则——anchor（`LAST_ANCHOR` 默认 = 最近 anchor 之后 / 具体名 /
  None = 全量）、select（自定义覆盖默认）、state。
- `Tape`：持有 store 与 context 的句柄，自身不存数据；追加/读取委托 store。

**追加时机（事实）**：`record_chat` 在模型/工具调用**完成之后**调用：
- 工具路径：ToolExecutor 执行后。
- 纯文本路径：模型返回文本后。
- `before_llm_call` 返回 decision 直接拦截时：record_chat 替代那次真实调用。

**一次 record_chat 的追加顺序（事实）**：

```text
system → [context_error] → 每条 new_messages（message）→ tool_call → tool_result → error
→ assistant message（response_text）→ event("run", {status/usage/provider/model}) 汇总条目
```

**不可变与顺序（事实/推断）**：TapeEntry/Tape 均 frozen（dataclass(frozen=True)），模块 docstring
「Append-only tape primitives」；id 在工厂方法中为 0，真正 id 由 store append 时分配
（推断：id=0 是占位；store.py 分配逻辑待验证）。

**证据锚（精确复核用）**：
- `TapeEntry` 与 7 个 kind 工厂（tape.py，bub@33c417a，当时 L84-129；message 当时 L97-99、
  anchor 当时 L105-110、tool_call 当时 L112-114、tool_result 当时 L116-118、event 当时 L124-129）
- `TapeContext`（tape.py，bub@33c417a，当时 L143-157）；`Tape`（tape.py，bub@33c417a，当时 L197-535）
- `record_chat` 落盘触发点：工具路径（model_runner.py，bub@33c417a，当时 L251）、纯文本路径
  （model_runner.py，当时 L270）、before_llm_call 拦截路径（model_runner.py，当时 L198）；
  追加实现（model_runner.py 当时 L359-389 → tape.py 当时 L323-366）

**待运行验证**：store.append 的 id 分配与顺序保证（store.py 未读）。

## 4. context rebuild ③：模型输入如何重建

**默认渲染规则（事实；2026-09-04 按 day5 §5.1 Q2 修正）**：Bub 的 tape context 默认走
`build_tape_context` hook → `context.default_tape_context()`，其 `select = _select_messages`。
这个默认 selector **不是「只留 message」**：

| 记录 kind | 默认 `_select_messages` 的处理 |
|---|---|
| message | 原样透传 |
| tool_call | 组装为 assistant 消息（content 空 + tool_calls） |
| tool_result | 组装为 role="tool" 消息（带对应 tool_call_id） |
| anchor | 组装为 assistant 文本（`[Anchor created: name]: state`） |
| system / error / event | 丢弃，不进 messages |

`tape._default_messages`（只挑 `kind == "message"`）是 `select=None` 时的 fallback
（`tape.build_messages` 的分支），**不是 Bub 默认路径**。

**读取链路（事实）**：

```text
每次模型调用前 model_runner.build_messages：
→ tape.read_messages()
    → context.build_query（anchor 规则：LAST_ANCHOR / 具体名 / None）
    → store.fetch_all(query)
    → 过滤 entry.meta["context"] is not False
    → build_messages：有 select 用 select（默认 _select_messages），否则 _default_messages
    → 返回 OpenAI 兼容 messages 列表
→ model_runner 拼装：prepend system_prompt（若有）→ append steering + 当前 prompt
```

**结论（事实）**：模型每次拿到的 context 是从 tape 存储**现算重建的投影**，非累积缓存；投影构成 =
anchor 范围 + `context=False` meta 过滤 + 默认渲染规则。默认渲染下模型能看到上一轮工具结果
（tool_call / tool_result / anchor 以 OpenAI 消息形态进入），system / error / event 不进。

**证据锚（精确复核用）**：
- 默认 context：`context.default_tape_context`（context.py，bub@33c417a，当时 L12-15）；
  `_select_messages`（context.py，bub@33c417a，当时 L18-34）
- hook 入口：`hook_impl.build_tape_context`（hook_impl.py，bub@33c417a，当时 L396-398）
- fallback：`tape._default_messages`（tape.py，bub@33c417a，当时 L165-173）
- 读取链：`tape.read_messages`（tape.py，bub@33c417a，当时 L300-307；内 build_messages 调用当时
  L306）；`model_runner.build_messages`（model_runner.py，bub@33c417a，当时 L310-337；read_messages
  调用点当时 L322）
- 拼装：system_prompt / steering 前置（model_runner.py，bub@33c417a，当时 L333-336）

**待运行验证**：一次真实多 step 会话 dump 模型 messages，核对默认渲染规则（tool_call / tool_result /
anchor 进入、system / error / event 丢弃）与 `context=False` 过滤、anchor 裁剪是否如源码判定。

## 5. model / tool / harness 职责边界 ④：一次模型步的完整链路

**全链路（事实，代码调用顺序）**：

```text
process_inbound → 内层 _run_model → run_model_stream hook
→ hook_impl.run_model_stream → Agent.run_stream
→ Agent._agent_loop → Agent._stream_events_with_auto_handoff（step 循环控制核心）
→ Agent._run_once → Agent._run_once_stream → ModelRunner.run
→ ModelRunner.build_messages（tape.read_messages 重建 context）→ llm.acompletion
→ 有 tool_calls：ToolExecutor 执行 → record_chat 落盘
→ 无 tool_calls：record_chat 落盘 → final 事件 → loop 判定停止
```

**Agent step 循环（事实；核心段 agent.py 当时 L202-309）**：

1. 继续判定：`should_continue = bool(event.data.get("tool_calls") or event.data.get("tool_results"))`
   —— 模型产出工具调用则继续下一 step；只出文本则停（判定点当时 L242）。
2. 停止：`should_continue or= _has_steering_messages(...)`（其他 channel 插话也继续）；仍 False 则
   记 `loop.step status=ok` 并 return（当时 L285-296）。
3. 异常恢复：context length 超限且 auto_handoff 剩余 > 0 → `handoff("auto_handoff/context_overflow")`
   重置 anchor → `next_prompt = prompt` 重试（预算 = `MAX_AUTO_HANDOFF_RETRIES`）；其他异常记
   `loop.step status=error` 后 `raise`（当时 L243-280）。
4. 循环边界：for step 耗尽（`settings.max_steps`）仍 continue → `RuntimeError("max_steps_reached")`
   （当时 L309）。

**职责归属表（事实）**：

| 对象 | 角色 | 决定什么 |
|---|---|---|
| model（any_llm 抽象） | 输出文本或 tool_calls | 「下一步做什么」的决策者 |
| Tool / REGISTRY / ToolExecutor | 能力注册表与执行器 | 未知工具名 → 占位 Tool 抛错供 hook 恢复 |
| Agent | 编排 step 循环 / 停止 / auto-handoff | 「何时继续 / 停 / 重置」 |
| ModelRunner | 单次模型步：重建 context / 调模型 / 执行工具 / record_chat | 「一次模型往返怎么跑完并记录」 |
| BubFramework | turn 边界 / hook 路由 / save_state / collect_outbounds | 「inbound → TurnResult 容器」 |

**关键认知（事实/推断）**：turn 与 step 是两个层级——turn = 一个 inbound → TurnResult（framework
层）；step = turn 内一次「模型调用 + 可能工具执行」循环迭代；一个 turn 通常是多 step 直到模型纯文本
收尾。harness 对 model 与 tool 的调用全部 async（async/await）；tool 执行在模型调用之后、落盘之前。

**证据锚（精确复核用）**：
- 调用链与 hook 入口：`process_inbound`（framework.py，bub@33c417a，当时 L144）→ `_run_model`
  （framework.py，当时 L155，定义 L186-225）→ run_model_stream hook（framework.py 调用点当时 L204；
  实现 `hook_impl.run_model_stream` 当时 L228-236）→ `Agent.run_stream`（agent.py，当时 L89-129；
  内部 `_agent_loop` 调用点当时 L121）→ `Agent._agent_loop`（定义 agent.py，当时 L171）→
  `Agent._stream_events_with_auto_handoff`（agent.py，当时 L202-309）→ `ModelRunner.run`
  （model_runner.py，当时 L164-283）
- step 判定点：for step 范围（agent.py，当时 L214）；should_continue（当时 L242）；steering 续跑与
  停止（当时 L285-296）；异常与 auto_handoff（当时 L243-280）；RuntimeError 兜底（当时 L309）；
  预算上限 `MAX_AUTO_HANDOFF_RETRIES`（agent.py，当时 L41）
- 默认 `max_steps = sys.maxsize`（settings.py，bub@33c417a，当时 L60）
- 未知工具名 → 占位 Tool 抛错（model_runner.py，bub@33c417a，当时 L504-525）

**待运行验证**：真实会话中多 step 的收敛性（模型反复产出 tool_calls 时只有 max_steps 兜底，
无停滞检测——对照 week7-ai 计划的停滞判据）。

## 6. hook 主链经过部分 ⑤

**注册时机（事实）**：`framework.load_hooks` 注册两类 hook 实现——builtin 先注册
（`_load_builtin_hooks`，内置实现为 `BuiltinImpl`），entry-point 插件后注册；具体实现即
`hook_impl.py` 内的 `@hookimpl` 方法。

**主链经过的 hook 一览（事实；hook 名均为 runtime 调用名）**：

| hook | 入参 | 出参 / 返回值 | 改写实质 |
|---|---|---|---|
| build_prompt | message（Envelope）+ session_id + state | str 或 list[dict]（prompt） | 改写模型输入 prompt；缺省取消息内容（call_first） |
| save_state | session_id + state + message + model_output | 无返回值 | 持久化 state；异常路径也执行（finally 内 call_many） |
| before_llm_call | LlmCallRequest | LlmCallDecision | 可拦截或替代真实 LLM 调用（另有 after_llm_call） |
| continue_prompt | prompt + tape + state | str（下一 step prompt） | 决定下一轮模型输入（多 step 衔接） |
| system_prompt | prompt + state | str 块 | 多实现按逆序拼接，构成系统提示 |
| load_state | message + session_id | dict（合并进 TurnState） | 初始化 turn 状态（reversed 顺序 merge） |

**调用发生在哪一层（事实）**：build_prompt / load_state / save_state / continue_prompt /
dispatch_outbound 的调用点都在 framework 的 turn 编排方法内（`BubFramework.build_prompt` /
`build_state` / `process_inbound`）；run_model_stream 与 build_tape_context 是 `hook_impl` 对
Agent 与默认 context 的接线；before/after_llm_call 的调用点在 `ModelRunner.run` 内。

**证据锚（精确复核用）**：
- 注册：`BubFramework.load_hooks`（framework.py，bub@33c417a，当时 L75-99）；
  `_load_builtin_hooks`（framework.py，当时 L63-73）
- framework 内调用点：build_prompt hook（framework.py，当时 L117-126 内 call_first）；continue_prompt
  hook（framework.py，当时 L128-133）；load_state hook（`BubFramework.build_state` 内 call_many，
  framework.py 当时 L135-142）；save_state hook（process_inbound 的 finally 内 call_many，
  framework.py 当时 L154-163）；dispatch_outbound hook（process_inbound 内循环 call_many，
  framework.py 当时 L165-167）；system_prompt hook（`BubFramework.get_system_prompt`，framework.py
  当时 L385-390）；build_tape_context hook（framework.py，当时 L392-396）
- before/after_llm_call：`ModelRunner.run` 内（model_runner.py，bub@33c417a，当时 L196；
  decision 拦截分支当时 L197-208；after_llm_call 当时 L212-219）
- 具体 hookimpl 接线：`hook_impl.run_model_stream`（hook_impl.py，当时 L228-236）；
  `hook_impl.build_tape_context`（hook_impl.py，当时 L396-398）→ `context.default_tape_context`
  （context.py，当时 L12-15）

此表不改变结论，只把 hook 主链「改写的实质」提前收口，D5 无需从头再核（只核对新增 hookimpl 实现）。

## 7. 闭合问题候选（本人选定后展开：假设 → 源码定位 + 最小实验 → 结论）

> **本日选定：优先 C1（step 循环收敛性）**——理由：可在纯本地 mock 层验证（fake model client 注入
> 固定 tool_calls 序列），不依赖任何外部 provider / 网络，适合 D4 机动时段快速收口。C2/C3 为备选，
> C3 依赖真实模型调用（D4/D5）。

本报告提出的候选方向（2026-09-02，C1 选定已确认）：

- **C1：step 循环收敛性**——`should_continue = bool(tool_calls or tool_results)` 是否存在无停滞检测
  的死循环风险？可证伪假设：让模型反复产出同一工具调用，观察是否只有 `max_steps` 兜底触发。
  验证手段：最小 harness 注入固定 tool_calls 序列（fake model client）。
- **C2：fork_tape 的 merge_back 语义**——`Agent.run_stream` 里 fork 的 tape 在流被提前关闭/消费
  一半时，改动是否与如何写回主 tape？（`fork_tape` 调用点 = agent.py，bub@33c417a，当时 L112）
  验证：最小实验中途关闭流后读主 tape。
- **C3：默认渲染规则的可观测性**——源码判定默认 `_select_messages` 渲染 message/tool_call/
  tool_result/anchor、丢弃 system/error/event，且 `context=False` 过滤与 anchor 裁剪生效；
  真实多 step 会话中模型 messages 是否确实如此？验证：一次真实多 step 会话 dump 每次模型调用前的
  messages。

验证时间归属：C1/C2 可 D4 最小实验；C3 依赖真实模型调用（D4/D5）。

## 8. 待运行验证清单汇总（全部属 D4/D5，本报告不完成验证）

- `bub run` 参数映射与真实 turn 执行。
- `CancelledError` 直穿时 finally 的 save_state 是否执行。
- store.append 的 id 分配与顺序保证（store.py 未读）。
- 真实多 step 会话 dump：模型 messages 是否与默认 `_select_messages` 渲染规则一致
  （message/tool_call/tool_result/anchor 进入、system/error/event 丢弃），`context=False` 过滤与
  anchor 裁剪是否生效。
- `max_steps` 兜底：真实触发（`RuntimeError("max_steps_reached")`（agent.py，bub@33c417a，当时
  L309）为源码事实；待验证的是真实会话中能否触发、触发后调用方如何收到）。
- DeepSeek 模型 ID 拼写与 any_llm provider 默认 base（Bub 接入形态）。

## 9. AI 辅助说明

草稿 v0 由 AI 按本人 2026-09-02 裁定（对话冻结内容整理属 AI 记录员职责）从
`day3-bub-main-chain.md` §8 誊写重组；所有结论的实质判断来自本人先答 + AI 验收，或 AI 陪读讲解后经
本人确认。待本人 review：hook ⑤ 改写能力逐点收口、闭合问题选定与展开、§5 收敛性观察、报告最终结构。

2026-09-04：按已拍板的「bub 代码引用可读性改造」对全文做版式处理——正文行号降级为证据辅助
（`符号名（文件，bub@33c417a，当时 Lxx）`），机制正文改为职责 / 输入输出 / 调用顺序表达；§4 与 C3
前提的默认 selector 修正依据 day5 §5.1 Q2 本人结论回填。本改造为白名单文案版式，未代写任何机制认知
结论。
