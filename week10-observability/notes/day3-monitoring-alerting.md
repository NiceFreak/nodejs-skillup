# W10 Day 3（8/19）：监控与告警，并主动弄红一次

> 建立：2026-08-19（Asia/Shanghai）
> 上游：[`week10-plan.md`](./week10-plan.md) §4 D3 ｜ 契约：[`day1-observability-contract.md`](./day1-observability-contract.md) §5.3（四项判据表，8/17 冻结）
> 前置：[`day2-logging-rollout.md`](./day2-logging-rollout.md) §12 —— D3 的两个硬依赖（`/health` 已上线、journald 上限 500M 已生效）**均已在 8/18 实测达成**。
> 形态：**有副作用日**，按 `LEARNING-PROTOCOL.md` §3「操作链任务的追加要求」+ W9 D5 §10 变更单四要素（改动清单 / 可证伪验证 / 回滚 / 止步线）执行。

---

## 1. 今日唯一主线与验收句

**主线**：把 D1 §5.3 已冻结的四项判据，翻成**能自己跑、跑完能表态**的检查（脚本 + `systemd timer`），
然后**亲手把每一项都弄红一次**。

**验收句（唯一）**：

> **四项检查各有一次「绿 → 我把它弄红 → 它确实报了红 → 我把它恢复绿」的完整证据链；
> 没红过的那一项不算做完，四项里缺一项即今日未收口。**

**这一天真正要学的东西**（不是「会写 shell」）：

| 问题 | 今天用什么回答它 |
|---|---|
| 一个检查凭什么可信？ | 它报过红。绿态本身不是证据——**没有报过红的检查，区分不了「一切正常」和「检查根本没在跑」**。 |
| 告警的输出是给谁看的？ | 报红时输出「我该做什么」（D1 Q11 的可操作性要求），不是输出「something failed」。 |
| 谁监控监控本身？ | timer 不跑 / 脚本自己挂 = 静默常绿，这是本日最危险的失败模式（见 §3 P5）。 |

**与 D4 的分工（别做串）**：**D3 验证的是「检查本身可不可信」，D4 才是拿它去查真故障。**
所以今天弄红的方式**可以是假的**（喂假输入、临时改阈值），只要它证明的是「判据逻辑正确」；
明天 D4 的注入**必须是真的**，证明的是「真故障发生时这条链路走得通」。这两件事今天不许混。

---

## 2. 变更单（动手前冻结，四要素）

### 2.1 改动清单 —— 今天就这几项，别的都不动

> 编号后的「归属」列按 `AGENTS.md` §2：**白** = AI 可直接给语法；**黑** = 本人实现，AI 上限 L2。
> 具体条目数量取决于 §3 P1 的答案（一个脚本还是四个），此表按「待答」形态列，P1 答完后本人回填。

| # | 改动 | 位置 | 归属 | 依赖 |
|---|---|---|---|---|
| 1 | 检查脚本本体 ×4（app/mem/disk/cert） | 服务器 `/opt/check-{app,mem,disk,cert}.sh`（8/19 拍板：与 P5 还原命令一致） | **黑**（判据映射与输出口径由本人定） | D1 §5.3 |
| 2 | 脚本的入库副本（可追溯保存点，同 `nginx/` 副本先例） | 本仓库 `week10-observability/notes/checks/` | 白（目录与提交） | 改动 1 |
| 3 | `systemd` service unit ×4（Type=oneshot，跑脚本） | 服务器 `/etc/systemd/system/check-{app,mem,disk,cert}.service` | 白（unit 语法） | P1 / P4 |
| 4 | `systemd` timer unit ×4（触发频率、Persistent） | 服务器 `/etc/systemd/system/check-{app,mem,disk,cert}.timer` | 白（unit 语法） | P2 |
| 5 | 告警可见面：报红时的输出格式与落点 | 脚本 stdout/stderr → journald | **黑**（NDJSON + action 字段，P3 已拍板） | D1 Q11 |
| 6 | 弄红用的假输入准备（假证书等，仅 `/tmp/`） | 服务器 `/tmp/{test.crt,test.key}` | 白（openssl 命令语法） | P5 |

**今天不改的**：不动 `app.js` / `server.js` 一行；不改任何 Nginx 配置；不改 `journald.conf`（D2 已定 500M）；
不动 8080 / 8081 / 展板产物；不碰 `/etc/letsencrypt/` 下任何文件（**只读 `notAfter`**）。

### 2.2 执行顺序（本人拍板，见 §3 P1、P5）

原则：**先让它能在手上跑对，再交给 timer；先弄红，再谈上线常驻。**

```text
（待本人写死顺序，建议骨架）
判据 → 退出码语义（纸面）
  → 手工跑脚本，四项在「当前真实状态」下应全绿
  → 逐项弄红（每项：弄红 → 看它报 → 恢复 → 再看它绿）
  → 四项全部红过之后，才挂 timer
  → 挂上 timer 后再验一次「timer 真的会触发」
```

**为什么 timer 放在最后**：timer 是「让它自动跑」，弄红是「让它跑对」。
先挂 timer 只会让你在一个**尚未验证过的判据**上反复收到自动发出的绿态结果。

### 2.3 验证 = 可证伪实验（每项先写死期望，再填实测）

> 按 `LEARNING-PROTOCOL.md` §4「先答后对」：**动手前把「期望值」一列填满**，实测列 D3 当天填。
> 每一行的「弄红方式」必须先在 §3 P5 里归好类（假输入 / 临时阈值 / 真条件），不许临场决定。

| # | 验证项 | 弄红方式（P5 归类） | 期望：绿时 | 期望：红时 | 实测 |
|---|---|---|---|---|---|
| ① | 进程存活 | P5：停 nginx（进程层） | `systemctl is-active nodeapp`=active 且 `/health`=200 → 退出 0 | | 17:03 绿→stop nginx→FAIL(nginx)+EXIT1→start→绿 ✓ |
| ② | 进程存活的**第二层**（活着但不干活） | P5：HEALTH_URL 端口 3000→3001 | —— | 进程 active 但 `/health` 不通时**必须报红**（这是 D1 Q8 定两层判据的全部理由） | 17:04 绿→URL 3001→FAIL(health)+EXIT1→cp .bak→绿 ✓（**不可让步点过了**） |
| ③ | 内存余量 | P5：MEM_REDLINE_MB 200→1500 | available ≥ 200 MB → 退出 0 | | 17:05 阈值→1500→FAIL(1203<1500)+EXIT1→cp .bak→绿 ✓ |
| ④ | 磁盘余量 | P5：DISK_REDLINE_GB 4→35 | Avail ≥ 4 GB → 退出 0 | | 17:06 阈值→35→FAIL(31<35)+EXIT1→cp .bak→绿 ✓ |
| ⑤ | 证书剩余天数 | P5：CERT_OVERRIDE=/tmp/test.crt | 剩余 ≥ 15 天（当前约 84 天）→ 退出 0 | | 17:07 假证书→FAIL+EXIT1→rm→绿 ✓ |
| ⑥ | 报红输出的可操作性 | P5：任取一项红态（如磁盘） | —— | 输出里能读到「我下一步该做什么」，而不只是「failed」 | FAIL 均带 action：nginx 重启 / curl -v+journal / free+ps / vacuum+du / certbot renew ✓ |
| ⑦ | timer 真的会触发 | —— | `systemctl list-timers` 见下次触发时间；等到一次真实触发后 journalctl 有当次记录 | —— | 17:10:01 LAST=17:10:01 + journald 完整记录 ✓ |
| ⑧ | **监控自身失效可被发现**（P5 追问） | 停掉 timer / 让脚本本身报错退出 | —— | 能从某处看出「检查没在跑」，而不是看到一片安静就以为一切正常 | 17:11 停 timer → NEXT 变 n/a + LAST 停滞 → 重启恢复 ✓ |
| ⑨ | 三层基线回归（D1 Q14） | —— | 五面 200 + `/health` 200 + `systemctl is-active nginx nodeapp` 全 active | —— | 17:18 五面 200 + health 200 + nginx/nodeapp/mongod active + 4 timer active ✓ |

**②和⑧是今天两个不可让步的点**：
- ② 不过 = 两层判据白设了，检查退化成 `systemctl is-active` 的复读机；
- ⑧ 不过 = 明天开始所有绿态结果都不可信（区分不了「一切正常」和「检查根本没跑」）。

### 2.4 回滚（动手前写好）

| 层 | 触发场景 | 回滚动作 |
|---|---|---|
| L1 弄红态未恢复 | 某项弄红后没能恢复绿 | 每项的弄红方式在 §3 P5 里**必须自带一条还原命令**；写不出还原命令的弄红方式今天不做 |
| L2 timer 行为异常 | timer 触发过密 / 刷屏 / 占资源 | `systemctl disable --now <name>.timer`，回到手工跑脚本形态（主线不依赖 timer 常驻） |
| L3 脚本改坏 | 脚本被改到读错路径 / 误碰现网证书 | 先 `cp` 一份 `.bak` 再改；回滚 = 覆盖回 `.bak`；**仓库副本（改动 2）是最终基线** |

**没有 L4**：今天所有改动都在新增文件层（新脚本 + 新 unit），不修改任何既有服务的配置——
这是今天风险低于 D2 的根本原因，也是**不允许顺手改 Nginx / app.js 的原因**（一改就多一层回滚）。

### 2.5 止步条件（止损线）

1. **弄红时任一项影响到线上五面**（出现非预期的 502/超时）→ 立即停止弄红，先恢复基线，当日转修复。
2. **磁盘项**：若采用真造条件的方式，`df -h /` 可用跌破 **4.2 G**（D1 Q13 的 200 MB 缓冲线）→ 立即 `rm` 回滚。
3. **证书项**：脚本读到 `/etc/letsencrypt/` 以外任何真实证书路径被写进弄红流程 → 立即停，改回 `/tmp/`。
4. **内存项**：弄红若采用真占内存的方式，available 跌破 **400 MB**（红线 200 的两倍）→ 立即停止并释放。
5. 时间盒（§4）走完块 E 仍有任一项没红过 → **砍 timer 与 stretch，保「四项红过」**；timer 顺延 D4 早段。

---

## 3. 动手前必须先答的问题（D1 契约没覆盖，落到执行层才暴露）

> 规则同 D2 §3：**AI 只出题与追问，答案本人写**。这五题都不是 shell 语法题，
> 是「这套检查凭什么可信」的设计题——答不出来就先别写脚本。

### P1（粒度）四项检查是一个脚本还是四个？

一个进程只有**一个退出码**。若四项合成一个脚本，退出码非 0 时**你怎么知道红的是哪一项**？
- 选项 a：一个脚本、四项，红了看输出（退出码只表示「有红」）。
- 选项 b：四个脚本、四个 unit，各自独立退出码，`systemctl` 层面能直接看出是哪一项 failed。
- 选项 c：一个脚本，用不同退出码编码不同项（1=进程 / 2=内存 / …）。

**必答追问**：② 如果两项同时红，你选的方案还能表达吗？② 哪一种在**明天 D4 真故障**时更好用——
D4 的场景是「某一类故障发生 → 我想立刻知道哪几项检查亮了」。

> 答：选 **b：四个脚本四个 unit**（`check-app` / `check-mem` / `check-disk` / `check-cert`）。
> 理由：① 与 P4 最小权限对齐——证书项单独提权，其余三项普通用户可执行；② 故障定位零歧义——`systemctl --failed` 直接列出失败项，无需解析输出或退出码。
> 追问①（两项同时红）：能表达。四个 unit 独立记录退出状态，`systemctl is-failed` 逐项返回，信息无混叠。
> 追问②（D4 真故障时）：b 更好用——直接看 systemd 状态层，比读脚本输出或解码位掩码少一道转换。

### P2（频率）四项的检查频率一样吗？

证书剩余天数每分钟查一次没有任何意义（它一天变一格）；进程存活每天查一次等于没查。
- **必答追问 ①**：进程存活的频率上限由什么决定——你希望「服务挂掉后多久被发现」？这个数是从哪里倒推的？
- **必答追问 ②**：`OnCalendar=` 与 `OnUnitActiveSec=` 的区别，在**服务器重启后**表现有什么不同？
  `Persistent=true` 解决的是哪一类漏跑？（这条属**经验知识**，语法见 §5，但「要不要开」是你的判断。）
- **必答追问 ③**：频率越高越好吗？把它和 D2 的 journald 500M 上限连起来算一笔账——
  每次检查都会往 journald 写记录，一天写多少条、多大，会不会自己吃掉自己的日志预算。

> 答：四项频率不同，分四档（**最终锁死版**，含 P1×P2 对不齐的两处拍板）：
>
> | unit | 检查内容 | 频率 | Persistent |
> |---|---|---|---|
> | `check-app` | `systemctl is-active` 对 nginx/nodeapp/mongod 三服务 + `curl -f http://127.0.0.1:3000/health`（**端口 3000，非 8080**），任一失败退出非 0 | 每 1 分钟 | false |
> | `check-mem` | `free -m` available **< 200 MB** 红 | 每 5 分钟 | false |
> | `check-disk` | `df -BG` Avail **< 4 GB** 红 | 每 1 小时 | true |
> | `check-cert` | 证书剩余 **< 15 天** 红 | 每 6 小时 | true |
>
> - **进程判据 = 一个脚本两层（D1 §5.3 原形态）**，不拆两个 unit——「应用不健康」是单一状态，拆了会产生「systemd 绿但 health 红」需人工二次关联。
> - **显式扩展契约（拍板接受）**：进程判据从 D1 冻结的「只查 nodeapp」扩展为「nginx + nodeapp + mongod 三服务 + /health」。理由：① 否掉公网五面常驻探针后，Nginx 层挂成为内部盲孔——nodeapp active + /health 200 时四项全绿但外部全 502；② mongod 显式纳入是为**归因加速**（状态直接 failed，不用翻日志确认「原来是 DB 连不上」）；③ 依据 D1 Q14「五面全 502 + /health 200 → Nginx 层」——Q14 已承认 Nginx 是真实故障面。
> - **公网五面不入常驻判据**：仍作 W9 基线验证工具，D4 注入前后手动触发。做常驻 = 冻结合同外扩展 + 每天 2880 次外部请求 + 引入网络抖动/DNS/防火墙变量，与 Node 健康无关。
> - **Persistent 开关**：开＝磁盘、证书（低频，漏补成本高）；关＝app、内存（高频或波动项，开机重算即可）。关机期间进程本来不在，高频项补跑积压无意义。
> - **追问③ 日志预算**：约 7.5k 条/天 ≈ 2 MB/天、月 ~56 MB，远低于 journald 500M 上限（P2 修正后更低），不构成自吃预算。

### P3（输出口径）报红的输出，给人读还是给机器读？

D2 刚把 Node 日志统一成 NDJSON（给机器查）。检查脚本的输出要不要也走 NDJSON？
- 选项 a：纯文本，人可直接读（`journalctl -u check-*` 一眼看懂）。
- 选项 b：NDJSON，和 D2 日志契约同构（将来能被同一套工具查）。
- 选项 c：绿走机器格式、红走人读格式。

**必答追问**：D1 Q11 的验收要求是「报红时输出我该做什么」。你选的格式里，
**「我该做什么」这句话具体长什么样**——写出磁盘项报红时的那一行完整输出。
（提示：`Disk usage high` 不是可操作指令，`可用 3.4G < 4G 红线；先跑 journalctl --vacuum-size=200M，再 du -sh /var/log/*` 才是。）

> 答：**选 b：NDJSON + 每行含人可读 `action` 字段**。
> 理由：a 纯文本无法被下游聚合工具自动解析；c「绿机器/红人读」强制双格式增加复杂度，且红时人同样需要机器可拿字段（自动建工单/联动）。NDJSON 一行一 JSON，`jq` 可查、人可扫，未来可接 Promtail/Vector 无需额外解析。
> 字段强制：`check`（unit）/ `subsystem`（app 内部分层，仅 app 需）/ `status`（OK/FAIL）/ `ts` / `host` / `action`（可执行命令）/ `detail`（上下文）。
> 追问① 磁盘红样例：`{"check":"disk","status":"FAIL","ts":"2026-08-19T10:00:00Z","host":"<hostname>","action":"journalctl --vacuum-size=200M && du -sh /var/log/*","detail":"<df 实时值> avail=3.4G < 4G"}`（**设备名/主机名/百分比全部实时取，不硬编码**）。
> 追问② 三种红区分：退出码统一非 0，靠 `subsystem` 字段区分——nginx 挂 action 重启 nginx；nodeapp 挂 action 查 journalctl；health 挂 action 给 curl -v + 查 Node 日志。**P1 定「哪项红看输出」，P3 的 subsystem/action 就是实现**。
> **P3 残项拍板**：
> - 绿时输出：**每次都打一行**（status OK/FAIL）——区分「没跑」与「全绿」；绿静默时 journald 安静分不清监控死了还是正常；与 D1 Q7「journald 可直接查」卖点一致。日志量仍可控（~2MB/天）。
> - 同构层次：**格式层同构**（NDJSON + ISO8601，同一 grep/jq 工具链），字段名不强制对齐 D2——检查日志没有 method/path/requestId，强行同 schema 会臃肿。`ts` 不改 `time`。

### P4（身份）检查脚本以什么身份跑？

- 读 `/etc/letsencrypt/live/.../fullchain.pem` 的 `notAfter` —— 需要什么权限？
- `curl 127.0.0.1:3000/health` —— 需要什么权限？
- `free -m` / `df -h` —— 需要什么权限？

**必答追问 ①**：如果四项合一个 unit，这个 unit 的身份就得取**四项里最高的那个**——
这是「为了一项权限，把另外三项也提权了」。你接受吗？和 P1 的粒度选择是同一个问题的两面吗？
**必答追问 ②**：`nodeapp` 是 nologin 服务账号（D2 §11 新增事实）。这条对今天的身份选择有影响吗？
身份边界见 [`server-permission-cheatsheet.md`](../../week9-deployment/notes/server-permission-cheatsheet.md)。

> 答：**四个 unit：三个 `User=ubuntu`（app/mem/disk）+ 一个 `User=root`（cert）**。
> 事实依据（块 A 实证）：证书路径 `/etc/letsencrypt/live/` 普通用户不可读（Permission denied，`sudo -n` 才行）；`systemctl is-active` / `curl` / `free` / `df` 普通用户可执行。
> - 证书 unit 直接 root 跑，**不选 ubuntu+sudo**：只需一条 openssl 命令，root 权限按 unit 隔离不泄漏；ubuntu+sudo 要写 NOPASSWD sudoers 行，增加配置依赖与跨机维护成本。
> - app/mem/disk 以 ubuntu 跑，systemd 的 `User=` 按 unit 隔离，证书提权不污染其余三项（与 P1 的 b 咬合）。
> **action 里 sudo 前缀规则（最终版）**：脚本内检查命令（systemctl/curl/df/free/openssl）均不加 sudo，以 unit 身份运行；action 里给运维的**恢复命令**若含 root 操作（journalctl --vacuum / systemctl restart）**保留 sudo 前缀**——运维交互执行有 sudo，且需要知道「这条命令要提权」。

### P5（弄红的方式）每一项，你打算怎么把它弄红？

这是今天**最核心的一题**。三种弄红方式，证明力完全不同：

| 方式 | 例子 | 证明了什么 | 没证明什么 |
|---|---|---|---|
| **喂假输入** | 让脚本读 `/tmp/test.crt`（10 天过期） | 判据算得对 | 真实路径下读得到、读得对 |
| **临时改阈值** | 把磁盘红线临时改成 40 G，看它报红 | 比较逻辑与报红通路是通的 | 真实资源紧张时的连锁反应 |
| **真造条件** | 真 `fallocate` 26.5 G 把可用压到 4.5 G | 端到端真实 | ——（但代价最高，且**和 D4 ③ 重复**） |

**必答追问 ①**：**逐项**写死你选哪一种，以及**为什么这一项够用这一种**。
（D1 Q13 已经把「磁盘满」「证书过期」排进了 D4 的真注入清单——那么 D3 还要不要再真造一次？
如果 D3 就真造了，D4 那一类还剩什么没验过？这两天的证据不该重复，该**分工覆盖不同环节**。）
**必答追问 ②**：进程存活的**第二层**（验证 ② 那一行：进程 active 但 `/health` 不通）——
你怎么造出这个状态？`systemctl stop nodeapp` **造不出来**（那会让第一层先红，第二层根本没机会执行）。
**必答追问 ③**：每一种弄红方式，**还原命令是什么**？写不出还原命令的那一项，今天不弄红（同 D1 Q13 的硬规矩）。
**必答追问 ④（监控自身）**：验证 ⑧ 要求「检查没在跑也能被发现」。
timer 停了、脚本自己 syntax error 退出——这两种情况下你**在哪里、多久之后**会发现？
如果答案是「不会发现」，那今天需要补的是什么？（这是本日唯一允许延到 stretch 的一项，但**必须先答**。）

> 答：**四项一律「假输入 / 临时改阈值」，零真造条件；与 D4 证据分工，不重复。每项配还原命令，且统一走「先 cp .bak 再改、还原 cp 回 .bak」策略**（对齐回滚表 L3，防手滑把脚本改坏掉进 L3）。
>
> | 检查项 | 弄红方式 | 还原命令 | 证明了什么（没证明什么） |
> |---|---|---|---|
> | app·进程层 | `sudo systemctl stop nginx`（脚本先查 nginx，非 active 即红） | `sudo systemctl start nginx` | 进程判据能红 |
> | app·/health 层 | 改脚本常量 `HEALTH_URL` 端口 3000→**3001**（不存在端口）→ 连接拒绝必红；**不碰 app.js 一行**（D3 硬边界） | `cp /opt/check-app.sh.bak /opt/check-app.sh` | health 判据能红（进程 active 但不通 = D1 Q8 两层判据的全部理由）；没证明真实 health 500 |
> | 内存 | 改 `MEM_REDLINE_MB` 200→1500（当前 available 1188 立即触红） | `cp /opt/check-mem.sh.bak /opt/check-mem.sh` | 比较逻辑+报红通路通；没证明真实内存耗尽连锁反应（D4 OOM 隔离做） |
> | 磁盘 | 改 `DISK_REDLINE_GB` 4→35（当前 Avail 31G 立即触红） | `cp /opt/check-disk.sh.bak /opt/check-disk.sh` | 同上；没证明 journald 自动清理等真实写满行为（D4 fallocate 做） |
> | 证书 | 环境变量 `CERT_OVERRIDE=/tmp/test.crt`（10 天假证书）；脚本逻辑：`$CERT_OVERRIDE` 非空读它、空读正式路径 | `rm -f /tmp/test.crt /tmp/test.key`（+ 移除 Environment 行） | 判据算得对；没证明真实路径下读得到、读得对（D4 判定逻辑模拟同款但走正式路径） |
>
> **app 两个子系统各自弄红的原因**：脚本顺序短路（nginx 挂→立即退出，不测 health）——只停 nginx 验证不到 health 判据；两路分别触发、分别还原。
> **证书路径切换选环境变量而非改脚本常量**：不改脚本本体、systemd unit 加一行 `Environment=` 即可，还原删除该行更短；脚本默认读正式路径不因变量残留而漂移。
> **D3 与 D4 的分工（追问①）**：D3 只验证「判据能红」（假阈值/假输入/改端口，不污染真实状态）；D4 验证「红了之后系统怎么反应和恢复」（真 fallocate、真 OOM、真端口占用、真证书替换）。证据链完全不重叠。
>
> **两项 review 修正已并入**：① app /health 层改「改脚本常量端口 3001」替代「sed 改 app.js」（后者违反 D3 硬边界）；② 内存/磁盘还原统一「cp .bak 回滚」替代 sed 反替换（与回滚表 L3 对齐，备份始终是干净基线）。

---

## 4. 今日时间盒

| 块 | 时长 | 内容 | 产出 / 收工判据 |
|---|---|---|---|
| A | 20 min | **只读复位**：跑一遍三层基线（五面 curl + `/health` + `systemctl is-active`）；`journalctl --disk-usage`、`df -h /`、`free -m`、证书 `notAfter` 各采一次 | 今日基线四个数落纸；**基线不绿不许往下走**（同 §3.1 前置四件事） |
| B | 30 min | 答 §3 的 P1–P5，回填 §2.1 改动清单与 §2.3 的「弄红方式」一列 | 五题有答案；变更单无空格；每一项弄红都配了还原命令 |
| C | 45 min | 写检查脚本，**手工跑**，四项在当前真实状态下应全绿 | 手工跑四项全绿；退出码语义与 P1 的选择一致 |
| D | 50 min | **弄红主场**：逐项走「绿 → 弄红 → 看它报 → 还原 → 再看绿」，逐行填 §2.3 实测 | ①–⑤ 每项都有一次红态证据（**至少一条命令输出**）；②必须过 |
| E | 25 min | 挂 `systemd` service + timer，验证 ⑦（`list-timers` + 等一次真实触发） | timer 已 enabled 且**观察到一次真实触发的 journald 记录** |
| F | 20 min | 验证 ⑧（监控自身失效可发现）+ 验证 ⑨（三层基线回归） | ⑧ 有结论（做到 / 明确降 stretch 并写清怎么补）；五面全绿 |
| G | 25 min | 收口：脚本副本入库（改动 2）、本笔记补 §9「实际发生了什么」、`week10-plan.md` D3 勾选、`LEARNING-STATE.md`、口语稿 | commit；D3 收口 |

合计约 3 小时 35 分。**块 D 是今天的主场**，时间不够时砍的顺序：stretch → 块 E（timer）→ 块 F 的 ⑧；
**块 D 的四项红态一项都不许砍**——砍了它今天就没有交付物。

---

## 5. 执行细节（白名单部分，只放语法与工具行为）

> 本节只放**换个 init 系统 / 换个发行版就不成立**的纯工具细节。
> **判据取值一律来自 D1 §5.3，退出码怎么映射、输出写什么由 §3 的答案决定，不在这里新造。**

### 5.1 采数命令（四项各自的取数口径，D1 已定）

```bash
# 进程存活（两层，D1 Q8）
systemctl is-active nodeapp                    # 第一层：进程在不在
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/health   # 第二层：能不能干活

# 内存余量：取 available（不是 free、不是 used）
free -m | awk '/^Mem:/ {print $7}'             # 第 7 列 = available

# 磁盘余量：根分区可用
df -BG --output=avail / | tail -1              # -BG 直接以 GB 为单位输出，省去单位解析

# 证书剩余天数（只读，绝不写）
openssl x509 -in /etc/letsencrypt/live/43-128-154-242.sslip.io/fullchain.pem -noout -enddate
# 也可用 -checkend：剩余秒数不足则退出码非 0（省去自己算天数）
openssl x509 -in <crt> -noout -checkend $((15*24*3600))
```

**两条经验知识**（`AGENTS.md` §4：必须真遇过一次才知道的工具行为，直接讲不要求先猜）：
1. `free -m` 的 **available ≠ free**：free 是完全没被碰过的，available 包含可回收的 page cache——
   **D1 Q8 定的是 available**，取错列会让阈值凭空严格好几倍（`$7` 是 available，`$4` 才是 free）。
2. `openssl x509 -checkend N`：**剩余不足 N 秒时退出码非 0**，天然就是「退出码语义」，
   不用自己做日期减法（少一个时区口径坑——D2 §3 P2 刚踩过 `$time_iso8601` 不是 UTC）。

### 5.2 systemd oneshot service + timer（unit 语法骨架）

```ini
# /etc/systemd/system/<name>.service
[Unit]
Description=<一句话说清它检查什么>

[Service]
Type=oneshot            # 跑完就退出，退出码即结论（不是常驻服务）
ExecStart=/usr/local/bin/<script>
# User= 由 §3 P4 的答案决定，不在这里预设
```

```ini
# /etc/systemd/system/<name>.timer
[Unit]
Description=<触发 xxx 检查>

[Timer]
OnCalendar=<频率由 §3 P2 的答案决定>
Persistent=true         # 语义见 P2 追问②：错过的触发在下次启动时补跑
Unit=<name>.service     # 省略时默认同名 .service

[Install]
WantedBy=timers.target  # 注意：timer 装到 timers.target，不是 multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now <name>.timer
systemctl list-timers --all | grep <name>      # NEXT / LAST 两列 = timer 真在排程的证据
systemctl start <name>.service                 # 手工触发一次（不等排程）
systemctl status <name>.service                # oneshot 跑完显示 inactive(dead)，退出码非 0 才 failed
journalctl -u <name>.service -n 20 --no-pager
```

**三条经验知识**：
1. `Type=oneshot` 的服务跑完是 `inactive (dead)`，**这是正常的**，不是「没跑起来」——
   常驻服务的 active 直觉在这里会误导你（W9 看 nodeapp 的经验不能直接套）。
2. **timer 的 `[Install]` 是 `WantedBy=timers.target`**，写成 `multi-user.target` 会 enable 成功但不排程。
3. `systemctl list-timers` 的 `LAST`/`PASSED` 两列是**「它到底跑没跑过」的直接证据**——
   验证 ⑧「监控自身失效可被发现」的第一个可用抓手就在这里。

### 5.3 假证书（弄红用，仅 `/tmp/`，D1 Q13 已冻结路线）

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout /tmp/test.key -out /tmp/test.crt \
  -days 10 -subj "/CN=test-expired"
# 还原：
rm -f /tmp/test.crt /tmp/test.key
```

**不挂 Nginx、不动 `/etc/letsencrypt/`**（D1 Q13 止步条件）。

---

## 6. 今日明确不做

- 不装 node_exporter / Prometheus / Grafana（D1 Q7：主线选 (a)，stretch 受**常驻新增 ≤ 80 MB** 上限约束）。
- 不做 webhook / 邮件推送（D1 Q11：降 stretch；今天的告警可见面就是**退出码 + journalctl + 可操作输出**）。
- 不建面板、不做历史曲线、不做趋势告警。
- **不做真故障注入**——反代改错、真抢 3000 端口、真把盘写满，全是 D4 的活（§1 的分工）。
  今天只弄红「检查」，不弄红「服务」。
- 不改 `app.js` / `server.js` / Nginx / `journald.conf` 任何一行（§2.1）。
- 不碰 8080 下线、不碰展板（展板 ④ 阈值尺要等今天的实测数——见 §10）。
- 不开 Java / Python 线（8/17 已拍板：Java 并入 W11、Python 留 W12）。

---

## 7. AI 协作边界（本日形态）

| 归属 | 今天具体是什么 |
|---|---|
| **AI 可直接给（白名单）** | systemd unit 的字段语法与 `timers.target` / `Persistent` / `Type=oneshot` 的工具行为；`free`/`df`/`openssl x509` 的参数拼写与列序；`openssl req` 生成自签证书的命令；`systemctl list-timers` / `journalctl` 用法；本文件这类文档整理 |
| **本人实现，AI 只 review（黑名单，上限 L2）** | §3 P1–P5 的全部答案；四项判据 → 退出码的映射；报红输出「我该做什么」的具体文案；弄红方式的逐项选择与还原命令；频率与身份的取舍；验证 ⑧ 的方案 |

**特别注意**：D1 已把四项判据与阈值冻结完毕（8/17 本人自己的答案），
今天 AI **复述这些已冻结的结论不构成新的 L2 援助**；
但若直接给出一份可运行的检查脚本（判据组装 + 退出码 + 告警文案），就是**误给 L3**，
必须按 `AGENTS.md` §5 记入 `DEBT.md`。

---

## 8. 收尾清单（块 G）

> **状态（2026-08-21 回填）**：九项全部完成。依据 —— §2.3 验证表九行实测列已填满；§9 已补；`notes/checks/` 已入库 4 个脚本 + 8 个 unit；`week10-plan.md` §4 的 D3 已勾选；`day3-english-speaking.md` 已入库。

- [x] §2.3 验证表九项实测填满，偏差逐条归因（先答后对）。
- [x] §3 P1–P5 答案固化，review 结论留痕。
- [x] 本文件补 §9「实际发生了什么」。
- [x] 检查脚本 + unit 文件副本入库（`week10-observability/notes/checks/`），与 `nginx/` 副本同规格：**服务器改动必须在 git 里有可追溯保存点**。→ 4 个脚本 + 8 个 unit 已入库。
- [x] `git status --short` 核对：无 `.env`、无密码/token、无私钥（`/tmp/test.key` 绝不入库）。
- [x] commit + push。
- [x] `week10-plan.md` §4 的 D3 勾选。
- [x] `LEARNING-STATE.md`：主线推进到 D4、验收证据补四项红态、若 ⑧ 降 stretch 则记 `BACKLOG.md`。→ ⑧ 当天实测通过（§2.3 ⑧），未降 stretch，无需记 `BACKLOG.md`。
- [x] 按 `DAILY-SPEAKING-PROTOCOL.md` 生成 `day3-english-speaking.md`。

---

## 9. 收口：实际发生了什么（2026-08-19 当天填）

> 形态同 D2 §11：期望 vs 实测逐项对照 + 偏差归因 + 执行期新增事实。

### 9.1 块 C 执行记录（2026-08-19 16:36 记）

**部署 check-app.sh（第 1/4 项）**：scp 上传到 /tmp，sudo install 落到 /opt/check-app.sh（ubuntu 属主、755），sudo cp 建 .bak。运行输出 `status:OK`、`EXIT_CODE=0`，全绿。

**执行期新增事实**：
- /opt 目录为 root 属主，ubuntu 无写权限，建/删文件都要 sudo；后续弄红改阈值需 sudo 或 chown。
- .bak 因 sudo cp 创建为 root 属主（脚本本体是 ubuntu 属主）；回滚时 ubuntu 可读 .bak、可写目标脚本，普通 cp 可行；异常则统一 sudo cp。
- 运行输出确认 host=VM-0-5-ubuntu、ts=+08:00 动态取，subsystem=app、action 空为该脚本绿态形态。

**部署 check-mem.sh（第 2/4 项，16:47）**：`bash -n` `SYNTAX_OK` → scp 上传（**第一次失败**：终端在 `week10-observability/src/` 目录下、命令误用仓库根相对路径，改用 `check-mem.sh` 后成功——经验：命令路径须与当前工作目录匹配）→ install + sudo cp .bak → 运行输出 `status:OK`（available 1195MB ≥ 200MB）、`EXIT_CODE=0`，全绿。

**部署 check-disk.sh（第 3/4 项，16:56）**：`bash -n` `SYNTAX_OK` → scp 上传 → install + sudo cp .bak → 运行输出 `status:OK`（detail `device=/dev/vda2 total=40G used=8G avail=31G use=20% >= 4G threshold`）、`EXIT_CODE=0`，全绿。注意：这次命令路径用了仓库根完整相对路径（吸取 check-mem 踩点，未再犯）。

**部署 check-cert.sh（第 4/4 项，17:01）**：`bash -n` `SYNTAX_OK` → scp → `install -o root -g root`（与前三脚本不同，P4 拍板）→ sudo cp .bak → `sudo /opt/check-cert.sh` 运行输出 `status:OK` + `Certificate valid for more than 15 days (checkend OK)` + `EXIT_CODE=0`，全绿。**块 C 4/4 全部部署验证完成。**

**遗留观察点（非阻断）**：check-cert 运行时 openssl 会往 stderr 打一行 `Certificate will not expire`（证书有效期足够长时的工具行为），出现在 NDJSON 行之前——四个脚本里唯一非 NDJSON 的 stderr 输出。当前 journald 可容忍混合输出；若将来接 Promtail/Vector 消费，这行会混流，需处理（如 stderr 重定向或消费端过滤）。D4 前不处理不影响主线。

### 9.2 块 D 弄红执行记录（2026-08-19 17:03–17:04 记）

**① app 进程层（17:03）**：绿 OK/EXIT=0 → `sudo systemctl stop nginx` → FAIL subsystem=nginx + action + EXIT=1 → start → 绿 EXIT=0。证据链完整。

**② app /health 层（17:04）**：绿 → `sudo sed -i` 改 HEALTH_URL→3001 → FAIL subsystem=health + EXIT=1 → `cp .bak` 还原 → 绿 HEALTH_URL 回 3000。不碰 app.js 一行。

**经验知识新增**：`sed -i` 需要所在目录写权限（在目录建临时文件再原子替换），不只是目标文件写权限。`/opt` 是 root 属主目录，ubuntu 无目录写权限 → 非 sudo `sed -i` 失败（EXIT=4）。**推论：弄红改阈值一律 `sudo sed -i`；还原 `cp` 直接覆盖目标文件、不建临时文件，普通 `cp` 可行（已验证）**。

**③ 内存（17:05）**：绿 1205MB≥200 → sudo sed 阈值→1500 → FAIL(1203<1500) + action(free+ps) + EXIT=1 → cp .bak → 绿 1203≥200。可用内存两次读取差 2MB 属正常波动。

**④ 磁盘（17:06）**：绿 31G≥4 → sudo sed 阈值→35 → FAIL(31<35) + action(journalctl --vacuum + du) + EXIT=1 → cp .bak → 绿 31≥4。

**⑤ 证书（17:07）**：绿(正式证书 checkend OK) → 生成假证书 → sudo CERT_OVERRIDE=/tmp/test.crt → FAIL(checkend failed) + action(certbot renew) + EXIT=1 → rm 假证书 → 绿。

**块 D 收口**：五项红态证据全部拿到（① 进程层 / ② health 层 / ③ 内存 / ④ 磁盘 / ⑤ 证书），每项都完成「绿→弄红→报红→还原→绿」，且 ②（今天不可让步点）已通过。**今日验收句达成——四项检查各有一次完整红态证据链，缺项清零。**

### 9.3 块 E/F 执行记录（2026-08-19 17:08–17:16 记）

**块 E（17:08–17:10）**：8 个 unit（4 service + 4 timer）写入 /etc/systemd/system/；enable --now 四 timer 全成功；list-timers NEXT 可见（app 每分钟 / mem 每 5 分 / disk 每小时 / cert 每 6 小时）。**第一次 daemon-reload 失败**：命令链 systemctl 漏加 sudo → polkit 报 `Interactive authentication required`（无 TTY 无法交互认证）——经验：SSH 非交互 session 里 systemctl 属主操作必须显式 sudo。重跑加 sudo 成功。

**验证 ⑦（17:10:01）**：list-timers LAST 列出现 17:10:01（check-app/mem 真实触发）；journald 完整记录 `Starting → NDJSON status:OK → Finished + Deactivated successfully`（Type=oneshot 正常终态确认）。

**验证 ⑧（17:11）**：stop check-app.timer → list-timers --all 该行 **NEXT 变 n/a**（不再排程）+ LAST 停滞，对比其余 timer NEXT 有未来时间——「timer 停了」由此可发现，重启后 NEXT 恢复。**实际信号是 NEXT=n/a 而非行消失**（list-timers --all 含 inactive 单元）。第二种失效（脚本 syntax error 自挂）不现场造——机制 = 非 0 退出 → systemd failed / journald `Failed with result exit-code`，区别于正常 `Deactivated successfully`，已由块 D 的 EXIT=1 间接验证，现场造语法错误降 stretch 边界。

**验证 ⑨（17:18）**：三层基线回归全绿——五面 80/443api(SSL:0)/443admin/8080/8081 全 200；/health 200；nginx/nodeapp/mongod 全 active；四个 check timer 全 active。**今天的全部改动（4 脚本 + 8 unit）未破坏任何线上面。**

**块 F 收口**：⑧（监控自身失效可被发现）+ ⑨（基线回归）均达成，块 A–F 全部完成。

---

### 9.5 收口之后的一处发现：`check-cert.timer` 的频率写成了另一个单位（2026-08-19 晚，建展板时逐行核 unit 副本发现）

**事实**：入库副本 `notes/checks/check-cert.timer` 写的是

```ini
OnCalendar=*-*-* *:0/6
```

这个表达式里 `0/6` 落在**分钟**位上，含义是「每 6 分钟」，不是 §3 P2 拍板的「每 6 小时」。
`systemd-analyze calendar '*-*-* *:0/6'` 当场可证伪：归一化成 `*-*-* *:00/6:00`，
相邻两次触发相隔 6 分钟。要跑成每 6 小时，小时位才是那个分母：`OnCalendar=0/6:00:00`
（`systemd-analyze` 归一化为 `*-*-* 00/6:00:00`，相邻触发相隔 6 小时）。

另三个 timer 复核无误：`*:0/1` = 每分钟、`*:0/5` = 每 5 分钟、`hourly` = 每小时，与 P2 一致。

**影响**：功能无损（证书检查是只读的，多跑不改变任何状态），
但它把证书项的检查频率从 4 次/天变成 240 次/天，多出约 236 次；
日志量增加约 236 行/天，仍在 §3 P2 追问③ 那笔预算之内。
真正的损失不在资源，在**「频率是判据的一部分」这一格没有兑现**——
P2 那一整题的答案是「四项频率不同、各自有理由」，而实际跑起来的是三档不是四档。

**它属于哪一类**：与 D2 §11 那三条同族，是本周第五条「自动检查全绿但语义没生效」——
而且是这一族里最完整的一个样本：

| 三样都对 | 唯独 |
|---|---|
| `systemctl enable --now` 成功 | 单位不是想要的那个 |
| 表达式语法合法，`daemon-reload` 无告警 | —— |
| `list-timers` 的 NEXT 列有值，看起来一切正常 | —— |

**8/19 当天没有发现它的原因**：块 E 的验证 ⑦ 只验「timer 真的会触发」，
看的是 NEXT 有值、LAST 出现过——**这两个信号在频率错的时候长得一模一样**。
验证 ⑦ 的判据本身不足以覆盖「频率对不对」这一维。

**处置（D4 开工第一件事，不在今天改）**：

1. 服务器上把 `OnCalendar` 改成 `0/6:00:00`，`daemon-reload` + 重启该 timer；
2. **验收方式不是读一遍文件**，是看 `systemctl list-timers` 里 check-cert 那行的
   NEXT 与 LAST 相隔是否为 6 小时——同样的错误再犯一次也能被这个动作抓住；
3. 仓库副本同步更新；
4. 验证 ⑦ 的判据补一维：**timer 不只要「会触发」，还要「按写下的频率触发」**。

**展板处理**：⑦ 的频率表把这一格标成「待做」而不是「已实测」，并在表下单独说明——
在服务器改完并用 `list-timers` 核过之前，这一格不许翻档。

## 10. 明日入口（D4）

D4 是「故障演练主场（3–5 类）」（`week10-plan.md` §4，清单与分档见 `day1-observability-contract.md` §5.4）。
**它对今天有三个硬依赖**：

1. **四项检查必须红过** —— D4 的定位要靠它们表态；今天没红过的那一项，明天它说什么都不能信。
2. **§2.3 验证 ⑨ 的三层基线必须绿** —— 没有绿基线不许注入（`week10-plan.md` §3.1 前置四件事第 2 条）。
3. **今天用掉的弄红方式要记清** —— D4 的四类注入不能和今天的弄红重复（§3 P5 追问①：**分工覆盖不同环节，不是重复**）。

D4 第一个动作：按 §5.4 分档表逐类核「前置四件事」（还原点 → 基线 → 止步条件 → 回滚命令），
其中**端口占用那一类要先确认服务器上 socat / nc 哪个已装**（D1 Q13 遗留待确认项）。

**在那之前先修一件事**：§9.5 的 `check-cert.timer` 频率单位错——改 `OnCalendar`、
`daemon-reload`、用 `list-timers` 的 NEXT/LAST 间隔核对、同步仓库副本。
它不阻断 D4 的注入，但 D4 一整天都要靠这四个 timer 表态，**先让它们真的按写下的频率在跑**。

---

## 11. AI 辅助记录

- 2026-08-19：AI 起草本文件——变更单结构、验证矩阵**格式**、时间盒排布、§5 的 systemd / openssl **语法与工具行为**（白名单），以及 §3 P1–P5 的**问题与追问**。
- §3 五问、退出码映射、告警文案、弄红方式的逐项选择**全部留空待本人作答**，AI 不给取值、不给可运行脚本。
- §5.1 的 `free` available 列序、§5.2 的 `Type=oneshot` 终态与 `timers.target` 归属，属 `AGENTS.md` §4「经验知识」（必须真实遇过一次才知道的工具行为），按规则直接讲解，不要求本人先猜。
- 截至起草时**未触发 `DEBT.md` 记账**（白名单语法 + L1 出题，黑名单零实现）。
- 2026-08-19 晚（展板阶段 3）：AI 把本日成果落成展板两块（④ 阈值尺、⑦ 红过才算数），
  属 `AGENTS.md` §2 白名单的「展示资产」——**只渲染本人已作答的结论，不新增判据、不改阈值**。
  过程中逐行核入库的 unit 副本，发现并报告了 §9.5 那处频率单位错（属 §1 硬线 3「review 允许且鼓励」），
  **未代改服务器、未代改 unit 文件**，改动与核对留给本人在 D4 开工时做。
