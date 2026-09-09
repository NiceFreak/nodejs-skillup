Subject: Daily AI Engineering Learning Summary - 2026-09-09 - Deterministic Serialization and Evidence Context Baseline

Evidence captured as of 2026-09-09 17:36 Asia/Shanghai

Learning Status: D3 contract closed and implementation milestone self-tested; parser review is next.

Summary

Today I closed the serialization contract that turns frozen source blocks into model-visible text, then implemented it against the real corpus. The contract fixes assembly order, whitespace handling, wrapper bytes, hash scope, and block ordering so reruns cannot silently differ. The deterministic parser, citation registry, and Evidence Context assembler were implemented and self-tested, the suite passed, I confirmed the seven criteria, and the whole-string SHA-256 was frozen as a regression baseline.

Learning Outcomes and Evidence

- Contract frozen. Design points 1-6 are confirmed: headings outer-to-inner, then table header, then the core source span; normalization-first baseline A with explicit EOL, trailing-space, blank-line, indentation, fenced-code, and blockquote rules; an XML-like source wrapper; and content_sha256 over the full model_content bytes.

- Implementation and self-test. src/w13rag now contains parser.py, registry.py, serialize.py, source.py, cli.py, and tests reporting 9 passed: fixture A/B/C byte and hash regressions plus real-corpus invariants. The build produced 572 registry entries with byte-identical output across two passes; all 7 documents report zero uncovered and zero duplicated core lines, and the wrapper precondition passed for all 572 entries.

- Whole-string baseline frozen. The real corpus assembles into an Evidence Context of 89,854 characters with SHA-256 8a02c665340e428afb36ff549a2fc5da0a460530501180e84b254c0365e4dc2b. A fresh rebuild, the on-disk artifact, and the frozen baseline file all match. Criteria 1-7 were confirmed word for word by me; criterion 3 deliberately keeps the "<source" prefix guard.

Technical Understanding

- source_id is a position identity bound to a frozen line range; content_sha256 is a content fingerprint over exactly the assembled text. Keeping them separate exposes two risks: content unchanged but location shifted, versus location unchanged but bytes changed.

- The wrapper is the only machine-readable block boundary; a body that would break it is a build-time precondition failure.

- The coverage audit checks that no content line is lost or duplicated; it does not judge semantic boundary quality, which the dev evaluation covers later.

- The frozen whole-string hash is a reproducibility anchor, not a quality signal.

Issues, Decisions, and Remaining Boundaries

- The criteria text was confirmed unchanged after the implementation ran; the "<source" prefix guard stays because it also catches "<source id=..." forms.

- A parser review worksheet and an inspect-block helper exist but are not yet filled in: the A1-A8 annotations and the predict-then-measure samples are still mine to complete.

- Serialized input metering, context budget, response schema wiring, and the "thinking: disabled" client check are not done. No model request, baseline, or holdout run has happened, so today's evidence proves deterministic input assembly only.

- The parser, registry, and Evidence Context code were produced in the AI Engineer implementation phase after I froze the semantics; passing tests prove the code matches the contract, while my acceptance depends on the D4 review and later reconstruction, not on the tests alone.

Next Step

On D4 I will review the parser semantics against the contract with the worksheet and inspect-block, meter the serialized input, set the context budget, and enter the full-corpus dev baseline gate only after the client check passes.

Code Evidence

The first snippet, from `src/w13rag/serialize.py` (functions `content_sha256` and `serialize_source_block`), shows that the hash covers the UTF-8 bytes of `model_content` only, and that the exact wrapper bytes (`<source id="...">` + LF + body + `</source>`) implement contract points 3 and 4. The second snippet, from `tests/test_registry_real.py`, is the two-pass assertion that a full real-corpus rebuild is byte-identical, which is the determinism evidence behind criterion 6.

`week13-rag/src/w13rag/serialize.py#L76-L91`:
```python
def content_sha256(model_content: str) -> str:
    """D3 §6.2.0 #4: SHA-256 over the UTF-8 bytes of model_content."""
    return hashlib.sha256(model_content.encode("utf-8")).hexdigest()


def serialize_source_block(source_id: str, model_content: str) -> str:
    """D3 §6.2.0 #3 exact wrapper bytes.

    '<source id="...">' + LF + model_content + '</source>' on its own line.
    No trailing LF after '</source>'; Evidence Context joins blocks with a
    single blank line.
    """
    body = model_content
    if not body.endswith("\n"):
        body += "\n"
    return f'<source id="{source_id}">\n' + body + "</source>"
```

`week13-rag/tests/test_registry_real.py#L26-L31`:
```python
def test_real_corpus_two_pass_is_byte_identical():
    e1, ctx1, e2, ctx2, _ = _two_pass(SNAPSHOT)
    assert ctx1 == ctx2
    assert [x["content_sha256"] for x in e1] == [x["content_sha256"] for x in e2]
    assert content_sha256(ctx1) == content_sha256(ctx2)
```

The first snippet is at <https://github.com/NiceFreak/nodejs-skillup/blob/5cb9378/week13-rag/src/w13rag/serialize.py#L76-L91>. The second is at <https://github.com/NiceFreak/nodejs-skillup/blob/5cb9378/week13-rag/tests/test_registry_real.py#L26-L31>. Both snippets were checked against commit `5cb9378` with local `git show`; commit `5cb9378` is an ancestor of local `origin/main`. Link reachability was not externally verified per the report protocol.

Technical Capability Matrix

Criterion: Deterministically rebuild the retrieval data flow
Target or Threshold: No quantitative threshold frozen
Observed Evidence: Parser + citation registry + Evidence Context implement the frozen contract; 9 tests pass; real corpus builds 572 entries, two-pass byte-identical, with a frozen whole-string baseline `8a02c665...`
Status: Partially Met
Gap or Next Verification: Serialized input metering and the full-context dev baseline have not run yet; retrieval (BM25/dense) is not built

Criterion: Attribute a failing question across retrieval, context assembly, prompt, or generation
Target or Threshold: No quantitative threshold frozen
Observed Evidence: No model request or baseline run has occurred; failure attribution is therefore not exercised on D3
Status: Not Evaluated
Gap or Next Verification: Run the dev baseline, then trace each failure to retrieval, context assembly, prompt, or generation before touching retrieval options
