# 当前学习状态

> 最后更新：2026-08-11（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**W9 Day 2 执行中（8/11 晚），块 D 已完成步骤 1–5，本人决策止步于步骤 5 收口**；步骤 6–11 留待明日（8/12）。
- D2 计划：[`day2-host-and-node-service.md`](./week9-deployment/notes/day2-host-and-node-service.md)（问题 9–16 已冻结、4.1 无冲突、块 C 现状核对完成、块 D 步骤 1–5 执行记录已回填）。
- 第二轮周期：2026-08-10 至 2026-09-11，共 5 周；当前输入是 [`Nodejs_Skillup_Plan_202608.xlsx`](./plan/Nodejs_Skillup_Plan_202608.xlsx)。
- 本周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1 已勾选，正式执行版已冻结）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（8 个决策已作答、链图/端口表/成功+失败路径/只读基线已填）。
- 服务器：腾讯云首尔二区轻量应用服务器，公网 IPv4 `43.128.154.242`，2 核 / 2 GB / 40 GB SSD，Ubuntu 22.04.5 LTS，到期 2026-11-10；SSH 密钥认证已验证可用，只读基线已记录（空载可用内存 1468 MB、根分区可用 34G、Swap=0）。

## 最近完成

- 2026-08-10 **W9 D1 契约冻结**：唯一验收接口 `GET /reports/monthly-sales`（`week2-express/src/`）；纵深防御（Node 绑 127.0.0.1 + 防火墙最小放行）；公网端口全集 443/80/22（27017 不开放）；systemd 守护契约；seed 脚本数据（跨月订单 + admin 账号）；sslip.io 免费子域名签发 HTTPS 证书；在主部署后第二遍按文档冷路径复核。
- 前置概念补齐：反向代理 / 防火墙两层 / 监听地址 0.0.0.0 vs 127.0.0.1 / 证书验证原理 / SSH 密钥机制，已记录在 D1 笔记第 2.6 节。
- 服务器只读基线：Ubuntu 22.04.5、内存可用 1468 MB、磁盘可用 34G、Swap=0、SSH 连通正常。
- 2026-08-11 **W9 D2 块 D 步骤 1–5 完成**：① 系统更新 113 包（含内核 5.15.0-187）+ reboot 生效；② nodeapp 专用非登录用户（UID 1002/GID 1003、nologin、/home/nodeapp 750）；③ ufw 激活（active、仅 22 双栈放行、新连接验证通过）；④ SSH 加固（PermitRootLogin no、公网密钥链路 PUBLIC_OK）；⑤ NodeSource Node v24.19.0（/usr/bin/node，npm 11.17.0）。

## 当前主线

```text
W9 D3（8/12）阶段 A：收掉 D2 尾巴 —— 计划见 day3-finish-d2-and-db.md
-> 先答问题 17-22（Mongo 渠道 / 认证边界 / 监听与守护 / 步骤表重推 /
   服务依赖 / .env 落点与 WorkingDirectory）
-> 槽位 a-j：clone → 探 bcrypt → npm ci → 装 Mongo → 认证与监听落地
   → .env → HOST 落地 → 手动跑通 Node → 写 systemd 单元 → 验收句
-> 阶段 B（阶段 A 收线后才进）：seed → 内部端到端 200 → 重启恢复
   → 欠账补验 → 实测 RSS
```

排法变更（2026-08-11 复盘）：D2 按「一天固定工作量」排，实测低估——90 分钟排 11 步、
重活（写 systemd 单元）垫在最后、且步骤表在问题 9 作答前写死导致漏了「装 MongoDB」。
D3 起改为「阶段 + 显式收工点（P1-P5）」，不设时间盒，到哪个收工点都算数。

## 当前阻塞与风险

- **Swap=0（持续）**：无交换分区，2 GB 内存跑 Node + MongoDB + Nginx 无缓冲垫；步骤 7 `npm ci` 是近期首个内存压力点（bcrypt 是否本地编译待探明）。
- **bcrypt 原生依赖编译风险（持续）**：步骤 7 前先 /tmp 探明 node-pre-gyp 走下载还是 node-gyp 编译；OOM 回退按问题 13 冻结决策。
- **MongoDB 未装（问题 9 选 A 的欠账）**：D2 验收句要求 3000/27017 在听。已排入 D3 阶段 A 槽位 d/e，且**必须在建 `.env` 之前**（`MONGODB_URI` 依赖问题 18 的认证决策）。「Mongo 缺失→启动即失败→StartLimitBurst 停住」契约需人为故障补验，已排入 D3 阶段 B4，补完销账。
- **内存闸门未量化**：WiredTiger 默认缓存按内存比例算（约「总内存 −1 GB」的一半，本机 ≈450 MB 量级，**推断待实测**）。Node + mongod 的实测 RSS 是 D4 装 Nginx 前的闸门依据，已排入 D3 阶段 B5。
- **W9 周期已顺延**：D2 实际占两天，收口从 8/14 顺延到 8/15。若 D4/D5 再顺延，先砍 Java stretch，不压缩链路验收。
- **sslip.io 路线待验证（持续）**：D3/D4 实际签发证书时若不可用或 Let's Encrypt 拒绝，回退纯 IP + HTTP（HTTPS 降 stretch，链路验收不受影响）。
- **已解决的（不再跟踪）**：D2 目标句与代码冲突（问题 9 已定选 A）；ufw/sshd 两个不可逆步骤（已完成且验证通过）；SSH 22 公网开放兜底（密钥认证 + PermitRootLogin no 已落地）。

## 下一步

明日（8/12）按 [`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md) 执行：

1. 只读复核 D2 步骤 1–5 的成果仍成立（内核 / nodeapp / ufw / sshd / node -v）。
2. 答问题 17–22 + 3.1 冲突自查 → **收工点 P1**。其中问题 20 要求**本人重推步骤表**（D2 的旧表漏了「装 MongoDB」，不要沿用）；问题 22 为 8/12 新增（`.env` 落点与 `WorkingDirectory` 的耦合）。
3. 阶段 A 槽位 a–j，顺序由问题 20 决定；每步先答问题三连。新增槽位 h「先手动跑通 Node 再上 systemd」，避免「单元写错」与「应用起不来」混成一个现象。
4. 到 **P4**（D2 验收句通过）才算 D2 正式收口，可勾选 `week9-plan.md` 的 D2。
5. 阶段 B（seed → 内部端到端 200 → 重启恢复 → 欠账补验 → 实测 RSS）只在 P4 之后进，没做完的顺延，**不挤压 D4 的公网 HTTPS 主线**。

新决策点（必须在建 `.env` 之前冻结）：MongoDB 是否启用认证（问题 18）——`MONGODB_URI` 的形态由它决定；`.env` 的落点（问题 22）——`--env-file=.env` 按进程 cwd 解析，与 systemd 的 `WorkingDirectory`、seed 的运行身份是同一个决策。

引导形态（8/12 判断，记在 D3 计划 §0.1）：决策类走**整体问题稿一次冻结**（互相咬死、且冻结前不做有副作用动作），执行类走**对话中一问一答**（答案依赖机器真实输出，预写即预写验收证据）。问题稿只出问题、不出步骤表。

## 验收命令或证据

- D1 已完成：8 个决策答案 + 链图 + 端口表 + 成功/失败路径 + 只读基线（见 day1 笔记第 4/5 节）。
- D2 验收证据尚未产生：不预写「Node 内部可验证」或「systemd 存活」。
- 第一轮基线（3 suites / 9 tests / ESLint 0）只作回归基线，对生产链路零证明力（测试走 mongodb-memory-server）。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. `week9-deployment/notes/week9-plan.md`、`week9-deployment/notes/day1-contract-freeze.md`、`week9-deployment/notes/day2-host-and-node-service.md`。
3. D2 涉及的代码（事实已汇总在 day2 计划第 2 节）：`week2-express/src/` 的 `server.js`、`package.json`、`config/db.js`、根 `.env.example`、根 `.nvmrc`。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- 2026-08-10（D1）：AI 全程 **L1 引导 + 提问 + review**；补充前置概念（反代/防火墙/监听地址/证书原理/SSH 密钥）属于 L1 原理讲解，未提供拓扑/信任边界/凭据/失败路径的骨架或实现。
- 概念缺口已在 D1 笔记第 2.6 节记录（云服务器、反代、防火墙、监听地址、请求旅程、代码上云、证书验证、SSH 密钥）；这些是**当天暴露的掌握缺口**，需在后续重建中验证能脱离解释讲清。
- 2026-08-11（D2 计划）：AI 汇总代码事实 + 起草问题 9–16 + 给出只读核对命令，属 **L1 + 白名单工具层**；未给验收定义、运行身份、执行顺序、systemd 单元内容。
- 2026-08-11（D2 执行期）：AI 全程 **L1 引导 + 经验知识直接讲解**（debconf 配置冲突、needrestart、ufw 确认提示、`sshd -T`、first-connect host key、NodeSource setup 脚本），未给黑名单骨架或实现；问题三连中所有核心决策（选 A 验收、nodeapp、NodeSource、PermitRootLogin no、HOST 进 git）均由本人拍板。
- 2026-08-12（D3 计划增补）：AI 读 `week2-express/src` 后补三处事实（驱动↔服务端版本约束、`.env` 落点由 cwd 决定、`JWT_SECRET` 校验先于 `connectDB`）、起草问题 22、记录 §0.1 引导形态判断；均为 **L1**，未给路径 / 单元内容 / 版本选择，**不记债**。
- 2026-08-11 协作规范更新：`AGENTS.md` 第 4 节新增「可推导 vs 经验知识」小节（**不改变黑白名单与硬线**）——源自 D2 曾把第一次见无法推导的工具行为当可推导考核，导致学习者「每一步碰运气」。
- 未触发 `DEBT.md` 记账（L1 不记债）。若后续提供 systemd/Nginx 白名单样板（L3/L4 最小实现），不记债；若拓扑/安全边界推理给出骨架，必须按 `AGENTS.md` 第 5 节记账。
- 第一轮 `DEBT.md` ①-⑧均已还；第二轮当前无新增债务；问题 9 选 A 欠账（启动即失败契约 D3 补验）仍跟踪。
