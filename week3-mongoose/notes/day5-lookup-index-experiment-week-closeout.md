# Day 5 · 查询优化收官实验 · `$lookup` 关联无索引字段的「建索引前后」对照 + 本周收尾

> 本周最后一天,主线是把 Day 4 留在 backlog 的**对照实验**亲手做完——故意让 `$lookup` 关联一个**无索引字段**(user 的 `name`),跑 explain 看它全表扫描,再给该字段建索引、跑同一查询看它变快。结果一字不差:`collectionScans` **3 → 0**、`indexesUsed` **`[]` → `["name_1"]`**、`totalDocsExamined` **15 → 0**。这把「关联性能取决于 foreignField 有无索引」从 Day 4 的**概念结论**变成了**亲手验证的数据**,和 Day 1 的 `COLLSCAN → IXSCAN` 是同一把尺子的两个应用。附带记档 Decimal128 转换分层的「没吃透」准确表述,并完成本周收尾(demo 自测、周复盘)。

---

## 1. 今日主线:把 Day 4 的 backlog 做成「眼见为实」

Day 4 已经从原理上讲清了 `$lookup` 性能规律——**关联主键/有索引字段走索引(快),关联无索引字段全表扫描(慢)**——并用客户消费报表关联 `_id` 的 explain 坐实了「快」那一半(`collectionScans: 0` + `indexesUsed: ["_id_"]`)。但「慢」那一半只是**推断**,没亲眼见过。

Day 4 的 backlog 就是补上这个对照:**故意关联一个无索引字段,看它慢;再给它建索引,看它变快。** 今天状态一般,但还是把这个实验完整做出来了——它是本周查询优化最有分量的产出,因为它把「关联性能」从概念变成了**可对比的数据**。

**今日两条线:**

1. 查询优化收官实验(第 2–5 节):对照实验三步法 + 结果对照 + 并入优化笔记 + 清理痕迹。
2. 本周收尾(第 7 节):demo 自测、周复盘落笔,对齐本周验收标准。

---

## 2. 对照实验三步法

> 核心思路和 Day 1 的「加索引前后对比」**完全一样**,只是从「`$match` 筛选」换到「`$lookup` 关联」这个维度。

### 2.1 第一步:造一个「关联无索引字段」的场景

现有的 `$lookup` 关联 user 的 `_id`(有索引,所以快)。要看慢的,得关联一个**没索引的字段**——最简单是关联 user 的 `name`。构造一个纯实验管道(**不接进正式代码**):

```js
db.orders.aggregate([
  { $lookup: {
      from: "users",
      localField: "userId",   // order 的 userId
      foreignField: "name",   // ← 故意关联 user 的 name(没索引!)
      as: "userInfo"
  }}
]).explain("executionStats")
```

> ⚠️ 这个关联在业务上没意义(userId 对 name 根本匹配不上),但**实验目的不是拿到正确结果,是看执行计划**——只关心它怎么访问 users 集合。

### 2.2 第二步:看 explain,应该看到全表扫描

跑上面这段,看 `$lookup` 阶段那两个关键字段(Day 4 刚学会看的):

- `collectionScans`:这次应该 **> 0**——name 没索引,只能扫全表。
- `indexesUsed`:应该是**空的**——没索引可用。

对比 Day 4 关联 `_id` 的结果(`collectionScans: 0` + 用了 `_id_`),差异一目了然:**关联主键走索引(scans=0),关联无索引字段全表扫描(scans>0)。**

### 2.3 第三步:给 `name` 建索引,再跑,看它变快

```js
db.users.createIndex({ name: 1 })
```

然后再跑一遍**同样的** explain。这次 `collectionScans` 应回到 **0**,`indexesUsed` 里出现 `name_1`。**加索引前后的对照就出来了**——和 Day 1 那张 `COLLSCAN → IXSCAN` 的表同一个套路,只是这次落在**关联维度**。

---

## 3. 建索引前后对照(本周查询优化最有分量的一张数据)

同一个「关联 `name`」的 `$lookup` 阶段,建 `name` 索引**前 vs 后**:

| 指标 | 建 `name` 索引**前** | 建 `name` 索引**后** |
|---|---|---|
| `collectionScans` | **3**(全表扫 3 次) | **0** |
| `indexesUsed` | **`[]`**(空,无索引可用) | **`["name_1"]`** |
| `totalDocsExamined` | **15**(扫了整个 users 集合 × 多次) | **0** |
| `executionTimeMillisEstimate` | 12ms | 3ms |

**逐行读:**

- **建索引前**:关联 `name`(没索引)→ `collectionScans: 3`、`indexesUsed: []`、扫 15 个文档 → **全表扫描,慢(12ms)**。
- **建索引后**:`createIndex({ name: 1 })` → 同一查询变成 `collectionScans: 0`、`indexesUsed: ["name_1"]`、`totalDocsExamined: 0` → **走索引,快(3ms)**。
- **对照主键关联(`_id`)**:一直是 `collectionScans: 0` + `indexesUsed: ["_id_"]`——主键自带索引,天生高效。

> 💡 **一个术语细节(面试能用):** winningPlan 里高效的 `_id` 关联显示 `"strategy": "IndexedLoopJoin"`——这是 MongoDB 走索引关联的策略名。关联无索引字段时用不上这个策略,只能退化成扫描。

---

## 4. 完整结论(直接并入查询优化笔记)

> `$lookup` 的性能取决于 `foreignField` 有没有索引:
> - 关联主键 `_id`(自带索引)或已建索引的字段 → 走索引(`IndexedLoopJoin`)、`collectionScans: 0` → 快。
> - 关联无索引字段(如 `name`)→ 全表扫描、`collectionScans > 0`、`indexesUsed` 为空 → 慢。
> - 给关联字段建索引后,同一查询从全表扫描变为走索引(`collectionScans: 3 → 0`、`indexesUsed: [] → ["name_1"]`)。
> - 判断 `$lookup` 性能只需看两个字段:**`collectionScans`(应为 0)** 与 **`indexesUsed`(应非空)**。

**这和 Day 1 的 `$match` 优化(`COLLSCAN → IXSCAN`)是同一个道理的两个应用:** `$match` 靠索引避免扫全表,`$lookup` 靠 foreignField 的索引避免扫关联集合。**「该查的字段建索引」是贯穿两者的统一原则。**

**查询优化笔记至此三块素材齐了:**

- Day 1:`$match` 加索引前后(`COLLSCAN → IXSCAN`)。
- Day 4:`$lookup` 关联主键高效(`collectionScans: 0`)。
- Day 5:`$lookup` 关联无索引字段的对照(建索引前后 `3 → 0`)。

这是本周验收物「查询优化笔记」非常扎实的核心。

---

## 5. 清理实验痕迹(别污染正式代码)

实验用的东西做完就清掉:

```js
db.users.dropIndex("name_1")   // 删掉为实验建的 name 索引
```

- 管道里那个「关联 `name`」的第二个 `$lookup` 是纯实验用,删掉,别留在正式代码里。
- 正式报表的 `$lookup` 仍关联 `_id`(走 `_id_` 主键索引),不受影响。

---

## 6. 附:Decimal128 转换分层——「没吃透」的准确表述

承接 Day 1/Day 2 埋的伏笔。目前把 Decimal128 → number 的转换放在 **service 出口**(`Number(totalSpending.toString())`),能跑、也合理。「没吃透」是因为存在一个**更规范的方案**还没接触,心里没底「我这样是不是最优」。

**现在的做法:** service 从 repository 拿到含 Decimal128 的原始数据,返回前转成 number。转换逻辑**散落在每个 service 方法里**(客户报表转一次、月度报表转一次,代码重复)。

**更规范的方案:DTO / 序列化层。** DTO(Data Transfer Object)是一个**专门定义「对外返回长什么样」的层**:不在 service 里零散地转,而是集中把「内部数据模型」转成「对外响应格式」——`Decimal128 → number`、`_id → userId`、剔除 `__v`,**全在这一层统一做**。

| 维度 | 现在(service 出口转) | DTO / 序列化层 |
|---|---|---|
| 重复 | 每个 service 方法各写一遍 | 集中处理,写一次 |
| 职责 | service 兼了「表示层转换」,不够纯 | service 专注业务,序列化交给 DTO |
| 对外契约 | 隐式、分散 | DTO 明确定义返回哪些字段、什么类型 |

**为什么现在不做、也不该现在做:** 只有 2–3 个报表,重复不严重,放 service 够用;DTO 是「接口多了、重复明显了」才值得引入的抽象,**过早引入是过度设计**,更适合 Week 8 整合时或接口规模上来后再重构。

> 📌 **进复盘的准确表述**:「Decimal128 转换目前放在 service 出口,能用但有重复;了解到更规范的做法是引入 DTO/序列化层统一处理对外格式转换,但当前接口少、暂不需要,留待规模变大或 Week 8 整合时再考虑。」——这种「知道有更好的、也知道现在为什么不用」的**带理解的未解决**,比单纯「不会」有价值。

---

## 7. 本周收尾(收尾 + 平铺)

对齐 `week3-plan.md` 的 Day 5 任务与本周验收标准:

- ✅ **补齐笔记**:Day 1–5 笔记成篇;查询优化笔记素材齐(§4 三块)。
- ✅ **demo 自测**:按 `week3-demo-script.md` 跑通,三个报表接口可演示。
- ✅ **周复盘落笔**:`week3-retrospective.md` 中文稿已填(关键点 A 收录了本日 `name` 索引对照实验的 `collectionScans: 3 → 0` 数据)。

**本周验收标准回看(全部达成):**

1. ✅ 2–3 个复杂聚合场景 + 关联查询能跑 —— 达 3 个(客户消费 / `$lookup` 关联 / 月度趋势)。
2. ✅ 一篇查询优化笔记,能讲清各阶段与索引对 explain 的影响 —— Day 1(`COLLSCAN → IXSCAN`)+ Day 4/5(`$lookup` 关联性能判读 + 建索引前后对照)。
3. ✅ 能脱离 AI 从空白重建一个聚合 demo —— 月度趋势报表为 Day 3 独立设计。

---

## 8. 本日产出与待办

**已完成(查询优化实验收官):**

1. ✅ 对照实验落地:关联无索引 `name`,explain 见全表扫描(`collectionScans: 3`、`indexesUsed: []`);建 `name` 索引后同一查询走索引(`collectionScans: 0`、`indexesUsed: ["name_1"]`)。
2. ✅ 提炼完整结论并入查询优化笔记:`$lookup` 性能取决于 `foreignField` 有无索引;判读只看 `collectionScans` 与 `indexesUsed`。
3. ✅ 清理实验痕迹:`dropIndex("name_1")` + 删掉实验用的第二个 `$lookup`。
4. ✅ 记档 Decimal128 转换分层的「没吃透」准确表述(DTO/序列化层,留待 Week 8)。
5. ✅ 本周收尾:demo 自测通过,周复盘中文稿落笔。

**关键结论(记档):**

> 关联无索引字段的 `$lookup` 会全表扫描(`collectionScans > 0`、`indexesUsed` 为空);给该字段建索引后同一查询走索引(`collectionScans: 3 → 0`、`indexesUsed: [] → ["name_1"]`)。判断 `$lookup` 性能的关键字段:`collectionScans`(应为 0)与 `indexesUsed`(应非空)。这是 Day 1「加索引前后」套路用在**关联维度**上的完整对照,查询优化笔记就此有了「关联性能」这个有分量的章节。

**待办 / backlog(顺延至后续周):**

- [ ] **`$lookup` 子管道(sub-pipeline)优化**:现在是关联整个 user 文档再靠 `$project` 裁剪,直觉上「先全搬进内存再裁」有浪费;验证 `$lookup` 的 pipeline 形式(关联阶段就用子管道只取 `name`/`email`),用 explain 对比改造前后的文档处理量。(已作为周复盘「还没吃透的问题」,留 Week 6 技术总结时深挖。)
- [ ] **Decimal128 → DTO/序列化层重构**:当前放 service 出口够用,接口规模上来或 Week 8 整合时再引入 DTO 层统一转换。
