#!/usr/bin/env bash
# inspect-block — 打印单个 citation registry entry 的 source_span / context_spans / model_content。
#
# 用法：
#   ./scripts/inspect-block.sh rules/AGENTS.md#L47-L58
#   ./scripts/inspect-block.sh rules/AGENTS.md#L47-L58 path/to/registry.json   # 指定 registry
#   W12_PYTHON=/path/to/venv/python ./scripts/inspect-block.sh ...              # 覆盖 venv
#
# 供 W13 L1 review 步骤 B「预测 → 实测」使用；不修改任何文件。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${W12_PYTHON:-$ROOT/../week12-python-rag/.venv/bin/python}"
SID="${1:-}"
REG="${2:-$ROOT/evidence/serialization/registry-rules-c0a4b85.json}"

if [[ -z "$SID" ]]; then
  echo "usage: $0 <source_id> [registry.json]" >&2
  echo "example: $0 rules/AGENTS.md#L47-L58" >&2
  exit 1
fi
if [[ ! -f "$REG" ]]; then
  echo "ERROR: registry not found: $REG" >&2
  exit 1
fi

"$PY" - "$SID" "$REG" <<'EOF'
import json
import sys

sid, reg_path = sys.argv[1], sys.argv[2]
entries = json.load(open(reg_path, encoding="utf-8"))
matches = [e for e in entries if e["source_id"] == sid]
if not matches:
    print(f"not found: {sid}")
    sys.exit(1)
e = matches[0]
print("source_id      :", e["source_id"])
sp = e["source_span"]
print("source_span    :",
      f'{sp["source_path"]}#L{sp["line_start"]}-L{sp["line_end"]}')
for c in e["context_spans"]:
    print(f"context_spans  : role={c['role']} "
          f"{c['source_path']}#L{c['line_start']}-L{c['line_end']}")
print("content_sha256 :", e["content_sha256"])
print("--- model_content ---")
print(e["model_content"])
EOF
