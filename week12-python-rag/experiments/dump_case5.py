"""临时 dump：case5 原始输出（两种 examples 配置），验证失败模式推断。

运行：.venv/bin/python experiments/dump_case5.py
"""

import asyncio
import importlib.util
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

spec = importlib.util.spec_from_file_location(
    "runner", Path(__file__).resolve().parents[1] / "experiments" / "run_prompt_v0_cases.py"
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

from src.clients import DeepSeekClient


async def main() -> int:
    md = runner.PROMPT_FILE.read_text(encoding="utf-8")
    ins = runner.extract_instructions(md)
    exs = runner.extract_examples(md)
    case_id, text = runner.CASES[4]
    client = DeepSeekClient()
    async with client:
        for inc in (True, False):
            msgs = runner.build_messages(text, ins, exs, inc)
            r = await client.chat(msgs)
            print(f"=== case5 examples={inc} ===")
            print((r.content or "").strip()[:600])
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
