# 当前学习状态

> 最后更新：2026-08-10（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**W9 Day 1，正式 review 后的计划复查阶段**；尚未开始部署实现。
- 第二轮周期：2026-08-10 至 2026-09-11，共 5 周；当前输入是 [`Nodejs_Skillup_Plan_202608.xlsx`](./plan/Nodejs_Skillup_Plan_202608.xlsx)。
- 本周草案：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)。
- 今日执行清单：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)；已按代码事实列出 D1 的 8 个待决策问题，答案尚未填写。
- 腾讯云首尔二区轻量应用服务器已购买并运行中，公网 IPv4 为 `43.128.154.242`；规格为 2 核 / 2 GB / 40 GB SSD、512 GB/月流量、20 Mbps 峰值带宽，到期 2026-11-10 10:32:19。系统已重装为 Ubuntu Server 22.04 LTS 64-bit，网络连通性尚未验证。
- 控制台显示 IPv6 已开启；DDoS 基础防护为 2 Gbps、状态正常；主机安全未启用、状态未知。IPv6 地址和实际防护行为尚未验证。
- 第一轮 W1-W6 已于 2026-07-31 完成；其代码与验收证据保留为 W9 可复用资产，不自动代表生产部署已经验证。

## 最近完成

- 第一轮最终基线：后端 3 个 suites / 9 个 tests 通过，ESLint 0 errors；前端 typecheck 与生产构建通过。
- 第一轮完成真实登录后的 admin `200`、member `403`、无 Token `401` 全栈验证，并完成最终 demo 彩排。
- W9 目录已按既有 `notes/`、`src/` 结构建立；当前只有计划和占位文件，没有部署配置或核心实现。
- 2026-08-10 正式 review 后，Excel 新增 React + Java 岗位目标、W9 Spring Boot jar 锚点和 W11 Maven job，并明确 W11 复用 W9 服务器。
- 2026-08-10 二次修订 Excel：地域对齐首尔二区；systemd 成为 Node 主方案；MongoDB 明确同机、仅本机访问、空库或脱敏数据；Java jar / Maven job 降为 stretch；Jenkins controller 默认在开发机，S3 / AWS 凭据模型和 Docker 降为延伸项。

## 当前主线

```text
复查正式 review 后的第二轮 Excel
-> Excel 内容问题已修复
-> 确认目标应用、域名与人工复现证据
-> 冻结 W9 契约
-> 确认基础设施前置条件
-> 再开始主机、Node、MongoDB、Nginx 与 HTTPS 的部署链路
```

今天唯一主线是**冻结 W9 的可执行契约**。在目标应用、验收接口、云资源、域名、进程守护方案和 MongoDB 网络边界明确前，不开始不可逆或付费的基础设施操作。

## 当前阻塞与风险

- Excel 的地域、Java 范围、进程守护、MongoDB 安全边界、连续 / 独立表述和 Jenkins controller 问题均已修复；当前没有 Excel 内容阻断。
- W9 仍需确认目标 Node 应用与唯一验收接口、域名 / DNS 控制权、人工复现证据，之后才能冻结 D1。
- Ubuntu 20.04 支持风险已通过重装 22.04 解决，不再阻断。
- 域名与 DNS 控制权尚未确认。
- 2 GB 内存同时承载 Node、MongoDB 和 Nginx 的实际余量未知，后续必须以服务器上的进程与内存数据验证。
- Node 已选 systemd；MongoDB 已确定同机且仅本机访问，使用空库或脱敏数据。Java 只在主线验收和内存闸门通过后进入。
- 现有应用只验证过本地与 CI 行为；生产环境变量、持久化、网络暴露和重启恢复都仍是待验证项。

## 下一步

0. 按 [`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md) 第 4 节逐题作答；代码事实已核对：全仓库唯一可部署后端是 `week2-express/src/`，`server.js` 先连库后 listen、`app.listen` 未绑定 127.0.0.1、密钥经工作目录 `.env` 注入。
1. 确认复用的 Node 应用和唯一验收接口。
2. 确认域名与 DNS 修改权限，以及人工复现证据。
3. 确认 SSH 登录方式；密钥、密码和控制台凭据不得写入仓库或对话。
4. 将上述结论回填为正式 W9 计划，并同步根 `README.md` 的第二轮总览。
5. 只有 D1 契约冻结后才配置服务器。

## 验收命令或证据

- 修订后的 Excel 压缩结构完整，已解析为 1 个工作表、5 周安排；七处目标文本和相关行高均已复核，原内容阻断已解决。
- W9 最终验收证据尚未产生，不预写公网可访问、证书有效或数据库已接通。
- 第一轮工程基线需要在选定部署目标应用后重新运行；旧结果只作回归基线。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. `plan/Nodejs_Skillup_Plan_202608.xlsx`、`week9-deployment/notes/week9-plan.md`。
3. W9 契约确认目标应用后，再读取对应代码、测试、环境样例和启动入口。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- 2026-08-10：AI 仅解析计划、指出范围与契约风险，并创建白名单目录/记录骨架；没有提供部署核心决策或可运行实现，不触发 `DEBT.md`。
- W9 的拓扑、安全边界、失败路径和验收推理由本人先作答；AI 可做 L1 引导和 review。若后续对可迁移核心知识给到 L2，按 `AGENTS.md` 同步记债并安排重建。
- 第一轮 `DEBT.md` ①-⑧均已还；第二轮当前无新增债务。
