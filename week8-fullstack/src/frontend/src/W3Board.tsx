// W3「MongoDB 聚合与查询优化」复习板。展示资产（AGENTS.md 白名单）。
// 只呈现已验收结论；仍未澄清 / 未验证的部分进「仍在路上」面板，如实标注。
// 复用 W5 板的外壳样式（w5-board / w5-stage / w5-conclusion / w5-jt-*），
// 仅 explain 对照、分层、月边界时间线用 w3- 专属样式。
import { useState } from "react";
import type { BoardMode } from "./types";
import {
  W3_KNOWLEDGE,
  W3_OPEN_ITEMS,
  W3_SELF_NOTE,
  type ExplainKnowledge,
  type LayeringKnowledge,
  type MonthKnowledge,
  type W3Knowledge,
} from "./w3Topics";

export default function W3Board({ mode }: { mode: BoardMode }) {
  const [activeId, setActiveId] = useState(W3_KNOWLEDGE[0].id);
  const active = W3_KNOWLEDGE.find((item) => item.id === activeId) ?? W3_KNOWLEDGE[0];
  const demo = mode === "demo";

  return (
    <div className="w5-board">
      <header className="w5-board-head">
        <div>
          <span className="w5-kicker">{demo ? "可视化说明" : "可视化复习"}</span>
          <h2>MongoDB 聚合与查询优化</h2>
          <p>
            {demo
              ? "聚合管道分层与 explain 查询优化的可视化说明。"
              : "只沉淀 Week3 已验收的结论；仍未澄清 / 未验证的部分在底部「仍在路上」如实标注。"}
          </p>
        </div>
        <span className="w5-verified">{W3_KNOWLEDGE.length} {demo ? "个专题" : "个知识点已验证"}</span>
      </header>

      <nav className="w5-knowledge-nav" aria-label="W3 知识点">
        {W3_KNOWLEDGE.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === active.id ? "on" : ""}
            onClick={() => setActiveId(item.id)}
          >
            <span>{item.label}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </nav>

      <article className="w5-stage">
        <div className="w5-stage-title">
          <div>
            <span>{active.label}</span>
            <h3>{active.title}</h3>
          </div>
          <p>{active.question}</p>
        </div>

        <div className="w5-stage-body" key={active.id}>
          {active.kind === "explain" ? (
            <ExplainVisual topic={active} />
          ) : active.kind === "layering" ? (
            <LayeringVisual topic={active} />
          ) : (
            <MonthVisual topic={active} />
          )}

          <Conclusion topic={active} />
        </div>
      </article>

      {/* 学习状态外现（开放问题 + 自我观察）仅在复习模式展示，展示模式对外隐藏 */}
      {!demo && <OpenItemsPanel />}
    </div>
  );
}

function ExplainVisual({ topic }: { topic: ExplainKnowledge }) {
  return (
    <section className="w3-explain">
      <div className="w3-stage-flip">
        <div className="w3-stage-box before">
          <span>无索引</span>
          <strong>{topic.stageBefore}</strong>
        </div>
        <div className="w3-stage-arrow" aria-hidden="true">
          <code>{topic.createIndex}</code>
          <i>→</i>
        </div>
        <div className="w3-stage-box after">
          <span>有索引</span>
          <strong>{topic.stageAfter}</strong>
        </div>
      </div>

      <div className="w3-metrics" role="table" aria-label="explain 指标前后对照">
        <div className="w3-metrics-head" role="row">
          <span role="columnheader">explain 指标</span>
          <span role="columnheader">前</span>
          <span aria-hidden="true" />
          <span role="columnheader">后</span>
        </div>
        {topic.metrics.map((m) => (
          <div key={m.label} className={`w3-metric-row${m.highlight ? " key" : ""}`} role="row">
            <code role="cell">{m.label}</code>
            <span className="before" role="cell">{m.before}</span>
            <i aria-hidden="true">→</i>
            <span className="after" role="cell">{m.after}</span>
          </div>
        ))}
      </div>

      <p className="w3-keypoint">{topic.keyPoint}</p>
    </section>
  );
}

function LayeringVisual({ topic }: { topic: LayeringKnowledge }) {
  return (
    <section className="w3-layering">
      <div className="w3-layers">
        {topic.lanes.map((lane, i) => (
          <div key={lane.name} className={`w3-layer ${lane.tone}`}>
            <div className="w3-layer-head">
              <strong>{lane.name}</strong>
              <span>{lane.owner}</span>
            </div>
            <ul>
              {lane.holds.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            {i === 0 && <div className="w3-layer-handoff" aria-hidden="true">{"{ date, status }"} ↓</div>}
          </div>
        ))}
      </div>
      <p className="w3-handoff">{topic.handoff}</p>
      <p className="w3-test">
        <b>判据</b>
        {topic.test}
      </p>
    </section>
  );
}

function MonthVisual({ topic }: { topic: MonthKnowledge }) {
  return (
    <section className="w3-month">
      <div className="w3-timeline" aria-label="自然月半开区间">
        {topic.segments.map((seg) => (
          <div key={seg.label} className={`w3-seg ${seg.state}`}>
            <span className="w3-seg-bound">{seg.bound}</span>
            <span className="w3-seg-label">{seg.label}</span>
          </div>
        ))}
      </div>
      <p className="w3-month-rule">
        <span className="w3-interval" aria-hidden="true">[月初, 下月初)</span>
        {topic.rule}
      </p>
      <p className="w3-pitfall">
        <b>踩过的坑</b>
        {topic.pitfall}
      </p>
    </section>
  );
}

function Conclusion({ topic }: { topic: W3Knowledge }) {
  return (
    <footer className="w5-conclusion">
      <div className="w5-judgment">
        <span>核心判断</span>
        <strong>{topic.judgment}</strong>
      </div>
      <div className="w5-business-map">
        <span>映射回业务</span>
        <p>{topic.mapping}</p>
      </div>
      <details className="w5-evidence">
        <summary>查看实验依据与笔记来源</summary>
        <ul>
          {topic.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <small>主要来源：{topic.source}</small>
      </details>
    </footer>
  );
}

function OpenItemsPanel() {
  return (
    <>
      <section className="w3-self-note">
        <span className="w5-kicker">关于我自己的一个观察</span>
        <h3>{W3_SELF_NOTE.title}</h3>
        <p>{W3_SELF_NOTE.body}</p>
        <p className="w3-self-fix">
          <b>对治</b>
          {W3_SELF_NOTE.fix}
        </p>
      </section>

      <section className="w5-judgment-table w3-open" aria-label="仍在路上">
        <div className="w5-jt-head">
          <span className="w5-kicker">仍在路上 · 已如实记账</span>
          <h3>还没吃透 / 未验证的部分</h3>
          <p>把它们单列出来、标清状态，复习时一眼知道哪些已经踏实、哪些还欠着，不必反复自我怀疑。</p>
        </div>
        <div className="w3-open-grid">
          {W3_OPEN_ITEMS.map((item) => (
            <article key={item.id} className={`w3-open-card ${item.tone}`}>
              <div className="w3-open-top">
                <h4>{item.title}</h4>
                <span className="w3-open-status">{item.status}</span>
              </div>
              <p className="w3-open-detail">{item.detail}</p>
              <p className="w3-open-plan">
                <b>下一步</b>
                {item.plan}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
