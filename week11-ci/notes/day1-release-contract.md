# W11 Day 1（8/24）：冻结发布契约

> 建立：2026-08-24（Asia/Shanghai）
> 上游：[`week11-plan.md`](./week11-plan.md) §2.2、§3.1、§5；[`LEARNING-STATE.md`](../../LEARNING-STATE.md)
> 形态参考：W10 的 [`day1-observability-contract.md`](../../week10-observability/notes/day1-observability-contract.md)、W9 的 [`day1-contract-freeze.md`](../../week9-deployment/notes/day1-contract-freeze.md) §4
> 状态：**契约冻结完成（2026-08-24）**。§4 的 Q1–Q18 全部由本人作答并回填；§4.1 九对冲突自查全部通过；§5 五张表填满；§5.6 只读基线为块 C 实测。D1 零副作用纪律保持到收口，服务器未做任何写操作。

---

## 1. 今日唯一主线与止步条件

**主线**：把 W11 从「一份周计划」压成「一份可执行的发布契约」——谁来执行、用什么身份、能动哪些东西、
每一步失败了算什么、失败之后退到哪，全部落到纸面，且互相不矛盾。

**完成判定**（四条同时成立才算 D1 通过）：

1. §4 的 **Q1–Q18 全部有本人写下的答案**。编号与 `week11-plan.md` §5 一一对应，不重组，避免两处漂移；
   本文件在每题上补的是**为什么问它**、**必答追问**和**事实前提指向**。
2. 答案通过 §4.1 的**冲突自查**。发布契约最容易出的错不是某条答错，是两条各自合理但合起来打架
   （例如「测试只在 controller 侧跑」与「服务器侧另装一次依赖」）。
3. §5 的五张表填满：发布契约表、部署身份与权限清单、一次发布的完整旅程、回滚判据表、部署后验证清单。
4. 能口述两件事：**一次提交从推送到服务器换版本经过哪些层、每层的失败点是什么**；
   以及**哪一类失败不会被任何一道检查拦下**。

**明确的止步条件**：**今天不装 Jenkins、不在服务器上创建任何用户或密钥、不改任何配置、不触发任何部署**。

契约冻结之前，`brew install` 一个 controller、在服务器上 `ssh-keygen`、往 `authorized_keys` 里加一行、
改 `sudoers`，都属于抢跑。这一条比 W10 更硬：W10 抢跑的代价是「写错的监控变成假事实」，
本周抢跑的代价是**一条没有边界的可写通道先于边界存在**，而它一旦开出来，很难知道它到底能做什么。

**今天唯一允许的服务器动作是只读采集**（§3 块 C）。所有命令都不改变状态，
并且是 §4 多个问题的事实前提——尤其 Q6（产物形态）、Q9（权限清单）、Q12（回滚目标）三条，
**没有基线就答不了**。

---

## 2. 决策输入（今天读到的事实，不是建议）

### 2.1 现在一共有几条「自动化」

| 条 | 覆盖范围 | 到哪为止 | 触发方式 |
|---|---|---|---|
| GitHub Actions（`.github/workflows/ci.yml`） | 遍历含 `package.json` 的目录，有测试文件才跑 `npm test`（带 `mongo:7` service）；另一个 job 跑前端 install + build | **测试通过**。不接触服务器 | push 到任意分支、PR |
| 手工发布（W9 D4 起沿用） | clone / `npm ci` / build / 送产物 / `systemctl restart` / `nginx -t && reload` | 服务器换版本 | 本人逐条敲 |
| W10 四项检查 + timer | 进程 / 内存 / 磁盘 / 证书 | 报出红绿 | `systemd timer` 定时 |

**读出的缺口**：第一条与第二条之间没有连接，而这一段正是本周要补的。第三条已经是现成的部署后验证材料。

### 2.2 从 W9 读出的手工发布步骤（流水线要复刻的对象）

W9 D4 §10.3 已经把这件事写死过一次：「今天手工做的每步都是 CI/CD 脚本要复刻的真相源；结构不需要推翻，只需脚本化。」
那六步是：`clone` → `npm ci` → `build` → 送产物 → `systemctl restart` → `nginx -t && reload`。

**今天要对它做的事不是照抄，是逐步判定**：哪几步在当前形态下真的存在（Node 应用没有 `build`）、
哪几步归 controller、哪几步归服务器、哪几步本周明确不交给自动化（`nginx -t && reload` 见 Q7）。
这份判定就是交付成果②对照说明的左栏。

### 2.3 从代码读出的、影响流水线的六条事实

| # | 事实 | 位置 | 对哪一题是前提 |
|---|---|---|---|
| 1 | 启动命令是 `node --env-file=.env server.js`，`.env` 不在仓库里、属主 nodeapp、权限 600 | `week2-express/src/package.json`、W9 D2 | Q7（部署单元不含 `.env`）、Q11（环境分离的落法） |
| 2 | 测试有三份：`__tests__/monthly-sales.test.js`、`__tests__/auth-flow.test.js`、`utils/__tests__/validators.test.js`；前两份走 `mongodb-memory-server`，运行时会拉起一个真实 mongod 进程 | `week2-express/src/` | Q5（测试跑在哪一侧） |
| 3 | `package-lock.json` 存在，`npm ci` 可用；`bcrypt` 是带原生扩展的依赖，`allowScripts` 白名单里列了它 | `week2-express/src/` | Q6（产物形态）、Q13（原子性） |
| 4 | `/health` 已实现，**只回 `{status:'ok'}`，不读 mongoose** | `app.js:85–91` | Q15（部署后验证选哪几项，以及它证明不了什么） |
| 5 | `server.js:42` 的 `app.listen(...)` 带成功回调，**全文没有任何 `.on('error')`**；48–52 行的 `try/catch` 只捕获同步错误 | `week2-express/src/server.js` | Q16（类 2 假 active 最小样本）、Q15（部署后验证能不能识别「active 但没监听」） |
| 6 | 仓库 `.nvmrc` = 24；服务器侧 Node 由 NodeSource 装在 `/usr/bin/node`（W9 D2 实测 v24.19.0） | 仓库根 + W9 D2 | Q6（构建机与目标机的 ABI 是否匹配） |

### 2.4 从 W9 / W10 继承、今天不重新论证的环境事实

见 [`week11-plan.md`](./week11-plan.md) §0 的整表，此处不复制。今天只需要记住其中四条对答题有直接约束的：
**服务器上目前零凭据**；**available 1169 MB（2026-08-24 块 C 实测；W10 记录的 1388 MB 为过去值）、swap = 0**；**唯一生产机承载五个公网面**；
**check-disk 红线 4 GB（字节级判据）**。

### 2.5 前置概念（W11 需要、但仓库里还没出现过的基础）

> 按 `AGENTS.md` §4 的分工：本节是 **L1 讲解**（原理与职责边界，读文档能查到的那一类），
> 由 AI 直接给，不要求先猜；**基于这些概念做的选择**（§4 的每一题）仍由本人作答。

#### 2.5.1 CI / 持续交付 / 持续部署是三个刻度，不是一个词

- **持续集成**：每次提交都自动合并进主线并跑验证，回答「这次改动有没有破坏已有行为」。仓库现在的 Actions 就停在这一刻度。
- **持续交付**：验证通过后**产出一个随时可以发布的东西**，发布动作仍由人按按钮。
- **持续部署**：验证通过就自动上线，没有人按按钮。

Excel 的交付成果①写的是「代码推送后由 Jenkins 自动构建、跑测试并部署到服务器」，字面落在**持续部署**这一档。
Q2 的答案会决定本周实际做到哪一刻度，以及验收句怎么写。

#### 2.5.2 Jenkins 的三个概念

- **controller**：调度、界面、凭据保管、构建记录的存放处。
- **agent**：真正执行构建步骤的机器。可以就是 controller 自己（本周的默认形态）。
- **pipeline / Jenkinsfile**：一次可重复执行的定义。声明式语法的骨架是 `pipeline { agent … stages { stage('X') { steps { … } } } }`。

要点：Jenkinsfile 放进仓库之后，「流水线怎么跑」本身也变成了会被 diff、被 review、被回滚的代码。
这与「在界面上点出来一个 job」是两种不同的可追溯性。

#### 2.5.3 触发方式：webhook 与轮询的差别是网络位置，不是配置

- **webhook**：GitHub 在收到 push 之后，主动向一个 URL 发一次 HTTP 请求。**前提是那个 URL 从公网可达。**
- **轮询**：Jenkins 每隔一段时间问远端「有没有新提交」。不需要入站可达，代价是延迟（最多一个轮询间隔）与持续的出站请求。
- **手工 / 定时触发**：与提交事件无关。

开发机在 NAT 后面没有入站可达的地址，**这是网络位置决定的，改 Jenkins 的任何配置都不会改变它**。
Q2 要选的就是在这个约束下「自动」还能是什么意思。

#### 2.5.4 凭据注入与日志 mask 的边界

Jenkins 的 credentials 是一条带 id 的记录，构建里用 id 引用，值在运行时注入环境变量或临时文件；
构建日志里对已注册的值做替换。两条边界必须知道：

1. **mask 只认「Jenkins 知道的那个字符串」**。把凭据变形之后再输出（base64、拼接、写进另一个文件再 `cat`），就不再被替换。
2. **凭据一旦出现在日志里，就按已泄露处理**，因为构建日志会被保留、被翻阅、被复制进笔记。

这与 W10 的日志脱敏是同一条纪律的两个落点：那边防的是应用日志，这边防的是构建日志。

#### 2.5.5 服务器怎么接受一个自动化身份：两个正交的机制

- **SSH 公钥认证**：公钥写进目标用户的 `~/.ssh/authorized_keys`，私钥留在 controller 侧。
  `authorized_keys` 的每一行前面可以加限制项，例如 `command="…"`（这把钥匙登录后只执行指定命令，
  客户端传什么命令都不算数）、`no-port-forwarding`、`from="…"`。**它限制的是「这把钥匙进来能干什么」。**
- **`sudoers` 的 NOPASSWD 白名单**：允许某个用户在不输密码的前提下，只执行指定的几条命令。
  **它限制的是「这个用户能提权做什么」。**

两者解决的是不同的问题，可以叠加，也可以只用其中一个。
本周要定的不是「用哪个」，而是**这条通道的完整形状**：谁登录、登录后能跑什么、需不需要提权、提权能跑什么（Q8 / Q9）。

#### 2.5.6 部署的原子性：原地更新与旁路切换

- **原地更新**：直接在运行目录上 `git checkout` + `npm ci` + 重启。
  失败面在于**中间态**：代码已经换成新版本、依赖只装了一半、旧版本已经不在了，重启起不来且没有可退的东西。
- **旁路切换**：新版本装在旁边的新目录，装好并验证之后，把一个符号链接指过去再重启；回滚等于把链接切回去。
  代价是磁盘上要同时留几份，且 systemd 的 `WorkingDirectory` 要指向那个链接而不是具体目录。

选哪一种直接决定 **Q12 的回滚是「重新跑一次旧版本的完整部署」还是「切一个指针」**，二者的耗时和失败面差一个量级。

#### 2.5.7 制品：Node 应用没有编译产物，所以「制品」要先被定义

编译型语言的制品是编译输出（jar、二进制）。Node 应用没有这一步，所以「归档什么」有两种答案：

- **源码 + lockfile**：依赖在目标机上装。目标机需要联网，且 `bcrypt` 这类带原生扩展的包可能需要编译工具链（或能拉到预编译二进制）。
- **源码 + `node_modules` 一起打包**：依赖在构建机上装，目标机不联网也不编译。
  代价是**构建机与目标机的操作系统和 Node ABI 必须匹配**——在 macOS 上装出来的 `bcrypt` 原生二进制，
  在 Ubuntu 上加载不了。这条是 Q6 的硬约束，也决定了延伸项④（S3 归档）到底有没有一个可归档的对象。

#### 2.5.8 可重复构建：`npm ci` 与 `npm install` 是两种语义

`npm ci` 严格按 `package-lock.json` 安装，lockfile 与 `package.json` 对不上就直接失败；
`npm install` 会解析依赖并**更新** lockfile。同一个提交跑两次流水线要得到同样的结果，靠的是前者。

仓库已经为此付过一次代价：[`incidents/2026-07-17-ci-lockfile-drift.md`](../../incidents/2026-07-17-ci-lockfile-drift.md)
记录的正是 lockfile 与 `package.json` 对不上导致 CI 红灯，且根因是「引入 Yarn 时只做了一半、两份 lockfile 并存」。
本周新增流水线时，这类「同一个仓库里有两套装依赖的方式」的风险会再出现一次（Q3 / Q6）。

#### 2.5.9 部署后验证与健康检查不是同一件事

- **健康检查**是常驻的、给机器看的、频繁执行的，它必须便宜（所以 `/health` 不读数据库，见 §2.3 第 4 条）。
- **部署后验证**是一次性的、在一次已知的变更之后执行的，它可以贵一些、可以覆盖更多层（例如从公网打一次真实请求）。

W10 盲区②之所以存在，是因为常驻检查只探本地进程；而**一次性的部署后验证并不受同样的约束**。
Q15 要写清的就是这两个口径各自的适用范围，避免和 W10「常驻检查不上公网探针」的结论互相矛盾。

---

## 3. 今日时间盒

| 块 | 时长 | 内容 | 产出 |
|---|---|---|---|
| A | 20 min | 读 §2.1–§2.4，回到 `package.json` / `app.js` / `server.js` 逐条核对（**不改代码**） | 能复述 §2.3 的六条事实，尤其第 3 条（原生依赖）和第 5 条（listen 无 error 监听） |
| B | 30 min | 读 §2.5 前置概念，没懂的记进 §6 问答沉淀区 | 能说清「webhook 与轮询的差别为什么不是配置问题」「原地更新与旁路切换各自的回滚形态」 |
| C | 25 min | **只读采集**（今天唯一允许的服务器动作，命令清单见下） | §5.6 基线填满——**这是 Q6 / Q9 / Q12 的事实前提，先做** |
| D1 | 50 min | 答 §4.2（Q1–Q3 触发与 controller）+ §4.3（Q4–Q7 流水线内容） | 7 个答案 |
| D2 | 50 min | 答 §4.4（Q8–Q10 凭据）+ §4.5（Q11–Q14 环境与回滚）+ §4.6（Q15–Q18 移交与范围） | 11 个答案 |
| E | 30 min | 跑 §4.1 冲突自查；填 §5 的五张表 | 表填满 + 冲突清零 |
| F | 20 min | 回填 `week11-plan.md` §5 与 §4 的 D1 勾选、更新 `LEARNING-STATE.md`、按 `DAILY-SPEAKING-PROTOCOL.md` 生成口语稿 | D1 收口 |

**块 C 的只读命令清单**（全部无副作用，逐条把输出记进 §5.6）：

服务器侧：

```bash
# 当前线上跑的是哪个版本（Q12 回滚目标的起点）
cd /home/nodeapp/nodejs-skillup && git rev-parse HEAD && git log -1 --oneline && git status --short

# 部署单元的体积与依赖现状（Q6 产物形态的输入）
du -sh /home/nodeapp/nodejs-skillup/week2-express/src/node_modules
node -v && npm -v                      # 目标机的 Node / npm 版本，对照 .nvmrc = 24

# systemd 单元的当前形态（Q7 部署单元、Q13 原子性的输入）
systemctl cat nodeapp

# 现在谁能提权做什么（Q9 权限清单的起点）
sudo -l

# 现在是怎么登录进来的（Q8 认证方式的起点；公钥记录时只留指纹，不抄全文）
ls -la ~/.ssh/ && ssh-keygen -lf ~/.ssh/authorized_keys

# 部署单元的属主（Q8 用哪个身份写文件）
id nodeapp && ls -ld /home/nodeapp/nodejs-skillup

# 资源基线（Q13 中间态、Q18 stretch 上限的分母）
df -B1 / && df -h / && free -m

# 复核 W10 收口态（部署后验证的对照组）
ss -tlnp && systemctl list-timers --all | grep check-
```

开发机侧（延伸项与 controller 的前置条件，全部只读）：

```bash
java -version            # Jenkins 与 Java stretch 的前提：有没有可用 JVM、什么版本
docker version           # 延伸项「Docker 统一构建环境」的前提（W3 曾记录 Docker.app 丢失过）
node -v && npm -v        # 构建机与目标机的版本差（Q6 的 ABI 约束）
df -h                    # 构建工作区的磁盘余量
```

> 块 C 若登不上服务器，记为阻塞并**跳过**，用 `week11-plan.md` §0 的既有数字先答；
> **不要**为了拿数据临时改任何配置或安装任何东西——那是 D2 及以后的动作。
> `sudo -l` 会提示输入密码，但它本身不改变任何状态，属只读。

---

## 4. 需要本人作答的决策问题

按 `AGENTS.md` 与 `week11-plan.md` §6：凭据模型、权限清单、阶段划分与失败判据、回滚判据、
部署后验证的选择，全部属黑名单，**AI 只提问和 review，不给答案**。每题下方的 `> 答：` 由本人填写。

### 4.0 已定，今天不重开

- **Java 归属**：8/17 已拍板，最小 jar + systemd + Nginx location 与 Maven 构建 job 一起放在 W11，主线收口后才开始，未完成不阻断验收。
- **controller 不与部署目标同机**：Excel 第 3 周行的执行前提，且与 §2.4 的内存基线一致。今天要定的是它**具体装在哪、上限多少**（Q1），不是要不要换宿主。
- **GitHub Pages 上传冻结**：见 `SHOWCASE-DEPLOY-PROTOCOL.md` §0。本周任何形态的流水线都不得向 Pages 推送。

### 4.1 冲突自查清单（答完 §4.2–§4.6 后逐条过）

发布契约最容易出的错，是两条答案各自合理、合起来打架。至少检查这九对：

- [x] 「测试全部在 controller 侧跑」与「服务器侧另装一次依赖」——**controller 与目标机的 Node / npm 版本不同时，测试绿证明不了服务器能起**（Q5 × Q6，事实见 §2.3 第 6 条）。→ 已解决：两侧 `npm ci` 集合不同是设计；「测试通过 ≠ 服务器 npm ci 成功」由部署阶段回滚兜底。
- [x] 「服务器侧 `npm ci`」与「部署要有原子性」——**装到一半失败时目录里是新代码 + 半套依赖**，此时旧版本已经没了（Q6 × Q13，机制见 §2.5.6）。→ 已解决：Q13 失败即回滚（`git reset` 恢复旧代码 + 按 lockfile 重装依赖），回滚失败则人工介入。
- [x] 「回滚 = 切回上一个 commit」与「上一个 commit 的依赖与当前不同」——**只回滚代码不回滚依赖等于没回滚**（Q12 × Q6）。→ 已解决：回滚动作含 `npm ci`，代码与依赖同版本。
- [x] 「部署身份只允许免密 `systemctl restart nodeapp`」与「它还要能改部署目录里的文件」——**写文件的权限落在谁身上**，两者是不是同一个身份（Q8 × Q9）。→ 已解决：同一 ubuntu 身份，`sudo -u nodeapp` 走文件通道、`sudo systemctl` 走服务通道，sudoers 白名单分离。
- [x] 「部署期间让 check-app 静默」与「W10 的检查要可信」——**静默窗口过宽会把真故障一起盖掉**（Q14 × W10 D1 契约）。→ 已解决：DEPLOY 标记为边界 + 5 分钟超时 + 与 Jenkins 记录交叉验证；伪造标记因 commit 不匹配而不抑制。
- [x] 「部署后验证包含公网 curl」与「常驻检查此前否决公网探针」——**两个口径必须写清各自的适用范围**，否则是自相矛盾（Q15 × runbook §3 盲区②，边界见 §2.5.9）。→ 已解决：常驻检查不探公网（scope 本地进程）；部署后验证一次性公网 curl（scope 对外语义），两者并存。
- [x] 「轮询触发」与「每次构建都留一份工作区」——**轮询间隔 × 构建产生的磁盘增量**要对得上 check-disk 的 4 GB 红线（Q2 × Q18 × W10 判据）。→ 已解决：增量在开发机工作区（deleteDir 清理）；4GB 红线是服务器判据，服务器侧每 commit 增量 KB~MB 级，可忽略。
- [x] 「Actions 与 Jenkins 并存」与「两条流水线都能写服务器」——**只能有一条路径写服务器**，另一条必须止步于测试（Q3 × Q7）。→ 已解决：只有 Jenkins 持部署私钥，Actions 只读不碰服务器。
- [x] 「Java stretch 要挂一个 Nginx location」与「本周流水线不改 Nginx」——**stretch 会打破本周自己定的边界**，要么 stretch 手工做、要么边界改写（Q18 × Q7）。→ 已解决：stretch 本周不启动；启动时 Nginx 改动走人工变更单，流水线不碰。

### 4.2 触发与 controller（Q1–Q3）

**Q1（controller 的宿主与内存上限）**：controller 装在哪台机器、用什么方式装？给它的常驻内存上限是多少？

必答追问：① 沿用 W9 对 JVM「先量再装」的纪律，这个数要能对上块 C 采到的开发机 `free` / 磁盘余量；
② 构建工作区保留几份、什么时候清理——这是磁盘增量的来源（冲突自查第 7 条）。

> 答（本人，2026-08-24）：
> **宿主**：开发机（macOS）。
> **理由**：controller 与部署目标不同机（§4.0 已定）；开发机磁盘余量 284 GiB；服务器 available 1169 MB，不再承担 Jenkins 进程；开发机 → 服务器是出站 SSH 方向，不需要公网入站。
> **安装方式（D2 落地）**：① `brew install jenkins-lts`（自动带 openjdk@21）；② `brew services start jenkins-lts`（默认 localhost:8080）；③ 首次访问按 initialAdminPassword 解锁，安装 Git / Pipeline 插件（最小集，P1 决策）。
> **【事实修正，2026-08-24 D2 起草时】原 ① `brew install openjdk@17` 已删除**：formula 实际 `depends_on "openjdk@21"`，service 启动硬编码走 openjdk@21 的二进制路径（`Formula/j/jenkins-lts.rb` 源码 + formulae API 双重确认）；`brew install jenkins-lts` 自动带 21，单独装 17 不会被使用。设计意图（由 brew 自动管理 JDK 依赖）不变，不重开决策。JVM 参数落点另见 D2 落地单 P2。
> **内存上限**：JVM 堆上限 `-Xmx512m -Xms256m` 作为合约值。进程 RSS 预估在堆基础上浮 ≤40%（约 ≤720M）；止步线：D2 装完后 `ps aux | grep jenkins` 实测 RSS，超过 720M 下调 `-Xmx` 至 384m，超过 800M 告警。**D2 第一步先 `sysctl hw.memsize` 补测开发机物理内存总量**（块 C 开发机侧未采此项，补测后记入 §5.6 开发机侧）。
> **工作区**：Jenkins 工作区单份路径（`${JENKINS_HOME}/workspace/<job>`），每次构建前 `deleteDir()` 清空，确保构建环境干净。「两份版本目录」是服务器侧旁路切换（Q13）的概念，不属于 Jenkins 工作区。磁盘基线：工作区不累积，`node_modules` 21M 为单次构建峰值。

**Q2（「推送后自动构建」在没有入站入口时怎么成立）**：选轮询、手工触发、隧道、换宿主中的哪一档？

必答追问：① 每一档的代价分别是什么（轮询的延迟与出站频率、隧道新增的公网入口、手工触发丢掉的「自动」）；
② **交付成果①的验收句因此写成什么**——这句话今天定死，D5 收口时按它验收，不允许到时候再改。
（事实前提见 §2.5.3：这不是配置问题。）

> 答（本人，2026-08-24）：
> **档位**：持续部署 + 轮询触发，接受最长 5 分钟轮询延迟。
> **为什么不是其他档**：webhook 被 NAT 硬挡住（网络位置，非配置问题）；隧道等于新开公网入口，扩大 W9 信任边界；手工触发丢掉了「自动」，不满足交付成果①字面要求。
> **代价**：① push 到 Jenkins 感知的最长延迟 = 5 分钟；② 出站轮询产生持续 API 请求；③ 轮询遇 GitHub 5xx 时下一轮重试，感知延迟可能翻倍，但部署结果一致。
> **速率限制**：当前仓库公开，轮询无速率限制约束；若未来转私有，轮询需 GitHub token、clone 需凭据，将影响 Q8/Q9 凭据模型——记入 §5.6「未来变更影响」。
> **交付成果①验收句（定稿，D5 按此验收）**：
> 开发机上的 Jenkins 每 5 分钟轮询代码仓库的 **main 分支**，检测到新提交时自动拉取并执行：① `npm ci`（严格按 lockfile 安装）；② `npm test`（单元 + 集成）；③ 测试通过后部署到 `/home/nodeapp/nodejs-skillup/`；④ 部署完成后执行一次性部署后验证（Q15）。验证通过即视为本次交付完成，轮询延迟不超过 5 分钟为可接受范围；**若 Jenkins 测试失败，部署不触发，流水线标记为失败，需人工介入。**
> （GitHub Actions 也跑测试套件并通过，但仅作为开发期快速反馈，其结果不参与部署判定。）

**Q3（与已有 GitHub Actions 的关系）**：并存还是替代？两条流水线跑同一份测试时，哪一个的结果算数？

必答追问：① 如果并存，**哪一条有权写服务器**（冲突自查第 8 条）；
② 两边装依赖的方式必须一致吗——`incidents/2026-07-17-ci-lockfile-drift.md` 的根因正是「同一个仓库里两套装依赖的方式只统一了一半」。

> 答（本人，2026-08-24）：
> **关系**：并存，各司其职。
> - GitHub Actions：PR / push 快速反馈，跑测试与 lint，**不接触服务器**，是开发期第一道门。
> - Jenkins：部署专用流水线，轮询 main 分支触发，部署前**自己再跑一次 `npm test`**（防止环境差异漏掉 bug），测试失败即停止部署。
> **部署门槛**：以 Jenkins 自身测试结果为准；Actions 结果不参与部署判定（B1 已拍板）。两条路径并发、无等待关系，不引入跨系统等待。
> **分支限定**：Jenkins 只轮询 main 分支，不处理 feature 分支的 push。
> **谁有权写服务器**：只有 Jenkins（controller）持有写服务器的 SSH 私钥；GitHub Actions 只有仓库读权限，不持有任何部署凭据（冲突自查第 8 条成立）。
> **依赖安装统一**：统一为 `npm ci`。已核 `ci.yml` 在有 lockfile 时走 `npm ci`，部署单元 `week2-express/src` 有 lockfile——Actions 侧已实现，无需修改；本周只需确保 Jenkins 侧也写 `npm ci`（避免 `npm install` 改 lockfile 导致的两套依赖漂移）。

### 4.3 流水线的内容（Q4–Q7）

**Q4（阶段划分与失败判据）**：流水线分哪几个阶段？每个阶段的入口命令是什么、**什么条件算这一阶段失败**？

必答追问：对每个阶段回答一句「它失败时，服务器处于什么状态」——
这一列决定了哪些阶段的失败是零影响的，哪些需要回滚。

> 答（本人，2026-08-24；B1/B3 修复后定稿）：
> **阶段数：5 个（Checkout → Install → Test → Deploy → Verify），任一阶段失败，后续阶段不执行（Deploy 阶段内部的回滚脚本除外）。**
>
> | 阶段 | 在哪一侧 | 入口命令 | 失败条件 | 失败时服务器状态 |
> |---|---|---|---|---|
> | 1. Checkout | controller | `git fetch` + `git reset --hard <commit>`（main） | git 非零（网络 / 分支 / 凭据） | 未发生任何变更，服务器保持上一版 |
> | 2. Install | controller | `npm ci`（**全量，含 dev**） | `npm ci` 非零 | 服务器未动；工作区留半套 node_modules，`finally { deleteDir() }` 兜底 |
> | 3. Test | controller | `npm test`（单元 + 两份集成，MMS 拉 mongod） | 任一用例失败 / 测试环境异常 | 服务器未动；人工介入修代码，无需回滚 |
> | 4. Deploy | 服务器 | `ssh -i ${DEPLOY_CRED_KEY} ubuntu@<server> "deploy-wrapper <commit-sha>"`（wrapper 内部以 `sudo -u nodeapp` 执行 git/npm，`sudo systemctl restart nodeapp`；形态由 Q8/Q9 定稿） | SSH 失败 / wrapper 内任一步非零（git fetch / git reset / npm ci / restart） | **关键风险点**：代码已更新但依赖没装完或进程没起来 → 立即同阶段原子回滚到 `.rollback_target` |
> | 5. Verify | controller 发起（验证目标：本地 3000 / 服务器 mongosh / 公网 443） | Q15 定稿的部署后验证清单（本地 `/health` + 业务接口 + mongosh ping + 公网 443 curl + `ss` 监听 + check-app/check-disk） | 验证命令非零 | 部署已实际发生（进程已重启）；**不自动回滚**，标记失败并提示人工判断（与 Q12 语义绑定，若 Q12 改自动回滚此处同步改） |
>
> **B1 关键点**：controller 侧 Install 用全量 `npm ci`（jest/supertest/MMS 在 devDependencies，Test 需要）；服务器侧 Deploy 用 `npm ci --omit=dev`（只跑应用）。两侧依赖集合不同是正确设计。
> **B3 关键点**：SSH 身份 = ubuntu（唯一 authorized_keys 入口），git/文件操作用 `sudo -u nodeapp`（仓库属主是 nodeapp，ubuntu 直接 git 会撞 `dubious ownership` + `FETCH_HEAD: Permission denied`），`systemctl restart` 用 `sudo`（ubuntu NOPASSWD）。身份最终由 Q8 定稿，若选自动化新身份则替换 `ubuntu`。
> **F2**：git 操作严格 `fetch + reset --hard`，**禁止 `git clean -fd`**（会删未跟踪的 `dist-admin443`）。

**Q5（测试跑在哪一侧、跑哪些）**：跑哪几个目录的测试？`mongodb-memory-server` 那两份放在哪里跑？

必答追问：① 理由要落在 available 1169 MB（2026-08-24 块 C 实测，原 W10 记录的 1388 MB 为过去值）/ swap = 0 这个事实上，不是习惯；
② 如果只跑一部分测试，**说清没跑的那部分由谁来兜**（Actions？还是本周接受这个缺口）。

> 答（本人，2026-08-24）：
> **测试全部跑在 controller（开发机）侧，绝不在部署目标服务器上跑 `npm test`。**
> **事实依据**：服务器 available 1169 MB / swap=0（块 C 实测）；两份集成测试用 `mongodb-memory-server` 会拉起真实 mongod 子进程（额外约 200–400 MB）；生产 nodeapp 自身占用一部分。若测试在服务器上跑，峰值 = 生产进程 + mongod + 测试进程，必然超 1169 MB，触发 OOM Killer。
> **决策**：Jenkins 工作区在开发机，controller 本地跑 `npm test`（开发机内存 D2 补测）；部署目标服务器只负责运行应用，不承担构建与测试。Jenkins `agent { label 'controller' }` 显式指定前 3 阶段在 controller；Deploy 阶段 SSH 远程执行部署命令（不在目标机跑测试）。
> **跑哪些**：`week2-express/src` 的三份测试全跑（`__tests__/monthly-sales`、`__tests__/auth-flow`、`utils/__tests__/validators`）。无缺口，无需 Actions 兜底。
> **F4**：MMS 首次运行会下载 mongod 二进制（约 100MB），磁盘/网络成本在开发机，D2 确认下载路径并记入 §5.6。

**Q6（产物形态）**：服务器侧 checkout 源码后装依赖，还是在 controller 侧打好产物送过去？

必答追问：① 选后者时，`bcrypt` 的原生扩展怎么处理——构建机与目标机的操作系统和 Node ABI 是否匹配（§2.5.7、§2.3 第 6 条）；
② 选前者时，服务器需要联网到哪些地方、装依赖失败时目录里剩下什么（接 Q13）；
③ 这个答案同时决定**延伸项④到底有没有一个可归档的对象**。

> 答（本人，2026-08-24）：
> **结论：源码 + lockfile 形态，不在构建机打包 node_modules；服务器侧执行 `npm ci --omit=dev`。**
> **事实依据**：`bcrypt` 是原生依赖，预编译二进制与 OS + Node ABI 绑定——macOS（构建机）装出的 `.node` 是 Mach-O，Ubuntu（目标机）加载抛 `ERR_DLOPEN_FAILED`；node_modules 21M 是半编译产物，不能跨 OS；服务器已有整仓 clone，lockfile 在仓库。
> **部署步骤**（见 Q4 Deploy）：`git fetch` + `git reset --hard <commit>` + `npm ci --omit=dev`（服务器侧）。
> **代价**：服务器需访问 npm registry（公开仓库无需内网镜像）；bcrypt 依赖预编译二进制或编译工具链——**F1：该路径待验证**（bcrypt@6.0.0 走 node-pre-gyp，通常无需工具链；若预编译不可用则回退编译，D3 首次部署观察日志确认真实路径并记入基线）。
> **制品归档（延伸项④）**：`git archive --format=zip HEAD` 作为源码备份可归档到 S3，但部署时以 git checkout 为准。**有可归档对象 = 源码 tar/zip**。

**Q7（部署单元与不动清单）**：部署单元包含什么？本周流水线**明确不动**什么？

必答追问：逐项判定四样东西——`.env`（§2.3 第 1 条：不在仓库、属主 nodeapp、600）、
Nginx 配置与 `reload`、8081 展板产物、`/etc/letsencrypt/`。
每一样写清「本周动不动、为什么」。（W9 的收口成果落在其中三样上，`week11-plan.md` §3.1 已给出倾向，但结论由你定。）

> 答（本人，2026-08-24；B2 修复后定稿）：
> **部署单元**：`week2-express/src` 的源码 + `package-lock.json`（不含 node_modules，不含 `.env`）。
>
> | 项 | 动 / 不动 | 理由 | 约束 |
> |---|---|---|---|
> | `.env`（nodeapp:nodeapp，600，不入库） | **绝对不动** | 环境变量属基础设施配置，与代码版本解耦；流水线不得修改/覆盖/删除 | 部署前 `test -f .../week2-express/src/.env` 作前置检查，失败则停止部署 |
> | Nginx 配置与 `reload` | **不动** | 反代与静态服务属基础设施变更，不由应用部署流水线触发；重启 nodeapp（3000 端口）不影响 Nginx | 流水线不做 `nginx -t` / `reload` |
> | `dist-admin443`（**443 `/admin/` 面静态产物**，nodeapp:nodeapp，755） | **不动** | W9 落地的前端静态产物（`base=/admin/`，Nginx alias 挂载）；本周流水线只处理后端 | **禁止 `git clean -fd`**（未跟踪文件会被删，导致 admin 面 404）；8081 展板产物是 `dist-showcase`，同样不动 |
> | `/etc/letsencrypt/` | **绝对不动** | 证书由 certbot 独立管理，流水线无权操作 `/etc/` | 流水线不得读/写/操作该目录 |
> | systemd 单元（`/etc/systemd/system/nodeapp.service`） | **本周不动** | 当前 `WorkingDirectory` 指向固定目录，与 Q13 部署形态强绑定；本周初版用**原地更新**（直接在该目录 reset + npm ci + restart），不需改单元 | **决策绑定**：若 Q13 改旁路切换（symlink 指新目录），单元文件从不动清单移出，需 `systemctl daemon-reload` |

### 4.4 凭据与信任边界（Q8–Q10）

**Q8（部署身份与认证）**：用哪个用户登录服务器、怎么认证、私钥落在哪、谁持有？

必答追问：① 这个身份与部署目录的属主（`nodeapp`）是同一个吗，不是的话谁来写文件；
② **私钥泄露时的止损动作是什么**——按什么顺序做，做完怎么证明这把钥匙已经无效。
（机制见 §2.5.5；现状见块 C 的 `id nodeapp` 与 `ssh-keygen -lf`。）

> 答（本人，2026-08-24）：
> **身份：复用现有 `ubuntu` 用户作为自动化身份，不为部署新建专用用户。**
> **理由**：SSH 唯一入口是 ubuntu（唯一 authorized_keys）；nodeapp 是 nologin 无法 SSH；新建用户需额外配置公钥 / sudo / 目录属主穿透，当前规模收益有限。
> **认证方式**：SSH 公钥。在开发机生成本部署专用密钥对（`id_rsa_deploy`），**与个人密钥物理隔离**；私钥存入 Jenkins controller 的 Credentials Store（类型 `SSH Username with private key`），明文私钥不落盘在构建工作区。
> **公钥安装**：追加到服务器 `~ubuntu/.ssh/authorized_keys` 单独一行，并加 `command=` 前缀限制（见 Q9）。
> **身份与目录属主**：不是同一个——登录是 ubuntu，部署目录属主 nodeapp:nodeapp。写文件通过 `sudo -u nodeapp`（权限速查表 §0 黄金规则）。
> **泄露止损**：① 从 authorized_keys 删除对应公钥行；② 吊销 Jenkins 凭据 ID；③ 重新生成新密钥对并安装公钥。验证：删除后 `ssh-keygen -lf authorized_keys` 确认该行消失，且用旧私钥 `ssh` 被拒（Permission denied）。

**Q9（可执行命令清单）**：这个身份**可以执行的命令**是哪几条？用什么机制限制（`authorized_keys` 的 `command=`、`sudoers` 白名单，或两者叠加）？

必答追问：① 怎么验证**清单之外的命令确实被拒**——这条验证要能在 D3 当场跑出输出，不能只写在纸面上；
② 从块 C 的 `sudo -l` 输出出发说明：现在是什么形态，改完是什么形态。

> 答（本人，2026-08-24；B1/F1/F2/F3 修复后定稿）：
> **机制：`authorized_keys command=` + `sudoers` 白名单叠加，双重收窄。**
>
> **第 1 层 · `command=`**：为部署公钥添加 `command="/usr/local/bin/deploy-wrapper"`。deploy-wrapper **不读位置参数**，从环境变量 `SSH_ORIGINAL_COMMAND` 读取客户端命令，正则白名单校验后执行：
> - `^deploy [0-9a-f]{40}$` → `cd .../week2-express/src && sudo -u nodeapp git fetch origin main && sudo -u nodeapp git reset --hard <sha> && sudo -u nodeapp npm ci --omit=dev && sudo systemctl restart nodeapp`；部署前先写 `.rollback_target` = 当前运行 commit；
> - `rollback` → 从 `.previous_commit` 读上一版，执行同样动作（`git reset --hard <sha>` + `npm ci --omit=dev` + restart；不接受外部 SHA，防误回滚到未验证版本）；
> - `^mark-verified [0-9a-f]{40}$` → 仅将传入 sha 写入 `.previous_commit`，不部署不重启（由 Verify 阶段全部通过后调用，B1 修复补上的回滚基线写入通道）；
> - 其余 → `ERROR: Invalid command` 并退出非零。正则白名单拦掉 `-` 开头选项注入。
> - **F2**：wrapper 属主 `root:root` 755——若属主为 ubuntu 可写，改脚本等于自定义提权命令。
>
> **第 2 层 · `sudoers` 白名单**：替换 ubuntu 的 `(ALL:ALL) ALL` 为精确白名单：
> ```text
> ubuntu ALL=(nodeapp) NOPASSWD: /usr/bin/git, /usr/bin/npm
> ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart nodeapp, /usr/bin/systemctl status nodeapp
> ```
> **F1 代价（显式）**：收窄后任何 SSH（含个人密钥）登录 ubuntu 都只能执行白名单内提权命令；手工运维（journalctl / nginx -t / tail）需先加入白名单。D3 改动前先 `sudo -l` 盘点全部来源（/etc/sudoers 与 /etc/sudoers.d/*），逐文件替换；`/usr/bin/npm` 路径需 D3 `which npm` 实测。
>
> **越权验证（两层分别测）**：
> - sudoers 层（个人密钥通道）：`ssh ubuntu@<server> "sudo systemctl start nginx"` → 非零 + `sudo: command not allowed`；
> - command= 层（部署密钥通道）：`ssh -i deploy-key ubuntu@<server> "echo hi"` → 不输出 hi，触发 wrapper 的 `ERROR: Invalid command`。
> - 部署前 `sudo -l -U ubuntu` 输出与预期白名单逐条比对，出现 `(ALL:ALL) ALL` 即阻断。

**Q10（凭据在构建日志里的可见性）**：凭据怎么注入流水线？怎么验证它在构建日志里确实不可见？

必答追问：① 按 §2.5.4，mask 在什么情况下会失效，你的用法有没有踩到；
② 验证动作写成一条可执行的检查（例如构建后在日志里搜什么关键字，搜到即判失败）。

> 答（本人，2026-08-24；F4/F5 修复后定稿）：
> **注入**：私钥存入 Jenkins Credentials（类型 `SSH Username with private key`），Jenkinsfile 的 `environment` 块绑定 `credentials('jenkins-deploy-key')`。绑定后只生成两个变量：`DEPLOY_CRED_USER`（用户名 ubuntu）与 `DEPLOY_CRED_KEY`（私钥文件路径）；**没有 PASS 字段**（该类型无口令）。私钥经 `-i ${DEPLOY_CRED_KEY}` 引用，内容不进命令行。
> **泄漏面**：脚本中 `cat $KEY` / `scp -i` 调试输出 / wrapper 内 echo 变量内容——这些是 validate-logs 要搜的目标。
> **日志不可见验证（可执行检查）**：pipeline 中加 `validate-logs` stage（部署后执行），取当前构建日志全文，`grep -E` 搜敏感模式：`BEGIN RSA PRIVATE KEY` / `BEGIN OPENSSH PRIVATE KEY` / 部署公钥指纹 / 私钥中连续 20+ 字符 base64 片段。**搜到任一即 stage 失败**，流水线标记失败。
> **API 细节（F5）**：日志来源不用 `cat ${BUILD_LOG}`（路径不保证存在）；用 `currentBuild.rawBuild.getLog()`（Groovy，需脚本安全批准）或 `${JENKINS_HOME}/jobs/${JOB_NAME}/builds/${BUILD_NUMBER}/log`。实现细节 D2/D3 定。
> **mask 边界（§2.5.4）**：Jenkins mask 只认原样字符串，变形输出（base64 / 拼接 / 写文件再 cat）不再被替换。我的用法：私钥只以 `-i $KEY` 文件路径出现，不拼进命令字符串；validate-logs 是对「任何变形也不该出现」的第二道防线，与 W10 应用日志脱敏（事前）互补。

### 4.5 环境分离与回滚（Q11–Q14）

**Q11（「环境分离」本周的定义）**：本周把它定义成什么？止步在哪？

必答追问：① 这与 W10 的「集中收集」是同一种问题——**词面来自多环境场景，而这里只有一台机**。
先写清「在只有一台机、一个 MongoDB、一个 systemd 单元的前提下，这个词还剩下什么内容」；
② 如果结论是「只做凭据与配置分离」，说清 `.env` 的管理方式本周改不改（接 Q7）。

> 答（本人，2026-08-24）：
> **本周定义：在「单机 + 单 MongoDB + 单 systemd 单元」约束下，环境分离 = 应用配置与代码的分离。**
> - `.env` 为唯一配置载体：不入库、不随代码版本移动，固定在服务器路径 `/home/nodeapp/nodejs-skillup/week2-express/src/.env`。
> - 流水线不修改/不覆盖/不删除 `.env`，只做部署前存在性检查。
> - 本周不改动 `.env` 管理方式（不引入多环境切换机制），仅增加部署前置检查。
> **止步点**：部署前 `test -f .../.env` 非零 → 整个流水线中止，输出「`.env` 缺失，部署中止」，写入 Jenkinsfile 的 pre-deploy 阶段作硬门禁。
> **与 Q7 衔接**：Q7 已定 `.env` 绝对不动，Q11 在此基础上前进一步——定义为本周唯一被承认的环境配置载体，并给出可执行检查动作。

**Q12（回滚目标与决定权）**：回滚回到哪个版本？由谁判定要回滚，自动还是人确认？回滚完成用什么证明？

必答追问：① **「上一个 commit」与「上一个部署后验证通过的 commit」不一定是同一个**——你取哪一个，怎么记住它；
② 回滚是「重新跑一次旧版本的完整部署」还是「切一个指针」（取决于 Q6 / Q13 的形态，见 §2.5.6）；
③ 证明回到基线用哪几条命令，与块 C 采到的基线怎么对照。

> 答（本人，2026-08-24；B1/F1 修复后定稿）：
> **回滚目标：上一个部署后验证通过的 commit，而非上一个 commit 或上一个部署尝试。**
> **依据**：回滚必须回到已知可用状态；线上 `6a1b1a1` 未经部署后验证，不能作为「验证通过」意义上的基线。
> **决定权**：
> - 部署后验证失败：**不回滚**，标记失败，人工判定（与 Q4 Verify 一致）；
> - 部署过程中失败（npm ci / restart）：**自动回滚**到 `.rollback_target`（部署开始时的当前版本），完成后流水线仍标记失败，但服务器已恢复可用；
> - Q9 wrapper `rollback` 命令：只读 `.previous_commit`（最近一次验证通过的版本），不接受外部传入的 SHA——防止人工误回滚到未验证版本。
> **B1 首次基线（选 A）**：`.previous_commit` 初始写入 `6a1b1a1`（块 C 确认的线上 HEAD）。信任边界显式标注：该 commit 未经过部署后验证（W10 收口态无此步骤），但它是当前唯一已知可用态——线上进程运行中，且 W10 复核通过五面 curl + 四项检查。**仅作首次部署的应急回滚点**，首次部署 Verify 通过后即建立新验证基线。
> **F1 两文件职责**：
> | 文件 | 写入时机 | 读取者 | 用途 |
> |---|---|---|---|
> | `.rollback_target` | 每次部署开始时（git reset 前）写当前运行 commit | Q13 部署失败自动回滚 | 本轮中途失败的即时恢复点 |
> | `.previous_commit` | 仅 Verify 通过后写本次 commit | Q9 `rollback` 命令、Q12 决定权 | 最近一次验证通过的长期基线 |
> 正常流程下两者相等，但语义不同，实现时严格区分。
> **回滚证明**：`git rev-parse HEAD` 回到基线 SHA + `systemctl is-active nodeapp` + `/health` 200，与块 C 的 `6a1b1a1` 基线对照。分档（与 §5.4 一致）：自动回滚（部署中失败）后做 `/health` 快速检查；人工回滚（验证失败后 `deploy-wrapper rollback`）后跑完整部署后验证清单（Q15）。

**Q13（部署的原子性）**：依赖装到一半失败时，服务处于什么状态？怎么做到「要么新版本、要么旧版本」，不停在中间态？

必答追问：① 如果接受原地更新（有中间态），**部署后验证必须能识别中间态**——它靠哪一项识别；
② 如果选旁路切换，systemd 的 `WorkingDirectory` 要不要改，磁盘上留几份，谁来清理（对上 check-disk 的 4 GB）。

> 答（本人，2026-08-24；F1/F3 修复后定稿）：
> **形态：原地更新 + 逻辑原子性（失败即回滚）。** systemd 单元不动，`WorkingDirectory` 指向固定目录。
> **「原子性」定义**：**逻辑原子性**，不是物理原子切换（旁路 symlink 才叫原子切换）。即：最终状态要么新版本完全生效（代码+依赖+进程），要么回滚到上一版本；不停在「新旧混合」的中间态。实现方式是**失败后立即回滚**，而不是瞬间切换。
> **中间态风险与兜底**：
> - `git reset` 后 `npm ci` 失败 → 目录里是新代码 + 不完整 node_modules → 立即回滚：`git reset --hard $(cat .rollback_target)` + `npm ci --omit=dev` + restart（依赖已部分覆盖，需重装上一版）；
> - `npm ci` 成功后 `systemctl restart` 失败 → 立即重试一次 restart；仍失败则回滚到 `.rollback_target`；
> - **回滚也失败** → 人工紧急介入（应用已不可用）。
> **保证方式**：上述失败兜底步骤（重试 restart、回滚到 `.rollback_target`）在**同一个 SSH 会话**内顺序执行，不使用异步/后台进程，任何失败点都能被捕获并触发回滚。
> **部署后验证识别中间态**（追问①）：靠的是 `systemctl is-active nodeapp` + `ss -tlnp` 有 3000 监听 + `/health` 200——三者都真才算新版本完全生效；只 `is-active` 不查监听会漏掉「进程活着但没绑定」（类 2），所以验证必须同时看监听。

**Q14（部署窗口与检查静默）**：部署期间 check-app 可能报红，怎么区分部署造成的红与真故障？

必答追问：① 标记形态是什么、谁来打——W10 已有现成形态（`logger -t DRILL` + `journalctl -t DRILL` 一次性过滤），本周的对应物是什么；
② **静默窗口的宽度**：过窄会误报，过宽会盖掉真故障（冲突自查第 5 条），你取多少、依据是什么；
③ `systemctl restart nodeapp` 的实际不可用时长是多少——这个数今天没有，是 D3 要量的，先写下你的预测（`LEARNING-PROTOCOL.md` §4 的先答后对）。

> 答（本人，2026-08-24；B2/F2 修复后定稿）：
> **标记形态**：部署标记用**独立标签 `-t DEPLOY`**（与 W10 演练的 DRILL 正交，避免污染 runbook §5 的演练判定）：
> - 部署开始：`logger -t DEPLOY "deploy-start <commit> <build_number>"`
> - 部署成功：`logger -t DEPLOY "deploy-end <commit> success"`
> - 部署失败/回滚：`logger -t DEPLOY "deploy-end <commit> failure"` / `rollback-end <commit> success`
> **标记可信度（B2 修复）**：标记本身不设权限控制——`logger` 任何登录用户都能写，`/dev/log` 对普通用户可写，**「只有 wrapper 能打」不成立**。告警抑制的信任依据改为**交叉验证**：系统日志 `DEPLOY deploy-start <commit>` 与 Jenkins 当次构建记录（BUILD_NUMBER + commit SHA）匹配，且未超时，才抑制探针告警；不匹配或超时则不抑制。
> **静默窗口**：不以固定宽度为界，**以标记为边界**——从 `deploy-start` 到 `deploy-end` 之间探针红被抑制；超过 **5 分钟**未见 `deploy-end` 即解除抑制并告警（5 分钟 = npm ci + 重启 + 验证的合理上限，超出视为挂起）。这个数 D3 用实测不可用时长校准。
> **探针本身不改造**：check-app 保持原频率与逻辑，失败记录仍然存在，只是告警被有条件地暂时静音。

### 4.6 W10 移交与本周范围（Q15–Q18）

**Q15（盲区②怎么补）**：W10 盲区②是 check-app 只探本地进程、不探对外反代语义（443 根路径 502 时四项检查全绿）。本周在部署后验证里怎么补？

必答追问：① 部署后验证可以用公网 curl（一次性、有人在场），而常驻检查此前已否决公网探针——
**把两个口径的适用范围各写一句**，让它们不互相矛盾（边界见 §2.5.9）；
② 部署后验证具体选哪几项：五面 curl 全跑还是选几个面、四项检查手工触发哪几项、`/health` 算不算数；
③ **`/health` 只回 `{status:'ok'}` 不读数据库**（§2.3 第 4 条），所以它证明不了什么？这一句要写出来。

> 答（本人，2026-08-24；B1/B2/F1 修复后定稿）：
> **① 两个口径各写一句（不矛盾）**：
> - 常驻健康检查（`/health`）：常驻、频繁、便宜、不读数据库，只反映 HTTP 层进程存活，**是「机器看活」，不证明应用功能正常**；因此它不上公网探针（避免依赖外部路径）。
> - 部署后验证：一次性、在已知变更后执行、可昂贵、可覆盖更多层，**是「人确认能用」**，用于确认新版本可提供服务；它只在部署窗口发生，不替代常驻检查。
> **② 部署后验证选哪几项**：
> - `/health`（本地 `127.0.0.1:3000/health`，200）——第一道冒烟；
> - 业务接口（本地 `127.0.0.1:3000/`，200）；
> - 数据库连通：**mongosh 直连** `mongosh --eval "db.runCommand({ping:1})"` → `{ok:1}`（**零代码改动**，服务器侧探测；备选为带认证的业务接口，403 也算连接池可用）；
> - 反代连通性（**公网 curl** `curl -f https://43-128-154-242.sslip.io/`，200）——补盲区②的唯一方式；
> - 端口监听确认 `ss -lntp | grep :3000`（兜底类 2）；
> - 手工触发 `check-app`（必）与 `check-disk`（必，部署写磁盘）；`check-mem`、`check-cert` 不触发（与本次部署无关）。
> **③ `/health` 证明不了什么**：它证明进程在监听 3000 且路由正常；**不能证明 MongoDB 可连接、业务接口正常**——类 3 资源型故障就是例证（DB 宕 `/health` 仍 200），所以 `/health` 只能作第一道冒烟，不能作唯一依据。

**Q16（类 2「假 active」最小样本）**：最小样本在哪一侧跑、包含什么？复现成功与复现失败各自的下一步是什么？

必答追问：① 样本要能分开两件事——**listen 的成功回调被触发** 与 **底层 socket 实际绑定**（D4 观察到二者不一致，机制未验证）；
② 复现失败（即在最小样本上无法重现）时，下一步是扩大样本还是改变归因，写清判据；
③ `server.js` 的实际修复属黑名单由本人实现，**今天只定复现方案，不定改动**。

> 答（本人，2026-08-24；F2 修复后定稿）：
> **复现目标**：设计最小样本分离「listen 成功回调触发」与「底层 socket 实际绑定」两件事（D4 观察到二者不一致，机制未验证）。
> **最小样本**：纯 `http.createServer` + `server.listen(3000,'127.0.0.1',cb)`，不含 express；在启动后极短时序内触发 `server.close()`（模拟异步竞争），观察：① 回调是否触发；② `ss -lntp` 是否见 3000；③ 进程是否存活。两种场景（最小样本 + 完整 server.js）在开发机与服务器各跑 100 次脚本化循环，统计回调触发与端口绑定的匹配度。
> **复现成功的下一步（F2）**：① 确定触发条件（close 竞争 / 事件循环延迟 / Node 版本边界）；② 对照 W10 D4 实际环境（systemd RestartSec=10s、Restart=on-failure、端口复用）看触发条件是否天然存在；③ 若匹配则据此定 `server.js` 修复方向（黑名单，本人实现）；不匹配则记「偶发不可稳定复现」，用部署后验证的 `ss` 兜底检查作长期防御。
> **复现失败的下一步**：扩大样本至完整 server.js + 模拟负载（快速重启、并发请求）；仍无法重现则接受「D4 现象为偶发且未在测试环境重现」，本周不改 server.js，将类 2 列为已知风险，部署后验证保留 `ss -lntp | grep :3000` 兜底。
> **重要约束**：今天只定复现方案，不定 `server.js` 改动（D1 §7）。

**Q17（8080 明文过渡期）**：本周做不做下线？

必答追问：它会改变五面基线，进而改变部署后验证的判据（Q15）。所以只有两个合法答案：
**本周做完并同步更新判据**，或**明确不做并写清为什么**。「先放着」不是答案——W10 已经把它记为「未排期」一次了。

> 答（本人，2026-08-24；B3 修复后定稿）：
> **决策：本周做完，同步更新五面基线判据。**
> **边界声明（首句）**：Q7 的「Nginx 配置与 reload 不动」约束的是**流水线**（Jenkins 部署过程不碰 Nginx）；Q17 的 8080 下线是**人执行、走变更单四要素**的独立基础设施变更，在部署窗口外手工完成。两者不冲突。
> **执行顺序（B3 修正）**：① 只读确认 `ss -lntp | grep 8080`（记录监听进程）；② 查活跃连接 `ss -tn state established '( sport = :8080 )'`，有则先确认来源可停；③ 编辑 Nginx 配置注释/删除 8080 server 块；④ `sudo nginx -t`；⑤ `sudo systemctl reload nginx`（**不是 restart**，不中断 80/443）；⑥ `ss -lntp | grep 8080` 复核端口关闭；⑦ 同步更新五面基线 → 四面（部署后验证清单移除 8080 项，runbook §4.1 更新）。
> **若发现 8080 上有非 Nginx 进程**：先确认用途再决定，本周目标仍是下线。

**Q18（三个 stretch 的前置条件与止步线）**：Java、S3、Docker 各自的前置是什么、上限在哪？

必答追问：① **Java**：JVM 常驻内存上限定为多少，超了怎么办（沿用 W9 对 jar 的纪律，先量再装）；它要挂的 Nginx location 与 Q7 的不动清单怎么协调（冲突自查第 9 条）。
② **S3**：controller 不在 AWS 计算资源上，**IAM role 这个凭据模型对它不适用**，那用什么；有没有可用账号；成本上限是多少；归档对象是什么（取决于 Q6）。
③ **Docker**：开发机上 Docker 是否可用（块 C 已采集）；它是用来统一构建环境的，那它和 Q5 的测试形态是什么关系。

> 答（本人，2026-08-24；F3/F4 修复后定稿）：
> **① Java——拆分两个概念**：
> - **D2 硬前置（非 stretch）**：`brew install jenkins-lts` 自动带 OpenJDK 21（formula `depends_on "openjdk@21"`，2026-08-24 事实修正，原「装 OpenJDK 17」删除）用于运行 Jenkins controller。属于开发环境准备，必须在 D2 完成。先量再装：D2 先 `sysctl hw.memsize` 补测物理内存（实测 32 GiB，已回填 §5.6），JVM 参数通过 `~/.homebrew/services/jenkins-lts.env` 写 `JAVA_TOOL_OPTIONS="-Xmx512m -Xms256m"`（Q1 已定；注意 JVM 读的是 `JAVA_TOOL_OPTIONS`，brew service 启动命令不读 `JAVA_OPTS`）。
> - **W9 移交 stretch（最小 jar + Maven job）**：**本周不启动**，置于延后队列，D5 看剩余带宽。前置：JVM 上限（沿用 W9 对 jar 纪律，先量再装）；Nginx location（如 `/java/`）与 Q7 协调方式 = **Nginx 改动由人工变更单执行，流水线不碰**。
> **② S3**：controller 在开发机，**IAM role 不适用**；用静态 Access Key + Secret Key（最小权限仅 `s3:PutObject` 到指定 bucket）需可用账号。**本周不做**：Q6 已定制品 = 源码包，部署走 git checkout，S3 非必需；以 `${JENKINS_HOME}/archives/` 本地归档替代。**账号与预算顺延至启用时再评估**（F4）。
> **③ Docker**：开发机有 client，`colima` daemon 未跑（块 C 实测）。本周流水线无 Docker 场景（测试用 mongodb-memory-server 非容器；部署是 git/npm 直连）。**本周不做**，启用前置是 `colima start` + 资源分配评估。与 Q5 测试形态的关系：若未来容器化，Docker 与 MMS 测试形态需要重新对齐，本周无此问题。

---

## 5. 今日交付物

### 5.1 发布契约表（自 Q4 / Q6 / Q7 汇集）

| 阶段 | 在哪一侧执行 | 入口命令 | 什么算这一阶段失败 | 失败时服务器处于什么状态 | 失败后的动作 |
|---|---|---|---|---|---|
| 1 Checkout | controller（开发机） | `git fetch origin main` + `git reset --hard origin/main`（首次构建前先 clone；与 Q4 一致，不使用 `git clean -fd`） | git 非零（网络不可达、分支不存在、凭据无效） | **未发生任何变更**，服务器保持上一轮部署版本 | 流水线标记失败，人工介入（网络问题）或检查凭据 |
| 2 Install | controller（开发机） | `npm ci`（全量，含 devDependencies） | `npm ci` 非零（lockfile 与 package.json 不一致、网络不通、bcrypt 编译失败） | **未动** | 流水线标记失败，人工检查 lockfile 一致性；`finally { deleteDir() }` 清工作区 |
| 3 Test | controller（开发机） | `npm test`（单元 + 两份集成，MMS 在 controller 侧运行） | `npm test` 非零（用例失败、MMS 拉起失败） | **未动** | 流水线标记失败，打印失败报告，人工修复代码；无需回滚 |
| 4 Deploy | 服务器 | `ssh -i ${DEPLOY_CRED_KEY} ubuntu@<server> "deploy-wrapper <commit-sha>"` | SSH 失败 / wrapper 内部任一步非零（git fetch / git reset / npm ci / systemctl restart） | **已动，可能处于中间态**（代码已 reset、依赖可能装一半、进程可能未启动） | **自动回滚**到 `.rollback_target`（Q13），回滚完成后流水线标记失败，人工介入检查回滚是否成功 |
| 5 Verify | controller 发起，验证目标：本地 127.0.0.1:3000 / 服务器 mongosh / 公网 443 | Q15 清单（本地 `/health`、`mongosh` ping、公网 `curl` 443、`ss -lntp`、check-app、check-disk） | 任一验证项不通过（`/health` 非 200、mongosh ping 非 0、公网 curl 非 200、`ss` 看不到 3000、check-app 非 OK） | **已部署，进程已重启**（应用处于新版本状态） | **不自动回滚**，流水线标记失败，人工判定是否回滚（`ssh -i $KEY ubuntu@server "deploy-wrapper rollback"`） |

### 5.2 部署身份与权限清单（自 Q8 / Q9 / Q10 汇集）

| 项 | 内容 |
|---|---|
| 登录身份 | `ubuntu`（唯一 authorized_keys 入口） |
| 认证方式 | 专用 SSH 密钥对（`id_rsa_deploy`），与个人密钥物理隔离；公钥追加到 `~ubuntu/.ssh/authorized_keys` 单独一行，前缀 `command="/usr/local/bin/deploy-wrapper"` |
| 私钥落点 / 属主 / 权限 | Jenkins controller Credentials Store，类型 `SSH Username with private key`；绑定后生成 `DEPLOY_CRED_USER`（ubuntu）与 `DEPLOY_CRED_KEY`（私钥文件路径）；明文私钥不落盘构建工作区 |
| 可执行命令清单（`command=` 层） | `deploy <40-hex-sha>`、`rollback`、`mark-verified <40-hex-sha>`（wrapper 从 `SSH_ORIGINAL_COMMAND` 读取并正则白名单校验；`mark-verified` 仅写 `.previous_commit`，不部署不重启） |
| 可执行命令清单（`sudoers` 层） | `ubuntu ALL=(nodeapp) NOPASSWD: /usr/bin/git, /usr/bin/npm`；`ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart nodeapp, /usr/bin/systemctl status nodeapp` |
| 限制机制（`command=` / `sudoers` / 两者） | **两者叠加**：command= 限制钥匙能执行什么；sudoers 限制 ubuntu 能提权做什么 |
| 越权验证方法（要能跑出输出） | ① command= 层：`ssh -i deploy-key ubuntu@server "echo hi"` → 应输出 `ERROR: Invalid command` 且非零；② sudoers 层：`ssh -i personal-key ubuntu@server "sudo systemctl start nginx"` → 应 `sudo: command not allowed` 非零；③ 部署前 `sudo -l -U ubuntu` 输出与预期白名单逐条比对，出现 `(ALL:ALL) ALL` 即阻断 |
| 凭据注入方式 | Jenkinsfile `environment { DEPLOY_CRED = credentials('jenkins-deploy-key') }`；ssh 用 `-i ${DEPLOY_CRED_KEY}` 引用私钥文件路径 |
| 日志不可见的验证方法 | 构建后 `grep -E "BEGIN RSA PRIVATE KEY\|BEGIN OPENSSH PRIVATE KEY\|<公钥指纹>\|私钥 20+ 字符 base64 片段"` 搜索构建日志，搜到任一即流水线失败；日志来源用 `currentBuild.rawBuild.getLog()` 或 `${JENKINS_HOME}/jobs/.../builds/.../log`（API 细节 D2/D3 定） |
| 泄露时的止损动作与顺序 | ① 从 `~ubuntu/.ssh/authorized_keys` 删除对应公钥行；② 吊销 Jenkins 凭据 ID；③ 重新生成密钥对并重新部署公钥；验证：`ssh-keygen -lf` 确认行消失 + 旧私钥 `ssh` 被拒 |
| deploy-wrapper 属主 / 权限 | `root:root` 755（不可由 ubuntu 写入，防白名单绕过） |

### 5.3 一次发布的完整旅程（自 Q2 / Q4 / Q7 / Q12 汇集）

从一次提交到服务器换版本，逐层写清**谁执行、动了什么、留下什么证据**：

```text
[开发者] git push origin main
    │
    ▼
[GitHub Actions] 触发 ci.yml（单元测试 + lint，仅反馈，不参与部署判定）
    │  证据：Actions run 记录
    │  失败点：Actions 红不影响部署（B1 已定）
    │
    │  （并发）
    ▼
[Jenkins controller] 每 5 分钟轮询 origin/main
    │  证据：轮询日志记录时间戳与当前 HEAD
    │  失败点：网络不通 / GitHub 5xx → 不触发，等下一轮
    ▼
[1 Checkout] git fetch origin main + git reset --hard origin/main（首次 clone）
    │  证据：工作区 ${JENKINS_HOME}/workspace/<job>/
    │  失败点：git 非零 → 流水线失败，人工介入
    ▼
[2 Install] npm ci（全量含 dev）
    │  证据：node_modules ~21M
    │  失败点：npm ci 非零 → 失败，finally { deleteDir() }
    ▼
[3 Test] npm test（单元 + 集成，MMS 在 controller 侧）
    │  证据：测试报告（JUnit XML / stdout）
    │  失败点：用例失败 / MMS 拉起失败 → 失败，打印报告
    ▼
[4 Deploy] ssh -i $KEY ubuntu@server "deploy-wrapper <commit-sha>"
    │  wrapper：读 SSH_ORIGINAL_COMMAND → 正则白名单校验 deploy <40hex>
    │  ├─ 写 .rollback_target = 当前运行 commit（部署开始快照）
    │  ├─ sudo -u nodeapp git fetch origin main
    │  ├─ sudo -u nodeapp git reset --hard <commit-sha>
    │  ├─ sudo -u nodeapp npm ci --omit=dev
    │  └─ sudo systemctl restart nodeapp
    │  证据：服务器 journalctl -u nodeapp + wrapper 日志
    │  失败点：任一步非零 → 立即自动回滚到 .rollback_target
    ▼
[5 Verify] 按 Q15 清单顺序：
    ├─ curl -f http://127.0.0.1:3000/health → 200 {"status":"ok"}
    ├─ mongosh --eval "db.runCommand({ping:1})" → {"ok":1}
    ├─ curl -f https://43-128-154-242.sslip.io/ → 200（公网，补盲区②）
    ├─ ss -lntp | grep 3000 → LISTEN
    ├─ check-app → OK；check-disk → OK
    │  证据：验证脚本输出汇总
    │  失败点：任一不通过 → 标记失败，人工判定回滚（不自动）
    ▼
[更新回滚基线] ssh -i $KEY ubuntu@server "mark-verified <new-commit-sha>"
    │  证据：.previous_commit 文件内容更新
    │  执行时机：Verify 全部通过后；仅写文件，不部署不重启
    │  失败点：mark-verified 本身失败 → 流水线标记失败，但服务器仍在新版本可用状态（基线未更新）
    ▼
[发布完成] 流水线绿色，部署后验证通过，新的回滚基线已建立
```

### 5.4 回滚判据表（自 Q12 / Q13 / Q14 汇集）

| 触发条件 | 回滚目标 | 回滚动作 | 回滚后的验证 | 谁决定（自动 / 人确认） |
|---|---|---|---|---|
| 部署中阶段失败（deploy-wrapper 内任一步非零：git fetch / git reset / npm ci / restart） | `.rollback_target`（部署开始时快照 = 上一运行 commit） | 同一 SSH 会话内立即执行：`git reset --hard $(cat .rollback_target)` + `npm ci --omit=dev` + `systemctl restart nodeapp` | 一次 `/health` 快速检查（200 即恢复） | **自动**（流水线执行，无需人工） |
| 部署后验证失败（Q15 清单任一不通过） | `.previous_commit`（最近一次验证通过的 commit） | 人工执行 `ssh -i $KEY ubuntu@server "deploy-wrapper rollback"`（wrapper 读 `.previous_commit` 执行 git reset + npm ci + restart） | 完整部署后验证清单（Q15） | **人工判定**（Q4/Q12 已定，验证失败不自动回滚） |
| 回滚动作本身失败（`.rollback_target` 缺失 / git reset 失败 / 回滚中 npm ci 失败） | 无（回滚失败） | 人工紧急介入：SSH 到服务器手动 git reset 到已知可用 commit + 手动 npm ci + 手动 restart | 人工手动验证服务恢复 | **人工紧急介入** |

> **两个文件职责**（Q12/Q13）：`.rollback_target` = 部署开始时的快照，用于部署中途失败的即时恢复；`.previous_commit` = 最近一次验证通过的版本，用于人工回滚（`deploy-wrapper rollback` 只读它，不接受外部 SHA，防误回滚到未验证版本）。首次部署前 `.previous_commit` 初始化为 `6a1b1a1`（当前线上 HEAD，注明信任边界：未经部署后验证，仅作首次应急回滚点，首次 Verify 通过后建立新基线）。

### 5.5 部署后验证清单（自 Q15 汇集，复用 W10 的五面 + 四项检查）

| 验证项 | 命令 | 通过判据 | 不通过是否算部署失败 | 它证明不了什么 |
|---|---|---|---|---|
| `/health` | `curl -f http://127.0.0.1:3000/health` | 200 + `{"status":"ok"}` | **是** | 证明不了 DB 连通、业务逻辑、连接池可用——只证明 HTTP 层进程存活（第一道冒烟） |
| 数据库连通（mongosh 直连） | `mongosh --eval "db.runCommand({ping:1})" --quiet` | `{"ok":1}` + 退出码 0 | **是** | 证明不了应用能否正确读写业务数据（但排除「DB 不可达」这一类 3 资源型故障） |
| 业务接口 | `curl -f http://127.0.0.1:3000/` | 200 + "Hello, World!" | **是** | 证明不了深层业务逻辑（报表聚合 / 权限校验）——只证明应用能响应基础请求 |
| 公网 443（补盲区②） | `curl -f https://43-128-154-242.sslip.io/` | 200 + 应用响应 | **是** | 证明不了 `/admin/` 面静态资源（另一路径）——但覆盖 Nginx 反代层，是补盲区②的唯一方式 |
| 端口监听确认 | `ss -lntp \| grep :3000` | 见 LISTEN + node 进程 | **是** | 证明不了应用能否处理请求——仅证明 socket 已绑定（类 2 兜底） |
| check-app | `systemctl start check-app.service` 或脚本（**路径待 D3 用 `systemctl cat check-app.service` 核实**，当前表中路径为占位） | 输出 OK（is-active + /health 两层判） | **是** | 同 `/health` 局限，不涉公网反代层（补盲区②靠公网 curl 不靠 check-app） |
| check-disk | `systemctl start check-disk.service`（**路径待 D3 核实**） | 磁盘在阈值内（字节级判据），输出 OK | **是** | 证明不了特定目录 inode 是否用尽（若部署后需确认可加 `df -i`） |

> 执行顺序：按表序——先冒烟（/health）→ 探 DB → 验业务接口与公网 → 最后跑检查脚本。任一失败即停止后续验证，整个阶段标记失败。

### 5.6 只读基线（块 C 采集，2026-08-24）

> 执行方式：本人 SSH 至 `43.128.154.242`（ubuntu 身份）逐条执行；命令均为只读，无状态变更。
> 内存基线以 2026-08-24 实测 **available 1169 MB** 为准（W10 记录的 1388 MB 为过去值）。

```text
[① 线上版本]（Q12 回滚目标起点）
6a1b1a1dc1bd6c0b5a83913949985e99f9702074
6a1b1a1 (HEAD -> main, origin/main, origin/HEAD) Merge pull request #82 from NiceFreak/claude/w10d4-learning-visualization-i3n062
工作区未跟踪：?? week8-fullstack/src/frontend/dist-admin443/
（结论：服务器未 fetch，落后本地 main；线上 HEAD 是 W10 D4 的 PR，非本地最新）

[② 部署单元体积与依赖]（Q6 产物形态输入）
node_modules：21M
node v24.19.0 / npm 11.17.0      （对照 .nvmrc=24；目标机 v24.19，构建机 v24.18，同大版本）

[③ systemd 单元 nodeapp]（Q7 部署单元 / Q13 原子性输入）
Type=simple | User=nodeapp
WorkingDirectory=/home/nodeapp/nodejs-skillup/week2-express/src   （指向具体目录，非符号链接）
ExecStart=/usr/bin/node --env-file=.env server.js
Restart=on-failure | RestartSec=10s
StartLimitIntervalSec=60s | StartLimitBurst=5
TimeoutStopSec=30s | KillMode=control-group
After=network.target mongod.service | Wants=mongod.service
WantedBy=multi-user.target

[④ sudo -l]（Q9 权限清单起点）
Matching Defaults entries for ubuntu on localhost:
    env_reset, mail_badpass, secure_path=..., use_pty
User ubuntu may run the following commands on localhost:
    (ALL : ALL) ALL
    (ALL) NOPASSWD: ALL
    (ALL) NOPASSWD: ALL
    (ALL : ALL) NOPASSWD: ALL
（结论：当前登录用户为全权免密 root，属 W9 手工时代形态；本周要收窄为白名单）

[⑤ SSH 登录现状]（Q8 认证方式起点）
~/.ssh/ 属主 ubuntu，authorized_keys 权限 600（395 字节）
公钥指纹：2048 SHA256:asSOrkkrV00NJJ0ngJ88pK7iO0D7PV5gsCIO5tPLOro skey-i6dn6bkp (RSA)

[⑥ 部署单元属主]（Q8 写文件身份）
nodeapp: uid=1002(nodeapp) gid=1003(nodeapp) groups=1003(nodeapp)
/home/nodeapp/nodejs-skillup：nodeapp:nodeapp，drwxrwxr-x（775）
（结论：登录身份 ubuntu 与目录属主 nodeapp 不是同一个身份）

[⑦ 资源基线]（Q13 中间态 / Q18 stretch 分母）
df -B1 /：42156257280 总量 | 7912566784 used | 32401829888 available（约 31G）| 20%
df -h /：40G / 7.4G / 31G / 20%
free -m：Mem total 1931 | used 577 | free 148 | buff/cache 1205 | available 1169
Swap：0 / 0 / 0

[⑧ 监听与检查 timer]（W10 收口态复核）
ss -tlnp：127.0.0.1:3000（nodeapp）| 0.0.0.0:443 / 80 / 8081 / 8080（Nginx 面）| 0.0.0.0:22（SSH）| 127.0.0.1:27017（mongod）| 127.0.0.53:53（systemd-resolved）
timer 均 active：check-app（~1 min 间隔，14:08:01 上次）| check-mem（5 min）| check-disk（1 h）| check-cert（6 h）

[开发机侧]（controller / stretch 前置）
sysctl hw.memsize：34359738368 字节 = **32 GiB**（2026-08-24 D2 补采，D1 块 C 漏采项；Q1 的 -Xmx512m/-Xms256m 对照此数，堆占物理内存 < 2%）
java -version：无法定位 Java Runtime（无 JVM；Jenkins 先决条件缺项）
docker version：client 29.6.1（darwin/amd64，context colima）；daemon 未运行
  —— unix:///Users/nezha/.colima/default/docker.sock 连接失败（colima 未启动）
node v24.18.0 / npm 11.16.0
df -h：/dev/disk1s1s1 466Gi，Data 卷 avail 284Gi
```

---

## 6. 问答沉淀区（概念卡住时写这里）

> 形态参考 W9 D1 §2.6 / W10 D1 §6：问题库负责「学什么、证明什么」，本区负责「这里到底怎么回事」，两者并存。

- **类 2「假 active」不是 EADDRINUSE 崩溃路径**：若为 EADDRINUSE，进程会崩溃退出、日志留下错误堆栈、systemd 看到 failed；而类 2 是 `listen` 成功回调已触发、进程存活、无任何错误信号，但底层 socket 未绑定。它是「没有失败信号的未绑定」，不是崩溃，因此部署后验证探针无法通过进程存活状态发现。（本人推导，AI review 通过，2026-08-24）
- **webhook 与轮询的差别是网络位置**：webhook 需要 GitHub 主动向 Jenkins URL 发请求，要求该 URL 公网可达；轮询是 Jenkins 主动出站拉取，只要求出站权限。开发机在 NAT 后无公网入站地址，改配置改变不了这个约束。端口转发在技术上可让 GitHub 到达，但那等于在网络上新开公网入口，是「隧道」档的代价。（本人作答，2026-08-24）
- **凭据 mask 的边界**：mask 只认 Jenkins 知道的原样字符串，变形输出（base64 / 拼接 / 写文件再 cat）不再被替换；凭据一旦出现在构建日志就按已泄露处理，因为日志会被保留、翻阅、复制。与 W10 日志脱敏的关系：W10 防应用日志（源头不产生明文），本周防构建日志（流水线输出），同一纪律两个落点。（本人作答，2026-08-24）

---

## 7. 今日明确不做

- 不装 Jenkins、不装任何插件、不建任何 job。
- 不在服务器上创建用户、不生成密钥、不改 `authorized_keys`、不改 `sudoers`。
- 不改 `.github/workflows/ci.yml`，不新建任何 CI 配置文件。
- 不触发任何部署，包括「就手工跑一次看看流程」。
- 不改 `app.js` / `server.js` 一行——类 2 的修复要等 D4 复现之后才定（Q16）。
- 不改 `check-disk.sh` 的属主（W10 移交的顺手项排在 D2，走变更单）。
- 不碰 Nginx、证书、ufw、8080 下线、8081 展板产物。
- 不碰 Java / Maven / S3 / Docker——三个 stretch 今天只定前置条件与上限（Q18），不执行。

---

## 8. 明日入口（D2）

契约冻结后，D2 的第一个动作是**按变更单四要素起草 controller 落地单**（W9 D5 §10 形态）：
改动清单 = 边界 / 验证 = 可证伪实验 / 回滚 = 卸载路径 / 止步 = 内存与磁盘上限。

D2 验收句（写在这里，明天不要临时改）：
**能从一次提交触发出一条完整的构建记录，里面看得到装了哪些依赖、跑了哪些测试、结论是什么；
把测试改成失败，流水线确实变红；整个过程中服务器零改动。**

D2 的硬边界：**不配置任何指向服务器的凭据**。
顺带项：`check-disk.sh` 属主从 `ubuntu:ubuntu` 改回 `root:root`（W10 移交，与主线无依赖，走变更单四要素）。

> **【计划修正，2026-08-25 D2 开工前 review】该顺带项移到 D3 执行。**
> 理由：它要 `chown` 服务器上的文件，与本节写死的 D2 验收句第 3 段「整个过程中服务器零改动」和 D2 硬边界直接冲突。
> 验收句已冻结、不改字，被移出的是顺带项；D3 本来就要写服务器，该项并入 D3 的变更单。
> 本条只改执行日期，不改 Q1–Q18 任何决策。同步留痕：[`week11-plan.md`](./week11-plan.md) §4 D2 / D3、[`day2-controller-setup.md`](./day2-controller-setup.md) §0 F4。

---

## 9. AI 辅助记录

- 2026-08-24（起草）：AI 起草本文件——§2 事实梳理（读 `.github/workflows/ci.yml`、`package.json`、`app.js`、`server.js`、W9 / W10 笔记与 runbook）、
  §2.5 前置概念 **L1 讲解**、§3 时间盒与只读命令清单、§4 问题库与追问、§5 空表模板。
- 2026-08-24（作答与冻结）：§4 的 Q1–Q18 全部由**本人作答**并回填；§4.1 九对冲突自查由本人逐条判断、AI review；§5 五张表由本人填写内容、AI 落字整理。
  AI 的角色：只提问、追问、指出矛盾与事实错误（B1/B2/B3 等阻断性问题由本人修复）、review 逐条结论。未代答任何黑名单决策。
- **黑名单知识点的援助上限为 L2**：凭据模型、权限清单、阶段划分与失败判据、产物形态、回滚判据、部署后验证的选择、环境分离定义、stretch 上限全部由本人取值，AI 只提供问题、追问、判据框架与 review，不含取值与实现。
- §2.5 属 `AGENTS.md` §4 的「可推导 / 经验知识」分工里的原理讲解与工具行为说明，不含本周的任何决策。
- **未触发 `DEBT.md` 记账**（L1 讲解 + 白名单文档整理，黑名单零实现；全天援助未越过 L2）。
