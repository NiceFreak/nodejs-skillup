"""W13 BM25 retrieval 自测（确定性；无网络、无模型调用）。

覆盖 B1–B4 的冻结决定：Document 映射与 metadata、tokenization / normalization、ranking 与 tie-break、
去重、evidence recall 的命中与覆盖比例，以及与框架 `BM25Retriever` 结果集合的一致性。
"""
from __future__ import annotations

from w13rag.retrieval import (
    TOP_K,
    RetrievalHit,
    build_retriever,
    evaluate_item_retrieval,
    load_registry,
    requirement_recall,
    retrieve,
    to_documents,
    tokenize,
)


# --- B2 tokenization / normalization -----------------------------------------------------------


def test_tokenize_splits_latin_and_digits_on_non_alnum_boundaries():
    assert tokenize("bcrypt.hash/compare") == ["bcrypt", "hash", "compare"]
    assert tokenize("2026-09-10") == ["2026", "09", "10"]
    assert tokenize("L2、W13") == ["l2", "w13"]


def test_tokenize_lowercases_and_normalizes_fullwidth():
    assert tokenize("ＪＷＴ") == ["jwt"]
    assert tokenize("JWT") == ["jwt"]


def test_tokenize_chinese_uses_adjacent_bigrams():
    assert tokenize("证据不足") == ["证据", "据不", "不足"]


def test_tokenize_keeps_single_cjk_char_and_drops_punctuation_only():
    assert tokenize("（中）") == ["中"]
    assert tokenize("（）「」") == []


# --- B1 Document 映射 --------------------------------------------------------------------------


def _entry(source_id="rules/a.md#L1-L2", path="a.md", lo=1, hi=2, content="正文", sha="sha-0"):
    return {
        "source_id": source_id,
        "source_span": {"source_path": path, "line_start": lo, "line_end": hi},
        "model_content": content,
        "content_sha256": sha,
    }


def test_to_documents_maps_page_content_and_six_metadata_fields():
    entries = [
        _entry(content="第一块"),
        _entry(source_id="rules/a.md#L3-L3", lo=3, hi=3, content="第二块"),
    ]
    documents = to_documents(entries)
    assert [d.page_content for d in documents] == ["第一块", "第二块"]
    assert documents[0].metadata == {
        "source_id": "rules/a.md#L1-L2",
        "content_sha256": "sha-0",
        "source_path": "a.md",
        "line_start": 1,
        "line_end": 2,
        "registry_index": 0,
    }
    assert documents[1].metadata["registry_index"] == 1


def test_real_registry_mapping_is_byte_identical():
    entries = load_registry()
    documents = to_documents(entries)
    assert len(documents) == 572
    assert all(d.page_content == e["model_content"] for d, e in zip(documents, entries))
    assert all(d.metadata["content_sha256"] == e["content_sha256"] for d, e in zip(documents, entries))
    assert all(d.metadata["registry_index"] == i for i, d in enumerate(documents))


# --- B3 ranking / tie-break / dedup / top_k ----------------------------------------------------


def _fixture_documents():
    return to_documents(
        [
            _entry(
                source_id="rules/a.md#L1-L1",
                path="a.md",
                lo=1,
                hi=1,
                content="黑名单援助上限 L2；JWT 签发与验证流程属于黑名单项",
            ),
            _entry(
                source_id="rules/a.md#L2-L2",
                path="a.md",
                lo=2,
                hi=2,
                content="与本题无关的内容：学习展板视觉编码与图标边界",
            ),
            _entry(
                source_id="rules/b.md#L1-L1",
                path="b.md",
                lo=1,
                hi=1,
                content="JWT 签发与验证流程：援助上限 L2",
            ),
        ]
    )


def test_retrieve_ranks_relevant_document_first():
    hits = retrieve(build_retriever(_fixture_documents()), "JWT 签发与验证流程的最高援助级别是什么")
    assert hits[0].source_id in {"rules/a.md#L1-L1", "rules/b.md#L1-L1"}
    assert hits[0].score >= hits[-1].score
    assert hits[-1].source_id == "rules/a.md#L2-L2"


def test_retrieve_is_deterministic_and_tie_break_uses_registry_index():
    retriever = build_retriever(_fixture_documents())
    first = retrieve(retriever, "JWT")
    second = retrieve(retriever, "JWT")
    assert [h.source_id for h in first] == [h.source_id for h in second]
    by_rule = sorted(first, key=lambda h: (-h.score, h.registry_index))
    assert [h.source_id for h in by_rule] == [h.source_id for h in first]


def test_retrieve_respects_k_and_deduplicates():
    hits = retrieve(build_retriever(_fixture_documents()), "JWT", k=2)
    assert len(hits) == 2
    assert len({h.source_id for h in hits}) == 2
    assert [h.rank for h in hits] == [1, 2]


def test_default_top_k_matches_frozen_value():
    assert TOP_K == 10


def test_our_selection_matches_framework_top_k_set():
    retriever = build_retriever(_fixture_documents(), k=2)
    framework = {d.metadata["source_id"] for d in retriever.invoke("JWT 签发与验证流程")}
    ours = {h.source_id for h in retrieve(retriever, "JWT 签发与验证流程", k=2)}
    assert ours == framework


# --- B4 evidence recall ------------------------------------------------------------------------

REQUIREMENT = {"kind": "source_span", "span_id": "rules-c0a4b85/a.md#L10-L14"}


def _hit(source_id, path, lo, hi, rank=1, score=1.0, index=0):
    return RetrievalHit(
        rank=rank,
        score=score,
        source_id=source_id,
        registry_index=index,
        source_path=path,
        line_start=lo,
        line_end=hi,
    )


def test_requirement_hit_by_intersection_records_coverage():
    result = requirement_recall(REQUIREMENT, [_hit("rules/a.md#L12-L13", "a.md", 12, 13)])
    assert result["hit"] is True
    assert result["covered_lines"] == 2
    assert result["span_lines"] == 5
    assert result["coverage"] == 2 / 5


def test_requirement_hit_accepts_block_crossing_span_boundary():
    """B4.1 交集口径的关键行为：块跨出 span 边界仍算命中。"""
    result = requirement_recall(REQUIREMENT, [_hit("rules/a.md#L14-L15", "a.md", 14, 15)])
    assert result["hit"] is True
    assert result["covered_lines"] == 1
    assert result["coverage"] == 1 / 5


def test_requirement_miss_when_only_other_document_matches():
    assert requirement_recall(REQUIREMENT, [_hit("rules/b.md#L12-L13", "b.md", 12, 13)])["hit"] is False


def test_corpus_absence_requirement_is_not_applicable():
    result = requirement_recall({"kind": "corpus_absence", "scope": "entire_corpus"}, [])
    assert result["hit"] is None
    assert result["coverage"] is None


def test_item_passes_only_when_all_spans_hit():
    item = {
        "id": "w13-dev-fixture-01",
        "behavior_type": "cross_document",
        "evidence_requirements": [
            {"kind": "source_span", "span_id": "rules-c0a4b85/a.md#L10-L14"},
            {"kind": "source_span", "span_id": "rules-c0a4b85/b.md#L1-L2"},
        ],
    }
    only_a = [_hit("rules/a.md#L12-L13", "a.md", 12, 13)]
    assert evaluate_item_retrieval(item, only_a)["passed"] is False
    both = only_a + [_hit("rules/b.md#L1-L1", "b.md", 1, 1, rank=2)]
    assert evaluate_item_retrieval(item, both)["passed"] is True


def test_item_with_only_corpus_absence_is_not_applicable():
    item = {
        "id": "w13-dev-fixture-02",
        "behavior_type": "no_answer",
        "evidence_requirements": [{"kind": "corpus_absence", "scope": "entire_corpus"}],
    }
    result = evaluate_item_retrieval(item, [])
    assert result["passed"] is None
    assert result["requirements_checked"] == 0


def test_no_answer_item_span_requirement_is_advisory_only():
    """契约 §1：无答案题的 source_span 只记录相邻边界，不参与检索命中判定（不得因它判 failed）。"""
    item = {
        "id": "w13-dev-fixture-03",
        "behavior_type": "no_answer",
        "evidence_requirements": [
            {"kind": "source_span", "span_id": "rules-c0a4b85/a.md#L10-L14"},
            {"kind": "corpus_absence", "scope": "entire_corpus"},
        ],
    }
    result = evaluate_item_retrieval(item, [])
    assert result["passed"] is None
    assert result["requirements_checked"] == 0
    assert result["requirements"][0]["advisory"] is True
