Subject: Daily AI Engineering Learning Summary - 2026-09-04 - Independent async debugging, Bub context rule correction, and W12 close-out

Summary

Today closed Week 12, the first week of the AI Engineering reskill plan, with no new topics. The day tested whether the Python and Bub skills built earlier in the week transfer to unfamiliar situations. Three independent assessments passed: four closed-book Bub questions, a 45-minute diagnosis of an unseen async program, and a restated D4 prediction deviation. All five weekly deliverables passed, and a rebuild debt in DEBT.md was closed after a second consecutive pass plus two mastery items.

Learning Outcomes and Evidence

The main event was the independent diagnosis. A Python fetcher reused one shared httpx.AsyncClient across sequential requests, each with its own timeout budget. It crashed on the second request with RuntimeError: Cannot send a request, as the client has been closed. I reproduced it and added is_closed logging. The logs showed the first fast request succeeded, its finally block called client.aclose(), and is_closed flipped to True before the slow request started. The root cause: fetch_one borrowed a client owned by run(), but closed it in finally after every request. Two traps mattered. The RuntimeError is neither asyncio.TimeoutError nor httpx.HTTPError, so neither except branch caught it. The error surfaced on the slow path only by coincidence; any second request triggered it, verified with a fast-only sequence.

The fix was deleting that finally block and leaving run() as the single owner. I edited the file and saw elapsed 0.254s with results fast 200, slow TIMEOUT, fast 200. I then wrote experiments/d5_verify.py, which asserts the contracts: exact result matching, a slow-first sequence where the timeout does not block the following request, and a patched build_client counter equal to one with the client closed after run() returns. As a refutation step, it injects a defective fetch_one and confirms the RuntimeError reappears. All assertions passed.

A second outcome was a fact correction in the Bub reading. My first answer claimed model input only keeps messages and drops tool_call and tool_result. Source reading at commit 33c417a shows the opposite: the default selector _select_messages renders tool_call as an assistant tool_calls message, tool_result as a role tool message, and anchor as assistant text, while dropping system, error, and event. The message-only function is just a fallback when select is None. A tool loop only converges when the model sees the previous tool result. The correction was backfilled into report sections 4, 7, and 8 and day3 notes, and the report moved from draft v0 to closed v1.

Technical Understanding

I can now explain resource ownership precisely. An object that creates a shared client and closes it in its own finally is the owner. A function that receives the client for one request is a borrower and must not close it. httpx tracks ClientState.CLOSED; aclose transitions to CLOSED and closes the transport, and a second aclose is harmless. Sending after close raises a plain RuntimeError that is intentionally not an HTTPError. In asyncio, asyncio.timeout works by cancellation and re-raises TimeoutError at context exit, but an exception raised before the timeout point propagates unchanged.

For Bub, model input is rebuilt on every step from the append-only tape. Anchor selection controls which entries are fetched, the context filter removes entries marked not for context, and the default rendering function decides what the model sees. Tool calls and results are visible, which is why a multi-step tool conversation can terminate.


Issues, Decisions, and Remaining Boundaries

My first Q2 answer about context rendering was wrong, and the mistake came from treating the fallback as the default path. I corrected it by reading context.py and tape.py directly. The diagnosis also gave a useful coding-agent comparison. My frozen independent answer, Cline, Codex after a retry, and Claude Code all agreed on the root cause. My independent part covered the root cause, the uncaught exception, the fix direction, and the whole-batch crash. The agents added the trigger-condition proof, wrong-fix exclusion, and stronger assertions. I classified each claim as independently established, tool-refined, or still needing verification.

Remaining boundaries are recorded honestly. A real TCP/TLS test of whether timeout cancellation drops an extra connection was not run. Showcase board B3 still shows the pre-correction semantics and needs a separate visual design pass because its geometry and assertions were built on the old rule. The vendor snapshot decision for bub source is still open; the current choice is a clone command note in the document header. The class-2 rebuild debt was closed after a second consecutive first-tier pass plus two mastery items.

Next Step

Week 13 starts on September 7 with RAG foundations. The first action is freezing a physical corpus snapshot before the first eval question, then measuring tokens, then running a full-context baseline. Before that, the follow-up prompt in day5-followup-prompt.md can be run in a new session to fix the B3 board, optionally add a bub vendor snapshot, and optionally run the real-transport cancellation test. Week 14 Day 1 also schedules a delayed rebuild of the Bub and Python call chains in a 15 to 20 minute unit.

Code Evidence

Both files are committed to commit 58006a0 and pushed to origin/main. Content verified locally with git show 58006a0:<path>; fixed-commit links are provided below.

1. week12-python-rag/experiments/d5_diagnosis_fetcher.py, fetch_one (commit 58006a0, lines 52-61). This shows the fix: the finally block that closed the borrowed shared client is removed (commented out), so run() remains the single owner that closes the client.

https://github.com/NiceFreak/nodejs-skillup/blob/58006a0/week12-python-rag/experiments/d5_diagnosis_fetcher.py#L52-L61

```python
    try:
        async with asyncio.timeout(REQUEST_TIMEOUT):
            resp = await client.get(url)
            return path, resp.status_code
    except asyncio.TimeoutError:
        return path, "TIMEOUT"
    except httpx.HTTPError as exc:
        return path, f"HTTPERR:{type(exc).__name__}"
    # finally:
    #     await client.aclose()  # <-- 这行合理吗？
```

2. week12-python-rag/experiments/d5_verify.py, step4_contract_verification (commit 58006a0, lines 29-33). This shows falsifiable contract assertions: slow-first ordering does not block the following request, and the timeout truncation is bounded.

https://github.com/NiceFreak/nodejs-skillup/blob/58006a0/week12-python-rag/experiments/d5_verify.py#L29-L33

```python
    res2, elapsed2 = await fetcher.run(["slow", "fast"])
    expected2 = [("slow", "TIMEOUT"), ("fast", 200)]
    assert res2 == expected2, f"契约①失败 (顺序无关): 结果不匹配 {res2} != {expected2}"
    assert elapsed2 < 0.35, f"契约①失败 (超时未截断): 耗时 {elapsed2:.3f}s 过长"
```

Technical Capability Matrix

Criterion: Diagnose an unfamiliar async/resource-management program and locate a falsifiable root cause.
Target or Threshold: Locate to function/file/line and propose an executable fix hypothesis within 45 minutes; no quantitative threshold frozen.
Observed Evidence: Root cause located in fetch_one finally aclose at experiments/d5_diagnosis_fetcher.py; runtime fix verified at elapsed 0.254s with results [("fast",200),("slow","TIMEOUT"),("fast",200)]; refutation rerun reproduced RuntimeError.
Status: Met
Gap or Next Verification: Real TCP/TLS cancellation test (claim 10) not yet run; tools only noted it.

Criterion: Restate Bub turn-to-context rules without material.
Target or Threshold: Four questions on turn boundary, tape to context, responsibilities, step termination; no quantitative threshold frozen.
Observed Evidence: Q1/Q3/Q4 passed on first answer; Q2 first answer wrong (fallback treated as default), corrected after reading context.py and tape.py; correction backfilled to report and day3 notes.
Status: Partially Met
Gap or Next Verification: Rebuild Bub and Python call chains in a delayed W14 Day 1 unit.

Criterion: Close a rebuild debt with consecutive passes plus mastery evidence.
Target or Threshold: Two consecutive first-tier passes plus at least two mastery evidence items per AGENTS.md.
Observed Evidence: Class-2 sample passed D4 and D5 full first-tier sets; mastery items A and B reviewed and accepted; DEBT.md status changed to repaid on 2026-09-04.
Status: Met
Gap or Next Verification: No gap; debt closed.

Criterion: Weekly deliverable line coverage for migrated src code.
Target or Threshold: pytest passing, mypy and smoke green, migrated-src line coverage at least 90 percent.
Observed Evidence: 30 tests passed, total coverage 97.89 percent within the agreed scope (clients, config, models), mypy Success, smoke exit 0.
Status: Met
Gap or Next Verification: clients.py still misses three lines (118, 149, 206); intended new tests do not reach them; coverage remains above threshold.

