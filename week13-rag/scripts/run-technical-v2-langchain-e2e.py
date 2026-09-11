#!/usr/bin/env python3
"""Run the confirmed technical-v2 LangChain RAG slice end to end.

The runner uses the explicit technical-v2 registry and confirmed dev items,
BM25 retrieval, the shared context serializer, and the existing DeepSeek
ChatModel transport.  It records request/response status and context hashes;
it does not read holdout material or alter historical v1 evidence.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import httpx
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT.parent / "week12-python-rag"))

from src.config import load_env  # noqa: E402
from w13rag.generation import (  # noqa: E402
    DeepSeekClient,
    FROZEN_MAX_TOKENS,
    FROZEN_MODEL,
    FROZEN_RESPONSE_FORMAT,
    FROZEN_THINKING,
    assemble_messages,
    load_dev_items,
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
from w13rag.scoring import evaluate_item, load_registry_ids, summarize  # noqa: E402


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", type=Path, default=ROOT / "eval/v2-dev/items.json")
    ap.add_argument("--registry", type=Path, default=ROOT / "evidence/technical/technical-v2/registry-technical-9c6e6549b991.json")
    ap.add_argument("--manifest", type=Path, default=ROOT / "corpus/technical-v2/manifest.json")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--read-timeout", type=float, default=180.0)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    load_env()
    items = load_dev_items(args.items)
    entries = load_registry(args.registry)
    retriever = build_retriever(to_documents(entries), k=max(args.k, 50))
    registry_ids = load_registry_ids(args.registry)
    system = system_instructions()
    schema = load_response_schema()
    client = DeepSeekClient(
        model=FROZEN_MODEL,
        timeout=httpx.Timeout(connect=10.0, read=args.read_timeout, write=30.0, pool=10.0),
    )
    rows = []
    evaluations = []
    try:
        for index, item in enumerate(items, 1):
            hits = retrieve(retriever, item["query"], k=args.k)
            context = build_retrieval_context(hits, entries)
            evidence_kinds = {req.get("kind") for req in item["evidence_requirements"]}
            if evidence_kinds == {"diagnostic_fixture"}:
                rows.append({
                    "itemId": item["id"],
                    "behaviorType": item["behavior_type"],
                    "query": item["query"],
                    "expectedBranch": item["expected_branch"],
                    "generationApplicability": "fixture_only",
                    "hits": [hit.as_dict() for hit in hits],
                    "context": {"members": [hit.source_id for hit in hits], "chars": len(context), "sha256": digest(context), "actualModelInput": "not_run"},
                    "record": {"status": "fixture_not_model_scored"},
                    "evaluation": None,
                })
                print(f"[{index}/{len(items)}] {item['id']} fixture_only (model not invoked)", flush=True)
                continue
            record = await run_item(client, item, system=system, evidence_context=context, schema=schema)
            evaluation = evaluate_item(record, item, registry_ids)
            evaluations.append(evaluation)
            messages = assemble_messages(system, context, item["query"])
            rows.append({
                "itemId": item["id"],
                "behaviorType": item["behavior_type"],
                "query": item["query"],
                "expectedBranch": item["expected_branch"],
                "hits": [hit.as_dict() for hit in hits],
                "context": {
                    "members": [hit.source_id for hit in hits],
                    "chars": len(context),
                    "sha256": digest(context),
                    "actualModelInputSha256": digest(json.dumps(messages, ensure_ascii=False, sort_keys=True)),
                },
                "record": record.__dict__,
                "evaluation": evaluation.as_dict(),
            })
            print(
                f"[{index}/{len(items)}] {item['id']} status={record.status} "
                f"verdict={evaluation.verdict.result} ctx_chars={len(context)} "
                f"usage={(record.usage or {}).get('total_tokens')}",
                flush=True,
            )
    finally:
        await client.aclose()

    result = {
        "schemaVersion": 1,
        "evidenceId": f"technical-v2-langchain-e2e-k{args.k}",
        "runMode": "technical-v2-langchain-end-to-end",
        "purpose": "confirmed technical-v2 fixed-chain diagnostic evidence; semantic verdicts remain bounded by recorded evaluators",
        "corpus": {
            "snapshotId": json.loads(args.manifest.read_text(encoding="utf-8"))["snapshotId"],
            "manifestSha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
            "registrySha256": hashlib.sha256(args.registry.read_bytes()).hexdigest(),
        },
        "prompt": {"version": prompt_version(), "systemInstructionsSha256": digest(system)},
        "generation": {
            "requestedModel": FROZEN_MODEL,
            "thinking": FROZEN_THINKING,
            "maxTokens": FROZEN_MAX_TOKENS,
            "responseFormat": FROZEN_RESPONSE_FORMAT,
            "transport": "chat/completions",
        },
        "items": rows,
        "summary": summarize(evaluations),
        "holdout": "not_read",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("[out]", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
