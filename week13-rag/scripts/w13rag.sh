#!/usr/bin/env bash
# w13rag — W13 serialization implementation 统一 CLI 入口。
#
# 用法：
#   ./scripts/w13rag.sh test              # pytest：fixture 回归 + 真实语料不变式
#   ./scripts/w13rag.sh build             # 构建 registry + Evidence Context + 证据落盘
#   ./scripts/w13rag.sh check             # test + build（旧 run-serialization-check 语义）
#   ./scripts/w13rag.sh verify            # 内存重跑并与 on-disk 产物比对（无 frozen 时提示先冻结）
#   W12_PYTHON=/path/to/venv/python ./scripts/w13rag.sh check   # 覆盖 venv
#
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
    "$PY" -m pytest tests -q -p no:cacheprovider
    ;;
  build)
    PYTHONPATH=src "$PY" -m w13rag.cli build \
      --snapshot-root "$SNAPSHOT" --out-dir "$OUT"
    ;;
  check)
    echo "== [1/2] pytest =="
    "$PY" -m pytest tests -q -p no:cacheprovider
    echo "== [2/2] build evidence =="
    PYTHONPATH=src "$PY" -m w13rag.cli build \
      --snapshot-root "$SNAPSHOT" --out-dir "$OUT"
    ;;
  verify)
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

