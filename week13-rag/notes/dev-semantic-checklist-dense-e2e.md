# W13 dev 人工语义判定素材（脚本生成）

> 生成脚本：`scripts/build-semantic-worksheet.py`（可重跑；证据或语料变化后重新生成）。
> **本文件是生成物：重新运行脚本会覆盖已填写的人工判定。**回填判定后需重新生成时，请用 `--out` 写到新文件。
> split：`dev`；证据来源：`evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json`
> evidenceId：`dev-dense-langchain-e2e-top10`；Prompt：`w13-rag-prompt-v1`；语料：`rules-c0a4b85`；生成：`2026-09-11T11:12:01+08:00`
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
- `claim_count`：applies；passed=True；score=2.0；claims=2 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=2 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"JWT 签发与验证流程属于黑名单项 W4 认证鉴权，任何情况下不给完整实现，援助上限为 L2。","citations":["rules/AGENTS.md#L71-L76"]},{"text":"黑名单项最高援助级别为 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。","citations":["rules/AGENTS.md#L110-L111"]}]}
```

**citations 与冻结原文**

claim 1：JWT 签发与验证流程属于黑名单项 W4 认证鉴权，任何情况下不给完整实现，援助上限为 L2。
- `rules/AGENTS.md#L71-L76`
    71| - **W4 认证鉴权**：
    72|   - JWT 签发与验证流程
    73|   - 密码哈希与存储策略
    74|   - OAuth2 授权码交换、state 校验、回调处理
    75|   - RBAC 角色 / 权限模型、401/403 判断、授权所在层设计
    76|   - Web 安全防护逻辑

claim 2：黑名单项最高援助级别为 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。
- `rules/AGENTS.md#L110-L111`
    110| 黑名单项最高 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。
    111| 截止时间只影响砍范围，不影响援助上限。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：本次不逐条判 claim 支持——失败已由 §2.7 的 requirement 覆盖条件确定；claim 与 citation 只作归因材料。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。requirement `AGENTS.md#L66-L72` 无 span 内 citation（c1 引用 `L71-L76` 越界，c2 引用 `L110-L111` 在外）→ 按 R1 ② 未覆盖 → §2.7 不满足。
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
- `citation_resolvable`：applies；passed=True；score=None；resolved=9 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch": "answered", "claims": [{"text": "讲解与文案一律直接使用官方术语。", "citations": ["rules/AGENTS.md#L163-L163", "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]}, {"text": "若需用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记。", "citations": ["rules/AGENTS.md#L163-L163", "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]}, {"text": "类比或助记不得在后续讨论中取代术语作为唯一指称。", "citations": ["rules/AGENTS.md#L163-L163", "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]}, {"text": "删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象。", "citations": ["rules/AGENTS.md#L163-L163", "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"]}, {"text": "对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。", "citations": ["rules/AGENTS.md#L163-L163"]}]}
```

**citations 与冻结原文**

claim 1：讲解与文案一律直接使用官方术语。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 2：若需用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 3：类比或助记不得在后续讨论中取代术语作为唯一指称。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 4：删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。
- `rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118`
    118| 讲解与文案一律直接使用官方术语。若需要用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**——删除类比后，官方术语必须仍能单独承载完整语义，读者不需要靠类比反向推断技术对象（与 §7 判定一致）。已有经确认的术语对照（如 W9 词表「术语 + 白话」双列）时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。

claim 5：对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。
- `rules/AGENTS.md#L163-L163`
    163| 讲解与文案一律直接使用官方术语。若需用其它概念帮助理解，该概念必须与官方术语**并列出现**、显式标注为类比或助记，且**不得在后续讨论中取代术语作为唯一指称**（删除类比后官方术语必须仍能单独承载完整语义）。已有经确认的术语对照时优先复用，不新造白话；确需新类比时在首次出现处同时给出官方术语并注明这是类比。**对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。** 详见 [`TECHNICAL-WRITING-PROTOCOL.md`](./TECHNICAL-WRITING-PROTOCOL.md) §3.6。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：claim 1 支持；claim 2 支持；claim 3 支持；claim 4 支持；claim 5 支持。
- [x] 回答是否满足该 item 的 evidence requirement：满足。通过由 claim 1–4 的 `TECH#L118` 支撑；claim 5 的 `AGENTS#L163` 在 requirement `TECH#L118-L120` 之外，不参与覆盖。
- [x] 本题最终判定：**通过** —— 理由：branch 正确、claims 覆盖预期结论；requirement 由 span 内 claim 1–4 覆盖。

---

## 3. `w13-dev-cross-document-01`（cross_document / 预期 `answered`）

**题目事实**

- query：AI 在知识讲解中使用了自创助记词，却未明确标注其为类比或助记，这违反了哪两份规则文档的共同约束？
- 预期结论（不发送给模型）：违反 AGENTS.md 与 TECHNICAL-WRITING-PROTOCOL.md 的共同约束。两者都要求直接使用官方术语；类比或助记必须与官方术语并列并明确标注。
- 运行状态：`status=schema_error`（retryable=True）→ `verdict=fail`；reasons=['structural_validity']；pending=[]

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L161-L163`（`documents/AGENTS.md` L161-L163）：该来源范围必须规定讲解中的官方术语、类比或助记标注要求，并明确未标注的自创助记词属于违规。
- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L116-L120`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L116-L120）：该来源范围必须独立规定官方术语与类比或助记的并列、标注和后续指称边界。

**运行与机械结果**

- `structural_validity`：applies；passed=False；score=None；schema_error
- `branch_match`：skip(schema_error)；passed=None；score=None；no parsable branch (contract §2.1)
- `claim_count`：skip(schema_error)；passed=None；score=None；not answered
- `citation_present`：skip(schema_error)；passed=None；score=None；not answered
- `citation_resolvable`：skip(schema_error)；passed=None；score=None；no citation returned
- `citation_precision`：skip(schema_error)；passed=None；score=None；0/0 is not 0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"type": "json_object", "branch": "abstained", "reason_code": "insufficient_corpus_evidence", "reason_text": "现有证据未同时明确约束自创助记词需标注类比或助记，也未指向两份规则文档的共同规定。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：不适用（响应无法解析，无 claims 可判）。
- [x] 回答是否满足该 item 的 evidence requirement：不适用（结构失败，按契约 §2 判定）。
- [x] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）：`structural_validity`：响应未通过解析与校验。
- [x] 本题最终判定：**不通过** —— 理由：机械 `structural_validity` 已失败（`schema_error`）。

---

## 4. `w13-dev-cross-document-02`（cross_document / 预期 `answered`）

**题目事实**

- query：学习展板的用户可见文案与视觉设计分别受哪两份根级规范约束，两份规范各自负责什么？
- 预期结论（不发送给模型）：TECHNICAL-WRITING-PROTOCOL.md 约束事实强度和句子表达；SHOWCASE-VISUAL-PROTOCOL.md 约束视觉编码、信息层级和视觉验收证据。
- 运行状态：`status=ok`（retryable=False）→ `verdict=fail`；reasons=['branch_match']；pending=['reason_text_consistency']

**证据要求（不发送给模型）**

- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L1-L5`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L1-L5）：该来源范围必须表明技术学习文案规范适用于学习展板的用户可见文案，并说明其事实与表达职责。
- `rules-c0a4b85/SHOWCASE-VISUAL-PROTOCOL.md#L1-L10`（`documents/SHOWCASE-VISUAL-PROTOCOL.md` L1-L10）：该来源范围必须说明学习展板视觉规范负责视觉形态与验收，并区分技术文案规范继续负责事实强度和句子表达。

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
{"branch":"abstained","reason_code":"insufficient_corpus_evidence","reason_text":"证据仅涉及学习展板视觉设计与验收规范，未提供用户可见文案的对应规范及其职责划分。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：归因材料，不逐条判（abstained 响应，无 claims）。
- [x] 回答是否满足该 item 的 evidence requirement：不适用（abstained 响应，按契约 §3 判定）。
- [x] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）：`branch_match`；claim 与 citation 只作归因材料。
- [x] 本题最终判定：**不通过** —— 理由：机械 `branch_match` 已失败（预期 `answered` 却 `abstained`）。

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
- `claim_count`：applies；passed=True；score=4.0；claims=4 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=4 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"核心学习代码中的 API 分层及数据建模等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。","citations":["rules/AGENTS.md#L11-L12"]},{"text":"AI 可以直接实现的内容仅限于白名单，例如 ESLint / Prettier / VS Code 等开发工具配置。","citations":["rules/AGENTS.md#L44-L44"]},{"text":"CI 配置文件属于 AI 可直接实现的白名单范围。","citations":["rules/AGENTS.md#L43-L43"]},{"text":"L3 局部实现仅对白名单开放，AI 修改最小必要代码并解释关键决策。","citations":["rules/AGENTS.md#L107-L107"]}]}
```

**citations 与冻结原文**

claim 1：核心学习代码中的 API 分层及数据建模等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。
- `rules/AGENTS.md#L11-L12`
    11| 1. **核心学习代码不直接代写。**
    12|    数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。

claim 2：AI 可以直接实现的内容仅限于白名单，例如 ESLint / Prettier / VS Code 等开发工具配置。
- `rules/AGENTS.md#L44-L44`
    44| - ESLint / Prettier / VS Code 等开发工具配置

claim 3：CI 配置文件属于 AI 可直接实现的白名单范围。
- `rules/AGENTS.md#L43-L43`
    43| - CI 配置文件

claim 4：L3 局部实现仅对白名单开放，AI 修改最小必要代码并解释关键决策。
- `rules/AGENTS.md#L107-L107`
    107| 3. **L3 局部实现**：仅对白名单开放，AI 修改最小必要代码并解释关键决策。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：本次不逐条判 claim 支持——失败已由 §2.7 的 requirement 覆盖条件确定；claim 与 citation 只作归因材料。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。requirement `AGENTS.md#L66-L70` 无 span 内 citation；另一项 `#L101-L110` 有 span 内引用（c4 的 `L107`）。→ 按 R1 ② 未覆盖 → §2.7 不满足。
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
- `claim_count`：applies；passed=True；score=2.0；claims=2 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=2 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"AI 不能直接代写核心学习代码；Node.js 底层 demo 属于核心学习代码范围。","citations":["rules/AGENTS.md#L11-L12"]},{"text":"对于 Node.js 底层 demo 等核心学习代码，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。","citations":["rules/AGENTS.md#L11-L12"]}]}
```

**citations 与冻结原文**

claim 1：AI 不能直接代写核心学习代码；Node.js 底层 demo 属于核心学习代码范围。
- `rules/AGENTS.md#L11-L12`
    11| 1. **核心学习代码不直接代写。**
    12|    数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。

claim 2：对于 Node.js 底层 demo 等核心学习代码，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。
- `rules/AGENTS.md#L11-L12`
    11| 1. **核心学习代码不直接代写。**
    12|    数据建模、API 分层、鉴权流程、聚合管道、索引优化推理、Node.js 底层 demo、测试场景与核心断言等，AI 只讲原理、拆问题、给方向或伪代码骨架，由仓库主人自己实现。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：本次不逐条判 claim 支持——失败已由 §2.7 的 requirement 覆盖条件确定；claim 与 citation 只作归因材料。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。两个 requirement `AGENTS.md#L66-L78` 与 `#L101-L110` 均无 span 内 citation（c1/c2 引用 `L11-L12`）。→ 按 R1 ② 未覆盖 → §2.7 不满足。
- [x] 本题最终判定：**不通过** —— 理由：依据 R1 ②，requirement 无 span 内 citation。

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
{"branch":"abstained","reason_code":"insufficient_corpus_evidence","reason_text":"现有证据未提供 W13 D2 的当前主线、当天止步条件或切换主线规则，无法判定立即切换为 MCP 学习是否符合范围与优先级。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：归因材料，不逐条判（abstained 响应，无 claims）。
- [x] 回答是否满足该 item 的 evidence requirement：不适用（abstained 响应，按契约 §3 判定）。
- [x] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）：`branch_match`；claim 与 citation 只作归因材料。
- [x] 本题最终判定：**不通过** —— 理由：机械 `branch_match` 已失败（预期 `answered` 却 `abstained`）。

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
- `claim_count`：applies；passed=True；score=4.0；claims=4 (contract §2.2, §3.2)
- `citation_present`：applies；passed=True；score=None；every claim has ≥1 citation
- `citation_resolvable`：applies；passed=True；score=None；resolved=4 unresolved=[]
- `citation_precision`：applies；passed=True；score=1.0；precision=1.0
- `abstained_but_answered`：applies；passed=True；score=None；not triggered

**模型实际响应**

```json
{"branch":"answered","claims":[{"text":"是否 commit、push、开 PR 或 merge 必须遵循用户当次授权，不直接推送或合并 main。","citations":["rules/SHOWCASE-DEPLOY-PROTOCOL.md#L60-L60"]},{"text":"发布分支必须明确，功能分支构建成功不等于线上已经更新。","citations":["rules/SHOWCASE-DEPLOY-PROTOCOL.md#L61-L61"]},{"text":"远程触发发布的发布内容固定取 origin/main。","citations":["rules/SHOWCASE-DEPLOY-PROTOCOL.md#L120-L120"]},{"text":"若任一步失败，不把“源码已修改”“本地构建成功”或“功能分支已推送”表述为“部署完成”。","citations":["rules/SHOWCASE-DEPLOY-PROTOCOL.md#L143-L143"]}]}
```

**citations 与冻结原文**

claim 1：是否 commit、push、开 PR 或 merge 必须遵循用户当次授权，不直接推送或合并 main。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L60-L60`
    60| - 不直接推送或合并 `main`；是否 commit、push、开 PR 或 merge 必须遵循用户当次授权。

claim 2：发布分支必须明确，功能分支构建成功不等于线上已经更新。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L61-L61`
    61| - 发布分支必须明确；功能分支构建成功不等于线上已经更新。

claim 3：远程触发发布的发布内容固定取 origin/main。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L120-L120`
    120| - 发布内容固定取 `origin/main`。`trigger.json` 的 `targetRef` 按 schema 恒为 `main`，不是可配置项。

claim 4：若任一步失败，不把“源码已修改”“本地构建成功”或“功能分支已推送”表述为“部署完成”。
- `rules/SHOWCASE-DEPLOY-PROTOCOL.md#L143-L143`
    143| 若任一步失败，不把“源码已修改”“本地构建成功”或“功能分支已推送”表述为“部署完成”。

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：本次不逐条判 claim 支持——失败已由 §2.7 的 requirement 覆盖条件确定；claim 与 citation 只作归因材料。
- [x] 回答是否满足该 item 的 evidence requirement：不满足。requirement `SHOWCASE-DEPLOY-PROTOCOL.md#L34-L38` 与 `#L64-L90` 无 span 内 citation；另一项 `#L60-L61` 有 span 内引用（c1/c2）。→ 按 R1 ② 未覆盖 → §2.7 不满足。
- [x] 本题最终判定：**不通过** —— 理由：依据 R1 ②，requirement 无 span 内 citation。

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
{"branch": "abstained", "reason_code": "insufficient_corpus_evidence", "reason_text": "现有证据仅涉及每日技术英语口语稿规范，未提供法语口语稿或 rules-c0a4b85 的相关信息。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：不适用（abstained 响应按契约 §3，不返回 claims 与 citation）。
- [x] 回答是否满足该 item 的 evidence requirement：满足——`reason_code` 为 `insufficient_corpus_evidence`；`reason_text` 说明现有证据仅涉及每日技术英语口语稿、未提供法语口语稿相关规则，与冻结 `corpus_absence` 一致。措辞“未提供法语口语稿或 rules-c0a4b85 的相关信息”按 D4 同型表述记为观察（不判失败）。
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
{"branch":"abstained","reason_code":"insufficient_corpus_evidence","reason_text":"提供的证据未包含关于是否允许使用 subagent 参与学习展板视觉标准独立 review 的明确信息。"}
```

**citations 与冻结原文**

（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）

**待本人判定（结论由本人填写）**

- [x] claim 是否被其 citation 指向的原文支持：不适用（abstained 响应按契约 §3，不返回 claims 与 citation）。
- [x] 回答是否满足该 item 的 evidence requirement：满足——`reason_code` 为 `insufficient_corpus_evidence`；`reason_text` 说明证据未包含 subagent 参与该 review 的明确信息，与冻结 `corpus_absence` 一致。
- [x] 本题最终判定：**通过**。

---

## 11. split 级收口（本人填）

| # | item | 判定结论 | 备注 |
|---|---|---|---|
| 1 | `w13-dev-direct-answer-01` | **不通过** | 依据 R1 ②：requirement `AGENTS.md#L66-L72` 无 span 内 citation（c1 引用 `L71-L76` 越界，c2 引用 `L110-L111` 在外）。 |
| 2 | `w13-dev-direct-answer-02` | **通过** | 通过由 claim 1–4 的 `TECH#L118` 支撑；claim 5 的 `AGENTS#L163` 在 requirement 外，不参与覆盖。 |
| 3 | `w13-dev-cross-document-01` | **不通过** | 机械 `structural_validity`（schema_error）已失败。 |
| 4 | `w13-dev-cross-document-02` | **不通过** | 机械 `branch_match` 已失败。 |
| 5 | `w13-dev-paraphrase-01` | **不通过** | 依据 R1 ②：requirement `AGENTS.md#L66-L70` 无 span 内 citation；另一项 `#L101-L110` 有 span 内引用（c4 的 `L107`）。 |
| 6 | `w13-dev-paraphrase-02` | **不通过** | 依据 R1 ②：两个 requirement `AGENTS.md#L66-L78` 与 `#L101-L110` 均无 span 内 citation（c1/c2 引用 `L11-L12`）。 |
| 7 | `w13-dev-priority-conflict-exception-01` | **不通过** | 机械 `branch_match` 已失败。 |
| 8 | `w13-dev-priority-conflict-exception-02` | **不通过** | 依据 R1 ②：requirement `SHOWCASE-DEPLOY-PROTOCOL.md#L34-L38` 与 `#L64-L90` 无 span 内 citation；另一项 `#L60-L61` 有 span 内引用（c1/c2）。 |
| 9 | `w13-dev-no-answer-01` | **通过** | reason text 一致；“未提供法语口语稿或 rules-c0a4b85 相关信息”按观察处理，不判失败。 |
| 10 | `w13-dev-no-answer-02` | **通过** | reason text 一致。 |

- [x] 已填写判定结论的条数：**10/10**（依据分别为：语义内容覆盖 3 题、R1 ② 包含性 4 题、机械条件 3 题）
- [x] 语义 evaluator 是否仍有 pending：本次运行证据中的语义槽位保持 `None`（历史不回调）；本工作表给出逐题结论与理由。
- [x] 结论句（只写本次证据能支持的范围）：

> 在 R1 口径下，dense 指定语义判定通过 3/10；§6.4 `item_pass_rate` 与 §6.5 per-class 门禁不满足，因此该次运行不能通过。本轮为本人授权的链路演示例外（retrieval-only 门禁未通过），结论只描述该次运行，不作质量验收；dense 接入框架后检索对照仍是原来的九配置结论。运行证据 JSON 不回调，其 `verdict` 保持运行当时状态（`0 passed / 3 failed / 7 pending`）；3/10 出自本工作表。

**门禁五条（本次判定后的状态）**

- §6.1 运行有效：**满足**。hash 与冻结一致；10/10 item ID 各有可归属结果；未读 holdout；context 重算 10/10 与记录一致；R1 冻结于 2026-09-10，早于本次运行。
- §6.2 没有预期 `abstained` 的 item 返回 `answered`：**满足**（`zero_tolerance` 为空）。
- §6.3 `citation_precision = 1.0`：**满足**。
- §6.4 `item_pass_rate >= 0.9`：**不满足**（3/10）。
- §6.5 五类 behavior type 分别至少 1/2 通过：**不满足**（`cross_document`、`paraphrase`、`priority_conflict_exception` 均 0/2）。

**观察（不宣布隔离）**：本文件 4 题 R1 ② 失败的共同形态是“引用了相关但不同的行”——`AGENTS.md#L71-L76` 对 `#L66-L72`（direct-answer-01）、`AGENTS.md#L11-L12` 对 `#L66-L70`（paraphrase-01）、`AGENTS.md#L11-L12` 对 `#L66-L78` 与 `#L101-L110`（paraphrase-02）、`SHOWCASE-DEPLOY-PROTOCOL.md#L60-L61` 命中而 `#L34-L38` / `#L64-L90` 未命中（priority-conflict-exception-02）。BM25 轮存在同型实例（见该工作表）；连同 D4 的 full-context 记录，属同一类“span 与 block / 引用粒度不对齐”的第三次同型观察，仍不是单因素实验，不能宣布已隔离。
