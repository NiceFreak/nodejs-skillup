# W11 Day 4（8/27）技术英语口语稿

> 建立：2026-08-27（Asia/Shanghai，D4 收口）
> 来源：当天学习内容（`day4-rollback-drill.md` §5）——回滚演练（Test 拦截 / Verify 拦截 + 人工回滚）+ 类 2「假 active」机制定论与修复

## Topic

A rollback drill that proved where bad versions get caught, and the real cause of a "fake active" service.

## Speaking Script

Today I ran a rollback drill on our real deployment pipeline. I pushed two broken commits on purpose. The first failed a test, and the pipeline stopped at the test stage — the server was never touched. The second passed tests but crashed at startup. Because the service unit is Type=simple, systemd only checks that the process forks, so the deploy step returned success and no automatic rollback happened. The verification stage caught it after thirty seconds, and I rolled back manually to the last verified commit.

The drill also exposed why a service can look active while serving nothing. When the port is already taken, Node still fires the listening callback but the bind fails, and with no error listener the process just stays alive. I added an error listener that exits the process, so systemd restarts it instead of leaving a silent zombie.

## Speaking Check

- 词数：145 词（目标 120–150 ✅）
- 预计时长：约 62 秒 @ 142 词/分钟
- 口语感：对话式陈述，无论文/文档语气；使用了当天建立的工程术语（rollback drill / Test stage / Verify stage / Type=simple / EADDRINUSE 场景 / error listener）
- 事实边界：均为 D4 实测——候选①构建 58 Test 拦、候选②构建 60 Deploy exit 0 + Verify 30s 超时 + 人工 rollback、类 2 EADDRINUSE 注入复现（修复前 ALIVE / 修复后 exit(1)）；「静默僵尸」是本人口语化表述，笔记中对应「进程静默存活 = 假 active」
- 发音提示（必要项）：`Type=simple` 读 `tipe-simple`；`EADDRINUSE` 逐字母读 `E-A-D-D-R-I-N-U-S-E`