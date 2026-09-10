"""W13 评估层：运行事实 / 评估器结果 / 判定（`w13-eval-v1` 的可机械化部分 + 语义槽位）。

分层（对齐 LangChain / LangGraph 生态的既有职责划分）：

1. `run`（运行事实）—— 一次调用实际发生了什么。`status` 沿用 `w13rag.generation` 的七态；`retryable`
   按框架的失败分类给出（LangGraph `RetryPolicy.retry_on` 的默认策略重试瞬时错误、不重试编程错误；
   LangChain 的结构化输出校验失败默认进入重试路径）。**W13 冻结策略是不重试**
   （`retry_policy="no-retry"`），该字段只作分类与 W14 harness 接口，不代表本次会自动重试。
2. `evaluators`（评估器结果）—— 每个 evaluator 独立产出自己的结论，互不覆盖：
   `key` / `applies` / `skip_reason` / `passed` / `score` / `comment`。`applies=False` 表示本次运行没有该
   evaluator 的可评对象（例如结构失败时没有可判定的 claims）；`passed=None` 表示有可评对象但尚未判定
   （人工语义 checklist 未填）。
3. `verdict`（判定）—— 由 `decide_item()` 单一函数按冻结契约的**合取**得出，规则只存在于该函数内：
   `eval/scoring-contract.md` §2（answered 八条必须全部满足）、§3（abstained 五条）、§6（split 五条）。
   入口文件与工作表不得重述这些规则；`eval/scripts/verify-decision-entry.mjs` 守住这一点。

判定未完成时 `Verdict.result is None`，`pending` 列出待判定的 evaluator。这不是「第三种通过状态」：
契约规定的是通过条件，未完成即不能宣布通过，也不等于失败。

边界：不调用模型、不读 holdout、不修改任何冻结对象。
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "evidence/serialization/registry-rules-c0a4b85.json"

#: 通过标准（`w13-eval-v1` §6；阈值不在本模块重定义，只在此处引用）
DEV_MIN_PASS = 9
PER_CLASS_MIN_PASS = 1
CITATION_PRECISION_THRESHOLD = 1.0

#: W13 冻结的重试策略：单次调用，不做自动重试。重试属 W14 harness（LangGraph `RetryPolicy`）。
FROZEN_RETRY_POLICY = "no-retry"

#: `w13rag.generation` 的七态运行结果
STATUS_OK = "ok"
STATUS_EMPTY_CONTENT = "empty_content"
STATUS_JSON_ERROR = "json_error"
STATUS_SCHEMA_ERROR = "schema_error"
STATUS_HTTP_ERROR = "http_error"
STATUS_TIMEOUT_ERROR = "timeout_error"
STATUS_TRANSPORT_ERROR = "transport_error"

#: 与框架默认策略对齐的可重试分类依据（不改变 W13 的 no-retry 行为）。
_RETRYABLE_STATUSES = frozenset(
    {
        STATUS_TIMEOUT_ERROR,  # LangGraph: NodeTimeoutError 默认可重试
        STATUS_TRANSPORT_ERROR,  # 连接重置等瞬时错误
        STATUS_EMPTY_CONTENT,  # 官方 JSON Output 可能返回空内容；同类瞬时问题
        STATUS_JSON_ERROR,  # LangChain: 结构化输出解析失败默认进入重试路径
        STATUS_SCHEMA_ERROR,  # 同上；W13 用 Prompt/配置修，不靠重试
        STATUS_HTTP_ERROR,  # 仅 5xx 可重试（见 is_retryable）
    }
)


def is_retryable(status: str, http_status: int | None = None) -> bool:
    """该失败在框架默认策略下是否属于可重试类别。

    对齐 LangGraph `default_retry_on`（httpx/requests 只在 5xx 重试）与 LangChain 结构化输出的默认重试行为。
    `ok` 无需重试；`http_error` 依赖状态码；取不到状态码时按不可重试处理，避免把 4xx 契约错误当瞬时错误。
    """
    if status == STATUS_OK:
        return False
    if status == STATUS_HTTP_ERROR:
        return http_status is not None and 500 <= http_status < 600
    return status in _RETRYABLE_STATUSES


def load_registry_ids(registry_path: Path = REGISTRY_PATH) -> set[str]:
    entries = json.loads(registry_path.read_text(encoding="utf-8"))
    return {e["source_id"] for e in entries}


@dataclass
class RunFacts:
    """一次调用的运行事实（不含判定结论）。"""

    status: str
    retryable: bool
    retry_policy: str = FROZEN_RETRY_POLICY
    http_status: int | None = None
    detail: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class EvaluatorResult:
    """单个 evaluator 的独立结论。

    `applies=False` 时必须给 `skip_reason` 且 `passed is None`：该 evaluator 没有可评对象，既不算通过也不算失败。
    `passed=None` 且 `applies=True`：有可评对象但尚未判定（人工语义 checklist）。
    """

    key: str
    applies: bool
    skip_reason: str | None = None
    passed: bool | None = None
    score: float | None = None
    comment: str = ""

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Verdict:
    """item 级判定：契约 §2 / §3 的合取结果。`result is None` 表示判定未完成。"""

    result: str | None
    reasons: list[str] = field(default_factory=list)
    pending: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ItemEvaluation:
    """一次 item 的完整评估：运行事实 + 评估器结果 + 判定。"""

    item_id: str
    behavior_type: str
    expected_branch: str
    run: RunFacts
    evaluators: list[EvaluatorResult]
    verdict: Verdict

    def as_dict(self) -> dict[str, Any]:
        return {
            "itemId": self.item_id,
            "behaviorType": self.behavior_type,
            "expectedBranch": self.expected_branch,
            "run": self.run.as_dict(),
            "evaluators": [e.as_dict() for e in self.evaluators],
            "verdict": self.verdict.as_dict(),
        }

#: 机械可判定的 evaluator（契约 §2 第 1、2、4、5、6 条与 §3 第 1-4 条）
MECHANICAL_KEYS = (
    "structural_validity",
    "branch_match",
    "claim_count",
    "citation_present",
    "citation_resolvable",
    "citation_precision",
    "abstained_but_answered",
)

#: 需要人工语义 checklist 的 evaluator（契约 §1 人工职责）
SEMANTIC_KEYS = (
    "claim_support",
    "evidence_coverage",
    "reason_text_consistency",
)


def _mechanical_evaluators(record: Any, item: dict[str, Any], registry_ids: set[str]) -> list[EvaluatorResult]:
    """按契约 §2 / §3 的机械条件产出 evaluator；顺序固定，便于与历史证据逐项对齐。"""
    status = record.status
    structural_ok = status == STATUS_OK
    parsed = record.parsed or {}
    actual_branch = parsed.get("branch")
    claims = (parsed.get("claims") or []) if actual_branch == "answered" else []
    citations = [c for claim in claims for c in (claim.get("citations") or [])]
    resolved = [c for c in citations if c in registry_ids]
    unresolved = sorted({c for c in citations if c not in registry_ids})
    precision = (len(resolved) / len(citations)) if citations else None
    expected = item["expected_branch"]
    answered = structural_ok and actual_branch == "answered"

    evaluators = [
        EvaluatorResult(
            key="structural_validity",
            applies=True,
            passed=structural_ok,
            comment=status if not structural_ok else "parsed and validated",
        )
    ]

    def skipped(key: str, reason: str, comment: str) -> EvaluatorResult:
        return EvaluatorResult(key=key, applies=False, skip_reason=reason, comment=comment)

    if structural_ok:
        evaluators.append(
            EvaluatorResult(
                key="branch_match",
                applies=True,
                passed=actual_branch == expected,
                comment=f"expected={expected} actual={actual_branch}",
            )
        )
    else:
        evaluators.append(skipped("branch_match", status, "no parsable branch (contract §2.1)"))

    if answered:
        evaluators.append(
            EvaluatorResult(
                key="claim_count",
                applies=True,
                passed=1 <= len(claims) <= 10,
                score=float(len(claims)),
                comment=f"claims={len(claims)} (contract §2.2, §3.2)",
            )
        )
    else:
        evaluators.append(skipped("claim_count", status if not structural_ok else actual_branch or "", "not answered"))

    if answered:
        missing = [i for i, claim in enumerate(claims) if not (claim.get("citations") or [])]
        evaluators.append(
            EvaluatorResult(
                key="citation_present",
                applies=True,
                passed=not missing,
                comment="every claim has ≥1 citation" if not missing else f"claims without citation={missing}",
            )
        )
    else:
        evaluators.append(skipped("citation_present", status if not structural_ok else actual_branch or "", "not answered"))

    if citations:
        evaluators.append(
            EvaluatorResult(
                key="citation_resolvable",
                applies=True,
                passed=not unresolved,
                comment=f"resolved={len(resolved)} unresolved={unresolved}",
            )
        )
        evaluators.append(
            EvaluatorResult(
                key="citation_precision",
                applies=True,
                passed=precision >= CITATION_PRECISION_THRESHOLD,
                score=precision,
                comment=f"precision={precision}",
            )
        )
    else:
        evaluators.append(skipped("citation_resolvable", status if not structural_ok else "no-citations", "no citation returned"))
        evaluators.append(skipped("citation_precision", status if not structural_ok else "no-citations", "0/0 is not 0"))

    zero_tolerance = expected == "abstained" and actual_branch == "answered"
    evaluators.append(
        EvaluatorResult(
            key="abstained_but_answered",
            applies=True,
            passed=not zero_tolerance,
            comment="expected abstained, got answered (contract §3, zero tolerance)" if zero_tolerance else "not triggered",
        )
    )
    return evaluators


def _semantic_evaluators(record: Any, semantic: dict[str, bool] | None) -> list[EvaluatorResult]:
    """语义 evaluator：只有结构可解析时才有可评对象；未提供判定时 `passed=None`（pending）。"""
    status = record.status
    parsed = record.parsed or {}
    structural_ok = status == STATUS_OK
    actual_branch = parsed.get("branch")
    semantic = semantic or {}
    answered = structural_ok and actual_branch == "answered"

    results: list[EvaluatorResult] = []
    for key in ("claim_support", "evidence_coverage"):
        if answered:
            results.append(
                EvaluatorResult(
                    key=key,
                    applies=True,
                    passed=semantic.get(key),
                    comment="awaiting human semantic checklist" if semantic.get(key) is None else "human verdict recorded",
                )
            )
        else:
            results.append(
                EvaluatorResult(
                    key=key,
                    applies=False,
                    skip_reason=status if not structural_ok else "abstained",
                    comment="no returned claim to evaluate (contract semantic part)",
                )
            )

    if structural_ok and actual_branch == "abstained":
        results.append(
            EvaluatorResult(
                key="reason_text_consistency",
                applies=True,
                passed=semantic.get("reason_text_consistency"),
                comment="awaiting human semantic checklist" if semantic.get("reason_text_consistency") is None else "human verdict recorded",
            )
        )
    else:
        results.append(
            EvaluatorResult(
                key="reason_text_consistency",
                applies=False,
                skip_reason=status if not structural_ok else actual_branch or "",
                comment="not an abstained response",
            )
        )
    return results


def decide_item(run: RunFacts, evaluators: list[EvaluatorResult]) -> Verdict:
    """契约 §2 / §3 的合取判定。**规则只在此函数内实现**，入口文件不得重述。

    - 结构失败：`structural_validity=False`，其余依赖解析的 evaluator `applies=False`，因此没有 pending，
      verdict 直接为 `fail`（契约 §7：错误字段、错误枚举或无法解析的分支使该 item 失败）。
    - 结构正常但语义 checklist 未填：`pending` 非空、`result=None`（判定未完成，不算通过也不算失败）。
    - 已有失败条件时 `result="fail"`，即使另有待判定项；`pending` 仍作为诊断信息保留。
    """
    reasons: list[str] = []
    pending: list[str] = []
    for evaluator in evaluators:
        if not evaluator.applies:
            continue
        if evaluator.passed is None:
            pending.append(evaluator.key)
        elif evaluator.passed is False:
            reasons.append(evaluator.key)
    # 合取：任一适用条件为 False 即 fail，不必等待其余条件判定。
    # 语义未判定只在尚无失败条件时留为 None（判定未完成）；已确定的失败不得被 pending 掩盖。
    if reasons:
        result: str | None = "fail"
    elif pending:
        result = None
    else:
        result = "pass"
    return Verdict(result=result, reasons=reasons, pending=pending)


def evaluate_item(
    record: Any,
    item: dict[str, Any],
    registry_ids: set[str],
    semantic: dict[str, bool] | None = None,
) -> ItemEvaluation:
    """一次 item 的完整评估。`semantic` 为人工语义判定（未提供则该部分 pending）。"""
    http_status = getattr(record, "http_status", None)
    run = RunFacts(
        status=record.status,
        retryable=is_retryable(record.status, http_status),
        http_status=http_status,
        detail=getattr(record, "detail", None),
    )
    evaluators = _mechanical_evaluators(record, item, registry_ids) + _semantic_evaluators(record, semantic)
    return ItemEvaluation(
        item_id=item["id"],
        behavior_type=item["behavior_type"],
        expected_branch=item["expected_branch"],
        run=run,
        evaluators=evaluators,
        verdict=decide_item(run, evaluators),
    )


def _evaluator(evaluation: ItemEvaluation, key: str) -> EvaluatorResult:
    """按 key 取 evaluator；缺 key 直接报错，不静默当作通过。"""
    for evaluator in evaluation.evaluators:
        if evaluator.key == key:
            return evaluator
    raise KeyError(f"{evaluation.item_id}: evaluator {key} missing")


def summarize(evaluations: list[ItemEvaluation]) -> dict[str, Any]:
    """split 级汇总（契约 §6）。`split_status` 三态：`pass` / `fail` / `incomplete`（判定未完成）。"""
    mechanical_pass: list[str] = []
    mechanical_fail: list[str] = []
    for evaluation in evaluations:
        mechanical = [_evaluator(evaluation, key) for key in MECHANICAL_KEYS]
        failed = [e.key for e in mechanical if e.applies and e.passed is False]
        if evaluation.run.status != STATUS_OK or failed:
            mechanical_fail.append(evaluation.item_id)
        else:
            mechanical_pass.append(evaluation.item_id)

    passed = [e.item_id for e in evaluations if e.verdict.result == "pass"]
    failed = [e.item_id for e in evaluations if e.verdict.result == "fail"]
    pending = [e.item_id for e in evaluations if e.verdict.result is None]

    by_class: dict[str, list[ItemEvaluation]] = {}
    for evaluation in evaluations:
        by_class.setdefault(evaluation.behavior_type, []).append(evaluation)

    precision_scores = [
        _evaluator(e, "citation_precision").score
        for e in evaluations
        if _evaluator(e, "citation_precision").applies
    ]
    precision_min = min(precision_scores) if precision_scores else None

    total = len(evaluations)
    pass_rate = (len(passed) / total) if total else 0.0
    per_class_ok = all(
        sum(1 for x in group if x.verdict.result == "pass") >= PER_CLASS_MIN_PASS
        for group in by_class.values()
    )
    zero_tolerance = [
        e.item_id for e in evaluations if _evaluator(e, "abstained_but_answered").passed is False
    ]
    precision_ok = None if precision_min is None else precision_min >= CITATION_PRECISION_THRESHOLD

    allowed_failures = total - DEV_MIN_PASS if total else 0
    certain_fail = bool(zero_tolerance) or len(failed) > allowed_failures
    if certain_fail:
        split_status = "fail"
    elif pending:
        split_status = "incomplete"
    elif total and pass_rate >= DEV_MIN_PASS / total and per_class_ok and precision_ok is not False:
        split_status = "pass"
    else:
        split_status = "fail"

    return {
        "items": total,
        "mechanical": {
            "passed": len(mechanical_pass),
            "passed_items": mechanical_pass,
            "failed_items": mechanical_fail,
        },
        "verdicts": {
            "passed": len(passed),
            "failed": len(failed),
            "pending": len(pending),
            "passed_items": passed,
            "failed_items": failed,
            "pending_items": pending,
        },
        "gate": {
            "item_pass_rate": pass_rate,
            "item_pass_rate_threshold": DEV_MIN_PASS / total if total else None,
            # 已判定通过 + 仍待判定的上限：低于阈值时无需等待人工判定即可判 fail。
            "max_achievable_pass_rate": ((len(passed) + len(pending)) / total) if total else None,
            "per_class_min_pass": PER_CLASS_MIN_PASS,
            "per_class_ok": per_class_ok,
            "citation_precision_min": precision_min,
            "citation_precision_threshold": CITATION_PRECISION_THRESHOLD,
            "citation_precision_ok": precision_ok,
            "zero_tolerance_items": zero_tolerance,
            "zero_tolerance_ok": not zero_tolerance,
        },
        "per_class": {
            key: {
                "items": len(group),
                "passed": sum(1 for x in group if x.verdict.result == "pass"),
                "pending": sum(1 for x in group if x.verdict.result is None),
            }
            for key, group in sorted(by_class.items())
        },
        "split_status": split_status,
    }
