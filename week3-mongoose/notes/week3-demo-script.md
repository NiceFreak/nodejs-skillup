# Week 3 Demo 讲解脚本（周一展示版）· 聚合报表 + 查询优化 + 集成测试

> 用途:现场演示,半脱稿用。每步列了做什么操作、讲哪几个关键词,照着关键词说清楚即可,不用背台词。
> 本周代码建在 Week 2 的应用上,目录仍是 `week2-express/src/`,新增 `/reports` 路由、聚合、测试。
> 总时长 12–15 分钟。API 调用用 Postman 或 curl。
> 展示口径：先讲已经验收的主线，再讲证据；backlog 只在被问到时说明边界和后续验证方式，不主动把汇报讲成待办清单。

---

## 0. 开场前检查清单(提前 5 分钟做完)

- [ ] MongoDB 启动了,Compass 连上,`orders` / `users` 两个集合可见
- [ ] `.env` 里 `MONGODB_URI` 配对了
- [ ] 在 `week2-express/src/` 跑一次 `npm run seed`，依次生成用户和订单
- [ ] 确认当前生成规则输出 **2000 个用户 / 4992 笔订单**（固定随机种子下可复现；若生成规则调整，以终端实际输出为准）
- [ ] 确认输出里能看到买家/零单用户、复购长尾、客单价、状态占比和近 12 个月走势
- [ ] `npm run dev` 起来(入口是 `server.js`),终端打出启动日志、没报错
- [ ] 提前空跑一遍两个报表接口,确认有数据返回(不是 `[]`)
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

**指着返回的 JSON 说:**
- 每条是 `{ year, month, orderCount, totalSpending, avgOrderValue }`
- **按月份从早到晚**排列,每月一条

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
> "断言**测逻辑不变量,不测偶然值**。测试数据用'相对现在'的日期,月份会随运行时间漂移,所以不断言'月份正好是几',而断言'有 N 个分组''那个 2 单的月份总额=1221''completed 共 6 单'——这些换个时间/机器跑都该成立。"

**终端应显示:** 两个 test 文件、所有用例 **PASS**。

---

## 7. 设计取舍 Q&A 预案

**Q:为什么 `$lookup` 放在 `$group` 之后?**
> "为了减少参与关联的文档数。`$match` 先筛出目标订单，`$group` 再把多笔订单收敛成客户维度，让 `$lookup` 只处理分组后的客户记录。注意这是**管道阶段顺序**的优化，不是 ESR——ESR 是复合索引字段排列的原则，两回事。"

**Q:月度报表的时间边界怎么算的?为什么不用 `Date.now() - months*一天`?**
> "那样单位错了——`months * 一天的毫秒` 算出来是'几天前'不是'几个月前'。改用 `setMonth(getMonth() - months)` 按自然月算。而且 `setMonth` 要单独一行、用变量本身,它的返回值是时间戳不是 Date。"

**Q:populate 和 `$lookup` 怎么选?**
> "只是'取出引用的文档'用 populate,更简洁;'关联 + 聚合统计一起做'用 `$lookup`,这个报表正是后者。populate 背后是多次查询 + `$in` 去重,要小心 N+1。"

**Q:测试为什么用内存数据库,不用开发库?**
> "测试会增删数据,连开发库会污染数据。内存库完全隔离、测完自动销毁,而且 CI 环境没有本地 MongoDB,内存库自带,为 W6 的 CI 铺路。"

**Q:集成测试和单元测试有什么本质区别?**
> "单元测试测纯函数、输入输出确定、不碰外部依赖;集成测试测整条链路 + 真实数据库,要管数据库的起停和数据准备(生命周期钩子),验证的是'各层拼起来能不能真的跑通'。"

**Q:周三留下的 backlog 是不是说明本周没有做完?**
> "不是。本周验收目标是聚合场景、关联查询、explain 优化证据，以及能独立重建一个聚合 demo，这几项已经全部完成。周三记录的是主线完成后暴露出的增强项，其中关联无索引字段的对照实验已在周五补完；剩余的 `$lookup` 子管道、customer-spending 集成测试和 DTO 收敛，不影响当前接口正确性，分别属于性能细化、测试扩面和规模化重构。"

**Q:为什么没有顺手把所有 backlog 都清掉?**
> "我按验收目标和收益排序。当前先保留可运行、可解释、可测试的最小闭环；例如只有两个报表时就引入 DTO，维护成本可能高于收益。后续会先用 explain 或重复度证明问题，再决定是否重构。"

---

## 8. 收尾

**说:** "这周交付了 2 个聚合报表（含关联查询）、两组查询优化的对照证据，以及单元和集成测试。月度报表是我脱离引导从空白设计的，达成了'能从空白重建聚合'的判据。更重要的是，我现在不只是能把查询跑通，还能用执行计划解释它为什么这样执行、索引为什么有效。"

---

## 9. 自信表达提醒（不上屏）

- 用“**我完成了 / 我验证了 / 数据说明了**”，少用“我尝试了 / 应该是 / 大概”。
- 先报结论，再给证据：`结论 → 指标 → 原理`，不要从踩坑过程讲起。
- backlog 不道歉，讲清三点即可：**不影响本周验收、当前不做的理由、后续用什么证据决定是否做**。
- 不把“自信”建立在夸大上。量化脚本尚未完成时，只讲已有 explain 指标，不宣称已有稳定耗时提升比例。

---

## 附：两个报表端点速查表

```
GET /reports/customer-spending?status=completed&days=30
    → $match→$group→$lookup→$unwind→$project→$sort
    → 每客户:orderCount / totalSpending / avgOrderValue + customerName/Email,按总额降序

GET /reports/monthly-sales?status=completed&months=6
    → $match→$group→$sort→$project
    → 每月:year / month / orderCount / totalSpending / avgOrderValue,按月份升序

参数校验:days/months 走 validatePositiveInt(默认 30/6);status 走 validateStatusParam
```
