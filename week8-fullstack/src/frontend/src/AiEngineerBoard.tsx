// 「AI 工程」板（W12 起）。施工图见 week8-fullstack/notes/w12-ai-board-design.md，
// 形态与十列契约见 w12-ai-visualization-plan.md，视觉基线见 SHOWCASE-VISUAL-PROTOCOL.md。
//
// 每块的形态由内容关系推导得到，不复用别的板的现成形态：
//   P1/P3 = 对齐映照（结构映射）  B1 = 双线序列泳道（分叉汇合）
//   B2 = 顺序管线 + 作用域包含框   B3 = 单一真相源 + 读写口（时序过程）
//   B4 = 分层状态机（四个控制层次）B5 = 泳道 + 嵌套容器（归属与层级）
//
// 承担结论的位置编码（改 CSS 前先看断言 scripts/verify-w9-board.mjs §E）：
//   B1 跨两列 = 两条启动线共有；B2 罩子的起止 = finally 的作用域；
//   B3 读口在带上、写口在带下 = 读写方向；B5 内框在外框内 = turn 包含 step。
import { useMemo, useState } from "react";
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
            turn、tape 与 step 循环长什么样。页面只呈现已验收结论，待运行验证的分支单独标注。
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
                 证据不删（结论要可回溯，十列⑩要求行号在页），只是不再和结论抢版面。 */
              <details className="ae-sources">
                <summary>源码位置（Bub @ 33c417a，只读）</summary>
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
            return (
              <g
                key={unit.id}
                className={`ae-svg-unit ${unit.mapType}${on ? " on" : ""}`}
                data-unit={unit.id}
                data-maptype={unit.mapType}
                onMouseEnter={() => setHot(unit.id)}
                onMouseLeave={() => setHot(null)}
              >
                <rect className="ae-svg-side" x="40" y={y} width="404" height="40" rx="8" />
                <text x="58" y={y + 25}>{unit.semantics}</text>
                {/* 线型即映射类型：实线=近似、虚线=Python 侧新增、括号=同语言两形态 */}
                {py ? (
                  <path className="ae-svg-map-line" d={`M 756 ${y + 8} L 790 ${y + 8} L 790 ${y + 32} L 756 ${y + 32}`} />
                ) : (
                  <path className="ae-svg-map-line" d={`M 452 ${y + 20} L 748 ${y + 20}`} markerEnd="url(#ae-am)" />
                )}
                <text className="ae-svg-map-tag" x="600" y={y + 14} textAnchor="middle">
                  {topic.legend.find((item) => item.type === unit.mapType)?.label.split("（")[0]}
                </text>
                <rect className="ae-svg-side" x="756" y={y} width="404" height="40" rx="8" />
                <text x="774" y={y + 25}>
                  {unit.sides.filter((side) => side.lang === "Python").map((side) => side.kind.split("，")[0]).join(" / ")}
                </text>
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
            return (
              <g
                key={position.id}
                className={`ae-svg-pair${on ? " on" : ""}`}
                data-pos={index + 1}
                onMouseEnter={() => setHot(position.id)}
                onMouseLeave={() => setHot(null)}
              >
                <rect className="ae-svg-side" x="40" y={y} width="412" height="58" rx="9" />
                <text className="ae-svg-side-role" x="58" y={y + 24}>{`${index + 1}. ${position.role}`}</text>
                <text className="ae-svg-side-src" x="58" y={y + 44}>{position.express.source}</text>

                {/* 对齐线：左端实心圆 = 成立，右端短横 = 失效，形状先于颜色 */}
                <path className="ae-svg-align-line" d={`M 452 ${y + 29} L 748 ${y + 29}`} />
                <circle className="ae-svg-holds-dot" cx="462" cy={y + 29} r="6" />
                <rect className="ae-svg-fails-bar" x="726" y={y + 26} width="16" height="6" rx="2" />
                <text className="ae-svg-align-tag holds" x="476" y={y + 22}>成立</text>
                <text className="ae-svg-align-tag fails" x="722" y={y + 22} textAnchor="end">失效</text>

                <rect className="ae-svg-side" x="748" y={y} width="412" height="58" rx="9" />
                <text className="ae-svg-side-role" x="766" y={y + 24}>{`${index + 1}. ${position.role}`}</text>
                <text className="ae-svg-side-src" x="766" y={y + 44}>{position.typer.source}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 文字层：每对的实现、成立点与失效点，完整保留 */}
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
    </section>
  );
}

/* ==================================================== B1 入口链（单链） */

// 笔记记录的是一条入口链（day3 §上午 / report §1），不是两条启动路径。
// 2026-09-02：上一版画成「console script vs python -m」两条线，是我在笔记的一处接缝上
// 自行推断后画出来的——笔记里这两个词都不存在。现按笔记原样画单链，接缝单独标为待核验。
function EntryVisual({ topic }: { topic: AeEntryTopic }) {
  const [hot, setHot] = useState<string | null>(null);
  const COL = 3;
  const CW = 344;
  const CH = 76;
  const GX = 42;
  const GY = 34;
  const pos = (index: number) => {
    const row = Math.floor(index / COL);
    const col = row % 2 === 0 ? index % COL : COL - 1 - (index % COL); // 蛇形：读到行尾折回
    return { x: 24 + col * (CW + GX), y: 24 + row * (CH + GY) };
  };

  return (
    <section className="ae-entry" aria-label="从一条命令到第一次 turn 的调用链">
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-entry"
          viewBox="0 0 1200 350"
          role="img"
          aria-label="入口链：入口声明、模块级建 app、建 typer 应用、注册 run 命令、app() 分发、run 回调、起事件循环、启动 store、触发第一次 turn"
        >
          <defs>
            <marker id="ae-a1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>

          {topic.nodes.map((node, index) => {
            const p = pos(index);
            const next = index < topic.nodes.length - 1 ? pos(index + 1) : null;
            const row = Math.floor(index / COL);
            const nextRow = next ? Math.floor((index + 1) / COL) : row;
            const on = hot === node.id;
            return (
              <g key={node.id} className={`ae-svg-chain${on ? " on" : ""}${node.trigger ? " trigger" : ""}`} data-node={node.id}>
                <rect
                  x={p.x}
                  y={p.y}
                  width={CW}
                  height={CH}
                  rx="10"
                  onMouseEnter={() => setHot(node.id)}
                  onMouseLeave={() => setHot(null)}
                />
                <text className="ae-svg-chain-src" x={p.x + 16} y={p.y + 24}>
                  {node.module} {node.line}
                </text>
                {/* 图上放短标签，不截断长句——完整动作在图下的文字层 */}
                <text className="ae-svg-chain-act" x={p.x + 16} y={p.y + 56}>
                  {node.short}
                </text>
                {node.trigger && (
                  <text className="ae-svg-chain-flag" x={p.x + CW - 16} y={p.y + 24} textAnchor="end">
                    第一次 turn
                  </text>
                )}
                {next &&
                  (nextRow === row ? (
                    /* 同一行：横向箭头 */
                    <path
                      className="ae-svg-flow"
                      d={
                        next.x > p.x
                          ? `M ${p.x + CW} ${p.y + CH / 2} L ${next.x - 4} ${next.y + CH / 2}`
                          : `M ${p.x} ${p.y + CH / 2} L ${next.x + CW + 4} ${next.y + CH / 2}`
                      }
                      markerEnd="url(#ae-a1)"
                    />
                  ) : (
                    /* 折行：从底边下折到下一行同侧 */
                    <path
                      className="ae-svg-flow"
                      d={`M ${p.x + CW / 2} ${p.y + CH} L ${p.x + CW / 2} ${next.y - 4}`}
                      markerEnd="url(#ae-a1)"
                    />
                  ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 文字层：每一步的完整动作与内部细节，保留在主路径上 */}
      <ol className="ae-entry-chain">
        {topic.nodes.map((node, index) => (
          <li
            key={node.id}
            data-node={node.id}
            className={node.trigger ? "trigger" : ""}
            onMouseEnter={() => setHot(node.id)}
            onMouseLeave={() => setHot(null)}
          >
            <b>{index + 1}</b>
            <div>
              <code>
                {node.module} {node.line}
              </code>
              <strong>{node.action}</strong>
              {node.detail && <p>{node.detail}</p>}
            </div>
            {node.trigger && <em className="ae-tag join">第一次 turn 的触发点</em>}
          </li>
        ))}
      </ol>

      {/* 笔记这条链上尚未核实的接缝：原样呈现，不替笔记解释 */}
      <div className="ae-entry-seam" data-seam="open">
        <b>待核实的一处接缝</b>
        <strong>{topic.seam.at}</strong>
        <p>{topic.seam.question}</p>
        <em className="ae-tag pending">{topic.seam.status}</em>
      </div>

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

      <details className="ae-entry-corrections">
        <summary>定位过程中的三处偏差（先答后对）</summary>
        <ul>
          {topic.corrections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/* ================================================ B2 turn 管线与 finally 罩子 */

// 罩子与阶段共用同一个 grid：CSS 改列数时罩子会跟着错位，被几何断言抓住。
function PipelineVisual({ topic }: { topic: AePipelineTopic }) {
  const [end, setEnd] = useState<string | null>(null);
  const scopeIndex = topic.stages.findIndex((stage) => stage.id === topic.finallyScope.from);
  const W = 132;
  const GAP = 19;
  const x0 = 24;
  const stageX = (index: number) => x0 + index * (W + GAP);
  const endY = [56, 140, 224];

  return (
    <section className="ae-pipe" aria-label="一次 turn 的管线阶段与结束分叉">
      {/* 图承担顺序、罩子范围与三岔；下面的文字层承担每一阶段具体做什么。两层并存，不互相替代。 */}
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-pipe"
          viewBox="0 0 1200 300"
          role="img"
          aria-label="turn 的六个阶段依次执行；finally 只罩住第四段 _run_model；turn 结束时按正常、普通异常、取消分成三岔"
        >
          <defs>
            <marker id="ae-a2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>

          {/* finally 的作用域：一个真实的包围框，只罩住第 4 段——罩子的起止就是结论 */}
          <g className="ae-svg-scope" data-scope-from={topic.finallyScope.from} data-scope-to={topic.finallyScope.to}>
            <rect x={stageX(scopeIndex) - 10} y="98" width={W + 20} height="94" rx="10" />
            <text x={stageX(scopeIndex) + W / 2} y="118" textAnchor="middle">finally 只罩这一段</text>
          </g>

          {topic.stages.map((stage, index) => (
            <g key={stage.id} className="ae-svg-stage" data-stage={stage.id}>
              <rect x={stageX(index)} y="130" width={W} height="52" rx="8" />
              <text className="ae-svg-stage-no" x={stageX(index) + 12} y="150">{index + 1}</text>
              <text x={stageX(index) + W / 2} y="163" textAnchor="middle">{stage.label}</text>
              {index < topic.stages.length - 1 && (
                <path
                  className="ae-svg-flow"
                  d={`M ${stageX(index) + W} 156 L ${stageX(index + 1) - 4} 156`}
                  markerEnd="url(#ae-a2)"
                />
              )}
            </g>
          ))}

          {/* 三岔：从管线末端真实分出三条路径 */}
          {topic.ends.map((item, index) => {
            const y = endY[index];
            const from = stageX(topic.stages.length - 1) + W;
            return (
              <g
                key={item.id}
                className={`ae-svg-end ${item.tone}${end === item.id ? " on" : ""}`}
                data-tone={item.tone}
                data-verified={item.verified === "待运行验证" ? "false" : "true"}
              >
                <path
                  className="ae-svg-branch"
                  d={`M ${from} 156 C ${from + 34} 156, ${from + 34} ${y + 22}, ${from + 68} ${y + 22}`}
                  markerEnd="url(#ae-a2)"
                />
                <rect x={from + 72} y={y} width="196" height="44" rx="8" />
                <text x={from + 84} y={y + 27}>{item.label}</text>
                {item.verified === "待运行验证" && (
                  <text className="ae-svg-pending" x={from + 262} y={y + 16} textAnchor="end">待验证</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 文字层：图之外的精确性与限定语，不为凑字数下沉 */}
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
        <b>finally 的作用域</b>
        {topic.finallyScope.note}
      </p>

      <div className="ae-pipe-ends">
        <span className="ae-pipe-ends-title">turn 结束的三岔</span>
        {topic.ends.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ae-pipe-end ${item.tone}${end === item.id ? " on" : ""}`}
            data-tone={item.tone}
            data-verified={item.verified === "待运行验证" ? "false" : "true"}
            aria-pressed={end === item.id}
            onClick={() => setEnd(end === item.id ? null : item.id)}
          >
            <strong>{item.label}</strong>
            {item.verified === "待运行验证" && <em className="ae-tag pending">待运行验证</em>}
            <p>{item.path}</p>
          </button>
        ))}
      </div>

      <div className="ae-pipe-state">
        <p>
          <b>可变草稿纸</b>
          {topic.stateNote.mutable}
        </p>
        <p>
          <b>不可变交付物</b>
          {topic.stateNote.frozen}
        </p>
      </div>
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
  const at = frame?.id ?? "f-start";
  const seq = frames.findIndex((item) => item.id === at);
  const reached = (id: string) => seq >= frames.findIndex((item) => item.id === id);

  // 画的是规则，不是某次真实会话的记录序列：tape 是一个记录集合，
  // 中间三级是过滤规则，右侧是拼装与调用，最后一条弧线把这一轮追加回集合，形成闭环。
  const kinds = topic.entries;
  const kept = kinds.filter((entry) => entry.inMessages);
  const dropped = kinds.filter((entry) => !entry.inMessages);
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
                className={`ae-svg-kind${entry.inMessages ? " kept" : " dropped"}`}
                data-kind={entry.entryKind}
                data-filtered={entry.inMessages ? undefined : "true"}
              >
                <rect x={48 + (index % 2) * 104} y={112 + Math.floor(index / 2) * 42} width="96" height="32" rx="6" />
                <text x={96 + (index % 2) * 104} y={132 + Math.floor(index / 2) * 42} textAnchor="middle">
                  {entry.entryKind}
                </text>
              </g>
            ))}
          </g>

          {/* 三级过滤：逐级收窄是这块内容的真实形状，也是流程本身 */}
          <path className={`ae-svg-flow${reached("f-range") ? " on" : ""}`} d="M 262 150 L 306 150" markerEnd="url(#ae-arrow)" />
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
                  <path className="ae-svg-flow" d={`M 452 ${y + 54} L 452 ${y + 74}`} markerEnd="url(#ae-arrow)" />
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
            <text className="ae-svg-note" x="590" y="370" textAnchor="end">这六类留在 tape，模型看不到</text>
          </g>

          {/* 读出的历史 = 三级过滤的产物 */}
          <path className={`ae-svg-flow${reached("f-kind") ? " on" : ""}`} d="M 598 283 L 646 283" markerEnd="url(#ae-arrow)" />
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
          <path className={`ae-svg-flow${reached("f-assemble") ? " on" : ""}`} d="M 858 152 L 902 176" markerEnd="url(#ae-arrow)" />
          <path className={`ae-svg-flow${reached("f-assemble") ? " on" : ""}`} d="M 858 284 L 902 212" markerEnd="url(#ae-arrow)" />
          <g className={`ae-svg-messages${reached("f-assemble") ? " on" : ""}`} data-node="messages">
            <rect x="902" y="164" width="126" height="60" rx="9" />
            <text x="965" y="190" textAnchor="middle">完整 messages</text>
            <text className="ae-svg-note" x="965" y="208" textAnchor="middle">历史 + 本轮输入</text>
          </g>

          <path className={`ae-svg-flow${reached("f-model") ? " on" : ""}`} d="M 1028 194 L 1064 194" markerEnd="url(#ae-arrow)" />
          <g className={`ae-svg-model${reached("f-model") ? " on" : ""}`} data-node="model">
            <rect x="1064" y="162" width="112" height="64" rx="32" />
            <text x="1120" y="190" textAnchor="middle">调模型</text>
            <text className="ae-svg-note" x="1120" y="210" textAnchor="middle">
              {path === "tool" ? "返回工具调用" : "返回纯文本"}
            </text>
          </g>

          {path === "tool" && (
            <g className={`ae-svg-tool${reached("f-execute") ? " on" : ""}`} data-node="tool">
              <path className="ae-svg-flow" d="M 1120 226 L 1120 256" markerEnd="url(#ae-arrow)" />
              <rect x="1046" y="256" width="148" height="40" rx="8" />
              <text x="1120" y="281" textAnchor="middle">执行工具</text>
            </g>
          )}

          {/* ④ 追加回 tape：闭环。这一轮写回去之后，下一轮从同一个集合再读。 */}
          <path
            className={`ae-svg-port write${reached(path === "tool" ? "f-append-tool" : "f-append-text") ? " on" : ""}`}
            data-dir="write"
            d={`M ${path === "tool" ? 1046 : 1064} ${path === "tool" ? 276 : 194} C 900 460, 300 470, 148 300`}
            markerEnd="url(#ae-arrow)"
          />
          <text
            className={`ae-svg-port-label${reached(path === "tool" ? "f-append-tool" : "f-append-text") ? " on" : ""}`}
            x="620"
            y="466"
            textAnchor="middle"
          >
            ④ 这一轮按固定顺序追加回 tape（anchor 不动，旧记录不变）
          </text>

          {/* 自定义规则：整体替换三级，不是第四级 */}
          {custom && (
            <g className="ae-svg-bypass" data-node="bypass">
              <path d="M 262 96 C 340 18, 600 18, 638 262" markerEnd="url(#ae-arrow)" />
              <text x="470" y="42" textAnchor="middle">{custom.label}</text>
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
              <em>{entry.inMessages ? "进模型 messages" : "不进模型 messages"}</em>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/* ================================================ B4 step 循环的分层状态机 */

function MachineVisual({ topic }: { topic: AeMachineTopic }) {
  const player = useFramePlayer(topic.demo.length, {
    autoPlay: false,
    intervalAt: (index) => dwellByText(topic.demo[index]?.text ?? ""),
  });
  const node = (id: string) => topic.nodes.find((item) => item.id === id);
  const zone = (id: string) => topic.zones.find((item) => item.id === id);

  return (
    <section className="ae-machine" aria-label="Agent step 循环的四个控制层次">
      {/* 图承担拓扑：三层分区、判定的形状、短路边直达 continue。条件与行号在图下的文字层。 */}
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-machine"
          viewBox="0 0 1200 640"
          role="img"
          aria-label="正常判定层里有工具结果就短路继续、否则查插话再决定停止；异常恢复层按交接次数预算决定重试还是抛出；循环边界层在最后一次仍要求继续时抛错"
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
          <g className="ae-svg-mnode act" data-node="run">
            <rect x="44" y="118" width="150" height="48" rx="8" />
            <text x="119" y="147" textAnchor="middle">{node("run")?.label}</text>
          </g>
          <path className="ae-svg-medge" data-from="run" data-to="final" d="M 194 142 L 250 142" markerEnd="url(#ae-a4)" />

          {/* 判定用菱形：形状本身区分「动作」与「判定」 */}
          <g className="ae-svg-mnode gate" data-node="final">
            <path d="M 250 142 L 380 96 L 510 142 L 380 188 Z" />
            <text x="380" y="138" textAnchor="middle">有工具调用</text>
            <text x="380" y="156" textAnchor="middle">或工具结果？</text>
          </g>

          {/* 短路边：加粗直达 continue，视觉上跳过 steering 判定 */}
          <path
            className="ae-svg-medge short"
            data-from="final"
            data-to="continue"
            data-shortcircuit="true"
            d="M 380 96 C 380 52, 700 52, 880 96"
            markerEnd="url(#ae-a4)"
          />
          <text className="ae-svg-medge-label short" x="640" y="52" textAnchor="middle">有 → 短路，不再看插话</text>

          <path className="ae-svg-medge" data-from="final" data-to="steering" d="M 510 142 L 566 142" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="538" y="132" textAnchor="middle">无</text>

          <g className="ae-svg-mnode gate" data-node="steering">
            <path d="M 566 142 L 690 100 L 814 142 L 690 184 Z" />
            <text x="690" y="147" textAnchor="middle">别的通道有插话？</text>
          </g>

          <path className="ae-svg-medge" data-from="steering" data-to="continue" d="M 814 132 L 880 118" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="846" y="112" textAnchor="middle">有</text>
          <path className="ae-svg-medge stop" data-from="steering" data-to="stop" d="M 690 184 L 690 232" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="700" y="212">两者皆无</text>

          <g className="ae-svg-mnode go" data-node="continue">
            <rect x="880" y="96" width="200" height="48" rx="24" />
            <text x="980" y="125" textAnchor="middle">继续下一个 step</text>
          </g>
          <g className="ae-svg-mnode halt" data-node="stop">
            <rect x="586" y="232" width="208" height="42" rx="21" />
            <text x="690" y="259" textAnchor="middle">停止，正常返回</text>
          </g>

          {/* 继续 → 回到 run 的回边：环本身是这一层的形状 */}
          <path className="ae-svg-medge loop" data-from="continue" data-to="run" d="M 980 144 C 980 210, 119 214, 119 166" markerEnd="url(#ae-a4)" />

          {/* 层 2：except → 判定(预算) → handoff（回边重试）| raise */}
          <g className="ae-svg-mnode act" data-node="except">
            <rect x="44" y="376" width="150" height="48" rx="8" />
            <text x="119" y="405" textAnchor="middle">这一步抛异常</text>
          </g>
          <path className="ae-svg-medge" data-from="except" data-to="handoff" d="M 194 400 L 250 400" markerEnd="url(#ae-a4)" />
          <g className="ae-svg-mnode gate" data-node="budget">
            <path d="M 250 400 L 404 356 L 558 400 L 404 444 Z" />
            <text x="404" y="396" textAnchor="middle">上下文超长，且</text>
            <text x="404" y="414" textAnchor="middle">交接次数还没用完？</text>
          </g>
          <path className="ae-svg-medge" data-from="budget" data-to="handoff" d="M 558 400 L 620 400" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="589" y="390" textAnchor="middle">是</text>
          <g className="ae-svg-mnode act" data-node="handoff">
            <rect x="620" y="376" width="240" height="48" rx="8" />
            <text x="740" y="399" textAnchor="middle">换新起点，带原 prompt</text>
            <text x="740" y="416" textAnchor="middle">回到下一次迭代</text>
          </g>
          <path className="ae-svg-medge loop" data-from="handoff" data-to="run" d="M 740 376 C 740 292, 119 292, 119 168" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="430" y="286" textAnchor="middle">回到下一次迭代（层 1）</text>
          <g className="ae-svg-mnode halt err" data-node="raise">
            <rect x="900" y="376" width="248" height="48" rx="8" />
            <text x="1024" y="405" textAnchor="middle">记成错误，抛给上层</text>
          </g>
          <path className="ae-svg-medge raise" data-from="budget" data-to="raise" d="M 470 444 C 560 470, 760 464, 900 414" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="640" y="474" textAnchor="middle">否（次数用完，或不是上下文超长）</text>

          {/* 层 3：线性链 */}
          <g className="ae-svg-mnode act" data-node="last-step">
            <rect x="44" y="546" width="272" height="48" rx="8" />
            <text x="180" y="575" textAnchor="middle">最后一次迭代仍要求继续</text>
          </g>
          <path className="ae-svg-medge raise" data-from="last-step" data-to="max-steps" d="M 316 570 L 452 570" markerEnd="url(#ae-a4)" />
          <text className="ae-svg-medge-label" x="384" y="560" textAnchor="middle">for 耗尽</text>
          <g className="ae-svg-mnode halt err" data-node="max-steps">
            <rect x="452" y="546" width="268" height="48" rx="8" />
            <text x="586" y="575" textAnchor="middle">抛错终止（步数用尽）</text>
          </g>
          <text className="ae-svg-note" x="744" y="575">继续与停止在层 1；这一层只在「一直继续」时才触发</text>
        </svg>
      </div>

      {/* 文字层：每条边的完整条件，保留在主路径上 */}
      <ul className="ae-machine-edges">
        {topic.edges.map((item) => (
          <li key={`${item.from}-${item.to}`} data-from={item.from} data-to={item.to} data-kind={item.kind}
            data-shortcircuit={item.shortCircuit ? "true" : undefined} data-condition={item.condition}>
            <b className={item.kind}>{item.kind === "continue" ? "继续" : item.kind === "stop" ? "停止" : item.kind === "recover" ? "恢复" : "抛出"}</b>
            <span>{item.condition}</span>
            {item.shortCircuit && <em className="ae-tag short">短路：不再看插话</em>}
          </li>
        ))}
      </ul>

      <div className="ae-machine-foot">
        <div className="ae-machine-demo">
          <div className="ae-machine-demo-head">
            <strong>C1 演示：模型反复要工具时会怎样</strong>
            <em className="ae-tag pending">相对示意 · 结构演示，非实测计数</em>
          </div>
          <FrameTransport player={player} length={topic.demo.length} label="不收敛的一次循环" />
          <FrameNarration step={player.index + 1} text={topic.demo[player.index]?.text ?? ""} />
        </div>

        <div className="ae-machine-evidence">
          <b>逐分支证据状态</b>
          <ul>
            {topic.evidenceStatus.map((item) => (
              <li key={item.branch} data-status={item.status}>
                <span>{item.branch}</span>
                <em className={item.status === "待运行验证" ? "ae-tag pending" : "ae-tag fact"}>{item.status}</em>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="ae-machine-zones">
        {topic.zones.map((item) => (
          <li key={item.id} data-layer={item.layer}>
            <b>{`层 ${item.layer}`}</b>
            <strong>{item.title}</strong>
            <p>{item.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================================================ B5 职责泳道与 turn ⊃ step */

function RolesVisual({ topic }: { topic: AeRolesTopic }) {
  const lanes: Array<{ id: "model" | "tool" | "harness"; label: string; y: number }> = [
    { id: "model", label: "model · 决策", y: 68 },
    { id: "tool", label: "tool · 执行", y: 168 },
    { id: "harness", label: "harness · 编排与落盘", y: 268 },
  ];
  const laneY = (id: string) => lanes.find((lane) => lane.id === id)?.y ?? 268;
  // 交接箭头走参与者框之间的竖直缝隙，标签落在泳道之间的空档——两者都不压框。
  const GAP_A = 596;
  const GAP_B = 824;

  return (
    <section className="ae-roles" aria-label="model / tool / harness 的职责与 turn 包含 step">
      {/* 图承担归属（泳道）、交接（带载荷的箭头）与层级（turn 框套 step 框）；细节在图下文字层。 */}
      <div className="ae-fig-wrap">
        <svg
          className="ae-fig ae-fig-roles"
          viewBox="0 0 1200 440"
          role="img"
          aria-label="三条泳道分别是 model 决策、tool 执行、harness 编排与落盘；turn 框套着 step 框，一个 turn 里 step 可以转很多圈；harness 在工具执行之后把这一轮写回 tape"
        >
          <defs>
            <marker id="ae-a5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="ae-svg-arrowhead" />
            </marker>
          </defs>

          <g className="ae-svg-turn" data-level="turn">
            <rect x="236" y="26" width="900" height="316" rx="14" />
            <text x="254" y="48">turn · 一个入站消息 → 一份不可变结果（框架层边界）</text>
          </g>

          <g className="ae-svg-step" data-level="step">
            <rect x="330" y="58" width="742" height="276" rx="12" />
            <text x="348" y="80">step · 一次模型往返（+ 可能的工具执行）</text>
            <path className="ae-svg-steploop" d="M 1050 300 C 1104 300, 1104 104, 1050 104" markerEnd="url(#ae-a5)" />
            <text className="ae-svg-steploop-label" x="1044" y="150" textAnchor="end">可以转很多圈</text>
          </g>

          {lanes.map((lane) => (
            <g key={lane.id} className={`ae-svg-lane ${lane.id}`} data-role={lane.id}>
              <rect x="16" y={lane.y} width="1168" height="64" rx="10" />
              <text x="34" y={lane.y + 38}>{lane.label}</text>
            </g>
          ))}

          {topic.participants.map((item) => {
            const inLane = topic.participants.filter((p) => p.lane === item.lane);
            const pos = inLane.indexOf(item);
            const x = 356 + pos * 172;
            return (
              <g key={item.id} className="ae-svg-actor" data-owner={item.id} data-lane={item.lane}>
                <rect x={x} y={laneY(item.lane) + 13} width="160" height="38" rx="8" />
                <text x={x + 80} y={laneY(item.lane) + 37} textAnchor="middle">{item.object.split("（")[0].split(" / ")[0]}</text>
              </g>
            );
          })}

          {/* harness ↔ model：走 GAP_A 这条缝，标签落在 model 与 tool 两条泳道之间的空档 */}
          <path className="ae-svg-cross" data-from="harness" data-to="model" d={`M ${GAP_A - 14} 268 L ${GAP_A - 14} 134`} markerEnd="url(#ae-a5)" />
          <path className="ae-svg-cross" data-from="model" data-to="harness" d={`M ${GAP_A + 14} 134 L ${GAP_A + 14} 268`} markerEnd="url(#ae-a5)" />
          <text className="ae-svg-cross-label" x={GAP_A - 20} y="152" textAnchor="end">完整 messages ↑</text>
          <text className="ae-svg-cross-label" x={GAP_A + 20} y="152">↓ 工具调用 / 纯文本</text>

          {/* harness ↔ tool：走 GAP_B 这条缝，标签落在 tool 与 harness 之间的空档 */}
          <path className="ae-svg-cross" data-from="harness" data-to="tool" d={`M ${GAP_B - 14} 268 L ${GAP_B - 14} 234`} markerEnd="url(#ae-a5)" />
          <path className="ae-svg-cross" data-from="tool" data-to="harness" d={`M ${GAP_B + 14} 234 L ${GAP_B + 14} 268`} markerEnd="url(#ae-a5)" />
          <text className="ae-svg-cross-label" x={GAP_B - 20} y="256" textAnchor="end">执行请求 ↑</text>
          <text className="ae-svg-cross-label" x={GAP_B + 20} y="256">↓ 工具结果</text>

          {/* tape 在 turn 之外：它跨 turn 存在，这一轮结束后下一轮还从它读（详见 B3） */}
          <g className="ae-svg-store-node" data-node="tape">
            <rect x="356" y="368" width="220" height="42" rx="8" />
            <text x="466" y="394" textAnchor="middle">tape（跨 turn 存在）</text>
          </g>
          <path className="ae-svg-cross write" data-from="harness" data-to="tape" d="M 466 332 L 466 366" markerEnd="url(#ae-a5)" />
          <text className="ae-svg-cross-label" x="484" y="356">写回：工具执行之后</text>
        </svg>
      </div>

      {/* 文字层：谁决定什么，逐条保留 */}
      <div className="ae-roles-lanes">
        {lanes.map((lane) => (
          <div key={lane.id} className={`ae-lane ${lane.id}`} data-role={lane.id}>
            <span className="ae-lane-title">{lane.label}</span>
            {topic.participants
              .filter((item) => item.lane === lane.id)
              .map((item) => (
                <div key={item.id} className="ae-lane-action" data-owner={item.id}>
                  <strong>{item.object}</strong>
                  <span>{item.role}</span>
                  <p>{item.decides}</p>
                </div>
              ))}
          </div>
        ))}
      </div>

      <p className="ae-nest-note">
        <b>层级</b>
        {topic.nesting.turn}；{topic.nesting.step}。{topic.nesting.note}
      </p>

      <div className="ae-roles-crossing">
        <b>跨泳道交接（带载荷）</b>
        <ul>
          {topic.crossing.map((item) => (
            <li key={`${item.from}-${item.to}-${item.payload}`} data-from={item.from} data-to={item.to}>
              <code>
                {item.from} → {item.to}
              </code>
              <span>{item.payload}</span>
            </li>
          ))}
        </ul>
      </div>

      <details className="ae-roles-hooks">
        <summary>主链经过的 hook 调用点</summary>
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