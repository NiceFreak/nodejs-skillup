# W11 Day 1（8/24）：冻结发布契约

> 建立：2026-08-24（Asia/Shanghai）
> 上游：[`week11-plan.md`](./week11-plan.md) §5；[`day1-release-contract.md`](./day1-release-contract.md)（**契约冻结完成，2026-08-24**）
> 状态：**D1 收口完成**。Q1–Q18 全部本人作答；九对冲突自查通过；五张表填满；口述验收（发布链条 + 无信号失败）通过。
> 形态参考：W9 [`day1-contract-freeze.md`](../../week9-deployment/notes/day1-contract-freeze.md)、W10 [`day1-observability-contract.md`](../../week10-observability/notes/day1-observability-contract.md)

---

## 1. 今日目标

**主线**：把 W11 从「一份周计划」压成「一份可执行的发布契约」——谁来执行、用什么身份、能动哪些东西、每一步失败了算什么、失败之后退到哪，全部落到纸面且互相不矛盾。

**止步条件（零副作用）**：不装 Jenkins、不在服务器建用户/密钥、不改配置、不触发部署。唯一允许的服务器动作是块 C 只读采集。

**完成判定四条**：① Q1–Q18 全部本人作答；② 九对冲突自查通过；③ 五张表填满；④ 口述两件事（发布链条 / 无信号失败）。

## 2. 今日产出

### 2.1 六条事实核对（时间盒 A）

对照 `package.json` / `app.js` / `server.js` / `.nvmrc` / `.gitignore` / 测试文件，核对 §2.3 六条事实：

1. `start` = `node --env-file=.env server.js`，`.env` 不入库（`.gitignore` 第 4–7 行）。✅
2. 三份测试：`monthly-sales` / `auth-flow` 走 `mongodb-memory-server`，`validators` 是纯单元测试。✅
3. `package-lock.json` 存在，`bcrypt@6.0.0` 在 `allowScripts` 白名单。✅
4. `/health` 只回 `{status:'ok'}`，不读 mongoose（`app.js:86–91`）。✅
5. `server.js:42` `listen` 无 `.on('error')`；`try/catch` 能接住 `connectDB()` 的 await 拒绝，但接不住 listen 的异步 `'error'` 事件。✅
6. `.nvmrc` = 24。✅

**第 5 条是本日最重要的概念校正**：EADDRINUSE 是「会崩的失败」（error 事件 → 无监听 → 未捕获异常 → 进程退出）；类 2 假 active 是「不崩却无监听的未绑定」（回调已触发、进程存活、无错误信号）。两条路径在「socket 未绑定」上相同，但在「进程是否活着 / 有无错误日志」上完全相反。

### 2.2 块 C 只读采集（服务器 + 开发机）

服务器侧（`43.128.154.242`，ubuntu 身份，只读）：
- 线上 HEAD = `6a1b1a1`（W10 D4 的 PR，**未 fetch，落后本地 main**）
- 工作区未跟踪 `week8-fullstack/src/frontend/dist-admin443/`（443 `/admin/` 面静态产物）
- node_modules 21M；node v24.19.0 / npm 11.17.0
- systemd 单元：`WorkingDirectory` 指向具体目录（非 symlink）、`Restart=on-failure`、`StartLimitBurst=5`
- `sudo -l`：ubuntu **全权免密 root**（多条 `(ALL:ALL) ALL` + `NOPASSWD: ALL`）
- SSH：单把 RSA 2048（指纹 `asSOrkkr…`）
- 磁盘 avail 31G；内存 available **1169 MB**、swap=0
- 五面监听 + 四 timer 全 active（W10 收口态复核通过）

开发机侧：**无 JVM**（Jenkins 先决条件缺项）；Docker client 在但 colima daemon 未跑；node v24.18.0 / npm 11.16.0；磁盘 avail 284Gi。

### 2.3 十八个决策（Q1–Q18）

逐题答案与追问见 [`day1-release-contract.md`](./day1-release-contract.md) §4。本页只留关键结论：

| 组 | 决策摘要 |
|---|---|
| Q1–Q3 | controller 装开发机（先装 OpenJDK 17 + Jenkins LTS）；轮询触发持续部署，接受 ≤5min 延迟；验收句定死；与 Actions 并存、只有 Jenkins 持部署凭据、只部署 main |
| Q4–Q7 | 5 阶段（Checkout/Install/Test/Deploy/Verify）；测试全在 controller（1169 MB 约束）；源码+lockfile 形态、服务器侧 `npm ci --omit=dev`；`.env`/Nginx/letsencrypt 绝对不动 |
| Q8–Q10 | 复用 ubuntu + 专用部署密钥 + `command=` + sudoers 白名单双重收窄；私钥入 Jenkins Credentials；validate-logs 搜不到私钥即通过 |
| Q11–Q14 | 环境分离 = 配置与代码分离；回滚到「验证通过」commit；逻辑原子性（失败即回滚）；DEPLOY 标记 + 交叉验证抑制告警 |
| Q15–Q18 | 部署后验证含公网 443 curl（补盲区②）+ mongosh 直连（不新增端点）；类 2 最小样本 D4 复现、今天不改 server.js；8080 本周下线；三个 stretch 均本周不做 |

### 2.4 冲突自查（九对）

九对全部通过。三处需要留痕的边界：
- **Q9 wrapper 命令白名单扩到第三条 `mark-verified <sha>`**：Verify 通过后写 `.previous_commit` 的通道，B1 修复补上，否则「回滚到验证通过版本」没有执行通道。
- **Q15 数据库验证不新增 `/health/db` 端点**（违反「不改 app.js/server.js」硬约束），改用 mongosh 直连。
- **Q17 与 Q7 的边界**：Q7「Nginx 不动」约束流水线；8080 下线由人走变更单在部署窗口外执行。

### 2.5 五张表

§5.1 发布契约表、§5.2 部署身份与权限清单、§5.3 一次发布完整旅程、§5.4 回滚判据表、§5.5 部署后验证清单、§5.6 只读基线——全部填满。

## 3. 预测与偏差

| 预测 / 设计 | 实际 | 偏差类型 |
|---|---|---|
| 「部署身份用 nodeapp」直觉倾向 | 实际复用 ubuntu + `sudo -u nodeapp`（nodeapp 是 nologin，不能 SSH） | 事实驱动修正 |
| 「`npm ci --omit=dev` 装一次就好」 | controller 侧必须全量（jest/MMS 在 devDependencies） | 阻断性自纠（B1） |
| 「`ssh nodeapp@` 部署」 | nodeapp nologin，SSH 唯一入口是 ubuntu | 阻断性自纠（B3） |
| 「wrapper 接受位置参数」 | `command=` 会吞掉客户端参数，必须读 `SSH_ORIGINAL_COMMAND` | 机制错误修正（B1） |
| 「`logger -t DRILL` 只有 wrapper 能打」 | `logger` 普通用户也能写系统日志，不能作为信任前提 | 安全论证修正（B2） |
| 内存基线 | W10 记录的 1388 MB 是过去值，今天实测 **1169 MB** | 事实更新 |

## 4. 验证证据

- 块 C 全部命令输出已贴入 §5.6（只读、无状态变更）
- 九对冲突自查勾选完成（§4.1）
- 五张表填满（§5.1–§5.5）
- 口述验收：发布链条 5 阶段 + 每层失败点 ✅；无信号失败（类 2）经校准后 ✅
- 周计划 §5 勾选 18/18；`LEARNING-STATE.md` 更新

## 5. 已完成 / 未完成

**已完成**：D1 契约冻结全流程（时间盒 A–F 全部执行）。

**未完成 / 顺延**：
- 开发机 `sysctl hw.memsize` 补测（块 C 开发机侧漏采，D2 第一步）
- `check-app`/`check-disk` 脚本路径核实（§5.5 标注占位，D3 `systemctl cat` 确认）
- `deploy-wrapper` 实现（D3，黑名单本人写，伪代码骨架已在 Q9）
- 类 2 最小样本复现（D4）
- 8080 下线（本周内，变更单）

## 6. 明日入口（D2）

D2 验收句（契约 §8，今天定死不改）：
> 能从一次提交触发出一条完整的构建记录，里面看得到装了哪些依赖、跑了哪些测试、结论是什么；把测试改成失败，流水线确实变红；整个过程中服务器零改动。

D2 第一个动作：按变更单四要素起草 controller 落地单（改动清单 / 验证 / 回滚卸载 / 止步）。
D2 硬边界：**不配置任何指向服务器的凭据**。
顺带项：`check-disk.sh` 属主 `ubuntu:ubuntu` → `root:root`（走变更单）。

## 7. AI 辅助记录

- 全天援助上限 **L2**（黑名单零实现）。Q1–Q18 全部本人作答；AI 只提问、追问、指出矛盾（B1/B2/B3 系列）、review 逐条结论。
- 白名单动作：§5 五张表落字整理、文档结构、命令清单、块 C 输出回填。
- **未触发 `DEBT.md` 记账**。

## 8. 收尾清单

- [x] Q1–Q18 全部本人作答并回填契约
- [x] 九对冲突自查通过（本人逐条判断 + AI review）
- [x] §5 五张表填满 + §5.6 基线实测
- [x] 口述验收（发布链条 + 无信号失败）通过
- [x] 周计划 §5 勾选 18/18 + 状态改「契约冻结完成」
- [x] 契约与周计划状态头更新
- [x] 未触发 `DEBT.md` 记账（全天援助止步 L2）
- [x] `LEARNING-STATE.md` 更新（D1 收口后执行，2026-08-24 已完成：状态头 / 当前 Day / 下一步 D2）
- [x] 技术英语口语稿（`day1-english-speaking.md`，2026-08-24 已生成）
