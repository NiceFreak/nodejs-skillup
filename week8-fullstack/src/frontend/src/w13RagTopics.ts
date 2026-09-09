// W13 RAG 输入工程的两块（最小可交付集 T5 + T3）。设计契约与形态推导见
// week13-rag/notes/week13-visualization-plan.md §5–§6、裁决见 §14。
//
// 数字一律从 w13RagData.ts 插值：那份文件由 scripts/export-w13-rag-data.mjs 从
// week13-rag 的产物算出，脚本内的恒等式断言保证各分项闭合。这里不出现任何手写的量。
// 事实等级统一为「产物复算」——由脚本从已落盘产物算出的量，不是模型运行结果，
// 也不是本人当场实测；单位是字符（chars），不是 token、不是 bytes。
import type { AeBase } from "./aiEngineerTopics";
import { W13_RAG_DATA } from "./w13RagData";

export const W13_GROUP = "RAG 输入工程（W13）" as const;

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

export type W13Topic = W13CompositionTopic | W13CoverageTopic;
export const W13_TOPICS: W13Topic[] = [W13_COVERAGE, W13_COMPOSITION];
