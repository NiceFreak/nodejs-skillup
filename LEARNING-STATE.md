# 当前学习状态

> 最后更新：2026-07-15（Asia/Shanghai）

## 当前进度

- 当前周：**W4 · 认证与鉴权**
- 当前 Day：**D3 JWT 专注日；签发首版已完成，正在 review 修正**
- 本周硬截止时间：**2026-07-17（周五）**
- 应用代码目录：`week2-express/src/`
- 本周笔记目录：`week4-auth/notes/`

## 最近完成

- 完成 JWT 签发契约推导并整理 `week4-auth/notes/day3.md`：payload 只放 `sub`、有效期 1 小时、secret 来自环境变量、Login 成功响应迁移为 v2。
- JWT 签发首版已写入 `authService.login`；review 已定位配置校验职责和响应契约尚未闭环，等待本人修正后验收。
- 全部 API 报错文案统一为中文（仅字符串字面量，错误映射逻辑未动）；Postman 两份资产的 401/400 文案断言已同步。响应格式仍有 `{ error }` 与 `{ code, message }` 两种并存，见 `errors/userErrors.js` 的 TODO。
- 按实际进度校准 `week4-plan.md`：D3 减负为 JWT 专注日；两个第一档重建单元分插 D3/D4；Login 计时枚举评估排入 D4；D5 增加还债确认。
- D2 笔记已整理为 `week4-auth/notes/day2-password-hash-register-login.md`（原 `d2.md` 已合并进该文件并删除）。
- Postman 新增「七、Auth 登录」文件夹：正确凭据 200、统一 401 三种路径、历史无 hash 用户 seed/清理、无请求体 400；YAML 目录与 JSON 导出已同步（白名单 API 展示资产，AI 维护）。
- 提前完成 D3 的 Login 凭据验证阶段：按 email 显式取回 hash、bcrypt compare、统一 401、历史无 hash 用户拒绝、HTTP 路由接线。
- 真实验证 Login：正确凭据 200；错误密码、不存在邮箱、历史无 hash 均为相同 401；无请求体 400。
- 完成 `POST /auth/register`：密码策略、bcrypt hash、Repository 复用、安全响应和历史用户兼容。
- 真实验证注册 201、缺失/弱密码 400、重复邮箱 409；数据库无明文，应用普通查询不返回 `passwordHash`。
- 将 `controller/` 统一重命名为 `controllers/`，所有引用已同步；现有 2 个测试套件、6 个测试继续通过。
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

继续 D3 的 JWT 阶段，先定义再实现：

1. 修正 JWT 签发首版：配置校验离开数据库连接、删除重复职责、补齐错误类引用和 Login v2 Controller 响应。
2. 验证正确登录返回可解码 token，`sub`、`iat/exp` 与用户摘要符合契约；错误密码仍维持统一 401。
3. 再单独设计 JWT 验证中间件和一个受保护接口，不与签发阶段混写。

## 当前阻塞与风险

- W4 剩余 D3–D5 三个有效学习日。
- Login 凭据验证已提前完成，D3 已减负为 JWT 专注日（签发 + 中间件 + 受保护接口）；当天仍必须至少保护一个真实接口。
- 两条欠债的第一档重建已排期：D3 做自然月边界，D4 做注册调用链，不留到周五挤兑。
- Login 不存在用户与错误密码虽统一为 401，但本地耗时约 2ms vs 314ms，存在计时枚举风险；留 D4 Web 安全阶段评估，不阻塞 JWT 主线。
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
6. `week4-auth/notes/day2-password-hash-register-login.md`（最近一篇日记）
7. `git status --short` 与当前任务相关 diff
8. 鉴权代码创建后，读取 `week2-express/src/` 下与当前步骤直接相关的文件

## AI 辅助记录

- W4 鉴权属黑名单，援助上限 **L2（原理讲解、设计提示、骨架、review）**，任何情况下不升 L3/L4（见 `AGENTS.md` 黑白名单）。
- AI 尚未提供任何 W4 鉴权核心实现。
- 当前有 3 条未还欠债：自然月报表边界；注册竖切的文件职责与依赖方向；JWT 签发链路的配置校验与分层边界。均需在本周验收前完成第一档重建，详见 `DEBT.md`。
- 黑名单知识点给到 L2 即在 `DEBT.md` 记账，并在周验收前按重建梯子安排延迟重建；此处只保留当前欠债结论和指针。
