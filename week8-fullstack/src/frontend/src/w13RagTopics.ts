// W13 RAG 输入工程的五块（T1–T5）。设计契约与形态推导见
// week13-rag/notes/week13-visualization-plan.md §5–§6、裁决见 §14。
// 导航顺序沿用 §14 第 7 项的交付顺序（T5 → T3 → T2 → T1 → T4），不是阶段顺序。
//
// 数字一律从 w13RagData.ts 插值：那份文件由 scripts/export-w13-rag-data.mjs 从
// week13-rag 的产物算出，脚本内的恒等式断言保证各分项闭合。这里不出现任何手写的量。
// 事实等级统一为「产物复算」——由脚本从已落盘产物算出的量，不是模型运行结果，
// 也不是本人当场实测；单位是字符（chars），不是 token、不是 bytes。
import type { AeBase } from "./aiEngineerTopics";
import { W13_RAG_DATA } from "./w13RagData";

export const W13_GROUP = "RAG 输入工程（W13）" as const;

/** 每块回指总览的哪一段。读者先在总览见过这段，再进来看它的展开——不必自己拼全局。 */
export const W13_STAGE_OF: Record<string, string> = {
  "rag-freeze": "① 冻结的规则文档",
  "rag-scan": "② 切成可引用的块",
  "rag-composition": "③ 拼成模型看见的证据",
  "rag-eval": "⑤ 判分拿 ID 走回原文",
  "rag-coverage": "贯穿 ①–③：确定性层怎么被证明",
};

const D = W13_RAG_DATA;
const n = (v: number) => v.toLocaleString("zh-CN");

/* ============================================================ T3 组装与组成 */

export type W13Layer = "core" | "context" | "wrapper" | "separator";

export interface W13CompositionTopic extends AeBase {
  kind: "w13-composition";
  /** 瀑布：四级合计与三段增减，顺序即阅读顺序。 */
  steps: Array<{
    id: string;
    label: string;
    /** total = 从基线起的合计；delta = 浮动段，from 是它的起点。 */
    role: "total" | "delta";
    value: number;
    from?: number;
    /** 增减方向只对 delta 有意义；下降段用位置 + 虚线，不靠颜色。 */
    direction?: "up" | "down";
    layer?: W13Layer | "excluded";
    detail: string;
  }>;
  /** 右侧单个 entry 的四帧：每帧只加一层。 */
  frames: Array<{ id: string; layer: W13Layer; title: string; text: string }>;
  layerLegend: Array<{ layer: W13Layer; label: string; glyph: string }>;
  rules: Array<{ title: string; text: string; ref: string }>;
}

const nc = D.chars.nonCore;
const excluded = nc.blank.chars + nc.heading.chars + nc.thematicBreak.chars + nc.tableHeader.chars;
const sampleCoreChars = D.sample.core.length;
const sampleCtxChars = D.sample.modelContent.length - sampleCoreChars;
const sampleWrapChars = D.sample.serialized.length - D.sample.modelContent.length;

export const W13_COMPOSITION: W13CompositionTopic = {
  kind: "w13-composition",
  id: "rag-composition",
  label: "组装与组成",
  title: "Evidence Context 由什么构成",
  question: "进入模型的 Evidence Context 由哪几部分组成，各部分分别有多大？",
  anchor: `进入模型的 ${n(D.chars.evidenceContext)} chars 里，只有 ${n(D.chars.core)} 来自核心正文。`,
  group: W13_GROUP,
  evidenceKind: "产物复算",
  source: `registry-${D.snapshotId}.json · evidence-context-${D.snapshotId}.txt`,
  boundary:
    `另外 ${n(D.chars.context)} chars 来自把必要标题与表头复制进每个块，${n(D.chars.tags + D.chars.separators)} 来自 wrapper 标签与块间空行。` +
    "单位是字符，不是 token；serialized 输入的 token 计量未执行，本块不出现任何 token 单位的量。",
  memory: `瀑布里那一段向下的台阶：原文有 ${n(excluded)} chars 从不进入任何可引用块，其中标题与表头随后以语境身份重新进入，thematic break 与空行不再出现。`,
  accept:
    `${n(D.chars.evidenceContext)} 里有 ${n(D.chars.core)} 来自核心正文；${n(D.chars.core)} + ${n(D.chars.context)} = ${n(D.chars.modelContent)}，` +
    `${n(D.chars.modelContent)} + ${n(D.chars.tags + D.chars.separators)} = ${n(D.chars.evidenceContext)}；原文 ${n(D.chars.corpus)} 到核心正文是下降 ${n(excluded)}；本块 DOM 不含 token 单位数值。`,
  sources: [
    { label: "组装规范（单一规范 §6.2.0）", ref: "week13-rag/notes/day3-freeze-serialization-contract.md §6.2.0" },
    { label: "registry 产物（572 entries）", ref: `week13-rag/evidence/serialization/registry-${D.snapshotId}.json` },
    { label: "Evidence Context 整串", ref: `week13-rag/evidence/serialization/evidence-context-${D.snapshotId}.txt` },
    { label: "数据导出脚本（恒等式断言）", ref: "week8-fullstack/src/frontend/scripts/export-w13-rag-data.mjs" },
  ],
  steps: [
    { id: "corpus", label: "语料原文", role: "total", value: D.chars.corpus, detail: `${D.corpus.files} 份文档，${n(D.corpus.lines)} 行（非空 ${n(D.corpus.nonBlankLines)} 行）` },
    {
      id: "excluded", label: "不进入任何核心 span", role: "delta", value: excluded, from: D.chars.core, direction: "down", layer: "excluded",
      detail: `标题 ${nc.heading.lines} 行 ${n(nc.heading.chars)}；空行 ${nc.blank.lines} 行 ${n(nc.blank.chars)}；thematic break ${nc.thematicBreak.lines} 行 ${n(nc.thematicBreak.chars)}；表头与分隔 ${nc.tableHeader.lines} 行 ${n(nc.tableHeader.chars)}`,
    },
    { id: "core", label: "核心 source_span 正文", role: "total", value: D.chars.core, layer: "core", detail: `${D.blocks} 个 block 的核心行，规范化后逐字拼接` },
    { id: "context", label: "复制进每块的必要语境", role: "delta", value: D.chars.context, from: D.chars.core, direction: "up", layer: "context", detail: `heading ${n(D.contextRoles.heading)} 条 + table_header ${D.contextRoles.table_header} 条 context_spans` },
    { id: "model-content", label: "model_content 合计", role: "total", value: D.chars.modelContent, layer: "context", detail: "content_sha256 只对这一层的每块字节计算" },
    { id: "wrapper", label: "wrapper 标签与块间空行", role: "delta", value: D.chars.tags + D.chars.separators, from: D.chars.modelContent, direction: "up", layer: "wrapper", detail: `标签 ${n(D.chars.tags)} + 块间空行 ${n(D.chars.separators)}（${D.blocks - 1} 处，各 2 字符）` },
    { id: "evidence-context", label: "Evidence Context 整串", role: "total", value: D.chars.evidenceContext, layer: "wrapper", detail: `sha256 ${D.evidenceContextSha256.slice(0, 8)}…，与冻结基准${D.frozenMatches ? "一致" : "不一致"}` },
  ],
  frames: [
    { id: "f-core", layer: "core", title: "核心 span", text: `第 1 层：核心 source_span 正文，${n(sampleCoreChars)} chars。source_id 只标这一行的范围（${D.sample.sourceId.split("#")[1]}），是引用回源的身份。` },
    { id: "f-context", layer: "context", title: "前置必要语境", text: `第 2 层：前置 ${D.sample.contextParts.length} 条 context_spans（${D.sample.contextParts.map((p) => `${p.role} ${p.span}`).join("、")}），+${n(sampleCtxChars)} chars。到这里为止是 model_content，content_sha256 只算这一段。` },
    { id: "f-wrapper", layer: "wrapper", title: "包 wrapper", text: `第 3 层：开标签 + LF + model_content + 闭标签，+${sampleWrapChars} chars。标签是模型与机械回读区分块边界的唯一信号，不进 hash。` },
    { id: "f-separator", layer: "separator", title: "块间空行", text: `第 4 层：与相邻块之间恰一个空行（+2 chars）。它属于 Evidence Context 组装层格式，不属于任何 block 的正文。末帧字节与 registry 实测一致。` },
  ],
  layerLegend: [
    { layer: "core", label: "核心 span（hash 与 ID 的对象）", glyph: "■" },
    { layer: "context", label: "复制语境（进 hash，不进 ID）", glyph: "▨" },
    { layer: "wrapper", label: "wrapper 标签（不进 hash）", glyph: "▢" },
    { layer: "separator", label: "块间空行（组装层格式）", glyph: "┄" },
  ],
  rules: [
    { title: "wrapper 精确字节", text: "单 block 字节 = <source id=\"…\"> + LF + model_content + </source>；开闭标签独立成行，id 用双引号。", ref: "day3 §6.2.0 #3" },
    { title: "块间恰一个空行，首尾无额外空行", text: `N 个 blocks 之间恰有 N−1 个块间空行；空 blocks 输出空串。本次 ${D.blocks - 1} 处，共 ${n(D.chars.separators)} chars。`, ref: "day3 §6.2.0 #5" },
    { title: "hash 只覆盖 model_content", text: "content_sha256 = SHA-256(model_content 的 UTF-8 全字节)，不含 wrapper 与组装层字节；wrapper 或块序错了 hash 仍全部一致。", ref: "day3 §6.2.0 #4" },
    { title: "thematic break 与空行为何从不进入核心", text: `thematic break 只作禁止跨越合并的硬边界，不形成证据内容；核心 span 之外的空行是块级分隔。两者共 ${n(nc.thematicBreak.chars + nc.blank.chars)} chars 不再出现在任何层。`, ref: "day2 §6.1；day3 §6.2.0 #2" },
  ],
};

/* ============================================================ T5 验证与证据 */

export type W13MeansId = "hash" | "golden" | "invariant" | "two-pass" | "build-guard" | "none";
export type W13ObjectId = "model-content" | "wrapper" | "order" | "registry" | "boundary";

export interface W13Check {
  id: string;
  /** test = tests/ 里的 pytest；build = 构建期抛错的前置检查；manual = 尚无自动化 */
  kind: "test" | "build" | "manual";
  file?: string;
  name: string;
  label: string;
  cells: Array<[W13MeansId, W13ObjectId]>;
}

export interface W13CoverageTopic extends AeBase {
  kind: "w13-coverage";
  means: Array<{ id: W13MeansId; label: string; note: string }>;
  objects: Array<{ id: W13ObjectId; label: string }>;
  checks: W13Check[];
  criteria: Array<{ no: number; text: string; cells: Array<[W13MeansId, W13ObjectId]> }>;
}

const CHECKS: W13Check[] = [
  { id: "t-a", kind: "test", file: "test_fixture_serialization.py", name: "test_fixture_a_model_content_and_hash", label: "fixture A：model_content 逐字节 + 期望 hash（含行尾 hard break 保留）", cells: [["golden", "model-content"], ["hash", "model-content"]] },
  { id: "t-b2", kind: "test", file: "test_fixture_serialization.py", name: "test_fixture_b2_model_content_and_serialized", label: "fixture B2：顶层列表项的 model_content、hash 与 serialized block 字节", cells: [["golden", "model-content"], ["hash", "model-content"], ["golden", "wrapper"]] },
  { id: "t-a-ser", kind: "test", file: "test_fixture_serialization.py", name: "test_fixture_a_serialized_block", label: "fixture A：wrapper 包裹后的完整字节", cells: [["golden", "wrapper"]] },
  { id: "t-two", kind: "test", file: "test_fixture_serialization.py", name: "test_fixture_two_block_evidence_context", label: "fixture B：双 block 整串——块间恰一个空行、首尾无空行、整串 sha256", cells: [["golden", "order"], ["golden", "wrapper"]] },
  { id: "t-c", kind: "test", file: "test_fixture_serialization.py", name: "test_fixture_c_order_heading_then_header_then_core", label: "fixture C：heading → table_header → 核心的组装顺序；source_id 只标核心行", cells: [["golden", "model-content"], ["hash", "model-content"], ["golden", "wrapper"]] },
  { id: "t-audit", kind: "test", file: "test_registry_real.py", name: "test_real_corpus_build_has_no_uncovered_or_duplicated_lines", label: "真实语料：source_id 唯一；每份文档 uncovered 与 duplicated 均为空", cells: [["invariant", "registry"]] },
  { id: "t-twopass", kind: "test", file: "test_registry_real.py", name: "test_real_corpus_two_pass_is_byte_identical", label: "真实语料：两次独立构建的整串、逐块 hash 与整串 sha256 逐字节一致", cells: [["two-pass", "model-content"], ["two-pass", "wrapper"], ["two-pass", "order"]] },
  { id: "t-hash", kind: "test", file: "test_registry_real.py", name: "test_every_entry_hash_recomputes_and_source_span_matches_source_id", label: "真实语料：每个 entry 的 hash 可复算；source_id 行范围 === 核心 span；正文不含字面 <source", cells: [["hash", "model-content"], ["invariant", "registry"], ["invariant", "wrapper"]] },
  { id: "t-edges", kind: "test", file: "test_registry_real.py", name: "test_evidence_context_has_no_leading_trailing_blank_lines", label: "真实语料：整串 === 组装函数输出，且首尾无空行", cells: [["invariant", "order"]] },
  { id: "b-dup", kind: "build", name: "registry.build_entries · duplicate source_id", label: "构建期：重复 source_id 直接抛错，不静默覆盖", cells: [["build-guard", "registry"]] },
  { id: "b-wrap", kind: "build", name: "registry.WRAPPER_FORBIDDEN", label: "构建期：正文含字面 <source 或 </source> 即失败（前缀守卫）", cells: [["build-guard", "wrapper"]] },
  { id: "m-boundary", kind: "manual", name: "判据 #7 职责边界", label: "Evidence Context 不含运行元数据；评测字段不进模型输入；Prompt / Query 各司其职——tests/ 里没有对应断言", cells: [["none", "boundary"]] },
];

/** 数据层里的 9 条测试与本文件的映射对不上时，差集会显示在页面上，由 verify:board 断言为空。 */
export const W13_UNMAPPED_TESTS = D.tests
  .map((t) => t.name)
  .filter((name) => !CHECKS.some((c) => c.kind === "test" && c.name === name));
export const W13_STALE_CHECKS = CHECKS
  .filter((c) => c.kind === "test" && !D.tests.some((t) => t.name === c.name))
  .map((c) => c.name);

export const W13_COVERAGE: W13CoverageTopic = {
  kind: "w13-coverage",
  id: "rag-coverage",
  label: "验证与证据",
  title: "验证手段各自管到哪里",
  question: "每种验证手段各自管到哪里，哪些对象目前没有自动化断言？",
  anchor: `确定性组装层可重跑并与冻结基准一致（整串 sha256 ${D.evidenceContextSha256.slice(0, 8)}…）；职责边界（判据 #7）没有自动化断言。`,
  group: W13_GROUP,
  evidenceKind: "产物复算",
  source: `criteria-report-${D.snapshotId}.md · tests/*.py`,
  boundary:
    `${D.tests.length} 条测试与覆盖审计只覆盖确定性层，不证明语义切分合理，也不证明模型回答正确。` +
    "wrapper 前置检查与重复 ID 检查发生在构建期（registry.py 抛错），不在 tests/ 里。",
  memory: "content_sha256 那一行只有一格有值：指纹全绿只说明 model_content 没变，说明不了块与块之间的关系。",
  accept:
    `content_sha256 行只覆盖 model_content 一格；职责边界列只落在无自动化行；${D.tests.length} 条测试各至少连到一格；` +
    `${D.audit.length} 份文档 uncovered 与 duplicated 均为 0；two-pass 逐字节一致；整串 sha256 与冻结基准${D.frozenMatches ? "一致" : "不一致"}。`,
  sources: [
    { label: "判据 #1–#7 逐字（已确认）", ref: "week13-rag/notes/day3-freeze-serialization-contract.md §6.1 设计点 6" },
    { label: "fixture 回归 5 条", ref: "week13-rag/tests/test_fixture_serialization.py" },
    { label: "真实语料不变式 4 条", ref: "week13-rag/tests/test_registry_real.py" },
    { label: "构建期前置检查", ref: "week13-rag/src/w13rag/registry.py build_entries / WRAPPER_FORBIDDEN" },
    { label: "覆盖审计与 two-pass 记录", ref: `week13-rag/evidence/serialization/criteria-report-${D.snapshotId}.md` },
  ],
  means: [
    { id: "hash", label: "content_sha256", note: "逐块指纹：同一 model_content 没变" },
    { id: "golden", label: "fixture 期望字节", note: "合成 fixture A/B/C 的逐字节 golden" },
    { id: "invariant", label: "结构不变式", note: "真实语料上的唯一性、覆盖、首尾" },
    { id: "two-pass", label: "two-pass 双跑", note: "两次独立构建逐字节比对" },
    { id: "build-guard", label: "构建期前置检查", note: "违反即抛错，产物不落盘" },
    { id: "none", label: "无自动化", note: "只有契约文字与人工复核" },
  ],
  objects: [
    { id: "model-content", label: "model_content 正文" },
    { id: "wrapper", label: "wrapper 字节" },
    { id: "order", label: "块序与块间分隔" },
    { id: "registry", label: "registry 契约（ID、span、覆盖）" },
    { id: "boundary", label: "职责边界" },
  ],
  checks: CHECKS,
  criteria: [
    { no: 1, text: "model_content 只由登记 spans 按 heading（由外到内）→ table_header → 核心 source_span 顺序逐字组装，规范化符合 §6.2.0 #2，缺失层级省略，同输入重算一致。", cells: [["golden", "model-content"], ["hash", "model-content"]] },
    { no: 2, text: "content_sha256 = SHA-256(model_content 的 UTF-8 全字节)，读文件剥 BOM，整串原样不裁剪不追加。", cells: [["hash", "model-content"]] },
    { no: 3, text: "wrapper 字节精确；source_id 行范围 === 核心 source_span；附加语境不扩大 identifier 行范围；正文不得含字面 <source / </source>（前缀守卫）。", cells: [["golden", "wrapper"], ["invariant", "registry"], ["build-guard", "wrapper"]] },
    { no: 4, text: "Evidence Context = manifest 文档顺序 → 核心行号升序；块间恰一个空行；首尾无额外空行；空输入空串。", cells: [["golden", "order"], ["invariant", "order"]] },
    { no: 5, text: "每条非空非结构性正文行至少属于一个 core 且不重复；spans 可从 snapshot 回读；重复 source_id 构建失败。", cells: [["invariant", "registry"], ["build-guard", "registry"]] },
    { no: 6, text: "同一 snapshot 两次构建 registry 与 Evidence Context 逐字节一致；真实全语料整串首次产出后冻结为独立 regression 基准。", cells: [["two-pass", "model-content"], ["two-pass", "wrapper"], ["two-pass", "order"]] },
    { no: 7, text: "Evidence Context 不含块数汇总 / 版本号 / 运行元数据；reference answer、expected branch、evidence requirement 不进模型输入；Prompt / Query 各司其职；content_sha256 只作完整性验证，不作身份。", cells: [["none", "boundary"]] },
  ],
};

/* ============================================================ T1 输入冻结 */

export interface W13FreezeTopic extends AeBase {
  kind: "w13-freeze";
  /** 一次完整性校验的三步；每帧只引入一步。 */
  steps: Array<{ id: string; title: string; text: string }>;
  /** 三个单位的排序对照：同一组文件按三个单位排名并不一致，这是「不能换算」的直接证据。 */
  unitRanks: Array<{ sourcePath: string; bytes: number; chars: number; tokens: number; rankBytes: number; rankChars: number; rankTokens: number }>;
  tokenizer: {
    accepted: string;
    rejected: string;
    roundTrips: string;
    rejectedReason: string;
  };
}

const rankBy = (key: "bytes" | "chars" | "estimatedTokens") => {
  const sorted = [...D.tokens.byDoc].sort((a, b) => b[key] - a[key]).map((d) => d.sourcePath);
  return (path: string) => sorted.indexOf(path) + 1;
};
const rBytes = rankBy("bytes");
const rChars = rankBy("chars");
const rTokens = rankBy("estimatedTokens");
const unitRanks = D.tokens.byDoc.map((d) => ({
  sourcePath: d.sourcePath,
  bytes: d.bytes,
  chars: d.chars,
  tokens: d.estimatedTokens,
  rankBytes: rBytes(d.sourcePath),
  rankChars: rChars(d.sourcePath),
  rankTokens: rTokens(d.sourcePath),
}));
/** 三个单位排名不一致的文件——它们是「bytes / chars / token 不能互相换算」的可核对现象。 */
export const W13_RANK_DISAGREE = unitRanks.filter((r) => r.rankBytes !== r.rankChars || r.rankChars !== r.rankTokens);

export const W13_FREEZE: W13FreezeTopic = {
  kind: "w13-freeze",
  id: "rag-freeze",
  label: "输入冻结",
  title: "语料快照与逐文件完整性",
  question: "冻结一份语料之后，靠什么证明「现在读到的和当初冻结的是同一份」？",
  anchor: `完整性由 manifest 逐文件的 bytes、sha256 与 git blob 三项比对证明，不是整体判断。`,
  group: W13_GROUP,
  evidenceKind: "产物复算",
  source: `corpus/${D.snapshotId}/manifest.json · token-count-${D.snapshotId}.json`,
  boundary:
    `${n(D.tokens.total)} tokens 是离线 tokenizer 的估算（标为 ${D.tokens.classification}），不是 provider usage；` +
    "normalization 发生在建快照时，不是校验链里的一步。",
  memory: `${D.corpus.files} 行文件条右端各挂三格指纹（bytes / sha256 / git blob）——完整性是逐文件、逐项的，不是一个总数。`,
  accept:
    `比对粒度是逐文件、逐项三项；本次导出对 ${D.integrity.checkedFiles} 份文档复算 bytes、sha256 与 git blob 并与 manifest 全部一致；` +
    `${n(D.tokens.total)} tokens 标为 ${D.tokens.classification}，与 ${n(D.corpus.bytes)} bytes、${n(D.corpus.chars)} chars 是三个不可换算的单位。`,
  sources: [
    { label: "冻结 manifest（逐文件 bytes / sha256 / gitBlob）", ref: `week13-rag/corpus/${D.snapshotId}/manifest.json` },
    { label: "离线 token 估算证据", ref: `week13-rag/evidence/token-count-${D.snapshotId}.json` },
    { label: "D1 冻结与计量的过程记录", ref: "week13-rag/notes/day1-corpus-freeze-and-baseline.md §2.3.3" },
    { label: "本次复算的导出脚本", ref: "week8-fullstack/src/frontend/scripts/export-w13-rag-data.mjs" },
  ],
  steps: [
    { id: "read", title: "读取快照文件", text: `第 1 步：按 manifest 的 documents 顺序读入 ${D.corpus.files} 份快照文档的原始字节。读的是 corpus/${D.snapshotId}/documents/ 下的副本，不是工作树里的当前文件。` },
    { id: "compute", title: "复算三项指纹", text: `第 2 步：对每份文档的字节各算三项——字节数、SHA-256、git blob（sha1 of "blob <字节数>\\0" + 内容）。三项分别对应长度、内容与 Git 对象身份，任一项都能独立发现改动。` },
    { id: "compare", title: "与 manifest 逐文件比对", text: `第 3 步：逐文件、逐项与 manifest 记录值比对。本次导出 ${D.integrity.checkedFiles} 份文档全部一致；任一项不符，导出脚本直接抛错，产物不会生成。` },
  ],
  unitRanks,
  tokenizer: {
    accepted: `transformers ${D.tokens.accepted.transformers} / tokenizers ${D.tokens.accepted.tokenizers}（${D.tokens.accepted.tokenizerClass}）`,
    rejected: `transformers ${D.tokens.rejected.transformers} / tokenizers ${D.tokens.rejected.tokenizers}`,
    roundTrips: `${D.tokens.accepted.roundTripsPassed}/${D.tokens.accepted.roundTripsTotal} 份文档编解码回环通过`,
    rejectedReason: `该组合给出 ${n(D.tokens.rejected.estimatedTotal)} tokens 并被拒绝：${D.tokens.rejected.reason}`,
  },
};

/* ========================================================== T2 切分与引用 */

export interface W13ScanTopic extends AeBase {
  kind: "w13-scan";
  fragment: { sourcePath: string; from: number; to: number };
  rules: Array<{ title: string; text: string; ref: string }>;
}

export const W13_SCAN: W13ScanTopic = {
  kind: "w13-scan",
  id: "rag-scan",
  label: "切分与引用",
  title: "parser 扫描与身份 / 指纹分离",
  question: "一份 Markdown 怎样被确定性地切成可引用的 source block，引用 ID 指向的又是什么？",
  anchor: `${n(D.blocks)} 个 block 由不调用模型的 parser 按冻结规则重算，ID 只标核心行范围。`,
  group: W13_GROUP,
  evidenceKind: "产物复算",
  source: `registry-${D.snapshotId}.json · criteria-report-${D.snapshotId}.md`,
  boundary:
    "必要标题与表头进 context_spans，不扩大 source_id 的行范围；content_sha256 只验证完整性，不作身份。" +
    `块的语义粒度是否合理不由本块证明——${D.audit.length} 份文档 uncovered 与 duplicated 为 0 只说明没有静默丢失或重复。`,
  memory: "标题栈的阶梯随行升降，块边界刻度在 thematic break 处永不跨越。",
  accept:
    `标题进语境不单独成块；source_id 只标核心行范围（附加语境不扩大它）；thematic break 不跨越合并；表头复制进每个数据行块；` +
    `${n(D.blocks)} 个块按类型分为 ${D.blockKinds.length} 类，标题层数分布 ${D.headingDepth.map((h) => `${h.depth} 层 ${h.count}`).join(" / ")}。`,
  sources: [
    { label: "source block 切分规则（六条）", ref: "week13-rag/notes/day2-freeze-eval-contract.md §6.1" },
    { label: "确定性 parser 实现", ref: "week13-rag/src/w13rag/parser.py parse_blocks" },
    { label: "块类型与逐文档审计", ref: `week13-rag/evidence/serialization/criteria-report-${D.snapshotId}.md` },
    { label: "本段扫描对照的 registry 产物", ref: `week13-rag/evidence/serialization/registry-${D.snapshotId}.json` },
  ],
  fragment: { sourcePath: D.scan.sourcePath, from: D.scan.from, to: D.scan.to },
  rules: [
    { title: "标题只进语境，不单独成块", text: "标题行不形成 source block；它按由外到内的顺序作为 heading context 进入随后每个块的 model_content，让模型能确定规则的适用对象。", ref: "day2 §6.1；day3 §6.2.0 #1" },
    { title: "thematic break 是硬边界", text: "thematic break 不形成证据内容，也不进入模型可见内容；它禁止跨越合并，前后的内容不会被并进同一个块。", ref: "day2 §6.1" },
    { title: "表格按数据行拆分，每行附带表头", text: `每个数据行各自成块，并复制同一份表头作为 table_header 语境。全语料共 ${D.contextRoles.table_header} 个块带表头语境。`, ref: "day2 §6.1；day3 fixture C" },
    { title: "身份与指纹分离", text: "source_id（corpus/path#Lstart-Lend）标核心规则的原始位置，是引用回源的身份；content_sha256 只验证 model_content 的完整性，位置变化与内容变化各自触发其中一个。", ref: "day2 §6.1 source identifier" },
  ],
};

/* ========================================================== T4 评测契约 */

export type W13JudgePath = "pass" | "veto";

export interface W13EvalTopic extends AeBase {
  kind: "w13-eval";
  /** 判分链：answered 8 条 / abstained 5 条，来自判分契约 §2 / §3。 */
  chains: Array<{ path: W13JudgePath; branch: string; label: string; note: string; conditions: readonly string[]; stopAt: number | null; outcome: string }>;
  sample: { query: string; exclusion: string; responses: Record<W13JudgePath, string> };
}

export const W13_EVAL: W13EvalTopic = {
  kind: "w13-eval",
  id: "rag-eval",
  label: "评测契约",
  title: "通过条件与否决条件",
  question: "一道 eval 题在什么条件下算通过，什么条件会直接否决整个 split？",
  anchor: "一题要同时满足全部条件才通过；预期 abstained 却返回 answered 直接否决整个 split。",
  group: W13_GROUP,
  evidenceKind: "产物复算",
  source: `eval/scoring-contract.md · eval/dev/items.json（${D.eval.evalVersion}）`,
  boundary:
    `dev 五类行为各 ${D.eval.dev.byBehavior[0]?.count ?? 2} 题（${D.eval.dev.answered} 题预期 answered、${D.eval.dev.abstained} 题预期 abstained，共 ${Object.values(D.eval.dev.evidenceKinds).reduce((a, b) => a + b, 0)} 条 evidence requirements）；` +
    "本块只呈现契约，尚未运行模型，因此不含任何 metric 数值。受保护 split 只出题数与结构，不出题面。",
  memory: "判分链上那个停止标记的位置：否决不在链尾，而在第一步分支判定处。",
  accept:
    `预期 abstained 的 item 返回 answered 直接否决整个 split，不被其它题分数抵消；answered 需同时满足 ${D.eval.answeredConditions.length} 条、abstained ${D.eval.abstainedConditions.length} 条；` +
    `门禁 metric 只有 ${D.eval.metrics.filter((m) => m.gate).length} 条（${D.eval.metrics.filter((m) => m.gate).map((m) => m.metric).join(" / ")}），其余 ${D.eval.metrics.filter((m) => !m.gate).length} 条是诊断、无阈值；本块无任何 metric 数值。`,
  sources: [
    { label: "判分契约（单题条件、metrics、split 通过条件）", ref: "week13-rag/eval/scoring-contract.md §2 §3 §5 §6" },
    { label: "dev 题集结构（只读 dev）", ref: "week13-rag/eval/dev/items.json" },
    { label: "教学示例的排除声明", ref: "week13-rag/notes/day1-corpus-freeze-and-baseline.md §2.3.5" },
    { label: "合成响应引用到的真实 block", ref: `week13-rag/evidence/serialization/registry-${D.snapshotId}.json → ${D.citationSample.sourceId}` },
  ],
  chains: [
    {
      path: "pass",
      branch: "answered",
      label: "S-A：证据充分，逐条通过",
      note: "合成响应返回 answered，1 条 claim，citation 指向 registry 中真实存在的块。",
      conditions: D.eval.answeredConditions,
      stopAt: null,
      outcome: "八条全部满足 → 该 item 通过。",
    },
    {
      path: "veto",
      branch: "abstained",
      label: "S-B：预期 abstained 却作答",
      note: "合成响应对一道预期 abstained 的题返回 answered。",
      conditions: D.eval.abstainedConditions,
      stopAt: 0,
      outcome: "第 1 步分支判定即失败 → 直接否决整个 split，链上后续条件不再推进，也不被其它题分数抵消。",
    },
  ],
  sample: {
    query: "在本仓库中，AI 是否可以直接实现 Docker/docker-compose 配置？",
    exclusion: "该 query 是 D1 §2.3.5 的教学示例，已声明不计入 20 题、不得改名进入任何正式 split；此处只用于演示判分链的推进顺序。",
    responses: {
      pass: `{"branch":"answered","claims":[{"text":"Docker / docker-compose 配置属于白名单，AI 可以直接实现","citations":["${D.citationSample.sourceId}"]}]}`,
      veto: `{"branch":"answered","claims":[{"text":"（对一道预期 abstained 的题强行作答）","citations":["${D.citationSample.sourceId}"]}]}`,
    },
  },
};

/* ============================================================ T0 链路总览 */

export interface W13PipelineTopic extends AeBase {
  kind: "w13-pipeline";
  /** 五段：内容向右流（①②③），引用向左回（④⑤），⑤ 指回 ①。 */
  stages: Array<{ id: string; no: string; label: string; text: string }>;
  loopNote: string;
}

export const W13_PIPELINE: W13PipelineTopic = {
  kind: "w13-pipeline",
  id: "rag-pipeline",
  label: "总览",
  title: "一条规则问题怎么走完全链路",
  question: "一份规则文档怎么变成模型能引用的证据？引用又怎么被判对错？",
  anchor: `${D.corpus.files} 份规则文档切成 ${n(D.blocks)} 个可引用的块；模型只能引用块 ID，判分再拿 ID 走回原文核对。`,
  group: W13_GROUP,
  evidenceKind: "产物复算",
  source: `corpus/${D.snapshotId}/ · registry-${D.snapshotId}.json · eval/scoring-contract.md`,
  boundary:
    `本次是全语料上下文——${n(D.blocks)} 个块全部进入，不做检索（BM25 / dense 未实现）；` +
    "第 ④ 步的回答是契约演示的合成数据，尚未调用模型。",
  memory: `第 ⑤ 步那条回指线：引用不是一个字符串，是一条能走回 ${D.pipeline.sourcePath} 第 ${D.pipeline.coreLine} 行的路。`,
  accept:
    `能说出五段各自的输入与输出；核心行单独读不出「白名单」，是三层标题让它可回答；` +
    `citation 走回的行范围 === 第 ② 步登记的核心 span（${D.pipeline.sourceId.split("#")[1]}）。`,
  sources: [
    { label: "冻结语料与 manifest", ref: `week13-rag/corpus/${D.snapshotId}/manifest.json` },
    { label: "切块与引用登记（572 entries）", ref: `week13-rag/evidence/serialization/registry-${D.snapshotId}.json` },
    { label: "模型可见证据的组装规范", ref: "week13-rag/notes/day3-freeze-serialization-contract.md §6.2.0" },
    { label: "回答契约与判分契约", ref: "week13-rag/prompts/rag-prompt-v0.md · week13-rag/eval/scoring-contract.md" },
    { label: "本条 query 的排除声明（教学示例）", ref: "week13-rag/notes/day1-corpus-freeze-and-baseline.md §2.3.5" },
  ],
  stages: [
    {
      id: "corpus", no: "①", label: "冻结的规则文档",
      text: `起点是 ${D.corpus.files} 份规则文档的冻结快照。看第 ${D.pipeline.coreLine} 行——「Docker / docker-compose、.env.example、.gitignore」——单独读它，只是一串文件名，说不出这是白名单还是黑名单。`,
    },
    {
      id: "block", no: "②", label: "切成可引用的块",
      text: `parser 把第 ${D.pipeline.coreLine} 行定为核心行，再把它在文档里的 ${D.pipeline.contextRoles.length} 层标题（第 ${D.pipeline.contextRoles.map((c) => c.line).join(" / ")} 行，分散在文档三处）登记为语境。合起来才说得清「Docker 属于白名单」。ID 只标核心那一行。`,
    },
    {
      id: "context", no: "③", label: "拼成模型看见的证据",
      text: `每个块包上 <source id="…"> 标签，${n(D.blocks)} 个块按文档顺序拼成一段 ${n(D.pipeline.contextChars)} 字符的 Evidence Context。这一整段就是模型能看到的全部证据——它看不到原始文件，也看不到行号之外的任何定位信息。`,
    },
    {
      id: "answer", no: "④", label: "模型按证据作答",
      text: `模型只能引用 Evidence Context 里出现过的 source ID，不得自己编造或改写。这条 claim 引用了 ${D.pipeline.sourceId}；证据不足时它必须改走 abstained 分支，而不是凭预训练知识补答。`,
    },
    {
      id: "trace", no: "⑤", label: "判分拿 ID 走回原文",
      text: `判分拿这个 ID 回到冻结快照的第 ${D.pipeline.coreLine} 行，核对 claim 是否真被那几行支持。ID 能走回原文，是「引用可核」的前提——这条回指线闭合，前面四步才有意义。`,
    },
  ],
  loopNote: "内容向右流，引用向左回：两条方向相反的路径共用同一个块 ID。",
};

export type W13Topic = W13CompositionTopic | W13CoverageTopic | W13FreezeTopic | W13ScanTopic | W13EvalTopic | W13PipelineTopic;
/** 总览排第一：它负责在图上定义术语，其余五块都是它某一段的展开。 */
export const W13_TOPICS: W13Topic[] = [W13_PIPELINE, W13_FREEZE, W13_SCAN, W13_COMPOSITION, W13_EVAL, W13_COVERAGE];
