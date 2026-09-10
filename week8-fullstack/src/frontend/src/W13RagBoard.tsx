// W13 RAG 输入工程的五块图。形态由内容关系推导，见
// week13-rag/notes/week13-visualization-plan.md §5：
//   T1 = 三步校验序列 + 逐文件三项比对格   T2 = 逐行扫描 + 标题栈阶梯 + 块边界刻度
//   T3 = 共用基线瀑布（一降两升）+ 单个 entry 的四层变形（逐帧）
//   T4 = 判分链（否决出口标在链上位置）+ 5×2 覆盖矩阵
//   T5 = 验证手段 × 被验证对象的覆盖矩阵（空格即该手段管不到）+ 检查清单联动
//
// 承担结论的位置编码（改 CSS 前先看 scripts/verify-w9-board.mjs §F）：
//   T1 三帧的状态格取值各不相同 = 校验真的分三步，不是一张图换文字；
//   T2 标题栈的缩进 = 语境层级，thematic break 那一行的上下虚线 = 不可跨越的硬边界；
//   T3 下降段的起点在核心正文的终点 = 原文里有一段从不进入任何块；
//   T3 四帧只增不减 = 每一层都是在上一层字节上包一圈；
//   T4 停止标记落在第 1 步 = 否决发生在分支判定处，不在链尾；
//   T5 content_sha256 那一行只有一格有值 = 指纹的盲区；职责边界那一列只落在「无自动化」行。
import { useEffect, useMemo, useState } from "react";
import { FrameNarration, FrameTransport, dwellByText, useFramePlayer, usePrefersReducedMotion } from "./framePlayer";
import { W13_RAG_DATA } from "./w13RagData";
import {
  W13_RANK_DISAGREE,
  W13_STALE_CHECKS,
  W13_UNMAPPED_TESTS,
  type W13Check,
  type W13CompositionTopic,
  type W13CoverageTopic,
  type W13EvalTopic,
  type W13FreezeTopic,
  type W13JudgePath,
  type W13ScanTopic,
  type W13Layer,
  type W13MeansId,
  type W13ObjectId,
  type W13PipelineTopic,
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


/* ---------------------------------------------------- 共用：共用基线的分布条 */

function W13Bars({
  caption,
  unit,
  rows,
}: {
  caption: string;
  unit: string;
  rows: Array<{ key: string; label: string; value: number; note?: string }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="w13-bars" role="img" aria-label={`${caption}：${rows.map((r) => `${r.label} ${r.value}`).join("；")}`}>
      <figcaption>
        {caption}
        <span>{unit}</span>
      </figcaption>
      <ol>
        {rows.map((r) => (
          <li key={r.key} data-key={r.key}>
            <span className="w13-bars-label">{r.label}</span>
            <span className="w13-bars-track">
              <i style={{ width: pct(r.value, max) }} />
            </span>
            <b>{n(r.value)}</b>
            {r.note ? <small>{r.note}</small> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}


/** 判分契约原文里的行内代码：`answered` 这类反引号片段渲染成 <code>，
 *  而不是把 Markdown 标记原样显示给读者（展板规范 §5：正文不留 Markdown 残留）。 */
function ContractText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.length > 2 && part.startsWith("`") && part.endsWith("`")
          ? <code key={i}>{part.slice(1, -1)}</code>
          : <span key={i}>{part}</span>)}
    </>
  );
}

/* ================================================== T1 输入冻结 */

const CHECK_FIELD_LABEL: Record<string, string> = { bytes: "字节数", sha256: "SHA-256", gitBlob: "git blob" };

export function W13FreezeVisual({ topic }: { topic: W13FreezeTopic }) {
  const reduced = usePrefersReducedMotion();
  const player = useFramePlayer(topic.steps.length, {
    autoPlay: false,
    intervalAt: (index) => dwellByText(topic.steps[index]?.text ?? ""),
  });
  useEffect(() => {
    if (reduced) player.seek(topic.steps.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时按偏好定位一次
  }, [reduced]);
  const step = player.index;
  const maxBytes = Math.max(...D.docs.map((d) => d.bytes));

  return (
    <section className="w13-freeze" aria-label="语料快照与逐文件完整性">
      <ol className="w13-steps" aria-label="一次完整性校验的三步">
        {topic.steps.map((s, i) => (
          <li key={s.id} className={i <= step ? "on" : ""} data-step={s.id} aria-current={i === step}>
            <b>{i + 1}</b>
            <span>{s.title}</span>
          </li>
        ))}
      </ol>

      <div
        className="w13-files"
        data-anchor="w13-per-file-integrity"
        data-mobile-visual="rag-freeze"
        data-step={step}
        role="table"
        aria-label={`${D.docs.length} 份文档的体量与逐项比对结果；第 3 步完成后每份文档各有三项指纹与 manifest 一致`}
      >
        <div className="w13-files-head" role="row">
          <span role="columnheader">文档</span>
          <span role="columnheader">字节数（共用基线）</span>
          <span role="columnheader">与 manifest 逐项比对</span>
        </div>
        {D.docs.map((doc) => (
          <div className="w13-file" role="row" key={doc.sourcePath} data-doc={doc.sourcePath}>
            <span role="rowheader" className="w13-file-name">
              {doc.sourcePath}
              <small>{n(doc.chars)} chars · {doc.lines} 行</small>
            </span>
            <span role="cell" className="w13-file-track">
              <i style={{ width: pct(doc.bytes, maxBytes) }} />
              <em>{n(doc.bytes)}</em>
            </span>
            <span role="cell" className="w13-file-checks">
              {(["bytes", "sha256", "gitBlob"] as const).map((field) => {
                const value = field === "bytes" ? n(doc.bytes) : field === "sha256" ? `${doc.sha256Prefix}…` : `${doc.gitBlobPrefix}…`;
                // 第 1 帧只读入；第 2 帧算出本地值；第 3 帧才谈得上「与 manifest 一致」。
                const state = step === 0 ? "read" : step === 1 ? "computed" : doc.checks[field] ? "match" : "diff";
                return (
                  <b key={field} className="w13-check" data-field={field} data-state={state} title={CHECK_FIELD_LABEL[field]}>
                    <small>{CHECK_FIELD_LABEL[field]}</small>
                    <code>{step === 0 ? "—" : value}</code>
                    <i aria-hidden="true">{state === "match" ? "＝" : state === "diff" ? "≠" : "·"}</i>
                    <span className="sr-only">
                      {state === "match" ? "与 manifest 一致" : state === "diff" ? "与 manifest 不一致" : state === "computed" ? "已复算，未比对" : "尚未读取"}
                    </span>
                  </b>
                );
              })}
            </span>
          </div>
        ))}
      </div>

      <div className="w13-entry-frames">
        <FrameTransport player={player} length={topic.steps.length} label="一次完整性校验" />
        <ol className="ae-frame-track w13-frame-track">
          {topic.steps.map((s, index) => (
            <li key={s.id}>
              <button
                type="button"
                className={index === player.index ? "on" : ""}
                data-index={index}
                aria-current={index === player.index}
                onClick={() => player.seek(index)}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <FrameNarration step={player.index + 1} text={topic.steps[player.index]?.text ?? ""} />
      </div>

      <details className="w13-fold">
        <summary>三个单位的排序并不一致：bytes、chars 与 estimated tokens 各排各的</summary>
        <p className="w13-note">
          同一组文档按三个单位排名，{W13_RANK_DISAGREE.length} 份的名次不一致
          {W13_RANK_DISAGREE.length > 0
            ? `（例：${W13_RANK_DISAGREE[0].sourcePath} 的字符数排第 ${W13_RANK_DISAGREE[0].rankChars}，字节数排第 ${W13_RANK_DISAGREE[0].rankBytes}，token 数排第 ${W13_RANK_DISAGREE[0].rankTokens}）`
            : ""}
          。这是「三个单位不能互相换算」的直接现象，不是排版差异。
        </p>
        <table className="w13-table">
          <thead>
            <tr><th>文档</th><th>bytes</th><th>名次</th><th>chars</th><th>名次</th><th>estimated tokens</th><th>名次</th></tr>
          </thead>
          <tbody>
            {topic.unitRanks.map((r) => (
              <tr key={r.sourcePath} data-disagree={r.rankBytes !== r.rankChars || r.rankChars !== r.rankTokens}>
                <th scope="row">{r.sourcePath}</th>
                <td>{n(r.bytes)}</td><td>{r.rankBytes}</td>
                <td>{n(r.chars)}</td><td>{r.rankChars}</td>
                <td>{n(r.tokens)}</td><td>{r.rankTokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="w13-fold">
        <summary>离线 tokenizer 的版本、回环结果与被拒绝的组合</summary>
        <ul className="w13-note-list">
          <li><b>采用</b>{topic.tokenizer.accepted}；{topic.tokenizer.roundTrips}。</li>
          <li><b>拒绝</b>{topic.tokenizer.rejected}。{topic.tokenizer.rejectedReason}</li>
          <li><b>结果等级</b>{n(D.tokens.total)} tokens 标为 {D.tokens.classification}；逐文档相加与整串一次性编码给出同一个数（{n(D.tokens.concatenatedTotal)}），说明这份语料上分词边界没有跨文档影响。</li>
          <li><b>normalization</b>{`快照以 repository-content-v1 记录，发生在建快照时；它不在上面三步校验链里，校验读的是快照副本本身。`}</li>
        </ul>
      </details>
    </section>
  );
}

/* ================================================== T2 切分与引用 */

const SCAN_KIND_LABEL: Record<string, string> = {
  heading: "标题 → 进语境",
  blank: "空行 → 块级分隔",
  "thematic-break": "thematic break → 硬边界",
  "table-header": "表头 → 进语境",
  "table-delim": "分隔行 → 进语境",
  core: "核心行 → 落块边界",
  other: "正文行",
};

export function W13ScanVisual({ topic }: { topic: W13ScanTopic }) {
  const lines = D.scan.lines;
  const reduced = usePrefersReducedMotion();
  const player = useFramePlayer(lines.length, { autoPlay: false, interval: 1100 });
  useEffect(() => {
    if (reduced) player.seek(lines.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时按偏好定位一次
  }, [reduced]);
  const cur = lines[player.index];
  const blockOf = (sourceId: string | null) => D.scan.blocks.find((b) => b.sourceId === sourceId);

  const narration = (() => {
    if (!cur) return "";
    const at = `第 ${cur.no} 行`;
    switch (cur.kind) {
      case "heading":
        return `${at}是 H${cur.headingLevel} 标题：压入标题栈，当前 ${cur.headingStack.length} 层。标题本身不成块——它作为必要语境进入随后每个块的 model_content，让模型能确定规则的适用对象。`;
      case "blank":
        return `${at}是空行：块级分隔，不进入任何核心 span，也不进入模型可见内容。`;
      case "thematic-break":
        return `${at}是 thematic break：硬边界。它不形成证据内容，且禁止跨越合并——前后的内容不会被并进同一个块。`;
      case "table-header":
        return `${at}是表头行：登记为 table_header 语境，不单独成块；随后每个数据行块都会复制它。`;
      case "table-delim":
        return `${at}是表格分隔行：与表头一起构成 table_header 语境（L${cur.tableHeader?.lineStart}-L${cur.tableHeader?.lineEnd}）。`;
      case "core": {
        const b = blockOf(cur.emitsBlock);
        const headings = b?.contextSpans.filter((c) => c.role === "heading") ?? [];
        const header = b?.contextSpans.find((c) => c.role === "table_header");
        return `${at}落下块边界：${b?.sourceId}。它携带 ${headings.length} 层标题语境${header ? `与表头 L${header.lineStart}-L${header.lineEnd}` : ""}，model_content 共 ${b?.modelContentChars} chars——ID 只标核心那一行，语境不扩大它。`;
      }
      default:
        return `${at}：${SCAN_KIND_LABEL[cur.kind as string] ?? cur.kind}。`;
    }
  })();

  return (
    <section className="w13-scan" aria-label="parser 逐行扫描">
      <header className="w13-scan-head">
        <b>{topic.fragment.sourcePath}</b>
        <span>L{topic.fragment.from}–L{topic.fragment.to}（冻结快照原文）</span>
        <em>{D.scan.blocks.length} 个块在这一段里落下</em>
      </header>

      <div className="w13-scan-main" data-mobile-visual="rag-scan" data-anchor="w13-scan-heading-stack">
        <ol className="w13-scan-lines" aria-label="源文档逐行；已扫描的行标出它的判定结果">
          {lines.map((line, i) => {
            const done = i <= player.index;
            const b = blockOf(line.emitsBlock);
            return (
              <li
                key={line.no}
                className={`w13-scan-line${done ? " done" : ""}${i === player.index ? " cur" : ""}`}
                data-kind={line.kind}
                data-line={line.no}
                data-emits={line.emitsBlock ?? undefined}
                aria-current={i === player.index}
              >
                <b className="w13-scan-no">{line.no}</b>
                <code className="w13-scan-text">{line.text === "" ? " " : line.text}</code>
                <span className="w13-scan-mark">
                  {done ? <em data-kind={line.kind}>{SCAN_KIND_LABEL[line.kind] ?? line.kind}</em> : null}
                  {done && b ? <i className="w13-scan-tick">{b.sourceId.split("#")[1]}</i> : null}
                </span>
              </li>
            );
          })}
        </ol>

        <aside className="w13-scan-state" aria-label="扫描到当前行时的语境状态">
          <h4>标题栈</h4>
          <ol className="w13-stack">
            {(cur?.headingStack ?? []).map((lineNo, depth) => {
              const src = lines.find((l) => l.no === lineNo);
              return (
                <li key={lineNo} style={{ marginLeft: `${depth * 14}px` }} data-depth={depth + 1} data-line={lineNo}>
                  <b>L{lineNo}</b>
                  <span>{src?.text}</span>
                </li>
              );
            })}
            {(cur?.headingStack.length ?? 0) === 0 ? <li className="w13-stack-empty">（空）</li> : null}
          </ol>
          <h4>表头语境</h4>
          <p className="w13-scan-header-ctx">
            {cur?.tableHeader
              ? `L${cur.tableHeader.lineStart}-L${cur.tableHeader.lineEnd}，随后每个数据行块都会复制它`
              : "（当前不在表格内）"}
          </p>
        </aside>
      </div>

      <div className="w13-entry-frames">
        <FrameTransport player={player} length={lines.length} label={`逐行扫描（${lines.length} 行）`} />
        <FrameNarration step={cur?.no ?? 1} text={narration} />
      </div>

      <details className="w13-fold">
        <summary>四条切分规则：标题进语境、thematic break 硬边界、表格按行拆分、身份与指纹分离</summary>
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
        <summary>全语料的块类型、标题层数与逐文档块数分布</summary>
        <div className="w13-dists">
          <W13Bars
            caption="块类型分布"
            unit={`共 ${n(D.blocks)} 个块`}
            rows={D.blockKinds.map((k) => ({ key: k.kind, label: k.kind, value: k.count }))}
          />
          <W13Bars
            caption="标题层数分布"
            unit="每块携带的 heading 语境条数"
            rows={D.headingDepth.map((h) => ({ key: String(h.depth), label: `${h.depth} 层`, value: h.count }))}
          />
          <W13Bars
            caption="逐文档块数"
            unit="与下方字节数同一文件顺序"
            rows={D.blocksPerDoc.map((d) => ({ key: d.sourcePath, label: d.sourcePath.replace(/\.md$/, ""), value: d.blocks }))}
          />
          <W13Bars
            caption="逐文档字节数"
            unit="bytes；与上方块数同一文件顺序"
            rows={D.docs.map((d) => ({ key: d.sourcePath, label: d.sourcePath.replace(/\.md$/, ""), value: d.bytes }))}
          />
        </div>
        <p className="w13-note">
          后两张图是同一组文件的两个量，按同一顺序并置。这 {D.docs.length} 份样本上两者呈强相关（每块
          {Math.min(...D.blocksPerDoc.map((b, i) => Math.round(D.docs[i].bytes / b.blocks)))}–
          {Math.max(...D.blocksPerDoc.map((b, i) => Math.round(D.docs[i].bytes / b.blocks)))} bytes）；
          样本数为 {D.docs.length}，不足以推出一般规律，也不构成「切分粒度与文件体量无关」的结论。
        </p>
      </details>
    </section>
  );
}

/* ================================================== T4 评测契约 */

const BEHAVIOR_LABEL: Record<string, string> = {
  direct_answer: "直接可回答",
  cross_document: "跨文档",
  paraphrase: "近似表述",
  priority_conflict_exception: "优先级 / 冲突 / 例外",
  no_answer: "无答案",
};

export function W13EvalVisual({ topic }: { topic: W13EvalTopic }) {
  const [path, setPath] = useState<W13JudgePath>("pass");
  const chain = topic.chains.find((c) => c.path === path) ?? topic.chains[0];
  // 否决路径在第 1 步就停：帧数 = 停止步 + 1，后续条件渲染为「不再推进」。
  const frameCount = chain.stopAt === null ? chain.conditions.length : chain.stopAt + 1;
  const reduced = usePrefersReducedMotion();
  const player = useFramePlayer(frameCount, { autoPlay: false, interval: 1600 });
  useEffect(() => {
    if (reduced) player.seek(frameCount - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时按偏好定位一次
  }, [reduced, frameCount]);
  const finished = player.index >= frameCount - 1;

  return (
    <section className="w13-eval" aria-label="判分链与覆盖矩阵">
      <div className="w13-eval-main">
        <div className="w13-chain" data-path={path} data-mobile-visual="rag-eval" data-anchor="w13-veto-stop-position">
          <div className="w13-chain-paths" role="group" aria-label="演示路径">
            {topic.chains.map((c) => (
              <button
                key={c.path}
                type="button"
                className={c.path === path ? "on" : ""}
                data-path={c.path}
                aria-pressed={c.path === path}
                onClick={() => { setPath(c.path); player.seek(0); }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="w13-chain-note">
            <code>{topic.sample.responses[path]}</code>
            <small>预期分支 {chain.branch}；{chain.note}</small>
          </p>
          <ol className="w13-chain-steps" aria-label={`${chain.branch} 分支的判分条件，按顺序推进`}>
            {chain.conditions.map((text, i) => {
              const halted = chain.stopAt !== null && i > chain.stopAt;
              const reachedNow = i <= player.index;
              const isStop = chain.stopAt === i && finished;
              const state = halted ? "halted" : isStop ? "stop" : reachedNow ? "pass" : "pending";
              return (
                <li key={text} className={`w13-chain-step ${state}`} data-index={i} data-state={state} aria-current={i === player.index}>
                  <b>{i + 1}</b>
                  <span><ContractText text={text} /></span>
                  <i aria-hidden="true">{state === "pass" ? "✓" : state === "stop" ? "■" : state === "halted" ? "–" : ""}</i>
                  <small className="sr-only">
                    {state === "pass" ? "通过" : state === "stop" ? "在此停止，否决整个 split" : state === "halted" ? "不再推进" : "尚未推进"}
                  </small>
                </li>
              );
            })}
          </ol>
          <p className={`w13-chain-outcome ${path}`} role="status">{finished ? chain.outcome : "推进中…"}</p>
          <div className="w13-entry-frames">
            <FrameTransport player={player} length={frameCount} label="单题判分" />
          </div>
        </div>

        <aside className="w13-eval-side">
          <div
            className="w13-eval-matrix"
            role="table"
            aria-label={`五类行为 × 两个 split 的覆盖矩阵；dev 每类 ${D.eval.dev.byBehavior[0]?.count ?? 2} 题并标出预期分支，受保护 split 只有题数与冻结状态`}
          >
            <div className="w13-eval-row head" role="row">
              <span role="columnheader">行为类型</span>
              <span role="columnheader">dev</span>
              <span role="columnheader">受保护 split</span>
            </div>
            {D.eval.dev.byBehavior.map((b) => (
              <div className="w13-eval-row" role="row" key={b.behaviorType} data-behavior={b.behaviorType}>
                <span role="rowheader">
                  {BEHAVIOR_LABEL[b.behaviorType] ?? b.behaviorType}
                  <small>{b.evidenceRequirements} 条证据要求</small>
                </span>
                <span role="cell" className="w13-eval-cell" data-branch={b.expectedBranch}>
                  <b>{b.count} 题</b>
                  <em>{b.expectedBranch}</em>
                </span>
                <span role="cell" className="w13-eval-cell locked" data-branch="hidden">
                  <b>{D.eval.protected.count / D.eval.dev.byBehavior.length} 题</b>
                  <em aria-label="内容受保护，不展示">🔒 不展示</em>
                </span>
              </div>
            ))}
          </div>
          <p className="w13-note">
            受保护 split 的题数由判分契约的「整套 {D.eval.totalItems} 题」减去 dev 的 {D.eval.dev.count} 题得到；
            导出脚本不读取该目录，页面也不出现它的任何题面。
          </p>
        </aside>
      </div>

      <details className="w13-fold">
        <summary>answered {D.eval.answeredConditions.length} 条与 abstained {D.eval.abstainedConditions.length} 条单题通过条件（判分契约原文）</summary>
        <div className="w13-cond-cols">
          {topic.chains.map((c) => (
            <div key={c.path}>
              <h4>{c.branch}</h4>
              <ol className="w13-conds">
                {c.conditions.map((text) => <li key={text}><ContractText text={text} /></li>)}
              </ol>
            </div>
          ))}
        </div>
      </details>

      <details className="w13-fold">
        <summary>6 个 metric 的定义与阈值，以及 split 通过的 {D.eval.splitConditions.length} 条</summary>
        <table className="w13-table">
          <thead><tr><th>metric</th><th>计算方式</th><th>用途</th><th>阈值</th></tr></thead>
          <tbody>
            {D.eval.metrics.map((m) => (
              <tr key={m.metric} data-gate={m.gate}>
                <th scope="row"><code>{m.metric}</code></th>
                <td><ContractText text={m.formula} /></td>
                <td>{m.gate ? "门禁" : "诊断"}</td>
                <td>{m.threshold ? <code>{m.threshold}</code> : "无阈值（诊断）"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ol className="w13-conds">
          {D.eval.splitConditions.map((text) => <li key={text}><ContractText text={text} /></li>)}
        </ol>
        <p className="w13-note">本块不含任何 metric 的实测值：尚未运行模型，没有可填的数。</p>
      </details>

      <details className="w13-fold">
        <summary>合成响应的来源与排除声明，以及它引用的真实 block</summary>
        <p className="w13-note"><b>query</b>{topic.sample.query}</p>
        <p className="w13-note">{topic.sample.exclusion}</p>
        <p className="w13-note">
          <b>citation</b><code>{D.citationSample.sourceId}</code>
          ——它在 registry 中真实存在且在 Evidence Context 整串内，因此「citation 可解析且在本次 context 中」这一步用的是真数据。
        </p>
        <pre className="w13-entry-bytes">{D.citationSample.modelContent}</pre>
      </details>
    </section>
  );
}


/* ================================================== T0 链路总览 */

/** 五段闭环：①②③ 内容向右流，④⑤ 引用向左回，⑤ 指回 ①。
 *  记忆点是那条回指——闭合发生在同一行上，所以第 ⑤ 帧会把 ① 里的核心行点亮。 */
export function W13PipelineVisual({ topic }: { topic: W13PipelineTopic }) {
  const P = D.pipeline;
  const reduced = usePrefersReducedMotion();
  const player = useFramePlayer(topic.stages.length, {
    autoPlay: false,
    intervalAt: (index) => dwellByText(topic.stages[index]?.text ?? ""),
  });
  useEffect(() => {
    if (reduced) player.seek(topic.stages.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时按偏好定位一次
  }, [reduced]);
  const at = player.index;
  const state = (i: number) => (i < at ? "done" : i === at ? "cur" : "pending");
  const traced = at >= 4; // 走到第 ⑤ 段，引用已回到原文
  const stage = topic.stages[at];

  // 每个格子都显式定位：混用「显式行 + 自动列」时，自动放置会把卡片挤进 24px 的箭头列。
  const Card = ({ i, col, row, children }: { i: number; col: number; row: number; children: React.ReactNode }) => (
    <section
      className={`w13-pipe-card ${state(i)}`}
      data-stage={topic.stages[i].id}
      data-state={state(i)}
      style={{ gridColumn: col, gridRow: row }}
    >
      <header>
        <b>{topic.stages[i].no}</b>
        <span>{topic.stages[i].label}</span>
        {topic.stages[i].id === "answer" ? <em title="证据从上方落下">↓</em> : null}
      </header>
      {children}
    </section>
  );

  return (
    <section className="w13-pipe" aria-label="一条规则问题走完全链路">
      <div className="w13-pipe-grid" data-mobile-visual="rag-pipeline" data-anchor="w13-pipeline-citation-loop">
        {/* ── 上行：内容向右流 ── */}
        <Card i={0} col={1} row={1}>
          <p className="w13-pipe-doc-name">{P.sourcePath}<small>共 {P.docLines} 行</small></p>
          <ol className="w13-pipe-lines">
            {P.rows.map((r, idx) => r.gap !== undefined ? (
              <li key={`gap-${idx}`} className="w13-pipe-gap"><span>⋮ 中间 {r.gap} 行</span></li>
            ) : (
              <li
                key={r.no}
                className={`w13-pipe-line ${r.role}${traced && r.role === "core" ? " cited" : ""}`}
                data-line={r.no}
                data-role={r.role}
              >
                <b>{r.no}</b>
                <code>{r.text}</code>
              </li>
            ))}
          </ol>
          <p className="w13-pipe-hint">
            {traced
              ? `↑ 引用走回了第 ${P.coreLine} 行`
              : `第 ${P.coreLine} 行单独读，看不出它属于白名单`}
          </p>
        </Card>
        <i className="w13-pipe-arrow" style={{ gridColumn: 2, gridRow: 1 }} aria-hidden="true">→</i>
        <Card i={1} col={3} row={1}>
          <p className="w13-pipe-id"><code>{P.sourceId}</code></p>
          <ul className="w13-pipe-spans">
            <li data-kind="core"><b>核心</b>第 {P.coreLine} 行 · ID 只标这一行</li>
            <li data-kind="context">
              <b>语境</b>第 {P.contextRoles.map((c) => c.line).join(" / ")} 行的 {P.contextRoles.length} 层标题
              <small>分散在文档三处，复制进块才说得清「白名单」</small>
            </li>
          </ul>
        </Card>
        <i className="w13-pipe-arrow" style={{ gridColumn: 4, gridRow: 1 }} aria-hidden="true">→</i>
        <Card i={2} col={5} row={1}>
          <pre className="w13-pipe-serialized">{P.serialized}</pre>
          <p className="w13-pipe-hint">
            第 {P.blockIndex} / {n(P.blockTotal)} 块；整段 {n(P.contextChars)} 字符，是模型看到的全部证据
          </p>
        </Card>

        {/* ── 下行：引用向左回 ── */}
        <Card i={4} col={1} row={2}>
          <p className="w13-pipe-trace">
            <code>{P.sourceId}</code>
            <span>→ 解析到冻结快照第 {P.coreLine} 行</span>
          </p>
          <p className="w13-pipe-hint">{traced ? "核对 claim 是否真被那几行支持" : "等待第 ④ 步返回引用"}</p>
        </Card>
        <i className="w13-pipe-arrow back" style={{ gridColumn: "2 / 5", gridRow: 2 }} aria-hidden="true">⟵ 引用回到原文</i>
        <Card i={3} col={5} row={2}>
          <pre className="w13-pipe-answer">
            <span>{'{"branch":"answered","claims":[{'}</span>
            <span>{'  "text":"Docker / docker-compose 配置属于白名单，AI 可以直接实现",'}</span>
            <span>{'  "citations":['}<em className="w13-pipe-cite">{`"${P.sourceId}"`}</em>{']'}</span>
            <span>{'}]}'}</span>
          </pre>
          <p className="w13-pipe-hint">只能引用证据里出现过的 ID，不得编造或改写</p>
        </Card>
        

        {/* 闭环标注：横跨下行，说明两条方向相反的路径共用同一个 ID */}
        <p className={`w13-pipe-loop${traced ? " on" : ""}`} role="status">
          {traced ? topic.loopNote : "内容还在向右流…"}
        </p>
      </div>

      <div className="w13-entry-frames">
        <FrameTransport player={player} length={topic.stages.length} label="一条 query 走完全链路" />
        <ol className="ae-frame-track w13-frame-track">
          {topic.stages.map((s, index) => (
            <li key={s.id}>
              <button
                type="button"
                className={index === player.index ? "on" : ""}
                data-index={index}
                data-stage={s.id}
                aria-current={index === player.index}
                onClick={() => player.seek(index)}
              >
                {s.no} {s.label}
              </button>
            </li>
          ))}
        </ol>
        <FrameNarration step={player.index + 1} text={stage?.text ?? ""} />
      </div>

      <details className="w13-fold">
        <summary>这条 query 的来源与排除声明</summary>
        <p className="w13-note">
          <b>query</b>在本仓库中，AI 是否可以直接实现 Docker/docker-compose 配置？
        </p>
        <p className="w13-note">
          它是 D1 §2.3.5 的教学示例，已声明不计入 20 题、不得改名进入任何正式 split；这里只用它把链路走通。
          第 ④ 步的回答同样是合成数据——尚未调用模型，页面上不存在任何模型运行结果。
        </p>
        <p className="w13-note">
          <b>为什么挑这一块</b>它的核心行只有一串文件名，而让它可回答的三层标题分散在文档第
          {P.contextRoles.map((c) => ` ${c.line}`).join(" /")} 行。语境不是排版，是语义——这一点在别的块上没这么明显。
        </p>
      </details>
    </section>
  );
}
