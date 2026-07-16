# 当前学习状态

> 最后更新：2026-07-16（Asia/Shanghai）

## 当前进度

- 当前周：**W4 · 认证与鉴权**
- 当前 Day：**D4 已完成（最小 RBAC 主线达成，三项止步条件全过）；D5（7/17 周五）是本周最后一个有效学习日**
- 本周硬截止时间：**2026-07-17（周五）**
- 应用代码目录：`week2-express/src/`
- 本周笔记目录：`week4-auth/notes/`

## 最近完成

- 前端展示后台已完整搭好（白名单资产，AI 搭建维护，`week8-fullstack/src/frontend/`）：登录/注册 → 报表看板（KPI 行 + 月度趋势柱图 + 客户消费 Top 8 条形图，手写 SVG，图表/表格可切换）→ 鉴权链路演示面板（一键复现 401/403/200）；member 登录降级为 403 说明卡。跨域用 Vite proxy 解决，后端零改动。已通过 tsc + build 与真实浏览器截图验证（亮/暗、admin/member）。**计划调整**：原 `api.ts` 留给 W6 的接线 TODO 按本人 7/16 要求由 AI 提前完成（依据 7/15 决策「前端仅为展示、AI 搭建、本人不写」）；W6 保留的学习点改为端到端链路的验收讲解，见 `week8-fullstack/README.md` 分工表。D5 demo 动线也写在该 README。
- D4 笔记已整理为 `week4-auth/notes/day4-rebuild-projection-minimal-rbac.md`（原 `day4.md` 已合并进该文件并删除）：自然月边界重建记录、投影模型校准与 `findOneAndUpdate` 预测实验、401/403 与角色来源推导、requireRole 实现与 review 过程、接线验证与测试记录。
- 自然月边界第一档重建通过（还债 ①，回忆 + 推导）：四问验收全过；按还债标准仍需补至少一项掌握证据后才能标「已还」。
- 投影理解模型校准完成：投影是 MongoDB 原生功能（Mongoose 把 `select: false` 编译成原生投影下发）；save 返回的是内存对象、写路径没有投影工序；`findOneAndUpdate` 预测实验验证「看返回值来自哪里」的新模型（默认返回不带 `passwordHash`，显式 `+passwordHash` 才加回）。
- 最小 RBAC 完成：401/403 语义推导（403 由接口契约的授权规则定义）；可信角色来源定为数据库 `User.role`（member/admin，默认 member，token 仍只放 `sub`）；`requireRole` 中间件在 `validateToken` 之后做角色型路由授权，资源归属授权明确留给 service 层（本周不做）。
- requireRole 首版被 review 打回一次（阻断性：catch 把所有异常伪装成 403，错误分层误导调用方），修正为三分：`req.auth` 缺失 → 401；role 不匹配 → 403；数据库异常原样透传全局错误处理。
- 两个报表接口（customer-spending、monthly-sales）接成 admin-only；admin 账号经 register + mongosh 提权创建（不开放注册传 role，防客户端自我提权；提权命令记入根 `README.md`）。
- 真实验证三条路径：无 token 401、member token 403、admin token 200。
- 集成测试重构：`beforeAll` 创建 admin/member 两个真实用户并分别签发 token，新增 member 403 关键失败路径测试；测试基线变为 2 套件 / 7 测试通过。
- Postman 两份资产同步：新增 admin 凭据登录（自动保存 `adminAccessToken`）与 member forbidden 403 用例，报表请求改用 admin token（白名单资产，AI 维护）。
- 上午顺带工程化：根 `README.md` 新增 mongosh 常用命令与索引方向表；W3 遗留 `reports.js` explain 脚本改为按 stage 打印性能摘要并移除会覆盖 `userInfo` 的第二个 `$lookup`。
- 修掉一处误提交：`LEARNING-PROTOCOL.md` 末尾曾被误粘贴追加一段 RBAC 接线建议（与 day4 笔记重复、不属于该规范职责），已删除，正文以笔记为准。
- D1–D3 概要（详见各日笔记）：D1 完成 Week 3 Demo 与 `months=6` 自然月边界修复；D2 完成注册竖切 + 提前完成 Login 凭据验证（bcrypt、统一 401、历史无 hash 用户拒绝）；D3 完成 JWT 签发契约与实现、Bearer 验证中间件、报表接口受保护、CI 红灯复盘（加认证 = 破坏性契约变更）并引入 ESLint + Prettier。

## 当前主线

完成并理解最小自建账号认证闭环：

```text
密码哈希 ✅
→ 注册 ✅
→ 登录 ✅
→ JWT 签发与验证 ✅
→ 鉴权中间件 ✅
→ 受保护接口 ✅
→ 最小 RBAC ✅（角色型路由授权；资源归属授权留 service 层，本周不做）
→ 关键路径测试 ✅（Jest 403 + Postman 401；非法/过期 token 用例未自动化）
```

D5 收口：还债重建、Login 计时枚举结论、主线 demo、OAuth2 授权码流程说明（按周三门槛结论保持流程说明级别，不写第三方登录代码）、周复盘。

## 下一步

D5 开工先读 `week4-auth/notes/day4-rebuild-projection-minimal-rbac.md` 第 12 节（明日入口）与 `week4-plan.md` D5 checklist。D5 排得很满，开工时先排优先级。

1. 上午还债重建（第一档，各 15–20 分钟，AI 不提示只验收）：② 注册调用链文件职责与依赖方向；③ JWT 签发链路配置校验与分层边界；④ RBAC 授权链路（重画 `validateToken → requireRole → controller`，讲清 401/403 分界）。
2. Login 计时枚举风险形成明确结论：修复，或写下暂不修复的理由与触发条件（D4 顺延项）。
3. 主线 demo：register → login → member 403 → mongosh 提权 → admin 200。可直接用前端展示后台走这条动线（`week8-fullstack/README.md`「页面与演示路径」）。
4. OAuth2 授权码流程说明：state / redirect URI / code / token 的职责与威胁点。
5. 确认 `DEBT.md` 四条欠债状态（含自然月边界补证据），写第 2 篇周复盘。

## 当前阻塞与风险

- W4 只剩 D5 一个有效学习日，待办密度高：三个重建单元 + 计时枚举结论 + demo + OAuth2 流程 + 周复盘。优先级以还债与 demo 为先，OAuth2 保持流程说明不加码。
- Login 计时枚举风险仍未形成结论（错误密码约 314ms vs 不存在用户约 2ms），D4 显式顺延至 D5，是止步条件中唯一未完成项。
- 响应信封全量迁移按计划降级 W6：403/401 等错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状并存（见 `errors/userErrors.js` TODO）。
- 401/403 的服务端原因日志（D3 遗留）仍未落地。
- 老用户文档无 `role` 字段时按 schema 默认值被视为非 admin（403），行为可接受但未用真实老数据确认。
- `week2-express/src/match-index-explain.js` 仍不可运行（W3 遗留，混用 mongosh 与 Node.js API）；covered query 验证实验以它修复为前提。
- 月度聚合仍有时区语义边界，已记录，不阻塞 W4。

## 验证基线

在 `week2-express/src/` 下运行：

```bash
npm test -- --runInBand
```

最近一次基线：**2 个测试套件、7 个测试通过**（D4 新增 member 403 用例）。`npm run lint` 0 errors、9 个存量 warnings。

## 恢复状态时需要读取的文件

1. `AGENTS.md`
2. `LEARNING-PROTOCOL.md`
3. `LEARNING-STATE.md`
4. `README.md`（W4 计划与验收目标）
5. `week4-auth/notes/week4-plan.md`
6. `week4-auth/notes/day4-rebuild-projection-minimal-rbac.md`（最近一篇日记）
7. `git status --short` 与当前任务相关 diff
8. 鉴权代码相关任务时，读取 `week2-express/src/` 下与当前步骤直接相关的文件

## AI 辅助记录

- W4 鉴权属黑名单，援助上限 **L2（原理讲解、设计提示、骨架、review）**，任何情况下不升 L3/L4（见 `AGENTS.md` 黑白名单）。
- AI 尚未提供任何 W4 鉴权核心实现；D4 的 role 字段、`findUserRoleById`、`requireRole`、错误映射、路由接线、集成测试均由本人手写，AI 只做引导式问答与 review。
- **提问规范执行情况**：D4 引导式提问按 2026-07-15 固化进 `AGENTS.md` 的规范执行（一问一个设计点、标注流程与阶段），未再出现两问合一。D4 新增一处 AI 表达偏差并即时修正：「简明注册链路」把 `.save()` 调用时序与 MongoDB 入库压扁成一层，修正约束已固化进 `AGENTS.md`「跨层链路讲解」（区分代码调用顺序 / 职责归属 / 返回值来源）。
- 当前欠债状态（详见 `DEBT.md`）：① 自然月报表边界——第一档重建已通过，待补至少一项掌握证据后可标已还；② 注册调用链、③ JWT 签发链路——D5 上午第一档重建；④ 最小 RBAC（2026-07-16 记账，L2）——D5 上午或周验收前第一档重建。
- 黑名单知识点给到 L2 即在 `DEBT.md` 记账，并在周验收前按重建梯子安排延迟重建；此处只保留当前欠债结论和指针。
