"""P-3 校准②验证：asyncio 网络 I/O 是否经过线程池（selector 原生路径）。

设计：本地 TCP server accept 后不响应。客户端 httpx 连接并挂在读上，
此时打印活动线程——若网络 I/O 走 selector 原生非阻塞路径，应只有主线程；
对照：loop.run_in_executor 里跑阻塞 sleep，期间出现线程池 worker 线程。

运行：.venv/bin/python experiments/p3_network_threads.py
"""

import asyncio
import socket
import threading
import time

import httpx


def _dump_threads(label: str) -> None:
    names = [t.name for t in threading.enumerate()]
    print(f"    {label}: active_threads={names}")


async def main() -> None:
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind(("127.0.0.1", 0))
    server_sock.listen(1)
    port = server_sock.getsockname()[1]

    def _accept_and_hold() -> None:
        conn, _ = server_sock.accept()
        time.sleep(5)  # 挂着不响应
        conn.close()

    threading.Thread(target=_accept_and_hold, daemon=True).start()

    print("[1] httpx 请求挂在读上期间：")
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=2.0, read=5.0, write=5.0, pool=5.0)
    ) as client:
        task = asyncio.create_task(client.get(f"http://127.0.0.1:{port}/"))
        await asyncio.sleep(0.3)  # 请求已发出、正在等待读响应
        _dump_threads("网络 I/O 中")
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, httpx.HTTPError):
            pass

    print("[2] run_in_executor 阻塞任务期间：")
    loop = asyncio.get_running_loop()

    async def _observe() -> None:
        await asyncio.sleep(0.3)
        _dump_threads("executor 任务中")

    observer = asyncio.create_task(_observe())
    await loop.run_in_executor(None, time.sleep, 1.5)
    await observer

    server_sock.close()


if __name__ == "__main__":
    asyncio.run(main())
