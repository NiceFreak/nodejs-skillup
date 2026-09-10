"""W13 hybrid RRF 融合自测（确定性；无网络、无模型调用）。

覆盖 H1 冻结参数与 RRF 的关键行为：单 ranker 召回的文档仍能进入融合结果、分数是倒数排名之和、
并列按 registry_index 升序、top_k 截断与空输入。
"""
from __future__ import annotations

from w13rag.retrieval import RetrievalHit
from w13rag.retrieval_hybrid import HYBRID_CANDIDATES, RRF_K, rrf_fuse


def _hit(source_id, rank, index, score=0.0, path="a.md", lo=1, hi=1) -> RetrievalHit:
    return RetrievalHit(
        rank=rank,
        score=score,
        source_id=source_id,
        registry_index=index,
        source_path=path,
        line_start=lo,
        line_end=hi,
    )


def test_frozen_parameters_match_h1():
    assert RRF_K == 60
    assert HYBRID_CANDIDATES == 50


def test_single_ranker_document_still_enters_fusion():
    """RRF 的边界：只被一个 ranker 召回的块仍能进入融合结果（但不是被「救回」未召回的块）。"""
    bm25 = [_hit("rules/a.md#L1-L1", 1, 0), _hit("rules/b.md#L1-L1", 2, 1)]
    dense = [_hit("rules/c.md#L1-L1", 1, 2)]
    fused = rrf_fuse(bm25, dense, top_k=5)
    assert {h.source_id for h in fused} == {"rules/a.md#L1-L1", "rules/b.md#L1-L1", "rules/c.md#L1-L1"}


def test_score_is_sum_of_reciprocal_ranks():
    bm25 = [_hit("rules/a.md#L1-L1", 1, 0)]
    dense = [_hit("rules/a.md#L1-L1", 2, 0)]
    fused = rrf_fuse(bm25, dense, top_k=1)
    assert fused[0].score == round(1 / 61 + 1 / 62, 8)


def test_shared_document_outranks_single_ranker_documents():
    bm25 = [_hit("rules/shared.md#L1-L1", 1, 0), _hit("rules/x.md#L2-L2", 2, 1)]
    dense = [_hit("rules/shared.md#L1-L1", 1, 0), _hit("rules/y.md#L2-L2", 2, 2)]
    fused = rrf_fuse(bm25, dense, top_k=3)
    assert fused[0].source_id == "rules/shared.md#L1-L1"


def test_tie_break_uses_registry_index():
    bm25 = [_hit("rules/b.md#L1-L1", 1, 5)]
    dense = [_hit("rules/a.md#L1-L1", 1, 3)]
    fused = rrf_fuse(bm25, dense, top_k=2)  # 两者 RRF 分数相同（同为 1/61）
    assert [h.source_id for h in fused] == ["rules/a.md#L1-L1", "rules/b.md#L1-L1"]


def test_top_k_truncates_and_ranks_are_sequential():
    bm25 = [_hit(f"rules/a.md#L{i}-L{i}", i, i) for i in range(1, 6)]
    dense = [_hit(f"rules/b.md#L{i}-L{i}", i, 10 + i) for i in range(1, 6)]
    fused = rrf_fuse(bm25, dense, top_k=4)
    assert len(fused) == 4
    assert [h.rank for h in fused] == [1, 2, 3, 4]
    assert len({h.source_id for h in fused}) == 4


def test_empty_inputs_return_empty():
    assert rrf_fuse([], [], top_k=5) == []
