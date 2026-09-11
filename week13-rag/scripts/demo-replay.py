#!/usr/bin/env python3
"""D5 展示胶水：只读已记录 dev 证据；可离线重算现有 BM25，不调用模型。

从仓库根运行 python3 week13-rag/scripts/demo-replay.py summary。
verify 使用 W13 venv。无任意文件输入、query 输入或外部 API 入口。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BM25 = ROOT / "evidence/bm25-e2e/dev-bm25-e2e-top10-01.json"
FULL = ROOT / "evidence/baseline/dev-full-context-prompt-v1-json-output-01.json"
REGISTRY = ROOT / "evidence/serialization/registry-rules-c0a4b85.json"
DEV = ROOT / "eval/dev/items.json"


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def show_summary() -> None:
    full, bm25 = read(FULL), read(BM25)
    print("D4 已记录 dev 运行汇总；没有发起本次模型调用。")
    for name, data in (("full-context v1 + JSON", full), ("BM25 top-10", bm25)):
        counts = [item["record"]["usage"]["prompt_tokens"] for item in data["items"]]
        summary = data["summary"]
        print(f"{name}: {summary['mechanical']['passed']}/{summary['items']} 机械通过；"
              f"prompt_tokens={min(counts):,}–{max(counts):,}，合计={sum(counts):,}；"
              f"split_status={summary['split_status']}")
        print("  机械失败：" + ", ".join(summary["mechanical"]["failed_items"]))
    full_tokens = sum(item["record"]["usage"]["prompt_tokens"] for item in full["items"])
    bm25_tokens = sum(item["record"]["usage"]["prompt_tokens"] for item in bm25["items"])
    sizes = [item["context"]["chars"] for item in bm25["items"]]
    print(f"BM25 context 字符数={min(sizes):,}–{max(sizes):,}；"
          f"输入 token 总量减少={(1 - bm25_tokens / full_tokens):.2%}（非账单/质量提升）。")
    print("full-context 人工诊断结果见 D4 笔记 §6.14（R1 于运行后澄清）；原始 JSON 保留待判状态。")
    print("BM25 与 dense 端到端的人工语义判定已在 D5 完成且均未通过（各 3/10）；citation_precision 机械字段仅检查可解析性。")
    print("检索对照：适用题分母为 8；两条 no_answer 不进入检索门禁。")
    for backend in ("bm25", "dense", "hybrid"):
        cells = []
        for k in (10, 20, 30):
            run = "02" if backend == "bm25" and k == 10 else "01"
            data = read(ROOT / f"evidence/retrieval/dev-{backend}-top{k}-{run}.json")
            gate = data["summary"]["split_gate"]
            cells.append(f"k={k}: {gate['passed_count']}/{gate['applicable_count']}")
        print(f"  {backend}: " + " | ".join(cells))


def show_case(case_id: str, section: str) -> None:
    data = read(BM25)
    item = next(item for item in data["items"] if item["itemId"] == case_id)
    registry = {entry["source_id"]: entry for entry in read(REGISTRY)}
    record = item["record"]
    print(f"D4 已记录生成结果回放 | {case_id}")
    print(f"corpus={data['corpus']['snapshotId']} | prompt={data['prompt']['version']} | "
          f"requested={record['requested_model']} | served={record['served_model']}")
    print("query: " + item["query"])
    if section in ("all", "retrieval"):
        print(f"检索={len(item['hits'])} 块；context={item['context']['chars']} 字符；"
              f"sha256={item['context']['sha256']}")
        for hit in item["hits"][:3]:
            print(f"  rank {hit['rank']} | score {hit['score']:.4f} | {hit['source_id']}")
        print("这里只显示前三条；全部 top-10 均进入记录中的 context。")
    if section in ("all", "answer"):
        print(json.dumps(record["parsed"], ensure_ascii=False, indent=2))
        print(f"status={record['status']} | expected_branch={item['expectedBranch']} | "
              f"verdict={json.dumps(item['evaluation']['verdict'], ensure_ascii=False)}")
        print("机械通过不是人工语义验收；本脚本不填写人工判定。")
    if section in ("all", "source"):
        claims = (record.get("parsed") or {}).get("claims", [])
        citations = [citation for claim in claims for citation in claim.get("citations", [])]
        if not citations:
            print("本条为 abstained，无 claims/citations；不伪造来源。")
            return
        citation = citations[0]
        entry = registry[citation]
        if citation not in {hit["source_id"] for hit in item["hits"]}:
            raise ValueError("演示 citation 未进入该次检索 context")
        print("首条 citation 回源：" + citation)
        print("模型可见 block（包含标题语境）：\n" + entry["model_content"])
        span = entry["source_span"]
        documents = ROOT / "corpus/rules-c0a4b85/documents"
        # source_path 来自已冻结 registry，读取前仍限定在该快照的 documents 目录。
        source = (documents / span["source_path"]).resolve()
        if not source.is_relative_to(documents.resolve()):
            raise ValueError("来源不在冻结 documents 目录")
        lines = source.read_text(encoding="utf-8").splitlines()
        print("冻结原文核心行（1-based inclusive）：")
        for number in range(span["line_start"], span["line_end"] + 1):
            print(f"L{number}: {lines[number - 1]}")


def validate_replay_items(data: dict, dev: dict) -> None:
    expected = {item["id"]: item["query"] for item in dev["items"]}
    recorded = {item["itemId"]: item["query"] for item in data["items"]}
    if len(dev["items"]) != 10 or len(expected) != 10 or len(data["items"]) != 10 or recorded != expected:
        raise ValueError("重算必须包含冻结 dev 的完整十条唯一问题，且 query 与记录一致")
    if data["corpus"]["snapshotId"] != dev["corpus_snapshot_id"] or data["retrieval"]["topK"] != 10:
        raise ValueError("重算记录必须绑定同一冻结语料与 BM25 top-10")


def verify_replay(json_output: bool = False) -> bool:
    sys.path.insert(0, str(ROOT / "src"))
    from w13rag.retrieval import build_retrieval_context, build_retriever, retrieve, to_documents

    data = read(BM25)
    validate_replay_items(data, read(DEV))
    entries = read(REGISTRY)
    retriever = build_retriever(to_documents(entries), k=data["retrieval"]["topK"])
    checks = []
    for item in data["items"]:
        hits = retrieve(retriever, item["query"], k=data["retrieval"]["topK"])
        context = build_retrieval_context(hits, entries)
        checks.append({
            "itemId": item["itemId"],
            "hitOrder": [hit.source_id for hit in hits] == [hit["source_id"] for hit in item["hits"]],
            "contextHash": hashlib.sha256(context.encode()).hexdigest() == item["context"]["sha256"],
            "contextChars": len(context) == item["context"]["chars"],
        })
    matched = sum(all(row[key] for key in ("hitOrder", "contextHash", "contextChars")) for row in checks)
    result = {"ok": matched == len(checks), "matched": matched, "total": len(checks),
              "checks": checks, "modelCalled": False}
    if json_output:
        print(json.dumps(result, ensure_ascii=False))
    else:
        status = "PASS" if result["ok"] else "FAIL"
        print(f"{status}: 当前 BM25 检索顺序与 context 重算 {matched}/{len(checks)} 一致；未调用模型。")
        for row in checks:
            failed = [key for key in ("hitOrder", "contextHash", "contextChars") if not row[key]]
            if failed:
                print(f"  {row['itemId']}: 不一致项 {', '.join(failed)}")
    return result["ok"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("summary", "case", "verify"))
    parser.add_argument("--case", dest="case_id", default="w13-dev-direct-answer-02",
                        choices=[item["itemId"] for item in read(BM25)["items"]])
    parser.add_argument("--section", choices=("all", "retrieval", "answer", "source"), default="all")
    parser.add_argument("--json", action="store_true", help="verify 的结构化结果，供本地演练界面显示")
    args = parser.parse_args()
    if args.json and args.action != "verify":
        parser.error("--json 仅用于 verify")
    if args.action == "summary":
        show_summary()
    elif args.action == "case":
        show_case(args.case_id, args.section)
    else:
        if not verify_replay(args.json):
            raise SystemExit(1)


if __name__ == "__main__":
    main()
