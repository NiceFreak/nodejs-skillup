// W3「MongoDB 聚合与查询优化 · 复习板」数据源（展示资产，纯前端静态数据）。
// 只搬运本人 Week3 已经完成并验收的结论，不补写新实现；仍未澄清 / 未验证的部分
// 单独进「开放问题」面板，如实标注，不伪装成已掌握。
// 主要来源：week3-mongoose/notes/day1-aggregation.md、day4/day5-lookup-index-*、
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

export type W3Knowledge = ExplainKnowledge | LayeringKnowledge | MonthKnowledge;

export const W3_KNOWLEDGE: W3Knowledge[] = [
  {
    id: "match-index",
    label: "知识点 1",
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
      "三数相等（keys = docs = nReturned = 5）= 最优索引，每一步都无浪费。等值字段 status 放前、范围字段 createdAt 放后（ESR），索引利用率最高。",
    judgment: "优化不是玄学：看 explain 的 stage 与三数关系就能判断快不快，keys≫nReturned 说明扫了无用条目。",
    mapping: "报表 / 列表接口按 status + 时间过滤时，建 { 等值, 范围 } 复合索引，把 COLLSCAN 变成 IXSCAN。",
    evidence: [
      "无索引：COLLSCAN，totalDocsExamined 14，nReturned 5（扫全表只取 5 条）。",
      "建复合索引后：IXSCAN + FETCH，totalKeysExamined = totalDocsExamined = nReturned = 5。",
      "结果条数不变，变的是「怎么找到」——零浪费。",
    ],
    source: "Week3 · Day1 聚合与 explain 优化笔记",
  },
  {
    id: "lookup-index",
    label: "知识点 2",
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
      "$lookup 性能取决于 foreignField 有没有索引。_id 永远自带唯一索引，所以关联主键天生走 IndexedLoopJoin；关联无索引字段（如 name）只能退化成全表扫描。",
    judgment: "判断 $lookup 快不快只看两个字段：collectionScans（应为 0）与 indexesUsed（应非空）。",
    mapping: "关联字段（外键）要么是 _id，要么先建索引；这和 $match 「该查的字段要有索引」是同一条原则的两个应用。",
    evidence: [
      "关联无索引的 name：collectionScans 3、indexesUsed []、扫 15 个文档、12ms。",
      "createIndex({ name: 1 }) 后同一查询：collectionScans 0、indexesUsed [\"name_1\"]、扫 0 个文档、3ms。",
      "正式报表关联 _id 一直是 collectionScans 0 + indexesUsed [\"_id_\"]（主键自带索引）。",
    ],
    source: "Week3 · Day4/Day5 $lookup 索引对照实验",
  },
  {
    id: "layering",
    label: "知识点 3",
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
    evidence: [
      "月度趋势报表按 $year / $month 分组，独立设计。",
      "起点 = 当前月往前移动 months - 1；区间为 [月初, 下月初) 半开。",
      "DEBT 记档：首次脱离提示时把 $lt / $lte 误判为性能问题，第一档重建已通过、待补掌握证据。",
    ],
    source: "Week3 · 月度趋势报表 + DEBT #1",
  },
];

// 「仍在路上」——已如实记账的开放问题 / 未验证项。展示但明确标注状态，避免伪装成已掌握。
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
    title: "covered query 未验证（脚本跑不起来）",
    status: "阻塞中",
    tone: "blocked",
    detail: "match-index-explain.js 目前不可运行；covered query 验证实验以修复它为前提。",
    plan: "先修复脚本，再验证「索引已覆盖所需字段、无需回表 FETCH」的场景。",
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
