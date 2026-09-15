"""W14 D2 最小 StateGraph demo：验证 State / node / conditional edge / CompiledGraph 的职责分离。

确定性、不调模型、不检索。教学性质，不进入 W14 正式 task contract。
运行：week13-rag/.venv/bin/python week14-langgraph/scripts/minimal_state_graph.py
"""
from typing import TypedDict

from langgraph.graph import StateGraph, END


class State(TypedDict):
    query: str
    has_evidence: bool
    branch: str


def retrieve(state: State) -> dict:
    # node：只计算，返回 partial update（引擎合并）
    return {"has_evidence": bool(state["query"].strip())}


def route(state: State) -> str:
    # conditional edge：只根据 state 返回下一个节点名
    return "answer" if state["has_evidence"] else "abstain"


def answer(state: State) -> dict:
    return {"branch": "answer"}


def abstain(state: State) -> dict:
    return {"branch": "abstain"}


def build_graph():
    g = StateGraph(State)
    g.add_node("retrieve", retrieve)
    g.add_node("answer", answer)
    g.add_node("abstain", abstain)
    g.set_entry_point("retrieve")
    g.add_conditional_edges("retrieve", route, {"answer": "answer", "abstain": "abstain"})
    g.add_edge("answer", END)
    g.add_edge("abstain", END)
    return g.compile()


if __name__ == "__main__":
    app = build_graph()
    print("有证据 =>", app.invoke({"query": "有证据的问题"}))
    print("无证据 =>", app.invoke({"query": ""}))
