# W13 dev 人工语义 checklist 工作表（阶段 5）

> 建立：2026-09-10（D4）。用途：把阶段 4 dev baseline 的逐题素材整理成可勾选的语义检查表。
> **边界**：判定由本人填写；AI 只整理素材，不代填「通过 / 不通过」，也不代填失败归因的最终结论。
>
> 题目与预期结论来源：`eval/dev/items.json`（sha256 `87e9eed3b5b48508`）…
> 实测来源：`evidence/baseline/dev-full-context-prompt-v1-01.json`（Prompt `w13-rag-prompt-v1`，模型请求值 `deepseek-v4-flash`，服务端 `deepseek-flash`）
>
> 素材生成方式（可重跑）：本节由一次性脚本从上面两份 JSON 生成，未手工改写模型响应；原文以证据文件为准。

## 0. 判定线（本工作表要回答什么）

机械层已经判定并落盘的内容（无需重判）：响应是否可解析、是否符合 `rag-response-v1`、分支是否匹配、
citation 是否能解析到 citation registry、citation precision 是否 1.0、是否出现 missing citation 或
「预期拒答却作答」。

**只有本人能判定**的三件事：

1. claim 是否被它引用的原文支持（citation 可解析 ≠ 原文支持）；
2. 回答是否满足该题的 evidence requirement；
3. 机械失败项属于**语义失败**还是仅**格式/解析噪声**，以及失败阶段归类是否需要修正。

split 级通过标准（`w13-eval-v1`，已冻结）：机械+语义合计 dev ≥9/10 且每类行为 ≥1/2；
citation precision = 1.0；missing citation 使该题失败；**预期 abstained 却返回 answered 直接否决 split**（本次未触发）。

---

## 1. `w13-dev-direct-answer-01`（direct_answer / 预期 `answered`）

**题目事实**

- query：JWT 签发与验证流程的最高援助级别是什么？
- 预期结论（评测者冻结，不发送给模型）：JWT 签发与验证流程的最高援助级别是 L2。

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L66-L72`（`documents/AGENTS.md` L66-L72）：该来源范围必须同时表明黑名单的援助上限是 L2，并将 JWT 签发与验证流程列入黑名单。

**机械层实测**：status=`ok`；分支=`answered`（预期 `answered`）；claim=2；citation=2 条、可解析 2 条；precision=1.0；机械失败项=无；延迟=5441 ms

**模型实际响应**

```json
{
 "branch": "answered",
 "claims": [
  {
   "text": "JWT 签发与验证流程属于黑名单项，任何情况下不给完整实现，援助上限 L2。",
   "citations": [
    "rules/AGENTS.md#L71-L76"
   ]
  },
  {
   "text": "黑名单项最高 L2，不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。",
   "citations": [
    "rules/AGENTS.md#L110-L111"
   ]
  }
 ]
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`机械通过`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 2. `w13-dev-direct-answer-02`（direct_answer / 预期 `answered`）

**题目事实**

- query：技术文案是否可以用自创概念或助记词替代官方术语，作为后续讨论中的唯一指称？
- 预期结论（评测者冻结，不发送给模型）：不可以。讲解与文案应直接使用官方术语；类比或助记只能与官方术语并列并明确标注，不能取代官方术语。

**证据要求（不发送给模型）**

- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L118-L120`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L118-L120）：该来源范围必须直接规定官方术语与类比或助记的并列关系，以及不得以自创指称替代官方术语。

**机械层实测**：status=`ok`；分支=`answered`（预期 `answered`）；claim=7；citation=11 条、可解析 11 条；precision=1.0；机械失败项=无；延迟=4541 ms

**模型实际响应**

```json
{
 "branch": "answered",
 "claims": [
  {
   "text": "讲解与文案一律直接使用官方术语。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118",
    "rules/AGENTS.md#L163-L163"
   ]
  },
  {
   "text": "若需要用其它概念帮助理解，该概念必须与官方术语并列出现，并显式标注为类比或助记。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118",
    "rules/AGENTS.md#L163-L163"
   ]
  },
  {
   "text": "该概念不得在后续讨论中取代术语作为唯一指称，删除类比后官方术语必须仍能单独承载完整语义。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118",
    "rules/AGENTS.md#L163-L163"
   ]
  },
  {
   "text": "对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120",
    "rules/AGENTS.md#L163-L163"
   ]
  },
  {
   "text": "正确形态是首次提及即术语与类比并列，后续只用官方术语指称。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120"
   ]
  },
  {
   "text": "隐喻导致读者需要反向推断技术对象，属于阻断性问题。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L221-L221"
   ]
  },
  {
   "text": "文本不得因固定高度被裁切；图、标签或 hover 状态不能造成页面级横向滚动。",
   "citations": [
    "rules/SHOWCASE-VISUAL-PROTOCOL.md#L160-L160"
   ]
  }
 ]
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`机械通过`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 3. `w13-dev-cross-document-01`（cross_document / 预期 `answered`）

**题目事实**

- query：AI 在知识讲解中使用了自创助记词，却未明确标注其为类比或助记，这违反了哪两份规则文档的共同约束？
- 预期结论（评测者冻结，不发送给模型）：违反 AGENTS.md 与 TECHNICAL-WRITING-PROTOCOL.md 的共同约束。两者都要求直接使用官方术语；类比或助记必须与官方术语并列并明确标注。

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L161-L163`（`documents/AGENTS.md` L161-L163）：该来源范围必须规定讲解中的官方术语、类比或助记标注要求，并明确未标注的自创助记词属于违规。
- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L116-L120`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L116-L120）：该来源范围必须独立规定官方术语与类比或助记的并列、标注和后续指称边界。

**机械层实测**：status=`schema_error`；分支=`None`（预期 `answered`）；claim=0；citation=0 条、可解析 0 条；precision=None；机械失败项=['schema_error']；延迟=3792 ms

- 机械细节：`'abstained' was expected`

**模型实际响应**

```json
{
 "branch": "answered",
 "claims": [
  {
   "text": "技术文案规范在「术语与类比分层」中要求：讲解与文案一律直接使用官方术语；若需用其它概念帮助理解，该概念必须与官方术语并列出现、显式标注为类比或助记。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L118-L118"
   ]
  },
  {
   "text": "技术文案规范明确该条款同时约束讲解过程与落盘文案，对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。",
   "citations": [
    "rules/TECHNICAL-WRITING-PROTOCOL.md#L120-L120"
   ]
  },
  {
   "text": "AGENTS.md 的「术语与类比分层」条款持有同样要求：讲解与文案一律直接使用官方术语；需用其它概念帮助理解时，必须与官方术语并列出现、显式标注为类比或助记；对话讲解中先出现自创助记词、回填时才补官方术语，属于违规。",
   "citations": [
    "rules/AGENTS.md#L163-L163"
   ]
  }
 ],
 "reason_code": null,
 "reason_text": null
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`['schema_error']`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 4. `w13-dev-cross-document-02`（cross_document / 预期 `answered`）

**题目事实**

- query：学习展板的用户可见文案与视觉设计分别受哪两份根级规范约束，两份规范各自负责什么？
- 预期结论（评测者冻结，不发送给模型）：TECHNICAL-WRITING-PROTOCOL.md 约束事实强度和句子表达；SHOWCASE-VISUAL-PROTOCOL.md 约束视觉编码、信息层级和视觉验收证据。

**证据要求（不发送给模型）**

- `rules-c0a4b85/TECHNICAL-WRITING-PROTOCOL.md#L1-L5`（`documents/TECHNICAL-WRITING-PROTOCOL.md` L1-L5）：该来源范围必须表明技术学习文案规范适用于学习展板的用户可见文案，并说明其事实与表达职责。
- `rules-c0a4b85/SHOWCASE-VISUAL-PROTOCOL.md#L1-L10`（`documents/SHOWCASE-VISUAL-PROTOCOL.md` L1-L10）：该来源范围必须说明学习展板视觉规范负责视觉形态与验收，并区分技术文案规范继续负责事实强度和句子表达。

**机械层实测**：status=`json_error`；分支=`None`（预期 `answered`）；claim=0；citation=0 条、可解析 0 条；precision=None；机械失败项=['json_error']；延迟=5220 ms

- 机械细节：`Expecting value at pos 0`

**模型实际响应**

```text
```json
{
  "branch": "answered",
  "claims": [
    {
      "text": "学习展板的用户可见文案受根级规范 TECHNICAL-WRITING-PROTOCOL.md 约束。",
      "citations": [
        "rules/LEARNING-PROTOCOL.md#L14-L14",
        "rules/TECHNICAL-WRITING-PROTOCOL.md#L3-L3"
      ]
    },
    {
      "text": "学习展板的视觉设计受根级规范 SHOWCASE-VISUAL-PROTOCOL.md 约束。",
      "citations": [
        "rules/LEARNING-PROTOCOL.md#L15-L15",
        "rules/SHOWCASE-VISUAL-PROTOCOL.md#L3-L3"
      ]
    },
    {
      "text": "TECHNICAL-WRITING-PROTOCOL.md 约束仓库中的用户可见技术文案，包括每日学习笔记、周计划与复盘、学习展板、runbook 摘要和验收说明。",
      "citations": [
        "rules/TECHNICAL-WRITING-PROTOCOL.md#L3-L3"
      ]
    },
    {
      "text": "TECHNICAL-WRITING-PROTOCOL.md 约束句子怎么写。",
      "citations": [
        "rules/TECHNICAL-WRITING-PROTOCOL.md#L182-L183"
      ]
    },
    {
      "text": "SHOWCASE-VISUAL-PROTOCOL.md 负责视觉编码、信息层级、图标/动效边界与人工验收证据。",
      "citations": [
        "rules/AGENTS.md#L171-L173"
      ]
    },
    {
      "text": "SHOWCASE-VISUAL-PROTOCOL.md 约束结论由什么承载、首屏如何组织以及用什么证据验收。",
      "citations": [
        "rules/TECHNICAL-WRITING-PROTOCOL.md#L182-L183"
      ]
    },
    {
      "text": "TECHNICAL-WRITING-PROTOCOL.md 继续约束事实强度和句子表达，SHOWCASE-VISUAL-PROTOCOL.md 继续约束构建与发布。",
      "citations": [
        "rules/SHOWCASE-VISUAL-PROTOCOL.md#L9-L11"
      ]
    },
    {
      "text": "两份规范同时成立：视觉规范约束结论由什么承载、首屏如何组织以及用什么证据验收，文案规范约束句子怎么写。",
      "citations": [
        "rules/TECHNICAL-WRITING-PROTOCOL.md#L182-L183"
      ]
    }
  ]
}
```
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`['json_error']`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 5. `w13-dev-paraphrase-01`（paraphrase / 预期 `answered`）

**题目事实**

- query：我不清楚 Express 接口中接收请求、处理业务规则和访问数据库的代码应该如何分工，AI 可以直接替我完成实现吗？
- 预期结论（评测者冻结，不发送给模型）：不可以直接实现。这属于 W2 API 分层黑名单；应先进行 L1 原理与职责边界讲解，声明卡住后最高只能升到 L2。

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L66-L70`（`documents/AGENTS.md` L66-L70）：该来源范围必须将 route、controller、service 和 repository 的职责列为 W2 API 分层黑名单内容。
- `rules-c0a4b85/AGENTS.md#L101-L110`（`documents/AGENTS.md` L101-L110）：该来源范围必须定义 L1 的讲解边界，并规定黑名单最高援助等级为 L2。

**机械层实测**：status=`ok`；分支=`answered`（预期 `answered`）；claim=9；citation=12 条、可解析 12 条；precision=1.0；机械失败项=无；延迟=10613 ms

**模型实际响应**

```json
{
 "branch": "answered",
 "claims": [
  {
   "text": "Express 接口中 route / controller / service / repository 职责属于黑名单 W2「API 分层」，任何情况下不给完整实现，AI 援助上限为 L2。",
   "citations": [
    "rules/AGENTS.md#L69-L69",
    "rules/AGENTS.md#L68-L68"
   ]
  },
  {
   "text": "黑名单项即使仓库主人临场说「这次直接给吧」，AI 也不得放行。",
   "citations": [
    "rules/AGENTS.md#L30-L31"
   ]
  },
  {
   "text": "黑名单项最高 L2；不得因截止时间、疲惫、临场请求或「继续手写收益不高」升级到 L3/L4。",
   "citations": [
    "rules/AGENTS.md#L110-L111"
   ]
  },
  {
   "text": "AI 的角色是导师、reviewer 和协作记录员，不是核心代码代写工具；核心学习代码不直接代写。",
   "citations": [
    "rules/AGENTS.md#L5-L5",
    "rules/AGENTS.md#L11-L12"
   ]
  },
  {
   "text": "L2 定向提示 / 骨架的形式是指出文件、函数、错误位置，给伪代码、步骤、数据流或带空缺结构，不含可直接运行实现。",
   "citations": [
    "rules/AGENTS.md#L106-L106"
   ]
  },
  {
   "text": "卡住时先解释为什么、职责边界、输入输出和验证方式，不要急着给可粘贴实现。",
   "citations": [
    "rules/AGENTS.md#L14-L15"
   ]
  },
  {
   "text": "AI 可以指出 bug、风险、边界场景和更好的思路，但黑名单核心代码的具体修改由仓库主人自己做。",
   "citations": [
    "rules/AGENTS.md#L17-L18"
   ]
  },
  {
   "text": "AI 对黑名单知识点给到 L2 会触发欠债记账，需在 DEBT.md 追加日期、知识点、援助级别、场景、重建安排与状态。",
   "citations": [
    "rules/AGENTS.md#L181-L181",
    "rules/AGENTS.md#L187-L187"
   ]
  },
  {
   "text": "掌握标准不是跑通，而是脱离 AI 和文档，从原理推导并重建关键链路。",
   "citations": [
    "rules/AGENTS.md#L20-L21"
   ]
  }
 ]
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`机械通过`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 6. `w13-dev-paraphrase-02`（paraphrase / 预期 `answered`）

**题目事实**

- query：我想弄明白 Node.js 中定时器、I/O 回调和 Promise 为什么按特定顺序执行，AI 可以直接替我写完整演示代码吗？
- 预期结论（评测者冻结，不发送给模型）：不可以。这属于 W5 Node.js 底层黑名单；应先进行 L1 原理讲解，最高援助等级为 L2。

**证据要求（不发送给模型）**

- `rules-c0a4b85/AGENTS.md#L66-L78`（`documents/AGENTS.md` L66-L78）：该来源范围必须将事件循环等 Node.js 底层机制及其理解型 demo 列为 W5 黑名单内容。
- `rules-c0a4b85/AGENTS.md#L101-L110`（`documents/AGENTS.md` L101-L110）：该来源范围必须定义 L1 原理讲解，并规定黑名单最高援助等级为 L2。

**机械层实测**：status=`ok`；分支=`answered`（预期 `answered`）；claim=6；citation=7 条、可解析 7 条；precision=1.0；机械失败项=无；延迟=7852 ms

**模型实际响应**

```json
{
 "branch": "answered",
 "claims": [
  {
   "text": "事件循环、libuv、流与背压、worker threads 等体现底层理解的 demo 属于黑名单 W5，任何情况下不给完整实现，援助上限 L2。",
   "citations": [
    "rules/AGENTS.md#L77-L77"
   ]
  },
  {
   "text": "黑名单项即使仓库主人临场说“这次直接给吧”，AI 也不得放行。",
   "citations": [
    "rules/AGENTS.md#L30-L31"
   ]
  },
  {
   "text": "黑名单项最高 L2；不得因截止时间、疲惫、临场请求或“继续手写收益不高”升级到 L3/L4。",
   "citations": [
    "rules/AGENTS.md#L110-L111"
   ]
  },
  {
   "text": "L2 定向提示 / 骨架指指出文件、函数、错误位置，给伪代码、步骤、数据流或带空缺结构，不含可直接运行实现。",
   "citations": [
    "rules/AGENTS.md#L106-L106"
   ]
  },
  {
   "text": "AI 对黑名单知识点给到 L2 时触发欠债记账，需在 DEBT.md 追加条目等信息。",
   "citations": [
    "rules/AGENTS.md#L181-L181",
    "rules/AGENTS.md#L187-L187"
   ]
  },
  {
   "text": "AI 对黑名单知识点给出 L2 援助时需同步更新 LEARNING-STATE.md。",
   "citations": [
    "rules/LEARNING-PROTOCOL.md#L143-L143"
   ]
  }
 ]
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`机械通过`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 7. `w13-dev-priority-conflict-exception-01`（priority_conflict_exception / 预期 `answered`）

**题目事实**

- query：当前处于 W13 D2，我想立即把主线切换为 MCP 学习，是否符合现行范围与优先级？
- 预期结论（评测者冻结，不发送给模型）：不符合。W13 对应 RAG，MCP 对应 W15；本周核心能力闭环优先。除非正式修改计划，否则不能直接切换主线。

**证据要求（不发送给模型）**

- `rules-c0a4b85/DAILY-LEARNING-REPORT-PROTOCOL.md#L117-L135`（`documents/DAILY-LEARNING-REPORT-PROTOCOL.md` L117-L135）：该来源范围必须分别把 RAG 与 MCP 归入 W13 和 W15。
- `rules-c0a4b85/LEARNING-PROTOCOL.md#L188-L200`（`documents/LEARNING-PROTOCOL.md` L188-L200）：该来源范围必须规定本周核心能力闭环优先，并限制主线完成前启动低优先级事项。

**机械层实测**：status=`ok`；分支=`abstained`（预期 `answered`）；claim=0；citation=0 条、可解析 0 条；precision=None；机械失败项=['branch_mismatch']；延迟=8769 ms

**模型实际响应**

```json
{
 "branch": "abstained",
 "reason_code": "insufficient_corpus_evidence",
 "reason_text": "现有证据未提供 W13 D2 的当前主线内容或 MCP 所属周次安排，无法判断该切换是否符合当前范围与优先级。"
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`['branch_mismatch']`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 8. `w13-dev-priority-conflict-exception-02`（priority_conflict_exception / 预期 `answered`）

**题目事实**

- query：独立功能分支尚未合并 main，但已经构建成功，是否因此可以直接发布到服务器？
- 预期结论（评测者冻结，不发送给模型）：不可以据此直接发布。发布分支必须明确，构建成功不等于线上更新，部署还需要独立授权并完成发布前验证。

**证据要求（不发送给模型）**

- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L34-L38`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L34-L38）：该来源范围必须区分构建、部署和合并上线的权限层级，并要求按用户授权范围执行。
- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L60-L61`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L60-L61）：该来源范围必须规定发布分支需要明确，且功能分支构建成功不等于线上已经更新。
- `rules-c0a4b85/SHOWCASE-DEPLOY-PROTOCOL.md#L64-L90`（`documents/SHOWCASE-DEPLOY-PROTOCOL.md` L64-L90）：该来源范围必须列出发布前仍需完成的范围确认、检查、构建和验证步骤。

**机械层实测**：status=`ok`；分支=`answered`（预期 `answered`）；claim=7；citation=7 条、可解析 7 条；precision=1.0；机械失败项=无；延迟=11651 ms

**模型实际响应**

```json
{
 "branch": "answered",
 "claims": [
  {
   "text": "功能分支构建成功不等于线上已经更新，发布分支必须明确。",
   "citations": [
    "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L61-L61"
   ]
  },
  {
   "text": "若任一步失败，不得把「源码已修改」「本地构建成功」或「功能分支已推送」表述为「部署完成」。",
   "citations": [
    "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L143-L143"
   ]
  },
  {
   "text": "内容未变且构建产物结构未变时才可省略重复视觉检查，这属于构建验证范围，不构成发布授权。",
   "citations": [
    "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L90-L90"
   ]
  },
  {
   "text": "「更新」「构建」「部署」「提交」「推送」「开 PR」和「合并上线」是不同权限层级，没有得到明确授权时只执行请求范围内的步骤。",
   "citations": [
    "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L38-L38"
   ]
  },
  {
   "text": "远程触发发布取发布内容固定取 origin/main，trigger.json 的 targetRef 按 schema 恒为 main，不是可配置项。",
   "citations": [
    "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L120-L120"
   ]
  },
  {
   "text": "服务器 8081 构建产物落盘由本人执行的操作链完成——AI 出命令、本人核输出，且发布本身仍是独立授权动作。",
   "citations": [
    "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L94-L94"
   ]
  },
  {
   "text": "交付时需报告当前线上是否已经更新；若没有，明确还差哪一步，8081 是产物落盘 + reload。",
   "citations": [
    "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L140-L140"
   ]
  }
 ]
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`机械通过`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 9. `w13-dev-no-answer-01`（no_answer / 预期 `abstained`）

**题目事实**

- query：依据 rules-c0a4b85，法语口语稿应采用多少词、什么输出格式？
- 预期结论（评测者冻结，不发送给模型）：冻结语料只定义每日技术英语口语稿，没有规定法语口语稿的长度和格式，因此无法确定。

**证据要求（不发送给模型）**

- `rules-c0a4b85/DAILY-SPEAKING-PROTOCOL.md#L1-L3`（`documents/DAILY-SPEAKING-PROTOCOL.md` L1-L3）：该来源范围必须表明现有规范的对象是每日技术英语口语稿。
- `corpus_absence`（scope=entire_corpus）：整个冻结 corpus 不得包含法语口语稿的词数或输出格式规则。

**机械层实测**：status=`ok`；分支=`abstained`（预期 `abstained`）；claim=0；citation=0 条、可解析 0 条；precision=None；机械失败项=无；延迟=6804 ms

**模型实际响应**

```json
{
 "branch": "abstained",
 "reason_code": "insufficient_corpus_evidence",
 "reason_text": "证据中只有技术英语口语稿规范，没有关于法语口语稿的词数或输出格式。"
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`机械通过`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 10. `w13-dev-no-answer-02`（no_answer / 预期 `abstained`）

**题目事实**

- query：依据 rules-c0a4b85，是否允许使用 subagent 参与学习展板视觉标准的独立 review？
- 预期结论（评测者冻结，不发送给模型）：冻结语料没有规定 subagent 是否可以参与该 review，因此无法确定。

**证据要求（不发送给模型）**

- `corpus_absence`（scope=entire_corpus）：整个冻结 corpus 不得包含 subagent 参与学习展板视觉标准 review 的允许或禁止规则。

**机械层实测**：status=`ok`；分支=`abstained`（预期 `abstained`）；claim=0；citation=0 条、可解析 0 条；precision=None；机械失败项=无；延迟=6280 ms

**模型实际响应**

```json
{
 "branch": "abstained",
 "reason_code": "insufficient_corpus_evidence",
 "reason_text": "提供的证据未包含 rules-c0a4b85 或关于使用 subagent 参与学习展板视觉 review 的任何规定。"
}
```

**待本人判定**

- [ ] 逐条 claim 是否被其 citation 指向的原文支持（写 支持 / 部分 / 不支持，并注明哪条）：
- [ ] 回答是否满足本题的 evidence requirement：
- [ ] 若机械层报了失败：属语义失败还是仅格式/解析噪声：
- [ ] 失败阶段归类是否需要修正（当前：`机械通过`）：
- [ ] **本题最终判定：通过 / 不通过** —— 理由：

---

## 11. split 级收口（本人填）

| # | item | 人工判定（通过/不通过） | 失败阶段（如有） |
|---|---|---|
| 1 | `w13-dev-direct-answer-01` | | |
| 2 | `w13-dev-direct-answer-02` | | |
| 3 | `w13-dev-cross-document-01` | | |
| 4 | `w13-dev-cross-document-02` | | |
| 5 | `w13-dev-paraphrase-01` | | |
| 6 | `w13-dev-paraphrase-02` | | |
| 7 | `w13-dev-priority-conflict-exception-01` | | |
| 8 | `w13-dev-priority-conflict-exception-02` | | |
| 9 | `w13-dev-no-answer-01` | | |
| 10 | `w13-dev-no-answer-02` | | |

- [ ] 合计通过数：＿＿/10（标准 ≥9）
- [ ] 每类行为至少 1/2 通过（cross_document 机械 0/2，需人工确认其中是否有语义可通过的题）
- [ ] citation precision 是否仍为 1.0；missing citation 是否为 0
- [ ] 预期 abstained 的题是否都未返回 answered（零容忍条件）
- [ ] 结论句（只能写证据支持的范围）：

## 12. 两个待决硬化项（本人决定）

- [ ] 是否新建 Prompt `v2`，把「answered 分支不得出现 `reason_code` / `reason_text`（即使为 null）」写成显式反例句（对应本题集 item 3 的失败类型）；
- [ ] 是否引入请求级 JSON 输出约束（官方 JSON Output 能力，对应 item 4 的代码围栏失败）；若引入，需按 `config/model-policy-v1.md` 同级登记为冻结配置字段。

