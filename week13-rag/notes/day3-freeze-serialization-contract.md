# W13 D3 学习计划：冻结 `model_content` 与 Evidence Context serialization 契约

> 日期：2026-09-09（Asia/Shanghai）
>
> 状态：执行中。本人已明确进入 D3；设计点 1 已确认，设计点 2-6 尚待逐项确认。
>
> 协作模式：AI Engineer 分阶段模式。本人冻结 serialization 的语义、边界和自动验证判据；AI 先解释当前
> 设计点，语义确认后只做结论合并、示例排版和 hash 等机械记录。本阶段不实现 parser。

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
| 2 | Markdown 与空白 | 换行、空白、缩进、fenced code 和 blockquote 标记的保留或规范化规则 | 当前唯一活动设计点 |
| 3 | source wrapper 与边界 | 每个 block 的 wrapper、source ID 位置和相邻 block 分隔格式 | 待设计点 2 确认 |
| 4 | hash 字节边界 | hash 精确字符串、UTF-8 编码、BOM 与换行约定 | 待设计点 3 确认 |
| 5 | 全语料输入职责 | block 顺序，以及 Query、Prompt、Evidence Context 的职责边界 | 待设计点 4 确认 |
| 6 | 自动验证判据 | 逐字节一致、无遗漏/重复、来源可回读、hash 可重算 | 待设计点 5 确认 |

## 6. 执行顺序

### 6.1 冻结设计点 2-6

- 一次只处理表中当前活动设计点。
- 本人回答含糊或同时包含多个可独立变化的规则时，先拆分，不把多个结论一次确认。
- 新决定与 D2 的 source block、identifier 或 registry 契约冲突时立即停止；先说明冲突对象和影响，再决定
  是否修订上游契约。
- 每个确认结果直接合并到本文件的规范结论区，不保存逐轮问答日志。

### 6.2 建立最终规范与排除示例

六点全部确认后，AI 可以机械完成：

- 把确认结果整理为单一规范段落，删除被后续决定替代的中间表述。
- 增加至少一个单 block 和一个双 block 的合成 fixture，明确标注不进入正式 corpus、registry 或 eval。
- 按已确认的编码与字节边界计算合成 fixture 的期望 hash。
- 建立“输入条件 -> 期望字符串/字节 -> 验证判据”对应表，供 D4 实现测试使用。

### 6.3 静态一致性复核

不写 parser 的前提下检查：

- `model_content` 顺序与 D2 的 `context_spans` role、核心 `source_span` 一致。
- wrapper 中可返回的 source ID 与 registry 的 `source_id` 完全一致。
- Evidence Context 外层格式不与 Prompt 已冻结的 `<EVIDENCE_CONTEXT>` / `<QUERY>` 职责冲突。
- 全语料顺序与 manifest、registry 排序规则一致，不引入 relevance 排序。
- hash 规则只覆盖本人确认的精确字符串，不把未冻结的运行元数据混入。

## 7. D3 完成条件

以下条件必须全部满足：

- [x] 设计点 1 已确认并记录。
- [ ] 设计点 2：Markdown 与空白规则已确认。
- [ ] 设计点 3：source wrapper、source ID 和 block 边界已确认。
- [ ] 设计点 4：hash 字符串边界、UTF-8 与换行约定已确认。
- [ ] 设计点 5：全语料顺序及 Prompt/Query/Evidence Context 职责已确认。
- [ ] 设计点 6：自动验证判据已确认。
- [ ] 最终规范不存在 `待定`、互相冲突或依赖实现者自行选择的分支。
- [ ] 排除示例覆盖单 block、双 block 和至少一个含附加语境的 block。
- [ ] 本人能解释 source ID 与 content hash 的职责差异，并预测修改一个标题或换行会影响哪些值。
- [ ] `week13-plan.md` 与 `LEARNING-STATE.md` 已按最终结论机械同步。

**D3 验收句**：给定冻结 manifest、一个合法 registry entry 集合和 Query，规范能够唯一确定每个
`model_content`、完整 Evidence Context，以及契约指定 hash 对象的精确字节；后续实现者不需要新增语义决定。

## 8. 止步条件与明确不做

- 任一设计点没有得到本人明确确认时，D3 保持执行中，不进入 parser 实现。
- 规范仍允许两种合法字符串结果时，自动验证契约尚未闭合，不能判定 D3 完成。
- 不创建正式 citation registry，不生成正式 source blocks。
- 不实现或选择 Markdown parser 库。
- 不开始完整 assembled input token 计量或 context budget。
- 不修改模型客户端，不运行模型、baseline、dev generation 或 holdout。
- 不开始 LangChain `Document` 接线、BM25、chunking、dense retrieval、ranking 或 Agent。
- 不制作展板，不 commit、push 或 merge。

## 9. 下一入口

当前只处理设计点 2：换行、空白、缩进、fenced code 和 blockquote 标记的保留或规范化规则。确认后先将
结论合并到本文件，再进入设计点 3。
