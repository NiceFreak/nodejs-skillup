// W3「MongoDB 聚合与查询优化」复习板。展示资产（AGENTS.md 白名单）。
// 只呈现已验收结论；仍未澄清 / 未验证的部分进「未验证与待澄清项」面板，如实标注。
// 复用 W5 板的外壳样式（w5-board / w5-stage / w5-conclusion / w5-jt-*），
// 仅 explain 对照、分层、月边界时间线用 w3- 专属样式。
import { useEffect, useState } from "react";
import { MetricBar, metricRowScale } from "./charts";
import { FrameNarration, FrameTransport, useFramePlayer } from "./framePlayer";
import type { BoardMode } from "./types";
import {
  W3_KNOWLEDGE,
  W3_OPEN_ITEMS,
  W3_SELF_NOTE,
  type AggregationPipelineKnowledge,
  type CoveredKnowledge,
  type DocShape,
  type ExplainKnowledge,
  type LayeringKnowledge,
  type ModelingKnowledge,
  type MonthKnowledge,
  type PrefixKnowledge,
  type W3Knowledge,
} from "./w3Topics";

// mode 只决定是否展开个人学习记录（开放问题 + 自我观察）；
// 它区分内部 demo 与个人复习内容，不承担访问控制。
// 当前专题由 URL（App → Showcase）提供，支持刷新保留与直接链接到某个知识点。
export default function W3Board({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const active = W3_KNOWLEDGE.find((item) => item.id === topic) ?? W3_KNOWLEDGE[0];
  const personal = mode === "review";
  const [revealedTopic, setRevealedTopic] = useState<string | null>(null);
  const contentVisible = !personal || revealedTopic === active.id;

  return (
    <div className="w5-board">
      <header className="w5-board-head">
        <div>
          <span className="w5-kicker">可视化说明</span>
          <h2>MongoDB 建模、聚合与查询优化</h2>
          <p>八个知识点分三段递进：先把数据存对——嵌入、引用与快照按四个维度取舍；再把聚合写对——分层归位、追踪 pipeline 形状、切对自然月边界；最后把查询调快——explain 三数、最左前缀、覆盖查询与 $lookup 外键索引。</p>
        </div>
        <span className="w5-verified">{W3_KNOWLEDGE.length} 个知识点</span>
      </header>

      <nav className="w5-knowledge-nav" aria-label="W3 知识点">
        {W3_KNOWLEDGE.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === active.id ? "on" : ""}
            onClick={() => onTopicChange(item.id)}
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

        {!contentVisible ? (
          <section className="w5-recall-gate">
            <span>主动回忆</span>
            <h4>先预测职责、下一阶段形状或证据边界</h4>
            <p>{active.question}</p>
            <small>至少说明：当前输入、关键变化，以及一个不能由现有证据推出的结论。</small>
            <button type="button" onClick={() => setRevealedTopic(active.id)}>开始逐步核对</button>
          </section>
        ) : (
          <div className="w5-stage-body" key={active.id}>
            {active.kind === "explain" ? (
              <ExplainVisual topic={active} />
            ) : active.kind === "layering" ? (
              <LayeringVisual topic={active} />
            ) : active.kind === "pipeline" ? (
              <PipelineShapeVisual topic={active} review={personal} />
            ) : active.kind === "modeling" ? (
              <ModelingVisual topic={active} />
            ) : active.kind === "prefix" ? (
              <PrefixVisual topic={active} />
            ) : active.kind === "covered" ? (
              <CoveredVisual topic={active} />
            ) : (
              <MonthVisual topic={active} />
            )}

            {/* 口径提示在展示 / 复习状态都显示，避免 demo 只呈现过度确定的结论。 */}
            {active.reviewNote && (
              <p className="w3-review-note" role="note">
                <b>结论口径</b>
                {active.reviewNote}
              </p>
            )}

            <Conclusion topic={active} />
          </div>
        )}
      </article>

      {/* 个人学习记录（开放问题 + 自我观察）只在复习状态展开 */}
      {personal && <OpenItemsPanel />}
    </div>
  );
}

function DocCard({ shape, label }: { shape: DocShape; label: string }) {
  // 字段芯片按状态编码：新增加粗描边、消失的划掉、改形的标出来源。
  // 「一条文档代表什么」单独一行——多重性变化（每单一条 → 每人一条）和字段变化一样是结论。
  return (
    <div className="w3-doccard">
      <span className="w3-doccard-label">{label}</span>
      <div className="w3-doccard-fields">
        <i aria-hidden="true">{"{"}</i>
        {shape.fields.map((f) => (
          <span key={f.name} className={`w3-chip ${f.state}`} title={f.from}>
            {f.name}
            {f.from && <em>{f.from}</em>}
          </span>
        ))}
        <i aria-hidden="true">{"}"}</i>
      </div>
      <p className="w3-doccard-mult">{shape.multiplicity}</p>
    </div>
  );
}

function PipelineShapeVisual({ topic, review }: { topic: AggregationPipelineKnowledge; review: boolean }) {
  // 展示态：逐帧沿管道走，每帧重画一次当前文档的字段形状。
  // 复习态：仍由「显示下一阶段」按钮控制节奏，播放器不介入。
  const player = useFramePlayer(topic.stages.length, { interval: 2400, autoPlay: false });
  const [visibleCount, setVisibleCount] = useState(review ? 1 : topic.stages.length);

  useEffect(() => {
    setVisibleCount(review ? 1 : topic.stages.length);
    player.seek(0);
    // player 引用每帧都会变；这里只关心 review / topic 切换。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, topic]);

  const canReveal = visibleCount < topic.stages.length;
  const next = topic.stages[visibleCount];
  const focus = review ? visibleCount - 1 : player.index;
  const index = Math.max(0, Math.min(focus, topic.stages.length - 1));
  const focusStage = topic.stages[index];
  const prevShape = index === 0 ? topic.origin : topic.stages[index - 1].docShape;

  return (
    <section className="w3-pipeline-shape">
      {!review && (
        <div className="w3-pipeline-transport">
          <span className="w3-pipeline-transport-label">
            阶段 {player.index + 1} · <code>{focusStage.operator}</code>
          </span>
          <FrameTransport player={player} length={topic.stages.length} />
        </div>
      )}

      {/* 管道轨道：走到哪一段一眼可见，点击任意一段跳过去。 */}
      <ol className="w3-pipe-track" aria-label="customer spending 聚合管道的六个阶段">
        {topic.stages.map((stage, i) => (
          <li key={stage.operator} className={i < visibleCount ? (i === index ? "on" : "done") : "masked"}>
            <button
              type="button"
              onClick={() => (review ? setVisibleCount(i + 1) : player.seek(i))}
              disabled={review && i >= visibleCount}
            >
              <code>{i < visibleCount ? stage.operator : "?"}</code>
              <small>{i < visibleCount ? stage.purpose : "先预测下一阶段"}</small>
            </button>
          </li>
        ))}
      </ol>

      {/* 这一阶段前后的文档形状并排：字段是新增、保留还是消失，由芯片本身给出。 */}
      <div className="w3-shape-diff">
        <DocCard shape={prevShape} label={index === 0 ? "进入管道前" : `${topic.stages[index - 1].operator} 之后`} />
        <div className="w3-shape-op" aria-hidden="true">
          <code>{focusStage.operator}</code>
          <i>→</i>
        </div>
        <DocCard shape={focusStage.docShape} label={`${focusStage.operator} 之后`} />
      </div>

      <FrameNarration
        step={index + 1}
        text={
          <>
            <code>{focusStage.operator}</code> · {focusStage.purpose}：{focusStage.keeps}
          </>
        }
      />

      {review && canReveal && (
        <div className="w3-pipeline-prompt">
          <span>下一步预测</span>
          <strong>当前形状之后，哪个 stage 应接手？它会保留或生成哪些字段？</strong>
          <button type="button" onClick={() => setVisibleCount((count) => Math.min(topic.stages.length, count + 1))}>
            显示第 {visibleCount + 1} 步{next ? ` · ${next.operator}` : ""}
          </button>
        </div>
      )}

      <details className="w3-pipeline-detail board-fold">
        <summary>
          <span className="board-fold-kicker">逐阶段明细</span>
          <strong>六个 stage 各自的输入、输出与字段依赖</strong>
        </summary>
        <div className="w3-pipe-rows">
          {topic.stages.map((stage, i) => (
            <article key={stage.operator} className={i === index ? "on" : ""}>
              <code>{stage.operator}</code>
              <div>
                <p><b>输入</b>{stage.input}</p>
                <p><b>输出</b>{stage.output}</p>
                <p className="keeps">{stage.keeps}</p>
              </div>
            </article>
          ))}
        </div>
      </details>

      <div className="w3-proof-boundary">
        <article className="observed"><span>观察结果</span><p>{topic.observation}</p></article>
        <article className="proves"><span>能证明</span><p>{topic.proves}</p></article>
        <article className="limits"><span>没有证明</span><p>{topic.limits}</p></article>
      </div>
    </section>
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
        {topic.metrics.map((m) => {
          // 差距是结论的那几行补长度编码；类别型的格子（[] → ["name_1"]）不画。
          const scale = metricRowScale([m.before, m.after]);
          const bv = scale?.valueOf(m.before) ?? null;
          const av = scale?.valueOf(m.after) ?? null;
          return (
            <div key={m.label} className={`w3-metric-row${m.highlight ? " key" : ""}`} role="row">
              <code role="cell">{m.label}</code>
              <span className="before" role="cell">
                {m.before}
                {scale && bv !== null && <MetricBar value={bv} max={scale.max} tone="before" />}
              </span>
              <i aria-hidden="true">→</i>
              <span className="after" role="cell">
                {m.after}
                {scale && av !== null && <MetricBar value={av} max={scale.max} tone="after" />}
              </span>
            </div>
          );
        })}
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

function ModelingVisual({ topic }: { topic: ModelingKnowledge }) {
  return (
    <section className="w3-modeling">
      <div className="w3-modeling-options">
        {topic.options.map((opt) => (
          <article key={opt.name}>
            <strong>{opt.name}</strong>
            <p>{opt.how}</p>
            <em>{opt.fit}</em>
          </article>
        ))}
      </div>

      <div className="w3-modeling-dims" role="table" aria-label="四个建模判断维度">
        <div className="w3-modeling-dims-head" role="row">
          <span role="columnheader">维度</span>
          <span role="columnheader">要问的问题</span>
          <span role="columnheader">答案倾向的手段</span>
        </div>
        {topic.dimensions.map((d) => (
          <div key={d.name} className="w3-modeling-dim" role="row">
            <strong role="rowheader">{d.name}</strong>
            <p role="cell">{d.ask}</p>
            <p className="leans" role="cell">{d.leansTo}</p>
          </div>
        ))}
      </div>

      <div className="w3-modeling-decisions" aria-label="订单系统的四个建模决策">
        {topic.decisions.map((dec) => (
          <article key={dec.relation}>
            <header>
              <strong>{dec.relation}</strong>
              <em>{dec.choice}</em>
            </header>
            <p>{dec.why}</p>
            <ul>
              {dec.dims.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="w3-pitfall">
        <b>容易做错的一处</b>
        {topic.counterExample}
      </p>
    </section>
  );
}

function PrefixVisual({ topic }: { topic: PrefixKnowledge }) {
  // 三条查询的扫描量差两个数量级，长度编码按最大值取比例，读者不必在脑子里比数字。
  const max = Math.max(...topic.queries.map((q) => q.docsExamined));
  return (
    <section className="w3-prefix">
      <p className="w3-prefix-setup">
        <b>{topic.createIndex}</b>
        {topic.dataset}
      </p>

      <div className="w3-prefix-table" role="table" aria-label="三条查询各自命中的索引与扫描量">
        <div className="w3-prefix-head" role="row">
          <span role="columnheader">查询</span>
          <span role="columnheader">命中索引</span>
          <span role="columnheader">indexBounds</span>
          <span role="columnheader">totalDocsExamined</span>
        </div>
        {topic.queries.map((q) => (
          <div key={q.tag} className={`w3-prefix-row ${q.usable}`} role="row">
            <code role="rowheader">
              <b>{q.tag}</b>
              {q.query}
            </code>
            <span className="hit" role="cell">{q.hitIndex}</span>
            <span className="bounds" role="cell">{q.bounds}</span>
            <span className="scan" role="cell">
              <i style={{ inlineSize: `${Math.max(2, (q.docsExamined / max) * 100)}%` }} aria-hidden="true" />
              <em>{q.docsExamined.toLocaleString("en-US")}</em>
              <small>返回 {q.nReturned.toLocaleString("en-US")}</small>
            </span>
          </div>
        ))}
      </div>

      <div className="w3-prefix-control">
        <span>对照实验</span>
        <p>
          <b>操作</b>
          {topic.control.action}
        </p>
        <p>
          <b>结果</b>
          {topic.control.result}
        </p>
        <p className="w3-prefix-control-conclusion">{topic.control.conclusion}</p>
      </div>

      <p className="w3-keypoint">{topic.rule}</p>
      <p className="w3-prefix-ordering">
        <b>字段顺序</b>
        {topic.ordering}
      </p>
    </section>
  );
}

function CoveredVisual({ topic }: { topic: CoveredKnowledge }) {
  return (
    <section className="w3-covered">
      <p className="w3-prefix-setup">
        <b>{topic.query}</b>
        {topic.dataset}
      </p>

      <div className="w3-covered-pair">
        <article className="covered">
          <span>投影排除 _id</span>
          <ol className="w3-covered-plan">
            {topic.plan.map((stage) => (
              <li key={stage}>
                <code>{stage}</code>
              </li>
            ))}
          </ol>
          <div className="w3-covered-metrics">
            {topic.metrics.map((m) => (
              <p key={m.label} className={m.highlight ? "key" : ""}>
                <code>{m.label}</code>
                <strong>{m.value}</strong>
              </p>
            ))}
          </div>
        </article>

        <article className="fetched">
          <span>{topic.reverse.action}</span>
          <ol className="w3-covered-plan">
            {topic.reverse.plan.map((stage) => (
              <li key={stage}>
                <code>{stage}</code>
              </li>
            ))}
          </ol>
          <div className="w3-covered-metrics">
            <p className="key">
              <code>totalDocsExamined</code>
              <strong>{topic.reverse.metric}</strong>
            </p>
          </div>
          <p className="w3-covered-reason">{topic.reverse.reason}</p>
        </article>
      </div>

      <div className="w3-covered-conditions">
        <span>触发条件（三条同时满足）</span>
        <ol>
          {topic.conditions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </div>
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

      <section className="w5-judgment-table w3-open" aria-label="未验证与待澄清项">
        <div className="w5-jt-head">
          <span className="w5-kicker">开放问题清单</span>
          <h3>未验证与待澄清项：各自的状态与下一步</h3>
          <p>与已验收结论分开列出，每项标注当前状态与下一步，避免未验证项被读成已掌握。</p>
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
