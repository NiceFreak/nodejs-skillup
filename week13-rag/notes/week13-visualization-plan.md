# W13 visualization plan — 内容素材草稿

> 建立：2026-09-09（Asia/Shanghai）。状态：**素材草稿，尚未进入展板实现**。
> 本文件只记录当周事实、证据与可迁移点，供周末整理展板时使用；进入任何页面实现前，
> 必须按 `SHOWCASE-VISUAL-PROTOCOL.md` §2 填十列设计契约，并由 `TECHNICAL-WRITING-PROTOCOL.md`
> 约束句子表达。当前主线未完成（baseline / BM25 / dense / holdout 未跑），展板整理不占主线。

## 0. 素材边界（事实快照）

- 对象：RAG（Retrieval-Augmented Generation）固定链路的前端输入工程。
- 本周已完成：corpus snapshot `rules-c0a4b85`（7 文件 76,243 bytes；raw corpus-only 18,697
  estimated tokens）；eval `w13-eval-v1`（dev/holdout 各 10 题，未运行模型）；Prompt `rag-prompt-v0`
  与 response schema；serialization 单一规范与 fixture；确定性 parser / citation registry /
  Evidence Context 实现（572 blocks，真实整串 sha256 `8a02c665…`，双跑一致，覆盖审计为 0）。
- 未完成边界：serialized 输入 token 计量、context budget、全语料上下文 baseline、BM25/dense、
  首次 holdout 均未执行；判据 #1–#7 逐字确认未完成。

## 1. 可迁移思维模式（每条：事实 → 可迁移点 → 边界）

### 1.1 契约先于实现
- 事实：D1 先冻结 corpus/manifest；D2 先冻结 eval 题意与判分；D3 先冻结 serialization 规范与
  fixture，之后才允许实现 parser。每个阶段门禁不过不叠加下一阶段。
- 可迁移点：任何含不可逆成本或影响后续对照的输入（语料、题库、配置、接口契约）先冻结版本与 hash，
  再进入实现；冻结后变更走新版本而非静默修改。
- 边界：冻结不等于正确；语义边界（如 source block 分得是否合理）仍由后续 eval 暴露。

### 1.2 按输出边界分层设判据
- 事实：serialization 是纯函数链 spans → model_content → source wrapper → Evidence Context；
  D3 判据 #1–#7 分别放在正文/hash、wrapper、组装与稳定、职责边界四类输出上。
- 可迁移点：对确定性管线，在每个中间输出的字节边界放一个可自动化断言，比在末端放一个总检查更容易定位哪层坏了。
- 边界：判据只覆盖「能写成字节相等或结构不变量」的属性；语义判断（如 atomic claim 是否成立）留在人工。

### 1.3 hash 是盲的，需要字节级 golden 补盲
- 事实：content_sha256 只覆盖 model_content，wrapper/块序/分隔符错误 hash 全绿；
  因此 fixture A/B/C 用期望字节补 hash 抓不到的组装层错误。
- 可迁移点：指纹只能证明「同一对象没变」，不能证明「对象之间的关系正确」；关键结构错误要用
  期望字节（golden）或结构性不变量兜底。
- 边界：golden 只在「期望本身正确」时有效；期望来自契约语义，不是实现自证。

### 1.4 确定性层与概率层分离
- 事实：corpus/parser/registry/eval 结构全部脚本化与双跑一致；模型只出现在 generation 层。
- 可迁移点：系统含模型或其它不可控层时，先把可控层做成确定性、可重跑、可冻结的，失败归因
  （retrieval miss / context assembly / prompt / generation）才可能成立。
- 边界：当前只验证了确定性层可重复；generation 质量与端到端结果尚未验证。

### 1.5 脚本验收 > 声称，但脚本必须能触发目标机制
- 事实：本周实现用 pytest + CLI 双跑 + 审计落盘代替口头验收；同时仓库历史有脚本假绿反例
  （W11 validate-logs 对注入的假私钥头不报警；dry-run 不触发 pre-receive 检查）。
- 可迁移点：验收输出应来自可复算命令且与断言语义分离；断言必须可证伪、要测的目标机制必须真的被触发。
- 边界：脚本本身可能写错断言；判什么、阈值多少仍由人冻结，不由实现方自证。

### 1.6 身份与指纹分离
- 事实：source_id（`corpus/source#Lstart-Lend`）是位置身份；content_sha256 是内容指纹；
  两者职责不同：位置变化不影响指纹，内容变化不改变身份。
- 可迁移点：实体索引、缓存 key、trace/verifier schema 设计时应显式区分「身份」与「内容完整性」两类校验。
- 边界：指纹用于完整性校验，不替代身份；引用回源以 source_id 为准。

### 1.7 回归基准与冻结纪律
- 事实：真实全语料整串 sha256 首次产出后待冻结为 regression 基准；holdout 首次运行只能在
  serialization/Prompt/BM25/dense/eval/实现与评分全部冻结后，且首跑结果不用于调参。
- 可迁移点：评估系统与 harness 的结果处理分「冻结前」与「冻结后」两种状态；冻结后只按预先登记的
  regression 节点复跑，防止结果反向调参造成虚高。
- 边界：首跑成功只证明当次链路可运行，不证明质量或掌握；dense 与 holdout 未完成时如实写为部分完成。

### 1.8 评估隔离
- 事实：dev/holdout 物理分离并共享 schema；reference answer / expected branch / evidence
  requirement 不进模型输入；Prompt 只承载规则，Query 只含 query。
- 可迁移点：任何带金标的实验先隔离评估输入；对 W14 Agent 同样适用于 verifier 语义与工具权限边界。
- 边界：物理隔离只是结构条件，不等于题目质量或判分正确。

## 2. 给展板的可能数据面（不预写形态）

- 语料：7 文件 / 76,243 bytes / 18,697 estimated tokens（raw）。
- serialization 产物：572 blocks（kind 计数见 `evidence/serialization/criteria-report-rules-c0a4b85.md`），
  Evidence Context 89,854 chars，整串 sha256 `8a02c665…`，双跑一致。
- 管线层次：query → retrieval（未实现）→ context assembly（已实现）→ generation（未实现）→ citation/abstention（未实现）。

> 以上数字均为已实测/已估算值；若后续计量改变，以最新证据为准，展板文案由数据计算不手写。
