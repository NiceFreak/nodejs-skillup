# 当前学习状态

> 最后更新：2026-09-11（Asia/Shanghai）。当前入口：**W13 D5：demo 演练（本人执行）**。
> D5 已完成 LangChain dense 接线、dense 端到端链路运行，以及 BM25/dense 端到端的人工语义判定（各 3/10，按 R1 口径仍不通过）；
> **完整 W13 质量验收仍未通过**。
> 仍在本人手上的：demo 演练与分享记录（主讲 ≤15 分钟、追问另计时）、完整掌握验收；两次端到端运行都只作链路证据。
> 材料、接线与状态更新都不代表演练或掌握已发生。

## 当前周与目标

- W13（9/7–9/11）：RAG Foundations + LangChain。D5 日历沿用周计划的 9/11；证据基准为 D4（9/10）。
- 本日主线：[D5 日计划](week13-rag/notes/day5-demo-and-wrapup.md) → [主讲稿](week13-rag/notes/day5-demo-script.md) → [追问准备](week13-rag/notes/day5-demo-qa.md)。
- 当前可展示：冻结语料到 source blocks、BM25 检索、context assembly、记录中的带引用回答与拒答、同集检索对照。
  展板入口已拆分为 `Python / Bub 基础` 与 `RAG 实践`；`AI 工程总览`保留为旧深链兼容入口。
- 当前框架实践：LangChain `Document`、`BM25Retriever.from_documents()`（排序调用底层 `get_scores()` 并按冻结规则处理并列）；
  D5 新增 dense 的 `Embeddings` adapter 与 `InMemoryVectorStore`（向量来自冻结 `.npy` 缓存，排序仍由项目显式完成）。
  dense 的旧 ONNX/NumPy 路径保留作等价性参照；ChatModel/LCEL 与 LangGraph 尚未实现。
- W12 → W13 RAG → W14 LangGraph → W15 MCP → W16 reliability/evals 的主线不变。D5 分享准备不自动启动 W14。

## 最近完成与证据

| 对象 | 已核实结果 | 证据与边界 |
|---|---|---|
| corpus / serialization | 7 份文档，76,243 bytes；raw corpus-only 18,697 estimated tokens；572 blocks；Evidence Context 89,854 字符，SHA `8a02c665…` | [manifest](week13-rag/corpus/rules-c0a4b85/manifest.json)、[serialization](week13-rag/evidence/serialization/criteria-report-rules-c0a4b85.md)；A1–A8 已由本人签认 |
| 完整输入容量与 payload | Prompt v1 最大离线渲染输入 44,701 tokens，可完整容纳；请求模式、输出上限、JSON 输出字段已验证 | [计量证据](week13-rag/evidence/input-budget/assembled-input-rules-c0a4b85-w13-rag-prompt-v1.json)、[generation](week13-rag/src/w13rag/generation.py)；estimate 不等于 provider usage |
| full-context dev | v1 + JSON 输出：机械 8/10；本人按 R1 记录的诊断结果 4/10 | [原始运行](week13-rag/evidence/baseline/dev-full-context-prompt-v1-json-output-01.json)、[D4 §6.14](week13-rag/notes/day4-full-context-baseline-and-bm25.md)；R1 于运行后澄清，旧 JSON 未回写人工结果 |
| retrieval-only | k=10/20/30：BM25 5/6/7，dense 3/4/5，hybrid 4/5/7，分母均为 8 | 3 种后端 × 3 个 k = 9 个有效配置；另保留 1 份缺陷版本。均未通过 B4.1；不与端到端 /10 相比 |
| BM25 端到端 | 10/10 `status=ok`，机械 8/10，语义 8 条 pending；context 1,332–2,020 字符 | [运行证据](week13-rag/evidence/bm25-e2e/dev-bm25-e2e-top10-01.json)；D4 本人授权的链路演示例外，不改变质量门禁 |
| 输入规模 | 同配置 full-context `prompt_tokens` 合计 447,159；BM25 合计 12,723，减少 97.15% | 两次各 10 题运行；缓存/输出不同，不等于账单或延迟降幅，更不证明质量提升 |
| 首次 holdout | D4 已运行，记录汇总为机械 8/10、`max_achievable=0.8<0.9`，未通过 | [D4 §6.20](week13-rag/notes/day4-full-context-baseline-and-bm25.md#620-首次-holdout-运行2026-09-10实现冻结声明后)；本次审核未读取受保护题面、响应或判定素材，只核对现有汇总 |
| LangChain dense 接线（D5） | adapter + `InMemoryVectorStore` 与既有 `dense_retrieve` 在 10 条 dev 上 **top-10 顺序与集合一致**，分数差 ≤ 7.31e-08；F12 冻结对象未变；测试 81 passed（新增 10） | [冻结记录](week13-rag/notes/dense-langchain-wiring-freeze.md)、[等价性脚本](week13-rag/scripts/verify-dense-langchain-equiv.py)；F10 判据修正为「分数差 >1e-6 的相邻对顺序必须一致」 |
| dense 端到端（D5） | 10 条真实调用：9 `ok` + 1 `schema_error`；机械 7/10；context 1,195–1,654 字符；`prompt_tokens` 合计 11,756；`citation_precision_min` 1.0；`split_status` fail | [运行证据](week13-rag/evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json)；BM25 e2e 为 10 `ok`、机械 8/10、12,723 tokens；两者都只是链路证据 |
| BM25/dense 人工语义判定（D5） | 按 R1 口径各通过 **3/10**（结论由本人给出，AI 只回填）；失败分别来自语义内容覆盖、R1 ② 包含性与机械分支/结构条件 | [BM25 判定素材](week13-rag/notes/dev-semantic-checklist-bm25-e2e.md)、[dense 判定素材](week13-rag/notes/dev-semantic-checklist-dense-e2e.md)、[机械预筛](week13-rag/notes/dev-prescreen-bm25-e2e.md)；§6.4 与 §6.5 不满足，两轮仍只作链路证据；展板 `rag-eval` 页已呈现三条端到端的机械与本人诊断（allowlist 19 项） |
| D5 本地复核 | 71 tests passed；fresh/on-disk/frozen SHA 三一致；dev 契约 10/10；dev 判定入口检查通过；BM25 检索顺序与 context 重算 10/10 一致 | [离线展示入口](week13-rag/scripts/demo-replay.py)；无真实 API 调用；71 是本次复跑数，D4 的 70 保留历史时点；接线后新增 10 项，现为 81 passed |
| D5 展示准备 | 六个 RAG 专题、全链路代码导读、14 分钟主稿与 41 题追问已形成；48 种浏览器状态及界面离线重算通过；路线图首屏已补判据距离（命中 7/8 题 · 要求全中；机械检查 8/10 题 · 人工判定 3–4/10，数字由数据算出）；展板文案已中性化，去掉 D4/D5/R1/W12/W13 等过程代号与内部缩写 | [视觉验收记录](week13-rag/notes/week13-visualization-plan.md) §4.7–§4.8；只在本地，未部署；材料与 AI 检查不代表本人演练或掌握 |

D4 完整执行、历史变更和诊断见 [每日笔记](week13-rag/notes/day4-full-context-baseline-and-bm25.md)；
本次记录纠错见 [D5 审核记录](week13-rag/notes/day5-progress-audit.md)。W12 最近记录为 35 passed、98.00% 覆盖率，本次未重跑 W12。

## 已冻结决定

- corpus：`rules-c0a4b85`，source commit + `repository-content-v1` normalization；当前协作规范的后续修正不回填快照。
- eval：[scoring-contract](week13-rag/eval/scoring-contract.md)、[R1 口径](week13-rag/eval/scoring-rulings-r1.md)。本人拥有题意、阈值与语义判定；本次不改写。
- Prompt：默认 `w13-rag-prompt-v1`；v2 实验未达成消除跨块 citation 的目标，保留历史证据。
- source/citation/serialization：[D3 单一规范](week13-rag/notes/day3-freeze-serialization-contract.md)、[A1–A8 签认](week13-rag/notes/serialization-implementation-review-worksheet.md)。
- BM25 B1–B4：[冻结设计](week13-rag/notes/bm25-design-freeze.md)；dense D1–D4 / hybrid H1：[冻结设计](week13-rag/notes/dense-design-freeze.md)。
- dense 的 LangChain 接线 D-A…D-E：[冻结记录](week13-rag/notes/dense-langchain-wiring-freeze.md)；F10 判据为「分数差 >1e-6 的相邻对顺序必须一致」，dense e2e 属本人授权的链路演示例外。
- generation：[model-policy v1](week13-rag/config/model-policy-v1.md)；保留请求别名，结论绑定记录中的实际服务身份；不重试。
- holdout 首次结果不用于选方案或调参；后续仅在预先冻结的 regression 节点复跑。普通 agent 不读取受保护内容及其衍生素材。

## 当前阻塞与风险

- **W13 完整验收未通过**：full-context 诊断不达标；三种 retrieval 配置系列都未过 B4.1；BM25 与 dense 的端到端都只是链路证据。
  LangChain dense 接线与 dense 端到端已于 D5 完成；**本人完整掌握验收仍未完成**。
- full-context v1 + JSON 的人工判定已在 D4 记录；不能再次写为“全部待判”。BM25/dense 端到端的人工语义判定已在 D5 完成（各 3/10）；holdout 的人工语义仍待本人处理。
- 机械 `citation_precision` 实际计算 identifier 可解析比例；不能代替契约要求的 context membership 与语义支持。
  `status=ok` 只表示响应通过当前解析与 schema，不代表任务正确。
- Context assembly 当前拼接检索命中的片段，尚未实现 B3 所述超预算裁剪；当前输入未触发预算压力。
  [全链路代码导读](week13-rag/notes/rag-implementation-guide.md)保留该限制及各模块的实际职责。
- 同一题在 9 个已测检索配置均漏检，是观察结果；dense 的具体原因仍待验证，不把它统一定性为词汇鸿沟。
- 本地 dense 产物来自社区镜像，未与官方 hash 交叉验证；当前证据未保留完整逐块截断统计。固定输入缓存不具备语料更新失效保障。
- 该版 holdout 题面在保护规则加入前曾由 AI 接触：可作冻结回归集，不作对 agent 盲测的证明。
  [既有事件记录](incidents/2026-09-10-holdout-content-visibility.md)保留边界；未来盲测需先定义访问规则，再建立独立版本。
- 本地测试出现 `langchain-community` 弃用提示；本次没有升级依赖，不据此改变已冻结对照。

## 下一步

1. 按 D5 计划执行演练：从整体路线图打开六页 RAG 展示与主讲稿，在证据页完成一次离线重算（终端 `demo-replay.py verify` 为备用），随后不中断计时演练；再完成一轮脱稿与一轮追问。BM25/dense 人工语义判定已完成，追问按 Q37–Q43 回答即可。
2. 材料事实同步已完成（2026-09-11）：主讲稿、追问附录、代码导读的 dense 接线与人工判定表述已更新；展板 `rag-eval`/`rag-evidence`/框架页文字已同步，并把三条端到端的机械与本人诊断写进数据（allowlist 16 → 19 项），验证链已重跑通过。
   同日后补（其一）：主讲稿 §0:00 补判据与判定权、§7:30 失败计数改为与 D4 §6.19 一致的 5 条、§13:00 的过期待办改为实际结果；追问稿表头与 `demo-replay.py` 摘要中「BM25 人工语义待判」已订正；路线图首屏增加判据距离与门禁说明。见 [visualization plan §4.7](week13-rag/notes/week13-visualization-plan.md)。
   同日后补（其二）：展板文案中性化与可读化——去掉 D4/D5/R1/W12/W13 等过程代号与 `registry`/`requirement span`/`identity 门控` 等内部缩写，判据行补单位与动词，检索对照页说明改为日期与「经本人批准、只验证链路能跑通」；未改判据、阈值、状态词强度与数据。见 [visualization plan §4.8](week13-rag/notes/week13-visualization-plan.md)。
   同日后补（其三）：文档入口——重写 [`src/w13rag/README.md`](week13-rag/src/w13rag/README.md) 为全包导读（11 个功能模块、依赖方向、两条数据流、检索/生成/评估细节与边界），新增 [`scripts/README.md`](week13-rag/scripts/README.md)（15 个入口的用途、输入输出、解释器要求与安全边界），并同步 `rag-implementation-guide.md` 的入口引用与 dense 端到端事实。
3. 分享只使用已核实证据；结束时补实际问题、答不清的位置与剩余能力边界，不把分享通过写为 W13 质量通过。
4. 收尾至多一项：执行 `DEBT.md` 2026-09-10 的第一档重建，或补 holdout 的人工语义（受保护素材，由本人处理）。W14 由本人明确启动。

## 验证入口

从仓库根执行：

```bash
python3 -B week13-rag/scripts/demo-replay.py summary
week13-rag/.venv/bin/python -B week13-rag/scripts/demo-replay.py verify
week13-rag/.venv/bin/python -B week13-rag/scripts/verify-dense-langchain-equiv.py
week13-rag/.venv/bin/python -B week13-rag/scripts/prescreen-r1-coverage.py --evidence week13-rag/evidence/bm25-e2e/dev-bm25-e2e-top10-01.json --out week13-rag/notes/dev-prescreen-bm25-e2e.md
node week13-rag/eval/scripts/verify-contract.mjs
node week13-rag/eval/scripts/verify-decision-entry.mjs --file week13-rag/notes/dev-semantic-checklist-worksheet.md
```

测试与冻结 SHA 比对命令见 D5 日计划；展示回放不读取受保护输入、不发出模型请求、不覆盖历史 evidence。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [周计划](week13-rag/notes/week13-plan.md)、[D5 日计划](week13-rag/notes/day5-demo-and-wrapup.md)。
3. [主讲稿](week13-rag/notes/day5-demo-script.md)、[追问准备](week13-rag/notes/day5-demo-qa.md)、[本轮审核](week13-rag/notes/day5-progress-audit.md)。
4. [dense LangChain 接线冻结记录](week13-rag/notes/dense-langchain-wiring-freeze.md)、[D5 接线笔记](week13-rag/notes/day5-dense-langchain-wiring.md)；人工判定素材见 `week13-rag/notes/dev-prescreen-{bm25,dense}-e2e.md` 与 `week13-rag/notes/dev-semantic-checklist-{bm25,dense}-e2e.md`。
5. 需要追溯时再读 D4 对应章节、冻结契约和直接相关代码；不要扫描受保护素材。

## AI 辅助记录与延迟重建

- 2026-09-11 D5 本轮为实现方交付：本人冻结 D-A…D-E（接线范围、前缀归属、缓存失败语义、存储键、断言落点、运行口径），AI 讲术语与候选、实现并自测；
  不新增 eval/Prompt/工具权限语义，不代填本人掌握、演练与人工评分。
- 2026-09-11 D5 BM25/dense 端到端语义判定：**结论由本人给出，AI 只做回填与状态同步**（与 D4 同）；AI 另做程序职责范围内的机械预筛（citation 可解析性、与本次 context 的成员关系、R1 ② 的包含性），并复核两轮的运行有效性（hash、item 覆盖、holdout 边界、context 重算）。
- 当前活动债务：[DEBT.md](DEBT.md) 中 2026-09-10 的 eval 合取判定与失败定位，仍为未还。
  保留原安排：W13 收口前或 W14 D1 第一档重建；本次讲稿和材料完成不抵扣债务。
- retrieval 确定性数据流重建沿用 W15 或更早首个 15–20 分钟单元；本人负责复述、变更影响预测和故障诊断。
  AI 不在重建过程中提示，也不提前填写验收结果。
