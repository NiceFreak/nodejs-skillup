/**
 * W13 RAG 板的数据层导出：从 week13-rag 的既有产物算出展板要用的量，写成 TS 数据模块。
 *
 * 为什么是脚本而不是手写数字
 * ------------------------
 * 视觉规范 §2.1：能从数据计算的计数、比例和状态不手写进文案。这块板的主图是一组字符数
 * （原文 → 核心正文 → model_content → Evidence Context），差一个数就是错的结论；
 * 2026-09-09 的设计方案第一稿正是把瀑布起点写错了方向，独立审计复算才抓出来。
 * 数字由脚本从产物算出，展板文案再从数据插值，错就错在一处、也只需改一处。
 *
 * 只读边界
 * --------
 * 只读 week13-rag 的 corpus/、evidence/serialization/、tests/；不读 eval/ 下任何文件
 * （受保护 split 与本板无关，AGENTS.md §1.3），不往 week13-rag 写任何东西。
 * 也不调用模型、不重跑 parser：所有量都来自已落盘的 registry 与整串 txt，
 * 脚本自己只做加法、正则分类与 sha256 复算。
 *
 * 怎么跑
 * -----
 *   node scripts/export-w13-rag-data.mjs     # 写 src/w13RagData.ts
 * 输出不带时间戳：同一份产物两次导出应逐字节一致（与 registry 不记生成时间的理由相同）。
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = resolve(fileURLToPath(new URL("../", import.meta.url)));
const W13 = resolve(FRONTEND, "../../../week13-rag");
const SNAPSHOT_ID = "rules-c0a4b85";
const SAMPLE_ID = "rules/SHOWCASE-VISUAL-PROTOCOL.md#L50-L50";

const read = (p) => readFileSync(p, "utf8");
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
function must(cond, msg) {
  if (!cond) throw new Error(`export-w13-rag-data: ${msg}`);
}

/* ---------------------------------------------------------------- 语料快照 */
const manifest = JSON.parse(read(join(W13, "corpus", SNAPSHOT_ID, "manifest.json")));
must(manifest.snapshotId === SNAPSHOT_ID, "manifest snapshotId 不符");
const docs = manifest.documents.map((d) => {
  const text = read(join(W13, "corpus", SNAPSHOT_ID, d.snapshotPath));
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return {
    sourcePath: d.sourcePath,
    bytes: d.bytes,
    chars: text.length,
    lines: lines.length,
    nonBlankLines: lines.filter((l) => l.trim() !== "").length,
    sha256Prefix: d.sha256.slice(0, 8),
    _lines: lines,
  };
});
const docMap = new Map(docs.map((d) => [d.sourcePath, d]));

/* ------------------------------------------------------------ registry 产物 */
const registry = JSON.parse(read(join(W13, "evidence", "serialization", `registry-${SNAPSHOT_ID}.json`)));
must(Array.isArray(registry) && registry.length > 0, "registry 为空");

const coreLineSet = new Map(docs.map((d) => [d.sourcePath, new Set()]));
let coreChars = 0;
let contextChars = 0;
let modelContentChars = 0;
const headingDepth = new Map();
const roleCount = { heading: 0, table_header: 0 };
const blocksPerDoc = new Map(docs.map((d) => [d.sourcePath, 0]));
const seenIds = new Set();
for (const e of registry) {
  must(!seenIds.has(e.source_id), `重复 source_id ${e.source_id}`);
  seenIds.add(e.source_id);
  const sp = e.source_span;
  for (let n = sp.line_start; n <= sp.line_end; n += 1) coreLineSet.get(sp.source_path).add(n);
  blocksPerDoc.set(sp.source_path, blocksPerDoc.get(sp.source_path) + 1);
  // model_content = 语境行 + 核心行；语境行数由 context_spans 决定（heading 1 行、table_header 2 行）。
  // 核心正文直接从产物里切出来，不重写规范化规则——这里只做减法。
  let ctxLines = 0;
  let headings = 0;
  for (const c of e.context_spans) {
    roleCount[c.role] += 1;
    ctxLines += c.line_end - c.line_start + 1;
    if (c.role === "heading") headings += 1;
  }
  headingDepth.set(headings, (headingDepth.get(headings) ?? 0) + 1);
  const mcLines = e.model_content.split("\n");
  const coreText = mcLines.slice(ctxLines).join("\n");
  const ctxText = mcLines.slice(0, ctxLines).join("\n") + (ctxLines ? "\n" : "");
  must(ctxText + coreText === e.model_content, `${e.source_id} 语境/核心切分不闭合`);
  coreChars += coreText.length;
  contextChars += ctxText.length;
  modelContentChars += e.model_content.length;
}
must(coreChars + contextChars === modelContentChars, "core + context ≠ model_content");

/* ------------------------------------------- 未进入核心 span 的原文行（按结构分类） */
// 正则逐条对应 src/w13rag/parser.py 的 _HEADING_RE / _HR_RE / _DELIM_RE / _ROWLIKE_RE。
const HEADING = /^(#{1,6})(?:[ \t].*)?$/;
const HR = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const DELIM = /^\|(?:\s*:?-+:?\s*\|)+\s*$/;
const ROWLIKE = /^\|.*\|\s*$/;
const nonCore = { blank: { lines: 0, chars: 0 }, heading: { lines: 0, chars: 0 }, thematicBreak: { lines: 0, chars: 0 }, tableHeader: { lines: 0, chars: 0 } };
const unclassified = [];
for (const d of docs) {
  const core = coreLineSet.get(d.sourcePath);
  d._lines.forEach((raw, i) => {
    const n = i + 1;
    if (core.has(n)) return;
    const s = raw.replace(/\s+$/, "");
    const bucket = s === "" ? "blank" : HEADING.test(s) ? "heading" : HR.test(s) ? "thematicBreak" : DELIM.test(s) || ROWLIKE.test(s) ? "tableHeader" : null;
    if (!bucket) {
      unclassified.push(`${d.sourcePath}#L${n}`);
      return;
    }
    nonCore[bucket].lines += 1;
    nonCore[bucket].chars += s.length + 1;
  });
}
must(unclassified.length === 0, `有未分类的非核心行：${unclassified.slice(0, 5).join(", ")}`);
const corpusChars = docs.reduce((n, d) => n + d.chars, 0);
const nonCoreChars = Object.values(nonCore).reduce((n, b) => n + b.chars, 0);
// 这条恒等式成立的前提：原文行尾空白只出现在核心行里的 hard break（恰 2 空格，规范化后保留）。
// 语料一变它可能不再成立；那时该重新看规范化差额，而不是让瀑布默默对不上。
must(corpusChars === coreChars + nonCoreChars, `原文 chars ${corpusChars} ≠ 核心 ${coreChars} + 非核心 ${nonCoreChars}`);

/* -------------------------------------------------------- Evidence Context 整串 */
const evidenceContext = read(join(W13, "evidence", "serialization", `evidence-context-${SNAPSHOT_ID}.txt`));
const ecSha = sha256(evidenceContext);
const frozenLine = read(join(W13, "evidence", "serialization", `frozen-${SNAPSHOT_ID}.sha256`)).trim().split(/\s+/);
const frozenSha = frozenLine[1];
must(/^[0-9a-f]{64}$/.test(frozenSha), "冻结基准文件格式不符");
const tagChars = registry.reduce((n, e) => n + `<source id="${e.source_id}">`.length + 1 + "</source>".length, 0);
const separatorChars = 2 * (registry.length - 1);
must(modelContentChars + tagChars + separatorChars === evidenceContext.length,
  `model_content ${modelContentChars} + 标签 ${tagChars} + 块间空行 ${separatorChars} ≠ 整串 ${evidenceContext.length}`);

/* ------------------------------------------------------------ criteria-report */
const report = read(join(W13, "evidence", "serialization", `criteria-report-${SNAPSHOT_ID}.md`));
// 只读「## Block kinds」一节：报告顶部的 run facts 也是 `- key: N` 形态，混进来会把 blocks 总数当成一种 kind。
const kindsSection = report.split(/^## Block kinds$/m)[1]?.split(/^## /m)[0] ?? "";
const kinds = [...kindsSection.matchAll(/^- (\w+): (\d+)$/gm)].map((m) => ({ kind: m[1], count: Number(m[2]) }));
must(kinds.reduce((n, k) => n + k.count, 0) === registry.length, "criteria-report 的 kind 计数之和 ≠ blocks");
const audit = [...report.matchAll(/^\| ([A-Z-]+\.md) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|$/gm)].map((m) => ({
  sourcePath: m[1], lineCount: Number(m[2]), blocks: Number(m[3]), uncovered: Number(m[4]), duplicated: Number(m[5]),
}));
must(audit.length === docs.length, "criteria-report 审计表行数 ≠ 文档数");
for (const a of audit) must(a.blocks === blocksPerDoc.get(a.sourcePath), `${a.sourcePath} 审计表 blocks 与 registry 不一致`);
const twoPass = /two-pass byte-identical rerun: True/.test(report);

/* ------------------------------------------------------------------- tests */
const tests = readdirSync(join(W13, "tests")).filter((f) => /^test_.*\.py$/.test(f)).sort().flatMap((file) =>
  [...read(join(W13, "tests", file)).matchAll(/^def (test_\w+)\(/gm)].map((m) => ({ file, name: m[1] })));
must(tests.length > 0, "没有读到测试");

/* ------------------------------------------------------------- 样例 entry */
const idx = registry.findIndex((e) => e.source_id === SAMPLE_ID);
must(idx > 0 && idx < registry.length - 1, `样例 ${SAMPLE_ID} 不在 registry 中或没有前后邻块`);
const sample = registry[idx];
const sampleCtxLines = sample.context_spans.reduce((n, c) => n + (c.line_end - c.line_start + 1), 0);
const sampleLines = sample.model_content.split("\n");
const sampleCore = sampleLines.slice(sampleCtxLines).join("\n");
const sampleSerialized = `<source id="${sample.source_id}">\n${sample.model_content}</source>`;
must(evidenceContext.includes(sampleSerialized), "样例 serialized block 不在整串中");
const sampleContextParts = [];
let cursor = 0;
for (const c of sample.context_spans) {
  const n = c.line_end - c.line_start + 1;
  sampleContextParts.push({ role: c.role, span: `L${c.line_start}-L${c.line_end}`, text: sampleLines.slice(cursor, cursor + n).join("\n") + "\n" });
  cursor += n;
}

/* ------------------------------------------------------------------ 输出 */
const data = {
  snapshotId: SNAPSHOT_ID,
  corpusId: manifest.corpusId,
  sourceCommit: manifest.source.commit,
  docs: docs.map(({ _lines, ...d }) => d),
  corpus: {
    files: docs.length,
    bytes: docs.reduce((n, d) => n + d.bytes, 0),
    chars: corpusChars,
    lines: docs.reduce((n, d) => n + d.lines, 0),
    nonBlankLines: docs.reduce((n, d) => n + d.nonBlankLines, 0),
  },
  blocks: registry.length,
  blockKinds: kinds.sort((a, b) => b.count - a.count),
  blocksPerDoc: docs.map((d) => ({ sourcePath: d.sourcePath, blocks: blocksPerDoc.get(d.sourcePath) })),
  contextRoles: roleCount,
  headingDepth: [...headingDepth.entries()].sort((a, b) => a[0] - b[0]).map(([depth, count]) => ({ depth, count })),
  chars: {
    corpus: corpusChars,
    core: coreChars,
    context: contextChars,
    modelContent: modelContentChars,
    tags: tagChars,
    separators: separatorChars,
    evidenceContext: evidenceContext.length,
    nonCore,
  },
  evidenceContextSha256: ecSha,
  frozenSha256: frozenSha,
  frozenMatches: ecSha === frozenSha,
  twoPassIdentical: twoPass,
  audit,
  tests,
  sample: {
    sourceId: sample.source_id,
    prevSourceId: registry[idx - 1].source_id,
    nextSourceId: registry[idx + 1].source_id,
    contextParts: sampleContextParts,
    core: sampleCore,
    modelContent: sample.model_content,
    contentSha256: sample.content_sha256,
    serialized: sampleSerialized,
  },
};

const out = `// 由 scripts/export-w13-rag-data.mjs 从 week13-rag 的产物生成；不要手改，改产物后重跑脚本。
// 来源：corpus/${SNAPSHOT_ID}/manifest.json、evidence/serialization/{registry,evidence-context,criteria-report,frozen}-${SNAPSHOT_ID}.*、tests/*.py。
// 数值全部是脚本复算结果（chars 是字符数，不是 token 也不是 bytes）；脚本内的恒等式断言保证各分项相加闭合。

export const W13_RAG_DATA = ${JSON.stringify(data, null, 2)} as const;
`;
writeFileSync(join(FRONTEND, "src", "w13RagData.ts"), out);
console.log(`w13RagData.ts: blocks=${data.blocks} corpus=${corpusChars} core=${coreChars} ctx=${contextChars} mc=${modelContentChars} tags=${tagChars} sep=${separatorChars} ec=${evidenceContext.length} frozenMatches=${data.frozenMatches} tests=${tests.length}`);
