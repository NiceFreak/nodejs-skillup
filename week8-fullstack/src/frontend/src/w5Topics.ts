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
  tick: Array<{ name: string; note: string; loop?: boolean }>;
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
    tick: [
      { name: "执行 1 个宏任务", note: "从当前阶段取一个到期 callback 执行，例如一个 timer callback 或一段 I/O callback。" },
      { name: "清空 nextTick", note: "该宏任务一结束，先把 process.nextTick 队列全部执行完（Node 管理，优先级最高）。" },
      { name: "清空 microtask", note: "再把 Promise / queueMicrotask 队列全部执行完（V8 管理，晚于 nextTick）。" },
      { name: "进入下一步", note: "回到事件循环，取下一个宏任务或推进到下一个阶段——② ③ 会再来一遍。", loop: true },
    ],
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
  expand?: boolean; // 该类是否在判断表下方有展开的深挖（目前仅 I/O 慢）
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
    expand: true, // I/O 慢在别处没有独立知识点，深挖内容单独展开在判断表下方
  },
];

// I/O 慢 · 深挖。前两类（threadpool 排队 / 主线程阻塞）在上方各有独立知识点与实测可视化，
// 唯独 I/O 慢只在判断表里占一行——但它其实是本周判断链路最长的一块。这里把 D3 收口问答里
// 「分诊推理 → 2s 等待四层职责 → poll 等待 vs 同步 while → fd」补全，只搬不生成。
// 口径：属运行时链路理解与判断模型（查资料 + 收口问答验收），非本机实测数据。

// 分诊推理的一步：某个观测证据，反对（against）或指向（toward）某个归因。
export interface IoReasonStep {
  observation: string;
  rules: string;
  stance: "against" | "toward";
}

// 等待远端响应期间，某一层在「等待中」与「数据到达后」各自做什么。
export interface IoLayer {
  actor: string;
  owner: string;
  during: string;
  onArrive: string;
  tone: "os" | "libuv" | "node" | "v8";
}

export interface IoDeepDive {
  scenario: string;
  reasoning: { steps: IoReasonStep[]; hypothesis: string; boundary: string };
  layers: IoLayer[];
  arriveMark: string;
  contrast: {
    poll: { label: string; points: string[] };
    blocking: { label: string; points: string[] };
    takeaway: string;
  };
  fdNote: string;
  source: string;
}

export const IO_DEEP_DIVE: IoDeepDive = {
  scenario:
    "一个已建立 TCP 连接的 HTTP 请求等远端响应约 2s；与此同时本地 100ms heartbeat timer 基本准时，调整 UV_THREADPOOL_SIZE 也没有稳定影响。它更像哪一类慢？",
  reasoning: {
    steps: [
      {
        observation: "heartbeat timer 基本准时",
        rules: "反对「持续的主线程阻塞是主因」（不排除短暂阻塞）",
        stance: "against",
      },
      {
        observation: "调 UV_THREADPOOL_SIZE 无稳定影响",
        rules: "降低 threadpool 排队的可能——普通网络 I/O 走 OS，不占 threadpool",
        stance: "against",
      },
      {
        observation: "等待落在「已建连接之后、远端响应之前」",
        rules: "把外部 I/O 等待作为工作假设",
        stance: "toward",
      },
    ],
    hypothesis:
      "当前证据更支持「外部 I/O 等待」作为工作假设，同时反对主线程阻塞与 threadpool 排队。",
    boundary:
      "但尚不能定位到远端处理、网络传输还是链路拥塞的哪一段——这是证据边界，不是最终结论。",
  },
  arriveMark: "t ≈ 2s · 数据到达",
  layers: [
    {
      actor: "OS 内核",
      owner: "epoll / kqueue / IOCP",
      tone: "os",
      during: "监控该 TCP socket 的可读事件、管理接收缓冲；数据未到时该 fd 未就绪。",
      onArrive: "数据包经协议栈校验、重组写入接收缓冲区，标记 fd 可读，通知 libuv。",
    },
    {
      actor: "libuv · poll",
      owner: "跨平台 I/O 就绪抽象",
      tone: "libuv",
      during: "socket 在开始监听时就已注册进监控集合；poll 阶段等待 OS 返回就绪事件，不走 threadpool。",
      onArrive: "收到可读通知后调用 recv/read 把数据读入用户空间，封装 I/O 事件交上层；自身不解析内容。",
    },
    {
      actor: "Node",
      owner: "HTTP 语义与调度",
      tone: "node",
      during: "该请求的 callback 上下文暂存在请求对象里，处于 pending。",
      onArrive: "解析 HTTP、组织 request / response 语义，安排对应 callback 的调度。",
    },
    {
      actor: "JS 主线程 · V8",
      owner: "唯一执行 JS 的线程",
      tone: "v8",
      during: "未阻塞，可继续执行 100ms heartbeat 等其他 callback。",
      onArrive: "在后续事件循环轮次由 V8 执行该请求的 callback。",
    },
  ],
  contrast: {
    poll: {
      label: "poll 等待网络 I/O",
      points: [
        "主线程进入 OS 的高效 I/O 等待",
        "此刻没有执行 JavaScript",
        "I/O 就绪或 poll timeout 可将其唤醒",
        "事件循环恢复、继续调度 callback",
      ],
    },
    blocking: {
      label: "同步 while 忙等",
      points: [
        "主线程持续执行 JavaScript、占用 CPU",
        "事件循环无法推进",
        "到期 timer / 就绪 I/O 都不能执行 callback",
        "不存在唤醒动作，必须等执行上下文主动返回",
      ],
    },
    takeaway:
      "两者都「在等」，但一个把主线程交回 OS、可被唤醒，一个把主线程钉在 CPU 上——所以 poll 等待不是阻塞。",
  },
  fdNote:
    "fd = file descriptor：进程内引用内核资源（文件 / TCP socket / pipe）的整数。「fd 可读」只表示读取不会因等数据阻塞（也可能是 EOF / 错误），不表示 callback 已执行。",
  source:
    "来源：W5 D3 收口问答 + 查阅资料（day3-threadpool-continuation.md）。属运行时链路理解与判断模型，非本机实测。",
};
