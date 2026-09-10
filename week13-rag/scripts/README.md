# W13 RAG 脚本导读（`week13-rag/scripts/`）

> 建立：2026-09-09（Asia/Shanghai）。职责：说明这两个脚本各自解决什么问题、什么时候跑哪一条、
> 输出的每个字段代表什么、退出码判了什么和没判什么，以及失败时先查哪里。
>
> 分工：`src/w13rag/README.md` 是**包导读**，服务读代码（模块职责、数据流、Python→TS 映射）；
> 本文件是**脚本导读**，服务执行与结果判读。契约语义见
> `notes/day3-freeze-serialization-contract.md` §6.2.0 与 `notes/serialization-criteria-confirm-checklist.md`，
> 本文件不复述契约，也不替代它们。

## 1. 两个脚本的职责

| 脚本 | 解决什么问题 | 不解决什么 |
|---|---|---|
| `w13rag.sh` | 跑测试、构建 registry 与 Evidence Context、把证据落盘、与冻结基准比对 | 不调用模型；不做 retrieval；不判断切分语义是否合理 |
| `inspect-block.sh` | 按 `source_id` 打印单个 registry entry 的 span、语境与 `model_content` | 不修改任何文件；不解释该块切得对不对 |

两个脚本都只读 `corpus/rules-c0a4b85` 与 `evidence/serialization/`，不读取 eval 的受保护 split。

## 2. 前置条件

- **解释器**：默认 `../week12-python-rag/.venv/bin/python`（W12 的 Python 3.12 venv）。
  该路径不存在时脚本立即报错退出，不会退回系统 Python。用 `W12_PYTHON=/path/to/python` 覆盖。
- **工作目录**：脚本自己解析仓库内路径，可以从任意目录调用；下文示例统一写在 `week13-rag/` 下执行。
- **落盘位置**：`w13rag.sh build` 固定写入 `evidence/serialization/`，不接受输出目录参数。
  需要写到别处时直接调用模块：
  `PYTHONPATH=src <python> -m w13rag.cli build --snapshot-root corpus/rules-c0a4b85 --out-dir <dir>`。

## 3. 我要做什么 → 跑哪一条

| 我要做的事 | 命令 | 判定标准 |
|---|---|---|
| 改了 parser / serialize，想知道有没有破坏契约 | `./scripts/w13rag.sh test` | pytest 9 passed；任一红即契约被破坏 |
| 想重新生成 registry 与 Evidence Context 证据 | `./scripts/w13rag.sh build` | 读输出的 6 个字段，不只看退出码（见 §5） |
| 改完代码要一次跑完 | `./scripts/w13rag.sh check` | 先 test 后 build，前者失败即停 |
| 想确认磁盘产物没过期、且与冻结基准一致 | `FROZEN_SHA256=evidence/serialization/frozen-rules-c0a4b85.sha256 ./scripts/w13rag.sh verify` | 打印 `OK` 且退出码 0 |
| review 时想看某个 block 实际长什么样 | `./scripts/inspect-block.sh <source_id>` | 与自己的预测逐字节对照 |

## 4. 逐命令：输入、退出码、判什么

| 命令 | 输入 | 退出码 0 表示 | 非零来自 |
|---|---|---|---|
| `test` | `tests/` + `src/` | 5 条 fixture 字节/hash 回归 + 4 条真实语料不变式全过 | pytest 失败 |
| `build` | manifest + 7 份快照文档 | 构建完成并写出 4 个证据文件 | snapshot 目录缺失；重复 `source_id`；正文含字面 `<source` / `</source>`（wrapper 前置条件） |
| `check` | 同上 | test 与 build 依次完成 | 其中任一步失败（`set -e`，前者失败不再执行后者） |
| `verify` | 快照 + `evidence/serialization/` 产物（+ 可选冻结基准） | 内存重建与全部给定参照一致 | 产物缺失或不一致；冻结基准缺失或漂移；任一文档存在 uncovered / duplicated 行 |
| `inspect-block.sh` | `source_id` + registry JSON | 找到该 entry 并打印 | 未传 `source_id`；registry 文件不存在；`source_id` 不在 registry 中 |

**退出码没有覆盖的两件事**（源码依据：`cli.py` `run()` 只把结果写进 summary 并打印）：

1. `rerun: byte-identical=False` 不会让 `build` 以非零退出码结束。非确定性只出现在输出文字里，必须人读。
2. `uncovered` / `duplicate` 不为 `none` 时 `build` 照常写出产物；只有 `verify` 会因此 FAIL。

因此 `build` 的判定标准是**读那 6 个字段**，不是「命令没报错就算过」。是否要把这两项收紧为 `build` 直接失败，
属于验证严格度的取舍，留给本人决定。

## 5. 输出字段解读

### 5.1 `build` / `check`

```text
=== serialization evidence build ===
snapshot : rules-c0a4b85  corpus=rules
blocks   : 572
rerun    : byte-identical=True
context  : chars=89854 sha256=8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b
uncovered: none
duplicate: none
wrote registry: registry-rules-c0a4b85.json
wrote evidence_context: evidence-context-rules-c0a4b85.txt
wrote sha256: evidence-context-rules-c0a4b85.sha256
wrote report: criteria-report-rules-c0a4b85.md
```

| 字段 | 含义 | 异常值意味着什么 |
|---|---|---|
| `snapshot` / `corpus` | 本次产物绑定的冻结语料身份 | 与预期快照不符时，后面所有数字都不属于当前实验 |
| `blocks` | 全部文档切出的 source block 总数 = registry entries 数 | 改了 parser 后数值变化即切分行为变化，需回到契约核对是否允许 |
| `rerun` | 进程内独立构建两遍，整串逐字节比较 | `False` = 存在非确定性，产物不能作为 baseline 或 retrieval 输入（判据 #6） |
| `context` | 全语料 Evidence Context 的字符数与整串 sha256 | sha256 变化即模型将看到的输入变化；与冻结基准比对属 `verify` 的职责 |
| `uncovered` | 有没有「非空、非结构性」正文行落在所有 block core 之外 | 不为 `none` = 有规则正文没有进入任何可引用块（静默丢失） |
| `duplicate` | 有没有同一行同时属于两个 block core | 不为 `none` = 同一句话有两个引用身份 |
| `wrote *` | 四个落盘证据文件 | 缺项说明构建中断 |

`chars` 的单位是字符，不是 token，也不是 bytes；三者不能互相换算。

### 5.2 `verify`

```text
=== serialization verify ===
snapshot : rules-c0a4b85
fresh    : blocks=572 sha256=8a02c665…
on-disk  : sha256=8a02c665…  matches fresh=True
frozen   : sha256=8a02c665…  matches fresh=True
OK: fresh build matches all provided references.
```

- `fresh`：用当前代码 + 当前快照重新计算的内存结果，是比对的基准点。
- `on-disk`：现存 `evidence-context-*.txt` 与 fresh 是否一致。`False` 说明磁盘产物是旧代码留下的残留。
- `frozen`：只在传入 `FROZEN_SHA256` 时出现。漂移即回归失败——这一行才是真正的回归检查。
- 三者任一不一致，输出 `FAIL:` 加逐条原因，退出码 1。

## 6. 失败症状 → 先查哪里

| 症状 | 先查 | 原因 |
|---|---|---|
| `ERROR: venv python not found` | `W12_PYTHON` 或 W12 venv 是否存在 | 脚本不退回系统 Python，避免用错解释器产生「能跑但不是同一环境」的结果 |
| `missing on-disk artifact: …txt (run build first)` | 是否先跑过 `build`，或 out-dir 是否指错 | `verify` 不会替你构建 |
| `on-disk … matches fresh=False` | 磁盘产物是否由当前代码生成 | 典型是改了代码只跑 `verify` 没跑 `build` |
| `frozen … matches fresh=False` | 本次代码或快照改动是否属于有意变更 | 有意变更需要按冻结纪律重新冻结基准，不是直接覆盖 |
| `duplicate source_id: …` | parser 是否对同一行范围产出了两个块 | registry 拒绝静默覆盖 |
| `wrapper precondition violated in …` | 该块正文是否含字面 `<source` / `</source>` | 前缀守卫，防止正文伪装成 wrapper 标签 |
| `not found: <source_id>` | 该行是否本来就不是 core | 例：`rules/AGENTS.md#L1-L1` 是 H1 标题，它只作 `heading` 语境，不单独成块 |

## 7. `inspect-block.sh` 与 review 步骤 B

用法（第二个参数可指定其它 registry）：

```bash
./scripts/inspect-block.sh 'rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50'
./scripts/inspect-block.sh '<source_id>' path/to/registry.json
```

它服务 `notes/serialization-implementation-review-worksheet.md` 步骤 B 的「预测 → 实测」：
先用 `sed -n` 读源文档对应行、写下对 `source_span` / `context_spans` / `model_content` 的预测，
再用本脚本对照。**先预测再看输出**，否则这一步不产生理解证据。

`source_id` 含 `#`，在 shell 中要加引号，否则 `#` 之后被当作注释。

## 8. 产物文件各自的职责

| 文件 | 职责 |
|---|---|
| `registry-rules-c0a4b85.json` | citation registry：572 个 entry 的 `source_id` / spans / `model_content` / `content_sha256` |
| `evidence-context-rules-c0a4b85.txt` | 全语料 Evidence Context 整串，即将进入 Prompt 的实际字符串 |
| `evidence-context-rules-c0a4b85.sha256` | 上一份整串的 sha256 运行记录，随每次 build 更新 |
| `criteria-report-rules-c0a4b85.md` | per-document 覆盖审计 + block 分类统计的执行事实报告 |
| `frozen-rules-c0a4b85.sha256` | **冻结回归基准**，不随 build 更新；只有按冻结纪律显式重冻结时才改 |

前四个是每次 build 的当前产物，第五个是基准。`verify` 的价值来自第五个存在且不被随手覆盖。

## 9. 边界

- 全绿只证明**确定性组装层**可重跑、无遗漏、无重复、与基准一致；不证明 source block 的语义边界合理，
  不证明 retrieval 有效，也不证明模型回答正确。语义边界质量由后续 dev eval 暴露（D2 声明）。
- 这些脚本不调用模型，输出中的任何数字都不是 provider usage。
- `context: chars` 与 `token` 是不同计量；serialized 输入的 token 计量截至 2026-09-09 未执行。

## 10. 本文档的验证证据

本文档的命令形态、字段与退出码于 2026-09-09 在容器环境实跑核对，全部输出为实测：

- 环境：Python 3.11.15（**不是**开发机的 W12 3.12 venv），通过 `PYTHONPATH=src python3 -m w13rag.cli`
  直接调用模块；`--out-dir` 指向仓库外的临时目录，未改动 `evidence/serialization/` 任何文件
  （复核方式：跑完后 `git status --short` 无输出）。
- `build`：blocks=572、`rerun byte-identical=True`、chars=89854、sha256 `8a02c665…`、uncovered 与
  duplicate 均为 none —— 与 `frozen-rules-c0a4b85.sha256` 一致。
- `verify`：`on-disk` 与 `frozen` 均 `matches fresh=True`，打印 `OK`，退出码 0。
- `verify` 的 FAIL 形态：out-dir 指向不存在目录时输出
  `missing on-disk artifact: evidence-context-rules-c0a4b85.txt (run build first)`，退出码 1。
- `inspect-block.sh`：`rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50` 返回 3 条 `context_spans`
  （heading L1、heading L41、table_header L46-L47），与 review 工作表附录的实测参考一致；
  `rules/AGENTS.md#L1-L1` 返回 `not found` 并以退出码 1 结束。

这组结果同时说明整串结果在另一个 Python 次要版本上可复现；这是一次交叉核对，不替代开发机 venv 上的正式运行。
`test` 子命令未在本环境执行（容器内无 pytest 与 W12 venv），其判定标准按 §4 表所列，来自源码与既有
`notes/` 执行记录。

## 11. 关联文档

| 文档 | 关系 |
|---|---|
| `src/w13rag/README.md` | 包导读：模块职责、数据流、Python→TS 映射 |
| `notes/day3-freeze-serialization-contract.md` §6.2.0 | serialization 单一规范，脚本执行的就是它 |
| `notes/serialization-criteria-confirm-checklist.md` | 判据 #1–#7 逐字与它们各自的观察对象 |
| `notes/serialization-implementation-review-worksheet.md` | review 工作表；步骤 B 与 C 直接调用这两个脚本 |
| `evidence/serialization/criteria-report-rules-c0a4b85.md` | 最近一次 build 的执行事实报告 |
