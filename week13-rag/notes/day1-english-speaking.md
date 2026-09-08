# W13 D1 English Speaking Practice

## Topic

Freezing a RAG corpus before evaluation

## Speaking Script

On the first day of my RAG study, I focused on creating a reliable experiment input. I selected seven rule documents and froze an exact snapshot from one Git commit. The manifest records paths, sizes, SHA-256 hashes, and Git blob identifiers, so later retrieval experiments can use the same content. I also measured the raw document bodies with DeepSeek's tokenizer and got an estimate of 18,680 tokens. I learned why this number is only a starting point: the actual request also includes the Prompt, source labels, query, formatting overhead, and reserved output space. The key lesson is that corpus size and context budget are different. A corpus snapshot makes the input reproducible, while the context budget determines whether the assembled request can fit. I did not run a baseline, so these checks prove traceability and approximate input size, not answer quality.

## Speaking Check

- Word count: 141 words
- Estimated speaking time: about 58-65 seconds at 130-145 words per minute
- Tone check: conversational engineering explanation with one evidence boundary
