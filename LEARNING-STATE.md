# 当前学习状态

> 最后更新：2026-09-07（Asia/Shanghai）
> 当前入口：W13 D1，evaluation item 教学示例已完成；新对话从“直接可回答”类的 4 条正式题意开始。
> 本文件只保留当前进度、有效决定、风险和下一步；阶段结论与必要纠错见每日笔记。

## 当前周与目标

- 当前周：**W13（9/7-9/11，RAG Foundations）**。
- 当前 Day：**D1 执行中**。
- 本周目标：在同一冻结 corpus 和 eval 上，对照全语料上下文、BM25 与 dense retrieval；形成可重复运行的
  BM25 RAG demo，并能区分 retrieval、context assembly、Prompt 与 generation 的职责和失败。
- 硬截止：D4 必须先形成稳定 BM25 端到端实现和 demo，再运行 holdout；D5 只做结果分析、失败归因、
  独立讲解和最终展示，不补首次集成或根据 holdout 调参。
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
| dev/holdout | 使用不同文件或目录物理隔离，并共享同一 eval schema；D1-D4 常规开发入口只读取 dev |
| holdout 时间点 | D4 最终冻结实现、Prompt、retrieval 配置、eval 版本和评分规则后首次运行；D5 只分析原始结果 |
| evaluation item | 最少包含稳定题目 ID、完整 query、预期行为及证据要求；预期分支 label 只允许 `answered`、`abstained` |
| 引用判据 | 多个来源可独立完整支持同一 claim 时允许任意一个；citation precision 阈值为 1.0；missing citation 是 item 必须失败条件 |
| eval 覆盖与规模 | dev/holdout 覆盖相同的五类行为，每类各 2 个非等价 items，共 20 题；两套 query 不同 |
| 容量顺序 | 先完成 eval、Prompt/schema 和 serialization，再计量实际输入并冻结最终 context budget |

## 当前主线

1. 本人按一个行为类型一批四题，依次冻结 20 条正式题目的语义；第一批是“直接可回答”类的 dev 2 题和
   holdout 2 题。AI 负责来源定位、JSON、schema、ID 与 hash。
2. 建立物理隔离的 dev/holdout 文件或目录，并冻结版本；AI 不代写题目、标签或核心判据。
3. 本人完成 D1 §4.6 的 RAG Prompt、response schema、citation/abstention 正确性要求和 corpus serialization。
4. 计量实际 serialized input，冻结剩余输入上限与最终 context budget；门禁通过后只在 dev 上运行
   全语料上下文基线。

## 当前阻塞与风险

- evaluation item 的最小功能信息、行为覆盖和 20 题规模已冻结；具体题目、label、metric、其余 threshold 与 passing criteria 尚未建立，
  baseline 当前不得运行。
- response schema、citation identifier 格式、source span 粒度、reason code 枚举和最终 context budget 尚未冻结。
- 当前 AGENTS.md、LEARNING-PROTOCOL.md 和 TECHNICAL-WRITING-PROTOCOL.md 含有 snapshot 冻结后的协作修正；
  它们不回填 `rules-c0a4b85`，正式 eval 只能引用冻结版本中的内容。
- 复用客户端尚未验证请求中显式发送 `thinking: disabled`；接线验证前不得运行 baseline。
- 中文 BM25 预处理、chunk 方案和 dense runtime/质量均待后续实测；dense 失败不阻塞 BM25 demo，但 W13
  dense 范围必须按证据标为完成、失败或未验证。
- 仓库 Markdown 扩展语料是条件扩展；D1 主线未完成时不启动，也不顺延占用 D2-D5。

## 下一步

**新对话立即执行**：由本人一次给出“直接可回答”类的 dev 2 题与 holdout 2 题，只写 query、预期规则结论
和来源思路；教学示例中的 Docker 题明确排除，不得复用。

## 验收证据

- snapshot manifest：[`manifest.json`](week13-rag/corpus/rules-c0a4b85/manifest.json)
- raw token 估算：[`token-count-rules-c0a4b85.json`](week13-rag/evidence/token-count-rules-c0a4b85.json)
- W13 周计划：[`week13-plan.md`](week13-rag/notes/week13-plan.md)
- D1 阶段结论、证据与必要纠错：[`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)
- W12 最近一次完整验证：pytest 30 passed，`src` 行覆盖率 97.89%，mypy 对 9 个源文件通过。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week13-plan.md`](week13-rag/notes/week13-plan.md)。
3. [`day1-corpus-freeze-and-baseline.md`](week13-rag/notes/day1-corpus-freeze-and-baseline.md)。
4. 当前任务相关的 `git status --short` 与 diff。

## AI 辅助记录与延迟重建

- W13 当前为导师模式。AI 已提供 L1 术语与边界讲解，并对白名单 snapshot、token 证据和文档同步做机械处理；
  未代写 eval 题目、Prompt、retrieval、context assembly 或核心断言。
- D1 笔记已从逐轮问答日志压缩为阶段性记录；后续只在结论、证据、决定或下一入口变化时更新。
- AI 已用一条明确排除在正式题集之外的 Docker 白名单题解释 evaluation item 的完整形状；属于 L1 任务模型
  讲解，不提供正式题库语义。
- 当前无活动中的 `DEBT.md` 欠债；W13 尚未触发新的 L2 援助或延迟重建。
