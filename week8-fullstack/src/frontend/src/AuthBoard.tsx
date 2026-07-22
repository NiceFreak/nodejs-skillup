import { useState } from "react";
import { AUTH_TOPICS, type AuthTopic } from "./authTopics";

export default function AuthBoard() {
  const [activeId, setActiveId] = useState(AUTH_TOPICS[0].id);
  const [step, setStep] = useState(0);
  const active = AUTH_TOPICS.find((topic) => topic.id === activeId) ?? AUTH_TOPICS[0];
  const current = active.steps[Math.min(step, active.steps.length - 1)];

  function selectTopic(topic: AuthTopic) {
    setActiveId(topic.id);
    setStep(0);
  }

  return (
    <div className="authk-board">
      <header className="authk-head">
        <div>
          <span>可视化复习</span>
          <h2>认证与授权边界</h2>
          <p>内容来自本人 Week4 学习笔记；按知识点复习，demo 讲稿另选重点精讲。</p>
        </div>
        <b>{AUTH_TOPICS.length} 个知识点已验证</b>
      </header>

      <nav className="authk-nav" aria-label="认证知识点">
        {AUTH_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className={topic.id === active.id ? "on" : ""}
            onClick={() => selectTopic(topic)}
          >
            <span>{topic.label}</span>
            <strong>{topic.title}</strong>
          </button>
        ))}
      </nav>

      <article className="authk-stage">
        <div className="authk-title-row">
          <div>
            <span>{active.label}</span>
            <h3>{active.title}</h3>
          </div>
          <p>{active.question}</p>
        </div>

        <section className="authk-actors" aria-label="流程参与层">
          {active.actors.map((actor) => {
            const highlighted = actor.key === current.from || actor.key === current.to;
            return (
              <div key={actor.key} className={highlighted ? "active" : ""}>
                <strong>{actor.label}</strong>
                <span>{actor.responsibility}</span>
              </div>
            );
          })}
        </section>

        <section className={`authk-player ${current.tone}`}>
          <div className="authk-player-head">
            <div>
              <span>步骤 {step + 1}</span>
              <strong>{current.title}</strong>
            </div>
            <div className="authk-controls">
              <button type="button" className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
                上一步
              </button>
              <span>{step + 1} / {active.steps.length}</span>
              <button
                type="button"
                disabled={step === active.steps.length - 1}
                onClick={() => setStep(step + 1)}
              >
                下一步
              </button>
            </div>
          </div>

          <div className="authk-arrow">
            <span>{actorShort(active, current.from)}</span>
            <div>
              <code>{current.carries}</code>
            </div>
            <span>{actorShort(active, current.to)}</span>
          </div>
          <p>{current.note}</p>

          <div className="authk-dots" aria-label="流程步骤">
            {active.steps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === step ? "on" : index < step ? "done" : ""}
                onClick={() => setStep(index)}
                aria-label={`跳到步骤 ${index + 1}：${item.title}`}
              />
            ))}
          </div>
        </section>

        <section className="authk-artifacts" aria-label="数据与凭据边界">
          {active.artifacts.map((artifact) => (
            <div key={artifact.key} className={current.activates.includes(artifact.key) ? "active" : ""}>
              <code>{artifact.label}</code>
              <span>{artifact.boundary}</span>
            </div>
          ))}
        </section>

        {active.outcomes && (
          <section className="authk-outcomes" aria-label="真实结果对照">
            {active.outcomes.map((outcome) => (
              <div key={outcome.condition} className={outcome.tone}>
                <span>{outcome.condition}</span>
                <strong>{outcome.result}</strong>
                <p>{outcome.meaning}</p>
              </div>
            ))}
          </section>
        )}

        <footer className="authk-conclusion">
          <div>
            <span>核心判断</span>
            <strong>{active.judgment}</strong>
          </div>
          <div>
            <span>映射回业务</span>
            <p>{active.mapping}</p>
          </div>
          <details>
            <summary>查看验收证据与笔记来源</summary>
            <ul>
              {active.evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <small>主要来源：{active.source}</small>
          </details>
        </footer>
      </article>
    </div>
  );
}

function actorShort(topic: AuthTopic, key: string) {
  return topic.actors.find((actor) => actor.key === key)?.short ?? key;
}
