# W12 D3（9/2 周三）English Speaking

## Topic

Why one user "turn" in an agent runtime is not the same as one model "step" — and how persistence is kept separate.

## Speaking Script

In Bub, an agent runtime written in Python, I learned a key mental model: one user turn is not one model call. A turn starts when an inbound message arrives. Inside that turn, the agent loops over steps. Each step asks the model what to do next. If the model answers with tool calls, the runtime executes those tools and asks again. The loop only stops when the model answers with plain text and no tool calls. So the same hierarchy appears twice: a Web request maps to a turn, and each model round-trip is a step. Persistence is separate again. Every event is appended to an append-only tape, and the model's context is rebuilt from that tape before each step. Nothing is kept as hidden mutable session state. That separation between decision, execution, and recording is what I now look for first when reading any agent codebase.

## Speaking Check

- 词数：约 149（目标 120–150）。
- 预计时长：约 62–66 秒（按 130–145 词/分钟）。
- 口语感检查：第一人称学习叙述、带可迁移的读码方法（先找 decision/execution/recording 三层），非论文语气。
- 技术准确性：全部内容有 D3 day3 笔记与 `bub-reading-report.md` §0/§2/§5 支撑（turn 是 framework 层边界、step 是 turn 内循环、模型出 tool_calls 就继续否则停、tape append-only、context 每 step 现算重建）。
- 必要发音：`turn`（/tɜːrn/）、`step`（/step/）、`tape`（/teɪp/）、`append-only`（/əˈpend ˈoʊnli/）。
