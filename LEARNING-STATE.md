# 当前学习状态

> 最后更新：2026-08-12（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**2026-08-12（D3 计划执行日，午前至午后）——P4 达成，D2 正式收口；D3 计划阶段 B 未做，顺延进 D4 之前**。
- D2 收口记录：[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md) §4.1（验收句四项全满足：systemd active ×2 + ss 3000/27017 在听）。
- D3 计划：[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md)（**阶段 A 全部完成：槽位 0/a/b/c/d/e/f/g/h/i/j 十项收口即 D2 收口；阶段 B 五项未做顺延**）。
- W9 周期：**实际收口 8/15**（D2 占两天所致，D4/D5 听后移）。
- 周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓、D2✓ 已勾选；D3 未勾【阶段 B 待续】；D4/D5 待做）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（冻结不变）。
- 服务器：腾讯云首尔二区，公网 IPv4 `43.128.154.242`，Ubuntu 22.04.5，2 核 / 2 GB / 40 GB SSD，到期 2026-11-10；SSH 密钥认证唯一通道（ubuntu + admin.pem），网页终端 root 带外应急。

## 最近完成

- **2026-08-12（D3 阶段 A / D2 收口）**：
  - 槽位 0：D2 步骤 1–5 只读复核通过；`apt-cache policy` 实证发行版源 Mongo 零候选。
  - 槽位 a：nodeapp 身份 clone 整仓（`/home/nodeapp/nodejs-skillup`）；umask=002 三重证据闭合（775 权限归因）；root 挡不住 600 / nologin 不能 `su -` 两个认知修正。
  - 槽位 b：bcrypt 6 走 **node-gyp-build/prebuildify**（编译产物打进 npm 包、零下载零现场编译）；npm 11 allowScripts 生效（修正 D2 §2.2 推断）；OOM 闸门风险实质下降。
  - 槽位 c：`npm ci --omit=dev` 通过（nodeapp 身份 102 包、无 memory-server/gyp 字样、require 成功）。
  - 槽位 d：MongoDB 8.0.29 官方 apt 渠道装齐、mongod.service enabled+active（初始 RSS 93.1M，低于文档推断的 WiredTiger≈450MB——空载不预分配，待 B5 归因）。
  - 槽位 e：**认证启用**（conf `security.authorization: enabled`）+ 双用户（admin=userAdminAnyDatabase、nodeapp=readWrite on shop，建在 admin 库）+ Localhost Exception 窗口流程；27017 只走 127.0.0.1 实证；目录/工具边界混淆（mongosh JS vs bash）、ping 不是认证判定命令两个教训。
  - 槽位 f：`.env` 三键建立（MONGODB_URI 含 authSource=admin / PORT / JWT_SECRET≥32；600、nodeapp 属主；ENV_LOADED 通过）。
  - 槽位 g：server.js 加 HOST（`process.env.HOST || '127.0.0.1'`）进 git、服务器 pull 拿到（ed982ac）；本地 npm test 回归 9 passed。
  - 槽位 h：nodeapp 前台跑通（`服务运行端口: 127.0.0.1:3000` + 优雅关闭闭环）——**Mongo 认证 URI 第一次真实跑通**。
  - 槽位 i：**本人设计 nodeapp.service**（After+Wants+Restart=on-failure+RestartSec=10s+TimeoutStopSec=30s+KillMode+StartLimitBurst=5/60s），七条契约逐条实证（kill -9 自动重启 / SIGTERM 优雅关闭 / journald / enabled）。
  - 槽位 j / P4：**D2 验收句四项全满足**（nodeapp+mongod 均 systemd active、ss 见 127.0.0.1:3000 与 127.0.0.1:27017）。
  - 收尾：周计划 D2 勾选、D3 阶段 A 备注；口语稿生成。

## 当前主线

```text
D3 计划阶段 B（未做，顺延进 D4 之前，不挤压 D4 公网 HTTPS 主线）：
B1 seed（先 users 后 orders；观察 Mongoose autoIndex vs readWrite 无 createIndexes 的预期警告）
B2 服务器内部端到端 200（登录拿 token → GET /reports/monthly-sales → 127.0.0.1:3000）
B3 重启恢复（reboot 后两服务自起 + 接口 200）
B4 欠账补验（stop mongod → 启动 Node → failed 且按 StartLimitBurst 停住而非无限重启）
B5 实测 RSS（Node + mongod，对照 D3 §2.2 推断，D4 装 Nginx 前内存闸门依据）
下一步 = D4：公网 HTTPS（Nginx 80/443 + ufw 放行 + sslip.io 子域名 + Let's Encrypt 证书 + 回退 IP+HTTP）
```

**重要澄清（用户 2026-08-12 提问）**：`http://43.128.154.242` **现在访问不到是设计使然**——Node 只监听 127.0.0.1:3000、3000 不在公网端口全集（80/443/22）、ufw 仅放 22。公网可达需 D4（Nginx 反代 + ufw 放行 80/443 + 证书）。D2 的「服务器内部可验证」已达成（SSH 内 ss 可见），「公网可访问」是 D4 验收，不是 D2/D3。

## 当前阻塞与风险

- **Swap=0（持续）**：2 GB 无缓冲垫。bcrypt 不吃编译内存（b/c 已证），mongod 空载 93MB，但 **B5 未实测 RSS**、D4 加 Nginx 前必须以 B5 为闸门。
- **阶段 B 五项未做（顺延项）**：seed / 端到端 200 / 重启恢复 / 欠账补验（问题 9 选 A 的欠账未销）/ RSS。每项独立可停。
- **sslip.io 路线待验证（持续）**：D4 实际签发不可用则回退纯 IP + HTTP（HTTPS 降 stretch）。
- **服务端 8.0 vs 本地已验证组合 mongo:7**：8.0.29 已装且 Node 认证连通过（h 实测），跨大版本兼容性已初步验证；seed 数据 + B2 端到端会进一步实证。
- **凭据注意（不入笔记，用户知晓）**：对话中出现过 nodeapp 密码占位/明文形态，用户选择暂不轮换、走完流程后续处理；`.env` 内容值后续一律 redact。
- **已解决（不再跟踪）**：bcrypt 编译 OOM 风险（b/c 实测解除）；Mongo 未装 → 启动即失败契约（已有人为补验安排 B4）；D2 启动顺序悖论（问题 9 选 A + 验收句落地）。

## 下一步

新会话按 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md) 恢复后，从阶段 B 或 D4 开始（用户届时选择）：

1. 阶段 B（推荐优先，趁环境仍热）：
   - B1：`sudo -u nodeapp bash -c 'cd .../week2-express/src && node --env-file=.env seedUsers.js'` → 同法 seedOrders.js（先 users 后 orders）。观察点：Mongoose autoIndex 会尝试建 email unique 索引，readWrite 无 createIndexes——可能出现 index build 警告但不中止插入（3.1 自查第 1 条预告）。
   - B2：curl 127.0.0.1:3000 登录拿 token → GET /reports/monthly-sales 返回 200。
   - B3/B4/B5：重启恢复 / 欠账补验 / RSS（命令见 day3 笔记 §5）。
2. 或直接 D4（若想先连公网）：Nginx + ufw 80/443 + sslip.io + 证书；阶段 B 顺延到 D4 与 D5 之间。

## 验收命令或证据

- **D2 已收口**：`systemctl status nodeapp mongod` 均 active；`sudo ss -tlnp | grep -E "3000|27017"` 见 127.0.0.1:3000 与 127.0.0.1:27017（证据在 day3 笔记 §4.1）。
- **D3 阶段 A 已收口**：槽位 0–j 十项执行记录 + 七条契约逐条实证（day3 笔记 §4 执行记录）。
- **阶段 B 未产生证据**：不预写（seed 行数 / token / 200 状态由真实执行回填）。
- 第一轮基线（3 suites / 9 tests / ESLint 0）只作回归基线，对生产链路零证明力（测试走 mongodb-memory-server）；本地 npm test 在 g 槽已回归通过（9 passed），但生产链路验收以 B2 端到端为准。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓）、[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)、[`day2-host-and-node-service.md`](./week9-deployment/notes/day2-host-and-node-service.md)（步骤 1–5 + 问题 9–16）、[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md)（问题 17–22 + 十槽位执行记录 + §5 阶段 B）。
3. 涉及代码：`week2-express/src/` 的 `server.js`（HOST 已改）、`package.json`、`config/db.js`、`seedUsers.js`、`seedOrders.js`；服务器 `.env`（600、nodeapp 属主、值不外传）。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- 2026-08-12（D3 执行）：AI 全程 **L1 引导 + review + 经验知识讲解**（allowScripts、prebuildify、ss 列语义、systemd 字段拼写、`restart` 异步时序、Localhost Exception、`--env-file` 优先级、Requires 连带停不计入限速等）；未给拓扑/认证/单元/步骤序列实现的骨架。
- 白名单援助于执行期：`mongosh` 连接命令、`db.createUser` 参数、systemd 字段名、apt 安装命令、seed 命令形态——均属 API 细节/样板，不记债。
- 认知修正（本人执行期经历）：① bcrypt 机制假设（node-pre-gyp→node-gyp-build/prebuildify）；② `allowScripts` 生效（D2 §2.2 修正）；③ 「root 挡不住 600」三现后收敛；④ ping ≠ 认证判定命令；⑤ systemctl restart 异步。
- 欠账跟踪：问题 9 选 A 的「启动即失败契约」补验排入 **B4**，补完销账；本次对话有密码明文出现（用户选择暂不轮换），状态文件只记「待用户自行处理」，细节不入笔记。
- 未触发 `DEBT.md` 新记账（L1 + 白名单，不记债）。