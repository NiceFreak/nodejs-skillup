# W13 D2 English Speaking Practice

## Topic

Freezing an evaluation and citation contract before model runs

## Speaking Script

On the second day of my RAG study, I froze the evaluation contract before running any model calls. It contains 20 questions, split into 10 dev and 10 holdout items, with five behavior types represented twice in each set. Every item records the expected answer or abstention, expected conclusion, and required source evidence. I also separated mechanical checks from semantic review. Code can validate JSON, identifiers, context membership, and counts, while a reviewer must decide whether a citation really supports a claim. To make that possible, I designed source blocks around Markdown rule paragraphs, with necessary headings or table headers preserved as context. Each block gets an identifier tied to the frozen file and core line range. The important point is that a valid citation identifier proves traceability, not correctness. No model or holdout run happened, so the result is a reproducible contract, not a quality score.

## Speaking Check

- Word count: 147 words
- Estimated speaking time: about 61-68 seconds at 130-145 words per minute
- Tone check: conversational explanation of evaluation and citation responsibilities
