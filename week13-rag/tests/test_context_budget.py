from w13rag.context_budget import assemble_with_budget
from w13rag.retrieval import RetrievalHit


def _data():
    entries = [
        {"source_id": "b", "model_content": "正文 B", "chunk_index": 2},
        {"source_id": "a", "model_content": "正文 A", "chunk_index": 1},
    ]
    hits = [
        RetrievalHit(rank=2, score=0.5, source_id="b", registry_index=1, source_path="x", line_start=1, line_end=1),
        RetrievalHit(rank=1, score=0.5, source_id="a", registry_index=0, source_path="x", line_start=1, line_end=1),
    ]
    return hits, entries


def test_budget_keeps_whole_blocks_and_records_removal():
    hits, entries = _data()
    context, audit = assemble_with_budget(hits, entries, char_budget=45)
    assert audit["silent_truncation"] is False
    assert audit["retained_blocks"]
    assert audit["removed_blocks"]
    assert "<source id=\"a\">" in context
    assert all(row["reason"] == "removed_budget" for row in audit["removed_blocks"])


def test_equal_scores_have_stable_source_id_order():
    hits, entries = _data()
    _, audit = assemble_with_budget(hits, entries, char_budget=4500)
    assert [row["source_id"] for row in audit["retained_blocks"]] == ["a", "b"]


def test_token_budget_takes_precedence_and_both_budgets_are_rejected():
    hits, entries = _data()
    _, audit = assemble_with_budget(hits, entries, token_budget=10000, token_counter=lambda _: 1)
    assert audit["budget"]["unit"] == "tokens"
    try:
        assemble_with_budget(hits, entries, token_budget=1, char_budget=1)
    except ValueError as exc:
        assert "not both" in str(exc)
    else:
        raise AssertionError("expected ValueError")
