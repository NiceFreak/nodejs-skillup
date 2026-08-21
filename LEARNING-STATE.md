# 当前学习状态

> 最后更新：2026-08-21（Asia/Shanghai，W10 全周收口完成，状态指向 W11 入口）

## 当前进度

- 当前周：**W11（8/24–8/28，CI 流水线与自动化发布）**——W10「可观测性与线上排障」已于 **2026-08-21（D5 收口日）全周收口**。
- 当前 Day：W11（8/24 周一）尚未开始；本周末为无人值守期（唯一生产机，块 H 已核零可安稳过夜）。
- **独立线（继续排队，不与学习主线同步开展）**：**展板状态核查线**（`showcase-audit-line.md`）——对象**八块板**（Auth/OAuth2/W3/W5/W6/W6Day4/W9/W10），**当前进展 0/8**，阶段一只判定不改，排队不排期。`BACKLOG.md` P2-4 已指向该线（档位不动，等阶段一判定再定）。**W10 板的数据时效已由 D5 翻档四处，表达形态仍未核**。

## 最近完成

- **2026-08-21（W10 D5 收口日，全周完成）**：
  - **runbook 成篇 + 延迟自测两类走通（判据 1–4 销账）**：`runbook.md` 三类五列齐全、判定分叉可判真假；类 1（反代 502）+ 类 3（磁盘逼近满）盲测不看笔记走通，**全程 0 次翻笔记**。
  - **check-disk 取整盲区已修（#11 变更单）**：`df -BG` 取整 → 字节级 `df -B1` 比较；15:18 重注入该类条件拿到 `status=FAIL`「该红就红」实证（旧判据同条件 8/20 报 OK）。
  - **类 2「假 active」根因定论**：读 `server.js`（98 行只读）确认无 `error` 监听；偏差归因改为「成功回调触发但底层未绑定，**机制未验证**」→ 排 W11 最小样本复现；修复方向（`error` 监听 + `process.exit(1)`，复用外层 server）已入 runbook 与本次笔记 §8。
  - **展板数据时效翻档四处**（`w10Facts.ts`）：盲区①→已修、盲区③→修复方向已定、类 2 根因 unverified 更新、④阈值尺磁盘 caveat 追加「8/21 已修」；**grade 保持 pending 不夸大**（机制未验证）。`verify:board` **421/421**（playwright 改为本地 devDependency 1.62.1）。
  - **块 H 全绿 + 残留核零**：五面 200 + health 200 + 7 active；`/tmp/disk-fill.bin` 不存在、3000 仅 nodeapp（backlog 511）、shop-ssl 与 d4bak/d5bak diff 空、nodeapp unit 无临时 Environment。**唯一生产机今晚可安稳过夜。**
- **2026-08-20（D4）**：三类故障真注入挖出三个盲区；展板 ⑤ 落地 421/421。
- **2026-08-19（D3）**：四项检查全部「绿→弄红→还原→绿」，4 脚本 + 8 unit 入库。

## 当前主线

- **下一入口 = W11（8/24 周一）**：CI 流水线与自动化发布。本周 W10 产出的**四项检查 + 五面基线 curl** = W11 流水线的部署后验证步骤（runbook 速查表是现成输入）；**runbook 的「预防」列** = W11 回滚策略输入。

**W10 未完项的显式移交（W11 接手，不许沉默消失）**：
| 未完项 | 去向 |
|---|---|
| 盲区②（check-app 反代可达性）补监控 | W11 CI 部署验证（本地后端健康检查 / error.log 模式监控，公网探针否决） |
| 类 2「假 active」机制复现 + 修复 | W11 最小样本（仅 listen + error 处理）复现 → 定修复（error 监听 + exit(1)） |
| 8080 明文过渡期下线 | 本周末前**仍在线**；`runbook.md` §6 已注明「未排期、真故障与计划下线需区分」 |
| 展板表达形态核查（八块板） | 独立线 `showcase-audit-line.md`（0/8，排队不排期） |
| W9 Java stretch（最小 jar + systemd + Nginx location） | W11（8/17 拍板并入） |

## 当前阻塞与风险

- **类 2「假 active」机制未验证**：成功回调触发但底层未绑定，W11 必须用最小样本复现后才能定修复，避免盲目 `process.exit(1)` 副作用（runbook §3 盲区③已记录）。
- check-disk 判据已修但**服务器脚本属主漂移为 ubuntu:ubuntu**（原 root:root）——755 不影响运行，锦上添花项，W11 首日顺手 `chown root:root`。
- 其余继承风险不变：Swap=0 · 8080 明文过渡期 · 服务器 Nginx 改动不在 git（备份在机）· W10 演练边界。

## 下一步（W11 第一入口，8/24 周一）

1. 按 `LEARNING-PROTOCOL.md` 恢复状态 → 读根 `README.md` W11 部分 + 建 `week11-ci/notes/week11-plan.md`（计划文件尚未建立）。
2. 首日优先项：**类 2 最小样本复现**（机制未验证是 W10 唯一悬案）+ 盲区②补监控设计（CI 部署验证载体）。
3. Java stretch（最小 jar + systemd + Nginx location）与 Maven 构建 job 合并执行（8/17 拍板）。

## 验收命令或证据（W10 收口态）

- `runbook.md` 存在；判据 1–4 销账（五列齐全 / 盲区在册 / 盲测 0 翻笔记 / 两类走通）
- check-disk：`journalctl -u check-disk.service` 15:18:41 **FAIL**（该红就红实证）+ 15:58:55 OK（基线恢复）
- `verify:board` 421/421（两次）
- 五面 curl + health 200 + 7 active + 残留核零（D5 块 H 证据见 `day5-wrapup.md` §10.5）

## 需要读取的文件（W11）

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. **W10 留给 W11 的接口**：`week10-observability/notes/runbook.md`（速查表 + 预防列）、`day5-wrapup.md` §8（类 2 根因）、`day1-observability-contract.md`（四项检查判据）。
3. 根 `README.md` W11 段；`week9-deployment/notes/day2-host-and-node-service.md`（部署链路存量）。

## AI 辅助记录与延迟重建

- **2026-08-21（D5）**：AI 出题 P1–P5（runbook 分叉结构、盲区替代信号、类 2 预测、收口判据），全部由本人作答 + AI review；块 D 盲测期间 AI 零定位提示（判据 3 保真）；白名单提供 shell/systemd/playwright 依赖处理语法与部署样板。**未触发 `DEBT.md`**（黑名单止步 L2，零实现代写）。
- **W10 全周**：黑名单（契约设计、判据阈值、演练分档、定位顺序、runbook 结构）全程本人作答，AI 只出题/追问/review；唯一一次白名单判据改造（check-disk 字节级）也是本人拍板判据、AI 只按三点决策写 shell。
- 重建安排：掌握验收第 4 条（延迟重建）中，「四项检查判据」「runbook 分叉骨架」是最应延迟重建的两项——建议 W11 第一个 15–20 分钟小单元从 runbook 速查表盲重画一张开始。
- 欠账：无新增。