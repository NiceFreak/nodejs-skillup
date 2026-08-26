#!/usr/bin/env bash
# bootstrap-trigger-branch.sh
# 用 week11-ci/ops/showcase-deploy/ 的种子内容创建孤儿分支 ops/showcase-deploy。
# 在开发机上执行一次即可；手机侧 skill 不创建分支（少一份权限）。
#
# 为什么是孤儿分支：触发分支只承载信号与回执，不该携带任何源码历史。
# 这样 Jenkins 对它做克隆时代价最小，也让「本分支不含可执行内容」一眼可查。
#
# 实现方式：在临时目录 `git init` 一个全新仓库（天然无历史 = 天然孤儿），
# 只把远端地址指过来推分支。**全程不碰主工作区。**
#
# 第一版曾在主工作区做 `git checkout --orphan` + 清空目录，那是错的：
# 清空会连 gitignored 文件一起删（`week2-express/src/.env`、各处 node_modules、
# dist-showcase），而事后 checkout 回原分支只恢复被跟踪的文件，.env 找不回来。
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

ORIGIN="$(git -C "$REPO_ROOT" remote get-url origin)"
[ -n "$ORIGIN" ] || { echo "取不到 origin 地址"; exit 1; }

if git -C "$REPO_ROOT" ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "远端已存在 $BRANCH —— 本脚本只负责首次创建，不覆盖。"
  echo "确需重建：先人工确认 receipts/ 不再需要，再手工删除远端分支。"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git init -q -b "$BRANCH" "$TMP/trigger"
cp -R "$SEED"/. "$TMP/trigger"/
mkdir -p "$TMP/trigger/receipts"
touch "$TMP/trigger/receipts/.gitkeep"

git -C "$TMP/trigger" add -A
git -C "$TMP/trigger" commit -q -m "chore(ops): 建立展板部署触发分支（信号 + 回执，不含源码）"
git -C "$TMP/trigger" remote add origin "$ORIGIN"

echo "临时仓库已就绪（主工作区未被触碰），分支 $BRANCH 内容："
git -C "$TMP/trigger" ls-files | sed 's/^/  /'
echo "  提交数：$(git -C "$TMP/trigger" rev-list --count HEAD)（应为 1，且无源码历史）"
echo

if [ "$PUSH" -eq 1 ]; then
  git -C "$TMP/trigger" push -u origin "$BRANCH"
  echo "已推送 $BRANCH"
else
  echo "演练模式：未推送。确认无误后加 --push 重跑。"
  echo "（连通性自检：git push --dry-run）"
  git -C "$TMP/trigger" push --dry-run origin "$BRANCH" 2>&1 | sed 's/^/  /'
fi
