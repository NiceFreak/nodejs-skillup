#!/usr/bin/env bash
set -euo pipefail

# ===== 阈值常量（集中头部） =====
DISK_REDLINE_GB=4

# ===== 输出字段（动态获取） =====
HOST=$(hostname)
TS=$(date --iso-8601=seconds)
CHECK_NAME="disk"
SUBSYSTEM="disk"

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

# ===== 取数：df -BG / 一行，提取所有字段 =====
df_line=$(df -BG / | tail -1)
if [ -z "$df_line" ]; then
    emit_and_exit "FAIL" "" "Failed to parse df output" 1
fi

device=$(echo "$df_line" | awk '{print $1}')
total=$(echo "$df_line" | awk '{print $2}' | sed 's/G//')
used=$(echo "$df_line" | awk '{print $3}' | sed 's/G//')
avail=$(echo "$df_line" | awk '{print $4}' | sed 's/G//')
use_pct=$(echo "$df_line" | awk '{print $5}' | sed 's/%//')

# 检查 avail 是否为有效数字
if ! [[ "$avail" =~ ^[0-9]+$ ]]; then
    emit_and_exit "FAIL" "" "Available space is not numeric: $avail" 1
fi

# ===== 比较 =====
if [ "$avail" -lt "$DISK_REDLINE_GB" ]; then
    detail="device=$device total=${total}G used=${used}G avail=${avail}G use=${use_pct}% < ${DISK_REDLINE_GB}G threshold"
    action="sudo journalctl --vacuum-size=200M && sudo du -sh /var/log/*"
    emit_and_exit "FAIL" "$action" "$detail" 1
fi

# ===== 全部通过 =====
detail="device=$device total=${total}G used=${used}G avail=${avail}G use=${use_pct}% >= ${DISK_REDLINE_GB}G threshold"
emit_and_exit "OK" "" "$detail" 0
