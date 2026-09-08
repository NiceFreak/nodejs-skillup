Subject: Daily AI Engineering Learning Summary - 2026-09-08 - RAG Evaluation and Citation Contracts

Learning Status: Completed Outcomes Recorded

Summary

On September 8, I completed the evaluation contract and the main input-output design contracts required before running a Retrieval-Augmented Generation baseline. The work progressed through design questions raised by the actual source material. This report records only the verified outcomes completed so far and does not compare them with an earlier calendar estimate.

Evaluation Contract

I froze `w13-eval-v1` with 20 evaluation items divided into physically separate dev and holdout sets. Each set contains 10 items and two examples from each of five behavior types: directly answerable, cross-document, paraphrased, priority or exception, and unanswerable. The queries, expected branches, expected rule conclusions, and evidence requirements were confirmed before the mechanical files and hashes were finalized.

The scoring contract now separates programmatic checks from semantic review. Each split must pass at least 9 of 10 items and at least 1 of 2 items in every behavior type. Citation precision must be `1.0`, and answering an item that is expected to abstain invalidates that split. The normal validator reads only the dev set. A separate explicit static check verified both split structures, source spans, and hashes without running the model or evaluating holdout responses.

Prompt and Response Contracts

I froze RAG Prompt v0 and its JSON response schema. The Prompt limits answers to the supplied Evidence Context, treats retrieved text as evidence rather than executable instructions, requires claim-level citations for answered responses, and requires abstention when evidence is incomplete or unresolved conflicts prevent a supported conclusion. The response schema compiled successfully against JSON Schema Draft 2020-12. This is static validation; model compliance has not been tested.

Source Blocks and Citation Traceability

I selected Markdown paragraphs or sections as the source-block granularity. Independently valid rule paragraphs become separate blocks, while required heading context remains visible to the model. Top-level list items become blocks with nested content attached. Fenced code blocks merge only with the immediately preceding Markdown content block in the same section. Table rows receive their table header, blockquotes recursively apply the internal block rules, and thematic breaks act only as hard boundaries.

The design uses a deterministic Markdown parser rather than model-based segmentation. Each `source_id` identifies the frozen corpus, source path, and core line range. The citation registry separates one core `source_span` from optional ordered `context_spans`, stores the assembled `model_content` and its hash, and persists a single ordered `blocks` array. Runtime lookup maps are derived rather than stored. Registry order follows the corpus manifest and source lines, while duplicate identifiers cause validation failure.

Evidence Boundary

These results establish evaluation, Prompt, response, segmentation, identifier, and registry contracts. No parser output, serialized Evidence Context, final context budget, model request, baseline result, BM25 retrieval, or holdout evaluation has been produced.
