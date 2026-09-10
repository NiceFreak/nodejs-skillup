#!/usr/bin/env python3
"""run-bm25-e2e — BM25 端到端链路（query -> retrieval -> context assembly -> generation -> eval）。

**目的与边界（重要）**：

1. 本脚本的用途是验证该链路**可以独立重复运行**并留下完整证据，**不用于质量验收**。
2. W13 计划 §3.4 的止步条件规定「retrieval-only eval 未通过时不执行 BM25 generation」；本次执行是**本人明确
   决定的计划变更**，不改变 retrieval 门禁未通过的结论（D4 笔记 §6.21 记录该变更与理由）。
3. 输入构造只改变「哪些块被放进 wrapper」：复用 `build_retrieval_context()`（B3.2 顺序 + D3 wrapper 字节规则）
   与 `run_item()`（同一 Prompt、同一客户端配置、同一 response schema、同一组装函数）。

用法（从 week13-rag 运行）：
  .venv/bin/python scripts/run-bm25-e2e.py --k 10 --out evidence/bm25-e2e/dev-bm25-e2e-top10-01.json

边界：只读冻结 registry 与 `eval/dev/`；不读 holdout；不改动任何冻结对象。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import platform
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from w13rag.generation import (  # noqa: E402
    FROZEN_MAX_TOKENS,
    FROZEN_MODEL,
    FROZEN_RESPONSE_FORMAT,
    FROZEN_THINKING,
    PROMPT_PATH,
    DeepSeekClient,
    load_dev_items,
    load_response_schema,
    prompt_version,
    run_item,
    system_instructions,
)
from src.config import load_env  # noqa: E402  (W12 配置；generation 已把 W12 根目录加入 sys.path)
from w13rag.retrieval import (  # noqa: E402
    TOP_K,
    build_retrieval_context,
    build_retriever,
    load_registry,
    retrieve,
    to_documents,
)
from w13rag.scoring import evaluate_item, load_registry_ids, summarize  # noqa: E402

MANIFEST = ROOT / "corpus/rules-c0a4b85/manifest.json"
SCHEMA_PATH = ROOT / "schemas/rag-response-v1.schema.json"


def build_evidence(items, hits_per_item, contexts, records, evaluations, args, system, schema) -> dict:
    tz = timezone(timedelta(hours=8))
    return {
        "schemaVersion": 1,
        "evidenceId": f"dev-bm25-e2e-top{args.k}",
        "createdAt": datetime.now(tz).isoformat(timespec="seconds"),
        "runMode": "bm25-end-to-end",
        "purpose": "repeatable-run evidence for the retrieval-to-generation chain; NOT a quality verdict",
        "gateNote": (
            "Executed despite the retrieval-only gate not passing, as an explicitly accepted plan change by the owner."
        ),
        "corpus": {
            "snapshotId": "rules-c0a4b85",
            "manifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
        },
        "prompt": {
            "version": prompt_version(),
            "path": str(PROMPT_PATH.relative_to(ROOT)),
            "systemInstructionsSha256": hashlib.sha256(system.encode()).hexdigest(),
        },
        "responseSchema": {
            "id": schema.get("title"),
            "path": str(SCHEMA_PATH.relative_to(ROOT)),
            "sha256": hashlib.sha256(SCHEMA_PATH.read_bytes()).hexdigest(),
        },
        "retrieval": {
            "backend": "bm25",
            "topK": args.k,
            "tokenizer": "cjk-adjacent-bigram + latin-alnum-on-non-alnum",
            "tieBreak": "registry_index asc",
            "order": "score desc",
            "contextAssembly": "D3 wrapper via build_retrieval_context",
        },
        "generation": {
            "requestedModel": FROZEN_MODEL,
            "thinking": FROZEN_THINKING,
            "maxTokens": FROZEN_MAX_TOKENS,
            "responseFormat": FROZEN_RESPONSE_FORMAT,
            "transport": "chat/completions",
            "credentialPresent": bool(os.environ.get("DEEPSEEK_API_KEY")),
        },
        "runtime": {
            "python": platform.python_version(),
            "platform": f"{platform.system()} {platform.release()} {platform.machine()}",
        },
        "items": [
            {
                "itemId": item["id"],
                "behaviorType": item["behavior_type"],
                "query": item["query"],
                "expectedBranch": item["expected_branch"],
                "hits": [hit.as_dict() for hit in hits],
                "context": {
                    "chars": len(context),
                    "sha256": hashlib.sha256(context.encode()).hexdigest(),
                },
                "record": record.__dict__,
                "evaluation": evaluation.as_dict(),
            }
            for item, hits, context, record, evaluation in zip(
                items, hits_per_item, contexts, records, evaluations
            )
        ],
        "summary": summarize(evaluations),
        "boundaries": [
            "Purpose is chain reproducibility, not quality acceptance.",
            "Retrieval-only gate did not pass; this run does not change that conclusion.",
            "Context contains only retrieved blocks, wrapped by the frozen D3 serializer.",
            "Semantic evaluators stay pending until the human checklist is recorded.",
        ],
    }


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=TOP_K)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--read-timeout", type=float, default=180.0)
    args = ap.parse_args()

    load_env()
    entries = load_registry()
    retriever = build_retriever(to_documents(entries), k=args.k)
    items = load_dev_items()
    system = system_instructions()
    schema = load_response_schema()
    registry_ids = load_registry_ids()

    print(f"[run] bm25-e2e items={len(items)} top_k={args.k} documents={len(entries)}")
    print(
        f"[run] requested_model={FROZEN_MODEL} thinking={FROZEN_THINKING} "
        f"max_tokens={FROZEN_MAX_TOKENS} response_format={FROZEN_RESPONSE_FORMAT}"
    )
    print("[purpose] chain reproducibility evidence only; NOT a quality verdict")

    client = DeepSeekClient(
        model=FROZEN_MODEL,
        timeout=httpx.Timeout(connect=10.0, read=args.read_timeout, write=30.0, pool=10.0),
    )
    hits_per_item: list[list] = []
    contexts: list[str] = []
    records: list = []
    evaluations: list = []
    try:
        for index, item in enumerate(items, 1):
            hits = retrieve(retriever, item["query"], k=args.k)
            context = build_retrieval_context(hits, entries)
            record = await run_item(
                client, item, system=system, evidence_context=context, schema=schema
            )
            evaluation = evaluate_item(record, item, registry_ids)
            hits_per_item.append(hits)
            contexts.append(context)
            records.append(record)
            evaluations.append(evaluation)
            print(
                f"[{index}/{len(items)}] {item['id']} hits={len(hits)} ctx_chars={len(context)} "
                f"status={record.status} verdict={evaluation.verdict.result} "
                f"reasons={evaluation.verdict.reasons} "
                f"usage={(record.usage or {}).get('total_tokens')} latency_ms={record.latency_ms}",
                flush=True,
            )
    finally:
        await client.aclose()

    out = args.out or (ROOT / "evidence/bm25-e2e/dev-bm25-e2e.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            build_evidence(items, hits_per_item, contexts, records, evaluations, args, system, schema),
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    summary = summarize(evaluations)
    print("[summary]", json.dumps(summary, ensure_ascii=False))
    try:
        shown: Path | str = out.relative_to(ROOT)
    except ValueError:
        shown = out
    print(f"[out] {shown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
