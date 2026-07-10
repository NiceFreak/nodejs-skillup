# Week 3 Demo 讲解脚本 · 聚合报表 + 查询优化 + 集成测试

> 用途:现场演示,半脱稿用。每步列了做什么操作、讲哪几个关键词,照着关键词说清楚即可,不用背台词。
> 本周代码建在 Week 2 的应用上,目录仍是 `week2-express/src/`,新增 `/reports` 路由、聚合、测试。
> 总时长 12–15 分钟。API 调用用 Postman 或 curl。

---

## 0. 开场前检查清单(提前 5 分钟做完)

- [ ] MongoDB 启动了,Compass 连上,`orders` / `users` 两个集合可见
- [ ] `.env` 里 `MONGODB_URI` 配对了
- [ ] 跑一次 `node --env-file=.env seed.js` 灌入种子数据(14 条订单,跨月份、跨 status)
- [ ] `npm run dev` 起来(入口是 `server.js`),终端打出启动日志、没报错
- [ ] 提前空跑一遍两个报表接口,确认有数据返回(不是 `[]`)
- [ ] 另开一个终端,给最后 `npm test` 那步用

---

## 1. 开场

**说:** "这周在 Week 2 的 User/Order 接口基础上,加了两个**聚合报表接口**,做了**索引 + explain 的查询优化**,还从零搭了一套**集成测试**。下面先过架构,再跑两个报表看真实输出,然后看查询优化的前后对比,最后跑测试。"

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
├── seed.js                             # 种子数据
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

## 5. 查询优化:explain 前后对比(2 分钟,可选深浅)

**做什么:** 在 Compass 或 mongosh 里,对同一个 `$match` 条件跑 `explain`,展示**建索引前后**的差异(对应 Day 1 的优化)。

**关键词:** **`COLLSCAN → IXSCAN`** · **复合索引 `{status, createdAt}`** · **ESR 顺序** · **`totalDocsExamined` 下降**

**讲什么:**
> "报表的 `$match` 按 status + createdAt 筛。没索引时是全集合扫描 COLLSCAN,扫描文档数等于全表。建了复合索引 `{status: 1, createdAt: 1}` 之后变成 IXSCAN,`totalDocsExamined` 明显下降。字段顺序按 ESR——等值的 status 在前、范围的 createdAt 在后。"

> 💡 若现场数据量小、explain 差异不直观,这段可只讲结论 + 展示 Day 1 笔记里记录的前后数字,不必现场跑。

---

## 6. 测试:单元 + 集成(4 分钟,本周硬核成果)

> 本周写了**两个测试**:一个单元测试(`validateStatus`)、一个集成测试(`monthly-sales` 全链路)。两个都是实打实的产出,尤其集成测试是从零搭起来的。展示时**先打开文件讲"测什么、怎么保证可靠",再一起跑绿**,别只敲个命令看结果。

### 6.1 单元测试 · `validateStatus`(纯函数)

**做什么:** 打开 `utils/__tests__/validators.test.js`,指着里面几个用例讲。

**关键词:** 合法归一化 · 非法拒绝 · 缺省补默认 · 大写归一化 · **可执行文档**

> "这个单元测试用几个用例覆盖了 `validateStatus` 的**完整契约**,相当于**可执行文档**:合法值归一化(`COMPLETED` → `completed`)、非法值拒绝返回 null、缺省补默认 `completed`。每次改动都自动验证。它是纯函数,不碰数据库,输入输出确定。"

> 💡 可提一句:`validatePositiveInt`(days/months 共用的那个)目前还没单独测试,是随手可补的下一个单元测试。

### 6.2 集成测试 · `GET /reports/monthly-sales`(全链路)

**做什么:** 打开 `__tests__/monthly-sales.test.js`,**先指生命周期钩子,再指断言**。

**关键词:** 内存库 · `beforeAll / afterAll / beforeEach` · Supertest · **断言不变量**

**① 指着生命周期钩子讲(和单元测试最大的不同):**
> "它连**真数据库**。用 mongodb-memory-server 在内存里起一个真 MongoDB——`beforeAll` 起库连上,`afterAll` 断开销毁,`beforeEach` 每个测试前清空 + 塞一批已知订单。这样每个测试都从**相同的已知状态**开始,互不污染。"

**② 指着断言讲(本周的思维亮点):**
```js
expect(res.status).toBe(200);
expect(res.body).toHaveLength(5);                     // 分组数
const twoOrderMonth = res.body.find(r => r.orderCount === 2);
expect(twoOrderMonth.totalSpending).toBe(1221);       // 求和逻辑
expect(twoOrderMonth.avgOrderValue).toBe(610.5);      // 平均逻辑
const totalOrders = res.body.reduce((s, r) => s + r.orderCount, 0);
expect(totalOrders).toBe(6);                          // status 过滤(canceled/pending 被排除)
```
> "断言**测逻辑不变量,不测偶然值**。测试数据用'相对现在'的日期,月份会随运行时间漂移,所以我不断言'月份正好是几',而断言:有几个分组、那个 2 单的月份总额=1221 均值=610.5、completed 一共 6 单——这些换个时间、换台机器跑都该成立。这一步走完了 route→中间件→controller→service→repository→库的**整条链路**。"

### 6.3 一起跑绿

**做什么:** 终端 `npm test`。

> "两个测试一起跑:单元测试(`validateStatus`)+ 集成测试(`monthly-sales` 全链路),全绿。"

**终端应显示:** 两个 test 文件、所有用例 **PASS**。

> ⚠️ 演示前顺手清理:集成测试里还留着一行调试用的 `console.log('uri: ', uri)`,删掉更干净。

---

## 7. 设计取舍 Q&A 预案

**Q:为什么 `$lookup` 放在 `$group` 之后?**
> "为了减少参与关联的文档数。`$group` 前是 14 条订单,分组后聚成几个客户,让'重操作' `$lookup` 只作用在几条上。注意这是**管道阶段顺序**的优化,不是 ESR——ESR 是复合索引字段排列的原则,两回事。"

**Q:月度报表的时间边界怎么算的?为什么不用 `Date.now() - months*一天`?**
> "那样单位错了——`months * 一天的毫秒` 算出来是'几天前'不是'几个月前'。改用 `setMonth(getMonth() - months)` 按自然月算。而且 `setMonth` 要单独一行、用变量本身,它的返回值是时间戳不是 Date。"

**Q:populate 和 `$lookup` 怎么选?**
> "只是'取出引用的文档'用 populate,更简洁;'关联 + 聚合统计一起做'用 `$lookup`,这个报表正是后者。populate 背后是多次查询 + `$in` 去重,要小心 N+1。"

**Q:测试为什么用内存数据库,不用开发库?**
> "测试会增删数据,连开发库会污染数据。内存库完全隔离、测完自动销毁,而且 CI 环境没有本地 MongoDB,内存库自带,为 W6 的 CI 铺路。"

**Q:集成测试和单元测试有什么本质区别?**
> "单元测试测纯函数、输入输出确定、不碰外部依赖;集成测试测整条链路 + 真实数据库,要管数据库的起停和数据准备(生命周期钩子),验证的是'各层拼起来能不能真的跑通'。"

---

## 8. 收尾

**说:** "这周交付:2 个聚合报表(含关联查询)、查询优化的可对比证据、单元 + 集成测试全绿。月度报表是脱离引导独立设计的,达成了'能从空白重建聚合'的判据。下周继续查询优化的深挖和收尾。"

---

## 附:两个报表端点速查表

```
GET /reports/customer-spending?status=completed&days=30
    → $match→$group→$lookup→$unwind→$project→$sort
    → 每客户:orderCount / totalSpending / avgOrderValue + customerName/Email,按总额降序

GET /reports/monthly-sales?status=completed&months=6
    → $match→$group→$sort→$project
    → 每月:year / month / orderCount / totalSpending / avgOrderValue,按月份升序

参数校验:days/months 走 validatePositiveInt(默认 30/6);status 走 validateStatusParam
```
