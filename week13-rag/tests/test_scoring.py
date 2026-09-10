"""W13 评估层自测（确定性，无网络）。

覆盖三段分层：`run` 事实与可重试分类、`evaluators` 的 applies/skip_reason/score、`decide_item` 的合取判定，
以及 `summarize` 的 split 门禁。

关键回归（2026-09-10 判定入口事故的机械防线）：结构失败的 item 直接 `fail`，**不产生 pending**，从而不可能
被人工语义判定重新定性为通过。
"""
from __future__ import annotations

from dataclasses import dataclass

from w13rag.scoring import (
    CITATION_PRECISION_THRESHOLD,
    DEV_MIN_PASS,
    FROZEN_RETRY_POLICY,
    evaluate_item,
    is_retryable,
    summarize,
)

REGISTRY = {"rules/a.md#L1-L1", "rules/b.md#L2-L2"}


@dataclass
class FakeRecord:
    status: str
    parsed: dict | None
    http_status: int | None = None
    detail: str | None = None


def _item(branch: str, behavior: str = "direct_answer", suffix: str = "01") -> dict:
    return {"id": f"w13-dev-{behavior}-{suffix}", "behavior_type": behavior, "expected_branch": branch}


def _answered(citation: str = "rules/a.md#L1-L1") -> dict:
    return {"branch": "answered", "claims": [{"text": "x", "citations": [citation]}]}


def _abstained() -> dict:
    return {
        "branch": "abstained",
        "reason_code": "insufficient_corpus_evidence",
        "reason_text": "证据不足。",
    }


def _ev(status: str, parsed: dict | None, item: dict, semantic: dict | None = None, http_status=None):
    return evaluate_item(FakeRecord(status=status, parsed=parsed, http_status=http_status), item, REGISTRY, semantic)


# --- run 事实层 ---------------------------------------------------------------------------------


def test_retryable_follows_framework_default_classification():
    assert is_retryable("ok") is False
    assert is_retryable("timeout_error") is True
    assert is_retryable("transport_error") is True
    assert is_retryable("empty_content") is True
    assert is_retryable("json_error") is True
    assert is_retryable("schema_error") is True
    assert is_retryable("http_error", 503) is True
    assert is_retryable("http_error", 429) is False
    assert is_retryable("http_error", None) is False


def test_run_facts_record_frozen_retry_policy():
    ev = _ev("timeout_error", None, _item("answered"))
    assert ev.run.retryable is True
    assert ev.run.retry_policy == FROZEN_RETRY_POLICY == "no-retry"


# --- 结构失败：直接失败，不产生 pending（关键回归） ----------------------------------------------


def test_structural_failure_fails_item_without_pending():
    ev = _ev("schema_error", None, _item("answered"))
    assert ev.verdict.result == "fail"
    assert ev.verdict.reasons == ["structural_validity"]
    assert ev.verdict.pending == []  # 结构失败不得进入语义判定
    semantic = {e.key: e for e in ev.evaluators if e.key in {"claim_support", "evidence_coverage"}}
    assert all(not e.applies and e.skip_reason == "schema_error" for e in semantic.values())


def test_json_error_keeps_branch_and_semantic_inapplicable():
    ev = _ev("json_error", None, _item("answered"))
    keys = {e.key: e for e in ev.evaluators}
    assert keys["branch_match"].applies is False
    assert keys["branch_match"].skip_reason == "json_error"
    assert keys["structural_validity"].passed is False
    assert ev.verdict.result == "fail"


# --- 结构正常：语义未填则 pending，填完才可能通过 -------------------------------------------------


def test_answered_awaits_semantic_review():
    ev = _ev("ok", _answered(), _item("answered"))
    assert ev.verdict.result is None
    assert ev.verdict.pending == ["claim_support", "evidence_coverage"]
    assert ev.verdict.reasons == []


def test_semantic_pass_completes_verdict():
    semantic = {"claim_support": True, "evidence_coverage": True}
    ev = _ev("ok", _answered(), _item("answered"), semantic)
    assert ev.verdict.result == "pass"
    assert ev.verdict.pending == []


def test_semantic_failure_fails_item():
    semantic = {"claim_support": False, "evidence_coverage": True}
    ev = _ev("ok", _answered(), _item("answered"), semantic)
    assert ev.verdict.result == "fail"
    assert ev.verdict.reasons == ["claim_support"]


def test_abstained_pends_only_reason_text_consistency():
    ev = _ev("ok", _abstained(), _item("abstained", "no_answer"))
    assert ev.verdict.pending == ["reason_text_consistency"]
    keys = {e.key: e for e in ev.evaluators}
    assert keys["citation_present"].applies is False
    assert keys["citation_precision"].applies is False
    assert keys["citation_precision"].score is None  # 0/0 不写成 0


# --- 机械 evaluator 的判定与分数 -----------------------------------------------------------------


def test_unresolved_citation_fails_two_evaluators():
    rec_parsed = {"branch": "answered", "claims": [{"text": "x", "citations": ["rules/a.md#L1-L1", "rules/none.md#L9-L9"]}]}
    ev = _ev("ok", rec_parsed, _item("answered"))
    keys = {e.key: e for e in ev.evaluators}
    assert keys["citation_resolvable"].passed is False
    assert keys["citation_precision"].score == 0.5
    assert keys["citation_precision"].passed is False
    assert ev.verdict.result == "fail"


def test_missing_citation_fails_citation_present():
    rec_parsed = {"branch": "answered", "claims": [{"text": "x", "citations": []}]}
    ev = _ev("ok", rec_parsed, _item("answered"))
    keys = {e.key: e for e in ev.evaluators}
    assert keys["citation_present"].passed is False
    assert keys["citation_resolvable"].applies is False  # 无 citation 可解析


def test_zero_tolerance_abstained_but_answered():
    ev = _ev("ok", _answered(), _item("abstained", "no_answer"))
    assert ev.verdict.result == "fail"
    assert "abstained_but_answered" in ev.verdict.reasons
    assert "branch_match" in ev.verdict.reasons


def test_claim_count_bounds():
    many = {"branch": "answered", "claims": [{"text": "x", "citations": ["rules/a.md#L1-L1"]}] * 11}
    ev = _ev("ok", many, _item("answered"))
    keys = {e.key: e for e in ev.evaluators}
    assert keys["claim_count"].passed is False
    assert keys["claim_count"].score == 11.0


# --- split 汇总：incomplete / fail / pass --------------------------------------------------------


def _ok_items(count: int, semantic: dict[str, bool] | None = None):
    return [_ev("ok", _answered(), _item("answered", suffix=f"{i:02d}"), semantic) for i in range(count)]


def test_summarize_is_incomplete_while_semantic_pending():
    summary = summarize(_ok_items(10))
    assert summary["mechanical"]["passed"] == 10
    assert summary["verdicts"]["pending"] == 10
    assert summary["split_status"] == "incomplete"  # 未完成判定不能宣布通过


def test_summarize_mechanical_count_matches_legacy_semantics():
    evaluations = _ok_items(8) + [_ev("schema_error", None, _item("answered", suffix="08")), _ev("json_error", None, _item("answered", suffix="09"))]
    summary = summarize(evaluations)
    assert summary["items"] == 10
    assert summary["mechanical"]["passed"] == 8  # 与旧证据的 mechanically_passed 语义一致
    assert len(summary["mechanical"]["failed_items"]) == 2
    assert summary["verdicts"]["failed"] == 2
    assert summary["split_status"] == "fail"  # 2 条必然失败已超过允许的 1 条，无需等语义判定


def test_summarize_fails_when_item_pass_rate_below_threshold():
    semantic = {"claim_support": True, "evidence_coverage": True}
    evaluations = _ok_items(8, semantic)
    evaluations += [_ev("schema_error", None, _item("answered", suffix="08")), _ev("json_error", None, _item("answered", suffix="09"))]
    summary = summarize(evaluations)
    assert summary["verdicts"]["passed"] == 8
    assert summary["gate"]["item_pass_rate"] == 0.8
    assert summary["gate"]["item_pass_rate_threshold"] == DEV_MIN_PASS / 10
    assert summary["split_status"] == "fail"


def test_summarize_passes_when_all_gates_hold():
    semantic = {"claim_support": True, "evidence_coverage": True}
    summary = summarize(_ok_items(10, semantic))
    assert summary["verdicts"]["passed"] == 10
    assert summary["gate"]["citation_precision_min"] == 1.0
    assert summary["gate"]["citation_precision_ok"] is True
    assert summary["gate"]["zero_tolerance_ok"] is True
    assert summary["split_status"] == "pass"


def test_summarize_zero_tolerance_blocks_pass():
    semantic = {"claim_support": True, "evidence_coverage": True}
    evaluations = _ok_items(9, semantic)
    evaluations.append(_ev("ok", _answered(), _item("abstained", "no_answer", suffix="09"), semantic))
    summary = summarize(evaluations)
    assert summary["gate"]["zero_tolerance_items"] == ["w13-dev-no_answer-09"]
    assert summary["split_status"] == "fail"


def test_citation_precision_uses_threshold_constant():
    assert CITATION_PRECISION_THRESHOLD == 1.0


def test_mechanical_failure_is_not_masked_by_pending_semantics():
    """回归防线：已确定的机械失败不得被「语义待判定」掩盖为 None。"""
    ev = _ev("ok", _answered("rules/none.md#L9-L9"), _item("answered"))
    assert ev.verdict.reasons
    assert ev.verdict.pending == ["claim_support", "evidence_coverage"]
    assert ev.verdict.result == "fail"


def test_abstained_skips_answer_only_semantic_evaluators():
    ev = _ev("ok", _abstained(), _item("abstained", "no_answer"))
    keys = {e.key: e for e in ev.evaluators}
    assert keys["claim_support"].applies is False
    assert keys["claim_support"].skip_reason == "abstained"
    assert keys["reason_text_consistency"].applies is True
