#!/usr/bin/env python3
"""prescreen-r1-coverage — W13 语义判定前的机械预筛（不判定通过/不通过）。

用法（从 week13-rag 运行）：

    .venv/bin/python scripts/prescreen-r1-coverage.py \
        --evidence evidence/bm25-e2e/dev-bm25-e2e-top10-01.json \
        --out notes/dev-prescreen-bm25-e2e.md

做什么（都属于程序的职责范围：identifier、context membership、聚合）：

- 对每个 `source_span` requirement 计算 R1 ② 的**包含性**：是否存在 citation 的行范围完整落在该 requirement
  的 `source_span` 内（同文档，`citation.start >= span.start` 且 `citation.end <= span.end`）；
- 列出不可解析的 citation，以及落在该题所有 requirement 之外的 citation（越界或跨块合并）；
- 由本次证据记录的 `hits` 推出 citation 与本次 context 的成员关系；
- 输出每题「已由机械确定的未覆盖项」与「仍需本人语义判定的项」。

不做什么：不给出「通过 / 不通过」结论、不调用模型、不读 holdout、不修改任何冻结对象。
判定规则的唯一来源是 [`eval/scoring-contract.md`](../eval/scoring-contract.md) 与
[`eval/scoring-rulings-r1.md`](../eval/scoring-rulings-r1.md)；语义判定（claim 支持、语义等价、结论覆盖、
reason text 一致性）由本人完成。
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEV_ITEMS = ROOT / "eval/dev/items.json"

#: citation 形如 `rules/<path>#L<a>-L<b>`；requirement 的 span_id 形如 `rules-c0a4b85/<path>#L<a>-L<b>`。
_CITATION_RE = re.compile(r"^rules/(.+)#L(\d+)-L(\d+)$")
_SPAN_ID_RE = re.compile(r"^rules(?:-c0a4b85)?/(.+)#L(\d+)-L(\d+)$")


def parse_citation(identifier: str) -> tuple[str, int, int] | None:
    match = _CITATION_RE.match(identifier)
    if match is None:
        return None
    return match.group(1), int(match.group(2)), int(match.group(3))


def requirement_span(requirement: dict[str, Any]) -> tuple[str, int, int] | None:
    """优先用 requirement 自带字段；缺失时回退解析 span_id。"""
    if "source_path" in requirement and "line_start" in requirement:
        path = str(requirement["source_path"]).split("/")[-1]
        return path, int(requirement["line_start"]), int(requirement["line_end"])
    span_id = requirement.get("span_id")
    if not isinstance(span_id, str):
        return None
    match = _SPAN_ID_RE.match(span_id)
    if match is None:
        return None
    return match.group(1), int(match.group(2)), int(match.group(3))


def in_span(path: str, start: int, end: int, span: tuple[str, int, int]) -> bool:
    span_path, span_start, span_end = span
    return path == span_path and start >= span_start and end <= span_end


def overlaps_hits(path: str, start: int, end: int, hits: list[dict[str, Any]]) -> bool:
    return any(
        hit["source_path"] == path and not (hit["line_end"] < start or hit["line_start"] > end)
        for hit in hits
    )


def mechanical_status(evaluators: list[dict[str, Any]]) -> str:
    failed = [e["key"] for e in evaluators if e.get("applies") and e.get("passed") is False]
    pending = [e["key"] for e in evaluators if e.get("applies") and e.get("passed") is None]
    if failed:
        return f"fail（{', '.join(failed)}）"
    return f"pass（语义槽位待判：{', '.join(pending) or '无'}）"


def claims_with_citations(parsed: dict[str, Any], hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, claim in enumerate(parsed.get("claims") or [], 1):
        citations = []
        for identifier in claim.get("citations") or []:
            span = parse_citation(identifier)
            citations.append(
                {
                    "identifier": identifier,
                    "span": span,
                    "resolvable": span is not None,
                    "in_context": overlaps_hits(*span, hits) if span else False,
                }
            )
        rows.append({"index": index, "text": claim.get("text", ""), "citations": citations})
    return rows


def item_section(
    index: int, item: dict[str, Any], evidence_item: dict[str, Any]
) -> tuple[list[str], dict[str, int]]:
    record = evidence_item["record"]
    evaluation = evidence_item["evaluation"]
    hits = evidence_item["hits"]
    parsed = record.get("parsed") or {}
    claims = claims_with_citations(parsed, hits)
    span_requirements = [
        (requirement, requirement_span(requirement))
        for requirement in item["evidence_requirements"]
        if requirement["kind"] == "source_span"
    ]
    resolved_spans = [span for _, span in span_requirements if span is not None]
    absence_requirements = [
        requirement
        for requirement in item["evidence_requirements"]
        if requirement["kind"] != "source_span"
    ]

    lines = [
        f"## {index}. `{item['id']}`（{item['behavior_type']} / 预期 `{item['expected_branch']}`）",
        "",
        f"- 运行 status：`{record['status']}`",
        f"- 机械层：{mechanical_status(evaluation['evaluators'])}",
        f"- 实际分支：`{parsed.get('branch') or '（无解析结果）'}`",
        "",
        "**requirement 预筛（R1 ②：citation 行范围是否完整落在 requirement span 内）**",
        "",
        "| requirement | span | 机械结论 | span 内的 claim |",
        "|---|---|---|---|",
    ]

    uncovered: list[str] = []
    advisory: list[str] = []
    not_applicable: list[str] = []
    no_claims = not claims
    has_absence = any(
        requirement["kind"] != "source_span" for requirement in item["evidence_requirements"]
    )
    for span_index, (requirement, span) in enumerate(span_requirements, 1):
        label = f"R{span_index}"
        if span is None:
            lines.append(f"| {label} | 无法解析 | 需人工核对 span 定义 | — |")
            continue
        path, start, end = span
        inside = [
            row["index"]
            for row in claims
            if any(
                citation["span"] is not None and in_span(*citation["span"], span)
                for citation in row["citations"]
            )
        ]
        if has_absence:
            advisory.append(label)
            verdict = "advisory（无答案题不参与该题通过判定，契约 §1）"
        elif no_claims:
            not_applicable.append(label)
            verdict = "不适用（本次响应无 claims；该题按契约 §2 / §3 的机械条件判定）"
        else:
            verdict = "已覆盖（机械；① 仍需人工）" if inside else "**未覆盖（机械确定，R1 ②）**"
            if not inside:
                uncovered.append(label)
        label_text = str(requirement.get("requirement", ""))[:36]
        lines.append(
            f"| {label} `{label_text}` | `{path}#L{start}-L{end}` | {verdict} | {inside or '—'} |"
        )
    for requirement in absence_requirements:
        lines.append(
            f"| — | `{requirement.get('kind')}` | 由 abstained 的 reason text 与 `corpus_absence` 一致性判定（语义） | — |"
        )

    lines += ["", "**citation 预筛（可解析 / 落在 requirement 内 / 与本次 context 相交）**", ""]
    lines += [
        "| claim | citation | 可解析 | 落在某 requirement 内 | 与本次 hits 相交 |",
        "|---|---|---|---|---|",
    ]
    for row in claims:
        for citation in row["citations"]:
            span = citation["span"]
            inside = any(in_span(*span, target) for target in resolved_spans) if span else False
            lines.append(
                f"| {row['index']} | `{citation['identifier']}` | "
                f"{'是' if citation['resolvable'] else '**否**'} | {'是' if inside else '否'} | "
                f"{'是' if citation['in_context'] else '**否**'} |"
            )
    if not claims:
        lines.append("| — | （本次响应没有 claims） | — | — | — |")

    lines += ["", "**仍需本人判定（语义；本文件不给出结论）**", ""]
    if claims:
        lines.append(f"- [ ] 逐条 claim（共 {len(claims)} 条）是否被其 citation 指向的原文支持，且是否为 atomic claim：")
        lines.append("- [ ] requirement ① 内容覆盖：只在 ② 机械通过的那几项上判 claim 内容是否覆盖该要求：")
        lines.append("- [ ] 是否包含冻结 corpus 无法支持的额外 claim：")
    if absence_requirements:
        lines.append("- [ ] abstained 的 reason text 是否与 reason_code 及该题 `corpus_absence` 一致：")
    lines.append("- [ ] 本题最终判定：通过 / 不通过 —— 理由：")
    lines.append("")

    stats = {
        "span_requirements": len(span_requirements),
        "uncovered_mechanical": len(uncovered),
        "advisory_requirements": len(advisory),
        "not_applicable_requirements": len(not_applicable),
        "claims": len(claims),
    }
    return lines, stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--evidence", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    item_ids = [entry["itemId"] for entry in evidence["items"]]
    if any(item_id.startswith("w13-holdout") for item_id in item_ids):
        raise SystemExit("拒绝 holdout 证据：本脚本只处理 dev 运行，holdout 素材由有权阅读者另办")
    items = {
        entry["id"]: entry
        for entry in json.loads(DEV_ITEMS.read_text(encoding="utf-8"))["items"]
    }
    missing = [item_id for item_id in item_ids if item_id not in items]
    if missing:
        raise SystemExit(f"证据中的 item 不在 dev 题集：{missing}")

    out: list[str] = [
        "# W13 dev 语义判定机械预筛（生成物）",
        "",
        f"> 证据：`{args.evidence}`（`{evidence.get('runMode')}`，{len(item_ids)} 题）",
        "> 本文件只做程序职责范围内的机械检查：citation 可解析性、与本次 context 的成员关系、",
        "> R1 ② 的包含性（citation 行范围是否完整落在 requirement span 内）。",
        "> 判定规则的唯一来源是 [`eval/scoring-contract.md`](../eval/scoring-contract.md) 与",
        "> [`eval/scoring-rulings-r1.md`](../eval/scoring-rulings-r1.md)；",
        "> **「通过 / 不通过」由本人填写，本文件不提供结论。**",
        "",
        "## 汇总（机械部分）",
        "",
    ]
    header_end = len(out)

    summary: list[tuple[str, dict[str, int]]] = []
    for index, entry in enumerate(evidence["items"], 1):
        section, stats = item_section(index, items[entry["itemId"]], entry)
        out += section
        summary.append((entry["itemId"], stats))

    total_reqs = sum(s["span_requirements"] for _, s in summary)
    total_uncovered = sum(s["uncovered_mechanical"] for _, s in summary)
    total_advisory = sum(s["advisory_requirements"] for _, s in summary)
    total_not_applicable = sum(s["not_applicable_requirements"] for _, s in summary)
    items_with_uncovered = [item_id for item_id, s in summary if s["uncovered_mechanical"]]
    total_claims = sum(s["claims"] for _, s in summary)
    out[header_end:header_end] = [
        f"- `source_span` requirement 共 **{total_reqs}** 项：**{total_uncovered}** 项按 R1 ② 已由机械确定未覆盖；"
        f"**{total_advisory}** 项属无答案题的 advisory，不参与该题通过判定（契约 §1）；"
        f"**{total_not_applicable}** 项不适用（该题响应无 claims，按 §2 / §3 的机械条件判定）。",
        f"- 含至少一项已确定未覆盖的 item：**{len(items_with_uncovered)}** 题"
        f"（{', '.join(f'`{i}`' for i in items_with_uncovered) or '—'}）。",
        f"- 本次响应共有 **{total_claims}** 条 claim 需要本人逐条判断支持关系。",
        "- 机械未覆盖不等于本人已作判定：最终「通过 / 不通过」仍由本人填写。",
        "",
    ]

    text = "\n".join(out) + "\n"
    out_path = args.out or (ROOT / "notes/dev-prescreen.md")
    out_path.write_text(text, encoding="utf-8")
    print(
        f"[prescreen] items={len(item_ids)} span_requirements={total_reqs} "
        f"uncovered_mechanical={total_uncovered} advisory={total_advisory} "
        f"not_applicable={total_not_applicable} "
        f"items_with_uncovered={len(items_with_uncovered)} claims={total_claims}"
    )
    print(f"[out] {args.evidence}")
    try:
        shown: Path | str = out_path.relative_to(ROOT)
    except ValueError:
        shown = out_path
    print(f"[prescreen out] {shown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
