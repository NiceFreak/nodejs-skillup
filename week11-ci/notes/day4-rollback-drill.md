# W11 Day 4（8/27）：回滚演练主场 + 类 2「假 active」最小样本复现

> 建立：2026-08-26（Asia/Shanghai，D3 收口后起草）
> 上游：[`day1-release-contract.md`](./day1-release-contract.md) §4.5（Q12 / Q13 / Q14）、§4.6（Q16 / Q17）、§5.4 回滚判据表、§5.5 部署后验证清单（**契约已冻结，本文件不重开任何已拍板的题**）；[`week11-plan.md`](./week11-plan.md) §3.1 与 §4 D4
> 形态参考：[`day3-deploy-credentials.md`](./day3-deploy-credentials.md) §0 / §2 / §3、W10 [`day4-fault-drills.md`](../../week10-observability/notes/day4-fault-drills.md) §2.3 前置核验表与 §6 五段式记录
> 状态：**起草完成，P1–P6 待本人作答**。§0 列出起草期发现的覆盖缺口，各自指向 §3 的待答题或 §2.3 的前置核对行；不改任何已冻结决策。
> **修订（2026-08-27 开工前）**：8/26 起草之后到 8/27 早晨，仓库多出「展板发布脚本化 + 异地触发链路」两轮 D3 附加项与 8/27 的展板 ⑧⑨ 落地（31 个提交）。据此**新增 G8–G10 三处缺口**、扩写 P2 与 P6 的事实前提、补三项连带文档与一项收尾项。**G1–G5、G7 与 P1 / P3 / P4 / P5 不受影响，验收句不变。**

---

## 0. 起草期发现的覆盖缺口（2026-08-26）

> 本节只记「已冻结的决策落到 D4 执行层时缺了哪一块」，不改取值。标「待核实」的是起草时无法从本地仓库读出的服务器侧事实——按 §2.3 的 C 表采集，不按推断执行。

| # | 覆盖缺口 | 依据 | 去向 |
|---|---|---|---|
| G1 | **候选②走哪条回滚路径，取决于 `systemctl restart` 会不会返回非零，而这一点没有核实过**。§5.4 第一行（部署中失败）触发的是 wrapper 内自动回滚，第二行（验证失败）触发的是人工 `deploy-wrapper rollback`。若 `nodeapp.service` 是 `Type=simple`，进程在 restart 返回之后才崩溃，Deploy 阶段拿到的是退出码 0 → 演练实际走的是第二行（Verify 失败 → 人工回滚），不是第一行 | §5.4、Q13 | §2.3 C1 + §3 P1 |
| G2 | **「会失败的提交」推到哪条分支没有定**。job 的 Branch Specifier 在 D3 已改回 `*/main` 并由 Poll SCM 轮询 main；把坏提交推 main 等于在主干留一个坏提交，且 GitHub Actions 会同时报红（Q3 已定两条流水线并存） | D3 §4 第 1 步、Q3 | §3 P2 |
| G3 | **坏提交改哪个文件，与周计划「不改业务逻辑」的边界要先对齐**。已核实（本地仓库，2026-08-26）：`__tests__/auth-flow.test.js` 与 `__tests__/monthly-sales.test.js` 都只 `import app from '../app.js'`，**没有任何测试导入 `server.js`**——改 `server.js` 的启动路径能过测试且起不来，正是候选②要的形态；但周计划 §3「明确不扩展」写的是「不改业务逻辑」 | `grep` 实测；周计划 §3 | §3 P3 |
| G4 | **类 2 最小样本在服务器侧跑会撞生产端口**。Q16 写的样本是 `server.listen(3000,'127.0.0.1',cb)`，服务器上 3000 正被 nodeapp 占用（D3 V6 基线：`ss` 见 `127.0.0.1:3000` LISTEN）。照字面执行只会得到 `EADDRINUSE`，复现不了 W10 D4（8/20）的现象；换端口是否与原现象等价，需要先说清 | Q16、D3 §4 基线 | §3 P4 |
| G5 | **人工回滚的目标已经不是 `6a1b1a1`**。D3 首次部署 Verify 通过后 `mark-verified` 已把 `.previous_commit` 写成 `7b90b25`（V12 实测）。契约 §5.4 的脚注写的是首次基线 `6a1b1a1`，那一句只对首次部署成立；D4 演练的人工回滚会回到 `7b90b25`。回滚并验证通过之后要不要再调一次 `mark-verified`，契约没写 | §5.4 脚注、D3 V12 | §2.3 C3 + §3 P5 |
| G6 | **8080 下线与「五面基线全绿」的收口判据冲突**。Q17 已拍板本周做完，D3 的 P4 把它排到「D4/D5」，`/tmp/nginx-shop-admin-8080-removed` 与 sudoers 的一次性 `cp` 白名单条目已就位；但周计划 §3 的最低交付边界写的是「本周结束时五面基线全部恢复绿」。下线后基线是四面，这句判据要同步改口径，且下线动作与回滚演练的基线对照组存在先后顺序问题 | Q17、D3 §3 P4、周计划 §3 | §3 P6 + §2.6 |
| G7 | **主线 A 的触发链完全依赖开发机→github.com 的网络**。D3 收口记录：公司网络对 github 节点 IP 的 TLS 拦截，`curl https://github.com/` = 000；Jenkins 的 Checkout SCM 与 Poll SCM 都要从开发机拉取。坏提交推不上去、或推上去 Jenkins 拉不下来，主线 A 不能开始。这一条没有技术对策 | D3 §4 网络诊断 | §2.5 止步条件 1 |
| G8 | **服务器上现在有两把自动化密钥，第二把没有 `command=` 限制**。D3 附加项第一轮为展板落盘新建了专用密钥，**裸装在 `authorized_keys` 第 3 行、无强制命令**，并把 sudoers 白名单由 8 条增至 **9 条**（新增 `showcase-land`）。D4 的越权验证（V9）原本只验 `id_rsa_deploy` 这一把，已不能代表服务器当前的自动化面 | `deploy-showcase-script.md` §4 / §5；`BACKLOG.md` P1-9 | §2.3 V9 扩展 + §5.2 记录 |
| G9 | **Nginx 侧待办从一笔变两笔，而写配置的 sudo 通道只对 8080 那一个文件开**。除 8080 下线外，80 站新增 `location /showcase/`（`week10-observability/notes/nginx/shop.conf` 本地副本已改，**已落盘 2026-08-27，见 [`change-order-showcase-80-path.md`](./change-order-showcase-80-path.md)**）。sudoers 的一次性 `cp` 条目把源 `/tmp/nginx-shop-admin-8080-removed` 与目标 `/etc/nginx/sites-available/shop-admin` 都写死，**落 `shop.conf` 用不了它** | `shop.conf` 头部注释（2026-08-26 追加）；D3 §3 P4 | §3 P6 扩写 + §2.6 |
| G10 | **改 `runbook.md` 现在会牵动展板与 `verify:board`**。`RunbookBoard.tsx` 的事实源写明是 `week10-observability/notes/runbook.md`，且 2026-08-27 刚拍板 runbook tab 的对外脱敏规则（真实 IP / 域名在展示状态显示为占位符）。8080 下线要改 runbook §4.1 的五面速查表，改动会落到展板数据与断言上（当前基线 `verify:board` **934**） | `RunbookBoard.tsx` 第 2 行；`SHOWCASE-DEPLOY-PROTOCOL.md` §3 新增条；`change-order-showcase-remote-trigger.md` §9.8 | §2.6 连带文档 |

---

## 1. 今日唯一主线与验收句

**主线 A（回滚演练主场）**：至少做一类会失败的发布，走完「被拦住」或「回滚」的全程，按 W10 D4 的五段式记录（现象 → 定位 → 根因 → 修复 → 预防），并显式区分事实 / 推断 / 未验证。

**主线 B（W10 移交）**：类 2「假 active」最小样本复现，确认「listen 成功回调已触发但底层 socket 未绑定」的实际关系。

**验收句（周计划 §4 D4 已冻结，不改字）**：

> **A：能说出每一次失败是被哪一个阶段拦下的；如果没有被拦住，能说出为什么没有。**
>
> **B：最小样本能复现或明确否证 W10 D4（8/20）观察到的现象，结论按事实 / 推断 / 未验证分级写清；`server.js` 的修复方向据此定案。**

**今天真正要拿到的东西**（不是「跑了一次回滚命令」）：

| 问题 | 今天用什么回答它 |
|---|---|
| 五阶段各自的拦截面到底在哪？ | 每一类坏提交**当场记下它止步在哪个阶段、退出码是什么**（§2.3 V 表）。D3 证明的是全绿路径；只有失败路径被走过，阶段划分才算被验证。 |
| 回滚凭什么算「回到了基线」？ | 回滚后跑 §5.5 完整七项 + `git rev-parse HEAD` 对照 `.previous_commit`（§2.3 V7 / V8）。「服务起来了」不是判据。 |
| 类 2 的结论凭什么算数？ | 复现或否证都要有脚本化循环的计数输出（Q16 定的 100 次），并按事实 / 推断 / 未验证分级；**不能因为跑了一次没复现就写成已否证**。 |
| D3 欠下的那笔债还了没有？ | `DEBT.md` 2026-08-26 条目（`Run.getLog()` 返回类型）的第一档重建**不看笔记**通过（§2.2 第 1 步）。 |

**硬边界**：

- 演练只允许影响部署单元（`week2-express/src` 的代码版本与 `node_modules`）与 `nodeapp` 进程本身。**不改 Nginx（8080 下线除外，见 §2.6，走独立变更单）、不改证书、不改 ufw、不改 `.env` 内容、不改 `nodeapp.service` 单元。**
- 类 2 最小样本**不得占用生产 3000 端口**、不得停 `nodeapp`（P4 拍板落点）。
- 演练结束时线上必须回到已验证版本，且 §5.5 七项全绿（§2.5 止步线 2）。

---

## 2. 变更单（动手前冻结，四要素）

### 2.1 改动清单 —— 今天就这几项，别的都不动

**仓库侧（会进 git 历史）**

1. 一个**测试失败的提交**（候选①）：改动落点与撤回方式由 P2 / P3 定。
2. 一个**能过测试但起不来的提交**（候选②）：改动落点与撤回方式由 P2 / P3 定。已核实的事实前提是 `server.js` 不被任何测试导入（§0 G3）。
3. 演练结束后的**撤回提交**（revert 或分支删除，形态随 P2）。

**服务器侧（有副作用）**

4. 候选②部署后产生的版本切换与回滚（`git reset --hard` + `npm ci --omit=dev` + `systemctl restart nodeapp`），全部经 `deploy-wrapper`，不手工敲。
5. 类 2 最小样本脚本落盘（路径、端口、属主由 P4 定），演练后删除。
6. **顺带项**：8080 下线（Q17，若 P6 定在 D4）。走 §2.6 独立变更单，与主线无依赖。
7. **顺带项**：`gpasswd -d ubuntu sudo` + 注释 `/etc/sudoers` L55 lighthouse——**仅在本日确实产生 root 需求时同一会话闭合**；否则只做「风险是否仍成立」复核并记录（D3 收口决策，不专门重置密码）。
   **待核对的一处事实（2026-08-27 起草修订时发现）**：D3 附加项第一轮为装 `showcase-land` 与追加 sudoers 第 9 条，**已经发生过一次 root 会话**（`deploy-showcase-script.md` §4 第 3 条：「经 root 会话 `cat` 确认 8 条内容」），而同文件 §6 仍把 `gpasswd -d ubuntu sudo` 记为「待 root」。按 D3 冻结的「绑定下次 root 需求、同一会话闭合」这条口径，那个窗口已经出现且未闭合。该项在展板板头的「3 待做」里仍挂着，未沉默消失。今天要么在 P6 的 Nginx root 窗口里一并闭合，要么按备选做复核并把「窗口出现过一次未闭合」如实记进 §4。

**开发机 / Jenkins 侧**

8. 若 P2 选临时分支形态：job 的 Branch Specifier 临时偏离 `*/main`，**演练结束当天改回**（D2 的同型偏差已因未及时改回付出过一轮成本）。

**明确不动**：Nginx（8080 块除外）、证书、ufw、`.env` 内容、`nodeapp.service` 单元、`week8-fullstack/src/frontend/dist-admin443/`（未跟踪产物，D3 V13 已保全）、`deploy-wrapper` 的白名单命令集合（除非 P4 的最小样本需要新通道，那要先回到 §3 作答）。

### 2.2 执行顺序（提议，待本人拍板）

> 硬约束两条：**第 5 步之前必须先采部署前基线**（没有对照组的回滚证明不成立）；**候选① 在候选② 之前**（前者零服务器改动，先确认拦截面存在，再做会改线上的那一类）。

| 阶段 | 步 | 动作 | 产出 |
|---|---|---|---|
| — | 1 | **DEBT 第一档重建（15–20 分钟，不看笔记）**：`Run.getLog()` 无参 String vs `getLog(int)` List 的差异、tail 语义对扫密钥的可接受性 | `DEBT.md` 状态推进 |
| — | 2 | P1–P6 作答冻结 | 执行期决策不留空 |
| A | 3 | 前置核对 C1–C6（只读） | 演练形态的事实前提 |
| A | 4 | 采部署前基线：`git rev-parse HEAD`、`.previous_commit`、`.rollback_target`、§5.5 七项各跑一次 | **对照组**（V7 / V8 的分母） |
| A | 5 | 候选①（测试失败的提交）推送 → 观察流水线止步阶段 → 服务器零改动核对 | **收工点 A** |
| B | 6 | 候选②（能过测试但起不来的提交）推送 → 观察止步阶段与是否自动回滚 | 拦截面实测 |
| B | 7 | 按 §5.4 判据执行回滚（自动或人工，取决于第 6 步落在哪一行）→ 回滚后跑完整七项 | **收工点 B（验收句 A）** |
| B | 8 | 撤回演练提交，线上回到已验证版本并复核七项 | 基线恢复 |
| C | 9 | 类 2 最小样本：脚本化循环（Q16 定 100 次），开发机侧先跑，服务器侧按 P4 的落点跑 | **收工点 C（验收句 B）** |
| D | 10 | 顺带项：8080 下线（若 P6 定在 D4）+ root 待补项处置或复核 | W10 / D3 移交销项 |
| D | 11 | 口语稿（`DAILY-SPEAKING-PROTOCOL.md`，D2 / D3 均未做，本日补） | 并行线补齐 |

### 2.3 验证 = 可证伪实验（动手前写死期望，实测栏当天填）

**前置核对（只读，动手前）**

| # | 命令 | 要拿到什么 | 实测 |
|---|---|---|---|
| C1 | `systemctl cat nodeapp` | `Type=` / `Restart=` / `RestartSec=` 的实际取值——决定 G1：`systemctl restart` 在应用起不来时返回几 | `Type=simple` / `Restart=on-failure` / `RestartSec=10s` / `ExecStart=/usr/bin/node --env-file=.env server.js`（2026-08-27 实测） |
| C2 | `systemctl show nodeapp -p Type -p Restart -p RestartSec -p ExecStart` | 同上，取机器可读值，避免看漏被注释的行 | `Type=simple` `Restart=on-failure` `ExecStart=/usr/bin/node --env-file=.env server.js`；start_time `10:45:55` pid=347803（构建 57 部署后） |
| C3 | `cat /var/lib/deploy-state/.previous_commit`；`cat /var/lib/deploy-state/.rollback_target` | 人工回滚的真实目标（预期 `.previous_commit` = `7b90b25`，G5） | `.previous_commit` = `59dc11d`（**非 `7b90b25`**——构建 57 mark-verified 已刷新，G5 更新）；`.rollback_target` = `6da765a`（上一轮部署 59dc11d 开始时的快照） |
| C4 | `git -C /home/nodeapp/nodejs-skillup rev-parse HEAD` | 演练前线上运行的 commit（预期 `7b90b25`） | `59dc11d`（与 `.previous_commit` 一致；预期更新） |
| C5 | `df -B1 /`；`free -m` | 演练前磁盘与内存余量（预期可用 > 4 GB；available 约 1100–1200 MB 量级）。候选②会多跑一轮 `npm ci` | 磁盘可用 **32.2 GiB**（>4 GB ✓）；内存 available **1299 MB** |
| C6 | `ss -lntp`；`ls -l /home/ubuntu` 或 P4 选定的样本落点 | 3000 被 nodeapp 占用的现状（G4 的前提）；最小样本可用的空闲端口与可写目录 | `127.0.0.1:3000` LISTEN（nodeapp）；`0.0.0.0:8080/8081/443`（Nginx）；`127.0.0.1:27017`（mongo）；`/home/ubuntu` = `drwxr-x--- ubuntu ubuntu`（**750，ubuntu 可写**）；Node：服务器 v24.19.0 / 开发机 v24.16.0（P4 采集） |

**改动验证（每项先写死期望）**

| # | 验证项 | 命令 / 观察点 | 期望 | 实测 |
|---|---|---|---|---|
| V1 | 候选①被哪一阶段拦下 | 构建页阶段视图 + 控制台 | **Test 阶段 FAILURE**；Deploy / Verify / validate-logs 未执行 | 构建 58 = FAILURE：`FAIL __tests__/monthly-sales.test.js`（drill-fail 用例，`Tests: 1 failed, 9 passed, 10 total`）；Deploy / Verify / validate-logs 全部 `skipped due to earlier failure(s)`；`Finished: FAILURE` ✓ |
| V2 | 候选①的服务器零改动 | 演练前后 `git rev-parse HEAD`、`.previous_commit`、`.rollback_target`、`journalctl -t DEPLOY --since today` | 三个值均未变；无新的 `deploy-start` 记录 | 三值均未变（59dc11d / 59dc11d / 6da765a）；`journalctl -t DEPLOY --since '11:08'` = No entries ✓ |
| V3 | 候选②过测试 | 构建页 | Checkout / Install / Test 全绿，进入 Deploy | 构建 60：`Test Suites: 3 passed, 3 total`、`Tests: 9 passed, 9 total`（server.js 不被测试导入）✓ |
| V4 | 候选②止步阶段与退出码 | Deploy 与 Verify 两段的控制台输出 | **先写预测再对**（P1 的答案就是这条预测）：Deploy 返回 0 → Verify 的 `/health` 30s 超时后报红 → **不自动回滚** | **P1 预测全中**：`Deploy eff8766... completed successfully`（exit 0，Type=simple restart 返回 0）；Verify `ERROR: /health not ready after 30s`；`Finished: FAILURE`；validate-logs skipped ✓ |
| V5 | 自动回滚是否被触发 | `journalctl -t DEPLOY --since today`；`.rollback_target` 的读取痕迹 | 与 V4 一致：若 Deploy 未失败则**不应**出现 `rollback-end` | journal 只有 `deploy-end eff8766 success`，**无 `rollback-end`**；`.rollback_target` 无读取痕迹（未被消费）✓ |
| V6 | 人工回滚执行 | `ssh -i $KEY ubuntu@<server> "deploy-wrapper rollback"` | 退出码 0；wrapper 读 `.previous_commit`（`fd39799`），执行 reset + npm ci + restart | deploy key `rollback`：`HEAD is now at fd39799` + npm ci 116 包 2s + `Rollback to fd39799... completed successfully`，exit=0 ✓ |
| V7 | 回滚后版本对照 | `git rev-parse HEAD` 对照 C3 的 `.previous_commit` | 两值相等 | HEAD = fd39799 = `.previous_commit` ✓；`.rollback_target` = eff8766（rollback 时快照）——F1 职责区分再次实证 |
| V8 | 回滚后完整验证 | §5.5 七项按表序 | 七项全绿（含公网 443 curl 200）——这是「回到基线」的判据，不是「服务起来了」 | 七项全绿（/health ok / 业务 Hello World / mongosh {ok:1} / ss:3000 LISTEN / check-app OK / check-disk OK / 443 curl 200）✓ |
| V9 | 越权面未被演练扩大 | `ssh -i id_rsa_deploy ubuntu@<server> "echo hi"` 再跑一次；`sudo -n -l` 看白名单条数 | 仍 `ERROR: Invalid command` + 非零；白名单仍为 **9 条**（演练不得顺手放宽） | |
| V9b | 第二把密钥的形态如实记录（G8） | `authorized_keys` 逐行看前缀（**只记形态与行号，不抄公钥内容**） | 展板落盘密钥仍为裸装、无 `command=`；这是已知且已记账的敞口（`BACKLOG.md` P1-9），**本日不收窄**，只在 §5.2 与 D5 的对照说明里如实写它是自动化面的第二条通道 | |
| V10 | 类 2 最小样本计数 | P4 选定落点上的脚本化循环（100 次） | 输出「回调触发次数 / `ss` 见监听次数 / 进程存活次数」三列计数；**期望值不预设**，但两列不一致的次数 > 0 即为复现 | 开发机 v24.16 + 服务器 v24.19、三模式（inCallback/afterListen/sync）× 100 次：close 竞争**未复现**（inCallback/afterListen：A=100、listening=true 100；sync：A=0）；**完整 server.js + EADDRINUSE 注入复现**：修复前 SRV ALIVE + 无 3002 监听 + 有「服务运行端口」日志（假 active 完整形态）；修复后 exit(1) + FATAL 日志 ✓ |
| V11 | 类 2 结论分级 | 本文件 §5 | 结论逐条标事实 / 推断 / 未验证；未复现时不得写成「已否证机制」 | **机制定论**：listen 到被占用端口时 listening 回调仍触发（打「服务运行端口」日志）+ 底层 bind 失败（EADDRINUSE）+ 无 error 监听 → 进程静默存活 = 假 active。事实 = 注入对照输出（修复前 ALIVE/修复后 exit(1)）；推断 = 该机制为 W10 D4 现象的解释（与现场三要素同形）；未验证 = 生产 3000 的同类注入（不注入，唯一生产机）。修复方向定案 = error 监听 + `process.exit(1)`（runbook §2.2 方向）✓ |
| V12 | 演练痕迹清零 | `git -C ... status`；样本脚本落点；`ss -lntp` | 无演练残留文件；`dist-admin443/` 仍在；3000 仅 nodeapp | |

### 2.4 回滚（动手前写好卸载路径）

| 改动 | 回滚动作 | 前置准备 |
|---|---|---|
| 候选②部署到线上 | `deploy-wrapper rollback`（读 `.previous_commit` = `7b90b25`） | C3 / C4 已采基线；确认 wrapper 的 rollback 分支在 D3 未被实际执行过（首次执行本身就是本日的验证项） |
| 人工回滚也失败 | §5.4 第三行：SSH 手工 `git reset --hard 7b90b25` + `npm ci --omit=dev` + `systemctl restart nodeapp`，人工验证 | 白名单内的 `sudo -u nodeapp git` / `npm` + `sudo systemctl restart nodeapp` 均可用（D3 V4 已验证） |
| 演练提交进了 main | `git revert` 或删除临时分支（形态随 P2） | P2 作答时一并写下撤回命令 |
| Branch Specifier 临时偏离 | 改回 `*/main` 并跑一次构建确认 | 仅当 P2 选临时分支形态 |
| 类 2 样本脚本 | 删除脚本文件；确认其占用的端口已释放（`ss -lntp`） | P4 定落点时一并定删除命令 |
| 8080 下线（§2.6） | 见 §2.6 | 见 §2.6 |

### 2.5 止步条件与时间盒

**阶段收工点**

- **收工点 A**：候选①走完（V1 / V2 通过）。达成即「测试阶段确实是拦截面，且拦下时服务器零改动」，当天即使不进 B 也有可交付结论。
- **收工点 B**：候选②走完并回滚到基线（V3–V8 通过）= 验收句 A 达成。
- **收工点 C**：类 2 最小样本给出分级结论（V10 / V11）= 验收句 B 达成。
- **A 未达成不进 B**：拦截面本身没被验证时，先做会改线上的那一类，等于把未知叠加到唯一生产机上。

**止步线**

1. **开发机→github 网络仍不通**（G7）→ 主线 A 全部不能开始。当天改为：先做主线 B（类 2 最小样本，不依赖 github）+ DEBT 重建 + 8080 下线；主线 A 顺延 D5，并在 D5 的时间盒里显式让位（周计划 §4 D5 的 A / B / C / D 相应压缩，哪一项让位当天写明）。
2. **回滚之后 §5.5 七项仍不绿** → 按周计划 §3.1 止步线，立即停止本周流水线实验，当天转手工修复与复盘（按 [`runbook.md`](../../week10-observability/notes/runbook.md) 走），剩余计划顺延。
3. **类 2 最小样本占用端口影响到线上** → 立即杀掉样本进程，该项当天不再重试，改为只在开发机侧跑并如实记「服务器侧未验证」。
4. **出现契约未覆盖的新决策点** → 停下来写进 §3 并作答，不在执行中临场拍板（D2 的 F1 / F2、D3 的 G1–G7 都是这样漏掉的）。

**时间盒**：当天拍板后填（DEBT 重建 15–20 分钟固定在最前，不与演练混排）。

### 2.6 顺带项独立变更单：8080 明文面下线（Q17，执行日由 P6 定）

| 要素 | 内容 |
|---|---|
| 改动 | 用 `/tmp/nginx-shop-admin-8080-removed`（D3 已 cp 到位，857 B，**8080 块的实际编辑由本人在执行前完成**）替换 `/etc/nginx/sites-available/shop-admin`，`sudo nginx -t` 后 `sudo systemctl reload nginx`（不是 restart） |
| 执行序列 | Q17 已冻结七步：① `ss -lntp \| grep 8080` 记录监听进程 → ② 查活跃连接 → ③ 替换配置 → ④ `nginx -t` → ⑤ `reload` → ⑥ 复核端口关闭 → ⑦ 同步更新基线口径 |
| 为什么归顺带项 | 它是**人执行的基础设施变更**，不经流水线（Q7 约束的是流水线不碰 Nginx，Q17 的边界声明已写清两者不冲突） |
| 连带文档 | 五面 → 四面：`runbook.md` §4.1 速查表、周计划 §3「五面基线全部恢复绿」的收口判据、§5.5 部署后验证清单（该清单七项本就不含 8080，**不需改**——这一点执行时复核，不照抄推断）。**2026-08-27 新增两处下游（G9 / G10）**：① `RunbookBoard.tsx` 的事实源就是 `runbook.md`，改速查表要同步展板数据与 `verify:board` 断言（当前基线 934），并遵守 8/27 拍板的 runbook tab 对外脱敏规则（展示状态用占位符）；② `/showcase/` 落盘后基线由「四面」变成「四面 + 一个子路径入口」，`shop.conf` 头部那行「待落盘」要改成「已落盘 + 回滚基线路径」 |
| 验证 | `ss -lntp \| grep 8080` 无输出；80 / 443 / 443 `/admin/` / 8081 四面 curl 仍 200；`nginx -t` 通过 |
| 回滚 | 恢复 D3 备份的原配置文件 + `nginx -t` + `reload` |
| 止步 | `nginx -t` 不过、或 reload 后任一其余面非 200 → 立即恢复原配置，该项顺延 D5 |
| 收尾 | 下线完成后**删除 sudoers 里那条一次性 `cp` 白名单条目并清理 `/tmp` 源文件**（P4 的「用完收回」承诺，不留常驻的写配置通道） |

### 2.7 执行期已知工具行为（经验知识，按 `AGENTS.md` §4 直接列，不考核先答）

1. **`systemctl restart` 的返回码与应用是否起得来是两件事**：`Type=simple` 下 systemd 只保证 fork 成功即返回 0，进程随后崩溃由 `Restart=` 策略接管；`Type=notify` / `Type=forking` 才会等就绪信号。这正是 G1 要用 C1 / C2 核实的原因。
2. **`Restart=on-failure` 会制造「反复重启」的观察噪声**：崩溃 → 等 `RestartSec` → 再起，`systemctl status` 在两次之间可能短暂显示 `activating`。看单帧状态会得出互相矛盾的结论，要看 `journalctl -u nodeapp` 的时间序列。
3. **`git revert` 与 `git reset --hard` 在部署形态下的差别**：线上部署是 `git reset --hard <sha>`，仓库侧撤回坏提交用 `revert` 会**新增一个 commit**，于是「回到旧版本」在仓库里是一个新 sha，与线上回滚到的 `7b90b25` 不是同一个对象。演练记录里要把这两个 sha 分开写。
4. **`npm ci --omit=dev` 会先删 `node_modules` 再装**：回滚过程中存在一个「旧代码 + 无依赖」的时间窗，此时 `/health` 必然不通。这是预期现象，不是回滚失败——判据以回滚命令的最终退出码与随后的七项验证为准。
5. **`ss -lntp` 需要权限才显示进程名**：非 root 时可能只见 socket 不见 `users:((...))`，类 2 样本的判读要固定用同一种权限执行，否则两次输出不可比。

---

## 3. 需要本人拍板的执行期决策（答完冻结，动手前不留空）

> 每题一个设计点。选项只列不选；`AGENTS.md` §2 的黑名单止步 L2 在本节同样适用——阶段拦截面的判断、回滚路径的选择、类 2 的归因，都属黑名单。

### P1（先答后对）候选②会止步在哪个阶段？自动回滚会不会被触发？

**为什么问它**：G1。§5.4 的两行对应两条完全不同的回滚路径（wrapper 内自动回滚 vs 人工 `rollback` 命令），而走哪一条取决于 `systemctl restart` 在应用起不来时的返回码。按 `LEARNING-PROTOCOL.md` §4 的先答后对，实测（C1 / C2 + V4）之前先写预测。

**必答追问**：① 预测 Deploy 阶段的退出码与 Verify 阶段的具体失败项（是 `/health` 超时，还是 `ss` 见不到监听，两者不一定同时）；② 如果实测与预测不一致，说明契约的哪一条假设需要修正；③ 若 `Restart=on-failure` 让进程反复重启，Verify 的 30s `/health` 等待会不会偶然撞上一个「刚起来还没崩」的窗口而误判成功——这种情况怎么识别。

> 答（本人）：
> **P1 预测（先答后对，2026-08-27 冻结）**：Deploy exit = 0（`Type=simple` 只保证 fork 成功，崩溃由 `Restart=` 接管）→ 自动回滚不触发 → 止步 Verify（`/health` 30s 轮询耗尽报红）。`ss` 是否同步不见 3000 监听取决于崩溃时机，两者不一定同时。追问 1：是时间窗口问题（绑定端口前 / 绑定后 / 存活窗口三种形态）。追问 2：restart 非零 → 修正「Type=simple 必返回 0」假设；Verify 竟通过 → 修正「Deploy 0 + 单次通过 = 成功」过脆弱（需稳态证据）。追问 3：会撞存活窗口；识别 = `journalctl -u nodeapp` 时间序列 + NRestarts（注意 `systemctl show` 非白名单命令）、连续 /health、PID 稳定性、Verify 通过后再补稳态检查。Review 修正：验证对象是 `127.0.0.1:3000` 非 8080；Verify 是 30s 轮询等待非单次请求；候选②选「启动即抛错」消除存活窗口（与 P3 耦合）。

### P2（演练提交的载体）坏提交推到哪条分支？事后怎么撤？

**为什么问它**：G2。Branch Specifier 在 D3 已改回 `*/main`；把坏提交推 main 会在主干留下坏提交并让 GitHub Actions 报红（Q3 已定两条流水线并存，Actions 的红也是记录）。

**必答追问**：① 选定形态后，撤回命令是什么，撤回本身会不会再触发一次部署（revert 提交同样会被轮询到）；② 若选临时分支 + 改 Branch Specifier，怎么保证当天改回（D2 的同型偏差是靠 D3 第 1 步补的）；③ 演练提交在 git 历史里怎么标注，让半年后读 log 的人知道它是有意为之。

**2026-08-27 补充的两条事实前提（不改题，只是把约束条件更新到当前）**：

- **main 的分支保护已整体移除**（2026-08-26 本人拍板「摩擦大于收益」，取消「Require a pull request」，直推恢复；见 `change-order-showcase-remote-trigger.md` §9.7）。起草时假定的「推 main 要走 PR」这条阻力已经不存在，候选① 现在是无阻力路径。
- **演练提交不会连带触发展板发布**。`showcase-deploy` job 的 pollSCM 目标只有 `ops/showcase-deploy` 分支：陷阱 3 已按裸 `git clone` 处理，**实测打开 pollSCM 后 main 提交与回执 push 均未触发新构建**（同文件 §9.3）。因此坏提交进 main 不会把带坏提交的 main 发上 8081。这一条不需要今天再验。

**候选（只列不选）**：① 直接推 main，事后 `git revert`；② 临时分支 + 临时改 Branch Specifier，演练后删分支并改回；③ 推 main 但用一个约定前缀（如 `drill:`）标注，事后 revert。

> 答（本人）：
> **P2（2026-08-27 冻结）选 A（直推 main + `git revert`）**。理由修正：`w11-d2-pipeline` 盯 `*/main`（HTTPS + Poll SCM `H/5 * * * *`），推 main 会触发后端部署 = 演练预期（坏提交触发部署被拦）；B 反目标（让坏提交绕过自动部署）；C 前缀不如 revert 干净。追问 1：撤回 = `deploy-wrapper rollback`（应用层，回 `.previous_commit`）+ `git revert` + push（仓库层）；**revert 提交会触发一次正常版本部署 = 功能非 bug**，rollback 留作安全网；轮询错过则手动 Build Now 补触发。追问 2（假设 B 的防护）：闹钟 + 看板未完成项 + 脚本钩子，但根本解法是不选 B。追问 3：message 带 `[DR-20260827]` 前缀 + revert 自动 `Revert "<标题>"` 引用 + 笔记 sha 锚定；**不预填 revert sha**（amend 会移动坏提交 sha 破坏锚定）。已核实（2026-08-27 晨）：构建 57（10:44）SUCCESS 并 mark-verified → 回滚基线 = `59dc11d`（非 `7b90b25`）。

### P3（坏提交的内容）两类坏提交各改什么，才刚好落在预期的拦截面上？

**为什么问它**：G3。候选①要「被测试拦住」，候选②要「过测试但起不来」。已核实的事实前提：两个集成测试都只 `import app from '../app.js'`，**没有测试导入 `server.js`**，因此 `server.js` 的启动路径是天然的「测试盲区」。同时周计划 §3 写着「不改业务逻辑」。

**必答追问**：① 候选②改在 `server.js` 的哪一处、以什么形式失败（抛异常 / 端口冲突 / 配置校验不过），选定的形式要能保证**它不会污染回滚后的状态**；② 「演练用的坏提交」算不算周计划 §3 说的「改业务逻辑」，边界怎么写才不与那句话冲突；③ 候选①改在哪个测试上——改断言、改被测代码，还是新增一个必然失败的用例，三者在「验证 Test 阶段拦截面」这个目的上是否等价。

**候选（只列不选）**：① 候选②在 `server.js` 启动路径抛错；② 候选②改 `.env` 依赖的配置校验分支（注意 `.env` 本身不动，只改读取它的代码）；③ 候选①新增一个 `expect(1).toBe(2)` 的用例，改动最小且撤回干净。

> 答（本人）：
> **P3（2026-08-27 冻结）**：候选①（收工点 A 必做，**非二选一**）= 测试文件新增必然失败用例（`expect(1).toBe(2)`），业务代码零改动 → Test 阶段报红、服务器零改动；三种变体不等价（新增用例最干净 / 改断言效力等价但语义差 / 改被测代码踩边界）。候选② = `server.js` **顶层** `throw`（在 import 之后、`startServer()` 之外——真实结构见 `server.js` 第 5 行后；模块加载即崩、不绑端口、无存活窗口）；测试不导入 `server.js` → 测试全绿。追问 2：边界判据 = **改动落点不在业务代码**（`app.js` 及被测试覆盖的路由/控制器/数据访问/中间件）即合规；测试绿/不绿是候选①/②各自的拦截目标，不是合规判据（修正：原「测试失败则踩线」会自判候选①踩线）。不污染：单文件 + revert 恢复；journalctl 崩溃日志 = 日志痕迹非状态污染（V12 只查残留文件/端口）。

### P4（类 2 样本的落点）最小样本在哪一侧跑、用哪个端口、脚本落在哪？

**为什么问它**：G4。Q16 的样本写的是 3000，而服务器上 3000 被 nodeapp 占用；停 nodeapp 违反本日硬边界。样本换端口后，与 W10 D4（8/20）在 3000 上观察到的现象是否等价，需要先说清，否则复现结论的适用范围会被高估。

**必答追问**：① 换端口后，哪些条件与原现场仍然相同（Node 版本、`listen` 调用形态、close 竞争），哪些不同（端口号、是否经 systemd 拉起、是否有 `Restart=`）——不同的那几条决定结论能推广到哪一步；② 服务器侧脚本落在哪个目录、属主是谁、演练后怎么删（ubuntu 对 `/home/nodeapp` 不可写，D3 C3 实测 751）；③ 开发机侧与服务器侧的 100 次循环结果不一致时，按哪一侧的结论写 `server.js` 的修复方向。

**候选（只列不选）**：① 服务器侧换一个未占用的高位端口（如 13000），其余照 Q16；② 只在开发机侧跑，服务器侧如实记「未验证」；③ 服务器侧用 systemd 临时单元拉起样本，让 `Restart=` 条件与生产同形——但这会新增一个 unit，超出本日硬边界，需显式拍板。

> 答（本人）：
> **P4（2026-08-27 冻结）**：开发机 `3001` + 服务器**高位端口 `13000`**（D4 硬边界禁 3000 + `EADDRINUSE`）各跑 Q16 的 100 次循环；独立 `reproduce-close-race.js`（Q16 形态，不碰 `server.js`）；Node 版本两侧实测采集：**服务器 v24.19.0（/usr/bin/node）/ 开发机 v24.16.0（/usr/local/bin/node）**——同 24 大版本、patch 不同（C 表实测，2026-08-27）。追问 1：相同 = `listen` 调用形态 / close 竞争逻辑；不同 = 端口号（G4 原问）、是否 systemd 拉起 + `Restart=`（关键，修复方向区分「裸 Node 机制」与「systemd 叠加」）、Nginx 健康检查轮询。追问 2：服务器落 `/home/ubuntu/drill/class2/`（ubuntu:ubuntu，演练后 `rm -rf` + 清理残留进程）；开发机侧落点一并定。追问 3：不一致以**服务器侧**为准；但服务器未复现不能直接「否证生产问题」——按 Q16「复现失败」的扩大样本分支走（§5.3 已冻结），结论逐条标事实/推断/未验证。

### P5（回滚之后的基线语义）人工回滚并验证通过后，要不要再调一次 `mark-verified`？

**为什么问它**：G5。`.previous_commit` 现为 `7b90b25`；人工回滚正是回到它。回滚后跑完整七项通过，这次「验证通过」要不要写回状态文件——写回等于把同一个 sha 再写一遍（无变化），不写回则 `.previous_commit` 的语义仍然成立。契约 §5.4 没有覆盖这一格。

**必答追问**：① 选定后，`mark-verified` 的调用方从「流水线 Verify 阶段」扩不扩到「人工回滚后」，扩了会不会让「只有验证通过的版本才进 `.previous_commit`」这条不变量出现第二个写入方；② 若不写回，怎么在记录里体现「这次回滚后的验证也通过了」；③ 演练结束、撤回提交、线上再次部署到正常版本之后，`.previous_commit` 应该是哪个 sha。

> 答（本人）：
> **P5（2026-08-27 冻结）不扩、不调用 mark-verified**。`.previous_commit` 语义 = 最近一次**自动化流水线**完整验证通过的提交；人工验证是运维应急操作、未经 CI 背书，写回破坏「只有验证通过的版本才进 `.previous_commit`」不变量。追问 1：会引入第二写入方；wrapper 实现（`do_rollback` 只读不写）证实唯一性是有意设计。追问 2：回滚后人工验证证据落 §5.2 五段式 + V 表手工子项；验证 = §5.5 **完整七项**（非单条 curl）；状态文件路径 = `/var/lib/deploy-state/`（非 `/srv/nodeapp/`）。追问 3：最终 `.previous_commit` = **revert sha**（tree 等价 `59dc11d`、对象不同，§2.7 第 3 条工具行为）；revert 自动部署时 `deploy_core` 顺带写 `.rollback_target` = `59dc11d`，两文件各归其位（F1 职责区分再次实证）。

### P6（Nginx 侧两笔变更的执行日与顺序）8080 下线与 `/showcase/` 落盘各放哪一天？写配置的通道怎么开、怎么收？

**为什么问它**：G6 + G9。Q17 已拍板 8080 本周做完，D3 把它排到「D4/D5」两日之一，前置物料（`/tmp/nginx-shop-admin-8080-removed` + 一次性 `cp` 白名单）已就位。8/26 之后又多出第二笔：80 站新增 `location /showcase/`（本地副本已改，服务器待落盘）。两笔都改 Nginx、都要写 `/etc/nginx/sites-available/` 下的文件，而现有那条 `cp` 白名单**把源和目标都写死在 8080 那一个文件上，落 `shop.conf` 用不了**。放在演练之前会改变基线对照组，放在之后则当天要做两轮基线复核。

**必答追问**：① 两笔各排哪一天、相对回滚演练的先后；② `shop.conf` 的写入通道怎么开——再加一条一次性 `cp` 白名单、还是并进同一次 root 会话手工落盘（后者与 §2.1 第 7 项的 root 待补项是同一个窗口，见下）；③ 周计划 §3 那句「本周结束时五面基线全部恢复绿」怎么改口径（8080 下线后是四面，`/showcase/` 落盘后又多一个子路径入口），改在哪个文件里留痕；④ `runbook.md` §4.1 的速查表是 W10 的收口成果，改它要按 D3 P4 ③ 的约定在头部留变更记录，**且它现在是展板 `runbook` tab 的事实源**（G10）——runbook 原文、展板数据、`verify:board` 断言（当前基线 934）三处这次一并改还是分次；⑤ 下线完成后那条一次性 `cp` 白名单条目什么时候删（P4 承诺「用完收回」），删除动作本身要不要 root。

> 答（本人）：
> **P6（2026-08-27 冻结）**：8080 下线排 D4、回滚演练完成后；顺序 = **先落盘 Nginx**（cp → `nginx -t` → reload → 验证 8080 关 + 四面 + `/showcase/` 绿）→ 再改 runbook §4.1 + `RunbookBoard.tsx` + `verify:board` 断言（原子提交；先落盘后改文档，防 cp 失败导致文档先于事实）。追问 2：周计划 §3 收口判据直接改 `week11-plan.md` 那行；runbook 落 §4.1 速查表（头部留变更记录，D3 P4 ③ 约定）；§5.5 七项本不含 8080、不需改（执行时复核，不照抄推断）。追问 3：三处**一并改**原子提交；`verify:board` 硬判据 = 失败 0 项（SKILL 口径），8080 下线后重采集更新断言数值。追问 4：**cp 白名单收回执行不了**（`gpasswd -d` 后 ubuntu 无 visudo/sed 权限）→ 列 **root 通道遗留**，与 L55 并列，变更单注明「待下次 root 需求同一会话闭合」。追问 5：**L55 今天不能闭合**（8080 下线序列走白名单、不产生 root 会话）；做「风险是否仍成立」复核（D3 已评估利用面 0，今天复核确认并记录）；8080 下线关闭的是 8080 明文攻击面，与 L55 是两件事。

---

## 4. 执行记录（滚动，2026-08-27 当天填）

### 时间盒

（当天拍板后填：DEBT 重建 / 阶段 A / B / C / D 各自的起止与收工点判定）

### DEBT 第一档重建结果

| 项 | 内容 |
|---|---|
| 知识点 | Jenkins 日志来源 API 返回类型（`DEBT.md` 2026-08-26 条目） |
| 形态 | 不看笔记复述：① 为什么 `getLog()` 无参版导致 validate-logs 永远绿；② `getLog(int)` 的 tail 语义对扫密钥的可接受性 |
| 结果 | **通过（2026-08-27，第一档）**。首答偏差两条均留痕：① 题一首次把机制猜成「按行切分 + tail 丢弃前段」，与 V9 证据（`size=31663` 字符数、前 5 元素 `S/t/a/r/t` 单字符）矛盾；经提示对照证据后重新推导出「无参版 `String` 被 Groovy 按字符迭代、匹配对象是单字符、假私钥头一直在日志里但永远失配」。② 题二首次把 `getLog(int)` 返回类型答成 `String`，经 L1 讲解（用「修复为什么能判红」反推）更正为 `List<String>`，迭代时每个元素是一整行 |
| 掌握证据 | ① 修改需求预测影响：全量扫描需无参版 + 显式按行拆分（否则退回逐字符迭代），代价分四层（controller JVM 堆 / 网络 IO / `split('\n')` 子串 GC 压力 / 流水线阻塞），取舍 = 全量 + 硬阈值止损（超大日志转人工复核，放弃「任意大日志自动扫描」）；② 失败路径验证设计：构造 15000 行日志、敏感行置于第 5000 行，证明 `getLog(10000)` 漏报发生在数据源截断层，并列出证明 / 未证明边界（未证明 contains 有缺陷、未证明可被攻击利用） |

### 前置核对结果（C1–C6）

| # | 项 | 实测（2026-08-27） | 结论 |
|---|---|---|---|
| C1 | nodeapp 单元形态 | `Type=simple` / `Restart=on-failure` / `RestartSec=10s` / `ExecStart=/usr/bin/node --env-file=.env server.js` | 与 P1 预测前提（Type=simple）一致 |
| C2 | Type / Restart / RestartSec | 同 C1（machine-readable 确认）；start_time `10:45:55` pid=347803（构建 57 部署后） | 同上 |
| C3 | 两个状态文件 | `.previous_commit` = `59dc11d`（**非 `7b90b25`**，构建 57 mark-verified 刷新）；`.rollback_target` = `6da765a` | G5 预期更新 |
| C4 | 演练前线上 commit | `59dc11d`（与 `.previous_commit` 一致） | 一致 |
| C5 | 磁盘 / 内存 | 磁盘可用 **32.2 GiB**（>4 GB）；内存 available **1299 MB** | 阈值内，候选②的 npm ci 有余量 |
| C6 | 端口与样本落点 | `127.0.0.1:3000` = nodeapp；`0.0.0.0:8080/8081/443` = Nginx；`127.0.0.1:27017` = mongo；`/home/ubuntu` = `drwxr-x--- ubuntu ubuntu`（750，可写） | P4 落点可用；Node 服务器 v24.19.0 / 开发机 v24.16.0 |

### 十一步执行进度

（按 §2.2 的步序滚动记录；每步写动作、产出、偏差三项。偏差按 `TECHNICAL-WRITING-PROTOCOL.md` §4 记「原判断 → 实际现象 → 关键证据 → 偏差类型或根因状态 → 修正与待验证项」）

- **步 1（DEBT 重建）**：完成（见上表，已还）。
- **步 2（P1–P6 冻结）**：完成（§3，全部 2026-08-27 冻结）。过程中 AI review 纠偏：P1 端口 8080→3000、Verify 30s 轮询语义；P2 轮询目标事实修正（w11-d2-pipeline 盯 main，非 showcase-deploy）；P3 候选①非二选一；P4 服务器禁 3000（硬边界）、Node 版本不预设一致；P5 路径 /var/lib/deploy-state、七项验证；P6 L55 不能闭合、cp 收回需 root。
- **步 3（C1–C6 前置核对）**：完成（上表）。
- **步 4（部署前基线）**：完成——deploy key `verify` 七项全绿（/health `{"status":"ok"}`、业务 `Hello, World!`、mongosh `{ok:1}`、ss:3000 LISTEN、check-app OK、check-disk OK）；controller 侧 `curl -f https://43-128-154-242.sslip.io/` = 200；五面全 200。
- **步 5（候选①推送）**：完成——`9d08659`（`[DR-20260827]` 前缀，测试文件加 drill-fail 用例）推 main。**偏差 1（关键）**：原判断「轮询会在 5 分钟内触发」→ 实际 11:08 push 后直到 11:13 才触发（构建 58）→ 证据 `scm-polling.log` 11:10 轮询 HTTPS 443 失败（`Failed to connect to github.com port 443 after 47672 ms`）、结果静默记 `No changes`（**D2 发现的「轮询网络失败静默」现场复现**；构建 56/57 成功是间歇窗口）→ 根因：github HTTPS 网络抖动（curl 12s 超时同因）；修正：按 P2 预案本应 Build Now 补触发，但轮询 11:13 自行恢复触发；**记录**：poller 后台循环 510s 后捕获触发。
- **步 5b（候选①撤回）**：`git revert 9d08659` → `fd39799` push → 构建 59 = **SUCCESS**（Test 3 套件 9 用例全绿 → `deploy fd39799` → `mark-verified fd39799`）→ 服务器 HEAD/`.previous_commit` = fd39799、`.rollback_target` = 59dc11d。**P5 追问 3 推演实证**：revert 提交自动触发一次正常部署，mark-verified 写 revert sha；F1 两文件职责区分实证。
- **步 6（候选②推送）**：完成——`eff8766`（`[DR-20260827]` 前缀，server.js 顶层 throw，本地先验证启动即崩/不绑端口）推 main。构建 60：Checkout `eff8766` → Test 绿（V3）→ **Deploy exit 0**（`Deploy eff8766... completed successfully`，P1 预测：Type=simple restart 返回 0）→ **Verify `/health` 30s 超时**（`ERROR: /health not ready after 30s`）→ 构建 FAILURE（V4）。**P1 预测逐条命中**。服务器崩溃循环实证：`throw DR-20260827` + `Main process exited status=1` + `Restart=on-failure RestartSec=10s`（11:28:00 → 11:28:11 反复）。V5：journal 无 `rollback-end`（自动回滚未触发）；`.previous_commit` 未变（fd39799）。
- **步 7（回滚）**：完成——deploy key `rollback`（读 `.previous_commit` = fd39799）→ reset + npm ci + restart → `Rollback to fd39799... completed` exit=0（V6）。V7：HEAD = `.previous_commit` = fd39799；`.rollback_target` = eff8766（rollback 时快照）——F1 职责区分第三次实证。V8：回滚后 §5.5 完整七项全绿 + 443 curl 200。**收工点 B（验收句 A）达成。**
- **步 9（类 2 最小样本·开发机）**：完成——`week11-ci/src/reproduce-close-race.js`（本人实现，v1→v8 迭代：API bug、close 注册位置、sync 收尾逻辑三处由 review 指出后修正）。开发机 v24.16 三模式 × 100 次（3001）：
  - `inCallback`：A=100、listening=true 100、**falseActive=0**（close 总在 cb 后，cb 时 listening 必 true）；
  - `afterListen`：A=100、listening=true 100、**falseActive=0**（listening 回调走 nextTick 微任务，恒先于 setImmediate close）；
  - `sync`：A=**0**（同步 close 直接取消 listen 完成回调）、falseActive=0。
  - **结论**：开发机最小样本三种 close 时序均未复现「回调触发但未绑定」。事实 = 三模式 100 次输出；推断 = Node 语义下 listening 回调先于 close 调度、sync close 取消回调；待验证 = 服务器 v24.19 同脚本对照（步 9b）。
- **步 9b（类 2 最小样本·服务器 + 机制定论）**：完成——服务器 v24.19 三模式 × 100（13000）与开发机结论一致（close 竞争未复现）。**完整 server.js + EADDRINUSE 注入定论机制**：修复前假 active（ALIVE + 无监听 + 成功日志）→ 修复后 exit(1) + FATAL。修复实现 = `server.on('error')` 按 code 区分（EADDRINUSE/EACCES/EADDRNOTAVAIL → exit(1)）。验证：注入 exit=1 ✓、npm test 9/9 ✓、部署验证（构建 62）待确认。

### 验证结果（V1–V12）

| # | 验证项 | 结果 |
|---|---|---|
| V1 | 候选①被哪一阶段拦下 | **Test 阶段 FAILURE**（构建 58）；Deploy/Verify/validate-logs 全部 skipped ✓ |
| V2 | 候选①服务器零改动 | 三值未变 + journal 零 deploy ✓ |
| V3 | 候选②过测试 | 构建 60：`Tests: 9 passed, 9 total`（3 套件全绿）✓ |
| V4 | 候选②止步阶段 | **P1 预测全中**：Deploy exit 0 → Verify `/health` 30s 超时 → 构建 FAILURE，自动回滚不触发 ✓ |
| V5 | 自动回滚未触发 | journal 无 `rollback-end`；`.rollback_target` 未被消费 ✓ |
| V6 | 人工 rollback | `Rollback to fd39799... completed`，exit=0 ✓ |
| V7 | 回滚后版本对照 | HEAD = `.previous_commit` = fd39799 ✓ |
| V8 | 回滚后完整七项 | 全绿 + 443 curl 200 ✓ |

---

## 5. 五段式记录（每类一份，当天现场填）

> 形态引自 W10 [`day4-fault-drills.md`](../../week10-observability/notes/day4-fault-drills.md) §6：现象 → 定位 → 根因 → 修复 → 预防，每段显式标事实 / 推断 / 未验证。

### 5.1 候选①：测试失败的提交

**现象**（事实）：构建 58 = FAILURE，Test 阶段 `FAIL __tests__/monthly-sales.test.js`（`Tests: 1 failed, 9 passed, 10 total`），Deploy / Verify / validate-logs 全部 `skipped due to earlier failure(s)`；`Finished: FAILURE`。

**定位**（事实）：`9d08659` 在 `monthly-sales.test.js` 末尾追加 `drill-fail` 用例（`expect(1).toBe(2)`）——Test 阶段被精确拦下。

**根因**（推断）：演练注入的必然失败用例（预期行为，非故障）。机制意义：Test 阶段是拦截面，且 server.js 等部署对象零改动（V2：HEAD / 状态文件 / journal 均未变）。

**修复**（事实）：`git revert 9d08659` → `fd39799` push → 构建 59 SUCCESS（Test 3 套件 9 用例绿 → `deploy fd39799` → `mark-verified fd39799`）→ 线上自动恢复。

**预防**（推断）：演练提交带 `[DR-20260827]` 前缀 + revert 自动引用锚定；Test 拦截面的价值实证（坏提交不触碰服务器）。

### 5.2 候选②：能过测试但起不来的提交

**现象**（事实）：构建 60：Test 全绿（`Tests: 9 passed, 9 total`）→ Deploy `completed successfully`（exit 0）→ Verify `ERROR: /health not ready after 30s` → 构建 FAILURE；服务器 nodeapp `failed`、`/health` 不通、journald 见 `throw [DR-20260827]...` + `Main process exited status=1` + `Restart=on-failure` 循环（11:28:00→11:28:11）。

**定位**（事实）：**P1 预测逐条命中**——`Type=simple` 下 `systemctl restart` 只保证 fork 成功、返回 0 → Deploy 阶段 exit 0 → **自动回滚不触发**（journal 无 `rollback-end`、`.rollback_target` 未被消费）→ Verify 第一道 `/health` 30s 轮询耗尽报红（V3/V4/V5）。

**根因**（推断）：`eff8766` 在 `server.js` 顶层 `throw`（启动即崩、不绑端口、无存活窗口——P3 冻结的形态）；systemd 语义（Type=simple + Restart=on-failure）把「起不来」变成「Deploy 成功 + Verify 红」的形态。

**修复**（事实）：人工 `deploy-wrapper rollback`（deploy key 通道，读 `.previous_commit` = fd39799）→ `Rollback to fd39799... completed` exit=0（V6）→ 回滚后 §5.5 完整七项全绿（V7/V8）；随后 `git revert eff8766` → `0332de7` push → 构建 61 自动部署恢复（`mark-verified 0332de7`）。

**预防**（推断）：§5.4 回滚判据表第一行（部署中失败→自动回滚）在 Type=simple 下由「restart 返回码」驱动、第二行（验证失败→人工 rollback）由 verify 拦截——两条路径都实测过；`.previous_commit`（最近验证通过）/ `.rollback_target`（本轮快照）两文件职责三次实证；`mark-verified` 保持流水线唯一写入方（P5）。

### 5.3 类 2「假 active」最小样本

**现象**：W10 D4（8/20）nodeapp `active` + `ss` 无 3000 + `/health` 不通 + journald 有「服务运行端口」日志；机制当时未验证。

**定位**（2026-08-27）：最小样本三种 close 时序（inCallback / afterListen / sync）× 开发机 v24.16 + 服务器 v24.19 各 100 次，均未复现「回调触发且 listening=false」——**close 竞争机制否证**。转完整 `server.js` + `EADDRINUSE` 注入（预占 `127.0.0.1:3002` 后 `PORT=3002 node --env-file=.env server.js`）。

**根因**（事实）：`listen` 到被占用端口时，Node 的 **listening 回调仍触发**（打「服务运行端口」日志），**底层 bind 失败**（EADDRINUSE），且 server.js **无 error 监听 → 进程静默存活 = 假 active**。对照证据：修复前注入 → 进程 ALIVE + 3002 无监听 + 成功日志（与 W10 现场同形）；修复后 → `exit(1)` + `[FATAL] EADDRINUSE` 日志。附带发现：IPv6 通配 `*:3002` 不挡 IPv4 `127.0.0.1:3002`，注入须绑同地址。

**修复**：`server.js` 加 `server.on('error')`——`EADDRINUSE`/`EACCES`/`EADDRNOTAVAIL` → `logger.error` + `process.exit(1)`（systemd 按 `Restart=on-failure` 处理，候选②已实证）；其余 server 级错误 warn 保活。已注入验证（exit=1 + FATAL 日志）；npm test 9/9 绿。

**预防**：部署后验证的 `ss :3000` 兜底保留；error 监听使 listen 失败显式化（不再静默存活）；runbook §2.3 ③ 的「机制未验证」条目翻档为已定论。

---

## 6. 明日入口（D5）

由 D4 执行结果定：

- **收工点 A / B / C 全达成（2026-08-27）** → D5 按周计划 §4 D5 的 A–E 走（对照说明成篇 / 口述能力检验 / 延迟重建 / 状态收口 / stretch）。
- 回滚演练两类候选均实测（Test 拦截 + Verify 拦截/人工回滚/自动恢复）；类 2 机制定论并修复上线（`2b9f87b`）。D5 待办：展板 ④ 上板材料（三条路径已走全，可画实证）、8081 重新发布（runbook tab 数据已更新，verify:board 934/934 通过）、D4 笔记与状态文件收口 commit、口语稿补记。

---

## 7. AI 辅助记录

- **协作模式声明（按 `AGENTS.md` §2「协作模式与实现方交付标准」，2026-08-26 新增的口径）**：本日主线 A / B 属**导师模式**——阶段拦截面的判断、回滚路径的选择、类 2 的归因、`server.js` 的修复方向都在黑名单内，AI 只提问、列候选与 review，欠债记账规则照常。本文件的起草与 §2.7 的工具行为属白名单文档整理。若当天出现发布脚本 / 展板资产一类的实现交付，按实现方模式另行声明，并对交付适用那五项标准。
- 2026-08-26：AI 起草本文件——引用 D1 已冻结决策（Q12 / Q13 / Q14 / Q16 / Q17、§5.4 / §5.5 两张表）与周计划 §4 D4，搭四要素框架、写验证行与止步线、列 P1–P6 问题清单。属白名单文档整理。
- **G1–G7 的性质**：AI 读契约 §4.5 / §4.6 / §5.4 / §5.5、周计划 §3 / §4 D4、D3 笔记 §0 与执行记录（含 V12 与网络诊断），并在本地仓库实测 `week2-express/src/__tests__` 的 import 关系（两个集成测试只导入 `app.js`，不导入 `server.js`）后，报出七处覆盖缺口。AI 的动作限于**指出矛盾与覆盖缺口、列候选、出题**；六题的取值全部留空。
- **未代答**：P1–P6 全部待本人作答；坏提交的具体内容、类 2 样本脚本、`server.js` 修复方向均未给实现。
- 工具行为（§2.7 五条）按 `AGENTS.md` §4「必须真实遇过一次才知道」的口径直接讲，不计入辅助阶梯。
- **2026-08-27（开工前修订）**：AI 读 8/26 起草之后进 main 的 31 个提交（展板发布脚本化、异地触发链路变更单与复盘、8/27 的展板 ⑧⑨ 落地、`AGENTS.md` / `BACKLOG.md` / `SHOWCASE-DEPLOY-PROTOCOL.md` / `shop.conf` 的改动），报出 G8–G10 三处新缺口并更新 P2 / P6 的事实前提。动作仍限于**指出缺口与更新事实**，未改任何已冻结取值，六题取值仍留空。
- **起草期未触发 `DEBT.md` 记账**（白名单文档整理 + L1 事实核对）。执行期如再对黑名单知识点给到 L2，按规则当天记账。**注意**：8/26 撤销的是两个发布 skill 的债（按实现方模式口径），`DEBT.md` 里 2026-08-26 的 `Run.getLog()` 返回类型那条**仍为「待还」**，§2.2 第 1 步不变。
- **2026-08-27（执行期，类 2 脚本迭代）**：本人实现 `reproduce-close-race.js` v1→v8；AI review 定位多处逻辑漏洞并给修正方向——① 探测时机在 close 完成后 → 判据 100% 假阳性；② close 注册位置在 cb 内 → 竞争窗口不成立，应移到 `listen()` 调用后与回调竞速；③ sync 模式的 catch / close 回调 / 短兜底缺「cb 未触发 → probe pending」收尾。按辅助阶梯判断，这些属**黑名单（Node 底层 close 竞争 + 测试场景设计）的 L2 定向提示**，**已按规则记入 `DEBT.md`**（2026-08-27 条目，重建安排 W11 D5 或下周）。实现本身（API 拼写、脚本主体、EADDRINUSE 注入方式修正——IPv6 通配 `*:3002` 不挡 IPv4 `127.0.0.1:3002`）属白名单/经验知识。`server.js` 修复实现与验证设计均由本人完成，AI 只 review。

---

## 8. 收尾清单

- [x] DEBT 第一档重建通过（`Run.getLog()` 返回类型），`DEBT.md` 状态更新（**2026-08-27 已还**）
- [x] P1–P6 本人作答并冻结（动手前）——§3 全部 2026-08-27 冻结
- [x] 前置核对 C1–C6 完成（§2.3 + §4 表）
- [x] 四要素（改动清单 / 验证 / 回滚 / 止步）本人核对
- [x] 收工点 A：候选①走完（V1 / V2）
- [x] 收工点 B：候选②走完并回滚到基线（V3–V8）= 验收句 A 达成
- [x] 收工点 C：类 2 最小样本结论分级（V10 / V11）= 验收句 B 达成——**机制定论 + 修复上线**（`2b9f87b`）
- [x] 演练提交已撤回，线上回到已验证版本（`0332de7`，随后 server.js 修复部署 `2b9f87b`），§5.5 七项全绿（V12）
- [x] 顺带项：8080 下线（D4 完成：cp→nginx -t→reload→ss 8080 关闭→四面+/showcase/ 绿→runbook §4.1/周计划 §3/展板数据/verify:board 934 同步）——**一次性 cp 白名单条目收回**：需 root，列持久遗留（P6 冻结）
- [x] 顺带项：`gpasswd -d ubuntu sudo`（8/27 晨已完成）+ L55 lighthouse——本日无 root 会话，**风险复核完成**（9 条固定白名单无 ALL、`sudo -n sed` 读 sudoers 被拒，利用面 0 仍成立），维持持久遗留
- [x] 五段式记录三份成篇（§5.1 / §5.2 / §5.3）
- [ ] 展板 ④「回滚：三条路径，两个指针」所需材料——§5 已写清三条路径全部实测（Test 拦截 / Verify 拦截+人工回滚 / 自动恢复），**今天不上板**，D5 上板可画实证
- [x] G8 的第二把密钥形态已如实记录（V9b，见 §2.3），未顺手收窄、未顺手放宽
- [x] 技术英语口语稿（`DAILY-SPEAKING-PROTOCOL.md`，D2 / D3 顺延项，本日补）——**已补**：`day2-english-speaking.md`（136 词）+ `day4-english-speaking.md`（145 词），D1/D3 已在当日生成，本周四篇齐备
- [x] `week11-plan.md` §4 D4 勾选、`LEARNING-STATE.md` 更新（D4 收口时）
- [x] 必要时 `DEBT.md` 新增条目——未触发（本日 AI 未对黑名单给到 L2，白名单 API 细节修正 + 导师 review 不计债）
