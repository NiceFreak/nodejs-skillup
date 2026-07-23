import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  W5_KNOWLEDGE,
  type BackpressureKnowledge,
  type CpuBlockingKnowledge,
  type EventLoopKnowledge,
  type PipelineKnowledge,
  type StreamModelKnowledge,
  type ThreadpoolKnowledge,
  type W5Knowledge,
} from "./w5Topics";
import type { BoardMode } from "./types";

const KNOWLEDGE_GROUPS = ["调度与慢点诊断", "大数据流生产边界"] as const;

// 是否偏好减少动效：脚本动画用 JS 定时推进，CSS 的 prefers-reduced-motion 管不到，
// 因此在 reduced-motion 下默认不自动播放（用户仍可手动单步），符合无障碍预期。
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

// 脚本化逐帧播放器：把「按实测节奏预生成的帧序列」用统一的 播放/暂停/单步/重放 控件驱动。
// 用 JS 定时器推进而非纯 CSS，动画可暂停、可逐帧检查——对「理解某一步发生了什么」比自动跑更有用。
function useFramePlayer(length: number, opts?: { interval?: number; loop?: boolean; autoPlay?: boolean }) {
  const interval = opts?.interval ?? 850;
  const loop = opts?.loop ?? false;
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => (opts?.autoPlay ?? true) && !reduced);

  useEffect(() => {
    if (!playing || length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i + 1 >= length) {
          if (loop) return 0;
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [playing, length, interval, loop]);

  const replay = () => {
    setIndex(0);
    setPlaying(true);
  };
  const toggle = () => {
    if (index >= length - 1 && !loop) {
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };
  const step = (delta: number) => {
    setPlaying(false);
    setIndex((i) => Math.max(0, Math.min(length - 1, i + delta)));
  };
  return { index, playing, setIndex, replay, toggle, step };
}

type FramePlayer = ReturnType<typeof useFramePlayer>;

// 统一的播放控件：上一步 / 播放·暂停 / 下一步 / 进度 / 重放。
function W5Transport({ player, length, label }: { player: FramePlayer; length: number; label?: ReactNode }) {
  return (
    <div className="w5-transport">
      {label ? <span className="w5-transport-label">{label}</span> : null}
      <div className="w5-transport-ctrl">
        <button type="button" onClick={() => player.step(-1)} aria-label="上一步" disabled={player.index === 0}>
          ‹
        </button>
        <button
          type="button"
          className="play"
          onClick={player.toggle}
          aria-label={player.playing ? "暂停" : "播放"}
        >
          {player.playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => player.step(1)}
          aria-label="下一步"
          disabled={player.index >= length - 1}
        >
          ›
        </button>
        <span className="w5-transport-count">
          {player.index + 1} / {length}
        </span>
        <button type="button" className="w5-replay" onClick={player.replay}>
          ↺ 重放
        </button>
      </div>
    </div>
  );
}

// 当前专题由 URL（App → Showcase）提供，支持刷新保留与直接链接到某个知识点。
export default function W5Board({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const active = W5_KNOWLEDGE.find((item) => item.id === topic) ?? W5_KNOWLEDGE[0];
  const [revealedTopic, setRevealedTopic] = useState<string | null>(null);
  const review = mode === "review";
  const contentVisible = !review || revealedTopic === active.id;

  return (
    <div className="w5-board">
      <header className="w5-board-head">
        <div>
          <span className="w5-kicker">可视化说明</span>
          <h2>Node.js 运行时判断</h2>
          <p>六个知识点分成两条链：先判断 callback 为什么迟到，再判断大数据如何安全流动。外部 I/O 只保留为分诊假设，不下钻本周已移出范围的底层细节。</p>
        </div>
        <span className="w5-verified">{W5_KNOWLEDGE.length} 个知识点</span>
      </header>

      <div className="w5-nav-groups">
        {KNOWLEDGE_GROUPS.map((group) => (
          <section key={group} className="w5-nav-group">
            <span className="w5-nav-group-title">{group}</span>
            <nav className="w5-knowledge-nav" aria-label={group}>
              {W5_KNOWLEDGE.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === active.id ? "on" : ""}
                  onClick={() => onTopicChange(item.id)}
                >
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <em>{item.evidenceKind}</em>
                </button>
              ))}
            </nav>
          </section>
        ))}
      </div>

      <article className="w5-stage">
        <div className="w5-stage-title">
          <div>
            <span>{active.label}</span>
            <h3>{active.title}</h3>
          </div>
          <p>{active.question}</p>
        </div>

        {review && !contentVisible ? (
          <section className="w5-recall-gate">
            <span>主动回忆</span>
            <h4>先不看答案，口述你的判断链</h4>
            <p>{active.question}</p>
            <small>至少说明：输入与输出、关键机制、一个失败或证据边界。</small>
            <button type="button" onClick={() => setRevealedTopic(active.id)}>显示模型与证据</button>
          </section>
        ) : (
          /* key=active.id：切换知识点时重挂载，重放入场动画。 */
          <div className="w5-stage-body" key={active.id}>
            {active.kind === "event-loop" ? (
              <EventLoopVisual topic={active} />
            ) : active.kind === "cpu-blocking" ? (
              <CpuBlockingVisual topic={active} />
            ) : active.kind === "threadpool" ? (
              <ThreadpoolVisual topic={active} />
            ) : active.kind === "stream-model" ? (
              <StreamModelVisual topic={active} />
            ) : active.kind === "backpressure" ? (
              <BackpressureVisual topic={active} />
            ) : (
              <PipelineVisual topic={active} />
            )}

            <KnowledgeConclusion topic={active} review={review} />
          </div>
        )}
      </article>

    </div>
  );
}

function EventLoopVisual({ topic }: { topic: EventLoopKnowledge }) {
  return (
    <div className="w5-event-loop">
      <section className="w5-phase-map" aria-label="Node.js 事件循环六阶段">
        <div className="w5-phase-map-head">
          <div>
            <span>libuv phase map</span>
            <h4>一个循环中的六个主要阶段</h4>
          </div>
          <p>Node 20+ 每轮 timers 在 poll 之后；这里从 timers 起画一圈，表达职责关系，不表达固定耗时。</p>
        </div>
        <ol>
          {topic.phases.map((phase, index) => (
            <li key={phase.name} className={phase.internal ? "internal" : ""}>
              <b>{index + 1}</b>
              <div>
                <strong>{phase.name}</strong>
                <span>{phase.example}</span>
              </div>
              <p>{phase.role}</p>
            </li>
          ))}
        </ol>
        <p className="w5-phase-checkpoint">
          <b>callback 边界检查点</b>
          nextTick 与 microtask 会在操作 / callback 返回后处理，但它们不属于上述六个 libuv 阶段。
        </p>
      </section>

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
  // 循环播放：tick 本身就是一个「回到调度」的闭环，自动转一圈最能表达它是循环而非单程。
  const player = useFramePlayer(tick.length, { interval: 1500, loop: true });
  const pos = player.index;
  const active = tick[pos];
  return (
    <div className="w5-tick">
      <div className="w5-tick-head">
        <span className="w5-tick-title">一步步走一个 tick</span>
        <div className="w5-tick-ctrl">
          <button type="button" onClick={() => player.step(-1)} aria-label="上一步">
            ‹
          </button>
          <button
            type="button"
            className="play"
            onClick={player.toggle}
            aria-label={player.playing ? "暂停" : "播放"}
          >
            {player.playing ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={() => player.step(1)} aria-label="下一步">
            ›
          </button>
          <span>
            {pos + 1} / {tick.length}
          </span>
        </div>
      </div>
      <ol className="w5-tick-row">
        {tick.map((t, i) => (
          <li
            key={t.name}
            className={`w5-tick-chip${i === pos ? " on" : ""}${t.loop ? " loop" : ""}`}
            onClick={() => player.setIndex(i)}
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
      <div className="w5-ownership">
        <div className="w5-subsection-head">
          <span>先判归属</span>
          <h4>异步不等于都进 threadpool</h4>
        </div>
        <div className="w5-ownership-grid" role="table" aria-label="任务执行归属">
          {topic.ownership.map((item) => (
            <div key={item.task} className={`w5-ownership-row ${item.tone}`} role="row">
              <strong role="cell">{item.task}</strong>
              <span role="cell">{item.mechanism}</span>
              <em role="cell">{item.poolEffect}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="w5-io-path">
        <div className="w5-subsection-head">
          <span>普通网络 I/O</span>
          <h4>readiness 到 JavaScript callback 的职责链</h4>
        </div>
        <ol>
          {topic.ioPath.map((step, index) => (
            <li key={step.owner}>
              <b>{index + 1}</b>
              <strong>{step.owner}</strong>
              <span>{step.action}</span>
            </li>
          ))}
        </ol>
        <p><code>fd ready</code> 只说明底层 I/O resource 已就绪，不说明 JavaScript callback 已经执行。</p>
      </div>

      <div className="w5-subsection-head experiment">
        <span>受控实测</span>
        <h4>pbkdf2 × 8：只改变 UV_THREADPOOL_SIZE</h4>
      </div>
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

      <JudgmentTable cases={topic.diagnosis} />
      <p className="w5-runtime-stop"><b>止步边界</b>{topic.stopBoundary}</p>
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
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setGo(true));
    });
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

// 示意用块数（无绝对单位）：只表达「驻留累积 vs 逐块交付」和「首字节早晚」的相对差别，
// 不代表任何 MB / ms 数字——本日未实测内存与吞吐，边界见 boundary。
const SM_CHUNKS = 6;

function StreamModelVisual({ topic }: { topic: StreamModelKnowledge }) {
  const player = useFramePlayer(SM_CHUNKS, { interval: 780, loop: true });
  const f = player.index; // 当前处理到第 f 块（0-indexed）
  const done = f + 1; // 已读入 / 已处理块数

  // 整块：内存驻留随读取累积，直到最后一块才「首字节 = 全部就绪」并一次交付。
  const wholeResident = done;
  const wholeDelivered = f >= SM_CHUNKS - 1 ? SM_CHUNKS : 0;
  // 流式：任一时刻只要求约 1 块驻留，第 1 块即可交付，之后逐块累加交付。
  const streamResident = 1;
  const streamDelivered = done;

  const rows: Array<{
    tone: "whole" | "stream";
    role: string;
    resident: number;
    delivered: number;
    firstByte: boolean;
    firstByteText: string;
  }> = [
    {
      tone: "whole",
      role: "整块读取",
      resident: wholeResident,
      delivered: wholeDelivered,
      firstByte: wholeDelivered > 0,
      firstByteText: "首字节：等全部读完",
    },
    {
      tone: "stream",
      role: "流式处理",
      resident: streamResident,
      delivered: streamDelivered,
      firstByte: streamDelivered > 0,
      firstByteText: "首字节：第 1 块即可交付",
    },
  ];

  return (
    <div className="w5-stream-model">
      <section className="w5-sm-anim" aria-label="整块读取与流式处理的内存与交付对比">
        <div className="w5-sm-anim-head">
          <div>
            <span>逐块对比 · 示意</span>
            <h4>同样 {SM_CHUNKS} 块数据，内存驻留与首字节时刻如何不同</h4>
          </div>
          <W5Transport player={player} length={SM_CHUNKS} />
        </div>
        {rows.map((row) => (
          <div key={row.tone} className={`w5-sm-row ${row.tone}`}>
            <span className="w5-sm-role">{row.role}</span>
            <div className="w5-sm-meters">
              <SmMeter label="内存驻留" filled={row.resident} total={SM_CHUNKS} kind="resident" />
              <SmMeter label="已交付" filled={row.delivered} total={SM_CHUNKS} kind="delivered" />
            </div>
            <span className={`w5-sm-first${row.firstByte ? " on" : ""}`}>{row.firstByteText}</span>
          </div>
        ))}
        <p className="w5-sm-caption">
          相对示意，无绝对数值：整块读取的驻留随读取一路累积、并发重叠时可能同时驻留多份，首字节要等完整读取；
          流式驻留基本恒定、首块即可更早交付。
        </p>
      </section>

      <div className="w5-stream-compare">
        {topic.compare.map((side) => (
          <section key={side.label} className={`w5-stream-side ${side.tone}`}>
            <span>{side.label}</span>
            <ol>
              {side.flow.map((step, index) => (
                <li key={step}>
                  <b>{index + 1}</b>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
            <p>{side.outcome}</p>
          </section>
        ))}
      </div>
      <div className="w5-stream-signals">
        <span>排查时一起看</span>
        {topic.diagnostics.map((item) => <code key={item}>{item}</code>)}
      </div>
    </div>
  );
}

function SmMeter({
  label,
  filled,
  total,
  kind,
}: {
  label: string;
  filled: number;
  total: number;
  kind: "resident" | "delivered";
}) {
  return (
    <div className={`w5-sm-meter ${kind}`}>
      <span className="w5-sm-meter-label">
        {label} <b>{filled}</b>
      </span>
      <div className="w5-sm-slots" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <i key={i} className={i < filled ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}

interface BpFrame {
  writes: number;
  buffer: number;
  producer: "writing" | "paused" | "done";
  falses: number;
  drains: number;
  kind: "write" | "false" | "drain" | "finish";
  event: string;
}

const bpParseInt = (s: string): number => {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
};

// 按实测节奏脚本化：highWaterMark=5、总量=30 → 6 个「填到阈值→false→排空→drain」循环，
// 最后一轮以 finish 收口。帧序列直接映射实测的 write 30 / false 6 / drain 5 / 峰值 5。
function buildBpFrames(hwm: number, total: number): BpFrame[] {
  const list: BpFrame[] = [];
  let writes = 0;
  let falses = 0;
  let drains = 0;
  const cycles = Math.max(1, Math.ceil(total / hwm));
  for (let c = 0; c < cycles; c++) {
    const inThisCycle = Math.min(hwm, total - writes);
    for (let k = 1; k <= inThisCycle; k++) {
      writes += 1;
      const isFalse = k >= hwm; // 第 hwm 次写入使 writableLength 达阈值，write() 返回 false
      if (isFalse) falses += 1;
      list.push({
        writes,
        buffer: k,
        producer: isFalse ? "paused" : "writing",
        falses,
        drains,
        kind: isFalse ? "false" : "write",
        event: isFalse
          ? `第 ${writes} 次 write() 已接纳该块，但返回 false（writableLength=${k} 达到 highWaterMark）→ 生产者应暂停`
          : `write() #${writes} 入缓冲，writableLength=${k}`,
      });
    }
    const isLast = writes >= total;
    if (isLast) {
      list.push({
        writes,
        buffer: 0,
        producer: "done",
        falses,
        drains,
        kind: "finish",
        event: `已无更多数据：end() 声明输入结束，Writable 消化剩余后以 finish 收口（无需第 ${drains + 1} 次 drain）`,
      });
    } else {
      drains += 1;
      list.push({
        writes,
        buffer: 0,
        producer: "writing",
        falses,
        drains,
        kind: "drain",
        event: `consumer 消化完积压 → 第 ${drains} 次 drain 触发，生产者恢复写入`,
      });
    }
  }
  return list;
}

function BackpressureVisual({ topic }: { topic: BackpressureKnowledge }) {
  const hwmRaw = topic.config.find((c) => c.label === "highWaterMark")?.value ?? "5";
  const totalRaw = topic.config.find((c) => c.label === "总量")?.value ?? "30";
  const hwm = Number.isFinite(bpParseInt(hwmRaw)) ? bpParseInt(hwmRaw) : 5;
  const total = Number.isFinite(bpParseInt(totalRaw)) ? bpParseInt(totalRaw) : 30;
  const prodRate = topic.config.find((c) => c.label === "生产间隔")?.value ?? "10ms / chunk";
  const consRate = topic.config.find((c) => c.label === "消费耗时")?.value ?? "50ms / chunk";

  const frames = useMemo(() => buildBpFrames(hwm, total), [hwm, total]);
  const player = useFramePlayer(frames.length, { interval: 680, loop: true });
  const fr = frames[player.index];
  const producerLabel = fr.producer === "writing" ? "生产中" : fr.producer === "paused" ? "已暂停" : "已结束";

  return (
    <div className="w5-backpressure">
      <section className="w5-bp-anim" aria-label="背压暂停与恢复的动态过程">
        <div className="w5-bp-anim-head">
          <div>
            <span>动态过程 · 按实测节奏脚本化</span>
            <h4>快生产者如何被缓冲区「顶回来」，再靠 drain 恢复</h4>
          </div>
          <W5Transport player={player} length={frames.length} />
        </div>

        <div className="w5-bp-stage">
          <div className={`w5-bp-node producer ${fr.producer}`}>
            <span>Producer</span>
            <strong>{producerLabel}</strong>
            <em>{prodRate}</em>
          </div>
          <span className="w5-bp-arrow" aria-hidden="true">
            {fr.producer === "writing" ? "▶" : "‖"}
          </span>
          <div className={`w5-bp-node buffer${fr.buffer >= hwm ? " full" : ""}`}>
            <span>Buffer · writableLength {fr.buffer}</span>
            <div className="w5-bp-buffer-slots" aria-hidden="true">
              {Array.from({ length: hwm }).map((_, i) => (
                <i key={i} className={i < fr.buffer ? (fr.buffer >= hwm ? "on full" : "on") : ""} />
              ))}
            </div>
            <em>highWaterMark = {hwm}</em>
          </div>
          <span className="w5-bp-arrow" aria-hidden="true">▶</span>
          <div className="w5-bp-node consumer">
            <span>Consumer</span>
            <strong>持续消费</strong>
            <em>{consRate}</em>
          </div>
        </div>

        <BpSparkline frames={frames} current={player.index} hwm={hwm} />

        <div className={`w5-bp-event ${fr.kind}`} role="status">
          <b>
            {fr.kind === "false"
              ? "write() → false"
              : fr.kind === "drain"
                ? "drain"
                : fr.kind === "finish"
                  ? "finish"
                  : "write()"}
          </b>
          <span>{fr.event}</span>
        </div>

        <div className="w5-bp-tally">
          <span>
            write <strong>{fr.writes}</strong>/{total}
          </span>
          <span>
            false <strong>{fr.falses}</strong>
          </span>
          <span>
            drain <strong>{fr.drains}</strong>
          </span>
          <span>
            峰值 writableLength <strong>{hwm}</strong>
          </span>
        </div>
      </section>

      <div className="w5-bp-config">
        {topic.config.map((item) => (
          <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
        ))}
      </div>
      <div className="w5-bp-metrics">
        {topic.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </div>
        ))}
      </div>
      <p className="w5-bp-final"><b>终止边界</b>{topic.finalPath}</p>
    </div>
  );
}

// writableLength 随帧变化的锯齿折线：把实测「1→5→0 反复、峰值未持续抬升」一眼画出来。
function BpSparkline({ frames, current, hwm }: { frames: BpFrame[]; current: number; hwm: number }) {
  const w = 320;
  const h = 66;
  const padX = 10;
  const padY = 10;
  const plotW = w - padX * 2;
  const plotH = h - padY * 2;
  const n = frames.length;
  const px = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const py = (v: number) => padY + plotH - (v / hwm) * plotH;
  const points = frames.map((f, i) => `${px(i).toFixed(1)},${py(f.buffer).toFixed(1)}`).join(" ");
  const hwmY = py(hwm);
  const cur = frames[current];
  return (
    <div className="w5-bp-spark">
      <div className="w5-bp-spark-head">
        <span>writableLength 轨迹</span>
        <em>峰值锁在 highWaterMark，不持续抬升</em>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="writableLength 随时间的锯齿轨迹">
        <line x1={padX} x2={w - padX} y1={hwmY} y2={hwmY} className="w5-bp-spark-hwm" />
        <text x={w - padX} y={hwmY - 4} className="w5-bp-spark-hwmlabel" textAnchor="end">
          hwm {hwm}
        </text>
        <polyline points={points} className="w5-bp-spark-line" />
        <circle cx={px(current)} cy={py(cur.buffer)} r={4} className="w5-bp-spark-dot" />
      </svg>
    </div>
  );
}

type PipeStageState = "idle" | "active" | "done" | "error" | "destroyed";
type PipeMode = "success" | "failure";

// 每帧每个 stage 的状态：成功路径顺序点亮并收口；失败路径在写出端失败后，
// 由 pipeline 反向把三个 stream 统一 destroy —— 这一步是「统一收口」的可视化重点。
function pipeStageState(stage: number, frame: number, mode: PipeMode): PipeStageState {
  if (mode === "success") {
    // frame 0:R active / 1:T active / 2:W active / 3:全部 done
    if (frame >= 3) return "done";
    if (stage < frame) return "done";
    if (stage === frame) return "active";
    return "idle";
  }
  // failure: frame 0:R active / 1:T active / 2:W error / 3:全部 destroyed
  if (frame >= 3) return "destroyed";
  if (stage === 2 && frame === 2) return "error";
  if (stage < frame) return "done";
  if (stage === frame) return "active";
  return "idle";
}

const PIPE_FRAMES: Record<PipeMode, string[]> = {
  success: [
    "Readable 产生数据块，向下游推送",
    "Transform 逐块转换（a–z → A–Z）",
    "Writable 逐块写出",
    "三段都正常结束 → pipeline 统一以 finish 收口，回调 / Promise 无 error",
  ],
  failure: [
    "Readable 产生数据块，向下游推送",
    "Transform 逐块转换（a–z → A–Z）",
    "Writable 打开目标失败：EISDIR（目标是目录）",
    "错误反向传播 → pipeline 把 Readable/Transform/Writable 全部 destroyed:true，统一从 Promise 出口抛出",
  ],
};

function PipelineVisual({ topic }: { topic: PipelineKnowledge }) {
  const [mode, setMode] = useState<PipeMode>("success");
  const steps = PIPE_FRAMES[mode];
  const player = useFramePlayer(steps.length, { interval: 1050, loop: false });
  const frame = player.index;

  function switchMode(next: PipeMode) {
    setMode(next);
    player.replay();
  }

  const outletState: PipeStageState =
    mode === "success" ? (frame >= 3 ? "done" : "idle") : frame >= 3 ? "destroyed" : frame === 2 ? "error" : "idle";

  return (
    <div className="w5-pipeline">
      <section className="w5-pipe-anim" aria-label="pipeline 成功与失败路径动态对比">
        <div className="w5-pipe-anim-head">
          <div className="w5-pipe-toggle" role="group" aria-label="路径">
            <button type="button" className={mode === "success" ? "on" : ""} onClick={() => switchMode("success")}>
              成功路径
            </button>
            <button type="button" className={mode === "failure" ? "on" : ""} onClick={() => switchMode("failure")}>
              输出端失败
            </button>
          </div>
          <W5Transport player={player} length={steps.length} />
        </div>

        <div className={`w5-pipe-flow ${mode}`} aria-label="pipeline 三段链路">
          {topic.stages.map((stage, index) => {
            const st = pipeStageState(index, frame, mode);
            return (
              <div key={stage} className={`w5-pipe-stage ${st}`}>
                <span className="w5-pipe-stage-idx">{index + 1}</span>
                <strong>{stage}</strong>
                <em className="w5-pipe-stage-tag">
                  {st === "destroyed"
                    ? "destroyed:true"
                    : st === "error"
                      ? "EISDIR"
                      : st === "done"
                        ? "ok"
                        : st === "active"
                          ? "…"
                          : ""}
                </em>
              </div>
            );
          })}
          <div className={`w5-pipe-outlet ${outletState}`}>
            <span>统一出口</span>
            <strong>
              {mode === "success"
                ? outletState === "done"
                  ? "finish ✓"
                  : "Promise"
                : outletState === "destroyed"
                  ? "reject(EISDIR)"
                  : outletState === "error"
                    ? "捕获错误…"
                    : "Promise"}
            </strong>
          </div>
        </div>

        <p className={`w5-pipe-step ${mode}`} role="status">
          <b>{frame + 1}</b>
          {steps[frame]}
        </p>
      </section>

      <div className="w5-pipeline-results">
        <section className={`success${mode === "success" ? " active" : ""}`}>
          <span>{topic.success.title}</span>
          <ul>{topic.success.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        </section>
        <section className={`failure${mode === "failure" ? " active" : ""}`}>
          <span>{topic.failure.title}</span>
          <ul>{topic.failure.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        </section>
      </div>
      <p className="w5-pipeline-boundary">{topic.platformBoundary}</p>
    </div>
  );
}

// 三类慢判断是线程池归属学习的综合应用，不再作为 W5 全局独立模块。
function JudgmentTable({ cases }: { cases: ThreadpoolKnowledge["diagnosis"] }) {
  return (
    <section className="w5-judgment-table" aria-label="三类慢现场判断表">
      <div className="w5-jt-head">
        <span className="w5-kicker">归属模型的综合验收</span>
        <h3>三类「慢」现场判断表</h3>
        <p>先用现象反对不符合的候选原因，再选择能区分剩余假设的测量；不能根据单一指标直接定案。</p>
      </div>
      <div className="w5-jt-grid">
        {cases.map((item) => (
          <article key={item.id} className={`w5-jt-card ${item.tone}`}>
            <h4>{item.title}</h4>
            <div className="w5-jt-row">
              <span>典型观测</span>
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

function KnowledgeConclusion({ topic, review }: { topic: W5Knowledge; review: boolean }) {
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
        <summary>查看依据、来源与证据边界 · {topic.evidenceKind}</summary>
        <ul>
          {topic.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <small>来源：{topic.source}</small>
        <p><b>不能外推：</b>{topic.boundary}</p>
      </details>
      {review && topic.reviewStatus && (
        <p className="w5-review-status"><b>重建状态</b>{topic.reviewStatus}</p>
      )}
    </footer>
  );
}
