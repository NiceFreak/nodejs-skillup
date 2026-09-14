# W14 D1 日学习计划：从固定 RAG 到 Agent 控制契约

> 日期：2026-09-14。D1 主线是复习固定 RAG 与 LangChain；不因 W13 未完成而重开整周 RAG，也不在语义未冻结前实现 LangGraph。

## 今日目标

今日调整为 RAG 基础与 LangChain 复习日。主线是能从输入到评估讲清固定 RAG 链路、LangChain 组件职责和当前证据边界；原 W14 D1 的契约、baseline 与 trace/verifier 工作 D2 继续，不把复习结果写成 W13 质量或 W14 掌握通过。

### 计划调整（2026-09-14）

- **唯一主线：RAG / LangChain 复习与口述验收。** 复述 `query → Document/metadata → retriever（BM25 或 dense）→ context assembly → generation/parser → citation/abstention → eval`，逐段说明输入、输出、职责和失败归因；说明 `Document`、`BM25Retriever.from_documents()`、`Embeddings` adapter、`InMemoryVectorStore` 与项目 HTTP generation client 的映射，并明确 ChatModel、LCEL、LangGraph 尚未接入。
- **附加项：活动债务第一档重建（15–20 分钟）。** 复述 `answered` / `abstained` 的合取判定、检索命中与证据支持的区别，并修改一个失败状态后预测受影响的 verifier 条款。
- **顺延到 D2：** `w14-task-contract-v1`、`w14-fixed-baseline-run-01`、`w14-trace-verifier-contract-v1` 及 LangGraph wiring。D2 从这些未完成入口继续；不因日期变化直接进入 graph wiring。

### 复习完成对象

1. 一张固定 RAG 数据流草图或口述稿：为每一段写出输入、输出、职责，以及 retrieval miss、context 不足、parser/schema 失败分别应归因到哪一层。
2. 一份 LangChain 映射说明：解释 `Document`、`BM25Retriever.from_documents()`、`Embeddings` adapter、`InMemoryVectorStore` 与项目 HTTP generation client 如何衔接；同时列出 ChatModel、LCEL、LangGraph 尚未接入的边界。
3. 一轮模拟问答口述：覆盖成功路径、证据不足或检索失败、结构化输出失败、BM25 与 dense 的取舍，以及一个需求变更会影响哪些组件和验证证据。

### 开工前边界

- W13 最低接口已满足：LangChain retrieval + 项目生成客户端的固定链路、冻结题集、citation/abstention 和失败分层证据可复核；这不表示已接入 ChatModel/LCEL。
- W13 完整质量验收、dense 完整对照的质量结论、D5 根因隔离与本人掌握验收仍未完成；这些是边界与后续诊断输入，不是 W14 的隐藏通过条件。
- 只使用 dev 和已保存的非保护证据；不读取或运行 holdout，不改 W13 Prompt、阈值或历史 evidence。

## 术语导览

第一次设计前逐项解释以下对象的问题、输入、输出和职责：Agentic Workflow、state、context、trace、tool contract、structured output/function calling、conditional edge、termination、stagnation、budget、verifier、deterministic replay、session state、reset/isolation、abstention。先给一个排除在正式交付之外的完整示例，再由本人冻结正式字段和判据；JSON 排版、稳定 ID、hash 等机械工作可由 AI 完成。

## 执行顺序与 completion objects

### 1. `w13-eval-debt-rebuild-01`（附加项，15–20 分钟）

本人只看一页笔记，复述：

1. `answered` 与 `abstained` 的合取判定如何处理结构前置失败。
2. 检索命中、citation 可解析、claim support、evidence coverage 分别能证明什么。
3. “失败归因”如何保持为待验证假设，而不是直接写成根因。

随后修改一个合理失败状态，预测受影响的判定条款，并给出一条可证伪 verifier 检查。未通过时记录卡档，停止进入 Agent wiring。

### 2. `w14-task-contract-v1`（D2 顺延）

本人冻结当前 `technical-v2` dev 的模型适用 slice（`w13-v2-dev-04`、`07`、`08`、`09`）作为 D1 baseline：使用 `week13-rag/scripts/run-technical-v2-langchain-e2e.py` 的固定入口，fixture-only item 不送模型，也不新建题目。契约记录 query、最小成功行为、expected branch、只读工具权限、输入输出、预算、终止/停滞判据和 verifier 判据。它必须能回答“何时调用工具、何时停止、什么结果算证据不足”，但不预设模型会怎样回答。

### 2.1 目标任务对 demo contract 的记录

本周可见的最小行为候选为：

- `search_presence`：在限定的 `technical-v2` 笔记视图中判断主题是否有足够证据，返回状态、命中 `source_id`、位置和证据片段。`not_found_in_current_notes` 不能解释为所有资料中不存在。
- `generate_quiz`：基于检索到的笔记生成题目、参考答案和引用。当前 `rag-prompt-v1` 没有 quiz 输出契约，因此需要独立 prompt、schema 和 runner；题目类型、数量、参考答案和通过判据仍待本人冻结。

这两个行为不写入 `w13-eval-v2-dev`，也不把当前 11 文件 technical-v2 快照称为全部个人学习笔记。PPT（deck）只记录已验证的固定链路、demo 行为和边界；不把 PPT 或展板作为质量通过证据。

### 3. `w14-trace-verifier-contract-v1`（D2 顺延）

本人冻结最小 trace 字段：task/version、trial、step、state transition、tool request/result、context/source identity、model/parser status、终态与 verifier reason。本人还要冻结 terminal-state enum 及其 verifier 关系；`answered`、`abstained`、`tool_error`、`cancelled`、`budget_exhausted`、`stagnated` 仅作讨论起点。字段具体命名和敏感内容边界由本人确认；trace 只记录必要的脱敏数据。

### 4. `w14-fixed-baseline-run-01`（D2 顺延）

使用同一 W13 固定 RAG 入口运行一次非 Agent baseline。计划命令为：

```bash
mkdir -p week14-langgraph/evidence
week13-rag/.venv/bin/python week13-rag/scripts/run-technical-v2-langchain-e2e.py \
  --items week13-rag/eval/v2-dev/items.json \
  --out week14-langgraph/evidence/w14d1-baseline-01.json
```

只读取输出中 `w13-v2-dev-04`、`07`、`08`、`09` 的模型适用记录；fixture-only item 保持 `actualModelInput=not_run`。记录 task/corpus/Prompt/model/version、retrieval hits、context hash、response branch、schema/parser 状态、citation/abstention、latency/usage（可得时）和失败原因。成功只证明 baseline 可运行，不证明 Agent 必要或质量通过；模型或依赖不可用时保留错误证据并把 baseline 标为未完成。

## 今日不做

- 不实现 LangGraph loop、MCP、durable memory 或 SDK adapter。
- 不修复所有 W13 retrieval/generation 问题，不建立新 holdout，不修改历史 evidence。
- 不替本人决定工具权限、终止/停滞判据、trace 语义、verifier 通过条件或 Prompt 假设。
- 不在 D1 直接实现 `generate_quiz`，不修改 W13 冻结 Prompt/eval；先完成任务契约和 baseline，再由本人确认独立出题契约。
- 不在 D1 执行新的 task contract、baseline、trace/verifier 或 LangGraph wiring；不新增复习范围外的 RAG 组件。

## 止步条件与下一入口

今日止步条件是：完成一次 RAG/LangChain 链路口述，覆盖一条成功路径、一条证据不足或检索失败路径、一条结构化输出失败路径，并说清 BM25 与 dense 的取舍和一个需求变更会影响哪些层；活动债务重建若未完成则记录卡档并顺延。无论复习是否完成，task contract、baseline、trace/verifier 与 LangGraph wiring 均在 D2 起继续，不把日期变化写成已进入 LangGraph。

## 验收记录模板

```text
事实：
本人判断：
操作与证据：
结论：
仍未证明：
下一入口：
```

参考：[W14 周计划](./week14-plan.md)、[W13 D5→D6 对接](../../week13-rag/notes/day6-d5-facts-and-d6-bridge.md)、[当前状态](../../LEARNING-STATE.md)。
