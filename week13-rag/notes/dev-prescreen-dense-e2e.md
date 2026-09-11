# W13 dev 语义判定机械预筛（生成物）

> 证据：`evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json`（`dense-langchain-end-to-end`，10 题）
> 本文件只做程序职责范围内的机械检查：citation 可解析性、与本次 context 的成员关系、
> R1 ② 的包含性（citation 行范围是否完整落在 requirement span 内）。
> 判定规则的唯一来源是 [`eval/scoring-contract.md`](../eval/scoring-contract.md) 与
> [`eval/scoring-rulings-r1.md`](../eval/scoring-rulings-r1.md)；
> **「通过 / 不通过」由本人填写，本文件不提供结论。**

## 汇总（机械部分）

- `source_span` requirement 共 **16** 项：**6** 项按 R1 ② 已由机械确定未覆盖；**1** 项属无答案题的 advisory，不参与该题通过判定（契约 §1）；**6** 项不适用（该题响应无 claims，按 §2 / §3 的机械条件判定）。
- 含至少一项已确定未覆盖的 item：**4** 题（`w13-dev-direct-answer-01`, `w13-dev-paraphrase-01`, `w13-dev-paraphrase-02`, `w13-dev-priority-conflict-exception-02`）。
- 本次响应共有 **17** 条 claim 需要本人逐条判断支持关系。
- 机械未覆盖不等于本人已作判定：最终「通过 / 不通过」仍由本人填写。

## 1. `w13-dev-direct-answer-01`（direct_answer / 预期 `answered`）

- 运行 status：`ok`
- 机械层：pass（语义槽位待判：claim_support, evidence_coverage）
- 实际分支：`answered`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须同时表明黑名单的援助上限是 L2，并将 JWT 签发与验证` | `AGENTS.md#L66-L72` | **未覆盖（机械确定，R1 ②）** | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| 1 | `rules/AGENTS.md#L71-L76` | 是 | 否 | 是 |
| 2 | `rules/AGENTS.md#L110-L111` | 是 | 否 | 是 |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 逐条 claim（共 2 条）是否被其 citation 指向的原文支持，且是否为 atomic claim：
- [ ] requirement ① 内容覆盖：只在 ② 机械通过的那几项上判 claim 内容是否覆盖该要求：
- [ ] 是否包含冻结 corpus 无法支持的额外 claim：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 2. `w13-dev-direct-answer-02`（direct_answer / 预期 `answered`）

- 运行 status：`ok`
- 机械层：pass（语义槽位待判：claim_support, evidence_coverage）
- 实际分支：`answered`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须直接规定官方术语与类比或助记的并列关系，以及不得以自创指称` | `TECHNICAL-WRITING-PROTOCOL.md#L118-L120` | 已覆盖（机械；① 仍需人工） | [1, 2, 3, 4] |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| 1 | `rules/AGENTS.md#L163-L163` | 是 | 否 | 是 |
| 1 | `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118` | 是 | 是 | 是 |
| 2 | `rules/AGENTS.md#L163-L163` | 是 | 否 | 是 |
| 2 | `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118` | 是 | 是 | 是 |
| 3 | `rules/AGENTS.md#L163-L163` | 是 | 否 | 是 |
| 3 | `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118` | 是 | 是 | 是 |
| 4 | `rules/AGENTS.md#L163-L163` | 是 | 否 | 是 |
| 4 | `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118` | 是 | 是 | 是 |
| 5 | `rules/AGENTS.md#L163-L163` | 是 | 否 | 是 |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 逐条 claim（共 5 条）是否被其 citation 指向的原文支持，且是否为 atomic claim：
- [ ] requirement ① 内容覆盖：只在 ② 机械通过的那几项上判 claim 内容是否覆盖该要求：
- [ ] 是否包含冻结 corpus 无法支持的额外 claim：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 3. `w13-dev-cross-document-01`（cross_document / 预期 `answered`）

- 运行 status：`schema_error`
- 机械层：fail（structural_validity）
- 实际分支：`（无解析结果）`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须规定讲解中的官方术语、类比或助记标注要求，并明确未标注的自` | `AGENTS.md#L161-L163` | 不适用（本次响应无 claims；该题按契约 §2 / §3 的机械条件判定） | — |
| R2 `该来源范围必须独立规定官方术语与类比或助记的并列、标注和后续指称边界。` | `TECHNICAL-WRITING-PROTOCOL.md#L116-L120` | 不适用（本次响应无 claims；该题按契约 §2 / §3 的机械条件判定） | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| — | （本次响应没有 claims） | — | — | — |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 4. `w13-dev-cross-document-02`（cross_document / 预期 `answered`）

- 运行 status：`ok`
- 机械层：fail（branch_match）
- 实际分支：`abstained`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须表明技术学习文案规范适用于学习展板的用户可见文案，并说明其` | `TECHNICAL-WRITING-PROTOCOL.md#L1-L5` | 不适用（本次响应无 claims；该题按契约 §2 / §3 的机械条件判定） | — |
| R2 `该来源范围必须说明学习展板视觉规范负责视觉形态与验收，并区分技术文案规范` | `SHOWCASE-VISUAL-PROTOCOL.md#L1-L10` | 不适用（本次响应无 claims；该题按契约 §2 / §3 的机械条件判定） | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| — | （本次响应没有 claims） | — | — | — |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 5. `w13-dev-paraphrase-01`（paraphrase / 预期 `answered`）

- 运行 status：`ok`
- 机械层：pass（语义槽位待判：claim_support, evidence_coverage）
- 实际分支：`answered`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须将 route、controller、service 和 ` | `AGENTS.md#L66-L70` | **未覆盖（机械确定，R1 ②）** | — |
| R2 `该来源范围必须定义 L1 的讲解边界，并规定黑名单最高援助等级为 L2。` | `AGENTS.md#L101-L110` | 已覆盖（机械；① 仍需人工） | [4] |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| 1 | `rules/AGENTS.md#L11-L12` | 是 | 否 | 是 |
| 2 | `rules/AGENTS.md#L44-L44` | 是 | 否 | 是 |
| 3 | `rules/AGENTS.md#L43-L43` | 是 | 否 | 是 |
| 4 | `rules/AGENTS.md#L107-L107` | 是 | 是 | 是 |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 逐条 claim（共 4 条）是否被其 citation 指向的原文支持，且是否为 atomic claim：
- [ ] requirement ① 内容覆盖：只在 ② 机械通过的那几项上判 claim 内容是否覆盖该要求：
- [ ] 是否包含冻结 corpus 无法支持的额外 claim：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 6. `w13-dev-paraphrase-02`（paraphrase / 预期 `answered`）

- 运行 status：`ok`
- 机械层：pass（语义槽位待判：claim_support, evidence_coverage）
- 实际分支：`answered`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须将事件循环等 Node.js 底层机制及其理解型 demo` | `AGENTS.md#L66-L78` | **未覆盖（机械确定，R1 ②）** | — |
| R2 `该来源范围必须定义 L1 原理讲解，并规定黑名单最高援助等级为 L2。` | `AGENTS.md#L101-L110` | **未覆盖（机械确定，R1 ②）** | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| 1 | `rules/AGENTS.md#L11-L12` | 是 | 否 | 是 |
| 2 | `rules/AGENTS.md#L11-L12` | 是 | 否 | 是 |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 逐条 claim（共 2 条）是否被其 citation 指向的原文支持，且是否为 atomic claim：
- [ ] requirement ① 内容覆盖：只在 ② 机械通过的那几项上判 claim 内容是否覆盖该要求：
- [ ] 是否包含冻结 corpus 无法支持的额外 claim：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 7. `w13-dev-priority-conflict-exception-01`（priority_conflict_exception / 预期 `answered`）

- 运行 status：`ok`
- 机械层：fail（branch_match）
- 实际分支：`abstained`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须分别把 RAG 与 MCP 归入 W13 和 W15。` | `DAILY-LEARNING-REPORT-PROTOCOL.md#L117-L135` | 不适用（本次响应无 claims；该题按契约 §2 / §3 的机械条件判定） | — |
| R2 `该来源范围必须规定本周核心能力闭环优先，并限制主线完成前启动低优先级事项` | `LEARNING-PROTOCOL.md#L188-L200` | 不适用（本次响应无 claims；该题按契约 §2 / §3 的机械条件判定） | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| — | （本次响应没有 claims） | — | — | — |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 8. `w13-dev-priority-conflict-exception-02`（priority_conflict_exception / 预期 `answered`）

- 运行 status：`ok`
- 机械层：pass（语义槽位待判：claim_support, evidence_coverage）
- 实际分支：`answered`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须区分构建、部署和合并上线的权限层级，并要求按用户授权范围执` | `SHOWCASE-DEPLOY-PROTOCOL.md#L34-L38` | **未覆盖（机械确定，R1 ②）** | — |
| R2 `该来源范围必须规定发布分支需要明确，且功能分支构建成功不等于线上已经更新` | `SHOWCASE-DEPLOY-PROTOCOL.md#L60-L61` | 已覆盖（机械；① 仍需人工） | [1, 2] |
| R3 `该来源范围必须列出发布前仍需完成的范围确认、检查、构建和验证步骤。` | `SHOWCASE-DEPLOY-PROTOCOL.md#L64-L90` | **未覆盖（机械确定，R1 ②）** | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| 1 | `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L60-L60` | 是 | 是 | 是 |
| 2 | `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L61-L61` | 是 | 是 | 是 |
| 3 | `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L120-L120` | 是 | 否 | 是 |
| 4 | `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L143-L143` | 是 | 否 | 是 |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] 逐条 claim（共 4 条）是否被其 citation 指向的原文支持，且是否为 atomic claim：
- [ ] requirement ① 内容覆盖：只在 ② 机械通过的那几项上判 claim 内容是否覆盖该要求：
- [ ] 是否包含冻结 corpus 无法支持的额外 claim：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 9. `w13-dev-no-answer-01`（no_answer / 预期 `abstained`）

- 运行 status：`ok`
- 机械层：pass（语义槽位待判：reason_text_consistency）
- 实际分支：`abstained`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| R1 `该来源范围必须表明现有规范的对象是每日技术英语口语稿。` | `DAILY-SPEAKING-PROTOCOL.md#L1-L3` | advisory（无答案题不参与该题通过判定，契约 §1） | — |
| — | `corpus_absence` | 由 abstained 的 reason text 与 `corpus_absence` 一致性判定（语义） | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| — | （本次响应没有 claims） | — | — | — |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] abstained 的 reason text 是否与 reason_code 及该题 `corpus_absence` 一致：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

## 10. `w13-dev-no-answer-02`（no_answer / 预期 `abstained`）

- 运行 status：`ok`
- 机械层：pass（语义槽位待判：reason_text_consistency）
- 实际分支：`abstained`

**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**

| requirement | span | 机械结论 | span 内的 claim |
|---|---|---|---|
| — | `corpus_absence` | 由 abstained 的 reason text 与 `corpus_absence` 一致性判定（语义） | — |

**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**

| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |
|---|---|---|---|---|
| — | （本次响应没有 claims） | — | — | — |

**仍需本人判定（语义；本文件不给出结论）**

- [ ] abstained 的 reason text 是否与 reason_code 及该题 `corpus_absence` 一致：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

