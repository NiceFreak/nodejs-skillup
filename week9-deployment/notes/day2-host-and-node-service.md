# W9 Day 2（8/11）：主机与 Node 内部服务

> 建立：2026-08-11（Asia/Shanghai）
> 上游：[`week9-plan.md`](./week9-plan.md) 第 4 节 D2；[`day1-contract-freeze.md`](./day1-contract-freeze.md)（契约已冻结）；[`LEARNING-STATE.md`](../../LEARNING-STATE.md)
> 状态：**第 4 节问题 9–16 已全部作答并冻结（2026-08-11 本人逐步填写），4.1 冲突自查无冲突，现状核对表已填（块 C 完成），服务器截至本行仍未做任何写操作**。第 6 节执行记录（块 D）待冻结后由本人按「问题三连」逐步骤执行。

---

## 0. 今日形态判断：为什么不是「整体问题稿」也不是「纯一问一答」

D1 用整体问题稿是对的——那天零副作用，8 个问题全部能靠读代码答完，答完即收口。

D2 性质变了：它是**执行日**，里面混着两类内容，必须分开处理。

| 类别 | 判据 | 今天的形态 | 对应章节 |
|---|---|---|---|
| **不可逆决策** | 做错要么丢失服务器访问，要么返工重装；且答案在 SSH 上去之前就能推出来 | **执行前冻结成问题稿**，答完才允许有副作用的动作 | 第 4 节（问题 9–16） |
| **状态依赖判断** | 答案取决于服务器实际是什么样，现在推不出来 | **执行期一问一答**：先答「问题三连」→ 执行 → 对照实际 → 归因偏差 | 第 6 节（空槽位） |

切分线是**可逆性**，不是难度。

今天有两步做错就**再也 SSH 不上去**，没有「跑一下看看」的机会：

1. `ufw enable`（放行规则不全 → 当前 SSH 会话被切断且无法重连）
2. sshd 禁用密码登录（密钥链路有任一环没验证成功 → 两种登录方式同时失效）

这两步是第 4 节存在的唯一理由。反过来，「Node 进程实际吃多少内存」「bcrypt 要不要本地编译」这类不能预写——预写就是预写验收证据，违反 `LEARNING-STATE.md`「D2 验收证据尚未产生：不预写」。

`LEARNING-PROTOCOL.md` 第 3 节（操作链任务先冻结契约）与第 9 节（每个有副作用动作先答问题三连）本来就是两个粒度，D2 是第一天两者同时生效。

---

## 1. 今日唯一主线与止步条件

**主线**：把 D1 冻结的契约在**服务器的系统层**落地——最小访问控制成立、Node 运行环境就绪、systemd 单元按 D1 问题 6 的七条契约写出来并被验证。

**止步边界（今天明确不做）**：

- 不装 Nginx、不申请证书、不碰 DNS / sslip.io——那是 D4。今天没有任何东西需要从公网访问 Node。
- 不做故障演练、日志平台、监控（W10）；不碰 Jenkins / Docker（W11）；不碰 Java jar（stretch，受主线与常驻内存上限约束）。
- **第 4 节答完之前，服务器上只允许只读命令。** 顺序与 D1 同理：写错的配置会在明天排障时变成假事实。

**完成判定**：见问题 9——D2 的通过标准取决于问题 9 怎么答，今天不预先写死。

---

## 2. 从代码读到的事实（D2 的执行输入）

以下是今天读 `week2-express/src/` 得到的**事实**，不是建议。它们约束第 4 节的答案。

### 2.1 启动顺序悖论：D2 的目标句按字面不成立

`server.js` 的实际顺序：

```text
校验 JWT_SECRET（< 32 字符直接抛错）
  → await connectDB()        ← 失败即 throw → process.exit(1)
  → app.listen(PORT)         ← 只有上一步成功才会执行
```

含义：**MongoDB 没起来，3000 端口根本不会存在。** 而 `week9-plan.md` 给 D2 写的目标是「让 Node 服务受进程守护并**先在服务器内部可验证**」——这句话在当前代码下无法按字面达成。

D1 笔记第 2.2 节已经记下这个疑点（「D2『Node 内部可验证』与 D3『数据库接通』的顺序需要重新想一遍」），但没有结论。**这是今天开工前必须先答的第一题（问题 9），因为它决定 D2 的验收句怎么写。**

### 2.2 运行时与依赖的硬约束

| 事实 | 依据 | 对 D2 的含义 |
|---|---|---|
| `"type": "module"`，ESM | `package.json` | 启动方式没有 CommonJS 回退余地 |
| `start` = `node --env-file=.env server.js` | `package.json` scripts | `--env-file` 需要 **Node ≥ 20.6**；且密钥读的是**工作目录下的 `.env` 文件**，不是环境变量注入 |
| `.nvmrc` = `24` | 仓库根 | 本人声明的目标版本 |
| Ubuntu 22.04 apt 源自带的 `nodejs` 版本远低于 20.6（量级为 12.x） | 待在服务器上用 `apt-cache policy nodejs` 验证 | 直接 `apt install nodejs` 大概率装出跑不起来的版本——**这是待验证，不是事实** |
| `bcrypt` `^6.0.0` 是**原生模块** | `package.json` dependencies | 没有匹配当前 Node/平台的预编译二进制时会走 node-gyp 本地编译，需要 python3 / make / g++，且编译期吃内存 |
| `mongodb-memory-server` 在 **devDependencies** | `package.json` | 它会下载一份完整 mongod 二进制。服务器上装 devDependencies = 白下一个数据库二进制 |
| `package-lock.json` 存在（255 KB） | `week2-express/src/` | `npm ci` 可用 |
| `allowScripts` 字段存在，但依赖里没有 lavamoat | `package.json` | 该字段对原生 `npm` 无效——install 脚本会照常执行（bcrypt 编译、memory-server 下载都会跑） |

关联已记录风险：服务器 **Swap = 0，空载可用 1468 MB**（D1 §5.4）。本地编译原生模块是 D2 第一个可能撞上内存上限的动作。

### 2.3 部署单元的位置

`package.json` 在 **`week2-express/src/`**，不在仓库根，也不在 `week2-express/`。部署单元根目录是嵌套第三层。

直接影响三处：clone 路径、systemd 的 `WorkingDirectory`、`.env` 的落点。三者必须指向同一个目录，否则 `--env-file=.env` 读不到文件——表现是 `JwtSecretConfigurationError` 或数据库 URI 为 `undefined`，而不是「找不到 .env」这种直白报错。

### 2.4 `.env` 的内容边界

`.env.example` 含 7 个键，其中 **`DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` 是 W7 AI 集成用的**，W9 链路完全不需要。

服务器上的 `.env` 只需要 `MONGODB_URI` / `PORT` / `JWT_SECRET` 三项（`server.js` + `db.js` 读的全集）。把 AI key 一起搬到公网主机上是无收益的暴露面。

另：`.env.example` 里的 `root:example` 是本地 docker-compose 弱口令（D1 §2.3 已记），不能作为服务器凭据。

### 2.5 监听地址仍未落地

`server.js:40` 是 `app.listen(PORT, ...)`，**没有 host 参数**，Node 默认监听 `0.0.0.0`。D1 问题 4 已决定「代码绑 127.0.0.1 + 防火墙，纵深防御」，并把它列为「白名单最小代码改动项，实施时执行」——**今天就是实施时**（见问题 16）。

在改动落地之前，任何「Node 只在内部可达」的说法目前只有防火墙一层，与 D1 的决策不符。

### 2.6 日志侧的一个观察（不阻断）

`app.js:17-27` 的 logger 中间件对**每个请求** `console.log` 一行。systemd 接管后这些进 journald（D1 问题 6 第 6 点）。当前流量下不构成问题，但它是「journal 要不要限容」这个话题的来源——记为观察，今天不处理。

---

## 3. 今日时间盒

| 块 | 时长 | 内容 | 产出 |
|---|---|---|---|
| A | 20 min | 读第 2 节事实，到源码核对；重点确认 2.1 的启动顺序 | 能复述「没有 Mongo 为什么 3000 不存在」 |
| B | 40 min | 回答第 4 节问题 9–16，写在每题下方 | 8 个答案 + 冲突自查 |
| C | 25 min | **只读**核对服务器现状：端口、Node 源、内存、磁盘 | 第 5 节现状表填满 |
| D | 90 min | 按第 6 节序列执行，每步先答问题三连再动手 | 第 6 节执行记录（预测 vs 实际 + 偏差归因） |
| E | 20 min | 收口：勾选 `week9-plan.md`、更新 `LEARNING-STATE.md`、生成口语稿 | D2 收口 |

块 B 未完成不进块 D。块 C 全部是只读命令，不改变任何状态，可以在块 B 之前做（`LEARNING-STATE.md` 下一步第 0 项：先看现状，再动手改）。

---

## 4. 执行前必须冻结的问题（本人作答）

按 `AGENTS.md` 第 4 节，一问一个设计点。这些属于拓扑、信任边界、凭据策略和验收推理，AI 只提问和 review。编号接 D1 的 1–8。

**问题 9（验收定义 / D2）**：第 2.1 节的启动顺序悖论怎么处理？

已知选项：**A** 把 MongoDB 安装前移到 D2（D3 变成「数据接通与读写验证」）；**B** 保留 D2/D3 分界，把 D2 验收改成「systemd 单元契约正确」，用**预期中的失败形态**当证据（服务 failed、按 `StartLimitBurst` 停下来而不是无限重启）；**C** 其他。

选定后必须写出：D2 结束时「什么算通过」的那**一句话**，以及这句话是否可证伪（有没有一个明确的观察结果能判它不通过）。

> 答：**选 A**——先在服务器装好 MongoDB 与 Node 运行时，再把业务代码搬上去。D2 验收句 = 当 Node 业务进程与 MongoDB 进程均被 systemd 管理（各自 `.service` 单元被登记并启动、`systemctl status` 显示 `active (running)`），且 `ss -tlnp` 能看到 3000 与 27017 真实在听，说 D2 通过。
>
> **可证伪**：任一项不成立即不通过——`systemctl status` 显示 `failed`/`inactive`，或端口不在听，或进程只是前台手动跑着而未被 systemd 接管。
>
> **欠账（A 方案的代价）**：「MongoDB 缺失 → 启动即失败 → StartLimitBurst 退避不无限重启」这条契约（D1 问题 6 第 7 点）在 A 方案下没有真实场景，D3 需人为故障补验——`systemctl stop mongod` 后 `systemctl start <node-service>`，观察服务 failed 并按 `StartLimitBurst` 停下而非无限重启。任选 B 则无此欠账但 D2 验收证据有歧义（failed 分不清「没 Mongo 预期失败」还是「配置写错」）。
>
> 当初不确定的「跳过」：A 方案确实跳过「启动即失败」契约的真实验证，故记欠账；但 A 方案消除 B 方案「failed 歧义」的缺陷（Mongo 在而服务起不来 = 配置错，指向明确）。

**问题 10（运行身份 / D2）**：Node 进程以哪个系统用户运行——root、专用非登录用户，还是现有登录用户？

这一个答案同时决定三件事：systemd 的 `User=`、代码目录属主、`.env` 的 600 归谁。请附带回答：**如果选 root，D1 问题 3 定下的「权限 600 保护 `.env`」还剩多少实际意义？**

> 答：**选 B——专用非登录用户**（如 `nodeapp`，无 shell，只被 systemd 拿来跑 Node）。理由与 W4 RBAC 同一原则：**最小权限**——进程只拿工作所需权限，不拿更多。root 权限无上限，以 root 跑一个面向潜在攻击面的服务 = 整台机器安全边界压在该进程上；攻破即整机沦陷。进程以 nodeapp 跑，攻破后只有 nodeapp 权限，能动的只有代码目录 + `.env`。
>
> **附带答案（选 root 时 600 还剩多少意义）**：A（root 跑）下权限位 600 对 root **本身失效**（root 能读任何文件，不看权限位），且攻破 root 进程的攻击者已是 root，也不看权限位——600 只剩「防非 root 用户随手读」的残余意义，**核心意图（进程与文件隔离）失效**。B 方案下 600 真正成立：`.env` 属主 = nodeapp，其他任何账号读不了。
>
> 结论：选 B 使 `.env` 的 600 权限（D1 问题 3）具有真实保护意义。
>
> **执行期修正（2026-08-11 块 D 前置实测，结论不变）**：「C（现有登录用户）在这台机器上等价 A（现在只有 root）」是**错误事实**。实测服务器有两个用户、两条通道：**root**（腾讯云网页终端 tat_agent 带外通道，无 SSH 授权 key——`/root/.ssh/authorized_keys` 不存在）与 **ubuntu**（SSH 密钥认证 `admin.pem`，`sudo -l` 显示 `NOPASSWD: ALL`；`/home/ubuntu/.ssh/authorized_keys` 存在、600、2026-08-10 写入）。「现在只有 root」错在把「网页终端会话是 root」当成「系统里只有一个用户」。root SSH 策略：按最小权限原则**不配置**，ubuntu + admin.pem 为 SSH 唯一通道，网页终端 root 仅作带外应急（修正后与问题 10 结论自洽）。
>
> 与 D1 问题 3 的联动：`.env` 属主 = nodeapp（运行用户），权限 600，`WorkingDirectory` 下部署单元根目录均归 nodeapp——见问题 11。

**问题 11（代码上机 / D2）**：代码怎么到服务器、放在哪？

需要覆盖：git clone 整仓还是只传 `week2-express/src/`；哪个分支 / commit；克隆到哪个目录、属主是谁（对齐问题 10）；仓库是公开还是私有——私有则服务器上需要凭据，那条凭据的策略是什么。

请结合第 2.3 节说明：部署单元根目录嵌套在第三层，对 `WorkingDirectory` 和 `.env` 落点的**具体**含义是什么。

> 答：四个子决策合集：
>
> 1. **传输方式 = git clone 整仓**。git 对部署的真正价值是追踪状态、回到某 commit、知道当前跑哪个版本；且 W8 前端 / W9 笔记同仓，随时可扩展展示功能（记 backlog，非 D2 主线）。
> 2. **跟踪 origin/main**（主线即生产）。更新 = `git pull` + 重载服务 + 跑 D1 验收接口复核。多分支 / preview / staging 属 W11 Jenkins 范畴，今天不做。**CI 不兜底**：D1 §2.5 已确认 CI 全绿对生产链路零证明力（测试走 memory-server），pull 后验证责任归本人。
> 3. **clone 到 `/home/nodeapp/nodejs-skillup`**（nodeapp 属主，对齐问题 10）。路径链三连：
>    - clone 根 = `/home/nodeapp/nodejs-skillup/`
>    - systemd `WorkingDirectory` = `/home/nodeapp/nodejs-skillup/week2-express/src/`
>    - `.env` 落点 = `/home/nodeapp/nodejs-skillup/week2-express/src/.env`
>    - 三者必须对齐，否则 `--env-file=.env` 读不到 → `JwtSecretConfigurationError` 而非「找不到 .env」（第 2.3 节）。
>    - 执行提醒：nodeapp 非登录用户，`/home/nodeapp` 需手动建（useradd -M 不建 home，则 mkdir + chown）——记入块 D 步骤 2。
> 4. **仓库公开 → 匿名 clone/pull，零凭据上服务器**。公开安全性前提成立：`.env` 被 .gitignore 忽略且从未提交；`root:example` 弱口令只在 `.env.example`（无害样例）。deploy key 知识当前用不到，属 backlog（转私有时再学）。
>
> 与问题 10 联动：整仓、代码目录、`.env` 均归 nodeapp；凭据策略最简（无凭据）。冲突自查：无冲突。

**问题 12（Node 运行时 / D2）**：装哪个 Node、用什么方式装？

硬约束见第 2.2 节：`--env-file` 需要 ≥ 20.6，`.nvmrc` 写 24，apt 自带版本大概率不够（待你在块 C 验证）。

请在候选方式（apt 自带 / NodeSource 源 / nvm / 官方二进制包）中选一个并说明理由。附带回答：**用 nvm 装的 Node，在 systemd 单元里为什么容易踩坑？** ——提示方向是「systemd 启动服务时不经过交互式 shell 的 profile」。这题要你说出 `ExecStart` 需要写成什么**形式**的路径，不是要你写单元文件。

> 答：**选 NodeSource（系统级 apt 源）**。理由：比较基准是「apt 管理的系统级升级 vs 自己手动换版本」，NodeSource 用 `apt update/upgrade` 统一管 Node 升级，比官方二进制包手动换更系统化。
>
> **淘汰 nvm 的三步推理**：
> 1. 「版本切换便利」是开发环境价值；生产价值是稳定可复现，D2 装好 v24 后几乎没有切换需求。
> 2. 「用户级」与问题 10 决策冲突：nodeapp 非登录（无 shell）无法交互执行 nvm install；root 代装后，装 `/root/.nvm` 则 nodeapp 读不了（/root 权限 700），装 `/home/nodeapp/.nvm` 则要 su 代跑、每步都绕。
> 3. systemd 不经过交互式 shell 的 profile：nvm 往 shell 启动文件注入脚本、把 nvm 的 node 铺进 PATH；systemd 不加载这些脚本 → PATH 里没有 nvm 的 node → `ExecStart` 写裸 `node` 找不到，**必须写绝对路径** `/.../.nvm/versions/node/v24.x/bin/node`。而绝对路径又撞上「nodeapp 读不了 /root」→ 两头堵。
>
> **NodeSource 为什么没这个坑**：node 落在系统级 `/usr/bin/node`，`/usr/bin` 天生在 systemd 默认 PATH 里，不需要任何「铺路」，`ExecStart` 直接写绝对路径就通。
>
> **版本子决策**：装 `.nvmrc` 声明的 **24**。生产固定版本与代码声明对齐，否则「代码说 24、服务器跑别的」本身破坏可复现性。装完验证：`node -v` 应显示 `v24.x.x`。
>
> 冲突自查：与问题 10（nodeapp）无冲突——NodeSource 系统级 node 不依赖任何用户 home。

**问题 13（依赖安装 / D2）**：`npm install` 还是 `npm ci`？带不带 devDependencies？

请结合两条事实作答：① `package-lock.json` 存在；② devDependencies 里的 `mongodb-memory-server` 安装时会下载一份 mongod 二进制。

再回答内存那一半：`bcrypt` 是原生模块，没有匹配的预编译二进制就要本地编译，而这台机器 **2 GB 内存、Swap = 0**。你打算**先验证什么**（怎么知道它到底编不编译）、**编译失败或 OOM 了怎么办**（回退方案是什么）？

> 答：两个设计点。
>
> **① 命令 = `npm ci --omit=dev`**。理由：生产装出的依赖必须和本地一致——`npm ci` 严格按 package-lock.json 装、不重新解析（可复现），如果允许不一样，本地测试通过到服务器依然报错；`--omit=dev` 跳过 devDependencies，其中 `mongodb-memory-server` 是测试专用、装它等于白下一个 mongod 二进制（生产不用）。
>
> **② bcrypt 内存探明动作**。机制：bcrypt 是原生模块，npm 安装时 node-pre-gyp 脚本先查「当前 Node 版本 + 平台 + arch」有没有预编译二进制——有则下载（node-pre-gyp http GET / download 字样，不吃内存），无则回退 node-gyp 本地编译（gyp / g++ / make 字样，编译期 fork 编译器，吃内存）。
>
> **探明动作（本人推出）**：在 `/tmp` 建临时目录，只装 bcrypt 一个包（`npm install bcrypt`），观察终端输出：
> - 看到 `node-pre-gyp http GET` / `download` → 走下载，不吃内存 ✅
> - 看到 `gyp` / `g++` / `make` → 走本地编译 ⚠️（需先装 build-essential + python3）
> - 用完删除临时目录，生产零残留。低风险来自：临时目录（不污染生产）+ 真走下载则不真编译（不吃内存）。这个机制靠「install 脚本由 npm 触发执行」「脚本查 registry 预编译产物」成立——这两个是我推导出的，不是抄答案。
>
> **编译失败 / OOM 回退方案**：预编译命中就不存在 OOM；若未命中需编译，正式 `npm ci` 前先确认 available 内存余量（块 C 实测 1450 MB），编译前先 `free -m` 观察，若不足则降级为「先装 build-essential 再试」或预留内存窗口。确切回退档位在块 D 执行时按实测内存决策（不预写验收证据）。
>
> 冲突自查：`--omit=dev` 与问题 12（NodeSource v24）无依赖冲突；与问题 9 选 A（装 Mongo）一致——生产不装 memory-server，真实 Mongo 由 D2 系统级安装提供。

**问题 14（防火墙落地顺序 / D2）**：这是今天第一个「做错就锁在门外」的动作。

按 D1 §5.2 端口表要放行 443 / 80 / 22。请写出**执行顺序**，并明确：`ufw enable` 之前必须已经成立的条件是什么？

另外，云控制台安全组和系统层 ufw 是两层（D1 §2.6.4）。今天你动**哪一层**、另一层保持什么状态？如果两层规则不一致，外部表现是什么（能区分出是哪一层拦的吗）？

> 答：两个设计点。
>
> **① 执行顺序与前置条件**：
> ```
> 前置：从本地新开的真 SSH 会话已连上（who 能看到自己 IP）——enable 后唯一能验证「还能不能连」的工具（网页终端带外通道不经 sshd，不能替代）
> → sudo ufw allow 22    （登记规则：enable 前 ufw status verbose 可查）
> → sudo ufw enable      （激活；有状态防火墙默认 ESTABLISHED,RELATED 放行——当前会话不断流可回滚，新连接被拒）
> → 验证：ufw status verbose 显示 active + 22/tcp ALLOW
> ```
> D4 再补 `sudo ufw allow 80` / `sudo ufw allow 443`（装好 Nginx、确认监听后增量放行，避免「服务没跑端口先通」）。
>
> **② 两层策略**：今天只动 UFW（操作系统层），云安全组**只读观察不做任何增删改**。当前 SSH 能连只能证明安全组「至少放行 22」，不能证明「只有 22」——需去腾讯云控制台确认原状（只读）。若确认云层不止 22：**不改云层**，UFW 内层默认 deny 兜底，非 22 端口在操作系统层被丢，风险受控在单层。
>
> - 如果两层不一致的外部表现：云层拦 → 包在到达服务器前丢（外部表现为连接超时，服务器 ufw 无日志）；UFW 拦 → 包到达服务器但被 INPUT 链丢（ufw 有 log 或 drop 计数）。能区分：云层拦则服务器侧 netstat/ufw 日志都看不到；UFW 拦则能看到 DROP 计数。
>
> 冲突自查：与问题 15（SSH 加固）共用「真 SSH 会话」验证通道；先做防火墙、后做 SSH 加固（笔记第 6 节步骤 3→4 已排序）。

**问题 15（SSH 加固 / D2）**：这是今天第二个「做错就锁在门外」的动作——禁用密码登录、仅密钥认证（`LEARNING-STATE.md` 风险 3 的兜底）。

这题问的**不是配置项名字**，而是验证方法：改完 sshd 配置、重载服务之后，**在断开当前这个会话之前**，你用什么方法确认新配置没有把自己锁死？请写出这个验证动作，以及它失败时你还剩什么补救手段。

> 答：三步验证框架（双会话 + 救生索 + 回滚链）。
>
> **步骤 1 准备（改配置前）**：本地笔记本开 Terminal 2（尚未发起连接）；Terminal 1（当前 SSH 会话）原地不动当**救生索**。
>
> **步骤 2 执行（Terminal 1 内）**：改 `/etc/ssh/sshd_config` 前先 `cp` 备份 → `sudo sshd -t` 语法检查（不过则**不 reload**，配置未生效，不算进入锁死步骤）→ `sudo systemctl reload sshd`（reload 不断当前会话）。
>
> **步骤 3 验证（两条新连接都过才算收工）**：
> 1. 服务器上 `ssh localhost` → 拿到可交互 shell（测新配置下认证是否通过）
> 2. 笔记本 Terminal 2 `ssh 公网IP` → 拿到可交互 shell（测完整链路：公网包 → 防火墙 → sshd 新配置）
>
> **验证分支**：
> - localhost 通 + 公网通 → 验证完毕，可关 Terminal 1
> - localhost 通 + 公网不通 → 配置已生效，网络层阻塞（防火墙/安全组），Terminal 1 活着可安全排查网络
> - localhost 不通 → 立即在 Terminal 1 回滚配置（cp 备份还原 → sshd -t → reload），验证阶段终止
>
> **补救链**：备份还原 → `sshd -t` → reload → Terminal 2 复测。极端情况（Terminal 1 也断）才走带外通道（腾讯云网页终端）——但验证的目的就是把风险前置到「Terminal 1 还活着」阶段解决。
>
> 冲突自查：与问题 14 共用「真 SSH 会话」存活前提；验证动作依赖「reload 不中断老连接」+「UFW ESTABLISHED 兜底」两个机制。

**问题 16（监听地址落地 / D2）**：D1 问题 4 决定绑 `127.0.0.1`，今天落地成代码改动（第 2.5 节）。

请决定：写死 `'127.0.0.1'`，还是读 `process.env.HOST` 并默认 `127.0.0.1`？

说明你的选择对三个场景各有什么影响：**本地开发**、**测试**（`__tests__` 走 supertest，不监听真实端口）、**生产**。附带回答：这个改动要不要回主仓进 git，还是只在服务器上改？（后者的代价是什么？）

> 答：两个设计点。
>
> **① 选 B——读 `process.env.HOST`，默认 `127.0.0.1`**（`const HOST = process.env.HOST || '127.0.0.1';` + `app.listen(PORT, HOST, ...)`）。生产行为与 A 完全一致（默认都绑 loopback），区别只在「谁能覆盖它」。
> - **本地开发**：会跑 `app.listen`，默认 127.0.0.1:3000 访问 localhost 正常；临时要手机/平板局域网调试可 `HOST=0.0.0.0` 启动，不改代码。
> - **测试**：不会跑 `app.listen`。证据：`__tests__/auth-flow.test.js:6` 是 `import app from '../app.js'`——supertest 直接加载 Express app 实例在内存中模拟请求，`app.listen` 在 server.js，测试链路零影响。
> - **生产**：默认绑 127.0.0.1，与 D4 Nginx 走 `127.0.0.1:3000` loopback 转发匹配；保留 `HOST=0.0.0.0` 逃生口，架构变化时运维可覆盖无需发版。
>
> **② 进 git（A）**。三层理由：① 单一真实来源——问题 11 服务器跟踪 origin/main、问题 9 明天验收跑真实请求，拉下来的代码必须就是最终跑的代码；只在服务器改会造成永久分叉、每次 pull 冲突、差异累积成不可复现黑盒。② 对主仓零副作用——本地连 localhost:3000 不受影响，且默认绑 loopback 本身就是对主仓的安全增强。③ 可复现性承诺——重装即拉代码即跑，无需回忆「当时手工改过哪行」。
>
> **执行路径**：本地改 server.js（方案 B）→ commit → push origin main → 服务器 git pull（干净合并）→ 验证默认绑定正常。
>
> 冲突自查：与问题 9（验收跑真实请求）一致；与问题 11（跟踪 main）靠「进 git」保证一致；与问题 14（Nginx 走 loopback）匹配。无冲突。

### 4.1 冲突自查

答完后逐条对照，确认没有互相矛盾。已知的易冲突组合：

- 问题 10 选 root ↔ 问题 11 的目录属主 ↔ D1 问题 3 的「600 权限」
- 问题 12 选 nvm ↔ systemd `ExecStart` 的路径形式
- 问题 9 选 B（不装 Mongo）↔ 问题 13 的 `npm ci` 是否需要 Mongo 相关依赖
- 问题 14 的执行顺序 ↔ 问题 15 的验证动作（两者都依赖「当前 SSH 会话不能断」）

> **自查结论（答完逐条对照）**：
> 1. 问题 10（nodeapp）↔ 问题 11（目录属主 nodeapp）↔ D1 问题 3（.env 600 归 nodeapp）：**自洽**——三者对齐同一运行用户，600 在 nodeapp 下真正成立。
> 2. 问题 12（NodeSource）↔ systemd `ExecStart`：**组合不涉及**——未选 nvm，无「绝对路径 + 用户 home」坑；NodeSource 系统级 /usr/bin 天生在 PATH。
> 3. 问题 9 选 A（装 Mongo）↔ 问题 13（`--omit=dev` 不装 memory-server）：**自洽**——生产用系统级安装的真实 Mongo，不装测试专用的 memory-server。
> 4. 问题 14（防火墙）↔ 问题 15（SSH 加固）：**自洽**——都依赖「真 SSH 会话」存活前提；步骤顺序 3→4 已定（先开防火墙再加固 SSH）。
> 5. 问题 14（今天 ufw 只放 22）↔ 问题 9 验收句（3000/27017 要能听）：**兼容**——验收句是「status running + 端口在听」两种观察都成立（`ss -tlnp` 从服务器内部看，不经防火墙 INPUT 链；对外不暴露，验证用 ssh localhost / curl 127.0.0.1）。
> 6. 问题 16（HOST 进 git）↔ 问题 11（跟踪 main）：**自洽**——走 git 流程保证服务器 = 主仓。
>
> **结论：无冲突，8 个答案可整体冻结，进入块 D。**

---

## 5. 服务器现状核对（块 C，只读，执行前填）

**先看现状，再动手改。** 以下全部是只读命令，不改变任何状态。

| 要核对的事 | 只读命令 | 我的预测 | 实际 | 偏差归因 |
|---|---|---|---|---|
| 当前监听的端口全集 | `ss -tlnp` | 只有 22（sshd）在监听，无其它服务 | `0.0.0.0:22` + `[::]:22`（sshd，IPv4/IPv6 双栈）；`127.0.0.53:53`（systemd-resolved） | 小偏差：53 = systemd-resolved 本地 DNS stub（loopback，Ubuntu 22.04 标配）。预测只算了公网服务，漏了本地系统服务；对块 D 无影响 |
| ufw 当前状态与规则 | `ufw status verbose` | inactive（Ubuntu 默认 + 当前 SSH 会话成立的约束） | `Status: inactive` | 无偏差 |
| apt 源里的 Node 版本 | `apt-cache policy nodejs` | candidate = 12.x 量级（Ubuntu 22.04 jammy 冻结） | `12.22.9~dfsg-1ubuntu3.6`（源：mirrors.tencentyun.com 腾讯云镜像） | 无偏差；另确认 apt 源为腾讯云镜像而非官方 archive.ubuntu.com |
| Node / npm 是否已存在 | `node -v; npm -v` | `command not found`（未装） | 两条均为 `command not found` | 无偏差 |
| 内存与 Swap 现状 | `free -m` | total 1931 / available ≈1468 / Swap = 0，与 D1 一致 | total 1931 / available **1450** / Swap 0（used 306 / free 286 / buff-cache 1338） | 近似命中：available 1450 vs D1 1468，差 18 MB。空载状态基本没变，属正常波动 |
| 磁盘可用 | `df -h` | 根分区可用 33–34G，变化 < 1G | `/dev/vda2` 40G，可用 **34G**（12%） | 无偏差，与 D1 完全一致 |
| 已有的 systemd 单元里有没有相关服务 | `systemctl list-units --type=service` | 只有基础服务，无 Node/业务服务 | 60 个 service，全为基础/云厂商服务，无 Node/业务 | 无偏差；新观察见下方差异清单 |

**「我的预测」必须在执行命令之前写。** 这一列是今天唯一能检验「D1 的契约是不是建立在真实认知上」的地方——例如你预测 `ss -tlnp` 只有 22，实际多出别的端口，那多出来的是什么、镜像自带的还是别人的，都要归因。

现状与 D1 §5.2 端口表的**差异清单**（填在这里，作为块 D 的输入）：

> 差异：
> - 53 在听但不在 D1 §5.2 端口表：systemd-resolved 本地 DNS stub（127.0.0.53，loopback），Ubuntu 22.04 标配，零外部暴露，无需处理。
> - 22 为双栈监听（`0.0.0.0:22` + `[::]:22`），与端口表「公网 0.0.0.0/0」一致。
> - 80/443/3000/27017 均未监听——符合预期（Node=D2、Mongo=D3、Nginx=D4 才装）。
> - 新事实 ①：`unattended-upgrades.service` 运行中——系统会**自动装安全更新**，「服务器无人动过」的说法要修正为「服务器会自己动」。
> - 新事实 ②：`tat_agent.service`（腾讯云云助手）——用户在**腾讯云控制台网页终端**执行命令，属带外通道；问题 14/15 的「锁死验证」必须基于**真 SSH 会话**（网页终端不经 sshd，验证不了 SSH 是否锁死）。
> - 新事实 ③：当前执行用户为 **root**（腾讯云初始 root）——直接输入问题 10。
> - **执行期修正（2026-08-11 块 D 前置）**：差异清单 ③ 的「当前执行用户为 root」指**网页终端（tat_agent 带外）会话**；SSH 通道默认用户是 **ubuntu**（SSH 密钥认证 admin.pem，`sudo -l` NOPASSWD: ALL）。两通道两用户并存——root 无 SSH authorized_keys、仅带外应急；ubuntu 是 SSH 唯一登录用户。另新事实：服务器内网 IP `10.8.0.5`（eth0，登录 Banner 可见），对块 D 无影响。

---

## 6. 执行序列（块 D，每步先答问题三连再动手）

顺序由第 4 节的答案决定，以下是**槽位**，不是命令清单。每个槽位动手之前，先在「三连」里写完三行；执行后立刻填「实际」与「偏差」。

问题三连（`LEARNING-PROTOCOL.md` 第 9 节）：

```text
① 要证明什么（这一步的验收是什么）
② 怎么验证（哪个命令 / 哪个系统状态能看到证据）
③ 失败的症状指向哪一环（先查哪里）
```

### 步骤槽位

| # | 动作 | 依赖的答案 | 可逆性 |
|---|---|---|---|
| 1 | 系统更新 | — | 可逆 |
| 2 | 建立运行身份（若问题 10 选专用用户） | 问题 10 | 可逆 |
| 3 | 防火墙放行 + 启用 | 问题 14 | **不可逆：错了断连** |
| 4 | SSH 加固（禁密码登录） | 问题 15 | **不可逆：错了断连** |
| 5 | 安装 Node 运行时 | 问题 12 | 可逆 |
| 6 | 代码上机 | 问题 11 | 可逆 |
| 7 | 安装依赖 | 问题 13 | 可逆（但可能 OOM，见问题 13） |
| 8 | 创建 `.env`（三个键，600，属主对齐问题 10） | D1 问题 3 + 问题 10 | 可逆 |
| 9 | 落地 `127.0.0.1` 绑定 | 问题 16 | 可逆 |
| 10 | 编写 systemd 单元（对齐 D1 问题 6 的七条契约） | 问题 9 + 10 + 11 + 12 | 可逆 |
| 11 | 按问题 9 的验收句验证 | 问题 9 | — |

**步骤 3 和 4 之间**建议留一个显式的「回到本地、新开一个终端重连一次」的动作——它是这两步唯一的真实验收，且必须在旧会话还活着的时候做。这属于验证方法，不是配置内容（问题 15 要你自己写出来）。

### 执行记录（滚动填写）

> 步骤 1（系统更新）：
> ① 要证明什么：系统基线从镜像态收敛到「已知良好、安全修复已生效」；apt 索引刷新且所有用户态包可升级到最新。
> ② 怎么验证：`apt update` 退出码 0 + 无 `Err:`/`Failed to fetch`；`apt upgrade` 汇总行 + EXIT=0；`apt list --upgradable | wc -l` 归零（除有意留项）。
> ③ 失败指向哪一环：按 网络/源 → 磁盘 → 依赖 → 内存 顺序定位；`curl -I http://mirrors.tencentyun.com` 测源、`df -h /` 测盘、`dmesg | tail` 测 OOM。
> —— 执行 ——
> 实际结果：
> - `apt update`：通过，113 packages can be upgraded（源 `mirrors.tencentyun.com`，Fetched 9,741 kB）
> - `apt upgrade -y`：**113 个包全部升级**（含 openssh-server、libc6、内核 meta 与二进制等）；期间遇到两个 debconf 交互：① sshd_config conffile 冲突 → **保留本地版本**（腾讯云镜像改过，覆盖会重置安全面）；② needrestart「daemons using outdated libraries」→ 接受默认勾选，重启 8 个系统服务（acpid/cron/polkit/udisks2 等，sshd 不在列表内）
> - 内核：`linux-image-5.15.0-187-generic 5.15.0-187.197` 装入，`/var/run/reboot-required` 存在
> - **重启**：`sudo reboot` → SSH 断开（预期）→ `ssh vps-skillup` 重连 → `uname -r = 5.15.0-187-generic` 新内核生效
> - 重启后 `/` 用量 11.4% → 13.5%；内存 13%；eth0 仍 10.8.0.5；Swap 0
> 与预测的偏差 / 归因：
> - **偏差 1（预测）**：预期「unattended-upgrades 已自动装安全更新，upgrade 列表很短」→ 实际 **113 个**。归因：`unattended-upgrades` 默认只自动升 jammy-security（安全）域，jammy-updates（普通修复）域攒着等手动——「服务器会自己动」只动安全域。
> - **偏差 2（AI 推断错误，已归因）**：AI 两次基于不完整输出做推断——① 从 `head -30` 截断误判「111 个已升 + 内核 held back」；② `echo $? = 0` 误当作 upgrade 退出码（实际是验证命令块的）。被 `apt list --upgradable | wc -l = 114` 直接推翻。**教训：证据不完整就说不完整，不补看似合理的解释**（违反 AGENTS.md「不确定性必须明确说不确定」）。
> - **偏差 3（决策修正）**：早期决策「有意跳过内核升级」的前提（内核不装）被 upgrade -y 实际行为推翻——113 包全部升级含内核。随后按正确判断重启：放不可逆步骤前、用现状通道 vps-skillup 验证。**重启决策流程事后证明正确**：重启前无 ufw/sshd 变更，重连成功排除一切配置干扰。
> - 新事实：腾讯云镜像的 openssh-server 触发 conffile 冲突（镜像改过 sshd_config），保留本地版是正确操作；needrestart 机制存在（自动检测旧库进程并询问重启）。
> - 步骤 1 结论：✅ 通过。系统基线收敛、新内核生效、SSH 通道重启后验证可用。

> 步骤 2（建立运行身份 nodeapp）：
> ① 要证明什么：专用非登录用户 nodeapp 存在（UID/GID 分配、shell 锁 nologin）；`/home/nodeapp` 属主 nodeapp:nodeapp、权限 750，为代码与 `.env` 提供隔离底座。
> ② 怎么验证：`getent passwd nodeapp` 第 6 列家目录、第 7 列 shell；`ls -ld /home/nodeapp` 属主/属组/权限位。
> ③ 失败指向哪一环：useradd 报错查 `id nodeapp`（已存在？）；mkdir 权限不足查 `/home` 父目录；chown 漏了则后续 `npm ci` 写 node_modules 直接 EACCES。
> —— 执行 ——
> 实际结果：
> - `sudo useradd -M -s /usr/sbin/nologin nodeapp` 静默成功
> - `sudo mkdir /home/nodeapp` + `sudo chown nodeapp:nodeapp /home/nodeapp` + `sudo chmod 750 /home/nodeapp` 静默成功
> - 验收：`getent passwd nodeapp` = `nodeapp:x:1002:1003::/home/nodeapp:/usr/sbin/nologin`（家目录 ✓、nologin ✓、UID/GID 1002/1003）
> - 验收：`ls -ld /home/nodeapp` = `drwxr-x--- 2 nodeapp nodeapp 4096 Aug 11 22:52 /home/nodeapp`（属主/属组 ✓、750 ✓）
> 与预测的偏差 / 归因：
> - 无偏差（符合三连预测）。小提醒：`useradd -M` 会用系统默认 UID/GID 起始值（ubuntu 占 1000/1001 后 nodeapp 得 1002/1003），UID 数值不重要，关键是 passwd 表与目录属主一致。
> - 过程偏差：验收命令最初在**执行前**跑了一次（输出为空 = 用户/目录还不存在），纠正为执行后验收——顺序是「执行 → 验收」，不是「验收 → 执行」。
> - 步骤 2 结论：✅ 通过。nodeapp 运行身份成立，与问题 10/11 冻结一致。

> 步骤 3（防火墙放行 + 启用，不可逆）：
> ① 要证明什么：防火墙按最小放行激活——入站默认拒绝，仅 22 双栈放行；SSH 会话在 enable 后仍可重连（不自锁）。
> ② 怎么验证：`sudo ufw status verbose` 显示 `Status: active` + `Default: deny (incoming)` + `22 ALLOW IN Anywhere` + `22 (v6) ALLOW IN Anywhere (v6)`。
> ③ 失败指向哪一环：enable 后 SSH 断 → 先看是否 22 规则漏登记（应 allow 后 enable）；当前会话活着说明 ESTABLISHED,RELATED 放行生效；重连失败查 ufw 规则 vs 云安全组两层。
> —— 执行 ——
> 实际结果：
> - `sudo ufw allow 22` → `Rules updated` + `Rules updated (v6)`（IPv4/IPv6 双栈登记，匹配 sshd 双栈监听）
> - `sudo ufw enable` → 确认提示 `Command may disrupt existing ssh connections. Proceed with operation (y|n)?` 输入 y → `Firewall is active and enabled on system startup`
> - `sudo ufw status verbose` → `Status: active`；`Default: deny (incoming), allow (outgoing), disabled (routed)`；`22 ALLOW IN Anywhere` + `22 (v6) ALLOW IN Anywhere (v6)`
> - 当前 SSH 会话未断（活证据：有状态防火墙放行已建立连接）
> 与预测的偏差 / 归因：
> - 无偏差：enable 确认提示的出现、规则双栈登记、status 输出全部符合问题 14 冻结预测。
> - 经验知识记录：`Proceed with operation (y|n)?` 是 ufw 激活前的标准确认（第一次见无法推导，已直接教）；`Logging: on (low)` 为新观察——ufw 默认开启低级别日志，对后续「云层 vs UFW 层」区分有帮助（UFW 拦的包会有 drop 日志）。
> - 待做（独立验证）：本地新开终端 `ssh vps-skillup` 重连一次——验证防火墙激活未锁死新连接（步骤 3↔4 之间的显式动作）。
> - 步骤 3 结论：✅ 通过（status active + 22 双栈放行 + 当前会话未断）。重连验证紧随其后。

> 步骤 4（SSH 加固，不可逆）：
> ① 要证明什么：SSH 仅密钥认证成立且 root 不通过 SSH 登录——`PermitRootLogin` 从 yes 改为 no，配置与事实（root 无 authorized_keys）对齐；新配置下公网完整链路密钥认证仍通。
> ② 怎么验证：① 主证据 `sudo sshd -T | grep -i permitrootlogin` = `permitrootlogin no`（合并 include 后的生效配置，不是源文件）；② 公网链路本地 `ssh vps-skillup 'echo PUBLIC_OK'` = PUBLIC_OK；③ 佐证 `ssh root@localhost` 被拒（附加，非主证据）。
> ③ 失败指向哪一环：`sshd -t` 不过 → 不 reload，配置未生效；reload 后公网连不上 → 先回滚备份 `/etc/ssh/sshd_config.bak.20260811` → `sshd -t` → reload。
> —— 执行 ——
> 实际结果：
> - 现状核对（grep 主文件 + sshd_config.d）：`PasswordAuthentication no` 已在 123 行生效（`ssh -v` 的 `publickey` 唯一认证即此）；`PermitRootLogin yes` 在 33 行（残余，与策略相悖）；sshd_config.d 为空
> - 决策：选 A（改 `PermitRootLogin no`），理由 = 配置即意图 + 纵深防御（root 禁 SSH 不依赖「无人写 authorized_keys」，而是配置层不可能）
> - 执行（问题 15 冻结框架）：`sudo cp` 备份 → `sudo sed -i 's/^PermitRootLogin yes/PermitRootLogin no/'` → `sudo sshd -t` 通过 → `sudo systemctl reload sshd`（当前会话未断）
> - 验证：
>   - `sudo sshd -T | grep -i permitrootlogin` = **`permitrootlogin no`**（主证据 ✅）
>   - 本地新终端 `ssh vps-skillup 'echo PUBLIC_OK'` = **PUBLIC_OK**（公网完整链路 ✅）
>   - `ssh ubuntu@localhost` = `Permission denied (publickey)`（见偏差 1）
>   - `ssh root@localhost` = `Permission denied (publickey)`（佐证，root 因无 key 被拒）
> 与预测的偏差 / 归因：
> - **偏差 1（验证框架前提缺失，经验知识）**：问题 15 冻结的「服务器上 `ssh localhost` → 可交互 shell」隐含假设「服务器有本机用户私钥」。真实环境（腾讯云镜像）`/home/ubuntu/.ssh/` 只有 authorized_keys、无私钥 → 客户端无 key 可提供 → 被拒。**这不是加固失败，反而是仅密钥严格性的佐证**（发起方自己都没私钥）。测试前提补记：`ssh localhost` 需要发起方本机持有私钥。
> - **偏差 2（命令手误）**：验证中把 `ssh` 打成 `sh` 两次（`sh ubuntu@localhost ...` → `cannot open ...: No such file`），重新用 `ssh` 执行。归因：命令敲错，非环境问题。
> - 经验知识记录：① `sshd -T` 输出合并 include 后生效配置（去注释、去默认值），是核对生效配置的正确工具；② first-connect host key 确认（`Are you sure you want to continue connecting (yes/no)?`）——指纹与公网 IP 相同（同一台服务器），输入 yes 安全。
> - 步骤 4 结论：✅ 通过（permitrootlogin no + PUBLIC_OK 公网链路 + 当前会话未断）。残留说明：root 无 key 被拒是既有事实，PermitRootLogin no 把它固化为配置。

> 步骤 5（安装 Node 运行时 NodeSource v24）：
> ① 要证明什么：Node 运行时为系统级安装、版本 24 主版本（对齐 .nvmrc）、路径在 systemd 可直接定位的系统目录。
> ② 怎么验证：`node -v` = v24.x；`npm -v` 配套版本；`which node` 验证绝对路径。
> ③ 失败指向哪一环：源加装失败（curl/签名）→ 先 `curl -I https://deb.nodesource.com` 测源可达，再看 setup 脚本尾部报错；装出旧版本（12.x）→ 检查是否混入 Ubuntu 默认源，`apt-cache policy nodejs` 看 Candidate。
> —— 执行 ——
> 实际结果：
> - `curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -` 无报错（加入 NodeSource 源 + 签名 key + apt update）
> - `sudo apt install -y nodejs` 无报错
> - 验收：`node -v` = **v24.19.0**；`npm -v` = **11.17.0**；`which node` = **/usr/bin/node**
> 与预测的偏差 / 归因：
> - 无偏差：版本 24、npm 配套、/usr/bin/node 全部命中三连预测。
> - 预测纠正（执行期）：初版三连写「/usr/bin/node 而非 /usr/local/bin」是想象出来的前提——NodeSource 包布局不预设，以 `which node` 实测为准；实测 /usr/bin/node，systemd 默认 PATH 可用。
> - 经验知识：`setup_24.x` 是 NodeSource 官方仓库接入脚本（写源 + 抓 key + update），不装包；装包是下一步 `apt install nodejs`。
> - 步骤 5 结论：✅ 通过。Node v24.19.0 系统级就绪，systemd `ExecStart` 用 `/usr/bin/node` 可直接定位。
> - **今日止步点（本人 2026-08-11 决策）**：D2 未全部完成，止步于步骤 5 收口；步骤 6–11 留待明日（clone 整仓 → npm ci → .env → HOST 落地 → systemd → 验收句）。

> 步骤 6：
> ① 要证明什么：……（待填）
> ② 怎么验证：……（待填）
> ③ 失败指向哪一环：……（待填）
> —— 执行 ——
> 实际结果：（待填）
> 与预测的偏差 / 归因：（待填）

---

## 7. 今日交付物

1. 第 4 节 8 个答案 + 4.1 冲突自查结论。
2. 第 5 节现状表（含预测列）+ 与 D1 端口表的差异清单。
3. 第 6 节执行记录：每步的问题三连、实际结果、偏差归因。
4. **systemd 单元文件（本人写）**，并逐条对照 D1 问题 6 的七条契约做自查表：自动拉起 / 退避 / `SIGTERM` / `TimeoutStopSec ≥ 30s` / 开机自启 / 日志去向 / 启动失败不无限重启。
5. **Node 进程实测内存**（`systemctl status` 或 `ps` 的 RSS）——这是 Swap = 0 风险第一次拿到真实数字，D3 加 MongoDB 之前必须有它。
6. D2 收口判定：按问题 9 写下的那一句话，答通过或不通过。

**不预写验收证据。** 上述 5、6 两项在执行前保持空白。

---

## 8. 明日入口（D3 预留，今天不填）

D2 收口后，D3 的第一个动作取决于问题 9 怎么答：选 A 则 D3 从「数据接通与读写验证」开始，选 B 则 D3 从「安装 MongoDB」开始。今天不预写。

---

## 9. AI 辅助记录

- 2026-08-11：AI 做了三件事——① 读 `week2-express/src/` 汇总第 2 节**事实**（代码阅读与 review）；② 起草第 4 节**提问**与第 6 节空槽位（L1）；③ 给出第 5 节的**只读**命令（工具层，白名单）。
- AI **没有**给出：验收定义（问题 9）、运行身份、上机路径、运行时选型、依赖策略、防火墙与 SSH 的执行顺序、监听地址落地形式、systemd 单元内容、任何执行记录或内存数字。这些是 W9 的可迁移核心，按 `week9-plan.md` 第 6 节由本人先作答。
- 第 2.1 节的「启动顺序悖论」是**代码事实的复述**（`server.js` 先 `connectDB()` 后 `listen()`，D1 §2.2 已记录），不是解法；问题 9 的两个候选方向属于选项枚举，未选定也未推荐。
- 援助级别 L1，未触及黑名单 L2，**不触发 `DEBT.md` 记账**。
- 按 D1 §8 的既定边界：systemd 单元、Nginx 配置等样板层若在决策冻结后给到 L3/L4，不记债；但拓扑与信任边界的推理若由 AI 给出骨架，必须按 `AGENTS.md` 第 5 节记账。

---

## 10. 追问记录（本人发起的基础知识追问，AI 裁定与解答）

按 2026-08-11 对话约定：问答之外的追问也回写笔记。裁定线 =「是否改变 D2 的某个答案或执行决策」，分主线内 / 主线边缘 / 与主线无关。

| 日期 | 追问内容 | 裁定 | 解答要点 / 与 D2 决策的关联 |
|---|---|---|---|
| 08-11 | 块 C 的 7 条是否内在关联、含哪些服务器基础知识、笔记预设我已知什么 | 主线内/边缘 | 7 条 = 3 组（网络面/运行时/宿主）+ 2 条推理链（端口溯源、运行时决策链）；每组的对照逻辑（ss vs ufw、node-v vs apt-cache vs free）是块 C 预测的前提；影响问题 12/13/14 决策输入 |
| 08-11 | `ss -tlnp` 是什么？ | 主线内 | `-t/-l/-n/-p` 四开关语义；输出字段（LISTEN、Local Address、Process）；服务面 vs 策略面区分；直接支撑块 C 第 1 条预测 |
| 08-11 | `apt-cache policy` 的「版本量级」是指什么？ | 主线内 | Installed / Candidate / Version table 语义；Ubuntu 源冻结保守版本 ≠ Node 官网 LTS；决定 apt 渠道淘汰，输入问题 12 |
| 08-11 | 问题 10 中 B（专用非登录用户）与 C（现有登录用户）的区别 | 主线内 | 判断标准 = shell 是否 nologin；B 无登录钥匙、只被 systemd 拿来跑服务；直接影响问题 10 的 A/B 决策 |
| 08-11 | `systemctl` 是活动监视器吗？ | 主线内 | systemctl = 管家 + 状态查询二合一（start/stop/enable/journalctl），活动监视器只「看」；「进程存在 ≠ 受守护」直接支撑问题 9 验收句落在 systemd 状态 |
| 08-11 | npm 装 bcrypt 内部发生了什么？ | 主线内 | node-pre-gyp 先查「Node 版本+平台+arch」预编译二进制：有→下载，无→node-gyp 编译（吃内存）；支撑问题 13 探明动作的机制基础 |
| 08-11 | 「GitHub 有 CI」是否算整仓 clone 的理由？ | 主线边缘 | 不算——CI 跑在 GitHub Actions 云端，clone 不带来 CI 能力；不改变问题 11 决策，仅修正理由表述 |
| 08-11 | deploy key 的生成/放置/权限能否说清？ | 主线边缘（记 backlog） | 当前仓库公开、零凭据方案用不到；转私有或 W11 时再学，不扩大当前范围 |

**欠债记账提示**：以上追问均以 AI 讲解原理 + 本人推导结论的方式完成，未给黑名单完整实现；按 `AGENTS.md` 第 5 节不触发 `DEBT.md` 记账。唯一需跟踪的是问题 9 选 A 欠下的「启动即失败契约 D3 人为故障补验」，已在问题 9 答案中记录。
