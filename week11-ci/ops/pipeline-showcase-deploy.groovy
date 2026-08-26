// pipeline-showcase-deploy.groovy
// showcase-deploy job 的 inline pipeline 权威来源（变更单 §5 的最终定稿版）。
// 变更单：week11-ci/notes/change-order-showcase-remote-trigger.md
// 最终版相对 §5 初稿的修复（2026-08-26 执行期，详见变更单 §9.2）：
//   C. (readJSON file: ...) -> (readJSON(file: ...))    括号内 command expression 编译失败
//   D. split('\\\\n') -> split('\\n')          转义层级错误，回执字段无法拆行
//   E. 读触发信号 stage 开头 sh 'rm -f deploy.log'       deploy.log 跨构建残留
//   B. 构建并发布 stage 加 install --immutable            干净克隆无 node_modules
// 2026-08-26 手机端到端实测后追加（详见变更单 §9.2-K）：
//   K. 移除 PathRestriction excludedRegions           它令轮询整个不工作，陷阱 1 改由二道闸独扛
// 使用：新建 Jenkins job -> Pipeline script -> 粘贴本文件内容（含 triggers 行）。

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
    DEPLOY_CRED    = 'showcase-deploy-key'      // 落服务器（D2 已拍板：新建展板专用密钥，不带 command=）
    RECEIPT_CRED   = 'github-ops-receipt-key'   // 推回执（D3 已拍板：仓库级 deploy key + write，main 已加保护）
  }

  stages {

    stage('读触发信号') {
      steps {
        sh 'rm -f deploy.log'   // 清理上次构建残留，避免 skipped/seed 回执混入旧证据（§9.2-E）
        dir('trigger') {
          checkout([
            $class: 'GitSCM',
            branches: [[name: "*/${TRIGGER_BRANCH}"]],
            userRemoteConfigs: [[url: env.REPO_SSH, credentialsId: env.RECEIPT_CRED]],
            extensions: [
              // 陷阱 1（回执自触发死循环）现在由**二道闸单独承担**：闸门阶段发现
              // receipts/<requestId>.json 已存在就 NOT_BUILT 且不写任何东西，
              // 于是「回执 push -> 轮询到 -> 起一次构建 -> duplicate -> 不写 -> 无新提交」，
              // 循环在一次空转后终止，代价是每次发布多一次 NOT_BUILT 构建。
              //
              // 原先这里挂 [$class: 'PathRestriction', excludedRegions: 'receipts/.*']，
              // 它把轮询切到「需要 workspace」的弃用路径（构建日志里的
              // The extension that requires a workspace for polling is deprecated），
              // 实测后果不是过滤更严，而是**轮询整个不工作**：2026-08-26 一次真实的
              // trigger.json 改动，在开发机醒着的 33 分钟里零构建（变更单 §9.2-K）。
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
            lastSha = (readJSON(file: 'trigger/receipts/LAST_SUCCESS.json')).deployedSha ?: ''
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
        // 陷阱 3 处理：裸 git clone 不进 SCM 登记 -> main 不会成为 pollSCM 轮询目标（§6 推荐方案）
        withCredentials([sshUserPrivateKey(credentialsId: env.RECEIPT_CRED, keyFileVariable: 'GH_KEY')]) {
          sh '''
            export GIT_SSH_COMMAND="ssh -i $GH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
            rm -rf src
            git clone --branch main --single-branch "$REPO_SSH" src
          '''
        }
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
              # 干净克隆没有 node_modules（.gitignore 忽略）-> 先按 lockfile 装依赖（§9.2-B）
              (cd week8-fullstack/src/frontend && node .yarn/releases/yarn-3.2.0.cjs install --immutable)
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
