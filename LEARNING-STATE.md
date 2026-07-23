# 当前学习状态

> 最后更新：2026-07-23（Asia/Shanghai）· D4 S3 背压信号通过

## 当前进度

- 当前周：**W5 · Node.js 底层原理**
- 日历位置：**W5 D4（7/23）**；内容进度：**D2 已收口，Stream S1–S3 已通过，进入 S4 可观察 demo 的证据设计**。落后由 7/21 临时面试（客观）+ 后半段下钻 fd/poll/TCP/HTTP parser 查资料（主观）共同造成，已停止下钻。
- 收口安排调整为：**D4（7/23）Stream 与背压**；**D5（7/24）错误边界与进程生命周期**；**7/25 周六不安排强制学习；7/26 周日完整休息**；**D6 在 7/27 首个完整专注块完成 Worker 边界、到期重建、串讲与四问复盘**。D6 通过后进入 W6，7/31 硬截止不变。
- W4 硬截止时间 **2026-07-17（周五）**，已按期收口；W5 调整周期 **7/20–7/27 收口**（见 `week5-nodejs-internals/notes/week5-plan.md`）
- 应用代码目录：`week2-express/src/`
- 本周笔记目录：`week5-nodejs-internals/notes/`
- 展示前端目录：`week8-fullstack/src/frontend/`（白名单资产，AI 可维护）
- 学习模式：**D4（2026-07-23）起转入居家学习**；必须用手机完成的任务按下方「居家阶段·手机任务隔离规则」执行。

## 最近完成

- D1 事件循环最小模型已完成：能区分同步调用栈、Node next tick queue、V8 microtask queue 与 libuv phases；已实测 CommonJS / ESM 顶层差异、顶层 timer / immediate 的不确定顺序、I/O callback 内 immediate 先于 timer，以及任务饥饿。
- 2026-07-21 开始 D2 前重跑基线：Node `v24.16.0`，`npm run day1` 通过；本次 timer / immediate 样本为 immediate 先，仅作观测、不作固定顺序结论。
- D2 CPU 阻塞实验已通过：修正 timer 注册与 CPU 执行的独立测量基准后，隔离复验得到 `20ms → wait 100ms / late 0ms`、`2000ms → wait 2004ms / late 1904ms`，现象支持同步 CPU 任务阻塞 timer callback。
- **D2 threadpool 主线已全部收口（2026-07-22）**：threadpool 归属判断、pbkdf2 排队实测（`SIZE=4` 呈 4+4 两批 / Total 151ms，`SIZE=8` 聚成一批 / Total 119ms）、`UV_THREADPOOL_SIZE` 边界（改变分组但不保证总耗时按比例缩短）、以及「I/O 慢 vs CPU 主线程阻塞 vs threadpool 排队」三类判断表全部通过并按事实/推断/未测量三层收紧措辞。已验收结论汇总到 `day3-threadpool-continuation.md` 顶部「复盘速览」，原始问答日志保留为过程记录。
- **D4 S1 整块读取的业务风险已通过（2026-07-23）**：能区分 V8 heap 与 Buffer 的 external / ArrayBuffer 内存，说明并发重叠造成的内存压力与失败方式不确定性，并解释完整读取使首字节等待覆盖整个文件读取过程。吞吐数字未实测，只作假设示例。
- **D4 S2 Readable / Writable 最小模型已通过（2026-07-23）**：能映射 producer / consumer 职责，并区分 chunk、内部 buffer 与 Node `Buffer`；已纠正 buffer 与 chunk 生命周期误解。
- **D4 S3 背压信号已通过（2026-07-23）**：能从速度差推导积压风险，串联 `write() === false`、暂停上游、`'drain'` 与恢复生产，并说明 `highWaterMark`、`false` 和 `'drain'` 的证据边界。
- W4 D5 完成三个第一档重建：注册调用链、JWT 签发链路、RBAC 授权链路。`DEBT.md` 已同步：①–④ 第一档重建全部通过，掌握证据已随当前计划调整到 W5 D6（7/27 首个完整专注块）补齐。
- 主线 demo 已按 `week4-auth/notes/week4-demo-script.md` 实跑通过（本人确认）：register → login → member 403 → mongosh 提权 → admin 200。
- Login 计时枚举形成当前结论：今天不修；记录为安全遗留，不新增 DEBT。触发条件是进入生产/公网/扫描场景；后续优先方案是 dummy bcrypt compare + rate limiting。
- OAuth2 授权码流程完成学习主线：区分 Authorization Server / Resource Server、code / access token、state、redirect URI、client_id / client_secret、第三方 token 与本系统 JWT。
- OAuth2 学习成果已同步到 `week8-fullstack/src/frontend/` 的展示 tab；demo 讲稿按周命名为 `week4-auth/notes/week4-demo-script.md`。
- 本地 Node/Yarn 环境问题已解决：`nvm` 方向明确，前端 Yarn 3 + node-modules 模式可用，`yarn typecheck` 与 `yarn build` 已通过。
- D5 周复盘与 Week3 协作问题回看已整理进当天笔记。
- W5 计划已建立：核心目标是运行时判断力，不做底层名词巡游；见 `week5-nodejs-internals/notes/week5-plan.md`。

## 当前主线

W5 D2 的 libuv / 线程池 / 阻塞判断模型已全部收口，主线转向 **居家 D4 Stream 与背压**（原定 D3 主题，因 D2 跨日续接顺延）。学习目的明确为对接潜在正式 Node.js 后端工作：能对大文件导出 / 转发作实现判断、review 背压风险、处理生产错误边界，并基于证据提出排障假设。

```text
readFile vs stream 内存模型
→ producer / consumer 速度差
→ backpressure（highWaterMark / drain 表达什么信号）
→ pipe vs pipeline（错误与生命周期）
→ stream error 为什么必须处理
→ 最小文件处理 / 转发 demo（本人实现）
```

进入 Stream 前不回头下钻 `epoll/kqueue/IOCP`、TCP 重组、HTTP parser 内部（已划入 backlog），不修改 Week2–4 主应用，也不回头处理 W3 遗留。

2026-07-21 学习因临时面试暂停（外部中断，不改变 D1、D2 已通过结论）；2026-07-22 续接并收口 D2 全部剩余主线。后半段一度下钻到 fd/poll/TCP/HTTP parser，已在 D3 结尾判断为超出 D2 止步条件并主动停止——**核心判断力（提正确假设 + 知道该测什么）已具备，短板是把模型用到真实服务指标/日志/trace 上**，不为「显得底层」继续占用 W5 时间。

## 下一步

1. **D4 S4 先由本人定义可观察 demo 的证据契约**：什么现象能证明暂停、恢复和积压受控；暂不写代码。
2. D4 依次通过 S1–S5：业务风险 → 最小数据流 → 背压信号 → 本人 demo → `pipeline()` 生产边界；见 `day4-stream-backpressure.md`。
3. D5（7/24）只做错误捕获表与 graceful shutdown；7/25、7/26 休息，均不安排强制学习或展示审核。
4. D6 放在 7/27 首个完整专注块：完成最小 Worker 边界、`DEBT.md` ①–⑤ 的到期重建与掌握证据、三个运行时场景串讲和 15 分钟四问复盘；通过后再进入 W6。
5. Week3 回看只保留必要问题：自然月边界、explain / index 结论、CI `MONGODB_URI`、`match-index-explain.js`。
6. 不把 Week3 回看自动升级为新增 DEBT；只有符合 `AGENTS.md` 欠债触发条件时才单独记账。
7. 若后续自我反思出现过度自我贬低，AI 需要阻断并把问题改写为可验证、可行动的事实。

## 当前阻塞与风险

- **进度曾落后一个完整主题**：不再用碎片周末消化，D6 顺延到 7/27 的首个完整专注块。代价是 W6 最多让出一个专注块；7/31 硬截止不变，时间不足时先砍展示范围，不压缩掌握闸门，也不把未掌握内容标为完成。
- W3 数据库线存在已知遗留：`week2-express/src/match-index-explain.js` 仍不可运行；covered query 验证实验以修复它为前提。
- W3 的自然月边界、`months=6`、时区语义、lookup/index/explain 结论需要回看：目标是澄清问题，不是扩大债务。
- 响应信封全量迁移按计划降级到 W6：错误响应仍有 `{ error }` 与 `{ code, message }` 两种形状并存。
- 401/403 的服务端原因日志仍未落地。
- 老用户文档无 `role` 字段时按 schema 默认值被视为非 admin，行为可接受但未用真实老数据确认。
- OAuth2 目前是流程级学习与展示，不是真实第三方登录接入；这是本周范围取舍，不是实现缺陷。

## 复盘展板回填 · 待本周学习后回看（2026-07-22 记）

一个小复盘的结论，先记一笔，等本周（D4–D6）核心学习收口后再回看落地，避免现在跟 Stream 抢时间。

- **判断轴：值不值得做可视化复盘看内容类型，不看第几周。** 数据 / 状态 / 流程 / 时序类（DB 查询与 explain、认证流、事件循环与线程池）可视化收益高；框架管道类（Express 中间件顺序、分层职责、错误流转）基本是文字性的，画成图收益低。
- **现状**：W3（聚合）、W4（认证）、W5（运行时）已有复习板。高收益里 **W1（mongodb）是唯一还空着的周**，是最值得回填的一块。
- **优先级**：W1 回填值得做，但排在 D4 Stream 之后、不与本周核心学习抢时间；**W2（Express 基础）相对低优先，排队尾**，真做也就一张「请求 → 中间件 → 分层 → 错误处理」的职责图，别期望它像 explain / 事件循环那样出彩。这是相对优先级，不是不做。
- **待议**：是否把「周收口时刷新 / 补当周复习板」固化为收口固定动作，等本周学习完成后回看再定，不提前写进 `LEARNING-PROTOCOL.md`。
- **回看触发**：本周（D4–D6）学习收口后。

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
9. `week5-nodejs-internals/notes/day4-stream-backpressure.md`
10. `week4-auth/notes/day5-rebuild-oauth-demo-retrospective.md`（仅在追溯 W4 收口时读取）
11. Week3 review 时读取 `week3-mongoose/notes/`、Week3 相关 commits、`week2-express/src/` 的增量代码
12. `git status --short` 与当前任务相关 diff

## AI 辅助记录

- W4 鉴权属黑名单，援助上限 **L2（原理讲解、设计提示、骨架、review）**；AI 不直接实现认证鉴权核心代码。
- `week8-fullstack/` 展示前端、Yarn/NVM 配置、demo 讲稿属于白名单或展示资产，AI 可直接维护，但不替代核心学习代码。
- D5 OAuth2 为流程理解与 demo 展示整理，未做真实第三方登录核心实现。
- 当前欠债状态以 `DEBT.md` 为准：①–④ 第一档重建已通过、待补掌握证据；⑤ CPU 阻塞实验测量基准待在 W5 D6（7/27 首个完整专注块）第一档重建并补证据。
- Week3 回看只做问题澄清；除非明确触发 `AGENTS.md` 的欠债条件，不新增学习债务。
- W5 Node.js 底层属黑名单，事件循环、流与背压、worker 等核心 demo 由本人实现；AI 只做 L1/L2 讲解、实验设计、review 与笔记整理。
- 2026-07-21，AI 对 CPU 阻塞 demo 的 timer 测量基准给出 L2 定向 review；已同步 `DEBT.md` 与当天笔记，核心修改仍由本人完成。
- 2026-07-22，AI 对 threadpool 排队 demo（`pbkdf2-test.js`）与判断表做多轮 L2 收口 review（纠正运行时模型与过度结论，按事实/推断/未测量三层收紧）；`pbkdf2-test.js` 核心逻辑与实测由本人完成。判断表属于笔记体例整理，AI 直接汇总到 `day3-threadpool-continuation.md` 顶部「复盘速览」，未替代学习本身。
- 2026-07-22，采纳「停止下钻底层」的投入产出判断：`epoll/kqueue/IOCP` 差异、TCP 重组、Node HTTP parser 内部实现划入 7/31 后 backlog，与 `week5-plan.md` §3「本周不追」一致；这是范围取舍，不是掌握缺口。
- 2026-07-22，展示前端 W5 复习板（白名单资产）由 AI 增补：新增已验收的 threadpool 排队可视化（pbkdf2 4+4 vs 8 实测、可回放）与三类慢判断表，并给 CPU 阻塞时间线加回放动画；只呈现已验收知识，`yarn typecheck`／`yarn build` 通过。
- 2026-07-22，展示前端新增 **W3「数据库聚合」复习板**（白名单资产，`W3Board.tsx` + `w3Topics.ts`，Showcase 加 tab）：只沉淀已验收结论——`$match` 复合索引 explain（COLLSCAN→IXSCAN、三数相等）、`$lookup` 关联性能（collectionScans 3→0）、聚合分层（意图/实现）、自然月半开区间；**仍未澄清 / 未验证的部分（`$lookup` 子管道、Decimal128→DTO、`match-index-explain.js` 阻塞的 covered query、months=6/时区语义）单列「仍在路上」面板并标清状态**，不伪装成已掌握。数字与结论对齐 `week3-mongoose/notes/` 与 `DEBT.md`，`typecheck`／`build` 通过。目的是降低 W3 复习负担、让「已踏实 vs 仍欠着」一眼可辨。
- 2026-07-22，展板视角开关初版使用 `localStorage` 并藏在登录前入口；该方案已于 2026-07-23 被下条状态模型替代。
- 2026-07-23，展板改为**展示 / 复习双内容状态**：这是无需登录的内部工具状态，不承担访问控制。干净 URL 默认展示状态，只显示中性技术内容；`?mode=review` 进入复习状态，展开 W3 开放问题与自我复盘，并显示醒目提示。状态、tab 与 W3/W5 当前专题统一写入 URL hash，避免复习状态残留进内部 demo。
