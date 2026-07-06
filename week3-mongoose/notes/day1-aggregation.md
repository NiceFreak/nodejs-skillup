# Day 1 · 聚合管道与查询优化 · 客户消费统计报表

> Aggregation pipeline 是**单向直线的流水线**：数据一站一站往下流，每站处理完直接进下一站，没有「返回」。它存在的根本原因是 `find()` 只能对**单个文档**过滤、投影，无法**跨文档聚合**（把 100 条订单算成 1 条「总额」）。本日以「客户消费统计报表」为主线，走通 `$match → $group → $sort`，再用 `explain` + 复合索引把「慢」变成可对比的证据。

---

## 1. 心智模型校准

**Q1. Aggregation pipeline vs `find()` + `.sort()/.limit()`**

- `find()` 逐文档过滤 + 字段投影，**做不到跨文档聚合**。
- pipeline 是流水线，能在流动过程中做分组、统计、关联。
- ⚠️ 别用「洋葱模型」类比：洋葱模型（Express 中间件）是**嵌套包裹**，`next()` 前后都能插代码、有「返回」这一动作；pipeline 是**单向直线**，没有返回。

**Q2. `$match` 放最前 vs 放 `$group` 之后 —— 两个层面的影响**

1. **索引层面**：只有 `$match` 是管道**第一站**时才能吃到集合索引，减少从磁盘/内存读取的文档数。
2. **内存层面**：`$group`/`$sort` 默认在**内存**里跑（超过 100MB 报错，除非开 `allowDiskUse`）。`$match` 提前能大幅减少流入这些「重」操作的文档量，降低内存压力。

**Q3. `$lookup` 解决什么**

不只是「要关联数据」，而是把应用层**多次网络往返的 N+1 查询**，变成**数据库内部一次关联操作**。省掉的是那几趟 round-trip 开销，不是逻辑本身变了。（对比 Week 2 controller 手动多次查询再拼装。）

---

## 2. 任务与四个设计决策

**需求**：按客户分组，输出每个客户的**订单总数、总消费金额、平均订单金额**，只统计**最近 30 天且 `status = completed`** 的订单，按总消费金额**降序**。

| 决策 | 结论 | 理由 |
|---|---|---|
| 管道顺序 | `$match` 放第一站 | 同时吃到索引 + 减少流入 `$group`/`$sort` 的文档量 |
| `$group` 的 `_id` | 分组键用 `customerId`（即 `userId`） | 报表按客户分组；用文档自带 ObjectId 会让每单自成一组，统计无意义 |
| 累加运算符 | 计数 `$sum:1`、总额 `$sum:"$字段"`、均值 `$avg:"$字段"` | 聚合是**声明式**，不是 JS 的 `+=` 循环累加 |
| `$sort` 时机 | 放 `$group` **之后** | 排序键（总额）是 `$group` 算出来的**新字段**，之前不存在 |

> ⚠️ 概念纠偏：**文档的 `_id`**（每个文档默认的 ObjectId，自带唯一索引）与 **`$group` 阶段的 `_id`**（分组键）是两回事，别混。

---

## 3. 环境迁移：Docker 崩溃 → MongoDB Community

> 本日很大一块时间耗在环境上：Docker Desktop 在 Intel Mac 上反复崩溃，最终**彻底放弃容器层**，改用 brew 直装的 MongoDB Community，并配好认证。教训是——学习目标是聚合，不该跟容器较劲；把反复出问题的变量直接移除，比一次次修它更划算。

### 3.1 崩溃现象与根因

- **图标出现问号 `?` + 「自动卸载」是同一件事的两面**：macOS 显示问号 = LaunchServices **找不到应用的可执行文件**（`/Applications/Docker.app` 已不在原位），Dock 里还留着快捷方式所以显示 `?`。即 Docker 主程序确实消失了。
- **为什么会自我卸载**：崩溃触发自我清理 / Gatekeeper 判定损坏而隔离移除 / 盖装残留与新版本冲突启动即崩。
- **根本原因（现实一条）**：Intel Mac。Docker Desktop 近年对 Intel 支持收窄，稳定性问题反复。

### 3.2 决策：绕开 Docker Desktop，直装 MongoDB Community

学习只需要「一个稳定能连的 MongoDB」，不必非 Docker 不可。相比治标的干净重装，选**治本**——移除容器层这个变量：

```bash
brew tap mongodb/brew
brew install mongodb-community

brew services start mongodb-community   # 启动（后台常驻、开机自启）
brew services list                      # 看状态
mongosh                                 # 验证，能进 test> 即成功
```

默认监听 `localhost:27017`，端口与 Docker 时代一致 → **Week 1/2 代码里的连接串一个字不用改**。（想保留容器能力的备选是 Colima：`brew install colima docker`，`colima start`，Intel 上更稳。）

### 3.3 「数据又没了」——其实是换了引擎实例

不是丢，是**换了一个全新的独立 MongoDB 实例**：旧数据在 Docker 卷里，brew 装的实例数据目录在 `/usr/local/var/mongodb`，两套隔离存储，新实例自然是空的。

> 💡 这正是 **seed 脚本的价值**：数据本就是「一条命令随时重造」的，环境可随便换，数据不是手工敲进去的珍贵资产。

### 3.4 认证失败（code 18）与本地开认证

换实例后 app 启动报 `Authentication failed`（`code: 18`）：

**根因** —— 连接串带着 Docker 时代配的 `user:pass@`，而新实例**默认不开认证（no auth）**。客户端拿账密去连，服务器既没开认证也没这个用户 → 握手失败。**不是数据问题，是连接串与新实例的认证配置对不上。**

- **临时通**：去掉凭据 → `MONGODB_URI=mongodb://localhost:27017/week2?authSource=admin`（此时 `authSource` 是空转的冗余参数）。Compass 同理，要删账密才看得到新库。
- ✅ 印证 Week 2「配置与代码分离」：整次换实例只改了一个 `.env` 变量，`db.js` 代码一行没动。

**随后正式开认证（本地对齐生产）**，注意「先有鸡还是先有蛋」——靠 **localhost exception**：开认证后若一个用户都没有，允许从 localhost 无认证连一次，专门用来建第一个管理员。顺序必须是**先建用户 → 再开认证 → 之后都要凭据**：

```js
// 1) 趁未开认证，建管理员（mongosh 内）
use admin
db.createUser({ user: "root", pwd: "***", roles: [{ role: "root", db: "admin" }] })
```

```yaml
# 2) /usr/local/etc/mongod.conf 开启认证（注意 YAML 缩进两空格）
security:
  authorization: enabled
```

```bash
# 3) 重启生效
brew services restart mongodb-community
# 4) 验证：无凭据被拒；带凭据能进
mongosh -u root -p --authenticationDatabase admin
```

```bash
# 5) .env 补回凭据（authSource 此时才真正起作用：数据在 week2，验证去 admin）
MONGODB_URI=mongodb://root:***@localhost:27017/week2?authSource=admin
```

- ⚠️ 密码别提交 git（`.env` 已在 `.gitignore`）。
- ⚠️ 这是**数据库层认证**，和 Week 4 要做的应用层 JWT 是两回事，别混。

### 3.5 环境排障经验小结

| 信号 / 现象 | 含义 | 处置 |
|---|---|---|
| 图标问号 `?` | 系统找不到 app 可执行文件（主程序已没） | 干净重装或换方案 |
| Intel Mac Docker 反复崩 | 官方对 Intel 支持收窄 | 直装 MongoDB Community，移除容器层 |
| 换实例后「数据没了」 | 新引擎 = 新的独立存储 | 跑 seed 重造，别当数据丢失 |
| `Authentication failed` code 18 | 连接串凭据与实例认证配置不匹配 | 对齐：要么去凭据、要么给实例建用户开 auth |
| `authSource=admin` | 只在传凭据时有意义，指定去哪个库验账号 | 开认证后才真正生效 |

---

## 4. Order Schema 建模（引用型）

最终定稿（`week2-express/src/models/orders.js`）：

```js
import mongoose from "mongoose";

const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const Decimal128 = mongoose.Schema.Types.Decimal128;

const orderSchema = new mongoose.Schema(
    {
        // 关联用户（引用型建模，指向 User）
        userId: { type: ObjectId, ref: "User", required: true },
        // 订单状态
        status: {
            type: String,
            enum: ["pending", "completed", "canceled", "refunding", "refunded"],
            default: "pending",
        },
        // 订单总金额（钱用 Decimal128 精确存）
        totalAmount: { type: Decimal128, required: true },
        // 商品信息（子文档数组）
        items: [{
            productId: { type: ObjectId, ref: "Product", required: true },
            name:      { type: String, required: true },
            price:     { type: Decimal128, required: true },
            quantity:  { type: Number, required: true },
        }],
    },
    { timestamps: true } // 自动生成 createdAt / updatedAt
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
```

**建模要点**

- `userId`：`ObjectId` + `ref: "User"`，后续 `$lookup` / `populate` 用得上。
- `totalAmount` / `price`：钱用 `Decimal128`（精确，无 float 误差）；`quantity` 用普通 `Number`。
- `timestamps: true` 放在 **Schema 第二个参数**，聚合按 `createdAt` 筛 30 天。

### 4.1 踩过的坑（都是「静默失效」或直接报错）

| 坑 | 现象 | 正解 |
|---|---|---|
| `Decimal128` 取法错 | `Schema.Decimal128` 是 `undefined` → `totalAmount.type` invalid（ObjectId 碰巧有快捷方式，Decimal128 没有）| 统一走 `mongoose.Schema.Types.Xxx` |
| `type: 'created_at'` | 把「字段名」当成了「字段类型」 | 类型应是 `Date`（这里用 `timestamps` 替代） |
| `require` 拼成少个 d | **不报错、直接被忽略**，约束没生效 | `required` |
| `timestamps: true` 写进字段列表 | 被当成一个叫 `timestamps` 的布尔字段，`createdAt` 根本不生成 | 放 Schema 第二个参数 |
| 子文档 `_id: false` 放成数组第二个元素 | Mongoose 以为 items 有两种子文档结构 | `_id: false` 是子 schema 选项；本周用不到 items，保持默认即可 |

> `items` 本周聚合完全不碰（只用 `totalAmount`/`status`/`createdAt`/`userId`），不必在它上面花时间。

---

## 5. Seed 数据（造对照组）

数据分布必须刻意覆盖**四个对照维度**，否则聚合看不出效果：

1. **多个 `userId`**（用库里真实 user `_id`，否则 `$lookup` 对不上）——分布不均，制造订单数/总额差异。
2. **跨越 30 天边界的 `createdAt`**——一部分 30 天内、一部分更早，验证时间过滤。
3. **混合 `status`**——大部分 `completed`，掺 `pending`/`canceled`/`refunding`/`refunded`。
4. **金额有大有小**——让排序与均值看得出区别。

本次造了 14 条，含一条**边界样本**（`06-06 20:00`，正好落在 30 天边界）。

### 5.1 关键技术点：手动指定 `createdAt`

`timestamps: true` 默认用**插入当下时间**覆盖 `createdAt`，会把精心设计的时间分布全变成今天。解决办法两者配合：

```js
// 1) 算相对时间
new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 天前
// 2) insertMany 时关掉自动时间戳，让手动 createdAt 生效
await Order.insertMany(orders, { timestamps: false });
```

### 5.2 seed 脚本骨架

```js
import mongoose from "mongoose";
import Order from "./models/orders.js"; // ESM 必须带 .js 后缀，文件名逐字符对齐

// mongosh 里 ObjectId() 是全局内置；Node 脚本里没有，且它是 class 必须 new
const ObjectId = (id) => new mongoose.Types.ObjectId(id);

const orders = [ /* ...14 条，userId 用 ObjectId(...)，createdAt 用 new Date(...) ... */ ];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await Order.deleteMany({});                    // 清空，避免重复 seed 越滚越多
        await Order.insertMany(orders, { timestamps: false }); // 保留手动 createdAt
        console.log("seed done");
    } catch (err) {
        console.error("seed failed:", err);
    } finally {
        await mongoose.disconnect();                   // 放 finally：成功失败都要断开
    }
}
seed();
```

运行：`node --env-file=.env seed.js`

### 5.3 踩过的坑

| 坑 | 根因 | 正解 |
|---|---|---|
| `createdAt` 是字符串 | `'20260701 14:00'` 非标准格式，`new Date()` 解析成 `Invalid Date`，`$gte` 比较失效 | 用 `new Date('2026-07-01T14:00:00')` 或 `new Date(2026,6,1,14,0)`（月份从 0 起） |
| `userId` 是字符串 | `$lookup` 不自动 cast，字符串对不上 ObjectId | 显式 `new mongoose.Types.ObjectId('...')` |
| `ERR_MODULE_NOT_FOUND` | ESM 的 import 必须带 `.js`，文件名要逐字符一致 | `./models/orders.js` |
| `uri ... undefined` | seed 是独立入口，不经过 app.js，读不到 env | 用 `node --env-file=.env`（本项目靠原生 `--env-file`，未装 dotenv） |
| `ObjectId is not defined` | mongosh 全局内置，Node 脚本没有 | 顶部自定义 `ObjectId` |
| `Class constructor ObjectId cannot be invoked without 'new'` | Node 里拿到的是原始 class，必须 `new` | 包一层箭头函数 `(id) => new ...ObjectId(id)` |

> 🔑 **mongosh 环境 ≠ Node 脚本环境**：在 mongosh 里能跑的写法（全局 `ObjectId()`、免 `new`）搬到 Node 不一定成立。

### 5.4 时区：存 UTC，比较时统一

`new Date('2026-07-01T14:00:00')`（不带时区后缀）按**本地时间**（UTC+8）解析，MongoDB 一律存 **UTC**，所以查出来是 `2026-07-01T06:00:00.000Z`（差 8 小时）。**这不是 bug。** 只要写聚合时**直接用 Date 对象比较、不手动拆年月日**，两边都转 UTC 统一比，时区自动对齐，切勿手动 +8。

---

## 6. 聚合管道（三阶段）

```js
db.orders.aggregate([
    // 1) 先过滤：等值 status + 范围 createdAt
    { $match: {
        status: "completed",
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }},
    // 2) 分组统计
    { $group: {
        _id: "$userId",                          // 分组键，引用字段值带 $ 前缀
        orderCount:    { $sum: 1 },              // 传常数 1 = 计数
        totalSpending: { $sum: "$totalAmount" }, // 传字段引用 = 求和
        avgOrderValue: { $avg: "$totalAmount" },
    }},
    // 3) 按分组产物排序
    { $sort: { totalSpending: -1 } },            // -1 降序
])
```

**要点**

- `status: "completed"` 等值匹配直接写值，不需要 `$eq`。
- `$sum: 1`（每条加常数）与 `$sum: "$totalAmount"`（对字段求和）是两回事，字段引用**必须带 `$`**。
- `$sort` 能按 `totalSpending` 排，正因为它是 `$group` 的产物、且 `$sort` 在其后。`$group` 之后文档「形状」变了——只剩 `_id` 和新造字段，原始订单字段没了。

### 6.1 先预测、再验证（关键习惯）

今天 `2026-07-06`，往前 30 天 = `2026-06-06`。逐条筛「completed + 最近 30 天」后 **5 条进**，分组降序结果：

| 客户 | 订单数 | 总额 | 均值 |
|---|---|---|---|
| u2 | 1 | **5432.1** ← 第一 | 5432.1 |
| u3 | 2 | 3776.77 | 1888.385 |
| u4 | 1 | 1500 | 1500 |
| u1 | 1 | 1299.99 | 1299.99 |

跑出来一字不差。**预测阶段暴露的两个理解漏洞（当场纠正）：**

1. **排序对象搞混**：排的是 `$group` 后**每个客户的总额**，不是单条订单金额。
2. **被离群大额带偏**：金额最大的 `9800.98` 那条是 `refunding`，第一步 `$match` 就被 status 滤掉了，根本不在候选集。→ 印证「`$match` 先滤，后面不必再考虑不合格的」。

> 💡 Decimal128 预警：结果里 `totalSpending` 显示成 `Decimal128("5432.1")`，正常现象。

---

## 7. Explain 查询优化：COLLSCAN → IXSCAN

对 `$match` 段跑 `.explain("executionStats")`，只看四个指标。

### 7.1 基线（无索引）

```js
db.orders.aggregate([
    { $match: { status: "completed",
        createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } }
]).explain("executionStats")
```

| 指标 | 值 | 含义 |
|---|---|---|
| `stage` | `COLLSCAN` | 全表扫描，没走索引 |
| `totalDocsExamined` | 14 | 全表 14 条都扫了 |
| `nReturned` | 5 | 只要 5 条 |

→ **扫 14 拿 5，浪费 9 条**。数据量小看不出痛，14 万 / 1400 万条时就致命。

### 7.2 建复合索引（ESR 原则）

**ESR：Equality → Sort → Range**，等值字段在前、范围字段在后。

- `status: "completed"` 是**等值** → 放前
- `createdAt: { $gte }` 是**范围** → 放后

```js
db.orders.createIndex({ status: 1, createdAt: 1 })
```

理由：索引像字典排序，先按 `status` 排，`completed` 记录**连续聚在一起**，再在这段里按 `createdAt` 范围切一段，利用率最高；反过来范围在前会打折。

### 7.3 优化后对比

| 指标 | 加索引前 | 加索引后 | 说明 |
|---|---|---|---|
| stage | `COLLSCAN` | `IXSCAN` + `FETCH` | 全表扫描 → 走索引 |
| totalDocsExamined | 14 | **5** | 只取需要的，零浪费 |
| totalKeysExamined | — | 5 | 索引条目也只扫 5 个 |
| nReturned | 5 | 5 | 结果不变，变的是「怎么找到」 |

**读懂三数关系（精髓）：** `totalKeysExamined = totalDocsExamined = nReturned = 5`，三者相等 = **最优索引**，每一步都无浪费。若 keys 远大于 nReturned → 索引扫了无用条目；若 docs 大于 keys → 取了文档又被过滤。

- `IXSCAN` 先在索引里定位到 5 条的位置，`FETCH` 再按位置取完整文档——走索引的标准两步。
- 冷知识：若查询只需索引里已有字段，可省掉 FETCH，叫**覆盖查询（covered query）**；本查询要 `totalAmount` 做 `$group`，省不掉。
- ⚠️ 认知：**小数据量下优化器可能故意不走索引**（觉得全表扫更省事）。今天 14 条仍走了索引是理想情况；索引价值随数据量增大才显著。

---

## 8. Pipeline 固化为 Node 脚本 + Decimal128 序列化问题

`reports.js`（只读，比 seed 更简单）：

```js
import mongoose from "mongoose";
import Order from "./models/orders.js";

async function runReport() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const result = await Order.aggregate([ /* 第 6 节三阶段，原样搬 */ ]);
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("report failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}
runReport();
```

运行 `node --env-file=.env reports.js`，结果顺序与 mongosh 完全一致（u2>u3>u4>u1）。→ **聚合语法从 mongosh 搬到 Node 零障碍**（不像 `ObjectId()` 有环境差异）。

### 8.1 发现的真实工程问题

```json
"totalSpending": { "$numberDecimal": "5432.1" }
```

`Decimal128` 经 `JSON.stringify` 变成**嵌套对象**，且值是**字符串**；`_id`（ObjectId）则被转成普通字符串。若直接把该结果返回前端：

- 不能 `totalSpending + 100`（是对象不是数）
- 直接显示会是 `[object Object]`
- 前端被迫 `.$numberDecimal` 掏出字符串再 `parseFloat` —— 坏味道

**这是 Decimal128「精确」的代价**：存储/计算精确，但**跨序列化边界（DB→Node→JSON→前端）时不是 JS 原生类型，需显式转换**。

**转换该放哪层？** 初步判断放 **service 层**——「具体怎么用」是业务关心的事。和 Week 2「错误翻译分层」「白名单归位 service」是同一类分层思维，留作明天竖切时的正式决策点。

---

## 9. 本日产出与待办

**已完成（本周两个验收物的核心都拿下）：**

1. ✅ 聚合 pipeline —— `$match → $group → $sort`，mongosh 验证 + Node 脚本固化，先预测后验证一致。
2. ✅ explain 索引对比 —— `COLLSCAN → IXSCAN`，`totalDocsExamined` 14 → 5，三数相等 = 最优索引。
3. ✅ 发现 Decimal128 序列化问题（`$numberDecimal`），作为明天分层的伏笔。

**关键决策（记档，防上下文断掉）：**

- 环境：Docker 崩溃后迁到 MongoDB Community（brew），已开认证，`.env` 带凭据 + `authSource=admin`。
- order 在 `week2-express` 上**竖切拓展**（model→repository→service→route），不新建 week3 目录，也不做全套 CRUD。
- 抽离到根目录一事，推迟到 Week 4 认证完成后再作为独立重构。

**待办（Day 2）：**

- [ ] 把 pipeline 竖切进分层架构，做成 `GET /reports/customer-spending`。
- [ ] 决策：Decimal128 → 前端友好格式的转换放哪层（初判 service）。
- [ ] items 若要正式用，改成规范子文档数组并给 `productId` 补 `ref: "Product"`。
