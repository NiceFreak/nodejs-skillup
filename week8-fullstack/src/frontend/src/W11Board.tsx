// W11 发布流水线板 · 十页：⑥·1 契约层、⑥·2 机制层、⑥·3 冻结取值层、
// ② 五阶段失败面、③ 权限收窄、⑤ 验证覆盖、⑧ 远程触发的信任边界、⑨ 判据失效面、
// ④ 回滚的三条路径与两个指针、⑪ 假 active 的机制定论。
// 展示资产（AGENTS.md 白名单）。
//
// 阶段 1（8/25）落地前三页，阶段 2（8/26，D3 收口后）落地 ⑥·3 / ③ / ⑤ 并把部署段两阶段翻档，
// 阶段 3（8/26，D3 附加项端到端跑通后）落地 ⑧ 与 ⑨，
// 阶段 4（8/27，D4 回滚演练与类 2 定论当天）落地 ④ 与 ⑪。
// 阶段 5（8/28，D5 收口日）落地 ① 与 ⑦：触发链路终点固定、对照说明成篇。
// ⑪ 这个编号避开了 ⑩：方法稿 §20.1 已把 ⑩ 定给「执行期偏差落在哪些接触面」，那一块尚未开工。
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
//   ⑧    三条通道 × 五项要求的矩阵，内容决定权那一列采纳行与被否两行标记不同，
//         否决依据那一列的两格不同源
//   ⑨    十一条判据 × 两种情况的取值表，两格文本相等即失效，判定由相等算出不手写
//   ④    时点 × 提交的网格，三种形状的指针落格，两个状态文件的列位置在每一行都不同，
//         被测试拦下的那个提交整列没有标记；第三条路径的目标格是断点不是文件
//   ⑪    四项观察 × 三种情况的取值表，与现场那一列逐格相同即同形，
//         判定由逐格比较算出；最小样本的计数单独一张表，末列合计为 0 即否证
// 正文按渐进层级折叠：每条的机制与修正默认收起，避免首屏堆叠长段落。
//
// 本板没有主动回忆的复习门：问句属学习材料，按方法稿 §12 决策 4 由本人定稿。
import { useEffect, useState } from "react";
import { HBarChart } from "./charts";
import {
  CRITERIA,
  CRITERION_EXPOSURE,
  CRITERION_VERDICT,
  DRILL_COMMITS,
  DRILL_EVENTS,
  DRILL_OUTCOME,
  FALSE_ACTIVE_ANCHOR,
  FALSE_ACTIVE_CASES,
  FALSE_ACTIVE_FIX,
  FALSE_ACTIVE_GRADED,
  FALSE_ACTIVE_PENDING,
  FROZEN_BASIS,
  FROZEN_BASIS_ORDER,
  FROZEN_CHANGED,
  FROZEN_VALUES,
  HANDOFF_NOT_HANDED,
  HANDOFF_PENDING,
  HANDOFF_STEPS,
  HANDOFF_THIRD_CLASS,
  LANES,
  LANES_PENDING,
  LOGIC_BUCKET_ID,
  OBSERVATIONS,
  OBS_VALUE,
  PAPER_CATCHER,
  POINTERS,
  POLL_WAIT,
  RACE_MODES,
  RACE_RUNS_PER_MODE,
  RACE_SIDES,
  RECOVERIES,
  ROLLBACK_NOTES,
  ROLLBACK_PATHS,
  ROLLBACK_PENDING,
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
  TRIGGER_ANCHOR_DIMENSION,
  TRIGGER_CHANNELS,
  TRIGGER_COUNTS,
  TRIGGER_DIMENSIONS,
  TRIGGER_FACTS,
  TRIGGER_REJECT_BASIS,
  TRIGGER_VERDICT,
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
  adoptedChannels,
  coincidingEvents,
  commitsNeverOnServer,
  criterionCount,
  criterionExposureCounts,
  criterionVerdict,
  degenerateCriteria,
  falseActiveInSamples,
  frozenBasisCounts,
  frozenMeasuredAtFreeze,
  gradeCounts,
  layerCoverage,
  loggedEvents,
  machineCaughtCount,
  matchesField,
  noPasswordRows,
  pathsRun,
  pointersAt,
  pointersCoincide,
  raceRunTotal,
  rejectBasisKinds,
  rejectedChannels,
  riskStageCount,
  rollbackRecoveries,
  sameShapeCases,
  singleCoverageLayers,
  triggerMeetCount,
  uncoveredChecks,
  unloggedEvents,
  verifySideCounts,
} from "./w11Facts";
import type { PaperCatcher, PointerKind, TriggerVerdict, TrustVerdict, W11Grade } from "./w11Facts";
import { tabKeyDown } from "./tabs";
import type { BoardMode } from "./types";

/** 已落地的八块。其余三块在 W11_STAGE_PLAN 里按待做呈现，不进这个切换器。 */
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
            并用一次注入证明日志扫描能够判红。同日另加一条手机远程触发展板发布的链路，
            端到端跑通之后复盘了判据本身。8/27 做回滚演练：两类坏提交各推一次，
            一类止步测试、一类过了测试起不来，走完拦截、回滚与恢复全程；
            同日把 W10 移交过来的假 active 用一次端口占用注入定论并修复上线。
            每条事实均标明已实测或待做。
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
        {active.id === "remote-trigger" ? (
          <RemoteTriggerLayer />
        ) : active.id === "rollback" ? (
          <RollbackLayer />
        ) : active.id === "false-active" ? (
          <FalseActiveLayer />
        ) : active.id === "criteria" ? (
          <CriteriaLayer />
        ) : active.id === "lanes" ? (
          <LanesLayer />
        ) : active.id === "handoff" ? (
          <HandoffLayer />
        ) : active.id === "selfcheck-runtime" ? (
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

/* ================================ ⑧ 远程触发的信任边界（D3 附加项，8/26） */

function RemoteTriggerLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const rejected = rejectedChannels();
  const adopted = adoptedChannels();
  const basisKinds = rejectBasisKinds();
  const anchor = TRIGGER_DIMENSIONS.find((d) => d.id === TRIGGER_ANCHOR_DIMENSION);

  return (
    <section className="w11-trigger" aria-label="远程触发的三条候选通道与五项要求">
      <div className="w6-section-head">
        <span>trigger boundary</span>
        <h3>
          {TRIGGER_CHANNELS.length} 条候选通道里 {adopted.length} 条满足全部 {TRIGGER_DIMENSIONS.length} 项要求，
          被否的 {rejected.length} 条依据分属 {basisKinds.length} 类
        </h3>
      </div>

      <p className="w11-lead">
        手机上发出的一条命令要完成展板发布，先要回答它凭什么只能触发发布。
        三条候选通道按同一组 {TRIGGER_DIMENSIONS.length} 项要求逐项比对。
        满足项数本身不是判据：被否的两条分别满足 {rejected.map((c) => triggerMeetCount(c)).join(" 项与 ")} 项，
        决定取舍的是它们各自不满足的是哪一项，以及那一项为什么不满足。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{TRIGGER_CHANNELS.length}</strong>
          <span>条候选通道，来自方案取舍时的三个选项</span>
        </div>
        <div>
          <strong>{TRIGGER_FACTS.length}</strong>
          <span>条实测事实决定了取舍，见页内折叠区</span>
        </div>
        <div className="alert">
          <strong>{basisKinds.length}</strong>
          <span>类否决依据：一类是仓库属性，一类是会话的运行位置</span>
        </div>
      </div>

      {/* 分类用矩阵：行是通道，列是五项要求，最后一列写明否决依据。
          结论落在两处——内容决定权那一列采纳行与被否两行的标记不同，
          以及否决依据那一列的两格不同源。两处都塌了这一页就只剩一张选型表。 */}
      <div
        className="w11-matrix-wrap"
        data-anchor="内容决定权那一列的三个标记，以及否决依据那一列不同源的两格"
      >
        <table className="w11-matrix w11-trigger-matrix">
          <caption>
            行为候选通道；中间五列为逐项要求，取值为满足、不满足或不适用；最后一列为否决依据
          </caption>
          <thead>
            <tr>
              <th scope="col">候选通道</th>
              {TRIGGER_DIMENSIONS.map((dim) => (
                <th
                  key={dim.id}
                  scope="col"
                  className={dim.id === TRIGGER_ANCHOR_DIMENSION ? "w11-col-anchor" : ""}
                >
                  {dim.name}
                  <small>{dim.requirement}</small>
                </th>
              ))}
              <th scope="col" className="w11-col-count">
                满足项数
              </th>
              <th scope="col" className="w11-col-basis">
                否决依据
              </th>
            </tr>
          </thead>
          <tbody>
            {TRIGGER_CHANNELS.map((channel) => (
              <tr key={channel.id} className={channel.rejectBasis === "none" ? "" : "w11-row-flag"}>
                <th scope="row">{channel.name}</th>
                {TRIGGER_DIMENSIONS.map((dim) => (
                  <TriggerCell
                    key={dim.id}
                    verdict={channel.verdicts[dim.id]}
                    anchor={dim.id === TRIGGER_ANCHOR_DIMENSION}
                  />
                ))}
                <td className="w11-col-count">{triggerMeetCount(channel)}</td>
                <td
                  className={`w11-col-basis ${channel.rejectBasis === "none" ? "" : "w11-basis-flag"}`}
                >
                  {TRIGGER_REJECT_BASIS[channel.rejectBasis]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="w11-matrix-note">
        {anchor?.name}那一列是本页的结论，它要求的是{anchor?.requirement}：采纳的那条通道，
        流水线定义存放在 Jenkins 里、构建内容固定取 main，能写触发分支的人只能决定什么时候发。
        触发权与内容决定权在这条通道上是分开的，另外两条上不是。
      </p>

      <p className="w11-note" role="note">
        <b>被否两条的依据不是同一类，因此它们的有效期也不同</b>
        仓库属性那一条可以变：仓库转私有并关掉 fork 之后它消失，该方案重新成立，因此记入 backlog。
        运行位置那一条与需求形态绑定：只要发起端是临时云容器，把能登录开发机的私钥放进去就一直是更差的选择。
      </p>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">decisive facts</span>
          <strong>决定这次取舍的 {TRIGGER_FACTS.length} 条实测事实</strong>
        </summary>
        <p className="w11-zero-lead">
          矩阵里每一格的取值都要回到这三条上才能核。它们是先于通道存在的约束，不是通道自己的属性。
        </p>
        <ul className="w11-check-list">
          {TRIGGER_FACTS.map((item) => (
            <li key={item.id}>
              <div className="w11-check-head">
                <strong>{item.name}</strong>
                <GradeChip grade={item.grade} />
              </div>
              <p className="w11-check-expect">
                <span>事实</span>
                {item.fact}
              </p>
              <p className="w11-check-actual">
                <span>怎么测的</span>
                {item.how}
              </p>
              <p className="w11-check-dev">
                <span>对取舍的影响</span>
                {item.effect}
              </p>
            </li>
          ))}
        </ul>
      </details>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">per channel detail</span>
          <strong>逐条通道的走法、逐项取值与否决依据</strong>
        </summary>
        <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

        <ol className="w11-correction-list">
          {TRIGGER_CHANNELS.map((channel) => (
            <li
              key={channel.id}
              className={`w11-correction trigger ${channel.rejectBasis === "none" ? "" : "flag"}`}
            >
              <details open={open}>
                <summary>
                  <strong>{channel.name}</strong>
                  <span className="w11-catcher-chip">
                    {channel.rejectBasis === "none" ? "采纳" : "否决"}
                  </span>
                  <GradeChip grade={channel.grade} />
                </summary>
                <div className="w11-correction-body">
                  <p className="w11-correction-initial">
                    <span>通道怎么走</span>
                    {channel.path}
                  </p>
                  <ul className="w11-dim-list">
                    {TRIGGER_DIMENSIONS.map((dim) => (
                      <li key={dim.id} className={`v-${channel.verdicts[dim.id]}`}>
                        <strong>{dim.requirement}</strong>
                        <em>{TRIGGER_VERDICT[channel.verdicts[dim.id]].label}</em>
                        <span>{channel.notes[dim.id]}</span>
                      </li>
                    ))}
                  </ul>
                  <p className={channel.rejectBasis === "none" ? "w11-correction-fix" : "w11-correction-mech"}>
                    <span>{channel.rejectBasis === "none" ? "采纳依据与代价" : "否决依据"}</span>
                    {channel.basisDetail}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </details>

      <p className="w11-note" role="note">
        <b>同一个最小权限目标，两个系统能达到的下限不一样</b>
        服务器侧能按用户加单条命令把一把密钥放行到极窄。GitHub 侧没有只能推某个分支的凭据形态，
        写权限一给就能推任意分支，收窄只能改为给 main 开分支保护，把风险收在 main 上。
        回执要写回 GitHub，这条链路就必须接受后者的下限。
      </p>

      <p className="w11-note" role="note">
        <b>两处计数各自的时点</b>
        权限收窄那一页写的 {TRUST_COUNTS.sudoWhitelist} 条提权白名单是 D3 收窄当天（8/26）的取值；
        展板落盘命令进入白名单之后是 {TRIGGER_COUNTS.sudoAfterShowcaseLand} 条。
        两个数是同一份白名单在两个时点的条数，不是矛盾。本页的触发链路复用已在位的落盘条目，没有新增条目。
        变更单里的 {TRIGGER_COUNTS.decisions} 条待拍板决策已于 8/26 全部落地，
        {TRIGGER_COUNTS.changeOrderChecks} 条可证伪验证也已全部达成并回填。
      </p>
    </section>
  );
}

function TriggerCell({ verdict, anchor }: { verdict: TriggerVerdict; anchor: boolean }) {
  return (
    <td className={`w11-verdict-cell v-${verdict} ${anchor ? "w11-col-anchor" : ""}`}>
      <i aria-hidden="true" className={`w11-verdict-mark m-${verdict}`} />
      <span>{TRIGGER_VERDICT[verdict].mark}</span>
    </td>
  );
}

/* ================================ ⑨ 判据失效面（D3 附加项复盘，8/26） */

function CriteriaLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const degenerate = degenerateCriteria();
  const exposure = criterionExposureCounts();

  return (
    <section className="w11-criteria" aria-label="判据在机制正确与机制没运行时的取值对照">
      <div className="w6-section-head">
        <span>criteria degeneracy</span>
        <h3>
          {CRITERIA.length} 条判据里，{degenerate.length} 条在机制正确与机制没运行时观察到的取值相同
        </h3>
      </div>

      <p className="w11-lead">
        一条判据只有在两种情况下取值不同才承载信息。两列取值相同的那几行，通过与不通过说明不了任何事，
        它们当时都被判为通过。判定由两列取值是否相同算出，不手写。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{CRITERIA.length}</strong>
          <span>条判据，口径见矩阵下方一句</span>
        </div>
        <div className="alert">
          <strong>{degenerate.length}</strong>
          <span>条两列取值相同，判据不承载信息</span>
        </div>
        <div>
          <strong>{exposure["at-design-time"]}</strong>
          <span>条在设判据时当场识别，其余在执行之后才暴露</span>
        </div>
      </div>

      {/* 两列并置的取值表：失效由两格文本相等直接呈现，不靠判定文字。
          判定那一列是算出来的，它与两列取值漂移时断言先报。 */}
      <div
        className="w11-matrix-wrap"
        data-anchor="两列取值相同的那三行，以及第三行不同于另两行的识别时点"
      >
        <table className="w11-matrix w11-criteria-matrix">
          <caption>
            行为判据；中间两列为两种情况下观察到的取值，两格相同即为失效；最后两列为判定与识别时点
          </caption>
          <thead>
            <tr>
              <th scope="col">判据</th>
              <th scope="col" className="w11-col-obs">
                机制正确时观察到什么
              </th>
              <th scope="col" className="w11-col-obs">
                机制没运行时观察到什么
              </th>
              <th scope="col" className="w11-col-verdict">
                判定
              </th>
              <th scope="col" className="w11-col-when">
                失效的识别时点
              </th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((item) => {
              const verdict = criterionVerdict(item);
              const same = verdict === "degenerate";
              return (
                <tr key={item.id} className={same ? "w11-row-flag" : ""}>
                  <th scope="row">
                    <b>{item.source}</b>
                    {item.name}
                  </th>
                  <td className={`w11-col-obs ${same ? "w11-obs-same" : ""}`}>
                    {item.positiveObservation}
                  </td>
                  <td className={`w11-col-obs ${same ? "w11-obs-same" : ""}`}>
                    {item.nullObservation}
                  </td>
                  <td className={`w11-col-verdict ${same ? "w11-basis-flag" : ""}`}>
                    {CRITERION_VERDICT[verdict].label}
                  </td>
                  <td className="w11-col-when">
                    {item.exposedAt ? (
                      CRITERION_EXPOSURE[item.exposedAt]
                    ) : (
                      <i aria-label="判据成立，没有失效时点">—</i>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="w11-matrix-note">
        这 {CRITERIA.length} 条判据与变更单里的 {TRIGGER_COUNTS.changeOrderChecks} 条可证伪验证不是同一个口径：
        后者数的是清单条目数，前者数的是判据条数，另外两条是执行期补进来的
        （分支保护的验证判据、陷阱 1 重验当晚为不自触发设的第一版判据）。
        8/26 当晚为陷阱 1 重设的两句成对判据，分别写在第 6 行与第 11 行的修正里。
      </p>

      <p className="w11-note" role="note">
        <b>失效的三条机制各不相同，不能当成一类问题一起修</b>
        推送预演不发送数据，因此触发不到服务端检查；已弃用的轮询过滤路径不产出变更判定，因此永不构建；
        不发布的那条分支本来就不写回执，因此回执目录不会有新增。
        三条的共同形态只有一个：判据在机制正确与机制没运行两种情况下取值相同。
      </p>

      <p className="w11-note" role="note">
        <b>写权限凭据绕过分支保护那一条不属于判据失效</b>
        它是分支保护那条判据改成真实推送之后暴露出来的真实缺陷，判据在那里正确地报了红。
        判据失效说的是判据测不出它要测的命题，不是被测对象有问题，两者的处理方式不同。
      </p>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">per criterion detail</span>
          <strong>逐条判据的两种取值、失效机制与证据</strong>
        </summary>
        <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

        <ol className="w11-correction-list">
          {CRITERIA.map((item) => {
            const verdict = criterionVerdict(item);
            return (
              <li
                key={item.id}
                className={`w11-correction criteria ${verdict === "degenerate" ? "flag" : ""}`}
              >
                <details open={open}>
                  <summary>
                    <b aria-hidden="true">{item.source}</b>
                    <strong>{item.name}</strong>
                    <span className="w11-catcher-chip">{CRITERION_VERDICT[verdict].label}</span>
                    <GradeChip grade={item.grade} />
                  </summary>
                  <div className="w11-correction-body">
                    <p className="w11-correction-initial">
                      <span>机制正确时观察到什么</span>
                      {item.positiveObservation}
                    </p>
                    <p className="w11-correction-mech">
                      <span>机制没运行指哪一种情况</span>
                      {item.nullCase}：{item.nullObservation}
                    </p>
                    {item.degenerateMechanism && (
                      <p className="w11-correction-mech w11-degenerate-mech">
                        <span>两列为什么取到同一个值</span>
                        {item.degenerateMechanism}
                      </p>
                    )}
                    {item.fix && (
                      <p className="w11-correction-fix">
                        <span>判据改成了什么</span>
                        {item.fix}
                      </p>
                    )}
                    <p className="w11-correction-command">
                      <span>证据</span>
                      {item.evidence}
                    </p>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}

/* ============================================ ④ 回滚：三条路径与两个指针（D4） */

/**
 * 编码按方法稿 §16 的那一行：一条提交序列，两个状态文件是轴上的两个指针。
 * 落到版面上是一张「时点 × 提交」的网格——指针会随时间移动，
 * 时间是它的第二个维度，只有把两维都画出来，「两者从不重合」才是看出来的而不是读出来的。
 *
 * 三种标记是三种形状（方块 / 实心圆 / 空心圆），不是三种颜色（roadmap 第十轮判据）。
 * 没有留痕的格子留空，行尾单独标出来：空格是「没量过」，不是「没有值」。
 */
function RollbackLayer() {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), []);

  const logged = loggedEvents();
  const coincide = coincidingEvents();
  const gaps = unloggedEvents();
  const run = pathsRun();
  const neverOnServer = commitsNeverOnServer();
  const pointerKinds = Object.keys(POINTERS) as PointerKind[];

  return (
    <section className="w11-rollback" aria-label="回滚的三条路径与两个基线文件">
      <div className="w6-section-head">
        <span>rollback paths and pointers</span>
        <h3>
          {ROLLBACK_PATHS.length} 条回滚路径里 {run.length} 条被真的走过；两个指针在 {logged.length} 个留痕时点上重合{" "}
          {coincide.length} 次
        </h3>
      </div>

      <p className="w11-lead">
        回滚要回到哪一个提交，取决于读哪一个文件。两个文件的语义不同：一个存最近一次验证通过的版本，
        一个存本轮部署开始时正在跑的版本。演练当天线上换过四次版本，每次两个文件各自被谁改写、
        改写成什么，都在下面这张网格里。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{run.length}</strong>
          <span>
            条路径被真的执行过，另外 {ROLLBACK_PATHS.length - run.length} 条至今零次
          </span>
        </div>
        <div className="zero">
          <strong>{coincide.length}</strong>
          <span>次两个指针指向同一个提交，分母是 {logged.length} 个留痕时点</span>
        </div>
        <div>
          <strong>{rollbackRecoveries()}</strong>
          <span>次线上恢复靠回滚完成，当天一共恢复了 {RECOVERIES.length} 次</span>
        </div>
      </div>

      {/* 结论锚：这张网格。横轴是提交序列，纵轴是时点，三种标记落格。 */}
      <div
        className="w11-matrix-wrap"
        data-anchor="两个指针的列位置在每一行都不同；被测试拦下的那个提交整列没有标记"
      >
        <table className="w11-matrix w11-drill-matrix">
          <caption>
            行为演练当天的时点，列为演练涉及的提交（左到右即时间顺序）；
            方块为线上运行的版本，实心圆为验证基线，空心圆为本轮部署开始时的快照
          </caption>
          <thead>
            <tr>
              <th scope="col">时点</th>
              {DRILL_COMMITS.map((commit) => (
                <th
                  key={commit.sha}
                  scope="col"
                  className={commit.reachedServer ? "" : "w11-col-offserver"}
                >
                  <code>{commit.sha}</code>
                  <small>{commit.clock}</small>
                </th>
              ))}
              <th scope="col" className="w11-col-gap">
                未留痕
              </th>
            </tr>
          </thead>
          <tbody>
            {DRILL_EVENTS.map((event) => {
              const gap = pointersCoincide(event) === null;
              const same = pointersCoincide(event) === true;
              return (
                <tr key={event.id} className={same ? "w11-row-flag" : gap ? "w11-row-gap" : ""}>
                  <th scope="row">
                    <b>{event.clock}</b>
                    {event.name}
                    <small>{event.build ?? "无构建号"}</small>
                  </th>
                  {DRILL_COMMITS.map((commit) => {
                    const marks = pointersAt(event, commit.sha);
                    return (
                      <td
                        key={commit.sha}
                        className={`w11-pointer-cell ${marks.length > 1 ? "w11-cell-stacked" : ""}`}
                      >
                        {marks.map((kind) => (
                          <i
                            key={kind}
                            className={`w11-pointer-mark p-${kind}`}
                            aria-label={`${POINTERS[kind].file} 指向 ${commit.sha}`}
                          />
                        ))}
                      </td>
                    );
                  })}
                  <td className="w11-col-gap">
                    {gap ? (
                      <span className="w11-gap-flag">快照未读</span>
                    ) : (
                      <i aria-label="两个指针的取值当天都读过">—</i>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="w11-legend-row" aria-label="三种标记的含义">
        {pointerKinds.map((kind) => (
          <li key={kind}>
            <i aria-hidden="true" className={`w11-pointer-mark p-${kind}`} />
            <strong>{POINTERS[kind].file}</strong>
            <span>{POINTERS[kind].label}</span>
          </li>
        ))}
      </ul>

      <p className="w11-matrix-note">
        {neverOnServer.map((c) => c.sha).join("、")} 那一列一个标记也没有：它被测试阶段拦下，
        三个指针因此全部停在上一行的位置。这一列的空白与第二行三格「没有变」是同一件事的两种画法。
      </p>

      <p className="w11-note" role="note">
        <b>两个指针唯一会取到同一个值的时刻，正是需要回滚的那一刻</b>
        每次部署成功之后，验证基线前移到新版本、快照留在旧版本，两者必然差一轮；
        而一次部署把版本换上去、验证却没通过时，验证基线没动、快照恰好被写成同一个提交。
        演练当天那一格没有读（{gaps.length} 行标着未留痕，第一行就是这一格），所以表里看不到它——
        按已经实测两次的写入规则可以推出来，推断不进格子。这也是待做清单第二条的由来。
      </p>

      <div className="w11-sub-head w6-section-head">
        <span>three paths</span>
        <h3>三条路径各自回到哪一个文件，谁来决定，D4 走过几次</h3>
      </div>

      <div className="w11-matrix-wrap" data-anchor="第三条路径的目标格是断点，不是某个文件">
        <table className="w11-matrix w11-path-matrix">
          <caption>行为契约冻结的三条回滚路径；执行次数由演练填，不是路径自己声称的</caption>
          <thead>
            <tr>
              <th scope="col">触发条件</th>
              <th scope="col" className="w11-col-anchor">
                回滚目标
              </th>
              <th scope="col">回滚后验证</th>
              <th scope="col">谁决定</th>
              <th scope="col" className="w11-col-count">
                D4 执行
              </th>
            </tr>
          </thead>
          <tbody>
            {ROLLBACK_PATHS.map((path) => (
              <tr key={path.id} className={path.runs === 0 ? "w11-row-empty" : ""}>
                <th scope="row">
                  <b>{path.n}</b>
                  {path.trigger}
                </th>
                <td className="w11-col-anchor w11-target-cell">
                  {path.targetFile ? (
                    <>
                      <i aria-hidden="true" className={`w11-pointer-mark p-${path.targetFile}`} />
                      <code>{POINTERS[path.targetFile].file}</code>
                    </>
                  ) : (
                    <span className="w11-target-none">
                      <i aria-hidden="true" className="w11-pointer-mark p-none" />
                      无目标
                    </span>
                  )}
                </td>
                <td className="w11-col-basis">{path.verifyAfter}</td>
                <td>{path.decidedBy}</td>
                <td className="w11-col-count">{path.runs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="w11-matrix-note">
        第三条路径那一格不是空的，是断的：回滚动作本身失败时没有任何文件能给出目标，
        只剩人登录服务器手工挑一个已知可用的版本。它与另外两条不同类，画成同样的箭头会读错。
      </p>

      <ExpandAll open={open} onToggle={() => setOpen((v) => !v)} />

      <ol className="w11-correction-list">
        {ROLLBACK_PATHS.map((path) => (
          <li key={path.id} className={`w11-correction rollback ${path.runs === 0 ? "flag" : ""}`}>
            <details open={open}>
              <summary>
                <b aria-hidden="true">{path.n}</b>
                <strong>{path.trigger}</strong>
                <span className="w11-catcher-chip">
                  {path.decidedBy}
                  {path.runs > 0 ? "，已执行" : "，零次执行"}
                </span>
                <GradeChip grade={path.grade} />
              </summary>
              <div className="w11-correction-body">
                <p className="w11-correction-initial">
                  <span>回滚动作</span>
                  {path.action}
                </p>
                <p className="w11-correction-mech">
                  <span>回滚目标</span>
                  {path.targetFile
                    ? `${POINTERS[path.targetFile].file}：${POINTERS[path.targetFile].meaning}`
                    : "没有目标文件，只能人工挑一个已知可用的版本。"}
                </p>
                <p className="w11-correction-command">
                  <span>D4 实际发生了什么</span>
                  {path.evidence}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ol>

      <details className="w11-zero board-fold">
        <summary>
          <span className="board-fold-kicker">recovery ledger</span>
          <strong>
            演练当天线上恢复了 {RECOVERIES.length} 次，其中 {rollbackRecoveries()} 次是回滚
          </strong>
        </summary>
        <p className="w11-zero-lead">
          另外两次是撤回提交触发的正常发布——走完五个阶段、写新的验证基线。
          把它们一起记成「回滚了三次」，回滚路径的执行次数就会被高估两倍。
        </p>
        <ul className="w11-zero-list">
          {RECOVERIES.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>
                {item.how}，落到 {item.landedOn}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">pointer semantics</span>
          <strong>两个文件各自谁写、谁读</strong>
        </summary>
        <ul className="w11-check-list">
          {pointerKinds.map((kind) => (
            <li key={kind}>
              <div className="w11-check-head">
                <i aria-hidden="true" className={`w11-pointer-mark p-${kind}`} />
                <strong>
                  {POINTERS[kind].file} · {POINTERS[kind].label}
                </strong>
              </div>
              <p>{POINTERS[kind].meaning}</p>
              <p className="w11-check-dev">
                <span>谁写</span>
                {POINTERS[kind].writtenBy}
              </p>
              <p className="w11-check-actual">
                <span>谁读</span>
                {POINTERS[kind].readBy}
              </p>
            </li>
          ))}
        </ul>
      </details>

      <details className="w11-limits board-fold">
        <summary>
          <span className="board-fold-kicker">four qualifiers</span>
          <strong>四条限定语，抹掉任何一条这一页都会被读成闭环</strong>
        </summary>
        {ROLLBACK_NOTES.map((item) => (
          <p key={item.id} className="w11-limit">
            <b>{item.title}</b>
            {item.body}
          </p>
        ))}
      </details>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">timeline detail</span>
          <strong>逐个时点的取值、含义与证据</strong>
        </summary>
        <ol className="w11-correction-list">
          {DRILL_EVENTS.map((event) => (
            <li
              key={event.id}
              className={`w11-correction rollback ${pointersCoincide(event) === null ? "flag" : ""}`}
            >
              <details open={open}>
                <summary>
                  <b aria-hidden="true">{event.n}</b>
                  <strong>{event.name}</strong>
                  <span className="w11-catcher-chip">{DRILL_OUTCOME[event.outcome].label}</span>
                  <GradeChip grade={event.grade} />
                </summary>
                <div className="w11-correction-body">
                  <p className="w11-correction-initial">
                    <span>这一行是什么</span>
                    {DRILL_OUTCOME[event.outcome].detail}
                  </p>
                  <p className="w11-correction-mech">
                    <span>三个指针</span>
                    {(Object.keys(POINTERS) as PointerKind[])
                      .map(
                        (kind) =>
                          `${POINTERS[kind].file} = ${event.positions[kind] ?? "当天未读"}`,
                      )
                      .join("；")}
                  </p>
                  <p className="w11-correction-fix">
                    <span>为什么重要</span>
                    {event.detail}
                  </p>
                  <p className="w11-correction-command">
                    <span>证据</span>
                    {event.evidence}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </details>

      <PendingList
        title={`回滚这一块的 ${ROLLBACK_PENDING.length} 项待做`}
        kicker="rollback pending"
        items={ROLLBACK_PENDING}
      />
    </section>
  );
}

/* ==================================== ⑪ 假 active 的机制定论（W10 移交，D4 闭合） */

/**
 * 两组证据分成两张表，不合并：
 *   上表是四项观察 × 三种情况，判定为「与现场那一列逐格是否相同」，由代码算；
 *   下表是最小样本的计数，三种关闭时机 × 两侧各 100 次，结论是否证。
 * 合成一张会让「计数为 0」与「逐格相同」看起来是同一种证据。
 */
function FalseActiveLayer() {
  const anchor = FALSE_ACTIVE_CASES.find((c) => c.id === FALSE_ACTIVE_ANCHOR)!;
  const sameShape = sameShapeCases();
  const others = FALSE_ACTIVE_CASES.filter((c) => c.id !== FALSE_ACTIVE_ANCHOR);

  return (
    <section className="w11-falseactive" aria-label="假 active 的机制定论">
      <div className="w6-section-head">
        <span>false active mechanism</span>
        <h3>
          注入复现的修复前那一列与现场那一列逐格相同；最小样本跑了 {raceRunTotal()} 次，
          「回调触发但没绑定」出现 {falseActiveInSamples()} 次
        </h3>
      </div>

      <p className="w11-lead">
        这是 W10 移交过来的一笔账：那次现场里服务被判为运行中、端口却没有监听，机制当时只读了代码没有验证。
        8/27 先按原假设做最小样本，三种关闭时机都没有复现；换成完整应用加一次端口占用注入之后，
        三项观察与现场逐格对上，机制才算定论。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{OBSERVATIONS.length}</strong>
          <span>项观察，三种情况共用同一组，因此可以逐格比对</span>
        </div>
        <div>
          <strong>{sameShape.length}</strong>
          <span>
            列与现场逐格相同：{sameShape.map((id) => FALSE_ACTIVE_CASES.find((c) => c.id === id)?.name).join("、")}
          </span>
        </div>
        <div className="zero">
          <strong>{falseActiveInSamples()}</strong>
          <span>次最小样本复现了原假设，因此那条假设被否掉</span>
        </div>
      </div>

      <div
        className="w11-matrix-wrap"
        data-anchor="修复前那一列与现场那一列逐格相同，修复后在决定性两行反号"
      >
        <table className="w11-matrix w11-obs-matrix">
          <caption>
            行为四项观察，列为三种情况；最左的现场是基准列，其余两列与它逐格比对
          </caption>
          <thead>
            <tr>
              <th scope="col">观察项</th>
              {FALSE_ACTIVE_CASES.map((item) => (
                <th
                  key={item.id}
                  scope="col"
                  className={item.id === FALSE_ACTIVE_ANCHOR ? "w11-col-anchor" : ""}
                >
                  {item.name}
                  <small>{item.sub}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OBSERVATIONS.map((obs) => {
              const anchorValue = obs.values[FALSE_ACTIVE_ANCHOR];
              return (
                <tr key={obs.id}>
                  <th scope="row">
                    <b>{obs.n}</b>
                    {obs.name}
                  </th>
                  {FALSE_ACTIVE_CASES.map((item) => {
                    const value = obs.values[item.id];
                    const isAnchor = item.id === FALSE_ACTIVE_ANCHOR;
                    const same =
                      !isAnchor && value !== "unlogged" && anchorValue !== "unlogged" && value === anchorValue;
                    return (
                      <td
                        key={item.id}
                        className={`w11-obs-cell v-${value} ${isAnchor ? "w11-col-anchor" : ""} ${
                          same ? "w11-obs-same" : ""
                        }`}
                      >
                        <i aria-hidden="true" className={`w11-obs-mark o-${value}`} />
                        <span>{OBS_VALUE[value].label}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">与现场逐格相同</th>
              <td className="w11-col-anchor">基准列</td>
              {others.map((item) => {
                const { same, compared } = matchesField(item.id);
                return (
                  <td key={item.id} className={same === compared ? "w11-cell-match" : ""}>
                    {same} / {compared}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="w11-matrix-note">
        {anchor.detail} 修复前那一列与它对上，是「这套机制能造出那个现场」的依据；
        对上不等于在现场重跑过，这一步是推断，见下面的分级。
      </p>

      <div className="w11-sub-head w6-section-head">
        <span>minimal sample</span>
        <h3>
          先做的那批最小样本否掉了原假设：{RACE_MODES.length} 种关闭时机 × 每种{" "}
          {RACE_RUNS_PER_MODE} 次 × {RACE_SIDES.length} 侧
        </h3>
      </div>

      <div className="w11-matrix-wrap" data-anchor="末列合计为 0，原假设被否">
        <table className="w11-matrix w11-race-matrix">
          <caption>
            行为三种关闭时机；两侧的运行结果一致，表中计数为单侧取值
          </caption>
          <thead>
            <tr>
              <th scope="col">关闭时机</th>
              <th scope="col">做了什么</th>
              <th scope="col" className="w11-col-count">
                回调触发
              </th>
              <th scope="col" className="w11-col-count">
                探针见监听
              </th>
              <th scope="col" className="w11-col-count w11-col-anchor">
                回调触发但没绑定
              </th>
            </tr>
          </thead>
          <tbody>
            {RACE_MODES.map((mode) => (
              <tr key={mode.id}>
                <th scope="row">{mode.name}</th>
                <td className="w11-col-basis">{mode.what}</td>
                <td className="w11-col-count">{mode.callbacks}</td>
                <td className="w11-col-count">
                  {mode.listening === null ? (
                    <i aria-label="回调没有触发，这一项不适用">—</i>
                  ) : (
                    mode.listening
                  )}
                </td>
                <td className="w11-col-count w11-col-anchor w11-zero-cell">{mode.falseActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="w11-legend-row" aria-label="两侧的运行环境">
        {RACE_SIDES.map((side) => (
          <li key={side.id}>
            <strong>{side.name}</strong>
            <span>
              Node {side.node} · 端口 {side.port}
            </span>
          </li>
        ))}
      </ul>

      <p className="w11-matrix-note">
        三种时机的机制各不相同，但结果同向：
        {RACE_MODES.map((m) => `${m.name}——${m.mechanism}`).join("；")}
      </p>

      <div className="w11-graded" aria-label="结论分级">
        {FALSE_ACTIVE_GRADED.map((item) => (
          <article key={item.id} className={`w11-graded-${item.id}`}>
            <strong>{item.level}</strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <p className="w11-note" role="note">
        <b>没复现不等于已否证，逐格对上也不等于已在现场证实</b>
        最小样本跑满 {raceRunTotal()} 次仍为零，才够把原假设写成否证；
        而定论那一步靠的是注入出来的形态与现场逐格相同，现场本身没有重跑——那一台是唯一的生产机。
        两句话分开写，是为了让读者知道这一页的结论停在哪一档。
      </p>

      <details className="w11-costs board-fold" open>
        <summary>
          <span className="board-fold-kicker">fix landed</span>
          <strong>修复：让监听失败显式化</strong>
        </summary>
        <ul className="w11-check-list">
          <li>
            <div className="w11-check-head">
              <strong>改了什么</strong>
              <GradeChip grade={FALSE_ACTIVE_FIX.grade} />
            </div>
            <p>{FALSE_ACTIVE_FIX.what}</p>
            <p className="w11-check-dev">
              <span>为什么这样改</span>
              {FALSE_ACTIVE_FIX.why}
            </p>
            <p className="w11-check-actual">
              <span>验证</span>
              {FALSE_ACTIVE_FIX.evidence}
            </p>
          </li>
          <li>
            <div className="w11-check-head">
              <strong>注入本身留下的一条经验</strong>
            </div>
            <p>{FALSE_ACTIVE_FIX.sideFinding}</p>
            <p className="w11-check-dev">
              <span>连带更新</span>
              {FALSE_ACTIVE_FIX.handover}
            </p>
          </li>
        </ul>
      </details>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">per observation</span>
          <strong>逐项观察为什么要单独列一行</strong>
        </summary>
        <ol className="w11-correction-list">
          {OBSERVATIONS.map((obs) => (
            <li key={obs.id} className="w11-correction falseactive">
              <div className="w11-correction-head">
                <b aria-hidden="true">{obs.n}</b>
                <strong>{obs.name}</strong>
              </div>
              <div className="w11-correction-body">
                <p>{obs.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </details>

      <PendingList
        title={`这一块的 ${FALSE_ACTIVE_PENDING.length} 项待做`}
        kicker="false active pending"
        items={FALSE_ACTIVE_PENDING}
      />
    </section>
  );
}

/* ---------------------------------------------------------------- ① 三条自动化与一把钥匙 */

function LanesLayer() {
  return (
    <section className="w11-lanes" aria-label="三条自动化与服务器写入权限">
      <div className="w6-section-head">
        <span>automation lanes</span>
        <h3>
          三条自动化跑着同一份测试，能写服务器的只有 {LANES.filter((l) => l.holdsKey).length} 条
        </h3>
      </div>

      <p className="w11-lead">
        一次 push 之后有三条轨道各自往前跑。能改变线上版本的那一条才需要把钥匙挂上去；
        其余轨道红不红都不影响部署——这是拍板过的决策（Q3），不是漏配。
      </p>

      <div className="w11-lanes-grid" data-anchor="能写服务器的只有一条：唯一持钥匙的轨道接到服务器的单入口">
        {LANES.map((lane) => (
          <article key={lane.id} className={`w11-lane lane-${lane.id}`}>
            <header>
              <strong>{lane.name}</strong>
              <GradeChip grade={lane.grade} />
            </header>
            <div className="w11-lane-track">
              <span className="w11-lane-start">push</span>
              <span className="w11-lane-line" aria-hidden="true" />
              <span className="w11-lane-stop">{lane.stopsAt}</span>
            </div>
            <p className="w11-lane-verdict">{lane.verdict}</p>
            {lane.holdsKey ? (
              <p className="w11-lane-key" role="note">
                <span aria-hidden="true">🔑</span> 挂钥匙，接入服务器唯一的写入入口
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="w11-poll-wait" role="note">
        <strong>等待段：最长 {POLL_WAIT.minutes} 分钟</strong>
        <p>{POLL_WAIT.caveat}</p>
        <p>{POLL_WAIT.pointer}</p>
      </div>

      <PendingList
        title={`这一块的 ${LANES_PENDING.length} 项待做`}
        kicker="lanes pending"
        items={LANES_PENDING}
      />
    </section>
  );
}

/* ---------------------------------------------------------------- ⑦ 与手工部署的逐步对照 */

/** 两类「没被替掉」必须是两种画法；第三类（依赖会关机的机器）独立一格。 */
function HandoffLayer() {
  return (
    <section className="w11-handoff" aria-label="与手工部署的逐步对照">
      <div className="w6-section-head">
        <span>handoff to automation</span>
        <h3>
          六步里 {HANDOFF_STEPS.filter((s) => s.owner.startsWith("replaced")).length} 步被替掉，
          两端各留着一批
        </h3>
      </div>

      <p className="w11-lead">
        W9 手工发布六步逐项对照：替掉的只是中间那几步。两种「没被替掉」用两种画法——
        主动不交是「有能力交但选择不交」（W9 收口成果，W11 边界）；不能交是「没能力判断」
        （Q12 验证失败由人判定）。画成同一种颜色，这份对照就答错了一半。
      </p>

      <div className="w11-matrix-wrap" data-anchor="六步 × 三种归属；两类没被替掉的画法不同；第三类独立">
        <table className="w11-matrix w11-handoff-matrix">
          <caption>W9 手工发布的每一步 → 现在由谁做 → 三种归属（+第三类）</caption>
          <thead>
            <tr>
              <th scope="col">W9 那一步</th>
              <th scope="col">W11 自动化</th>
              <th scope="col">归属</th>
              <th scope="col">依据</th>
            </tr>
          </thead>
          <tbody>
            {HANDOFF_STEPS.map((item) => (
              <tr key={item.n} className={`w11-handoff-${item.owner}`}>
                <th scope="row">
                  <b>{item.n}</b>
                  <code>{item.step}</code>
                  <small>{item.w9}</small>
                </th>
                <td className="w11-handoff-w11">{item.w11}</td>
                <td>
                  <span className={`w11-owner-chip owner-${item.owner}`}>
                    {item.owner === "replaced"
                      ? "被替掉"
                      : item.owner === "replaced-machine"
                        ? "被替掉（依赖会关机的机器）"
                        : item.owner.replace("not-handed-", "")}
                  </span>
                  <GradeChip grade={item.grade} />
                </td>
                <td className="w11-handoff-why">{item.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="board-fold" aria-label="两类没被替掉的分界与第三类">
        <summary>
          <span className="board-fold-kicker">not handed over</span>
          <strong>两类「没被替掉」的分界 + 第三类</strong>
        </summary>
        <ul className="w11-handoff-not-handed">
          {HANDOFF_NOT_HANDED.map((item) => (
            <li key={item.kind}>
              <strong>{item.kind}</strong>
              <span>{item.note}</span>
            </li>
          ))}
          <li className="w11-handoff-third">
            <strong>第三类</strong>
            <span>{HANDOFF_THIRD_CLASS}</span>
          </li>
        </ul>
      </details>

      <PendingList
        title={`这一块的 ${HANDOFF_PENDING.length} 项待做`}
        kicker="handoff pending"
        items={HANDOFF_PENDING}
      />
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
        ⑧ 与 ⑨ 的材料来自 D3 附加项：手机远程触发展板发布的链路在 8/26 当晚端到端跑通并复盘。
        ④ 与 ⑪ 的证据在 8/27 的回滚演练与假 active 定论当天产生：前者三条路径的执行次数、
        后者与现场逐格的对照，都是当天的输出。⑪ 不在方法稿最初的编码表里，它的编码在数据层声明；
        ⑩ 这个编号留给方法稿里已定编码但尚未开工的那一块（执行期偏差落在哪些接触面）。
        剩下两块要等收口日：触发链路的终点还会变，手工对照要等对照说明成篇。
        范围与口径边界见 <code>week11-visualization-plan.md</code> §17、§19、§20。
      </p>
    </details>
  );
}
