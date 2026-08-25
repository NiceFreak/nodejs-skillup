// W11 发布流水线板 · 阶段 1 三页：⑥·1 契约层、⑥·2 机制层、② 五阶段失败面。
// 展示资产（AGENTS.md 白名单）。
//
// 为什么先做 ⑥ 的两页：八块里只有这两块在 D3–D5 不会再改，D1 那六条与 D2 那五条都已发生完。
// ③④⑤⑦ 的格子会在 D3 / D4 当天翻档，先做的会先过时。
//
// 为什么 ⑥ 是两页：两批自纠的发现方式不同族。⑥·1 全部来自人工推演与核对，
// ⑥·2 每条都要一条命令的输出才能确认，合成一页会把两种判断方式混为一谈。
//
// 结论由版面承载（roadmap 第八 / 第九轮判据）：
//   ⑥·1  六行 × 五种发现方式的矩阵，自动检查那一列 0 个标记
//   ⑥·2  七个分组共用一把尺的条形图，流水线逻辑那一条长度为 0
//   ②    五阶段横轴上，唯一在服务器执行的阶段与唯一的中间态格子在同一列
// 正文按渐进层级折叠：每条自纠的机制与修正默认收起，避免首屏堆叠长段落。
//
// 本板没有主动回忆的复习门：问句属学习材料，按方法稿 §12 决策 4 由本人定稿。
import { useEffect, useState } from "react";
import { HBarChart } from "./charts";
import {
  LOGIC_BUCKET_ID,
  PAPER_CATCHER,
  RUNTIME_KIND,
  SELF_CHECKS_CONTRACT,
  SELF_CHECKS_RUNTIME,
  SERVER_STATE,
  STAGES,
  STAGE_CAVEATS,
  UNPLANNED_BUCKETS,
  UNPLANNED_LOGIC_COUNT,
  UNPLANNED_TOTAL,
  UNTOUCHED_SPAN,
  W11_GRADE,
  W11_SIDE,
  W11_STAGE_PLAN,
  ZERO_CHANGE,
  criterionCount,
  gradeCounts,
  machineCaughtCount,
  riskStageCount,
} from "./w11Facts";
import type { PaperCatcher, W11Grade } from "./w11Facts";
import { tabKeyDown } from "./tabs";
import type { BoardMode } from "./types";

/** 已落地的三块。其余五块在 W11_STAGE_PLAN 里按待做呈现，不进这个切换器。 */
const W11_TOPICS = W11_STAGE_PLAN.filter((s) => s.done).map((s) => ({
  id: s.id,
  label: s.title,
  question: s.question,
}));

const TOPIC_TAB_IDS = W11_TOPICS.map((t) => `w11-topic-tab-${t.id}`);

export default function W11Board({
  topic,
  onTopicChange,
}: {
  mode: BoardMode;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const activeIndex = Math.max(0, W11_TOPICS.findIndex((t) => t.id === topic));
  const active = W11_TOPICS[activeIndex];

  return (
    <div className="w11-board">
      <header className="w6-head">
        <div>
          <span>W11 · Release pipeline</span>
          <h2>把一次发布交给机器执行，需要先写下哪些判据</h2>
          <p>
            8/24 冻结发布契约：五个阶段、部署身份与权限清单、回滚判据与部署后验证清单，共 18 条决策。
            8/25 装起 controller，跑通只构建与测试的三个阶段，完成变红实验与轮询自动触发。
            服务器在整个过程中保持零改动，由前后两次七项只读基线对照确认。
            部署段与回滚仍是纸面契约。每条事实均标明已实测、已拍板或待做。
          </p>
        </div>
        <div className="w11-head-right">
          <GradeCount />
        </div>
      </header>

      <div
        className="w11-topic-switch"
        role="tablist"
        aria-label="W11 专题"
        onKeyDown={tabKeyDown(TOPIC_TAB_IDS, activeIndex, (i) => onTopicChange(W11_TOPICS[i].id))}
      >
        {W11_TOPICS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            id={`w11-topic-tab-${item.id}`}
            role="tab"
            aria-selected={i === activeIndex}
            aria-controls="w11-topic-panel"
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

      <div id="w11-topic-panel" role="tabpanel" aria-labelledby={`w11-topic-tab-${active.id}`}>
        {active.id === "selfcheck-runtime" ? (
          <RuntimeLayer />
        ) : active.id === "stages" ? (
          <Stages />
        ) : (
          <ContractLayer />
        )}
      </div>

      <StagePlan />
    </div>
  );
}

/* ------------------------------------------------------------------ 档位语法 */

function GradeChip({ grade }: { grade: W11Grade }) {
  return <span className={`w11-grade-chip ${grade}`}>{W11_GRADE[grade].label}</span>;
}

/** 板头计数由数据算出，不手写：它同时说明这块板有多少内容仍是纸面契约。 */
function GradeCount() {
  const counts = gradeCounts();
  return (
    <div className="w11-grade-count">
      <strong>
        {counts.measured} 已实测 · {counts.contract} 已拍板 · {counts.pending} 待做
      </strong>
      <small>只统计已落地三页中的事实；未落地的五块见页尾进度</small>
    </div>
  );
}

function GradeLegend() {
  const grades = Object.keys(W11_GRADE) as W11Grade[];
  return (
    <details className="w11-grade-legend board-fold" aria-label="证据档位说明">
      <summary>
        <span className="board-fold-kicker">evidence status</span>
        <strong>每条事实均标明当前证据状态</strong>
      </summary>
      <div className="w11-grade-legend-grid">
        {grades.map((grade) => (
          <article key={grade} className={`w11-grade-${grade}`}>
            <GradeChip grade={grade} />
            <p>{W11_GRADE[grade].meaning}</p>
          </article>
        ))}
      </div>
      <p className="w11-grade-legend-note" role="note">
        已拍板指已经作出的决定，修改它等于修改决策；待做指尚未取得的事实。
        部署段目前整段属于已拍板。
      </p>
    </details>
  );
}

/* ------------------------------------------------- 自纠条目的渐进层级（共用） */

function ExpandAll({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="w11-expand-all" onClick={onToggle} aria-expanded={open}>
      {open ? "收起全部机制与修正" : "展开全部机制与修正"}
    </button>
  );
}

/* ====================================================== ⑥·1 契约层（代表页之一） */

const PAPER_ORDER: PaperCatcher[] = ["conflict", "fact", "mechanism", "source"];

function ContractLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  return (
    <section className="w11-contract" aria-label="契约冻结当天的六条自纠">
      <div className="w6-section-head">
        <span>contract self-check</span>
        <h3>契约冻结当天记录 6 条自纠，自动检查发现 0 条</h3>
      </div>

      <p className="w11-lead">
        6 条都属于两条条款各自成立、合起来不成立。发现它们时流水线尚未搭建，契约不是任何工具的输入。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{SELF_CHECKS_CONTRACT.length}</strong>
          <span>条自纠记录于契约冻结当天</span>
        </div>
        <div>
          <strong>{PAPER_ORDER.length}</strong>
          <span>种发现方式，均为人工推演与核对</span>
        </div>
        <div className="zero">
          <strong>{machineCaughtCount()}</strong>
          <span>条由自动检查发现</span>
        </div>
      </div>

      {/* 分类用矩阵（roadmap 第九轮判据）：六行各落一个标记，自动检查那一列没有标记。
          列脚合计由数据算出，图与数字对不上时断言先报。 */}
      <div className="w11-matrix-wrap">
        <table className="w11-matrix">
          <caption>按发现方式分布：左侧四列为人工手段，最右一列为自动检查</caption>
          <thead>
            <tr>
              <th scope="col">自纠条目</th>
              {PAPER_ORDER.map((key) => (
                <th key={key} scope="col">
                  {PAPER_CATCHER[key]}
                </th>
              ))}
              <th scope="col" className="w11-col-auto">
                自动检查
              </th>
            </tr>
          </thead>
          <tbody>
            {SELF_CHECKS_CONTRACT.map((item) => (
              <tr key={item.id}>
                <th scope="row">
                  <b>{item.tag}</b>
                  {item.title}
                </th>
                {PAPER_ORDER.map((key) => (
                  <td key={key} className={item.caughtBy === key ? "hit" : ""}>
                    {item.caughtBy === key ? (
                      <i className="w11-dot" aria-label={PAPER_CATCHER[key]} />
                    ) : null}
                  </td>
                ))}
                <td className="w11-col-auto" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">合计</th>
              {PAPER_ORDER.map((key) => (
                <td key={key}>{SELF_CHECKS_CONTRACT.filter((c) => c.caughtBy === key).length}</td>
              ))}
              <td className="w11-col-auto w11-zero-cell">{machineCaughtCount()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="w11-matrix-note">
        标记上的编号取自契约中的自查编号。两条没有编号的条目用短横线表示，它们是起草与核对时追加的。
      </p>

      <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

      <ol className="w11-correction-list">
        {SELF_CHECKS_CONTRACT.map((item) => (
          <li key={item.id} className="w11-correction">
            <details open={open}>
              <summary>
                <b aria-hidden="true">{item.tag}</b>
                <strong>{item.title}</strong>
                <span className="w11-catcher-chip">{PAPER_CATCHER[item.caughtBy]}</span>
                <GradeChip grade={item.grade} />
              </summary>
              <div className="w11-correction-body">
                <p className="w11-correction-initial">
                  <span>原判断</span>
                  {item.initial}
                </p>
                <p className="w11-correction-mech">
                  <span>实际机制</span>
                  {item.mechanism}
                </p>
                <p className="w11-correction-fix">
                  <span>修正方式</span>
                  {item.fix}
                </p>
                <p className="w11-correction-catch">
                  <span>发现方式</span>
                  {item.caughtDetail}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>

      <p className="w11-note" role="note">
        与下一页的分界：本页记录的是流水线搭建之前，依据契约条款之间的一致性作出的判断；
        下一页记录的是流水线运行之后，依据命令输出作出的判断。
      </p>
    </section>
  );
}

/* ====================================================== ⑥·2 机制层（代表页之一） */

function RuntimeLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const criteria = SELF_CHECKS_RUNTIME.filter((c) => c.kind === "criterion");
  const costs = SELF_CHECKS_RUNTIME.filter((c) => c.kind === "cost");
  const chartData = UNPLANNED_BUCKETS.map((bucket) => ({
    label: bucket.label,
    value: bucket.n,
    detail: (
      <div className="w11-tip">
        <strong>
          {bucket.label} · {bucket.n} 条
        </strong>
        <span>{bucket.detail}</span>
      </div>
    ),
  }));

  return (
    <section className="w11-runtime" aria-label="执行当天的十四条计划外事件">
      <div className="w6-section-head">
        <span>runtime self-check</span>
        <h3>执行当天记录 14 条计划外事件，流水线逻辑相关 0 条</h3>
      </div>

      <p className="w11-lead">
        阶段划分与每阶段的入口动作一次通过，未在执行当天修改。
        当天的时间消耗在构建环境与工具的实际行为上。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{UNPLANNED_TOTAL}</strong>
          <span>条计划外事件</span>
        </div>
        <div className="zero">
          <strong>{UNPLANNED_LOGIC_COUNT}</strong>
          <span>条与流水线逻辑相关</span>
        </div>
        <div>
          <strong>{criterionCount()}</strong>
          <span>条属判据级：更换工具后仍会出现</span>
        </div>
      </div>

      {/* 七个分组共用一把尺：流水线逻辑那一条长度为 0，与其余六组直接可比。 */}
      <div className="w11-chart" data-logic-bucket={LOGIC_BUCKET_ID}>
        <HBarChart data={chartData} valueFormat={(v) => `${v} 条`} />
      </div>
      <p className="w11-matrix-note">
        分组按成本落点划分，合计等于 {UNPLANNED_TOTAL} 条。指向条目明细见下方折叠区。
      </p>

      <details className="w11-buckets board-fold">
        <summary>
          <span className="board-fold-kicker">event grouping</span>
          <strong>六个分组各包含哪些事件</strong>
        </summary>
        <ul className="w11-bucket-list">
          {UNPLANNED_BUCKETS.filter((b) => b.n > 0).map((bucket) => (
            <li key={bucket.id} className="w11-bucket">
              <div className="w11-bucket-head">
                <strong>{bucket.label}</strong>
                <b>{bucket.n} 条</b>
              </div>
              <p>{bucket.detail}</p>
            </li>
          ))}
        </ul>
      </details>

      <div className="w6-section-head w11-sub-head">
        <span>transferable criteria</span>
        <h3>判据级三条：每条都需要一条命令的输出才能确认</h3>
      </div>

      <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

      <ol className="w11-correction-list">
        {criteria.map((item) => (
          <li key={item.id} className="w11-correction runtime">
            <details open={open}>
              <summary>
                <b aria-hidden="true">{RUNTIME_KIND[item.kind]}</b>
                <strong>{item.title}</strong>
                <span className="w11-command-chip">{item.command}</span>
                <GradeChip grade={item.grade} />
              </summary>
              <div className="w11-correction-body">
                <p className="w11-correction-initial">
                  <span>原判断</span>
                  {item.initial}
                </p>
                <p className="w11-correction-mech">
                  <span>实际机制</span>
                  {item.mechanism}
                </p>
                <p className="w11-correction-fix">
                  <span>处理方式</span>
                  {item.fix}
                </p>
                <p className="w11-correction-command">
                  <span>该验证项的来历</span>
                  {item.commandNote}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">high cost items</span>
          <strong>另外两条不属判据级，但当天耗时最长</strong>
        </summary>
        <ol className="w11-correction-list">
          {costs.map((item) => (
            <li key={item.id} className="w11-correction runtime cost">
              <div className="w11-correction-head">
                <b aria-hidden="true">{RUNTIME_KIND[item.kind]}</b>
                <strong>{item.title}</strong>
                <span className="w11-command-chip">{item.command}</span>
                <GradeChip grade={item.grade} />
              </div>
              <div className="w11-correction-body">
                <p className="w11-correction-initial">
                  <span>原判断</span>
                  {item.initial}
                </p>
                <p className="w11-correction-mech">
                  <span>实际机制</span>
                  {item.mechanism}
                </p>
                <p className="w11-correction-fix">
                  <span>处理方式</span>
                  {item.fix}
                </p>
                <p className="w11-correction-command">
                  <span>该验证项的来历</span>
                  {item.commandNote}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

/* ============================================================ ② 五阶段的失败面 */

function Stages() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const measured = STAGES.filter((s) => s.grade === "measured").length;

  return (
    <section className="w11-stages-block" aria-label="五个阶段各自的失败面">
      <div className="w6-section-head">
        <span>stage failure states</span>
        <h3>五个阶段中，只有在服务器上执行的第 4 阶段会留下中间态</h3>
      </div>

      <p className="w11-lead">
        阶段的执行位置决定它失败时服务器处于什么状态。前三个阶段全部在 controller 执行，
        因此失败时服务器保持上一轮部署的版本。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{STAGES.length}</strong>
          <span>个阶段，一次提交依次经过</span>
        </div>
        <div>
          <strong>{measured}</strong>
          <span>个阶段已有构建记录，其余为纸面契约</span>
        </div>
        <div className="alert">
          <strong>{riskStageCount()}</strong>
          <span>个阶段失败时服务器可能处于中间态</span>
        </div>
      </div>

      {/* 横轴：左侧 controller、右侧服务器，分界线从第 4 阶段内部穿过（该阶段发起在
          controller、落点在服务器）。它下方的中间态格子与它同列。 */}
      <div className="w11-rail" aria-label="五个阶段的执行位置与失败时的服务器状态">
        <div className="w11-rail-sides" aria-hidden="true">
          <span className="left">{W11_SIDE.controller}</span>
          <span className="right">{W11_SIDE.server}</span>
        </div>

        <ol className="w11-stage-row">
          {STAGES.map((stage) => (
            <li key={stage.id} className={`w11-stage side-${stage.side}`}>
              <span className="w11-stage-n">{stage.n}</span>
              <strong>{stage.name}</strong>
              <small>{stage.side === "cross" ? W11_SIDE.cross : ""}</small>
            </li>
          ))}
        </ol>

        <div className="w11-state-row" aria-label="每个阶段失败时服务器处于什么状态">
          <div className="w11-state untouched" style={{ gridColumn: `span ${UNTOUCHED_SPAN}` }}>
            <strong>{SERVER_STATE.untouched.label}</strong>
            <span>{SERVER_STATE.untouched.detail}</span>
          </div>
          <div className="w11-state w11-stage-risk">
            <strong>{SERVER_STATE.risk.label}</strong>
            <span>{SERVER_STATE.risk.detail}</span>
          </div>
          <div className="w11-state deployed">
            <strong>{SERVER_STATE.deployed.label}</strong>
            <span>{SERVER_STATE.deployed.detail}</span>
          </div>
        </div>
      </div>

      <p className="w11-rail-note">
        前 {UNTOUCHED_SPAN} 个阶段共用同一段状态，原因相同：动作都没有到达服务器。
      </p>

      <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

      <ol className="w11-stage-list">
        {STAGES.map((stage) => (
          <li key={stage.id} className={`w11-stage-item side-${stage.side}`}>
            <details open={open}>
              <summary>
                <b aria-hidden="true">{stage.n}</b>
                <strong>{stage.name}</strong>
                <span className="w11-side-chip">
                  {stage.side === "controller"
                    ? "controller"
                    : stage.side === "cross"
                      ? "controller 发起 · 服务器执行"
                      : "服务器"}
                </span>
                <GradeChip grade={stage.grade} />
              </summary>
              <div className="w11-stage-body">
                <div className="w11-stage-trio">
                  <p className="w11-stage-entry">
                    <span>执行动作</span>
                    {stage.entry}
                  </p>
                  <p className="w11-stage-fail">
                    <span>失败条件</span>
                    {stage.fail}
                  </p>
                  <p className="w11-stage-after">
                    <span>失败后的处理</span>
                    {stage.after}
                  </p>
                </div>
                {stage.evidence && (
                  <p className="w11-stage-evidence">
                    <span>实测证据</span>
                    {stage.evidence}
                  </p>
                )}
                {stage.caveat && (
                  <p className="w11-stage-caveat">
                    <span>尚未取得的证据</span>
                    {stage.caveat}
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>

      <details className="w11-limits board-fold">
        <summary>
          <span className="board-fold-kicker">test scope limits</span>
          <strong>Test 阶段通过之后，仍不能得出的两条结论</strong>
        </summary>
        {STAGE_CAVEATS.map((item) => (
          <p key={item.id} className="w11-limit">
            <b>{item.title}</b>
            {item.body}
          </p>
        ))}
      </details>

      <details className="w11-zero board-fold">
        <summary>
          <span className="board-fold-kicker">server baseline diff</span>
          <strong>服务器零改动的对照方式与结果</strong>
        </summary>
        <p className="w11-zero-lead">
          装 controller 之前采集一次七项只读基线，九步执行完成后用同样的命令再采集一次，逐行比对。
        </p>
        <ul className="w11-zero-list">
          {ZERO_CHANGE.items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.baseline}</span>
            </li>
          ))}
        </ul>
        <p className="w11-zero-diff">
          <span>比对结果</span>
          {ZERO_CHANGE.diff}
        </p>
        <p className="w11-zero-lesson">
          <span>方法本身的粒度问题</span>
          {ZERO_CHANGE.lesson}
        </p>
      </details>
    </section>
  );
}

/* ------------------------------------------------------------------ 阶段进度 */

/** 剩余五块的材料要等 D3 / D4 / D5 才产生，先画等于把预测呈现为实测。 */
function StagePlan() {
  const done = W11_STAGE_PLAN.filter((s) => s.done).length;
  return (
    <details className="w11-stage-plan board-fold" aria-label="本板建构进度">
      <summary>
        <span className="board-fold-kicker">board roadmap</span>
        <strong>
          W11 展板：{done}/{W11_STAGE_PLAN.length} 块已完成
        </strong>
      </summary>
      <ul className="w11-plan-list">
        {W11_STAGE_PLAN.map((item) => (
          <li key={item.id} className={item.done ? "done" : "todo"}>
            <i aria-hidden="true">{item.done ? "✓" : "—"}</i>
            <strong>{item.title}</strong>
            <span>{item.question}</span>
            <em>{item.done ? "已落地" : item.when}</em>
          </li>
        ))}
      </ul>
      <p className="w11-plan-note">
        展示顺序按事实稳定时间排列。⑥ 的两页取自已经发生完的两批自纠，D3–D5 不再改动；
        ② 的前三个阶段在 8/25 取得构建记录，后两个阶段仍是纸面契约。
        其余五块的证据在部署段打通、回滚演练与收口日当天产生。
        范围与口径边界见 <code>week11-visualization-plan.md</code>。
      </p>
    </details>
  );
}
