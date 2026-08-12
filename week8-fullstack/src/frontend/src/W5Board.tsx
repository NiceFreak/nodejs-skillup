import { useMemo, useState } from "react";
import {
  FrameNarration,
  FrameTransport,
  dwellByText,
  useFramePlayer,
} from "./framePlayer";
import {
  W5_KNOWLEDGE,
  type BackpressureKnowledge,
  type CpuBlockingKnowledge,
  type EventLoopKnowledge,
  type LifecycleKnowledge,
  type PipelineKnowledge,
  type StreamModelKnowledge,
  type ThreadpoolKnowledge,
  type WorkerKnowledge,
  type W5Knowledge,
} from "./w5Topics";
import type { BoardMode } from "./types";

const KNOWLEDGE_GROUPS = ["调度与慢点诊断", "大数据流生产边界", "错误与进程收口"] as const;

type RuntimeOwner = "main" | "pool" | "kernel" | "resource";

const RUNTIME_OWNERS: Array<{
  id: RuntimeOwner;
  label: string;
  owner: string;
  detail: string;
}> = [
  { id: "main", label: "主线程 / event loop", owner: "JavaScript + libuv 调度", detail: "执行 JS、推进 phase、接回 callback" },
  { id: "pool", label: "libuv threadpool", owner: "有限 worker 资源", detail: "承接部分 fs / crypto / dns / zlib 工作" },
  { id: "kernel", label: "OS / kernel I/O", owner: "readiness / 系统资源", detail: "普通网络 I/O 通常在这里等待就绪" },
  { id: "resource", label: "应用资源", owner: "Stream / Server / DB / Worker", detail: "缓冲、连接、在途请求与独立计算" },
];

const TOPIC_OWNERSHIP: Record<string, {
  active: RuntimeOwner[];
  path: RuntimeOwner[];
  label: string;
  boundary: string;
  alternatePath?: RuntimeOwner[];
  alternateLabel?: string;
}> = {
  "event-loop": {
    active: ["main", "kernel"],
    path: ["kernel", "main"],
    label: "I/O ready -> event loop phase -> JavaScript callback",
    boundary: "phase 是主线程上的调度顺序，不是六条独立线程。",
  },
  "cpu-blocking": {
    active: ["main"],
    path: ["main"],
    label: "同步 CPU 工作持续占用调用栈",
    boundary: "timer 到期不等于 callback 已获准执行。",
  },
  threadpool: {
    active: ["main", "pool", "kernel"],
    path: ["main", "pool", "main"],
    label: "fs / crypto 等 pool API：分派到 worker，完成后 callback 回主线程",
    alternatePath: ["main", "kernel", "main"],
    alternateLabel: "普通网络 I/O：等待 kernel readiness，就绪后 callback 回主线程",
    boundary: "异步不是执行归属；普通网络 I/O 不应画进 threadpool。",
  },
  "stream-model": {
    active: ["main", "kernel", "resource"],
    path: ["kernel", "resource", "main"],
    label: "底层输入 -> Stream 分块 -> JavaScript 逐块处理",
    boundary: "Stream 改变 materialize 方式，不承诺任意负载都内存安全。",
  },
  backpressure: {
    active: ["main", "resource"],
    path: ["main", "resource", "main"],
    label: "producer -> Writable buffer -> consumer -> drain 反馈",
    boundary: "write(false) 是暂停信号；drain 不是客户端已收到。",
  },
  pipeline: {
    active: ["main", "kernel", "resource"],
    path: ["resource", "main", "resource"],
    label: "Readable -> Transform -> Writable -> Promise 出口",
    boundary: "错误机制仍按 Promise / Stream 边界解释，不合并成通用红箭头。",
  },
  worker: {
    active: ["main", "resource"],
    path: ["main", "resource", "main"],
    label: "主线程分派 -> Worker 独立执行 -> message 返回",
    boundary: "保护响应性不等于单任务加速。",
  },
  lifecycle: {
    active: ["main", "resource"],
    path: ["main", "resource"],
    label: "signal -> 停止接入 -> 等待在途 -> 清理资源 -> exit",
    boundary: "fatal 退出与计划内 graceful shutdown 是两条不同链。",
  },
};


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
          <p>八个知识点分成三条链：判断工作由谁推进、数据如何安全流动，以及错误与进程由谁收口。页面只呈现已验收结论，D6 待重建内容不包装成完成。</p>
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
            <RuntimeOwnershipMap topicId={active.id} />
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
            ) : active.kind === "pipeline" ? (
              <PipelineVisual topic={active} />
            ) : active.kind === "worker" ? (
              <WorkerVisual topic={active} />
            ) : (
              <LifecycleVisual topic={active} />
            )}

            <KnowledgeConclusion topic={active} review={review} />
          </div>
        )}
      </article>

    </div>
  );
}

function RuntimeOwnershipMap({ topicId }: { topicId: string }) {
  const model = TOPIC_OWNERSHIP[topicId] ?? TOPIC_OWNERSHIP["event-loop"];

  return (
    <section className="w5-runtime-map" aria-label="Node.js 运行时统一职责图">
      <div className="w5-runtime-map-head">
        <div>
          <span>统一 ownership map</span>
          <h4>先定位谁执行，再解释为何变慢</h4>
        </div>
        <p>{model.boundary}</p>
      </div>
      <div className="w5-runtime-owners">
        {RUNTIME_OWNERS.map((item) => (
          <article key={item.id} className={`${item.id}${model.active.includes(item.id) ? " active" : " muted"}`}>
            <span>{item.owner}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="w5-runtime-route" aria-label={`当前专题路径：${model.label}`}>
        <span>当前专题路径</span>
        <div>
          <ol>
            {model.path.map((owner, index) => {
              const item = RUNTIME_OWNERS.find((candidate) => candidate.id === owner);
              return <li key={`${owner}-${index}`}>{item?.label}</li>;
            })}
          </ol>
          <strong>{model.label}</strong>
        </div>
        {model.alternatePath && (
          <>
            <span>并列分支</span>
            <div>
              <ol>
                {model.alternatePath.map((owner, index) => {
                  const item = RUNTIME_OWNERS.find((candidate) => candidate.id === owner);
                  return <li key={`alternate-${owner}-${index}`}>{item?.label}</li>;
                })}
              </ol>
              <strong>{model.alternateLabel}</strong>
            </div>
          </>
        )}
      </div>
    </section>
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
  // 每个阶段的 note 是不同的说明文字（约 40 字），1500ms 读不完就转走了；按字数给时间。
  // 循环与自动播放保留：tick 本身是闭环，停住就表达不出「回到调度」。
  const player = useFramePlayer(tick.length, {
    loop: true,
    intervalAt: (i) => dwellByText(tick[i]?.note ?? ""),
  });
  const pos = player.index;
  const active = tick[pos];
  return (
    <div className="w5-tick">
      <div className="w5-tick-head">
        <span className="w5-tick-title">一步步走一个 tick</span>
        <FrameTransport player={player} length={tick.length} />
      </div>
      {/* chip 是 button 而不是带 onClick 的 li：键盘要能到达，当前项要能被读屏播报。 */}
      <ol className="w5-tick-row">
        {tick.map((t, i) => (
          <li key={t.name}>
            <button
              type="button"
              className={`w5-tick-chip${i === pos ? " on" : ""}${t.loop ? " loop" : ""}`}
              onClick={() => player.seek(i)}
              aria-current={i === pos ? "step" : undefined}
            >
              <b>{t.loop ? "↻" : i + 1}</b>
              <span>{t.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <FrameNarration text={active.note} tone="w5-tick-note" />
    </div>
  );
}

const TIMELINE_MAX = 2100;
type CpuState = "running" | "blocked" | "cleared" | "ready" | "done";

const CPU_STATE_TEXT: Record<CpuState, string> = {
  running: "同步 CPU 执行中 · timer 未到期",
  blocked: "timer 已到期，但调用栈仍被占用 —— callback 拿不到执行机会",
  cleared: "调用栈已清空 · 等待 timer 到期",
  ready: "调用栈已清空 · callback 已获得执行资格",
  done: "callback 已执行",
};

function cpuStateAt(item: CpuBlockingKnowledge["cases"][number], t: number, timerDelay: number): CpuState {
  if (t >= item.callbackAt) return "done";
  const cpuDone = t >= item.cpuDuration;
  const timerDue = t >= timerDelay;
  if (!cpuDone) return timerDue ? "blocked" : "running";
  return timerDue ? "ready" : "cleared";
}

// 关键时刻取自实测本身：0、两组各自的 CPU 结束点、timer 到期点、两组各自的 callback 时刻。
// 用「事件发生的时刻」而不是等距采样做帧，才能停在 100ms 这一帧上——
// 那一帧同时成立「timer 已到期」和「callback 还没执行」，正是本知识点的全部结论。
function buildCpuFrames(topic: CpuBlockingKnowledge): number[] {
  const marks = new Set<number>([0, topic.timerDelay]);
  topic.cases.forEach((item) => {
    marks.add(item.cpuDuration);
    marks.add(item.callbackAt);
  });
  return [...marks].sort((a, b) => a - b);
}

function cpuNarration(topic: CpuBlockingKnowledge, t: number): string {
  if (t === 0) return `两组各自注册 setTimeout(${topic.timerDelay}ms)，随后立即开始同步 CPU 任务。`;
  const events: string[] = [];
  topic.cases.forEach((item) => {
    if (t === item.cpuDuration) events.push(`${item.label}：同步 CPU 结束，调用栈清空`);
  });
  if (t === topic.timerDelay) {
    const blocked = topic.cases.filter((item) => item.cpuDuration > t).map((item) => item.label);
    events.push(
      blocked.length
        ? `timer 到期 —— 但 ${blocked.join(" / ")} 的调用栈仍被占用，callback 只能继续等`
        : "timer 到期",
    );
  }
  topic.cases.forEach((item) => {
    if (t === item.callbackAt) {
      events.push(`${item.label}：callback 执行，迟到 ${item.lateBy}ms`);
    }
  });
  return events.join("；") || `${t}ms`;
}

function CpuBlockingVisual({ topic }: { topic: CpuBlockingKnowledge }) {
  const frames = useMemo(() => buildCpuFrames(topic), [topic]);
  const player = useFramePlayer(frames.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(cpuNarration(topic, frames[i] ?? 0)),
  });
  const t = frames[player.index];
  const timerPosition = `${(topic.timerDelay / TIMELINE_MAX) * 100}%`;
  const timerDue = t >= topic.timerDelay;
  const anyBlocked = topic.cases.some((item) => cpuStateAt(item, t, topic.timerDelay) === "blocked");

  return (
    <section className="w5-cpu-visual">
      <div className="w5-cpu-anim-head">
        <div>
          <span>逐帧对照 · 两组独立实验</span>
          <h4>timer 到期不等于 callback 已获准执行</h4>
        </div>
        <FrameTransport player={player} length={frames.length} />
      </div>

      <div className={`w5-cpu-clock${anyBlocked ? " blocked" : ""}`}>
        <span>实验时钟</span>
        <strong>{t}ms</strong>
        <em>两组分别独立运行，这里并列对照同一时刻的状态，不表示两者并发执行。</em>
      </div>

      <div className="w5-axis" aria-hidden="true">
        <span>0ms</span>
        <span>{topic.timerDelay}ms timer 到期</span>
        <span>{TIMELINE_MAX}ms</span>
      </div>

      <div className="w5-cpu-tracks">
        {topic.cases.map((item) => {
          const state = cpuStateAt(item, t, topic.timerDelay);
          const elapsedCpu = Math.min(t, item.cpuDuration);
          const cpuWidth = `${(elapsedCpu / TIMELINE_MAX) * 100}%`;
          const callbackPosition = `${(item.callbackAt / TIMELINE_MAX) * 100}%`;
          return (
            <div key={item.label} className={`w5-timeline-card ${item.tone} state-${state}`}>
              <div className="w5-timeline-summary">
                <strong>{item.label}</strong>
                <span>CPU {item.cpuDuration}ms</span>
                <span>callback {item.callbackAt}ms</span>
                <b>迟到 {item.lateBy}ms</b>
              </div>
              <div className="w5-timeline">
                {/* 柱长随帧变化，早期帧非常窄；标签留在柱内会溢出到轴外，
                    所以窄到放不下时改挂到柱子右侧。 */}
                <span
                  className={`w5-cpu-span${elapsedCpu / TIMELINE_MAX < 0.22 ? " narrow" : ""}`}
                  style={{ width: `max(6px, ${cpuWidth})` }}
                >
                  <i>调用栈被占用</i>
                </span>
                <span className={`w5-timer-marker${timerDue ? " due" : ""}`} style={{ left: timerPosition }}>
                  <i>timer</i>
                </span>
                <span
                  className={`w5-callback-marker${state === "done" ? " on" : ""}`}
                  style={{ left: callbackPosition }}
                >
                  <i>callback</i>
                </span>
              </div>
              <p className={`w5-cpu-state ${state}`}>
                {state === "blocked" && <i aria-hidden="true">⚠</i>}
                {CPU_STATE_TEXT[state]}
                {state === "done" && `，迟到 ${item.lateBy}ms`}
              </p>
            </div>
          );
        })}
      </div>

      <FrameNarration
        step={player.index + 1}
        text={cpuNarration(topic, t)}
        tone={anyBlocked ? "blocked" : undefined}
      />
    </section>
  );
}

type TpTaskState = "queued" | "running" | "done";

// 帧取自实测的 callback elapsed：0 起步，之后每个不同的完成时刻各一帧。
// 这样可以停在「第一批已完成、第二批刚被空闲 worker 接走」那一帧上——
// 批次正是本知识点的结论，之前的 CSS 生长动画停不住这一刻。
function buildTpFrames(run: ThreadpoolKnowledge["runs"][number]): number[] {
  const marks = new Set<number>([0]);
  run.tasks.forEach((task) => marks.add(task.elapsed));
  return [...marks].sort((a, b) => a - b);
}

function tpStates(run: ThreadpoolKnowledge["runs"][number], t: number): Map<number, TpTaskState> {
  const state = new Map<number, TpTaskState>();
  const batch1 = run.tasks.filter((task) => task.batch === 1);
  const batch2 = run.tasks.filter((task) => task.batch === 2);
  batch1.forEach((task) => state.set(task.id, t >= task.elapsed ? "done" : "running"));
  // 推断部分（与页面下方「推断」文案同一口径）：worker 一空闲就接走下一个等待任务，
  // 所以第 n 个 batch-1 任务完成时，第 n 个 batch-2 任务开始。
  const freed = batch1.filter((task) => t >= task.elapsed).length;
  batch2.forEach((task, index) => {
    if (t >= task.elapsed) state.set(task.id, "done");
    else state.set(task.id, index < freed ? "running" : "queued");
  });
  return state;
}

function tpNarration(run: ThreadpoolKnowledge["runs"][number], t: number): string {
  if (t === 0) {
    return `8 个参数一致的 pbkdf2 任务几乎同时提交；worker 数 = ${run.size}${
      run.size < 8 ? "，少于任务数，多出的任务必须等空位" : "，不少于任务数，无需排队"
    }。`;
  }
  const finished = run.tasks.filter((task) => task.elapsed === t).map((task) => `Task ${task.id}`);
  const batch = run.tasks.find((task) => task.elapsed === t)?.batch;
  const done = run.tasks.filter((task) => t >= task.elapsed).length;
  const tail = done === run.tasks.length ? `；全部 8 个完成，Total ${run.total}ms` : "";
  return `${finished.join(" / ")} 的 callback 开始执行（elapsed ${t}ms，第 ${batch} 批）${tail}`;
}

function ThreadpoolVisual({ topic }: { topic: ThreadpoolKnowledge }) {
  const [size, setSize] = useState(topic.runs[0].size);
  const run = topic.runs.find((r) => r.size === size) ?? topic.runs[0];
  const frames = useMemo(() => buildTpFrames(run), [run]);
  const player = useFramePlayer(frames.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(tpNarration(run, frames[i] ?? 0)),
  });
  const t = frames[Math.min(player.index, frames.length - 1)];
  const states = useMemo(() => tpStates(run, t), [run, t]);

  function pick(nextSize: number) {
    setSize(nextSize);
    player.replay();
  }

  const running = run.tasks.filter((task) => states.get(task.id) === "running").length;
  const queued = run.tasks.filter((task) => states.get(task.id) === "queued").length;
  const done = run.tasks.filter((task) => states.get(task.id) === "done").length;

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
        <FrameTransport player={player} length={frames.length} label={`${t}ms`} />
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

      <div className="w5-tp-tally">
        <span>
          已完成 <strong>{done}</strong>/{run.tasks.length}
        </span>
        <span>
          worker 占用 <strong>{running}</strong>/{run.size}
        </span>
        <span>
          队列等待 <strong>{queued}</strong>
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

      <FrameNarration step={player.index + 1} text={tpNarration(run, t)} />

      <ThreadpoolTrack run={run} axisMax={topic.axisMax} now={t} states={states} />

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

// 柱长由当前帧的时钟决定，不再由 CSS 过渡自己跑完：这样任意一帧都能停住，
// 并且「谁在跑、谁在队列里等」与上方的 worker 槽位是同一份状态。
function ThreadpoolTrack({
  run,
  axisMax,
  now,
  states,
}: {
  run: ThreadpoolKnowledge["runs"][number];
  axisMax: number;
  now: number;
  states: Map<number, TpTaskState>;
}) {
  return (
    <div className="w5-tp-track">
      <div className="w5-tp-axis" aria-hidden="true">
        <span>0</span>
        <span>{Math.round(axisMax / 2)}ms</span>
        <span>{axisMax}ms</span>
      </div>
      {run.tasks.map((task) => {
        const state = states.get(task.id) ?? "queued";
        // 队列中的任务还没开始计算，柱长为 0；运行中的按当前时钟生长；完成的锁在实测 elapsed。
        const shown = state === "queued" ? 0 : Math.min(now, task.elapsed);
        return (
          <div key={task.id} className={`w5-tp-row batch-${task.batch} ${state}`}>
            <span className="w5-tp-rowlabel">Task {task.id}</span>
            <div className="w5-tp-lane">
              <span className="w5-tp-bar" style={{ width: `${(shown / axisMax) * 100}%` }} />
              {state === "queued" && <em className="w5-tp-waiting">等 worker 空位</em>}
            </div>
            <span className="w5-tp-elapsed">{state === "done" ? `${task.elapsed}ms` : "—"}</span>
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
  // 这里动画本身是内容（驻留累积 vs 逐块交付），解说是随帧变化的读数而不是要逐帧读完的
  // 散文，所以不按字数拉长——那会让「在流动」这件事看不出来。只把 780ms 放慢到能跟上。
  const player = useFramePlayer(SM_CHUNKS, { interval: 1500, loop: true });
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
          <FrameTransport player={player} length={SM_CHUNKS} />
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
        {/* 逐帧解说：自动播放时画面在变，没有 live region 的话整段动画对读屏用户是静默的。
            知识点 5、6 早就有，这里补齐同组内的一致性。 */}
        <FrameNarration
          step={f + 1}
          text={
            f >= SM_CHUNKS - 1
              ? `第 ${SM_CHUNKS} 块读完：整块读取到这一刻才首次交付，驻留达到 ${SM_CHUNKS} 块的峰值；流式在第 1 块时就已开始交付，驻留始终约 1 块。`
              : `第 ${f + 1} / ${SM_CHUNKS} 块：整块读取驻留 ${wholeResident} 块、已交付 ${wholeDelivered} 块（仍在等完整内容）；流式驻留约 ${streamResident} 块、已交付 ${streamDelivered} 块。`
          }
        />

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
  // 同上：背压闭环要靠缓冲区涨落看出来，按字数拉长会破坏节奏感。680ms 实测跟不上，放慢一倍。
  const player = useFramePlayer(frames.length, { interval: 1400, loop: true });
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
          <FrameTransport player={player} length={frames.length} />
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
  const player = useFramePlayer(steps.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(steps[i] ?? ""),
  });
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
          <FrameTransport player={player} length={steps.length} />
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

type WkState = "idle" | "computing" | "done";

interface WkLane {
  state: WkState;
  heartbeat: number;
  ping: number | null;
  note: string;
}

interface WkFrame {
  title: string;
  narration: string;
  main: WkLane;
  worker: WkLane;
}

const WK_STATE_TEXT: Record<WkState, string> = {
  idle: "空闲",
  computing: "计算中",
  done: "已响应",
};

// 帧序列直接由实测数值拼成：空闲基线 → 请求到达 → 计算期间 heartbeat → 计算期间 /ping → 响应完成。
// 知识点 7 的结论「谁被挡住了」本质是一个时间过程，静态柱状图表达不了「此刻主线程进不了调用栈」。
function buildWorkerFrames(topic: WorkerKnowledge): WkFrame[] {
  const byTone = <T extends { tone: string; value: number; note: string }>(list: T[], tone: string) =>
    list.find((item) => item.tone === tone);
  const baseline = byTone(topic.heartbeat, "baseline")?.value ?? 0;
  const blocked = byTone(topic.heartbeat, "blocked")?.value ?? 0;
  const responsive = byTone(topic.heartbeat, "responsive")?.value ?? 0;
  const pingBlocked = byTone(topic.ping, "blocked")?.value ?? 0;
  const pingResponsive = byTone(topic.ping, "responsive")?.value ?? 0;
  const elapsedMain = topic.requestElapsed[0]?.value ?? 0;
  const elapsedWorker = topic.requestElapsed[1]?.value ?? 0;

  const idle = (note: string): WkLane => ({ state: "idle", heartbeat: baseline, ping: null, note });

  return [
    {
      title: "空闲基线",
      narration: `两组都空闲：100ms interval 的 heartbeat 最大相邻 gap 均为 ${baseline}ms。这是后面所有对比的基准。`,
      main: idle("heartbeat 准时"),
      worker: idle("heartbeat 准时"),
    },
    {
      title: "请求到达",
      narration: "两组同时收到同一个请求，都要等 fib(40) 算完才响应——唯一变量是这份计算在哪个线程上跑。",
      main: { state: "computing", heartbeat: baseline, ping: null, note: "在 JS 主线程直接开算" },
      worker: { state: "computing", heartbeat: baseline, ping: null, note: "创建 Worker，计算移出主线程" },
    },
    {
      title: "计算期间 · heartbeat",
      narration: `计算进行中：主线程组的 timer callback 进不了调用栈，最大 gap 被拉到 ${blocked}ms；Worker 组仍是 ${responsive}ms，保持在空闲基线。`,
      main: {
        state: "computing",
        heartbeat: blocked,
        ping: null,
        note: "调用栈被占满，timer callback 无法进入",
      },
      worker: {
        state: "computing",
        heartbeat: responsive,
        ping: null,
        note: "计算在独立 V8 isolate，event loop 未被占用",
      },
    },
    {
      title: "计算期间 · 独立 /ping",
      narration: `此时从独立终端发一个 /ping：主线程组要等 ${pingBlocked}ms 才被处理，Worker 组约 ${pingResponsive}ms——这就是「保护其他请求的响应性」的可观察含义。`,
      main: {
        state: "computing",
        heartbeat: blocked,
        ping: pingBlocked,
        note: "其他请求被同一条调用栈挡住",
      },
      worker: {
        state: "computing",
        heartbeat: responsive,
        ping: pingResponsive,
        note: "其他请求照常被主线程接走",
      },
    },
    {
      title: "响应完成",
      narration: `计算完成并响应：主线程组 ${elapsedMain}ms，Worker 组 ${elapsedWorker}ms。单次耗时接近——它只说明本轮任务本身的耗时，不支持「Worker 更快」的结论。`,
      main: { state: "done", heartbeat: baseline, ping: null, note: `本次请求 elapsed ${elapsedMain}ms` },
      worker: { state: "done", heartbeat: baseline, ping: null, note: `本次请求 elapsed ${elapsedWorker}ms` },
    },
  ];
}

function WorkerLaneCard({
  name,
  owner,
  lane,
  hbMax,
  pingMax,
  tone,
}: {
  name: string;
  owner: string;
  lane: WkLane;
  hbMax: number;
  pingMax: number;
  tone: "main" | "worker";
}) {
  return (
    <article className={`w5-wk-lane ${tone} ${lane.state}`}>
      <header>
        <div>
          <strong>{name}</strong>
          <span>{owner}</span>
        </div>
        <em className={`w5-wk-state ${lane.state}`}>{WK_STATE_TEXT[lane.state]}</em>
      </header>
      <div className="w5-wk-metric">
        <span>heartbeat 最大 gap</span>
        <div className="w5-wk-bar">
          <i
            className={lane.heartbeat > 200 ? "blocked" : "responsive"}
            style={{ width: `${Math.max(3, (lane.heartbeat / hbMax) * 100)}%` }}
          />
        </div>
        <b>{lane.heartbeat}ms</b>
      </div>
      <div className={`w5-wk-metric${lane.ping === null ? " off" : ""}`}>
        <span>独立 /ping</span>
        <div className="w5-wk-bar">
          {lane.ping !== null && (
            <i
              className={lane.ping > 100 ? "blocked" : "responsive"}
              style={{ width: `${Math.max(3, (lane.ping / pingMax) * 100)}%` }}
            />
          )}
        </div>
        <b>{lane.ping === null ? "—" : `${lane.ping}ms`}</b>
      </div>
      <p>{lane.note}</p>
    </article>
  );
}

function WorkerVisual({ topic }: { topic: WorkerKnowledge }) {
  const heartbeatMax = Math.max(...topic.heartbeat.map((item) => item.value));
  const pingMax = Math.max(...topic.ping.map((item) => item.value));
  const frames = useMemo(() => buildWorkerFrames(topic), [topic]);
  const player = useFramePlayer(frames.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(frames[i]?.narration ?? ""),
  });
  const frame = frames[player.index];

  return (
    <div className="w5-worker">
      <p className="w5-worker-contract"><b>唯一变量</b>{topic.sharedWork}</p>

      <section className="w5-wk-anim" aria-label="主线程与 Worker 在同一份计算下的响应性逐帧对照">
        <div className="w5-wk-anim-head">
          <div>
            <span>逐帧对照 · 按实测数值脚本化</span>
            <h4>{frame.title}</h4>
          </div>
          <FrameTransport player={player} length={frames.length} />
        </div>
        <div className="w5-wk-lanes">
          <WorkerLaneCard
            name="主线程组"
            owner="fib(40) 在 JS 主线程"
            lane={frame.main}
            hbMax={heartbeatMax}
            pingMax={pingMax}
            tone="main"
          />
          <WorkerLaneCard
            name="Worker 组"
            owner="fib(40) 在 Worker"
            lane={frame.worker}
            hbMax={heartbeatMax}
            pingMax={pingMax}
            tone="worker"
          />
        </div>
        <FrameNarration
          step={player.index + 1}
          text={frame.narration}
          tone={frame.main.state === "computing" ? "blocked" : undefined}
        />
      </section>

      {/* 上面的逐帧对照负责「什么时候发生了什么」；下面这两张仍保留原始测量值的并排读数。 */}
      <section className="w5-worker-metrics" aria-label="主线程与 Worker 响应性对照">
        <div className="w5-worker-chart">
          <div className="w5-subsection-head">
            <span>event loop response · 原始读数</span>
            <h4>最大 heartbeat gap</h4>
          </div>
          {topic.heartbeat.map((item) => (
            <div className={`w5-worker-bar ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <i style={{ width: `${Math.max(4, (item.value / heartbeatMax) * 100)}%` }} />
              <strong>{item.value}ms</strong>
              <small>{item.note}</small>
            </div>
          ))}
        </div>

        <div className="w5-worker-chart">
          <div className="w5-subsection-head">
            <span>independent request</span>
            <h4>计算期间 /ping</h4>
          </div>
          {topic.ping.map((item) => (
            <div className={`w5-worker-bar ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <i style={{ width: `${Math.max(4, (item.value / pingMax) * 100)}%` }} />
              <strong>{item.value}ms</strong>
              <small>{item.note}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="w5-worker-elapsed">
        <span>当前请求 elapsed（不是验收目标）</span>
        {topic.requestElapsed.map((item) => (
          <p key={item.label}><b>{item.label}</b><strong>{item.value}ms</strong></p>
        ))}
        <small>单次结果接近，只能说明本轮任务耗时；不能据此声称 Worker 加速或减速。</small>
      </div>

      <ol className="w5-worker-ownership">
        {topic.ownership.map((item, index) => (
          <li key={item.owner}>
            <b>{index + 1}</b>
            <strong>{item.owner}</strong>
            <span>{item.action}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type ShutMode = "graceful" | "timeout";
type ShutStepState = "pending" | "active" | "done" | "aborted";

interface ShutSnapshot {
  accepting: string;
  inflight: string;
  db: string;
  exit: string;
  tone: "run" | "drain" | "good" | "bad";
}

// 关停链的顺序来自真实 server.js 的实现，不是一次计时实测——所以这里标「模型示意」，
// 不套用数据流组的「按实测节奏脚本化」。超时分支同理：它是 deadline 契约的推演，
// 不是某一次观测到的强杀记录。
function shutSnapshot(mode: ShutMode, frame: number, lastGraceful: number): ShutSnapshot {
  if (mode === "timeout" && frame >= 4) {
    return {
      accepting: "否",
      inflight: "未排空 · 被强制中断",
      db: "未确认",
      exit: "1",
      tone: "bad",
    };
  }
  if (frame >= lastGraceful) {
    return { accepting: "否", inflight: "已排空", db: "已断开", exit: "0", tone: "good" };
  }
  if (frame >= 4) {
    return { accepting: "否", inflight: "已排空", db: "已断开", exit: "—", tone: "drain" };
  }
  if (frame >= 3) {
    return { accepting: "否", inflight: "排空中", db: "已连接", exit: "—", tone: "drain" };
  }
  return { accepting: "是", inflight: "处理中", db: "已连接", exit: "—", tone: "run" };
}

function LifecycleVisual({ topic }: { topic: LifecycleKnowledge }) {
  const [mode, setMode] = useState<ShutMode>("graceful");
  const steps = topic.shutdownSteps;
  const lastGraceful = steps.length - 1;
  // 正常关停走完全部步骤；超时分支在「HTTP 排空」处被 deadline 打断，多一帧终止帧。
  const frameCount = mode === "graceful" ? steps.length : 5;
  const player = useFramePlayer(frameCount, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(steps[Math.min(i, steps.length - 1)]?.detail ?? ""),
  });
  const frame = Math.min(player.index, frameCount - 1);
  const snap = shutSnapshot(mode, frame, lastGraceful);
  const aborted = mode === "timeout" && frame >= 4;

  function switchMode(next: ShutMode) {
    setMode(next);
    player.replay();
  }

  function stepState(index: number): ShutStepState {
    if (aborted) {
      if (index === 3) return "aborted";
      return index < 3 ? "done" : "pending";
    }
    if (index < frame) return "done";
    if (index === frame) return "active";
    return "pending";
  }

  const narration = aborted
    ? `30s deadline 到期，HTTP 连接仍未排空：不再等待，直接 process.exit(1)。deadline 覆盖到数据库断开，所以这条路径下 DB 状态是「未确认」而不是「已断开」。`
    : frame >= lastGraceful
      ? `关停链全部完成：不再接收、在途已排空、数据库已断开，exitCode = 0。`
      : `${steps[frame].title}：${steps[frame].detail}`;

  return (
    <div className="w5-lifecycle">
      <section className="w5-capture-matrix" aria-label="错误和信号接管边界">
        {topic.captureRows.map((item) => (
          <article className={item.tone} key={item.scope}>
            <span>{item.scope}</span>
            <strong>{item.boundary}</strong>
            <p>{item.examples}</p>
            <small>{item.outcome}</small>
          </article>
        ))}
      </section>

      <section className="w5-shutdown-flow">
        <div className="w5-shut-head">
          <div className="w5-subsection-head">
            <span>planned termination · 模型示意</span>
            <h4>Single-flight graceful shutdown</h4>
          </div>
          <div className="w5-shut-controls">
            <div className="w5-shut-toggle" role="group" aria-label="关停路径">
              <button
                type="button"
                className={mode === "graceful" ? "on" : ""}
                onClick={() => switchMode("graceful")}
              >
                正常关停
              </button>
              <button
                type="button"
                className={mode === "timeout" ? "on" : ""}
                onClick={() => switchMode("timeout")}
              >
                deadline 超时
              </button>
            </div>
            <FrameTransport player={player} length={frameCount} />
          </div>
        </div>

        <div className={`w5-shut-snapshot ${snap.tone}`}>
          <div>
            <span>接收新连接</span>
            <strong>{snap.accepting}</strong>
          </div>
          <div>
            <span>在途请求</span>
            <strong>{snap.inflight}</strong>
          </div>
          <div>
            <span>数据库连接</span>
            <strong>{snap.db}</strong>
          </div>
          <div className="exit">
            <span>退出码</span>
            <strong>{snap.exit}</strong>
          </div>
        </div>

        {/* deadline 卡片插在被打断的那一步之后，而不是追加到末尾——
            否则它会排到「明确退出」右边，箭头顺序反而暗示先断库再超时。 */}
        <ol className={`w5-shut-steps ${mode}${aborted ? " aborted" : ""}`}>
          {steps.flatMap((step, index) => {
            const state = stepState(index);
            const node = (
              <li key={step.title} className={state}>
                <b>{state === "done" ? "✓" : state === "aborted" ? "!" : index + 1}</b>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            );
            if (!aborted || index !== 3) return [node];
            return [
              node,
              <li key="__deadline" className="deadline">
                <b>!</b>
                <strong>deadline 到期</strong>
                <span>不再等待在途连接，process.exit(1)</span>
              </li>,
            ];
          })}
        </ol>

        <FrameNarration step={frame + 1} text={narration} tone={aborted ? "blocked" : undefined} />
        <p className="w5-shut-note">
          顺序取自真实 <code>server.js</code> 的关停链（模型），不是一次带计时的实测记录；
          超时分支是 deadline 契约的推演，用于说明「应用内 deadline 保证退出，但不保证收尾完整」。
        </p>
      </section>

      <p className="w5-fatal-rule"><b>Fatal 边界</b>{topic.fatalRule}</p>
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
