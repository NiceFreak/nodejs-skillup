# w13rag 包导读（W13 RAG Foundations · serialization 实现）

> 本文档服务 serialization 代码 review：说明 `src/w13rag/` 中六个输入处理模块各自做什么、依赖关系、数据流，
> 并给出 Python → TypeScript 的概念映射，方便从 TS 背景阅读。
> 范围说明（2026-09-11）：D4 已新增 generation/scoring/BM25/dense/hybrid；本文不是当前包的全部模块清单。
> 当前 RAG 实验与框架接线边界见 [`D4 笔记`](../../notes/day4-full-context-baseline-and-bm25.md) §6.19–§6.22。
> **完整链路入口**：[`RAG 代码导读：从来源块到回答与评估`](../../notes/rag-implementation-guide.md)。
> 先看全链路职责、实际 LangChain 调用和当前限制；需要 parser/serialization 细节时再回到本文。
>
> 路径约定：模块短名均指当前目录 `src/w13rag/`；`corpus/`、`notes/`、`tests/`、`scripts/`、
> `evidence/` 均以 `week13-rag/` 为基准。本文命令也统一从 `week13-rag/` 执行。
>
> 契约依据：语料冻结 [`manifest.json`](../../corpus/rules-c0a4b85/manifest.json)（D1）；eval
> `w13-eval-v1`（D2）；serialization 单一规范
> [`day3-freeze-serialization-contract.md`](../../notes/day3-freeze-serialization-contract.md) §6.2.0（D3）；
> source block / registry 语义
> [`day2-freeze-eval-contract.md`](../../notes/day2-freeze-eval-contract.md) §6.1（D2）。判据 #1–#7 逐字见
> [`serialization-criteria-confirm-checklist.md`](../../notes/serialization-criteria-confirm-checklist.md)（已确认）。

## 1. 六个模块一览

| 模块 | 职责 | 主要输入 → 输出 | 被谁依赖 |
|---|---|---|---|
| [`__init__.py`](./__init__.py) | 包标记 + 一句说明 | — | — |
| [`source.py`](./source.py) | 读取快照文档字节，建立行模型 | `snapshotPath` → `SourceDoc` | serialize / parser / registry / cli |
| [`serialize.py`](./serialize.py) | 行规范化、`model_content`、hash、wrapper、Evidence Context 纯函数 | `SourceDoc` + 行号 → `str` / hash | registry / cli |
| [`parser.py`](./parser.py) | 确定性 Markdown 块切分 | `SourceDoc` → `list[BlockInfo]` + `code_lines` | registry / cli |
| [`registry.py`](./registry.py) | 把 `BlockInfo` 变 registry entry；排序、查重、前置条件；拼整串 | `(doc, blocks, code_lines)` → entries / 整串 | cli |
| [`cli.py`](./cli.py) | 命令行入口 `build` / `verify`；逐文档审计；写证据文件 | `snapshot_root` → 证据文件 | （最外层） |

包内直接依赖如下；`A -> B` 表示 A 导入并依赖 B：

```text
__init__.py -> （无包内依赖）
serialize.py -> source.py
parser.py    -> source.py
registry.py  -> parser.py, serialize.py, source.py
cli.py       -> parser.py, registry.py, serialize.py, source.py
```

## 2. 一次 build 的数据流

```text
manifest.json（documents 顺序 = registry 文档顺序）
  + 每份文档 documents/*.md
  → source.read_doc()                      → SourceDoc（lines=每行内容，has_lf=每行后是否有 LF）
  → parser.parse_blocks()                  → [BlockInfo] + code_lines(1-based 集合)
  → registry.entry_from_block()/build_entries()
       entry = {
         source_id,                        // rules/<path>#Lstart-Lend（只标核心行范围）
         source_span,                      // 与 source_id 行范围一致
         context_spans,                    // role ∈ {heading, table_header}
         model_content,                    // = serialize.build_model_content(...)
         content_sha256,                   // = serialize.content_sha256(model_content)
       }
  → registry.evidence_context_string()     // 每个 entry 经 wrapper 包裹后按序拼整串
  → cli.run()：两遍构建比对（byte-identical）+ audit + 写 4 个证据文件
```

关键约定（处处要对得上契约，否则就是 bug）：

- **契约输出的行号全部 1-based，范围含两端**（D2 source identifier）。`SourceDoc.lines` 和 parser 的扫描索引
  使用 0-based；parser 在产出 `BlockInfo` / `code_lines` 时转换为 1-based，`line k = lines[k-1]`。
- **hash 对象 = `model_content` 的 UTF-8 全字节**，不含 wrapper / 组装层 / 运行元数据。
- heading / table_header 只进 `context_spans`，**不扩大 `source_id` 的行范围**。
- `model_content` 字节决定 `content_sha256`；「内容变了 hash 变、位置变了 source_id 变」——身份与指纹分离。

## 3. 模块导读（读码对照）

### `source.py` — 读取与行模型

```python
@dataclass(frozen=True)
class SourceDoc:
    corpus_id: str            # manifest.corpusId，如 "rules"
    source_path: str          # manifest.sourcePath，如 "AGENTS.md"
    snapshot_path: str        # manifest.snapshotPath，如 "documents/AGENTS.md"
    lines: tuple[str, ...]    # 每行内容（0-based 内部；对外行号 1-based）
    has_lf: tuple[bool, ...]  # 每行原文后面是否真有 LF
    # @property line_count  → len(lines)
    # line_text(line_no)    → lines[line_no - 1]  # 注意 -1
```

`read_doc()`：剥 BOM → decode UTF-8 → CRLF/CR 归一到 LF → `split("\n")`；
以 `\n` 结尾时 split 会多一个空串元素，`pop()` 掉；最后一行无 LF 时 `has_lf[-1]=False`。
这个「是否有 LF」信息用于让 hash 精确到字节（D3 判据 #2 的末尾 LF 规则）。

`frozen=True`：实例不可变，保证后续 hash/比对的基础输入不会被意外改动。
这是装饰器，不是继承。

### `serialize.py` — 确定性纯函数（不读文件、不依赖 parser）

| 函数 | 作用 |
|---|---|
| `normalize_plain_line(raw)` | 普通行规范化：单个行尾空格或含 tab 的尾随空白删除；纯空格尾缀 ≥2 时规范为恰 2 个空格（hard break）；行首缩进原样 |
| `build_model_content(doc, *, headings, headers, core_start, core_end, code_lines=(), quote=False)` | 按 外→内标题→表头→核心行 拼一个 block 的模型正文；code/quote 行逐字保真 |
| `content_sha256(model_content)` | `sha256(model_content.encode("utf-8")).hexdigest()` |
| `serialize_source_block(source_id, model_content)` | 精确 wrapper 字节（开标签+LF+正文+`</source>`） |
| `assemble_evidence_context(serialized_blocks)` | 块间恰一个空行连接，首尾无空行；空输入输出空串 |

### `parser.py` — 确定性 Markdown 结构分类与 block 边界

- 正则一行一个块类型：`_MARK_RE`(列表项) / `_HEADING_RE`(标题) / `_HR_RE`(thematic break) /
  `_DELIM_RE`(表格分隔行) / `_ROWLIKE_RE`(表格行)。
- `_code_ranges`/`_code_set`：先扫出 fenced code 配对区间，代码行整段逐字、不参与普通扫描。
- `_indent`/`_heading_level`/`_trim_trailing_blanks`/`_strip_quote`：小工具。
- `_list_island`：列表岛切分，顶层项含嵌套；返回 `(items, stop)`，`stop` 不消费、交回主循环。
- `parse_blocks(doc)`：主函数。维护 `head_stack`（当前小节标题链），逐行分派到
  代码（可并入紧邻前置段）/标题/`---`/`>` 引文/表格/列表/段落。
- `_mini_scan_inner` + `_parse_quote_region`：剥除一层 `>` 后，用内部 scanner 处理段落、顶层列表和 fenced code，
  再映射回原文行号并产出 `quote_*` 类型、`quote=True`（`model_content` 保留原文 `>`）。这里没有递归调用
  `parse_blocks` 或 `_parse_quote_region`；冻结语料也没有嵌套 `>>` 或引文内表格。

### `registry.py` — entry 语义与组装

`WRAPPER_FORBIDDEN = ("<source", "</source>")`：正文不得含字面 `<source`（前缀守卫，不带 `>`，
同时拦截 `<source>` 与 `<source id=…>`）或 `</source>`，违反则构建失败。
`build_entries` 按 manifest 文档顺序 → 文档内 core 行号排序；重复 `source_id` 抛错。

### `cli.py` — 入口 / 审计 / 证据

- `build_once`：manifest 顺序逐文档 `read_doc → parse_blocks`，再 `build_entries` + 整串。
- `audit_document`：算每行是否被 core 覆盖、是否重复；排除结构性行（空行/标题/`---`/表头分隔行）。
- `run`（build 子命令）：`_two_pass` 两遍构建比对 `byte-identical`，写 4 个文件：
  registry JSON / evidence-context txt / .sha256 / criteria-report md。
- `cmd_verify`：内存重建并执行覆盖审计；比较 fresh Evidence Context 与磁盘上的
  `evidence-context-*.txt`，以及可选冻结基准。它不比较 registry JSON、生成的 `.sha256` 文件或
  criteria report；已比较对象不一致时 FAIL 并以非零退出码结束。
- `_line_class_is_structural`：审计里判定结构性行（与 parser 的分类保持一致）。

## 4. 周边文件与验证命令

| 文件 | 作用 |
|---|---|
| [`tests/conftest.py`](../../tests/conftest.py) | 把 `src` 加入 `sys.path`（week13 未安装为包，pytest 靠它 import） |
| [`tests/test_fixture_serialization.py`](../../tests/test_fixture_serialization.py) | fixture A/B/C/D 的 `model_content` / hash / wrapper / 整串字节回归 |
| [`tests/test_registry_real.py`](../../tests/test_registry_real.py) | 真实语料不变式：无遗漏/重复、双跑一致、hash 复算、wrapper 前置条件 |
| [`scripts/w13rag.sh`](../../scripts/w13rag.sh) | CLI：`test` / `build` / `check` / `verify` |
| [`scripts/inspect-block.sh`](../../scripts/inspect-block.sh) | 打印单个 registry entry（review 用） |
| [`evidence/serialization/`](../../evidence/serialization/) | 产物：registry JSON、整串 txt、sha256、criteria-report、`frozen-*.sha256` 冻结基准 |

运行：

```bash
./scripts/w13rag.sh test                          # pytest
./scripts/w13rag.sh build                         # 构建 + 证据落盘
FROZEN_SHA256=evidence/serialization/frozen-rules-c0a4b85.sha256 \
  ./scripts/w13rag.sh verify                      # fresh vs on-disk Evidence Context vs 冻结基准
./scripts/inspect-block.sh rules/AGENTS.md#L47-L58  # 查单个 block
```

`tests` 走 `conftest.py` 调包内函数；`scripts/w13rag.sh` 分别提供测试、构建、冻结基准验证与 guard 入口。
其中 build/verify 调用 `python -m w13rag.cli` 并注入 `PYTHONPATH=src`；它不是 generation runner。

## 5. Python → TypeScript 概念映射

### 5.1 语言/库对照表

| Python | TypeScript | 备注 |
|---|---|---|
| 一个 `.py` 模块 | 一个 ESM 文件 | 依赖方向保持一致 |
| `from .source import SourceDoc` | `import { SourceDoc } from './source.ts'` | — |
| `@dataclass`（生成构造/比较） | `interface`（纯形状）或手写 class | 只读数据用 interface |
| `@dataclass(frozen=True)` | `interface` 全字段 `readonly`；需要运行时约束时使用 `Object.freeze` | `readonly` 只在编译期生效；`Object.freeze` 是浅冻结 |
| `field(default_factory=list)` | 构造时 `this.x = []`；不用模块级共享数组 | Python 可变默认值坑 → TS 是每实例引用 |
| `@property` | class 的 `get x()` | — |
| `tuple[str, ...]` / `tuple[int,int]` | `readonly string[]` / `readonly [number, number]` | tuple 有限长可用元组类型 |
| `list[str]` / `dict` | `string[]` / `interface` 或 `Record<string,…>` | registry entry 应写 interface |
| `set[int]` | `Set<number>` | 只做存在性检查，不依赖顺序 |
| `str.replace/split/startswith` | `string.replace/split/startsWith` | — |
| `re.compile(r"…").match(s)` | `new RegExp("…").exec(s)` 或 `s.match(re)` | `^` 锚点行为一致；注意 g 标志与 lastIndex |
| `pathlib.Path` | `node:path`（join/resolve）+ `node:fs` | `Path / "x"` → `path.join(p, 'x')` |
| `raw.decode("utf-8")` / `.encode()` | `Buffer.from(bytes).toString('utf8')` / `Buffer.from(str,'utf8')` | BOM 剥除同理 |
| `hashlib.sha256(x).hexdigest()` | `crypto.createHash('sha256').update(x, 'utf8').digest('hex')` | 也可显式传 `Buffer.from(x, 'utf8')`；关键是 UTF-8 字节一致 |
| `json.loads / json.dumps` | `JSON.parse / JSON.stringify` | 键序：stringify 按插入序，需固定 |
| `argparse` subparsers | commander/yargs 或手写 `process.argv` | 本项目可用 commander |
| 对外 1-based 行号 | 无内建支持，靠命名与注释约定 | 数组/扫描索引仍为 0-based；在 parser 输出边界转换 |
| `int \| None` | `number \| null` | — |

### 5.2 各模块的 TS 关键形状（签名级示意，非完整实现）

```ts
// source.ts
export interface SourceDoc {
  readonly corpusId: string;
  readonly sourcePath: string;
  readonly snapshotPath: string;
  readonly lines: readonly string[];      // 0-based internal；public 行号 1-based
  readonly hasLf: readonly boolean[];     // lines[i] 后是否带 LF
  readonly lineCount: number;             // getter
  lineText(lineNo: number): string;       // lines[lineNo - 1]
}
export function readDoc(snapshotRoot: string, corpusId: string,
                        sourcePath: string, snapshotPath: string): SourceDoc;
```

```ts
// serialize.ts
export function normalizePlainLine(raw: string): string;
export interface BuildContentOptions {
  headings: readonly number[];
  headers: readonly number[];
  coreStart: number;             // 1-based inclusive
  coreEnd: number;
  codeLines?: ReadonlySet<number>;
  quote?: boolean;
}
export function buildModelContent(doc: SourceDoc, o: BuildContentOptions): string;
export function contentSha256(modelContent: string): string;   // crypto sha256 hex
export function serializeSourceBlock(sourceId: string, modelContent: string): string;
export function assembleEvidenceContext(serializedBlocks: readonly string[]): string;
```

```ts
// parser.ts
export type BlockKind =
  | 'paragraph' | 'list_item' | 'code' | 'table_row'
  | 'quote_para' | 'quote_list' | 'quote_code';
export interface BlockInfo {
  kind: BlockKind;
  coreStart: number;  coreEnd: number;        // 1-based inclusive
  headings: number[];                          // outer -> inner
  headers: number[];
  codeSpans: Array<readonly [number, number]>;
  quote: boolean;
}
export function parseBlocks(doc: SourceDoc): { blocks: BlockInfo[]; codeLines: Set<number> };
// 逐条迁移并用相同 fixture 验证：_MARK_RE / _HEADING_RE / _HR_RE / _DELIM_RE / _ROWLIKE_RE
```

```ts
// registry.ts
export type ContextRole = 'heading' | 'table_header';
export interface ContextSpan { sourcePath: string; lineStart: number; lineEnd: number; role: ContextRole; }
export interface RegistryEntry {
  sourceId: string;                            // rules/<path>#Lstart-Lend
  sourceSpan: { sourcePath: string; lineStart: number; lineEnd: number };
  contextSpans: ContextSpan[];
  modelContent: string;
  contentSha256: string;
}
export const WRAPPER_FORBIDDEN = ['<source', '</source>'] as const;
export function buildEntries(
  docsBlocks: Array<[SourceDoc, BlockInfo[], Set<number>]>
): RegistryEntry[];
export function evidenceContextString(entries: RegistryEntry[]): string;
```

```ts
// cli.ts（示意）
export function buildOnce(snapshotRoot: string):
  { docsBlocks: Array<[SourceDoc, BlockInfo[], Set<number>]>; entries: RegistryEntry[];
    context: string; audits: Record<string, Audit>; };
export function runBuild(snapshotRoot: string, outDir: string): Summary;   // 两遍比对 + 写文件
export function verify(snapshotRoot: string, outDir: string,
                       frozenSha256?: string): void;                        // 不一致 process.exit(1)
```

### 5.3 翻译到 TS 时要额外小心的事

1. **确定性 / 键序**：当前 `content_sha256` 只计算 `model_content` 的 UTF-8 字节，不计算 registry JSON。
   TS 迁移时不要改成对整个 entry 做 `JSON.stringify` 后计算内容 hash；若要逐字节比较 registry JSON，需另行
   固定字段构造和序列化格式。
2. **正则语义**：Python `re.match` 从头匹配、无 `g` 状态；JS `RegExp.exec` 若带 `g` 会共享
   `lastIndex`，容易出隐式 bug——用无 `g` 正则或每次新建。
3. **1-based 行号**：TS 数组和 parser 扫描索引保持 0-based；在构造 `BlockInfo` 与 `codeLines` 的输出边界统一
   转换为 1-based。registry 只接收 1-based span，不再二次换算。
4. **不可变**：`readonly` 只提供编译期约束，`Object.freeze` 只做浅冻结。若需要匹配 `SourceDoc` 中 tuple 的
   运行时不可变性，还要冻结或复制嵌套数组；也可以明确采用只读约定并用测试守住输入不被修改。
5. **Buffer vs string**：hash 前必须保证 utf-8 字节一致（Python `str.encode('utf-8')` ↔
   TS `Buffer.from(str, 'utf8')`），换行统一 LF 后再算。
