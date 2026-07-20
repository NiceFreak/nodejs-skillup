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