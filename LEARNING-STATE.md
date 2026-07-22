# 当前学习状态

> 最后更新：2026-07-22（Asia/Shanghai）

## 当前进度

- 当前周：**W5 · Node.js 底层原理**
- 当前 Day：**D3 · 先续接被打断的 D2 threadpool 主线**。
- W4 硬截止时间 **2026-07-17（周五）**，已按期收口；W5 周期 **7/20–7/24**，硬截止 **2026-07-24（周五）**（见 `week5-nodejs-internals/notes/week5-plan.md`）
- 应用代码目录：`week2-express/src/`
- 本周笔记目录：`week5-nodejs-internals/notes/`
- 展示前端目录：`week8-fullstack/src/frontend/`（白名单资产，AI 可维护）
- 学习模式：**D4（2026-07-23）起转入居家学习**；必须用手机完成的任务按下方「居家阶段·手机任务隔离规则」执行。

## 最近完成

- D1 事件循环最小模型已完成：能区分同步调用栈、Node next tick queue、V8 microtask queue 与 libuv phases；已实测 CommonJS / ESM 顶层差异、顶层 timer / immediate 的不确定顺序、I/O callback 内 immediate 先于 timer，以及任务饥饿。
- 2026-07-21 开始 D2 前重跑基线：Node `v24.16.0`，`npm run day1` 通过；本次 timer / immediate 样本为 immediate 先，仅作观测、不作固定顺序结论。
- D2 CPU 阻塞实验已通过：修正 timer 注册与 CPU 执行的独立测量基准后，隔离复验得到 `20ms → wait 100ms / late 0ms`、`2000ms → wait 2004ms / late 1904ms`，现象支持同步 CPU 任务阻塞 timer callback。
- D5 完成三个第一档重建：注册调用链、JWT 签发链路、RBAC 授权链路。`DEBT.md` 已同步：①–④ 第一档重建全部通过，掌握证据统一安排 W5 D5（7/24）周验收前补齐。
- 主线 demo 已按 `week4-auth/notes/week4-demo-script.md` 实跑通过（本人确认）：register → login → member 403 → mongosh 提权 → admin 200。
- Login 计时枚举形成当前结论：今天不修；记录为安全遗留，不新增 DEBT。触发条件是进入生产/公网/扫描场景；后续优先方案是 dummy bcrypt compare + rate limiting。
- OAuth2 授权码流程完成学习主线：区分 Authorization Server / Resource Server、code / access token、state、redirect URI、client_id / client_secret、第三方 token 与本系统 JWT。
- OAuth2 学习成果已同步到 `week8-fullstack/src/frontend/` 的展示 tab；demo 讲稿按周命名为 `week4-auth/notes/week4-demo-script.md`。
- 本地 Node/Yarn 环境问题已解决：`nvm` 方向明确，前端 Yarn 3 + node-modules 模式可用，`yarn typecheck` 与 `yarn build` 已通过。
- D5 周复盘与 Week3 协作问题回看已整理进当天笔记。
- W5 计划已建立：核心目标是运行时判断力，不做底层名词巡游；见 `week5-nodejs-internals/notes/week5-plan.md`。

## 当前主线

W5 D3 先补完被打断的 D2 libuv、线程池与阻塞判断模型：

```text
先判断任务由 JS 主线程、OS 异步机制还是 libuv threadpool 执行
→ 预测 CPU 密集 JS 对 timer / HTTP 响应的影响
→ 本人编写并运行最小 CPU 阻塞实验
→ 本人编写并运行 fs / crypto 线程池排队实验
→ 对照 UV_THREADPOOL_SIZE 前后现象
→ 产出 I/O 慢 vs CPU 慢 vs 线程池慢判断表
```

threadpool 主线收口前不进入 stream、错误生命周期或 worker threads，不修改 Week2–4 主应用，也不回头处理 W3 遗留。

2026-07-21 学习因临时面试暂停；这是外部中断，不改变已通过的 D1 与 D2 CPU 阻塞验收结论。2026-07-22 已从 threadpool 归属判断继续，并将首个问答按真实日期迁入 D3 笔记；不为追赶进度压缩核心理解。

## 下一步

1. 回答 D3 笔记中的“Threadpool 归属 · 纠正题 2”：只判断同步 `while` 忙等制造的是主线程阻塞还是 threadpool 排队，并解释 timer callback 推迟的原因。
2. 由本人设计并实现线程池排队对照；运行前先写预测，核心 demo 仍由本人完成。
3. W5 D5（7/24）周验收前补齐 `DEBT.md` ①–⑤ 的重建与掌握证据，满足标准后才标「已还」。
4. Week3 回看只保留必要问题：自然月边界、explain / index 结论、CI `MONGODB_URI`、`match-index-explain.js`。
5. 不把 Week3 回看自动升级为新增 DEBT；只有符合 `AGENTS.md` 欠债触发条件时才单独记账。
6. 若后续自我反思出现过度自我贬低，AI 需要阻断并把问题改写为可验证、可行动的事实。

## 当前阻塞与风险

- 2026-07-21 临时面试打断 D2；2026-07-22 已续接，但 threadpool 排队、`UV_THREADPOOL_SIZE` 对照和判断表仍未开始。原定 D3 Stream 主线需在 threadpool 收口后按实际剩余时间顺延，当前不提前砍核心范围。
- W3 数据库线存在已知遗留：`week2-express/src/match-index-explain.js` 仍不可运行；covered query 验证实验以修复它为前提。
- W3 的自然月边界、`months=6`、时区语义、lookup/index/explain 结论需要回看：目标是澄清问题，不是扩大债务。
- 响应信封全量迁移按计划降级到 W6：错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状并存。
- 401/403 的服务端原因日志仍未落地。
- 老用户文档无 `role` 字段时按 schema 默认值被视为非 admin，行为可接受但未用真实老数据确认。
- OAuth2 目前是流程级学习与展示，不是真实第三方登录接入；这是本周范围取舍，不是实现缺陷。

## 居家阶段·手机任务隔离规则（2026-07-23 起）

自 D4（2026-07-23）转入居家学习后，对必须用手机完成的任务执行以下隔离规则，避免手机侵蚀主线学习。

- 触发条件：任务必须用手机完成（面试问答练习、Python 碎片学习等电脑端 Claude 不可用的场景）。
- 执行：
  1. 手机任务固定时段，不散落在全天——每天 1–2 个固定时间块，每块 ≤40 分钟。
  2. 时段开始前，明确写下本次要做的具体内容（不是「练面试」，而是「过一遍 backend-qa-sheet 前 10 题」）。
  3. 时段结束，手机离开书房（放另一个房间／包里），不带回书桌。
  4. 时段外想到任何「该看看 XX」的念头，记一行到当天待办，不当场用手机查——集中到下一个手机时段处理。
- 记录：每天在本文档补一行——今天手机时段做了什么、有没有超时／中途划走。

## 手机时段日志

> 每天一行，格式：`- YYYY-MM-DD：时段①做了什么（用时／是否超时）；时段②……；是否中途划走`。7/23 起开始记录。

<!-- 示例：- 2026-07-23：时段① 过 backend-qa-sheet 前 10 题（38min，未超时）；无中途划走 -->

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
7. `week5-nodejs-internals/notes/day2-libuv-threadpool-blocking.md`
8. `week5-nodejs-internals/notes/day3-threadpool-continuation.md`
9. `week4-auth/notes/day5-rebuild-oauth-demo-retrospective.md`（仅在追溯 W4 收口时读取）
10. Week3 review 时读取 `week3-mongoose/notes/`、Week3 相关 commits、`week2-express/src/` 的增量代码
11. `git status --short` 与当前任务相关 diff

## AI 辅助记录

- W4 鉴权属黑名单，援助上限 **L2（原理讲解、设计提示、骨架、review）**；AI 不直接实现认证鉴权核心代码。
- `week8-fullstack/` 展示前端、Yarn/NVM 配置、demo 讲稿属于白名单或展示资产，AI 可直接维护，但不替代核心学习代码。
- D5 OAuth2 为流程理解与 demo 展示整理，未做真实第三方登录核心实现。
- 当前欠债状态以 `DEBT.md` 为准（2026-07-21 已更新）：①–④ 第一档重建已通过、待补掌握证据；⑤ CPU 阻塞实验测量基准待在 W5 D5（7/24）第一档重建并补证据。
- Week3 回看只做问题澄清；除非明确触发 `AGENTS.md` 的欠债条件，不新增学习债务。
- W5 Node.js 底层属黑名单，事件循环、流与背压、worker 等核心 demo 由本人实现；AI 只做 L1/L2 讲解、实验设计、review 与笔记整理。
- 2026-07-21，AI 对 CPU 阻塞 demo 的 timer 测量基准给出 L2 定向 review；已同步 `DEBT.md` 与当天笔记，核心修改仍由本人完成。
