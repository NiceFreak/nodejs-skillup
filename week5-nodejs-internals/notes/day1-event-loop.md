# W5 D1 · 事件循环最小模型

> 日期：2026-07-20
>
> 状态：进行中。今天只处理顶层代码与 I/O callback 中的异步调度顺序；先预测，再运行，再解释。

## 今日目标

- 用最小脚本观察 `sync`、`process.nextTick`、Promise microtask、`setTimeout`、`setImmediate`。
- 区分顶层代码与 I/O callback 中 timer / immediate 的顺序。
- 形成一页事件循环心智模型。

## 明确不做

- libuv 线程池实验。
- stream、错误生命周期、worker threads。
- Week2–4 主应用改造。

## 自己的预测或设计

待记录。

## 实现与观察

待记录。

## 解释与修正

待记录。

## 验证证据

待记录。

## 已完成 / 未完成

待记录。

## 明日入口

待记录。


以下为 day 1 问答记录. 总体结构为一问一答, 需要在笔记整理时优化.

已切换到 W5 D1，状态入口和当天笔记已更新；本机 Node.js 为 `v24.16.0`，原工作区干净，文档 diff 检查通过。

现在开始「事件循环 / D1-A：顶层调度」：

请在 `week5-nodejs-internals/src/` 自己写一个最小脚本，包含同步日志，以及各一个 `process.nextTick`、Promise microtask、`setTimeout(..., 0)`、`setImmediate`。**先不要运行。**

唯一问题：你预测完整输出顺序是什么？把脚本和预测一起发来，我只验收预测和推理，不直接给实现或答案。

A: 这个问题比较大, 请先拆解为更细致的问题

刚才的问题混合了“写脚本、预测五类任务、解释队列、比较执行阶段”，确实需要拆开。

D1 将依次处理：

1. 同步代码与异步回调的边界
2. “注册回调”和“执行回调”的区别
3. `process.nextTick` 与 Promise microtask
4. 顶层代码中的 `setTimeout` 与 `setImmediate`
5. I/O callback 中的 timer 与 immediate
6. microtask / nextTick 饥饿风险
7. 最后才组合成完整预测题

现在只做「事件循环 / D1-1：同步代码边界」。

假设 Node.js 正在执行一个文件：

```text
打印 A
安排一个异步回调
打印 B
```

唯一问题：在这个文件的同步代码执行完之前，那个异步回调会不会插到 A 和 B 中间执行？请只回答“会 / 不会”，再说一句理由。

A: 我先不查资料, 凭借记忆回答, 如果错误请直接纠正. Node.js 总体是单线程, 但是通过 libuv 引入了多进程机制, 总体而言, 事件循环机制分为六个阶段: pendings callbacks, timers, idle/prepare, poll, closing callbacks. 因此, 若我理解无误, 假设 Node.js 正在执行一个文件, 在这个文件的同步代码执行完之前, 那个异步回调不会插到  A 和 B 中间执行, 而是放入异步进程池, 异步执行结束后返回结果.
刚刚再次暴露了问题拆解粒度的问题, 同时请给我一套搭建运行 week5 脚本的环境的代码, 我现在先完成这一步.

Week 5 运行环境已建立：

- [package.json](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/package.json) 提供 `npm run day1` 和 `npm run day1:watch`
- [README.md](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/README.md) 记录环境准备方式
- 没有第三方依赖，不需要 `npm install`
- 核心脚本保持空白，也没有提前运行
- 配置解析与 diff 检查通过

D1-1 结论正确，可以通过：异步回调不会插入 A 和 B 之间。

但理由需要纠正：

- 更准确地说，是 JavaScript 在一个 Node.js isolate 中通常由一个主线程执行，不是整个 Node.js 只有一个线程。
- libuv 提供事件循环、I/O 抽象和供部分任务使用的线程池，不是“多进程机制”。
- 不存在统一的“异步进程池”。不同任务可能交给操作系统异步 I/O、libuv 线程池，或者只是等待对应事件循环阶段。
- 异步工作完成，不代表回调立即执行。回调最终仍要等当前 JavaScript 调用栈清空，再由主线程执行。
- 你列出的阶段少了 `check`。简化顺序是：`timers → pending callbacks → idle/prepare → poll → check → close callbacks`。

现在只进入「事件循环 / D1-2：注册与执行」。

唯一问题：Node.js 在顶层代码中遇到“安排一个异步回调”时，**当场完成的是回调注册，还是回调函数体的执行？** 二选一，并说明另一件事要等到什么时候发生。

A: 这个问题是顺着上一步的纠错和记忆回答的, Node.js 在顶层代码中遇到“安排一个异步回调”时, 当场完成的是回调注册, 回调函数体的执行需要在主线程执行结束后再执行.
你认为是否有必要查找资料?

D1-2 通过。你的核心判断正确，但准确表述应是：

```text
当场：注册或安排回调
稍后：当前同步调用栈清空、回调已就绪，并轮到相应调度机会时执行回调
```

不是“主线程执行结束”，因为主线程还要继续执行后续回调。

有必要查资料，但顺序应当是：

```text
独立预测 → 运行观察 → 阅读官方文档 → 修正模型
```

D1-2 暂时不用查，因为当前目的是暴露原始理解；形成最终结论前则必须查。Node 20 起 libuv 调整过 timer 的运行时机，而且 CommonJS 与 ESM 顶层的 `nextTick` / microtask 顺序也存在差异，旧文章可能不适用于当前 Node 24。[Node.js 事件循环官方说明](https://nodejs.org/zh-tw/learn/asynchronous-work/event-loop-timers-and-nexttick)、[Node.js Process 官方文档](https://nodejs.org/download/release/v22.18.0/docs/api/process.html)

我已把首轮实验固定为 CommonJS，避免现在同时引入 ESM 加载语义；配置检查通过。

现在进入「事件循环 / D1-3A：队列与阶段」。

唯一问题：`process.nextTick` 回调和 Promise `.then` 回调，是否分别属于六个事件循环阶段中的某两个阶段？请先凭理解回答“是 / 不是”，不要查资料，也暂时不用判断它们谁先执行。

D1-2 通过。你的核心判断正确，但准确表述应是：

```text
当场：注册或安排回调
稍后：当前同步调用栈清空、回调已就绪，并轮到相应调度机会时执行回调
```

不是“主线程执行结束”，因为主线程还要继续执行后续回调。

有必要查资料，但顺序应当是：

```text
独立预测 → 运行观察 → 阅读官方文档 → 修正模型
```

D1-2 暂时不用查，因为当前目的是暴露原始理解；形成最终结论前则必须查。Node 20 起 libuv 调整过 timer 的运行时机，而且 CommonJS 与 ESM 顶层的 `nextTick` / microtask 顺序也存在差异，旧文章可能不适用于当前 Node 24。[Node.js 事件循环官方说明](https://nodejs.org/zh-tw/learn/asynchronous-work/event-loop-timers-and-nexttick)、[Node.js Process 官方文档](https://nodejs.org/download/release/v22.18.0/docs/api/process.html)

我已把首轮实验固定为 CommonJS，避免现在同时引入 ESM 加载语义；配置检查通过。

现在进入「事件循环 / D1-3A：队列与阶段」。

唯一问题：`process.nextTick` 回调和 Promise `.then` 回调，是否分别属于六个事件循环阶段中的某两个阶段？请先凭理解回答“是 / 不是”，不要查资料，也暂时不用判断它们谁先执行。

回答问题前, 我想先问, commonjs, esm 的区别, 以及两者混用在实际工作可能遇到的项目以及面试中都是经常会遇到的情况和问题, 我们在当前阶段是否需要考虑这些情况?

需要考虑，但必须控制范围。它确实是实际项目和面试中的常见问题，而且已经直接影响今天的事件循环实验；但现在不应该扩展成完整的模块系统专题。

CommonJS 与 ESM 的核心区别：

| 维度 | CommonJS | ESM |
|---|---|---|
| 定位 | Node.js 早期模块系统 | JavaScript 官方标准模块系统 |
| 导入导出 | `require()` / `module.exports` | `import` / `export` |
| 模块加载模型 | 传统上以同步加载为主 | 模块图加载和求值带有异步语义 |
| Node 文件标记 | `.cjs` 或 `"type": "commonjs"` | `.mjs` 或 `"type": "module"` |
| 顶层能力 | 没有 ESM 的 top-level `await` | 支持 top-level `await` |
| 常用上下文变量 | 有 `require`、`module.exports`、`__dirname` | 不直接提供这些 CommonJS 变量 |

Node 会根据文件扩展名和最近的 `package.json` 中的 `"type"` 判断 `.js` 属于哪种模块。[Node.js v24 ESM 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/esm.html)

实际项目中常见的问题包括：

- ESM 文件中直接使用 `require` 或 `module.exports`。
- CommonJS 项目依赖了只发布 ESM 的包。
- 默认导出和具名导出在互操作时形状不符合预期。
- 测试、脚本和构建工具采用了不同模块模式。
- ESM 中继续使用 `__dirname` 等 CommonJS 变量。
- 包含 top-level `await` 的 ESM 无法通过部分同步加载路径使用。
- 同一份库同时发布 CJS/ESM 时出现双包状态不一致。

一个需要更新的旧说法是：“CommonJS 完全不能加载 ESM”已经不够准确。当前 Node 24 的 `require()` 可以加载满足条件的同步 ESM，但带 top-level `await` 的模块仍有边界；具体规则应以目标 Node 版本为准。

对当前 W5 的取舍是：

```text
必须掌握：
Node 如何判断 CJS / ESM
两者的基本语法与加载模型
为什么模块上下文会影响顶层 nextTick / microtask 观察结果
常见互操作错误如何定位

今天不展开：
双格式 npm 包发布
复杂 exports 条件映射
自定义 loader
完整模块解析算法
历史版本兼容矩阵
```

今天先在 CommonJS 下建立事件循环基线，再用相同实验做一次 ESM 对照。这不是额外开一条学习线，而是控制实验变量；你的 Week2–4 应用本身使用 ESM，因此这次对照也能映射回真实项目。

刚才的「D1-3A」暂时保持不变：`process.nextTick` 和 Promise `.then` 是否属于六个事件循环阶段中的某两个阶段？只判断“是 / 不是”，暂时不比较执行顺序。

A: 此题完全凭借记忆回答: process.nextTick 是 nodejs 中的特殊任务, 优先级最高, 不属于事件循环机制的某个阶段. Promise.then 属于微任务, 属于六个事件循环阶段中的 pending callbacks 和 closing callbacks

D1-3A 部分正确，暂不判通过。

正确部分：

```text
process.nextTick
→ Node.js 特殊的 next tick queue
→ 不属于 libuv 的六个事件循环阶段
```

需要纠正的部分：

```text
Promise.then
→ V8 管理的 microtask queue
→ 同样不属于六个事件循环阶段
```

`pending callbacks` 不是“尚未执行的所有回调”，它处理的是某些被延迟到下一轮的系统级 I/O 回调；`close callbacks` 处理的是 socket/handle 等资源的关闭回调。它们都不是 Promise microtask 的归属。[Node.js 事件循环阶段说明](https://nodejs.org/zh-tw/learn/asynchronous-work/event-loop-timers-and-nexttick)

当前可以先形成三层区分：

```text
libuv event loop phases
  timers / pending / poll / check / close 等

Node.js next tick queue
  process.nextTick

V8 microtask queue
  Promise.then / queueMicrotask
```

现在只做「事件循环 / D1-3A 修正确认」。

唯一问题：为什么不能因为 Promise `.then` “还没有执行”，就把它归入 `pending callbacks` 阶段？请用一句话回答。

A: 总体看下来, Node.js 提供了比浏览器更复杂的运行环境, 你的三层区分中, 浏览器是不是仅支持 V8 引擎的微任务, 宏任务系统? 此题查询了资料并结合刚刚的补充理解后作答, 因为虽然 Promise `.then` “还没有执行”, 但是作为微任务, 他有自己的清空时间: 每个宏任务的结束间隙, 而 pending callbacks 专指上一轮循环遗留的系统级 I/O 异常回调, 因此不能归入.

D1-3A 修正确认通过。你已经区分了：

```text
“pending”这个普通英文描述
≠
名为 pending callbacks 的特定 libuv 阶段
```

你的理由基本正确，但两处需要收紧：

- “每个宏任务结束间隙”更接近浏览器教学表达。对 Node.js，目前先表述为：当前 JavaScript 操作完成后，Node 先处理 `nextTick` queue，随后处理 V8 microtask queue，再让事件循环继续。
- `pending callbacks` 不只应记成“异常回调”，更准确是某些被延迟到下一轮执行的系统操作/I/O 回调；TCP 错误只是典型例子。

关于浏览器：不是“只支持 V8 的微任务和宏任务”。

```text
ECMAScript 语言层
  Promise jobs

浏览器宿主层
  task queues
  microtask queue
  timer / 网络 / 用户事件
  rendering / requestAnimationFrame 等

Node.js 宿主层
  libuv event loop phases
  Node nextTick queue
  V8 microtask queue
```

关键修正：

- 浏览器不都使用 V8。Chromium 使用 V8，Firefox 和 Safari 使用其他 JavaScript 引擎。
- “macrotask”是常见教学术语；HTML 规范主要使用 `task` 和 `task queue`。
- 浏览器也不只有一个简单的宏任务队列，还要协调网络、计时器、用户事件和渲染。
- ECMAScript 定义 Promise Job，具体如何接入运行循环由浏览器或 Node.js 这样的宿主环境决定。[ECMAScript Jobs 规范](https://tc39.es/ecma262/#sec-jobs-and-host-operations-to-enqueue-jobs)、[HTML Event Loop 规范](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops)
- 因此不能简单说 Node 比浏览器“更复杂”；两者的宿主职责不同。

现在进入「事件循环 / D1-3B：CommonJS 下的队列优先级」。

当前同步调用栈清空后，如果顶层代码各注册了一个 `process.nextTick` 回调和 Promise `.then` 回调，你预测哪一个先执行？只回答顺序和一个理由，先不运行、不查资料。

A: process.nextTick 最先执行, .then 后执行. 理由和之前的分析一样 前者属于Node.js next tick queue, 优先级最高

D1-3B 通过。在当前限定的 **CommonJS 顶层上下文**中：

```text
当前同步调用栈清空
→ 清空 next tick queue
→ 清空 V8 microtask queue
→ event loop 继续
```

但“`process.nextTick` 永远优先级最高”不能作为全局结论，因为 ESM 顶层上下文是已知例外。当前答案在本题限定范围内正确。

现在进入「事件循环 / D1-3C：第一次运行前预测」。

请你在空的 [minimal-event-loop.js](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/src/minimal-event-loop.js) 中亲自写四个可观察动作：

```text
同步打印 start
注册 nextTick 回调，回调打印 nextTick
注册 Promise.then 回调，回调打印 promise
同步打印 end
```

先不要运行。唯一问题：你预测终端中四行输出的完整顺序是什么？把代码和预测记录到今日笔记。

A: 先写预测输出:
start
nextTick
end
promise

代码: 
console.log('start');
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
console.log('end');

代码静态检查符合题目，但预测暂不通过，先不要运行。

冲突点在这里：

```text
你的 D1-1 结论：
异步回调不会插入正在执行的顶层同步代码

当前预测：
start
nextTick  ← 插入了同步代码
end
```

`process.nextTick` 的“优先”是指：**当前同步调用栈清空以后，它比其他待处理队列更早执行**。它不会抢占正在执行的同步代码。

现在只做 D1-3C 修正：基于这个边界，重新写出四行预测顺序。仍然不要运行脚本。

重答: 已经理解错误所在, 更正如下
start
end
nextTick
promise

D1-3C 修正通过。现在的预测同时满足：

```text
同步调用栈先执行完：start → end
next tick queue 再清空：nextTick
V8 microtask queue 随后清空：promise
```

现在进入「D1-3D：运行验证」。

在 `week5-nodejs-internals/` 下执行：

```bash
npm run day1
```

把实际四行输出记录到今日笔记。唯一问题：实际结果是否与修正后的预测完全一致？若不一致，只记录差异，暂时不要查原因。

➜  src git:(main) ✗ npm run day1

> week5-nodejs-internals@1.0.0 day1
> node src/minimal-event-loop.js

start
end
nextTick
promise

运行结果与修正后的一致

D1-3D 通过。实际现象支持当前 CommonJS 模型：

```text
同步代码完成
→ next tick queue
→ V8 microtask queue
```

第一次预测错误也已经定位：你曾把“队列优先级”误解成“可以抢占当前调用栈”。这将作为今天“预测错误并能解释”的一项证据。

现在进入「D1-3E：只改变模块上下文」。

新建 `src/minimal-event-loop.mjs`，内容与当前 `.js` 文件完全一致。先不要运行。

唯一问题：在 ESM 顶层执行相同代码时，你预测四行输出是否仍与 CommonJS 相同？如果不同，只写出预测顺序和原因。

A: 文件已经创建, 我预测仍然相同, 同步应该是主线程的最高优先级调用栈, 异步队列不会抢占

ESM 文件与 CommonJS 文件内容一致，单变量控制正确。

但预测理由暂不通过：你只解释了为什么 `start → end` 仍然最先完成，没有解释 ESM 中 `nextTick` 与 `promise` 的相对顺序。同步代码不会被抢占这一点，在两种模块模式下都成立，不是本次对照变量。

现在只做 D1-3E 补答：

```text
start
end
第三行？
第四行？
```

唯一问题：ESM 模块的顶层求值本身处于 microtask 处理上下文，这会让 Promise microtask 和 `nextTick` 中哪一个先执行？据此补全四行预测，仍不要运行。

补全: ESM 模块的顶层求值本身处于 microtask 处理上下文, 但是 nextTick 应该依然更高, 
start
end
nextTick
promise
不变

D1-3E 补答不通过。这里正是“`nextTick` 永远优先”这个心智模型失效的地方。

CommonJS 顶层：

```text
普通脚本执行完成
→ Node 获得调度机会
→ next tick queue
→ V8 microtask queue
```

ESM 顶层：

```text
模块求值本身已经是 microtask
→ 求值期间注册 Promise.then
→ Promise reaction 进入当前正在处理的 microtask queue
→ V8 继续清空 microtask queue
→ Node 随后才获得机会处理 next tick queue
```

因此预测应修正为：

```text
start
end
promise
nextTick
```

`nextTick` 的优先级不会中断一个已经开始的 microtask checkpoint。Node 官方文档也明确区分了 CJS 与 ESM 的这个顺序。[Node.js Process 文档](https://nodejs.org/api/process.html#when-to-use-queuemicrotask-vs-processnexttick)

现在进入运行验证。执行：

```bash
node src/minimal-event-loop.mjs
```

把实际输出记入今日笔记。唯一问题：实际结果是否支持上述 ESM 调度解释？

实际输出: 
➜  src git:(main) ✗ node minimal-event-loop.mjs
start
end
promise
nextTick
CJS 和 ESM 的这一区别和我之前看过的资料确实是我所未见的, 很多资料明确说 nextTick 是最特殊的, 优先处理. 但是当前的运行支持了你的解释

D1-3E 运行验证通过。你现在有了两组单变量实验：

```text
CommonJS：start → end → nextTick → promise
ESM：     start → end → promise → nextTick
```

很多资料把“`nextTick` 优先级最高”当作便于入门的简称。在 CommonJS 常见场景中成立，但缺少上下文限定；更准确的面试表达是：

> `nextTick` queue 通常在 Node 继续事件循环前清空，但它不会抢占当前调用栈，也不会中断 ESM 顶层已经进行中的 microtask checkpoint。

另外，当前 Node 文档已把 `process.nextTick()` 标为 Legacy，一般业务代码更推荐 `queueMicrotask()`；但理解 `nextTick` 仍是分析历史代码和 Node 调度机制的必要能力。[Node.js Process 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/process.html#processnexttickcallback-args)

现在进入「事件循环 / D1-4A：timer 的时间含义」。

唯一问题：`setTimeout(callback, 0)` 是否保证回调在 0 毫秒后立刻执行？只回答“保证 / 不保证”，再用一句话说明你认为 `0` 表示什么。

A: 不保证, 0 表示的是用户期望立即执行, 但是实际上还是需要等待异步调用栈的微任务执行清空后才能最快执行

D1-4A 部分通过：“不保证”正确，但 `0` 的含义需要修正。

在当前 Node 24 中：

```text
setTimeout(callback, 0)
→ 小于 1ms 的 delay 会被归一化为 1ms
→ 1ms 是最早可调度的时间阈值
→ 不是精确执行时间
```

阈值到达后，回调还要等待当前同步操作、`nextTick` / microtask，以及事件循环中的其他工作完成，所以实际时间可能更晚。Node 官方文档明确说明不保证精确触发时间。[Node.js v24 Timers 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/timers.html#settimeoutcallback-delay-args)

术语也要修正：没有“异步调用栈”。当前只区分：

```text
JavaScript call stack
next tick queue
microtask queue
event loop phase queues
```

现在只做 D1-4A 修正确认：请用一句话重新解释 `setTimeout(callback, 0)` 中的 `0`，必须包含“阈值”和“不保证精确执行”两个意思。

修正: setTimeout(callback, 0)` 中的 `0` 表示的是最早可调度的时间阈值, 但不是精确的执行时间, node 无法做出这个保证

D1-4A 修正确认通过。当前表述准确：

```text
delay 是最早可调度阈值
≠
回调的精确执行时刻
```

现在进入「事件循环 / D1-4B：`setImmediate` 的归属」。

唯一问题：`setImmediate` 的回调是在六个事件循环阶段中的哪个阶段执行？请只写阶段名称；如果不记得，可以明确回答“不记得”，暂时不要查资料。

A: setImmediate 在 pending callbacks 中执行

D1-4B 暂不通过。正确归属是：

```text
poll
→ check：执行 setImmediate 回调
→ close callbacks
```

`pending callbacks` 处理某些延迟到下一轮的系统操作/I/O 回调，不负责 `setImmediate`。

`setImmediate` 这个名字容易误导；它不是“立刻执行”，而是把回调安排到事件循环的 `check` 阶段，通常位于 `poll` 阶段之后。

现在只做 D1-4B 修正确认：`setImmediate` 属于哪个阶段，这个阶段与 `poll` 的先后关系是什么？用一句话回答。

A: setImmediate 通常位于 poll 之后, 在 Check 中使用

D1-4B 修正确认通过。更准确的表达是：

> `setImmediate` 的回调在 `poll` 之后的 `check` 阶段执行。

现在进入「事件循环 / D1-4C：顶层 timer 与 immediate」。

在 CommonJS 顶层代码中，同时注册：

```text
setTimeout(callback, 0)
setImmediate(callback)
```

唯一问题：能否仅凭事件循环图中 `timers` 和 `check` 的位置，保证 `setTimeout(0)` 一定先执行？回答“能 / 不能”，再说一句理由。暂时不要写代码或运行。

A. 不能, 我先回忆事件循环图: timers → pending callbacks → idle/prepare → poll → check → close callbacks. timers 和 Check 是整体的事件循环机制, setTimeout 和 setImmediate 也都属于宏任务, 但是两者的具体插入时机由 poll 之后的状态决定, 但是 poll 和 Check 之间发生了什么, 内部都是什么, 我不太记得了

D1-4C 结论正确，可以通过；理由需要补全。

顶层场景中：

```text
初始化脚本注册两者
setTimeout(0) 实际使用至少 1ms 的阈值
setImmediate 等待 check 阶段
事件循环开始处理时，timer 是否已达到阈值受进程时机影响
```

因此不能仅看到阶段图里的 `timers → ... → check`，就断言 timer 一定先执行。Node 官方说明也将主模块中的顺序定义为不确定；而在 I/O callback 内注册时才有更稳定的关系。[Node.js 事件循环说明](https://nodejs.org/zh-tw/learn/asynchronous-work/event-loop-timers-and-nexttick#setimmediate-vs-settimeout)

现在进入「D1-4D：顶层实测」。

请你新建一个 CommonJS 脚本，只注册一个 `setTimeout(..., 0)` 和一个 `setImmediate`，分别打印 `timeout`、`immediate`。然后从 Week 5 根目录重复运行 10 次：

```bash
for i in {1..10}; do node src/top-level-timer-immediate.js; done
```

唯一问题：10 次实际出现了哪一种或哪几种顺序？只记录现象，不要根据 10 次结果写成必然规律。

代码:
setTimeout(() => {
    console.log('setTimeout')
}, 0);
setImmediate(() => {
    console.log('setImmediate')
});

现象: for i in {1..10}; do node top-level-timer-immediate.js; done
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout
setImmediate
setTimeout

当前的 10 次脚本全部是 setImmediate 先输出

D1-4D 通过。记录正确地区分了样本范围：

```text
事实：本机 Node v24.16.0 的 10 次运行全部先输出 setImmediate
不能推导：顶层 setImmediate 永远先于 setTimeout(0)
```

“`setImmediate` 更快”建议改成“本次样本中 `setImmediate` 先输出”。前者像性能结论，后者才是已观察到的调度顺序。

现在进入「事件循环 / D1-5A：I/O callback 所在阶段」。

唯一问题：普通异步 `fs.readFile` 完成后，它的 JavaScript callback 通常在哪个事件循环阶段执行？只回答阶段名称；不记得可以直接说“不记得”，暂时不要查资料。

进入下一个问题前, 我又跑了两次, 全部都是 setImmediate 先输出, 你的模拟有出现不一样的情况吗?

有。我刚在同一台机器、同一 Node `v24.16.0` 下独立启动脚本 100 次，结果是：

```text
94 次：setImmediate → setTimeout
 6 次：setTimeout → setImmediate
```

所以你的连续样本全部是 `setImmediate` 先输出并不异常，只是还没有碰到另一种时序。这里的 `94/6` 也不能当作稳定概率，机器负载和进程启动时机会影响结果。

这组证据正好验证：

```text
顶层调用：
观察上可能偏向某个顺序
≠
Node 保证这个顺序
```

可以把双方样本都记入笔记：你的样本全部 `setImmediate` 在前；独立 100 次验证中两种顺序都出现。记录后我们再回到 D1-5A。

回答 D1-5A: 
普通异步 `fs.readFile` 完成后，它的 JavaScript callback 通常在哪个事件循环阶段执行？
在 poll 阶段, 这是记忆, 没有查资料

D1-5A 通过：普通异步 `fs.readFile` 的 JavaScript callback 通常在 `poll` 阶段执行。

这里保留三个边界：

```text
代码调用：同步代码调用 fs.readFile，注册 callback
I/O 完成：底层完成读取，使 callback 进入可执行状态
回调执行：JavaScript 主线程在 poll 阶段执行 callback
```

现在进入「事件循环 / D1-5B：I/O callback 内的顺序预测」。

假设在 `fs.readFile` 的 callback 内，同时注册：

```text
setTimeout(callback, 0)
setImmediate(callback)
```

唯一问题：你预测谁先执行？请用 `poll`、`check` 和“本轮/下一轮”解释一句理由。暂时不要写代码或运行。

A: 假设在 `fs.readFile` 的 callback 内同时注册 setTimeout(callback, 0) 与 setImmediate(callback), fs.readFile 在同步代码中被调用, callback 被注册放入 poll, 之后主线程在 poll 阶段执行 callback, 本轮应该是不会执行这两个 callback 的, 而在下一轮中, 我预测 setImmediate 会先执行, 在 check 之前, 之后是 setTimeout. 我觉得到这一步全部凭借记忆推理已经到上限. 我们需要系统讲讲主线程与异步的事件循环机制之间的联系.

你的最终顺序预测正确，但推理链有三处错误，因此 D1-5B 暂不通过：

- `fs.readFile` callback 不是注册时就“放入 poll”；I/O 完成后才变为可执行。
- `setImmediate` 在当前这轮的 `check` 阶段执行，不是在 `check` 之前，也不是等下一轮。
- `setTimeout(0)` 才通常要等后续的 timer 调度机会。

你已明确表示推理到达上限。下面按 **L1 原理讲解**处理，不提供实现或代码骨架，因此不触发学习债务。

**主线程与事件循环**

最关键的关系是：

> 事件循环不是另一条 JavaScript 线程；它是让主线程不断选择并执行已就绪 callback 的调度机制。

```text
JavaScript 主线程
  执行顶层同步代码或某个 callback
  每次只执行一段 JavaScript
             │
             ▼
Node.js / libuv
  管理事件循环、I/O 状态和部分线程池任务
             │
             ▼
操作系统或 libuv worker pool
  在后台完成具体 I/O 工作
```

一次 `fs.readFile` 的简化链路：

```text
1. JavaScript 主线程调用 fs.readFile
2. Node 将读取请求交给底层处理并保存 callback
3. fs.readFile 返回；主线程继续执行后续同步代码
4. 文件读取在底层完成
5. libuv 让对应 callback 进入可处理状态
6. 事件循环到达 poll 阶段
7. 主线程同步执行这个 JavaScript callback
8. callback 完成后，事件循环才继续推进
```

因此需要区分：

```text
代码调用顺序：
  何时调用 fs.readFile，何时执行 callback

职责归属：
  fs 是 Node API
  libuv 协调异步文件读取
  JavaScript callback 最终仍由主线程执行

数据来源：
  文件数据在读取完成后作为 callback 参数传入
  不是 fs.readFile 同步返回的文件内容
```

Node 的异步文件系统 API 会使用 libuv worker pool，但 worker 不会替主线程执行你的 JavaScript callback；它只完成底层任务。callback 仍回到事件循环线程执行。[Node.js Event Loop 与 Worker Pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)

**本题时间线**

在简化为单个 I/O callback 的情况下：

```text
poll 阶段
  执行 fs.readFile callback
  callback 内注册：
    setImmediate → 等待 check
    setTimeout(0) → 等待 timer 阈值与后续 timer 调度机会

callback 返回
  处理 nextTick / microtask
  poll 阶段收尾
        ↓
同一轮 check 阶段
  执行 setImmediate
        ↓
后续 timer 调度机会
  执行 setTimeout
```

所以 I/O callback 内的稳定结果是：

```text
setImmediate
setTimeout
```

这和顶层场景不同：顶层注册两者时，事件循环还没有处在明确的 `poll` 上下文，因此顺序不保证；在 I/O callback 中，我们已经知道当前位置是 `poll`，下一阶段是 `check`。[Node.js 事件循环说明](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick#setimmediate-vs-settimeout)

现在只做 D1-5B 修正确认：为什么 `fs.readFile` callback 中注册的 `setImmediate` 可以在同一轮 `check` 执行，而 `setTimeout(0)` 通常要等后续 timer 调度机会？请用两句话回答。

A: 根据这一轮的知识补充, 我初步理解为 JS 主线程总体为同步, 分段执行的代码, 都需要进入异步操作时, 应当只是新开一个异步队列管理事件循环机制. 所以在 `fs.readFile` callback 中注册的 `setImmediate` 和 setTimeout, 因为是在 poll 中完成的, 所以在等待 check 时, 两者出现了差异, setImmediate 在同一轮的 check 中执行, 而 setTimeout 被放到了下一轮的 timers 中等待执行

D1-5B 的顺序推理已经正确：

```text
当前位于 poll
→ setImmediate 等待同一轮 check
→ setTimeout 等待阈值与后续 timer 调度机会
```

但第一句话仍需纠正，所以整体暂不收口：

> “进入异步操作时新开一个异步队列管理事件循环”不正确。

通常一个 Node.js 进程的主线程共享一个事件循环。每次异步调用不会新建事件循环，也不能统一理解为新建一个“异步队列”。

```text
共享的事件循环
├── poll 等阶段的 callback 处理
├── check 阶段的 setImmediate
├── timer 调度
├── next tick queue
└── V8 microtask queue
```

异步 API 做的是注册具体操作和 callback；操作完成后，callback 根据类型在相应的调度位置等待执行。

现在只做系统模型修正：如果顶层代码连续调用三次 `fs.readFile`，它们会创建三个事件循环，还是共享一个事件循环？同时说明每次调用分别登记了什么。用两句话回答。

A: 按照当前的纠错, 应该是共享一个事件循环, 每次 fs.readFile 分别登记各自的 callback

系统模型修正通过。再补一个必要精度：

```text
三次 fs.readFile
→ 共享一个事件循环
→ 分别登记三个读取请求
→ 每个请求关联自己的 callback
```

不只是登记 callback，还要登记“读取哪个文件”的异步请求；否则完成时无法知道该触发哪个 callback、传入哪份结果。

D1-5B 现在可以通过：你已能区分共享事件循环、I/O 请求、callback，以及 `poll → check` 的推进关系。

现在进入「D1-5C：I/O 场景运行前预测」。

请你自行创建 `src/io-timer-immediate.js`：

```text
异步读取现有的 package.json
→ 在 readFile callback 内注册 setTimeout(0)
→ 同一 callback 内注册 setImmediate
→ 两者分别打印 timeout / immediate
```

先记录预测，不要运行。唯一问题：你预测两行输出是什么顺序？理由只写当前所在阶段和下一个阶段。

A: 我去查了 fs 在 node 脚本的 api 语法, 我不太记得具体 api 写法了, 然后写的脚本: 
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'package.json');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('读取文件失败: ', err);
    return;
  }

  console.log('文件读取完成，开始注册定时器...');

  setTimeout(() => {
    console.log('setTimeout');
  }, 0);

  setImmediate(() => {
    console.log('setImmediate');
  });
});
我预测  setImmediate 在前, setTimeout 在后, 理由已经在之前的问答中充分验证, setImmediate 会在本轮的 check 之前执行, 而 setTimeout 要在下一轮的 timers 执行

术语订正:
错误：setImmediate 在 check 之前执行
正确：setImmediate 在同一轮 check 阶段执行

脚本静态检查通过，文件路径与 CommonJS 环境都正确。查询 `fs.readFile` 和 `path.join` 的 API 写法是正常的工具查询，不代表底层模型没有掌握，也不产生学习债务。

预测顺序正确，但术语仍需修正：

```text
错误：setImmediate 在 check 之前执行
正确：setImmediate 在同一轮 check 阶段执行
```

完整预测应是：

```text
文件读取完成，开始注册定时器...
setImmediate
setTimeout
```

现在进入 D1-5D 运行验证。从 Week 5 根目录执行：

```bash
node io-timer-immediate.js
```

把实际输出记录进今日笔记。唯一问题：实际顺序是否支持 `poll callback → 同轮 check → 后续 timer` 这条推导链？

脚本实际输出: 
文件读取完成，开始注册定时器...
setImmediate
setTimeout

poll callback → 同轮 check → 后续 timer, 运行结果支持预测, 术语使用已修订, 这里有一处需要继续追问, 不同阶段之间是否存在运行代码的间隙? 之前的问答经常提到 check 之前, 我产生了 poll 之后, check 之前有运行空间的理解

D1-5D 通过，实测支持：

```text
poll callback → 同轮 check → 后续 timer
```

你的新问题抓到了一个重要术语边界：**阶段之间不存在一个通用的、可供任意 JavaScript 执行的“空隙阶段”**。

更准确的模型是：

```text
poll 阶段
  执行一个 JavaScript callback
    callback 内可以安排其他任务
  callback 返回
    Node 处理 nextTick queue
    V8 处理 microtask queue
  继续处理 poll 队列中的其他 callback（如果有）
  poll 阶段完成
        │
        │ libuv 内部推进，不是新的用户代码阶段
        ▼
check 阶段
  执行 setImmediate callback
```

所以需要区分两件事：

```text
阶段之间的“运行空间”：
  没有一个可以直接投递普通 callback 的匿名阶段。

callback 边界上的调度检查点：
  可能执行 process.nextTick 和 Promise microtask；
  它们不属于六个 libuv 阶段。
```

这也是为什么“`setImmediate` 在 check 之前执行”不正确。准确说法是：

```text
poll callback 返回
→ 处理该 callback 产生的 nextTick / microtask
→ poll 阶段完成
→ 进入 check
→ 执行 setImmediate
```

阶段是 libuv 对 I/O 调度的分类；`nextTick` 和 microtask 是 Node/V8 在 JavaScript callback 边界上插入的高优先级调度机制。[Node.js 事件循环说明](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)、[Node.js Process 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/process.html#when-to-use-queuemicrotask-vs-processnexttick)

现在只做理解确认：如果一个普通 `fs.readFile` callback 内依次安排 `process.nextTick`、Promise `.then` 和 `setImmediate`，callback 返回后你预测三者怎样排序？请用“callback 边界”和 `check` 阶段解释。

A: 如果一个普通 `fs.readFile` callback 内依次安排 `process.nextTick`、Promise `.then` 和 `setImmediate`，callback 返回后, 我预测执行顺序为 process.nextTick -> .then -> setImmediate. 因为按照当前的理解, 阶段与阶段之间不存在匿名空间, 所以 poll callback 返回后, nextTick 最先执行, 之后运行微任务 promise, 之后进入check 执行 setImmediate

理解确认通过。你已经正确区分：

```text
poll callback 返回
→ callback 边界：nextTick
→ callback 边界：Promise microtask
→ poll 完成
→ check：setImmediate
```

笔记中的“`nextTick` 最新执行”应是笔误，按上下文应改为“最先执行”。

现在进入「事件循环 / D1-6A：任务饥饿」。

假设一个 `process.nextTick` callback 每次执行时都再次调用 `process.nextTick` 注册自己，而且永不停止。

唯一问题：事件循环还能否正常进入 `poll` 或 `check` 阶段？回答“能 / 不能”，再用一句话说明原因。暂时不要写或运行这种无限脚本。

A: 不能, 饿死队列的名称已经说明了这种写法会导致任务无法运行下去, 具体原因我推测 process.nextTick 的无限递归会让线程卡死在这里.

D1-6A 结论正确，可以通过。原因需要更精确：

```text
nextTick callback 执行
→ 再登记一个 nextTick callback
→ 当前 callback 返回
→ next tick queue 仍然不为空
→ Node 继续清空 next tick queue
→ event loop 一直得不到进入 poll / check 的机会
```

这不是普通的函数递归调用栈不断加深，因为每个 callback 都会先返回；真正的问题是 `nextTick` queue 被持续补充，调度器无法推进，I/O 和 timer 被“饿死”。

“饿死”描述的是其他任务得不到执行机会，不是队列名称。

现在进入「事件循环 / D1-6B：microtask 饥饿」。

如果不使用 `process.nextTick`，而是让一个 Promise `.then` callback 每次都创建下一个立即 resolved Promise，并永不停止，`timer` 和 I/O callback 能否正常获得执行机会？回答“能 / 不能”，再说一句原因。不要运行无限脚本。

A: 我认为也不能, 但是具体原因我查了一下 promise 的语法, promise 的微任务队列如果不停加入新的微任务, 得不到清空, 事件循环机制一样不能走到下一步, 会一直卡在清空微任务中

D1-6B 通过。更准确地说：

```text
microtask queue 正在被持续清空
但每个 microtask 又登记下一个 microtask
→ 队列永远无法变空
→ microtask checkpoint 无法结束
→ event loop 无法推进到 timer 或 I/O
```

查询 Promise API 语法没有问题；本题验收的是你能否解释队列为何无法让出执行权。

现在进入「事件循环 / D1-7A：组合预测」，这次把已经分别验证过的结论合并起来。

假设 CommonJS 顶层脚本依次包含：

```text
打印 start
注册 nextTick
注册 Promise.then
注册 setTimeout(0)
注册 setImmediate
打印 end
```

唯一问题：哪些输出顺序是确定的，哪两个输出的相对顺序不能保证？不要求给出唯一的六行结果，请用“确定部分 + 不确定部分”回答。暂时不要修改或运行脚本。

A: 确定部分: start -> end -> nextTick -> Promise.then
不确定部分: Promise.then 之后是 setTimeout(0) 在前还是 setImmediate在前

D1-7A 通过。你的部分顺序表达准确：

```text
确定：
start → end → nextTick → promise

不确定：
timeout ↔ immediate
```

这比强行写一个唯一输出更严谨：前四项由同步边界和队列优先级决定，后两项在 CommonJS 顶层没有固定相对顺序。

现在进入「D1-7B：组合实测」。

请自行扩展现有 `minimal-event-loop.js`，加入一个打印 `timeout` 的 `setTimeout(0)` 和一个打印 `immediate` 的 `setImmediate`。然后在当前 `src/` 目录执行：

```bash
node minimal-event-loop.js
```

把实际六行输出记入今日笔记。唯一问题：实际结果是否符合你写出的“确定部分 + 不确定分支”，属于哪一个合法分支？

src git:(main) ✗ node minimal-event-loop.js
start
end
nextTick
promise
setImmediate
setTimeout
我运行了 5 次, 4 次 setImmediate 在前, 1 次 setTimeout 在前. 符合预期, 属于哪一个合法分支我感觉语义有点模糊, 我的理解是属于事件循环机制中 timers 和 check 的合法状态

D1-7B 通过。“合法分支”是我表述得不够清楚，它指的是**符合预测约束的两种输出序列**，不是事件循环内部的“合法状态”。

你实际观察到了两种允许的序列：

```text
start → end → nextTick → promise → immediate → timeout
start → end → nextTick → promise → timeout → immediate
```

因此证据同时支持：

- 前四项顺序确定。
- CommonJS 顶层的 timer/immediate 相对顺序不保证。

现在进入 D1 最后收口。请不要照抄问答，在今日笔记的「解释与修正」中，用不超过 12 行写一份自己的事件循环心智模型，必须包含：

```text
主线程与事件循环的关系
callback 注册与执行的区别
nextTick / Promise 与六个阶段的关系
timers / poll / check 的职责
顶层与 I/O callback 中 timer/immediate 的区别
任务饥饿的原因
```

写完后我会按 D1 止步条件做最终验收。

主线程与事件循环的关系: 在一个主线程中, js 分段执行, 如果遇到需要引入事件循环机制的代码, 将其 callback 放入事件循环队列
callback 注册与执行的区别: 注册先于执行, 注册是一个动作, 执行是另一个动作, 注册是为了将异步任务放入异步队列, 使其不阻塞主线程, 执行则是将其调出并运行
nextTick / Promise 与六个阶段的关系: nextTick / Promise 不属于六个阶段, 一般来说 nexttick 优先级更高, Promise作为微任务也有其优先级, 但是低于 nexttick, 事件循环机制各个阶段执行完之前, 以及主线程执行结束后, 将其清空
timers / poll / check 的职责: timers 负责运行宏任务(timeout, interval), poll 负责处理大部分 IO 回调, check 处理 immediate
顶层与 I/O callback 中 timer/immediate 的区别: 顶层中, timer/immediate 执行顺序并不能确定, 可能存在抖动, 但在 I/O callback 中, 由于 poll 之后就是 check, immediate 稳定先于 timer 执行
任务饥饿的原因: 微任务无法清空, 下一阶段始终无法进入

**阻断性问题**

- [day1-event-loop.md:1068](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1068) 又回到了“callback 放入统一事件循环队列”的模型。Node 没有这样一个统一队列；异步 API 登记具体操作和关联 callback，操作完成后才按类型进入相应调度位置。

- [day1-event-loop.md:1070](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1070) “`nextTick` 总比 Promise 优先、每个阶段结束前或主线程结束后清空”不准确，也与你亲测的 ESM 结果冲突。必须区分 CommonJS 顶层、ESM 顶层和普通 callback 边界；主线程不会“结束后再执行”。

- [day1-event-loop.md:1071](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1071) `timers` 不能概括为“运行宏任务”。它处理达到阈值的 `setTimeout` / `setInterval` callback；`poll` 处理大部分 I/O callback；`check` 执行 `setImmediate` callback。

- [day1-event-loop.md:1073](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1073) 饥饿原因只写了微任务，漏掉 `nextTick`。共同根因应是高优先级队列被持续补充，调度检查点无法结束，事件循环不能推进。

**验证证据**

四个脚本语法检查全部通过。独立运行结果：

```text
CommonJS：start → end → nextTick → promise → timer/immediate 合法分支
ESM：start → end → promise → nextTick
I/O callback：setImmediate → setTimeout
顶层重复 20 次：18 次 immediate 在前，2 次 timeout 在前
```

代码行为没有阻断；阻断集中在最终解释重新引入了错误模型。

如果现在验收，**会不通过**。原因不是 demo 没跑通，而是 W5 的验收目标要求能准确讲清运行时模型，当前六行总结会在真实代码中造成错误推导。

请保持六个主题不变，重写摘要并替换顶部“待记录”内容；不要扩写问答。修改时重点消除“统一异步队列”“主线程结束”“所有场景 nextTick 永远优先”和“timers 等于宏任务”这四种表述。此次属于 L1 review，没有提供答案骨架，不记学习债务。

二次模型校正: 
1. 主线程与事件循环的关系: 在一个主线程中, js 逐行执行同步 JS, 如果遇到需要引入事件循环机制的代码, 将异步 API 登记具体操作和关联 callback，操作完成后才按类型进入相应调度位置
2. callback 注册与执行的区别: 注册先于执行, 注册是一个动作, 执行是另一个动作, 注册是为了将异步任务放入异步队列, 使其不阻塞主线程, 执行则是将其调出并运行. 不存在统一的“事件循环队列”
3. nextTick / Promise 与六个阶段的关系: 两者不属于六个宏任务阶段，各自持有独立高优队列（nextTick 优先于 Promise 微任务）。在每个阶段切换前及每个宏任务回调执行后，会按优先级依次清空它们
4. timers / poll / check 的职责: timers 执行已到期的 setTimeout/setInterval 回调；poll 执行大部分 I/O 回调（并可阻塞等待新事件）；check 专门执行 setImmediate 回调
5. 顶层与 I/O callback 中 timer/immediate 的区别: 顶层中, timer/immediate 执行顺序并不能确定, 可能受运行时机影响, 但在 I/O callback 中, 由于 poll 之后就是 check, immediate 稳定先于 timer 执行
6. 任务饥饿的原因: 若在清空 nextTick 或 Promise 微任务队列时持续入队新任务，事件循环将永远卡在当前检查点无法结束，导致 timers、poll、check 等后续阶段无法推进

二次总结仍未完全通过。按你要求，这次只校验内容准确性，不评价笔记结构。

**仍需修正**

- [第 1 条:1103](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1103) “遇到代码后引入事件循环机制”仍不准确。事件循环不是按需新引入的；Node 主线程在执行 JavaScript 与由事件循环调度已就绪 callback 之间切换。

- [第 2 条:1104](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1104) 前半句仍写“把异步任务放入异步队列”，与后面的“不存在统一队列”冲突。不同 API 行为不同：

```text
fs.readFile：登记 I/O 请求及关联 callback
setTimeout：登记 timer，达到阈值后才可调度
setImmediate：登记 check 阶段 callback
```

注册动作本身也不能概括成“使任务不阻塞主线程”；是否阻塞取决于 API 和具体工作。

- [第 3 条:1105](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1105) 有三个错误：

```text
六个阶段是 libuv event loop phases，不是“六个宏任务阶段”
nextTick 优先于 Promise 不能写成无条件规则，ESM 顶层是已实测的例外
不能概括为“每次阶段切换前清空”，应以当前 JS 操作/callback 结束后的调度检查点理解
```

**已经准确**

- [第 4 条:1106](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1106) `timers / poll / check` 职责准确。
- [第 5 条:1107](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1107) 顶层不保证顺序、I/O callback 内 immediate 先执行，准确。“抖动”可改为“受运行时机影响”，但不构成错误。
- [第 6 条:1108](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1108) 饥饿原因准确。

如果现在只验收回答准确性，**仍会不通过**，原因是前三条仍会导致错误推导。请只重写第 1–3 条，第 4–6 条无需继续修改。此次仍是 L1 原理纠正，不记学习债务。

前三条再次校正:
1. 主线程与事件循环的关系: 主线程逐行执行同步 JS；事件循环（libuv）在进程启动时即运行，并非按需引入. 异步 API 向 libuv 登记具体操作及回调，操作完成后回调按类型进入相应调度位置, 主线程仅在调用栈清空后，才会执行事件循环调度来的回调
2. callback 注册与执行的区别: 注册先于执行, 注册是一个动作, 执行是另一个动作. 注册是调用 API 将操作和回调交给 libuv（如 readFile 登记 I/O、setTimeout 登记 timer）, 执行是事件循环命中阶段时将其从队列调出运行。不存在统一队列，阻塞与否取决于 API 具体实现
3. nextTick / Promise 与六个阶段的关系: nextTick/Promise 不属于 libuv 的六个阶段(六个阶段是 libuv event loop phases, 不是“六个宏任务阶段”)，持有独立队列。nextTick 优先级并非绝对高于 Promise（ESM 顶层有例外）。清空时机是每个 JS 回调返回后、事件循环进入下一阶段前的检查点，按序清空两类队列

第三版明显更准确，但仍有两处事实性问题，暂不能判完全通过。它们不是措辞偏好。

**仍需修正**

- [第 1–2 条:1143](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1143) “异步 API 都向 libuv 登记”范围过大：

```text
fs 等 I/O：Node/libuv/操作系统或 worker pool
timer：Node/libuv timer 机制
process.nextTick：Node 管理
Promise microtask：V8 管理
```

因此不能把所有异步 API 和 callback 都写成交给 libuv。事件循环也应表述为进程启动时初始化，初始脚本执行完成后开始处理已就绪任务，而不是与顶层调用栈并行执行。

- [第 3 条:1145](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1145) “每个 callback 返回后、进入下一阶段前”仍把检查点绑定到了阶段切换。callback 边界可能发生在同一个 phase 内的两个 callback 之间。保留“当前 JS 操作/callback 返回、调用栈清空后的检查点”即可，不需要附加“进入下一阶段前”。

另外，“按序清空两类队列”需要限定为普通 CommonJS/普通 callback 上下文；你已经亲测 ESM 顶层是 Promise microtask 先于 `nextTick`。

**已经通过**

第 4–6 条继续通过。第 1–3 条的主体方向也已正确，现在只需：

1. 去掉“所有异步 API 都交给 libuv”的概括。
2. 去掉检查点必须对应 phase 切换的概括。
3. 给 `nextTick → Promise` 顺序加上上下文限定。

如果只验收当前回答准确性，仍会不通过；完成这三处最小修订即可，不需要再次重写整段。

再次订正:
1. 主线程与事件循环的关系：主线程逐行执行同步 JS；事件循环（libuv）在进程启动时初始化，在初始脚本执行完成后开始调度已就绪任务。I/O、timer 等 API 将操作及回调登记至 libuv，而 nextTick 由 Node 管理、Promise 由 V8 管理，操作完成后回调进入对应调度位置。

2. callback 注册与执行的区别：注册先于执行。注册是调用 API 将操作和回调交给对应底层机制（如 readFile 登记 I/O、setTimeout 登记 timer），执行是事件循环命中阶段(只适用于由 phase 管理的 callback；`nextTick` 和 Promise callback 在检查点执行)时将其从队列调出运行。不存在统一队列，阻塞与否取决于 API 具体实现。

3. nextTick / Promise 与六个阶段的关系：nextTick/Promise 不属于 libuv 的六个阶段，持有独立队列。清空时机是每个 JS 回调返回、调用栈清空后的检查点。在常规 CommonJS/普通回调上下文中，通常按 nextTick 优先于 Promise 的顺序清空，但 ESM 顶层存在此顺序的例外。

本轮内容校验通过。第 1–3 条已消除此前的事实性问题：

- 不再把所有异步 API 统一归给 libuv。
- 不再假设存在统一异步队列。
- 调度检查点不再绑定 phase 切换。
- `nextTick → Promise` 已限定在常规 CommonJS/普通 callback 上下文。
- ESM 顶层例外已明确保留。

无阻断性问题，可以验收。

有一处非阻断性的精度提醒：[第 2 条:1179](/Users/nezha/Documents/nodejs-skillup/week5-nodejs-internals/notes/day1-event-loop.md:1179) 的“事件循环命中阶段”只适用于由 phase 管理的 callback；`nextTick` 和 Promise callback 在检查点执行。由于第 3 条已经明确区分，当前整体模型不会造成错误推导，无需再次返工。

真实取舍：如果现在只验收答案准确性，**不会不通过**，当前回答合格。D1 的知识验收已经通过；笔记结构整理按你刚才的安排随后进行，整理完成后再更新周计划和学习状态。