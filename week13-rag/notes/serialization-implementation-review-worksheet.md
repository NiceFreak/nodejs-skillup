# W13 serialization 实现 review 工作表

> 建立：2026-09-09（D3）。用途：本人 review parser / citation registry / Evidence Context 实现的工作表；
> 结论由本人逐项批注，AI 只提供对象、命令与对照依据，不代填 review 结论。
> 配套材料：`scripts/inspect-block.sh`（查单个 entry）、`scripts/w13rag.sh`（test/build/verify）。
>
> review 对象版本：以冻结 snapshot `rules-c0a4b85` + 当日实现为准；registry 产物
> `evidence/serialization/registry-rules-c0a4b85.json`（572 blocks）；`8a02c665…` 是完整 Evidence Context 的 SHA，
> 不是 registry JSON 文件的 SHA。

## 0. 判定线（AGENTS §8）

- **阻断性问题**：实现与已冻结契约不一致（day3 §6.2.0 / D2 §6.1）；正文被静默丢失或重复；
  hash/顺序/role 与契约冲突；命令不可复现或产物有陈旧残留。
- **锦上添花**：符合契约但留下可说明的代价（如 token 膨胀、扩展语料需新规则）。每条写清不改的代价。
- **不列入**：纯风格意见；「这个 split 边界也许不够好」——D2 已声明语义边界质量由 dev eval 暴露。

## 1. Review 范围（文件）

- `src/w13rag/source.py`（读取/行模型）· `serialize.py`（规范化/组装/hash/wrapper）
- `src/w13rag/parser.py`（块切分）· `registry.py`（entry/排序/前置条件）
- `src/w13rag/cli.py`（构建/审计/verify）· `tests/`（fixture 回归 + 真实语料不变式）

## 2. 步骤 A：语义点对照与批注（逐项批注：符合 / 有疑问 / 需改动）

> 本表 review 的对象是「冻结语义下的实现行为」，不是命名或代码风格。定位统一给符号名；行号会随代码
> 改动漂移，需要时现场取。

| # | 实现约定（review 对象） | 契约依据 | 实现位置（符号名） | 若不按此约定实现，可观察的后果 |
|---|---|---|---|---|
| A1 | 当前块所在小节的祖先标题按由外到内顺序进入 heading context，包含文档级 H1 | D2 §6.1「标题层级原则」；D3 §6.2.0 #1 | `parser.py`：`head_stack`、`snapshot_heads()` 及各分支调用点 | 每个 entry 的 `model_content` 变短；572 个 `content_sha256` 与整串 sha256 全部改变；模型可见 token 减少 |
| A2 | 段落只按空行与结构化行断开，不做语义级再拆 | D2 §6.1「本人决定」「段落拆分条件」；边界质量归口见「可重复生成方式」 | `parser.py`：`parse_blocks` paragraph 循环 | 含多条独立规则的段落仍是一个 block；边界粒度是否有效不在本阶段判定，由 dev eval 暴露 |
| A3 | fenced code block 只与同一小节中紧邻在前的段落合并；围栏行与代码字节逐字保真 | D2 §6.1「Fenced code block 规则」 | `parser.py`：fence 合并分支、`_code_ranges` | 不做合并 → 代码 block 缺前置说明，`model_content` 失去语境；扩大合并范围 → 无关段落被并入同一 block |
| A4 | 列表按顶层项拆分；嵌套项与缩进续行跟随所属顶层项；不处理 lazy continuation | D2 §6.1「列表规则」；当前语料实测无 lazy continuation（`parser.py` 模块 docstring，2026-09-09） | `parser.py`：`_list_island` | 若新增 lazy continuation 支持，部分未缩进续行的 block 归属会变化；当前语料不触发，扩展时需先明确语义并验证 |
| A5 | blockquote 内部递归应用段落与顶层项的拆分规则；引文行文本（含 `>`）逐字保留 | D2 §6.1「Blockquote 规则」；D3 §6.2.0 #2 | `parser.py`：`_parse_quote_region`、`_mini_scan_inner` | 后果对象 = 引文段与引文内列表的 block 归属；当前实测归属见 §3 样本 4，仍是开放问题（未判定） |
| A6 | 表格组 = 表头行 + 分隔行 + 数据行；每个数据行是一个 block，并附带表头行作为 `table_header` context | D2 §6.1「表格规则」；D3 §6.2.0 #1；fixture C | `parser.py`：`parse_blocks` table 分支 | 表头行重复进入每个数据行 block 的 `model_content`；该 token 增量应在 assembled input 计量时记录（D2 §6.1「表格规则」），D4 总输入计量已包含该开销，但未单独量化表头边际增量 |
| A7 | thematic break 只作硬边界：不生成 block，也不进入 `model_content` | D2 §6.1「Thematic break 规则」 | `parser.py`：`_HR_RE` 分支；`_list_island`、`_mini_scan_inner` 的同类硬边界判断 | 若不作硬边界，`---` 前后内容会因邻接规则被合并进同一个 block |
| A8 | wrapper 前置条件按 `<source` 前缀检查：正文不得含字面 `<source` 或 `</source>` | D3 §6.2.0 #3；D3 §6.1 判据 #3；确认记录见判据清单判据 3 | `registry.py`：`WRAPPER_FORBIDDEN`、`build_entries` 校验 | 若收窄为只匹配完整开闭标签，正文中的 `<source id=…>` 形态会通过检查，与 wrapper 冲突 |

**批注区（2026-09-10 由本人签认）**：

- A1 **符合** · A2 **符合** · A3 **符合** · A4 **符合** · A5 **符合** · A6 **符合** · A7 **符合** · A8 **符合**
  —— 八项均无「有疑问」「需改动」项。
- 签认依据：A1–A8 的全语料只读验证（16 条不变式全部通过）、步骤 C 两个破坏性实验（预测先写、实测均按预期变红、
  已还原）、全语料独立重算与 registry 逐字节一致。证据见
  [`serialization-review-A1-A8-evidence.md`](./serialization-review-A1-A8-evidence.md)。
- 由签认产生的三项后续动作（2026-09-10 本人决定）：
  1. A3：追加一个覆盖 fenced code 逐字保真的 fixture（当时缺可鉴别用例；后续 fixture D 已完成）；
  2. A5：`rules/SHOWCASE-VISUAL-PROTOCOL.md#L75-L75` 引导句独立成 block 的问题**保留为开放问题**，不调整合并规则；
  3. A6：表头重复开销已计入 D4 完整输入总量；单独的边际增量未拆分测量，不能从总差额推定。

## 3. 步骤 B：预测 → 实测（4 个代表样本）

方法：先用 `sed -n` 看源文档对应行，写出你对 source_span / context_spans / model_content 的预测，
再用 `./scripts/inspect-block.sh <source_id>` 对比。实测参考值在文末附录，做完预测再看。

| 样本 | 验证约定 | 预测任务 |
|---|---|---|
| `rules/TECHNICAL-WRITING-PROTOCOL.md#L11-L18` | A3 fence 合并 | core 是否含前置段落与围栏？context 几层？ |
| `rules/AGENTS.md#L47-L58` | A4 嵌套列表 | 一个顶层项含哪些行？嵌套项是否各自成 block？ |
| `rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50` | A6 表格 | table_header context 行范围？heading context 几层？ |
| `rules/SHOWCASE-VISUAL-PROTOCOL.md#L75-L75`、`#L76-L77`、`#L78-L79`、`#L80-L82` | A5 blockquote | 预测拆成几个 block、各自行范围 |

> 流程示范：一次完整的「选点 → 取输入 → 写预测 → 定位 → 实测 → 对比 → 偏差归因」见
> [`serialization-review-stepB-worked-example.md`](./serialization-review-stepB-worked-example.md)。该示范样本
> 排除在本文 4 个正式样本之外，不作为 A1–A8 的签认依据。

## 4. 步骤 C：破坏性验证（证明判据会红）

实验前后务必还原（`git diff` 检查）。两个建议实验：

1. **去掉 A3 合并**：在 `parser.py` 跳过 paragraph→code 合并分支 → `./scripts/w13rag.sh test` 预期 fixture 仍绿、
   真实语料 test 可能红；带 frozen 跑 `verify` 预期 `frozen matches fresh=False` + FAIL。
2. **去掉 A1 的 H1**：headings 生成时过滤 level=1 → 每个 entry model_content 变短 → verify 预期 FAIL，
   观察 sha 变化并估算 token 差异（这是你决定 A1 取舍的依据）。

命令：`FROZEN_SHA256=evidence/serialization/frozen-rules-c0a4b85.sha256 ./scripts/w13rag.sh verify`

## 5. 步骤 D：审计复核（独立于测试自查）

- `context_spans[].role` 集合 == {heading, table_header}（可单行脚本确认）。
- 所有 span 的 line_start/line_end ≤ 该文档行数（越界 = 实现 bug）。
- 随机取一个 entry：按 `context_spans` 与核心 `source_span` 从 snapshot 回读，依冻结顺序与规范化规则
  手工组装，再与 `model_content` 逐字节对比。只拼核心 span 会漏掉标题或表头。

## 6. 步骤 E：修改预测练习（本人完成）

自拟一个合理修改（示例：「A1 去掉文档 H1 上下文以省 token」），先预测影响哪些层与值
（parser 行为 → 每条 model_content → 572 hash → 整串 sha → 冻结基准需重冻结；fixture 不经 parser，不受影响），
再实测核对。偏差即理解缺口，记录到每日笔记。

## 7. 收口

全部批注完成、破坏性实验还原后，在此记录：每项 A1-A8 的最终结论、是否需改动实现、
是否触发冻结基准重冻结、遗留锦上添花项及代价。之后同步每日笔记与 `LEARNING-STATE.md`。

> A1–A8 的验证证据（含步骤 C 两个破坏性实验的预测与实测输出、还原证据）见
> [`serialization-review-A1-A8-evidence.md`](./serialization-review-A1-A8-evidence.md)；
> 只读重跑入口：`python3 scripts/verify-a1-a8.py`（PASS/FAIL 退出码）。

**收口记录（2026-09-10）**：

- 每项 A1–A8 最终结论：全部「符合」（见 §2 批注区）。
- 是否需改动实现：**否**。
- 是否触发冻结基准重冻结：**否**——实现未改动，整串 sha256 仍为 `8a02c665…`，fresh / on-disk / frozen 三者一致。
- 破坏性实验：两个实验均按预测变红并已还原（`parser.py` md5 复原、`git diff` 为空、tests 9 passed、verify OK）。
- 遗留锦上添花项及代价：
  1. A3 逐字分支在冻结语料与现有 fixture 上不可鉴别 → 本次追加 fixture 覆盖后有回归保护；
  2. 「不合并的独立 code block」分支与 `quote_code` 种类在冻结语料 0 命中 → 换语料或改判定条件时无回归保护；
  3. 当时 9 条测试无法识别 A1 / A3 类退化；后续 segmentation 测试已覆盖 A3，A1 仍由冻结基准与独立重算补足；
  4. **已修复（2026-09-10）**：`w13rag.sh check` 已并入绝对基准校验（`[3/3] frozen verify`，默认使用
     `frozen-rules-c0a4b85.sha256`）。修复前的表现、分层根因与可证伪验证见
     [`day4-full-context-baseline-and-bm25.md`](./day4-full-context-baseline-and-bm25.md) §6.6；
  5. **已修复（2026-09-10）**：新增 `tests/test_parser_segmentation.py`，覆盖「段落 + fence 合并」「非段落在前
     不合并」「thematic break 阻断合并」「同级标题出栈」「围栏不配对兜底」。同一处退化现在在 `check` 的第一步
     就被抓到（§6.6）。
- 验收状态：**serialization 实现里程碑 L1 正式闭合**（2026-09-10）。

---

## 附录：实测参考（当前 572-blocks 产物，2026-09-09）

| 样本 | context_spans（实测） |
|---|---|
| `rules/TECHNICAL-WRITING-PROTOCOL.md#L11-L18` | heading (1,1), (9,9) |
| `rules/AGENTS.md#L47-L58` | heading (1,1), (28,28), (39,39) |
| `rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50` | heading (1,1), (41,41); table_header (46,47) |
| `rules/SHOWCASE-VISUAL-PROTOCOL.md#L75-L82`（拆为 4 块） | `#L75-L75`、`#L76-L77`、`#L78-L79`、`#L80-L82`；各带 heading (1,1), (71,71) |

> 观察点（开放问题，非阻断）：`rules/SHOWCASE-VISUAL-PROTOCOL.md` 的 L75 `> **形态推导纪律…**：` 作为引导句被拆成独立 quote_para block，
> 与后面 1.2.3. 三个 quote_list block 并列。是否符合「引文保留必要语境」的意图，属于语义边界判断
> （由 dev eval 暴露或你 review 后决定是否调整合并规则）。
