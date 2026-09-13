import type { AeBase } from "./aiEngineerTopics";

export interface AeRagTopic extends AeBase {
  kind: "rag";
  status: "current";
  id: "rag-build" | "rag-corpus" | "rag-retrieval" | "rag-context" | "rag-generation" | "rag-citation";
}

const source = "technical-v2 · technical-9c6e6549b991";
const common = { kind: "rag" as const, group: "RAG 成果" as const, status: "current" as const, evidenceKind: "混合" as const, source };

export const RAG_TOPICS: AeRagTopic[] = [
  { ...common, id: "rag-build", label: "主链总览", title: "RAG 主链 · 从问题到可回查回答", question: "一个问题怎样经过当前 technical-v2 固定链路？", anchor: "先准备可定位的来源，再检索、组装实际模型输入，最后解析响应并单独评估引用。", boundary: "当前端到端生成接入 BM25；dense 与 RRF 是检索对照。LangGraph 状态、重试和终止 runtime 尚未实现。", memory: "source_id 从 registry 贯穿到 context 和 citation。", accept: "沿一条案例说出输入、输出和两个首次失败位置。", sources: [{ label: "technical-v2 manifest", ref: "week13-rag/corpus/technical-v2/manifest.json" }, { label: "生成入口", ref: "week13-rag/scripts/run-technical-v2-langchain-e2e.py" }] },
  { ...common, id: "rag-corpus", label: "语料与身份", title: "语料与来源身份 · 原文怎样变成 source block", question: "怎样保证检索结果和引用回到同一版原文？", anchor: "原文行先被切成带位置的 source block，再登记为可检索 Document；内容、位置和身份各自可核对。", boundary: "当前 snapshot 收录 11 个文件、1502 个 source blocks；hash 用于记录与复核，不作为模型正文。", memory: "身份字段解决‘指向哪里’，正文解决‘模型看到了什么’。", accept: "指出 source_id、source_span、model_content 和 hash 各自的职责。", sources: [{ label: "technical-v2 manifest", ref: "week13-rag/corpus/technical-v2/manifest.json" }, { label: "registry 与序列化", ref: "week13-rag/src/w13rag/{registry,serialize}.py" }] },
  { ...common, id: "rag-retrieval", label: "检索与排序", title: "检索与排序 · 三种检索器如何对齐", question: "BM25、dense、RRF 各自返回什么，项目代码还负责什么？", anchor: "LangChain 提供检索接口；项目代码读取分数、稳定排序、去重，并统一成 RetrievalHit。", boundary: "technical-v2 的 3 个适用题在 BM25、dense、RRF 检索对照中均为 3/3；只有 BM25 接入当前生成入口。", memory: "检索器可替换，RetrievalHit 和 source identity 契约保持。", accept: "解释三路排名和项目层稳定排序的分工，不把检索命中当作回答质量。", sources: [{ label: "检索对照入口", ref: "week13-rag/scripts/run-technical-v2-retrieval.py" }, { label: "排序实现", ref: "week13-rag/src/w13rag/retrieval.py" }] },
  { ...common, id: "rag-context", label: "Context 组装", title: "Context 组装 · 候选怎样变成模型输入", question: "哪些检索结果真正进入了模型？", anchor: "RetrievalHit 只是候选；按 source_id 回 registry 取正文，加入 source wrapper 后才形成 Evidence Context。", boundary: "当前主链保留命中的完整 block；预算裁剪仅在独立 fixture 函数中观察过，尚未接入主链。", memory: "候选列表、Evidence Context 和实际 messages 是三个不同对象。", accept: "区分候选、实际上下文、模型 messages，以及 hash 的记录职责。", sources: [{ label: "Context 组装", ref: "week13-rag/src/w13rag/retrieval.py" }, { label: "消息组装", ref: "week13-rag/src/w13rag/generation.py" }] },
  { ...common, id: "rag-generation", label: "生成与解析", title: "生成、解析与分支 · 首次失败在哪里停止", question: "一次模型请求如何变成 answered、abstained 或结构错误？", anchor: "请求返回原始文本后，解析层依次区分空响应、JSON、schema 和已解析分支；answered/abstained 来自模型输出。", boundary: "当前复用现有 HTTP 模型客户端，没有 LangChain ChatModel/LCEL，也没有自动重试状态机。", memory: "解析器检查响应，评估器分析响应；评估器不会把坏回答改写成拒答。", accept: "把 transport、JSON、schema 和语义失败放在各自的首次失败点。", sources: [{ label: "生成与解析", ref: "week13-rag/src/w13rag/generation.py" }, { label: "technical-v2 运行入口", ref: "week13-rag/scripts/run-technical-v2-langchain-e2e.py" }] },
  { ...common, id: "rag-citation", label: "引用与评估", title: "引用与评估 · 找得到来源仍不等于被原文支持", question: "怎样把一个 claim 追到实际 context 和冻结原文？", anchor: "citation resolution、context membership、claim support 和 evidence coverage 分层检查，不合并成单一质量分数。", boundary: "generation-04 的四个模型案例已有独立语义签认；最新 generation-05 不能自动继承旧运行结论。四模型与六 fixture 也不能合并为 4/10 质量分数。", memory: "可解析是身份检查；原文支持是语义判断。", accept: "从 claim 点击到 source span，并说明程序检查与语义判断的边界。", sources: [{ label: "语义签认", ref: "week13-rag/evidence/technical/technical-v2/semantic-verdict-01.json" }, { label: "评估实现", ref: "week13-rag/src/w13rag/scoring.py" }] },
];
