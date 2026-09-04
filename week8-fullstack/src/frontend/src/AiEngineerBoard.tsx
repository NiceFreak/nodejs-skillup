// 「AI 工程」板（W12 起）。施工图见 week8-fullstack/notes/w12-ai-board-design.md，
// 形态与十列契约见 w12-ai-visualization-plan.md，视觉基线见 SHOWCASE-VISUAL-PROTOCOL.md。
//
// 每块的形态由内容关系推导得到，不复用别的板的现成形态：
//   P1/P3 = 对齐映照（结构映射）  B1 = 双线序列泳道（分叉汇合）
//   B2 = 顺序管线 + 作用域包含框   B3 = 单一真相源 + 读写口（时序过程）
//   B4 = 分层状态机（三个控制分区）B5 = 泳道 + 嵌套容器（归属与层级）
//
// 承担结论的位置编码（改 CSS 前先看断言 scripts/verify-w9-board.mjs §E）：
//   B1 跨两列 = 两条启动线共有；B2 罩子的起止 = finally 的作用域；
//   B3 读口在带上、写口在带下 = 读写方向；B4 外框包含 step loop = turn 层级；
//   B5 四行两列中的空格 = 最小 demo 缺失的职责。
import { Fragment, useMemo, useState } from "react";
import { FrameNarration, FrameTransport, dwellByText, useFramePlayer } from "./framePlayer";
import {
  AE_GROUPS,
  AE_TOPICS,
  type AeAlignTopic,
  type AeEntryTopic,
  type AeMachineTopic,
  type AePipelineTopic,
  type AeRolesTopic,
  type AeSyntaxTopic,
  type AeTapeTopic,
  type AeTraceTopic,
  type AeTopic,
} from "./aiEngineerTopics";
import type { BoardMode } from "./types";

export default function AiEngineerBoard({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  // 未知 topic 回退到第一块，与其余板同一语义（深链拿到错 id 时不空屏）。
  const active = AE_TOPICS.find((item) => item.id === topic) ?? AE_TOPICS[0];
  const [revealed, setRevealed] = useState<string | null>(null);
  const review = mode === "review";
  const visible = !review || revealed === active.id;

  return (
    <div className="ae-board">
      <header className="ae-head">
        <div>
          <span className="ae-kicker">可视化说明</span>
          <h2>AI 工程：Python 迁移增量与 Bub harness 骨架</h2>
          <p>
            两组内容：从 TypeScript 迁到 Python 时真正变了什么，以及一个真实 agent runtime 的
            turn、tape 与 step 循环长什么样。源码事实、推断与待运行验证分开标注。
          </p>
        </div>
        <span className="ae-count">{AE_TOPICS.length} 个知识点</span>
      </header>

      <div className="ae-nav-groups">
        {AE_GROUPS.map((group) => (
          <section key={group} className="ae-nav-group">
            <span className="ae-nav-group-title">{group}</span>
            <nav className="ae-topic-nav" aria-label={group}>
              {AE_TOPICS.filter((item) => item.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === active.id ? "on" : ""}
                  aria-pressed={item.id === active.id}
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

      <article className="ae-stage" id="ae-topic-panel">
        <div className="ae-stage-title">
          <div>
            <span>{active.label}</span>
            <h3>{active.title}</h3>
          </div>
          <p>{active.question}</p>
        </div>

        {!visible ? (
          <section className="ae-recall-gate">
            <span>主动回忆</span>
            <h4>先不看答案，口述你的判断</h4>
            <p>{active.question}</p>
            <small>至少说明：这段内容的核心关系、一个真实来源位置、一个边界或未验证项。</small>
            <button type="button" onClick={() => setRevealed(active.id)}>
              显示模型与证据
            </button>
          </section>
        ) : (
          /* key=active.id：切专题时重挂载，动效重放，帧播放器回到第 0 帧。 */
          <div className="ae-stage-body" key={active.id}>
            <p className="ae-anchor">
              <b>10 秒结论</b>
              <span>{active.anchor}</span>
            </p>

            <TopicVisual topic={active} />

            <p className="ae-boundary">
              <b>边界</b>
              <span>{active.boundary}</span>
            </p>

            <div className="ae-meta">
              <span className="ae-memory">
                <b>记忆点</b>
                {active.memory}
              </span>
              <span className="ae-source">
                <b>来源</b>
                {active.source}
              </span>
            </div>

            {active.sources && (
              /* 源码位置整体折叠：主路径讲机制，行号只在读者要去核对时才展开。
                 2026-09-04 起主路径正文不再显示任何模块+行号；证据不删（结论要可回溯），
                 只是不再和结论抢版面。 */
              <details className="ae-sources">
                <summary>来源位置与运行记录</summary>
                <ul>
                  {active.sources.map((item) => (
                    <li key={item.ref}>
                      <span>{item.label}</span>
                      <code>{item.ref}</code>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <details className="ae-evidence">
              <summary>验收句与证据等级</summary>
              <p className="ae-accept">{active.accept}</p>
              <p className="ae-evidence-note">
                证据等级四档：源码事实 / 本人实测 / 推断 / 待运行验证。本块整体为
                「{active.evidenceKind}」；块内单条分支的等级以各自标签为准。
              </p>
            </details>
          </div>
        )}
      </article>
    </div>
  );
}

function TopicVisual({ topic }: { topic: AeTopic }) {
  switch (topic.kind) {
    case "syntax":
      return <SyntaxVisual topic={topic} />;
    case "align":
      return <AlignVisual topic={topic} />;
    case "trace":
      return <FailureTraceVisual topic={topic} />;
    case "entry":
      return <EntryVisual topic={topic} />;
    case "pipeline":
      return <PipelineVisual topic={topic} />;
    case "tape":
      return <TapeVisual topic={topic} />;
    case "machine":
      return <MachineVisual topic={topic} />;
    default:
      return <RolesVisual topic={topic} />;
  }
}

/* ============================================================ P1 语法映照 */

// 对齐映照：一行 = 一个语义单元，中列的线型说明两端怎么对上。
// 连线带 data-from / data-to，断言检查的是端点 id 真实存在，而不是标签文字。
function SyntaxVisual({ topic }: { topic: AeSyntaxTopic }) {
  const [hot, setHot] = useState<string | null>(null);

  return (
    <section className="ae-map" aria-label="TypeScript 与 Python 的语义单元对照">
      <div className="ae-map-legend">
        <b>映射类型</b>
        {topic.legend.map((item) => (
          <span key={item.type} className={`ae-map-legend-item ${item.type}`}>
            <i aria-hidden="true" />
            {item.label}
            <em>{item.shape}</em>
          </span>
        ))}
      </div>

      {/* 图承担「六个单元各是哪一类映射」的一眼可见；代码片段、坑与来源在图下的文字层。 */}
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-map"
          viewBox="0 0 1200 400"
          role="img"
          aria-label="六个语法单元逐行对齐；中间线型区分等价、近似、Python 侧新增与同语言两形态四类映射"
        >
          <text className="ae-svg-host left" x="40" y="34">TypeScript 侧</text>
          <text className="ae-svg-host right" x="1160" y="34" textAnchor="end">Python 侧</text>
          {topic.units.map((unit, index) => {
            const y = 56 + index * 56;
            const on = hot === unit.id;
            const py = unit.mapType === "py-internal";
            const tsSvgId = `ae-svg-p1-${unit.id}-ts`;
            const pySvgId = `ae-svg-p1-${unit.id}-py`;
            return (
              <g
                key={unit.id}
                className={`ae-svg-unit ${unit.mapType}${on ? " on" : ""}`}
                data-unit={unit.id}
                data-maptype={unit.mapType}
                onMouseEnter={() => setHot(unit.id)}
                onMouseLeave={() => setHot(null)}
              >
                <rect id={tsSvgId} className="ae-svg-side" x="40" y={y} width="404" height="40" rx="8" />
                <text x="58" y={y + 25}>{unit.semantics}</text>
                {/* 线型与端点形状共同编码映射类型。 */}
                {py ? (
                  <path
                    className="ae-svg-map-line"
                    data-from={tsSvgId}
                    data-to={pySvgId}
                    d={`M 756 ${y + 8} L 790 ${y + 8} L 790 ${y + 32} L 756 ${y + 32}`}
                  />
                ) : (
                  <>
                    <path
                      className="ae-svg-map-line"
                      data-from={tsSvgId}
                      data-to={pySvgId}
                      d={`M 452 ${y + 20} L 748 ${y + 20}`}
                      markerStart={unit.mapType === "eq" ? "url(#ae-am)" : undefined}
                      markerEnd={unit.mapType === "new" ? undefined : "url(#ae-am)"}
                    />
                    {unit.mapType === "approx" && <circle className="ae-svg-map-open" cx="458" cy={y + 20} r="6" />}
                    {unit.mapType === "new" && (
                      <>
                        <rect className="ae-svg-map-square" x="452" y={y + 15} width="10" height="10" />
                        <rect className="ae-svg-map-square" x="738" y={y + 15} width="10" height="10" />
                      </>
                    )}
                  </>
                )}
                <text className="ae-svg-map-tag" x="600" y={y + 14} textAnchor="middle">
                  {topic.legend.find((item) => item.type === unit.mapType)?.label.split("（")[0]}
                </text>
                <rect id={pySvgId} className="ae-svg-side" x="756" y={y} width="404" height="40" rx="8" />
                {py ? (
                  <>
                    <line className="ae-svg-map-divider" x1="958" y1={y + 5} x2="958" y2={y + 35} />
                    <text x="774" y={y + 25}>@dataclass</text>
                    <text x="976" y={y + 25}>pydantic.BaseModel</text>
                  </>
                ) : (
                  <text x="774" y={y + 25}>
                    {unit.sides.filter((side) => side.lang === "Python").map((side) => side.kind.split("，")[0]).join(" / ")}
                  </text>
                )}
              </g>
            );
          })}
          <defs>
            <marker id="ae-am" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>
        </svg>
      </div>

      <div className="ae-mobile-visual ae-mobile-map" data-mobile-visual="py-syntax">
        {topic.units.map((unit) => (
          <article key={unit.id} data-unit={unit.id} data-maptype={unit.mapType}>
            <header>
              <strong>{unit.semantics}</strong>
              <em>{topic.legend.find((item) => item.type === unit.mapType)?.label}</em>
            </header>
            <div className="ae-mobile-pair">
              <span>{unit.sides.find((side) => side.lang === "TypeScript")?.kind}</span>
              <i aria-hidden="true">↓</i>
              <span>{unit.sides.filter((side) => side.lang === "Python").map((side) => side.kind).join(" / ")}</span>
            </div>
          </article>
        ))}
      </div>

      <details className="ae-map-details">
        <summary>六个单元的代码、实测与来源</summary>
        <div className="ae-map-cols" aria-hidden="true">
          <span>TypeScript</span>
          <span>映射</span>
          <span>Python</span>
        </div>

        <div className="ae-map-rows">
        {topic.units.map((unit) => {
          const tsSide = unit.sides.find((side) => side.lang === "TypeScript");
          const pySides = unit.sides.filter((side) => side.lang === "Python");
          const tsId = `ae-p1-${unit.id}-ts`;
          const pyId = `ae-p1-${unit.id}-py`;
          const on = hot === unit.id;
          return (
            <div
              key={unit.id}
              className={`ae-map-row${on ? " on" : ""}`}
              data-unit={unit.id}
              onMouseEnter={() => setHot(unit.id)}
              onMouseLeave={() => setHot(null)}
              onFocus={() => setHot(unit.id)}
              onBlur={() => setHot(null)}
            >
              <div className={`ae-map-side ts${tsSide?.absent ? " absent" : ""}`} id={tsId}>
                <strong>{unit.semantics}</strong>
                {tsSide?.absent ? (
                  <p className="ae-map-absent">{tsSide.kind}</p>
                ) : (
                  <code>{tsSide?.kind ?? "—"}</code>
                )}
                {tsSide?.note && <em>{tsSide.note}</em>}
              </div>

              <div
                className={`ae-map-link ${unit.mapType}`}
                data-from={tsId}
                data-to={pyId}
                data-maptype={unit.mapType}
              >
                <i aria-hidden="true" />
                <span>{topic.legend.find((item) => item.type === unit.mapType)?.label}</span>
              </div>

              <div className="ae-map-side py" id={pyId}>
                {unit.mapType === "py-internal" ? (
                  <div className="ae-map-pair">
                    {pySides.map((side) => (
                      <div key={side.kind}>
                        <code>{side.kind}</code>
                        {side.note && <em>{side.note}</em>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <code>{pySides[0]?.kind ?? "—"}</code>
                    {pySides[0]?.note && <em>{pySides[0].note}</em>}
                  </>
                )}
                <p className="ae-map-pitfall">{unit.pitfall}</p>
                <details>
                  <summary>实测记录与对照来源</summary>
                  <p>{unit.detail}</p>
                  <ul className="ae-map-sources">
                    {unit.sides.map((side) => (
                      <li key={`${side.lang}-${side.kind}`}>
                        <b>{side.lang}</b>
                        <span>{side.source ?? "本仓库无对照物"}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          );
        })}
        </div>
      </details>
    </section>
  );
}

/* ================================================= P3 CLI 分发器结构对齐映照 */

function AlignVisual({ topic }: { topic: AeAlignTopic }) {
  const [hot, setHot] = useState<string | null>(null);
  const rowY = (index: number) => 76 + index * 88;

  return (
    <section className="ae-align" aria-label="Express 与 typer 的职责位置对照">
      {/* 图承担「四个职责位置逐对对齐」；成立点与失效点的完整表述在图下的文字层。 */}
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-align"
          viewBox="0 0 1200 420"
          role="img"
          aria-label="四个职责位置在 Express 与 typer 两侧逐对对齐；每条对齐线一端标成立、一端标失效"
        >
          <text className="ae-svg-host left" x="40" y="44">{topic.hosts.left}</text>
          <text className="ae-svg-host mid" x="600" y="44" textAnchor="middle">四个职责位置</text>
          <text className="ae-svg-host right" x="1160" y="44" textAnchor="end">{topic.hosts.right}</text>

          {topic.positions.map((position, index) => {
            const y = rowY(index);
            const on = hot === position.id;
            const expressSvgId = `ae-svg-p3-${position.id}-express`;
            const typerSvgId = `ae-svg-p3-${position.id}-typer`;
            return (
              <g
                key={position.id}
                className={`ae-svg-pair${on ? " on" : ""}`}
                data-pos={index + 1}
                onMouseEnter={() => setHot(position.id)}
                onMouseLeave={() => setHot(null)}
              >
            {/* 主路径正文不显示源码行号：四组对照的职责与成立/失效结论由图承担，源码位置在下方折叠层 */}
                <rect id={expressSvgId} className="ae-svg-side" x="40" y={y} width="412" height="58" rx="9" />
                <text className="ae-svg-side-role" x="58" y={y + 24}>{`${index + 1}. ${position.role}`}</text>

                {/* 对齐线：左端实心圆 = 成立，右端短横 = 失效，形状先于颜色 */}
                <path
                  className="ae-svg-align-line"
                  data-from={expressSvgId}
                  data-to={typerSvgId}
                  d={`M 452 ${y + 29} L 748 ${y + 29}`}
                />
                <circle className="ae-svg-holds-dot" cx="462" cy={y + 29} r="6" />
                <rect className="ae-svg-fails-bar" x="726" y={y + 26} width="16" height="6" rx="2" />
                <text className="ae-svg-align-tag holds" x="476" y={y + 20}>{`成立 · ${position.holdsShort}`}</text>
                <text className="ae-svg-align-tag fails" x="722" y={y + 20} textAnchor="end">{`失效 · ${position.failsShort}`}</text>

                <rect id={typerSvgId} className="ae-svg-side" x="748" y={y} width="412" height="58" rx="9" />
                <text className="ae-svg-side-role" x="766" y={y + 24}>{`${index + 1}. ${position.role}`}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ae-mobile-visual ae-mobile-align" data-mobile-visual="cli-dispatch">
        {topic.positions.map((position, index) => (
          <article key={position.id} data-pos={index + 1}>
            <header><b>{index + 1}</b><strong>{position.role}</strong></header>
            <div className="ae-mobile-pair">
              <span>{position.express.node}</span>
              <i aria-hidden="true">↓</i>
              <span>{position.typer.node}</span>
            </div>
            <p className="holds">成立 · {position.holdsShort}</p>
            <p className="fails">失效 · {position.failsShort}</p>
          </article>
        ))}
      </div>

      {/* 完整措辞与来源进入第二层；SVG 常驻短标签已经能回答成立点与失效点。 */}
      <details className="ae-align-details">
        <summary>四组对照的完整依据与失效边界</summary>
        <div className="ae-align-rows">
        {topic.positions.map((position, index) => (
          <div
            key={position.id}
            className={`ae-align-row${hot === position.id ? " on" : ""}`}
            data-pos={index + 1}
            onMouseEnter={() => setHot(position.id)}
            onMouseLeave={() => setHot(null)}
          >
            <div className="ae-align-side express" id={`ae-p3-${position.id}-express`}>
              <b>{index + 1}</b>
              <div>
                <strong>{position.express.node}</strong>
                <code>{position.express.source}</code>
              </div>
            </div>
            <div className="ae-align-link" data-from={`ae-p3-${position.id}-express`} data-to={`ae-p3-${position.id}-typer`}>
              <span className="ae-align-role">{position.role}</span>
              <p className="ae-align-holds">
                <b>成立</b>
                {position.holds}
              </p>
              <p className="ae-align-fails">
                <b>失效</b>
                {position.fails}
              </p>
            </div>
            <div className="ae-align-side typer" id={`ae-p3-${position.id}-typer`}>
              <b>{index + 1}</b>
              <div>
                <strong>{position.typer.node}</strong>
                <code>{position.typer.source}</code>
              </div>
            </div>
          </div>
        ))}
        </div>

        <div className="ae-align-void">
          <b>没有对应物的部分</b>
          {topic.voids.map((item) => (
            <p key={item.label}>
              <strong>{item.label}</strong>
              {item.detail}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}

/* ============================================ P4 异步失败的三条因果轨迹 */

function FailureTraceVisual({ topic }: { topic: AeTraceTopic }) {
  const pointX = (index: number) => 194 + index * 180;
  const rowY = (index: number) => 58 + index * 154;
  const actorLabel = (actor: string) => topic.actors.find((item) => item.id === actor)?.label ?? actor;
  const evidence = topic.traces[0]?.evidence;

  return (
    <section className="ae-failure" aria-label="read timeout、长 timeout 对照与外部取消的三条因果轨迹">
      {evidence && (
        <p className="ae-failure-evidence" data-scope={evidence.scope} data-target-verified={evidence.targetVerified}>
          证据作用域 · {evidence.scope} · {evidence.kind}
        </p>
      )}
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-failure"
          viewBox="0 0 1220 500"
          role="img"
          aria-label="三条静态有向轨迹按各自序数排列；轨间横向距离不是共同时间比例"
          data-scale="ordinal-not-common-time"
        >
          <defs>
            <marker id="ae-af" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>
          {topic.traces.map((trace, traceIndex) => {
            const y = rowY(traceIndex);
            const points = new Map(trace.points.map((point, index) => [point.id, { ...point, x: pointX(index) }]));
            return (
              <g key={trace.id} className={`ae-svg-failure-trace ${trace.id}`} data-trace={trace.id} data-scale={trace.scale}
                data-read-seconds={trace.inputs.readSeconds} data-hold-seconds={trace.inputs.holdSeconds}
                data-exception={trace.outcome.exception} data-client-closed={trace.outcome.clientClosed}>
                <text className="ae-svg-trace-title" x="18" y={y + 25}>{trace.label}</text>
                <text className="ae-svg-trace-input" x="18" y={y + 45}>r={trace.inputs.readSeconds}s · h={trace.inputs.holdSeconds}s</text>
                {trace.edges.map((edge) => {
                  const from = points.get(edge.from);
                  const to = points.get(edge.to);
                  if (!from || !to) return null;
                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      className={`ae-svg-causal-edge ${edge.relation}`}
                      data-from={edge.from}
                      data-to={edge.to}
                      data-relation={edge.relation}
                      d={`M ${from.x + 70} ${y + 34} L ${to.x - 78} ${y + 34}`}
                      markerEnd="url(#ae-af)"
                    />
                  );
                })}
                {trace.points.map((point, pointIndex) => {
                  const labelLines = point.label.split("；");
                  return (
                    <g
                      id={point.id}
                      key={point.id}
                      className={`ae-svg-causal-point ${point.kind}`}
                      data-node={point.id}
                      data-ordinal={point.ordinal}
                      data-actor={point.actor}
                      data-kind={point.kind}
                      data-at-seconds={point.atSeconds}
                      transform={`translate(${pointX(pointIndex) - 72} ${y})`}
                    >
                      <rect width="144" height="72" rx="7" />
                      <text className="ae-svg-point-actor" x="72" y="17" textAnchor="middle">{actorLabel(point.actor)}</text>
                      <text x="72" y={labelLines.length > 1 ? 35 : 42} textAnchor="middle">
                        {labelLines.map((line, index) => (
                          <tspan key={line} x="72" dy={index === 0 ? 0 : 15}>{line}</tspan>
                        ))}
                      </text>
                      {point.atSeconds !== undefined && (
                        <text className="ae-svg-point-time" x="72" y={labelLines.length > 1 ? 67 : 62} textAnchor="middle">
                          t+{point.atSeconds.toFixed(3)}s
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ae-mobile-visual ae-mobile-failure" data-mobile-visual="async-failure-lifecycle">
        {topic.traces.map((trace) => (
          <article key={trace.id} data-trace={trace.id} data-scale={trace.scale}
            data-read-seconds={trace.inputs.readSeconds} data-hold-seconds={trace.inputs.holdSeconds}
            data-exception={trace.outcome.exception} data-client-closed={trace.outcome.clientClosed}>
            <header>
              <strong>{trace.label}</strong>
              <span>read={trace.inputs.readSeconds}s · hold={trace.inputs.holdSeconds}s</span>
            </header>
            <ol>
              {trace.points.map((point) => (
                <li key={point.id} data-node={point.id} data-ordinal={point.ordinal} data-kind={point.kind} data-at-seconds={point.atSeconds}>
                  <small>{actorLabel(point.actor)}</small>
                  <b>{point.label}</b>
                  {point.atSeconds !== undefined && <time>t+{point.atSeconds.toFixed(3)}s</time>}
                </li>
              ))}
            </ol>
            <p>{trace.outcome.exception} · client closed={String(trace.outcome.clientClosed)}</p>
          </article>
        ))}
      </div>

      <details className="ae-failure-details">
        <summary>异常类型、清理证据与 pending task 边界</summary>
        <dl>
          {topic.details.map((item) => (
            <Fragment key={item.id}>
              <dt>{item.label}</dt>
              <dd>{item.text}</dd>
            </Fragment>
          ))}
        </dl>
      </details>
    </section>
  );
}

/* ==================================================== B1 两条启动路径 */

function EntryVisual({ topic }: { topic: AeEntryTopic }) {
  const [hot, setHot] = useState<string | null>(null);
  const nodeLayout: Record<string, { x: number; y: number; w: number; h: number }> = {
    "console-start": { x: 54, y: 60, w: 420, h: 58 },
    "python-m-start": { x: 726, y: 60, w: 420, h: 58 },
    "module-level": { x: 340, y: 150, w: 520, h: 58 },
    "create-cli-app": { x: 340, y: 232, w: 520, h: 58 },
    "register-run": { x: 340, y: 314, w: 520, h: 58 },
    "wrapper-call": { x: 54, y: 404, w: 420, h: 58 },
    "name-gate": { x: 726, y: 404, w: 420, h: 58 },
    dispatch: { x: 340, y: 494, w: 520, h: 58 },
    "cli-run": { x: 24, y: 588, w: 250, h: 56 },
    "asyncio-run": { x: 322, y: 588, w: 250, h: 56 },
    running: { x: 620, y: 588, w: 250, h: 56 },
    "process-inbound": { x: 918, y: 588, w: 258, h: 56 },
  };
  const edgePath = (fromId: string, toId: string) => {
    const from = nodeLayout[fromId];
    const to = nodeLayout[toId];
    const startX = from.x + from.w / 2;
    const startY = from.y + from.h;
    const endX = to.x + to.w / 2;
    const endY = to.y;
    if (Math.abs(from.y - to.y) < 2) {
      return `M ${from.x + from.w} ${from.y + from.h / 2} L ${to.x - 4} ${to.y + to.h / 2}`;
    }
    if (Math.abs(startX - endX) < 2) return `M ${startX} ${startY} L ${endX} ${endY - 4}`;
    const midY = (startY + endY) / 2;
    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY - 4}`;
  };
  const entryNode = (id: string) => topic.nodes.find((item) => item.id === id);

  return (
    <section className="ae-entry" aria-label="两条启动路径汇合后进入第一次 turn">
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-entry"
          viewBox="0 0 1200 668"
          role="img"
          aria-label="console script 与 python -m 两条启动路径先进入共享初始化，再分别由 console wrapper 与 name gate 调用 app，汇合后进入 run 回调、事件循环、running 上下文和第一次 turn"
        >
          <defs>
            <marker id="ae-a1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>

          {topic.lanes.map((lane, index) => (
            <g key={lane.id} className={`ae-svg-entry-lane ${lane.id}`} data-lane={lane.id}>
              <rect x={index === 0 ? 24 : 696} y="24" width="480" height="454" rx="12" />
              <text x={index === 0 ? 42 : 714} y="48">{lane.label}</text>
            </g>
          ))}

          {topic.edges.map((edge) => (
            <path
              key={`${edge.from}-${edge.to}`}
              className={`ae-svg-entry-edge ${edge.flow} ${edge.owner}`}
              data-from={edge.from}
              data-to={edge.to}
              data-flow={edge.flow}
              data-owner={edge.owner}
              d={edgePath(edge.from, edge.to)}
              markerEnd="url(#ae-a1)"
            />
          ))}

          {topic.nodes.map((node) => {
            const p = nodeLayout[node.id];
            const on = hot === node.id;
            return (
              <g
                key={node.id}
                className={`ae-svg-entry-node ${node.lineOwner}${on ? " on" : ""}${node.trigger ? " trigger" : ""}${node.join ? " join" : ""}${node.verified === "待运行验证" ? " pending" : ""}`}
                data-node={node.id}
                data-owner={node.lineOwner}
                data-trigger={node.trigger ? "true" : undefined}
                data-join={node.join ? "true" : undefined}
                data-verified={node.verified}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  rx="9"
                  onMouseEnter={() => setHot(node.id)}
                  onMouseLeave={() => setHot(null)}
                />
                <text className="ae-svg-entry-src" x={p.x + 15} y={p.y + 21}>
                  {node.module}
                </text>
                <text className="ae-svg-entry-act" x={p.x + 15} y={p.y + 44}>
                  {node.short}
                </text>
                {node.lineOwner === "both" && (
                  <text className="ae-svg-entry-flag" x={p.x + p.w - 15} y={p.y + 21} textAnchor="end">两线共有</text>
                )}
                {node.join && (
                  <text className="ae-svg-entry-flag" x={p.x + p.w - 15} y={p.y + 44} textAnchor="end">汇合点</text>
                )}
                {node.verified === "待运行验证" && (
                  <text className="ae-svg-entry-pending" x={p.x + p.w - 15} y={p.y + 21} textAnchor="end">待验证</text>
                )}
                {node.trigger && (
                  <text className="ae-svg-entry-flag" x={p.x + p.w - 15} y={p.y + 21} textAnchor="end">
                    第一次 turn
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ae-mobile-visual ae-mobile-entry" data-mobile-visual="entry-chain">
        <div className="ae-mobile-split">
          {topic.lanes.map((lane) => (
            <span key={lane.id} className={lane.id} data-lane={lane.id}>
              <b>{lane.label}</b>
              <code>{lane.trigger}</code>
            </span>
          ))}
        </div>
        <i className="ae-mobile-arrow" aria-hidden="true">↓</i>
        {(["module-level", "create-cli-app", "register-run"] as const).map((id) => (
          <Fragment key={id}>
            <span className="ae-mobile-node both" data-node={id} data-owner="both">
              <small>{entryNode(id)?.module}</small>
              <strong>{entryNode(id)?.short}</strong>
            </span>
            <i className="ae-mobile-arrow" aria-hidden="true">↓</i>
          </Fragment>
        ))}
        <div className="ae-mobile-split callers">
          {(["wrapper-call", "name-gate"] as const).map((id) => (
            <span key={id} className={entryNode(id)?.lineOwner} data-node={id} data-owner={entryNode(id)?.lineOwner}>
              <small>{entryNode(id)?.module}</small>
              <strong>{entryNode(id)?.short}</strong>
              {entryNode(id)?.verified === "待运行验证" && <em>待验证</em>}
            </span>
          ))}
        </div>
        <i className="ae-mobile-arrow join" aria-hidden="true">↓ 汇合</i>
        {(["dispatch", "cli-run", "asyncio-run", "running", "process-inbound"] as const).map((id, index, ids) => (
          <Fragment key={id}>
            <span className={`ae-mobile-node${id === "dispatch" ? " join" : ""}${id === "process-inbound" ? " trigger" : ""}`} data-node={id}>
              <small>{entryNode(id)?.module}</small>
              <strong>{entryNode(id)?.short}</strong>
              {id === "process-inbound" && <em>第一次 turn</em>}
            </span>
            {index < ids.length - 1 && <i className="ae-mobile-arrow" aria-hidden="true">↓</i>}
          </Fragment>
        ))}
      </div>

      <div className="ae-entry-seam" data-seam="open">
        <b>待验证调用关系</b>
        <strong>{topic.seam.at}</strong>
        <p>{topic.seam.question}</p>
        <em className="ae-tag pending">{topic.seam.status}</em>
      </div>

      <details className="ae-entry-details">
        <summary>节点动作、执行时机与定位记录</summary>
        <ol className="ae-entry-chain">
          {topic.nodes.map((node, index) => (
            <li
              key={node.id}
              data-node={node.id}
              data-owner={node.lineOwner}
              className={node.trigger ? "trigger" : ""}
              onMouseEnter={() => setHot(node.id)}
              onMouseLeave={() => setHot(null)}
            >
              <b>{index + 1}</b>
              <div>
                <code>{node.module} {node.line}</code>
                <strong>{node.action}</strong>
                {node.detail && <p>{node.detail}</p>}
              </div>
              {node.trigger && <em className="ae-tag join">第一次 turn 的触发点</em>}
            </li>
          ))}
        </ol>

        <div className="ae-entry-timing">
          <b>执行时机</b>
          <p>{topic.timing.rule}</p>
          <p>{topic.timing.gate}</p>
          <div className="ae-entry-exps">
            {topic.timing.experiments.map((exp) => (
              <article key={exp.command}>
                <code>{exp.command}</code>
                <strong>{exp.output}</strong>
                <p>{exp.reading}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="ae-entry-corrections">
          <b>定位记录</b>
          <ul>
            {topic.corrections.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </details>
    </section>
  );
}

/* ================================================ B2 turn 管线与 finally 范围 */

function PipelineVisual({ topic }: { topic: AePipelineTopic }) {
  const nodeLayout: Record<string, { x: number; y: number; w: number }> = {
    "resolve-session": { x: 24, y: 136, w: 132 },
    "build-state": { x: 188, y: 136, w: 132 },
    "build-prompt": { x: 352, y: 136, w: 132 },
    "run-model": { x: 530, y: 126, w: 138 },
    "save-state": { x: 716, y: 126, w: 150 },
    "collect-outbounds": { x: 902, y: 126, w: 142 },
    "dispatch-outbound": { x: 1078, y: 126, w: 142 },
    success: { x: 1080, y: 34, w: 138 },
    exception: { x: 898, y: 238, w: 146 },
    cancelled: { x: 1074, y: 238, w: 146 },
    "early-error": { x: 250, y: 258, w: 168 },
  };
  const center = (id: string) => {
    const node = nodeLayout[id];
    return { x: node.x + node.w / 2, y: node.y + 28 };
  };
  const stageById = new Map(topic.stages.map((stage) => [stage.id, stage]));

  return (
    <section className="ae-pipe" aria-label="turn 管线中的 save_state checkpoint 与提前错误旁路">
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-pipe"
          viewBox="0 0 1244 340"
          role="img"
          aria-label="success、exception、cancelled 三种 _run_model 结果都经过 save_state checkpoint；前三阶段错误绕过该检查点"
        >
          <defs>
            <marker id="ae-a2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>
          <rect className="ae-svg-protected" x="512" y="96" width="372" height="104" rx="12" data-region="run-model-finally" />
          <text className="ae-svg-protected-label" x="526" y="112">finally protected region</text>

          {["resolve-session", "build-state", "build-prompt"].map((id, index, ids) => {
            const from = nodeLayout[id];
            const next = nodeLayout[ids[index + 1] ?? "run-model"];
            return (
              <path key={id} className="ae-svg-flow" data-from={id} data-to={ids[index + 1] ?? "run-model"}
                d={`M ${from.x + from.w} ${from.y + 28} L ${next.x - 7} ${next.y + 28}`} markerEnd="url(#ae-a2)" />
            );
          })}

          {topic.outcomes.map((outcome, outcomeIndex) => {
            const run = center("run-model");
            const checkpoint = center("save-state");
            const yOffset = (outcomeIndex - 1) * 10;
            const rest = outcome.path.slice(1);
            return (
              <g key={outcome.id} className={`ae-svg-outcome-path ${outcome.tone}`} data-path={outcome.id}>
                <path className="ae-svg-branch" data-path={outcome.id} data-from="run-model" data-to="save-state"
                  d={`M ${nodeLayout["run-model"].x + nodeLayout["run-model"].w} ${run.y + yOffset} L ${nodeLayout["save-state"].x - 7} ${checkpoint.y}`}
                  markerEnd="url(#ae-a2)" />
                {rest.slice(0, -1).map((fromId, index) => {
                  const toId = rest[index + 1];
                  const from = center(fromId);
                  const to = center(toId);
                  return (
                    <path key={`${fromId}-${toId}`} className="ae-svg-branch" data-path={outcome.id} data-from={fromId} data-to={toId}
                      d={`M ${from.x} ${from.y} C ${from.x + 48} ${from.y}, ${to.x - 48} ${to.y}, ${to.x} ${to.y}`}
                      markerEnd="url(#ae-a2)" />
                  );
                })}
              </g>
            );
          })}

          {topic.bypasses.map((bypass, index) => {
            const from = center(bypass.from);
            const to = center(bypass.to);
            return (
              <path key={bypass.from} className="ae-svg-bypass-edge" data-from={bypass.from} data-to={bypass.to}
                data-excludes={bypass.excludes} d={`M ${from.x} ${from.y + 28} C ${from.x} ${220 + index * 8}, ${to.x - 34} ${to.y}, ${to.x} ${to.y}`}
                markerEnd="url(#ae-a2)" />
            );
          })}

          {topic.stages.map((stage, index) => {
            const node = nodeLayout[stage.id];
            return (
              <g key={stage.id} id={`ae-b2-${stage.id}`} className="ae-svg-stage" data-stage={stage.id} data-node={stage.id}>
                <rect x={node.x} y={node.y} width={node.w} height="56" rx="8" />
                <text className="ae-svg-stage-no" x={node.x + 10} y={node.y + 20}>{index + 1}</text>
                <text x={node.x + node.w / 2} y={node.y + 34} textAnchor="middle">{stage.label}</text>
              </g>
            );
          })}
          <g id="ae-b2-save-state" className="ae-svg-checkpoint" data-node="save-state" data-checkpoint="true">
            <rect x={nodeLayout["save-state"].x} y={nodeLayout["save-state"].y} width={nodeLayout["save-state"].w} height="56" rx="28" />
            <text x={center("save-state").x} y="150" textAnchor="middle">save_state</text>
            <text className="ae-svg-note" x={center("save-state").x} y="169" textAnchor="middle">checkpoint</text>
          </g>
          {["success", "exception", "cancelled", "early-error"].map((id) => {
            const node = nodeLayout[id];
            const outcome = topic.outcomes.find((item) => item.id === id);
            return (
              <g key={id} id={`ae-b2-${id}`} className={`ae-svg-end ${outcome?.tone ?? "raise"}`} data-node={id} data-outcome={outcome?.id}>
                <rect x={node.x} y={node.y} width={node.w} height="56" rx="8" />
                <text x={node.x + node.w / 2} y={node.y + 33} textAnchor="middle">
                  {outcome?.label ?? "前三阶段 error"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ae-mobile-visual ae-mobile-pipe" data-mobile-visual="turn-pipeline">
        <ol>
          {topic.stages.slice(0, 3).map((stage, index) => (
            <li key={stage.id} data-stage={stage.id} data-bypass-to="early-error" data-excludes="save-state">
              <b>{index + 1}</b>
              <strong>{stage.label}</strong>
              <em>error → 绕过 checkpoint</em>
            </li>
          ))}
        </ol>
        <div className="ae-mobile-protected" data-region="run-model-finally">
          <span data-node="run-model"><small>4</small><strong>_run_model</strong></span>
          <i>↓ 三种结果</i>
          <span className="checkpoint" data-node="save-state" data-checkpoint="true"><strong>{topic.checkpoint.label}</strong></span>
          <div className="ae-mobile-ends">
            {topic.outcomes.map((item) => (
              <span key={item.id} className={item.tone} data-path={item.id} data-via="save-state" data-to={item.id}>
                <small>via checkpoint</small>
                <strong>{item.label}</strong>
                {item.id === "success" && <em>{stageById.get("collect-outbounds")?.label} → {stageById.get("dispatch-outbound")?.label}</em>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="ae-pipe-details">
        <summary>阶段说明、分支证据与状态边界</summary>
        <ol className="ae-pipe-notes">
        {topic.stages.map((stage, index) => (
          <li key={stage.id} data-stage={stage.id}>
            <b>{index + 1}</b>
            <div>
              <strong>{stage.label}</strong>
              <p>{stage.note}</p>
            </div>
          </li>
        ))}
        </ol>

        <p className="ae-pipe-scope-note">
          <b>{topic.checkpoint.label}</b>
          {topic.checkpoint.note} 调用 hook 不等于持久化成功。
        </p>

        <div className="ae-pipe-ends">
          <span className="ae-pipe-ends-title">_run_model 三种结果的证据范围</span>
          {topic.outcomes.map((item) => (
            <article key={item.id} className={`ae-pipe-end ${item.tone}`} data-outcome={item.id}>
              <strong>{item.label}</strong>
              <code>{item.path.join(" → ")}</code>
              {item.evidence.map((evidence) => (
                <span key={`${evidence.scope}-${evidence.kind}`} data-scope={evidence.scope} data-target-verified={evidence.targetVerified}>
                  {evidence.scope} · {evidence.kind}
                </span>
              ))}
            </article>
          ))}
        </div>

        <div className="ae-pipe-state">
        <p>
          <b>可变状态</b>
          {topic.stateNote.mutable}
        </p>
        <p>
          <b>冻结结果外层</b>
          {topic.stateNote.frozen}
        </p>
        </div>
      </details>
    </section>
  );
}

/* ============================================ B3 单一真相源：tape 与 context */

function TapeVisual({ topic }: { topic: AeTapeTopic }) {
  const [path, setPath] = useState<"tool" | "text">("tool");
  const frames = useMemo(
    () => topic.frames.filter((frame) => !frame.path || frame.path === path),
    [topic.frames, path],
  );
  const player = useFramePlayer(frames.length, {
    autoPlay: false,
    intervalAt: (index) => dwellByText(frames[index]?.text ?? ""),
  });
  const frame = frames[Math.min(player.index, frames.length - 1)];
  const reached = (id: string) => {
    const target = frames.findIndex((item) => item.id === id);
    return target >= 0 && player.index >= target;
  };

  // 画的是规则，不是某次真实会话的记录序列：tape 是一个记录集合，
  // 中间三级是过滤规则，右侧是拼装与调用，最后一条弧线把这一轮追加回集合，形成闭环。
  const kinds = topic.entries;
  const kept = kinds.filter((entry) => entry.inDefaultMessages);
  const dropped = kinds.filter((entry) => !entry.inDefaultMessages);
  const gates = topic.readStages.filter((stage) => stage.selectorMode === "default");
  const custom = topic.readStages.find((stage) => stage.selectorMode === "custom");

  return (
    <section className="ae-tape" aria-label="tape 的读写规则">
      <div className="ae-tape-paths" role="group" aria-label="演示路径">
        <button
          type="button"
          className={path === "tool" ? "on" : ""}
          aria-pressed={path === "tool"}
          onClick={() => {
            setPath("tool");
            player.seek(0);
          }}
        >
          工具路径
        </button>
        <button
          type="button"
          className={path === "text" ? "on" : ""}
          aria-pressed={path === "text"}
          onClick={() => {
            setPath("text");
            player.seek(0);
          }}
        >
          纯文本路径
        </button>
      </div>

      <div className="ae-tape-figure-wrap">
        <svg
          className="ae-tape-figure"
          viewBox="0 0 1200 486"
          role="img"
          aria-label="tape 存着七类记录；三级过滤规则逐级收窄，只有对话消息进入模型输入；拼上本轮输入调模型后，这一轮按固定顺序追加回 tape"
        >
          <defs>
            <marker id="ae-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
            <pattern id="ae-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="7" className="ae-svg-hatch" />
            </pattern>
          </defs>

          {/* tape：记录集合（不是序列）。七类各一块，进 messages 的那一类单独着色。 */}
          <g className="ae-svg-store" data-node="tape">
            <rect x="34" y="52" width="228" height="240" rx="12" />
            <text className="ae-svg-store-title" x="48" y="78">tape · 只增不改</text>
            <text className="ae-svg-note" x="48" y="96">存着七类记录</text>
            {kinds.map((entry, index) => (
              <g
                key={entry.id}
                className={`ae-svg-kind${entry.inDefaultMessages ? " kept" : " dropped"}`}
                data-kind={entry.entryKind}
                data-filtered={entry.inDefaultMessages ? undefined : "true"}
              >
                <rect x={48 + (index % 2) * 104} y={112 + Math.floor(index / 2) * 42} width="96" height="32" rx="6" />
                <text x={96 + (index % 2) * 104} y={132 + Math.floor(index / 2) * 42} textAnchor="middle">
                  {entry.entryKind}
                </text>
              </g>
            ))}
          </g>

          {/* 三级过滤：逐级收窄是这块内容的真实形状，也是流程本身 */}
          <path className={`ae-svg-flow${reached("f-range") ? " on" : ""}`} data-from="tape" data-to="gate-1" d="M 262 150 L 306 150" markerEnd="url(#ae-arrow)" />
          {gates.map((stage, index) => {
            const y = 108 + index * 74;
            const frameId = ["f-range", "f-filter", "f-kind"][index];
            return (
              <g key={stage.step} className={`ae-svg-gate${reached(frameId) ? " on" : ""}`} data-gate={stage.step}>
                <rect x="306" y={y} width="292" height="54" rx="9" />
                <text className="ae-svg-gate-no" x="324" y={y + 32}>{`①②③`[index]}</text>
                <text x="348" y={y + 26}>{stage.label}</text>
                {index === 0 && <text className="ae-svg-note" x="348" y={y + 44}>默认：最近一个 anchor 之后</text>}
                {index === 1 && <text className="ae-svg-note" x="348" y={y + 44}>被标记的在这里被排除</text>}
                {index === 2 && <text className="ae-svg-note" x="348" y={y + 44}>只有 message 往下走</text>}
                {index < gates.length - 1 && (
                  <path className="ae-svg-flow" data-from={`gate-${stage.step}`} data-to={`gate-${stage.step + 1}`} d={`M 452 ${y + 54} L 452 ${y + 74}`} markerEnd="url(#ae-arrow)" />
                )}
              </g>
            );
          })}

          {/* 被挡下的六类：从第三级向下漏出，明确「留在 tape，不进 messages」 */}
          <g className={`ae-svg-drop${reached("f-kind") ? " on" : ""}`} data-node="dropped">
            <path d="M 598 283 C 640 283, 640 330, 598 330" />
            <text x="590" y="352" textAnchor="end">
              {dropped.map((entry) => entry.entryKind).join(" · ")}
            </text>
            <text className="ae-svg-note" x="590" y="370" textAnchor="end">默认 selector：留在 tape，不进历史投影</text>
          </g>

          {/* 读出的历史 = 三级过滤的产物 */}
          <path className={`ae-svg-flow${reached("f-kind") ? " on" : ""}`} data-from="gate-3" data-to="projection" d="M 598 283 L 646 283" markerEnd="url(#ae-arrow)" />
          <g className={`ae-svg-zone projection${reached("f-kind") ? " on" : ""}`} data-zone="projection">
            <rect x="646" y="248" width="212" height="72" rx="10" />
            <text className="ae-svg-zone-title" x="662" y="272">读出的历史</text>
            {kept.map((entry, index) => (
              <g key={entry.id} className="ae-svg-kept" data-kind={entry.entryKind}>
                <rect x={662 + index * 96} y={284} width="88" height="26" rx="5" />
                <text x={706 + index * 96} y={302} textAnchor="middle">{entry.entryKind}</text>
              </g>
            ))}
          </g>

          {/* 本轮输入：不来自 tape */}
          <g className={`ae-svg-zone current${reached("f-assemble") ? " on" : ""}`} data-zone="current">
            <rect x="646" y="86" width="212" height="132" rx="10" />
            <text className="ae-svg-zone-title" x="662" y="110">本轮输入 · 不来自 tape</text>
            {topic.currentInputs.map((input, index) => (
              <g key={input.slot} className="ae-svg-slot" data-slot={input.slot}>
                <rect x="662" y={124 + index * 30} width="180" height="24" rx="5" />
                <text x="674" y={140 + index * 30}>{input.slot}</text>
              </g>
            ))}
          </g>

          {/* 两半合成完整 messages */}
          <path className={`ae-svg-flow${reached("f-assemble") ? " on" : ""}`} data-from="current" data-to="messages" d="M 858 152 L 902 176" markerEnd="url(#ae-arrow)" />
          <path className={`ae-svg-flow${reached("f-assemble") ? " on" : ""}`} data-from="projection" data-to="messages" d="M 858 284 L 902 212" markerEnd="url(#ae-arrow)" />
          <g className={`ae-svg-messages${reached("f-assemble") ? " on" : ""}`} data-node="messages">
            <rect x="902" y="164" width="126" height="60" rx="9" />
            <text x="965" y="190" textAnchor="middle">完整 messages</text>
            <text className="ae-svg-note" x="965" y="208" textAnchor="middle">历史 + 本轮输入</text>
          </g>

          <path className={`ae-svg-flow${reached("f-model") ? " on" : ""}`} data-from="messages" data-to="model" d="M 1028 194 L 1064 194" markerEnd="url(#ae-arrow)" />
          <g className={`ae-svg-model${reached("f-model") ? " on" : ""}`} data-node="model">
            <rect x="1064" y="162" width="112" height="64" rx="32" />
            <text x="1120" y="190" textAnchor="middle">调模型</text>
            <text className="ae-svg-note" x="1120" y="210" textAnchor="middle">
              {path === "tool" ? "返回工具调用" : "返回纯文本"}
            </text>
          </g>

          {path === "tool" && (
            <g className={`ae-svg-tool${reached("f-execute") ? " on" : ""}`} data-node="tool">
              <path className="ae-svg-flow" data-from="model" data-to="tool" d="M 1120 226 L 1120 256" markerEnd="url(#ae-arrow)" />
              <rect x="1046" y="256" width="148" height="40" rx="8" />
              <text x="1120" y="281" textAnchor="middle">执行工具</text>
            </g>
          )}

          {/* ④ 追加回 tape：闭环。这一轮写回去之后，下一轮从同一个集合再读。 */}
          <path
            className={`ae-svg-port write${reached(path === "tool" ? "f-append-tool" : "f-append-text") ? " on" : ""}`}
            data-dir="write"
            data-from={path === "tool" ? "tool" : "model"}
            data-to="tape"
            d={`M ${path === "tool" ? 1046 : 1064} ${path === "tool" ? 276 : 194} C 900 460, 300 470, 148 300`}
            markerEnd="url(#ae-arrow)"
          />
          <text
            className={`ae-svg-port-label${reached(path === "tool" ? "f-append-tool" : "f-append-text") ? " on" : ""}`}
            x="620"
            y="466"
            textAnchor="middle"
          >
            ④ 按固定顺序追加回 tape
          </text>

          {/* 自定义规则：整体替换三级，不是第四级 */}
          {custom && (
            <g className="ae-svg-bypass" data-node="bypass">
              <path d="M 262 96 C 340 18, 600 18, 638 262" markerEnd="url(#ae-arrow)" />
              <text x="470" y="42" textAnchor="middle">自定义 select：绕过默认三级</text>
            </g>
          )}
        </svg>
        <p className="mobile-scroll-cue">图较宽，可横向滑动查看右半部分。</p>
      </div>

      <div className="ae-tape-frames" data-frame={frame?.phase ?? "read"} data-frame-index={player.index}>
        <FrameTransport
          player={player}
          length={frames.length}
          label={`一轮读写（${path === "tool" ? "工具路径" : "纯文本路径"}）`}
        />
        <ol className="ae-frame-track">
          {frames.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={index === player.index ? "on" : ""}
                data-phase={item.phase}
                data-index={index}
                aria-current={index === player.index}
                onClick={() => player.seek(index)}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ol>
        <FrameNarration step={player.index + 1} text={frame?.text ?? ""} />
      </div>

      <details className="ae-tape-rules">
        <summary>三级过滤的完整规则</summary>
        <ol>
          {topic.readStages.map((stage) => (
            <li key={stage.step} className={stage.selectorMode === "custom" ? "custom" : "default"}>
              <strong>{stage.label}</strong>
              <em>{stage.selectorMode === "custom" ? "自定义覆盖" : "默认规则"}</em>
              <p>{stage.effect}</p>
            </li>
          ))}
        </ol>
      </details>

      <details className="ae-tape-write-order">
        <summary>一轮写入按什么顺序追加，什么时候触发</summary>
        <ol>
          {topic.writeStages.map((stage) => (
            <li key={stage.order}>
              <code>{stage.entryKind}</code>
              {stage.note}
            </li>
          ))}
        </ol>
        <ul>
          {topic.writeTriggers.map((trigger) => (
            <li key={trigger.path}>{trigger.note}</li>
          ))}
        </ul>
      </details>

      <details className="ae-tape-kinds">
        <summary>tape 上七类记录各装什么</summary>
        <ul>
          {topic.entries.map((entry) => (
            <li key={entry.id} data-kind={entry.entryKind}>
              <code>{entry.entryKind}</code>
              <span>{entry.payloadBrief}</span>
              <em>{entry.inDefaultMessages ? "默认进入历史投影" : "默认不进历史投影"}</em>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/* ================================================ B4 step 循环的分层状态机 */

function MachineVisual({ topic }: { topic: AeMachineTopic }) {
  const node = (id: string) => topic.nodes.find((item) => item.id === id);
  const zone = (id: string) => topic.zones.find((item) => item.id === id);
  const condition = (from: string, to: string) =>
    topic.edges.find((item) => item.from === from && item.to === to)?.condition;
  const nodeClass = (_id: string, base: string) => base;
  const edgeClass = (_from: string, _to: string, base = "ae-svg-medge") => base;

  return (
    <section className="ae-machine" aria-label="turn 内 step 循环的完整状态机与 C1 两条轨迹" data-level={topic.loopScope.outer}>
      <span className="ae-turn-scope-label">turn：入站处理边界</span>
      <div className="ae-step-loop-scope" data-level={topic.loopScope.inner}>
      {/* 图承担拓扑：三层分区、判定的形状、短路边直达 continue。条件与行号在图下的文字层。 */}
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-machine"
          viewBox="0 0 1200 640"
          role="img"
          aria-label="正常判定层、异常恢复层与循环耗尽层完整可见；第 max_steps 次仍继续后 for 耗尽并抛 RuntimeError"
        >
          <defs>
            <marker id="ae-a4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>

          {/* 三个分区：控制层次由分区承担，不靠段落标题 */}
          {[
            { id: "normal", y: 16, h: 268 },
            { id: "recover", y: 300, h: 176 },
            { id: "boundary", y: 492, h: 132 },
          ].map((band) => {
            const z = zone(band.id);
            return (
              <g key={band.id} className={`ae-svg-band-zone ${band.id}`} data-layer={z?.layer}>
                <rect x="16" y={band.y} width="1168" height={band.h} rx="12" />
                <text className="ae-svg-layer-no" x="34" y={band.y + 26}>{`层 ${z?.layer}`}</text>
                <text className="ae-svg-layer-title" x="80" y={band.y + 26}>{z?.title}</text>
              </g>
            );
          })}

          {/* 层 1：run → final(判定) → 短路 continue / steering(判定) → continue | stop */}
          <g className={nodeClass("run", "ae-svg-mnode act")} data-node="run">
            <rect x="44" y="118" width="150" height="48" rx="8" />
            <text x="119" y="147" textAnchor="middle">{node("run")?.label}</text>
          </g>
          <path className={edgeClass("run", "final")} data-from="run" data-to="final" data-condition={condition("run", "final")} d="M 194 142 L 250 142" markerEnd="url(#ae-a4)" />

          {/* 判定用菱形：形状本身区分「动作」与「判定」 */}
          <g className={nodeClass("final", "ae-svg-mnode gate")} data-node="final">
            <path d="M 250 142 L 380 96 L 510 142 L 380 188 Z" />
            <text x="380" y="138" textAnchor="middle">有工具调用</text>
            <text x="380" y="156" textAnchor="middle">或工具结果？</text>
          </g>

          {/* 短路边：加粗直达 continue，视觉上跳过 steering 判定 */}
          <path
            className={edgeClass("final", "continue", "ae-svg-medge short")}
            data-from="final"
            data-to="continue"
            data-shortcircuit="true"
            data-condition={condition("final", "continue")}
            d="M 380 96 C 380 52, 700 52, 880 96"
            markerEnd="url(#ae-a4)"
          />
          <text className="ae-svg-medge-label short" x="640" y="52" textAnchor="middle">有 → Python or 短路 → 继续</text>

          <path className={edgeClass("final", "steering")} data-from="final" data-to="steering" data-condition={condition("final", "steering")} d="M 510 142 L 566 142" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="538" y="132" textAnchor="middle">无</text>

          <g className={nodeClass("steering", "ae-svg-mnode gate")} data-node="steering">
            <path d="M 566 142 L 690 100 L 814 142 L 690 184 Z" />
            <text x="690" y="147" textAnchor="middle">别的通道有插话？</text>
          </g>

          <path className={edgeClass("steering", "continue")} data-from="steering" data-to="continue" data-condition={condition("steering", "continue")} d="M 814 132 L 880 118" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="846" y="112" textAnchor="middle">有</text>
          <path className={edgeClass("steering", "stop", "ae-svg-medge stop")} data-from="steering" data-to="stop" data-condition={condition("steering", "stop")} d="M 690 184 L 690 232" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="700" y="212">两者皆无</text>

          <g className={nodeClass("continue", "ae-svg-mnode go")} data-node="continue">
            <rect x="880" y="96" width="200" height="48" rx="24" />
            <text x="980" y="125" textAnchor="middle">继续下一个 step</text>
          </g>
          <g className={nodeClass("stop", "ae-svg-mnode halt")} data-node="stop">
            <rect x="586" y="232" width="208" height="42" rx="21" />
            <text x="690" y="259" textAnchor="middle">停止，正常返回</text>
          </g>

          {/* 继续 → 回到 run 的回边：环本身是这一层的形状 */}
          <path className={edgeClass("continue", "run", "ae-svg-medge loop")} data-from="continue" data-to="run" data-condition={condition("continue", "run")} d="M 980 144 C 980 210, 119 214, 119 166" markerEnd="url(#ae-a4)" />

          {/* 层 2：except → 判定(预算) → handoff（回边重试）| raise */}
          <g className={nodeClass("except", "ae-svg-mnode act")} data-node="except">
            <rect x="44" y="376" width="150" height="48" rx="8" />
            <text x="119" y="405" textAnchor="middle">这一步抛异常</text>
          </g>
          <path className={edgeClass("except", "budget")} data-from="except" data-to="budget" data-condition={condition("except", "budget")} d="M 194 400 L 250 400" markerEnd="url(#ae-a4)" />
          <g className={nodeClass("budget", "ae-svg-mnode gate")} data-node="budget">
            <path d="M 250 400 L 404 356 L 558 400 L 404 444 Z" />
            <text x="404" y="396" textAnchor="middle">上下文超长，且</text>
            <text x="404" y="414" textAnchor="middle">交接次数还没用完？</text>
          </g>
          <path className={edgeClass("budget", "handoff")} data-from="budget" data-to="handoff" data-condition={condition("budget", "handoff")} d="M 558 400 L 620 400" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="589" y="390" textAnchor="middle">是</text>
          <g className={nodeClass("handoff", "ae-svg-mnode act")} data-node="handoff">
            <rect x="620" y="376" width="240" height="48" rx="8" />
            <text x="740" y="399" textAnchor="middle">换新起点，带原 prompt</text>
            <text x="740" y="416" textAnchor="middle">回到下一次迭代</text>
          </g>
          <path className={edgeClass("handoff", "run", "ae-svg-medge loop")} data-from="handoff" data-to="run" data-condition={condition("handoff", "run")} d="M 740 376 C 740 292, 119 292, 119 168" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="430" y="286" textAnchor="middle">回到下一次迭代（层 1）</text>
          <g className={nodeClass("raise", "ae-svg-mnode halt err")} data-node="raise">
            <rect x="900" y="376" width="248" height="48" rx="8" />
            <text x="1024" y="405" textAnchor="middle">记成错误，抛给上层</text>
          </g>
          <path className={edgeClass("budget", "raise", "ae-svg-medge raise")} data-from="budget" data-to="raise" data-condition={condition("budget", "raise")} d="M 470 444 C 560 470, 760 464, 900 414" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="640" y="474" textAnchor="middle">否（次数用完，或不是上下文超长）</text>

          {/* 层 3：线性链 */}
          <g className={nodeClass("last-step", "ae-svg-mnode act")} data-node="last-step">
            <rect x="44" y="546" width="272" height="48" rx="8" />
            <text x="180" y="566" textAnchor="middle">step=max_steps 仍继续</text>
            <text className="ae-svg-note" x="180" y="584" textAnchor="middle">本例是 step 3</text>
          </g>
          <path className={edgeClass("last-step", "max-steps", "ae-svg-medge raise")} data-from="last-step" data-to="max-steps" data-condition={condition("last-step", "max-steps")} d="M 316 570 L 452 570" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="384" y="560" textAnchor="middle">for 耗尽</text>
          <g className={nodeClass("max-steps", "ae-svg-mnode halt err")} data-node="max-steps">
            <rect x="452" y="546" width="268" height="48" rx="8" />
            <text x="586" y="575" textAnchor="middle">抛错终止（步数用尽）</text>
          </g>
          <path
            className={edgeClass("continue", "last-step", "ae-svg-medge boundary")}
            data-from="continue"
            data-to="last-step"
            data-condition={condition("continue", "last-step")}
            d="M 1080 120 L 1160 120 L 1160 520 L 180 520 L 180 542"
            markerEnd="url(#ae-a4)"
          />
          <text className="ae-svg-medge-label" x="880" y="514">step=max_steps 且仍要求继续</text>
          <text className="ae-svg-note" x="744" y="575">for 耗尽后抛 RuntimeError；没有 step 4</text>
        </svg>
      </div>

      <div className="ae-mobile-visual ae-mobile-machine" data-mobile-visual="step-loop">
        <section data-layer="1">
          <header><b>层 1</b><strong>常规继续与停止</strong></header>
          <span className="ae-mobile-node">跑完一个 step</span>
          <i className="ae-mobile-arrow" aria-hidden="true">↓</i>
          <span className="ae-mobile-gate">有工具调用或工具结果？</span>
          <div className="ae-mobile-branch">
            <span className="go" data-from="final" data-to="continue"><small>有</small><strong>继续</strong></span>
            <span data-from="final" data-to="steering"><small>两者都没有</small><strong>检查插话</strong></span>
          </div>
          <div className="ae-mobile-branch">
            <span className="go" data-from="steering" data-to="continue"><small>有插话</small><strong>继续</strong></span>
            <span className="stop" data-from="steering" data-to="stop"><small>也无插话</small><strong>停止</strong></span>
          </div>
        </section>
        <section data-layer="2">
          <header><b>层 2</b><strong>异常恢复</strong></header>
          <span className="ae-mobile-node">step 抛异常</span>
          <i className="ae-mobile-arrow" aria-hidden="true">↓</i>
          <span className="ae-mobile-gate">上下文超长且次数未用完？</span>
          <div className="ae-mobile-branch">
            <span className="recover" data-from="budget" data-to="handoff"><small>是</small><strong>换起点重试</strong></span>
            <span className="raise" data-from="budget" data-to="raise"><small>否</small><strong>记错并抛出</strong></span>
          </div>
        </section>
        <section data-layer="3">
          <header><b>层 3</b><strong>循环边界</strong></header>
          <div className="ae-mobile-linear">
            <span>step 3 仍继续</span><i aria-hidden="true">→</i><span>for 耗尽</span><i aria-hidden="true">→</i><span className="raise">RuntimeError</span>
          </div>
          <em className="ae-tag fact">没有 step 4</em>
        </section>
      </div>

      <details className="ae-machine-details">
        <summary>各分支条件与证据等级</summary>
        <ul className="ae-machine-edges">
        {topic.edges.map((item) => (
          <li key={`${item.from}-${item.to}`} data-from={item.from} data-to={item.to} data-kind={item.kind}
            data-shortcircuit={item.shortCircuit ? "true" : undefined} data-condition={item.condition}>
            <b className={item.kind}>{item.kind === "continue" ? "继续" : item.kind === "stop" ? "停止" : item.kind === "recover" ? "恢复" : "抛出"}</b>
            <span>{item.condition}</span>
            {item.shortCircuit && <em className="ae-tag fact">Python or 短路</em>}
          </li>
        ))}
        </ul>
      </details>

      <div
        className="ae-c1-traces"
        data-max-steps={topic.experiment.maxSteps}
        data-steering={String(topic.experiment.steering)}
        data-branch={topic.experiment.branch}
      >
        <header>
          <strong>C1 等价结构：同一 max_steps=3</strong>
          <span>唯一变量：第 2 轮 tool_calls 是否为空</span>
        </header>
        <div>
          {topic.experiment.traces.map((trace) => (
            <article key={trace.id} data-trace={trace.id} data-max-steps={topic.experiment.maxSteps}>
              <b>{trace.label}</b>
              <ol>
                {trace.steps.map((step) => (
                  <li key={step.step} data-step={step.step} data-tool-calls={String(step.toolCalls)}>
                    <span>step {step.step}</span>
                    <strong>tool_calls={String(step.toolCalls)}</strong>
                  </li>
                ))}
                <li className="terminal" data-terminal={trace.terminal.outcome} data-after-step={trace.terminal.afterStep}>
                  {trace.terminal.outcome}
                </li>
              </ol>
            </article>
          ))}
        </div>
        <p className="ae-c1-evidence">
          {topic.experiment.evidence.map((evidence) => (
            <span key={`${evidence.scope}-${evidence.kind}`} data-scope={evidence.scope} data-target-verified={evidence.targetVerified}>
              {evidence.scope} · {evidence.kind}
            </span>
          ))}
        </p>
      </div>

      <details className="ae-machine-details">
        <summary>三个分区与 C1 未覆盖范围</summary>
        <ul className="ae-machine-zones">
          {topic.zones.map((item) => (
            <li key={item.id} data-layer={item.layer}>
              <b>{`层 ${item.layer}`}</b>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
            </li>
          ))}
        </ul>
        <p className="ae-machine-uncovered">
          <b>C1 未覆盖</b>
          {topic.experiment.uncovered.map((item) => <span key={item}>{item}</span>)}
        </p>
      </details>
      </div>
    </section>
  );
}

/* ================================================ B5 工具调用职责矩阵 */

function RolesVisual({ topic }: { topic: AeRolesTopic }) {
  return (
    <section className="ae-roles" aria-label="D4 最小 demo 与 Bub 的四职责对齐矩阵">
      <div className="ae-role-matrix" role="table" aria-label="决定、执行、继续、持久化职责矩阵" data-mobile-visual="roles-nesting">
        <div className="ae-role-head" role="row">
          <span role="columnheader">职责</span>
          {topic.systems.map((system) => (
            <span key={system.id} role="columnheader" data-system={system.id}>
              <strong>{system.label}</strong>
              <small>{system.evidence.kind}</small>
            </span>
          ))}
        </div>
        {topic.responsibilities.map((responsibility) => (
          <div key={responsibility.id} className="ae-role-row" role="row" data-responsibility={responsibility.id}>
            <strong role="rowheader">{responsibility.label}</strong>
            {topic.systems.map((system) => {
              const cell = topic.cells.find((item) => item.system === system.id && item.responsibility === responsibility.id);
              if (!cell) return null;
              return (
                <div
                  key={system.id}
                  id={`ae-role-${system.id}-${responsibility.id}`}
                  className={`ae-role-cell ${cell.status}`}
                  role="cell"
                  data-system={cell.system}
                  data-responsibility={cell.responsibility}
                  data-status={cell.status}
                  data-owner={cell.owner ?? "absent"}
                >
                  <span>{cell.status === "present" ? "具备" : cell.status === "manual" ? "手工" : "缺席"}</span>
                  <b>{cell.owner ?? "无 owner"}</b>
                  <p>{cell.mechanism}</p>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="ae-role-edges" aria-label="矩阵中的结构化交接边">
        {topic.systems.map((system) => (
          <section key={system.id} data-system={system.id}>
            <b>{system.label}</b>
            {topic.edges.filter((edge) => edge.system === system.id).map((edge) => (
              <span key={`${edge.from}-${edge.to}`} data-from={edge.from} data-to={edge.to}>
                <code>{edge.from} → {edge.to}</code>
                <small>{edge.payload}</small>
              </span>
            ))}
            {system.id === "d4" && <em>一次往返在手工执行后结束</em>}
          </section>
        ))}
      </div>

      <details className="ae-roles-details">
        <summary>D4 原始读数与对齐证据</summary>
        <dl className="ae-role-observations">
          <dt>contentEmpty</dt><dd>{String(topic.observations.contentEmpty)}</dd>
          <dt>toolCallCount</dt><dd>{topic.observations.toolCallCount}</dd>
          <dt>argumentsJsonParseable</dt><dd>{String(topic.observations.argumentsJsonParseable)}</dd>
          <dt>resultFedBack</dt><dd>{String(topic.observations.resultFedBack)}</dd>
        </dl>
        <p data-scope={topic.alignmentEvidence.scope} data-target-verified={topic.alignmentEvidence.targetVerified}>
          跨系统职责对齐 · {topic.alignmentEvidence.kind}
        </p>
        <div className="ae-roles-crossing">
        <b>结构化边</b>
        <ul>
          {topic.edges.map((item) => (
            <li key={`${item.system}-${item.from}-${item.to}`} data-system={item.system} data-from={item.from} data-to={item.to}>
              <code>
                {item.from} → {item.to}
              </code>
              <span>{item.payload}</span>
            </li>
          ))}
        </ul>
        </div>
      </details>

      <details className="ae-roles-hooks">
        <summary>call id、JSON 与 Bub hook 细节</summary>
        <ul>
          {topic.hooks.map((hook) => (
            <li key={hook.name}>
              <code>{hook.name}</code>
              {hook.call}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
