"""P-1 变体对照：把忙循环换成 await asyncio.sleep(0.5)（让出控制权）。

与 experiments/p1_cpu_vs_await.py 的唯一差别：cpu_burn 的纯 CPU 忙循环换成 pauser 的
await asyncio.sleep(duration)。若「让出」是关键变量，sleeper 应在 ~0.1s 按时醒来，
而不是被推迟到 0.5s 之后。

运行：.venv/bin/python experiments/p1_cpu_vs_await_sleep.py
对照：.venv/bin/python experiments/p1_cpu_vs_await.py
"""

import asyncio
import time


async def pauser(duration: float) -> None:
    """内部让出的 0.5s「任务」（对照 cpu_burn 的无 await 忙循环）。"""
    await asyncio.sleep(duration)
    print(f"[pauser]  结束 @ {time.monotonic():.3f}")


async def sleeper() -> None:
    print(f"[sleeper] 启动 @ {time.monotonic():.3f}")
    await asyncio.sleep(0.1)
    print(f"[sleeper] 醒了 @ {time.monotonic():.3f}")


async def main() -> None:
    print(f"[main]    开始 @ {time.monotonic():.3f}")
    task_a = asyncio.create_task(pauser(0.5))
    task_b = asyncio.create_task(sleeper())
    await asyncio.gather(task_a, task_b)
    print(f"[main]    结束 @ {time.monotonic():.3f}")


if __name__ == "__main__":
    asyncio.run(main())
