"""Citation registry build + Evidence Context assembly.

Registry entry shape follows D2 §6.1 / D3 §6.2.0:
- one core `source_span` whose path/line range equals `source_id`;
- zero-to-many `context_spans` with role in {heading, table_header},
  in source order;
- `model_content` and `content_sha256` stored per entry.

Blocks are ordered by manifest document order, then by core line_start /
line_end.  Duplicate `source_id` must fail the build.
"""
from __future__ import annotations

from .parser import BlockInfo
from .serialize import (
    assemble_evidence_context,
    build_model_content,
    content_sha256,
    serialize_source_block,
)
from .source import SourceDoc

WRAPPER_FORBIDDEN = ("<source", "</source>")


def entry_from_block(
    doc: SourceDoc, block: BlockInfo, code_lines: set[int]
) -> dict:
    source_id = (
        f"{doc.corpus_id}/{doc.source_path}#L{block.core_start}-L{block.core_end}"
    )
    model = build_model_content(
        doc,
        headings=block.headings,
        headers=block.headers,
        core_start=block.core_start,
        core_end=block.core_end,
        code_lines=code_lines,
        quote=block.quote,
    )
    context_spans: list[dict] = []
    for h in block.headings:
        context_spans.append(
            {
                "source_path": doc.source_path,
                "line_start": h,
                "line_end": h,
                "role": "heading",
            }
        )
    if block.headers:
        context_spans.append(
            {
                "source_path": doc.source_path,
                "line_start": min(block.headers),
                "line_end": max(block.headers),
                "role": "table_header",
            }
        )
    return {
        "source_id": source_id,
        "source_span": {
            "source_path": doc.source_path,
            "line_start": block.core_start,
            "line_end": block.core_end,
        },
        "context_spans": context_spans,
        "model_content": model,
        "content_sha256": content_sha256(model),
    }


def build_entries(
    docs_blocks: list[tuple[SourceDoc, list[BlockInfo], set[int]]],
) -> list[dict]:
    """Build entries for documents already in manifest order.

    Raises ValueError on duplicate source_id or wrapper-precondition
    violations (block body containing literal <source / </source>).
    """
    entries: list[dict] = []
    seen: set[str] = set()
    for doc, blocks, code_lines in docs_blocks:
        # enforce deterministic intra-document order even though the parser
        # already emits source order
        ordered = sorted(
            blocks, key=lambda b: (b.core_start, b.core_end)
        )
        for block in ordered:
            entry = entry_from_block(doc, block, code_lines)
            if entry["source_id"] in seen:
                raise ValueError(f"duplicate source_id: {entry['source_id']}")
            for token in WRAPPER_FORBIDDEN:
                if token in entry["model_content"]:
                    raise ValueError(
                        f"wrapper precondition violated in {entry['source_id']}: "
                        f"block body contains {token!r}"
                    )
            seen.add(entry["source_id"])
            entries.append(entry)
    return entries


def evidence_context_string(entries: list[dict]) -> str:
    """Assemble the ordered Evidence Context from serialized blocks."""
    serialized = [serialize_source_block(e["source_id"], e["model_content"]) for e in entries]
    return assemble_evidence_context(serialized)
