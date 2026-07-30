// 「面试准备」复习板数据源（展示资产，纯前端静态数据）。
//
// 唯一来源是 interview-prep/ 下的两份问答稿，本文件不新增结论、不改口径：
// - interview-prep/backend-qa-sheet.md（2026-07-30 更新到 W1–W6，Q1–Q37）
// - interview-prep/db-review-sheet.md（2026-07-20 建立，尚未自测）
// 实验数字全部来自已验收笔记：week6-testing/notes/day4-overall-technical-summary.md、
// week3-mongoose/notes/、week5-nodejs-internals/notes/、DEBT.md。
//
// 定位：问答稿负责「完整答法」，这块板负责「面试前 5 分钟能扫一眼就想起来的形状」——
// 往哪引、哪两句不能说错、哪三组数字能报、被问到什么走哪条路。

import { EVIDENCE_SETS, type EvidenceSet } from "./evidenceSets";

export interface InterviewBase {
  id: string;
  label: string;
  title: string;
  question: string;
  judgment: string;
  mapping: string;
  evidence: string[];
  source: string;
  /** 口径提示：展示 / 复习状态都显示，避免把自评读成测量结果。 */
  reviewNote?: string;
}

/** 面试里对某一块的处理方式。三档决定了颜色和图标，不是装饰。 */
export type SteerMode =
  | "lead" // 主动引：可以自己把话题带过去
  | "answer" // 被问再答：不主动挑起，但答得住
  | "hold"; // 暂时收住：答到方法层就停，别深入细节

// ① 强项分层：面试时优先往哪引
export interface StrengthKnowledge extends InterviewBase {
  kind: "strength";
  tiers: Array<{
    id: string;
    rank: string;
    topic: string;
    week: string;
    /** 自评把握度（0–100，非测量值，只用于排序和条形长度）。 */
    grip: number;
    steer: SteerMode;
    basis: string;
    anchor: string;
  }>;
  rule: string;
}

// ② 两处硬伤：说错了最掉分的地方
export interface PitfallKnowledge extends InterviewBase {
  kind: "pitfall";
  items: Array<{
    id: string;
    topic: string;
    wrong: string;
    why: string;
    right: string;
    proof: string;
    trace: string;
  }>;
}

// ③ 三组实验证据：能报的数字 + 不能外推的边界。
// 数字本身来自共享的 EVIDENCE_SETS —— W6 Day 4 板引用的是同一份，避免两处漂移。
export interface EvidenceKnowledge extends InterviewBase {
  kind: "evidence";
  sets: EvidenceSet[];
}

// ④ 追问应答树：被问到什么，走哪条路
export interface FollowupKnowledge extends InterviewBase {
  kind: "followup";
  entries: Array<{
    id: string;
    ask: string;
    route: SteerMode;
    target: string;
    line: string;
    trap: string;
  }>;
}

// ⑤ 覆盖矩阵：哪几周已经变成可讲的题，下一步做什么
export interface CoverageKnowledge extends InterviewBase {
  kind: "coverage";
  rows: Array<{
    id: string;
    week: string;
    theme: string;
    section: string;
    count: number;
    state: SteerMode;
    note: string;
  }>;
  next: { title: string; cost: string; effect: string; where: string };
}

export type InterviewKnowledge =
  | StrengthKnowledge
  | PitfallKnowledge
  | EvidenceKnowledge
  | FollowupKnowledge
  | CoverageKnowledge;

export const STEER_LABEL: Record<SteerMode, string> = {
  lead: "主动引",
  answer: "被问再答",
  hold: "暂时收住",
};

// 排序按「面试前的使用顺序」：先知道往哪引（①），再确认哪两句不能说错（②），
// 然后备好能报的数字（③），预演追问怎么走（④），最后看还缺什么（⑤）。
export const INTERVIEW_KNOWLEDGE: InterviewKnowledge[] = [
  {
    id: "strength",
    label: "板块 1",
    kind: "strength",
    title: "强项分层：面试时往哪引",
    question: "如果只能主动把话题带向一个地方，你会带向哪里？哪一块被问到要收住？",
    judgment:
      "面试的主动权来自「知道自己最稳的是什么」，而不是「什么都答得上」。七块里有五块可以主动引，一块只答不引，一块按岗位裁剪。",
    mapping:
      "开场自我定位就要把话题钉在前四档；被问到 hold 档时按诚实边界模板答，答完主动把话拉回 lead 档。",
    evidence: [
      "Express 分层打磨多周，且最贴近原有技术栈（BFF 层经验可直接衔接）",
      "W6 测试与 CI 于 2026-07-30 完成整体总结，是最新且带实测数字的一块",
      "DEBT.md ①–⑧ 全部已还，认证与运行时的结论都经过延迟重建验证",
      "DB 的 db-review-sheet.md 已写完但尚未自测，因此维持「不主动挑起」",
    ],
    source: "interview-prep/backend-qa-sheet.md 顶部「强项分层」表",
    reviewNote:
      "条形长度是自评把握度，不是任何测量结果；它只用来表达相对次序和处理方式，不要读成分数。",
    rule: "主动引 = 自我介绍和收尾都往这里落；被问再答 = 不主动挑起但答得住；暂时收住 = 答到方法层就停。",
    tiers: [
      {
        id: "express",
        rank: "最稳",
        topic: "Express 分层架构",
        week: "W2",
        grip: 95,
        steer: "lead",
        basis: "打磨多周、最贴近原技术栈，真正记得住讲得出",
        anchor: "全局搜 req/res，只允许出现在 controller —— 这是我的检验尺子。",
      },
      {
        id: "testing",
        rank: "最新且带数字",
        topic: "测试与 CI 的证据意识",
        week: "W6",
        grip: 88,
        steer: "lead",
        basis: "7/30 刚完成整体总结；正反路径、CI 隔离、证据边界都有实测",
        anchor: "admin 200 排除不了「无条件放行」的错误实现，member 403 是必要反例。",
      },
      {
        id: "auth",
        rank: "可复述",
        topic: "认证 / 鉴权",
        week: "W4",
        grip: 85,
        steer: "lead",
        basis: "JWT + RBAC + OAuth2 流程；W6 又用真实登录链测试加固了一遍",
        anchor: "JWT 只放 sub 不放 role：代价是每请求多一次查库，换权限变更即时生效。",
      },
      {
        id: "runtime",
        rank: "已完成、带对照实验",
        topic: "Node.js 运行时",
        week: "W5",
        grip: 82,
        steer: "lead",
        basis: "7/20 时还有两处待补，现已全部完成；Worker 与 threadpool 都有可引用的数字",
        anchor: "同一个 fib(40)：主线程版 heartbeat 从 102ms 涨到 1154ms，Worker 版回到基线。",
      },
      {
        id: "ai",
        rank: "差异化",
        topic: "AI 协作边界",
        week: "全期",
        grip: 78,
        steer: "lead",
        basis: "2026 年几乎必问，而 DEBT.md 这种显式欠债台账是别人拿不出的东西",
        anchor: "代码是我提交的不能证明能力归属；隔两周还能独立改需求、预测影响层才算。",
      },
      {
        id: "frontend",
        rank: "按需展开",
        topic: "前端 / React",
        week: "—",
        grip: 55,
        steer: "answer",
        basis: "岗位方向未定；定位是「深而窄」，不是脱节",
        anchor: "大型存量项目多年 + Next 14/15 现役，中间的 hooks 深度用自己的全栈项目补齐了。",
      },
      {
        id: "database",
        rank: "做过但未复盘",
        topic: "数据库",
        week: "W3",
        grip: 45,
        steer: "hold",
        basis: "db-review-sheet.md 已建但截至 7/30 尚未自测",
        anchor: "我用受控前后对照看指标，而不是凭感觉 —— 但这块我还没充分复盘，细节需要回看。",
      },
    ],
  },
  {
    id: "pitfall",
    label: "板块 2",
    kind: "pitfall",
    title: "两处硬伤：说错了最掉分",
    question: "有两句话你以前答错过，而且都落在标 ★ 的强项区。是哪两句？错在哪一步？",
    judgment:
      "这两处的共同点是「少看了一层」：一个漏掉「这个库把活派给谁」，一个漏掉「批量查不等于逐条查」。它们都不是记不住，是推理链少了一环。",
    mapping:
      "两处都可以反过来当加分点讲 —— 主动说「我一开始也这么答，后来发现漏了哪一层」，比从没错过更能体现你真的验证过。",
    evidence: [
      "bcrypt：代码用的是 await bcrypt.compare（authService.js:52），异步 API 走 libuv threadpool",
      "bcrypt：DEBT.md 2026-07-23 记账并已还，依据是 bcrypt 6.0.0 README 与 Napi::AsyncWorker 源码",
      "populate：mongoose.set('debug', true) 实测，14 个订单只发出 2 条查询",
      "populate：db-review-sheet.md 把「populate 有 N+1」列为最容易说错的第 1 句",
    ],
    source: "interview-prep/backend-qa-sheet.md Q4 / Q26；DEBT.md 2026-07-23",
    reviewNote:
      "这两条是 2026-07-30 复核问答稿时发现的：稿子里的旧答法与仓库自身已验收的结论矛盾，属于会在追问下当场穿帮的错，不是措辞问题。",
    items: [
      {
        id: "bcrypt",
        topic: "bcrypt 与事件循环",
        wrong:
          "bcrypt.compare 是 CPU 密集的，登录时它阻塞了事件循环 —— 那 314ms 就是主线程被占用的时间。",
        why: "把「CPU 密集」直接等同于「占用 JS 主线程」，漏掉了中间一层：这个库把计算派给了谁。",
        right:
          "代码里是 await bcrypt.compare(...)，异步 API 经 N-API 的 AsyncWorker 提交到 libuv threadpool，主线程在等待期间继续推进事件循环。只有 compareSync 才真的占主线程。",
        proof:
          "真正的主线程阻塞用 fib(40) 对照：主线程执行时 heartbeat 最大间隔 102ms → 1154ms，并发 /ping 峰值 378ms。",
        trace: "DEBT.md 2026-07-23（已还） · 问答稿 Q4 与第 9 节速查表",
      },
      {
        id: "populate",
        topic: "populate 与 N+1",
        wrong: "populate 是 Mongoose 层的关联，底层可能退化成多次查询，所以它有 N+1。",
        why: "把「应用层关联」直接推成「逐条查询」。真正产生 N+1 的是手动循环 findById，不是 populate。",
        right:
          "populate 用 $in 批量查：User.find({ _id: { $in: [...] } })，是 1+1 次往返，没有 N+1。三种做法分别是：手动循环 1+N（有）、populate 1+1（没有）、$lookup 1 次（没有）。",
        proof:
          "mongoose.set('debug', true) 实测：14 个订单只发出 2 条查询，第二条的 $in 里只带 4 个 id —— Mongoose 还做了去重。",
        trace: "db-review-sheet.md Q7 / 「最容易说错的 5 句」第 1 条 · 问答稿 Q26",
      },
    ],
  },
  {
    id: "evidence",
    label: "板块 3",
    kind: "evidence",
    title: "三组能报的数字",
    question: "被追问「你怎么知道的」时，你手上有哪三组带受控变量的数字？每组不能推出什么？",
    judgment:
      "有数字不等于有结论。这三组的价值在于每组都能同时说出「它支持哪句具体的话」和「它推不出什么」——主动划边界在有经验的面试官那里是强信号。",
    mapping:
      "被问到任何实验结论时套同一个句式：受控变量是 X → 它支持 [具体那一句] → 但不能外推到 [生产 / 所有同类场景 / 最优参数]，因为 [单次 / 本机 / 没测]。",
    evidence: [
      "W3：week6-testing/notes/day4-overall-technical-summary.md §4.1（W3 Day 5 可追溯的 explain 原始指标）",
      "W5：同上 §4.2，fib(40) 主线程 / Worker 对照",
      "W6：CI run #257 后端与前端 job 均成功；外部 MongoDB 分支连续 5 轮无残留",
      "三组都刻意不使用未记录的数字（曾出现过用「1.2s → 0.15s」这种合理示例冒充事实，已纠正）",
    ],
    source: "week6-testing/notes/day4-overall-technical-summary.md §4；问答稿 Q4 / Q5 / Q20 / Q25",
    reviewNote:
      "所有毫秒数都是本机单次或少数几次运行的结果，只用于说明「量级差异」和「方向」，不是性能基准。",
    sets: EVIDENCE_SETS,
  },
  {
    id: "followup",
    label: "板块 4",
    kind: "followup",
    title: "追问应答树：往哪走",
    question: "面试官抛出一个问题，你的第一反应应该是「答什么」还是「往哪引」？",
    judgment:
      "每个入口问题都对应一条预先想好的路：主动引的把话带回强项，被问再答的答完就收，暂时收住的答到方法层为止。想清楚路线比想清楚措辞更重要。",
    mapping:
      "面试前把这张表从上往下扫一遍，重点记住每行最后那个「坑」——那才是当场会掉分的地方。",
    evidence: [
      "路线划分与问答稿顶部的强项分层表一一对应",
      "两个标 ⚠️ 的坑分别来自板块 2（bcrypt）和 DB 尚未自测的现状",
      "诚实边界的三个模板见问答稿第 8 节",
    ],
    source: "interview-prep/backend-qa-sheet.md 第 0 / 8 节与各节 ★ 加分点",
    entries: [
      {
        id: "intro",
        ask: "介绍下你自己 / 讲讲你的项目",
        route: "lead",
        target: "分层架构 + 三条状态路径",
        line: "我先讲一条真实业务链：同一个 admin-only 接口分别返回 200、403、401，每条都有测试，再放进 CI 重复。",
        trap: "别在自我介绍里主动亮数据库 / explain 优化。",
      },
      {
        id: "layering",
        ask: "你的分层是怎么划的？",
        route: "lead",
        target: "W2 分层 + 跨层返回值形状",
        line: "全局搜 req/res，它俩只允许出现在 controller —— 越界了就是分层破了。",
        trap: "别把单向依赖说成洋葱模型的推论，那是纵向和横向两件事。",
      },
      {
        id: "jwt",
        ask: "JWT 里放什么？为什么不放角色？",
        route: "lead",
        target: "认证鉴权 + 401 / 403 的区分",
        line: "只放 sub。放了 role 就是到期前不可变的权限快照；代价是每请求多一次查库，换权限变更即时生效。",
        trap: "别说成「最佳实践」，要讲成一个我知道成本并接受的取舍。",
      },
      {
        id: "correct",
        ask: "你怎么保证这些行为是对的？",
        route: "lead",
        target: "W6 正反路径",
        line: "admin 200 排除不了「所有登录用户都放行」这个错误实现，所以 member 403 是必要反例。",
        trap: "别只讲成功路径 —— 只测成功路径本身就是这题要考的漏洞。",
      },
      {
        id: "block",
        ask: "什么代码会阻塞事件循环？",
        route: "lead",
        target: "W5 fib(40) 对照",
        line: "CPU 密集的同步 JS。await bcrypt.compare 走 threadpool，并不阻塞主线程。",
        trap: "⚠️ 别再拿 bcrypt 当阻塞例子（见板块 2）。",
      },
      {
        id: "slow-query",
        ask: "查询慢怎么优化？",
        route: "hold",
        target: "explain 前后对照，答到方法层就停",
        line: "我不靠直觉，用受控前后对照看 collectionScans 和 docsExamined 这类指标。",
        trap: "⚠️ db-review-sheet 尚未自测，别深入复合索引 ESR、覆盖查询这些细节。",
      },
      {
        id: "scale",
        ask: "事务 / 复制集 / 分片了解吗？",
        route: "answer",
        target: "诚实边界模板②",
        line: "概念级了解，没有生产实战。我的深度集中在单库的查询建模和索引优化。",
        trap: "别硬撑 —— 硬撑一追问就穿，诚实反而显得靠谱。",
      },
      {
        id: "ai",
        ask: "你怎么用 AI？哪些是你写的？",
        route: "lead",
        target: "DEBT 记账 + 延迟重建",
        line: "代码由我提交这件事本身不能证明能力归属；隔两周还能独立改需求、预测影响层，才是证据。",
        trap: "别答成「我用它提效」这种没有边界的话 —— 这题考的就是边界。",
      },
      {
        id: "frontend",
        ask: "React / 前端怎么样？",
        route: "answer",
        target: "深而窄 + 类组件迁移叙事",
        line: "大型存量项目多年 + Next 14/15 现役经验，中间的 hooks 深度我用自己的全栈项目补齐了。",
        trap: "别把 React 16 背景当短板藏着 —— 存量迁移经验是优势方。",
      },
      {
        id: "extrapolate",
        ask: "（追问实验结论）这个数字能推广吗？",
        route: "lead",
        target: "主动划边界",
        line: "它支持的是这一句具体结论；不能外推到生产性能或所有同类场景，因为是单次、本机、受控实验。",
        trap: "主动说「我没有证明什么」是强信号，不是示弱。",
      },
    ],
  },
  {
    id: "coverage",
    label: "板块 5",
    kind: "coverage",
    title: "覆盖矩阵与下一步",
    question: "37 道题铺在哪几周上？现在唯一挡着 DB 升级的是什么，成本多大？",
    judgment:
      "覆盖已经从 W1–W5 补到 W1–W6，五块可主动引、一块按岗位裁剪，只剩 DB 一块卡在「材料写完但没过一遍」上 —— 这是成本最低的一个缺口。",
    mapping:
      "面试前的优先级不是再学新东西，而是把这张表里唯一的 ⚠️ 清掉：半小时的自测，换 DB 从「不主动挑起」变回「可主动亮」。",
    evidence: [
      "问答稿 2026-07-30 从 W1–W5 扩到 W1–W6，题目从 18 道增加到 37 道",
      "新增第 4 节（测试与 CI）、第 6 节（AI 协作边界），并重写第 7 节（前端）",
      "DB 定位维持 ⚠️：db-review-sheet.md 已建但确认尚未自测",
      "自测任务已登记为 BACKLOG.md P0-0（编号避开被 week3-plan.md 引用的 P0-1）",
    ],
    source: "interview-prep/backend-qa-sheet.md 全文；BACKLOG.md P0-0 / P0-1",
    rows: [
      { id: "w12", week: "W1–W2", theme: "Express 分层架构", section: "第 2 节", count: 5, state: "lead", note: "最稳的一块，尽量把话题往这引" },
      { id: "w3", week: "W3", theme: "MongoDB 聚合与索引", section: "第 5 节", count: 4, state: "hold", note: "自测稿已写完但尚未过，暂不主动挑起" },
      { id: "w4", week: "W4", theme: "认证与鉴权", section: "第 3 节", count: 6, state: "lead", note: "JWT / RBAC / OAuth2 凭据边界都能纵深" },
      { id: "w5", week: "W5", theme: "Node.js 运行时", section: "第 1 节", count: 6, state: "lead", note: "含 Worker 与 threadpool 的对照数字" },
      { id: "w6", week: "W6", theme: "测试与 CI", section: "第 4 节", count: 6, state: "lead", note: "7/30 新增，区分度最高的一节" },
      { id: "ai", week: "全期", theme: "AI 协作边界", section: "第 6 节", count: 2, state: "lead", note: "7/30 新增，差异化项" },
      { id: "fe", week: "—", theme: "前端 / React", section: "第 7 节", count: 8, state: "answer", note: "岗位未定，按可裁剪篇幅写" },
    ],
    next: {
      title: "过一遍 db-review-sheet.md 的 10 题自测清单",
      cost: "半小时，不写代码、不跑实验",
      effect: "DB 从 ⚠️ 调到 ✅，问答稿第 5 节改为可主动亮，删掉「别主动挑起」的告诫",
      where: "BACKLOG.md P0-0 · db-review-sheet.md 第 0 节",
    },
  },
];

// 复习状态展开：这块板自己的开放项——它记录的是「问答稿还欠什么」，不是学习债务。
export const INTERVIEW_OPEN_ITEMS = [
  {
    id: "db-selftest",
    title: "DB 自测尚未进行",
    status: "待办 · 半小时",
    tone: "review",
    detail:
      "db-review-sheet.md 在 2026-07-20 就写完了，但截至 7/30 本人还没有合上答案自测过。所以问答稿第 5 节仍按 ⚠️ 处理，面试里不主动挑起 DB 细节。",
    plan: "先只看该文件第 0 节的 10 题清单，答不出的才回去看对应小节。过完把两份文件里的 ⚠️ 一起改掉。",
  },
  {
    id: "role-undecided",
    title: "岗位方向未定，前端节按占位篇幅写",
    status: "阻塞 · 等外部信息",
    tone: "blocked",
    detail:
      "第 7 节（Q30–Q37）目前是「可裁剪的中等篇幅」：偏后端岗整节跳过，偏前端岗需要补三块——真实项目里的性能排查经历、组件库 / 设计系统取舍、前端工程化。",
    plan: "岗位一确定，第 7 节和第 0 节的自我定位要一起重调侧重，不能只改其中一处。",
  },
  {
    id: "explain-numbers",
    title: "explain 只有定性对照，没有耗时量化",
    status: "候选 · BACKLOG P0-1",
    tone: "todo",
    detail:
      "现在能说「collectionScans 从 3 变 0」，但说不出「建索引前耗时 Y ms、建完 B ms」。seed 数据（2000 用户 / 约 4500 订单）已经造好了，只差把定性变成数字。",
    plan: "跟在 P0-0 之后做。做完 Q25 的答法能从「我看指标判断有没有走索引」升级成带前后数字的版本。",
  },
  {
    id: "harness",
    title: "AI 协作一节还能再深一层",
    status: "候选 · BACKLOG P0-2",
    tone: "todo",
    detail:
      "第 6 节目前讲的是「怎么用 AI 而不被外包能力」。若面试偏 AI 工程 / 测试平台方向，还可以接上单 Agent Harness Lab 的 spike——本人工作中的平台二期技术展望。",
    plan: "先锁定二期里一个具体问题（生成的测试怎么判定可信 / 什么时候该停止重试），再动手，按 spike 收口。",
  },
] as const;
