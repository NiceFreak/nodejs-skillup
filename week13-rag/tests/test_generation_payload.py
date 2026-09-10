"""W13 阶段 3 自测（实现方交付）：payload 捕获、四类失败分层、只读 dev。

口径：本文件断言「请求确实按冻结配置发出」与「失败状态互斥」，不评价回答质量——回答质量属于阶段 4 的
dev baseline 与人工语义 checklist。
"""
from __future__ import annotations

import json

import httpx
import pytest

from w13rag.generation import (
    FROZEN_MAX_TOKENS,
    FROZEN_MODEL,
    FROZEN_RESPONSE_FORMAT,
    FROZEN_THINKING,
    STATUS_EMPTY_CONTENT,
    STATUS_HTTP_ERROR,
    STATUS_JSON_ERROR,
    STATUS_OK,
    STATUS_SCHEMA_ERROR,
    STATUS_TIMEOUT_ERROR,
    DeepSeekClient,
    assemble_messages,
    load_dev_items,
    load_evidence_context,
    load_response_schema,
    run_item,
    system_instructions,
)

ITEM = {
    "id": "w13-dev-direct-answer-01",
    "query": "JWT 签发与验证流程的最高援助级别是什么？",
}
ABSTAINED = (
    '{"branch":"abstained","reason_code":"insufficient_corpus_evidence",'
    '"reason_text":"提供的证据不足以确定该问题。"}'
)


def _completion(content: str, *, model: str = FROZEN_MODEL) -> dict:
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 1789000000,
        "model": model,
        "system_fingerprint": "fp-test",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 44563, "completion_tokens": 41, "total_tokens": 44604},
    }


def _client(handler) -> DeepSeekClient:
    return DeepSeekClient(
        api_key="sk-test",
        model=FROZEN_MODEL,
        transport=httpx.MockTransport(handler),
        timeout=httpx.Timeout(5.0),
    )


def _inputs() -> tuple[str, str, dict]:
    return system_instructions(), load_evidence_context(), load_response_schema()


@pytest.mark.asyncio
async def test_payload_carries_frozen_config_and_assembled_messages():
    captured: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(json.loads(request.read().decode("utf-8")))
        return httpx.Response(200, json=_completion(ABSTAINED))

    system, ctx, schema = _inputs()
    async with _client(handler) as client:
        record = await run_item(
            client, ITEM, system=system, evidence_context=ctx, schema=schema
        )

    body = captured[0]
    assert body["model"] == FROZEN_MODEL
    assert body["thinking"] == FROZEN_THINKING == {"type": "disabled"}
    assert body["max_tokens"] == FROZEN_MAX_TOKENS == 4096
    assert body["response_format"] == FROZEN_RESPONSE_FORMAT == {"type": "json_object"}
    assert record.response_format == {"type": "json_object"}  # 请求侧留痕：确实发出
    assert [m["role"] for m in body["messages"]] == ["system", "user"]
    assert body["messages"][0]["content"] == system
    user = body["messages"][1]["content"]
    assert user.startswith("<EVIDENCE_CONTEXT>\n")
    assert user.endswith(f"<QUERY>\n{ITEM['query']}\n</QUERY>")
    assert ctx in user

    assert record.status == STATUS_OK
    assert record.parsed is not None and record.parsed["branch"] == "abstained"
    assert record.served_model == FROZEN_MODEL
    assert record.system_fingerprint == "fp-test"
    assert record.usage is not None and record.usage["total_tokens"] == 44604
    assert record.created == 1789000000
    assert record.latency_ms is not None


@pytest.mark.asyncio
async def test_http_error_is_classified_not_raised():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"message": "invalid model"}})

    system, ctx, schema = _inputs()
    async with _client(handler) as client:
        record = await run_item(
            client, ITEM, system=system, evidence_context=ctx, schema=schema
        )
    assert record.status == STATUS_HTTP_ERROR
    assert "status=400" in (record.detail or "")
    assert record.parsed is None


@pytest.mark.asyncio
async def test_invalid_json_is_json_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_completion("这不是 JSON"))

    system, ctx, schema = _inputs()
    async with _client(handler) as client:
        record = await run_item(
            client, ITEM, system=system, evidence_context=ctx, schema=schema
        )
    assert record.status == STATUS_JSON_ERROR
    assert record.parsed is None
    assert record.raw_text == "这不是 JSON"


@pytest.mark.asyncio
async def test_schema_violation_is_schema_error():
    # claims[0] 缺 citations：结构合法 JSON，但违反 rag-response-v1
    bad = '{"branch":"answered","claims":[{"text":"x"}]}'

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_completion(bad))

    system, ctx, schema = _inputs()
    async with _client(handler) as client:
        record = await run_item(
            client, ITEM, system=system, evidence_context=ctx, schema=schema
        )
    assert record.status == STATUS_SCHEMA_ERROR
    assert record.parsed is None
    assert record.detail and "citations" in record.detail


@pytest.mark.asyncio
async def test_timeout_is_timeout_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("simulated slow response")

    system, ctx, schema = _inputs()
    async with _client(handler) as client:
        record = await run_item(
            client, ITEM, system=system, evidence_context=ctx, schema=schema
        )
    assert record.status == STATUS_TIMEOUT_ERROR
    assert record.detail == "ReadTimeout"


def test_dev_items_are_dev_only():
    items = load_dev_items()
    assert len(items) == 10
    assert all(i["id"].startswith("w13-dev-") for i in items)
    assert all(i["query"] for i in items)


def test_non_dev_split_is_rejected(tmp_path):
    p = tmp_path / "items.json"
    p.write_text(json.dumps({"split": "holdout", "items": []}), encoding="utf-8")
    with pytest.raises(ValueError):
        load_dev_items(p)


def test_assembly_is_deterministic_single_entry():
    system, ctx, _ = _inputs()
    assert assemble_messages(system, ctx, "问题") == assemble_messages(system, ctx, "问题")
    assert assemble_messages(system, ctx, "问题")[1]["content"].count("<QUERY>") == 1

@pytest.mark.asyncio
async def test_empty_content_is_classified_separately():
    """官方 JSON Output 明示可能返回空内容；必须独立成一态，不混进 json_error。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_completion(""))

    system, ctx, schema = _inputs()
    async with _client(handler) as client:
        record = await run_item(
            client, ITEM, system=system, evidence_context=ctx, schema=schema
        )
    assert record.status == STATUS_EMPTY_CONTENT
    assert record.parsed is None
    assert record.detail == "empty content"
