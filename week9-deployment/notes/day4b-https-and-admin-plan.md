# W9 D4-b 计划稿：公网 URL 面收敛 + HTTPS + week8 管理后台

> 建立：2026-08-13（Asia/Shanghai）
> 上游：[`day4-http-reverse-proxy.md`](./day4-http-reverse-proxy.md)（D4-HTTP 已收口）、[`week9-plan.md`](./week9-plan.md) §4、[`LEARNING-STATE.md`](../../LEARNING-STATE.md)「下一步」
> 状态：**计划稿，未冻结**——§3 / §4 / §5 的问题库由本人作答后才进入执行；作答前不做任何有副作用的动作。
> **进度（2026-08-13）**：Q0 已实测——预测 200 / 实测 200，F4 由推断升级为事实（`/users` 公网挂裸 GET）；Q1 已拍板 **B：段 0 → 后台 → HTTPS**（今天先拿可演示后台；段 0 仍排最前，见 §7 收工判据的硬顺序）。

---

## 0. 先回答形式问题：整体问题稿 还是 现场一问一答

结论：**按段切分，不是二选一**。判据取自本仓已固化的两条规则，不是临场偏好。

| 判据来源 | 规则 | 落到形式 |
|---|---|---|
| `LEARNING-PROTOCOL.md` §3「操作链任务的追加要求」 | 部署 / 配置类任务，动手前先冻结契约问题库——写错的配置比没配置更贵，它在排障时会变成假事实 | 决策空间**可从已冻结契约 + 仓库代码推出**的段落 → 先出整体问题稿 |
| `AGENTS.md` §4「可推导 vs 经验知识」 | 「必须真实遇过一次才知道」的工具行为不考核先答，直接讲解——D2 把 debconf / needrestart 当可推导考核，导致「每一步碰运气」 | 结果取决于**没跑过的第三方工具当场行为**的段落 → 短冻结 + 现场一问一答 |

按此切分本次三段：

| 段 | 形式 | 理由（一句话） |
|---|---|---|
| **段 0 · 公网 URL 面收敛** | **整体问题稿（先答后做）** | 全部决策可由 `app.js` / `routes/*.js` 的路由事实 + D1 冻结的信任边界推出，没有未知工具行为；且动的是**已经对公网开着的**面，改错的代价最高 |
| **段 1 · D4-HTTPS（certbot + sslip.io）** | **短冻结 4 题 + 现场一问一答** | 唯一验收 / 信任边界 / 止步回退可推导（必须先冻）；但 sslip.io 能否解析、certbot 交互问什么、`--nginx` 插件如何改写既有 site、LE 速率限制形态——都属「必须遇过一次才知道」，先答＝猜 |
| **段 2 · week8 管理后台（8080）** | **整体问题稿（先答后做）** | 前端构建与接线全部写在代码里（见 §1），可读可推；Nginx 静态站 + 反代是 D4-HTTP 已跑过一遍的同类操作，无新工具 |

一句话：**「问题库负责学什么、证明什么；现场问答负责这里到底怎么回事」**（`LEARNING-PROTOCOL.md` §4 原话），段 0 / 段 2 前者为主，段 1 后者为主。

---

## 1. 读代码得到的事实（本稿的地基）

标注口径沿用 `LEARNING-PROTOCOL.md` §4：**事实**＝代码/输出已验证；**推断**＝由代码与已知配置推出；**待验证**＝需现场一条命令确认。

### 1.1 后端 URL 面（决定段 0 是否成立）

| # | 内容 | 口径 | 依据 |
|---|---|---|---|
| F1 | `/users` 五个路由**全部无鉴权中间件**：GET 列表、GET 单个、POST 建、DELETE 删、PATCH 改 | 事实 | `week2-express/src/routes/users.js:16,19,22,25,28`；对照 `routes/reports.js` 才有 `validateToken → requireRole('admin')` |
| F2 | `app.js` 挂载 `/users` 之前没有任何认证中间件（logger → json parser → 路由） | 事实 | `week2-express/src/app.js:17,31,37` |
| F3 | D4-HTTP 的 Nginx 是 `location /` 整段反代 → **Express 的每一个路由都在公网面上**，不只验收接口 | 事实 | `day4-http-reverse-proxy.md` §4.3 |
| F4 | 因此 `http://43.128.154.242/users` 当前应可被任意人 GET 到 2000 条用户记录；`DELETE /users/:id` 可被任意人调用 | **推断**（F1+F2+F3 直接推出，未实测） | — |
| F5 | 泄露面**不含** `passwordHash`（`select: false`），但**含** `role` → admin 账号的 email 可被直接看出 | 事实 | `week2-express/src/models/users.js` passwordHash `select:false`；`repositories/users.js:6` `User.find()` 无字段裁剪 |
| F6 | `PATCH /users/:id` **不能**提权：service 层白名单只放 `name/email/age/addresses` | 事实 | `week2-express/src/services/users.js:26` |
| F7 | 种子数据是确定性伪随机生成（`mulberry32`，seed 20260710），不是真人 PII | 事实 | `week2-express/src/seedUsers.js:20-24` |

**风险的诚实量级**：不是 PII 泄露（F7），是**完整性**——任意人（含扫描器）可 DELETE 掉 B1 的 2000 用户，而 D3 B1/B2 的验收证据、D5 的 demo 全部建在这份数据上。同时 F5 让「删哪一个最有效」变成公开信息。

**这与 D1 冻结契约的关系**：D1 冻结的是**端口边界**（3000/27017 不进公网），这条至今没破。破的是从未被冻结过的**路径边界**——`location /` 把端口收敛的收益又从 URL 层还了回去。**「端口边界 ≠ URL 面边界」是段 0 的全部学习点。**

### 1.2 week8 前端（决定段 2 怎么做）

| # | 内容 | 口径 | 依据 |
|---|---|---|---|
| F8 | 前端是 **hash 路由**（`#/admin`、`#/showcase?tab=...`），不是 history 路由 → Nginx **不需要** SPA 的 `try_files ... /index.html` 兜底 | 事实 | `App.tsx:11,49,51,53` |
| F9 | `API_BASE` 默认空串 → 全部请求走**相对路径**，落在页面自己的 origin 上 → 同源，后端**不需要** CORS（后端也确实没有 CORS 中间件） | 事实 | `api.ts:22,66,127`；`app.js` 无 cors |
| F10 | 前端实际只调 `/auth/*` 与 `/reports/*`；**`/users` 一次都没调**（vite dev proxy 里的 `/users` 是历史遗留） | 事实 | `grep '/users' src/` 无命中；`vite.config.ts:9-13` 仍列了 `/users` |
| F11 | 管理后台构建**必然包含整个学习展板**：`App.tsx` 静态 import `Showcase`，只有 `Dashboard` 是 lazy；没有「只要后台、不要展板」的构建开关 | 事实 | `App.tsx:5,9,15`（只有 `VITE_SHOWCASE_ONLY` 一个方向的开关） |
| F12 | 展板把 **15 份 .md 以动态 `import(...?raw)` 引用**（每份一个 chunk，打开才拉），含 `interview-prep/*` ×2、`week6-testing/notes/*` ×1、`week9-deployment/notes/*` ×6、`week8-fullstack/README.md` + `week8-fullstack/notes/*` ×5 | 事实 | `MarkdownNotes.tsx:32-48`（**2026-08-13 核对，F12 旧版「9 份静态」已过时**） |
| F13 | 因此**构建时的磁盘相对布局必须保留整仓**：`?raw` 相对路径以 `MarkdownNotes.tsx` 所在 `src/` 为基准——`../../../` 到 `week8-fullstack/`（README + notes）、`../../../../` 到仓库根（interview-prep ×2、week6-testing/notes ×1、week9-deployment/notes ×6）；只传 `frontend/` 目录构建必失败（Vite 打包期 ENOENT，物理文件缺失） | 事实（由 F12 的真实 import 路径推出） | `MarkdownNotes.tsx:32-48` |
| F14 | 服务器已 clone 整仓到 `/home/nodeapp/nodejs-skillup`（nodeapp 属主，umask 002） | 事实 | `day3-finish-d2-and-db.md` §a 槽位 |
| F15 | `w9Facts.ts` 里写着服务器 IP、四跳拓扑、端口面、Nginx 版本、B5 内存读数、启动顺序约束——**这些会随 bundle 一起进入静态产物** | 事实 | `w9Facts.ts:94` 及全文 |
| F16 | `deploy` / `interview` 两个 tab 只是**默认不显示**（`REVIEW_ONLY_TABS`），数据仍在 bundle 里，深链可直达 | 事实 | `App.tsx:37-43` |
| F17 | 前端用 Yarn 3（`nodeLinker: node-modules`，`yarnPath` 指向已提交的 `.yarn/releases/yarn-3.2.0.cjs`）→ 服务器没有 yarn 也能跑起来 | 事实 | `.yarnrc.yml`、`git ls-files` 确认 release 已提交 |
| F18 | 服务器 Node 是 NodeSource **v24.19.0 / npm 11.17.0**；notes 里**没有装 yarn 的记录** | 事实 + **待验证**（yarn 是否存在需现场 `yarn -v`） | `day2-host-and-node-service.md` 步骤 5 |

---

## 2. 三段与排序建议

```text
段 0（公网 URL 面收敛）  →  段 1（D4-HTTPS）  →  段 2（week8 管理后台 8080/443）
```

**Q1 已拍板：选 B（维持 LEARNING-STATE.md 原排序）——段 0 → 后台 → HTTPS。** 本节「建议对调后两段」的理由三条（周验收物优先级 / certbot 返工成本 / 8080 明文登录表单）仍成立，作为已记录的取舍，不推翻决策——后台 8080 明文与「后续 HTTPS 还要改一遍后台站点」是两个明确、可接受的代价，由决策者接受。

原建议（保留备查）：
</replace_in_file>

<task_progress>
- [x] 恢复学习状态（AGENTS/协议/状态/周计划/最近笔记/git status）
- [x] Q0 前置实测（F4 升级为事实：/users 公网 200，敞口坐实）
- [x] Q1 排序已拍板：段 0 → 后台 → HTTPS（B，维持原排序）
- [ ] 段 0：Q2–Q8 先答后做 → 冻结 → 执行 → 验收
- [ ] 段 2：week8 管理后台（A1–A9 先答后做 → A9 四条证据）
- [ ] 段 1：D4-HTTPS（短冻结 H1–H4 + 现场问答 → 验收/回退）
- [ ] 收口：更新周计划勾选 + LEARNING-STATE + 每日笔记

1. **优先级规则**：`LEARNING-PROTOCOL.md` §7 是「本周核心能力闭环 → 会阻断闭环的缺陷 → …」。W9 的周验收物是「公网 HTTPS 服务 + 证书有效」；week8 管理后台从来不在 W9 Excel 范围内，是加项。加项不该排在周交付物前面。
2. **返工成本**：certbot 只会给它匹配到的 80/443 server 块配 TLS。**先上 8080 明文后台 → 拿到证书后还要再改一遍后台的站点形态**（同一份工作做两次）；先拿到 sslip.io 主机名和证书，后台直接落在 TLS 面上，一次成型。
3. **凭据暴露**：8080 明文后台意味着**浏览器登录表单的密码走明文**，且浏览器会记住它。curl 明文登录是一次性行为，浏览器表单是长期行为——两者不等价。

段 0 排最前的理由不同：它不是「更重要」，是**代价随时间累积**——已经开着的面每多开一天，被扫到的概率就多一天，而它的关闭不依赖任何未完成的前置。

**如果 §3 Q1 决定不对调**（比如今天就想要一个能演示的后台），段 0 仍必须在段 2 之前：在一个已知敞口上再开第二个端口，是把错误事实叠起来。

---

## 3. 段 0 问题库 · 公网 URL 面收敛（**先答后做，冻结前不动手**）

> 归属提示：这一段的核心决策落在 `AGENTS.md` 黑名单（W2 分层职责 / W4 授权所在层设计）。AI 只出题与 review，**不给实现**；Nginx 侧的落盘形态属白名单，等本人定完「决策放哪一层」之后才给。

**Q0（前置实测，唯一一条先做的动作，只读）**
本地开发机执行 `curl -s -o /dev/null -w '%{http_code}\n' http://43.128.154.242/users`（只读 GET，不带写操作）。
把 F4 从推断变成事实或推翻它。**预测先写下来，再跑。** 预测：_200_ 实测：_200_

**Q1（排序）** 段 0 → HTTPS → 后台（本稿建议），还是维持状态文件的 段 0 → 后台 → HTTPS？给出选择与一句理由。

**Q2（唯一验收）** 段 0 做完，用哪一条命令 + 什么输出算通过？（提示：至少要同时覆盖「该关的关上」和「该通的没被误伤」两侧）

**Q2 已冻结（2026-08-13）**：
- 判定结构：关上侧 `/users` 预期 **≠200**（具体码 Q5 定后回填）；通侧 = 登录 200 + 报表带业务锚点。
- 修正三处（review 阻断）：登录 URL `/auth/login`（不是 /login）；body 字段 `email`（不是 username）；月份断言 `month==3` 数字 + `year==2026`（不是字符串 "2026-03"）。依据：app.js 挂载 `/auth`、day4 §4.2「auth/login 只读 req.body.email/password」、D4-HTTP 实测输出 `{"orderCount":258,"year":2026,"month":3,...}`。
- 命令形态：可复制 shell 链（短路 + 空 token 守卫）。
- 未决回填位：`/users` 具体状态码（Q5 已回填 404）。
- **执行期修正（段 0 实测，2026-08-13）**：登录 token 路径是 `.payload.accessToken`（不是 `.accessToken`）——D4-HTTP 只记过「token [有]」，字段路径今天才暴露；金额字段实测名为 `totalSpending`（不是 totalAmount），2026-03 精确值 146988.82。
- 安全纪律：真实密码不上命令行（现场 `--data @-` stdin 或等价形态）。

**段 0 执行完成（2026-08-13 11:20）——Q2 验收两侧全过：**
- 关上侧：公网 `curl http://43.128.154.242/users` → **404**（白名单外 Nginx 直接返回）。
- 通侧：`LOGIN_OK`（zsh `read -s "VAR?prompt"` 语法 + token 取 `.payload.accessToken`）+ 报表首月 `{"orderCount":258,"year":2026,"month":3,"totalSpending":146988.82,...}`。
- 服务器内部三连：`/`→200、`/users`→404、GET `/auth/login`→404（Express JSON，证明 /auth 白名单转发正常）。
- 白名单配置：`location = /` + `/auth` + `/reports` 三个放行 + `location / { return 404; }` 兜底；`shop.bak` 已备份；`nginx -t` + reload 通过。
- **段 0 收口，进入段 2（week8 管理后台）。**

**Q3（层的选择——本段核心）** 「`/users` 不该对公网开」这条约束，应该落在哪一层？
- 反代层（Nginx 只放行必需路径）
- 应用层（`/users` 补认证 / 授权）
- 两层都做
写下选择，并回答：**你选的那层，防住的是谁？没防住的是谁？** 另一层不做的代价是什么？

**Q3 已冻结（2026-08-13）：选 A——只做反代层（今天）**，应用层鉴权记 Q8 欠账另排。
- 理由：符合段 0 边界（只处理「面」不改业务代码）；当前无第二条进应用的路（Node 127.0.0.1:3000 / Mongo 127.0.0.1:27017 / ufw default deny）→ Nginx 屏蔽后外部无法触达 `/users`；补鉴权属业务改动，划入后续迭代。
- review 纠正的两点（已吸收）：① 鉴权形态是 Express 中间件 `validateToken → requireRole('admin')`（routes/reports.js 范式），不是 Java 注解；② 当前 `/users` 对匿名/普通登录/admin 一视同仁 200，不是「已防住普通用户」。
- 保留的核心洞察：反代层防「门外汉（扫描器）」，应用层防「有票没座位（已登录无权者）」——威胁模型不重叠；反代层不认 token/角色，若未来公网需要合法 admin 访问 `/users`，A 方案的一刀切会误伤，届时切 C 或 B（开放规则 + 补鉴权）。
- 欠账：应用层 `/users` 无鉴权 → 记 Q8（安全债，偿还 = 按 reports.js 范式补中间件；验收 = 本地直连带普通 token 403 / admin 200 + 公网仍非 200）。

**Q4（面的定义）** 按 D1 冻结的唯一验收接口 + F10（前端只调 `/auth`、`/reports`）——公网面**最小**需要哪些路径？`GET /`（Hello World）算不算必需？给出你的白名单，并说明每一条为什么必须在。

**Q4 已冻结（2026-08-13）：白名单 = `/`（精确根）、`/auth`、`/reports`，其余（含 `/users`）全部进默认拒绝。**
- 逐条验证（读代码）：`/auth` 只有 POST /register + POST /login（auth.js:9-11）；`/reports` 只有 GET /customer-spending + GET /monthly-sales，**均带 validateToken + requireRole('admin')**（reports.js:15-32）；`/` 是 week2 根路由 Hello World（app.js:33-35）。
- 修正 1（事实）：`/` 今天不是「前端入口」——生产 `location /` 反代 3000，`/` 返回 week2 Hello World；week8 前端属段 2。`/` 必须开的理由 = week2 根路由 + D4-HTTP 已固化的公网存活验收锚点（`curl -I /` → 200）。
- 修正 2（砍掉加固建议）：「`/` 只允许 GET」不实现——week2 根路由本就只注册 GET（app.js:33），其他方法被 Express catch-all 404；Nginx 层再禁是「为未来配现在」，违反 Q3 最小改动。
- 惯性约束：白名单是**前缀**放行（`/auth`、`/reports`），今天前缀下无附加敞口（代码已确认）；未来在该前缀下新增路由需重新 review。
- 实现预告：需 `location = /` 精确根 + `/auth` + `/reports` 三个放行 + 一个兜底默认拒绝（`location /` 不能既放行又拒绝）。

**Q5（默认拒绝的形态）** 白名单之外的路径，你希望公网看到什么响应？404 / 403 / 直接断开？三者分别向扫描者透露了什么？

**Q5 已冻结（2026-08-13）：选 404（Nginx 直接返回，不转发到 Express）。**
- 理由（三段视角）：① 扫描者识别成本最高——公网 `/users` 与 `/this-path-does-not-exist-12345` 返回完全一致，无法区分「存在但屏蔽」与「不存在」；403 会明确告知「路径存在只是没权限」，诱导继续探测。② 合法消费者零影响——F10（前端只调 /auth、/reports，/users 无消费者）。③ 与 Q2/Q3/Q4 一致：Nginx 直接返回不转发（Q3-A）、默认拒绝所有非白名单（Q4）、验收命令可机器解析（Q2）。
- 选「直接断开」的代价（已排除）：curl 报 (52) Empty reply / (56) Connection reset，`-w '%{http_code}'` 失效，验收命令需改写为检测 `$?`/stderr，复杂度上升。
- **回填 Q2**：公网 `/users` 验收预期码 = **404**（`curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n"` → `HTTP_STATUS:404`）。
- 锦上添花观察点（排障信号）：白名单外拒绝 = Nginx 默认 **HTML 404**；白名单内未匹配路径（如 `/auth/foo`）被转发到 Express = **JSON 404 `{error:"路由不存在"}`**。HTML vs JSON 404 可区分「被 Nginx 拒」与「被 Express 404」（Q6 用）。

**Q6（失败路径预演）** 你的方案上线后，如果 `/reports/monthly-sales` 也 404 了，第一条排查命令是什么？在服务器内部 `curl 127.0.0.1:3000/reports/...` 与经 Nginx `curl 127.0.0.1/reports/...` 的差异，能把故障定位到哪一段？

**Q6 已冻结（2026-08-13）：排查链 = 先内后外三步二分。**
- Step 1：服务器内部 `curl -v http://127.0.0.1/reports/monthly-sales`（经 Nginx 80，绕过公网链路）——HTML 404 → Nginx 白名单误拦；401/200（带 token）→ Nginx 转发正常，跳公网层。
- Step 2（Step 1 为 HTML 404 时才需要）：`curl http://127.0.0.1:3000/reports/monthly-sales` 带 token 直连后端——200（真实数据）= Express 正常，故障收敛到 Nginx 规则；JSON 404（`{error:"路由 GET ... 不存在"}`）= Express 内部路由没挂对。**401 不是路由坏，是没带 token（正是 validateToken 在跑的证明）。**
- Step 3：内网正常公网异常 → 查公网网络层（腾讯云控制台安全组，day4 §5 归因预备：超时非拒绝 → 查控制台）。
- 核心信号（Q5 观察点复用）：Nginx **HTML 404** = 请求没到 Express；Express **JSON 404** = 已穿透到达内部。二分即可确定排查方向。
- 锦上添花已记录：排查命令应统一用 Q2 命令形态（email + stdin 密码）；ufw 出站默认 allow，公网层故障优先安全组。

**Q7（回滚）** 这次改动出错时怎么退回当前状态？退回动作有没有副作用？（对照 D4-HTTP 用软链管理站点启停的理由）

**Q7 已冻结（2026-08-13）：备份 + 覆盖回滚（本次只改一个文件，无需双版本软链切换）。**
- 当前结构事实（纠正）：D4-HTTP 是 `sites-available/shop` 完整文件 + `sites-enabled/shop` 软链；**不存在 shop.bak / shop.whiteonly 并存版本**。本次改动只编辑 `shop` 一个文件。
- 改动前纪律：`cp /etc/nginx/sites-available/shop /etc/nginx/sites-available/shop.bak` → 改 → `nginx -t` 通过 → `systemctl reload nginx`。
- 回滚分两级：
  - 最坏（`nginx -t` 没过/reload 未生效）：配置未生效，公网无影响；恢复备份 `cp shop.bak shop` → `nginx -t` 通过即可（无需 reload，因为从未加载新配置）。
  - 普通出错（reload 成功但验收失败，如 /reports 误拦）：`cp shop.bak shop` → `nginx -t` → `systemctl reload nginx` → 公网验收复测。
- 副作用：reload 平滑不重启 worker、不断长连接；不覆盖其他配置。软链双版本并存是更干净的长期方案，留给段 2 加站点时再考虑，今天备份覆盖足够。

**Q8（欠账登记）** 如果 Q3 选了「只做反代层」，应用层 `/users` 无鉴权这条是不是欠账？记到哪里、什么时候还？（`DEBT.md` 是给 AI 援助记账的，这条属于哪一类？）

**Q8 已冻结（2026-08-13）：本人主动决策的安全债（非 AI 援助欠账，不触发 DEBT.md）。**
- 归类：`/users` 无鉴权 = 本人主动用 Nginx 面封堵换「段 0 不改业务代码」——架构性技术债，责任方是本人，不属 `DEBT.md`（只记 AI 对黑名单 L2/误给 L3/L4/重建卡档）。
- 落位双轨：`LEARNING-STATE.md`「风险/欠账跟踪」管「当前风险」（Nginx 面缓解 + 触发条件：规则失效/内网暴露）+ `BACKLOG.md` 管「何时做」（P1，与既有 P1-6 登录限流同类；备注「先暂定，做不完顺延，不阻塞主线」）。
- 时间锚点：**暂定周五 8/15（D5 收口日）前**；与 D5 基建收口（重启/证书/端口/冷路径/demo 叙述）若挤兑，**优先 D5，补鉴权顺延至 D5 后第一个工作日**。demo 叙述 = 本人验收（能讲清），AI 只出素材。
- 偿还方式（黑名单 W4，本人实现 AI 只 review）：按 reports.js 范式给 /users 五个路由挂 `validateToken + requireRole('admin')`；验收 = 本地直连带普通 token 403 / admin 200 + 公网仍非 200。

---

## 4. 段 1 · D4-HTTPS：短冻结 4 题 + 现场问答

### 4.1 冻结（可推导，先答）

**H1（唯一验收）** 什么算 HTTPS 通了？写成一条可执行命令 + 预期输出。（提示：`curl -I https://…` 返回 200 只证明了一半——证书**被信任**这件事，靠哪个证据判定？）

**H2（信任边界变更）** 本段结束时 ufw 应该是什么状态？443 加进来之后，80 保留还是关掉？——**先答理由再答结论**（提示：ACME http-01 挑战走哪个端口？跳转从哪来？）

**H3（止步与回退）** 签发失败时，回到什么状态算「今天到此为止」？回退的触发条件写死几次重试 / 多长时间，避免陷在证书里耗掉整天。

**H4（失败归因起点）** 如果浏览器访问 sslip.io 域名超时，你的排查顺序是什么？把这几层排成序：DNS 解析 → 腾讯云安全组 → ufw → Nginx server_name 匹配 → 证书 → 后端。哪一层用哪条命令看？

### 4.2 现场一问一答（**不先答，遇到再讲**）

以下都属 `AGENTS.md` §4 定义的经验知识，先答＝猜，执行时由 AI 直接讲「这是什么、为什么、选哪个」：

- sslip.io 的解析形态、能不能从当前网络解析出来、`<ip>.sslip.io` 与 `<任意前缀>-<ip>.sslip.io` 的差别
- certbot 的安装来源（snap / apt）在 Ubuntu 22.04 上的现状与差异
- `certbot --nginx` **会改写你已有的 `sites-available/shop`**——它加什么、把什么挪走，以及为什么这会让「我配的」和「跑着的」不是同一份
- `--nginx` 插件 vs `certonly` + 手写 server 块：谁更适合「要看懂每一行」的学习目标
- ACME http-01 挑战的实际交互与目录写入位置
- Let's Encrypt 速率限制的形态（触发了会看到什么，多久解除）
- 续期机制装在哪（systemd timer），怎么**验证**它真的会跑（不是「它应该会跑」）

---

## 5. 段 2 问题库 · week8 管理后台（先答后做）

**A1（构建位置——本段最重要的一题）** 在服务器上构建，还是本地构建后把 `dist/` 送上去？
先答判据，再选。已知：B5 实测 available 1388 MB（mongod 187.4 + nodeapp 83.9 + nginx 8.5 之外）；`tsc -b && vite build` 的内存占用**没有实测过**。
- 如果选服务器构建：构建前后各跑一次什么命令来守住内存闸门？构建进程把 available 吃到多少就该中止？
- 如果选本地构建：产物怎么送？送上去之后，「服务器上跑的是哪个 commit」这个问题还答得出来吗？（对照 D2 选 git clone 整仓的理由）
- 这一题和 W11 的关系：CI/CD 里构建发生在哪台机器上？现在这个选择是在给哪一边打样？

**A1 已冻结（2026-08-13）：本地构建 + git 同步溯源（Yarn 3，不碰 npm）。**
- 判据（本人）：P0 内存闸门（B5 available 1388MB，tsc+vite 未实测，本地构建保生产稳定）→ P1 溯源 → P2 W11 打样（制品交付模式 Build Once/Deploy Everywhere）。
- 三项 review 修正（已确认）：① 构建命令 `cd week8-fullstack/src/frontend && yarn build`（package.json 在 frontend/ 下，build = `tsc -b && vite build`）；② 必须 Yarn 3（`packageManager: yarn@3.2.0`，npm install 会触发 lockfile drift——7/17 incident 封死）；③ 部署目标 = Nginx 静态站点 serve dist，**后端 nodeapp 不重启、无 PM2**（D3 是 systemd）。
- 溯源闭环：本地 commit+push → 服务器 `git pull` 到**同一 commit** → 本地该 commit 上 `yarn build` → 上传 dist → 服务器「git log -1 可答运行态对应 commit」。version.json 仅附加证据，不替代 git 溯源。
- 执行残留观察点（执行时处理）：dist 传输身份（ubuntu 传 nodeapp 家目录会被 750 挡——day4 §2.3 教训）；Nginx 新站点配置 = 段 2 核心步骤（非「若有」）；段 0 服务器配置改动在 /etc/nginx（不在 git），已被 day4b 计划稿落盘形态覆盖。

**A2（构建前提）** 由 F13（`?raw` 穿到仓库根）推出：构建命令必须在哪个目录下、需要哪些文件在场？如果只把 `frontend/` 拷到别处构建，会在哪一步、报什么形态的错？

**A2 已冻结（2026-08-13）：构建 CWD = `week8-fullstack/src/frontend`，但磁盘布局必须保留整仓相对结构。**
- 失败阶段：**Vite 打包期**（`tsc -b` 先过——`?raw` 有类型声明；动态 import 也由 Rollup 构建期解析）→ `ENOENT` 物理文件缺失 → 补 npm 包/改 tsconfig 都救不了。
- 文件集合（15 份，MarkdownNotes.tsx 实况）：`week8-fullstack/README.md` ×1 + `week8-fullstack/notes/*` ×5 + `week6-testing/notes/week6-testing-ci-mental-model.md` ×1 + `interview-prep/*` ×2 + `week9-deployment/notes/*` ×6。
- 禁止：拷出 `frontend/` 单目录构建——必然打包期 ENOENT。本地/服务器仓库必须完整 clone（浅克隆漏文件同样失败）。
- 修正点（本人已确认）：README 目标 = `week8-fullstack/README.md`（3 级，非仓库根）；W9 线 6 份即使不部署也必须在场；MarkdownNotes.tsx 在 `src/`（非 `src/components/`）。

**A3（工具链）** 由 F17/F18：服务器上没有 yarn 时，怎么用已提交的 `.yarn/releases/yarn-3.2.0.cjs` 把依赖装起来？（先答形态，再现场验 `yarn -v`）

**A3 已冻结（2026-08-13）：`node .yarn/releases/yarn-3.2.0.cjs`（CWD = `week8-fullstack/src/frontend`）。**
- 路径事实（review 修正）：`.yarnrc.yml` 在 frontend/ 下，yarnPath 相对它；release 实位于 `frontend/.yarn/releases/yarn-3.2.0.cjs`。命令 = `cd week8-fullstack/src/frontend && node .yarn/releases/yarn-3.2.0.cjs install && node .yarn/releases/yarn-3.2.0.cjs build`。
- 三机制（本人答对）：① npm install 会忽略 yarn.lock、重解析生成 package-lock.json → 两套锁冲突 → lockfile drift（7/17 incident），严禁 npm；② release 是自包含单文件 bundle，node 直接执行不依赖全局 yarn（corepack 是 Node 内置另一触发路径）；③ `nodeLinker: node-modules` = 传统真实 node_modules（非 PnP），Vite/TS 解析与 npm 无异。
- 执行决策（本人）：构建前 `rm -rf dist`（防旧产物混入）；`install --immutable`（严格按 yarn.lock，不写锁、CI 友好、检测漂移）。
- 执行期观察：frontend/ 已有 node_modules/ + dist/（本地构建过）+ vite.config.js / *.tsbuildinfo 生成物。

**A4（接线）** `VITE_API_BASE` 保持不设（走相对路径），还是设成 `http://43.128.154.242`？
- 保持不设 → 请求落在页面自己的 origin，Nginx 需要为**哪些路径**做反代？（对照 F10：`/users` 要不要？为什么这一题和 Q4 是同一题？）
- 设成绝对地址 → 会触发什么？后端有 CORS 中间件吗？（F9）

**A4 已冻结（2026-08-13）：选 A——保持 `VITE_API_BASE` 不设（相对路径），天然同源。**
- Nginx 8080 站点需反代：`/auth` + `/reports` → 127.0.0.1:3000；**`/users` 不要**（F10：前端从不调；段 0 Q5 已定默认 404）；`/` = serve dist 静态文件（root），与段 0 的 80 站点（`/` 反代 3000）是**两个 server 块、职责不同**。
- 推理（本人答对）：Q4 管「大门开哪几扇」（谁在真实调用 → 白名单），A4 管「进门后往哪个房间引」（前端真实发起 → 反代路径）——数据源都是 F10，同一问题的两面。
- B 方案（绝对地址）否决：页面 8080 vs API 80 = **跨域**（协议+域名+端口三者一致才同源）；POST + application/json = 非简单请求 → 先 OPTIONS 预检；后端无 CORS 中间件（F9）→ 无 `Access-Control-Allow-Origin` → 浏览器拦截。
- 事实精确化 3 点：页面端口是 8080（非 80）；`/` 静态 vs 反代是 8080 站点的内部分层（`location = /` root dist + `/auth`、`/reports` proxy_pass）；80/8080 两个 server 块并存。

**A5（静态服务）** 由 F8（hash 路由）：Nginx 的 `location /` 需要 SPA 兜底吗？如果照搬网上的 `try_files $uri $uri/ /index.html`，会带来什么后果？（提示：本该 404 的路径会变成什么？）

**A5 已冻结（2026-08-13）：无需 SPA 兜底；新增独立 `shop-admin` 站点（listen 8080），不动 `shop`（listen 80）。**
- hash 路由不需要兜底：hash 不发给服务器，前端 JS 接管路由；服务器只需在 `/` 返回 index.html。
- `try_files ... /index.html` 的代价：/nonexistent、/users 全变 200 返回首页，违背段 0 Q5「白名单外 404」；扫描器误判路径存在。
- location 匹配（review 修正）：普通前缀**最长前缀匹配**，与定义顺序无关——/auth/login 命中 /auth（proxy_pass），不会落进 / 的 try_files；定义顺序只在正则 location 间起作用。
- **阻断修正（listen 端口）**：初始稿写 `listen 80` 会与 shop 站点同监听冲突、破坏段 0 验收；冻结方案从头是 **8080 独立端口**。新建 `/etc/nginx/sites-available/shop-admin`（软链启用，不动 shop）。
- 落盘形态（已冻结）：`listen 8080` + `server_name 43.128.154.242` + `root .../frontend/dist` + `index index.html`；`location /auth` + `/reports` = proxy_pass 3000；`location /` 无 try_files，dist 里不存在 → Nginx 404。
- CORS 已规避（本人提问，已答）：相对路径同源 → 不触发 CORS/OPTIONS，后端无 CORS 中间件完全无碍。

**A6（暴露面——与段 0 同一条原则的第二次应用）** 由 F11/F12/F15/F16：管理后台的构建产物里必然带着整个展板，包括 `w9Facts.ts` 的服务器拓扑、端口面、版本号，和两份面试问答稿（184 KB 原文）。
- 这些放在一个**任何人可访问**的端口上，你接受吗？
- 「默认不显示」（`REVIEW_ONLY_TABS`）和「不在产物里」是同一件事吗？用什么命令能证明它在不在产物里？
- 三个选项——(a) 接受（IP 本来就公开）、(b) 在入口加一层访问控制、(c) 改代码做一个「只要后台」的构建开关（前端属白名单，AI 可实现）——选哪个，代价各是什么？

**A6 已冻结（2026-08-13）：今天 = (a) 接受现成产物上线 8080；拆解记 BACKLOG P1（前端白名单 · AI 实现，当天尽力否则部署后下个开发单元）。**
- 决策脉络：本人三连主张「代码层双系统解耦」→ review 澄清：拆解（构建层双产物）≠ 换端口（部署层）；白名单归属正确（前端由 AI 维护），但拆解是 week8 结构优化非今天部署任务，且拆解唯一价值 = 让面试稿/部署笔记/拓扑**不进 admin 产物**（从编译期「不给」，比 Basic Auth 彻底）。
- 今天定 (a) 理由（本人口径）：「先保证 http 系统跑起来，https 优先级相对没那么高，接受顺延」——段 0 已完成，段 2 部署是剩余主线的核心动作；现成产物问题由拆解在未来消除，今天不欠新债。
- (b) 否决（明文 Basic Auth）：http 下 `Authorization: Basic` 是 base64 编码非加密，浏览器长期缓存 Basic 凭据、同源所有请求自动携带——明文阶段新增第二个「总钥匙」，与 Q1 已接受的「8080 明文表单」同笔代价第二次支出；正确时点 = HTTPS 之后作挡扫描器附加层。
- REVIEW_ONLY_TABS ≠ 不在产物里：只是默认不显示 tab，数据仍在 bundle。证明命令 `grep -o "backend-qa-sheet\|43\.128\.154\.242" dist/assets/*.js`。
- 诚实量级：拓扑（IP/端口/Nginx 版本）本是公网事实（nmap 可扫），面试稿/部署笔记是学习资产非服务器凭据——公开是「材料公开」顾虑，非安全漏洞。
- **周计划变更（连带）**：HTTPS 明确顺延（D4-HTTPS 不在今天收口）；D5（8/15）的「证书续期检查」依赖证书在位 → 需在收口时更新 week9-plan/LERNING-STATE，D5 该项相应调整或 D5 顺延决策。
- 拆解 BACKLOG 条目：week8 前端拆解（admin / showcase 分离为独立构建入口，面试稿/部署笔记/拓扑不进 admin 产物）；判据 P1（真实工程实践——产物面收敛/职责分离）；前置 = 今天部署完成；实现 = 前端白名单 AI 直接实现，本人 review 结构/验收（双产物双部署口径）；时间 = 段 2 验收后当天尽力，否则部署后第一个开发单元。

**A7（端口 vs 路径）** 冻结方案是 8080 独立端口。如果段 1 先做完拿到了域名与证书，后台还要不要独占 8080？（提示：8080 上的明文登录表单 vs 443 上的同一个表单，差别是什么？）

**A7 已冻结（2026-08-13）：今天 8080 独占；将来 HTTPS 阶段 admin 迁移 443；拆解双产物按「认证需求」分口。**
- A（今天）：8080 独占干扰最小——段 0 刚收敛 80 的 URL 面，再往 80 加 /admin 子路径 = 回「改 shop 白名单」循环，可能误伤 /users→404；独立端口不动 shop、互不影响、回滚清晰。
- B（将来 HTTPS 顺延后）：admin 走 `https://<域名>/`（443，独立 server 块 listen 443 ssl + root dist + /auth /reports 反代），8080 可退役或降级通道；今天 shop(80)/shop-admin(8080) 保留，届时迁移。**不合并同 server 块**——段 0 已定 80 白名单语义，合并会改路径映射破坏约定。
- C（拆解衔接）：判据 = 谁需公网访问 / 谁需登录 / 谁承担首屏。showcase（展示面）公开路径；admin（管理面）认证路径。w9Facts 归属查清（`w9Topics.ts` 类型 + `W9Board.tsx` 数据引用）→ **是 showcase 树数据源，非 admin**——拆解后 admin 产物不含 w9Facts/面试稿/部署笔记。
- 拆解提示词（用户请求，白名单 week8 前端，AI 实现时用）：见当日笔记附段；核心 = 双 vite 入口 admin.html / showcase.html + App 拆两版（admin 不含 Showcase 树）+ 保持 hash 路由/相对路径 API/Yarn3 + 验收 = 双产物各自 build 通过、admin 产物 `grep -c "backend-qa-sheet\|w9Facts"` = 0。

**A8（信任边界变更）** 本段结束后 ufw 应该是什么状态？——并预演一条：**ufw 放行 8080 之后本地仍然连不上**，最可能是哪一层？（D4-HTTP §5 已经写下过这条归因预备，但没触发过）

**A8 已冻结（2026-08-13）：ufw 入站 = 22 + 80/tcp + 8080/tcp 三段（双栈），3000/27017 保持不在列表。**
- ① 结论：22（SSH）/ 80（段 0 API 面 + 根）/ 8080（admin 静态站）；3000、27017 不进公网 = 最小暴露——Node 仅 loopback 由 Nginx 内部反代、MongoDB 绝不公网（D1 契约延续）。
- ② 排查链（先内后外，与 Q6 同构）：
  - Step 1：服务器内部 `curl -v http://127.0.0.1:8080`——通/不通二分。
  - 通 → 网上层：`sudo ufw status verbose` 确认 8080/tcp ALLOW → 腾讯云控制台安全组（day4 §5 归因预备：控制台与 ufw 两层防线）→ 本地 `nc -vz 43.128.154.242 8080`。
  - 不通 → Nginx 层：`sudo ss -tlnp | grep 8080` 是否监听 → sites-enabled 软链指向 shop-admin？→ nginx -t → reload。
  - 内部通+外部不通 = 安全组/防火墙；内部不通 = Nginx 站点。
- 预演未触发（记录备查）：ufw 放行后外部不通的归因次序已冻结，执行时若触发按此链查。

--- 以下为 week8 前端解耦提示词（用户 2026-08-13 请求，白名单 week8 前端；供 A6 BACKLOG 拆解条目实现时使用）---

**week8 前端解耦提示词（admin / showcase 双入口）**

## 目标
把 `week8-fullstack/src/frontend`（Vite+React+TS，Yarn 3）从「单 bundle 含 showcase 展板树」重构成「admin / showcase 双独立入口产物」，使 admin 管理后台产物**不包含** showcase 树内容（面试问答稿 ×2、W9 部署笔记 ×6、w9Facts 拓扑数据）。

## 当前结构事实（先读这些再动手）
- `App.tsx` 静态 import `Showcase`、`Dashboard` 是 lazy；`VITE_SHOWCASE_ONLY` 是唯一开关方向（管理后台构建必然带展板）
- `Showcase` → `MarkdownNotes`（15 份 .md 动态 `import(...?raw)`，会进产物）；`w9Facts.ts` 被 `w9Topics.ts`（类型）+ `W9Board.tsx`（数据）引用——都是 showcase 树
- hash 路由（`#/admin`、`#/showcase`）、API 相对路径（`VITE_API_BASE` 默认空串）、构建命令 `tsc -b && vite build`
- Yarn 3：必须 `node .yarn/releases/yarn-3.2.0.cjs`（CWD = `week8-fullstack/src/frontend`），严禁 npm（lockfile drift 2026-07-17 事故）

## 要做
1. 新增第二个 HTML 入口（admin.html / showcase.html 各一，明确产物各自 serve 哪个入口）
2. App 拆成两版：admin 版仅 Dashboard/登录/报表；showcase 版完整展板（W9 板、面试稿、部署笔记等）——**排除整棵 Showcase 依赖树**才能让材料不进 admin 产物
3. 保持 hash 路由、相对路径 API、现有组件复用（不重写业务逻辑）

## 验收
1. 两入口各自 build 通过
2. admin 产物 grep 零命中：`grep -rEl "backend-qa-sheet|db-review-sheet|w9Facts|43\.128\.154\.242" admin产物目录/` 无输出
3. showcase 产物保留全量（grep 有命中）
4. 双产物在静态服务下正常打开；admin 登录 + 报表走通（相对路径 API）

## 边界
- 不动后端 API、不动 Nginx 部署语义（admin→8080 已上线；showcase 产物将来按 A7 框架另走公开路径）
- 最小集：入口拆分 + 依赖树排除；不动样式与业务逻辑

**A9（唯一验收）** 本段做完，哪几条证据算通过？至少要覆盖：静态页面出得来、登录走得通、报表出真实数据、**以及 week2 原有路径没被新站点抢走**。

**A9 已冻结（2026-08-13）：四条证据全过才收口；执行速览 Basic Auth 为笔误已撤销（符合 A6 冻结）。**
- 证据 1：8080 静态页 index.html 200。
- 证据 2：/auth/login 登录 200 + token（`.payload.accessToken`）。
- 证据 3：带 token /reports/monthly-sales 首月锚点 `{"orderCount":258,"year":2026,"month":3,"totalSpending":146988.82}`。
- 证据 4（80 回归）：段 0 三连重跑——`/`→200、`/users`→404、登录+报表锚点（`/auth/login` + `email` 字段 + `month==3` 数字 + `totalSpending`）。
- 门槛：样式/视觉不阻断；登录/报表/80 回归任一失败即回滚（`rm sites-enabled/shop-admin` 软链 + reload，或恢复 shop.bak）。
- 执行冲突澄清：速览「Basic Auth」= 笔误（选项 1），今日不加任何 Nginx auth——A6 (a) 冻结延续；前端页面内 admin JWT 登录是业务层，与 Nginx 无关。
- 修正后 shop-admin 配置 = A5 冻结形态（listen 8080 + root dist + location /auth /reports 反代 + location / 无 try_files），无 auth_basic。

**段 2 问题库 A1–A9 全部冻结（2026-08-13 11:54），进入执行阶段。**

**段 2 执行完成（2026-08-13 15:33）——B1–B5 全过，A9 四证据齐：**

- **B1 本地构建**：解耦后 admin 产物 = `index.html` + `admin.html` + assets/（8 文件，329 modules / 1.40s）；`grep -rEl "backend-qa-sheet|db-review-sheet|w9Facts|43\.128\.154\.242" dist/` **零命中**（拆解验收 2 ✓）；dist 无 showcase.html 是设计（`VITE_SHOWCASE_ONLY` 二选一构建，今天要 admin 产物）。
- **B2 同步 + 传输**：凌晨验证时的服务器 HEAD 是 `ed982ac feat: 更新 host 获取方式`（非任务稿所记 b5e9c84，当天本地又提交了 4 个到 `89bc048`）；`sudo -u nodeapp git pull` **快进**到 `89bc048`（30 文件，`week2-express/src` 零改动 → nodeapp 运行态不受影响）；`/home/nodeapp` 750 → ubuntu `cd` 被拒（day4 §2.3 同款坑，处理 = 操作身份匹配属主，不改目录权限）；scp 首次方向错误（服务器→本机无密钥）→ 正确 = **本地** `scp -i ~/.ssh/admin.pem -r dist ubuntu@…:/tmp/dist` → `sudo -u nodeapp rsync -a --delete /tmp/dist/ …/dist/` → `rm -rf /tmp/dist`（落盘属主 nodeapp）。
- **B3 Nginx shop-admin（8080）**：`sites-available/shop-admin`（listen 8080 + root dist + `/auth` `/reports` 反代 3000 + `location /` 无 try_files）→ 软链启用 → `nginx -t` ✓ → reload；**权限雷实证**：`/home/nodeapp` 750 无 other x → Nginx worker（www-data）读静态文件 **403 Forbidden**；`sudo chmod o+x /home/nodeapp` → `drwxr-x--x` → **200**。学习点：**反代（proxy_pass）不读磁盘，静态服务（root）要读磁盘**——80 站点从没被 750 影响过就是这个原因。
- **B4 ufw**：`allow 8080/tcp` → 22 + 80 + 8080 双栈 ALLOW IN，Default deny，**3000/27017 不在列表**（A8 三段信任边界达成）。
- **B5 排障 + A9 四证据**：8080 公网 `curl -m 8` 全部 `Connection timed out` → 三层二分（服务器 `ss -tlnp` 见 `0.0.0.0:8080 LISTEN` + ufw 已放 + 公网仍 SYN DROP）→ 根因 = **腾讯云控制台「防火墙」未放行 8080**（D4 只放过 80，day4 §5「控制台与 ufw 两层防线」第二层实证）→ 控制台添加自定义规则 `TCP 8080 / 0.0.0.0/0 / 允许` → 诊断变 **400 JSON**（`{"code":400,"message":"缺少必填字段…"}` = Express 后端响应，全链路贯串）→ **A9 四证据全过**：
  - 证据 1：8080 静态 index.html **200**（Content-Length 843）
  - 证据 2：`POST 8080/auth/login` → **`{"code":200,"message":"登录成功","payload":{"accessToken":"eyJ…"}}`**
  - 证据 3：带 token `8080/reports/monthly-sales?months=6` → **`258 2026 3 146988.82`**
  - 证据 4（80 回归）：`/` → 200、`/users` → 404、80 登录 + 报表首月 **258 2026 3 146988.82**
- **系统变更记录**：`/home/nodeapp` 权限 750 → **751**（`drwxr-x--x`，other 可穿越不可列目录）；腾讯云控制台新增 8080/TCP 入站规则（信任边界 = 22 + 80 + 8080，与 ufw 一致）。
- **AI 辅助范围（本段）**：Nginx 站点配置 / scp-rsync 命令形态 / 控制台操作 = 白名单最小形态；黑名单（鉴权、拓扑推理）零实现；权限 403 根因与「反代不读盘」为 L1 讲解。未触发 `DEBT.md` 记账。

---

## 6. 今日明确不做

- 不做 W10 内容：故障演练、日志聚合、监控告警。
- 不做 W11 内容：Jenkins、Docker、任何自动化流水线脚本。
- 不做 Java stretch（受内存闸门约束，排在主线之后）。
- 不做时区边界修正（属代码改动，排 D5 决策）。
- 不重构 week2 的分层结构；段 0 只处理「面」，不顺带改业务代码。

---

## 7. 收工判据

| 段 | 收工条件 | 未达成时的处理 |
|---|---|---|
| 段 0 | Q2 定义的验收命令通过（该关的关上 + 验收接口仍 200） | 不进入后续段落 |
| 段 1 | H1 定义的验收通过；或 H3 的回退条件触发 → 记录失败形态，回退到 HTTP 基线 | 回退不算失败，算「路线不可用」的实证结论 |
| 段 2 | A9 的四条证据齐 | 只差视觉/样式不阻断；差登录或报表则阻断 |

---

## 8. AI 辅助记录（本稿）

- 本稿只做**读代码 + 出题 + 排序建议**，未对任何黑名单知识点给出实现或骨架：段 0 的「授权落在哪一层」（W4）、`/users` 的鉴权写法（W2/W4）均只出题。
- F1–F18 是代码事实核对，属 review 性质；F4 明确标为推断并配 Q0 实测，不冒充事实。
- 段 2 的 Nginx 站点配置、yarn 命令形态属白名单，**执行时**给最小形态，本稿刻意不预先给出——先答后做的顺序不能被现成配置破坏。
- 未触发 `DEBT.md` 记账。
