# W9 Day 3（8/12）：收掉 D2 尾巴 + 数据库接通

> 建立：2026-08-11（Asia/Shanghai），供 8/12 执行
> 上游：[`day2-host-and-node-service.md`](./day2-host-and-node-service.md)（问题 9–16 已冻结，块 D 步骤 1–5 已完成）；[`day1-contract-freeze.md`](./day1-contract-freeze.md)（契约冻结）；[`week9-plan.md`](./week9-plan.md) 第 4 节 D3
> 状态：**第 3 节问题 17–22 已全部作答并冻结（2026-08-12 上午），3.1 自查无冲突，问题 20 步骤表已重推。阶段 A 已收口：槽位 0✓、a✓、b✓、c✓、d✓、e✓（P1、P2 达成。MongoDB 8.0.29 已装、认证启用、双用户建立、27017 只走 loopback）。服务器现有状态：代码 clone、npm ci 完成、Mongo 认证与监听落地；.env 未建、HOST 未落地、systemd 未写**。

---

## 0. 这份计划的排法（与 D2 的差别）

D2 的排法有四处结构缺陷，今天逐条修掉：

| D2 的问题 | 今天怎么改 |
|---|---|
| 时间盒按「90 分钟 / 11 步」拍脑袋，均分到每步 ≈ 8 分钟 | **不设时间盒**。改成「阶段 + 显式收工点」，每个收工点都是可以干净停下的状态 |
| 11 步用同一张表列出，暗示成本相同 | 每步标**重量**（轻 / 中 / 重）与**性质**（运维执行 / 设计任务 / 探索） |
| 最重的「写 systemd 单元」排在第 10 位，最累的时候才做 | 重活前置到阶段 A 中段，验收类轻活垫后 |
| 步骤表在问题 9 作答**之前**写死，选 A 之后没重推，导致「装 MongoDB」不在任何一步里 | **问题 20 要求本人重推步骤表**，本文件只给槽位和依赖关系，不替你排定 |

一句话：今天不是「必须做完 11 步」，是「做到哪个收工点都算数」。

### 0.1 引导形态：问题稿 与 一问一答 的分工（2026-08-12 判断）

今天两种形态都用，切分依据是**这个问题的答案依不依赖机器的真实输出**：

| 形态 | 适用 | 为什么 |
|---|---|---|
| **整体问题稿一次冻结**（第 3 节问题 17–22） | 契约与决策类 | 这批问题互相咬死：认证决策 → `MONGODB_URI` → `.env` → seed 能否写库，是一条单向链。边聊边做会让后答的推翻先落地的，回滚成本高于一次性冻结。且按 `LEARNING-PROTOCOL.md` §3，操作链任务在问题库冻结前不做任何有副作用的动作 |
| **对话中一问一答**（第 4 节槽位执行期，走问题三连） | 执行与探索类 | 答案依赖上一步的真实输出（`apt-cache policy` 的结果、bcrypt 走下载还是编译、包自带单元的行为）。预先写稿等于预写验收证据，违反第 7 节 |

两条纪律：

1. **问题稿只出问题，不出步骤表。** D2 的缺陷正是步骤表在问题 9 作答前写死；今天的步骤序列由问题 20 本人重推。
2. **经验知识不进问题稿。** 按 `AGENTS.md` §4，第一次见就无从推断的工具行为（安装交互、包自带单元行为、输出约定）由 AI 直接讲，不要求先猜；问题稿里只放可推导的内容。

---

## 1. 起点状态（事实，来自 D2 执行记录）

**已成立**（不需重做，但今天第一件事是只读复核，见阶段 A 步骤 0）：

- 系统基线收敛，内核 `5.15.0-187-generic` 已生效
- 运行身份 `nodeapp`（UID 1002 / GID 1003，`/usr/sbin/nologin`，`/home/nodeapp` 750）
- ufw `active`，入站默认 deny，仅 22 双栈放行
- SSH 加固：`permitrootlogin no`，公网密钥链路 `PUBLIC_OK`
- Node `v24.19.0` / npm `11.17.0`，`/usr/bin/node`

**未成立**：代码未上机、依赖未装、`.env` 未建、`127.0.0.1` 绑定未落地、**MongoDB 未装**、systemd 单元未写、D2 验收句未验证。

**待跟踪的欠账**（问题 9 选 A 产生）：「Mongo 缺失 → Node 启动即失败 → 按 `StartLimitBurst` 停住而非无限重启」这条契约（D1 问题 6 第 7 点）在 A 方案下没有自然场景，需**人为制造故障**补验。今天列在阶段 B。

---

## 2. 新增事实（MongoDB 侧，D3 的决策输入）

### 2.1 安装渠道待核实

Ubuntu 22.04 官方源里**是否还有可用的 MongoDB 服务端包**需要在服务器上核对——用与 Node 相同的手法：

```text
apt-cache policy mongodb-org mongodb mongodb-server
```

这是**待验证**，不是事实。D2 的经验说明这一步值得先做：当时预测 apt 的 nodejs 是 12.x 量级，实测 `12.22.9~dfsg-1ubuntu3.6`，预测命中，于是「apt 渠道淘汰」这个决策有了实证而不是传闻。

**版本不是自由选择（2026-08-12 补充事实）**：`week2-express/src/package.json` 依赖 `mongoose@^9.7.3`，驱动决定了能连的**服务端版本下限**；本地 `docker-compose.yml` 用的是 `mongo:7`，这是已被第一轮证明可用的组合。含义：即使发行版源里有包，版本太老也连不上——渠道和版本要一起选，不能先选渠道再看版本。驱动支持的服务端版本范围**可查官方文档**，属可推导，本人自查后再答问题 17。

### 2.2 WiredTiger 的默认内存策略（与 Swap=0 直接相关）

MongoDB 的存储引擎 WiredTiger 默认会给自己一块缓存，**默认值按内存比例算**（约为「总内存减 1 GB」的一半，且不低于 256 MB）。

在这台机器上（total 1931 MB）代入：约 **450 MB 量级**。加上 mongod 自身其他开销、Node 进程、以及 D4 要装的 Nginx，全部压在 **available 1450 MB、Swap = 0** 上。

含义：**mongod 的实测 RSS 是今天必须拿到的数字**，和 Node 的 RSS 一起，构成 D4 装 Nginx 之前的内存闸门依据。上面的比例是文档口径的**推断**，实测值以 `systemctl status mongod` / `ps` 为准——两者对不上要归因，别拿公式当结果。

### 2.3 认证与连接串的耦合

`.env.example` 的样例是 `mongodb://root:example@localhost:27017/shop?authSource=admin`——这个形态**隐含 Mongo 启用了认证**。

含义：**「Mongo 要不要开认证」必须在建 `.env` 之前答**（问题 18），否则 `MONGODB_URI` 写不出来。D2 的步骤表把 Mongo 排在末尾正是漏了这条依赖。

另：`root:example` 是本地 docker-compose 弱口令（D1 §2.3），不作为服务器凭据、不进文档。

### 2.4 seed 脚本的前置条件

`package.json` 的 `seed:users` / `seed:orders` 都是 `node --env-file=.env <script>.js`，且 `seedOrders.js` 顶部写明「前置：先跑过 `seedUsers.js`」——它从库里读真实用户拿 `_id` 挂订单。

依赖链：**Mongo 可写 → `.env` 正确 → 先 users 后 orders**。三者任一不成立，seed 就是白跑或半跑。

### 2.5 `.env` 的落点由 cwd 决定（2026-08-12 新查，D3 计划原先漏了）

`package.json` 的四个运行脚本全是 `node --env-file=.env <文件>.js`：

```text
start       → node --env-file=.env server.js
seed:users  → node --env-file=.env seedUsers.js
seed:orders → node --env-file=.env seedOrders.js
```

`--env-file` 按**进程的工作目录**解析这个相对路径，而 `server.js` 与两个 seed 脚本都在 `week2-express/src/`。仓库根的 `.env.example` 不在那个目录。

含义：**`.env` 放哪里、systemd 单元的 `WorkingDirectory` 写什么、seed 用什么身份在哪个目录跑，是同一个决策的三个面**，不能分开定。原计划槽位 f 只写了「三键、600、nodeapp 属主」，没写落点——今天补成问题 22。

另：`.env.example` 里除三键外还有 `DEEPSEEK_*`（W7 的），生产不需要；「三键」不是照抄 example 的结果，是本人裁掉之后的结果。

### 2.6 启动校验顺序（失败归因的第一个分叉）

`server.js` 的 `startServer()` 顺序是固定的：

```text
① 读 JWT_SECRET，缺失或长度 < 32 → 抛 JwtSecretConfigurationError → process.exit(1)
② connectDB()（内部 mongoose.connect(process.env.MONGODB_URI)，失败抛 DatabaseConnectionError）
③ app.listen(PORT)  ← PORT 缺省 3000
```

含义两条：

- `.env` 里 `JWT_SECRET` 不合格时，进程**根本走不到数据库**。看到「起不来」先分清是①还是②，否则会去查 mongod 而问题在 env。
- 阶段 B4 的欠账补验（人为 `systemctl stop mongod` 观察启动即失败）只有在①已经通过的前提下才证明得了那条契约，否则现象一样、归因不同。

同时确认（槽位 g 的前提仍成立）：`app.listen(PORT, callback)` **没有 host 参数**，当前等价于监听 `0.0.0.0`。

### 2.7 D1 端口表对 mongod 的约束（已冻结，今天落地）

D1 §5.2 已定 27017 **不在公网开放端口全集里**，只被同机 Node 经 loopback 连。今天要把这条从「纸面契约」变成「可观测事实」，验证方法见问题 19。

---

## 3. 需要先答的问题（本人作答，编号接 D2 的 9–16）

比 D2 少得多——大部分契约已冻结，今天只有 Mongo 引入的新决策点。

**问题 17（MongoDB 安装渠道 / D3）**：装哪个渠道、哪个版本？

先跑 §2.1 的核对命令，再在候选里选：发行版源 / MongoDB 官方仓库 / 二进制 tarball / 容器。请说明理由，并附带回答：**这个选择对 D5「按文档重走一遍」有什么影响？**（提示方向：哪种渠道的步骤最容易被文档漏写。）

> 答：**渠道 = MongoDB 官方 apt 仓库（mongodb-org 8.0）**。
>
> 自查（可推导）：Mongoose 9.x 官方兼容表 = MongoDB 6.x/7.x/8.x，最低 6.0。选 8.0 在支持范围内。
>
> 理由：① 安装最简、apt 自动处理依赖；② 自带 `mongod.service`（systemd 集成，问题 19/21 被此渠道自然约束为「用包自带单元」）；③ 升级走 `apt update && apt upgrade`，与 D2 选 NodeSource 同一条 apt 工作流；④ 无 Docker 额外内存层（2GB 约束下关键否决项）。
>
> ③ 补充（8.0 vs 7.0）：8.0 是当前稳定主线、官方源已覆盖 jammy、安全修复周期更长；新项目直接上 8.0，**接受「本地 mongo:7 是已验证组合、8.0 未亲手验证」的代价**。
>
> D5 文档风险点：**GPG 密钥导入 + sources.list 创建**最易被快速教程省略（漏了会报 `Unable to locate package mongodb-org`）。

**问题 18（认证边界 / D3）**：MongoDB 要不要启用认证？

已知：27017 只走 loopback、不对公网开放（D1 问题 5），外部到不了。那么开认证还有什么意义？

请正面回答两条中的一条并说明代价：**开** → 用户名/角色怎么建、建在哪个库、谁来建；**不开** → 理由是什么，以及「同机的其他进程和用户」这一层怎么办（这和问题 10 选 nodeapp 时用的最小权限是同一条推理线）。

你的答案直接决定 `MONGODB_URI` 写成什么形态，所以它必须在建 `.env` 之前冻结。

> 答：**开认证**。
>
> 理由（与问题 10 最小权限同一条推理线）：loopback 只防外部、不防同机其他进程/用户；UFW 管网络层、同机进程不受它约束；不认证 = 任何拿到 nodeapp 权限的攻击者可直读 127.0.0.1:27017。
>
> 建用户（谁来建 / 建在哪个库）：**ubuntu（sudo）经 SSH 会话**，在 Localhost Exception 窗口（实例无用户时 localhost 免密）用 mongosh 创建；**先建用户、后开认证**。用户建在 **admin 库**。
>
> 双用户语义分离：**admin**（角色 `userAdminAnyDatabase`，只管用户管理，不读写业务库）+ **nodeapp**（角色 `readWrite`，仅限业务库 `shop`；不带建用户权限，被攻破只能读写 shop）。
>
> 钥匙持有：admin 密码只存本地密码管理器、**不进服务器任何文件**；nodeapp 密码双存（本地密码管理器 + 服务器 .env）。
>
> URI 形态：`mongodb://nodeapp:<密码>@127.0.0.1:27017/shop?authSource=admin`。**必须带 `?authSource=admin`**（用户建在 admin 库，驱动默认按 `shop` 认证会失败）。
>
> 密写纪律：admin + nodeapp 两把密码实际值只在本地密码管理器，笔记与服务器均只留占位符。

**问题 19（mongod 的监听与守护 / D3）**：对照 D1 §5.2 端口表和 D1 问题 6 的七条契约——mongod 应该监听什么地址、由谁守护、要不要开机自启？

关键的一半是验证方法：**你用什么命令、看哪一列，才能证明它确实没有监听公网？**（这题问验证，不问配置项名字。）

> 答：**监听 127.0.0.1:27017**；**守护 = 包自带 `mongod.service`**（问题 17 渠道锁定，不自己写 mongod 单元）；**开机自启 = systemctl enable**（D1 问题 6 契约）。
>
> 验证方法（题目核心）：`sudo ss -tlnp` 看 **Local Address 列**——应为 `127.0.0.1:27017` 而非 `0.0.0.0:27017`（同 D2 块 C 区分 `0.0.0.0:22` / `127.0.0.53:53` 的手法）。**`-p` 列需要 root/sudo 才能看到非 root 进程**，所以必须 `sudo ss -tlnp`。

**问题 20（步骤表重推 / D3）**：这题是修 D2 的第 4 处缺陷——步骤表必须从问题 9 的答案重新推，而不是沿用旧表。

请用第 4 节的槽位重排出你自己的执行序列，并写出依赖关系。已知的硬依赖至少有四条：

- `MONGODB_URI` 依赖问题 18（认证决策）
- `.env` 依赖 `MONGODB_URI`
- seed 依赖「Mongo 可写 + `.env` 正确」，且 users 先于 orders
- systemd 单元依赖「Node 能手动跑通」（否则分不清是单元写错还是应用起不来）

> 答：**序列（修正 B2 后冻结版）**：
>
> ```text
> 0（只读复核，已完成）
> → 并行启动：a（clone）+ b（bcrypt 探明）+ d（安装 MongoDB 8.0）
> → a 与 b 汇合 → c（npm ci --omit=dev）
> → d 完成 → e（Mongo 认证与监听落地）
> → e 完成 → f（建 .env：MONGODB_URI / PORT / JWT_SECRET 三键，密码来自 e 创建的 nodeapp 用户）
> → g（本地改 server.js + commit + push 可插空；服务器 git pull 必须在 h 之前完成）
> → c、e、f、g(服务器 pull 后) 全部就绪 → h（手动跑通 Node）
> → h 通过 → i（systemd 单元 + 七条契约自查）
> → i 通过 → j（D2 验收句验证）
> ```
>
> **修 D2 两缺陷**：① 装 Mongo（d）从「垫在最后」提到**第一批并行**（与 a/b 三路并发），消除漏项；② systemd（i）仍在最后但前置（h 手动跑通）已把路径/命令/环境变量全部证明，i 是「固化收尾」而非排障点。
>
> **硬依赖**：f→e（URI 写 e 的密码）；h→f（环境变量）+ h→g 服务器 pull（HOST 绑定）；i→h（先手动跑通）；c→a+b。
>
> **并行/重排**：a/b/d 三路并发；g 本地半段（改/push）可插任何服务器等待空隙，服务器 pull 不能在 h 后。
>
> 注：f 三键 = MONGODB_URI / PORT / JWT_SECRET。**JWT_SECRET 缺失或 <32 会在启动校验①抛 JwtSecretConfigurationError**（不是连不上库）；**HOST 不进 .env**（问题 16 选 B，生产默认即 127.0.0.1）。

**问题 21（服务间依赖 / D3）**：Node 的 systemd 单元要不要声明它依赖 mongod？

这题的价值在失败路径：`server.js` 是先 `connectDB()` 成功才 `listen()`（D1 §2.2）。请回答——

1. 开机时两个服务的启动顺序如果没有约束，会看到什么现象？
2. 声明依赖之后，「MongoDB 挂了」这个场景的表现会变成什么？
3. 这个声明会不会和 D1 问题 6 第 7 点（启动失败不无限重启）打架？

> 答：**选 `After=mongod.service` + `Wants=mongod.service`（不选 Requires）**。
>
> ① 无依赖声明时（并行启动）：Node 先起 → connectDB 对 127.0.0.1:27017 ECONNREFUSED → 抛错退出 → systemd 按 Restart 重启 → 连续失败撞 StartLimitBurst → 服务 failed 罚下场 → mongod 后来起也无法自动恢复（当前 server.js 无重试机制，失败即 throw）。
>
> ② After（排启动顺序）+ Wants（弱依赖，启动时尽力拉起 mongod 但不连锁停）：期望语义 = 「mongod 挂了 Node 自己扛」——Node 的失败恢复交给自身行为 + systemd 的 Restart，不让 systemd 越界强杀。Requires 会把「mongod 挂」变成「Node 被连带停」，不符合期望。
>
> ③ 强依赖后行为：**不变的是限速器本身**（数 nodeapp 单元自己的启动失败次数）；要修正的是「Requires 连带停止**不计入**限速」——连带停止发生在 unit 已 active 之后，限速只数启动尝试失败。B4 欠账补验（人为 stop mongod）时会真实检验：mongod 停、Node active 中、无连锁停（Wants 语义）。
>
> 执行期提示：unit 片段曾有占位路径 `/home/nodeapp/app`（错误）与 `EnvironmentFile`（双机制反模式），问题 22 已分别收口为锁定路径三连与「只用 --env-file」。

**问题 22（`.env` 落点与工作目录 / D3，2026-08-12 新增）**：`.env` 放在哪个目录、属主和权限是什么？

已知（§2.5）：`npm start` 与两个 seed 脚本都是 `node --env-file=.env <文件>.js`，相对**进程 cwd** 解析；`server.js` 和 seed 脚本都在 `week2-express/src/`。

请一并回答三条，它们是同一个决策的三个面：

1. `.env` 的绝对路径是什么，为什么是这个位置（`.gitignore` 已忽略 `.env`，别答成会被提交的方案）。
2. systemd 单元的 `WorkingDirectory` 与 `ExecStart` 该怎么和这个位置对齐——注意 `ExecStart` 必须写绝对路径的 node，`npm start` 这层壳要不要保留也由你定，并说明代价。
3. seed 是谁在什么目录下跑？如果 seed 用的身份和 Node 服务不同，`.env` 的 600 权限会发生什么？

> 答（重答修正后冻结）：
>
> ① `.env` 绝对路径 = `/home/nodeapp/nodejs-skillup/week2-express/src/.env`。**路径三连锁定**：clone 根 `/home/nodeapp/nodejs-skillup/`、WorkingDirectory `/home/nodeapp/nodejs-skillup/week2-express/src/`、.env 与 server.js **同层**（脚本是 `node --env-file=.env server.js`，相对 cwd 解析；.gitignore 已忽略 .env，不存在提交问题）。
>
> ② **选 A：保留 `node --env-file=.env`**（不用 systemd EnvironmentFile，避免双重加载——Node 20+ 的 `--env-file` 不覆盖已存在的同名环境变量，双写时 systemd 注入值优先、改 .env 要 daemon-reload 才生效，排障无法判断哪份生效）。`WorkingDirectory=/home/nodeapp/nodejs-skillup/week2-express/src`，`ExecStart=/usr/bin/node --env-file=.env server.js`（直接 exec node，不保留 npm start 壳——省一层 shell、systemd 更精准管主进程；npm 无 shell 时无法找到 npm 二进制也是原因之一）。代价：依赖 Node ≥ 20.6（v24 已满足），无法在 unit 里用 `Environment=` 覆盖变量（需改 .env 文件）。
>
> ③ seed：**nodeapp 身份、cwd = week2-express/src**，命令 `sudo -u nodeapp node --env-file=.env seedUsers.js`。600 语义精确版：**ubuntu（非 root）被 600 挡**（属主 nodeapp、group/other 无 r）；**root 读得到但违背最小权限纪律**（root 不看权限位，D2 问题 10 已答）；**nologin 用户不能 `su -`**（su - 要起登录 shell，nodeapp 的 shell 是 /usr/sbin/nologin → 被拒），必须 `sudo -u nodeapp`。
>
> 认知修正记录：① 撤掉「systemd EnvironmentFile 会截断 URI 的 ?authSource」的想象机制（systemd 不剥引号但 URI 字符非特殊字符，真代价是机制分裂 + daemon-reload）；② 「root 挡不住 600」是 D2 问题 10 的既有答案，今天第三次同形态出现才收敛。

### 3.1 冲突自查

答完后逐条对照。已知的易冲突组合：

- 问题 18 开认证 ↔ seed 脚本用的连接串是否有写权限
- 问题 19 的守护方式 ↔ 问题 21 的依赖声明（包自带单元 vs 自己写的单元，改谁）
- 问题 21 声明强依赖 ↔ D1 问题 6 第 7 点（可能让「启动即失败」变成另一种表现，进而影响阶段 B 的欠账补验怎么做）
- 问题 22 的 `.env` 落点 ↔ 问题 22 第 3 问的 seed 运行身份（600 + 属主 nodeapp 时，用别的身份跑 seed 会读不到）
- 问题 22 的 `WorkingDirectory` ↔ 槽位 i 的单元内容（cwd 写错时现象是「找不到 .env」而不是「连不上库」，见 §2.6 的分叉①）

> 自查结论（五条，业务库名锁定 `shop`）：
>
> 1. **问题 18 开认证 ↔ seed 写权限：一致。** nodeapp 用户 readWrite on shop 支持 seedUsers.js 的 `deleteMany({})` + `insertMany()`（已读代码核实，无 drop 集合/库）。执行期观察：Mongoose autoIndex 默认开，会为 `email unique` 建索引，readWrite **没有 createIndexes**——seed 可能出「index build failed」警告但不中止插入（待 B1 实测）。
> 2. **问题 19 包自带 mongod.service ↔ 问题 21 After+Wants：一致。** nodeapp.service 直接引用官方系统级 Unit 名，不重写、不覆盖。
> 3. **问题 21 Wants ↔ D1 第 7 点：一致且协同。** Wants 无连锁停；StartLimitBurst 独立防 Node 无限重启；Requires 连带停**不计入**限速（active 后的停止不是启动失败）。
> 4. **问题 22 .env 落点 ↔ seed 身份：一致且强制约束。** 精确版：ubuntu 被 600 挡、root 读得到但违背最小权限纪律、必须 `sudo -u nodeapp`（nologin 不能 su -）。
> 5. **问题 22 WorkingDirectory ↔ 槽位 i：一致。** cwd 必须写死锁定路径；cwd 错时现象是「找不到 .env」+「找不到 server.js」（Cannot find module 是 server.js 内部 import 失败，措辞已修正）。
>
> 结论：**无冲突，六题答案 + 自查 + 步骤表整体冻结（P1 收工点）**。

---

## 4. 阶段 A：收掉 D2 的尾巴（今天的主线）

**阶段 A 的完成线 = D2 的验收句**（问题 9 已冻结）：Node 与 MongoDB 两个进程均被 systemd 管理、`systemctl status` 显示 `active (running)`，且 `ss -tlnp` 能看到 3000 与 27017 在听。

### 槽位（顺序由问题 20 决定，本表不排序）

| 槽位 | 动作 | 重量 | 性质 | 依赖 |
|---|---|---|---|---|
| 0 | 只读复核 D2 步骤 1–5 的成果仍成立 | 轻 | 运维 | — |
| a | clone 整仓到 `/home/nodeapp/nodejs-skillup`（nodeapp 属主，跟踪 origin/main） | 轻 | 运维 | 问题 11 |
| b | 探明 bcrypt 走下载还是本地编译（先在临时目录探） | 中 | **探索** | 问题 13 |
| c | `npm ci --omit=dev` | 中 | 运维 | b |
| d | 安装 MongoDB | 中 | 运维 | 问题 17 |
| e | Mongo 认证与监听落地 | 中 | 运维 | 问题 18、19 |
| f | 建 `.env`（三键、600、nodeapp 属主，**落点见问题 22**） | 轻 | 运维 | 问题 18、22、D1 问题 3 |
| g | 本地改 `server.js` 加 HOST 默认 `127.0.0.1` → commit → push → 服务器 pull | 中 | 代码 | 问题 16 |
| h | **手动跑通 Node**（不经 systemd，先证明应用本身能起） | 轻 | 运维 | c、f、g、e |
| i | **写 Node 的 systemd 单元** + 七条契约自查表 | **重** | **设计任务** | 问题 21、22、h |
| j | 按 D2 验收句验证 | 轻 | 验收 | i |

**槽位 h 是我新加的**，D2 的表里没有。理由：不先手动跑通就直接上 systemd，一旦失败就分不清「单元写错」还是「应用起不来」——这正是 D1 §2.2 关心的那种「假事实」。h 通过之后，i 的任何失败都可以确定归因到单元本身。

**槽位 h 的三连要用上 §2.6 的启动顺序**：手动跑通失败时，先分清停在①（`JWT_SECRET` 校验）还是②（`connectDB`）——两者的现象都是「起不来」，但要查的东西完全不同。

**槽位 i 是今天唯一的重活**，建议排在体力还好的时候，不要垫在最后。它是设计任务：七条契约（自动拉起 / 退避 / `SIGTERM` / `TimeoutStopSec ≥ 30s` / 开机自启 / 日志去向 / 启动失败不无限重启）要逐条对应到单元里，并写出自查表。

### 每步仍走问题三连

```text
① 要证明什么（这一步的验收是什么）
② 怎么验证（哪个命令 / 哪个系统状态能看到证据）
③ 失败的症状指向哪一环（先查哪里）
```

按 `AGENTS.md`「可推导 vs 经验知识」：三连里属于**可推导**的部分（验收、验证方法、失败归因）由你先答；第一次见的**工具行为**（Mongo 安装过程中的交互、包自带单元的行为、npm 的输出约定）我直接讲，不要求你先猜。

### 执行记录（滚动填写）

> 槽位 0（只读复核 D2 步骤 1–5）：
> ① 要证明什么：D2 已落地的系统层成果在隔夜后仍成立，且不被 unattended-upgrades 悄悄改写。
> ② 怎么验证：uname -r / getent passwd nodeapp / ls -ld /home/nodeapp / sudo ufw status verbose / sudo sshd -T | grep -i permitrootlogin / node -v npm -v which node。
> ③ 失败指向哪一环：任何一项偏离 → 先查 unattended-upgrades 日志与 /var/log/apt，再查是否有人工改动。
> —— 执行（2026-08-12，ubuntu@VM-0-5-ubuntu SSH 会话）——
> 实际结果：
> - uname -r = `5.15.0-187-generic`（✓ 与 D2 一致）
> - getent passwd nodeapp = `nodeapp:x:1002:1003::/home/nodeapp:/usr/sbin/nologin`；ls -ld /home/nodeapp = `drwxr-x--- nodeapp nodeapp`（750，✓）
> - ufw = `Status: active` + `Default: deny (incoming)` + 仅 22 双栈 ALLOW（✓）
> - sshd -T | grep -i permitrootlogin = `permitrootlogin no`（✓）
> - node -v = v24.19.0 / npm -v = 11.17.0 / which node = /usr/bin/node（✓ 与 D2 一致）
> - 附：问题 17 核对命令 `apt-cache policy mongodb-org mongodb mongodb-server` = **mongodb 与 mongodb-server Candidate 均 (none)；mongodb-org Unable to locate package**（发行版源实证零候选）
> 与预测的偏差 / 归因：无偏差。新观察：ufw 输出多一行 `New profiles: skip`（Ubuntu 22.04 对 AppArmor profile 的默认行为提示，不影响结论，记入笔记供后续参考）。
>
> 槽位 a（clone 整仓，三连冻结版）：
> ① 要证明什么：目录结构成立（/home/nodeapp/nodejs-skillup/week2-express/src/ 含 server.js、package.json、seedUsers.js）+ 仓库状态健康（main 分支、可追踪 origin/main）+ 内容完整性（Node 可解析 package.json）。
> ② 怎么验证：`ls -ld /home/nodeapp/nodejs-skillup`（预期 `drwxr-xr-x nodeapp nodeapp`，**755 不是 775**——预测基于默认 umask 022，实测被推翻，见偏差归因）；`ls -l .../week2-express/src/`；`cd ... && git status`（On branch main + up to date）+ `git log -1 --oneline`。
> ③ 失败指向哪一环：网络层（`curl -I https://github.com`，**ping 会因 ICMP 被安全组拦而误导**）→ 磁盘/权限（`df -h /home`、`ls -ld /home/nodeapp`）→ 目标已存在（`ls -la` 后 mv 备份或 git pull 跳过）。身份认证层当前用不到（公开仓库零凭据）。
> **执行前提（冻结）**：必须 `sudo -u nodeapp git clone ...`（回 `sudo git clone` 以 root 建树属主 → 不体现在 clone 阶段，而是 c 槽 npm ci 写 node_modules 时 EACCES，症状在 c、根因在 a）。
> —— 执行（2026-08-12，ubuntu SSH 会话）——
> 实际结果：
> - `sudo -u nodeapp git clone https://github.com/NiceFreak/nodejs-skillup.git /home/nodeapp/nodejs-skillup` → `Cloning into...` + `Total 2810 (delta 242)`, `3.97 MiB | 25.41 MiB/s, done`（nodeapp 身份建树成功）
> - 初次验收直跑 `ls -ld /home/nodeapp/nodejs-skillup` → **Permission denied**（ubuntu 身份，见偏差归因 ①）
> - 修正为 `sudo -u nodeapp` 前缀后验收：
>   - `ls -ld` → `drwxrwxr-x 18 nodeapp nodeapp ... /home/nodeapp/nodejs-skillup`（属主 ✓）
>   - `ls -l .../week2-express/src/` → 32 项齐全（app.js / config / controllers / errors / eslint.config.js / findOrdersWithUser.js / match-index-explain.js / middlewares / models / node-server.js / package.json / package-lock.json(255K) / perf / postman / prettier.config.js / reports.js / repositories / routes / seed.js / seedOrders.js / seedUsers.js / server-deprecated.js / server.js / services / __tests__ / users.http / users.postman_collection.json / utils）✓
>   - `git status` → `On branch main` + `Your branch is up to date with 'origin/main'` + `nothing to commit, working tree clean` ✓
>   - `git log -1 --oneline` → `788450b (HEAD -> main, origin/main, origin/HEAD) Merge pull request #66 from NiceFreak/claude/week9-day3-learning-plan-frn2hu` ✓（与本地 HEAD 一致）
> 与预测的偏差 / 归因：
> - **偏差①（预期行为误当故障）**：初验直跑失败——ubuntu 落 `/home/nodeapp`（750）的 **other 档（---）**，进不去是权限设计在按预期拦截，不是故障。修正：验收命令须以 nodeapp 身份（`sudo -u nodeapp`）。与问题 18 认证、问题 22 的 .env 600 同一族「nodeapp 的东西对其他用户不可见」设计，本偏差是这套设计第一次被真实触发。
> - **偏差②（权限 775 ≠ 预测 755）**：clone 目录权限 `drwxrwxr-x`（775）而非预测 755。归因：新建条目权限由**创建进程的 umask** 决定，`sudo -u nodeapp git clone` 用 nodeapp 的 umask。三重证据闭合 umask=002：① 文件 `-rw-rw-r--`（664）、目录 `drwxrwxr-x`（775）反推；② 两工件交叉印证（666−664=2、777−775=2）；③ `sudo -u nodeapp bash -c 'umask'` 实测 `0002`。预测 755 基于默认 umask 022 是错的——实际生效 002。
> - **偏差③（sudo 内建命令失败）**：`sudo -u nodeapp umask` → `command not found`——umask 是 **shell builtin**（`type umask` 可见），不是文件系统里的可执行文件；sudo 只能启动外部程序、不经 shell。正确形态 `sudo -u nodeapp bash -c 'umask'`。这本身成了 umask 不是外部程序的证明。
> - **决策（保持 775）**：umask 002 意味「同组可写」，但 nodeapp 组目前仅 nodeapp 一个用户；且父目录 750 的 `other ---` 让 ubuntu 到不了这一层。实际风险为零，保持 775、避免多余操作。
> - 槽位 a 结论：✅ 通过（真实执行 + 偏差完整归因）。
>
> 槽位 b（探明 bcrypt 走下载还是本地编译，三连冻结版）：
> ① 要证明什么：在 Ubuntu 22.04 amd64 + Node v24 下，bcrypt 的安装是否触发节点编译（决定 npm ci 是否撞 2GB/Swap=0 的编译内存上限）、下载是否成功。
> ② 怎么验证：看**安装输出的过程字样**（判别靠过程不是结果状态——退出码 0 + 产物存在两条路一样，不能做判别依据）：`node-pre-gyp http GET`/`download` = 下载；`gyp info`/`g++`/`make` = 编译；先 404 后 gyp = 有预编译但下载失败回退。
> ③ 失败指向哪一环：编译进程被杀/卡死 → `dmesg | tail` 看 OOM Killer（非 npm 输出）；`g++: command not found` → 缺 build-essential；下载失败 → curl URL 测连通。
> —— 执行（2026-08-12，ubuntu SSH 会话 /tmp/bcrypt-probe）——
> 实际结果（含关键过程）：
> - 首次 `npm install bcrypt`：**allow-scripts 警告**——npm 11 默认拦截依赖 install 脚本，bcrypt@6.0.0 的 `install: node-gyp-build` 未执行 → 判别字样一个没出现，探明无效。
> - 临时目录 package.json 无 allowScripts 配置 → 被拦；`npm approve-scripts bcrypt` 批准后 package.json 写入 `"allowScripts": {"bcrypt@6.0.0": true}`（与主仓库预配条目同形）。**主仓库 `week2-express/src/package.json` 已预配 `bcrypt@6.0.0`: true（及 fsevents/unrs-resolver/memory-server）→ 槽位 c 的 npm ci 脚本会被放行。**
> - 批准后重装：**无警告**，2 秒完成，输出里**既无 node-pre-gyp http GET 也无 gyp/g++/make**。
> - 产物验证：`find node_modules/bcrypt -name "*.node"` → `prebuilds/` 下 10 个平台二进制**全在包内**（linux-x64/arm64/win32/darwin × glibc/musl 等）；`lib/binding/napi-v3/` 不存在（该路径是 AI 给错的旧版布局）。
> - 最强验证：`node -e "...bcrypt.hash('probe-test',4)..."` → `BCRYPT_OK $2b$04$...`（原生模块真能加载）。
> 与预测的偏差 / 归因（**三处机制修正**）：
> - **修正①（D2 问题 13 机制假设被推翻）**：bcrypt 6.0.0 的 install 脚本是 `node-gyp-build`，配合 **prebuildify**——编译产物**打进 npm 包**（`prebuilds/` 多平台全带），安装时只挑选匹配本机（linux-x64 + glibc）的 .node 文件，**零网络下载、零现场编译**。≠ D2 假设的 node-pre-gyp「有预编译则下载、无则编译」。行为近似「预编译命中」，但机制不同。
> - **修正②（D2 §2.2 allowScripts 推断被推翻）**：npm 11（NodeSource）里 `allowScripts` **生效**——临时目录无配置就拦；主仓库已预配所以放行。D2「该字段对原生 npm 无效」是错误推断；「脚本照常执行」碰巧成立但推理路径错误（不是字段无效所以跑，是预配 true 所以放行）。
> - **偏差（AI 路径假设）**：`lib/binding/napi-v3/` 是 bcrypt 5 旧布局，6 实际用 `prebuilds/`。已归因，实测 require 是最强验证。
> - **对槽位 c 的含义**：`npm ci --omit=dev` **不吃编译内存**——OOM 闸门风险大幅下降（D2 风险 2 实质性解除，c 实测双击确认）；其余业务依赖纯 JS；memory-server 在 dev 被 omit 排除，其下载 mongod 二进制的脚本不触发。
> - 槽位 b 结论：✅ 通过（真实闭环：approve → 重装 → 产物 → require 实测）。临时目录已删（`rm -rf /tmp/bcrypt-probe`，`ls /tmp | grep bcrypt` 零残留）。
>
> 槽位 c（`npm ci --omit=dev`，三连冻结版）：
> ① 要证明什么：nodeapp 身份 + 真实目录下 npm ci 成功装齐生产依赖；--omit=dev 生效（memory-server 不装、其 mongod 二进制下载脚本不触发）；不触发本地编译（bcrypt 与槽位 b 结论一致）；nodeapp 对代码目录可写（槽位 b 修正②欠的验证点）。
> ② 怎么验证：写测试（touch+rm+echo WRITE_OK）+ npm ci 输出判别（added 计数 / 无 memory-server 字样 / 无 gyp 字样 / 无 allow-scripts 警告）+ node -e require('bcrypt')。
> ③ 失败指向哪一环：WRITE_OK 无 → 目录属主（clone 身份）；EACCES → node_modules 属主；网络超时/404 → registry 连通；memory-server 字样 → omit 失效；gyp 字样 → 槽位 b 结论被推翻需停下；require 失败 → 先看 node -e 完整报错分叉（Cannot find module = 空包，ERR_DLOPEN = 才 ldd prebuilds/linux-x64/bcrypt.glibc.node——**不是 bcrypt 5 的 lib/binding/napi-v3 路径**，AI 在三连 review 时已修正此旧布局错误）。
> —— 执行（2026-08-12，ubuntu SSH 会话）——
> 实际结果：
> - WRITE_OK（nodeapp 可写性 ✅）
> - `added 102 packages, audited 103 packages in 5s` + `found 0 vulnerabilities`（5 秒完成，无编译迹象）
> - 输出**无** mongodb-memory-server / **无** gyp / g++ / make / **无** allow-scripts 警告（三项判别全过）
> - `node -e require('bcrypt')` 静默成功（原生模块加载；静默输出在终端不可见，与槽位 b 的 BCRYPT_OK 实测等价）
> 与预测的偏差 / 归因：
> - 无阻断性偏差。小观察：node -e 静默成功无终端痕迹，判别靠「无报错回 prompt」；槽位 b 的 require+哈希实测是更强证据，c 与此等价。
> - 槽位 c 结论：✅ 通过。**P2 收工点达成**（代码 + 依赖在机器上，无任何服务在跑）。
>
> 槽位 d（安装 MongoDB 8.0，三连冻结版）：
> ① 要证明什么：官方 apt 源接入（GPG key + sources.list 落位）+ apt update 无错 + mongodb-org 8.0 装齐 + mongod 服务 enabled+active。
> ② 怎么验证：`ls -l`/`file`/`cat` keyring 与 list；`apt update` 无 NO_PUBKEY/404/Malformed；`apt-cache policy mongodb-org` 看版本；`mongod --version`；`systemctl status mongod`。
> ③ 失败指向哪一环：NO_PUBKEY → 第 1 步（GPG）；Malformed/404 → 第 2 步（sources.list 或代号）；Unable to locate → 源未加载；inactive → enable --now；failed → journalctl/mongod.log。
> —— 执行（2026-08-12，ubuntu SSH 会话）——
> 实际结果：
> - keyring `OpenPGP Public Key Version 4...RSA 4096`（1178B）+ sources.list 内容完整
> - `apt update`：`Hit:5 .../mongodb-org/8.0 InRelease`，无错误（主闸口过）
> - `apt install -y mongodb-org`：9 个新包（server/mongos/mongosh/database-tools 等），201MB→713MB 磁盘，Fetched 17s
> - `apt-cache policy mongodb-org`：Installed/Candidate 均 **8.0.29**
> - `mongod --version` = `db version v8.0.29`
> - `systemctl enable --now mongod`：`Created symlink .../multi-user.target.wants/mongod.service` + `Active: active (running)` + `Memory: 93.1M`
> 与预测的偏差 / 归因：
> - 无阻断偏差。新观察：① mongod 安装时自建专用系统用户 `mongodb`（UID 115/GID 120），与 nodeapp 各管各的进程（问题 10 最小权限推理在 Mongo 侧也成立）；② 初始 RSS 93.1M 远低于 D3 §2.2 推断的 WiredTiger ≈450MB（空载不预分配，B5 正式归因）；③ 启动走 needrestart 扫描（与 D2 步骤 1 同族形态）。
> - 槽位 d 结论：✅ 通过。
>
> 槽位 e（Mongo 认证与监听落地，三连冻结版）：
> ① 要证明什么：27017 只走 loopback（问题 19 契约）+ 双用户（admin/nodeapp，问题 18）+ 认证启用后无认证被拒、带认证成功。
> ② 怎么验证：`sudo ss -tlnp | grep 27017` 看 Local Address 列；无认证 `listDatabases` 应被拒；带 nodeapp+authSource=admin ping 应 ok；错误密码应 Authentication failed。
> ③ 失败指向哪一环：无认证不被拒 → 认证未生效（查 conf + 重启时序）；带认证失败 → 用户建错库/uri 少了 authSource；监听 0.0.0.0 → conf net.bindIp 需改。
> —— 执行（2026-08-12，ubuntu SSH 会话）——
> 实际结果：
> - 现状确认（只读）：conf `net.bindIp: 127.0.0.1` 已在、`#security:` 注释（认证未启用）、无认证 ping ok：**Localhost Exception 窗口开着**
> - **建用户（mongosh 内，密码用 passwordPrompt 交互、不进 shell 历史）**：`use admin` 后 `db.createUser({user:"admin", roles:[userAdminAnyDatabase, db:"admin"]})` + `db.createUser({user:"nodeapp", roles:[readWrite, db:"shop"]})` → 各 `{ ok: 1 }`
> - **conf 改动**：`cp` 备份 `.bak.20260812` 后 nano 解开 `#security:` → `security:\n  authorization: enabled`（两空格缩进）
> - **restart 后时序观察**：restart 命令返回后立刻 mongosh → ECONNREFUSED，稍后 `systemctl status` 显示 active（11:39:13 起）——**restart 是异步的，返回 ≠ 端口已 bind**
> - 监听验证：`ss -tlnp` = `127.0.0.1:27017`（✓）
> - 认证三连验证：无认证 `listDatabases` → `MongoServerError: Command listDatabases requires authentication`；错误密码 → `MongoServerError: Authentication failed.`；nodeapp 正确认证 → `{ ok: 1 }`
> 与预测的偏差 / 归因：
> - **偏差①（工具边界混淆）**：mongosh（JS REPL）+ bash 步骤粘进同一个块 → `sudo cp` 被当 JS 解析 `SyntaxError: Missing semicolon`。归因：两个提示符类型不同，命令边界未标注清楚（AI 责任）。修正为分步执行。
> - **偏差②（`ping` 不是认证判定命令）**：无认证 `--eval "{ping:1}"` 竟返回 ok:1，AI 一度引导「认证未生效」排查（时间线对比 conf mtime 11:39:02 < 启动 11:39:13，推翻「旧配置」假设）。最终用语义明确的 `listDatabases`（必须认证）+ 错误密码（必须失败）拿到决定性证据：**认证生效**，ping 是心跳/握手被豁免或不强制认证。教训：验证要选语义确定的命令，不是能跑通的命令（与槽位 b「退出码不能判路径」同类）。
> - **偏差③（ECONNREFUSED 误判为故障）**：实际是 restart 异步时序（端口 bind 晚于命令返回），mongod 本身正常。
> - 槽位 e 结论：✅ 通过。
>
> 槽位 f（建 .env，三连冻结版）：
> ① 要证明什么：.env 落位（与 server.js 同层、`--env-file=.env` 相对 cwd 可解析）+ 三键（MONGODB_URI 含 authSource=admin / PORT / JWT_SECRET ≥32）+ 权限 600、属主 nodeapp + Node 能加载。
> ② 怎么验证：`ls -l` 看权限属主；`grep -E "^(MONGODB_URI|PORT|JWT_SECRET)="` 查键名；`node --env-file=.env -e "...?ENV_LOADED:MISSING"` 验加载。
> ③ 失败指向哪一环：属主 root/权限非 600 → 写入身份（须 sudo -u nodeapp nano）；键名缺失 → grep 少行；ENV_LOADED 缺失/报错 → .env 语法；JwtSecretConfigurationError → JWT_SECRET 长度；Authentication failed → 先确认校验①（JWT_SECRET）已过，再查 URI 是否缺 authSource（⑧在 ② 内）。
> —— 执行（2026-08-12，ubuntu SSH 会话）——
> 实际结果：
> - 建立：`sudo -u nodeapp nano .../src/.env`（nodeapp 属主交互创建，三键填实）
> - `ls -l` 直跑 → `Permission denied`（**ubuntu 被 600 挡 = 600 生效的实证**，与槽位 a 的 750 拦截同类预期行为）
> - `grep` 三键齐全：`MONGODB_URI=…?authSource=admin` + `PORT=3000` + `JWT_SECRET=…`（格式正确）
> - `node --env-file=.env -e` → `ENV_LOADED`（Node 加载成功）
> 与预测的偏差 / 归因：
> - **偏差①（初稿缺键名）**：首版三行第一行缺 `MONGODB_URI=` 前缀（裸 URI 无 KEY=），会致 `process.env.MONGODB_URI` undefined → seed 报「缺少 MONGODB_URI 环境变量」。已修正。
> - **偏差②（验收直跑 vs 身份）**：`ls -l` 未带 `sudo -u nodeapp` 被 600 挡——预期行为，非故障；验收命令以 nodeapp 身份跑。
> - **纪律（凭据值）**：.env 内容值在对话中出现多次（用户确认占位/已自行处置），按用户要求**不入笔记**；笔记与执行记录均只留键名与形态，不写实际值。后续涉及 .env 的 grep/echo 输出应先 redact 值再回贴。
> - 槽位 f 结论：✅ 通过。

---

## 5. 阶段 B：原 D3 内容（**只在阶段 A 收线后才进**）

`week9-plan.md` 给 D3 的原文是「在已确认的网络边界内接通 MongoDB；验证应用启动、读写目标行为和重启后的连接恢复」。其中「接通 MongoDB」已经并入阶段 A，剩下这些：

| # | 内容 | 重量 | 说明 |
|---|---|---|---|
| B1 | 跑 seed（先 users 后 orders） | 中 | 依赖 §2.4 的链；D1 问题 2 已冻结用 seed 脚本 |
| B2 | **服务器内部**打通验收接口：登录拿 token → `GET /reports/monthly-sales` 返回 200 | 中 | 走 `127.0.0.1:3000`，不经公网（Nginx 是 D4）。这是链路第一次端到端 |
| B3 | 重启恢复验证：`reboot` 后两个服务自起、接口仍返回 200 | 轻 | 对应 D1 问题 6 第 5 点 |
| B4 | **欠账补验**：`systemctl stop mongod` → 启动 Node → 观察 failed 且按 `StartLimitBurst` 停住而非无限重启 | 中 | 问题 9 选 A 欠下的那条；补完即销账 |
| B5 | 实测 RSS：Node 与 mongod 各自占多少，对照 §2.2 的推断 | 轻 | D4 装 Nginx 前的内存闸门依据 |

B2 是本周第一次「真实数据 + 真实数据库 + 真实进程」的端到端，比 B1 重要；B4 和 B5 都是小而独立的，可以单独塞进任何剩余时间。

---

## 6. 显式收工点

任意一个收工点都是干净状态，停在这里不欠债、明天可直接续：

| 收工点 | 位置 | 停在这里的状态 |
|---|---|---|
| **P1** | 问题 17–22 答完 + 3.1 自查 | 决策冻结，服务器零写操作。等价于 D2 的块 B 收口 |
| **P2** | 槽位 c 完成（依赖装好） | 代码和依赖在机器上，无任何服务在跑。最容易恢复上下文的一个点 |
| **P3** | 槽位 h 完成（Node 手动跑通） | 应用本身被证明可用；只差守护。**推荐的半途收工点** |
| **P4** | 槽位 j 通过 | **D2 正式收口**，可勾选 `week9-plan.md` 的 D2 |
| **P5** | 阶段 B 任意条目完成 | 每条独立，做一条算一条 |

**顺延规则**：没到 P4 就收工，明天继续 D2；到了 P4，阶段 B 没做完的条目顺延进 D4 之前，**不挤压 D4 的公网 HTTPS 主线**。W9 已经从 5 天变成 6 天（收口顺延到 8/15），这是 D2 排多了的结果，不是新的超支——如果 D4/D5 还要顺延，那时候该砍的是 Java stretch，不是链路验收。

---

## 7. 今日交付物

1. 问题 17–22 的答案 + 3.1 自查结论。
2. 问题 20 重推出来的步骤序列（含依赖关系）。
3. 阶段 A 各槽位的执行记录：三连 + 实际 + 偏差归因。
4. **systemd 单元（本人写）** + 七条契约自查表。
5. D2 验收句的通过 / 不通过判定。
6. 到达 P4 之后：阶段 B 完成了哪几条，以及 Node / mongod 的实测 RSS。

**不预写验收证据**：第 4、5、6 项在执行前保持空白。

---

## 8. 今日明确不做

- 不装 Nginx、不申请证书、不碰 sslip.io / DNS——D4。今天所有验证都从服务器内部走 `127.0.0.1`。
- 不开放 27017 到公网（D1 §5.2 已冻结），不用 Compass 之类从笔记本直连验收。
- 不做故障演练体系、日志平台、监控（W10）；不碰 Jenkins / Docker（W11）；不碰 Java jar（stretch）。
- 不为了赶进度跳过槽位 h 直接上 systemd——那会把「单元写错」和「应用起不来」混成一个现象。

---

## 9. AI 辅助记录

- 2026-08-11（D3 计划）：AI 做了四件事——① 汇总第 2 节 MongoDB 侧的**事实与待验证项**（含 WiredTiger 内存策略的**推断**，已标注需实测）；② 起草第 3 节**提问** 17–21（L1）；③ 重排阶段结构、标注槽位重量与依赖、增设收工点（属于计划形态，不含任何配置或实现）；④ 新增槽位 h（先手动跑通再上 systemd）并说明理由——这是**验证顺序**的建议，不是实现。
- AI **没有**给出：安装渠道选型、认证决策、监听与守护配置、步骤顺序（问题 20 明确交回本人重推）、服务依赖声明、systemd 单元内容。
- 援助级别 L1，未触及黑名单 L2，**不触发 `DEBT.md` 记账**。
- 按 `AGENTS.md`「可推导 vs 经验知识」：今天的 Mongo 安装交互、包自带单元行为等属经验知识，AI 直接讲解，不要求本人先猜；三连中可推导的部分（验收、验证、归因）仍由本人先答。
- 跟踪中的欠账：问题 9 选 A 的「启动即失败契约」补验已排入阶段 B4，补完即销账。
- 2026-08-12（D3 计划增补）：AI 读 `week2-express/src` 代码后补了三处**事实**——§2.1 的驱动↔服务端版本约束（`mongoose@^9.7.3` / 本地 `mongo:7`）、§2.5 的 `.env` 落点由 cwd 决定、§2.6 的启动校验顺序（`JWT_SECRET` 先于 `connectDB`）；据此起草**提问 22**（L1），并在 §0.1 记录「问题稿 vs 一问一答」的分工判断。
- AI **没有**给出：`.env` 的具体路径、`WorkingDirectory` / `ExecStart` 的内容、要不要保留 `npm start` 这层壳、seed 的运行身份、MongoDB 的版本号选择——全部留在问题 22 与问题 17 由本人裁决。
- 2026-08-12（D3 执行期上段）：AI 全程 **L1 引导 + review**——复核槽位 0 输出、逐题 review 问题 17–22（指出「root 挡不住 600」三现、「8.0 vs 7.0 缺理由」、f 三键漏 JWT_SECRET 等重复/阻断项）、提供经验知识（ufw New profiles、`-p 列需 sudo`、`nologin 不能 su -`、`--env-file 不覆盖已存在变量`、Requires 连带停不计入限速）。**未给**安装命令、认证配置、单元内容、步骤序列（问题 20 本人排出）。
- 纪律事件（2026-08-12）：本人在三连冻结后**编造 clone 假输出**（you-org 占位符、假进度、假时间戳）回贴——违反「不预写验收证据」（D3 §7）与 D2 偏差 2 教训（证据不完整就说不完整）。已当场指出，执行记录实际结果保持空白直到真实执行。
- 援助级别 L1（事实汇总 + 提问 + 计划形态），未触及黑名单 L2，**不触发 `DEBT.md` 记账**。
