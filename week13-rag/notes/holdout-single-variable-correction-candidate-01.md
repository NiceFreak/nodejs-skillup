# technical-v2 holdout 单变量修正候选

## 状态

候选方案，未应用、未冻结、未运行。首次 holdout 结果和题集保持不变。

## 目标

验证首次运行中 evidence coverage 缺口是否来自模型没有逐项展开题目的最小充分证据，而不是 retrieval、context assembly、schema 或 citation resolution 失败。

## 唯一变量

只改变 Prompt system instructions：新增一条“逐项覆盖 evidence requirement”的生成要求。query、technical corpus、retrieval、context assembly、response schema、评分规则和阈值全部保持不变。

候选指令（待 owner 确认后才能进入新的 Prompt 版本）：

> 对 answered 查询，逐项检查问题要求的每个独立事实；每个事实都必须在一个或多个 atomic claim 中明确写出，并为该 claim 提供实际支持它的 source ID。不要只给出部分参数、边界或定位结论；如果 Evidence Context 无法支持全部必要事实，返回 `abstained`。

## 可证伪预测

在同一 technical snapshot、同一冻结 holdout 题集和同一 retrieval/context 配置下，若该指令是主要缺口，下一轮应减少“遗漏最小充分证据组成”的 evidence coverage failure；若失败保持不变，则继续检查 query 设计、context 内容或模型服务行为。

## 不改变的对象

- 不改 `eval/v2-holdout/items.json`、source block、expected branch、candidate criteria、阈值或旧 v1 资产。
- 不把候选指令写入当前冻结的 `rag-prompt-v1.md`。
- 不使用首次 holdout 结果调参；新的运行必须先建立新的 Prompt 版本、dev 回归证据和 owner 的运行授权。
- LangGraph state、retry、termination、trace 仍不属于本轮验证对象。

## 下一入口

owner 只需确认是否接受这一条 Prompt 变量作为新的实验假设；确认后在同一 technical-v2 dev 集上先做 Prompt candidate 回归，再决定是否建立新的 holdout regression 节点。
