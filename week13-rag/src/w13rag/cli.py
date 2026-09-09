"""Build registry + Evidence Context for a frozen snapshot and write evidence.

Usage:
    python -m w13rag.cli build --snapshot-root <snapshot_dir> --out-dir <evidence_dir>
    python -m w13rag.cli verify --snapshot-root <snapshot_dir> --out-dir <evidence_dir> [--frozen-sha256 <file>]

Only reads the frozen corpus snapshot + its manifest; never touches eval
dev/holdout or the model client.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from .parser import (
    BlockInfo,
    _DELIM_RE,
    _HR_RE,
    _ROWLIKE_RE,
    _heading_level,
    parse_blocks,
)
from .registry import build_entries, evidence_context_string
from .serialize import content_sha256
from .source import SourceDoc, read_doc

def _line_class_is_structural(line: str, next_line: str | None) -> bool:
    if _heading_level(line) is not None or _HR_RE.match(line):
        return True
    if _ROWLIKE_RE.match(line) and next_line is not None and _DELIM_RE.match(next_line):
        return True
    if _DELIM_RE.match(line):
        return True
    return False


def audit_document(doc: SourceDoc, blocks: list[BlockInfo]) -> dict:
    """Coverage / duplication audit of one parsed document.

    Structural lines excluded from the content-candidate set: blank lines,
    headings (context-only by design), thematic breaks, and table
    header/delimiter rows (context-only).  Every other non-blank line must be
    covered by the core span of exactly one block.
    """
    n = doc.line_count
    core_cover: Counter[int] = Counter()
    for b in blocks:
        for ln in range(b.core_start, b.core_end + 1):
            core_cover[ln] += 1
    duplicated = sorted(ln for ln, c in core_cover.items() if c > 1)
    uncovered: list[int] = []
    for i in range(n):
        ln = i + 1
        raw = doc.lines[i]
        if raw.strip() == "":
            continue
        nxt = doc.lines[i + 1] if i + 1 < n else None
        if _line_class_is_structural(raw, nxt):
            continue
        if core_cover[ln] == 0:
            uncovered.append(ln)
    kind_count = Counter(b.kind for b in blocks)
    return {
        "source_path": doc.source_path,
        "line_count": n,
        "blocks": len(blocks),
        "kinds": dict(sorted(kind_count.items())),
        "duplicated_core_lines": duplicated,
        "uncovered_candidate_lines": uncovered,
    }


def load_snapshot(snapshot_root: Path) -> tuple[dict, Path]:
    manifest_path = snapshot_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    # snapshotPath entries already include the contentRoot prefix and are
    # relative to the snapshot root directory itself.
    return manifest, snapshot_root


def build_once(
    snapshot_root: Path,
) -> tuple[list[tuple[SourceDoc, list[BlockInfo], set[int]]], list[dict], str, dict]:
    manifest, doc_root = load_snapshot(snapshot_root)
    corpus_id = manifest["corpusId"]
    docs_blocks: list[tuple[SourceDoc, list[BlockInfo], set[int]]] = []
    audits: dict[str, dict] = {}
    for doc_meta in manifest["documents"]:
        doc = read_doc(
            doc_root,
            corpus_id,
            doc_meta["sourcePath"],
            doc_meta["snapshotPath"],
        )
        blocks, code_lines = parse_blocks(doc)
        docs_blocks.append((doc, blocks, code_lines))
        audits[doc_meta["sourcePath"]] = audit_document(doc, blocks)
    entries = build_entries(docs_blocks)
    context = evidence_context_string(entries)
    return docs_blocks, entries, context, audits


def _two_pass(snapshot_root: Path) -> tuple[list[dict], str, list[dict], str, dict]:
    """Build twice from disk and return both results plus the first audit."""
    _, entries1, ctx1, audits = build_once(snapshot_root)
    _, entries2, ctx2, _ = build_once(snapshot_root)
    return entries1, ctx1, entries2, ctx2, audits


def run(snapshot_root: Path, out_dir: Path) -> dict:
    if not snapshot_root.is_dir():
        raise SystemExit(f"snapshot root not found: {snapshot_root}")
    manifest, _ = load_snapshot(snapshot_root)
    corpus_id = manifest["corpusId"]
    snapshot_id = manifest["snapshotId"]

    entries1, ctx1, entries2, ctx2, audits = _two_pass(snapshot_root)

    ctx1_sha = content_sha256(ctx1)
    rerun_identical = (
        ctx1 == ctx2
        and [e["source_id"] for e in entries1]
        == [e["source_id"] for e in entries2]
        and [e["content_sha256"] for e in entries1]
        == [e["content_sha256"] for e in entries2]
    )
    summary = {
        "corpus_id": corpus_id,
        "snapshot_id": snapshot_id,
        "documents": [d["sourcePath"] for d in manifest["documents"]],
        "blocks": len(entries1),
        "evidence_context_chars": len(ctx1),
        "evidence_context_sha256": ctx1_sha,
        "rerun_identical": rerun_identical,
        "uncovered_by_document": {
            path: len(a["uncovered_candidate_lines"])
            for path, a in audits.items()
            if a["uncovered_candidate_lines"]
        },
        "duplicated_core_by_document": {
            path: len(a["duplicated_core_lines"])
            for path, a in audits.items()
            if a["duplicated_core_lines"]
        },
        "per_document": audits,
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = snapshot_id
    registry_path = out_dir / f"registry-{stem}.json"
    ctx_path = out_dir / f"evidence-context-{stem}.txt"
    ctx_sha_path = out_dir / f"evidence-context-{stem}.sha256"
    report_path = out_dir / f"criteria-report-{stem}.md"

    registry_path.write_text(
        json.dumps(entries1, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    ctx_path.write_text(ctx1, encoding="utf-8")
    ctx_sha_path.write_text(
        f"sha256  {ctx1_sha}  evidence-context-{stem}.txt\n", encoding="utf-8"
    )
    report_path.write_text(_criteria_report(summary, entries1), encoding="utf-8")
    summary["files"] = {
        "registry": registry_path.name,
        "evidence_context": ctx_path.name,
        "sha256": ctx_sha_path.name,
        "report": report_path.name,
    }
    return summary



def _criteria_report(summary: dict, entries: list[dict]) -> str:
    total_kinds: Counter[str] = Counter()
    for a in summary["per_document"].values():
        total_kinds.update(a["kinds"])

    lines = [
        f"# W13 serialization implementation — evidence report ({summary['snapshot_id']})",
        "",
        "> This report records executed facts only.  The wording of criteria #1-#7",
        "> below is reconstructed from day3 §6.2.2 / §3.3 mappings and must be",
        "> confirmed by the learner before the criteria are accepted (ownership per",
        "> W13 plan §9).",
        "",
        "## Run facts",
        "",
        f"- corpus_id: `{summary['corpus_id']}`",
        f"- snapshot_id: `{summary['snapshot_id']}`",
        f"- blocks: {summary['blocks']}",
        f"- Evidence Context chars: {summary['evidence_context_chars']}",
        f"- Evidence Context sha256: `{summary['evidence_context_sha256']}`",
        f"- two-pass byte-identical rerun: {summary['rerun_identical']}",
        "",
        "## Audit (per document)",
        "",
        "| source_path | line_count | blocks | uncovered_candidates | duplicated_core_lines |",
        "|---|---|---|---|---|",
    ]
    for path, a in summary["per_document"].items():
        lines.append(
            f"| {path} | {a['line_count']} | {a['blocks']} | "
            f"{len(a['uncovered_candidate_lines'])} | {len(a['duplicated_core_lines'])} |"
        )
    lines += [
        "",
        "## Block kinds",
        "",
    ]
    for kind, count in sorted(total_kinds.items()):
        lines.append(f"- {kind}: {count}")
    lines += [
        "",
        "## Wrapper precondition (per-entry check)",
        "",
        f"- entries checked: {len(entries)} (build fails on violation)",
        "- every `model_content` free of literal `<source` / `</source>`: enforced",
        "",
    ]
    return "\n".join(lines) + "\n"


def _print_build_summary(summary: dict) -> None:
    print("=== serialization evidence build ===")
    print(f"snapshot : {summary['snapshot_id']}  corpus={summary['corpus_id']}")
    print(f"blocks   : {summary['blocks']}")
    print(f"rerun    : byte-identical={summary['rerun_identical']}")
    print(f"context  : chars={summary['evidence_context_chars']} "
          f"sha256={summary['evidence_context_sha256']}")
    print(f"uncovered: {summary['uncovered_by_document'] or 'none'}")
    print(f"duplicate: {summary['duplicated_core_by_document'] or 'none'}")
    for name, f in summary["files"].items():
        print(f"wrote {name}: {f}")


def cmd_build(snapshot_root: Path, out_dir: Path) -> None:
    _print_build_summary(run(snapshot_root, out_dir))


def cmd_verify(
    snapshot_root: Path, out_dir: Path, frozen_sha256: Path | None
) -> None:
    """Rebuild in memory and compare against the last on-disk build and,
    when provided, the frozen regression baseline file."""
    manifest, _ = load_snapshot(snapshot_root)
    snapshot_id = manifest["snapshotId"]
    _, entries, ctx, audits = build_once(snapshot_root)
    fresh = content_sha256(ctx)
    ctx_path = out_dir / f"evidence-context-{snapshot_id}.txt"
    print("=== serialization verify ===")
    print(f"snapshot : {snapshot_id}")
    print(f"fresh    : blocks={len(entries)} sha256={fresh}")
    mismatches: list[str] = []
    if ctx_path.exists():
        on_disk = content_sha256(ctx_path.read_text(encoding="utf-8"))
        ok = on_disk == fresh
        print(f"on-disk  : sha256={on_disk}  matches fresh={ok}")
        if not ok:
            mismatches.append("on-disk evidence-context file differs from fresh build")
    else:
        mismatches.append(f"missing on-disk artifact: {ctx_path.name} (run build first)")
    if frozen_sha256 is not None:
        if frozen_sha256.exists():
            recorded = frozen_sha256.read_text(encoding="utf-8").split()[1].strip()
            ok = recorded == fresh
            print(f"frozen   : sha256={recorded}  matches fresh={ok}")
            if not ok:
                mismatches.append("frozen regression baseline differs from fresh build")
        else:
            mismatches.append(
                f"missing frozen baseline: {frozen_sha256.name} "
                "(freeze it after criteria #1-#7 are confirmed)"
            )
    audits_bad = sum(
        1
        for a in audits.values()
        if a["uncovered_candidate_lines"] or a["duplicated_core_lines"]
    )
    if audits_bad:
        mismatches.append(f"{audits_bad} document(s) have uncovered/duplicated lines")
    if mismatches:
        print("FAIL:")
        for m in mismatches:
            print(f"  - {m}")
        raise SystemExit(1)
    print("OK: fresh build matches all provided references.")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="build registry + Evidence Context + evidence files")
    b.add_argument("--snapshot-root", type=Path, required=True)
    b.add_argument("--out-dir", type=Path, required=True)
    v = sub.add_parser(
        "verify",
        help="rebuild in memory; compare against on-disk build and optional frozen baseline",
    )
    v.add_argument("--snapshot-root", type=Path, required=True)
    v.add_argument("--out-dir", type=Path, required=True)
    v.add_argument("--frozen-sha256", type=Path, default=None)
    args = parser.parse_args(argv)
    if args.cmd == "build":
        cmd_build(args.snapshot_root, args.out_dir)
    elif args.cmd == "verify":
        cmd_verify(args.snapshot_root, args.out_dir, args.frozen_sha256)
    else:  # pragma: no cover
        parser.error(f"unknown command: {args.cmd}")


if __name__ == "__main__":
    main()
