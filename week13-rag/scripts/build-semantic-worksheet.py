#!/usr/bin/env python3
"""build-semantic-worksheet — 从运行证据生成人工语义判定素材（不调用模型，不生成结论）。

用法（从 week13-rag 运行）：
  .venv/bin/python scripts/build-semantic-worksheet.py \\
      --evidence evidence/baseline/dev-full-context-prompt-v1-json-output-01.json \\
      --out notes/dev-semantic-checklist-worksheet.md

边界：
- 只读 `eval/dev/items.json`、冻结语料 snapshot 与指定证据文件；不读 holdout；不调用模型。
- 只呈现事实：题目、机械层结果、模型响应、每个 citation 指向的冻结原文。
- 判定规则以 `eval/scoring-contract.md` 为唯一来源；「通过 / 不通过」结论由本人填写。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "corpus/rules-c0a4b85"
DOCS = SNAPSHOT / "documents"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def citation_source(citation: str) -> tuple[Path, int, int] | None:
    """`rules/<path>#L<start>-L<end>` -> (文档路径, start, end)；形态不符时返回 None。"""
    if "#L" not in citation or not citation.startswith("rules/"):
        return None
    body, span = citation.split("#L", 1)
    try:
        start_text, end_text = span.split("-L", 1)
        return DOCS / body[len("rules/"):], int(start_text), int(end_text)
    except ValueError:
        return None


def quoted_lines(citation: str, cache: dict[Path, list[str]]) -> list[str]:
    """把 citation 展开成冻结语料里的原文行；无法展开时说明原因，不静默留空。"""
    parsed = citation_source(citation)
    if parsed is None:
        return ["    （标识形态无法解析为冻结位置）"]
    path, start, end = parsed
    if not path.exists():
        return [f"    （未在冻结 corpus 中找到 {path.name}）"]
    if path not in cache:
        cache[path] = path.read_text(encoding="utf-8").split("\n")
    lines = cache[path]
    if start < 1 or end > len(lines):
        return [f"    （行范围 L{start}-L{end} 超出 {path.name} 共 {len(lines)} 行）"]
    # 原文行尾空白（Markdown 硬换行）不承载内容语义，去除以免污染 diff 白名单检查
    return [f"    {n}| {lines[n - 1].rstrip()}".rstrip() for n in range(start, end + 1)]


def render_header(evidence: dict, evidence_path: Path) -> str:
    prompt = evidence.get("prompt", {})
    corpus = evidence.get("corpus", {})
    return "\n".join(
        [
            "# W13 dev 人工语义判定素材（脚本生成）",
            "",
            "> 生成脚本：`scripts/build-semantic-worksheet.py`（可重跑；证据或语料变化后重新生成）。",
            "> **本文件是生成物：重新运行脚本会覆盖已填写的人工判定。**回填判定后需重新生成时，请用 `--out` 写到新文件。",
            f"> 证据来源：`{evidence_path}`",
            f"> evidenceId：`{evidence.get('evidenceId')}`；Prompt：`{prompt.get('version')}`；"
            f"语料：`{corpus.get('snapshotId')}`；生成：`{evidence.get('createdAt')}`",
            "> 判定规则来源：[`../eval/scoring-contract.md`](../eval/scoring-contract.md)（状态 `frozen`）；"
            "判定口径（含 R1 覆盖口径）见 [`../eval/scoring-rulings-r1.md`](../eval/scoring-rulings-r1.md)。",
            "",
            "## 0. 判定素材说明与边界",
            "",
            "- 机械 evaluator 的结果见每题「运行与机械结果」段，无需重判。",
            "- 本人负责的语义判定（契约 §1）：claim 是否被引用的原文支持、回答是否满足 evidence requirement、",
            "  abstained 的 reason text 是否与 reason_code 及该题 `corpus_absence` 一致。",
            "- 判定适用范围是可通过解析的 item；已由机械条件判为 `fail` 的 item，其 claims 与 citations 只作",
            "  失败阶段归因材料，不改变该 item 的失败判定。",
            "- 「通过 / 不通过」与最终结论由本人填写；本文件不提供任何结论。",
            "",
            "---",
            "",
        ]
    )


def render_item(index: int, item: dict, record: dict, evaluation: dict, cache: dict) -> str:
    run = evaluation["run"]
    verdict = evaluation["verdict"]
    out = [f"## {index}. `{item['id']}`（{item['behavior_type']} / 预期 `{item['expected_branch']}`）", ""]
    out += [
        "**题目事实**",
        "",
        f"- query：{item['query']}",
        f"- 预期结论（不发送给模型）：{item['expected_rule_conclusion']}",
        f"- 运行状态：`status={run['status']}`（retryable={run['retryable']}）→ `verdict={verdict['result']}`；"
        f"reasons={verdict['reasons']}；pending={verdict['pending']}",
        "",
        "**证据要求（不发送给模型）**",
        "",
    ]
    for requirement in item["evidence_requirements"]:
        if requirement["kind"] == "source_span":
            out.append(
                f"- `{requirement['span_id']}`（`{requirement['source_path']}` "
                f"L{requirement['line_start']}-L{requirement['line_end']}）：{requirement['requirement']}"
            )
        else:
            out.append(
                f"- `corpus_absence`（scope={requirement['scope']}）：{requirement['requirement']}"
            )
    out += ["", "**运行与机械结果**", ""]
    for evaluator in evaluation["evaluators"]:
        if evaluator["key"] in ("claim_support", "evidence_coverage", "reason_text_consistency"):
            continue
        state = "applies" if evaluator["applies"] else f"skip({evaluator['skip_reason']})"
        out.append(
            f"- `{evaluator['key']}`：{state}；passed={evaluator['passed']}；score={evaluator['score']}；"
            f"{evaluator['comment']}"
        )
    out += ["", "**模型实际响应**", "", "```json", record.get("raw_text") or "（空内容）", "```", ""]

    parsed = record.get("parsed") or {}
    claims = parsed.get("claims") or []
    out += ["**citations 与冻结原文**", ""]
    if claims:
        for claim_index, claim in enumerate(claims, 1):
            out.append(f"claim {claim_index}：{claim.get('text')}")
            for citation in claim.get("citations") or []:
                out.append(f"- `{citation}`")
                out.extend(quoted_lines(citation, cache))
            out.append("")
    else:
        out += ["（本次响应没有 claims；若为 abstained，判定对象是 reason text 与 `corpus_absence` 的一致性）", ""]

    out += ["**待本人判定（结论由本人填写）**", ""]
    out += ["- [ ] claim 是否被其 citation 指向的原文支持（逐条写 支持 / 部分 / 不支持，并注明哪条）："]
    out += ["- [ ] 回答是否满足该 item 的 evidence requirement："]
    if verdict["result"] == "fail":
        out += ["- [ ] 失败阶段归因（该 item 已由机械条件判为 `fail`，只作归因材料）："]
    out += ["- [ ] 本题最终判定：通过 / 不通过 —— 理由：", "", "---", ""]
    return "\n".join(out)


def render_closeout(evidence: dict, count: int) -> str:
    ids = [entry["record"]["item_id"] for entry in evidence["items"]]
    out = [f"## {count + 1}. split 级收口（本人填）", "", "| # | item | 判定结论 | 备注 |", "|---|---|---|---|"]
    for position, item_id in enumerate(ids, 1):
        out.append(f"| {position} | `{item_id}` | | |")
    out += [
        "",
        "- [ ] 已填写判定结论的条数：＿＿",
        "- [ ] 语义 evaluator 是否仍有 pending：＿＿",
        "- [ ] 结论句（只写本次证据能支持的范围）：",
        "",
    ]
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--evidence", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=ROOT / "notes/dev-semantic-checklist-worksheet.md")
    args = ap.parse_args()

    evidence = load_json(args.evidence)
    items = {entry["id"]: entry for entry in load_json(ROOT / "eval/dev/items.json")["items"]}
    cache: dict[Path, list[str]] = {}

    blocks = [render_header(evidence, args.evidence)]
    for index, entry in enumerate(evidence["items"], 1):
        record = entry["record"]
        blocks.append(render_item(index, items[record["item_id"]], record, entry["evaluation"], cache))
    blocks.append(render_closeout(evidence, len(evidence["items"])))

    args.out.write_text("\n".join(blocks) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({len(evidence['items'])} items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
