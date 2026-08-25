# W11 Day 2（8/25）：controller 从零装起来 + 第一条只构建与测试的流水线

> 建立：2026-08-24（Asia/Shanghai，D1 收口后起草）
> 上游：[`day1-release-contract.md`](./day1-release-contract.md)（**契约已冻结，本文件不重开任何已拍板的题**）、[`week11-plan.md`](./week11-plan.md) §4 D2 / §7 交付物②
> 形态参考：W10 [`day2-logging-rollout.md`](../../week10-observability/notes/day2-logging-rollout.md) §2「变更单四要素」、W9 [`day5-rebuild-closeout.md`](../../week9-deployment/notes/day5-rebuild-closeout.md) §10
> 修订：2026-08-25（D2 当日，本人要求 review 后修正 8 处，见 §0）
> 状态：**P1–P6 全部作答冻结（2026-08-25）**。§2 四要素引用 D1 已冻结决策；§3 P1–P2 于 8/24、P3+P4 / P5 / P6 于 D2 开工前作答，AI review 通过后冻结，答案见 §3 各题「答（本人）」块。

---

## 0. 修订记录（2026-08-25，开工前 review）

> 本节只记「改了什么、为什么改」，不改任何 D1 已冻结决策，也不代答 §3 的执行期决策。

| # | 发现的问题 | 改在哪 |
|---|---|---|
| F1 | **Test 阶段的数据库来源没有任何决策覆盖**。两个集成测试无 `MONGODB_URI` 且 `CI` 为真时直接抛错；Actions 侧靠 service 容器解决，Jenkins 侧 D1 未定（Q3 只统一了 `npm ci`）。§2.3 ④ 的期望值 SUCCESS 因此不是无条件成立 | 新增 §3 P6；§2.3 ④ 补前提；§2.5 加止步线 |
| F2 | **Jenkinsfile 在哪个分支与第一次构建怎么触发互相咬死**。Q2/Q3 冻结「只轮询 main」，而本周开发在功能分支，PR 合并前 main 上没有 Jenkinsfile | §2.2 重写执行顺序；§3 P3 与 P4 合并作答 |
| F3 | **没有一项验证能证明 P2 生效**。② 只量 RSS，而开发机 32 GiB 时 JVM 默认最大堆为物理内存 1/4 = 8 GiB，空载 Jenkins 的 RSS 在默认堆下也可能落在 720M 以内，该项对 env 文件是否被读到不敏感 | §2.3 新增 ②a |
| F4 | **`check-disk.sh` 属主项与本日验收句冲突**。周计划 §4 D2 与 D1 §8 都把它排在 D2，但它要 `chown` 服务器上的文件 | 移到 D3；§2.1、`week11-plan.md` §4、`day1-release-contract.md` §8 同步留痕 |
| F5 | **回滚表第 3 行方向相反**。触发条件是内存超上限，动作却是删 env 文件、把最大堆放大到默认的 8 GiB；与 §2.5 对同一条件给的「下调 `-Xmx` 至 384m」矛盾 | §2.4 拆成两行 |
| F6 | 验收句第 3 段「服务器零改动」与 ⑦ 要 SSH 登录做只读确认之间口径未收窄，登录本身会写 `auth.log`、`lastlog` 与 journald | §2.3 ⑦ 补口径定义 |
| F7 | 时间盒只写「当天做不完就止步」，没有阶段收工点 | §2.5 细化 |
| F8 | **没有一项验证确认构建环境里 node / npm 可用**。Jenkins 由 launchd 拉起，PATH 未必包含 brew 的 node；块 C 采到的 v24.18.0 是登录 shell 里的值 | §2.3 新增 ③a 冒烟构建，与 F1 的 `CI` 变量一次验完 |
| F9 | **2026-08-25 决策冻结**：P3+P4 / P5 / P6 本人作答完毕、AI review 通过（P1、P2 已于 8/24 冻结）。review 指出两处阻断性事实错误并已修正：P6 初答「ci.yml 未设 MONGODB_URI / 未启动 mongod」与仓库现状相反（`ci.yml` L16–29 有 `mongo:7` service + `env.MONGODB_URI`）；P3 初答「轮询 main 但 SCM 拉功能分支」在 Poll SCM 下不成立（轮询对象就是 `Branch Specifier` 指定分支） | §3 三题答案落定；§2.1 / §2.2 / §2.5 同步 |
| F10 | **2026-08-25 执行期事实修正（P2 路径）**：落地单冻结路径 `~/.homebrew/services/jenkins-lts.env` 与开发机实际不符——实测 `brew --prefix` = `/usr/local`（Intel 位，`/usr/local/bin/brew` → `../Homebrew/bin/brew`），`~/.homebrew/` 只是 trust 缓存目录（仅 `trust.json`）。env 文件候选落点改为 `/usr/local/etc/services/jenkins-lts.env`（brew prefix 下的 services env 目录约定）。**机制是否被本地 brew 6.0.6 支持未定**（本地 services 源码未见 env 注入逻辑）——由验证 ②a 实证，不赌源码；②a 失败则按 §2.4 回滚行重估落点 | §2.1 第 3 项、§2.4 第 3 行、§3 P2 答案同步 |

---

## 1. 今日唯一主线与验收句

**主线**：把 D1 契约里「controller = 开发机、轮询触发、只部署 main」的决策，落成一台真实跑起来的 Jenkins controller，并让第一条**只构建与测试**的流水线从一次提交触发。

**验收句（D1 §8 写死，今天不改一个字）**：

> 能从一次提交触发出一条完整的构建记录，里面看得到装了哪些依赖、跑了哪些测试、结论是什么；
> 把测试改成失败，流水线确实变红；整个过程中服务器零改动。

**D2 与 D1 的根本差别**：D1 止步条件是「不装、不建、不改」；今天开始出现副作用动作，但**全部落在开发机**。
D2 硬边界（D1 §8）：**不配置任何指向服务器的凭据**——今天的流水线只有 Checkout / Install / Test 三个阶段，没有 Deploy / Verify。

**今天不是排障日**。任何一次红灯（测试失败、流水线变红）如果是演练实验，必须有明确的还原动作；如果无法还原，按 §2.5 止步。

---

## 2. 变更单（动手前冻结，四要素）

### 2.1 改动清单 —— 今天就这几项，别的都不动

> 第 5 列是 `day1-release-contract.md` §4 已拍板决策的来源，不是今天临场裁量。
> 2026-08-24 修正：原第 1 项 `brew install openjdk@17` **已删除**——formula 实际 `depends_on "openjdk@21"`，由 `brew install jenkins-lts` 自动带（契约 Q1 已加事实修正注记）。

| # | 层 | 文件 / 对象 | 改什么 | 来源（已拍板） | 归属与谁实现 |
|---|---|---|---|---|---|
| 1 | 工具链 | 开发机 brew | `brew install jenkins-lts`（自动带 openjdk@21） | Q1（事实修正：依赖 21 而非 17） | 白名单，AI 可给命令，本人执行 |
| 2 | 服务 | 开发机 brew services | `brew services start jenkins-lts`（默认 localhost:8080） | Q1 | 白名单，AI 可给命令，本人执行 |
| 3 | 服务配置 | `/usr/local/etc/services/jenkins-lts.env` | 写入 `JAVA_TOOL_OPTIONS=-Xmx512m -Xms256m`（开发机 32 GiB，已回填 §5.6）。**路径 2026-08-25 事实修正**（F10）：原 `~/.homebrew/services/` 不存在，`brew --prefix`=`/usr/local` | P2 决策（选项 A） | 本人执行，AI 可给命令 |
| 4 | 初始化 | Jenkins UI | initialAdminPassword 解锁 + 装插件（最小集：Git + Pipeline） | Q1 + P1 决策 | 经验知识（解锁流程 AI 直接讲）；勾选本人操作 |
| 5 | 代码 | 新增 `week11-ci/Jenkinsfile` | 只构建与测试的流水线（Checkout / Install / Test）；落 **`feature/w11-d2-jenkinsfile`** 分支并 push，变红实验定稿后 PR 合入 main | Q4 阶段 1–3 + D2 硬边界 + P3+P4 拍板 | **黑名单：本人实现**；Jenkinsfile 语法白名单，AI 只 review 阶段逻辑 |
| 6 | 服务配置 | Jenkins job | 新建 pipeline job：Pipeline script from SCM，`Branch Specifier` = `*/feature/w11-d2-jenkinsfile`，勾选 Poll SCM（日程 `H/5 * * * *`） | Q2 轮询触发 + P3+P4 拍板 | job 形态已由 §3 P3 拍板 |
| 7 | 服务配置 | Jenkins job（临时） | 冒烟 job：只跑 `node -v; npm -v; printenv CI`，验完即删 | 2026-08-25 补（F1 + F8） | 白名单，AI 可给命令，本人执行 |
| 8 | 代码 | main 分支 | Jenkinsfile 变红实验定稿后 PR 合入 main（合入时机 = 功能分支首次构建全绿后） | P3+P4 拍板 | 本人操作 PR |

**明确不在清单内**（写下来防蔓延）：
- 不配置任何指向服务器的凭据（D2 硬边界）——不生成部署密钥、不写 `authorized_keys`、不改 sudoers、不建 Deploy 阶段
- 不改 `.github/workflows/ci.yml`（D1 止步条件；Actions 维持现状）
- 不动服务器任何东西（进程 / 配置 / 文件 / 端口）
- 不建 Deploy / Verify 阶段（排 D3）
- 不做类 2 最小样本复现（排 D4）
- 不动 `check-disk.sh` 属主——**该顺带项 2026-08-25 移到 D3**（F4：它要 `chown` 服务器上的文件，与本日验收句第 3 段和 §2.5 的边界止步线冲突；验收句 D1 已冻结不改字，被移出的是顺带项。D3 本来就要写服务器）

### 2.2 执行顺序（本人拍板）

安装顺序由依赖决定，但 2026-08-25 review 补了两处耦合（F2、F8），顺序改为九步：

1. 先建 `~/.homebrew/services/jenkins-lts.env`（P2 已冻结，一次到位，验证 ② 的 RSS 直接反映 512m 约束下的基线）
2. `brew install jenkins-lts`（自动带 openjdk@21）→ 验证 ①
3. `brew services start jenkins-lts` → 验证 ②、②a、③
4. 解锁 + 装最小插件集（P1 已冻结：Pipeline、Git，不装 SSH）
5. **冒烟构建**：只有 `node -v; npm -v; printenv CI` 的一次性 job → 验证 ③a。它同时验掉「构建环境看不看得到 node」（F8）和「`CI` 是否被注入」（F1，决定 P6 走哪条分支）
6. 按 P6 的答案落实 Test 阶段的库来源——**选② MMS**：冒烟构建确认 `CI` 未注入即可，无需额外配置
7. 写 `week11-ci/Jenkinsfile`（黑名单，本人实现）→ 落在 **`feature/w11-d2-jenkinsfile`** 分支并 push（P3+P4 拍板）
8. 建 pipeline job：SCM + `Branch Specifier` = `*/feature/w11-d2-jenkinsfile` + Poll SCM（`H/5 * * * *`）→ push 触发首次构建（轮询感知，验证「一次提交→自动构建」）→ 验证 ④
9. 变红实验：功能分支改坏测试 → push → 轮询感知 → 流水线红 → 验证 ⑤ → 还原（修复测试 → push → 绿）→ 验证 ⑥ → **Jenkinsfile PR 合入 main** → 服务器只读核对 → 验证 ⑦

**第 5 步不能省**：它是唯一在写 Jenkinsfile 之前就能暴露 PATH 与 `CI` 两个前提的动作，成本约一分钟。
**第 7 步与第 8 步的顺序由 P3+P4 决定**：job 用「Pipeline script from SCM」且指向 **功能分支**，Jenkinsfile 与分支同源，不要求先上 main。
**触发偏差（P3+P4 拍板）**：Poll SCM 轮询的对象 = `Branch Specifier` 指定分支——今天轮询**功能分支**（push 功能分支即自动触发），非 Q3 的「只轮询 main」。这是临时偏差，已显式留痕（§2.5），D3 将 `Branch Specifier` 改回 `*/main` 即消除。

### 2.3 验证 = 可证伪实验（九项，逐项写死期望）

> 每一项都必须先写期望值再跑；没有期望的验证只是「看了看」。期望值来源列在末位。

| # | 验证 | 在哪跑 | 命令 / 动作 | **期望值** | 期望来源 |
|---|---|---|---|---|---|
| ① | JDK 可用 | 开发机 | `java -version` | 输出 openjdk 21.x（`/opt/homebrew/opt/openjdk@21/bin/java` 或 brew 前缀对应路径） | Q1 事实修正（依赖 21） |
| ② | Jenkins 进程存活 + 内存基线 | 开发机 | `brew services list` + `ps aux \| grep jenkins` | jenkins-lts started；记录 RSS 实测值，对照 §2.5 止步线 | Q1 内存合约 |
| ②a | `JAVA_TOOL_OPTIONS` 真的被 JVM 读到 | 开发机 | `brew services info jenkins-lts` 定位日志后查 `Picked up JAVA_TOOL_OPTIONS`；或 Jenkins → Manage Jenkins → System Information 查 `java.vm.arguments` | 日志出现 `Picked up JAVA_TOOL_OPTIONS: -Xmx512m -Xms256m`，或 System Information 的 `java.vm.arguments` 含这两个参数 | P2 合约值（2026-08-25 补，F3：② 的 RSS 对 P2 是否生效不敏感） |
| ③ | 解锁页面可达 | 开发机 | 打开 `http://localhost:8080` | 显示解锁页（需读 initialAdminPassword） | 经验知识 |
| ③a | 构建环境能看到 node / npm，且 `CI` 的实际取值 | Jenkins | 建一个只有 `sh 'node -v; npm -v; printenv CI \|\| echo CI-unset'` 的一次性 job，构建一次 | `node -v` 输出 v24.x（块 C 开发机记录 v24.18.0）、`npm -v` 输出 11.x；`CI` 的取值**当场记录，不预测**——它决定 P6 走哪条分支 | 2026-08-25 补（F1 + F8） |
| ④ | 首次构建记录 | Jenkins | Build Now（或轮询自动触发） | 日志可见：clone → 在 `week2-express/src` 下 `npm ci`（依赖清单）→ `npm test`（三份测试文件：`__tests__/auth-flow.test.js`、`__tests__/monthly-sales.test.js`、`utils/__tests__/validators.test.js`）→ 结论 SUCCESS。**前提：P6 已答**，否则两个集成测试的库来源未定，这一项的期望值不成立 | D2 验收句第 1 段 |
| ⑤ | 变红实验 | Jenkins | 把某测试改成失败 → push → 触发 | 流水线 FAILED，日志含失败用例名 | D2 验收句第 2 段 |
| ⑥ | 还原 | Jenkins | revert 变红改动 → push | 流水线回 SUCCESS | 变红实验的还原动作 |
| ⑦ | 服务器零改动 | 服务器（只读） | 只读确认（方式由 §3 P5 本人设计） | 无新增用户 / 无新增 authorized_keys / 无 sudoers 变更 / 无新监听端口 | D2 验收句第 3 段 |

**⑦ 的「零改动」口径**（2026-08-25 补，F6）：指部署面无变更——用户、`authorized_keys`、`sudoers`、监听端口、服务单元、`/home/nodeapp/nodejs-skillup` 工作副本。只读确认本身经 SSH 登录，会在 `auth.log`、`lastlog` 与 journald 留下登录记录，这部分不计入改动。对照基线是 `day1-release-contract.md` §5.6 块 C（2026-08-24 采）。

⑤ 的变红实验要在 main 上留一条失败提交（轮询只盯 main）。它和「Jenkinsfile 放哪个分支」是同一个问题的两半，见 §3 P3 + P4（2026-08-25 合并作答）。

### 2.4 回滚（卸载路径）

D2 全在开发机，回滚 = 卸载，无生产风险：

| 失败点 | 还原动作 |
|---|---|
| JDK / Jenkins 装错版本 | `brew uninstall jenkins-lts`（openjdk@21 是自动依赖，`brew autoremove` 清残留） |
| Jenkins 起不来 / 卡解锁 | `brew services stop jenkins-lts`，读日志（`brew services info jenkins-lts`）定位后再定卸载与否 |
| env 文件写错，或参数未被 JVM 读到（②a 不通过），Jenkins 起不来 | **删除 `/usr/local/etc/services/jenkins-lts.env` → `brew services restart jenkins-lts`** → 回到 JVM 默认堆行为（默认最大堆约为物理内存 1/4，32 GiB 机器上约 8 GiB），先让服务可启动，再按 P2 重写落点（路径按 F10 修正） |
| 内存超上限（RSS > 720M） | **不走回滚**，按 §2.5 收紧：下调 `-Xmx` 至 384m 后 restart。删除 env 文件会把最大堆放大到默认值，与这个条件的处置方向相反 |
| Jenkinsfile / 测试改动混乱 | 仓库内 `git checkout --` 还原；`week11-ci/` 是新增目录，直接删除 |
| 彻底清理 | `brew services stop` + `brew uninstall` + 删 `${JENKINS_HOME}`（默认 `~/.jenkins`） |

> 2026-08-25 修正（F5）：原表把「内存超上限」写成删除 env 文件的触发条件，而该动作会把最大堆放大，与 §2.5 对同一条件给的「下调 `-Xmx`」相反。现按「配置失效」与「内存超限」两个条件分列。

### 2.5 止步条件

| 维度 | 上限 / 动作 | 来源 |
|---|---|---|
| 内存 | Jenkins 进程 RSS > 720M → 下调 `-Xmx` 至 384m（改 env 文件 + restart）；> 800M → 告警 | Q1 + P2 |
| 磁盘 | 工作区单份 `${JENKINS_HOME}/workspace/<job>`，每次构建前 `deleteDir()`；node_modules 21M 为单次峰值，不累积 | Q1 |
| 测试环境 | **P6（Test 阶段的库来源）未作答 → 不跑第一次真流水线**，先做 §2.2 第 5 步的冒烟构建 | 2026-08-25 补（F1） |
| 时间盒 | 按阶段收工，不按钟点硬撑：① 装不上或解锁不了 → 止步在 §2.2 第 4 步，当天不建 job；② 首次构建连续两次失败且未定位到是哪个阶段 → 停止重试，记录阻断点（报错 / 日志 / 已做步骤）。开工时把两个阶段各自的收工钟点填这里：______ | 操作链纪律（2026-08-25 细化，F7） |
| 边界 | 出现任何需要写服务器才能继续的步骤 → 停止，顺延 D3 | D2 硬边界 |
| 触发偏差 | D2 轮询对象 = `feature/w11-d2-jenkinsfile`（P3+P4 拍板的临时偏差，与 Q3「只轮询 main」不同）；**D3 必做：`Branch Specifier` 改回 `*/main`**，迁回后偏差消除 | P3+P4 + Q3 |

---

## 3. 需要本人拍板的执行期决策（答完冻结）

> 2026-08-25：P1、P2 已于 8/24 作答冻结；**P3 与 P4 合并作答**（F2，理由见 P3）；**新增 P6**（F1）。
> 今天动手前必须答完的是 P3+P4、P5、P6；AI 只出题、追问与 review，不取值。

### P1（插件清单）initialAdminPassword 解锁时装哪些插件？

选项：① 推荐插件集（Jenkins 默认勾选一批）；② 最小集（只装 Git / SSH / Pipeline 三个，D1 Q1 提的）。

必答追问：推荐集与最小集的后续维护成本差在哪；SSH 插件（`SSH Username with private key` 凭据类型）是 D3 才用的，今天装它有没有即时必要。

> 答（本人，2026-08-24）：
> **装最小集**：解锁后点 `Select plugins to install`，在分类勾选页搜索并勾选 `Pipeline` 和 `Git` 两个条目，**不勾选 SSH 插件**（D3 再装）。
> **边界**：Pipeline 是 umbrella 插件，连带依赖会拉 15–25 个，远小于推荐集；验证②实测 RSS 后以事实为准，不拿预测数当基线；如遇 `restart` 标记，`brew services restart jenkins-lts` 后采内存基线。

### P2（JAVA_OPTS 落点）`-Xmx512m -Xms256m` 设在哪？

Jenkins 由 brew services 启动时，JVM 参数经 plist 的 JavaOptions 或环境变量注入。落点与重载方式直接决定回滚 §2.4 第 3 行怎么做。

> 答（本人，2026-08-24；含契约事实修正）：
> **选选项 A**：`/usr/local/etc/services/jenkins-lts.env` 写入 `JAVA_TOOL_OPTIONS=-Xmx512m -Xms256m`。
> **理由**：brew 官方唯一持久、隔离、升级后保留的机制（usage banner 写明）；不影响其他服务；回滚 = 删文件 + restart。放弃 B（JVM 默认堆约 8 GiB 上限，突破 D1 合约红线）、放弃 C（自管 launchd plist 与轻量维护原则相悖）。
> **【事实修正，2026-08-25 执行期（F10）】路径从 `~/.homebrew/services/` 改为 `/usr/local/etc/services/`**：实测 `brew --prefix` = `/usr/local`（`/usr/local/bin/brew` → `../Homebrew/bin/brew`），`~/.homebrew/` 只是 trust 缓存目录。机制是否被本地 brew 6.0.6 支持由验证 ②a 实证；②a 失败按 §2.4 第 3 行回滚并重估落点。决策本体（选 A 用 env 文件机制 + 回滚=删文件）不变，不重开。
> **执行顺序**：启动 Jenkins 前先建好 env 文件，一次到位——验证②的 RSS 直接反映 512m 约束下的基线，不需先跑默认堆再调再重启。
> **事实修正**：`brew install openjdk@17`（原 Q1 第 ① 条）已删除——formula 实际 `depends_on "openjdk@21"`，service 启动硬编码走 21 的二进制路径；改动清单已同步。

### P3 + P4（合并）job 形态、Jenkinsfile 落哪个分支、变红实验推哪里

**2026-08-25 合并理由（F2）**：P3 与 P4 是同一个约束的两半。Q2/Q3 已冻结「Jenkins 只轮询 main」。
若 P3 选「Pipeline script from SCM」且指向 main，job 必须能在 **main** 上读到 `week11-ci/Jenkinsfile`；
而本周开发在 `claude/w11d2-learning-plan-bl49c5` 分支，PR 合并前 main 上没有这个文件，job 会报找不到 Jenkinsfile。
「脚本放哪个分支」和「变红提交推哪个分支」必须一次拍完，否则第 8 步会当场卡住。

**P3（job 形态）**：pipeline job 用「Pipeline script from SCM（读仓库 Jenkinsfile）」还是界面贴脚本？

D1 §2.5.2 已点出「Jenkinsfile 进仓库 = 流水线本身可 diff 可回滚」。今天是否立即按这个形态落，还是先界面贴脚本、D3 再迁？

必答追问（2026-08-25 追加）：**第一次构建之前，Jenkinsfile 要不要先合进 main？**
如果不合，今天用什么形态跑通验收句第 1 段——界面贴脚本，还是让 job 临时指向功能分支？
若临时指向功能分支，它与 Q2「只轮询 main」是不是同一件事，D3 迁回 main 时要改哪些配置？

**P4（变红实验）**：把测试改失败这个实验，怎么执行才不在 main 上留下无法解释的失败提交？

轮询只盯 main（Q2/Q3）。变红实验需要 push 到 main 才能被轮询看到，这个坏提交会在 main 留记录。还原靠 revert（留一条反向提交）还是 reset（改写历史）？实验期间 Actions 也会跑同一次提交，是否接受？

必答追问（2026-08-25 追加）：这里的前提「必须 push 到 main」是否成立？
手动触发一次指向功能分支的构建同样能让流水线变红，它与 P3 的答案是绑定的——两者一起答。

> 答（本人，2026-08-25；AI review 修正 Poll SCM 机制后冻结）：
> **job 形态**：Pipeline script from SCM，`Branch Specifier` = `*/feature/w11-d2-jenkinsfile`，勾选 Poll SCM（日程 `H/5 * * * *`，与 Q2 的 ≤5min 轮询延迟一致）。
> **不先合 main**：第一次构建前 Jenkinsfile 不 PR 合入 main——功能分支首次构建全绿（变红实验完成、Jenkinsfile 定稿）后才合入。
> **触发与分支的关系（修正后）**：Poll SCM 轮询的对象就是 `Branch Specifier` 指定的分支——今天轮询**功能分支**（push 功能分支即自动触发），不是 main。这是相对 Q3「只轮询 main」的**临时偏差**，显式留痕（§2.5），D3 迁回 main（只改 `Branch Specifier` 为 `*/main`）。
> **变红实验（P4）**：功能分支改坏测试 → push → 轮询感知 → 流水线红（验证「提交→感知→构建→红」全链路）；还原 = 修复测试再 push → 绿。**不用 reset 改写历史**（main 不被触碰；功能分支坏测试提交保留为实验记录，用修复提交恢复可合并状态）。实验期间只改测试、不改 Jenkinsfile，保证合入 main 的 Jenkinsfile 就是验证过的版本。接受 Actions 对同一次 push 也红（功能分支红不污染 main）。

### P5（服务器零改动的证明）验收句第 3 段怎么验证？

「整个过程中服务器零改动」——什么命令能证明？对比块 C 已采基线（authorized_keys 395 字节、sudoers 内容、监听列表）是否够？

> 答（本人，2026-08-25）：
> **方式**：三层只读对比。基线在**装 Jenkins 之前**采集一次（SSH 只读，覆盖整个 D2 窗口），九步全部完成后对比一次，diff 输出作为验收证据。
> **对比项（7 项）**：① `sha256sum ~/.ssh/authorized_keys`（对照块 C 的 395 字节）；② `sudo -l` 完整输出；③ `ss -tlnp` 监听列表；④ `systemctl list-units --type=service --all`；⑤ 工作副本 `git status --porcelain` + `rev-parse HEAD`；⑥ 进程快照（按 `grep -E 'jenkins|java|node'` 或全量落文件，不用 `head -30` 截断）；⑦ `/tmp` 下 jenkins 残留文件计数。
> **证据落点**：基线文件存 `week11-ci/notes/` 入 git；任何一项变化即验收失败。SSH 登录留痕（auth.log / lastlog / journald）按 §2.3 ⑦ 口径不计入改动。

---

### P6（Test 阶段的库来源）Jenkins 跑 `npm test` 时，两个集成测试连哪个 MongoDB？

**2026-08-25 新增（F1）。D1 契约没有覆盖这一项**：Q3 只统一了「两条流水线都用 `npm ci`」，没定测试的运行环境。

事实前提（2026-08-25 读代码确认，`week2-express/src/__tests__/auth-flow.test.js:24-48`，`monthly-sales.test.js` 同构）：

| 条件 | 实际行为 |
|---|---|
| `MONGODB_URI` 有值 | 连该外部库；库名必须是 `skillup_test`，否则抛 `Invalid test database` |
| 无值，且 `process.env.CI` 为真 | 抛 `MONGODB_URI is required in CI environment`，测试直接失败 |
| 无值，且 `CI` 未设 | 起 `MongoMemoryServer`；首次运行要下载 mongod 二进制到 `~/.cache/mongodb-binaries`（走网络，且在 workspace 之外，`deleteDir()` 清不掉） |

Actions 侧靠 `ci.yml` 的 `services.mongodb`（mongo:7）加 `env.MONGODB_URI` 解决；开发机上没有 service 容器这个机制。
块 C 记录：开发机 docker client 29.6.1、**daemon 未运行**（colima 未启动）。

**同构风险**：`incidents/2026-07-17-ci-lockfile-drift.md` 的根因是「同一个仓库里两套装依赖的方式只统一了一半」。这里是同一个形态，轴从依赖换成了数据库。

选项（只列不选，取值由本人拍板）：① 开发机本地 mongod + `MONGODB_URI=mongodb://127.0.0.1:27017/skillup_test`；② 不设 `MONGODB_URI` 并确认 `CI` 未被注入，走 `MongoMemoryServer`；③ colima 起 `mongo:7` 对齐 Actions。

必答追问：
① 选定的方式下，`CI` 变量的实际取值是什么（③a 当场测，不预测）——它决定会不会命中第二条分支；
② 这个选择会不会让 Q3「Jenkins 部署前自己再跑一次测试，防环境差异」的理由失效：如果 Jenkins 的库来源与 Actions 不同，两边测的是不是同一件事；
③ 磁盘基线「`node_modules` 21M 为单次峰值、不累积」在选项 ② 下是否还成立（mongod 二进制缓存不在 workspace 里）；
④ 该决策要不要回填 D1 契约 §5.1 发布契约表——它是流水线阶段定义的一部分，还是仅 D2 的执行细节。

> 答（本人，2026-08-25；AI review 修正「与 Actions 对齐」事实错误后冻结）：
> **选②**：不设 `MONGODB_URI`，冒烟构建确认 `CI` 未注入后走 `MongoMemoryServer`。
> **定位**：Jenkins 侧**隔离验证**（不是「与 Actions 对齐」——Actions 走 `mongo:7` 容器 + 注入 URI，两边数据库来源不同）。
> **追问①（CI 取值）**：预测 `CI=未定义`，按 §2.2 第 5 步冒烟构建当场实测，预测不代替验证。
> **【执行期修正，2026-08-25 冒烟构建实测】`CI` 取值与追问①预测不符**：`printenv CI` = `true`——**Jenkins 2.568.2 内置注入 `CI=true`**（与 Actions 行为一致，出现在构建环境 `BUILD_*`/`JENKINS_*` 内置变量组；config.xml / nodes / job / launchctl / shell / plist 均无可配置来源）。处理（本人拍板，维持选②）：**Jenkinsfile Test 阶段 `withEnv(['CI='])` 显式置 CI 为空串（JS falsy）**，走 MMS；不设 `MONGODB_URI`。理由：`CI=true` 在 Jenkins 是通用 CI 标记，与测试代码「CI=需要外部库」语义不同；最小改动、维持隔离验证定位、兼容 Q1 内存约束。
> **追问②（Q3 关系）**：Q3 防的是「Jenkins 测试环境 vs 部署目标」差异，不是 Jenkins vs Actions。D2 测试阶段接受 MMS 与生产 mongod 的差异；兜底 = D3 Verify（生产服务跑真实 mongod + §5.5 只读探活：`/health`、mongosh ping、业务接口、公网 443——**非**读写记录验证，Q15 冻结的 Verify 全为只读）。若版本行为差异落在 API 探活路径上，Verify 拦下；若在低频路径（报表聚合 / 权限校验），Verify 探不到——该局限 D3 判断红灯时须记起。
> **追问③（磁盘基线）**：成立——MMS 二进制缓存 `~/.cache/mongodb-binaries` 在 workspace 外，node_modules 21M 不受影响。
> **追问④（回填）**：回填 D1 契约 §5.1 Test 行。

---

## 4. 执行记录（滚动）

### 基线采集（P5，2026-08-25，装 Jenkins 前）

- **三连**：证明装 Jenkins 前后服务器 7 项零变化（认证/特权/网络/服务/工作副本/进程/临时文件）；before 落盘 + 收尾同命令 after + diff；失败症状：SSH 拒→查密钥别名、sudo 卡→`ssh -t`、ss 无进程名→加 sudo。
- **命令**：`ssh vps-skillup '...7 项只读...' > week11-ci/notes/d2-server-baseline/d2-baseline-before.txt`
- **结果**：7 项与契约 §5.6 块 C **全部一致**——① `authorized_keys` sha256 `bb7e06…1452a`（新锚点）；② `sudo -l` 4 条授权 + use_pty；③ 监听 8 端口（3000/443/80/22/27017/8081/8080/53，双栈 22）；④ nodeapp/mongod/nginx active running + 4 个 check timer loaded；⑤ 工作副本 `?? week8-fullstack/src/frontend/dist-admin443/` + HEAD `6a1b1a1`（服务器未 fetch）；⑥ 进程仅 nodeapp（PID 2143626，8/20 起，无 jenkins/java）；⑦ `/tmp` jenkins 残留 0。
- **偏差与归因**：① 首次 `ssh ubuntu@43.128.154.242` 被拒（publickey）——开发机 `~/.ssh/config` 有别名 `vps-skillup`（`IdentityFile ~/.ssh/admin.pem`），改用别名成功；② `ss -tlnp` 未用 sudo 无进程名列，不影响端口集合对比。

### 时间盒（用户拍板 2026-08-25）

- 阶段一（env → 安装 → 启动 → 解锁 → 冒烟构建）：**1.5h**
- 阶段二（Jenkinsfile → job → 变红 → 还原 → 合 main → 服务器核对）：**2.5h**
- 均含排障 buffer；按 §2.5 时间盒规则到点收工，不硬撑。

### 九步执行进度（2026-08-25）

| 步 | 动作 | 结果 |
|---|---|---|
| 1 | 建 env 文件 | `/usr/local/etc/services/jenkins-lts.env` 已建（nezha:admin 644，`JAVA_TOOL_OPTIONS=-Xmx512m -Xms256m`） |
| 2 | `brew install jenkins-lts` | 成功；验证 ① 通过（openjdk 21.0.12.1） |
| 3 | `brew services start jenkins-lts` | 成功（label homebrew.mxcl.jenkins-lts，PID 55501）；**意外事实**：`brew services list` 显示开发机 `mongodb-community` 也在跑（P6 选项①代价认知修正，不重开 P6） |

**验证 ②a：不通过（F10 预案触发）**——plist 无 `EnvironmentVariables`；jcmd 实测 `MaxHeapSize=8589934592`（8 GiB 默认）+ `InitialHeapSize=536870912`（512 MiB=32G/64 默认），`JAVA_TOOL_OPTIONS` 未被 JVM 读到。根因：本地 brew 6.0.6 的 `brew services` 不读 `etc/services/*.env`（plist 生成无此逻辑）。
**验证 ② 部分**：Jenkins 运行中，启动期 RSS 282 MB（低于 720M 止步线；待启动完成复采稳定值）。
**验证 ③**：`http://localhost:8080` 显示「解锁 Jenkins」页；`initialAdminPassword` 在 `/Users/nezha/.jenkins/secrets/initialAdminPassword`。

**当前阻塞：P2 落点重估待本人拍板**（候选见 §3 P2 注记，答案冻结后 restart 应用）。

### P2 落点重估（2026-08-25，已冻结）

- **②a 首次不通过（F10 触发）**：本地 brew 6.0.6 不读 `etc/services/*.env`（plist 无 `EnvironmentVariables`，jcmd 实测 `MaxHeapSize=8589934592` 8 GiB 默认）。
- **本人拍板：选 A**（改 plist 注入 `EnvironmentVariables` + launchctl 自管）。理由：精确隔离（不拖累其他 JVM 工具）/ 契约一致性（不推翻 Q1 的 512m 红线）/ 可回滚可版本化。
- **落地**：`~/Library/LaunchAgents/homebrew.mxcl.jenkins-lts.plist` 加 `EnvironmentVariables` 字典（`JAVA_TOOL_OPTIONS=-Xmx512m -Xms256m`，plutil lint OK）；`launchctl bootout` + `bootstrap` 重载。
- **验证 ②a 重跑：通过**——新进程 PID 56807，`MaxHeapSize=536870912`（512 MiB）。**验证 ② 完整通过**：RSS 308024 KB ≈ 301 MB（< 720M 止步线）。验证 ③：localhost:8080 解锁页可达（初始密码 `/Users/nezha/.jenkins/secrets/initialAdminPassword`）。
- **管理约定（留痕，防 D3/D4 困惑）**：jenkins-lts 此后**不用 `brew services` 管理**（其 start/restart 会重新生成 plist 覆盖 EnvironmentVariables 注入）；启停用 `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/homebrew.mxcl.jenkins-lts.plist` / `launchctl bootstrap ...`。brew upgrade 后需重加 `EnvironmentVariables` 块（约 2 分钟）。§3 P1 答案中「brew services restart」字样同步改为 launchctl 重启。

### 第 4 步插件安装执行偏差（2026-08-25）

- P1 冻结「最小集：Pipeline + Git，不勾 SSH」；实际安装时 **SSH 插件被装**（`SSH 159.v496ca_25e5e82`，自带 CSRF + 凭据 ID 枚举安全警告）。
- 本人拍板：**保留不卸载**（理由：装了就不卸，属机械动作，用到再用）。
### 冒烟构建（§2.2 第 5 步，验证 ③a）——2026-08-25

- **首次执行失败**：`node: command not found`——正是 F8 预判（launchd 拉起的 Jenkins 构建环境 PATH 无 `/usr/local/bin`；`launchctl getenv PATH` 无全局设置，launchd 进程 PATH=系统默认 `/usr/bin:/bin:/usr/sbin:/sbin`）。
- **环境事实（多源 node）**：`/usr/local/bin/node` = v24.16.0（官网 pkg，root:wheel 实体文件，**当前登录 shell 生效**）、`~/.nvm/versions/node/v24.18.0`（nvm，块 C 记录的「v24.18.0」是 nvm shell 值）、brew `node`/`node@26`。构建环境选型：**用 `/usr/local/bin`（v24.16.0）**，与服务器 v24.19.0 同 24 大版本，Q6 理由仍成立；npm 11.13.0 同目录。
- **修复**：Jenkins 全局配置 Environment variables 加 `PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`（Jenkins 全局 PATH 是替换不是追加，值须写全）。
- **重跑预期**：`node` v24.16.0、`npm` 11.13.0、`CI` 取值当场记录（不预测，预期 `CI-unset`，决定 P6 分支）。

### 冒烟构建重跑结果（2026-08-25）

- ✅ **成功**：node v24.16.0、npm 11.13.0。
- ⚠️ **意外：`printenv CI` = `true`，非预期 `CI-unset`**。来源调查（config.xml envVars 仅 PATH / nodes 无 / job 无 / launchctl 全局无 / shell 无 / plist 仅 JAVA_TOOL_OPTIONS）后定位：`CI=true` 出现在构建环境 `BUILD_*`/`JENKINS_*` 内置变量组中，**是 Jenkins 自身注入的构建环境变量**（与 GitHub Actions 行为一致），非任何可配置来源。
- **对 P6 的影响**：测试代码规则「无 `MONGODB_URI` 且 `CI` 为真 → 抛 `MONGODB_URI is required in CI environment`」——Jenkins 构建环境 `CI=true`，**P6 选②的「CI 未注入」前提不成立**，Test 阶段需处理（待本人拍板：unset CI 维持选② / 改选项① 本地 mongod / 其他）。

### P6 CI 处理拍板（2026-08-25）

- **本人拍板：选项 1——维持选② + Test 阶段 `withEnv(['CI='])`**。理由：最小改动（不改测试代码/不装新服务）；保留「隔离验证」定位（MMS 零持久化，兼容 Q1 的 512m 堆——colima/mongod 会额外抢内存）；与 Actions 差异已认知且有 D3 Verify 兜底（P6 追问②冻结）。
- `withEnv(['CI='])` 设 CI 为空串（JS falsy），不能写 `CI=false`（字符串 "false" truthy）。已在 Test 片段落地，完整 Jenkinsfile 由本人实现（黑名单）。
- 文档回填：落地单 §3 P6 答案块 + D1 契约 §5.1 Test 行（CI 处理注记）。

### 下一步：第 7 步——写 `week11-ci/Jenkinsfile`（黑名单，本人实现）

- 约束（Q4 阶段 1–3 + D2 硬边界）：**只 Checkout / Install / Test 三个阶段，无 Deploy / Verify**。
- 落 `feature/w11-d2-jenkinsfile` 分支并 push（P3+P4 拍板）。
- Test 阶段用已冻结的 `withEnv(['CI='])` 包裹 `npm test`；Install 用 `npm ci`（Q3 统一）；Checkout 用 SCM checkout。
- 变红实验期间只改测试、不改 Jenkinsfile（P3+P4）。

### 第 7 步完成（2026-08-25）

- Jenkinsfile 落 `feature/w11-d2-jenkinsfile`（commit `b161ddd`，已 push，远端同步）。格式化（AI 白名单）：补文件头边界注释 + Test 阶段 CI 处理注释，逻辑未动。
- 内置节点配置 `controller` 标签（config.xml `<label>controller</label>`，已生效）——`agent { label 'controller' }` 可用。

### 第 8 步：建 job + 首次构建（2026-08-25）

- job `w11-d2-pipeline`：Pipeline script from SCM + HTTPS 匿名 clone（零凭据）+ Branch `*/feature/w11-d2-jenkinsfile` + Poll SCM `H/5 * * * *` + Script Path `week11-ci/Jenkinsfile`。
- **首次构建（Build Now）：FAILURE——但非流水线/测试逻辑错误**：
  - Checkout / Install（npm ci 514 包 24s）✅；`validators.test.js`（纯单元）PASS ✅
  - 两个集成测试（monthly-sales / auth-flow）全部 `beforeAll` 超时（`Exceeded timeout of 5000 ms`）——**MMS 首次冷启动**（下载 ~100MB mongod 二进制 + 拉起）超过 jest hook 5s 超时，Q5 F4 已预记此成本
  - 日志尾「worker process failed to exit gracefully」= 超时杀掉的测试进程泄漏，属同一现象
- **下一步：重跑一次（Build Now）**——二进制已缓存 `~/.cache/mongodb-binaries`，第二次启动应显著加快；若仍超时再调查（并发 MMS 竞争 / hook 超时边界）。

### MMS 下载超时调查与预下载（2026-08-25）

- **重跑仍超时**（同 `beforeAll` 5s 超时），且 `~/.cache/mongodb-binaries/` 不存在 → 二进制从未下载成功，5s 内下载 ~100MB（实际 481M）不可能。
- **MMS 11.2.0 缓存机制实证**：两级缓存——项目级 `node_modules/.cache/mongodb-memory-server/`（`find-cache-dir`）与用户级 `~/.cache/mongodb-binaries/`（`DryMongoBinary.js` L202/L209）。预下载脚本在 `week2-express/src` 下跑，二进制落到**项目级**缓存（`mongod-x64-darwin-8.2.6`，**481M Mach-O x86_64，mongod 8.2.6**），Jenkins workspace（独立 `node_modules/.cache`）找不到 → 仍会重复下载。
- **处理**：复制二进制到用户级缓存 `~/.cache/mongodb-binaries/`（全局共享）；重跑构建验证。
- **顺带事实（P6 版本差异实证）**：MMS 默认 mongod **8.2.6**，Actions 用 **mongo:7**，生产 mongod 版本待核——三个库来源版本全不同，P6 追问②「隔离验证 + D3 Verify 兜底」的分工因此更具体。
- 临时脚本 `mms-predownload.mjs` 跑完应删（白名单工具，不入库）。

### MMS 超时根因定位与方案 A 落地（2026-08-25）

- **串行实证（开发机本地 `npm test -- --maxWorkers=1`）：9/9 通过**——`monthly-sales` 单文件 5.7s（`beforeAll` ≈4.5s，贴近 5s 边界）；单实例 MMS 启动实测 2.4s。
- **根因**：jest 默认并发 2 workers，两个 MMS 同时启动抢 CPU，`beforeAll` 超 5s（4 次构建同现象）；且 `~/.cache/mongodb-binaries` 无缓存时 5s 内下载 481M 二进制也不可能（双因素）。
- **本人拍板方案 A**（B 余量不足 0.5s、C 不解决资源竞争）：`maxWorkers=1`（串行）+ `testTimeout=30000`（留 5 倍余量）。
- **落地（白名单）**：`week2-express/src/package.json`——`test` script 加 `--maxWorkers=1`；新增 `"jest": { "testTimeout": 30000 }`。本地 `npm test`（无参数走配置）**9/9 通过 10.5s**。
- 影响面：Actions 连 mongo:7 无 MMS，串行只是慢一点，应仍绿（push 后验证）。

### 第 8 步完成：首次绿构建（2026-08-25）

- 构建 checkout `896cc2e`（package.json maxWorkers+testTimeout），Test 阶段 `--maxWorkers=1` 生效，**3 suites / 9 tests 全过，12.9s，SUCCESS**。
- **验收句第 1 段「从一次提交触发」部分达成**：一次提交（`896cc2e`）触发完整构建记录（依赖清单 + 三份测试 + SUCCESS）。⚠️ 本次触发是**手动 Build Now**（日志 `Started by user Xiao Li`），**Poll SCM 自动感知链路未验证**——留给第 9 步变红实验（push 坏测试 → 轮询感知 → 红）验证。
- 待确认：Actions 对 `896cc2e` 的状态（应仍绿）。

### 第 9 步：变红实验（2026-08-25）

- **坏测试提交 `804fe70`**：`validators.test.js` 改坏断言（`validateStatus`，expected `'pending'` 实收 `'completed'`）。
- **结果：流水线 FAILURE**（1 failed / 8 passed，日志含失败断言 `utils/__tests__/validators.test.js:7`）——**验收句第 2 段达成**（测试改失败 → 流水线确实变红）。Actions 对同一次 push 也红（P4 已接受，功能分支红不污染 main）。
- **网络故障插曲**：一次构建 `git fetch` 报 `Failed to connect to github.com port 443 after 75007 ms`（瞬态网络 75s 超时）——实证 Q2「构建依赖出站网络、抖动会红」；处理：记录 + 重试。
- **触发方式待确认**：两次构建日志均 `Started by user Xiao Li`——若为手动 Build Now，Poll SCM 自动感知链路仍未验证；还原 push 后**不手动**、等轮询验证。
- **还原已 commit `8dffc71`（未 push）**：断言恢复。push 后等轮询自动触发 → 绿（验证 ⑥ + 补验轮询链路）。
- 临时脚本 `week2-express/src/mms-predownload.mjs` 待删（git 未跟踪）。

### 轮询静默失败调查（2026-08-25）

- **现象**：还原 push（`8dffc71` + `a7f375e`）后 Jenkins 未自动触发构建。
- **排查**：job config.xml `SCMTrigger H/5 * * * *` 配置正确；`scm-polling.log` 显示轮询 `Caused: java.io.IOException`（git 访问失败）+ `Done. Took 1 min 3 sec` + **`No changes`**——轮询遇网络失败被静默当成无变化，不触发也不报错。
- **根因**：github.com 443 **间歇性网络失败**（瞬态波动）。实证：用户 push 走 SSH 成功、Jenkins 轮询/构建走 HTTPS 443 失败；网络恢复后 `curl -I https://github.com` → `HTTP/2 200`、`git ls-remote` 成功。
- **风险记录（D3 相关）**：轮询失败 → `No changes` 静默 = 监控盲区——D3 部署段依赖轮询，网络抖动会静默错过提交，人看到的是「流水线没动静」而非「轮询失败」。D3 设计验证时须考虑（如 Poll SCM 失败时观察 polling log，或部署段前手动确认）。
- **处理**：网络恢复后等下一轮轮询（≤5min）感知还原 commit → 应自动触发并绿（验证 ⑥ + 轮询链路）。

### 第 9 步完成：轮询链路验证 + 还原绿（2026-08-25）

- **构建 #7 由 Poll SCM 自动触发**（日志 `Started by an SCM change`，17:09）→ **SUCCESS**。
- **验收句第 1 段完整达成**：push → 轮询感知（网络恢复后）→ 自动构建 → 完整构建记录（依赖 + 三份测试 + SUCCESS）。
- **验证 ⑥ 达成**：变红后还原 → 流水线回绿。
- **验收句状态**：第 1 段 ✓、第 2 段（变红）✓、第 3 段（服务器零改动）**待核对**（验证 ⑦）。
- **下一步**：① Jenkinsfile PR 合入 main（P3+P4，变红实验定稿后）；② 服务器只读核对（基线 diff）。D3 必做：job `Branch Specifier` 改回 `*/main`（触发偏差消除）。

### 验证 ⑦：服务器零改动核对（2026-08-25，通过）

- **方法**：同基线命令采 `d2-baseline-after.txt`（192 行）→ `diff d2-baseline-before.txt d2-baseline-after.txt`。
- **diff 结果**：唯一差异在进程项——nodeapp **RSS 82464→82156 KB（-308 KB，内存正常波动）**、**TIME 7:07→7:26（累计 CPU 持续增长）**；PID（2143626）与 COMMAND 不变，无新增进程。其余 6 项（authorized_keys / sudo -l / 监听 8 端口 / systemd 服务 / 工作副本 HEAD `6a1b1a1` / /tmp 残留 0）**完全一致**。
- **判定**：**验收通过**——部署面零变更；RSS/TIME 属进程动态列，非部署面。改进点（P5 方案锦上添花）：进程项应只对比 PID+COMMAND 是否新增/消失，全量 `ps aux` diff 会引入动态噪音。
- **执行插曲**：用户两次把开发机命令粘贴到服务器终端（`ubuntu@VM-0-5-ubuntu:~$`）执行失败；由 AI 在开发机环境代为执行只读核对（命令内容用户已审核）。操作纪律：粘贴命令前先看提示符。

### 今日计划外报错全量核对（2026-08-25 收口）

> 核对口径：今天所有非预期错误/异常都应留痕。以下逐条对照记录位置；#8/#13/#14 为收口核实时发现的原遗漏，已补记。

| # | 计划外事件 | 处理 | 记录位置 |
|---|---|---|---|
| 1 | SSH `Permission denied (publickey)`（基线采集用了 `ssh ubuntu@` 而非 `vps-skillup` 别名） | 改用 `~/.ssh/config` 别名 `vps-skillup`（admin.pem） | 基线采集偏差① |
| 2 | 落地单 P2 路径 `~/.homebrew/services/` 不存在（brew 前缀实为 `/usr/local`） | 路径事实修正 | §0 F10 |
| 3 | 验证 ②a 失败：brew 6.0.6 不读 `etc/services/*.env`（plist 无 EnvironmentVariables，jcmd 实测 MaxHeapSize=8G） | P2 落点重估选 A（改 plist + launchctl 自管） | F10 + P2 落点重估 |
| 4 | 冒烟构建 `node: command not found`（launchd PATH 无 /usr/local/bin） | Jenkins 全局 PATH 补 `/usr/local/bin` | 冒烟构建 |
| 5 | 冒烟重跑 `printenv CI`=`true`（Jenkins 内置注入，与预测 CI-unset 不符） | P6 拍板 `withEnv(['CI='])` | 冒烟重跑 + P6 CI 处理 |
| 6 | 首次构建 `beforeAll` 超时（MMS 需下载 481M mongod 8.2.6 二进制，超 5s） | 预下载到用户级缓存 | MMS 下载超时调查 |
| 7 | 缓存后仍超时（jest 并发 2 个 MMS 竞争 CPU，beforeAll ≈4.5s 贴近边界） | 方案 A：`maxWorkers=1` + `testTimeout 30s` | MMS 超时根因定位 |
| 8 | 预下载脚本 `mongo.getBinaryPath()` TypeError（MMS 11.2.0 API 变化） | `create()` 已成功，不影响；临时脚本已删 | **本节补记（原遗漏）** |
| 9 | 变红实验流水线 FAILURE | 计划内实验，验证 ⑥ 还原后绿 | 第 9 步 |
| 10 | 一次构建 git fetch 失败（github.com 443 75s 超时，网络瞬态） | 重试即过 | 第 9 步网络故障插曲 |
| 11 | 还原 push 后轮询未触发（轮询网络失败被静默记 `No changes`） | 网络恢复后 #7 自动触发 | 轮询静默失败调查 |
| 12 | 服务器核对命令两次粘贴到服务器终端执行失败 | AI 在开发机环境代为执行只读核对 | 验证⑦ 执行插曲 |
| 13 | `git checkout main` 被拦截（落地单未提交改动） | 先 commit 笔记（`a529428`）再切分支 | **本节补记（原遗漏）** |
| 14 | merge diff stat 未显示 Jenkinsfile（虚惊，疑似漏合） | `git ls-tree main` 确认已在 main | **本节补记（原遗漏）** |

**补记细节**：
- **#8 getBinaryPath TypeError**：`mms-predownload.mjs` 第 6 行 `mongo.getBinaryPath()` 在 MMS 11.2.0 非函数（API 变化），脚本报错退出；但 `create()` 已成功（URI 已打印），预下载目的达成，不影响主流程。教训：MMS API 以实际版本为准，脚本错误处理要容忍工具脚本半途报错时先看目标是否达成。
- **#13 git checkout 拦截**：merge 前 `git checkout main` 因落地单有未提交改动被 git 拒绝（`would be overwritten`）；处理为先 commit 笔记再切分支。教训：切分支前先 `git status`，未提交改动会阻止跨分支切换。
- **#14 merge diff stat 虚惊**：`--no-ff` merge 输出未列出 `week11-ci/Jenkinsfile`，初看疑似漏合；`git ls-tree main` 确认文件已在 main。属 merge 输出格式特性（相对 merge-base 的差异显示），非问题。

## 5. 验证证据

（对应 §2.3 表格逐项填实测结果）

## 6. 明日入口（D3）

由 D2 执行结果定：
- D2 未达成验收句 → 先解决 D2 阻断，不进 D3
- D2 达成 → D3 主线：部署段 + 凭据（唯一写服务器的通道，Q8/Q9 定稿的 deploy-wrapper + sudoers 白名单 + `command=`），部署后验证按 Q15 清单落地

## 7. AI 辅助记录

- 2026-08-24：AI 起草本文件骨架——引用 D1 已拍板决策、四要素框架、验证表与 P1–P5 问题清单。属文档整理白名单。
- 黑名单项（Jenkinsfile 阶段逻辑、P1–P6 决策）全部留空待本人作答，AI 只 review。
- 2026-08-25（开工前 review）：本人要求 AI review 本规划。AI 读 D1 契约 Q1–Q18、`week11-plan.md` §4、`ci.yml`、`package.json`、两个集成测试的 bootstrap 段与块 C 基线后，报出 8 处问题（§0），并按 review 结论修订本文件、`week11-plan.md` §4、`day1-release-contract.md` §8。
  - **AI 的动作限于**：指出矛盾与覆盖缺口、补验证行与止步线、出题与追问、同步三份文档的措辞。
  - **未代答任何决策**：P3+P4、P5、P6 的取值仍全部留空；P6 的三个选项只列不选。
  - 工具行为说明（`Picked up JAVA_TOOL_OPTIONS` 的 stderr 输出、Jenkins System Information 的位置、launchd 的 PATH 与 Jenkins 构建环境）按 `AGENTS.md` §4「第一次见就无从推断的工具行为直接讲」处理，不计入辅助阶梯。
  - **未触发 `DEBT.md` 记账**：白名单文档整理 + L1 事实核对，黑名单零实现，全程未越过 L2。
- 2026-08-25（决策冻结 review）：本人作答 P3+P4 / P5 / P6 后，AI review 指出两处阻断性事实错误并校准一处契约语义：
  - **P6 事实错误**：本人初答称「ci.yml 未设 MONGODB_URI / 未启动 mongod」，与 `ci.yml` L16–29（`mongo:7` service + `env.MONGODB_URI`）相反，选②的「与 Actions 对齐」理由不成立；本人重答为「隔离验证 + D3 Verify 兜底」。
  - **P3 机制错误**：本人初答「轮询 main 但 SCM 拉功能分支」在 Poll SCM 下不成立（轮询对象 = `Branch Specifier` 指定分支）；本人修正为「轮询功能分支 + 临时偏差留痕 + D3 迁回」。
  - **Verify 语义校准**：本人称「Verify 读写一条记录验证」超出契约 §5.5（全只读，mongosh 仅 ping）；校准后兜底链条不变。
  - AI 动作限于出题、指出矛盾、校准事实与 review；**未代答任何取值**。**未触发 `DEBT.md` 记账。**
- 待补充：D2 执行后回填本段实际援助级别。

## 8. 收尾清单

- [x] P3+P4、P5、P6 本人作答并冻结（P1、P2 已于 8/24 冻结；2026-08-25 AI review 修正 2 处事实错误后通过）
- [x] 四要素（改动清单 / 验证 / 回滚 / 止步）本人核对——九步全部执行，执行记录为证
- [x] §2.2 第 5 步冒烟构建先跑，`CI` 取值（`true`，Jenkins 内置注入）与 node v24.16.0 / npm 11.13.0 当场记录
- [x] 按 §2.2 九步顺序执行并滚动记录
- [x] §2.3 验证逐项实测填表——①②②a③③a④⑤⑥⑦ 全部完成（见执行记录）
- [x] 验收句三段全部达成（一次提交触发完整记录 + 变红实验 + 服务器零改动）
- [x] 未触发 `DEBT.md`（黑名单止步 L2；全程无黑名单 L3/L4）
- [x] `LEARNING-STATE.md` 更新
- [ ] 技术英语口语稿（按 `DAILY-SPEAKING-PROTOCOL.md`）——D2 收口时生成
