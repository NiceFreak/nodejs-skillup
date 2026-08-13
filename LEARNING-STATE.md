# 当前学习状态

> 最后更新：2026-08-13（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**2026-08-13——D4-HTTPS + D4-c 收口：443 + sslip.io + certbot 证书 + 学习展板 8081 + 登录门禁**。**W9 全部主线（D4-HTTP / 段 0 / 段 2 / D4-HTTPS / D4-c）已收口**；剩 D5（8/14，周五）重建与收口。
- D4-HTTP 执行记录：[`day4-http-reverse-proxy.md`](./week9-deployment/notes/day4-http-reverse-proxy.md)；D4-b（段 0 + 段 2）+ D4-HTTPS 执行记录：[`day4b-https-and-admin-plan.md`](./week9-deployment/notes/day4b-https-and-admin-plan.md)；D4-c（学习展板 8081 + 门禁 + 服务/暴露边界）执行记录：[`day4c-showcase-gate-deploy.md`](./week9-deployment/notes/day4c-showcase-gate-deploy.md)；周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓ D4-HTTP✓ **D4-b✓ D4-HTTPS✓ D4-c✓** 已勾选；**D5 8/14 待做**——重启验证、端口边界、冷路径复核、demo 证据与项目叙述、`certbot renew --dry-run` 续期证据）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（冻结不变）。
- 服务器：腾讯云首尔二区，公网 IPv4 `43.128.154.242`，Ubuntu 22.04.5，2 核 / 2 GB / 40 GB SSD，到期 2026-11-10；SSH 密钥认证唯一通道（ubuntu + admin.pem，** 本地路径 `~/.ssh/admin.pem`**），网页终端 root 带外应急。
- **信任边界（8/13 晚更新）**：ufw 22 + 80 + **443** + 8080 + **8081**/tcp 双栈 ALLOW（3000/27017 不在列表）；**腾讯云控制台防火墙同步放行 22/80/443/8080/8081**（2026-08-13 实测「放行前 timeout → 放行后 refused」差分 + 8081 公网 curl 直接 200）。
- **系统变更（8/13 晚更新）**：`/home/nodeapp` 权限 750 → 751（`drwxr-x--x`，Nginx 静态服务需目录穿越权限；反代不读盘所以 80 站点未受影响）；`/home/nodeapp/nodejs-skillup/week8-fullstack/src/frontend/dist-showcase/`（学习展板产物，nodeapp 属主）。
- W9 周期：**实际收口 8/14（周五）**——8/11 记下的「顺延到 8/15」没有发生，D3/D4 都按期压回来了；更正说明见 week9-plan §4 排期修订。

## 最近完成

- **2026-08-13（D5 前置之二：展板 6 块 → 9 块，拆一块加两块）**：
  - **触发**：本人提问「D4 的学习和 roadmap 不需要新增展板吗」。核查后确认需要，并暴露出重建那轮「段 0 不单开一块」的克制**用错了判据**——本板规则是「每块只回答一个问题」，不是「每块讲一条原则」。端口面问网络层、段 0 问授权层，是两个问题；合并后的板桌面高 4443px，比第二长的还高 17%。
  - **更要紧的发现**：grep 确认 day4b 有两类内容零进展板——「止损/连败/account key/构建位置/溯源/制品/速率限制」全部零命中；而「回滚」「备份」只出现在生产对照的**缺失**栏，等于把 8/13 那天真正依赖过的两级回滚呈现成「还没做」。
  - **结果 9 块**：① 信任边界与端口（URL 面移出后只答网络层）② **URL 面与授权层（拆出）** ③ **证书与信任（新增）** ④ 故障分叉 ⑤ systemd 失败模式 ⑥ **改一台在跑的机器（新增）** ⑦ 端到端验收链 ⑧ 反代 header 决策 ⑨ 契约销账与闸门。顺序是阅读弧线：三层结构 → 两类故障 → 改动纪律 → 验收 → 细节 → 收束。
  - **③ 证书与信任**：D1 契约头号交付物此前竟无自己的板。空间编码 = 真嵌套的签名关系（系统根证书库 → LE 中间证书 → 我的证书 → SAN 匹配）+ 90 天时间轴 + `certonly` vs `--nginx`（后者改写你的 shop，让「我配的」与「跑着的」不是同一份）+ LE 速率限制。
  - **⑥ 改一台在跑的机器**：全板唯一讲过程纪律的一块。空间编码 = 改动生效的深度（`nginx -t` 没过反而更安全，因为配置从未加载）+ 止损线（连败 3 次 × 间隔 ≥5 分钟）+ 六步回退清单 + 保留 `/etc/letsencrypt` account key + `shop.bak` 活破口（停在段 0 之前，回滚会把 URL 面收敛一起退掉且无报错）。
  - **执行期抓到两处**：① 信任链第一版渲染成四张**平铺**卡片——`.map()` 产出兄弟节点，后代选择器从未匹配，嵌套关系整个丢失，违反本板硬要求，改递归组件后成立；② 「纯文本里的 Markdown 语法」**第二次出现**（`**强调**` 与反引号被原样显示），已全改为靠语序表达——同类缺陷复发说明是习惯不是手误。
  - **验证**：typecheck + 生产构建通过；**九块 × 桌面 1440 / 移动 390 全覆盖断言**，无横向溢出、无控制台报错、每块面板高度 ≥400px；修掉 90 天轴末刻度把页面顶宽到 1524px 的溢出。
  - **记 BACKLOG（非阻断）**：⑩ 产物与溯源（A1/A2/A6 + 双入口解耦素材已齐），主体偏 week8 自身发布链路，暂缓。
- **2026-08-13（D5 前置：展板按主线收口重建 + 笔记对账）**：
  - **动因**：六块展板建于 8/12，事实截到 D4-HTTP；8/13 三件事收口后展板开始**谎报**——443 标「待做」、`https`/`cert-renew` 两条契约画在「仍欠」列、D4 验收写着「不证明 HTTPS——443 从未落地」、反代块贴的还是段 0 之前的 `location / { proxy_pass }`。先修谎报，再补新事实。
  - **A 修谎报（6 处）**：443 端口行改实测（`0.0.0.0` + ufw/安全组双放行）；`https` 与 `cert-renew` 两条契约销账到 D4（续期同日销账，不留 D5）；D4-HTTP 验收的 limits 改写；生产对照把 HTTPS/续期移入「已做」；80 落盘配置换成段 0 后的白名单形态；**安全组档位由 `derived` 升为 `measured`**（8/13 两次实动控制台 + timeout→refused 差分）。
  - **B 补新事实**：三个对外面（80/443/8080）、8080 端口行、段 0 URL 面收敛整块（白名单 + 404 兜底 + Q5 三种拒绝形态 + HTML/JSON 404 二分）、两层威胁模型（反代防门外汉 / 应用防有票没座位）、Q8 安全债卡、两次新验收（D4-b 与 D4-HTTPS H1）、TLS 排障两相位（H4）、认知修正 12 → **14 条**（⑬ 反代不读盘 vs 静态读盘、⑭ 控制台与 ufw 两层防线）、notes tab 接入 day4b 原文。
  - **本轮新长出的两条结论**：① **覆盖段这把尺子有边界**——三次公网验收覆盖段完全相同，入口面却是 80 全量 / 80 削窄+8080 / 443 TLS，故验收链新增「入口面」一格；② **安全组从反推升格为观察**，是全板唯一一次档位升级。
  - **三处克制**：链路图仍四跳（三面另表）、Q8 不混进 D1 契约表、段 0 不单开第七块（与端口面同属一条最小暴露原则）。
  - **验证**：typecheck 通过；`VITE_SHOWCASE_ONLY=1` 生产构建通过（day4b 单独切片 29.98 kB / gzip 23.70）；静态入口零后端依赖 grep 无匹配；标题与 `/skillup-week8/` 子路径正确；桌面 1440 + 移动 390 双视口逐块截图，无横向溢出、无控制台报错。**未发布 Pages**（该仓库不在本次会话）。
  - **日期更正**：8/11 记的「收口顺延到 8/15」最终没发生，且 8/15 是周六、day4b 又写成「周五 8/15」——**D5 实为 8/14（周五）**，已在计划 / 本文件 / roadmap / day3 / day4b 统一更正并留下更正说明。
  - **AI 边界**：week8 展示前端属 `AGENTS.md` 白名单，本轮由 AI 直接实现（L3/L4），改动只是既有事实的重新呈现，不产生新技术结论；未触发 `DEBT.md`。
- **2026-08-13（D4-HTTPS 完整收口：443 + sslip.io + certbot，H1 验收通过）**：
  - **H1–H4 短冻结**（day4b §4.1）：H1 两轮 review 冻结（唯一验收 = 本地开发机 `curl -sS -o /dev/null -w "HTTP_CODE:%{http_code}\nSSL_VERIFY:%{ssl_verify_result}\n" https://43-128-154-242.sslip.io` → `200` + `0`）；H2 冻结（ufw 22+80+443+8080、80 保留：http-01 首发+续期、段 0 锚点、301 发射台）；H3 冻结（签发连败 3 次/间隔 5 分钟 → 回退；回退基线 80/8080 双 200；先验基线再撤销、最后复验）；H4 两相位分叉（超时相位 DNS→外部 TCP→本地 ss+ufw→差分安全组；非超时相位 TLS/SNI→证书→后端）。
  - **执行链**：本地预检（dig ✓ `43.128.154.242`、443 基线超时）→ ufw 443 → 控制台 443（**timeout→refused 差分实证**）→ apt 装 certbot 1.21.0（certbot.timer 自动创建）→ `certbot certonly --nginx` 签发成功（fullchain/privkey 在位，2026-11-11 到期，SAN=`43-128-154-242.sslip.io`）→ 手写 `shop-ssl`（listen 443 ssl + 与 80 同白名单 + 兜底 404）→ `nginx -t` + reload → 服务器自证 200。
  - **H1 验收（2026-08-13 16:14）**：**`HTTP_CODE:200 SSL_VERIFY:0`**——certbot 全链 + 域名 SAN + 有效期通过；HTTPS `/users`→**404**（443 继承段 0 URL 面收敛）；80/8080 回归全过（`/`→200、`/users`→404、8080 `/`→200）。
  - **续期证据**：certbot.timer `enabled` + NEXT 8/14 04:13 CST + journal 实测启动记录（`Started Run certbot twice daily`）；**`sudo certbot renew --dry-run` 实跑成功**——`Congratulations, all simulated renewals succeeded: …/fullchain.pem (success)`（模拟续期完整走通，无需留 D5）。
  - **安全债（Q8）**：应用层 `/users` 无鉴权（Nginx 面已封堵）——暂定周五 8/14 D5 前还；与 D5 基建挤兑则顺延 D5 后第一个工作日（BACKLOG P1，非 DEBT.md）。
  - **遗留观察点**：`shop.bak` 是段 0 修改前备份（161B，无白名单）——若回滚 `shop` 需先刷新备份；建议 D5 更新。
- **2026-08-13（D4-b 完整收口：段 0 URL 面收敛 + week8 管理后台 8080，A9 四证据全过）**：
  - **段 0（公网 URL 面收敛）**：`/users` 公网 404（Nginx 白名单外直接返回）、登录 + 报表锚点 258/146988.82 两侧全过；白名单 = `location = /` + `/auth` + `/reports` + 兜底 `location / { return 404; }`（Q2–Q8 冻结记录见 day4b）。
  - **段 2（week8 管理后台 8080）**：前端解耦（admin/showcase 双入口，BACKLOG P1）已完成；本地 `yarn build` admin 产物（8 文件，`grep backend-qa-sheet|w9Facts|43.128.154.242` admin 产物零命中）→ 服务器 `git pull` ff 到 `89bc048`（运行代码零改动）→ scp dist 落盘 nodeapp 属主 → Nginx `shop-admin` site（listen 8080 + root dist + /auth /reports 反代）→ ufw 8080 → **A9 四证据全过**：8080 `/` 200 / 登录 200 + token / 报表首月 `258 2026 3 146988.82` / 80 回归 `/` 200 + `/users` 404 + 报表锚点。
  - **执行期关键实证**：① **反代不读盘 vs 静态服务要读盘**——`/home/nodeapp` 750 无 o+x → Nginx www-data 静态服务 **403**；`chmod o+x /home/nodeapp`（`drwxr-x--x`）→ 200；② **控制台 + ufw 两层防线**——ufw 放行 8080 后公网仍 SYN DROP → 根因腾讯云控制台「防火墙」未放行 8080（D4 只放过 80）→ 控制台加规则后全链路贯串（400 JSON 实证）；③ scp 方向错误（服务器→本机无密钥）→ 正确形态 = 本地 `scp -i ~/.ssh/admin.pem`；④ 服务器 git 曾停在 `ed982ac`（非任务稿所记 b5e9c84），ff 快进解决。
  - **安全债（Q8）**：应用层 `/users` 无鉴权（Nginx 面已封堵）——暂定周五 8/14 D5 前还；与 D5 基建挤兑则顺延 D5 后第一个工作日（BACKLOG P1，非 DEBT.md）。
- **2026-08-12（D4-HTTP 完整收口：五项全过 + 公网验收达成）**：
  - ① 凭据轮换：admin 测试密码改强（本地 openssl 生成 → 密码管理器记录 → 服务器内存 bcrypt(12) → updateOne 写库，`modifiedCount:1` → 从密码管理器值实测登录 200）。临时脚本已删、git 干净。
  - ② Nginx：apt 官方源 1.18.0，`active (running)` + `enabled`（开机自启内置），内存 8.5M（B5 闸门绿灯验证延续）。
  - ③ 反代：`sites-available/shop` → `listen 80` + `server_name 43.128.154.242` + `proxy_pass http://127.0.0.1:3000` + `Host $host`。删默认站点软链。服务器内部 `curl -I 127.0.0.1/` = 200 + X-Powered-By（反代贯通证据）。
  - ④ ufw：放行 80/tcp 双栈；status = 22 + 80 双栈 ALLOW，27017/3000 不在列表（Default deny 覆盖），SSH 会话未断（22 仍通）。
  - ⑤ 公网验收（本地开发机非 SSH）：`curl -I http://43.128.154.242/` = 200 + Server: nginx + X-Powered-By；POST /auth/login = 200 + token；GET /reports/monthly-sales?months=6 = 200 + [{"orderCount":258,"year":2026,"month":3,...}]。
  - **关键设计结论**：反代 header——理论四类（XFF/XFP/Host）+ trust proxy；读代码确认应用不消费 req.ip/protocol/hostname → 只配 `Host $host`，不配 XFF/XFP、不做 trust proxy（最小改动，详见 day4 笔记 §4.2）。
  - **三个执行期认知修正**：ESM 文件脚本 import 锚在脚本文件位置（/tmp 找不到 node_modules，与 node -e 锚在 cwd 对称）；sudo 默认 env_reset 丢弃环境变量（需 `--preserve-env=VAR`）；旧密码未留存 → 「旧证 401」改为「单证 + 逻辑覆盖」验收（新 200 已充分）。
- **2026-08-12（D3 完整收口：阶段 A + 阶段 B）**（既有记录，保留）：
  - 阶段 A（槽位 0–j）：D2 验收句四项全满足（nodeapp+mongod systemd active、ss 见 3000/27017）；bcrypt prebuildify 零编译、Mongo 8.0.29 认证+loopback、.env 三键、HOST 落地、nodeapp.service 七条契约实证。
  - 阶段 B（五项全过）：
    - B1：seed 2000 用户 + 5057 订单；**实测定推翻 3.1 自查预测**（内置 readWrite 角色含 createIndexes，email unique 索引建成）。
    - B2：服务器内部端到端 200——register admin → 提权 → login → monthly-sales 6 个月真实聚合数据（月份序列/量级锚点核验通过）。
    - B3：reboot 后双服务自起（enabled ×2 + active）+ 接口 200；**时区边界观察点闭环**（CST vs 聚合 UTC，7 月 3 单归因）。
    - B4：**欠账销账**——第一轮实证 Wants 连带拉起 mongod（设计盲区暴露）；第二轮快失败注入（JWT_SECRET 改短）→ StartLimitBurst 触发 → failed 停住 → 恢复 200。
    - B5：实测 RSS mongod 187.4MB / nodeapp 83.9MB / available 1388MB——**D4 Nginx 内存闸门绿灯**，实证 WiredTiger cache 按需增长不预分配（空载 93.1M → 187.4M）。
  - 收尾：周计划 D1/D2/D3 勾选；口语稿生成；`.env` 曾短暂改短（B4 注入），已还原备份。

## 当前主线

```text
下一步 = D5（8/14）重建与收口：重启验证、端口边界、冷路径复核、demo 证据与项目叙述、续期 dry-run 完整证据。
W9 主链（HTTP + HTTPS + 管理后台 + 学习展板）已全部收口并公网可访问。
```

**状态澄清（2026-08-13 晚更新）**：`http://43.128.154.242`（80，段 0 收敛后的 API 面 + 根）、`http://43.128.154.242:8080`（8080，week8 管理后台）、**`https://43-128-154-242.sslip.io`（443，D4-HTTPS，HTTP_CODE:200 SSL_VERIFY:0）**、**`http://43.128.154.242:8081`（8081，学习展板 + 登录门禁）** 四个面均公网可访问。

## 当前阻塞与风险

- **Swap=0（持续，Nginx 已加仍安全）**：B5 实测 available 1388MB + Nginx 8.5M 实测——余量充足；若后续收紧，选项为降 cacheSizeGB / 清缓存重启 / 加 swap（副作用 OOM 用磁盘兜底）。
- **sslip.io 路线待验证（持续，D4-HTTP 已建立回退基线）**：D4-HTTPS 实际签发不可用则回退纯 IP + HTTP——**该回退路径现已可用**（`http://43.128.154.242` 200）。
- **服务端 8.0 vs 本地已验证组合 mongo:7**：8.0.29 已装，B1 seed + B2 端到端实证读写/聚合兼容。
- **时区边界观察点（D5 决策）**：聚合 `$year/$month` 按 UTC、服务器 CST(UTC+8)，凌晨订单跨月归因偏差 3 单/月量级；D5 决定是否按业务时区修正（`$dateToString` 指定 timezone）。
- **凭据注意（不入笔记，用户知晓）**：对话中出现过 nodeapp 密码占位/明文形态，用户选择暂不轮换、走完流程后续处理；`.env` 内容值后续一律 redact。
- **已解决（不再跟踪）**：bcrypt 编译 OOM 风险（b/c 实测解除）；「启动即失败契约」欠账（B4 销账）；D2 启动顺序悖论（问题 9 选 A + 验收句落地）；**测试凭据 admin@example.com 轮换（D4-HTTP ① 完成，密码管理器托管 + 登录实测 200）**。

## 下一步

新会话按 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md) 恢复后，任务按序：

1. **D5（8/14，唯一主线）：W9 收口日，精确化五模块**（定义 8/13，见 week9-plan §4）——**A 冷启动**（补 D1 重启恢复：拓扑已变 +443/shop-ssl/certbot.timer；亲手最小集 = `sudo reboot`；重启后 AI 出聚合命令复测 4 服务 + timer + 三面）**B 信任边界**（ufw 四段 + ss loopback，只读）**C 能力检验**（口述不敲命令：链路分层 + 两失败路径 + 改需求预演）**D demo 动线 + 讲稿**（AI 规划白名单，本人 review 后自己讲 = 本人验收）**E 收口决策**（Q8 今天做 or 顺延；admin 迁 443；时区；shop.bak；周计划/状态/笔记）。**协作原则**：手敲不是目的、证据才是——亲手最小集 = 触发点 + Q8 编码；批量验证 AI 出命令本人核输出。
2. **安全债 /users 鉴权（Q8）**：D5 E 模块决策。按 reports.js 范式挂 `validateToken + requireRole('admin')`（黑名单 W4，本人实现 AI review）；验收 = 本地直连带普通 token 403 / admin 200 + 公网仍非 200。
3. 时间允许：时区边界观察点是否按业务时区修正（属代码改动，需走 review）；**frontend `.gitignore` 已补 `dist-showcase`**；**学习展板已部署 8081**（D4-c 完成，A7 框架落地）；刷新 `shop.bak` 为当前白名单形态。
4. 下周（W10 起）Python/Java 基础学习与 W9 并行线正常推进，不受 D5 挤压（D5 主线 ≈ 1.5h）。

## 验收命令或证据

- **D4-HTTPS（2026-08-13，H1 冻结唯一验收）**：本地开发机 `curl -sS -o /dev/null -w "HTTP_CODE:%{http_code}\nSSL_VERIFY:%{ssl_verify_result}\n" https://43-128-154-242.sslip.io` → **`HTTP_CODE:200` + `SSL_VERIFY:0`**；HTTPS `/users` → **404**；80/8080 回归：`http://43.128.154.242/`→200、`/users`→404、`:8080/`→200。证书 `openssl x509 -in .../fullchain.pem -noout -dates` → notAfter **2026-11-11**；timer `enabled` + NEXT 8/14 04:13 CST + journal `Started Run certbot twice daily`；**`certbot renew --dry-run` → `all simulated renewals succeeded`**。
- **D4-b / 段 0（2026-08-13）**：公网 `curl -w '%{http_code}' http://43.128.154.242/users` → **404**；`POST /auth/login`（email + 密码管理器值 stdin）→ 200 + `.payload.accessToken`；带 token `GET /reports/monthly-sales?months=6` → 首月 `{"orderCount":258,"year":2026,"month":3,"totalSpending":146988.82}`。
- **D4-b / 段 2（2026-08-13，A9 四证据全过）**：`http://43.128.154.242:8080/` → 200（index.html，Content-Length 843）；`POST :8080/auth/login` → `{"code":200,"message":"登录成功","payload":{"accessToken":"eyJ…"}}`；带 token `GET :8080/reports/monthly-sales?months=6` → `258 2026 3 146988.82`；80 回归三连 `/`→200、`/users`→404、80 报表首月 `258 2026 3 146988.82`。
- **D4-c 学习展板 8081（2026-08-13 晚）**：公网 `http://43.128.154.242:8081/` → 200、`/showcase.html` → 200；`POST :8081/auth/login`（缺字段）→ 400（`/auth` 反代贯通）；80 回归 `/`→200、`/users`→404；8080 `/`→200（admin 后台未受影响）；浏览器实测 `:8081/#/showcase?tab=database&topic=lookup-index` 未登录 → 门禁登录表单 → 登录 admin@example.com → 回跳展板。代码/产物：门禁 commit（`66b9816`）+ 构建分流 commit（`5a86dca`）；服务器与本地同 commit 溯源闭环。
- **D4-HTTP 已收口（2026-08-12）**：本地开发机 `curl -I http://43.128.154.242/` → 200 + Server: nginx + X-Powered-By: Express；`POST http://43.128.154.242/auth/login` → 200 + accessToken；`GET http://43.128.154.242/reports/monthly-sales?months=6`（Bearer token）→ 200 + 真实聚合数据（2026-03 起 258 单 / 146988.82 元）。admin 凭据轮换闭环：密码管理器值实测登录 200（day4 笔记 §6）。
- **D2/D3 已收口**：`systemctl status nodeapp mongod` 均 active；`sudo ss -tlnp | grep -E "3000|27017"` 见 127.0.0.1 两端口；接口 `GET /reports/monthly-sales?months=6` 返回 6 个月聚合数据（B2/B3 证据在 day3 笔记 §5）。
- **B1**：2000 用户 + 5057 订单 + `getIndexes()` email unique true（day3 笔记 §5-B1）。
- **B3**：reboot 后双服务自起 + 接口 200（day3 笔记 §5-B3）。
- **B4**：快失败注入 → failed 停住（journal：restart counter at 5 / Start request repeated too quickly）+ 恢复 200（day3 笔记 §5-B4）。
- **B5**：mongod 187.4MB / nodeapp 83.9MB / available 1388MB（day3 笔记 §5-B5）。
- 第一轮基线（3 suites / 9 tests / ESLint 0）只作回归基线，对生产链路零证明力；生产链路验收以 B2/B3 端到端为准。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓ D4-HTTP✓ **D4-b✓ D4-HTTPS✓ D4-c✓**）、[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)、[`day2-host-and-node-service.md`](./week9-deployment/notes/day2-host-and-node-service.md)、[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md)（§5 阶段 B 执行记录）、[`week9-roadmap-d1-d4.md`](./week9-deployment/notes/week9-roadmap-d1-d4.md)（D1–D4 浓缩地图）、[`day4-http-reverse-proxy.md`](./week9-deployment/notes/day4-http-reverse-proxy.md)（D4-HTTP 执行记录 + 三个认知修正）、[`day4b-https-and-admin-plan.md`](./week9-deployment/notes/day4b-https-and-admin-plan.md)（D4-b：段 0 Q0–Q8 + 段 2 A1–A9 + B1–B5 + **D4-HTTPS H1–H4 冻结与执行**）、[`day4c-showcase-gate-deploy.md`](./week9-deployment/notes/day4c-showcase-gate-deploy.md)（D4-c：学习展板 8081 + 门禁 + 服务/暴露边界）。
3. 涉及代码：`week2-express/src/` 的 `server.js`、`package.json`、`config/db.js`、`seedUsers.js`、`seedOrders.js`、`controllers/services/repositories/routes/middlewares/models`（B2 链路已读）；服务器 `.env`（600、nodeapp 属主、值不外传）；服务器 Nginx 配置 `/etc/nginx/sites-available/shop`（80）、`/etc/nginx/sites-available/shop-admin`（8080）与 `/etc/nginx/sites-available/shop-ssl`（443，本仓库 `week9-deployment/notes/shop-ssl.conf` 有本地副本）。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- 2026-08-13（D4-HTTPS）：AI **L1 出题 + review + 经验知识讲解**（H1–H4 本人作答并冻结，H1 两轮 review、H4 一轮两相位重构；黑名单零实现）。**流程偏差（已留痕 day4b §4.3）**：Step 0–8 服务器操作由 AI 代跑、非本人亲手键入——补救① 本人当场亲手验收（curl 200/0 + dig + nginx -t）② **D5 协作模式修正（8/13 用户反馈「手敲意义不大」后定稿）**：手敲不是目的、证据才是——亲手最小集 = 触发点（reboot）+ Q8 编码；批量验证 AI 出命令、本人核输出；能力检验口述、demo/讲稿 AI 规划。未触发 `DEBT.md`。
- 2026-08-13（D4-b）：AI 全程 **L1 引导 + review + 经验知识讲解**，黑名单零实现——段 0「授权落哪层/URL 面收敛」本人答 Q2–Q8 并冻结；段 2「构建位置/溯源/相对路径/静态服务/暴露面/信任边界」本人答 A1–A9 并冻结；执行期只给白名单最小形态（Nginx site 配置、scp/rsync 命令、控制台操作）；403 根因（反代不读盘 vs 静态读盘）与「控制台 + ufw 两层防线」为 L1 讲解。前端解耦（admin/showcase 双入口）属白名单 week8 前端，由 AI 实现完成（提交 d3a1edc）。未触发 `DEBT.md` 记账。
- 2026-08-13（D4-c，晚）：AI 白名单实现 + 心智讨论——展示前端门禁（gate 模式关注册口）+ 构建产物分目录（dist/dist-showcase）+ Nginx 8081 站点 + scp/rsync 传输 = 白名单 week8 前端 + 配置胶水，AI 直接实现（commit `66b9816` 门禁、`5a86dca` 分流）；「服务边界 vs 暴露边界」心智（加 Nginx 入口 ≠ 加业务）为讲解与讨论，黑名单 W4「鉴权链路」零实现（后端 /auth/login 是既有实现，门禁只是复用）。未触发 `DEBT.md` 记账。
- 2026-08-12（D4-HTTP）：AI 全程 **L1 引导 + review + 经验知识讲解**——前置设计题（反代 header 语义）本人作答四类 + trust proxy，AI review 通过；读代码后「不消费 req.ip/protocol/hostname → 不配 XFF/XFP、不做 trust proxy」为本人追加决策；凭据轮换给 L2 骨架（黑名单「密码哈希与存储策略」止步 L2），脚本由本人补全实现；nginx/ufw 命令属白名单给最小形态。AI 流程管控缺口：写库前的「密码管理器已记录」前置验证漏了（一度找不到密码），已记入 day4 笔记 §2.3。
- 2026-08-12（D3 全天）：AI 全程 **L1 引导 + review + 经验知识讲解**——阶段 A 与阶段 B 均未给核心实现骨架；白名单领域（命令形态、mongosh 参数、systemd 字段名、seed 命令）给最小样板。
- 阶段 B 的 AI 辅助内容：B1 三连 review（autoIndex 归观察点、authSource 方向修正 ×2、count 命令形态）；B2 链路事实摸清（register 必须走真实链路、MON 密码长度≥15、completed 口径锚点、read -s 终端限制、--env-file/import 的 cwd 依赖）；B3 三连 review（Requires/EnvironmentFile 违反冻结）；B4 快失败注入设计（Wants 连带拉起盲区 → JWT_SECRET 短值触发校验①秒失败）；B5 口径修正（available 判断锚点、swap 现状、nodeapp 高 RSS 排查）。
- 认知修正（本人执行期新增）：⑥ `read -s` 网页终端读不到 stdin（len=0 实证）；⑦ `node -e` ESM import 按 cwd 解析模块；⑧ `Wants` 在 start 时连带拉起依赖服务（B4 第一轮实证）；⑨ 快失败 vs 慢失败是 StartLimitBurst 设计核心（B4 第二轮附带学习）；⑩ 聚合 `$year/$month` 按 UTC 而服务器 CST（B3 时区观察点）；⑪ ESM 文件脚本 import 锚在脚本文件位置（/tmp 找不到 node_modules）；⑫ sudo 默认 env_reset 丢弃环境变量（需 --preserve-env）；⑬ 反代不读盘 vs 静态服务要读盘（B3/D4-b 权限雷）；⑭ 腾讯云控制台防火墙与 ufw 两层独立防线（D4-b 8080 实测）；⑮ **服务边界 ≠ 暴露边界**（加 Nginx 入口 ≠ 加业务；D4-c）；⑯ 构建产物需分目录（D4-c，dist-showcase）；⑰ 前端登录门禁只挡浏览器（D4-c）。
- 欠账跟踪：问题 9 选 A 的「启动即失败契约」补验 **B4 已销账**；测试凭据 admin@example.com 轮换 **D4-HTTP ① 已闭环**；时区边界观察点排入 D5 决策（新欠账形态，非黑名单）；**应用层 `/users` 无鉴权（Q8 安全债）暂定周五 8/14 D5 前偿还**（BACKLOG P1，非 DEBT.md）。
- 未触发 `DEBT.md` 新记账（L1 + 白名单，不记债）。

