#!/usr/bin/env bash
# deploy-showcase-8081.sh
# 学习展板（8081）发布：本地构建 → 内容断言 → 产物校验 → scp → 服务器落盘 → 线上验证。
# 边界（Q7 不动清单）：不碰 Nginx 配置/reload、证书、.env、dist-admin443、流水线。
# 落盘走服务器侧固定脚本 showcase-land（无参数、路径写死），sudoers 白名单只放行这一条。
#
# 用法：
#   ./deploy-showcase-8081.sh            # 构建 + 校验 + 发布（回车默认发布，输入 n 取消）
#   ./deploy-showcase-8081.sh --no-deploy  # 只构建 + 校验，不发布
#   ./deploy-showcase-8081.sh --yes      # 跳过交互确认（本人运行即视为授权发布）
#
# 环境变量：
#   SHOWCASE_SSH_TARGET  SSH 目标（默认 vps-skillup）
#   SHOWCASE_SSH_OPTS    额外 SSH 参数（如 "-i /path/to/key"），默认空

set -euo pipefail

SSH_TARGET="${SHOWCASE_SSH_TARGET:-vps-skillup}"
# 可选的额外 SSH 参数：Jenkins 侧用 `-i <jenkins-deploy-key>` 走独立凭据，
# 本人手跑时为空 → 仍走 ~/.ssh/config 的 vps-skillup 别名，行为与之前完全一致。
# 注意（macOS bash 3.2）：`set -u` 下展开空数组会报 unbound variable，
# 必须用 ${arr[@]+"${arr[@]}"} 形式，不能直接写 "${arr[@]}"。
SHOWCASE_SSH_OPTS="${SHOWCASE_SSH_OPTS:-}"
read -r -a SSH_OPTS <<< "$SHOWCASE_SSH_OPTS"
ssh_() { ssh ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$@"; }
scp_() { scp ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$@"; }
FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/src/frontend"
DIST_DIR="$FRONTEND_DIR/dist-showcase"
REMOTE_SRC="/tmp/showcase-deploy"
SERVER_BASE="http://43.128.154.242:8081"
NO_DEPLOY=0
YES=0

usage() {
  echo "用法: $0 [--no-deploy] [--yes]"
  echo "  --no-deploy  只做本地构建与校验，不发布"
  echo "  --yes        跳过发布前确认（本人运行即视为授权发布）"
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --no-deploy) NO_DEPLOY=1 ;;
    --yes) YES=1 ;;
    -h|--help) usage ;;
    *) echo "未知参数: $arg"; usage ;;
  esac
done

# ---------- 1. 前置检查 ----------
[ -f "$FRONTEND_DIR/.yarn/releases/yarn-3.2.0.cjs" ] || { echo "vendored yarn 缺失：$FRONTEND_DIR"; exit 1; }

if [ "$NO_DEPLOY" -eq 0 ]; then
  ssh_ -o BatchMode=yes "$SSH_TARGET" true || { echo "SSH 不可达 ${SSH_TARGET}（检查 ~/.ssh/config 的 vps-skillup）"; exit 1; }
  ssh_ "$SSH_TARGET" "ls -l /usr/local/bin/showcase-land" >/dev/null 2>&1 \
    || { echo "服务器落盘通道 showcase-land 未就绪：先执行变更单（新建脚本 + sudoers 一条）"; exit 1; }
fi

# ---------- 2. 构建 showcase（8081 用空 base） ----------
echo "==> yarn build:showcase"
(cd "$FRONTEND_DIR" && node .yarn/releases/yarn-3.2.0.cjs build:showcase)

# ---------- 3. 展板内容断言 ----------
echo "==> verify:board"
(cd "$FRONTEND_DIR" && node .yarn/releases/yarn-3.2.0.cjs verify:board)

# ---------- 4. 产物校验 ----------
echo "==> 产物校验"
[ -f "$DIST_DIR/index.html" ] || { echo "缺少 index.html"; exit 1; }
[ -f "$DIST_DIR/showcase.html" ] || { echo "缺少 showcase.html"; exit 1; }
[ -d "$DIST_DIR/assets" ] && [ -n "$(ls -A "$DIST_DIR/assets")" ] || { echo "assets 为空"; exit 1; }
grep -q 'Node.js Skillup · 学习展板' "$DIST_DIR/index.html" || { echo "index.html 标题不是展板产物（构建环境变量/入口不对）"; exit 1; }
# 8081 用空 base，vite 输出相对形态 ./assets/；若混入 Pages base 则出现 /skillup-week8/
grep -qF '"./assets/' "$DIST_DIR/index.html" || { echo "asset 路径非相对 ./assets/（base 异常）"; exit 1; }
if grep -q '/skillup-week8/' "$DIST_DIR/index.html"; then
  echo "index.html 混入 Pages base /skillup-week8/，8081 产物必须空 base"; exit 1
fi

if [ "$NO_DEPLOY" -eq 1 ]; then
  echo "==> --no-deploy：停在本地，未发布。"
  exit 0
fi

# ---------- 5. 发布授权确认（回车默认发布，输入 n 取消） ----------
if [ "$YES" -eq 0 ]; then
  read -r -p "确认发布到服务器 8081？（Y/n）" ans
  case "$ans" in n|N|no) echo "已取消"; exit 1 ;; *) ;; esac
fi

# ---------- 6. 传输到服务器 /tmp ----------
echo "==> scp → $SSH_TARGET:$REMOTE_SRC/"
ssh_ "$SSH_TARGET" "rm -rf $REMOTE_SRC && mkdir -p $REMOTE_SRC"
scp_ -r -q "$DIST_DIR"/. "$SSH_TARGET:$REMOTE_SRC/"

# ---------- 7. 服务器落盘（showcase-land：无参数、路径写死） ----------
echo "==> sudo -n -u nodeapp /usr/local/bin/showcase-land"
ssh_ "$SSH_TARGET" "sudo -n -u nodeapp /usr/local/bin/showcase-land"

# ---------- 8. 线上验证 ----------
echo "==> 线上验证"
if ! code=$(curl -s -o /dev/null -w '%{http_code}' "$SERVER_BASE/"); then
  echo "8081 / 请求失败"; exit 1
fi
[ "$code" = "200" ] || { echo "8081 / 预期 200 实际 $code"; exit 1; }
echo "8081 / = $code"

local_assets=$(grep -hoE '/assets/[^"]+' "$DIST_DIR/index.html" | sort || true)
remote_assets=$(curl -fsS "$SERVER_BASE/" | grep -hoE '/assets/[^"]+' | sort || true)
[ "$local_assets" = "$remote_assets" ] || {
  echo "asset 不一致"
  echo "本地:"; echo "$local_assets"
  echo "线上:"; echo "$remote_assets"
  exit 1
}
echo "asset 一致（$(echo "$local_assets" | wc -l | tr -d ' ') 个）"

auth_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SERVER_BASE/auth/login")
[ "$auth_code" = "400" ] || { echo "POST /auth 预期 400 实际 ${auth_code}（门禁反代损坏）"; exit 1; }
echo "POST /auth = ${auth_code}（门禁反代通）"

# ---------- 9. 清理服务器暂存 ----------
ssh_ "$SSH_TARGET" "rm -rf $REMOTE_SRC"
echo "==> 发布完成：$SERVER_BASE"
