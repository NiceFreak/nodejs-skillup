#!/usr/bin/env python3
"""run-holdout-eval — W13 首次 holdout 运行入口（唯一允许触达 `eval/holdout/` 的通道）。

用法（从 week13-rag 运行）：
  .venv/bin/python scripts/run-holdout-eval.py --out evidence/holdout/dev-holdout-prompt-v1-01.json

**受保护内容约束（AGENTS.md §1.3）**：本脚本读取 `eval/holdout/items.json`，但**不回显题面与答案**——
终端只输出 `item_id`、`status`、`verdict`、失败原因、usage 与延迟；题面与模型响应只写入证据文件
（`evidence/holdout/`，不在受保护目录内），供本人阅读与人工语义判定。

**实现冻结声明（2026-09-10 由本人声明）**：本入口用于**首次** holdout 运行。运行窗口内实现、Prompt、
请求配置与评分规则保持冻结；首次结果**不得**反向用于选择方案或调参，后续只按预先冻结的 regression 节点复跑。

边界：不调用 dev 路径；不改动任何冻结对象；证据写入 `evidence/holdout/`（含题面，需由本人阅读）。
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
    load_evidence_context,
    load_response_schema,
    prompt_version,
    run_item,
    system_instructions,
)
from w13rag.scoring import evaluate_item, load_registry_ids, summarize  # noqa: E402
from src.config import load_env  # noqa: E402  (W12 配置)

HOLDOUT_ITEMS = ROOT / "eval/holdout/items.json"
MANIFEST = ROOT / "corpus/rules-c0a4b85/manifest.json"
CONTEXT = ROOT / "evidence/serialization/evidence-context-rules-c0a4b85.txt"
SCHEMA_PATH = ROOT / "schemas/rag-response-v1.schema.json"


def load_holdout_items(path: Path = HOLDOUT_ITEMS) -> list[dict]:
    """只接受 holdout split；与 dev 入口对称，避免两个 split 混用。"""
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("split") != "holdout":
        raise ValueError(f"拒绝非 holdout split：{path}")
    return list(data["items"])


def build_evidence(items, records, evaluations, args, ctx: str, system: str, schema: dict) -> dict:
    """组装证据：题面与响应只落盘，不回显。"""
    tz = timezone(timedelta(hours=8))
    return {
        "schemaVersion": 1,
        "evidenceId": "holdout-first-run-prompt-v1",
        "createdAt": datetime.now(tz).isoformat(timespec="seconds"),
        "runMode": "holdout-first-run",
        "firstRun": True,
        "frozenDeclaration": (
            "实现、Prompt、请求配置与评分规则在本次运行窗口内冻结（2026-09-10 由本人声明）；"
            "首次结果不得反向用于方案选择或调参。"
        ),
        "corpus": {
            "snapshotId": "rules-c0a4b85",
            "manifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
        },
        "prompt": {
            "version": prompt_version(),
            "path": str(PROMPT_PATH.relative_to(ROOT)),
            "systemInstructionsChars": len(system),
            "systemInstructionsSha256": hashlib.sha256(system.encode()).hexdigest(),
        },
        "responseSchema": {
            "id": schema.get("title"),
            "path": str(SCHEMA_PATH.relative_to(ROOT)),
            "sha256": hashlib.sha256(SCHEMA_PATH.read_bytes()).hexdigest(),
        },
        "evidenceContext": {
            "path": str(CONTEXT.relative_to(ROOT)),
            "chars": len(ctx),
            "sha256": hashlib.sha256(ctx.encode()).hexdigest(),
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
                "record": record.__dict__,
                "evaluation": evaluation.as_dict(),
            }
            for item, record, evaluation in zip(items, records, evaluations)
        ],
        "summary": summarize(evaluations),
        "boundaries": [
            "First holdout run: results must not feed back into方案选择 or tuning.",
            "Semantic evaluators stay pending until the human checklist is recorded.",
            "This file contains holdout queries and responses; read it only where holdout content is allowed.",
        ],
    }


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--read-timeout", type=float, default=180.0)
    args = ap.parse_args()

    load_env()
    items = load_holdout_items()[: args.limit]
    system = system_instructions()
    ctx = load_evidence_context()
    schema = load_response_schema()
    registry_ids = load_registry_ids()

    print(f"[run] holdout items={len(items)} context_chars={len(ctx)} registry_ids={len(registry_ids)}")
    print(
        f"[run] requested_model={FROZEN_MODEL} thinking={FROZEN_THINKING} "
        f"max_tokens={FROZEN_MAX_TOKENS} response_format={FROZEN_RESPONSE_FORMAT}"
    )
    print(f"[run] credential_present={bool(os.environ.get('DEEPSEEK_API_KEY'))}")
    print("[note] 终端不回显题面与响应；两者只写入证据文件（由本人阅读）")

    client = DeepSeekClient(
        model=FROZEN_MODEL,
        timeout=httpx.Timeout(connect=10.0, read=args.read_timeout, write=30.0, pool=10.0),
    )
    records, evaluations = [], []
    try:
        for index, item in enumerate(items, 1):
            record = await run_item(
                client, item, system=system, evidence_context=ctx, schema=schema
            )
            evaluation = evaluate_item(record, item, registry_ids)
            records.append(record)
            evaluations.append(evaluation)
            usage = (record.usage or {}).get("total_tokens")
            print(
                f"[{index}/{len(items)}] {item['id']} status={record.status} "
                f"retryable={evaluation.run.retryable} verdict={evaluation.verdict.result} "
                f"reasons={evaluation.verdict.reasons} pending={evaluation.verdict.pending} "
                f"usage={usage} served={record.served_model} latency_ms={record.latency_ms}",
                flush=True,
            )
    finally:
        await client.aclose()

    out = args.out or (
        ROOT / f"evidence/holdout/holdout-first-run-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            build_evidence(items, records, evaluations, args, ctx, system, schema),
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
    print("[next] 由本人执行语义判定素材生成："
          f".venv/bin/python scripts/build-semantic-worksheet.py --evidence {shown} "
          "--out notes/holdout-semantic-checklist.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
