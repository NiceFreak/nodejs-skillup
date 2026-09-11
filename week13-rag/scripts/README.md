# week13-rag/scripts 导读（运行入口与安全边界）

> 更新：2026-09-11。范围：本目录 15 个入口（13 个 Python、2 个 shell）。
> 姊妹文档：包内模块职责见 [`../src/w13rag/README.md`](../src/w13rag/README.md) 与
> [`../notes/rag-implementation-guide.md`](../notes/rag-implementation-guide.md)。
>
> 本文回答四个问题：**这个脚本做什么、需要什么输入、会写什么、以及它会不会调用模型或触碰受保护内容。**
> 命令统一从 `week13-rag/` 执行。Python 入口的解释器要求见 §1.1（部分脚本可用系统 `python3`，其余必须用仓库内
> `week13-rag/.venv`）；两个 shell 入口默认复用上一阶段的 venv，可用 `W12_PYTHON` 覆盖。

## 1. 先看安全属性（决定能不能随手运行）

| 脚本 | 调用外部模型 | 读取受保护 `eval/holdout/` | 写入位置 |
|---|---|---|---|
| `w13rag.sh` | 否 | 否 | `evidence/serialization/` |
| `inspect-block.sh` | 否 | 否 | 无（只打印） |
| `verify-a1-a8.py` | 否 | 否 | 无（只打印，退出码 0/1） |
| `verify-e5-onnx.py` | 否 | 否 | 无（只打印） |
| `verify-dense-langchain-equiv.py` | 否 | 否 | 无（只打印） |
| `measure-input-budget.py` | 否 | 否 | `evidence/input-budget/` |
| `rescore-baseline.py` | 否 | 否 | 仅 `--out` 指定的文件 |
| `run-retrieval-eval.py` | 否 | 否 | `evidence/retrieval/`（默认）或 `--out` |
| `build-semantic-worksheet.py` | 否 | **视证据所属 split**：holdout 证据会读取 holdout 题集 | `notes/`（默认按 split 选文件）或 `--out` |
| `prescreen-r1-coverage.py` | 否 | 否（读取调用者传入的证据文件） | `notes/` 或 `--out` |
| `demo-replay.py` | 否 | 否 | 无（只打印；`verify` 只做离线重算） |
| `run-dev-baseline.py` | **是** | 否 | `evidence/baseline/` |
| `run-bm25-e2e.py` | **是** | 否 | `evidence/bm25-e2e/` |
| `run-dense-langchain-e2e.py` | **是** | 否 | `evidence/dense-langchain-e2e/` |
| `run-holdout-eval.py` | **是** | **是**（唯一允许的通道） | `evidence/holdout/`（含题面） |

三条纪律：

1. **会调用模型的只有 4 个 `run-*.py`**。它们会产生真实费用与外部请求，运行前需要明确授权与目的。
   `run-holdout-eval.py` 另有额外门槛：只在实现与评分全部冻结后用于**首次**运行，结果不得反向用于调参。
2. **受保护内容只有一条通道**。`eval/holdout/` 只由 `run-holdout-eval.py` 读取，且该脚本终端不回显题面。
   由它产生的 `evidence/holdout/` 与 holdout 判定素材同样含题面，只由有权阅读者处理。
3. **离线脚本不连接网络**。`demo-replay.py`、`verify-*.py`、`rescore-baseline.py`、`prescreen-r1-coverage.py`
   都可以在断网环境运行；这也是演示现场的首选路径。

### 1.1 解释器约定（按实际执行核对）

不同入口的依赖不同，用错解释器会直接 `ModuleNotFoundError`。下表是逐条实跑核对的结论：

| 可用系统 `python3` | 必须用 `week13-rag/.venv/bin/python` |
|---|---|
| `demo-replay.py summary` / `case`、`verify-a1-a8.py`、`prescreen-r1-coverage.py`、`build-semantic-worksheet.py` | 全部 `run-*.py`、`rescore-baseline.py`（缺 `httpx`）、`measure-input-budget.py`（缺 `tokenizers`）、`verify-e5-onnx.py`（缺 `numpy`）、`verify-dense-langchain-equiv.py`（缺 `httpx`）、`demo-replay.py verify` |

两个 shell 入口默认调用上一阶段的 venv（`W12_PYTHON` 可覆盖），因此 `./scripts/w13rag.sh ...` 与
`./scripts/inspect-block.sh ...` 不需要额外指定解释器。

## 2. 构建与离线校验（不调用模型）

### `w13rag.sh` — 输入处理统一 CLI

| 子命令 | 做什么 |
|---|---|
| `test` | pytest：fixture 回归 + parser 切分 + 真实语料不变式 + 检索/评分 |
| `build` | 构建 registry、完整 Evidence Context 与审计产物，写入 `evidence/serialization/` |
| `check` | `test` + `build` + 冻结基准比对（一键全量） |
| `verify` | 内存重跑并与 on-disk 产物比对；`FROZEN_SHA256=...` 时再对冻结基准 |
| `guard` | 判定入口护栏：入口文件必须引用冻结契约，且不得重述判定规则 |

输出段 `=== serialization evidence build ===` 的逐项含义见脚本头部注释；判断「有没有静默丢规则」看
`uncovered: none` 与 `duplicate: none`。

### `inspect-block.sh` — 查单个 source block

```bash
./scripts/inspect-block.sh rules/AGENTS.md#L47-L58          # 默认 registry
./scripts/inspect-block.sh rules/AGENTS.md#L47-L58 path/to/registry.json
```

打印该 entry 的 `source_span` / `context_spans` / `model_content`，用于核对「引用到底指向什么」。

### `verify-a1-a8.py` — serialization 不变式复核

只读冻结 snapshot 与内存对象，验证 review 清单 A1–A8 的不变式，失败项打印 `FAIL` 并以退出码 1 结束。

```bash
python3 scripts/verify-a1-a8.py
```

### `verify-e5-onnx.py` — dense 前置验证

核对 ONNX provider 与输出维度（384）、全语料 572 块的最长 token 数（判断 512 截断是否触发）、
「相关块 vs 无关块」的相似度，以及 `query: ` / `passage: ` 前缀对向量的影响。不访问外部 API。

```bash
.venv/bin/python scripts/verify-e5-onnx.py
```

### `verify-dense-langchain-equiv.py` — LangChain 接线等价性

对同一批查询跑两条 dense 路径（LangChain 接线与既有 `dense_retrieve`），核对 top-10 的**顺序与集合**；
对全量块做排序检查，分数差超过阈值的相邻对顺序必须一致；结束前核对冻结对象（向量缓存、缓存身份、registry、
manifest、既有检索证据）hash 未变。

```bash
.venv/bin/python scripts/verify-dense-langchain-equiv.py
```

### `measure-input-budget.py` — 完整输入容量计量

按冻结口径对每条 query 组装完整请求（system instructions + 完整 Evidence Context + query）并逐条估算，
取最大占用作为门禁值（可用上限 895,904 tokens = 1,000,000 − 4,096 − 100,000）。产物写入
`evidence/input-budget/`。**离线估算值记为 estimate；真实调用的 provider usage 是另一份运行证据，两者不可互换。**

```bash
.venv/bin/python scripts/measure-input-budget.py
```

### `rescore-baseline.py` — 用当前评估层重评旧证据

读取已落盘的 baseline 证据，用当前的 `run` / `evaluators` / `verdict` 三层重新计算机械结论并打印新结构结果。
不调用模型、不覆盖旧证据；`--out` 省略时只打印。它经 `w13rag.generation` 读取题集，因此必须用 venv 解释器。

```bash
.venv/bin/python scripts/rescore-baseline.py --evidence evidence/baseline/dev-full-context-prompt-v1-01.json
```

## 3. 检索评估（不调用模型）

### `run-retrieval-eval.py` — BM25 / dense / hybrid 同口径对照

```bash
.venv/bin/python scripts/run-retrieval-eval.py --backend bm25   --k 10 --out evidence/retrieval/dev-bm25-top10-02.json
.venv/bin/python scripts/run-retrieval-eval.py --backend dense  --k 10 --out evidence/retrieval/dev-dense-top10-01.json
.venv/bin/python scripts/run-retrieval-eval.py --backend hybrid --k 30 --out evidence/retrieval/dev-hybrid-top30-01.json
```

- `--backend` 取 `bm25` / `dense` / `hybrid`（默认 `bm25`），`--k` 为 `top_k`，`--out` 省略时按
  `evidence/retrieval/dev-<backend>-top<k>.json` 命名。
- 三个后端共用同一命中判定与聚合函数（`retrieval.evaluate_item_retrieval`），差异只在打分方式；
  dense 与 hybrid 额外记录性能项（provider、batch、截断、冷启动、吞吐、查询延迟、峰值内存）与缓存身份。
- 已记录的九组证据使用**显式 `--out` 带序号文件名**，因此历史版本都保留；默认命名会覆盖同名文件，重跑请显式指定。
- 只读冻结 registry 与 `eval/dev/`，不读 holdout，不调用生成模型。

## 4. 生成与端到端（**会调用外部模型**）

这四个入口都复用 `generation.assemble_messages()` 与同一套 response schema，差别只在「哪些内容进入 Context」。

### `run-dev-baseline.py` — 全语料上下文基线

```bash
.venv/bin/python scripts/run-dev-baseline.py --limit 1 --out evidence/baseline/smoke-dev-01.json
.venv/bin/python scripts/run-dev-baseline.py            # 默认 10 条，输出名带 UTC 时间戳
```

跳过检索，把完整 Evidence Context 交给模型；每题落盘请求侧配置、服务端身份、provider usage、延迟、原始响应，
以及 `run` / `evaluators` / `verdict` 三段评估。人工语义未填时对应评估器为 `passed=None`（pending），
**但 pending 不会掩盖已确定的失败**：机械失败足以否决 split 时仍记 `split_status=fail`。

### `run-bm25-e2e.py` — BM25 端到端链路

```bash
.venv/bin/python scripts/run-bm25-e2e.py --k 10 --out evidence/bm25-e2e/dev-bm25-e2e-top10-01.json
```

链路：query → BM25 检索 → context 组装 → 一次生成 → 评分与 evidence。
**用途是「链路可以独立重复运行」的证据，不是质量验收**；它与全语料基线是不同输入集合，失败项不同也不能比较优劣。

### `run-dense-langchain-e2e.py` — dense（LangChain 接线）端到端链路

```bash
.venv/bin/python scripts/run-dense-langchain-e2e.py --k 10 --out evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10.json
```

与 BM25 端到端同题、同 `top_k`、同 Prompt / schema / 客户端配置、同组装函数；唯一差异是检索实现
（LangChain 向量库 + 项目层排序）。向量来自冻结缓存（不重算），查询侧向量现算。同样只作链路证据。

### `run-holdout-eval.py` — holdout 入口（唯一通道）

```bash
.venv/bin/python scripts/run-holdout-eval.py --out evidence/holdout/dev-holdout-prompt-v1-01.json
```

- 只允许在**实现、Prompt、请求配置与评分规则全部冻结**后用于首次运行；运行窗口内不得改这些对象。
- 终端只输出 `item_id` / `status` / `verdict` / 失败原因 / usage / 延迟；**题面与模型响应只写入证据文件**。
- `evidence/holdout/` 与其派生的判定素材含题面，只由本人阅读；首次结果不得反向用于选择方案或调参。

## 5. 人工判定素材（不调用模型）

### `build-semantic-worksheet.py` — 生成逐题判定素材

```bash
.venv/bin/python scripts/build-semantic-worksheet.py \
    --evidence evidence/bm25-e2e/dev-bm25-e2e-top10-01.json \
    --out notes/dev-semantic-checklist-bm25-e2e.md
```

按证据的 `item_id` 前缀识别 split，只读对应题集；只呈现事实（题目、机械层结果、模型响应、每个 citation 指向的
冻结原文），**不生成通过 / 不通过结论**。两条注意：

1. 若证据属 holdout，产出物含题面，须由有权阅读者执行与保存。
2. **重新运行会覆盖已填写的人工判定**；需要重新生成时用 `--out` 写到新文件。

### `prescreen-r1-coverage.py` — 判定前的机械预筛

```bash
.venv/bin/python scripts/prescreen-r1-coverage.py \
    --evidence evidence/bm25-e2e/dev-bm25-e2e-top10-01.json \
    --out notes/dev-prescreen-bm25-e2e.md
```

只做程序职责范围内的检查：citation 可解析性、与本次 context 的成员关系、口径 ② 的包含性（citation 行范围是否
完整落在 requirement span 内）。**「通过 / 不通过」由本人填写，本脚本不提供结论。**

注意：该脚本接受调用者传入的任意证据文件。若传入的是 holdout 派生证据，产出物同样含题面，只由本人处理，
不得入库或对外输出。

## 6. 展示回放（不调用模型）

### `demo-replay.py` — 只读回放与离线重算

```bash
python3 scripts/demo-replay.py summary                     # 汇总已记录的 dev 运行
.venv/bin/python scripts/demo-replay.py verify             # 离线重算检索顺序 / context hash / 字符数
python3 scripts/demo-replay.py case --case w13-dev-direct-answer-02 --section source
```

- `summary` / `case` 读取 2026-09-10 已记录的 dev 证据；`verify` 在本机重新执行现有 BM25 与 context 组装。
- 三条命令都**不发出模型请求**、不接受任意文件或 query 输入，也不覆盖历史 evidence。
- `verify` 只核对「证据上下文能否重建」，不核完整请求 payload，也不重新生成答案；页面上显示 10/10 与
  终端 `PASS` 都只表示该次重算完成，不是质量得分。

## 7. 常用序列

```bash
# 1) 输入处理自检（不调用模型）
./scripts/w13rag.sh check

# 2) 检索对照（不调用模型）
.venv/bin/python scripts/run-retrieval-eval.py --backend bm25 --k 10 --out evidence/retrieval/dev-bm25-top10-02.json

# 3) 人工判定前：生成素材 + 机械预筛（不调用模型）
.venv/bin/python scripts/build-semantic-worksheet.py --evidence evidence/bm25-e2e/dev-bm25-e2e-top10-01.json \
  --out notes/dev-semantic-checklist-bm25-e2e.md
.venv/bin/python scripts/prescreen-r1-coverage.py --evidence evidence/bm25-e2e/dev-bm25-e2e-top10-01.json \
  --out notes/dev-prescreen-bm25-e2e.md

# 4) 演示回放（离线，不发模型请求）
python3 scripts/demo-replay.py summary
.venv/bin/python scripts/demo-replay.py verify
```

## 8. 限制与纪律

- **退出码不等于质量结论**。退出 0 只表示该次执行完成；质量结论要读证据里的 `summary`（例如 `split_status`）。
  generation runner 的 shell 退出码不能代替判定。
- **一次运行成功只证明该次链路成功**，不证明整体质量，也不证明掌握。
- **生成类脚本会产生真实请求与费用**，且当前冻结策略是**不重试**；运行前要明确目的与授权，尤其是 holdout 入口。
- **证据文件按历史版本保留**：已落盘的运行记录不因后续修改而回写；要修正结论应新增版本并说明依据。
- **缓存复用有前提**：dense 向量来自冻结缓存，缓存身份不含语料内容 hash 或 entry 顺序（详见
  [`../src/w13rag/README.md`](../src/w13rag/README.md) §8）；换语料前需先重建缓存。
- **受保护内容纪律**与 `AGENTS.md` §1.3 一致：`eval/holdout/` 及其衍生素材不得被普通工具、脚本或文档直接读取、
  搜索或输出；需要执行时只用本目录登记的通道。

