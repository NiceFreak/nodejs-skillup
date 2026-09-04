# W12 D5（9/4 周五）English Speaking

## Topic

How I diagnosed an asyncio resource-ownership bug in an unfamiliar Python file — and why the second-request symptom was misleading at first.

## Speaking Script

I was given a small Python fetcher that reuses one shared `httpx.AsyncClient` across requests, each with its own timeout. It crashed on the second request with `RuntimeError: Cannot send a request, as the client has been closed`. The lesson is about ownership. The client was created in `run()`, which also closes it, but `fetch_one` — the function that only borrows it — closed it again in a `finally` after the first success. So the second request found the client dead. Two details made this tricky. First, this error is not an `httpx.HTTPError`, so the existing `except` clauses never caught it. Second, the error appeared on the slow path, but it had nothing to do with timeout — any second request triggered it. The fix was deleting that `finally`, and I proved it by putting the close back and watching it fail again.

## Speaking Check

- 词数：139（目标 120–150）。
- 预计时长：约 58–63 秒（按 130–145 词/分钟）。
- 口语感检查：第一人称、具体症状与反证实验，非论文语气。
- 技术准确性：全部有 D5 day5 §5.2 支撑（共享 client 在 `fetch_one` finally 被关闭、RuntimeError 非 HTTPError 不被 except 接住、触发条件是第二次请求与超时无关、删除 finally + 反证加回必崩）。
- 必要发音：`asyncio`（/əˈsɪŋki.oʊ/）、`httpx`（读 H-T-T-P-X）、`finally`（/ˈfaɪnəli/）。

