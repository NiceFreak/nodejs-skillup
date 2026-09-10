#!/usr/bin/env python3
"""measure-input-budget — W13 D4 阶段 2：按冻结 C1 口径计量完整输入请求。

口径（C1 由本人 2026-09-10 冻结为「是」）：对每条 dev query 分别组装完整请求
（system instructions + 完整 Evidence Context + 该条 query），逐条估算，取最大输入占用为门禁值。

门禁：可用输入上限 = 1,000,000 − 4,096 − 100,000 = 895,904 tokens

边界：离线 tokenizer 结果记为 estimate；真实调用的 provider usage 是另一份运行证据。
      只读 dev；不写 evidence/serialization/。

用法：cd week13-rag && .venv/bin/python scripts/measure-input-budget.py
产物：evidence/input-budget/assembled-input-rules-c0a4b85.json
"""
from __future__ import annotations

import hashlib
import json
import platform
import sys
from pathlib import Path

import tokenizers
import transformers

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from w13rag.generation import assemble_messages, system_instructions  # noqa: E402
CTX = ROOT / "evidence/serialization/evidence-context-rules-c0a4b85.txt"
PROMPT = ROOT / "prompts/rag-prompt-v1.md"
DEV = ROOT / "eval/dev/items.json"
TOKDIR = ROOT / ".cache/tokenizer/deepseek_v4_tokenizer"


def prompt_version(path: Path = PROMPT) -> str:
    """从冻结 Prompt 头部读取版本号；用它给证据文件命名，换版本时不覆盖历史证据。"""
    import re

    m = re.search(r"^- Prompt version：`([^`]+)`", path.read_text(encoding="utf-8"), re.M)
    if m is None:
        raise SystemExit("cannot read Prompt version from the frozen prompt header")
    return m.group(1)


OUT = ROOT / f"evidence/input-budget/assembled-input-rules-c0a4b85-{prompt_version()}.json"

WINDOW = 1_000_000
RESERVED = 4096
MARGIN = 100_000
ARCHIVE_SHA256 = "e7310d1dafe0a86d8a5629fe78a7c763760f651db9b8682718a1781dcd6fe495"


def main() -> int:
    ctx = CTX.read_text(encoding="utf-8")
    # 与真实发送路径共用同一组装函数（单一入口），避免「计量的输入」与「发出的输入」漂移。
    system = system_instructions(PROMPT)
    dev = json.loads(DEV.read_text(encoding="utf-8"))
    if dev.get("split") != "dev":
        raise SystemExit("refusing to measure a non-dev split")

    tk = transformers.AutoTokenizer.from_pretrained(
        str(TOKDIR), local_files_only=True, trust_remote_code=False
    )
    enc = lambda t: len(tk.encode(t, add_special_tokens=False))  # noqa: E731
    sys_t, ctx_t = enc(system), enc(ctx)
    limit = WINDOW - RESERVED - MARGIN

    rows = []
    for it in dev["items"]:
        msgs = assemble_messages(system, ctx, it["query"])
        user = msgs[1]["content"]
        rendered = len(tk.apply_chat_template(msgs, tokenize=True, add_generation_prompt=True))
        cjk = sum(1 for ch in (system + user) if "\u4e00" <= ch <= "\u9fff")
        ratio = cjk * 0.6 + (len(system + user) - cjk) * 0.3
        rows.append(
            dict(
                item_id=it["id"],
                behavior_type=it["behavior_type"],
                query=it["query"],
                query_tokens=enc(it["query"]),
                user_message_tokens=enc(user),
                component_sum=sys_t + enc(user),
                rendered_request_tokens=rendered,
                template_overhead=rendered - (sys_t + enc(user)),
                char_ratio_estimate=round(ratio, 1),
            )
        )
    top = max(rows, key=lambda r: r["rendered_request_tokens"])
    write_evidence(ctx, system, sys_t, ctx_t, rows, top, limit, tk)
    return 0


def write_evidence(ctx, system, sys_t, ctx_t, rows, top, limit, tk) -> None:
    rel = lambda p: str(p.relative_to(ROOT))  # noqa: E731
    evidence = dict(
        schemaVersion=1,
        evidenceId="assembled-input-rules-c0a4b85-deepseek-v4-offline",
        createdAt="2026-09-10",
        classification="estimate",
        method=(
            "C1 frozen 2026-09-10: assemble the full request per dev query, "
            "estimate each, gate on the maximum"
        ),
        corpus=dict(
            snapshotId="rules-c0a4b85",
            manifestSha256=hashlib.sha256(
                (ROOT / "corpus/rules-c0a4b85/manifest.json").read_bytes()
            ).hexdigest(),
        ),
        evidenceContext=dict(
            path=rel(CTX), chars=len(ctx), sha256=hashlib.sha256(ctx.encode()).hexdigest()
        ),
        prompt=dict(
            version=prompt_version(PROMPT),
            path=rel(PROMPT),
            systemInstructionsChars=len(system),
            systemInstructionsSha256=hashlib.sha256(system.encode()).hexdigest(),
        ),
        tokenizer=dict(
            archiveSha256=ARCHIVE_SHA256,
            tokenizerJsonSha256=hashlib.sha256((TOKDIR / "tokenizer.json").read_bytes()).hexdigest(),
            runtime=dict(
                python=platform.python_version(),
                platform=f"{platform.system()} {platform.release()} {platform.machine()}",
                transformers=transformers.__version__,
                tokenizers=tokenizers.__version__,
                jinja2=__import__("jinja2").__version__,
                tokenizerClass=type(tk).__name__,
                addSpecialTokens=False,
                localFilesOnly=True,
                trustRemoteCode=False,
                addGenerationPrompt=True,
            ),
            note=(
                "D1 pipFreeze 的 filelock==3.32.5 不可解析；本环境为 py3.12.10 的解析结果，"
                "与 D1 记录仅差 filelock 3.32.6 与 regex 2026.9.10 两个补丁版本；"
                "等价性由 D1 逐文件 token 数复现证明（18697）。"
                "jinja2 为渲染 chat template 新增，不参与 encode/decode。"
            ),
        ),
        budget=dict(
            contextWindow=WINDOW,
            contextWindowSource="DeepSeek Models & Pricing: CONTEXT LENGTH 1M (retrieved 2026-09-10)",
            reservedOutput=RESERVED,
            safetyMargin=MARGIN,
            usableInputLimit=limit,
            maxOutputDocumented="384K",
        ),
        sharedTokens=dict(
            systemInstructions=sys_t, evidenceContext=ctx_t, systemPlusContext=sys_t + ctx_t
        ),
        items=rows,
        gate=dict(
            maxItem=top["item_id"],
            maxRenderedRequestTokens=top["rendered_request_tokens"],
            usableInputLimit=limit,
            fits=top["rendered_request_tokens"] <= limit,
            headroom=limit - top["rendered_request_tokens"],
        ),
        boundaries=[
            "Offline tokenizer counts are estimates; host-side prompt rendering may differ.",
            "provider usage from a real request is separate runtime evidence.",
            "1M is the vendor field value; the model alias deepseek-v4-flash is documented as retired "
            "and routed to DeepSeek-V4.1-Flash, so runtime model identity still has to be recorded.",
        ],
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"system instructions : chars={len(system)} tokens={sys_t}")
    print(f"evidence context    : chars={len(ctx)} tokens={ctx_t}")
    print(f"tokenizer           : {type(tk).__name__} transformers={transformers.__version__} "
          f"tokenizers={tokenizers.__version__}")
    print()
    print("%-34s %6s %8s %7s %9s %8s" % ("item", "query", "user_msg", "sum", "rendered", "overhead"))
    for r in rows:
        print("%-34s %6d %8d %7d %9d %8d" % (
            r["item_id"], r["query_tokens"], r["user_message_tokens"],
            r["component_sum"], r["rendered_request_tokens"], r["template_overhead"]))
    print()
    print(f"最大渲染请求 : {top['item_id']} = {top['rendered_request_tokens']} tokens")
    print(f"可用输入上限 : {WINDOW} - {RESERVED} - {MARGIN} = {limit}")
    print(f"门禁结论     : {'可完整容纳' if top['rendered_request_tokens'] <= limit else '不可完整容纳'}"
          f"（余量 {limit - top['rendered_request_tokens']} tokens）")
    print(f"已落盘       : {rel(OUT)}")


if __name__ == "__main__":
    raise SystemExit(main())
