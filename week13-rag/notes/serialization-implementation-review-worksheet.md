# W13 serialization 实现 review 工作表

> 建立：2026-09-09（D3）。用途：本人 review parser / citation registry / Evidence Context 实现的工作表；
> 结论由本人逐项批注，AI 只提供对象、命令与对照依据，不代填 review 结论。
> 配套材料：`scripts/inspect-block.sh`（查单个 entry）、`scripts/w13rag.sh`（test/build/verify）。
>
> review 对象版本：以冻结 snapshot `rules-c0a4b85` + 当日实现为准；registry 产物
> `evidence/serialization/registry-rules-c0a4b85.json`（572 blocks，sha `8a02c665…`）。

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

| # | 编码约定 | 契约依据 | 实现位置（当日行号） | 删掉/改掉会影响什么 |
|---|---|---|---|---|
| A1 | ancestor 标题链（含文档 H1）由外到内作 heading context | D2 必要标题层级；D3 §6.2.0 #1 | `parser.py` head_stack；`parse_blocks` 各分支 snapshot_heads() | 每个 entry 的 model_content 缩短 → 572 个 hash、整串 sha 全变；token 减少 |
| A2 | 段落只按空行切分，不做语义级再拆 | D2「独立规则段落」+「边界由 dev eval 暴露」 | `parser.py` parse_blocks paragraph 分支（p 循环） | 一段含多条规则的 block 保持原样；semantic 过粗由 eval 暴露 |
| A3 | fence 只向前合并「同小节紧邻上一段落」；代码含围栏逐字保真 | D2 fenced code 规则 | `parser.py` open_to 合并分支；`_code_ranges` | 代码块失去前置说明 → model_content 缺语境；或相反误并无关段落 |
| A4 | list 按顶层项拆分、嵌套跟随父项；不支持 lazy continuation | D2 列表规则（corpus 实测无 lazy） | `parser.py` `_list_island` | lazy 续行会提前断 list，正文脱属（扩展语料风险） |
| A5 | blockquote 内部按段落/顶层列表递归拆分；整段 verbatim | D2 blockquote 规则 | `parser.py` `_parse_quote_region` / `_mini_scan_inner` | 引文段与内部列表如何归属；见 §3 样本 4 的开放问题 |
| A6 | 表格组 = header + delimiter + 数据行；每数据行一个 block 附表头 | D2 表格规则；D3 fixture C | `parser.py` parse_blocks table 分支 | 表头是否重复进每个行 block（token 代价已记录在计量项） |
| A7 | thematic break 硬边界、不进模型内容 | D2 thematic break 规则 | `parser.py` `_HR_RE` 分支 | 越过 `---` 错误合并前后内容 |
| A8 | `<source` 前缀守卫（正文不含字面 `<source`/`</source>`） | day3 §6.1 wrapper 冲突处理（已确认） | `registry.py` `WRAPPER_FORBIDDEN` | 弱化为完整标签会漏过 `<source id=…>` 形态 |

**批注区**（本人填写）：逐项写下「符合 / 有疑问 / 需改动」与理由；A1/A3/A5 是重点。

## 3. 步骤 B：预测 → 实测（4 个代表样本）

方法：先用 `sed -n` 看源文档对应行，写出你对 source_span / context_spans / model_content 的预测，
再用 `./scripts/inspect-block.sh <source_id>` 对比。实测参考值在文末附录，做完预测再看。

| 样本 | 验证约定 | 预测任务 |
|---|---|---|
| `rules/TECHNICAL-WRITING-PROTOCOL.md#L11-L18` | A3 fence 合并 | core 是否含前置段落与围栏？context 几层？ |
| `rules/AGENTS.md#L47-L58` | A4 嵌套列表 | 一个顶层项含哪些行？嵌套项是否各自成 block？ |
| `rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50` | A6 表格 | table_header context 行范围？heading context 几层？ |
| 引文 L75-82（source_id 见附录） | A5 blockquote | 预测拆成几个 block、各自行范围 |

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
- 随机取一个 entry：用 `source_span` 从 snapshot 原文手工拼一次，与 `model_content` 逐字节对比。

## 6. 步骤 E：修改预测练习（本人完成）

自拟一个合理修改（示例：「A1 去掉文档 H1 上下文以省 token」），先预测影响哪些层与值
（parser 行为 → 每条 model_content → 572 hash → 整串 sha → 冻结基准需重冻结；fixture 不经 parser，不受影响），
再实测核对。偏差即理解缺口，记录到每日笔记。

## 7. 收口

全部批注完成、破坏性实验还原后，在此记录：每项 A1-A8 的最终结论、是否需改动实现、
是否触发冻结基准重冻结、遗留锦上添花项及代价。之后同步每日笔记与 `LEARNING-STATE.md`。

---

## 附录：实测参考（当前 572-blocks 产物，2026-09-09）

| source_id | context_spans（实测） |
|---|---|
| `rules/TECHNICAL-WRITING-PROTOCOL.md#L11-L18` | heading (1,1), (9,9) |
| `rules/AGENTS.md#L47-L58` | heading (1,1), (28,28), (39,39) |
| `rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50` | heading (1,1), (41,41); table_header (46,47) |
| 引文 L75-82 拆为 4 块 | `…#L75-L75`、`…#L76-L77`、`…#L78-L79`、`…#L80-L82`；各带 heading (1,1), (71,71) |

> 观察点（开放问题，非阻断）：引文 L75 `> **形态推导纪律…**：` 作为引导句被拆成独立 quote_para block，
> 与后面 1.2.3. 三个 quote_list block 并列。是否符合「引文保留必要语境」的意图，属于语义边界判断
> （由 dev eval 暴露或你 review 后决定是否调整合并规则）。
