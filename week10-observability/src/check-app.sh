#!/usr/bin/env bash
set -euo pipefail

# ===== 阈值常量（集中头部，便于弄红时修改） =====
HEALTH_URL="http://127.0.0.1:3000/health"
# 三服务名称（按检查顺序）
SERVICES=("nginx" "nodeapp" "mongod")

# ===== 输出字段（动态获取） =====
HOST=$(hostname)
TS=$(date --iso-8601=seconds)
CHECK_NAME="app"

# ===== 辅助函数：输出 NDJSON 并退出 =====
emit_and_exit() {
    local status="$1"          # OK 或 FAIL
    local subsystem="$2"       # nginx / nodeapp / mongod / health / 空（绿时填 app）
    local action="$3"
    local detail="$4"
    local rc="$5"              # 0 或 1

    # 转义双引号和反斜杠，防止 JSON 注入（仅对 detail/action 做简单转义）
    detail="${detail//\\/\\\\}"
    detail="${detail//\"/\\\"}"
    action="${action//\\/\\\\}"
    action="${action//\"/\\\"}"

    printf '{"check":"%s","subsystem":"%s","status":"%s","ts":"%s","host":"%s","action":"%s","detail":"%s"}\n' \
        "$CHECK_NAME" "$subsystem" "$status" "$TS" "$HOST" "$action" "$detail"
    exit "$rc"
}

# ===== 第一层：三服务 active 检查（顺序短路） =====
for svc in "${SERVICES[@]}"; do
    if ! systemctl is-active --quiet "$svc"; then
        detail="$svc service is not active"
        action="sudo systemctl restart $svc && sudo systemctl status $svc"
        emit_and_exit "FAIL" "$svc" "$action" "$detail" 1
    fi
done

# ===== 第二层：/health 端点检查 =====
# 改动点：增加 --max-time 5，防止 curl 挂起导致 systemd service 卡死
if ! curl -f -s -o /dev/null --max-time 5 "$HEALTH_URL"; then
    detail="Health endpoint $HEALTH_URL returned non-200, unreachable, or timed out"
    action="curl -v \"$HEALTH_URL\" && sudo journalctl -u nodeapp -n 50 --no-pager"
    emit_and_exit "FAIL" "health" "$action" "$detail" 1
fi

# ===== 全部通过 =====
detail="All services active and health endpoint OK"
emit_and_exit "OK" "app" "" "$detail" 0
