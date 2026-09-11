# technical v2 generation 语义复核工作表
> 状态：confirmed。以下判定基于补齐的 source excerpts 与完整 absence probe；fixture-only item 由 deterministic harness 验收。
> 输入：`generation-langchain-k10-02.json`；fixture-only item 不列入模型语义复核。

| item | branch | status | mechanical | owner verdict |
|---|---|---|---|---|
| `w13-v2-dev-04` | `answered` | `ok` | branch_match=pass; citation_precision=pass | **通过** |

## w13-v2-dev-04

- query：固定 LangChain RAG 链路至少应观察哪些连续阶段，才能区分 retriever 命中和模型实际输入？
- context SHA：`f7e77e4d0ae4a52e2adf8f1906e401c0c47662e06f2117187c4fa072ca5e829c`
- actual model input SHA：`92ecde3c084378334aa4ac4d8e4969414d1544e66108032217a240e6250dd924`
- claims：6 条
  1. claim：固定 LangChain RAG 链路的最小链路必须能观察 query 到 Document/retriever 命中的阶段。
     - citations：`technical/week13-rag/notes/day6-modular-rag-plan.md#L57-L65`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  2. claim：固定 LangChain RAG 链路的最小链路必须能观察实际进入模型的 context。
     - citations：`technical/week13-rag/notes/day6-modular-rag-plan.md#L57-L65`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  3. claim：固定 LangChain RAG 链路的最小链路必须能观察 prompt 与模型请求。
     - citations：`technical/week13-rag/notes/day6-modular-rag-plan.md#L57-L65`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  4. claim：固定 LangChain RAG 链路的最小链路必须能观察 parsed answer / citation / abstention。
     - citations：`technical/week13-rag/notes/day6-modular-rag-plan.md#L57-L65`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  5. claim：M1 固定 LangChain chain 的完成对象是 `Document → retriever → prompt → model → parsed result` 的最小固定链。
     - citations：`technical/week13-rag/notes/day6-modular-rag-plan.md#L31-L31`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  6. claim：M1 的最小完成证据需记录 query、命中证据、实际 context、answer、citation/status。
     - citations：`technical/week13-rag/notes/day6-modular-rag-plan.md#L31-L31`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。

| `w13-v2-dev-07` | `answered` | `ok` | branch_match=pass; citation_precision=pass | **通过** |

## w13-v2-dev-07

- query：citation resolution 只检查 identifier 存在并找到 source span，这是否已经证明 claim 得到支持？
- context SHA：`6fdadaec81b6544abdcba4acdbe00b2b9cc6e6fcd3002a422689266ed4721eae`
- actual model input SHA：`3b1c19301216b813e36292c7cd7f544fc1dfe276917d50fde3ca488cd343f012`
- claims：5 条
  1. claim：citation resolution（引用解析）只检查 identifier 是否存在，并通过 registry 找到对应 source span。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L161-L161`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  2. claim：映射成功只证明引用目标存在，不证明该原文支持 claim。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L161-L161`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  3. claim：registry 查表成功只证明标识指向真实位置，不能证明该位置支持 claim。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L208-L208`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  4. claim：registry 只确定性解析 identifier；citation correctness 还要核对 source span 内容与 claim 的关系。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L233-L233`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  5. claim：citation correctness 检查已解析的 source span 是否实际支持与它关联的 claim，这是内容关系检查，不能由键值查表本身完成。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L162-L162`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。

| `w13-v2-dev-08` | `answered` | `ok` | branch_match=pass; citation_precision=pass | **通过** |

## w13-v2-dev-08

- query：registry 查表成功为什么仍不能证明 source span 支持 claim？
- context SHA：`518be66ac7535fe3984e9b53b26d1a7fa5705c7c5adce2accf28ae67a1129daa`
- actual model input SHA：`542c30a3609ff5774b83d2a9140f3ea6058977b30cfe6ea7066def8525e46602`
- claims：5 条
  1. claim：registry 查表成功只证明 identifier 指向真实位置，不能证明该位置支持 claim。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L208-L208`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  2. claim：引用解析映射成功只证明引用目标存在，不证明该原文支持 claim。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L161-L161`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  3. claim：引用正确性检查的是已解析的 source span 是否实际支持与它关联的 claim，这是内容关系检查，不能由键值查表本身完成。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L162-L162`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  4. claim：registry 只确定性解析 identifier；citation correctness 还要核对 source span 内容与 claim 的关系。
     - citations：`technical/week13-rag/notes/day1-corpus-freeze-and-baseline.md#L233-L233`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。
  5. claim：citation_precision 当前只证明 identifier 能解析到全局 registry；它没有证明 citation 进入本题 context，也没有证明 citation 支持 claim。
     - citations：`technical/week13-rag/notes/day5-dense-langchain-wiring.md#L230-L231`
     - context membership：1/1
     - 已确认：claim 是否由对应 source span 充分支持；citation 是否只完成 identifier resolution。

| `w13-v2-dev-09` | `abstained` | `ok` | branch_match=pass; citation_precision=n/a | **通过** |

## w13-v2-dev-09

- query：technical snapshot 是否规定使用 Qdrant 作为向量数据库并在更新时自动重建索引？
- context SHA：`6c591df39cdc56693182964ccf4f30b11f8b34997e7e9a0a026c8fa43a91e7d9`
- actual model input SHA：`2e41b726ed346dde1bc399b6da65b89dbdadf74633e0b286e703ffe0274b1789`
- reason_code：`insufficient_corpus_evidence`
- reason_text：Evidence Context 未提供关于 technical snapshot 或使用 Qdrant 作为向量数据库并在更新时自动重建索引的规定。
- 已确认：reason_text 与 absence probe 一致，未越界为 schema/transport 错误。

## 复核规则

- `status=ok`、branch 正确和 citation 可解析只证明结构与身份层。
- `claim_support`：逐条判断 source span 是否支持 claim。
- `evidence_coverage`：判断回答是否覆盖题目要求的最小充分证据。
- item 09 的 `reason_text_consistency`：判断拒答理由是否与 absence probe 一致。
- 未完成上述判断前，不更新正式判定、不生成 holdout。


## 正式语义判定（2026-09-12）

04、07、08 的 claim_support 与 evidence_coverage 均通过；09 的 reason_text_consistency 通过。依据与哈希见 `evidence/technical/technical-v2/semantic-materials-01.json` 和 `semantic-verdict-01.json`。
