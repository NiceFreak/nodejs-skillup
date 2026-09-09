"""Real-corpus build test over the frozen rules snapshot.

Asserts the deterministic invariants that the parser/registry layer must
guarantee on the real corpus before the full-context baseline is started.
"""
from __future__ import annotations

from pathlib import Path

from w13rag.cli import _two_pass, build_once
from w13rag.registry import evidence_context_string
from w13rag.serialize import content_sha256

SNAPSHOT = Path(__file__).resolve().parents[1] / "corpus" / "rules-c0a4b85"


def test_real_corpus_build_has_no_uncovered_or_duplicated_lines():
    _, entries, _, audits = build_once(SNAPSHOT)
    assert entries, "registry must be non-empty"
    assert len({e["source_id"] for e in entries}) == len(entries)
    for path, audit in audits.items():
        assert audit["uncovered_candidate_lines"] == [], path
        assert audit["duplicated_core_lines"] == [], path


def test_real_corpus_two_pass_is_byte_identical():
    e1, ctx1, e2, ctx2, _ = _two_pass(SNAPSHOT)
    assert ctx1 == ctx2
    assert [x["content_sha256"] for x in e1] == [x["content_sha256"] for x in e2]
    assert content_sha256(ctx1) == content_sha256(ctx2)


def test_every_entry_hash_recomputes_and_source_span_matches_source_id():
    _, entries, _, _ = build_once(SNAPSHOT)
    for e in entries:
        assert content_sha256(e["model_content"]) == e["content_sha256"]
        assert e["source_id"].endswith(
            f"#L{e['source_span']['line_start']}-L{e['source_span']['line_end']}"
        )
        # wrapper precondition: forbidden tokens absent from every model_content
        assert "<source" not in e["model_content"]
        assert "</source>" not in e["model_content"]


def test_evidence_context_has_no_leading_trailing_blank_lines():
    _, entries, ctx, _ = build_once(SNAPSHOT)
    assert ctx == evidence_context_string(entries)
    assert ctx == ctx.rstrip("\n") == ctx.lstrip("\n") or ctx == ""
