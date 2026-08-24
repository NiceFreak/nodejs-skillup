# W11 Day 2（8/25）：controller 从零装起来 + 第一条只构建与测试的流水线

> 建立：2026-08-24（Asia/Shanghai，D1 收口后起草）
> 上游：[`day1-release-contract.md`](./day1-release-contract.md)（**契约已冻结，本文件不重开任何已拍板的题**）、[`week11-plan.md`](./week11-plan.md) §4 D2 / §7 交付物②
> 形态参考：W10 [`day2-logging-rollout.md`](../../week10-observability/notes/day2-logging-rollout.md) §2「变更单四要素」、W9 [`day5-rebuild-closeout.md`](../../week9-deployment/notes/day5-rebuild-closeout.md) §10
> 状态：**草稿待本人拍板**。§2 四要素引用 D1 已冻结决策；§3 P1–P5 为执行期决策，由本人作答后冻结，AI 只 review。

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

**明确不在清单内**（写下来防蔓延）：
- 不配置任何指向服务器的凭据（D2 硬边界）——不生成部署密钥、不写 `authorized_keys`、不改 sudoers、不建 Deploy 阶段
- 不改 `.github/workflows/ci.yml`（D1 止步条件；Actions 维持现状）
- 不动服务器任何东西（进程 / 配置 / 文件 / 端口）
- 不建 Deploy / Verify 阶段（排 D3）
- 不做类 2 最小样本复现（排 D4）
- 不动 `check-disk.sh` 属主（顺带项走独立变更单）

### 2.2 执行顺序（本人拍板）

安装顺序由依赖决定（JDK → Jenkins → 插件 → job → 流水线）。有一个可拍点：**首次构建用手动触发还是直接配轮询**。轮询需要 push 一次才能看到自动触发，手动触发可以立即验证构建记录形态。选哪个见 §3 P4 附近的取舍。

### 2.3 验证 = 可证伪实验（七项，逐项写死期望）

> 每一项都必须先写期望值再跑；没有期望的验证只是「看了看」。期望值来源列在末位。

| # | 验证 | 在哪跑 | 命令 / 动作 | **期望值** | 期望来源 |
|---|---|---|---|---|---|
| ① | JDK 可用 | 开发机 | `java -version` | 输出 openjdk 21.x（`/opt/homebrew/opt/openjdk@21/bin/java` 或 brew 前缀对应路径） | Q1 事实修正（依赖 21） |
| ② | Jenkins 进程存活 + 内存基线 | 开发机 | `brew services list` + `ps aux \| grep jenkins` | jenkins-lts started；记录 RSS 实测值，对照 §2.5 止步线 | Q1 内存合约 |
| ③ | 解锁页面可达 | 开发机 | 打开 `http://localhost:8080` | 显示解锁页（需读 initialAdminPassword） | 经验知识 |
| ④ | 首次构建记录 | Jenkins | Build Now（或轮询自动触发） | 日志可见：clone → `npm ci`（依赖清单）→ `npm test`（三份测试）→ 结论 SUCCESS | D2 验收句第 1 段 |
| ⑤ | 变红实验 | Jenkins | 把某测试改成失败 → push → 触发 | 流水线 FAILED，日志含失败用例名 | D2 验收句第 2 段 |
| ⑥ | 还原 | Jenkins | revert 变红改动 → push | 流水线回 SUCCESS | 变红实验的还原动作 |
| ⑦ | 服务器零改动 | 服务器（只读） | 只读确认（方式由 §3 P5 本人设计） | 无新增用户 / 无新增 authorized_keys / 无 sudoers 变更 / 无新监听端口 | D2 验收句第 3 段 |

⑤ 的变红实验会污染 main（轮询只盯 main），执行方式必须先想清楚——见 §3 P4。

### 2.4 回滚（卸载路径）

D2 全在开发机，回滚 = 卸载，无生产风险：

| 失败点 | 还原动作 |
|---|---|
| JDK / Jenkins 装错版本 | `brew uninstall jenkins-lts`（openjdk@21 是自动依赖，`brew autoremove` 清残留） |
| Jenkins 起不来 / 卡解锁 | `brew services stop jenkins-lts`，读日志（`brew services info jenkins-lts`）定位后再定卸载与否 |
| 内存超上限 | **删除 `~/.homebrew/services/jenkins-lts.env` → `brew services restart jenkins-lts`** → 恢复 JVM 默认堆行为（默认约 8 GiB 上限，已超出 512m 合约——回滚到「退出合约约束」状态本身即兜底动作，而非继续调参） |
| Jenkinsfile / 测试改动混乱 | 仓库内 `git checkout --` 还原；`week11-ci/` 是新增目录，直接删除 |
| 彻底清理 | `brew services stop` + `brew uninstall` + 删 `${JENKINS_HOME}`（默认 `~/.jenkins`） |

### 2.5 止步条件

| 维度 | 上限 / 动作 | 来源 |
|---|---|---|
| 内存 | Jenkins 进程 RSS > 720M → 下调 `-Xmx` 至 384m（改 env 文件 + restart）；> 800M → 告警 | Q1 + P2 |
| 磁盘 | 工作区单份 `${JENKINS_HOME}/workspace/<job>`，每次构建前 `deleteDir()`；node_modules 21M 为单次峰值，不累积 | Q1 |
| 时间盒 | 当天无法从一次提交触发出完整构建记录 → 记录阻断点（报错 / 日志 / 已做步骤），不硬撑，止步 | 操作链纪律 |
| 边界 | 出现任何需要写服务器才能继续的步骤 → 停止，顺延 D3 | D2 硬边界 |

---

## 3. 需要本人拍板的执行期决策（答完冻结）

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

### P3（job 形态）pipeline job 用「Pipeline script from SCM（读仓库 Jenkinsfile）」还是界面贴脚本？

D1 §2.5.2 已点出「Jenkinsfile 进仓库 = 流水线本身可 diff 可回滚」。今天是否立即按这个形态落，还是先界面贴脚本、D3 再迁？

### P4（变红实验）把测试改失败这个实验，怎么执行才不污染 main？

轮询只盯 main（Q2/Q3）。变红实验需要 push 到 main 才能被轮询看到——这个坏提交会在 main 留记录。还原靠 revert（留一条反悔记录）还是 reset（改写历史）？实验期间 Actions 也会跑同一次提交，是否接受？

### P5（服务器零改动的证明）验收句第 3 段怎么验证？

「整个过程中服务器零改动」——什么命令能证明？对比块 C 已采基线（authorized_keys 395 字节、sudoers 内容、监听列表）是否够？

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
- 黑名单项（Jenkinsfile 阶段逻辑、P1–P5 决策）全部留空待本人作答，AI 只 review。
- 待补充：D2 执行后回填本段实际援助级别。

## 8. 收尾清单

- [ ] P1–P5 本人作答并冻结
- [ ] 四要素（改动清单 / 验证 / 回滚 / 止步）本人核对
- [ ] 按 §2.2 顺序执行并滚动记录
- [ ] §2.3 验证逐项实测填表
- [ ] 验收句三段全部达成
- [ ] 未触发 `DEBT.md`（黑名单止步 L2）
- [ ] `LEARNING-STATE.md` 更新
- [ ] 技术英语口语稿（按 `DAILY-SPEAKING-PROTOCOL.md`）
