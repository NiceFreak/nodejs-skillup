# W13 D5 实际事实与 D6 对接记录

> 核对日期：2026-09-12（Asia/Shanghai）。依据：Git 历史、当前源码、测试输出、D5 运行证据和学习笔记。
> 本记录不读取、不输出、不修改 `eval/holdout/` 或 `evidence/holdout/`，也不把文档或页面生成写成质量验收。

## 1. D5 实际完成

| 对象 | 实际变更 | 证据 | 结论边界 |
|---|---|---|---|
| LangChain dense 接线 | 新增 `E5Embeddings`、缓存 identity 检查、`InMemoryVectorStore` 装载、`source_id` 唯一性检查；项目层保留排序和 `RetrievalHit` 映射 | `src/w13rag/retrieval_dense_langchain.py`；commit `647ffdf` | 接线行为已验证；未实现 ChatModel/LCEL |
| 等价性 | 旧 NumPy dense 路径与 LangChain 路径在 10 条 dev query 上 top-10 集合和顺序一致；最大分数差 `7.31e-08` | `scripts/verify-dense-langchain-equiv.py`；`notes/day5-dense-langchain-wiring.md` | 仅支持固定缓存、固定 registry 和 dev query 的等价性 |
| 并列规则 | 全排序严格一致判据因浮点表达式不同不可达，修订为相邻分数差大于 `1e-6` 时顺序一致 | D5 笔记 §5；F10 输出 | 不能推出任意向量库或任意浮点实现都保持该规则 |
| dense 端到端 | 10 条真实调用：9 `ok`、1 `schema_error`；机械检查 7/10；人工语义判定 3/10 | `evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json`；D5 判定工作表 | 这是可复核链路证据，质量门禁未通过；跨运行稳定性未验证 |
| 失败诊断 | 发现 fixture identity 注入缺失、浮点近似并列、题目 source span 与 block 边界不相容等现象 | D5 笔记 §5、§11–§12；`day5-progress-audit.md` §6.57 | fixture 修复已验证；题意/检索/生成根因仍分层保留 |
| 保护边界 | 独立候选治理停止在 candidates-05 的 BM25 source recallability 缺口；不创建 candidates-06、不运行 holdout | `day5-progress-audit.md` §6.57；HEAD `b5fe6e2` | 独立 benchmark 未建立；历史结果保持只读 |

## 2. D5 未完成或不能推出的事项

- BM25 与 dense 的端到端人工语义判定各为 3/10，不能写成回答质量通过。
- `status=ok`、citation identifier 可解析和 top-10 等价性分别只覆盖结构、身份和检索排序，不能推出 claim support 或 evidence coverage。
- `build_retrieval_context()` 当前按命中结果拼接完整 blocks；D3 设计过预算裁剪，但本轮输入未触发，裁剪分支没有得到运行验证。
- 生成仍调用 W12 `DeepSeekClient`；没有 LangChain `ChatModel`、LCEL、LangGraph state/node/edge runtime、agent loop 或生产向量数据库。
- 首次独立 holdout 的 `benchmarkPass` 与 candidates-05 的 gate 结论保持历史语义；本轮不读取受保护题面及衍生证据，也不据此调参。

## 3. D5 → D6 对照表

| D6 模块 | D5 输入 | 当前可复用对象 | 已有证据 | 还缺什么 | 需要本人动作 |
|---|---|---|---|---|---|
| M0 状态复核 | 当前状态、脚本、证据和展示入口 | `demo-replay.py`、`verify`、D5 证据 | 81 tests、dense equivalence、展示检查记录 | 本人实际打开页面并确认阅读顺序 | 复述当前质量边界 |
| M1 固定 LangChain chain | query、registry、Document、retriever、context、现有模型客户端 | BM25 链和 dense 接线可串入同一固定数据流 | BM25/dense e2e 记录；context hash 可重算 | ChatModel/LCEL 仍未接入 | 说明一条成功和一条失败路径 |
| M2 接口 review | `Document.metadata`、缓存 identity、排序规则 | `to_documents()`、`E5Embeddings`、`build_dense_store()` | F1–F12、81 passed | 框架默认排序、键覆盖风险需继续解释 | 指出框架与项目契约的边界 |
| M3 dev 失败归因 | 9 个 retrieval 配置、20 条端到端判定 | retrieval/context/generation 分层工作表 | D5 §11–§12 | 单一根因尚未隔离 | 选一个假设及可证伪判据 |
| M4 单变量实验 | 已冻结 v1 与 dev-only 候选 | 仅保留实验入口，不自动执行 | 候选 source recallability gate | 没有新变量的 owner 确认 | 确认变量、判据和停止条件 |
| M5 LangGraph 设计 | 固定 chain 的输入输出与失败状态 | 可画 `retrieve → generate → verify/abstain` | 本记录和框架专题 | runtime、重试、checkpoint、权限未实现 | 确认 state 字段与终止语义 |
| M6 生产约束 | source ID/hash、超时、usage、日志、权限 | 当前 `RunRecord`、缓存 identity、版本 manifest | generation、dense、benchmark 记录 | 更新失效、成本账单、生产索引未验证 | 选择一个约束做故障问题设计 |
| M7 汇报复核 | D5 讲稿、已有 6 专题 | 新主 tab 与独立复习 tabs | 本轮新增视觉契约和页面检查 | 本人计时演练和人工视觉验收 | 记录时长、卡点和回答边界 |

## 4. 根因假设与验证状态

| 现象 | 根因假设 | 当前验证 |
|---|---|---|
| F10 全排序差异 | float32/float64 计算路径对近似相等分数的表达不同 | 已验证差值和排序位置；未验证其它实现 |
| dense 一条 `schema_error` | 运行间波动或输入差异 | 只有一次运行，待复跑或日志对照 |
| `paraphrase-01` 多配置未召回 | query 与目标 block 的词面信号弱；dense 具体原因未隔离 | retrieval-only 观察已记录，单变量实验未执行 |
| citation 相关但不支持 claim | requirement span、context membership 和 claim support 处于不同层级 | 预筛和人工判定能复现现象；规则/题意修订仍需本人确认 |
| candidates-05 未能 freeze | BM25 top-10 未召回一个 criterion source | 已由 source recallability gate 阻断；不改题、不重跑 |

## 5. D6 收口结论

当前最小可复用对象是“固定 registry → LangChain Document/retriever 或 dense vector store → 项目层排序 → Evidence Context → 现有生成客户端 → parser/scoring”的确定性接口。它适合 M1/M2 的数据流复述和 M5 的状态设计；它不能证明 RAG 质量、生产可用性、LangGraph runtime 或本人掌握。

下一入口按 `day6-modular-rag-plan.md`：先运行 M0 的离线复核，再由本人选择一个 M1/M2/M3 设计点；M4 只有在单一变量和判据确认后才能执行。
