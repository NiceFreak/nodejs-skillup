// W11 发布流水线板 · 阶段 1 三页：⑥·1 契约层、⑥·2 机制层、② 五阶段失败面。
// 展示资产（AGENTS.md 白名单）。
//
// 为什么先做 ⑥ 的两页而不是编号靠前的块：
// 八块里只有这两块在 D3–D5 不会再改——D1 那六条与 D2 那五条都已经发生完了。
// ③④⑤⑦ 的格子会在 D3 / D4 当天翻档，先做的会先过时。
//
// 为什么 ⑥ 是两页而不是一页：两批自纠不同族。⑥·1 那一列的答案全是「纸面推演」，
// ⑥·2 那一列全是「一条可以当场重跑的命令」——混成一页会把两种判断力说成一种。
//
// 本板没有主动回忆的复习门：问句属学习材料，按方法稿 §12 决策 4 由本人定稿，
// 这里只做阅读负担意义上的渐进层级（details 折叠原始证据与代价最高的两条）。
import {
  PAPER_CATCHER,
  RUNTIME_KIND,
  SELF_CHECKS_CONTRACT,
  SELF_CHECKS_RUNTIME,
  SERVER_STATE,
  STAGES,
  STAGE_CAVEATS,
  UNPLANNED_ENV,
  UNPLANNED_LOGIC,
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
            8/25 装起 controller 并跑通只构建与测试的三个阶段，完成变红实验与轮询自动触发；
            服务器在整个过程中保持零改动，由前后两次七项只读基线对照确认。
            部署段与回滚仍是纸面契约，每条事实均标明已实测、已拍板或待做。
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

/** 板头计数由数据算出，不手写：它同时是「这块板哪一半还是纸面」的诚实声明。 */
function GradeCount() {
  const counts = gradeCounts();
  return (
    <div className="w11-grade-count">
      <strong>
        {counts.measured} 已实测 · {counts.contract} 已拍板 · {counts.pending} 待做
      </strong>
      <small>只数已落地三页里的事实；未落地的五块见页尾进度</small>
    </div>
  );
}

function GradeLegend() {
  const grades = Object.keys(W11_GRADE) as W11Grade[];
  return (
    <details className="w11-grade-legend board-fold" aria-label="证据档位说明">
      <summary>
        <span className="board-fold-kicker">evidence grading</span>
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
        W11 周内「已拍板」与「待做」的区别在复盘时走两条路：前者是已经作出的决定，改它等于改决策；
        后者只是还没有量到的事实。部署段目前整段属于前者。
      </p>
    </details>
  );
}

/* ====================================================== ⑥·1 契约层（代表页之一） */

const PAPER_ORDER: PaperCatcher[] = ["conflict", "fact", "mechanism", "source"];

function ContractLayer() {
  const machine = machineCaughtCount();
  const byCatcher = PAPER_ORDER.map((key) => ({
    key,
    label: PAPER_CATCHER[key],
    items: SELF_CHECKS_CONTRACT.filter((c) => c.caughtBy === key),
  }));

  return (
    <section className="w11-contract" aria-label="契约冻结当天的六条自纠">
      <div className="w6-section-head">
        <span>contract self-check</span>
        <h3>契约冻结当天的六条自纠，全部由纸面推演发现</h3>
      </div>

      <p className="w11-lead">
        这六条都不是「写错了一个字」，而是两条各自成立的条款合起来不成立。
        发现它们时，流水线还不存在——契约在那一刻不是任何工具的输入。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{SELF_CHECKS_CONTRACT.length}</strong>
          <span>条自纠发生在动手之前</span>
        </div>
        <div>
          <strong>{PAPER_ORDER.length}</strong>
          <span>种发现方式，全部是人工推演与核对</span>
        </div>
        <div className="zero">
          <strong>{machine}</strong>
          <span>条由自动检查发现</span>
        </div>
      </div>

      {/* 空间编码：一条从「写下决策」到「开工」的时间轴。六条自纠全部落在契约期这一段，
          执行期那一段在本页上是空的——不是没画完，是那一段的证据属于 ⑥·2。
          「这一层没有机器手段可用」因此是位置关系，不是一句形容。 */}
      <div className="w11-timeline" aria-label="六条自纠在时间轴上的位置">
        <div className="w11-timeline-band paper">
          <div className="w11-band-head">
            <strong>契约期 · 只有纸面</strong>
            <small>决策写下来了，还没有任何东西在跑</small>
          </div>
          <div className="w11-band-lanes">
            {byCatcher.map((group) => (
              <div key={group.key} className="w11-band-lane">
                <span className="w11-band-lane-label">{group.label}</span>
                <div className="w11-band-marks">
                  {group.items.map((item) => (
                    <span key={item.id} className="w11-paper-marker" title={item.title}>
                      {item.tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w11-timeline-arrow" aria-hidden="true" />

        <div className="w11-timeline-band machine">
          <div className="w11-band-head">
            <strong>执行期 · 机器手段从这里才开始</strong>
            <small>构建记录、堆参数、轮询日志都要等到有东西在跑</small>
          </div>
          <p className="w11-band-empty">
            本页在这一段没有标记。它不是缺口：这一段发生的事在下一页（⑥·2 机制层）。
          </p>
        </div>
      </div>

      <p className="w11-timeline-legend">
        标记上的编号取自契约里的自查编号；两条没有编号的用短横线表示——它们是起草与核对时追加的，
        契约表里没有给它们编号。
      </p>

      <ol className="w11-correction-list">
        {SELF_CHECKS_CONTRACT.map((item) => (
          <li key={item.id} className="w11-correction">
            <b aria-hidden="true">{item.tag}</b>
            <div className="w11-correction-body">
              <div className="w11-correction-head">
                <strong>{item.title}</strong>
                <span className="w11-catcher-chip">{PAPER_CATCHER[item.caughtBy]}</span>
                <GradeChip grade={item.grade} />
              </div>
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
          </li>
        ))}
      </ol>

      <p className="w11-note" role="note">
        这一页与下一页的边界：这里讲动手之前，判断力来自把两条条款并排读；
        下一页讲动手之后，判断力来自一条可以当场重跑的命令。两页的结论同向——
        一份契约可以全都写着「对」，一条流水线也可以全都亮着绿。
      </p>
    </section>
  );
}

/* ====================================================== ⑥·2 机制层（代表页之一） */

function RuntimeLayer() {
  const criteria = SELF_CHECKS_RUNTIME.filter((c) => c.kind === "criterion");
  const costs = SELF_CHECKS_RUNTIME.filter((c) => c.kind === "cost");
  const maxBucket = Math.max(...UNPLANNED_ENV.map((b) => b.n));

  return (
    <section className="w11-runtime" aria-label="执行期十四条计划外事件">
      <div className="w6-section-head">
        <span>runtime self-check</span>
        <h3>执行当天的十四条计划外事件，没有一条出在流水线逻辑上</h3>
      </div>

      <p className="w11-lead">
        阶段怎么划分、每一阶段跑什么，一次就对。当天的时间全部花在构建环境与工具的实际行为上——
        把一段手工操作交给机器，改写的不是逻辑，是环境假设。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{UNPLANNED_TOTAL}</strong>
          <span>条计划外事件</span>
        </div>
        <div className="zero">
          <strong>{UNPLANNED_LOGIC.length}</strong>
          <span>条出在流水线逻辑上</span>
        </div>
        <div>
          <strong>{criterionCount()}</strong>
          <span>条属判据级：换一套工具仍会遇到</span>
        </div>
      </div>

      {/* 空间编码：两栏。左栏「流水线逻辑」必须渲染出来且是空的——
          补满它图会更整齐，结论会变成谎话。右栏按成本落点分组，条形长度就是条数。 */}
      <div className="w11-split" aria-label="十四条计划外事件的成本落点">
        <div className="w11-split-col logic">
          <div className="w11-split-head">
            <strong>流水线逻辑</strong>
            <em>{UNPLANNED_LOGIC.length}</em>
          </div>
          <p className="w11-split-empty">
            这一栏是空的。阶段划分、每一阶段的入口动作与失败条件，来自冻结的契约，执行当天没有改过一次。
          </p>
        </div>

        <div className="w11-split-col env">
          <div className="w11-split-head">
            <strong>构建环境与工具行为</strong>
            <em>{UNPLANNED_TOTAL}</em>
          </div>
          <ul className="w11-bucket-list">
            {UNPLANNED_ENV.map((bucket) => (
              <li key={bucket.id} className="w11-bucket">
                <div className="w11-bucket-head">
                  <strong>{bucket.bucket}</strong>
                  <b>{bucket.n}</b>
                </div>
                <i
                  className="w11-bucket-bar"
                  style={{ width: `${(bucket.n / maxBucket) * 100}%` }}
                  aria-hidden="true"
                />
                <p>{bucket.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="w6-section-head w11-sub-head">
        <span>criterion level</span>
        <h3>判据级的三条：每一条都要一条命令才看得见</h3>
      </div>

      <ol className="w11-correction-list">
        {criteria.map((item) => (
          <li key={item.id} className="w11-correction runtime">
            <b aria-hidden="true">{RUNTIME_KIND[item.kind]}</b>
            <div className="w11-correction-body">
              <div className="w11-correction-head">
                <strong>{item.title}</strong>
                <GradeChip grade={item.grade} />
              </div>
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
                <span>抓到它的那条命令</span>
                <b>{item.command}</b>
                {item.commandNote}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <details className="w11-costs board-fold">
        <summary>
          <span className="board-fold-kicker">most expensive</span>
          <strong>另外两条不判据级，但当天代价最高</strong>
        </summary>
        <ol className="w11-correction-list">
          {costs.map((item) => (
            <li key={item.id} className="w11-correction runtime cost">
              <b aria-hidden="true">{RUNTIME_KIND[item.kind]}</b>
              <div className="w11-correction-body">
                <div className="w11-correction-head">
                  <strong>{item.title}</strong>
                  <GradeChip grade={item.grade} />
                </div>
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
                  <span>抓到它的那条命令</span>
                  <b>{item.command}</b>
                  {item.commandNote}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </details>

      <p className="w11-note" role="note">
        第一条是这三条里最值钱的：它被发现的唯一原因，是开工前有人问了一句
        「那条验证对它要验的东西敏感吗」。一条不敏感的验证，等于一格假绿——
        与上一页那六条同向，只是这一层已经有了可用的机器，而机器给的是绿灯。
      </p>
    </section>
  );
}

/* ============================================================ ② 五阶段的失败面 */

function Stages() {
  const risk = riskStageCount();
  const measured = STAGES.filter((s) => s.grade === "measured").length;
  const untouched = STAGES.filter((s) => s.serverState === "untouched");

  return (
    <section className="w11-stages-block" aria-label="五个阶段各自的失败面">
      <div className="w6-section-head">
        <span>failure surface</span>
        <h3>五个阶段里，只有跨过中线的那一个能让服务器停在中间态</h3>
      </div>

      <p className="w11-lead">
        阶段在哪一侧执行，和它失败时能造成什么后果，是同一条线。
        前三个阶段整段都在开发机上，因此它们失败时服务器保持上一轮部署的版本。
      </p>

      <div className="w11-verdict">
        <div>
          <strong>{STAGES.length}</strong>
          <span>个阶段，一次提交依次经过</span>
        </div>
        <div>
          <strong>{measured}</strong>
          <span>个阶段已有构建记录，其余仍是纸面契约</span>
        </div>
        <div className="alert">
          <strong>{risk}</strong>
          <span>个阶段失败时服务器可能处于中间态</span>
        </div>
      </div>

      {/* 空间编码：一条横轴，左半是 controller，右半是服务器，中间一条分界线。
          第 4 阶段是唯一一个横跨分界线的格子（两段底色），也是唯一一个下方状态是
          「可能中间态」的格子——两件事对齐在同一列上，不需要文字来连。 */}
      <div className="w11-rail" aria-label="五个阶段与它们所在的一侧">
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
          <div
            className="w11-state untouched"
            style={{ gridColumn: `span ${UNTOUCHED_SPAN}` }}
          >
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
        前 {untouched.length} 个阶段共用同一段状态，因此画成一整段而不是三段各写一次：
        它们不是各自「碰巧没影响」，而是同一个原因——都还没跨过那条线。
      </p>

      <ol className="w11-stage-list">
        {STAGES.map((stage) => (
          <li key={stage.id} className={`w11-stage-item side-${stage.side}`}>
            <div className="w11-stage-item-head">
              <b>{stage.n}</b>
              <strong>{stage.name}</strong>
              <span className="w11-side-chip">
                {stage.side === "controller" ? "controller" : stage.side === "cross" ? "跨中线" : "服务器"}
              </span>
              <GradeChip grade={stage.grade} />
            </div>
            {/* 三段并排（宽屏）：它们是同一件事的三个侧面，竖着排会把这一页拉长一屏。 */}
            <div className="w11-stage-trio">
              <p className="w11-stage-entry">
                <span>做什么</span>
                {stage.entry}
              </p>
              <p className="w11-stage-fail">
                <span>什么算失败</span>
                {stage.fail}
              </p>
              <p className="w11-stage-after">
                <span>失败之后谁来动</span>
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
                <span>证据差在哪</span>
                {stage.caveat}
              </p>
            )}
          </li>
        ))}
      </ol>

      {STAGE_CAVEATS.map((item) => (
        <p key={item.id} className="w11-note" role="note">
          <b>{item.title}</b>
          {item.body}
        </p>
      ))}

      <details className="w11-zero board-fold">
        <summary>
          <span className="board-fold-kicker">zero change</span>
          <strong>「服务器零改动」是怎么被证明的</strong>
        </summary>
        <p className="w11-zero-lead">
          装 controller 之前采一次七项只读基线，九步全部走完之后用同样的命令再采一次，逐行比对。
          这是本板上唯一一条有对照组的「未发生」。
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
          <span>这次对照暴露的方法问题</span>
          {ZERO_CHANGE.lesson}
        </p>
      </details>
    </section>
  );
}

/* ------------------------------------------------------------------ 阶段进度 */

/**
 * 这块进度表的用途是不把做了三页呈现成 W11 已经做完：
 * 剩下五块的材料要等 D3 / D4 / D5 才产生，先画等于把预测画成实测。
 */
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
        顺序按事实稳定时间排列：⑥ 的两页取自已经发生完的两批自纠，D3–D5 不会再改动；
        ② 的前三个阶段在 8/25 拿到构建记录，后两个阶段仍是纸面。
        其余五块的格子会在部署段打通、回滚演练与收口日当天翻档，先画会先过时。
        范围与口径边界见 <code>week11-visualization-plan.md</code>。
      </p>
    </details>
  );
}
