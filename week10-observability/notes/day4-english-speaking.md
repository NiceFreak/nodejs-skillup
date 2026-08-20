# W10 Day 4 英语口语稿（2026-08-20）

> 状态：**收口版（块 I 校验通过）**
> 主题取自当天真实发生的事件（类 3 磁盘满演练的端到端结果：故障真实存在但 check-disk 静默绿），非计划预告。
> 生成依据：`DAILY-SPEAKING-PROTOCOL.md`；事实来源：`day4-fault-drills.md` §6.1 ①~⑦（15:00 timer 真实触发 + `df -BG` 取整盲区定论）。

---

## Topic

**A false-negative blind spot: why a disk-full check stayed green while the disk was truly below threshold**

---

## Speaking Script

During a disk-full drill, we found our check script stayed green while the disk was actually below threshold. We injected 26.4 GB to leave about 3.8 GiB free, below the 4 GiB alert line. But at the hourly timer run, check-disk reported `avail=4G >= 4G threshold` and exited OK. The root cause: the script parses `df -BG`, which rounds 3.84 GiB up to 4 G. An integer comparison then treats it as safe. So a real failure — disk nearing full — can never trigger the alert within our safe injection window. This is a false-negative, not a false-positive: the fault existed, but monitoring could not see it because the comparison used a rounded display value. We now record this blind spot for the runbook and plan to switch the threshold to byte-level `df -B1` comparison.

---

## Speaking Check

- **词数**：正文约 **138 词**（限 120–150 ✅）
- **预计时长**：约 1 分钟（138 词 @ 130–145 词/分钟）✅
- **口语感检查**：第一人称复盘、对话式；「false-negative」「blind spot」「rounded display value」为自然工程表达；无背稿腔。
- **技术准确性**（事实分层）：
  - 事实：注入 26.4G 后字节级 avail=4,123,242,496 B ≈ 3.84 GiB（低于 4 GiB 阈值）；15:00:01 timer 真实触发，check-disk 输出 `avail=4G >= 4G threshold`、`status=OK`、`Deactivated successfully`；脚本判据为 `df -BG` 整数比较。
  - 推断（已闭环为结论）：`df -BG` 对 3.84 GiB 四舍五入显示 4G → 整数判据 `4>=4` 为真 → 绿。在止步线（<3.5G 立即止损）约束下，check-disk 在合法注入区间内**永不红**。
  - 边界：结论基于 GNU df `-B` 块大小输出行为与当前脚本实现；不推及所有监控脚本。补法（`df -B1` 字节级比较）为 D5 runbook 待办，今天未改脚本。
- **必要发音**：`false-negative` /fɔːls ˈnɛɡətɪv/；`GiB`（gibibyte）与 `GB`（gigabyte）区分读音；`df -B1` 读作「d-f space dash B-one」。

---

> 收口完成（2026-08-20 15:33）：主题从「0.7G 偏差归因」升级为当天完整闭环的「该红不红盲区」——覆盖类 3 端到端 timer 触发 + `df -BG` 取整机制，词数 138 在 120–150 内。