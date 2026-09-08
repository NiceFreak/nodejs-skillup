# W13 RAG eval 判分契约

> 状态：frozen
>
> eval version：`w13-eval-v1`
>
> corpus snapshot：`rules-c0a4b85`
>
> 本契约由本人于 2026-09-08 冻结。dev 与未来首次运行的 holdout 使用同一判分规则和阈值，分别判定，
> 不跨 split 平均分数。

## 1. 判分输入与职责

- 机械检查读取模型响应、题目 ID、citation identifier、本次实际 context 和冻结 registry。
- 人工语义 checklist 读取每题的 `expected_rule_conclusion` 与 `evidence_requirements`。
- 程序负责字段可解析性、数量、枚举、identifier、context membership 和聚合计算。
- 人工 reviewer 负责 atomic claim、语义等价、结论覆盖、citation 支持关系和 reason text 一致性。
- full-context baseline 没有 retrieval 阶段，不计算 retrieval metric，也不把失败预先归因为 retrieval miss。

当前所有 `evidence_requirements` 默认全部必需。只有多个来源能够等价支持同一要求时才允许替代关系；
`w13-eval-v1` 没有此类替代组。以后增加替代组必须先更新 schema、eval version 和 hash，不得在看到模型响应后
临时改变证据要求。

`corpus_absence` 是评测者在运行前冻结的判分依据，不是要求模型自行证明整个 corpus 不存在答案。
无答案题中列出的 `source_span` 只用于记录语料已覆盖的相邻边界，不是要求 abstained 响应返回 citation。

## 2. Answered 单题通过条件

以下条件必须全部满足：

1. 响应分支可解析且为 `answered`。
2. 返回 1 至 10 条 claims；每条 claim 都是 atomic claim。
3. claims 合起来按语义等价完整覆盖该题的 `expected_rule_conclusion`，不要求逐字一致。
4. 每条 claim 至少关联一个 citation identifier。
5. 每个 citation identifier 都能解析到冻结 source span，且该 span 实际进入本次 context。
6. 每个 citation 至少支持对应 claim 的一个必要部分；同一 claim 的 citations 合起来支持完整 claim。
7. 每项 `evidence_requirements` 都由至少一条 claim 及其有效 citations 覆盖。
8. 不包含冻结 corpus 无法支持的额外 claim。

任一条件失败，该 item 失败。answered 返回零条 claims 时，item 直接失败；相关比率的分母为零时记为 `N/A`，
不得把 `0/0` 记为通过。

## 3. Abstained 单题通过条件

以下条件必须全部满足：

1. 响应分支可解析且为 `abstained`。
2. 不返回 answered claims。
3. 不返回 citation。
4. reason code 必须为 `insufficient_corpus_evidence`。
5. 简短 reason text 与 reason code 及该题冻结的 `corpus_absence` 一致。

预期 `abstained` 的 item 返回 `answered` 属于证据不足时强行作答，直接否决该 split，不受其他 item 分数抵消。

## 4. 五类行为的题目级检查

| behavior type | 在通用分支条件之外检查什么 |
|---|---|
| `direct_answer` | 完整覆盖该题直接要求的规则结论。 |
| `cross_document` | 覆盖所有必需文档分别承担的结论，并满足每项 source evidence requirement。 |
| `paraphrase` | 查询未复用原文关键词时仍返回语义正确的规则结论；不要求匹配原文字面。 |
| `priority_conflict_exception` | 得出当前场景实际适用的规则，不只罗列候选规则；覆盖解决优先级、冲突或例外所需的全部证据。 |
| `no_answer` | 使用 `abstained`，不以模型预训练知识补充冻结 corpus 中缺失的信息。 |

每题的具体语义与证据数量以该 item 已冻结的 `expected_rule_conclusion` 和 `evidence_requirements` 为准。
判据必须在运行前确定，不能根据模型答案临时调整。

## 5. Metrics

每个 split 单独计算：

| metric | 计算方式 | 用途 |
|---|---|---|
| `branch_accuracy` | 正确分支的 items / 10 | 诊断 |
| `item_pass_rate` | 满足全部 item-level 条件的 items / 10 | 门禁，必须 `>= 0.9` |
| `claim_correctness` | 语义正确的 returned claims / 全部 returned claims | 诊断；分母为零时 `N/A` |
| `citation_precision` | 有效且支持对应 claim 的 citations / 全部 returned citations | 门禁；有返回 citation 时必须为 `1.0` |
| `citation_completeness` | 至少有一个有效 citation 的 claims / 需要证据的 returned claims | 诊断；分母为零时 `N/A` |
| `abstention_accuracy` | 正确 abstained 的 items / 预期 abstained 的 items | 诊断；当前每个 split 的分母为 2 |

`claim_correctness`、`citation_precision`、`citation_completeness` 和预期结论覆盖分别观察不同失败，不能互相替代。
missing citation 直接使对应 answered item 失败；此时即使 citation precision 因零分母为 `N/A`，也不能通过。

## 6. Split 与整套通过条件

一次 split 通过必须同时满足：

1. 运行有效。
2. 没有预期 `abstained` 的 item 返回 `answered`。
3. `citation_precision = 1.0`；没有返回 citation 时按本契约的 item failure 处理，不以 `N/A` 代替门禁。
4. `item_pass_rate >= 0.9`，即至少 9/10 items 通过。
5. 五类 behavior type 分别至少 1/2 items 通过。

在 10 题且最多允许 1 题失败的条件下，第 5 条不会额外改变结果，但保留该条件以显式记录行为覆盖要求。

dev 与 holdout 分别应用上述条件。未来 holdout 首次运行后，只有 dev 和 holdout 都通过，整套 20 题 eval 才通过；
`10/10 dev + 8/10 holdout` 或 `8/10 dev + 10/10 holdout` 都不能通过。

## 7. 运行有效性

出现以下任一情况，本次运行无效，不计算通过或失败：

- eval version、corpus snapshot、split 或文件 hash 与冻结 manifest 不一致；
- 未对该 split 的 10 个稳定 item ID 分别产生一次可归属的结果；
- dev 常规运行读取了 holdout items，或 holdout 在未满足首次运行门禁时被执行；
- 无法复核本次实际 context，因而不能判断 source span 是否进入 context；
- evaluator 使用了运行后新增或修改的 expected conclusion、evidence requirement 或评分规则。

单条模型响应存在错误字段、错误枚举或无法解析的分支时，该 item 失败，不因此把整个运行记为基础设施无效。

