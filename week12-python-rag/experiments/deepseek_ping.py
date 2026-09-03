"""DeepSeek 连通性最小测试（§6 前置，key 从 .env / 环境读取，输出脱敏）。

只验证：base_url/model 可解析、鉴权通过、一次 chat 能返回。
不打印 key；错误输出截断。正式 §6.1 实验（prompt v0 + 记录表）另行进行。
"""

import asyncio
import sys
import time
from pathlib import Path

import httpx

# 直接运行 experiments/*.py 时，sys.path[0] 是 experiments/，需手动把项目根加进来
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.clients import DeepSeekAPIError, DeepSeekClient


async def main() -> int:
    try:
        client = DeepSeekClient()
    except ValueError as exc:
        print(f"[ping] 配置错误: {exc}")
        return 2
    print(f"[ping] base_url={client.base_url} model={client.model}")

    t0 = time.monotonic()
    try:
        async with client:
            result = await client.chat([{"role": "user", "content": "回复 OK 两个字母即可"}])
    except DeepSeekAPIError as exc:
        print(f"[ping] API 错误 status={exc.status_code} body_head={exc.body[:200]!r}")
        return 3
    except httpx.TimeoutException as exc:
        print(f"[ping] 超时 {type(exc).__name__}: {exc!r}")
        return 4
    except httpx.HTTPError as exc:
        print(f"[ping] HTTP 层错误 {type(exc).__name__}: {exc!r}")
        return 5

    dt = time.monotonic() - t0
    content_head = (result.content or "")[:120]
    print(f"[ping] OK 耗时={dt:.2f}s model={result.model!r} content_head={content_head!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
