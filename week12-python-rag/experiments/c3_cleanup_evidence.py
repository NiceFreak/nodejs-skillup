"""C-3 实验：收尾无残留的证据式验收。

把 C-1（read timeout 触发）与 C-2（请求中 cancel）各跑一遍后，观察进程收尾：
- asyncio.all_tasks() 是否只剩当前任务
- DeepSeekClient 底层 httpx client 是否已关闭
- 无 "Task was destroyed but it is pending!" 等 RuntimeWarning
  （运行方式要求：-W error::RuntimeWarning 下仍正常退出码 0）

结论须是"观察到的输出"，不接受"没报错所以没问题"。
运行：.venv/bin/python -W error::RuntimeWarning -m experiments.c3_cleanup_evidence
"""

import asyncio
import time

import httpx

from src.clients import DeepSeekClient
from experiments._slow_server import HoldServer


async def scenario_timeout(t0: float) -> None:
    """复刻 C-1：read timeout 触发一次后正常退出。"""
    server = HoldServer(hold_seconds=3.0)
    timeout = httpx.Timeout(connect=2.0, read=0.5, write=2.0, pool=2.0)
    client = DeepSeekClient(
        api_key="sk-local",
        model="local-model",
        base_url=f"http://127.0.0.1:{server.port}",
        timeout=timeout,
    )
    async with client:
        try:
            await client.chat([{"role": "user", "content": "ping"}])
        except httpx.TimeoutException:
            print(f"  [{time.monotonic() - t0:.3f}s] timeout 场景：ReadTimeout 已触发并被捕获")
    await asyncio.sleep(0.2)
    server.close()
    print(f"  [{time.monotonic() - t0:.3f}s] timeout 场景结束; is_closed={client._client is None or client._client.is_closed}")


async def scenario_cancel(t0: float) -> None:
    """复刻 C-2：请求进行中 task.cancel() 后清理。"""
    server = HoldServer(hold_seconds=60.0, respond=False)
    timeout = httpx.Timeout(connect=2.0, read=30.0, write=2.0, pool=2.0)
    client = DeepSeekClient(
        api_key="sk-local",
        model="local-model",
        base_url=f"http://127.0.0.1:{server.port}",
        timeout=timeout,
    )
    async with client:
        task = asyncio.create_task(client.chat([{"role": "user", "content": "ping"}]))
        await asyncio.sleep(0.3)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    await asyncio.sleep(0.2)
    server.close()
    print(f"  [{time.monotonic() - t0:.3f}s] cancel 场景结束; is_closed={client._client is None or client._client.is_closed}")


async def main() -> None:
    t0 = time.monotonic()
    await scenario_timeout(t0)
    await scenario_cancel(t0)

    await asyncio.sleep(0.2)  # 让可能残留的回调/警告先浮出

    # 证据 1：all_tasks 收尾点观察
    current = asyncio.current_task()
    leftover = [t for t in asyncio.all_tasks() if t is not current]
    print(f"\n[证据1] 收尾点 asyncio.all_tasks(): 共 {len(asyncio.all_tasks())} 个，"
          f"除当前任务外 {len(leftover)} 个残留: {leftover}")

    # 证据 2：脚本此刻主动打印活动线程，确认没有遗留守护线程以外的内容
    import threading

    names = [t.name for t in threading.enumerate() if t is not threading.main_thread()]
    print(f"[证据2] 非主线程存活: {names if names else '无'}")

    print("\n收尾完成（-W error::RuntimeWarning 下无警告即退出码 0）")


if __name__ == "__main__":
    asyncio.run(main())
