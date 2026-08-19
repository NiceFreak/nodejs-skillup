# 当前学习状态

> 最后更新：2026-08-19（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W10（8/17–8/21），主题为“可观测性与线上排障”**。上一周 W9「从零到线上：部署链路」已全周收口。
- 当前 Day：**2026-08-19（周三）= W10 D3 已完成**（监控与告警并主动弄红，执行记录 [`day3-monitoring-alerting.md`](./week10-observability/notes/day3-monitoring-alerting.md) §9：四项检查（app 两层/内存/磁盘/证书）全部红过并还原，验证②⑧通过、⑨ 基线回归全绿，4 脚本 + 8 unit 上线）。**2026-08-18（周二）= W10 D2 已完成**（日志改造上线，commit f48162d）；**2026-08-17（周一）= W10 D1 已完成**（观测契约冻结）。**下一主线 = W10 D4（8/20）故障演练主场（3–5 类真注入）**。
- 今日只读采集基线（D1 块 C）：journald **248.0M / 无上限**；磁盘 40G 总 31G 可用；内存 available **1304 MB** swap=0；端口与信任边界一致；Nginx 日志 <200K + logrotate 已配；证书 notAfter Nov 11（约 86 天）。
- W9 收口事实（不变）：五模块（A 冷启动 / B 信任边界 / C 能力检验 / D demo / E 收口）全部收口；Q8 安全债 + admin 迁 443 合并部署完成。
- 执行记录：[`day5-rebuild-closeout.md`](./week9-deployment/notes/day5-rebuild-closeout.md)（注意：文件名是 `day5-rebuild-closeout.md`，不是 plan 里写的 `day5-rebuild`）；周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓ D4-HTTP✓ D4-b✓ D4-HTTPS✓ D4-c✓ **D5✓** 全部勾选，**W9 全周完成**）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（冻结不变）。
- 服务器：腾讯云首尔二区，公网 IPv4 `43.128.154.242`，Ubuntu 22.04.5，2 核 / 2 GB / 40 GB SSD，到期 2026-11-10；SSH 密钥认证唯一通道（ubuntu + admin.pem，** 本地路径 `~/.ssh/admin.pem`**），网页终端 root 带外应急。
- **信任边界（8/14 复核不变）**：ufw 22 + 80 + 443 + 8080 + 8081/tcp 双栈 ALLOW（3000/27017 不在列表）；腾讯云控制台防火墙同步放行。
- **系统变更（8/14 更新）**：`dist-admin443/`（admin 443 独立产物，nodeapp 属主）；`shop-ssl.conf` 加 `location /admin/`（alias dist-admin443）；`shop.bak` 刷新为当前白名单形态（424B，4 location）。

## 最近完成

- **2026-08-17（W10 起步 · 计划草案）**：建立 `week10-observability/notes/week10-plan.md`——从 W9 继承的环境事实、当前日志现状四个缺口（不结构化 / 无请求关联 / 无级别与脱敏声明 / Nginx 与 Node 两套口径）、与 Excel 冲突需拍板的六处（单机上「集中收集」的定义、监控栈内存闸门、演练与唯一生产机冲突、pino/winston 二选一、日志轮转责任方可能是伪需求、并行线归属与本文件冲突）、故障演练三档安全边界（生产机可注入 / 受控注入 / 必须隔离）、D1–D5 节奏、§5 的 15 条待冻结决策、W10 黑白名单判断。**同日拍板第 1 条：并行线归属以 Excel 为准**——W10 不开新语言线，Java stretch 并入 W11，Python 留在 W12。
- **2026-08-17（W10 D1 执行清单）**：建立 `day1-observability-contract.md`——§2 决策输入（四条日志流表 + 从 `app.js` 读出的五条事实，其中两条是当前的真实盲区：**只监听 `res.on('finish')` 导致客户端断连的请求一条日志都不留**、**脱敏是巧合不是设计**）、§2.4 前置概念 L1 讲解七则（日志/指标/追踪的取舍、结构化解决什么、journald 与 logrotate 的责任划分、关联 id 难在传递而非生成、RSS/heapUsed/available 四个数、告警的可操作性标准、排障即二分）、§3 时间盒 A–F 含只读采集命令清单、§4 问题库 Q1–Q15 + **冲突自查七对**、§5 四张空表、§4.6 与计划 §5 的对应关系。**决策全部留空待本人作答；仅文档，无代码与配置改动。**
- **2026-08-17（W10 D1 契约冻结完成）**：块 A–F 全部走完——**块 A** 核对 `app.js`/`server.js` 五条事实（逐行一致）；**块 B** 概念讲解；**块 C** 只读采集基线（§5.5 填满）；**块 D** Q1–Q15 本人全部作答（14 条，AI 只讲解+review）+ 多处收口（path 改 req.path、close 兜底、Q4 直读 req.headers、/health 探针、webhook 降 stretch 等）；**块 E** 冲突自查七对全过 + §5 四张表填满；**块 F** 计划 §5 回填 15/15 并同步头部、更新本状态文件。**当天零副作用**（零装库、零配置改动、零故障注入）。AI 未触发 DEBT.md。
- **2026-08-18（W10 D2 执行完成 · 上线）**：pino 接入 + 请求关联 id + 脱敏 + /health + journald 500M + Nginx obs 格式全部上线（commit f48162d）。执行细节见 [`day2-logging-rollout.md`](./week10-observability/notes/day2-logging-rollout.md) §11（验证①–⑦实测 vs 期望）。**执行期三个关键**：① 九个反代 location 逐个加 `proxy_set_header`（P1 选 a，避免 location 级指令族屏蔽）；② `$time_iso8601` 带 +08:00 非 UTC，P2 拍板接受偏移 + runbook 换算（不动 systemd 单元）；③ review 抓到**阻断**：404 的 `err.message` 用 `req.url` 带查询串 → 凭据字符串进日志（pino redact 只对对象路径生效），修 = catch-all 用 `req.path` + error handler msg 改纯描述。顺序甲（先 Nginx 后 Node）执行，中间态验证了「Nginx 传 id、Node 不认」无害。**本地 jest 并行竞态**（--runInBand 串行 9/9 过）判为既有问题非今日引入。
- **2026-08-18（W10 展板阶段 1 · 可视化方案定案并落地两块）**：方案 [`week10-visualization-plan.md`](./week10-observability/notes/week10-visualization-plan.md) 定案（三个决策：新 tab / 冲突自查七对挂格子 / D2 收口后开工），骨架定为「契约 → 实测 → 差在哪」，共六块。**阶段 1 落地两块**：⑥「三个绿灯漏掉什么」（代表页，`nginx -t` 放过 location 级指令族屏蔽与 `log_format` 未被 `access_log` 指定；`redact` 只认对象路径；`eslint no-console` 拦不住 logger 的 msg——**四条实例零命中**，抓到者是事前推理 / 写文档时自查 / review）与 ①「盲区：请求终局」（四终局 × 改造前后两排轨道，「没进 Node」那格永远空着 = 分工不是漏洞）。**档位新增 `contract`**（已拍板未验证；与 W9 的 derived 区别是「决策要改」而非「推理错」），板头计数 = 翻档进度条。**落地时自核出方案稿一处说谎**：改造前是**两格**有日志不是一格（`console.error` 一直在，只是与请求行无共同 id），已按 `app.js` 事实改回；未到实测的两格（没进 Node = D4 才注入、进程内出错 = 无落盘原文）降为 `contract` 并写清「证据差在哪」。笔记 tab 接入 W10 四份原文。typecheck + `VITE_SHOWCASE_ONLY=1` 构建通过，`yarn verify:board` **316 项全过**（断言首跑即抓到一处数据层写了 Markdown 加粗），桌面深浅 + 390px 手机截图核对。**未部署**；commit `d623eac`。
- **2026-08-18（W10 展板阶段 2 · 再落两块，4/6）**：③「日志旅程」（一眼结论 = **4 份 site → 9 个反代 location → 1 份 access.log**；改漏一处不报错、那个面的 id 变 `local-` 开头；三个「两套」= 落点/轮转/时间戳无一共用，所以必须有一根 id；时间戳不统一是**拍板不是待修**，写清选了什么与没选什么）与 ②「字段契约销账」（**9/9 必有全部到位、0/2 可选未实现**——销账要同时看「没缩水」和「没加码」；实测多出 pino 自带的 `level`）。**本块暴露出一条 D1/D2 都没意识到的事实**：脱敏四道闸按强制力排完后可见，**今天真正挡住密码的是第一道（中间件根本不记 body），`pino redact` 的五条路径今天一条都没被触发过**——它是保险不是主防线，这与 ⑥ 那条 `err.message` 泄漏咬合。执行期修两处（`.zero` 类名对「9」是语义错→改 `.alert`；表 caption 说三列实际四列）。`yarn verify:board` **349 项全过**，三档截图核对。**未部署**。
- **2026-08-19（W10 展板阶段 3 · 再落两块，6/7）**：④「阈值从哪来」（四条尺，红线位置 = 红线值 ÷ 今天实测值，所以「还剩多少动作时间」是量出来的；三条 alarm 尺从 `contract` 翻成 `measured`，靠的不是脚本写完了而是**每条都被亲手弄红过一次**；journald 那条故意换画法——它不是告警线是硬上限）与 ⑦「红过才算数」（**方案原六块之外新增**：五行绿-红-绿闭合证据链 + 红格挂「下一步做什么」；弄红杠杆四列，最右「真造资源条件」整列空 = 与 D4 的接力线；频率与身份表、谁监控监控本身、工具踩点五条）。**副产物抓到一处 timer 频率单位错**（见下 §2）。断言再进一步：④ 的几何断言**从页面标签里读数字**算出应有比例再比对图形位置，⑦ 的红格判定改成逐行取「绿红绿」序列。`yarn verify:board` **393 项全过**，三档截图核对。**未部署**。
- **2026-08-18（可视化验收判据加严 + W10 四块返工）**：本人指出「每块板都充斥巨量文字、没有视觉辅助，标准可以适当调整」。核对原文后结论是**标准不放宽，补被执行时丢掉的半句**——那几条约束写的都是「不把 X **当作可视化成果**」，从来没禁止视觉编码。改动落在 [`visualization-optimization-roadmap.md`](./week8-fullstack/notes/visualization-optimization-roadmap.md) **第八轮**：① 验收判据加严为「**遮住标题与结论段仍能答出验收句**」；② 补肯定面四条（同类对象 ≥3 要比较必须有非文字编码 / 量可比且差距是结论就出图 / 有序分层用位置编码 / 正文超一屏必须有锚）；③「图形只负责关系」改成「**图形负责结论本身**」。W9 方法稿 §2.3 与 §1 同步加修订注。**W10 四块按新判据返工**：⑥ 改成三道闸 × 四条贯穿轨迹（零命中成为图形事实）、① 改成 4×2 真矩阵 + 行首合计 + ●/○ 可数、③ 改成两条真泳道 + 一根贯穿的 id 竖线（此前那根线只是概念）、② 表中加连线列（9 接上 / 2 断开可数）。**断言形态也变了**：新增四条不再查「页面上有没有这句话」，而是量图形事实（线宽比、行首合计与实心格数一致、泳道结构、连线计数）——能拦住「图和数字各说各话」。`yarn verify:board` **354 项全过**。**W9 板十三块记 BACKLOG**（等 D5-D 核谎时一并处理）；W10 的 ④⑤ 直接按新标准做。**未部署**。
- **2026-08-17（W9 收口清理）**：Q8 手动展示资产已同步——`users.http` 以隐藏 prompt 登录并串联 admin token，24/24 条 `/users` 请求带 Bearer；Postman JSON/YAML 新增置顶 Admin 会话准备，26/26 条 `/users` 请求带 `adminAccessToken`，未落盘密码。
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
  - **展板阶段 3（同日）**：新增第 12 块 **⑫ 以谁的身份碰谁的东西**——4 身份（含 **www-data**：你永远不会登录成它，但它每天替你读盘）× 5 对象矩阵，12 条坑挂在格子上。一眼结论 = **12 条里 3 条落在同一格（ubuntu 碰代码仓库）**，因为 dubious ownership 与 FETCH_HEAD 本就是同一个根因的两种表现；换身份本身的 3 条不塞进格子，单列。
  - **展板阶段 4（同日，十三块齐 · 展板收口）**：新增第 13 块 **⑬ 讲得出来才算会**——D5 口述三关暴露的 8 处修正钉在链路八层上。一眼结论 = **前三层（DNS/TCP/TLS）零错，六处压在自己配的那几层**；第二条结论 = 按暴露渠道分，C3 那两条属「记忆停在旧状态」，最难自查（与展板两次说谎是同一种失效）。与 ⑨ 的边界：⑨ 收执行期踩出来的，这块收口述时暴露的。
  - **浓缩地图补 D5（同日）**：`week9-roadmap-d1-d4.md` 升级为全周地图（文件名未改，多处引用按旧名）——新增第五个对外面表、§6.3 D4-c、§6.4 D5 收口、生产对照重算、认知修正 19 → **32 条**、白话对照表补 8 个 D5 术语。
  - **遗留观察点（已记录非阻断）**：服务器 `/etc/nginx/sites-available/shop-ssl` 改动不在 git（本地 `shop-ssl.conf` 副本需同步）。权限速查表已在同日落地为独立文件，不再是承诺项——以下「下一步」列出剩余项。
- **2026-08-13 及此前**：D4-HTTP / D4-b（段 0 + 8080）/ D4-HTTPS（443）/ D4-c（8081 门禁）全部收口（见本文件历史记录；D4 各线执行记录在 day4 各笔记）。

## 当前主线

```text
W10 D3（8/19）已完成：四项检查（app 两层 / 内存 / 磁盘 / 证书）落成 4 脚本 + 4 service + 4 timer；输出为 NDJSON + action 可操作指令；五项红态证据链齐全（①–⑤），验证②⑧通过、⑨ 基线回归全绿。
验收句实测达成：每项「绿 → 弄红 → 报红 → 还原 → 绿」完整证据；4 脚本 + 8 unit 入库 notes/checks/。

W10 D4（8/20，明日）：故障演练主场（3–5 类真注入）—— 按契约 §5.4 分档表逐类走「注入 → 现象 → 定位 → 修复 → 恢复基线」。
D3 已提供的硬依赖：① 四项检查都已红过（D4 定位靠它们表态）；② 验证⑨ 三层基线绿（无绿基线不许注入）；③ 今天用掉的弄红方式要记清（D4 注入不得与 D3 重复，证据接力）。
第一个动作：按 §5.4 逐类核前置四件事（还原点 → 基线 → 止步 → 回滚命令）；端口占用类先确认 socat/nc 哪个已装。
```

**状态澄清（8/14 更新）**：公网现有五个面——`http://43.128.154.242`（80 API）、`https://43-128-154-242.sslip.io`（443 API）、`https://43-128-154-242.sslip.io/admin/`（443 admin 后台，新）、`http://43.128.154.242:8080`（8080 管理后台，过渡期保留）、`http://43.128.154.242:8081`（8081 学习展板）。

## 当前阻塞与风险

- **Swap=0（持续，已安全）**：B5 实测 available 1388MB + Nginx 8.5M——余量充足；若后续收紧，选项为降 cacheSizeGB / 清缓存重启 / 加 swap。
- **8080 明文过渡期（8/14 新增，已知短板）**：admin 迁 443 完成但 8080 保留过渡期（发布纪律）；明文登录表单仍在，demo 讲稿 Act 3 明说为「已知短板」，待过渡期观察后下线 8080 + ufw 移除。
- **时区边界（8/14 决策：明确不修）**：聚合 `$year/$month` 按 UTC，服务器 CST，凌晨订单跨月归因 ~3 单/月——已拍板接受，UTC 作为已知口径保留。
- **sslip.io 路线待验证（持续）**：HTTPS 已实际可用（H1 200/0），回退纯 IP+HTTP 路径备查未触发。
- **服务器 8.0 vs 本地 mongo:7**：8.0.29 已装并实证兼容（B1/B2）；本地原生 mongod（PID 840）与 docker 并存需注意。
- **W10 故障演练的生产机边界（8/17 新增，本周最高优先级风险）**：只有一台生产机且同时承载 5 个公网面，演练前置四件事不可省（还原点 → 五面基线 curl → 止步条件 → 回滚命令先写好）；三档分类见 [`week10-plan.md`](./week10-observability/notes/week10-plan.md) §3.1——**OOM 必须隔离做、证书过期只模拟不碰现网证书、磁盘满限受控目录**。
- **W10 监控栈内存闸门（8/17 新增）**：2 GB / swap=0 / available 1388 MB——监控自身把被监控对象压垮是本周最讽刺的失败模式；主线只用检查脚本 + `systemd timer`，Prometheus 栈降 stretch 且装前先量、装后再量。
- **凭据注意（不入笔记，用户知晓）**：admin 密码走密码管理器；`.env` 值一律 redact。**W10 新增一条**：日志中间件会经过登录链路（email + 密码体），脱敏清单须在 D1 先定、D2 上线前用一次真实登录实测「查不到」。

## 下一步

新会话按 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md) 恢复后，任务按序：

0. **W10 D3 已完成（8/19）**。**W10 D4 = 当前主线（8/20）**：故障演练主场（3–5 类真注入），按契约 §5.4 分档表逐类走「注入 → 现象 → 定位 → 修复 → 恢复基线」。D3 已提供三项硬依赖：① 四项检查都已红过（D4 定位靠它们表态）；② 验证⑨ 三层基线绿（无绿基线不许注入）；③ 今天用掉的弄红方式已记清（D4 注入不得与 D3 重复，证据接力）。第一个动作：按 §5.4 逐类核前置四件事（还原点 → 基线 → 止步 → 回滚命令）；**端口占用类先确认服务器上 socat / nc 哪个已装**（D1 Q13 遗留确认项）。**D4 开工前先修一件**：`check-cert.timer` 的 `OnCalendar` 单位写错（每 6 分钟 ≠ 每 6 小时，见 D3 §9.5），改完用 `list-timers` 的 NEXT/LAST 间隔销账——D4 一整天靠这四个 timer 表态。D3 遗留观察：check-cert 的 openssl stderr 行混入 NDJSON 流（非阻断，接 Promtail/Vector 前处理）。D2 遗留观察仍开放：本地 jest 并行竞态（--runInBand 串行 9/9 过，多 suite 共享外部库互相 dropDatabase，非今日引入）。
1. **W9 收口清理（非主线）**：
   - **shop-ssl.conf 本地副本遗留项已收口（8/18）**：`week10-observability/notes/nginx/` 四份 site 副本 + log_format 片段入库（见 week10-plan §9）。
   - ~~补「服务器操作身份与权限速查表」~~ **8/14 已落地**（[`server-permission-cheatsheet.md`](./week9-deployment/notes/server-permission-cheatsheet.md)）。**8/18 补一条**：nodeapp 是 nologin 服务账号，`sudo -iu nodeapp` 不可用，必须 `sudo -u nodeapp bash -c`。
   - commit/push 剩余改动由本人决定。
2. **展板现状（8/19 更新，`yarn verify:board` 393 项全过，未部署）**：
   - **W9 板十三块齐、已收口**（按旧验收判据）。**8/18 新增一笔 BACKLOG：十三块未按加严后的判据复核**（遮住标题与结论段仍能答出验收句），排入 D5-D 核谎那次一并处理。另有 ⑭「产物与溯源」记 BACKLOG，两项均非阻断。见 [`week9-visualization-plan.md`](./week9-deployment/notes/week9-visualization-plan.md) §12.19 与 §13。
   - **W10 板（tab `可观测性`，reviewOnly）落地 6/7 块**：⑥ 假生效、① 盲区、③ 日志旅程、② 字段销账、**④ 阈值尺、⑦ 红过才算数**已做；**⑤ 演练分档待做**（D4 之前那四类的「首个症状」还是预测，先做就是预约一次说谎）。板头计数 `27/5/0` → **`40 已实测 · 6 已拍板 · 1 待做`**。范围与口径边界见 [`week10-visualization-plan.md`](./week10-observability/notes/week10-visualization-plan.md) §9 与 §12。
   - 通用纪律不变：主线每往前走一步，**先核一遍展板有没有开始说谎，再谈补内容**（W9 板已排入 W10 D5-D，非阻断）。
   - **8/19 展板阶段 3 的副产物**：建 ⑦ 的频率表时逐行核入库 unit 副本，抓到 `check-cert.timer` 的 `OnCalendar=*-*-* *:0/6` 是**每 6 分钟**而非拍板的每 6 小时（`systemd-analyze calendar` 可证伪，差 240 倍）。三样都对——enable 成功、语法合法、`list-timers` 的 NEXT 有值——唯独单位错，是本周第五条「绿灯全过但语义没生效」。**功能无损、非阻断**；展板那一格标「待做」不许翻档；修法与销账（改 `0/6:00:00` → `list-timers` 看 NEXT/LAST 间隔）排在 **D4 开工第一件事**，见 [`day3-monitoring-alerting.md`](./week10-observability/notes/day3-monitoring-alerting.md) §9.5。
3. **并行线归属（8/17 已拍板：以 Excel 为准）**：本文件此前写「W10 起 Python/Java 基础学习并行推进」，现更正为——**W10 不开新语言线**，本周并行线只有英语（1–2 篇英文文档 + 一段英文技术总结）与项目叙述（5–10 分钟）；**Java stretch（最小 jar + systemd + Nginx location）并入 W11**，与 Maven 构建 job 一起做；**Python 留在 W12**（8/31–9/4）。两处描述漂移已消除。
4. **8080 下线决策（过渡期后）**：admin 已在 443 稳定后，评估下线 8080（拆 server block + ufw 8080 移除）——本周不拆。
5. **demo 讲稿（D5 D 模块尾巴）**：Act 3 第二笔改「已还 + 怎么验的」（Q8 已部署）；本人 review 后自己讲（讲得出来才算验收）。

## 验收命令或证据

- **W10 D3（8/19）**：四脚本手工跑全绿（app/status OK + mem 1195MB + disk 31G + cert checkend OK，均 exit 0）→ 五项红态证据（stop nginx→FAIL/subsystem=nginx / HEALTH_URL 3001→FAIL/subsystem=health / 阈值 1500→FAIL / 阈值 35G→FAIL / CERT_OVERRIDE→FAIL，均 exit 1）→ 各自还原后全绿；`systemctl list-timers` 四 timer NEXT+LAST 排程（17:10:01 真实触发 journald 有记录）；⑧ 验证 stop timer → NEXT 变 n/a；⑨ 五面 200 + /health 200 + nginx/nodeapp/mongod active + 4 timer active。脚本 + unit 入库 `week10-observability/notes/checks/`。
- **W10 D2（8/18）**：`X-Request-Id:63245c0a...`（公网 443 响应头）→ 服务器内 `grep 63245c0a /var/log/nginx/access.log`=1 条（obs 格式 `+08:00`）+ `journalctl -u nodeapp | grep 63245c0a`=1 条（NDJSON `Z` UTC）；五面 200 + `/health` 200 + 两服务 active；`SystemMaxUse=500M` 生效 272M；真实登录后 `grep 密码 access.log/journalctl` 双 NOT_FOUND。
- **W9 主线全部收口（8/14）**：
  - 80：`curl -s -o /dev/null -w '%{http_code}\n' http://43.128.154.242/` → 200；`/users` → 404。
  - 443：`curl -sS -o /dev/null -w "HTTP_CODE:%{http_code}\nSSL_VERIFY:%{ssl_verify_result}\n" https://43-128-154-242.sslip.io` → `HTTP_CODE:200 SSL_VERIFY:0`；`/users` → 404。
  - **443 admin 新入口**：`curl -s -o /dev/null -w '%{http_code}\n' https://43-128-154-242.sslip.io/admin/` → 200 + 资源 200；浏览器实测登录 admin@example.com + 报表锚点 258。
  - 8080：`curl -s -o /dev/null -w '%{http_code}\n' http://43.128.154.242:8080/` → 200（过渡期保留）。
  - 8081：`curl -s -o /dev/null -w '%{http_code}\n' http://43.128.154.242:8081/` → 200。
  - 服务器内：`curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/users`（无 token）→ **401**（Q8 应用层守卫）；`http://127.0.0.1:3000/reports/monthly-sales?months=6`（无 token）→ **401**。
  - Q8 本地（dev server 直连）：无 token→401 / member→403 / admin→200；jest 3 suites / 9 tests 全过。
  - Q8 手动展示资产（8/17）：`.http` 24/24、Postman JSON/YAML 26/26 条 `/users` 请求均带 admin Bearer；admin token 设置请求各一份，密码未写入仓库。
- **D4-HTTPS（8/13）**：`HTTP_CODE:200 SSL_VERIFY:0`；HTTPS `/users`→404；80/8080 回归；证书 notAfter 2026-11-11；`certbot renew --dry-run` → `all simulated renewals succeeded`。
- **D4-b（8/13）**：80 `/users`→404；登录 200 + token；报表首月 `258 2026 3 146988.82`；8080 四证据。
- **D4-c（8/13）**：8081 `/`→200 + 门禁登录实测。
- **D3（8/12）**：nodeapp/mongod active；B1–B5 证据（seed 2000/5057、reboot 自起、快失败注入、RSS 187/84/1388）。
- 第一轮基线（3 suites / 9 tests）只作回归基线；生产链路以 B2/B3 + 各 D 验收为准。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. **W10（当前周）**：[`week10-plan.md`](./week10-observability/notes/week10-plan.md)（§3.1 演练安全边界 / §5 决策清单 / §6 黑白名单）；[`day3-monitoring-alerting.md`](./week10-observability/notes/day3-monitoring-alerting.md)（**D3 当前主线规划**：§2 变更单 / §3 P1–P5 待答 / §5 白名单语法）；[`day1-observability-contract.md`](./week10-observability/notes/day1-observability-contract.md)（**已冻结契约**：§5.3 四项判据表 / §5.4 演练分档表）；[`day2-logging-rollout.md`](./week10-observability/notes/day2-logging-rollout.md)（**D2 已收口**：§2 变更单 / §3 P1–P5 答案 / §11 实测 vs 期望）；`week10-observability/notes/nginx/`（四份 site + log_format 副本 = 服务器可追溯保存点）。
3. **W9（上一周，按需追溯）**：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1–D5 全部勾选）、[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)、[`week9-roadmap-d1-d4.md`](./week9-deployment/notes/week9-roadmap-d1-d4.md)（**全周 D1–D5 浓缩地图**，文件名未改）、[`day4-http-reverse-proxy.md`](./week9-deployment/notes/day4-http-reverse-proxy.md)、[`day4b-https-and-admin-plan.md`](./week9-deployment/notes/day4b-https-and-admin-plan.md)、[`day4c-showcase-gate-deploy.md`](./week9-deployment/notes/day4c-showcase-gate-deploy.md)、[`day5-rebuild-closeout.md`](./week9-deployment/notes/day5-rebuild-closeout.md)（**W9 收口 + Q8 + admin 迁 443 + 变更单思维**）。
4. 涉及代码：`week2-express/src/app.js`（现有 logger 中间件与 error handler = W10 起点）、`week2-express/src/server.js`（生命周期日志）、`week2-express/src/routes/users.js`（Q8 统一守卫）、`week8-fullstack/src/frontend/vite.config.ts`（base 分流）、服务器 `/etc/nginx/sites-available/shop-ssl`（含 `/admin/`，本地副本 `shop-ssl.conf` 待同步）。
5. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- **2026-08-19（W10 D3 执行+收口）**：AI 起草 day3 规划（变更单结构 / 验证矩阵格式 / P1–P5 问题与追问 / systemd+openssl 语法白名单）；出题与 review，黑名单零实现。P1–P5 全部答案由本人拍板；review 修正两处（① app /health 层禁止 sed 改 app.js → 改脚本常量端口 3001；② 还原统一 cp .bak 而非 sed 反替换）。执行踩点三条（/opt 目录写权限 → sed -i 需 sudo / systemctl 无 TTY 需显式 sudo / check-cert stderr 混入 NDJSON 流）。未触发 `DEBT.md`（黑名单止步 L2）。
- **2026-08-18（W10 D2 执行+收口）**：AI 出白名单（pino/eslint/Nginx/journald 语法 + 部署命令）、提问 P1–P5、review 本人实现（#3–#6）。review 发现**阻断：查询串凭据经 404 err.message 泄漏**（pino redact 只对对象路径生效、不碰字符串），本人修 catch-all 用 req.path + error handler msg 改纯描述。发布顺序（先 Nginx 后 Node）、`/health` 判据、监听时机、local 兜底 id 全部本人拍板。未触发 `DEBT.md`。
- **2026-08-17（W10 计划）**：AI 读取仓库状态与 Excel W10 行后产出 `week10-plan.md` 草案（计划分析 + 文档整理）。日志字段契约、脱敏清单、阈值判据、演练分类、定位推理**全部留空待本人在 D1 作答**——按 `AGENTS.md`「未列出项拿不准按黑名单」，这些已在计划 §6 显式归入黑名单（上限 L2）。未触发 `DEBT.md`。
- **2026-08-17**：AI 完成 `users.http` / Postman JSON/YAML 展示资产同步与静态验证，属于白名单；未修改后端鉴权逻辑，未触发 `DEBT.md`。
- **2026-08-14（D5）**：AI **L1 出题 + review + 经验知识讲解**（C 能力检验三关 + Q8 设计判断 D1/D2 框架）；Q8 黑名单实现由**本人完成**、AI 只 review；admin 迁 443 = 白名单（vite base + Nginx location + 产物二份制）+ 变更单思维讲解；服务器操作链（reboot/pull/scp/reload）AI 出命令、本人执行核输出。**未触发 DEBT.md**（黑名单零实现，止步 L2）。
- **2026-08-13（D4 各线）**：L1 引导 + review + 经验知识讲解；黑名单零实现；未触发 DEBT.md（详见历史记录）。
- **C 模块当场修正 8 处**（8/14，纳入掌握证据）：Nginx 选入口机制精度、白名单精确路径 + 统一 404、静态资源归属、数据读取五层、pm2 口误（systemd）、80 现状（API 面非 301）、8080/8081 非内网端口。这些是「能讲清边界」的直接证明。
- 欠账跟踪：Q8 安全债 **8/14 已销**（实现+部署+线上复现）；时区边界 **8/14 明确不修**（决策落地，不再是待决项）；admin 迁 443 **8/14 完成**；shop.bak **8/14 刷新**；8080 明文过渡期 = 已知短板（demo Act 3 明说，过渡期后下线）。
- 未触发 `DEBT.md` 新记账（L1 + 白名单，不记债）。
