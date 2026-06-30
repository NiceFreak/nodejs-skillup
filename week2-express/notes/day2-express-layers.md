Day 2。今天是**结构重构**,不是新 API 知识。在你动手拆之前,我先只做一件事:确认你**理解了为什么分层**,因为这决定你拆得对不对。先不写代码,口头回我三个问题(这就是今天的地基):

**1. 四层职责,你能用一句话各自概括吗?**
route / controller / service / repository,每层"只干什么、不碰什么"。凭理解说,说不全的地方正是要补的。

**2. 为什么调用必须单向(route→controller→service→repository),反过来不行?**
特别是:repository 为什么不能反过来调 service?

**3. 核心那问:既然昨天不分层也能跑,分层到底解决什么?**
想象这个 API 长到 20 个端点、或者要把 MongoDB 换成别的库、或者要写测试——不分层会痛在哪?

这三个你讲清楚了,再动手拆 server.js 就是水到渠成;讲不清就硬拆,会拆成"目录变多但职责还是混的"假分层。

先回这三个,凭自己理解说。卡哪说哪。

回答:
1. 分层架构: route: 路由层, 一个请求的入口, 客户端发来 HTTP 请求时, 解析 API URL, 分发给具体的业务逻辑部分去处理
    controller: 控制器, 1. 接收 route 传来的请求对象（req）, 2. 返回客户端响应对象（res）
    service: 服务层, 接收 Controller 传来的数据, 执行具体的业务逻辑, 如需操作数据库, 则通过调用 repository 操作
    repository: 持久层, 只负责操作数据库并把数据返回给 service
2. 因为 express 是一个洋葱圈模型, 这是必须遵守的规则, 如果没有从外到内传进来的数据库操作请求, repository 没有能力得知需要怎么操作数据库, 更无法反过来调用 service
3. 分层可以解决很多问题: 1. route 的引入, 让 API 可以更好地归类, 如果我们按照 restful 开发 api,代码的可读性和可维护性都会提高, 2. Controller 只需要专注于处理 req 和 res, 代码更加解耦, 3. service 是纯粹的业务逻辑, 设计调用数据库是再调用 repository. 也就是说, 即使换数据库, route, Controller, service 的代码可以不动, repository 可能会因为数据库的改变需要改动代码,这样我们的架构可维护性和通用性大大提高了.写测试也更多可以按照具体的 api 来测试, 聚合程度很高

理解得相当扎实,尤其第 3 题——"换数据库时只有 repository 要动"这个点你抓得很准,这就是分层最值钱的回报。但有两处我得给你纠偏/补强,因为它们会直接影响你待会儿拆得对不对。

**第 1 题:controller 的概括少了关键一环。**

你写 controller 是"接收 req、返回 res"——这只说了它的**两头**,漏了**中间最重要的动作:它要调用 service**。完整的 controller 是:读 `req` 拿参数 → **调 service 拿到业务结果** → 把结果包成 `res.json()`。

为什么这个漏掉很关键?因为如果你脑子里 controller 只是"收 req 发 res",待会儿你很可能**忍不住在 controller 里写业务逻辑或查数据库**——那就破坏分层了。记住 controller 的定位是**翻译官**:把"HTTP 世界"(req/res)翻译成"业务世界"(给 service 的普通参数),再把业务结果翻译回 HTTP。它自己不做决策、不碰数据。

其余三层你概括得对:route 管映射分发、service 管业务逻辑、repository 管数据访问。✓

**第 2 题:你的理由用错了模型,得纠正。**

你说"因为 Express 是洋葱圈模型,所以必须单向"——**这两个不是一回事**,别搭错。

- **洋葱模型**讲的是**中间件**怎么串(昨天那条 logger→路由→catch-all→error handler 的链)。它是请求**横向**穿过一串中间件的过程。
- **分层的单向调用**讲的是请求处理时,代码**纵向**从 route 往下调到 repository。这跟洋葱、跟 Express 本身**没有关系**——你换任何框架、任何语言写分层,都是这个单向规则。它是个**软件架构原则**,不是 Express 特性。

那单向的**真正理由**是什么?——是**依赖方向**。上层依赖下层(controller 需要 service、service 需要 repository),但下层**不应该知道上层的存在**。为什么 repository 不能调 service?因为 repository 的全部职责是"我只管存取数据,我不关心谁用我、用来干嘛"。一旦它反过来调 service,就等于"数据访问层开始掺和业务逻辑"——两层职责糊在一起,你换数据库时又得动业务代码,分层的好处当场报废。而且会形成**循环依赖**(service 调 repository,repository 又调 service),结构就乱了。

一句话记牢:**单向不是因为 Express,是因为"下层不该认识上层"。**

**第 3 题:对,而且你自己推到了核心。** 换库只动 repository、controller 解耦、按 API 测试——都对。补一个你没明说但很重要的:**可测试性**。service 是纯业务逻辑、不碰 req/res、不碰真数据库,意味着你能**单独测它**,不用起 HTTP 服务器、不用连数据库——给它喂普通参数,看它返回对不对。这是分层给测试的最大红利,Week 6 写测试时你会回到这点。

---

收一下:两处纠偏是 **①controller 要调 service(它是翻译官,不是收发室)**、**②单向的理由是"下层不认识上层",跟洋葱无关**。其余你都对。

这两点想通了,地基就稳了。现在可以动手——按昨天大纲,**不连真库,repository 先用写死的数组**,挑**一个**端点(建议 `GET /users`)让它完整穿过四层。

动手前最后一个判断留给你:四层分别放在什么文件/目录里?(`routes/` `controllers/` `services/` `repositories/`?还是别的组织法?)你定结构,然后让 `GET /users` 从上到下走通。

回答: 
src
|- routes/
|- controllers/
|- services/
|- repositories/

发起 GET /users 请求 -> routes 匹配 -> req 传入 controllers -> 调用 services -> repositories 操作数据库并返回结果到 services -> services 返回 res 给 controllers -> 转换为客户端可解析的格式 -> 客户端接收返回值

目录结构对,标准的分层组织。数据流向也基本对,但有**一处用词暴露了职责边界还没完全清晰**,趁动手前掐掉,不然会拆歪。

**"services 返回 res 给 controllers" —— 这里的 `res` 用错了,而且是关键的错。**

service **不知道 `res` 是什么**。`res`(响应对象)是 HTTP 世界的东西,只存在于 controller 那一层往上。service 是纯业务层,它返回的是**普通数据**——一个数组、一个对象、一个值,而不是 `res`。

把你那句改准确:

> repositories 返回数据给 services → **services 返回(普通)数据给 controllers** → controllers 把这个数据包成 `res.json(...)` 发给客户端

区别在哪、为什么要较这个真:

- 如果 service 返回的是 `res` 或者 service 里出现了 `res.json()`,那等于 service 碰了 HTTP——它就**不纯**了,你之后没法脱离 HTTP 单独测它,换协议(比如改成 GraphQL、或内部直接调用)时 service 也得跟着改。
- service 只返回数据、对 HTTP 一无所知,才能保持"纯业务逻辑"——这正是你第 3 题自己说的可测试性的前提。

一句话:**只有 controller 碰 req/res,service 和 repository 里不应该出现这两个词。** 这是检验你分层有没有越界的最简单的尺子——待会儿写完,全局搜一下 `req` 和 `res`,如果它们出现在 service 或 repository 里,就是越界了。

**其余流向都对:** route 匹配分发、controller 调 service、service 调 repository、repository 操作数据(今天是写死的数组)、结果逐层往上返。✓

---

现在动手。带着那把尺子(`req`/`res` 只能出现在 controller)写,挑 `GET /users` 穿四层,repository 用写死的数组顶着。

几个落地时你自己要做的判断(不给你答案):

- 四层之间**怎么互相引用**?(controller 怎么拿到 service?service 怎么拿到 repository?——用 `require`/`import`,你决定谁 import 谁,注意方向)
- `app.js` / `server.js` 里现在只剩什么?(路由都拆出去了,主文件应该瘦下来——想想它还负责什么)
- repository 那个写死的数组,返回时直接返回原数组好,还是返回个副本?(先不用纠结,但可以留意)

从下往上,顺着依赖反方向写——**repository → service → controller → route**。

为什么这个顺序最顺(给你理由,你判断认不认):

**先写 repository**:它最底层、谁也不依赖,只依赖那个写死的数组。先把它写出来,上面三层才有东西可调。如果反过来先写 route,你会发现它要调的 controller 还不存在,只能写一半空着。从最底层那个"自给自足"的开始,每往上一层,它要依赖的下层都已经就绪了。

**顺序展开:**

1. **repository** —— 写死一个 users 数组,导出一个函数(比如 `findAll()`)返回它。这层最简单,先落地。
2. **service** —— `require` repository,调它的 `findAll()`,拿到数据返回。今天没有真业务逻辑,这层会"薄得像没用"——**这是正常的**,别因为它薄就想跳过(下面补一句)。
3. **controller** —— `require` service,调它,把结果 `res.json()` 出去。这层碰 req/res。
4. **route** —— `require` controller,把 `GET /users` 映射到 controller 的函数。
5. 最后回 **app.js** —— 把 route 挂上去,主文件瘦身。

**一个你会撞到的困惑,先提醒:** 写到 service 时你会觉得"它啥也没干,就是把 repository 的结果原样传上去,这层是不是多余?"——**今天确实多余,但结构上必须留着**。因为 service 是"业务逻辑的预留位":今天 `GET /users` 没逻辑,但明天要加"只返回激活的用户""按权限过滤""组合多个 repository 的数据",这些都长在 service 里。现在留着空架子,是给未来的逻辑留位置。如果今天图省事让 controller 直接调 repository,跳过 service,那以后加业务逻辑时你得回头重构。**薄不等于该删。**

**还有个判断留给你**:每层导出函数,是用对象 `module.exports = { findAll }` 还是别的形式?自己定,选一种一致地用。

按这个顺序写,每写一层都能 `require` 到下层、立刻验证。省额度:整条链写通、`GET /users` 返回假数组之后,想让我查越界再发我,四层一起发。开始吧。

记录:
app.js 挂载 route
route 只负责 URL -> controller
controller 调 service，并且只有 controller 碰 req/res
service 调 repository，只返回普通数据
repository 返回 mock users
代码修改记录:
week2-express/src/package.json
  "type": "module",
week2-express/src/app.js
import { getUsersData } from './routes/getUsersData.js';
import express from 'express';
const app = express();

// 中间件: logger —— 记录请求方法、路径、状态码、耗时
app.use((req, res, next) => {
  const start = Date.now();
  next();
  res.on('finish', () => {
    const method = req.method;
    const url = req.url;
    const statusCode = res.statusCode;
    const end = Date.now();
    const duration = end - start;
    console.log('logger: ', method, url, statusCode, duration, 'ms');
  });
});

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.get('/users', (req, res) => {
    getUsersData(req, res);
});

// 中间件: catch-all —— 捕获所有未匹配的路由
app.use((req, res, next) => {
  const err = new Error(`路由 ${req.method} ${req.url} 不存在`);
  err.statusCode = 404;
  next(err);  // 交给 error handler 处理
});

// 中间件: error handler —— 捕获错误,返回 500
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || '错误';
  res.status(statusCode).json({ error: `${statusCode}: ${message}` });
  console.error('错误消息: ', `${statusCode}: ${message}`);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}/`);
});

week2-express/src/routes/getUsersData.js
// 客户端发起 http 请求, /users 路径, 服务器端返回 users 数据
import { createUsersData } from "../controller/users.js";

export async function getUsersData(req, res) {
    await createUsersData(req, res);
    console.log('getUsersData: ', res.json);
}

week2-express/src/controller/users.js
// 从 routes/getUsersData.js 导入 getUsersData 函数的 request handler
// 从 services/getUsersData.js 导入 getUsersData 函数的返回值, 并创建 response 对象
import { getUsersData } from "../services/getUsersData.js";

export async function createUsersData(req, res) {
    const users = await getUsersData();
    res.json(users);
}

week2-express/src/services/getUsersData.js
// 从 repositories/getUsers.js 导入 getUsers 函数, 并创建 users 变量
// 将数据返回给 controller/users.js 的 getUsersData 函数
import { getUsers } from "../repositories/getUsers.js";

export async function getUsersData() {
    const users = await getUsers();
    return users;
}

week2-express/src/repositories/getUsers.js
// 写死一个 users 数组,导出一个函数(比如 `findAll()`)返回它。这层最简单,先落地。
export async function getUsers() {
    // mock data
    const users = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
    ];
    return users;
}

能跑,数据流也确实穿了四层——`req`/`res` 那把尺子你也守住了(service 和 repository 里干干净净,没碰 HTTP)。这两点是地基,对了。

但你自己那句"文件名和函数名要再优化"——直觉非常准。现在的命名有几处会**误导你对分层的理解**,趁结构还小,值得纠。逐个说,我只点问题和方向,改名你自己来。

**问题 1:文件名按"用例"命名,而不是按"资源"——这会让分层崩掉。**

你现在每一层的文件都叫 `getUsersData.js` / `getUsers.js`。想象一下:下周加 `POST /users`(创建用户)、`DELETE /users/:id`(删除),你难道每层再建一个 `createUsersData.js`、`deleteUsersData.js`?——文件会爆炸,而且同一个资源(users)的逻辑散落在一堆文件里。

分层的惯例是**按资源(数据实体)命名文件,按操作命名函数**:

- 文件:每层一个 `users.js`(controller/users.js、service/users.js、repository/users.js)——这个资源的所有操作都在这个文件里。
- 函数:`getAll` / `create` / `remove` ……用函数区分操作。

这样 `POST /users` `DELETE /users/:id` 都往各层的 `users.js` 里加函数,不新建文件。你 controller 目录已经叫 `controller/users.js` 了——对了一半,把 routes 和 service 也统一成这个思路。

**问题 2:函数名"说谎"了,这个最该改。**

看你 controller 里这个:

```js
export async function createUsersData(req, res) {  // 名字叫 create
    const users = await getUsersData();
    res.json(users);                                // 实际在"读取并返回"
}
```

这个函数干的是**读取 users 列表**(GET),但名字叫 `createUsersData`——`create` 是"创建"的意思,这是 POST 的语义。**名字和行为相反**。等你真加了 `POST /users`,会撞名、会自己搞混。函数名必须如实反映它干什么:读列表就叫 `getAll` / `list` / `findAll` 之类,别用 create。

service、repository 同理过一遍,确保每个函数名 = 它的真实行为。

**问题 3:`getUsersData` 这个名字在三层里重复,分不清谁是谁。**

route 里有 `getUsersData`、service 里也有 `getUsersData`——同名函数在不同层,你读代码时很难一眼看出"现在在哪层"。各层函数可以用更贴合该层职责的名字,或者至少靠目录区分清楚。一个常见做法:controller 的函数名体现"处理请求"(如 `getUsers`),service 体现"业务"(如 `listUsers` / `getAllUsers`),repository 体现"数据访问"(如 `findAll`)。不强求套路,但**不要三层全叫一个名**。

**问题 4(真 bug,得删):route 里那行 `console.log` 会报错。**

```js
export async function getUsersData(req, res) {
    await createUsersData(req, res);
    console.log('getUsersData: ', res.json);   // ← 这行
}
```

`res.json` 是个**函数**,你打印它会输出函数本身(`[Function: json]`),不是数据——而且此刻 controller 已经 `res.json(users)` 把响应发出去了,这行 log 没意义。删掉。(顺带:这也说明你想在 route 层"看看返回了啥"——但 route 不该关心响应内容,那是 controller 的事。这个冲动本身又一次说明职责边界:route 只管转发,不管结果。)

**问题 5(小):异步是真的吗?**

你每层都 `async`/`await`。今天 repository 是写死的数组、**没有真异步操作**,所以这些 async 严格说是多余的。**但我建议你留着**——因为 Day 3 连真数据库后,repository 里 `await db.find()` 是真异步,你现在留着 async 链,到时候无缝衔接。所以这条不是错,是"提前为异步铺路",留着对。(知道为什么留着即可。)

---

**收一下,你要动手改的:**

1. 文件名:各层统一成 `users.js`(按资源),别按用例命名。
2. 函数名:`createUsersData` 这种"说谎"的名字改掉,名字 = 真实行为(读列表 ≠ create)。
3. 三层别用同一个函数名,按层区分。
4. 删掉 route 里那行 `console.log('...', res.json)`。
5. async 链留着(为 Day 3 铺路)。

这些都是**命名和职责的打磨**,不动你已经跑通的结构——改完整条链还是能返回那个假数组,但读起来会"每个名字都说真话"。这恰恰是分层真正的价值之一:**好的命名让职责自解释**。

改完不用整个发我(省额度)。你自己对照"名字有没有说谎、文件是不是按资源、三层有没有重名"这三条自查就行。除非你改完有拿不准的某一处,再单独发那一处。

留两个**判断题**给你,不用现在写代码,当午休前的回味就行,想通了下午扩展时就顺:

1. 现在 `GET /users` 通了。如果要加 `GET /users/:id`(查单个用户),这条新链路,**四层里每层各加什么**?(route 加带参数的路由、controller 怎么拿到那个 id、service 传下去、repository 怎么按 id 找)——光在脑子里走一遍这个流程。
2. 你 app.js 里现在还留着 `app.get('/users', ...)` 再调 route 函数——这中间是不是多绕了一层?Express 有没有更直接的方式把整个 `routes/users.js` 一次性挂上去?(提示:`express.Router()`,这是 route 层"标准长相",下午可以查)

下午的自然下一步,就是上午留给你的那两个判断题落地——它们正好把分层从"跑通一个端点"推到"像真实项目的样子":

**1. 用 `express.Router()` 把路由收口(上午留的第 2 题)**

你现在 app.js 里是 `app.get('/users', ...)` 再手动调 route 函数,中间多绕了一层。真实项目里 route 层的标准长相是用 `express.Router()`——把 users 相关的路由集中到 `routes/users.js`,在 app.js 里一行 `app.use('/users', usersRouter)` 挂上去。这步是**结构收口**,让 app.js 更干净。查一下 Router 怎么用,自己改。

**2. 加 `GET /users/:id`,跑通"带参数"的一条链(上午留的第 1 题)**

这是给你的四层第一次加**第二个端点**——验证你的结构是不是真的"加端点 = 各层加函数",而不是又得重搭。难点在参数怎么逐层往下传:

- route:路径参数 `:id` 怎么写
- controller:从 `req` 的哪里拿到这个 id?(查 `req.params`)
- service:接收 id,传给 repository
- repository:在写死的数组里按 id 找一个(数组方法你熟)

**一个坑提前点**:按 id 找,找不到怎么办?repository 返回了 undefined/null,这个"没找到"该在**哪一层**变成 404?(想想:repository 只管找、不懂 HTTP;404 是 HTTP 概念……所以判断"有没有"该在哪、返回 404 该在哪)这个你自己想,撞到了再说。

**建议顺序**:先做 1(Router 收口,改动小、纯结构),再做 2(加端点,有新东西)。或者你想先加端点、回头再收口也行。

这两块都属于**结构性练习,没有特别重的新概念**,适合下午。强度可控,真库还是不连(Day 3 才连)。

代码
当前的问题: 访问 /users 或 /users/ 会返回 {"error":"404: 路由 GET /users 不存在"}, users/1 users/2 正常解析到一条数据, users/3 返回 [] 空数组, 目前没有办法返回整个数组
app.js
import { listUsersRouter } from './routes/users.js';
app.get('/users/:id', listUsersRouter);
week2-express/src/routes/users.js
import express from 'express';
import { listUsersController } from '../controller/users.js';

const listUsersRouter = express.Router();

// GET /users:id
listUsersRouter.get('/users/:id', async (req, res) => {
    await listUsersController(req, res);
});

export { listUsersRouter };

week2-express/src/controller/users.js
import { listUsersService } from '../services/users.js';

export async function listUsersController(req, res) {
    console.log('listUsersController: ', req.params);
    const { id } = req.params;
    if (!id) {
        const users = await listUsersService();
        return res.json(users);
    }
    const users = await listUsersService(id);
    return res.json(users);
}
week2-express/src/services/users.js
import { findAllUsers } from '../repositories/users.js';

export async function listUsersService(id = null) {
    const users = await findAllUsers(id);
    return users;
}
week2-express/src/repositories/users.js
// mock data
const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
];

export async function findAllUsers(id = null) {
    if (id) {
        const user = users.find(user => user.id === parseInt(id));
        return user ? [user] : [];
    }
    return users;
}

状态不错那就好。你撞到的几个现象,根子是**两个问题**,我帮你定位,改法你来。

**问题 1(核心):你把 `express.Router()` 用错了,导致 `/users` 整个路由"挂不上"。**

这是你那几个 404 的真凶。看这两处的配合:

```js
// app.js
app.get('/users/:id', listUsersRouter);   // ← 用 app.get 挂 router

// routes/users.js
listUsersRouter.get('/users/:id', ...);   // ← router 内部又写了 /users/:id
```

两个问题叠在一起:

**(a) Router 应该用 `app.use` 挂,不是 `app.get`。** Router 是"一组路由的集合",`app.use` 才能把整组挂上去;`app.get` 是挂单个处理函数的,用它挂 Router 是错配。而且 `app.get('/users/:id', ...)` 写死了路径,等于把 Router 的灵活性废了。

**(b) 路径被写重复了。** 标准用法是**挂载点 + 子路径分离**:

- app.js 里:`app.use('/users', listUsersRouter)` —— 声明"凡是 `/users` 开头的,交给这个 router"
- router 里:`listUsersRouter.get('/:id', ...)` —— **只写相对路径**,前面的 `/users` 已经被挂载点吃掉了

你现在 router 里写的是 `/users/:id`,加上挂载逻辑,实际路径就乱套了,所以 `/users` 匹配不上、报 404。

**改法(你来):**
- app.js:把 `app.get('/users/:id', listUsersRouter)` 改成 `app.use('/users', listUsersRouter)`
- router:把两条路由的路径改成相对的——列表是 `listUsersRouter.get('/', ...)`,单个是 `listUsersRouter.get('/:id', ...)`

注意:这样改完,`/` 在 router 里就代表 `/users` 本身,`/:id` 代表 `/users/:id`。两条路由都挂在同一个 router 上。

---

**问题 2:`/users`(无 id)拿不到全部数组——因为你只注册了 `/:id` 一条路由,没注册"列表"那条。**

你 controller 里 `if (!id)` 想返回全部,逻辑是对的,但**根本没有一条路由能匹配到 `/users` 本身**(你只写了 `/users/:id`)。所以请求 `/users` 时,连 controller 都进不去,直接 404。

改法:在 router 里**补一条列表路由** `listUsersRouter.get('/', ...)`,让 `/users` 有人接。这样:

- `GET /users` → 匹配 router 的 `/` → controller 的 `id` 是 undefined → 走 `if (!id)` 返回全部 ✓
- `GET /users/1` → 匹配 router 的 `/:id` → 返回单个 ✓

---

**问题 3(设计,得想):`/users/3` 返回 `[]` 空数组,这对吗?**

这是上午我给你埋的那个坑,现在浮出来了。两个层面:

**(a) 语义:查单个用户找不到,该返回什么?** 你现在返回 `[]`(空数组)。但 `/users/3` 是"查 id=3 这一个用户",它不存在时,合理的响应是 **404 Not Found**,而不是 200 + 空数组。空数组的意思是"查询成功,结果为空",这跟"这个资源不存在"是两回事。客户端拿到 200 会以为成功了。

**(b) 更深一层:`[user]` 这个包装错了。** 看你 repository:查单个时返回 `user ? [user] : []`——你把**单个用户裹进了数组**。但"查一个用户"就该返回**一个用户对象**(或 null),不是数组。数组是"查列表"的形状。你现在单个、列表都返回数组,形状没区分开。

**这暴露一个分层问题:你用同一个函数 `findAllUsers(id)` 干了两件事**——id 为空时查全部、id 有值时查单个。这两件事**语义不同、返回形状不同、找不到的处理也不同**,硬塞进一个函数,所以才别扭。

**更干净的做法(你判断要不要改):repository 拆成两个函数**——

- `findAll()` → 返回数组(列表)
- `findById(id)` → 返回**单个对象或 null**(不裹数组)

然后 service、controller 也分开两条路径处理。这样:列表返数组,单个返对象或 null;controller 拿到 null 就回 404。各管各的,形状清晰。

**而 404 该在哪一层判断?**(上午的坑)——repository 返回 null(它只管"找没找到",不懂 HTTP);controller 拿到 null,把它翻译成 404(404 是 HTTP 概念,只有 controller 碰 HTTP)。**service 和 repository 都不该出现 404 这个数字。** 这就是那个坑的答案:判断"有没有"可以在 repository(返回 null),但"返回 404"必须在 controller。

---

**收一下你要改的:**

1. **Router 挂载**:`app.use('/users', router)` + router 里用相对路径 `/` 和 `/:id`(修 404 主因)
2. **补列表路由** `/`,让 `/users` 有人接
3. **(推荐)repository 拆 `findAll` / `findById`**,单个返对象或 null 不裹数组;controller 拿到 null 回 404

前两条是必修(不改 `/users` 一直 404);第 3 条是设计优化,但它正好让你把"分层里谁负责什么"理解得更深,建议做。

改动
app.use('/users', listUsersRouter);

import express from 'express';
import { listUsersController } from '../controller/users.js';

const listUsersRouter = express.Router();

// GET /users
listUsersRouter.get('/', async (req, res) => {
    await listUsersController(req, res);
});

// GET /users:id
listUsersRouter.get('/:id', async (req, res) => {
    await listUsersController(req, res);
});

export { listUsersRouter };

import { listUsersService } from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (!id) {
        const users = await listUsersService();
        return res.json(users);
    } else {
        const user = await listUsersService(id);
        if (!user) {
            return res.status(404).json({ error: `User with id ${id} not found` });
        }
        return res.json(user);
    }
}

import { findAll, findById } from '../repositories/users.js';

export async function listUsersService(id = null) {
    if (!id) {
        return await findAll();
    } else {
        return await findById(id);
    }
}

// mock data
const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
];

export async function findAll() {
    return users;
}

export async function findById(id) {
    const user = users.find(user => user.id === parseInt(id));
    return user;
}

这一版对了,而且对得很彻底。三个问题全收掉了:

- **Router 挂载**:`app.use('/users', router)` + 相对路径 `/` 和 `/:id` —— 路由通了。
- **列表路由补上**:`/users` 有人接了。
- **repository 拆分**:`findAll` 返数组、`findById` 返**对象或 undefined**(不再裹 `[user]`),形状分清了。
- **404 落在 controller**:`findById` 返回 falsy → controller 判断 → `res.status(404)`。**repository 和 service 里没有出现 404、没碰 res** —— 那个坑你踩对了:判断"找没找到"在底层,翻译成 404 在 controller。这正是上午"谁懂 HTTP"那条尺子的应用。

自查一下三条,应该都对了:`/users` 返回全部数组、`/users/1` 返回单个对象、`/users/3` 返回 404 而不是空数组。

---

不过你既然在打磨,有**两个点**值得你想一想——都不是 bug,是"想得更清楚"的层面,你判断要不要动:

**1. service 现在是个"纯转发"层,这次特别明显。**

看你的 service:

```js
export async function listUsersService(id = null) {
    if (!id) return await findAll();
    else return await findById(id);
}
```

它做的事 100% 是"把 controller 的分支原样转给 repository"——`if id` 调 findById、`else` 调 findAll。它没加任何业务逻辑。这又是上午说的"service 今天薄得像没用"。

这里有个更值得想的设计问题:**这个 if/else 分流,到底该在 service 做,还是 controller 做?** 现在你 controller 里有一个 `if (!id)` 分支,service 里**又有一个** `if (!id)` 分支——**同一个判断写了两遍**。这是个信号:职责重叠了。

一个更干净的思路:controller 已经知道"有没有 id"了(它从 `req.params` 读的),那它可以**直接调对应的 service 方法**——有 id 调"查单个"、没 id 调"查列表",而不是把 id 传给一个"万能 service"让它再判断一次。也就是 service 拆成两个方法:`getAllUsers()` 和 `getUserById(id)`,各干一件事,不再有 `id=null` 这种"靠参数是否为空来分流"的设计。

**为什么这样更好?** "用一个可选参数 `id=null` 让函数干两件事"是个常见的味道——函数有了两种模式,调用者得知道"传 null 会怎样"。拆成两个意图明确的函数,每个只干一件事,读代码的人一眼就懂。你 repository 已经是这样了(findAll / findById 两个),但 service 还停在"一个函数 + 可选参数"。可以让 service 也对齐 repository 的拆法。

这个你判断——今天数据简单,不拆也能跑;但拆了之后,四层的"一个函数一件事"就齐了,而且消掉了重复的 if/else。

**2. `parseInt` 那个潜在坑(留意,不急改)。**

`findById` 里 `user.id === parseInt(id)`。如果有人访问 `/users/abc`,`parseInt('abc')` 是 `NaN`,`NaN === 任何数` 都是 false,所以会返回 undefined → controller 回 404。**碰巧结果是对的**(abc 确实不是有效用户)。但这是"撞对的",不是"设计对的"——你没有显式处理"id 根本不是数字"这种情况。今天不用改,记一笔:真实项目里,**参数校验**(id 必须是数字)是 controller 或专门的校验中间件该干的事,这是 Week 2 后面"请求校验"的内容。先埋着。

---

**收一下:**
- 必修部分你全过了,`/users` 和 `/users/:id` 两条链都通、404 落点正确、形状分清。**Day 2 的核心目标(分层 + 多端点 + 参数 + 404 落层)达成了。**
- 两个"想清楚"的点:① service 能不能也拆成两个方法、消掉重复的 if/else(推荐想想,动手不难);② parseInt/NaN 的校验坑(只记不改)。

import { listAllUsersService, listUserByIdService } from '../services/users.js';

export async function listUsersController(req, res) {
    const { id } = req.params;
    if (id && isNaN(parseInt(id))) {
        return res.status(400).json({ error: `Invalid id: ${id}` });
    }
    if (!id) {
        const users = await listAllUsersService();
        return res.json(users);
    } else {
        const user = await listUserByIdService(id);
        if (!user) {
            return res.status(404).json({ error: `User with id ${id} not found` });
        }
        return res.json(user);
    }
}

import { findAll, findById } from '../repositories/users.js';

export async function listAllUsersService() {
    return await findAll();
}

export async function listUserByIdService(id) {
    return await findById(id);
}

漂亮,这一版把两个点都收了,而且你还多做了一件我只让你"记着别动"的事——主动加了 id 校验。来逐个确认:

**service 拆成两个方法,重复的 if/else 消掉了。** `listAllUsersService` 和 `listUserByIdService` 各干一件事,不再有 `id=null` 那种"靠参数空不空来分流"的设计。现在 controller 的分支和 service 的方法**一一对应**:没 id 调列表方法、有 id 调单个方法。职责不再重叠。四层"一个函数一件事"齐了。

**你还顺手把 parseInt/NaN 那个坑补了**——`if (id && isNaN(parseInt(id)))` 返回 **400**。这个处理是对的,而且你 400/404 用得很准:

- `/users/abc` → id 不是数字 → **400 Bad Request**(客户端请求格式就错了)
- `/users/3` → id 合法但查无此人 → **404 Not Found**(请求没错,资源不存在)

能区分 400 和 404,说明你理解了"是请求本身有问题,还是请求没问题但东西不在"——这是很多人都搞混的点,你分对了。

而且校验放在 **controller**,落层也对:参数校验属于"HTTP 入口的把关",在碰 service/repository 之前就拦掉非法输入,底层拿到的都是干净的。✓

---

一个**很轻的观察**,纯属锦上添花,不用改:

`if (id && isNaN(parseInt(id)))` 里的 `id &&` 其实可省——因为这个分支后面紧跟 `if (!id)`,能走到校验这行的本来就分两种:有 id 或没 id。没 id 时 `isNaN(parseInt(undefined))` 是 `isNaN(NaN)` = true,会误判成 400。所以你加 `id &&` 挡住"没 id"的情况,是**对的、必要的**。我收回"可省"——你这个 `id &&` 防的正是 `/users`(无 id)被误判成 400。写对了,别动。

(我这是故意把推理走了一遍给你看:乍看像冗余的条件,其实在防一个真实的边界。你能不能解释"为什么 `id &&` 不能删"——能解释就说明你不是抄的,是想过的。)

---

**Day 2 到此,该撞的全撞到了,而且超出预期:**

- 分层四层职责 + 单向依赖(理解层面)
- 一个端点穿四层、`req`/`res` 不越界
- `express.Router()` 收口(挂载点 + 相对路径分离)
- 多端点 + 路径参数(`/:id` + `req.params`)
- repository 拆 findAll/findById、形状区分(数组 vs 对象)
- 404 落 controller、service/repository 不懂 HTTP
- 400 vs 404 的语义区分 + 参数校验落层

最后这一版,四层干净、命名说真话、状态码语义准。这是个**结构正确的分层 demo**,Day 3 连真库时,你只要把 repository 里的写死数组换成真的 Mongoose 查询,上面三层几乎不用动——这就是分层今天给你的回报,你会亲眼看到。
