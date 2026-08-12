# 当前学习状态

> 最后更新：2026-08-12（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**2026-08-12——D4-HTTP 完整收口（本地开发机公网 200 + 凭据轮换闭环）**；D4 已拆为 HTTP/HTTPS 两线，本日完成 HTTP 线。
- D4-HTTP 收口记录：[`day4-http-reverse-proxy.md`](./week9-deployment/notes/day4-http-reverse-proxy.md)（五项执行 + 三个认知修正）；D2/D3 收口：[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md) §4.1 + §5。
- W9 周期：**实际收口 8/15**（D2 占两天所致，D4/D5 听后移）。
- 周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓ D4-HTTP✓ 已勾选；D4-HTTPS/D5 待做）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（冻结不变）。
- 服务器：腾讯云首尔二区，公网 IPv4 `43.128.154.242`，Ubuntu 22.04.5，2 核 / 2 GB / 40 GB SSD，到期 2026-11-10；SSH 密钥认证唯一通道（ubuntu + admin.pem），网页终端 root 带外应急。

## 最近完成

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
下一步 = ①week8 管理后台部署（8080，方案已冻结）→ ②D4-HTTPS（443 + sslip.io + certbot）。
D4-HTTP 已收口（外部 200 + 凭据轮换完成）；week8 部署详细步骤与概念契约见「下一步」第 1 条与 day4 笔记 §10。
```

**状态澄清（2026-08-12 更新）**：`http://43.128.154.242` **现已可公网访问**（本会话 D4-HTTP 达成）——Nginx 反代 80→127.0.0.1:3000 + ufw 放行 80。之前「访问不到是设计使然」的澄清已过时：D2/D3 时公网不可达是设计使然；D4-HTTP 后 HTTP 线已开。HTTPS（443）仍不可达是设计使然，待 D4-HTTPS。

## 当前阻塞与风险

- **Swap=0（持续，Nginx 已加仍安全）**：B5 实测 available 1388MB + Nginx 8.5M 实测——余量充足；若后续收紧，选项为降 cacheSizeGB / 清缓存重启 / 加 swap（副作用 OOM 用磁盘兜底）。
- **sslip.io 路线待验证（持续，D4-HTTP 已建立回退基线）**：D4-HTTPS 实际签发不可用则回退纯 IP + HTTP——**该回退路径现已可用**（`http://43.128.154.242` 200）。
- **服务端 8.0 vs 本地已验证组合 mongo:7**：8.0.29 已装，B1 seed + B2 端到端实证读写/聚合兼容。
- **时区边界观察点（D5 决策）**：聚合 `$year/$month` 按 UTC、服务器 CST(UTC+8)，凌晨订单跨月归因偏差 3 单/月量级；D5 决定是否按业务时区修正（`$dateToString` 指定 timezone）。
- **凭据注意（不入笔记，用户知晓）**：对话中出现过 nodeapp 密码占位/明文形态，用户选择暂不轮换、走完流程后续处理；`.env` 内容值后续一律 redact。
- **已解决（不再跟踪）**：bcrypt 编译 OOM 风险（b/c 实测解除）；「启动即失败契约」欠账（B4 销账）；D2 启动顺序悖论（问题 9 选 A + 验收句落地）；**测试凭据 admin@example.com 轮换（D4-HTTP ① 完成，密码管理器托管 + 登录实测 200）**。

## 下一步

新会话按 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md) 恢复后，两件事按序：

1. **week8 管理后台部署（新任务，方案已冻结待执行）**：`week8-fullstack/src/frontend`（Vite+React+TS）→ 服务器 yarn 装依赖 → `yarn build`（管理后台，不设 VITE_SHOWCASE_ONLY）→ Nginx 新 site `listen 8080` + `root` 指向 dist + `/auth /reports /users` 反代 127.0.0.1:3000 → `ufw allow 8080/tcp`（信任边界变更为 22+80+8080）→ 公网 `http://43.128.154.242:8080` 登录（admin + 密码管理器新密码）+ 报表 + week2 根路径回归。所有概念契约已沉淀 day4 笔记 §10；本地 dev（5173 + vite proxy）与生产（8080 + Nginx 反代）的差异是理解要点。**执行口径 20–40 分钟；含理解口径 60–90 分钟（理解可拆到 D4-HTTPS 前热身）。**
2. **D4-HTTPS**：Nginx 443 + sslip.io 子域名 + certbot（Let's Encrypt）证书；实际签发不可用 → 回退纯 IP+HTTP（该回退路径已可用）。HTTP 线经验（Nginx 站点、ufw、凭据）直接复用。
3. 时间允许：时区边界观察点是否按业务时区修正（属代码改动，需走 review）。
4. D5：重启/证书续期检查/端口边界 + 冷路径复核 + demo 证据与项目叙述。

## 验收命令或证据

- **D4-HTTP 已收口（2026-08-12）**：本地开发机 `curl -I http://43.128.154.242/` → 200 + Server: nginx + X-Powered-By: Express；`POST http://43.128.154.242/auth/login` → 200 + accessToken；`GET http://43.128.154.242/reports/monthly-sales?months=6`（Bearer token）→ 200 + 真实聚合数据（2026-03 起 258 单 / 146988.82 元）。admin 凭据轮换闭环：密码管理器值实测登录 200（day4 笔记 §6）。
- **D2/D3 已收口**：`systemctl status nodeapp mongod` 均 active；`sudo ss -tlnp | grep -E "3000|27017"` 见 127.0.0.1 两端口；接口 `GET /reports/monthly-sales?months=6` 返回 6 个月聚合数据（B2/B3 证据在 day3 笔记 §5）。
- **B1**：2000 用户 + 5057 订单 + `getIndexes()` email unique true（day3 笔记 §5-B1）。
- **B3**：reboot 后双服务自起 + 接口 200（day3 笔记 §5-B3）。
- **B4**：快失败注入 → failed 停住（journal：restart counter at 5 / Start request repeated too quickly）+ 恢复 200（day3 笔记 §5-B4）。
- **B5**：mongod 187.4MB / nodeapp 83.9MB / available 1388MB（day3 笔记 §5-B5）。
- 第一轮基线（3 suites / 9 tests / ESLint 0）只作回归基线，对生产链路零证明力；生产链路验收以 B2/B3 端到端为准。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓ D4-HTTP✓）、[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)、[`day2-host-and-node-service.md`](./week9-deployment/notes/day2-host-and-node-service.md)、[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md)（§5 阶段 B 执行记录）、[`week9-roadmap-d1-d4.md`](./week9-deployment/notes/week9-roadmap-d1-d4.md)（D1–D4 浓缩地图）、[`day4-http-reverse-proxy.md`](./week9-deployment/notes/day4-http-reverse-proxy.md)（D4-HTTP 执行记录 + 三个认知修正）。
3. 涉及代码：`week2-express/src/` 的 `server.js`、`package.json`、`config/db.js`、`seedUsers.js`、`seedOrders.js`、`controllers/services/repositories/routes/middlewares/models`（B2 链路已读）；服务器 `.env`（600、nodeapp 属主、值不外传）；服务器 Nginx 配置 `/etc/nginx/sites-available/shop`。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- 2026-08-12（D4-HTTP）：AI 全程 **L1 引导 + review + 经验知识讲解**——前置设计题（反代 header 语义）本人作答四类 + trust proxy，AI review 通过；读代码后「不消费 req.ip/protocol/hostname → 不配 XFF/XFP、不做 trust proxy」为本人追加决策；凭据轮换给 L2 骨架（黑名单「密码哈希与存储策略」止步 L2），脚本由本人补全实现；nginx/ufw 命令属白名单给最小形态。AI 流程管控缺口：写库前的「密码管理器已记录」前置验证漏了（一度找不到密码），已记入 day4 笔记 §2.3。
- 2026-08-12（D3 全天）：AI 全程 **L1 引导 + review + 经验知识讲解**——阶段 A 与阶段 B 均未给核心实现骨架；白名单领域（命令形态、mongosh 参数、systemd 字段名、seed 命令）给最小样板。
- 阶段 B 的 AI 辅助内容：B1 三连 review（autoIndex 归观察点、authSource 方向修正 ×2、count 命令形态）；B2 链路事实摸清（register 必须走真实链路、MON 密码长度≥15、completed 口径锚点、read -s 终端限制、--env-file/import 的 cwd 依赖）；B3 三连 review（Requires/EnvironmentFile 违反冻结）；B4 快失败注入设计（Wants 连带拉起盲区 → JWT_SECRET 短值触发校验①秒失败）；B5 口径修正（available 判断锚点、swap 现状、nodeapp 高 RSS 排查）。
- 认知修正（本人执行期新增）：⑥ `read -s` 网页终端读不到 stdin（len=0 实证）；⑦ `node -e` ESM import 按 cwd 解析模块；⑧ `Wants` 在 start 时连带拉起依赖服务（B4 第一轮实证）；⑨ 快失败 vs 慢失败是 StartLimitBurst 设计核心（B4 第二轮附带学习）；⑩ 聚合 `$year/$month` 按 UTC 而服务器 CST（B3 时区观察点）；⑪ ESM 文件脚本 import 锚在脚本文件位置（/tmp 找不到 node_modules）；⑫ sudo 默认 env_reset 丢弃环境变量（需 --preserve-env）。
- 欠账跟踪：问题 9 选 A 的「启动即失败契约」补验 **B4 已销账**；测试凭据 admin@example.com 轮换 **D4-HTTP ① 已闭环**；时区边界观察点排入 D5 决策（新欠账形态，非黑名单）。
- 未触发 `DEBT.md` 新记账（L1 + 白名单，不记债）。
