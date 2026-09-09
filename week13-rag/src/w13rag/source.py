"""Freeze-snapshot document reading: bytes -> 1-based physical lines.

Contract anchors: D1 manifest (snapshot paths, UTF-8, no BOM), D3 §6.2.0 #2
(EOL unified to LF at serialization) and the term table in
day3-freeze-serialization-contract.md §10.5 (line = LF-terminated or file end).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

UTF8_BOM = b"\xef\xbb\xbf"


@dataclass(frozen=True)
class SourceDoc:
    corpus_id: str
    source_path: str
    snapshot_path: str
    #: 0-based internal array; public line numbers are 1-based
    #: (line k = lines[k-1]).
    lines: tuple[str, ...]
    #: per physical line: True when the original text has a trailing LF after it.
    has_lf: tuple[bool, ...]

    @property
    def line_count(self) -> int:
        return len(self.lines)

    def line_text(self, line_no: int) -> str:
        return self.lines[line_no - 1]


def read_doc(
    snapshot_root: Path,
    corpus_id: str,
    source_path: str,
    snapshot_path: str,
) -> SourceDoc:
    raw = (snapshot_root / snapshot_path).read_bytes()
    if raw.startswith(UTF8_BOM):
        raw = raw[len(UTF8_BOM):]
    text = raw.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    if text == "":
        return SourceDoc(corpus_id, source_path, snapshot_path, (), ())
    ends_lf = text.endswith("\n")
    parts = text.split("\n")
    if ends_lf:
        parts.pop()
    has_lf = [True] * len(parts)
    if not ends_lf and parts:
        has_lf[-1] = False
    return SourceDoc(
        corpus_id, source_path, snapshot_path, tuple(parts), tuple(has_lf)
    )
