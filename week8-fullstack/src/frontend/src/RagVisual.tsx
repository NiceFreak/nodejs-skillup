import { useState, type ReactNode } from "react";
import technicalV2 from "./ragTechnicalV2Data.json";
import type { AeRagTopic } from "./ragTopics";
import RagIcon from "./RagIcon";

const steps = [
  ["Query", "用户问题", "query"],
  ["Retrieve", "检索候选", "RetrievalHit[]"],
  ["Assemble", "组装上下文", "Evidence Context"],
  ["Generate", "模型响应", "raw response"],
  ["Parse", "解析分支", "RunRecord"],
  ["Evaluate", "独立评估", "verdict"],
] as const;

export default function RagVisual({ topic }: { topic: AeRagTopic }) {
  switch (topic.id) {
    case "rag-build": return <Build />;
    case "rag-corpus": return <Corpus />;
    case "rag-retrieval": return <Retrieval />;
    case "rag-context": return <Context />;
    case "rag-generation": return <Generation />;
    case "rag-citation": return <Citation />;
  }
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rag-visual rag-v2-panel ${className}`}>{children}</section>;
}

function Build() {
  const [selected, setSelected] = useState(0);
  return <Panel className="rag-build-v2" data-anchor="rag-build-sequence" aria-label="technical-v2 RAG 主链">
    <div className="rag-v2-lead"><RagIcon name="graph" /><div><b>先准备可定位的来源，再问一个问题</b><span>technical-v2 · {technicalV2.snapshot} · {technicalV2.files} 个文件 · {technicalV2.registryBlocks} 个 source blocks</span></div></div>
    <div className="rag-v2-flow" role="list" aria-label="RAG 固定链路">
      {steps.map(([short, title, output], index) => <button type="button" role="listitem" key={short} className={selected === index ? "active" : ""} onClick={() => setSelected(index)} aria-pressed={selected === index}><span>{index + 1}</span><b>{short}</b><small>{title}</small><em>{output}</em></button>)}
    </div>
    <div className="rag-v2-focus"><span>当前查看 · {steps[selected][0]}</span><h4>{steps[selected][1]}</h4><p>{[
      "输入 query；问题本身不带来源身份。",
      "检索器返回候选、分数和 source_id，项目层再稳定排序。",
      "按 source_id 回 registry 取正文，包装成模型可见的 Evidence Context。",
      "现有 HTTP 模型客户端收到 query、指令和 context，返回原始文本。",
      "解析层区分空响应、JSON、schema 与已解析分支。",
      "评估器读取已保存的响应，分别检查引用解析、context membership 和原文支持。",
    ][selected]}</p></div>
    <div className="rag-v2-split"><div><b>当前已接入</b><span>technical-v2 · BM25 端到端生成</span></div><div><b>检索对照</b><span>dense / RRF 只在 retrieval runner 中比较</span></div><div><b>后续边界</b><span>LangGraph state、retry、termination 尚未实现</span></div></div>
  </Panel>;
}

function Corpus() {
  const [field, setField] = useState("source_id");
  const fields: Record<string, string> = { source_id: "唯一身份：引用和检索结果共同指向它", source_span: "原文位置：文件、标题与行范围", model_content: "模型正文：实际放入 source wrapper 的文本", content_sha256: "内容校验：记录和复核正文是否变化" };
  return <Panel className="rag-corpus-v2" data-anchor="rag-corpus-identity" aria-label="语料解析与来源身份"><div className="rag-v2-lead"><RagIcon name="documents" /><div><b>内容和身份分开保存</b><span>technical-v2 manifest · 11 个文件 · 1502 个 source blocks</span></div></div><div className="rag-corpus-stack"><div><span>原文</span><code>Markdown · 文件 / 标题 / 行</code></div><i>↓</i><div><span>source block</span><code>source_id · source_span · model_content · sha256</code></div><i>↓</i><div><span>Document / registry</span><code>metadata 身份 + page_content 正文</code></div></div><div className="rag-field-picker">{Object.keys(fields).map((key) => <button type="button" className={field === key ? "active" : ""} key={key} onClick={() => setField(key)}>{key}</button>)}</div><p className="rag-v2-focus"><b>{field}</b><span>{fields[field]}</span></p></Panel>;
}

function Retrieval() {
  const [method, setMethod] = useState("BM25");
  const rows = [
    ["BM25", "词项匹配", "3/3", "已接入端到端生成"],
    ["Dense", "向量相似", "3/3", "检索对照"],
    ["RRF", "排名融合", "3/3", "检索对照"],
  ];
  return <Panel className="rag-retrieval-v2" data-anchor="rag-retrieval-ranking" aria-label="BM25 dense RRF 检索与排序"><div className="rag-v2-lead"><RagIcon name="search" /><div><b>框架检索，项目稳定排序</b><span>同一 technical-v2 的 3 个适用 source-span 题均命中要求来源</span></div></div><div className="rag-methods">{rows.map(([name, purpose, score, role]) => <button type="button" key={name} className={method === name ? "active" : ""} onClick={() => setMethod(name)}><strong>{name}</strong><span>{purpose}</span><b>{score}</b><small>{role}</small></button>)}</div><div className="rag-rank-demo"><div><span>检索器输出</span><code>{method} → score + source_id</code></div><b>→</b><div><span>项目层排序</span><code>score ↓ · registry_index ↑ · 去重</code></div><b>→</b><div><span>统一契约</span><code>RetrievalHit[]</code></div></div><p className="rag-v2-boundary">3/3 是检索命中观察，不是模型回答质量；dense 与 RRF 当前没有接入生成入口。</p></Panel>;
}

function Context() {
  const [budget, setBudget] = useState(false);
  const rows = budget ? [["命中 block A", "保留"], ["命中 block B", "移除 · fixture 预算观察"], ["命中 block C", "保留"]] : [["RetrievalHit", "候选：rank / score / source_id"], ["Registry entry", "回取：model_content + spans"], ["Messages", "实际模型输入：指令 + query + context"]];
  return <Panel className="rag-context-v2" data-anchor="rag-context-assembly" aria-label="Context assembly 对象边界"><div className="rag-v2-lead"><RagIcon name="documents" /><div><b>Hit 还不是模型输入</b><span>候选先回 registry，再组装带 source wrapper 的 Evidence Context</span></div></div><div className="rag-context-objects">{rows.map(([name, value]) => <div key={name}><b>{name}</b><span>{value}</span></div>)}</div><div className="rag-context-controls"><button type="button" onClick={() => setBudget(!budget)} aria-pressed={budget}>{budget ? "返回主链对象" : "查看独立预算 fixture"}</button><span>{budget ? "预算函数的保留/移除记录，不代表主链已启用预算" : "hash 只记录 context，可重算；不发送给模型"}</span></div></Panel>;
}

function Generation() {
  const [caseIndex, setCaseIndex] = useState(0);
  const [step, setStep] = useState(2);
  const cases = [
    ["正常响应", "messages → HTTP → JSON → schema → answered", "模型返回 answered 与 citation，随后交给 evaluator"],
    ["拒答响应", "messages → HTTP → JSON → schema → abstained", "abstained 是模型输出分支，不能由 evaluator 代生成"],
    ["结构错误", "messages → HTTP → JSON → schema_error", "解析首次失败后停止；不会伪装成语义拒答"],
  ];
  return <Panel className="rag-generation-v2" data-anchor="rag-generation-branch" aria-label="生成解析与分支"><div className="rag-v2-lead"><RagIcon name="answer" /><div><b>响应先解析，评估再判断</b><span>当前复用现有 HTTP 模型客户端；没有 ChatModel、LCEL 或自动重试状态机</span></div></div><div className="rag-case-tabs">{cases.map(([name], index) => <button type="button" key={name} className={caseIndex === index ? "active" : ""} onClick={() => { setCaseIndex(index); setStep(0); }}>{name}</button>)}</div><div className="rag-state-machine">{cases[caseIndex][1].split(" → ").map((label, index) => <button type="button" key={label} className={step === index ? "active" : ""} onClick={() => setStep(index)}><span>{index + 1}</span><b>{label}</b></button>)}</div><p className="rag-v2-focus"><b>{cases[caseIndex][0]}</b><span>{cases[caseIndex][2]}</span></p></Panel>;
}

function Citation() {
  const [claim, setClaim] = useState(0);
  const claims = [
    ["Claim", "citation identifier 能否解析？", "registry resolution", "程序检查"],
    ["Context", "这个 citation 是否真的出现在本题输入？", "context membership", "程序检查"],
    ["Support", "原文是否支持这个 claim？", "claim support + evidence coverage", "语义判断"],
  ];
  return <Panel className="rag-citation-v2" data-anchor="rag-citation-evaluation" aria-label="引用与评估分层"><div className="rag-v2-lead"><RagIcon name="citation" /><div><b>找得到来源，仍不等于原文支持结论</b><span>四个模型案例已有独立签认；四模型与六 fixture 不合并为一个质量分数</span></div></div><div className="rag-claim-tabs">{claims.map(([name], index) => <button type="button" key={name} className={claim === index ? "active" : ""} onClick={() => setClaim(index)}>{index + 1} · {name}</button>)}</div><div className="rag-citation-chain"><span>claim</span><b>→</b><span>citation</span><b>→</b><span>registry</span><b>→</b><span>source span</span></div><div className="rag-v2-focus"><b>{claims[claim][1]}</b><span>{claims[claim][2]} · {claims[claim][3]}</span></div><details><summary>已核对案例</summary><p>generation-04 的独立语义签认记录为 confirmed；最新 generation-05 只有机械运行记录，不能移用旧运行的语义结论。</p><code>week13-rag/evidence/technical/technical-v2/semantic-verdict-01.json</code></details></Panel>;
}
