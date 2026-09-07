# 当前学习状态

> 最后更新：2026-09-08（Asia/Shanghai）
> 当前入口：W13 D2 只冻结 eval 契约；从“直接可回答”类剩余 3 条正式题意开始，不启动 Prompt 或 BM25。
> 本文件只保留当前进度、有效决定、风险和下一步；阶段结论与必要纠错见每日笔记。

## 当前周与目标

- 当前周：**W13（9/7-9/11，RAG Foundations）**。
- 当前 Day：**D2（eval 契约）**。
- 原完整 W13 验收边界包含全语料上下文、BM25、dense 与 holdout；当前本周执行目标是先冻结 eval、完成
  全语料上下文基线，再按门禁推进 BM25 retrieval 与端到端链路。未进入的阶段如实记为未完成，不压缩前置学习。
- 本周执行边界：按 eval -> 全语料上下文基线 -> BM25 retrieval -> BM25 端到端的门禁顺序推进；某阶段
  未完成时，下一学习日继续该阶段，不把后续任务叠加。dense 与首次 holdout 不排入本周当前日程。
- D5 时间边界：17:00 前仍是正常学习窗口，继续当时所在阶段；17:00 分享已经验证的实际进度和边界。
  分享不等于完整 W13 技术验收，排练不得挤占前置学习。
- 五周主线：W12 Python/Bub -> W13 RAG -> W14 Agent -> W15 MCP -> W16 reliability/evals。

## 最近完成

- W12 已收口：Python 3.12 项目基线、Bub 主链阅读、真实 DeepSeek 调用、timeout/cancellation 实验、
  独立诊断与类 2 债务重建均完成；详细结论见
  [`day5-diagnosis-and-wrapup.md`](week12-python-rag/notes/day5-diagnosis-and-wrapup.md) 和
  [`day6-low-intensity-review.md`](week12-python-rag/notes/day6-low-intensity-review.md)。
- W13 规则文档语料 snapshot 已冻结：source commit
  `c0a4b85c9065cbfb943584c914172d7819339791`，7 个文件，76,149 bytes；manifest 与 7/7 来源回比通过。
- DeepSeek 官方离线 tokenizer 示例在 `transformers 4.57.6 / tokenizers 0.22.2` 下通过 7/7 文档回环；
  raw corpus-only 结果为 **18,680 estimated tokens**。
- D1 的 corpus/snapshot、retrieval、context window/context budget、usage、citation、eval 与失败阶段等
  前置讲解已完成；这表示可以进入契约设计，不表示相关能力已经完成独立验收。
- “直接可回答”类 `dev-1` 题意已由本人确认：query 询问 JWT 签发与验证流程的最高援助级别，预期分支为
  `answered`，预期规则结论为 L2；正式 eval schema、ID、source span identifier 和 hash 尚未创建。
- D1 于 9/7 收工时判定未完成：eval 仅完成 1/20 题意，RAG Prompt、完整输入容量门禁、全语料上下文
  baseline 和 RAG 必要性结论均未形成。

## 已冻结决定

| 对象 | 当前决定 |
|---|---|
| corpus snapshot | `rules-c0a4b85`；仅包含七份规则文档；第一道 eval 题建立前已冻结 |
| generation 配置 | `deepseek-v4-flash`；Chat Completions；`thinking: disabled`；三条对照保持一致 |
| token 估算 | DeepSeek 官方离线 tokenizer 示例为主，字符比例只作粗粒度交叉检查；结果标为 estimate |
| 输出预留 | `reserved output / max_tokens = 4096`；是共同上限，不要求每次用满 |
| 安全余量 | 固定 `100000` tokens；10% 只记录本次选值依据，未来窗口变化不自动重算 |
| 回答契约 | answered/abstained 两个互斥分支；answered 最多 10 条 atomic claims，每条关联 citation identifiers |
| 引用边界 | citation identifier 由本地 registry 映射到冻结 source span；映射存在不等于原文支持 claim |
| 拒答边界 | abstained 返回受控 reason code 与简短 reason text；模型不自行判定系统根因 |
| dev/holdout | 使用不同文件或目录物理隔离，并共享同一 eval schema；所有常规开发入口只读取 dev |
| holdout 时间点 | 不排入 W13 当前日程；实现、Prompt、retrieval 配置、eval 与评分规则全部冻结后才能首次运行 |
| evaluation item | 最少包含稳定题目 ID、完整 query、预期行为及证据要求；预期分支 label 只允许 `answered`、`abstained` |
| 引用判据 | 多个来源可独立完整支持同一 claim 时允许任意一个；citation precision 阈值为 1.0；missing citation 是 item 必须失败条件 |
| eval 覆盖与规模 | dev/holdout 覆盖相同的五类行为，每类各 2 个非等价 items，共 20 题；两套 query 不同 |
| 容量顺序 | 先完成 eval、Prompt/schema 和 serialization，再计量实际输入并冻结最终 context budget |

## 当前主线

**唯一完成对象**：按 [`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)
形成版本明确、dev/holdout 物理隔离且可被确定性读取的 eval 契约。

1. 本人按一个行为类型一批四题冻结剩余 19 条正式题目的 query、预期分支和规则结论；AI 核对冻结来源并
   处理 source span、JSON、schema、ID 与 hash。
2. 本人冻结 metrics、thresholds、item-level passing criteria 与整套 eval 的 passing criteria。
3. 验证 dev/holdout 数量与行为覆盖、ID 唯一性、schema、source span、hash 和读取隔离；本日不运行模型。

## 当前阻塞与风险

- evaluation item 的最小功能信息、行为覆盖和 20 题规模已冻结；仅 1/20 题意完成，具体 label、metrics、
  其余 thresholds 与 passing criteria 尚未建立，baseline 当前不得运行。
- eval schema、citation identifier 格式、source span 粒度、metrics、thresholds 与 passing criteria 尚未冻结。
- RAG response schema、reason code 枚举、serialization 和最终 context budget 尚未冻结；这些属于 eval
  契约通过后的下一阶段，不并入 D2。
- 当前 AGENTS.md、LEARNING-PROTOCOL.md 和 TECHNICAL-WRITING-PROTOCOL.md 含有 snapshot 冻结后的协作修正；
  它们不回填 `rules-c0a4b85`，正式 eval 只能引用冻结版本中的内容。
- 复用客户端尚未验证请求中显式发送 `thinking: disabled`；接线验证前不得运行 baseline。
- 中文 BM25 预处理和 chunk 方案待后续实测；dense 与首次 holdout 已移出本周当前日程，W13 收口时必须
  如实标为未完成或未验证，不能因此声称完整周验收通过。
- 仓库 Markdown 扩展语料是条件扩展；D1 主线未完成时不启动，也不顺延占用 D2-D5。
- D2 只冻结 eval。门禁通过后，D3 目标才是 RAG Prompt、response schema、serialization、容量判断和
  全语料上下文 baseline；D4 目标才是 BM25 retrieval。任何阶段未完成都顺延当前阶段，不叠加后续任务。
- D5 17:00 前根据实际门禁继续学习；只有 BM25 retrieval 已通过才进入 BM25 端到端链路。展示仅使用届时
  已验证的证据，不为凑演示跳过依赖或扩大 AI 援助。
- 学习展板与主线解耦，周末有余力时再整理；它服务下次 D1 展示与个人复习，不作为本周技术验收条件。

## 下一步

**立即执行**：读取 D2 工作表 §3 后，由本人一次给出“直接可回答”类剩余 `dev-2`、`holdout-1`、
`holdout-2` 三条题意，只写准确 query 和一条预期规则结论；结论可标注存疑，由 AI 依据 snapshot 核对。
教学示例中的 Docker 题明确排除，不得复用。

## 验收证据

- snapshot manifest：[`manifest.json`](week13-rag/corpus/rules-c0a4b85/manifest.json)
- raw token 估算：[`token-count-rules-c0a4b85.json`](week13-rag/evidence/token-count-rules-c0a4b85.json)
- W13 周计划：[`week13-plan.md`](week13-rag/notes/week13-plan.md)
- D1 阶段结论、证据与必要纠错：[`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)
- D2 eval 契约计划与门禁：[`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)
- W12 最近一次完整验证：pytest 30 passed，`src` 行覆盖率 97.89%，mypy 对 9 个源文件通过。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week13-plan.md`](week13-rag/notes/week13-plan.md)。
3. [`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)。
4. [`day2-freeze-eval-contract.md`](week13-rag/notes/day2-freeze-eval-contract.md)。
5. 当前任务相关的 `git status --short` 与 diff。

## AI 辅助记录与延迟重建

- W13 当前为导师模式。AI 已提供 L1 术语与边界讲解，并对白名单 snapshot、token 证据和文档同步做机械处理；
  未代写 eval 题目、Prompt、retrieval、context assembly 或核心断言。
- D1 笔记已从逐轮问答日志压缩为阶段性记录；后续只在结论、证据、决定或下一入口变化时更新。
- AI 已用一条明确排除在正式题集之外的 Docker 白名单题解释 evaluation item 的完整形状；属于 L1 任务模型
  讲解，不提供正式题库语义。
- `dev-1` 的对象、判断维度和预期结论由本人提出；AI 只核对冻结来源并整理记录。D2 继续保持同一所有权边界。
- 当前无活动中的 `DEBT.md` 欠债；W13 尚未触发新的 L2 援助或延迟重建。
