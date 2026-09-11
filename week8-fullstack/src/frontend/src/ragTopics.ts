import type { AeBase } from "./aiEngineerTopics";

export interface AeRagTopic extends AeBase {
  kind: "rag";
  id: "rag-roadmap" | "rag-flow" | "rag-implementation" | "rag-evidence" | "rag-eval" | "rag-framework";
}

const common = { kind: "rag" as const, group: "RAG 成果" as const, evidenceKind: "混合" as const,
  source: "最近一次实现与开发运行记录（2026-09-10–09-11）",
  sources: [
    { label: "实现与证据边界（2026-09-10 运行记录）", ref: "week13-rag/notes/day4-full-context-baseline-and-bm25.md" },
    { label: "冻结输入与检索职责（源码）", ref: "week13-rag/src/w13rag/{retrieval,generation,scoring}.py" },
  ] };

export const RAG_TOPICS: AeRagTopic[] = [
  { ...common, id: "rag-roadmap", label: "整体路线", title: "RAG 能力总览", question: "已建立哪些能力，后续能力如何承接？",
    anchor: "RAG（检索增强生成）：先找相关资料，再根据资料作答。", boundary: "实线表示功能已实现或已运行；检索和完整回答的质量仍未通过。LangGraph 编排是后续实践，尚未实施。",
    memory: "可追溯资料支撑检索与回答，评估检查结果，后续编排复用这些能力。", accept: "从能力图指出输入、检索、回答与评估的依赖，以及状态编排尚未实施；点击节点进入对应功能专题。" },
  { ...common, id: "rag-flow", label: "链路", title: "固定 RAG 链路", question: "当前系统如何从冻结语料走到回答？",
    anchor: "两种上下文输入，共用组装、生成与引用校验。", boundary: "固定开发链路已运行；通过条件未满足。全量与检索路径的对照保留同一来源和输出契约。",
    memory: "全量与检索两支汇合到证据上下文（Evidence Context）。", accept: "指出 full-context 与 retrieval 的分叉和汇合，并说明引用注册表校验引用能否解析的职责。" },
  { ...common, id: "rag-implementation", label: "实现理由", title: "为什么这样实现", question: "实现如何同时保留可追溯性、替换能力和评估边界？",
    source: "RAG 全链路代码导读 · 2026-09-11", sourceTarget: { noteId: "w13ragguide", section: "1" },
    sources: [{ label: "完整代码解读（笔记）", ref: "week13-rag/notes/rag-implementation-guide.md", target: { noteId: "w13ragguide", section: "1" } }],
    anchor: "来源身份贯穿链路；检索、生成与评估分别承担职责。", boundary: "这是现有代码职责。当前语料解析有明确范围；预算裁剪未实现，框架迁移与生产适用性仍需验证。",
    memory: "来源身份穿过可替换组件，最后回到独立评估。", accept: "沿泳道说明输入输出与每个边界的理由，指出哪些契约在换检索器后仍保持。" },
  { ...common, id: "rag-evidence", label: "证据回放", title: "回答与证据回放", question: "回答里的 citation 如何定位到冻结原文？",
    anchor: "从回答点击引用，回到同一版本的原文行。", boundary: "2026-09-10 历史开发评测回放；页面不发起模型调用。BM25 端到端那一轮经本人批准，只验证链路能跑通，人工判定已完成且未通过；分支一致与引用可解析不能替代原文支持。",
    memory: "回答 → citation → 原文行。", accept: "展开一个真实 citation 回到原文，并区分按预期拒答与 false abstention。" },
  { ...common, id: "rag-eval", label: "检索对照", title: "检索与输入规模", question: "已有对照数据支持什么结论？",
    anchor: "检索在相同 8 题上比较；输入规模单独衡量。", boundary: "检索是否命中，按题目要求的证据范围与检索到的片段有没有重叠判定；两道无答案题不适用。输入 token 下降不代表质量提升或总费用下降。",
    memory: "九条检索结果共用 8 题基线；输入 token 使用独立基线。", accept: "按 8 题解释检索通过数；按 10 题解释输入总量，不将两种指标当作质量排名。" },
  { ...common, id: "rag-framework", label: "框架衔接", title: "框架职责映射", question: "现有经验怎样衔接 LangChain 与 LangGraph？",
    source: "LangChain dense 接线与等价性验证（2026-09-11）",
    sources: [{ label: "dense 接线冻结记录", ref: "week13-rag/notes/dense-langchain-wiring-freeze.md" }],
    anchor: "LangChain 已承接 Document、BM25 与 dense 的 Embeddings + 向量库；LangGraph 编排留待后续实践。",
    boundary: "Dense 向量来自冻结的 e5 ONNX 缓存（按模型与参数组合校验缓存身份），检索经 InMemoryVectorStore 向量库，排序仍由本项目显式完成；生成复用此前阶段的模型客户端，尚未使用 LCEL。LangGraph 图为后续映射，尚未实施。",
    memory: "实线当前职责，虚线未来状态与条件边。", accept: "指出 LangChain 已用接口、自定义契约职责，以及 LangGraph 尚未实施的状态与条件边。" },
];
