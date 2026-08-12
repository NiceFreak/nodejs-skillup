# 当前学习状态

> 最后更新：2026-08-12（Asia/Shanghai）

## 当前进度

- 当前周：**第二轮 W9，主题为“从零到线上：部署链路”**。
- 当前 Day：**2026-08-12——D3 计划（阶段 A + 阶段 B）全部完成，D3 收口（P4 + P5 达成）**。
- D2/D3 收口记录：[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md) §4.1（D2 验收句）+ §5（阶段 B 五项执行记录）。
- W9 周期：**实际收口 8/15**（D2 占两天所致，D4/D5 听后移）。
- 周计划：[`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓ 已勾选；D4/D5 待做）。
- D1 契约：[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)（冻结不变）。
- 服务器：腾讯云首尔二区，公网 IPv4 `43.128.154.242`，Ubuntu 22.04.5，2 核 / 2 GB / 40 GB SSD，到期 2026-11-10；SSH 密钥认证唯一通道（ubuntu + admin.pem），网页终端 root 带外应急。

## 最近完成

- **2026-08-12（D3 完整收口：阶段 A + 阶段 B）**：
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
下一步 = D4：公网 HTTPS（Nginx 80/443 + ufw 放行 + sslip.io 子域名 + Let's Encrypt 证书 + 回退 IP+HTTP）。
D3 全部收口，阶段 B 无遗留；进入 D4 前可复习时区边界观察点（是否按业务时区修正 $dateToString）。
```

**重要澄清（用户 2026-08-12 提问）**：`http://43.128.154.242` **现在访问不到是设计使然**——Node 只监听 127.0.0.1:3000、3000 不在公网端口全集（80/443/22）、ufw 仅放 22。公网可达需 D4（Nginx 反代 + ufw 放行 80/443 + 证书）。D2/D3 的「服务器内部可验证」已达成（SSH 内 ss 可见 / 接口 200），「公网可访问」是 D4 验收。

## 当前阻塞与风险

- **Swap=0（持续，D4 闸门已过）**：B5 实测 available 1388MB、两进程 RSS 合计 ~271MB，加 Nginx（~20-50MB）安全；若后续收紧，选项为降 cacheSizeGB / 清缓存重启 / 加 swap（副作用 OOM 用磁盘兜底）。
- **sslip.io 路线待验证（持续）**：D4 实际签发不可用则回退纯 IP + HTTP（HTTPS 降 stretch）。
- **服务端 8.0 vs 本地已验证组合 mongo:7**：8.0.29 已装，B1 seed + B2 端到端实证读写/聚合兼容。
- **测试凭据 admin@example.com**：一次性测试密码（明文入过命令、已 history -c）；D4 接公网前**必须轮换**。
- **时区边界观察点（新发现，D5 决策）**：聚合 `$year/$month` 按 UTC、服务器 CST(UTC+8)，凌晨订单跨月归因偏差 3 单/月量级；D5 决定是否按业务时区修正（`$dateToString` 指定 timezone）。
- **凭据注意（不入笔记，用户知晓）**：对话中出现过 nodeapp 密码占位/明文形态，用户选择暂不轮换、走完流程后续处理；`.env` 内容值后续一律 redact。
- **已解决（不再跟踪）**：bcrypt 编译 OOM 风险（b/c 实测解除）；「启动即失败契约」欠账（B4 销账）；D2 启动顺序悖论（问题 9 选 A + 验收句落地）。

## 下一步

新会话按 [`LEARNING-PROTOCOL.md`](./LEARNING-PROTOCOL.md) 恢复后，从 D4 开始：

1. **D4 公网 HTTPS**：Nginx 反向代理（80/443 → 127.0.0.1:3000）+ ufw 放行 80/443 + sslip.io 子域名 + Let's Encrypt 证书（certbot）；实际签发不可用则回退纯 IP + HTTP。D4 前先处理测试凭据轮换（admin@example.com 改强密码）。
2. 时间允许：时区边界观察点是否按业务时区修正（属代码改动，需走 review）。
3. D5：重启/证书续期检查/端口边界 + 冷路径复核 + demo 证据与项目叙述。

## 验收命令或证据

- **D2/D3 已收口**：`systemctl status nodeapp mongod` 均 active；`sudo ss -tlnp | grep -E "3000|27017"` 见 127.0.0.1 两端口；接口 `GET /reports/monthly-sales?months=6` 返回 6 个月聚合数据（B2/B3 证据在 day3 笔记 §5）。
- **B1**：2000 用户 + 5057 订单 + `getIndexes()` email unique true（day3 笔记 §5-B1）。
- **B3**：reboot 后双服务自起 + 接口 200（day3 笔记 §5-B3）。
- **B4**：快失败注入 → failed 停住（journal：restart counter at 5 / Start request repeated too quickly）+ 恢复 200（day3 笔记 §5-B4）。
- **B5**：mongod 187.4MB / nodeapp 83.9MB / available 1388MB（day3 笔记 §5-B5）。
- 第一轮基线（3 suites / 9 tests / ESLint 0）只作回归基线，对生产链路零证明力；生产链路验收以 B2/B3 端到端为准。

## 需要读取的文件

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. [`week9-plan.md`](./week9-deployment/notes/week9-plan.md)（D1✓ D2✓ D3✓）、[`day1-contract-freeze.md`](./week9-deployment/notes/day1-contract-freeze.md)、[`day2-host-and-node-service.md`](./week9-deployment/notes/day2-host-and-node-service.md)、[`day3-finish-d2-and-db.md`](./week9-deployment/notes/day3-finish-d2-and-db.md)（§5 阶段 B 执行记录）。
3. 涉及代码：`week2-express/src/` 的 `server.js`、`package.json`、`config/db.js`、`seedUsers.js`、`seedOrders.js`、`controllers/services/repositories/routes/middlewares/models`（B2 链路已读）；服务器 `.env`（600、nodeapp 属主、值不外传）。
4. `git status --short`；不得覆盖用户已有改动或提交敏感信息。

## AI 辅助记录与延迟重建

- 2026-08-12（D3 全天）：AI 全程 **L1 引导 + review + 经验知识讲解**——阶段 A 与阶段 B 均未给核心实现骨架；白名单领域（命令形态、mongosh 参数、systemd 字段名、seed 命令）给最小样板。
- 阶段 B 的 AI 辅助内容：B1 三连 review（autoIndex 归观察点、authSource 方向修正 ×2、count 命令形态）；B2 链路事实摸清（register 必须走真实链路、MON 密码长度≥15、completed 口径锚点、read -s 终端限制、--env-file/import 的 cwd 依赖）；B3 三连 review（Requires/EnvironmentFile 违反冻结）；B4 快失败注入设计（Wants 连带拉起盲区 → JWT_SECRET 短值触发校验①秒失败）；B5 口径修正（available 判断锚点、swap 现状、nodeapp 高 RSS 排查）。
- 认知修正（本人执行期新增）：⑥ `read -s` 网页终端读不到 stdin（len=0 实证）；⑦ `node -e` ESM import 按 cwd 解析模块；⑧ `Wants` 在 start 时连带拉起依赖服务（B4 第一轮实证）；⑨ 快失败 vs 慢失败是 StartLimitBurst 设计核心（B4 第二轮附带学习）；⑩ 聚合 `$year/$month` 按 UTC 而服务器 CST（B3 时区观察点）。
- 欠账跟踪：问题 9 选 A 的「启动即失败契约」补验 **B4 已销账**；测试凭据 admin@example.com 轮换排入 D4 前置；时区边界观察点排入 D5 决策（新欠账形态，非黑名单）。
- 未触发 `DEBT.md` 新记账（L1 + 白名单，不记债）。
