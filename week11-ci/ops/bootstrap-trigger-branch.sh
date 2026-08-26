#!/usr/bin/env bash
# bootstrap-trigger-branch.sh
# 用 week11-ci/ops/showcase-deploy/ 的种子内容创建孤儿分支 ops/showcase-deploy。
# 在开发机上执行一次即可；手机侧 skill 不创建分支（少一份权限）。
#
# 为什么是孤儿分支：触发分支只承载信号与回执，不该携带任何源码历史。
# 这样 Jenkins 对它做浅克隆时代价最小，也让「本分支不含可执行内容」一眼可查。
#
# 用法：
#   bash week11-ci/ops/bootstrap-trigger-branch.sh            # 演练，不推
#   bash week11-ci/ops/bootstrap-trigger-branch.sh --push     # 创建并推送

set -euo pipefail

BRANCH="ops/showcase-deploy"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SEED="$REPO_ROOT/week11-ci/ops/showcase-deploy"
PUSH=0
[ "${1:-}" = "--push" ] && PUSH=1

[ -d "$SEED" ] || { echo "种子目录缺失：$SEED"; exit 1; }

cd "$REPO_ROOT"
[ -z "$(git status --porcelain)" ] || { echo "工作区不干净，先提交或 stash 再跑"; exit 1; }

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "远端已存在 $BRANCH —— 本脚本只负责首次创建，不覆盖。"
  echo "确需重建：先人工确认 receipts/ 不再需要，再手工删除远端分支。"
  exit 1
fi

ORIG_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
TMP="$(mktemp -d)"
cp -R "$SEED"/. "$TMP"/
cleanup() { rm -rf "$TMP"; git checkout "$ORIG_BRANCH" >/dev/null 2>&1 || true; }
trap cleanup EXIT

git checkout --orphan "$BRANCH"
git rm -rq --cached . || true
# 清空工作区（保留 .git），再铺种子
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$TMP"/. .
mkdir -p receipts && touch receipts/.gitkeep

git add -A
git commit -m "chore(ops): 建立展板部署触发分支（信号 + 回执，不含源码）"

echo
echo "已在本地建好 $BRANCH，内容："
git ls-files
echo

if [ "$PUSH" -eq 1 ]; then
  git push -u origin "$BRANCH"
  echo "已推送 $BRANCH"
else
  echo "演练模式：未推送。确认无误后加 --push 重跑（或直接 git push -u origin $BRANCH）。"
fi
