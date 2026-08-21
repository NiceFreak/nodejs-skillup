// W10 可观测性板 · 七块全部落地：⑥ 假生效（代表页）、① 盲区、③ 日志旅程、② 字段销账、
// ④ 阈值尺、⑦ 红过才算数、⑤ 演练分档与定位。展示资产（AGENTS.md 白名单）。
//
// 为什么代表页是「⑥ 三个绿灯漏掉什么」而不是排在编号前面的块：
// 它是六块里唯一一块 D3–D5 不会再改的——那四条实例已经发生完了，
// 而 ④ 阈值、⑤ 演练的格子在 D3（检查脚本）和 D4（演练）当天就会翻档。
// 先做的会先说谎，这条在 8/14 已经用一整轮清理证明过。
//
// 本板与 W9 板的实质差别：W9 板做完就定型，这块板从落地那天起就在等着被明天检验。
// 所以每条事实挂的不是「实测 / 推演」，而是「已实测 / 已拍板 / 待做」——
// 已拍板那一档会随 D3–D5 逐条翻成已实测，板头计数就是学习进度条。
// D3 当天翻了第一批：④ 的三条尺从「已拍板」变成「已实测」，靠的不是脚本写完了，
// 是每一条都被亲手弄红过一次——这也是新增 ⑦ 的全部理由。
// D4 当天补上最后一块 ⑤，并且它反过来改了 ④ 的两格：真把磁盘压到红线以下时，
// 那条检查报的是绿。押到演练之后才画，押对了。
import { Fragment, useEffect, useState } from "react";
import {
  ALERT_FORMAT,
  BLIND_SPOTS,
  CATCHERS,
  CHECK_NAMES,
  CHECK_UNITS,
  CHECK_VERDICTS,
  CLOSE_TEST_NOTE,
  DRILLS,
  DRILL_CLOSEOUT,
  DRILL_CORRECTIONS,
  DRILL_HANDOFF,
  DRILL_MARKER,
  DRILL_TIERS,
  DURATION_SPLIT,
  EXTRA_FIELD,
  FALSE_GREENS,
  GREEN_GATES,
  GREEN_LINE_RULE,
  IDENTITY_SPLIT,
  JOURNEY_EVIDENCE,
  JOURNEY_STEPS,
  LEAK_FIX,
  LOCATE_SIGNALS,
  LOG_FIELDS,
  MISSING_LOG_BRANCHES,
  MONITOR_SELF,
  NEVER_LOG,
  PROXY_SITES,
  REDACT_GATES,
  RED_LEVERS,
  RED_PROOFS,
  RELAY_LINE,
  REQUEST_ENDINGS,
  REQUEST_ID_FORMS,
  SIGNAL_CALLS,
  THRESHOLD_RULERS,
  TIER_C_EMPTY,
  TIME_DECISION,
  TOOL_GOTCHAS,
  TWO_SETS,
  W10_GRADE,
  W10_STAGE_PLAN,
  fieldSettlement,
  gradeCounts,
  overturnedCount,
  proxyLocationCount,
  redlineRatio,
  signalHits,
  verdictTally,
} from "./w10Facts";
import type { W10Grade } from "./w10Facts";
import { tabKeyDown } from "./tabs";
import type { BoardMode } from "./types";

/** 已落地的专题。其余四块在 W10_STAGE_PLAN 里按待做呈现，不进这个切换器。 */
const W10_TOPICS = W10_STAGE_PLAN.filter((s) => s.done).map((s) => ({
  id: s.id,
  label: s.title,
  question: s.question,
}));

const TOPIC_TAB_IDS = W10_TOPICS.map((t) => `w10-topic-tab-${t.id}`);

export default function W10Board({
  mode,
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const review = mode === "review";
  const activeIndex = Math.max(0, W10_TOPICS.findIndex((t) => t.id === topic));
  const active = W10_TOPICS[activeIndex];

  return (
    <div className="w10-board">
      <header className="w6-head">
        <div>
          <span>W10 · Observability</span>
          <h2>上线之后，怎么知道它出了什么事</h2>
          <p>
            8/17 把观测契约冻结成纸面，8/18 把它变成线上正在跑的形态：一次公网请求被同一个 id
            在 Nginx 与 Node 两条日志流里串起来，登录请求的密码在任何一条里都查不到。
            8/19 又往前挪了一格——四项检查开始自己跑，并且每一项都被亲手弄红过一次。
            8/20 把三类故障真注入到同一台生产机上：链路全走通，而这四项检查一次红都没报。
            每个专题只回答一个问题，并且都要说清这条是<b>已经在线上跑着</b>，还是<b>还只是承诺</b>。
          </p>
        </div>
        <div className="w10-head-right">
          <GradeCount />
        </div>
      </header>

      <div
        className="w10-topic-switch"
        role="tablist"
        aria-label="W10 专题"
        onKeyDown={tabKeyDown(TOPIC_TAB_IDS, activeIndex, (i) => onTopicChange(W10_TOPICS[i].id))}
      >
        {W10_TOPICS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            id={`w10-topic-tab-${item.id}`}
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls="w10-topic-panel"
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

      <div id="w10-topic-panel" role="tabpanel" aria-labelledby={`w10-topic-tab-${active.id}`}>
        {active.id === "blindspot" ? (
          <Blindspot review={review} />
        ) : active.id === "journey" ? (
          <Journey review={review} />
        ) : active.id === "fields" ? (
          <FieldSettlement review={review} />
        ) : active.id === "thresholds" ? (
          <Thresholds review={review} />
        ) : active.id === "redproof" ? (
          <RedProofs review={review} />
        ) : active.id === "drill" ? (
          <Drills review={review} />
        ) : (
          <FalseGreens review={review} />
        )}
      </div>

      <StagePlan />
    </div>
  );
}

/* ------------------------------------------------------------------ 档位语法 */

function GradeChip({ grade }: { grade: W10Grade }) {
  return <span className={`w10-grade-chip ${grade}`}>{W10_GRADE[grade].label}</span>;
}

/** 板头计数。数字从数据算出来，不手写——它是 D3–D5 的翻档进度条。 */
function GradeCount() {
  const counts = gradeCounts();
  return (
    <div className="w10-grade-count">
      <strong>
        {counts.measured} 已实测 · {counts.contract} 已拍板 · {counts.pending} 待做
      </strong>
      <small>只数已落地各块里的事实；没做的那块见页尾进度</small>
    </div>
  );
}

function GradeLegend() {
  const grades = Object.keys(W10_GRADE) as W10Grade[];
  return (
    <details className="w10-grade-legend board-fold" aria-label="证据档位说明">
      <summary>
        <span className="board-fold-kicker">evidence grading</span>
        <strong>每条事实都要说清「已经在跑」还是「还只是决定要这样」</strong>
      </summary>
      <div className="w10-grade-legend-grid">
        {grades.map((grade) => (
          <article key={grade} className={`w10-grade-${grade}`}>
            <GradeChip grade={grade} />
            <p>{W10_GRADE[grade].meaning}</p>
          </article>
        ))}
      </div>
      <p className="w10-grade-legend-note" role="note">
        W9 板用的第二档叫「推演」，那一档错了是<b>推理错</b>，就地改掉即可。本周需要的是另一种：
        已拍板的条目错了是<b>决策要改</b>，得重新走一遍冲突自查。D2 当天就出了一次——
        执行期发现 Nginx 的时间戳带 +08:00 而不是 UTC，于是 D1 那条时间口径被推翻重拍。
      </p>
    </details>
  );
}

/* =============================================== ⑥ 三个绿灯各自漏掉什么（代表页） */

function FalseGreens({ review }: { review: boolean }) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  useEffect(() => {
    setOpenIds(review ? [] : FALSE_GREENS.map((f) => f.id));
  }, [review]);

  const allOpen = openIds.length === FALSE_GREENS.length;
  // 一眼结论的分母与分子都从数据里数，避免改了数据忘了改文案。
  const caught = FALSE_GREENS.filter((f) => !f.benign).length;

  return (
    <section className="w10-falsegreen" aria-label="三个绿灯各自漏掉什么">
      <div className="w6-section-head">
        <span>false green</span>
        <h3>自动检查全绿，四条实例一条都没被它们挡下</h3>
      </div>

      <p className="w10-lead">
        这是 D2 换来的、也是全板最可迁移的一块——它和 Node、和 Nginx 都没关系，换任何一套技术栈都成立：<b>一道检查通过的是它自己那一层，不是你以为的那件事。</b>
      </p>

      <div className="w10-verdict">
        <div>
          <strong>{GREEN_GATES.length}</strong>
          <span>道自动检查全部通过</span>
        </div>
        <div>
          <strong>{FALSE_GREENS.length}</strong>
          <span>条实例从它们中间穿过去</span>
        </div>
        <div className="zero">
          <strong>0</strong>
          <span>条是被这三道挡下的</span>
        </div>
      </div>

      {/* 空间编码：三道闸横在通道上，四条实例是四条从左穿到右的轨迹。
          闸「拦住」会让轨迹在那一格断掉——本板四条一次都没断，这是图形事实，
          不需要读单元格文字。裁决同时用文字标出来（颜色不单独承载信息）。 */}
      <div className="w10-corridor" role="table" aria-label="三道绿灯与四条实例">
        <div className="w10-corridor-head" role="row">
          <span role="columnheader">实例</span>
          <div className="w10-corridor-gates">
            {GREEN_GATES.map((gate) => (
              <span key={gate.id} role="columnheader">
                <b>{gate.name}</b>
                <small>查{gate.checks}</small>
              </span>
            ))}
          </div>
          <span role="columnheader">真正抓到它的</span>
        </div>

        {FALSE_GREENS.map((item) => (
          <div key={item.id} className={`w10-corridor-row${item.benign ? " benign" : ""}`} role="row">
            <span className="w10-corridor-label" role="rowheader">
              {item.title}
              {item.benign && <em>良性</em>}
            </span>
            <div className="w10-corridor-track">
              {/* 轨迹线：完整贯穿 = 没有任何一道闸拦住它 */}
              <i className="w10-corridor-line" aria-hidden="true" />
              <div className="w10-corridor-marks">
                {GREEN_GATES.map((gate) => {
                  const passed = item.gates[gate.id] === "passed";
                  return (
                    <span key={gate.id} className={`w10-corridor-mark ${passed ? "passed" : "na"}`} role="cell">
                      <i aria-hidden="true" />
                      <small>{passed ? "放行" : "不管这类"}</small>
                    </span>
                  );
                })}
              </div>
            </div>
            <span className={`w10-corridor-catch catch-${item.caughtBy}`} role="cell">
              {CATCHERS[item.caughtBy]}
            </span>
          </div>
        ))}

        <p className="w10-corridor-legend">
          轨迹在某一格<b>断掉</b>，才表示那道闸拦住了它。四条轨迹全部完整穿到最右——
          <b>这三道闸一次都没有断过任何一条</b>。
        </p>
      </div>

      <p className="w10-note" role="note">
        最后一列的分布才是这块板的第二条结论：{caught} 条真实缺陷里，<b>没有一条是自动手段发现的</b>——一条靠事前推理，一条靠写文档时逐行核对，一条靠 review。第四条标了「良性」，因为那是同一个机制这一次正好站在我们这边。
      </p>

      {review && !allOpen && (
        <button
          type="button"
          className="w10-reveal-gate"
          onClick={() => setOpenIds(FALSE_GREENS.map((f) => f.id))}
        >
          全部展开核对
        </button>
      )}

      <ol className="w10-correction-list">
        {FALSE_GREENS.map((item, index) => {
          const open = openIds.includes(item.id);
          return (
            <li key={item.id} className={`w10-correction${item.benign ? " benign" : ""}${open ? " open" : ""}`}>
              <b aria-hidden="true">{index + 1}</b>
              <div className="w10-correction-body">
                <div className="w10-correction-head">
                  <strong>{item.title}</strong>
                  <GradeChip grade={item.grade} />
                </div>
                <p className="w10-correction-initial">
                  <span>❌ 想当然的说法</span>
                  {item.initial}
                </p>
                {open ? (
                  <>
                    <p className="w10-correction-mech">
                      <span>⚡ 实际机制</span>
                      {item.mechanism}
                    </p>
                    <p className="w10-correction-fix">
                      <span>✅ {item.benign ? "处置" : "修正"}</span>
                      {item.fix}
                    </p>
                    <p className="w10-correction-catch">
                      <span>谁抓到的</span>
                      {item.caughtDetail}
                    </p>
                  </>
                ) : (
                  <button type="button" className="w10-reveal-gate inline" onClick={() => setOpenIds((ids) => [...ids, item.id])}>
                    先自己判断错在哪一步，再展开
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="w10-gate-blind">
        <div className="w6-section-head">
          <span>what each gate is blind to</span>
          <h3>三道灯各自看不见什么</h3>
        </div>
        <div className="w10-gate-grid">
          {GREEN_GATES.map((gate) => (
            <article key={gate.id}>
              <strong>{gate.name}</strong>
              <p className="w10-gate-checks">
                <span>它查的是</span>
                {gate.checks}
              </p>
              <p className="w10-gate-blind-text">
                <span>它看不见</span>
                {gate.blind}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ ① 盲区：请求终局 */

function Blindspot({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(!review);

  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const beforeCount = REQUEST_ENDINGS.filter((e) => e.before.has).length;
  const afterCount = REQUEST_ENDINGS.filter((e) => e.after.has).length;
  const byDesign = REQUEST_ENDINGS.find((e) => e.byDesign);

  return (
    <section className="w10-blindspot" aria-label="改造前后一次请求留下什么">
      <div className="w6-section-head">
        <span>blind spot</span>
        <h3>一次请求断在半路，日志里留下什么</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            用户说「我那个请求超时了，你查一下」。8/17 的代码里，请求日志中间件只监听
            <code>res.on(&apos;finish&apos;)</code>。
          </p>
          <p className="w10-recall-ask">
            先自己答：这次请求在 Node 日志里留下了什么？如果什么都没有，你还能从哪里知道它来过？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            揭示四个终局
          </button>
        </div>
      ) : (
        <>
          <p className="w10-lead">
            改造前留下过日志的两格里，有一格是<b>与请求行对不上的 console.error</b>——
            并发时不知道哪条错误属于哪次请求，只能算半条证据。
          </p>

          {/* 空间编码：4 终局 × 2 时点的真矩阵，行首带合计。
              ● / ○ 让「上排 2 满 2 空、下排 3 满 1 空」可数，不必读单元格文字；
              第三列下排那个 ○ 必须留着——补满它图会更整齐，结论会变成谎话。 */}
          <div className="w10-grid" style={{ ["--w10-cols" as string]: REQUEST_ENDINGS.length }}>
            <div className="w10-grid-corner" aria-hidden="true" />
            {REQUEST_ENDINGS.map((ending) => (
              <div key={ending.id} className={`w10-ending${ending.byDesign ? " bydesign" : ""}`}>
                <strong>{ending.name}</strong>
                <span>{ending.trigger}</span>
                <GradeChip grade={ending.grade} />
              </div>
            ))}

            <div className="w10-grid-rowhead">
              <span>8/17 之前</span>
              <b>
                {beforeCount}/{REQUEST_ENDINGS.length}
              </b>
            </div>
            {REQUEST_ENDINGS.map((ending) => (
              <div key={ending.id} className={`w10-track before${ending.before.has ? " has" : " empty"}`}>
                <i aria-hidden="true">{ending.before.has ? "●" : "○"}</i>
                <p>{ending.before.has ? ending.before.evidence : "一条日志都不留"}</p>
              </div>
            ))}

            <div className="w10-grid-rowhead">
              <span>8/18 之后</span>
              <b>
                {afterCount}/{REQUEST_ENDINGS.length}
              </b>
            </div>
            {REQUEST_ENDINGS.map((ending) => (
              <div key={ending.id} className={`w10-track after${ending.after.has ? " has" : " empty"}`}>
                <i aria-hidden="true">{ending.after.has ? "●" : "○"}</i>
                <p>{ending.after.has ? ending.after.evidence : "Node 侧仍然没有 —— 这一格是对的"}</p>
              </div>
            ))}
          </div>

          <ul className="w10-ending-notes">
            {REQUEST_ENDINGS.filter((e) => e.byDesign || e.caveat).map((ending) => (
              <li key={ending.id}>
                <strong>{ending.name}</strong>
                {ending.byDesign && <p className="w10-ending-why">{ending.byDesign}</p>}
                {ending.caveat && (
                  <p className="w10-ending-caveat">
                    <span>证据差在哪</span>
                    {ending.caveat}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <p className="w10-note" role="note">
            盲区不是被填满的，是被<b>分清了归属</b>。「{byDesign?.name}」这一格永远空着，因为它该由另一条流回答；把它补上等于假装 Node 知道一件它根本没参与的事。
          </p>

          <div className="w10-branch">
            <div className="w6-section-head">
              <span>two meanings</span>
              <h3>「Node 日志里查不到」有两种含义，靠 id 的形态分</h3>
            </div>
            <ul className="w10-branch-list">
              {MISSING_LOG_BRANCHES.map((b) => (
                <li key={b.id}>
                  <div className="w10-branch-head">
                    <strong>{b.symptom}</strong>
                    <GradeChip grade={b.grade} />
                  </div>
                  <p className="w10-branch-verdict">{b.verdict}</p>
                  <p className="w10-branch-next">
                    <span>下一步</span>
                    {b.next}
                  </p>
                </li>
              ))}
            </ul>
            <div className="w10-idforms">
              {REQUEST_ID_FORMS.map((f) => (
                <article key={f.id}>
                  <strong>{f.sample}</strong>
                  <p className="w10-idform-shape">
                    {f.source} · {f.shape}
                  </p>
                  <p>{f.meaning}</p>
                </article>
              ))}
            </div>
            <p className="w10-note" role="note">
              兜底生成的 id 不是降级失败，是<b>自解释的分支</b>：拿它去 Nginx 日志里查不到时，第一反应应该是「这个请求没走反代」，而不是「日志丢了」。
            </p>
          </div>

          <div className="w10-testnote">
            <div className="w6-section-head">
              <span>the test itself can fail</span>
              <h3>第一次没造出断连，问题出在验证方法上</h3>
            </div>
            <ul className="w10-testnote-list">
              <li>
                <span>没成功的做法</span>
                <p>{CLOSE_TEST_NOTE.failed}</p>
              </li>
              <li>
                <span>为什么不成立</span>
                <p>{CLOSE_TEST_NOTE.why}</p>
              </li>
              <li>
                <span>换的做法</span>
                <p>{CLOSE_TEST_NOTE.worked}</p>
              </li>
              <li className="w10-testnote-result">
                <span>结果</span>
                <p>{CLOSE_TEST_NOTE.result}</p>
              </li>
            </ul>
            <p className="w10-note" role="note">
              留这一段是因为它本身可迁移：<b>验证方法自己也会失效</b>，而失效时的表现和「功能没做出来」一模一样——都是看不到预期的那条日志。
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/* ============================================== ③ 日志旅程：一根 id 的四步 */

function Journey({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(!review);
  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const hooks = proxyLocationCount();

  return (
    <section className="w10-journey" aria-label="一条请求的日志旅程">
      <div className="w6-section-head">
        <span>the thread</span>
        <h3>两条日志流没有一处是共用的，串起它们的只有这一根 id</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            D1 的契约里写的是「<b>四份 server 块</b>全部加 <code>proxy_set_header X-Request-Id</code>」。
          </p>
          <p className="w10-recall-ask">
            先自己答：落到配置层，真正要改的是几处？改漏一处会发生什么，你怎么发现？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            揭示挂点与旅程
          </button>
        </div>
      ) : (
        <>
          <div className="w10-verdict">
            <div>
              <strong>{PROXY_SITES.length}</strong>
              <span>份 site（契约里的计数单位）</span>
            </div>
            <div className="alert">
              <strong>{hooks}</strong>
              <span>个反代 location —— 真正要挂 id 的处数</span>
            </div>
            <div>
              <strong>1</strong>
              <span>份 access.log，四份 site 共用；log_format 只定义一处</span>
            </div>
          </div>

          <p className="w10-note" role="note">
            改漏一处不会报错，也不会有人告诉你：那个面的请求照常返回 200，只是日志里的
            requestId 变成 <b>local-</b> 开头。<b>只有拿着 id 去两条流里各查一次才发现。</b>
          </p>

          {/* 空间编码：两条真泳道 + 一根从上贯到下的 id 线。
              这根线是本块的结论本身——它必须是画出来的，不是写出来的。
              交叉点单独占一行：那是两条流唯一的接触点，也是唯一会漏掉的地方。 */}
          <div className="w10-swim">
            <div className="w10-swim-heads">
              <span className="lane-nginx">Nginx · access.log</span>
              <span className="lane-node">Node · journald</span>
            </div>
            <ol className="w10-swim-body">
              {JOURNEY_STEPS.map((step, i) => (
                <Fragment key={step.id}>
                  {step.id === "read" && (
                    <li className="w10-swim-cross" aria-hidden="false">
                      <span>两条流唯一的接触点：X-Request-Id 请求头</span>
                    </li>
                  )}
                  <li className={`w10-swim-step lane-${step.lane}`}>
                    <div className="w10-swim-card">
                      <div className="w10-lane-head">
                        <strong>
                          {i + 1}. {step.title}
                        </strong>
                        <GradeChip grade={step.grade} />
                      </div>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                </Fragment>
              ))}
            </ol>
            <p className="w10-swim-legend">
              竖线 = 同一个 requestId。它从第 1 步生成，到第 4 步回写给客户端，
              全程只在中间那一处跨过泳道——<b>那一处就是九个 location 里的任意一个</b>。
            </p>
          </div>

          <div className="w10-hooks">
            <div className="w6-section-head">
              <span>where the header goes</span>
              <h3>九个挂点分布在四份 site 上</h3>
            </div>
            <div className="w10-hook-grid">
              {PROXY_SITES.map((site) => (
                <article key={site.id}>
                  <div className="w10-hook-head">
                    <strong>{site.name}</strong>
                    <em>:{site.port}</em>
                    <b>{site.proxyLocations.length}</b>
                  </div>
                  <ul className="w10-hook-locs">
                    {site.proxyLocations.map((loc) => (
                      <li key={loc}>{loc}</li>
                    ))}
                  </ul>
                  <p className="w10-hook-static">{site.staticNote}</p>
                </article>
              ))}
            </div>
            <p className="w10-note" role="note">
              静态 location 不挂，因为它<b>根本不反代</b>——挂了也没有下游去读这个头。
              计数单位从 server 块变成反代 location，正是「契约落到配置层才暴露的精度问题」。
            </p>
          </div>

          <div className="w10-twosets">
            <div className="w6-section-head">
              <span>two of everything</span>
              <h3>落点、轮转、时间戳，三样都是两套</h3>
            </div>
            <div className="w10-matrix-wrap">
              <table className="w10-matrix">
                <thead>
                  <tr>
                    <th scope="col">这一样</th>
                    <th scope="col">Nginx 那条流</th>
                    <th scope="col">Node 那条流</th>
                    <th scope="col">档位</th>
                  </tr>
                </thead>
                <tbody>
                  {TWO_SETS.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.aspect}</th>
                      <td>{row.nginx}</td>
                      <td>{row.node}</td>
                      <td>
                        <GradeChip grade={row.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="w10-note" role="note">
              三行里没有一行是共用的。<b>这就是为什么必须有一根 id</b>——
              它不是为了好看，是这两条流之间唯一的连接件。
            </p>
          </div>

          <div className="w10-timedecision">
            <div className="w6-section-head">
              <span>on purpose</span>
              <h3>时间戳不统一是拍板的结果，不是待修项</h3>
            </div>
            <p className="w10-timedecision-goal">{TIME_DECISION.goal}</p>
            <div className="w10-choice">
              <article className="chosen">
                <span>✅ 选了</span>
                <p>{TIME_DECISION.chosen}</p>
              </article>
              <article className="rejected">
                <span>✕ 没选</span>
                <p>{TIME_DECISION.rejected}</p>
              </article>
            </div>
            <div className="w10-duration">
              <strong>顺带一条同型的口径</strong>
              <ul>
                {DURATION_SPLIT.map((d) => (
                  <li key={d.id}>
                    <b>{d.label}</b>
                    <span>{d.covers}</span>
                  </li>
                ))}
              </ul>
              <p>两者的差不是 bug。日志里给 Nginx 那个数写死 rt= 前缀，就是为了排障时不会看串。</p>
            </div>
          </div>

          <div className="w10-evidence">
            <div className="w6-section-head">
              <span>verification 5</span>
              <h3>本次发布唯一的新能力，证据长这样</h3>
            </div>
            <ul className="w10-evidence-list">
              <li>
                <span>响应头</span>
                <p>{JOURNEY_EVIDENCE.header}</p>
              </li>
              <li>
                <span>Nginx 侧</span>
                <p>{JOURNEY_EVIDENCE.nginxLine}</p>
              </li>
              <li>
                <span>Node 侧</span>
                <p>{JOURNEY_EVIDENCE.nodeLine}</p>
              </li>
            </ul>
            <p className="w10-note" role="note">
              这条验证<b>必须在服务器内跑</b>：access.log 与 journald 都不出本机，它没有公网形态。
              它同时是唯一能证伪「header 写在 server 级会被屏蔽」的实验。
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/* ==================================== ② 字段契约销账：说好的十个字段兑现了吗 */

function FieldSettlement({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(!review);
  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const settle = fieldSettlement();

  return (
    <section className="w10-fields" aria-label="字段契约销账">
      <div className="w6-section-head">
        <span>settlement</span>
        <h3>契约说好的十个字段，实测那一行里对上了几个</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            D1 冻结了一张字段契约表：{settle.must} 个必有 + {settle.optional} 个可选。
            8/18 上线后，本地跑出来的是一行 NDJSON。
          </p>
          <p className="w10-recall-ask">
            先自己答：销账要看的是「有没有少」，还是也要看「有没有多」？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            揭示对照表
          </button>
        </div>
      ) : (
        <>
          <div className="w10-verdict">
            <div className="good">
              <strong>
                {settle.mustDone}/{settle.must}
              </strong>
              <span>必有字段一次上线全部到位</span>
            </div>
            <div>
              <strong>
                {settle.optionalDone}/{settle.optional}
              </strong>
              <span>可选字段实现了 —— 契约写的就是「不进核心」</span>
            </div>
            <div>
              <strong>1</strong>
              <span>实测比契约多出来的键（pino 自带的 level）</span>
            </div>
          </div>

          <p className="w10-note" role="note">
            销账要同时看两个方向：<b>没有偷偷缩水，也没有顺手加码。</b>
            两个可选字段都没实现，这是照契约做，不是欠账。
          </p>

          <div className="w10-matrix-wrap">
            <table className="w10-matrix w10-field-table">
              <caption className="w10-matrix-caption">
                契约措辞 → 兑现与否（连线接上 / 断开）→ 实测那一行 NDJSON 里的键 → 没有它答不出什么 → 证据档位
              </caption>
              <thead>
                <tr>
                  <th scope="col">契约字段</th>
                  <th scope="col" className="w10-link-col">
                    兑现
                  </th>
                  <th scope="col">实测键</th>
                  <th scope="col">没有它答不出</th>
                  <th scope="col">档位</th>
                </tr>
              </thead>
              <tbody>
                {LOG_FIELDS.map((f) => (
                  <tr key={f.id} className={f.actual ? "" : "unimpl"}>
                    <th scope="row">
                      {f.contract}
                      <em>{f.required === "must" ? "必有" : "可选"}</em>
                    </th>
                    {/* 连线本身就是结论：接上的是实线加圆点，没接上的虚线断在 ✕ 上。
                        「9 条对上、2 条断开」因此可数，不必逐行读实测键。 */}
                    <td className={`w10-link ${f.actual ? "linked" : "broken"}`}>
                      <i aria-hidden="true" />
                      <small>{f.actual ? "已兑现" : "未实现"}</small>
                    </td>
                    <td className={f.actual ? "hit" : "miss"}>
                      {f.actual ?? "—"}
                      {f.note && <small>{f.note}</small>}
                    </td>
                    <td>{f.blindWithout}</td>
                    <td>
                      <GradeChip grade={f.grade} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="w10-note" role="note">
            多出来的那个键是 <b>{EXTRA_FIELD.key}</b>：{EXTRA_FIELD.why}
          </p>

          <div className="w10-redact">
            <div className="w6-section-head">
              <span>four gates, by force</span>
              <h3>脱敏的四道闸，按强制力排</h3>
            </div>
            <ol className="w10-gate-ladder">
              {REDACT_GATES.map((gate, i) => (
                <li key={gate.id} className={`force-${gate.force}`}>
                  <div className="w10-gate-rank">
                    <b>{i + 1}</b>
                    <span>{gate.forceLabel}</span>
                  </div>
                  <div className="w10-gate-body">
                    <div className="w10-gate-head">
                      <strong>{gate.name}</strong>
                      <GradeChip grade={gate.grade} />
                    </div>
                    <p className="w10-gate-what">{gate.what}</p>
                    <p className="w10-gate-effect">
                      <span>今天实际起了什么作用</span>
                      {gate.effect}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="w10-note" role="note">
              这块板最反直觉的一条在第二道：<b>今天真正挡住密码的那道闸，和配了一整页的那道闸，不是同一道。</b>
              验证② 的 NOT_FOUND 是「根本不记 body」的功劳；redact 的五条路径今天一条都没被触发过。
            </p>
          </div>

          <div className="w10-neverlog">
            <div className="w6-section-head">
              <span>never in the log</span>
              <h3>永不入日志清单，与那条漏是怎么补上的</h3>
            </div>
            <ul className="w10-neverlog-list">
              {NEVER_LOG.map((n) => (
                <li key={n.id}>
                  <p>{n.item}</p>
                  {n.extra && <span>{n.extra}</span>}
                </li>
              ))}
            </ul>
            <div className="w10-leakfix">
              <strong>唯一漏出去的那条，两个通道都要断</strong>
              <ul>
                <li>
                  <b>断源</b>
                  <span>{LEAK_FIX.path}</span>
                </li>
                <li>
                  <b>断口</b>
                  <span>{LEAK_FIX.message}</span>
                </li>
              </ul>
              <p>{LEAK_FIX.why}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* ============================================== ④ 阈值从哪来：四条距离尺 */

function Thresholds({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(!review);
  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const alarms = THRESHOLD_RULERS.filter((r) => r.kind === "alarm");
  const watched = THRESHOLD_RULERS.filter((r) => r.watchedBy).length;
  const proven = THRESHOLD_RULERS.filter((r) => r.provenRed).length;

  return (
    <section className="w10-thresholds" aria-label="四条红线各自定在哪">
      <div className="w6-section-head">
        <span>how far is the redline</span>
        <h3>红线定在还来得及做点什么的位置，不是定在故障点上</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>内存红线是 200 MB，磁盘是 4 GB，证书是 15 天。三个数都不是整数倍，也不是行业默认值。</p>
          <p className="w10-recall-ask">
            先自己答：内存为什么不是 500 MB？这三个数分别是从哪一头倒推出来的——从「资源还剩多少」，还是从「出事之后我要花多久才能修好」？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            揭示四条尺
          </button>
        </div>
      ) : (
        <>
          <div className="w10-verdict">
            <div className="zero">
              <strong>0</strong>
              <span>条红线定在故障点上——尺上红线到出事点之间那一段，全是留给自己的动作时间</span>
            </div>
            <div className="good">
              <strong>{proven}</strong>
              <span>条昨天还没有任何东西会为它报警，今天都有检查在盯、并且都被弄红过一次</span>
            </div>
            <div>
              <strong>{THRESHOLD_RULERS.length - watched}</strong>
              <span>条不需要人盯：它不是告警线，是到了自己清的硬上限</span>
            </div>
          </div>

          {/* 空间编码：一条尺 = 从出事点（左端）到今天实测值（右端）。
              红线的位置按 红线值 / 实测值 算出来，不是随手画的——
              「还剩多少动作时间」因此是量出来的距离，不是一句形容词。
              第四条方向相反（占用往上涨、撞的是上限），所以它换一种画法：那种不一致本身就是信息。 */}
          <div className="w10-rulers">
            {THRESHOLD_RULERS.map((r) => {
              const ratio = r.kind === "alarm" ? redlineRatio(r) : r.current.value / r.redline.value;
              const pct = `${(ratio * 100).toFixed(1)}%`;
              return (
                <article key={r.id} className={`w10-ruler kind-${r.kind}`}>
                  <div className="w10-ruler-head">
                    <strong>{r.subject}</strong>
                    <GradeChip grade={r.grade} />
                  </div>

                  {r.kind === "alarm" ? (
                    <div className="w10-ruler-track" style={{ ["--w10-redline" as string]: pct }}>
                      <i className="w10-ruler-margin" aria-hidden="true" />
                      <i className="w10-ruler-mark" aria-hidden="true" />
                      <b className="w10-ruler-redline">{r.redline.label}</b>
                      <span className="w10-ruler-outage">出事点</span>
                      <span className="w10-ruler-current">
                        今天 {r.current.value} {r.current.unit}
                      </span>
                    </div>
                  ) : (
                    <div className="w10-ruler-cap" style={{ ["--w10-fill" as string]: pct }}>
                      <i className="w10-ruler-fill" aria-hidden="true" />
                      <b className="w10-ruler-redline">{r.redline.label}</b>
                      <span className="w10-ruler-current">
                        已占 {r.current.value} {r.current.unit}
                      </span>
                    </div>
                  )}

                  <p className="w10-ruler-outage-text">
                    <span>越过去会怎样</span>
                    {r.outage}
                  </p>
                  <p className="w10-ruler-basis">
                    <span>这个数从哪来</span>
                    {r.basis}
                  </p>
                  <p className="w10-ruler-action">
                    <span>报出来我该做什么</span>
                    {r.action}
                  </p>
                  <div className="w10-ruler-watch">
                    <p className={r.watchedBy ? "on" : "off"}>
                      <span>谁在盯</span>
                      {r.watchedBy ?? "没有检查盯它——它到了上限自己处理"}
                    </p>
                    <p className={r.provenRed ? "on" : "off"}>
                      <span>红过没有</span>
                      {r.provenRed ?? "不适用：这一条不靠检查脚本兜"}
                    </p>
                  </div>
                  {r.caveat && (
                    <p className="w10-ending-caveat">
                      <span>这一格还差什么</span>
                      {r.caveat}
                    </p>
                  )}
                  <p className="w10-ruler-at">{r.current.at}</p>
                </article>
              );
            })}
          </div>

          <p className="w10-note" role="note">
            {alarms.length} 条告警线里，留得最紧的是内存那条——只有实测值的一成半。
            理由不是内存更重要，是<b>交换区是 0：它没有先变慢再被杀这个中间态</b>，
            所以留的量必须够在被杀之前把人叫醒。磁盘与证书都有更长的缓冲，因为它们的坏是慢慢来的。
          </p>

          <p className="w10-note" role="note">
            这块板 8/18 落地时，上面三条全是「已拍板」——那天没有任何东西会真的报警。
            今天它们翻成「已实测」，靠的不是脚本写完了，是<b>每一条都被亲手弄红过一次</b>（见 ⑦）。
            写完就翻档，等于把「有一个文件存在」当成「它会在该响的时候响」。
          </p>
        </>
      )}
    </section>
  );
}

/* ==================================== ⑦ 红过才算数：四项检查与五次红态证据链 */

function RedProofs({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(!review);
  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const gaps = RED_PROOFS.filter((p) => !p.chain.some((c) => c.state === "red")).length;
  const byResource = RED_PROOFS.filter((p) => p.lever === "resource").length;
  const brokenUnits = CHECK_UNITS.filter((u) => u.mismatch && !u.resolved);
  const resolvedUnits = CHECK_UNITS.filter((u) => u.mismatch && u.resolved);

  return (
    <section className="w10-redproof" aria-label="四项检查凭什么可信">
      <div className="w6-section-head">
        <span>only red proves it</span>
        <h3>没红过的绿灯和一根接地线没有区别</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            四项检查昨天还不存在，今天写完了，手工跑一遍：四项全绿。timer 也挂上了，每分钟自动跑一次，还是全绿。
          </p>
          <p className="w10-recall-ask">
            先自己答：到这一步，你凭什么相信它们会在该报警的时候报警？还缺哪一步证据？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            揭示五条证据链
          </button>
        </div>
      ) : (
        <>
          <div className="w10-verdict">
            <div className="good">
              <strong>{RED_PROOFS.length}</strong>
              <span>条完整的「绿 → 我把它弄红 → 它确实报了红 → 我把它恢复绿」</span>
            </div>
            <div className="zero">
              <strong>{gaps}</strong>
              <span>项只有绿灯、没红过——缺一项即当日不收口</span>
            </div>
            <div>
              <strong>{byResource}</strong>
              <span>次靠真造资源条件：那一整列今天空着，是留给明天的，不是没做完</span>
            </div>
          </div>

          {/* 空间编码：每一行都是一条闭合的证据链，中间那一格必须是红的。
              一行里如果只有绿格，那一行就是断的——「没红过」在图上是看得见的缺口，
              不是一句备注。三格的时刻与退出码都是当天跑出来的原值。 */}
          <div className="w10-chain" role="table" aria-label="五条红态证据链">
            <div className="w10-chain-head" role="row">
              <span role="columnheader">检查项</span>
              <div className="w10-chain-cols">
                <span role="columnheader">起点：绿</span>
                <span role="columnheader">我做了什么</span>
                <span role="columnheader">它报的红</span>
                <span role="columnheader">怎么还原</span>
                <span role="columnheader">回到绿</span>
              </div>
            </div>

            {RED_PROOFS.map((p) => (
              <div key={p.id} className="w10-chain-row" role="row">
                <span className="w10-chain-label" role="rowheader">
                  <b>{p.name}</b>
                  <em>{p.unit}</em>
                </span>
                <div className="w10-chain-track">
                  <span className={`w10-chain-cell ${p.chain[0].state}`} role="cell">
                    <i aria-hidden="true">●</i>
                    <b>{p.chain[0].at}</b>
                    <u>退出码 {p.chain[0].exit}</u>
                    <small>{p.chain[0].detail}</small>
                  </span>

                  <span className="w10-chain-arrow break" role="cell">
                    <i aria-hidden="true">↓</i>
                    <small>{p.how}</small>
                  </span>

                  <span className={`w10-chain-cell ${p.chain[1].state}`} role="cell">
                    <i aria-hidden="true">●</i>
                    <b>{p.chain[1].at}</b>
                    <u>退出码 {p.chain[1].exit}</u>
                    <small>{p.chain[1].detail}</small>
                    <em className="w10-chain-action">
                      <span>它对我说的下一步</span>
                      {p.action}
                    </em>
                  </span>

                  <span className="w10-chain-arrow restore" role="cell">
                    <i aria-hidden="true">↓</i>
                    <small>{p.restore}</small>
                  </span>

                  <span className={`w10-chain-cell ${p.chain[2].state}`} role="cell">
                    <i aria-hidden="true">●</i>
                    <b>{p.chain[2].at}</b>
                    <u>退出码 {p.chain[2].exit}</u>
                    <small>{p.chain[2].detail}</small>
                  </span>
                </div>
              </div>
            ))}

            <p className="w10-corridor-legend">
              每一行中间那一格是红的，而且红格下面永远挂着一句<b>我下一步该做什么</b>——
              报「something failed」的检查，等于把排障的活原样还给你。
            </p>
          </div>

          <div className="w10-levers">
            <div className="w6-section-head">
              <span>where the red came from</span>
              <h3>弄红作用在链条的哪一环，决定它证明了多少</h3>
            </div>
            <div
              className="w10-lever-grid"
              style={{ ["--w10-levers" as string]: RED_LEVERS.length }}
              role="table"
              aria-label="五次弄红分别作用在哪一环"
            >
              <div className="w10-lever-corner" aria-hidden="true" />
              {RED_LEVERS.map((lever) => (
                <div key={lever.id} className={`w10-lever-head lever-${lever.id}`} role="columnheader">
                  <strong>{lever.label}</strong>
                  <span>{lever.what}</span>
                </div>
              ))}

              {RED_PROOFS.map((p) => (
                <Fragment key={p.id}>
                  <div className="w10-lever-rowhead" role="rowheader">
                    {p.name}
                  </div>
                  {RED_LEVERS.map((lever) => (
                    <div
                      key={lever.id}
                      className={`w10-lever-cell${p.lever === lever.id ? " on" : ""}`}
                      role="cell"
                    >
                      <i aria-hidden="true">{p.lever === lever.id ? "●" : "○"}</i>
                    </div>
                  ))}
                </Fragment>
              ))}

              <div className="w10-lever-rowhead foot" role="rowheader">
                这一环证明了什么
              </div>
              {RED_LEVERS.map((lever) => (
                <div key={lever.id} className="w10-lever-foot" role="cell">
                  {lever.strength}
                </div>
              ))}
            </div>

            <p className="w10-note" role="note">
              最右那一列一个实心点都没有，而且是<b>故意的</b>：{RELAY_LINE.d3}；{RELAY_LINE.d4}。
              两天的证据要接力，不要重复——今天就真把盘写满，明天那一类就没有东西可验了。规矩只有一条：{RELAY_LINE.rule}。
            </p>

            <ul className="w10-relay-list">
              {RED_PROOFS.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong>
                  <p className="w10-relay-proves">
                    <span>今天证明了</span>
                    {p.proves}
                  </p>
                  <p className="w10-relay-not">
                    <span>还没证明</span>
                    {p.notProves}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="w10-units">
            <div className="w6-section-head">
              <span>cadence and identity</span>
              <h3>四个检查，四档频率，两种身份</h3>
            </div>
            <div className="w10-matrix-wrap">
              <table className="w10-matrix">
                <caption className="w10-matrix-caption">
                  按列顺序：检查名 → 它盯什么 → 红线 → 拍板的频率 → unit 里实际写的排程 → 补跑开关 → 以谁的身份跑 → 档位
                </caption>
                <thead>
                  <tr>
                    <th scope="col">检查</th>
                    <th scope="col">盯什么</th>
                    <th scope="col">红线</th>
                    <th scope="col">拍板频率</th>
                    <th scope="col">排程写的是</th>
                    <th scope="col">补跑</th>
                    <th scope="col">身份</th>
                    <th scope="col">档位</th>
                  </tr>
                </thead>
                <tbody>
                  {CHECK_UNITS.map((u) => (
                    <tr key={u.id} className={u.mismatch && !u.resolved ? "unimpl" : ""}>
                      <th scope="row">{u.unit}</th>
                      <td>{u.watches}</td>
                      <td>{u.redline}</td>
                      <td>{u.cadence}</td>
                      <td className={u.mismatch && !u.resolved ? "miss" : "hit"}>{u.calendar}</td>
                      <td>{u.persistent ? "开" : "关"}</td>
                      <td className={u.user === "root" ? "w10-matrix-catch" : ""}>{u.user}</td>
                      <td>
                        <GradeChip grade={u.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {brokenUnits.map((u) => (
              <div key={u.id} className="w10-mismatch">
                <strong>拍板与实际对不上的一行：{u.unit}</strong>
                <p>{u.mismatch}</p>
                <p className="w10-mismatch-take">
                  它是又一条「绿灯全过但语义不是你以为的那个」：enable 成功、排程表达式合法、
                  列 timer 时下次触发时间也有——三样都对，唯独单位不是想要的那个。
                  这一格因此挂「待做」而不是「已实测」；改完之后要用一次列排程的输出来销账，
                  不能靠读一遍文件就宣布对了。
                </p>
              </div>
            ))}

            {resolvedUnits.map((u) => (
              <div key={u.id} className="w10-mismatch ok">
                <strong>已销账的一行：{u.unit}</strong>
                <p>{u.mismatch}</p>
                <p className="w10-mismatch-resolved">
                  <span>销账证据</span>
                  {u.resolved}
                </p>
              </div>
            ))}

            <div className="w10-identity">
              <div className="w10-choice">
                <article className="chosen">
                  <span>三项普通身份</span>
                  <p>{IDENTITY_SPLIT.normal}</p>
                </article>
                <article className="rejected">
                  <span>一项 root</span>
                  <p>{IDENTITY_SPLIT.root}</p>
                </article>
              </div>
              <p className="w10-note" role="note">
                {IDENTITY_SPLIT.why}。另一条口径写在报红文案里：{IDENTITY_SPLIT.actionRule}。
              </p>
            </div>
          </div>

          <div className="w10-selfwatch">
            <div className="w6-section-head">
              <span>who watches the watcher</span>
              <h3>检查没在跑的时候，从哪里看得出来</h3>
            </div>
            <p className="w10-lead">
              这一天最危险的失败模式不是报错，是<b>静默常绿</b>：timer 没排程、脚本自己挂了，
              而你看到的是一片安静——和「一切正常」长得一模一样。
            </p>
            <ul className="w10-selfwatch-list">
              {MONITOR_SELF.map((m) => (
                <li key={m.id}>
                  <div className="w10-branch-head">
                    <strong>{m.mode}</strong>
                    <GradeChip grade={m.grade} />
                  </div>
                  <p className="w10-selfwatch-signal">
                    <span>信号在哪</span>
                    {m.signal}
                  </p>
                  <p className="w10-selfwatch-detail">{m.detail}</p>
                </li>
              ))}
            </ul>
            <div className="w10-greenline">
              <strong>{GREEN_LINE_RULE.chosen}</strong>
              <p>{GREEN_LINE_RULE.why}</p>
              <p className="w10-greenline-cost">{GREEN_LINE_RULE.cost}</p>
            </div>
            <p className="w10-note" role="note">
              绿时也打一行、和「怎么发现检查没在跑」是同一个问题的两半：
              <b>要能区分「安静因为一切正常」和「安静因为没人在跑」</b>，日志里就必须有心跳，
              排程表里就必须有下次触发时间。两处都看，才算监控自己也被监控着。
            </p>
          </div>

          <div className="w10-alertfmt">
            <div className="w6-section-head">
              <span>who reads the alert</span>
              <h3>报红的输出，同时给人和机器读</h3>
            </div>
            <ul className="w10-evidence-list">
              <li>
                <span>长什么样</span>
                <p>{ALERT_FORMAT.shape}</p>
              </li>
              <li>
                <span>为什么不是纯文本</span>
                <p>{ALERT_FORMAT.why}</p>
              </li>
              <li>
                <span>可操作是什么意思</span>
                <p>{ALERT_FORMAT.actionable}</p>
              </li>
              <li>
                <span>一个 unit 里怎么分层</span>
                <p>{ALERT_FORMAT.subsystem}</p>
              </li>
            </ul>
          </div>

          <div className="w10-gotchas">
            <div className="w6-section-head">
              <span>only learned by hitting it</span>
              <h3>这一天踩出来的五条工具行为</h3>
            </div>
            <ul className="w10-gotcha-list">
              {TOOL_GOTCHAS.map((g) => (
                <li key={g.id}>
                  <p className="w10-gotcha-hit">
                    <span>撞上的</span>
                    {g.hit}
                  </p>
                  <p className="w10-gotcha-fact">
                    <span>实际机制</span>
                    {g.fact}
                  </p>
                  <p className="w10-gotcha-take">
                    <span>以后怎么做</span>
                    {g.take}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

/* ================================= ⑤ 演练分档与定位：真注入之后，谁替你说话 */

/**
 * 这块押到最后做，理由和 ④ 一样，但更硬：8/20 之前，三类故障的「首个症状」
 * 全部是写在笔记里的预测。当天真注入之后，三条里有两条被实测推翻——
 * 提前画出来，画的就是两条不成立的东西。
 *
 * 版面承载的结论有三处，都不靠标题：
 *   · 分档矩阵最右一列一个实心点都没有 —— C 档是主动收窄，不是没做完
 *   · 每一类的预测与实测之间有一根连线，断了两根 —— 「预测被推翻」可数
 *   · 检查表态矩阵的实测那一层，红点数是零 —— 而三类故障都真的发生过
 */
function Drills({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(!review);
  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const ran = DRILLS.filter((d) => d.ran);
  const skipped = DRILLS.filter((d) => !d.ran);
  const tally = verdictTally();
  const drillName = (id: string) => DRILLS.find((d) => d.id === id)?.name ?? id;
  const tierLabel = (id: string) => DRILL_TIERS.find((t) => t.id === id)?.label ?? id;
  const MARK: Record<string, string> = { red: "红", green: "绿", untested: "未实测" };

  return (
    <section className="w10-drill" aria-label="三类故障真注入之后发生了什么">
      <div className="w6-section-head">
        <span>the drills, and the silence</span>
        <h3>三类故障都真的发生过，四项检查表过态的 {tally.spoke} 次全是绿</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            昨天四项检查逐项被弄红过一次，红得干脆。今天在同一台生产机上真注入了三类故障：
            磁盘压到告警线附近、反代指向一个没人监听的端口、应用的端口被别人抢占。
          </p>
          <p className="w10-recall-ask">
            先自己答：这三类故障发生的时候，四项检查<b>该</b>报几次红？<b>实际</b>报了几次？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            揭示三类的预测与实测
          </button>
        </div>
      ) : (
        <>
          <div className="w10-verdict">
            <div className="good">
              <strong>{ran.length}</strong>
              <span>类真注入，每一类都走完注入 → 现象 → 定位 → 根因 → 修复 → 恢复</span>
            </div>
            <div className="alert">
              <strong>{overturnedCount()}</strong>
              <span>类的预测被实测推翻——照着预测的样子走完，今天什么都学不到</span>
            </div>
            <div className="zero">
              <strong>{BLIND_SPOTS.length}</strong>
              <span>个互相独立的盲区，全部由「该红不红、该失败不失败」露出来</span>
            </div>
          </div>

          {/* 空间编码：四类 × 三档。最右一列整列空着，是本周主动收窄的证据——
              补满它图会更整齐，也会把一条安全边界画成没有。 */}
          <div className="w10-tiers">
            <div className="w6-section-head">
              <span>how far the injection goes</span>
              <h3>分档分的不是危险程度，是还原它要付出什么</h3>
            </div>
            <div
              className="w10-tier-grid"
              style={{ ["--w10-tiers" as string]: DRILL_TIERS.length }}
              role="table"
              aria-label="四类故障各落在哪一档"
            >
              <div className="w10-tier-corner" aria-hidden="true" />
              {DRILL_TIERS.map((t) => (
                <div key={t.id} className={`w10-tier-head tier-${t.id}`} role="columnheader">
                  <strong>{t.label}</strong>
                  <span>{t.meaning}</span>
                  <em>还原：{t.rollback}</em>
                </div>
              ))}

              {DRILLS.map((d) => (
                <Fragment key={d.id}>
                  <div className="w10-tier-rowhead" role="rowheader">
                    <b>{d.name}</b>
                    <em>{d.ran ? "今天真注入" : "今天不做"}</em>
                  </div>
                  {DRILL_TIERS.map((t) => (
                    <div
                      key={t.id}
                      className={`w10-tier-cell${d.tier === t.id ? (d.ran ? " on" : " stood-in") : ""}`}
                      role="cell"
                    >
                      <i aria-hidden="true">{d.tier === t.id ? (d.ran ? "●" : "◌") : "○"}</i>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>

            <p className="w10-note" role="note">
              最右那一列一个实心点都没有：{TIER_C_EMPTY.candidate}落在那里，而{TIER_C_EMPTY.why}。
              准入规则只有一条，写在动手之前：<b>{TIER_C_EMPTY.rule}</b>。
            </p>

            {skipped.map((d) => (
              <p key={d.id} className="w10-tier-standin">
                <span>{d.name}这一类今天为什么不做</span>
                {d.standIn}
              </p>
            ))}
          </div>

          {/* 每一类：预测与实测并排，中间一根连线。断掉的那两根就是今天的收获。 */}
          <ol className="w10-drill-list">
            {ran.map((d, index) => (
              <li key={d.id} className={`w10-drill-card ${d.verdict ?? ""}`}>
                <div className="w10-drill-head">
                  <strong>
                    {index + 1}. {d.name}
                  </strong>
                  <em className="w10-drill-tier">{tierLabel(d.tier)}</em>
                  <GradeChip grade={d.grade} />
                </div>

                <div className="w10-drill-probe">
                  <p className="w10-drill-inject">
                    <span>注入</span>
                    {d.inject}
                  </p>
                  <p className="w10-drill-first">
                    <span>首查</span>
                    {d.firstProbe}
                  </p>
                  <p className="w10-drill-split">
                    <span>它把范围劈成</span>
                    {d.split}
                  </p>
                </div>

                <div className="w10-face-pair">
                  <div className="w10-face predicted">
                    <span>注入前写死的预测</span>
                    <p>{d.predicted}</p>
                  </div>
                  <div className={`w10-link ${d.verdict === "hit" ? "linked" : "broken"}`}>
                    <i aria-hidden="true" />
                    <small>{d.verdict === "hit" ? "命中" : "被推翻"}</small>
                  </div>
                  <div className={`w10-face actual ${d.verdict ?? ""}`}>
                    <span>实测</span>
                    <p>{d.actual}</p>
                  </div>
                </div>

                {/* 主路径到此为止：档位、定位链、预测↔实测三层已经回答「它会不会红」。
                    下面这些是原始证据与过程收尾——按核查线阶段二第 2 步收进渐进层级，
                    一字未删，展开即见。 */}
                <details className="w10-drill-more board-fold">
                  <summary>
                    <span className="board-fold-kicker">evidence &amp; closeout</span>
                    <strong>
                      {[
                        "可复核的那一行",
                        d.deviation ? "偏差归在哪" : null,
                        d.rootCause ? "根因分三层" : null,
                        "恢复与收口",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </strong>
                  </summary>

                <p className="w10-drill-evidence">
                  <span>可复核的那一行</span>
                  {d.evidence}
                </p>

                {d.deviation ? (
                  <p className="w10-drill-deviation">
                    <span>偏差归在哪</span>
                    {d.deviation}
                  </p>
                ) : null}

                {d.rootCause ? (
                  <div className="w10-cause">
                    <div className="w10-cause-head">
                      <strong>根因分三层</strong>
                      <GradeChip grade={d.rootCause.grade} />
                    </div>
                    <p className="w10-cause-fact">
                      <span>事实</span>
                      {d.rootCause.fact}
                    </p>
                    <p className="w10-cause-guess">
                      <span>推断</span>
                      {d.rootCause.guess}
                    </p>
                    <p className="w10-cause-open">
                      <span>还没验</span>
                      {d.rootCause.unverified}
                    </p>
                  </div>
                ) : null}

                <div className="w10-drill-close">
                  <p className="w10-drill-recovery">
                    <span>恢复</span>
                    {d.recovery}
                  </p>
                  <p className="w10-drill-closure">
                    <span>收口拍板</span>
                    {d.closure}
                  </p>
                </div>
                </details>
              </li>
            ))}
          </ol>

          {/* 空间编码：三类 × 四项检查，每格上下两层（上=预测，下=实测）。
              下层一个红点都没有，而上层有两个——这块矩阵的形状就是本块的结论。 */}
          <div className="w10-cvs">
            <div className="w6-section-head">
              <span>what the monitors said</span>
              <h3>预测层里有两个红，实测层里一个都没有</h3>
            </div>
            <div
              className="w10-cv-grid"
              style={{ ["--w10-cv" as string]: CHECK_NAMES.length }}
              role="table"
              aria-label="四项检查在三类故障里的表态"
            >
              <div className="w10-cv-corner" role="columnheader">
                <span>上：注入前的预测</span>
                <span>下：注入态的实测</span>
              </div>
              {CHECK_NAMES.map((name) => (
                <div key={name} className="w10-cv-head" role="columnheader">
                  {name}
                </div>
              ))}

              {CHECK_VERDICTS.map((row) => (
                <Fragment key={row.drill}>
                  <div className="w10-cv-rowhead" role="rowheader">
                    {drillName(row.drill)}
                  </div>
                  {row.cells.map((cell) => (
                    <div
                      key={cell.check}
                      className={`w10-cv-cell${
                        cell.actual === "untested"
                          ? " owed"
                          : cell.predicted !== cell.actual
                            ? " diff"
                            : ""
                      }`}
                      role="cell"
                    >
                      <b className={`w10-cv-mark predicted ${cell.predicted}`}>
                        <i aria-hidden="true">{cell.predicted === "untested" ? "○" : "●"}</i>
                        {MARK[cell.predicted]}
                      </b>
                      <b className={`w10-cv-mark actual ${cell.actual}`}>
                        <i aria-hidden="true">{cell.actual === "untested" ? "○" : "●"}</i>
                        {MARK[cell.actual]}
                      </b>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>

            <ul className="w10-cv-notes">
              {CHECK_VERDICTS.flatMap((row) =>
                row.cells
                  .filter((c) => c.note)
                  .map((c) => (
                    <li key={`${row.drill}-${c.check}`}>
                      <strong>
                        {drillName(row.drill)} × {c.check}
                      </strong>
                      <p>{c.note}</p>
                    </li>
                  )),
              )}
            </ul>

            <p className="w10-note" role="note">
              三类故障每一类都真的发生在那台机器上，而实测那一层一个红点都没有。
              昨天「把判据弄红」证明的是<b>假输入能红</b>；今天证明的是另一件事——
              <b>真条件到了，它未必红</b>。两句话隔一天才凑齐，缺哪一句都会把监控读成保险。
              还欠着的是 {tally.untested} 格：端口那一类在复测四项检查之前就收口了。
            </p>
          </div>

          {/* 三把刀 × 三类故障，九次判决。指对方向的两次落在同一行。 */}
          <div className="w10-signals">
            <div className="w6-section-head">
              <span>which signal splits the layers</span>
              <h3>九次判决里指对方向的只有 {signalHits()} 次，而且是同一把刀给的</h3>
            </div>
            <ul className="w10-signal-list">
              {LOCATE_SIGNALS.map((sig) => (
                <li key={sig.id}>
                  <div className="w10-signal-head">
                    <strong>{sig.name}</strong>
                    <GradeChip grade={sig.grade} />
                  </div>
                  <p className="w10-signal-reads">
                    <span>它读的是</span>
                    {sig.reads}
                  </p>
                  <p className="w10-signal-cannot">
                    <span>它答不了</span>
                    {sig.cannot}
                  </p>
                  <div className="w10-signal-calls">
                    {sig.calls.map((c) => (
                      <div key={c.drill} className={`w10-signal-call ${c.call}`}>
                        <b>{drillName(c.drill)}</b>
                        <u>{SIGNAL_CALLS[c.call]}</u>
                        <small>{c.detail}</small>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <p className="w10-note" role="note">
              定位顺序不是习惯，是<b>哪一步能把范围劈成两半</b>。
              公网那五个面能告诉你「有事」，劈不开是哪一层；问服务活着没有，今天直接给了错的方向。
              真正一刀两断的是绕开反代、直连应用自己那一口——它 8/18 上线时只是顺手做的一格验证。
            </p>
          </div>

          {/* 三个盲区：两个是实现缺陷，一个是分工。分不清就会去修不该修的那一个。 */}
          <div className="w10-blinds">
            <div className="w6-section-head">
              <span>who stays quiet, and why</span>
              <h3>三个盲区里，只有两个是缺陷</h3>
            </div>
            <div className="w10-blind-grid">
              {BLIND_SPOTS.map((b) => (
                <article key={b.id} className={`w10-blind kind-${b.kind}`}>
                  <div className="w10-blind-head">
                    <strong>{b.name}</strong>
                    <GradeChip grade={b.grade} />
                  </div>
                  <p className="w10-blind-kind">
                    <span>它是哪一种</span>
                    {b.kindNote}
                  </p>
                  <p className="w10-blind-silent">
                    <span>什么时候它安静地绿着</span>
                    {b.silentWhen}
                  </p>
                  <p className="w10-blind-mech">
                    <span>机制</span>
                    {b.mechanism}
                  </p>
                  <p className="w10-blind-evidence">
                    <span>证据</span>
                    {b.evidence}
                  </p>
                  <p className="w10-blind-fix">
                    <span>补法候选</span>
                    {b.fixCandidate}
                  </p>
                  <p className="w10-blind-goes">
                    <span>去哪</span>
                    {b.goesTo}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {/* 当天纠正的两条工具认知：都改变了下一步怎么做，不是花絮。 */}
          <details className="w10-drill-corrections board-fold">
            <summary>
              <span className="board-fold-kicker">corrected on the spot</span>
              <strong>两条只能靠真撞一次才知道的工具行为</strong>
            </summary>
            <ol className="w10-correction-list">
              {DRILL_CORRECTIONS.map((c, index) => (
                <li key={c.id} className="w10-correction">
                  <b aria-hidden="true">{index + 1}</b>
                  <div className="w10-correction-body">
                    <div className="w10-correction-head">
                      <strong>{c.thought}</strong>
                      <GradeChip grade={c.grade} />
                    </div>
                    <p className="w10-correction-mech">
                      <span>⚡ 实际机制</span>
                      {c.mechanism}
                    </p>
                    <p className="w10-correction-fix">
                      <span>✅ 改成怎么做</span>
                      {c.fix}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </details>

          {/* 收尾：演练做完不算完，机器回到干净才算完。 */}
          <details className="w10-closeout board-fold">
            <summary>
              <span className="board-fold-kicker">leave nothing behind</span>
              <strong>{DRILL_CLOSEOUT.verdict}</strong>
            </summary>
            <ul className="w10-closeout-baseline">
              {DRILL_CLOSEOUT.baseline.map((line) => (
                <li key={line}>
                  <i aria-hidden="true">✓</i>
                  <p>{line}</p>
                </li>
              ))}
            </ul>
            <ul className="w10-closeout-residue">
              {DRILL_CLOSEOUT.residues.map((r) => (
                <li key={r.item}>
                  <i aria-hidden="true">✓</i>
                  <strong>{r.item}</strong>
                  <span>{r.proof}</span>
                </li>
              ))}
            </ul>
            <p className="w10-note" role="note">
              {DRILL_MARKER.how}——{DRILL_MARKER.why}。
            </p>
            <div className="w10-handoff">
              <p className="w10-handoff-runbook">
                <span>交给 runbook</span>
                {DRILL_HANDOFF.toRunbook}
              </p>
              <p className="w10-handoff-selftest">
                <span>交给延迟自测</span>
                {DRILL_HANDOFF.toSelfTest}
              </p>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ 阶段进度 */

/** 不把「做了两块」呈现成「W10 已经做完」。四块待做的排序即方案 §9 的阶段。 */
function StagePlan() {
  const done = W10_STAGE_PLAN.filter((s) => s.done).length;
  return (
    <details className="w10-stage-plan board-fold" aria-label="本板建构进度">
      <summary>
        <span className="board-fold-kicker">board roadmap</span>
        <strong>
          本板共 {W10_STAGE_PLAN.length} 块，当前落地 {done} 块
        </strong>
      </summary>
      <ul className="w10-stage-list">
        {W10_STAGE_PLAN.map((item) => (
          <li key={item.id} className={item.done ? "done" : "todo"}>
            <i aria-hidden="true">{item.done ? "✓" : "—"}</i>
            <strong>{item.title}</strong>
            <span>{item.question}</span>
            <em>{item.done ? "已落地" : "待做"}</em>
          </li>
        ))}
      </ul>
      <p className="w10-stage-note">
        顺序不按编号，按「先做的会先说谎」：⑥ 是唯一一块 D3–D5 不会再改的，排第一；
        ④ 阈值押到 D3 之后才做，因为它的三条尺当天才从「已拍板」翻成「已实测」；
        ⑦ 是 D3 当天新增的一块——检查存在之后，「凭什么信它」才成为一个能回答的问题。
        ⑤ 押到最后：8/20 真注入之后才画，而三类里有两类的首个症状被实测推翻——
        提前画出来，画的就是两条不成立的东西。
        范围与口径边界见笔记 <code>week10-visualization-plan.md</code>。
      </p>
    </details>
  );
}
