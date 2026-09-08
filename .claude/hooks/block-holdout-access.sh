#!/usr/bin/env bash
# 阻断任何 Bash 命令读取 W13 冻结的 holdout 评测集。
#
# 背景：week13-rag/eval/holdout/items.json 内含 holdout query 及其
# expected_rule_conclusion。eval/scoring-contract.md 的冻结条款把
# 「dev 常规运行读取了 holdout items」判为运行无效，且污染不可逆。
# 权限规则的 Bash 匹配是命令前缀匹配，挡不住 cat / head / grep / sed
# 等任意写法，因此用本 hook 按路径字符串拦截。
#
# 放行 git 的整目录操作（add / commit / status 等不读取文件内容）。
set -uo pipefail

cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null)"

if [[ -z "$cmd" ]]; then
  exit 0
fi

# 命令里出现 holdout 路径即拦截；git 子命令除外。
if [[ "$cmd" == *"eval/holdout"* || "$cmd" == *"eval\\holdout"* ]]; then
  if [[ "$cmd" =~ ^[[:space:]]*git[[:space:]] ]]; then
    exit 0
  fi
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "week13-rag/eval/holdout/ 是 W13 冻结的 holdout 评测集，含题目与标准答案。读取它会把内容带入模型上下文，触发 eval/scoring-contract.md 的运行无效条款，且不可逆。需要确认结构时用不输出内容的方式（例如 grep -c 只取计数）。首次运行 holdout 由本人在满足门禁后手动执行。"
  }
}
JSON
  exit 0
fi

exit 0
