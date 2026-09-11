#!/usr/bin/env python3
"""verify-dense-langchain-equiv — F9 / F10 / F12：LangChain dense 接线与 `dense_retrieve` 的等价性验证。

用法（从 week13-rag 运行）：

    .venv/bin/python scripts/verify-dense-langchain-equiv.py

做什么：

- F9 对 10 条 dev 查询各跑两条路径（LangChain 接线与既有 `dense_retrieve`），核对 top-10 的**顺序**与
  **集合**是否一致，并记录分数最大绝对差作为观察值。
- F10 对同一批查询做 572 个块的**全排序**检查：分数差超过 `RESOLVABLE_EPS` 的相邻对顺序必须一致；
  分数差在该阈值以内的相邻对视为两条路径无法分辨的并列，允许顺序不同，但脚本记录位置与差值。
- F12 结束前核对冻结对象（向量缓存、identity、registry、manifest、既有 retrieval evidence）hash 未变。

不做什么：不调用模型 API、不读 holdout、不写任何文件。查询侧按 D2 现算（本地 ONNX），文档侧只读缓存。
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from w13rag.generation import load_dev_items  # noqa: E402
from w13rag.retrieval import TOP_K, load_registry  # noqa: E402
from w13rag.retrieval_dense import (  # noqa: E402
    dense_retrieve,
    embed_queries,
    load_session,
    load_tokenizer,
)
from w13rag.retrieval_dense_langchain import (  # noqa: E402
    build_dense_store,
    dense_retrieve_langchain,
    load_cached_matrix,
)

CACHE_DIR = ROOT / ".cache/embeddings"
EVIDENCE_DIR = ROOT / "evidence/retrieval"

#: F10 的分辨阈值（2026-09-11 冻结）：相邻对分数差不超过该值时视为并列，允许两条路径顺序不同。
#: 依据：已实测两处翻转都发生在 NumPy 路径 f32 精确并列（差 0.0）、LangChain 路径 f64 差 1.5e-08 的位置；
#: 把框架分数按 float32 量化也无法复现 NumPy 路径的并列（见冻结记录 §5 待验证项的实际结果）。
RESOLVABLE_EPS = 1e-6


def _full_order_check(
    numpy_hits: list, langchain_hits: list
) -> tuple[bool, list[dict], list[dict]]:
    """按 F10 冻结判据比较全排序，返回 (是否通过, 顺序差异记录, 越界差异)。"""
    numpy_ids = [hit.source_id for hit in numpy_hits]
    langchain_ids = [hit.source_id for hit in langchain_hits]
    numpy_scores = {hit.source_id: hit.score for hit in numpy_hits}
    langchain_scores = {hit.source_id: hit.score for hit in langchain_hits}
    positions = [
        index for index, (left, right) in enumerate(zip(numpy_ids, langchain_ids)) if left != right
    ]
    if not positions:
        return True, [], []

    numpy_rank = {source_id: rank for rank, source_id in enumerate(numpy_ids)}
    langchain_rank = {source_id: rank for rank, source_id in enumerate(langchain_ids)}
    involved = sorted({numpy_ids[index] for index in positions} | {langchain_ids[index] for index in positions})
    violations: list[dict] = []
    for index, left in enumerate(involved):
        for right in involved[index + 1 :]:
            if (numpy_rank[left] < numpy_rank[right]) == (langchain_rank[left] < langchain_rank[right]):
                continue
            gap_numpy = abs(numpy_scores[left] - numpy_scores[right])
            gap_langchain = abs(langchain_scores[left] - langchain_scores[right])
            if max(gap_numpy, gap_langchain) > RESOLVABLE_EPS:
                violations.append(
                    {
                        "left": left,
                        "right": right,
                        "numpy_gap": gap_numpy,
                        "langchain_gap": gap_langchain,
                    }
                )
    records = [
        {
            "position": index,
            "numpy": numpy_ids[index],
            "langchain": langchain_ids[index],
            "numpy_rank_of_langchain_item": numpy_rank[langchain_ids[index]],
            "score_gap": abs(numpy_scores[numpy_ids[index]] - numpy_scores[langchain_ids[index]]),
        }
        for index in positions[:3]
    ]
    return not violations, records, violations


def _targets() -> list[Path]:
    frozen = [
        CACHE_DIR / "e5-small-passages-572.npy",
        CACHE_DIR / "e5-small-passages-572.identity.json",
        ROOT / "evidence/serialization/registry-rules-c0a4b85.json",
        ROOT / "corpus/rules-c0a4b85/manifest.json",
    ]
    return frozen + sorted(EVIDENCE_DIR.glob("*.json"))


def _snapshot(paths: list[Path]) -> dict[str, str]:
    return {
        str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in paths
        if path.exists()
    }


def main() -> int:
    entries = load_registry()
    targets = _targets()
    before = _snapshot(targets)

    matrix = load_cached_matrix(entries)  # D-C a2：严格命中，不重算
    store = build_dense_store(entries)  # 文档侧只读缓存，不触发 ONNX
    session, tokenizer = load_session(), load_tokenizer()  # 查询侧现算
    items = load_dev_items()

    print(f"[run] entries={len(entries)} dev_items={len(items)} top_k={TOP_K} store_keys={len(store.store)}")
    print("[purpose] LangChain 接线等价性验证；不产生新的生成结果，也不改检索门禁结论")

    failures: list[str] = []
    near_tie_items = 0
    max_diff_all = 0.0
    for index, item in enumerate(items, 1):
        query = item["query"]
        query_vector = embed_queries([query], session=session, tokenizer=tokenizer)[0]
        numpy_hits = dense_retrieve(query_vector, matrix, entries, k=TOP_K)
        langchain_hits = dense_retrieve_langchain(store, entries, query, k=TOP_K)
        numpy_ids = [hit.source_id for hit in numpy_hits]
        langchain_ids = [hit.source_id for hit in langchain_hits]
        order_ok = numpy_ids == langchain_ids
        set_ok = set(numpy_ids) == set(langchain_ids)
        max_diff = max(
            (abs(left.score - right.score) for left, right in zip(numpy_hits, langchain_hits)),
            default=0.0,
        )
        max_diff_all = max(max_diff_all, max_diff)

        full_numpy = dense_retrieve(query_vector, matrix, entries, k=len(entries))
        full_langchain = dense_retrieve_langchain(store, entries, query, k=len(entries))
        full_ok, full_records, full_violations = _full_order_check(full_numpy, full_langchain)
        if full_records:
            near_tie_items += 1
        if not (order_ok and set_ok and full_ok):
            failures.append(item["id"])
        status = "PASS" if full_ok and not full_records else ("ALLOWED_NEAR_TIE" if full_ok else "FAIL")
        print(
            f"[{index}/{len(items)}] {item['id']:44s} order={order_ok} set={set_ok} "
            f"full_order={status} near_tie_positions={len(full_records)} "
            f"max_score_diff={max_diff:.2e}",
            flush=True,
        )
        for record in full_records:
            print(
                f"      near-tie@{record['position']}: numpy={record['numpy']} <-> "
                f"langchain={record['langchain']} "
                f"(numpy_rank_of_langchain_item={record['numpy_rank_of_langchain_item']}, "
                f"score_gap={record['score_gap']:.2e})"
            )
        if full_violations:
            print(f"      [F10 violation] {full_violations}")

    after = _snapshot(targets)
    unchanged = before == after
    changed = sorted(name for name in before if before.get(name) != after.get(name))
    print(f"[F12] frozen artifacts unchanged={unchanged} (files={len(before)})")
    if not unchanged:
        print(f"[F12] changed: {changed}")

    print(
        f"[summary] queries={len(items)} failures={len(failures)} "
        f"near_tie_queries={near_tie_items} max_score_diff={max_diff_all:.2e}"
    )
    if failures:
        print(f"[FAIL] 越出 F9/F10 判据的 item：{failures}")
        return 1
    if not unchanged:
        print("[FAIL] 冻结对象内容发生变化")
        return 1
    print(
        "[PASS] 10 条 dev 的 top-10 顺序与集合一致；全排序差异仅出现在分数差不超过 "
        f"{RESOLVABLE_EPS:g} 的并列位置（{near_tie_items} 条查询）；冻结对象未被改写。"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
