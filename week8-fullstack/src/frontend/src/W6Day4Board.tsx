// W6 Day 4「W3–W6 整体技术总结」板。展示资产（AGENTS.md 白名单）。
//
// 与 Day 1–3 的分工：前三天各自证明一件事，Day 4 不新增功能，而是把四周收束成
// 一条有因果关系的主线，并明确没有证明什么。所以这块板的形状是「框架 → 主线 →
// 职责 → 证据 → 纠错 → 限制 → 归属」，不是又一份知识点列表。
//
// 复用 Day 1–3 的外壳类（w6-head / w6-section-head），Day 4 专属可视化用 d4- 前缀。
import { useEffect, useState } from "react";
import { MetricBar, metricRowScale } from "./charts";
import { EVIDENCE_SETS } from "./evidenceSets";
import type { BoardMode } from "./types";
import {
  CORRECTION_KIND_LABEL,
  D4_CORRECTIONS,
  D4_DEBT_CHAIN,
  D4_DIMENSIONS,
  D4_ENDPOINTS,
  D4_LAYERS,
  D4_LIMITS,
  D4_MAINLINE,
  D4_SHAPE_NOTE,
  D4_VERIFICATION,
} from "./w6Day4";

export default function W6Day4Board({
  mode,
  revealed,
  onReveal,
}: {
  mode: BoardMode;
  revealed: boolean;
  onReveal: () => void;
}) {
  const review = mode === "review";
  const showEvidence = !review || revealed;

  return (
    <>
      <header className="w6-head">
        <div>
          <span>W6 · Summary / Day 4</span>
          <h2>四周收束成一条主线，并说清没有证明什么</h2>
          <p>
            Day 4 没有继续增加功能。它把 W3 聚合与优化、W4 认证鉴权、W5 运行时、W6 测试与 CI
            串成一条有因果关系的技术主线，用四个维度组织：契约、职责、证据、限制。
          </p>
        </div>
        <strong>无阻断性问题 · 可验收</strong>
      </header>

      <DimensionFrame />
      <Mainline />
      <LayerShapes />
      <EvidenceLayers review={review} showEvidence={showEvidence} onReveal={onReveal} />
      <Corrections review={review} />
      <Limits />
      <DebtChain />
      <Verification />
    </>
  );
}

/* ① 四维框架：Day 4 的论证顺序本身。 */
function DimensionFrame() {
  return (
    <section className="d4-frame" aria-label="四个收束维度">
      <div className="w6-section-head">
        <span>organizing frame</span>
        <h3>不按「学了哪些技术」组织，按「凭什么相信它」组织</h3>
      </div>
      <div className="d4-frame-grid">
        {D4_DIMENSIONS.map((item, index) => (
          <article key={item.id} className={item.tone}>
            <b aria-hidden="true">{index + 1}</b>
            <span>{item.step}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ② 主线因果链：每周解决什么、交给下一环什么，终点是三种业务结局。 */
function Mainline() {
  return (
    <section className="d4-mainline" aria-label="W3 到 W6 因果主线">
      <div className="w6-section-head">
        <span>causal mainline</span>
        <h3>四周不是四个话题，是同一条链上的四段</h3>
      </div>

      <div className="d4-chain">
        {D4_MAINLINE.map((item) => (
          <article key={item.id} className={item.tone}>
            <header>
              <span>{item.week}</span>
              <strong>{item.theme}</strong>
            </header>
            <p className="d4-chain-solves">
              <b>解决</b>
              {item.solves}
            </p>
            <p className="d4-chain-handoff">
              <b>交出</b>
              {item.handoff}
            </p>
          </article>
        ))}
      </div>

      <div className="d4-endpoints">
        <span className="d4-endpoints-label">同一个 admin-only 资源的三种结局</span>
        {D4_ENDPOINTS.map((item) => (
          <div key={item.status} className={`d4-endpoint ${item.tone}`}>
            <strong>{item.path}</strong>
            <i aria-hidden="true">→</i>
            <span>{item.stop}</span>
            <em>{item.status}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ③ 跨层交付物形状：重点不是层数，是每层交出的东西形状不同。 */
function LayerShapes() {
  return (
    <section className="d4-layers" aria-label="跨层职责与返回值">
      <div className="w6-section-head">
        <span>delivery shapes</span>
        <h3>十层里没有两层交出同一种东西</h3>
      </div>

      <div className="d4-layer-table" role="table" aria-label="每层职责与交付物">
        <div className="d4-layer-head" role="row">
          <span role="columnheader">层</span>
          <span role="columnheader">当前职责</span>
          <span role="columnheader">返回值或交付物</span>
        </div>
        {D4_LAYERS.map((row) => (
          <div key={row.layer} className={`d4-layer-row ${row.shape}`} role="row">
            <span className="d4-layer-name" role="cell">{row.layer}</span>
            <span className="d4-layer-duty" role="cell">{row.duty}</span>
            <span className="d4-layer-deliver" role="cell">{row.deliver}</span>
          </div>
        ))}
      </div>

      <p className="d4-shape-note" role="note">
        <b>最容易讲错的一条</b>
        {D4_SHAPE_NOTE}
      </p>
    </section>
  );
}

/* ④ 三组代表证据：数字来自共享的 EVIDENCE_SETS，这里按「三层各出一组」呈现。 */
function EvidenceLayers({
  review,
  showEvidence,
  onReveal,
}: {
  review: boolean;
  showEvidence: boolean;
  onReveal: () => void;
}) {
  const [activeSet, setActiveSet] = useState(EVIDENCE_SETS[0].id);
  const set = EVIDENCE_SETS.find((item) => item.id === activeSet) ?? EVIDENCE_SETS[0];
  const hasBase = set.metrics.some((m) => m.base !== undefined);

  return (
    <section className="d4-evidence" aria-label="三组代表实验">
      <div className="w6-section-head">
        <span>controlled experiments</span>
        <h3>数据层、运行时层、验证层各出一组受控实验</h3>
      </div>

      <div className="d4-set-switch" role="group" aria-label="实验组">
        {EVIDENCE_SETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === set.id ? "on" : ""}
            aria-pressed={item.id === set.id}
            onClick={() => setActiveSet(item.id)}
          >
            <span>{item.week}</span>
            <strong>{item.title}</strong>
            <small>{item.layer}</small>
          </button>
        ))}
      </div>

      {!showEvidence ? (
        <div className="d4-reveal-gate">
          <strong>先预测：{set.title}</strong>
          <p>
            受控变量是「{set.variable}」。在展开之前，说出这组数字<b>能</b>支持哪一句具体结论，
            以及它<b>不能</b>推出什么。
          </p>
          <button type="button" onClick={onReveal}>展开指标与边界</button>
        </div>
      ) : (
        <>
          <p className="d4-variable">
            <b>受控变量</b>
            {set.variable}
          </p>

          <div className={`d4-metrics${hasBase ? " with-base" : ""}`} role="table" aria-label={`${set.title} 指标对照`}>
            <div className="d4-metrics-head" role="row">
              <span role="columnheader">指标</span>
              {hasBase && <span role="columnheader">{set.baseLabel}</span>}
              <span role="columnheader">{set.beforeLabel}</span>
              <span aria-hidden="true" />
              <span role="columnheader">{set.afterLabel}</span>
            </div>
            {set.metrics.map((metric) => {
              // 同 W3 的 explain：差距是结论的那几行补长度编码，一行共用一把尺、单位必须一致。
              // W6 那组是类别型对照（数据库来源、隔离方式），一格都解析不出量，因此整组不画——
              // 这正是判据要的：没有比较价值的东西不画成有刻度的量。
              const scale = metricRowScale([hasBase ? metric.base : null, metric.before, metric.after]);
              const cell = (t?: string | null, tone: "base" | "before" | "after" = "before") => {
                const v = scale?.valueOf(t) ?? null;
                return scale && v !== null ? <MetricBar value={v} max={scale.max} tone={tone} /> : null;
              };
              return (
                <div key={metric.label} className={`d4-metric-row${metric.highlight ? " key" : ""}`} role="row">
                  <code role="cell">{metric.label}</code>
                  {hasBase && (
                    <span className="base" role="cell">
                      {metric.base ?? "—"}
                      {cell(metric.base, "base")}
                    </span>
                  )}
                  <span className="before" role="cell">
                    {metric.before}
                    {cell(metric.before, "before")}
                  </span>
                  <i aria-hidden="true">→</i>
                  <span className="after" role="cell">
                    {metric.after}
                    {cell(metric.after, "after")}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="d4-boundary">
            <article className="proves">
              <span>能证明</span>
              <p>{set.proves}</p>
            </article>
            <article className="limits">
              <span>不能证明 / 不能外推</span>
              <p>{set.limits}</p>
            </article>
          </div>
        </>
      )}

      {review && showEvidence && (
        <p className="d4-cross-ref" role="note">
          同一组数字在「面试准备」板还有一份按「被追问时怎么报」组织的用法；两处读的是同一份
          <code>evidenceSets.ts</code>，不会漂移。
        </p>
      )}
    </section>
  );
}

/* ⑤ 关键纠错：Day 4 最有复习价值的一张表。复习态先只给初始说法，让人自己找问题。 */
function Corrections({ review }: { review: boolean }) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  // 整节的展开状态按视角给不同默认值（阶段二第 3 步）：
  // - 展示态：收起。九条全部摊开是这块板最大的一坨（实测 1735px / 全块 34%），
  //   而它回答的是「哪些说法被推翻」，不是本块验收句「收束成一条主线 + 没有证明什么」。
  // - 复习态：展开。那里逐条本来就先只给初始说法，是主动回忆的有意设计，一点未动；
  //   再套一层折叠只会多一次点击。
  // 受控 details：不受控的话，点开某一条触发重渲染会把整节又合上。
  const [sectionOpen, setSectionOpen] = useState(review);

  useEffect(() => {
    setOpenIds(review ? [] : D4_CORRECTIONS.map((item) => item.id));
    setSectionOpen(review);
  }, [review]);

  const allOpen = openIds.length === D4_CORRECTIONS.length;

  return (
    <details
      className="d4-corrections board-fold"
      aria-label="关键纠错"
      open={sectionOpen}
      onToggle={(e) => setSectionOpen(e.currentTarget.open)}
    >
      <summary>
        <span className="board-fold-kicker">corrections</span>
        <strong>九条初始说法被推翻，留下的是修正后的版本</strong>
      </summary>
      <p className="d4-corrections-lead">
        这张表比结论本身更值得复习：它记录的是<b>哪一类推理会出错</b> ——
        结论超出证据、调用顺序、概念混淆、证据不成立、边界归属。
        {review && !allOpen && "复习态先只给初始说法，自己判断问题出在哪一步，再展开核对。"}
      </p>

      {review && !allOpen && (
        <button
          type="button"
          className="d4-reveal-all"
          onClick={() => setOpenIds(D4_CORRECTIONS.map((item) => item.id))}
        >
          全部展开核对
        </button>
      )}

      <ol className="d4-correction-list">
        {D4_CORRECTIONS.map((item, index) => {
          const open = openIds.includes(item.id);
          return (
            <li key={item.id} className={`d4-correction ${item.kind}${open ? " open" : ""}`}>
              <b aria-hidden="true">{index + 1}</b>
              <div className="d4-correction-body">
                <p className="d4-correction-initial">
                  <span>❌ 初始说法</span>
                  {item.initial}
                </p>
                {open ? (
                  <>
                    <p className="d4-correction-problem">
                      <span>问题</span>
                      <em>{CORRECTION_KIND_LABEL[item.kind]}</em>
                      {item.problem}
                    </p>
                    <p className="d4-correction-final">
                      <span>✅ 最终结论</span>
                      {item.final}
                    </p>
                  </>
                ) : (
                  <button type="button" onClick={() => setOpenIds((ids) => [...ids, item.id])}>
                    这句错在哪一步？展开核对
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/* ⑥ 当前限制：与证据一一相对的「没有证明什么」。 */
function Limits() {
  return (
    <section className="d4-limits" aria-label="当前限制">
      <div className="w6-section-head">
        <span>known limits</span>
        <h3>明确没有证明的六件事</h3>
      </div>
      <div className="d4-limit-grid">
        {D4_LIMITS.map((item) => (
          <article key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <p className="d4-limit-rule">
        当前成果是受控学习项目：它证明本地与 CI 中的关键链路、分层判断和实验方法成立，
        <b>不证明</b>生产吞吐、最优 Worker 数量、完整安全防护或生产部署拓扑已经验收。
      </p>
    </section>
  );
}

/* ⑦ AI 协作与债务：一条从记账到还清的时间线。 */
function DebtChain() {
  return (
    <details className="d4-debt board-fold" aria-label="AI 协作与债务">
      <summary>
        <span className="board-fold-kicker">capability ownership</span>
        <strong>代码由谁提交不能证明能力归属，延迟后能不能独立重建才能</strong>
      </summary>
      <ol className="d4-debt-chain">
        {D4_DEBT_CHAIN.map((item) => (
          <li key={item.date + item.event} className={item.tone}>
            <span className="d4-debt-date">{item.date}</span>
            <strong>{item.event}</strong>
            <p>{item.detail}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

/* ⑧ 最终验证：Day 4 当天实际跑过的命令。 */
function Verification() {
  return (
    <details className="d4-verify board-fold" aria-label="最终验证">
      <summary>
        <span className="board-fold-kicker">final verification</span>
        <strong>2026-07-30 实际运行的结果</strong>
      </summary>
      <ul className="d4-verify-list">
        {D4_VERIFICATION.map((item) => (
          <li key={item.cmd}>
            <i aria-hidden="true">{item.ok ? "✓" : "✕"}</i>
            <code>{item.cmd}</code>
            <span>{item.result}</span>
          </li>
        ))}
      </ul>
      <p className="d4-verify-note">
        技术英语口语稿正文 138 词，符合 120–150 词要求。剩余锦上添花项是按最终 demo 讲稿完成一次计时彩排 ——
        不彩排的代价是现场容易超时，不改变技术总结已经通过的事实。
      </p>
    </details>
  );
}
