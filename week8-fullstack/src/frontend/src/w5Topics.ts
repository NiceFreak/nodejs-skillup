// W5「Node.js 运行时知识复习板」数据源（展示资产，纯前端静态数据）。
// 只呈现本人已经完成并验收的学习成果；未完成主题不提前制作结论或视觉内容。
// 数据口径统一按三层：事实（直接测到）/ 推断（受控前提下的解释）/ 未测量（本实验无法区分）。

export interface KnowledgeBase {
  id: string;
  label: string;
  title: string;
  question: string;
  judgment: string;
  mapping: string;
  evidence: string[];
}

export interface EventLoopKnowledge extends KnowledgeBase {
  kind: "event-loop";
  reasoningPath: string[];
  loopRule: string;
  lanes: Array<{
    name: string;
    owner: string;
    description: string;
    tone: "stack" | "tick" | "microtask" | "phase";
  }>;
  observations: Array<{
    context: string;
    result: string;
    phase: string;
    note: string;
  }>;
}

export interface CpuBlockingKnowledge extends KnowledgeBase {
  kind: "cpu-blocking";
  timerDelay: number;
  cases: Array<{
    label: string;
    cpuDuration: number;
    callbackAt: number;
    lateBy: number;
    tone: "good" | "warn";
  }>;
}

export interface ThreadpoolKnowledge extends KnowledgeBase {
  kind: "threadpool";
  axisMax: number;
  inference: string;
  unmeasured: string;
  runs: Array<{
    size: number;
    total: number;
    batches: number;
    summary: string;
    tasks: Array<{ id: number; elapsed: number; batch: 1 | 2 }>;
  }>;
}

export type W5Knowledge = EventLoopKnowledge | CpuBlockingKnowledge | ThreadpoolKnowledge;

export const W5_KNOWLEDGE: W5Knowledge[] = [
  {
    id: "event-loop",
    label: "知识点 1",
    title: "事件循环的调度边界",
    question: "一个异步回调为什么在这个时刻执行？",
    kind: "event-loop",
    reasoningPath: ["同步调用栈", "清空 nextTick", "清空 microtask", "libuv 阶段推进一步"],
    loopRule:
      "每执行完一个宏任务（一个 timer callback、一段 I/O callback 等），进入下一个之前，都会先清空全部 nextTick，再清空全部 microtask——所以第 ②③ 步每一轮都会重复，这也是 nextTick / microtask 用错会饿死后续阶段的原因。",
    lanes: [
      {
        name: "调用栈",
        owner: "JS 主线程",
        description: "当前同步代码未结束时，异步回调不能插入执行。",
        tone: "stack",
      },
      {
        name: "nextTick",
        owner: "Node.js",
        description: "当前操作结束后优先清空；持续入队可能造成饥饿。",
        tone: "tick",
      },
      {
        name: "Microtask",
        owner: "V8",
        description: "Promise 回调所在队列，在 nextTick 之后处理。",
        tone: "microtask",
      },
      {
        name: "事件循环阶段",
        owner: "libuv",
        description: "timers、poll、check 等阶段决定对应回调何时获得机会。",
        tone: "phase",
      },
    ],
    observations: [
      {
        context: "顶层代码",
        result: "timer ↔ immediate",
        phase: "timers 阶段 ↔ check 阶段",
        note: "两者先后不应写成固定结论。",
      },
      {
        context: "I/O callback 内",
        result: "immediate → timer",
        phase: "check 阶段 → 下一轮 timers 阶段",
        note: "从 poll 继续进入 check，再进入下一轮 timers。",
      },
    ],
    judgment: "先看调用栈，再过 nextTick 与 microtask 检查点，最后结合事件循环阶段推导顺序。",
    mapping: "用于判断 Express 异步中间件、Promise 回调和错误处理何时获得执行机会。",
    evidence: [
      "CommonJS 与 ESM 顶层执行上下文可能呈现不同的 nextTick / microtask 顺序。",
      "顶层 timer 与 immediate 的单次观测不能推广成固定顺序。",
      "持续向 nextTick 或 microtask 入队会让事件循环长期无法推进。",
    ],
  },
  {
    id: "cpu-blocking",
    label: "知识点 2",
    title: "同步 CPU 如何拖迟回调",
    question: "timer 已到期，为什么 callback 仍然没有执行？",
    kind: "cpu-blocking",
    timerDelay: 100,
    cases: [
      {
        label: "短 CPU 任务",
        cpuDuration: 20,
        callbackAt: 100,
        lateBy: 0,
        tone: "good",
      },
      {
        label: "长 CPU 任务",
        cpuDuration: 2000,
        callbackAt: 2004,
        lateBy: 1904,
        tone: "warn",
      },
    ],
    judgment: "timer 到期只代表 callback 具备被调度的资格；同步 CPU 未释放调用栈时，它仍然不能执行。",
    mapping: "同步大计算会拖慢同一进程中的所有请求；需要区分它与普通 I/O 等待。",
    evidence: [
      "两组隔离运行，只改变同步 CPU 任务时长，timer 均设为 100ms。",
      "20ms 组：callback 等待 100ms，迟到 0ms。",
      "2000ms 组：callback 等待 2004ms，迟到 1904ms。",
    ],
  },
  {
    id: "threadpool",
    label: "知识点 3",
    title: "线程池排队与 UV_THREADPOOL_SIZE",
    question: "同时发起 8 个 pbkdf2，为什么回调分批到达？",
    kind: "threadpool",
    axisMax: 160,
    inference:
      "推断（受控前提：8 个任务参数一致、几乎同时提交、只改 worker 数）：SIZE=4 时 worker 少于任务数，后 4 个要等 worker 释放才开始；两批之间没有「整批完成才统一开始」的屏障，worker 一空闲就接走下一个等待任务，所以第二批也近似并行。",
    unmeasured:
      "未测量：worker 实际开始计算的时刻、精确排队时长、CPU/OS 调度各自的贡献。柱长记录的是 callback 开始执行的 elapsed（晚于底层计算完成），生长动画只作示意，柱长与完成先后才是实测。",
    runs: [
      {
        size: 4,
        total: 151,
        batches: 2,
        summary: "事实：4 个 worker 少于 8 个任务，callback elapsed 分成约 70–79ms 与约 144–151ms 两批。",
        tasks: [
          { id: 1, elapsed: 79, batch: 1 },
          { id: 2, elapsed: 79, batch: 1 },
          { id: 3, elapsed: 79, batch: 1 },
          { id: 4, elapsed: 70, batch: 1 },
          { id: 5, elapsed: 144, batch: 2 },
          { id: 6, elapsed: 146, batch: 2 },
          { id: 7, elapsed: 148, batch: 2 },
          { id: 8, elapsed: 151, batch: 2 },
        ],
      },
      {
        size: 8,
        total: 119,
        batches: 1,
        summary: "事实：8 个 worker 不少于 8 个任务，callback elapsed 聚成一批（约 107–119ms），不再有明显间隔。",
        tasks: [
          { id: 1, elapsed: 118, batch: 1 },
          { id: 2, elapsed: 119, batch: 1 },
          { id: 3, elapsed: 118, batch: 1 },
          { id: 4, elapsed: 118, batch: 1 },
          { id: 5, elapsed: 119, batch: 1 },
          { id: 6, elapsed: 118, batch: 1 },
          { id: 7, elapsed: 107, batch: 1 },
          { id: 8, elapsed: 118, batch: 1 },
        ],
      },
    ],
    judgment:
      "调大 UV_THREADPOOL_SIZE 能改变分组，却不保证总耗时按比例缩短——CPU 核心数与算力没变，worker 增多可能相互竞争 CPU 并带来调度开销。它不是万能性能开关。",
    mapping:
      "fs、部分 crypto、dns.lookup、zlib 共享同一个 threadpool；线上批量哈希 / 压缩 / DNS 若相互争用，会看到类似的分批延迟。",
    evidence: [
      "SIZE=4：Task 完成分两批，Total 151ms。",
      "SIZE=8：Task 完成聚成一批，Total 119ms（未减半，受 CPU 与调度限制）。",
      "唯一变量是 UV_THREADPOOL_SIZE；任务数、pbkdf2 参数、Node 版本与机器保持一致。",
    ],
  },
];

// 三类「慢」现场判断表——本周运行时判断力的综合落点，始终展示，便于复盘。
export interface SlowCase {
  id: string;
  title: string;
  tone: "threadpool" | "mainthread" | "io";
  fact: string;
  distinguish: string;
  cannot: string;
}

export const SLOW_JUDGMENT: SlowCase[] = [
  {
    id: "threadpool",
    title: "Threadpool 排队",
    tone: "threadpool",
    fact: "同一 threadpool 的同构任务（如 pbkdf2）callback elapsed 呈明显批次，批次间隔接近单任务耗时。",
    distinguish: "只改 UV_THREADPOOL_SIZE，批次消失或间隔缩短 → 支持排队归因（前提：任务参数一致、已知走 threadpool）。",
    cannot: "单次对照无法量出精确排队时长，也无法分离 CPU 竞争与 OS 调度各自的贡献。",
  },
  {
    id: "mainthread",
    title: "主线程（JS）阻塞",
    tone: "mainthread",
    fact: "阻塞期间所有异步 callback（timer / I/O / threadpool）都无法执行；释放后按各自队列 / 阶段调度，不保证同时执行或延迟相等。",
    distinguish: "在可疑同步段前后 Date.now() 插桩，同步耗时 > 预期即定位；配合 timer/heartbeat 的 event-loop delay 佐证。",
    cannot: "CPU 占用高不能单独证明是主线程阻塞——worker 线程同样吃 CPU，需要事件循环延迟一起看。",
  },
  {
    id: "io",
    title: "I/O 慢",
    tone: "io",
    fact: "已建 TCP 连接的请求等远端响应显著耗时，但本地 heartbeat timer 基本准时、调 pool size 无稳定影响。",
    distinguish: "heartbeat 准时 → 基本排除持续的主线程阻塞是主因；调 pool size 无效 → 降低 threadpool 排队可能。",
    cannot: "当前证据不能继续定位慢点位于远端处理、网络传输还是链路拥塞的哪一段。",
  },
];
