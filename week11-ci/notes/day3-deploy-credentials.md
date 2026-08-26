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

> **状态（2026-08-26）**：P1–P7 已全部作答并 review 冻结（答案见各题「答（本人）」块）；D1–D5 已作答冻结（2026-08-26），见 §3 末尾。

> 每题一个设计点。选项只列不选；`AGENTS.md` §2 的黑名单止步 L2 在本节同样适用。

### P1（Verify 通道）受 `command=` 限制的部署密钥，怎么取到服务器侧的验证证据？

**为什么问它**：G1。§5.5 七项里有六项要在服务器上跑，而部署密钥只能执行三条白名单命令；§5.1 阶段 5 写的「本地 127.0.0.1:3000」在 controller 侧指开发机，照字面执行会验错对象。Q11 的 `.env` 硬门禁（G3）是同一个问题。

**必答追问**：① 选定方案后，白名单从三条变成几条，每条的正则是什么；② 新增的通道能不能被用来执行清单外的命令，怎么验证（V2 要相应扩展）；③ 验证输出怎么回到构建日志——wrapper 打印到 stdout 由 ssh 带回，还是别的形态。

**候选（只列不选）**：① wrapper 增加 `verify` 与 `precheck` 命令，服务器侧跑完整清单后把结果打到 stdout；② 为验证单独配一把只读密钥与只读 wrapper，两把钥匙职责分开；③ 只保留 controller 能直接做的验证（公网 443 curl），服务器侧项改由 wrapper 在 `deploy` 命令内部顺带执行并打印。

> 答（本人，2026-08-26 冻结）：
> **方案①**：wrapper 增加 `verify` 命令，command= 白名单 3→4 条（`^deploy [0-9a-f]{40}$` / `rollback` / `^mark-verified [0-9a-f]{40}$` / `^verify$`），由阶段 5 独立调用。弃方案③——验证进 deploy 会把「Verify 失败不自动回滚」塞进「Deploy 失败自动回滚」语义（Q4 阶段表），且流水线可见阶段从 5 缩成 4。
> ① 归属（修正后）：服务器侧 6 项（`/health`、本地业务接口 `127.0.0.1:3000/`、mongosh ping、`ss`、check-app、check-disk）+ controller 侧 1 项（公网 443 curl）。「业务接口」绑定 localhost，controller 无法直达，属服务器侧。
> ② `authorized_keys` **单行** `command="/usr/local/bin/deploy-wrapper"` + `no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty`（决策：叠加，挡端口转发旁路）；wrapper 从 `SSH_ORIGINAL_COMMAND` 读取客户端命令，正则白名单校验后分发；verify 无参数、不透传；V2 越权验证扩展 verify 用例。
> ③ verify 打到 stdout 由 ssh 带回构建日志；controller 公网 curl 在 ssh 返回后补；任一服务器侧验证失败 → verify 非零 → 阶段 5 报红、**不触发自动回滚**（Q12/Q13 语义）。verify 内部先等 `/health` 恢复（30s 超时）再触发 check-app/check-disk，避免误报。
> 标记：verify 触发 check-app/check-disk 需要 sudoers 新条目（已在 P4 白名单收口）；`.previous_commit` 的写入通道 = mark-verified，调用时点留阶段 5 流程（P2 联动）。

### P2（状态文件落点）`.rollback_target` 与 `.previous_commit` 写在哪、由谁写？

**为什么问它**：G2。wrapper 以 ubuntu 运行，两个文件按 §5.4 落在属主 nodeapp 的部署目录；sudoers 白名单只有 `git` 与 `npm` 两条以 nodeapp 身份执行，没有写文件的命令。

**必答追问**：① 选定落点后，谁是文件属主、权限位是多少，ubuntu 之外还有谁能写；② 若落点仍在部署目录，`git reset --hard` 与将来可能的 `git clean` 会不会碰它（现已定不使用 `git clean -fd`，这条依赖要显式写下来）；③ 两个文件的职责区分（§5.4 表）在选定落点后是否仍然成立。

**候选（只列不选）**：① 移到 ubuntu 自己可写的目录（如 `/var/lib/deploy-state/`，属主 ubuntu），部署目录内不放状态；② 保留在部署目录，把文件属主改为 ubuntu（依赖 C3 的目录权限位）；③ 给 sudoers 增加一条以 nodeapp 身份写文件的命令——需要说清它的爆炸半径。

> 答（本人，2026-08-26 冻结）：
> **方案①**：状态文件移 `/var/lib/deploy-state/`（属主 ubuntu，目录 750、文件 640）。wrapper 以 ubuntu 身份直接读写，不需 sudo、不新增 nodeapp 写文件命令、与部署目录完全隔离。目录创建 = 收窄前手工变更单（P4 冻结，不放白名单）。
> **职责区分（C1 纠正后定稿）**：
> - `.rollback_target`：deploy 命令部署开始时写「当前运行 commit」；**消费方 = deploy-wrapper 自己的 deploy 分支**（同一 SSH 会话内 `git reset --hard $(cat .rollback_target)` + npm ci + restart，Q13 自动回滚），Jenkins 层不介入；`rollback` 命令**不读**它。
> - `.previous_commit`：`mark-verified` 在 Verify 全通过后写「本次部署 sha」；消费方 = `rollback` 命令（人工触发），**只读它、不接受外部 SHA**（Q9）。
> ② `git reset --hard` / 未来 `git clean` 均不碰状态文件（已移出部署目录）；「契约禁 `git clean -fd`」显式依赖保留。
> ③ 职责区分在新落点完全成立：两份文件写入时点分离、读取场景分离，ubuntu 之外仅 root（sudo）可写。

### P3（第一次部署的对象）第一次自动部署部署哪个 commit？

**为什么问它**：G4。周计划写的「无害提交」在 `git reset --hard` 形态下不成立：线上 `6a1b1a1` 落后 `origin/main` 78 个提交，第一次部署等于一次性换掉这 78 个。已核实 `week2-express/src` 在这 78 个提交里只改了 `package.json` 的 `test` 脚本与 `jest.testTimeout`，依赖与 lockfile 未变；未核实的是仓库其余目录带来的磁盘占用变化（C6 / V14）。

**必答追问**：① 若直接部署 `origin/main` HEAD，回滚基线 `6a1b1a1` 与新版本之间隔 78 个提交，回滚一次要重装依赖并重启——这个代价接受不接受；② 若先手工把服务器 fetch 到接近 main 再让流水线部署一个新的小提交，那么「第一次自动部署」验证的到底是哪一段，手工那一步算不算削弱了验收句；③ 无论选哪个，部署后 `git status` 里的未跟踪产物（`dist-admin443/`）是否仍在（V13）。

> 答（本人，2026-08-26 冻结）：
> **直接部署 `origin/main` HEAD**（G4' 实测 80 个提交：部署单元 `week2-express/src` 仅 `package.json` 的 `test` 脚本 `--maxWorkers=1` 与 `jest.testTimeout` 两处 dev 侧改动；dependencies / lockfile / 生产代码（app.js/server.js/utils）零变化 → `npm ci --omit=dev` 输入不变，运行时差异为零）。不手工预同步——会把验收句「自动」断言拆断且不可重复。
> ① 回滚代价接受：reset 秒级 + `npm ci --omit=dev` 重装**同套依赖**（1–3 分钟）+ restart 秒级 ≈ 2–4 分钟。验证失败时 mark-verified 不被调用，`.previous_commit` 仍 = `6a1b1a1`，人工 rollback 回到安全基线（**不是** main HEAD）；「回滚到 main HEAD = 无操作」只在验证通过后再次人工回滚时出现（设计副作用）。
> ③ V13 必验：`/home/nodeapp/nodejs-skillup/week8-fullstack/src/frontend/dist-admin443/`（属主 nodeapp 755）存在 + 内容非空 + controller 公网 curl `/admin/` 200（curl 在 controller 侧，不混入 verify stdout）。

### P4（手工运维白名单）sudoers 收窄后，保留哪些手工运维命令？

**为什么问它**：G5。Q9 的 F1 已接受「收窄后手工运维要先进白名单」这项代价，但没列集合。且 Q17 已拍板本周下线 8080，它的执行序列要 `sudo nginx -t` 与 `sudo systemctl reload nginx`。

**必答追问**：① 列出保留命令与各自的理由，说清每条为什么不构成绕过（例如允许 `systemctl reload nginx` 等于允许用改过的配置生效，前提是配置文件本身 ubuntu 不可写——这一点要核）；② 8080 下线安排在收窄之前、之后还是同日：之前则不受影响，之后则该序列的两条命令必须在白名单里；③ 收窄后 `journalctl -u nodeapp` 这类排障命令还能不能跑，跑不了时 runbook 的通用首查要怎么改（runbook 是 W10 的收口成果，改它要留痕）。

> 答（本人，2026-08-26 冻结，第二次修正版）：
> **sudoers 白名单 8 条，按契约身份分组，无 `(ALL)`**：
> - `(nodeapp)`：`/usr/bin/git`、`/usr/bin/npm`（部署命脉，Q9 契约）
> - `(root)`：`/usr/bin/systemctl restart nodeapp`、`/usr/bin/systemctl status nodeapp`（契约 §5.2 已有）；`/usr/bin/journalctl -u nodeapp`、`/usr/sbin/nginx -t`、`/usr/bin/systemctl reload nginx`（排障只读；nginx 路径以 C1 `which nginx` 实测为准）；`/usr/bin/cp /tmp/nginx-shop-admin-8080-removed /etc/nginx/sites-available/shop-admin`（8080 下线一次性通道，源/目标文件名以 C4 实测为准）
> ① 不构成绕过：cp 源在 /tmp（可被篡改）→ **用完收回**（D4/D5 下线完成后即删 sudoers 条目 + 清理源文件）；`nginx -t` 只测不生效；`reload` 只生效不改文件（/etc/nginx 属主 root，ubuntu 不可写）；`journalctl -u nodeapp` 参数锁到 `-u nodeapp`，行数控制交给 shell 管道。**明确拒绝**：vi/nano/vim、chown/chmod、passwd、`sudo -u nodeapp`、su、start/stop nodeapp。
> ② 8080 下线排 **D4/D5**（D3 硬边界禁改 Nginx）；`nginx -t` / `reload` 定位为收窄后持久排障通道；编辑配置通道 = 收窄前手工准备 `/tmp/nginx-shop-admin-8080-removed` + cp 白名单落位。
> ③ runbook 只改 3 条提权命令（journalctl / nginx -t / reload 加 sudo 前缀）；curl/ss/df/free/systemctl status 不变不加 sudo（加 sudo 反而会被白名单拒）；改**原文件** `week10-observability/notes/runbook.md`，头部变更记录留痕。
> 执行标记：`/var/lib/deploy-state/` 目录创建与 /tmp 配置准备均在收窄前手工变更单。

### P5（先答后对）`systemctl restart nodeapp` 的不可用时长预测是多少秒？

**为什么问它**：G6。Q14 的静默窗口取 5 分钟，依据写的是「npm ci + 重启 + 验证的合理上限」，而重启这一段的实测值 D1 没有。按 `LEARNING-PROTOCOL.md` §4，先写预测再实测（V10）。

**必答追问**：① 预测的是哪一段——从 `systemctl restart` 发出到 `/health` 再次 200，还是到 `ss` 见 3000 监听，两者不一定同时；② 若实测显著超出预测，5 分钟窗口是调窄还是保持，依据是什么（冲突自查第 5 条：过窄误报，过宽盖住真故障）。

> 答（本人，2026-08-26 冻结）：
> 口径：`systemctl restart` 发出 → `/health` 再次 200（完整可用恢复）。预测 **5–8 秒（中心约 6s）**，**纯推断**——W10 无 restart 时长实测记录（曾引用不存在的 `restart-latency.md` 已撤掉），V10 首次实测校准。
> 分段（基于 `week2-express/src/server.js` 真实结构）：A 旧进程关闭 1–5s（graceful shutdown：`server.close()` 等 keep-alive 连接 + 30s 强制 exit(1)）；B 新进程 2–3s（`await connectDB()` 先于 `app.listen()`，模块加载走 OS page cache）；C `/health` 首次响应 <0.5s（无 IO）。
> ② 实测显著超出预测时：**保持 Q14 5 分钟静默窗口**（窗口由 npm ci 1–3 分钟主导，restart 慢不靠调宽掩盖，过宽盖真故障）；restart 慢由 verify 的 `/health` 30s 超时捕获（阶段 5 报红、不自动回滚）；Q14 静默窗口与 verify 等待超时是两个机制，不互相换算。

### P6（validate-logs 的日志来源）用哪一个 API 取当次构建日志？

**为什么问它**：G7。Q10 的 F5 列了两个候选并标「D2/D3 定」，D2 未定。

**必答追问**：① 选定后，脚本安全批准（若走 Groovy）是不是一次性动作，批准的是哪个方法签名；② 取日志的时机——validate-logs 自己那一段的输出会不会还没落盘，导致漏检；③ 搜到敏感模式时，失败信息本身怎么写才不会把命中的内容再打印一遍。

> 答（本人，2026-08-26 冻结）：
> **候选 A：`currentBuild.rawBuild.getLog()`**——API 稳定、不依赖路径布局与日志文件落盘状态。一次性 Script Approval：`method hudson.model.Run getLog`（全局，批准后所有 pipeline 可用）。
> ② 取日志时机 = validate-logs 阶段**开头**（任何输出前）：日志追加式，此时拿到 Checkout→Verify 的既有输出，validate-logs 自身输出不进入扫描面（避免自搜干扰 + 只扫高风险过往阶段）。
> ③ 失败信息 = **行号 + 模式类型**（如「第 15 行：BEGIN OPENSSH PRIVATE KEY」），**绝不复述命中内容**（否则失败信息自身成为新泄露源）；命中过多只报前 N 条 + 总数。
> 执行标记：Script Approval 是阶段 B 前置（第一次部署前），与凭据入 Credentials 同批。

### P7（触发方式与轮询静默）第一次部署由什么触发？D2 发现的轮询静默失败怎么对付？

**为什么问它**：D2 实测到 Poll SCM 在 github.com 443 间歇失败时把失败记为 `No changes`，不触发也不报错。D3 起流水线带部署段，静默错过提交的后果从「构建晚一轮」变成「以为已经上线其实没有」。

**必答追问**：① 第一次部署用手工 `Build Now` 还是等轮询自动触发——手工触发能不能满足验收句里的「一次提交能自动走到」；② 长期对策取哪一档：定期看 polling log、部署后用 `.previous_commit` 与 `origin/main` HEAD 对账、或别的形态；③ 对账动作放在哪一侧执行（与 P1 的通道问题相关）。

> 答（本人，2026-08-26 冻结，第三次修正版）：
> ① 第一次部署手工 `Build Now`（隔离变量；触发机制 D2 已单独验证「轮询能自动触发构建」）；D3 内补空提交/README 触发一次轮询走完整链路——验收句「自动」由「自动触发（D2）+ 自动执行（D3 Build Now）+ 完整链路（D3 轮询补测）」三层共同证明。
> ② 长期对策双层：
> - **部署后对账**（controller 侧）：状态文件 `/tmp/lag-tracker-${JOB_BASE_NAME}-main.timestamp` 记录「首次远程领先时间戳」，跨构建累积，追平删文件清零；领先 >15 分钟（3 个轮询周期）→ 构建 **UNSTABLE** + WARNING；≤15 分钟 → SUCCESS + INFO（避免每次 push 误报）。
> - **带外轮询日志监控**：每 15 分钟扫 Poll SCM 日志；区分 `No changes`（正常，轮询活着）vs 无记录/ERROR（停摆，告警）；30 分钟无正常记录 → 告警。
> ③ 对账执行在 controller 侧（`git ls-remote origin main` 匿名，公开仓库无需凭据），服务器侧 verify 只读不 fetch，职责分离。
> 边界：对账依赖「有部署发生」；轮询停摆时无部署 → 对账不跑，由日志监控兜底。

### D1（阻断，C1–C6 前置核对发现）ubuntu 属于 `sudo` 组，`%sudo ALL=(ALL:ALL) ALL` 使「只改用户条目」的收窄失效

**发现（C4）**：`groups` 含 `27(sudo)`；`/etc/sudoers` L50 `%sudo ALL=(ALL:ALL) ALL` 对组成员生效；`sudo` 组**唯一成员 = ubuntu**（`/etc/group` 实测 `sudo:x:27:ubuntu`）。若不处理，V3 越权验证（`sudo systemctl start nginx` 应被拒）必失败——`%sudo` 组规则仍然放行，收窄等于没做。

**候选**：A `sudo gpasswd -d ubuntu sudo` 移出组（可逆，`gpasswd -a` 加回）+ 用户条目白名单化；B 注释 `/etc/sudoers` 的 `%sudo` 行（影响面=唯一成员，等价）；C 其他。

> 答（本人，2026-08-26 冻结）：
> **选 A**：`sudo gpasswd -d ubuntu sudo` 移出 sudo 组（可逆 `gpasswd -a ubuntu sudo` 加回）。
> **备份（收窄前）**：`/etc/sudoers`、`/etc/sudoers.d/90-cloud-init-users`、`/etc/group`、`/etc/gshadow` 各 `cp` 加 `.bak.20260826`。
> **白名单落点（修正为 P4 冻结形态）**：新建 `/etc/sudoers.d/deploy-wrapper` 承载 8 条白名单；`90-cloud-init-users` 清空为仅注释 `# DEPRECATED: see /etc/sudoers.d/deploy-wrapper`（与 cloud-init 解耦，避免 cloud-init 重建恢复全权）；`/etc/sudoers` L56 全权行注释（保留 `%sudo` 行与 `includedir`，ubuntu 已移出 sudo 组故 `%sudo` 不覆盖它）。
> **V3 执行约定**：收窄完成后关闭旧 SSH 会话；越权验证用**新 SSH 连接**（组 ID 缓存，旧会话仍持 sudo 组权限），`ssh ubuntu@server 'sudo systemctl start nginx'` 预期被拒。

### D2（C1–C6 前置核对发现）ubuntu 全权条目的位置 = 2 个文件 4 条

**发现（C4）**：`/etc/sudoers` L56 `ubuntu  ALL=(ALL:ALL) NOPASSWD: ALL` + `/etc/sudoers.d/90-cloud-init-users` **3 条重复** `ubuntu ALL=(ALL) NOPASSWD:ALL`（cloud-init v.20.1 生成，重复疑为 cloud-init 多次运行）。收窄要改 **2 文件 4 条**，全部先 `cp` 备份加 `.bak.20260826`。90-cloud-init-users 是 cloud-init 首次启动一次性生成，改后重启不还原。

> 答（本人，2026-08-26 冻结，随 D1）：
> 全权条目收敛方式：`/etc/sudoers` L56 注释；`/etc/sudoers.d/90-cloud-init-users` 清空为仅注释（不承载任何规则）；白名单唯一来源 = 新建 `/etc/sudoers.d/deploy-wrapper`。改 `/etc/sudoers` 与 `/etc/sudoers.d/90-cloud-init-users` 分别用 `sudo visudo` / `sudo visudo -f`（保存前校验语法）。

### D3（C1–C6 前置核对发现）`check-app.sh` 也漂移为 `ubuntu:ubuntu`

**发现（C1）**：`/opt/check-app.sh` 属主 `ubuntu:ubuntu` 755，与契约 §2.6 只列的 check-disk.sh 同型（同型 = root 身份 oneshot 执行，属主可写 = ubuntu 改写 root 执行内容的通道）。是否一并纳入顺带项改 `root:root`？

> 答（本人，2026-08-26 冻结）：
> 一并改：`/opt/check-app.sh` 与 `/opt/check-disk.sh` 属主 → `root:root`、权限 755（理由同 §2.6）。收窄前执行（需全权 sudo）；回滚 `sudo chown ubuntu:ubuntu`。

### D4（C1–C6 前置核对发现）`lighthouse` 全权 sudo

**发现（C4）**：`/etc/sudoers` L55 `lighthouse ALL=(ALL) NOPASSWD: ALL`；`/home/lighthouse/.ssh/` 不存在（无登录通道，利用面 0）。处理（注释/删除该行）还是记录不处理？

> 答（本人，2026-08-26 冻结）：
> 整行注释 `/etc/sudoers` L55（无登录通道但规则存在，注释清除，防服务借用 lighthouse 身份调用 sudo）。备份已覆盖。

### D5（顺手项）`smoke-env-check` 冒烟 job 残留

**发现（开发机）**：`$JENKINS_HOME/jobs/` 仍含 `smoke-env-check`（D2 计划「验完即删」）。D3 顺手删？

> 答（本人，2026-08-26 冻结）：
> 删除 `smoke-env-check` job（Web UI 或 CLI）。

---

## 4. 执行记录（滚动，2026-08-26 当天填）

### 时间盒

（当天拍板后填：阶段 A / B / C 各自的起止与收工点判定）

### 前置核对结果（C1–C6）

| # | 项 | 实测（2026-08-26） | 结论 |
|---|---|---|---|
| C1 | npm / git / 检查脚本 | `/usr/bin/npm`；`/usr/bin/git`；check-app.service ExecStart=`/opt/check-app.sh`；check-disk.service ExecStart=`/opt/check-disk.sh` | §5.5 路径占位替换；§2.6 目标路径 = `/opt/check-disk.sh` |
| C2 | mongosh | `/usr/bin/mongosh` 2.9.2 | §5.5 数据库连通验证项成立 |
| C3 | 目录权限 | `/home/nodeapp` **751**（other 仅 `--x`：可 cd 不可 ls）；`nodejs-skillup` **775**；`week2-express/src` **775** | ubuntu 可穿透、可读、**不可写**；G3 `.env` 门禁 `test -f` 可行（stat 不需文件读权限） |
| C4 | 权限来源快照 | `/etc/sudoers` L55 `lighthouse ALL=(ALL) NOPASSWD: ALL`、L56 `ubuntu ALL=(ALL:ALL) NOPASSWD: ALL`；`/etc/sudoers.d/90-cloud-init-users` 3 条重复 ubuntu 规则；ubuntu 属 `sudo` 组（唯一成员）；`/etc/sudoers.d/` 750 root（普通用户 ls 被拒） | 收窄方案需调整 → **D1 / D2** |
| C5 | 部署前 commit | HEAD=`6a1b1a1`；未跟踪 `?? week8-fullstack/src/frontend/dist-admin443/`；git 2.34.1 | 与契约一致 |
| C6 | 资源 | 磁盘 avail **32373329920 B ≈ 30.1 GiB**（> 4 GB）；内存 available **1197 MB** | 均在线内 |
| 基线 | 探活 | mongosh ping `{ ok: 1 }`；`ss -tlnp` 见 `127.0.0.1:3000` LISTEN；`/health` 200 | V6 部署前对照组基线正常 |

### 十二步执行进度

**第 1 步（job `Branch Specifier` 改回 `*/main`，2026-08-26）**：
- 动作：`w11-d2-pipeline` Configure → Branch Specifier `*/feature/w11-d2-jenkinsfile` → **`*/main`** → Build Now。
- **插曲（网络抖动复现）**：第一次构建 Checkout 失败——`git fetch ... +refs/heads/main:refs/remotes/origin/main` 返回 128，`Failed to connect to github.com port 443 after 75006 ms`。与 D2 轮询静默**同根因**（github.com 443 间歇失败），但形态不同：构建已触发后 Checkout 阶段**直接 FAILURE**（非静默记 `No changes`）。重试即过。
- 第二次构建：Checkout 到 main HEAD `2416292`（Merge PR #94）；Install `npm ci` 514 packages / 11s；Test 3 suites / 9 tests 通过（`--maxWorkers=1` + `testTimeout 30s` 生效）→ **SUCCESS**。
- 偏差：无；网络抖动按已知风险记录，部署段同样受此影响（第一次部署 Build Now 若遇 443 抖动，Checkout 失败重试）。

**第 2 步（前置核对 C1–C6）**：见上方「前置核对结果」表，已完成。

**阶段 A 前置动作（收窄前，需全权 sudo，2026-08-26）**：
- ✅ 备份 4 文件：`/etc/sudoers.bak.20260826`、`/etc/sudoers.d/90-cloud-init-users.bak.20260826`、`/etc/group.bak.20260826`、`/etc/gshadow.bak.20260826`
- ✅ 创建 `/var/lib/deploy-state/`（ubuntu:ubuntu 750）
- ✅ check 脚本属主 `root:root` 755（app + disk 一并，D3 决策）；改后重跑 `/opt/check-app.sh` 仍 OK
- ✅ `/tmp/nginx-shop-admin-8080-removed` 已 cp（857B，属主 ubuntu，**8080 块编辑待 D4/D5 前由本人做**；确认 `listen 8080` + `server_name 43.128.154.242`）
- ✅ verify 可行性实证：check-app/check-disk 普通权限直接跑 OK、业务接口 `/` 200、mongosh ping `{ok:1}` → **P1 C2 缺口解除（verify 无需新增白名单条目）**

**阶段 B：第一次部署（2026-08-26）**

**构建 13（`Started by an SCM change`，Poll SCM 自动触发）+ 构建 14（Build Now）均完成完整六阶段**：
- Checkout `7b90b25`（含 Deploy 的 Jenkinsfile）→ Install（npm ci 514 包）→ Test（3 suites / 9 tests）✅
- **Deploy**：`ssh "deploy 7b90b2562..."` → wrapper 写 `.rollback_target`=6a1b1a1 → `git fetch`（输出 `6a1b1a1..7b90b25`）→ `HEAD is now at 7b90b25` → npm ci --omit=dev（116 包 / 2s）→ restart → `Deploy ... completed successfully` ✅
- **Verify 七项全绿**：/health `{"status":"ok"}`、业务 `Hello, World!`、mongosh `{ok:1}`、ss LISTEN、check-app OK、check-disk OK、公网 curl 443 → 200 ✅
- **mark-verified 7b90b25** → `.previous_commit = 7b90b25` ✅（V12）
- **validate-logs FAILURE**：sandbox 拒绝 `method org.jenkinsci.plugins.workflow.support.steps.build.RunWrapper getRawBuild`（**P6 执行期修正**：冻结时写的是 `Run getLog`，实际先拦 `getRawBuild`）

**验证结果（阶段 B 部分）**：
| # | 验证项 | 结果 |
|---|---|---|
| V7 | 验收句第 1/2 段 | ✅ 构建日志含部署前 commit（`6a1b1a1..7b90b25`）与部署后 `7b90b25`，Verify 七项结果均在 |
| V8 | 部署后验证七项 | ✅ 全绿（含公网 443 curl 200） |
| V10 | restart 不可用时长 | ✅ **实测 0.515s / 0.516s**（两次部署）；对照 P5 预测 5–8s → **预测高估一个数量级**（graceful shutdown 无活跃连接时立即完成、page cache 热、本地 mongod 快）；Q14 5 分钟窗口**保持**（主导因素是依赖变化时的 npm ci 1–3 分钟，非 restart） |
| V11 | 部署标记 | ✅ `journalctl -t DEPLOY`：11:59:55/12:01:02 `deploy-start 7b90b25` + `deploy-end 7b90b25 success`，commit 与构建匹配 |
| V12 | 回滚基线更新 | ✅ `.previous_commit = 7b90b25`（mark-verified 写入） |

**阻塞（进行中）**：github.com 443 间歇故障（今日第 5 次）——`curl https://github.com/` = 000，Jenkins Checkout SCM 拉 Jenkinsfile 连续失败（50–75s 超时）。已确认非 Jenkins 环境问题（开发机 shell 同样断）。等待网络窗口后重试 Build Now → 验证 validate-logs（getLog 或已放行）→ V9 反向证明。

**网络诊断（2026-08-26 收口时）**：
- 开发机（公司网络）→ github.com 443 **TLS 层被拦截**：DNS 解析正常（`20.205.243.166`）、TCP 443 能握手（nc OPEN）、HTTPS 请求超时（curl 000）
- github 另一节点 `20.27.177.113` 时通时断；百度 200（网络整体正常）；**服务器→github 正常（0.05s）**——github 本身无故障
- 已排除：Jenkins 服务（重启后自起正常、8080 403 正常）、Umbrella DNS（解析正常）、系统代理（未启用）
- 判断：公司网络对 github 节点 IP 的 TLS 拦截（Umbrella 重启恢复后出现，疑似其策略；**暂不联系 IT**，按"github 临时问题"处理）
- **影响**：Jenkins Checkout SCM / Poll SCM 需开发机→github 拉 Jenkinsfile → 无法触发新构建；**服务器侧部署 git fetch 不受影响**（服务器直连 github 通，0.05s）

**D3 收口状态快照**：
- ✅ 已完成：P1–P7 + D1–D5 冻结；C1–C6 核对；wrapper 实现/安装/白名单自测；密钥 + 公钥（command=）；sudoers 收窄（白名单 8 条 / L56 注释 / 90-cloud 清空）；**第一次自动部署成功**（构建 13 轮询触发 + 14 Build Now）；V7 / V8 / V10 / V11 / V12 达成；getRawBuild 已批准
- ⏳ 待完成：validate-logs 绿（getRawBuild 批准后重跑，确认 `getLog` 是否放行）；V9 反向证明；gpasswd -d + lighthouse 注释（需 root）；口语稿决策
- 未 commit：`day3-deploy-credentials.md` 修改待用户决定

**新对话恢复入口**：
1. 测开发机→github（`curl -sI https://github.com`）——**恢复后 Build Now 重跑** → validate-logs 验证 → V9 反向证明
2. 若仍不通：按本网络诊断记录处理（公司网络 TLS 拦截，服务器侧不受影响）
- ✅ 写 `/etc/sudoers.d/deploy-wrapper`（8 条白名单，`visudo -c` 全 `parsed OK`）
- ✅ 注释 `/etc/sudoers` L56（ubuntu 全权行，sed + 校验）
- ✅ **清空 `/etc/sudoers.d/90-cloud-init-users` 为 2 行注释（11:24:15 `sudo tee` 实际执行成功，auth.log 证实 session opened root）**
- ⚠️ **真相还原**：90-cloud 清空后 NOPASSWD 全权来源消失（L56 已注释 + 90-cloud 已清空），后续 `sudo cat/sed/gpasswd` 全部落 `%sudo`（PASSWD，ubuntu 无密码）→ 被拒。**此前"90-cloud 神秘消失"判断有误**——是被自己命令成功清空；重启是无谓操作（文件已清空，重启不可能恢复），已记录教训：操作后立即用 `sudo -n -l` 复核，不要等后续命令失败才意识到状态已变。
- **待补项（需要 root，腾讯云控制台重置密码后执行）**：① `gpasswd -d ubuntu sudo`（`%sudo` 组规则残留，现在被"无密码"挡住，未来设密码即全权）；② 注释 `/etc/sudoers` L55 lighthouse。
- **当前安全状态**：白名单 8 条 NOPASSWD 生效（参数需精确匹配）；白名单外 sudo → 要求密码（无密码 → 实际被拒）；部署流程所需 sudo 命令全在白名单内，**不影响 D3 主线**。

**验证结果（收工点 A）**：
| # | 验证项 | 结果 |
|---|---|---|
| V1 | `visudo -c` | ✅ 全 `parsed OK` |
| V2 | command= 层越权（`echo hi` / `deploy abc`） | ✅ 均 `ERROR: Invalid command` + RC=1 |
| V3 | sudoers 层越权（`sudo systemctl start nginx`） | ⚠️ RC=1 被拒，但语义为 `a password is required`（`%sudo` PASSWD 残留）而非契约字面 `command not allowed`——安全效果达成，偏差记录，gpasswd -d 后转正式语义 |
| V4 | 白名单内可用（`sudo -u nodeapp git -C ... status`） | ✅ RC=0，`?? dist-admin443/` 仍在 |
| V5 | wrapper 属主 | ✅ `root:root 755` |
| V6 | 部署前基线七项 | ✅ 全绿（/health 200、业务 `/` 200、mongosh `{ok:1}`、公网 443 `HTTP:200 SSL:0`、`ss :3000` 1、check-app OK、check-disk OK） |

**收工点 A：达成**（V3 语义偏差记录在案）。

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

- [x] P1–P7 本人作答并冻结（动手前）
- [x] 前置核对 C1–C6 完成，§5.5 的路径占位替换为实测值（同步回 `day1-release-contract.md`）
- [x] 四要素（改动清单 / 验证 / 回滚 / 止步）本人核对
- [x] job `Branch Specifier` 改回 `*/main`（D2 临时偏差消除）
- [x] 收工点 A：V1–V5 全部通过（V3 语义偏差记录：密码拒 vs command not allowed）
- [ ] 收工点 B：V6–V8 通过 = 验收句三段达成——**部分**：V6 基线七项全绿、V7/V8 部署后验证达成；**验收句第 3 段（validate-logs 绿）待开发机→github 网络恢复后重跑**（阻塞见 §4 网络诊断）
- [ ] V9 validate-logs 反向证明（报过一次红再恢复绿）——待网络恢复
- [x] V10 restart 不可用时长实测，与 P5 预测对照，Q14 的 5 分钟窗口据此校准或维持（实测 0.515s，预测 5–8s 高估，窗口保持）
- [x] 顺带项 §2.6 check-disk 属主完成（check-app 一并，root:root 755，D3 决策）
- [x] 必要时 `DEBT.md`（未触发——黑名单止步 L2，wrapper/Jenkinsfile 本人实现 AI 只 review，零代写）
- [x] `week11-plan.md` §4 D3 勾选、`LEARNING-STATE.md` 更新（2026-08-26 收口）
- [ ] 技术英语口语稿（按 `DAILY-SPEAKING-PROTOCOL.md`）——D2 未做，D3 决定是否补：**D3 暂不补**（网络阻塞导致收口未完成，顺延至 D3 续/D4）
