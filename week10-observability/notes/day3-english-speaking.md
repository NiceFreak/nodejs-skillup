# W10 Day 3 英语口语稿

> 主题来源：2026-08-19 W10 D3「监控与告警，并主动弄红一次」——四项检查脚本 + systemd timer + 五项红态证据链（见 [`day3-monitoring-alerting.md`](./day3-monitoring-alerting.md) §9.2）。

## Topic

How do you make sure a monitoring alert actually fires when it should?

## Speaking Script

In our two-gigabyte server with no swap, I built four health checks as shell scripts — process liveness, free memory, disk space, and certificate expiry. Each script outputs one NDJSON line with an action field, and a systemd service runs it on a timer.

The key idea: a green check is not evidence. Before trusting any alarm, I forced each one red and then restored it. For disk, I temporarily raised the threshold from four gigabytes to thirty-five, saw the script fail with an actionable message, then restored from a backup. For the certificate, I pointed the script at a test certificate that expires in ten days.

I also verified the monitoring can't silently die: if a timer stops, its NEXT column in systemctl list-timers changes to n/a, which is visible.

## Speaking Check

- **词数**：130（区间 120–150 ✓）
- **预计时长**：约 1 分钟（130 ÷ 140 wpm ≈ 56s）
- **口语感检查**：第一人称叙述 + 短句 + 「The key idea」口语转折；无论文腔；全部结论有当天笔记支持
- **必要发音**：`NDJSON`（enda-jay-son）；`systemctl`（system-see-tee-el）；`n/a`（en-slash-ay，直读字母）