# 当前学习状态

> 最后更新：2026-08-10（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**W9 Day 1 已收口，契约已冻结**；下一步进入 D2（主机与 Node 内部服务）。
- 第二轮周期：2026-08-10 至 2026-09-11，共 5 周；当前输入是 [`Nodejs_Skillup_Plan_202608.xlsx`](./plan/Nodejs_Skillup_Plan_202608.xlsx)。
- 本周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1 已勾选，正式执行版已冻结）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（8 个决策已作答、链图/端口表/成功+失败路径/只读基线已填）。
- 服务器：腾讯云首尔二区轻量应用服务器，公网 IPv4 `43.128.154.242`，2 核 / 2 GB / 40 GB SSD，Ubuntu 22.04.5 LTS，到期 2026-11-10；SSH 密钥认证已验证可用，只读基线已记录（空载可用内存 1468 MB、根分区可用 34G、Swap=0）。

## 最近完成

- 2026-08-10 **W9 D1 契约冻结**：唯一验收接口 `GET /reports/monthly-sales`（`week2-express/src/`）；纵深防御（Node 绑 127.0.0.1 + 防火墙最小放行）；公网端口全集 443/80/22（27017 不开放）；systemd 守护契约；seed 脚本数据（跨月订单 + admin 账号）；sslip.io 免费子域名签发 HTTPS 证书；在主部署后第二遍按文档冷路径复核。
- 前置概念补齐：反向代理 / 防火墙两层 / 监听地址 0.0.0.0 vs 127.0.0.1 / 证书验证原理 / SSH 密钥机制，已记录在 D1 笔记第 2.6 节。
- 服务器只读基线：Ubuntu 22.04.5、内存可用 1468 MB、磁盘可用 34G、Swap=0、SSH 连通正常。

## 当前主线

```text
W9 D2（8/11）：主机与 Node 内部服务
-> 按 D1 端口表核对服务器当前实际端口状态（先看现状，再动手改）
-> 服务器基础初始化与最小访问控制
-> Node 服务受 systemd 守护，先在服务器内部可验证
```

## 当前阻塞与风险

- **Swap=0**：无交换分区，2 GB 内存同时跑 Node + MongoDB + Nginx 无缓冲垫，D2/D3 必须实测进程内存。
- **sslip.io 路线待验证**：D3 实际签发证书时若 sslip.io 不可用或 Let's Encrypt 拒绝，回退为纯 IP + HTTP（HTTPS 降 stretch，链路验收不受影响）。
- **SSH 22 端口公网开放 0.0.0.0/0**：本人无固定 IP 的务实取舍；D2 必须落地「禁用密码登录、仅密钥认证」来兜底。
- **手动冷路径复核的已知残余**：清理清单靠人手写，若清单漏步骤且无残留可查，第二遍无法暴露文档缺口（D1 已记为已知降级）。

## 下一步

D2（8/11）第一个动作：

0. 按 [`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md) 第 5.2 节端口表，SSH 只读核对服务器当前实际端口状态（`ss -tlnp` / 安全组现状），**先看现状，再动手改**。
1. 服务器基础初始化：系统更新、禁用密码登录仅密钥认证（D1 问题 5 的兜底）、基础防火墙放行 443/80/22。
2. 安装 Node 运行环境，`week2-express/src/` 克隆 + `npm install` + 创建 `.env`（600 权限，属主=运行用户）。
3. 编写 systemd 单元（对齐 D1 问题 6 的 7 条契约），Node 内部可验证后进入 D3。

## 验收命令或证据

- D1 已完成：8 个决策答案 + 链图 + 端口表 + 成功/失败路径 + 只读基线（见 day1 笔记第 4/5 节）。
- D2 验收证据尚未产生：不预写「Node 内部可验证」或「systemd 存活」。
- 第一轮基线（3 suites / 9 tests / ESLint 0）只作回归基线，对生产链路零证明力（测试走 mongodb-memory-server）。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. `week9-deployment/notes/week9-plan.md`、`week9-deployment/notes/day1-contract-freeze.md`。
3. 进入 D2 后读取：`week2-express/src/` 的 `server.js`、`package.json`、`.env.example`。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- 2026-08-10（D1）：AI 全程 **L1 引导 + 提问 + review**；补充前置概念（反代/防火墙/监听地址/证书原理/SSH 密钥）属于 L1 原理讲解，未提供拓扑/信任边界/凭据/失败路径的骨架或实现。
- 概念缺口已在 D1 笔记第 2.6 节记录（云服务器、反代、防火墙、监听地址、请求旅程、代码上云、证书验证、SSH 密钥）；这些是**当天暴露的掌握缺口**，需在后续重建中验证能脱离解释讲清。
- 未触发 `DEBT.md` 记账（L1 不记债）。若 D2/D3 开始提供 systemd/Nginx 白名单样板（L3/L4 最小实现），不记债；若拓扑/安全边界推理给出骨架，必须按 `AGENTS.md` 第 5 节记账。
- 第一轮 `DEBT.md` ①-⑧均已还；第二轮当前无新增债务。