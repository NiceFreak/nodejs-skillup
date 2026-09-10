# W13 eval 判定口径记录（r1）

> 建立：2026-09-10（D4）。用途：记录对已冻结契约的解释性口径，使其可追溯、可复核。
> 边界：本文件**不改写** `scoring-contract.md`（该文件已冻结并纳入 `eval/manifest.json` 的 hash）。
> 若某条口径需要长期固定，应在下一次 eval version 冻结时并入契约正文。

## R1：`evidence_requirements` 的覆盖口径（2026-09-10 由本人冻结）

**口径**：某项 requirement 被覆盖，必须同时满足两点：

1. 至少一条 claim 的内容覆盖该 requirement 描述的要求；
2. 该 claim 的 citation 行范围落在该 requirement 的 `source_span` 内——同一文档，且
   `citation.line_start >= span.line_start` 且 `citation.line_end <= span.line_end`。

**依据**：与 D3 冻结的 source block 位置身份一致（`source_id` 是位置身份，registry 按块边界拆分）。
跨块合并（如 `#L185-L189`）与越界引用（如 `#L71-L76` 对 `L66-L72`）都视为该 requirement 未被覆盖。

**适用范围**：`w13-eval-v1` 的 dev split 判定，回溯适用到该 split 全部 10 题。

**事后澄清声明**：本条是对契约 §2.7 的解释，**在 2026-09-10 的 dev 运行之后才明确记录**。
它不修改 expected conclusion、evidence requirement、阈值或契约 hash，但会影响 requirement 覆盖的判定结论。因此：

- 本轮 dev 的逐题结论按本口径记录，并在每日笔记标注该口径的澄清时点；
- 下一轮运行（含 BM25 对照与首次 holdout）之前本条必须已经存在；若要长期固定，
  应在 `w13-eval-v2` 冻结时并入契约正文；
- 不得在看到结果后再次调整本条。
