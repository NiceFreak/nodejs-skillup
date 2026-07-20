# W5 D1 · 事件循环最小模型

> 日期：2026-07-20 ｜ 状态：已整理（顶层调度模型完成并有实测证据；I/O callback 中 timer/immediate 的稳定顺序只开了头，见「未完成 / 明日入口」）
>
> 本笔记由当天一问一答记录整理而成。原始逐字问答保留在 git 历史（笔记整理前的提交）中，本文件只保留结论、证据与关键纠错留痕。

## 今日目标

- 用最小脚本观察 `sync`、`process.nextTick`、Promise microtask、`setTimeout`、`setImmediate` 的执行顺序。
- 区分顶层代码与 I/O callback 中 timer / immediate 的顺序。
- 形成一页事件循环心智模型。

## 明确不做

- libuv 线程池实验（D2）。
- stream、错误生命周期、worker threads（D3–D5）。
- Week2–4 主应用改造。

---

## 一页心智模型（本日核心产出）

```text
一个 Node.js 进程里，JavaScript 由主线程执行。任一时刻只跑一段 JS，
异步回调永远不会插进正在执行的同步代码中间。

当前同步调用栈清空后，调度顺序（CommonJS 顶层）：
  1. 清空 next tick queue        （process.nextTick）
  2. 清空 V8 microtask queue     （Promise.then / queueMicrotask）
  3. 事件循环继续，按阶段推进

libuv 事件循环阶段（简化）：
  timers → pending callbacks → idle/prepare → poll → check → close callbacks
    timers：到期的 setTimeout / setInterval 回调
    poll  ：大多数 I/O callback（如 fs.readFile 完成）
    check ：setImmediate 回调

三条队列/阶段互不隶属，别混成一个：
  ┌ libuv event loop phases  ← 六个阶段
  ├ Node next tick queue     ← process.nextTick（不属于任何阶段）
  └ V8 microtask queue       ← Promise.then（不属于任何阶段）

每一轮阶段之间，Node 都会先把 next tick queue 和 microtask queue 清空，
再进入下一个阶段。
```

---

## 分主题详解

### 1. 同步边界：注册 vs 执行

- 顶层遇到"安排一个异步回调"时，**当场只完成注册/安排**；回调函数体的执行要等：当前同步调用栈清空 → 回调已就绪 → 轮到相应调度机会。
- 表述要精确：不是"等主线程执行结束"——主线程执行完这段同步代码后还要继续执行后续回调，进程并没有结束。
- "异步工作完成" ≠ "回调立即执行"。异步完成只是让回调进入队列，仍要排队等主线程。

一句纠错：Node 不是"整个进程只有一个线程"，而是**JS 由主线程执行**；libuv 另有线程池供部分任务使用（D2 展开）。也**不存在**统一的"异步进程池"这种东西。

### 2. 三层队列：谁属于事件循环阶段，谁不属于

| 名字 | 归属 | 说明 |
|---|---|---|
| `process.nextTick` | Node next tick queue | **不属于**六个事件循环阶段；每次调度机会优先清空 |
| `Promise.then` / `queueMicrotask` | V8 microtask queue | **不属于**六个事件循环阶段；由 V8 管理 |
| 到期 timer 回调 | `timers` 阶段 | libuv 阶段 |
| 多数 I/O callback | `poll` 阶段 | libuv 阶段 |
| `setImmediate` | `check` 阶段 | libuv 阶段 |
| 延迟到下一轮的系统级 I/O 回调 | `pending callbacks` 阶段 | 不是"所有还没执行的回调" |
| socket/handle 关闭回调 | `close callbacks` 阶段 | libuv 阶段 |

关键区分：普通英文 "pending"（还没执行）**不等于**名为 `pending callbacks` 的那个 libuv 阶段。不能因为 `Promise.then` "还没执行"就把它塞进 `pending callbacks`——它压根不是事件循环阶段的居民，而是 V8 microtask，有自己的清空时机。

### 3. CommonJS vs ESM 顶层顺序（同一份代码，唯一变量是模块系统）

实验代码（`.js` 与 `.mjs` 内容完全一致）：

```js
console.log('start');
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
console.log('end');
```

实测结果：

```text
CommonJS (npm run day1)：   start → end → nextTick → promise
ESM      (node *.mjs)：     start → end → promise → nextTick
```

为什么不同：

- **CommonJS 顶层**：普通脚本执行完 → Node 获得调度机会 → 先清 next tick queue → 再清 microtask queue。所以 `nextTick` 先。
- **ESM 顶层**：模块求值本身就处在一个 microtask 处理上下文里 → 求值期间注册的 `Promise.then` 进入**当前正在处理的** microtask checkpoint → V8 继续把 microtask queue 清完 → Node 之后才处理 next tick queue。所以 `promise` 先。

**面试可用的准确表达**（比"nextTick 永远最优先"更站得住）：

> `nextTick` queue 通常在 Node 继续事件循环前清空，但它**不会抢占**正在执行的同步调用栈，也**不会中断** ESM 顶层已经开始的 microtask checkpoint。所以"nextTick 永远第一"只在 CommonJS 常见场景成立，缺少上下文限定。

补充：Node 24 文档已把 `process.nextTick()` 标为 Legacy，业务代码更推荐 `queueMicrotask()`；但理解 `nextTick` 仍是读历史代码和分析调度的必要能力。

### 4. `setTimeout(cb, 0)` 与 `setImmediate`

- `setTimeout(cb, 0)` **不保证** 0ms 执行。`0`（小于 1ms 的 delay）会被归一化到约 1ms，它是**最早可调度的时间阈值**，不是精确执行时刻。阈值到达后，回调还要等同步代码、nextTick/microtask、以及事件循环其他工作完成。
- `setImmediate` 的回调在 `poll` 之后的 `check` 阶段执行。名字有误导——不是"立刻"，而是"安排到 check 阶段"。
- 术语纠正：没有"异步调用栈"这种东西。只区分四类容器：`JS call stack` / `next tick queue` / `microtask queue` / `event loop phase queues`。

### 5. 顶层 `setTimeout(0)` vs `setImmediate`：顺序不确定

顶层同时注册两者，**不能**仅凭阶段图 `timers … check` 的先后就断言 `setTimeout(0)` 一定先跑。事件循环开始处理时，1ms 阈值是否已到受进程启动时机影响，因此顺序不确定。

实测样本（本机 Node v24.16.0，仅为样本、非概率保证）：

```text
本人连续 10 次： 全部 setImmediate → setTimeout
独立 100 次：    94 次 setImmediate 先，6 次 setTimeout 先
```

记录口径修正：应写"本次样本中 setImmediate 先输出"，而不是"setImmediate 更快"——后者听起来像性能结论，前者才是观察到的调度顺序。

> 稳定关系只在 **I/O callback 内部**注册两者时才出现（见下方未完成项）。

### 附：CommonJS vs ESM 模块系统速览（为解释第 3 节的顺序差异服务）

| 维度 | CommonJS | ESM |
|---|---|---|
| 导入导出 | `require()` / `module.exports` | `import` / `export` |
| 加载模型 | 传统上同步加载为主 | 模块图加载/求值带异步语义 |
| 文件判定 | `.cjs` 或最近 `package.json` `"type":"commonjs"` | `.mjs` 或 `"type":"module"` |
| top-level await | 不支持 | 支持 |
| 上下文变量 | 有 `require`/`module`/`__dirname` | 不直接提供 |

常见互操作坑：ESM 里误用 `require`/`__dirname`；CJS 项目依赖只发 ESM 的包；默认/具名导出形状不符；双包（CJS+ESM）状态不一致。旧说法"CommonJS 完全不能加载 ESM"在 Node 24 已不准确——`require()` 可加载满足条件的同步 ESM，但带 top-level await 的模块仍有边界。本项目 Week2–4 应用本身是 ESM，所以这组对照能映射回真实项目。

---

## 验证证据

```text
① minimal-event-loop.js  (CommonJS)  → start / end / nextTick / promise
② minimal-event-loop.mjs (ESM)       → start / end / promise / nextTick
③ top-level-timer-immediate.js ×10   → 10/10 setImmediate 先
   独立 100 次复跑              → 94 setImmediate 先 / 6 setTimeout 先
```

三个脚本位于 `week5-nodejs-internals/src/`，运行入口见 `README.md`（`npm run day1` 等）。

## 预测→纠正 留痕（"预测错误并能解释"的证据）

| # | 我的初始预测/理解 | 纠正后的正确理解 |
|---|---|---|
| 1 | Node 整体单线程 + libuv 引入"多进程机制"，异步放"异步进程池" | JS 由主线程执行；libuv 提供事件循环/I-O 抽象/线程池；无统一"异步进程池" |
| 2 | 回调执行要等"主线程执行结束" | 等当前同步调用栈清空、轮到调度机会；主线程之后还要继续跑回调 |
| 3 | `Promise.then` 属于 `pending callbacks` / `close callbacks` 阶段 | 属于 V8 microtask queue，不属于任何事件循环阶段 |
| 4 | 预测 `start → nextTick → end`（nextTick 插进了同步代码中间） | `start → end → nextTick`；队列优先 ≠ 可抢占当前调用栈 |
| 5 | ESM 下仍是 `nextTick → promise`（nextTick 永远最优先） | ESM 下是 `promise → nextTick`；nextTick 不中断进行中的 microtask checkpoint |
| 6 | `setTimeout(0)` 的 `0` = 期望立即执行 | `0` = 最早可调度阈值（约 1ms），不保证精确执行时刻 |
| 7 | `setImmediate` 在 `pending callbacks` 阶段 | 在 `poll` 之后的 `check` 阶段 |

最有代表性的一次错误是 #4：把"队列优先级"误当成"可以抢占当前同步调用栈"。这是今天"预测错、并能定位到哪一层错"的核心证据。

## 可迁移到业务代码的判断（映射回 W2–4，部分待后续验证）

- **W4 登录计时枚举**：`bcrypt.compare` 是 CPU 工作，错误密码走完一次 compare（约 314ms）vs 不存在邮箱提前 return（约 2ms）的可观察差异，本质就是"主线程被 CPU 工作占用了多久"。D2 会正式区分 CPU 慢 vs I/O 慢。
- **MongoDB 查询 vs bcrypt/jwt**：查询是 I/O（网络，走 poll 阶段回调）；`bcrypt`/`jwt` 签名验证是 CPU（占主线程）。这条区分是 D2 判断表的入口。
- **Express async error**：中间件里的异步错误如何进全局 error handler，属 D4 错误边界主题，今天先挂账。

---

## 已完成 / 未完成

已完成：

- 顶层调度模型：同步不可抢占、注册 vs 执行、三层队列区分、CJS/ESM 顶层顺序差异，均有实测证据。
- 一页心智模型产出。
- 至少一次预测错误并定位到具体队列/阶段（见留痕 #4、#5）。

未完成：

- **I/O callback 内部** `setTimeout(0)` vs `setImmediate` 的**稳定顺序**结论：记录里只答到"`fs.readFile` 的 callback 通常在 `poll` 阶段执行"（凭记忆，未查证确认），尚未做 I/O callback 内注册两者的对照实验，也未落笔结论。

## 明日入口

1. 先补完 D1 遗留：在一个 `fs.readFile` 的 callback **内部**同时注册 `setTimeout(0)` 与 `setImmediate`，预测→运行→解释。预期这里顺序是稳定的（与第 5 节顶层的不确定形成对照），需自己验证并写清"为什么 I/O callback 内稳定、顶层不稳定"。
2. 进入 D2：libuv 线程池与 CPU 阻塞——用 demo 观察 CPU 密集任务阻塞 timer/HTTP 响应，明确 `UV_THREADPOOL_SIZE` 的作用边界，产出"I/O 慢 vs CPU 慢 vs 线程池慢"判断表。
