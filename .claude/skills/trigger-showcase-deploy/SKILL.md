---
name: trigger-showcase-deploy
description: >-
  在手机（或任何没有开发机工具链的会话）上远程触发学习展板发布：往 GitHub 的
  ops/showcase-deploy 分支写一条触发信号，由开发机 Jenkins 轮询到后从 main
  构建并发布到 8081，再把回执写回 GitHub 供本会话读取。当用户在手机上说
  「触发展板部署」「远程发布展板」「让开发机构建并发布展板」时使用。
  本 skill 只写信号、只读回执，不构建、不持任何服务器凭据。
  在开发机本地直接发布请改用 deploy-showcase-8081。
---

# 远程触发学习展板发布（手机侧）

## 什么时候用本 skill，什么时候不用

| 场景 | 用哪个 |
|---|---|
| 会话在开发机（macOS）上，能跑 yarn / 有 `~/.ssh/admin.pem` | `deploy-showcase-8081`（直接本地构建发布） |
| 会话在手机 / 云容器：**能构建，但没有服务器凭据、网络也不通** | **本 skill** |
| 用户说「解冻 Pages」 | 都不是，见 `SHOWCASE-DEPLOY-PROTOCOL.md` §0 |

**判据只看一条**：`ssh -o BatchMode=yes vps-skillup true` 通不通。通 → 本地那条；不通 → 本 skill。

判据不看构建能力，因为**云容器是能构建的**（2026-08-26 实测，见下）。挡住发布的从来不是工具链，是网络与凭据。

## 触发前应该先在本会话里验一遍（实测可行）

远程会话跑得动完整的构建与展板断言。改完展板内容后**先验再触发**，能省掉一次 5–8 分钟的往返：

```bash
cd week8-fullstack/src/frontend
node .yarn/releases/yarn-3.2.0.cjs install          # 约 15s，走代理拉 registry
node .yarn/releases/yarn-3.2.0.cjs typecheck
node .yarn/releases/yarn-3.2.0.cjs build:showcase   # 约 2.5s
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node .yarn/releases/yarn-3.2.0.cjs verify:board
```

**`CHROMIUM_PATH` 是必须的**：容器预装的是 chromium-1194，而仓库的 playwright 要 1234，
不指路会报 `Executable doesn't exist`。**不要跑 `playwright install`**——容器里已有可用的 Chromium，
`verify-w9-board.mjs` 本来就留了这个逃生口。实测 **868/868 通过**（与开发机同基线）。

产物 `dist-showcase/` 在容器里只用于验证，**不是发布物**——发布物由 Jenkins 从 main 重新构建。

## 三条硬事实（决定了本 skill 的形状，别绕过）

1. **本会话连不到服务器。** 出站被网络策略挡住：**22 与 8081 两个端口实测都不通**
   （`curl http://43.128.154.242:8081/` 12s 超时 code=000；TCP 22 同样超时）。
   → **不要用 curl 验证线上**，会白等十几秒再得到一个「失败」的假象；**也别想着直接 ssh 发布**。
   用户自己的手机浏览器能打开 8081，但本会话不能——两者不是一回事。
2. **唯一的成功判据是回执文件**：`ops/showcase-deploy` 分支上的 `receipts/<requestId>.json`。
   没有回执 = 不能说「已发布」，只能说「已触发，回执未到」。
3. **触发权 ≠ 内容权。** 发布内容固定来自 `origin/main`。触发信号里没有「发哪个分支」这个选项，
   `targetRef` 恒为 `main`。用户要发功能分支的内容 → 先合进 main，不是改 trigger.json。

## 前置检查

```
mcp__github__list_branches (repo: NiceFreak/nodejs-skillup)
```

`ops/showcase-deploy` 不存在 → **停下**，告诉用户：触发分支还没建，需要在开发机上跑一次
`bash week11-ci/ops/bootstrap-trigger-branch.sh --push`。**本 skill 不创建分支**（少一份权限），也不要试图用 `create_branch` 代劳——从 main 建出来的分支会带全部源码历史，不是设计里的孤儿分支。

## 执行步骤

### 1. 取 main 当前 sha

```
mcp__github__list_commits (repo, sha: "main", perPage: 1)
```

记下完整 sha 和 sha7。顺手看一眼最新 commit 的标题，在最后汇报时告诉用户「这次发的是哪个提交」。

### 2. 组装 requestId

`<UTC 时间戳>-<main sha7>`，例如 `20260826T114500Z-2ac04d4`。
时间用 `date -u +%Y%m%dT%H%M%SZ` 取，别手编。

### 3. 覆盖 trigger.json

先读旧文件拿 blob sha（`create_or_update_file` 更新已有文件必须带 sha）：

```
mcp__github__get_file_contents (path: "trigger.json", ref: "ops/showcase-deploy")
mcp__github__create_or_update_file (
  path: "trigger.json", branch: "ops/showcase-deploy", sha: <旧 blob sha>,
  message: "trigger: 展板发布 <requestId>",
  content: <见下>)
```

内容按 `trigger.schema.json`：

```json
{
  "requestId": "20260826T114500Z-2ac04d4",
  "requestedAt": "2026-08-26T11:45:00Z",
  "requestedFrom": "mobile-claude-code",
  "targetRef": "main",
  "mainSha": "<40 位完整 sha>",
  "force": false,
  "note": "<用户这次要发什么，一句话>"
}
```

`force` 默认 `false`（main 相对上次成功发布没变就跳过）。只有用户明确说「重新发一次 / 强制重发」时才写 `true`。

### 3′. 没有 GitHub MCP 时的退路（纯 git）

本环境的 GitHub MCP 是托管提供的，正常都在。万一某个会话里没有，用 git 走同一条路——
会话的仓库是完整 clone，push 凭据也在位（本会话实测可推）。用 worktree 避免弄脏当前工作区：

```bash
git fetch origin ops/showcase-deploy
git worktree add --detach "$SCRATCH/trigger" origin/ops/showcase-deploy
# 在 $SCRATCH/trigger 里写 trigger.json
git -C "$SCRATCH/trigger" add trigger.json
git -C "$SCRATCH/trigger" commit -m "trigger: 展板发布 <requestId>"
git -C "$SCRATCH/trigger" push origin HEAD:refs/heads/ops/showcase-deploy
git worktree remove --force "$SCRATCH/trigger"
```

读回执同理：`git fetch origin ops/showcase-deploy` 之后
`git show origin/ops/showcase-deploy:receipts/<requestId>.json`。

**优先用 MCP**：单文件原子更新，不用 clone、不碰工作区、失败面更小。git 只是退路。

### 4. 等回执——不要用前台 sleep

前台 `sleep` 在本环境被禁用，`Monitor` 也用不上（它需要 shell 能访问 GitHub，本容器没有 gh CLI）。正确做法：

- 用 `mcp__claude-code-remote__send_later`（`delay_minutes: 3`）给自己排一次回查，最多排三次（+3 / +6 / +9 分钟）。
- 排完就**结束当前回合**，把「已触发，约 5–8 分钟后回执到达，我会回来看」告诉用户。轮询延迟 ≤5 分钟（Jenkins `pollSCM('H/5 * * * *')`）+ 构建约 1–2 分钟，所以 3 分钟内没回执是正常的，不是故障。
- 每次醒来读一次：`mcp__github__get_file_contents (path: "receipts/<requestId>.json", ref: "ops/showcase-deploy")`。

### 5. 判读回执并汇报

| `status` | 说什么 |
|---|---|
| `succeeded` | 已发布。列出 `checks` 三条判据的实际值（200 / asset 一致 N 个 / 400）和 `deployedSha`。 |
| `skipped` | **没发布**，因为 main 相对上次成功发布没变。问用户是否要 `force: true` 重发。 |
| `failed` | **没发布**。说清 `failedStep` 和 `evidence` 里的报错行，给下一步建议。别把「已触发」讲成「已发布」。 |
| 三次回查后仍无文件 | 说「回执未到」，最可能是开发机睡了 / Jenkins 没在跑 / 开发机断网。让用户确认开发机状态；触发信号留在分支上，开发机一醒就会执行。 |

汇报时**不要写「大概已经好了」**。`SHOWCASE-DEPLOY-PROTOCOL.md` §5 明确：源码已改 / 已触发 / 功能分支已推，都不等于部署完成。

## 边界

- 本 skill 只写 `ops/showcase-deploy` 分支上的 `trigger.json` 一个文件。不写 main、不写 receipts、不建分支、不删分支。
- 不碰 GitHub Pages（上传冻结中，见 `SHOWCASE-DEPLOY-PROTOCOL.md` §0）。
- 不碰 Q7 不动清单：Nginx 配置与 reload、证书、`.env`、`dist-admin443`、后端流水线、deploy-wrapper。
- 手机侧不持有 `admin.pem`、不持有任何服务器凭据、不能在开发机上执行任意命令。这是设计目标，不是限制——想改成能，先改变更单。
- 发布授权：**发出触发信号本身即为本人对这一次发布的授权**（信号带 requestId 且在 GitHub 上留痕）。这条是对 §4.5「发布是独立授权动作」在远程场景下的落地解释，改口径要同步改协议文件。

## 故障排查

| 现象 | 排查 |
|---|---|
| `create_or_update_file` 返回 409 / sha 冲突 | 旧 blob sha 过期（有人刚写过），重读 `trigger.json` 拿新 sha 再写 |
| 分支不存在 | 开发机跑 `bootstrap-trigger-branch.sh --push`，本 skill 不代劳 |
| 回执一直不来 | 按顺序查：开发机是否醒着 → Jenkins 服务是否在跑 → job 是否 enable → 轮询是否排除了 `receipts/.*`（没排除会自触发循环，见变更单 §4） |
| 回执 `failed` 且 `failedStep: verifyBoard` | 展板内容断言没过，是内容问题不是部署问题，回 main 修内容 |
| 回执 `checks` 字段值 | 每项应为单行断言（如 `8081 / = 200`），`evidence` 为多行数组；某字段为空不代表发布失败，以 `status` 和三条必查 checks（http200 / assetMatch / authLogin）为准 |
| 想在手机上看线上效果 | 让用户自己用手机浏览器开 `http://43.128.154.242:8081`（带登录门禁）。本会话 curl 不到，别试 |
