# W13 D5 English Speaking Practice

## Topic

Moving dense retrieval onto LangChain while keeping the project contract

## Speaking Script

On day five I moved my dense retrieval onto LangChain's Embeddings and VectorStore interfaces. I wrote an adapter that turns a text block into a vector, and a store that finds the nearest neighbors. The framework only does two jobs: text to vector, and nearest-neighbor search. Everything else — how blocks are split, source identity, ranking, ties, and the pass criteria — stays in my own contract. To make sure the rewrite did not change behavior, I compared the new path against the old one on ten dev queries. The top ten results matched in both order and set, with a score difference below eight times ten to the minus eight. I also fixed one tie rule: when two scores differ by less than one in a million, I treat them as the same rank. The limit is clear: matching behavior proves equivalence, not answer quality.

## Speaking Check

- Word count: 144 words
- Estimated speaking time: about 60-66 seconds at 130-145 words per minute
- Tone check: conversational engineering explanation with one explicit evidence boundary
