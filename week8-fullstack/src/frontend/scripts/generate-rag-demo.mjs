// Presentation-only projection of an exact public dev evidence allowlist.
// No model calls, credentials, directory traversal, or protected eval reads.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = new URL("../../../../week13-rag/", import.meta.url);
const inputs = [];
async function read(path) {
  const bytes = await readFile(new URL(path, root));
  inputs.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
  return bytes.toString("utf8");
}
const json = async (path) => JSON.parse(await read(path));
const dev = await json("eval/dev/items.json");
if (dev.split !== "dev") throw new Error("Expected dev split");
const registry = await json("evidence/serialization/registry-rules-c0a4b85.json");
const full = await json("evidence/baseline/dev-full-context-prompt-v1-json-output-01.json");
const bm25 = await json("evidence/bm25-e2e/dev-bm25-e2e-top10-01.json");
const diagnosticPath = "notes/dev-semantic-checklist-worksheet.md";
const worksheet = await read(diagnosticPath);
const closeout = worksheet.split("## 11. split 级收口")[1]?.split(/\n## /)[0];
if (!closeout) throw new Error("Missing human diagnostic closeout");
const diagnosticRows = [...closeout.matchAll(/^\| \d+ \| `([^`]+)` \| \*\*(通过|不通过)\*\*/gm)];
if (diagnosticRows.length !== dev.items.length) throw new Error("Incomplete human diagnostic closeout");
const diagnostic = { passed: diagnosticRows.filter((row) => row[2] === "通过").length,
  total: diagnosticRows.length, source: `${diagnosticPath} §11`, status: "R1 运行后诊断" };
const retrieval = [];
for (const [method, files] of Object.entries({
  BM25: ["dev-bm25-top10-02.json", "dev-bm25-top20-01.json", "dev-bm25-top30-01.json"],
  Dense: ["dev-dense-top10-01.json", "dev-dense-top20-01.json", "dev-dense-top30-01.json"],
  Hybrid: ["dev-hybrid-top10-01.json", "dev-hybrid-top20-01.json", "dev-hybrid-top30-01.json"],
})) {
  for (const [index, file] of files.entries()) {
    const data = await json(`evidence/retrieval/${file}`);
    const applicable = data.items.filter((item) => item.retrieval.passed !== null);
    retrieval.push({ method, k: [10, 20, 30][index], passed: applicable.filter((item) => item.retrieval.passed).length,
      total: applicable.length, source: `evidence/retrieval/${file}` });
  }
}
const sourceText = {
  "AGENTS.md": (await read("corpus/rules-c0a4b85/documents/AGENTS.md")).split("\n"),
  "TECHNICAL-WRITING-PROTOCOL.md": (await read("corpus/rules-c0a4b85/documents/TECHNICAL-WRITING-PROTOCOL.md")).split("\n"),
};
const choices = [
  ["w13-dev-direct-answer-02", "回答与引用"],
  ["w13-dev-no-answer-01", "按预期拒答"],
  ["w13-dev-priority-conflict-exception-01", "False abstention"],
];
const cases = choices.map(([id, label]) => {
  const item = bm25.items.find((row) => row.itemId === id);
  const expected = dev.items.find((row) => row.id === id);
  if (!item || !expected) throw new Error(`Missing dev case ${id}`);
  const parsed = item.record.parsed;
  const citations = [...new Set((parsed.claims ?? []).flatMap((claim) => claim.citations))].map((citation) => {
    const entry = registry.find((row) => row.source_id === citation);
    if (!entry) throw new Error(`Unresolvable citation ${citation}`);
    const span = entry.source_span;
    const lines = sourceText[span.source_path];
    if (!lines) throw new Error(`Source outside presentation allowlist: ${span.source_path}`);
    return { id: citation, path: span.source_path, start: span.line_start, end: span.line_end, modelContent: entry.model_content,
      lines: lines.slice(span.line_start - 1, span.line_end).map((text, index) => ({ number: span.line_start + index, text })) };
  });
  return { id, label, query: item.query, expected: expected.expected_branch, actual: parsed.branch,
    claims: parsed.claims ?? [], reason: parsed.reason_text ?? "", reasonCode: parsed.reason_code ?? "",
    contextChars: item.context.chars, promptTokens: item.record.usage.prompt_tokens, citations,
    hits: item.hits.map(({ rank, source_id }) => ({ rank, sourceId: source_id })) };
});
const range = (numbers) => ({ min: Math.min(...numbers), max: Math.max(...numbers), total: numbers.reduce((a, b) => a + b, 0) });
const stats = (data) => ({ items: data.items.length, mechanical: data.summary.mechanical.passed,
  promptTokens: range(data.items.map((item) => item.record.usage.prompt_tokens)),
  pending: data.summary.verdicts.pending, citationResolvableMin: data.summary.gate.citation_precision_min });
const data = { snapshot: full.corpus.snapshotId, documents: new Set(registry.map((entry) => entry.source_span.source_path)).size,
  blocks: registry.length, contextChars: full.evidenceContext.chars,
  recordedAt: "2026-09-10", full: { ...stats(full), diagnostic }, bm25: { ...stats(bm25), context: range(bm25.items.map((item) => item.context.chars)) },
  retrieval, cases, inputs };
const serialized = `${JSON.stringify(data, null, 2)}\n`;
const target = new URL("../src/ragDemoData.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8") !== serialized) throw new Error("RAG presentation data is stale; run generate:rag");
  console.log(`RAG data verified: ${inputs.length} exact inputs, ${cases.length} dev replays, ${retrieval.length} retrieval configurations`);
} else {
  await writeFile(target, serialized);
  console.log(`Generated ${fileURLToPath(target)} from ${inputs.length} exact inputs`);
}
