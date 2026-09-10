"""W13 阶段 4 机械评分自测（确定性，无网络）。

断言对象是 `w13-eval-v1` 里可机械化的部分：branch、claim 数量、citation 可解析性与 precision、
以及零容忍标记。人工语义 checklist 不在范围内。
"""
from __future__ import annotations

from dataclasses import dataclass

from w13rag.scoring import CITATION_PRECISION_THRESHOLD, score_item, summarize

REGISTRY = {"rules/a.md#L1-L1", "rules/b.md#L2-L2"}


@dataclass
class FakeRecord:
    status: str
    parsed: dict | None


def _item(branch: str, behavior: str = "direct_answer") -> dict:
    return {"id": f"w13-dev-{behavior}-01", "behavior_type": behavior, "expected_branch": branch}


def test_answered_with_resolvable_citations_passes():
    rec = FakeRecord(
        status="ok",
        parsed={
            "branch": "answered",
            "claims": [{"text": "x", "citations": ["rules/a.md#L1-L1"]}],
        },
    )
    score = score_item(rec, _item("answered"), REGISTRY)
    assert score.failures == []
    assert score.citation_precision == 1.0
    assert score.citations_resolved == 1


def test_unresolved_citation_is_flagged_and_lowers_precision():
    rec = FakeRecord(
        status="ok",
        parsed={
            "branch": "answered",
            "claims": [{"text": "x", "citations": ["rules/a.md#L1-L1", "rules/none.md#L9-L9"]}],
        },
    )
    score = score_item(rec, _item("answered"), REGISTRY)
    assert score.unresolved_citations == ["rules/none.md#L9-L9"]
    assert score.citation_precision == 0.5
    assert "citation_not_resolvable" in score.failures
    assert "citation_precision_below_1.0" in score.failures


def test_expected_abstained_but_answered_is_zero_tolerance():
    rec = FakeRecord(
        status="ok",
        parsed={"branch": "answered", "claims": [{"text": "x", "citations": ["rules/a.md#L1-L1"]}]},
    )
    score = score_item(rec, _item("abstained", "no_answer"), REGISTRY)
    assert score.abstained_but_answered is True
    assert "branch_mismatch" in score.failures
    assert "abstained_but_answered" in score.failures


def test_abstained_has_no_citations_and_precision_is_none():
    rec = FakeRecord(
        status="ok",
        parsed={
            "branch": "abstained",
            "reason_code": "insufficient_corpus_evidence",
            "reason_text": "证据不足。",
        },
    )
    score = score_item(rec, _item("abstained", "no_answer"), REGISTRY)
    assert score.failures == []
    assert score.citations_total == 0
    assert score.citation_precision is None  # 0/0 不写成 0


def test_structural_failure_short_circuits_branch_check():
    rec = FakeRecord(status="json_error", parsed=None)
    score = score_item(rec, _item("answered"), REGISTRY)
    assert score.structural_ok is False
    assert "json_error" in score.failures
    assert "branch_mismatch" not in score.failures


def test_summarize_reports_thresholds_and_zero_tolerance():
    good = FakeRecord(
        status="ok",
        parsed={"branch": "answered", "claims": [{"text": "x", "citations": ["rules/a.md#L1-L1"]}]},
    )
    bad = FakeRecord(
        status="ok",
        parsed={"branch": "answered", "claims": [{"text": "x", "citations": ["rules/b.md#L2-L2"]}]},
    )
    scores = [score_item(good, _item("answered", f"cls{i}"), REGISTRY) for i in range(8)]
    scores += [score_item(bad, _item("abstained", "no_answer"), REGISTRY)]
    scores += [score_item(bad, _item("abstained", "no_answer2"), REGISTRY)]
    summary = summarize(scores)
    assert summary["items"] == 10
    assert summary["mechanically_passed"] == 8
    assert summary["meets_dev_threshold"] is False
    assert summary["citation_precision_threshold"] == CITATION_PRECISION_THRESHOLD
    assert len(summary["abstained_but_answered_items"]) == 2
    assert all(v["meets_threshold"] is False for k, v in summary["per_class"].items() if k.startswith("no_answer"))
