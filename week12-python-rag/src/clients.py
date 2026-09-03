"""W12 D4 最小模型客户端骨架（白名单脚手架）。

- DeepSeekClient：httpx 裸 HTTP，base_url / model / timeout（httpx.Timeout 四层）全部可注入。
- FakeClient：无网络确定性客户端，供 timeout / cancellation / C1 实验注入行为。
- 两者共用 ModelClient Protocol（typing/Protocol 现场展开点）。

设计边界：只做「一次请求 -> 结构化结果」；不含循环、终止判定、trace、verifier。
网络层 httpx 异常（ConnectError / ReadTimeout / ConnectTimeout ...）原样传播，
由实验观察它们发生在哪一层；HTTP 状态码 >= 400 翻译为 DeepSeekAPIError。
"""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from .config import load_env

DEFAULT_BASE_URL = "https://api.deepseek.com"
# 模型 ID 拼写以当天官方文档与真实响应为准（bub-reading-report.md §8 待验证项），可注入覆盖。
DEFAULT_MODEL = "deepseek-chat"


class ClientError(Exception):
    """客户端侧错误基类。"""


class DeepSeekAPIError(ClientError):
    """DeepSeek 返回 HTTP >= 400 时抛出；保留状态码与响应体供失败分层记录。"""

    def __init__(self, status_code: int, body: str) -> None:
        super().__init__(f"DeepSeek API error: status={status_code} body={body[:500]}")
        self.status_code = status_code
        self.body = body


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: str  # JSON 字符串（协议原始形态），需用时由调用方 json.loads


@dataclass
class ChatResult:
    content: str | None
    tool_calls: list[ToolCall]
    model: str | None = None
    raw: dict[str, Any] | None = None  # 保留完整响应，供实验观察


class ModelClient(Protocol):
    """真实与 fake client 的共同调用协议。

    timeout 语义：None 表示使用客户端默认超时；显式传 httpx.Timeout / float 覆盖本次请求。
    """

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        tools: list[dict[str, Any]] | None = None,
        timeout: httpx.Timeout | float | None = None,
    ) -> ChatResult: ...

    async def aclose(self) -> None: ...


@dataclass
class FakeBehavior:
    """FakeClient 单次 chat 的确定性行为（按优先级：error -> hang -> delay -> result）。"""

    result: ChatResult | None = None
    delay: float = 0.0
    hang: bool = False  # 等待永不触发的 Event：调用方 task.cancel() 才能结束
    error: BaseException | None = None


class FakeClient:
    """无网络确定性客户端。

    behaviors 逐个消耗；耗尽后重复最后一个（固定 tool_calls 序列的收敛观察用）。
    每次调用会记录到 .calls，便于断言与实验观察实际收到的输入。
    """

    def __init__(
        self,
        behaviors: list[FakeBehavior] | None = None,
        model: str = "fake-model",
    ) -> None:
        default = FakeBehavior(result=ChatResult(content="ok", tool_calls=[]))
        self._behaviors = behaviors or [default]
        self._index = 0
        self.model = model
        self.calls: list[tuple[list[dict[str, str]], list[dict[str, Any]] | None]] = []
        self._closed = False

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        tools: list[dict[str, Any]] | None = None,
        timeout: httpx.Timeout | float | None = None,
    ) -> ChatResult:
        if self._closed:
            raise RuntimeError("FakeClient already closed")
        self.calls.append((messages, tools))
        last = min(self._index, len(self._behaviors) - 1)
        self._index += 1
        behavior = self._behaviors[last]

        if behavior.error is not None:
            raise behavior.error
        if behavior.hang:
            await asyncio.Event().wait()  # 永不 set：只能被取消
        if behavior.delay:
            await asyncio.sleep(behavior.delay)
        assert behavior.result is not None
        return behavior.result

    async def aclose(self) -> None:
        self._closed = True


class DeepSeekClient:
    """httpx 裸 HTTP 的 DeepSeek Chat Completions 客户端。

    api_key / base_url / model / timeout / transport 全部可注入；
    transport 供测试注入 httpx.MockTransport，不碰真实网络。
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        model: str | None = None,
        timeout: httpx.Timeout | float | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        load_env()
        self._api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        if not self._api_key:
            raise ValueError(
                "缺少 DEEPSEEK_API_KEY：复制 .env.example 为 .env 填入，或 export DEEPSEEK_API_KEY"
            )
        self._base_url = base_url.rstrip("/")
        self._model = model or os.environ.get("DEEPSEEK_MODEL") or DEFAULT_MODEL
        self._timeout = timeout if timeout is not None else httpx.Timeout(
            connect=10.0, read=60.0, write=30.0, pool=10.0
        )
        self._transport = transport
        self._client: httpx.AsyncClient | None = None

    @property
    def model(self) -> str:
        return self._model

    @property
    def base_url(self) -> str:
        return self._base_url

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                transport=self._transport,
            )
        return self._client

    async def __aenter__(self) -> "DeepSeekClient":
        await self._get_client()
        return self

    async def __aexit__(self, *exc_info: Any) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        tools: list[dict[str, Any]] | None = None,
        timeout: httpx.Timeout | float | None = None,
    ) -> ChatResult:
        client = await self._get_client()
        payload: dict[str, Any] = {"model": self._model, "messages": messages}
        if tools is not None:
            payload["tools"] = tools

        kwargs: dict[str, Any] = {
            "json": payload,
            "headers": {"Authorization": f"Bearer {self._api_key}"},
        }
        if timeout is not None:
            kwargs["timeout"] = timeout

        response = await client.post("/chat/completions", **kwargs)
        body_text = response.text
        if response.status_code >= 400:
            raise DeepSeekAPIError(status_code=response.status_code, body=body_text)

        data = json.loads(body_text)
        message = data["choices"][0]["message"]
        content = message.get("content")
        raw_calls = message.get("tool_calls") or []
        tool_calls = [
            ToolCall(
                id=call.get("id", ""),
                name=call["function"]["name"],
                arguments=call["function"].get("arguments", "{}"),
            )
            for call in raw_calls
        ]
        return ChatResult(
            content=content,
            tool_calls=tool_calls,
            model=data.get("model"),
            raw=data,
        )

