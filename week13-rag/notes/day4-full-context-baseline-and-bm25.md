# W13 D4 计划：全语料上下文基线与 LangChain BM25

> 建立：2026-09-09（Asia/Shanghai）。
>
> 状态：计划已建立，D4 尚未开始。当前入口仍是完成 serialization 实现 review 的 A1-A8 批注。
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
