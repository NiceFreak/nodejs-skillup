# W11 Day 3（8/26）：部署段与凭据——在服务器上开出唯一一条可写通道

> 建立：2026-08-25（Asia/Shanghai，D2 收口后起草）
> 上游：[`day1-release-contract.md`](./day1-release-contract.md) §4.4–§4.6 与 §5.1–§5.5（**契约已冻结，本文件不重开任何已拍板的题**）、[`week11-plan.md`](./week11-plan.md) §3.1 与 §4 D3
> 形态参考：[`day2-controller-setup.md`](./day2-controller-setup.md) §2「变更单四要素」、W10 [`day3-monitoring-alerting.md`](../../week10-observability/notes/day3-monitoring-alerting.md) §2 / §3
> 状态：**起草完成，P1–P7 待本人作答**。§0 列出起草期发现的七处契约覆盖缺口，全部指向 §3 的待答题或 §2.3 的前置核对行；不改任何 D1 冻结决策。

---

## 0. 起草期发现的契约覆盖缺口（2026-08-25）

> 本节只记「契约已冻结的决策落到执行层时缺了哪一块」，不改 D1 已拍板的取值。每条给出去向。
> 标注「待核实」的是起草时无法从仓库读出的服务器侧事实——D3 开工前按 §2.3 前置核对采集，不按推断执行。

| # | 覆盖缺口 | 依据 | 去向 |
|---|---|---|---|
| G1 | **Verify 阶段取不到服务器侧证据**。§5.2 的 `command=` 白名单只有 `deploy` / `rollback` / `mark-verified` 三条；而 §5.5 的七项验证里有六项要在服务器上执行（`/health`、`mongosh` ping、业务接口、`ss -lntp`、check-app、check-disk）。部署密钥这条通道执行不了它们；§5.1 阶段 5 写的「本地 127.0.0.1:3000」在 controller 侧指的是开发机，不是服务器 | §5.1 阶段 5、§5.2、§5.5 | §3 P1 |
| G2 | **两个状态文件的写入权限没有覆盖**。wrapper 以 `ubuntu` 身份运行，`.rollback_target` 与 `.previous_commit` 按 §5.4 落在部署目录（属主 `nodeapp:nodeapp`）；sudoers 白名单只允许以 nodeapp 身份执行 `git` 与 `npm` 两条，不含任何写文件的命令。ubuntu 能否直接在该目录建文件取决于目录权限位（**待核实**，C3） | §4.4 Q9、§5.4 | §3 P2 |
| G3 | **Q11 的 `.env` 硬门禁也是服务器侧命令**。`test -f .../.env` 与 G1 同一个通道问题，且同样依赖 ubuntu 能否穿透 `/home/nodeapp/`（**待核实**，C3） | §4.5 Q11 | §3 P1 + C3 |
| G4 | **第一次部署的跳幅与周计划的措辞不一致**。周计划 §4 D3 写「选一个无害提交，例如只改注释或文档」；实际部署形态是 `git reset --hard <sha>`，线上 `6a1b1a1` 落后 `origin/main` **78 个提交**，第一次部署会一次性换掉这 78 个提交。已核对：这 78 个提交里 `week2-express/src` 只改了两处——`package.json` 的 `test` 脚本加 `--maxWorkers=1`、新增 `jest.testTimeout: 30000`，**依赖与 `package-lock.json` 未变**，`npm ci --omit=dev` 的输入因此没变；仓库其余目录的变更量与部署后磁盘占用**未核**（C6） | `git log 6a1b1a1..origin/main`、`git diff` 实测（2026-08-25） | §3 P3 |
| G5 | **sudoers 收窄会同时切掉手工运维通道，白名单集合没定**。Q9 的 F1 已显式接受这项代价，但没有列出手工运维要保留哪些命令；Q17 已拍板本周下线 8080，其执行序列要用 `sudo nginx -t` 与 `sudo systemctl reload nginx`，收窄后这两条会被拒 | §4.4 Q9 F1、§4.6 Q17 | §3 P4 |
| G6 | **Q14 追问③的「先答」还空着**。`systemctl restart nodeapp` 的实际不可用时长 D1 没有写预测值，只写了「D3 用实测校准」；按 `LEARNING-PROTOCOL.md` §4 的先答后对，实测前要先有预测数 | §4.5 Q14 追问③ | §3 P5 |
| G7 | **validate-logs 的日志来源 API 标着「D2/D3 定」，D2 未定**。两个候选（`currentBuild.rawBuild.getLog()` 需脚本安全批准；直接读 `${JENKINS_HOME}/jobs/.../builds/<n>/log`）在 D2 装起来的 2.568.2 上哪一个可用，未验证 | §4.4 Q10 F5、§5.2 | §3 P6 |

---

## 1. 今日唯一主线与验收句

**主线**：按 D1 契约在服务器上建立部署身份与权限清单，把凭据接进流水线，执行第一次自动部署，并把部署后验证接进流水线。

**验收句（周计划 §4 D3 已冻结，不改字）**：

> **一次提交能自动走到服务器换版本，构建日志里同时看得到「部署前的 commit」「部署后的 commit」「五面 curl 与四项检查的结果」；构建日志里查不到密钥。**

**今天真正要拿到的东西**（不是「会配 sudoers」）：

| 问题 | 今天用什么回答它 |
|---|---|
| 一条自动化通道凭什么算最小权限？ | 清单之外的命令**当场被拒并留下输出**（§2.3 V2 / V3）。没有被拒过的白名单，区分不了「限制生效」与「限制根本没配上」。 |
| 「日志里查不到密钥」凭什么算验证过？ | validate-logs 要**报过一次红**（§2.3 V9 反向证明）。与 W10 D3 的判据同型：只见绿不算证据。 |
| 部署后验证覆盖到哪一层？ | §5.5 七项按表序跑完，其中公网 443 curl 是补 W10 盲区②的唯一一项；`/health` 只作第一道冒烟，不作唯一依据。 |

**硬边界**：本日所有服务器改动限于身份、权限、wrapper、状态文件与部署本身。不改 Nginx、证书、ufw、`.env` 内容、业务代码与 `nodeapp` unit（周计划 §3.1 凭据纪律）。

---

## 2. 变更单（动手前冻结，四要素）

### 2.1 改动清单 —— 今天就这几项，别的都不动

**服务器侧（有副作用）**

1. 安装 `deploy-wrapper` 到 `/usr/local/bin/deploy-wrapper`，属主 `root:root`、权限 755（§5.2 末行）。脚本内容按 Q9 冻结的三条白名单命令与正则由**本人实现**，本文件不给实现。
2. 追加部署公钥到 `~ubuntu/.ssh/authorized_keys` 单独一行，前缀 `command="/usr/local/bin/deploy-wrapper"`。是否叠加 `no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty`（或 `restrict`）由本人决定并记录——契约未写这一层，加了会同时挡掉端口转发这条旁路。
3. 替换 ubuntu 的 sudo 权限为 Q9 白名单：先按 C4 盘点 `/etc/sudoers` 与 `/etc/sudoers.d/*` 的**全部来源**，再逐文件替换；`/usr/bin/npm` 与 `/usr/bin/git` 的实际路径按 C1 实测值写。
4. 初始化回滚基线：`.previous_commit` = `6a1b1a1`（§5.4 B1 首次基线，信任边界照抄契约：未经部署后验证，仅作首次应急回滚点）。两个状态文件的落点由 P2 定。
5. 第一次自动部署本身（服务器换版本 + `npm ci --omit=dev` + `systemctl restart nodeapp`）。
6. **顺带项**：`check-disk.sh` 属主 `ubuntu:ubuntu` → `root:root`（W10 移交，2026-08-25 由 D2 移入）。走 §2.6 独立变更单，与主线无依赖。

**开发机 / Jenkins 侧**

7. job 的 `Branch Specifier` 改回 `*/main`（消除 D2 P3+P4 的临时偏差；Jenkinsfile 已在 main `1349188`）。**这是今天的第一件事。**
8. 生成部署专用密钥对 `id_rsa_deploy`（与个人密钥物理隔离）；密钥类型契约未指定，选定后在 §4 记录。
9. Jenkins Credentials 新增 `jenkins-deploy-key`（类型 `SSH Username with private key`）。
10. `week11-ci/Jenkinsfile` 增加 Deploy / Verify / validate-logs 阶段（阶段逻辑属本人实现，本文件只引用 §5.1 的失败判据，不给实现）。

**明确不动**：Nginx 配置与 reload、证书、ufw 规则、`.env` 内容、业务代码、`nodeapp.service` 单元、服务器上未跟踪的 `week8-fullstack/src/frontend/dist-admin443/`（§5.1 已定不使用 `git clean -fd`，`git reset --hard` 不删未跟踪文件；这个目录是 443 `/admin/` 面的静态产物，删掉等于打掉一个公网面）。

### 2.2 执行顺序（提议，待本人拍板）

> 顺序本身有一处硬约束：**第 8 步之前，`command=` 与 sudoers 必须已经生效并通过越权验证**——不能在权限还没收窄时先把可写通道交给自动化。

| 阶段 | 步 | 动作 | 产出 |
|---|---|---|---|
| — | 1 | job `Branch Specifier` 改回 `*/main`，跑一次构建确认三阶段仍绿 | D2 临时偏差消除 |
| A | 2 | 前置核对 C1–C6（只读） | 契约 §5.5 的路径占位替换为实测值 |
| A | 3 | 装 wrapper（第 1 项），本地先用 `SSH_ORIGINAL_COMMAND` 直接调用做白名单自测 | wrapper 可用 |
| A | 4 | 生成密钥对、装公钥带 `command=`（第 2 项） | 部署通道存在 |
| A | 5 | 收窄 sudoers（第 3 项，保留一个已登录会话不退出） | 最小权限生效 |
| A | 6 | 越权验证两层（V2 / V3）+ 白名单内可用性验证（V4） | **收工点 A** |
| B | 7 | 初始化状态文件（第 4 项）、采部署前基线（V6） | 回滚目标与对照组 |
| B | 8 | 私钥入 Jenkins Credentials（第 9 项） | 凭据可注入 |
| B | 9 | 写 Deploy / Verify / validate-logs 阶段（第 10 项） | 流水线成篇 |
| B | 10 | 第一次自动部署 + §5.5 七项验证 + `mark-verified` | **收工点 B（验收句）** |
| B | 11 | validate-logs 反向证明（V9）、restart 不可用时长实测（V10） | 判据可信 |
| C | 12 | 顺带项 check-disk 属主（§2.6） | W10 移交销项 |

### 2.3 验证 = 可证伪实验（动手前写死期望，实测栏当天填）

**前置核对（只读，动手前）**

| # | 命令 | 要拿到什么 | 实测 |
|---|---|---|---|
| C1 | `which npm`；`which git`；`systemctl cat check-app.service check-disk.service` | sudoers 白名单要写的真实路径；两个检查脚本的真实路径（替换 §5.5 的占位） | |
| C2 | `command -v mongosh` | §5.5 的数据库连通项是否成立；不存在则该项当天改判或改用其他探测方式 | |
| C3 | `ls -ld /home/nodeapp /home/nodeapp/nodejs-skillup /home/nodeapp/nodejs-skillup/week2-express/src` | ubuntu 能否穿透与写入（决定 G2 / G3 的可行解） | |
| C4 | `sudo -l -U ubuntu`；`ls /etc/sudoers.d/` | 收窄前的全部权限来源快照（回滚对照组） | |
| C5 | `git -C /home/nodeapp/nodejs-skillup rev-parse HEAD`；`git --version` | 部署前 commit（预期 `6a1b1a1`）；safe.directory 相关行为 | |
| C6 | `df -B1 /`；`free -m` | 部署前磁盘与内存余量（预期可用 > 4 GB，available 约 1169 MB 量级） | |

**改动验证（每项先写死期望）**

| # | 验证项 | 命令 | 期望 | 实测 |
|---|---|---|---|---|
| V1 | sudoers 语法 | `sudo visudo -c` | 全部文件 `parsed OK` | |
| V2 | `command=` 层越权 | `ssh -i id_rsa_deploy ubuntu@<server> "echo hi"` | 不输出 `hi`；输出 `ERROR: Invalid command`；退出码非零 | |
| V3 | sudoers 层越权 | `ssh -i <个人密钥> ubuntu@<server> "sudo systemctl start nginx"` | 非零 + `sudo: ... command not allowed` | |
| V4 | 白名单内仍可用 | `ssh -i <个人密钥> ubuntu@<server> "sudo -u nodeapp git -C <部署目录> status"` | 退出码 0 | |
| V5 | wrapper 属主权限 | `stat -c '%U:%G %a' /usr/local/bin/deploy-wrapper` | `root:root 755` | |
| V6 | 部署前基线 | C5 的 HEAD + §5.5 七项在部署前各跑一次 | HEAD = `6a1b1a1`；七项全绿（作为对照组） | |
| V7 | 验收句第 1、2 段 | 构建日志 | 同一次构建里同时出现部署前 commit 与部署后 commit，且部署后 = 本次构建的 commit | |
| V8 | 部署后验证 | §5.5 七项按表序 | 七项全绿；公网 443 curl 200（补盲区②） | |
| V9 | validate-logs 报过红 | 临时在某一阶段打印一段假私钥头（`BEGIN OPENSSH PRIVATE KEY`）跑一次构建 | 该次构建**被 validate-logs 判失败**；移除后再跑一次恢复绿 | |
| V10 | restart 不可用时长 | 部署窗口内对 `127.0.0.1:3000/health` 高频轮询计时 | 实测秒数，与 P5 的预测对照；用于校准 Q14 的 5 分钟窗口 | |
| V11 | 部署标记 | `journalctl -t DEPLOY --since today` | 见 `deploy-start <commit> <build>` 与 `deploy-end <commit> success`，commit 与 BUILD_NUMBER 与本次构建匹配 | |
| V12 | 回滚基线更新 | Verify 通过后读 `.previous_commit` | 内容 = 本次部署的 commit（由 `mark-verified` 写入） | |
| V13 | 未跟踪产物保全 | 部署后 `ls <部署目录上级>/week8-fullstack/src/frontend/dist-admin443/`；`curl -f https://43-128-154-242.sslip.io/admin/` | 目录仍在；`/admin/` 面 200 | |
| V14 | 磁盘未越线 | 部署后 `df -B1 /` + 手工触发 check-disk | 可用量仍在字节级判据之上，check-disk 输出 OK | |

### 2.4 回滚（动手前写好卸载路径）

| 改动 | 回滚动作 | 前置准备 |
|---|---|---|
| sudoers 收窄 | 用保留的已登录会话恢复备份文件，`visudo -c` 复核 | 改动前 `sudo cp` 备份每个被改文件；**收窄期间保留一个已登录 SSH 会话不退出**，直到 V3 / V4 通过 |
| 部署公钥 + `command=` | 删除 `authorized_keys` 中新增的那一行 | 改动前备份 `authorized_keys` |
| deploy-wrapper | `sudo rm /usr/local/bin/deploy-wrapper` | 无 |
| 第一次部署失败 | 按 §5.4 回滚判据表：部署中失败 → 自动回滚到 `.rollback_target`；部署后验证失败 → 人工 `deploy-wrapper rollback`（读 `.previous_commit`） | V6 的基线已采 |
| Jenkinsfile 新阶段 | job 切回 D2 的三阶段版本（`1349188`），或 `git revert` | 无 |
| check-disk 属主 | `sudo chown ubuntu:ubuntu <路径>` 还原 | 改动前记录原属主 |

### 2.5 止步条件与时间盒

**阶段收工点**（D2 F7 的教训：只写「当天做不完就止步」不够用）

- **收工点 A**：V1–V5 全部通过。达成即视为「服务器上的最小权限通道已建立且验证过」，当天即使不进 B 也有可交付结论。
- **收工点 B**：V6–V8 通过 = 验收句三段达成。
- **A 未达成不进 B**：权限没收窄就把私钥交给自动化，等于用一把能执行任意命令的钥匙做第一次部署。

**止步线**

1. `sudo` 自身不可用（配置写坏）→ 立即用保留会话恢复备份，当天不再动 sudoers，主线转为「用现有权限完成部署链，权限收窄顺延」。
2. 第一次部署后验证不绿、且回滚之后仍不绿 → 按周计划 §3.1 止步线，停止本周流水线实验，当天转手工修复与复盘（按 runbook 走）。
3. 时间盒到点仍未进入阶段 B → 第一次部署顺延 D4，D4 的回滚演练相应压缩到一类（周计划 §4 D4 的候选②优先，它才验证回滚路径）。
4. 出现契约未覆盖的新决策点 → 停下来写进 §3 并作答，不在执行中临场拍板（D2 的 F1 / F2 就是这样漏掉的）。

### 2.6 顺带项独立变更单：`check-disk.sh` 属主

| 要素 | 内容 |
|---|---|
| 改动 | `check-disk.sh` 属主 `ubuntu:ubuntu` → `root:root`（路径按 C1 的 `systemctl cat` 实测值，不用契约 §5.5 的占位） |
| 为什么 | 该脚本由 root 身份的 systemd oneshot 执行；属主可写等于给 ubuntu 一条改写 root 执行内容的通道。与主线的 wrapper 属主判据（§5.2 末行）同一条理由 |
| 验证 | `stat -c '%U:%G %a'` = `root:root` + 权限位不含 group/other 写；`systemctl start check-disk.service` 后 `journalctl -u check-disk.service` 仍输出 OK |
| 回滚 | `sudo chown ubuntu:ubuntu <路径>` |
| 止步 | 改完 check-disk 报红或不执行 → 立即还原属主，该项顺延 |

### 2.7 执行期已知工具行为（经验知识，按 `AGENTS.md` §4 直接列，不考核先答）

1. **`sudo -u nodeapp npm ci` 的 HOME**：`sudo -u` 默认不重置 `HOME`，npm 可能仍以调用者的 home 找缓存与配置，表现为权限拒绝或缓存写到别人的目录。`sudo -u nodeapp -H` 或显式设 `HOME=/home/nodeapp` 可避开。这一条 D3 实测时如出现 `EACCES`，先看 `npm config get cache` 的实际取值。
2. **sudoers 写坏会锁死提权**：`visudo` 会在保存前校验；直接 `vi /etc/sudoers.d/x` 不会。改动期间保留一个已登录会话是唯一低成本的兜底——新会话拿不到 sudo 时，旧会话里的 sudo 仍然有效。
3. **`command=` 通道的执行环境**：客户端命令进 `SSH_ORIGINAL_COMMAND`，wrapper 拿到的位置参数为空；该会话默认无 tty、PATH 是登录 shell 的最小集，脚本里用绝对路径更稳。
4. **`journalctl -t DEPLOY`** 与 W10 的 `-t DRILL` 同型：标签只是 syslog tag，任何登录用户都能写（Q14 的 B2 已按这一点把信任依据改成交叉验证）。

---

## 3. 需要本人拍板的执行期决策（答完冻结，动手前不留空）

> 每题一个设计点。选项只列不选；`AGENTS.md` §2 的黑名单止步 L2 在本节同样适用。

### P1（Verify 通道）受 `command=` 限制的部署密钥，怎么取到服务器侧的验证证据？

**为什么问它**：G1。§5.5 七项里有六项要在服务器上跑，而部署密钥只能执行三条白名单命令；§5.1 阶段 5 写的「本地 127.0.0.1:3000」在 controller 侧指开发机，照字面执行会验错对象。Q11 的 `.env` 硬门禁（G3）是同一个问题。

**必答追问**：① 选定方案后，白名单从三条变成几条，每条的正则是什么；② 新增的通道能不能被用来执行清单外的命令，怎么验证（V2 要相应扩展）；③ 验证输出怎么回到构建日志——wrapper 打印到 stdout 由 ssh 带回，还是别的形态。

**候选（只列不选）**：① wrapper 增加 `verify` 与 `precheck` 命令，服务器侧跑完整清单后把结果打到 stdout；② 为验证单独配一把只读密钥与只读 wrapper，两把钥匙职责分开；③ 只保留 controller 能直接做的验证（公网 443 curl），服务器侧项改由 wrapper 在 `deploy` 命令内部顺带执行并打印。

> 答（本人，待作答）：

### P2（状态文件落点）`.rollback_target` 与 `.previous_commit` 写在哪、由谁写？

**为什么问它**：G2。wrapper 以 ubuntu 运行，两个文件按 §5.4 落在属主 nodeapp 的部署目录；sudoers 白名单只有 `git` 与 `npm` 两条以 nodeapp 身份执行，没有写文件的命令。

**必答追问**：① 选定落点后，谁是文件属主、权限位是多少，ubuntu 之外还有谁能写；② 若落点仍在部署目录，`git reset --hard` 与将来可能的 `git clean` 会不会碰它（现已定不使用 `git clean -fd`，这条依赖要显式写下来）；③ 两个文件的职责区分（§5.4 表）在选定落点后是否仍然成立。

**候选（只列不选）**：① 移到 ubuntu 自己可写的目录（如 `/var/lib/deploy-state/`，属主 ubuntu），部署目录内不放状态；② 保留在部署目录，把文件属主改为 ubuntu（依赖 C3 的目录权限位）；③ 给 sudoers 增加一条以 nodeapp 身份写文件的命令——需要说清它的爆炸半径。

> 答（本人，待作答）：

### P3（第一次部署的对象）第一次自动部署部署哪个 commit？

**为什么问它**：G4。周计划写的「无害提交」在 `git reset --hard` 形态下不成立：线上 `6a1b1a1` 落后 `origin/main` 78 个提交，第一次部署等于一次性换掉这 78 个。已核实 `week2-express/src` 在这 78 个提交里只改了 `package.json` 的 `test` 脚本与 `jest.testTimeout`，依赖与 lockfile 未变；未核实的是仓库其余目录带来的磁盘占用变化（C6 / V14）。

**必答追问**：① 若直接部署 `origin/main` HEAD，回滚基线 `6a1b1a1` 与新版本之间隔 78 个提交，回滚一次要重装依赖并重启——这个代价接受不接受；② 若先手工把服务器 fetch 到接近 main 再让流水线部署一个新的小提交，那么「第一次自动部署」验证的到底是哪一段，手工那一步算不算削弱了验收句；③ 无论选哪个，部署后 `git status` 里的未跟踪产物（`dist-admin443/`）是否仍在（V13）。

> 答（本人，待作答）：

### P4（手工运维白名单）sudoers 收窄后，保留哪些手工运维命令？

**为什么问它**：G5。Q9 的 F1 已接受「收窄后手工运维要先进白名单」这项代价，但没列集合。且 Q17 已拍板本周下线 8080，它的执行序列要 `sudo nginx -t` 与 `sudo systemctl reload nginx`。

**必答追问**：① 列出保留命令与各自的理由，说清每条为什么不构成绕过（例如允许 `systemctl reload nginx` 等于允许用改过的配置生效，前提是配置文件本身 ubuntu 不可写——这一点要核）；② 8080 下线安排在收窄之前、之后还是同日：之前则不受影响，之后则该序列的两条命令必须在白名单里；③ 收窄后 `journalctl -u nodeapp` 这类排障命令还能不能跑，跑不了时 runbook 的通用首查要怎么改（runbook 是 W10 的收口成果，改它要留痕）。

> 答（本人，待作答）：

### P5（先答后对）`systemctl restart nodeapp` 的不可用时长预测是多少秒？

**为什么问它**：G6。Q14 的静默窗口取 5 分钟，依据写的是「npm ci + 重启 + 验证的合理上限」，而重启这一段的实测值 D1 没有。按 `LEARNING-PROTOCOL.md` §4，先写预测再实测（V10）。

**必答追问**：① 预测的是哪一段——从 `systemctl restart` 发出到 `/health` 再次 200，还是到 `ss` 见 3000 监听，两者不一定同时；② 若实测显著超出预测，5 分钟窗口是调窄还是保持，依据是什么（冲突自查第 5 条：过窄误报，过宽盖住真故障）。

> 答（本人，待作答，实测前写）：

### P6（validate-logs 的日志来源）用哪一个 API 取当次构建日志？

**为什么问它**：G7。Q10 的 F5 列了两个候选并标「D2/D3 定」，D2 未定。

**必答追问**：① 选定后，脚本安全批准（若走 Groovy）是不是一次性动作，批准的是哪个方法签名；② 取日志的时机——validate-logs 自己那一段的输出会不会还没落盘，导致漏检；③ 搜到敏感模式时，失败信息本身怎么写才不会把命中的内容再打印一遍。

> 答（本人，待作答）：

### P7（触发方式与轮询静默）第一次部署由什么触发？D2 发现的轮询静默失败怎么对付？

**为什么问它**：D2 实测到 Poll SCM 在 github.com 443 间歇失败时把失败记为 `No changes`，不触发也不报错。D3 起流水线带部署段，静默错过提交的后果从「构建晚一轮」变成「以为已经上线其实没有」。

**必答追问**：① 第一次部署用手工 `Build Now` 还是等轮询自动触发——手工触发能不能满足验收句里的「一次提交能自动走到」；② 长期对策取哪一档：定期看 polling log、部署后用 `.previous_commit` 与 `origin/main` HEAD 对账、或别的形态；③ 对账动作放在哪一侧执行（与 P1 的通道问题相关）。

> 答（本人，待作答）：

---

## 4. 执行记录（滚动，2026-08-26 当天填）

### 时间盒

（当天拍板后填：阶段 A / B / C 各自的起止与收工点判定）

### 前置核对结果（C1–C6）

（填实测输出；§5.5 的路径占位在此替换为实测值）

### 十二步执行进度

（按 §2.2 表逐步记录：做了什么、观察到什么、与期望的偏差）

---

## 5. 验证证据

（对应 §2.3 两张表逐项填实测结果；偏差按 `TECHNICAL-WRITING-PROTOCOL.md` §4 的「原判断 → 实际现象 → 关键证据 → 偏差类型或根因状态 → 修正与待验证项」记录）

---

## 6. 明日入口（D4）

由 D3 执行结果定：

- 未达成收工点 A → 先解决权限通道问题，D4 主线顺延；
- 达成 A 未达成 B → D4 先做第一次部署，回滚演练压缩到候选②（能过测试但起不来的提交）一类；
- A、B 均达成 → D4 按周计划：回滚演练主场（两类候选至少一类）+ 类 2「假 active」最小样本复现（Q16 已定复现方案，不定 `server.js` 改动）。

---

## 7. AI 辅助记录

- 2026-08-25：AI 起草本文件——引用 D1 已冻结决策与 §5.1–§5.5 五张表、搭四要素框架、写验证行与止步线、列 P1–P7 问题清单。属白名单文档整理。
- **G1–G7 的性质**：AI 读契约 §4.4–§4.6、§5.1–§5.5、周计划 §3.1 / §4 D3、D2 笔记 §0 与执行记录、`week11-ci/Jenkinsfile`，并在本地仓库实测 `git log 6a1b1a1..origin/main`（78 个提交）与 `git diff -- week2-express/src`（只改 `package.json` 两处）后，报出七处覆盖缺口。AI 的动作限于**指出矛盾与覆盖缺口、列候选、出题**；七题的取值全部留空。
- **未代答**：P1–P7 全部待本人作答；deploy-wrapper 脚本内容、Jenkinsfile 的 Deploy / Verify / validate-logs 阶段逻辑均未给实现。
- 工具行为（§2.7 四条：`sudo -u` 的 HOME、visudo 校验与保留会话、`command=` 通道的执行环境、syslog tag 的可写性）按 `AGENTS.md` §4「必须真实遇过一次才知道」的口径直接讲，不计入辅助阶梯。
- **未触发 `DEBT.md` 记账**（白名单文档整理 + L1 事实核对，黑名单零实现，全程未越过 L2）。
- 待补充：D3 执行后回填本段实际援助级别。

---

## 8. 收尾清单

- [ ] P1–P7 本人作答并冻结（动手前）
- [ ] 前置核对 C1–C6 完成，§5.5 的路径占位替换为实测值（同步回 `day1-release-contract.md`）
- [ ] 四要素（改动清单 / 验证 / 回滚 / 止步）本人核对
- [ ] job `Branch Specifier` 改回 `*/main`（D2 临时偏差消除）
- [ ] 收工点 A：V1–V5 全部通过
- [ ] 收工点 B：V6–V8 通过 = 验收句三段达成
- [ ] V9 validate-logs 反向证明（报过一次红再恢复绿）
- [ ] V10 restart 不可用时长实测，与 P5 预测对照，Q14 的 5 分钟窗口据此校准或维持
- [ ] 顺带项 §2.6 check-disk 属主完成或写清去向
- [ ] 必要时 `DEBT.md`（未触发时写明「未触发」）
- [ ] `week11-plan.md` §4 D3 勾选、`LEARNING-STATE.md` 更新
- [ ] 技术英语口语稿（按 `DAILY-SPEAKING-PROTOCOL.md`）——D2 未做，D3 决定是否补
