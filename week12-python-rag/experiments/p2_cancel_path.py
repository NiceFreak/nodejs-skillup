"""P-2 对照实验：task.cancel() 传播路径（D4 §5 P-2 预测校准，C-2 语言层前置）。

场景（Python 3.12.10 预跑输出已核对，请本人再运行并解释对照记录 §11）：
  A  单次 cancel：异常在 await 表达式注入、except Exception 捕不到、finally/__aexit__ 执行
  B  单次 cancel + finally 中普通 await：实测正常完成，不被自动再次打断
  C  清理期间外部再次 cancel：第二次注入立即打断清理
  D  finally 中 await 永不完成的 future：任务悬挂（done=False, cancelled=False），需二次 cancel 恢复

运行：.venv/bin/python experiments/p2_cancel_path.py
"""

import asyncio
import time


class Resource:
    """async with 资源：观察 __aexit__ 在取消路径上的执行与 exc_type。"""

    async def __aenter__(self) -> "Resource":
        print(f"  [{time.monotonic():.3f}] Resource.__aenter__")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        name = exc_type.__name__ if exc_type else None
        print(f"  [{time.monotonic():.3f}] Resource.__aexit__ (exc_type={name})")


async def scenario_a() -> None:
    print("[A] 单次 cancel：注入点 + except Exception + finally + async with")

    async def worker() -> None:
        try:
            async with Resource():
                print(f"  [{time.monotonic():.3f}] worker hang 在 await Event().wait()")
                await asyncio.Event().wait()
        except asyncio.CancelledError:
            print(f"  [{time.monotonic():.3f}] 捕获到 asyncio.CancelledError")
            raise
        except Exception as exc:  # 预期永不触发
            print(f"  [异常] except Exception 捕获了 {type(exc).__name__} —— 继承判断有误")
            raise
        finally:
            print(f"  [{time.monotonic():.3f}] finally 执行")

    task = asyncio.create_task(worker())
    await asyncio.sleep(0)
    print(f"  [{time.monotonic():.3f}] 外部 task.cancel()")
    task.cancel()
    with_cancel = None
    try:
        await task
    except asyncio.CancelledError:
        with_cancel = "CancelledError"
    print(f"  [A] 外部 await task 收到: {with_cancel}; cancelled={task.cancelled()} done={task.done()}")


async def scenario_b() -> None:
    print("\n[B] 单次 cancel + finally 中普通 await（关键校准点）")

    async def worker() -> None:
        try:
            await asyncio.Event().wait()
        finally:
            print(f"  [{time.monotonic():.3f}] finally 进入，await asyncio.sleep(0.1)")
            try:
                await asyncio.sleep(0.1)
                print(f"  [{time.monotonic():.3f}] finally 的 sleep 正常完成（未被自动再次打断）")
            except asyncio.CancelledError:
                print(f"  [{time.monotonic():.3f}] finally 的 sleep 再抛 CancelledError")
                raise

    task = asyncio.create_task(worker())
    await asyncio.sleep(0)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print(f"  [{time.monotonic():.3f}] 外部收到 CancelledError; cancelled={task.cancelled()}")


async def scenario_c() -> None:
    print("\n[C] 清理期间外部再次 cancel（第二次注入打断清理）")

    async def worker() -> None:
        try:
            await asyncio.Event().wait()
        finally:
            print(f"  [{time.monotonic():.3f}] finally 进入，清理 await sleep(1.0)")
            try:
                await asyncio.sleep(1.0)
                print("  [C] 清理 sleep 完成（未被打断）")
            except asyncio.CancelledError:
                print(f"  [{time.monotonic():.3f}] 清理 sleep 被第二次 cancel 打断")
                raise

    task = asyncio.create_task(worker())
    await asyncio.sleep(0)
    task.cancel()
    await asyncio.sleep(0.05)  # 给时间进入 finally 清理
    print(f"  [{time.monotonic():.3f}] 外部第二次 task.cancel()")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print(f"  [{time.monotonic():.3f}] 外部收到 CancelledError")


async def scenario_d() -> None:
    print("\n[D] finally 中 await 永不完成的 future -> 悬挂 + 二次 cancel 恢复")

    async def worker() -> None:
        try:
            await asyncio.Event().wait()
        finally:
            print(f"  [{time.monotonic():.3f}] finally 进入，await 一个永不完成的 Event().wait()")
            await asyncio.Event().wait()
            print("  [D] 不会到这里")

    task = asyncio.create_task(worker())
    await asyncio.sleep(0)
    task.cancel()
    await asyncio.sleep(0.1)
    print(f"  [{time.monotonic():.3f}] 取消后 0.1s: done={task.done()} cancelled={task.cancelled()} （悬挂）")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print(f"  [{time.monotonic():.3f}] 第二次 cancel 注入后恢复; done={task.done()}")


async def main() -> None:
    await scenario_a()
    await scenario_b()
    await scenario_c()
    await scenario_d()


if __name__ == "__main__":
    asyncio.run(main())
