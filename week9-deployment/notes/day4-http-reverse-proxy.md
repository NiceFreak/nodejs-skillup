# W9 Day 4（8/12）：D4-HTTP —— Nginx 反代 + ufw 80 放行 + 公网验收

> 建立：2026-08-12（Asia/Shanghai）
> 上游：[`week9-roadmap-d1-d4.md`](./week9-roadmap-d1-d4.md) §6（D4-HTTP 入口）；[`day3-finish-d2-and-db.md`](./day3-finish-d2-and-db.md)（D3 全链路基线）；[`LEARNING-STATE.md`](../../LEARNING-STATE.md)
> 状态：**D4-HTTP 完整收口——本地开发机 curl 200 + 浏览器登录 200 + 报表 200 真实数据 + admin 凭据轮换闭环**

---

## 0. 会话定位

D4 拆分为 HTTP 与 HTTPS 两条独立主线，本会话只做 HTTP。

- **唯一验收**：本地浏览器（非服务器 SSH）访问 `http://43.128.154.242` 走通登录 + `GET /reports/monthly-sales` 返回 200 真实数据
- **信任边界**：Nginx 只反代 127.0.0.1:3000；ufw 公网放行仅 22+80；27017 与 3000 不进公网；其余 deny
- **止步条件**：外部 200 + 凭据轮换完成即收工
- **今日明确不做**：certbot、443、sslip.io、DNS、Java、监控、W10/W11 任何内容

---

## 1. 执行顺序与结果（五项全过）

| # | 步骤 | 结果 | 关键证据 |
|---|---|---|---|
| ① | 凭据轮换（admin 测试密码改强） | ✅ | `modifiedCount: 1` + 密码管理器值验证登录 200 |
| ② | apt install nginx | ✅ | `active (running)` + `enabled` + `1.18.0` + 8.5M |
| ③ | 反代 80 → 127.0.0.1:3000 | ✅ | 服务器内部 `curl -I 127.0.0.1/` → 200 + Server: nginx + X-Powered-By: Express |
| ④ | ufw allow 80 | ✅ | 22 + 80/tcp 双栈 ALLOW；27017/3000 不在列表（Default deny 覆盖） |
| ⑤ | 本地浏览器/公网验证 | ✅ | 本机 curl 公网 200 + 登录 200 + 报表 200 真实数据 |

---

## 2. ① 凭据轮换

### 2.1 方案（先答后做，冻结）

- **新密码生成**：本地开发机 `openssl rand -base64 24`（输出即密码本身，32 字符 base64），记录到本地密码管理器
- **新哈希计算**：服务器内存中 `bcrypt.hash(密码, 12)`（**盐轮数 = 12，与 `authService.register` 一致**——初稿写 10 经 review 修正）
- **写库**：一次性临时脚本 `rotate-admin-password.js`（`User.updateOne({email:'admin@example.com'}, {passwordHash: hash})`），`modifiedCount: 1`
- **验证**：从密码管理器复制值登录 → `STATUS 200`（证明「本地记录值」=「库内哈希明文」）

### 2.2 执行期踩坑（三个认知修正）

1. **ESM 包解析锚在脚本文件位置，不是 cwd**：脚本放 `/tmp` → `ERR_MODULE_NOT_FOUND: Cannot find package 'mongoose'`——`--env-file=.env` 按 cwd 解析成功（找到 .env），但 `import mongoose from 'mongoose'` 从 `/tmp` 向上找 node_modules 失败。这是 D3 经验⑦（`node -e` import 锚在 cwd）的对称面：**文件脚本 import 锚在文件位置**。修正：脚本移回 `src/`（与 node_modules 同目录）。

2. **sudo 默认 `env_reset` 丢弃环境变量**：ubuntu shell `export NEW_ADMIN_PWD` 后 `sudo -u nodeapp bash -c 'node ...'` → 进程内 `process.env.NEW_ADMIN_PWD` undefined。修正：`sudo --preserve-env=NEW_ADMIN_PWD -u nodeapp ...` 显式携带（只带这一个，不展开全部）。

3. **旧密码未留存 → 「旧证 401」不可执行**：旧密码是 D3 B2 手输一次性值，明文已 `history -c` 销毁、从未入密码管理器、bcrypt 不可逆——无法实测旧值 401。**验收口径调整为「单证 + 逻辑覆盖」**：新密码 200（从密码管理器值实测）+ 逻辑证明（`updateOne` 覆盖旧哈希 → 旧哈希已不存在 → bcrypt 碰撞概率可忽略）。教训：**测试凭据轮换前必须确认旧值可取得**，否则「旧证失效」无法实测。

### 2.3 安全纪律

- 临时脚本不 commit，跑完 `sudo -u nodeapp rm`（ubuntu 被 750 挡删不掉——Permission denied ≠ 文件不存在，需用能穿透的身份）
- `git status --short` 确认无 `?? rotate-admin-password.js`
- 密码明文经 SSH（加密）→ 服务器内存 → bcrypt(12) → 写库；明文不落盘、不进命令行参数（`-d` curl 形态被 node -e + env 替代）
- `unset NEW_ADMIN_PWD` 清理会话变量

---

## 3. ② apt install nginx

- Ubuntu 22.04 官方源 → `nginx 1.18.0`
- `systemctl status nginx` → `active (running)` + `enabled`（vendor preset，开机自启内置）
- 内存 8.5M——B5 闸门（mongod 187.4 + nodeapp 83.9 + available 1388）加 Nginx 后余量仍充足
- 无 needrestart 交互提示（apt 无交互场景自动跳过）

---

## 4. ③ 反代配置

### 4.1 设计决策（先答后做）

| 决策点 | 结论 |
|---|---|
| 配置落点 | `sites-available/shop` + `sites-enabled` 软链（不用 nginx.conf）——Ubuntu/Debian 惯例，启停用软链管理，升级不回滚覆盖 |
| 默认站点 | `rm /etc/nginx/sites-enabled/default`（软链删除，源文件保留可恢复）——避免两个 listen 80 server 块混淆 |
| server_name | `43.128.154.242`（精确 IP，精确匹配优先于通配符） |
| proxy_pass | `http://127.0.0.1:3000`（无尾部斜杠——在 `location /` 下带不带斜杠对 URI 转发等价） |
| proxy_set_header | `Host $host`（透传原始 Host；**未加 X-Forwarded-\***） |

### 4.2 为什么不加 X-Forwarded-For / X-Forwarded-Proto（重点推理）

**前置设计题**：反代后 Node 看到三类信息失真——客户端真实 IP（变 127.0.0.1）、原始协议（恒 http）、原始 Host（变 `$proxy_host`）。理论补传方案：`X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto` / `Host $host`，且 Express 侧需 `app.set('trust proxy', 'loopback')` 才信任这些头。

**读代码后决定不配**：
- `app.js` logger 只记 `req.method` / `req.url` / 状态码 / 耗时，未读 `req.ip`
- `auth/login` 只读 `req.body.email` / `req.body.password`
- `reports/monthly-sales` 只从 `req.query` 取 `months`
- 其他中间件（json parser / error handler / 404 捕获）均未读 `req.ip` / `req.protocol` / `req.secure` / `req.hostname`

**结论**：应用不消费这三类字段 → 补传 header + trust proxy 是「为未来配现在」——保持最小改动（纯部署、零代码变更）。将来需要 IP 日志 / 限流时：**XFF 透传 + trust proxy 必须成对引入**（分开做会拿到不可信的假 IP），且 Nginx `proxy_set_header` 覆盖语义防客户端伪造。

### 4.3 站点配置（落盘内容）

```nginx
server {
    listen 80;
    server_name 43.128.154.242;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

### 4.4 验证

- `nginx -t` → syntax is ok + test is successful（由后续 curl 200 反推成立）
- `systemctl reload nginx` → 成功
- 服务器内部 `curl -I http://127.0.0.1/` → `200 OK` + `Server: nginx/1.18.0` + `X-Powered-By: Express`（**反代贯通证据**：default 欢迎页不会有 X-Powered-By）
- 服务器内部 `POST /auth/login` 走 80 → 200 + accessToken

---

## 5. ④ ufw allow 80

```text
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To          Action      From
22          ALLOW IN    Anywhere
80/tcp      ALLOW IN    Anywhere
22 (v6)     ALLOW IN    Anywhere (v6)
80/tcp (v6) ALLOW IN    Anywhere (v6)
```

- **放行仅 22 + 80（双栈）**，与冻结信任边界一致
- 27017 / 3000 不在列表 → 被 `Default: deny (incoming)` 覆盖，**不进公网契约保持**
- 重验 22：SSH 会话未断 + 22 仍 ALLOW ✅

**归因预备（未触发但记录）**：腾讯云控制台安全组与 ufw 是两层防线。ufw 放行 80 只解决一层；若本地访问超时（非拒绝），下一步查控制台 80 放行。

---

## 6. ⑤ 公网验收（唯一验收）

**本地开发机执行**（非服务器 SSH）：

```text
curl -I http://43.128.154.242/        → 200 OK + Server: nginx + X-Powered-By: Express
登录（POST /auth/login）                → STATUS 200 + token [有]
报表（GET /reports/monthly-sales?months=6）→ STATUS 200 + [{"orderCount":258,"year":2026,"month":3,...}]
```

- **GET /auth/login 404 是正确行为**：`routes/auth.js` 只注册 POST——404 反证反代把请求原样转发到 Express（若是 Nginx 欢迎页/默认站点会返回 HTML）
- 报表数据：2026-03 起 258 单 / 146988.82 元——真实聚合数据（对应 B2 链路）

**验收判定：外部 200 + 凭据轮换完成 → 双条件满足，D4-HTTP 收工。**

---

## 7. 认知修正清单（本次新增）

| # | 修正 | 来源 |
|---|---|---|
| 11 | **ESM 文件脚本 import 锚在脚本文件位置**（`/tmp` 找不到 node_modules），与 `node -e`（锚在 cwd）对称 | ① 凭据轮换 |
| 12 | **sudo 默认 env_reset 丢弃环境变量**，跨 sudo 传变量用 `--preserve-env=VAR` | ① 凭据轮换 |
| 13 | 反代理论该传的 header ≠ 本应用需要的 header（读代码决定，最小改动） | ③ 反代配置 |
| 14 | GET /auth/login 404 = 反代原样转发证据（路由只注册 POST） | ⑤ 公网验收 |

---

## 8. 明日入口（D4-HTTPS）

- certbot + sslip.io 子域名 + 443；实际签发不可用 → 回退纯 IP + HTTP（D4-HTTP 已完成，`http://43.128.154.242` 已可访问）
- 时区边界观察点（D5 决策）：聚合 `$year/$month` 按 UTC vs 服务器 CST，是否按业务时区修正
- D5：重启/证书续期检查/端口边界 + 冷路径复核 + demo 证据与项目叙述

---

## 9. AI 辅助记录

- **反代 header 设计**：AI 出前置设计题（反代后哪些信息失真 + 补传方案 + trust proxy），本人作答四类 header 语义 → AI review 通过（无阻断，核心正确）→ 本人读代码后**追加决策**「应用不消费 req.ip/protocol/hostname → 不配 XFF/XFP、不做 trust proxy」→ AI review 确认并要求精确化「Nginx 默认行为 = 对 XFF/XFP 不传、对 Host 传 $proxy_host」+「XFF 与 trust proxy 必须成对引入」
- **凭据轮换**：AI 全程 L1 引导 + review，未给完整脚本（黑名单「密码哈希与存储策略」止步 L2 骨架）——本人补全实现。AI 流程管控缺口：写库前的「密码管理器已记录」前置验证漏了（轮换后一度找不到密码），已记入笔记
- **配置执行**：nginx 站点配置、ufw 命令属白名单，提供落盘形态；站点结构与 server 选择规则由本人设计
- 未触发 `DEBT.md` 记账（L1 + 白名单；ESM/sudo env_reset 属执行期经验修正，不进欠账）

---

## 10. 概念问答沉淀（2026-08-12 夜，探索「week8 管理后台上线」时）

> 概念问题来自「把 week2 + week8 都在服务器跑起来」的探索，与部署链路直接相关。沉淀供 D4-HTTPS / W11 / 面试叙述复用。

### 10.1 Nginx 具体解决什么问题

一句话：**把「一个公网入口」映射到「多个内部服务」，把与业务无关的边界职责从应用剥离。**

当前部署里四件事：
1. **端口收敛 / 信任边界**——Node 只监听 127.0.0.1:3000 不进公网，Nginx 是唯一公网入口；公网只开 80/8080，攻击面收敛到 Nginx 层（对应 D1 冻结的「3000/27017 只走 loopback」契约）。
2. **静态文件服务**——前端构建产物由 Nginx 直接 serve，不需要 Node 进程吐 HTML；Node 只服务 API。
3. **URL 路由**——同一入口按路径/端口分发：`/auth` `/reports` → 3000 后端；`/` → 静态文件。
4. **连接管理**——慢连接、keep-alive 缓冲，慢客户端不直接耗尽 Node 连接资源。

延伸（未来）：TLS 终结、HTTP/2、负载均衡、安全头——加在 Nginx 层，后端代码零改动。

### 10.2 当前结构是否符合实际生产

- **符合**：单机/小团队生产的标准形态 = 「Nginx 反代 + systemd 守护后端 + 静态前端由 Nginx serve + 防火墙最小放行」——真实中小公司部署基线（day3 笔记 §4 已做对照表）。
- **不完整**：缺 CI/CD（W11）、多环境隔离（dev/staging/prod）、监控告警日志聚合（W10）、配置管理/自动化。但这是**成熟度/规模差异，不是结构错误**——结构对了，缺的是「自动化包裹」。

### 10.3 CI/CD / preview / 多分支部署 是否推翻当前方案

**不推翻——是在现有结构上加自动化。** 两层正交：

```text
物理拓扑（当前方案）：公网 80/8080 → Nginx → 127.0.0.1:3000 + 静态文件
产物流水线（CI/CD 要加）：git push → 构建测试 → 产物 → 部署 → Nginx reload
```

- Jenkins（W11 默认跑开发机）自动化的正是**今天手工做的每一步**（clone / npm ci / build / 送产物 / systemctl restart / nginx -t && reload）——不改拓扑，只替手。
- **preview / 多分支** = 多租户：同一 Nginx 按子路径（`/preview/PR-123/`）指向不同产物目录；sites-available 分层天然支持配置模板生成。
- **唯一升级路径**：规模到容器化/K8s 时 Nginx 可能变 ingress/LB——「入口 → 反代 → 内部服务」心智模型不变。

一句话：**今天手工做的每步都是 CI/CD 脚本要复刻的「真相源」；结构不需要推翻，只需脚本化。**

### 10.4 云服务 / 云厂商矩阵 / AWS 的关系

- **腾讯云服务器只是「云厂商产品矩阵里的一个零件」**：计算（轻量/CVM ≈ EC2）、对象存储（COS ≈ S3）、CDN（≈ CloudFront）、DNS（DNSPod ≈ Route 53）、证书（≈ ACM）、LB（CLB ≈ ELB）——这些产品**可独立组合，不是必须成套买**。
- **不引入 AWS 也能用 CDN / 静态存储**：腾讯云 COS + CDN 同生态一键开；中立厂商 Cloudflare（免费 CDN + DNS）；或继续当前 Nginx 直接 serve（单机规模零成本够用）。
- **W11 出现 AWS 凭据模型的目的不是「必须用 AWS」**，而是学习「云服务凭据怎么安全设计」（IAM / 密钥轮换 / 最小权限）——这套思想在任意云厂商成立。规划中它是延伸项，不阻断本周主线。
- **对当前方案的含义**：今天选「Nginx 静态托管」是单机最简形态；将来上 CDN 只需静态文件挪对象存储 + 换 DNS 解析——**Nginx 反代 API 的结构完全不动**。与 10.3 的结论一致：当前结构是演进的正确底座。