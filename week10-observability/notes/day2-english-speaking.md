# W10 D2 技术英语口语稿（2026-08-18）

## Topic

Request correlation IDs and secret redaction in structured logging.

## Speaking Script

Today I wired structured logging into our Express app on the production server. The key idea is that every request now carries a request ID. Nginx generates it, passes it to Node as a header, and we echo it back in the response header. That one ID lets us join the Nginx access log and the Node application log for the same request — when a user reports a timeout, I can find both sides with one grep.

We also enforce redaction at two levels. First, the middleware simply never records the request body. Second, pino's redact config backs that up if a sensitive field ever sneaks in. We verified it with a real login request — the password string does not appear in any log stream.

One caveat: Nginx timestamps carry a +08:00 offset while Node logs use UTC. We deliberately keep them separate but write the conversion into the runbook.

## Speaking Check

- 词数：约 140 词（在 120–150 内）。
- 预计时长：约 1 分钟（按 130–145 词/分钟）。
- 口语感：对话式，非逐段复述笔记；术语保留（request ID / redact / runbook）。
- 准确性：所有事实均出自今天验证证据——Nginx 生成 id、header 传递、响应头回写、两条流各 1 条；脱敏双 0 命中；时间戳 +08:00 vs UTC 已写 runbook（P2 拍板）。推断与限制有区分（「deliberately keep them separate」）。
- 必要发音：`pino`（/ˈpiːnoʊ/）、`redact`（/rɪˈdækt/）、`runbook`。