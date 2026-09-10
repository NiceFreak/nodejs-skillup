"""W13 机械评分（`w13-eval-v1` 的可机械化部分）。

分工（D2 冻结）：
- 机械检查：branch 是否匹配、claim 数量、citation 是否存在、citation 是否能解析到 citation registry、
  citation precision、missing citation 与「预期 abstained 却 answered」的零容忍标记。
- 人工语义 checklist：claim 是否得到原文支持、回答是否满足 evidence requirement、失败归因与最终验收 ——
  不在本模块内，也不由本模块给结论。

边界：不调用模型、不读 holdout、不修改任何冻结对象。
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "evidence/serialization/registry-rules-c0a4b85.json"

#: 通过标准（`w13-eval-v1`；阈值不在本模块重定义，只在此处引用）
DEV_MIN_PASS = 9
PER_CLASS_MIN_PASS = 1
CITATION_PRECISION_THRESHOLD = 1.0


def load_registry_ids(registry_path: Path = REGISTRY_PATH) -> set[str]:
    entries = json.loads(registry_path.read_text(encoding="utf-8"))
    return {e["source_id"] for e in entries}


@dataclass
class MechanicalScore:
    item_id: str
    behavior_type: str
    expected_branch: str
    actual_branch: str | None
    structural_ok: bool
    branch_match: bool
    claim_count: int
    citations_total: int
    citations_resolved: int
    citation_precision: float | None  # None = 无法计算（0/0，不写成 0）
    unresolved_citations: list[str] = field(default_factory=list)
    missing_citation: bool = False
    abstained_but_answered: bool = False
    failures: list[str] = field(default_factory=list)
    needs_human_semantic_review: bool = True

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def score_item(
    record: Any, item: dict[str, Any], registry_ids: set[str]
) -> MechanicalScore:
    """对一次 `RunRecord` 做机械评分。失败阶段沿用 record.status，不重解释。"""
    failures: list[str] = []
    structural_ok = record.status == "ok"
    parsed = record.parsed or {}
    actual_branch = parsed.get("branch")
    claims = parsed.get("claims") or [] if actual_branch == "answered" else []
    citations = [c for claim in claims for c in (claim.get("citations") or [])]
    resolved = [c for c in citations if c in registry_ids]
    unresolved = sorted({c for c in citations if c not in registry_ids})
    precision = (len(resolved) / len(citations)) if citations else None

    if not structural_ok:
        failures.append(record.status)
    expected = item["expected_branch"]
    branch_match = actual_branch == expected
    if structural_ok and not branch_match:
        failures.append("branch_mismatch")
    if expected == "abstained" and actual_branch == "answered":
        failures.append("abstained_but_answered")
    missing_citation = actual_branch == "answered" and any(
        not (claim.get("citations") or []) for claim in claims
    )
    if missing_citation:
        failures.append("missing_citation")
    if unresolved:
        failures.append("citation_not_resolvable")
    if precision is not None and precision < CITATION_PRECISION_THRESHOLD:
        failures.append("citation_precision_below_1.0")

    return MechanicalScore(
        item_id=item["id"],
        behavior_type=item["behavior_type"],
        expected_branch=expected,
        actual_branch=actual_branch,
        structural_ok=structural_ok,
        branch_match=branch_match,
        claim_count=len(claims),
        citations_total=len(citations),
        citations_resolved=len(resolved),
        citation_precision=precision,
        unresolved_citations=unresolved,
        missing_citation=missing_citation,
        abstained_but_answered=(expected == "abstained" and actual_branch == "answered"),
        failures=failures,
    )


def summarize(scores: list[MechanicalScore]) -> dict[str, Any]:
    """split 级汇总。零容忍条件单独列出，不混进简单的通过计数。"""
    passed = [s for s in scores if not s.failures]
    by_class: dict[str, list[MechanicalScore]] = {}
    for s in scores:
        by_class.setdefault(s.behavior_type, []).append(s)
    precision_values = [s.citation_precision for s in scores if s.citation_precision is not None]
    return {
        "items": len(scores),
        "mechanically_passed": len(passed),
        "dev_min_pass_threshold": DEV_MIN_PASS,
        "meets_dev_threshold": len(passed) >= DEV_MIN_PASS,
        "per_class": {
            k: {
                "items": len(v),
                "passed": sum(1 for s in v if not s.failures),
                "min_pass_threshold": PER_CLASS_MIN_PASS,
                "meets_threshold": sum(1 for s in v if not s.failures) >= PER_CLASS_MIN_PASS,
            }
            for k, v in sorted(by_class.items())
        },
        "citation_precision_min": min(precision_values) if precision_values else None,
        "citation_precision_threshold": CITATION_PRECISION_THRESHOLD,
        "missing_citation_items": [s.item_id for s in scores if s.missing_citation],
        "abstained_but_answered_items": [s.item_id for s in scores if s.abstained_but_answered],
        "needs_human_semantic_review": [s.item_id for s in scores if s.needs_human_semantic_review],
    }
