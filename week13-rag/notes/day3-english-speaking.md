# W13 D3 English Speaking Practice

## Topic

Freezing a deterministic serialization contract before the RAG baseline

## Speaking Script

On day three of my RAG work, I made the model input deterministic before running any baseline. The same source block can be serialized in many ways, so two runs could silently differ if spacing, wrappers, or block order were not fixed. I froze a serialization contract and implemented it with a deterministic parser plus a citation registry. Each block becomes one source wrapper carrying a source ID to a frozen line range, with the exact text the model will see. I also separated position identity from content fingerprint: the source ID tells where a rule lives, while a hash over the model text tells whether the content changed. Two builds on the real corpus produced 572 blocks with byte-identical output, and the whole-string hash is now frozen as a regression baseline. The limit is clear: this proves reproducible input, not answer quality. Retrieval and the baseline still come next.

## Speaking Check

- Word count: 150 words
- Estimated speaking time: about 62-69 seconds at 130-145 words per minute
- Tone check: conversational explanation of a deterministic context-assembly layer with an explicit evidence boundary
- Pronunciation: "byte-identical" stress on "identical"; "citation registry" spoken clearly at normal speed
