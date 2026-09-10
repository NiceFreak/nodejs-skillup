"""W13 BM25 retrieval：Document 映射、tokenization、检索与 evidence recall（B1–B4 冻结后的实现方交付）。

设计点冻结记录见 [`notes/bm25-design-freeze.md`](../../notes/bm25-design-freeze.md)；本模块实现其中的决定：

- B1.1 `page_content` = registry 的 `model_content`（与 D3 冻结的模型可见正文逐字节同源）。
- B1.2 `metadata` = `source_id` / `content_sha256` / `source_path` / `line_start` / `line_end` / `registry_index`。
- B2.1 tokenization：中文连续字符切相邻 bigram；拉丁字母与数字按非字母数字边界切词。
- B2.2 normalization：NFKC（含全角转半角）+ 小写；所有非字母数字字符作词边界。
- B3.1 `top_k = 10`；分数并列按 `registry_index` 升序。
- B3.2 顺序按分数降序；按 `source_id` 去重；超预算按分数从低到高裁剪（本模块只报告，不裁剪冻结上下文）。
- B4.1 命中 = retrieved 块与 requirement span 有交集；同时记录覆盖行数与比例。

为什么自己排序而不是直接用 `BM25Retriever.get_top_n`：`rank_bm25` 不保证并列顺序稳定，而 B3.1 要求
「并列按 registry_index 升序」的可复现规则。因此仍用 `BM25Retriever` 装载 `docs` 与 `vectorizer`（保持框架接线），
排序与取分由本模块显式完成。

边界：只读冻结 registry 与 `eval/dev/`；不读 holdout；不调用模型；不修改任何冻结对象。
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "evidence/serialization/registry-rules-c0a4b85.json"

#: B3.1 冻结值
TOP_K = 10

_CJK_RANGES = r"\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff"
_TOKEN_RE = re.compile(rf"[a-z0-9]+|[{_CJK_RANGES}]+")


def tokenize(text: str) -> list[str]:
    """B2.1 + B2.2：NFKC 与小写化后，拉丁字母/数字成词，中文连续段切相邻 bigram。

    该函数同时作用于 query 与 `page_content`（否则分数不可比）；它只影响 token 序列，不改动文本字节。
    """
    normalized = unicodedata.normalize("NFKC", text).lower()
    tokens: list[str] = []
    for chunk in _TOKEN_RE.findall(normalized):
        if chunk[0].isascii():
            tokens.append(chunk)
        elif len(chunk) == 1:
            tokens.append(chunk)
        else:
            tokens.extend(chunk[i : i + 2] for i in range(len(chunk) - 1))
    return tokens


def load_registry(path: Path = REGISTRY_PATH) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def to_documents(entries: list[dict[str, Any]]) -> list[Document]:
    """B1：registry entry -> LangChain `Document`；metadata 只复用冻结字段，不新增语义。"""
    documents: list[Document] = []
    for index, entry in enumerate(entries):
        span = entry["source_span"]
        documents.append(
            Document(
                page_content=entry["model_content"],
                metadata={
                    "source_id": entry["source_id"],
                    "content_sha256": entry["content_sha256"],
                    "source_path": span["source_path"],
                    "line_start": span["line_start"],
                    "line_end": span["line_end"],
                    "registry_index": index,
                },
            )
        )
    return documents


@dataclass
class RetrievalHit:
    """一条检索结果：块身份 + 分数 + 排名（B3.1 的 rank 从 1 开始）。"""

    rank: int
    score: float
    source_id: str
    registry_index: int
    source_path: str
    line_start: int
    line_end: int

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_retriever(documents: list[Document], k: int = TOP_K) -> BM25Retriever:
    """装载 LangChain `BM25Retriever`（保持框架接线）；排序与取分由 `retrieve()` 显式完成。"""
    return BM25Retriever.from_documents(documents, preprocess_func=tokenize, k=k)


def retrieve(retriever: BM25Retriever, query: str, k: int = TOP_K) -> list[RetrievalHit]:
    """B3.1 + B3.2：按分数降序取 top-k；并列按 `registry_index` 升序；按 `source_id` 去重。"""
    documents = retriever.docs
    scores = retriever.vectorizer.get_scores(tokenize(query))
    order = sorted(
        range(len(documents)),
        key=lambda i: (-float(scores[i]), documents[i].metadata["registry_index"]),
    )
    seen: set[str] = set()
    hits: list[RetrievalHit] = []
    for index in order:
        meta = documents[index].metadata
        source_id = meta["source_id"]
        if source_id in seen:  # B3.2 去重（防御性：BM25Retriever 的 docs 本身唯一）
            continue
        seen.add(source_id)
        hits.append(
            RetrievalHit(
                rank=len(hits) + 1,
                score=float(scores[index]),
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


def _span_of(span_id: str) -> tuple[str, int, int] | None:
    """`rules/<path>#L<a>-L<b>` 或 `rules-c0a4b85/<path>#L<a>-L<b>` -> (path, a, b)。"""
    match = re.match(r"rules(?:-c0a4b85)?/(.+)#L(\d+)-L(\d+)$", span_id)
    if match is None:
        return None
    return match.group(1), int(match.group(2)), int(match.group(3))


def requirement_recall(requirement: dict[str, Any], hits: list[RetrievalHit]) -> dict[str, Any]:
    """B4.1：交集口径判定命中，并给出覆盖行数与覆盖比例（诊断）。

    `corpus_absence` 类 requirement 不参与检索命中判定（它的依据是「整个语料不含答案」），`hit` 记为 `None`。
    """
    if requirement.get("kind") != "source_span":
        return {
            "span_id": None,
            "kind": requirement["kind"],
            "hit": None,
            "covered_lines": None,
            "span_lines": None,
            "coverage": None,
            "matched_source_ids": [],
        }
    span = _span_of(requirement["span_id"])
    if span is None:
        raise ValueError(f"unparsable requirement span: {requirement['span_id']}")
    path, low, high = span
    matched = [
        hit for hit in hits if hit.source_path == path and not (hit.line_end < low or hit.line_start > high)
    ]
    covered = sum(
        max(0, min(hit.line_end, high) - max(hit.line_start, low) + 1) for hit in matched
    )
    span_lines = high - low + 1
    return {
        "span_id": requirement["span_id"],
        "kind": "source_span",
        "hit": bool(matched),
        "covered_lines": covered,
        "span_lines": span_lines,
        "coverage": covered / span_lines,
        "matched_source_ids": [hit.source_id for hit in matched],
    }


def evaluate_item_retrieval(item: dict[str, Any], hits: list[RetrievalHit]) -> dict[str, Any]:
    """B4.1：item 通过 = 该题**所有**参与判定的 `source_span` requirement 都命中。

    含 `corpus_absence` 的题（no_answer）在 retrieval-only 层整体记为不适用：契约 §1 明确「无答案题中列出的
    `source_span` 只用于记录语料已覆盖的相邻边界」，因此它们只作 **advisory** 记录，不参与命中判定。
    """
    has_absence = any(
        requirement.get("kind") == "corpus_absence" for requirement in item["evidence_requirements"]
    )
    recalls = []
    for requirement in item["evidence_requirements"]:
        recall = requirement_recall(requirement, hits)
        if has_absence and recall["kind"] == "source_span":
            recall["advisory"] = True
        recalls.append(recall)
    checked = [
        recall for recall in recalls if recall["kind"] == "source_span" and not recall.get("advisory")
    ]
    return {
        "item_id": item["id"],
        "behavior_type": item["behavior_type"],
        "requirements": recalls,
        "requirements_checked": len(checked),
        "passed": all(recall["hit"] for recall in checked) if checked else None,
    }
