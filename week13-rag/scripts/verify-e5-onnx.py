#!/usr/bin/env python3
"""verify-e5-onnx — dense 前置验证（不调用外部 API、不修改冻结对象）。

验证内容：
1. ONNX 运行时与 provider（D1 冻结值）；
2. 输出维度（应为 384）；
3. 全语料 572 块的最长 token 数（判断 512 截断是否会触发）；
4. 语义相似度功能验证：用 BM25 失败的案例比较「相关块 vs 无关块」的 cosine；
5. 前缀影响：同一文本 `query: ` / `passage: ` 与不加前缀的向量差异。

用法： .venv/bin/python scripts/verify-e5-onnx.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / ".cache/e5-small-onnx"
REGISTRY = ROOT / "evidence/serialization/registry-rules-c0a4b85.json"
MAX_LEN = 512  # D2 冻结值


def main() -> int:
    session = ort.InferenceSession(
        str(MODEL_DIR / "onnx" / "model.onnx"), providers=["CPUExecutionProvider"]
    )
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    print("[provider]", session.get_providers())
    print("[inputs ]", [i.name for i in session.get_inputs()])

    def embed(texts: list[str]) -> np.ndarray:
        batch = tokenizer(
            texts, padding=True, truncation=True, max_length=MAX_LEN, return_tensors="np"
        )
        # XLM-R tokenizer 不产出 token_type_ids，但导出的 ONNX 图要求该输入；按惯例补全 0。
        feed: dict[str, np.ndarray] = {}
        for spec in session.get_inputs():
            if spec.name in batch:
                feed[spec.name] = batch[spec.name]
            elif spec.name == "token_type_ids":
                feed[spec.name] = np.zeros_like(batch["input_ids"])
        hidden = session.run(None, feed)[0]
        mask = batch["attention_mask"][..., None]
        pooled = (hidden * mask).sum(1) / np.clip(mask.sum(1), 1e-9, None)
        return pooled / np.linalg.norm(pooled, axis=1, keepdims=True)

    # 2. 维度 + 5. 前缀影响
    probe = embed(["query: 测试", "测试"])
    print("[dim    ]", probe.shape)
    print("[prefix ] cosine(query-prefixed, unprefixed) =", float(probe[0] @ probe[1]))

    # 3. 最长块
    entries = json.loads(REGISTRY.read_text(encoding="utf-8"))
    lengths = [len(tokenizer("passage: " + e["model_content"])["input_ids"]) for e in entries]
    longest = int(np.argmax(lengths))
    print(f"[lengths] blocks={len(entries)} max={max(lengths)} at {entries[longest]['source_id']} "
          f"mean={sum(lengths)/len(lengths):.1f} over_512={sum(1 for x in lengths if x > MAX_LEN)}")

    # 4. 语义相似度：BM25 失败案例
    query = "query: 我不清楚 Express 接口中接收请求、处理业务规则和访问数据库的代码应该如何分工，AI 可以直接替我完成实现吗？"
    related = "passage: " + next(e["model_content"] for e in entries if e["source_id"] == "rules/AGENTS.md#L69-L69")
    unrelated = "passage: " + next(e["model_content"] for e in entries if e["source_id"] == "rules/SHOWCASE-DEPLOY-PROTOCOL.md#L28-L28")
    vectors = embed([query, related, unrelated])
    print("[similar] related  =", float(vectors[0] @ vectors[1]))
    print("[similar] unrelated=", float(vectors[0] @ vectors[2]))
    print("[similar] related > unrelated =", bool(vectors[0] @ vectors[1] > vectors[0] @ vectors[2]))

    # BM25 对同两个块的全量排名 vs dense 排名
    sys.path.insert(0, str(ROOT / "src"))
    from w13rag.retrieval import build_retriever, retrieve, to_documents

    documents = to_documents(entries)
    hits = retrieve(build_retriever(documents), query.replace("query: ", ""), k=len(documents))
    bm25_rank = {h.source_id: h.rank for h in hits}
    print("[bm25   ] rank(L69) =", bm25_rank.get("rules/AGENTS.md#L69-L69"),
          "| rank(L28) =", bm25_rank.get("rules/SHOWCASE-DEPLOY-PROTOCOL.md#L28-L28"))

    # dense 全量排名：直接验证 dense 是否解决该案例的排序盲区
    texts = ["passage: " + e["model_content"] for e in entries]
    chunks = [embed(texts[start : start + 32]) for start in range(0, len(texts), 32)]
    matrix = np.vstack(chunks)
    query_vector = embed([query])[0]
    scores = matrix @ query_vector
    order = np.argsort(-scores)
    dense_rank = {entries[i]["source_id"]: rank + 1 for rank, i in enumerate(order)}
    print("[dense  ] top5 =", [(entries[i]["source_id"], round(float(scores[i]), 4)) for i in order[:5]])
    print("[dense  ] rank(L69) =", dense_rank.get("rules/AGENTS.md#L69-L69"),
          "| rank(L68) =", dense_rank.get("rules/AGENTS.md#L68-L68"),
          "| rank(L28) =", dense_rank.get("rules/SHOWCASE-DEPLOY-PROTOCOL.md#L28-L28"))
    for sid in ("rules/SHOWCASE-DEPLOY-PROTOCOL.md#L28-L28", "rules/AGENTS.md#L69-L69"):
        text = next(e["model_content"] for e in entries if e["source_id"] == sid)
        print(f"[content] {sid.split('#')[1]} =", text.strip().replace("\n", " ")[:110])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
