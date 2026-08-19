#!/usr/bin/env bash
set -euo pipefail

# ===== 阈值常量（集中头部） =====
# 15 天的秒数
CERT_REDLINE_SECONDS=$((15 * 24 * 3600))

# ===== 证书路径（环境变量覆盖） =====
# 若 CERT_OVERRIDE 非空则使用它，否则使用正式路径
if [ -n "${CERT_OVERRIDE:-}" ]; then
    CRT_PATH="$CERT_OVERRIDE"
else
    CRT_PATH="/etc/letsencrypt/live/43-128-154-242.sslip.io/fullchain.pem"
fi

# ===== 输出字段（动态获取） =====
HOST=$(hostname)
TS=$(date --iso-8601=seconds)
CHECK_NAME="cert"
SUBSYSTEM="cert"

# ===== 辅助函数：输出 NDJSON 并退出 =====
emit_and_exit() {
    local status="$1"
    local action="$2"
    local detail="$3"
    local rc="$4"

    detail="${detail//\\/\\\\}"
    detail="${detail//\"/\\\"}"
    action="${action//\\/\\\\}"
    action="${action//\"/\\\"}"

    printf '{"check":"%s","subsystem":"%s","status":"%s","ts":"%s","host":"%s","action":"%s","detail":"%s"}\n' \
        "$CHECK_NAME" "$SUBSYSTEM" "$status" "$TS" "$HOST" "$action" "$detail"
    exit "$rc"
}

# ===== 检查证书文件是否存在 =====
if [ ! -f "$CRT_PATH" ]; then
    detail="Certificate file not found: $CRT_PATH"
    action="sudo certbot renew"
    emit_and_exit "FAIL" "$action" "$detail" 1
fi

# ===== 判据：使用 -checkend 检查剩余天数 =====
# 若剩余 < 15 天，openssl 退出码非 0；否则 0
if ! openssl x509 -in "$CRT_PATH" -noout -checkend "$CERT_REDLINE_SECONDS"; then
    detail="Certificate expires in less than 15 days (checkend failed)"
    action="sudo certbot renew"
    emit_and_exit "FAIL" "$action" "$detail" 1
fi

# ===== 全部通过 =====
detail="Certificate valid for more than 15 days (checkend OK)"
emit_and_exit "OK" "" "$detail" 0
