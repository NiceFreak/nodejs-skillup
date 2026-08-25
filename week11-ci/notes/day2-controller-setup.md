# W11 Day 2（8/25）：controller 从零装起来 + 第一条只构建与测试的流水线

> 建立：2026-08-24（Asia/Shanghai，D1 收口后起草）
> 上游：[`day1-release-contract.md`](./day1-release-contract.md)（**契约已冻结，本文件不重开任何已拍板的题**）、[`week11-plan.md`](./week11-plan.md) §4 D2 / §7 交付物②
> 形态参考：W10 [`day2-logging-rollout.md`](../../week10-observability/notes/day2-logging-rollout.md) §2「变更单四要素」、W9 [`day5-rebuild-closeout.md`](../../week9-deployment/notes/day5-rebuild-closeout.md) §10
> 修订：2026-08-25（D2 当日，本人要求 review 后修正 8 处，见 §0）
> 状态：**草稿待本人拍板**。§2 四要素引用 D1 已冻结决策；§3 P1–P6 为执行期决策，由本人作答后冻结，AI 只 review。

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
| 3 | 服务配置 | `~/.homebrew/services/jenkins-lts.env` | 写入 `JAVA_TOOL_OPTIONS=-Xmx512m -Xms256m`（开发机 32 GiB，已回填 §5.6） | P2 决策（选项 A） | 本人执行，AI 可给命令 |
| 4 | 初始化 | Jenkins UI | initialAdminPassword 解锁 + 装插件（最小集：Git + Pipeline） | Q1 + P1 决策 | 经验知识（解锁流程 AI 直接讲）；勾选本人操作 |
| 5 | 代码 | 新增 `week11-ci/Jenkinsfile` | 只构建与测试的流水线（Checkout / Install / Test） | Q4 阶段 1–3 + D2 硬边界 | **黑名单：本人实现**；Jenkinsfile 语法白名单，AI 只 review 阶段逻辑 |
| 6 | 服务配置 | Jenkins job | 新建 pipeline job 指向 Jenkinsfile | Q2 轮询触发 | job 形态由 §3 P3 本人拍板 |
| 7 | 服务配置 | Jenkins job（临时） | 冒烟 job：只跑 `node -v; npm -v; printenv CI`，验完即删 | 2026-08-25 补（F1 + F8） | 白名单，AI 可给命令，本人执行 |

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
6. 按 P6 的答案把 Test 阶段的库来源落实
7. 写 `week11-ci/Jenkinsfile`（黑名单，本人实现）→ 按 P3+P4 的答案决定它落在哪个分支
8. 建 pipeline job（形态由 P3 定）→ 首次构建 → 验证 ④
9. 变红实验 → 验证 ⑤ → 还原 → 验证 ⑥ → 服务器只读核对 → 验证 ⑦

**第 5 步不能省**：它是唯一在写 Jenkinsfile 之前就能暴露 PATH 与 `CI` 两个前提的动作，成本约一分钟。
**第 7 步与第 8 步的顺序由 P3+P4 决定**：若 job 用「Pipeline script from SCM」且指向 main，Jenkinsfile 必须先在 main 上，否则 job 报找不到文件。

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
| env 文件写错，或参数未被 JVM 读到（②a 不通过），Jenkins 起不来 | **删除 `~/.homebrew/services/jenkins-lts.env` → `brew services restart jenkins-lts`** → 回到 JVM 默认堆行为（默认最大堆约为物理内存 1/4，32 GiB 机器上约 8 GiB），先让服务可启动，再按 P2 重写落点 |
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
> **选选项 A**：`~/.homebrew/services/jenkins-lts.env` 写入 `JAVA_TOOL_OPTIONS=-Xmx512m -Xms256m`。
> **理由**：brew 官方唯一持久、隔离、升级后保留的机制（usage banner 写明）；不影响其他服务；回滚 = 删文件 + restart。放弃 B（JVM 默认堆约 8 GiB 上限，突破 D1 合约红线）、放弃 C（自管 launchd plist 与轻量维护原则相悖）。
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

### P5（服务器零改动的证明）验收句第 3 段怎么验证？

「整个过程中服务器零改动」——什么命令能证明？对比块 C 已采基线（authorized_keys 395 字节、sudoers 内容、监听列表）是否够？

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

---

## 4. 执行记录（滚动）

（执行时记录：每步命令 + 输出摘要 + 与期望的偏差）

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
- 待补充：D2 执行后回填本段实际援助级别。

## 8. 收尾清单

- [ ] P3+P4、P5、P6 本人作答并冻结（P1、P2 已于 8/24 冻结）
- [ ] 四要素（改动清单 / 验证 / 回滚 / 止步）本人核对
- [ ] §2.2 第 5 步冒烟构建先跑，`CI` 取值与 node / npm 版本当场记录
- [ ] 按 §2.2 九步顺序执行并滚动记录
- [ ] §2.3 验证逐项实测填表
- [ ] 验收句三段全部达成
- [ ] 未触发 `DEBT.md`（黑名单止步 L2）
- [ ] `LEARNING-STATE.md` 更新
- [ ] 技术英语口语稿（按 `DAILY-SPEAKING-PROTOCOL.md`）
