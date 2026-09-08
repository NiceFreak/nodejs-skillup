import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const evalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifyAll = process.argv.includes("--all");
const allowedArgs = new Set(["--all"]);

for (const arg of process.argv.slice(2)) {
  if (!allowedArgs.has(arg)) {
    throw new Error(`Unknown argument: ${arg}`);
  }
}

const expectedVersion = "w13-eval-v1";
const expectedSnapshot = "rules-c0a4b85";
const behaviorTypes = [
  "direct_answer",
  "cross_document",
  "paraphrase",
  "priority_conflict_exception",
  "no_answer",
];
const behaviorSlugs = new Map([
  ["direct_answer", "direct-answer"],
  ["cross_document", "cross-document"],
  ["paraphrase", "paraphrase"],
  ["priority_conflict_exception", "priority-conflict-exception"],
  ["no_answer", "no-answer"],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(evalRoot, relativePath), "utf8"));
}

async function sha256(relativePath) {
  const content = await readFile(path.join(evalRoot, relativePath));
  return createHash("sha256").update(content).digest("hex");
}

async function validateSourceSpan(itemId, requirement) {
  assert(requirement.span_id, `${itemId}: source span is missing span_id`);
  assert(requirement.source_path?.startsWith("documents/"), `${itemId}: invalid source_path`);
  assert(Number.isInteger(requirement.line_start) && requirement.line_start >= 1, `${itemId}: invalid line_start`);
  assert(
    Number.isInteger(requirement.line_end) && requirement.line_end >= requirement.line_start,
    `${itemId}: invalid line_end`,
  );

  const expectedSpanId = `${expectedSnapshot}/${requirement.source_path.slice("documents/".length)}#L${requirement.line_start}-L${requirement.line_end}`;
  assert(requirement.span_id === expectedSpanId, `${itemId}: span_id does not match its path and line range`);

  const sourcePath = path.resolve(evalRoot, "../corpus", expectedSnapshot, requirement.source_path);
  const sourceLines = (await readFile(sourcePath, "utf8")).split(/\r?\n/);
  assert(requirement.line_end <= sourceLines.length, `${itemId}: source span exceeds ${requirement.source_path}`);
}

async function validateSplit(relativePath, expectedSplit, globalIds, globalQueries) {
  const evaluationSet = await readJson(relativePath);
  assert(evaluationSet.schema_version === 1, `${expectedSplit}: schema_version must be 1`);
  assert(evaluationSet.eval_version === expectedVersion, `${expectedSplit}: wrong eval_version`);
  assert(evaluationSet.contract_status === "frozen", `${expectedSplit}: contract is not frozen`);
  assert(evaluationSet.corpus_snapshot_id === expectedSnapshot, `${expectedSplit}: wrong corpus snapshot`);
  assert(evaluationSet.split === expectedSplit, `${expectedSplit}: split field mismatch`);
  assert(Array.isArray(evaluationSet.items) && evaluationSet.items.length === 10, `${expectedSplit}: expected 10 items`);

  const counts = new Map(behaviorTypes.map((type) => [type, 0]));
  for (const item of evaluationSet.items) {
    assert(!globalIds.has(item.id), `${item.id}: duplicate item ID`);
    assert(!globalQueries.has(item.query), `${item.id}: duplicate query`);
    globalIds.add(item.id);
    globalQueries.add(item.query);

    assert(behaviorSlugs.has(item.behavior_type), `${item.id}: unknown behavior_type`);
    const idPattern = new RegExp(`^w13-${expectedSplit}-${behaviorSlugs.get(item.behavior_type)}-[0-9]{2}$`);
    assert(idPattern.test(item.id), `${item.id}: ID does not match split and behavior type`);
    counts.set(item.behavior_type, counts.get(item.behavior_type) + 1);

    const expectedBranch = item.behavior_type === "no_answer" ? "abstained" : "answered";
    assert(item.expected_branch === expectedBranch, `${item.id}: branch does not match behavior type`);
    assert(typeof item.query === "string" && item.query.length > 0, `${item.id}: empty query`);
    assert(
      typeof item.expected_rule_conclusion === "string" && item.expected_rule_conclusion.length > 0,
      `${item.id}: empty expected conclusion`,
    );
    assert(
      Array.isArray(item.evidence_requirements) && item.evidence_requirements.length > 0,
      `${item.id}: missing evidence requirements`,
    );

    const sourceDocuments = new Set();
    let hasCorpusAbsence = false;
    for (const requirement of item.evidence_requirements) {
      assert(
        typeof requirement.requirement === "string" && requirement.requirement.length > 0,
        `${item.id}: empty requirement`,
      );
      if (requirement.kind === "source_span") {
        await validateSourceSpan(item.id, requirement);
        sourceDocuments.add(requirement.source_path);
      } else if (requirement.kind === "corpus_absence") {
        assert(requirement.scope === "entire_corpus", `${item.id}: corpus absence scope must be entire_corpus`);
        hasCorpusAbsence = true;
      } else {
        throw new Error(`${item.id}: unknown evidence requirement kind`);
      }
    }

    assert(
      hasCorpusAbsence === (item.behavior_type === "no_answer"),
      `${item.id}: corpus_absence does not match behavior type`,
    );
    if (item.behavior_type === "cross_document") {
      assert(sourceDocuments.size >= 2, `${item.id}: cross-document item needs at least two documents`);
    }
  }

  for (const type of behaviorTypes) {
    assert(counts.get(type) === 2, `${expectedSplit}: expected 2 items for ${type}`);
  }
}

const manifest = await readJson("manifest.json");
assert(manifest.schema_version === 1, "manifest: schema_version must be 1");
assert(manifest.eval_version === expectedVersion, "manifest: wrong eval_version");
assert(manifest.contract_status === "frozen", "manifest: contract is not frozen");
assert(manifest.corpus_snapshot_id === expectedSnapshot, "manifest: wrong corpus snapshot");

const globalIds = new Set();
const globalQueries = new Set();
const splitFiles = verifyAll ? [["dev/items.json", "dev"], ["holdout/items.json", "holdout"]] : [["dev/items.json", "dev"]];

for (const [relativePath, split] of splitFiles) {
  await validateSplit(relativePath, split, globalIds, globalQueries);
}

const filesToVerify = verifyAll
  ? Object.keys(manifest.files)
  : ["schemas/evaluation-set.schema.json", "scoring-contract.md", "dev/items.json"];

for (const relativePath of filesToVerify) {
  assert(manifest.files[relativePath], `manifest: missing hash for ${relativePath}`);
  assert((await sha256(relativePath)) === manifest.files[relativePath].sha256, `${relativePath}: sha256 mismatch`);
}

if (verifyAll) {
  const contractHashInput = Object.keys(manifest.files)
    .sort()
    .map((relativePath) => `${relativePath}\0${manifest.files[relativePath].sha256}\n`)
    .join("");
  const contractHash = createHash("sha256").update(contractHashInput).digest("hex");
  assert(contractHash === manifest.contract_hash, "manifest: contract_hash mismatch");
}

console.log(
  verifyAll
    ? "W13 eval contract verified: 20/20 items, 10/10 per split, five behavior types x 2 per split, hashes valid."
    : "W13 dev eval contract verified: 10/10 items, five behavior types x 2, hashes valid; holdout not read.",
);
