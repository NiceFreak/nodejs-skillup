# W10 Day 1 English Speaking

> 2026-08-17 · Observability contract freeze day

## Topic

Why structured logs + a request id make a single-process API diagnosable.

## Speaking Script

In my current project, I'm making the Node.js API more observable. The big shift was moving from plain console.log lines to structured JSON logs. The reason isn't cosmetics — it's whether you can filter by field. With a plain log, answering "what were the slowest 5xx responses yesterday" means writing a regex and scanning by eye. With JSON, it's one query on a field.

The second piece is a request id. Nginx generates one per request, passes it to Node through a header, and we write it back in the response. Now when a user reports a failure, they can give us that id, and we can trace the same request across both Nginx and Node logs.

A practical constraint: we keep logs on stdout, so journald handles rotation. We only had to cap its size.

## Speaking Check

- **词数**：135 词（目标 120–150）
- **预计时长**：约 1 分钟（约 135–140 词/分钟）
- **口语感检查**：句子短、有连接词（so / now / with a plain log）、无背诵感；用「we / us」有协作口吻。
- **必要发音**：
  - `structured`（/ˈstrʌktʃəd/）——重音在第一个音节
  - `observable`（/əbˈzɜːrvəbl/）——重音在第二音节
  - `journald`——读作「journal-dee」
  - `regex`（/ˈredʒeks/）——重音第一音节
- **事实支撑**：结构化 = D1 Q1/Q2（字段可过滤）；关联 id = D1 Q4（Nginx `$request_id` → Node header → 响应头回写）；journald 轮转 = D1 Q2③（`SystemMaxUse=500M`）。全部有当天契约笔记与只读采集基线（journald 248M）支持。