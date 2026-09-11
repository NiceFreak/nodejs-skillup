#!/usr/bin/env python3
"""Run the owner-frozen technical-v2 holdout without terminal content echo."""
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
    DeepSeekClient, FROZEN_MAX_TOKENS, FROZEN_MODEL, FROZEN_RESPONSE_FORMAT,
    assemble_messages, load_response_schema, prompt_version, run_item, system_instructions,
)
from w13rag.retrieval import build_retrieval_context, build_retriever, load_registry, retrieve, to_documents  # noqa: E402
from w13rag.scoring import evaluate_item, load_registry_ids, summarize  # noqa: E402

ITEMS = ROOT / "eval/v2-holdout/items.json"
REGISTRY = ROOT / "evidence/technical/technical-v2/registry-technical-9c6e6549b991.json"
MANIFEST = ROOT / "corpus/technical-v2/manifest.json"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_items() -> list[dict]:
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    if data.get("split") != "holdout" or data.get("contract_status") != "frozen":
        raise ValueError("technical-v2 holdout must be frozen and split=holdout")
    if data.get("eval_version") != "w13-eval-v2-holdout":
        raise ValueError("unexpected technical-v2 holdout eval version")
    return list(data["items"])


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--read-timeout", type=float, default=180.0)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    load_env()
    items = load_items()
    entries = load_registry(REGISTRY)
    retriever = build_retriever(to_documents(entries), k=max(args.k, 50))
    registry_ids = load_registry_ids(REGISTRY)
    system = system_instructions()
    schema = load_response_schema()
    client = DeepSeekClient(model=FROZEN_MODEL, timeout=httpx.Timeout(connect=10.0, read=args.read_timeout, write=30.0, pool=10.0))
    rows, evaluations = [], []
    print(f"[run] technical-v2 holdout items={len(items)} context_source=technical snapshot={json.loads(MANIFEST.read_text(encoding='utf-8'))['snapshotId']}")
    print(f"[run] requested_model={FROZEN_MODEL} max_tokens={FROZEN_MAX_TOKENS} response_format={FROZEN_RESPONSE_FORMAT}")
    print("[note] terminal does not echo holdout queries or model responses; details are written to evidence")
    try:
        for index, item in enumerate(items, 1):
            hits = retrieve(retriever, item["query"], k=args.k)
            context = build_retrieval_context(hits, entries)
            record = await run_item(client, item, system=system, evidence_context=context, schema=schema)
            evaluation = evaluate_item(record, item, registry_ids)
            evaluations.append(evaluation)
            messages = assemble_messages(system, context, item["query"])
            rows.append({
                "itemId": item["id"], "behaviorType": item["behavior_type"],
                "query": item["query"], "expectedBranch": item["expected_branch"],
                "hits": [hit.as_dict() for hit in hits],
                "context": {"members": [hit.source_id for hit in hits], "chars": len(context), "sha256": digest(context), "actualModelInputSha256": digest(json.dumps(messages, ensure_ascii=False, sort_keys=True))},
                "record": record.__dict__, "evaluation": evaluation.as_dict(),
            })
            print(f"[{index}/{len(items)}] {item['id']} status={record.status} mechanical_verdict={evaluation.verdict.result} pending={evaluation.verdict.pending} usage={(record.usage or {}).get('total_tokens')}", flush=True)
    finally:
        await client.aclose()
    result = {
        "schemaVersion": 1, "evidenceId": "technical-v2-holdout-run-01", "runMode": "technical-v2-holdout-first-run",
        "firstRun": True, "frozenDeclaration": "owner confirmed formal source and freeze before this run; no tuning from first-run results",
        "corpus": {"snapshotId": json.loads(MANIFEST.read_text(encoding="utf-8"))["snapshotId"], "manifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(), "registrySha256": hashlib.sha256(REGISTRY.read_bytes()).hexdigest()},
        "prompt": {"version": prompt_version(), "systemInstructionsSha256": digest(system)},
        "generation": {"requestedModel": FROZEN_MODEL, "maxTokens": FROZEN_MAX_TOKENS, "responseFormat": FROZEN_RESPONSE_FORMAT, "transport": "chat/completions"},
        "items": rows, "summary": summarize(evaluations), "semanticStatus": "pending_owner_review", "holdout": "new technical-v2 holdout only; legacy protected holdout not read",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("[out]", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
