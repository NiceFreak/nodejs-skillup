#!/usr/bin/env bash
# w13rag — W13 serialization implementation 统一 CLI 入口。
#
# 用法：
#   ./scripts/w13rag.sh test    # pytest：fixture 回归 + 真实语料不变式
#   ./scripts/w13rag.sh build   # 构建 registry + Evidence Context + 证据落盘
#   ./scripts/w13rag.sh check   # test + build（一键全量）
#   ./scripts/w13rag.sh verify  # 内存重跑，与 on-disk 产物比对（可选 FROZEN_SHA256 对照冻结基准）
#   W12_PYTHON=/path/to/venv/python ./scripts/w13rag.sh check   # 覆盖 venv
#
# ---------------------------------------------------------------------------
# 输出解读（build/check 的 === serialization evidence build === 段）：
#   snapshot / corpus
#       本次读取的冻结语料身份（manifest 的 snapshotId / corpusId）。产物绑定哪份语料看这两项。
#   blocks: N
#       N = 全部文档经确定性 parser 切出的 source block 总数（= citation registry entries 数）。
#   rerun: byte-identical=True
#       进程内把「读取→解析→组装」独立执行两遍，两遍 Evidence Context 整串逐字节一致。
#       这是判据 #6 的确定性证据；若为 False，说明存在非确定性，不能作为 baseline/retrieval 输入。
#   context: chars=... sha256=...
#       全语料 Evidence Context 整串的字符数与 sha256。整串会大于语料原始字节（wrapper、重复标题/表头）；
#       sha256 是未来要冻结的 regression 基准锚点（判据确认后才正式冻结）。
#   uncovered: none
#       覆盖审计通过：没有「非空、非结构性正文行」落在任何 block core 之外，即没有静默丢规则。
#   duplicate: none
#       没有一行同时属于两个 block core；registry 也没有重复 source_id。
#   wrote registry / evidence_context / sha256 / report
#       四个落盘证据文件：registry JSON（entries）、Evidence Context 整串 txt、整串 sha256 记录、
#       per-document 审计 + block 分类报告。
#   —— 全绿只证明确定性组装层正确，不证明模型行为或端到端质量。
#
# verify 段输出解读（=== serialization verify ===）：
#   fresh : blocks=... sha256=...
#       用当前代码 + 磁盘 snapshot 重新计算的内存结果。
#   on-disk : sha256=... matches fresh=True
#       现存 evidence-context-*.txt 与新鲜构建一致 = 磁盘产物由当前代码生成，无陈旧残留。
#       False 会让 verify 以非零退出码 FAIL。
#   frozen : sha256=... matches fresh=...
#       仅当传入 FROZEN_SHA256 时出现；与冻结基准比对，漂移即 FAIL（这是回归检查的真正形态）。
# ---------------------------------------------------------------------------
# 只读 corpus/rules-c0a4b85；不碰 eval/holdout，不调用模型。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${W12_PYTHON:-$ROOT/../week12-python-rag/.venv/bin/python}"
SNAPSHOT="$ROOT/corpus/rules-c0a4b85"
OUT="$ROOT/evidence/serialization"

if [[ ! -x "$PY" ]]; then
  echo "ERROR: venv python not found: $PY" >&2
  echo "Set W12_PYTHON to the Python 3.12 venv under week12-python-rag." >&2
  exit 1
fi

cd "$ROOT"

cmd="${1:-help}"
case "$cmd" in
  test)
    # 9 条测试 = 5 条 fixture 字节/hash 回归 + 4 条真实语料不变式。
    # 通过 = 确定性组装层符合契约；与「模型回答质量」无关。
    "$PY" -m pytest tests -q -p no:cacheprovider
    ;;
  build)
    # 指标（blocks/rerun/context sha/uncovered/duplicate/wrote ...）含义见文件头「输出解读」。
    PYTHONPATH=src "$PY" -m w13rag.cli build \
      --snapshot-root "$SNAPSHOT" --out-dir "$OUT"
    ;;
  check)
    # = test + build 一键全量；输出无新增信息，只是顺序执行两段。
    echo "== [1/2] pytest =="
    "$PY" -m pytest tests -q -p no:cacheprovider
    echo "== [2/2] build evidence =="
    PYTHONPATH=src "$PY" -m w13rag.cli build \
      --snapshot-root "$SNAPSHOT" --out-dir "$OUT"
    ;;
  verify)
    # fresh=当前重算；on-disk=上次 build 的 txt；frozen=冻结基准（可选）。
    # 三者一致输出 OK；任一不一致会打印 FAIL 并以非零退出码结束。
    PYTHONPATH=src "$PY" -m w13rag.cli verify \
      --snapshot-root "$SNAPSHOT" --out-dir "$OUT" \
      ${FROZEN_SHA256:+--frozen-sha256 "$FROZEN_SHA256"}
    ;;
  help|*)
    echo "usage: ./scripts/w13rag.sh {test|build|check|verify}" >&2
    echo "  W12_PYTHON   venv python override" >&2
    echo "  FROZEN_SHA256  frozen baseline file for verify (optional)" >&2
    exit 0
    ;;
esac


