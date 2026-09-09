// W13 RAG 输入工程的两块图（最小可交付集）。形态由内容关系推导，见
// week13-rag/notes/week13-visualization-plan.md §5：
//   T3 = 共用基线瀑布（一降两升，方向本身是信息）+ 单个 entry 的四层变形（逐帧）
//   T5 = 验证手段 × 被验证对象的覆盖矩阵（空格即该手段管不到）+ 检查清单联动
//
// 承担结论的位置编码（改 CSS 前先看 scripts/verify-w9-board.mjs §F）：
//   T3 下降段的起点在核心正文的终点 = 原文里有一段从不进入任何块；
//   T3 四帧只增不减 = 每一层都是在上一层字节上包一圈；
//   T5 content_sha256 那一行只有一格有值 = 指纹的盲区；职责边界那一列只落在「无自动化」行。
import { useEffect, useMemo, useState } from "react";
import { FrameNarration, FrameTransport, dwellByText, useFramePlayer, usePrefersReducedMotion } from "./framePlayer";
import { W13_RAG_DATA } from "./w13RagData";
import {
  W13_STALE_CHECKS,
  W13_UNMAPPED_TESTS,
  type W13Check,
  type W13CompositionTopic,
  type W13CoverageTopic,
  type W13Layer,
  type W13MeansId,
  type W13ObjectId,
} from "./w13RagTopics";

const D = W13_RAG_DATA;
const n = (v: number) => v.toLocaleString("zh-CN");
const pct = (v: number, max: number) => `${((v / max) * 100).toFixed(3)}%`;

/* ================================================== T3 组装与组成 */

const LAYER_ORDER: W13Layer[] = ["core", "context", "wrapper", "separator"];

export function W13CompositionVisual({ topic }: { topic: W13CompositionTopic }) {
  const max = Math.max(...topic.steps.map((s) => (s.role === "total" ? s.value : (s.from ?? 0) + s.value)));
  const reduced = usePrefersReducedMotion();
  const player = useFramePlayer(topic.frames.length, {
    autoPlay: false,
    intervalAt: (index) => dwellByText(topic.frames[index]?.text ?? ""),
  });
  // reduced-motion：静止时信息不减——直接停在终态，单步控件仍在。
  useEffect(() => {
    if (reduced) player.seek(topic.frames.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时按偏好定位一次
  }, [reduced]);
  const shown = (layer: W13Layer) => LAYER_ORDER.indexOf(layer) <= player.index;
  const frame = topic.frames[player.index];

  const sample = D.sample;
  const layerChars: Record<W13Layer, number> = {
    core: sample.core.length,
    context: sample.modelContent.length - sample.core.length,
    wrapper: sample.serialized.length - sample.modelContent.length,
    separator: 2,
  };
  const sampleTotal = LAYER_ORDER.filter(shown).reduce((s, l) => s + layerChars[l], 0);
  const openTag = `<source id="${sample.sourceId}">`;
  const nextOpenTag = `<source id="${sample.nextSourceId}">`;

  const fallLabel = topic.steps
    .map((s) => `${s.label} ${s.role === "delta" ? (s.direction === "down" ? "−" : "+") : ""}${n(s.value)}`)
    .join("；");

  return (
    <section className="w13-comp" aria-label="Evidence Context 的组成">
      <div className="w13-comp-main">
        <figure
          className="w13-fall"
          data-anchor="w13-composition-waterfall"
          data-mobile-visual="rag-composition"
          role="img"
          aria-label={`共用基线瀑布，单位字符：${fallLabel}`}
        >
          <figcaption>
            <b>全语料字符数的一降两升</b>
            <span>共用基线，单位 chars；不是 token，也不是 bytes</span>
          </figcaption>
          <ol className="w13-fall-rows">
            {topic.steps.map((s) => {
              const start = s.role === "total" ? 0 : (s.from ?? 0);
              const end = start + s.value;
              return (
                <li
                  key={s.id}
                  className={`w13-fall-row ${s.role}${s.direction ? ` ${s.direction}` : ""}`}
                  data-step={s.id}
                  data-role={s.role}
                  data-layer={s.layer ?? ""}
                >
                  <span className="w13-fall-label">{s.label}</span>
                  <span className="w13-fall-track">
                    <i
                      className="w13-fall-bar"
                      data-layer={s.layer ?? ""}
                      style={{ left: pct(start, max), width: pct(s.value, max) }}
                      title={s.detail}
                    />
                    <em className="w13-fall-value" style={{ left: pct(end, max) }}>
                      {s.role === "delta" ? (s.direction === "down" ? "−" : "+") : ""}
                      {n(s.value)}
                    </em>
                  </span>
                  <small className="w13-fall-detail">{s.detail}</small>
                </li>
              );
            })}
          </ol>
        </figure>

        <div className="w13-entry" data-frame={frame?.layer ?? "core"} data-frame-index={player.index}>
          <header className="w13-entry-head">
            <b>单个 entry 的四层</b>
            <code>{sample.sourceId}</code>
          </header>
          <pre className="w13-entry-bytes" aria-label={`当前显示到第 ${player.index + 1} 层，共 ${n(sampleTotal)} chars`}>
            {shown("wrapper") && <span className="w13-byte wrapper" data-layer="wrapper">{openTag}{"\n"}</span>}
            {shown("context") && sample.contextParts.map((part) => (
              <span key={part.span} className="w13-byte context" data-layer="context" data-role={part.role}>{part.text}</span>
            ))}
            <span className="w13-byte core" data-layer="core">{sample.core}</span>
            {shown("wrapper") && <span className="w13-byte wrapper" data-layer="wrapper">{"</source>"}</span>}
            {shown("separator") && (
              <>
                <span className="w13-byte separator" data-layer="separator">{"\n\n"}</span>
                <span className="w13-byte next" aria-hidden="true">{nextOpenTag}{"\n…"}</span>
              </>
            )}
          </pre>
          <div className="w13-entry-scale" role="img" aria-label={`本 entry 各层字符数：核心 ${layerChars.core}，语境 ${layerChars.context}，wrapper ${layerChars.wrapper}，块间空行 ${layerChars.separator}`}>
            {LAYER_ORDER.map((layer) => (
              <i
                key={layer}
                className={`w13-entry-seg ${layer}${shown(layer) ? " on" : ""}`}
                data-layer={layer}
                style={{ flexGrow: layerChars[layer] }}
              >
                {shown(layer) && layerChars[layer] >= 40 ? layerChars[layer] : null}
              </i>
            ))}
            <b>{n(sampleTotal)} chars</b>
          </div>
          <ul className="w13-entry-legend">
            {topic.layerLegend.map((item) => (
              <li key={item.layer} data-layer={item.layer} className={shown(item.layer) ? "on" : ""}>
                <i aria-hidden="true">{item.glyph}</i>
                {item.label}
              </li>
            ))}
          </ul>
          <div className="w13-entry-frames">
            <FrameTransport player={player} length={topic.frames.length} label="逐层组装" />
            <ol className="ae-frame-track w13-frame-track">
              {topic.frames.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={index === player.index ? "on" : ""}
                    data-layer={item.layer}
                    data-index={index}
                    aria-current={index === player.index}
                    onClick={() => player.seek(index)}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ol>
            <FrameNarration step={player.index + 1} text={frame?.text ?? ""} />
          </div>
        </div>
      </div>

      <details className="w13-fold">
        <summary>四条组装规则：wrapper 字节、块间空行、hash 范围、thematic break 与空行</summary>
        <ol className="w13-rules">
          {topic.rules.map((rule) => (
            <li key={rule.title}>
              <strong>{rule.title}</strong>
              <p>{rule.text}</p>
              <em>{rule.ref}</em>
            </li>
          ))}
        </ol>
      </details>

      <details className="w13-fold">
        <summary>瀑布数据表（同一组数字的表格视图）</summary>
        <table className="w13-table">
          <thead>
            <tr><th>项</th><th>字符数</th><th>方向</th><th>来源与说明</th></tr>
          </thead>
          <tbody>
            {topic.steps.map((s) => (
              <tr key={s.id} data-role={s.role}>
                <th scope="row">{s.label}</th>
                <td>{n(s.value)}</td>
                <td>{s.role === "total" ? "合计" : s.direction === "down" ? "下降" : "上升"}</td>
                <td>{s.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

/* ================================================== T5 验证与证据 */

type Focus = { type: "cell"; means: W13MeansId; object: W13ObjectId } | { type: "check"; id: string } | null;

const CHECK_KIND_LABEL: Record<W13Check["kind"], string> = {
  test: "tests/ 里的 pytest",
  build: "构建期前置检查（registry.py 抛错）",
  manual: "无自动化断言",
};

export function W13CoverageVisual({ topic }: { topic: W13CoverageTopic }) {
  const [focus, setFocus] = useState<Focus>(null);

  const cellChecks = useMemo(() => {
    const map = new Map<string, W13Check[]>();
    for (const check of topic.checks) {
      for (const [m, o] of check.cells) {
        const key = `${m}/${o}`;
        map.set(key, [...(map.get(key) ?? []), check]);
      }
    }
    return map;
  }, [topic.checks]);

  const cellOn = (m: W13MeansId, o: W13ObjectId) => {
    if (!focus) return false;
    if (focus.type === "cell") return focus.means === m && focus.object === o;
    return (cellChecks.get(`${m}/${o}`) ?? []).some((c) => c.id === focus.id);
  };
  const checkOn = (check: W13Check) => {
    if (!focus) return false;
    if (focus.type === "check") return focus.id === check.id;
    return check.cells.some(([m, o]) => m === focus.means && o === focus.object);
  };
  const toggleCell = (m: W13MeansId, o: W13ObjectId) =>
    setFocus((prev) => (prev?.type === "cell" && prev.means === m && prev.object === o ? null : { type: "cell", means: m, object: o }));
  const toggleCheck = (id: string) =>
    setFocus((prev) => (prev?.type === "check" && prev.id === id ? null : { type: "check", id }));

  const groups: Array<{ kind: W13Check["kind"]; items: W13Check[] }> = (["test", "build", "manual"] as const).map((kind) => ({
    kind,
    items: topic.checks.filter((c) => c.kind === kind),
  }));
  const auditClean = D.audit.every((a) => a.uncovered === 0 && a.duplicated === 0);

  return (
    <section className="w13-cov" aria-label="验证手段与被验证对象的覆盖">
      <div className="w13-cov-main">
        <div
          className="w13-cov-matrix"
          data-mobile-visual="rag-coverage"
          role="table"
          aria-label="验证手段（行）× 被验证对象（列）的覆盖矩阵；有值的格表示至少一条检查落在这里，空格表示该手段管不到该对象"
          style={{ ["--w13-cols" as string]: topic.objects.length }}
        >
          <div className="w13-cov-head" role="row">
            <span role="columnheader" className="w13-cov-corner">
              <b>验证手段 ↓</b>
              <b>被验证对象 →</b>
            </span>
            {topic.objects.map((o) => (
              <span key={o.id} role="columnheader" data-object={o.id}>{o.label}</span>
            ))}
          </div>
          {topic.means.map((m) => {
            const filled = topic.objects.filter((o) => (cellChecks.get(`${m.id}/${o.id}`) ?? []).length > 0).length;
            return (
              <div
                key={m.id}
                className="w13-cov-row"
                role="row"
                data-means={m.id}
                data-filled={filled}
                data-anchor={m.id === "hash" ? "w13-hash-row-single-cell" : undefined}
              >
                <span role="rowheader" className="w13-cov-rowhead">
                  <b>{m.label}</b>
                  <small>{m.note}</small>
                </span>
                {topic.objects.map((o) => {
                  const checks = cellChecks.get(`${m.id}/${o.id}`) ?? [];
                  const covered = checks.length > 0;
                  return (
                    <span key={o.id} role="cell" className="w13-cov-cellwrap">
                      <button
                        type="button"
                        className={`w13-cov-cell${covered ? " covered" : " none"}${cellOn(m.id, o.id) ? " on" : ""}`}
                        data-means={m.id}
                        data-object={o.id}
                        data-state={covered ? "covered" : "none"}
                        aria-pressed={focus?.type === "cell" && focus.means === m.id && focus.object === o.id}
                        aria-label={`${m.label} 对 ${o.label}：${covered ? `${checks.length} 项检查` : "管不到"}`}
                        onClick={() => toggleCell(m.id, o.id)}
                      >
                        <small className="w13-cov-obj">{o.label}</small>
                        <i aria-hidden="true">{covered ? "■" : "□"}</i>
                        <span>{covered ? `${checks.length} 项` : "管不到"}</span>
                      </button>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>

        <aside className="w13-cov-checks" aria-label="检查清单，点击与矩阵格互相高亮">
          {groups.map((group) => (
            <section key={group.kind} className="w13-cov-group" data-kind={group.kind}>
              <h4>
                {CHECK_KIND_LABEL[group.kind]}
                <b>{group.items.length}</b>
              </h4>
              <ul>
                {group.items.map((check) => (
                  <li key={check.id}>
                    <button
                      type="button"
                      className={`w13-cov-check${checkOn(check) ? " on" : ""}`}
                      data-check={check.id}
                      data-kind={check.kind}
                      data-test-name={check.kind === "test" ? check.name : undefined}
                      aria-pressed={focus?.type === "check" && focus.id === check.id}
                      onClick={() => toggleCheck(check.id)}
                    >
                      <code>{check.file ? `${check.file} · ` : ""}{check.name}</code>
                      <span>{check.label}</span>
                      <em>{check.cells.length} 格</em>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {(W13_UNMAPPED_TESTS.length > 0 || W13_STALE_CHECKS.length > 0) && (
            <p className="w13-cov-warn" data-unmapped={W13_UNMAPPED_TESTS.length} data-stale={W13_STALE_CHECKS.length}>
              映射与数据层不一致：未映射的测试 {W13_UNMAPPED_TESTS.join(", ") || "无"}；已不存在的测试 {W13_STALE_CHECKS.join(", ") || "无"}。
            </p>
          )}
        </aside>
      </div>

      <ul className="w13-cov-facts" aria-label="确定性层的三条已实测事实">
        <li data-fact="audit" data-ok={auditClean}>
          <b>{auditClean ? "0 / 0" : "有残留"}</b>
          <span>{D.audit.length} 份文档的 uncovered / duplicated（criteria-report）</span>
        </li>
        <li data-fact="two-pass" data-ok={D.twoPassIdentical}>
          <b>{D.twoPassIdentical ? "逐字节一致" : "不一致"}</b>
          <span>两次独立构建的 Evidence Context 整串</span>
        </li>
        <li data-fact="frozen" data-ok={D.frozenMatches}>
          <b>{D.frozenMatches ? "= 冻结基准" : "≠ 冻结基准"}</b>
          <span>整串 sha256 <code>{D.evidenceContextSha256.slice(0, 8)}…</code>（导出脚本复算）</span>
        </li>
      </ul>

      <details className="w13-fold">
        <summary>判据 #1–#7 逐字原文，及各自落在矩阵的哪些格</summary>
        <ol className="w13-criteria">
          {topic.criteria.map((c) => (
            <li key={c.no} data-criterion={c.no}>
              <b>#{c.no}</b>
              <p>{c.text}</p>
              <em>
                {c.cells.map(([m, o]) => `${topic.means.find((x) => x.id === m)?.label} × ${topic.objects.find((x) => x.id === o)?.label}`).join("；")}
              </em>
            </li>
          ))}
        </ol>
      </details>

      <details className="w13-fold">
        <summary>criteria-report 的逐文档覆盖审计表</summary>
        <table className="w13-table">
          <thead>
            <tr><th>文档</th><th>行数</th><th>blocks</th><th>uncovered</th><th>duplicated</th></tr>
          </thead>
          <tbody>
            {D.audit.map((a) => (
              <tr key={a.sourcePath}>
                <th scope="row">{a.sourcePath}</th>
                <td>{a.lineCount}</td>
                <td>{a.blocks}</td>
                <td>{a.uncovered}</td>
                <td>{a.duplicated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
