# W13 dev 人工语义判定素材（脚本生成）

> 生成脚本：`scripts/build-semantic-worksheet.py`（可重跑；证据或语料变化后重新生成）。
> 证据来源：`evidence/baseline/dev-full-context-prompt-v1-json-output-01.json`
> evidenceId：`dev-baseline-full-context-rules-c0a4b85-scoring-v2`；Prompt：`w13-rag-prompt-v1`；语料：`rules-c0a4b85`；生成：`2026-09-10T23:06:05+08:00`
> 判定规则来源：[`../eval/scoring-contract.md`](../eval/scoring-contract.md)（状态 `frozen`）。

## 0. 判定素材说明与边界

- 机械 evaluator 的结果见每题「运行与机械结果」段，无需重判。
- 本人负责的语义判定（契约 §1）：claim 是否被引用的原文支持、回答是否满足 evidence requirement、
  abstained 的 reason text 是否与 reason_code 及该题 `corpus_absence` 一致。
- 判定适用范围是可通过解析的 item；已由机械条件判为 `fail` 的 item，其 claims 与 citations 只作
  失败阶段归因材料，不改变该 item 的失败判定。
- 「通过 / 不通过」与最终结论由本人填写；本文件不提供任何结论。

**判定口径（本人在本次运行之后冻结，见 [`../eval/scoring-rulings-r1.md`](../eval/scoring-rulings-r1.md)）**：

- **R1 `evidence_requirements` 覆盖口径（严格包含）**：某项 requirement 被覆盖，必须同时满足——① 至少一条
  claim 的内容覆盖该 requirement 描述的要求；② 该 claim 的 citation 行范围落在该 requirement 的 `source_span`
  内（同一文档且 `citation.start >= span.start`、`citation.end <= span.end`）。跨块合并与越界引用都视为未覆盖。
- 本口径的澄清时点与效力边界记录在 `eval/scoring-rulings-r1.md`；不得在看到结果后再次调整。

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
- `claim_count`：applies；passed=True；score=4.0；claims=4 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=5 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"JWT 签发与验证流程属于黑名单项，任何情况下不给完整实现，援助上限 L2。","citations":["rules/AGENTS.md#L71-L76"]},{"text":"黑名单项的最高援助级别为 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。","citations":["rules/AGENTS.md#L68-L68","rules/AGENTS.md#L110-L111"]},{"text":"L2 指定向提示 / 骨架：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。","citations":["rules/AGENTS.md#L106-L106"]},{"text":"AI 对黑名单知识点给到 L2 即触发欠债记账。","citations":["rules/AGENTS.md#L181-L181"]}]}
```

**citations 与冻结原文**

claim 1：JWT 签发与验证流程属于黑名单项，任何情况下不给完整实现，援助上限 L2。
- `rules/AGENTS.md#L71-L76`
    71| - **W4 认证鉴权**：
    72|   - JWT 签发与验证流程
    73|   - 密码哈希与存储策略
    74|   - OAuth2 授权码交换、state 校验、回调处理
    75|   - RBAC 角色 / 权限模型、401/403 判断、授权所在层设计
    76|   - Web 安全防护逻辑

claim 2：黑名单项的最高援助级别为 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。
- `rules/AGENTS.md#L68-L68`
    68| - **W1 建模与索引**：嵌入 vs 引用；索引设计；`explain` 结果解读
- `rules/AGENTS.md#L110-L111`
    110| 黑名单项最高 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。
    111| 截止时间只影响砍范围，不影响援助上限。

claim 3：L2 指定向提示 / 骨架：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。
- `rules/AGENTS.md#L106-L106`
    106| 2. **L2 定向提示 / 骨架**：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。

claim 4：AI 对黑名单知识点给到 L2 即触发欠债记账。
- `rules/AGENTS.md#L181-L181`
    181| - AI 对黑名单知识点给到 L2；

**本人判定（2026-09-10，结论由本人给出；AI 只做回填。分层口径：claim 支持性只看内容，位置越界在 R1 层记账）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 **部分支持**（`#L71-L76` 只支持「JWT 属于 W4 认证鉴权子项」，不支持「属于黑名单项」「援助上限 L2」「任何情况下不给完整实现」这些必要部分）；claim 2 **支持**（`#L110-L111` 原文完整支持「黑名单项最高 L2；不得升级到 L3/L4」）；claim 3 **支持**（`#L106` 原文即 L2 定义）；claim 4 **支持**（`#L181` 原文即「AI 对黑名单知识点给到 L2」的触发条件项）
- [x] 回答是否满足该 item 的 evidence requirement：**不满足**（按 R1）——① 上限 L2 在 span 内的 L66，但没有任何 claim 合规引用到 L66，claim 2 的 `#L110-L111` 内容支持却越界；② JWT 列入黑名单由 claim 1 覆盖，但 citation `#L71-L76` 越界
- [x] 本题最终判定：**不通过** —— 理由：claim 支持性按内容层判定后，claim 2/3/4 不再因位置越界被判「不支持」；requirement 层缺少 span 内合规引用，R1 覆盖不满足。`citation_precision` 仍按机械层保持 `1.0`，不与 requirement 位置问题互相污染

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
- `claim_count`：applies；passed=True；score=6.0；claims=6 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=11 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"讲解与文案一律直接使用官方术语。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118","rules/AGENTS.md#L163-L163"]},{"text":"若需用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118","rules/AGENTS.md#L163-L163"]},{"text":"该类比或助记不得在后续讨论中取代术语作为唯一指称；删除类比后官方术语必须仍能单独承载完整语义。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118","rules/AGENTS.md#L163-L163"]},{"text":"对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120","rules/AGENTS.md#L163-L163"]},{"text":"正确形态是首次提及即术语与类比并列，后续只用官方术语指称。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120"]},{"text":"已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118","rules/AGENTS.md#L163-L163"]}]}
```

**citations 与冻结原文**

claim 1：讲解与文案一律直接使用官方术语。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

claim 2：若需用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

claim 3：该类比或助记不得在后续讨论中取代术语作为唯一指称；删除类比后官方术语必须仍能单独承载完整语义。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

claim 4：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120`
    120| 本条款同时约束讲解过程与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列，后续只用官方术语指称。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

claim 5：正确形态是首次提及即术语与类比并列，后续只用官方术语指称。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120`
    120| 本条款同时约束讲解过程与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列，后续只用官方术语指称。

claim 6：已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

**本人判定（2026-09-10，结论由本人给出；AI 只做回填。分层口径同前）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1–6 全部**支持**（claim 1/2/3/6 由 `#L118` 支持；claim 4/5 由 `#L120` 支持）。按分层口径，`AGENTS.md#L163` 虽在 requirement span 外，但内容支持对应 claim，不在 claim 支持性层扣分
- [x] 回答是否满足该 item 的 evidence requirement：**满足**（按 R1）——① 并列关系由 claim 2/5/6 覆盖；② 不得以自创指称替代官方术语由 claim 1/3/4 覆盖；两者 citation 均落在 `L118-L120` 内
- [x] 本题最终判定：**通过** —— 理由：6 条 claims 均获内容支持；唯一 requirement 的两个组成均由 span 内 citation 覆盖；`precision` 维持机械层 `1.0`。附带观察：query 为 yes/no 式，claims 为规则陈述，按契约 §2.3「语义等价覆盖、不要求逐字一致」，规则本身即否定结论

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
- `claim_count`：applies；passed=True；score=4.0；claims=4 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=4 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"AGENTS.md 规定讲解与文案一律直接使用官方术语；若需用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。","citations":["rules/AGENTS.md#L163-L163"]},{"text":"TECHNICAL-WRITING-PROTOCOL.md §3.6 规定讲解与文案一律直接使用官方术语；若需要用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]},{"text":"AGENTS.md 明确：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。","citations":["rules/AGENTS.md#L163-L163"]},{"text":"TECHNICAL-WRITING-PROTOCOL.md §3.6 明确：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120"]}]}
```

**citations 与冻结原文**

claim 1：AGENTS.md 规定讲解与文案一律直接使用官方术语；若需用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

claim 2：TECHNICAL-WRITING-PROTOCOL.md §3.6 规定讲解与文案一律直接使用官方术语；若需要用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记，且不得在后续讨论中取代术语作为唯一指称。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 3：AGENTS.md 明确：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

claim 4：TECHNICAL-WRITING-PROTOCOL.md §3.6 明确：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120`
    120| 本条款同时约束讲解过程与落盘文案：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规；正确形态是首次提及即术语与类比并列，后续只用官方术语指称。

**本人判定（2026-09-10，结论由本人给出；AI 只做回填。按 R1 口径）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1–4 全部**支持**（claim 1/3 引 `AGENTS.md#L163`，claim 2 引 `TECHNICAL-WRITING-PROTOCOL.md#L118`，claim 4 引 `#L120`；措辞与原文一致）
- [x] 回答是否满足该 item 的 evidence requirement：两条**均满足**——requirement 1：`#L163` 落在 `L161-L163` 内，已规定并列与显式标注，并明确「先出现自创助记词、回填时才补官方术语」属于违规，与 query 的「未明确标注」可对应；requirement 2：`#L118` 与 `#L120` 均落在 `L116-L120` 内，独立规定并列、显式标注、后续指称边界，并给出违规形态与正确形态
- [x] 本题最终判定：**通过** —— 理由：两份根级规范各有独立 citation 支撑「共同约束」；4 条 claims 内容与原文一致；内容覆盖与 R1 位置合规均满足

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
- `claim_count`：applies；passed=True；score=9.0；claims=9 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=9 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"学习展板文案新建或修改每日学习笔记、周计划、复盘、runbook 摘要和学习展板文案时，必须先读取并遵守 `TECHNICAL-WRITING-PROTOCOL.md`。","citations":["rules/AGENTS.md#L167-L167"]},{"text":"新建、改建或视觉复核学习展板时，必须同时读取并遵守 `SHOWCASE-VISUAL-PROTOCOL.md`。","citations":["rules/AGENTS.md#L171-L173"]},{"text":"`TECHNICAL-WRITING-PROTOCOL.md` 约束表达方式，不改变黑白名单与辅助阶梯。","citations":["rules/AGENTS.md#L169-L169"]},{"text":"`SHOWCASE-VISUAL-PROTOCOL.md` 负责视觉编码、信息层级、图标/动效边界与人工验收证据。","citations":["rules/AGENTS.md#L171-L173"]},{"text":"`SHOWCASE-VISUAL-PROTOCOL.md` 是学习展板视觉设计的唯一现行规范入口。","citations":["rules/SHOWCASE-VISUAL-PROTOCOL.md#L3-L3"]},{"text":"`TECHNICAL-WRITING-PROTOCOL.md` 继续约束学习展板的事实强度和句子表达。","citations":["rules/SHOWCASE-VISUAL-PROTOCOL.md#L9-L11"]},{"text":"`SHOWCASE-VISUAL-PROTOCOL.md` 继续约束学习展板的构建与发布相关内容之外，周级 visualization plan 记录当周事实和设计取舍。","citations":["rules/SHOWCASE-VISUAL-PROTOCOL.md#L9-L11"]},{"text":"`TECHNICAL-WRITING-PROTOCOL.md` 约束仓库中的用户可见技术文案，包括每日学习笔记、周计划与复盘、学习展板、runbook 摘要和验收说明。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L3-L3"]},{"text":"`TECHNICAL-WRITING-PROTOCOL.md` 约束句子怎么写；`SHOWCASE-VISUAL-PROTOCOL.md` 约束结论由什么承载、首屏如何组织以及用什么证据验收，两者同时成立。","citations":["rules/TECHNICAL-WRITING-PROTOCOL.md#L182-L183"]}]}
```

**citations 与冻结原文**

claim 1：学习展板文案新建或修改每日学习笔记、周计划、复盘、runbook 摘要和学习展板文案时，必须先读取并遵守 `TECHNICAL-WRITING-PROTOCOL.md`。
- `rules/AGENTS.md#L167-L167`
    167| 新建或修改每日学习笔记、周计划、复盘、runbook 摘要和学习展板文案时，必须先读取并遵守 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md)。

claim 2：新建、改建或视觉复核学习展板时，必须同时读取并遵守 `SHOWCASE-VISUAL-PROTOCOL.md`。
- `rules/AGENTS.md#L171-L173`
    171| 新建、改建或视觉复核学习展板时，必须同时读取并遵守
    172| [`SHOWCASE-VISUAL-PROTOCOL.md`](./SHOWCASE-VISUAL-PROTOCOL.md)。该规范负责视觉编码、信息层级、图标/动效边界与人工验收证据；
    173| 周级 visualization plan 只记录当周事实和取舍，不能替代根级规范。

claim 3：`TECHNICAL-WRITING-PROTOCOL.md` 约束表达方式，不改变黑白名单与辅助阶梯。
- `rules/AGENTS.md#L169-L169`
    169| 该技术文案规范约束表达方式，不改变黑白名单与辅助阶梯。文案优化不得改写事实强度、证据等级、历史时点或未验证边界；如果简洁与事实完整冲突，优先保留事实完整。

claim 4：`SHOWCASE-VISUAL-PROTOCOL.md` 负责视觉编码、信息层级、图标/动效边界与人工验收证据。
- `rules/AGENTS.md#L171-L173`
    171| 新建、改建或视觉复核学习展板时，必须同时读取并遵守
    172| [`SHOWCASE-VISUAL-PROTOCOL.md`](./SHOWCASE-VISUAL-PROTOCOL.md)。该规范负责视觉编码、信息层级、图标/动效边界与人工验收证据；
    173| 周级 visualization plan 只记录当周事实和取舍，不能替代根级规范。

claim 5：`SHOWCASE-VISUAL-PROTOCOL.md` 是学习展板视觉设计的唯一现行规范入口。
- `rules/SHOWCASE-VISUAL-PROTOCOL.md#L3-L3`
    3| 本文件是学习展板视觉设计的**唯一现行规范入口**。它约束新建、改建和视觉复核，回答三个问题：

claim 6：`TECHNICAL-WRITING-PROTOCOL.md` 继续约束学习展板的事实强度和句子表达。
- `rules/SHOWCASE-VISUAL-PROTOCOL.md#L9-L11`
    9| `TECHNICAL-WRITING-PROTOCOL.md` 继续约束事实强度和句子表达，
    10| `SHOWCASE-DEPLOY-PROTOCOL.md` 继续约束构建与发布，周级 visualization plan 记录当周事实和设计取舍。
    11| `week8-fullstack/notes/visualization-optimization-roadmap.md` 保留历史演进与失效案例，不再充当规范入口。

claim 7：`SHOWCASE-VISUAL-PROTOCOL.md` 继续约束学习展板的构建与发布相关内容之外，周级 visualization plan 记录当周事实和设计取舍。
- `rules/SHOWCASE-VISUAL-PROTOCOL.md#L9-L11`
    9| `TECHNICAL-WRITING-PROTOCOL.md` 继续约束事实强度和句子表达，
    10| `SHOWCASE-DEPLOY-PROTOCOL.md` 继续约束构建与发布，周级 visualization plan 记录当周事实和设计取舍。
    11| `week8-fullstack/notes/visualization-optimization-roadmap.md` 保留历史演进与失效案例，不再充当规范入口。

claim 8：`TECHNICAL-WRITING-PROTOCOL.md` 约束仓库中的用户可见技术文案，包括每日学习笔记、周计划与复盘、学习展板、runbook 摘要和验收说明。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L3-L3`
    3| 本规范约束仓库中的用户可见技术文案，包括每日学习笔记、周计划与复盘、学习展板、runbook 摘要和验收说明。

claim 9：`TECHNICAL-WRITING-PROTOCOL.md` 约束句子怎么写；`SHOWCASE-VISUAL-PROTOCOL.md` 约束结论由什么承载、首屏如何组织以及用什么证据验收，两者同时成立。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L182-L183`
    182| 10. 新建或改建一块板前先按 `SHOWCASE-VISUAL-PROTOCOL.md` 产出十列设计契约。
    183|     本规范约束句子怎么写；视觉规范约束结论由什么承载、首屏如何组织以及用什么证据验收，两者同时成立。

**本人判定（2026-09-10，结论由本人给出；AI 只做回填）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 **部分支持**（原文 L167 句首对象是那组文件列表，claim 语序改写后句首对象变成「学习展板文案」，语义有偏差）；claim 2–6、8、9 **支持**（claim 6 原文未显式限定「学习展板」，按上下文读通）；claim 7 **不支持**（把「构建与发布」归属给 `SHOWCASE-VISUAL-PROTOCOL.md`，原文归属 `SHOWCASE-DEPLOY-PROTOCOL.md`）
- [x] 回答是否满足该 item 的 evidence requirement：两条**均不满足**——requirement 1 未覆盖「说明其事实与表达职责」（该内容在 `TECHNICAL-WRITING-PROTOCOL.md` L5，claims 未基于该范围表述）；requirement 2 未覆盖「视觉形态与验收」，其职责表述来自 `AGENTS.md#L172` 而非 `SHOWCASE-VISUAL-PROTOCOL.md#L1-L10`。**本行结论依赖 requirement 覆盖口径（citation 是否必须落在指定 span 内），该口径待本人冻结**。
- [x] 本题最终判定：**不通过** —— 理由：claim 7 语义错误；citation 全部可解析与 `precision=1.0` 不足以通过语义判定

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
- `claim_count`：applies；passed=True；score=10.0；claims=10 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=19 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"route / controller / service / repository 职责、中间件管道与错误翻译分层属于黑名单项，任何情况下不给完整实现，援助上限 L2。","citations":["rules/AGENTS.md#L69-L69"]},{"text":"AI 对黑名单知识点给到 L2 会触发欠债记账，需在 DEBT.md 追加日期、知识点、援助级别、场景、重建安排、状态。","citations":["rules/AGENTS.md#L181-L181","rules/AGENTS.md#L187-L187"]},{"text":"讲解优先于答案：卡住时先解释为什么、职责边界、输入输出和验证方式，不要急着给可粘贴实现。","citations":["rules/AGENTS.md#L14-L15"]},{"text":"AI 的角色是导师、reviewer 和协作记录员，不是核心代码代写工具。","citations":["rules/AGENTS.md#L5-L5"]},{"text":"Review 允许且鼓励，AI 可以指出 bug、风险、边界场景和更好的思路，但黑名单核心代码的具体修改由仓库主人自己做。","citations":["rules/AGENTS.md#L17-L18"]},{"text":"辅助阶梯中 L1 为原理与问题拆解，L2 为定向提示或骨架，均不含可直接运行实现；L3 局部实现与 L4 完整实现仅对白名单开放。","citations":["rules/AGENTS.md#L105-L105","rules/AGENTS.md#L106-L106","rules/AGENTS.md#L107-L107","rules/AGENTS.md#L108-L108"]},{"text":"黑白名单判定不按对话当场状态裁量，黑名单项即使仓库主人临场说“这次直接给吧”，AI 也不得放行。","citations":["rules/AGENTS.md#L30-L31"]},{"text":"遇到「我不会写」时先判断卡在哪一层：业务模型与正确性模型必须能独立澄清、解释并设计验证，API 表达层可以查文档或使用白名单援助。","citations":["rules/LEARNING-PROTOCOL.md#L244-L244","rules/LEARNING-PROTOCOL.md#L245-L245","rules/LEARNING-PROTOCOL.md#L246-L246"]},{"text":"掌握验收要求能不看代码讲清调用链、解释一个成功路径和两个失败路径、预测修改需求影响哪些层，并能延迟后脱离 AI 和文档重建核心链路。","citations":["rules/LEARNING-PROTOCOL.md#L208-L208","rules/LEARNING-PROTOCOL.md#L209-L209","rules/LEARNING-PROTOCOL.md#L210-L210","rules/LEARNING-PROTOCOL.md#L211-L211"]},{"text":"黑名单止步 L2，给到 L2 就记债并安排重建；白名单可直接处理，但仍保持最小范围。","citations":["rules/AGENTS.md#L260-L262"]}]}
```

**citations 与冻结原文**

claim 1：route / controller / service / repository 职责、中间件管道与错误翻译分层属于黑名单项，任何情况下不给完整实现，援助上限 L2。
- `rules/AGENTS.md#L69-L69`
    69| - **W2 API 分层**：route / controller / service / repository 职责；中间件管道；错误翻译分层

claim 2：AI 对黑名单知识点给到 L2 会触发欠债记账，需在 DEBT.md 追加日期、知识点、援助级别、场景、重建安排、状态。
- `rules/AGENTS.md#L181-L181`
    181| - AI 对黑名单知识点给到 L2；
- `rules/AGENTS.md#L187-L187`
    187| 1. 在 [`DEBT.md`](./DEBT.md) 追加：日期、知识点、援助级别、场景、重建安排、状态。

claim 3：讲解优先于答案：卡住时先解释为什么、职责边界、输入输出和验证方式，不要急着给可粘贴实现。
- `rules/AGENTS.md#L14-L15`
    14| 2. **讲解优先于答案。**
    15|    卡住时先解释为什么、职责边界、输入输出和验证方式；不要急着给可粘贴实现。

claim 4：AI 的角色是导师、reviewer 和协作记录员，不是核心代码代写工具。
- `rules/AGENTS.md#L5-L5`
    5| AI 的角色是导师、reviewer 和协作记录员；不是核心代码代写工具。

claim 5：Review 允许且鼓励，AI 可以指出 bug、风险、边界场景和更好的思路，但黑名单核心代码的具体修改由仓库主人自己做。
- `rules/AGENTS.md#L17-L18`
    17| 3. **Review 允许且鼓励，但修改仍由本人完成。**
    18|    AI 可以指出 bug、风险、边界场景和更好的思路；黑名单核心代码的具体修改由仓库主人自己做。

claim 6：辅助阶梯中 L1 为原理与问题拆解，L2 为定向提示或骨架，均不含可直接运行实现；L3 局部实现与 L4 完整实现仅对白名单开放。
- `rules/AGENTS.md#L105-L105`
    105| 1. **L1 原理与问题拆解**：解释为什么、输入输出、职责边界、验证方式；不含代码。
- `rules/AGENTS.md#L106-L106`
    106| 2. **L2 定向提示 / 骨架**：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。
- `rules/AGENTS.md#L107-L107`
    107| 3. **L3 局部实现**：仅对白名单开放，AI 修改最小必要代码并解释关键决策。
- `rules/AGENTS.md#L108-L108`
    108| 4. **L4 完整实现**：仅对白名单开放，纯样板可直接给。

claim 7：黑白名单判定不按对话当场状态裁量，黑名单项即使仓库主人临场说“这次直接给吧”，AI 也不得放行。
- `rules/AGENTS.md#L30-L31`
    30| 是否能给完整代码，按事先分类判断，不按对话当场状态裁量。
    31| 黑名单项即使仓库主人临场说“这次直接给吧”，AI 也不得放行。

claim 8：遇到「我不会写」时先判断卡在哪一层：业务模型与正确性模型必须能独立澄清、解释并设计验证，API 表达层可以查文档或使用白名单援助。
- `rules/LEARNING-PROTOCOL.md#L244-L244`
    244| | 业务模型 | 最近 6 个月是滚动窗口还是自然月 | 必须能独立澄清和定义 |
- `rules/LEARNING-PROTOCOL.md#L245-L245`
    245| | 正确性模型 | 为什么相邻区间使用 `[start, end)` | 必须能解释并设计边界验证 |
- `rules/LEARNING-PROTOCOL.md#L246-L246`
    246| | API 表达 | JavaScript `Date` 的具体方法名和参数 | 可以查文档、补全或使用白名单援助 |

claim 9：掌握验收要求能不看代码讲清调用链、解释一个成功路径和两个失败路径、预测修改需求影响哪些层，并能延迟后脱离 AI 和文档重建核心链路。
- `rules/LEARNING-PROTOCOL.md#L208-L208`
    208| 1. 能不看代码画出或讲清调用链。
- `rules/LEARNING-PROTOCOL.md#L209-L209`
    209| 2. 能解释一个成功路径和两个失败路径。
- `rules/LEARNING-PROTOCOL.md#L210-L210`
    210| 3. 能预测修改一个需求会影响哪些层。
- `rules/LEARNING-PROTOCOL.md#L211-L211`
    211| 4. 能在延迟后脱离 AI 和文档重建核心链路。

claim 10：黑名单止步 L2，给到 L2 就记债并安排重建；白名单可直接处理，但仍保持最小范围。
- `rules/AGENTS.md#L260-L262`
    260| 讲解、引导、review 可以；直接代写核心逻辑不可以。
    261| 黑名单止步 L2，给到 L2 就记债并安排重建；白名单可直接处理，但仍保持最小范围。
    262| 目标是让这次 skillup 成为能力得到的证据，而不是 AI 代劳的证据。

**本人判定（2026-09-10，结论由本人给出；AI 只做回填。分层口径同前）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 **部分支持**（`#L69` 只支持 W2 API 分层条目内容；「属于黑名单项 / 任何情况下不给完整实现 / 援助上限 L2」出自 L66 标题，不在该 citation 内）；claim 2 **支持**（`#L181` + `#L187`；「触发欠债记账」依赖 L177 章节标题，属口径待一致化点）；claim 3 **支持**；claim 4 **支持**（`#L5` 原文含「不是核心代码代写工具」，**原始判定为部分支持，经原文核对修正**）；claim 5 **支持**；claim 6 **支持**；claim 7 **支持**；claim 8 **支持**；claim 9 **支持**；claim 10 **支持**（`#L260-L262` 内的 L261 与 claim 逐字相同，**原始判定为部分支持，经原文核对修正**）
- [x] 回答是否满足该 item 的 evidence requirement：requirement 1 **满足**（`#L69` 落在 `L66-L70` 内且列出 W2 四项职责）；requirement 2 **不满足**（前半「L1 讲解边界」由 claim 6 的 `#L105` 落内覆盖；后半「黑名单最高援助等级为 L2」在 span 内的 L110，但没有任何 claim 引用 L110）
- [x] 本题最终判定：**不通过** —— 理由：requirement 1 满足，但 requirement 2 要求同时覆盖 L1 讲解边界与黑名单最高 L2，后者缺 span 内合规引用，按 R1 未满足

---

## 6. `w13-dev-paraphrase-02`（paraphrase / 预期 `answered`）

**题目事实**

- query：我想弄明白 Node.js 中定时器、I/O 回调和 Promise 为什么按特定顺序执行，AI 可以直接替我写完整演示代码吗？
- 预期结论（不发送给模型）：不可以。这属于 W5 Node.js 底层黑名单；应先进行 L1 原理讲解，最高援助等级为 L2。
- 运行状态：`status=ok`（retryable=False）→ `verdict=fail`；reasons=['citation_resolvable', 'citation_precision']；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L66-L78`（`documents/AGENTS.md` L66-L78）：该来源范围必须将事件循环等 Node.js 底层机制及其理解型 demo 列为 W5 黑名单内容。
- `rules-c0a4b85/AGENTS.md#L101-L110`（`documents/AGENTS.md` L101-L110）：该来源范围必须定义 L1 原理讲解，并规定黑名单最高援助等级为 L2。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=7.0；claims=7 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=False；score=None；resolved=7 unresolved=['rules/AGENTS.md#L185-L189']
- `citation_precision`：applies；passed=False；score=0.875；precision=0.875
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"事件循环、libuv、流与背压、worker threads 等体现底层理解的 demo 属于黑名单 W5，任何情况下不给完整实现，援助上限 L2。","citations":["rules/AGENTS.md#L77-L77"]},{"text":"黑名单项止步 L2，不得因截止时间、疲惫、临场请求或「继续手写收益不高」升级到 L3/L4。","citations":["rules/AGENTS.md#L110-L111"]},{"text":"AI 对黑名单知识点给到 L2 时触发欠债记账，需在 DEBT.md、LEARNING-STATE.md 与当天笔记同步记录。","citations":["rules/AGENTS.md#L181-L181","rules/AGENTS.md#L185-L189"]},{"text":"黑名单项的援助上限是 L2 定向提示 / 骨架：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。","citations":["rules/AGENTS.md#L106-L106"]},{"text":"仓库目标是让仓库主人通过 Node.js skillup 真正掌握工程能力，不是把核心学习任务外包给 AI。","citations":["rules/AGENTS.md#L3-L3"]},{"text":"AI 的角色是导师、reviewer 和协作记录员，不是核心代码代写工具。","citations":["rules/AGENTS.md#L5-L5"]},{"text":"黑名单核心学习代码不直接代写，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。","citations":["rules/AGENTS.md#L11-L12"]}]}
```

**citations 与冻结原文**

claim 1：事件循环、libuv、流与背压、worker threads 等体现底层理解的 demo 属于黑名单 W5，任何情况下不给完整实现，援助上限 L2。
- `rules/AGENTS.md#L77-L77`
    77| - **W5 Node.js 底层**：事件循环、libuv、流与背压、worker threads 等体现底层理解的 demo

claim 2：黑名单项止步 L2，不得因截止时间、疲惫、临场请求或「继续手写收益不高」升级到 L3/L4。
- `rules/AGENTS.md#L110-L111`
    110| 黑名单项最高 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。
    111| 截止时间只影响砍范围，不影响援助上限。

claim 3：AI 对黑名单知识点给到 L2 时触发欠债记账，需在 DEBT.md、LEARNING-STATE.md 与当天笔记同步记录。
- `rules/AGENTS.md#L181-L181`
    181| - AI 对黑名单知识点给到 L2；
- `rules/AGENTS.md#L185-L189`
    185| 触发后必须同步：
    186|
    187| 1. 在 [`DEBT.md`](./DEBT.md) 追加：日期、知识点、援助级别、场景、重建安排、状态。
    188| 2. 在 [`LEARNING-STATE.md`](./LEARNING-STATE.md) 的「AI 辅助记录」保留当前欠债结论。
    189| 3. 在当天笔记记录辅助范围、援助级别、本人理解验证和延迟重建日期。

claim 4：黑名单项的援助上限是 L2 定向提示 / 骨架：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。
- `rules/AGENTS.md#L106-L106`
    106| 2. **L2 定向提示 / 骨架**：指出文件、函数、错误位置；给伪代码、步骤、数据流或带空缺结构；不含可直接运行实现。

claim 5：仓库目标是让仓库主人通过 Node.js skillup 真正掌握工程能力，不是把核心学习任务外包给 AI。
- `rules/AGENTS.md#L3-L3`
    3| 本文件是在本仓库协作的 AI agent 行为约束。仓库目标是让仓库主人通过 Node.js skillup **真正掌握工程能力**，不是把核心学习任务外包给 AI。

claim 6：AI 的角色是导师、reviewer 和协作记录员，不是核心代码代写工具。
- `rules/AGENTS.md#L5-L5`
    5| AI 的角色是导师、reviewer 和协作记录员；不是核心代码代写工具。

claim 7：黑名单核心学习代码不直接代写，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。
- `rules/AGENTS.md#L11-L12`
    11| 1. **核心学习代码不直接代写。**
    12|    数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。

**待本人判定（结论由本人填写）**

- [ ] claim 是否被其 citation 指向的原文支持（逐条写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足该 item 的 evidence requirement：
- [ ] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

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
{"branch":"abstained","reason_code":"insufficient_corpus_evidence","reason_text":"证据只给出优先级顺序、遗留项进入条件和状态入口文件职责，未提供 W13 D2 的当前周计划、LEARNING-STATE.md 当前主线与止步条件，无法判定切换到 MCP 是否符合现行范围与优先级。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [ ] claim 是否被其 citation 指向的原文支持（逐条写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足该 item 的 evidence requirement：
- [ ] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）：
- [ ] 本题最终判定：通过 / 不通过 —— 理由：

---

## 8. `w13-dev-priority-conflict-exception-02`（priority_conflict_exception / 预期 `answered`）

**题目事实**

- query：独立功能分支尚未合并 main，但已经构建成功，是否因此可以直接发布到服务器？
- 预期结论（不发送给模型）：不可以据此直接发布。发布分支必须明确，构建成功不等于线上更新，部署还需要独立授权并完成发布前验证。
- 运行状态：`status=ok`（retryable=False）→ `verdict=None`；reasons=[]；pending=['claim_support', 'evidence_coverage']

**证据要求（不发送给模型）**

- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L34-L38`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L34-L38）：该来源范围必须区分构建、部署和合并上线的权限层级，并要求按用户授权范围执行。
- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L60-L61`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L60-L61）：该来源范围必须规定发布分支需要明确，且功能分支构建成功不等于线上已经更新。
- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L64-L90`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L64-L90）：该来源范围必须列出发布前仍需完成的范围确认、检查、构建和验证步骤。

**运行与机械结果**

- `structural_validity`：applies；passed=True；score=None；parsed and validated
- `branch_match`：applies；passed=True；score=None；expected=answered actual=answered
- `claim_count`：applies；passed=True；score=3.0；claims=3 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=4 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"功能分支构建成功不等于线上已经更新。","citations":["rules/SHOWCASE-DEPLOY-PROTOCOL.md#L61-L61"]},{"text":"用户只要求“更新/构建”时，应停在本地验证完成。","citations":["rules/SHOWCASE-DEPLOY-PROTOCOL.md#L105-L105"]},{"text":"发布本身是独立授权动作，未经授权不代替用户合并或推送产物。","citations":["rules/SHOWCASE-DEPLOY-PROTOCOL.md#L94-L94","rules/SHOWCASE-DEPLOY-PROTOCOL.md#L108-L108"]}]}
```

**citations 与冻结原文**

claim 1：功能分支构建成功不等于线上已经更新。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L61-L61`
    61| - 发布分支必须明确；功能分支构建成功不等于线上已经更新。

claim 2：用户只要求“更新/构建”时，应停在本地验证完成。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L105-L105`
    105| - 用户只要求“更新/构建”时：停在本地验证完成。

claim 3：发布本身是独立授权动作，未经授权不代替用户合并或推送产物。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L94-L94`
    94| **服务器 8081（当前目标）**：构建产物落到服务器由本人执行的操作链完成——AI 出命令、本人核输出。属服务器操作，遵守权限速查表（`week9-deployment/notes/server-permission-cheatsheet.md`）：落盘目录属主是 `nodeapp`，一律 `sudo -u nodeapp`；scp 的目标目录必须先建。发布本身仍是独立授权动作。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L108-L108`
    108| - 用户明确要求“上线”时：说清发布目标是 8081 还是 Pages、需要哪些前置条件；未经授权不代替用户合并或推送产物。

**本人判定（2026-09-10，结论由本人给出；AI 只做回填。分层口径同前）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 **支持**（`#L61` 原文含「功能分支构建成功不等于线上已经更新」）；claim 2 **支持**（`#L105` 原文即「用户只要求『更新/构建』时：停在本地验证完成」）；claim 3 **支持**（`#L94` 与 `#L108` 合起来支持「发布是独立授权动作、未经授权不代替用户合并或推送产物」）
- [x] 回答是否满足该 item 的 evidence requirement：requirement 1 **不满足**（claim 3 内容接近，但 citation `#L94`/`#L108` 均在 `L34-L38` 外）；requirement 2 **不满足**（`#L61` 覆盖「构建成功不等于线上更新」，但「发布分支必须明确」与 L60 的授权要求无 claim 覆盖）；requirement 3 **不满足**（三条 claims 的 citation 全在 `L64-L90` 外）
- [x] 本题最终判定：**不通过** —— 理由：claims 在内容层基本成立，但 requirement 层按 R1 不满足（1 无 span 内引用、2 覆盖不完整、3 完全无覆盖）。附带观察：`§2.3` 语义覆盖亦不完整（未出现「发布分支必须明确」与「完成发布前验证」）

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
{"branch": "abstained", "reason_code": "insufficient_corpus_evidence", "reason_text": "证据中只有每日技术英语口语稿规范（DAILY-SPEAKING-PROTOCOL.md），没有关于法语口语稿的词数或输出格式的规定。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**本人判定（2026-09-10，结论由本人给出；AI 只做回填）**

- [x] claim 是否被其 citation 指向的原文支持：**不适用**（abstained 响应按契约 §3，不返回 claims 与 citation）
- [x] 回答是否满足该 item 的 evidence requirement：**满足**——`reason_code = insufficient_corpus_evidence` 与 `abstained` 一致；`reason_text` 说明证据中只有每日技术英语口语稿规范、没有法语口语稿的词数或输出格式规定，与 `corpus_absence` 一致。事实核对：冻结语料 7 个文档中「法语」出现 0 次
- [x] 本题最终判定：**通过**

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
{"branch":"abstained","reason_code":"insufficient_corpus_evidence","reason_text":"提供的证据未包含 rules-c0a4b85 或关于使用 subagent 参与视觉标准独立 review 的任何规定。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**本人判定（2026-09-10，结论由本人给出；AI 只做回填）**

- [x] claim 是否被其 citation 指向的原文支持：**不适用**（abstained 响应按契约 §3，不返回 claims 与 citation）
- [x] 回答是否满足该 item 的 evidence requirement：**满足**——`reason_code` 与 `abstained` 一致；`reason_text` 核心含义是未包含关于 subagent 参与视觉标准独立 review 的任何规定，与 `corpus_absence` 一致。事实核对：冻结语料中「subagent」出现 0 次。**观察（不判失败）**：前半句「未包含 rules-c0a4b85」存在措辞歧义，可读作「未包含来自该语料的相关规定」
- [x] 本题最终判定：**通过**

---

## 11. split 级收口（本人填）

| # | item | 判定结论 | 备注 |
|---|---|---|---|
| 1 | `w13-dev-direct-answer-01` | **不通过** | claim 1 部分支持；requirement 按 R1 未满足（引用越界、上限 L2 无 span 内引用） |
| 2 | `w13-dev-direct-answer-02` | **通过** | 6 条 claims 支持；requirement 按 R1 满足 |
| 3 | `w13-dev-cross-document-01` | **通过** | 4 条 claims 支持；两条 requirement 按 R1 满足 |
| 4 | `w13-dev-cross-document-02` | **不通过** | claim 7 不支持；两条 requirement 按 R1 未满足 |
| 5 | `w13-dev-paraphrase-01` | **不通过** | requirement 2 后半（L110 黑名单最高 L2）无 span 内引用 |
| 6 | `w13-dev-paraphrase-02` | **不通过** | 机械失败：citation `AGENTS.md#L185-L189` 跨块合并、不可解析（precision 0.875）；按契约 §2 第 5 条失败，未作语义判定 |
| 7 | `w13-dev-priority-conflict-exception-01` | **不通过** | 机械失败：预期 `answered` 却 `abstained`（branch_match）；按契约 §2 第 1 条失败，未作语义判定 |
| 8 | `w13-dev-priority-conflict-exception-02` | **不通过** | 3 条 requirement 按 R1 均不满足（无 span 内引用 / 覆盖不完整） |
| 9 | `w13-dev-no-answer-01` | **通过** | abstained 正确；reason text 与 corpus_absence 一致 |
| 10 | `w13-dev-no-answer-02` | **通过** | abstained 正确；reason text 一致（前半句措辞歧义记为观察） |

- [x] 已填写判定结论的条数：**10/10**（其中 8 条经人工语义判定，2 条按契约由机械条件判失败）
- [x] 语义 evaluator 是否仍有 pending：**无**（判定已完成；机械失败的两条按契约不进入语义判定）
- [ ] 结论句（只写本次证据能支持的范围）：

