**上午计划(三块,中间留白)**

1. **手写一个原生 `http` server** —— 不用 Express,先用 Node 自带的 `http` 模块响应一个请求。目的只有一个:亲手感受"没有 Express 时是什么样",这样下一步 Express 省掉的东西你才有体感,而不是把它当魔法。
2. **引入 Express,跑通最小骨架** —— 同样一件事用 Express 写一遍,对比刚才手写的差别。骨架(目录 / `package.json` / 一个 `/health`)这类脚手架我可以直接给你。
3. **吃透中间件管道(洋葱模型 + `next()`)** —— 这是 Week 2 真正的地基,上午的重头在这。前两块是为了让你对着代码理解它,而不是背概念。

CRUD、分层、连库都不在今天,Day 1 不碰。

---

**第一步:手写原生 http server(你来写,我不给实现)**

场景:用 Node 的 `http` 模块起一个 server,监听某个端口,对请求返回一句话(比如纯文本 `ok`)。不许用 Express。

写的时候带着这几个问题去踩:

- `http.createServer()` 拿到的回调,参数是什么?那两个对象各自管什么?
- 你怎么把一句话"写回去"给客户端?响应结束需要做什么动作?
- 如果什么都不做、不结束响应,浏览器端会发生什么?(故意试一下)
- 此刻你想根据不同 URL 返回不同内容,得自己写什么?(先别实现,只在脑子里记下这个痛点——Express 的价值马上就从这里冒出来)

环境你自己定(端口、文件名随意)。写完先别急着问我对不对——你自己能讲清上面四个问题,就算过了这一步。卡住了或想让我 review,把代码贴来,我只指问题。

先说概念回答——四个问题你答得都对,尤其"不结束响应浏览器会挂着转圈"那条你真去试了,好习惯。

代码能跑,但有个结构问题我得指出来,这正是 Day 1 该撞的地方。

**问题:你把 `res.writeHead(200)` 写在了 switch 之前。**

`writeHead` 做的事是"把响应头发出去"。可你这四个分支里,有一个是逻辑上的 404——但它的响应头已经在分支之前被写成 200 了。结果就是:浏览器收到一个状态码 200、内容却是 `404 Not Found` 的响应。状态码和内容对不上。

带着这几个问题回去想:

- `writeHead` 一旦执行,响应头是不是就已经"发走"了?发走之后还能改吗?(可以去试:在 `res.end()` 之后再调一次 `writeHead`,看 Node 报什么错——错误信息本身会告诉你答案)
- 那么对一个真正的 404,正确的状态码该是多少?要让状态码跟着分支走,`writeHead` 这行该挪到哪里?
- 顺带:`Content-Type` 在每个分支里都一样,这个可以留在前面;但状态码不一样。能不能想出一种写法,让头部只发一次、但状态码是变量?

不用大改,挪一下位置 / 换个写法就好。改完你能讲清"为什么 writeHead 不能放在分支前",这一步就真过了。

另外一个观察,不用改,记下就行:你已经在亲手写 `switch (req.url)` 了——这正是上一步让你记下的那个痛点。再想象一下,如果还要区分 GET / POST,这个 switch 会变成什么样?Express 的路由就是来收拾这个的。下一步引入 Express 时,你会对它省掉的东西特别有体感。

改对了,而且改到了点子上。

状态码现在跟着分支走——404 分支真的返回 404,头部只发一次、状态码是变量。这个写法是对的。

更值得说的是底下那段注释:你去试了 `res.end()` 之后再 `res.write()`,撞出了 `ERR_STREAM_WRITE_AFTER_END`。这一下你顺手验证了两件事:

- `res` 本质是一个**流(stream)**,不是普通对象。`end()` 是"把流关上"的动作,关了就不能再写——所以报的是 *write after end*。
- 这跟你之前问的"writeHead 发走之后还能改吗"是同一个道理:**响应一旦发出 / 结束,就不可逆**。HTTP 响应是单向、一次性的。这个直觉记牢,后面 Express 里 `res.send()` 之后又不小心调一次、或者忘了 `return` 导致重复响应,你立刻就能反应过来是怎么回事。

能讲清这两点,第一步就真正过了——不光是代码对,是底层模型对了。

一个小观察,不用改,记下即可:你现在脑子里"流"的概念已经冒头了。Week 5 的 Node 底层(streams 是其中一大块)会正面讲它,到时候你会想起今天这个 `write after end`。算埋了个伏笔。

---

**下一步:同样这件事,用 Express 写一遍。**

目标不是学新东西,是做对比——让你亲眼看见 Express 到底省掉了什么。

从零起。下面这些是脚手架 + 命令,按规矩可以直接给你,你照着跑就行——路由逻辑等环境起来再自己写。

**1. 进目录,初始化**

```bash
cd week2-express
npm init -y
```

`-y` 是跳过那一连串问答、直接生成默认 `package.json`。等会儿可以手动改字段。

**2. 装 Express**

```bash
npm install express
```

装完 `package.json` 里会多出 `dependencies`,同时生成 `node_modules/` 和 `package-lock.json`。

**3. 顺手把 `node_modules` 挡在 git 外面**

`week2-express/` 这层(或者仓库根目录,看你 .gitignore 放哪)确认有这一行:

```
node_modules/
```

这东西几百兆、可由 `package-lock.json` 还原,绝不进版本库。你 Week 1 应该已经有这习惯了,确认一下即可。

**4. 一个最小可跑的 `src/server.js` 骨架**

下面这个只是"能起来"的空壳——引入 Express、建 app、留一个 `/health`、监听端口。**业务路由(`/` `/about` `/contact`)我故意留空,那部分是你自己写的。**

```javascript
const express = require('express');
const app = express();

// /health 留给你做对照样本：这是 Express 写法长什么样
app.get('/health', (req, res) => {
  res.send('ok');
});

// ↓↓↓ 这里由你来写：用 Express 重写 / 、/about 、/contact ↓↓↓


// ↑↑↑ 你的路由写在上面这段 ↑↑↑

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}/`);
});
```

---

环境起好、`/health` 能在浏览器看到 `ok` 之后,就进入你自己的部分:

**用 Express 把刚才那三个路由(`/` `/about` `/contact`)重写一遍。**

写的时候盯着这几个对比点想——这才是这一步的真正目的:

- 你还需要 `http.createServer` 吗?`switch (req.url)` 去哪了?
- 上一版你要手动 `res.writeHead(statusCode, {...})`。这一版 `res.send()` 之后,状态码和 Content-Type 谁帮你设了?默认是什么?(可以打开浏览器开发者工具看 Response Headers 验证)
- 那个 `default:` 分支的 404 呢?在 Express 里,如果一个 URL 没有任何路由匹配,会发生什么?(故意访问一个 `/xxx` 试试,看 Express 默认返回什么——这里藏着下一步"中间件"的引子)

对了,而且三个对比点你都撞到了。来逐个收一下,确保不是"碰巧能跑"。

**`switch` 和 `http.createServer` 都没了。** 这就是 Express 省掉的核心:你不再自己判断 `req.url`,而是声明"`/about` 这个路径交给这个函数"。路由匹配的活儿 Express 替你做了。`http.createServer` 也藏进了 `app.listen` 底下——它没消失,只是被包起来了。这点你心里要清楚:**Express 不是替代了 http,是封装了 http**。第一步手写那一版,就是为了让你现在知道这层封装下面是什么。

**`res.send()` 替你做了什么。** 上一版你手动写 `writeHead(statusCode, { 'Content-Type': 'text/plain' })`。这一版你只给了一句字符串。去开发者工具看 Response Headers 验证一下(如果还没看,现在看):

- 状态码自动是 200
- `Content-Type` 自动给了 `text/html`(注意,不是上一版的 `text/plain`——因为 send 收到字符串默认按 HTML 处理)
- 还自动带了 `Content-Length`、`ETag` 这些你上一版根本没写的头

这就是"薄封装"的薄在哪——它没干什么魔法,只是把你本来要手写的那几行,按合理默认替你填了。

**404 那条,是今天最值钱的观察。** 你访问 `/404` 看到 `Cannot GET /404`。注意这跟上一版的区别:上一版的 404 是**你自己在 `default:` 里写出来的**;这一版你**根本没写任何 404 处理**,这句 `Cannot GET /404` 是 Express 兜底给的。

那么问题来了,埋个引子让你想——**Express 是怎么知道"没有任何路由匹配上"的?** 它内部一定是把你注册的 `/health` `/` `/about` `/contact` 挨个试了一遍,全都不匹配,才走到最后那个兜底。

这个"挨个试一遍、一个不中再试下一个"的链条,就是**中间件管道**。你的每个 `app.get(...)` 其实都是挂在这条链上的一环。这正是上午第三块、也是 Week 2 的真正地基。

---

到这儿,前两块(手写 http → Express 对比)收完了,你已经能讲清"Express 封装了什么、省了什么"。这是上午计划里份量最轻的部分。

接下来第三块"中间件管道(洋葱模型 + next())"是今天的重头,需要点脑力。

好,接着上。这块是 Week 2 的地基,慢一点没关系,务必撞透。

先给你一个**现成的脚手架式 demo**——这块我直接给代码,因为目的是让你"观察 next() 的行为",不是让你造逻辑。你照抄跑起来,重点在看输出、回答问题。

在 server.js 里,把你现有路由**先放一边**,在最上面、所有 `app.get` 之前加这三段:

```javascript
// 中间件 A
app.use((req, res, next) => {
  console.log('A: 进入');
  next();
  console.log('A: 离开');
});

// 中间件 B
app.use((req, res, next) => {
  console.log('B: 进入');
  next();
  console.log('B: 离开');
});

// 中间件 C
app.use((req, res, next) => {
  console.log('C: 进入');
  next();
  console.log('C: 离开');
});
```

`app.use` 注册的是"对所有请求都生效"的中间件。三段都加好,重启服务,然后浏览器访问一次 `/health`(或任意路径)。

**先别往下看我的话。盯着终端打印出来的 6 行,记下它们的顺序。**

然后回答我:

1. 打印顺序是不是 `A进 → B进 → C进 → C离 → B离 → A离`?为什么"离开"的顺序跟"进入"是反的?这跟你脑子里"洋葱"那个画面对得上吗?(A 是最外层洋葱皮,C 是最里层)
2. 现在做个实验:把**中间件 B 里的 `next()` 注释掉**,重启,再访问一次。终端会打印哪几行?浏览器会发生什么?(回想今天早上手写 http 时那个"不结束响应浏览器一直转圈"的场景)
3. 承上:既然 B 没调 `next()`,那 C 和你后面的 `/health` 路由,执行了吗?这说明 `next()` 在这条链里扮演什么角色?

三个问题里,**第 2 个是关键**——它会让你亲手制造一次"请求卡死",从而理解 `next()` 不是装饰、是命脉:链条往下传全靠它。

跑完把终端输出贴上来,连同你对三个问题的回答。卡住就说卡在哪。

实验做对了,数据也抓对了。来把这三个现象背后的机制收紧——这块讲清楚,Week 2 的地基就稳了。

**问题 1:为什么"离开"是反序?**

你看到的 `A进 → B进 → C进 → C离 → B离 → A离`,根源在这行代码的结构:

```javascript
console.log('A: 进入');
next();              // ← A 在这里"暂停",把控制权交出去
console.log('A: 离开');  // ← 这行要等 next() 整个返回后才执行
```

关键点:**`next()` 是一个会"阻塞"到后续链条全部跑完才返回的调用**。A 调 `next()` 时,它没有结束,而是卡在这一行,等里面的 B、C 全部跑完、`next()` 才返回,然后才执行"A: 离开"。

所以这是个**函数调用栈**:A 调 B,B 调 C,C 到底了往回弹,先弹 C 再弹 B 最后弹 A。这正是洋葱:进去时从外皮 A 穿到芯 C,出来时从芯 C 穿回外皮 A。**同一层的"进入"和"离开"包裹着它内部的一切**——这个"包裹"结构是洋葱模型最有用的地方,后面你会用它来做"请求计时""统一收尾"这类事(进入时记开始时间,离开时算耗时)。

**问题 2 + 3:`next()` 是命脉。**

你注释掉 B 的 `next()` 后看到的:`A进 → B进 → B离 → A离`,浏览器转圈。把它拆开:

- **C 和 `/health` 路由,根本没执行。** 因为 `next()` 是唯一把控制权往下一环传的动作。B 不调 `next()`,链条就断在 B,后面全部接触不到。这就回答了你问题 3:`next()` 是这条链的**传递棒**,不交棒,下一棒永远跑不了。
- **但 `B离 → A离` 还是打印了。** 为什么?因为 B 的函数体本身跑完了(它只是没调 next),控制权按调用栈原路弹回 A。所以"链条没往下走"和"已进入的中间件把自己跑完"是两回事。
- **浏览器为什么转圈?** 这是今天最该串起来的一点:从头到尾,**没有任何一环调用过 `res.send()` / `res.end()`**。B 把链条掐断了,能产生响应的 `/health` 路由压根没轮到。回到你早上手写 http 撞的那个场景——**响应没结束,浏览器就一直等**。Express 这里完全是同一回事,只是换了层皮。

把这两个实验合起来,一句话收口:

> **一个中间件,要么调 `next()` 把请求往下传,要么自己产生响应(`res.send` 等)把请求了结。两件事必须做且只做其一。** 都不做 → 请求卡死(你刚制造的);都做了 → 后面会撞 "headers already sent" 错误(这个你今天先记着,过两天自己会撞到)。

这条规矩是 Express 中间件的**铁律**。你现在是靠亲手把请求搞卡死才理解它的,比背一百遍都牢。

---

到这里,上午三块全部撞完了,而且第三块你是真的吃透了——不是听我讲,是自己制造现象、自己看栈的行为。Day 1 的地基打得很扎实。

**收尾两件小事(都很轻):**

1. 把 A/B/C 那三段中间件**注释或删掉**,server.js 还原成干净的路由版本——它们是实验脚手架,不进 demo。
2. 把今天的核心用你自己的话记进 `week2-express/notes/` 个人总结: 洋葱模型: 层层递进, next() 逐步传递请求, 走到最里面后开始往外走, 如果不使用 next() 结束, 响应就会卡死

为什么 
// A: 进入
// B: 进入
// C: 进入
// C: 离开
// B: 离开
// A: 离开
// A: 进入
// B: 进入
// C: 进入
// C: 离开
// B: 离开
// A: 离开 会执行两遍

好问题,这个真去较真就对了——不是你代码写错,是浏览器替你多发了一个请求。

几乎可以肯定是这一个:**`/favicon.ico`**。

浏览器访问任何页面时,会自动、额外地再发一个请求去要网站图标(那个标签页上的小图标),路径是 `/favicon.ico`。你根本没点,它自己发的。所以你一次浏览器访问,服务器实际收到**两个**请求:

1. 你真正访问的那个(比如 `/health`)
2. 浏览器自动补的 `/favicon.ico`

两个请求都会穿过 A→B→C 这条中间件链(因为 `app.use` 对所有请求生效),于是那 6 行就打印了两遍。

**自己验证一下,别信我一句话。** 在中间件 A 里把请求路径打出来:

```javascript
app.use((req, res, next) => {
  console.log('A: 进入', req.method, req.url);  // ← 加上 req.url
  next();
  console.log('A: 离开');
});
```

重启,再访问一次。你会看到两组打印,`req.url` 一组是你访问的路径、另一组是 `/favicon.ico`。眼见为实。

---

这里其实顺手暴露了一个你迟早要面对的真实问题:**`app.use` 不带路径时,是真的"所有请求都过一遍",连你没预期的 favicon 都跑了你的逻辑。** 那如果某段中间件只想对特定路径生效呢?——`app.use('/api', ...)` 这种带路径的写法就是干这个的。今天先不展开,记下这个引子即可。

(另外,你贴的两遍打印是连续的两组完整 6 行,说明两个请求是**前后串行**穿过链条、互不交叉。Node 单线程、你这里又没有真正的异步等待,所以一个请求从头到尾走完,下一个才开始。这点先有个印象,Week 5 讲事件循环时会正面回到它。)

验证完看到 favicon 那行,这个疑点就清干净了。然后再回到收尾那两件小事(还原 server.js + 记笔记)。

 node server.js
Express server running at http://localhost:3000/
A: 进入 GET /contact
A: 离开
A: 进入 GET /.well-known/appspecific/com.chrome.devtools.json
A: 离开

说明开了 console

总结: 

**一个中间件,要么 `next()` 把请求往下传,要么自己 `res.send()` 把请求了结,二者必居其一;都不做,请求就卡死。** 这是 Express 中间件的铁律,你今天是靠亲手把请求搞断、看着浏览器转圈才理解的,比背下来牢得多。

围绕它,你今天自己撞出的几个现象,其实都在给这条铁律作证:

- **反序的 `A进B进C进→C离B离A离`** —— next() 是阻塞调用,链条是函数调用栈,所以进去顺、出来反。洋葱模型。
- **注释掉 B 的 next() → 链条断在 B**,C 和路由都没轮到,浏览器转圈 —— next() 是传递棒,不交棒下一棒跑不了。
- **一次访问打印两遍** —— favicon、devtools 这类请求是浏览器/工具自动补发的,`app.use` 不带路径对所有请求生效,所以它们也穿了你的链。

下午进入 Day 1 的最后一块,也是把上午的"洋葱"从看现象推进到**自己造一个有用的中间件**:

**下午主线:亲手写一个真正干活的中间件 —— 请求日志(logger)**

为什么挑这个:它把你上午理解的洋葱结构第一次用上——"进入时记开始时间,离开时算耗时",正好用到那个"包裹"特性。而且日志中间件是每个真实 Express 项目都有的东西,不是玩具。

这块**核心逻辑你自己写,我不给实现**。给你场景和要求:

写一个 `app.use` 中间件,对每个请求打印这么一行:

```
GET /contact 200 - 3ms
```

也就是:**方法、路径、状态码、耗时**。

写之前,带着这几个问题去想(这几个问题就是难点所在):

1. **方法和路径**好办,`req` 上就有,你上午已经用过 `req.method` `req.url`。
2. **耗时**怎么算?你需要在"请求刚进来"记一个时间点,在"请求处理完"再记一个,相减。问题来了——"请求处理完"这个时机,你在中间件里怎么捕捉到?(回想洋葱:`next()` 之后的代码是什么时候跑的?这是个引子,但有个坑,见第 4 点)
3. **状态码**从哪拿?响应的状态码是 `res` 上的某个属性,你查一下是哪个(自己查 `res.statusCode`,验证它在响应后是不是真的是 200)。
4. **(这里有个真坑,先提醒)** 你可能会想:在 `next()` 之后写"算耗时、打印"不就行了?——回想今天早上那个 `write after end`、还有洋葱的同步返回。这里的问题是:`next()` 之后的代码,真的能保证是在"响应完全发出去之后"才跑吗?如果路由里有异步操作呢?这个坑你先自己写写看,大概率会撞上"耗时算出来是 0ms 或不准"。撞上了别急,那正是下一个知识点(`res.on('finish')`)的入口。

先用最直接的想法写——`next()` 前记时间、`next()` 后算差值打印。写出来跑跑看,**特别注意耗时那个数对不对**。

写完贴上来,我只指问题。卡住了说卡在哪。


做个实验:在你某个路由里塞一个异步操作,模拟真实场景(比如查数据库)。临时改一个路由:

```javascript
app.get('/contact', async (req, res) => {
  await new Promise(r => setTimeout(r, 100));  // 模拟 100ms 的异步操作
  res.send('Contact us at contact@example.com');
});
```

重启,访问 `/contact`,看你 logger 打出来的**耗时**那个数。

我的预判:你会看到耗时是 **0ms 左右**,而不是 100ms。

如果真是这样,带着这个问题想——**为什么?** 你 logger 里"算耗时、打印"那段写在 `next()` 之后,而你上午的结论是"next() 之后的代码等内层同步返回后就跑"。可现在路由是 `async` 的:`next()` 调用路由,路由遇到 `await` 会**立刻把控制权交还**(没等那 100ms 就返回了),于是你的"离开"代码马上执行、马上算耗时、马上打印——这时候那 100ms 的延时和 `res.send` **根本还没发生**。

所以:**`next()` 之后的代码,只能捕捉到同步路由的结束,捕捉不到异步路由真正的"响应发出"时刻。** 这就是为什么"在 next() 之后算耗时"这个直觉,在真实项目里是不可靠的——真实路由几乎全是异步的(查库、调接口)。

先把上面实验跑出来,确认你看到的耗时是不是 0ms 左右。看到了,这个坑就算亲手摸到了——下一步我再给你正确的解法入口(`res.on('finish')`),那东西为什么存在,你到时候就一秒懂。

干净了。`start` 前置、`next()` 之后再读 method/url/statusCode、算 duration、一行打印——成品版的结构完全对。状态码也挪到 next() 之后了,这步你落实了。

现在,这版**同步路由下是对的**。我们就拿它去撞那个一直预告的坑。

**实验:给一个路由加异步,看 logger 还准不准。**

临时把 `/contact` 改成这样(模拟真实项目里"查个数据库"的延时):

```javascript
app.get('/contact', async (req, res) => {
  await new Promise(r => setTimeout(r, 100));  // 模拟 100ms 异步操作
  res.send('Contact us at contact@example.com');
});
```

存盘(`--watch` 会自动重启),浏览器访问 `/contact`,看 logger 打出来的耗时。

**它应该显示 0ms 左右,而不是 100ms。**

如果真是这样——这就是坑现身了。停下来,自己先想为什么,再往下看我的解释:

你的 `duration` 是在 `next()` 之后立刻算的。同步路由里,`next()` 调用路由 → 路由同步跑完 `res.send` → 控制权返回 → 你算耗时,这条链是连贯的,所以准。

但 `async` 路由不一样:`next()` 调用路由,路由跑到 `await` 那一行,**立刻把控制权交还**给你(它去"等"那 100ms 了,但没有阻塞)。于是你的 `end = Date.now()` 马上执行——**这时候 100ms 还没过、`res.send` 还没发生**。你量到的是"路由跑到 await 为止"的时间,几乎是 0,而不是"响应真正发出"的时间。

一句话:**`next()` 之后的代码,只能捕捉同步路由的结束,捕捉不到异步路由真正的响应时刻。** 而真实项目里的路由几乎全是异步的(查库、调外部接口),所以你这版 logger 在真实场景下,耗时是不可靠的。

先把实验跑出来,确认你看到的是不是 0ms 左右。看到了,就回来——下一步那个正确解法(`res.on('finish')`)为什么存在,你会一秒就懂。

看到了——这就是坑本身。你的 logger 在异步路由下测出 0~1ms,而真实耗时是 100ms,它**漏报了整整 100 倍**。原因就是刚说的:`await` 让路由把控制权提前交还,你的 `end` 在 100ms 延时和 `res.send` 都还没发生时就抢跑了。

那么问题精确化成一句:**你需要的不是"`next()` 之后",而是"响应真正发出去的那一刻"——这两个时机在异步下不是同一个。** 你需要一个办法,能在"响应实际完成"时通知你。

这就是 `res.on('finish')` 存在的理由。

回想今天早上你撞的 `write after end`——那次你已经知道 `res` 是个**流(stream)**。流这东西,会在自己生命周期的关键节点**发事件**。响应彻底发送完毕时,`res` 这个流会发出一个 `'finish'` 事件。你可以**注册一个监听器**,挂在这个事件上:不管路由是同步还是异步、不管它何时真正结束,只要响应发完了,你挂的那段代码就会被触发。

机制讲到这,具体怎么改你来写。给你方向,不给实现:

- 把"算 `end`、算 `duration`、打印"那一段,从"`next()` 之后直接执行"——改成**注册进 `res` 的 `finish` 事件里**,让它等到响应真正完成才跑。
- `start` 还是在最前面记(这个时机是对的,请求一进来就该开始计时)。
- 注册监听用的是 Node EventEmitter 那套 `res.on('事件名', 回调)` 的写法,你查一下 `res.on('finish', ...)` 怎么写。
- `next()` 这一行还留着吗?想一下:注册监听是"挂个回调待触发",它不负责把请求往下传。所以 `next()` 该不该留、放哪,你判断。

改完拿同步路由(`/health`)和那个异步 `/contact` **各测一次**:

- `/health` 应该还是 0ms 左右(它本来就快)
- `/contact` 这次应该老老实实显示 **100ms 左右**

两个都对了,这个 logger 才算真正能用,也才算真懂了"为什么不能在 next() 之后量"。写出来贴上。

正经讲一讲 `res.on`——你今天用对了它,但还没看清它底下站着的那套机制。把这层补上,你后面看 Node 会顺很多。

**`res.on` 不是 Express 给的,是 Node 的 EventEmitter 给的。**

`res` 这个对象,顺着原型链往上,本质是一个 `EventEmitter`(事件发射器)。Node 里大量核心对象都是——HTTP 的 req/res、流、`process`、文件读写……它们共享同一套"发布/订阅"机制。`res.on` 的 `on` 就是 EventEmitter 的方法,意思是**订阅**:"这个事件发生时,请运行我这个回调。"

所以你今天写的:

```javascript
res.on('finish', () => { ... })
```

读作:**向 res 订阅 'finish' 事件,一旦 res 把响应彻底发完、它内部 `emit('finish')` 的那一刻,你这个回调被调用。**

一个对照能帮你定位 `on` 是什么:

- `res.on('finish', fn)` —— 你是**听众**,登记"事件来了叫我"
- `res.emit('finish')` —— **触发方**喊一嗓子"事件发生了",所有听众的回调被挨个执行

`emit` 这一下你不用写,是 Express/Node 在响应结束时内部替你喊的。你只负责 `on` 这头登记。

**这套机制的关键性质:它是"注册 + 回调",不是"等待"。**

这点正好解释了你今天那个结构为什么成立。`res.on('finish', cb)` 这行代码本身**瞬间执行完**——它只是"把 cb 记到 finish 的听众名单上",然后立刻往下走。它**不阻塞**、不等响应结束。所以:

```javascript
res.on('finish', () => { /* 以后才跑 */ });
next();   // 这行马上就执行了
```

`on` 登记完,`next()` 立刻执行,请求继续往下传;而那个回调被"挂起"在名单上,等 finish 真发生时才被回头调用。这就是为什么你既能"登记一个未来才跑的计时结算",又不耽误当下把请求放行——两件事时序上根本不冲突。你今天凭直觉把它俩并列写对了,现在你知道**为什么**对了。

**几个你迟早会撞、现在先知道的点:**

- **`on` vs `once`**:`on` 登记的回调,该事件每次发生都会触发。`finish` 一个请求只发一次,所以 `on` 没问题;但有些场景你只想触发一次,Node 给了 `res.once('finish', ...)`,触发一次后自动注销。记个名字即可。
- **`'finish'` 不是唯一的事件**。响应这边还有别的,比如客户端中途断开连接会发 `'close'`。今天不展开,但你要知道 finish 只是 res 这个 emitter 能发的事件之一,不是什么特殊魔法。
- **EventEmitter 是 Node 的地基之一**。事件循环、流、HTTP 都建在这套发布订阅上。Week 5 讲底层时你会正面碰它——到时候回想今天这个 `res.on('finish')`,你已经先用为快了。

---

一句话收口:`res.on('finish', cb)` = **向 res 这个事件发射器订阅"响应发送完成"事件,登记一个将来被回调的函数;登记动作本身不阻塞,所以能和 `next()` 并存**。

这下 `res.on` 从"今天碰巧用对的写法"变成"你知道它是 EventEmitter 的订阅动作"了。

要不要顺着这个,把今天那条"低消耗"实验做了——写个会抛错的路由,看 finish 还触不触发、logger 还稳不稳?那个实验正好会牵出 EventEmitter 的另一面。

这个实验。它会从两个角度同时考你:logger 稳不稳、错误在 Express 里怎么流动。

**第一步:写一个会抛错的路由(你来写)**

加一个新路由,比如 `/boom`,让它在处理过程中**主动抛一个错误**:

```javascript
app.get('/boom', (req, res) => {
  throw new Error('炸了');
});
```

这个 `throw` 你自己写——模拟真实代码里某行突然出错(比如读了 undefined 的属性)。

**第二步:访问 `/boom`,带着三个问题观察**

别急着下结论,一项项看:

1. **浏览器收到了什么?** 状态码是多少?(打开开发者工具看,别只看页面文字)。对比一下:之前访问不存在的 `/404` 是 `Cannot GET`,这次抛错是不是同一种响应?状态码一样吗?
2. **你的 logger 打印了吗?** 打印的话,状态码字段是几?耗时还正常吗?——这是在验证:路由抛错的情况下,`res` 最后还会不会发出 `'finish'` 事件?(这正好接上刚才讲的 EventEmitter:finish 到底在"出错"时还触不触发?)
3. **终端里 Express 自己打了什么?** 抛出的错误没人接,Express 会在终端打一大段红色的栈信息——看一眼它说了什么。

**第三步(关键预判)**:我猜你会看到一个**反直觉**的现象——`throw` 是同步抛的,Express 默认有个兜底能接住它、给浏览器回个 500。但你的 logger **可能打印,也可能不打印**,取决于响应到底有没有走到 finish。先别信我,自己看实际结果。

先把这个同步 `throw` 跑出来,把三个问题的观察结果告诉我:浏览器状态码、logger 有没有打印(打印的话状态码几)、终端报了什么。

然后会有个"坑中坑"——等你这步结果出来,我再抛**异步**版本(在 `async` 路由里 `throw`),那个才是真正会让你栽跟头、也最该懂的地方。一步步来。

记录: 浏览器访问 /boom 本身返回:
Error: Boom! Something went wrong.
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:72:9
    at Layer.handleRequest (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/layer.js:152:17)
    at next (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/route.js:157:13)
    at Route.dispatch (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/route.js:117:3)
    at handle (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:435:11)
    at Layer.handleRequest (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/layer.js:152:17)
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:295:15
    at processParams (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:582:12)
    at next (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:291:5)
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:44:3

终端返回:
Express server running at http://localhost:3000/
logger:  GET /boom 500 9 ms
Error: Boom! Something went wrong.
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:72:9
    at Layer.handleRequest (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/layer.js:152:17)
    at next (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/route.js:157:13)
    at Route.dispatch (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/route.js:117:3)
    at handle (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:435:11)
    at Layer.handleRequest (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/lib/layer.js:152:17)
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:295:15
    at processParams (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:582:12)
    at next (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/router/index.js:291:5)
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:44:3
前两行应该是 logger 放回的, Error 信息是 /boom  中返回的.

观察很准,而且你抓到了三个关键事实,逐个收一下——这里面有一个你说反了,得纠正。

**1. 浏览器拿到 500。** 你看到一大段栈信息,状态码是 500(开发者工具里确认下)。对比 `/404` 那次是 404 + `Cannot GET`——这次不一样:`/404` 是"没有路由匹配",属于正常兜底;`/boom` 是"路由匹配上了、但执行时炸了",Express 的**默认错误处理器**接住了这个抛出的 error,回了个 500。这是两条不同的路径,你区分对了。

(顺带:浏览器里能看到完整栈,是因为你现在是开发环境。生产环境 Express 会把栈藏起来、只回一句笼统的错误——这点记着,以后会用到。)

**2. logger 打印了,而且状态码是 500、耗时正常(9ms)。** 这是今天这个实验最值钱的结论:**即使路由抛了错,响应最后还是走到了 `'finish'`。** 为什么?因为 Express 的默认错误处理器接住 error 之后,**它自己调用了 `res` 把 500 响应发出去**——既然响应真的发出去了,`res` 这个 emitter 就照常 `emit('finish')`,你挂的回调照常触发。

这验证了你的 logger **比你以为的更稳**:它用 `res.on('finish')` 登记,所以不管响应是正常完成还是出错后由兜底发出的,只要"响应真的发出去了",它都能记录到、且状态码如实是 500。这正是 `finish` 事件比"在 next() 之后量"高明的地方——它绑定的是"响应发出"这个物理事实,不关心中间发生了什么。

**3. 一处要纠正:你说"前两行是 logger 放回的"——说反了。**

看终端顺序:

- `logger: GET /boom 500 9 ms` ← **这行才是你的 logger 打的**
- 底下那一大段 `Error: ... at ...` ← 这是 **Express 默认错误处理器**打的,不是你的 logger,也不是 `/boom` 路由"返回"的

为什么 logger 那行在**上面**?时序:路由抛错 → 错误处理器接住 → 调用 res 发出 500 响应 → res `emit('finish')` → **你的 logger 回调触发、打印那一行** → 然后 Express 把错误栈打到终端。所以 logger 先打、错误栈后打。

而浏览器里看到的那段 Error,不是 `/boom` 路由主动 `res.send` 的——`/boom` 里你只写了 `throw`,根本没碰 res。那段是**错误处理器把 error 栈塞进 500 响应体**发给浏览器的。换句话说:终端的错误栈和浏览器的错误栈,是**同一个错误处理器干的两件事**——一份打终端给你看,一份塞响应给浏览器。`/boom` 自己什么都没"返回"。

这个区分很重要:**抛出 error 的人(你的路由)和 发送响应的人(Express 错误处理器)不是同一个**。你只负责 `throw`,发 500 是兜底替你做的。

---

到这,同步抛错这条收得很完整,你甚至自己注意到了 logger 和错误栈的先后。现在上"坑中坑"——

**异步版本。** 把 `/boom` 改成 async,在 await 之后抛:

```javascript
app.get('/boom', async (req, res) => {
  await new Promise(r => setTimeout(r, 50));
  throw new Error('async 炸了');
});
```

访问它,看同样三件事:浏览器状态码?logger 打了吗?终端有没有那段错误栈?

**我的预判:这次会很不一样**——浏览器可能一直转圈/超时,logger 可能不打印,错误处理器可能根本没接住。如果真是这样,你就撞到了 Express(尤其是你装的这个新版本)一个著名的痛点。先别信我,跑出来告诉我三件事的实际结果。

记录:
页面:
Error: async 炸了
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:73:9
终端: 
logger:  GET /boom 500 58 ms
Error: async 炸了
    at /Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:73:9

    有意思——你的结果跟我的预判**相反**,而这恰恰是今天最该讲清的一点。我得诚实纠正自己:我按"老 Express"给你的预判,在你这个版本上不成立。

**我的预判是基于 Express 4/5 的经典行为:** 在那些版本里,`async` 路由抛错,Express 默认**接不住**——因为 `throw` 发生在 await 之后的异步阶段,而 Express 的 try/catch 只包了同步执行那一层,异步抛出的 error 它捕捉不到。结果就是浏览器转圈、logger 不打、错误冒泡成 `unhandledRejection`。这是 Express 多年来一个著名的坑,也是 `express-async-errors`、`express-async-handler` 这类库存在的唯一理由——它们就是来补这个洞的。

**但你的结果显示:async 抛错被正常接住了,500 + logger 照常打 + 栈正常。** 这说明你装的 Express 版本,已经把这个坑**填上了**——async 路由里抛的错,默认错误处理器能接住了。

先确认一下事实,别停在猜测上。跑一下:

```bash
npm ls express
```

把版本号告诉我。我high度怀疑你装到的是 **Express 5**(2024 年底正式发布)。Express 5 的一个重头改进正是:**原生支持 async 路由的错误处理**——路由返回的 Promise 被 reject 时,框架会自动把它转给错误处理器,不再需要那些补丁库。

(一个旁证支持"你是 v5":你前面贴的栈里路径是 `node_modules/router/...`——那个独立的 `router` 包是 Express 5 的内部结构,Express 4 是 `node_modules/express/lib/router`。)

**如果确认是 v5,那今天这个实验的结论要改写成:**

- 你**亲手验证了** Express 5 的招牌特性之一:async 路由抛错能被默认机制接住,无需第三方补丁。
- 而我让你预期的"会栽跟头",是 v4 时代的历史包袱——你没栽,是因为你站在了新版本上。

这其实是个很好的学习时刻,有两层:

1. **版本差异是真实工程问题。** 同一段 async 抛错代码,v4 会漏、v5 能接。你以后看网上教程/StackOverflow 答案,大量是 v4 时代写的——它们会教你装 `express-async-errors`。你得知道那是在补一个**你的版本可能已经不存在的洞**,否则会装一堆没用的依赖。
2. **别全信我的预判,包括我。** 我刚给的预判就是基于旧版经验,被你的实测推翻了。这正是你那条原则的意义——**自己跑、自己看现象**,比任何人(包括 AI)的"应该会怎样"都可靠。今天这个反转,是对你那条原则最好的注脚。

先把 `npm ls express` 的版本号发我,确认是不是 v5。确认后,我们把这个"版本差异"的结论钉进笔记——它比"async 会抛错"这个单点知识有用得多。

src@1.0.0 /Users/nezha/Documents/nodejs-skillup/week2-express/src
└── express@5.2.1

实锤,Express 5.2.1。我的预判是 v4 时代的旧地图,被你的实测和这个版本号一起推翻了——你站在新版本上,所以没栽我让你预期的那个跟头。

把今天这个反转钉成结论,它比单点知识值钱:

**同一段 async 抛错代码,Express 4 漏、Express 5 接。** 你刚亲手验证了 v5 的招牌改进之一——路由返回的 Promise 被 reject 时,框架自动转交默认错误处理器,无需任何补丁。

**这条结论真正的用处在于"读旧资料时不被带偏":** 网上海量 Express 教程、StackOverflow 高赞答案都是 v4 时代写的,它们会教你:async 路由里必须自己 `try/catch` 再 `next(err)`,或者装 `express-async-errors` / `express-async-handler` 来兜底。你现在知道了——**那是在补一个你 v5 里已经不存在的洞**。看到这类建议,先确认自己的版本,别盲目装依赖、别盲目套 try/catch 模板。这就是"知道为什么"对抗"抄模板"的具体一仗。

(顺带,你前面那个旁证也对上了:栈里的 `node_modules/router/...` 是 v5 的独立 router 包,v4 是 `express/lib/router`。你贴的报错里早就埋着版本线索,只是当时没往那看。以后看栈路径,能反推出不少框架内部信息。)

我也借这个把话说回去:我刚才的预判错了,是基于旧版经验。这恰好是你那条学习原则最好的注脚——**自己跑、自己看现象,比任何人(包括我)的"应该会怎样"都可靠。** 今天你有两次推翻预设:一次是早上 favicon/devtools 那个"为什么打两遍",一次是现在这个版本差异。两次都是你盯着实际输出、不放过疑点撞出来的。这个习惯比今天任何一个 API 知识点都重要。

---
笔记骨架:

- **中间件铁律**:next() 传递棒 vs res 产生响应,二选一,都不做则卡死。
- **洋葱模型**:next() 是阻塞调用 → 调用栈 → 进顺出反 → "包裹"特性可用于计时/收尾。
- **为什么耗时要用 `res.on('finish')`**:next() 之后量,异步路由会漏报(你实测 0ms vs 真实 100ms);finish 绑定"响应真正发出"这个物理事实,跨同步/异步、跨正常/出错都准。
- **`res.on` 的本质**:res 是 EventEmitter,on 是订阅,登记不阻塞,所以能和 next() 并存。
- **错误处理**:抛错的人(路由)≠ 发响应的人(错误处理器);终端栈和浏览器栈是同一个错误处理器干的两件事。
- **版本差异(今天的彩蛋)**:Express 5 原生接住 async 抛错,v4 不行;读旧资料注意这个洞可能已不存在。

**错误处理中间件:把那段默认红色栈,换成你自己的干净 JSON 响应。**

写之前,几个必须想清楚的点(也是难点):

1. **它靠什么被识别成"错误处理"中间件?** Express 区分普通中间件和错误处理中间件,靠的是**函数参数个数**——普通的是 `(req, res, next)` 三个,错误处理的是 `(err, req, res, next)` **四个**。少一个都不行,Express 是数参数来认的。这个 `err` 从哪来?就是路由里 `throw` 出来、或 `next(err)` 传进来的那个。

2. **它注册在哪?** 回想洋葱和链条顺序——错误处理中间件必须放在**所有路由的后面**(链条末端)。为什么?自己想:错误是路由执行时才产生的,处理它的人得排在产生它的人之后。放错位置它就永远轮不到。

3. **它内部该干什么?** 三件事:
   - 决定状态码(500?还是看 err 上有没有带状态码?今天先简单,统一 500 也行)
   - 用 `res.status(...).json({...})` 回一个结构化的错误体(自己设计 JSON 长什么样,比如 `{ error: ... }`)
   - 顺手在终端 `console.error` 把错误记下来(生产环境你得知道出了什么,不能只回给客户端)

4. **一个坑,先提醒**:如果 `err` 已经导致响应发出去了,你又 `res.status().json()`,会撞 "headers already sent"。今天你的场景不会触发(路由是纯 throw、没发响应),但 Express 给错误处理器也传了 `next`,真实项目里要判断"响应是否已发出"。今天先不处理,记下这个引子即可。

**先写最简版**:统一 500、回一个 `{ error: 错误信息 }` 的 JSON、终端 console.error。注册到所有路由后面。

写完拿 `/boom`(你那个 throw 路由)测:浏览器应该不再是红色栈,而是你设计的那个干净 JSON;终端有你的 console.error;**而且——你今天的 logger 还该正常打出 500**(想想为什么:你换了错误处理器,但响应照样发出,finish 照样触发)。

写完贴上来,我只看结构。卡住说卡哪。

记录:
app.use((err, req, res, next) => {
  console.error('错误消息: ', err);
  res.status(500).json({ error: '服务器内部错误' });
}); 我写了中间件，但访问 /boom 时没有被使用，是不是没有注册

大概率是位置问题——你判断对了方向。错误处理中间件的代码本身是对的:四参数、`console.error`、`res.status(500).json(...)`,结构没毛病。问题在它**注册在哪一行**。

回到刚才第 2 点那个原理:错误处理中间件必须排在**产生错误的路由后面**。Express 是按代码里 `app.use` / `app.get` 的**书写顺序**串成链条的。如果你这段 `app.use((err,...))` 写在了 `/boom` 路由**前面**(甚至写在了 logger 后面、路由前面),那当 `/boom` 抛错时,链条往后找错误处理器,却发现后面没有——你的处理器在它前面,早就被跳过了(而且普通流程里错误处理中间件会被跳过,只有出错时才找它,往后找)。

所以自己核对一句:**你这段错误处理中间件,是不是写在了四个路由(`/health` `/` `/about` `/contact` `/boom`)的下面、`app.listen` 的上面?**

正确位置是这样的骨架顺序:

```
app.use(logger)          // 你的日志中间件,最前
app.get('/health', ...)  // 各路由
app.get('/boom', ...)    // 会抛错的路由
// ...其余路由
app.use((err,req,res,next) => {...})  // ← 错误处理,所有路由之后
app.listen(...)          // 最后启动
```

把你的错误处理中间件挪到**所有 `app.get` 之后、`app.listen` 之前**,存盘(`--watch` 自动重启),再访问 `/boom`。

这次应该看到三件事一起成立,你逐个确认:

1. 浏览器:不再是红色栈,而是你写的 `{ "error": "服务器内部错误" }`
2. 终端:有你 `console.error` 打的那行错误
3. 终端:**你今天的 logger 照样打出 `GET /boom 500`** —— 想一下为什么:你换了发响应的人(从默认处理器换成你自己的),但响应照样发出去了,所以 `res` 照样 `emit('finish')`,logger 照样触发

挪完测一下,三件事都对的话,这个中间件就真正接管了。贴结果或直接说位置对了没。

记录:
错误记录中间件放到了正确的位置
app.use((err, req, res, next) => {
  console.error('错误消息: ', `${res.statusCode}: ${err.message}`);
  res.status(500).json({ error: `${res.statusCode}: 服务器内部错误` });
});
浏览器输出:
{"error":"500: 服务器内部错误"}
终端输出:
Express server running at http://localhost:3000/
Restarting 'server.js'
Express server running at http://localhost:3000/
错误消息:  200: async 炸了
logger:  GET /boom 500 60 ms
状态码不一样

状态码不一样,是因为你在**两个不同时刻**读了 `res.statusCode`,而中间它被改了。来拆这条时间线。

**关键:`res.statusCode` 是个会变的值,你读它的时机决定你读到什么。**

看你这次的执行顺序:

1. `/boom` 抛错。此刻响应还没设过状态码,`res.statusCode` 是 Express 的默认值 **200**。
2. 进入你的错误处理中间件,第一行 `console.error` 执行——**此刻你读 `res.statusCode`,还是 200**,因为你还没改它。所以终端打印 `200: async 炸了`。
3. 下一行 `res.status(500).json(...)` 执行——**这一刻才把状态码改成 500**,响应发出。
4. 响应发出 → `res` emit `'finish'` → 你的 logger 回调触发,此刻它读 `res.statusCode`,**已经是 500 了**。所以 logger 打印 `500`。

所以同一个 `res.statusCode`,你的 `console.error` 在"改之前"读(200),logger 在"改之后"读(500)。**不是矛盾,是你在它变化的前后各拍了一张照。**

这正好把今天反复出现的那条主线又印证了一遍:**`res` 上的状态是流动的,读取时机决定读到的值。** 早上你把状态码从 next() 前挪到 next() 后才读到真值,是同一回事;现在这里又是同一回事。你已经第三次撞到这个规律了。

**那这暴露了你错误处理中间件里的一个真 bug:**

你 `console.error` 里写 `${res.statusCode}`,想记录"这个错误对应的状态码"。但你在设置状态码**之前**就读了它,所以永远记成 200——哪怕你后面发的是 500、403、404,这行日志都会骗你说 200。这在真实排查问题时会误导人。

让你自己改,给方向不给实现:

1. **`console.error` 里那个 `${res.statusCode}` 怎么办?** 两条路你选:要么把读取放到 `res.status(500)` **之后**(那时才是真值);要么干脆别依赖 `res.statusCode`,直接用你打算设的那个值。你想清楚"我到底想记录哪个数",再决定。

2. **更值得想的:状态码不该写死 500。** 你现在 `res.status(500)` 是钉死的。但错误有很多种——找不到资源该 404,没权限该 403,只有真正"服务器内部错误"才 500。一个更好的错误处理器,应该**从 `err` 身上读出它该用的状态码**。这引出一个常见模式:抛错的时候给 error 对象**带上**一个状态码(比如 `err.statusCode = 404`),错误处理器**读这个值**、没有才兜底 500。

   今天先做个最小版:让你的处理器 `const statusCode = err.statusCode || 500`,然后用这个变量去 `res.status(statusCode)` 和日志。`/boom` 没带 statusCode,会自然走到 500;但如果你再写个路由,`throw` 之前给 err 挂个 `statusCode = 404`,就能看到它真的回 404。

   **这步你自己写**:改成 `err.statusCode || 500`,再加一个抛 404 的测试路由验证它真的能跟着变。

改完两件事——`console.error` 读对时机、状态码从 err 读——再测 `/boom`(应仍是 500)和你新写的 404 路由(应是 404)。两个状态码都跟对了,这个错误处理器才算像样。

对,你观察得很准——这是个真问题,而且正好补上你今天对"错误处理中间件何时被触发"的理解。

**核心:错误处理中间件不是"任何 404 都会进",它只在『有 error 被传进链条』时才触发。**

分清两种 404,它们走的是完全不同的路:

1. **你那个会抛错、`err.statusCode = 404` 的路由** —— 这里有一个真实的 `throw`(或 `next(err)`),链条里**产生了 error 对象**,所以会流到你的错误处理中间件。这个你测通了。

2. **访问一个根本不存在的路径**(比如 `/nonexistent`)—— 这里**没有任何路由匹配上**,也就**没有人抛错、没有 error 对象**。Express 走的是它的默认兜底(还记得今天早上那个 `Cannot GET /xxx` 吗?就是它)。**没有 error,自然不会进你的错误处理中间件**——你的处理器是四参数、专接 error 的,没 error 它根本不参与。

你现在看到的"404 页面没进报错",如果你访问的是一个**不存在的路径**,那它走的是 Express 默认兜底,不经过你的 error handler——**这是对的,不是 bug**。

**那"找不到路径"这种 404 该怎么进入统一处理?**

这就引出错误处理之外的另一块拼图:**404 兜底中间件(catch-all)**。机制是这样的——

回到洋葱链条:一个请求穿过所有 `app.use` 和 `app.get`,如果**没有任何路由匹配**,它会一直走到链条**最末端**。那么你可以在所有路由后面、错误处理中间件前面,放一个**不带路径的普通中间件**(`app.use((req,res,next)=>{...})`)——它会接住所有"漏网"的请求(因为前面没人处理它们,它们才会走到这)。在这里你有两种选择:

- 直接 `res.status(404).json(...)` 回一个 404,或者
- 制造一个 error(给它挂 `statusCode = 404`)然后 `next(err)`,把它**交给你统一的错误处理中间件**处理——这样所有错误(包括"找不到")都从一个出口出去,格式统一。

**这步你自己写,给方向不给实现:**

1. 想清楚它的**位置**:catch-all 要放在哪?——所有正常路由**之后**(否则会拦截正常请求),错误处理中间件**之前**(如果你打算 `next(err)` 给它)。自己推一下为什么是这个夹层位置。
2. 想清楚它**不带路径**:为什么用 `app.use(...)` 而不是 `app.get('/xxx')`?(因为你不知道用户会乱访问什么路径,得接住**所有**漏网的,且**所有方法** GET/POST 都要接)
3. 选一种做法落地:要么直接回 404 JSON,要么 `next(err)` 转交统一错误处理器。后者更优雅(单一出口),推荐你试,但要自己制造 error 对象、挂上 statusCode。

写完测三种情况,确认它们各走各的路、都对:

- 访问 `/health` → 正常 200,**不**被 catch-all 拦(验证位置对、没误伤正常路由)
- 访问 `/nonexistent` → 现在应该回你的 404,而不是 Express 默认的 `Cannot GET`
- 访问 `/boom`(抛 500 的)→ 仍走 500,不受影响

写出来贴上,我只看结构。这块搞定,你今天的"中间件链条"地图就**首尾都齐了**:前面是 logger,中间是路由,漏网的有 catch-all 兜,出错的有 error handler 收。一张完整的洋葱。