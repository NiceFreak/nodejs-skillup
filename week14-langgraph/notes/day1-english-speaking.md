# W14 D1 英语口语稿：如何更有效地开发 RAG 工具

→ Topic
Building a RAG tool effectively — lessons from a week of mistakes.

→ Speaking Script

Last week I built a RAG tool and made a classic mistake: I designed the components before deciding what the system was for. I froze corpus, chunking, retrieval, and evaluation one by one, and only later asked what the whole thing should do. When it failed, I could not tell which layer caused it.

The fix is to start with a contract. Freeze the target task, the minimal behavior, and the run shape first. Then work in parallel tracks: corpus and evaluation, the core retrieval pipeline, integration, and observability, each with its own baseline and threshold. Start with BM25 as a minimal baseline, and only add dense or hybrid retrieval when a comparison supports it. Freeze thresholds before evaluation, not after.

Finally, keep structure, identity, and semantics as separate layers. A status of ok only proves the pipeline ran. It does not prove answer quality.

→ Speaking Check
- 词数：145 词（120–150 区间内）
- 预计时长：约 1 分钟（按 135–145 词/分钟）
- 口语感检查：三段式（问题 → 契约先行 → 分层判据），像工程复盘而非背书；无堆砌术语。
- 必要发音：无特殊生词，注意 "observability" /əbˌzɜːrvəˈbɪləti/ 与 "semantics" /sɪˈmæntɪks/ 的重音位置。
