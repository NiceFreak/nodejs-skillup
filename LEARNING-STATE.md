# 当前学习状态

> 最后更新：2026-08-20（Asia/Shanghai，D4 收口完成 + 展板 ⑤ 落地）

## 当前进度

- 当前周：**第二轮 W10（8/17–8/21），主题为「可观测性与线上排障」**。上一周 W9「从零到线上：部署链路」已全周收口。
- 当前 Day：**2026-08-20（周四）= W10 D4 已完成（故障演练主场）**。
- **下一主线 = D5（8/21 周五）收口日**：runbook 成篇 → 延迟自测 → 能力检验口述 → 展板校正（按最新数据修正过时结论）→ 状态收口 + 项目叙述。

## 最近完成

- **2026-08-20（D4 故障演练主场，3 类全部走通「注入→现象→定位→根因→修复→恢复基线」，但三类预测各被实测修正）**：
  - **块 A 完成**：`check-cert.timer` 频率修正（每 6 小时，NEXT/LAST 间隔 6h 销账），仓库副本同步，展板翻档 `verify:board` 396/396。
  - **块 B / 块 C 完成**：四 check 全绿；P1–P5 五题定案（类 3→类 1→类 2 顺序、`/health` 首查劈开反代/应用层、`logger -t DRILL` 标记、恢复判据=三层基线+残留核零）。
  - **类 3（磁盘满）**：初次注入触发止步止损 → 字节级探针归因 0.7G 偏差（`fallocate -l 1G`=1GiB+4K；`df -h` 显示舍入非吃超）→ 重注入 26.4G 对准 15:00 timer，**端到端打通但 check-disk 静默绿**——`df -BG` 四舍五入 3.84→4G + 整数判据 `>=4` 导致「故障真实但 FAIL 在合法止步区间内不可达」。**收口选 A**：端到端打通 + 盲区发现（该红不红），盲区留 D5 runbook。
  - **类 1（反代配置错误）**：13 行 `proxy_pass` 改指 9999 → 443root=502 + error.log `connect() failed upstream 9999`；定位链（/health→nginx -t→error.log）完整命中；注入态四 check **全绿 = 盲区实锤**（服务进程可用性 vs 对外可达性 scope 分离）；diff 双证据（注入后=1/回滚后=0）+ 恢复 200。偏差：/auth /reports 404 为应用裸前缀路由，非注入。
  - **类 2（端口占用）**：两次注入（nc / nc -k）均得「nodeapp 假 active（无 EADDRINUSE、无监听、health 000）」而非预期 failed——新盲区。**收口选 D**：定位链已走通，排 D5 延迟自测读 server.js 确认 listen 错误被吞；`restart` 恢复基线。
  - **展板收口（白名单展示资产，当天晚些）**：W10 板最后一块 **⑤ 演练分档与定位**落地，七块全部做完——四类 × 三档矩阵（C 档整列空）、三类的预测 ↔ 实测连线（断两根）、四项 check 表态矩阵（实测层零红点、四格标「未实测」）、三信号九格、三个盲区、两条工具纠错、残留核零；④ 阈值尺的磁盘 / 内存 / 证书三格随之翻档。`yarn verify:board` **421/421 全过**，未部署（服务器 8081 仍旧版）。记录见 [`week10-visualization-plan.md`](week10-observability/notes/week10-visualization-plan.md) §12.9。
  - **块 H 通过**：五面 + /health 全 200、7 active、残留核零（/tmp 无演练产物、3000=nodeapp 自身 backlog 511、shop-ssl 与 .d4bak diff 空、nodeapp unit 无临时 Environment、check 脚本今天未被触碰）。**唯一生产机今晚可安稳过夜。**
- **2026-08-19（W10 D3 已完成）**：四项检查（app/mem/disk/cert）全部「绿→弄红→报红→还原→绿」闭环，4 脚本 + 8 unit 入库。

## 当前主线

```text
W10 D5（8/21，周五）收口日：
A runbook 成篇（症状→首查→判定分叉→修复→预防，覆盖已演练 3 类 + 四 check 取整盲区）
→ B 延迟自测（不看笔记按 runbook 走通两类，含 D4 排过来的类 2「假 active」）
→ C 能力检验口述（日志链路 / 失败路径分叉判据 / 改需求预演）
→ D 展板校正（按最新数据修正过时结论）→ E 状态收口 + 项目叙述
```

**关键决策与事实（恢复用）**：
- **三个独立盲区（D4 全暴露，D5 runbook 必须覆盖）**：① check-disk `df -BG` 取整盲区（avail∈[3.5,4.0)GiB 时静默绿，止步线内永不红；补法=字节级 `df -B1` 比较）；② check-app 对反代语义错失明（443root=502 时四项全绿；补法=本地后端健康检查或 error.log 模式监控，公网探针否决）；③ nodeapp「假 active」（端口冲突时进程活但无监听、health 000，疑似 listen 错误被吞，D5 读 server.js 确认）。
- **「假输入能红 ≠ 真条件该红」已获活证据**：D3 假证书弄红 vs D4 真磁盘逼近不红（取整盲区）、真反代 502 不红（scope 盲区）。
- **0.7G 偏差归因定论**：`fallocate` G=GiB（1G=1,073,745,920 字节分毫不差），0.7G 全来自 `df -h` 显示舍入（真实 32.5G→显示 31G；注入后 3.84GiB→显示 3.9G）。
- **注入校准换算率（D5 / W11 沿用）**：fallocate 声明 1G → df 字节级 +1,073,745,920；注入后目标 3.9GiB=fallocate 26.4G（以 `df -B1` 实测基线为前提）。

## 当前阻塞与风险

- **类 2「假 active」根因未定论**：推断 nodeapp listen 错误被吞，D5 延迟自测需读 server.js 确认（黑名单 W6，届时本人作答）。
- **check-disk 取整盲区补法未落地**：D5 runbook 记录 + 是否改脚本由本人决定（§7 纪律今天不改脚本）。
- 其余继承风险不变：Swap=0 · 8080 明文过渡期 · 服务器 Nginx 改动不在 git（`shop-ssl.d4bak` 在机）· W10 演练生产机边界。

## 下一步（D5 收口日）

1. **D5 第一入口**：按 `LEARNING-PROTOCOL.md` 恢复 → 读**当日规划** [`day5-wrapup.md`](week10-observability/notes/day5-wrapup.md)（2026-08-20 起草：§2 变更单 / §3 P1–P5 / §4 时间盒 A–I）+ [`day4-fault-drills.md`](week10-observability/notes/day4-fault-drills.md) §6 三份记录 + §11 → re-run 五面基线确认绿 → 先答 §3 P1（延迟自测形态，它决定块 C/D 怎么走）。
2. **A runbook 成篇**：按「症状 → 首查命令 → 判定分叉 → 修复 → 预防」组织：类 1（502+health 200→Nginx 层→error.log upstream）、类 3（df 取整盲区→字节级复核→check-disk 判据改造建议）、类 2（假 active→ss/journalctl/fd 定位→读 server.js）；附五面/四服务速查表 + check 盲区表。
3. **B 延迟自测**（**2026-08-20 拍板：8/21 当天实做两类，不顺延**）：不看 D4 笔记，按 runbook 真注入真恢复走通两类（含类 2「假 active」——从现象推理应用吞错）。间隔只有 1 天，故每一步要标「查 runbook 得到的 / 本来就记得」，翻笔记就地记账；**块 D 必须早于读 `server.js` 的块 E**，否则先预测后读码作废。
4. **C 能力检验口述**：① 日志产生→可检索经过的层 ② 两条失败路径分叉判据（`/health` 200 vs 非 200 劈开反代/应用层）③ 改需求预演。
5. **D 展板校正**（表述与范围 2026-08-20 两次修订）：拆成两维。**① 数据时效（今天做完）**——拿最新数据逐格核对 W10 板七块、不一致的当场修正（`yarn verify:board` 保持全过），重点＝⑤ 里「未实测」那四格是否已有实测数据该翻档、① 那格仍挂已拍板是否仍成立。**② 表达形态（今天只抽样 3 块定性，不返工）**——本人 8/20 指出「不要过分追求动效」波及面更广，核对后确认对象是**九块板**（W3/W5/W6/W6Day4/W9/W10/Auth/Interview/Dashboard）：8/18 判据加严只覆盖 W9/W10，其余七块组件冻结在 8/12 的旧规则「图形只负责关系」下，8/18 存量清扫只推了 `styles.css` 排版、没碰内容形态。判据 = 四条肯定面 + 遮标题仪式；定性结论回写 `BACKLOG.md` **P2-4（范围已扩到九块板、规模升「大」、档位待定性后再定）**。
6. **E 状态收口**：更新 `week10-plan.md` D5 勾选、`LEARNING-STATE.md`、必要时 `DEBT.md`；第二轮 W10 复盘 + 5–10 分钟项目叙述；`day5-english-speaking.md`；commit。

## 验收命令或证据（D4 已收口）

- 块 H 最终：五面 + /health 全 200、7 active、`/tmp` 无演练产物、`shop-ssl` 与 `.d4bak` diff 空、nodeapp unit 无临时 Environment、check 脚本今天未被触碰。
- 类 3：`journalctl -u check-disk.service` 15:00:01 OK 行（`avail=4G` 误判）——「该红不红」证据。
- 类 1：`error.log` `upstream http://127.0.0.1:9999/` + `connect() failed (111)`；注入态四 check 全 `Deactivated successfully`——盲区实锤。
- 类 2：ss 无 3000 监听 + health 000 + nodeapp active——「假 active」证据（D5 补根因）。
- `journalctl -t DRILL`：今天全部演练标记可一次性过滤。

## 需要读取的文件（D5）

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. **当前主线**：[`day5-wrapup.md`](week10-observability/notes/day5-wrapup.md)（D5 当日规划）、[`day4-fault-drills.md`](week10-observability/notes/day4-fault-drills.md)（§6 三份记录 §11）、[`day4-english-speaking.md`](week10-observability/notes/day4-english-speaking.md)。
3. 服务器侧：`systemctl list-timers --all`（四 timer NEXT/LAST）、五面基线（D5 需要干净起点）。
4. D5 才允许读：`server.js`（类 2 根因，黑名单本人作答）。

## AI 辅助记录与延迟重建

- **2026-08-20（D4 全天）**：AI 出题 P1–P5（黑名单 L2）并由本人全部作答 + 逐题 review；白名单提供 systemd/nc/fallocate/logger/df 语法与工具行为（含 nc accept-once、df -B 四舍五入的经验知识）；AI 未代写任何定位推理、根因结论或收口决策（类 3 选 A、类 2 选 D、类 1 注入目标均为本人拍板）。**未触发 `DEBT.md`**（黑名单止步 L2，零实现）。
- **今日学习发现（非欠债，D5 runbook 素材）**：三个盲区 + 0.7G 偏差归因 + 「假输入能红≠真条件该红」活证据；已完整记录于 [`day4-fault-drills.md`](week10-observability/notes/day4-fault-drills.md) §6/§10。
- 展板维护（白名单）：上午块 A 已翻 `check-cert.timer` 频率格（396/396）；当天晚些把 D4 成果落成 ⑤ 演练分档与定位一整块（数据层 + 组件 + 样式 + 25 条新断言，含 6 条量图形事实的），`yarn verify:board` **421/421**（未部署，服务器 8081 仍旧版）。板上不给可复制的整条注入命令，只给动作与目标；端口那一类的根因**故意不写答案**，留作 D5 延迟自测题。
- 欠账与重建：无新增（三类演练均为本人完成定位与决策）。