// W3 / W5 / W6 三组代表实验的唯一数据源（展示资产，纯前端静态数据）。
//
// 抽出来的原因：W6 Day 4 的整体技术总结和面试准备板都要引用同一组数字，
// 各写一份必然漂移。canonical 记录放这里，两处各渲染自己需要的字段。
// 抽象边界只到「实验事实」这一层——每块板怎么用这些事实（Day 4 讲它们组成
// 一条技术主线，面试板讲被追问时怎么报）仍由各自组件决定。
//
// 数字来源：week6-testing/notes/day4-overall-technical-summary.md §4，
// 其中 W3 只使用 Day 5 可追溯的 explain 原始指标（不使用未记录的示例数字）。

export interface EvidenceMetric {
  label: string;
  /** 第三态基线，只有 W5 那组有（空闲 vs 主线程 vs Worker）。 */
  base?: string;
  before: string;
  after: string;
  highlight?: boolean;
}

export interface EvidenceSet {
  id: string;
  week: string;
  title: string;
  /** 这组实验在整条技术主线里负责哪一层。 */
  layer: string;
  /** 受控变量：除它以外其余条件不变，这是「对照」成立的前提。 */
  variable: string;
  baseLabel?: string;
  beforeLabel: string;
  afterLabel: string;
  metrics: EvidenceMetric[];
  /** 这组数字能支持的那一句具体结论。 */
  proves: string;
  /** 不能外推的部分，以及为什么。 */
  limits: string;
}

export const EVIDENCE_SETS: EvidenceSet[] = [
  {
    id: "w3-index",
    week: "W3",
    title: "索引改变查询工作量",
    layer: "数据层：查询要付出多少工作量",
    variable: "users.name 上有没有索引（查询语句与数据集保持不变）",
    beforeLabel: "无索引",
    afterLabel: "建 name_1 后",
    metrics: [
      { label: "collectionScans", before: "3", after: "0", highlight: true },
      { label: "indexesUsed", before: "[]", after: '["name_1"]' },
      { label: "totalDocsExamined", before: "15", after: "0", highlight: true },
      { label: "executionTimeMillisEstimate", before: "12 ms", after: "3 ms" },
    ],
    proves: "这条查询因为新增 foreignField 索引而改变了执行计划，减少了文档扫描量。",
    limits:
      "推不出所有 $lookup 都需要这个索引，也不能把 12ms → 3ms 外推成生产性能。该 name 关联只用于实验，做完已清理；正式报表仍关联自带索引的 _id。",
  },
  {
    id: "w5-worker",
    week: "W5",
    title: "Worker 保护响应性，不等于加速",
    layer: "运行时层：主线程还能不能继续响应",
    variable: "同一个 fib(40) 放在主线程还是 Worker 里执行（其余不变）",
    baseLabel: "空闲基线",
    beforeLabel: "主线程 /blocking",
    afterLabel: "/worker",
    metrics: [
      { label: "fib(40) 计算耗时", base: "—", before: "1111 ms", after: "1124 ms" },
      { label: "并发 /ping", base: "约 2–3 ms", before: "峰值约 378 ms", after: "约 2–3 ms", highlight: true },
      { label: "maxHeartbeatGap", base: "约 102 ms", before: "1154 ms", after: "102 ms", highlight: true },
    ],
    proves: "Worker 让主线程继续推进事件循环：heartbeat 与并发请求回到基线附近。",
    limits:
      "本次单任务实验没有显示计算加速，Worker 略长的总耗时也没有做归因。给不出生产环境最优 Worker 数量。378ms 的 ping 是计算开始之后才发出的部分等待，不是完整阻塞时长。",
  },
  {
    id: "w6-ci",
    week: "W6",
    title: "证据能不能脱离本机",
    layer: "验证层：这些结论换台机器还成不成立",
    variable: "同一份测试，跑在本机 vs 跑在每次全新创建的 CI runner",
    beforeLabel: "本地",
    afterLabel: "CI",
    metrics: [
      { label: "测试基线", before: "3 suites / 9 tests 通过", after: "同样通过（run #257）" },
      { label: "数据库来源", before: "本机 Mongo 或 MongoMemoryServer", after: "job 内全新 mongo:7 service" },
      { label: "suite 隔离", before: "共享同一逻辑库", after: "skillup_test_a / _b 各自独占", highlight: true },
      { label: "外部分支残留", before: "曾出现空集合与索引", after: "连续 5 轮无残留", highlight: true },
    ],
    proves: "这些行为证据能脱离本机重复执行，且两个 suite 之间不会互相污染。",
    limits:
      "不证明生产吞吐或部署拓扑。异常 teardown 路径仍可能因 dropDatabase / disconnect 先抛错而跳过后续清理 —— 只验证了正常路径，没有做故障注入。",
  },
];
