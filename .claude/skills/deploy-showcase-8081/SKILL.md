---
name: deploy-showcase-8081
description: >-
  把学习展板构建并发布到自建服务器 8081 的本地脚本入口。当用户说「更新 / 构建 /
  发布学习展板」「部署展板到 8081」「发布复习页」时使用。调用
  week8-fullstack/scripts/deploy-showcase-8081.sh 完成 构建 → verify:board →
  产物校验 → 落盘 → 线上验证 全流程；不触碰 GitHub Pages（上传冻结中）。
---

# 学习展板发布（服务器 8081）

## 用途

把 `week8-fullstack/src/frontend` 的学习展板构建并发布到
`http://43.128.154.242:8081`（`shop-showcase` 站点，`dist-showcase/`，带登录门禁）。
发布目标固定 8081；GitHub Pages 上传处于冻结状态（`SHOWCASE-DEPLOY-PROTOCOL.md` §0），
本 skill 不承接 Pages。

## 前置条件

1. 本地脚本 `week8-fullstack/scripts/deploy-showcase-8081.sh`（若尚未入库，先提交）。
2. 服务器落盘通道已建：
   - `/usr/local/bin/showcase-land`（root:root 755，从 `/tmp/showcase-deploy` 落盘到 `dist-showcase`）
   - sudoers 白名单含 `ubuntu ALL=(nodeapp) NOPASSWD: /usr/local/bin/showcase-land`
     （位于 `/etc/sudoers.d/deploy-wrapper`，共 9 条）
3. SSH：`~/.ssh/config` 别名 `vps-skillup`（HostName `43.128.154.242`，IdentityFile `admin.pem`）。
   直接 `ssh ubuntu@43.128.154.242` 会走默认 GitHub 密钥被拒（Permission denied publickey）。
4. 构建：vendored yarn（`week8-fullstack/src/frontend/.yarn/releases/yarn-3.2.0.cjs`）。

## 执行步骤

```bash
cd /Users/nezha/Documents/nodejs-skillup
bash week8-fullstack/scripts/deploy-showcase-8081.sh
```

脚本自动完成：

1. 前置检查（SSH 可达、`showcase-land` 存在）
2. `build:showcase`（`VITE_SHOWCASE_ONLY=1`，8081 用空 base）
3. `verify:board`（展板内容断言，失败 0 项才算过）
4. 产物校验（标题「Node.js Skillup · 学习展板」/ 相对 `./assets/` / 无 Pages base 混入）
5. 发布授权确认（**回车默认发布**，输入 `n` 取消）
6. scp → 服务器 `/tmp/showcase-deploy`
7. `sudo -n -u nodeapp /usr/local/bin/showcase-land` 落盘
8. 线上验证：8081 `/` 200 + asset 列表与本地一致 + `POST /auth/login` 400
9. 清理服务器暂存

## 边界

- 发布目标固定 8081；不解冻 GitHub Pages（解冻须用户显式声明，见 `SHOWCASE-DEPLOY-PROTOCOL.md`）。
- 不碰 Q7 不动清单：Nginx 配置与 reload、证书、`.env`、`dist-admin443`、流水线、deploy-wrapper。
- 发布是独立授权动作：脚本的交互确认由本人按下回车即视为授权；skill 不自动代表发布。
- `--no-deploy`：只做本地构建与校验，不发布。
- `--yes`：跳过交互确认。

## 故障排查

| 现象 | 排查 |
|---|---|
| `Permission denied (publickey)` | 改用 `ssh vps-skillup`（config 别名），确认 `admin.pem` 在位 |
| 脚本提示 showcase-land 未就绪 | 检查服务器 `/usr/local/bin/showcase-land` 与 sudoers 第 9 条 |
| `POST /auth` 返回 404 | 后端无裸 `/auth` 路由；判据是 `/auth/login`（400），脚本已用正确 URL |
| bash `unbound variable`（macOS） | 变量名后跟全角括号需 `${var}` 包裹（bash 3.2 吞首字节），脚本已处理 |
| `sudo -n` 失败要密码 | ubuntu 无 sudo 密码，白名单外命令不可用；落盘只允许 showcase-land 一条 |
