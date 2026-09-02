# Bub 阅读报告草稿（turn lifecycle · tape → context · model/tool/harness 职责）

> 状态：**草稿 v0（2026-09-02 D3 誊写）**，收口 D5。内容全部来自当日已冻结执行记录
> （`day3-bub-main-chain.md` §8）与源码定位；待本人 review、补充判断与闭合问题。
> 来源版本：`~/Documents/bub` @ `33c417a`（detached HEAD）。
>
> 证据等级：每条结论标注 **事实（源码确认）/ 推断 / 待验证（运行确认）**；行号为来源文件实际行号。
> 运行验证项全部属 D4/D5，本报告只定位与提出。

## 0. 摘要（结论先行）

- Bub 是一次 inbound 消息走一个 turn 管线的 hook-first runtime：每个 turn 阶段是 pluggy hook。
- context 从 append-only tape **每次现算重建**，不是可变 session state；模型看到什么由 anchor 规则
  与 kind 过滤决定。
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

**代码调用顺序（事实）**：

```text
bub run "hello"
→ pyproject.toml L47-48 [project.scripts]：bub = "bub.__main__:app"（入口声明）
→ __main__.py L43 app = create_cli_app()（模块级，import/运行即执行）
    L30 BubFramework() 实例化（framework.py L50-61）
    L31 framework.load_hooks()（framework.py L75-99：builtin 先注册 + entry-point 后注册）
    L32 framework.create_cli_app()（framework.py L101-115）
→ hook_impl.py L245-256 register_cli_commands：L248 app.command("run")(cli.run) 注册子命令
→ __main__.py L45-46 if __name__ == "__main__": app() —— Typer 读 sys.argv 分发到 run 命令
→ builtin/cli.py L38-67 run() 命令回调
    L48 ctx.ensure_object(BubFramework)（取回 framework 实例）
    L49-55 构造 ChannelMessage（inbound）
    L61 asyncio.run(_run())（同步函数内显式起事件循环）
    L58 async with framework.running()（起 tape store / steering inbox）
    L59 framework.process_inbound(inbound)   ← 第一次 turn 触发点
```

**职责归属（事实）**：`[project.scripts]` 入口声明属打包配置；`create_cli_app` 是 `__main__.py`
模块级函数，其内部调用的 `framework.create_cli_app()` 是 `BubFramework` 类方法（两个同名对象需区分）；
参数解析归 typer 库，触发点是 `app()`。

**返回值来源（事实）**：`__main__.py` 的 `app` = `create_cli_app()` 的返回值（`typer.Typer` 实例），
不是函数对象。

**待运行验证**：`bub run` 真实执行时的参数映射（位置参数 message / `--channel` 等）。

## 2. turn lifecycle ①：一次 turn 的开始/结束

**入口与函数序列（事实）**：

```text
process_inbound（framework.py L144，async def → TurnResult），由 cli.py L59 调用
→ L148 resolve_session(inbound)（首个 await 动作）
→ L149-150 若 inbound 是 dict：inbound.setdefault("session_id", session_id)
→ L151 build_state（framework.py L135-142：state 预置 workspace/steering_inbox + 合并 load_state hook 返回）
→ L152 build_prompt（framework.py L117-126：call_first build_prompt hook，缺省取 content_of(message)）
→ L153 model_output = ""
→ L154-163 内层 try/finally
    L155 _run_model（framework.py L186-225：非流式走 run_model hook；流式走 run_model_stream）
    L156-163 finally 无条件 call_many("save_state", ...)（_run_model 抛异常也执行）
→ L165 _collect_outbounds → L166-167 for 逐条 call_many("dispatch_outbound", ...)
→ L168-174 构造并返回 TurnResult(session_id/prompt/model_output/outbounds/state)
```

**中间状态存放（事实）**：`TurnState`（turn.py L10，`type TurnState = dict[str, Any]`，可变 dict）
是 turn 内流转的草稿纸；`TurnResult`（turn.py L13-21，frozen dataclass）是不可变交付物，
含 state 快照。

**结束分支三条（事实/机制判定）**：

| 分支 | 路径 | 结果 |
|---|---|---|
| 正常 | L168-174 | return `TurnResult` |
| 普通异常 | 内层 finally 先跑（save_state）→ L175 `except Exception` → L176 logger.exception → L177 notify_error(stage="turn") → L178 raise | 重抛给调用方 |
| 取消 | `asyncio.CancelledError`（Python 3.8+ 继承 `BaseException`）不匹配 `except Exception` → finally 仍落盘 → 直穿到调用方，无 notify_error | 向调用方传播（运行验证属 D4） |

**turn 内部：step 循环**（见 §5 主链 ④）。turn = inbound → TurnResult 的框架层边界；step = turn 内
一次「模型调用 + 可能工具执行」的循环迭代。

**待运行验证**：`CancelledError` 直穿行为（取消时 finally 落盘是否如源码判定）。

## 3. tape 追加 ②：事件类型、时机、不可变与顺序

**数据模型（事实，tape.py，全 frozen dataclass）**：

- `TapeEntry`（L84-129）：字段 id / kind / payload / meta / date。kind 由 7 个工厂方法产生：
  `message`（L97-99，OpenAI 格式 dict）、`system`（L101-103）、`anchor`（L105-110）、
  `tool_call`（L112-114）、`tool_result`（L116-118）、`error`（L121-122）、`event`（L124-129）。
- `TapeContext`（L143-157）：context 选择规则——anchor（`LAST_ANCHOR` 默认 = 最近 anchor 之后 /
  具体名 / None = 全量）、select（自定义覆盖默认）、state。
- `Tape`（L197-535）：持有 store 与 context 的句柄，自身不存数据；追加/读取委托 store。

**追加时机（事实）**：`record_chat` 在模型/工具调用**完成之后**调用：
- 有工具路径：model_runner.py L251（ToolExecutor 执行后）
- 纯文本路径：model_runner.py L270
- `before_llm_call` 返回 decision 直接拦截时：model_runner.py L198（record_chat 替代真实调用）

**一次 record_chat 的追加顺序（事实）**：`record_chat`（model_runner L359-389 → tape.py L323-366）：
`system` → [context_error] → 每条 new_messages（message）→ `tool_call` → `tool_result` → `error`
→ assistant message（response_text）→ `event("run", {status/usage/provider/model})` 汇总条目。

**不可变与顺序（事实/推断）**：TapeEntry/Tape 均 frozen（dataclass(frozen=True)），模块 docstring
「Append-only tape primitives」；id 在工厂方法中为 0，真正 id 由 store append 时分配
（推断：id=0 是占位；store.py 分配逻辑待验证）。

**待运行验证**：store.append 的 id 分配与顺序保证（store.py 未读）。

## 4. context rebuild ③：模型输入如何重建

**入口与链路（事实）**：

```text
每次模型调用前：
model_runner.build_messages（model_runner.py L310-337）
→ L322 tape.read_messages()（tape.py L300-307）
    → L301 context.build_query（anchor 规则：LAST_ANCHOR / 具体名 / None）
    → L302 store.fetch_all(query)
    → L303 过滤 entry.meta["context"] is not False
    → L304 build_messages → L165-173 _default_messages 只挑 kind=="message" 条目
    → 返回 OpenAI 兼容 messages 列表
→ model_runner L333-336：prepend system_prompt（若有）→ append steering + 当前 prompt
```

**结论（事实）**：模型每次拿到的 context 是从 tape 存储**现算重建的投影**，非累积缓存；裁剪策略 =
anchor 规则 + `context=False` meta 过滤。`tool_call` / `tool_result` / `error` / `event` / `system`
kind 不进模型 messages（`_default_messages` 只挑 `message`）。

**待运行验证**：一次真实多 step 会话中，模型 messages 是否确实不含工具中间记录、且 anchor 处
被裁剪。

## 5. model / tool / harness 职责边界 ④：一次模型步的完整链路

**全链路（事实，代码调用顺序）**：

```text
process_inbound（framework.py L144）→ L155 _run_model → L204 hook run_model_stream
→ hook_impl.py L229 run_model_stream → L230 Agent.run_stream
→ agent.py L121 _agent_loop → L192 _stream_events_with_auto_handoff（循环控制核心）
→ L220 _run_once → L341 _run_once_stream → L376 ModelRunner.run
→ model_runner.py L310 build_messages（read_messages 重建 context）→ llm.acompletion
→ 有 tool_calls：ToolExecutor 执行 → record_chat 落盘
→ 无 tool_calls：record_chat 落盘 → final 事件 → loop 判定停止
```

**Agent loop 三个判定点（事实，agent.py L202-309）**：

1. 继续与否（L242）：`should_continue = bool(event.data.get("tool_calls") or event.data.get("tool_results"))`
   —— 模型产出工具调用则继续下一 step；只出文本则停。
2. 停止（L286-296）：`should_continue or= _has_steering_messages(...)`（其他 channel 插话也继续）；
   False 则记 `loop.step status=ok` 并 return。
3. 异常（L243-280）：context length 超限且 auto_handoff 剩余 > 0 → `handoff("auto_handoff/context_overflow")`
   重置 anchor → `next_prompt = prompt` 重试（`MAX_AUTO_HANDOFF_RETRIES` 内）；其他异常记 `loop.step`
   status=error 后 `raise`。
   兜底：step 数超 `settings.max_steps` → `RuntimeError("max_steps_reached")`（L309）。

**职责归属表（事实）**：

| 对象 | 角色 | 决定什么 |
|---|---|---|
| model（any_llm 抽象） | 输出文本或 tool_calls | 「下一步做什么」的决策者 |
| Tool / REGISTRY / ToolExecutor（tools.py） | 能力注册表与执行器 | 未知工具名 → placeholder Tool 抛错供 hook 恢复（model_runner L504-525） |
| Agent（agent.py） | 编排 step 循环 / 停止 / auto-handoff | 「何时继续 / 停 / 重置」 |
| ModelRunner（model_runner.py） | 单次模型步：重建 context / 调模型 / 执行工具 / record_chat | 「一次模型往返怎么跑完并记录」 |
| BubFramework（framework.py） | turn 边界 / hook 路由 / save_state / collect_outbounds | 「inbound → TurnResult 容器」 |

**关键认知（事实/推断）**：turn 与 step 是两个层级——turn = 一个 inbound → TurnResult（framework
层）；step = turn 内一次「模型调用 + 可能工具执行」循环迭代；一个 turn 通常是多 step 直到模型纯文本
收尾。harness 对 model 与 tool 的调用全部 async（async/await）；tool 执行在模型调用之后、落盘之前。

**待运行验证**：真实会话中多 step 的收敛性（模型反复产出 tool_calls 时只有 max_steps 兜底，
无停滞检测——对照 week7-ai 计划的停滞判据）。

## 6. hook 主链经过部分 ⑤

**注册时机（事实）**：`framework.load_hooks`（framework.py L75-99）——builtin 先注册
（L80 `_load_builtin_hooks` → L64-73 `BuiltinImpl`），entry-point 插件后注册（L81-98）。
实现即 `hook_impl.py` 内 `@hookimpl` 方法（如 L195+）。

**主链调用点（事实）**：build_prompt（framework L121 call_first）/ load_state（L137-138 call_many）/
save_state（L157 call_many，异常也执行）/ run_model_stream（hook_impl L229）/ dispatch_outbound
（L167 call_many）/ continue_prompt（framework L130）/ system_prompt（framework L388）/
build_tape_context（framework L393）。

**能改写什么（主链观察，逐点输入/输出映射——M1 收口，事实；hook 名称均为 runtime 调用名）**：

| hook | 入参 | 出参 / 返回值 | 改写实质 |
|---|---|---|---|
| build_prompt | message（Envelope）+ session_id + state（framework.py L117-126） | str 或 list[dict]（prompt） | 改写模型输入 prompt；缺省取消息内容（call_first） |
| save_state | session_id + state + message + model_output（L157-163） | 无返回值 | 持久化 state；异常路径也执行（finally 内 call_many） |
| before_llm_call | LlmCallRequest（构造 L187-193，调用 L195-196） | LlmCallDecision | 可拦截或替代真实 LLM 调用（L197-208 decision 分支；另有 after_llm_call L212-219） |
| continue_prompt | prompt + tape + state（framework L128-133） | str（下一 step prompt） | 决定下一轮模型输入（多 step 衔接） |
| system_prompt | prompt + state（framework L385-390） | str 块 | 多实现按逆序拼接，构成系统提示 |
| load_state | message + session_id（L135-142） | dict（合并进 TurnState） | 初始化 turn 状态（reversed 顺序 merge） |

此表不改变结论，只把 hook 主链「改写的实质」提前收口，D5 无需从头再核（只核对新增 hookimpl 实现）。

## 7. 闭合问题候选（本人选定后展开：假设 → 源码定位 + 最小实验 → 结论）

> **本日选定：优先 C1（step 循环收敛性）**——理由：可在纯本地 mock 层验证（fake model client 注入
> 固定 tool_calls 序列），不依赖任何外部 provider / 网络，适合 D4 机动时段快速收口。C2/C3 为备选，
> C3 依赖真实模型调用（D4/D5）。

本报告提出的候选方向（2026-09-02，C1 选定已确认）：

- **C1：step 循环收敛性**——`should_continue = bool(tool_calls or tool_results)` 是否存在无停滞检测
  的死循环风险？可证伪假设：让模型反复产出同一工具调用，观察是否只有 `max_steps` 兜底触发。
  验证手段：最小 harness 注入固定 tool_calls 序列（fake model client）。
- **C2：fork_tape 的 merge_back 语义**——`run_stream` 里 fork 的 tape（agent.py L112）在流被提前
  关闭/消费一半时，改动是否与如何写回主 tape？验证：最小实验中途关闭流后读主 tape。
- **C3：anchor 重建的可观测性**——read_messages 过滤后模型是否真的看不到工具中间记录与 `context=False`
  事件？验证：一次真实多 step 会话 dump 每次模型调用前的 messages。

验证时间归属：C1/C2 可 D4 最小实验；C3 依赖真实模型调用（D4/D5）。

## 8. 待运行验证清单汇总（全部属 D4/D5，本报告不完成验证）

- `bub run` 参数映射与真实 turn 执行。
- `CancelledError` 直穿时 finally 的 save_state 是否执行。
- store.append 的 id 分配与顺序保证（store.py 未读）。
- 多 step 会话中 messages 是否不含工具中间记录、anchor 处是否裁剪。
- `max_steps` 兜底：真实触发（agent.py L309 `RuntimeError("max_steps_reached")` 为源码事实；
  待验证的是真实会话中能否触发、触发后调用方如何收到）。
- DeepSeek 模型 ID 拼写与 any_llm provider 默认 base（Bub 接入形态）。

## 9. AI 辅助说明

草稿 v0 由 AI 按本人 2026-09-02 裁定（对话冻结内容整理属 AI 记录员职责）从
`day3-bub-main-chain.md` §8 誊写重组；所有结论的实质判断来自本人先答 + AI 验收，或 AI 陪读讲解后经
本人确认。待本人 review：hook ⑤ 改写能力逐点收口、闭合问题选定与展开、§5 收敛性观察、报告最终结构。
