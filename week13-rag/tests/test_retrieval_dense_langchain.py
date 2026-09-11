"""W13 LangChain dense 接线自测（F1–F8；默认无 ONNX、无网络、无模型调用）。

覆盖 [冻结记录](../notes/dense-langchain-wiring-freeze.md) 的 D-A…D-D：前缀归属、缓存严格命中、
identity 保护、存储键唯一性与并列顺序。F9/F10/F12 需要真实 e5 运行时，放在
`scripts/verify-dense-langchain-equiv.py`。
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from langchain_core.vectorstores import InMemoryVectorStore

from w13rag.retrieval import build_retrieval_context
from w13rag.retrieval_dense import (
    PASSAGE_PREFIX,
    QUERY_PREFIX,
    EmbeddingIdentity,
    dense_retrieve,
)
from w13rag.retrieval_dense_langchain import (
    EMBEDDING_DIM,
    E5Embeddings,
    EmbeddingContractError,
    assert_unique_source_ids,
    build_dense_store,
    dense_retrieve_langchain,
    load_cached_matrix,
    text_sha256,
)


def _entry(index: int, source_id: str, content: str, lo: int = 1, hi: int = 1) -> dict:
    return {
        "source_id": source_id,
        "source_span": {"source_path": "a.md", "line_start": lo, "line_end": hi},
        "model_content": content,
        "content_sha256": f"sha-{index}",
    }


def _matrix(*vectors: list[float]) -> np.ndarray:
    """把短向量补零到 D1 的 384 维；用于构造确定性 fixture。"""
    return np.array(
        [np.pad(vector, (0, EMBEDDING_DIM - len(vector))) for vector in vectors], dtype=np.float32
    )


def _identity(passages: int, *, model_sha256: str = "model-sha") -> EmbeddingIdentity:
    return EmbeddingIdentity(
        model_sha256=model_sha256,
        tokenizer_sha256="tokenizer-sha",
        max_len=512,
        pooling="mean-attention-mask",
        normalized=True,
        passages=passages,
        batch_size=32,
    )


def _write_cache(
    cache_dir: Path, matrix: np.ndarray, *, identity: EmbeddingIdentity | None = None
) -> None:
    passages = matrix.shape[0]
    np.save(cache_dir / f"e5-small-passages-{passages}.npy", matrix)
    stored = identity or _identity(passages)
    (cache_dir / f"e5-small-passages-{passages}.identity.json").write_text(
        json.dumps(stored.as_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _store(entries: list[dict], cache_dir: Path, **kwargs) -> InMemoryVectorStore:
    """用合成 identity 装载向量库：fixture 的身份由测试定义，不读取真实模型文件。"""
    return build_dense_store(entries, cache_dir=cache_dir, identity_factory=_identity, **kwargs)


# --- F1 前缀归属（D-B） ------------------------------------------------------------------------


def test_query_prefix_is_applied_inside_adapter():
    calls: list[list[str]] = []

    def recorder(texts: list[str]) -> list[list[float]]:
        calls.append(list(texts))
        return [[0.0] * EMBEDDING_DIM]

    entries = [_entry(0, "rules/a.md#L1-L1", "正文")]
    adapter = E5Embeddings(entries, _matrix([1.0]), query_vectorizer=recorder)
    adapter.embed_query("问题")
    assert calls == [[QUERY_PREFIX + "问题"]]


def test_document_cache_keys_carry_passage_prefix():
    entries = [_entry(0, "rules/a.md#L1-L1", "正文")]
    adapter = E5Embeddings(entries, _matrix([1.0]))
    assert adapter.document_cache_keys == frozenset({PASSAGE_PREFIX + "正文"})


# --- F2 缓存命中逐元素一致（D-C a1 的正向情形） ------------------------------------------------


def test_embed_documents_returns_cached_row_exactly():
    entries = [_entry(0, "rules/a.md#L1-L1", "第一块"), _entry(1, "rules/a.md#L2-L2", "第二块")]
    matrix = _matrix([1.0, 0.0], [0.0, 1.0])
    adapter = E5Embeddings(entries, matrix)
    assert adapter.embed_documents([entries[1]["model_content"]]) == [matrix[1].tolist()]


# --- F3 未命中即失败（D-C a1） -----------------------------------------------------------------


def test_unknown_text_fails_with_count_and_sha256():
    entries = [_entry(0, "rules/a.md#L1-L1", "正文")]
    adapter = E5Embeddings(entries, _matrix([1.0]))
    with pytest.raises(EmbeddingContractError) as excinfo:
        adapter.embed_documents(["语料外的文本"])
    message = str(excinfo.value)
    assert "未命中 1/1" in message
    assert text_sha256(PASSAGE_PREFIX + "语料外的文本") in message


# --- F4 identity 不一致即失败且不覆盖（D-C a2） -------------------------------------------------


def test_missing_cache_fails(tmp_path: Path):
    entries = [_entry(0, "rules/a.md#L1-L1", "正文")]
    with pytest.raises(EmbeddingContractError) as excinfo:
        load_cached_matrix(entries, tmp_path)
    assert "缺少冻结向量缓存" in str(excinfo.value)


def test_identity_mismatch_fails_without_overwriting(tmp_path: Path):
    entries = [_entry(0, "rules/a.md#L1-L1", "正文")]
    _write_cache(tmp_path, _matrix([1.0]))
    vectors_path = tmp_path / "e5-small-passages-1.npy"
    before = vectors_path.read_bytes()
    wrong = _identity(1, model_sha256="other-model-sha")
    with pytest.raises(EmbeddingContractError) as excinfo:
        load_cached_matrix(entries, tmp_path, identity_factory=lambda _: wrong)
    message = str(excinfo.value)
    assert "identity 不一致" in message
    assert "other-model-sha" in message
    assert vectors_path.read_bytes() == before


# --- F5/F6 存储键（D-D） -----------------------------------------------------------------------


def test_duplicate_source_id_rejected():
    entries = [
        _entry(0, "rules/a.md#L1-L1", "第一块"),
        _entry(1, "rules/a.md#L1-L1", "第二块"),
    ]
    with pytest.raises(EmbeddingContractError) as excinfo:
        assert_unique_source_ids(entries)
    assert "重复 source_id" in str(excinfo.value)


def test_store_keys_are_frozen_source_ids(tmp_path: Path):
    entries = [_entry(0, "rules/a.md#L1-L1", "第一块"), _entry(1, "rules/a.md#L2-L2", "第二块")]
    _write_cache(tmp_path, _matrix([1.0, 0.0], [0.0, 1.0]))
    store = _store(entries, tmp_path)
    assert sorted(store.store.keys()) == ["rules/a.md#L1-L1", "rules/a.md#L2-L2"]
    documents = store.get_by_ids(["rules/a.md#L1-L1"])
    assert len(documents) == 1
    assert documents[0].page_content == "第一块"
    assert documents[0].metadata["registry_index"] == 0


# --- F7 并列顺序由项目决定（D-A 连带条款 1） ---------------------------------------------------


def test_ties_follow_registry_index_not_framework_order(tmp_path: Path):
    """三个同分块按 registry_index 逆序插入：框架返回插入反序，项目重排后必须是升序。"""
    base = [
        _entry(0, "rules/a.md#L1-L1", "块零"),
        _entry(1, "rules/a.md#L2-L2", "块一"),
        _entry(2, "rules/a.md#L3-L3", "块二"),
    ]
    entries = [base[2], base[1], base[0]]
    _write_cache(tmp_path, _matrix([1.0], [1.0], [1.0]))
    store = _store(
        entries,
        tmp_path,
        query_vectorizer=lambda _texts: [[1.0] + [0.0] * (EMBEDDING_DIM - 1)],
    )
    hits = dense_retrieve_langchain(store, entries, "任意问题", k=3)
    assert [hit.registry_index for hit in hits] == [0, 1, 2]
    assert [hit.source_id for hit in hits] == [entry["source_id"] for entry in entries]


# --- F8 两条路径的检索顺序与 Evidence Context 一致（合成 fixture） -----------------------------


def test_langchain_path_matches_numpy_path_on_synthetic_fixture(tmp_path: Path):
    entries = [
        _entry(0, "rules/a.md#L1-L1", "与查询同向"),
        _entry(1, "rules/a.md#L2-L2", "正交向量一"),
        _entry(2, "rules/a.md#L3-L3", "正交向量二"),
    ]
    matrix = _matrix([1.0, 0.0], [0.0, 1.0], [0.0, 0.0])
    _write_cache(tmp_path, matrix)
    query_vector = np.pad([1.0], (0, EMBEDDING_DIM - 1)).astype(np.float32)
    store = _store(
        entries, tmp_path, query_vectorizer=lambda _texts: [query_vector.tolist()]
    )
    numpy_hits = dense_retrieve(query_vector, matrix, entries, k=3)
    langchain_hits = dense_retrieve_langchain(store, entries, "任意问题", k=3)
    assert [hit.source_id for hit in numpy_hits] == [hit.source_id for hit in langchain_hits]
    assert build_retrieval_context(langchain_hits, entries) == build_retrieval_context(
        numpy_hits, entries
    )
