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
import { useMemo, useState, type CSSProperties } from "react";
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
              <div className="ae-map-side ts" id={tsId}>
                <strong>{unit.semantics}</strong>
                <code>{tsSide?.kind ?? "—"}</code>
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
                  <summary>实测记录</summary>
                  <p>{unit.detail}</p>
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

  return (
    <section className="ae-align" aria-label="Express 与 typer 的职责位置对照">
      <div className="ae-align-head">
        <span className="express">{topic.hosts.left}</span>
        <span className="mid">四个职责位置</span>
        <span className="typer">{topic.hosts.right}</span>
      </div>

      <div className="ae-align-rows">
        {topic.positions.map((position, index) => {
          const leftId = `ae-p3-${position.id}-express`;
          const rightId = `ae-p3-${position.id}-typer`;
          const on = hot === position.id;
          return (
            <div
              key={position.id}
              className={`ae-align-row${on ? " on" : ""}`}
              data-pos={index + 1}
              onMouseEnter={() => setHot(position.id)}
              onMouseLeave={() => setHot(null)}
              onFocus={() => setHot(position.id)}
              onBlur={() => setHot(null)}
            >
              <div className="ae-align-side express" id={leftId}>
                <b>{index + 1}</b>
                <div>
                  <strong>{position.express.node}</strong>
                  <code>{position.express.source}</code>
                </div>
              </div>

              <div className="ae-align-link" data-from={leftId} data-to={rightId}>
                <span className="ae-align-role">{position.role}</span>
                <i aria-hidden="true" />
                <p className="ae-align-holds">
                  <b>成立</b>
                  {position.holds}
                </p>
                <p className="ae-align-fails">
                  <b>失效</b>
                  {position.fails}
                </p>
              </div>

              <div className="ae-align-side typer" id={rightId}>
                <b>{index + 1}</b>
                <div>
                  <strong>{position.typer.node}</strong>
                  <code>{position.typer.source}</code>
                </div>
              </div>
            </div>
          );
        })}
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

/* ==================================================== B1 双启动线与汇合点 */

// 位置编码：lineOwner="both" 的节点跨两列，独有节点只占一列。
// 这条规则本身就是结论（模块级执行两线共有，差异只在谁调用 app()）。
function EntryVisual({ topic }: { topic: AeEntryTopic }) {
  const [lane, setLane] = useState<"console" | "python-m" | null>(null);
  const beforeJoin = topic.nodes.filter((node) => node.lineOwner !== "after-join");
  const afterJoin = topic.nodes.filter((node) => node.lineOwner === "after-join");

  return (
    <section className="ae-entry" aria-label="Bub 的两条启动路径">
      <div className="ae-entry-lanes">
        {topic.lanes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ae-entry-lane ${item.id}${lane === item.id ? " on" : ""}`}
            aria-pressed={lane === item.id}
            onClick={() => setLane(lane === item.id ? null : item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.trigger}</span>
          </button>
        ))}
      </div>
      <p className="ae-entry-hint">
        选一条线高亮它独有的步骤；跨两列的节点是两线共有，选哪条都保持高亮。
      </p>

      <div className="ae-entry-track">
        {beforeJoin.map((node) => {
          const dim = lane !== null && node.lineOwner !== "both" && node.lineOwner !== lane;
          return (
            <div
              key={node.id}
              className={`ae-entry-node ${node.lineOwner}${node.join ? " join" : ""}${dim ? " dim" : ""}`}
              data-node={node.id}
              data-owner={node.lineOwner}
              data-edge={node.join ? "join" : undefined}
            >
              <div className="ae-entry-node-head">
                <code>
                  {node.module} {node.line}
                </code>
                {node.lineOwner === "both" && !node.join && <em className="ae-tag both">两线共有</em>}
                {node.join && <em className="ae-tag join">汇合点</em>}
                {node.verified === "待运行验证" && <em className="ae-tag pending">待运行验证</em>}
              </div>
              <strong>{node.action}</strong>
              {node.detail && (
                <details>
                  <summary>模块级调用链内部</summary>
                  <p>{node.detail}</p>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="ae-entry-after">
        <span className="ae-entry-after-title">汇合之后（两条线共用）</span>
        <ol>
          {afterJoin.map((node) => (
            <li key={node.id} data-node={node.id}>
              <code>
                {node.module} {node.line}
              </code>
              <strong>{node.action}</strong>
            </li>
          ))}
        </ol>
      </div>

      <div className="ae-entry-timing">
        <b>执行时机（两条线差异的来源）</b>
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
  const scopeFrom = topic.stages.findIndex((stage) => stage.id === topic.finallyScope.from);
  const scopeTo = topic.stages.findIndex((stage) => stage.id === topic.finallyScope.to);

  return (
    <section className="ae-pipe" aria-label="一次 turn 的管线阶段与结束分叉">
      {/* 阶段与罩子共用同一个 grid：列号走 CSS 变量，手机端换成竖排时罩子跟着换到侧边，
          「只罩住 _run_model」这条位置编码在两个断点都成立。 */}
      <div className="ae-pipe-grid" style={{ "--ae-pipe-cols": topic.stages.length } as CSSProperties}>
        <div className="ae-pipe-track">
          {topic.stages.map((stage, index) => (
            <div
              key={stage.id}
              className="ae-pipe-stage"
              data-stage={stage.id}
              style={{ "--ae-i": index + 1 } as CSSProperties}
            >
              <b>{index + 1}</b>
              <strong>{stage.label}</strong>
              <p>{stage.note}</p>
            </div>
          ))}
        </div>

        <div
          className="ae-pipe-scope"
          data-scope-from={topic.finallyScope.from}
          data-scope-to={topic.finallyScope.to}
          style={{ "--ae-scope-from": scopeFrom + 1, "--ae-scope-to": scopeTo + 2 } as CSSProperties}
        >
          <span>finally 的作用域</span>
          <p>{topic.finallyScope.note}</p>
        </div>
      </div>

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
  const phase = frame?.phase ?? "read";
  const order = ["read", "assemble", "model", "execute", "append"];
  const reached = (target: string) => order.indexOf(phase) >= order.indexOf(target);
  const projectionOn = player.index >= 1;
  const appended = phase === "append";

  return (
    <section className="ae-tape" aria-label="tape 追加与 context 重建">
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
          纯文本路径（不含工具执行）
        </button>
      </div>

      <div className="ae-tape-upper">
        <div className={`ae-tape-projection${projectionOn ? " on" : ""}`}>
          <span className="ae-tape-zone-title">tape 投影区（历史部分）</span>
          <ol>
            {topic.readStages.map((stage) => (
              <li key={stage.step} className={stage.selectorMode === "custom" ? "custom" : "default"}>
                <b>{stage.step}</b>
                <div>
                  <strong>{stage.label}</strong>
                  <p>{stage.effect}</p>
                </div>
                <em>{stage.selectorMode === "custom" ? "自定义覆盖" : "默认规则"}</em>
              </li>
            ))}
          </ol>
        </div>

        <div className={`ae-tape-current${reached("assemble") ? " on" : ""}`}>
          <span className="ae-tape-zone-title">本轮输入区（不来自 tape）</span>
          <ul>
            {topic.currentInputs.map((input) => (
              <li key={input.slot} data-slot={input.slot}>
                <strong>{input.label}</strong>
              </li>
            ))}
          </ul>
          <p className="ae-tape-sum">投影区 + 本轮输入区 = 发给模型的完整 messages。</p>
        </div>

        <div className={`ae-tape-model${reached("model") ? " on" : ""}`}>
          <span className="ae-tape-zone-title">模型</span>
          <strong>调模型</strong>
          <p>
            {path === "tool"
              ? "返回工具调用：先执行工具，拿到结果之后才落盘。"
              : "返回纯文本：直接落盘，追加序列里没有工具调用与工具结果。"}
          </p>
        </div>
      </div>

      <div className="ae-tape-ports">
        <div className="ae-tape-port read" data-dir="read">
          <b>读口</b>
          <span>每次模型调用之前，从带子现读一份历史投影</span>
        </div>
      </div>

      <div className="ae-tape-band-wrap">
        <div className="ae-tape-band" role="list" aria-label="tape 条目（append-only）">
          {topic.entries.map((entry) => (
            <div
              key={entry.id}
              role="listitem"
              className={`ae-tape-entry${entry.inMessages ? " kept" : " filtered"}`}
              data-kind={entry.entryKind}
              data-filtered={entry.inMessages ? undefined : "true"}
            >
              <span className="ae-tape-dot" aria-hidden="true" />
              <strong>{entry.entryKind}</strong>
              <p>{entry.payloadBrief}</p>
              <em>{entry.inMessages ? "进模型 messages" : "不进模型 messages"}</em>
            </div>
          ))}
          {appended && (
            <div className="ae-tape-entry appended" data-kind="appended" aria-live="off">
              <span className="ae-tape-dot" aria-hidden="true" />
              <strong>本轮追加</strong>
              <p>
                {path === "tool"
                  ? "system → message → tool_call → tool_result → error → assistant → event(\"run\")"
                  : "system → message → assistant → event(\"run\")（无工具条目）"}
              </p>
              <em>追加在右端，anchor 不变，旧条目不修改</em>
            </div>
          )}
        </div>
        <p className="mobile-scroll-cue">带子较长，可横向滑动查看全部条目。</p>
      </div>

      <div className="ae-tape-ports">
        <div className={`ae-tape-port write${appended ? " on" : ""}`} data-dir="write">
          <b>写口</b>
          <span>模型往返结束后，把这一轮的条目按序追加到带子右端</span>
        </div>
      </div>

      <div className="ae-tape-frames" data-frame={phase} data-frame-index={player.index}>
        <FrameTransport player={player} length={frames.length} label={`一轮读写（${path === "tool" ? "工具路径" : "纯文本路径"}）`} />
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

      <details className="ae-tape-write-order">
        <summary>一轮落盘按什么顺序追加，什么时候触发</summary>
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
  const edge = (from: string, to: string) =>
    topic.edges.find((item) => item.from === from && item.to === to);

  return (
    <section className="ae-machine" aria-label="Agent step 循环的四个控制层次">
      {topic.zones.map((zone) => (
        <div key={zone.id} className={`ae-zone ${zone.id}`} data-layer={zone.layer}>
          <div className="ae-zone-head">
            <b>层 {zone.layer}</b>
            <strong>{zone.title}</strong>
            <p>{zone.note}</p>
          </div>

          {zone.id === "normal" && (
            <div className="ae-flow">
              <MachineNode node={node("run")} />
              <MachineEdge edge={edge("run", "final")} />
              <MachineNode node={node("final")} />
              <div className="ae-branch">
                <div className="ae-branch-col short">
                  <MachineEdge edge={edge("final", "continue")} />
                </div>
                <div className="ae-branch-col">
                  <MachineEdge edge={edge("final", "steering")} />
                  <MachineNode node={node("steering")} />
                  <MachineEdge edge={edge("steering", "continue")} />
                  <MachineEdge edge={edge("steering", "stop")} />
                </div>
              </div>
              <div className="ae-outcomes">
                <MachineNode node={node("continue")} />
                <MachineNode node={node("stop")} />
              </div>
            </div>
          )}

          {zone.id === "recover" && (
            <div className="ae-flow">
              <MachineNode node={node("except")} />
              <div className="ae-branch">
                <div className="ae-branch-col">
                  <MachineEdge edge={edge("except", "handoff")} />
                  <MachineNode node={node("handoff")} />
                  <MachineEdge edge={edge("handoff", "run")} />
                </div>
                <div className="ae-branch-col">
                  <MachineEdge edge={edge("except", "raise")} />
                  <MachineNode node={node("raise")} />
                </div>
              </div>
            </div>
          )}

          {zone.id === "boundary" && (
            <div className="ae-flow">
              <MachineEdge edge={edge("continue", "last-step")} />
              <MachineNode node={node("last-step")} />
              <MachineEdge edge={edge("last-step", "max-steps")} />
              <MachineNode node={node("max-steps")} />
            </div>
          )}
        </div>
      ))}

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
    </section>
  );
}

function MachineNode({ node }: { node: AeMachineTopic["nodes"][number] | undefined }) {
  if (!node) return null;
  return (
    <div className={`ae-node${node.tone ? ` ${node.tone}` : ""}`} data-node={node.id}>
      <strong>{node.label}</strong>
    </div>
  );
}

function MachineEdge({ edge }: { edge: AeMachineTopic["edges"][number] | undefined }) {
  if (!edge) return null;
  return (
    <div
      className={`ae-edge ${edge.kind}${edge.shortCircuit ? " short-circuit" : ""}`}
      data-from={edge.from}
      data-to={edge.to}
      data-kind={edge.kind}
      data-shortcircuit={edge.shortCircuit ? "true" : undefined}
      data-condition={edge.condition}
    >
      <i aria-hidden="true" />
      <span>{edge.condition}</span>
      {edge.shortCircuit && <em className="ae-tag short">短路：不再看插话</em>}
    </div>
  );
}

/* ================================================ B5 职责泳道与 turn ⊃ step */

function RolesVisual({ topic }: { topic: AeRolesTopic }) {
  const lanes: Array<{ id: "model" | "tool" | "harness"; label: string }> = [
    { id: "model", label: "model · 决策" },
    { id: "tool", label: "tool · 执行" },
    { id: "harness", label: "harness · 编排与落盘" },
  ];

  return (
    <section className="ae-roles" aria-label="model / tool / harness 的职责与 turn 包含 step">
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

      <div className="ae-nest">
        <div className="ae-nest-turn" data-level="turn">
          <span className="ae-nest-title">{topic.nesting.turn}</span>
          <div className="ae-nest-step" data-level="step">
            <span className="ae-nest-title">{topic.nesting.step}</span>
            <i aria-hidden="true" className="ae-nest-loop">
              ↻
            </i>
          </div>
          <p className="ae-nest-note">{topic.nesting.note}</p>
        </div>
      </div>

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
