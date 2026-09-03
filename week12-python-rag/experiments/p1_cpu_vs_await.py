"""P-1 对照实验：CPU 忙循环 vs await 让出（D4 §5.1 预测 1 验证）。

预期（协作式单线程调度的推论）：
- cpu_burn 启动后无 await，连续占用事件循环线程约 0.5s；
- 期间 sleeper 的第一行打印也会被推迟（create_task 只是入调度队列，
  协程体要等当前协程让出后才会执行）——顺带观察点；
- cpu_burn 结束后 sleeper 才启动，醒在约 0.6s 处。

运行：.venv/bin/python experiments/p1_cpu_vs_await.py
"""

import asyncio
import time


async def cpu_burn(duration: float) -> None:
    """无 await 的纯 CPU 忙循环，跑满 duration 秒。"""
    end = time.monotonic() + duration
    while time.monotonic() < end:
        pass  # 不让出
    print(f"[cpu_burn] 结束 @ {time.monotonic():.3f}")


async def sleeper() -> None:
    print(f"[sleeper]  启动 @ {time.monotonic():.3f}")
    await asyncio.sleep(0.1)
    print(f"[sleeper]  醒了 @ {time.monotonic():.3f}")


async def main() -> None:
    print(f"[main]     开始 @ {time.monotonic():.3f}")
    task_a = asyncio.create_task(cpu_burn(0.5))
    task_b = asyncio.create_task(sleeper())
    await asyncio.gather(task_a, task_b)
    print(f"[main]     结束 @ {time.monotonic():.3f}")


if __name__ == "__main__":
    asyncio.run(main())
