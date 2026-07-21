// W5「Node.js 底层理解展示板」数据源（展示资产，纯前端静态数据，不调后端）。
// 内容来自本人 week5-nodejs-internals/notes 的 day1 / day2 笔记，AI 只做搬运与体例整理，不生成新结论。
// D3–D5 尚未学到，先留占位；学到哪填到哪。

export type W5Status = "done" | "active" | "planned";

export interface W5Bar {
  label: string;
  value: number;
  max: number;
  unit: string;
  tone: "good" | "warn";
}

export interface W5Topic {
  day: string;
  title: string;
  status: W5Status;
  focus: string;
  evidence: string[];
  bars?: W5Bar[];
  judgment?: string;
  mapping: string;
  plannedNote?: string;
}

export const W5_TOPICS: W5Topic[] = [
  {
    day: "D1",
    title: "事件循环最小模型",
    status: "done",
    focus: "回调何时被调度：三条互不隶属的队列 + libuv 六阶段。",
    evidence: [
      "同一时刻只跑一段 JS，异步回调不会插进正在执行的同步代码。",
      "顶层调度：清 nextTick 队列 → 清 microtask 队列 → 事件循环按阶段推进。",
      "libuv 六阶段：timers → pending → idle/prepare → poll → check → close。",
      "三条互不隶属：libuv 阶段 / Node nextTick / V8 microtask。",
      "顶层 timer vs immediate 顺序不定；I/O callback 内 immediate 稳定先于 timer。",
      "任务饥饿：持续入队 nextTick / microtask → 检查点结束不了 → 事件循环卡住。",
    ],
    judgment: "能靠「调用栈 → 检查点(nextTick→microtask) → 阶段」推导回调顺序，不背图。",
    mapping: "Express async 中间件里 Promise 回调、错误何时进事件循环的时机判断。",
  },
  {
    day: "D2",
    title: "libuv、线程池与阻塞判断",
    status: "active",
    focus: "异步工作在哪里执行、慢在哪里发生。",
    evidence: [
      "隔离运行：CPU 20ms → timer 等待 100ms / 迟到 0ms。",
      "隔离运行：CPU 2000ms → timer 等待 2004ms / 迟到 1904ms。",
      "现象支持：同步 CPU 任务阻塞 timer callback，CPU 越久 timer 迟到越多。",
      "并行两组会引入 CPU 竞争，不作对照；正式结论采用隔离运行。",
    ],
    bars: [
      { label: "CPU 20ms", value: 0, max: 1904, unit: "ms 迟到", tone: "good" },
      { label: "CPU 2000ms", value: 1904, max: 1904, unit: "ms 迟到", tone: "warn" },
    ],
    judgment: "CPU 密集 JS 阻塞事件循环 → timer / HTTP 响应被推迟。",
    mapping: "bcrypt、JWT 签名是 CPU 密集；同步大计算会拖慢同进程所有请求。",
    plannedNote: "线程池排队、UV_THREADPOOL_SIZE 对照、判断表尚未开始。",
  },
  {
    day: "D3",
    title: "Stream 与背压",
    status: "planned",
    focus: "大数据为什么不能一次性读进内存。",
    evidence: [],
    mapping: "报表导出 / 日志处理为什么该用 stream 而不是 readFile。",
    plannedNote: "未开始。计划：readFile vs stream 内存对比、producer/consumer 背压信号。",
  },
  {
    day: "D4",
    title: "错误边界与进程生命周期",
    status: "planned",
    focus: "错误在哪一层被捕获，何时该让进程退出。",
    evidence: [],
    mapping: "Express error handler 边界 vs 进程级致命异常。",
    plannedNote: "未开始。计划：错误流向图（谁捕获、到哪层）+ graceful shutdown 最小链路。",
  },
  {
    day: "D5",
    title: "Worker 边界 + 周复盘串讲",
    status: "planned",
    focus: "什么任务该移出主线程。",
    evidence: [],
    mapping: "CPU 密集该给 worker；普通 I/O 慢不是 worker 的默认答案。",
    plannedNote: "未开始。计划：主线程阻塞 vs worker offload 的响应能力对照。",
  },
];
