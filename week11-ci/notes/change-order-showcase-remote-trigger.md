# 变更单：展板远程触发发布（手机 → GitHub → Jenkins → 8081）

> 建立：2026-08-26（Asia/Shanghai）
> 状态：**待执行**（手机侧已就绪；本单是开发机侧的执行清单）
> 类型：W11 D3 附加项的延伸——把「本地脚本化」延伸为「异地可触发」
> 前置：`week11-ci/notes/deploy-showcase-script.md`（脚本与落盘通道已端到端验收）

---

## 1. 要解决的问题

本人不在开发机旁、手机可能在任意网络时，需要发一条命令完成「拉最新 main → 构建展板 → 发布 8081」。三条约束：手机不持 `admin.pem` 也不能在开发机上跑任意命令；开发机在 NAT 后无公网入站；结果必须可验证而不是静默失败。

## 2. 三条决定性事实（方案选择的依据，2026-08-26 实测）

| # | 事实 | 怎么测的 | 影响 |
|---|---|---|---|
| 1 | 开发机已有 Jenkins controller 在跑，轮询 `origin/main`，持 `jenkins-deploy-key`；契约 Q3 明写「只有 Jenkins 持部署凭据，Actions 只读」 | `day1-release-contract.md` §Q3/Q13、`week11-ci/Jenkinsfile` | 远程通道**不用新建**，现成的出站轮询链路可复用 |
| 2 | 仓库是 **public 且 `allow_forking: true`** | GitHub API `search_repositories` 实测 | 否决 self-hosted runner 方案：fork PR 的 workflow 能在开发机上执行，而开发机 `~/.ssh` 有 `admin.pem` |
| 3 | 手机侧 Claude 会话的容器 **连不到 8081** | 容器内 `curl --max-time 12 http://43.128.154.242:8081/` → `code=000`，12s 超时 | 「手机侧自证部署成功」不能靠 curl 线上，**回执必须走 GitHub 回来** |
| 4 | **`jenkins-deploy-key` 复用不了**：它在 `~ubuntu/.ssh/authorized_keys` 里带 `command="/usr/local/bin/deploy-wrapper"` + `no-pty`，白名单只有 4 条正则（`deploy <sha>` / `rollback` / `mark-verified <sha>` / `verify`） | `day3-deploy-credentials.md` §3 P1 决策②、V2 越权验证实测（`echo hi` → `ERROR: Invalid command` RC=1） | 砍掉「复用后端部署密钥」这个看起来最省事的选项——**scp 尤其走不了**，它依赖在远端执行 `scp -t`，会被强制命令直接拦掉 |

事实 3 是最容易漏掉、也最容易造成「以为发了其实没发」的一条。本人手机浏览器能打开 8081（公网 IP），但 AI 会话不能——两者不是一回事。

## 3. 方案与取舍

| 方案 | 通道 | 否决/采纳 |
|---|---|---|
| **A. Jenkins 轮询触发分支** | 手机 push 信号到 `ops/showcase-deploy` → Jenkins 出站轮询 ≤5min → 从 `origin/main` 构建发布 → 回执 push 回 GitHub | **采纳** |
| B. GitHub Actions + 开发机 self-hosted runner | runner 长轮询 GitHub | 否决：事实 2（public + fork）；且推翻已冻结的 Q3「Actions 只读」。仓库若转私有并关 fork，B 更好，记 backlog |
| C. 隧道直连（Tailscale / forced-command SSH） | 手机 SSH 进开发机 | 否决：手机侧会话跑在**临时云容器**里，把能进开发机的私钥放进会被回收的容器比放手机上更糟；且要在开发机新装常驻隧道。与 D1 对 webhook 的判断同源——「隧道档的代价」 |

**A 的核心安全属性：触发权 ≠ 内容权。** pipeline 定义存在 Jenkins 里，不从触发分支读；构建内容固定取 `origin/main`。能写触发分支的人只能决定「什么时候发」，不能决定「发什么」，也无法让开发机执行任意脚本。

**A 的代价（两条，接受）**：≤5 分钟轮询延迟；开发机必须醒着。后者不会静默——回执超时会暴露它。

---

## 4. 变更单四要素

### 4.1 改动清单

| # | 位置 | 内容 | 状态 |
|---|---|---|---|
| 1 | `week8-fullstack/scripts/deploy-showcase-8081.sh` | 新增 `SHOWCASE_SSH_OPTS`（默认空 → 行为不变）+ `ssh_`/`scp_` 包装 | ✅ 本轮已改 |
| 2 | `.claude/skills/trigger-showcase-deploy/SKILL.md` | 手机侧 skill：写信号 + 读回执 | ✅ 本轮已加 |
| 3 | `week11-ci/ops/showcase-deploy/` | 触发分支种子（README / trigger.json / schema / 回执样例） | ✅ 本轮已加 |
| 4 | `week11-ci/ops/bootstrap-trigger-branch.sh` | 建孤儿分支 `ops/showcase-deploy`（临时目录 `git init`，不碰主工作区——见 §6 陷阱 4） | ✅ 本轮已加并演练通过，**待在开发机执行** |
| 5 | GitHub 分支 `ops/showcase-deploy` | 孤儿分支，只放信号与回执 | ⬜ 待执行（跑 #4） |
| 6 | Jenkins job `showcase-deploy` | inline pipeline，见 §5 | ⬜ 待执行 |
| 7 | Jenkins 凭据 `github-ops-receipt-key` | 推回执用的 GitHub 写权限凭据 | ⬜ **待拍板 D3** |
| 7b | 服务器 `~ubuntu/.ssh/authorized_keys` + Jenkins 凭据 `showcase-deploy-key` | **新建一把展板专用密钥**（不能复用 `jenkins-deploy-key`，见 §2 事实 4） | ⬜ **待拍板 D2** |
| 8 | Jenkins 插件 `Pipeline Utility Steps` | 提供 `readJSON` / `writeJSON` | ⬜ 待执行（一键装） |

**不含**：Nginx、证书、`.env`、`dist-admin443`、后端流水线（现有 Jenkinsfile 与本 job 互不影响）、`deploy-wrapper` sudoers（第 9 条已在位，本单不改）、GitHub Pages。

### 4.2 可证伪验证

按顺序，每条都有明确的期望值：

| # | 验证 | 期望 |
|---|---|---|
| 1 | 开发机 `bash week11-ci/ops/bootstrap-trigger-branch.sh`（演练模式） | 列出 5 个文件、提交数 1、不含任何可执行文件；`push --dry-run` 显示 `* [new branch]`；**跑完 `git status` 干净、`week2-express/src/.env` 仍在**（陷阱 4） |
| 2 | 加 `--push` 重跑；GitHub 上看 `ops/showcase-deploy` | 分支存在，**无源码历史**（`git log --oneline` 只有 1 条） |
| 3 | Jenkins job 手动 Build Now（此时 trigger.json 是全零种子） | 结果 `NOT_BUILT`，日志出现「种子占位信号，不发布」，**receipts/ 无新文件** |
| 4 | 手机上说「触发展板部署」 | ≤8 分钟内 `receipts/<requestId>.json` 出现，`status: succeeded` |
| 5 | 回执内容 | `checks.http200 = "200"`；`checks.assetMatch` 含「asset 一致」；`checks.authLogin = "400"`；`deployedSha` == 当时 main sha |
| 6 | **回执不自触发**（关键） | 回执 push 后 10 分钟内 Jenkins **不得**再起一次构建 |
| 7 | 立刻再触发一次（main 未变，`force: false`） | 回执 `status: skipped`，未发布 |
| 8 | `force: true` 再触发 | 回执 `status: succeeded`，重新发布 |
| 9 | 五面回归（本人浏览器） | 80 / 443 / 8080 / 8081 全 200 |

第 6 条不过 = 死循环，必须当场停 job 修 `excludedRegions`（见 §5 陷阱 1）。

### 4.3 回滚

逐项可逆，无破坏性操作：

1. Jenkins：禁用（Disable）job `showcase-deploy`；确认后删除。
2. 凭据：删除 `github-ops-receipt-key`；在 GitHub 仓库 Settings → Deploy keys 删除对应公钥。
   删除 `showcase-deploy-key`；从 `~ubuntu/.ssh/authorized_keys` 删掉对应那一行（**改动前先备份该文件**，与 D3 装部署公钥时同一条纪律）。删除后用旧私钥 `ssh` 应被拒（Permission denied）。
3. 分支：`git push origin --delete ops/showcase-deploy`（回执随之消失，如需留档先 `git fetch` 到本地）。
4. 脚本：`SHOWCASE_SSH_OPTS` 默认空，**不回滚也不影响本人手跑**；如需彻底回退，`git revert` 改动 #1。
5. skill：删 `.claude/skills/trigger-showcase-deploy/`。

回滚后的验证：本人在开发机手跑 `bash week8-fullstack/scripts/deploy-showcase-8081.sh` 仍全绿。

### 4.4 止步线

- 不碰 Nginx 配置与 reload、证书、`.env`、`dist-admin443`、后端流水线、`deploy-wrapper`。
- 不开任何公网入站端口，不装隧道/内网穿透。
- 不给手机侧任何服务器凭据。
- 不解冻 GitHub Pages。
- Jenkins 的 GitHub 凭据**只用于推 `ops/showcase-deploy`**；pipeline 里不得出现推 main 的语句。
- 出现任何一条与本单描述不符的现象（尤其第 6 条自触发）→ 停下，不要「先跑着再说」。

---

## 5. Jenkins job：inline pipeline

**新建方式**：Jenkins → New Item → Pipeline，名 `showcase-deploy`，Definition 选 **Pipeline script**（**不要**选 "Pipeline script from SCM"）。

> **为什么必须 inline**：选 from SCM 且指向触发分支，等于把 pipeline 的执行权交给「能写触发分支的人」——那就把「触发权 ≠ 内容权」这条不变量作废了。inline 之后触发分支纯粹是数据。

```groovy
pipeline {
  agent { label 'controller' }

  options {
    disableConcurrentBuilds()
    timeout(time: 20, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '50'))
  }

  triggers { pollSCM('H/5 * * * *') }

  environment {
    // launchd 拉起的 Jenkins PATH 不含 brew（D2 的 F8）；node 是 vendored yarn 的运行时
    PATH           = "/opt/homebrew/bin:/usr/local/bin:${PATH}"
    REPO_SSH       = 'git@github.com:NiceFreak/nodejs-skillup.git'
    TRIGGER_BRANCH = 'ops/showcase-deploy'
    SERVER_IP      = '43.128.154.242'
    DEPLOY_CRED    = 'showcase-deploy-key'      // 落服务器（待拍板 D2；**不能用 jenkins-deploy-key**，见 §2 事实 4）
    RECEIPT_CRED   = 'github-ops-receipt-key'   // 推回执（待拍板 D3）
  }

  stages {

    stage('读触发信号') {
      steps {
        dir('trigger') {
          checkout([
            $class: 'GitSCM',
            branches: [[name: "*/${TRIGGER_BRANCH}"]],
            userRemoteConfigs: [[url: env.REPO_SSH, credentialsId: env.RECEIPT_CRED]],
            extensions: [
              // 陷阱 1：回执 commit 不得再次触发轮询，否则 push 回执 → 轮询到 → 再构建 → 死循环
              [$class: 'PathRestriction', excludedRegions: 'receipts/.*'],
              [$class: 'CleanBeforeCheckout']
              // 陷阱 2：这里**不要**加 shallow clone —— 浅克隆推回 GitHub 会被拒
            ]
          ])
        }
        script {
          def t = readJSON file: 'trigger/trigger.json'
          env.REQ_ID    = t.requestId ?: ''
          env.REQ_FORCE = ((t.force ?: false) as Boolean).toString()
          env.REQ_NOTE  = t.note ?: ''
          env.SKIP      = ''
          env.STATUS    = ''

          if (env.REQ_ID.startsWith('00000000T')) {
            env.SKIP = 'seed'          // 种子占位，从不发布
          } else if (fileExists("trigger/receipts/${env.REQ_ID}.json")) {
            env.SKIP = 'duplicate'     // 陷阱 1 的第二道闸：已处理过就不再处理
          }
          // 用 shell 取时间：java.util.Date / TimeZone 在 Jenkins 脚本沙箱里要走审批
          env.STARTED_AT = sh(returnStdout: true, script: 'date -u +%Y-%m-%dT%H:%M:%SZ').trim()
          echo "requestId=${env.REQ_ID} force=${env.REQ_FORCE} skip=${env.SKIP ?: 'no'}"
        }
      }
    }

    stage('幂等判断') {
      when { expression { env.SKIP == '' } }
      steps {
        script {
          // 信任边界：main 的 sha 由 Jenkins 自己解析，不采信 trigger.json 里的 mainSha
          // （ls-remote 走 SSH，必须带凭据，否则报 Permission denied (publickey)）
          withCredentials([sshUserPrivateKey(credentialsId: env.RECEIPT_CRED, keyFileVariable: 'GH_KEY')]) {
            env.MAIN_SHA = sh(returnStdout: true, script: '''
              export GIT_SSH_COMMAND="ssh -i $GH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
              git ls-remote "$REPO_SSH" refs/heads/main | cut -f1
            ''').trim()
          }
          def lastSha = ''
          if (fileExists('trigger/receipts/LAST_SUCCESS.json')) {
            lastSha = (readJSON file: 'trigger/receipts/LAST_SUCCESS.json').deployedSha ?: ''
          }
          if (env.REQ_FORCE != 'true' && env.MAIN_SHA == lastSha) {
            env.SKIP   = 'unchanged'
            env.STATUS = 'skipped'
          }
          echo "main=${env.MAIN_SHA} lastSuccess=${lastSha} skip=${env.SKIP ?: 'no'}"
        }
      }
    }

    stage('拉 main') {
      when { expression { env.SKIP == '' } }
      steps {
        dir('src') {
          checkout([
            $class: 'GitSCM',
            branches: [[name: 'main']],
            userRemoteConfigs: [[url: env.REPO_SSH, credentialsId: env.RECEIPT_CRED]],
            extensions: [[$class: 'CleanBeforeCheckout']]
          ])
        }
        // 陷阱 3：上面这个 checkout 不能进轮询目标，否则每次 main 有提交都会自动发布
        //         —— 声明式 checkout 无 poll 开关，故用 job 配置里的
        //         "Additional Behaviours → Polling ignores commits in certain paths" 兜不住跨 SCM，
        //         正确做法见 §6「陷阱 3 的处理」，必须照做后再启用 pollSCM。
      }
    }

    stage('构建并发布') {
      when { expression { env.SKIP == '' } }
      steps {
        withCredentials([sshUserPrivateKey(
            credentialsId: env.DEPLOY_CRED,
            keyFileVariable: 'DEPLOY_KEYFILE',
            usernameVariable: 'DEPLOY_USER')]) {
          dir('src') {
            sh '''
              set -o pipefail
              export SHOWCASE_SSH_TARGET="${DEPLOY_USER}@${SERVER_IP}"
              export SHOWCASE_SSH_OPTS="-i ${DEPLOY_KEYFILE} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
              bash week8-fullstack/scripts/deploy-showcase-8081.sh --yes 2>&1 | tee ../deploy.log
            '''
          }
        }
        script { env.STATUS = 'succeeded' }
      }
    }
  }

  post {
    always {
      script {
        if (env.SKIP == 'seed' || env.SKIP == 'duplicate') {
          currentBuild.result = 'NOT_BUILT'
          echo "跳过且不写回执：${env.SKIP}"
          return
        }
        if (!env.STATUS) { env.STATUS = 'failed' }

        // 回执证据走**白名单**，不是日志 tail —— 只收这几行已知格式的断言输出，
        // 天然排除绝对路径、主机名和任何未来可能出现的敏感串（拍板 D4）
        def ev = ''
        if (fileExists('deploy.log')) {
          ev = sh(returnStdout: true, script: '''
            grep -aE '^(✓ built in |通过 [0-9]+ 项，失败 [0-9]+ 项|==> |8081 / = |asset 一致（|POST /auth = |缺少 |assets 为空|asset 不一致|index\\.html )' deploy.log | tail -40 || true
          ''').trim()
        }
        def lines = ev ? ev.split('\\n') as List : []

        def pick = { pat -> lines.find { it =~ pat } ?: '' }
        def receipt = [
          requestId  : env.REQ_ID,
          status     : env.STATUS,
          jenkinsBuild: env.BUILD_NUMBER as Integer,
          startedAt  : env.STARTED_AT,
          finishedAt : sh(returnStdout: true, script: 'date -u +%Y-%m-%dT%H:%M:%SZ').trim(),
          deployedSha: (env.STATUS == 'succeeded' ? env.MAIN_SHA : null),
          failedStep : (env.STATUS == 'failed'
                        ? (pick(/通过 .* 失败/) ? (pick(/8081 \/ = /) ? 'onlineVerify' : 'deploy') : 'build')
                        : null),
          checks     : [
            buildShowcase: pick(/built in/),
            verifyBoard  : pick(/失败 [0-9]+ 项/),
            http200      : pick(/8081 \/ = /),
            assetMatch   : pick(/asset /),
            authLogin    : pick(/POST \/auth = /)
          ],
          evidence   : lines,
          note       : env.REQ_NOTE
        ]

        dir('trigger') {
          writeJSON file: "receipts/${env.REQ_ID}.json", json: receipt, pretty: 2
          if (env.STATUS == 'succeeded') {
            writeJSON file: 'receipts/LAST_SUCCESS.json', json: receipt, pretty: 2
          }
          withCredentials([sshUserPrivateKey(credentialsId: env.RECEIPT_CRED, keyFileVariable: 'GH_KEY')]) {
            sh '''
              export GIT_SSH_COMMAND="ssh -i $GH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
              git config user.email "jenkins@local"
              git config user.name  "jenkins-showcase-deploy"
              git add receipts/
              git commit -m "receipt: ${REQ_ID} ${STATUS}" || exit 0
              git push origin HEAD:refs/heads/${TRIGGER_BRANCH}
            '''
          }
        }
      }
    }
  }
}
```

---

## 6. 四个必须照做的陷阱

**陷阱 1｜回执自触发死循环。** 回执 push 回触发分支 → 轮询发现新提交 → 再构建 → 再写回执。两道闸都要在：① `PathRestriction excludedRegions: 'receipts/.*'`；② 闸门阶段发现 `receipts/<requestId>.json` 已存在就 `NOT_BUILT` 且不写任何东西。**验证 §4.2 第 6 条就是查这个。**

**陷阱 2｜浅克隆推不回去。** 触发分支是孤儿分支、体积极小，不要为省时间加 `CloneOption shallow`——从浅克隆 push 会被 GitHub 拒。

**陷阱 3｜main 的 checkout 混进轮询目标。** Jenkins 的 `pollSCM` 会轮询「上次构建里用过的所有 SCM」。`stage('拉 main')` 里的 checkout 会让 main 也变成轮询目标 → **每次 main 有提交都自动发布**，这不是本单要的行为。处理方式二选一：

- **推荐**：把拉 main 改成不经 `checkout` 步骤的裸 git（不进 SCM 登记）：
  ```groovy
  sh "rm -rf src && git clone --branch main --single-branch ${env.REPO_SSH} src"
  ```
  （凭据用 `withCredentials` + `GIT_SSH_COMMAND` 包住，与回执 push 同一把钥匙。）
- 备选：保留 `checkout` 但在 job 配置里给 main 那个 SCM 加 `Don't trigger a build on commit notifications`，并实测「main 推一个空提交 → 10 分钟内不起构建」。

**没验过陷阱 3 之前不要启用 `pollSCM`**，先用 Build Now 手动跑通。

**陷阱 4｜建孤儿分支不能在主工作区做（本单起草后发现，已修）。**
第一版 `bootstrap-trigger-branch.sh` 在主工作区 `git checkout --orphan` 之后清空目录再铺种子。
清空用的是 `find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +`，**它连 gitignored 文件一起删**——
`week2-express/src/.env`（`.gitignore:5` 命中，实测）、各处 `node_modules`、`dist-showcase`。
而收尾的 `git checkout <原分支>` 只恢复**被跟踪**的文件，`.env` 找不回来。

改法是不碰主工作区：在临时目录 `git init` 一个全新仓库（**天然无历史 = 天然孤儿**），
铺种子、提交、`git remote add origin` 指过来推分支，用完删临时目录。

这个坑的形态与陷阱 1–3 不同：那三个是「Jenkins 的隐式状态」，这个是
**「把破坏性操作放在了有价值的目录里」**——同一件事换个目录做就完全无风险。
与权限速查表坑 #12（用错身份 clone 导致后续 EACCES）同源：错的不是命令，是执行位置。

---

## 7. 执行顺序（照着做）

1. Jenkins 装插件 `Pipeline Utility Steps`（`readJSON`/`writeJSON` 靠它）。
2. 拍板 D2 / D3（见 §8），准备好两个凭据：
   - `showcase-deploy-key`：本机生成新密钥对 → 公钥追加到 `~ubuntu/.ssh/authorized_keys`（**不带 `command=`**，与部署密钥那一行分开）→ 私钥存 Jenkins Credentials Store。
   - `github-ops-receipt-key`：GitHub 仓库 Settings → Deploy keys，**勾选 Allow write access** → 私钥存 Jenkins。装好先跑 `git push --dry-run` 对 main，期望被分支保护拒绝。
3. 开发机跑 `bash week11-ci/ops/bootstrap-trigger-branch.sh`（演练）→ 看清单 → `--push`。
4. 新建 job `showcase-deploy`，粘 §5 pipeline，**先注释掉 `triggers { pollSCM(...) }`**，按 §6 陷阱 3 改好拉 main 的方式。
5. Build Now（种子信号）→ 期望 `NOT_BUILT`、无回执（验证 §4.2 第 3 条）。
6. 手工在触发分支写一条真实 `trigger.json` → Build Now → 期望回执 `succeeded`（第 4、5 条）。
7. 打开 `pollSCM`，观察 10 分钟确认不自触发（第 6 条）。
8. 手机上说「触发展板部署」跑一次端到端；再跑一次验幂等（第 7 条）、`force` 一次（第 8 条）。
9. 五面回归（第 9 条），回填结果到本文件 §9。

## 8. 待拍板（6 条，D3 是本轮新浮现的）

| # | 决策 | 建议 |
|---|---|---|
| D1 | 手机发出触发信号是否即为发布授权（`--yes` 绕过了「本人回车」） | 认定为是——信号带 requestId 且在 GitHub 留痕，比回车更可审计。但要把这条写进 `SHOWCASE-DEPLOY-PROTOCOL.md` §4.5，不默许 |
| D2 | 落服务器用哪把钥匙。**「复用 `jenkins-deploy-key`」已被 §2 事实 4 排除**（强制命令白名单只有 4 条，`scp` 与 `sudo showcase-land` 全被拦）。剩三个：**A** 沿用本人 `admin.pem`（脚本默认路径，零改动）／**B** 新建展板专用密钥、裸装无 `command=`／**C** 新建密钥 + 再写一个 `showcase-wrapper` 强制命令（2 条白名单）+ 传输由 `scp` 改 `tar over ssh` | **选 B**。A 等于把个人全权密钥交给 Jenkins，而 B 的成本只是「生成一把密钥 + `authorized_keys` 加一行」，买到独立吊销与审计区分。C 是最小权限正解、与 D3 的 wrapper 形态同构，但它的收益在当前威胁模型下兑现不了——这把密钥和 `admin.pem` 存在同一台机器、同一个用户可读，开发机被攻破时攻击者直接读 `admin.pem` 即可。**C 的收益要等 `admin.pem` 自身也收窄之后才成立**，记 backlog 并写清升级路径 |
| D3 | **Jenkins 需要 GitHub 写权限才能推回执。** GitHub 没有「只能推某个分支」的凭据形态：deploy key（write）可推任意分支 | 用**仓库级 deploy key with write access**（比账号级 PAT 窄：只此仓库、无过期维护、不牵连账号其他仓库），并给 `main` 开分支保护规则把风险收在 main 上。**这条别停在假设**——装好后拿它对 main 跑一次 `git push --dry-run`，期望被规则拒绝；拒绝了才算收窄成立，这是本条的可证伪验证 |
| D3′ | 若不给 Jenkins 写权限 | 退化方案：无回执。手机侧只能报「已触发」，验证靠本人手机浏览器开 8081 + Jenkins 通知。**这等于放弃「可验证」这条目标**，我不建议 |
| D4 | 回执写进公开仓库的内容 | 已按白名单实现（只收固定格式的断言行），不做日志 tail。确认这个口径 |
| D5 | main 未变时是否重复发布 | 默认幂等跳过，`force: true` 强制。已实现 |
| D6 | 开发机需常开不休眠（睡了 = 触发无效，回执超时暴露） | 需要你点头改电源设置或跑 `caffeinate`。不属 Q7 不动清单，但是改你自己机器的状态 |

## 9. 执行结果回填

> 执行后在此记录：每条验证的实际输出、遇到的偏差、以及 §6 三个陷阱的实测表现。
> 未回填前，本单状态保持「待执行」。
