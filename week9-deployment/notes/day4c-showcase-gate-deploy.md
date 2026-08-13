# W9 D4-c：学习展板 8081 + 登录门禁（形态乙）+ 服务边界心智

> 建立：2026-08-13（Asia/Shanghai）
> 上游：`day4b-https-and-admin-plan.md`（段 2 拆分出的 showcase/admin 双入口）、`SHOWCASE-DEPLOY-PROTOCOL.md`（发布边界）、`week9-roadmap-d1-d4.md`（拓扑/端口表/认知修正）
> 状态：已完成并部署上线（8081）
> 内容：① 展板门禁（形态乙：独立登录页）实现；② 构建产物分目录（dist/dist-showcase）；③ 8081 站点部署 + 验收；④ 引发的生产心智：「服务边界 vs 暴露边界」

---

## 0. 一句话定位

给纯静态学习展板加一层「登录门禁」（只挡随手打开链接的路人），并把展板独立部署到服务器 8081。部署过程中固化了一个重要心智修正：**加 Nginx 入口 ≠ 加业务**——服务个数看进程，入口个数看 Nginx server block。

---

## 1. 需求与形态选择

### 1.1 需求

「把学习展板发布到服务器方便自己复习，做基础权限认证（登录 admin@example.com）才能访问。」

### 1.2 现有资产盘点（全是现成的，零新开发认证逻辑）

| 需要 | 现状 |
|---|---|
| 后端登录 API | `POST /auth/login`（JWT + bcrypt），公网 80/443/8080 已验证 |
| admin@example.com | 已存在且 admin 角色（D3 注册提权、D4 轮换密码） |
| 前端登录表单 | `AuthView.tsx` 可直接复用 |
| 展板 showcase 产物 | 已是纯静态、零后端依赖（双入口拆分完成） |

### 1.3 两档方案与选择（用户确认「只挡路人」）

| 档位 | 做法 | 防线 | 代价 |
|---|---|---|---|
| A · 前端登录门禁 | 登录成功才渲染展板 | 只挡浏览器用户 | 静态内容仍在 bundle 里，curl 可抓 |
| B · 真访问控制 | Nginx auth_request / 后端 serve 前校验 | 未登录拿不到内容 | 属 W4 黑名单，需本人实现；与"纯静态零后端"冲突 |

**选了 A**（用户明确"只想挡住随手打开链接的路人"）。诚实边界写进产物 footer 和本笔记：门禁只挡浏览器，不防抓包。

### 1.4 形态乙：独立登录页

- `#/login` 是登录页语义；未登录访问任何 `#/showcase...` 深链 → 重定向 `#/login?next=<原hash>`，登录成功**回跳原目标**
- 未登录不渲染展板任何一帧
- 登录态 = `token` + `skillup_user` 都在 localStorage（与 admin 入口共用同一套键 + 同一账号体系）
- 门禁模式 `context="gate"` 只登录、**关注册口**——否则路人自助注册就绕过门禁，"挡路人"白做

---

## 2. 实现（白名单前端，AI 直接完成）

### 2.1 `AuthView.tsx`

新增 `context` prop：`"admin"`（管理后台：登录+注册+RBAC 说明，行为不变）/ `"gate"`（门禁：仅登录）。

### 2.2 `AppShowcase.tsx`

- 新增 `Location` 解析（route: `login` | `showcase`，带 `next` 参数）
- 门禁 effect：未登录 + 想进 showcase → 写 `#/login?next=...`；已登录 + 停在 login → 归一为 next 或 `#/showcase`
- 用 `useEffect` 而非 render 里改 hash：hash 是唯一真源，避免「state 驱动 hash」与「hashchange 回流 state」打架
- header 显示登录态 + 登出按钮

### 2.3 `vite.config.ts`：构建产物分目录（关键部署决策）

**问题**：8080 的 shop-admin 和 8081 的 showcase 原本共用 `dist/`。若都写 `dist/`，后构建的一方会覆盖另一方（admin.html / showcase.html 互删），必有一个站点拿到残缺产物。

**解决**：`OUT_DIR = SHOWCASE ? "dist-showcase" : "dist"`。
- admin 构建（默认）→ `dist/`（8080 保持不动）
- showcase 构建（`VITE_SHOWCASE_ONLY=1`）→ `dist-showcase/`（8081 用）

`.gitignore` 补 `dist-showcase`（构建产物不入库）。

**验证**：两种构建各自通过后，`ls` 确认互不覆盖：
```
dist/           → admin.html  index.html  assets/
dist-showcase/  → index.html  showcase.html  assets/
```

---

## 3. 部署到服务器 8081（方案 A：独立端口）

### 3.1 为什么独立端口，不换 8080 / 塞 80

- 8080 是管理后台（报表演示），不被覆盖；8081 是"个人复习入口"，两套并存互不影响
- 段 0 已冻结 80 白名单语义（`/` `/auth` `/reports`），往 80 塞展示站 = 回"改 shop 白名单"循环
- A7 冻结意见一致：admin/showcase 未来 HTTPS 阶段再迁 443

### 3.2 执行序列

| 步骤 | 动作 | 结果 |
|---|---|---|
| 1 | 本地构建双产物 | dist + dist-showcase 分流验证通过 |
| 2 | 提交 `5a86dca`（vite.config + .gitignore）push main | 6a4399a..5a86dca |
| 3 | 服务器 `git pull` | 服务器与本地同一 commit（5a86dca；溯源闭环满足 Day4B A1） |
| 4 | scp `dist-showcase` → `/tmp` → nodeapp 身份 rsync 到位 | root 指向 dist-showcase |
| 5 | 建 `sites-available/shop-showcase`（listen 8081 + root dist-showcase + `location /auth` 反代 3000 + `location /` 静态） | `nginx -t` ok + reload |
| 6 | ufw `allow 8081/tcp` | 22+80+443+8080+8081 双栈 |
| 7 | 腾讯云控制台 8081 | 公网 curl 直接 200（无需再加规则，已是放行态） |

### 3.3 验收（静态侧全过）

```
8081 /              200（静态 index.html）
8081 /showcase.html 200
8081 POST /auth     400（缺字段 → Express 响应，说明 /auth 反代贯通）
80  /               200（回归）
80  /users          404（回归：URL 面收敛未破坏）
8080 /              200（回归：admin 后台未受影响）
```

### 3.4 浏览器实测

`http://43.128.154.242:8081/#/showcase?tab=database&topic=lookup-index`
- 未登录 → 显示「个人复习门禁」登录表单（非展板内容）✅
- 登录 admin@example.com → 回跳 `tab=database` 展板 ✅

---

## 4. 心智修正：「服务边界 vs 暴露边界」（生产环境知识）

### 4.1 误区

用户问"现在相当于在服务器上部署了第二个业务对吗？"——把「Nginx 新增 server block + 一份前端产物」当成了「新增业务」。

### 4.2 核心区分

```
                    ┌── 80  (shop)        → API 面
                    ├── 443 (shop-ssl)    → API 面 HTTPS
   nodeapp :3000 ───┤
  （唯一业务进程）     ├── 8080 (shop-admin)   → 管理后台 UI
                    └── 8081 (shop-showcase) → 学习展板 UI
```

- **服务边界** = 进程。nodeapp(3000) 一个业务；"新增业务" = 新增/修改后端进程
- **暴露边界** = Nginx server block。四个站点都是把请求导向同一个 3000 进程的不同形态

一句话类比：**一个餐馆（一个后端进程）只有一个厨房，但开了四个门**——正门（API）、外卖窗口（管理后台）、包厢入口（复习展板）、VIP 通道（HTTPS）。菜都是同一厨房做的，只是门牌不同。

### 4.3 为什么这对边界重要（生产知识）

1. **反代与业务进程职责分离**：Nginx 管 TLS/静态/路由/限流；进程管业务/数据/鉴权。加暴露面不碰业务进程（本次 nodeapp 全程未重启）；后端不直接暴露公网（3000 只监听 127.0.0.1）
2. **静态服务 vs 反代的隐藏差异**：`root dist` = Nginx 读磁盘 → 受文件权限影响（750 → 403，D4-b B3）；`proxy_pass` = 只转发 → 不读磁盘。80 站从没被 750 影响就是这个原因
3. **同源策略反证**：前端 8080/8081，API 在 80 → 跨域；相对路径 `/auth` 落当前 origin → 同 block 反代到 3000 → 同源。每个 UI 站点都配 /auth 反代不是重复劳动，是同一规则的必然
4. **暴露面三种切分**：端口（8080/8081，最简单、记数字）、域名（admin.example.com，要 DNS+证书）、路径（/admin，共享 URL 面、易冲突）。今天选端口不是巧合——段 0 已冻结 80 白名单语义
5. **证书按域名签，不按端口签**：8081 现在明文 http；将来 HTTPS 要给 8081 配 server block + 证书（A7 冻结的后续）
6. **排障心智**：请求坏 → 二分 curl 127.0.0.1:3000（进程层）vs curl 127.0.0.1:8081（Nginx 层）；进程通 Nginx 不通 = 入口/配置问题；进程不通 = 业务挂了
7. **微服务/网关地基**：微服务 = 一入口多进程；今天 = 一进程多入口——同一「服务数/入口数不同」规律的第一次体感

### 4.4 一句话总结

**「看进程 ≈ 数业务；看 Nginx ≈ 数入口」**。数业务看 `ps`/`ss` 里几个后端进程；数入口看 Nginx 几个 server block。

---

## 5. 认知修正（补入 roadmap §5）

| # | 修正 | 来源 |
|---|---|---|
| 17 | **服务边界 ≠ 暴露边界**：加 Nginx 入口 ≠ 加业务；服务数看进程、入口数看 server block | D4-c §4 |
| 18 | **构建产物需分目录**：同一仓库两个 UI 站点若共用 `dist/`，后构建覆盖对方产物（admin.html/showcase.html 互删） | D4-c §2.3 |
| 19 | **前端登录门禁只挡浏览器**：静态内容在 bundle 里，curl 可抓；「挡路人」档位必须接受这个边界 | D4-c §1.3 |

---

## 6. 当前完整拓扑（D4-c 后）

```
浏览器
 ├─ http://43.128.154.242        → shop(80)     → 反代 3000（API 面，白名单：/ /auth /reports）
 ├─ https://43-128-154-242.sslip.io → shop-ssl(443) → 反代 3000（HTTPS API 面）
 ├─ http://43.128.154.242:8080   → shop-admin   → dist/ 静态 + 反代 /auth /reports（管理后台）
 └─ http://43.128.154.242:8081   → shop-showcase → dist-showcase/ 静态 + 反代 /auth（学习展板 + 门禁）
      └── 全部指向 nodeapp:3000（唯一后端业务进程）
```

**ufw 入站**：22/80/443/8080/8081 双栈 ALLOW；3000/27017 不在列表。
**腾讯云控制台**：与 ufw 一致放行 22/80/443/8080/8081。

---

## 7. AI 辅助范围

- 前端门禁 / 构建分流 / Nginx 站点 / 传输命令 = **白名单**（展示资产 + 配置胶水），AI 直接实现
- 门禁"只挡路人"的边界判断、信任建模 = W4 讨论，AI 只讲解与确认，未代写鉴权链路（后端 /auth/login 是既有实现）
- 未触发 `DEBT.md` 记账