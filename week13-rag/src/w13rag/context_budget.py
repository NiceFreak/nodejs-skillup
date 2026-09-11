"""Deterministic budget-aware Evidence Context assembly for technical-v2.

The legacy ``build_retrieval_context`` path remains unchanged.  This module is
the explicit v2 path used by the diagnostic fixture: token budget is preferred,
character budget is a fallback, and every retained/removed block is recorded.
"""
from __future__ import annotations

import hashlib
from typing import Any, Callable, Sequence

from .retrieval import RetrievalHit, tokenize
from .serialize import assemble_evidence_context, serialize_source_block


def _entry_chunk_index(entry: dict[str, Any]) -> int:
    value = entry.get("chunk_index", entry.get("registry_index", 0))
    return int(value)


def assemble_with_budget(
    hits: Sequence[RetrievalHit],
    entries: Sequence[dict[str, Any]],
    *,
    token_budget: int | None = None,
    char_budget: int | None = None,
    token_counter: Callable[[str], int] = lambda text: len(tokenize(text)),
) -> tuple[str, dict[str, Any]]:
    """Assemble context and a complete retained/removed budget audit.

    ``token_budget`` takes precedence over ``char_budget``.  Blocks are ordered
    by relevance score descending, then ``source_id`` and stable chunk index.
    A block is either retained in full or removed; no silent text truncation is
    performed.
    """
    if token_budget is not None and token_budget < 0:
        raise ValueError("token_budget must be non-negative")
    if char_budget is not None and char_budget < 0:
        raise ValueError("char_budget must be non-negative")
    if token_budget is not None and char_budget is not None:
        raise ValueError("provide token_budget or char_budget, not both")

    by_id = {entry["source_id"]: entry for entry in entries}
    ordered = sorted(
        hits,
        key=lambda hit: (
            -float(hit.score),
            hit.source_id,
            _entry_chunk_index(by_id[hit.source_id]),
        ),
    )
    retained: list[str] = []
    retained_rows: list[dict[str, Any]] = []
    removed_rows: list[dict[str, Any]] = []
    used = 0
    unit = "tokens" if token_budget is not None else "chars" if char_budget is not None else "unbounded"
    limit = token_budget if token_budget is not None else char_budget

    for hit in ordered:
        entry = by_id[hit.source_id]
        block = serialize_source_block(hit.source_id, entry["model_content"])
        try:
            token_count = int(token_counter(block))
            char_count = len(block)
            measure = token_count if token_budget is not None else char_count
        except Exception:
            # A broken tokenizer must not silently discard the block.  Use the
            # explicitly documented character fallback and record the unit.
            unit = "chars_fallback"
            token_count = None
            char_count = len(block)
            measure = char_count
            if limit is None:
                limit = None
        row = {
            "block_id": hit.source_id,
            "source_id": hit.source_id,
            "chunk_index": _entry_chunk_index(entry),
            "rank": hit.rank,
            "score": hit.score,
            "token_count": token_count,
            "char_count": char_count,
        }
        if limit is not None and used + measure > limit:
            removed_rows.append({**row, "reason": "removed_budget"})
            continue
        retained.append(block)
        used += measure
        retained_rows.append({**row, "reason": "kept"})

    context = assemble_evidence_context(retained)
    audit = {
        "budget": {"unit": unit, "limit": limit, "used": used},
        "retained_blocks": retained_rows,
        "removed_blocks": removed_rows,
        "context_sha256": hashlib.sha256(context.encode("utf-8")).hexdigest(),
        "silent_truncation": False,
    }
    return context, audit
