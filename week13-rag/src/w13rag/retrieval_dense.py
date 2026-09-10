"""W13 dense retrieval：e5-small ONNX 推理、向量缓存与相似度检索（D1–D4 冻结后的实现方交付）。

设计点冻结记录见 [`notes/dense-design-freeze.md`](../../notes/dense-design-freeze.md)；本模块实现其中的决定：

- D1 `intfloat/multilingual-e5-small` + `onnxruntime 1.23.2`，fp32 ONNX，`CPUExecutionProvider`。
- D2 前缀 `query: ` / `passage: `；最大长度 512（超长截断并记录）；mean pooling（attention_mask 加权）；L2 归一化。
- D3 相似度 = 归一化内积（等价 cosine）；`top_k = 10`，另跑 20 / 30 曲线。
- D4 复用 B4.1 判定体系（直接 import `retrieval.evaluate_item_retrieval`），不另立门禁。

缓存：`build_corpus_embeddings()` 把 572 个向量落盘，缓存身份包含模型/tokenizer/长度/池化/归一化/块数；
身份不一致即重算。

边界：只读冻结 registry 与 `.cache/`；不读 holdout；不调用外部 API；不修改冻结对象。
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

from .retrieval import RetrievalHit  # noqa: F401  (评测层复用 retrieval.py，保证判定体系唯一)

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / ".cache/e5-small-onnx"
MODEL_FILE = MODEL_DIR / "onnx" / "model.onnx"
TOKENIZER_FILE = MODEL_DIR / "tokenizer.json"
CACHE_DIR = ROOT / ".cache/embeddings"

MAX_LEN = 512  # D2
BATCH_SIZE = 32
POOLING = "mean-attention-mask"
NORMALIZED = True
QUERY_PREFIX = "query: "
PASSAGE_PREFIX = "passage: "
PROVIDERS = ["CPUExecutionProvider"]  # D1


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass
class EmbeddingIdentity:
    """缓存身份：任一项变化都视为缓存失效（D4）。"""

    model_sha256: str
    tokenizer_sha256: str
    max_len: int
    pooling: str
    normalized: bool
    passages: int
    batch_size: int

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def current_identity(passages: int) -> EmbeddingIdentity:
    return EmbeddingIdentity(
        model_sha256=file_sha256(MODEL_FILE),
        tokenizer_sha256=file_sha256(TOKENIZER_FILE),
        max_len=MAX_LEN,
        pooling=POOLING,
        normalized=NORMALIZED,
        passages=passages,
        batch_size=BATCH_SIZE,
    )


def load_session() -> ort.InferenceSession:
    return ort.InferenceSession(str(MODEL_FILE), providers=PROVIDERS)


def load_tokenizer() -> Any:
    return AutoTokenizer.from_pretrained(str(MODEL_DIR))


def embed_texts(session: ort.InferenceSession, tokenizer: Any, texts: list[str]) -> np.ndarray:
    """D2：批内 padding + 截断 512 + mean pooling（attention_mask 加权）+ L2 归一化。"""
    batches: list[np.ndarray] = []
    for start in range(0, len(texts), BATCH_SIZE):
        batch = tokenizer(
            texts[start : start + BATCH_SIZE],
            padding=True,
            truncation=True,
            max_length=MAX_LEN,
            return_tensors="np",
        )
        feed: dict[str, np.ndarray] = {}
        for spec in session.get_inputs():
            if spec.name in batch:
                feed[spec.name] = batch[spec.name]
            elif spec.name == "token_type_ids":  # XLM-R tokenizer 不产出，按惯例补 0
                feed[spec.name] = np.zeros_like(batch["input_ids"])
        hidden = session.run(None, feed)[0]
        mask = batch["attention_mask"][..., None]
        pooled = (hidden * mask).sum(1) / np.clip(mask.sum(1), 1e-9, None)
        batches.append(pooled / np.linalg.norm(pooled, axis=1, keepdims=True))
    if not batches:
        return np.zeros((0, 384), dtype=np.float32)
    return np.vstack(batches).astype(np.float32)


def peak_rss_mb() -> float:
    """进程峰值 RSS（macOS 的 ru_maxrss 单位为字节）。"""
    import resource

    usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return round(usage / (1024 * 1024), 1) if usage > 10**6 else round(usage / 1024, 1)


def build_corpus_embeddings(
    entries: list[dict[str, Any]],
    cache_dir: Path = CACHE_DIR,
    *,
    force: bool = False,
    session: Any = None,
    tokenizer: Any = None,
) -> tuple[np.ndarray, EmbeddingIdentity, dict[str, Any]]:
    """计算或读取 572 个 passage 向量（D4 缓存身份校验）；返回 (matrix, identity, stats)。"""
    cache_dir.mkdir(parents=True, exist_ok=True)
    passages = len(entries)
    identity = current_identity(passages)
    vectors_path = cache_dir / f"e5-small-passages-{passages}.npy"
    identity_path = cache_dir / f"e5-small-passages-{passages}.identity.json"

    if not force and vectors_path.exists() and identity_path.exists():
        stored = json.loads(identity_path.read_text(encoding="utf-8"))
        if stored == identity.as_dict():
            return np.load(vectors_path), identity, {"cache": "hit"}

    session = session or load_session()
    tokenizer = tokenizer or load_tokenizer()
    texts = [PASSAGE_PREFIX + entry["model_content"] for entry in entries]
    started = time.perf_counter()
    matrix = embed_texts(session, tokenizer, texts)
    elapsed = time.perf_counter() - started
    np.save(vectors_path, matrix)
    identity_path.write_text(
        json.dumps(identity.as_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return matrix, identity, {
        "cache": "miss",
        "seconds": round(elapsed, 3),
        "throughput_per_s": round(passages / elapsed, 1),
        "peak_rss_mb": peak_rss_mb(),
    }


def dense_retrieve(
    query_vector: np.ndarray,
    matrix: np.ndarray,
    entries: list[dict[str, Any]],
    k: int = 10,
) -> list[RetrievalHit]:
    """D3：归一化内积排序；并列按 `registry_index` 升序（与 BM25 的 tie-break 规则一致）。"""
    scores = matrix @ query_vector
    order = sorted(range(len(entries)), key=lambda i: (-float(scores[i]), i))
    hits: list[RetrievalHit] = []
    for index in order[:k]:
        entry = entries[index]
        span = entry["source_span"]
        hits.append(
            RetrievalHit(
                rank=len(hits) + 1,
                score=float(scores[index]),
                source_id=entry["source_id"],
                registry_index=index,
                source_path=span["source_path"],
                line_start=span["line_start"],
                line_end=span["line_end"],
            )
        )
    return hits


def embed_queries(queries: list[str], *, session: Any = None, tokenizer: Any = None) -> np.ndarray:
    """D2：query 走 `query: ` 前缀（与 passage 前缀不同，是 e5 的用法约定）。"""
    session = session or load_session()
    tokenizer = tokenizer or load_tokenizer()
    return embed_texts(session, tokenizer, [QUERY_PREFIX + query for query in queries])
