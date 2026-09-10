import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// 判定入口护栏：进入「item 通过 / 不通过」判定的可读入口只能引用冻结契约，不得自行重述判定规则。
// 事故依据：2026-09-10 的 `dev-semantic-checklist-worksheet.md` 在契约外重述规则（见 DEBT.md 与 day4 笔记 §6.11）。
// 边界：只读 notes 下的入口文件；不读 holdout；不修改任何冻结对象。

const evalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(evalRoot, "..");

const args = process.argv.slice(2);
const fileFlag = args.indexOf("--file");
// 判定入口清单：dev 素材必检；holdout 素材存在时同样受检（同一判定口径）。
const DEFAULT_ENTRIES = [
  "notes/dev-semantic-checklist-worksheet.md",
  "notes/holdout-semantic-checklist.md",
];
const entryPaths =
  fileFlag === -1 ? DEFAULT_ENTRIES.map((rel) => path.join(root, rel)) : [path.resolve(args[fileFlag + 1])];

function labelOf(entryPath) {
  const relativeLabel = path.relative(root, entryPath);
  return relativeLabel.startsWith("..") ? entryPath : relativeLabel;
}

// 判定规则的唯一来源（`w13-eval-v1`，frozen）。入口文件必须引用它，使规则可追溯。
const REQUIRED_REFERENCE = "scoring-contract.md";

// 已知的规则重述模式：每条都是「契约之外新增判定语义」的具体措辞，不是风格检查。
const RESTATEMENT_PATTERNS = [
  { needle: "合计通过数", why: "把逐题合取写成通过数合计" },
  { needle: "机械+语义合计", why: "把逐题合取写成可加关系" },
  { needle: "属语义失败还是仅格式/解析噪声", why: "把已判失败的 item 重新开放为可定性" },
  { needle: "语义可通过的题", why: "使 per-class 门禁取决于契约外口径" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let checked = 0;
for (const entryPath of entryPaths) {
  const entryLabel = labelOf(entryPath);
  if (!existsSync(entryPath)) {
    if (fileFlag !== -1) throw new Error(`${entryLabel}: 指定的入口文件不存在`);
    console.log(`W13 decision entry skipped (not present yet): ${entryLabel}`);
    continue;
  }

  const text = await readFile(entryPath, "utf8");
  assert(
    text.includes(REQUIRED_REFERENCE),
    `${entryLabel}: 未引用 ${REQUIRED_REFERENCE}，判定规则的来源不可追溯`,
  );

  const hits = RESTATEMENT_PATTERNS.filter((pattern) => text.includes(pattern.needle));
  assert(
    hits.length === 0,
    `${entryLabel}: 入口文件出现规则重述：\n` +
      hits.map((hit) => `  - "${hit.needle}"（${hit.why}）`).join("\n"),
  );

  checked += 1;
  console.log(
    `W13 decision entry verified: ${entryLabel} cites ${REQUIRED_REFERENCE} and restates no scoring rule ` +
      `(${RESTATEMENT_PATTERNS.length} patterns checked).`,
  );
}

assert(checked > 0, "没有可检查的判定入口文件");
