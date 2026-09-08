# W13 D2（9/8）：冻结 eval 契约

> 建立：2026-09-08（Asia/Shanghai）。
>
> 状态：已完成。`w13-eval-v1` 的题意、判分契约、dev/holdout 物理隔离、共享 schema 与 hash 已冻结；
> 默认验证入口只读取 dev，未运行模型或 holdout。
>
> 本文件是 D2 阶段工作表与执行记录，不要求用一个自然日强行完成。D1 未完成项不再整体打包进 D2；D2
> 只处理 eval 契约。后续是否进入 RAG Prompt 与全语料上下文基线，由本文件的退出门禁决定。
>
> 协作模式：导师模式。题目语义、指标、阈值、通过标准和核心断言由本人冻结；AI 负责术语讲解、事实核对、
> 冻结来源定位，以及 schema 排版、稳定 ID、JSON 和 hash 等机械工作。

## 1. 当前事实

- 规则文档语料 snapshot `rules-c0a4b85` 已冻结，7 个文件共 76,149 bytes。
- raw corpus-only 结果为 18,680 estimated tokens；完整 serialized input 与 provider usage 尚未产生。
- evaluation item 的最小结构、五类行为、dev/holdout 物理隔离与 20 题规模已冻结为 `w13-eval-v1`。
- answered/abstained 单题条件、人工语义 checklist、metrics、thresholds 与整套 passing criteria 已由本人冻结。
- RAG Prompt、response schema、serialization、最终 context budget 和全语料上下文 baseline 不属于 D2
  完成对象。

## 2. 唯一完成对象

**完成对象**：一个版本明确、dev/holdout 物理隔离且可以被确定性读取的 eval 契约。

完成条件：

1. 20 条题目均包含准确 query、预期分支、预期规则结论和 evidence requirements。
2. dev 与 holdout 各 10 条，覆盖相同五类行为，但 query 非等价。
3. metrics、thresholds、item-level passing criteria 与整套 eval 的 passing criteria 已由本人冻结。
4. 每个判据都说明从模型输出、registry 或冻结 source span 中观察什么，不使用主观表述。
5. dev/holdout 使用不同文件或目录并共享同一 schema；所有常规开发入口只能读取 dev。
6. eval 版本、稳定 ID、source span identifier 和 hash 可复核；holdout 未运行、未查看结果。

任一项缺失，D2 阶段按未完成记录；下一学习日继续本对象，不并行启动 Prompt 或 baseline。

## 3. 开工门禁

- [x] 已按 `LEARNING-PROTOCOL.md` 恢复状态，并读取本文件、D1 收口、周计划与 `git status --short`；
  开工时工作树干净，当前 HEAD 为 `29c22fc`。
- [x] 正式题目只引用 `rules-c0a4b85`；manifest 仍绑定 source commit `c0a4b85c9065cbfb943584c914172d7819339791`，
  现行协作规范只约束协作，不回填 snapshot。
- [x] 开工时尚未创建 eval runner 或 holdout 文件；D2 不运行模型，后续机械落盘仍须验证常规入口只读取 dev。
- [x] 本阶段只冻结 eval，不追加 RAG Prompt、容量、BM25、dense 或展示工作。

## 4. 执行顺序

### 4.1 冻结剩余题意

- [x] “直接可回答”类的 `dev-1`、`dev-2`、`holdout-1`、`holdout-2` 已由本人确认题意；AI 已完成
  source span 定位与当前机械结构。
- [x] “跨文档”类的 dev 2 题与 holdout 2 题已由本人确认题意；AI 已核对每题包含至少两个冻结文档的
  evidence requirements，并完成当前机械结构。
- [x] “近似表述”“优先级/冲突/例外”和“无答案”三类共 12 题已一次提交、一次 review 并由本人确认；
  `no_answer` 的最后一题按本人确认的 fallback 改为冻结 corpus 未记录的服务器操作系统版本问题。
- [x] 本人对每题提供准确 query、预期分支和一条预期规则结论；结论存疑时显式标注，由 AI 依据 snapshot
  核对，不据此替本人另选题目。
- [x] 每题只处理一个设计点；需要多个规则才能成立的结论已明确 evidence requirements，没有把多个独立问题
  塞进一题。
- [x] 每批确认后立即固定语义；AI 已批量定位 source spans 并处理当前机械结构，未要求本人逐字段录入。

### 4.2 冻结判分契约

- [x] 本人已冻结五类题目的通用与题目级 item passing criteria；当前 evidence requirements 全部必需，
  真正等价的来源才允许显式替代，`w13-eval-v1` 没有替代组。
- [x] 本人已冻结全局 metrics、thresholds 与整套 eval 的 passing criteria：每个 split 独立要求至少 9/10，
  每类至少 1/2，citation precision 为 `1.0`；两个 split 不跨集平均。
- [x] answered 与 abstained 分支的可观察行为已冻结：answered 为 1 至 10 条 atomic claims 且每条关联
  citation；abstained 不返回 claims 或 citation，只使用 `insufficient_corpus_evidence` 与一致的简短文本。
- [x] 预期 abstained 的题目被强行回答会直接否决该 split；`corpus_absence` 是评测者预先冻结的判分依据。
- [x] 机械检查与人工语义 checklist 的职责已分开；全语料上下文 baseline 没有 retrieval，不预建 retrieval
  miss 结论。

### 4.3 机械落盘与隔离验证

- [x] AI 已根据本人确认的语义生成共享 schema、dev/holdout 文件、稳定 ID、source span identifiers、
  判分契约与 manifest hash。
- [x] dev/holdout 数量、行为类型覆盖、ID/query 唯一性、结构、source span 和 hash 验证已通过。
- [x] 默认验证入口只读取 dev；只有显式 `--all` 才执行 D2 双 split 静态契约检查。本阶段未运行模型，
  未产生或查看 holdout 输出。
- [x] eval version `w13-eval-v1` 与验证命令已保存，D3 可以直接读取冻结 dev set。

## 5. 响应式执行规则

1. 每条 evaluation item 只处理一个设计点；不要求每题单独占用一轮对话。同一行为类型或共享同一概念前提的
   题目，可以把必要讲解、题意提交、批量 review 和来源核对合并为一轮；只有会改变契约的歧义才单独确认。
2. 计划外练习必须先标明并由本人确认；补充讲解结束后返回当前未完成项。
3. AI 的来源搜索、机械落盘和验证尽量批量执行；等待时间视为实际日历成本，不利用等待新增学习支线。
4. 每完成一类题意或一个门禁才更新本文件；不按对话轮次追加流水账。
5. 本人无需定向翻阅来源以确认 API 或格式细节；但 query、预期行为和规则结论仍由本人决定。
6. 当日精力不足或对话等待导致未完成时，停在当前门禁并记录下一入口，不压缩判据、不由 AI 代填，也不
   叠加 D3 工作。

## 6. D2 明确不做

- 不设计或实现 RAG Prompt、response schema、serialization、context budget 或 full-context baseline。
- 不实现 ingestion、chunking、BM25、context assembly、generation 或 citation registry。
- 不运行 holdout，不查看 holdout 结果，不根据 holdout 调参。
- 不启动 dense、hybrid/RRF、仓库 Markdown 扩展语料、UI、学习展板或分享排练。
- 不自动 commit、push 或 merge。

## 7. 证据记录

| 对象 | 版本或输入 | 原始证据位置 | 观察 | 结论与边界 |
|---|---|---|---|---|
| 题意 | 20/20 已确认；五类行为题意完成 | `week13-rag/eval/dev/items.json`、`week13-rag/eval/holdout/items.json` | dev/holdout 各 10 题；每个 split 的五类行为各 2 题；query、规则结论和 evidence requirements 已确认 | 题意阶段与判分契约均已完成 |
| 判分契约 | `w13-eval-v1` | `week13-rag/eval/scoring-contract.md` | answered/abstained、人工语义 checklist、六项 metrics、9/10 split threshold、每类 1/2、no-answer 零容忍已冻结 | 判分语义完成；response schema 与 serialization 留在 D3 |
| dev/holdout schema 与文件 | `w13-eval-v1`；`frozen` | `week13-rag/eval/schemas/evaluation-set.schema.json`、两个 split 文件、`manifest.json` | dev/holdout 各 10 题；共享 schema；五类行为各 2 题；文件 SHA-256 与 contract hash 已记录 | eval 输入与版本边界已冻结 |
| 隔离与机械验证 | Node.js `v24.16.0` | `node week13-rag/eval/scripts/verify-contract.mjs`；加 `--all` 执行 D2 静态全量检查 | 默认 dev：10/10、每类 2、hash 通过且未读取 holdout；显式全量：20/20、两 split 各 10、每类 2、source span 与 hash 通过 | D2 机械门禁通过；未运行模型或 holdout 输出 |

## 8. 收尾清单

- [x] §2 六项完成条件全部通过。
- [x] holdout 未运行，未产生或查看结果，未用于设计或调参。
- [x] 未启动 Prompt、baseline、BM25、dense、展板或分享排练。
- [x] 事实、推断、本人决定和待验证项已分开记录。
- [x] `week13-plan.md` 与 `LEARNING-STATE.md` 已按实际结果更新。
- [x] 是否 commit 由本人决定；AI 未自动 commit、push 或 merge。

## 9. D3 入口

§2 的 eval 契约已经完整冻结。下一入口是 D3 的 RAG Prompt 完整形状讲解；随后由本人冻结 Prompt 语义，
再处理 response schema、serialization、容量判断与只读 dev 的全语料上下文 baseline。D2 未提前启动这些工作。
