# W14 D2 英语口语稿：LangChain 与 LangGraph 的职责分界

→ Topic
LangChain vs LangGraph — why a hard-coded chain is not enough.

→ Speaking Script

Last week I built a RAG pipeline with LangChain, and this week I am adding LangGraph. I first thought of them as competing frameworks, but they are two layers of one ecosystem. LangChain gives you components and a fixed chain, where A always goes to B. LangGraph gives you state and control flow, where the next step depends on the current state.

The core idea is a graph with three pieces. A node reads the state and returns a partial update. A conditional edge reads the state and returns the next node's name. The compiled graph merges those updates and schedules the next node until the end.

I checked this with a small deterministic example: one query went to answer, an empty query went to abstain. This separation lets an agent choose the next step dynamically instead of a fixed chain.

→ Speaking Check
- 词数：约 137 词（120–150 区间内）
- 预计时长：约 1 分钟（按 135–145 词/分钟）
- 口语感检查：三段式（为什么需要 → 三个角色 → 验证），像工程沟通而非背书；无堆砌术语。
- 必要发音：conditional edge /kənˈdɪʃənl edʒ/、compiled graph /kəmˈpaɪld ɡræf/。
