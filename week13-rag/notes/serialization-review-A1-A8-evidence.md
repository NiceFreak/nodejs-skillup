# W13 serialization review：A1–A8 验证证据（2026-09-10，D4）

> 建立：2026-09-10（D4）。用途：为
> [`serialization-implementation-review-worksheet.md`](./serialization-implementation-review-worksheet.md) §2 的
> A1–A8 批注提供可复核的实测证据。
>
> **边界**：本文件只提供证据与判据解读，**不代填「符合 / 有疑问 / 需改动」**。批注仍由本人在 worksheet §2
> 批注区填写（AGENTS §1.1：语义与验收判断归本人）。
>
> 基准：冻结 snapshot `rules-c0a4b85`；实现为当前 HEAD 工作区版本。全部验证只读，不调用模型，
> 不写入 `evidence/serialization/`。复现命令与脚本原文见 §10。

## 0. 环境与基线

| 项 | 值 |
|---|---|
| tests | `9 passed in 0.08s` |
| blocks | 572 = 144 paragraph + 349 list_item + 23 code + 43 table_row + 13 quote |
| Evidence Context | 89,854 chars；sha256 `8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b` |
| verify（fresh / on-disk / frozen） | 三者一致，`OK: fresh build matches all provided references.` |
| **独立重算** `model_content` 与 registry 不一致 | **0 / 572** |

「独立重算」= 只依据 D3 §6.2.0 #1/#2 的文字另写一份组装函数，不复用 `serialize.py`，逐条与 registry 比对。
它同时覆盖 A1、A2、A3、A5、A6 的组装面。

## 1. A1 ancestor 标题链

- **契约**：D2 §6.1「标题层级原则」；D3 §6.2.0 #1。
- **实现**：`parser.py`：`head_stack`、`snapshot_heads()`、L208-214 入栈/出栈。
- **验证方法**：自己重扫每份文档的标题行、按 level 弹栈算出祖先链，与 registry 记录的 `headings` 逐条比对；
  另查「层级是否严格递增（由外到内）」与「是否包含文档 H1」。
- **原始输出**：

```text
[A1] blocks=572  独立重算heading链 != registry: 0  层级非严格递增: 0  含文档H1的block: 572
```

- **判据解读**：572/572 与独立重算一致；7 份文档的 H1（L1）进入每个 block 的 heading context；无层级倒序。
- **边界**：只证明「heading 链与独立重算一致」，不证明「哪一层该进模型」的语义粒度最优——D2 已声明
  该质量由 dev eval 暴露。

## 2. A2 段落只按空行与结构行断开

- **契约**：D2 §6.1「本人决定」「段落拆分条件」；边界质量归口见「可重复生成方式」。
- **实现**：`parser.py`：`parse_blocks` paragraph 循环（L257-278）。
- **验证方法**：遍历全部 paragraph block，检查其核心行范围内是否出现空行、标题行、thematic break、
  列表标记、blockquote 行或表格起始行；并统计段落行数分布。
- **原始输出**：

```text
[A2] paragraph blocks=144  违反(含空行/结构行)=0  行数 min/median/max=1/1/4  多行段落=19
```

- **判据解读**：没有任何段落跨空行或跨结构行；最长的段落是 4 行连续普通行；19 个多行段落未被按语义再拆。
- **边界**：「这一段是否应该再拆成两条规则」无法机械验证，D2 已把该问题归口 dev eval；本节只证明
  **实现里除空行与结构行之外没有其它切分依据**。

## 3. A3 fence 只向前合并 + 逐字保真

- **契约**：D2 §6.1「Fenced code block 规则」；D3 §6.2.0 #2（fenced code 围栏与内部字节逐字保真）。
- **实现**：`parser.py`：合并分支 L175-198（条件在 L178-186）、`_code_ranges` L62-74。
- **验证方法**：(a) 统计 code block 中有多少是「与前一块合并」（`core_start < code_spans[0][0]`）；
  (b) 统计合并方向是否只向前；(c) 用合成探针制造冻结语料不存在的判别值，观察逐字分支是否真的生效。
- **原始输出**：

```text
[A3] code blocks=23  与前置段落合并=23  独立=0
[A3] fenced-code 行数=143  其中若按普通行规范化会变形的行=0
```

判别性探针（3 个行尾空格 / 纯空白行 / tab；普通行分支会各自改形）：

```text
  code 分支 : '```text\ncode three spaces   \n   \ncode tab\t\n```\n'
  普通行分支: '```text\ncode three spaces  \n\ncode tab\n```\n'
```

- **判据解读**：23 个 code block 全部与前置段落合并，合并方向全部向前；逐字分支在合成输入下确实生效
  （3 个空格保留、纯空白行保留、tab 保留），与普通行规范化结果不同。
- **覆盖边界（重要，属 §8「锦上添花」而非契约违反）**：
  1. 冻结语料**没有任何一行带行尾空白或纯空白行**，也没有 ≥2 连续空行的 fenced code 区域 → 判据 #2 的
     「code 逐字保真」在真实语料上**不可鉴别**（把它当普通行处理，572 个 block 的结果完全相同）。
     已实测：忽略 `code`/`quote` 逐字标记后，仍不同的 block 数 = **0**（按 kind 统计为空 dict）。
  2. 「不合并的独立 code block」分支在冻结语料上命中 **0** 次；`_code_ranges` 的「围栏不配对」兜底分支
     同样 0 次。
  3. 现有三份 fixture（A/B/C）没有覆盖 fenced code，也没有覆盖 `quote`。
  - 代价：将来改合并条件、加围栏不配对语料或换语料时，这些分支没有回归保护。

## 4. A4 列表按顶层项拆分、嵌套跟随父项、无 lazy continuation

- **契约**：D2 §6.1「列表规则」；`parser.py` docstring 声称「冻结语料无 lazy continuation」。
- **实现**：`parser.py`：`_list_island` L100-151（`base` 缩进、`ind < base` 收尾）。
- **验证方法**：(a) 每个 list_item 的核心首行必须是列表标记，且核心内不得出现缩进小于 `base` 的实义行；
  (b) **把 docstring 的假设当可证伪命题**：找出「紧邻、中间无任何分隔行、缩进 ≤ base 的普通行」——
  这类行若存在，CommonMark 会判为 lazy continuation，而本 parser 会把它切成新 block。
- **原始输出**：

```text
[A4] list_item blocks=349  行内缩进<base 违反=0  疑似lazy continuation=30
[A4] 含嵌套项或缩进续行的顶层项=2
--- 精确判据重跑 ---
列表项后紧跟缩进不足的段落：中间有分隔行 = 47  中间无空行(CommonMark 会判 lazy continuation) = 0
列表项核心内出现「非标记且缩进<=base」的行 = 0
```

- **判据解读**：第一版「疑似 30 例」是判据过粗——它没区分「列表结束后另起段落」（正常）与「紧邻 lazy 续行」。
  精确判据下：47 例中间至少隔了一行（单空行 30 例；含 `---` 或标题的 9+8 例），**0 例是紧邻**。
  因此 `parser.py` docstring 的假设在冻结语料上成立，且这是**验证过的经验事实**而不是断言。
  反向检查为 0，说明没有把 lazy 行错误归入父项。
- **边界**：该结论只对 `rules-c0a4b85` 成立；换语料必须重跑这条判据。

## 5. A5 blockquote 递归拆分 + 行文本逐字保留

- **契约**：D2 §6.1「Blockquote 规则」；D3 §6.2.0 #2（blockquote 行文本含 `>` 原样保留）。
- **实现**：`parser.py`：`_parse_quote_region` L334-349、`_mini_scan_inner` L283-331。
- **验证方法**：(a) 统计 quote block 种类；(b) 核心行是否都以 `>` 开头；(c) 语料事实假设检查
  （`>>` 嵌套、引文内 fence/表格/标题/HR）；(d) 合成探针制造判别值。
- **原始输出**：

```text
[A5] quote blocks=13 {'quote_para': 10, 'quote_list': 3}  核心行不以 > 开头=0
[A5] 语料事实假设检查(全为0则假设成立): 全部为0
```

判别性探针（3 个行尾空格）：

```text
  quote 分支 : '> quote three spaces   \n>\n> 1. item   \n'
  普通行分支: '> quote three spaces  \n>\n> 1. item  \n'
```

- **判据解读**：13 个 quote block 的核心行全部以 `>` 开头；`>>`、引文内 fence/表格/标题/HR 在冻结语料中
  均为 0 例，`_mini_scan_inner` 的相应守卫分支未被真实语料命中；`quote_code` 种类命中 0 次。
  逐字分支在合成输入下确实生效。
- **不可鉴别**：冻结语料没有空引文行（`>` 或 `>  ` 仅空白）也没有行尾空白 → quote 逐字保真在真实语料上
  不可鉴别（同 A3 的实测：忽略标记后差异为 0）。
- **开放问题（不作结论）**：worksheet §3 附录记录的
  `rules/SHOWCASE-VISUAL-PROTOCOL.md#L75-L75` 引导句独立成 block、与 3 个 `quote_list` 并列，属语义边界判断，
  由本人决定是否调整合并规则（D2 已声明该类问题由 dev eval 暴露）。

## 6. A6 表格每数据行一个 block 并附表头

- **契约**：D2 §6.1「表格规则」；D3 §6.2.0 #1；fixture C。
- **实现**：`parser.py`：table 分支 L228-246。
- **验证方法**：遍历 table_row block，检查：核心是否为单行、`headers` 是否为连续的 header+delimiter 两行、
  delimiter 行是否确实匹配、核心行本身是否不是 delimiter、是否带 heading context。
- **原始输出**：

```text
[A6] table_row blocks=43  表格数(按 header 行去重)=6  违反=0
[A6] 每行都附表的 header+delimiter 两行、且 core 为单行: 是
```

- **判据解读**：6 张表、43 个数据行，每行独立成 block 并附带同一张表的 header 与 delimiter 两行。
- **边界**：表头重复进入每行产生的 token 增量**尚未计量**（D4 阶段 2 的 assembled input 计量）；
  D2 §6.1「表格规则」要求在该计量中记录，当前未执行。

## 7. A7 thematic break 只作硬边界

- **契约**：D2 §6.1「Thematic break 规则」。
- **实现**：`parser.py`：`_HR_RE` 分支 L216-218；同类硬边界另见 `_list_island` L119、`_mini_scan_inner` L310。
- **验证方法**：(a) 语料 HR 行总数；(b) 有多少 HR 行落在任何 block 核心范围内（应 0）；(c) Evidence Context
  整串里是否出现独立的 `---` 行（应 0）。
- **原始输出**：

```text
[A7] 语料 HR 行数=33  落在任何 core span 内的 HR 行数=0  Evidence Context 中独立 --- 行数=0
```

- **判据解读**：33 条 HR 全部落在 block 之外；模型可见内容里没有 `---` 行，符合「不进模型内容」。
  同时它也解释了 A3/A4 的边界行为：HR 是禁止跨越合并的硬边界。

## 8. A8 wrapper 前置条件按 `<source` 前缀检查

- **契约**：D3 §6.2.0 #3（前置条件：正文不得含字面 `<source` 或 `</source>`）；D3 §6.1 判据 #3
  （确认记录：保留 `<source` 前缀守卫，不含 `>`）。
- **实现**：`registry.py`：`WRAPPER_FORBIDDEN = ("<source", "</source>")` L23；校验在 `build_entries` L93-97。
- **验证方法**：(a) 冻结语料中字面标记出现次数；(b) 用内存构造的 `SourceDoc` 做**负向探针**，看守卫是否真的
  会抛错，并划出它的精确语义（前缀 / 大小写敏感）。
- **原始输出**：

```text
[A8] 冻结语料中字面 <source / </source> 出现次数=0
[A8]   probe '<source id="x">'      -> ValueError
[A8]   probe '<source>'             -> ValueError
[A8]   probe '</source>'            -> ValueError
[A8]   probe 'a <source id=1> b'    -> ValueError
[A8]   probe '<SOURCE id="x">'      -> NO-RAISE
[A8]   probe 'plain text'           -> NO-RAISE
```

- **判据解读**：守卫确实生效且是**大小写敏感的前缀匹配**——`<source id=…>` 这种形态会被拦截（这正是判据 3
  保留前缀、而不收窄为完整标签的原因）；`<SOURCE` 不拦（契约只约束字面小写标记）。
- **边界**：冻结语料 0 命中，说明该守卫在真实数据上从未触发；它的行为只由上述负向探针证明。

## 9. 步骤 C 破坏性实验（预测先写，实测见 §9.3）

目的：证明「判据会红」——即这些约定不是靠实现自我声明，而是有会失败的检验在守着。
两个实验都只改 `parser.py` 一处，跑完立即还原（`git checkout -- src/w13rag/parser.py`）。

### 9.1 实验 1：去掉 A3 的「段落 → fence」合并

改法：把 L178-186 的合并条件改为恒不成立（走 `else`，每个围栏自成 code block）。

**预测（写于实测之前）**：

| 检验 | 预测 | 理由 |
|---|---|---|
| fixture 5 条 | 仍绿 | fixture 直接调 `build_model_content`，不经 parser |
| 真实语料 4 条（覆盖/查重/单行/首尾空行） | **仍绿** | 段落与围栏拆开后，覆盖仍完整、无重复、无跨行 |
| block 数 | 572 → 595（+23） | 23 个合并块各自拆成 2 块 |
| 整串 sha256 | 改变 | 每个 code block 丢掉前置段落行；块序与块数也变 |
| `verify`（带 frozen） | **FAIL** | fresh 与 on-disk / frozen 都不一致 |

**预期结论**：`test` 抓不到 A3 的删除，**唯一会红的检验是冻结基准**。这说明 A3 的回归保护目前只由
`frozen-rules-c0a4b85.sha256` 承担。

### 9.2 实验 2：headings 过滤掉 level=1

改法：`snapshot_heads()` 返回时过滤掉 level==1 的标题行。

**预测（写于实测之前）**：

| 检验 | 预测 | 理由 |
|---|---|---|
| fixture 5 条 | 仍绿 | fixture 的 headings 由调用方显式传入，不经过 `snapshot_heads()` |
| 真实语料 4 条 | 仍绿 | 只影响 heading context 内容，不破坏覆盖/查重/单行 |
| 每个 block 的 `model_content` | 各少 1 行（文档 H1） | 572 个 block 全部含 L1 |
| `ctx_chars` | 从 89,854 降到约 81,000–83,000 | 572 × (各文档标题行长度 + 1) ≈ 8k–9k chars |
| `content_sha256` / 整串 sha256 | 全部改变 | heading 行进入每条 model_content |
| `verify`（带 frozen） | **FAIL** | 同上 |

### 9.3 实测结果（2026-09-10）

改动位置：实验 1 = `parser.py` L178 `if (` → `if False and (`；实验 2 = L171 `snapshot_heads()` 过滤 `lvl != 1`。
两次都是单行改动，跑完立即 `git checkout -- src/w13rag/parser.py` 还原。

### 实验 1 原始输出

```text
### pytest
9 passed in 0.12s

### verify（带 frozen）
fresh    : blocks=595 sha256=dbe1b8b1d0066bc5418ee368fbb5bae6b8e25b3f8aed63e627851e0f15010d39
on-disk  : sha256=8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b  matches fresh=False
frozen   : sha256=8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b  matches fresh=False
FAIL:
  - on-disk evidence-context file differs from fresh build
  - frozen regression baseline differs from fresh build

### A1-A8 脚本
[BASE] blocks=595 kinds={'paragraph': 167, 'list_item': 349, 'quote_para': 10, 'code': 23, 'table_row': 43, 'quote_list': 3}
[BASE] ctx_chars=92096 ctx_sha=dbe1b8b1d0066bc5418ee368fbb5bae6b8e25b3f8aed63e627851e0f15010d39
  ok   合并方向全部向前 | merged=0
  FAIL 合并分支在冻结语料上确实命中 | merged=0
RESULT: FAIL（1 项）
```

### 实验 2 原始输出

```text
### pytest
9 passed in 0.21s

### verify（带 frozen）
fresh    : blocks=572 sha256=6559babc8e404ab994f385653168d1daff41b5b31d11d1bd369a340e6d34ecd8
on-disk  : sha256=8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b  matches fresh=False
frozen   : sha256=8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b  matches fresh=False
FAIL:
  - on-disk evidence-context file differs from fresh build
  - frozen regression baseline differs from fresh build

### A1-A8 脚本（exit=1）
[BASE] blocks=572 ctx_chars=81638 ctx_sha=6559babc8e404ab994f385653168d1daff41b5b31d11d1bd369a340e6d34ecd8
[A1]   FAIL 独立重算 heading 链 == registry | mismatch=572
       含文档 H1 的 block=0/572
RESULT: FAIL（1 项）
```

### 预测与实测对照

| 检验 | 实验 1 预测 | 实测 | 实验 2 预测 | 实测 |
|---|---|---|---|---|
| fixture 5 条 | 绿 | 绿（9 passed） | 绿 | 绿（9 passed） |
| 真实语料 4 条 | 绿 | 绿 | 绿 | 绿 |
| block 数 | 595（+23） | 595 | 572（不变） | 572 |
| 整串 sha256 | 改变 | `dbe1b8b1…` | 改变 | `6559babc…` |
| `ctx_chars` | 未预测 | 92,096（每条多两个 wrapper 行） | 约 81,000–83,000 | **81,638** |
| `verify`（带 frozen） | FAIL | FAIL | FAIL | FAIL |
| A1–A8 脚本 | 未预测 | FAIL（合并分支未命中） | 未预测 | FAIL（独立重算 572 处偏差） |

预测全部命中，两项新增的观察：

1. **`pytest` 对这两类退化都是 9 passed**。现有 9 条测试守住的是覆盖、查重、单行、首尾空行、双跑一致与 fixture 字节，
   但没有断言「合并分支必须命中」或「heading 链必须与独立重算一致」。因此删除 A3 合并后，`test` 不会红。
2. 会红的是两类：**冻结基准 `verify`**（两个实验都红），以及**本文件的独立重算检查**（实验 2 由它直接指出 572 处偏差；
   实验 1 由新增的「合并分支确实命中」检查指出）。

这条事实直接支撑 worksheet §0 的判定线：**`w13rag.sh test` 全绿不足以证明组装层没有退化**，冻结基准与独立重算
才是阻断性验收手段。

### 还原证据

```text
git diff --stat -- week13-rag/src/w13rag/parser.py   → 空
parser.py md5 = 998cabc9d4cadbd30f8519809a148b52      → 与改动前记录一致
./scripts/w13rag.sh test                              → 9 passed
verify（带 frozen）                                    → fresh / on-disk / frozen 三者一致 8a02c665…
python3 scripts/verify-a1-a8.py                       → RESULT: PASS，exit=0
```


## 10. 复现方式

A1–A8 的全部只读验证已固化为脚本（只读、无第三方依赖、带 PASS/FAIL 退出码）：

```bash
cd week13-rag
python3 scripts/verify-a1-a8.py                                  # A1-A8 + 全语料独立重算
./scripts/w13rag.sh test                                          # 9 passed
FROZEN_SHA256=evidence/serialization/frozen-rules-c0a4b85.sha256 ./scripts/w13rag.sh verify
```

脚本内容：`scripts/verify-a1-a8.py`。它不复用 `serialize.py` 的组装逻辑，而是按 D3 §6.2.0 #1/#2 的
文字另写一份组装函数逐条比对；A8 用内存构造的 `SourceDoc` 做负向探针，不落地任何临时文件。

## 11. 本人的批注区

A1–A8 的「符合 / 有疑问 / 需改动」在
[`serialization-implementation-review-worksheet.md`](./serialization-implementation-review-worksheet.md)
§2 批注区填写。

**本人签认结论（2026-09-10）**：A1–A8 全部「符合」，无「有疑问」「需改动」项；实现无需改动，冻结基准无需重冻结。

本文件证据相关的三个待决点，本人于 2026-09-10 决定：

- [x] A3：**追加**一个覆盖 fenced code 逐字保真的 fixture（现无语料可鉴别案例）。执行结果见 §12。
- [x] A5：`rules/SHOWCASE-VISUAL-PROTOCOL.md#L75-L75` 引导句独立成 block **保留为开放问题**，不调整合并规则。
- [x] A6：表头重复的 token 增量**确认**在 D4 阶段 2 的 assembled input 计量中记录。

## 12. A3 追加 fixture（2026-09-10 本人决定后执行）

用途：覆盖 D3 §6.2.0 #2 中「fenced code 围栏与内部字节逐字保真」这一支。冻结语料不含行尾空白、
纯空白行与围栏内连续空行，因此该分支此前**没有任何可鉴别用例**（见 §3）。

新增内容为**测试内内存文档**（`tests/test_fixture_serialization.py`），不进入 corpus、registry、
Evidence Context 或 eval；因此**不改变**整串 sha256 `8a02c665…`，冻结基准无需重冻结。

覆盖的判别点（每个点都与「按普通行处理」的结果不同）：

| 输入行 | code 逐字保真 | 普通行规范化 |
|---|---|---|
| `code three spaces   `（3 个尾空格） | 保留 3 个 | 归一为 2 个 |
| `   `（纯空白行，围栏内） | 保留该行 | 变成空行 |
| `code tab\t` | 保留 tab | 删除 tab |
| 围栏内连续 2 个空行 | 两行都保留 | 折叠为 1 行 |

**执行结果（2026-09-10）**：

- `tests/test_fixture_serialization.py` 新增 `DOC_D` 与 2 个用例；`./scripts/w13rag.sh test` → **11 passed**
  （原 9 条 + 新增 2 条）。
- 两条用例互为判别：`test_fixture_d_fenced_code_stays_verbatim` 锁定逐字字节与 sha256 `b7e357d7…`；
  `test_fixture_d_differs_from_ordinary_line_normalization` 锁定「同一输入按普通行处理得到不同字节」与
  sha256 `dc181242…`。后者是关键：只断言前者无法排除「该输入恰好两种处理结果相同」。
- 预期值先按 D3 §6.2.0 #1/#2 文字手推，再与实现比对，两侧一致后才写入断言；不是把实现当前输出直接固化成契约。
- 冻结基准未受影响：`verify` 仍为 fresh / on-disk / frozen 三者一致 `8a02c665…`；`verify-a1-a8.py` 仍 PASS。
- 未覆盖（保持为已知边界）：`quote` 分支同样缺可判别用例（冻结语料无空引文行与行尾空白）；
  「不合并的独立 code block」与 `quote_code` 两个分支在冻结语料 0 命中。




