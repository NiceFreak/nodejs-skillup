#!/usr/bin/env python3
"""Check candidate criterion source blocks against frozen retrieval configurations.

This is a pre-freeze design gate.  It runs retrieval only, never calls a model,
and emits source-block ranks without echoing candidate queries.
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

from w13rag.retrieval import build_retriever, load_registry, retrieve, to_documents  # noqa: E402


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assert_unprotected(path: Path) -> None:
    resolved = path.resolve()
    for protected in (ROOT / "eval/holdout", ROOT / "evidence/holdout"):
        if resolved == protected.resolve() or protected.resolve() in resolved.parents:
            raise ValueError(f"protected path is not allowed: {path}")


def retrieve_for_backend(backend: str, query: str, k: int, entries: list[dict[str, Any]], cache_dir: Path | None):
    bm25 = build_retriever(to_documents(entries), k=max(k, 50))
    if backend == "bm25":
        return retrieve(bm25, query, k=k)
    if cache_dir is None:
        raise ValueError("--cache-dir is required for dense and rrf")
    from w13rag.retrieval_dense_langchain import build_dense_store, dense_retrieve_langchain

    store = build_dense_store(entries, cache_dir=cache_dir)
    dense_hits = dense_retrieve_langchain(store, entries, query, k=50)
    if backend == "dense":
        return dense_hits[:k]
    from w13rag.retrieval_hybrid import rrf_fuse

    return rrf_fuse(retrieve(bm25, query, k=50), dense_hits, top_k=k)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", type=Path, required=True)
    ap.add_argument("--registry", type=Path, required=True)
    ap.add_argument("--backend", choices=["bm25", "dense", "rrf", "all"], default="all")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--cache-dir", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    assert_unprotected(args.items)
    assert_unprotected(args.registry)
    items = json.loads(args.items.read_text(encoding="utf-8"))
    entries = load_registry(args.registry)
    registry_ids = {entry["source_id"] for entry in entries}
    backends = ["bm25", "dense", "rrf"] if args.backend == "all" else [args.backend]

    rows: list[dict[str, Any]] = []
    for item in items["items"]:
        criteria_rows = []
        for criterion in item["criteria"]:
            for source_block in criterion["source_blocks"]:
                if source_block not in registry_ids:
                    raise ValueError(f"unregistered criterion source block: {source_block}")
                backend_rows = []
                for backend in backends:
                    hits = retrieve_for_backend(backend, item["query"], args.k, entries, args.cache_dir)
                    rank_by_id = {hit.source_id: index + 1 for index, hit in enumerate(hits)}
                    rank = rank_by_id.get(source_block)
                    backend_rows.append(
                        {"backend": backend, "topK": args.k, "sourceBlock": source_block, "rank": rank, "recalled": rank is not None}
                    )
                recalled_count = sum(row["recalled"] for row in backend_rows)
                status = "pass" if recalled_count == len(backends) else "design_gap" if recalled_count == 0 else "observation"
                criteria_rows.append(
                    {
                        "criterionId": criterion["id"],
                        "sourceBlock": source_block,
                        "backendResults": backend_rows,
                        "status": status,
                    }
                )
        rows.append({"itemId": item["id"], "criteria": criteria_rows})

    statuses = [criterion["status"] for row in rows for criterion in row["criteria"]]
    result = {
        "schemaVersion": 1,
        "checkId": "criteria-source-recallability",
        "candidateSetId": items.get("candidateSetId"),
        "registrySha256": sha256(args.registry),
        "backendSet": backends,
        "topK": args.k,
        "items": rows,
        "summary": {
            "criteria": len(statuses),
            "pass": statuses.count("pass"),
            "observation": statuses.count("observation"),
            "designGap": statuses.count("design_gap"),
            "freezeGate": "pass" if "design_gap" not in statuses else "blocked",
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
