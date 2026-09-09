"""Deterministic serialization per D3 §6.2.0 single spec.

model_content / hash / source wrapper / Evidence Context assembly are pure
functions of a SourceDoc plus ordered 1-based line numbers; the parser only
supplies those line numbers.

Line numbers are 1-based, inclusive on both ends (source_span semantics).
"""
from __future__ import annotations

import hashlib
from typing import Iterable, Sequence

from .source import SourceDoc


def normalize_plain_line(raw: str) -> str:
    """D3 §6.2.0 #2 ordinary-line normalization.

    - trailing whitespace removed on ordinary lines;
    - a trailing run of >=2 spaces (CommonMark hard break) is kept and
      normalized to exactly two spaces;
    - a run containing a tab, or exactly one space, is removed entirely;
    - leading indentation is preserved (never stripped here).
    """
    body = raw.rstrip(" \t")
    if body == "":
        return ""
    trail = raw[len(body):]
    if len(trail) < 2 or "\t" in trail:
        return body
    return body + "  "


def build_model_content(
    doc: SourceDoc,
    *,
    headings: Sequence[int] = (),
    headers: Sequence[int] = (),
    core_start: int,
    core_end: int,
    code_lines: Iterable[int] = (),
    quote: bool = False,
) -> str:
    """Assemble the model-visible text of one block.

    Order per D3 §6.2.0 #1: headings outer->inner, then table header rows,
    then the core source_span lines.  Each physical line is emitted verbatim
    or ordinary-normalized; consecutive plain empty lines collapse to one;
    fenced-code and blockquote lines stay verbatim.  Each line keeps its own
    trailing LF; a source-final line without LF keeps that property.
    """
    code = set(code_lines)
    seq: list[tuple[int, bool]] = [(ln, False) for ln in headings]
    seq.extend((ln, False) for ln in headers)
    for ln in range(core_start, core_end + 1):
        seq.append((ln, bool(quote) or ln in code))

    parts: list[str] = []
    prev_empty = False
    for ln, verbatim in seq:
        raw = doc.line_text(ln)
        txt = raw if verbatim else normalize_plain_line(raw)
        if (not verbatim) and txt == "":
            if prev_empty:
                continue
            prev_empty = True
        else:
            prev_empty = False
        parts.append(txt)
        if doc.has_lf[ln - 1]:
            parts.append("\n")
    return "".join(parts)


def content_sha256(model_content: str) -> str:
    """D3 §6.2.0 #4: SHA-256 over the UTF-8 bytes of model_content."""
    return hashlib.sha256(model_content.encode("utf-8")).hexdigest()


def serialize_source_block(source_id: str, model_content: str) -> str:
    """D3 §6.2.0 #3 exact wrapper bytes.

    '<source id="...">' + LF + model_content + '</source>' on its own line.
    No trailing LF after '</source>'; Evidence Context joins blocks with a
    single blank line.
    """
    body = model_content
    if not body.endswith("\n"):
        body += "\n"
    return f'<source id="{source_id}">\n' + body + "</source>"


def assemble_evidence_context(serialized_blocks: Sequence[str]) -> str:
    """D3 §6.2.0 #5: ordered blocks joined by exactly one blank line.

    No leading/trailing blank lines; empty input yields an empty string.
    """
    return "\n\n".join(serialized_blocks)
