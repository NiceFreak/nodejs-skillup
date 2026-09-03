"""§6.2 最小工具调用实验（白名单脚手架）。

- 定义**一个**本地函数 lookup_user_by_email（纯本地 dict 查询），给出 OpenAI/DeepSeek 兼容工具 schema。
- 一次带 tools 的真实调用：观察模型返回的 tool_calls 结构、arguments 是否可直接 json.loads。
- 工具执行由调用方（本脚本）完成——观察「结果由谁执行、以什么形态回传」；
  本日只做一次往返，不回灌成循环（Agent loop 属黑名单，不做）。
- 与 Bub 三层分离（模型决策 -> ToolExecutor 执行 -> harness 落盘）的对照结论由本人写。

运行：.venv/bin/python experiments/tool_call_demo.py
"""

import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.clients import DeepSeekClient

# 本地「用户表」（虚构数据，仅演示工具执行）
LOCAL_USERS = {
    "lisi@work.com": {"name": "李四", "email": "lisi@work.com", "role": "admin"},
    "wangwu@test.org": {"name": "王五", "email": "wangwu@test.org", "role": "member"},
}


def lookup_user_by_email(email: str) -> dict | None:
    """按邮箱查本地用户；未命中返回 None。"""
    return LOCAL_USERS.get(email)


TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "lookup_user_by_email",
        "description": "按邮箱查询用户信息；返回 name/email/role，未命中返回 None。",
        "parameters": {
            "type": "object",
            "properties": {"email": {"type": "string", "description": "要查询的用户邮箱"}},
            "required": ["email"],
        },
    },
}


async def main() -> int:
    client = DeepSeekClient()
    messages = [
        {"role": "system", "content": "你是助手。需要用户信息时调用 lookup_user_by_email 工具。"},
        {"role": "user", "content": "请查一下 lisi@work.com 的用户信息，并告诉我他的角色。"},
    ]
    t0 = time.monotonic()
    async with client:
        result = await client.chat(messages, tools=[TOOL_SCHEMA])
    latency_ms = round((time.monotonic() - t0) * 1000)
    print(f"[tool] 耗时 {latency_ms}ms; content={result.content!r}")
    print(f"[tool] tool_calls 数量={len(result.tool_calls)}")
    for call in result.tool_calls:
        print(f"  id={call.id}")
        print(f"  name={call.name}")
        print(f"  arguments(raw)={call.arguments}")
        try:
            args = json.loads(call.arguments)
            print(f"  arguments(parsed)={args!r}")
        except json.JSONDecodeError as exc:
            print(f"  arguments 解析失败: {exc}")
            return 2
        # 工具执行由调用方完成（模型只决策，不执行）
        out = lookup_user_by_email(**args)
        print(f"  [执行] lookup_user_by_email(**{args}) -> {out!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
