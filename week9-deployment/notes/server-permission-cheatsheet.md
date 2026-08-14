# 服务器操作身份与权限速查表

> 建立：2026-08-14（D5 收口，W9 承诺项落地）
> 目的：把 W9 全程零散踩过的「身份 / 属主 / 权限」坑族集中到单一查询入口，避免每次重新踩。
> 适用：`43.128.154.242`（Ubuntu 22.04，腾讯云首尔二区）

---

## 0. 核心心智

```text
这台机器上「你是谁」决定「你能碰什么」：
- ubuntu  = 运维用户（SSH 唯一入口），能读大多数东西，但 nodeapp 的东西常被权限挡
- nodeapp = 服务运行用户（systemd User=），代码/.env/产物属主，nologin
- root    = 带外应急（网页终端），能读一切，但违背最小权限纪律，日常不用
```

**一条黄金规则**：服务器上操作 nodeapp 属主的东西，**用 `sudo -u nodeapp`**，不要 sudo root、不要 sudo 直接碰。

---

## 1. 各类对象属主速查

| 对象 | 属主 | 权限 | 谁能碰 |
|---|---|---|---|
| `/home/nodeapp` | nodeapp:nodeapp | 751（`drwxr-x--x`） | nodeapp 全权；ubuntu/其他走 other x（目录穿越）；Nginx www-data 静态服务需 o+x |
| 代码仓库 `/home/nodeapp/nodejs-skillup` | nodeapp:nodeapp | 775（umask 002 所致） | nodeapp 写；ubuntu 经父目录 o+x 可进但写 .git 会被拒 |
| `.env` | nodeapp:nodeapp | 600 | 仅 nodeapp；ubuntu 读被拒（600 生效实证）；root 读得到但违背纪律 |
| Nginx `sites-available/*` | root:root（或 ubuntu 编辑后变 ubuntu） | 644 | root 写；ubuntu sudo 编辑；Nginx worker 读 |
| `dist/` `dist-admin443/` `dist-showcase/` | nodeapp:nodeapp | 755 | nodeapp 写；Nginx www-data 读（读磁盘静态） |

---

## 2. 坑族清单（按暴露时间序）

| # | 坑/现象 | 根因 | 正确做法 |
|---|---|---|---|
| 1 | ubuntu 进不了 `/home/nodeapp`（Permission denied） | 750 无 o+x | **这是预期拦截**，不是故障；用 `sudo -u nodeapp` 或确认需要 o+x 时 chmod o+x（8/13 为 Nginx 静态读到 751） |
| 2 | `sudo -u nodeapp umask` → command not found | umask 是 shell builtin，非外部程序 | `sudo -u nodeapp bash -c 'umask'` |
| 3 | `.env` 读不到（ubuntu） | 600 归 nodeapp | 以 nodeapp 身份读/写；值一律 redact |
| 4 | `sudo -u nodeapp node ...` 里环境变量丢失 | sudo 默认 env_reset | `sudo --preserve-env=VAR -u nodeapp ...` |
| 5 | scp 方向错（服务器→本机无密钥） | 本机没有服务器私钥 | 正确 = **本地** `scp -i ~/.ssh/admin.pem` 推到服务器 |
| 6 | scp 传目录报 `realpath ... No such file` | 目标目录必须先存在 | 服务器先 `mkdir -p /tmp/xxx` 再 scp |
| 7 | Nginx 静态 403 | `/home/nodeapp` 750 无 o+x，www-data 读不到 | chmod o+x（751）；反代（proxy_pass）不读盘不受影响 |
| 8 | 前台 UI 静态服务读盘 vs 反代不读盘 | root/try_files 读磁盘 | 静态 → alias/root 落盘目录要权限；反代只管转发 |
| 9 | `git pull` → `dubious ownership` | Git 2.35+ 安全检查：仓库属主(nodeapp)≠当前用户(ubuntu) | `sudo -u nodeapp git pull`（或该用户加 safe.directory） |
| 10 | safe.directory 后 `cannot open .git/FETCH_HEAD: Permission denied` | ubuntu 对 nodeapp 属主 `.git` 无写权限 | **git 操作用 `sudo -u nodeapp`**（nodeapp 是属主能写） |
| 11 | `not a git repository` | 在非仓库目录跑 git | `git -C /home/nodeapp/nodejs-skillup` 指定 |
| 12 | clone/rsync 落盘属主错 | 用错身份执行 | 建树/落盘用 `sudo -u nodeapp`，避免 root/ubuntu 属主导致后续 EACCES（症状常在 npm ci 写 node_modules 时爆发，根因在 clone 身份） |

---

## 3. 常用正确形态（直接复制）

```bash
# 服务器 git（拉代码）
cd /home/nodeapp/nodejs-skillup && sudo -u nodeapp git pull

# nodeapp 身份跑命令
sudo -u nodeapp bash -c 'cd .../week2-express/src && node --env-file=.env ...'

# 带环境变量（sudo env_reset 会丢）
sudo --preserve-env=VAR -u nodeapp bash -c 'echo $VAR'

# 产物落盘（/tmp 中转 → nodeapp rsync 到位）
sudo -u nodeapp rsync -av /tmp/xxx/ /home/nodeapp/.../destination/

# Nginx 配置（ubuntu sudo）
sudo nano /etc/nginx/sites-available/shop-ssl && sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. 一句话总结

**凡是 nodeapp 的东西，就 `sudo -u nodeapp`；凡是 Nginx 静态读的盘，就确认 o+x 链路；凡是 git 操作，就用仓库属主身份。** 权限报错先问「我在以谁的身份碰谁的东西」。