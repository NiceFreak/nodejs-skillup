"""D5 陌生代码诊断目标：共享 HTTP client 的限时抓取器（含缺陷，症状可复现）。

背景与契约（假想的真实需求）：
- 有一个"慢后端"：不同路径延迟不同（fast=0.05s，slow=0.30s）。
- 本模块要依次抓取一批路径，满足三个契约：
  1. 每个路径有独立预算 REQUEST_TIMEOUT，超时的路径记为 ("TIMEOUT")，
     且**不影响后续路径**继续抓取；
  2. 全部路径完成后 run() 返回结果列表，不抛未捕获异常；
  3. 多个路径必须共用同一个 client（httpx 借此复用连接池），
     不应为每个路径单独新建 client。

本文件当前实现试图满足上述契约，但实际运行时与契约存在可复现的偏差。

诊断任务见执行时题目。可自行修改本文件复现与验证。

运行：.venv/bin/python -m experiments.d5_diagnosis_fetcher
"""

from __future__ import annotations

import asyncio
import time

import httpx

MOCK_DELAY = {"fast": 0.05, "slow": 0.30}
REQUEST_TIMEOUT = 0.15  # 每个 URL 的独立预算


async def fake_backend(request: httpx.Request) -> httpx.Response:
    """MockTransport 后端：模拟一个不同路径延迟不同的 HTTP 服务。"""
    path = request.url.path.strip("/") or "fast"
    delay = MOCK_DELAY.get(path, 0.05)
    await asyncio.sleep(delay)
    return httpx.Response(200, json={"path": path, "delay": delay})


def build_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.MockTransport(fake_backend),
        timeout=httpx.Timeout(5.0),
    )


async def fetch_one(client: httpx.AsyncClient, path: str) -> tuple[str, str | int]:
    """抓单个路径。

    预期：超时返回 (path, "TIMEOUT")；HTTP 层失败返回 (path, "HTTPERR:<Type>")；
    成功返回 (path, status_code)。本函数不应抛未捕获异常。
    """
    url = f"http://mock/{path}"
    try:
        async with asyncio.timeout(REQUEST_TIMEOUT):
            resp = await client.get(url)
            return path, resp.status_code
    except asyncio.TimeoutError:
        return path, "TIMEOUT"
    except httpx.HTTPError as exc:
        return path, f"HTTPERR:{type(exc).__name__}"
    finally:
        await client.aclose()  # <-- 这行合理吗？

# debug 用
# async def fetch_one(client: httpx.AsyncClient, path: str) -> tuple[str, str | int]:
#     url = f"http://mock/{path}"
#     print(f"[LOG] fetch_one 开始: {path}, client.is_closed={client.is_closed}")
#     try:
#         print(f"[LOG] {path} 即将调用 client.get...")
#         async with asyncio.timeout(REQUEST_TIMEOUT):
#             resp = await client.get(url)
#             print(f"[LOG] {path} 请求成功, status={resp.status_code}")
#             return path, resp.status_code
#     except asyncio.TimeoutError:
#         print(f"[LOG] {path} 捕获 TimeoutError")
#         return path, "TIMEOUT"
#     except httpx.HTTPError as exc:
#         print(f"[LOG] {path} 捕获 HTTPError: {type(exc).__name__}")
#         return path, f"HTTPERR:{type(exc).__name__}"
#     finally:
#         print(f"[LOG] {path} 进入 finally, 关闭前 client.is_closed={client.is_closed}")
#         await client.aclose()
#         print(f"[LOG] {path} aclose 完成, 关闭后 client.is_closed={client.is_closed}")


async def run(paths: list[str]) -> tuple[list[tuple[str, str | int]], float]:
    """依次抓取全部路径。

    预期：返回 (results, elapsed_seconds)，每个路径一个结果；
    elapsed 约等于各路径耗时之和（顺序执行）。共享 client 在此创建与关闭。
    """
    client = build_client()
    started = time.monotonic()
    try:
        results = [await fetch_one(client, p) for p in paths]
        return results, time.monotonic() - started
    finally:
        await client.aclose()


def main() -> None:
    paths = ["fast", "slow", "fast"]
    results, elapsed = asyncio.run(run(paths))
    print(f"elapsed={elapsed:.3f}s  paths={paths}")
    for path, outcome in results:
        print(f"  {path:6s} -> {outcome}")


if __name__ == "__main__":
    main()
