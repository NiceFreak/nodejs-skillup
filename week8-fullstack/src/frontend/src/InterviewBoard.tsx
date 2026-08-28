// 「面试准备」复习板。展示资产（AGENTS.md 白名单）。
//
// 和其它板的分工：W3 / W5 / W6 板讲「技术本身怎么回事」，这块板讲「这些东西在面试里
// 怎么用」——往哪引、哪两句不能说错、哪三组数字能报、被问到什么走哪条路。
// 所有内容来自 interview-prep/ 下的两份问答稿，本组件不新增结论。
//
// 复用 W5 板的外壳（w5-board / w5-stage / w5-conclusion / w5-recall-gate），
// 五种专属可视化用 iv- 前缀。
import { useEffect, useState } from "react";
import type { BoardMode } from "./types";
import {
  INTERVIEW_KNOWLEDGE,
  INTERVIEW_OPEN_ITEMS,
  STEER_LABEL,
  type CoverageKnowledge,
  type EvidenceKnowledge,
  type FollowupKnowledge,
  type InterviewKnowledge,
  type PitfallKnowledge,
  type StrengthKnowledge,
} from "./interviewTopics";

export default function InterviewBoard({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const active = INTERVIEW_KNOWLEDGE.find((item) => item.id === topic) ?? INTERVIEW_KNOWLEDGE[0];
  const personal = mode === "review";
  const [revealedTopic, setRevealedTopic] = useState<string | null>(null);
  const contentVisible = !personal || revealedTopic === active.id;

  return (
    <div className="w5-board">
      <header className="w5-board-head">
        <div>
          <span className="w5-kicker">可视化说明</span>
          <h2>面试准备 · 2026-07-30 v1 快照</h2>
          <p>
            本板冻结问答稿截至 2026-07-30 的 W1–W6 范围，不把后续 W9–W11 成果改写进历史快照。
            它只回答当时往哪引、哪些答法已被证据纠正、哪些材料仍待自测。
          </p>
        </div>
        <span className="w5-verified">7/30 v1 · {INTERVIEW_KNOWLEDGE.length} 个板块 · 37 题</span>
      </header>

      <nav className="w5-knowledge-nav iv-nav" aria-label="面试准备板块">
        {INTERVIEW_KNOWLEDGE.map((item) => (
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
            <h4>先自己答一遍，再看这块板怎么排的</h4>
            <p>{active.question}</p>
            <small>面试稿的用法就是自测：讲不出来的地方，才是要回看的地方。</small>
            <button type="button" onClick={() => setRevealedTopic(active.id)}>展开对照</button>
          </section>
        ) : (
          <div className="w5-stage-body" key={active.id}>
            {active.kind === "strength" ? (
              <StrengthVisual topic={active} />
            ) : active.kind === "pitfall" ? (
              <PitfallVisual topic={active} review={personal} />
            ) : active.kind === "evidence" ? (
              <EvidenceVisual topic={active} />
            ) : active.kind === "followup" ? (
              <FollowupVisual topic={active} />
            ) : (
              <CoverageVisual topic={active} />
            )}

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

      {personal && <OpenItemsPanel />}
    </div>
  );
}

/* ① 强项分层：顺序来自 7/30 v1 自评；不使用无测量口径的百分比。 */
function StrengthVisual({ topic }: { topic: StrengthKnowledge }) {
  const [openTier, setOpenTier] = useState<string | null>(topic.tiers[0].id);

  return (
    <section className="iv-strength" data-anchor="2026-07-30 v1 的 lead、answer、hold 三档分类，不使用百分比">
      <div className="iv-steer-key" aria-label="处理方式图例">
        <span className="lead">主动引</span>
        <span className="answer">被问再答</span>
        <span className="hold">暂时收住</span>
        <small>{topic.rule}</small>
      </div>

      <ol className="iv-tiers">
        {topic.tiers.map((tier, index) => {
          const open = openTier === tier.id;
          return (
            <li key={tier.id} className={`iv-tier ${tier.steer}${open ? " open" : ""}`}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenTier(open ? null : tier.id)}
              >
                <b aria-hidden="true">{index + 1}</b>
                <span className="iv-tier-rank">{tier.rank}</span>
                <strong className="iv-tier-topic">{tier.topic}</strong>
                <em className="iv-tier-week">{tier.week}</em>
                <span className="iv-tier-steer">{STEER_LABEL[tier.steer]}</span>
              </button>
              {open && (
                <div className="iv-tier-detail">
                  <p className="iv-tier-basis">
                    <span>依据</span>
                    {tier.basis}
                  </p>
                  <p className="iv-tier-anchor">
                    <span>话术锚点</span>
                    <q>{tier.anchor}</q>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="iv-strength-note"><b>证据时点：</b>排序只代表 2026-07-30 v1；后续周次未纳入。</p>
    </section>
  );
}

/* ② 两处答错过的题：❌ 旧答法 → ⚡ 漏了哪一层 → ✅ 正确答法。复习态先只给 ❌，让人自己找错。 */
function PitfallVisual({ topic, review }: { topic: PitfallKnowledge; review: boolean }) {
  const [revealed, setRevealed] = useState<string[]>([]);

  useEffect(() => {
    setRevealed(review ? [] : topic.items.map((item) => item.id));
  }, [review, topic]);

  return (
    <section className="iv-pitfalls">
      {topic.items.map((item, index) => {
        const open = revealed.includes(item.id);
        return (
          <article key={item.id} className={`iv-pitfall${open ? " open" : ""}`}>
            <header>
              <b aria-hidden="true">{index + 1}</b>
              <h4>{item.topic}</h4>
              <span className={open ? "fixed" : "pending"}>{open ? "已纠正" : "先找错"}</span>
            </header>

            <div className="iv-pitfall-flip">
              <div className="iv-side wrong">
                <span>❌ 旧答法</span>
                <p>{item.wrong}</p>
              </div>

              <div className="iv-flip-arrow" aria-hidden="true">
                <i>→</i>
              </div>

              {open ? (
                <div className="iv-side right">
                  <span>✅ 正确答法</span>
                  <p>{item.right}</p>
                </div>
              ) : (
                <div className="iv-side masked">
                  <span>✅ 正确答法</span>
                  <p>先自己说出这句话错在哪一步，再展开核对。</p>
                  <button type="button" onClick={() => setRevealed((ids) => [...ids, item.id])}>
                    展开核对
                  </button>
                </div>
              )}
            </div>

            {open && (
              <>
                <p className="iv-pitfall-why">
                  <b>漏了哪一层</b>
                  {item.why}
                </p>
                <p className="iv-pitfall-proof">
                  <b>证据</b>
                  {item.proof}
                </p>
                <p className="iv-pitfall-trace">{item.trace}</p>
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}

/* ③ 三组实验：切换实验 → 指标前后对照 → 能证明 / 不能证明两块必须同时出现。 */
function EvidenceVisual({ topic }: { topic: EvidenceKnowledge }) {
  const [activeSet, setActiveSet] = useState(topic.sets[0].id);
  const set = topic.sets.find((item) => item.id === activeSet) ?? topic.sets[0];
  const hasBase = set.metrics.some((m) => m.base !== undefined);

  return (
    <section className="iv-evidence">
      <div className="iv-set-switch" role="group" aria-label="实验组">
        {topic.sets.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === set.id ? "on" : ""}
            aria-pressed={item.id === set.id}
            onClick={() => setActiveSet(item.id)}
          >
            <span>{item.week}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>

      <p className="iv-variable">
        <b>受控变量</b>
        {set.variable}
      </p>

      <div className={`iv-metrics${hasBase ? " with-base" : ""}`} role="table" aria-label={`${set.title} 指标对照`}>
        <div className="iv-metrics-head" role="row">
          <span role="columnheader">指标</span>
          {hasBase && <span role="columnheader">{set.baseLabel}</span>}
          <span role="columnheader">{set.beforeLabel}</span>
          <span aria-hidden="true" />
          <span role="columnheader">{set.afterLabel}</span>
        </div>
        {set.metrics.map((metric) => (
          <div key={metric.label} className={`iv-metric-row${metric.highlight ? " key" : ""}`} role="row">
            <code role="cell">{metric.label}</code>
            {hasBase && <span className="base" role="cell">{metric.base ?? "—"}</span>}
            <span className="before" role="cell">{metric.before}</span>
            <i aria-hidden="true">→</i>
            <span className="after" role="cell">{metric.after}</span>
          </div>
        ))}
      </div>

      <div className="iv-boundary">
        <article className="proves">
          <span>能证明</span>
          <p>{set.proves}</p>
        </article>
        <article className="limits">
          <span>不能证明 / 不能外推</span>
          <p>{set.limits}</p>
        </article>
      </div>
    </section>
  );
}

/* ④ 追问分类：三档是静态目的地，不伪装成随时间推进的流程。 */
function FollowupVisual({ topic }: { topic: FollowupKnowledge }) {
  const [focusId, setFocusId] = useState(topic.entries[0].id);
  const focus = topic.entries.find((entry) => entry.id === focusId) ?? topic.entries[0];
  const routes = ["lead", "answer", "hold"] as const;

  return (
    <section className="iv-followup" data-anchor="十个入口问题静态落入 lead、answer、hold 三个目的地">
      <div className="iv-route-map" aria-label="追问入口的三档分类">
        {routes.map((route) => {
          const entries = topic.entries.filter((entry) => entry.route === route);
          return (
            <section key={route} className={`iv-route-column ${route}`}>
              <header>
                <strong>{STEER_LABEL[route]}</strong>
                <span>{entries.length} 个入口</span>
              </header>
              <div>
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={entry.id === focus.id ? "on" : ""}
                    aria-pressed={entry.id === focus.id}
                    onClick={() => setFocusId(entry.id)}
                  >
                    <span>{entry.ask}</span>
                    <small>{entry.target}</small>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className={`iv-focus-card ${focus.route}`}>
        <header>
          <span>{STEER_LABEL[focus.route]}</span>
          <h4>{focus.ask}</h4>
        </header>
        <p className="iv-focus-line">
          <b>一句话锚点</b>
          <q>{focus.line}</q>
        </p>
        <p className="iv-focus-trap">
          <b>别掉进去</b>
          {focus.trap}
        </p>
      </div>

      <p className="iv-route-result">「{focus.ask}」→ {STEER_LABEL[focus.route]} → {focus.target}</p>
    </section>
  );
}

/* ⑤ 覆盖矩阵：每周映射到问答稿的一节，状态用同一套三档色；下面挂唯一的下一步动作。 */
function CoverageVisual({ topic }: { topic: CoverageKnowledge }) {
  const total = topic.rows.reduce((sum, row) => sum + row.count, 0);
  const ready = topic.rows.filter((row) => row.state === "lead").reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="iv-coverage">
      <div className="iv-coverage-summary">
        <div className="iv-cov-stat">
          <strong>{total}</strong>
          <span>总题数</span>
        </div>
        <div className="iv-cov-stat good">
          <strong>{ready}</strong>
          <span>可主动引</span>
        </div>
        <div className="iv-cov-bar" aria-hidden="true">
          {topic.rows.map((row) => (
            <i
              key={row.id}
              className={row.state}
              style={{ flexGrow: row.count }}
              title={`${row.theme} · ${row.count} 题`}
            />
          ))}
        </div>
      </div>

      <div className="iv-matrix" role="table" aria-label="学习周与面试稿章节映射">
        <div className="iv-matrix-head" role="row">
          <span role="columnheader">周</span>
          <span role="columnheader">主题</span>
          <span role="columnheader">问答稿</span>
          <span role="columnheader">题数</span>
          <span role="columnheader">状态</span>
        </div>
        {topic.rows.map((row) => (
          <div key={row.id} className={`iv-matrix-row ${row.state}`} role="row">
            <span className="iv-cell-week" role="cell">{row.week}</span>
            <span className="iv-cell-theme" role="cell">
              <strong>{row.theme}</strong>
              <small>{row.note}</small>
            </span>
            <span className="iv-cell-section" role="cell">{row.section}</span>
            <span className="iv-cell-count" role="cell">{row.count}</span>
            <span className="iv-cell-state" role="cell">{STEER_LABEL[row.state]}</span>
          </div>
        ))}
      </div>

      <aside className="iv-next">
        <span>唯一挡路的一步</span>
        <h4>{topic.next.title}</h4>
        <dl>
          <div>
            <dt>成本</dt>
            <dd>{topic.next.cost}</dd>
          </div>
          <div>
            <dt>做完之后</dt>
            <dd>{topic.next.effect}</dd>
          </div>
          <div>
            <dt>在哪</dt>
            <dd>{topic.next.where}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}

function Conclusion({ topic }: { topic: InterviewKnowledge }) {
  return (
    <footer className="w5-conclusion">
      <div className="w5-judgment">
        <span>核心判断</span>
        <strong>{topic.judgment}</strong>
      </div>
      <div className="w5-business-map">
        <span>面试里怎么用</span>
        <p>{topic.mapping}</p>
      </div>
      <details className="w5-evidence">
        <summary>查看依据与出处</summary>
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
    <section className="w5-judgment-table w3-open" aria-label="问答稿还欠什么">
      <div className="w5-jt-head">
        <span className="w5-kicker">材料缺口清单</span>
        <h3>问答稿还欠什么</h3>
        <p>
          这里记的是「面试材料本身的缺口」，不是学习债务（学习债务只以 DEBT.md 为准，①–⑧ 已全部还清）。
          逐项标注 2026-07-30 v1 的状态与当时下一步，避免与后续周次成果混读。
        </p>
      </div>
      <div className="w3-open-grid">
        {INTERVIEW_OPEN_ITEMS.map((item) => (
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
  );
}
