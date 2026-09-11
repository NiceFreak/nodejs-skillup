#!/usr/bin/env python3
"""run-dense-langchain-e2e — LangChain dense 端到端链路（query -> store 检索 -> context -> generation -> eval）。

**目的与边界（重要）**：

1. 本脚本的用途是验证 LangChain dense 接线可以驱动完整链路并留下证据，**不用于质量验收**。
2. W13 计划 §3.4 规定「retrieval-only eval 未通过时不执行 generation」；dense 的 retrieval-only 门禁同样未通过
   （k=10/20/30 = 3/4/5，分母 8）。本次执行是**本人于 2026-09-11 明确授权的计划变更**（授权替代方案：
   「执行 dense e2e，不新增 retrieval-only 证据文件」），不改变检索门禁与 9 配置对照的结论。
3. 与 `run-bm25-e2e.py` 同题对照：同一 10 条 dev、同一 top_k、同一 Prompt / schema / 客户端配置、
   同一 `build_retrieval_context()`（D3 wrapper）与同一 `evaluate_item()`；唯一差异是检索实现
   （`build_dense_store()` + `dense_retrieve_langchain()`）。
4. 向量来自冻结 `.npy` 缓存（D-C a2 identity 门槛，不重算）；查询侧按 D2 现算。

用法（从 week13-rag 运行）：

    .venv/bin/python scripts/run-dense-langchain-e2e.py --k 10

边界：只读冻结 registry、`eval/dev/` 与 `.cache/`；不读 holdout；不改动任何冻结对象。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import platform
import sys
import time
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
from w13rag.retrieval import TOP_K, build_retrieval_context, load_registry  # noqa: E402
from w13rag.retrieval_dense_langchain import (  # noqa: E402
    build_dense_store,
    dense_retrieve_langchain,
)
from w13rag.scoring import evaluate_item, load_registry_ids, summarize  # noqa: E402

MANIFEST = ROOT / "corpus/rules-c0a4b85/manifest.json"
SCHEMA_PATH = ROOT / "schemas/rag-response-v1.schema.json"
CACHE_DIR = ROOT / ".cache/embeddings"


def build_evidence(
    items, hits_per_item, contexts, records, evaluations, args, system, schema, store_stats
) -> dict:
    tz = timezone(timedelta(hours=8))
    return {
        "schemaVersion": 1,
        "evidenceId": f"dev-dense-langchain-e2e-top{args.k}",
        "createdAt": datetime.now(tz).isoformat(timespec="seconds"),
        "runMode": "dense-langchain-end-to-end",
        "purpose": "repeatable-run evidence for the LangChain dense retrieval-to-generation chain; NOT a quality verdict",
        "gateNote": (
            "Executed despite the retrieval-only gate not passing, as an explicitly accepted plan change "
            "by the owner on 2026-09-11."
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
            "backend": "dense-langchain",
            "topK": args.k,
            "implementation": "langchain_core.vectorstores.InMemoryVectorStore + w13rag.retrieval_dense_langchain.E5Embeddings",
            "model": "intfloat/multilingual-e5-small (ONNX fp32)",
            "prefixes": {"query": "query: ", "passage": "passage: "},
            "pooling": "mean over last_hidden_state weighted by attention_mask",
            "normalized": True,
            "similarity": "cosine (framework path)",
            "order": "score desc",
            "tieBreak": "registry_index asc (explicit project-side re-sort)",
            "vectorSource": ".cache/embeddings/e5-small-passages-572.npy (identity-gated, no recompute)",
            "storeIds": "frozen source_id",
            "contextAssembly": "D3 wrapper via build_retrieval_context",
            "storeStats": store_stats,
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
            "Retrieval-only gate did not pass (dense 3-5/8); this run does not change that conclusion.",
            "The LangChain path is equivalent to dense_retrieve on the same 10 dev queries "
            "(top-10 order and set identical; score diff <= 7.31e-08) per scripts/verify-dense-langchain-equiv.py.",
            "Context contains only retrieved blocks, wrapped by the frozen D3 serializer.",
            "Semantic evaluators stay pending until the human checklist is recorded.",
            "A single run cannot separate run-to-run model variation; no retry policy is applied.",
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
    started = time.perf_counter()
    store = build_dense_store(entries)
    store_stats = {
        "buildSeconds": round(time.perf_counter() - started, 3),
        "storeKeys": len(store.store),
        "vectorRows": len(entries),
        "cacheDir": str(CACHE_DIR.relative_to(ROOT)),
    }
    items = load_dev_items()
    system = system_instructions()
    schema = load_response_schema()
    registry_ids = load_registry_ids()

    print(f"[run] dense-langchain-e2e items={len(items)} top_k={args.k} entries={len(entries)}")
    print(f"[store] built in {store_stats['buildSeconds']}s keys={store_stats['storeKeys']}")
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
            hits = dense_retrieve_langchain(store, entries, item["query"], k=args.k)
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

    out = args.out or (
        ROOT / f"evidence/dense-langchain-e2e/dev-dense-langchain-e2e-top{args.k}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            build_evidence(
                items, hits_per_item, contexts, records, evaluations, args, system, schema, store_stats
            ),
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
