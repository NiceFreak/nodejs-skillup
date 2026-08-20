# 当前学习状态

> 最后更新：2026-08-20（Asia/Shanghai，D4 午休中场）

## 当前进度

- 当前周：**第二轮 W10（8/17–8/21），主题为「可观测性与线上排障」**。上一周 W9「从零到线上：部署链路」已全周收口。
- 当前 Day：**2026-08-20（周四）= W10 D4 进行中**（故障演练主场，**午休中场**，已完成块 A / 块 B / 块 C 全部 + 类 3 首次注入触发止步线已止损）。
- **下一主线 = 下午继续 D4**：类 3 重注入（校准量）→ 类 1 → 类 2 → 块 H → 块 I 收口。

## 最近完成

- **2026-08-20 上午（D4 执行进度，详见 [`day4-fault-drills.md`](./week10-observability/notes/day4-fault-drills.md)）**：
  - **块 C 全部定案**：P1 选 a（证书类由 D3 覆盖，D4 只做 3 类）· P2 首查类 1/2 共用 `/health` 劈开反代层/应用层 · P3 类 1 全绿=盲区 / 类 2 app 红 / 类 3 disk 红（探针形态确认不碰 DB 后锁死）· P4 顺序类 3→类 1→类 2 + logger -t DRILL 标记 · P5 恢复判据=三层基线全绿+残留核零（FAIL 行保留不 vacuum）。五题答案已回填 §3/§2.3/§6。
  - **块 A 完成**：`check-cert.timer` 频率修正（每 6 分钟→每 6 小时），systemd-analyze --iterations=3 销账（12:00→18:00→次日 00:00 间隔 6h），仓库副本已同步（diff 为空），展板翻档（w10Facts.ts + W10Board.tsx + verify-w9-board.mjs 三层改动），**verify:board 396/396 全过**。
  - **块 B 完成**：四 check 全绿（cert 正式路径 OK 达成 P1 选 a 销账）+ 三层基线全绿 + 实测值（avail=31G / available=1186MB / journald=294.5M / nc 已确认 / /health 纯内存不碰 DB）+ **类 3 止步线执行期修正（4.2G→3.5G，因契约目标区间为空 + 26.5G 不够红）**，已回填 §2.3 留痕。
  - **块 D 类 3 首次注入（11:50）触发止步线，已止损**：fallocate 27.1G 后 df Avail=3.2G < 3.5G **止步② 触发** → 立即 rm 清理 → 回 31G ✅。**0.7G 偏差待下午归因**（§10.3 已记事实：拍板 31−27.1=3.9G，实际 used 35G→avail 3.2G）。注入期间 80/443//health 均 200——「磁盘满不杀 Node 内存态」预测方向正确。
  - 执行期踩点记录：polkit 无终端卡死（systemctl 必须显式 sudo）+ check-cert stderr 混入 NDJSON（D3 遗留复现）。
- **2026-08-19（W10 D3 已完成）**：四项检查（app/mem/disk/cert）全部「绿→弄红→报红→还原→绿」闭环，4 脚本 + 8 unit 入库。
- **前序 D1/D2/展板各阶段见本文件历史记录（完整不变）**。

## 当前主线

```text
W10 D4（8/20，进行中）：故障演练主场（3 类真注入）—— 按契约 §5.4 分档逐类走「注入→现象→定位→修复→恢复基线」。
已完成：块 A/B/C + 类 3 首次注入（触发止步线已止损）。
下一步（下午第一个动作）：类 3 重注入（校准量）→ 类 1 → 类 2。
```

**关键决策与事实（恢复用）**：
- 类 3 顺序：**类 3 → 类 1 → 类 2**（P4 定案）；类 3 必须**对齐下一个整点 timer**（等真实触发拿「排程→执行→journald FAIL」端到端证据）。
- 类 3 止步线（执行期修正）：**avail < 3.5G 立即止损**（原 4.2G 因区间为空不存在）；fallocate 需重算校准量。
- **0.7G 偏差归因（下午本人定论）**：注入 27.1G 实际吃 36.8G（used 7.3G→35G）。候选方向：fallocate G 口径（GiB vs GB）+ df 舍入叠加。重注入校准 = 让注入后 avail 落在 3.9G 附近。
- 三个 check 的其它预测已锁死：类 1 全绿=盲区（check-app 只查进程可用性）、类 2 app 红、类 3 只有 disk 红（探针不碰 DB）。

## 当前阻塞与风险

- **类 3 重注入需校准量拍板**（黑名单，本人在场拍板）——0.7G 偏差定论后再注入，避免再次吃超止步线。
- **类 3 重注入必须对齐整点 timer**：当前 12:00 已过（止损后那是绿），下午需看 `systemctl list-timers check-disk.timer` 的 NEXT（13:00 或 14:00），对准前 3~5 分钟注入。
- 其余继承风险不变：Swap=0·8080 明文过渡期·服务器 Nginx 改动不在 git·W10 演练生产机边界。

## 下一步（下午恢复）

1. **按 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md) 恢复**：确认服务器止损后状态（df 31G / 五面 200 / 7 active / 无 /tmp/disk-fill.bin）→ 读 [`day4-fault-drills.md`](./week10-observability/notes/day4-fault-drills.md) §10.2/§10.3 → 回到块 D。
2. **类 3 重注入**：先归因 0.7G 偏差 → 定校准量 → `systemctl list-timers check-disk.timer` 看 NEXT → 对准前 3~5 分钟注入 → 等 timer FAIL → 修复 → 恢复基线。
3. **类 1 反代配置错误**（注入 → 现象 → 定位 → 修复 → 恢复，§6.2）。
4. **类 2 端口占用**（nc 已装，pkill 匹配串按实际进程命令行，§6.3）。
5. **块 G**：证书类「为什么不做」落 §6.4 + 块 B 正式路径输出回填。
6. **块 H**：三层基线全绿 + 残留核零（§2.4 清单）。
7. **块 I 收口**：§10 期望 vs 实测对照、`week10-plan.md` D4 勾选、`LEARNING-STATE.md` 更新、`day4-english-speaking.md`、commit。

## 验收命令或证据（D4 进行中）

- 块 A 销账：`systemd-analyze calendar '0/6:00:00' --iterations=3` → 12:00/18:00/次日 00:00 间隔 6h；`systemctl list-timers check-cert.timer` NEXT/LAST。
- 块 B：四 check 全绿（cert 正式路径 OK）+ 五面 200 + 7 active + avail 31G / available 1186MB / journald 294.5M。
- 块 D 已止损：`df -h /` 回 31G（20%）。**下午类 3 重注入后需补**：timer 排程自动 FAIL 行 + `rm` 后回 31G。

## 需要读取的文件（D4 下午）

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. **当前主线**：[`day4-fault-drills.md`](./week10-observability/notes/day4-fault-drills.md)（§2.3 类 3 止步线修正 / §6.1 类 3 预测 / §10.2 块 B 证据 / §10.3 首次注入记录）；[`week10-plan.md`](./week10-observability/notes/week10-plan.md) §4 D4。
3. 服务器侧：`systemctl list-timers check-disk.timer`（下午 NEXT 时刻）。

## AI 辅助记录与延迟重建

- **2026-08-20（D4 上午）**：AI 出题 P1–P5（黑名单，L2）并由本人全部作答；白名单提供 systemd/Nginx/fallocate/logger 语法与工具行为；对 P1 定案 / P2 首查 / P3 预测 / P4 顺序 / P5 判据逐题 review。执行期 review 抓到：`.d4bak` 是还原点应保留、`logger` 落点不在 service unit、时间戳统一 UTC、pkill 匹配串按实测写、类 2 终态 failed 非 inactive、类 3 止步区间自洽性矛盾（选 A 修正止步线 3.5G）、failocat 实际吃超 0.7G 触发止步。**未触发 `DEBT.md`**（黑名单止步 L2，零实现）。
- 展板维护（白名单）：`w10Facts.ts` 加 `resolved` 字段（mismatch 已销账状态解耦）+ `W10Board.tsx` 渲染拆「未销账/已销账」两组 + `verify-w9-board.mjs` 断言按销账语义更新 → `yarn verify:board` 396/396。这些改动已注释「8/20 D4」来源，未部署。
- 欠账与重建：无新增（类 3 重注入属 D4 主线未完，不是欠债）。