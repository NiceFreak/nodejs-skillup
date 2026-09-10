# W13 serialization review 步骤 B 示范：一次完整的「预测 → 实测」

> 建立：2026-09-10（D4）。用途：示范
> [`serialization-implementation-review-worksheet.md`](./serialization-implementation-review-worksheet.md) §3 步骤 B 的完整流程：
> 选点 → 取输入 → 写预测 → 定位实测对象 → 跑实测 → 对比 → 偏差归因 → 收口。
>
> **边界**：本文件是示范。该样本明确排除在 worksheet §3 的 4 个正式样本之外，**不作为 A1–A8
> 的签认依据**；正式签认仍由本人对着 §3 样本完成（worksheet §2 批注区）。
>
> **行号基准**：全部行号取自冻结 snapshot `rules-c0a4b85`（source commit `c0a4b85…`），不是仓库根目录
> 同名文件的现行行号。根目录的 `AGENTS.md`、`LEARNING-PROTOCOL.md`、`TECHNICAL-WRITING-PROTOCOL.md`
> 在 snapshot 冻结后有修订，混用两套行号会得到错误预测。

## 1. 选点

- **样本**：`rules/AGENTS.md` L144-L155 区域中，以 L146 段落 + L148-L152 fenced code 为核心的 block。
- **它验证什么**：A1（ancestor 标题链由外到内，此处有三层）与 A3（段落→fence 只向前合并）。
- **选它的理由**：三层 heading 链 + 前置段落 + 围栏三者同时出现，一次能覆盖两个 A 点；相邻的
  L154-L155 段落可顺带验证「只向前合并、不向后搜索」。
- **先验证输入前提**：该文档快照内只有一对围栏（L148 / L152），配对无歧义。围栏配对是解析前的
  事实假设，先确认可以避免把「配对错」误当成 parser 偏差。

## 2. 取输入（只读，全部对着快照）

```bash
cd week13-rag/corpus/rules-c0a4b85/documents
grep -n '^```' AGENTS.md                       # 围栏行：148, 152（共 2 行，1 对）
grep -n '^#\{1,6\} ' AGENTS.md | sed -n '1,12p' # 标题地图：1 / 117 / 121 / 128 / 144 …
awk 'NR>=144&&NR<=156{printf "L%-3d| %s\n", NR, $0}' AGENTS.md
```

快照原文（与预测直接相关的部分）：

```text
L144| ### 跨层链路讲解
L145|
L146| 讲跨层链路时必须区分：
L147|
L148| ```text
L149| 代码调用顺序：什么时候调用某个方法
L150| 职责归属：这个方法属于 Mongoose、MongoDB、Service 还是 Controller
L151| 返回值来源：返回的是内存对象、数据库读结果，还是库包装后的 document
L152| ```
L153|
L154| 不得为了“简明”把这些压扁。    ← 行尾 2 空格（CommonMark hard break）
L155| 例如 `.save()` 属于 Mongoose 方法，调用后发起并等待 MongoDB 写入；它不是 MongoDB 入库之后才发生的动作。
L156|
```

标题地图（快照）：L1 `# AGENTS.md`、L117 `## 4. 提问与讲解规范`、L121 `### 引导式提问`、
L128 `### 可推导 vs 经验知识`、L144 `### 跨层链路讲解`；硬边界 L115 `---`、下一节 L158 `### 不确定性`。

## 3. 预测（先落盘，写完后才允许运行实测）

预测依据：D3 §6.2.0 #1（组装顺序：heading 由外到内 → table_header → 核心 span；span 逐字拼接）、
#2（行尾空白、块内空行、缩进、围栏逐字、blockquote 行含 `>`）、#3（wrapper 与 `source_id` 行范围一致）；
D2 §6.1「标题层级原则」「Fenced code block 规则」。

| 编号 | 预测对象 | 预测值 | 依据 |
|---|---|---|---|
| P1 | `source_span` | `AGENTS.md#L146-L152`（核心 span 连续，含 L147 空行） | D2「Fenced code block 规则」只向前合并同小节紧邻内容块 |
| P2 | `context_spans` | 3 条，全部 `role=heading`：`(1,1)`、`(117,117)`、`(144,144)`；无 `table_header` | D2「标题层级原则」；同层 H3（L128、L121）应被出栈，不进入 |
| P3 | `model_content` | 9 行，逐行见下表，每行以 LF 结尾 | D3 §6.2.0 #1 顺序（3 个 heading → 核心 span） |
| P4 | 相邻 block（L154-L155） | 独立 block，`source_span = #L154-L155`；`model_content` 为 3 个同一标题链 + L154（行尾保留**恰好 2 个空格**）+ L155，共 5 行 | 只向前合并、不向后搜索；#2 行尾空白规则 |
| P5 | 待验证点 | 见下方 P5 | — |

**P3 逐行预测**（`∣` 仅为排版分隔，不是内容）：

| 行 | 预测内容 | 来源 |
|---|---|---|
| 1 | `# AGENTS.md` | heading (1,1) |
| 2 | `## 4. 提问与讲解规范` | heading (117,117) |
| 3 | `### 跨层链路讲解` | heading (144,144) |
| 4 | 空行 | 核心 `source_span` 的 L147 |
| 5 | ` ```text ` | 核心 L148（围栏逐字保真） |
| 6 | `代码调用顺序：什么时候调用某个方法` | 核心 L149 |
| 7 | `职责归属：这个方法属于 Mongoose、MongoDB、Service 还是 Controller` | 核心 L150 |
| 8 | `返回值来源：返回的是内存对象、数据库读结果，还是库包装后的 document` | 核心 L151 |
| 9 | ` ``` ` | 核心 L152 |

**P5 待验证点（无法只从契约文字唯一确定）**：

- 第 4 行（来自 L147 的空行）是否真的进入 `model_content`。D3 §6.2.0 #2 规定「block 内单空行保留」，
  但同一条也规定「空行间隙是否保留由 parser 选择的 span 行范围决定」。因此这条依赖「parser 把
  段落与围栏合并为一个连续区间」这一实现选择，属于**推断**，不是契约强制，标记为待验证。
- P4 的行尾 2 空格属可推导（#2 明确 ≥2 个空格归一为恰好 2 个），不标待验证。

## 4. 定位实测对象（为什么不能靠猜 `source_id`）

预测给出的是**行范围**；`inspect-block.sh` 需要 `source_id`。两者在预测正确时应当一致，但用预测值
去查等于把答案当输入——预测错时会拿到 `not found` 而无法判断「是没这个 block 还是预测错了行范围」。
正确做法是**先按文件 + 行范围把覆盖该区域的 entry 全部列出来**，再看实测给出的 `source_span`。

```bash
cd week13-rag
python3 - <<'EOF'
import json
E=json.load(open('evidence/serialization/registry-rules-c0a4b85.json',encoding='utf-8'))
for e in E:
    sp=e['source_span']
    if sp['source_path']=='AGENTS.md' and sp['line_end']>=140 and sp['line_start']<=160:
        ctx=[f"{c['role']}:{c['line_start']}-{c['line_end']}" for c in e['context_spans']]
        print(f"{e['source_span']['line_start']:>4}-{e['source_span']['line_end']:<4} {e['source_id']}")
        print(f"      context: {', '.join(ctx)}")
        print(f"      sha: {e['content_sha256'][:16]}…")
EOF
```

## 5. 实测（2026-09-10 执行，原始输出）

实测 A：按「文件 + 行范围」列出覆盖 `AGENTS.md` L140-L160 的 entry（§4 命令）：

```text
 135-141  rules/AGENTS.md#L135-L141
      context: heading:1-1, heading:117-117, heading:128-128
      sha: 905a299a3c702490...
 142-142  rules/AGENTS.md#L142-L142
      context: heading:1-1, heading:117-117, heading:128-128
      sha: c66cbfee4ffd15a0...
 146-152  rules/AGENTS.md#L146-L152
      context: heading:1-1, heading:117-117, heading:144-144
      sha: 5a688915c9bf6746...
 154-155  rules/AGENTS.md#L154-L155
      context: heading:1-1, heading:117-117, heading:144-144
      sha: a6085ee15c211d97...
 159-159  rules/AGENTS.md#L159-L159
      context: heading:1-1, heading:117-117, heading:157-157
      sha: 9b704f98ffac632a...
```

实测 B：`./scripts/inspect-block.sh rules/AGENTS.md#L146-L152`

````text
source_id      : rules/AGENTS.md#L146-L152
source_span    : AGENTS.md#L146-L152
context_spans  : role=heading AGENTS.md#L1-L1
context_spans  : role=heading AGENTS.md#L117-L117
context_spans  : role=heading AGENTS.md#L144-L144
content_sha256 : 5a688915c9bf6746c7b55809005c9b9dbb9723f77f1133a4936836e44952f568
--- model_content ---
# AGENTS.md
## 4. 提问与讲解规范
### 跨层链路讲解
讲跨层链路时必须区分：

```text
代码调用顺序：什么时候调用某个方法
职责归属：这个方法属于 Mongoose、MongoDB、Service 还是 Controller
返回值来源：返回的是内存对象、数据库读结果，还是库包装后的 document
```
````

实测 C：`./scripts/inspect-block.sh rules/AGENTS.md#L154-L155`

```text
source_id      : rules/AGENTS.md#L154-L155
source_span    : AGENTS.md#L154-L155
context_spans  : role=heading AGENTS.md#L1-L1
context_spans  : role=heading AGENTS.md#L117-L117
context_spans  : role=heading AGENTS.md#L144-L144
content_sha256 : a6085ee15c211d97c8cc7f2b44a50803a342ba7cbdc5c71213a3efab7ec438c9
--- model_content ---
# AGENTS.md
## 4. 提问与讲解规范
### 跨层链路讲解
不得为了“简明”把这些压扁。  
例如 `.save()` 属于 Mongoose 方法，调用后发起并等待 MongoDB 写入；它不是 MongoDB 入库之后才发生的动作。
```

实测 D：不可见字节核对（`repr` + 行数）：

```text
== rules/AGENTS.md#L146-L152
  行数(按\n切)= 10  endswith_LF= True
  repr= '# AGENTS.md\n## 4. 提问与讲解规范\n### 跨层链路讲解\n讲跨层链路时必须区分：\n\n```text\n代码调用顺序：什么时候调用某个方法\n职责归属：这个方法属于 Mongoose、MongoDB、Service 还是 Controller\n返回值来源：返回的是内存对象、数据库读结果，还是库包装后的 document\n```\n'
== rules/AGENTS.md#L154-L155
  行数(按\n切)= 5  endswith_LF= True
  repr= '# AGENTS.md\n## 4. 提问与讲解规范\n### 跨层链路讲解\n不得为了“简明”把这些压扁。  \n例如 `.save()` 属于 Mongoose 方法，调用后发起并等待 MongoDB 写入；它不是 MongoDB 入库之后才发生的动作。\n'
```

实测 E：独立手工拼装比对（等同 worksheet §5 步骤 D 的「用 `source_span` 从 snapshot 手工拼一次」）——
把 3 个 heading 行与核心行范围 `L146-L152` / `L154-L155` 按 LF 拼接并施加 #2 的行尾空白规则，
与 registry 的 `model_content` 做字节比较：

```text
== rules/AGENTS.md#L146-L152 手工拼装 == registry: True
== rules/AGENTS.md#L154-L155 手工拼装 == registry: True
```

## 6. 对比与偏差归因

对比结果见 §6.1；偏差按下面五段记录，不写成结论式总结：

```text
原判断
→ 实际现象
→ 关键证据（命令 + 输出的哪一行）
→ 偏差类型：契约理解错 / 语料事实假设错 / 实现与契约不符 / 契约本身未唯一确定
→ 修正与待验证项
```

偏差类型决定后续动作：

| 偏差类型 | 后续动作 |
|---|---|
| 契约理解错 | 重读 D2 §6.1 / D3 §6.2.0 对应条目，修正批注，不记实现问题 |
| 语料事实假设错 | 修正前提（如围栏行数、标题层级），重预测 |
| 实现与契约不符 | **阻断性问题**（worksheet §0），进 §7 收口；先由本人确认语义，再由 AI 改实现并重跑 + 重冻结整串基准 |
| 契约本身未唯一确定 | 记入 worksheet §3 附录「观察点」类开放问题，由本人决定是否调整合并规则 |

### 6.1 对比结果

| 编号 | 预测 | 实测 | 判定 |
|---|---|---|---|
| P1 `source_span` | `AGENTS.md#L146-L152` | `146-152` | 命中 |
| P2 `context_spans` | 3 条 heading：`(1,1)`、`(117,117)`、`(144,144)` | 同 | 命中 |
| P3 `model_content` | 9 行；第 4 行为空行 | **10 行**；第 4 行是 L146 正文，空行在第 5 行 | **偏差** |
| P4 相邻 block | `#L154-L155`；5 行；L154 行尾保留恰好 2 个空格 | 同；`repr` 为 `…把这些压扁。  \n` | 命中 |
| P5 待验证点 | 空行是否进入 `model_content` 属推断 | 空行保留；手工拼装与 registry 逐字节一致 | 推断成立，待验证项关闭 |

**偏差记录（五段）**：

```text
原判断：core span = L146-L152，model_content 共 9 行，第 4 行是空行（L147）。
实际现象：实测为 10 行；第 4 行是 L146 的正文「讲跨层链路时必须区分：」，空行是第 5 行。
关键证据：实测 B 的 model_content 第 4 行；实测 D 的 repr 片段
          '…### 跨层链路讲解\n讲跨层链路时必须区分：\n\n```text\n…'。
偏差类型：契约理解错（不是实现问题）。
修正：核心 span 为连续区间时，model_content 行数 = heading 条数 + (line_end − line_start + 1)。
      本样本 = 3 + 7 = 10。预测时先用该公式算出总行数，再逐行落内容，可避免漏行。
待验证项：无。本样本的组装结果与契约文字一致。
```

**附带观察**（超出 P1-P5 范围，只记录不计分）：实测 A 中 `L135-L141` 与 `L142-L142` 是两个独立
block，heading context 都是 `(1,1)`、`(117,117)`、`(128,128)`。它说明 L144 的 H3 入栈后同级的 L128
被出栈，且这两个相邻 block 的切分点落在顶层列表项之间。这与 A4「按顶层项拆分、嵌套项与续行跟随父项」
一致，作为 A1、A4 的补充证据。

### 6.2 本样本的收口

- 实测支持 A1（三层 heading 链、由外到内、遇到同级标题时旧标题出栈）与 A3（段落与紧邻围栏合并为
  一个连续核心 span；其后的段落不向前合并）。
- 未发现实现与契约不符，因此本样本不产生阻断性问题。
- 排除声明仍然有效：A1–A8 的正式签认以 worksheet §3 的 4 个样本为准，本文件的结论不替代批注。

## 7. 可复用流程（把上面各节压成 8 步）

1. **选点**：在冻结 snapshot 里选一个 block，写明它验证哪个 A 点、以及为什么选它；若它不是 §3 的
   正式样本，显式声明排除。
2. **取输入**：`grep -n '^```'` 确认围栏配对 → `grep -n '^#\{1,6\} '` 取标题地图 → `awk` 打印带行号的
   快照原文。**只读快照，不读仓库根目录同名文件**。
3. **写预测**：落盘 P1（`source_span`）、P2（`context_spans`）、P3（`model_content` 逐行）、
   P4（相邻 block 或反向合并检查）；无法从契约唯一确定的点标 `待验证 + 理由`。**写预测前不跑实测、
   不打开 worksheet 附录**。
4. **定位**：按「文件 + 行范围」列出覆盖该区域的 entry（见 §4 命令），不拿预测值当查询输入。
5. **实测**：`./scripts/inspect-block.sh <source_id>`；需要时补查相邻 block。
6. **对比**：逐项填 `命中 / 偏差`；偏差按 §6 五段记录。
7. **归因与分类**：按 §6 的四种偏差类型决定动作；「实现与契约不符」按阻断性问题处理。
8. **收口**：把该样本的结论回填到 worksheet §2 对应 A 点批注；有阻断项时同步每日笔记与
   `LEARNING-STATE.md`，并等本人确认语义后再改实现。

命令卡：

```bash
cd week13-rag
./scripts/inspect-block.sh rules/AGENTS.md#L146-L152          # 单 entry
./scripts/inspect-block.sh rules/AGENTS.md#L154-L155          # 相邻 block
FROZEN_SHA256=evidence/serialization/frozen-rules-c0a4b85.sha256 ./scripts/w13rag.sh verify
```

## 8. 这个示范能证明什么、不能证明什么

- **能**：示范步骤 B 的操作顺序、预测应写到什么粒度、实测怎么定位、偏差怎么分类归档。
- **不能**：本文件的预测与实测结果都不构成 A1–A8 的签认依据；也不构成对 parser 全语料正确性的证明
  （单个样本只能证明该样本的组装行为）。全语料级结论仍由 worksheet §5 步骤 D 的审计复核和
  `w13rag.sh test` / `verify` 承担。
