// W11 发布流水线板 · 六页：⑥·1 契约层、⑥·2 机制层、⑥·3 冻结取值层、
// ② 五阶段失败面、③ 权限收窄、⑤ 验证覆盖。展示资产（AGENTS.md 白名单）。
//
// 阶段 1（8/25）落地前三页，阶段 2（8/26，D3 收口后）落地 ⑥·3 / ③ / ⑤ 并把部署段两阶段翻档。
// ④①⑦ 仍未开工：回滚三条路径要等演练，触发链路的终点在 D5 之前还会变。
//
// 为什么 ⑥ 是三页：三批自纠的发现方式不同族。⑥·1 全部来自人工推演与核对，
// ⑥·2 每条都要一条命令的输出才能确认，⑥·3 是已经写下并冻结的取值被实测推翻。
// 合成一页会把三种判断方式混为一谈；⑥·2 的条形图还钉着「十四条、逻辑相关零条」这个计数，
// 把 D3 的四条混进去会同时破坏计数与那一页的标题。
//
// 结论由版面承载（roadmap 第八 / 第九轮判据）：
//   ⑥·1  六行 × 五种发现方式的矩阵，自动检查那一列 0 个标记
//   ⑥·2  七个分组共用一把尺的条形图，流水线逻辑那一条长度为 0
//   ⑥·3  四行 × 四种依据的矩阵，空心标记为冻结时的依据，命令输出那一列的冻结侧合计为 0
//   ②    五阶段横轴上，唯一在服务器执行的阶段与唯一的中间态格子在同一列
//   ③    命令类别 × 收窄前后的矩阵，最后一列写明判定依据，有一行的依据不是限制规则
//   ⑤    七项 × 五层的覆盖矩阵，列合计行为结论，磁盘检查那一行整行没有标记
// 正文按渐进层级折叠：每条的机制与修正默认收起，避免首屏堆叠长段落。
//
// 本板没有主动回忆的复习门：问句属学习材料，按方法稿 §12 决策 4 由本人定稿。
import { useEffect, useState } from "react";
import { HBarChart } from "./charts";
import {
  FROZEN_BASIS,
  FROZEN_BASIS_ORDER,
  FROZEN_CHANGED,
  FROZEN_VALUES,
  LOGIC_BUCKET_ID,
  PAPER_CATCHER,
  RUNTIME_KIND,
  SELF_CHECKS_CONTRACT,
  SELF_CHECKS_RUNTIME,
  SERVER_STATE,
  STAGES,
  STAGE_CAVEATS,
  TRUST_BASIS,
  TRUST_CHANNELS,
  TRUST_CHECKS,
  TRUST_COST,
  TRUST_COUNTS,
  TRUST_PENDING,
  TRUST_ROWS,
  TRUST_VERDICT,
  UNPLANNED_BUCKETS,
  UNPLANNED_LOGIC_COUNT,
  UNPLANNED_TOTAL,
  UNTOUCHED_SPAN,
  VERIFY_CHECKS,
  VERIFY_LAYERS,
  VERIFY_NOTES,
  VERIFY_PENDING,
  W11_GRADE,
  W11_SIDE,
  W11_STAGE_PLAN,
  ZERO_CHANGE,
  criterionCount,
  frozenBasisCounts,
  frozenMeasuredAtFreeze,
  gradeCounts,
  layerCoverage,
  machineCaughtCount,
  noPasswordRows,
  riskStageCount,
  singleCoverageLayers,
  uncoveredChecks,
  verifySideCounts,
} from "./w11Facts";
import type { PaperCatcher, TrustVerdict, W11Grade } from "./w11Facts";
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
            8/25 装起 controller，跑通只构建与测试的三个阶段，服务器保持零改动，
            由前后两次七项只读基线对照确认。8/26 收窄部署身份的权限、完成第一次自动部署与部署后验证，
            并用一次注入证明日志扫描能够判红。回滚演练仍未进行。每条事实均标明已实测或待做。
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
        ) : active.id === "frozen-values" ? (
          <FrozenLayer />
        ) : active.id === "stages" ? (
          <Stages />
        ) : active.id === "trust" ? (
          <TrustLayer />
        ) : active.id === "verify" ? (
          <VerifyLayer />
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
      <small>
        只统计已落地 {W11_STAGE_PLAN.filter((s) => s.done).length} 页中的事实；
        未落地的 {W11_STAGE_PLAN.filter((s) => !s.done).length} 块见页尾进度
      </small>
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
        已拍板指已经作出的决定，修改它等于修改决策；待做指尚未取得的事实或尚未完成的动作。
        8/26 部署段两个阶段翻档为已实测，本板当前没有已拍板的条目，待做的三项写在各自页内。
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
      <div className="w11-matrix-wrap" data-anchor="按发现方式分布：自动检查那一列没有标记">
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
        <div
        className="w11-chart"
        data-logic-bucket={LOGIC_BUCKET_ID}
        data-anchor="七个分组共用一把尺：流水线逻辑那一条长度为 0"
      >
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
      <div
        className="w11-rail"
        data-anchor="五阶段横轴：唯一在服务器执行的阶段与唯一的中间态格子同列"
        aria-label="五个阶段的执行位置与失败时的服务器状态"
      >
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

/* ================================================ ③ 部署身份的权限收窄（D3） */

function TrustLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const conclusionRows = noPasswordRows();

  return (
    <section className="w11-trust" aria-label="权限收窄前后的可执行范围">
      <div className="w6-section-head">
        <span>privilege scope</span>
        <h3>
          收窄之后，仍有 {conclusionRows.length} 类命令的拒绝不来自任何一条限制规则
        </h3>
      </div>

      <p className="w11-lead">
        收窄前该登录身份可执行任意提权命令，来源是 {TRUST_COUNTS.beforeFiles} 个配置文件里的{" "}
        {TRUST_COUNTS.beforeEntries} 条免口令条目，外加 {TRUST_COUNTS.beforeGroupRules} 条用户组规则。
        收窄后分成两条通道：部署密钥只接受 {TRUST_COUNTS.forcedCommands} 条命令，
        个人密钥的提权动作比对 {TRUST_COUNTS.sudoWhitelist} 条白名单。两个数约束的不是同一条通道。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{TRUST_COUNTS.forcedCommands}</strong>
          <span>条命令：部署密钥通道接受的全部</span>
        </div>
        <div>
          <strong>{TRUST_COUNTS.sudoWhitelist}</strong>
          <span>条条目：个人密钥通道的提权白名单</span>
        </div>
        <div className="alert">
          <strong>{TRUST_PENDING.length}</strong>
          <span>项收窄尚未闭合，见页内待做条目</span>
        </div>
      </div>

      {/* 分类用矩阵：行是命令类别，两个列组是收窄前后，最后一列写明收窄后由什么决定。
          结论落在最后一列——有一行写的是账户无口令，那不是一条限制规则。 */}
      <div
        className="w11-matrix-wrap"
        data-anchor="收窄后的判定依据一列：有一行的依据是账户无口令，不是限制规则"
      >
        <table className="w11-matrix w11-trust-matrix">
          <caption>
            行为命令类别；左侧两列为收窄前，中间两列为收窄后，最后一列为收窄后的判定依据
          </caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                命令类别
              </th>
              <th scope="colgroup" colSpan={2} className="w11-group-before">
                收窄前
              </th>
              <th scope="colgroup" colSpan={2} className="w11-group-after">
                收窄后
              </th>
              <th scope="col" rowSpan={2} className="w11-col-basis">
                收窄后的判定依据
              </th>
            </tr>
            <tr>
              {TRUST_CHANNELS.map((ch) => (
                <th key={`before-${ch.id}`} scope="col" className="w11-group-before">
                  {ch.name}
                </th>
              ))}
              {TRUST_CHANNELS.map((ch) => (
                <th key={`after-${ch.id}`} scope="col" className="w11-group-after">
                  {ch.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRUST_ROWS.map((row) => (
              <tr key={row.id} className={row.basis === "no-password" ? "w11-row-flag" : ""}>
                <th scope="row">{row.name}</th>
                <TrustCell verdict={row.beforeDeployKey} group="before" />
                <TrustCell verdict={row.beforePersonalKey} group="before" />
                <TrustCell verdict={row.afterDeployKey} group="after" />
                <TrustCell verdict={row.afterPersonalKey} group="after" />
                <td className={`w11-col-basis ${row.basis === "no-password" ? "w11-basis-flag" : ""}`}>
                  {TRUST_BASIS[row.basis]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="w11-matrix-note">
        部署密钥那一列在收窄前整列没有取值：这条通道是收窄当天才建立的。
        部署链路需要的两条提权命令由服务器上的脚本在它自己的会话内调用，客户端无法直接发送它们。
      </p>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">command classes</span>
          <strong>逐类命令的判定依据与说明</strong>
        </summary>
        <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

      <ol className="w11-correction-list">
        {TRUST_ROWS.map((row) => (
          <li key={row.id} className={`w11-correction trust ${row.basis === "no-password" ? "flag" : ""}`}>
            <details open={open}>
              <summary>
                <strong>{row.name}</strong>
                <span className="w11-catcher-chip">
                  {row.afterDeployKey === "allow"
                    ? "部署密钥通道内"
                    : row.afterPersonalKey === "allow"
                      ? "提权白名单内"
                      : "两条通道均拒绝"}
                </span>
              </summary>
              <div className="w11-correction-body">
                <p className="w11-correction-mech">
                  <span>收窄后的判定依据</span>
                  {TRUST_BASIS[row.basis]}
                </p>
                <p>
                  <span>说明</span>
                  {row.detail}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>
      </details>

      <p className="w11-note" role="note">
        <b>收窄的代价落在手工运维上</b>
        {TRUST_COST}
      </p>

      <details className="w11-limits board-fold">
        <summary>
          <span className="board-fold-kicker">scope verification</span>
          <strong>收窄之后立即执行的 {TRUST_CHECKS.length} 项验证</strong>
        </summary>
        <p className="w11-zero-lead">
          没有被拒过的白名单，区分不了限制生效与限制未配置。越权验证用新建的连接执行，
          已登录的会话仍持有收窄前的用户组身份。
        </p>
        <ul className="w11-check-list">
          {TRUST_CHECKS.map((item) => (
            <li key={item.id}>
              <div className="w11-check-head">
                <strong>{item.name}</strong>
                <GradeChip grade={item.grade} />
              </div>
              <p className="w11-check-expect">
                <span>动手前写下的期望</span>
                {item.expect}
              </p>
              <p className="w11-check-actual">
                <span>实测</span>
                {item.actual}
              </p>
              {item.deviation && (
                <p className="w11-check-dev">
                  <span>偏差</span>
                  {item.deviation}
                </p>
              )}
            </li>
          ))}
        </ul>
      </details>

      <PendingList
        title="收窄尚未闭合的两项"
        kicker="open items"
        items={TRUST_PENDING.map((p) => ({ id: p.id, name: p.name, detail: p.detail, when: p.when, grade: p.grade }))}
      />
    </section>
  );
}

function TrustCell({ verdict, group }: { verdict: TrustVerdict; group: "before" | "after" }) {
  return (
    <td className={`w11-verdict-cell v-${verdict} w11-group-${group}`}>
      <i aria-hidden="true" className={`w11-verdict-mark m-${verdict}`} />
      <span>{TRUST_VERDICT[verdict].mark}</span>
    </td>
  );
}

/** ③ 与 ⑤ 共用的待做清单：待做项是节点，不是脚注。 */
function PendingList({
  title,
  kicker,
  items,
}: {
  title: string;
  kicker: string;
  items: Array<{ id: string; name: string; detail: string; when?: string; grade: W11Grade }>;
}) {
  return (
    <div className="w11-pending" aria-label={title}>
      <div className="w11-pending-head">
        <span className="board-fold-kicker">{kicker}</span>
        <strong>{title}</strong>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <div className="w11-check-head">
              <strong>{item.name}</strong>
              <GradeChip grade={item.grade} />
            </div>
            <p>{item.detail}</p>
            {item.when && (
              <p className="w11-pending-when">
                <span>条件</span>
                {item.when}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================ ⑤ 部署后验证的覆盖范围（D3） */

function VerifyLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const coverage = layerCoverage();
  const single = singleCoverageLayers();
  const uncovered = uncoveredChecks();
  const sides = verifySideCounts();

  return (
    <section className="w11-verify" aria-label="部署后验证的覆盖范围">
      <div className="w6-section-head">
        <span>coverage matrix</span>
        <h3>
          {VERIFY_CHECKS.length} 项验证里，{uncovered.length} 项不覆盖交付路径的任何一层，
          另有 {single.length} 层各自只有一项覆盖
        </h3>
      </div>

      <p className="w11-lead">
        交付路径分 {VERIFY_LAYERS.length} 层。每一项验证覆盖其中的哪几层由它实际做的事决定，
        与它的名字无关。列合计为 1 的那几层，删掉那一项该层就没有任何验证。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{sides.server}</strong>
          <span>项在服务器执行，需要一条能取回结果的通道</span>
        </div>
        <div>
          <strong>{sides.controller}</strong>
          <span>项在 controller 执行：经公网的那一次请求</span>
        </div>
        <div className="alert">
          <strong>{single.length}</strong>
          <span>层各自只有一项覆盖：{single.join("、")}</span>
        </div>
      </div>

      {/* 二维分类用矩阵，列合计由数据算出。磁盘检查那一行整行没有标记，
          它是资源前置条件，不在交付路径上。 */}
      <div className="w11-matrix-wrap" data-anchor="覆盖矩阵的列合计行：两层的合计是 1">
        <table className="w11-matrix w11-verify-matrix">
          <caption>行为验证项，列为交付路径的五层；最后一列写明每一项证明不了什么</caption>
          <thead>
            <tr>
              <th scope="col">验证项</th>
              <th scope="col" className="w11-col-side">
                执行侧
              </th>
              {VERIFY_LAYERS.map((layer) => (
                <th key={layer.id} scope="col">
                  {layer.name}
                </th>
              ))}
              <th scope="col" className="w11-col-cannot">
                它证明不了什么
              </th>
            </tr>
          </thead>
          <tbody>
            {VERIFY_CHECKS.map((check) => (
              <tr key={check.id} className={check.layers.length === 0 ? "w11-row-empty" : ""}>
                <th scope="row">{check.name}</th>
                <td className="w11-col-side">{check.side === "server" ? "服务器" : "controller"}</td>
                {VERIFY_LAYERS.map((layer) => (
                  <td key={layer.id} className={check.layers.includes(layer.id) ? "hit" : ""}>
                    {check.layers.includes(layer.id) ? (
                      <i className="w11-dot" aria-label={`覆盖${layer.name}`} />
                    ) : null}
                  </td>
                ))}
                <td className="w11-col-cannot">{check.cannot}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">每层的覆盖项数</th>
              <td className="w11-col-side">
                {sides.server}+{sides.controller}
              </td>
              {coverage.map((layer) => (
                <td key={layer.id} className={layer.n === 1 ? "w11-zero-cell" : ""}>
                  {layer.n}
                </td>
              ))}
              <td className="w11-col-cannot" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="w11-matrix-note">
        {uncovered.map((c) => c.name).join("、")}整行没有标记：它是部署能否继续的资源前置条件，
        不在交付路径上。数据库那一层的唯一一项使用本机默认连接，
        应用自己的数据库连接没有被任何一项走过——本地健康端点与本地业务接口都不查询数据库。
      </p>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">per check detail</span>
          <strong>逐项验证覆盖的层与它证明不了什么</strong>
        </summary>
        <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

      <ol className="w11-correction-list">
        {VERIFY_CHECKS.map((check) => (
          <li key={check.id} className={`w11-correction verify ${check.layers.length === 0 ? "flag" : ""}`}>
            <details open={open}>
              <summary>
                <strong>{check.name}</strong>
                <span className="w11-catcher-chip">
                  {check.side === "server" ? "服务器执行" : "controller 执行"}
                </span>
                <GradeChip grade={check.grade} />
              </summary>
              <div className="w11-correction-body">
                <p className="w11-correction-fix">
                  <span>覆盖的层</span>
                  {check.layers.length === 0
                    ? "不覆盖交付路径的任何一层"
                    : check.layers
                        .map((id) => VERIFY_LAYERS.find((l) => l.id === id)?.name ?? id)
                        .join("、")}
                </p>
                <p className="w11-correction-mech">
                  <span>它证明不了什么</span>
                  {check.cannot}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>
      </details>

      {VERIFY_NOTES.map((note) => (
        <p key={note.id} className="w11-note" role="note">
          <b>{note.title}</b>
          {note.body}
        </p>
      ))}

      <PendingList
        title="定为必验、但执行记录里没有结果的一项"
        kicker="open items"
        items={VERIFY_PENDING.map((p) => ({ id: p.id, name: p.name, detail: p.detail, grade: p.grade }))}
      />
    </section>
  );
}

/* ==================================== ⑥·3 冻结取值与实测的偏差（D3 新增一页） */

function FrozenLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const basisCounts = frozenBasisCounts();

  return (
    <section className="w11-frozen" aria-label="冻结取值与实测的偏差">
      <div className="w6-section-head">
        <span>frozen values</span>
        <h3>
          {FROZEN_VALUES.length} 条取值在冻结那一刻，依据是实测的有 {frozenMeasuredAtFreeze()} 条
        </h3>
      </div>

      <p className="w11-lead">
        这几条都是动手前冻结、执行当天被一条命令的输出改掉的。改的是依据、取值，或者两者。
        与前两页的分界：契约层记录条款之间的不一致，机制层记录检查通过但语义未生效，
        本页记录已经写下并冻结的取值本身被推翻。
      </p>

      {/* 与契约层同构的分布矩阵：每行两个标记，空心落在冻结时的依据，实心落在实测。
          冻结侧那一列的合计为 0，它就是标题那句话。 */}
      <div className="w11-matrix-wrap" data-anchor="依据分布：命令输出那一列的冻结侧合计为 0">
        <table className="w11-matrix w11-frozen-matrix">
          <caption>
            行为取值；列为依据类型。空心标记为冻结时的依据，实心标记为实测之后的依据
          </caption>
          <thead>
            <tr>
              <th scope="col">冻结的取值</th>
              {FROZEN_BASIS_ORDER.map((basis) => (
                <th key={basis} scope="col" className={basis === "measured" ? "w11-col-auto" : ""}>
                  {FROZEN_BASIS[basis]}
                </th>
              ))}
              <th scope="col" className="w11-col-basis">
                实测之后改了什么
              </th>
            </tr>
          </thead>
          <tbody>
            {FROZEN_VALUES.map((item) => (
              <tr key={item.id}>
                <th scope="row">
                  <b>{item.tag}</b>
                  {item.title}
                </th>
                {FROZEN_BASIS_ORDER.map((basis) => (
                  <td
                    key={basis}
                    className={`${basis === "measured" ? "w11-col-auto" : ""} ${
                      item.frozenBasis === basis ? "hit" : ""
                    }`}
                  >
                    {item.frozenBasis === basis ? (
                      <i className="w11-dot hollow" aria-label={`冻结时依据：${FROZEN_BASIS[basis]}`} />
                    ) : null}
                    {basis === "measured" ? (
                      <i className="w11-dot" aria-label="实测之后的依据：命令输出与构建记录" />
                    ) : null}
                  </td>
                ))}
                <td className="w11-col-basis">{FROZEN_CHANGED[item.changed]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">冻结时的依据合计</th>
              {FROZEN_BASIS_ORDER.map((basis) => (
                <td
                  key={basis}
                  className={basis === "measured" ? "w11-col-auto w11-zero-cell" : ""}
                >
                  {basisCounts[basis]}
                </td>
              ))}
              <td className="w11-col-basis" />
            </tr>
            <tr>
              <th scope="row">实测之后的依据合计</th>
              {FROZEN_BASIS_ORDER.map((basis) => (
                <td key={basis} className={basis === "measured" ? "w11-col-auto" : ""}>
                  {basis === "measured" ? FROZEN_VALUES.length : 0}
                </td>
              ))}
              <td className="w11-col-basis" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="w11-matrix-note">
        实心标记落满最后一列：每条都要一条命令的输出或一次构建记录才能确认。
        空心标记全部落在左侧三列，冻结那一刻没有一条取值有实测支撑。
      </p>

      <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

      <ol className="w11-correction-list">
        {FROZEN_VALUES.map((item) => (
          <li key={item.id} className="w11-correction frozen">
            <details open={open}>
              <summary>
                <b aria-hidden="true">{item.tag}</b>
                <strong>{item.title}</strong>
                <span className="w11-catcher-chip">{FROZEN_BASIS[item.frozenBasis]}</span>
                <span className="w11-command-chip">{FROZEN_CHANGED[item.changed]}</span>
                <GradeChip grade={item.grade} />
              </summary>
              <div className="w11-correction-body">
                <p className="w11-correction-initial">
                  <span>冻结时写下的</span>
                  {item.frozen}
                </p>
                <p className="w11-correction-mech">
                  <span>实测</span>
                  {item.measured}
                </p>
                <p className="w11-correction-command">
                  <span>证据</span>
                  {item.evidence}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>
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
        展示顺序按事实稳定时间排列。⑥ 的三页取自三批已经发生完的自纠：契约冻结当天、
        controller 搭建当天、部署段执行当天。② 的五个阶段在 8/26 全部取得构建记录。
        其余三块的证据在回滚演练与收口日当天产生。
        范围与口径边界见 <code>week11-visualization-plan.md</code> §17。
      </p>
    </details>
  );
}
