# 事故复盘 · 2026-09-08 W13 holdout 内容进入 AI 上下文

> 复盘性质：评测边界事故，非生产事故。对事不对人，只查机制。
>
> 分工：事实时间线与影响范围由 AI 整理；**根因、预防、经验教训由本人分析，AI 只誊抄本人结论**。
> 第 5-7 节在本人给出结论前保持空缺，不由 AI 代填。

---

## 1. 一句话摘要

在撰写 Pi agent 引入指南的过程中，AI 先在文档里编造了一条未经核实的试跑建议（让 agent 读取
`week13-rag/`），随后为核实这条建议是否危险，用 `head -c 600` 实际读取了 `week13-rag/eval/holdout/items.json`，
导致 1 条 holdout 题目及其标准答案进入 AI 上下文。没有任何 eval 被运行。

---

## 2. 影响范围

| 维度 | 事实 |
|---|---|
| 触及文件 | `week13-rag/eval/holdout/items.json` |
| 该文件条目总数 | 10 |
| 实际进入上下文的条目 | 1 条，`w13-holdout-direct-answer-01`，含 `query` 与 `expected_rule_conclusion`（读取在 600 字节处截断） |
| 未进入上下文的条目 | 第 2-10 条 |
| 涉及的模型上下文 | 主会话 1 个；review subagent 1 个（其转录中出现的不同 holdout item id 计数为 1，与主会话同一条） |
| 是否运行过 eval | 否。没有模型被用于回答 holdout 题目，dev 也未运行 |
| 文件内容是否被修改 | 否 |
| 代码影响 | 无 |

计数方式：用 `grep -o` 提取 item id 后去重计数，只输出数字，未打印内容。

---

## 3. 时间线（2026-09-08）

| 序号 | 动作 | 性质 |
|---|---|---|
| 1 | 本人要求写一份 Pi agent 的评估与引入指南 | 任务起点，与 eval 无关 |
| 2 | AI 撰写 §6 阶段 B 时，编造试跑任务「让它读 `week13-rag/` 并复述 eval 契约」，并标注为「白名单范围内」 | **第一处错误**：路径与归类均未核实 |
| 3 | 文档提交并推送（commit `7d91d3f`） | 危险指令随文档落盘 |
| 4 | 本人要求开 subagent 审查文档 | — |
| 5 | subagent 检查 `week13-rag/`，报告该建议会污染 holdout | 发现 |
| 6 | AI 为核实该结论，执行 `head -c 600` 读取 holdout items | **第二处错误**：核实动作本身造成污染 |
| 7 | AI 修正文档，加入禁止读取 holdout 的硬约束（commit `f81134f`） | 文本层修复 |
| 8 | 本人追问「写文档为什么会涉及 holdout」 | — |
| 9 | 补机械护栏：`.claude/settings.json` 的 `permissions.deny` 与 PreToolUse hook，`AGENTS.md` 新增禁读区一节 | 机制层修复 |

---

## 4. 契约条款与判定依据

- `week13-rag/eval/scoring-contract.md` 的冻结条款列出的运行无效条件之一是：
  「dev 常规运行读取了 holdout items，或 holdout 在未满足首次运行门禁时被执行」。
- 本次不是 dev 常规运行，也没有执行 holdout，因此**不直接命中该条款的字面条件**。
- 但 holdout 的设计意图是评测对象与设计参与方均未见过题目。本次有 1 条题目及答案进入了
  参与 W13 设计讨论的 AI 上下文。
- **是否判定该条已污染、是否替换该条或整个 holdout，由本人决定。** AI 不对此作结论。

---

## 5. 根因

（待本人分析）

---

## 6. 预防措施

已落地的机制（供本人评估是否足够）：

| 层 | 内容 | 覆盖范围 |
|---|---|---|
| 权限规则 | `.claude/settings.json` 的 `permissions.deny`：`Read` 与 `Edit` 对 `week13-rag/eval/holdout/**` | Claude Code 的文件读写工具 |
| PreToolUse hook | `.claude/hooks/block-holdout-access.sh`，按路径字符串拦截 Bash 命令（git 子命令放行） | Claude Code 的 Bash 工具，覆盖 `cat` / `head` / `grep` 等任意写法 |
| 规则文档 | `AGENTS.md` 新增「禁读区」一节，含适用范围、确认结构的正确做法、给出建议时的额外要求 | 所有 agent，含 VS Code Codex 与 Cline |

已知覆盖缺口：权限规则与 hook 只对 Claude Code 生效；Codex 与 Cline 仅受 `AGENTS.md` 约束。

（本人对预防措施的评估与补充：待填）

---

## 7. 经验教训

（待本人分析）
