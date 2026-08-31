# Week 12 计划：Python for AI Engineering + Bub 深读（8/31-9/4）

> 改建：2026-08-31（Asia/Shanghai）。
>
> 本周原计划同时承担 Python、Bub、full-context、BM25 与题库。五周窗口确认后，检索与题库整体移到 W13；
> W12 只建立 Python 工程能力、深读一个真实项目，并完成模型客户端的真实失败实验。
>
> 五周执行表与参考链接见 `plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`；周间接口与范围上限见
> `plan/ai-engineer-reskill-5-week-plan.md`。
> 标为「待本人落定」的内容属于本人负责的验收或正确性判断，AI 不预填。

## 0. 本周输入

### 0.1 已完成与未完成事实

- W11「CI 流水线与自动化发布」已于 2026-08-28 收口。
- 类 2 最小样本仍有一笔 L2 债，入口是 W12 D1 第一档盲重建。
- cp/L55 闭合仍依赖一次 root 会话，属于条件项，不占本周主线。
- 展板第一轮视觉契约已验收，`verify:board` 1070/1070；本周不修改展板。
- 当前系统 Python 是 3.9.6；Bub 要求 Python 3.12+，需要项目级运行环境。

### 0.2 本周沿用的通用 hands-on 标准

语言侧最低形态继续沿用 W9 §3.1：

```text
可运行
+ 一个冒烟测试
+ 能口述该结构与 Node/TypeScript 对应物
```

具体 Python 冒烟测试与本周唯一验收句由本人在 D1 冻结。

## 1. 本周目标与交付物

**目标**：通过 Bub 与真实模型 client，建立从 TypeScript 迁移到 Python AI 工程时所需的代码阅读、异步控制、
资源清理和故障诊断能力。

**最低交付物**：

1. **Python 项目基线**：项目级 Python 3.12、依赖锁定、可运行入口和一个冒烟测试。
2. **Bub 阅读报告**：turn、hook、tape、context rebuild、model/tool/channel 的调用顺序与职责边界。
3. **真实客户端实验记录**：至少一次真实模型调用和一次最小工具调用；timeout 与 cancellation 各真实触发一次。
4. **W13 输入清单**：只记录可作为 corpus 的 tracked Markdown 规模和排除类别，不创建题库或答案。

四项交付物分别证明环境、阅读、运行时行为和周间接口；不能用其中一项替代其他项。

## 2. Python 学习边界

本周采用 TypeScript -> Python 迁移增量，不做语法通览。

**按主链学习**：

- package/import 与 `__init__.py`。
- typing、Protocol、dataclass 与 Pydantic 的职责边界。
- exception 传播、异常链与资源清理。
- sync/async 分裂、task、timeout、cancellation 与 async context manager。
- pytest fixture 和异步测试的最小使用方式。
- HTTP client、streaming 和结构化输入输出。

装饰器、iterator/generator、dunder method 等只在 Bub 调用链实际出现时展开。目标是解释项目行为，
不是覆盖 Python 语法目录。

## 3. 每日节奏

### D1（8/31 周一）：结账、计划冻结与环境基线

- [ ] 第一入口：DEBT 类 2 第一档盲重建，不重写原脚本。
- [ ] 复核五周总计划与本文件，冻结 §5 的本人决策。
- [ ] 建立项目级 Python 3.12 环境、依赖锁定与最小运行入口。
- [ ] 冻结 Bub 与 DeepSeek Harness 的来源 commit；本周只读 Bub。
- [ ] 验证 DeepSeek key 只存在于 gitignored 本地环境。
- [ ] 条件项：root 会话可得时闭合 cp/L55；不可得时保持 BACKLOG 状态。

D1 不进入新的 Python 概念学习。环境命令成功只证明基线可运行，不证明已经掌握 Python。

### D2（9/1 周二）：TypeScript -> Python 迁移增量 + Bub 入口

上午围绕一个最小可运行模块学习：

- package/import、typing/Protocol、dataclass/Pydantic。
- exception 与 context manager。
- pytest 冒烟入口。

下午进入 Bub：定位 CLI/framework 入口、一次 turn 的开始与结束，以及主要对象的创建关系。

### D3（9/2 周三）：Bub 主链深读

只跟以下主链：

- turn lifecycle。
- hook 注册与调用。
- tape 追加事件。
- session 根据 tape 重建 context。
- model、tool 与 channel 的职责边界。

阅读报告必须区分：

```text
代码调用顺序
职责归属
返回值或状态来源
已由源码确认的事实
仍需运行验证的行为
```

Bub 延迟重建不在阅读当天执行，安排到 W14 D1 的 15-20 分钟单元。

### D4（9/3 周四）：异步、工具调用与真实失败

- async/await、task、timeout、cancellation、资源清理和异常边界。
- 一次真实 DeepSeek 调用和一次最小工具调用。
- timeout 与 cancellation 各真实触发一次，并记录操作、观察、结论和未验证边界。
- 验证测试结束后没有残留 task、连接或未处理异常。

本日不实现 Agent loop。工具调用只用于观察 Python API、异步生命周期和模型客户端行为。

### D5（9/4 周五）：陌生代码诊断、报告收口与 W13 接口

- 完成 Bub 阅读报告，并复核事实/推断/待验证标记。
- 对一段未提前见过的 Python 异步或资源管理代码执行 code review；验收题由 AI 提供，答案不提前给出。
- 根据本人 D1 冻结的唯一验收句完成验收。
- 只盘点 tracked Markdown 数量、字节数与排除类别；不复制 corpus，不建立题目或答案。
- 更新 `LEARNING-STATE.md`，记录 W13 第一入口与 W14 Bub 重建日期。

## 4. 本周明确不做

- full-context、BM25、embedding、hybrid、reranker 和向量数据库。
- corpus 物理快照、题库、答案 key 和 eval 指标。
- DeepSeek Harness 抽样阅读；它移到 W14 并列为可砍项。
- 完整 Agent loop、trace、verifier 与 trial。
- MCP、FastAPI、UI、Docker/CI 和部署。
- 公司资料或含 PII 的材料。
- 自动 commit、push 或 merge。

## 5. D1 本人决策（AI 不预填）

1. **唯一验收句**：什么可证伪结果代表本周通过？
2. **Python 冒烟测试**：什么运行结果证明环境、import 和测试入口可用？
3. **陌生代码诊断边界**：D5 允许查看哪些资料，什么行为算通过？
4. **每日止步条件**：什么必须当日收口，什么可降档或进入 BACKLOG？
5. **运行信任边界**：哪些 Bub 结论只来自源码，哪些必须用实验确认？

## 6. AI 协作边界

| 内容 | 归属 | 说明 |
|---|---|---|
| Python、Pydantic、pytest、asyncio、HTTP SDK 写法 | 白名单 | 纯语言或库 API 细节 |
| 环境、依赖、scripts、`.env.example` | 白名单 | 配置与样板 |
| Bub 调用链结论 | 本人 | AI 可 review，不代写阅读报告 |
| D5 未见代码诊断题 | AI 出题、本人作答 | AI 在验收结束前不提示 |
| timeout/cancellation 的实验结论 | 本人 | AI 可解释经验行为与 review 证据 |
| Agent loop、终止、工具契约、trace、verifier | 本周不做 | 黑名单边界不因 Python 改变 |

对 AI 生成或补全的 Python 代码使用以下检查顺序：

```text
先说明目标与预期影响
-> review diff
-> 预测失败路径
-> 运行测试和失败实验
-> 不看生成过程重新解释
```

## 7. 范围保护

时间不足时依次砍掉：

1. Bub 的 channel 细节。
2. Bub hook 的非主链扩展点。
3. D2 中未被 Bub 使用的 Python 特性。
4. W13 corpus 排除类别的预盘点。

不可砍：DEBT 重建、项目级 Python 3.12、Bub turn/tape 主链、真实 timeout/cancellation、冒烟测试和 D5 验收。

DeepSeek Harness、检索和题库已经移出本周，不作为排期回弹项。

## 8. 周间接口与延迟重建

**W11 -> W12**：DEBT 类 2 重建；cp/L55 条件项；S3/Docker 保持 BACKLOG。

**W12 -> W13**：

- Python 项目和模型 client 可运行。
- Bub 阅读报告已标明源码事实与运行待验证项。
- corpus 只完成规模盘点；W13 D1 在第一道 eval 题建立前完成物理快照。

**延迟重建**：Bub 与 Python 调用链安排在 W14 D1，15-20 分钟，只看允许材料完成。

## 9. 风险与处理

1. **Bub 超出一天半**：只保证 turn lifecycle 与 tape；hook/channel 降档。
2. **Python 环境卡住**：环境配置属白名单，由 AI 解除阻塞，不挤占 D3 主链。
3. **真实 API 不可用**：保留错误证据，使用 fake client 验证本地生命周期；真实调用另排，不把 fake 成功写成 API 已验证。
4. **DEBT 重建卡档**：按 `AGENTS.md` 记卡档并另排，不压缩 Bub 主链。
5. **D5 诊断题未通过**：按重建规则判未通过；先记录失败类型，再决定是否需要 L1 讲解。

## 10. AI 辅助记录

- 2026-08-28：旧版 W12-W13 计划由 AI 以 L1 协助建立，未新增债务。
- 2026-08-31：五周窗口确认后，AI 根据两轮 review、仓库实测和官方资料复核改建本计划。
  本次只处理计划、事实边界和白名单配置方向；未提供黑名单核心实现或 L2 骨架，不新增债务。
