// W9 部署链路板 · 阶段 1 代表页「故障分叉」。展示资产（AGENTS.md 白名单）。
//
// 为什么先做这一块：W9 迁移价值最高的一条结论是「两个 502 外部现象完全相同，
// 靠第一个排查动作的结果分叉」。它在笔记里是三段并列的 text 块，读者要自己对齐；
// 而它恰好是 week8 认证链 401/403/200 已经验证过的形态——同一条链路切换停止点。
//
// 本板同时要证明本轮新增的两条语法成立，之后才推其余五块：
//   1. 信任边界用「面 + 文字标签」表达，不新增颜色；
//   2. 每条路径强制挂证据档位（实测 / 推演 / 待做），渲染时不允许省略。
// 第 2 条是 W9 与 week8 的实质差别：四条路径里只有一条是实测的，做成图之后
// 极易被读成「都验证过」。
//
// 范围与其余五块见 week9-deployment/notes/week9-visualization-plan.md。
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { FrameNarration, FrameTransport, dwellByText, useFramePlayer } from "./framePlayer";
import { tabKeyDown } from "./tabs";
import type { BoardMode } from "./types";
import {
  ACCEPTANCE_READINGS,
  CHAIN_NODES,
  EVIDENCE_GRADE,
  FAST_FAIL_OBSERVED,
  INJECTION_BLIND_SPOT,
  PLANE_LABEL,
  STARTUP_ORDER_NOTE,
  SYSTEMD_LIMITS,
  type ChainNode,
  type EvidenceGrade,
} from "./w9Facts";
import {
  DISCRIMINATOR_ROWS,
  FAILURE_MODES,
  FAILURE_PATHS,
  FORK_RULE,
  LIMIT_RULE,
  W9_STAGE_PLAN,
  type FailureMode,
  type FailurePath,
} from "./w9Topics";

const PATH_TAB_IDS = FAILURE_PATHS.map((item) => `w9-path-tab-${item.id}`);

/** 三条连接线：0 = 客户端→Nginx（跨公网），1 = Nginx→Node，2 = Node→Mongo。 */
const LINKS: Array<{ from: string; to: string }> = [
  { from: "client", to: "nginx" },
  { from: "nginx", to: "node" },
  { from: "node", to: "mongo" },
];

const nodeState = (index: number, activeIndex: number) =>
  index === activeIndex ? "current" : index < activeIndex ? "passed" : "ahead";

/** 这条路径断在第几条线上；正常路径返回 null。 */
function brokenLink(path: FailurePath): number | null {
  const last = path.frames[path.frames.length - 1];
  if (path.tone !== "failure" || !last.to) return null;
  return LINKS.findIndex((l) => l.from === last.at && l.to === last.to);
}

function linkState(path: FailurePath, index: number, link: number): string {
  const { from, to } = LINKS[link];
  const frameIdx = path.frames.findIndex((f) => f.at === from && f.to === to);
  // 本路径根本不经过这条线（例如 502 从来走不到 Node→Mongo）。
  if (frameIdx === -1) return "unused";
  if (index < frameIdx) return "ahead";
  if (index > frameIdx) return "passed";
  const isStopFrame = frameIdx === path.frames.length - 1 && path.tone === "failure";
  return isStopFrame ? "broken" : "current";
}

/** 舞台是 role="img"，给读屏一句等价描述，否则整张图对他们是空的。 */
function stageSummary(path: FailurePath, index: number): string {
  const frame = path.frames[Math.min(index, path.frames.length - 1)];
  const at = CHAIN_NODES.find((n) => n.id === frame.at)?.name ?? "";
  const to = frame.to ? CHAIN_NODES.find((n) => n.id === frame.to)?.name : null;
  const atStop = index >= path.frames.length - 1;
  const where = to ? `${at} 正在送往 ${to}` : `请求位于 ${at}`;
  if (!atStop) return `路径「${path.label}」：${where}。`;
  return path.tone === "success"
    ? `路径「${path.label}」：请求走完四跳，外部得到 ${path.status}。`
    : `路径「${path.label}」：${to ? `${at} 到 ${to} 这条线断开` : where}，外部得到 ${path.status}。`;
}

/** 已落地的专题。未落地的五块只在底部进度条里出现，不做成点不开的 tab。 */
const W9_TOPICS = [
  { id: "failure", label: "故障分叉", question: "两个 502 差在哪" },
  { id: "systemd", label: "systemd 失败模式", question: "崩溃循环怎么被停住" },
] as const;

const TOPIC_TAB_IDS = W9_TOPICS.map((t) => `w9-topic-tab-${t.id}`);

export default function W9Board({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const review = mode === "review";
  const activeIndex = Math.max(0, W9_TOPICS.findIndex((t) => t.id === topic));
  const active = W9_TOPICS[activeIndex];

  return (
    <>
      <header className="w6-head">
        <div>
          <span>W9 · Deployment</span>
          <h2>从零到线上：请求经过哪些层，坏了先看哪里</h2>
          <p>
            最小闭环是外部 → Nginx → 只监听 loopback 的 Node → 只监听 loopback 的 MongoDB。
            每个专题只回答一个问题，并且都要说清结论是跑出来的还是推出来的。
          </p>
        </div>
        <strong className="w9-stage-badge">{W9_TOPICS.length} / 6 已落地</strong>
      </header>

      <div
        className="w9-topic-switch"
        role="tablist"
        aria-label="W9 专题"
        onKeyDown={tabKeyDown(TOPIC_TAB_IDS, activeIndex, (i) => onTopicChange(W9_TOPICS[i].id))}
      >
        {W9_TOPICS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            id={`w9-topic-tab-${item.id}`}
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls="w9-topic-panel"
            tabIndex={i === activeIndex ? 0 : -1}
            className={i === activeIndex ? "on" : ""}
            onClick={() => onTopicChange(item.id)}
          >
            <strong>{item.label}</strong>
            <small>{item.question}</small>
          </button>
        ))}
      </div>

      <GradeLegend />

      <div id="w9-topic-panel" role="tabpanel" aria-labelledby={`w9-topic-tab-${active.id}`}>
        {active.id === "systemd" ? <SystemdModes review={review} /> : <FailureFork review={review} />}
      </div>

      <StagePlan />
    </>
  );
}

/* 证据档位图例。本轮新增的语法，全板只解释一次。 */
function GradeLegend() {
  return (
    <section className="w9-grade-legend" aria-label="证据档位说明">
      <div className="w6-section-head">
        <span>evidence grading</span>
        <h3>每条路径都必须说清「这是跑出来的，还是推出来的」</h3>
      </div>
      <div className="w9-grade-legend-grid">
        {(Object.keys(EVIDENCE_GRADE) as EvidenceGrade[]).map((grade) => (
          <article key={grade} className={`w9-grade-${grade}`}>
            <GradeChip grade={grade} />
            <p>{EVIDENCE_GRADE[grade].meaning}</p>
          </article>
        ))}
      </div>
      <p className="w9-grade-legend-note" role="note">
        这块板里<b>实测的部分是少数</b>：故障分叉四条路径只有「正常」跑过，systemd 只有快失败跑过。
        其余来自 D1 冻结时的设计推演或契约推导。把它们画成同一种确定性，是最容易犯的错。
      </p>
    </section>
  );
}

function GradeChip({ grade }: { grade: EvidenceGrade }) {
  return (
    <span className={`w9-grade-chip ${grade}`}>
      {EVIDENCE_GRADE[grade].label}
    </span>
  );
}

/* 故障分叉主体：路径切换 + 逐帧链路 + 排障三连 + 判据对照 + 分叉规则。 */
function FailureFork({ review }: { review: boolean }) {
  const [pathId, setPathId] = useState(FAILURE_PATHS[0].id);
  const [revealed, setRevealed] = useState(false);
  const path = FAILURE_PATHS.find((item) => item.id === pathId) ?? FAILURE_PATHS[0];
  // 两条都跟着内容形态定：
  // 1. 不自动播放——认证链、W6 八段轨道、W3 pipeline 这些「请求走链路 + 每步带说明」
  //    的板全都是 autoPlay: false，节奏由读者掌握；自动播放只适合 W5 那种短状态标签。
  //    第一版沿用了 hook 的默认值 true，等于选了个和内容不匹配的约定。
  // 2. 停留时间跟解说长度走（dwellByText，全展板共用）。
  const player = useFramePlayer(path.frames.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(path.frames[i]?.narration ?? ""),
  });

  // 切路径回到第 1 帧：不重置的话会停在上一条路径的末帧上，读成「这条也走到了那里」。
  // 刻意不放进 useEffect —— replay 每次渲染都是新的函数身份，作为依赖会让效果每帧重跑，
  // 把 index 一直摁回 0，链路就再也推不动了。改由选择动作本身触发，点击与方向键共用。
  function selectPath(id: string) {
    setPathId(id);
    player.replay();
  }

  // 切换展示 / 复习时收回答案，避免复习态一进来就看到上一次揭示的结果。
  useEffect(() => {
    setRevealed(false);
  }, [review]);

  const frame = path.frames[Math.min(player.index, path.frames.length - 1)];
  const atStop = player.index >= path.frames.length - 1;
  const showAnswer = !review || revealed;
  const activeIndex = CHAIN_NODES.findIndex((node) => node.id === frame.at);
  const stopIndex = CHAIN_NODES.findIndex(
    (node) => node.id === (path.frames[path.frames.length - 1].to ?? path.frames[path.frames.length - 1].at),
  );

  return (
    <section className="w9-fork" aria-label="故障分叉">
      <div className="w6-section-head">
        <span>same chain, four stops</span>
        <h3>条件在标签上，结论在链路里——先走完再看状态码</h3>
      </div>

      <div
        className="w9-path-switch"
        role="tablist"
        aria-label="链路结局"
        onKeyDown={tabKeyDown(
          PATH_TAB_IDS,
          FAILURE_PATHS.findIndex((item) => item.id === pathId),
          (index) => selectPath(FAILURE_PATHS[index].id),
        )}
      >
        {FAILURE_PATHS.map((item) => {
          const selected = item.id === pathId;
          return (
            <button
              key={item.id}
              type="button"
              id={`w9-path-tab-${item.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls="w9-path-panel"
              tabIndex={selected ? 0 : -1}
              className={selected ? "on" : ""}
              onClick={() => selectPath(item.id)}
            >
              <strong>{item.label}</strong>
              <small>{item.grade === "measured" ? "实测" : item.grade === "derived" ? "推演" : "待做"}</small>
            </button>
          );
        })}
      </div>

      <div id="w9-path-panel" role="tabpanel" aria-labelledby={`w9-path-tab-${path.id}`}>
        <p className="w9-condition">
          <b>条件</b>
          {path.condition}
        </p>

        {/* 舞台：两个信任面各是一个真的包围框，请求沿连接线走，断点落在线上而不是节点上。
            502 断在 Nginx→Node 那条线，500 断在 Node→Mongo 那条线——位置本身就是结论。 */}
        <div className="w9-stage-scroll">
          <div className="w9-stage" role="img" aria-label={stageSummary(path, player.index)}>
            <Plane kind="client" label={PLANE_LABEL.client}>
              <Node node={CHAIN_NODES[0]} state={nodeState(0, activeIndex)} />
            </Plane>

            <Link path={path} index={player.index} link={0} />

            <Plane kind="public" label={PLANE_LABEL.public} gate="ufw 只放行 22 / 80">
              <Node node={CHAIN_NODES[1]} state={nodeState(1, activeIndex)} />
            </Plane>

            <Link path={path} index={player.index} link={1} />

            <Plane kind="loopback" label={PLANE_LABEL.loopback}>
              <Node
                node={CHAIN_NODES[2]}
                state={nodeState(2, activeIndex)}
                stopLabel={atStop && stopIndex === 2 ? path.stopLabel : undefined}
                tone={path.tone}
              />
              <Link path={path} index={player.index} link={2} />
              <Node
                node={CHAIN_NODES[3]}
                state={nodeState(3, activeIndex)}
                stopLabel={atStop && stopIndex === 3 ? path.stopLabel : undefined}
                tone={path.tone}
              />
            </Plane>
          </div>
        </div>

        {/* 当前这一跳负责什么，只在走到它时给——四个节点常驻四段说明是上一版最主要的文字堆积。 */}
        <p className="w9-role-now">
          <b>{CHAIN_NODES[activeIndex]?.name}</b>
          {CHAIN_NODES[activeIndex]?.role}
          {CHAIN_NODES[activeIndex]?.term && <em>{CHAIN_NODES[activeIndex].term}</em>}
        </p>

        {/* 手机端舞台会局部横向滚动，这条轨道给出可扫读的四跳与当前位置。 */}
        <div className="mobile-scroll-cue w9-chain-cue" aria-hidden="true">
          {CHAIN_NODES.map((node, index) => (
            <span key={node.id} className={index === activeIndex ? "on" : ""}>
              {index + 1}
              <small>{node.name}</small>
            </span>
          ))}
        </div>

        <FrameTransport player={player} length={path.frames.length} label="请求推进" />
        <FrameNarration
          step={player.index + 1}
          text={frame.narration}
          tone={atStop ? (path.tone === "success" ? "status-200" : "blocked") : undefined}
        />

        {/* 状态码走到停止点之后才揭示：从一开始就摆着的标签，会把「推导结论」变成「已知条件」。 */}
        <div className={`w9-status-reveal${atStop ? " on" : ""}`} role="status">
          {atStop ? (
            <>
              <span>外部看到</span>
              <strong className={path.tone}>{path.status}</strong>
              <small>
                {path.tone === "success" ? ACCEPTANCE_READINGS.sample : "请求没有走完这条链路"}
              </small>
            </>
          ) : (
            <span className="w9-status-pending">走到停止点后揭示状态码</span>
          )}
        </div>

        {/* 档位说明必须与图相邻，不能只放折叠区。 */}
        <p className={`w9-grade-note ${path.grade}`}>
          <GradeChip grade={path.grade} />
          <span>{path.gradeNote}</span>
        </p>

        {path.id === "boot-db-down" && (
          <p className="w9-startup-note" role="note">
            <b>为什么连不上就等于没监听</b>
            {STARTUP_ORDER_NOTE}
          </p>
        )}
        {path.id === "ok" && (
          <p className="w9-startup-note" role="note">
            <b>反代确实贯通的反证</b>
            {ACCEPTANCE_READINGS.proxyProof}
          </p>
        )}

        {/* 复习态先只给条件与现象，答案（怎么查、判据是什么）由局部 reveal 展开。 */}
        {!showAnswer ? (
          <div className="w9-reveal-gate">
            <strong>先答：现在只知道外部拿到 502</strong>
            <p>
              说出<b>第一个排查动作</b>，以及这个动作的两种结果分别指向哪条路径、下一步该看什么。
              再说一句：什么情况下外部看到的会是 500 而不是 502。
            </p>
            <button type="button" onClick={() => setRevealed(true)}>展开排查路线与判据</button>
          </div>
        ) : (
          <>
            {/* 正常路径没有可排查的东西，渲染两个空框只会是噪声。 */}
            {path.tone === "failure" && (
              <div className="w9-triage">
                <article className="w9-triage-action">
                  <span>第一个排查动作</span>
                  <code>{path.firstAction}</code>
                </article>
                <article className="w9-triage-cause">
                  <span>根因</span>
                  <p>{path.rootCause}</p>
                </article>
              </div>
            )}

            <StopOverview current={path.id} onSelect={selectPath} />
            <DiscriminatorTable />
            <ForkRule />
          </>
        )}
      </div>
    </section>
  );
}

/* ---- 舞台构件 ---- */

/** 信任面：一个真的包围框，不是给每个节点各描一道边。 */
function Plane({
  kind,
  label,
  gate,
  children,
}: {
  kind: ChainNode["plane"];
  label: string;
  gate?: string;
  children: ReactNode;
}) {
  return (
    <div className={`w9-plane ${kind}`}>
      <span className="w9-plane-label">{label}</span>
      {gate && <span className="w9-plane-gate">{gate}</span>}
      <div className="w9-plane-body">{children}</div>
    </div>
  );
}

function Node({
  node,
  state,
  stopLabel,
  tone,
}: {
  node: ChainNode;
  state: string;
  stopLabel?: string;
  tone?: string;
}) {
  return (
    <div className={`w9-node ${state}${stopLabel ? ` stop ${tone}` : ""}`}>
      <strong>{node.name}</strong>
      <code>{node.addr}</code>
      {stopLabel && <span className={`w9-node-stop ${tone}`}>{stopLabel}</span>}
    </div>
  );
}

/**
 * 连接线。断点画在线上：502 断在 Nginx→Node，500 断在 Node→Mongo——
 * 断在哪条线本身就是「停得多深」这个结论，比把红色涂在某个节点上准确。
 */
function Link({ path, index, link }: { path: FailurePath; index: number; link: number }) {
  const state = linkState(path, index, link);
  return (
    <div className={`w9-link ${state}`} aria-hidden="true">
      <i className="w9-link-line" />
      <span className="w9-link-mark">{state === "broken" ? "✕" : "›"}</span>
    </div>
  );
}

/* 一眼结论图：四条路径分别断在哪，一屏看完，不用点四次。 */
function StopOverview({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
  return (
    <div className="w9-overview">
      <span className="w9-overview-label">四种停法的位置对照</span>
      <div className="w9-overview-rows">
        {FAILURE_PATHS.map((item) => {
          const broken = brokenLink(item);
          return (
            <button
              key={item.id}
              type="button"
              className={`w9-overview-row${item.id === current ? " on" : ""}`}
              onClick={() => onSelect(item.id)}
              aria-pressed={item.id === current}
            >
              <span className="w9-overview-name">{item.label}</span>
              <span className="w9-mini" aria-hidden="true">
                {CHAIN_NODES.map((node, i) => (
                  <Fragment key={node.id}>
                    {i > 0 && (
                      <i
                        className={`w9-mini-link${
                          broken === null || i - 1 < broken ? " passed" : broken === i - 1 ? " broken" : " unused"
                        }`}
                      />
                    )}
                    <i
                      className={`w9-mini-dot${
                        broken === null || i <= broken ? " reached" : " unreached"
                      }`}
                    />
                  </Fragment>
                ))}
              </span>
              <em className={item.tone}>{item.status}</em>
            </button>
          );
        })}
      </div>
      <p className="w9-overview-note">
        两条 502 断在<b>同一条线</b>上——所以外部现象一样。500 断得更深，请求已经进到应用里了。
      </p>
    </div>
  );
}

/* 判据对照：四条路径 × 四个观察点。决定性的两格单独标出。 */
function DiscriminatorTable() {
  return (
    <div className="w9-matrix" role="table" aria-label="四条路径的判据对照">
      <div className="w9-matrix-head" role="row">
        <span role="columnheader">观察点</span>
        {FAILURE_PATHS.map((path) => (
          <span key={path.id} role="columnheader">
            {path.label}
          </span>
        ))}
      </div>
      {DISCRIMINATOR_ROWS.map((row, index) => (
        <div key={row} className="w9-matrix-row" role="row">
          <code role="rowheader">{row}</code>
          {FAILURE_PATHS.map((path) => {
            const cell = path.discriminators[index];
            return (
              <span
                key={path.id}
                role="cell"
                // 手机端表头被隐藏，靠这个属性在每格前重复列语义，不靠横向记忆。
                data-path={path.label}
                className={`w9-matrix-cell${cell.key ? " key" : ""}`}
              >
                {cell.value}
              </span>
            );
          })}
        </div>
      ))}
      <p className="w9-matrix-note">
        标出的格子是决定性判据。注意「反代地址写错」整列都是健康读数——
        <b>所有单点健康检查都会通过</b>，问题在两个健康组件之间的那一行配置。
      </p>
    </div>
  );
}

/* 本板要留下的那条可迁移规则。 */
function ForkRule() {
  return (
    <section className="w9-rule" aria-label="502 的排查分叉">
      <div className="w6-section-head">
        <span>the transferable rule</span>
        <h3>外部现象相同，用第一个动作的<b>结果</b>分叉</h3>
      </div>
      <div className="w9-rule-tree">
        <div className="w9-rule-symptom">
          <span>现象</span>
          <strong>{FORK_RULE.symptom}</strong>
        </div>
        <div className="w9-rule-action">
          <span>第一个动作</span>
          <code>{FORK_RULE.action}</code>
        </div>
        <ul className="w9-rule-branches">
          {FORK_RULE.branches.map((branch) => (
            <li key={branch.result}>
              <em>{branch.result}</em>
              <strong>{branch.conclusion}</strong>
              <p>{branch.next}</p>
            </li>
          ))}
        </ul>
      </div>
      <p className="w9-rule-note" role="note">{FORK_RULE.note}</p>
    </section>
  );
}

/* ==========================================================================
   ③ systemd 失败模式。空间编码是「同一个 60 秒窗口，两种重启密度」：
   快失败 5 次尝试全落在窗口内 → 撞上 StartLimitBurst；
   慢失败一次就吃掉半个窗口 → 计数永远堆不满。
   为什么一个被停住、另一个不会，是从疏密看出来的，不是从两段文字读出来的。
   ========================================================================== */

const MODE_TAB_IDS = FAILURE_MODES.map((m) => `w9-sys-tab-${m.id}`);

function SystemdModes({ review }: { review: boolean }) {
  const [modeId, setModeId] = useState(FAILURE_MODES[0].id);
  const [revealed, setRevealed] = useState(false);
  const mode = FAILURE_MODES.find((m) => m.id === modeId) ?? FAILURE_MODES[0];
  const player = useFramePlayer(mode.frames.length, {
    autoPlay: false,
    intervalAt: (i) => dwellByText(mode.frames[i]?.narration ?? ""),
  });

  function selectMode(id: string) {
    setModeId(id);
    player.replay();
  }

  useEffect(() => {
    setRevealed(false);
  }, [review]);

  const frame = mode.frames[Math.min(player.index, mode.frames.length - 1)];
  const atEnd = player.index >= mode.frames.length - 1;
  const shown = mode.attempts.slice(0, frame.upto);
  // 窗口内的启动次数：refused 那次是被拒绝的，不计入计数器。
  const inWindow = shown.filter((a) => a.at <= SYSTEMD_LIMITS.windowSec && a.outcome !== "refused").length;
  const showAnswer = !review || revealed;

  return (
    <section className="w9-sys" aria-label="systemd 失败模式">
      <div className="w6-section-head">
        <span>same limiter, two densities</span>
        <h3>同一个 60 秒窗口，两种重启密度</h3>
      </div>

      <div
        className="w9-path-switch w9-sys-switch"
        role="tablist"
        aria-label="失败模式"
        onKeyDown={tabKeyDown(
          MODE_TAB_IDS,
          FAILURE_MODES.findIndex((m) => m.id === modeId),
          (i) => selectMode(FAILURE_MODES[i].id),
        )}
      >
        {FAILURE_MODES.map((item) => {
          const selected = item.id === modeId;
          return (
            <button
              key={item.id}
              type="button"
              id={`w9-sys-tab-${item.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls="w9-sys-panel"
              tabIndex={selected ? 0 : -1}
              className={selected ? "on" : ""}
              onClick={() => selectMode(item.id)}
            >
              <strong>{item.label}</strong>
              <small>{EVIDENCE_GRADE[item.grade].label}</small>
            </button>
          );
        })}
      </div>

      <div id="w9-sys-panel" role="tabpanel" aria-labelledby={`w9-sys-tab-${mode.id}`}>
        <p className="w9-condition">
          <b>问题</b>
          {mode.question}
        </p>

        <Timeline mode={mode} shown={shown} />

        <div className="w9-sys-counter">
          <span>60 秒窗口内的启动次数</span>
          <strong className={inWindow >= SYSTEMD_LIMITS.burst ? "hit" : ""}>
            {inWindow} / {SYSTEMD_LIMITS.burst}
          </strong>
          <small>
            {inWindow >= SYSTEMD_LIMITS.burst
              ? "已达 StartLimitBurst，systemd 拒绝再拉起"
              : `还差 ${SYSTEMD_LIMITS.burst - inWindow} 次才会触发限速`}
          </small>
        </div>

        <FrameTransport player={player} length={mode.frames.length} label="时间推进" />
        <FrameNarration
          step={player.index + 1}
          text={frame.narration}
          tone={atEnd ? (mode.verdictTone === "failure" ? "blocked" : undefined) : undefined}
        />

        <div className={`w9-status-reveal${atEnd ? " on" : ""}`} role="status">
          {atEnd ? (
            <>
              <span>结局</span>
              <strong className={`verdict${mode.verdictTone === "failure" ? " failure" : ""}`}>{mode.verdict}</strong>
            </>
          ) : (
            <span className="w9-status-pending">走完时间轴后揭示结局</span>
          )}
        </div>

        <p className={`w9-grade-note ${mode.grade}`}>
          <GradeChip grade={mode.grade} />
          <span>{mode.gradeNote}</span>
        </p>

        {mode.id === "fast" && <JournalEvidence />}

        {!showAnswer ? (
          <div className="w9-reveal-gate">
            <strong>先答：两种失败为什么结局不同</strong>
            <p>
              两边用的是同一套 <code>RestartSec=10s</code> 与 <code>StartLimitBurst=5 / 60s</code>。
              说出为什么配置写错会被停住、数据库挂了却会一直重试——判据是哪一个量。
            </p>
            <button type="button" onClick={() => setRevealed(true)}>展开密度对照与结论</button>
          </div>
        ) : (
          <>
            <DensityCompare current={mode.id} onSelect={selectMode} />
            <p className="w9-sys-rule" role="note">
              <b>要留下的那一条</b>
              {LIMIT_RULE}
            </p>
          </>
        )}

        <BlindSpot />
      </div>
    </section>
  );
}

/** 时间轴：60 秒窗口是一条带子，尝试是落在带子上的点。 */
function Timeline({ mode, shown }: { mode: FailureMode; shown: FailureMode["attempts"] }) {
  const pct = (sec: number) => `${(sec / mode.spanSec) * 100}%`;
  return (
    <div className="w9-timeline-scroll">
      <div
        className="w9-timeline"
        role="img"
        aria-label={`${mode.label}：${mode.spanSec} 秒内发生 ${shown.length} 次启动尝试，其中落在前 ${SYSTEMD_LIMITS.windowSec} 秒窗口内的有 ${shown.filter((a) => a.at <= SYSTEMD_LIMITS.windowSec && a.outcome !== "refused").length} 次。`}
      >
        {/* 限速窗口本身是一个带子——「塞得下几次」是看出来的 */}
        <div className="w9-window" style={{ width: pct(SYSTEMD_LIMITS.windowSec) }}>
          <span>StartLimitIntervalSec = {SYSTEMD_LIMITS.windowSec}s 窗口</span>
        </div>
        <div className="w9-axis" />
        {mode.attempts.map((a, i) => {
          const visible = i < shown.length;
          return (
            <div
              key={`${a.at}-${a.label}`}
              className={`w9-attempt ${a.outcome}${visible ? " on" : ""}`}
              style={{ left: pct(a.at) }}
            >
              <i aria-hidden="true" />
              <span className="w9-attempt-time">{a.at}s</span>
              {visible && (
                <span className="w9-attempt-label">
                  {a.label}
                  {a.pid && <code>pid {a.pid}</code>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 一眼结论图：两条轴叠起来，疏密差别直接可见。 */
function DensityCompare({ current, onSelect }: { current: string; onSelect: (id: string) => void }) {
  const span = Math.max(...FAILURE_MODES.map((m) => m.spanSec));
  return (
    <div className="w9-density">
      <span className="w9-overview-label">同一个窗口下的两种密度</span>
      {FAILURE_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`w9-density-row${m.id === current ? " on" : ""}`}
          onClick={() => onSelect(m.id)}
          aria-pressed={m.id === current}
        >
          <span className="w9-density-name">{m.label}</span>
          <span className="w9-density-track" aria-hidden="true">
            <i className="w9-density-window" style={{ width: `${(SYSTEMD_LIMITS.windowSec / span) * 100}%` }} />
            {m.attempts.map((a) => (
              <i
                key={a.at}
                className={`w9-density-dot ${a.outcome}`}
                style={{ left: `${(a.at / span) * 100}%` }}
              />
            ))}
          </span>
          <em className={m.verdictTone}>
            {m.attempts.filter((a) => a.at <= SYSTEMD_LIMITS.windowSec && a.outcome !== "refused").length} / {SYSTEMD_LIMITS.burst}
          </em>
        </button>
      ))}
      <p className="w9-overview-note">
        窗口一样长，点的疏密不一样：快失败一次尝试几乎不占时间，所以能在窗口里堆满 5 次；
        慢失败一次就吃掉 <code>{SYSTEMD_LIMITS.dbTimeoutSec}s</code>，窗口里最多塞下 2 次。
      </p>
    </div>
  );
}

/** journal 原文：图不能替代可复核证据。 */
function JournalEvidence() {
  return (
    <div className="w9-journal">
      <span className="w9-overview-label">journal 决定性证据（实测）</span>
      <p className="w9-journal-trigger">{FAST_FAIL_OBSERVED.trigger}</p>
      <ol className="w9-journal-lines">
        {FAST_FAIL_OBSERVED.journal.map((line) => (
          <li key={line}><code>{line}</code></li>
        ))}
      </ol>
      <p className="w9-journal-recovery">
        <b>恢复</b>
        {FAST_FAIL_OBSERVED.recovery}
      </p>
    </div>
  );
}

/** 注入设计盲区：比结论更值得复习——它记录的是实验设计本身会出错。 */
function BlindSpot() {
  return (
    <div className="w9-blindspot">
      <div className="w6-section-head">
        <span>the experiment that failed first</span>
        <h3>第一次注入没测到东西，被依赖语义挡掉了</h3>
      </div>
      <ol className="w9-blindspot-steps">
        <li className="initial">
          <span>❌ 原设计</span>
          <p>{INJECTION_BLIND_SPOT.intent}</p>
        </li>
        <li className="problem">
          <span>⚡ 实际发生</span>
          <p>{INJECTION_BLIND_SPOT.whatHappened}</p>
        </li>
        <li className="final">
          <span>✅ 修正</span>
          <p>{INJECTION_BLIND_SPOT.fix}</p>
        </li>
      </ol>
      <p className="w9-blindspot-lesson" role="note">{INJECTION_BLIND_SPOT.lesson}</p>
    </div>
  );
}

/* 阶段进度：避免把「做了一块」呈现成「W9 已经做完」。 */
function StagePlan() {
  const done = W9_STAGE_PLAN.filter((item) => item.done).length;
  return (
    <section className="w9-stage-plan" aria-label="本板建构进度">
      <div className="w6-section-head">
        <span>board roadmap</span>
        <h3>本板共六块，当前落地 {done} 块</h3>
      </div>
      <ul className="w9-stage-list">
        {W9_STAGE_PLAN.map((item) => (
          <li key={item.id} className={item.done ? "done" : "todo"}>
            <i aria-hidden="true">{item.done ? "✓" : "—"}</i>
            <strong>{item.title}</strong>
            <span>{item.question}</span>
            <em>{item.done ? "已落地" : "待做"}</em>
          </li>
        ))}
      </ul>
      <p className="w9-stage-note">
        先做一块代表页验证语法（四态切换、停止点后揭示状态码、证据档位强制显示），
        成立后再推其余五块。范围与口径边界见笔记 <code>week9-visualization-plan.md</code>。
      </p>
    </section>
  );
}
