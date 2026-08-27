# 变更单：80 站点加 /showcase/ 子路径入口（落盘）

> 建立：2026-08-27（Asia/Shanghai）
> 状态：**已落盘 + 验证全绿（2026-08-27）**；本地副本状态行已回填，commit 由本人决定
> 类型：W11 D3 收口后插曲——`week10-observability/notes/nginx/shop.conf` 本地副本（commit `0f0ebf1`，PR #100）在服务器的落盘；`day4-rollback-drill.md` G9 预见的 Nginx 侧待办之一
> 前置：本地副本已在容器（nginx 1.24）验证，见 commit `0f0ebf1` message

---

## 1. 要解决的问题

Claude Code 云端会话对本仓库服务器的可达面比浏览器窄：实测出网网关只放行 80/443，8080 / 8081 / 3000 / 22 一律 timeout（容器内 `curl --max-time 12` → `code=000`）。展板现有入口在 8081，云端会话摸不到。

解法是路径切分而非端口切分：80 站点加 `location = /showcase`（301 补尾斜杠）+ `location /showcase/`（alias 到 dist-showcase）。前提：showcase 构建 base 为空串（`vite.config.ts: BASE = SHOWCASE ? "" : "/admin/"`），产物资源相对路径引用，可挂任意子路径，无需重新构建；admin 产物被 `/admin/` 焊死，同样做法对它不成立。门禁不用动：展板走 `fetch("/auth/login")`，落到 80 正好命中已有 `location /auth`。

## 2. 变更单四要素

### 2.1 改动清单

| # | 位置 | 内容 | 状态 |
|---|---|---|---|
| 1 | `week10-observability/notes/nginx/shop.conf`（本地副本） | 加 `location = /showcase`（return 301）+ `location /showcase/`（alias + index index.html） | ✅ 已合入 main（`0f0ebf1`） |
| 2 | 服务器 `/etc/nginx/sites-available/shop` | 用本地副本整体覆盖落盘 | ✅ 已落盘（2026-08-27） |
| 3 | 回滚基线 | `/etc/nginx/sites-available/shop.bak.20260827` | ✅ 已备份 |

**不含**：重新构建 showcase 产物、门禁 / 证书 / `.env` / `dist-admin443`、8080 下线（D4 主线）、`deploy-wrapper` sudoers。

### 2.2 可证伪验证（2026-08-27 实测，全绿）

| # | 命令 | 期望 | 实测 |
|---|---|---|---|
| 1 | `sudo nginx -t` + reload | 语法通过 + reload 成功 | ✅ |
| 2 | `curl -sI http://127.0.0.1/showcase` | 301 Location: /showcase/ | ✅ 301 Moved Permanently |
| 3 | `curl -s http://127.0.0.1/showcase/` | 200，title=Node.js Skillup · 学习展板 | ✅ |
| 4 | `curl -sI /showcase/assets/index-CY4BMThF.js` | 200 application/javascript（服务器真实 hash 名） | ✅ 200 OK |
| 5 | `curl -s -o /dev/null -w '%{http_code}' /showcase/nope.html` | 404（无 try_files 回退） | ✅ 404 |
| 6 | `curl -sI /` | 200 + X-Powered-By: Express + X-Request-Id 回写 | ✅（`03713d05…`） |
| 7 | `curl -s -X POST /auth/login`（无 body） | 400 `{"error":"请求体缺失"}` | ✅（/auth 反代生效） |
| 8 | `curl -s -o /dev/null -w '%{http_code}' /reports/customer-spending`（无 token） | 401（validateToken 拦截） | ✅ 401（/reports 反代生效） |
| 9 | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health` | 200（后端在跑） | ✅ 200 |
| 10 | `diff /tmp/shop.conf.20260827 /etc/nginx/sites-available/shop` | 无输出（落盘一致） | ✅ 落盘一致 |
| 11 | `curl -sI http://43.128.154.242/showcase/`（公网 80） | 200 | ✅（本次改动初衷达成） |

### 2.3 回滚

```bash
sudo cp /etc/nginx/sites-available/shop.bak.20260827 /etc/nginx/sites-available/shop
sudo nginx -t && sudo systemctl reload nginx
# 重跑 2.2 表；80 站原有面应立即回基线
```

### 2.4 止步线

- `nginx -t` 非零 → 立即停止，不 reload。
- 2.2 表任一期望不符 → 回滚后复测。

## 3. 执行记录（2026-08-27）

### 3.1 权限前置：为什么必须重置密码

sudoers 已收窄（D3 收口）：`/etc/sudoers.d/deploy-wrapper` 9 条 NOPASSWD 白名单，`/etc/sudoers` L56 注释、`90-cloud-init-users` 清空。`cp` / `vim` 不在白名单 → 白名单外 sudo 落 `%sudo ALL=(ALL:ALL) ALL`（PASSWD）要求密码 → ubuntu 无密码 → 实际被拒。权限探针实测：`sudo -n nginx -t` 免密成功；`sudo -n cp …` 报 `a password is required`。

按 `LEARNING-STATE.md` 既定约定（待补项绑定下次 root 需求），本次正是需要 root 的运维操作：腾讯云控制台重置 ubuntu 密码 → 带密码会话（%sudo 全权）落盘 → 同一会话收窄闭合。

### 3.2 落盘与验证

见 §2.2 表，全绿。落盘通道：scp 本地副本到 `/tmp/shop.conf.20260827` → `sudo cp` 覆盖（不用 vim 转录，避免与已验证内容不一致）→ `nginx -t` → reload。

### 3.3 收窄闭合（同一会话内）

- ✅ `sudo gpasswd -d ubuntu sudo`：ubuntu 移出 sudo 组。
- ❌ **L55 lighthouse 注释失败**（见 §4 偏差 3）。
- 新会话验证：`sudo -n -l` → 9 条白名单，无任何 `ALL`；`sudo -n nginx -t` → 成功；`sudo systemctl start nginx` → `Sorry, user ubuntu is not allowed to execute …`（语义从 `a password is required` 转 `not allowed`，D3 V3 语义偏差修正）。**密码 ≠ 全权**被实证：设了密码、不在 sudo 组、白名单外照样被拒。

## 4. 执行偏差与暴露点

### 偏差 1：diff 基准选错

首次核对用 `diff shop shop.bak.20260818` 期望无输出——错误。`shop.bak.20260818` 是 8/18 改动**前**备份（先备份后改），当前 shop 是 8/18 改动后（含 X-Request-Id + 头部注释）。diff 显示的差异全部是 8/18 改动特征，非未知改动。正确基准 = 本地副本 vs 服务器 shop（§2.2 表 #10）。

### 偏差 2：三个验证「红」全是命令/期望错，非配置故障

| 红 | 原因 | 正确判据 |
|---|---|---|
| `/showcase/assets/app.js` 404 | 容器验证时产物名 app.js；服务器是 hash 名 `index-CY4BMThF.js`（`grep -o 'assets/[^"]*\.js' dist-showcase/index.html`） | curl 服务器真实文件名 → 200 |
| `/auth/login` 404 | 后端只有 `router.post('/login')`，`curl -I`（HEAD）无路由 | `curl -X POST` → 400 |
| `/reports` 404 | 后端只有 `/reports/customer-spending`、`/reports/monthly-sales`，裸 `/reports` 无路由 | `curl /reports/customer-spending` → 401（validateToken 拦在 requireRole 前） |

### 偏差 3（遗留）：L55 lighthouse 注释失败 → 卡死

- 执行：`grep -n lighthouse /etc/sudoers` 漏 `sudo` → `Permission denied`；`sudo sed -i 'N s/^/#/'` 占位符 `N` 未替换成行号 → sed 语法错误。L55 未注释。
- 卡死机制：`gpasswd -d` 后 ubuntu 已不在 sudo 组，白名单无 sed / visudo / grep → 无任何 ubuntu 侧合法通道写 `/etc/sudoers`。
- 处置（建议，待本人拍板）：接受遗留。依据：D4 已核实 `/home/lighthouse/.ssh/` 不存在（无登录通道，利用面 0）。从「待补项」改「需 root 通道才能闭合的持久遗留」，等未来真正 root 机会（如控制台 VNC 单用户模式）再闭合。
- 教训：占位符类指令集执行前必须替换；`grep` 读 440 root 文件要 `sudo`。这类命令在提权会话里可行，但**一旦闭合收窄就不可逆**——收窄动作必须在所有待办 root 操作之后。

## 5. 遗留与收尾

- L55 lighthouse（见 §4 偏差 3）。
- 8080 下线：仍属 D4 主线（`/tmp/nginx-shop-admin-8080-removed` 与一次性 cp 白名单在机）。
- 本地副本 `shop.conf` 头部状态行已回填（待落盘 → 已落盘 2026-08-27 + 回滚基线 `shop.bak.20260827`）。
- commit 由本人决定。
