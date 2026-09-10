#!/usr/bin/env python3
"""run-retrieval-eval — W13 §3.4 第 3 步：retrieval-only eval（BM25 / dense 同口径，不调用模型）。

用法（从 week13-rag 运行）：
  .venv/bin/python scripts/run-retrieval-eval.py --backend bm25  --k 10 --out evidence/retrieval/dev-bm25-top10-02.json
  .venv/bin/python scripts/run-retrieval-eval.py --backend dense --k 10 --out evidence/retrieval/dev-dense-top10-01.json

两种 backend 共用 B4.1 判定体系（`retrieval.evaluate_item_retrieval`），差异只在打分方式；
dense 额外记录 W13 计划 §8 要求的 provider / batch / 截断 / 冷启动 / 吞吐 / 查询 p50-p95 / 峰值 RSS / 缓存身份。

边界：只读冻结 registry 与 `eval/dev/`；不读 holdout；不调用模型 API；不修改冻结对象。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from w13rag.generation import load_dev_items  # noqa: E402
from w13rag.retrieval import (  # noqa: E402
    TOP_K,
    build_retriever,
    evaluate_item_retrieval,
    load_registry,
    retrieve,
    to_documents,
)

MANIFEST = ROOT / "corpus/rules-c0a4b85/manifest.json"
REGISTRY = ROOT / "evidence/serialization/registry-rules-c0a4b85.json"


def summarize(results: list[dict]) -> dict:
    applicable = [r for r in results if r["retrieval"]["passed"] is not None]
    passed = [r for r in applicable if r["retrieval"]["passed"]]
    failed = [r for r in applicable if not r["retrieval"]["passed"]]
    not_applicable = [r for r in results if r["retrieval"]["passed"] is None]
    coverages = [
        req["coverage"]
        for r in results
        for req in r["retrieval"]["requirements"]
        if req["coverage"] is not None
    ]
    return {
        "items": len(results),
        "applicable_items": len(applicable),
        "passed_items": [r["itemId"] for r in passed],
        "failed_items": [r["itemId"] for r in failed],
        "not_applicable_items": [r["itemId"] for r in not_applicable],
        "split_gate": {
            "rule": "all applicable items pass (B4.1)",
            "passed": len(passed) == len(applicable) and bool(applicable),
            "passed_count": len(passed),
            "applicable_count": len(applicable),
        },
        "coverage_min": min(coverages) if coverages else None,
        "coverage_mean": (sum(coverages) / len(coverages)) if coverages else None,
    }


def _dense_setup() -> tuple[dict, list[dict], np.ndarray, Any, Any]:
    """加载 e5 ONNX 运行时并取得（或计算）572 个 passage 向量；返回 (perf, entries, matrix)。"""
    from w13rag.retrieval_dense import (
        BATCH_SIZE,
        MAX_LEN,
        PROVIDERS,
        build_corpus_embeddings,
        load_session,
        load_tokenizer,
        peak_rss_mb,
    )

    started = time.perf_counter()
    session = load_session()
    tokenizer = load_tokenizer()
    cold_start = time.perf_counter() - started
    entries = load_registry()
    matrix, identity, stats = build_corpus_embeddings(entries, session=session, tokenizer=tokenizer)
    perf = {
        "provider": session.get_providers(),
        "configuredProviders": PROVIDERS,
        "batchSize": BATCH_SIZE,
        "maxLen": MAX_LEN,
        "coldStartS": round(cold_start, 3),
        "passageEmbedding": stats,
        "identity": identity.as_dict(),
        "peakRssMb": peak_rss_mb(),
    }
    return perf, entries, matrix, session, tokenizer


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", choices=["bm25", "dense", "hybrid"], default="bm25")
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--k", type=int, default=TOP_K)
    args = ap.parse_args()

    items = load_dev_items()
    entries = load_registry()
    perf: dict[str, Any] = {}
    latencies: list[float] = []

    if args.backend == "bm25":
        documents = to_documents(entries)
        retriever = build_retriever(documents, k=args.k)
        print(f"[run] backend=bm25 documents={len(documents)} top_k={args.k} items={len(items)}")
    else:
        from w13rag.retrieval_dense import dense_retrieve, embed_queries

        perf, entries, matrix, session, tokenizer = _dense_setup()
        if args.backend == "hybrid":
            from w13rag.retrieval_hybrid import HYBRID_CANDIDATES

            retriever = build_retriever(to_documents(entries), k=HYBRID_CANDIDATES)
        print(f"[run] backend={args.backend} passages={len(entries)} top_k={args.k} items={len(items)}")
        print(
            "[perf] provider={} cold_start={}s passage_embedding={} peak_rss={}MB".format(
                perf["provider"], perf["coldStartS"], perf["passageEmbedding"], perf["peakRssMb"]
            )
        )

    results = []
    for index, item in enumerate(items, 1):
        started = time.perf_counter()
        if args.backend == "bm25":
            hits = retrieve(retriever, item["query"], k=args.k)
        else:
            query_vector = embed_queries([item["query"]], session=session, tokenizer=tokenizer)[0]
            if args.backend == "hybrid":
                from w13rag.retrieval_hybrid import HYBRID_CANDIDATES, rrf_fuse

                bm25_hits = retrieve(retriever, item["query"], k=HYBRID_CANDIDATES)
                dense_hits = dense_retrieve(query_vector, matrix, entries, k=HYBRID_CANDIDATES)
                hits = rrf_fuse(bm25_hits, dense_hits, top_k=args.k)
            else:
                hits = dense_retrieve(query_vector, matrix, entries, k=args.k)
        latency_ms = (time.perf_counter() - started) * 1000
        latencies.append(latency_ms)
        evaluation = evaluate_item_retrieval(item, hits)
        checked = evaluation["requirements_checked"]
        hit_count = sum(1 for r in evaluation["requirements"] if r["hit"])
        results.append(
            {
                "itemId": item["id"],
                "behaviorType": item["behavior_type"],
                "query": item["query"],
                "expectedBranch": item["expected_branch"],
                "hits": [h.as_dict() for h in hits],
                "retrieval": evaluation,
                "latencyMs": round(latency_ms, 2),
            }
        )
        print(
            f"[{index}/{len(items)}] {item['id']:44s} top1={hits[0].source_id if hits else '-':28s} "
            f"score1={hits[0].score if hits else 0:8.4f} req_hit={hit_count}/{checked} "
            f"passed={evaluation['passed']} {latency_ms:7.1f}ms",
            flush=True,
        )

    summary = summarize(results)
    if args.backend in ("dense", "hybrid"):
        perf["queryLatencyMsP50"] = round(float(np.percentile(latencies, 50)), 2)
        perf["queryLatencyMsP95"] = round(float(np.percentile(latencies, 95)), 2)
        perf["queryLatencyMsMax"] = round(float(max(latencies)), 2)
    print("[summary]", json.dumps(summary, ensure_ascii=False))

    tz = timezone(timedelta(hours=8))
    if args.backend == "bm25":
        retrieval_block: dict[str, Any] = {
            "backend": "bm25",
            "topK": args.k,
            "tokenizer": "cjk-adjacent-bigram + latin-alnum-on-non-alnum",
            "normalization": "NFKC + lowercase",
            "tieBreak": "registry_index asc",
            "order": "score desc",
            "implementation": "langchain_community.retrievers.BM25Retriever (+ explicit scoring/sort)",
        }
    else:
        retrieval_block = {
            "backend": "dense",
            "topK": args.k,
            "model": "intfloat/multilingual-e5-small (ONNX fp32)",
            "prefixes": {"query": "query: ", "passage": "passage: "},
            "pooling": "mean over last_hidden_state weighted by attention_mask",
            "normalized": True,
            "similarity": "normalized inner product (= cosine)",
            "tieBreak": "registry_index asc",
            "order": "score desc",
            "performance": perf,
        }
        if args.backend == "hybrid":
            retrieval_block["backend"] = "hybrid"
            retrieval_block["rrf"] = {
                "k": 60,
                "candidatePoolPerRanker": 50,
                "rankers": ["bm25", "dense"],
            }

    evidence = {
        "schemaVersion": 1,
        "evidenceId": f"dev-retrieval-{args.backend}-top{args.k}",
        "createdAt": datetime.now(tz).isoformat(timespec="seconds"),
        "runMode": f"retrieval-only-{args.backend}",
        "retrieval": retrieval_block,
        "corpus": {
            "snapshotId": "rules-c0a4b85",
            "manifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
            "registrySha256": hashlib.sha256(REGISTRY.read_bytes()).hexdigest(),
            "registryEntries": len(entries),
        },
        "runtime": {"python": platform.python_version(), "platform": platform.platform()},
        "items": results,
        "summary": summary,
        "boundaries": [
            "Retrieval results are candidates; the Evidence Context actually sent to the model is a separate object.",
            "corpus_absence items are not applicable in retrieval-only evaluation (their evidence is the whole corpus).",
            "BM25 and dense share the same corpus, dev set, top_k and B4.1 gate; only the scoring differs.",
        ],
    }

    out = args.out or (ROOT / f"evidence/retrieval/dev-{args.backend}-top{args.k}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        shown: Path | str = out.relative_to(ROOT)
    except ValueError:
        shown = out
    print(f"[out] {shown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
