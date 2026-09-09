# W13 visualization plan — 内容素材草稿

> 建立：2026-09-09（Asia/Shanghai）。状态：**设计契约已裁决，可进入实现排期；尚未开工**（开工门槛见 §3.3）。
> §0-§2 是当周事实、证据与可迁移点的素材记录；§3-§15 是按 `SHOWCASE-VISUAL-PROTOCOL.md` §2 产出的
> 十列设计契约与形态推导，由 `TECHNICAL-WRITING-PROTOCOL.md` 约束句子表达。
> 设计契约由实现方先写、经本人过目后才能写数据层或 JSX（视觉规范 §2）；§14 记录本人授权按推荐方案作出的裁决。
> 当前主线未完成（serialized 输入计量 / baseline / BM25 / dense / holdout 未跑），展板整理不占主线。
>
> 修订记录：
> - 2026-09-09 第一稿经独立审计后修订，10 处均经复算确认：瀑布基线与增减方向、管线阶段口径、normalization
>   不属于校验步骤、corpus 校验证据缺口、T5 矩阵坐标改为验证手段 × 被验证对象、C1/C5 对照结论删除并改为
>   可核对观察、标题层数与 `context_spans` 条数的区分、metric 阈值只对两条门禁、§1.7 过期时态、② 列拆分。
> - 同日按本人指示收窄范围：只把已写成、有产物可核的内容做成方案，未完成阶段整体退出（§3.5 进板/不进板表）；
>   删除管线总览块与 metric 状态图，T3 不再出现 token 单位的量；笔记与代码不动，不为展板补脚本。

## 0. 素材边界（事实快照）

- 对象：RAG（Retrieval-Augmented Generation）固定链路的前端输入工程。
- 本周已完成：corpus snapshot `rules-c0a4b85`（7 文件 76,243 bytes；raw corpus-only 18,697
  estimated tokens）；eval `w13-eval-v1`（dev/holdout 各 10 题，未运行模型）；Prompt `rag-prompt-v0`
  与 response schema；serialization 单一规范与 fixture；确定性 parser / citation registry /
  Evidence Context 实现（572 blocks，真实整串 sha256 `8a02c665…`，双跑一致，覆盖审计为 0）。
- 未完成边界：serialized 输入 token 计量、context budget、全语料上下文 baseline、BM25/dense、
  首次 holdout 均未执行。
- 本行原写「判据 #1–#7 逐字确认未完成」，与同日 `LEARNING-STATE.md` 冲突；实际状态为判据 #1–#7 已由本人
  逐条确认、整串基准已冻结（`evidence/serialization/frozen-rules-c0a4b85.sha256`），仍未完成的是 review
  工作表语义点 A1–A8 的批注回填，因此 serialization 实现里程碑（L1）未正式闭合。

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
- 事实：真实全语料整串 sha256 已于 2026-09-09 冻结为 regression 基准
  （`evidence/serialization/frozen-rules-c0a4b85.sha256`）；holdout 首次运行只能在
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

---

## 3. 展板范围、读者与开工边界

### 3.1 完成对象

一块只覆盖 W13 **已写成内容**的展板：corpus 冻结、source block 切分与引用、Evidence Context 组装、eval 契约、
serialization 的验证证据。五个模块都有仓库内产物可核（manifest、registry、Evidence Context 整串、
criteria-report、dev 题集、判分契约、9 条测试）。目标是扫描 10 秒能读出结论、图形承载结论、正文退到第二层。

### 3.2 读者与使用场景

- 主要读者是本人，用于延迟复习与 W14 harness 前的机制回忆。
- 次要场景是对外演示 AI Engineer 阶段的工程方法；演示状态不改变事实强度，只改变可见模块集合。

### 3.3 开工门槛

- 本方案只是设计契约，不构成开工许可。实现排在 W13 主线达到当日止步条件之后，按 `LEARNING-STATE.md`
  的「周末条件项」执行。
- 实现前必须经本人 review 本方案（视觉规范 §2：编码表由实现方先写，本人过目后才能实现）。
- 实现期若改变核心图形、分页或主路径，先回写本方案，不用执行记录事后替代设计契约。
- 实现只新增展示资产文件（§11），**不修改 `week13-rag/` 下的笔记、代码、测试与证据产物**。

### 3.4 与既有展板的关系

- W12 方案已定：W13-W16 产出在 `ai-engineer` 板内加组，不新增顶层 tab
  （`week8-fullstack/notes/w12-ai-visualization-plan.md` §2 范围门禁）。本方案沿用该门禁。
- 因此本方案的五块是 `ai-engineer` 板内的**功能模块组**（`AeGroup` 级），不是顶层 `ShowcaseTab`；
  为避免与代码里已有的 `ShowcaseTab` 混指，全篇不用「tab」称呼这五块。
- 形态一律按 §5 从内容关系推导。既有 `framePlayer` / `charts` / 泳道 CSS 只在 §11 作为实现复用候选出现，
  不作为形态依据（视觉规范 §1 护栏、§3 形态推导纪律）。

### 3.5 进板与不进板（按 2026-09-09 的完成状态划线）

| 进板（有产物可核） | 产物 |
|---|---|
| corpus snapshot `rules-c0a4b85`、manifest、normalization 记录、raw corpus-only token 估算 | `corpus/rules-c0a4b85/`、`evidence/token-count-rules-c0a4b85.json` |
| source block 切分规则、parser、citation registry、source identifier | `src/w13rag/`、`evidence/serialization/registry-rules-c0a4b85.json` |
| serialization 规范、Evidence Context 整串、冻结基准 | `evidence/serialization/evidence-context-*.txt`、`frozen-rules-c0a4b85.sha256` |
| eval 契约：dev 题集结构、判分条件、metric 定义与阈值 | `eval/dev/items.json`、`eval/scoring-contract.md` |
| 判据 #1–#7、9 条测试、覆盖审计、two-pass | `tests/`、`criteria-report-rules-c0a4b85.md` |

| 不进板（未完成，本方案不预画、不渲染占位） | 何时进 |
|---|---|
| retrieval（BM25 / dense）、generation、citation 判分运行、baseline、holdout 首跑 | 主线跑出证据后另立模块组，按本规范重新推导形态 |
| serialized 输入 token 计量、context budget | 同上；进板前 T3 不放任何 token 单位的量 |
| review 工作表 A1–A8 批注、破坏性验证、L1 闭合状态 | 本人回填后再决定是否上板 |
| 任何 metric 的实测值 | 无运行即无值；不渲染「未测量」占位格 |

Prompt v0 与 response schema 已冻结但尚未接入模型；它们只在 T4 的折叠层作为判分输入的形状出现，不单独成块。

### 3.6 硬边界（违反即阻断验收）

| # | 边界 | 原因 |
|---|---|---|
| H1 | 展板任何状态都不显示 eval 受保护 split 的题面、query、预期结论或证据要求 | `AGENTS.md` §1.3 受保护内容；该 split 只能出现计数、结构与冻结状态 |
| H2 | §3.5 不进板的内容不出现在数据层与 DOM 中，也不以「未测量」「待运行」占位格出现 | 本方案只做已写成内容；占位格会把未完成项渲染成板面的一部分 |
| H3 | bytes、chars、token 三个单位在同一图内必须各自标注，不互相换算 | D1 术语表：byte / 字符 / token 不能直接换算 |
| H4 | 每个数字标注事实等级（已实测 / 已估算 / 一次性记录），估算值标 `estimate` | `TECHNICAL-WRITING-PROTOCOL.md` §2 |
| H5 | 不呈现任何模型回答样例为「运行结果」；契约演示用的合成响应必须标注排除在正式题集之外 | 尚未调用模型 |
| H6 | 计数、比例、状态由数据层计算，不手写进文案 | 视觉规范 §2.1 |

## 4. 模块组划分（按功能与模块，不按天）

按天划分会把同一个机制拆到相邻两天（例：source block 语义在 D2 冻结、parser 在 D3-D4 实现、判据在 D4 执行），
读者要跨模块组才能读完一条机制。按功能划分让每一块回答一个可独立成立的问题。

| 模块组 | 名称 | 这一块只回答什么 | 覆盖的模块与产物 | 对应原始阶段（不作导航依据） |
|---|---|---|---|---|
| T1 | 输入冻结 | 靠什么证明「现在读到的和当初冻结的是同一份语料」 | `corpus/rules-c0a4b85`、manifest、normalization、raw token estimate | D1 |
| T2 | 切分与引用 | Markdown 怎样被确定性切成可引用 block，ID 指向什么 | source block 规则、`parser.py`、citation registry、source identifier | D2 + D4 |
| T3 | 组装与组成 | 进入模型的 Evidence Context 由哪几部分组成，各有多大 | `serialize.py`、Evidence Context 整串 | D3 + D4 |
| T4 | 评测契约 | 一题什么条件算通过，什么条件直接否决整个 split | `w13-eval-v1`、判分契约、split 隔离 | D2 |
| T5 | 验证与证据 | 每种验证手段各自管到哪里，哪些对象没有自动化断言 | 判据 #1–#7、9 条测试、覆盖审计、two-pass、冻结基准 | D3-D4 |

每个模块组底部各挂一道复习题（只考一个设计点，答案默认折叠），题面见 §6 各块第 ⑥ 列。

全篇「模块组」指 `ai-engineer` 板内 `AeGroup` 级导航；顶层 `ShowcaseTab` 不新增，实现时不要改 `types.ts`。
板头放一句范围说明：「本板只覆盖冻结输入与 context assembly；retrieval、generation 与评测运行未进入」——
这是文字边界，不是模块组，也不画管线。

## 5. 形态推导表

推导顺序固定为：内容核心关系 → 认知任务 → 形态；本表只用内容本身作输入。动效分类按视觉规范 §3.3：
① 语义过程动效（内容随时间变化，必须可暂停/单步/重放）；② 方位过渡；③ 纯装饰（禁止）。

| 块 | 内容核心关系（一句话） | 认知任务 | 推导出的形态 | 动效分类与理由 |
|---|---|---|---|---|
| T1 | 一次完整性校验按固定顺序发生：读取快照文件 → 计算 bytes/sha256/git blob → 与 manifest 逐文件比对 | 顺序、逐项对照、数量差异 | 文件条（共用基线长度编码）+ 右挂逐文件比对格 + 三步校验序列 | ①语义过程动效：校验是真实按序执行的三步过程，逐帧一步。normalization 不在这条时间轴上，它发生在建快照时（见 §6.1 ⑥） |
| T2 | parser 逐行扫描源文档，标题栈随行推进 push/pop，块边界在特定行落下，thematic break 是不可跨越的硬边界 | 顺序、层级包含、边界 | 行序舞台：左侧源行、右侧标题栈阶梯、行间落下的块边界刻度；下方块类型与标题层数分布 | ①语义过程动效：确定性扫描本身随行推进，每帧只推进一行并只引入一个状态变化 |
| T3 | 全语料 89,854 chars 里只有 32,171 来自核心正文；其余分别来自语境复制与 wrapper/分隔，且原文另有 2,183 chars 从不进入核心 | 数量差异、形状变化、包含 | 共用基线瀑布：原文 → 核心正文（下降）→ model_content（上升）→ Evidence Context（上升）；旁挂单个 entry 的四形态变形 | ①语义过程动效只用于**单个 entry 的四形态变形**（确定性变换链）；全语料瀑布是静态量对比，不演成过程 |
| T4 | 判分是一条顺序检查链，任一条件失败即该题失败；其中一个条件失败会直接否决整个 split | 分叉、停止位置、二维分类 | 判分路径图（answered/abstained 两条链 + 否决出口标在链上位置）+ 5×2 覆盖矩阵，格内编码预期分支 | ①语义过程动效：单题判分按序推进，逐帧一个条件；样例为合成响应并标注非运行结果 |
| T5 | 不同验证手段各自只覆盖一部分输出对象；`content_sha256` 只覆盖 model_content，wrapper 与块序靠 fixture 期望字节补上，职责边界目前没有自动化断言 | 二维分类、覆盖空格 | 覆盖矩阵：验证手段 × 被验证对象，空格即该手段管不到的地方 | ②方位过渡：矩阵格与右侧测试清单之间点击互相高亮。覆盖关系是静态事实，不演成过程 |

颜色一律作第二编码：状态另用填充图案与文字标签，分布图另带数值标签。灰度打印或未读图例时仍可读出全部差异。

## 6. 逐块十列设计契约

列名按视觉规范 §2：① 单一问题 ② 10 秒结论 ③ 对象与数据形状 ④ 结论编码 ⑤ 视觉舞台 ⑥ 文字层级
⑦ 视觉记忆点 ⑧ 图标策略 ⑨ 动效策略 ⑩ 验收证据。

② 列统一写成「主结论（首屏最大字号，≤40 字，只承担一个判断）+ 常驻边界短句」；限定语按 ⑥ 下沉，
使主路径正文落在 §12 的字数护栏内。

### 6.1 T1 · 输入冻结：语料快照与逐文件完整性

| 列 | 内容 |
|---|---|
| ① 单一问题 | 冻结一份语料之后，靠什么证明「现在读到的和当初冻结的是同一份」？ |
| ② 10 秒结论 | **主结论**：完整性由 manifest 逐文件的 bytes、sha256 与 git blob 比对证明，不是整体判断。**常驻边界**：① 18,697 tokens 是离线 tokenizer 的估算（`estimate`），不是 provider usage；② normalization 发生在建快照时，不是校验的一步 |
| ③ 对象与数据形状 | 7 文件 × (bytes、chars、行数、sha256 前 8 位)；一次校验 3 步；1 个 token 估算值 + 分类 `estimate` + tokenizer 版本。校验结论只有一条整体记录（2026-09-07 全部通过，见 §7.4），仓库内没有逐文件通过状态的可复算产物，因此不做逐文件状态格 |
| ④ 结论编码 | 长度（共用基线的文件体量条，按 bytes）+ 顺序（校验三步）+ 逐行对照（每行文件条右侧并列 manifest 记录值与本次读取值） |
| ⑤ 视觉舞台 | 首屏：7 行文件条左对齐共用基线，每行右端并列两个值；上方主结论；三步校验条位于文件区正上方并与当前帧联动 |
| ⑥ 文字层级 | 常驻：主结论、两条边界、单位标注（bytes 与 chars 并列，token 单列并标 `estimate`）；折叠：normalization `repository-content-v1` 的含义与「不移动既有正文行号」边界、被拒绝的 tokenizer 版本（5.16.1/0.23.2 因中文与空格回环失败）、2026-09-07 校验记录的原文出处；notes：D1 原文。复习题「manifest 记录的 sha256 变了，能不能推断出正文被改？」 |
| ⑦ 视觉记忆点 | 7 行文件条右端各并列一对指纹值——完整性是逐文件的，不是一个总数 |
| ⑧ 图标策略 | 无状态图标（无逐文件状态数据）；文件类型不加图标 |
| ⑨ 动效策略 | ①语义过程动效：三帧 = 读取快照文件 → 计算 bytes/sha256/git blob → 与 manifest 逐文件比对；每帧只引入一步。末帧呈现比对完成，不显示实时通过态（无该数据）。可暂停、单步、重放；`prefers-reduced-motion` 下停在末帧 |
| ⑩ 验收证据 | 验收句：完整性校验的比对粒度是什么？断言：7 个文件条的长度顺序与 manifest bytes 排序一致；bytes/chars/token 三个单位各自带标注；页面不出现未落盘的逐文件通过状态；两视口截图 |

### 6.2 T2 · 切分与引用：parser 扫描与身份 / 指纹分离

| 列 | 内容 |
|---|---|
| ① 单一问题 | 一份 Markdown 怎样被确定性地切成可引用的 source block，引用 ID 指向的又是什么？ |
| ② 10 秒结论 | **主结论**：572 个 block 由不调用模型的 parser 按冻结规则重算，ID 只标核心行范围。**常驻边界**：① 必要标题与表头进 `context_spans`，不扩大 ID 的行范围；② `content_sha256` 只验证完整性，不作身份 |
| ③ 对象与数据形状 | 一段真实源文档的连续行（含标题、表格、`---`）；标题栈层级；6 类 block 计数（list_item 349 / paragraph 144 / table_row 43 / code 23 / quote_para 10 / quote_list 3）；**标题层数**分布 4 档（1 层 15 / 2 层 391 / 3 层 156 / 4 层 10）；43 个 table_row 块各另带 1 条 `table_header` 语境；7 份文档各自 block 数与 bytes |
| ④ 结论编码 | 位置（行序）+ 包含（标题栈阶梯的嵌套层级）+ 边界（块边界刻度落在行间）+ 长度（类型分布与标题层数分布共用基线）。core 行与 context 行用线型与行首标记区分，不只靠颜色 |
| ⑤ 视觉舞台 | 首屏：左栏真实源行（带行号）、右栏标题栈阶梯、两栏之间落下块边界刻度；上方主结论；分布图（C3 / C4 / C1+C5 对照）在第二屏区域，首屏不占位 |
| ⑥ 文字层级 | 常驻：主结论 + 两条边界；折叠：六条切分规则原文（列表按顶层项、表格按数据行附表头、fence 只向前合并、blockquote 递归、`---` 硬边界）；notes：D2 原文。复习题「附加标题进入 model_content，为什么不进入 source_id 的行范围？」 |
| ⑦ 视觉记忆点 | 标题栈的阶梯随行升降，块边界刻度在 `---` 处永不跨越 |
| ⑧ 图标策略 | 块类型用固定形状标记 + 名称（首次出现同时给名称）；标题栈层级不用图标，用缩进与层号 |
| ⑨ 动效策略 | ①语义过程动效：每帧推进一行，只引入一个状态变化（标题入栈 / 出栈、块边界落下、遇 `---` 停止合并）。帧数据来自真实文档片段与 registry 实测结果。可暂停、单步、重放；reduced-motion 下渲染全部边界的静态终态 |
| ⑩ 验收证据 | 验收句：ID 与 hash 各自负责什么？断言：① 块类型计数之和 === 572 且由数据计算；② 标题栈层数 === 该 entry 中 `role` 为 `heading` 的 `context_spans` 条数（**不是** `context_spans` 总数——43 个表格块还带 `table_header`）；两视口截图 |

### 6.3 T3 · 组装与组成：Evidence Context 由什么构成

| 列 | 内容 |
|---|---|
| ① 单一问题 | 进入模型的 Evidence Context 由哪几部分组成，各部分分别有多大？ |
| ② 10 秒结论 | **主结论**：进入模型的 89,854 chars 里，只有 32,171 来自核心正文。**常驻边界**：① 另外 20,826 来自把必要标题与表头复制进每个块，36,857 来自 wrapper 与块间空行；② 单位是字符，不是 token |
| ③ 对象与数据形状 | 四级量（chars）：语料原文 34,354 → 核心 `source_span` 正文 32,171 → `model_content` 合计 52,997 → Evidence Context 89,854。两段上升（语境复制 +20,826、wrapper 与分隔 +36,857，其中标签 35,715、块间空行 1,142）与**一段下降**（−2,183：97 行标题 1,489 + 381 行空行 381 + 33 个 `---` 132 + 12 行表头与分隔 181）；单个 entry 的 4 个形态字节 |
| ④ 结论编码 | 共用基线的瀑布（含一段下降，方向本身是信息）+ 分段填充（增量来源分层）+ 形状变形（单个 entry 四次变宽）+ 包含（`model_content` ⊂ serialized block ⊂ Evidence Context） |
| ⑤ 视觉舞台 | 首屏：瀑布图占主位（四级量 + 一降两升），主结论在其正上方；右侧并排单个 entry 的四形态。本块**不出现任何 token 单位的量**（§3.5：token 计量与 context budget 未完成，不进板） |
| ⑥ 文字层级 | 常驻：主结论 + 两条边界 + 单位标注；折叠：wrapper 精确字节规则、块间恰一个空行与首尾无空行、hash 只覆盖 `model_content`、`---` 与空行为何从不进入核心；notes：D3 §6.2.0 原文。复习题「块间空行属于哪一层，为什么它不进入 `content_sha256`？」 |
| ⑦ 视觉记忆点 | 瀑布里那一段向下的台阶——原文里有 2,183 chars 从不进入任何可引用块，其中标题与表头随后以语境身份重新进入，`---` 与空行不再出现 |
| ⑧ 图标策略 | 无新图标；wrapper 用真实标签文本 `<source id="…">` 显示，不用符号替代 |
| ⑨ 动效策略 | ①语义过程动效只用于右侧单个 entry：四帧 = 核心 span → 前置必要语境 → 包 wrapper → 与相邻块之间加空行，末帧字节与 registry 实测一致。左侧全语料瀑布静态呈现，不演成过程（合计量不是一次随时间发生的变换） |
| ⑩ 验收证据 | 验收句：89,854 里有多少来自核心正文？断言：① 四级量与三段增减全部由 registry 与 Evidence Context 产物计算，无硬编码；② 32,171 + 20,826 === 52,997 且 52,997 + 36,857 === 89,854（构建期自检）；③ 本块 DOM 不含 token 单位数值；两视口截图 |

### 6.4 T4 · 评测契约：通过条件与否决条件

| 列 | 内容 |
|---|---|
| ① 单一问题 | 一道 eval 题在什么条件下算通过，什么条件会直接否决整个 split？ |
| ② 10 秒结论 | **主结论**：一题要同时满足全部条件才通过；预期 abstained 却返回 answered 直接否决整个 split。**常驻边界**：① dev 五类行为各 2 题（8 题预期 answered、2 题预期 abstained，共 18 条 evidence requirements）；② 本块只呈现契约，尚无任何运行结果 |
| ③ 对象与数据形状 | 5 类行为 × 2 个 split 的覆盖矩阵，**格内编码该类的预期分支**（no_answer 行为 abstained，其余四行为 answered）；answered 8 条 / abstained 5 条判分条件的顺序链；6 个 metric 的定义，其中门禁 2 个带阈值（item_pass_rate ≥ 0.9、citation_precision = 1.0）、诊断 4 个无阈值——只作为契约文本进折叠层，不做状态图 |
| ④ 结论编码 | 矩阵（行为类型 × split，格内分支编码使矩阵不再零方差）+ 分叉（answered / abstained 两条判分链）+ 停止位置（否决出口标在链上的具体位置）+ 覆盖格状态（dev 可展开、受保护 split 上锁） |
| ⑤ 视觉舞台 | 首屏：判分链占主位（否决出口用停止标记落在链上的确切位置），5×2 覆盖矩阵置于其左侧且尺寸小于判分链；主结论在两者上方 |
| ⑥ 文字层级 | 常驻：主结论 + 两条边界；折叠：8 条 answered 条件与 5 条 abstained 条件原文、6 个 metric 定义与两条阈值、`corpus_absence` 是评测者预先冻结的判分依据、Prompt v0 输入边界与 response schema 的形状（判分读取的对象）；notes：判分契约原文。复习题「citation_precision 阈值为 1.0，为什么 claim 零 citation 时它不能记为通过？」 |
| ⑦ 视觉记忆点 | 判分链上那个停止标记的位置——否决不在链尾，而在分支判定处 |
| ⑧ 图标策略 | 锁形标记表示受保护 split（accessible name「内容受保护，不展示」）；停止标记表示否决出口；其余用文字 |
| ⑨ 动效策略 | ①语义过程动效：单题判分逐帧推进一个条件并显示通过 / 失败。样例响应为 §14.1 的 S-A / S-B 合成数据，帧内常驻标注「契约演示，非模型运行结果，不属于任何正式题集」。可暂停、单步、重放 |
| ⑩ 验收证据 | 验收句：哪一个条件失败会否决整个 split？断言：① 受保护 split 的列在 DOM 中只有计数与状态、无题面字段；② 本块 DOM 不含任何 metric 数值或占位状态格；两视口截图 |

### 6.5 T5 · 验证与证据：验证手段的覆盖与空白

| 列 | 内容 |
|---|---|
| ① 单一问题 | 每种验证手段各自管到哪里，哪些对象目前没有自动化断言？ |
| ② 10 秒结论 | **主结论**：确定性组装层可重跑并与冻结基准一致；职责边界（判据 #7）没有自动化断言。**常驻边界**：① 9 条测试与覆盖审计只覆盖确定性层，不证明语义切分合理或模型回答正确；② wrapper 前置检查发生在构建期，不在 `tests/` 里 |
| ③ 对象与数据形状 | 覆盖矩阵 = 6 种验证手段（`content_sha256` / fixture 期望字节 / 结构不变式 / two-pass / 构建期前置检查 / 无自动化）× 5 类被验证对象（`model_content` 正文 / wrapper 字节 / 块序与块间分隔 / registry 契约（重复 ID、排序）/ 职责边界）；9 条测试（5 fixture + 4 真实语料）各自落到哪格；7 份文档 uncovered 与 duplicated 均为 0；整串 sha256 `8a02c665…` 与冻结基准一致 |
| ④ 结论编码 | 矩阵（验证手段 × 被验证对象）+ 覆盖空格（`content_sha256` 行只有一格有值；「职责边界」列只落在「无自动化」行）+ 归属（每条测试连到它覆盖的格） |
| ⑤ 视觉舞台 | 首屏：覆盖矩阵占主位，`content_sha256` 那一行的空格清晰可见；右侧 9 条测试清单，点击高亮对应格；主结论在矩阵上方 |
| ⑥ 文字层级 | 常驻：主结论 + 两条边界；折叠：判据 #1–#7 逐字原文与它们各自的观察对象、criteria-report 的逐文档审计表；notes：D3 §6.1 原文。复习题「fixture 期望字节能抓到哪一类 `content_sha256` 抓不到的错误？」 |
| ⑦ 视觉记忆点 | `content_sha256` 那一行只有一格有值——指纹全绿只说明 `model_content` 没变，说明不了块与块的关系 |
| ⑧ 图标策略 | 覆盖格用形状 + 文字（已覆盖 / 该手段管不到）；冻结基准用锁形标记；无其它图标 |
| ⑨ 动效策略 | ②方位过渡：矩阵格与测试清单之间点击互相高亮，短过渡不循环。不做过程动画，理由见 §5 |
| ⑩ 验收证据 | 验收句：`content_sha256` 管不到什么，被什么补上？断言：① 矩阵格状态由数据层计算；② 「职责边界」列在「无自动化」行有值；③ 9 条测试各至少连到一格；两视口截图 |

## 7. 数据层规格

### 7.1 由脚本计算、不手写进文案的量

数据层在构建期由一个只读脚本从既有产物导出为 TS 数据模块；展板不在运行时读文件系统。

| 量 | 来源产物 | 当前值（2026-09-09 复算，实现以脚本输出为准） |
|---|---|---|
| 文件数 / bytes | `corpus/rules-c0a4b85/manifest.json` | 7 / 76,243 bytes |
| 文件 chars / 行数 | snapshot 文档 | 34,354 chars / 1,346 行（其中非空行 936） |
| block 总数 | `evidence/serialization/registry-rules-c0a4b85.json` | 572 |
| block 类型分布 | **`criteria-report-rules-c0a4b85.md`**（registry entry 无 `kind` 字段） | list_item 349 / paragraph 144 / table_row 43 / code 23 / quote_para 10 / quote_list 3 |
| 每文档 block 数 | registry（按 `source_span.source_path` 聚合） | AGENTS 104 / DAILY-LEARNING-REPORT 71 / DAILY-SPEAKING 32 / LEARNING 100 / SHOWCASE-DEPLOY 78 / SHOWCASE-VISUAL 100 / TECHNICAL-WRITING 87 |
| `context_spans` 角色计数 | registry | heading 1,305 + table_header 43 = 1,348 |
| 标题层数分布 | registry（每块 `role == "heading"` 的条数） | 1 层 15 / 2 层 391 / 3 层 156 / 4 层 10 |
| 核心 `source_span` 正文 chars | registry + snapshot（按契约规范化后复算） | 32,171 |
| 语境复制增量 chars | registry（`context_spans` 同法复算） | 20,826（32,171 + 20,826 === 52,997，可作构建期自检） |
| `model_content` 合计 chars | registry | 52,997 |
| Evidence Context chars | `evidence-context-rules-c0a4b85.txt` | 89,854 |
| wrapper 标签 / 块间空行 chars | 由 `source_id` 长度与块数计算 | 35,715 / 1,142（合计 36,857） |
| 未进入核心的原文 chars | snapshot 减去核心行 | 2,183（标题 97 行 1,489；空行 381 行 381；`---` 33 行 132；表头与分隔 12 行 181） |
| 覆盖审计（uncovered / duplicated） | `criteria-report-rules-c0a4b85.md` | 7 份文档均为 0 / 0 |
| 整串 sha256 与冻结基准 | `frozen-rules-c0a4b85.sha256` | `8a02c665…`，两次构建一致 |
| raw corpus-only token | `evidence/token-count-rules-c0a4b85.json` | 18,697，分类 `estimate` |
| dev 题目结构 | `eval/dev/items.json` | 10 题；五类各 2；8 answered / 2 abstained；18 条 evidence requirements（16 source_span + 2 corpus_absence） |
| 受保护 split 结构 | 见 §7.3 | 只取题数与覆盖类别 |
| 9 条测试与覆盖格的映射 | `tests/*.py` 的测试名（静态读取，不运行） | 5 fixture（A/B2/A-serialized/双块整串/C 顺序）+ 4 真实语料（无遗漏重复 / two-pass / hash 复算与 ID 一致 / 首尾无空行） |
| corpus 完整性校验结论 | 无可复算产物；仅 D1 笔记的一次性记录 | 见 §7.4 |

### 7.2 状态字段与事实等级

每条事实条目至少带：`value`、`unit`（bytes / chars / tokens / count）、`evidence`
（`已实测` / `已估算` / `一次性记录`）、`sourcePath`。

- 本方案范围内没有「未运行」的条目（§3.5 已把它们排除在数据层之外），因此不设 `null` 值与占位渲染规则；
  未来接入运行结果时再按判分契约 §5 的 `N/A` 语义另立字段。
- 结论句不写死计数，模板从数据插值（H6）。

### 7.3 受保护内容在数据层的处理

导出脚本对受保护 split 只允许写入 `count`、`behaviorTypes`、`frozen` 三个字段。这三项**不从该 split 的
文件读取**，而是取自判分契约 §5/§6 与 `LEARNING-STATE.md` 的已冻结决定（`eval/manifest.json` 只有各文件
sha256，不含题数与行为类别）。脚本本身不打开该目录。审查点：导出产物中不得出现该 split 的 query 或
`expected_rule_conclusion` 字符串。

### 7.4 corpus 完整性校验的证据等级

D1 笔记记录「manifest 汇总与当前内容的逐文件字节/SHA-256/Git blob 校验均通过」（2026-09-07），仓库内
没有可重跑的校验命令，也没有落盘的逐文件结果（`scripts/` 只有 `w13rag.sh` 与 `inspect-block.sh`，
`cli.py` 不复算 bytes 或 sha256）。按本人指示，本方案不新增脚本，T1 按「一次性记录」等级呈现：
不做逐文件通过状态格，动效末帧不显示实时通过态。

## 8. 动效与交互规格

### 8.1 分类落位

| 位置 | 分类 | 帧数 | 每帧引入的唯一新事 |
|---|---|---|---|
| T1 完整性校验 | ①语义过程 | 3 | 读取快照文件 / 计算 bytes、sha256、git blob / 与 manifest 逐文件比对 |
| T2 parser 扫描 | ①语义过程 | 每帧一行（片段约 12-16 行） | 标题入栈、标题出栈、块边界落下、遇 `---` 停止合并，四种事件之一 |
| T3 单个 entry 组装 | ①语义过程 | 4 | 核心 span / 前置必要语境 / 包 wrapper / 加块间空行 |
| T4 单题判分 | ①语义过程 | 与该分支条件数一致（answered 8 / abstained 5） | 推进一个条件并给出通过或失败 |
| T5 矩阵与测试清单联动 | ②方位过渡 | — | 高亮位置变化，短时、不循环、关闭后不丢信息 |
| T3 全语料瀑布 | 静态 | — | 合计量对比不是随时间发生的变换 |
| 全站 | ③纯装饰 | 0 | 不使用 |

### 8.2 播放控制与可访问性

- 每个语义过程动效必须提供暂停、单步前进、单步后退、重放，控件有 accessible name 与键盘可达。
- `prefers-reduced-motion` 下：不自动播放，渲染信息完整的终态，单步控件保留。
- 帧解说使用 live region 播报当前帧引入的变化；帧内所有状态另有文字标签，不依赖颜色或位移。
- 帧停留时长按解说文本长度计算，不使用固定节奏。

### 8.3 交互与深链

- 五个功能模块组与当前专题写入 URL；刷新与分享不丢位置。
- 折叠区摘要必须写明里面是什么（例：「判据 #1–#7 逐字原文」），不写「更多」「详情」。

## 9. 图表清单与编码

| 图 | 位置 | 数据 | 形态与编码 | 第二编码 |
|---|---|---|---|---|
| C1 语料体量 | T1；副本随 C5 进 T2 同屏 | 7 文件 bytes（并列标注 chars） | 共用基线水平条 | 数值标签 + 单位标注 |
| C2 组成瀑布 | T3 | 四级 chars + 一降两升 | 共用基线瀑布，下降段方向单独编码 | 每段填充图案 + 增减来源文字 |
| C3 块类型分布 | T2 | 6 类计数 | 共用基线水平条，按计数排序 | 类型名 + 数值 |
| C4 标题层数分布 | T2 | 4 档计数（15 / 391 / 156 / 10） | 位置编码（层数为序）+ 长度 | 层数标签；旁注 43 个表格块另带 `table_header` |
| C5 每文档 block 数 | T2，与 C1 副本同屏并置 | 7 项，与 C1 同一文件顺序 | 小倍数条形 | 与 C1 相同的文件顺序 + 数值 |
| C6 验证覆盖矩阵 | T5 | 6 验证手段 × 5 被验证对象；9 条测试连线 | 矩阵 + 覆盖空格 + 归属连线 | 形状 + 文字（已覆盖 / 该手段管不到） |
| C7 eval 覆盖矩阵 | T4（尺寸小于判分链） | 5 行为 × 2 split，格内编码预期分支 | 矩阵，受保护列上锁 | 锁形 + 分支文字 |

C1 的副本与 C5 并置在 T2 同一屏，因为要对照的是同一组文件的两个量。**这组对照目前呈强相关**：
7 份文档的 bytes 与 block 数 r = 0.95，每 block 82–162 bytes。这是 7 个样本的观察，不足以推出一般规律，
也不构成「切分粒度与文件体量无关」的结论；图旁只写这条可核对的观察与样本数。

原第一稿的 C8「metric 状态条」已删除：所有 metric 均无实测值，按 §3.5 不进板。

## 10. 可访问性与响应式

- 桌面 `1440×1000`、手机 `390×844` 两套语义布局；手机端先出主结论、必要边界与播放控件，再进入图形。
- 矩阵在手机端改为按行分组的列表结构，保持行列语义等价，不做横向滚动的整表压缩。
- 宽内容（真实字节样例、Evidence Context 片段）放在自身 `overflow-x: auto` 容器内，页面不横向滚动。
- 图标按钮、播放器、模块组切换满足键盘、焦点、accessible name 与触控目标要求。
- 固定高度舞台不得裁切文本；帧解说区高度按最长帧文本预留。

## 11. 实现接线点（形态定稿之后的工程决策）

本节是实现选择，不构成形态依据。实现只新增或修改 `week8-fullstack/src/frontend/src/` 下的展示资产文件，
`week13-rag/` 只读。

- 新增数据模块 `w13RagTopics.ts` 与组件 `W13RagBoard.tsx`（白名单展示资产）。
- 在 `aiEngineerTopics.ts` 的 `AeGroup` 增加 W13 的五个功能模块组；`AiEngineerBoard.tsx` 分发到新组件。
  不改 `types.ts` 的 `ShowcaseTab`（沿用 §3.4 的范围门禁）。
- 语义过程动效可复用既有 `framePlayer.tsx`（`useFramePlayer` / `FrameTransport` / `FrameNarration`
  已含暂停、单步、reduced-motion 与解说 live region）；若某块的帧模型不契合，另写而不迁就组件。
- 共用基线条形可复用 `charts.tsx` 的 `HBarChart`；矩阵形态若与 `StopMatrix` 的行列语义不一致则新写。
- 数据导出脚本置于 `week8-fullstack/src/frontend/scripts/`（与既有 `verify-w9-board.mjs` 同处），
  只读 `week13-rag/` 的 corpus 与 evidence 产物，输出 TS 数据模块；不调用模型，不读取受保护 split，
  不往 `week13-rag/` 写任何文件。既有脚本与输出字段含义见 `week13-rag/scripts/README.md`；
  block 类型计数取自 `criteria-report-*.md`，不要去 registry 找不存在的 `kind` 字段。
- 仓库无统一图标源，图标以内联 SVG 实现，跨块同一对象使用同一形状（视觉规范 §3.2）。

## 12. 验收证据（按视觉规范 §7）

| 证据 | 本方案的最低要求 |
|---|---|
| 构建 | `yarn typecheck`、`yarn build:showcase`、`yarn verify:board`、`yarn audit:visual` |
| 视口 | 桌面 `1440×1000`、手机 `390×844` 各五块 |
| 状态 | 默认态；再核全部展开态与复习门展开态 |
| 度量 | 每块记录默认态屏数（目标 ≤ 1.5 屏）、全部展开态屏数、主路径中文正文字数（目标 ≤ 220 字，超 300 字须说明哪些限定语不能下沉）。§6 的 ② 列已按「主结论 ≤ 40 字 + 常驻边界短句」拆分，实现后按实际渲染文本重新计数 |
| 结构断言 | 五块各自的 ⑩ 列断言 + 三条全局断言：① 受保护 split 的题面字段不出现在产物中；② 产物中不出现 §3.5 不进板内容的任何量化值或占位状态格；③ 每块存在一个 `data-anchor` 且不落在图例、计数或导航上 |
| 人工视觉验收 | 逐块记录：遮住标题与结论段后能否从图回答该块 ① 列问题；10 秒后能否说出对象、关系与结论；首屏是否先出现视觉舞台；视觉记忆点是否来自技术关系。逐项记通过或卡点，不写「看过」 |
| 截图 | 桌面与手机截图路径写入 §15 交付记录区 |
| 边界 | 记录事实等级、颜色第二编码、reduced-motion 行为与手机端语义等价；`week13-rag/` 的 `git status` 无改动 |

机器断言全绿而人工视觉验收未通过时，该块判为未完成。

## 13. 明确不做

- 不新增顶层 tab，不返工既有 W2/W5/W9/W10/W11/W12 板。
- 不展示受保护 split 的任何题面内容。
- 不预画、不占位 §3.5 列出的未完成内容：retrieval、generation、判分运行、baseline、holdout、token 计量、
  context budget、A1–A8 回填、破坏性验证。它们形成证据后另立模块组，按本规范重新推导形态。
- 不做管线总览块：管线里五段有三段没有产物，一块只讲「什么没做」的板不成立；范围用板头一句文字说明。
- 不修改 `week13-rag/` 下的笔记、代码、测试、脚本与证据产物；不为展板补 corpus 校验脚本。
- 不把 §1 的八条可迁移思维模式单独做成一块板；它们作为各模块组的折叠层结论出现。
- 不引入图标库或图表库依赖。
- 不要求五块同时交付。若周末时间只够一半，按 §14 第 7 项裁决的最小集（T5 + T3）交付；展板的验收单位是「块」，
  半块无法按 §12 验收，宁可少做一块。

## 14. 裁决记录（2026-09-09）

本人于 2026-09-09 授权：未另行裁决的项按本方案的推荐方案执行。下表逐项记录采用的裁决与依据；
裁决只落在展示资产范围内，不改动 `week13-rag/` 的契约、笔记与代码。

| # | 事项 | 裁决 | 依据 |
|---|---|---|---|
| 1 | 五个模块组是否成立；T4 是否单独成块 | 五块成立；T4 单独成块 | 判分契约是已冻结的完整内容；审计的可读性结论认为判分链是五块里最容易 10 秒读出结论的一块，压进 T5 折叠层会丢掉这条主路径 |
| 2 | 各块 ② 主结论措辞 | 按 §6 现文采用 | 每句只承担一个判断，数字均经 §7.1 复算；实现后按渲染文本复核字数 |
| 3 | T2 / T3 真实样例 entry | `rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50` | 同时含 heading 两层与 table_header，一个样例能展示语境复制与 identifier 不扩大两条结论；实测 `context_spans` 见 review 工作表附录 |
| 4 | T4 合成响应样例 | 见 §14.1 | 以 D1 §2.3.5 明确排除在正式题集之外的 Docker 教学示例为 query，不新造题意 |
| 5 | 各块 ⑦ 视觉记忆点 | 按 §6 现文采用 | 五个记忆点均来自技术关系（指纹对、标题栈、下降台阶、停止标记位置、单格有值的 hash 行），不是装饰 |
| 6 | T2 默认态是否超 1.5 屏 | 不拆页；六条切分规则原文与三张分布图不进默认态 | 首屏只保留扫描舞台 + 主结论 + 两条边界；实测超 1.5 屏时在 §15 记录不可下沉的限定语，仍不拆页 |
| 7 | 最小可交付集 | T5 + T3 为最小集；之后按 T2 → T1 → T4 顺序 | T5 讲「证明了什么」、T3 讲「模型实际看到什么」，各自独立成立且共用同一份 registry 数据层；T2 依赖逐行帧模型工作量最大，排第三 |
| 8 | 复习题题面与答案 | 见 §14.2 | 答案逐条引已冻结契约条款，不引入契约外的判断 |
| 9 | C1 / C5 旁注措辞 | 只写可核对观察（r = 0.95，每 block 82–162 bytes，n = 7），不给技术结论 | 7 个样本不足以推出一般规律；写作规范 §3.5 |
| 10 | 展板在展示状态是否可见 | 可见（不进 `REVIEW_ONLY_TABS`） | 语料是本仓库公开规则文档，不含凭据与可定位端点；受保护 split 在两种状态下都只有计数与结构（H1） |

### 14.1 T4 合成响应样例（契约演示，不属于任何正式题集）

query 取 D1 §2.3.5 的教学示例「在本仓库中，AI 是否可以直接实现 Docker/docker-compose 配置？」。该示例在 D1
已声明不计入 20 题、不得改名进入 dev 或受保护 split；展板沿用这一声明，帧内常驻标注「契约演示，非模型运行结果」。

判分链演示两条：

| 样例 | 合成响应 | 逐帧推进的条件 | 终态 |
|---|---|---|---|
| S-A（通过） | `branch: answered`；1 条 claim「Docker / docker-compose 配置属于白名单，AI 可以直接实现」；citation `rules/AGENTS.md#L41-L41` | answered 8 条条件依次通过（分支可解析 → 1–10 条 atomic claim → 覆盖预期结论 → 每条有 citation → citation 可解析且在本次 context 中 → citation 支持 claim → evidence requirement 覆盖 → 无额外 claim） | item 通过 |
| S-B（否决） | 对一道预期 abstained 的合成题返回 `branch: answered` | 在「分支判定」这一步即停止 | 该 split 直接否决，链上后续条件不再推进 |

S-A 的 citation 指向 registry 中真实存在的 block（`model_content` 为 AGENTS.md 白名单首条），因此「citation 可解析」
一步可以用真实 registry 数据演示；S-B 不需要具体题面，只需标明「预期 abstained」，避免为演示新造一道无答案题。

### 14.2 复习题与答案（答案默认折叠）

| 块 | 题面 | 答案 | 契约依据 |
|---|---|---|---|
| T1 | manifest 记录的 sha256 变了，能不能推断出正文被改？ | 不能单独推断。sha256 是对快照文件字节计算的；字节变化可以来自正文，也可以来自换行符、BOM 或行尾空白等未改动正文语义的字节。要定位改动对象须逐文件比对 bytes 与内容 | D1 §2.3.3 逐文件 bytes / SHA-256 / git blob 校验；D3 §6.2.0 #2 的规范化对象 |
| T2 | 附加标题进入 model_content，为什么不进入 source_id 的行范围？ | source_id 只标识核心规则在冻结快照中的原始位置，是引用回源的身份；标题只是让模型能读懂规则适用对象的语境，登记在 `context_spans`。扩大行范围会让 citation 指向不含该规则的行 | D2 §6.1 source identifier；D3 判据 #3「附加语境不扩大 identifier 行范围」 |
| T3 | 块间空行属于哪一层，为什么它不进入 content_sha256？ | 属于 Evidence Context 组装层格式，不属于任何 block 的正文。`content_sha256` 只对单 block 的 `model_content` 全字节计算，不含 wrapper 与组装层字节 | D3 §6.2.0 #3（块间恰一个空行）与 #4（hash 对象范围） |
| T4 | citation_precision 阈值为 1.0，为什么 claim 零 citation 时它不能记为通过？ | 分母为零时 precision 记为 `N/A`，不得把 `0/0` 视为通过；同时「每条 claim 至少关联一个 citation」是 item 条件，零 citation 已使该题失败 | 判分契约 §2 条件 4 与 §5「分母为零记 N/A，不得记为通过」 |
| T5 | fixture 期望字节能抓到哪一类 content_sha256 抓不到的错误？ | 组装层错误：wrapper 字节、块间分隔、块序、首尾空行。这些都不在 `content_sha256` 的计算对象内，hash 全部一致时它们仍可能错 | D3 §6.1 设计点 6「以合成 fixture 期望字节补充 content hash 抓不到的组装层 bug」 |

## 15. 交付记录区（实现后回填）

| 项 | 内容 |
|---|---|
| 实现日期 | 待回填 |
| 构建输出 | 待回填 |
| 度量（每块屏数 / 字数） | 待回填 |
| 人工视觉验收逐项结论 | 待回填 |
| 截图路径 | 待回填 |
| `week13-rag/` git status | 待回填（要求无改动） |
| 遗留锦上添花项与代价 | 待回填 |
