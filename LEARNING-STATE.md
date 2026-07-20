# 当前学习状态

> 最后更新：2026-07-20（Asia/Shanghai）

## 当前进度

- 当前周：**W5 · Node.js 底层原理**
- 当前 Day：**D1 · 事件循环最小模型已开始**。
- W4 硬截止时间 **2026-07-17（周五）**，已按期收口；W5 周期 **7/20–7/24**，硬截止 **2026-07-24（周五）**（见 `week5-nodejs-internals/notes/week5-plan.md`）
- 应用代码目录：`week2-express/src/`
- 本周笔记目录：`week5-nodejs-internals/notes/`
- 展示前端目录：`week8-fullstack/src/frontend/`（白名单资产，AI 可维护）

## 最近完成

- D5 完成三个第一档重建：注册调用链、JWT 签发链路、RBAC 授权链路。`DEBT.md` 已同步：①–④ 第一档重建全部通过，掌握证据统一安排 W5 D5（7/24）周验收前补齐。
- 主线 demo 已按 `week4-auth/notes/week4-demo-script.md` 实跑通过（本人确认）：register → login → member 403 → mongosh 提权 → admin 200。
- Login 计时枚举形成当前结论：今天不修；记录为安全遗留，不新增 DEBT。触发条件是进入生产/公网/扫描场景；后续优先方案是 dummy bcrypt compare + rate limiting。
- OAuth2 授权码流程完成学习主线：区分 Authorization Server / Resource Server、code / access token、state、redirect URI、client_id / client_secret、第三方 token 与本系统 JWT。
- OAuth2 学习成果已同步到 `week8-fullstack/src/frontend/` 的展示 tab；demo 讲稿按周命名为 `week4-auth/notes/week4-demo-script.md`。
- 本地 Node/Yarn 环境问题已解决：`nvm` 方向明确，前端 Yarn 3 + node-modules 模式可用，`yarn typecheck` 与 `yarn build` 已通过。
- D5 周复盘与 Week3 协作问题回看已整理进当天笔记。
- W5 计划已建立：核心目标是运行时判断力，不做底层名词巡游；见 `week5-nodejs-internals/notes/week5-plan.md`。

## 当前主线

W5 D1 只建立事件循环最小模型：

```text
先预测顶层脚本输出
→ 运行最小观测脚本
→ 对比 sync / process.nextTick / Promise / setTimeout / setImmediate
→ 用调用栈、队列和 event loop phase 解释差异
→ 再比较 I/O callback 内的 timer / immediate
```

今天不进入 libuv 线程池、stream、错误生命周期或 worker threads，也不回头处理 W3 遗留。

## 下一步

1. 由本人创建并在运行前预测 W5 D1 顶层事件循环最小观测脚本的输出顺序；AI 只做出题与验收。
2. W5 D5（7/24）周验收前补齐 `DEBT.md` ①–④ 的掌握证据（每条至少两项：脱离解释复述数据流与取舍 / 修改需求预测影响层 / 关键失败路径补测试设计），满足标准后才标「已还」。
3. Week3 回看只保留必要问题：自然月边界、explain / index 结论、CI `MONGODB_URI`、`match-index-explain.js`。
4. 不把 Week3 回看自动升级为新增 DEBT；只有符合 `AGENTS.md` 欠债触发条件时才单独记账。
5. 若后续自我反思出现过度自我贬低，AI 需要阻断并把问题改写为可验证、可行动的事实。

## 当前阻塞与风险

- W3 数据库线存在已知遗留：`week2-express/src/match-index-explain.js` 仍不可运行；covered query 验证实验以修复它为前提。
- W3 的自然月边界、`months=6`、时区语义、lookup/index/explain 结论需要回看：目标是澄清问题，不是扩大债务。
- 响应信封全量迁移按计划降级到 W6：错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状并存。
- 401/403 的服务端原因日志仍未落地。
- 老用户文档无 `role` 字段时按 schema 默认值被视为非 admin，行为可接受但未用真实老数据确认。
- OAuth2 目前是流程级学习与展示，不是真实第三方登录接入；这是本周范围取舍，不是实现缺陷。

## 验证基线

- 后端最近基线：在 `week2-express/src/` 下 `npm test -- --runInBand`，D4 记录为 **2 个测试套件、7 个测试通过**。
- 前端最近基线：在 `week8-fullstack/src/frontend/` 下 `yarn typecheck` 与 `yarn build` 通过。
- 主线 demo 已按 `week4-demo-script.md` 实跑通过（2026-07-17，本人确认）。

## 恢复状态时需要读取的文件

1. `AGENTS.md`
2. `LEARNING-PROTOCOL.md`
3. `LEARNING-STATE.md`
4. `README.md`
5. `week5-nodejs-internals/notes/week5-plan.md`
6. `week5-nodejs-internals/notes/day1-event-loop.md`
7. `week4-auth/notes/day5-rebuild-oauth-demo-retrospective.md`（仅在追溯 W4 收口时读取）
8. Week3 review 时读取 `week3-mongoose/notes/`、Week3 相关 commits、`week2-express/src/` 的增量代码
9. `git status --short` 与当前任务相关 diff

## AI 辅助记录

- W4 鉴权属黑名单，援助上限 **L2（原理讲解、设计提示、骨架、review）**；AI 不直接实现认证鉴权核心代码。
- `week8-fullstack/` 展示前端、Yarn/NVM 配置、demo 讲稿属于白名单或展示资产，AI 可直接维护，但不替代核心学习代码。
- D5 OAuth2 为流程理解与 demo 展示整理，未做真实第三方登录核心实现。
- 当前欠债状态以 `DEBT.md` 为准（2026-07-17 已更新）：①–④ 第一档重建全部通过，均待补至少两项掌握证据，统一安排 W5 D5（7/24）周验收前；补齐前不标「已还」。
- Week3 回看只做问题澄清；除非明确触发 `AGENTS.md` 的欠债条件，不新增学习债务。
- W5 Node.js 底层属黑名单，事件循环、流与背压、worker 等核心 demo 由本人实现；AI 只做 L1/L2 讲解、实验设计、review 与笔记整理。
