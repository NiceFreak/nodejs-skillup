# 每日英文技术学习成果报告规范

本文件定义如何根据当天真实学习内容生成一份适合邮件汇报的英文技术学习成果报告。它与一分钟英语口语稿分工不同：口语稿只选择一两个重点用于表达练习；本报告覆盖当天完整的学习成果、证据、技术理解、问题边界和下一步。

本规范保存在项目根目录，由本人明确要求时读取和执行，不作为本机自动安装或自动触发的 skill。

## 1. 使用口令

AI 已进入本仓库并恢复学习状态时，使用：

> 请按 `DAILY-LEARNING-REPORT-PROTOCOL.md` 生成今日英文学习成果报告。

需要限定材料或截止时间时，使用：

> 请按 `DAILY-LEARNING-REPORT-PROTOCOL.md`，基于我指定的文件和截至 HH:mm 的证据，生成今日英文学习成果报告。

该口令不触发 `DAILY-SPEAKING-PROTOCOL.md` 的一分钟口语稿。用户明确说“口语稿”“speaking script”或面试口语练习时，仍使用原口语稿规范。

## 2. 内容来源与证据截止时间

生成前必须读取：

1. `AGENTS.md`、`LEARNING-PROTOCOL.md` 与 `TECHNICAL-WRITING-PROTOCOL.md`。
2. `LEARNING-STATE.md`。
3. 当前周计划和当天笔记。
4. 与当天内容直接相关的代码、Git diff、测试输出、trace、实验记录或命令结果。
5. 用户明确指定的补充文件；指定范围与默认读取范围冲突时，以用户当次要求为准。

报告开头记录：

```text
Evidence captured as of YYYY-MM-DD HH:mm Asia/Shanghai
```

只把截止时间前已有直接证据的事项写成完成。必须区分：

- 已完成、已运行、已测试和已验证。
- 代码已存在但尚未运行。
- 根据源码或结果形成的推断。
- 已决定但尚未执行的方案。
- 待验证项和下一步。

代码存在只证明已经实现，不证明运行行为；命令通过只证明该命令实际覆盖的范围。交付物完成与独立掌握必须分开，不得从文档、测试通过或 AI 辅助实现直接推断本人已经掌握。

## 3. 正文长度与计数边界

- 英文正文为 **650-850 词**，目标是正常阅读约五分钟。
- 计数范围从 `Summary` 开始，到 `Next Step` 结束，二者均计入。
- 邮件主题、证据截止时间、称呼、落款、`Code Evidence` 和 `Technical Capability Matrix` 不计入正文词数。
- 第一次实际使用后，可根据真实阅读时间调整词数范围；调整前继续使用 650-850 词。

## 4. 邮件优先的固定结构

报告保存为 Markdown 文件，但正文以复制到邮件后的阅读体验为优先。使用短标题和短段落，不使用 Markdown 表格、装饰性标题、引用块或大量粗体。

```text
Subject: Daily AI Engineering Learning Summary - YYYY-MM-DD - <specific topic>

Summary
<当天范围、主要成果和整体状态>

Learning Outcomes and Evidence
<完成了什么；哪些运行、测试、trace 或文档证据支持这些结论>

Technical Understanding
<能够解释的机制、职责边界、取舍和适用条件>

Issues, Decisions, and Remaining Boundaries
<错误、预测偏差、修正、已拍板事项、未验证内容和不能扩大的结论>

Next Step
<下一个可执行入口>
```

同类结果达到三项以上、使用短段落会降低扫描效率时，可以使用项目符号。保留来源中的准确日期、数量、单位、版本、命令、状态码、退出码和证据强度。

## 5. 代码证据

仅在当天确有代码新增或实质修改，并且代码能够支持报告中的关键成果时添加 `Code Evidence`。整个附录不计入正文词数。

- 最多选择两个片段，每段通常为 6-20 行。
- 每个片段先写仓库相对路径、符号名或行号范围，并用一句话说明它证明什么。
- 只有代码片段本身使用 fenced code block。
- 仅当目标 commit 确实包含相同片段且代码已提交/推送时，才附 GitHub permalink。链接可公开访问性以
  本地 git 事实与本人确认为准。
- 生成链接前使用 `git show <commit>:<path>` 核对内容；优先使用固定 commit 链接，不使用可能漂移的分支链接。
- AI 不主动访问 github 或第三方网络去验证链接可达性（本人网络环境不稳定/受限；2026-09-04 沉淀）。
  推送状态与链接有效性由本人掌握，本人确认需要时才做外部验证。
- 代码未提交、未 push、被 ignore、由本地生成或不能公开访问时，写 `Local evidence; no public link
  available`，不得虚构 URL（此约束不因「不主动 ping」而放宽）。
- 片段和链接不得包含密钥、PII、公司内部资料、敏感绝对路径或专有数据。

固定 commit 链接格式：

```text
https://github.com/<owner>/<repo>/blob/<commit>/<path>#Lx-Ly
```

当天没有适合引用的代码时，省略整个 `Code Evidence`，不得为了满足格式而选择无关样板代码。

## 6. Technical Capability Matrix

报告最后必须附 `Technical Capability Matrix`。该附录不计入正文词数，使用重复字段而不是 Markdown 表格：

```text
Technical Capability Matrix

Criterion: <被评估的能力>
Target or Threshold: <已冻结目标；没有数值阈值时写 No quantitative threshold frozen>
Observed Evidence: <具体结果、数量、耗时、覆盖率、trace 或解释证据>
Status: Met | Partially Met | Not Evaluated
Gap or Next Verification: <一条精炼的差距或下一验证>
```

每天只写与当日内容直接相关的标准，不强制把整周所有标准塞进一份日报；但一周结束前，应通过各日报或周末报告覆盖当周全部标准。

### W13：RAG

- 解释 ingestion -> retrieval -> context -> generation -> evaluation 的职责边界。
- 对失败问题完成 retrieval、context assembly、prompt、generation 分层归因。
- 区分索引、检索结果、session state、trace 和 memory。
- 能够确定性重建 retrieval 数据流。

### W14：Tool + Single-Agent Harness

- 区分 model、prompt、tool、session state、durable memory、RAG、Harness、MCP 和 verifier 的职责。
- Prompt 前后比较只改变一个因素，并保留版本和相同 eval 结果。
- replay 能复现确定性部分，trace 能按层定位失败。
- session reset/isolation 有确定性证据。

### W15：MCP

- 从消息层解释 discovery、call、result 和 failure。
- 区分现代协议与旧版协议的主链和生命周期。
- 能说明 scope、来源信任、版本和权限选择。
- 区分产品客户端互操作证据与 Python SDK 原始协议消息证据。

### W16：Reliability & Evals

- 使用 multi-trial 证据，不以单次成功代替可靠性结论。
- stale state 或 memory 泄漏能够被检测、隔离或 reset。
- 失败能够归因到 retrieval、prompt/context、memory、tool、Harness、MCP、model 或 verifier。
- 同一输入下的确定性部分可以 replay。
- AI 生成变更具备 specification、本人所有权、验证、版本和 rollback 证据。

不得为了让定性标准看起来“可量化”而自行发明数值阈值。没有冻结阈值时必须如实写明；证据不足以支持 `Met` 时，使用 `Partially Met` 或 `Not Evaluated`。

## 7. 文件落点

保存到当前周的 `notes/` 目录：

```text
dayN-english-learning-report.md
```

使用仓库实际 Day 编号。文件已经存在时只更新对应内容，不覆盖其他人工记录。报告正文是邮件可直接复制版本，不额外生成重复的“邮件版”和“仓库版”。

## 8. 生成后校验

逐项检查：

- [ ] 正文为 650-850 个英文单词，计数没有包含两个附录。
- [ ] 每个第一人称完成结论都有当天直接证据。
- [ ] 计划、推断和待验证项没有写成已完成或已掌握。
- [ ] 交付物完成与独立掌握已经分开。
- [ ] 代码片段不超过两个，且只选择能支持关键成果的内容。
- [ ] GitHub 链接指向包含相同代码的固定 commit（经本地 `git show` 核对，未做外部 ping）；代码未推送时没有伪造链接，写 Local evidence。
- [ ] 报告没有密钥、PII、公司内部资料或敏感路径。
- [ ] Technical Capability Matrix 只使用当前已冻结的标准和阈值。
- [ ] 文案可直接复制到邮件，不依赖 Markdown 表格或复杂渲染。

完成后返回：报告文件链接、正文词数、证据截止时间、是否包含代码证据、矩阵评估标准数量。正文只有在本人要求时才同时贴入聊天。

