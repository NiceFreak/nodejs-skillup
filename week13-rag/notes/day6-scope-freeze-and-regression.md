# W13 D6：v1 范围冻结与 technical-v2 回归记录

> 日期：2026-09-12（D6）。对象：把 `w13-eval-v1`（`rules-c0a4b85`）明确冻结为历史实验，并把两次端到端运行（一次误跑旧范围、一次正确跑 technical-v2）按事实收进记录。

## 1. 范围现状（事实）

- 旧范围：corpus `rules-c0a4b85`（7 份规则文档，572 blocks），dev 题集 `eval/dev/items.json`（`w13-eval-v1`），holdout `eval/holdout/items.json`；契约已于 2026-09-08 冻结。
- 新范围：corpus `technical-9c6e6549b991`（11 份：AGENTS.md + 5 份 protocol + 5 份 W13 笔记），dev 题集 `eval/v2-dev/items.json`（`w13-eval-v2-dev`，`contract_status=confirmed`）。
- 冻结决定（2026-09-12）：`w13-eval-v1` 已被 technical-v2 替代，保留为历史实验，不再作为当前能力判定对象；当前活动范围是 technical-v2。

## 2. 两次运行（事实与证据）

| 运行 | 入口 | 题集 | 结果 | 证据 |
|---|---|---|---|---|
| 误跑旧范围 | `run-dense-langchain-e2e.py`（默认 `--items eval/dev/items.json`） | `w13-eval-v1`（规则） | 10 次真实调用：9 `ok` + 1 `schema_error`；机械 6/10；`split_status=fail` | `evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top10-02.json` |
| 正确重跑 | `run-technical-v2-langchain-e2e.py`（默认 `--items eval/v2-dev/items.json`） | `w13-eval-v2-dev`（technical-v2） | 4 次真实调用全 `ok`；机械 4/4；6 题 fixture-only 不发请求 | `evidence/technical/technical-v2/generation-langchain-k10-05.json` |

两次运行 `served_model=deepseek-flash`，请求字段一致（`deepseek-v4-flash`、`thinking=disabled`、`max_tokens=4096`、`response_format=json_object`）。

## 3. 误跑原因（不是逻辑 bug）

`run-dense-langchain-e2e.py` 的默认 `--items` 是旧 `eval/dev/items.json`。它是 v1 范围的 runner，被有意保留作历史实验，但没有「已被替代」标记，导致按旧入口运行时静默命中旧范围。根因是缺 superseded 标记，不是检索/生成逻辑错误。

修正（非行为变更）：给三个 v1 generation runner（`run-bm25-e2e.py`、`run-dense-langchain-e2e.py`、`run-dev-baseline.py`）加 stderr 的 `[legacy-scope]` 提示，并在 `scripts/README.md` 标注 v1 runner 已被替代。契约文件 hash 不变。

## 4. technical-v2 的检索后端（事实）

- retrieval-only 层：`run-technical-v2-retrieval.py` 支持 `--backend bm25|dense|rrf`，三个后端都有 confirmed 证据（`retrieval-{bm25,dense,rrf}-k10-confirmed*.json`），对 3 个 source-span 检索题均 3/3。
- generation 端到端层：`run-technical-v2-langchain-e2e.py` 只用 BM25；dense/RRF 尚未接到 generation 端到端。这是范围缺口，不是 bug；是否补 dense/RRF 的 generation e2e 是 owner 决定。

## 5. 边界

- `status=ok`、机械 4/4 只覆盖结构与身份层；语义判定已在 `semantic-verdict-01.json` 收口（04/07/08/09 通过），本次运行不重复填。
- 本次 summary 里 `split_status=fail` 与 `item_pass_rate_threshold=2.25` 不代表质量结论：`fail` 因 4 条语义 slot pending；阈值 `2.25` 未在 freeze 前确认（对应 `threshold_not_pre_frozen`），留待 owner 确认。
- 误跑旧范围的 dense e2e 机械 6/10，与 D5 的 7/10 差异属 run-to-run 模型波动，不是配置变化。
- 未读取、未修改 `eval/holdout/`、`eval/v2-holdout/`、`eval/independent-holdout/` 的题面。
- v1 冻结标记不修改任何被 hash 锁定的契约文件（`eval/dev/items.json`、`eval/manifest.json` 等），避免破坏 frozen contract hash。
