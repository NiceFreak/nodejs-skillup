"""W13 LangChain dense 接线：e5 `Embeddings` adapter、向量库装载与项目层排序。

设计点冻结记录见 [`notes/dense-langchain-wiring-freeze.md`](../../notes/dense-langchain-wiring-freeze.md)：

- D-A 自定义 `Embeddings` adapter 承担向量化，`InMemoryVectorStore` 承担向量存储与相似度检索；
  排序、并列顺序与 `RetrievalHit` 映射留在项目层；旧 `dense_retrieve` 路径保留作等价性参照。
- D-B `passage: ` / `query: ` 前缀位于 adapter 内部；`to_documents()` 原样复用，`page_content`
  与 `model_content` 保持逐字节同源。
- D-C 严格命中缓存：文本未命中即失败（错误含未命中数量与首个 sha256）；identity 不一致即失败，
  不静默重算、不覆盖 `.npy`，重算需本人显式声明。
- D-D 向量库存储键 = 冻结 `source_id`；重复 ID 直接失败，不静默覆盖。
- D-F F1–F8 的确定性断言在 `tests/test_retrieval_dense_langchain.py`；F9/F10/F12 在
  `scripts/verify-dense-langchain-equiv.py`。

为什么仍然由项目显式排序：`InMemoryVectorStore` 的检索走 `cosine_similarity` 后
`similarity.argsort()[::-1][:k]`，并列时返回的是插入顺序的反序，不满足 B3.1 / D3 的
「并列按 `registry_index` 升序」。因此框架只提供候选与分数，顺序由本模块决定。

边界：只读冻结 registry 与 `.cache/`；不读 holdout；不调用模型 API；不重算或覆盖既有向量缓存。
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import InMemoryVectorStore

from .retrieval import TOP_K, RetrievalHit, to_documents
from .retrieval_dense import (
    CACHE_DIR,
    PASSAGE_PREFIX,
    QUERY_PREFIX,
    EmbeddingIdentity,
    current_identity,
    embed_texts,
    load_session,
    load_tokenizer,
)

#: D1 已验证的输出维度（`scripts/verify-e5-onnx.py`：384）。
EMBEDDING_DIM = 384


class EmbeddingContractError(RuntimeError):
    """adapter 与冻结向量缓存之间的契约被破坏（D-C a1 / a2、D-D 唯一性）。"""


def text_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


_session: Any = None
_tokenizer: Any = None


def onnx_vectorize(texts: list[str]) -> list[list[float]]:
    """现算向量；只用于查询侧（D-C 的作用域仅限文档侧）。与 `retrieval_dense.embed_texts()` 同一管线。"""
    global _session, _tokenizer
    if _session is None or _tokenizer is None:
        _session = load_session()
        _tokenizer = load_tokenizer()
    return embed_texts(_session, _tokenizer, texts).tolist()


class E5Embeddings(Embeddings):
    """e5 的 LangChain `Embeddings` adapter。

    文档侧只从冻结缓存取向量：任一文本缺席即失败，避免出现第二份向量来源（D-C a1）。
    查询侧按 D2 现算，并在本类内加 `query: ` 前缀（D-B）。
    """

    def __init__(
        self,
        entries: Sequence[dict[str, Any]],
        matrix: np.ndarray,
        *,
        query_vectorizer: Callable[[list[str]], list[list[float]]] | None = None,
    ) -> None:
        if matrix.shape != (len(entries), EMBEDDING_DIM):
            raise EmbeddingContractError(
                f"向量矩阵形状 {matrix.shape} 与 registry {len(entries)} 个块、维度 {EMBEDDING_DIM} 不匹配"
            )
        self._documents = {
            PASSAGE_PREFIX + entry["model_content"]: row.tolist()
            for entry, row in zip(entries, matrix, strict=True)
        }
        self._query_vectorizer = query_vectorizer or onnx_vectorize

    @property
    def document_cache_keys(self) -> frozenset[str]:
        """当前 adapter 可命中的文档键集合（含 `passage: ` 前缀），供测试与诊断断言前缀归属。"""
        return frozenset(self._documents)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        keys = [PASSAGE_PREFIX + text for text in texts]
        missing = [key for key in keys if key not in self._documents]
        if missing:
            raise EmbeddingContractError(
                f"dense 向量缓存未命中 {len(missing)}/{len(keys)} 个文本；"
                f"首个未命中文本 sha256={text_sha256(missing[0])}；"
                f"adapter 绑定冻结语料（{len(self._documents)} 个可命中键）；"
                "新语料需先冻结新的缓存身份，未命中时不回退计算"
            )
        return [self._documents[key] for key in keys]

    def embed_query(self, text: str) -> list[float]:
        return self._query_vectorizer([QUERY_PREFIX + text])[0]


def load_cached_matrix(
    entries: Sequence[dict[str, Any]],
    cache_dir: Path = CACHE_DIR,
    *,
    identity_factory: Callable[[int], EmbeddingIdentity] = current_identity,
) -> np.ndarray:
    """严格读取冻结向量缓存（D-C a2）：identity 不一致即失败，不重算、不覆盖既有文件。"""
    passages = len(entries)
    vectors_path = Path(cache_dir) / f"e5-small-passages-{passages}.npy"
    identity_path = Path(cache_dir) / f"e5-small-passages-{passages}.identity.json"
    for path in (vectors_path, identity_path):
        if not path.exists():
            raise EmbeddingContractError(
                f"缺少冻结向量缓存 {path.name}；重算需本人显式声明，接线不在缺缓存时自动计算"
            )
    stored = json.loads(identity_path.read_text(encoding="utf-8"))
    expected = identity_factory(passages).as_dict()
    if stored != expected:
        diff = {
            key: (stored.get(key), expected.get(key))
            for key in sorted(set(stored) | set(expected))
            if stored.get(key) != expected.get(key)
        }
        raise EmbeddingContractError(f"向量缓存 identity 不一致，拒绝复用且不覆盖：{diff}")
    matrix = np.load(vectors_path)
    if matrix.shape != (passages, EMBEDDING_DIM):
        raise EmbeddingContractError(
            f"向量缓存形状 {matrix.shape} 与 registry {passages} 个块、维度 {EMBEDDING_DIM} 不匹配"
        )
    return matrix


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


def build_dense_store(
    entries: Sequence[dict[str, Any]],
    *,
    cache_dir: Path = CACHE_DIR,
    query_vectorizer: Callable[[list[str]], list[list[float]]] | None = None,
    identity_factory: Callable[[int], EmbeddingIdentity] = current_identity,
) -> InMemoryVectorStore:
    """装载 LangChain 向量库：文档来自 B1 映射，向量来自冻结缓存，存储键为冻结 `source_id`。"""
    ids = assert_unique_source_ids(entries)
    matrix = load_cached_matrix(entries, cache_dir, identity_factory=identity_factory)
    store = InMemoryVectorStore(
        embedding=E5Embeddings(entries, matrix, query_vectorizer=query_vectorizer)
    )
    store.add_documents(to_documents(entries), ids=ids)
    return store


def dense_retrieve_langchain(
    store: InMemoryVectorStore,
    entries: Sequence[dict[str, Any]],
    query: str,
    k: int = TOP_K,
) -> list[RetrievalHit]:
    """框架打分 + 项目显式排序（D-A 连带条款 1）。

    取回全部候选分数而不是只取 k 条：并列可能跨过 top-k 边界，若先让框架截断，
    项目侧重排无法修正成员集合。
    """
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
                source_id=source_id,
                registry_index=meta["registry_index"],
                source_path=meta["source_path"],
                line_start=meta["line_start"],
                line_end=meta["line_end"],
            )
        )
        if len(hits) == k:
            break
    return hits
