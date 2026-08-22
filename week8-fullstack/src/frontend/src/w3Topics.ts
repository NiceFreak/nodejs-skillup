// 「MongoDB 建模、聚合与查询优化 · 复习板」数据源（展示资产，纯前端静态数据）。
// 只搬运已经完成并验收的结论，不补写新实现；仍未澄清 / 未验证的部分
// 单独进「开放问题」面板，如实标注，不伪装成已掌握。
//
// 2026-08-22 起本板同时承载 W1 的三个知识点（建模决策、最左前缀、覆盖查询）——
// 它们此前只存在于 week1-mongodb 的笔记里，展板上没有形态。W1 的索引实验跑在
// mongosh 手工造的 bigdata 集合（50000 文档）上，W3 的实验跑在项目的 orders /
// users 集合上，两者样本不同，各自的 source 与 reviewNote 都写明了这一点。
//
// 主要来源：week1-mongodb/notes/day1-data-modeling.md、day2-3-index.md；
// week3-mongoose/notes/day1-aggregation.md、day4/day5-lookup-index-*、
// week3-retrospective.md、DEBT.md。

export interface KnowledgeBase {
  id: string;
  label: string;
  title: string;
  question: string;
  judgment: string;
  mapping: string;
  evidence: string[];
  source: string;
  // 口径提示：把结论限定为「当前实验的有效证据」，避免被读成通用性能判据。
  // 对所有观众可见（展示 / 复习都显示），凡本周回看清单上的结论都挂一条。
  reviewNote?: string;
}

// explain 前后对照（$match 复合索引 / $lookup 关联性能共用一种结构）
export interface ExplainKnowledge extends KnowledgeBase {
  kind: "explain";
  createIndex: string;
  stageBefore: string;
  stageAfter: string;
  metrics: Array<{ label: string; before: string; after: string; highlight?: boolean }>;
  keyPoint: string;
}

// 聚合分层：意图（service）vs 实现（repository）
export interface LayeringKnowledge extends KnowledgeBase {
  kind: "layering";
  lanes: Array<{ name: string; owner: string; holds: string[]; tone: "intent" | "impl" }>;
  handoff: string;
  test: string;
}

// 自然月边界：$gte / $lt 半开区间
export interface MonthKnowledge extends KnowledgeBase {
  kind: "month";
  segments: Array<{ label: string; bound: string; state: "in" | "edge-open" | "out" }>;
  rule: string;
  pitfall: string;
}

/**
 * 一份文档在某个 stage 之后的形状。
 * state 描述这个字段在**这一步**发生了什么：kept 原样带下去、added 这一步新生成、
 * dropped 这一步消失（画成划掉，只在消失的那一步出现一次）、changed 形状变了但名字没变。
 * 全部由 repositories/users.js 的 getCustomerSpending() 管道逐行读出，不是示意。
 */
export interface DocShape {
  /** 这一步之后「一条文档」代表什么——多重性变化和字段变化一样是结论。 */
  multiplicity: string;
  fields: Array<{ name: string; state: "kept" | "added" | "dropped" | "changed"; from?: string }>;
}

export interface AggregationPipelineKnowledge extends KnowledgeBase {
  kind: "pipeline";
  /** 进入管道之前的原始文档形状。 */
  origin: DocShape;
  stages: Array<{
    operator: string;
    purpose: string;
    input: string;
    output: string;
    keeps: string;
    docShape: DocShape;
  }>;
  observation: string;
  proves: string;
  limits: string;
}

/** 建模决策：嵌入 / 引用 / 快照三种手段，按四个维度取舍（W1）。 */
export interface ModelingKnowledge extends KnowledgeBase {
  kind: "modeling";
  dimensions: Array<{ name: string; ask: string; leansTo: string }>;
  options: Array<{ name: string; how: string; fit: string }>;
  decisions: Array<{
    relation: string;
    choice: "嵌入" | "引用" | "快照" | "中间表";
    why: string;
    dims: string[];
  }>;
  counterExample: string;
}

/** 最左前缀：同一个复合索引服务哪些查询（W1）。 */
export interface PrefixKnowledge extends KnowledgeBase {
  kind: "prefix";
  dataset: string;
  createIndex: string;
  queries: Array<{
    tag: string;
    query: string;
    hitIndex: string;
    bounds: string;
    docsExamined: number;
    nReturned: number;
    usable: "prefix-full" | "prefix-partial" | "other-index";
  }>;
  control: { action: string; result: string; conclusion: string };
  rule: string;
  ordering: string;
}

/** 覆盖查询：字段全在索引里时免回表（W1）。 */
export interface CoveredKnowledge extends KnowledgeBase {
  kind: "covered";
  dataset: string;
  query: string;
  plan: string[];
  metrics: Array<{ label: string; value: string; highlight?: boolean }>;
  reverse: { action: string; plan: string[]; metric: string; reason: string };
  conditions: string[];
}

export type W3Knowledge =
  | ExplainKnowledge
  | LayeringKnowledge
  | MonthKnowledge
  | AggregationPipelineKnowledge
  | ModelingKnowledge
  | PrefixKnowledge
  | CoveredKnowledge;

// 排序按「概念递进」而非「哪天学的」，分三段：
// 先存对（① 建模决策：数据放在一个文档里还是分开），
// 再写对（② 分层归位 → ③ pipeline 形状 → ④ 自然月边界），
// 最后调快（⑤ explain 三数入门 → ⑥ 最左前缀 → ⑦ 覆盖查询 → ⑧ $lookup 外键索引）。
// ⑤–⑧ 是「该查的字段要有索引」同一原则的四次应用，⑤ 是读 explain 的入门，其余依赖它。
export const W3_KNOWLEDGE: W3Knowledge[] = [
  {
    id: "modeling",
    label: "知识点 1",
    title: "建模决策：嵌入、引用还是快照",
    question: "一个用户有多个收货地址，一个用户也有多个订单。同样是一对多，为什么一个嵌入、一个引用？",
    kind: "modeling",
    dimensions: [
      { name: "量级", ask: "这组子数据有没有增长上限？", leansTo: "无上限增长 → 引用（文档有 16MB 上限）" },
      { name: "独立查询", ask: "子数据会脱离父文档单独查吗？", leansTo: "会 → 引用" },
      { name: "是否共享", ask: "同一份数据会被多个文档引用吗？", leansTo: "会 → 引用" },
      { name: "定格历史", ask: "需要保留某一刻的事实吗？", leansTo: "需要 → 快照" },
    ],
    options: [
      { name: "嵌入 embed", how: "子数据直接放进父文档", fit: "一对少、总是一起读、不被共享" },
      { name: "引用 reference", how: "子数据独立成文档，用 id 关联", fit: "一对多、可能无上限增长、需独立查询" },
      { name: "快照 snapshot", how: "复制一份定格的数据嵌入，不随源数据变化", fit: "需要固定历史事实，如成交价" },
    ],
    decisions: [
      {
        relation: "订单 ↔ 用户",
        choice: "引用",
        why: "一个用户的订单数无上限增长，每个订单必须是独立文档；order 存 userId。",
        dims: ["量级无上限", "订单需独立查询"],
      },
      {
        relation: "用户 ↔ 收货地址",
        choice: "嵌入",
        why: "地址数量有上限，总是和用户一起读，且只属于当前用户。三个维度同时指向嵌入。",
        dims: ["量级有上限", "不独立查询", "不共享"],
      },
      {
        relation: "订单 ↔ 商品价格与收货地址",
        choice: "快照",
        why: "下单那一刻的价格与地址要固定下来，之后商品涨价、地址被改或删除都不影响历史订单。",
        dims: ["需要定格历史"],
      },
      {
        relation: "学生 ↔ 课程（多对多）",
        choice: "中间表",
        why: "一条选课记录一个文档 { courseId, studentId }，两个本体都不存关系数组；选课只写一处，双向查询各查中间表的一个字段。",
        dims: ["两侧都可能无上限", "关系只存一处"],
      },
    ],
    counterExample:
      "收货地址是一对多，结论却是嵌入。按「一对多就引用」这条简化规则会做出错误设计：一对多只是起点，量级、是否独立查询、是否共享才是判断依据。",
    judgment:
      "嵌入与引用的选择不由「一对多还是一对少」单独决定，而由量级上限、是否独立查询、是否被共享三个维度共同决定；需要固定历史事实时用快照，它是嵌入的一个变体。",
    mapping:
      "week2-express/src/models/users.js 至今保持这个决定：addresses 是嵌入的子文档数组，订单在 models/orders.js 里用 userId 引用；W3 的 $lookup 报表正是在这条引用关系上做的关联。",
    evidence: [
      "users 集合的 addresses 字段是嵌入数组，每个元素含 recipient / phone / province / city / detailAddress。",
      "orders 集合每条文档存 userId 引用 users，W3 报表用 $lookup localField: _id / foreignField: _id 关联。",
      "多对多的最终版删掉了 student / course 两侧的 arrangementIds 数组：关系存两处会导致一次选课写三处，任一处失败即不一致。",
    ],
    source: "Week1 · Day1 MongoDB 基础与数据建模（§1、§2、§4）",
  },
  {
    id: "layering",
    label: "知识点 2",
    title: "聚合分层：意图 vs 实现",
    question: "聚合管道该整块放一层，还是拆开？",
    kind: "layering",
    lanes: [
      {
        name: "Service · 业务意图",
        owner: "要一份怎样的报表",
        holds: ["「最近 6 个月」是业务规则", "由此算出时间边界 date", "组织参数 { date, status }"],
        tone: "intent",
      },
      {
        name: "Repository · 查询实现",
        owner: "具体怎么从库里查",
        holds: ["那段 aggregate([...]) 管道", "$match → $group → $lookup", "只接收算好的 date + status"],
        tone: "impl",
      },
    ],
    handoff: "Service 只把算好的 { date, status } 交给 Repository，不关心管道怎么写；管道变了 Service 不用改。",
    test: "判据：问「这是数据库实现细节，还是业务规则」——规则归 service，管道归 repository。",
    judgment: "聚合管道混了两件事：要怎样的报表（意图，归 service）和怎么查（实现，归 repository），要拆开而不是整块归一处。",
    mapping: "和 Week2 的「错误码只在 repository 翻译」「白名单归位 service」是同一套判据。",
    evidence: [
      "「最近 6 个月」这个数字是业务规则，由 service 持有并算出时间边界。",
      "$match → $group → $lookup 管道是查询实现，写在 repository。",
      "service 传「算好的 date + status」给 repository，不关心管道怎么写。",
    ],
    source: "Week3 · 周复盘 关键点 B",
  },
  {
    id: "aggregation-shape",
    label: "知识点 3",
    title: "聚合 pipeline：阶段顺序改变数据形状",
    question: "每个 stage 收到什么形状，又必须交给下一步什么字段？",
    kind: "pipeline",
    origin: {
      multiplicity: "一条 = 一个订单",
      fields: [
        { name: "_id", state: "kept" },
        { name: "userId", state: "kept" },
        { name: "status", state: "kept" },
        { name: "createdAt", state: "kept" },
        { name: "totalAmount", state: "kept" },
      ],
    },
    stages: [
      {
        operator: "$match",
        purpose: "先缩小候选订单",
        input: "Order { userId, status, createdAt, totalAmount, ... }",
        output: "eligible Order { userId, totalAmount, ... }",
        keeps: "后续分组仍需要 userId 与 totalAmount",
        docShape: {
          multiplicity: "一条 = 一个订单（条数减少，形状不变）",
          fields: [
            { name: "_id", state: "kept" },
            { name: "userId", state: "kept" },
            { name: "status", state: "kept" },
            { name: "createdAt", state: "kept" },
            { name: "totalAmount", state: "kept" },
          ],
        },
      },
      {
        operator: "$group",
        purpose: "按用户汇总",
        input: "eligible Order × N",
        output: "{ _id: userId, orderCount, totalSpending, avgOrderValue }",
        keeps: "原订单字段消失，_id 变成分组键",
        docShape: {
          multiplicity: "一条 = 一个用户",
          fields: [
            { name: "_id", state: "changed", from: "分组键，值来自 $userId" },
            { name: "orderCount", state: "added", from: "$sum: 1" },
            { name: "totalSpending", state: "added", from: "$sum: $totalAmount" },
            { name: "avgOrderValue", state: "added", from: "$avg: $totalAmount" },
            { name: "userId", state: "dropped" },
            { name: "status", state: "dropped" },
            { name: "createdAt", state: "dropped" },
            { name: "totalAmount", state: "dropped" },
          ],
        },
      },
      {
        operator: "$lookup",
        purpose: "关联 users",
        input: "group result",
        output: "group result + userInfo[]",
        keeps: "localField _id 对 foreignField _id",
        docShape: {
          multiplicity: "一条 = 一个用户",
          fields: [
            { name: "_id", state: "kept" },
            { name: "orderCount", state: "kept" },
            { name: "totalSpending", state: "kept" },
            { name: "avgOrderValue", state: "kept" },
            { name: "userInfo[]", state: "added", from: "users 集合中 _id 匹配的文档，装进数组" },
          ],
        },
      },
      {
        operator: "$unwind",
        purpose: "展开单个用户",
        input: "userInfo[]",
        output: "userInfo { name, email, ... }",
        keeps: "后续可直接读取 userInfo.name / email",
        docShape: {
          multiplicity: "一条 = 一个用户",
          fields: [
            { name: "_id", state: "kept" },
            { name: "orderCount", state: "kept" },
            { name: "totalSpending", state: "kept" },
            { name: "avgOrderValue", state: "kept" },
            { name: "userInfo{}", state: "changed", from: "数组展开成单个对象" },
          ],
        },
      },
      {
        operator: "$project",
        purpose: "塑造报表 DTO",
        input: "group result + userInfo",
        output: "{ userId, customerName, customerEmail, orderCount, totalSpending, avgOrderValue }",
        keeps: "移除 _id，只暴露报表所需字段",
        docShape: {
          multiplicity: "一条 = 一个用户（报表一行）",
          fields: [
            { name: "orderCount", state: "kept" },
            { name: "totalSpending", state: "kept" },
            { name: "avgOrderValue", state: "kept" },
            { name: "userId", state: "added", from: "$_id 重命名回来" },
            { name: "customerName", state: "added", from: "$userInfo.name" },
            { name: "customerEmail", state: "added", from: "$userInfo.email" },
            { name: "_id", state: "dropped" },
            { name: "userInfo{}", state: "dropped" },
          ],
        },
      },
      {
        operator: "$sort",
        purpose: "按总消费额降序",
        input: "report DTO × N",
        output: "同形状 DTO，totalSpending: high -> low",
        keeps: "只改变顺序，不再改变字段形状",
        docShape: {
          multiplicity: "一条 = 一个用户（按 totalSpending 降序）",
          fields: [
            { name: "orderCount", state: "kept" },
            { name: "totalSpending", state: "kept" },
            { name: "avgOrderValue", state: "kept" },
            { name: "userId", state: "kept" },
            { name: "customerName", state: "kept" },
            { name: "customerEmail", state: "kept" },
          ],
        },
      },
    ],
    observation: "当前 repository 中的 customer spending 管道按上述六步执行，并产出按 totalSpending 降序排列的客户报表 DTO。",
    proves: "代码顺序与字段依赖能解释为什么 $group 后不能再直接读取原订单字段，以及为什么 $lookup / $project 必须位于当前相对位置。",
    limits: "结构图不证明当前数据下的数值正确，也不证明该顺序在任意数据规模上性能最优；性能仍需带过滤条件、索引和数据规模查看 explain。",
    judgment: "每经过一个聚合 stage，都先重画当前 document 形状；下一阶段只能使用当前仍存在或新生成的字段。",
    mapping: "用于 review customer spending 报表时，从字段依赖反推 stage 顺序，避免把 pipeline 当成可任意调换的操作符列表。",
    evidence: [
      "week2-express/src/repositories/users.js 的 getCustomerSpending() 当前实现。",
      "$group 后输出只保留 _id 与三个聚合字段；$lookup 使用这个 _id 关联 users._id。",
      "$project 形成前端报表需要的最终字段，$sort 只按 totalSpending 改变行顺序。",
    ],
    source: "Week3 聚合笔记 + 当前 getCustomerSpending() repository 实现",
  },
  {
    id: "month-boundary",
    label: "知识点 4",
    title: "自然月边界：$gte / $lt 半开区间",
    question: "「最近 N 个月」的时间边界怎么切才不重不漏？",
    kind: "month",
    segments: [
      { label: "更早的月份", bound: "< 起点", state: "out" },
      { label: "起点：当月往前数 N-1 个月的月初", bound: "$gte 月初", state: "in" },
      { label: "窗口内的自然月", bound: "计入", state: "in" },
      { label: "下月初", bound: "$lt 下月初", state: "edge-open" },
    ],
    rule: "自然月用 $gte 月初、$lt 下月初的半开区间；起点从当月月初往前移动 N-1 个月。半开区间保证边界既不重复也不遗漏。",
    pitfall:
      "滚动窗口（按天 × 毫秒）和自然月契约是两种不同需求，先分清要哪种。曾把 $lt / $lte 的选择误判成性能问题——它其实是边界语义问题（已记 DEBT，第一档重建通过）。",
    judgment: "先确认要「滚动 N 天」还是「自然 N 月」；自然月就用 $gte 月初 / $lt 下月初，起点移动 N-1 个月。",
    mapping: "任何「按月 / 按自然周期」的报表边界都用这套半开区间，避免跨月重复统计或漏统计。",
    reviewNote:
      "半开区间的结论已通过；但 months=6 的具体边界样例与时区语义仍在本周回看清单上，未在此下最终结论。",
    evidence: [
      "月度趋势报表按 $year / $month 分组，独立设计。",
      "起点 = 当前月往前移动 months - 1；区间为 [月初, 下月初) 半开。",
      "DEBT 记档：首次脱离提示时把 $lt / $lte 误判为性能问题，第一档重建已通过、待补掌握证据。",
    ],
    source: "Week3 · 月度趋势报表 + DEBT #1",
  },
  {
    id: "match-index",
    label: "知识点 5",
    title: "explain 三数与复合索引",
    question: "同样返回 5 条，加索引后为什么更快？",
    kind: "explain",
    createIndex: "createIndex({ status: 1, createdAt: 1 })",
    stageBefore: "COLLSCAN（全表扫描）",
    stageAfter: "IXSCAN + FETCH（走索引）",
    metrics: [
      { label: "totalDocsExamined", before: "14", after: "5", highlight: true },
      { label: "totalKeysExamined", before: "—", after: "5" },
      { label: "nReturned", before: "5", after: "5" },
    ],
    keyPoint:
      "在这条查询里，三数相等（keys = docs = nReturned = 5）说明每一步都没多扫——它是「这次没有浪费」的证据，不是「三数相等就等于最优索引」的通用判据。等值字段 status 放前、范围字段 createdAt 放后（ESR）在本例利用率最高。",
    judgment: "读这条查询的 explain：stage 与三数关系能看出有没有多扫，keys≫nReturned 说明扫了无用条目。它是读 explain 的入口指标，不是判断所有查询快慢的唯一标准。",
    reviewNote:
      "explain / index 结论仍在本周回看清单上（见 LEARNING-STATE）；这里按「当前实验的有效证据」看待，未推广成通用性能判据。",
    mapping: "报表 / 列表接口按 status + 时间过滤时，建 { 等值, 范围 } 复合索引，把 COLLSCAN 变成 IXSCAN。",
    evidence: [
      "无索引：COLLSCAN，totalDocsExamined 14，nReturned 5（扫全表只取 5 条）。",
      "建复合索引后：IXSCAN + FETCH，totalKeysExamined = totalDocsExamined = nReturned = 5。",
      "结果条数不变，变的是「怎么找到」——零浪费。",
    ],
    source: "Week3 · Day1 聚合与 explain 优化笔记",
  },
  {
    id: "prefix",
    label: "知识点 6",
    title: "最左前缀：一个复合索引服务哪些查询",
    question: "建了复合索引 { city: 1, age: 1 }，只按 age 查能不能用上它？",
    kind: "prefix",
    dataset: "mongosh 手工造的 bigdata 集合，50000 文档；集合上另有一个单字段索引 age_1",
    createIndex: "createIndex({ city: 1, age: 1 })",
    queries: [
      {
        tag: "A",
        query: 'find({ city: "Guangzhou" })',
        hitIndex: "city_1_age_1",
        bounds: "city [\"Guangzhou\"]，age [MinKey, MaxKey]",
        docsExamined: 16667,
        nReturned: 16667,
        usable: "prefix-partial",
      },
      {
        tag: "B",
        query: 'find({ city: "Guangzhou", age: 42 })',
        hitIndex: "city_1_age_1",
        bounds: "city [\"Guangzhou\"]，age [42, 42]",
        docsExamined: 334,
        nReturned: 334,
        usable: "prefix-full",
      },
      {
        tag: "C",
        query: "find({ age: 42 })",
        hitIndex: "age_1",
        bounds: "age [42, 42]",
        docsExamined: 1000,
        nReturned: 1000,
        usable: "other-index",
      },
    ],
    control: {
      action: 'dropIndex("age_1") 后重跑 C，排除单字段索引的干扰',
      result: "stage COLLSCAN，totalKeysExamined 0，totalDocsExamined 50000",
      conclusion: "复合索引服务不了非最左字段的查询。C 之前能走索引，靠的是单独建过的 age_1。",
    },
    rule:
      "复合索引 { city, age } 能服务「查 city」和「查 city + age」，服务不了「只查 age」。判断依据是 totalDocsExamined，不是「有没有走索引」：A 也走了索引，却把广州的 16667 条全扫了，因为 age 段是 [MinKey, MaxKey]。",
    ordering:
      "字段顺序的取舍：先匹配实际查询的前缀形态（硬约束），在满足前缀的前提下再让选择性高的字段靠左（次级依据）。只按选择性排而不匹配前缀，索引照样用不上。",
    judgment:
      "复合索引按字段顺序逐层排序，只有从最左字段开始连续使用的查询才能用它定位；经常单独查的字段要么放在复合索引最左，要么单独建索引。",
    mapping:
      "报表接口按 status + 时间过滤时，{ status, createdAt } 这个顺序同时决定了「只按 status 查」可用、「只按 createdAt 查」不可用。",
    evidence: [
      "A：命中 city_1_age_1，age 段为整个范围，totalDocsExamined 16667。",
      "B：两段都精确，totalDocsExamined 334，是这个复合索引最理想的用法。",
      "C：命中的是 age_1 而不是复合索引；rejectedPlans 里可见优化器考虑过 age_1。",
      "删掉 age_1 后重跑 C：COLLSCAN，扫描 50000 文档，反向验证最左前缀成立。",
    ],
    reviewNote:
      "这组数字来自 bigdata 这个手工造数集合（50000 文档、city 三取值），用于说明索引形态与扫描量的关系，不能外推成项目集合上的性能预期。",
    source: "Week1 · Day2 索引与查询性能 · 下午实验一与对照实验",
  },
  {
    id: "covered",
    label: "知识点 7",
    title: "覆盖查询：字段全在索引里就不回表",
    question: "查询要返回的字段和筛选字段都在同一个索引里，执行计划会少掉哪一步？",
    kind: "covered",
    dataset: "同 bigdata 集合，索引 age_1",
    query: 'find({ age: 42 }, { age: 1, _id: 0 })',
    plan: ["PROJECTION_COVERED", "IXSCAN (age_1, age: [42, 42])"],
    metrics: [
      { label: "totalKeysExamined", value: "1000" },
      { label: "totalDocsExamined", value: "0", highlight: true },
      { label: "执行计划里的 FETCH", value: "没有出现", highlight: true },
    ],
    reverse: {
      action: "把投影里的 _id: 0 去掉，重跑同一条查询",
      plan: ["PROJECTION_SIMPLE", "FETCH", "IXSCAN"],
      metric: "1000",
      reason: "_id 不在 age_1 索引里，为了取它必须回表，覆盖查询的条件被破坏。",
    },
    conditions: [
      "投影要返回的字段全部在某一个索引里。",
      "筛选条件用到的字段也在同一个索引里。",
      "显式排除 _id（_id: 0），除非 _id 本身在该索引里。",
    ],
    judgment:
      "覆盖查询是索引的最高效形态：定位与取值都在索引内完成，完全不访问集合。最硬的证据是 totalDocsExamined 为 0，而不是执行计划里出现了 PROJECTION_COVERED 这个名字。",
    mapping:
      "高频的关键查询可以把要返回的字段也加进复合索引，用空间换掉回表这一步；代价是索引变大、写入变慢。",
    evidence: [
      "正向：PROJECTION_COVERED → IXSCAN，totalKeysExamined 1000，totalDocsExamined 0。",
      "反向：去掉 _id: 0 后变成 PROJECTION_SIMPLE → FETCH → IXSCAN，totalDocsExamined 1000。",
      "同一集合上其余查询都是 FETCH → IXSCAN，即定位后回表。",
    ],
    reviewNote:
      "这条在 bigdata 集合上做过正反两次验证。项目自己的集合上还没有对应实验，脚本 week2-express/src/match-index-explain.js 目前不可运行（见开放问题清单）。",
    source: "Week1 · Day2 索引与查询性能 · 下午实验二与反证",
  },
  {
    id: "lookup-index",
    label: "知识点 8",
    title: "$lookup 关联性能取决于外键索引",
    question: "$lookup 关联快不快，由什么决定？",
    kind: "explain",
    createIndex: "createIndex({ name: 1 })",
    stageBefore: "全表扫描（无可用索引）",
    stageAfter: "IndexedLoopJoin（走索引关联）",
    metrics: [
      { label: "collectionScans", before: "3", after: "0", highlight: true },
      { label: "indexesUsed", before: "[]", after: '["name_1"]', highlight: true },
      { label: "totalDocsExamined", before: "15", after: "0" },
      { label: "executionTime", before: "12ms", after: "3ms" },
    ],
    keyPoint:
      "在这次对照实验里，$lookup 的快慢主要看 foreignField 有没有索引。_id 自带唯一索引，所以关联主键天生走 IndexedLoopJoin；关联无索引字段（如 name）在本例退化成全表扫描。子管道裁剪、关联数据量、内存占用都还没测——不能只凭索引就断定所有 $lookup 的性能。",
    judgment: "在本次实验条件下，collectionScans（应为 0）与 indexesUsed（应非空）是最先看的两个信号；但它们不是 $lookup 快慢的完整判据——子管道、关联量、内存都会影响（见「未验证与待澄清项」）。",
    reviewNote:
      "这是本次索引对照实验的有效证据，不是 $lookup 的通用性能判据；子管道与数据量维度仍需回看，未在此推广。",
    mapping: "关联字段（外键）要么是 _id，要么先建索引；这和上一条 $match 「该查的字段要有索引」是同一条原则的两个应用。",
    evidence: [
      "关联无索引的 name：collectionScans 3、indexesUsed []、扫 15 个文档、12ms。",
      "createIndex({ name: 1 }) 后同一查询：collectionScans 0、indexesUsed [\"name_1\"]、扫 0 个文档、3ms。",
      "正式报表关联 _id 一直是 collectionScans 0 + indexesUsed [\"_id_\"]（主键自带索引）。",
    ],
    source: "Week3 · Day4/Day5 $lookup 索引对照实验",
  },
];

// 未验证与待澄清项：开放问题清单。展示但明确标注状态，避免伪装成已掌握。
export interface OpenItem {
  id: string;
  title: string;
  status: "未验证" | "已理解·暂缓" | "阻塞中" | "待澄清";
  tone: "todo" | "deferred" | "blocked" | "review";
  detail: string;
  plan: string;
}

export const W3_OPEN_ITEMS: OpenItem[] = [
  {
    id: "sub-pipeline",
    title: "$lookup 子管道优化到底值多少",
    status: "未验证",
    tone: "todo",
    detail: "现在关联整个 user 文档再靠 $project 裁剪；直觉上「先全搬进内存再裁」有浪费。猜子管道（pipeline + $project）在关联阶段只取 name/email 更省内存。",
    plan: "Week6 技术总结时，用 explain 对比改造前后的文档处理量 / 内存，用数据说话——像索引实验那样。",
  },
  {
    id: "decimal128-dto",
    title: "Decimal128 → number 放哪一层",
    status: "已理解·暂缓",
    tone: "deferred",
    detail: "现放 service 出口（每个方法各转一遍，有重复）。更规范是 DTO / 序列化层集中做对外格式转换。这是「知道有更好的、也知道现在为什么不用」的带理解的未解决。",
    plan: "接口只有 2–3 个、重复不严重，暂不引入；规模变大或 Week8 整合时再上 DTO 层。",
  },
  {
    id: "covered-query",
    title: "项目集合上的覆盖查询未验证（脚本不可运行）",
    status: "阻塞中",
    tone: "blocked",
    detail:
      "覆盖查询这个知识点本身已在 W1 的 bigdata 造数集合上正反验证过（见知识点 7）。仍未做的是项目自己的集合：week2-express/src/match-index-explain.js 目前不可运行，项目数据上「索引已覆盖所需字段、无需回表 FETCH」的场景没有实测记录。",
    plan: "先修复脚本，再在 orders / users 上跑一次正反对照；与 BACKLOG P0-1 的 explain 耗时量化脚本一起做。",
  },
  {
    id: "month-semantics",
    title: "months=6 边界 / 时区语义 待回看",
    status: "待澄清",
    tone: "review",
    detail: "自然月边界结论已通过，但 months=6 的具体边界样例、时区语义仍需回看澄清；目标是澄清问题，不扩大债务。",
    plan: "回看时只保留必要问题，符合 AGENTS.md 触发条件才单独记 DEBT。",
  },
];

// 关于自己的一个观察——元认知复习项，提醒复用旧模板时的陷阱。
export const W3_SELF_NOTE = {
  title: "套模板漏核心",
  body: "一天内复现 3 次：聚合残留上一题的 userId 字段；service 参数名改成 months 但公式还按天算；controller 函数名改对却调了错误的 service。共同点都是「改了外壳、漏了里子」。",
  fix: "复用旧代码后先停一下，写一行注释列出「和上一个到底哪几处不同」（分组维度？时间跨度？下游调用？），逐一确认再往下写。",
};
