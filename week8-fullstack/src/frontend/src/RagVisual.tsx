import { useEffect, useState } from "react";
import data from "./ragDemoData.json";
import type { AeRagTopic } from "./ragTopics";
import RagIcon, { RagIconGlyph, type RagIconName } from "./RagIcon";

const n = (value: number) => value.toLocaleString("en-US");
const branchName = (value: string) => value === "answered" ? "回答 answered" : "拒答 abstained";
declare global { interface Window { __RAG_REHEARSAL__?: { token: string } } }
type VerifyResult = { ok: boolean; matched: number; total: number; modelCalled: false; checks: Array<{ itemId: string; hitOrder: boolean; contextHash: boolean; contextChars: boolean }> };

export default function RagVisual({ topic }: { topic: AeRagTopic }) {
  switch (topic.id) {
    case "rag-roadmap": return <Roadmap />;
    case "rag-flow": return <Flow />;
    case "rag-implementation": return <Implementation />;
    case "rag-evidence": return <Evidence />;
    case "rag-eval": return <Evaluation />;
    case "rag-framework": return <Framework />;
  }
}

function CapabilityNode({ x, y, width, height, title, lines, status, statusDetail, href, icon, state }: {
  x: number; y: number; width: number; height: number; title: string; lines: string[]; status: string;
  statusDetail?: string; href: string; icon: RagIconName; state: "built" | "trial" | "planned";
}) {
  return <a href={`#/showcase?tab=ai-w13&topic=${href}`} className={`rag-capability ${state}`} data-rag-target={href} aria-label={`${title}，${status}${statusDetail ? `，${statusDetail}` : ""}，打开专题`}>
    <rect x={x} y={y} width={width} height={height} rx="8" />
    {state === "trial" && <rect className="rag-trial-border" x={x + 4} y={y + 4} width={width - 8} height={height - 8} rx="5" />}
    <g transform={`translate(${x + 12} ${y + 14})`}><RagIconGlyph name={icon} /></g>
    <text className="rag-capability-title" x={x + 43} y={y + 31}>{title}</text>
    {lines.map((line, index) => <text className="rag-capability-line" x={x + 14} y={y + 60 + index * 23} key={line}>{line}</text>)}
    <text className="rag-capability-status" x={x + 14} y={y + height - (statusDetail === undefined ? 15 : 33)}>{status} ↗</text>
    {statusDetail !== undefined && <text className="rag-capability-status-detail" x={x + 14} y={y + height - 15}>{statusDetail}</text>}
  </a>;
}

function Roadmap() {
  // 判据距离由数据算出，不手写：检索取九配置最高通过数，人工判定取三条端到端的最小/最大值。
  const retrievalBest = data.retrieval.reduce((best, row) => (row.passed > best.passed ? row : best));
  const human = [data.full.diagnostic, data.bm25.diagnostic, data.dense.diagnostic].map((entry) => entry.passed);
  const humanRange = `${Math.min(...human)}–${Math.max(...human)}/${data.full.diagnostic.total}`;
  const nodes = [
    { title: "可追溯资料", lines: [`${data.documents} 份项目规则文档`, `${data.blocks} 个带来源位置的文本片段`], status: "已实现", statusDetail: "输入可重算 · 10/10 一致", icon: "documents" as const, state: "built" as const, href: "rag-implementation" },
    { title: "选择证据", lines: ["BM25：词项匹配", "Dense：向量相似", "RRF：融合检索排名", "Dense / RRF 仅检索对照"], status: "已试验 · 质量未通过", statusDetail: `命中 ${retrievalBest.passed}/${retrievalBest.total} 题 · 要求全中`, icon: "search" as const, state: "trial" as const, href: "rag-flow" },
    { title: "有依据的回答", lines: ["全部资料 / BM25 结果", "可检查结论 + 原文引用", "证据不足时拒答"], status: "已运行 · 质量未通过", statusDetail: `机械检查 ${data.full.mechanical}/${data.full.items} 题 · 人工判定 ${humanRange}`, icon: "answer" as const, state: "trial" as const, href: "rag-evidence" },
    { title: "评估结果", lines: ["检索是否命中证据", "结构与引用能否解析", "原文是否支持回答"], status: "完整回答质量待通过", statusDetail: "检索 / 机械 / 原文检查已运行", icon: "check" as const, state: "trial" as const, href: "rag-eval" },
    { title: "组合与状态编排", lines: ["LangGraph：以节点、状态和条件边组织已有能力"], status: "计划中 · 尚未实施", icon: "graph" as const, state: "planned" as const, href: "rag-framework" },
  ];
  return <section className="rag-visual rag-roadmap" data-anchor="rag-capability-map" aria-label="RAG 能力依赖与完成状态总览">
    <div className="rag-status-key"><span className="built">实线 · 已实现</span><span className="trial">双线 · 已运行，质量待通过</span><span className="planned">虚线 · 计划中</span></div>
    <p className="rag-gate-note">通过条件（由本人定义并冻结）：端到端要同时满足五条——运行有效、不做错误拒答、引用全部可解析、10 题至少过 9 题、五类题型各至少过 1 题；检索要在 8 道适用题上全部命中。</p>
    <svg className="rag-roadmap-desktop" viewBox="0 0 1120 405" role="img" aria-label="可追溯资料支撑证据选择与回答，评估检查两者，后续LangGraph组合已有能力">
      <defs><marker id="rag-map-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10" /></marker></defs>
      <g className="rag-capability-edges" markerEnd="url(#rag-map-arrow)"><path d="M250 117H278" /><path d="M520 117H548" /><path d="M790 117H818" /><path d="M130 25V9H670V25" /><path className="planned" d="M400 238V276" /><path className="planned" d="M670 238V276" /></g>
      {nodes.slice(0, 4).map((node, index) => <CapabilityNode key={node.href} {...node} x={10 + index * 270} y={25} width={240} height={210} />)}
      <CapabilityNode {...nodes[4]} x={280} y={280} width={780} height={115} />
      <text className="rag-map-hint" x="16" y="277">点击能力节点</text><text className="rag-map-hint" x="16" y="299">查看功能与实现理由</text>
    </svg>
    <svg className="rag-roadmap-mobile" viewBox="0 0 360 665" role="img" aria-label="RAG 能力图：输入已建立，检索回答待通过质量，编排计划中">
      <g className="rag-capability-edges"><path d="M180 130V144H92V160 M180 144H268V160 M170 253H190 M92 344V359H180V375 M268 344V359H180" /><path className="planned" d="M180 514V544" /></g>
      <CapabilityNode {...nodes[0]} statusDetail={undefined} x={10} y={10} width={340} height={122} />
      <CapabilityNode {...nodes[1]} title="选择证据" lines={["BM25 词项匹配", "Dense 向量相似", "RRF 排名融合", "Dense/RRF 仅检索对照"]} status="已试验 · 未达质量" x={10} y={160} width={162} height={185} />
      <CapabilityNode {...nodes[2]} title="组织回答" lines={["全部资料 / BM25 结果", "结论 + 引用 / 拒答"]} status="已运行 · 未达质量" statusDetail="机械 8/10 题 · 人工 3–4/10" x={188} y={160} width={162} height={185} />
      <CapabilityNode {...nodes[3]} lines={["检索命中 → 机械校验 → 原文支持"]} x={10} y={375} width={340} height={140} />
      <CapabilityNode {...nodes[4]} lines={["LangGraph：节点、状态与条件边"]} x={10} y={545} width={340} height={110} />
    </svg>
    <details><summary>能力范围与状态说明</summary><p>本周对象是项目规则问答。资料解析、来源标识和引用回查已经实现；三种检索与全部资料直接输入均已试验。当前评测未达到既定质量要求，功能运行与学习掌握分别验收。路线图按能力依赖组织，后续状态编排尚未实施。</p>
      <p>本轮开发评测的六条失败中，五条含引用位置、块粒度或证据要求覆盖问题，其中一条还含结论内容错误；另有一条是错误拒答。全部资料路径没有检索阶段，失败不能整体归因于检索。本页只说明功能状态与判据距离，不衡量掌握程度、生产可用性或语料规模代表性。</p></details>
  </section>;
}

function Flow() {
  return <section className="rag-visual rag-flow" data-anchor="rag-branches" aria-label="固定 RAG 两条上下文输入分支">
    <div className="rag-corpus"><RagIcon name="documents" /><b>{data.documents} 份项目规则文档</b><span aria-hidden="true">→</span><strong>{data.blocks} 个可追溯原文片段</strong></div>
    <p className="rag-inline-definition">来源片段（source block）：带原文位置的文本片段；用户问题决定要找哪些片段。</p>
    <div className="rag-fork" aria-hidden="true"><i /><i /></div>
    <div className="rag-input-paths">
      <div className="rag-path" data-node="full-context"><span className="rag-node-heading"><RagIcon name="documents" /><b>Full-context · 全部资料</b></span><strong>{n(data.contextChars)} 字符</strong><small>完整输入，作为对照基线</small></div>
      <div className="rag-path" data-node="retrieval"><span className="rag-node-heading"><RagIcon name="search" /><b>BM25 · 词项匹配</b></span><strong>{n(data.bm25.context.min)}–{n(data.bm25.context.max)} 字符</strong><small>top 10：排名前 10 个片段</small></div>
    </div>
    <svg className="rag-join-desktop" viewBox="0 0 1000 32" preserveAspectRatio="none" aria-hidden="true"><path d="M245 0 V10 H160 V29 M755 0 V10 H245 M155 23 L160 29 L165 23" /></svg>
    <svg className="rag-join-mobile" viewBox="0 0 1000 32" preserveAspectRatio="none" aria-hidden="true"><path d="M245 0 V10 H500 V29 M755 0 V10 H500 M485 23 L500 29 L515 23" /></svg>
    <div className="rag-common-path">
      <div data-node="assembly"><span className="rag-node-heading"><RagIcon name="documents" /><b>Context · 模型本次收到的资料</b></span><span>保留片段来源与正文</span></div><span className="rag-arrow" aria-hidden="true">→</span>
      <div data-node="generation"><span className="rag-node-heading"><RagIcon name="answer" /><b>模型生成</b></span><span>Prompt 回答要求 + Query 问题 + Context</span></div><span className="rag-arrow" aria-hidden="true">→</span>
      <div data-node="response"><span className="rag-node-heading"><RagIcon name="citation" /><b>结论与引用 / 说明拒答原因</b></span><span>可检查的结论（claim）· 引用位置（citation）</span></div>
    </div>
    <div className="rag-registry" data-node="registry"><span>结构校验（Schema）</span><b>·</b><span>引用注册表校验引用能否解析</span><b>·</b><span>人工判定原文是否支持结论</span></div>
    <details><summary>可重复处理、模型生成与版本证据</summary><p>文档解析、来源 ID、排序与上下文组装都可重跑校验。模型根据输入产生回答或拒答；相同配置下单次结果仍可能变化。引用注册表只检查引用能否解析，原文是否支持结论仍需人工判定。</p><p>语料版本 {data.snapshot}。该图表示当前固定流程。Dense（向量相似）与 hybrid（RRF 排名融合）已运行检索对照；当前端到端回放使用 BM25。</p></details>
  </section>;
}

function Implementation() {
  const steps = [
    { id: "sources", lane: 0, icon: "documents" as const, title: "文档 → 可追溯片段", io: "原文行 → 来源 ID + 正文 + 内容 hash", why: "引用始终能回到同一版本原文" },
    { id: "ranking", lane: 1, icon: "search" as const, title: "Document → 检索结果", io: "BM25 分数 → 按分数、原始序号排序", why: "保持同分顺序，替换检索器时保留来源契约" },
    { id: "context", lane: 0, icon: "documents" as const, title: "检索结果 → 模型输入资料", io: "取原正文 → 加来源标识 → 组装 Context", why: "只改变选择和顺序，不改片段内的字节" },
    { id: "generation", lane: 1, icon: "answer" as const, title: "消息 → 运行记录", io: "同一组装函数 → 上一阶段的模型客户端 → 原始响应", why: "计量与发送一致，保留结果以便定位失败" },
    { id: "scoring", lane: 2, icon: "check" as const, title: "运行记录 → 分项判定", io: "机械检查 + 人工语义 → 最终结论", why: "可解析不等于原文支持，待判定不能当通过" },
  ];
  return <section className="rag-visual rag-implementation" data-anchor="rag-implementation-lanes" aria-label="实现职责泳道、输入输出与边界理由">
    <div className="rag-impl-head"><span>本项目 · 资料与来源</span><span>检索框架 / 生成客户端</span><span>本项目 · 评估</span></div>
    <div className="rag-impl-body"><svg className="rag-impl-connectors" viewBox="0 0 900 390" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="rag-impl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" /></marker></defs><g markerEnd="url(#rag-impl-arrow)"><path d="M150 64V74H450V78" /><path d="M450 142V153H150V157" /><path d="M150 220V233H450V237" /><path d="M450 298V312H750V316" /></g></svg>
      {steps.map((step, index) => <div key={step.id} className="rag-impl-step" style={{ gridColumn: step.lane + 1, gridRow: index + 1 }} data-owner={["本项目 · 资料与来源", "框架 / 生成客户端", "本项目 · 评估"][step.lane]} data-impl-step={step.id}><span className="rag-node-heading"><RagIcon name={step.icon} /><b>{step.title}</b></span><span>{step.io}</span><small>{step.why}</small></div>)}
    </div>
    <div className="rag-identity-flow"><RagIcon name="citation" /><b>来源身份</b><span>Document → 检索结果 → Context → citation 校验</span></div>
    <details><summary>五处边界对应的代码与已知限制</summary><ol><li>source.py / parser.py / registry.py / serialize.py：解析冻结文档范围，保留核心原文行与标题语境。来源 ID 标识位置，内容 hash 校验正文；整串顺序和分隔符另行验证。</li><li>retrieval.py：LangChain 的 Document 与 BM25Retriever.from_documents 已接入；取底层分数后由本项目显式排序，保证同分时按片段在语料中的原始序号。Dense 与 RRF 输出相同的检索结果结构。</li><li>build_retrieval_context：按检索顺序从引用注册表取回正文，复用来源包装。排名与分数不直接发送给模型，当前未实现按预算裁剪。</li><li>generation.py：共用消息组装函数（assemble_messages），复用上一阶段的模型客户端。原始响应保留，JSON 语法与 schema 结构分开检查；这一段没有使用 LangChain 的生成链。</li><li>scoring.py：逐项检查与最终结论分离，任一条件失败即不通过，未判定项单独保留。重算输入与回放答案也分开，不把历史记录当成本次生成。</li></ol></details>
  </section>;
}

function Evidence() {
  const [caseIndex, setCaseIndex] = useState(0);
  const [citationId, setCitationId] = useState<string | null>(null);
  const item = data.cases[caseIndex];
  const citation = item.citations.find((entry) => entry.id === citationId);
  function claimView(claim: typeof item.claims[number], index: number) {
    return <div className="rag-claim" key={index}><span className="rag-label">Claim {index + 1}</span><p>{claim.text}</p><div className="rag-citations">
      {claim.citations.map((id) => <button type="button" key={id} aria-expanded={citationId === id} aria-controls="rag-source-panel"
        onClick={() => { setCitationId(citationId === id ? null : id); requestAnimationFrame(() => document.getElementById("rag-source-panel")?.scrollIntoView({ block: "nearest" })); }}>{id.replace("rules/", "")} <span aria-hidden="true">↓</span></button>)}
    </div></div>;
  }
  return <section className="rag-visual" data-anchor="rag-citation-replay" aria-label="历史开发评测回答到引用的证据回放">
    <div className="rag-replay-head"><b>历史回放</b><span>BM25 top 10 · {data.recordedAt} · 无实时模型调用</span></div>
    <Recompute />
    <div className="rag-case-nav" role="group" aria-label="选择开发评测回放案例">{data.cases.map((entry, index) => <button key={entry.id} type="button"
      aria-pressed={caseIndex === index} onClick={() => { setCaseIndex(index); setCitationId(null); }}>{entry.label}</button>)}</div>
    <div className="rag-evidence-trail"><span><RagIcon name="answer" /><b>Claim</b><small>可检查的结论</small></span><b aria-hidden="true">→</b><span><RagIcon name="citation" /><b>Citation</b><small>文件与行位置</small></span><b aria-hidden="true">→</b><span><RagIcon name="documents" /><b>原文</b><small>检查是否支持</small></span></div>
    <div className="rag-query"><span className="rag-label">Query</span><p>{item.query}</p></div>
    <div className="rag-branch-compare" data-branch-match={item.expected === item.actual}>
      <div><span>冻结预期</span><b>{branchName(item.expected)}</b></div><strong aria-hidden="true">{item.expected === item.actual ? "=" : "≠"}</strong><div><span>历史输出</span><b>{branchName(item.actual)}</b></div>
    </div>
    {item.claims.length ? <div className="rag-replay-answer">{claimView(item.claims[0], 0)}
      <div className="rag-source-panel" id="rag-source-panel" aria-live="polite">
        {citation ? <><b>冻结原文 · {citation.path}</b>{citation.lines.map((line) => <div className="rag-source-line" key={line.number}><span>L{line.number}</span><pre>{line.text}</pre></div>)}<small>语料版本：{data.snapshot}；引用行号对应这一冻结版本。</small><details className="rag-model-block"><summary>模型可见 source block（含标题语境）</summary><pre><code>{citation.modelContent}</code></pre></details></>
          : <p>点击 citation，展开它指向的冻结原文。</p>}
      </div>
      <details><summary>其余 {item.claims.length - 1} 条 claims 与 citations</summary>{item.claims.slice(1).map((claim, index) => claimView(claim, index + 1))}</details>
    </div> : <div className="rag-abstention"><span className="rag-label">{item.reasonCode}</span><p>{item.reason}</p>
      <small>{item.expected === item.actual ? "拒答分支与冻结预期一致；“语料里没有答案”是评测时预先定义的，不能仅凭前 10 个检索结果证明。" : "预期可回答却拒答。需结合检索内容与生成结果诊断，不能只根据拒答文字认定语料没有答案。"}</small>
    </div>}
    <details><summary>本次输入规模、top 10 来源与原始记录位置</summary><p>上下文 {n(item.contextChars)} 字符；输入 {n(item.promptTokens)} tokens。这轮 BM25 的本人判定已完成且未通过（该轮经本人批准，只验证链路能跑通）。</p>
      <ol>{item.hits.map((hit) => <li key={hit.sourceId}><code>{hit.sourceId}</code></li>)}</ol>
      <small>原始记录位置：</small><code>week13-rag/evidence/bm25-e2e/dev-bm25-e2e-top10-01.json · {item.id}</code>
    </details>
  </section>;
}

function Recompute() {
  const available = Boolean(window.__RAG_REHEARSAL__?.token);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");
  async function run() {
    const token = window.__RAG_REHEARSAL__?.token;
    if (!token || busy) return;
    setBusy(true); setError(""); setResult(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("/__rag_demo/verify", { method: "POST", headers: { "X-RAG-Rehearsal": token, Accept: "application/json" }, signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "本地重算失败，请使用终端备用入口。");
      if (!Array.isArray(body.checks) || body.modelCalled !== false || body.total !== data.bm25.items) throw new Error("重算响应格式不符合约定，请使用终端备用入口。");
      setResult(body as VerifyResult);
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "本地重算超时，请使用终端备用入口。");
    } finally { window.clearTimeout(timeout); setBusy(false); }
  }
  return <div className="rag-recompute">
    <div className="rag-recompute-action"><button type="button" data-testid="rag-run-verify" disabled={!available || busy} aria-busy={busy} onClick={run}><RagIcon name="check" />{busy ? "正在重算…" : "重算检索与模型输入"}</button><small>{available ? "本地重算检索与证据上下文；答案仍回放已有记录。" : "使用本地演练入口可重新核对，当前为历史记录。"}</small></div>
    <div aria-live="polite" data-testid="rag-verify-result">
      {busy && <p>正在核对检索顺序、证据上下文和上下文字符数…</p>}
      {error && <p className="rag-recompute-error">{error}</p>}
      {result && <><p><b>{result.ok ? "本次重算一致" : "本次重算存在不一致"} · {result.matched}/{result.total}</b><span> · 未调用模型</span></p><div className="rag-recompute-metrics">{([
        ["hitOrder", "检索顺序"], ["contextHash", "证据上下文 hash"], ["contextChars", "上下文字符数"],
      ] as const).map(([key, label]) => <span key={key}><b>{result.checks.filter((check) => check[key]).length}/{result.total}</b>{label}</span>)}</div><small>{result.ok ? "本次检索与证据上下文和历史记录一致" : "本次检索或证据上下文与历史记录不一致"}；不重新生成答案。回答质量另按原文支持与评测判据判断。</small><details><summary>逐题重算结果</summary><ul>{result.checks.map((check) => <li key={check.itemId}><code>{check.itemId}</code><span> · 顺序 {check.hitOrder ? "一致" : "不一致"} · 上下文 {check.contextHash ? "一致" : "不一致"} · 字符数 {check.contextChars ? "一致" : "不一致"}</span></li>)}</ul></details></>}
    </div>
  </div>;
}


function RetrievalChart() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const width = mobile ? 350 : 540;
  const start = mobile ? 40 : 94;
  const span = width - start - 10;
  return <svg className="rag-retrieval-svg" viewBox={`0 0 ${width} 320`} role="img" aria-label="BM25词项匹配5/6/7，Dense向量相似3/4/5，Hybrid排名融合4/5/7；均为8题中的通过数">
    <line x1={start} y1="32" x2={start} y2="318" /><line x1={start + span} y1="32" x2={start + span} y2="318" />
    <text className="rag-svg-axis" x={width - 10} y="12" textAnchor="end">0 → {data.retrieval[0].total} 题</text>
    {["BM25 · 词项匹配", "Dense · 向量相似", "Hybrid · RRF 排名融合"].map((label, index) => <text className="rag-svg-method" key={label} x="2" y={29 + index * 104}>{label}</text>)}
    {data.retrieval.map((row, index) => { const y = 41 + Math.floor(index / 3) * 104 + index % 3 * 24; return <g key={`${row.method}-${row.k}`}><text className="rag-svg-k" x={start - 10} y={y + 15} textAnchor="end">{row.k}</text><rect className="rag-svg-track" x={start} y={y} width={span} height="20" /><rect className="rag-bar" data-method={row.method} data-k={row.k} data-passed={row.passed} x={start} y={y} width={row.passed / row.total * span} height="20" /><text className="rag-svg-bar-value" x={start + row.passed / row.total * span - 7} y={y + 15} textAnchor="end">{row.passed}/{row.total}</text></g>; })}
  </svg>;
}

function Evaluation() {
  const saved = (1 - data.bm25.promptTokens.total / data.full.promptTokens.total) * 100;
  return <section className="rag-visual rag-evaluation" data-anchor="rag-eval-denominators" aria-label="同一8题上的检索结果与独立的10题输入规模比较">
    <div className="rag-eval-levels"><span><RagIcon name="search" /><b>检索命中</b><small>找到题目要求的证据</small></span><b aria-hidden="true">→</b><span><RagIcon name="check" /><b>机械校验</b><small>程序校验结构、拒答分支与引用身份</small></span><b aria-hidden="true">→</b><span><RagIcon name="documents" /><b>原文支持</b><small>逐题判断回答是否被原文支持</small></span></div>
    <div className="rag-eval-panels">
      <div className="rag-chart"><h4>检索对照 · {data.retrieval[0].total} 题适用</h4><p className="rag-label">top_k = 取排名前 k 个片段</p>
        <RetrievalChart />
        <p className="rag-chart-note">9 个有效配置均未达到全部适用题通过。</p>
      </div>
      <div className="rag-chart rag-token-chart"><h4>输入规模 · 同 {data.full.items} 题</h4><p className="rag-label">同一 Prompt 与 JSON 输出约束 · prompt_tokens 合计</p>
        {[["Full-context", data.full.promptTokens.total], ["BM25 top 10", data.bm25.promptTokens.total]].map(([label, value]) => <div className="rag-token-row" key={label}><div><b>{label}</b><strong>{n(Number(value))}</strong></div><div className="rag-bar-track"><div className="rag-token-bar" style={{ width: `${Number(value) / data.full.promptTokens.total * 100}%` }} /></div></div>)}
        <div className="rag-token-change"><strong>↓ {saved.toFixed(2)}%</strong><span>本轮输入 token</span></div>
        <div className="rag-score-scope"><span>机械检查通过 · 同一组 {data.full.items} 题：全部资料 {data.full.mechanical}/{data.full.items} 题 · BM25 {data.bm25.mechanical}/{data.bm25.items} 题 · Dense {data.dense.mechanical}/{data.dense.items} 题</span><div className="rag-human-diagnostic"><b>本人逐题判定 · 全部资料 {data.full.diagnostic.passed}/{data.full.diagnostic.total} 题 · BM25 {data.bm25.diagnostic.passed}/{data.bm25.diagnostic.total} 题 · Dense {data.dense.diagnostic.passed}/{data.dense.diagnostic.total} 题</b><small>全部资料一轮的判定标准在那次运行之后才明确，按诊断结论记录；BM25 与 Dense 两轮经本人批准，只验证链路能跑通，不作质量验收。三轮均未通过。</small></div></div>
      </div>
    </div>
    <details><summary>指标定义、判定层级与对照边界</summary><p>检索评测只看一件事：题目要求的每一段证据范围，是否至少有一个被检索到的片段与它重叠。它不要求检索覆盖完整规则，也不检验生成的回答。两道无答案题不适用这一项；BM25 top-10 有一份早期记录把无答案题也算进分母，属缺陷版本，已排除，有效记录是修正后的那份。</p>
      <p>全部资料每题输入 {n(data.full.promptTokens.min)}–{n(data.full.promptTokens.max)} tokens；BM25 {n(data.bm25.promptTokens.min)}–{n(data.bm25.promptTokens.max)}；Dense 端到端合计 {n(data.dense.promptTokens.total)} tokens、上下文 {data.dense.context.min}–{data.dense.context.max} 字符，其中 1 条响应结构校验失败（程序检查通过 7/10 题）。三轮各只运行一次，不能从输入 token 数或程序检查通过数得出质量优劣。</p>
      <p>全部资料一轮的本人判定记录在 2026-09-10 的运行笔记里，所用的判定标准在那次运行之后才明确，因此按诊断结论记录；BM25 与 Dense 两轮的本人判定在 2026-09-11 完成，采用同一标准，各通过 {data.bm25.diagnostic.passed}/{data.bm25.diagnostic.total} 题。这两轮经本人批准，只验证链路能跑通，不作质量验收。机械引用可解析率（citation_precision）只表示引用格式能被解析，不表示原文支持了结论。</p>
    </details>
    <details><summary>检索记录与展示来源 hash</summary><ul>{data.inputs.map((input) => <li key={input.path}><code>{input.path}</code><small>sha256 {input.sha256}</small></li>)}</ul></details>
  </section>;
}

function Framework() {
  return <section className="rag-visual rag-framework" data-anchor="rag-framework-ownership" aria-label="已实施 LangChain 职责与未实施 LangGraph 映射">
    <div className="rag-framework-current"><span className="rag-label">当前已实施 · 实线</span>
      <div className="rag-owner-path"><div><RagIcon name="documents" /><span>本项目</span><b>文档解析 / 来源注册表</b><small>保留原文位置与正文</small></div><strong aria-hidden="true">→</strong><div className="rag-lc"><RagIcon name="search" /><span>LangChain</span><b>Document + BM25 + 向量库</b><small>文档对象传正文与来源；BM25 词项匹配，dense 走向量库</small></div><strong aria-hidden="true">→</strong><div><RagIcon name="answer" /><span>本项目 / HTTP 客户端</span><b>资料组装 / 模型生成</b><small>响应校验与独立评估</small></div></div>
      <div className="rag-lc-detail"><code>BM25Retriever.from_documents</code><span>→</span><code>vectorizer.get_scores</code><span>→</span><b>按分数与片段原始序号自排序</b></div>
    </div>
    <div className="rag-framework-next"><span className="rag-node-heading"><RagIcon name="graph" /><b>LangGraph 后续映射 · 虚线 · 尚未实施</b></span>
      <div className="rag-state-shell"><span className="rag-state-label">State 共享状态候选：问题 / 证据 / 结果</span><div className="rag-next-path"><b>检索节点</b><span aria-hidden="true">⇢</span><b>生成节点</b><span aria-hidden="true">⇢</span><div><b>条件边</b><small>完成 / 交还人工</small></div></div></div>
      <p>本阶段的输入输出契约可以继续作为节点边界；状态、条件边与权限语义需要另行设计和验证。</p>
    </div>
    <details><summary>框架实际使用范围与官方资料</summary><p>当前未调用 LangChain 的完整 generation chain，也未使用 LCEL。Dense 的 embedding 与向量存储已接 LangChain：E5Embeddings 加查询/文档前缀，InMemoryVectorStore 以冻结 source_id 为键，向量来自冻结 e5 ONNX 缓存，排序仍由本项目显式完成。LangGraph 的 checkpoint、状态恢复和条件路由均待后续实践。</p>
      <ul><li><a href="https://reference.langchain.com/python/langchain-community/retrievers/bm25/BM25Retriever/from_documents" target="_blank" rel="noreferrer">LangChain BM25Retriever.from_documents</a></li><li><a href="https://docs.langchain.com/oss/python/langgraph/overview" target="_blank" rel="noreferrer">LangGraph overview</a></li><li><a href="https://docs.langchain.com/oss/python/langgraph/persistence" target="_blank" rel="noreferrer">LangGraph persistence</a></li></ul><small>官方文档核查：2026-09-11；已实施范围以本地代码为准。</small>
    </details>
  </section>;
}
