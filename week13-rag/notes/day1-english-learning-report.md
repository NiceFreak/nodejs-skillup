Subject: Daily AI Engineering Learning Summary - 2026-09-07 - RAG Corpus and Token Accounting

Evidence captured as of 2026-09-07 19:28 Asia/Shanghai

Learning Status: Completed

Completed outcomes are reported below. Items under Next Step are planned follow-through and are not represented as already executed.

Summary

Today I completed the first evidence-backed stage of Week 13's Retrieval-Augmented Generation work. I froze the rules corpus before creating evaluation questions, produced a validated offline token estimate, and fixed the generation configuration for later full-context, BM25, and dense comparisons. I also clarified the boundaries among corpus versioning, context capacity, model output, citations, and evaluation.

Learning Outcomes and Evidence

I froze an explicit seven-file corpus from source commit `c0a4b85c9065cbfb943584c914172d7819339791`. The snapshot contains 7 files and 76,149 bytes. Its manifest records source and snapshot paths, byte counts, SHA-256 digests, and Git blob identifiers. All 7 files matched the selected commit byte-for-byte, and the strong-pattern sensitive-content scan returned no matches. This proves that the experiment input is fixed and traceable; it does not prove retrieval or answer quality.

Using DeepSeek's published tokenizer artifact with Python 3.12.10, `transformers 4.57.6`, and `tokenizers 0.22.2`, I estimated the raw document bodies at 18,680 tokens. The official smoke input and all 7 document round trips passed. I rejected an earlier 3,800-token result from newer library versions because Chinese text and English spaces were lost during tokenization.

The accepted count remains an estimate. It excludes citation labels, separators, instructions, query text, message-rendering overhead, reserved output, and safety margin. A real request's provider-reported `usage` will remain separate runtime evidence.

I fixed the later comparison configuration as DeepSeek Chat Completions with `deepseek-v4-flash` and thinking disabled. The client must still explicitly send and verify `thinking: disabled` before the baseline runs.

Technical Understanding

I can now distinguish a corpus from a versioned corpus snapshot: the corpus defines the allowed documents, while the snapshot binds them to immutable content and provenance. Freezing it before the evaluation set prevents questions from influencing corpus selection.

I can also distinguish the context window, request occupancy, and context budget. A corpus-only estimate cannot prove that the assembled request fits because instructions, query text, serialized source identifiers, rendering overhead, output capacity, and safety margin also consume or reserve capacity.

For citations, I selected claim-level association. Each factual claim should reference one or more controlled identifiers that resolve to a frozen document and source span. The model may return an answer or abstention with citations, but application-side evaluation must independently check syntax, schema validity, and semantic correctness.

Issues, Decisions, and Remaining Boundaries

The dev/holdout split, evaluation contract, context budget, exact response schema, RAG Prompt, and source-span granularity are not yet frozen. No full-context baseline request has run, so there is no provider `usage`, latency, generated answer, citation result, or abstention result. Today's evidence therefore does not establish baseline quality, retrieval quality, production necessity for RAG, or end-to-end RAG completion.

Next Step

I will freeze the output envelope, context budget, dev/holdout boundary, evaluation contract, response schema, citation locator, and RAG Prompt. After verifying non-thinking mode in the client, I will run the full-context baseline on the frozen dev set and preserve each input, raw response, evaluation result, model and Prompt version, `finish_reason`, provider `usage`, and latency.

Technical Capability Matrix

Criterion: Explain the responsibility boundary from ingestion through retrieval, context, generation, and evaluation
Target or Threshold: No quantitative threshold frozen
Observed Evidence: Corpus versioning, context inputs, model output, citations, and evaluation responsibilities were separated; retrieval and generation have not yet run.
Status: Partially Met
Gap or Next Verification: Run the full-context baseline, then implement and explain retrieval on the same frozen inputs.

Criterion: Deterministically rebuild the retrieval data flow
Target or Threshold: No quantitative threshold frozen
Observed Evidence: The corpus snapshot and token evidence are reproducible, but retrieval, chunking, ranking, and context assembly were intentionally not implemented on D1.
Status: Not Evaluated
Gap or Next Verification: Build and later reconstruct the BM25 ingestion-to-retrieval path from the frozen corpus and evaluation contract.
