"""§5.2 gather 对照：一个失败其余怎么办；return_exceptions 收集形态。

场景 A（默认 return_exceptions=False）：
  child = slow_ok(0.3s 返回) / fast_fail(0.05s 抛 ValueError) / late_ok(0.6s 返回)。
  观察：await gather 何时抛（fast_fail 完成即刻还是等全部）；抛的哪个异常；
         late_ok 是否继续在后台跑完（t3.done() 与后续 await t3）。
场景 B（return_exceptions=True）：
  同一组 child；观察返回列表形态 = [结果, 异常对象, 结果]，是否全部完成才返回。

运行：.venv/bin/python experiments/gather_demo.py
"""

import asyncio
import time


async def slow_ok() -> str:
    await asyncio.sleep(0.3)
    print(f"  [{time.monotonic():.3f}] slow_ok 完成")
    return "slow_ok"


async def fast_fail() -> str:
    await asyncio.sleep(0.05)
    print(f"  [{time.monotonic():.3f}] fast_fail 抛异常")
    raise ValueError("boom-fast")


async def late_ok() -> str:
    await asyncio.sleep(0.6)
    print(f"  [{time.monotonic():.3f}] late_ok 完成")
    return "late_ok"


async def scenario_a() -> None:
    print("[A] 默认 return_exceptions=False")
    t1 = asyncio.create_task(slow_ok())
    t2 = asyncio.create_task(fast_fail())
    t3 = asyncio.create_task(late_ok())
    try:
        results = await asyncio.gather(t1, t2, t3)
        print(f"  [A] gather 正常返回: {results}")
    except ValueError as exc:
        print(f"  [{time.monotonic():.3f}] [A] gather 抛 ValueError: {exc}")
    print(f"  [{time.monotonic():.3f}] [A] 已从 gather 返回；此刻 t3.done()={t3.done()}")
    r3 = await t3
    print(f"  [{time.monotonic():.3f}] [A] late_ok 后台继续完成，await t3 = {r3}")


async def scenario_b() -> None:
    print("\n[B] return_exceptions=True")
    t1 = asyncio.create_task(slow_ok())
    t2 = asyncio.create_task(fast_fail())
    t3 = asyncio.create_task(late_ok())
    results = await asyncio.gather(t1, t2, t3, return_exceptions=True)
    kinds = [type(r).__name__ for r in results]
    print(f"  [{time.monotonic():.3f}] [B] gather 返回（全部完成才返回）: kinds={kinds}")
    print(f"  [B] 各项: {results!r}")


async def main() -> None:
    await scenario_a()
    await scenario_b()


if __name__ == "__main__":
    asyncio.run(main())
