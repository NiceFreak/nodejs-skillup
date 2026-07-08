# Week 3 计划 · Mongoose 进阶与查询优化（7/6–7/10）

> 收口计划下的第一周。主线：聚合管道 + 查询优化（2–3 个较复杂场景）。
> 本周起执行**工作量平铺**：每天顺手补 1–2 个测试（起习惯，别攒到 W6），周五写第 1 篇周复盘。
> 说明：下面只列**做什么 / 验收到什么程度**，聚合与优化的实现由本人写；AI 只讲解、review。

## 每日 checklist

- [x] **Day 1（周一 7/6）· 聚合基础**：`$match → $group → $sort` 走通「客户消费统计报表」；`explain` + 复合索引把慢查询变成可对比证据。（已完成，见 `day1-aggregation.md`）
- [x] **Day 2（周二 7/7）· 多阶段管道**：聚合竖切进分层架构（四层 + 三个决策）；`$lookup → $unwind → $project` 关联查询；populate/N+1 对比；首个单元测试。（已完成，见 `day2-lookup-populate-testing.md`）
- [x] **Day 3（周三 7/8）· 月度趋势聚合（独立设计）+ 集成测试**：脱离引导独立设计第三个聚合场景（`$year`/`$month` 提取分组键、跨年正确性、`$sort` 先于 `$project`）；竖切成 `GET /reports/monthly-sales`；抽出通用 `validatePositiveInt`；从零搭起集成测试（mongodb-memory-server + 生命周期钩子 + Supertest + 断言不变量）。（已完成，见 `day3-monthly-trend-integration-testing.md`）
      - 计划原定的 **populate 与 N+1** 已在 Day 2 提前完成（见 `day2-lookup-populate-testing.md`），故 Day 3 顺延为月度聚合 + 集成测试。
- [ ] **Day 4（周四 7/9）· 查询优化**：对前几天的查询做 `explain` 分析,补/调索引,记录优化前后差异；整理成一篇独立的查询优化笔记（Day 1 已有 explain + 复合索引实践,待抽出成篇）。
- [ ] **Day 5（周五 7/10）· 收尾 + 平铺**：补齐笔记；跑一遍 demo 确认可演示（讲稿已就绪,见 `week3-demo-script.md`）。

## 本周平铺任务（别攒到 W6）

- [x] **测试随手写**：**超额完成**——单元测试（`validateStatus` / `validatePositiveInt`）+ 集成测试（`monthly-sales` 全链路），已破冰并跑通「能连库 + 聚合结果符合预期」。
      - 目的：起「测试即产出的一部分」的习惯；CI 骨架（`.github/workflows/ci.yml`）已就绪，加了测试会自动跑。
      - 边界：测试用例**由本人写**（这是 W6 的核心学习点，提前练手而已），AI 只讲思路 / review。
      - ⚠️ 待办（W6 相关）：集成测试目前用 `mongodb-memory-server`，未读取 CI 提供的 `MONGODB_URI`（`ci.yml` 起了 `mongo:7` service 却没被用到）。W6 接 CI 时让测试优先读 `MONGODB_URI`、本地回落内存库。
- [ ] **第 1 篇周复盘（周五，15–30 min）**：本周学到的最关键 1–2 点 + 一个还没吃透的问题。**提纲已就绪**（`week3-retrospective.md`），待本人填写中文稿 + 英文版。
      - 与并行线「每周写一段英文技术总结」合流，可直接用英文写。
      - 这些周复盘到 W6 直接汇总成技术总结，不再从零写。

## 验收标准（沿用计划表）

- ✅ 2–3 个复杂聚合场景（分组统计、多阶段管道）+ 关联查询能跑 —— **已达 3 个**（客户消费 / `$lookup` 关联 / 月度趋势）。
- ⬜ 一篇查询优化笔记：能讲清各管道阶段、索引对 `explain` 的影响 —— 素材在 Day 1 笔记里,待抽成独立一篇（Day 4）。
- ✅ 掌握判据：能**脱离 AI 从空白重建**一个聚合 demo —— **已达成**（月度趋势报表为独立设计）。

> **本周进度小结（截至 Day 3 / 7/8）**：主线聚合 + 测试**已提前完成**（含原计划 Day 5 的量),Day 4–5 宽松。剩余待办:①查询优化笔记（Day 4）②周复盘中文+英文稿（提纲已备）③Day 5 demo 自测（讲稿已备）。
