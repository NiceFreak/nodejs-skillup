# 当前学习状态

> 最后更新：2026-08-14（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**2026-08-14——D5 W9 收口日全部完成**。W9 五模块（A 冷启动 / B 信任边界 / C 能力检验 / D demo / E 收口）已收口；Q8 安全债 + admin 迁 443 合并部署完成。
- 执行记录：[`day5-rebuild-closeout.md`](./week9-deployment/notes/day5-rebuild-closeout.md)（注意：文件名是 `day5-rebuild-closeout.md`，不是 plan 里写的 `day5-rebuild`）；周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓ D4-HTTP✓ D4-b✓ D4-HTTPS✓ D4-c✓ **D5✓** 全部勾选，**W9 全周完成**）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（冻结不变）。
- 服务器：腾讯云首尔二区，公网 IPv4 `43.128.154.242`，Ubuntu 22.04.5，2 核 / 2 GB / 40 GB SSD，到期 2026-11-10；SSH 密钥认证唯一通道（ubuntu + admin.pem，** 本地路径 `~/.ssh/admin.pem`**），网页终端 root 带外应急。
- **信任边界（8/14 复核不变）**：ufw 22 + 80 + 443 + 8080 + 8081/tcp 双栈 ALLOW（3000/27017 不在列表）；腾讯云控制台防火墙同步放行。
- **系统变更（8/14 更新）**：`dist-admin443/`（admin 443 独立产物，nodeapp 属主）；`shop-ssl.conf` 加 `location /admin/`（alias dist-admin443）；`shop.bak` 刷新为当前白名单形态（424B，4 location）。

## 最近完成

- **2026-08-14（D5 W9 收口日 · 全部完成）**：
  - **A 冷启动**：`sudo reboot` 亲手触发 → 重启后 4 服务（nodeapp/mongod/nginx/certbot.timer）全部 enabled+active、3000/27017 仅 loopback、timer LAST 04:14 已自动检查 → 三面六条复测全过（80 200 / 80 users 404 / 8080 200 / 8081 200 / HTTPS 200+0 / HTTPS users 404）。
  - **B 信任边界**：ufw 五段双栈 ALLOW + default deny；ss 见 127.0.0.1:3000/27017。
  - **C 能力检验**：链路分层（DNS→TCP→TLS→Nginx→URL 白名单→反代→Express 五层→Mongo）、两失败路径（证书红屏 vs 超时 / HTML vs JSON 404）、改需求预演（关 80 断续期硬依赖）——**当场修正 8 处**（Nginx 选入口机制、白名单精确路径形态、统一 404 不用 403、静态资源归属、分层压扁、pm2 口误、80 现状、8080/8081 内网误判），全部升级为能讲清边界。
  - **Q8 安全债（本实现，AI review）**：`routes/users.js` 加统一守卫 `usersRouter.use(validateToken, requireRole('admin'))`；设计判断 D1（POST /users = 管理员创建非公开注册）+ D2（选 B 统一挂，fail-closed）；本地三档 401/403/200 + jest 3 suites/9 tests 全过。
  - **admin 迁 443（合并部署）**：定位为「暴露面迁移 + TLS 加固」（一进程四门，服务不变门户换）；vite `base` 按构建分流（admin=`/admin/`、showcase=空）+ 443 `location /admin/`（alias 独立产物 `dist-admin443/`）+ 产物二份制（8080 无 base dist 不动）；**六项验证全过**（构建前缀 / preview / 443 admin 200 / 443 报表 401 / 3000 users 401 / 四面回归）+ 浏览器实测登录 + 报表锚点 258。
  - **E 收口决策**：Q8 今天做 ✅；admin 迁 443 今天做 ✅；时区 **明确不修**（UTC 口径保留，3 单/月偏差可接受）；shop.bak **已刷新**（回滚基线升级）。
  - **变更单思维固化**（day5 笔记 §10）：部署四要素（改动清单=边界 / 验证=可证伪实验 / 回滚=失败前置 / 止步=止损线）+ 六项验证手册；产物二份制推演 + 三个执行期踩点（scp 目标目录须先建、服务器 git 用 nodeapp 身份、alias vs root）。
  - **新增公网面**：**`https://43-128-154-242.sslip.io/admin/`**（443 admin 管理后台，TLS）——第五个公网入口（与 80/443/8080/8081 并存）。
  - **commit**：`4af5b5f`（Q8 + vite base 分流 + day5 笔记）。
  - **展板阶段 1（D5 后可视化，同日）**：先修谎报六处（Q8 已还 / 时区明确不修 / shop.bak 破口闭合 / 生产对照 missing 重算 / 四面→**五面但仍是四份 server 块** / 契约仍欠 2→0），再并入五处新事实（ufw 五段复核、Q8 双层防线图、certbot.timer LAST 04:14 档位升级、新增两次验收含冷启动、admin 迁 443 = 服务不变门换了）；notes tab 接入五份（含此前一直漏的 day4c）。typecheck + `VITE_SHOWCASE_ONLY=1` 构建通过，生产产物断言 **112 项全过**，桌面深浅 + 手机截图核对。**未部署**。
  - **GitHub Pages 上传冻结（本人决定，8/14）**：已有自建服务器 8081（带门禁），发布目标改为 8081；Pages `/skillup-week8/` 不再更新、线上旧产物暂不撤下。冻结的是上传不是构建。落点见 [`SHOWCASE-DEPLOY-PROTOCOL.md`](./SHOWCASE-DEPLOY-PROTOCOL.md) §0 与 `.claude/skills/deploy-showcase-pages/SKILL.md` 停止条款。
  - **顺带核出（非阻断，影响 Pages 解冻）**：D4-c 的登录门禁让 showcase 入口**不再零后端**（`AppShowcase.tsx` 引 `api.ts`，登录走 `/auth`）。8081 有 Nginx 反代所以通；Pages 没有后端，门禁将无人能登入——Pages 即使解冻也发不出可用版本，除非先决定门禁在纯静态目标上怎么处理。
  - **展板阶段 2（同日）**：新增第 11 块 **⑪ 发布变更单**——与「改一台在跑的机器」分工（那块是失败之后，这块是动手之前）。空间编码 = 六项验证 × 四层覆盖矩阵，列计数 3/2/2/1 是一眼结论；④ 一次落在两列上（一个请求验两层）；含变更单四要素、产物二份制与三个执行期踩点。
  - **断言脚本入库（同日）**：`week8-fullstack/src/frontend/scripts/verify-w9-board.mjs` + `yarn verify:board`（自带静态服务；playwright 不进依赖树）。促因：历轮断言每次重写，严格程度不可比——阶段 1 写严一点就抓出 5 处存量反引号。当前 **133 项全过**。
  - **浓缩地图补 D5（同日）**：`week9-roadmap-d1-d4.md` 升级为全周地图（文件名未改，多处引用按旧名）——新增第五个对外面表、§6.3 D4-c、§6.4 D5 收口、生产对照重算、认知修正 19 → **32 条**、白话对照表补 8 个 D5 术语。
  - **遗留观察点（已记录非阻断）**：服务器 `/etc/nginx/sites-available/shop-ssl` 改动不在 git（本地 `shop-ssl.conf` 副本需同步）；`users.http`/Postman 需更新（/users 现在要带 token）。权限速查表已在同日落地为独立文件，不再是承诺项——以下「下一步」列出剩余项。
- **2026-08-13 及此前**：D4-HTTP / D4-b（段 0 + 8080）/ D4-HTTPS（443）/ D4-c（8081 门禁）全部收口（见本文件历史记录；D4 各线执行记录在 day4 各笔记）。

## 当前主线

```text
W9 全周（D1–D5）已收口：HTTP + HTTPS + 管理后台(8080) + 学习展板(8081) + admin 443 迁移全部上线并验证。
下一步 = W10 起（Python/Java 基础学习）与 W9 并行线；W9 收口剩余清理项见「下一步」清单。
```

**状态澄清（8/14 更新）**：公网现有五个面——`http://43.128.154.242`（80 API）、`https://43-128-154-242.sslip.io`（443 API）、`https://43-128-154-242.sslip.io/admin/`（443 admin 后台，新）、`http://43.128.154.242:8080`（8080 管理后台，过渡期保留）、`http://43.128.154.242:8081`（8081 学习展板）。

## 当前阻塞与风险

- **Swap=0（持续，已安全）**：B5 实测 available 1388MB + Nginx 8.5M——余量充足；若后续收紧，选项为降 cacheSizeGB / 清缓存重启 / 加 swap。
- **8080 明文过渡期（8/14 新增，已知短板）**：admin 迁 443 完成但 8080 保留过渡期（发布纪律）；明文登录表单仍在，demo 讲稿 Act 3 明说为「已知短板」，待过渡期观察后下线 8080 + ufw 移除。
- **时区边界（8/14 决策：明确不修）**：聚合 `$year/$month` 按 UTC，服务器 CST，凌晨订单跨月归因 ~3 单/月——已拍板接受，UTC 作为已知口径保留。
- **sslip.io 路线待验证（持续）**：HTTPS 已实际可用（H1 200/0），回退纯 IP+HTTP 路径备查未触发。
- **服务器 8.0 vs 本地 mongo:7**：8.0.29 已装并实证兼容（B1/B2）；本地原生 mongod（PID 840）与 docker 并存需注意。
- **凭据注意（不入笔记，用户知晓）**：admin 密码走密码管理器；`.env` 值一律 redact。

## 下一步

新会话按 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md) 恢复后，任务按序：

1. **W9 收口清理（非主线，快速）**：
   - 同步 `week9-deployment/notes/shop-ssl.conf` 本地副本 = 服务器当前（含 `/admin/` location）——服务器改动不在 git，本地副本是唯一可追溯保存点。
   - ~~补「服务器操作身份与权限速查表」~~ **8/14 已落地**：[`server-permission-cheatsheet.md`](./week9-deployment/notes/server-permission-cheatsheet.md)（三身份 + 属主表 + 12 条坑族，含 dubious ownership / FETCH_HEAD 两新坑）；已接入展板笔记 tab。
   - `users.http` / Postman collection 更新：`/users` 请求需带 admin token（当前无 token 请求会 401/403）。
   - commit/push 剩余改动（day5 笔记 + 权限速查表 + shop-ssl.conf 副本）由本人决定。
2. **展板阶段 3–4（⑪ 已落地）**：⑬ 以谁的身份碰谁的东西（身份 × 对象矩阵 + 12 条坑族）→ ⑫ 讲得出来才算会（C 模块 8 处修正钉在链路七层上）。方法与验收口径见 [`week9-visualization-plan.md`](./week9-deployment/notes/week9-visualization-plan.md) §12.16 与 §13。
3. **W10 起（并行线）**：Python/Java 基础学习与 W9 并行推进；Java 的 W9 stretch（最小 jar + Nginx location）未做、不阻断，可并入 W11。
4. **8080 下线决策（过渡期后）**：admin 已在 443 稳定后，评估下线 8080（拆 server block + ufw 8080 移除）——本周不拆。
5. **demo 讲稿（D5 D 模块尾巴）**：Act 3 第二笔改「已还 + 怎么验的」（Q8 已部署）；本人 review 后自己讲（讲得出来才算验收）。

## 验收命令或证据

- **W9 主线全部收口（8/14）**：
  - 80：`curl -s -o /dev/null -w '%{http_code}\n' http://43.128.154.242/` → 200；`/users` → 404。
  - 443：`curl -sS -o /dev/null -w "HTTP_CODE:%{http_code}\nSSL_VERIFY:%{ssl_verify_result}\n" https://43-128-154-242.sslip.io` → `HTTP_CODE:200 SSL_VERIFY:0`；`/users` → 404。
  - **443 admin 新入口**：`curl -s -o /dev/null -w '%{http_code}\n' https://43-128-154-242.sslip.io/admin/` → 200 + 资源 200；浏览器实测登录 admin@example.com + 报表锚点 258。
  - 8080：`curl -s -o /dev/null -w '%{http_code}\n' http://43.128.154.242:8080/` → 200（过渡期保留）。
  - 8081：`curl -s -o /dev/null -w '%{http_code}\n' http://43.128.154.242:8081/` → 200。
  - 服务器内：`curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/users`（无 token）→ **401**（Q8 应用层守卫）；`http://127.0.0.1:3000/reports/monthly-sales?months=6`（无 token）→ **401**。
  - Q8 本地（dev server 直连）：无 token→401 / member→403 / admin→200；jest 3 suites / 9 tests 全过。
- **D4-HTTPS（8/13）**：`HTTP_CODE:200 SSL_VERIFY:0`；HTTPS `/users`→404；80/8080 回归；证书 notAfter 2026-11-11；`certbot renew --dry-run` → `all simulated renewals succeeded`。
- **D4-b（8/13）**：80 `/users`→404；登录 200 + token；报表首月 `258 2026 3 146988.82`；8080 四证据。
- **D4-c（8/13）**：8081 `/`→200 + 门禁登录实测。
- **D3（8/12）**：nodeapp/mongod active；B1–B5 证据（seed 2000/5057、reboot 自起、快失败注入、RSS 187/84/1388）。
- 第一轮基线（3 suites / 9 tests）只作回归基线；生产链路以 B2/B3 + 各 D 验收为准。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1–D5 全部勾选）、[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)、[`week9-roadmap-d1-d4.md`](./week9-deployment/notes/week9-roadmap-d1-d4.md)（**全周 D1–D5 浓缩地图**，文件名未改）、[`day4-http-reverse-proxy.md`](./week9-deployment/notes/day4-http-reverse-proxy.md)、[`day4b-https-and-admin-plan.md`](./week9-deployment/notes/day4b-https-and-admin-plan.md)、[`day4c-showcase-gate-deploy.md`](./week9-deployment/notes/day4c-showcase-gate-deploy.md)、[`day5-rebuild-closeout.md`](./week9-deployment/notes/day5-rebuild-closeout.md)（**W9 收口 + Q8 + admin 迁 443 + 变更单思维**）。
3. 涉及代码：`week2-express/src/routes/users.js`（Q8 统一守卫）、`week8-fullstack/src/frontend/vite.config.ts`（base 分流）、服务器 `/etc/nginx/sites-available/shop-ssl`（含 `/admin/`，本地副本 `shop-ssl.conf` 待同步）。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- **2026-08-14（D5）**：AI **L1 出题 + review + 经验知识讲解**（C 能力检验三关 + Q8 设计判断 D1/D2 框架）；Q8 黑名单实现由**本人完成**、AI 只 review；admin 迁 443 = 白名单（vite base + Nginx location + 产物二份制）+ 变更单思维讲解；服务器操作链（reboot/pull/scp/reload）AI 出命令、本人执行核输出。**未触发 DEBT.md**（黑名单零实现，止步 L2）。
- **2026-08-13（D4 各线）**：L1 引导 + review + 经验知识讲解；黑名单零实现；未触发 DEBT.md（详见历史记录）。
- **C 模块当场修正 8 处**（8/14，纳入掌握证据）：Nginx 选入口机制精度、白名单精确路径 + 统一 404、静态资源归属、数据读取五层、pm2 口误（systemd）、80 现状（API 面非 301）、8080/8081 非内网端口。这些是「能讲清边界」的直接证明。
- 欠账跟踪：Q8 安全债 **8/14 已销**（实现+部署+线上复现）；时区边界 **8/14 明确不修**（决策落地，不再是待决项）；admin 迁 443 **8/14 完成**；shop.bak **8/14 刷新**；8080 明文过渡期 = 已知短板（demo Act 3 明说，过渡期后下线）。
- 未触发 `DEBT.md` 新记账（L1 + 白名单，不记债）。