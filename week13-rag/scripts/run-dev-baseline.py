#!/usr/bin/env python3
"""run-dev-baseline — W13 阶段 4：全语料上下文 dev baseline（真实调用，非检索）。

用法（从 week13-rag 运行）：
  .venv/bin/python scripts/run-dev-baseline.py --limit 1 --out evidence/baseline/smoke-dev-01.json
  .venv/bin/python scripts/run-dev-baseline.py                      # 10 条，输出带时间戳

边界：
- 只读 `eval/dev/`；不读取 holdout。
- 不复制 HTTP 客户端：复用 W12 `DeepSeekClient`，经 `w13rag.generation.run_item` 组装与分层。
- 凭据由 W12 `load_env()` 从 `week12-python-rag/.env` 读取；本脚本不打印任何凭据，只记录键是否存在。
- 每题落盘：请求侧配置、服务端身份、provider usage、延迟、原始响应，以及 `run` / `evaluators` / `verdict`
  三段评估。人工语义 checklist 不在此脚本内（由本人完成），因此语义 evaluator 为 `passed=None`（pending），
  但 pending 不会遮住已确定的失败；若机械失败已足以否决 split，则 `split_status=fail`，
  尚不能决定且仍有待判项时才为 `incomplete`。
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import platform
import sys
from datetime import datetime, timezone, timedelta
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
    load_evidence_context,
    load_response_schema,
    prompt_version,
    run_item,
    system_instructions,
)
from w13rag.scoring import evaluate_item, load_registry_ids, summarize  # noqa: E402
from src.config import load_env  # noqa: E402  (W12 配置；generation 已把 W12 根目录加入 sys.path)

MANIFEST = ROOT / "corpus/rules-c0a4b85/manifest.json"
CONTEXT = ROOT / "evidence/serialization/evidence-context-rules-c0a4b85.txt"
SCHEMA_PATH = ROOT / "schemas/rag-response-v1.schema.json"


def build_evidence(evaluations, args, ctx: str, system: str, schema: dict) -> dict:
    tz = timezone(timedelta(hours=8))
    return {
        "schemaVersion": 1,
        "evidenceId": "dev-baseline-full-context-rules-c0a4b85-scoring-v2",
        "createdAt": datetime.now(tz).isoformat(timespec="seconds"),
        "runMode": "full-context-baseline-no-retrieval",
        "requestLimit": args.limit,
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
            "client": "week12-python-rag/src/clients.py::DeepSeekClient",
        },
        "items": [
            {"record": record.__dict__, "evaluation": evaluation.as_dict()}
            for record, evaluation in evaluations
        ],
        "summary": summarize([evaluation for _, evaluation in evaluations]),
        "boundaries": [
            "Offline input estimates and provider usage are separate objects; they are not interchangeable.",
            "Run facts, evaluator results and the item verdict are separate layers; structural invalidity fails the item under the frozen contract.",
            "Pending semantic evaluators do not mask a conclusive split failure; split_status is 'incomplete' only when pending decisions prevent a final conclusion.",
            "W13 freezes retry_policy=no-retry; the retryable field classifies failures for W14, it does not retry.",
        ],
    }


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--read-timeout", type=float, default=180.0)
    args = ap.parse_args()

    load_env()  # 先读 .env，再判断凭据是否存在——否则 credential_present 会误报 False
    system = system_instructions()
    ctx = load_evidence_context()
    schema = load_response_schema()
    registry_ids = load_registry_ids()
    items = load_dev_items()[: args.limit]
    print(f"[run] items={len(items)} context_chars={len(ctx)} registry_ids={len(registry_ids)}")
    print(f"[run] requested_model={FROZEN_MODEL} thinking={FROZEN_THINKING} max_tokens={FROZEN_MAX_TOKENS}")
    print(f"[run] credential_present={bool(os.environ.get('DEEPSEEK_API_KEY'))}")

    client = DeepSeekClient(
        model=FROZEN_MODEL,
        timeout=httpx.Timeout(connect=10.0, read=args.read_timeout, write=30.0, pool=10.0),
    )
    records, evaluations = [], []
    try:
        for i, item in enumerate(items, 1):
            rec = await run_item(
                client, item, system=system, evidence_context=ctx, schema=schema
            )
            evaluation = evaluate_item(rec, item, registry_ids)
            records.append(rec)
            evaluations.append(evaluation)
            usage = (rec.usage or {}).get("total_tokens")
            print(
                f"[{i}/{len(items)}] {item['id']} status={rec.status} retryable={evaluation.run.retryable} "
                f"verdict={evaluation.verdict.result} reasons={evaluation.verdict.reasons} "
                f"pending={evaluation.verdict.pending} usage={usage} served={rec.served_model} "
                f"latency_ms={rec.latency_ms}",
                flush=True,
            )
    finally:
        await client.aclose()

    out = args.out or (ROOT / f"evidence/baseline/dev-full-context-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            build_evidence(list(zip(records, evaluations)), args, ctx, system, schema),
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
    except ValueError:  # 允许写到仓库外（例如 /tmp 的临时自检）
        shown = out
    print(f"[out] {shown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
