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
| 展板 CI 接入 | backlog；showcase-land 通道可直接复用 |
| W9 笔记「POST /auth 400」 | 需更正为 `/auth/login`；本次已在本文件记录事实 |

## 7. 交付形态

- 脚本：`week8-fullstack/scripts/deploy-showcase-8081.sh`（待 commit，由本人决定）。
- Skill：`.claude/skills/deploy-showcase-8081/SKILL.md`（项目内，会话可调用）。
- 落盘通道：服务器 `showcase-land` + sudoers 第 9 条。
