# Week 3 Demo 讲解脚本（周一展示版）· 聚合报表 + 查询优化 + 集成测试

> 用途:现场演示,半脱稿用。每步列了做什么操作、讲哪几个关键词,照着关键词说清楚即可,不用背台词。
> 本周代码建在 Week 2 的应用上,目录仍是 `week2-express/src/`,新增 `/reports` 路由、聚合、测试。
> 总时长 12–15 分钟。API 调用用 Postman 或 curl。
> 展示口径：先讲已经验收的主线，再讲对应证据。

---

## 0. 开场前检查清单(提前 5 分钟做完)

- [ ] MongoDB 启动了,Compass 连上,`orders` / `users` 两个集合可见
- [ ] `.env` 里 `MONGODB_URI` 配对了
- [ ] 在 `week2-express/src/` 跑一次 `npm run seed`，依次生成用户和订单
- [ ] 确认当前生成规则输出 **2000 个用户 / 4992 笔订单**（固定随机种子下可复现；若生成规则调整，以终端实际输出为准）
- [ ] 确认输出里能看到买家/零单用户、复购长尾、客单价、状态占比和近 12 个月走势
- [ ] `npm run dev` 起来(入口是 `server.js`),终端打出启动日志、没报错
- [ ] 提前空跑一遍两个报表接口,确认有数据返回(不是 `[]`)
- [ ] 确认 `monthly-sales?months=6` 返回 **2026 年 2–7 月，共 6 条月度汇总**
- [ ] 另开一个终端,给最后 `npm test` 那步用

---

## 1. 开场

**说:** "这周在 Week 2 的 User/Order 接口基础上，完成了两个**聚合报表接口**，用 **explain + 对照实验**验证了 `$match` 和 `$lookup` 的索引效果，还从零搭了一套**集成测试**。周五我又把演示数据从 14 条样例升级到 2000 个用户、4992 笔订单的可复现电商数据。下面先过架构，再看报表输出、查询优化证据，最后跑测试。"

---

## 2. 架构增量(2 分钟,指着目录讲)

**做什么:** 打开 `week2-express/src/`,只讲本周**新增/改动**的部分:

```
src/
├── app.js                              # 只定义 app + 导出(不再自己启动)   ← 本周拆分
├── server.js                           # connectDB + listen + 优雅关闭,dev 入口 ← 本周新增
├── routes/reports.js                   # /reports/customer-spending、/reports/monthly-sales
├── controller/users.js                 # 两个 report controller
├── services/orderService.js            # 业务:算时间边界 + Decimal128 转换
├── repositories/users.js               # 两条聚合管道
├── middlewares/
│   ├── validateDaysParamMiddleware.js  # 复用 validatePositiveInt(_, 30)
│   ├── validateMonthsParamMiddleware.js# 复用 validatePositiveInt(_, 6)   ← 本周新增
│   └── validateStatusParamsMiddleware.js
├── utils/validators.js                 # validatePositiveInt(value, default) ← 本周抽象
├── seedUsers.js                        # 2000 用户：年龄/地区/地址按分布生成
├── seedOrders.js                       # 4992 订单：复购长尾、爆款、大促、状态时效
└── __tests__/monthly-sales.test.js     # 集成测试                         ← 本周新增
    utils/__tests__/validators.test.js  # 单元测试
```

**讲三件事:**

**① app / server 分离 —— `应用定义` `应用启动`**
> "原来 app.js 一被 import 就启动服务器、连数据库。这周拆开了:app.js 只定义并导出 app,启动逻辑挪到 server.js。这样集成测试能 import 干净的 app、交给 Supertest,不会连到真实数据库。这是 Express 的最佳实践。"

**② 聚合分两层 —— `管道代码在 repository` `业务意图在 service`**
> "一条聚合管道其实是两件事:'怎么查数据库'的管道代码放 repository;'要一份怎样的报表'——查几个月、什么状态——是业务意图,放 service。service 算好时间边界、把参数传给 repository。"

**③ 校验复用 —— `validatePositiveInt(值, 默认值)`**
> "days 和 months 的校验逻辑一样:正整数、缺省给默认。把'变化的默认值'提成参数,抽出一个通用函数;两个中间件各自取不同 query 字段、传不同默认值(30 / 6),底层共用这一个校验函数。"

**④ 演示数据升级 —— `可复现` `有业务分布` `能支撑性能观察`**
> "旧数据只有 14 条，适合验证管道正确性，但不适合观察查询行为。现在用固定随机种子生成 2000 个用户和 4992 笔订单，不只是把数量放大：还模拟了零单用户、幂律复购、爆款长尾、618/双11峰值和订单状态随时间变化。这样报表结果有业务形态，explain 的扫描差异也更有解释力。"

---

## 3. 报表一:客户消费(带关联)· `$lookup`(3 分钟)

**做什么:** 请求

```
GET /reports/customer-spending?status=completed&days=30
```

**关键词:** **`$group` 分组统计** · **`$lookup` 关联客户名** · **`totalSpending` 降序** · **Decimal128 → number**

**讲什么:**
> "管道是 `$match → $group → $lookup → $unwind → $project → $sort`。先按 status/时间筛,按 `userId` 分组算出每个客户的订单数、总额、均单;再用 `$lookup` 关联 users 集合,把**客户名和邮箱**带进报表;最后按总额降序排。"

**指着返回的 JSON 说:**
- 每条有 `customerName` / `customerEmail` —— **这是 `$lookup` 关联来的**,订单集合本身只有 `userId`
- `totalSpending` / `avgOrderValue` 是**普通 number**,不是 `{ $numberDecimal }` —— **service 出口做了 Decimal128 转换**
- 结果按 `totalSpending` 从高到低

---

## 4. 报表二:月度趋势(独立设计)· `$year`/`$month`(3 分钟)

**做什么:** 请求

```
GET /reports/monthly-sales?status=completed&months=6
```

**关键词:** **按派生键分组** · **`$year` + `$month`** · **跨年正确性** · **`$sort` 先于 `$project`**

**讲什么(重点展示,这是脱离 AI 独立设计的):**
> "这个报表订单里**没有'月份'字段,只有 `createdAt`**。核心难点是从日期提取'年-月'作分组键。用日期运算符 `$year`/`$month` 构造 `_id`,而且**年和月要一起分组**——只用月份的话,2025年6月和2026年6月会被错误合并。"

**再点一个顺序细节:**
> "`$sort` 要放在 `$project` **前面**。因为 `$project` 里 `_id: 0` 会把 `_id` 排除掉,如果先投影再排序,`$sort` 按一个已经不存在的字段排,静默失效。所以趁 `_id` 还在,先排序再投影。"

**解释 `months=6` 的边界:**
> "这里把 `months=6` 定义为**包含当前月在内的最近 6 个自然月**。当前查询范围是 2026 年 2 月 1 日到 8 月 1 日，使用 `$gte` / `$lt` 半开区间，所以结果正好是 2 月到 7 月。service 负责计算业务时间边界，repository 负责把边界放进 `$match`。"

**指着返回的 JSON 说:**
- 每条是 `{ year, month, orderCount, totalSpending, avgOrderValue }`
- 结果是 **6 条月度汇总，不是 6 笔订单**；例如 6 月这一条汇总了 **896 笔 completed 订单**
- **按月份从早到晚**排列，每月一条

---

## 5. 查询优化：两组 explain 证据（2–3 分钟）

**做什么:** 优先展示笔记里已经记录的两组对照；现场环境稳定时，再在 Compass 或 mongosh 里跑同一条件的 `explain("executionStats")`。

**关键词:** **`COLLSCAN → IXSCAN`** · **复合索引 `{status, createdAt}`** · **ESR 顺序** · **`$lookup` 的 foreignField 索引**

**第一组：`$match` 优化**
> "报表先按 status + createdAt 筛。没有合适索引时是 COLLSCAN；建立 `{status: 1, createdAt: 1}` 复合索引后变成 IXSCAN。字段顺序符合 ESR：等值条件 status 在前，范围条件 createdAt 在后。这里不只看毫秒数，更看执行计划和 `totalDocsExamined`，因为单次耗时会受机器状态影响。"

**第二组：`$lookup` 优化**
> "我又做了一组关联对照。正式报表关联 user 的 `_id`，它自带索引；为了验证 foreignField 索引的影响，我临时改成关联无索引的 `name`。建索引前 `collectionScans: 3`、`indexesUsed: []`；给 name 建索引后变成 `collectionScans: 0`、`indexesUsed: [\"name_1\"]`。实验结束后删除临时索引和实验管道，不污染正式代码。"

**这一段的收口句：**
> "两组实验验证的是同一条原则：`$match` 要让筛选字段有合适索引，`$lookup` 要确认 foreignField 有索引；优化结论来自执行计划的前后对照，不是只凭一次耗时猜测。"

---

## 6. 测试:单元 + 集成全绿(2 分钟,终端操作)

**做什么:** 切到另一个终端,在 `week2-express/src/` 下:

```bash
npm test
```

**关键词:** **单元测试** · **集成测试** · **内存库** · **断言不变量**

**讲什么:**
> "两类测试。单元测试测 `validateStatus`/`validatePositiveInt` 这种纯函数,不碰数据库。集成测试测 `GET /reports/monthly-sales` 的**整条链路**——用 mongodb-memory-server 在内存里起一个真 MongoDB,`beforeEach` 塞已知数据,Supertest 发请求,断言走完 route→controller→service→repository→库的真实返回。"

**点一个测试设计的关键(这是本周思维亮点):**
> "断言**测逻辑不变量，不测偶然值**。测试数据用相对现在的日期，月份会随运行时间漂移，所以不断言月份正好是几，而是断言 `months=6` 返回 **6 个自然月分组**、那个 2 单的月份总额是 1221、completed 共 7 单。测试数据还放了两笔恰好在范围外的订单，能验证旧的第 7 个月不会被算进来。"

**终端应显示:** 两个 test 文件、所有用例 **PASS**。

---

## 7. 设计取舍 Q&A 预案

**Q:为什么 `$lookup` 放在 `$group` 之后?**
> "为了减少参与关联的文档数。`$match` 先筛出目标订单，`$group` 再把多笔订单收敛成客户维度，让 `$lookup` 只处理分组后的客户记录。注意这是**管道阶段顺序**的优化，不是 ESR——ESR 是复合索引字段排列的原则，两回事。"

**Q:月度报表的时间边界怎么算的?为什么不用 `Date.now() - months*一天`?**
> "那样单位错了——`months * 一天的毫秒` 算出来是'几天前'，不是'几个月前'。我先把基准归一到本月 1 日，起点向前移动 `months - 1` 个月，终点取下月 1 日，再用 `$gte` / `$lt` 查询。这样 `months=6` 恰好表示 6 个自然月份，不会因为从今天直接减 6 个月而跨出 7 个月份。"

**Q:populate 和 `$lookup` 怎么选?**
> "只是'取出引用的文档'用 populate,更简洁;'关联 + 聚合统计一起做'用 `$lookup`,这个报表正是后者。populate 背后是多次查询 + `$in` 去重,要小心 N+1。"

**Q:测试为什么用内存数据库,不用开发库?**
> "测试会增删数据,连开发库会污染数据。内存库完全隔离、测完自动销毁,而且 CI 环境没有本地 MongoDB,内存库自带,为 W6 的 CI 铺路。"

**Q:集成测试和单元测试有什么本质区别?**
> "单元测试测纯函数、输入输出确定、不碰外部依赖;集成测试测整条链路 + 真实数据库,要管数据库的起停和数据准备(生命周期钩子),验证的是'各层拼起来能不能真的跑通'。"

---

## 8. 收尾

**说:** "这周交付了 2 个聚合报表（含关联查询）、两组查询优化的对照证据，以及单元和集成测试。月度报表是我脱离引导从空白设计的，达成了'能从空白重建聚合'的判据。更重要的是，我现在不只是能把查询跑通，还能用执行计划解释它为什么这样执行、索引为什么有效。"

---

## 9. 自信表达提醒（不上屏）

- 用“**我完成了 / 我验证了 / 数据说明了**”，少用“我尝试了 / 应该是 / 大概”。
- 先报结论，再给证据：`结论 → 指标 → 原理`，不要从踩坑过程讲起。
- 查询优化只讲已经取得的 explain 指标，不延伸到未经验证的耗时比例。

---

## 附：两个报表端点速查表

```
GET /reports/customer-spending?status=completed&days=30
    → $match→$group→$lookup→$unwind→$project→$sort
    → 每客户:orderCount / totalSpending / avgOrderValue + customerName/Email,按总额降序

GET /reports/monthly-sales?status=completed&months=6
    → $match→$group→$sort→$project
    → 包含当前月的最近 6 个自然月，时间范围使用 [$gte startDate, $lt endDate)
    → 每月:year / month / orderCount / totalSpending / avgOrderValue,按月份升序

参数校验:days/months 走 validatePositiveInt(默认 30/6);status 走 validateStatusParam
```
