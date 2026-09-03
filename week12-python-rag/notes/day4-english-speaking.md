# W12 D4（9/3 周四）English Speaking

## Topic

Why cancellation cleanup in Python asyncio splits into two layers — and what I had to unlearn from Node.js.

## Speaking Script

When you cancel an in-flight request in Python, two kinds of cleanup run, and they are not the same. I verified this with a deliberately slow local server. After I called `task.cancel()`, `CancelledError` was injected at the innermost `await` inside the HTTP client. Here is the interesting part: the client library closed the TCP connection before my own `finally` block even finished — the server saw the FIN within a millisecond, while my cleanup still had a hundred milliseconds to go. So the library owns connection-level cleanup, and my `finally` and `async with` own my own state, like persisting a session. They are independent layers. One thing I had to unlearn from Node: JavaScript has no direct equivalent, because promises cannot be cancelled. This structured-cancellation pattern only exists in Python.

## Speaking Check

- 词数：约 141（目标 120–150）。
- 预计时长：约 62–65 秒（按 130–145 词/分钟）。
- 口语感检查：第一人称、有具体实验证据（慢服务器、FIN 时间、finally 剩余时长），非论文语气。
- 技术准确性：全部内容有 D4 day4 笔记 §11 C-2 支撑（本地 slow server、cancel 后 1ms FIN 早于 finally 完成、httpx 内部关连接、业务层管状态清理；Node 无 Promise 取消语义）。
- 必要发音：`CancelledError`（/ˈkænsəld ˈerər/）、`FIN`（读 F-I-N）、`asyncio`（/əˈsɪŋki.oʊ/）。
