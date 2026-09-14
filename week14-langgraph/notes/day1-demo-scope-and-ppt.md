# W14 D1 实际记录：最小 demo 与 deck 交付边界

> 日期：2026-09-14（Asia/Shanghai）。本记录收录本轮目标任务与分享交付对齐结论，不把新增交付要求写成已经实现的功能。

## 摘要

本周继续 LangChain/LangGraph 学习，但深度探索必须绑定目标任务。当前把 `technical-v2` 的两个用户可见行为列为独立 demo 候选：在限定的笔记语料中判断主题是否有足够证据，以及基于检索到的笔记生成带来源的题目。本周还需把成果整理为可供他人独立阅读的 PPT（deck）。固定 RAG 先作为 non-Agent baseline，LangGraph 只在动态路由、证据不足停止、校验或终止等需求有可证伪依据时进入。

## 目标

- 记录本轮目标任务与分享交付对齐对本周交付形态和优先级的影响。
- 把两个 demo 行为与 W14 既有的 baseline、tool contract、state、trace 和 verifier 分开对齐。
- 明确 demo、可视化展板和 deck 的证据边界。

## 操作

- 阅读当前 `LEARNING-STATE.md`、W14 周计划与 D1 计划，核对 W13 固定 RAG 的实际接口和 W14 的开始条件。
- 查看 `technical-v2` manifest 与现有生成契约，确认笔记范围和出题能力不能从当前文件或 `rag-prompt-v1` 自动推出。
- 将本轮对齐结论转换为一个独立的 demo/PPT 交付约束，不修改 W13 冻结 eval、Prompt 或历史 evidence。

## 观察

- 当前 `technical-v2` 是 11 个固定文件的快照，其中只有 4 个 W13 学习笔记；它不能直接代表全部个人学习笔记。
- 现有 registry 与 runner 尚未证明已经按 manifest 的 `category` 过滤；“只查 learning-note”是待冻结、待实现的 corpus view/检索契约，不是当前已有行为。
- 已有固定链路为：`query → LangChain retrieval → Evidence Context → generation/parser → citation 或 abstention`。它可以作为两个 demo 行为的技术基础。
- 当前 `rag-prompt-v1` 只覆盖 answered claims / abstention，没有题目、参考答案和引用的 quiz 输出契约。
- W14 D1 已要求先完成重建、任务契约和非 Agent baseline，再进入 LangGraph wiring。

## 结论

- W14 主线可以继续推进；新增 demo 需求不把 W14 改回无边界的 W13 RAG 重做。
- `search_presence` 的候选输出是当前 corpus 范围内的证据状态、命中来源、位置和片段；`not_found_in_current_notes` 不能解释为所有资料中不存在。
- `generate_quiz` 的候选输出是题目、参考答案和来源；题目类型、数量、质量判据和证据不足分支仍需本人冻结。
- PPT（deck）作为独立阅读材料，至少说明目标任务、最小行为、固定数据流、LangChain/LangGraph 职责、成功与证据不足案例、指标和未证明边界。PPT 与展板都是阅读入口，不是质量或掌握通过证据。

## 边界

- 两个 demo 行为不加入 `w13-eval-v2-dev`，不改写 W13 的冻结 Prompt、阈值、holdout 或历史 evidence。
- 当前只记录候选 contract；尚未实现 `search_presence` 或 `generate_quiz`，也尚未冻结出题 schema、参考答案和引用判据。
- 固定链路可作为 demo 基础不等于 RAG 质量、生产可用性或 LangGraph 能力已经通过。

## 下一入口

先完成 `w13-eval-debt-rebuild-01`、既有 technical-v2 dev baseline 和 W14 控制层契约；随后由本人冻结 learning-note corpus view 与两个 demo 的独立输出契约，再决定 LangGraph 是否解决了固定链路无法解释的控制问题。
