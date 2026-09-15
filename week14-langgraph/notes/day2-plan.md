# W14 D2 日学习计划：LangChain/LangGraph 概念与最小 StateGraph 接线

> 日期：2026-09-15。D2 原定恢复 D1 入口并进入 graph wiring；因临时面试占用学习时间，本日压缩为一个下午
> 可完成的 LangChain/LangGraph 概念学习 + 最小确定性 StateGraph 接线。task contract、baseline、
> trace/verifier 与真实 RAG 接入仍顺延，不在本日展开。

## 今日目标

今日唯一主线是理解 LangGraph 的状态编排职责，并跑通一个不依赖真实模型/检索的最小 StateGraph。完成对象是
「概念讲清 + 确定性图可运行」，不冻结 W14 的 task contract、terminal-state 或 trace/verifier 语义。

### 计划调整（2026-09-15）

- **唯一主线：LangChain/LangGraph 概念 + 最小 StateGraph 确定性接线。** 先讲清 LangChain（组件/模型）与
  LangGraph（状态编排/控制流）的职责分界，再跑一个最小图：`state → node → conditional edge → compile/invoke`，
  记录一次走 A 分支、一次走 B 分支的 state 流转结果。
- **前置（几分钟）：** 检查 D1 复习口述与 `w13-eval-debt-rebuild-01` 状态；未完成不卡今天主线，继续顺延。
- **顺延到 D3：** `w14-task-contract-v1`、`w14-fixed-baseline-run-01`、`w14-trace-verifier-contract-v1`、
  terminal-state enum 冻结、真实 RAG 接入 graph（retrieve/generate/verify node）与 LangGraph wiring。

### 完成对象

1. 一份 LangChain vs LangGraph 职责说明：为什么 W13 的固定 LangChain 链是「组件」，W14 需要 LangGraph 的是
   「状态如何沿边传递、conditional edge 如何决定下一步、何时终止」。
2. 一个最小可运行 StateGraph（确定性，不调模型、不检索）：
   - state 用 `TypedDict` 定义字段；
   - 若干 node 读改写 state；
   - 一条 conditional edge 依据 state 字段返回下游节点名；
   - `compile()` 后 `invoke()`，记录一次走 A 分支、一次走 B 分支的 state 流转结果。
3. 一句口述：state、node、edge、conditional edge、compile/invoke 各自的输入输出与职责。

### 开工前边界

- 本日最小图不接真实 RAG 检索/生成，不调 DeepSeek，不引入 ChatModel/LCEL。
- 不冻结 W14 的 task contract、工具权限、终止/停滞判据、trace/verifier 字段——这些仍由本人后续冻结。
- 不读取或运行受保护 holdout；不改 W13 Prompt、阈值或历史 evidence。

## 术语导览

今天只讲 LangGraph 最小控制流需要的对象：`StateGraph`、`State`（`TypedDict`）、`node`、`edge`、
`conditional edge`、`compile`、`invoke`。先解释各自解决的问题、输入输出和职责，再进入最小 demo；
不扩展到 tool loop、checkpointer、multi-agent。

## 执行顺序

1. 概念：LangChain（组件）与 LangGraph（编排）的分界；StateGraph/State/node/edge/conditional edge/compile/invoke。
2. 最小 demo：确定性 StateGraph 骨架，跑通两条分支。
3. 验证：记录两次 invoke 的 state 流转结果，确认 conditional edge 判定正确。

## 今日不做

- 不实现 LangGraph loop、tool、checkpointer、durable memory 或真实 RAG 节点。
- 不冻结 task contract、baseline、trace/verifier 或 terminal-state enum。
- 不修改 W13 代码、Prompt、eval 或历史 evidence。

## 止步条件与下一入口

今日止步条件是：能讲清 state/node/edge/conditional edge/compile/invoke 的职责，且最小图两次 invoke 的分支
结果可复核。task contract、baseline、trace/verifier 与真实 RAG 接入从 D3 继续。

## 验收记录模板

```text
事实：
本人判断：
操作与证据：
结论：
仍未证明：
下一入口：
```

参考：[W14 周计划](./week14-plan.md)、[D1 计划](./day1-plan.md)、[当前状态](../../LEARNING-STATE.md)。
