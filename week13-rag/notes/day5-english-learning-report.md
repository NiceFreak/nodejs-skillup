Subject: Daily AI Engineering Learning Summary - 2026-09-11 - Dense Retrieval onto LangChain and End-to-End Semantic Judgment

Evidence captured as of 2026-09-11 17:28 Asia/Shanghai

Summary

Today I wired dense retrieval onto LangChain's Embeddings and VectorStore interfaces, proved it equivalent to the existing dense path, ran a dense end-to-end pass, and completed the BM25 and dense human semantic judgments. Both end-to-end runs remain link evidence only; the W13 quality gates remain unmet.

Learning Outcomes and Evidence

- Dense LangChain wiring. A custom Embeddings adapter plus InMemoryVectorStore loads frozen vectors and runs nearest-neighbor search; 81 tests pass (10 new). The new path matches the old dense_retrieve on all ten dev queries in top-10 order and set, with max score difference 7.31e-08.

- Dense end-to-end. Ten real calls produced 9 ok and 1 schema_error, 7/10 mechanically; context 1,195-1,654 characters; prompt_tokens 11,756.

- Human semantic judgment. BM25 and dense each pass 3/10 under the R1 rubric; sections 6.4 and 6.5 fail, so neither passes. A prescreen script reproduced the D4 out-of-range citation failure class.

- Demo materials. The script, QA appendix, code guide, and showcase pages were updated to reflect dense wiring and the 3/10 judgments; rehearsal and mastery remain mine.

Technical Understanding

LangChain's Embeddings and VectorStore only do text-to-vector and nearest-neighbor search. Chunking, source identity, ranking and tie-break, context assembly, and pass criteria stay in the project contract, because InMemoryVectorStore returns insertion order on tied scores. I corrected the F10 criterion: pairs whose scores differ by less than 1e-6 count as a tie.

Issues, Decisions, and Remaining Boundaries

The single schema_error versus BM25's ten ok cannot be attributed without a rerun. The 3/10 judgments fail on citations pointing at related but different lines, which is not a single-factor experiment, so no root cause is isolated. status=ok, mechanical passes, and runnable links do not prove quality.

Next Step

On the weekend I rehearse the demo first, then build a minimal fixed LangChain chain (M1/M2). Holdout semantic judgment and the debt reconstruction remain mine.

Code Evidence

The first snippet, from `src/w13rag/retrieval_dense_langchain.py` (function `assert_unique_source_ids`), shows the store key binding to the frozen `source_id` and the duplicate guard, since `add_documents` would silently overwrite. The second, from the same file (function `dense_retrieve_langchain`), shows the framework scoring candidates while the project re-ranks them with the `registry_index` tie-break.

`week13-rag/src/w13rag/retrieval_dense_langchain.py#L147-L160`:
```python
def assert_unique_source_ids(entries: Sequence[dict[str, Any]]) -> list[str]:
    """D-D：存储键用冻结 `source_id`；重复 ID 会让 `add_documents` 静默覆盖，因此在装载前挡住。"""
    ids = [entry["source_id"] for entry in entries]
    seen: set[str] = set()
    duplicates: list[str] = []
    for source_id in ids:
        if source_id in seen:
            duplicates.append(source_id)
        seen.add(source_id)
    if duplicates:
        raise EmbeddingContractError(
            f"registry 存在重复 source_id（会静默覆盖向量库键）：{sorted(set(duplicates))[:5]}"
        )
    return ids
```

`week13-rag/src/w13rag/retrieval_dense_langchain.py#L191-L206`:
```python
    pairs = store.similarity_search_with_score(query, k=len(entries))
    ordered = sorted(
        ((float(score), document.metadata) for document, score in pairs),
        key=lambda item: (-item[0], item[1]["registry_index"]),
    )
    seen: set[str] = set()
    hits: list[RetrievalHit] = []
    for score, meta in ordered:
        source_id = meta["source_id"]
        if source_id in seen:  # 与 B3.2 同口径的去重（防御性）
            continue
        seen.add(source_id)
        hits.append(
            RetrievalHit(
                rank=len(hits) + 1,
                score=score,
```

Both snippets were checked against commit `647ffdf` with local `git show`; `647ffdf` is an ancestor of local `origin/main`. Link reachability was not externally verified per the report protocol.

The first snippet is at <https://github.com/NiceFreak/nodejs-skillup/blob/647ffdf/week13-rag/src/w13rag/retrieval_dense_langchain.py#L147-L160>. The second is at <https://github.com/NiceFreak/nodejs-skillup/blob/647ffdf/week13-rag/src/w13rag/retrieval_dense_langchain.py#L191-L206>.

Technical Capability Matrix

Criterion: Explain the responsibility boundaries of ingestion, retrieval, context, generation, and evaluation
Target or Threshold: No quantitative threshold frozen
Observed Evidence: Dense retrieval now runs through LangChain Embeddings and VectorStore for text-to-vector and nearest-neighbor search, while chunking, source identity, ranking, context assembly, and pass criteria stay in the project contract; 81 tests pass and the new path matches the old on all ten dev queries
Status: Partially Met
Gap or Next Verification: Generation still bypasses ChatModel/LCEL; LangGraph, checkpoints, and agentic retrieval remain unbuilt

Criterion: Attribute a failing question across retrieval, context assembly, prompt, or generation
Target or Threshold: No quantitative threshold frozen
Observed Evidence: BM25 and dense each pass 3/10 human judgment under R1; failures are citations pointing at related but different lines, reproduced mechanically by the prescreen script
Status: Partially Met
Gap or Next Verification: The failure mode is not a single-factor experiment, so no root cause is isolated; holdout semantic judgment remains

Criterion: Deterministically rebuild the retrieval data flow
Target or Threshold: No quantitative threshold frozen
Observed Evidence: The LangChain dense path reproduces the existing dense_retrieve top-10 order and set exactly, with max score difference 7.31e-08 across ten dev queries
Status: Partially Met
Gap or Next Verification: Cross-run stability is unverified; context-assembly over-budget truncation (B3) is still unimplemented

