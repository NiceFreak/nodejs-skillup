# W13 D2（9/8）：冻结 eval 契约

> 建立：2026-09-08（Asia/Shanghai）。
>
> 本文件是 D2 阶段工作表与执行记录，不要求用一个自然日强行完成。D1 未完成项不再整体打包进 D2；D2
> 只处理 eval 契约。后续是否进入 RAG Prompt 与全语料上下文基线，由本文件的退出门禁决定。
>
> 协作模式：导师模式。题目语义、指标、阈值、通过标准和核心断言由本人冻结；AI 负责术语讲解、事实核对、
> 冻结来源定位，以及 schema 排版、稳定 ID、JSON 和 hash 等机械工作。

## 1. 当前事实

- 规则文档语料 snapshot `rules-c0a4b85` 已冻结，7 个文件共 76,149 bytes。
- raw corpus-only 结果为 18,680 estimated tokens；完整 serialized input 与 provider usage 尚未产生。
- evaluation item 的最小结构、五类行为、dev/holdout 物理隔离与 20 题规模已冻结。
- “直接可回答”类 `dev-1` 题意已确认；其余 19 条题意、正式 schema、指标、阈值和通过标准尚未冻结。
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

- [ ] 按 `LEARNING-PROTOCOL.md` 恢复状态，并读取本文件、D1 收口、周计划与 `git status --short`。
- [ ] 核对正式题目只引用 `rules-c0a4b85`；现行协作规范只约束协作，不回填 snapshot。
- [ ] 确认 holdout 文件不会被 D2 的任何运行入口读取。
- [ ] 确认本阶段只冻结 eval，不追加 RAG Prompt、容量、BM25、dense 或展示工作。

## 4. 执行顺序

### 4.1 冻结剩余题意

- [ ] 从“直接可回答”类剩余 `dev-2`、`holdout-1`、`holdout-2` 开始。
- [ ] 随后依次处理跨文档、近似表述、优先级/冲突/例外和无答案；每类一次提交 dev 2 题与 holdout 2 题。
- [ ] 本人对每题提供准确 query、预期分支和一条预期规则结论；结论存疑时显式标注，由 AI 依据 snapshot
  核对，不据此替本人另选题目。
- [ ] 每题只处理一个设计点。需要多个规则才能成立的结论必须明确证据组合，不把多个独立问题塞进一题。
- [ ] 每批四题确认后立即固定语义；AI 批量定位 source span 和处理机械结构，不逐字段要求本人录入。

### 4.2 冻结判分契约

- [ ] 本人定义每类题目需要观察的输出行为和 item-level passing criteria。
- [ ] 本人冻结全局 metrics、thresholds 与整套 eval 的 passing criteria；missing citation 的必失败规则和
  citation precision `1.0` 继续沿用已冻结决定。
- [ ] answered 与 abstained 分支分别说明哪些字段可被确定性解析，以及字段合法但语义错误时如何失败。
- [ ] 失败先按当前可观察阶段记录；全语料上下文 baseline 没有 retrieval，不预建 retrieval miss 结论。

### 4.3 机械落盘与隔离验证

- [ ] AI 根据本人确认的语义生成共享 schema、dev/holdout 文件、稳定 ID、source span identifiers 和 hash。
- [ ] 验证 dev/holdout 数量、行为类型覆盖、ID 唯一性、schema 合法性、source span 可解析和 hash 可复现。
- [ ] 验证常规开发入口只指向 dev；本阶段不运行模型，不产生 holdout 输出。
- [ ] 保存 eval 版本与验证命令，使 D3 可以直接读取冻结 dev set。

## 5. 响应式执行规则

1. 每次只处理一个设计点；同一行为类型的四题可以批量 review。
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
| 题意 | 1/20 已确认，其余待冻结 | 待填写 | 待填写 | 待填写 |
| 判分契约 | 待冻结 | 待填写 | 待填写 | 待填写 |
| dev/holdout schema 与文件 | 待创建 | 待填写 | 待填写 | 待填写 |
| 隔离与机械验证 | 待执行 | 待填写 | 待填写 | 待填写 |

## 8. 收尾清单

- [ ] §2 六项完成条件全部通过，或每个未完成项均记录实际状态与下一入口。
- [ ] holdout 未运行、未查看、未用于设计或调参。
- [ ] 未启动 Prompt、baseline、BM25、dense、展板或分享排练。
- [ ] 事实、推断、本人决定和待验证项已分开记录。
- [ ] `week13-plan.md` 与 `LEARNING-STATE.md` 已按实际结果更新。
- [ ] 是否 commit 由本人决定；AI 未自动 commit、push 或 merge。

## 9. D3 入口

只有 §2 的 eval 契约完整冻结，D3 才进入 RAG Prompt、response schema、serialization、容量判断与
全语料上下文 baseline。若门禁未通过，D3 继续完成 eval，不通过叠加后续阶段维持日历标签。
