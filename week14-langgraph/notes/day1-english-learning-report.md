# W14 D1 英文学习成果报告

Subject: Daily AI Engineering Learning Summary - 2026-09-14 - RAG retro and production workflow

Evidence captured as of 2026-09-14 Asia/Shanghai

Summary

Today was a consolidation day. I extracted the root causes behind last week's RAG work and reorganized them into a production-oriented workflow for building RAG tools. I also practiced articulating the fixed pipeline end to end in English.

Learning Outcomes and Evidence

I consolidated W13's pitfalls into five categories, each with phenomenon, root cause, consequence, and the correct approach: missing anchor (components designed before the system's purpose was fixed), unfrozen thresholds collapsed into a single boolean, variable stacking without proving necessity, baselines that ran without binding to a decision, and boundary confusion (runnable does not equal quality). I then reorganized these into a reusable workflow: a stage-0 contract, four parallel tracks (corpus/eval, core RAG, integration, observability), and three release gates (core quality, run shape, production).

Technical Understanding

A RAG project should start by freezing the target task, minimal behavior, and run shape, not by designing components. A baseline must answer a decision, and thresholds must be frozen before the formal evaluation. Structure, identity, and semantics are separate layers; a status of ok proves the pipeline ran, not that the answer is good.

Issues, Decisions, and Remaining Boundaries

Last week's full-context, BM25, dense, and hybrid numbers remain historical experiments, not production quality claims. Backend API, session persistence, production trace, and Agent/tool integration are still not implemented. The quiz demo and the learning-note corpus view still need the owner to freeze their contracts. All of this stays in the notes as open boundaries, not rewritten as completed work.

Next Step

Freeze the non-Agent baseline and the W14 control-layer contract, then decide whether LangGraph wiring is actually needed.
