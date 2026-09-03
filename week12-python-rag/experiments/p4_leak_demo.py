"""P-4 现象观察：进程退出时有未完成 task，会看到什么（对照 Node 未 settle Promise）。

故意制造一个「创建了但从不 await、也不取消」的 task，观察 asyncio.run 收尾时：
- 残留 task 是否阻止进程退出？
- 是否出现 "Task was destroyed but it is pending!" 等 RuntimeWarning？
- -W error::RuntimeWarning 下是否转异常、退出码非 0？

运行（默认，看警告形态）：
    .venv/bin/python -m experiments.p4_leak_demo
运行（警告转错误，看收尾是否变失败）：
    .venv/bin/python -W error::RuntimeWarning -m experiments.p4_leak_demo
"""

import asyncio


async def never() -> None:
    print("  [never] 启动，await Event().wait() 永不结束")
    await asyncio.Event().wait()


async def main() -> None:
    asyncio.create_task(never())  # 创建即调度，不保存引用、不 await
    print("  [main] 返回（残留 task 未 await、未取消）")


print("[脚本] asyncio.run(main()) 开始")
asyncio.run(main())
print("[脚本] asyncio.run 已返回，进程即将退出")
