// W5「Node.js 运行时知识复习板」数据源（展示资产，纯前端静态数据）。
// 只呈现本人已经完成并验收的学习成果；未完成主题不提前制作结论或视觉内容。
// 数据口径统一按三层：事实（直接测到）/ 推断（受控前提下的解释）/ 未测量（本实验无法区分）。

export interface KnowledgeBase {
  id: string;
  label: string;
  title: string;
  question: string;
  group: "调度与慢点诊断" | "大数据流生产边界";
  evidenceKind: "本人实测" | "判断模型" | "实测 + 模型";
  source: string;
  boundary: string;
  reviewStatus?: string;
  judgment: string;
  mapping: string;
  evidence: string[];
}

export interface EventLoopKnowledge extends KnowledgeBase {
  kind: "event-loop";
  phases: Array<{
    name: string;
    role: string;
    example: string;
    internal?: boolean;
  }>;
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
  ownership: Array<{
    task: string;
    mechanism: string;
    poolEffect: string;
    tone: "main" | "pool" | "io";
  }>;
  ioPath: Array<{ owner: string; action: string }>;
  diagnosis: SlowCase[];
  stopBoundary: string;
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

export interface SlowCase {
  id: string;
  title: string;
  tone: "threadpool" | "mainthread" | "io";
  fact: string;
  distinguish: string;
  cannot: string;
}

export interface StreamModelKnowledge extends KnowledgeBase {
  kind: "stream-model";
  compare: Array<{
    label: string;
    tone: "whole" | "stream";
    flow: string[];
    outcome: string;
  }>;
  diagnostics: string[];
}

export interface BackpressureKnowledge extends KnowledgeBase {
  kind: "backpressure";
  config: Array<{ label: string; value: string }>;
  cycle: string[];
  metrics: Array<{ label: string; value: string; note: string }>;
  finalPath: string;
}

export interface PipelineKnowledge extends KnowledgeBase {
  kind: "pipeline";
  stages: string[];
  success: { title: string; facts: string[] };
  failure: { title: string; facts: string[] };
  platformBoundary: string;
}

export type W5Knowledge =
  | EventLoopKnowledge
  | CpuBlockingKnowledge
  | ThreadpoolKnowledge
  | StreamModelKnowledge
  | BackpressureKnowledge
  | PipelineKnowledge;

export const W5_KNOWLEDGE: W5Knowledge[] = [
  {
    id: "event-loop",
    label: "知识点 1",
    title: "事件循环的调度边界",
    question: "一个异步回调为什么在这个时刻执行？",
    kind: "event-loop",
    group: "调度与慢点诊断",
    evidenceKind: "实测 + 模型",
    source: "W5 D1 实测 + D2 追问 · day1-event-loop.md / day3-threadpool-continuation.md / Node.js 官方事件循环说明",
    boundary: "六阶段是理解调度职责的简化图，不是每轮必定逐格执行的时间表；Node 20 起 timers 在每轮 poll 后运行。nextTick / microtask 也不是事件循环阶段。",
    phases: [
      {
        name: "timers",
        role: "执行已达到时间阈值的 setTimeout / setInterval callback；阈值不是准点保证。",
        example: "setTimeout / setInterval",
      },
      {
        name: "pending callbacks",
        role: "处理被延迟到下一轮的部分系统级 I/O callback。",
        example: "部分 TCP 错误回调",
      },
      {
        name: "idle / prepare",
        role: "libuv 内部维护阶段，业务代码不会把 callback 直接排到这里。",
        example: "运行时内部",
        internal: true,
      },
      {
        name: "poll",
        role: "计算可等待多久、取得新的 I/O 事件，并执行大多数 I/O callback。",
        example: "fs.readFile 等典型 I/O callback",
      },
      {
        name: "check",
        role: "poll 之后执行 setImmediate callback。",
        example: "setImmediate",
      },
      {
        name: "close callbacks",
        role: "处理部分资源关闭 callback；并非所有 close 事件都必然落在这里。",
        example: "socket.on('close')",
      },
    ],
    reasoningPath: ["执行 1 个 JS callback", "清空 nextTick", "清空 microtask", "事件循环继续推进"],
    loopRule:
      "在 CommonJS 顶层和普通 callback 场景中，每个 JS callback 返回、调用栈清空后进入检查点：先清 nextTick，再清 microtask。检查点绑定 callback 边界，不是阶段之间的匿名空隙；ESM 顶层另有上下文差异。",
    tick: [
      { name: "执行 1 个 callback", note: "主线程执行一个已获得调度机会的 JS callback；异步回调不会插入当前同步代码中间。" },
      { name: "清空 nextTick", note: "callback 返回后进入检查点；常规上下文先处理 Node 管理的 next tick queue。" },
      { name: "清空 microtask", note: "再处理 V8 管理的 Promise / queueMicrotask；ESM 顶层不能套用这个简化顺序。" },
      { name: "继续调度", note: "回到事件循环，取下一个 callback 或推进阶段；后续 callback 返回后再次进入检查点。", loop: true },
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
        description: "普通 callback 检查点晚于 nextTick；ESM 顶层是已实测例外。",
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
        context: "fs.readFile callback 内",
        result: "immediate → timer",
        phase: "check 阶段 → 下一轮 timers 阶段",
        note: "该典型 callback 位于 poll：返回后进入 check，再等下一轮 timers。不能外推到所有 I/O callback。",
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
    group: "调度与慢点诊断",
    evidenceKind: "本人实测",
    source: "W5 D2 · day2-libuv-threadpool-blocking.md + src/cpu-blocking.js",
    boundary: "两组实验只支持当前受控条件下的因果判断，不代表不同算法、机器或负载下的固定延迟。",
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
    title: "线程池、I/O 归属与慢点诊断",
    question: "一个异步任务到底由谁推进，慢点发生在主线程、线程池还是外部 I/O？",
    kind: "threadpool",
    group: "调度与慢点诊断",
    evidenceKind: "实测 + 模型",
    source: "W5 D2–D3 · day3-threadpool-continuation.md + src/pbkdf2-test.js + 当前项目 bcrypt 6.0.0",
    boundary: "pbkdf2 分批是本人实测；任务归属和网络 I/O 链路是已验收判断模型。callback elapsed 仍不能直接量出 worker 开始时刻、精确排队时长或 CPU/OS 调度贡献。",
    ownership: [
      { task: "同步 JavaScript", mechanism: "V8 在 JS 主线程执行", poolEffect: "不受 pool size 影响", tone: "main" },
      { task: "普通 TCP / HTTP / MongoDB 网络等待", mechanism: "OS 非阻塞 I/O + libuv poll", poolEffect: "通常不受 pool size 影响", tone: "io" },
      { task: "异步 fs / dns.lookup / zlib", mechanism: "libuv threadpool", poolEffect: "共享 worker，可能互相排队", tone: "pool" },
      { task: "异步 crypto / 当前项目 bcrypt", mechanism: "libuv / N-API threadpool worker", poolEffect: "CPU 密集且可能占满共享 worker", tone: "pool" },
    ],
    ioPath: [
      { owner: "OS", action: "维护 socket 与接收缓冲区，报告 I/O resource readiness" },
      { owner: "libuv", action: "跨平台抽象 I/O 监听，在 poll 链路取得就绪事件" },
      { owner: "Node.js", action: "处理 HTTP 协议与对象 / 事件语义，安排对应 callback" },
      { owner: "V8", action: "callback 获得机会后，在 JS 主线程执行用户代码" },
    ],
    diagnosis: [
      {
        id: "threadpool",
        title: "Threadpool 排队",
        tone: "threadpool",
        fact: "同一 threadpool 的同构任务 callback elapsed 呈明显批次。",
        distinguish: "先确认 API 使用 threadpool，再保持任务一致、只改 pool size；批次变化支持排队归因。",
        cannot: "elapsed 不能直接量出精确排队时长，也不能分离 CPU 竞争与 OS 调度贡献。",
      },
      {
        id: "mainthread",
        title: "JS 主线程阻塞",
        tone: "mainthread",
        fact: "阻塞期间 timer、I/O、threadpool 等 JavaScript callback 都无法进入调用栈。",
        distinguish: "测量可疑同步代码段耗时，并用 timer / heartbeat 的 event-loop delay 佐证。",
        cannot: "CPU 高不能单独证明主线程阻塞；threadpool worker 同样会消耗 CPU。",
      },
      {
        id: "io",
        title: "外部 I/O 等待",
        tone: "io",
        fact: "已建连接请求等待响应较久，但本地 heartbeat 基本准时，调 pool size 无稳定影响。",
        distinguish: "这些现象反对持续主线程阻塞，并降低 threadpool 排队可能；再用客户端计时、服务端日志或 trace 分段。",
        cannot: "当前证据不能区分远端处理、网络传输、拥塞或重传中的具体慢点。",
      },
    ],
    stopBoundary: "fd / readiness 用于避免说错高层模型；epoll、kqueue、IOCP 的实现差异，TCP 重组细节和 HTTP parser 内部实现只保留为后续 backlog，不作为当前掌握证据。",
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
      "当前项目的异步 bcrypt.hash / compare 属于 threadpool 路径；MongoDB 查询主要是网络 I/O。两者都可能是 CPU 密集或耗时操作，但执行归属与诊断方法不同。",
    evidence: [
      "SIZE=4：Task 完成分两批，Total 151ms。",
      "SIZE=8：Task 完成聚成一批，Total 119ms（未减半，受 CPU 与调度限制）。",
      "唯一变量是 UV_THREADPOOL_SIZE；任务数、pbkdf2 参数、Node 版本与机器保持一致。",
    ],
  },
  {
    id: "stream-model",
    label: "知识点 4",
    title: "整块读取与 Stream 的内存模型",
    question: "大文件为什么不能默认 readFile 后再一次性发送？",
    kind: "stream-model",
    group: "大数据流生产边界",
    evidenceKind: "判断模型",
    source: "W5 D4 §1–2 · day4-stream-backpressure.md",
    boundary: "本日没有用 2 GB 文件或并发请求实测 RSS、吞吐和首字节时间，因此不展示虚构的内存或性能数字。",
    compare: [
      {
        label: "整块读取",
        tone: "whole",
        flow: ["readFile 等完整内容", "回调拿到完整 Buffer", "再开始处理或发送"],
        outcome: "并发重叠时多个完整 Buffer 可能同时驻留；若拿全后才响应，首字节要等完整读取。",
      },
      {
        label: "流式处理",
        tone: "stream",
        flow: ["Readable 逐块产生", "每个 chunk 立即处理", "Writable 逐块接收"],
        outcome: "数据不要求完整驻留，可以更早交付首个 chunk，并为速度协调提供背压入口。",
      },
    ],
    diagnostics: ["heapUsed", "external", "arrayBuffers", "RSS", "首字节时间"],
    judgment: "先问业务是否必须完整 materialize；如果可以逐块处理，应优先评估 Stream，而不是默认整块读取。",
    mapping: "适用于大文件导出、对象存储转发、日志处理和大响应下载的方案 review。",
    evidence: [
      "Buffer 的大块二进制数据通常还要看 external / arrayBuffers / RSS，不能只看 V8 heapUsed。",
      "整块读取的风险来自文件大小、并发重叠和其他进程内存共同作用。",
      "Stream 改变的是 materialize 和交付方式，不自动保证生产环境内存永远安全。",
    ],
  },
  {
    id: "backpressure",
    label: "知识点 5",
    title: "背压：让快生产者停下来",
    question: "consumer 更慢时，producer 怎样知道何时暂停和恢复？",
    kind: "backpressure",
    group: "大数据流生产边界",
    evidenceKind: "本人实测",
    source: "W5 D4 §3–4 · day4-stream-backpressure.md + src/stream-test.js",
    boundary: "当前结果只证明受控配置下积压有界；不能外推到任意输入、运行时间或生产负载。",
    config: [
      { label: "生产间隔", value: "10ms / chunk" },
      { label: "消费耗时", value: "50ms / chunk" },
      { label: "highWaterMark", value: "5 bytes" },
      { label: "总量", value: "30 chunks" },
    ],
    cycle: ["write() 返回 false", "producer 停止后续写入", "consumer / heartbeat 继续", "drain 后恢复生产"],
    metrics: [
      { label: "write", value: "30", note: "所有 chunk 均已交付" },
      { label: "false", value: "6", note: "第 5/10/15/20/25/30 次" },
      { label: "drain", value: "5", note: "前 5 轮恢复生产" },
      { label: "writableLength", value: "1 → 5 → 0", note: "峰值未持续抬升" },
    ],
    finalPath: "最后一次 false 后已无更多数据：end() 声明输入结束，Writable 消化剩余数据后以 finish 收口，因此不需要第 6 次 drain。",
    judgment: "false 表示当前 chunk 已接纳但后续必须暂停；drain 只表示本地 Writable 可以继续接收，不代表客户端已经收到。",
    mapping: "review 手写写入循环时，检查 false 到 drain 之间上游是否真的停产，并观察 writableLength 是否持续抬升。",
    evidence: [
      "暂停窗口内 producer 停止，而 consumer 与 heartbeat 继续，排除了同步主线程阻塞这一替代解释。",
      "highWaterMark 是背压阈值，不是禁止内存超过的硬上限。",
      "当前 _write 中尚未 callback 的 chunk 仍计入本机 Node 24 的 writableLength 观测。",
    ],
  },
  {
    id: "pipeline",
    label: "知识点 6",
    title: "pipeline 的完成、错误与清理",
    question: "多段 Stream 链路失败时，谁负责统一收口？",
    kind: "pipeline",
    group: "大数据流生产边界",
    evidenceKind: "本人实测",
    source: "W5 D4 §5 · day4-stream-backpressure.md + src/minimal-pipeline.js",
    boundary: "EISDIR 是当前 macOS 实测；跨平台契约只保证目录目标导致输出端打开失败并进入统一错误出口。",
    reviewStatus: "D4 已验收；失败路径接受过 L2 定向 review，安排 2026-07-24 第一档延迟重建。",
    stages: ["Readable", "Transform", "Writable"],
    success: {
      title: "成功路径",
      facts: ["输入 102 bytes", "输出 102 bytes", "仅 ASCII a-z 转为 A-Z", "内容契约 true"],
    },
    failure: {
      title: "输出端失败",
      facts: ["Promise 出口收到 EISDIR", "Readable destroyed: true", "Transform destroyed: true", "Writable destroyed: true"],
    },
    platformBoundary: "生产代码选择 pipeline 的核心理由不是更短，而是统一完成语义、错误传播和相关 stream 清理。",
    judgment: "pipe 负责连接数据流和常规背压；pipeline 进一步集中成功、失败与资源清理，是多段生产链路的优先选择。",
    mapping: "文件转换、压缩、上传转发等链路上线前，应同时注入读端/写端失败并观察统一出口与 destroyed/close 状态。",
    evidence: [
      "成功路径输入/输出均为 102 字节，转换结果与预期一致。",
      "输出目标使用运行前已存在目录，失败由 pipeline 的 Promise 出口收到。",
      "失败后三个 streams 均记录 destroyed: true；错误被处理后进程正常退出。",
    ],
  },
];
