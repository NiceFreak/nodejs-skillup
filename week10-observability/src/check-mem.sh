#!/usr/bin/env bash
set -euo pipefail

# ===== 阈值常量（集中头部） =====
MEM_REDLINE_MB=200

# ===== 输出字段（动态获取） =====
HOST=$(hostname)
TS=$(date --iso-8601=seconds)
CHECK_NAME="mem"
SUBSYSTEM="memory"   # 此项只有一个判据，固定为 memory

# ===== 辅助函数：输出 NDJSON 并退出 =====
emit_and_exit() {
    local status="$1"          # OK 或 FAIL
    local action="$2"
    local detail="$3"
    local rc="$4"              # 0 或 1

    # 转义双引号和反斜杠，防止 JSON 注入（仅对 detail/action 做简单转义）
    detail="${detail//\\/\\\\}"
    detail="${detail//\"/\\\"}"
    action="${action//\\/\\\\}"
    action="${action//\"/\\\"}"

    printf '{"check":"%s","subsystem":"%s","status":"%s","ts":"%s","host":"%s","action":"%s","detail":"%s"}\n' \
        "$CHECK_NAME" "$SUBSYSTEM" "$status" "$TS" "$HOST" "$action" "$detail"
    exit "$rc"
}

# ===== 取数：available 内存（MB） =====
available_mb=$(free -m | awk '/^Mem:/ {print $7}')
if ! [[ "$available_mb" =~ ^[0-9]+$ ]]; then
    # 如果取数失败，视为 FAIL（无法监控）
    emit_and_exit "FAIL" "" "Failed to parse available memory" 1
fi

# ===== 比较 =====
if [ "$available_mb" -lt "$MEM_REDLINE_MB" ]; then
    detail="Available memory ${available_mb}MB < ${MEM_REDLINE_MB}MB threshold"
    # 诊断命令：查看内存总体情况和 top 占用
    action="sudo free -m && sudo ps aux --sort=-%mem | head -20"
    emit_and_exit "FAIL" "$action" "$detail" 1
fi

# ===== 全部通过 =====
detail="Available memory ${available_mb}MB >= ${MEM_REDLINE_MB}MB threshold"
emit_and_exit "OK" "" "$detail" 0
