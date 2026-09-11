#!/usr/bin/env python3
"""Deterministic v2 dev diagnosis: retrieval, context membership, and hashes.

This deliberately stops before model invocation.  It reports where a failure
occurs; it does not score semantic answer quality and never opens holdout.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from w13rag.generation import load_dev_items
from w13rag.retrieval import build_retriever, build_retrieval_context, evaluate_item_retrieval, load_registry, retrieve, to_documents

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", type=Path, required=True)
    ap.add_argument("--registry", type=Path, required=True)
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    items = load_dev_items(args.items)
    entries = load_registry(args.registry)
    retriever = build_retriever(to_documents(entries), k=args.k)
    rows = []
    for item in items:
        hits = retrieve(retriever, item["query"], k=args.k)
        context = build_retrieval_context(hits, entries)
        ev = evaluate_item_retrieval(item, hits)
        req_ids = [r.get("span_id") for r in item["evidence_requirements"] if r.get("kind") == "source_span"]
        matched_ids = sorted({sid for r in ev["requirements"] for sid in r.get("matched_source_ids", [])})
        rows.append({"itemId": item["id"], "behaviorType": item["behavior_type"], "targetBlocks": req_ids,
                     "targetRanks": {sid: next((h.rank for h in hits if h.source_id == sid), None) for sid in matched_ids},
                     "contextMembers": [h.source_id for h in hits], "contextChars": len(context),
                     "contextSha256": hashlib.sha256(context.encode()).hexdigest(),
                     "retrieval": ev, "diagnosis": "retrieval_or_requirement_alignment" if ev["passed"] is False else ("corpus_absence_advisory" if ev["passed"] is None else "retrieval_context_ready")})
    result = {"evalVersion": "w13-eval-v2-dev", "backend": "bm25", "topK": args.k,
              "registrySha256": hashlib.sha256(args.registry.read_bytes()).hexdigest(),
              "items": rows, "modelInvocation": "not_run", "holdout": "not_read"}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"items": len(rows), "passed": sum(r["retrieval"]["passed"] is True for r in rows), "failed": sum(r["retrieval"]["passed"] is False for r in rows), "notApplicable": sum(r["retrieval"]["passed"] is None for r in rows)}, ensure_ascii=False))
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
