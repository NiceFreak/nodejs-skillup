# W13 serialization 自动验证判据 #1–#7 确认清单（已确认）

> 建立：2026-09-09（D3）。性质：**已确认（2026-09-09，本人逐条通过，无修改项）**；一次性暂存文件，
> 判据逐字已并入 `day3-freeze-serialization-contract.md` §6.1（设计点 6 追认），本文件可删除。
>
> 全部确认日期：2026-09-09。判据 3 保留 `<source` 前缀守卫：不含 `>` 为有意设计，
> 同时拦截 `<source>`、`<source id=…>` 及任何以 `<source` 开头的正文；与 day3 §6.1
> wrapper 冲突处理（2026-09-09）一致。
>
> 命名说明：按用途命名（serialization 自动验证判据确认清单），不使用日期序号前缀——它不是某一天的每日笔记。
>
> 背景：D3 §6.1 设计点 6 只落盘了七条判据的分类（1–2 正文与 hash、3 wrapper 层、4–6 组装层与稳定、7 职责边界）和 §6.2.2 的 fixture 覆盖映射，**逐字原文未落盘**。本文件把还原文字整理为可确认清单；判据语义在 AI Engineer 阶段归本人冻结，AI 只做整理与执行证据，不代填。
>
> 使用方式：逐条看「还原文字草案」→ 同意勾 `[x]`；不同意直接改文字并勾「已修改」。全部确认后，真实全语料 Evidence Context 整串 sha256 `8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b` 才冻结为 regression 基准。
>
> 依据：day3 §6.2.0 单一规范、§6.2.1 fixture、§3.3 验证关系表、§6.3 静态复核；day2 §6.1 source block / registry 契约。
> 已执行证据：`tests` 9 passed（fixture A/B/C + 真实语料不变式）；`evidence/serialization/`（registry 572 blocks、evidence-context txt / sha256、criteria-report）。

## 判据 1 — 正文组装（分类：抓正文与 hash）

- **还原文字草案**：单个 block 的 `model_content` 只由登记 spans 按「heading 由外到内 → table_header → 核心 source_span」顺序逐字组装；span 边界不额外插入或删除换行；正文行规范化符合 §6.2.0 #2（LF、行尾空白、空行、缩进、fence/blockquote 例外）；缺失层级省略。
- **观察什么**：block 的 `model_content` 字节与 registry 中登记的 spans、顺序、角色是否一致。
- **为什么是判据**：hash 只证明「同一对象没变」，无法证明「正文确实由登记 spans 正确组装」；顺序/规范化错会直接改变模型看到的证据与引用对应关系。
- **已执行证据**：fixture A/C 期望 repr 全对；572 个 entry 已按 §6.2.0 顺序组装。
- 确认状态：- [x] 确认 / - [ ] 已修改

## 判据 2 — content hash（分类：抓正文与 hash）

- **还原文字草案**：`content_sha256` = SHA-256(`model_content` 的 UTF-8 全字节)；读取源文件剥 BOM；整串原样不裁剪不追加；末尾是否含 LF 以实际字节为准。
- **观察什么**：每个 entry 的 `content_sha256` 与重新计算值一致，且 hash 对象不含 wrapper/组装层/运行元数据。
- **为什么是判据**：hash 是完整性指纹与 regression 锚点；算错对象会让「内容未变」的声明失效。
- **已执行证据**：fixture 期望 hash（A `3ffb…cfcb`、B2 `46c9…af6`、C `4591…9293`）全对；572 entries 逐条复算通过。
- 确认状态：- [x] 确认 / - [ ] 已修改

## 判据 3 — source wrapper 与 source_id 绑定（分类：抓 wrapper 层）

- **还原文字草案**：单 block 字节 = `<source id="{source_id}">` + LF + `model_content` + `</source>`（开闭标签独立成行、id 双引号）；`source_id` 行范围 === 核心 `source_span`；附加语境（heading/table_header）不扩大 identifier 行范围；block 正文不得含字面 `<source`/`</source>`。
- **观察什么**：wrapper 字节、id 与核心 span 一致性、context_spans 不进 identifier。
- **为什么是判据**：wrapper 是模型与机械回读区分 block 边界的唯一信号；id 与正文脱绑会让 citation 无法回源，context 混入 identifier 会让引用指向错误行范围。
- **已执行证据**：fixture A/B/C serialized block repr 全对；`#L5-L5` 仅标核心行；构建对 wrapper 前置条件强制失败。
- 确认状态：- [x] 确认 / - [ ] 已修改

## 判据 4 — Evidence Context 顺序与块间分隔（分类：抓组装层）

- **还原文字草案**：Evidence Context = 有序 serialized blocks：manifest 文档顺序 → 核心 `line_start` → `line_end`（不代表 relevance）；相邻 block 之间恰一个空行；首尾无额外空行；空 blocks 输入输出空串。
- **观察什么**：整串的块序、块间分隔字节、首尾字节。
- **为什么是判据**：顺序混入 relevance 或分隔符错会让 baseline 与 retrieval 对照不公平、边界变歧义；这些错误 content hash 全部抓不到，必须字节级比对。
- **已执行证据**：fixture B 双 block 整串与整串 sha256 `0c27…a497` 全对；真实整串 sha256 `8a02c665…` 已记录。
- 确认状态：- [x] 确认 / - [ ] 已修改

## 判据 5 — 完整性：无遗漏、无重复、来源可回读（分类：抓组装层与稳定）

- **还原文字草案**：每条非空非结构性正文行至少属于一个 block 的核心 `source_span`，且不重复属于两个 core；`source_span`/`context_spans` 行范围都能从冻结 snapshot 回读原文；重复 `source_id` 使构建失败。
- **观察什么**：per-document 覆盖审计（uncovered/duplicated 为空）、registry 无重复 source_id。
- **为什么是判据**：parser 静默吞掉一条规则是 RAG 最危险的失败（模型缺证据却可能照答）；重叠/重复会令 citation 指向两个对象。
- **已执行证据**：7 文件 uncovered=0、duplicated_core=0；registry 572 entries 无重复 source_id。
- 确认状态：- [x] 确认 / - [ ] 已修改

## 判据 6 — 稳定重跑（分类：抓组装层与稳定）

- **还原文字草案**：同一 snapshot 连续两次构建，registry 与 Evidence Context 整串逐字节一致；真实全语料整串首次产出后冻结为独立 regression 基准（不进 registry 契约字段，作运行期基准记录）。
- **观察什么**：两遍构建的整串 sha256、entries 数量与逐条 hash。
- **为什么是判据**：任何非确定性（dict 顺序、时间戳、环境路径）都会让同 snapshot 产出不同模型输入 → eval 对比与回归全部失真。
- **已执行证据**：CLI two-pass byte-identical=True；整串 sha256 已落 `evidence-context-rules-c0a4b85.sha256`。
- 确认状态：- [x] 确认 / - [ ] 已修改

## 判据 7 — 职责边界（分类：抓职责边界）

- **还原文字草案**：Evidence Context 内不含块数汇总、版本号或任何运行元数据；Prompt 只定义回答规则、不承载语料正文；Query 只含当前 evaluation item 的 query；reference answer / expected branch / evidence requirement 不进入模型输入；`content_sha256` 只作完整性验证、不作身份（身份 = source_id 位置）。
- **观察什么**：Evidence Context 组成、Prompt/Query 输入边界、registry 字段语义。
- **为什么是判据**：金标/证据标准泄漏会让 eval 虚高；身份与内容指纹混淆会导致「内容没变但位置变了」与「位置没变但内容变了」两类风险无法区分。
- **已执行证据**：结构检查 + §6.3 静态复核记录；此项含静态复核引用，属待本人文字确认项。
- 确认状态：- [x] 确认 / - [ ] 已修改

---

## 收口记录（2026-09-09）

- [x] 七条判据已由本人逐条确认（无修改项；判据 3 保留 `<source` 前缀守卫，理由见文件头）。
- [x] 真实全语料 Evidence Context 整串基准 sha256 `8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b`
      已冻结为运行期 regression 基准：`evidence/serialization/frozen-rules-c0a4b85.sha256`。
- [x] 判据逐字已并入 `day3-freeze-serialization-contract.md` §6.1（设计点 6 追认记录）；
      `LEARNING-STATE.md` 已同步。
