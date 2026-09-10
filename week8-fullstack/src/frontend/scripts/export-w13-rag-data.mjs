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
import { Buffer } from "node:buffer";
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
// manifest 记录的 bytes / sha256 / gitBlob 三项都可以从文件本体复算，所以这里真做一遍逐文件比对，
// 而不是把 D1 笔记里那句「校验均通过」当结论抄上板。gitBlob = sha1("blob <字节数>\0" + 内容)，
// 与 `git hash-object` 同一套算法。任一项不符即 must() 抛错，产物不会生成。
const docs = manifest.documents.map((d) => {
  const buf = readFileSync(join(W13, "corpus", SNAPSHOT_ID, d.snapshotPath));
  const text = buf.toString("utf8");
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const sha256Actual = createHash("sha256").update(buf).digest("hex");
  const gitBlobActual = createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`, "utf8"), buf]))
    .digest("hex");
  const checks = {
    bytes: buf.length === d.bytes,
    sha256: sha256Actual === d.sha256,
    gitBlob: gitBlobActual === d.gitBlob,
  };
  must(checks.bytes && checks.sha256 && checks.gitBlob,
    `${d.sourcePath} 与 manifest 不一致：${JSON.stringify({ ...checks, sha256Actual, gitBlobActual })}`);
  return {
    sourcePath: d.sourcePath,
    bytes: buf.length,
    chars: text.length,
    lines: lines.length,
    nonBlankLines: lines.filter((l) => l.trim() !== "").length,
    sha256Prefix: sha256Actual.slice(0, 8),
    gitBlobPrefix: gitBlobActual.slice(0, 8),
    checks,
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

/* --------------------------------------------------- T1：离线 token 估算证据 */
const tokenEv = JSON.parse(read(join(W13, "evidence", `token-count-${SNAPSHOT_ID}.json`)));
must(tokenEv.classification === "estimate", "token 证据的 classification 不是 estimate");
must(tokenEv.corpus.snapshotId === SNAPSHOT_ID, "token 证据绑定的 snapshot 不符");
const tokenByDoc = new Map(tokenEv.documents.map((d) => [d.sourcePath, d]));
must(docs.every((d) => tokenByDoc.has(d.sourcePath)), "token 证据缺少某份文档");
// 三个单位各自独立记录，绝不互相换算（H3）：bytes 来自文件、chars 来自解码后的码点、tokens 来自离线 tokenizer。
const units = docs.map((d) => ({
  sourcePath: d.sourcePath,
  bytes: d.bytes,
  chars: d.chars,
  estimatedTokens: tokenByDoc.get(d.sourcePath).estimatedTokens,
}));
must(units.reduce((s, u) => s + u.estimatedTokens, 0) === tokenEv.totals.sumOfPerDocumentEstimatedTokens,
  "逐文档 estimatedTokens 之和与 totals 不一致");
// 逐文档相加 == 整串一次性编码：说明这份语料上分词边界没有跨文档影响，两种算法给出同一个数。
must(tokenEv.totals.sumOfPerDocumentEstimatedTokens === tokenEv.totals.concatenatedWithoutSeparatorEstimatedTokens,
  "逐文档相加与整串编码的 token 数不一致，两者不能再当作同一个量呈现");
// tokenizer 侧的码点合计必须与我们自己读文件算出的 chars 相等，否则两处在读不同的东西。
must(tokenEv.totals.unicodeCodePoints === corpusChars,
  `token 证据的 unicodeCodePoints ${tokenEv.totals.unicodeCodePoints} ≠ 本次复算 chars ${corpusChars}`);

/* ------------------------------------------- T2：真实片段的逐行扫描（parser 行为） */
// 选 LEARNING-PROTOCOL.md L1-L16：一屏内同时出现 H1、段落、thematic break、H2、表头与数据行，
// 是「标题进语境不成块 / --- 不跨越 / 表头复制进每个数据行块」三条规则的最小完整样本。
const SCAN_DOC = "LEARNING-PROTOCOL.md";
const SCAN_FROM = 1;
const SCAN_TO = 16;
const scanDoc = docMap.get(SCAN_DOC);
must(scanDoc, `扫描片段的文档 ${SCAN_DOC} 不在 manifest 中`);
const scanBlocks = registry
  .filter((e) => e.source_span.source_path === SCAN_DOC
    && e.source_span.line_start >= SCAN_FROM && e.source_span.line_end <= SCAN_TO)
  .map((e) => ({
    sourceId: e.source_id,
    coreStart: e.source_span.line_start,
    coreEnd: e.source_span.line_end,
    contextSpans: e.context_spans.map((c) => ({ role: c.role, lineStart: c.line_start, lineEnd: c.line_end })),
    modelContentChars: e.model_content.length,
  }));
must(scanBlocks.length >= 4, "扫描片段里的块太少，换一段");

const headingStack = [];
const scanLines = [];
let tableHeader = null;
for (let no = SCAN_FROM; no <= SCAN_TO; no += 1) {
  const raw = scanDoc._lines[no - 1];
  const s = raw.replace(/\s+$/, "");
  const heading = HEADING.exec(s);
  let kind;
  if (s === "") kind = "blank";
  else if (heading) kind = "heading";
  else if (HR.test(s)) kind = "thematic-break";
  else if (DELIM.test(s)) kind = "table-delim";
  else if (ROWLIKE.test(s)) kind = coreLineSet.get(SCAN_DOC).has(no) ? "core" : "table-header";
  else kind = coreLineSet.get(SCAN_DOC).has(no) ? "core" : "other";
  if (kind === "heading") {
    const level = heading[1].length;
    while (headingStack.length && headingStack.at(-1).level >= level) headingStack.pop();
    headingStack.push({ line: no, level, text: s });
    tableHeader = null;
  }
  if (kind === "thematic-break") tableHeader = null;
  if (kind === "table-header") tableHeader = { lineStart: no, lineEnd: no };
  if (kind === "table-delim" && tableHeader) tableHeader = { ...tableHeader, lineEnd: no };
  scanLines.push({
    no,
    text: s,
    kind,
    headingLevel: kind === "heading" ? heading[1].length : null,
    headingStack: headingStack.map((h) => h.line),
    tableHeader: tableHeader ? { ...tableHeader } : null,
    emitsBlock: scanBlocks.find((b) => b.coreEnd === no)?.sourceId ?? null,
  });
}
// 扫描出的块与 registry 里该行段的块必须一一对应——这一条挂了说明本地扫描逻辑与 parser 走偏了。
must(scanLines.filter((l) => l.emitsBlock).length === scanBlocks.length,
  "扫描出的块数与 registry 不一致");
for (const block of scanBlocks) {
  const line = scanLines.find((l) => l.emitsBlock === block.sourceId);
  const headings = block.contextSpans.filter((c) => c.role === "heading").map((c) => c.lineStart);
  must(JSON.stringify(line.headingStack) === JSON.stringify(headings),
    `${block.sourceId} 的标题栈与 registry 的 heading context 不一致：${JSON.stringify(line.headingStack)} vs ${JSON.stringify(headings)}`);
}

/* --------------------------------------------------------- T4：eval 契约的结构 */
// 只读 dev；受保护 split 一个字节都不读——它的题数由判分契约的「整套 20 题」减去 dev 得到（方案 §7.3）。
const devSet = JSON.parse(read(join(W13, "eval", "dev", "items.json")));
must(devSet.split === "dev" && devSet.contract_status === "frozen", "dev split 不是 frozen 的 dev");
const behaviorTypes = [...new Set(devSet.items.map((i) => i.behavior_type))];
const devByBehavior = behaviorTypes.map((type) => {
  const items = devSet.items.filter((i) => i.behavior_type === type);
  const branches = [...new Set(items.map((i) => i.expected_branch))];
  must(branches.length === 1, `${type} 的预期分支不唯一，格内无法编码单一分支`);
  return {
    behaviorType: type,
    count: items.length,
    expectedBranch: branches[0],
    evidenceRequirements: items.reduce((s, i) => s + i.evidence_requirements.length, 0),
  };
});
const devEvidenceKinds = {};
for (const item of devSet.items) {
  for (const r of item.evidence_requirements) devEvidenceKinds[r.kind] = (devEvidenceKinds[r.kind] ?? 0) + 1;
}

const scoring = read(join(W13, "eval", "scoring-contract.md"));
const section = (heading) => scoring.split(new RegExp(`^## ${heading}$`, "m"))[1]?.split(/^## /m)[0] ?? "";
const numbered = (text) => [...text.matchAll(/^\d+\. (.+(?:\n(?!\d+\. |\n).+)*)$/gm)].map((m) => m[1].replace(/\s*\n\s*/g, ""));
const answeredConditions = numbered(section("2\\. Answered 单题通过条件"));
const abstainedConditions = numbered(section("3\\. Abstained 单题通过条件"));
const splitConditions = numbered(section("6\\. Split 与整套通过条件"));
must(answeredConditions.length === 8, `answered 条件应为 8 条，实得 ${answeredConditions.length}`);
must(abstainedConditions.length === 5, `abstained 条件应为 5 条，实得 ${abstainedConditions.length}`);
must(splitConditions.length === 5, `split 通过条件应为 5 条，实得 ${splitConditions.length}`);
const metrics = [...section("5\\. Metrics").matchAll(/^\| `(\w+)` \| (.+?) \| (.+?) \|$/gm)].map((m) => {
  const purpose = m[3];
  const gate = /门禁/.test(purpose);
  const threshold = purpose.match(/`(>= [\d.]+|[\d.]+)`/)?.[1] ?? null;
  return { metric: m[1], formula: m[2], purpose, gate, threshold };
});
must(metrics.length === 6, `metric 应为 6 条，实得 ${metrics.length}`);
must(metrics.filter((m) => m.gate).length === 2, "门禁 metric 应为 2 条");
must(metrics.filter((m) => m.gate).every((m) => m.threshold), "门禁 metric 必须解析出阈值");
must(metrics.filter((m) => !m.gate).every((m) => !m.threshold), "诊断 metric 不应带阈值");
const totalItems = Number(scoring.match(/整套 (\d+) 题/)?.[1]);
must(Number.isInteger(totalItems) && totalItems > devSet.items.length, "判分契约里读不到整套题数");

/* ------------------------- T4：合成响应引用到的真实 block（方案 §14.1 的 S-A） */
// D1 §2.3.5 的 Docker 教学示例明确排除在正式题集之外；它引用的 source span 是 registry 里真实存在的块，
// 因此「citation 可解析且在本次 context 中」这一步可以用真数据演示，而不是画一个假 ID。
const CITATION_ID = "rules/AGENTS.md#L41-L41";
const citationEntry = registry.find((e) => e.source_id === CITATION_ID);
must(citationEntry, `合成响应引用的 ${CITATION_ID} 不在 registry 中`);
must(evidenceContext.includes(`<source id="${CITATION_ID}">`), "该 citation 不在 Evidence Context 整串中");

/* ------------------------------- 总览：一条真实内容走完全链路（T0 用） */
// 挑 rules/AGENTS.md#L41-L41 作主线，是因为它把「为什么要复制语境」摆在明面上：
// 核心行只有 "- Docker / docker-compose、…" 一串文件名，单独读根本看不出它属于白名单；
// 让它可回答的那三层标题分别在 L1 / L28 / L39——文档三个不同位置。语境不是排版，是语义。
const pipeDoc = docMap.get(citationEntry.source_span.source_path);
must(pipeDoc, "总览主线所在文档不在 manifest 中");
const pipeCore = citationEntry.source_span;
const pipeLine = (no, role) => ({ no, text: pipeDoc._lines[no - 1].replace(/\s+$/, ""), role });
// 摘录只取真正进入 model_content 的四行，并记录它们之间跳过了多少行——跨度本身是信息。
const pipeRows = [];
let prev = 0;
for (const c of citationEntry.context_spans) {
  if (c.line_start - prev > 1) pipeRows.push({ gap: c.line_start - prev - 1 });
  pipeRows.push(pipeLine(c.line_start, c.role));
  prev = c.line_end;
}
if (pipeCore.line_start - prev > 1) pipeRows.push({ gap: pipeCore.line_start - prev - 1 });
pipeRows.push(pipeLine(pipeCore.line_start, "core"));
const pipeIndex = registry.findIndex((e) => e.source_id === citationEntry.source_id);
must(pipeRows.filter((r) => r.no).length === citationEntry.context_spans.length + 1,
  "总览摘录的行数与 entry 的 spans 对不上");

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
  integrity: {
    // 本次导出真做的逐文件比对结果；与 D1 笔记 2026-09-07 的一次性记录是两回事。
    checkedFiles: docs.length,
    allMatch: docs.every((d) => d.checks.bytes && d.checks.sha256 && d.checks.gitBlob),
    fields: ["bytes", "sha256", "gitBlob"],
    manifestSha256: tokenEv.corpus.manifestSha256,
  },
  tokens: {
    total: tokenEv.totals.sumOfPerDocumentEstimatedTokens,
    concatenatedTotal: tokenEv.totals.concatenatedWithoutSeparatorEstimatedTokens,
    classification: tokenEv.classification,
    byDoc: units,
    accepted: {
      transformers: tokenEv.acceptedRuntime.transformers,
      tokenizers: tokenEv.acceptedRuntime.tokenizers,
      tokenizerClass: tokenEv.acceptedRuntime.tokenizerClass,
      roundTripsPassed: tokenEv.acceptedRuntime.documentRoundTripsPassed,
      roundTripsTotal: tokenEv.acceptedRuntime.documentRoundTripsTotal,
    },
    rejected: {
      transformers: tokenEv.rejectedCompatibilityCheck.transformers,
      tokenizers: tokenEv.rejectedCompatibilityCheck.tokenizers,
      estimatedTotal: tokenEv.rejectedCompatibilityCheck.rejectedEstimatedTotal,
      reason: tokenEv.rejectedCompatibilityCheck.reason,
    },
  },
  pipeline: {
    sourcePath: pipeCore.source_path,
    docLines: pipeDoc.lines,
    rows: pipeRows,
    coreLine: pipeCore.line_start,
    sourceId: citationEntry.source_id,
    contextRoles: citationEntry.context_spans.map((c) => ({ role: c.role, line: c.line_start })),
    modelContent: citationEntry.model_content,
    serialized: `<source id="${citationEntry.source_id}">\n${citationEntry.model_content}</source>`,
    blockIndex: pipeIndex + 1,
    blockTotal: registry.length,
    contextChars: evidenceContext.length,
  },
  citationSample: {
    sourceId: citationEntry.source_id,
    modelContent: citationEntry.model_content,
    contentSha256: citationEntry.content_sha256,
    inEvidenceContext: true,
  },
  scan: { sourcePath: SCAN_DOC, from: SCAN_FROM, to: SCAN_TO, lines: scanLines, blocks: scanBlocks },
  eval: {
    evalVersion: devSet.eval_version,
    totalItems,
    dev: {
      count: devSet.items.length,
      byBehavior: devByBehavior,
      evidenceKinds: devEvidenceKinds,
      answered: devSet.items.filter((i) => i.expected_branch === "answered").length,
      abstained: devSet.items.filter((i) => i.expected_branch === "abstained").length,
    },
    protected: {
      // 不读该目录：题数 = 整套题数 − dev；行为类别与 dev 相同，来源是判分契约 §6「两个 split 分别应用上述条件」。
      count: totalItems - devSet.items.length,
      behaviorTypes: behaviorTypes.length,
      frozen: true,
    },
    answeredConditions,
    abstainedConditions,
    splitConditions,
    metrics,
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

// 不加 as const：这是每次重跑覆盖的构建产物，字面量类型会让消费端与某一次的具体取值耦合
// （TS 会推出「标题栈长度只可能是 1 或 2」这类结论，语料一变就编译不过）。
export const W13_RAG_DATA = ${JSON.stringify(data, null, 2)};
`;
writeFileSync(join(FRONTEND, "src", "w13RagData.ts"), out);
console.log(`w13RagData.ts: integrity=${data.integrity.allMatch} tokens=${data.tokens.total} scan=${scanLines.length}行/${scanBlocks.length}块 dev=${devSet.items.length} blocks=${data.blocks} corpus=${corpusChars} core=${coreChars} ctx=${contextChars} mc=${modelContentChars} tags=${tagChars} sep=${separatorChars} ec=${evidenceContext.length} frozenMatches=${data.frozenMatches} tests=${tests.length}`);
