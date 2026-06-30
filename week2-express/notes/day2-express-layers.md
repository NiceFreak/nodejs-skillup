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
