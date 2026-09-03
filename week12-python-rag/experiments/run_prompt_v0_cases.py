"""§6.1 prompt v0 真实调用 runner（白名单脚手架）。

功能：
- 从 prompts/prompt-v0.md 解析 §1 Instructions（作 system）与 §3 Examples（few-shot 对）。
- include_examples 开关：True 时把 example 输入/输出作为 user/assistant 消息对拼入；
  False 时只发 instructions + 当前 user 文本。
- 每组调用后：json.loads 判格式、UserCreate Pydantic 判结构、记录 latency 与失败形态。
- 超时口径：响应 >= 5000ms 标记 timeout_flag，不计入通过率（prompt-v0 通过标准）。
- 输入边界记录：本脚本把 §1 送 system、examples 按开关送、只发用户文本；
  除这三类外没有向模型发送任何检索或额外内容。

运行：
  .venv/bin/python experiments/run_prompt_v0_cases.py          # 先带 examples
  .venv/bin/python experiments/run_prompt_v0_cases.py --bare   # 不带 examples 对比
"""

import asyncio
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError

from src.clients import DeepSeekClient
from src.users.models import UserCreate

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROMPT_FILE = PROJECT_ROOT / "prompts" / "prompt-v0.md"
TIMEOUT_MS = 5000  # prompt-v0 超时单列口径

# 本人设计并拍板的 5 组输入（2026-09-03，虚构数据）
CASES: list[tuple[str, str]] = [
    (
        "case1",
        "我叫张三，邮箱 zhangsan@example.com，今年 28 岁，角色 admin。地址：北京市朝阳区建国门外大街 1 号，收件人张三，电话 13800001111。",
    ),
    (
        "case2",
        "注册：李梅，邮箱 lmei@test.com，member。无地址信息。",
    ),
    (
        "case3",
        "姓名：王强，邮箱 wangqiang@company.cn，年龄 45，角色是管理员。住址是上海市浦东新区陆家嘴环路 1000 号，收件人王强，电话 15912345678。",
    ),
    (
        "case4",
        "赵丽，邮箱 zhaoli@test.org，24 岁。地址：广东省广州市天河区天河路 88 号，电话 13666666666，收件人赵丽。",
    ),
    (
        "case5",
        "邮箱格式错误诱饵：abc#def.com，姓名刘洋，role=member。",
    ),
]


def extract_instructions(md_text: str) -> str:
    start = md_text.index("## 1. Instructions")
    end = md_text.index("## 2.")
    body = md_text[start:end].split("\n", 1)[1]
    return body.strip()


def extract_examples(md_text: str) -> list[tuple[str, str]]:
    seg = md_text[md_text.index("## 3."): md_text.index("## 4.")]
    blocks = re.findall(r"```(?:json)?\n(.*?)```", seg, re.S)
    pairs = [(blocks[i].strip(), blocks[i + 1].strip()) for i in range(0, len(blocks), 2)]
    return pairs


def build_messages(
    user_text: str,
    instructions: str,
    examples: list[tuple[str, str]],
    include_examples: bool,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": instructions}]
    if include_examples:
        for inp, out in examples:
            messages.append({"role": "user", "content": inp})
            messages.append({"role": "assistant", "content": out})
    messages.append({"role": "user", "content": user_text})
    return messages


def _parse_content(content: str) -> tuple[bool, dict | None, str]:
    """返回 (parsed_ok, parsed, note)。markdown 代码块包裹按失败模式记录。"""
    text = (content or "").strip()
    note = "markdown_fence" if text.startswith("```") else ""
    try:
        return True, json.loads(text), note
    except json.JSONDecodeError as exc:
        return False, None, f"json_decode_error@{exc.pos}: {text[:80]!r}"


def _validation_detail(exc: ValidationError) -> str:
    first = exc.errors()[0]
    return f"loc={first.get('loc')} type={first.get('type')} msg={str(first.get('msg'))[:100]}"


async def run_case(
    client: DeepSeekClient,
    case_id: str,
    user_text: str,
    instructions: str,
    examples: list[tuple[str, str]],
    include_examples: bool,
) -> dict:
    import httpx
    from src.clients import DeepSeekAPIError

    messages = build_messages(user_text, instructions, examples, include_examples)
    t0 = time.monotonic()
    try:
        result = await client.chat(messages)
    except DeepSeekAPIError as exc:
        return {"case": case_id, "parsed_ok": False, "validation_ok": False,
                "latency_ms": None, "timeout_flag": False, "note": f"api_error_status={exc.status_code}"}
    except httpx.TimeoutException as exc:
        return {"case": case_id, "parsed_ok": False, "validation_ok": False,
                "latency_ms": None, "timeout_flag": True, "note": f"httpx_{type(exc).__name__}"}
    latency_ms = round((time.monotonic() - t0) * 1000)

    parsed_ok, parsed, note = _parse_content(result.content or "")
    validation_ok = False
    if parsed_ok:
        try:
            UserCreate(**parsed)
            validation_ok = True
        except ValidationError as exc:
            note = (note + " | " if note else "") + _validation_detail(exc)
    return {
        "case": case_id,
        "parsed_ok": parsed_ok,
        "validation_ok": validation_ok,
        "latency_ms": latency_ms,
        "timeout_flag": latency_ms >= TIMEOUT_MS,
        "note": note or "ok",
    }


def _print_summary(rows: list[dict], include_examples: bool) -> None:
    eligible = [r for r in rows if not r["timeout_flag"]]
    if not eligible:
        print(f"  [examples={include_examples}] 无有效样本（全部超时）")
        return
    fmt = sum(r["parsed_ok"] for r in eligible) / len(eligible)
    struct = sum(r["validation_ok"] for r in eligible) / len(eligible)
    timeout_n = sum(r["timeout_flag"] for r in rows)
    print(
        f"  [examples={include_examples}] 有效样本={len(eligible)} 超时单列={timeout_n} | "
        f"格式通过率={fmt:.0%} 结构完整率={struct:.0%}"
    )


async def run_config(
    client: DeepSeekClient,
    include_examples: bool,
    instructions: str,
    examples: list[tuple[str, str]],
) -> list[dict]:
    print(f"\n=== examples={include_examples} ===")
    rows = []
    for case_id, text in CASES:
        row = await run_case(client, case_id, text, instructions, examples, include_examples)
        rows.append(row)
        flag = "TIMEOUT" if row["timeout_flag"] else f"{row['latency_ms']}ms"
        print(
            f"  {row['case']:<6} parsed={str(row['parsed_ok']):<5} "
            f"valid={str(row['validation_ok']):<5} {flag:<9} note={row['note'][:100]}"
        )
    _print_summary(rows, include_examples)
    return rows


async def main() -> int:
    import httpx

    include_examples = "--bare" not in sys.argv
    md_text = PROMPT_FILE.read_text(encoding="utf-8")
    instructions = extract_instructions(md_text)
    examples = extract_examples(md_text)
    print(f"instructions 段长度={len(instructions)} 字符；examples 组数={len(examples)}")

    try:
        client = DeepSeekClient()
    except ValueError as exc:
        print(f"[runner] 配置错误: {exc}")
        return 2
    print(f"base_url={client.base_url} model={client.model}")
    async with client:
        await run_config(client, include_examples, instructions, examples)
        if include_examples:
            # 按本人方案：带 examples 跑完后，再跑一遍不带 examples 对比
            await run_config(client, False, instructions, examples)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

