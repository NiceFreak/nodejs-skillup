// W10 可观测性板 · 阶段 1 两块：⑥ 假生效（代表页）与 ① 盲区。展示资产（AGENTS.md 白名单）。
//
// 为什么代表页是「⑥ 三个绿灯漏掉什么」而不是排在编号前面的块：
// 它是六块里唯一一块 D3–D5 不会再改的——那四条实例已经发生完了，
// 而 ④ 阈值、⑤ 演练的格子在 D3（检查脚本）和 D4（演练）当天就会翻档。
// 先做的会先说谎，这条在 8/14 已经用一整轮清理证明过。
//
// 本板与 W9 板的实质差别：W9 板做完就定型，这块板从落地那天起就在等着被明天检验。
// 所以每条事实挂的不是「实测 / 推演」，而是「已实测 / 已拍板 / 待做」——
// 已拍板那一档会随 D3–D5 逐条翻成已实测，板头计数就是学习进度条。
import { useEffect, useState } from "react";
import {
  CATCHERS,
  CLOSE_TEST_NOTE,
  FALSE_GREENS,
  GREEN_GATES,
  MISSING_LOG_BRANCHES,
  REQUEST_ENDINGS,
  REQUEST_ID_FORMS,
  W10_GRADE,
  W10_STAGE_PLAN,
  gradeCounts,
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
        {active.id === "blindspot" ? <Blindspot review={review} /> : <FalseGreens review={review} />}
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
      <small>只数已落地两块里的事实；其余四块见页尾进度</small>
    </div>
  );
}

function GradeLegend() {
  const grades = Object.keys(W10_GRADE) as W10Grade[];
  return (
    <section className="w10-grade-legend" aria-label="证据档位说明">
      <div className="w6-section-head">
        <span>evidence grading</span>
        <h3>每条事实都要说清「已经在跑」还是「还只是决定要这样」</h3>
      </div>
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
    </section>
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

      {/* 矩阵：前三列全是「放行 / 不管这类」，没有一个「拦」字——空间编码本身就是结论。 */}
      <div className="w10-matrix-wrap">
        <table className="w10-matrix">
          <caption className="w10-matrix-caption">
            行 = 一条实例；前三列 = 三道绿灯的裁决；最后一列 = 真正抓到它的是谁
          </caption>
          <thead>
            <tr>
              <th scope="col">实例</th>
              {GREEN_GATES.map((gate) => (
                <th key={gate.id} scope="col">
                  <b>{gate.name}</b>
                  <small>查{gate.checks}</small>
                </th>
              ))}
              <th scope="col" className="w10-matrix-catch">
                真正抓到它的
              </th>
            </tr>
          </thead>
          <tbody>
            {FALSE_GREENS.map((item) => (
              <tr key={item.id} className={item.benign ? "benign" : ""}>
                <th scope="row">
                  {item.title}
                  {item.benign && <em>良性</em>}
                </th>
                {GREEN_GATES.map((gate) => (
                  <td key={gate.id} className={item.gates[gate.id] === "passed" ? "passed" : "na"}>
                    {item.gates[gate.id] === "passed" ? "放行" : "不管这类"}
                  </td>
                ))}
                <td className={`w10-matrix-catch catch-${item.caughtBy}`}>
                  {CATCHERS[item.caughtBy]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div className="w10-verdict">
            <div>
              <strong>
                {beforeCount}/{REQUEST_ENDINGS.length}
              </strong>
              <span>8/17 之前留下过日志的终局（其中一条与请求对不上）</span>
            </div>
            <div className="good">
              <strong>
                {afterCount}/{REQUEST_ENDINGS.length}
              </strong>
              <span>8/18 之后留下日志的终局</span>
            </div>
            <div>
              <strong>1</strong>
              <span>永远不会有的那一格 —— 它是分工，不是漏洞</span>
            </div>
          </div>

          {/* 空间编码：同一条生命线的四个终局，每格两排轨道（上=改造前，下=改造后）。
              第三格下排是空的，且必须画出来——补满它会让图变整齐，也会让结论变成谎话。 */}
          <ol className="w10-endings">
            {REQUEST_ENDINGS.map((ending) => (
              <li key={ending.id} className={`w10-ending${ending.byDesign ? " bydesign" : ""}`}>
                <div className="w10-ending-head">
                  <strong>{ending.name}</strong>
                  <GradeChip grade={ending.grade} />
                </div>
                <p className="w10-ending-trigger">{ending.trigger}</p>
                <div className={`w10-track before${ending.before.has ? " has" : " empty"}`}>
                  <span>8/17 之前</span>
                  <p>{ending.before.has ? ending.before.evidence : "一条日志都不留"}</p>
                </div>
                <div className={`w10-track after${ending.after.has ? " has" : " empty"}`}>
                  <span>8/18 之后</span>
                  <p>{ending.after.has ? ending.after.evidence : "Node 侧仍然没有 —— 这一格是对的"}</p>
                </div>
                {ending.byDesign && <p className="w10-ending-why">{ending.byDesign}</p>}
                {ending.caveat && (
                  <p className="w10-ending-caveat">
                    <span>证据差在哪</span>
                    {ending.caveat}
                  </p>
                )}
              </li>
            ))}
          </ol>

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

/* ------------------------------------------------------------------ 阶段进度 */

/** 不把「做了两块」呈现成「W10 已经做完」。四块待做的排序即方案 §9 的阶段。 */
function StagePlan() {
  const done = W10_STAGE_PLAN.filter((s) => s.done).length;
  return (
    <section className="w10-stage-plan" aria-label="本板建构进度">
      <div className="w6-section-head">
        <span>board roadmap</span>
        <h3>
          本板共 {W10_STAGE_PLAN.length} 块，当前落地 {done} 块
        </h3>
      </div>
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
        顺序不按编号，按「先做的会先说谎」：④ 阈值与 ⑤ 演练的格子会在 D3（检查脚本）和
        D4（演练）当天翻档，所以押到最后；⑥ 是唯一一块 D3–D5 不会再改的，排第一。
        范围与口径边界见笔记 <code>week10-visualization-plan.md</code>。
      </p>
    </section>
  );
}
