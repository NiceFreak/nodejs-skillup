# W12 Demo 讲稿：一次 tool call 为什么不等于 Agent

> 建立：2026-09-05；v0.2 根据本人反馈重写。
>
> 状态：待本人 review 与浏览器彩排。
>
> 主讲约 6 分钟，预留 2-3 分钟追问。Python 基础只作开场背景，主体只讲 AI 工程知识。
>
> 动线与初稿由 AI 整理，事实来自 W12 笔记和当前展板；最终表达判断与现场讲述归本人。

## 0. 核心问题

> 一次返回 tool call 的模型请求，为什么还不等于一个 Agent？

本周通过最小 DeepSeek 工具调用和 Bub `33c417a` 源码阅读，得到三个区分：

1. model、tool 与 runtime 的职责不同。
2. Agent 需要在每个 step 后重新判断继续还是停止。
3. 模型看到的 context 是从记录中重建的输入，不等于完整历史。

## 1. 展示动线

把 `{SHOWCASE_BASE}` 替换为彩排当天实际可用的根地址，依次打开三页：

| 页面 | 深链 | 结论 |
|---|---|---|
| B5 职责边界 | `{SHOWCASE_BASE}/#/showcase?mode=demo&tab=ai-engineer&topic=roles-nesting` | tool call 只完成决策，完整链路还需要执行、继续和持久化 |
| B4 step 循环 | `{SHOWCASE_BASE}/#/showcase?mode=demo&tab=ai-engineer&topic=step-loop` | Agent 的动态性来自逐步判定，不是固定工作流 |
| B3 tape → context | `{SHOWCASE_BASE}/#/showcase?mode=demo&tab=ai-engineer&topic=tape-context` | tape 是记录源，context 是每轮模型调用前重建的投影 |

```text
谁负责什么 → 为什么继续 → 下一轮看见什么
```

## 2. 六分钟讲稿

### 0:00-0:30 开场

**页面动作**：停在 AI 工程板头。

> 这周我先了解了 Python 的语法、类型、异步和资源管理，用这些基础进入真实 AI 工程源码。Python 不是
> 今天的重点。我想展示的是：一次能返回 tool call 的模型请求，为什么还不等于一个 Agent？

### 0:30-2:00 B5：先把职责拆开

**页面动作**：进入 B5，指两列四行的职责矩阵。

> 左侧是本周跑通的最小 DeepSeek tool call。模型决定调用什么，调用方手工执行函数，然后程序结束。
> 它没有把结果回灌给模型，也没有继续循环或持久化记录。
>
> Bub 右侧把职责分开：model 决定，ToolExecutor 执行，Agent 决定是否继续，ModelRunner 和 tape 负责
> 记录。模型会调用工具，只说明它完成了决策这一环，不代表外面的 Agent runtime 已经成立。

**转场**：

> 当“继续”成为独立职责，下一步就要看 runtime 根据什么做这个判断。

### 2:00-4:00 B4：Agent 在每个 step 后重新判断

**页面动作**：进入 B4，先讲常规区，再指异常恢复与循环边界。

> 一个 step 完成后，如果有 tool_calls 或 tool_results，循环继续；没有时才检查 steering，三者都没有才
> 返回。下一步不是预先写死的，而是由这一轮结果和运行时状态决定。
>
> 上下文超长时，有剩余预算就重置 anchor 后重试，否则抛出异常。达到 `max_steps` 后仍要求继续，也不会
> 凭空多出一步，而是循环耗尽并报错。这些边界让模型驱动的循环仍然可控。
>
> 本周的等价实验验证了重复 tool call 在 step 3 后耗尽、文本对照组在 step 2 返回。实验没有覆盖 Bub
> 本体、tool_results、steering 或 auto_handoff，这些仍是待验证项。

**转场**：

> 每个 step 都可能再次调用模型，因此最后要问：下一轮模型实际看到了什么？

### 4:00-5:40 B3：记录不等于模型输入

**页面动作**：进入 B3，沿 tape → 筛选/渲染 → 本轮输入 → model → append 的方向讲。

> Bub 把历史追加到 tape，但不会把整份 tape 原样交给模型。每次调用前先按 anchor 取范围，过滤
> `context=False`，再由 selector 把记录渲染成 messages。
>
> 默认 `_select_messages` 会保留或转换 message、tool_call、tool_result 和 anchor，丢弃 system、error、
> event；历史投影还要与本轮 system prompt、steering 和 prompt 合并，才是模型真正收到的输入。
>
> 所以 tape 是记录源，context 是每轮现算的输入投影。这个结论来自源码；真实多 step messages dump
> 还没有运行，不能把它表述成运行观察。

### 5:40-6:00 收束

**页面动作**：留在 B3。

> 本周最重要的 AI 工程认识是：Agent 不只是模型加工具。还要明确职责、控制 step 循环，并管理每轮模型
> 能看到的 context。Python 是进入这些问题的工具，这三个区分才是本周 Demo 的主体。

## 3. 一页提示词

```text
开场  Python 只是阅读基础
      一问：tool call 为什么不等于 Agent？

B5    decide / execute / continue / persist
      最小 demo 只有决定 + 手工执行

B4    tool 或 steering → continue；都没有 → return
      context overflow 有预算才恢复；max_steps 控制耗尽

B3    tape = 记录源
      context = anchor + context=False 过滤 + selector + 本轮输入
      默认四类进入、三类丢弃

收束  Agent = 模型能力 + 职责边界 + 循环控制 + context 管理
```

## 4. 追问边界

- **为什么不演示 Python 代码？** Python 是本周的阅读和实验基础；本次 Demo 选择展示可迁移的 AI 工程认识。
- **这已经是完整 Agent 实现吗？** 不是。本周阅读 Bub 并运行最小实验，没有实现自己的 loop、终止状态机、trace、verifier 或 eval。
- **B5 对照是什么证据？** 最小调用是本人实测，Bub 侧是源码事实；跨系统职责对齐属于推断。
- **为什么不主讲 turn/save_state？** 它是 Bub runtime 的重要细节，但不影响本次“职责、循环、context”主结论；有追问时再打开 B2。

## 5. 彩排验收

- [ ] 三个深链按 B5 → B4 → B3 顺序打开，标题正确。
- [ ] Python 背景不超过 30 秒，不展开语法、测试数或覆盖率。
- [ ] 每页只讲一个结论，不打开折叠证据或源码行号。
- [ ] 只看一页提示词，在 6 分钟左右完成。
- [ ] 主动区分事实等级：B5 跨系统对齐是推断；B4 是等价实验；B3 真实 dump 未做。
- [ ] B3 人工验收通过后再正式演示，不能用讲稿替代图形回忆。

通过条件：听众能复述“职责 → 循环 → context”关系；Python 没有抢占主体；事实、推断和待验证项没有
混写。

## 6. 事实来源

- 职责边界：`day4-async-and-real-calls.md` §11 §6.2、`bub-reading-report.md` §5。
- step 循环：`bub-reading-report.md` §5、`day4-async-and-real-calls.md` §11 C1。
- context 重建：`bub-reading-report.md` §4。
- 展板数据：`week8-fullstack/src/frontend/src/aiEngineerTopics.ts` 的 B3-B5。
