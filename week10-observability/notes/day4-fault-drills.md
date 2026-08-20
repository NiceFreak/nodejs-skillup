# W10 Day 4（8/20）：故障演练主场（3–5 类）

> 建立：2026-08-19（Asia/Shanghai，D3 收口后起草）
> 上游：[`week10-plan.md`](./week10-plan.md) §4 D4 + §3.1（演练安全边界）｜ 契约：[`day1-observability-contract.md`](./day1-observability-contract.md) §5.4（演练分档表，8/17 冻结）
> 前置：[`day3-monitoring-alerting.md`](./day3-monitoring-alerting.md) §10 —— D4 的三个硬依赖（四项检查都红过 / 三层基线绿 / D3 弄红方式已记清）**已在 8/19 全部达成**；
> 同时带来一个**开工前必须先修的遗留**：§9.5 的 `check-cert.timer` 频率单位错。
> 形态：**本周副作用最大的一天**，按 `LEARNING-PROTOCOL.md` §3「操作链任务的追加要求」+ W9 D5 §10 变更单四要素（改动清单 / 可证伪验证 / 回滚 / 止步线）执行。

---

## 1. 今日唯一主线与验收句

**主线**：按契约 §5.4 的分档表，逐类走完一个**不可拆的单元**：

```text
前置四件事（还原点 → 基线 → 止步条件 → 回滚命令）
→ 注入
→ 现象（有证据）
→ 定位（先看哪一个，为什么先看它）
→ 根因（事实 / 推断 / 未验证 分层）
→ 修复
→ 恢复基线（三层全绿）
```

**今日验收句**（`week10-plan.md` §4 D4 原文，不临时改）：

> **每一类都能说出「我是先看的哪一个东西，为什么先看它」——定位顺序本身就是本周要学的东西。**

**验收句的可证伪形态**（今天用它销账，缺一即未收口）：

| # | 判据 | 怎么算过 |
|---|---|---|
| 1 | 类数达标 | 完整走完 **3 类**（**P1 选 a**：证书类由 D3 覆盖，3 类即契约下限也是今日目标，见 §2.5 止步①） |
| 2 | 每类有证据 | 每类**至少一条命令输出**贴进 §6，不是「我看到 502 了」这种转述 |
| 3 | 每类有定位顺序 | 注入**前**写下「首查项 + 为什么」，注入**后**对照实际走的路，偏差要归因 |
| 4 | 事实分层 | §6 每类的根因段显式标 **事实 / 推断 / 未验证**（`LEARNING-PROTOCOL.md` §4） |
| 5 | 监控表态销账 | 每类注入前**预测四项 check 各自绿还是红**，注入后核实测——**预测全绿的那一类就是覆盖盲区，要写下来** |
| 6 | 基线全恢复 | 收工时三层基线（五面 + `/health` + 三服务 + 四 timer）全绿，且**演练残留清零**（§2.4 L1 清单） |

> 判据 5 是 D3 → D4 的真正接力：D3 证明了「检查判据能红」（假输入），
> D4 要回答的是**「真故障来了它到底会不会红」**——这两件事不是一回事，D3 §3 P5 追问① 已经把这条线画好。

---

## 2. 变更单（动手前冻结，四要素）

### 2.0 开工前置：先把 D3 §9.5 的 timer 频率修正掉（不做完不许开始注入）

D4 一整天要靠这四个 timer 表态，**先让它们真的按写下的频率在跑**。

| 步 | 动作 | 销账判据（**不是「读一遍文件」**） |
|---|---|---|
| ① | 服务器 `/etc/systemd/system/check-cert.timer` 的 `OnCalendar=*-*-* *:0/6` 改成 `OnCalendar=0/6:00:00` | `systemd-analyze calendar '0/6:00:00'` 归一化后**相邻两次触发相隔 6 小时** |
| ② | `sudo systemctl daemon-reload && sudo systemctl restart check-cert.timer` | 命令零报错（注意 D3 踩点：SSH 非交互 session 里 `systemctl` 属主操作必须显式 `sudo`） |
| ③ | **销账** | `systemctl list-timers check-cert.timer` 那一行的 **NEXT 与 LAST 相隔 6 小时**（同样的错误再犯一次也会被这个动作抓住） |
| ④ | 仓库副本 `notes/checks/check-cert.timer` 同步 | 副本与服务器 `diff` 为空 |
| ⑤ | 展板 ⑦ 的频率表那一格从「待做」翻档 | 只有 ③ 拿到证据后才许翻——D3 §9.5 的处置第 4 条 |

> **验证 ⑦ 的判据补一维**（D3 §9.5 处置第 4 条，今天一并生效）：
> timer 不只要「会触发」，还要「**按写下的频率触发**」。NEXT 有值 + LAST 出现过，这两个信号在频率错的时候长得一模一样。

### 2.1 改动清单 —— 今天就这几项，别的都不动

> 「归属」按 `AGENTS.md` §2 / `week10-plan.md` §6：**白** = AI 可直接给语法；**黑** = 本人决策与推理，AI 上限 L2。
> 「性质」区分**留下的改动**与**当天必须还原的临时改动**——后者收工时残留必须清零（§2.4 L1）。

| # | 改动 | 位置 | 性质 | 归属 |
|---|---|---|---|---|
| 1 | `check-cert.timer` 的 `OnCalendar` 修正 | 服务器 `/etc/systemd/system/` | **留下** | 白 |
| 2 | 同上，仓库副本同步 | `notes/checks/check-cert.timer` | **留下** | 白 |
| 3 | 类 1：`shop-ssl` 的 `proxy_pass` 改错地址 | 服务器 `/etc/nginx/sites-available/shop-ssl` | **临时**（当类还原） | 白（语法）/ 黑（选哪个 location、预测什么症状） |
| 4 | 类 2：临时进程抢占 `127.0.0.1:3000` | 服务器内存态（无落盘） | **临时** | 白（命令）/ 黑（定位顺序） |
| 5 | 类 3：`/tmp/disk-fill.bin` 占位文件 | 服务器 `/tmp/` | **临时** | 白（`fallocate` 语法）/ 黑（止步余量的判断） |
| 6 | ~~类 4：形态待 P1 拍板~~ **P1 选 a：由 D3 覆盖，今日不做** | — | — | 黑 |
| 7 | 本文件 §6 四份五段式记录 + §10 收口 | `notes/day4-fault-drills.md` | **留下** | 黑（AI 只出模板与追问，不代填） |
| 8 | `week10-plan.md` D4 勾选、`LEARNING-STATE.md`、口语稿 | 仓库根 + `notes/` | **留下** | 白 |

**明确不在清单里**（动了就是超纲）：不改 `app.js` / `server.js` 一行；不改四个 check 脚本的任何阈值常量（那是 D3 的弄红手法，今天要的是**真条件**）；不动 `journald.conf`；不碰 8081 展板产物；不碰 8080 下线。**证书类今天不做**（P1 选 a：D3 §9.2 ⑤ 已用同一手法覆盖，重复即无新证据；走正式路径与止步⑤「现网证书只读」冲突，见 §3 P1 定案）。

### 2.2 执行顺序（本人拍板，见 §3 P4）

```text
块 A 前置修正（§2.0）→ 块 B 基线复位 → 块 C 答 §3 五题
→ 类 3（磁盘满，对准 NEXT 拿 timer 端到端证据）→ 类 1（反代配置错误）→ 类 2（端口占用）
   ← P4 定案：类 3 排最前（对准真实触发），等待期不浪费；顺序不临场排
→ 块 H 全量回归 + 残留清扫 → 块 I 收口
```

**不可拆规则**（`week10-plan.md` §3.1）：**注入 → 观察 → 修复 → 恢复基线是一个单元；一类没恢复到绿，不开始下一类。**

### 2.3 前置四件事逐类核验表（注入前逐格打勾，空一格即不许注入）

> 「止步」「回滚」两列是 **8/17 契约 §5.4 已冻结的原文**，今天照做不重议；
> 「还原点」「基线时刻」两列是**今天现场填**——契约冻结的是规则，还原点是当天的事实。

| # | 故障类型 | 档 | ① 还原点（今天先做的备份 / 记下的当前状态） | ② 基线（本类注入前那一次三层基线的时刻与结果） | ③ 止步条件（契约原文） | ④ 回滚命令（契约原文） | 四格齐？ |
|---|---|---|---|---|---|---|---|
| 1 | 反代配置错误 | A | **`shop-ssl` = 1251 字节；`proxy_pass` 3 处（13 行 `= /` / 25 行 `/auth` / 31 行 `/reports`）；/admin/ 为静态 alias 不经反代（14:10 实测）** | 待填 | `nginx -t` 非零立即止**不 reload**；reload 后五面异常非 502/504 | 恢复 `shop-ssl` 备份 → `nginx -t` → reload | ☐ |
| 2 | 端口占用 | A | **nodeapp active（since 8/18 15:58, PID 1476211, Memory 48.5M）；占用工具 = `/usr/bin/nc`（14:10 确认）** | 待填 | journald 未见 `EADDRINUSE` 而是未知错误；抢占 PID 杀不掉 | `pkill -f <匹配串>` → `start nodeapp` → `status` | ☐ |
| 3 | 磁盘满 | B | **注入前字节级 avail=32,583,675,904B（14:10 实测，较 14:04 探针基线 -503,808B ≈ 0.5MB，journald/系统自然变化）；`df -h` 显示 31G** | **14:04 三层基线全绿**（五面+health 200 + 7 active） | **df 可用 < 3.5G（2026-08-20 执行期修正，见下注）**；`fallocate` 返回 `No space left` | `rm -f /tmp/disk-fill.bin && df -h /` | ☐ |
| ~~4~~ | ~~证书~~（**P1 选 a：由 D3 覆盖，今日不做**） | — | — | — | — | — | — |

> **类 3 的 `fallocate` 大小不照抄契约的 26.5G**：契约写这个数时的实测可用是 31G，
> 今天要以**块 B 当场量到的 `df` 为准**重算（目标：落在告警线 4G 之下、止步线 3.5G 之上）。
> 抄一个过期的数是本周第六条「绿灯全过但语义没生效」的现成候选。
>
> **2026-08-20 执行期修正（留痕）**：契约原文「目标落在 4G 之下、4.2G 之上」区间为空（4G 之下 ∩ 4.2G 之上 = ∅），
> 且契约示例值 26.5G 会导致 avail=4.5G > 4G、check-disk 不报红。块 B 现场拍板（选 A）：
> **止步线 4.2G → 3.5G**，fallocate 填 **27.1G**（31G − 3.9G），注入后 avail≈3.9G
> ——低于告警线 4G（check-disk 必红）、高于新止步线 3.5G（留有 400MB 缓冲）。偏差归因见 §10。
>
> **2026-08-20 下午第二轮重注入（后续修正，留痕）**：首次注入 `27.1G` 触发止步（avail 3.2G < 3.5G）后，
> 下午字节级探针定论（§10.3）：`fallocate -l` 的 G = GiB，`df -h` 显示舍入是 0.7G 偏差根因，非吃超。
> **第二轮注入量的手算校准确认 = `fallocate -l 26.4G`**（需吃 28,396,586,598 字节 ÷ 换算率 1,073,745,920 = 26.446），
> 以注入前现场字节级 `df -B1 /` 复测为准微调；目标注入后 avail ≈ **3.9 GiB**（`df -BG` 显示 3G → check-disk 必红，> 3.5 GiB 止步线留 400MB 缓冲）。
> NEXT=**15:00**，注入窗口 = **14:55–14:57**。

### 2.4 回滚（动手前写好，三层）

| 层 | 触发场景 | 动作 | 验证 |
|---|---|---|---|
| **L1 · 单类回滚** | 某一类演练结束或触发本类止步条件 | 执行 §2.3 第 ④ 列该类的回滚命令 | 该类的**注入面**恢复 + 本类残留清零（配置字节数/进程/文件/环境变量全对得上） |
| **L2 · 服务层回滚** | L1 执行完但该面仍不正常 | `sudo nginx -t && sudo systemctl reload nginx`；`sudo systemctl restart nodeapp`；必要时从 `.bak.20260818` 恢复 site 文件 | 三层基线复测全绿 |
| **L3 · 全量复位** | 两类以上互相污染，或已分不清哪个改动导致现象 | 停止全部演练；恢复 `shop-ssl.bak.20260818` 等五份在机备份；`rm` 全部 `/tmp/` 演练产物；兜底 `sudo reboot`（W9 D5 A 已实测四服务冷启动自起） | 重启后三层基线 + 四 timer 全绿 |

**残留清单（收工时逐条核零，块 H；P5 定案版）**：
`/tmp/disk-fill.bin` 不存在（`ls /tmp/disk-fill.bin` 报 No such file）· 抢占 3000 的 socat/nc 进程无（`ss -tlnp | grep :3000` 无输出 + nodeapp active）· `shop-ssl` 与 `.d4bak` 的 `diff` 为空（**备份保留在机**——它是今天的还原点，P5 修正①）· 四个 check 脚本与 `.bak` 的 `diff` 为空（今天本来就不该改它们）· systemd unit 里没有临时加的 `Environment=` 行。

**刻意保留、不算残留**（P5 定案②）：`logger -t DRILL` 演练标记行 + 演练造成的 check FAIL 行——`journalctl -t DRILL` 可一次性过滤；**不 vacuum**（会连同真实历史一起删）。这两类行是今天的证据链，也是 runbook「演练与真事故如何区分」的答案。

### 2.5 止步条件（止损线，触发即停，不讨价还价）

1. **任一类恢复不了基线** → 立即停止全部演练，当天转入修复与复盘，剩余类顺延或砍掉（**3 类即达标下限**，`week10-plan.md` §4 D4 原文）。
2. **磁盘可用 < 3.5G**（2026-08-20 执行期修正，见 §2.3 注）→ 立即 `rm -f /tmp/disk-fill.bin`，不等观察做完（同分区上有 MongoDB 数据，`week10-plan.md` §8）。
3. **`nginx -t` 非零** → 绝不 reload。配置错误的演练目标是「看反代打不通」，不是「让 Nginx 起不来」。
4. **出现预测症状之外的第二个面异常** → 停下来先查，不叠加下一类（叠加故障 = 定位证据互相污染）。
5. **任何指向 `/etc/letsencrypt/live/` 的写操作** → 立即停。证书链路只读是本周红线（`week10-plan.md` §8：不撤销、不重签现网证书；也不停 80——W9 已证关 80 = 断续期硬依赖）。

---

## 3. 动手前必须先答的问题（契约 §5.4 没覆盖，落到执行层才暴露）

> 规则同 D2 §3 / D3 §3：**AI 只出题与追问，答案本人写。**
> 这五题没有一题是命令语法题——注入命令契约里已经写好了；这五题问的是「这场演练凭什么算数」。

### P1（接力还是重复）证书那一类在 D3 已经被用掉了，D4 还剩什么可验证？

事实摆在这里：

- **契约 §5.4 第 4 类**写的是「证书过期（判定逻辑模拟）」，注入方式 = `openssl req -x509 ... -days 10` 造假证书给脚本读 `/tmp/test.crt`。
- **D3 §9.2 ⑤ 已经做过这件事**：造假证书 + `CERT_OVERRIDE=/tmp/test.crt` → FAIL → `rm` → 绿。
- **D3 §3 P5 追问① 立的规矩**：D3 验「判据能红」，D4 验「红了之后系统怎么反应和恢复」，**证据链完全不重叠**。
- 但 D3 §3 P5 表格里给证书那一行写的下一步是「D4 判定逻辑模拟**同款但走正式路径**」——
  而 §2.5 止步⑤ 和 `week10-plan.md` §8 都写死了**现网证书只读**。**这两句话打架。**

所以今天必须先拍板，三条出路（各自的代价已列出，选哪条本人定）：

| 出路 | 代价 / 换来什么 |
|---|---|
| a. 承认这一类已被 D3 覆盖，D4 只做 3 类 | 3 类是达标下限，不违约；但本周「证书」这条线止步在假输入，**「正式路径读得到、读得对」永远没验过** |
| b. 换一个不碰现网证书的接力形态 | 需要本人先答：正式路径下还有什么是 D3 没验过的？（例如**读不到**时脚本是报红还是报错退出——这是两种完全不同的失效） |
| c. 走正式路径 | 与止步⑤ 冲突，除非能给出一个「只读且不可能写」的做法并写进止步线 |

> 追问①：如果选 a，本周 runbook 里「证书快过期」那一条的**首查命令**，凭据是什么？（D3 的假输入证据能不能撑起 runbook 的这一条？）
> 追问②：如果选 b，你打算怎么**制造「读不到」**而不动 `/etc/letsencrypt/`？（提示方向：check-cert 是 `User=root` 跑的，D3 §3 P4 已经量过普通用户读不到——这条既有事实里有没有现成的杠杆？）

> **答（2026-08-20 块 C 定案）：选 a——承认这一类已被 D3 覆盖，D4 只做 3 类（反代配置错 / 端口占用 / 磁盘满）。**
>
> 理由三句话：
> 1. **c 不可行**：与止步⑤「现网证书只读」直接冲突。证书路径硬编码 + 脚本 `User=root` 运行，任何「模拟正式路径」都绕不开修改现网证书文件或篡改脚本读取路径，两者今天全禁。
> 2. **b 不可行**：制造「读不到」需要让脚本读不到正式证书，但 root 必可读（正式路径权限对 root 无意义）；唯一方式是改路径/删文件，那属于「碰现网」。`CERT_OVERRIDE` 已被 D3 用于假输入，再指向不存在的文件仍是假输入，非新证据。
> 3. **a 的缺陷显式接受**：D3 已验证「判据能红」（假证书 → FAIL）；「正式路径读得到、读得对」缺口由**块 B 手工跑 `check-cert`（无覆盖变量）**闭合，零额外动作。3 类即下限也即今日目标（§2.5 止步①）。
>
> 追问①结论：runbook 首查 = **`systemctl start check-cert.service` + `journalctl -u check-cert.service -n 5 --no-pager`**（authoritative，给「该不该报警」的结论）；`openssl x509 -noout -enddate` 降为第二查（确认过期日期本身、解释为什么红）。D3 假输入证据证明「判据逻辑」，块 B 正式路径运行补「读得到、读得对」。追问②不适用（不选 b）。
>
> **P1 定案 = 选 a + 块 B 正式路径验证销账（§6.4）+ runbook 首查用 check-cert。**

### P2（定位顺序）每一类，你打算先看哪一个东西？为什么先看它？

**这是今天的验收句本身，所以必须在注入之前写死**——注入之后再写，写出来的是马后炮不是定位能力。

每类填三样，填进 §6 各类的「注入前预测」段：

1. **首查项**（一条具体命令，不是「看日志」）；
2. **为什么先看它**（它的两种结果各自把范围劈成什么，即 D1 §2.4「排障即二分」）；
3. **第二查**（首查项返回预期结果 / 返回意外结果，分别往哪走）。

> 追问①：类 1（反代配置错）和类 2（端口占用）的**公网表现可能都是 502**。
> 你的首查项能不能在**一步之内**把这两个分开？如果不能，第二查是什么？
> 追问②：D1 Q14 立过一条判据——「五面全 502 + `/health` 200 → Nginx 层」。
> 今天四类里，哪几类会命中这条判据？哪一类会让它**失效**（即它给出的分叉是错的）？

> **答（2026-08-20 块 C 定案）：**
>
> **类 1 与类 2 首查项共用 `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health`，一步劈开两类：**
> - **200** → Nginx 层（Node 正常）→ 类 1 方向：`nginx -t` → `tail /var/log/nginx/error.log` 看 `connect() failed`
> - **非 200** → 应用层（Node 未响应）→ 类 2 方向：`ss -tlnp | grep :3000` → `journalctl -u nodeapp`
>
> 两条链路公网都是 502，但 `/health` 结果不同——**首查本身已一步分开**，无需额外区分命令。与 D1 Q14 判据完全对齐。
>
> **类 3 首查 `df -h /`**：< **3.5G**（2026-08-20 执行期修正，见 §2.3 注）→ 触止步立即清理（MongoDB 同分区）；≥ 3.5G → 转 `free -m` / `journalctl --disk-usage`。
>
> 追问②命中表：
> | 类 | 是否命中「五面全 502 + /health 200 → Nginx 层」|
> |---|---|
> | 类 1 反代配置错 | **命中**（Nginx 进程活 + /health 200 → 确属 Nginx 层）|
> | 类 2 端口占用 | **失效**（Node 起不来，/health 不可能 200 → 判据指向「Nginx 层」是错的，实际在应用层）|
> | 类 3 磁盘满 | **不唯一**（/health 是否 200 取决于探针是否碰 DB → 判据分叉不干净，需 `df` 优先定性）|
>
> 记录注意（P2 review ②）：类 1、类 2 首查是同一命令，但**预期不同**（类 1 预期 200、类 2 预期非 200），定位走向在第二查分叉。

### P3（监控覆盖销账）每一类注入后，四项 check 分别是绿还是红？

D3 证明了四项**能**红。今天要证明的是它们**该红的时候会不会红**。

| 类 | check-app | check-mem | check-disk | check-cert | 预测里全绿吗？ |
|---|---|---|---|---|---|
| 1 反代配置错误 | 待答 | 待答 | 待答 | 待答 | 待答 |
| 2 端口占用 | 待答 | 待答 | 待答 | 待答 | 待答 |
| 3 磁盘满 | 待答 | 待答 | 待答 | 待答 | 待答 |
| ~~4~~ （**P1 选 a：由 D3 覆盖，今日不做**） | — | — | — | — | — |

> 答案见下方定案表（2026-08-20 块 C）。

> 追问①：`check-app` 的三服务判据里有 `nginx`，但它查的是 `systemctl is-active nginx`。
> 类 1 里 Nginx **进程是活的、配置是错的**——这一格你预测是绿还是红？如果是绿，那它意味着什么？
> 追问②：**预测全绿的那一类，就是这套监控的覆盖盲区。** 盲区不是失败，但必须写下来，
> 并回答一句：补它需要加什么判据，代价是什么（D3 §3 P2 已经否掉过「公网五面常驻探针」，理由还成立吗）？

> **答（2026-08-20 块 C 定案）：**
>
> | 类 | check-app | check-mem | check-disk | check-cert | 预测里全绿吗？ |
> |---|---|---|---|---|---|
> | 1 反代配置错误 | 🟢 绿 | 🟢 绿 | 🟢 绿 | 🟢 绿 | **✅ 全绿（盲区）** |
> | 2 端口占用 | 🔴 红 | 🟢 绿 | 🟢 绿 | 🟢 绿 | ❌ 不全绿 |
> | 3 磁盘满 | 🟢 绿* | 🟢 绿 | 🔴 红 | 🟢 绿 | ❌ 不全绿 |
>
> \* 类 3 的 check-app 行依赖块 B 现场确认 `/health` 探针是否碰 DB——碰 DB 则改 🔴（磁盘满时写入失败），不碰则 🟢。**待块 B 事实回填后锁死**。
>
> 追问①判读：**类 1 预测 check-app 绿 = `check-app` 对 Nginx 层「语义错误」完全失明。** 它只查 `systemctl is-active nginx`（进程在不在），三个判据 + `/health` 内网直连 Node 全部绕开公网反代层；反代配置错是「进程活、语义错」，属「服务对外可达性」而非「服务进程可用性」。**这不叫 bug，叫 scope。**
>
> 追问②盲区结论：**盲区类 = 类 1（反代配置错误）**——注入后公网五面 502，但四项 check 全绿，故障只能靠人工访问/用户报障发现。
> 补盲候选（已评估代价）：
> - **本地 Nginx 后端健康检查**（curl 每个 `proxy_pass` 后端，失败告警）——推荐；代价：维护后端列表 + 每次 N 次 curl（<100ms）。**边界（review ②）：抓得住「目标死/无服务」，抓不住「目标活着但指错端口」（curl 返回 200 绿灯、业务 502）；后者兜底证据是 error.log `connect() failed` 里的端口号。**
> - **error.log 异常模式监控**（`grep -c "connect() failed"` 超阈值告警）——定位力最强；代价：解析 + 阈值维护 + 瞬时抖动误报风险。
> - **公网五面常驻探针**——**否决，D3 理由仍成立**：需外部节点；防火墙/限流/网络抖动假阳性；不给「Nginx 层 vs 应用层」定位分叉。
>
> **什么时候做**：今天只记录盲区，不扩 scope；结论写进 D5 runbook「监控覆盖缺口」章节。

### P4（时间尺度与顺序）注入之后，等真实 timer 触发，还是手工跑一次脚本？

四项的频率是四档（D3 §3 P2）：app 每 1 分钟 / mem 每 5 分钟 / disk 每 1 小时 / cert 每 6 小时（§2.0 修正后）。
于是磁盘那一类有一个**执行层才暴露的问题**：注入完，最坏要等 59 分钟 timer 才会说话。

两种做法证明的东西不一样，请逐类选：

| 做法 | 证明了什么 | 没证明什么 |
|---|---|---|
| 手工 `sudo systemctl start check-disk.service` | 判据在真实条件下算得对 | **timer 排程会不会真的把它跑起来**（这一维今天不补，就还是 D3 §9.5 那个坑的同族） |
| 等一次真实触发 | 端到端（排程 → 执行 → journald 可见）全通 | 代价是时间，最坏 59 分钟 |

> 追问①：四类的**执行顺序**怎么排？（提示两个约束：磁盘那一类如果选「等真实触发」，它应该排在什么位置才不浪费那一小时；
> 另一个约束是 §2.2 的「一类没恢复不开始下一类」——这两条会不会打架？）
> 追问②：类 3 的 `fallocate` 一旦落地，`check-disk` 在**下一次排程触发时**会报红，
> 而那一行红会留在 journald 里。你要不要在记录里标出「这条红是演练造的」？不标的话，
> 一周后你自己回看 journald，凭什么分得清演练和真事故？

> **答（2026-08-20 块 C 定案）：**
>
> **① 顺序：类 3（磁盘满）→ 类 1（反代配置错误）→ 类 2（端口占用）。**
> 采用第三种形态——`systemctl list-timers check-disk.timer` 拿 **NEXT 时刻**，注入对准 **NEXT 前 3~5 分钟**，等待期压到分钟级拿到「排程 → 执行 → journald」端到端证据，不浪费 59 分钟，也不用手工触发降级。
>
> **等待期定义**：类 3 注入后至 timer 触发之间的**观察窗口，归属该类「现象收集」子阶段，不算「未恢复」**。期间**不做任何他类的注入或修复**，只做现象观察记录与修复准备（类 3 排最前，没有「前两类」可写，等待期只有 3~5 分钟）；timer 触发、证据到手后立即修复 + 恢复基线，然后才进入下一类。→ 不违反 §2.2 不可拆规则。
>
> **② 演练痕迹要标注，且可追溯**：每类注入/恢复用 `logger -t DRILL "class N started/restored at $(date -u +%FT%TZ)"` 打 tag 标记（review 修正：`logger` 属于调用 shell 会话，不属于 unit，`-u <service>` 过滤看不到——必须 `-t DRILL` 打 tag，回查用 `journalctl -t DRILL`；时间戳用 `date -u` 与 journald UTC 对齐）。回看 journald 时一条 `journalctl -t DRILL` 过滤出全部演练事件，与真事故天然分开。
>
> **执行层约束（review ③）**：类 3 开始时刻受 NEXT 约束（disk timer = 下一个整点）。块 C 结束时看 NEXT：若几分钟内 → 等真实触发；若差半小时+ → 两个选择（等真实触发并写 §6 前两类的根因段，或降级手工触发并在 §6.3 写明降级了什么）——**现场定，不预设**。

### P5（「恢复基线」的判据）恢复到什么程度算恢复？

五面 200 就够吗？今天四类里至少有两类会在**五面全绿之后**仍留下痕迹（配置字节数、临时文件、systemd 单元里的临时行）。

请写死一张**收工核零清单**（比 §2.4 的残留清单更严的那一版，或直接确认 §2.4 那版够用），并回答：

> 追问①：「配置恢复了」用什么证明——肉眼看一遍，还是 `diff` / 字节数 / `md5sum`？
> （W9 的 `shop.bak` 是 424B，那个字节数当时就是拿来当判据用的。）
> 追问②：`journalctl` 里今天会多出一批演练造成的 FAIL 行。它们**算不算残留**？
> 要清掉吗（`--vacuum` 会连同真实历史一起删）还是留着当证据？——这一题的答案会直接写进 runbook。

> **答（2026-08-20 块 C 定案）：**
>
> **五面 200 不够。恢复基线 = 三层基线全绿 + 残留清单逐项核零（§2.4 P5 定案版）。**
>
> 追问①：配置恢复用 **`diff`**（注入后 diff 非空 + 回滚后 diff 空，**双证据对照**；单次回滚后 diff 空是 `cp` 恒真，无区分度）+ 字节数辅助。判据 = `diff` 退出码 0 且无输出。
>
> 追问②：演练 FAIL 行**不算残留，保留、不 vacuum**。理由：`--vacuum` 连真实历史一起删，代价不可接受；演练日志是证据链与 runbook 素材；已有 `logger -t DRILL` 标记可过滤，不影响日常排障。**runbook 结论**：演练产生的 FAIL 行带 DRILL 标签应保留作证据链，日常排障过滤时可忽略该标签；除非磁盘紧迫且轮转已压缩，否则不主动清理。
>
> **P5 修正①（review）**：`.d4bak` 备份**保留在机**（它是今天的还原点），块 H 核零判据 = 与 `shop-ssl` 的 `diff` 为空，不是「删除备份文件」。
>
> **P5 修正③（review）**：`pkill` 匹配串按块 B 实测的 socat / nc 实际进程命令行写，避免匹配不到或误杀。

---

## 4. 今日时间盒

| 块 | 时长 | 内容 | 产出 / 收工判据 |
|---|---|---|---|
| A | 25 min | **前置修正**（§2.0）：改 `check-cert.timer` → `daemon-reload` → restart → `list-timers` 看 NEXT/LAST 间隔销账 → 同步仓库副本 → 展板那一格翻档 | NEXT 与 LAST 相隔 **6 小时**（不是「文件里写对了」）；仓库副本 `diff` 为空 |
| B | 25 min | **基线复位**：三层基线（五面 curl + `/health` + 三服务 `is-active` + 四 timer active）+ 四个 check **手工各跑一次全绿** + 采 `df -h /`、`free -m`、`journalctl --disk-usage` + **确认 socat / nc 哪个已装**（D1 Q13 遗留） | 三层全绿落纸；`fallocate` 大小按今天的 `df` 重算完成；**基线不绿不许注入** |
| C | 30 min | 答 §3 的 P1–P5，回填 §2.3 前置四件事表、§6 各类「注入前预测」段 | 五题有答案；§2.3 四格无空；每类的**首查项与四项 check 预测**都写死了 |
| D | 45 min | **类 3 磁盘满**（P4 定案排最前，注入对准 NEXT 前 3~5 分钟）：注入 → 现象 → 定位 → 根因 → 修复 → 恢复基线；等待期（3~5 min）做现象观察记录与修复准备，不空转 | **§6.1** 五段式填满 + **至少一条命令输出**；timer 真实触发拿到端到端证据；三层基线复绿 + `.bin` 删除 |
| E | 40 min | **类 1 反代配置错误**：注入 → 现象 → 定位 → 根因 → 修复 → 恢复基线 | **§6.2** 五段式填满；`shop-ssl` 与 `.d4bak` 的 `diff` 为空（双证据：注入后非空 + 回滚后空） |
| F | 30 min | **类 2 端口占用**：同上 | **§6.3** 五段式填满；socat/nc 进程无、nodeapp active |
| G | 25 min | **证书类（P1 选 a 已定）**：把「为什么不做」写进 §6.4 + 块 B 的正式路径手工验证结果补进去 + runbook 输入 | §6.4 有一段「为什么不做」且含块 B 的 check-cert 正式路径输出 |
| H | 20 min | **全量回归 + 残留清扫**：三层基线复测 + §2.4 残留清单逐条核零 | 五面 / `/health` / 三服务 / 四 timer 全绿；残留清零有证据（`diff` 为空、`ls` 不存在、`pgrep` 无匹配） |
| I | 25 min | 收口：§10「实际发生了什么」、`week10-plan.md` D4 勾选、`LEARNING-STATE.md`、口语稿、commit | commit；D4 收口 |

合计约 **4 小时 15 分**。

**块 D–G 是今天的主场。时间不够时砍的顺序**：
第 4 类（P1 若选 a 本来就不做）→ 把「等真实触发」降级成手工触发（**并在 §6 写明降级了什么**）→ 块 G。
**块 A 和块 H 一步都不许砍**：A 是今天全部证据的信任基础，H 是这台唯一生产机今晚能不能安稳过夜的判据。

---

## 5. 执行细节（白名单部分，只放语法与工具行为）

> 本节只放**换个发行版 / 换个反代就不成立**的纯工具细节。
> **注入方式、止步值、回滚命令一律来自契约 §5.4，定位顺序与根因推理由 §3 与 §6 的答案决定，不在这里新造。**

### 5.1 timer 频率的可证伪校验（块 A 用）

```bash
# 归一化 + 看相邻触发间隔：分母落在哪一位，一眼可见
systemd-analyze calendar '*-*-* *:0/6'    # → 相邻 6 分钟（D3 写错的那个）
systemd-analyze calendar '0/6:00:00'      # → 相邻 6 小时（要的那个）

sudo systemctl daemon-reload
sudo systemctl restart check-cert.timer
systemctl list-timers check-cert.timer    # 销账看这里的 NEXT 与 LAST 间隔
```

> 经验知识（`AGENTS.md` §4）：`systemd-analyze calendar` 会打印 `Normalized form` 与随后几次 `Next elapse`，
> **不需要等到真触发就能证伪频率**。这正是 8/19 当天没抓到那个坑的原因——验证 ⑦ 看的 NEXT/LAST 在频率错时长得一模一样。

### 5.2 三层基线复位（块 B / 每类结束 / 块 H 各跑一次）

```bash
# 第 1 层：五个公网面
curl -s -o /dev/null -w '80      %{http_code}\n' http://43.128.154.242/
curl -sS -o /dev/null -w '443api %{http_code} ssl=%{ssl_verify_result}\n' https://43-128-154-242.sslip.io
curl -s -o /dev/null -w '443admin %{http_code}\n' https://43-128-154-242.sslip.io/admin/
curl -s -o /dev/null -w '8080    %{http_code}\n' http://43.128.154.242:8080/
curl -s -o /dev/null -w '8081    %{http_code}\n' http://43.128.154.242:8081/

# 第 2 层：服务器内部（Node 直连，绕开 Nginx）
curl -s -o /dev/null -w 'health  %{http_code}\n' http://127.0.0.1:3000/health

# 第 3 层：进程与排程
systemctl is-active nginx nodeapp mongod
systemctl is-active check-app.timer check-mem.timer check-disk.timer check-cert.timer
```

### 5.3 四类的注入与还原骨架（**引自契约 §5.4，不新增**）

```bash
# ── 类 1 反代配置错误（A 档）
sudo cp /etc/nginx/sites-available/shop-ssl /etc/nginx/sites-available/shop-ssl.d4bak
sudo sed -i 's#proxy_pass http://127.0.0.1:3000;#proxy_pass http://127.0.0.1:9999;#' <目标 location 段>
sudo nginx -t && sudo systemctl reload nginx        # -t 非零则止步，绝不 reload
# 还原：
sudo cp /etc/nginx/sites-available/shop-ssl.d4bak /etc/nginx/sites-available/shop-ssl
sudo nginx -t && sudo systemctl reload nginx

# ── 类 2 端口占用（A 档）；块 B 先确认 socat / nc 哪个已装
sudo systemctl stop nodeapp
socat TCP-LISTEN:3000,bind=127.0.0.1,fork /dev/null &   # 或 nc -l 127.0.0.1 3000
sudo systemctl start nodeapp                            # 预期失败
# 还原：
pkill -f 'TCP-LISTEN:3000' ; sudo systemctl start nodeapp ; systemctl status nodeapp

# ── 类 3 磁盘满（B 档）；大小按块 B 实测 df 重算，不照抄 26.5G
df -h /                                             # 注入前实测，写进 §2.3 ①
sudo fallocate -l <重算值>G /tmp/disk-fill.bin
df -h /                                             # 立刻复量，低于 3.5G（执行期修正）立即止步
# 还原：
sudo rm -f /tmp/disk-fill.bin && df -h /

# ── 类 4 形态待 §3 P1 拍板；下面是契约原文的假证书路线（D3 已用过同一手法，见 P1）
openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/test.key -out /tmp/test.crt -days 10 -subj '/CN=drill'
# 还原：
rm -f /tmp/test.crt /tmp/test.key
```

### 5.4 定位用只读命令速查（按层排，**排哪一条先跑是 §3 P2 的答案，不在这里预设**）

```bash
# 反代层
sudo nginx -t                                   # 配置语法（注意：语法对 ≠ 语义对，D3 §9.5 同族）
sudo tail -n 30 /var/log/nginx/error.log        # connect() failed / no live upstreams
sudo grep <requestId> /var/log/nginx/access.log # D2 的 obs 格式，时间戳带 +08:00

# 应用层
journalctl -u nodeapp -n 50 --no-pager          # NDJSON，时间戳 Z（UTC）
journalctl -u nodeapp -n 50 --no-pager | grep <requestId>
systemctl status nodeapp

# 监听与端口
ss -tlnp | grep -E '3000|27017|80|443|8080|8081'

# 资源
df -h / ; free -m ; journalctl --disk-usage

# 证书（只读，绝不写）
openssl x509 -noout -enddate -in /etc/letsencrypt/live/<domain>/fullchain.pem

# 四项检查现在怎么说（手工触发一次 + 看它写了什么）
sudo systemctl start check-disk.service
journalctl -u check-disk.service -n 5 --no-pager
systemctl list-timers --all | grep check-
```

> 经验知识两则（`AGENTS.md` §4，真实遇过一次才知道）：
> ① `Type=oneshot` 的 unit 正常跑完是 `Deactivated successfully`，失败是 `Failed with result exit-code`——
> 演练时这两句就是「检查跑了且绿」与「检查跑了且红」的分界，`systemctl is-active` 看不出来。
> ② `list-timers` 默认只列 active 的；`--all` 才含 inactive，而**停掉的 timer 表现为 NEXT=n/a 而不是那一行消失**（D3 验证 ⑧ 实测）。

---

## 6. 四类演练的五段式记录（当天现场填，每类一份）

> 形态按 `LEARNING-PROTOCOL.md` §4：先写预测，再写实际，**偏差显式留痕**。
> 「证据」不是转述，是**贴一段命令输出**。根因段必须标 **事实 / 推断 / 未验证**。

### 6.1 类 3：磁盘满（B 档 · P4 定案第一个做）

**注入前预测（块 C 已写，2026-08-20 定案，注入前不许改）**

- 首查项 + 为什么先看它：`df -h /`。结果劈成两半：可用 < **3.5G**（执行期修正，见 §2.3 注）→ 触止步，立即清理（MongoDB 同分区）；≥ 3.5G → 磁盘不是根因，转 `free -m` / `journalctl --disk-usage`。
- 第二查（首查返回预期 / 返回意外，分别往哪走）：< 3.5G → `ls -lh /tmp/` 看 `disk-fill.bin`、`du -sh /var/log/*` 看日志方向；≥ 3.5G → `free -m`（内存旁证，今天不做 OOM）。
- 预测的首个症状：公网五面照常 200（Node 内存态能响应，`/health` 探针不碰 DB——块 B 已确认）；**check-disk 在整点排程触发时报红**（FAIL 行留 journald，P4 用 `logger -t DRILL` 标记演练边界）。
- 四项 check 预测（app / mem / disk / cert）：app 🟢 / mem 🟢 / disk 🔴 / cert 🟢（**块 B 已确认 `/health` 纯内存不碰 DB → 锁死**）
- 前置四件事四格已核：☐（①还原点=avail 31G（14:04 入场确认字节级 32,584,179,712B）②14:04 三层基线全绿（五面+health 200 + 7 active）③止步 < 3.5G ④`rm -f /tmp/disk-fill.bin`——注入前逐格打勾）
- **第二轮注入事实（2026-08-20 更新）**：NEXT=**15:00:00 CST**（LAST=14:00:01，14:04 入场确认）；注入窗口 14:55–14:57；注入量 **fallocate -l 26.4G**（§10.3 校准定论）；目标注入后 `df -BG` 显示 3G、字节级 ≈3.9 GiB。

**① 注入**（命令 + 时刻）
```text
# 14:55（注：输出为 15:00 前的准备阶段实测）
$ df -B1 /
/dev/vda2  42156257280  7736942592  32577454080  20% /
$ logger -t DRILL "class 3 started at $(date -u +%FT%TZ)"
$ sudo fallocate -l 26.4G /tmp/disk-fill.bin
$ df -h / && df -B1 /
/dev/vda2  40G  34G  3.9G  90% /
/dev/vda2  42156257280  36191154176  4123242496  90% /
```
→ 注入后字节级 avail = **4,123,242,496 B ≈ 3.84 GiB**（`df -h` 显示 3.9G），落在计划区间 3.5~4G ✅，未触止步②（> 3.5 GiB）。

**② 现象**（**至少一条命令输出**）
```text
# 15:00:01 timer 真实触发（端到端：排程→执行→journald 打通）
$ journalctl -u check-disk.service -n 5 --no-pager
Aug 20 15:00:01 VM-0-5-ubuntu check-disk.sh[2137177]: {"check":"disk","subsystem":"disk","status":"OK","ts":"2026-08-20T15:00:01+08:00","host":"VM-0-5-ubuntu","action":"","detail":"device=/dev/vda2 total=40G used=34G avail=4G use=90% >= 4G threshold"}
Aug 20 15:00:01 VM-0-5-ubuntu systemd[1]: check-disk.service: Deactivated successfully.
```
→ **timer 真实触发 + 服务执行 + journald 可见 = 端到端打通（预期一部分达成）**；但 `status=OK`、`avail=4G` —— **不是 FAIL，没红**（预期落空）。

**③ 定位**（我实际先看的是什么、看到什么、它把范围劈成了什么、下一步走哪边）
- 注入后首查 `df -h /` + `df -B1 /`：avail = 3.84 GiB，落在计划区间 → 磁盘占用符合预期，占位文件是唯一嫌疑（`ls -lh /tmp/disk-fill.bin` 确认）。
- 15:00:01 timer 触发后查 `journalctl -u check-disk.service`：**第一次看到 OK 而非 FAIL** → 把范围劈向「判据口径」而非「注入量/止步」——avail 够低（3.84 GiB < 4 GiB 字节级）但脚本判绿。
- 第二查 `check-disk.sh`（读脚本）：判据 = `df -BG /` 的 avail **整数** `< 4`。3.84 四舍五入成 **4** → `4 < 4` 假 → OK。范围锁定：**不是注入不够，是脚本取整口径**。

**④ 根因**
- 事实：`df -BG`（GNU df 块大小输出）对 4,123,242,496 B / 1 GiB = 3.84 显示为 **4G（四舍五入）**；脚本整数判据 `4 < 4` 为假 → OK。字节级 avail 3.84 GiB **确实低于 4 GiB**，但显示口径把它抬回了 4G。
- 推断：GNU coreutils `df` 在 `-B` 指定块大小时**四舍五入到最近整块**（非向下取整）。这是工具行为，非脚本逻辑错误——脚本按「显示值」判，显示值按「四舍五入」给，两者叠加形成盲区。
- 未验证：coreutils 文档对 `-B` 取整规则的精确表述（可用 `df -BG --output=avail /` 与 `df -B1 --output=avail /` 对照验证显示关系）。
- **推论（关键）**：要让 `df -BG` 显示 ≤3G（必红），字节级 avail 须 **< 3.5 GiB**（四舍五入边界）——这落在止步②（< 3.5G 止损）之内。**「守止步线」与「让 check-disk 红」在当前实现下互斥** → check-disk 在合法注入区间**永远报绿**。与上午「契约区间为空」同族：整数阈值 + 四舍五入单位 = 语义盲区。

**⑤ 修复 + 恢复基线**（回滚命令实际执行结果 + 三层基线复测输出）
```text
$ sudo rm -f /tmp/disk-fill.bin && df -h /
/dev/vda2  40G  7.3G  31G  20% /
```
→ 回 31G（20%）✅；演练残留清零（`/tmp/disk-fill.bin` 已删）。
```text
# 三层基线复测（15:07，类 3 后）
80 200 · 443api 200 ssl=0 · 443admin 200 · 8080 200 · 8081 200 · health 200
nginx active · nodeapp active · mongod active
check-app.timer active · check-mem.timer active · check-disk.timer active · check-cert.timer active
ls /tmp/disk-fill.bin → No such file
ss -tlnp | grep :3000 → LISTEN 127.0.0.1:3000（nodeapp 自身，非残留）
```
→ 类 3 恢复基线完成，可进入下一类。

**⑥ 预测 vs 实际**（差在哪、为什么差；四项 check 的实测表态与 P3 预测的差异 → **盲区写这里**）
- **P3 预测类 3：disk 🔴（必红）→ 实测 🟢（不红）。偏差根因 = ④ 的取整盲区**，不是注入量不足、也不是 `/health` 探针问题。
- **端到端证据部分达成**：15:00:01 timer 真实触发 + 服务执行 + journald 可见（排程→执行→日志链全通）。但 **FAIL 行未取得** —— 卡在判据口径，非 `Persistent`/频率问题（D3 §9.5 同族已排除）。
- **新盲区（比 P3 更深的发现）**：check-disk 的「红」需要 avail < 3.5 GiB ≈ 止步线本身 → **这条告警线在本演练的合法止步区间内永不触发**。runbook 必须写明：check-disk 的 `df -BG` 四舍五入 + 整数阈值，导致「磁盘将满但 avail∈[3.5,4.0) GiB」时静默绿。补法候选（不扩 scope，留给 D5）：脚本阈值判据改用字节级（`df -B1`）或 `df -BG | awk` 小数比较；或把触发红所需 avail 与止步线解耦。
- **服务器现状**：`rm` 后回 31G，基线可能仍全绿（五面/health 复测待本人补）。

**⑦ 收口拍板（2026-08-20 15:06，本人选 A）——类 3 = 端到端打通 + 发现盲区，缺 FAIL 行但满足验收**
- 理由链（本人，AI review 无阻断）：
  1. **端到端链已打通**：15:00 timer 真实触发 + `check-disk.service` 执行 + journald 记录（排程→执行→journald 全通），P4 验证目标达成。
  2. **「该红不红」本身就是发现**：真故障（磁盘逼近告警线）在合法注入区间内永不红，因 `df -BG` 四舍五入 3.84G→4G + 判据 `>=4G` 绿 → **直接给出 D3→D4 追问① 的答案：假输入能红 ≠ 真条件该红，且有活证据**。
  3. **不降止步线（否 B）**：降 3.0G 需再注入 + 等下一窗口（16:00），时间盒不允许；且今天追求的是验证监控覆盖，已验到缺口。
  4. **不手工触发（否 C）**：端到端已到手，手工只验判据无增量。
- **三层事实拆解（本人）**：
  - 故障条件确实达成：注入后字节级 avail 3.84 GiB **< 4 GiB 阈值**，客观上是真实生产级故障条件。
  - 系统没报红：`df -BG` 四舍五入 3.84→4G，判据 `4>=4` 真 → OK。**这不是没发生故障，是发生了但监控因实现缺陷看不见**。
  - 结论：「故障条件已达成但监控覆盖失败」——正是验收句「真故障来了会不会红」的答案：**不会红，因为代码写错了**。
- **为什么 B 方案的 FAIL 行价值更低**：压到 3.0G 拿到 FAIL = 假阳性验证（D3 已做）；3.84G 不红 = **真阴性失效**——后者才是今天要抓的东西。若不知道这个灰色地带，明天生产用到 3.8G 时监控依然绿、磁盘继续写、直到 `fallocate` 报 `No space left` 才发现。
- **盲区去向**：**D5 runbook「监控盲区」章节**（非 `DEBT.md`——本次是学习发现成果，无 AI 援助欠债）；补法候选：`check-disk.sh` 判据改字节级（`df -B1` 直接与 4GB 比较）。
- 类 3 验收判据销账：类数✅ / 有证据✅（注入+15:00 journald OK 行）✅ / 定位顺序✅ / 事实分层✅ / 监控表态预测 disk🔴→实测🟢 偏差已归因✅——「该红不红」正是预测偏差的最大价值点。

### 6.2 类 1：反代配置错误（A 档 · P4 定案第二个做）

**注入前预测（块 C 已写，2026-08-20 定案，注入前不许改）**

- 首查项 + 为什么先看它：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health`（与类 2 共用）。预期 **200** → Nginx 层（Node 正常）→ `nginx -t` → `tail /var/log/nginx/error.log`；非 200 → 应用层方向。一步劈开「反代层 vs 应用层」，与 D1 Q14 判据对齐。
- 第二查（首查返回预期 / 返回意外，分别往哪走）：200 → `nginx -t`（语法）→ `tail /var/log/nginx/error.log` 看 `connect() failed`；非 200 → `ss -tlnp | grep :3000` → `journalctl -u nodeapp`。
- **注入目标（2026-08-20 14:13 本人拍板）**：改 **13 行 `location = /`** 的 `proxy_pass` → `http://127.0.0.1:9999;`。理由：根路径访问频次最高、502 最直观；`/auth` `/reports` 保持正常 → 体现「部分 location 失效、其他正常」的反代配置典型特征；定位链路完整。
- **预测的首个症状（拍板版，与契约「五面 502」有显式偏差）**：**443 根路径** `https://43-128-154-242.sslip.io/` → **502**；`/auth` `/reports` 仍 200；`/health` 仍 200；80/8080/8081 面不受影响仍 200。偏差归因：契约原文「五面全 502」对应全改 3 处，本拍板只改 1 处（`= /`），受害面收敛为 443 根路径——定位目标（验证定位顺序）不受影响，偏差写 §6.2 ⑥。
- 四项 check 预测（app / mem / disk / cert）：app 🟢（进程活，`is-active` 看不见配置语义错）/ mem 🟢 / disk 🟢 / cert 🟢 —— **全绿 = 覆盖盲区**（P3 追问②；本类注入后 443 根路径 502 但四项全绿，盲区实锤）
- 前置四件事四格已核：☐（①还原点=`shop-ssl` 1251B + `.d4bak` 待建 ②基线=注入前快照 ③`nginx -t` 非零即止 ④恢复 `.d4bak` → `nginx -t` → reload）

**① 注入（命令 + 时刻）**
```text
$ sudo cp /etc/nginx/sites-available/shop-ssl /etc/nginx/sites-available/shop-ssl.d4bak
1251 /etc/nginx/sites-available/shop-ssl.d4bak
$ logger -t DRILL "class 1 started at $(date -u +%FT%TZ)"
$ sudo sed -i '13s#proxy_pass http://127.0.0.1:3000;#proxy_pass http://127.0.0.1:9999;#' /etc/nginx/sites-available/shop-ssl
$ sudo nginx -t                                    # 语法 ok（语义错要 error.log 才见）
$ sudo systemctl reload nginx
```
**② 现象（至少一条命令输出）**
```text
443root 502       # ✅ 命中预测
health  200       # ✅ 命中预测（首查劈开：Node 正常 → Nginx 层）
443auth  404      # ❌ 预测 200，实测 404
443reports 404    # ❌ 预测 200，实测 404
$ sudo tail -n 5 /var/log/nginx/error.log
2026/08/20 15:09:29 [error] 2139567#2139567: *8109 connect() failed (111: Unknown error) while connecting to upstream, client: 43.128.154.242, server: 43-128-154-242.sslip.io, request: "GET / HTTP/1.1", upstream: "http://127.0.0.1:9999/", host: "43-128-154-242.sslip.io"
```
→ **error.log 铁证：`upstream: "http://127.0.0.1:9999/"` + `connect() failed (111)`**——反代语义错误的可检索证据链完整。
**注入态四项 check 实测（11:57，盲区判据 5 正解——此刻注入存续、443root=502）**：
```text
check-app.service: Deactivated successfully   # 绿 ✅（进程活，看不见反代语义错）
check-mem.service: Deactivated successfully   # 绿 ✅
check-disk.service: Deactivated successfully  # 绿 ✅
check-cert.service: Deactivated successfully  # 绿 ✅
```
→ **四项 check 全绿（Predict 全中）= 盲区实锤**：反代配置错（443root 502）在注入态全部绿灯，故障只能靠人工访问/error.log 发现。

**③ 定位（实际先看的 + 偏差归因）**
- 首查 `/health` = 200 → 命中「Node 正常 → Nginx 层」；`nginx -t` 通过（语法对语义错）→ `error.log` 见 `upstream http://127.0.0.1:9999/` + `connect() failed` → 范围锁定 proxy_pass 目标错误。✅ 定位链路符合预测。
- **偏差（auth/reports 404）归因（只读验证 15:10）**：
  ```text
  node/auth 404 · node/auth/login 404 · node/reports 404 · node/reports/monthly-sales 401
  443root 仍 502（注：25/31 行 proxy_pass 未动、原样透传）
  ```
  → **Node 直连裸前缀就是 404**（应用无裸 200 端点；`/reports/monthly-sales` 401 证明真实路由带路径）。公网 443auth/reports 404 = 应用自身路由响应，**非注入所致**。预测「200」把「上游可达」误当「上游返回 200」——**先验缺失型偏差：应先探 Node 直连各前缀真实状态码**。

**④ 根因**
- 事实：13 行 `proxy_pass` 改指 `127.0.0.1:9999`（无监听）→ Nginx `connect() failed (111)` → 443 根 502；25/31 行未动。
- 推断：「进程活、语法对、语义错」——`nginx -t` 只验语法不验上游可达性。
- 未验证：Node `/auth` 404 是否「无斜杠 vs 有斜杠」路由语义（`/auth/login` 亦 404 佐证非真实路由；`/reports/monthly-sales` 401 反向佐证）。

**⑤ 修复 + 恢复基线（diff 双证据 + 恢复验证）**
```text
$ sudo diff shop-ssl shop-ssl.d4bak; echo "注入后 diff 退出码=$?"
13c13
<         proxy_pass http://127.0.0.1:9999;
---
>         proxy_pass http://127.0.0.1:3000;
注入后 diff 退出码=1        # 注入面差异确认 ✅（13 行 9999 vs 3000）
$ sudo cp /etc/nginx/sites-available/shop-ssl.d4bak /etc/nginx/sites-available/shop-ssl
$ sudo nginx -t && sudo systemctl reload nginx   # 语法 ok + 已 reload
$ sudo diff shop-ssl shop-ssl.d4bak; echo "回滚后 diff 退出码=$?"
回滚后 diff 退出码=0        # 恢复确认 ✅（与还原点一致）
$ curl -s -o /dev/null -w '443root %{http_code}\n' https://43-128-154-242.sslip.io/
443root 200                # ✅ 恢复基线
$ logger -t DRILL "class 1 restored at $(date -u +%FT%TZ)"
```
→ **类 1 恢复基线完成**：diff 双证据（注入后=1 / 回滚后=0）+ 443root 200。

**⑥ 预测 vs 实际（偏差显式留痕）**
- 命中：443root=502 ✅ / health=200 ✅ / 定位链路（/health→nginx -t→error.log upstream 9999）✅ / **注入态四项 check 全绿 = 盲区实测实锤**（P3 预测 app🟢/mem🟢/disk🟢/cert🟢 全中）✅。
- 偏差：443auth/reports 预测 200 → 实测 404。归因 = 应用真实路由形态（裸前缀 404），非注入影响；**先验缺失型偏差**（应先 Node 直连探各前缀）。
- **盲区结论（实锤版）**：反代配置错误（443root 502）在注入态四项 check 全绿——「服务进程可用性」与「服务对外可达性」的 scope 分离被实测坐实。补法已列 P3 追问②（本地后端健康检查 / error.log 模式监控，公网探针否决），留 D5 runbook。
类 1 **完整闭环**！逐条对照：

| 环节 | 证据 | 结果 |
|---|---|---|
| **现象** | 443root=502 + error.log `upstream 9999` + `connect() failed`；health=200 | ✅ 命中预测（定位链完整）|
| **偏差** | 443auth/reports=404 非注入（Node 直连裸前缀本就 404） | 先验缺失型偏差，已归因 |
| **盲区判据 5** | 注入态四项 check 全 `Deactivated successfully` | **全绿实锤**（P3 预测全中）|
| **diff 双证据** | 注入后=1 / 回滚后=0 | ✅ 修复闭合 |
| **恢复** | 443root=200 | ✅ 基线恢复 |

§6.2 已完整（①~⑥）。现在**类 2 端口占用**收尾。执行链（nc 后台化已备）：

```bash
# ① 打标记
logger -t DRILL "class 2 started at $(date -u +%FT%TZ)"

# ② 停 nodeapp
sudo systemctl stop nodeapp

# ③ nc 后台抢占 3000（前台会阻塞，必须 &）
nc -l 127.0.0.1 3000 &
sleep 0.5
ss -tlnp | grep :3000        # 确认被 nc 占（PID 变了）

# ④ 启动 nodeapp → 预期失败
sudo systemctl start nodeapp
systemctl status nodeapp --no-pager | head -5

# ⑤ 首查（预期非 200 → 应用层）
curl -s -o /dev/null -w 'health %{http_code}\n' http://127.0.0.1:3000/health

# ⑥ 应用层证据
journalctl -u nodeapp -n 8 --no-pager          # 应见 EADDRINUSE

# ⑦ 修复（按实际进程命令行 pkill）
pkill -f 'nc -l 127.0.0.1 3000' ; sleep 0.5
sudo systemctl start nodeapp
systemctl status nodeapp --no-pager | head -5   # 应为 active
curl -s -o /dev/null -w 'health %{http_code}\n' http://127.0.0.1:3000/health
logger -t DRILL "class 2 restored at $(date -u +%FT%TZ)"
```

把输出贴回我记录 §6.3（尤其 ④ 的 failed 态、⑥ 的 EADDRINUSE、⑦ 恢复）。注意：③ 的 nc 是**前台阻塞命令**，你在交互终端里敲 `nc -l ... &` 后应立即能看到提示符；④ 启动 nodeapp 时若 nc 还活着应报 EADDRINUSE。

### 6.3 类 2：端口占用（A 档 · P4 定案第三个做）

**注入前预测（块 C 已写，2026-08-20 定案，注入前不许改）**

- 首查项 + 为什么先看它：同上 `/health`（与类 2 共用）。预期 **非 200** → 应用层 → `ss -tlnp | grep :3000` 看占用。
- 第二查（首查返回预期 / 返回意外，分别往哪走）：`ss` 有 3000 → 记录 PID/进程名，pkill → `systemctl start nodeapp` 验证；`ss` 无 3000 → `journalctl -u nodeapp -n 30` 看 Node 自身报错（EACCES 等）。
- 预测的首个症状：公网五面 502 + `/health` 非 200（Node 起不来，3000 被 socat/nc 占）；`systemctl status nodeapp` 终态 **failed**（stop → start 因 EADDRINUSE 失败，经验知识，非 inactive）。
- 四项 check 预测（app / mem / disk / cert）：app 🔴（nodeapp `is-active` 非 active + `/health` 非 200）/ mem 🟢 / disk 🟢 / cert 🟢
- 前置四件事四格已核：☐（①还原点=nodeapp active PID 1476211 + 占用工具 `/usr/bin/nc`（14:10 确认）②基线=注入前快照 ③journald 见 `EADDRINUSE`/抢占 PID 可杀 ④`pkill -f 'nc -l 127.0.0.1 3000'` → `sudo systemctl start nodeapp` → `status`）
- **注入细节（白名单语法，2026-08-20 14:15 备）**：`nc -l 127.0.0.1 3000` 是 OpenBSD netcat 的「监听指定地址:端口」形态，**前台阻塞，必须后台化** `nc -l 127.0.0.1 3000 &`；pkill 匹配串按实际命令行逐字写，避免匹配不到或误杀（P5 修正③）。

**① 注入（两次尝试，命令 + 时刻）**
```text
# 第一次（15:13，nc -l 不带 -k）：
$ nc -l 127.0.0.1 3000 &
[1] 2140767
$ ss -tlnp | grep :3000
LISTEN ... users:(("nc",pid=2140767,fd=3))      # ✅ nc 占住 3000
$ sudo systemctl start nodeapp                  # ❌ 预期 failed，实际 active
# 第二次（15:22，nc -l -k 扛多次连接）：
$ nc -l -k 127.0.0.1 3000 &
[1] 2143053
$ ss -tlnp | grep :3000
LISTEN ... users:(("nc",pid=2143053,fd=3))      # ✅ nc -k 占住 3000
$ sudo systemctl start nodeapp                  # ❌ 又是 active，无 EADDRINUSE
```

**② 现象（至少一条命令输出）**
```text
# 第一次后 nodeapp 状态（15:14）：
● nodeapp.service ... Active: active (running) since Thu 2026-08-20 15:14:00 CST; 17ms ago
  Main PID: 2140802 (node)                       # ❌ 不是 failed！
# journald（15:14）：
node[2140802]: {...,"msg":"服务运行端口: 127.0.0.1:3000"}   # 只报 listen，无 EADDRINUSE
# 但 health 探测：
$ curl -s -o /dev/null -w 'health %{http_code}\n' http://127.0.0.1:3000/health
health 000                                        # 连接失败（无服务在 3000）
# 第二次后（15:22）同样：active + 无 EADDRINUSE + health 000
```

**③ 定位（实际走通 + 意外）**
```
首查 /health → 非 200（000）→ 应用层方向
→ ss -tlnp | grep :3000 → nc 占着（第一次 nc 随后被探针消耗退出，第二次 -k 仍在）
→ journalctl -u nodeapp → 无 EADDRINUSE、无错误，只有「服务运行端口」
→ /proc/PID/fd → 有 socket fd 但 ss 无监听、curl refused
→ 归因：nodeapp 进程活着（active）但 listen 未生效 = 「假 active」
```
- 定位链**符合预测方向**（/health→ss→journalctl），但**现象偏离**：预期「failed + EADDRINUSE」，实测「active + 无监听 + health 000」。
- **第一次归因（15:14～15:18 实测）**：`nc -l`（OpenBSD）默认 **accept-once**，check-app timer（每 1 分钟探 `/health`）消耗连接后 nc 退出 → 3000 释放 → nodeapp bind 成功变 active（无冲突）。→ 换 `-k`（Keep inbound sockets open for multiple connects，15:20 确认支持）。
- **第二次归因（15:22～15:24 实测）**：nc -k 持续占 3000，nodeapp 仍**无 EADDRINUSE、无监听、health 000**——排除「nc 退出释放」后，剩余解释 = **nodeapp 的 listen 错误被应用吞掉**（进程不退出、日志只报「服务运行端口」但 socket 未生效）。

**④ 根因（标推断——待读 server.js 确认，黑名单 W6）**
- 事实（实测）：nc 占 3000 时 nodeapp `Stop→Start` 后 **systemd active** + journald **无 EADDRINUSE/无失败日志** + `ss` **无 3000 监听** + `health`=000（Connection refused）+ `/proc/fd` 有 socket 但未监听。
- 推断：`server.js` 的 `listen()` 回调或 `server.on('error')` 未妥善处理 EADDRINUSE——端口冲突时进程保持运行但不建立监听（「假活」）。**需读 server.js 确认（黑名单知识，D5 延迟自测题目）**。
- 未验证：错误处理分支的实际代码形态（未读 server.js——按纪律不在本类收口时越权改读）。

**⑤ 修复 + 恢复基线（L2 服务层回滚）**
```text
$ sudo systemctl restart nodeapp && sleep 1
health 200                                        # ✅ 恢复
LISTEN 0 511 127.0.0.1:3000 ...                   # ✅ 3000 监听恢复（PID 2142555）
$ logger -t DRILL "class 2 aborted-restored at $(date -u +%FT%TZ)"
```
→ `restart` 后 nodeapp 正常监听（健康），基线恢复。

**⑥ 预测 vs 实际 + 收口拍板（D5 延迟自测）**
- **预测偏离**：预期「failed + EADDRINUSE」→ 实测「active + 无监听 + health 000」。「假 active」是本次演练最有价值的发现——**systemd active 不等于能服务**。
- **P3 预测类 2 app 🔴 未实测**（未走到四 check 复测阶段即中止）——补进 D5 延迟自测。
- **收口（2026-08-20 15:26 本人选 D）**：暂停类 2，排 D5 延迟自测再补。理由（三层）：① 定位链（/health→ss→journalctl→fd）已走通，验收句「定位顺序」达成；② 三个独立故障模式已暴露（df -BG 阈值盲区/check-app scope 盲区/**nodeapp 假活错误处理盲区**），密度超预期；③ 读 server.js 确认 EADDRINUSE 被吞属黑名单知识（W6 错误边界），正适合 D5 延迟自测「不看笔记从现象推理应用吞错」。
- **D5 问题库输入**：从「nc 占 3000 但 nodeapp active + health 000」现象，能否推理出 listen 错误被吞，并给出修复建议（读 server.js 定位 listen 错误处理分支）。

### 6.4 证书类：为什么不做（P1 选 a —— 由 D3 覆盖）

**P1 定案结论**：契约 §5.4 第 4 类「证书过期（判定逻辑模拟）」的注入方式与 D3 §9.2 ⑤ 已执行的手法相同（假证书 + `CERT_OVERRIDE`），D4 重复即无新证据；「走正式路径」与止步⑤「现网证书只读」冲突（root 必可读 + 硬编码路径使任何模拟都绕不开碰现网）。故 D4 不做证书类。

**已确认的缺口与闭合方式**：
- D3 已验证「判据能红」：假证书 → FAIL → `rm` → 绿（假输入证据）。
- 「正式路径读得到、读得对」：D4 块 B 手工跑 `check-cert.service` 正式路径（不带 `CERT_OVERRIDE`）→ **实测全绿（11:43:55）**，journald 证据（2026-08-20 回填）：
  ```text
  Aug 20 11:43:55 VM-0-5-ubuntu systemd[1]: Starting Check certificate remaining days...
  Aug 20 11:43:55 VM-0-5-ubuntu check-cert.sh[2090669]: Certificate will not expire
  Aug 20 11:43:55 VM-0-5-ubuntu check-cert.sh[2090666]: {"check":"cert","subsystem":"cert","status":"OK","ts":"2026-08-20T11:43:55+08:00","host":"VM-0-5-ubuntu","action":"","detail":"Certificate valid for more than 15 days (checkend OK)"}
  Aug 20 11:43:55 VM-0-5-ubuntu systemd[1]: check-cert.service: Deactivated successfully.
  Aug 20 11:43:55 VM-0-5-ubuntu systemd[1]: Finished Check certificate remaining days.
  ```
  - **时间戳口径观察（runbook 输入）**：脚本 NDJSON 的 `ts` 是 `+08:00`（本地时区 ISO 8601，由 `date --iso-8601=seconds` 产生），与 D2 定案「日志统一 UTC」不同——这是 D3 既有实现，今天不改（§7），排障时需知 check-cert 的时间戳是 CST 非 UTC，避免误判为 bug。
  - **stderr 混入确认**：`Certificate will not expire` 是 openssl 写 stderr 混入 NDJSON 流（§10.2 非阻断复现），`systemd[1]` 的 `Deactivated successfully` 证明退出码 0（绿）。
- **runbook 首查命令**：`systemctl start check-cert.service` + `journalctl -u check-cert.service -n 5 --no-pager`（authoritative，给结论）；`openssl x509 -noout -enddate -in <fullchain.pem>` 作第二查确认日期、解释为什么红。

---

## 7. 今日明确不做

- 不改 `app.js` / `server.js` 一行——今天的所有现象都要来自**外部条件**，不是改代码造出来的。
- 不改四个 check 脚本的任何阈值常量或 `HEALTH_URL`——那是 D3 的弄红手法，重复即无新证据（D3 §3 P5 追问①）。
- 不做 OOM 那一类（契约 Q12 已把它排除出主线；`week10-plan.md` §3.1 C 档：2 GB / swap=0 的生产机上做等于自伤）。
- 不做证书类演练（**P1 选 a**：契约 §5.4 第 4 类的注入手法已被 D3 §9.2 ⑤ 用掉，重复即无新证据；走正式路径与止步⑤「现网证书只读」冲突）。正式路径验证改为块 B 手工跑 `check-cert`（无覆盖变量），见 §6.4。
- 不碰现网证书：不撤销、不重签、不改 `/etc/letsencrypt/live/`，不停 80（W9 已证：关 80 = 断续期硬依赖）。
- 不写 runbook 正文——那是 D5 A 模块。今天只**给它攒素材**（每类的「首查命令 / 判定分叉 / 预防」是 runbook 的三列输入）。
- 不建 Prometheus / Grafana（stretch，受内存闸门约束）；不接 webhook 告警通道（D1 Q11 已降 stretch）。
- 不动 8080 下线、不动展板内容（只允许块 A 那一格翻档）、不碰 Java / Python。
- 不在演练里顺手修任何「看着不顺眼」的东西——今天的改动清单只有 §2.1 那八项。

---

## 8. AI 协作边界（本日形态）

| 事项 | 归属 | AI 上限 |
|---|---|---|
| 注入 / 回滚 / 只读定位命令的**语法与工具行为** | 白 | L3/L4（§5 已给） |
| `systemd-analyze` / `list-timers` / `oneshot` 终态等经验知识 | 白（`AGENTS.md` §4） | 直接讲解 |
| 本文件的结构、模板、时间盒、核验表格式 | 白 | L3/L4 |
| **演练清单的选择与安全分档**（P1 的三条出路选哪条） | **黑** | L2：只列代价与追问，不替选 |
| **每一类的定位顺序与根因推理**（P2、§6 的 ③④） | **黑** | L2：只出题与 review |
| **监控覆盖盲区的判断**（P3） | **黑** | L2 |
| **「恢复算恢复」的判据**（P5）与 runbook 分叉结构 | **黑** | L2 |

**执行纪律**（W9 D5 修正结论）：手敲不是目的、证据才是——**亲手最小集 = 故障注入的触发点 + 定位判断 + 修复决策**；
批量验证与命令拼写可由 AI 出、本人核输出。**注入那一下和「先看哪个」那一步，必须本人做。**

---

## 9. 收尾清单（块 I）

- [ ] §6 四份（或 3 份 + 一份「为什么不做」）记录填满，每份**至少一条命令输出**
- [ ] §1 的六条验收判据逐条销账，缺哪条写清楚缺在哪
- [ ] §2.4 残留清单逐条核零（`diff` 为空 / `ls` 不存在 / `pgrep` 无匹配）
- [ ] 三层基线最终回归全绿，输出贴进 §10
- [ ] §2.0 的 timer 修正已用 `list-timers` 的 NEXT/LAST 间隔销账，仓库副本已同步
- [ ] `week10-plan.md` §4 的 D4 勾选 + 结果一句话
- [ ] `LEARNING-STATE.md`：当前 Day、最近完成、验收命令或证据、下一步（指向 D5）
- [ ] 必要时 `DEBT.md`（今日预期不触发：白名单语法 + 黑名单止步 L2）
- [ ] `day4-english-speaking.md`（按 `DAILY-SPEAKING-PROTOCOL.md`，**主题取自当天真实发生的事**，不写计划里没做成的）
- [ ] 展板 ⑤「演练分档」块：D4 之后那四类的「首个症状」才从预测变实测——本块能否落地由本人决定，不阻断收口
- [ ] commit

---

## 10. 收口：实际发生了什么（2026-08-20 当天填）

> 形态同 D2 §11 / D3 §9：期望 vs 实测逐项对照 + 偏差归因 + 执行期新增事实。

### 10.1 块 A 前置修正记录

**已完成（上午）**：`check-cert.timer` 的 `OnCalendar` 修正为 `0/6:00:00`；`systemd-analyze calendar '0/6:00:00' --iterations=3` 输出相邻间隔 6 小时（12:00→18:00→次日 00:00）销账；仓库副本已同步（diff 为空）；展板 ⑦ 频率表翻档；`yarn verify:board` 396/396 全过。

### 10.2 块 B 基线与今日实测值

**四个 check 手工跑一次全绿（11:43–11:43:55）**：
- check-app 11:43:38 OK（三服务 active + /health 200）
- check-mem 11:43:43 OK（available 1186MB ≥ 200MB）
- check-disk 11:43:49 OK（avail=31G ≥ 4G）
- check-cert 11:43:55 OK（**无 CERT_OVERRIDE —— 正式路径读得到、读得对，P1 选 a 销账达成**，输出见 §6.4）
- 非阻断复现：check-cert 的 stdout 前混入一行 `Certificate will not expire`（openssl stderr → NDJSON 流，D3 遗留观察）

**三层基线（11:45）**：80/443api(ssl=0)/443admin/8080/8081/health 全 200；nginx/nodeapp/mongod + 四个 timer 共 7 个 active。

**今日实测值**：avail=**31G**（40G 总 7.3G 用 20%）· available=**1186MB**（swap=0）· journald=**294.5M**（500M 上限内）· **端口工具 = `/usr/bin/nc`（socat 未装，D1 Q13 闭环）**· `/health` = `{"status":"ok"}` **纯内存，不碰 DB**。

**执行期踩点**：`systemctl start` 未加 sudo → polkit 交互认证卡死（无终端无密码，SSH 密钥用不上）——D3 已记录的同型行为（TOOL_GOTCHAS polkit 条）当日复现；修正 = 显式 `sudo` 前缀。

**类 3 止步线执行期修正**：4.2G → 3.5G（原因见 §2.3 注，选 A 拍板）。

### 10.3 逐类演练记录

**类 3 首次注入（2026-08-20 11:50）——止步线触发，已止损**：
- 注入 `sudo fallocate -l 27.1G /tmp/disk-fill.bin` 后 `df -h /` = **Avail 3.2G**（拍板目标 3.9G，实际吃多约 0.7G）。
- **止步② 触发（执行期修正版 3.5G）**：按 §2.5 立即止损 `sudo rm -f /tmp/disk-fill.bin` → `df -h /` 回到 **Avail 31G（20%）**。
- 注入期间公网 80/443 + /health 全部 200——「磁盘满不杀 Node 内存态」预测方向正确（`{"status":"ok"}` 纯内存探针）。
- **12:00 整点 timer 触发时盘已清理 → 拿到的是绿不是红**，类 3 的「timer 端到端 FAIL 证据」本次未取得。
- **0.7G 偏差归因（2026-08-20 下午字节级探针定论）**：
  - **探针证据（14:06 实测）**：
    ```text
    $ df -B1 /                                  # 探针前
    /dev/vda2  42156257280  7730216960  32584179712  20% /
    $ sudo fallocate -l 1G /tmp/probe.bin
    $ df -B1 /                                  # 探针后
    /dev/vda2  42156257280  8803962880  31510433792  22% /
    ```
    Used/Avail 各变 +1,073,745,920 字节 = **1 GiB（1,073,741,824）+ 4,096（一个 4K 块）**。
  - **定论**：`fallocate -l` 的 G = **GiB（1024³）**，字节级精确；**0.7G 偏差根因 = `df -h` 显示舍入**（真实 avail 约 32.5G 显示成 31G，拍板「31−27.1」丢失了 ~1.7G 真实余量）+ 注入后显示 3.2G 亦为向下取整。非 fallocate 吃超，方向全部正确。
  - **校准换算率（落地用）**：fallocate 声明 1G → df 字节级变化 **+1,073,745,920** 字节。
  - **check-disk 判据口径**（读脚本确认）：`df -BG`（1G 块向下取整）+ `avail < 4` → 变红边界 = **字节级 avail < 4 GiB**；目标注入后 ≈3.9 GiB = 4,187,593,114 字节 → 显示 3G 必红、且高于止步线 3.5 GiB（3,758,096,384）留 400MB 缓冲。
  - **重注入校准量（基线 32,584,179,712 为前提，注入前现场复测）**：需吃 28,396,586,598 字节 ÷ 1,073,745,920 = 26.446 → **`fallocate -l 26.4G`** → 注入后 avail ≈ 3.946 GiB ✅。
- **下午重注入执行（已定，2026-08-20 14:08 更新）**：入场确认后 `check-disk.timer` NEXT=**15:00:00 CST**（LAST=14:00:01，整点触发）。注入窗口 = **14:55–14:57**（NEXT 前 3~5 分钟），注入量 **`fallocate -l 26.4G`**（26.4 × 1,073,745,920 = 28,346,892,288 字节，以注入前现场字节级 `df -B1 /` 复测为前提再微调），目标注入后 avail ≈ **3.9 GiB**（df -BG 显示 3G → check-disk 必红；> 3.5 GiB 止步线留 400MB 缓冲）。等待期只做现象记录与修复准备。timer FAIL 证据到手 → `rm` → 三层基线复绿。

### 10.4 块 H 回归与残留核零

**三层基线最终回归（15:30，15:26 类 2 恢复后）**：
```text
80 200 · 443api 200 ssl=0 · 443admin 200 · 8080 200 · 8081 200 · health 200
nginx active · nodeapp active · mongod active
check-app.timer active · check-mem.timer active · check-disk.timer active · check-cert.timer active
```
**残留核零逐条**：
- `/tmp/disk-fill.bin`、`/tmp/probe.bin`：均不存在 ✅
- `ss -tlnp | grep :3000`：`LISTEN 0 511`（backlog 511 = nodeapp 自身，非 nc 残留的 backlog 1）✅；`pgrep -af "nc "` 仅匹配本 ssh 命令自身（命令行含 nc 字样），无真 nc 进程 ✅
- `shop-ssl` 与 `.d4bak`：`diff` 空 ✅（还原点 `.d4bak` 保留在机）
- `nodeapp.service`：无 `Environment=` 行 ✅
- check 脚本：`find -newermt 2026-08-20 10:00` 无输出 = 今天未被触碰 ✅
→ **块 H 通过：唯一生产机今晚可安稳过夜。**

### 10.5 期望 vs 实测（D4 收口对照）

| 期望（块 C 前冻结） | 实测 | 结论 |
|---|---|---|
| 类 3：注入后 check-disk 必红（FAIL 行） | `df -BG` 四舍五入 3.84→4G → 判据 `>=4G` 绿 | **预测落空，但挖出取整盲区**（比 FAIL 更有价值） |
| 类 1：443 根路径 502 + /auth /reports 200 | 502 ✅；/auth /reports=404（应用裸前缀本就 404） | 定位链命中 + 先验缺失型偏差 |
| 类 2：nodeapp failed（EADDRINUSE） | active + 无监听 + health 000（假 active） | 定位链走通 + 新盲区，排 D5 延迟自测 |
| 三项 check 预测（P3） | 类 1 全绿✅（盲区实锤）；类 3 disk🔴→🟢（取整盲区） | 「假输入能红 ≠ 真条件该红」有活证据 |
| 五面基线全部恢复 | 15:30 全 200 + 7 active + 残留核零 | ✅ 全恢复 |

---

## 11. 明日入口（D5）

D5 是收口日（`week10-plan.md` §4），五个模块 **A runbook / B 延迟自测 / C 能力检验 / D 展板核谎 / E 状态收口**。
**D5 对今天有三个硬依赖**：

1. **§6 的每类「首查命令 + 判定分叉 + 预防」** —— 这三样就是 runbook 三列的输入。今天没记全，明天写 runbook 就得靠回忆，而回忆写出来的 runbook 过不了 B 的延迟自测。
2. **P3 的盲区结论** —— runbook 里「这一类监控不会替你报，只能靠人发现」的那几条，凭据全在今天。
3. **基线必须是绿的** —— B 模块要在 runbook 指引下**再走通两类故障**，起点必须干净。

D5 第一个动作：把 §6 四份记录按「症状 → 首查命令 → 判定分叉 → 修复 → 预防」重排成 runbook 骨架，
**先排结构再写字**；B 的延迟自测按契约要求「隔至少一天、不看笔记」——今天的笔记写得越细，明天越不许翻它。

---

## 12. AI 辅助记录

- 2026-08-19（D3 收口后起草）：AI 起草本文件——变更单结构、前置四件事核验表**格式**、时间盒排布、
  §5 的 `systemd-analyze` / `curl` / `fallocate` / `openssl` **语法与工具行为**（白名单），
  以及 §3 P1–P5 的**问题与追问**、§6 的五段式空模板。
- **§3 五题全部留空待本人作答**；§6 的定位顺序、根因推理、盲区判断、恢复判据 AI 不代填。
  演练清单的选择与安全分档属黑名单（`week10-plan.md` §6），AI 只列代价与冲突，不替选。
- **起草时报告的一处冲突**（属 `AGENTS.md` §1 硬线「review 允许且鼓励」）：
  契约 §5.4 第 4 类的注入方式与 D3 §9.2 ⑤ 已执行的弄红方式**是同一手法**，
  而 D3 §3 P5 给 D4 留的出路「走正式路径」与 `week10-plan.md` §8「不碰现网证书」冲突——
  已落成 §3 P1 的三条出路交本人拍板，**AI 未替选、未改契约**。
- 同时把 D3 §9.5 的 timer 频率修正落成 §2.0 的开工前置（含**销账方式必须是 `list-timers` 的间隔、不是读文件**），
  这是 D3 §9.5 处置清单的原文搬运，非新决策。
- 2026-08-20（D4 当日，块 C）：P1–P5 本人全部作答，AI 逐题 review——
  - **P1 选 a**（证书类由 D3 覆盖，D4 只做 3 类）+ 块 B 正式路径验证销账 + runbook 首查用 check-cert；
  - **P2 首查**：类 1/类 2 共用 `/health` 一步劈开反代层/应用层（类 1 预期 200、类 2 预期非 200），类 3 用 `df -h /`；
  - **P3 预测**：类 1 全绿 = 覆盖盲区（check-app 只查进程可用性不查公网可达性，scope 不是 bug），类 2 app 红，类 3 disk 红（探针形态待块 B 确认）；
  - **P4 顺序**：类 3 → 类 1 → 类 2，类 3 对准 NEXT 拿 timer 端到端证据；等待期 = 该类观察子阶段、不做他类；`logger -t DRILL` + `date -u` 标记演练痕迹；
  - **P5 恢复判据** = 三层基线全绿 + 残留清单核零（`.d4bak` 保留在机、diff 为空为判据）；FAIL 行保留不 vacuum。
  - AI 修正（白名单经验知识）：`.d4bak` 是还原点应保留、`logger` 落点不在 service unit（`-t` 打 tag）、时间戳统一 UTC、`pkill` 匹配串按块 B 实测、类 2 终态是 failed 非 inactive。
  - 黑名单零实现，未触发 `DEBT.md`。
