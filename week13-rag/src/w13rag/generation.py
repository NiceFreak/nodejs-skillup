"""W13 阶段 3：请求组装、客户端复用与失败分层（实现方交付；语义与配置已冻结）。

契约锚点：
- Prompt 与输入边界：当前冻结 Prompt（`prompts/rag-prompt-v1.md`）§1（System instructions）与 §2
  （`<EVIDENCE_CONTEXT>` / `<QUERY>` 结构）。`v2`（§1 新增第 13 条 citation 粒度）已实测但**未达成目标**
  （见 D4 笔记 §6.15），默认回滚到 v1；v0 / v1 / v2 均保留可追溯，可用 `W13_PROMPT_PATH` 指向任一版本复现
  对应证据。
- 生成配置：[`config/model-policy-v1.md`](../../config/model-policy-v1.md)——`deepseek-v4-flash`、
  `thinking: disabled`、`max_tokens = 4096`、`response_format: {"type": "json_object"}`（D4 硬化项，单因素变更）。官方 Thinking Mode 文档：开关是请求体顶层字段
  `{"thinking": {"type": "enabled"|"disabled"}}`，且**思考模式默认开启**。
- 与计量共用同一组装函数：`assemble_messages()` 是唯一入口，避免「计量时的输入」与「真实发送的输入」漂移
  （D3 §6.2.0 #5：baseline 与 retrieval 共用同一组装函数）。

边界：只读取 `eval/dev/`；不读取 holdout；不修改冻结的 Prompt / Evidence Context / 配置。
"""

from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import jsonschema

ROOT = Path(__file__).resolve().parents[2]
_W12_ROOT = ROOT.parent / "week12-python-rag"
if str(_W12_ROOT) not in sys.path:  # 复用 W12 客户端，不复制第二套 HTTP 客户端
    sys.path.insert(0, str(_W12_ROOT))

from src.clients import (  # noqa: E402  (W12 包，需在其根目录位于 sys.path 后导入)
    ChatResult,
    ClientError,
    DeepSeekAPIError,
    DeepSeekClient,
)

#: 当前冻结 Prompt；`W13_PROMPT_PATH` 可指向 v0 / v1 / v2 以复现对应证据。
PROMPT_PATH = Path(os.environ.get("W13_PROMPT_PATH") or ROOT / "prompts/rag-prompt-v1.md")
CONTEXT_PATH = ROOT / "evidence/serialization/evidence-context-rules-c0a4b85.txt"
DEV_ITEMS_PATH = ROOT / "eval/dev/items.json"
SCHEMA_PATH = ROOT / "schemas/rag-response-v1.schema.json"

FROZEN_MODEL = "deepseek-v4-flash"
FROZEN_THINKING = {"type": "disabled"}
FROZEN_MAX_TOKENS = 4096
#: 官方 JSON Output 的请求字段（检索 2026-09-10）：`{"type": "json_object"}`。
#: 单因素变更：只加该字段，Prompt 与其它请求字段不变。官方同时提示可能偶发返回空内容。
FROZEN_RESPONSE_FORMAT = {"type": "json_object"}

#: 失败分层：正常返回与五类互斥失败状态。同一 item 只落到一个状态。
#: `empty_content` 是官方 JSON Output 文档明示的可能结果（may occasionally return empty content）。
STATUS_OK = "ok"
STATUS_EMPTY_CONTENT = "empty_content"
STATUS_JSON_ERROR = "json_error"
STATUS_SCHEMA_ERROR = "schema_error"
STATUS_HTTP_ERROR = "http_error"
STATUS_TIMEOUT_ERROR = "timeout_error"
STATUS_TRANSPORT_ERROR = "transport_error"


def system_instructions(prompt_path: Path = PROMPT_PATH) -> str:
    """从冻结 Prompt 的 §1 取出 System instructions。"""
    import re

    text = prompt_path.read_text(encoding="utf-8")
    m = re.search(r"^## 1\. System instructions\n(.*?)^## 2\.", text, re.S | re.M)
    if m is None:
        raise ValueError("冻结 Prompt 缺少 §1 System instructions")
    return m.group(1).strip("\n")


def prompt_version(prompt_path: Path = PROMPT_PATH) -> str:
    """从冻结 Prompt 头部取版本号，用于运行证据与证据文件命名。"""
    import re

    m = re.search(r"^- Prompt version：`([^`]+)`", prompt_path.read_text(encoding="utf-8"), re.M)
    if m is None:
        raise ValueError("冻结 Prompt 头部缺少 Prompt version")
    return m.group(1)


def load_evidence_context(context_path: Path = CONTEXT_PATH) -> str:
    return context_path.read_text(encoding="utf-8")


def build_user_message(evidence_context: str, query: str) -> str:
    """`rag-prompt-v0.md` §2 的输入边界：证据与 query 分别包在固定标签里。"""
    return (
        f"<EVIDENCE_CONTEXT>\n{evidence_context}\n</EVIDENCE_CONTEXT>\n\n"
        f"<QUERY>\n{query}\n</QUERY>"
    )


def assemble_messages(
    system: str, evidence_context: str, query: str
) -> list[dict[str, str]]:
    """唯一组装入口：计量、baseline、后续 retrieval 路径都经这里。"""
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": build_user_message(evidence_context, query)},
    ]


def load_dev_items(path: Path = DEV_ITEMS_PATH) -> list[dict[str, Any]]:
    """只接受 dev split；物理上不提供读取 holdout 的入口。"""
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("split") != "dev":
        raise ValueError(f"拒绝非 dev split：{path}")
    return list(data["items"])


def load_response_schema(path: Path = SCHEMA_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def check_response(text: str, schema: dict[str, Any]) -> tuple[str, dict | None, str | None]:
    """响应文本 -> (状态, 解析结果, 细节)。空内容、JSON 与 schema 失败分别归类，不混为一种错误。"""
    if not text.strip():
        return STATUS_EMPTY_CONTENT, None, "empty content"
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        return STATUS_JSON_ERROR, None, f"{exc.msg} at pos {exc.pos}"
    try:
        jsonschema.validate(instance=parsed, schema=schema)
    except jsonschema.ValidationError as exc:
        return STATUS_SCHEMA_ERROR, None, exc.message
    return STATUS_OK, parsed, None


@dataclass
class RunRecord:
    """一次调用的运行证据：请求侧配置 + 服务端身份 + 结果状态（字段集见 model-policy §2）。"""

    item_id: str
    requested_model: str
    thinking: dict[str, Any]
    max_tokens: int
    status: str
    http_status: int | None = None  # 仅 http_error 有值；供 scoring.is_retryable 分类
    response_format: dict[str, Any] | None = None  # 请求侧留痕：JSON 输出约束确实发出
    served_model: str | None = None
    system_fingerprint: str | None = None
    usage: dict[str, Any] | None = None
    created: int | None = None
    latency_ms: int | None = None
    raw_text: str | None = None
    parsed: dict[str, Any] | None = None
    detail: str | None = None


async def run_item(
    client: DeepSeekClient,
    item: dict[str, Any],
    *,
    system: str,
    evidence_context: str,
    schema: dict[str, Any],
) -> RunRecord:
    """组装 -> 发送 -> 分层判定，返回运行证据。失败不向上抛，而是落成互斥状态。"""
    messages = assemble_messages(system, evidence_context, item["query"])
    record = RunRecord(
        item_id=item["id"],
        requested_model=FROZEN_MODEL,
        thinking=dict(FROZEN_THINKING),
        max_tokens=FROZEN_MAX_TOKENS,
        response_format=dict(FROZEN_RESPONSE_FORMAT),
        status=STATUS_TRANSPORT_ERROR,
    )
    started = time.perf_counter()
    try:
        result: ChatResult = await client.chat(
            messages,
            model=FROZEN_MODEL,
            thinking=FROZEN_THINKING,
            max_tokens=FROZEN_MAX_TOKENS,
            response_format=FROZEN_RESPONSE_FORMAT,
        )
    except DeepSeekAPIError as exc:
        record.status = STATUS_HTTP_ERROR
        record.http_status = exc.status_code
        record.detail = f"status={exc.status_code}"
        return record
    except httpx.TimeoutException as exc:
        record.status = STATUS_TIMEOUT_ERROR
        record.detail = type(exc).__name__
        return record
    except (httpx.HTTPError, ClientError) as exc:
        record.status = STATUS_TRANSPORT_ERROR
        record.detail = f"{type(exc).__name__}: {exc}"
        return record
    finally:
        record.latency_ms = int((time.perf_counter() - started) * 1000)

    raw = result.raw or {}
    record.served_model = result.model
    record.system_fingerprint = raw.get("system_fingerprint")
    record.usage = raw.get("usage")
    record.created = raw.get("created")
    record.raw_text = result.content
    record.status, record.parsed, record.detail = check_response(
        result.content or "", schema
    )
    return record
