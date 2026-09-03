"""C-1 实验：read timeout 真实触发（本地可控慢速 server + httpx 完整栈）。

目标问题（结论由本人产出，脚本只打印事实）：
1. 哪一层 timeout 先触发（connect/read/write/pool /总时长）？
2. 调用方（await client.chat）收到什么异常？
3. 协程内部收到什么异常（CancelledError 直穿还是包装后的超时异常）？
4. 超时后连接是否被关闭？谁关闭的？（看 server 侧 FIN 时间戳）

可证伪设计：同一段代码、同一个 server（hold 3.0s 后才响应），
  A  read timeout=0.5s  -> 必须触发（0.5s 远小于 3.0s）
  B  read timeout=5.0s  -> 必须不触发（5.0s > 3.0s，应收到完整响应）
若 A/B 同时出现则证明超时机制成立；只 A 不 B 则测的是别的东西。

运行：.venv/bin/python -m experiments.c1_read_timeout
"""

import asyncio
import time

import httpx

from src.clients import DeepSeekClient
from experiments._slow_server import HoldServer

HOLD_SECONDS = 3.0


def _fmt(t0: float) -> str:
    return f"{time.monotonic() - t0:.3f}s"


def _print_exc_chain(exc: BaseException) -> None:
    names = [c.__name__ for c in type(exc).__mro__]
    print(f"    异常类型: {type(exc).__name__}; MRO = {' -> '.join(names)}")
    cause = exc.__cause__
    if cause is not None:
        print(f"    __cause__: {type(cause).__name__}: {cause}")


async def _run_case(t0: float, label: str, read_timeout: float, server: HoldServer) -> None:
    print(f"\n[{label}] read timeout = {read_timeout}s（server hold = {HOLD_SECONDS}s）")
    timeout = httpx.Timeout(connect=2.0, read=read_timeout, write=2.0, pool=2.0)
    client = DeepSeekClient(
        api_key="sk-local",
        model="local-model",
        base_url=f"http://127.0.0.1:{server.port}",
        timeout=timeout,
    )
    start = time.monotonic()
    outcome: list[str] = []
    try:
        async with client:
            result = await client.chat([{"role": "user", "content": "ping"}])
            outcome.append(f"成功返回 content={result.content!r}")
    except httpx.ReadTimeout as exc:
        outcome.append("调用方收到 httpx.ReadTimeout")
        _print_exc_chain(exc)
    except asyncio.CancelledError:
        outcome.append("调用方（协程内）收到 asyncio.CancelledError —— 取消直穿未包装")
    except TimeoutError as exc:
        outcome.append(f"调用方收到 TimeoutError 家族: {type(exc).__name__}")
        _print_exc_chain(exc)
    except httpx.HTTPError as exc:
        outcome.append(f"调用方收到其他 httpx.HTTPError: {type(exc).__name__}")
        _print_exc_chain(exc)
    elapsed = time.monotonic() - start
    print(f"    耗时 {elapsed:.3f}s")
    for line in outcome:
        print(f"    {line}")
    # client 已随 async with 退出关闭
    print(f"    async with 退出后底层 client: is_closed={client._client is None or client._client.is_closed}")


async def main() -> None:
    t0 = time.monotonic()

    # case A：read 0.5s，server 3s 后才响应 -> 应触发 read timeout
    server_a = HoldServer(hold_seconds=HOLD_SECONDS)
    print(f"[server] 监听 127.0.0.1:{server_a.port}")
    await asyncio.sleep(0.05)  # 等 server accept 线程就绪
    await _run_case(t0, "case A", read_timeout=0.5, server=server_a)
    await asyncio.sleep(0.3)
    server_a.close()

    # case B：read 5.0s > hold 3.0s -> 同一代码应成功、不触发
    server_b = HoldServer(hold_seconds=HOLD_SECONDS)
    print(f"\n[server] 监听 127.0.0.1:{server_b.port}")
    await asyncio.sleep(0.05)
    await _run_case(t0, "case B", read_timeout=5.0, server=server_b)
    await asyncio.sleep(0.3)
    server_b.close()

    print("\n[server A 事件]（事实：accept / 请求到达 / FIN / 响应）")
    for ts, desc in server_a.events:
        print(f"    t+{ts - t0:.3f}s  {desc}")
    print("[server B 事件]")
    for ts, desc in server_b.events:
        print(f"    t+{ts - t0:.3f}s  {desc}")


if __name__ == "__main__":
    asyncio.run(main())
