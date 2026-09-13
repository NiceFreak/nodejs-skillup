# RAG 的整体工作链：实际使用原理与 LangChain 的位置

> 目标时长：约 9 分 30 秒，最长不超过 10 分钟。
>
> 演示目的：用一条完整的数据流说明 RAG 的实际使用原理、每一层要观察什么，以及 LangChain 如何承载检索实现。
>
> 展示路径：`rag-build` → `rag-retrieval` → `rag-citation`。全程围绕同一条 query 到 evidence 的链路。

## 0:00–0:55：工具要解决什么问题

**页面锚点**：`rag-build`。

> RAG 不是简单地给模型附加一段资料。它要解决的是：当用户提出一个需要依据资料回答的问题时，系统怎样把回答和可回查的证据连起来？
>
> RAG 的基本动作是先从受控资料中找出与 query 相关的内容，再把这些内容组装成模型实际收到的上下文，最后要求回答带着 citation 或明确 abstention。工具提供可回查的证据路径，并让回答与证据的支持关系可以被独立检查。
>
> 因此，这个工具链路留下的不只是 answer，还包括 source identity、检索命中、实际 Evidence Context、parser 状态和 citation；claim support 属于后续评估，证据不足时则进入 abstention。演示时我会沿着这条链逐层检查。

## 0:55–2:25：来源先变成可回查的证据对象

**页面锚点**：`rag-build`，沿构建链指向 registry 和 Evidence Context。

> 第一步不是直接把整份 Markdown 发给模型，而是先把冻结文档转换成 source block。每个 block 有 `source_id`、`source_span`、`model_content` 和 `content_sha256`。`source_id` 和位置回答“证据来自哪里”，hash 用于比较内容指纹是否变化；标题语境可以进入 context，但不会因此扩大核心 source span。
>
> 这一步让资料变成可以稳定引用的证据对象。没有稳定身份，后面的 citation 只能是模型写出来的一串字符串，无法回查；没有固定的内容和范围，重复运行也无法判断上下文是否真的变了。
>
> 使用工具前先确认 corpus/version 和 query。检索结果必须回到同一份 registry 取正文，不能把临时拼出的文本直接当成证据。

## 2:25–4:20：一个 query 如何经过检索工具

**页面锚点**：`rag-retrieval`。

> 现在看工具的核心闭环。输入是 query，以及固定的 corpus 和检索配置。LangChain retriever 产出候选 `Document`；BM25 依据词项匹配，dense 路径由 `Embeddings` adapter 产生向量，再交给 `InMemoryVectorStore` 做相似度检索。
>
> 这些候选先被项目层映射为统一的 `RetrievalHit`，其中保留 `source_id`、排名和分数。项目层还负责稳定排序，再按命中顺序回 registry 取回 source block，组装本次 Evidence Context。于是这条数据流是：
>
> `query → LangChain Document/retriever → RetrievalHit/source identity → Evidence Context → model message`。
>
> 把它写成 tool contract 更清楚：输入是 `query + corpus_version + retrieval_config`；输出包括 `retrieval_hits[{source_id, source_span, rank, score}]`、`evidence_context/context_hash`、`parsed_response/parser_status`、`citations`，以及回答分支 `answered`、`abstained` 或 `schema_error`。不变量是 source identity 必须能回 registry，context 只能由 registry 内容组装，排序规则必须确定；结构失败时不进入 claim 的语义判断。
>
> 这里有一个必须实际检查的分界：retriever 找到某个 block，不等于模型已经看到了它。要展开 Evidence Context，确认命中的正文确实进入了本次 model message；如果没有进入，问题在上下文组装，不在模型。

## 4:20–6:05：LangChain 承载组件，但不接管项目语义

**页面锚点**：继续指向 `rag-retrieval`，对照框架组件和项目契约。

> LangChain 在这里承载可替换的检索实现：registry entry 映射为 `Document`，`BM25Retriever` 处理词项检索，自定义 `Embeddings` adapter 接入 dense 模型，`InMemoryVectorStore` 提供向量存储和检索。
>
> 但 source identity、hash、稳定排序、`RetrievalHit` 映射、Evidence Context 组装、citation 解析和评估契约仍属于项目层。框架默认的 metadata、并列顺序或返回结果，不能自动替代这些契约。
>
> 当前生成仍复用项目已有的 HTTP client，没有使用 LangChain `ChatModel` 或 LCEL。也就是说，现在是“LangChain retrieval + 项目生成客户端”的固定 RAG 链路；可以替换检索实现，同时保持证据身份、上下文格式、响应 schema 和评估规则不变。

## 6:05–7:35：生成之后，按三层判断是否能交付

**页面锚点**：`rag-citation`。

> context 进入模型后，先看传输、空响应、JSON 和 schema。`status=ok` 只表示响应通过了解析和结构校验，不表示答案已经被原文支持。
>
> 第二层是身份检查：每个 answered response claim 是否有 citation，citation identifier 是否能解析到 registry，以及引用的 span 是否实际进入本次 context。第三层才是语义检查：这些引用是否支持 claim，是否覆盖题目要求的 evidence requirement。
>
> 如果资料覆盖不了问题，就返回 abstention，而不是用流畅的文字补全。一个实际失败分支是：identifier 可以解析，但对应 span 没有进入本次 context；此时应停在 evidence 链检查，不能把它算成“模型回答正确”。另一个失败分支是 schema error；此时没有可判定的 claims，不能继续讨论 citation 质量。

## 7:35–8:35：贯穿整条链的三个使用原则

**页面锚点**：在 `rag-build`、`rag-retrieval`、`rag-citation` 三页之间回指同一条链。

> 正确使用这条 RAG 链有三个原则。第一，身份必须显式验证：检索到的对象要能回到冻结 source。第二，候选和实际输入必须分开观察：命中、context 和 model message 不能合并成一个“检索成功”。第三，结构、身份和语义要分层判断：schema 通过、citation 可解析、claim 被原文支持，是三个不同结论。

## 8:35–9:30：固定使用动作与能力边界

**页面锚点**：`rag-retrieval` → `rag-citation`。

> 实际使用时，我按六步走：确认 corpus/version 和 query；查看 LangChain retriever 的 hits；回 registry 检查 source identity；展开实际 Evidence Context；检查 model response 和 parser 状态；最后逐条回源 citation，证据不足时接受 abstention。
>
> 当前 dense 接线在固定 registry、缓存和 dev query 条件下，与旧路径的 10 条 query top-10 集合和顺序一致，最大分数差是 `7.31e-08`。这只证明接线行为一致，不证明回答质量；当前链路的语义判定、paraphrase 检索缺口、schema error 跨运行稳定性和 citation 与 evidence coverage 的关系仍不能被一次运行推出。
>
> 两条端到端链路都能运行，但当前实验记录中 BM25 和 dense 的人工语义判定各为 `3/10`，质量门禁未通过。因此“链路可运行”和“检索接线一致”都不能被说成回答准确率或 grounded 质量已经通过。
>
> 收口时可以把这条原则带走：LangChain 负责承载检索组件，项目负责定义什么是证据、如何组装上下文、何时引用以及何时拒答。正确使用 RAG，就是让这些责任和每一层的可观察结果保持一致。

## 追问边界

- **为什么不能只看 retriever 的 top-k？** 因为 top-k 只说明候选命中；还要确认命中内容进入实际 Evidence Context，并且最终 citation 支持回答中的 claim。
- **citation 能解析是否等于回答正确？** 不能。解析只证明 identifier 能定位到 registry span；原文是否支持 claim，以及是否覆盖题目要求，仍需单独判断。
- **LangChain 是否已经接管完整 RAG？** 当前只承接 `Document`、BM25、dense `Embeddings` adapter 和内存向量检索；生成仍走项目 HTTP client，尚未使用 `ChatModel` 或 LCEL。
- **为什么需要 abstention？** 当冻结资料不能覆盖问题时，显式拒答比生成没有证据的完整答案更符合 RAG 的证据约束。
- **当前结果能否外推成生产质量或泛化准确率？** 不能。证据只适用于当前 corpus、实现、缓存和 dev 条件。
