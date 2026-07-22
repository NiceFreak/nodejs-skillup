import { useEffect, useRef, useState } from "react";
import {
  SLOW_JUDGMENT,
  W5_KNOWLEDGE,
  type CpuBlockingKnowledge,
  type EventLoopKnowledge,
  type ThreadpoolKnowledge,
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
          <p>这里只沉淀已经验证的知识；切换知识点会重放入场动画，底部判断表用于快速复盘。</p>
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

        {/* key=active.id：切换知识点时重挂载，重放入场动画，让复盘更生动 */}
        <div className="w5-stage-body" key={active.id}>
          {active.kind === "event-loop" ? (
            <EventLoopVisual topic={active} />
          ) : active.kind === "cpu-blocking" ? (
            <CpuBlockingVisual topic={active} />
          ) : (
            <ThreadpoolVisual topic={active} />
          )}

          <KnowledgeConclusion topic={active} />
        </div>
      </article>

      <JudgmentTable />
    </div>
  );
}

function EventLoopVisual({ topic }: { topic: EventLoopKnowledge }) {
  return (
    <div className="w5-event-loop">
      <section className="w5-reasoning">
        <h4>推导顺序（同一轮内谁先执行）</h4>
        <div className="w5-reasoning-path">
          {topic.reasoningPath.map((step, index) => (
            <div key={step} className="w5-reasoning-step" style={{ animationDelay: `${index * 140}ms` }}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
        <p className="w5-loop-rule">
          <span className="w5-loop-badge">↻ 循环规则</span>
          {topic.loopRule}
        </p>
        <EventLoopTick tick={topic.tick} />
      </section>

      <div className="w5-loop-layout">
        <section className="w5-lanes" aria-label="运行时职责边界">
          {topic.lanes.map((lane, index) => (
            <div
              key={lane.name}
              className={`w5-lane ${lane.tone}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
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
              <em className="w5-observation-phase">{item.phase}</em>
              <p>{item.note}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function EventLoopTick({ tick }: { tick: EventLoopKnowledge["tick"] }) {
  const [pos, setPos] = useState(0);
  const active = tick[pos];
  return (
    <div className="w5-tick">
      <div className="w5-tick-head">
        <span className="w5-tick-title">一步步走一个 tick</span>
        <div className="w5-tick-ctrl">
          <button type="button" onClick={() => setPos((p) => (p - 1 + tick.length) % tick.length)} aria-label="上一步">
            ‹
          </button>
          <span>
            {pos + 1} / {tick.length}
          </span>
          <button type="button" onClick={() => setPos((p) => (p + 1) % tick.length)} aria-label="下一步">
            ›
          </button>
        </div>
      </div>
      <ol className="w5-tick-row">
        {tick.map((t, i) => (
          <li
            key={t.name}
            className={`w5-tick-chip${i === pos ? " on" : ""}${t.loop ? " loop" : ""}`}
            onClick={() => setPos(i)}
          >
            <b>{t.loop ? "↻" : i + 1}</b>
            <span>{t.name}</span>
          </li>
        ))}
      </ol>
      <p className="w5-tick-note">{active.note}</p>
    </div>
  );
}

const TIMELINE_MAX = 2100;
// 示意用的动画时间缩放：真实 ms → 动画 ms（长任务压到约 1.6s，短任务给一个可见下限）。
const CPU_SCALE = 0.8;

function CpuBlockingVisual({ topic }: { topic: CpuBlockingKnowledge }) {
  const [runKey, setRunKey] = useState(0);
  const timerPosition = `${(topic.timerDelay / TIMELINE_MAX) * 100}%`;

  return (
    <section className="w5-cpu-visual">
      <div className="w5-visual-controls">
        <div className="w5-axis" aria-hidden="true">
          <span>0ms</span>
          <span>100ms timer 到期</span>
          <span>2000ms</span>
        </div>
        <button type="button" className="w5-replay" onClick={() => setRunKey((k) => k + 1)}>
          ▶ 重放
        </button>
      </div>

      <div key={runKey} className="w5-cpu-tracks">
        {topic.cases.map((item) => {
          const cpuWidth = `${(item.cpuDuration / TIMELINE_MAX) * 100}%`;
          const callbackPosition = `${(item.callbackAt / TIMELINE_MAX) * 100}%`;
          const growDuration = Math.max(400, item.cpuDuration * CPU_SCALE);
          return (
            <div key={item.label} className={`w5-timeline-card ${item.tone}`}>
              <div className="w5-timeline-summary">
                <strong>{item.label}</strong>
                <span>CPU {item.cpuDuration}ms</span>
                <span>callback {item.callbackAt}ms</span>
                <b>迟到 {item.lateBy}ms</b>
              </div>
              <div className="w5-timeline">
                <span
                  className="w5-cpu-span"
                  style={{ width: `max(6px, ${cpuWidth})`, animationDuration: `${growDuration}ms` }}
                >
                  <i>调用栈被占用</i>
                </span>
                <span className="w5-timer-marker" style={{ left: timerPosition }}>
                  <i>timer</i>
                </span>
                <span
                  className="w5-callback-marker"
                  style={{ left: callbackPosition, animationDelay: `${growDuration}ms` }}
                >
                  <i>callback</i>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// 线程池排队示意：柱长与完成先后 = 实测；生长速率仅作可视化。
const TP_SCALE = 12; // 真实 elapsed(ms) → 动画时长(ms)

function ThreadpoolVisual({ topic }: { topic: ThreadpoolKnowledge }) {
  const [size, setSize] = useState(topic.runs[0].size);
  const [runKey, setRunKey] = useState(0);
  const run = topic.runs.find((r) => r.size === size) ?? topic.runs[0];

  function pick(nextSize: number) {
    setSize(nextSize);
    setRunKey((k) => k + 1);
  }

  const running = Math.min(run.tasks.filter((t) => t.batch === 1).length, run.size);
  const queued = run.tasks.filter((t) => t.batch === 2).length;

  return (
    <section className="w5-tp-visual">
      <div className="w5-tp-controls">
        <div className="w5-tp-toggle" role="group" aria-label="线程池大小">
          {topic.runs.map((r) => (
            <button key={r.size} type="button" className={r.size === size ? "on" : ""} onClick={() => pick(r.size)}>
              SIZE={r.size}
            </button>
          ))}
        </div>
        <button type="button" className="w5-replay" onClick={() => setRunKey((k) => k + 1)}>
          ▶ 重放
        </button>
      </div>

      <div className="w5-tp-meta">
        <span>
          worker 数 <strong>{run.size}</strong>
        </span>
        <span>
          完成批次 <strong>{run.batches}</strong>
        </span>
        <span>
          Total <strong>{run.total}ms</strong>
        </span>
        <span className="w5-tp-legend" aria-hidden="true">
          <i className="b1" />第一批
          <i className="b2" />第二批
        </span>
      </div>

      <div className="w5-tp-schematic" aria-label="worker 与等待队列机制示意">
        <div className="w5-tp-pool">
          <span className="w5-tp-schematic-label">线程池 · {run.size} worker</span>
          <div className="w5-tp-slots">
            {Array.from({ length: run.size }).map((_, i) => (
              <i key={i} className={i < running ? "filled b1" : "empty"} />
            ))}
          </div>
        </div>
        <span className="w5-tp-schematic-arrow" aria-hidden="true">←等空位</span>
        <div className="w5-tp-queue">
          <span className="w5-tp-schematic-label">等待队列 · {queued} 个</span>
          <div className="w5-tp-slots">
            {queued === 0 ? (
              <span className="w5-tp-queue-empty">空</span>
            ) : (
              Array.from({ length: queued }).map((_, i) => <i key={i} className="filled b2" />)
            )}
          </div>
        </div>
      </div>
      <p className="w5-tp-schematic-cap">
        机制示意（推断）：worker 满位后，多出的任务在队列里等空位；worker 一空闲就接走下一个——第二批因此近似并行，而不是串行。
      </p>

      <ThreadpoolTrack key={runKey} run={run} axisMax={topic.axisMax} />

      <p className="w5-tp-summary">{run.summary}</p>
      <div className="w5-tp-notes">
        <div className="infer">
          <b>推断</b>
          <span>{topic.inference}</span>
        </div>
        <div className="unmeasured">
          <b>未测量</b>
          <span>{topic.unmeasured}</span>
        </div>
      </div>
    </section>
  );
}

function ThreadpoolTrack({
  run,
  axisMax,
}: {
  run: ThreadpoolKnowledge["runs"][number];
  axisMax: number;
}) {
  const [go, setGo] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    setGo(false);
    setDone([]);
    // 两帧后再置 true，确保浏览器先渲染 width:0，再触发过渡动画。
    rafRef.current = requestAnimationFrame(() =>
      requestAnimationFrame(() => setGo(true)),
    );
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="w5-tp-track">
      <div className="w5-tp-axis" aria-hidden="true">
        <span>0</span>
        <span>{Math.round(axisMax / 2)}ms</span>
        <span>{axisMax}ms</span>
      </div>
      {run.tasks.map((task) => {
        const width = go ? `${(task.elapsed / axisMax) * 100}%` : "0%";
        const isDone = done.includes(task.id);
        return (
          <div key={task.id} className={`w5-tp-row batch-${task.batch} ${isDone ? "done" : ""}`}>
            <span className="w5-tp-rowlabel">Task {task.id}</span>
            <div className="w5-tp-lane">
              <span
                className="w5-tp-bar"
                style={{ width, transitionDuration: `${task.elapsed * TP_SCALE}ms` }}
                onTransitionEnd={() => setDone((prev) => (prev.includes(task.id) ? prev : [...prev, task.id]))}
              />
            </div>
            <span className="w5-tp-elapsed">{task.elapsed}ms</span>
          </div>
        );
      })}
    </div>
  );
}

function JudgmentTable() {
  return (
    <section className="w5-judgment-table" aria-label="三类慢现场判断表">
      <div className="w5-jt-head">
        <span className="w5-kicker">综合落点</span>
        <h3>三类「慢」现场判断表</h3>
        <p>收到性能现象时，先归类再动手：分清主线程阻塞、线程池排队与外部 I/O，而不是盲目调参。</p>
      </div>
      <div className="w5-jt-grid">
        {SLOW_JUDGMENT.map((item) => (
          <article key={item.id} className={`w5-jt-card ${item.tone}`}>
            <h4>{item.title}</h4>
            <div className="w5-jt-row">
              <span>典型观测 · 事实</span>
              <p>{item.fact}</p>
            </div>
            <div className="w5-jt-row">
              <span>如何区分 · 验证</span>
              <p>{item.distinguish}</p>
            </div>
            <div className="w5-jt-row cannot">
              <span>当前不能定位</span>
              <p>{item.cannot}</p>
            </div>
          </article>
        ))}
      </div>
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
