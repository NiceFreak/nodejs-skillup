"""W13 hybrid retrieval：BM25 与 dense 的 RRF 融合（计划外扩展项；H1 冻结后实现）。

H1（2026-09-10 由本人冻结）：RRF 平滑常数 `k = 60`（Cormack 等 2009 的常用值）；每个 ranker 各取
**top-50** 候选，融合后取 `top_k`。

机制：`RRF(d) = Σ over rankers 1 / (k + rank_i(d))`。只累加实际包含该块的 ranker 贡献；只用排名、不用原始
分数，因此无需直接比较 BM25 score 与 cosine 的尺度。cosine 的一般范围是 [-1, 1]。

边界：
- RRF 对两个候选列表的并集聚合排名，不判断相关性；**两个 ranker 都未召回的块无法被融合加入**。
- 融合分数是 RRF 分数（既不是 BM25 分数也不是 cosine）；并列时按 `registry_index` 升序，与其它 backend 一致。
- 本模块不改动 B1–B4 与 D1–D4 的任何冻结值；它只是把两者的候选合并。

退出条件（本扩展项的定位）：若融合仍不能通过 B4.1 门禁，则如实记录为「扩展项未达标」，不继续叠加新方法。
"""

from __future__ import annotations

from .retrieval import RetrievalHit

RRF_K = 60  # H1
HYBRID_CANDIDATES = 50  # H1：每个 ranker 的候选池


def rrf_fuse(
    bm25_hits: list[RetrievalHit],
    dense_hits: list[RetrievalHit],
    *,
    top_k: int,
    k: int = RRF_K,
) -> list[RetrievalHit]:
    """按 RRF 融合两个排名列表，返回前 `top_k` 条（分数为 RRF 分数）。"""
    fused: dict[str, float] = {}
    meta: dict[str, RetrievalHit] = {}
    for hits in (bm25_hits, dense_hits):
        for hit in hits:
            fused[hit.source_id] = fused.get(hit.source_id, 0.0) + 1.0 / (k + hit.rank)
            meta.setdefault(hit.source_id, hit)

    order = sorted(fused.items(), key=lambda item: (-item[1], meta[item[0]].registry_index))
    results: list[RetrievalHit] = []
    for rank, (source_id, score) in enumerate(order[:top_k], 1):
        base = meta[source_id]
        results.append(
            RetrievalHit(
                rank=rank,
                score=round(score, 8),
                source_id=source_id,
                registry_index=base.registry_index,
                source_path=base.source_path,
                line_start=base.line_start,
                line_end=base.line_end,
            )
        )
    return results
