# Week 12 计划草案：Python 项目阅读 + 检索基线（8/31–9/4）

> 建立：2026-08-28（Asia/Shanghai）。**方向变更周**：原主题「AI 协作产出 Python 工具」因新的岗位方向调整为本主题，
> W13 同批由「React / Next 深化」改为「只读 Agent」。变更依据与影响面见根 `README.md`、`LEARNING-STATE.md` 头部。
>
> 本文按 `LEARNING-PROTOCOL.md` 周初建立的要求提前一天落盘，用于卸掉 D1 的排期压力。
> **标注「待本人落定」的条目一律留空**——那些属于本人负责的验收与契约判断，不由 AI 预填。

---

## 0. 从 W11 继承的事实（W12 的决策输入，不重新验证）

- W11「CI 流水线与自动化发布」已于 2026-08-28 全周收口，六条最低交付边界全部达成。
- **未还债务一笔**：类 2 最小样本（close 竞争构造与收尾逻辑），L2 定向提示，重建安排 = **W12 D1 第一档盲重建**（`DEBT.md` 2026-08-27 条目）。
- **服务器安全遗留**：cp/L55 闭合需一次 root 会话，前置为 admin.pem 收窄（BACKLOG P1-9）。**条件项，不占 D1 主线。**
- **stretch 现为两项**（S3 / Docker）。Java 已于 2026-08-28 与 manager 沟通后**退出本轮**，W9 jar 与 W11 Maven job 锚点作废。
- 展板已完成第一轮视觉契约验收（`verify:board` 1070/1070），**未部署**；本周不动展板。

## 0.1 从 W9 继承的一条通用规则（Java 退出后唯一消费者变为 Python）

`week9-deployment/notes/week9-plan.md` §3.1：

> 语言侧 hands-on 的通用验收定义：**可运行 + 一个冒烟测试 + 能口述该结构与 Node 对应物是什么**。
> W4 Python 工具（见 Excel 第 4 周）与 W11 Maven job 沿用此定义；**Python 的冒烟测试在 W4 计划建立时落定**。

该定义在 Java 语境里推出，但规则本身与语言无关。Java 退出后它的唯一消费者是 Python，
因此 **D1 必须落定 Python 冒烟测试形态**（见 §5 决策清单第 2 条）。

---

## 1. 本周主线与交付物

**主线**：能读懂并讲清一个真实的 Python Agent 项目；建立可比较、可复现的检索基线。

**交付物（三项，各自独立可展示）**：

1. **Bub 调用链与架构阅读报告** —— turn lifecycle / hook 注册与调用 / tape 事件 / session 重建 context / model-tool-channel 职责边界。
2. **full-context 与 BM25 的对照数据** —— 同一题库下两种方式的可复现结果。
3. **带答案 key 的题库** —— 10–15 题，含正确来源 id 与**字符区间**；W13 直接复用为 eval 套件，不二次编写。

> **周交付物互相独立**：本周交的是「读懂 + 量化基线」，W13 交的是「构建 + 验证」。
> W12 三项产物本身即可单独展示，不以 W13 是否做完为前提。

## 2. 语料冻结（D1 完成）

以**本仓库 6 份协议文档**为语料：`AGENTS.md`、`LEARNING-PROTOCOL.md`、`TECHNICAL-WRITING-PROTOCOL.md`、
`SHOWCASE-VISUAL-PROTOCOL.md`、`SHOWCASE-DEPLOY-PROTOCOL.md`、`DEBT.md`。

选它的理由：

- **公开、非公司资料**——PPT 等公司材料明确不进入本实验（也不进仓库）。
- **不是自造语料**——自己编的语料会让 eval 变成循环论证（答案是自己埋的）。这 6 份是几个月真实过程长出来的。
- **含一处真实冲突**：展板发布目标 Pages vs 8081（`SHOWCASE-DEPLOY-PROTOCOL.md` 与已冻结的 `deploy-showcase-pages` skill），
  可直接充当 EvidencePack 的「冲突信息」样本，而不需要人为制造。
- 答案可核：结论能回到原文字符区间验证。

## 3. 每日节奏

### D1（8/31 周一）· 结账与冻结日，**不排新主题**

D1 在翻开之前已有接近一天的存量，形态沿用 W9 D1 契约冻结日。

- [ ] **DEBT 类 2 第一档盲重建**（第一入口，硬线，从零，不重写脚本）
- [ ] 本文件复核与定稿；建 `day1-contract-freeze.md`（W9 D1 形态：唯一验收 / 信任边界 / 止步条件 / 当日明确不做 / 语料冻结清单）
- [ ] 落定 §5 决策清单
- [ ] 语料冻结（§2）
- [ ] D5 口语稿 `day5-english-speaking.md` 补齐
- [ ] 条件项：cp/L55 闭合（root 会话可得才做，否则留 BACKLOG）

### D2（9/1 周二）· JS→Python delta（半天）+ 进入 Bub（半天）

delta 只学**迁移增量**，不做语法通览——对 JS 熟练的人，通览是浪费：

- import 与包语义、`__init__.py`
- exception 与错误传播（vs 返回错误）
- typing + Pydantic 的校验边界
- `dataclass`
- context manager
- sync / async 分裂

下午进入 Bub：定位入口与 turn lifecycle。

### D3（9/2 周三）· 读 Bub（全天）→ **阅读报告**

turn lifecycle、hook 注册与调用、tape 如何保存事件、session 如何重建 context、model / tool / channel 的职责边界。

> **重建练习不排在本日**：按 `LEARNING-PROTOCOL.md` §8，「不看代码画出调用链」是重建，
> 与阅读同日进行等于复述而非推导。Bub 盲重画排到 **W13 D5** 的 15–20 分钟单元。

### D4（9/3 周四）· Agent 所需 Python 能力 + 最小工具调用实验

- async / await、timeout、cancellation、context manager、异常边界、结构化输入输出
- 最小实验：一次真实模型调用 + 一次工具调用，且 **timeout 与 cancellation 各真实触发一次**
- **不实现完整 Agent**（那是 W13）
- 冒烟测试形态按 §5 第 2 条落定的结果执行

### D5（9/4 周五）· 检索基线 + 题库（一次造好）

- 只做 **full-context + BM25** 两种；embedding **留接口不实现**（理由见 §4）
- 题库 10–15 题**连答案 key 一次造好**，含正确来源 id 与字符区间
- 必含两类**检索侧**失败样本：① 正确来源不进 top-k；② top-k 含似是而非的干扰源
- 每题记录四项：正确来源是否进 top-k / citation 是否正确 / 无依据时能否拒答 / 失败案例
- 收口 + 状态更新

## 4. 本周明确不做

- embedding retrieval（留接口，W13 有余力再补；接口能插入第三种实现本身就是可展示的设计点）
- reranking、hybrid retrieval、GraphRAG、向量数据库
- 完整 Agent loop、trace、verifier、eval（**全部属 W13**）
- Web UI、MCP、多 Agent、长期记忆
- 自动 commit / push / merge
- 公司资料（含 PII 培训 PPT）作为语料
- 展板改动、部署、Pages 解冻
- stretch 两项（S3 / Docker）不排入 D1；Docker 已在 W13 D5 有归宿

**砍范围顺序**（出现时间压力时自上而下砍）：题库题量 15→10 → D4 最小实验的第二个工具 → BM25 参数调优 → D2 delta 的 context manager 一节。
**不可砍**：DEBT 重建、Bub 阅读报告、题库与答案 key、一种 retrieval baseline。

## 5. D1 单点决策清单（**待本人落定，AI 不预填**）

1. **唯一验收句**：本周做到什么算通过？（一句话，可证伪）
2. **Python 冒烟测试形态**：按 W9 §3.1 的通用定义落定——「可运行 + 一个冒烟测试 + 能口述该结构与 Node 对应物是什么」在 Python 上具体长什么样。
3. **止步条件**：每日做到什么就收工，什么自动顺延。
4. **信任边界**：哪些结论可直接采信（本仓库文本），哪些必须自己验证（Bub 行为、检索结果）。
5. **题库规模与题型配比**：正常 / 资料不足 / 来源冲突 各几题。
6. **BM25 的 top-k 取值与理由**。
7. **「检索命中」的判定口径**：正确来源进入 top-k 算命中，还是必须被引用才算。

## 6. AI 协作边界（W12 的黑白名单判断）

按 `AGENTS.md` §2（含 2026-08-28 补充）：

| 内容 | 归属 | 说明 |
|---|---|---|
| Python 语法、Pydantic / pytest / asyncio 写法 | **白名单** | 换一门语言就不成立的纯 API 细节 |
| BM25 库选型与调用样板 | **白名单** | 库 API |
| 项目脚手架、依赖、scripts | **白名单** | |
| Bub 的调用链结论 | **本人产出** | AI 可 review，不代写报告 |
| 题库题目、答案 key、失败样本设计 | **黑名单** | 属 eval 任务设计，上限 L2 |
| 「检索命中」判定口径、验收句 | **黑名单** | 正确性模型 |
| 模型 / Agent 的行为规律（会不会拒答、会不会引错） | **经验知识** | AI 直接讲，**不记债**（`AGENTS.md` §4 2026-08-28 补充） |

**债务预算（两周通用，开工前已定）**：`loop 控制流`与`终止状态机`两项坚持 **L1-only 手写**；
其余（工具契约 / trace schema / verifier 设计 / eval 任务选择）接受 L2，并把重建日期排到两周之后。
理由：账本按每周约一条校准，十天八条会让机制贬值；正确的调节钮是**砍范围**，不是降标准
（`AGENTS.md` §3：截止时间只影响砍范围，不影响援助上限）。

## 7. 与前后周的接口

**W11 → W12**：DEBT 类 2 重建（D1）· cp/L55 条件项 · stretch 两项归 BACKLOG P1-10。

**W12 → W13**：

- 题库与答案 key **直接复用**为 W13 D4 的 eval 套件，不二次编写。
- D5 的 retrieval 产出**是 W13 要用的模块**，不是一次性对比脚本。
- Bub 盲重画留到 W13 D5。
- W13 的 Agent 契约**不重新推导**：沿用 `week7-ai/notes/single-agent-harness-lab-plan.md`（2026-07-27，BACKLOG P0-2）——
  终止状态、trace 字段、工具原则与禁止清单、context/state/trace 三分、eval 术语与 grader 优先级均已定。
  W13 D1 只写一页 delta：Python 非 Node、文档语料非活系统、新增 RAG、新增 `clarification_required`。
  **省下的一天即 W13 的 buffer。**

## 8. 风险与上限

1. **D1 存量超出预期** → 触发时按 §4 砍范围顺序处理，不占用 D2 的 Bub 时间。
2. **DEBT 类 2 重建卡档** → 按 `AGENTS.md` §5 记卡档并另排单元；**不因此压缩 Bub 阅读**。
3. **Bub 规模超出一天半** → 只保证 turn lifecycle 与 tape 两条主链讲清，hook 与 channel 降为「已定位未深入」并如实标注。
4. **语料冲突样本不够** → 已确认至少一处真实冲突（Pages vs 8081）；不足时**不人为编造**，如实记录题库规模缩小。
5. **本周最大的真实风险仍是排期**：10 天零 buffer 的原始规划已通过「D1 不排新主题 + W13 D1 采纳既有契约」腾出约一天。再挤压将直接损失 W13 D5 的端到端演示。

## 9. AI 辅助记录

- **2026-08-28（本文件建立）**：AI 以 **L1** 提供规划 review 与排期校准，并按本人裁定落盘本文件与
  README / `LEARNING-STATE.md` / `BACKLOG.md` / `AGENTS.md` 的文档变更。
  **未对黑名单知识点给出 L2 骨架**；§5 决策清单与 §1 交付物的验收判据留空待本人落定。**不记债。**
