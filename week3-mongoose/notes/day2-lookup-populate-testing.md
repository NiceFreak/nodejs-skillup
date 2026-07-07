# Day 2 · 多阶段聚合管道与关联查询 · 竖切进分层 + populate/N+1 + 首个单元测试

> 承接 Day 1 的单集合聚合，本日主线是「把聚合接进真实分层架构」并升级到**跨集合关联**。上午把 Day 1 的 `$match → $group → $sort` 竖切进 route→controller→service→repository 四层，落地 `GET /reports/customer-spending`；下午用 `$lookup → $unwind → $project` 让报表带上客户名，再对比 `populate`、讲透 **N+1**；收尾搭起 Jest 环境、写出第一个单元测试。产出已覆盖到原计划 Day 3 的内容。

---

## 1. 心智模型校准

**Q1. 聚合逻辑该落在哪一层？**

一段聚合管道其实是**两件事的合体**，必须拆开归位：

- **「聚合管道代码」（那个 `[$match, $group, ...]` 数组）在操作数据库** → 属于 **repository**（唯一碰数据库、唯一写 `Order.aggregate(...)` 的地方，和 Week 2 把 `find()` 放 repository 同理）。
- **「要一份怎样的报表」（筛几天、什么状态、要哪些指标）是业务意图** → 属于 **service**。

> ⚠️ 我最初误以为「聚合管道整体放 service」，因为没意识到它含「理解业务 + 具体查询」两部分。正解：**代码在 repository，参数由 service 决定并传入。**

**Q2. `$lookup` 放 `$group` 之前还是之后？**

放**之后**。理由是**减少参与关联的文档数**：`$group` 前有 14 条订单，之后聚成 4 个客户，让「重操作」`$lookup` 只作用在 4 条上。

> ⚠️ 概念纠偏：这条优化**不叫 ESR**。ESR（Equality-Sort-Range）是**复合索引字段排列顺序**的原则（Day 1 建 `{status, createdAt}` 索引用的）；「减少流经重操作的文档数」是**管道阶段顺序**的优化思路。两个不同的东西，别混用名字。

**Q3. `populate` 和 `$lookup` 怎么选？**

- 只是「取出引用的文档」 → **populate**（更简洁）。
- 「关联 + 聚合统计一起做」 → **`$lookup`**（本报表正是这种，所以用 `$lookup` 是对的）。

---

## 2. 聚合竖切进分层架构

**需求**：把 Day 1 的客户消费报表做成 `GET /reports/customer-spending?status=completed&days=30`。

### 2.1 三个分层决策（今日核心）

| 决策 | 结论 | 判据 |
|---|---|---|
| 聚合管道代码放哪层 | **repository** | 它是「怎么查数据库」的实现细节，和 `find()` 同类 |
| 时间边界 `days` 谁算 | **service** | 「为什么是 30 天不是 60 天」是业务规则；service 算出时刻传给 repository |
| `days`/`status` 参数校验放哪层 | **入站中间件** | 「必须是正整数/合法枚举」是**格式问题**（HTTP 请求长什么样），和 ObjectId 格式校验同层 |
| Decimal128 → number 转换放哪层 | **service 出口** | 「表示层转换」，非核心业务；repository 保持数据库原样、service 出口交付干净数据 |

> 🔑 **数据流向定位法**：`days` 校验是**入站**（请求 → 中间件 → controller → service → repository），中间件在最前面；Decimal128 是**出站**（repository 查出 → service → 响应出去），根本到不了入站中间件。判断「某处理放哪」，就看它**在数据流的哪一段出现**。

### 2.2 实现顺序：自底向上

repository（聚合搬进来、参数化）→ service（时间边界 + Decimal128 转换）→ controller/route（接 HTTP）。

> 💡 **为什么自底向上顺**：每层动手时，它依赖的下层已「确定存在且验证过」，不用猜。自顶向下在实现阶段别扭——上层要调的东西还不存在。成熟做法是「**先自顶向下想清楚契约，再自底向上写实现**」；本日契约（三个决策 + 报表形状）已想清，直接自底向上写实现正合适。

### 2.3 各层最终代码

**repository**（`repositories/users.js`）——参数化 `$match`，其余固定逻辑不动：

```js
export async function getCustomerSpending(status, date) {
    try {
        const result = await Order.aggregate([
            { $match: { status: status, createdAt: { $gte: date } } }, // 参数从 service 来
            { $group: {
                _id: "$userId",
                orderCount:    { $sum: 1 },
                totalSpending: { $sum: "$totalAmount" },
                avgOrderValue: { $avg: "$totalAmount" },
            }},
            // ... $lookup / $unwind / $project / $sort 见第 3 节
        ]);
        return result;
    } catch (error) {
        throw new AggregationError(`Aggregation Error: ${error.message}`); // 消息拼上根因，便于 debug
    }
}
```

**service**（`services/orderService.js`）——算时间边界 + Decimal128 转换：

```js
export async function getCustomerSpendingReport({ status, days }) {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000); // 业务规则：算时间边界
    const result = await getCustomerSpending(status, date);

    return result.map(item => {
        const { totalSpending, avgOrderValue, ...rest } = item; // 只挑要转换的两个，其余透传
        return {
            ...rest,
            totalSpending: Number(totalSpending.toString()), // Decimal128 → number
            avgOrderValue: Number(avgOrderValue.toString()),
        };
    });
}
```

> 💡 **service 职责收窄**：从「显式列全部字段」演进到 `...rest` 透传 + 只覆盖需转换的两字段。好处：管道 `$project` 新增字段（如 `customerName`），service **自动带过去**，只单独负责「把 Decimal128 转成 number」这一件事——不需要知道报表有哪些业务字段。

**middleware + controller** ——校验后把处理过的值挂到 `req`，controller 统一取 `req.status`/`req.days`：

```js
// middlewares/validateStatusParamsMiddleware.js
export const validateStatusParam = (req, res, next) => {
    const { valid, value } = validateStatus(req.query.status);
    if (!valid) return res.status(400).json({ error: 'Status must be one of: ...' });
    req.status = value;   // 归一化后的值
    next();
};

// controller/users.js
export async function getCustomerSpendingReportController(req, res) {
    const reportData = await getCustomerSpendingReport({ status: req.status, days: req.days });
    return res.status(200).json(reportData);
}
```

### 2.4 踩过的坑

| 坑 | 现象 / 后果 | 正解 |
|---|---|---|
| **路由顺序**：`/reports` 挂在 `/:id` 后 | `GET /users/reports/...` 被 `/:id` 抢先匹配，`id="reports"` 校验失败直接 400 | 静态路由必须注册在 `/:id` 动态路由**之前**；后续索性拆出独立 `reportRouter` 挂 `/reports` |
| controller 传对象、service 收两个位置参数 | service 的 `status` 收到整个对象、`days` 是 `undefined` → `Invalid Date` | 两边统一（本项目统一用**对象** `{ status, days }`） |
| `avgOrderValue: Number(totalSpending)` 复制粘贴错 | 均值永远等于总额；orderCount=1 的行看不出，多订单的 u3（应 1888.385）才暴露 | 改成 `Number(avgOrderValue)`；**特意留多订单样本照 bug** |
| Decimal128 形状想当然 | 以为是 `{ $numberDecimal: "..." }`（那是 `JSON.stringify` **之后**的样子）| 先 `console.log` 确认对象真实形状是 `new Decimal128('5432.1')`，直接 `Number(x.toString())` |
| 大写 status 静默返回空报表 | 中间件归一化了 `req.status`，controller 却仍读 `req.query.status` 原始值，`$match` 到库里匹配不到 | controller 统一改用 `req.status`（中间件处理后的值），与 `days` 一致 |

> 🔑 **对象形状 ≠ 序列化后形状**：别拿 `JSON.stringify` 后看到的样子（`.$numberDecimal`）去写操作原始对象的代码，先 `log` 出来确认再动手。

---

## 3. `$lookup` 关联查询（多阶段管道）

**目标**：报表里 `userId` 是一串 ObjectId，人看不出是谁 → 用 `$lookup` 关联 user 集合，带上客户名/邮箱。

### 3.1 `$lookup` 的四个字段

```js
{ $lookup: {
    from: "users",        // ← MongoDB 里集合的真实名（复数小写），不是 Model 名 "User"
    localField: "_id",    // ← $group 后 userId 存在 _id 字段里
    foreignField: "_id",  // ← user 集合的主键
    as: "userInfo",       // ← 关联结果放进的新字段
}}
```

> ⚠️ 三个易错点：
> 1. **`from` 填集合真实名**：Mongoose 默认把 Model 名小写 + 复数化 → `User` 集合叫 `users`。填错 lookup **静默返回空数组、不报错**。
> 2. **四个值都是字符串字面量**，别写成裸变量（`from: users` 会当变量找 → 报错）。
> 3. **`"$userId"`（带 $）= 取字段的值；`"_id"`/`"users"`（不带 $）= 字段/集合的名字**。`$lookup` 四字段全是「名字」，都不带 `$`。

**关联键类型必须一致**：seed 时用 `new mongoose.Types.ObjectId(id)` 把 userId 存成了真正的 ObjectId，所以 `$group` 出来的 `_id`（ObjectId）和 user 的 `_id`（ObjectId）对得上。`$lookup` 不自动 cast 字符串——**Day 1 的正确决策省了现在的麻烦**。

### 3.2 为什么结果是数组 → `$unwind` 炸开

`$lookup` 按「一对多」设计，结果**永远用数组包着**，哪怕一对一也是 `[{...}]`：

```js
userInfo: [ { _id, name, email, age, addresses, __v } ]  // 整个 user 文档都塞进来了
```

用 **`$unwind`** 把数组炸成对象：

```js
{ $unwind: "$userInfo" }   // [{...}] → {...}
```

> 🔑 **`$unwind` 的本质**：把数组的**每个元素拆成一条独立文档**。一对一场景 1 条还是 1 条（只是数组变对象）；真正一对多（如订单里的 `items`）会**成倍放大文档数**——威力和坑都在这。

### 3.3 `$project` 裁字段 + 提取嵌套

`$lookup` 把整个 user 文档带进来了（`age`/`addresses`/`__v` 都不要），用 **`$project`** 收拾：

```js
{ $project: {
    _id: 0,                          // _id 默认保留，需显式 0 排除
    orderCount: 1,
    totalSpending: 1,
    avgOrderValue: 1,
    userId: "$_id",                  // 把 _id 改名保留成 userId
    customerName: "$userInfo.name",  // 从嵌套字段提取成顶层字段
    customerEmail: "$userInfo.email",
}}
```

> ⚠️ `_id` 特殊：`$project` 里其他字段「不写就没有」，唯独 `_id` **不写也在**，要显式 `_id: 0` 才排除。规则：除 `_id` 外不能混用 `0` 和 `1`（`_id: 0` 与其他字段 `:1` 可共存）。
>
> 💡 **在哪层重塑形状要统一**：`userId` 改名放管道 `$project` 做（一处定形），service 只管类型转换——别管道改一半、service 又改一半。

### 3.4 完整六阶段管道

```
$match → $group → $lookup → $unwind → $project → $sort
过滤     分组统计   关联user   炸开数组   裁剪+提取   按总额降序
```

比 Day 1 的单集合聚合上了一个台阶：关联两个集合、输出重塑成干净对外报表、类型转换到位。

> ⚠️ **显式列字段的副作用**：service 早先「只解构挑的字段」，导致管道新增的 `userInfo`/`customerName` 被 service 丢掉（和当初 `userInfo` 被丢同因）。改用 `...rest` 透传后自动带出（见 2.3）。

---

## 4. populate vs `$lookup` 与 N+1

### 4.1 两者层级不同（一切差异的根）

- **`$lookup`**：**MongoDB 数据库层**操作，关联在数据库内部完成，一次返回。
- **populate**：**Mongoose（ODM，应用层）**功能，数据库不知道它的存在——Mongoose 在 Node 应用里帮你「自动补查」关联数据。

```js
// populate：靠 schema 里的 ref: "User" 才知道去哪个集合补查
export async function findOrdersWithUser() {
    const result = await Order.find().populate("userId"); // 别漏 await！
    return result;
}
```

| 对比维度 | populate | `$lookup` |
|---|---|---|
| 层级 | Mongoose 应用层 | MongoDB 数据库层 |
| 关联数据放哪 | `userId` 字段**原地被替换**成完整文档 | **新增字段**（`userInfo`），默认是**数组** |
| 加工能力 | 只「取出引用文档」，不聚合裁剪 | 管道内可接 `$group`/`$project` 统计裁剪 |
| 数据库往返 | **2 次**（1 查主 + 1 批量查关联） | **1 次**（数据库内部关联） |
| 适用 | 简单「取出引用的文档」 | 「关联 + 聚合统计」一体 |

### 4.2 N+1 问题（今日最值钱的收获）

**N+1 = 「关联数据被逐条、分散地查询」的通用反模式**，不是某数据库特有。经典现场是**手动天真地循环关联**：

```js
const orders = await Order.find();                    // 1 次
for (const order of orders) {
    order.user = await User.findById(order.userId);   // 每条查 1 次 → N 次
}   // 共 1 + N 次数据库往返 = N+1，灾难
```

**关键反转**：现代 Mongoose 的 `populate` **用 `$in` 批量查、避开了 N+1**，不是逐条查：

```js
User.find({ _id: { $in: [id1, id2, ...] } })   // 1 次批量，非 N 次
```

| 做法 | 查询次数（N 条主数据）| 有无 N+1 |
|---|---|---|
| 手动循环逐条 `findById` | 1 + N | **有，灾难** |
| Mongoose `populate` | 1 + 1（`$in` 批量）| 无（已优化）|
| `$lookup` | 1（数据库内关联）| 无 |

> ⚠️ 面试别说错：「populate 有 N+1 所以不好」是错的。准确说法：**手动逐条关联才有 N+1，populate 用 `$in` 避开了，它的代价是 2 次往返而非查询次数。**

### 4.3 实测验证（`mongoose.set('debug', true)`）

开 debug 后跑 populate，控制台三行：

```
Mongoose: orders.find({}, {})                                  ← 第1次：查订单
Mongoose: users.createIndex({ email: 1 }, { unique: true })    ← 启动副作用，不算
Mongoose: users.find({ _id: { '$in': [ 4 个 ObjectId ] } })    ← 第2次：一次批量查
```

- **14 个订单只发 2 条查询**，第二条正是 `$in: [...]` 批量，眼见为实。
- **Mongoose 还去重了**：14 个订单只属于 4 个 user，`$in` 只带 4 个唯一 id → 「1 次 + 1 次(去重批量)」，比理论更优。
- 中间 `createIndex` 是 Mongoose 启动时按 schema 的 `unique: true` 自动建索引，与 populate 无关。

---

## 5. SQL 对照表（Day 1–2 汇总）

| SQL | MongoDB | 说明 |
|---|---|---|
| `WHERE` | `$match` | 过滤；放最前吃索引、减少后续文档量 |
| `GROUP BY col` | `$group` 的 `_id: "$col"` | 分组键 |
| `COUNT(*)` | `$sum: 1` | 每条累加 1 |
| `SUM(col)` / `AVG(col)` | `$sum: "$col"` / `$avg: "$col"` | 字段引用带 `$` |
| `ORDER BY ... DESC` | `$sort: { field: -1 }` | -1 降序 / 1 升序 |
| `SELECT col1, col2` | `$project` | 挑字段（1 保留 / 0 排除）|
| `JOIN` | `$lookup` | 数据库内关联，一次完成 |
| `WHERE IN (...)` + 应用层拼装 | `populate`（底层 `$in`）| 批量查 + 代码组装，非数据库内关联 |
| `LIMIT n` / `OFFSET n` | `$limit: n` / `$skip: n` | 分页用（尚未用到，顺带记）|

**两个关键认知：**

1. **执行顺序：SQL 书写 ≠ 执行，聚合书写 = 执行。** SQL 实际执行是 `FROM→WHERE→GROUP BY→SELECT→ORDER BY`；聚合管道**写的顺序就是执行顺序**，更直白。这也是 `$sort`（按总额）必须放 `$group` 之后的原因——总额是 `$group` 算出的新字段。
2. **N+1 两边同构**：关系型 ORM 懒加载（如 `order.user`，Hibernate/ActiveRecord）是 N+1 经典发源地；解法关系型用 `JOIN`/`WHERE IN`，MongoDB 用 `$lookup`/`populate`。

---

## 6. 概念补充

### 6.1 ORM/ODM 与数据持久化

- **持久化（persistence）**= 把数据存到能长期保留的地方（数据库/文件/磁盘），程序关闭、断电后仍在。是**目的**。
- **ORM/ODM** = 一个**翻译层**，让你用**对象**方式操作数据，背后翻译成数据库命令。是**手段**。

```js
const user = new User({ name: "张三" }); // 面向对象思维
await user.save();                       // Mongoose 翻译成 db.users.insertOne(...)
```

- **Mongoose 是 MongoDB 的 ODM**（Object-**Document** Mapping）；`ref`/`populate`/Decimal128/`__v` 全是 Mongoose 加的封装，原生 driver 没有。
- 关系型对应物叫 **ORM**：**Sequelize**（Node 最主流关系型 ORM，之于 PostgreSQL/MySQL ≈ Mongoose 之于 MongoDB）、Prisma、TypeORM；Hibernate（Java）、ActiveRecord（Ruby）。
- **`__v`**：Mongoose 的乐观并发版本号，默认备而不用；对外输出用 `$project`/投影挡掉。

> 💡 这也解释了两件事：N+1 是「ORM 的经典坑」，因为 ORM 提供 `order.user` 这种「点一下自动查」的便利，用不好就逐条查；populate 是「Mongoose 的功能」而非「MongoDB 的功能」，因为它是 ODM 这层在应用层用 `$in` 拼装。

### 6.2 CommonJS vs ESM（今日踩的模块系统坑）

| | CommonJS（CJS）| ES Modules（ESM）|
|---|---|---|
| 诞生 | Node 早期自带（2009）| JS 官方标准（ES2015）|
| 语法 | `require` / `module.exports` | `import` / `export` |
| 开关 | 默认 | `package.json` 加 `"type": "module"` |

**本项目统一用 ESM**，今天踩的坑全是这套分裂的表现：

- `import` **必须带 `.js` 后缀**（ESM 规矩，`require` 可省）。
- `--experimental-vm-modules`：Jest 是 CJS 时代老框架，测 ESM 要靠这个 flag 兼容——**两套系统打架的典型现场**。
- 报错栈里的 `cjs/loader`：即便项目是 ESM，底层某些加载路径仍走 CJS loader，是并存的痕迹。

> 🔑 判断法：看 `package.json` 有无 `"type": "module"`；`.mjs` 强制 ESM、`.cjs` 强制 CJS；一个项目尽量统一一套。

---

## 7. 测试入门（Jest 单元测试）

**心智模型**：自动化测试 = 把「你用 Postman 手动验证的过程」变成代码，每次改动几秒自动验证旧功能没被改坏。今天的 `avgOrderValue` 复制 bug、大写 status 隐患，有测试就会被红灯立刻抓出。

- **单元测试**：测一个函数的逻辑，不连库、不起服务器（纯函数进出，快）。
- **集成测试**：测多层串起来的行为，要连库、起服务器（Supertest，留 Day 4）。

**工具**：Jest（`describe`/`test`/`expect`）+ Supertest（测 HTTP 接口的事实标准，前端背景常缺的拼图）。

**环境搭建（ESM 项目关键）**：

```jsonc
// package.json scripts —— --experimental-vm-modules 是让 Jest 处理 import/export 的关键
"test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
```

**给 `validateStatus` 写的 5 个用例（每个精准盯一个分支）**：

```js
import { validateStatus } from "../validators.js";

describe("validateStatus", () => {
    test("合法状态返回归一化的值", () => {          // 合法
        const r = validateStatus("completed");
        expect(r.valid).toBe(true);
        expect(r.value).toBe("completed");
    });
    test("非法状态 valid 不通过", () => {           // 非法：不在枚举里的字符串
        const r = validateStatus("shipping");
        expect(r.valid).toBe(false);
        expect(r.value).toBe(null);
    });
    test("非字符串 valid 不通过, 转为 null", () => { // 类型错
        const r = validateStatus(123);
        expect(r.valid).toBe(false);
        expect(r.value).toBe(null);
    });
    test("缺省(null/undefined)补默认 completed", () => { // 缺省
        expect(validateStatus(null).value).toBe("completed");
        expect(validateStatus(undefined).value).toBe("completed");
    });
    test("大写归一化 valid 通过", () => {           // 归一化：验证 toLowerCase 生效
        expect(validateStatus("COMPLETED").value).toBe("completed");
    });
});
```

> 🔑 **两次红灯都是「测试期望写错」而非函数 bug**，价值反而更大：
> - 把 `validateStatus(null)` 当「非法」→ 函数把 `null` 归为「缺省」返回 `completed`。**测试逼我回去核对函数真实契约。**
> - `validateStatus(123)` 期望 `value: 123` → 函数校验失败统一返回 `value: null`。
>
> **红灯判断法**：先问「到底谁对」——回看函数设计意图。函数有 bug 就改函数；期望写错就改测试。`expect` 的期望值必须来自**函数的行为契约**，不是临时脑补。这 5 个用例现在就是 `validateStatus` 的**可执行文档**。

> ⚠️ matcher：基本类型用 `.toBe(x)`；对象/数组用 `.toEqual(obj)`（`.toBe` 比的是引用，永远 false）。

---

## 8. 本日产出与待办

**已完成（超额，覆盖到原计划 Day 3）：**

1. ✅ 聚合报表**四层竖切**（route→controller→service→repository + 参数校验 + Decimal128 转换），路由重构出独立 `reportRouter`。
2. ✅ `$lookup + $unwind + $project` **关联查询**——带客户名/邮箱的报表，六阶段管道跑通，排序 u2>u3>u4>u1、类型干净。
3. ✅ **populate 实操 + N+1 原理 + 实测验证**（2 次查询、`$in` 去重）——本是 Day 3 内容。
4. ✅ **第一个单元测试**（`validateStatus`，5 用例全绿），Jest + ESM 环境搭通。

**本周验收物进度**：「2–3 个复杂聚合场景」已有 2 个（Day 1 分组统计 + Day 2 关联查询），关联查询已覆盖；「测试随手写」平铺任务已破冰一半。

**待办（Day 3 / 之后）：**

- [ ] `$lookup` **子管道（sub-pipeline）**优化：关联时就只取 name/email，不把整个 user 文档搬进内存（Day 3/4 深挖）。
- [ ] seed 给 user 起不同名字（张三/李四/王五），让 demo 显示不同客户名，更直观。
- [ ] 集成测试：Supertest 测 `GET /reports/customer-spending`（要连测试库、`beforeAll`/`afterAll`、异步，留状态好的整段时间）。
- [ ] 清理实验脚本 `findOrdersWithUser.js` / 方法（纯对比用，别当正式功能提交）。
- [ ] `items` 若要正式用，改成规范子文档数组并给 `productId` 补 `ref: "Product"`。
