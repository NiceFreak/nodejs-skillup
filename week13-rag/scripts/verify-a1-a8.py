#!/usr/bin/env python3
"""verify-a1-a8 — W13 serialization review 用的 A1-A8 只读验证脚本。

用途：为 notes/serialization-review-A1-A8-evidence.md 提供可重跑证据。
边界：只读冻结 snapshot 与内存对象；不写 evidence/、不调用模型、不修改代码。
用法：cd week13-rag && python3 scripts/verify-a1-a8.py
退出码：0 = 全部不变式通过；1 = 有不变式失败（失败项打印 FAIL）。
"""
from __future__ import annotations

import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import w13rag.parser as P  # noqa: E402
from w13rag.parser import BlockInfo  # noqa: E402
from w13rag.registry import (  # noqa: E402
    WRAPPER_FORBIDDEN,
    build_entries,
    evidence_context_string,
)
from w13rag.serialize import content_sha256  # noqa: E402
from w13rag.source import SourceDoc, read_doc  # noqa: E402

SNAP = ROOT / "corpus" / "rules-c0a4b85"
FAILS: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    if not ok:
        FAILS.append(f"{label}{(' | ' + detail) if detail else ''}")
    print(f"  {'ok  ' if ok else 'FAIL'} {label}{(' | ' + detail) if detail else ''}")


def manual(doc, headings, headers, a, b, code, quote):
    """独立重算 model_content：只依据 D3 6.2.0 #1/#2 文字，不复用 serialize.py。"""
    out, prev = [], False
    seq = [(h, "plain") for h in headings] + [(h, "plain") for h in headers]
    seq += [(ln, "verb" if (quote or ln in code) else "plain") for ln in range(a, b + 1)]
    for ln, kind in seq:
        raw = doc.lines[ln - 1]
        if kind == "verb":
            txt = raw
        else:
            body = raw.rstrip(" \t")
            trail = raw[len(body):]
            ok2 = len(trail) >= 2 and "\t" not in trail
            txt = "" if body == "" else (body + "  " if ok2 else body)
        if kind == "plain" and txt == "":
            if prev:
                continue
            prev = True
        else:
            prev = False
        out.append(txt)
        if doc.has_lf[ln - 1]:
            out.append("\n")
    return "".join(out)


def main() -> int:
    man = json.loads((SNAP / "manifest.json").read_text(encoding="utf-8"))
    docs = [
        read_doc(SNAP, man["corpusId"], d["sourcePath"], d["snapshotPath"])
        for d in man["documents"]
    ]
    parsed = [(d,) + P.parse_blocks(d) for d in docs]
    entries = build_entries([(d, b, c) for d, b, c in parsed])
    ctx = evidence_context_string(entries)
    kinds = collections.Counter(b.kind for _, blocks, _ in parsed for b in blocks)
    print(f"[BASE] blocks={len(entries)} kinds={dict(kinds)}")
    print(f"[BASE] ctx_chars={len(ctx)} ctx_sha={content_sha256(ctx)}")
    print(f"[BASE] wrapper_forbidden={WRAPPER_FORBIDDEN!r}")

    print("[A1] ancestor 标题链")
    bad, lvlbad, h1, total = [], [], 0, 0
    for d, blocks, _ in parsed:
        for blk in blocks:
            total += 1
            chain = []
            for ln in range(1, blk.core_start):
                m = re.match(r"^(#{1,6})(?:[ \t]|$)", d.lines[ln - 1])
                if m:
                    lv = len(m.group(1))
                    while chain and chain[-1][0] >= lv:
                        chain.pop()
                    chain.append((lv, ln))
            if [ln for _, ln in chain] != list(blk.headings):
                bad.append((d.source_path, blk.kind, blk.core_start))
            lv = [len(re.match(r"^(#{1,6})", d.lines[h - 1]).group(1)) for h in blk.headings]
            if lv != sorted(lv) or len(set(lv)) != len(lv):
                lvlbad.append((d.source_path, blk.core_start, lv))
            if blk.headings and blk.headings[0] == 1 and d.lines[0].startswith("# "):
                h1 += 1
    check("独立重算 heading 链 == registry", not bad, f"mismatch={len(bad)} {bad[:3]}")
    check("层级由外到内且不重复", not lvlbad, f"bad={len(lvlbad)}")
    print(f"       含文档 H1 的 block={h1}/{total}")

    print("[A2] 段落只按空行/结构行断开")
    para = [(d, b) for d, blocks, _ in parsed for b in blocks if b.kind == "paragraph"]
    viol = []
    for d, blk in para:
        for ln in range(blk.core_start, blk.core_end + 1):
            t = d.lines[ln - 1]
            if t.strip() == "":
                viol.append(("blank", d.source_path, ln))
            elif (
                P._HEADING_RE.match(t)
                or P._HR_RE.match(t)
                or P._MARK_RE.match(t)
                or t.startswith(">")
            ):
                viol.append(("structural", d.source_path, ln))
            elif t.startswith("|") and ln < len(d.lines) and P._DELIM_RE.match(d.lines[ln]):
                viol.append(("table-start", d.source_path, ln))
    check("段落核心不含空行/结构行", not viol, f"violations={len(viol)} {viol[:3]}")

    print("[A3] fence 合并与逐字保真")
    merged, alone, code_lines_total = [], [], 0
    for d, blocks, code in parsed:
        for blk in blocks:
            if blk.kind != "code":
                continue
            cs = blk.code_spans[0][0]
            (merged if blk.core_start < cs else alone).append((d.source_path, blk.core_start, cs))
            code_lines_total += blk.code_spans[-1][1] - blk.code_spans[0][0] + 1
    check("合并方向全部向前", all(core < cs for _, core, cs in merged), f"merged={len(merged)}")
    check("合并分支在冻结语料上确实命中", len(merged) > 0, f"merged={len(merged)}")
    print(f"       独立 code block={len(alone)}（冻结语料 0 次命中该分支）")
    print(f"       fenced-code 行={code_lines_total}")

    print("[A4] 列表拆分与 lazy continuation")
    li = [(d, b) for d, blocks, _ in parsed for b in blocks if b.kind == "list_item"]
    indent_bad = []
    for d, blk in li:
        base = P._indent(d.lines[blk.core_start - 1])
        if not P._MARK_RE.match(d.lines[blk.core_start - 1]):
            indent_bad.append(("core-start-not-marker", d.source_path, blk.core_start))
        for ln in range(blk.core_start + 1, blk.core_end + 1):
            t = d.lines[ln - 1]
            if t.strip() and P._indent(t) < base:
                indent_bad.append(("indent<base", d.source_path, ln))
    tight, inner = [], []
    for d, blocks, _ in parsed:
        for i in range(len(blocks) - 1):
            a, nxt = blocks[i], blocks[i + 1]
            if a.kind != "list_item" or nxt.kind != "paragraph":
                continue
            base = P._indent(d.lines[a.core_start - 1])
            if P._indent(d.lines[nxt.core_start - 1]) > base:
                continue
            if nxt.core_start == a.core_end + 1:
                tight.append((d.source_path, nxt.core_start))
    for d, blocks, _ in parsed:
        for blk in blocks:
            if blk.kind != "list_item":
                continue
            base = P._indent(d.lines[blk.core_start - 1])
            for ln in range(blk.core_start + 1, blk.core_end + 1):
                t = d.lines[ln - 1]
                if t.strip() and not P._MARK_RE.match(t) and P._indent(t) <= base:
                    inner.append((d.source_path, ln))
    check("列表项核心首行是标记且无缩进<base 的实义行", not indent_bad, f"violations={len(indent_bad)}")
    check("冻结语料无 lazy continuation（紧邻且无分隔行）", not tight, f"tight={len(tight)} {tight[:3]}")
    check("无 lazy 行被错误归入父项", not inner, f"inner={len(inner)}")
    print(f"       list_item={len(li)}")

    print("[A5] blockquote 递归与逐字保留")
    q = [(d, b) for d, blocks, _ in parsed for b in blocks if b.kind.startswith("quote_")]
    qbad = [
        (d.source_path, b.core_start)
        for d, b in q
        if any(not d.lines[ln - 1].startswith(">") for ln in range(b.core_start, b.core_end + 1))
    ]
    ass = collections.Counter()
    for d, _, _ in parsed:
        for t in d.lines:
            if not t.startswith(">"):
                continue
            if t.startswith(">>"):
                ass["nested >>"] += 1
            if re.match(r"^>\s*```", t):
                ass["fence in quote"] += 1
            if re.match(r"^>\s*\|", t):
                ass["table in quote"] += 1
            if re.match(r"^>\s*#{1,6}\s", t):
                ass["heading in quote"] += 1
            if re.match(r"^>\s*(-{3,}|\*{3,}|_{3,})\s*$", t):
                ass["HR in quote"] += 1
    check("quote 核心行全部以 > 开头", not qbad, f"bad={len(qbad)}")
    check("语料引文结构假设成立", not ass, f"counters={dict(ass)}")
    print(f"       quote blocks={len(q)} kinds={dict(collections.Counter(b.kind for _, b in q))}")

    print("[A6] 表格每行一个 block 并附表头")
    tr = [(d, b) for d, blocks, _ in parsed for b in blocks if b.kind == "table_row"]
    tbad = []
    for d, blk in tr:
        if blk.core_start != blk.core_end:
            tbad.append(("core not single line", d.source_path, blk.core_start))
        if len(blk.headers) != 2 or blk.headers[1] != blk.headers[0] + 1:
            tbad.append(("header rows != 2 consecutive", d.source_path, tuple(blk.headers)))
        elif not P._DELIM_RE.match(d.lines[blk.headers[1] - 1]):
            tbad.append(("header[1] not delimiter", d.source_path, tuple(blk.headers)))
        if P._DELIM_RE.match(d.lines[blk.core_start - 1]):
            tbad.append(("core is delimiter row", d.source_path, blk.core_start))
        if not blk.headings:
            tbad.append(("missing heading ctx", d.source_path, blk.core_start))
    check("table_row 核心单行 + headers=header,delimiter + 有 heading", not tbad, f"violations={len(tbad)}")
    print(f"       table_row={len(tr)} tables={len({(d.source_path, b.headers[0]) for d, b in tr})}")

    print("[A7] thematic break 只作硬边界")
    hr_in = [
        (d.source_path, ln)
        for d, blocks, _ in parsed
        for blk in blocks
        for ln in range(blk.core_start, blk.core_end + 1)
        if P._HR_RE.match(d.lines[ln - 1])
    ]
    hr_total = sum(1 for d, _, _ in parsed for t in d.lines if P._HR_RE.match(t))
    ctx_hr = [line for line in ctx.split("\n") if line == "---"]
    check("无 HR 落在 block 核心内", not hr_in, f"count={len(hr_in)}")
    check("Evidence Context 无独立 --- 行", not ctx_hr, f"count={len(ctx_hr)}")
    print(f"       语料 HR={hr_total}")

    print("[A8] wrapper 前置条件")
    occ = sum(1 for d, _, _ in parsed for t in d.lines if "<source" in t or "</source>" in t)

    def probe(text: str) -> str:
        doc = SourceDoc("probe", "probe.md", "probe.md", (text,), (True,))
        try:
            build_entries([(doc, [BlockInfo("paragraph", 1, 1)], set())])
            return "NO-RAISE"
        except ValueError:
            return "ValueError"

    cases = [
        ('<source id="x">', "ValueError"),
        ("<source>", "ValueError"),
        ("</source>", "ValueError"),
        ("a <source id=1> b", "ValueError"),
        ('<SOURCE id="x">', "NO-RAISE"),
        ("plain text", "NO-RAISE"),
    ]
    got = {t: probe(t) for t, _ in cases}
    check("语料中无字面 <source / </source>", occ == 0, f"occurrences={occ}")
    check("前缀守卫语义（大小写敏感）", all(got[t] == exp for t, exp in cases), f"got={got}")

    print("[BASE] 全语料独立重算比对")
    by_id = {e["source_id"]: e for e in entries}
    mism = []
    for d, blocks, code in parsed:
        for blk in blocks:
            sid = f"{d.corpus_id}/{d.source_path}#L{blk.core_start}-L{blk.core_end}"
            e = by_id.get(sid)
            if e is None:
                mism.append(("missing", sid))
                continue
            alt = manual(d, blk.headings, blk.headers, blk.core_start, blk.core_end, code, blk.quote)
            if alt != e["model_content"]:
                mism.append(("differs", sid))
    check("独立重算 model_content == registry（全部 block）", not mism, f"mismatch={len(mism)} {mism[:3]}")

    print()
    if FAILS:
        print(f"RESULT: FAIL（{len(FAILS)} 项）")
        for f in FAILS:
            print("  -", f)
        return 1
    print(f"RESULT: PASS（blocks={len(entries)}，不变式全部成立）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


