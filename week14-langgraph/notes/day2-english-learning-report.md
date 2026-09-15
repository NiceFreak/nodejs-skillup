# W14 D2 英文学习成果报告

Subject: Daily AI Engineering Learning Summary - 2026-09-15 - LangChain vs LangGraph responsibility boundary

Evidence captured as of 2026-09-15 Asia/Shanghai

Summary

Today I clarified the boundary between LangChain and LangGraph, which had stayed blurred since last week. They are not two competing frameworks but two layers of one ecosystem sharing langchain-core. I ran a minimal deterministic StateGraph and verified the responsibilities of State, node, conditional edge, and CompiledGraph.

Learning Outcomes and Evidence

I built a minimal StateGraph with no model and no retrieval, then ran two branches. A query of "有证据的问题" ended with branch=answer; an empty query ended with branch=abstain. The final state is accumulated from three partial updates: the initial query, has_evidence returned by the retrieve node, and branch returned by answer or abstain. I also restated the responsibility line using type signatures. Environment: langgraph 1.2.11, langchain-core 1.6.2, langchain-community 0.4.2, reusing the W13 venv.

Technical Understanding

LangChain provides components and a fixed chain; LangGraph provides state and control flow. Because both share langchain-core, LangGraph nodes can reuse LangChain components. Dependency is not ownership: BM25Retriever imports the BaseRetriever interface from langchain-core but lives in langchain-community, so the reliable criterion is the top-level package name in the import path. In the graph, a node computes and returns a partial update, a conditional edge returns only the next node name, and CompiledGraph merges updates and schedules nodes until END.

Issues, Decisions, and Remaining Boundaries

The demo is deterministic and calls no model or retrieval, so it proves the control-flow mechanism only, not RAG quality. The task contract, baseline, trace/verifier contract, and real RAG integration are deferred to D3; w13-eval-debt-rebuild-01 is also not done. AGENTS.md now includes a rule requiring AI to verify checkable facts against official sources and to label whether network resources were consulted.

Next Step

From D3: first do the w13-eval debt rebuild, then freeze the task contract, baseline, and trace/verifier, and finally wire the real retrieve/generate/verify nodes into the graph.

Code Evidence

- `week14-langgraph/scripts/minimal_state_graph.py` — `retrieve` and `route` show the separation: the node returns a partial update, the conditional edge returns only the next node name. Local evidence; no public link available.

```python
def retrieve(state):
    return {"has_evidence": bool(state["query"].strip())}

def route(state):
    return "answer" if state["has_evidence"] else "abstain"
```

Technical Capability Matrix

Criterion: Distinguish LangChain (components + fixed chain) from LangGraph (state + control flow), and explain the responsibilities of State, node, conditional edge, and CompiledGraph.
Target or Threshold: No quantitative threshold frozen
Observed Evidence: Owner restated the responsibility line with type signatures (node: State -> Partial<State>; conditional edge: State -> NodeName). Minimal StateGraph ran two branches with branch=answer and branch=abstain.
Status: Met
Gap or Next Verification: Real RAG retrieve/generate/verify nodes, tool, termination, and trace/verifier are not yet wired (deferred to D3).
