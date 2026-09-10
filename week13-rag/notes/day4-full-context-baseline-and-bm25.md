# W13 D4 计划：全语料上下文基线与 LangChain BM25

> 建立：2026-09-09（Asia/Shanghai）。
>
> 状态：**D4 进行中（2026-09-10）**。阶段 1（关闭 serialization L1）**已完成**：A1–A8 全部由本人签认
> 「符合」、两个破坏性实验按预测变红并已还原、A3 追加 fixture D。C1 由本人冻结（是）。阶段 2（输入计量与
> context budget）**已完成**：最大渲染请求 44,572 tokens ≤ 可用上限 895,904 → **可完整容纳**，见 §6.4。
> 阶段 3（客户端接线验证）**已完成**：`w13rag.sh check` = 24 passed + 冻结基准三一致；payload 证明
> `thinking: disabled` / `max_tokens=4096` 确实发出，JSON / schema / HTTP / timeout 四类失败互斥分层，见 §6.8。
> 阶段 4（dev baseline）未开工，需要一次真实调用授权。
> 另：测试/门禁缺口的根因与修复见 §6.6，模型退役观察与决策见 §6.5。
> 本文件 §1–§5 保留当日计划原文；实际执行结果以 §6 为准。
>
> 协作模式：AI Engineer 分阶段模式。本人确认输入容量口径、BM25 取舍、retrieval 判据与最终验收；
> AI 在语义冻结后实现客户端、baseline runner、LangChain 接线和机械验证，并提供自测证据。

## 0. 当前事实与计划调整

### 0.1 已完成事实

- D2 已冻结 `w13-eval-v1`、RAG Prompt v0、response schema、source block、source identifier 与 citation
  registry 契约。
- D3 serialization 契约已经闭合；合成 fixture A/B/C 与静态一致性复核已经通过。
- 确定性 parser、citation registry 与 Evidence Context 已实现并自测：tests 9 passed、572 blocks、
  Evidence Context 89,854 chars、真实整串 SHA-256 `8a02c665...` 双跑一致、覆盖审计 uncovered/duplicated=0。
- 判据 #1-#7 已由本人确认，整串基准已冻结在
  `evidence/serialization/frozen-rules-c0a4b85.sha256`。
- source/parser/CLI 代码 review 已完成；`serialization-implementation-review-worksheet.md` 的 A1-A8
  批注尚未由本人回填，因此 serialization 实现里程碑的 L1 验收尚未正式闭合。
- serialized 完整输入计量、最终 context budget、客户端 `thinking: disabled` 接线验证、全语料上下文 dev
  baseline、BM25 与 dense 均未执行。

### 0.2 D4 计划调整

原周计划把 parser 实现、baseline 与 BM25 放在同一个 D4 完成对象中。parser 与确定性验证已在 9/9 提前完成，
但本人 review 尚未闭合。因此 D4 改为一个核心完成对象和一个条件附加项：

1. **核心完成对象**：关闭 serialization L1 验收，形成可复核的全语料上下文 dev baseline 证据包。
2. **条件附加项**：核心完成对象通过后，冻结 LangChain BM25 取舍并优先完成 retrieval-only eval；前置门禁和
   retrieval 门禁均通过且仍有学习容量时，才继续 BM25 真实 generation。

该调整不删除 BM25、dense 或首次 holdout 的周验收范围；未完成项按阶段顺延，不叠加到同一天。

## 1. D4 要解决的问题

### 1.1 当日问题

在同一冻结 corpus、Prompt、response schema 和 dev set 上，完整 Evidence Context 是否能在冻结容量条件内进入
`deepseek-v4-flash`，并产生可以按 `w13-eval-v1` 复核的回答或拒答？

### 1.2 当日可验证结果

- serialization 实现的 A1-A8 语义结论由本人签认，没有未解释的契约偏差。
- 每条 dev query 的完整输入计量和最坏输入占用可复核；结果明确为“可完整容纳”或“不可完整容纳”。
- 可容纳时，全语料上下文 baseline 对 10 条 dev items 完整运行并保存机械检查与人工语义检查结果。
- 不可容纳时，保存 context window 来源、计量方法、输入占用、超限差额和不执行裁剪 baseline 的证据。
- baseline 证据包完成后，才允许进入 LangChain BM25 的术语讲解与取舍冻结。

### 1.3 当日明确不做

- 不读取、搜索、输出或运行 `eval/holdout/`。
- 不运行 dense retrieval、embedding 或 vector store 对照。
- 不比较多组 chunk、中文预处理或 `top_k` 变体。
- 不启动仓库 Markdown 扩展语料。
- 不制作展板，不为 D5 分享排练，不 commit、push、deploy 或修改外部共享状态。

## 2. 执行顺序与门禁

### 阶段 1：关闭 Serialization L1 验收

**目标**：确认当前实现符合本人冻结的 serialization 语义，而不只是在现有测试下运行成功。

**本人操作**：

1. 在 [`serialization-implementation-review-worksheet.md`](./serialization-implementation-review-worksheet.md)
   回填 A1-A8 的“符合 / 有疑问 / 需改动”及理由。
2. 优先解释 A1 ancestor 标题链、A3 fenced code 合并和 A5 blockquote 拆分。
3. 完成一个“先预测、后实测”的合理修改或破坏性实验，记录预测、实际影响与偏差。
4. 确认实验修改全部还原；若正式实现需要改变，先确认语义，再由 AI 修改和重跑验证。

**验证**：

```bash
cd week13-rag
./scripts/w13rag.sh test
FROZEN_SHA256=evidence/serialization/frozen-rules-c0a4b85.sha256 ./scripts/w13rag.sh verify
git diff --check
```

**通过条件**：

- A1-A8 没有未处理的“有疑问 / 需改动”。
- 正式实现与最终 review 结论一致。
- tests 仍为 9 passed；fresh、on-disk、frozen 三者一致。
- 破坏性实验已还原，剩余 diff 都能解释。

**止步条件**：任一语义点未确认，或正式修改后的整串 SHA 尚未重新冻结并验证时，不进入输入计量。

### 阶段 2：冻结完整输入容量口径

#### 2.1 该产物解决什么问题

容量证据用于判断“全语料上下文 baseline 是否物理可运行”。它不评价回答质量，也不能由 raw corpus-only token
estimate 代替。

#### 2.2 输入、输出与验证关系

| 对象 | 内容 |
|---|---|
| 输入 | system Prompt、完整 Evidence Context、单条 dev query、消息格式开销、冻结模型 context window、输出预留与安全余量 |
| 输出 | 每条 dev query 的完整输入 token estimate、最大输入占用、可用上限、余量或超限差额 |
| 验证 | 离线 tokenizer 记录可重跑；真实调用后用 provider usage 交叉检查，不把两者写成同一计量值 |

**排除在 W13 正式证据外的完整示例**：若示例窗口为 100 tokens，输出预留 10，安全余量 20，Prompt、query
和消息开销共 15，则 Evidence Context budget 为 55。若示例 Evidence Context 为 50，则完整输入可容纳并剩余 5；
若为 60，则记录超限 5，不裁剪后继续称为 full-context。以上数字只说明计算形状，不进入正式配置或结果。

#### 2.3 待本人冻结的设计点 C1

**问题**：容量门禁是否对 10 条 dev query 分别组装完整请求、逐条估算，并以最大输入占用作为门禁值？

**推荐方案**：是。这样可以覆盖已冻结 dev set 中最长的实际请求，同时保留每题差异；在本人确认前，它只是推荐，
不属于冻结决定。

**已冻结且不重问的条件**：

- generation model：`deepseek-v4-flash`。
- generation mode：`thinking: disabled`。
- reserved output / `max_tokens`：4096。
- safety margin：固定 100,000 tokens。
- token 计量：DeepSeek 官方离线 tokenizer 示例为主，结果标记为 estimate；字符比例只作粗粒度交叉检查。

**容量结论规则**：

```text
可用输入上限 = context window - reserved output - safety margin

若 max(完整 dev 请求 input estimate) <= 可用输入上限：可运行全语料上下文 dev baseline
若 max(完整 dev 请求 input estimate) >  可用输入上限：记录容量不可行证据，不运行裁剪 baseline
```

完整请求的 estimate 仍不等于 provider usage。若消息渲染细节无法被离线 tokenizer 精确覆盖，记录估算边界，
不得把估算写成线上精确值。

### 阶段 3：验证 W13 模型客户端接线

**入口门禁**：阶段 1 已通过，C1 已由本人确认，完整输入容量结论允许实际 baseline。

**目标**：证明客户端按冻结配置发出请求，并能区分传输、JSON 与 schema 失败。

**实现范围**：

- 复用 W12 `DeepSeekClient`，不复制第二套 HTTP 客户端。
- 当前 W12 `DeepSeekClient.chat()` 尚不接受 `thinking` 或 `max_tokens`；先做最小接口扩展，再由 W13 runner
  显式传入 `model=deepseek-v4-flash`、`thinking: disabled` 与 `max_tokens=4096`。
- system message 只使用 `rag-prompt-v0.md` §1 的冻结 System instructions；user message 按 §2 只承载完整
  Evidence Context 和当前 query，不发送 Prompt 文件的元数据、示例或 verification 说明。
- 响应先保留原始文本，再执行 JSON 解析和 `rag-response-v1.schema.json` 验证。
- 使用 fake transport 或等价 payload 捕获测试证明 `thinking: disabled` 确实进入请求；不以调用成功反推字段已发送。

**通过条件**：

- payload 测试能看到冻结模型、non-thinking 配置、输出上限和消息职责。
- JSON parse error、schema error、HTTP error 与 timeout 有不同结果状态，且不会被记为回答质量失败。
- 运行入口只接受 dev 数据；默认路径无法读取 holdout。

### 阶段 4：运行全语料上下文 Dev Baseline

**入口门禁**：容量可行，客户端 payload 与错误分层验证通过。

**固定变量**：corpus snapshot、Evidence Context SHA、Prompt、response schema、dev eval、模型、non-thinking
配置、输出预留与评分规则。baseline 不执行 retrieval，也不按结果修改上述变量。

**每题证据**：

- evaluation item ID、query 与预期 branch。
- corpus ID、Evidence Context SHA、Prompt/schema/model/config 版本。
- 完整输入 token estimate、provider usage 与调用延迟；三者分字段记录。
- 原始响应、JSON 解析结果、schema 验证结果。
- answered 时的 atomic claims、citation identifiers 和 registry resolution。
- 机械评分结果、本人完成的语义 checklist、最终 item pass/fail。
- 失败阶段：capacity、client、response parsing/schema、grounding、citation、generation 或 evaluation。

**split 通过标准**：沿用已冻结 `w13-eval-v1`，不在 D4 改写：

- dev 至少 9/10 items 通过。
- 五类行为分别至少 1/2 通过。
- citation precision = `1.0`；missing citation 是 item 必须失败条件。
- 预期 `abstained` 的 item 返回 `answered` 时，dev split 直接失败。

**人工语义边界**：AI 可以执行 schema、identifier、计数与汇总等机械检查；claim 是否得到原文支持、回答是否满足
evidence requirement、失败归因和最终验收由本人确认。

### 阶段 5：写出 Baseline 结论

只允许从实际证据得到以下三类结论之一：

| 观察 | 可以支持的结论 | 不能支持的结论 |
|---|---|---|
| 完整输入可容纳且 dev 通过 | 当前冻结小型语料在本次配置下不使用 retrieval 也达到 dev 阈值 | 不能推出生产场景不需要 RAG，也不能推出 BM25/dense 没有价值 |
| 完整输入可容纳但 dev 未通过 | 当前 full-context 路径未达到冻结阈值；逐题失败阶段已经记录 | 不能在排除 Prompt/schema/citation/generation 失败前认定 retrieval 是解法 |
| 完整输入不可容纳 | 当前冻结容量条件下，未裁剪的 full-context baseline 不可运行 | 不能推出 BM25 质量足够，也不能伪造裁剪 baseline 结果 |

**核心完成对象通过条件**：阶段 1-5 都有可复核记录；若容量不可行，阶段 3-4 以“不运行”及其证据闭合，而不是
伪造执行结果。核心对象未闭合时不进入 BM25。

## 3. 条件附加项：LangChain BM25

### 3.1 开始条件

- 全语料上下文 baseline 已形成完整结果，或容量不可行证据已经闭合。
- baseline 的失败阶段与证据边界已由本人确认。
- 当天仍有学习容量；否则直接把本节作为下一阶段入口，不压缩设计与验收。

### 3.2 开始前术语讲解

AI 按“解决的问题 -> 输入 -> 输出 -> 职责边界 -> 当前仓库示例 -> 验证方法”依次解释：

- LangChain `Document` 与 metadata。
- ingestion、preprocessing、chunk 与 chunking。
- inverted index、BM25、ranking、retriever 与 retrieval result。
- retrieval result 与实际进入模型的 Evidence Context 的区别。

本人能够解释当前对象关系后，再逐个进入设计点；不把第一次接触的框架 API 当作先答考核。

### 3.3 待本人逐项冻结的设计点

以下问题一次只确认一个：

1. **B1 / `Document` 映射**：`page_content` 索引 `model_content` 还是其它冻结文本；metadata 保存哪些
   `source_id`、span、hash 与排序字段。
2. **B2 / 中文 preprocessing**：query 与文档采用什么确定性 tokenization/normalization；哪些字符和结构必须保留。
3. **B3 / ranking 与 context assembly**：`top_k`、并列分数、去重、超预算处理，以及 retrieved blocks 进入
   Evidence Context 的顺序。
4. **B4 / retrieval eval**：如何从冻结 evidence requirements 判断 evidence recall；item 和 dev split 的通过条件。

这些决定影响 retrieval 质量和最终结论，不能由 LangChain 默认值或 AI 在实现时补填。

### 3.4 冻结后的实现与验证顺序

1. AI 将 citation registry entries 映射为 LangChain `Document`，保留冻结 identifier 与 hash。
2. AI 按 B1-B4 接入 BM25 retriever，并用合成 fixture 验证 ranking、metadata、去重和 ordering。
3. 先对 dev 运行 retrieval-only eval，保存 query、rank、score、source IDs、入选 context 与 evidence recall。
4. retrieval 门禁通过后，才把 retrieved Evidence Context 接入同一 Prompt/client/generation/eval 链路。
5. 本人 review 一次框架接线，并预测一个合理修改对 indexing、ranking、context 与 eval 的影响。

**BM25 完成条件**：query -> BM25 retrieval -> context assembly -> generation -> citation/abstention -> dev eval
能够重复运行，citation 可以回到冻结 snapshot；至少保存一次同版本真实 generation 成功证据。

**D4 附加项止步条件**：retrieval-only eval 未完成或未通过时，不执行 BM25 generation；BM25 端到端未完成时，
不进入 dense 或 holdout。

## 4. D4 收口与掌握验收

### 4.1 当日收口清单

- [ ] A1-A8 已由本人回填，serialization L1 验收正式闭合。
- [ ] C1 已由本人确认，完整输入计量方法和不确定性已记录。
- [ ] 容量结论有可重跑证据；可容纳与不可容纳分支没有混写。
- [ ] 客户端 payload 已证明显式发送 `thinking: disabled`，或因容量不可行按计划不进入客户端运行。
- [ ] 全语料上下文 dev baseline 已运行并评分，或保存容量不可行证据并明确未运行。
- [ ] baseline 结论说明证据支持与不能支持的范围。
- [ ] 若进入 BM25，B1-B4 均由本人逐项确认；未进入则记录为下一入口，不写成失败。
- [ ] 未读取或运行 holdout；未启动 dense、扩展语料、展板或分享排练。
- [ ] 当日实现、测试、证据、周计划与 `LEARNING-STATE.md` 已按实际结果同步。
- [ ] `git diff --check` 通过，且没有密钥、真实凭据、可定位端点或临时调试输出进入 tracked 文件。

### 4.2 掌握证据

本人在不看实现细节的情况下完成：

1. 讲清 snapshot -> parser -> citation registry -> Evidence Context -> Prompt -> model response -> eval 的数据流。
2. 解释 full-context baseline 没有 retrieval 的原因，以及它与 BM25 对照保持了哪些变量一致。
3. 根据一条失败记录判断失败发生在 retrieval 之前还是 generation/evaluation 阶段。
4. 若进入 BM25，解释原始 Markdown、source block、LangChain `Document`、metadata、retrieval result 与实际模型
   context 的关系，并 review 一次框架接线或完成一次合理修改/故障诊断。

代码运行成功本身不构成上述掌握证据。

## 5. D4 完成判定与下一入口

### 5.1 D4 核心完成

满足以下条件时，D4 核心完成：

- serialization L1 review 已闭合。
- 完整输入容量门禁已按本人确认的口径执行。
- 全语料上下文 baseline 结果或容量不可行证据可复核。
- 本人完成失败归因、证据边界与最终结论。

BM25 是 D4 的条件附加项；它未在同日完成时，不反向否定核心完成对象，但 W13 完整验收仍保持未完成。

### 5.2 下一入口

- BM25 尚未开始：从 §3.2 术语讲解进入。
- BM25 设计已冻结但未实现：从 §3.4 LangChain 接线进入。
- retrieval-only 已通过但 generation 未完成：从同一配置的 BM25 generation 进入。
- BM25 端到端已完成：D5 才进入同 snapshot/dev set 的 dense 对照。
- dense 尚未完成前，不运行首次 holdout；D5 17:00 分享只使用届时已经验证的证据。

## 6. 执行记录（2026-09-10）

### 6.1 阶段 1：关闭 serialization L1 —— 已完成

| 计划项（§2 阶段 1） | 实际结果 |
|---|---|
| A1–A8 批注 | 全部「符合」，无「有疑问 / 需改动」（worksheet §2 批注区） |
| 优先解释 A1 / A3 / A5 | 已由验证证据覆盖：A1 独立重算祖先链 0 处不一致；A3 23/23 向前合并；A5 分块与 `>` 保留逐条实测 |
| 一个「先预测 → 后实测」的修改/破坏性实验 | 两个实验（去掉 A3 合并、过滤 level=1 标题）预测先落盘、实测按预期变红、改动已还原 |
| 实验修改全部还原 | `parser.py` md5 `998cabc9…` 复原、`git diff` 为空、verify 恢复 `8a02c665…` |
| 通过条件：tests 9 passed、fresh/on-disk/frozen 一致 | 9 passed → 追加 fixture D 后 **11 passed**；三一致 OK |

证据：

- 验证证据与实验原始输出：[`serialization-review-A1-A8-evidence.md`](./serialization-review-A1-A8-evidence.md)
- 步骤 B 流程示范：[`serialization-review-stepB-worked-example.md`](./serialization-review-stepB-worked-example.md)
- 只读重跑入口：`python3 scripts/verify-a1-a8.py`（16 条不变式，PASS/FAIL 退出码）

本阶段暴露的一条判定线事实：**`w13rag.sh test` 对 A1 / A3 两类退化都是全绿**（两个破坏性实验中都是
`9 passed`）。会红的是冻结基准 `verify` 与独立重算检查。因此计划的「tests 仍为 9 passed」是必要不充分条件，
已由 `verify-a1-a8.py` 补足。

### 6.2 本日由本人做出的决定

| 决定 | 内容 |
|---|---|
| A1–A8 签认 | 全部「符合」；实现无需改动，冻结基准无需重冻结 |
| A3 | 追加覆盖 fenced code 逐字保真的 fixture（已执行，见证据笔记 §12；未改变整串 sha256） |
| A5 | `SHOWCASE-VISUAL-PROTOCOL.md#L75-L75` 引导句独立成 block 保留为**开放问题**，不调整合并规则 |
| A6 | 表头重复的 token 增量确认进入本日阶段 2 的 assembled input 计量 |
| C1（§2.3） | **是**——容量门禁对 10 条 dev query 分别组装完整请求、逐条估算，并以最大输入占用作为门禁值 |

### 6.3 阶段 2 前置缺口与补齐结果

阶段 2 的验证要求是「离线 tokenizer 记录可重跑」。开工前核对运行时与输入来源，发现三项缺口：

1. **tokenizer 运行时未保留**。`week12-python-rag/.venv` 与系统 `python3` 都没有 `transformers` /
   `tokenizers`（W12 `requirements.lock` 也不含这两项）；官方归档 `deepseek_v4_tokenizer.zip` 在本机
   未找到。因此 D1 那次计量目前**无法在本机直接重跑**。
2. **官方归档仍可获取且身份可核对**。只读 HEAD 检查返回
   `content-length: 1911504`、`etag: "6755c7694b8a3ec0bcf4815d77053572"`、
   `last-modified: Fri, 28 Aug 2026 05:37:58 GMT`——与 `token-count-rules-c0a4b85.json` 中记录的
   `bytes` / `httpEtag` / `httpLastModified` **逐项一致**。重新获取后可用 SHA-256
   `e7310d1d…` 验证字节完整性。
3. **context window 的外部来源在仓库内没有可复核记录**。day1 §3.3 只记录选值依据（「当前 1M context window
   的 10%」），§4.4 勾选了「查证并记录来源」，但未找到记录载体与检索日期。阶段 2 的门禁公式
   `可用输入上限 = context window − 4096 − 100000` 直接依赖该值，它是外部事实，不能由本次自行设定。

同时修正计划 §2 阶段 2 的一处表述：原文写「复用 W12 tokenizer 流程」；事实是 W12 环境不含 tokenizer，
D1 的 tokenizer 是 W13 单独安装的，因此这条应改为「复用 D1 记录的 tokenizer 身份（归档 SHA-256 +
transformers 4.57.6 / tokenizers 0.22.2）」。

**补齐结果（2026-09-10）**：

| 缺口 | 处理 | 证据 |
|---|---|---|
| tokenizer 运行时 | 从官方 CDN 重新获取归档（HTTP 200，1,911,504 bytes，sha256 `e7310d1d…` 与 D1 记录一致），在 `week13-rag/.venv` 用 **python3.12.10** 安装 `transformers 4.57.6` / `tokenizers 0.22.2` | 官方 smoke `encode("Hello!")` = `[19923, 3]`；7 份文档逐文件 token **全部命中** D1 记录（4174/2032/649/3076/2994/3086/2686 = **18,697**）；7/7 round-trip 通过 |
| D1 `pipFreeze` 可复现性 | 记录的 `filelock==3.32.5` **在 PyPI 不存在**（可解析到的是 3.32.6），因此该 freeze 无法逐包复现 | py3.12 的解析结果与 D1 记录只差两个补丁版本（`filelock 3.32.6`、`regex 2026.9.10`）；环境等价性改由**实测数字**证明（上一行） |
| context window 来源 | 查证官方 Models & Pricing：`CONTEXT LENGTH 1M`、`MAX OUTPUT MAXIMUM: 384K`（检索 2026-09-10）；Token & Token Usage 页给出官方比例 `1 English character ≈ 0.3 token`、`1 Chinese character ≈ 0.6 token` | 记入 `evidence/input-budget/assembled-input-rules-c0a4b85.json` 的 `budget.contextWindowSource`；冻结的 1M 值与来源一致，本次未改动冻结决定 |

补充说明：`jinja2 3.1.6` 是为渲染 chat template 新增的依赖，不参与 encode/decode，D1 记录中不含它。

### 6.4 阶段 2 结果：输入计量与 context budget —— 已完成

按 C1（逐条组装完整请求、取最大占用）执行；产物
`evidence/input-budget/assembled-input-rules-c0a4b85.json`，重跑入口 `scripts/measure-input-budget.py`。

| 对象 | 值 |
|---|---|
| system instructions（`rag-prompt-v0` §1） | 652 chars / **268 tokens** |
| 完整 Evidence Context（sha256 `8a02c665…`） | 89,854 chars / **44,247 tokens** |
| 单条 dev query | 12–33 tokens |
| 每题完整渲染请求（含模板标记） | 44,551 – **44,572** tokens；模板开销固定 **3 tokens** |
| 可用输入上限 | 1,000,000 − 4,096 − 100,000 = **895,904** |
| 门禁结论 | **可完整容纳**（最大占用 44,572，余量 **851,332**） |

两点观察：

1. 序列化后的 Evidence Context 是 **44,247 tokens**，约为 raw corpus-only（18,697 tokens）的 **2.4 倍**：
   wrapper、重复的标题链与复制表头都计入其中。这是已记录的代价而非缺陷，也正是 A6「表头重复 token 增量」
   在该计量中的实际体现。
2. 离线计量的两条边界：tokenizer 包内 `model_max_length = 16384` 只是包配置（D1 已声明不得用作窗口来源，
   本次计量时 tokenizer 也对该长度发出警告）；provider 返回的 `usage` 仍是另一份运行证据。

### 6.5 模型退役观察与决策（2026-09-10）

**观察到的事实**：官方 Models & Pricing 页（检索 2026-09-10）标注 `deepseek-v4-flash` 为 **legacy name**、
对应模型**已退役**，请求由 `DeepSeek-V4.1-Flash` 提供服务并按 Flash 计费；当前主名是 `deepseek-flash`。
即：**请求字段没变，实际提供服务的模型变了。**

**由此得到的判断（长期保留）**：写死模型版本号不能冻结行为——托管模型无法做到权重位级冻结。生产的做法分三层：

| 层 | 做法 |
|---|---|
| 供应商层 | 分清「主名/别名」「带日期的快照」「legacy 别名」三种形态，靠 changelog 把退役当成一类运维事件 |
| 应用层 | 模型 ID 配置化；经网关集中做映射、重试、回退与记账；每次运行记录服务端身份 |
| 验证层 | 冻结回归集 + 冻结阈值 + 灰度作为升级门禁；升级前在同一冻结输入上重跑 |

**本人决定（2026-09-10）**：

1. 本次实验**保留**请求字段 `deepseek-v4-flash`，不改主名（避免与阶段 3/4 主线无关的配置变更）；
2. 阶段 3 起把服务端身份字段纳入运行证据：`requested_model`、`served_model`、`system_fingerprint`（若提供）、
   `usage`、`created`；
3. 结论一律绑定身份：「在本次运行观察到的 `served_model = X` 条件下…」；
4. 「换模型后重跑 dev 并按冻结阈值比较」登记为 **W16** 的升级演练项，不单开支线；
5. 记录载体：[`../config/model-policy-v1.md`](../config/model-policy-v1.md)。

### 6.6 测试/门禁缺口的根因与修复（2026-09-10）

**问题**：`w13rag.sh test` 对两类退化都是全绿——去掉 A3 合并、以及过滤 level=1 标题，两次都只显示 `9 passed`。

**根因（分层，不是单点失误）**：

| 层 | 根因 | 为什么它抓不到 |
|---|---|---|
| 不变式类型 | 原 9 条守的是「内部自洽」：覆盖完整、无重复、`source_span` 与 `source_id` 一致、hash 可复算、首尾无空行、fixture 字节 | 这类不变式对「丢掉一层可选内容」恒真——内容变了但依然自洽，断言全部成立 |
| 绝对基准未接入门禁 | 内容级绝对基准（整串 sha256 `8a02c665…`）存在，D3 §6.2.0 #6 明确它是**运行期 regression 基准**、刻意不进 registry 契约字段 | `test` 不带 `--frozen-sha256`、`verify` 是独立命令，于是「一键命令」只给出自洽性结论 |
| 分层覆盖缺口 | fixture A/B/C 直接构造 spans，**不经过 `parse_blocks`** | parser 的合并方向、同级标题出栈、缩进收尾、硬边界此前没有任何单元级用例，只被真实语料审计间接覆盖 |
| 取舍的代价未落盘 | 不把语料专属常量（572、整串 sha）写进单元测试，以避免测试与语料耦合 | 这个取舍本身合理，但代价（改 parser 时 `test` 不报警）没有被记录，导致「全绿」被当成「没退化」 |

**修复（本次完成）**：

1. `w13rag.sh check` 增加 `[3/3] frozen verify`，默认使用
   `evidence/serialization/frozen-rules-c0a4b85.sha256`，可用 `FROZEN_SHA256` 覆盖。
2. 新增 `tests/test_parser_segmentation.py`：5 条用例覆盖「段落 + fence 合并」「非段落在前不合并」
   「thematic break 阻断合并」「同级标题出栈」「围栏不配对兜底」。预期值按 D2 §6.1 手推后与实现比对，
   两侧一致才固化为断言。
3. `verify-a1-a8.py` 保持独立只读核对（16 条不变式），不并入 pytest——避免把语料常量写进单元测试，
   同时保留全语料级检查。

**修复的验证（可证伪）**：

```text
干净树 ./scripts/w13rag.sh check           → [1/3] 16 passed；[3/3] OK（三一致 8a02c665…）
重放实验 1（去掉 A3 合并）后再跑 check     → [1/3] FAILED test_parser_segmentation.py::
                                              test_paragraph_then_fence_merges_into_one_code_block
                                              test_unbalanced_fence_is_treated_as_verbatim_to_eof
                                              2 failed, 14 passed（脚本 fail-fast，未进入 [3/3]）
还原 parser.py 后再跑 check                → [1/3] 16 passed；[3/3] OK；md5 复原 998cabc9…
```

即同一处改动：修复前是 `9 passed` 全绿，修复后在同一键命令的第一步就失败。

### 6.7 本轮暴露的缺陷与值得保留的观察

**缺陷（含去向）**：

| # | 缺陷 | 影响 | 去向 |
|---|---|---|---|
| 1 | D1 证据记录的 `pipFreeze` 含 `filelock==3.32.5`，该版本在 PyPI 不存在 | 「依赖集可复现」这一表述不成立，按记录无法重建环境 | 已更正 day1 的对应声明；等价性改由复现 D1 逐文件 token 数证明（§6.3） |
| 2 | context window 的外部来源当时未落盘（day1 §3.3 只写选值依据） | 门禁公式的外部输入没有可复核来源 | 已记录官方 `CONTEXT LENGTH 1M` 与检索日期（§6.3） |
| 3 | 计划 §2 阶段 2 写「复用 W12 tokenizer 流程」 | 与实际来源不符（W12 环境不含 tokenizer） | 已修正为「复用 D1 记录的 tokenizer 身份」（§6.3） |
| 4 | 测试/门禁缺口 | 改 parser 时 `test` 给虚假绿灯 | 已修复并按上面的可证伪方式验证（§6.6） |

**值得保留的观察**：

| # | 观察 | 为什么值得留 |
|---|---|---|
| 1 | 重新获取外部归档时，`content-length` / `etag` / `last-modified` 与 D1 记录逐项一致 | 「按身份重新获取资产」是可行的复现路径：先比对身份再使用，而不是只靠文件名 |
| 2 | 序列化后的 Evidence Context 是 44,247 tokens，约为 raw corpus-only（18,697）的 2.4 倍 | 量化了 wrapper、重复标题链与复制表头的真实代价；也解释了为什么不能用原始字节估算 |
| 3 | tokenizer 包内 `model_max_length = 16384` 与真实窗口无关（计量时 tokenizer 还对 44,247 长度发出警告） | 包配置不能当外部事实来源；D1 已声明，本次由实测再次证实 |
| 4 | 模板开销固定 3 tokens（`apply_chat_template` 渲染值 − 各组件求和） | 「消息格式开销」不是估算拍数，可以从冻结 tokenizer 的 chat template 直接量出 |
| 5 | 环境等价性用实测数字判定，而不是版本号 | 版本相同不等于行为相同、版本不同也不等于行为不同；判据应是可复现的观测值 |

### 6.8 阶段 3 结果：客户端接线验证 —— 已完成

**接口扩展**（W12 `src/clients.py`，最小改动）：`chat()` 新增 `model` / `thinking` / `max_tokens` 三个
keyword-only 参数；`ModelClient` Protocol 与 `FakeClient` 同步（后者额外记录 `request_options`）。
W12 侧新增 2 条自测，全套 **32 passed**，覆盖率 **97.97%**（阈值 90%）。

**请求形状（官方文档核对，2026-09-10）**：Thinking 开关是**请求体顶层字段**
`{"thinking": {"type": "enabled"|"disabled"}}`——裸 HTTP 直接放 body，只有 OpenAI SDK 才需要 `extra_body`；
并且**思考模式默认开启**，所以「不传」不等于「关闭」，必须显式发送 `disabled`。

**W13 实现**：`src/w13rag/generation.py` 提供唯一组装入口 `assemble_messages()` 与 `run_item()`。
`run_item` 把一次调用落成互斥状态：`ok` / `json_error` / `schema_error` / `http_error` / `timeout_error` /
`transport_error`，并按 [`model-policy-v1.md`](../config/model-policy-v1.md) §2 记录 `requested_model`、
`served_model`、`system_fingerprint`、`usage`、`created`、`latency_ms`。

**验证（`./scripts/w13rag.sh check` 一键）**：

```text
[1/3] pytest         → 24 passed
[2/3] build evidence → blocks=572
[3/3] frozen verify  → fresh / on-disk / frozen 三一致 8a02c665…
```

新增用例（`tests/test_generation_payload.py`，8 条）：

| 用例 | 断言 |
|---|---|
| payload 捕获 | 请求体确实含 `model`、`thinking={"type":"disabled"}`、`max_tokens=4096`；消息为 system + user；user 以 `<EVIDENCE_CONTEXT>` 开头、以 `<QUERY>…</QUERY>` 结尾且包含完整证据 |
| HTTP 400 | 落 `http_error`，`detail` 含 `status=400`，异常不向上抛 |
| 非 JSON 响应 | 落 `json_error`，仍保留 `raw_text` |
| schema 违规 | 落 `schema_error`（`claims[0]` 缺 `citations`），与 JSON 失败区分 |
| 读超时 | 落 `timeout_error`，`detail=ReadTimeout` |
| dev 限定 | `load_dev_items()` 返回 10 条 `w13-dev-*`；对 `split=holdout` 的输入直接 `ValueError` |
| 组装唯一入口 | 相同输入产生相同结构 |

**顺带完成的收敛**：`scripts/measure-input-budget.py` 改为复用 `assemble_messages()`；重跑后计量证据
**逐字节不变**（sha256 `1ba58582…`），证明「计量的输入」与「真实发送的输入」由同一函数产生（D3 §6.2.0 #5）。

**环境记录**：W13 运行时统一到 `week13-rag/.venv`（在原 tokenizer 依赖之外新增 `httpx 0.28.1`、
`pytest 9.1.1`、`pytest-asyncio 1.4.0`、`jsonschema 4.26.0`）；`scripts/w13rag.sh` 默认改用该 venv，缺失时
回退到 W12 venv。tokenizer 等价性结论不受影响——`transformers 4.57.6` / `tokenizers 0.22.2` 版本未变。

### 6.9 阶段 4 smoke（1 条真实调用）结果与阻断发现（2026-09-10）

**运行**：`.venv/bin/python scripts/run-dev-baseline.py --limit 1 --out evidence/baseline/smoke-dev-01.json`
——真实调用、非检索的 full-context 请求（system instructions + 完整 Evidence Context + 1 条 dev query）。

**本步要验的链路与身份字段：全部通过**

| 项 | 观测 |
|---|---|
| 请求侧 | `requested_model=deepseek-v4-flash`、`thinking={"type":"disabled"}`、`max_tokens=4096` |
| 服务端身份 | `served_model=deepseek-flash`（**证实**官方文档所述「别名被路由到当前模型」）、`system_fingerprint=aeb56401ca74e127821c4f9126dcb669` |
| provider usage | `prompt_tokens=44553`、`completion_tokens=138`、`total_tokens=44691`、`prompt_cache_hit_tokens=0` / `prompt_cache_miss_tokens=44553` |
| 延迟 | 4,813 ms |
| 离线 estimate 对照 | 该题离线渲染 estimate = 44,551 → 与 provider `prompt_tokens` 相差 **+2 tokens（0.004%）** |

两点附带结论：离线计量口径可用于容量门禁；**cache hit/miss 在真实响应中可观察**（本次 miss，符合首次请求），
计划里「按实际可观察性记录」的要求可以由真实运行满足。

**阻断发现：冻结 Prompt 没有把响应键名告诉模型**

原始响应文本：

```json
{"schema_version":"rag-response-v1","status":"answered","claims":[{"text":"JWT 签发与验证流程属于 W4 认证鉴权黑名单项，援助上限为 L2。","citations":["rules/AGENTS.md#L71-L76"]},{"text":"黑名单项最高 L2，不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。","citations":["rules/AGENTS.md#L110-L111"]}],"citations":["rules/AGENTS.md#L71-L76","rules/AGENTS.md#L110-L111"]}
```

与 `rag-response-v1` 的差异（`additionalProperties: false` + `oneOf`）：

| 模型返回 | 契约要求 |
|---|---|
| `status` | `branch` |
| 顶层 `citations` 数组 | 不允许（citation 只在每条 claim 内） |
| `schema_version` | 不允许 |

**失败阶段判定：prompt（输入契约不完整）**，不是生成质量差、也不是 schema 过严失控。依据：冻结 Prompt 的 §1
是唯一发送给模型的 system instructions，其中只出现 `answered` / `claims` / `citations` / `reason code` 这些
**概念词**，从未给出响应 JSON 的键名；而 §3 里写明键名的两个示例被冻结决定限定为「不属于 few-shot message，
不发送给模型」（§2 阶段 3 也明确 user message 不携带示例与元数据）。模型只能猜键名，本次猜成 `status`。

**影响**：只要 §1 不补充响应键契约，10 条 dev 会系统性落到 `schema_error`，baseline 无法产生可评分结果。

**待本人决定（Prompt 语义归本人，AI 不擅自改冻结 Prompt）**：

| 选项 | 内容 | 代价 |
|---|---|---|
| A | 新建 Prompt `v1`：在 §1 增加响应键契约（`branch` / `claims[].text` / `claims[].citations` / `reason_code` / `reason_text`，并要求不输出其它键），其余不动，旧版保留可追溯 | 一次版本变更 + 一次重跑；原因在输入契约而不在模型质量，不属于调参 |
| B | 保留 Prompt，放宽 schema（去掉 `additionalProperties: false`、接受 `status`） | 削弱机械检查；顶层 `citations` 仍无契约依据 |
| C | 先不改，把「键名遵从度」记为已知限制继续跑 | baseline 结果将主要是 `schema_error`，回答不了 baseline 问题 |

**v1 处置与复验（2026-09-10，本人确认 A 方案后执行）**：

- **变更**：新建 `prompts/rag-prompt-v1.md`——§1 追加第 11 条（响应键契约）与第 12 条（`claims` 1–10 条、
  每条 `citations` 非空且不重复）；**§2 之后与 v0 逐字节相同**（已用脚本校验）；v0 保留可追溯。
- **连带更新**：`generation.PROMPT_PATH` 与计量脚本改指 v1；计量证据按 Prompt 版本命名，v0 旧证据改名为
  `assembled-input-rules-c0a4b85-w13-rag-prompt-v0.json`（内容未动）保留。
- **计量重跑（v1）**：system instructions 652 → 921 chars；最大渲染请求 44,572 → **44,701** tokens；
  可用上限 895,904，余量 851,203 → 仍**可完整容纳**。
- **复验 smoke**（同一条 dev 题，`w13-dev-direct-answer-01`）：

| 产物 | status | branch | claims | citations | precision | 备注 |
|---|---|---|---|---|---|---|
| `smoke-dev-02-v1.json` | ok | answered | 2 | 3/3 可解析 | 1.0 | 键契约生效，`failures=[]` |
| `smoke-dev-03-v1.json` | ok | answered | 3 | 4 中 3 可解析 | **0.75** | 出现 `rules/AGENTS.md#L77-L78`；registry 实际为 `#L77-L77`，**行范围漂移一行** |

- **结论**：键契约问题**已解决**——不再出现 `status`、顶层 `citations`、`schema_version`。
- **新增观察（generation 层，不是契约或实现缺陷）**：同一题、同一冻结输入，两次运行的 citation 行为不同；
  一次全对，一次把 `#L77-L77` 写成 `#L77-L78`。Prompt 第 10 条已要求「不得创造、改写或推测 source ID」，
  模型仍发生复制漂移；机械检查正确抓到（precision 0.75 < 1.0 → 该题失败）。
- **处置**：**先不改 Prompt**——单条样本不足以判定是否需要加强措辞；先跑满 10 条 dev，统计该失败模式的出现
  次数与形态，再决定是否值得一次 v2 变更。这正是 dev 阈值 9/10 与「首次结果不用于调参」存在的理由。
- **附带观察（cache 可观察）**：三次真实调用的 `prompt_cache_hit_tokens` 分别为 0 / 128 / **44,544**，
  `prompt_cache_miss_tokens` 从 44,553 降到 138——命中随前缀稳定上升，且该字段在响应里真实可读。

### 6.10 阶段 4 结果：全语料上下文 dev baseline —— 已运行，**未达冻结阈值**

产物：`evidence/baseline/dev-full-context-prompt-v1-01.json`（10 条真实调用、非检索）；
重跑入口：`scripts/run-dev-baseline.py --limit 10`。

| # | item | status | branch | claims | citations | 失败 |
|---|---|---|---|---|---|---|
| 1 | direct-answer-01 | ok | answered | 2 | 2/2 | — |
| 2 | direct-answer-02 | ok | answered | 7 | 11/11 | — |
| 3 | cross-document-01 | **schema_error** | — | — | — | 响应含 `reason_code: null` / `reason_text: null`（answered 分支不允许） |
| 4 | cross-document-02 | **json_error** | — | — | — | 响应被 ` ```json ` 围栏包裹（Prompt 第 8 条已禁止） |
| 5 | paraphrase-01 | ok | answered | 9 | 12/12 | — |
| 6 | paraphrase-02 | ok | answered | 6 | 7/7 | — |
| 7 | priority-conflict-01 | ok | **abstained** | 0 | — | 应答却拒答（`branch_mismatch`） |
| 8 | priority-conflict-02 | ok | answered | 7 | 7/7 | — |
| 9 | no-answer-01 | ok | abstained | — | — | —（预期拒答，正确） |
| 10 | no-answer-02 | ok | abstained | — | — | —（预期拒答，正确） |

**机械汇总**（`w13-eval-v1`）：通过 **7/10**（阈值 ≥9/10 → **未达**）；分类覆盖 cross_document **0/2**（未达）、
其余四类达标；`citation_precision_min = 1.0`；`missing_citation` 0；`abstained_but_answered` 0
（零容忍条件未触发）。

**逐题失败阶段归因（机械层；人工语义 checklist 归本人）**：

| item | 阶段 | 依据 |
|---|---|---|
| cross-document-01 | response schema | 结构与 citation 均正常（3 条 claims、citation 全可解析），但多出 `reason_code: null` / `reason_text: null`；v1 第 11 条已限定两分支各自的键集合，模型仍补空值键 |
| cross-document-02 | response parsing | 原始文本以 ` ```json ` 开头；v1 第 8 条已禁止 Markdown 代码块 |
| priority-conflict-01 | generation（false abstention） | 拒答理由称语料未提供 W13 / W15 归属；该归属在冻结语料中以小节标题形式存在，覆盖率审计下属于可见内容 → 证据可用但未被使用。**能否从可见证据得出结论需人工语义核对**（列入 checklist） |

**按 §2 阶段 5 的结论规则**：本结果属「完整输入可容纳但 dev 未通过」分支，只能得出
**「当前 full-context 路径未达到冻结阈值」**；**不能**在排除 prompt / schema / citation / generation 失败之前
认定「需要 retrieval 才能解决」。本轮 3 条失败里 2 条与检索无关（响应格式与解析），1 条属生成层未用足证据。

**运行间差异（同一冻结输入，可复现性观察）**：

- citation 复制保真存在波动：`smoke-dev-03` 出现 `rules/AGENTS.md#L77-L78`（registry 实为 `#L77-L77`），
  而本次 10 条运行的 `citation_precision_min = 1.0`，该漂移未复现。
- cache 可观察：10 次调用 `prompt_cache_hit_tokens` 从 0 升到 44k 级（前缀稳定后命中）。

**候选硬化项（均属配置/契约变更，需本人决定；未执行）**：

1. Prompt `v2`：把「answered 分支不得出现 `reason_code` / `reason_text`（即使值为 null）」写成显式反例句；
2. 请求级 JSON 输出约束（官方 JSON Output 能力）——属新增冻结配置字段，需与 `model` / `thinking` /
   `max_tokens` 同级登记。

### 6.11 未完成与下一入口

- 未完成：阶段 5 的 baseline 结论（机械部分已具备，人工语义 checklist 待本人）；附加项 BM25 未开始。
- 门禁状态：阶段 1–3 已闭合；**阶段 4 已运行但未达冻结阈值**（机械通过 7/10，cross_document 0/2），
  `citation_precision_min = 1.0`、零容忍条件未触发；阶段 5 结论受此结果约束。
- 下一步入口：① 本人按 [`dev-semantic-checklist-worksheet.md`](./dev-semantic-checklist-worksheet.md) 做逐题语义判定
  （重点 cross-document-01/02 与 priority-conflict-01）；② 决定两个候选硬化项（Prompt v2 / JSON 输出约束）；
  ③ 之后决定 BM25 的时间点。
