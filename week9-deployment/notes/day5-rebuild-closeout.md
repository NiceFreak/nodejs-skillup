# W9 D5：收口日 —— 冷启动验证 + 信任边界 + 能力检验 + Q8 决策

> 建立：2026-08-14（Asia/Shanghai，周五）
> 上游：`week9-plan.md` §4 D5 五模块（A/B/C/D/E）、`day5-demo-script.md`（讲稿）
> 状态：进行中（A/B/C 已完成；Q8 实现+验证+部署已完成；admin 迁 443 合并部署完成；D 待续 / E 剩时区+shop.bak+收口）
> 内容：① 冷启动验证（reboot 后四面全通）② 信任边界复核（ufw + ss 只读）③ 能力检验（C1 链路分层 / C2 两失败路径 / C3 改需求预演，含三处当场修正）④ Q8 安全债（设计判断 D1/D2 + 实现 + 本地验证 + 部署决策）⑤ 测试影响面确认

---

## 0. 一句话定位

W9 收口日的「验证 + 能力检验」模块完成：服务器重启后四公网面全通证明拓扑自愈；能力检验暴露并当场修正了三处事实错误（Nginx 选入口机制、白名单拒绝形态、80 现状），把「记得结论」升级成「能讲清边界」。

---

## 1. 今日目标 / 计划变化

按 `week9-plan.md` §4 D5（8/14）五模块执行：

- **A 冷启动验证（~15'）**：补 D1「重启恢复」——拓扑已变（+443/shop-ssl/certbot.timer）
- **B 信任边界复核（~5'，只读）**：ufw 四段 + ss loopback
- **C 能力检验（~20'，口述）**：链路分层 + 两失败路径 + 改需求预演
- **D demo 动线 + 讲稿（~30'，白名单）**：本人 review 后自己讲
- **E 收口决策（~15'+Q8）**：Q8 今天做（设计判定期）；admin 迁 443 / 时区 / shop.bak 待定

**计划变化**：Q8 先做了设计判断 D1/D2（本人作答 + AI review），实现推迟到设计确认后；D 模块顺延（讲稿内容依赖 Q8 结果）。**Q8 部署决策（8/14 定）**：不与 admin 迁 443 合并部署，减少对线上服务扰动；部署序列 = commit → push → 服务器 pull → restart nodeapp。

---

## 2. 模块 A：冷启动验证（已完成 ✅）

### 2.1 亲手最小集

- SSH `sudo reboot`（触发点）→ 等 1–2 分钟重连成功

### 2.2 服务器侧复测（AI 出聚合命令，本人核输出）

```
systemctl is-enabled nodeapp mongod nginx certbot.timer
enabled / enabled / enabled / enabled          ✅

systemctl is-active nodeapp mongod nginx certbot.timer
active / active / active / active              ✅

sudo ss -tlnp | grep -E '3000|27017'
127.0.0.1:3000   (MainThread pid=851)          ✅ 仅 loopback
127.0.0.1:27017  (mongod pid=842)              ✅ 仅 loopback

systemctl list-timers certbot.timer --no-pager
NEXT 8/14 22:43 CST | LAST 8/14 04:14:01 CST (7h ago)  ✅ 今天凌晨已自动跑过一次
```

**关键发现**：`certbot.timer` 的 LAST 是 **04:14:01**——今天凌晨 timer 已实际触发过一次（不是「配置了 enable 所以应该会跑」，是「真的跑过」）。结合复习：timer 跑的是「检查」（剩 >30 天才检查跳过），不是「真续签」，除非距离到期不足 30 天。

### 2.3 本地三面一键复测（本地开发机，非 SSH）

```
80    /       = 200 ✅
80    /users  = 404 ✅ （段 0 URL 面收敛未破坏）
8080  /       = 200 ✅
8081  /       = 200 ✅
HTTPS HTTP_CODE:200 SSL_VERIFY:0 ✅
HTTPS /users  = 404 ✅ （443 继承段 0 收敛）
```

**A 模块结论**：重启后 4 服务 enabled/active、3000/27017 仅 loopback、certbot.timer 已自动检查、四公网面全通。冷启动验证收口。

---

## 3. 模块 B：信任边界复核（已完成 ✅）

```
sudo ufw status verbose
Status: active
Default: deny (incoming), allow (outgoing), disabled (routed)
To            Action      From
22            ALLOW IN    Anywhere (+v6)
80/tcp        ALLOW IN    Anywhere (+v6)
8080/tcp      ALLOW IN    Anywhere (+v6)
443/tcp       ALLOW IN    Anywhere (+v6)
8081/tcp      ALLOW IN    Anywhere (+v6)
```

- ufw 恰好放行 22/80/443/8080/8081 五段（四线 + SSH），其余 default deny ✅
- 3000/27017 不在列表，受 default deny 覆盖 + loopback 绑定双保险 ✅
- 注意口述时要准确：8080/8081 是 Nginx 公网暴露面（ufw 放行），不是内网端口；真正的内网端口是 3000/27017

**B 模块结论**：信任边界与冻结契约一致，无变化。

---

## 4. 模块 C：能力检验（已完成 ✅，含三处当场修正）

### 4.1 C1 完整链路分层（口述）

**前四层（DNS → TCP → TLS → Nginx 选入口）** 一次通过 ✅：

- DNS：sslip.io 泛解析返回 `43.128.154.242`；查无此人 → `ERR_NAME_NOT_RESOLVED`
- TCP：三次握手到 `IP:443`；端口没开/被挡 → `ERR_CONNECTION_REFUSED`/超时
- TLS：服务器出示证书 → 浏览器验 CA 签发 + SAN 域名匹配；**验域名不验 IP** → H1 验收用域名的原因
- Nginx 选入口：**Host 字段 + server_name 匹配**；无匹配 → default_server（444/400）

**当场修正 1（Nginx 选入口的机制精度）**：
> 我最初说「HTTPS 默认走 443 所以不靠端口选入口」——不完整。正确拆法：Nginx 靠 **listen 端口 + ssl 指令**决定哪个 server block 处理 TLS 握手；**再**靠 Host 在「同端口多个 server」间选择。本机是**一 block 一端口**（80/443/8080/8081 各自独立），Host 不参与入口选择——Host 是「多域名共享同端口」时才生效。default_server 是「无 Host 匹配」时的兜底。

**后四层（URL 白名单 → 反代 127.0.0.1:3000 → Express 路由 → 数据读取）** 初答有三处事实错误，当场修正：

- **修正 2a（白名单形态）**：我最初说「放行 `/api/` `/auth/` 前缀」——错。段 0 冻结的是**精确路径**：`location = /` + `/auth` + `/reports`，兜底 `location / { return 404; }`。URL 面收敛 = 枚举精确路径，不是放前缀。
- **修正 2b（拒绝形态）**：我最初说「无权限返回 403」——错，**统一 404 不用 403**。403 = 告诉扫描器「这个路径存在，你没权限」，给他指路；404 = 让他以为整面墙都是死胡同（信息隐藏）。
- **修正 2c（静态资源归属）**：我最初说「`/static/` Nginx 读盘」——错。80/443 是**纯反代面**，无 root/try_files 不读盘；读盘静态在 8080/8081 两面。
- **修正 2d（数据读取层压扁）**：我最初说「控制器去查数据库」——错，违反 AGENTS.md 跨层链路规范。正确五层：**Controller**（接 HTTP、塞参、包装响应、错误转状态码）→ **Service**（业务校验/编排/调 Repository）→ **Repository**（业务参数→Mongoose 查询，隔离 DB 细节）→ **Mongoose Model**（`.find()` 是 Mongoose 方法，构造查询+发起+等待+包装 Document）→ **MongoDB**（真正执行者，返回 BSON）。返回值来源：BSON → Document → Plain Object → JSON。

**补验（证书机制）一次通过** ✅：Let's Encrypt / 90 天 / certbot.timer 每天两次 / **剩 30 天内才真续** / LAST 04:14 = 检查不是续签。

### 4.2 C2 两失败路径（口述）

**路径 A（证书过期）** 框架全对 ✅：
- 现象 = 红屏 `NET::ERR_CERT_DATE_INVALID`，不是超时——TCP 通了、TLS 完成、亮出旧证书
- 两分支：有回应 → 查 certbot 机制（timer 状态 / journalctl / letsencrypt.log / 80 端口 ACME 路径）；超时 → 查 Nginx 443 监听 + 防火墙（**跨相位不串层**）

**路径 B（404 二分）** 框架对，一处口误当场纠正 🔴：
- HTML 404 = Nginx 挡的（查白名单配置）；JSON 404 = Express 回的（查路由 + 业务链）✅
- **口误**：我说查 Node 日志用 `pm2 logs`——**本机无 pm2，进程守护是 systemd**，日志用 `journalctl -u nodeapp -n 50 --no-pager`。pm2 只做边界对比不实现（week9-plan 明确）。
- **补充用例**：公网上更常见的 JSON 404 根因是路径写错/参数缺失（Express 没匹配到完整路由），不是「业务查不到数据」；`/users/:id` 这类带参接口才典型「路由匹配上但业务 404」。

### 4.3 C3 改需求预演（「关掉 80 全走 HTTPS」）

**影响面** 核心分析对，两处现状断言错误当场纠正 🔴：

- **修正 3a**：我说「现在 80 是 301 发射台」——错。**当前 80 是完整 API 面**（`Server: nginx` + `X-Powered-By: Express` + 根路径 200，A 模块实测）。「301 发射台」是**全迁 HTTPS 后**的规划。「关 80」影响的是所有硬编码 http 的访问者（老书签/爬虫/回调）直接扑空。
- **修正 3b**：我说「8080/8081 是内网端口绑 127.0.0.1」——错。**8080/8081 是 Nginx 公网暴露面**（ufw `ALLOW IN Anywhere` + 本地公网实测 200）。它们不受关 80 影响的原因是「独立端口无耦合」，不是「绑内网」。
- **安全改法结论**：这台机器 80 几乎是续期硬依赖（sslip.io 是泛解析，DNS 不在我们手里 → DNS-01 不可行；tls-alpn-01 在 certbot 是实验性）→ 现实做法「**关业务 ≠ 关端口**」：80 只保留 ACME 挑战路径 + 301 发射，业务面全走 443。

**C 模块结论**：链路分层、失败路径、改需求预演三关全过，当场修正 8 处（1 机制精度 + 3 白名单/拒绝/静态归属 + 1 分层压扁 + 1 日志口误 + 2 现状断言）。

---

## 5. 模块 E 前置：Q8 安全债（本人实现，AI review）

### 5.1 Q8 范围确认（读代码事实）

- `routes/reports.js`：已有完整范式——每条 route 依次挂 `validateToken` → `requireRole('admin')` → 参数校验 → controller
- `routes/users.js`：五个端点全裸（`GET /`、`GET /:id`、`POST /`、`DELETE /:id`、`PATCH /:id`）——这是 Q8 要补的层
- 黑名单 W4（鉴权流程），**本人实现，AI 只 review**

### 5.2 D1：POST /users 语义归属（✅ 一次通过）

**结论**：`POST /users` 是「管理员/内部系统创建用户」，不是「公开注册」。
**判据**：`createUserController` 解构字段只有 `{ name, email, age, addresses }`，**无 password/passwordHash**——不可能是用户自助注册。公开注册是 `POST /auth/register`（validateRegisterBody 校验密码 + 哈希 + passwordHash）。`/users` 与 `/auth` 前缀隔离，挂 admin 不误伤任何公开流程。

**事实校对**：口述时说了「PUT /users/:id」——实际是 **`PATCH /users/:id`**（routes/users.js 第 28 行）。

### 5.3 D2：逐条挂 vs 统一挂（✅ 选 B 通过）

**选 B：`usersRouter.use(validateToken, requireRole('admin'))`**，四维度权衡：
1. **默认安全**：B = fail-closed，新增端点自动继承守卫；A 漏挂一条 = 端点裸奔
2. **范式连贯**：接受仓库两种写法并存（reports 逐条 / users 统一）；users 有 5 端点，逐条 = 5 处重复守卫；「一眼识别权限边界」比「写法全一致」值钱
3. **改权限动线**：B 在某端点改权限时需「移出 use 或 handler 覆盖」——但权限变更必须过脑，是强制不是缺点
4. **中间件顺序**：`auth → role → idParam → handler` 顺序安全

**AI 技术纠正一处**：我说「避免未认证请求触发 Mongoose CastError」——不准确。`validateIdParam` 是**纯格式校验中间件**（校验 ObjectId 字符串格式），不查库不触发 Mongoose；CastError 是查询执行时才抛（controller→repository 层，已在中间件链之后）。正确理由：**认证/授权是最粗粒度准入判断，先挡住无身份请求，比先花力气校验参数更早止损**。

### 5.4 测试影响面确认（读测试文件事实）

- `auth-flow.test.js`：只测 `/auth/login` + `/reports/monthly-sales` → **不碰 /users**，不受影响
- `monthly-sales.test.js`：只测 `/reports/monthly-sales` → **不碰 /users**，不受影响
- **受影响**：`users.http` 与 Postman collection 大量无 token 的 `/users` 请求 → 挂鉴权后变 401/403（白名单展示资产，实现后更新）

### 5.5 Q8 实现（本人实现，AI review 通过 ✅）

改动只有 3 处（`routes/users.js`）：
- import 增加 `validateToken`（第 12 行）+ `requireRole`（第 13 行）
- `usersRouter.use(validateToken, requireRole('admin'))` 置于 router 创建后、首个路由前（第 17–18 行）
- 五个端点 handler 与参数校验完全不动

**review 三项全过**：import 路径与 reports.js 一致；use 顺序正确（auth → role → 参数校验 → handler，符合 D2 维度 4 推导）；最小范围不顺手重构（users.js 第 7 行 `getCustomerSpendingReportController` 是既有死 import，未动）。

### 5.6 Q8 本地三档验证（✅ 全过）

| 档位 | 期望 | 实测 | 说明 |
|---|---|---|---|
| 无 token → `/users` | 401 | **401** ✅ | `curl http://127.0.0.1:3000/users` 无 Authorization |
| member token → `/users` | 403 | **403** ✅ | 注册唯一邮箱 member → 登录 → 打 /users |
| admin token → `/users` | 200 | **200** ✅ | 同账号 mongosh 提权 role=admin → 登录 → 打 /users |
| jest 测试 | 3 suites / 9 tests | **全过** ✅ | 现有测试不碰 /users，无回归 |

**执行期四个认知**（都来自真实踩点，非预判）：
1. **本地库没有 admin@example.com**——本地与服务器数据不同份（day5 讲稿 §2.3 明写）；本地 dev 库是本地原生 mongod（PID 840，nezha 用户），不是 docker 容器（docker daemon 未运行）
2. **不要先猜 API 响应字段再写 jq**——register 响应是 `data.email` 无 `data.id`，第一次 jq `.data.id` 拿 `null`；先看完整 JSON 再写提取
3. **macOS 无 `ss`**——本机用 `lsof -nP -iTCP:27017 -sTCP:LISTEN`；`ss` 是 Linux 命令（服务器用）
4. **member 提权路径**：mongosh 连本地库（-u root -p --authenticationDatabase admin，本地 mongod 带 auth）→ use week2 → `db.users.updateOne({email},{ $set: { role:'admin' }})` → modifiedCount:1

### 5.7 Q8 部署（与 admin 迁 443 合并，2026-08-14 完成 ✅）

经变更单流程合并发布（见 §10），部署后验证：
- 本地 443 报表无 token → **401**（Q8 上线生效，同时证明 /admin/ 未破坏 API 面）
- 服务器内直连 `127.0.0.1:3000/users` 无 token → **401**（应用层守卫线上复现）
- 公网 80/users → **404**（Nginx 兜底双层防线不破坏）
- 浏览器 `https://43-128-154-242.sslip.io/admin/` 登录 admin@example.com → 报表锚点 258 可见

---

## 6. 验证证据

| 模块 | 证据 |
|---|---|
| A 冷启动 | reboot 后 4 服务 enabled/active；3000/27017 仅 loopback；certbot.timer LAST 04:14；80/443/8080/8081 四面 200/0/404 全通 |
| B 信任边界 | ufw 五段 ALLOW + default deny；ss 见 127.0.0.1:3000/27017 |
| C 能力检验 | 口述三关全过 + 当场修正 8 处（见 §4） |
| Q8 | 实现 review 通过 + 本地三档 401/403/200 + jest 3 suites/9 tests 全过 + 部署后 401 复现 |
| admin 迁 443 | 六项验证全过（见 §10.3）+ 浏览器实测登录 + 报表锚点 258 |

## 7. 已完成 / 未完成

**已完成**：
- [x] 模块 A：冷启动验证（reboot + 四服务 + timer + 三面复测）
- [x] 模块 B：信任边界复核（ufw + ss）
- [x] 模块 C：能力检验（C1 链路分层 / C2 失败路径 / C3 改需求预演）
- [x] Q8 设计判断 D1（POST /users 语义）与 D2（选 B 统一挂）
- [x] Q8 实现（本人改 routes/users.js + 本地三档验证 401/403/200 + jest 全过）
- [x] Q8 部署（与 admin 迁 443 合并，部署后 401 复现 + 浏览器实测）
- [x] admin 迁 443（vite base 分流 + 443 /admin/ location + 独立产物 dist-admin443 + 六项验证全过）
- [x] 测试影响面确认

**未完成**：
- [ ] users.http / Postman 更新（无 token 的 /users 请求 → 401/403；部署后）
- [ ] 模块 D：demo 动线 + 讲稿 review + 本人自己讲（讲稿 Act 3 第二笔改「已还 + 怎么验的」）
- [ ] 模块 E 剩余：时区修正决策 / shop.bak 刷新 / 周计划 D5 勾选 + 状态文件收口
- [ ] 服务器操作身份与权限速查表（承诺收口时补，含 dubious ownership 两新坑）
- [ ] day5 笔记滚动更新（D/E 完成后）

## 8. 明日入口（或今日续作）

1. **E 剩余决策**：时区修正（`$dateToString` 指定 timezone，属代码改动走 review）；shop.bak 刷新为当前白名单形态
2. **D 模块**：讲稿 Act 3 第二笔改「已还 + 怎么验的」（Q8 已部署）；本人 review 后自己讲
3. **收口**：周计划 D5 勾选 + LEARNING-STATE.md 更新（今日主线完成） + git commit（4af5b5f 已含 Q8/vite/day5 笔记；shop-ssl.conf 服务器改动不在 git，需同步本地副本）+ 权限速查表
4. users.http / Postman 更新（部署后 /users 需带 token）

## 9. AI 辅助范围

- 模块 A/B：AI 出聚合复测命令（白名单命令形态），触发点 reboot 由本人亲手执行
- 模块 C：AI 出题 + review + 当场讲解修正（L1）；未给核心实现
- Q8：AI 给 L2 骨架（设计判断框架 + 中间件放置位置提示），核心实现由本人完成；D2 技术纠正（validateIdParam 纯格式校验）为 L1 讲解
- admin 迁 443：vite base 分流 + Nginx location（白名单配置+展示资产，AI 给样板/实现）；产物二份制推演（变更单思维）
- **未触发 DEBT.md**（L1/L2 引导 + 白名单，不记债）；Q8 属黑名单 W4 但 AI 未给实现，援助止步 L2

---

## 10. 变更单思维（D5 E 模块现场沉淀，2026-08-14）

### 10.1 触发

admin 迁 443 合并部署前，本人对「为什么要写变更单」提出追问。AI 讲解后固化本节——这不是流程繁琐主义，是四类可迁移思维的刻意练习。

### 10.2 变更单四要素与思维收益

> 部署不是「让它在线上跑起来」，是「让每一个层都被证明过、让每一次失败都有预先写好的出口」。

| 要素 | 默认思维 | 变更单思维 | 收益 |
|---|---|---|---|
| 改动清单 | 改到哪想到哪，范围蔓延 | 动手前写下「今天就这几项，别的都不动」 | 防「顺手改一下」（90% 生产事故从顺手开始）；回滚知道改了什么；是 C3 改需求预演的落地版 |
| 验证方式 | 验证 = 看跑没跑起来 | 每项验证都有**预测值**（期望），不是看结果是**对结果** | 可证伪——没有期望的验证只是「看了看」；覆盖新入口 + 旧面回归 + 应用层守卫 + 公网兜底四层 |
| 回滚预案 | 坏了再想（panic 时没法设计） | 动手前写下「哪一步失败 → 还原哪个文件」 | 失败时照单还原，**panic 时不做设计**；来自 D4-HTTPS H3 实跑回退的教训 |
| 止步条件 | 目标是做成，失败硬撑 | 写死「做到什么程度就停」 | 防「修好 A 弄坏 B，又修 B 弄坏 C」连锁；停比硬撑安全 |

### 10.3 六项验证 = 「假设 → 执行 → 状态验证 → 偏差归因」的小实验

映射 `LEARNING-PROTOCOL.md` §9「操作链任务的执行形态」：每次验证是一次小实验。

| # | 验证 | 在哪跑 | 命令/动作 | 期望 | 期望来源 |
|---|---|---|---|---|---|
| ① | 本地构建资源前缀 | 本地 | `yarn build` + grep `/admin/assets` | `<script src="/admin/assets/...">` | Vite base 语义 |
| ② | preview 先验 base | 本地 | `yarn preview` + 打开 `:4174/admin/` | 页面加载、无资源 404 | preview = 构建产物静态服务最小模拟 |
| ③ | 443/admin 新入口 | 本地（部署后） | `curl https://.../admin/` → 200 | 200 + 登录表单出现 | **本次发布唯一新入口验收** |
| ④ | 443 API 面回归 | 本地（部署后） | `curl https://.../reports/...` 无 token | **401**（不是 200） | Q8 上线后报表有 validateToken；同时验 Q8 部署 |
| ⑤ | 应用层守卫 | 服务器内 | `curl 127.0.0.1:3000/users` 无 token | 401 | 应用层守卫只在直连 3000 可见；本地三档的线上复现 |
| ⑥ | 四面回归 | 本地（部署后） | 80=/ 200、80-/users 404、8080= 200 | 三面全部保持 | 发布纪律「新入口通 + 旧面不破」，三面 = 对照组 |

**两个关键设计点**：
- ④ 期望 **401 而非 200**——因为 Q8 部署后无 token 进报表应先被应用层拒；这条同时验证 Q8 上线，一次请求验两层
- ⑤ 必须**服务器内部直连**——公网 404 挡在前面，应用层守卫只有绕过 Nginx 才可见；这是「双层防线」的验证分工

**六项验证实测结果（2026-08-14 全过）**：① ✅ ② ✅ ③ admin/=200 asset=200 root=200 ✅ ④ 443 reports=401 ✅ ⑤ 3000/users=401 ✅ ⑥ 80/=200 80/users=404 8080/=200 ✅；浏览器实测登录成功 + 报表锚点 258 ✅

### 10.4 admin 迁 443 被定位为「暴露面迁移 + TLS 加固」的发布

| 维度 | 判断 |
|---|---|
| 变更类型 | 发布 / 暴露面变更，不是功能开发 |
| 服务边界 | 不变——还是同一个 nodeapp:3000（D4-c 心智：数业务看进程） |
| 暴露边界 | 变化——admin UI 入口从 `http://IP:8080/` → `https://domain/admin/` |
| 安全属性 | 传输层升级——登录表单明文 → TLS 加密 |
| 生产类比 | 管理后台从 HTTP 子域迁 HTTPS 子域；服务没变，门换了 |

生产纪律：不单独占发布窗口，但需完整发布检查；真实生产留过渡期（新旧并存观察再下线）——**今天选保留 8080 过渡期**。

### 10.5 可迁移判断标准（面试/工作通用）

> 如果有人问「你怎么保证部署不出事」，能回答「我先冻结变更单：改动边界、每个验证的期望、回滚还原点、止步条件」——这是 junior 和 senior 讲部署的分水岭。

### 10.6 admin 迁 443 + Q8 合并发布 · 变更单（已冻结，2026-08-14 执行完成）

**产物共存修正（执行期发现，变更单思维的又一落地）**：
> 8080 的 shop-admin 和 443 的 `/admin/` **不能共享同一份 dist**——无 base 与 `/admin/` base 是两种产物形态，互相引用会 404。若按原方案把带 base 的 dist 覆盖服务器 dist，8080 首页引用的 `/admin/assets/...` 会 404，**破坏 8080 过渡期**。
> **修正**：443 `/admin/` 用**独立目录**（`dist-admin443/`，带 base 产物），8080 现有 dist 完全不动；回滚 = 撤 `/admin/` location，更干净。

**产物二份制**：

| 面 | serve 目录 | base |
|---|---|---|
| 8080（过渡期保留） | 服务器现有 `dist/`（无 base，不动） | 无 |
| 443 `/admin/`（新） | 新目录 `dist-admin443/`（带 base） | `/admin/` |

| # | 文件 | 改动 | 归属 |
|---|---|---|---|
| 1 | `vite.config.ts` | `base: SHOWCASE ? "" : "/admin/"` 分流 | 白名单（AI 实现） |
| 2 | `routes/users.js` | Q8 统一守卫 | 黑名单（本人实现+验证） |
| 3 | 服务器 `shop-ssl.conf` | 加 `location /admin/ { alias .../dist-admin443/; }` | 白名单（配置胶水） |
| 4 | 服务器部署 | pull → scp 带 base 产物到 `dist-admin443/` → nginx -t + reload | 操作链（本人执行，AI 出命令） |

- **验证**：六项全过（§10.3）+ 浏览器实测登录 + 报表锚点
- **回滚**：443/admin/ 不可用 → 撤 443 block 新增 `/admin/` location（8080 不受影响，因其 dist 未动；Q8 可单独保留或一并 revert）
- **止步**：443/admin/ 无法工作 → 停止发布，按回滚预案
- **发布边界**：保留 8080 过渡期（只加新入口，不拆 8080）
- **执行期三个真实踩点**：① scp 传目录须先建目标目录（`realpath ... No such file`）；② 服务器 git 用 nodeapp 身份（`dubious ownership` + `FETCH_HEAD: Permission denied` 两连坑，详见权限速查表承诺）；③ `alias` 而非 `root`（/admin/assets 映射到 dist-admin443/assets 而非 dist-admin443/admin/assets）

---

## 11. E 模块收口决策（全部完成，2026-08-14）

| 决策 | 结论 | 证据/说明 |
|---|---|---|
| Q8 安全债 | **今天做并完成** | 统一守卫（本实现）+ 本地三档 401/403/200 + jest 全过 + 部署合并 + 线上 401 复现 + 浏览器实测 |
| admin 迁 443 | **今天做并完成** | vite base 分流 + 443 /admin/ location + 独立产物 dist-admin443 + 六项验证全过 + 浏览器实测登录+报表锚点 258 |
| 时区修正 | **明确不修** | UTC 分组作为已知口径保留；3 单/月偏差可接受；不打破 258 锚点稳定性 |
| shop.bak | **已刷新** | `cp shop shop.bak`；424B = 当前白名单形态（`=`/ + /auth + /reports + 兜底 / 共 4 location）；回滚基线从段 0 前旧形态升级为当前稳定态，活破口闭合 |
