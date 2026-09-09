"""Deterministic Markdown block segmentation per D2 §6.1 / D3 §6.2.0.

The parser never calls a model.  It consumes a frozen snapshot and produces,
for every source file, one BlockInfo per source block:

- core_span: the contiguous line range that becomes the source_id
  (`corpus_id/source_path#Lstart-Lend`);
- heading context (role=heading, outer->inner) when the block depends on its
  enclosing Markdown section;
- table header rows (role=table_header) for per-row table blocks.

Mechanical rules implemented here, with corpus facts verified on
`rules-c0a4b85` (2026-09-09): fences are column-0 only; blockquotes contain
no nested `>>`, no interior fences/tables; no lazy list continuation; the
corpus has no CRLF/BOM.  These are implementation conventions, not new
contract semantics; semantic boundary quality is judged later by dev eval.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .source import SourceDoc

_MARK_RE = re.compile(r"^([ \t]*)(?:[-+*]|\d{1,9}\.)[ \t]+")
_HEADING_RE = re.compile(r"^(#{1,6})(?:[ \t].*)?$")
_HR_RE = re.compile(r"^([-*_])(?:[ \t]*\1){2,}[ \t]*$")
_DELIM_RE = re.compile(r"^\|(?:\s*:?-+:?\s*\|)+\s*$")
_ROWLIKE_RE = re.compile(r"^\|.*\|\s*$")


@dataclass
class BlockInfo:
    kind: str
    core_start: int  # 1-based inclusive
    core_end: int  # 1-based inclusive
    headings: list[int] = field(default_factory=list)  # outer -> inner
    headers: list[int] = field(default_factory=list)  # table header rows
    code_spans: list[tuple[int, int]] = field(default_factory=list)
    quote: bool = False


def _indent(text: str) -> int:
    width = 0
    for ch in text:
        if ch == " ":
            width += 1
        elif ch == "\t":
            width += 4 - (width % 4)
        else:
            break
    return width


def _heading_level(text: str) -> int | None:
    m = _HEADING_RE.match(text)
    if not m:
        return None
    return len(m.group(1))


def _code_ranges(lines: list[str]) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    open_at: int | None = None
    for idx, raw in enumerate(lines):
        if raw.startswith("```"):
            if open_at is None:
                open_at = idx
            else:
                ranges.append((open_at, idx))
                open_at = None
    if open_at is not None:  # unbalanced fence: treat rest as verbatim
        ranges.append((open_at, len(lines) - 1))
    return ranges


def _code_set(ranges: list[tuple[int, int]]) -> set[int]:
    out: set[int] = set()
    for a, b in ranges:
        out.update(range(a, b + 1))
    return out


def _trim_trailing_blanks(lines: list[str], end_excl: int, start: int = 0) -> int:
    """Return exclusive end index after dropping trailing blank lines."""
    e = end_excl
    while e > start and lines[e - 1].strip() == "":
        e -= 1
    return e


def _strip_quote(raw: str) -> str:
    """Remove one '>' marker and the optional single following space."""
    rest = raw[1:]
    if rest.startswith(" "):
        rest = rest[1:]
    return rest


def _list_island(lines: list[str], first: int) -> tuple[list[tuple[int, int]], int]:
    """Split a list island into top-level items [start, end_exclusive).

    `first` is the 0-based index of the first list-item line; its indentation
    is the island base indent.  Nested list items and indented continuation
    lines stay inside the currently open top-level item; a marker at lower
    indent or an indent-0 non-marker line after blank content ends the island
    at `stop` (not consumed).
    """
    n = len(lines)
    base = _indent(lines[first])
    markers = [first]
    stop = n
    k = first + 1
    while k < n:
        raw = lines[k]
        if raw.strip() == "":
            k += 1
            continue
        if raw.startswith("```") or _HEADING_RE.match(raw) or _HR_RE.match(raw):
            stop = k
            break
        if raw.startswith(">") or (
            raw.startswith("|") and k + 1 < n and _DELIM_RE.match(lines[k + 1])
        ):
            stop = k
            break
        m = _MARK_RE.match(raw)
        if m:
            ind = _indent(raw)
            if ind == base:
                markers.append(k)
            elif ind < base:
                stop = k
                break
            k += 1
            continue
        # plain line
        ind = _indent(raw)
        if ind > base:
            k += 1
            continue
        # ind <= base: no lazy continuation in the frozen corpus -> island ends
        stop = k
        break

    items: list[tuple[int, int]] = []
    for idx, m in enumerate(markers):
        e = markers[idx + 1] if idx + 1 < len(markers) else stop
        e = _trim_trailing_blanks(lines, e, m)
        items.append((m, e))
    return items, stop


def parse_blocks(doc: SourceDoc) -> tuple[list[BlockInfo], set[int]]:
    """Parse one snapshot document into ordered BlockInfo list.

    Returns (blocks, code_lines) where code_lines is the set of 1-based line
    numbers that are part of fenced code regions (fences included).
    """
    lines = list(doc.lines)
    n = len(lines)
    ranges = _code_ranges(lines)
    code0 = _code_set(ranges)
    code1 = {ln + 1 for ln in code0}
    open_to = {a: (a, b) for a, b in ranges}

    head_stack: list[tuple[int, int]] = []  # (level, line_no 1-based)
    blocks: list[BlockInfo] = []

    def snapshot_heads() -> list[int]:
        return [ln for _, ln in head_stack]

    i = 0
    while i < n:
        if i in open_to:
            cs, ce = open_to[i]
            cs1, ce1 = cs + 1, ce + 1
            if (
                blocks
                and blocks[-1].kind == "paragraph"
                and blocks[-1].core_end < cs1
                and all(x.strip() == "" for x in lines[blocks[-1].core_end: cs1 - 1])
            ):
                blocks[-1].kind = "code"
                blocks[-1].core_end = ce1
                blocks[-1].code_spans.append((cs1, ce1))
            else:
                blocks.append(
                    BlockInfo(
                        "code",
                        cs1,
                        ce1,
                        headings=snapshot_heads(),
                        code_spans=[(cs1, ce1)],
                    )
                )
            i = ce + 1
            continue
        if i in code0:  # interior code line: consumed by its region
            i += 1
            continue

        raw = lines[i]
        if raw.strip() == "":
            i += 1
            continue

        lvl = _heading_level(raw)
        if lvl is not None:
            while head_stack and head_stack[-1][0] >= lvl:
                head_stack.pop()
            head_stack.append((lvl, i + 1))
            i += 1
            continue

        if _HR_RE.match(raw):
            i += 1
            continue

        if raw.startswith(">"):
            j = i
            while j < n and lines[j].startswith(">"):
                j += 1
            blocks.extend(_parse_quote_region(lines, i, j, snapshot_heads()))
            i = j
            continue

        if raw.startswith("|") and i + 1 < n and _DELIM_RE.match(lines[i + 1]):
            header = i + 1  # 1-based header row
            header_rows = [header, header + 1]
            k = i + 2
            while k < n and _ROWLIKE_RE.match(lines[k]) and k not in code0:
                k += 1
            heads = snapshot_heads()
            for row in range(i + 2, k):
                blocks.append(
                    BlockInfo(
                        "table_row", row + 1, row + 1, headings=heads, headers=header_rows
                    )
                )
            i = k
            continue

        m = _MARK_RE.match(raw)
        if m:
            items, stop = _list_island(lines, i)
            heads = snapshot_heads()
            for a, e in items:
                blocks.append(BlockInfo("list_item", a + 1, e, headings=heads))
            i = stop
            continue

        # plain paragraph: contiguous non-blank lines until a structural start
        p = i
        while p < n:
            if p in code0 or lines[p].strip() == "":
                break
            if (
                _heading_level(lines[p]) is not None
                or _HR_RE.match(lines[p])
                or lines[p].startswith(">")
                or _MARK_RE.match(lines[p])
                or (
                    lines[p].startswith("|")
                    and p + 1 < n
                    and _DELIM_RE.match(lines[p + 1])
                )
            ):
                break
            p += 1
        if p == i:  # defensive: unknown structural line, keep as paragraph
            p = i + 1
        blocks.append(BlockInfo("paragraph", i + 1, p, headings=snapshot_heads()))
        i = p

    return blocks, code1


def _mini_scan_inner(lines: list[str]) -> list[tuple[str, int, int]]:
    """Segments inside a blockquote into (kind, start, end_exclusive) items.

    Supports paragraphs, column-0 fenced code and top-level list items with
    nested content.  Corpus check (2026-09-09): no nested `>>`, no interior
    fences/tables inside quotes; inner content stays paragraphs or top-level
    lists.
    """
    n = len(lines)
    ranges = _code_ranges(lines)
    code0 = _code_set(ranges)
    open_to = {a: (a, b) for a, b in ranges}
    items: list[tuple[str, int, int]] = []
    i = 0
    while i < n:
        raw = lines[i]
        if raw.strip() == "":
            i += 1
            continue
        if i in open_to:
            a, b = open_to[i]
            items.append(("code", a, b + 1))
            i = b + 1
            continue
        if i in code0:
            i += 1
            continue
        if _HR_RE.match(raw) or _heading_level(raw) is not None:
            i += 1
            continue
        m = _MARK_RE.match(raw)
        if m:
            island, stop = _list_island(lines, i)
            for a, e in island:
                items.append(("list", a, e))
            i = stop
            continue
        p = i
        while p < n and lines[p].strip() != "" and p not in code0:
            if (
                _heading_level(lines[p]) is not None
                or _HR_RE.match(lines[p])
                or _MARK_RE.match(lines[p])
            ):
                break
            p += 1
        items.append(("para", i, p))
        i = p
    return items


def _parse_quote_region(
    lines: list[str], start: int, end: int, outer_heads: list[int]
) -> list[BlockInfo]:
    inner = [_strip_quote(lines[k]) for k in range(start, end)]
    out: list[BlockInfo] = []
    for kind, a, e in _mini_scan_inner(inner):
        out.append(
            BlockInfo(
                "quote_" + kind,
                start + a + 1,
                start + e,
                headings=list(outer_heads),
                quote=True,
            )
        )
    return out
