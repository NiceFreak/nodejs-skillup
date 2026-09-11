#!/usr/bin/env python3
"""Record deterministic observations for technical-v2 diagnostic fixtures.

This command exercises implementation contracts with synthetic objects and a
technical registry.  It does not call a model, read holdout, or assign the
candidate semantic conclusions as benchmark verdicts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from w13rag.generation import (  # noqa: E402
    STATUS_JSON_ERROR,
    STATUS_OK,
    STATUS_SCHEMA_ERROR,
    check_response,
    load_response_schema,
)
from w13rag.retrieval import (  # noqa: E402
    RetrievalHit,
    build_retrieval_context,
    load_registry,
    to_documents,
)
from w13rag.retrieval_dense_langchain import assert_unique_source_ids  # noqa: E402
from w13rag.context_budget import assemble_with_budget  # noqa: E402
from w13rag.scoring import is_retryable  # noqa: E402


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--registry", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    entries = load_registry(args.registry)
    if not entries:
        raise SystemExit("technical registry is empty")

    # document-identity-01: Document content and metadata remain separate.
    sample = entries[:2]
    docs = to_documents(sample)
    identity_ok = all(
        doc.page_content == entry["model_content"]
        and doc.metadata["source_id"] == entry["source_id"]
        and doc.metadata["content_sha256"] == entry["content_sha256"]
        for doc, entry in zip(docs, sample, strict=True)
    )

    # document-identity-02: duplicate content does not imply duplicate identity.
    duplicate = [dict(sample[0]), dict(sample[0])]
    duplicate[1]["source_id"] = sample[0]["source_id"] + "-duplicate"
    duplicate_docs = to_documents(duplicate)
    distinct_ids_ok = duplicate_docs[0].page_content == duplicate_docs[1].page_content and len(
        {doc.metadata["source_id"] for doc in duplicate_docs}
    ) == 2
    duplicate_guard = False
    try:
        assert_unique_source_ids([sample[0], sample[0]])
    except RuntimeError:
        duplicate_guard = True

    # context-membership-01: context is rebuilt from the selected hit IDs.
    hits = [
        RetrievalHit(
            rank=index + 1,
            score=1.0 - index / 10,
            source_id=entry["source_id"],
            registry_index=index,
            source_path=entry["source_span"]["source_path"],
            line_start=entry["source_span"]["line_start"],
            line_end=entry["source_span"]["line_end"],
        )
        for index, entry in enumerate(sample)
    ]
    context = build_retrieval_context(hits, sample)
    context_membership_ok = all(f'<source id="{hit.source_id}">' in context for hit in hits)

    # retrieval-diagnostics-01: keep retrieval facts separate from answer facts.
    retrieval_diagnostics = {
        "query": "synthetic diagnostic query",
        "rank": [hit.rank for hit in hits],
        "score": [hit.score for hit in hits],
        "source_ids": [hit.source_id for hit in hits],
        "context_members": [hit.source_id for hit in hits if f'<source id="{hit.source_id}">' in context],
        "evidence_recall": {"required_source_ids": [hits[0].source_id], "matched": [hits[0].source_id]},
    }

    # context-budget-01: exercise token-first clipping and retain its audit.
    budget_context, budget_audit = assemble_with_budget(hits, sample, token_budget=1)
    budget_observation = {
        "inputChars": len(context),
        "budgetContextChars": len(budget_context),
        "clippingImplemented": True,
        "status": "observed",
        **budget_audit,
    }

    # failure-routing-01: parser/schema errors are mechanically distinct.
    schema = load_response_schema()
    _, _, schema_detail = check_response('{"branch":"answered"}', schema)
    malformed_status, _, _ = check_response('{"branch":', schema)
    schema_violation_status, _, _ = check_response('{"branch":"answered"}', schema)
    valid = {"branch": "abstained", "reason_code": "insufficient_corpus_evidence", "reason_text": "insufficient evidence"}
    valid_status, _, _ = check_response(json.dumps(valid), schema)
    failure_routing = {
        "schema_status": schema_violation_status,
        "malformed_json_status": malformed_status,
        "schema_detail": schema_detail,
        "evidence_status": "corpus_absence",
        "branch": "abstained",
        "valid_abstention_status": valid_status,
        "transport_error_retryable": is_retryable("transport_error"),
        "http_503_retryable": is_retryable("http_error", 503),
        "http_400_retryable": is_retryable("http_error", 400),
        "expected_statuses": {
            "malformed_json": STATUS_JSON_ERROR,
            "schema_violation": STATUS_SCHEMA_ERROR,
            "valid_abstention": STATUS_OK,
        },
    }

    # corpus-absence-01: a bounded negative probe over the technical registry.
    absence_probe = "Qdrant / 自动重建索引"
    probe_terms = ["qdrant", "自动重建索引"]
    matched_ids = [
        entry["source_id"]
        for entry in entries
        if any(term in entry["model_content"].lower() for term in probe_terms)
    ]

    result = {
        "schemaVersion": 1,
        "fixtureVersion": "technical-v2-fixtures-01",
        "status": "observation_only",
        "registrySha256": hashlib.sha256(args.registry.read_bytes()).hexdigest(),
        "fixtures": {
            "document-identity-01": {
                "observables": ["page_content", "metadata.source_id", "metadata.content_sha256"],
                "observed": {"mappingConsistent": identity_ok},
            },
            "document-identity-02": {
                "observables": ["duplicate.page_content", "distinct.metadata.source_id", "citation.lookup"],
                "observed": {"duplicateContentDistinctIds": distinct_ids_ok, "duplicateIdGuard": duplicate_guard},
            },
            "context-membership-01": {
                "observables": ["retrieval_hits", "context_members", "context_sha256"],
                "observed": {
                    "retrievalHitIds": [hit.source_id for hit in hits],
                    "contextMembersPresent": context_membership_ok,
                    "contextSha256": sha256(context),
                    "actualModelInput": "not_run",
                },
            },
            "retrieval-diagnostics-01": {"observed": retrieval_diagnostics},
            "context-budget-01": {"observed": budget_observation},
            "failure-routing-01": {"observed": failure_routing},
            "corpus-absence-01": {
                "observed": {
                    "absenceProbe": absence_probe,
                    "scope": "entire_technical_registry",
                    "matchedSourceIds": matched_ids,
                    "evidenceAbsent": not matched_ids,
                    "reasonCode": "insufficient_corpus_evidence" if not matched_ids else None,
                }
            },
        },
        "semanticVerdict": "pending_confirmation",
        "modelInvocation": "not_run",
        "holdout": "not_read",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"fixtures": len(result["fixtures"]), "status": result["status"]}, ensure_ascii=False))
    print(f"[out] {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
