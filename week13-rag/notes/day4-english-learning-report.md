Subject: Daily AI Engineering Learning Summary - 2026-09-10 - Full-Context RAG Baseline: Metering, Client Wiring, and First Dev Run

Evidence captured as of 2026-09-10 22:20 Asia/Shanghai

Historical snapshot note, added 2026-09-11: This report retains its original cutoff. Subsequent D4 work completed the JSON-mode run (8/10 mechanically; 4/10 after item decisions), nine retrieval configurations, the BM25 end-to-end run, and the first holdout run. Quality gates remain unmet. Current status and corrected figures are in `day4-full-context-baseline-and-bm25.md` sections 6.14-6.22; the future-tense items below describe the 22:20 snapshot.

Learning Status: D4 stages 1-4 closed. The full-context dev baseline ran on the frozen corpus and scored 7/10 mechanically, below the frozen 9/10 gate.

Summary

Today I closed serialization review, rebuilt the tokenizer runtime, metered full input, verified client wiring, froze RAG Prompt v1, and ran the first full-context dev baseline with ten real calls. I registered the serving-model policy and recorded an eval decision-path defect. The baseline missed the frozen 9/10 gate; it supports only that this full-context configuration misses the threshold.

Learning Outcomes and Evidence

- Serialization review closed. I signed off A1-A8 as compliant, sixteen whole-corpus invariants passed, two destructive experiments turned red exactly as predicted and were reverted, and an added fixture moved the suite from 9 to 11 passing tests.

- Gate gap fixed. `w13rag.sh check` now includes the frozen-baseline verify step. Replaying a removed parser merge rule produced false green before the fix and two failures after it, then returned to 16 passed with the frozen hash matching.

- Tokenizer runtime rebuilt. The archive SHA-256 matched the D1 record, and per-file token counts plus the smoke case reproduced exactly, so environment equivalence rests on measured numbers rather than version strings. The D1 snapshot was found to list an unresolvable filelock version.

- Input metering. The largest rendered request is 44,701 tokens against an available ceiling of 895,904, so the frozen corpus fits without truncation. The metering script shares one assembly function with the real request path.

- Client wiring verified. Payload capture proves `thinking: disabled` and `max_tokens=4096` are sent; JSON, schema, HTTP, and timeout failures have mutually exclusive states.

- First dev baseline. Ten real calls produced 7/10 mechanical passes, mechanical citation-identifier resolvability minimum 1.0, no missing citations, and no answered response where abstention was expected. Prompt cache hit tokens were observable and rose from 0 to about 44k.

Technical Understanding

- The full-context baseline has no retrieval stage: its context contains the whole frozen corpus. Corpus, eval set, prompt, and scoring remain comparable with later BM25 runs.

- Failure layering assigns one responsibility per stage. Assembly, transport, parsing, schema validation, and scoring each own one decision, and a failed call becomes one exclusive status instead of an exception.

- Metering and real traffic share one assembly function, reducing assembly drift. The offline tokenizer count remains an estimate and does not replace provider-reported usage.

Issues, Decisions, and Remaining Boundaries

- Three failures are attributed: two in response parsing and schema, one a generation-layer false abstention. None is a retrieval miss.

- The result cannot be read as "retrieval is required", because prompt, schema, citation, and generation failures are not yet excluded.

- One process defect is recorded: the eval decision entry point restated the scoring rules and turned the per-item conjunction into an additive count. No item was re-judged and the pass count is unchanged.

- Not finished today: the manual semantic checklist, the stage 5 conclusion, BM25, dense, and the first holdout run.

Next Step

Fix the decision entry point so it cites the frozen contract instead of restating it, decide the two candidate hardening changes, then rerun the dev baseline and write the stage 5 conclusion.

Code Evidence

The first snippet, from `src/w13rag/generation.py`, is the response classification that keeps JSON and schema failures in separate statuses. The second, from `src/w13rag/scoring.py`, is the mechanical scoring path that turns a run record into per-item failures without re-interpreting the failure stage.

`week13-rag/src/w13rag/generation.py#L113-L123`:
```python
def check_response(text: str, schema: dict[str, Any]) -> tuple[str, dict | None, str | None]:
    """响应文本 -> (状态, 解析结果, 细节)。JSON 与 schema 失败分别归类，不混为一种错误。"""
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        return STATUS_JSON_ERROR, None, f"{exc.msg} at pos {exc.pos}"
    try:
        jsonschema.validate(instance=parsed, schema=schema)
    except jsonschema.ValidationError as exc:
        return STATUS_SCHEMA_ERROR, None, exc.message
    return STATUS_OK, parsed, None
```

`week13-rag/src/w13rag/scoring.py#L69-L86`:
```python
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
```

Both snippets were checked against commit `2ba1209` with local `git show`; `2ba1209` is an ancestor of local `origin/main`. Link reachability was not externally verified per the report protocol.

The first snippet is at <https://github.com/NiceFreak/nodejs-skillup/blob/2ba1209/week13-rag/src/w13rag/generation.py#L113-L123>. The second is at <https://github.com/NiceFreak/nodejs-skillup/blob/2ba1209/week13-rag/src/w13rag/scoring.py#L69-L86>.

Technical Capability Matrix

Criterion: Explain the responsibility boundaries of ingestion, retrieval, context, generation, and evaluation
Target or Threshold: No quantitative threshold frozen
Observed Evidence: Context assembly, generation, and evaluation ran end to end on the frozen corpus (10 real calls); ingestion and serialization were closed on D1-D3; retrieval is not implemented in this path
Status: Partially Met
Gap or Next Verification: BM25 and dense retrieval are unbuilt, so the retrieval boundary has not been exercised in code

Criterion: Attribute a failing question across retrieval, context assembly, prompt, or generation
Target or Threshold: No quantitative threshold frozen
Observed Evidence: All three dev-baseline failures are attributed mechanically: two to response parsing and schema, one to a generation-layer false abstention; no failure is attributed to retrieval
Status: Partially Met
Gap or Next Verification: The manual semantic checklist for the ten items, including the abstention case, is not filled in yet
