"""C1 实验：step 循环的 should_continue 判定（FakeClient 注入）。

可证伪假设：
若 FakeClient 每轮 final 事件都带 tool_calls，则 should_continue 恒为 True，
循环必在 step=max_steps 处抛出 RuntimeError("max_steps_reached=...")；
若某轮 final 的 tool_calls 为空，则循环在该轮自然 return，不触发兜底异常。
"""

import asyncio

from src.clients import FakeClient, FakeBehavior, ChatResult, ToolCall

# 两组 max_steps 必须相同（否则实验组的 RuntimeError 可能被误归因于 max_steps 更小）
MAX_STEPS = 3


def create_tool_call_behavior() -> FakeBehavior:
    """构造一个带 tool_calls 的 final 行为（对应 L242 的 tool_calls 分支）。"""
    return FakeBehavior(
        result=ChatResult(
            content=None,
            tool_calls=[
                ToolCall(
                    id="call_1",
                    name="lookup_user_by_email",
                    arguments='{"email": "test@example.com"}',
                )
            ],
        )
    )


def create_text_behavior() -> FakeBehavior:
    """构造一个无 tool_calls 的 final 行为（对应 L242 的 false 分支）。"""
    return FakeBehavior(
        result=ChatResult(
            content="Finished processing.",
            tool_calls=[],
        )
    )


async def run_scenario(
    behaviors: list[FakeBehavior], max_steps: int, label: str
) -> None:
    """运行单组实验，打印 step 级证据。

    控制流与 agent.py L202–309 逐行对齐：
        - L214: for step in range(1, max_steps + 1)
        - L216: should_continue = False（每轮重置，此处通过每次重新赋值隐含）
        - L220: output = await self._run_once(...)  →  result = await client.chat(...)
        - L242: should_continue = bool(event.data.get("tool_calls") or event.data.get("tool_results"))
                → 本实验只覆盖 tool_calls 分支
        - L286: if not should_continue: → return（自然终止）
        - L298: next_prompt = ...（本实验无需真实构造下一轮 prompt，直接用占位）
        - L309: raise RuntimeError(f"max_steps_reached={max_steps}")
    """
    client = FakeClient(behaviors=behaviors)
    print(f"\n=== {label} ===")

    # L214: 有界循环，上限由 max_steps 封死
    for step in range(1, max_steps + 1):
        print(f"  [step {step}] chat 调用")

        # L220: 一次「模型调用」，此处用 FakeClient 替代真实网络请求
        result = await client.chat([{"role": "user", "content": "ping"}])

        # L242: 收敛判定 —— 本实验只覆盖 tool_calls 分支，tool_results 注明未覆盖
        should_continue = bool(result.tool_calls)
        print(
            f"  [step {step}] tool_calls={bool(result.tool_calls)}, should_continue={should_continue}"
        )

        # L286: 正常终止出口
        if not should_continue:
            print("  [loop] 自然终止 (return)  ← 对应 L286–L287")
            return

        # L298: 继续则构造下一轮输入（本实验不依赖 prompt 内容，直接打印占位）
        print("  [loop] 继续下一轮")

    # L309: 循环耗尽兜底
    raise RuntimeError(f"max_steps_reached={max_steps}")


async def main() -> None:
    tool_behavior = create_tool_call_behavior()
    text_behavior = create_text_behavior()

    # --- 实验组：永远 tool_calls（单元素 behaviors，耗尽后重复最后一个）---
    try:
        await run_scenario(
            behaviors=[tool_behavior],
            max_steps=MAX_STEPS,
            label="实验组（永远 tool_calls）",
        )
    except RuntimeError as e:
        print(f"捕获到预期的 RuntimeError: {e}  ← 对应 L309")

    # --- 对照组：第二轮 tool_calls 为空（第 1 轮继续，第 2 轮自然 return）---
    # 唯一变量：第 2 轮 final 事件的 tool_calls 是否为空
    await run_scenario(
        behaviors=[tool_behavior, text_behavior],
        max_steps=MAX_STEPS,
        label="对照组（第二轮空 tool_calls）",
    )


if __name__ == "__main__":
    asyncio.run(main())
