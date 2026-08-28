// W10 可观测性板 · 八块全部落地：⑥ 假生效（代表页）、① 盲区、③ 日志旅程、② 字段兑现核对、
// ④ 阈值尺、⑦ 红过才算数、⑤ 演练分档与定位、⑧ runbook 与它的延迟自测。
// 展示资产（AGENTS.md 白名单）。
//
// 为什么代表页是「⑥ 三项自动检查漏掉什么」而不是排在编号前面的块：
// 它是六块里唯一一块 D3–D5 不会再改的——那四条实例已经发生完了，
// 而 ④ 阈值、⑤ 演练的格子在 D3（检查脚本）和 D4（演练）当天就会翻档。
// 先做的会先过时，这条在 8/14 已经用一整轮清理证明过。
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
  CLOSEOUT_TRACKS,
  CLOSE_TEST_NOTE,
  CUT_BLIND_EDGE,
  CUT_LANDINGS,
  DRILLS,
  DRILL_CLOSEOUT,
  DRILL_CORRECTIONS,
  DRILL_HANDOFF,
  DRILL_MARKER,
  DRILL_TIERS,
  DURATION_SPLIT,
  EXTRA_FIELD,
  FAKEACTIVE_FIX,
  FAKEACTIVE_FOLLOWUP,
  FALSE_GREENS,
  FIRST_CUT,
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
  ROUNDING_BAND,
  RUNBOOK_ACCEPT,
  SECOND_CUT,
  SELF_TEST,
  SIGNAL_CALLS,
  THRESHOLD_RULERS,
  TIER_C_EMPTY,
  TIME_DECISION,
  TOOL_GOTCHAS,
  TWO_SETS,
  W10_GRADE,
  W10_STAGE_PLAN,
  WEEK_TAKEAWAY,
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
/**
 * tab 列表。注意它**不再**与 `W10_STAGE_PLAN` 一一对应：
 * ⑤ 与 ⑧ 各自一块内容在 tab 上分三页（⑤ 是 2026-08-21 本人拍板，⑧ 建成时直接按一页一问落地），
 * 而「本板共几块」记录的是建成了哪几块内容，不随分页变。所以下面是八块派生出十二个 tab。
 */
const DRILL_TABS: Array<{ id: string; label: string; question: string; part: DrillPart }> = [
  { id: "drill", label: "⑤ 故障注入与定位", question: "真实故障如何表现和恢复", part: "drills" },
  { id: "drill-signals", label: "⑤ 检查结果与定位信号", question: "四项检查的实测结果是什么", part: "signals" },
  { id: "drill-blinds", label: "⑤ 监控盲区与演练收尾", question: "三处监控盲区分别因何产生", part: "blinds" },
];

const RUNBOOK_TABS: Array<{ id: string; label: string; question: string; part: RunbookPart }> = [
  { id: "runbook", label: "⑧ 首查命令与分流", question: "只看到症状时，首查哪条命令", part: "cut" },
  { id: "runbook-selftest", label: "⑧ runbook 延迟自测", question: "不看笔记，能否走通两类故障", part: "selftest" },
  { id: "runbook-strength", label: "⑧ 收尾证据等级", question: "哪一项已实测，哪一项仍待验证", part: "strength" },
];

const W10_TOPICS = W10_STAGE_PLAN.filter((s) => s.done).flatMap((s) =>
  s.id === "drill"
    ? DRILL_TABS.map((t) => ({ id: t.id, label: t.label, question: t.question }))
    : s.id === "runbook"
      ? RUNBOOK_TABS.map((t) => ({ id: t.id, label: t.label, question: t.question }))
      : [{ id: s.id, label: s.title, question: s.question }],
);

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
          <h2>上线后如何发现并定位服务故障</h2>
          <p>
            8/17 冻结观测契约。8/18 使用同一 requestId 关联 Nginx 与 Node 日志，并验证登录密码不会写入两类日志。
            8/19 四项检查开始自动运行，每项均通过可逆方式触发过红色结果。8/20 在唯一一台生产机上注入三类故障并完成恢复；
            8 个已实测检查结果均为绿，另有 4 格未复测。8/21 将前四天的结果整理成 runbook，并在不查看演练笔记的条件下走通两类故障。
            每个专题均标明已实测、已拍板或待做。
          </p>
        </div>
        <div className="w10-head-right">
          <GradeCount />
        </div>
      </header>

      <div className="w10-topic-current">
        <span>当前专题 · {activeIndex + 1}/{W10_TOPICS.length}</span>
        <strong id="w10-active-topic-label">{active.label}</strong>
        <small>{active.question}</small>
      </div>
      <details className="w10-topic-directory board-fold">
        <summary>
          <span className="board-fold-kicker">topic directory</span>
          <strong>展开完整专题目录 · {W10_TOPICS.length} 项</strong>
        </summary>
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
      </details>

      <div id="w10-topic-panel" role="tabpanel" aria-labelledby="w10-active-topic-label">
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
        ) : DRILL_TABS.some((t) => t.id === active.id) ? (
          <Drills
            review={review}
            part={DRILL_TABS.find((t) => t.id === active.id)?.part ?? "drills"}
          />
        ) : RUNBOOK_TABS.some((t) => t.id === active.id) ? (
          <Runbook
            review={review}
            part={RUNBOOK_TABS.find((t) => t.id === active.id)?.part ?? "cut"}
          />
        ) : (
          <FalseGreens review={review} />
        )}
      </div>

      <GradeLegend />

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
      <small>按事实所属时点计数；8/21 的 pending 不等于当前仍欠</small>
    </div>
  );
}

function GradeLegend() {
  const grades = Object.keys(W10_GRADE) as W10Grade[];
  return (
    <details className="w10-grade-legend board-fold" aria-label="证据档位说明">
      <summary>
        <span className="board-fold-kicker">evidence grading</span>
        <strong>每条事实均标明所属时点的证据状态</strong>
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
        W9 的第二档“推演”表示推理结论；W10 的第二档“已拍板”表示已经作出决策但尚未验证。
        历史 pending 会与后来证据并列，不覆盖当时认知，也不冒充当前欠账。
      </p>
    </details>
  );
}

/* =============================================== ⑥ 三项自动检查各自漏掉什么（代表页） */

function FalseGreens({ review }: { review: boolean }) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  useEffect(() => {
    setOpenIds(review ? [] : FALSE_GREENS.map((f) => f.id));
  }, [review]);

  const allOpen = openIds.length === FALSE_GREENS.length;
  // 一眼结论的分母与分子都从数据里数，避免改了数据忘了改文案。
  const caught = FALSE_GREENS.filter((f) => !f.benign).length;

  return (
    <section className="w10-falsegreen" aria-label="三项自动检查的覆盖边界">
      <div className="w6-section-head">
        <span>check coverage</span>
        <h3>三项自动检查均通过，四个实例均未触发检查失败</h3>
      </div>

      <p className="w10-lead">
        三项检查只验证各自覆盖的对象，不能证明配置和日志行为整体符合预期。
      </p>

      <div className="w10-verdict">
        <div>
          <strong>{GREEN_GATES.length}</strong>
          <span>道自动检查全部通过</span>
        </div>
        <div>
          <strong>{FALSE_GREENS.length}</strong>
          <span>个实例均未触发检查失败</span>
        </div>
        <div className="zero">
          <strong>0</strong>
          <span>个实例由三项自动检查发现</span>
        </div>
      </div>

      {/* 空间编码：三项自动检查横在通道上，四条实例是四条从左穿到右的轨迹。
          检查「拦住」会让轨迹在那一格断掉——本板四条一次都没断，这是图形事实，
          不需要读单元格文字。裁决同时用文字标出来（颜色不单独承载信息）。 */}
      <div className="w10-corridor" role="table" aria-label="三项自动检查与四个未触发失败的实例">
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
          <span role="columnheader">实际发现方式</span>
        </div>

        {FALSE_GREENS.map((item) => (
          <div key={item.id} className={`w10-corridor-row${item.benign ? " benign" : ""}`} role="row">
            <span className="w10-corridor-label" role="rowheader">
              {item.title}
              {item.benign && <em>良性</em>}
            </span>
            <div className="w10-corridor-track">
              {/* 轨迹线：完整贯穿 = 没有任何一项检查拦住它 */}
              <i className="w10-corridor-line" aria-hidden="true" />
              <div className="w10-corridor-marks">
                {GREEN_GATES.map((gate) => {
                  const passed = item.gates[gate.id] === "passed";
                  return (
                    <span key={gate.id} className={`w10-corridor-mark ${passed ? "passed" : "na"}`} role="cell">
                      <i aria-hidden="true" />
                      <small>{passed ? "检查通过" : "不在检查范围"}</small>
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
          “检查通过”表示该检查没有报告异常。四个实例均未触发三项检查失败。
        </p>
      </div>

      <p className="w10-note" role="note">
        {caught} 条真实缺陷均由人工发现：一条来自事前推理，一条来自配置逐行核对，一条来自 review。
        第四个实例符合预期，相同机制在该场景下不构成缺陷。
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
                  <span>原判断</span>
                  {item.initial}
                </p>
                {open ? (
                  <>
                    <p className="w10-correction-mech">
                      <span>实际机制</span>
                      {item.mechanism}
                    </p>
                    <p className="w10-correction-fix">
                      <span>{item.benign ? "处理方式" : "修正方式"}</span>
                      {item.fix}
                    </p>
                    <p className="w10-correction-catch">
                      <span>发现方式</span>
                      {item.caughtDetail}
                    </p>
                  </>
                ) : (
                  <button type="button" className="w10-reveal-gate inline" onClick={() => setOpenIds((ids) => [...ids, item.id])}>
                    作答后查看
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="w10-gate-blind">
        <div className="w6-section-head">
          <span>coverage limits</span>
          <h3>三项检查各自未覆盖什么</h3>
        </div>
        <div className="w10-gate-grid">
          {GREEN_GATES.map((gate) => (
            <article key={gate.id}>
              <strong>{gate.name}</strong>
              <p className="w10-gate-checks">
                <span>检查对象</span>
                {gate.checks}
              </p>
              <p className="w10-gate-blind-text">
                <span>未覆盖范围</span>
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
    <section className="w10-blindspot" aria-label="四种请求终局的日志覆盖">
      <div className="w6-section-head">
        <span>blind spot</span>
        <h3>请求中途终止时，日志会留下哪些记录</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            用户反馈请求超时。8/17 的代码中，请求日志中间件只监听
            <code>res.on(&apos;finish&apos;)</code>。
          </p>
          <p className="w10-recall-ask">
            客户端中途断开时，应从哪些日志确认请求是否到达 Node？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            查看四种请求终局
          </button>
        </div>
      ) : (
        <>
          <p className="w10-lead">
            改造前有日志的两种终局中，进程内错误只留下无法关联请求的 <b>console.error</b>。
            并发时无法确认错误对应哪次请求，因此证据不完整。
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
                <p>{ending.after.has ? ending.after.evidence : "Node 侧无日志，符合设计"}</p>
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
            改造目标是<b>分清日志归属</b>。{byDesign?.name}时，请求未进入 Node，Node 侧不应有记录；
            对应证据由 Nginx access.log 提供。
          </p>

          <div className="w10-branch">
            <div className="w6-section-head">
              <span>two meanings</span>
              <h3>requestId 形态可区分请求未进入 Node 与请求绕过 Nginx</h3>
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
              <b>local-</b> 前缀表示请求未经过 Nginx。access.log 没有对应记录时，应先确认请求入口，
              不应先判断日志丢失。
            </p>
          </div>

          <div className="w10-testnote">
            <div className="w6-section-head">
              <span>test validity</span>
              <h3>首次验证未触发 close 事件</h3>
            </div>
            <ul className="w10-testnote-list">
              <li>
                <span>未触发的方法</span>
                <p>{CLOSE_TEST_NOTE.failed}</p>
              </li>
              <li>
                <span>未触发原因</span>
                <p>{CLOSE_TEST_NOTE.why}</p>
              </li>
              <li>
                <span>有效方法</span>
                <p>{CLOSE_TEST_NOTE.worked}</p>
              </li>
              <li className="w10-testnote-result">
                <span>验证结果</span>
                <p>{CLOSE_TEST_NOTE.result}</p>
              </li>
            </ul>
            <p className="w10-note" role="note">
              <b>验证方法失效</b>与功能未实现都会表现为缺少预期日志，因此需要先确认测试是否真正触发目标终局。
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
    <section className="w10-journey" aria-label="requestId 在 Nginx 与 Node 之间的传递">
      <div className="w6-section-head">
        <span>request correlation</span>
        <h3>Nginx 与 Node 使用独立日志流，requestId 是两者的关联字段</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            D1 契约要求<b>四份 server 块全部</b>配置 <code>proxy_set_header X-Request-Id</code>。
          </p>
          <p className="w10-recall-ask">
            四份 server 配置实际包含多少个需要传递 X-Request-Id 的反代 location？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            查看配置位置与传递路径
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
              <span>个反代 location 需要配置 X-Request-Id</span>
            </div>
            <div>
              <strong>1</strong>
              <span>份 access.log，四份 site 共用；log_format 只定义一处</span>
            </div>
          </div>

          <p className="w10-note" role="note">
            遗漏任一 location 不会导致配置报错，请求仍返回 200，但 Node 会生成 <b>local-</b> requestId。
            需分别查询 access.log 与 journald 才能发现差异。
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
                      <span>两条日志流的关联字段：X-Request-Id 请求头</span>
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
              竖线表示同一个 requestId。Nginx 生成后，经 9 个反代 location 中的一个传给 Node，
              最终由 Node 回写响应头。
            </p>
          </div>

          <div className="w10-hooks">
            <div className="w6-section-head">
              <span>where the header goes</span>
              <h3>九个反代 location 分布在四份 site 上</h3>
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
              静态 location 不进行反代，没有下游读取 X-Request-Id，因此无需配置 proxy_set_header。
              契约以 server 块计数，实施时应以反代 location 计数。
            </p>
          </div>

          <div className="w10-twosets">
            <div className="w6-section-head">
              <span>log configuration comparison</span>
              <h3>Nginx 与 Node 分别使用不同的日志存储、轮转和时间戳规则</h3>
            </div>
            <div className="w10-matrix-wrap">
              <table className="w10-matrix">
                <thead>
                  <tr>
                    <th scope="col">对比项</th>
                    <th scope="col">Nginx 日志</th>
                    <th scope="col">Node 日志</th>
                    <th scope="col">证据等级</th>
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
              两条日志流在存储、轮转和时间戳上均不共享配置，因此需要 requestId 关联同一次请求。
            </p>
          </div>

          <div className="w10-timedecision">
            <div className="w6-section-head">
              <span>time format decision</span>
              <h3>Nginx 保留 +08:00，Node 保留 UTC</h3>
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
              <strong>两种耗时口径</strong>
              <ul>
                {DURATION_SPLIT.map((d) => (
                  <li key={d.id}>
                    <b>{d.label}</b>
                    <span>{d.covers}</span>
                  </li>
                ))}
              </ul>
              <p>两项耗时覆盖范围不同。Nginx 字段使用 rt= 前缀，避免排障时与 Node duration 混淆。</p>
            </div>
          </div>

          <div className="w10-evidence">
            <div className="w6-section-head">
              <span>verification 5</span>
              <h3>requestId 跨 Nginx 与 Node 关联的验证证据</h3>
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
              该验证<b>必须在服务器内跑</b>，因为 access.log 与 journald 仅保留在本机，公网无法同时查询两条日志。
              它也是唯一能验证 location 定义任一 proxy_set_header 后不再继承 server 级同类指令集的实验。
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/* ================================ ② 字段契约兑现核对：说好的十个字段兑现了吗 */

function FieldSettlement({ review }: { review: boolean }) {
  const [revealed, setRevealed] = useState(!review);
  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const settle = fieldSettlement();

  return (
    <section className="w10-fields" aria-label="日志字段契约与实测输出对照">
      <div className="w6-section-head">
        <span>contract check</span>
        <h3>日志字段契约与实测 NDJSON 对照</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            D1 定义 {settle.must} 个必有字段和 1 个可选字段；D2 P5 又增加 requestIdSource 可选扩展位。
            8/18 的实测输出为一行 NDJSON。
          </p>
          <p className="w10-recall-ask">
            核对字段契约时，为什么既要检查缺失字段，也要检查契约外字段？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            查看契约对照
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
              <span>可选字段已实现；两项均按契约未实现</span>
            </div>
            <div>
              <strong>1</strong>
              <span>实测比契约多出来的键（pino 自带的 level）</span>
            </div>
          </div>

          <p className="w10-note" role="note">
            核对同时覆盖三类结果：必有字段是否缺失、可选字段是否越界实现、实测输出是否出现契约外键。
            两个可选字段未实现符合约定。
          </p>

          <div className="w10-matrix-wrap">
            <table className="w10-matrix w10-field-table">
              <caption className="w10-matrix-caption">
                契约字段、实现状态、实测键、缺失影响和证据等级
              </caption>
              <thead>
                <tr>
                  <th scope="col">契约字段</th>
                  <th scope="col" className="w10-link-col">
                    实现状态
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
                      <small>{f.actual ? "已实现" : "未实现"}</small>
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
              <span>data controls</span>
              <h3>四层脱敏控制及本次验证结果</h3>
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
                      <span>本次验证结果</span>
                      {gate.effect}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="w10-note" role="note">
              验证② 的 PASSWORD_NOT_FOUND 来自请求日志不记录 body；pino redact 的五条路径本次均未触发。
            </p>
          </div>

          <div className="w10-neverlog">
            <div className="w6-section-head">
              <span>never in the log</span>
              <h3>禁止记录的字段与查询串泄漏修复</h3>
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
              <strong>查询串泄漏需要同时修改 404 构造与错误输出</strong>
              <ul>
                <li>
                  <b>404 构造</b>
                  <span>{LEAK_FIX.path}</span>
                </li>
                <li>
                  <b>错误输出</b>
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

  const watched = THRESHOLD_RULERS.filter((r) => r.watchedBy).length;
  const proven = THRESHOLD_RULERS.filter((r) => r.provenRed).length;

  return (
    <section className="w10-thresholds" aria-label="三个告警阈值与一个日志硬上限">
      <div className="w6-section-head">
        <span>alert thresholds and hard cap</span>
        <h3>三条告警线预留处理时间，日志项采用自动清理硬上限</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>内存、磁盘和证书告警阈值分别为 200 MB、4 GB 和 15 天；日志占用另设 500 MB 硬上限。</p>
          <p className="w10-recall-ask">
            三个告警阈值分别依据什么实测数据和处理时间确定？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            查看阈值依据
          </button>
        </div>
      ) : (
        <>
          <div className="w10-verdict">
            <div className="zero">
              <strong>0</strong>
              <span>条告警线设置在故障点</span>
            </div>
            <div className="good">
              <strong>{proven}</strong>
              <span>条告警判据已通过可逆方式触发红色结果并恢复</span>
            </div>
            <div>
              <strong>{THRESHOLD_RULERS.length - watched}</strong>
              <span>条为 journald 自动清理的硬上限，不触发人工告警</span>
            </div>
          </div>

          {/* 空间编码：一条尺 = 从出事点（左端）到当前实测值（右端）。
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
                        实测 {r.current.value} {r.current.unit}
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
                    <span>超过阈值的影响</span>
                    {r.outage}
                  </p>
                  <p className="w10-ruler-basis">
                    <span>阈值依据</span>
                    {r.basis}
                  </p>
                  <p className="w10-ruler-action">
                    <span>触发后的处理</span>
                    {r.action}
                  </p>
                  <div className="w10-ruler-watch">
                    <p className={r.watchedBy ? "on" : "off"}>
                      <span>检查与频率</span>
                      {r.watchedBy ?? "由 journald 在达到上限时自动清理"}
                    </p>
                    <p className={r.provenRed ? "on" : "off"}>
                      <span>红态验证</span>
                      {r.provenRed ?? "不适用：该项不触发检查告警"}
                    </p>
                  </div>
                  {r.caveat && (
                    <p className="w10-ending-caveat">
                      <span>补充验证与边界</span>
                      {r.caveat}
                    </p>
                  )}
                  <p className="w10-ruler-at">{r.current.at}</p>
                </article>
              );
            })}
          </div>

          <p className="w10-note" role="note">
            内存阈值 200 MB 约为 D1 基线 1304 MB 的 15%。该主机交换区为 0，
            内存不足时可能直接触发进程终止，因此阈值需要预留人工处理时间。磁盘和证书的变化较慢，处理窗口更长。
          </p>

          <p className="w10-note" role="note">
            8/18 只完成阈值约定，尚无告警实现。8/19 三项检查完成实现，并分别经过红态触发与恢复验证，
            因此证据等级由已拍板更新为已实测。脚本文件存在本身不构成红态证据。
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
    <section className="w10-redproof" aria-label="四项检查的红态验证">
      <div className="w6-section-head">
        <span>red-state verification</span>
        <h3>四项检查形成五条绿到红再回绿的证据链</h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            四项检查手工运行均返回绿色结果；四个 timer 已启用并显示下次触发时间，约定频率分别为 1 分钟、5 分钟、1 小时和 6 小时。
          </p>
          <p className="w10-recall-ask">
            还需要哪些证据，才能确认每项检查在判据满足时会返回红色结果，并在还原后恢复为绿？
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            查看五条红态证据链
          </button>
        </div>
      ) : (
        <>
          <div className="w10-verdict">
            <div className="good">
              <strong>{RED_PROOFS.length}</strong>
              <span>条完整的绿、红、恢复绿证据链</span>
            </div>
            <div className="zero">
              <strong>{gaps}</strong>
              <span>项缺少红态验证</span>
            </div>
            <div>
              <strong>{byResource}</strong>
              <span>次使用真实资源故障触发；D3 仅使用可逆测试输入</span>
            </div>
          </div>

          {/* 空间编码：每一行都是一条闭合的证据链，中间那一格必须是红的。
              一行里如果只有绿格，那一行就是断的——「没红过」在图上是看得见的缺口，
              不是一句备注。三格的时刻与退出码都是当天跑出来的原值。 */}
          <div className="w10-chain" role="table" aria-label="五条红态证据链">
            <div className="w10-chain-head" role="row">
              <span role="columnheader">检查项</span>
              <div className="w10-chain-cols">
                <span role="columnheader">初始绿态</span>
                <span role="columnheader">触发方式</span>
                <span role="columnheader">红态结果</span>
                <span role="columnheader">还原方式</span>
                <span role="columnheader">恢复绿态</span>
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
                      <span>建议操作</span>
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
              五条证据链都包含红态结果、退出码和建议操作。建议操作用于把检查结果转换为明确的排障入口。
            </p>
          </div>

          <div className="w10-levers">
            <div className="w6-section-head">
              <span>verification scope</span>
              <h3>触发方式决定每条证据能够证明的范围</h3>
            </div>
            <div
              className="w10-lever-grid"
              style={{ ["--w10-levers" as string]: RED_LEVERS.length }}
              role="table"
              aria-label="五次红态验证分别覆盖的环节"
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
                该方式能够证明什么
              </div>
              {RED_LEVERS.map((lever) => (
                <div key={lever.id} className="w10-lever-foot" role="cell">
                  {lever.strength}
                </div>
              ))}
            </div>

            <p className="w10-note" role="note">
              D3 的五条红态证据均未注入真实资源故障：{RELAY_LINE.d3}；{RELAY_LINE.d4}。
              两天验证不同层级的行为，准入规则为：{RELAY_LINE.rule}。
            </p>

            <ul className="w10-relay-list">
              {RED_PROOFS.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong>
                  <p className="w10-relay-proves">
                    <span>已验证</span>
                    {p.proves}
                  </p>
                  <p className="w10-relay-not">
                    <span>未验证</span>
                    {p.notProves}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <details className="w10-units board-fold">
            <summary>
              <span className="board-fold-kicker">cadence and identity</span>
              <strong>四个检查，四档频率，两种身份</strong>
            </summary>
            <div className="w10-matrix-wrap">
              <table className="w10-matrix">
                <caption className="w10-matrix-caption">
                  四项检查的监测对象、阈值、约定频率、实际排程、补跑设置、运行身份与证据等级
                </caption>
                <thead>
                  <tr>
                    <th scope="col">检查</th>
                    <th scope="col">监测对象</th>
                    <th scope="col">阈值</th>
                    <th scope="col">约定频率</th>
                    <th scope="col">实际排程</th>
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
                <strong>约定频率与实际排程不一致：{u.unit}</strong>
                <p>{u.mismatch}</p>
                <p className="w10-mismatch-take">
                  unit 已启用、排程表达式合法且能够列出下次触发时间，但时间单位与约定不一致。
                  修正后需要用排程解析结果验证连续触发间隔，读取配置文件不能替代该验证。
                </p>
              </div>
            ))}

            {resolvedUnits.map((u) => (
              <div key={u.id} className="w10-mismatch ok">
                <strong>已修正并验证：{u.unit}</strong>
                <p>{u.mismatch}</p>
                <p className="w10-mismatch-resolved">
                  <span>验证证据</span>
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
          </details>

          <div className="w10-selfwatch">
            <div className="w6-section-head">
              <span>who watches the watcher</span>
              <h3>通过排程状态、失败状态与日志确认检查是否运行</h3>
            </div>
            <p className="w10-lead">
              timer 未排程或脚本执行失败时，业务告警可能没有任何输出。需要同时检查排程状态、服务失败状态和检查日志。
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
              每次检查在绿态也写入一条日志，作为执行心跳；timer 同时提供下次触发时间。
              两类证据结合后，才能区分检查正常执行与检查未运行。
            </p>
          </div>

          <details className="w10-alertfmt board-fold">
            <summary>
              <span className="board-fold-kicker">who reads the alert</span>
              <strong>红态输出同时支持人工排障与机器解析</strong>
            </summary>
            <ul className="w10-evidence-list">
              <li>
                <span>输出格式</span>
                <p>{ALERT_FORMAT.shape}</p>
              </li>
              <li>
                <span>结构化原因</span>
                <p>{ALERT_FORMAT.why}</p>
              </li>
              <li>
                <span>建议操作</span>
                <p>{ALERT_FORMAT.actionable}</p>
              </li>
              <li>
                <span>unit 内分层</span>
                <p>{ALERT_FORMAT.subsystem}</p>
              </li>
            </ul>
          </details>

          <details className="w10-gotchas board-fold">
            <summary>
              <span className="board-fold-kicker">observed tool behavior</span>
              <strong>实际验证中确认的五项工具行为</strong>
            </summary>
            <ul className="w10-gotcha-list">
              {TOOL_GOTCHAS.map((g) => (
                <li key={g.id}>
                  <p className="w10-gotcha-hit">
                    <span>触发现象</span>
                    {g.hit}
                  </p>
                  <p className="w10-gotcha-fact">
                    <span>实际机制</span>
                    {g.fact}
                  </p>
                  <p className="w10-gotcha-take">
                    <span>后续做法</span>
                    {g.take}
                  </p>
                </li>
              ))}
            </ul>
          </details>
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
/**
 * ⑤ 演练分档与定位。2026-08-21 拆成三个 tab（本人拍板）：一块里原本堆了四个问题，
 * 实测 5.91 屏——减负做过一轮降到 4.07 屏之后，剩下的重量全在常驻主路径上，
 * 折不动了，只能分页。三页共用同一个数据与同一段前言，各自只回答一个问题。
 *
 * **「本板共 7 块」的口径不变**：`W10_STAGE_PLAN` 记录的是 8/20 建成了哪七块内容，属历史事实；
 * 这里拆的是「一块内容怎么分页呈现」，所以 tab 有九个而块仍是七块。
 */
type DrillPart = "drills" | "signals" | "blinds";

const DRILL_PART_HEAD: Record<DrillPart, { kicker: string; aria: string }> = {
  drills: { kicker: "fault injection results", aria: "三类生产故障注入的结果" },
  signals: { kicker: "check results and diagnostic signals", aria: "四项检查结果与三个定位信号" },
  blinds: { kicker: "blind spots and closeout", aria: "三个监控盲区与演练收尾" },
};

function Drills({ review, part }: { review: boolean; part: DrillPart }) {
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
    <section className={`w10-drill part-${part}`} aria-label={DRILL_PART_HEAD[part].aria}>
      <div className="w6-section-head">
        <span>{DRILL_PART_HEAD[part].kicker}</span>
        <h3>
          {part === "drills"
            ? "三类故障均完成注入、现象记录、定位、根因分析记录、故障处置与基线恢复；端口占用的根因机制仍待验证"
            : part === "signals"
              ? `四项检查的 ${tally.spoke} 个实测结果均为绿`
              : `实测发现 ${BLIND_SPOTS.length} 个独立盲区：真实故障未触发红色结果或失败状态`}
        </h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            8/19 通过假输入逐项触发四项检查的红色结果。8/20 在同一台生产机上注入三类故障：
            磁盘可用空间接近告警线、反代上游端口无监听、应用端口被占用。
          </p>
          <p className="w10-recall-ask">
            {part === "drills" ? (
              <>三类故障的首查项分别是什么？</>
            ) : part === "signals" ? (
              <>
                四项检查预计和实际各有几个红色结果？
              </>
            ) : (
              <>三个盲区分别属于实现缺陷还是职责范围缺口？</>
            )}
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            {part === "drills"
              ? "查看预测与实测"
              : part === "signals"
                ? "查看检查结果与定位信号"
                : "查看盲区分类与收尾结果"}
          </button>
        </div>
      ) : (
        <>
          {part === "drills" && (
            <>
          <div className="w10-verdict">
            <div className="good">
              <strong>{ran.length}</strong>
              <span>类完成生产故障注入与六阶段记录；其中一类根因机制仍待验证</span>
            </div>
            <div className="alert">
              <strong>{overturnedCount()}</strong>
              <span>类的首个症状预测被实测推翻</span>
            </div>
            <div className="zero">
              <strong>{BLIND_SPOTS.length}</strong>
              <span>个独立盲区：真实故障未触发红色结果或失败状态</span>
            </div>
          </div>

          {/* 空间编码：四类 × 三档。最右一列整列空着，是本周主动收窄的证据——
              补满它图会更整齐，也会把一条安全边界画成没有。 */}
          <div className="w10-tiers">
            <div className="w6-section-head">
              <span>how far the injection goes</span>
              <h3>故障注入按还原成本分档</h3>
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
                    <em>{d.ran ? "8/20 已注入" : "8/20 未注入"}</em>
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
              C 档没有实心点。{TIER_C_EMPTY.candidate}属于该档；{TIER_C_EMPTY.why}。
              准入规则：<b>{TIER_C_EMPTY.rule}</b>。
            </p>

            {skipped.map((d) => (
              <p key={d.id} className="w10-tier-standin">
                <span>{d.name}在 8/20 未注入的原因</span>
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
                    <span>首查结果分流</span>
                    {d.split}
                  </p>
                </div>

                <div className="w10-face-pair">
                  <div className="w10-face predicted">
                    <span>注入前记录的预测</span>
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
                        "关键命令输出",
                        d.deviation ? "预测偏差类型" : null,
                        d.rootCause ? "根因证据分层" : null,
                        "恢复与收尾",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </strong>
                  </summary>

                <p className="w10-drill-evidence">
                  <span>关键命令输出</span>
                  {d.evidence}
                </p>

                {d.deviation ? (
                  <p className="w10-drill-deviation">
                    <span>预测偏差类型</span>
                    {d.deviation}
                  </p>
                ) : null}

                {d.rootCause ? (
                  <div className="w10-cause">
                    <div className="w10-cause-head">
                      <strong>根因证据分层</strong>
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
                      <span>未验证</span>
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
                    <span>收尾结论</span>
                    {d.closure}
                  </p>
                </div>
                </details>
              </li>
            ))}
          </ol>

          {/* 空间编码：三类 × 四项检查，每格上下两层（上=预测，下=实测）。
              下层一个红点都没有，而上层有两个——这块矩阵的形状就是本块的结论。 */}
            </>
          )}

          {part === "signals" && (
            <>
          <div className="w10-cvs">
            <div className="w6-section-head">
              <span>check results</span>
              <h3>预测为红 2 格，实测为红 0 格</h3>
            </div>
            <div
              className="w10-cv-grid"
              style={{ ["--w10-cv" as string]: CHECK_NAMES.length }}
              role="table"
              aria-label="四项检查在三类故障中的预测与实测结果"
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
              8/20 三类故障均完成注入，{tally.spoke} 个已实测检查结果均为绿，另有 {tally.untested} 格未复测。
              8/19 的假输入验证只证明检查能够输出红色结果；8/20 的真实故障注入证明，
              <b>真实故障不一定触发红色结果</b>。端口占用故障在复测四项检查前结束，因此 4 格保持未实测。
            </p>
          </div>

          {/* 三个定位信号 × 三类故障，共 9 次判断。定位正确的 2 次落在同一行。 */}
          <div className="w10-signals">
            <div className="w6-section-head">
              <span>diagnostic accuracy</span>
              <h3>三个定位信号共做出 9 次判断；只有服务器内直连健康检查口的 {signalHits()} 次判断定位正确</h3>
            </div>
            <ul className="w10-signal-list">
              {LOCATE_SIGNALS.map((sig) => (
                <li key={sig.id}>
                  <div className="w10-signal-head">
                    <strong>{sig.name}</strong>
                    <GradeChip grade={sig.grade} />
                  </div>
                  <p className="w10-signal-reads">
                    <span>观测对象</span>
                    {sig.reads}
                  </p>
                  <p className="w10-signal-cannot">
                    <span>无法判断</span>
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
              定位顺序取决于每项检查能够缩小的范围。五个公网面的结果只能确认公网可达性异常，
              不能区分反代层与应用层。服务状态在端口占用故障中给出错误方向。
              服务器内直连健康检查口绕过反代，在反代配置错误和端口占用两类故障中正确定位到层。该检查于 8/18 上线。
            </p>
          </div>

          {/* 三个盲区：两个是实现缺陷，一个是分工。分不清就会去修不该修的那一个。 */}
            </>
          )}

          {part === "blinds" && (
            <>
          <div className="w10-blinds">
            <div className="w6-section-head">
              <span>blind spots and closeout</span>
              <h3>三个盲区中，两个为实现缺陷，一个为职责范围缺口</h3>
            </div>
            <div className="w10-blind-grid">
              {BLIND_SPOTS.map((b) => (
                <article key={b.id} className={`w10-blind kind-${b.kind}`}>
                  <div className="w10-blind-head">
                    <strong>{b.name}</strong>
                    <GradeChip grade={b.grade} />
                  </div>
                  <p className="w10-blind-kind">
                    <span>分类</span>
                    {b.kindNote}
                  </p>
                  <p className="w10-blind-silent">
                    <span>未触发告警的条件</span>
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
                    <span>处理方案</span>
                    {b.fixCandidate}
                  </p>
                  <p className="w10-blind-goes">
                    <span>后续安排</span>
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
              <strong>两项经实际演练确认的工具行为</strong>
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
                      <span>实际机制</span>
                      {c.mechanism}
                    </p>
                    <p className="w10-correction-fix">
                      <span>后续做法</span>
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
              <span className="board-fold-kicker">baseline and residue checks</span>
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
              {DRILL_MARKER.how}。{DRILL_MARKER.why}。
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
        </>
      )}
    </section>
  );
}

/* ================================ ⑧ 收口日：一份别人照着能用的 runbook（D5，8/21） */

/**
 * 第八块，8/21 建成。它和前七块不同型：前七块的产出是**改动**，这一块的产出是
 * **可被复用的判断**——所以它的验收句是「不看笔记，按 runbook 走通两类故障」。
 *
 * 与 ⑤ 的分页不是一回事：⑤ 那三页拆的是一块内容怎么呈现，这里是真的多建成了一块，
 * 所以板尾的建构进度从七块变成八块。
 *
 * 三页各回答一个问题，版面各自承载一处结论：
 *   ⑧·1 首查把范围分成两支，三类各自落位——落不进任何一支的那一类，画出来就是一个断点
 *   ⑧·2 两条轨道从头贯到尾，而「翻笔记」这种记号一个都没有
 *   ⑧·3 同一天的两条收尾，一条走满四段，另一条断在最后一段——终点不一样长
 */
type RunbookPart = "cut" | "selftest" | "strength";

const RUNBOOK_PART_HEAD: Record<RunbookPart, { kicker: string; aria: string }> = {
  cut: { kicker: "first probe", aria: "首查命令的分流结果与适用边界" },
  selftest: { kicker: "delayed self-test", aria: "不看演练笔记完成两类 runbook 自测" },
  strength: { kicker: "evidence status", aria: "两项收尾工作的证据等级" },
};

function Runbook({ review, part }: { review: boolean; part: RunbookPart }) {
  const [revealed, setRevealed] = useState(!review);
  useEffect(() => {
    setRevealed(!review);
  }, [review]);

  const drillName = (id: string) => DRILLS.find((d) => d.id === id)?.name ?? id;
  const cells = RUNBOOK_ACCEPT.columns.length * RUNBOOK_ACCEPT.classCount;
  const missCount = CUT_LANDINGS.filter((l) => !l.cut).length;
  const evidenceMarks = SELF_TEST.runs.flatMap((r) => r.steps).filter((s) => s.mark === "evidence").length;

  return (
    <section className={`w10-runbook part-${part}`} aria-label={RUNBOOK_PART_HEAD[part].aria}>
      <div className="w6-section-head">
        <span>{RUNBOOK_PART_HEAD[part].kicker}</span>
        <h3>
          {part === "cut"
            ? "服务器内直连健康检查可区分反代与应用故障，但无法识别资源告警"
            : part === "selftest"
              ? `不看演练笔记走通两类故障，全程 ${SELF_TEST.flips} 次翻笔记`
              : "两项收尾的证据等级不同：一项已实测，一项待验证"}
        </h3>
      </div>

      {review && !revealed ? (
        <div className="w10-recall">
          <p>
            延迟自测在真注入后的第二天进行。全程不看演练笔记，以 runbook 作为排障入口，
            检验手册能否独立支持两类故障处理。
          </p>
          <p className="w10-recall-ask">
            {part === "cut" ? (
              <>首查命令能区分哪些故障，又无法识别哪一类？</>
            ) : part === "selftest" ? (
              <>现有记录能支持什么结论，自测还缺少哪项证据？</>
            ) : (
              <>磁盘判据与假 active 的证据分别支持哪个结论等级？</>
            )}
          </p>
          <button type="button" className="w10-reveal-gate" onClick={() => setRevealed(true)}>
            {part === "cut" ? "查看首查命令与分流结果" : part === "selftest" ? "查看两类延迟自测" : "查看两项收尾的证据等级"}
          </button>
        </div>
      ) : part === "cut" ? (
        <>
          <div className="w10-verdict">
            <div>
              <strong>1</strong>
              <span>条首查命令：服务器内直连健康检查，可区分公网症状相同的反代故障与应用故障</span>
            </div>
            <div className="alert">
              <strong>{missCount}</strong>
              <span>类无法识别：资源逼近告警线时，健康检查仍可返回 200</span>
            </div>
            <div className="good">
              <strong>{cells}</strong>
              <span>格五列齐全（{RUNBOOK_ACCEPT.classCount} 类 × {RUNBOOK_ACCEPT.columns.join(" / ")}）</span>
            </div>
          </div>

          {/* 空间编码：判定点在上，两支在下，三类故障各自落在自己那一支里。
              落不进任何一支的那一类画成断点（虚线卡 + 一条向下接到补位信号的连线）——
              「这一条首查区分不出它」因此是看出来的，不是读出来的。 */}
          <div
            className="w10-cut"
            role="group"
            aria-label={`首查命令是${FIRST_CUT.probe}：${FIRST_CUT.branches
              .map((b) => `${b.verdict} 走${b.goes}`)
              .join("；")}；${drillName(CUT_BLIND_EDGE.drill)}无法由该检查识别，改看${CUT_BLIND_EDGE.standIn}`}
          >
            <div className="w10-cut-probe">
              <div className="w10-cut-probe-head">
                <span>首查命令</span>
                <GradeChip grade={FIRST_CUT.grade} />
              </div>
              <strong>{FIRST_CUT.probe}</strong>
              <p>{FIRST_CUT.why}</p>
            </div>

            <div className="w10-cut-branches">
              {FIRST_CUT.branches.map((b) => {
                const landings = CUT_LANDINGS.filter((l) => l.branch === b.id);
                return (
                  <article key={b.id} className={`w10-cut-branch branch-${b.id}`}>
                    <header>
                      <b>{b.verdict}</b>
                      <span>{b.goes}</span>
                    </header>
                    <ul className="w10-cut-landings">
                      {landings.map((l) => (
                        <li key={l.drill} className={l.cut ? "" : "miss"}>
                          <strong>
                            {drillName(l.drill)}
                            {!l.cut && <em>健康检查无法识别</em>}
                          </strong>
                          <small>{l.reads}</small>
                        </li>
                      ))}
                    </ul>
                    {landings.some((l) => !l.cut) && (
                      <div className="w10-cut-standin">
                        <span>补充检查</span>
                        <strong>{CUT_BLIND_EDGE.standIn}</strong>
                        <small>{CUT_BLIND_EDGE.why}</small>
                      </div>
                    )}
                    <p className="w10-cut-next">
                      <span>后续检查</span>
                      {b.next}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="w10-cut-second">
            <div className="w10-cut-second-q">
              <span>公网范围检查</span>
              {SECOND_CUT.question}
            </div>
            <div className="w10-cut-second-grid">
              {[SECOND_CUT.all, SECOND_CUT.single].map((s) => (
                <p key={s.label}>
                  <span>{s.label}</span>
                  {s.goes}
                </p>
              ))}
            </div>
          </div>

          <p className="w10-note" role="note">
            {SECOND_CUT.note}。D5 口述时删除了“公共上游配置错误”这一排查项，因为本机不存在公共上游实体。
            保留不存在的排查对象会误导后续定位。
          </p>

          <p className="w10-note" role="note">
            判定分叉必须可证伪：{RUNBOOK_ACCEPT.forkRule}。{RUNBOOK_ACCEPT.quickRef}。
          </p>
        </>
      ) : part === "selftest" ? (
        <>
          <div className="w10-verdict">
            <div className="good">
              <strong>{SELF_TEST.runs.length}</strong>
              <span>类走通：各自从症状一路走到基线恢复，每类都留下了命令输出</span>
            </div>
            <div className="zero">
              <strong>{SELF_TEST.flips}</strong>
              <span>次翻笔记：两类自测都没有翻阅演练笔记</span>
            </div>
            <div className="alert">
              <strong>1</strong>
              <span>处停顿：排障流程未中断，停在演练注入量计算；该内容不属于排障 runbook</span>
            </div>
          </div>

          {/* 空间编码：一类一条轨道，节点按时间从左到右。两条都贯到最右端 = 两类都走通；
              轨道上的记号只有三种（留下输出 / 退回来一次 / 算错了），「翻笔记」那一种一次都没出现。
              类 3 中间那一个退回记号，就是「触止步 → 止损 → 重来」——它是位置上看得见的一次折返。 */}
          <div
            className="w10-runs"
            role="group"
            aria-label={`两类延迟自测各包含 ${SELF_TEST.runs[0].steps.length} 个步骤，均完成基线恢复；全程 ${SELF_TEST.flips} 次翻阅演练笔记`}
          >
            {SELF_TEST.runs.map((run) => (
              <article key={run.drill} className="w10-run">
                <header className="w10-run-head">
                  <strong>{drillName(run.drill)}</strong>
                  <GradeChip grade={SELF_TEST.grade} />
                </header>
                <ol
                  className="w10-run-track"
                  style={{ ["--w10-run-steps" as string]: run.steps.length }}
                >
                  {run.steps.map((s, i) => (
                    <li key={s.label} className={`w10-run-step${s.mark ? ` mark-${s.mark}` : ""}`}>
                      <i aria-hidden="true">{s.mark === "back" ? "↩" : s.mark === "wrong" ? "✕" : s.mark === "evidence" ? "●" : i + 1}</i>
                      <b>{s.label}</b>
                      <p>{s.text}</p>
                      {"at" in s && s.at ? <u>{s.at}</u> : null}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>

          <p className="w10-run-legend">
            <b>●</b> 表示已保留命令输出（共 {evidenceMarks} 处）；<b>↩</b> 表示回退一次；
            <b>✕</b> 表示计算错误。空心数字表示步骤已执行，但当天未单独保留输出。
            两类自测全程没有翻阅演练笔记。{SELF_TEST.rule}。
          </p>

          <div className="w10-stuck">
            <div className="w10-stuck-head">
              <span>自测中的 1 处停顿</span>
              <strong>{SELF_TEST.stuck.where}</strong>
            </div>
            <p className="w10-stuck-why">
              <span>runbook 范围</span>
              {SELF_TEST.stuck.why}
            </p>
            <p className="w10-stuck-how">
              <span>处理方式</span>
              {SELF_TEST.stuck.how}
            </p>
            <p className="w10-stuck-verdict">
              <span>结论</span>
              {SELF_TEST.stuck.verdict}
            </p>
          </div>

          <p className="w10-note" role="note">
            <b>这次自测的记录缺口：</b>
            {SELF_TEST.unrecorded}。
          </p>

          <details className="w10-pick board-fold">
            <summary>
              <span className="board-fold-kicker">test selection</span>
              <strong>
                自测选择：{SELF_TEST.pick.ranIds.map(drillName).join(" 与 ")}；
                {drillName(SELF_TEST.pick.droppedId)}未重复注入
              </strong>
            </summary>
            <p>
              <span>选择依据</span>
              {SELF_TEST.pick.why}
            </p>
            <p>
              <span>未重复注入假 active 的原因</span>
              {SELF_TEST.pick.droppedWhy}
            </p>
            <p className="w10-pick-changed">
              <span>与 D4 计划的差异</span>
              {SELF_TEST.pick.changedFrom}
            </p>
          </details>
        </>
      ) : (
        <>
          <div className="w10-verdict">
            <div className="good">
              <strong>{CLOSEOUT_TRACKS.filter((t) => t.end === "measured").length}</strong>
              <span>项完成四段验证：判据修改后，同类条件触发了红色结果</span>
            </div>
            <div className="alert">
              <strong>{CLOSEOUT_TRACKS.filter((t) => t.end !== "measured").length}</strong>
              <span>项在 8/21 历史快照停于 pending；后续结论见下方接力</span>
            </div>
            <div className="zero">
              <strong>0</strong>
              <span>次生产同类注入：唯一生产机保留未验证边界</span>
            </div>
          </div>

          <FakeActiveRelay />

          {/* 空间编码：两条同样分四段的轨道并排。走满的那条四段都实心，
              断掉的那条最后一段是空心且连线断开——「结论强度不一样」因此是长度差，不是形容词。 */}
          <div
            className="w10-strength"
            role="group"
            aria-label={CLOSEOUT_TRACKS.map(
              (t) => `${t.subject}走到第 ${t.steps.findIndex((x) => x.broken) === -1 ? t.steps.length : t.steps.findIndex((x) => x.broken)} 段之后${t.endText}`,
            ).join("；")}
          >
            {CLOSEOUT_TRACKS.map((t) => (
              <article key={t.id} className={`w10-strength-track end-${t.end}`}>
                <header>
                  <strong>{t.subject}</strong>
                  <GradeChip grade={t.end} />
                </header>
                <p className="w10-strength-ask">{t.ask}</p>
                <ol>
                  {t.steps.map((s, i) => (
                    <li key={s.label} className={s.broken ? "broken" : ""}>
                      <i aria-hidden="true">{s.broken ? "?" : i + 1}</i>
                      <b>{s.label}</b>
                      <p>{s.text}</p>
                    </li>
                  ))}
                </ol>
                <p className="w10-strength-end">
                  <span>证据结论</span>
                  {t.endText}
                </p>
              </article>
            ))}
          </div>

          {/* 同一个落点，两把尺，两个结论。尺的窗口是 3–4.5 GiB（写在轴上），
              红线与止步线按数值定位，中间那一段就是「够不着的红」。 */}
          <div
            className="w10-band"
            role="group"
            aria-label={`可用空间 ${ROUNDING_BAND.observed.value} ${ROUNDING_BAND.unit}，位于${ROUNDING_BAND.stop.label}与${ROUNDING_BAND.redline.label}之间：${ROUNDING_BAND.rules
              .map((r) => `${r.name}得出${r.verdict === "red" ? "红" : "绿"}`)
              .join("，")}`}
          >
            <div className="w10-band-head">
              <strong>同一可用空间，旧判据与新判据得出不同结果</strong>
              <small>
                比较范围 {ROUNDING_BAND.window.from}–{ROUNDING_BAND.window.to} {ROUNDING_BAND.unit}
              </small>
            </div>
            {ROUNDING_BAND.rules.map((r) => {
              const pct = (v: number) =>
                `${(((v - ROUNDING_BAND.window.from) / (ROUNDING_BAND.window.to - ROUNDING_BAND.window.from)) * 100).toFixed(1)}%`;
              return (
                <div key={r.id} className={`w10-band-row verdict-${r.verdict}`}>
                  <div className="w10-band-label">
                    <b>{r.name}</b>
                    <em>{r.when}</em>
                  </div>
                  <div
                    className="w10-band-track"
                    style={{
                      ["--w10-band-from" as string]: pct(ROUNDING_BAND.stop.value),
                      ["--w10-band-to" as string]: pct(ROUNDING_BAND.redline.value),
                      ["--w10-band-dot" as string]: pct(ROUNDING_BAND.observed.value),
                    }}
                  >
                    <i className="w10-band-fill" aria-hidden="true" />
                    <i className="w10-band-dot" aria-hidden="true" />
                    <span className="w10-band-stop">{ROUNDING_BAND.stop.label}</span>
                    <span className="w10-band-red">{ROUNDING_BAND.redline.label}</span>
                    <span className="w10-band-obs">
                      {ROUNDING_BAND.observed.value} {ROUNDING_BAND.unit}
                    </span>
                  </div>
                  <div className="w10-band-read">
                    <b>{r.verdict === "red" ? "红" : "绿"}</b>
                    <small>{r.reading}</small>
                  </div>
                </div>
              );
            })}
            <p className="w10-band-note">{ROUNDING_BAND.band}。</p>
          </div>

          <div className="w10-takeaway">
            <strong>{WEEK_TAKEAWAY.line}</strong>
            <p>{WEEK_TAKEAWAY.why}</p>
            <p className="w10-takeaway-so">{WEEK_TAKEAWAY.so}</p>
          </div>

          <details className="w10-fix board-fold">
            <summary>
              <span className="board-fold-kicker">historical plan · 2026-08-21</span>
              <strong>W10 当时的修复方向与暂停理由</strong>
            </summary>
            <p>
              <span>方向</span>
              {FAKEACTIVE_FIX.direction}
            </p>
            <p>
              <span>实施注意</span>
              {FAKEACTIVE_FIX.care}
            </p>
            <p className="w10-fix-hold">
              <span>暂不实施的原因</span>
              {FAKEACTIVE_FIX.hold}
            </p>
          </details>
        </>
      )}
    </section>
  );
}

function FakeActiveRelay() {
  return (
    <div
      className="w10-fakeactive-relay"
      aria-label="假 active 从 W10 pending 到 W11 定论的证据接力"
      data-anchor="8 月 21 日历史 pending 接到 8 月 27 日同形实验、修复与未验证生产边界"
    >
      <div className="w10-fakeactive-time">
        {[FAKEACTIVE_FOLLOWUP.historical, FAKEACTIVE_FOLLOWUP.current].map((item, index) => (
          <Fragment key={item.at}>
            {index > 0 ? <i aria-hidden="true">→</i> : null}
            <article>
              <header><span>{item.at}</span><GradeChip grade={item.grade} /></header>
              <strong>{item.label}</strong>
              <p>{item.conclusion}</p>
            </article>
          </Fragment>
        ))}
      </div>
      <div className="w10-fakeactive-grades">
        {FAKEACTIVE_FOLLOWUP.grades.map((item) => (
          <article key={item.id} className={item.id}>
            <header><strong>{item.level}</strong><GradeChip grade={item.grade} /></header>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 阶段进度 */

/**
 * 这块进度表的原用途是「不把做了两块呈现成 W10 已经做完」。
 * 8/21 D5 收口后八块全部落地，计数由数据算出（当前 8/8），因此它现在的用途变成
 * 「哪一块是哪天建成的、为什么按这个顺序展示」。
 */
function StagePlan() {
  const done = W10_STAGE_PLAN.filter((s) => s.done).length;
  return (
    <details className="w10-stage-plan board-fold" aria-label="本板建构进度">
      <summary>
        <span className="board-fold-kicker">board roadmap</span>
        <strong>
          W10 展板：{done}/{W10_STAGE_PLAN.length} 块已完成
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
        展示顺序按事实稳定时间排列。⑥ 在 D3-D5 期间未再变更，因此最先展示。
        ④ 在 D3 获得三项阈值的实测证据后建立。⑦ 在 D3 检查脚本上线并完成红态验证后新增。
        ⑤ 在 8/20 完成三类故障注入后建立，其中两类首个症状预测被实测推翻。
        ⑧ 于 8/21 建成，将前七块的改动整理为可复用的排障判断。范围与口径边界见 <code>week10-visualization-plan.md</code>。
        <br />
        ⑤ 和 ⑧ 各包含三个专题页；建构进度按内容块计数，因此共有 8 块内容、12 个专题页。
      </p>
    </details>
  );
}
