# W13 D3 学习计划：冻结 `model_content` 与 Evidence Context serialization 契约

> 日期：2026-09-09（Asia/Shanghai）
>
> 状态：**D3 已完成（2026-09-09）**：设计点 1-6 全部闭合并记录（§6.1）；单一规范（§6.2.0）、合成 fixture A/B/C
> 与期望 hash（§6.2.1）、静态复核（§6.3）完成；掌握验证与 plan/LEARNING-STATE 同步完成；§7 完成条件全部勾选。
> 同日实现延展：确定性 parser / citation registry / Evidence Context 已实现并自测（9 passed、572 blocks），
> 判据 #1–#7 已确认，整串 SHA 已冻结；证据见 D3 英文日报与 serialization 确认清单。
> D4 原入口因此为本人 A1–A8 实现 review、输入计量和客户端验证，实际结果见 D4 笔记。术语对照见 §10。
>
> 协作模式：AI Engineer 分阶段模式。本人冻结 serialization 的语义、边界和自动验证判据；AI 先解释当前
> 设计点，语义确认后先整理规范；设计闭合后的同日实现按实现方模式执行。原设计期范围见 §8。

## 1. 唯一完成对象

冻结单个 source block 的 `model_content` 和全语料 Evidence Context 的确定性组装规则，使后续实现只需执行
已经确认的契约，不再补做内容顺序、空白、边界、编码或职责划分等语义决定。

D3 完成时必须得到一份可直接用于实现和测试设计的规范，明确回答：

1. 单个 block 的模型可见正文如何从 `context_spans` 与 `source_span` 组成。
2. Markdown 标记、空白和换行如何处理。
3. 每个 block 如何携带 source ID，并与相邻 block 形成无歧义边界。
4. hash 对应哪段精确字符串，以及使用什么编码和换行约定。
5. 全语料 block 如何排序，Prompt、Query 与 Evidence Context 各自负责什么。
6. 如何自动证明同一 snapshot 重跑逐字节一致、来源完整且可回读。

## 2. 已冻结输入

- corpus snapshot：`rules-c0a4b85`；manifest 顺序是全语料顺序的候选输入，不代表 relevance。
- eval：`w13-eval-v1`；dev/holdout 均已冻结，本阶段不运行。
- Prompt：`w13-rag-prompt-v0`；调用方分别提供 Evidence Context 与 Query。
- response schema：`rag-response-v1`；模型只能返回 Evidence Context 中出现的 source ID。
- source block：Markdown 段落或小节的语义粒度；列表、表格、fenced code、blockquote 与 thematic break
  的切分规则已经确认。
- source identifier：`corpus_id/source_path#Lstart-Lend`，只标识核心 `source_span` 的冻结位置。
- citation registry 设计：一个核心 `source_span`、零到多个有序 `context_spans`、`model_content`、
  `content_sha256`；顶层只持久化有序 `blocks` 数组。
- `blocks` 排序：manifest 文档顺序，再按核心 `line_start`、`line_end` 升序；重复 `source_id` 必须失败。

这些输入只证明上游设计契约已经形成，不证明 parser、registry、Evidence Context 或模型行为已经实现。

## 3. 问题、输入、输出与验证关系

### 3.1 本阶段解决的问题

同一组 source spans 可以被多种字符串格式表达。若标题连接方式、空白、wrapper、编码或 block 顺序没有冻结，
后续两次运行即使读取同一 snapshot，也可能生成不同输入和 hash；引用 ID 还可能无法与模型实际看到的正文对应。

### 3.2 输入与输出

```text
冻结 manifest + source_span + context_spans
  -> 单 block model_content
  -> source wrapper + source ID + block boundary
  -> 有序 Evidence Context
  -> 作为 Prompt 的 Evidence Context 输入

Query -------------------------------------------------> 作为独立 Query 输入
Prompt ------------------------------------------------> 定义回答规则，不承载语料正文
```

输出契约不是模型答案，而是调用模型前的确定性字符串规则。`content_sha256` 校验的精确对象、UTF-8 字节边界
和换行约定必须在设计点 4 冻结后才能写成最终规范。

### 3.3 验证关系

| 契约对象 | 后续机械验证要证明什么 |
|---|---|
| `model_content` | 只由登记的 spans 组成，顺序与格式固定，hash 可重算 |
| source wrapper | source ID 与正文绑定，任意两个相邻 blocks 的边界无歧义 |
| Evidence Context | block 顺序固定，没有遗漏、重复或额外内容 |
| source spans | 每个核心行范围与附加语境都能从 snapshot 回读 |
| Prompt / Query 边界 | reference answer、expected branch 和 evidence requirements 不进入模型输入 |

## 4. 排除在正式输入之外的示例

下面只展示已确认的**逻辑组装顺序**，不冻结分隔符、空白、wrapper 或 hash 字节。它没有正式 source path、
source ID 或 eval item，不进入 corpus、citation registry、dev、holdout 或任何模型调用。

```text
示例输入：
  context_spans[0] = 外层必要标题
  context_spans[1] = 内层必要标题
  context_spans[2] = 必要表头
  source_span      = 一条表格数据行

逻辑 model_content：
  1. 外层必要标题
  2. 内层必要标题
  3. 必要表头
  4. 核心表格数据行
```

该示例只能验证四类内容的相对顺序。设计点 2-4 未确认前，不从示例中的排版推导换行、wrapper 或 hash 规则。

## 5. 六个设计点的单点门禁

交互顺序固定为：解释当前设计点解决的问题、输入、输出和验证影响，只提出一个问题；本人回答后先 review
该语义，再合并为规范结论。当前点未确认时，不提前要求确认后续点。

| 顺序 | 设计点 | 需要冻结的语义 | 当前状态 |
|---|---|---|---|
| 1 | `model_content` 内容顺序 | 必要标题、必要表头与核心 `source_span` 的相对顺序，以及缺失项处理 | 已确认：标题由外到内，其后是必要表头，最后是核心内容；缺失项省略 |
| 2 | Markdown 与空白 | 换行、空白、缩进、fenced code 和 blockquote 标记的保留或规范化规则 | 已确认完成：基线 A 规范化优先 + 7 项子规则（EOL 统一 LF / 行尾空白 CommonMark 归一 / 空行折叠为 1 / 行首缩进原样 / span 拼接逐字 / fenced code 围栏保留 / blockquote 标记原样） |
| 3 | source wrapper 与边界 | 每个 block 的 wrapper、source ID 位置和相邻 block 分隔格式 | 已确认完成：XML-like 语法族 + 行结构化双引号 + 块间空行 + 正文前置条件约束 |
| 4 | hash 字节边界 | hash 精确字符串、UTF-8 编码、BOM 与换行约定 | 已确认完成：hash 对象 = model_content 全字节；UTF-8 + 读取剥 BOM；整串原样不裁剪不追加 |
| 5 | 全语料输入职责 | block 顺序，以及 Query、Prompt、Evidence Context 的职责边界 | 已确认完成：纯 blocks 串、首尾不加空行、空 blocks 输出空串、职责边界复核一致 |
| 6 | 自动验证判据 | 逐字节一致、无遗漏/重复、来源可回读、hash 可重算 | 已确认完成：全串基准延迟冻结 + 七条判据清单 |

## 6. 执行顺序

### 6.1 冻结设计点 2-6

- 一次只处理表中当前活动设计点。
- 本人回答含糊或同时包含多个可独立变化的规则时，先拆分，不把多个结论一次确认。
- 设计点 2 基线已于 2026-09-09 确认：**A 规范化优先**——除 fenced code、blockquote、表格这类"将单独定规则的
  结构"外，其余正文（普通段落、标题、列表、内联标记）默认把行尾空格、多余空行、排版性缩进等规范化到约定
  格式；需要保真的对象以例外清单单独列出。基线确认不释放后续子规则；EOL、行尾空白/空行/行首缩进、span 拼接
  换行、fenced code 围栏与内部字节、blockquote 标记依次按一问一个独立子规则确认。
- 设计点 2 已确认子规则（每项确认后追加；§6.2 收口时合并为最终规范并删除中间表述）：
  - **EOL（2026-09-09）**：进入 `model_content` 的行之间统一以 LF（`\n`，U+000A）作为行结束符；源文本中出现的
    CR/CRLF 在 serialization 层归一到 LF。当前 snapshot 无 CRLF、无 BOM，本规则当前不改变任何字节，作为对扩展
    语料与任意输入的统一契约承诺。
  - **行尾空白（2026-09-09）**：普通行默认删除行尾空白（规范化基线）；例外为 Markdown hard break 标记——行尾
    空白 ≥2 个空格时保留并归一为恰好 2 个空格（U+0020 × 2），1 个空格或含 tab 的行尾空白全部删除。依据
    CommonMark hard line break = 2+ spaces 的定义。当前 snapshot 受影响行仅为 AGENTS.md 的 10 行（均恰好 2 空格、
    hard break 用法，原样保留）；无 3+ 空格与 tab 结尾。
  - **空行（2026-09-09）**：block 内部单空行作为段落/结构分隔保留；连续空行折叠为恰好 1 个空行。依据 CommonMark
    中块级分隔只需 1 个空行、多余空行不改变解析结构。当前 snapshot 无 2+ 连续空行，本规则当前不改变任何字节。
  - **行首缩进（2026-09-09）**：行首缩进全部按源文件原样保留（含列表嵌套/续行与未来普通行排版缩进）。理由：
    snapshot 的行首缩进全部存在于列表结构，是列表层级与续行归属的语法；CommonMark 中删除缩进会改变块级解析
    （嵌套项变顶层项、续行脱属；4+ 空格可能触发 indented code block 语义）。作为保真对象进入 model_content。
    当前 snapshot 无 tab 开头、无普通段落排版缩进。
  - **span 拼接换行（2026-09-09）**：各 span 按设计点 1 顺序逐字拼接；行文本统一以 LF 结尾，span 边界不额外
    插入或删除换行。空行间隙是否保留完全由 parser 选择的 span 行范围决定（span 行范围包含空行则保留），
    serialization 契约只保证给定行范围的确定性输出。
  - **fenced code 围栏（2026-09-09）**：开闭围栏与 info string 原样进入 `model_content`；围栏内代码字节逐字保真
    （行首缩进、行尾、空行规则不作用于 code 内部）。与 D2"fenced code 与前置说明共同形成连续 source_span"
    一致，保留代码块的结构标记与语言信息。
  - **blockquote 标记（2026-09-09）**：blockquote 行文本（含 `>` 引用标记与后续字符）按已确认规则原样进入
    `model_content`，不做标记归一。D2 已确认 source block 保留引用标记；当前 snapshot 全部为 `>` + 单空格的
    `> ` 形式，无嵌套 `>>`、无标记前导缩进。
- 设计点 2（Markdown 与空白）的全部子规则已于 2026-09-09 确认完毕；最终规范文字由 §6.2 在六点全部确认后统一整理。
- 设计点 3 已确认子规则（每项确认后追加）：
  - **wrapper 语法族（2026-09-09）**：Evidence Context 中每个 block 采用 XML-like wrapper，以
    `<source id="…">` 开标签与 `</source>` 闭标签包裹，source ID 由 id 属性携带；与 Prompt v0 顶层
    `<EVIDENCE_CONTEXT>` / `<QUERY>` 风格一致，便于机械提取与模型阅读。精确字节格式（换行、引号、块间分隔）
    待后续子规则确认。
  - **wrapper 精确字节（2026-09-09）**：单 block 字节构成 = `<source id="{source_id}">` + LF + 正文行文本
    （各行 LF 结尾）+ `</source>`（独立成行）。id 属性使用双引号；source_id 含 `/`、`#`、`.`，不含引号，
    无属性转义需要。开/闭标签均独立成行，正文首行不与开标签同行。
  - **相邻 block 分隔（2026-09-09）**：Evidence Context 中相邻 source blocks 之间用一个空行分隔——
    `</source>` + LF + 空行 + LF + 下一块 `<source id=…>`。空行属于 Evidence Context 组装层格式，不属于任何
    block 的正文，不受设计点 2 正文空行规则约束。机械解析的边界信号是标签本身，空行仅为模型阅读的视觉分隔。
  - **wrapper 冲突处理（2026-09-09）**：契约前置条件——block 正文不得包含字面 `<source` 或 `</source>`；
    自动验证将其作为强制判据（纳入设计点 6）。当前 snapshot 正文尖括号仅出现在占位符文本中，不含该两串；
    未来扩展语料若不满足必须先修订契约，不改动正文字节。
- 设计点 3（source wrapper 与边界）的子规则已于 2026-09-09 全部确认：XML-like 语法族、行结构化精确字节（双引号
  id）、块间空行分隔、正文前置条件约束。
- 设计点 4 已确认子规则（每项确认后追加）：
  - **hash 对象范围（2026-09-09）**：`content_sha256` 只对单 block 的 `model_content` 全字节计算，不含 wrapper
    与 Evidence Context 组装层字节；与 D2 registry 字段语义一致（entry 并列存 model_content 与 content_sha256）。
    wrapper 与全串级完整性验证需求由设计点 6 决定。
  - **hash 编码与 BOM（2026-09-09）**：`model_content` 以 UTF-8 编码为字节后计算 SHA-256；parser 读取源文件时
    若遇 BOM（U+FEFF / `EF BB BF`）先剥除，BOM 不进入行文本与 hash。当前 snapshot 无 BOM，本规则当前无字节影响，
    作为对扩展语料/任意输入的契约承诺。
  - **hash 换行与末尾字节（2026-09-09）**：SHA-256 计算对象 = `model_content` 的全部 UTF-8 字节，不裁剪、不追加；
    末尾是否含 LF 由实际组装字节决定（行文本以 LF 结尾，正常情况末尾含 LF；若 span 末行为源文件末行且无行尾
    LF，则以实际字节为准）。
- 设计点 4（hash 字节边界）的子规则已于 2026-09-09 全部确认：hash 对象 = model_content 全字节、UTF-8 + 剥除 BOM、
  整串原样不裁剪不追加。
- 设计点 5 已确认子规则（每项确认后追加）：
  - **Evidence Context 内容（2026-09-09）**：Evidence Context 内只含按序 serialized 的 blocks（块间一个空行），
    不加块数汇总、版本号或任何运行元数据；与 Prompt v0 模板 `{serialized_source_blocks}` 占位一致。
  - **组装输出首尾与空 blocks（2026-09-09）**：组装函数输出首尾不加空行/换行；N 个 blocks 间恰有 N-1 个块间
    空行；空 blocks 输入输出空串（对应 retrieval 零命中需 abstained 的场景）。块间空行是组装层格式，不属于
    任何 block 正文。
  - **职责边界复核（2026-09-09）**：Query 只含 query（P0 §2）；Prompt 只定义回答规则、不承载语料正文（P0 §1）；
    Evidence Context 不含 reference answer / expected branch / evidence requirements（P0 §2；D2 §6.1）；
    blocks 顺序 = manifest 文档顺序 → 核心 `line_start` → `line_end`，不代表 relevance（D2 §6.1）。以上为已冻结
    契约的复核引用，不引入新语义。全语料 baseline 与 retrieval 路径共用同一组装函数，仅 blocks 输入范围不同。
- 设计点 6 已确认子规则（每项确认后追加）：
  - **全串级验证基准（2026-09-09）**：契约层不新增全串 hash 持久化（registry 顶层形状不变，同设计点 4 的 A 方案）；
    组装层验证 = §6.2 合成 fixture 期望字节比对 + 逐块 hash + 结构校验。D4 首次产出真实全语料 Evidence Context
    后，将其整串冻结为独立 regression 基准（同 holdout 首跑后冻结原则），供后续语料/parser 变更回归；该基准不进
    registry 契约字段，作为运行期基准记录。
  - **验证判据清单（2026-09-09）**：本人确认七条判据作为 D4 实现验证目标。判据 1-2 抓正文与 hash、3 抓 wrapper
    层、4-6 抓组装层与稳定、7 抓职责边界；其中 3-4 以合成 fixture 期望字节补充 content hash 抓不到的组装层 bug。
  - **判据逐字追认（2026-09-09，本人确认；来源：`serialization-criteria-confirm-checklist.md`，即 §6.2.2 映射与
    §3.3 验证关系表的还原文字）**：
    1. `model_content` 只由登记 spans 按 heading（由外到内）→ table_header → 核心 `source_span` 顺序逐字组装，
       规范化符合 §6.2.0 #2，缺失层级省略，同输入重算一致；
    2. `content_sha256` = SHA-256(`model_content` 的 UTF-8 全字节)，读文件剥 BOM，整串原样不裁剪不追加；
    3. wrapper 字节精确；`source_id` 行范围 === 核心 `source_span`；附加语境不扩大 identifier 行范围；
       正文不得含字面 `<source`/`</source>`（`<source` 为前缀守卫，不含 `>` 为有意设计，同时拦截 `<source>`
       与 `<source id=…>`）；
    4. Evidence Context = manifest 文档顺序 → 核心行号升序；块间恰一个空行；首尾无额外空行；空输入空串；
    5. 每条非空非结构性正文行至少属于一个 core 且不重复；spans 可从 snapshot 回读；重复 `source_id` 构建失败；
    6. 同一 snapshot 两次构建 registry 与 Evidence Context 逐字节一致；真实全语料整串首次产出后冻结为
       独立 regression 基准（运行期记录，不进 registry 契约字段）；
    7. Evidence Context 不含块数汇总/版本号/运行元数据；reference answer / expected branch / evidence
       requirement 不进模型输入；Prompt/Query 各司其职；`content_sha256` 只作完整性验证，不作身份。
- 设计点 6（自动验证判据）的子规则已于 2026-09-09 全部确认；D3 六个设计点全部闭合。
- 新决定与 D2 的 source block、identifier 或 registry 契约冲突时立即停止；先说明冲突对象和影响，再决定
  是否修订上游契约。
- 每个确认结果直接合并到本文件的规范结论区，不保存逐轮问答日志。

### 6.2 建立最终规范与排除示例

六点全部确认后，AI 可以机械完成：

- 把确认结果整理为单一规范段落，删除被后续决定替代的中间表述。
- 增加至少一个单 block 和一个双 block 的合成 fixture，明确标注不进入正式 corpus、registry 或 eval。
- 按已确认的编码与字节边界计算合成 fixture 的期望 hash。
- 建立“输入条件 -> 期望字符串/字节 -> 验证判据”对应表，供 D4 实现测试使用。

### 6.2.0 单一规范（设计点 1-6 合并，2026-09-09）

> 本节是 §6.1 累积子规则的机械合并，删除中间表述后形成的最终组装规范；不引入新语义。若与 §6.1 细节冲突，
> 以本节为 D4 实现的权威文本。

1. **`model_content` 组装**：必要标题（`heading`，由外到内）→ 必要表头（`table_header`）→ 核心 `source_span`
   内容；缺失层级省略。各 span 按该顺序逐字拼接：行文本统一以 LF 结尾，span 边界不额外插入或删除换行；空行
   间隙是否保留由 parser 选择的 span 行范围决定。
2. **空白与换行**：行结束符统一 LF（CR/CRLF 归一到 LF）；普通行行尾空白删除，行尾空白 ≥2 个空格时保留并归一
   为恰好 2 个空格（CommonMark hard break），1 个空格或含 tab 全删；block 内单空行保留、连续空行折叠为 1；
   行首缩进全部原样保留（列表/续行等结构缩进是语法）；fenced code 围栏与内部字节逐字保真；blockquote 行文本
   （含 `>`）原样保留，不做标记归一。
3. **source wrapper**：单 block 字节 = `<source id="{source_id}">` + LF + `model_content` + `</source>`（开闭标签
   独立成行，id 用双引号）。Evidence Context 内相邻 block 之间恰一个空行（`</source>` + LF + 空行 + LF + 下一块
   开标签）。前置条件：block 正文不得含字面 `<source` 或 `</source>`。
4. **hash**：`content_sha256` = SHA-256(`model_content` 的 UTF-8 编码字节)，读取源文件剥除 BOM，整串原样不裁剪、
   不追加；不含 wrapper 与组装层字节。
5. **全语料组装与职责**：blocks 顺序 = manifest 文档顺序 → 核心 `line_start` → `line_end`（不代表 relevance）；
   Evidence Context = 有序 serialized blocks（块间一个空行、首尾无额外空行，空 blocks 输出空串），不含块数汇总
   或运行元数据。baseline 与 retrieval 共用同一组装函数，仅输入 blocks 范围不同。Query 只含 query；Prompt 只
   定义规则。
6. **自动验证**：判据 #1-#7（见 §6.1）；以 §6.2.1 合成 fixture 为组装层蓝本；真实全语料整串基准在 D4 首次产出后
   冻结为运行期 regression 基准。



三个合成 fixture 作为 D4 实现的验证蓝本。源文本为合成规则片段，仅为演示契约，不进入任何正式输入。

**合成源行（doc-a.md）**：

```text
L1  ### 示例标题
L2  示例正文第一行。
L3  示例正文第二行。␣␣        ← 行尾恰 2 空格（hard break，按行尾空白规则保留）
L4  （空行，不在任何 span 内）
L5  1. 白名单项
L6  2. 例外项
```

**合成源行（doc-c.md）**：

```text
L1  ## 示例小节
L2  （空行，不在任何 span 内）
L3  | 状态 | 值 |
L4  | --- | --- |
L5  | active | 1 |
```

**期望输出（repr 中 `\n` 为 LF，`␣` 为空格）**：

| fixture | 输入 spans | 期望 model_content（repr） | content_sha256 |
|---|---|---|---|
| A | `source_span` L1-L3（第三行行尾 2 空格） | `'### 示例标题\n示例正文第一行。\n示例正文第二行。  \n'` | `3ffb72fb332921189ddb6c35d0df11880e638c76d2257f2d6831d113d271cfcb` |
| B2 | `source_span` L5-L6（顶层列表项） | `'1. 白名单项\n2. 例外项\n'` | `46c9d5e2ca6bb18f6e39e3aaa1d17574ae3c09b117b9a738f7551ec0304beaf6` |
| C | `heading` context L1 + `table_header` context L3-L4 + `source_span` L5 | `'## 示例小节\n\| 状态 \| 值 \|\n\| --- \| --- \|\n\| active \| 1 \|\n'` | `4591b978ad682dd3001f60aaf84fdb92e7d675c6d58188335715ecc89e683293` |

> 注：上表 C 行 repr 中的 `\|` 仅为 Markdown 表格排版转义，实际字节为未转义的 `|`（见下方 serialized block C 的
> 完整字节）。

期望 serialized block（= wrapper 包裹后的完整字节）：

```text
A : '<source id="fixture/doc-a.md#L1-L3">\n### 示例标题\n示例正文第一行。\n示例正文第二行。  \n</source>'
B2: '<source id="fixture/doc-a.md#L5-L6">\n1. 白名单项\n2. 例外项\n</source>'
C : '<source id="fixture/doc-c.md#L5-L5">\n## 示例小节\n| 状态 | 值 |\n| --- | --- |\n| active | 1 |\n</source>'
```

双 block Evidence Context（A + B2，块间恰一个空行，首尾无额外空行）：

```text
'<source id="fixture/doc-a.md#L1-L3">\n### 示例标题\n示例正文第一行。\n示例正文第二行。  \n</source>\n\n<source id="fixture/doc-a.md#L5-L6">\n1. 白名单项\n2. 例外项\n</source>'
```

该 Evidence Context 整串 sha256（仅作运行记录，不属契约持久化对象）= `0c274d26d4eb52736ecace33c6f9bfbe20b3db3443a7b2cdb2781a17b6f2a497`。

### 6.2.2 输入条件 -> 期望输出 -> 验证判据 对应表

| 输入条件 | 期望输出 | 覆盖判据 |
|---|---|---|
| fixture A spans | model_content repr A；serialized block repr A；content_sha256 `3ffb…cfcb` | #1 组装、#2 hash、#3 wrapper |
| fixture B（A + B2） | Evidence Context repr；整串 sha256 `0c27…a497`；块间 1 空行、首尾无空行 | #3 边界、#4 顺序与块间分隔 |
| fixture C spans | model_content repr C（标题→表头→核心）；serialized block repr C；source_id 只标 `#L5-L5` | #1 顺序、#2 hash、#3 附加语境不进 identifier |

说明：fixture A 验证普通单 block 与行尾 hard break 保留；B 验证双 block 组装与块间空行；C 验证 heading/table_header 附加语境按由外到内→表头→核心的组装顺序，且 `context_spans` 不扩大 identifier 行范围。期望 hash 由一次性脚本按 UTF-8 字节计算并自洽核对通过（2026-09-09）。


### 6.3 静态一致性复核

不写 parser 的前提下检查：

- `model_content` 顺序与 D2 的 `context_spans` role、核心 `source_span` 一致。
- wrapper 中可返回的 source ID 与 registry 的 `source_id` 完全一致。
- Evidence Context 外层格式不与 Prompt 已冻结的 `<EVIDENCE_CONTEXT>` / `<QUERY>` 职责冲突。
- 全语料顺序与 manifest、registry 排序规则一致，不引入 relevance 排序。
- hash 规则只覆盖本人确认的精确字符串，不把未冻结的运行元数据混入。

**复核结果（2026-09-09）**：

| 检查项 | 复核依据 | 结果 |
|---|---|---|
| `model_content` 顺序与 `context_spans` role、核心 `source_span` 一致 | fixture C 期望输出（heading → table_header → 核心行）与 §6.2.0 §1 一致 | 通过 |
| wrapper 中 source ID 与 registry `source_id` 一致 | wrapper 直接以 `source_id` 作 `id` 属性值（§6.2.0 §3），无另造格式 | 通过 |
| Evidence Context 不与 `<EVIDENCE_CONTEXT>` / `<QUERY>` 冲突 | Evidence Context = 纯 serialized blocks；tag 属于 Prompt 模板顶层，职责分离 | 通过 |
| 全语料顺序与 manifest、registry 排序一致，无 relevance 排序 | §6.2.0 §5 = manifest 文档顺序 → 核心行范围 | 通过 |
| hash 只覆盖确认字符串、无运行元数据混入 | hash 对象 = `model_content` 全字节；不含生成时间、Map、wrapper（§6.2.0 §4） | 通过 |


## 7. D3 完成条件

以下条件必须全部满足：

- [x] 设计点 1 已确认并记录。
- [x] 设计点 2：Markdown 与空白规则已确认（基线 A + 7 子规则，见 §6.1）。
- [x] 设计点 3：source wrapper、source ID 和 block 边界已确认（4 子规则，见 §6.1）。
- [x] 设计点 4：hash 字符串边界、UTF-8 与换行约定已确认（3 子规则，见 §6.1）。
- [x] 设计点 5：全语料顺序及 Prompt/Query/Evidence Context 职责已确认（复核已冻结契约，见 §6.1）。
- [x] 设计点 6：自动验证判据已确认（全串基准延迟冻结 + 七条判据清单，见 §6.1）。
- [x] 最终规范不存在 `待定`、互相冲突或依赖实现者自行选择的分支（§6.2.0 单一规范；§6.3 静态复核通过）。
- [x] 排除示例覆盖单 block、双 block 和至少一个含附加语境的 block（§6.2.1 fixture A/B/C）。
- [x] 本人能解释 source ID 与 content hash 的职责差异，并预测修改一个标题或换行会影响哪些值（9/9 掌握验证
  通过：位置身份 vs 内容指纹；内容变化 vs 位置结构变化两类风险已区分）。
- [x] `week13-plan.md` 与 `LEARNING-STATE.md` 已按最终结论机械同步（9/9 收尾更新）。

**D3 验收句**：给定冻结 manifest、一个合法 registry entry 集合和 Query，规范能够唯一确定每个
`model_content`、完整 Evidence Context，以及契约指定 hash 对象的精确字节；后续实现者不需要新增语义决定。

## 8. 设计期的止步条件与原范围

- 任一设计点没有得到本人明确确认时，D3 保持执行中，不进入 parser 实现。
- 规范仍允许两种合法字符串结果时，自动验证契约尚未闭合，不能判定 D3 完成。
- 不创建正式 citation registry，不生成正式 source blocks。
- 不实现或选择 Markdown parser 库。
- 不开始完整 assembled input token 计量或 context budget。
- 不修改模型客户端，不运行模型、baseline、dev generation 或 holdout。
- 不开始 LangChain `Document` 接线、BM25、chunking、dense retrieval、ranking 或 Agent。
- 不制作展板，不 commit、push 或 merge。

## 9. D3 收口与后续入口（2026-09-11 订正）

设计点 1–6、§6.2.0 单一规范、合成 fixture、静态复核与本人掌握验证均已在 9/9 完成。
契约闭合后，同日实现 parser / citation registry / Evidence Context，9 条测试通过；572 blocks 的整串
89,854 字符，真实 SHA 冻结为 `8a02c665…`。该实现延展未回写或放宽 serialization 契约。

D4 随后完成 A1–A8 本人签认、输入计量、客户端接线与模型实验，详见
[`day4-full-context-baseline-and-bm25.md`](./day4-full-context-baseline-and-bm25.md)。
D3 的 review 待办已完成，不再作为当前入口；当前学习与演练使用根 `LEARNING-STATE.md`。

## 10. 术语表（D1/D2 对齐与讲解用词对照）

> 建立：2026-09-09（D3）。来源简写：D1 = `day1-corpus-freeze-and-baseline.md`；D2 = `day2-freeze-eval-contract.md`
> §6.1；D3 = 本文件；P0 = `prompts/rag-prompt-v0.md`；M = `corpus/rules-c0a4b85/manifest.json`；
> SE = `eval/schemas/evaluation-set.schema.json`；SR = `schemas/rag-response-v1.schema.json`；
> std = 通用文本编码 / CommonMark / GitHub Flavored Markdown 标准，不构成学习契约专属决定。
>
> 用途：固定对话与设计点讲解中的用词，避免同义词漂移。本表只对齐用词与解释，**不新增已冻结语义**；
> 标"待冻结"的词只给字面用法，不给规则结论。

### 10.1 语料与快照（已冻结）

| 术语 | 定义 / 用法 | 来源 |
|---|---|---|
| corpus snapshot `rules-c0a4b85` | 以 source commit 为基线的七文件冻结语料 | M `snapshotId` |
| source commit `c0a4b85…` | snapshot 的 Git 来源基线 | M `source.commit` |
| manifest | 记录来源、normalization、逐文件路径/字节/SHA-256/Git blob；`documents` 数组顺序 = 全语料顺序候选 | M；D3 §2 |
| normalization `repository-content-v1` | scope = "Neutral wording and placeholders…"，`sourceLinePositionsPreserved: true`；**不触碰空白/换行** | M；D3 现场核查 |
| sourcePath / snapshotPath | 源仓库相对路径 / snapshot 内路径 | M |
| line_start / line_end | 基于 snapshot 文件的行号（全部 LF、无 BOM） | SE；D3 现场核查 |

### 10.2 D2 已冻结：source block / identifier / registry

| 术语 | 定义 / 用法 | 来源 |
|---|---|---|
| source block | Evidence Context 中带 source ID 的证据单元；语义粒度 = Markdown 段落或小节 | D2 §6.1 |
| 必要标题层级 / 必要表头 | 正文不能独立确定适用对象/结论时，进入模型可见内容的语境 | D2 §6.1 |
| 表格数据行 + 表头 | 每数据行成 block 并附带表头 | D2 §6.1 |
| fenced code block | 与同小节紧邻前置说明共同形成 block；只向前合并 | D2 §6.1 |
| blockquote | 容器，递归应用内部规则；source block 保留引用标记与必要标题语境 | D2 §6.1 |
| thematic break（`---`） | 不生成 block、不进入模型可见内容；仅作禁止合并的硬边界 | D2 §6.1 |
| 确定性 Markdown parser | 不调用模型，从同一 snapshot 自动重算 blocks | D2 §6.1 |
| source identifier / `source_id` | `corpus_id/source_path#Lstart-Lend`，标识核心规则冻结位置；**身份 ≠ 内容验证** | D2 §6.1 |
| `source_span` | 核心行范围，与 `source_id` 完全一致 | D2 §6.1 |
| `context_spans` | 零到多个附加语境，`role` ∈ {`heading`, `table_header`}，保持原始顺序 | D2 §6.1 |
| citation registry / `blocks` | 唯一持久化为有序 `blocks` 数组；entry 存 source_id、spans、model_content、content_sha256 | D2 §6.1 |
| blocks 排序 | manifest 文档顺序 → `line_start` → `line_end`；重复 `source_id` 验证失败；不代表 relevance | D2 §6.1 |
| `content_sha256` | 验证组装文本可重复生成，不作身份 | D2 §6.1 |

### 10.3 D3 serialization 对象（语义已冻结 2026-09-09；见 §6.1 / §6.2.0）

| 术语 | 字面用法 | 状态 |
|---|---|---|
| serialization 契约 | 从 spans 到"喂给模型的字符串"的确定性规则全集 | 已冻结；D3 唯一完成对象（§6.2.0） |
| `model_content` | 单个 block 实际提供给模型的组装文本 | 已冻结：组装顺序 + 空白/换行/缩进规则（点 1-2） |
| Evidence Context | 送入 `<EVIDENCE_CONTEXT>` 的完整串 = 有序 blocks 集合 | 已冻结（点 3/5） |
| source wrapper / block 边界 | 每个 block 携带 source ID 并与相邻 block 无歧义区分的格式 | 已冻结：XML-like（点 3） |
| hash 字节边界 | hash 对应的精确字符串、UTF-8、BOM、换行约定 | 已冻结：model_content UTF-8 全字节（点 4） |
| 保留 vs 规范化 | 对换行/空白/缩进/标记"原样进模型"或"统一到约定格式"的取舍 | 基线 A 已确认（点 2） |
| `serialized_source_blocks` | Prompt 模板里 Evidence Context 的占位输入 | P0 §2 |

### 10.4 职责边界与验证（已冻结）

| 术语 | 定义 | 来源 |
|---|---|---|
| Query | 只含当前 evaluation item 的 query | P0 §2 |
| System instructions（Prompt 正文） | 十条回答规则，不承载语料正文 | P0 §1 |
| answered / abstained | response schema 两个互斥 branch | SR |
| atomic claim + citations | 每条 claim 最小语义单元，只能引用 Evidence Context 出现的 source ID | SR；P0 |
| evidence requirement vs retrieval result | 前者 = 运行前冻结的证据标准（不进模型）；后者 = retrieval 运行输出，经 context assembly 才决定进 Evidence Context | D2 §6.1 |
| `span_id`（eval） | eval 证据位置格式，与 source_id **格式一致但语义不同** | D2 §6.1；SE |
| dev / holdout | 物理分离的两个 split，共享同一 schema；常规入口只读 dev | D2；SE |

### 10.5 字节、编码、行结构与空白（std，讲解用词）

| 术语 | 含义 | 备注 |
|---|---|---|
| byte / 字节 | 8 bit 数据单元；hash 与文件体积基于字节而非字符 | 本表词条不新增学习契约语义 |
| character / 字符 | 文本语义单元，UTF-8 下可变长（如一个中文常为 3 bytes） | std |
| UTF-8 | Unicode 的一种变长字节编码；本 snapshot 文本默认编码 | std |
| EOL（End of Line） | "行结束符"统称，决定一行在哪里结束 | std |
| LF（Line Feed） | `\n`（U+000A）；Unix/macOS/git 默认行结束符 | 本 snapshot 七文件全部为 LF（D3 现场核查） |
| CR（Carriage Return） | `\r`（U+000D）；单独出现或作为 CRLF 的前半 | std |
| CRLF | `\r\n`（U+000D + U+000A）；Windows 传统行结束符 | 本 snapshot 无 CRLF |
| BOM（Byte Order Mark） | 文件开头的 U+FEFF；UTF-8 下体现为 EF BB BF 三字节 | 本 snapshot 无 BOM（首字节即 `#`） |
| line / 行 | 以 EOL 结束或以文件结尾结束的文本单元；`Lstart-Lend` 行号基于此 | D2 行号语义 |
| blank line / 空行 | 不含非空白字符的行；Markdown 中常作块级分隔 | std |
| whitespace / 空白 | 空格、tab、换行等不可见字符总称 | std |
| space / tab | 空格（U+0020）/ 制表符（U+0009）；两者宽度语义可能不同 | std |
| indentation / 缩进 | 行首空格或 tab；普通排版缩进与 fenced code / 列表内语义缩进不同 | 设计点 2 子规则对象 |
| trailing whitespace / 行尾空白 | 行末 EOL 前的空格/tab；对语义通常无关但对 hash 字节敏感 | 设计点 2 子规则对象 |

### 10.6 Markdown 块级结构词条（std；D2 已冻结切分决定）

| 术语 | 含义 | D2/本阶段用法 |
|---|---|---|
| paragraph / 段落 | 连续非空行文本块 | source block 基本语义粒度 |
| heading / 标题 | `#` 起行，含层级 | 可作 `context_spans`（role=`heading`） |
| list item / 列表项 | `-` / `1.` 等起行，可嵌套 | 顶层列表项独立成 block，嵌套跟随父项 |
| fenced code block | ``` 围栏包裹的代码块；首行后可选语言标识 | 与紧邻前置说明共同成 block |
| info string | fenced code 开围栏上的可选语言标识 | 围栏与 info string 原样进入 model_content（点 2 已确认保留） |
| blockquote | `>` 前缀的引用容器 | source block 保留引用标记（D2 已定） |
| thematic break | `---` 等水平分隔 | 不进入模型可见内容，仅硬边界（D2 已定） |
| table / 表格行 + 表头 | GFM 表格；数据行各自成 block 并附带表头 | 表头可作 `context_spans`（role=`table_header`） |

### 10.7 处理动作与组装概念（D3 待冻结或通用工程词）

| 术语 | 字面含义 | 状态 |
|---|---|---|
| preserve / 保留 | 源文本字节原样进入 `model_content` | 基线 A 下为例外清单行为 |
| normalize / 规范化 | 把同类排版差异统一到约定格式（统一 LF、去行尾空白等） | 基线 A 默认行为 |
| collapse / 折叠 | 连续多个同类空白（如空行）收敛为一个 | 已确认：连续空行折叠为 1 个空行（点 2） |
| serialization / 序列化 | 把结构化对象（spans / registry entry）转换成确定字节串 | D3 主线 |
| wrapper / 边界格式 | 包裹单个 block、把 source ID 与正文绑定的外层格式 | 已冻结：XML-like（点 3） |
| delimiter / 分隔符 | 区分相邻 block / 字段的标记字符序列 | 已冻结：wrapper 标签 + 块间一个空行（点 3） |
| hash 字节边界 | `content_sha256` 计算依据的精确字节串范围与编码/换行约定 | 已冻结：model_content UTF-8 全字节（点 4） |
| token / tokenizer estimate | 模型词汇切分单元与离线估算（raw corpus-only = 18,697 estimated tokens） | D1；serialized 计量待 D3 后 |
