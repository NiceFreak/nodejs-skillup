// W2「Express 服务端架构」复习板。展示资产（AGENTS.md 白名单）。
//
// 这块板补的是展板此前从 W3 起步留下的缺口。事实以 week2-express/src 当前代码为准，
// 笔记提供推理与踩坑来源；两者不一致时按代码写，并在证据里点出差异。
//
// 复用 W5 板的外壳类（w5-board / w5-knowledge-nav / w5-stage / w5-recall-gate /
// w5-conclusion）与 framePlayer 时间轴，本板专属可视化用 arch- 前缀。
import { useEffect, useState } from "react";
import { FrameNarration, FrameTransport, useFramePlayer, dwellByText } from "./framePlayer";
import type { BoardMode } from "./types";
import {
  CORRECTION_KIND_LABEL,
  W2_KNOWLEDGE,
  W2_OPEN_ITEMS,
  type ChainKnowledge,
  type ErrorMapKnowledge,
  type ExitsKnowledge,
  type LayersKnowledge,
  type OnionKnowledge,
  type RulerKnowledge,
  type W2Knowledge,
} from "./w2Topics";

// mode 只决定是否展开个人学习记录（开放问题清单）；当前专题由 URL 提供，
// 支持刷新保留与直接链接到某个知识点。
export default function W2Board({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const active = W2_KNOWLEDGE.find((item) => item.id === topic) ?? W2_KNOWLEDGE[0];
  const personal = mode === "review";
  const [revealedTopic, setRevealedTopic] = useState<string | null>(null);
  const contentVisible = !personal || revealedTopic === active.id;

  return (
    <div className="w5-board arch-board">
      <header className="w5-board-head">
        <div>
          <span className="w5-kicker">可视化说明</span>
          <h2>Express 服务端架构</h2>
          <p>
            六个知识点按请求的走向排列：先看一次请求横向穿过哪些中间件，再看代码纵向分成哪四层，
            然后合起来走一条真实请求，看每层交出什么形状；接着分出正常与错误两个响应出口，
            最后给出决定一段逻辑该放哪一层的判据。
          </p>
        </div>
        <span className="w5-verified">{W2_KNOWLEDGE.length} 个知识点</span>
      </header>

      <nav className="w5-knowledge-nav" aria-label="W2 知识点">
        {W2_KNOWLEDGE.map((item) => (
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
            <h4>先说出这一页的判断，再展开核对</h4>
            <p>{active.question}</p>
            <small>至少说明：涉及哪一层、依据是什么，以及一个现有证据支持不了的结论。</small>
            <button type="button" onClick={() => setRevealedTopic(active.id)}>展开核对</button>
          </section>
        ) : (
          <div className="w5-stage-body" key={active.id}>
            {active.kind === "onion" ? (
              <OnionVisual topic={active} />
            ) : active.kind === "layers" ? (
              <LayersVisual topic={active} />
            ) : active.kind === "chain" ? (
              <ChainVisual topic={active} review={personal} />
            ) : active.kind === "exits" ? (
              <ExitsVisual topic={active} review={personal} />
            ) : active.kind === "errormap" ? (
              <ErrorMapVisual topic={active} />
            ) : (
              <RulerVisual topic={active} review={personal} />
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

/* ① 中间件管道：用时间轴逐帧走完进入与离开，缩进表示调用栈深度。 */
function OnionVisual({ topic }: { topic: OnionKnowledge }) {
  const player = useFramePlayer(topic.frames.length, {
    intervalAt: (i) => dwellByText(topic.frames[i]?.note ?? ""),
    autoPlay: false,
  });
  const frame = topic.frames[player.index];

  return (
    <section className="arch-onion">
      <div className="arch-onion-transport">
        <span className="arch-onion-transport-label">
          第 {player.index + 1} 行输出 · <code>{frame.line}</code>
        </span>
        <FrameTransport player={player} length={topic.frames.length} />
      </div>

      <ol className="arch-onion-stack" aria-label="中间件进入与离开的输出顺序">
        {topic.frames.map((f, index) => {
          const reached = index <= player.index;
          return (
            <li
              key={`${f.actor}-${f.phase}`}
              className={`${f.phase}${reached ? " reached" : ""}${index === player.index ? " focus" : ""}`}
              style={{ marginInlineStart: `${f.depth * 22}px` }}
            >
              <b aria-hidden="true">{index + 1}</b>
              <code>{f.line}</code>
              <span>{f.phase === "enter" ? "调用 next() 前" : "next() 返回后"}</span>
            </li>
          );
        })}
      </ol>

      <FrameNarration step={player.index + 1} text={frame.note} />

      <div className="arch-onion-rule">
        <strong>{topic.rule.title}</strong>
        <p>{topic.rule.body}</p>
        <div className="arch-onion-rule-fail">
          <article className="failure">
            <span>两件都做</span>
            <p>{topic.rule.both}</p>
          </article>
          <article className="unknown">
            <span>两件都不做</span>
            <p>{topic.rule.neither}</p>
          </article>
        </div>
      </div>

      <div className="arch-timing">
        <p className="arch-timing-q">{topic.timing.question}</p>
        <div className="arch-timing-pair" role="table" aria-label="两个计时结束点的实测差别">
          <div className="arch-timing-col failure" role="row">
            <span role="rowheader">{topic.timing.wrong.where}</span>
            <strong role="cell">{topic.timing.wrong.measured}</strong>
            <p role="cell">{topic.timing.wrong.why}</p>
          </div>
          <div className="arch-timing-col success" role="row">
            <span role="rowheader">{topic.timing.right.where}</span>
            <strong role="cell">{topic.timing.right.measured}</strong>
            <p role="cell">{topic.timing.right.why}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ② 四层职责：碰什么 / 不碰什么并列，下面接依赖方向与洋葱模型的区分。 */
function LayersVisual({ topic }: { topic: LayersKnowledge }) {
  return (
    <section className="arch-layers">
      <div className="arch-lane-stack" role="table" aria-label="四层职责与边界">
        <div className="arch-lane-head" role="row">
          <span role="columnheader">层</span>
          <span role="columnheader">职责</span>
          <span role="columnheader">碰什么</span>
          <span role="columnheader">不碰什么</span>
        </div>
        {topic.lanes.map((lane, index) => (
          <div key={lane.name} className="arch-lane" role="row">
            <div className="arch-lane-name" role="rowheader">
              <b aria-hidden="true">{index + 1}</b>
              <code>{lane.name}</code>
              <small>{lane.file}</small>
            </div>
            <p role="cell">{lane.role}</p>
            <p className="touches" role="cell">{lane.touches}</p>
            <p className="avoids" role="cell">{lane.avoids}</p>
          </div>
        ))}
      </div>

      <p className="arch-ruler-line">
        <b>越界判据</b>
        {topic.ruler}
      </p>
      <p className="arch-direction">
        <b>依赖方向</b>
        {topic.direction}
      </p>

      <div className="arch-contrast" role="table" aria-label="中间件管道与分层单向的区分">
        <div className="arch-contrast-head" role="row">
          <span role="columnheader">对象</span>
          <span role="columnheader">描述的是什么</span>
          <span role="columnheader">方向</span>
          <span role="columnheader">成立范围</span>
        </div>
        {topic.contrast.map((row) => (
          <div key={row.subject} className="arch-contrast-row" role="row">
            <strong role="rowheader">{row.subject}</strong>
            <p role="cell">{row.describes}</p>
            <p role="cell">{row.axis}</p>
            <p role="cell">{row.scope}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ③ 一条请求穿四层：展示态由时间轴带着走，复习态逐步显示下一层。 */
function ChainVisual({ topic, review }: { topic: ChainKnowledge; review: boolean }) {
  const player = useFramePlayer(topic.steps.length, { interval: 2100, autoPlay: false });
  const [visibleCount, setVisibleCount] = useState(review ? 1 : topic.steps.length);

  useEffect(() => {
    setVisibleCount(review ? 1 : topic.steps.length);
    player.seek(0);
    // player 引用每帧都会变；这里只关心 review / topic 切换。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, topic]);

  const canReveal = visibleCount < topic.steps.length;
  const next = topic.steps[visibleCount];
  const focus = review ? visibleCount - 1 : player.index;
  const focusStep = topic.steps[Math.max(0, Math.min(focus, topic.steps.length - 1))];

  return (
    <section className="arch-chain">
      <p className="arch-chain-request">
        <span>请求</span>
        <code>{topic.request}</code>
      </p>

      {!review && (
        <div className="arch-chain-transport">
          <span className="arch-chain-transport-label">
            第 {player.index + 1} 层 · {focusStep.layer}
          </span>
          <FrameTransport player={player} length={topic.steps.length} />
        </div>
      )}

      <div className="arch-chain-strip" aria-label="GET /users/:id 逐层的输入与输出">
        {topic.steps.map((step, index) => {
          const visible = index < visibleCount;
          const isFocus = visible && index === focus;
          return (
            <article
              key={step.layer}
              className={`${visible ? "visible" : "masked"}${isFocus ? " focus" : ""}`}
            >
              <b>{index + 1}</b>
              <code>{visible ? step.layer : "?"}</code>
              <small>{visible ? step.file : "先说出下一层是谁"}</small>
              {visible && (
                <div>
                  <span>收到</span>
                  <p>{step.input}</p>
                  <i aria-hidden="true">↓</i>
                  <span>交出</span>
                  <strong>{step.output}</strong>
                  <em>不碰：{step.avoids}</em>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="mobile-scroll-cue pipeline-cue" aria-hidden="true">
        {topic.steps.map((step, index) => (
          <span key={step.layer} className={index < visibleCount ? "visible" : "masked"}>
            {index + 1}
            <small>{index < visibleCount ? step.layer : "?"}</small>
          </span>
        ))}
      </div>

      {visibleCount > 0 && (
        <FrameNarration
          step={focus + 1}
          text={
            <>
              {focusStep.layer}（<code>{focusStep.file}</code>）：收到 {focusStep.input} → 交出{" "}
              {focusStep.output}
            </>
          }
        />
      )}

      {review && canReveal && (
        <div className="arch-chain-prompt">
          <span>下一层</span>
          <strong>当前这层交出的形状，由谁接手？它必须交给再下一层什么？</strong>
          <button
            type="button"
            onClick={() => setVisibleCount((count) => Math.min(topic.steps.length, count + 1))}
          >
            显示第 {visibleCount + 1} 层{next ? ` · ${next.layer}` : ""}
          </button>
        </div>
      )}

      <div className="arch-outcomes" aria-label="同一条链的三种结局">
        <span className="arch-outcomes-label">同一条链的三种结局，各自停在哪一层</span>
        {topic.outcomes.map((o) => (
          <div key={o.path} className={`arch-outcome ${o.tone}`}>
            <strong>{o.path}</strong>
            <i aria-hidden="true">→</i>
            <span>{o.stop}</span>
            <em>{o.status}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ④ 两条互斥路径：并排给触发方式与经过的位置，复习态先只给初始说法。 */
function ExitsVisual({ topic, review }: { topic: ExitsKnowledge; review: boolean }) {
  const [openCorrection, setOpenCorrection] = useState(!review);

  useEffect(() => {
    setOpenCorrection(!review);
  }, [review]);

  return (
    <section className="arch-exits">
      <div className="arch-exit-pair">
        {topic.paths.map((path) => (
          <article key={path.id} className={`arch-exit ${path.tone}`}>
            <header>
              <strong>{path.name}</strong>
              <em>{path.status}</em>
            </header>
            <p className="arch-exit-trigger">
              <b>触发</b>
              {path.trigger}
            </p>
            <p className="arch-exit-actor">
              <b>调用 res 的是</b>
              {path.actor}
            </p>
            <ol className="arch-exit-hops">
              {path.hops.map((hop) => (
                <li key={hop}>{hop}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>

      <p className="arch-exclusive">
        <b>互斥关系</b>
        {topic.exclusive}
      </p>

      <div className={`arch-correction${openCorrection ? " open" : ""}`}>
        <p className="arch-correction-initial">
          <span>原判断</span>
          {topic.correction.initial}
        </p>
        {openCorrection ? (
          <>
            <p className="arch-correction-problem">
              <span>偏差</span>
              {topic.correction.problem}
            </p>
            <p className="arch-correction-final">
              <span>修正后</span>
              {topic.correction.final}
            </p>
          </>
        ) : (
          <button type="button" onClick={() => setOpenCorrection(true)}>
            这句话哪里不对？核对修正后的版本
          </button>
        )}
      </div>
    </section>
  );
}

/* ⑤ 错误翻译落层矩阵 + 两层防线。 */
function ErrorMapVisual({ topic }: { topic: ErrorMapKnowledge }) {
  return (
    <section className="arch-errormap">
      <div className="arch-errormap-table" role="table" aria-label="原始错误到状态码的翻译路径">
        <div className="arch-errormap-head" role="row">
          <span role="columnheader">原始错误</span>
          <span role="columnheader">产生位置</span>
          <span role="columnheader">翻译点</span>
          <span role="columnheader">领域错误</span>
          <span role="columnheader">状态码</span>
        </div>
        {topic.rows.map((row) => (
          <div key={row.raw} className={`arch-errormap-row ${row.tone}`} role="row">
            <p className="raw" role="rowheader">{row.raw}</p>
            <p role="cell">{row.origin}</p>
            <p className="at" role="cell">{row.translatedAt}</p>
            <p className="domain" role="cell">{row.domainError}</p>
            <strong role="cell">{row.status}</strong>
          </div>
        ))}
      </div>

      <div className="arch-defense">
        <strong>{topic.defense.title}</strong>
        <div className="arch-defense-pair">
          {topic.defense.layers.map((layer) => (
            <article key={layer.name}>
              <h4>{layer.name}</h4>
              <p>
                <b>声明处</b>
                {layer.declares}
              </p>
              <p>
                <b>检查时机</b>
                {layer.whenChecked}
              </p>
              <p className="throws">
                <b>报错形态</b>
                {layer.throws}
              </p>
            </article>
          ))}
        </div>
        <p className="arch-defense-consequence">{topic.defense.consequence}</p>
      </div>

      <p className="arch-registration">
        <b>新增错误类的两步</b>
        {topic.registration}
      </p>
    </section>
  );
}

/* ⑥ 归属判断标尺 + 三条纠错。 */
function RulerVisual({ topic, review }: { topic: RulerKnowledge; review: boolean }) {
  const [openIds, setOpenIds] = useState<string[]>(() =>
    review ? [] : topic.corrections.map((c) => c.id),
  );

  useEffect(() => {
    setOpenIds(review ? [] : topic.corrections.map((c) => c.id));
  }, [review, topic]);

  return (
    <section className="arch-ruler">
      <p className="arch-ruler-statement">{topic.ruler}</p>
      <p className="arch-ruler-cross">
        <b>配套检验</b>
        {topic.crossTest}
      </p>

      <div className="arch-case-grid" role="table" aria-label="四段逻辑各自的归属判断">
        <div className="arch-case-head" role="row">
          <span role="columnheader">这段逻辑</span>
          <span role="columnheader">描述的是</span>
          <span role="columnheader">归属</span>
          <span role="columnheader">依据</span>
        </div>
        {topic.cases.map((item) => (
          <div key={item.subject} className={`arch-case ${item.describes}`} role="row">
            <strong role="rowheader">{item.subject}</strong>
            <span className="arch-case-kind" role="cell">
              {item.describes === "http" ? "HTTP 请求形态" : "业务规则"}
            </span>
            <code role="cell">{item.home}</code>
            <p role="cell">{item.reason}</p>
          </div>
        ))}
      </div>

      <div className="arch-corrections">
        <span className="w5-kicker">corrections</span>
        <h4>三条被推翻的做法，以及推翻它们的理由</h4>
        <ol>
          {topic.corrections.map((item, index) => {
            const open = openIds.includes(item.id);
            return (
              <li key={item.id} className={`arch-correction-item${open ? " open" : ""}`}>
                <b aria-hidden="true">{index + 1}</b>
                <div>
                  <p className="arch-correction-initial">
                    <span>原做法</span>
                    {item.initial}
                  </p>
                  {open ? (
                    <>
                      <p className="arch-correction-problem">
                        <span>{CORRECTION_KIND_LABEL[item.kind] ?? "问题"}</span>
                        {item.problem}
                      </p>
                      <p className="arch-correction-final">
                        <span>改成</span>
                        {item.final}
                      </p>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenIds((ids) => [...ids, item.id])}
                    >
                      核对这条
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Conclusion({ topic }: { topic: W2Knowledge }) {
  return (
    <footer className="w5-conclusion">
      <div className="w5-judgment">
        <span>核心判断</span>
        <strong>{topic.judgment}</strong>
      </div>
      <div className="w5-business-map">
        <span>映射回项目</span>
        <p>{topic.mapping}</p>
      </div>
      <details className="w5-evidence">
        <summary>查看代码依据与笔记来源</summary>
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
    <section className="w5-judgment-table w3-open" aria-label="未验证与待澄清项">
      <div className="w5-jt-head">
        <span className="w5-kicker">开放问题清单</span>
        <h3>未验证与待澄清项：各自的状态与下一步</h3>
        <p>与已验收结论分开列出，每项标注当前状态与下一步，避免未验证项被读成已掌握。</p>
      </div>
      <div className="w3-open-grid">
        {W2_OPEN_ITEMS.map((item) => (
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
