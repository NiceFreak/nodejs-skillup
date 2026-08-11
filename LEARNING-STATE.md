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
W9 D2 剩余（8/12 续）：块 D 步骤 6–11
-> 6 clone 整仓到 /home/nodeapp（nodeapp 属主，跟踪 origin/main）
-> 7 /tmp 探 bcrypt 是否本地编译 → npm ci --omit=dev
-> 8 .env 三键 600（MONGODB_URI/PORT/JWT_SECRET，nodeapp 属主）
-> 9 本地 server.js 加 HOST 默认 127.0.0.1 → commit → push → 服务器 pull
-> 10 systemd 单元（本人写，对照 D1 问题 6 七条契约）
-> 11 按问题 9 验收句验证（systemctl active + ss -tlnp 见 3000/27017）
```

## 当前阻塞与风险

- **Swap=0（持续）**：无交换分区，2 GB 内存跑 Node + MongoDB + Nginx 无缓冲垫；步骤 7 `npm ci` 是近期首个内存压力点（bcrypt 是否本地编译待探明）。
- **bcrypt 原生依赖编译风险（持续）**：步骤 7 前先 /tmp 探明 node-pre-gyp 走下载还是 node-gyp 编译；OOM 回退按问题 13 冻结决策。
- **MongoDB 未装（问题 9 选 A 的欠账）**：D2 验收句要求 3000/27017 在听；Mongo 安装前移 D2 尾声（步骤 11 前）；「Mongo 缺失→启动即失败→StartLimitBurst 停住」契约需 D3 人为故障补验（已记欠账）。
- **sslip.io 路线待验证（持续）**：D3/D4 实际签发证书时若不可用或 Let's Encrypt 拒绝，回退纯 IP + HTTP（HTTPS 降 stretch，链路验收不受影响）。
- **已解决的（不再跟踪）**：D2 目标句与代码冲突（问题 9 已定选 A）；ufw/sshd 两个不可逆步骤（已完成且验证通过）；SSH 22 公网开放兜底（密钥认证 + PermitRootLogin no 已落地）。

## 下一步

明日（8/12）从 [`day2-host-and-node-service.md`](./week9-deployment/notes/day2-host-and-node-service.md) 第 6 节步骤 6 续，每步先答问题三连：

1. 步骤 6：git clone 整仓到 `/home/nodeapp/nodejs-skillup`（nodeapp 属主，跟踪 origin/main）
2. 步骤 7：先在 /tmp 临时目录探 bcrypt（看 node-pre-gyp 走下载还是编译），再 `npm ci --omit=dev`
3. 步骤 8：建 `.env`（MONGODB_URI / PORT / JWT_SECRET，600，nodeapp 属主；用户名/密码/secret 生成后直写服务器，不进文档不进 git）
4. 步骤 9：本地改 `server.js` 加 `HOST` 默认 `127.0.0.1` → commit → push origin main → 服务器 git pull
5. 步骤 10：本人写 systemd 单元（对齐 D1 问题 6 七条契约）并做七条契约自查表
6. 步骤 11：按问题 9 验收句验证（`systemctl status` active + `ss -tlnp` 见 3000/27017）
7. 块 E：收口——Node 进程实测 RSS、D2 通过/不通过判定、勾选 `week9-plan.md`、更新本文件、生成口语稿

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
- 2026-08-11 协作规范更新：`AGENTS.md` 第 4 节新增「可推导 vs 经验知识」小节（**不改变黑白名单与硬线**）——源自 D2 曾把第一次见无法推导的工具行为当可推导考核，导致学习者「每一步碰运气」。
- 未触发 `DEBT.md` 记账（L1 不记债）。若后续提供 systemd/Nginx 白名单样板（L3/L4 最小实现），不记债；若拓扑/安全边界推理给出骨架，必须按 `AGENTS.md` 第 5 节记账。
- 第一轮 `DEBT.md` ①-⑧均已还；第二轮当前无新增债务；问题 9 选 A 欠账（启动即失败契约 D3 补验）仍跟踪。
