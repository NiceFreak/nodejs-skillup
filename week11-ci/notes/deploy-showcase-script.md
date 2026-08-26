# 展板发布脚本化：需求提出到实现的完整链路（W11 D3 附加项）

> 建立：2026-08-26（Asia/Shanghai）
> 状态：已实现并端到端验收（8081 已部署 8/25 后全部展板更新）
> 类型：W11 D3 附加项的专题记录；同时记录实现中暴露的四条既有事实修正

## 1. 需求提出与现状核对

**需求（2026-08-26，D3 收口后）**：发布前端全部手动 scp，机械且过时。问：当前 Jenkins Pipeline 服务哪个业务、展板重新构建发布是否在规划中。

**现状核对（仓库事实）**：

| 项 | 事实 | 来源 |
|---|---|---|
| Jenkins Pipeline 服务对象 | 仅后端 nodeapp（`week2-express/src`）；Deploy 阶段 = `ssh deploy <sha>` | `week11-ci/Jenkinsfile` |
| Q7 契约 | 部署单元只含后端源码 + lockfile；`dist-showcase` 在不动清单 | `day1-release-contract.md` Q7 |
| 展板发布规划 | 不在 W11 规划（Q7 拍板「默认不进」）；8/25 `release` tab 构建后未部署 | `week11-plan.md` §0.1 |
| 手工链路 | 本地 `VITE_SHOWCASE_ONLY=1` 构建 → scp `dist-showcase` → `/tmp` → `sudo -u nodeapp` rsync | W9 D4-c 步骤 4 |

## 2. 决策

- **展板 CI 接入**：W11 不做，记 backlog（需改 Q7 契约；D4 回滚演练主线优先）。
- **本轮范围**：本地脚本化消除机械操作；维持 Q7 不动；CI 接入留待 D4 验收后走正式变更单。
- **落盘通道**：方案① 服务器固定脚本 `showcase-land`（无参数、路径写死）+ sudoers 白名单一条。否决 rsync 直推（参数面宽、当前白名单无 rsync、sudo 需密码）。

## 3. 契约冻结（变更单四要素）

| 要素 | 内容 |
|---|---|
| 改动清单 | 本地脚本 `week8-fullstack/scripts/deploy-showcase-8081.sh`；服务器 `/usr/local/bin/showcase-land`；sudoers 追加一条 |
| 可证伪验证 | 端到端：8081 `/` 200 + asset 列表一致 + `POST /auth/login` 400 + 五面回归 |
| 回滚 | 删本地脚本；删 sudoers 条目；删 `/usr/local/bin/showcase-land` |
| 止步线 | 不碰 Nginx 配置/reload、证书、`.env`、`dist-admin443`、流水线、deploy-wrapper |

## 4. 实现与关键发现

**实现**：本地脚本（build → verify:board → 产物校验 → scp `/tmp` → showcase-land → 线上验证）；服务器 `showcase-land`（root:root 755，从 `/tmp/showcase-deploy` 落盘到 `dist-showcase`）；sudoers 追加第 9 条（写入 `/etc/sudoers.d/deploy-wrapper`）。

**关键发现（均经实测）**：

1. **SSH 入口**：`~/.ssh/config` 别名 `vps-skillup`（IdentityFile `admin.pem`）。直接 `ssh ubuntu@` 走默认 GitHub 密钥被拒。
2. **D3 收窄未完成**：`(ALL:ALL) ALL` 仍在（`%sudo` 组规则，ubuntu 仍在 sudo 组）；ubuntu 无 sudo 密码 → 白名单外 sudo（install/tee/visudo/rsync）实际不可用；白名单 8 条 NOPASSWD 是唯一可用提权通道。
3. **白名单落点**：`/etc/sudoers.d` 权限 `750 root:root` 普通用户不可读；文件名 `deploy-wrapper` 由 D3 笔记 + 目录 mtime 11:22 交叉定位，经 root 会话 `cat` 确认 8 条内容。
4. **bash 3.2 变量边界**：`$var（` 中全角括号首字节被吞进变量名 → `auth_code�: unbound variable`（macOS bash 3.2）。修复为 `${var}（`。
5. **`/auth` 路由过时记录**：后端 `routes/auth.js` 只有 `POST /auth/login`、`POST /auth/register`，无裸 `/auth`；W9 笔记「8081 POST /auth 400」过时或简写。正确判据 = `POST /auth/login` 400（后端直连与经 Nginx 均实测 400）。
6. **`$?` 测量陷阱**：`ssh host "cmd; echo rc=$?"` 双引号内 `$?` 被本地 shell 展开，测到的是本地退出码；须用单引号让其在远程展开。

## 5. 验证证据（2026-08-26 端到端，最后一次全绿）

```
✓ built in 2.38s
通过 868 项，失败 0 项        # verify:board
==> 产物校验                 # 标题 / 相对 ./assets/ / 无 Pages base 混入
==> sudo -n -u nodeapp /usr/local/bin/showcase-land
showcase-land: dist-showcase 已更新
8081 / = 200
asset 一致（3 个）
POST /auth = 400（门禁反代通）
==> 发布完成：http://43.128.154.242:8081
```

- 五面回归：80 / 443 / 8080 / 8081 全 200（发布后实测）。
- 服务器：白名单 9 条；`/tmp/showcase-deploy` 无残留；`showcase-land` root:root 755。
- 线上 8081 标题「Node.js Skillup · 学习展板」，含 8/25 后 `release` tab 更新。

## 6. 边界与遗留

| 项 | 状态 |
|---|---|
| rsync 替换 scp（仅 `/tmp` 中转段） | backlog；vite hashed assets 几乎每次全变，增量收益有限；macOS rsync 2.6.9 行为差异需先测 |
| verify:board 计数波动（793 → 868） | 循环断言按渲染元素数计数（`locator.count()`），硬条件为失败 0 项；波动机制待确认 |
| `(ALL:ALL) ALL` 收窄（`gpasswd -d ubuntu sudo`） | 待 root（LEARNING-STATE 已知遗留）；showcase-land 白名单已为收窄完成后准备 |
| 展板 CI 接入 | **已推进一步**：不接 Jenkins 的后端流水线，另起一个只管展板的 job，由手机远程触发。变更单见 [`change-order-showcase-remote-trigger.md`](./change-order-showcase-remote-trigger.md)，Jenkins 侧待执行。showcase-land 通道确实直接复用，未改一行 |
| W9 笔记「POST /auth 400」 | 需更正为 `/auth/login`；本次已在本文件记录事实 |

## 7. 延伸：异地触发（2026-08-26 当天续做）

脚本解决了「机械」，没解决「人不在开发机旁」。本人在手机上提出后续需求：发一条命令触发
「开发机拉最新 main → 构建 → 发布 8081」，且手机不持 `admin.pem`、不能在开发机上跑任意命令。

### 7.1 三条决定性事实（实测，先量后设计）

| # | 事实 | 怎么测的 | 砍掉了什么 |
|---|---|---|---|
| 1 | 开发机已有 Jenkins controller 在跑（轮询 + 凭据 + 出站方向），契约 Q3 明写「只有 Jenkins 持部署凭据」 | `day1-release-contract.md` §Q3/Q13、`Jenkinsfile` | 远程通道不用新建 |
| 2 | 仓库是 **public 且允许 fork** | GitHub API `search_repositories` | 砍掉 self-hosted runner 方案 |
| 3 | 手机侧 AI 会话的容器 **连不到 8081** | 容器内 `curl --max-time 12` → `code=000` | 砍掉「curl 线上自证成功」 |

第 3 条最容易漏。**本人手机浏览器能开 8081，AI 会话不能**——两者不是一回事，混为一谈就会
把「已触发」讲成「已发布」。它直接决定了链路必须有回执，而回执只能走 GitHub 回来。

### 7.2 方案与否决依据

| 方案 | 判定 |
|---|---|
| Jenkins 轮询一个触发分支 | **采纳** |
| GitHub Actions + 开发机 self-hosted runner | 否决：事实 2（fork PR 的 workflow 能在开发机上执行，而开发机有 `admin.pem`）；且推翻已冻结的 Q3 |
| 隧道直连（Tailscale / forced-command SSH） | 否决：手机侧会话跑在**临时云容器**里，把能进开发机的私钥放进会被回收的容器比放手机上更糟。与 D1 判 webhook 同源——隧道档的代价 |

### 7.3 这条链路的核心不变量：触发权 ≠ 内容权

pipeline 定义存在 Jenkins 里（不从触发分支读），构建内容固定取 `origin/main`。
于是**能写触发分支的人只能决定「什么时候发」，不能决定「发什么」**，也无法让开发机执行任意脚本。
推论是硬的：触发分支永远不放可执行文件、不放 Jenkinsfile、不放构建脚本。

选 inline pipeline 而不是 "Pipeline script from SCM" 就是为了守这条——
后者指向触发分支等于把 pipeline 的执行权交给「能写触发分支的人」，不变量当场作废。

### 7.4 写变更单时浮现的四个坑（都不是设计时想到的）

1. **回执自触发死循环**：push 回执 → 轮询到 → 再构建 → 再写回执。两道闸：`excludedRegions: 'receipts/.*'` + 闸门阶段发现回执已存在就 `NOT_BUILT`。
2. **`stage('拉 main')` 会把 main 混进轮询目标**——Jenkins 轮询的是「上次构建用过的所有 SCM」，于是每次 main 有提交都自动发布，这不是要的行为。改用裸 `git clone`（不进 SCM 登记）。
3. **浅克隆推不回 GitHub**：触发分支的 checkout 不能加 shallow，否则回执 push 被拒。

前三个坑的共同形态：**Jenkins 的轮询目标是由上一次构建的行为隐式决定的，不是由配置显式声明的。**
这与 D2 的 F8（launchd 的 PATH 不是登录 shell 的 PATH）同类——隐式继承来的状态。

4. **建孤儿分支不能在主工作区做**（起草后自查发现）：第一版脚本在主工作区
   `git checkout --orphan` 再清空目录，而清空会**连 gitignored 文件一起删**——
   `week2-express/src/.env`（`.gitignore:5` 命中，实测）、各处 `node_modules`、`dist-showcase`；
   收尾 `git checkout` 只恢复被跟踪的文件，`.env` 找不回来。改为在临时目录 `git init`
   一个新仓库（天然无历史 = 天然孤儿），全程不碰主工作区。

第 4 个与前三个不同源：前三个是隐式状态，它是**把破坏性操作放在了有价值的目录里**——
同一件事换个目录做就完全无风险。与权限速查表坑 #12（用错身份 clone 导致后续 EACCES）同型：
**错的不是命令，是执行位置。**

### 7.5 一条本轮才浮现的权限事实

回执要写回 GitHub，Jenkins 就需要 GitHub 写权限；而 **GitHub 没有「只能推某个分支」的凭据形态**
（deploy key 给了 write 就能推任意分支）。收窄只能靠给 `main` 开分支保护规则，把风险收在 main 上。

这与服务器侧那条形成对照：sudoers 能按「用户 + 单条命令」放行到极窄（第 9 条 `showcase-land`），
GitHub 侧做不到同样的粒度。**同一个「最小权限」目标，在两个系统里能达到的下限不一样。**

### 7.6 一条推翻了自己设计假设的实测

设计触发链路时的隐含假设是「手机侧会话没有工具链，所以只能触发、不能验证」。当天补测推翻了前半句：

| 项 | 结果 |
|---|---|
| `yarn install`（走代理拉 registry） | 通过，约 15 秒 |
| `yarn build:showcase` | 通过，`✓ built in 2.52s` |
| `yarn verify:board` | **868 / 868 通过**，与开发机同基线 |
| TCP 22 / TCP 8081 | **两个端口都不通**（超时） |

**要点是 `CHROMIUM_PATH`**：容器预装 chromium-1194，仓库的 playwright 要 1234，不指路直接报
`Executable doesn't exist`。`verify-w9-board.mjs` 本来就留了这个逃生口（第 152 行附近），
和 `PLAYWRIGHT_MODULE` 同类——**当初为「容器镜像预装、版本不同号」写的那条注释，这次正好被它自己命中。**

**结论要改的是分工，不是链路**：挡住远程发布的从来不是工具链，是**网络与凭据**。
于是远程会话的正确用法是「改内容 → 本地 build + `verify:board` 验到全绿 → 再触发发布」，
而不是「盲改 → 触发 → 等 5–8 分钟看回执报错」。断言在两侧各跑一次不是浪费：
本地那次省往返，Jenkins 那次才是发布判据。

### 7.7 本轮交付与待执行

已入库（手机侧会话完成）：手机侧 skill `trigger-showcase-deploy`、触发分支种子
`week11-ci/ops/showcase-deploy/`、孤儿分支创建脚本、变更单、以及给部署脚本加的
`SHOWCASE_SSH_OPTS`（默认空 → 本人手跑行为不变，Jenkins 用它带独立凭据）。

待执行（开发机侧）：建触发分支、建 Jenkins job、两个凭据、一个插件。**六条待拍板见变更单 §8**，
其中 D3（给不给 Jenkins GitHub 写权限）有明确的退化选项：不给 = 没有回执 = 放弃「可验证」。

## 8. 交付形态

**本地链路（§1–§6，已端到端验收）**

- 脚本：`week8-fullstack/scripts/deploy-showcase-8081.sh`（待 commit，由本人决定）。
- Skill：`.claude/skills/deploy-showcase-8081/SKILL.md`（项目内，会话可调用）。
- 落盘通道：服务器 `showcase-land` + sudoers 第 9 条。

**远程触发链路（§7，手机侧已入库，Jenkins 侧待执行）**

- Skill：`.claude/skills/trigger-showcase-deploy/SKILL.md`（只写信号、只读回执，不持任何服务器凭据）。
- 触发分支种子：`week11-ci/ops/showcase-deploy/`（README + 信号 + JSON Schema + 回执样例）。
- 建分支脚本：`week11-ci/ops/bootstrap-trigger-branch.sh`（孤儿分支，默认演练，`--push` 才推）。
- 变更单：[`change-order-showcase-remote-trigger.md`](./change-order-showcase-remote-trigger.md)（四要素 + inline pipeline + 9 条可证伪验证 + 6 条待拍板）。
- 脚本改动：`SHOWCASE_SSH_OPTS`（默认空，本人手跑行为不变）。
