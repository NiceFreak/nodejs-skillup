# Day 3 · 月度趋势聚合(独立设计)· 竖切成接口 + 从零搭集成测试

> 本日无引导、从空白独立完成第三个聚合场景——**月度销售趋势报表**,核心新难点是「从 `createdAt` 提取年-月作分组键」。上午独立设计并调通聚合管道;下午把它竖切进四层(route→controller→service→repository),抽出通用校验函数 `validatePositiveInt`;收尾从零搭起**集成测试**(mongodb-memory-server + 生命周期钩子 + Supertest),验证 `GET /reports/monthly-sales` 全链路。集成测试本是 W6 核心,Day 3 就提前啃下。今日还精确暴露了一个个人 pattern——**「套模板漏核心」**,一天内复现三次。

---

## 1. 需求与独立设计目标

**需求**:月度销售趋势报表。统计**最近 6 个月**、每月输出「订单总数 / 销售总额 / 平均订单金额」,只算 `completed`,**按月份从早到晚**排列。

**与前两个报表的关键不同**:前两个按 `userId`(现成字段)分组;这次要按**月份**分组,但订单里**没有「月份」字段,只有 `createdAt`(完整时间戳)**。所以核心挑战是:**怎么从日期里提取「年-月」作分组依据?** 这是本日唯一真正的新东西,独立攻破。

---

## 2. 月度聚合:从日期提取分组键(本日题眼)

### 2.1 用 `$year` / `$month` 构造分组键

聚合有专门的**日期运算符**:`$year`、`$month` 能从一个 Date 里取出年份、月份数字。分组键就用它们构造。

> 🔴 **必须用 `year` + `month` 一起分组,不能只用 `$month`。** 只按 `$month`(1-12)分,`2025年6月` 和 `2026年6月` 的 `$month` 都是 `6`,会被**错误合并成一组**。
> `_id` 要写成 **`year` / `month` 两个并列子字段**,各用各的运算符:
> ```js
> _id: {
>   year:  { $year:  "$createdAt" },
>   month: { $month: "$createdAt" }
> }
> ```
> ⚠️ 踩过的坑:把 `$year`、`$month` 塞进同一个 `{}`、都挂在 `month` 键下——一个对象里放两个运算符不合法,语义也自相矛盾。
> ⚠️ 数据碰巧都在 2026 年时「看起来对」,是**数据没跨年掩盖了 bug**。这是 Day 1「数据碰巧对 ≠ 逻辑对」的重演;生产数据一跨年就错。

### 2.2 `$sort` 与 `$project` 的顺序陷阱

需求要「按月份从早到晚」,应按 `_id`(年月)**升序**排,而不是按金额(那是上一题的排法)。

> 🔑 **`$sort` 要放在 `$project` 之前。** `$project` 里若 `_id: 0` 排除了 `_id`,数据流到 `$sort` 时 `_id` 已不存在,`$sort` 按不存在的字段排——不报错,但**排序静默失效**。
> 回忆 Day 1 的结论:**`$sort` 排的是它执行时刻文档里存在的字段**;`$project` 改变了文档形状,所以顺序很关键。趁 `_id` 还在,先排序再投影。

### 2.3 最终管道

```js
export async function getMonthlySalesTrend(status, date) {
    return Order.aggregate([
        { $match: { status: status, createdAt: { $gte: date } } },
        { $group: {
            _id: { year:  { $year:  "$createdAt" },
                   month: { $month: "$createdAt" } },
            orderCount:    { $sum: 1 },
            totalSpending: { $sum: "$totalAmount" },
            avgOrderValue: { $avg: "$totalAmount" },
        }},
        { $sort: { "_id.year": 1, "_id.month": 1 } },  // 趁 _id 还在,先排序
        { $project: {
            _id: 0,
            year:  "$_id.year",     // 平铺成干净顶层字段,前端好用
            month: "$_id.month",
            orderCount: 1, totalSpending: 1, avgOrderValue: 1,
        }},
    ]);
}
```

> ⚠️ `$project` 取值细节:引用字段值要写 `"$_id.month"`——**带 `$` 前缀**(漏了 `$` 就成普通字符串字面量),且别拖多余引号。输出字段起**干净的顶层名**(`year`/`month`),别用 `"_id.year"` 这种带点的 key(和 `_id: 0` 自相矛盾、语义混乱)。

---

## 3. 时间边界计算:`setMonth` 的坑

报表返回空数组 `[]` 时,先怀疑**时间边界算错**把订单全滤掉了,而非聚合逻辑错。

> 🔴 **`new Date().setMonth(new Date().getMonth - 6)` 这行叠了两个 bug:**
> 1. `getMonth` 后漏了 `()`——它是**方法不是属性**,`new Date().getMonth` 拿到的是函数本身,`函数 - 6 = NaN`。
> 2. `setMonth()` **就地修改原 Date,但返回值是毫秒时间戳(number),不是 Date**。`$gte` 拿到数字/`Invalid Date`,匹配不到任何订单。

**正确写法(精确按月,推荐)——分两步,别链式:**
```js
const d = new Date();
d.setMonth(d.getMonth() - 6);   // 单独一行就地修改,之后用 d 这个变量
```
> 🔑 核心教训:`$gte` 必须拿到一个**合法的 Date 对象**,不是数字、不是 `Invalid Date`。这和 Day 1 seed 时「`createdAt` 必须是 Date 不是字符串」是同一类坑——**日期类型要对**。
> (近似方案:`new Date(Date.now() - 6*30*24*60*60*1000)`,把一月按 30 天算,趋势报表够用但不精确。)

---

## 4. 竖切进四层

repository 已好 → service → controller/route,自底向上写(Day 2 验证过这个顺序顺)。

| 层 | 职责 | 与客户报表的差异点 |
|---|---|---|
| repository | `getMonthlySalesTrend(status, date)`,聚合实现 | 分组维度:月份 vs 客户 |
| service | `getMonthlySalesTrendReport({ status, months })`:算 6 个月边界 + Decimal128 转换 | 时间跨度:6 月 vs 30 天 |
| 中间件 | `validateMonthsParam`(校验 `months` 正整数)+ 复用 `validateStatusParam` | 字段名 `months` vs `days`、默认值 6 vs 30 |
| controller/route | `GET /reports/monthly-sales`,挂 `reportRouter` | 调**对**的 service 函数 |

**Decimal128 转换**沿用 Day 2 的干净写法:`...rest` 展开 + 只覆盖 `totalSpending`/`avgOrderValue` 两个转换字段。

> 🔴 **`months` 参数的单位/语义 bug**:参数叫 `months`,却写 `new Date(Date.now() - months * 24*60*60*1000)`——`24*60*60*1000` 是**一天**的毫秒数,`months * 一天` 实际是「`months` **天**前」。传 `months=6` 期望 6 个月、实得 6 天,报表几乎空但不报错。
> 修法:名副其实按月算,`setMonth(getMonth() - months)`。
> 🔑 **改完问自己「这个值的单位/语义对吗」**——`月 × 天的毫秒` 一眼就该看出单位不匹配。养成「检查单位一致性」的习惯,这类 bug 能自己抓出来。

---

## 5. 抽出通用校验函数 `validatePositiveInt`

`days` 和 `months` 的校验逻辑相同(正整数、缺省给默认),该抽成一个函数复用。但 `validateDays` 里**写死了默认值 30**,`months` 默认该是 6——直接复用会把 `months` 缺省填成 30。

> 🔑 **「复用」不是简单改名,要把「变化的部分」提取成参数。**
> - **不变**(留在函数体):正整数校验逻辑
> - **变化**(提成参数):默认值
> ```js
> validatePositiveInt(value, defaultValue)  // days 传 30,months 传 6
> ```
> 这就是「提取可复用函数」的核心思维:找出共性(留函数里)与差异(变参数)。

**分层决策:校验函数共用,中间件各写一个薄的。** 因为两个中间件要从 `req.query` 取**不同字段**(`days`/`months`)、给**不同默认值**(30/6)、存**不同地方**(`req.days`/`req.months`)——差异点多,硬合成一个反而复杂。**共性下沉到函数,差异留在各自中间件**。

> ⚠️ 命名教训:一度想叫 `validateDate`——但它校验的是一个**正整数数量**(6、30),不是**日期**(2026-07-08)。名字要贴「校验对象的本质」:`validatePositiveInt` / `validateCount`,别叫 `validateDate`。
> ⚠️ **改了定义别忘改引用**:`validateDays → validatePositiveInt` 后,Day 2 那个 days 中间件的调用也要同步改成 `validatePositiveInt(req.query.days, 30)`,否则客户报表会调到不存在的旧函数报错。(这是 Week 2 `instanceof` 注册踩过的同类坑。)

---

## 6. 🔁 本日个人 pattern:「套模板漏核心」(一天三次)

今天套用旧模板出错**三次**,都是**「改了外壳、漏了里子」**:

| # | 场景 | 改了外壳 | 漏了核心 |
|---|---|---|---|
| 1 | 月度聚合 | `_id` 写了字段名 | 残留 `userId`、只按 `$month` 没加 `$year` |
| 2 | service 时间 | 参数名换成 `months` | 计算公式还是「一天的毫秒」(单位没改) |
| 3 | controller | 函数名改成 `...MonthlySalesTrend...` | 实际调用的仍是 `getCustomerSpendingReport` |

> 🔑 **对治习惯**:套用旧模板后,逐一核对**「这个新需求和旧的,业务上哪几处不同?」**,确保每处都改到位。
> 月度报表 vs 客户报表的不同就在:**时间跨度(6月 vs 30天)** 和 **分组维度(月份 vs 客户)**。列出不同点、逐个确认——既享受模板的快,又不漏业务差异。
> **认识到这个 pattern,比改对任何一个 bug 更有价值。** 它不是「能力不足」,是「习惯」——只能靠「从需求出发」有意识地纠正,靠多输出消除。

---

## 7. 从零搭集成测试

### 7.1 单元测试 vs 集成测试

| | 单元测试(Day 2 `validateStatus`) | 集成测试(本日) |
|---|---|---|
| 被测对象 | 纯函数 | 整条链路 + 真实数据库 |
| 做法 | 输入值、查返回 | 真发 HTTP 请求,走完 route→中间件→controller→service→repository→**DB**,查返回 JSON |
| 新增难点 | — | ① 要数据库且必须隔离 ② 要自备已知数据才能断言 ③ 异步 + 生命周期钩子 |

> 💡 **有底子的部分**:`describe`/`test`/`expect`/`beforeAll` 是 **Jest 通用脚手架**(前端测试也用这套)。今天真正「新」的只有:连内存库 + 塞数据 + Supertest 发请求,以及**数据库生命周期**。心理上轻装。

### 7.2 前置改造:app 定义与启动分离

集成测试要 `import { app }` 交给 Supertest。但若 `app.js` 一被 import 就执行 `startServer()`,会连真实库、占端口。

> 🔑 **拆成两个文件(Express 最佳实践):**
> - `app.js`:`express()` + 中间件 + 路由 + 错误处理 + `export { app }`,**不含启动逻辑**
> - `server.js`:`import { app }` + `connectDB` + `app.listen` + graceful shutdown,`npm run dev` 的入口
>
> 好处不只是为测试——**「应用定义」与「应用启动」分离**,让 app 可测试、可复用。

### 7.3 生命周期钩子

```js
let mongoServer;
beforeAll(async () => {                       // 所有测试前一次:起内存库 + 连接
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => {                         // 所有测试后一次:断开 + 销毁,不留痕迹
    await mongoose.disconnect();
    await mongoServer.stop();
});
beforeEach(async () => {                        // 每个 test 前:清空 + 重塞已知数据
    await Order.deleteMany({});
    await Order.insertMany([ /* 已知数据 */ ]);
});
```

- **`beforeEach` 每个测试都重塞** → 保证每个测试从**相同已知状态**开始,测试间不互相污染。这是集成测试可靠的关键。
- **Supertest** 只负责「发 HTTP 请求」:`request(app).get('/...')`,内存里模拟、不用真开端口。
- 选 **mongodb-memory-server**(内存里临时起真 MongoDB,测完自动销毁):完全隔离、不污染 `week2` 开发库、为 W6 的 CI 铺路(CI 无本地 MongoDB,内存库自带)。

> ⚠️ 结构规则:`test` **不能嵌套在 `test` 里**(会报 "Tests cannot be nested")。层级是 `describe` → 多个**平级** `test`。

### 7.4 测试数据设计(集成测试最麻烦的一环)

塞入**已知、可预测**的数据才能断言。本日踩的坑:

> 🔴 **① Decimal128 直接写数字**:`totalAmount: 99`,靠 Mongoose 自动 cast。别塞 `{ "$numberDecimal": "99" }`——那是 **JSON 序列化后**的形状,不是构造方式,Mongoose 不认。
> 🔴 **② 日期用「相对现在」算,别用绝对日期**:查询是 `months=6`(最近 6 个月),写死 `2026-01-01` 会随「哪天跑」而掉出窗口,测试不可重复。
> ```js
> const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
> // createdAt: monthsAgo(1) / monthsAgo(2) / ...
> ```
> 🔴 **③ 别贴窗口边界**:`monthsAgo(6)` 正好等于 service 算的边界,两处时刻差几毫秒就可能被滤掉,结果依赖毫秒级时序、不稳定。数据放窗口内**安全地带**(如 1~5 个月前)。
> 🔴 **④ 删掉手写 `_id`**:让 Mongoose 自动生成,少一个出错点(还避免手写 ObjectId 撞值)。
> ⚠️ `items` 是 `required`——`insertMany` 若报 `ValidationError` 就每条补 `items: []`。(本日未加也没报,记一笔「`items` required 在 insertMany 未拦截」待查。)

### 7.5 断言逻辑不变量,而非漂移值(核心测试思维)

`toHaveLength(3)` 是**弱断言**——只查条数,内容全错也绿。而数据用了相对日期,**月份值会随运行月份漂移**,精确写死 `month: 2` 下个月就红。

> 🔑 **好的断言测「不变量」(invariant),不测「偶然值」。**
> 问自己:**这个断言,换个时间 / 换台机器跑,还该成立吗?** 该成立的才是好断言。
> ```js
> expect(res.status).toBe(200);
> expect(res.body).toHaveLength(5);                       // 分组数(不变)
> const twoOrderMonth = res.body.find(r => r.orderCount === 2);
> expect(twoOrderMonth.totalSpending).toBe(1221);         // 求和逻辑
> expect(twoOrderMonth.avgOrderValue).toBe(610.5);        // 平均逻辑
> const total = res.body.reduce((s, r) => s + r.orderCount, 0);
> expect(total).toBe(6);                                  // completed 总单数(验 status 过滤)
> ```
> 具体月份是 2 还是 7 是偶然的;「2 单那月总额=1221」「completed 共 6 单」「canceled/pending 被排除」是逻辑保证、永远成立——测这些。
> (更进阶:用 Jest fake timers mock「当前时间」,才能对绝对日期做精确断言;今天不上。)

> 💡 **红灯先问「谁对」**:期望 5、实际 6 时,差点把代码改去迎合 5——但回看真实 `res.body`(`orderCount` 1+2+1+1+1=6),是**示例里随口给的 5 错了,代码是对的**。别人给的断言示例:**结构可以抄,数字必须用自己的真实数据算过再替换**。

---

## 8. 测试文件放置约定

> 🔑 **测试文件的位置反映它测试的「范围」:**
> - 测一个函数/模块 → 放该模块旁的 `__tests__`(单元):`utils/__tests__/validators.test.js`——测谁放谁旁边。
> - 测整个应用某条链路/接口 → 放顶层 `src/__tests__`(集成):`src/__tests__/monthly-sales.test.js`——它横跨 route/controller/service/repository,不隶属任何单一模块。
>
> (测试多了再考虑 `__tests__/unit/`、`__tests__/integration/` 分目录。)
> ⚠️ 移动测试文件后,相对 import 路径要跟着改层级(`./app.js` → `../app.js`),挪完 `npm test` 确认仍绿。

---

## 9. 本日产出与复盘

**已完成:**

1. ✅ **月度趋势聚合**(第三个场景,**独立从空白设计**):`$year`/`$month` 提取分组键、year+month 跨年正确、`$sort` 在 `$project` 前。
2. ✅ **竖切四层**成 `GET /reports/monthly-sales`(`months`/`status` 参数化 + 校验)。
3. ✅ **抽出通用 `validatePositiveInt`**(默认值参数化),days/months 两个中间件复用。
4. ✅ **从零搭集成测试**:mongodb-memory-server + 生命周期钩子 + Supertest + 「断言不变量」——本是 W6 核心,提前拿下。
5. ✅ **app/server 拆分**(应用定义与启动分离)。

**本周验收物到今日全部集齐**(Day 3 已把原计划 Day 5 的东西做完,Day 4-5 宽松):

- ✅ 3 个聚合场景(客户消费 / `$lookup` 关联 / 月度趋势——月度为独立设计)
- ✅ populate / N+1(含实测)
- ✅ explain 查询优化(Day 1)
- ✅ 单元测试(`validateStatus`)+ 集成测试(`monthly-sales`)——平铺任务超额完成
- ⬜ 周复盘(周五)

**关于自己的三个观察(比代码更值得记):**

- 🔁 **「套模板漏核心」pattern**(今日三次)→ 对治:套模板后逐一核对业务差异点。
- 🚦 **「红灯先问谁对」**(5 vs 6,守住了没改错代码)→ 以事实/契约为准,别改代码迎合错误期望。
- 🎯 **「断言测不变量」思维**→ 换时间/换机器仍该成立的才是好断言。

**待办(Day 4 / 之后):**

- [ ] `$lookup` 子管道(sub-pipeline)优化:关联时只取 name/email,不搬整个 user 文档。
- [ ] 集成测试补 `GET /reports/customer-spending`(带 `$lookup`,需连 user 一起塞)。
- [ ] 待查:`items` required 在 `insertMany` 时为何未拦截。
- [ ] 清理调试残留:测试文件里的 `console.log`、实验脚本。
