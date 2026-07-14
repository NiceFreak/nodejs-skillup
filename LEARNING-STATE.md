# 当前学习状态

> 最后更新：2026-07-13（Asia/Shanghai）

## 当前进度

- 当前周：**W4 · 认证与鉴权**
- 当前 Day：**D1 已完成；鉴权内容从 D2 正式开始**
- 本周硬截止时间：**2026-07-17（周五）**
- 应用代码目录：`week2-express/src/`
- 本周笔记目录：`week4-auth/notes/`

## 最近完成

- 学习规范已收紧并提交：W4 鉴权属黑名单，AI 辅助上限为 L2；超过 L1 的援助进入 `DEBT.md` 并安排延迟重建。
- Week 3 Demo 已完成展示。
- 修复 `months=6` 的语义：返回当前月加此前 5 个自然月。
- service 负责计算 `startDate/endDate`，repository 使用 `$gte/$lt` 半开区间。
- 月度报表集成测试已同步；用户报告结果为 2 个测试套件、6 个测试通过。
- 详细记录：`week4-auth/notes/day1-week3-demo-month-boundary-fix.md`。

## 当前主线

完成并理解最小自建账号认证闭环：

```text
密码哈希
→ 注册
→ 登录
→ JWT 签发与验证
→ 鉴权中间件
→ 受保护接口
→ 最小 RBAC
→ 关键路径测试
```

OAuth2 是否编码实现取决于主线进度。如果 D3 结束时 JWT 中间件还没有保护真实接口，OAuth2 降级为授权码流程说明，不允许它挤占自建账号主线。

## 下一步

D2 开始时先不改代码：

1. 定义 `POST /auth/register`、`POST /auth/login` 和一个受保护身份接口的契约。
2. 画清 route → controller → service → repository 的职责。
3. 在选择实现细节前，先解释密码哈希、salt 和密码比较。
4. 契约明确后，只实现注册竖切链路。

## 当前阻塞与风险

- W4 只剩 4 个有效学习日。
- 鉴权代码尚未开始。
- 本人当前自评：数据库相关的查询、模型与分层衔接还不够顺。D2 只在注册链路遇到具体问题时补对应知识，不另开数据库复习支线。
- `week2-express/src/match-index-explain.js` 已提交但不可运行（`db is not defined`），原因是混用了 mongosh 与 Node.js API。它属于 W3 收尾，不是 W4 启动任务。
- 已提交的 `week2-express/src/perf/` 实验不属于 W4 主线。
- 月度聚合仍有时区语义边界，但它是已记录的后续问题，不阻塞 W4。

## 验证基线

在 `week2-express/src/` 下运行：

```bash
npm test -- --runInBand
```

最近一次报告的基线：2 个测试套件、6 个测试通过。

## 恢复状态时需要读取的文件

1. `AGENTS.md`
2. `LEARNING-PROTOCOL.md`
3. `LEARNING-STATE.md`
4. `README.md`（W4 计划与验收目标）
5. `week4-auth/notes/week4-plan.md`
6. `week4-auth/notes/day1-week3-demo-month-boundary-fix.md`
7. `git status --short` 与当前任务相关 diff
8. 鉴权代码创建后，读取 `week2-express/src/` 下与当前步骤直接相关的文件

## AI 辅助记录

- W4 鉴权属黑名单，援助上限 **L2（原理讲解、设计提示、骨架、review）**，任何情况下不升 L3/L4（见 `AGENTS.md` 黑白名单）。
- AI 尚未提供任何 W4 鉴权核心实现。
- 当前有 2 条未还欠债：自然月报表边界；注册竖切的文件职责与依赖方向。均需在本周验收前完成第一档 15–20 分钟重建，详见 `DEBT.md`。
- 黑名单知识点给到 L2 即在 `DEBT.md` 记账，并在周验收前按重建梯子安排延迟重建；此处只保留当前欠债结论和指针。
