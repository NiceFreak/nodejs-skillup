# W13 dev 人工语义判定素材（脚本生成）

> 生成脚本：`scripts/build-semantic-worksheet.py`（可重跑；证据或语料变化后重新生成）。
> **本文件是生成物：重新运行脚本会覆盖已填写的人工判定。**回填判定后需重新生成时，请用 `--out` 写到新文件。
> split：`dev`；证据来源：`evidence/bm25-e2e/dev-bm25-e2e-top10-01.json`
> evidenceId：`dev-bm25-e2e-top10`；Prompt：`w13-rag-prompt-v1`；语料：`rules-c0a4b85`；生成：`2026-09-11T00:49:26+08:00`
> 判定规则来源：[`../eval/scoring-contract.md`](../eval/scoring-contract.md)（状态 `frozen`）；判定口径（含 R1 覆盖口径）见 [`../eval/scoring-rulings-r1.md`](../eval/scoring-rulings-r1.md)。

## 0. 判定素材说明与边界

- 机械 evaluator 的结果见每题「运行与机械结果」段，无需重判。
- 本人负责的语义判定（契约 §1）：claim 是否被引用的原文支持、回答是否满足 evidence requirement、
  abstained 的 reason text 是否与 reason_code 及该题 `corpus_absence` 一致。
- 判定适用范围是可通过解析的 item；已由机械条件判为 `fail` 的 item，其 claims 与 citations 只作
  失败阶段归因材料，不改变该 item 的失败判定。
- 「通过 / 不通过」与最终结论由本人填写；本文件不提供任何结论。

---

## 1. `w13-dev-direct-answer-01`（direct_answer / 预期 `answered`）

**题目事实**

- query：JWT 签发与验证流程的最高援助级别是什么？
- 预期结论（不发送给模型）：JWT 签发与验证流程的最高援助级别是 L2。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L66-L72`（`documents/AGENTS.md` L66-L72）：该来源范围必须同时表明黑名单的援助上限是 L2，并将 JWT 签发与验证流程列入黑名单。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=3.0；claims=3 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=3 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"JWT 签发与验证流程属于黑名单中的 W4 认证鉴权项。","citations":["rules/AGENTS.md#L71-L76"]},{"text":"黑名单项在任何情况下不给完整实现，援助上限为 L2。","citations":["rules/AGENTS.md#L71-L76"]},{"text":"黑名单项最高 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。","citations":["rules/AGENTS.md#L110-L111"]}]}
```

**citations 与冻结原文**

claim 1：JWT 签发与验证流程属于黑名单中的 W4 认证鉴权项。
- `rules/AGENTS.md#L71-L76`
    71| - **W4 认证鉴权**：
    72|   - JWT 签发与验证流程
    73|   - 密码哈希与存储策略
    74|   - OAuth2 授权码交换、state 校验、回调处理
    75|   - RBAC 角色 / 权限模型、401/403 判断、授权所在层设计
    76|   - Web 安全防护逻辑

claim 2：黑名单项在任何情况下不给完整实现，援助上限为 L2。
- `rules/AGENTS.md#L71-L76`
    71| - **W4 认证鉴权**：
    72|   - JWT 签发与验证流程
    73|   - 密码哈希与存储策略
    74|   - OAuth2 授权码交换、state 校验、回调处理
    75|   - RBAC 角色 / 权限模型、401/403 判断、授权所在层设计
    76|   - Web 安全防护逻辑

claim 3：黑名单项最高 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。
- `rules/AGENTS.md#L110-L111`
    110| 黑名单项最高 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。
    111| 截止时间只影响砍范围，不影响援助上限。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：本次不逐条判 claim 支持——失败已由 §2.7 的 requirement 覆盖条件确定；claim 与 citation 只作归因材料。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。requirement `AGENTS.md#L66-L72` 无 span 内 citation（c1/c2 引用 `L71-L76` 越界，c3 引用 `L110-L111` 亦在 span 外）→ 按 R1 ② 未覆盖 → §2.7 不满足。
- [x] 本题最终判定：**不通过** —— 理由：依据 R1 ②，requirement 无 span 内 citation。

---

## 2. `w13-dev-direct-answer-02`（direct_answer / 预期 `answered`）

**题目事实**

- query：技术文案是否可以用自创概念或助记词替代官方术语，作为后续讨论中的唯一指称？
- 预期结论（不发送给模型）：不可以。讲解与文案应直接使用官方术语；类比或助记只能与官方术语并列并明确标注，不能取代官方术语。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L118-L120`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L118-L120）：该来源范围必须直接规定官方术语与类比或助记的并列关系，以及不得以自创指称替代官方术语。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=5.0；claims=5 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=8 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"不可以；讲解与文案一律直接使用官方术语。","citations":["rules/AGENTS.md#L163-L163","rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]},{"text":"如果使用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。","citations":["rules/AGENTS.md#L163-L163","rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]},{"text":"删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]},{"text":"对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。","citations":["rules/AGENTS.md#L163-L163","rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120"]},{"text":"正确形态是首次提及即术语与类比并列，后续只用官方术语指称。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120"]}]}
```

**citations 与冻结原文**

claim 1：不可以；讲解与文案一律直接使用官方术语。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 2：如果使用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 3：删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 4：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120`
    120| 本条款同时约束讲解过程与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列，后续只用官方术语指称。

claim 5：正确形态是首次提及即术语与类比并列，后续只用官方术语指称。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120`
    120| 本条款同时约束讲解过程与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列，后续只用官方术语指称。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 支持；claim 2 支持；claim 3 支持；claim 4 支持；claim 5 支持。
- [x] 回答是否满足该 item 的 evidence requirement：满足。覆盖由 claim 1/2/3 的 `TECH#L118` 与 claim 4/5 的 `TECH#L120` 合入 `L118-L120`。
- [x] 本题最终判定：**通过** —— 理由：branch 正确、claims 覆盖预期结论；requirement 的 citation 落在 `L118-L120` span 内，无越界。

---

## 3. `w13-dev-cross-document-01`（cross_document / 预期 `answered`）

**题目事实**

- query：AI 在知识讲解中使用了自创助记词，却未明确标注其为类比或助记，这违反了哪两份规则文档的共同约束？
- 预期结论（不发送给模型）：违反 AGENTS.md 与 TECHNICAL-WRITING-PROTOCOL.md 的共同约束。两者都要求直接使用官方术语；类比或助记必须与官方术语并列并明确标注。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L161-L163`（`documents/AGENTS.md` L161-L163）：该来源范围必须规定讲解中的官方术语、类比或助记标注要求，并明确未标注的自创助记词属于违规。
- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L116-L120`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L116-L120）：该来源范围必须独立规定官方术语与类比或助记的并列、标注和后续指称边界。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=3.0；claims=3 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=3 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"AGENTS.md 的「术语与类比分层」条款约束讲解与文案中自创助记词的使用：若用其它概念帮助理解，必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。","citations":["rules/AGENTS.md#L163-L163"]},{"text":"TECHNICAL-WRITING-PROTOCOL.md 的 §3.6「术语与类比分层」条款同时约束讲解与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120"]},{"text":"TECHNICAL-WRITING-PROTOCOL.md §3.6 还规定已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]}]}
```

**citations 与冻结原文**

claim 1：AGENTS.md 的「术语与类比分层」条款约束讲解与文案中自创助记词的使用：若用其它概念帮助理解，必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

claim 2：TECHNICAL-WRITING-PROTOCOL.md 的 §3.6「术语与类比分层」条款同时约束讲解与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120`
    120| 本条款同时约束讲解过程与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列，后续只用官方术语指称。

claim 3：TECHNICAL-WRITING-PROTOCOL.md §3.6 还规定已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 支持；claim 2 支持；claim 3 支持。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。`AGENTS.md#L161-L163` 要求未由 span 内 claim 完整覆盖：落在该 span 内的 claim 1 只覆盖“并列、显式标注、不得取代”，未明确覆盖“未标注的自创助记词属于违规”；claim 2 虽有“属于违规”，但其 citation 是 `TECHNICAL-WRITING-PROTOCOL.md#L120`，不能用于 `AGENTS.md#L161-L163` 的 requirement。`TECHNICAL-WRITING-PROTOCOL.md#L116-L120` 本身覆盖满足。
- [x] 本题最终判定：**不通过** —— 理由：cross_document 要求两份文档分别承担的要求都被覆盖；AGENTS 侧要求未由落在其 span 内的 claim 完整覆盖。

---

## 4. `w13-dev-cross-document-02`（cross_document / 预期 `answered`）

**题目事实**

- query：学习展板的用户可见文案与视觉设计分别受哪两份根级规范约束，两份规范各自负责什么？
- 预期结论（不发送给模型）：TECHNICAL-WRITING-PROTOCOL.md 约束事实强度和句子表达；SHOWCASE-VISUAL-PROTOCOL.md 约束视觉编码、信息层级和视觉验收证据。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L1-L5`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L1-L5）：该来源范围必须表明技术学习文案规范适用于学习展板的用户可见文案，并说明其事实与表达职责。
- `rules-c0a4b85/SHOWCASE-VISUAL-PROTOCOL.md#L1-L10`（`documents/SHOWCASE-VISUAL-PROTOCOL.md` L1-L10）：该来源范围必须说明学习展板视觉规范负责视觉形态与验收，并区分技术文案规范继续负责事实强度和句子表达。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=5.0；claims=5 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=5 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"学习展板的用户可见技术文案受 TECHNICAL-WRITING-PROTOCOL.md 约束。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L3-L3"]},{"text":"学习展板的视觉设计受 SHOWCASE-VISUAL-PROTOCOL.md 约束，它是学习展板视觉设计的唯一现行规范入口。","citations":["rules/SHOWCASE-VISUAL-PROTOCOL.md#L3-L3"]},{"text":"技术文案规范约束句子怎么写，视觉规范约束结论由什么承载、首屏如何组织以及用什么证据验收，两者同时成立。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L182-L183"]},{"text":"新建、改建或视觉复核学习展板时，必须同时读取并遵守 SHOWCASE-VISUAL-PROTOCOL.md。","citations":["rules/AGENTS.md#L171-L173"]},{"text":"涉及用户可见文案时需同时读取 TECHNICAL-WRITING-PROTOCOL.md。","citations":["rules/LEARNING-PROTOCOL.md#L45-L46"]}]}
```

**citations 与冻结原文**

claim 1：学习展板的用户可见技术文案受 TECHNICAL-WRITING-PROTOCOL.md 约束。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L3-L3`
    3| 本规范约束仓库中的用户可见技术文案，包括每日学习笔记、周计划与复盘、学习展板、runbook 摘要和验收说明。

claim 2：学习展板的视觉设计受 SHOWCASE-VISUAL-PROTOCOL.md 约束，它是学习展板视觉设计的唯一现行规范入口。
- `rules/SHOWCASE-VISUAL-PROTOCOL.md#L3-L3`
    3| 本文件是学习展板视觉设计的**唯一现行规范入口**。它约束新建、改建和视觉复核，回答三个问题：

claim 3：技术文案规范约束句子怎么写，视觉规范约束结论由什么承载、首屏如何组织以及用什么证据验收，两者同时成立。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L182-L183`
    182| 10. 新建或改建一块板前先按 `SHOWCASE-VISUAL-PROTOCOL.md` 产出十列设计契约。
    183|     本规范约束句子怎么写；视觉规范约束结论由什么承载、首屏如何组织以及用什么证据验收，两者同时成立。

claim 4：新建、改建或视觉复核学习展板时，必须同时读取并遵守 SHOWCASE-VISUAL-PROTOCOL.md。
- `rules/AGENTS.md#L171-L173`
    171| 新建、改建或视觉复核学习展板时，必须同时读取并遵守
    172| [`SHOWCASE-VISUAL-PROTOCOL.md`](./SHOWCASE-VISUAL-PROTOCOL.md)。该规范负责视觉编码、信息层级、图标/动效边界与人工验收证据；
    173| 周级 visualization plan 只记录当周事实和取舍，不能替代根级规范。

claim 5：涉及用户可见文案时需同时读取 TECHNICAL-WRITING-PROTOCOL.md。
- `rules/LEARNING-PROTOCOL.md#L45-L46`
    45| 新建、改建或视觉复核学习展板时，额外读取根目录 `SHOWCASE-VISUAL-PROTOCOL.md`；涉及用户可见文案时同时读取
    46| `TECHNICAL-WRITING-PROTOCOL.md`。周级 visualization plan 只记录事实与取舍，不替代根级视觉规范。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 支持；claim 2 支持；claim 3 支持；claim 4 支持；claim 5 支持。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。`TECHNICAL-WRITING-PROTOCOL.md#L1-L5`：claim 1 只说明受 TECH 约束，claim 3 虽覆盖“句子怎么写”但 citation 为 `TECH#L182-L183`，越出 `L1-L5`。`SHOWCASE-VISUAL-PROTOCOL.md#L1-L10`：claim 2 只覆盖“唯一入口/约束新建改建视觉复核”，未覆盖视觉形态与验收；claim 3/4 的相关内容 citation 不在该 span。
- [x] 本题最终判定：**不通过** —— 理由：两个必需的 requirement 均未按 R1 由落在对应 span 内的 claim 覆盖。

---

## 5. `w13-dev-paraphrase-01`（paraphrase / 预期 `answered`）

**题目事实**

- query：我不清楚 Express 接口中接收请求、处理业务规则和访问数据库的代码应该如何分工，AI 可以直接替我完成实现吗？
- 预期结论（不发送给模型）：不可以直接实现。这属于 W2 API 分层黑名单；应先进行 L1 原理与职责边界讲解，声明卡住后最高只能升到 L2。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L66-L70`（`documents/AGENTS.md` L66-L70）：该来源范围必须将 route、controller、service 和 repository 的职责列为 W2 API 分层黑名单内容。
- `rules-c0a4b85/AGENTS.md#L101-L110`（`documents/AGENTS.md` L101-L110）：该来源范围必须定义 L1 的讲解边界，并规定黑名单最高援助等级为 L2。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=5.0；claims=5 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=5 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"AI 不能直接代写核心学习代码，例如数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等；AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。","citations":["rules/AGENTS.md#L11-L12"]},{"text":"L2 定向提示/骨架会指出文件、函数、错误位置，给伪代码、步骤、数据流或带空缺结构，但不含可直接运行实现。","citations":["rules/AGENTS.md#L106-L106"]},{"text":"讲解、引导、review 可以；直接代写核心逻辑不可以。","citations":["rules/AGENTS.md#L260-L262"]},{"text":"黑名单止步 L2，给到 L2 就记债并安排重建；白名单可直接处理，但仍保持最小范围。","citations":["rules/AGENTS.md#L260-L262"]},{"text":"长期能力提醒中的分层判断要求区分业务决策、数据访问、HTTP 表达和工具 API 各自的职责。","citations":["rules/LEARNING-PROTOCOL.md#L223-L223"]}]}
```

**citations 与冻结原文**

claim 1：AI 不能直接代写核心学习代码，例如数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等；AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。
- `rules/AGENTS.md#L11-L12`
    11| 1. **核心学习代码不直接代写。**
    12|    数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。

claim 2：L2 定向提示/骨架会指出文件、函数、错误位置，给伪代码、步骤、数据流或带空缺结构，但不含可直接运行实现。
- `rules/AGENTS.md#L106-L106`
    106| 2. **L2 定向提示 / 骨架**：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。

claim 3：讲解、引导、review 可以；直接代写核心逻辑不可以。
- `rules/AGENTS.md#L260-L262`
    260| 讲解、引导、review 可以；直接代写核心逻辑不可以。
    261| 黑名单止步 L2，给到 L2 就记债并安排重建；白名单可直接处理，但仍保持最小范围。
    262| 目标是让这次 skillup 成为能力得到的证据，而不是 AI 代劳的证据。

claim 4：黑名单止步 L2，给到 L2 就记债并安排重建；白名单可直接处理，但仍保持最小范围。
- `rules/AGENTS.md#L260-L262`
    260| 讲解、引导、review 可以；直接代写核心逻辑不可以。
    261| 黑名单止步 L2，给到 L2 就记债并安排重建；白名单可直接处理，但仍保持最小范围。
    262| 目标是让这次 skillup 成为能力得到的证据，而不是 AI 代劳的证据。

claim 5：长期能力提醒中的分层判断要求区分业务决策、数据访问、HTTP 表达和工具 API 各自的职责。
- `rules/LEARNING-PROTOCOL.md#L223-L223`
    223| - **分层判断**：区分业务决策、数据访问、HTTP 表达和工具 API 各自的职责。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：本次不逐条判 claim 支持——失败已由 §2.7 的 requirement 覆盖条件确定；claim 与 citation 只作归因材料。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。requirement `AGENTS.md#L66-L70` 无 span 内 citation；另一项 `#L101-L110` 有 span 内引用（c2 的 `L106`）。→ 按 R1 ② 未覆盖 → §2.7 不满足。
- [x] 本题最终判定：**不通过** —— 理由：依据 R1 ②，requirement 无 span 内 citation。

---

## 6. `w13-dev-paraphrase-02`（paraphrase / 预期 `answered`）

**题目事实**

- query：我想弄明白 Node.js 中定时器、I/O 回调和 Promise 为什么按特定顺序执行，AI 可以直接替我写完整演示代码吗？
- 预期结论（不发送给模型）：不可以。这属于 W5 Node.js 底层黑名单；应先进行 L1 原理讲解，最高援助等级为 L2。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L66-L78`（`documents/AGENTS.md` L66-L78）：该来源范围必须将事件循环等 Node.js 底层机制及其理解型 demo 列为 W5 黑名单内容。
- `rules-c0a4b85/AGENTS.md#L101-L110`（`documents/AGENTS.md` L101-L110）：该来源范围必须定义 L1 原理讲解，并规定黑名单最高援助等级为 L2。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=5.0；claims=5 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=5 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch": "answered", "claims": [{"text": "Node.js 底层相关 demo（包括事件循环等体现底层理解的 demo）属于黑名单，任何情况下不给完整实现，援助上限 L2。", "citations": ["rules/AGENTS.md#L77-L77"]}, {"text": "导师模式为默认模式：AI 讲原理、引导、review；黑名单核心代码不代写，适用于 Node.js 核心学习任务。", "citations": ["rules/AGENTS.md#L86-L86"]}, {"text": "核心学习代码不直接代写，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。", "citations": ["rules/AGENTS.md#L11-L12"]}, {"text": "L1 援助为原理与问题拆解：解释为什么、输入输出、职责边界、验证方式，不含代码。", "citations": ["rules/AGENTS.md#L105-L105"]}, {"text": "仓库目标是让仓库主人通过 Node.js skillup 真正掌握工程能力，不是把核心学习任务外包给 AI。", "citations": ["rules/AGENTS.md#L3-L3"]}]}
```

**citations 与冻结原文**

claim 1：Node.js 底层相关 demo（包括事件循环等体现底层理解的 demo）属于黑名单，任何情况下不给完整实现，援助上限 L2。
- `rules/AGENTS.md#L77-L77`
    77| - **W5 Node.js 底层**：事件循环、libuv、流与背压、worker threads 等体现底层理解的 demo

claim 2：导师模式为默认模式：AI 讲原理、引导、review；黑名单核心代码不代写，适用于 Node.js 核心学习任务。
- `rules/AGENTS.md#L86-L86`
    86| - **导师模式**（默认）：AI 讲原理、引导、review；黑名单核心代码不代写。适用于 Node.js 核心学习任务。

claim 3：核心学习代码不直接代写，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。
- `rules/AGENTS.md#L11-L12`
    11| 1. **核心学习代码不直接代写。**
    12|    数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。

claim 4：L1 援助为原理与问题拆解：解释为什么、输入输出、职责边界、验证方式，不含代码。
- `rules/AGENTS.md#L105-L105`
    105| 1. **L1 原理与问题拆解**：解释为什么、输入输出、职责边界、验证方式；不含代码。

claim 5：仓库目标是让仓库主人通过 Node.js skillup 真正掌握工程能力，不是把核心学习任务外包给 AI。
- `rules/AGENTS.md#L3-L3`
    3| 本文件是在本仓库协作的 AI agent 行为约束。仓库目标是让仓库主人通过 Node.js skillup **真正掌握工程能力**，不是把核心学习任务外包给 AI。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 部分支持（`AGENTS.md#L77` 只支持“Node.js 底层等 demo 属于 W5 黑名单”，不支持“任何情况下不给完整实现、援助上限 L2”）；claim 2 支持；claim 3 支持；claim 4 支持；claim 5 支持。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。`AGENTS.md#L66-L78` 满足（claim 1 的 `L77` 落在 span 内）。`AGENTS.md#L101-L110` 有 span 内引用 claim 4 的 `L105`，但该 claim 只覆盖“L1 原理与问题拆解”，未覆盖“黑名单最高援助等级为 L2”；覆盖 L2 的 claim 1 引用 `L77` 在 span 外 → ① 内容覆盖不满足。
- [x] 本题最终判定：**不通过** —— 理由：第二项 requirement 的 L2 上限未由对应 span 内 citation 覆盖。

---

## 7. `w13-dev-priority-conflict-exception-01`（priority_conflict_exception / 预期 `answered`）

**题目事实**

- query：当前处于 W13 D2，我想立即把主线切换为 MCP 学习，是否符合现行范围与优先级？
- 预期结论（不发送给模型）：不符合。W13 对应 RAG，MCP 对应 W15；本周核心能力闭环优先。除非正式修改计划，否则不能直接切换主线。
- 运行状态：`status=ok`（retryable=False）→ `verdict=fail`；reasons=['branch_match']；pending=['reason_text_consistency']

**证据要求（不发送给模型）**

- `rules-c0a4b85/DAILY-LEARNING-REPORT-PROTOCOL.md#L117-L135`（`documents/DAILY-LEARNING-REPORT-PROTOCOL.md` L117-L135）：该来源范围必须分别把 RAG 与 MCP 归入 W13 和 W15。
- `rules-c0a4b85/LEARNING-PROTOCOL.md#L188-L200`（`documents/LEARNING-PROTOCOL.md` L188-L200）：该来源范围必须规定本周核心能力闭环优先，并限制主线完成前启动低优先级事项。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=False；score=None；expected=answered actual=abstained
- `claim_count`：skip(abstained)；passed=None；score=None；not answered
- `citation_present`：skip(abstained)；passed=None；score=None；not answered
- `citation_resolvable`：skip(no-citations)；passed=None；score=None；no citation returned
- `citation_precision`：skip(no-citations)；passed=None；score=None；0/0 is not 0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"abstained","reason_code":"insufficient_corpus_evidence","reason_text":"现有证据未包含 W13 D2 的核心能力闭环或主线切换规则，无法判断将主线切换为 MCP 学习是否符合现行优先级。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：归因材料，不逐条判。
- [x] 回答是否满足该 item 的 evidence requirement：不适用（abstained 响应，按契约 §3 判定）。
- [x] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）：归因材料，不改判定。
- [x] 本题最终判定：**不通过** —— 理由：机械 `branch_match` 已失败（预期 `answered` 却 `abstained`）；归因材料，不改判定。

---

## 8. `w13-dev-priority-conflict-exception-02`（priority_conflict_exception / 预期 `answered`）

**题目事实**

- query：独立功能分支尚未合并 main，但已经构建成功，是否因此可以直接发布到服务器？
- 预期结论（不发送给模型）：不可以据此直接发布。发布分支必须明确，构建成功不等于线上更新，部署还需要独立授权并完成发布前验证。
- 运行状态：`status=ok`（retryable=False）→ `verdict=fail`；reasons=['branch_match']；pending=['reason_text_consistency']

**证据要求（不发送给模型）**

- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L34-L38`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L34-L38）：该来源范围必须区分构建、部署和合并上线的权限层级，并要求按用户授权范围执行。
- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L60-L61`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L60-L61）：该来源范围必须规定发布分支需要明确，且功能分支构建成功不等于线上已经更新。
- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L64-L90`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L64-L90）：该来源范围必须列出发布前仍需完成的范围确认、检查、构建和验证步骤。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=False；score=None；expected=answered actual=abstained
- `claim_count`：skip(abstained)；passed=None；score=None；not answered
- `citation_present`：skip(abstained)；passed=None；score=None；not answered
- `citation_resolvable`：skip(no-citations)；passed=None；score=None；no citation returned
- `citation_precision`：skip(no-citations)；passed=None；score=None；0/0 is not 0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"abstained","reason_code":"insufficient_corpus_evidence","reason_text":"现有证据未直接规定功能分支未合并 main 且构建成功时能否发布到服务器。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：归因材料，不逐条判。
- [x] 回答是否满足该 item 的 evidence requirement：不适用（abstained 响应，按契约 §3 判定）。
- [x] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）：归因材料，不改判定。
- [x] 本题最终判定：**不通过** —— 理由：机械 `branch_match` 已失败（预期 `answered` 却 `abstained`）；归因材料，不改判定。

---

## 9. `w13-dev-no-answer-01`（no_answer / 预期 `abstained`）

**题目事实**

- query：依据 rules-c0a4b85，法语口语稿应采用多少词、什么输出格式？
- 预期结论（不发送给模型）：冻结语料只定义每日技术英语口语稿，没有规定法语口语稿的长度和格式，因此无法确定。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['reason_text_consistency']

**证据要求（不发送给模型）**

- `rules-c0a4b85/DAILY-SPEAKING-PROTOCOL.md#L1-L3`（`documents/DAILY-SPEAKING-PROTOCOL.md` L1-L3）：该来源范围必须表明现有规范的对象是每日技术英语口语稿。
- `corpus_absence`（scope=entire_corpus）：整个冻结 corpus 不得包含法语口语稿的词数或输出格式规则。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=abstained actual=abstained
- `claim_count`：skip(abstained)；passed=None；score=None；not answered
- `citation_present`：skip(abstained)；passed=None；score=None；not answered
- `citation_resolvable`：skip(no-citations)；passed=None；score=None；no citation returned
- `citation_precision`：skip(no-citations)；passed=None；score=None；0/0 is not 0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch": "abstained", "reason_code": "insufficient_corpus_evidence", "reason_text": "证据仅涉及每日技术英语口语稿，未提供法语口语稿的词数或输出格式要求。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：不适用（abstained 响应按契约 §3，不返回 claims 与 citation）。
- [x] 回答是否满足该 item 的 evidence requirement：满足——`reason_code` 为 `insufficient_corpus_evidence`；`reason_text` 说明只涉及每日技术英语口语稿、未提供法语口语稿的词数或输出格式要求，与冻结 `corpus_absence` 一致。
- [x] 本题最终判定：**通过**。

---

## 10. `w13-dev-no-answer-02`（no_answer / 预期 `abstained`）

**题目事实**

- query：依据 rules-c0a4b85，是否允许使用 subagent 参与学习展板视觉标准的独立 review？
- 预期结论（不发送给模型）：冻结语料没有规定 subagent 是否可以参与该 review，因此无法确定。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['reason_text_consistency']

**证据要求（不发送给模型）**

- `corpus_absence`（scope=entire_corpus）：整个冻结 corpus 不得包含 subagent 参与学习展板视觉标准 review 的允许或禁止规则。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=abstained actual=abstained
- `claim_count`：skip(abstained)；passed=None；score=None；not answered
- `citation_present`：skip(abstained)；passed=None；score=None；not answered
- `citation_resolvable`：skip(no-citations)；passed=None；score=None；no citation returned
- `citation_precision`：skip(no-citations)；passed=None；score=None；0/0 is not 0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch": "abstained", "reason_code": "insufficient_corpus_evidence", "reason_text": "证据上下文中未出现关于 subagent 参与 review 的任何规定，无法回答该问题。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：不适用（abstained 响应按契约 §3，不返回 claims 与 citation）。
- [x] 回答是否满足该 item 的 evidence requirement：满足——`reason_code` 为 `insufficient_corpus_evidence`；`reason_text` 说明证据中未出现 subagent 参与该 review 的规定，与冻结 `corpus_absence` 一致。
- [x] 本题最终判定：**通过**。

---

## 11. split 级收口（本人填）

| # | item | 判定结论 | 备注 |
|---|---|---|---|
| 1 | `w13-dev-direct-answer-01` | **不通过** | 依据 R1 ②：requirement `AGENTS.md#L66-L72` 无 span 内 citation（c1/c2 引用 `L71-L76` 越界，c3 引用 `L110-L111` 亦在 span 外）→ §2.7 不满足。 |
| 2 | `w13-dev-direct-answer-02` | **通过** | 人工语义判定通过；覆盖由 claim 1/2/3 的 `TECH#L118` 与 claim 4/5 的 `TECH#L120` 合入 `L118-L120`。 |
| 3 | `w13-dev-cross-document-01` | **不通过** | `AGENTS.md#L161-L163` 要求未由 span 内 claim 完整覆盖。 |
| 4 | `w13-dev-cross-document-02` | **不通过** | `TECH L1-L5`、`SHOWCASE L1-L10` 均未按 R1 覆盖。 |
| 5 | `w13-dev-paraphrase-01` | **不通过** | 依据 R1 ②：requirement `AGENTS.md#L66-L70` 无 span 内 citation；另一项 `#L101-L110` 有 span 内引用（c2 的 `L106`）。 |
| 6 | `w13-dev-paraphrase-02` | **不通过** | `AGENTS.md#L101-L110` 有 span 内引用 claim 4 的 `L105`，但该 claim 只覆盖 L1 原理；覆盖 L2 上限的 claim 1 引用 `L77` 在 span 外 → ① 内容覆盖不满足。 |
| 7 | `w13-dev-priority-conflict-exception-01` | **不通过** | 机械 `branch_match` 已失败；归因材料，不改判定。 |
| 8 | `w13-dev-priority-conflict-exception-02` | **不通过** | 机械 `branch_match` 已失败；归因材料，不改判定。 |
| 9 | `w13-dev-no-answer-01` | **通过** | reason text 与 reason_code/corpus_absence 一致。 |
| 10 | `w13-dev-no-answer-02` | **通过** | reason text 与 reason_code/corpus_absence 一致。 |

- [x] 已填写判定结论的条数：**10/10**（依据分别为：语义内容覆盖 6 题、R1 ② 包含性 2 题、机械分支条件 2 题）
- [x] 语义 evaluator 是否仍有 pending：本次运行证据中的语义槽位保持 `None`（历史不回调）；本工作表给出逐题结论与理由。
- [x] 结论句（只写本次证据能支持的范围）：

> 在 R1 口径下，BM25 指定语义判定通过 3/10；§6.4 `item_pass_rate` 与 §6.5 per-class 门禁不满足，因此该次运行不能通过。本轮为本人授权的链路演示例外（retrieval-only 门禁未通过），结论只描述该次运行，不作质量验收。运行证据 JSON 不回调，其 `verdict` 保持运行当时状态（`0 passed / 2 failed / 8 pending`）；3/10 出自本工作表。

**门禁五条（本次判定后的状态）**

- §6.1 运行有效：**满足**。hash 与冻结一致；10/10 item ID 各有可归属结果；未读 holdout；context 重算 10/10 与记录一致；R1 冻结于 2026-09-10，早于本次运行。
- §6.2 没有预期 `abstained` 的 item 返回 `answered`：**满足**（`zero_tolerance` 为空）。
- §6.3 `citation_precision = 1.0`：**满足**。
- §6.4 `item_pass_rate >= 0.9`：**不满足**（3/10）。
- §6.5 五类 behavior type 分别至少 1/2 通过：**不满足**（`cross_document`、`paraphrase`、`priority_conflict_exception` 均 0/2）。

**观察（不宣布隔离）**：本文件 2 题 R1 ② 失败的共同形态是“引用了相关但不同的行”——`AGENTS.md#L71-L76` 对 `#L66-L72`（direct-answer-01）、`AGENTS.md#L11-L12` 对 `#L66-L70`（paraphrase-01）。dense 轮存在同型实例（见该工作表）；连同 D4 的 full-context 记录，属同一类“span 与 block / 引用粒度不对齐”的第三次同型观察，仍不是单因素实验，不能宣布已隔离。
