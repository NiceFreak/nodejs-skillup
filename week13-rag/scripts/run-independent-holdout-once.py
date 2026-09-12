#!/usr/bin/env python3
"""Run the explicitly frozen independent holdout once.

This entry point reads only eval/independent-holdout and the technical-v2
registry. It records the fixed BM25 LangChain retrieval path and leaves
claim_support/evidence_coverage for owner semantic review.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT.parent / "week12-python-rag"))

from src.config import load_env  # noqa: E402
from w13rag.generation import (  # noqa: E402
    DeepSeekClient,
    assemble_messages,
    load_response_schema,
    prompt_version,
    run_item,
    system_instructions,
)
from w13rag.retrieval import (  # noqa: E402
    build_retrieval_context,
    build_retriever,
    load_registry,
    retrieve,
    to_documents,
)
from w13rag.scoring import evaluate_item, load_registry_ids  # noqa: E402


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", type=Path, default=ROOT / "eval/independent-holdout/technical-v2-independent-holdout-01.json")
    ap.add_argument("--registry", type=Path, default=ROOT / "evidence/technical/technical-v2/registry-technical-9c6e6549b991.json")
    ap.add_argument("--manifest", type=Path, default=ROOT / "corpus/technical-v2/manifest.json")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--read-timeout", type=float, default=180.0)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    holdout = json.loads(args.items.read_text(encoding="utf-8"))
    if holdout.get("status") != "frozen" or not holdout.get("freezeAuthorized"):
        raise ValueError("independent holdout is not frozen")
    if holdout.get("holdoutRunAuthorized") is not True:
        raise ValueError("independent holdout run is not authorized")
    if holdout.get("runCountAfterFreeze") != 0:
        raise ValueError("independent holdout has already been run")
    if holdout.get("holdout") != "not_read":
        raise ValueError("holdout boundary marker is invalid")

    load_env()
    items = holdout["items"]
    entries = load_registry(args.registry)
    retriever = build_retriever(to_documents(entries), k=max(args.k, 50))
    registry_ids = load_registry_ids(args.registry)
    system = system_instructions()
    schema = load_response_schema()
    client = DeepSeekClient(
        model="deepseek-v4-flash",
        timeout=httpx.Timeout(connect=10.0, read=args.read_timeout, write=30.0, pool=10.0),
    )
    rows = []
    try:
        for index, item in enumerate(items, 1):
            hits = retrieve(retriever, item["query"], k=args.k)
            context = build_retrieval_context(hits, entries)
            messages = assemble_messages(system, context, item["query"])
            run_item_input = {
                "id": item["id"],
                "query": item["query"],
                "expected_branch": item["expected_branch"],
                "behavior_type": "independent_capability",
                "evidence_requirements": [],
            }
            record = await run_item(client, run_item_input, system=system, evidence_context=context, schema=schema)
            evaluation = evaluate_item(record, run_item_input, registry_ids)
            rows.append({
                "itemId": item["id"],
                "query": item["query"],
                "primaryAbilityLayer": item["primary_ability_layer"],
                "applicableLayers": item["applicable_layers"],
                "hits": [hit.as_dict() for hit in hits],
                "context": {
                    "members": [hit.source_id for hit in hits],
                    "chars": len(context),
                    "sha256": digest(context),
                    "actualModelInputSha256": digest(json.dumps(messages, ensure_ascii=False, sort_keys=True)),
                },
                "record": record.__dict__,
                "mechanicalEvaluation": evaluation.as_dict(),
                "semanticEvaluation": {
                    "claim_support": "pending_owner_review",
                    "evidence_coverage": "pending_owner_review",
                },
            })
            print(f"[{index}/{len(items)}] {item['id']} status={record.status} ctx_chars={len(context)}", flush=True)
    finally:
        await client.aclose()

    result = {
        "schemaVersion": 1,
        "evidenceId": "technical-v2-independent-holdout-01-run-01",
        "runMode": "independent-holdout-once",
        "evaluationUse": "independent_capability_holdout",
        "backend": "bm25_langchain_fixed_chain",
        "holdoutId": holdout["holdoutId"],
        "freezeManifestSha256": hashlib.sha256((args.items.parent / "manifest.json").read_bytes()).hexdigest(),
        "corpus": {
            "snapshotId": json.loads(args.manifest.read_text(encoding="utf-8"))["snapshotId"],
            "manifestSha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
            "registrySha256": hashlib.sha256(args.registry.read_bytes()).hexdigest(),
        },
        "prompt": {"version": prompt_version(), "systemInstructionsSha256": digest(system)},
        "items": rows,
        "semanticStatus": "pending_owner_review",
        "benchmarkPass": None,
        "holdout": "not_read",
        "runCountAfterFreeze": 1,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("[out]", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
