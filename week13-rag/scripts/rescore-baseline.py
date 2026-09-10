#!/usr/bin/env python3
"""rescore-baseline — 用当前评估层离线重评已落盘的 baseline 证据（不调用模型）。

用法（从 week13-rag 运行）：
  .venv/bin/python scripts/rescore-baseline.py --evidence evidence/baseline/dev-full-context-prompt-v1-01.json
  .venv/bin/python scripts/rescore-baseline.py --evidence <file> --out /tmp/rescore.json

用途：验证 `run` / `evaluators` / `verdict` 三层实现复现旧证据的机械结论，并输出新结构的完整结果。

边界：只读已落盘证据与 `eval/dev/items.json`；不调用模型；不读 holdout；不覆盖旧证据（旧证据是历史版本证据）。
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from w13rag.generation import load_dev_items  # noqa: E402
from w13rag.scoring import evaluate_item, load_registry_ids, summarize  # noqa: E402


@dataclass
class ReplayRecord:
    """从落盘证据重建的最小记录；字段与 `w13rag.generation.RunRecord` 的评估所需部分一致。"""

    status: str
    parsed: dict | None
    http_status: int | None = None
    detail: str | None = None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--evidence", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    items = {item["id"]: item for item in load_dev_items()}
    registry = load_registry_ids()

    evaluations = []
    for entry in evidence["items"]:
        record = entry["record"]
        item = items[record["item_id"]]
        replay = ReplayRecord(
            status=record["status"],
            parsed=record.get("parsed"),
            http_status=record.get("http_status"),
            detail=record.get("detail"),
        )
        evaluations.append(evaluate_item(replay, item, registry))

    for evaluation in evaluations:
        print(
            f"{evaluation.item_id:44s} run={evaluation.run.status:14s} "
            f"retryable={str(evaluation.run.retryable):5s} verdict={str(evaluation.verdict.result):5s} "
            f"reasons={evaluation.verdict.reasons} pending={evaluation.verdict.pending}"
        )

    summary = summarize(evaluations)
    print("[summary]", json.dumps(summary, ensure_ascii=False))
    print(f"[source] {evidence.get('evidenceId')} ({args.evidence})")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "rescoredFrom": evidence.get("evidenceId"),
                    "source": str(args.evidence),
                    "items": [e.as_dict() for e in evaluations],
                    "summary": summary,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"[out] {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
