#!/usr/bin/env python3
"""Run technical-v2 retrieval-only diagnostics for BM25, dense, or RRF.

The command reads only an explicit dev items file, technical-v2 registry and
manifest.  It never opens holdout or invokes a model.  Dense/RRF use the
LangChain ``InMemoryVectorStore`` adapter with an explicitly supplied cache.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from w13rag.generation import load_dev_items  # noqa: E402
from w13rag.retrieval import (  # noqa: E402
    build_retrieval_context,
    build_retriever,
    evaluate_item_retrieval,
    load_registry,
    retrieve,
    to_documents,
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", choices=["bm25", "dense", "rrf"], required=True)
    ap.add_argument("--items", type=Path, required=True)
    ap.add_argument("--registry", type=Path, required=True)
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--cache-dir", type=Path, help="dense cache directory (required for dense/rrf)")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    items = load_dev_items(args.items)
    entries = load_registry(args.registry)
    bm25 = build_retriever(to_documents(entries), k=max(args.k, 50))
    dense_store = None
    cache_identity = None
    if args.backend in {"dense", "rrf"}:
        if args.cache_dir is None:
            ap.error("--cache-dir is required for dense/rrf")
        from w13rag.retrieval_dense_langchain import build_dense_store

        dense_store = build_dense_store(entries, cache_dir=args.cache_dir)
        identity_path = args.cache_dir / f"e5-small-passages-{len(entries)}.identity.json"
        cache_identity = json.loads(identity_path.read_text(encoding="utf-8"))

    rows: list[dict[str, Any]] = []
    for item in items:
        if args.backend == "bm25":
            hits = retrieve(bm25, item["query"], k=args.k)
        else:
            from w13rag.retrieval_dense_langchain import dense_retrieve_langchain

            dense_hits = dense_retrieve_langchain(dense_store, entries, item["query"], k=50)
            if args.backend == "dense":
                hits = dense_hits[: args.k]
            else:
                from w13rag.retrieval_hybrid import rrf_fuse

                hits = rrf_fuse(retrieve(bm25, item["query"], k=50), dense_hits, top_k=args.k)
        context = build_retrieval_context(hits, entries)
        retrieval = evaluate_item_retrieval(item, hits)
        member_ids = [hit.source_id for hit in hits]
        target_ids = [
            req["span_id"]
            for req in item["evidence_requirements"]
            if req.get("kind") == "source_span"
        ]
        rank_by_id = {hit.source_id: hit.rank for hit in hits}
        rows.append(
            {
                "itemId": item["id"],
                "behaviorType": item["behavior_type"],
                "query": item["query"],
                "expectedBranch": item["expected_branch"],
                "targetBlocks": target_ids,
                "targetRanks": {target: rank_by_id.get(target) for target in target_ids},
                "hits": [hit.as_dict() for hit in hits],
                "contextMembers": [hit.source_id for hit in hits],
                "contextChars": len(context),
                "contextSha256": hashlib.sha256(context.encode("utf-8")).hexdigest(),
                "contextDiagnostics": {
                    "duplicateMembers": len(member_ids) != len(set(member_ids)),
                    "orderedByRank": [hit.rank for hit in hits] == list(range(1, len(hits) + 1)),
                    "budgetChars": None,
                    "actualModelInput": "not_run",
                },
                "retrieval": retrieval,
                "diagnosis": (
                    "retrieval_or_requirement_alignment"
                    if retrieval["passed"] is False
                    else "corpus_or_fixture_not_retrieval_scored"
                    if retrieval["passed"] is None
                    else "retrieval_context_ready"
                ),
            }
        )

    applicable = [row for row in rows if row["retrieval"]["passed"] is not None]
    passed = [row for row in applicable if row["retrieval"]["passed"]]
    result = {
        "schemaVersion": 1,
        "evalVersion": "w13-eval-v2-dev",
        "backend": args.backend,
        "topK": args.k,
        "manifestSha256": sha256(args.manifest),
        "registrySha256": sha256(args.registry),
        "denseCacheIdentity": cache_identity,
        "items": rows,
        "summary": {
            "items": len(rows),
            "applicableItems": len(applicable),
            "passedItems": [row["itemId"] for row in passed],
            "failedItems": [row["itemId"] for row in applicable if not row["retrieval"]["passed"]],
            "notApplicableItems": [row["itemId"] for row in rows if row["retrieval"]["passed"] is None],
            "splitGate": len(applicable) > 0 and len(passed) == len(applicable),
        },
        "modelInvocation": "not_run",
        "holdout": "not_read",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False))
    print(f"[out] {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
