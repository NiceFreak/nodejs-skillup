# Week 5 Day 3 · 续接 D2：libuv Threadpool 归属与排队

2026-07-22 从前一天被临时面试打断的位置恢复。今天先补完 D2 尚未完成的 threadpool 排队、`UV_THREADPOOL_SIZE` 对照与判断表，再决定是否进入原定 D3 的 Stream 与背压；不把跨日续接伪记为 2026-07-21 已完成。

## 今日主线

- 先判断同步忙等任务实际在哪里执行，以及它为什么不能用于观察 libuv threadpool 排队。
- 再判断适合实验的 `fs` / `crypto` 任务由谁执行，并在运行前预测线程池饱和时的完成节奏。
- 由本人设计并实现 threadpool 排队对照，验证 `UV_THREADPOOL_SIZE` 的作用边界。
- 补完“I/O 慢 vs CPU 慢 vs 线程池慢”判断表。

## 计划变化

- 原计划 D3 主题是 Stream 与背压。
- 由于 D2 在 CPU 阻塞实验验收后被打断，D3 按真实学习顺序先续接 D2 未完成部分。
- Stream 与背压是否在今天开始，等 threadpool 主线收口后再按实际时间决定。

## 恢复基线

事实：D2 的 CPU 阻塞实验已验收。隔离复验得到 `20ms -> wait 100ms / late 0ms`、`2000ms -> wait 2004ms / late 1904ms`；尚未完成 threadpool 排队实验、`UV_THREADPOOL_SIZE` 对照和判断表。

## 问答记录

**D2 延续 / 阶段 2 · Threadpool 归属**

为什么不能继续使用这个同步忙等任务来观察 libuv threadpool 排队？请只从“它在哪里执行”和“它实际会制造什么现象”两点回答。

答: 为什么不能继续使用这个同步忙等任务来观察 libuv threadpool 排队？
1. 它在哪里执行: 以 /src/cpu-blocking.js 为例,这个同步忙等任务中, libuv threadpool 会在 timerRegTime 时就注册, 但是 callback 在 actualWait 后才开始执行. 它在异步调用中执行
2.  它实际会制造什么现象: 会一直排队, 等主线程执行完成后,异步事件循环慢慢执行这些 callbacks, 拖慢整体节奏

当前回答暂不通过。先只纠正“执行位置”：

- `timerRegTime = Date.now()` 只是记录一个时间戳，不会注册 threadpool。
- `setTimeout(...)` 注册 timer，也不等于把后面的同步忙等任务提交给 threadpool。
- 真正待判断的任务是 `while` 忙等；它作为同步 JavaScript，在唯一的 JS 主线程和调用栈上执行。

**D2 延续 / 阶段 2 · Threadpool 归属 · 纠正题 1**

只回答执行位置：`while` 忙等从开始到结束由谁执行？它有没有进入 libuv threadpool？

答: while 忙等从开始到结束由JS 主线程执行,它没有进入 libuv threadpool

这次通过。`while` 循环中的条件判断和循环执行都是同步 JavaScript，由 JS 主线程在唯一的调用栈上执行；整个忙等任务没有进入 libuv threadpool。

**D2 延续 / 阶段 2 · Threadpool 归属 · 纠正题 2**

只回答实际现象：这个同步 `while` 忙等制造的是“主线程阻塞”还是“threadpool 任务排队”？为什么 timer callback 会因此推迟？

## 已完成 / 未完成

- 已完成：恢复状态，并把跨日问答归档到真实发生日期。
- 已完成：同步 `while` 忙等的执行位置纠正并通过。
- 未完成：忙等实际现象纠正、threadpool 排队实验、`UV_THREADPOOL_SIZE` 对照、判断表。

## 下一入口

- 先回答“Threadpool 归属 · 纠正题 2”，只判断忙等制造的实际现象。

回答: 
1. 这个同步 `while` 忙等制造的是“主线程阻塞”.
2. 为什么 timer callback 会因此推迟？
timer 达到调度阈值 → 同步 while 仍占用 JS 调用栈 → while 返回、调用栈释放 → callback 等到 timers 调度机会后进入调用栈执行, 这是推迟的原因

第 1 点正确；整体暂不通过。问题仍是“等待主线程执行结束”这个表述：主线程不会结束，它后面还要执行 callback。

请只重写第 2 点，串起：

> timer 达到调度阈值 → 同步 `while` 仍占用 JS 调用栈 → `while` 返回、调用栈释放 → callback 等到 timers 调度机会后进入调用栈执行。

我需要进一步了解主线程与异步执行的关系

这次修正通过。因果链准确。

“异步”描述的是任务不要求当前 JavaScript 原地等待结果，**不是说 JavaScript 会进入另一条异步线程执行**。

可以把完整关系拆成三段：

```text
1. 发起
JS 主线程在调用栈中调用异步 API

2. 等待或执行底层工作
timer：由 Node/libuv 跟踪时间
网络 I/O：通常由操作系统 + libuv 监听就绪
部分 fs / crypto：可能由 libuv threadpool 执行

3. 执行 callback
底层工作完成，只代表 callback 具备被调度的条件
callback 最终仍进入唯一的 JS 调用栈，由 JS 主线程执行
```

以当前 timer 实验为例：

```text
JS 主线程调用 setTimeout
→ Node/libuv 记录 timer
→ JS 主线程继续执行 while
→ timer 达到阈值，但 while 仍占用调用栈
→ callback 暂时不能执行
→ while 返回，调用栈释放
→ 事件循环到达 timers 调度机会
→ JS 主线程执行 callback
```

所以必须分清：

| 概念 | 含义 |
|---|---|
| 异步 API | 调用后不在当前位置同步等待最终结果 |
| 底层工作 | 可能由 OS、libuv threadpool 或其他机制完成 |
| callback | 最终仍由 JS 主线程执行 |
| 主线程阻塞 | 所有 JavaScript callback 都无法执行，但部分底层工作可能仍在进行 |

最关键的一句话是：

> 底层工作可以在 JS 主线程之外推进，但处理结果的 JavaScript callback 仍要回到 JS 主线程执行。

验证题，只回答一个判断：

> 假设一个 threadpool 任务已经完成，但此时 JS 主线程仍在执行两秒的同步 `while`。任务的 callback 能否立刻执行？底层任务和 callback 此时分别处于什么状态？

答: callback 不能立刻执行, 底层任务中 , threadpool 中的计时已经跑完,但是在等待主线程的结束, callback 则在等待返回主线程中被执行

方向正确，但暂不通过，仍有两个术语问题：

- 这不是“threadpool 中的计时跑完”，而是 **threadpool 中的底层任务已经完成**。
- 不是“等待主线程结束”，而是 **等待当前 JS 调用栈释放，并等到事件循环的调度机会**。

此时状态应区分为：

```text
底层任务：已经执行完成，不再处于计算中
完成结果：已具备交回 JavaScript 的条件
callback：尚未执行，等待调度
JS 主线程：仍被同步 while 占用
```

请用上面四个状态重新回答，尤其不要再使用“主线程结束”。

重答: 假设一个 threadpool 任务已经完成，但此时 JS 主线程仍在执行两秒的同步 `while`。任务的 callback 能否立刻执行？底层任务和 callback 此时分别处于什么状态？
callback 不能立刻执行. 底层任务：已经执行完成，不再处于计算中, 且完成结果已具备交回JavaScript 的条件. callback 尚未执行，等待调度, JS 主线程仍被同步 while 占用, 等待当前 JS 调用栈释放，并等到事件循环的调度机会时, callback 才能被执行, 这里不涉及主线程结束

这次通过。你已经准确区分：

- 底层任务完成
- callback 尚未执行
- JS 调用栈仍被占用
- 主线程持续存在，不存在“主线程结束”

原问题也因此收口：同步 `while` 制造的是**主线程阻塞**，不是 **threadpool 排队**。

下一题，进入实验任务选择：

> 同步 `while`、`setTimeout`、普通网络请求、异步 `crypto.pbkdf2` 中，哪一个最适合观察 libuv threadpool 排队？只说明所选任务的执行归属。

进入下一题前,我想先了解,什么时候才能真正使用主线程结束?

“主线程结束”只有在 **Node.js 进程真正终止** 的语境下才勉强成立。平时讨论异步调度时，基本不该使用它。

需要区分四种“结束”：

| 实际发生的事 | 准确表达 |
|---|---|
| `while` 执行完 | 当前同步任务结束 |
| callback 执行完 | 当前 callback 返回 |
| 调用栈变空 | 当前 JavaScript 执行片段结束，调用栈释放 |
| Node 进程退出 | 进程终止，主线程随进程一起终止 |

例如：

```javascript
setTimeout(callback, 1000);
console.log('top-level end');
```

顶层同步代码很快执行完，但不能说主线程结束。因为 timer 仍然保持事件循环活跃，一秒后主线程还要执行 `callback`。

真正可以谈到终止的典型情况是：

```text
没有仍保持事件循环活跃的 handle / request
→ 事件循环没有后续工作
→ Node 进程自然退出
→ 主线程随进程一起终止
```

或者显式调用 `process.exit()`，让进程立即退出。不过这种方式可能来不及完成日志刷新和资源清理。

所以在当前实验中：

> 错误：callback 等待主线程结束。  
> 正确：callback 等待当前同步任务返回、调用栈释放，并获得事件循环调度机会。

到了 D4 学 graceful shutdown 时，可以说：

> 服务停止接收新请求，等待在途任务完成并关闭资源，随后 Node 进程退出。

即使在那里，“进程退出”也比“主线程结束”更准确。

答题: 
同步 `while`、`setTimeout`、普通网络请求、异步 `crypto.pbkdf2` 中，哪一个最适合观察 libuv threadpool 排队？只说明所选任务的执行归属。
我不了解 异步 `crypto.pbkdf2`, 但听起来是一个本身也比较耗时的任务,我认为可以选择它

选择正确，但“它比较耗时”还不足以验收。**慢不等于使用 threadpool**：普通网络请求也可能很慢，但通常等待的是操作系统网络 I/O。

`PBKDF2` 是一种基于密码反复计算派生密钥的算法。它的计算量可以通过 `iterations` 调整。Node 24 官方文档明确说明，异步 `crypto.pbkdf2()` 使用 libuv threadpool，因此适合制造多个任务竞争有限工作线程的实验。[Node.js 24 Crypto 文档](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptopbkdf2password-salt-iterations-keylen-digest-callback)

执行链是：

```text
JS 主线程调用 crypto.pbkdf2()
→ 底层密钥派生工作进入 libuv threadpool
→ JS 主线程继续执行其他代码
→ threadpool 完成计算
→ callback 等待调度
→ JS 主线程执行 callback
```

它适合实验的真正原因是：

```text
确定使用 threadpool
+ 计算时间可通过 iterations 调节
+ 同时提交的任务数可以超过线程池容量
= 能观察任务分批完成和排队
```

请重新回答执行归属：

```text
发起 crypto.pbkdf2() 调用：由谁执行？
密钥派生计算：由谁执行？
callback：最终由谁执行？
```

在回答之前,我想先问事件循环机制中,为什么 idle/prepare叫这个名字, poll 为什么叫这个名字,poll 默认进程数量为 4,常用的 api 又是哪些? 刚刚抛出的 Crypto 我能感觉到与加密解密有关, 但是你不能默认我具备这些知识.当然如果你认为这些不是阻断性问题, 你可以打断

这里应该打断，因为存在一个会直接误导实验结论的模型混淆：

> **poll 没有“默认 4 个进程”。默认值 4 属于 libuv threadpool，单位是线程，不是进程。**

这属于阻断性理解问题，需要先澄清。`pbkdf2` 的 API 背景不知道则不是能力缺口，我不应该默认你具备。

关于名称，官方文档只定义行为，没有解释命名历史。下面的“为什么这样叫”是根据行为作出的直观解释。

`idle / prepare` 是 libuv 内部的两类 handle：

```text
idle
→ 每轮事件循环执行
→ 位于 prepare 之前
→ 名字容易误导：并不是“空闲时才执行”
→ active idle handle 反而会让 poll 使用 0 超时，不阻塞等待 I/O

prepare
→ 每轮事件循环在 poll I/O 之前执行
→ 可以理解为“进入 I/O polling 前的准备工作”
```

它们主要供 Node/libuv 内部使用，不是你日常安排业务 callback 的 JavaScript API。[libuv idle 文档](https://docs.libuv.org/en/stable/idle.html)、[libuv prepare 文档](https://docs.libuv.org/en/latest/prepare.html)

`poll` 可以理解为“询问/检查 I/O 状态”：

```text
事件循环把需要关注的 socket 等 I/O 交给操作系统监控
→ poll 阶段向操作系统取得已经就绪的 I/O 事件
→ 将对应的 JavaScript callback 放到可执行链路
→ JS 主线程执行 callback
```

这里的 poll 是通用概念，不表示一定调用名为 `poll()` 的系统函数。不同系统可能使用 `epoll`、`kqueue` 或 IOCP 等机制。[Node.js 事件循环与 Worker Pool](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)、[libuv 设计说明](https://docs.libuv.org/en/v1.x/design.html)

两套机制必须分开：

| 机制 | 做什么 | 数量 |
|---|---|---|
| Event Loop / poll | 监听和取得 I/O 就绪事件 | 当前模型中一个主事件循环 |
| libuv threadpool | 执行需要工作线程的任务 | 默认 4 个线程 |
| Node 进程 | 承载整个运行时 | 当前实验是一个进程 |

threadpool 是全局共享的工作线程池，默认大小为 4，可通过 `UV_THREADPOOL_SIZE` 在进程启动前调整。[libuv threadpool 文档](https://docs.libuv.org/en/stable/threadpool.html)

常见归属可以先记成：

| 任务/API | 主要机制 |
|---|---|
| `setTimeout` | timers，不使用 threadpool |
| `setImmediate` | check，不使用 threadpool |
| 普通 TCP/HTTP 网络 I/O | OS 非阻塞 I/O + poll |
| 异步 `fs` 操作 | 通常使用 libuv threadpool |
| `dns.lookup()` | libuv threadpool |
| 异步 `crypto.pbkdf2()` / `scrypt()` | libuv threadpool |
| 异步 `zlib` | libuv threadpool |
| 同步 `while` | JS 主线程 |

`crypto` 是 Node 内置的密码学模块。`pbkdf2` 用密码和盐反复计算派生密钥。当前只利用两个事实：

```text
它的异步版本进入 libuv threadpool
它的计算量可以调节，便于观察排队
```

不要求你先掌握加密算法原理。

先做一个校准题，其他内容暂不展开：

> “默认数量为 4”具体指哪个组件的什么数量？它是线程还是进程？poll 与这个数字有没有直接关系？

答: 是线程, threadpool(线程池)的默认大小, poll 与这个数字没有直接关系. 我觉得既然如此, 事件循环每个阶段都简单再带一句, 哪些是 nodejs 的能力, 哪些是 libuv 的能力, 哪些是 v8 引擎的能力,引入这些是不是会更好理解

答案通过：

> 默认 4 指 libuv threadpool 中的 4 个工作线程，不是进程；poll 与这个数字没有直接关系。

加入职责归属会更好理解，但不应把每个阶段标成“只属于某组件”。更准确的是一条协作链：

```text
JavaScript 调用 Node API
→ Node 负责 API 语义和运行时整合
→ libuv 负责事件循环、跨平台 I/O 抽象和线程池
→ OS 提供实际的网络/I/O 就绪机制
→ Node 安排 JavaScript callback
→ V8 在 JS 主线程上执行 callback
```

事件循环职责地图：

| 调度位置 | 主要职责 |
|---|---|
| timers | Node 提供 `setTimeout` 等 API；libuv 提供循环和时间机制；V8 执行 callback |
| pending callbacks | libuv/Node 处理被延迟到下一轮的部分系统 I/O callback |
| idle / prepare | libuv 内部阶段，Node 内部使用；业务代码通常不直接操作 |
| poll | libuv 调用 OS 的 I/O 监控能力；Node 把就绪事件衔接到 JS callback |
| check | libuv 提供 check handle；Node 在其上实现 `setImmediate` 语义 |
| close callbacks | libuv/Node 处理 handle 关闭；V8 执行对应 JS `close` callback |

另外两种队列不属于上述 phase：

| 队列 | 归属 |
|---|---|
| `process.nextTick` queue | Node 管理 |
| Promise / `queueMicrotask` queue | V8 管理 |

Node 官方文档也明确区分：microtask queue 由 V8 管理，next tick queue 由 Node 管理。[Node.js 24 Globals 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html#queuemicrotaskcallback)

无论 callback 来自 timer、poll、threadpool 完成通知还是 Promise：

> 最终的 JavaScript 都由 V8 在 JS 主线程上执行。

所以从现在开始，我会在**首次引入一种机制时**标明 Node、libuv、V8、OS 的职责，不在每次提及时重复整张表。

回到 `crypto.pbkdf2()`，请按职责链回答：

```text
发起 crypto.pbkdf2() 调用：由谁执行？
密钥派生计算：由谁执行？
callback：最终由谁执行？
```

答: 1. 发起 crypto.pbkdf2() 调用: js 主线程发起, libuv 执行
2. 密钥派生计算: 在 libuv 线程池中完成
3. callback：最终由 js 主线程执行

第 2、3 点通过；第 1 点暂不通过，因为“JS 主线程发起，libuv 执行”把发起阶段和底层计算阶段混在一起了。

准确拆分：

```text
代码调用顺序：
JS 主线程通过 V8 执行 crypto.pbkdf2(...) 这一行

职责归属：
Node 的 crypto API / 原生绑定接收参数，并把密钥派生任务提交给 libuv threadpool

返回关系：
调用不会在当前位置返回最终密钥；最终结果稍后传给 callback
```

libuv threadpool 真正执行的是第 2 阶段的底层密钥派生任务。

只重答第 1 点：

> 调用 `crypto.pbkdf2(...)` 这一行由谁执行？Node 在这个发起阶段负责什么？

重答: 调用 `crypto.pbkdf2(...)` 这一行由JS 主线程通过 V8 执行, Node 在这个发起阶段负责将Node 的 crypto API 绑定接收参数，并把密钥派生任务提交给 libuv threadpool, libuv threadpool 真正执行的是第 2 阶段的底层密钥派生任务