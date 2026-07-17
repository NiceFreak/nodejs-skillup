# Week 3 周复盘 · 聚合与测试(7/6–7/10)

## 1. 本周做了什么

- 完成 3 个聚合报表并全部竖切成真实接口:客户消费(`$match→$group→$sort`)、`$lookup` 关联(带客户名)、月度趋势(按 `$year`/`$month` 分组,独立设计)。
- 补齐 populate/N+1 对比、单元测试(validateStatus)与集成测试(mongodb-memory-server + Supertest),以及索引 / `$lookup` 的 explain 优化实验。

---

## 2. 最关键的 1–2 点

### 关键点 A:查询优化不是玄学,是"该查的字段有没有索引"这一件事

- **原来我以为**:查询优化是一种模糊的、要靠经验直觉的东西;"加索引会变快"是听来的口号,没有具体的度量。而且我一度以为 user 的 `_id` 没有索引。
- **现在我理解**:优化是可测量、可对比的。explain 里 `collectionScans`、`indexesUsed`、`totalDocsExamined` 就是硬指标。而"该查的字段要有索引"是贯穿 `$match` 和 `$lookup` 的同一条原则——不是两个知识点,是一件事的两个应用。`_id` 永远自带唯一索引,这是主键关联天然快的原因。
- **判据 / 一个具体例子**:同一个关联 `name` 字段的 `$lookup`,建索引前 `collectionScans:3`、`indexesUsed:[]`、扫 15 个文档;`createIndex({name:1})` 之后,同一查询变成 `collectionScans:0`、`indexesUsed:["name_1"]`、扫 0 个文档。判断 `$lookup` 快不快,只看这两个字段就够。

### 关键点 B:聚合逻辑该落在哪一层,不是"整块归一处",而要拆成"意图"和"实现"

- **原来我以为**:聚合管道是一个完整的东西,应该整块放在某一层(我一开始以为放 service,因为"它表达了业务要什么")。
- **现在我理解**:聚合管道其实混了两件事——"要一份怎样的报表"(业务意图)和"具体怎么从库里查"(实现细节)。前者归 service,后者(那段 `aggregate([...])` 代码)归 repository。判断依据和 Week 2 的"错误码只在 repository 翻译""白名单归位 service"是同一套:问这是"数据库实现细节"还是"业务规则"。
- **判据 / 一个具体例子**:"最近 6 个月"这个数字是业务规则,由 service 持有并算出时间边界;那条 `$match→$group→$lookup` 管道是查询实现,写在 repository。service 只传"算好的 date + status"给 repository,不关心管道怎么写。

---

## 3. 关于我自己的一个观察

- **「套模板漏核心」pattern**:一天内复现 3 次——聚合复制上一题残留了无关的 `userId` 字段;service 把参数名改成了 `months` 但计算公式还是按天(`* 24*60*60*1000`);controller 函数名改对了却调用了错误的 service(`getCustomerSpendingReport` 而非月度那个)。共同点都是"改了外壳、漏了里子"。
- **对治方法**:套用旧模板后,不直接往下写,而是先停一下,逐一核对"这个新需求和上一个,业务上到底哪几处不同"(分组维度?时间跨度?调用的下游?),确认每处都改到位再继续。
- **下周怎么练**:W4 做认证时会大量复用 Week 2/3 的分层结构(中间件、错误类、service 模式)。我打算刻意在每次复制一段旧代码后,写一行注释列出"和原来不同的点",强制自己显式确认差异,而不是默认"改改就行"。

---

## 4. 一个还没吃透的问题

我的问题是:**`$lookup` 的子管道(sub-pipeline)优化,到底值多少、怎么写。**

- **我卡在哪**:现在我的 `$lookup` 是把整个 user 文档关联进来(含 age/addresses/`__v`),再靠 `$project` 把不要的丢掉。这在数据量小时无所谓,但"先全搬进内存、再裁剪"直觉上是浪费。
- **我猜是什么**:`$lookup` 应该支持在关联阶段就用一个子管道(pipeline + `$project`)只取 `name`/`email`,这样不把整个文档搬进内存,尤其 user 文档很大时能省内存和传输。
- **下周想怎么验证**:查 `$lookup` 的 pipeline 形式写法,改造客户消费报表用子管道只取需要的字段,再用 explain 对比改造前后的文档处理量 / 内存指标,看差距到底有多大——就像这周做的索引对照实验一样,用数据说话而不是凭直觉。

> 译写提示:不用逐句翻译。用英文重写 §2–§4 的核心,当作 W6 技术总结的素材。保持"understanding shift"的写法:*I used to think… Now I understand… because…*

### What I built (2–3 lines)
- Built three aggregation reports and wired each one end-to-end into a real layered API: customer spending (`$match → $group → $sort`), a `$lookup`-joined report (with customer names), and a monthly-trend report (grouped by `$year`/`$month`, designed from scratch with no guidance).
- Rounded them out with a populate/N+1 comparison, unit tests (`validateStatus`), integration tests (mongodb-memory-server + Supertest), and `explain`-driven optimization experiments on both indexes and `$lookup`.

### The key insight(s)
- **Query optimization isn't a dark art — it's the single question of "does the field you query have an index?"** I used to think optimization was a fuzzy, intuition-and-experience thing, and "adding an index makes it faster" was just a slogan with no measurement behind it (I even wrongly believed a user's `_id` had no index). Now I understand it's measurable and comparable: `explain`'s `collectionScans`, `indexesUsed`, and `totalDocsExamined` are hard numbers, because "the field you query needs an index" is one principle running through both `$match` and `$lookup` — not two facts but two applications of one. Concrete proof: the same `$lookup` on `name` went from `collectionScans: 3`, `indexesUsed: []`, 15 docs examined to `collectionScans: 0`, `indexesUsed: ["name_1"]`, 0 docs examined after a single `createIndex({ name: 1 })`. (`_id` is always auto-indexed, which is why joining on a primary key is fast by default.)
- **Where aggregation logic belongs isn't "one whole block in one layer" — it splits into intent vs. implementation.** I used to think a pipeline was one indivisible thing that should sit entirely in the service (because "it expresses what the business wants"). Now I understand a pipeline actually mixes two things — *what report do I want* (business intent) and *how do I fetch it from the DB* (implementation detail) — because the same test I used in Week 2 ("error codes only get translated in the repository", "whitelisting belongs in the service") applies here: ask whether something is a DB implementation detail or a business rule. Concrete: "last 6 months" is a business rule the service owns and turns into a date boundary; the `$match → $group → $lookup` pipeline is query implementation and lives in the repository. The service just hands the repository a computed `date + status` and never cares how the pipeline is written.

### A pattern I noticed about myself
- **"Copy the template, miss the core"** — I hit this three times in one day: an aggregation kept a leftover `userId` field from the previous problem; a service renamed its parameter to `months` but still computed by days (`* 24*60*60*1000`); a controller got the function name right but called the wrong service (`getCustomerSpendingReport` instead of the monthly one). Same shape every time: I changed the shell and missed the guts. The fix I'm carrying into Week 4 (auth reuses a lot of the Week 2/3 layering) is to pause after copying any old block and write one comment line listing exactly what differs from the original — forcing myself to confirm the differences explicitly instead of assuming "a few tweaks will do."

### One thing I haven't fully grasped
- **How much `$lookup` sub-pipeline optimization is worth, and how to write it.** Right now my `$lookup` pulls the whole user document (age, addresses, `__v`) and then drops the unwanted fields with `$project`. That's fine at small scale, but "load everything into memory first, then trim" intuitively feels wasteful. My guess is `$lookup` supports a sub-pipeline (pipeline + `$project`) that fetches only `name`/`email` at the join stage, so the full document never enters memory — which should matter most when the user document is large. Next week I want to verify it: rewrite the customer-spending report to use a sub-pipeline, then use `explain` to compare docs-examined / memory before and after — proving it with data, the same way this week's index experiment did, instead of trusting intuition.
