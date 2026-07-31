# Week 6 最终 Demo 讲稿 · 从业务结果到可信证据

> 目标时长：约 10 分钟
> 现场主线：真实 admin `200` → member `403` → 无 token `401` → 测试与 CI 证据 → W3 / W5 代表实验 → AI 协作边界与限制
> 定位：这是 W3–W6 的收尾 capstone，不重复逐周汇报全部知识点。前端是 AI 维护的白名单展示资产；后端核心链路、测试设计、实验判断与现场讲解由本人负责。

## 0. Demo 要证明什么

这次不以“页面能打开”作为终点，而要证明三件事：

```text
系统行为成立
→ 关键行为有自动化证据
→ 证据能在独立 CI 环境重复
```

开场白：

> “这个 demo 不按 MongoDB、JWT、Worker、Jest 逐项列技术。我先跑一条真实业务链：用户登录后访问 admin-only 聚合报表，分别看到 200、403 和 401；然后再说明为什么我相信这些结果不是只在本机碰巧跑通，以及哪些结论还不能外推到生产。”

收尾白：

> “这条链路从数据库聚合、身份边界、Node.js 响应性一直走到测试和 CI。对我来说，最终成果不是记住一组 API，而是能先定义契约和职责，再用受控实验与自动化测试给结论划边界；AI 可以讲解和 review，但核心实现与延迟重建仍由我完成。”

## 1. 演示前准备

### 1.1 数据与账号

提前确认数据库中存在：

- 一个已知凭据的 admin 账号，用于成功主线；
- 一个已知凭据的 member 账号，或现场注册一个新账号；
- 月度报表和客户消费报表所需订单数据。

账号密码不写进讲稿。演示前放在密码管理器或临时安全记录中。

### 1.2 启动后端

```bash
cd week2-express/src
node --env-file=.env server.js
```

确认：

- MongoDB 已启动；
- `.env` 中存在强度足够的 `JWT_SECRET`；
- `http://localhost:3000/` 返回 `200`。

### 1.3 启动前端

```bash
cd week8-fullstack/src/frontend
yarn dev
```

打开终端给出的地址，通常是：

```text
http://localhost:5173
```

开发环境使用 Vite proxy 将 `/auth`、`/reports` 和 `/users` 转发到后端 `3000`。浏览器 Network 仍显示 `5173`，这不代表请求没有到达 Express。

### 1.4 演示前工程检查

这些命令在演示前运行，不占现场 10 分钟：

```bash
cd week2-express/src
npm test -- --runInBand
npm run lint

cd ../../week8-fullstack/src/frontend
yarn typecheck
VITE_SHOWCASE_ONLY=1 yarn build --base=/skillup-week8/
```

当前基线：3 suites / 9 tests 通过，ESLint 0 errors，前端 typecheck 与生产构建通过。

### 1.5 浏览器准备

预先打开这些页面：

```text
管理后台：#/admin
全栈轨道：#/showcase?mode=demo&tab=testing&topic=fullstack
测试闭环：#/showcase?mode=demo&tab=testing&topic=testing
CI：      #/showcase?mode=demo&tab=testing&topic=ci
W3 索引： #/showcase?mode=demo&tab=database&topic=lookup-index
W5 Worker:#/showcase?mode=demo&tab=runtime&topic=worker
整体总结：#/showcase?mode=demo&tab=testing&topic=day4
```

使用匿名窗口或先登出，避免旧 `localStorage` token 污染第一步。

**现场纪律：全程保持「展示状态」，不要在屏幕上切到「复习状态」。**上面每个链接都显式带了
`mode=demo`。复习状态会展开个人学习记录，并多出一个「面试准备」专题——那是自用材料，
不适合出现在对外演示里。

## 2. 时间轴

| 时间 | 页面 / 动作 | 必须落下的结论 |
|---|---|---|
| 0:00–0:40 | 开场 | 业务行为 → 测试证据 → CI 可重复 |
| 0:40–3:10 | admin 登录并加载报表 | 完整成功终点是报表渲染，不是登录 `200` |
| 3:10–4:35 | member `403` + 无 token `401` | 认证与授权是两道不同的门 |
| 4:35–6:20 | 测试闭环 + CI | 正反路径保护行为，独立数据库保护可重复性 |
| 6:20–7:50 | W3 索引 + W5 Worker | 用受控实验区分事实、推断和未证明 |
| 7:50–9:10 | AI 边界 + 项目限制 | L2 记债与延迟重建；不冒充生产就绪 |
| 9:10–10:00 | 收尾 | 契约、职责、证据、限制 |

## 3. 0:00–0:40 · 开场

停在管理后台登录页。

讲稿：

> “我先展示系统对用户真正交付的结果。注册只创建默认 member，不签 token；登录成功后才签发 JWT，业务自定义 payload 只放 `sub`、不放 role；真正的权限决定发生在后续报表请求中。接下来我会让同一个 admin-only 资源分别返回 200、403 和 401。”

## 4. 0:40–3:10 · admin 成功主链

### 页面操作

1. 使用 admin 凭据登录。
2. 等待 KPI、月度趋势和客户消费 Top 图表出现。
3. 打开 Network，指出登录与两个报表请求。
4. 若开发模式出现两批报表请求，只用一句解释 React `StrictMode`，不要展开前端专题。

### 讲稿

> “登录 `200` 只证明凭据验证和 token 签发成功，不是完整业务终点。Dashboard 挂载后并发请求月度趋势和客户消费报表；两个请求都携带 Bearer token，经过认证、查库授权、参数校验、Controller、Service 和 Repository，最终由 MongoDB 执行聚合并返回结果。”

> “JWT 的业务自定义 payload 只放 `sub`，不放 role；签名库另生成 `iat` 和 `exp`。`validateToken` 负责确认‘你是谁’，`requireRole('admin')` 再用 `sub` 查询数据库当前角色，负责判断‘你现在能不能做这件事’。每次多一次角色查询是成本，换来角色变更在下一次请求立即生效。”

指向月度图表：

> “后端聚合只返回有订单的稀疏月份。Repository 得到的是普通 JavaScript 对象数组，不是 Mongoose document；Service 把 Decimal128 金额转成 Number；前端 `fillMonths()` 才补齐连续月份用于图表。数据库执行、DTO 转换和视图补齐属于三个不同边界。”

观察点：

```text
POST /auth/login → 200
GET /reports/monthly-sales → 200
GET /reports/customer-spending → 200
页面渲染 KPI 与两类报表
```

开发模式提示：React `StrictMode` 可能让两个报表请求各重复一次；生产构建不因该检查重复 effect。

## 5. 3:10–4:35 · 两条停止路径

### 5.1 member → 403

页面操作：

1. 登出 admin。
2. 使用 member 登录；若没有现成账号，先注册再登录。
3. 指出页面进入 `forbidden`，报表不显示。

讲稿：

> “member 登录本身仍然是 `200`，说明身份认证成功。随后报表请求的 token 也能通过 `validateToken`，但 `requireRole` 查到当前角色不是 admin，于是请求在 Controller 之前停止并返回 `403`。登录响应和 JWT 都不携带 role，角色来自本次数据库查询。”

### 5.2 无 token → 401

页面操作：

1. 保持 member 的 `forbidden` 页面。
2. 在鉴权演示面板点击“不带 token 请求报表”。
3. 指出 probe 日志为 `401`，主页面仍保持 `forbidden`。

讲稿：

> “这个 probe 不携带 token，所以请求停在 `validateToken`，`requireRole`、参数校验、Controller 和聚合都不会执行。它只更新演示面板自己的日志，不改变 Dashboard 的主状态。”

三条路径收束：

```text
无 token → validateToken → 401
member token → requireRole → 403
admin token → Controller / Service / Repository / MongoDB → 200
```

## 6. 4:35–6:20 · 为什么相信这条链

切到：

```text
#/showcase?mode=demo&tab=testing&topic=testing
```

### 6.1 测试覆盖

讲稿：

> “原有月报集成测试直接签发 token，能保护 RBAC admin 分支和聚合数值，但绕过了真实登录。W6 没有删除它，而是在旁边新增认证流测试：已有 admin 真实登录后访问报表得到 200；新用户从注册、登录到访问同一报表得到 403。”

> “admin 200 不能单独证明授权正确，因为一个错误的‘所有登录用户都放行’实现也会通过。member 403 是必要反例。反过来，认证流测试不重新断言聚合数值，数值正确性仍由原报表测试负责。”

切到：

```text
#/showcase?mode=demo&tab=testing&topic=ci
```

### 6.2 CI 可重复性

讲稿：

> “本地绿只证明当前电脑可以运行。CI 的 test job 自己启动 `mongo:7`，通过 `MONGODB_URI` 显式连接；两个 suite 共享 MongoDB 进程，但分别独占 `skillup_test_a` 和 `skillup_test_b`，所以集合、文档和唯一索引命名空间互不污染。”

> “fixture 前等待相关 `Model.init()`，避免测试结束清库后迟到的索引初始化又创建集合。teardown 先删除独占库并断开 Mongoose；job 结束后容器和 runner 一起销毁。远端 CI #257 已成功，外部分支连续 5 轮无残留。”

必须落下：

```text
测试回答：行为可信吗？
CI 回答：这份证据能脱离本机重复吗？
```

## 7. 6:20–7:50 · 两个受控实验

### 7.1 W3：索引证据

切到：

```text
#/showcase?mode=demo&tab=database&topic=lookup-index
```

讲稿：

> “查询优化不能只说‘加索引应该更快’。我对同一条 `$lookup` 关联 `users.name` 做前后对照：无索引时 `collectionScans` 是 3、`indexesUsed` 为空、扫描 15 个文档；建立 `name_1` 后变成 0、`[name_1]` 和 0。查询与数据集不变，新增索引是唯一变量。”

> “这支持当前查询的工作量下降，不证明所有 lookup 都需要这个索引，也不把 12ms 到 3ms 外推成生产性能。这个 name 关联是实验，结束后已清理；正式报表仍关联自带索引的 `_id`。”

### 7.2 W5：Worker 边界

切到：

```text
#/showcase?mode=demo&tab=runtime&topic=worker
```

讲稿：

> “同一个 `fib(40)` 在主线程执行时约 1111ms，heartbeat 最大间隔从约 102ms 升到 1154ms，并发 ping 被拖延；放进 Worker 后，计算约 1124ms，但 heartbeat 和 ping 回到基线附近。”

> “因此这个实验支持 Worker 保护主线程响应性。本次单任务实验没有显示计算加速，也不能给出生产环境最优 Worker 数量。378ms 的 ping 是计算开始后才发出的部分等待，不是完整阻塞时长。”

## 8. 7:50–9:10 · AI 边界与项目限制

### 8.1 AI 协作边界

讲稿：

> “AI 不是核心代码代写者。以自然月边界为例，AI 给过 L2 定向提示，所以当天记入 `DEBT.md`；Service、Repository、测试数据和断言由我修改。第一档重建在 7 月 16 日通过，7 月 27 日我又在没有 AI 补充提示时，独立把需求改成‘本月及前两个月’，推导出半开区间、跨年和月末测试影响。”

> “代码由我提交本身不能证明能力归属；延迟后仍能复述数据流、修改需求并预测影响层，才是证据。”

### 8.2 当前限制

讲稿：

> “当前 demo 使用 Vite proxy 保持浏览器同源，生产部署拓扑还没有验证。若前后端分属不同 Origin，需要配置并实测 CORS allowlist、preflight 和实际请求；若通过反向代理保持同源，则不需要 CORS。”

> “除此之外，Login timing、两种错误响应形状、异常 teardown、真实 OAuth2 和生产吞吐都仍是明确限制。所以我只声称关键链路在本地和 CI 中有证据，不声称系统已经生产就绪。”

## 9. 9:10–10:00 · 收尾

切到整体总结页：

```text
#/showcase?mode=demo&tab=testing&topic=day4
```

用它的第一屏收尾——四个维度（契约 / 职责 / 证据 / 限制）就是下面这段收尾白的顺序，
说到哪一维指哪一张卡，不用再口头复述结构。这是换画面，不是加内容，不占额外时间。

收尾白：

> “今天看到的不是四周技术名词拼盘，而是一条工程链。MongoDB 聚合提供业务结果；JWT 和数据库角色建立身份与权限边界；Node.js 实验帮助判断主线程响应性；集成测试保护成功和拒绝路径；CI 再让证据脱离本机重复。”

> “我保留的工作顺序是：先定义契约，再分清职责，然后用测试或受控实验验证，最后明确没有证明什么。AI 在这条流程里负责讲解、review 和记录，但黑名单核心实现与延迟重建仍由我完成。”

## 10. 现场追问锚点

### 为什么 JWT 不放 role？

JWT 中的 role 会成为过期前不可变的权限快照。当前系统的业务自定义 payload 只放 `sub`、不放 role（库另生成 `iat` / `exp`），每次受保护请求查询数据库当前角色，以一次数据库查询换取权限变更即时生效。

### 为什么 admin `200` 还要 member `403`？

只测成功路径排除不了“授权中间件无条件放行”的错误。正反路径同时通过，才能证明 admin 被放行且非 admin 被拒绝。

### 为什么 `totalDocsExamined: 0` 仍能返回关联结果？

这是当前 `$lookup` explain 阶段记录的文档扫描口径；同时 `indexesUsed` 出现 `name_1`、`collectionScans` 降为 0，说明关联通过索引而不是集合扫描完成。不要把单个字段脱离同一份 explain 解读。

### Worker 与 libuv threadpool 是一回事吗？

不是。Worker Thread 是显式创建的独立 JavaScript 执行线程；libuv threadpool 是 Node 为部分 `fs / crypto / dns / zlib` 等 API 使用的有限 native worker 资源。普通网络 I/O 也不默认占用 threadpool。

### 为什么测试全绿还要看资源残留？

断言全绿只证明测试观察到的行为成立，不证明异步模型初始化和数据库资源已经结束。曾出现测试全绿但空集合与索引残留，等待 `Model.init()` 后才连续 5 轮清理干净。

### CORS 能代替认证吗？

不能。CORS 是浏览器的跨 Origin 响应访问规则，挡不住 curl、Postman 或服务端客户端；认证和授权仍由 JWT 与服务端规则负责。

## 11. 超时与故障策略

- 只剩 8 分钟：**不再切 W3 / W5 两个专题页，改用整体总结页的「三组受控实验」一屏讲完**
  （`topic=day4`，切换 W3 / W5 / W6 三组只需点按钮，省掉两次跨 tab 切页）；每组只讲一组指标和一句限制；
  AI 边界只讲自然月债务。
- 只剩 6 分钟：保留 admin `200`、member `403`、无 token `401`、测试正反路径和 CI 数据库隔离；W3 / W5 改为收尾一句。
- admin 数据为空：仍展示 `200` 与空数组契约，但明确这不能证明聚合数值；随后切到测试闭环的数值断言证据。
- Network 出现重复报表请求：说明 React 开发模式 `StrictMode`，不要现场改代码。
- 后端或数据库临时失败：不现场修复；切到全栈轨道与 Day 3 已记录的真实浏览器证据，明确这是降级展示，不冒充本次实时成功。
- 展板动画异常：使用单步按钮；仍异常时指向旁边的静态事实、证明范围和未证明范围。
- 账号状态不确定：现场注册只用于 member `403`；admin 账号必须在演示前预验，避免现场直接改生产式权限数据。

## 12. 彩排验收

彩排后记录：

- 实际时长；
- 三条实时状态路径是否都出现；
- 是否准确说出“新增认证流测试”，没有误说成替换原报表测试；
- 是否准确说出“本次单任务实验未显示加速”；
- 是否把 W3 原始指标与未完成的大数据耗时量化区分开；
- 是否在结尾主动说明生产部署和 CORS 是条件性限制；
- 是否全程停在展示状态，没有在屏幕上切到复习状态；
- 是否有任何一步依赖临场查笔记才能继续。

通过条件：10 分钟左右完成，业务链不断，事实与推断不混淆，至少主动说出一个未证明边界。

### 2026-07-31 彩排记录

本人确认最终 demo 彩排已完成。实际时长与上述逐项检查结果未提供，因此不把这些未知项补写为已验证；项目收口事实与最终工程基线见 [`day5-final-demo-rehearsal-and-closeout.md`](./day5-final-demo-rehearsal-and-closeout.md)。
