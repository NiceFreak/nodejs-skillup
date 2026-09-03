"""C-2 实验：请求进行中 task.cancel()（本地可控慢速 server + httpx 完整栈）。

目标问题（结论由本人产出，脚本只打印事实）：
1. CancelledError 在哪个 await 点抛出（相对我们协程的感知位置）？
2. finally / async with __aexit__ 是否执行？
3. 清理代码里再 await（finally 中 sleep、__aexit__ 中 aclose）会发生什么？
   ——单次取消下是否被自动再次打断（对照 P-2 B/C 场景的语言层结论）
4. 调用方 await task 时看到什么（CancelledError？task.cancelled()？）
5. 请求取消后连接是否被关闭（server 侧 FIN 时间戳）

运行：.venv/bin/python -m experiments.c2_cancel_inflight
"""

import asyncio
import time

import httpx

from src.clients import DeepSeekClient
from experiments._slow_server import HoldServer

SERVER_HOLD = 60.0  # 挂住不响应，直到客户端取消或进程退出


async def main() -> None:
    t0 = time.monotonic()
    server = HoldServer(hold_seconds=SERVER_HOLD, respond=False)
    print(f"[server] 监听 127.0.0.1:{server.port}（hold={SERVER_HOLD}s，不响应）")
    await asyncio.sleep(0.05)

    timeout = httpx.Timeout(connect=2.0, read=30.0, write=2.0, pool=2.0)
    client = DeepSeekClient(
        api_key="sk-local",
        model="local-model",
        base_url=f"http://127.0.0.1:{server.port}",
        timeout=timeout,
    )

    async def call() -> None:
        # 观察 finally 清理在真实 HTTP 取消路径上的执行与再 await 行为
        try:
            print(f"  [{time.monotonic() - t0:.3f}s] call: 进入 chat（将挂在读响应上）")
            await client.chat([{"role": "user", "content": "ping"}])
            print(f"  [{time.monotonic() - t0:.3f}s] call: chat 返回（不应到达）")
        finally:
            print(f"  [{time.monotonic() - t0:.3f}s] call: finally 进入，清理中 await sleep(0.1)")
            try:
                await asyncio.sleep(0.1)
                print(f"  [{time.monotonic() - t0:.3f}s] call: finally 的 sleep 正常完成（未被自动再次打断）")
            except asyncio.CancelledError:
                print(f"  [{time.monotonic() - t0:.3f}s] call: finally 的 sleep 被再次注入 CancelledError")
                raise

    async with client:  # 退出时 __aexit__ -> aclose，观察它是否执行
        print(f"  [{time.monotonic() - t0:.3f}s] main: async with 进入")
        task = asyncio.create_task(call())
        await asyncio.sleep(0.3)  # 请求已发出、正在读响应
        print(f"  [{time.monotonic() - t0:.3f}s] main: task.cancel()（请求进行中）")
        task.cancel()
        try:
            await task
            print(f"  [{time.monotonic() - t0:.3f}s] main: await task 正常返回（不应到达）")
        except asyncio.CancelledError:
            print(
                f"  [{time.monotonic() - t0:.3f}s] main: await task 收到 CancelledError; "
                f"cancelled={task.cancelled()} done={task.done()}"
            )
        print(f"  [{time.monotonic() - t0:.3f}s] main: async with 即将退出（__aexit__ -> aclose）")

    print(f"  [{time.monotonic() - t0:.3f}s] main: async with 已退出; is_closed={client._client is None or client._client.is_closed}")
    await asyncio.sleep(0.3)
    server.close()

    print("\n[server 事件]（事实：FIN 时间戳 = 客户端何时关闭连接）")
    for ts, desc in server.events:
        print(f"    t+{ts - t0:.3f}s  {desc}")


if __name__ == "__main__":
    asyncio.run(main())
