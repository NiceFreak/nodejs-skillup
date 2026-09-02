# Week 12 计划：Python for AI Engineering + Bub 深读（8/31-9/4）

> 改建：2026-08-31（Asia/Shanghai）。
>
> 范围修订：2026-09-01。Bub 必读范围缩到 turn 生命周期、tape -> context 主链与
> model/tool/harness 职责边界；hook 只跟主链实际经过的注册与调用，channel/provider 扩展降为选修。
>
> 本周原计划同时承担 Python、Bub、full-context、BM25 与题库。五周窗口确认后，检索与题库整体移到 W13；
> W12 主线只建立 Python 工程能力、深读一个真实项目，并完成模型客户端的真实失败实验；Prompt 与
> coding-agent 使用作为横切能力嵌入现有任务，不新增项目。
>
> 五周执行表与参考链接见 `plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`；周间接口与范围上限见
> `plan/ai-engineer-reskill-5-week-plan.md`。
> 标为「待本人落定」的内容属于本人负责的验收或正确性判断，AI 不预填。
>
> 2026-08-31 晚改排：D1（8/31）全天实际用于五周计划的评审与改建（评审已通过），本文件原 D1
> 执行清单当天未动。本周有效学习日压缩为 4 天（9/1-9/4）。交付物、必修内容与 §7 不可砍清单均
> 不减：原 D1 任务并入 D2 上午，原 D2 下午的 Bub 入口移入 D3，D4 增设最多 90 分钟机动时段吸收
> Bub 溢出。改排后的每日节奏见 §3；D2 单日计划见
> [`day2-freeze-and-baseline.md`](./day2-freeze-and-baseline.md)，D3 单日计划见
> [`day3-bub-main-chain.md`](./day3-bub-main-chain.md)。

## 0. 本周输入

### 0.1 已完成与未完成事实

- W11「CI 流水线与自动化发布」已于 2026-08-28 收口。
- 类 2 最小样本 L2 债在 W12 D2 第一档盲重建中卡档；再重建另排，仍从第一档开始。
- cp/L55 闭合仍依赖一次 root 会话，属于条件项，不占本周主线。
- 展板第一轮视觉契约已验收，`verify:board` 1070/1070；本周不修改展板。
- 当前系统 Python 是 3.9.6；Bub 要求 Python 3.12+，需要项目级运行环境。
- 本机实际使用 VS Code Codex 扩展 `openai.chatgpt 26.5825.51511` 与 Cline 扩展
  `saoudrizwan.claude-dev 4.1.16`。Claude Code 受公司防火墙限制，Codex App 不支持 Intel；本周不以
  CLI 或桌面 App 作为工具前提。

### 0.2 本周沿用的通用 hands-on 标准

语言侧最低形态继续沿用 W9 §3.1：

```text
可运行
+ 一个冒烟测试
+ 能口述该结构与 Node/TypeScript 对应物
```

具体 Python 冒烟测试与本周唯一验收句由本人在 D2 冻结（原定 D1，随 8/31 改排顺延）。

## 1. 本周目标与交付物

**目标**：通过 Bub 与真实模型 client，建立从 TypeScript 迁移到 Python AI 工程时所需的代码阅读、异步控制、
资源清理和故障诊断能力。

**最低交付物**：

1. **Python 项目基线**：项目级 Python 3.12、依赖锁定、可运行入口和一个冒烟测试。
2. **Bub 阅读报告**：turn 生命周期、tape -> context rebuild、model/tool/harness 的调用顺序与职责边界；
   hook 只记录主链实际经过的注册与调用。
3. **真实客户端实验记录**：至少一次真实模型调用和一次最小工具调用；timeout 与 cancellation 各真实触发一次。
4. **Prompt 与 coding-agent 基线**：一份版本化 `prompt v0`；本人先独立完成并冻结陌生代码诊断，
   再让 VS Code Codex 与 Cline review 同一输入，记录 context、权限、计划、扩展和验证差异。
5. **W13 输入清单**：只记录可作为 corpus 的 tracked Markdown 规模和排除类别，不创建题库或答案。

五项交付物分别证明环境、阅读、运行时行为、Prompt/coding-agent 使用和周间接口；不能用其中一项替代其他项。

## 2. 本周学习边界

本周采用 TypeScript -> Python 迁移增量，不做语法通览。

### 2.1 Python 迁移增量

**按主链学习**：

- package/import 与 `__init__.py`。
- typing、Protocol、dataclass 与 Pydantic 的职责边界。
- exception 传播、异常链与资源清理。
- sync/async 分裂、task、timeout、cancellation 与 async context manager。
- pytest fixture 和异步测试的最小使用方式。
- HTTP client、streaming 和结构化输入输出。

装饰器、iterator/generator、dunder method 等只在 Bub 调用链实际出现时展开。目标是解释项目行为，
不是覆盖 Python 语法目录。

### 2.2 Prompt engineering 基线

- 区分 system/developer instructions、user input、examples、retrieved context 与 output schema。
- 把 Prompt 当作代码旁的版本化工程输入：记录版本、适用模型/任务和变更理由，并用冻结输入验证。
- 本周只建立 `prompt v0`，不做多轮调参；W14 才在冻结 dev task 上执行一次单变量前后对照。
- Prompt 内容、few-shot 样例与通过标准由本人确定。AI 可 review 表达边界，不代填正确性判断。

### 2.3 VS Code Codex / Cline 使用基线

- 复用 D5 的陌生代码诊断，冻结同一输入、允许材料、只读权限和成功条件；执行顺序固定为「本人独立
  作答并冻结 -> VS Code Codex review -> Cline review -> 本人比较」，coding agent 不得在本人作答前介入。
- 两个 VS Code 扩展都必须 hands-on；D2 记录扩展版本、provider、context 来源、权限模式和规则来源，
  并确认根 `AGENTS.md` 已生效。W15 的 MCP 兼容性另行验证，不从 W12 任务成功外推。
- 对照 context 来源、权限与计划模式、工具/MCP/Skill 扩展面、diff/review 与验证方式；不比较模型排行榜。
- 两个工具总计投入不超过 60-90 分钟，不让安装或账号问题挤占 Python/Bub 主线。

## 3. 每日节奏（2026-08-31 晚按 4 个有效学习日改排）

### D1（8/31 周一）：实际用于五周计划评审，原任务清单未执行

当天完成五周总计划与本文件的评审和改建落盘（原 D1 第 2 项的复核部分已完成；§5 决策冻结未做）。
以下原 D1 任务当天未执行，全部移入 D2 上午：DEBT 类 2 盲重建、§5 决策冻结、Python 3.12 环境、
Bub 来源 commit 冻结、Codex/Cline 环境记录、DeepSeek key 检查。
条件项 cp/L55 保持 BACKLOG 状态不变。

### D2（9/1 周二）：结账、决策冻结、环境基线与迁移增量

上午（原 D1 清单，执行顺序固定，先确定性存量后环境配置）：

- [x] 第一入口：DEBT 类 2 第一档盲重建，不重写原脚本。（**卡档**，再重建另排 D3 前；
  证据见 `day2-freeze-and-baseline.md` §5）
- [x] 建 `day2-freeze-and-baseline.md` §3，冻结 §5 的本人决策。
- [x] 建立项目级 Python 3.12 环境、依赖锁定与最小运行入口。
- [ ] 冻结 Bub 的来源 commit；本周只读 Bub。（未完成：HEAD `33c417a` 已探测，D3 前拍板，D3 前置条件）
- [ ] 在 VS Code 内记录 Codex/Cline 扩展版本、provider、权限和规则来源；确认两端可看到根
  `AGENTS.md`。只核对现有环境，不安装 Claude Code、不使用 Codex App，也不在 D2 开始同题对照。
  （未完成：版本已知，provider/权限/规则来源 D3–D5 机动补）
- [x] 验证 DeepSeek key 只存在于 gitignored 本地环境。
- [ ] 条件项：root 会话可得时闭合 cp/L55；不可得时保持 BACKLOG 状态。（未触发，保持 BACKLOG）

下午（原 D2 上午）围绕一个最小可运行模块学习：

- [x] package/import、typing/Protocol、dataclass/Pydantic。（package/import 与 dataclass/Pydantic
  已学；Protocol 未覆盖，随组合练习 / D3 现场展开）
- [x] exception 与 context manager。
- [x] pytest 冒烟入口。（`tests/users/test_users_units.py`，`pytest -v` 6 passed）
- [x] Prompt 的 instructions/input/examples/context/output schema 分区，并建立 `prompt v0`。
  （`prompts/prompt-v0.md` 已版本化落盘）

环境命令成功只证明基线可运行，不证明已经掌握 Python。`prompt v0` 是 D4 真实调用的前置，
当天必须落盘。上午溢出时压缩当日迁移增量的覆盖面（未覆盖点随 D3 的 Bub 调用链现场展开），
不推迟决策冻结与 `prompt v0`。

### D3（9/2 周三）：Bub 入口与主链深读

单日计划见 [`day3-bub-main-chain.md`](./day3-bub-main-chain.md)（2026-09-02 建立），其中 §4 预测区与
§8 执行记录由本人当天填写。

- [ ] 第一入口：DEBT 类 2 第一档再重建（D2 卡档，仍第一档，上限 45 分钟）。

上午（原 D2 下午）进入 Bub：定位 CLI/framework 入口、一次 turn 的开始与结束，以及主要对象的
创建关系。来源版本为 D2 冻结的 `33c417a`（`~/Documents/bub`），本周只读。

下午（原 D3）只跟以下主链：

- [ ] turn lifecycle。
- [ ] tape 追加事件，以及 session 根据 tape 重建 context。
- [ ] model、tool 与 harness 的职责边界。
- [ ] hook 只跟上述主链实际经过的注册与调用。

channel/provider 扩展不属于必修；主链提前收口时才抽样，不占用 D4 机动时段。

阅读报告必须区分：

```text
代码调用顺序
职责归属
返回值或状态来源
已由源码确认的事实
仍需运行验证的行为
```

Bub 阅读由原 1.5 天压缩为 1 天；当天未跟完的主链占用 D4 机动时段，不自动降档。阅读报告的
主链部分当天起草，收口仍在 D5。当天还需提出至少 1 个源码级闭合问题候选（§5 决策 1 注），验证归
D4 或 D5。Bub 延迟重建不在阅读当天执行，安排到 W14 D1 的 15-20 分钟单元。

### D4（9/3 周四）：异步、工具调用与真实失败

- 机动时段（最多 90 分钟，仅在 D3 主链未跟完时使用）：收 Bub 主链残余。
- async/await、task、timeout、cancellation、资源清理和异常边界。
- 一次真实 DeepSeek 调用和一次最小工具调用。
- 使用冻结的 `prompt v0`，记录模型、Prompt 版本与实际输入边界。
- timeout 与 cancellation 各真实触发一次，并记录操作、观察、结论和未验证边界。
- 验证测试结束后没有残留 task、连接或未处理异常。

本日不实现 Agent loop。工具调用只用于观察 Python API、异步生命周期和模型客户端行为。

### D5（9/4 周五）：陌生代码诊断、报告收口与 W13 接口

- 完成 Bub 阅读报告，并复核事实/推断/待验证标记。
- 本人先独立诊断一段未提前见过的 Python 异步或资源管理代码并冻结答案；AI 只提供题目，不提前给答案
  或提示。本人答案冻结后，VS Code Codex 与 Cline 才对同一输入执行只读 review，合计不超过 60-90 分钟。
- 记录两种 coding-agent 的 context、权限、计划、扩展和验证差异，不用单次输出质量做排行榜。
- 根据本人 D2 冻结的唯一验收句完成验收。
- 只盘点 tracked Markdown 数量、字节数与排除类别；不复制 corpus，不建立题目或答案。
- 更新 `LEARNING-STATE.md`，记录 W13 第一入口与 W14 Bub 重建日期。

## 4. 本周明确不做

- full-context、BM25、embedding、hybrid、reranker 和向量数据库。
- corpus 物理快照、题库、答案 key 和 eval 指标。
- DeepSeek Harness 抽样阅读；它不再进入五周主线，DeepSeek 只保留模型 provider 角色。
- 完整 Agent loop、trace、verifier 与 trial。
- MCP、FastAPI、UI、Docker/CI 和部署。
- Coding agent 自动写核心代码、批量生成、自动 commit/push/merge；本周工具任务保持只读。
- 公司资料或含 PII 的材料。
- 自动 commit、push 或 merge。

## 5. D2 冻结的本人决策（2026-09-01 D2 已冻结，全文见 [`day2-freeze-and-baseline.md`](./day2-freeze-and-baseline.md) §3）

1. **唯一验收句**：五项交付物全部满足（环境 pytest + 覆盖率 ≥ 90% / Bub 阅读报告含源码级闭合
   问题 / 真实客户端实验 / prompt v0 落盘 / W13 输入清单），缺一不可。
2. **Python 冒烟测试**：`import sys, pydantic` 正常 + 项目入口脚本 0 退出 5s 内 + 无
   ImportError / VersionConflict；Bub 导入按实际来源处理。
3. **陌生代码诊断边界**：允许项目内源码 / 官方文档 / git 历史 / 既有笔记；本人 45 分钟定位根因。
4. **每日止步条件**：状态更新必收口；P0 连续 2 个番茄钟无实质进展可降档；17:00 前脏文件需说明。
5. **运行信任边界**：并发 / GIL / 内存 / 引用计数结论须对照 CPython 源码；库未明确行为与真实
   模型 / 工具调用、timeout / cancellation 须最小实验确认。
6. **prompt v0 与 coding-agent**：两个独立实验（prompt v0 → D4 模型调用；coding-agent → D5
   只读诊断），不作同题对照；coding-agent 本周保持只读，不承担迁移 / 重构 / 修剪。

## 6. AI 协作边界

| 内容 | 归属 | 说明 |
|---|---|---|
| Python、Pydantic、pytest、asyncio、HTTP SDK 写法 | 白名单 | 纯语言或库 API 细节 |
| 环境、依赖、scripts、`.env.example` | 白名单 | 配置与样板 |
| Bub 调用链结论 | 本人 | AI 可 review，不代写阅读报告 |
| D5 未见代码诊断题 | AI 出题、本人作答 | AI 在验收结束前不提示 |
| timeout/cancellation 的实验结论 | 本人 | AI 可解释经验行为与 review 证据 |
| Prompt 内容、样例、变更判断与成功标准 | 本人 | AI 可解释方法和 review，不代填正确性 |
| VS Code Codex/Cline 同题任务 | 本人先答、两端后答 | 本人答案冻结前两端不得介入；之后保持只读并使用同一输入/成功条件 |
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
2. Bub hook 的非主链扩展点与 provider 扩展。
3. D2 中未被 Bub 使用的 Python 特性。
4. W13 corpus 排除类别的预盘点。

不可砍：DEBT 重建、项目级 Python 3.12、Bub turn/tape -> context 主链与 model/tool/harness 职责、
真实 timeout/cancellation、冒烟测试、版本化 `prompt v0`、VS Code Codex/Cline 同题只读 hands-on 和
D5 验收。

DeepSeek Harness 已移出五周主线；检索和题库已移到 W13，均不作为本周排期回弹项。

## 8. 周间接口与延迟重建

**W11 -> W12**：DEBT 类 2 重建；cp/L55 条件项；S3/Docker 保持 BACKLOG。

**W12 -> W13**：

- Python 项目和模型 client 可运行。
- `prompt v0` 已版本化；VS Code Codex/Cline 同题只读任务已完成。
- Bub 阅读报告已标明源码事实与运行待验证项。
- corpus 只完成规模盘点；W13 D1 在第一道 eval 题建立前完成物理快照。

**延迟重建**：Bub 与 Python 调用链安排在 W14 D1，15-20 分钟，只看允许材料完成。

## 9. 风险与处理

1. **Bub 超出 D3 一天**：先用 D4 机动时段（最多 90 分钟）收 turn、tape -> context 与
   model/tool/harness 主链；hook 只保留主链实际经过部分，channel/provider 不使用机动时段。
2. **Python 环境卡住**：环境配置属白名单，由 AI 解除阻塞，不挤占 D3 主链。
3. **真实 API 不可用**：保留错误证据，使用 fake client 验证本地生命周期；真实调用另排，不把 fake 成功写成 API 已验证。
4. **DEBT 重建卡档**：按 `AGENTS.md` 记卡档并另排，不压缩 Bub 主链。
5. **D5 诊断题未通过**：按重建规则判未通过；先记录失败类型，再决定是否需要 L1 讲解。
6. **某个 VS Code 扩展临时失败**：保留扩展版本、provider、权限和错误证据；当天不排长故障，另一端
   照常完成。失败端在 W12 内重试一次，仍失败则明确记为未验证，不把文档阅读写成 hands-on。
7. **扩展版本缺少 MCP/Skill 功能**：W12 只做通用只读 review，不为扩展功能升级排障；W15 的现代
   MCP 主线仍由 Python SDK 完成，产品集成按实际可用能力记录。
8. **D2 任务密度为全周最高（原 D1 + 原 D2 上午）**：DEBT 重建卡档时按 `AGENTS.md` 记卡档另排，
   不挤占决策冻结与环境基线；上午溢出只压缩当日迁移增量覆盖面（未覆盖点随 D3 现场展开），
   决策冻结、环境基线与 `prompt v0` 当天必须收口。

## 10. AI 辅助记录

- 2026-09-02：AI 以实现方模式（白名单文档）按 §3 D3 预排单日计划
  [`day3-bub-main-chain.md`](./day3-bub-main-chain.md)，并把 D3 清单改为可勾选形态、补记闭合问题
  候选的产出时点。未提供 Bub 阅读结论或黑名单 L2 骨架，不新增债务。
- 2026-09-01：AI 按 Anthropic/OpenAI 官方工程资料执行 L1 计划复核，将 Bub 必读范围收窄为
  turn、tape -> context 与 model/tool/harness 主链；未提供黑名单核心实现或 L2 骨架，不新增债务。
- 2026-08-28：旧版 W12-W13 计划由 AI 以 L1 协助建立，未新增债务。
- 2026-08-31：五周窗口确认后，AI 根据两轮 review、仓库实测和官方资料复核改建本计划。
  本次只处理计划、事实边界和白名单配置方向；未提供黑名单核心实现或 L2 骨架，不新增债务。
- 2026-08-31：吸收项目 review，将 Prompt engineering 与 coding-agent 使用嵌入既有 D4/D5。此前
  对可用工具的判断未覆盖网络与硬件条件；同日本人补充防火墙与 Intel 限制后，hands-on 改为实际使用的
  VS Code Codex 与 Cline。未新增核心实现任务或 L2 骨架，不新增债务。
- 2026-08-31（晚）：D1 全天用于五周计划评审与改建，原 D1 执行清单未动。AI 以实现方模式（白名单
  文档）把本周改排为 4 个有效学习日：原 D1 任务并入 D2 上午、Bub 入口移入 D3、D4 增设最多
  90 分钟机动时段；交付物、必修内容与 §7 不可砍清单未减。同时建立 D2 单日计划
  `day2-freeze-and-baseline.md`；§5 本人决策未预填。DEBT 类 2 重建顺延至 D2 第一入口。不新增债务。
