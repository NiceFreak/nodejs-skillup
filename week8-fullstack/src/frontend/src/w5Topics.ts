// W5「Node.js 运行时知识复习板」数据源（展示资产，纯前端静态数据）。
// 只呈现本人已经完成并验收的学习成果；未完成主题不提前制作结论或视觉内容。

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
  lanes: Array<{
    name: string;
    owner: string;
    description: string;
    tone: "stack" | "tick" | "microtask" | "phase";
  }>;
  observations: Array<{
    context: string;
    result: string;
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

export type W5Knowledge = EventLoopKnowledge | CpuBlockingKnowledge;

export const W5_KNOWLEDGE: W5Knowledge[] = [
  {
    id: "event-loop",
    label: "知识点 1",
    title: "事件循环的调度边界",
    question: "一个异步回调为什么在这个时刻执行？",
    kind: "event-loop",
    reasoningPath: ["同步调用栈", "nextTick 检查点", "microtask 检查点", "libuv 阶段推进"],
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
        note: "两者先后不应写成固定结论。",
      },
      {
        context: "I/O callback 内",
        result: "immediate → timer",
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
];
