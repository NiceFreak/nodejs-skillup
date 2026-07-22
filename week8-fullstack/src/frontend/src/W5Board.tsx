import { useState } from "react";
import {
  W5_KNOWLEDGE,
  type CpuBlockingKnowledge,
  type EventLoopKnowledge,
  type W5Knowledge,
} from "./w5Topics";

export default function W5Board() {
  const [activeId, setActiveId] = useState(W5_KNOWLEDGE[0].id);
  const active = W5_KNOWLEDGE.find((item) => item.id === activeId) ?? W5_KNOWLEDGE[0];

  return (
    <div className="w5-board">
      <header className="w5-board-head">
        <div>
          <span className="w5-kicker">可视化复习</span>
          <h2>Node.js 运行时判断</h2>
          <p>这里只沉淀已经验证的知识；demo 讲稿另行挑选少数重点精讲。</p>
        </div>
        <span className="w5-verified">{W5_KNOWLEDGE.length} 个知识点已验证</span>
      </header>

      <nav className="w5-knowledge-nav" aria-label="W5 知识点">
        {W5_KNOWLEDGE.map((item) => (
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

        {active.kind === "event-loop" ? (
          <EventLoopVisual topic={active} />
        ) : (
          <CpuBlockingVisual topic={active} />
        )}

        <KnowledgeConclusion topic={active} />
      </article>
    </div>
  );
}

function EventLoopVisual({ topic }: { topic: EventLoopKnowledge }) {
  return (
    <div className="w5-event-loop">
      <section className="w5-reasoning">
        <h4>推导顺序</h4>
        <div className="w5-reasoning-path">
          {topic.reasoningPath.map((step, index) => (
            <div key={step} className="w5-reasoning-step">
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="w5-loop-layout">
        <section className="w5-lanes" aria-label="运行时职责边界">
          {topic.lanes.map((lane) => (
            <div key={lane.name} className={`w5-lane ${lane.tone}`}>
              <div>
                <strong>{lane.name}</strong>
                <span>{lane.owner}</span>
              </div>
              <p>{lane.description}</p>
            </div>
          ))}
        </section>

        <section className="w5-observations">
          <h4>两个关键场景</h4>
          {topic.observations.map((item) => (
            <div key={item.context} className="w5-observation">
              <span>{item.context}</span>
              <strong>{item.result}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

const TIMELINE_MAX = 2100;

function CpuBlockingVisual({ topic }: { topic: CpuBlockingKnowledge }) {
  const timerPosition = `${(topic.timerDelay / TIMELINE_MAX) * 100}%`;

  return (
    <section className="w5-cpu-visual">
      <div className="w5-axis" aria-hidden="true">
        <span>0ms</span>
        <span>100ms timer 到期</span>
        <span>2000ms</span>
      </div>

      {topic.cases.map((item) => {
        const cpuWidth = `${(item.cpuDuration / TIMELINE_MAX) * 100}%`;
        const callbackPosition = `${(item.callbackAt / TIMELINE_MAX) * 100}%`;
        return (
          <div key={item.label} className={`w5-timeline-card ${item.tone}`}>
            <div className="w5-timeline-summary">
              <strong>{item.label}</strong>
              <span>CPU {item.cpuDuration}ms</span>
              <span>callback {item.callbackAt}ms</span>
              <b>迟到 {item.lateBy}ms</b>
            </div>
            <div className="w5-timeline">
              <span className="w5-cpu-span" style={{ width: `max(6px, ${cpuWidth})` }}>
                <i>调用栈被占用</i>
              </span>
              <span className="w5-timer-marker" style={{ left: timerPosition }}>
                <i>timer</i>
              </span>
              <span className="w5-callback-marker" style={{ left: callbackPosition }}>
                <i>callback</i>
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function KnowledgeConclusion({ topic }: { topic: W5Knowledge }) {
  return (
    <footer className="w5-conclusion">
      <div className="w5-judgment">
        <span>运行时判断</span>
        <strong>{topic.judgment}</strong>
      </div>
      <div className="w5-business-map">
        <span>映射回业务</span>
        <p>{topic.mapping}</p>
      </div>
      <details className="w5-evidence">
        <summary>查看实验依据</summary>
        <ul>
          {topic.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </footer>
  );
}
