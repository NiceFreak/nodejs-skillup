"""D4 脚手架自测：Fake/DeepSeek client 的确定性行为、收尾无残留与请求构造。

断言口径说明：本文件断言的是 Python asyncio / httpx 的文档化语义与脚手架自身行为
（CancelledError 在 await 点抛出、finally 执行、超时抛 TimeoutError、HTTP 层错误翻译等），
属于白名单实现自测；D4 §5/§7 的「操作 -> 观察 -> 结论」实验记录由本人另行产出。
pytest-asyncio 1.4.0 默认 STRICT 模式，异步测试均显式打 @pytest.mark.asyncio。
"""

import asyncio
import json

import httpx
import pytest

from src.clients import (
    ChatResult,
    DeepSeekAPIError,
    DeepSeekClient,
    FakeBehavior,
    FakeClient,
    ToolCall,
)


@pytest.mark.asyncio
async def test_fake_returns_content_and_records_calls():
    client = FakeClient(
        behaviors=[FakeBehavior(result=ChatResult(content="你好", tool_calls=[]))]
    )
    result = await client.chat([{"role": "user", "content": "hi"}])
    assert result.content == "你好"
    assert result.tool_calls == []
    assert client.calls == [([{"role": "user", "content": "hi"}], None)]
    await client.aclose()


@pytest.mark.asyncio
async def test_fake_hang_cancel_raises_cancelled_and_runs_finally():
    ran_finally = False
    client = FakeClient([FakeBehavior(hang=True)])

    async def call() -> None:
        nonlocal ran_finally
        try:
            await client.chat([{"role": "user", "content": "x"}])
        finally:
            ran_finally = True

    task = asyncio.create_task(call())
    await asyncio.sleep(0)  # 让 task 进入 hang 的 Event().wait()
    assert not task.done()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert ran_finally  # 取消后 finally 仍执行
    await client.aclose()


@pytest.mark.asyncio
async def test_fake_delay_timeout_raises_timeout_and_inner_sees_cancelled():
    inner_cancelled = False
    client = FakeClient([FakeBehavior(delay=5.0)])

    async def call() -> None:
        nonlocal inner_cancelled
        try:
            await client.chat([{"role": "user", "content": "x"}])
        except asyncio.CancelledError:
            inner_cancelled = True
            raise

    with pytest.raises(TimeoutError):
        async with asyncio.timeout(0.05):
            await call()

    # asyncio.timeout 通过取消实现：被包的协程内部看到 CancelledError，
    # 调用方（async with 出口）看到 TimeoutError——不是同一个异常对象。
    assert inner_cancelled
    await client.aclose()


@pytest.mark.asyncio
@pytest.mark.filterwarnings("error::RuntimeWarning")
async def test_cancel_path_leaves_no_pending_task_warning():
    client = FakeClient([FakeBehavior(hang=True)])
    task = asyncio.create_task(client.chat([{"role": "user", "content": "x"}]))
    await asyncio.sleep(0)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await client.aclose()
    await asyncio.sleep(0)
    leftover = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    assert leftover == []


@pytest.mark.asyncio
async def test_fake_aclosed_raises():
    client = FakeClient()
    await client.aclose()
    with pytest.raises(RuntimeError):
        await client.chat([{"role": "user", "content": "x"}])


def _chat_completion_response(content: str | None, tool_calls: list[dict] | None = None) -> dict:
    message: dict = {"role": "assistant", "content": content}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "model": "deepseek-chat",
        "choices": [{"index": 0, "message": message, "finish_reason": "stop"}],
    }


@pytest.mark.asyncio
async def test_deepseek_payload_and_parse():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=_chat_completion_response('{"name": "张三"}'))

    client = DeepSeekClient(
        api_key="sk-test",
        model="m-test",
        transport=httpx.MockTransport(handler),
    )
    async with client:
        result = await client.chat([{"role": "user", "content": "你好"}])

    assert result.content == '{"name": "张三"}'
    assert result.tool_calls == []
    assert seen["url"] == "https://api.deepseek.com/chat/completions"
    assert seen["auth"] == "Bearer sk-test"
    assert seen["body"]["model"] == "m-test"
    assert seen["body"]["messages"] == [{"role": "user", "content": "你好"}]
    assert "tools" not in seen["body"]


@pytest.mark.asyncio
async def test_deepseek_parses_tool_calls():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=_chat_completion_response(
                content=None,
                tool_calls=[
                    {
                        "id": "call_1",
                        "type": "function",
                        "function": {
                            "name": "lookup_user_by_email",
                            "arguments": '{"email": "lisi@work.com"}',
                        },
                    }
                ],
            ),
        )

    client = DeepSeekClient(
        api_key="sk-test",
        transport=httpx.MockTransport(handler),
    )
    async with client:
        result = await client.chat(
            [{"role": "user", "content": "查 lisi@work.com"}],
            tools=[{"type": "function", "function": {"name": "lookup_user_by_email"}}],
        )

    assert result.content is None
    assert result.tool_calls == [
        ToolCall(id="call_1", name="lookup_user_by_email", arguments='{"email": "lisi@work.com"}')
    ]


@pytest.mark.asyncio
async def test_deepseek_api_error_translation():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "auth failed"}})

    client = DeepSeekClient(api_key="sk-test", transport=httpx.MockTransport(handler))
    async with client:
        with pytest.raises(DeepSeekAPIError) as exc_info:
            await client.chat([{"role": "user", "content": "x"}])
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_deepseek_async_with_closes_client():
    client = DeepSeekClient(
        api_key="sk-test",
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=_chat_completion_response("ok"))),
    )
    async with client:
        await client.chat([{"role": "user", "content": "x"}])
        assert client._client is not None and not client._client.is_closed
    # async with 退出后底层 httpx.AsyncClient 已关闭（aclose 已调用）
    assert client._client is None or client._client.is_closed


def test_deepseek_accepts_layer_timeout_object():
    # timeout 四层可注入：connect / read / write / pool 分开设置（C-1 观察哪一层先触发的前置）
    client = DeepSeekClient(
        api_key="sk-test",
        timeout=httpx.Timeout(connect=1.0, read=2.0, write=2.0, pool=3.0),
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=_chat_completion_response("ok"))),
    )
    assert client.base_url == "https://api.deepseek.com"
    assert client.model == "deepseek-chat"

