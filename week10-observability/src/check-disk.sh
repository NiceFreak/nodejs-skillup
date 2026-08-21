#!/usr/bin/env bash
set -euo pipefail

# ===== 阈值常量（集中头部） =====
# 4 GiB = 4*1024^3；2026-08-21 W10 D5 #11：从 df -BG 取整改字节级比较，
# 封堵 avail∈[3.5,4.0)GiB 时 df -BG 四舍五入显示 4G、判据 >=4 静默绿的盲区。
DISK_REDLINE_BYTES=$((4 * 1024 * 1024 * 1024))

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

# ===== 取数：df -B1 / 一行（字节级，封堵 -BG 四舍五入盲区），提取所有字段 =====
df_line=$(df -B1 / | tail -1)
if [ -z "$df_line" ]; then
    emit_and_exit "FAIL" "" "Failed to parse df output" 1
fi

device=$(echo "$df_line" | awk '{print $1}')
total_bytes=$(echo "$df_line" | awk '{print $2}')
used_bytes=$(echo "$df_line" | awk '{print $3}')
avail_bytes=$(echo "$df_line" | awk '{print $4}')
use_pct=$(echo "$df_line" | awk '{print $5}' | sed 's/%//')

# 检查 avail_bytes 是否为有效数字
if ! [[ "$avail_bytes" =~ ^[0-9]+$ ]]; then
    emit_and_exit "FAIL" "" "Available space is not numeric: $avail_bytes" 1
fi

# ===== GiB 近似值（供人类快速读，1 位小数；整数除法会把 30.3G 显示成 30G） =====
avail_gib=$(awk -v b="$avail_bytes" 'BEGIN { printf "%.1f", b / 1073741824 }')

# ===== 比较（字节级：avail_bytes < 4 GiB 即 FAIL） =====
if [ "$avail_bytes" -lt "$DISK_REDLINE_BYTES" ]; then
    detail="device=$device total_bytes=${total_bytes} used_bytes=${used_bytes} avail_bytes=${avail_bytes} avail_g=${avail_gib}G use=${use_pct}% < ${DISK_REDLINE_BYTES} bytes threshold"
    action="sudo journalctl --vacuum-size=200M && sudo du -sh /var/log/*"
    emit_and_exit "FAIL" "$action" "$detail" 1
fi

# ===== 全部通过 =====
detail="device=$device total_bytes=${total_bytes} used_bytes=${used_bytes} avail_bytes=${avail_bytes} avail_g=${avail_gib}G use=${use_pct}% >= ${DISK_REDLINE_BYTES} bytes threshold"
emit_and_exit "OK" "" "$detail" 0