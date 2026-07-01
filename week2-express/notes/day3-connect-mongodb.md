今天第一步只做一件事:**让 Mongoose 在 app 启动时连上你那个 `shop` 库,并且能感知连接成功还是失败。** 不碰 repository、不碰 CRUD——先把"连上"这件事单独跑通,把连库和改数据两个坑分开撞。

连接代码你自己写,我给场景和必须自己想清楚的点:

**1. 装 mongoose**
`week2-express/` 里之前没装过 Mongoose(Week 1 那个在 `week1-mongoose/`)。先 `npm install mongoose`。这条是脚手架,直接做。

**2. 连接字符串:先解决"密码放哪"**
你 Compass 那串带明文密码 `root:example`。第一个决定:**别把它硬编码进 `.js` 源码**(会随 git 泄露)。用 `.env` 文件放连接字符串,代码里用 `process.env` 读。

- 你需要:建一个 `.env`、把 `MONGODB_URI=mongodb://root:example@localhost:27017/shop?authSource=admin` 放进去、`.env` 加进 `.gitignore`(密码绝不进版本库)。
- 读 `.env` 的方式:Node 20.6+ 原生支持 `node --env-file=.env`,或者用 `dotenv` 包。你查一下你 Node 版本(`node -v`),选一种。这块判断你来做。

**3. 连接本身:写一个 connect 逻辑**
用 `mongoose.connect(连接字符串)`。要自己想清楚的几个点:

- **连接放在哪执行?** app 启动时连**一次**,不是每次请求都连。所以这段代码的位置很关键——想想它该在 `app.listen` 之前、之后、还是并列?(提示:库都没连上,server 起来了也没意义……但也有另一种设计。你判断)
- **`mongoose.connect` 返回什么?** 它是**异步**的(返回 Promise)。所以你要用 `await` 或 `.then/.catch`。这就引出下一点。
- **怎么感知成功/失败?** 连成功了打印一句"DB connected",连失败了(比如密码错、authSource 漏了、Mongo 没跑)要**捕获错误并打印**,而不是让程序静默挂掉。失败时你甚至可能想让进程直接退出(`process.exit(1)`)——因为库连不上,这 app 根本没法工作。这个设计你想想要不要做。

**4. 故意制造一次失败(验证你的错误处理真的有用)**
连通之后,**故意把连接字符串里的 `?authSource=admin` 删掉**,重启,看会发生什么。你应该看到认证失败的错误被你的 catch 抓到、打印出来。这验证了两件事:①你的错误处理是真的在工作,不是摆设;②authSource 这个参数确实是必需的(呼应刚才讲的坑)。验证完再加回去。

---

**这一步的验收**:app 启动时终端打印"DB connected"(或类似),故意搞错连接串时能看到被捕获的错误、而不是一堆没头没脑的 crash。

repository 还是先用着 Day 2 那个写死的数组,**这一步完全不动它**——今天先把"连接"这一层单独立住,下一步才把 repository 接到真库。

问题: 连接 moogoose 的代码放在哪个文件?

**原则:连接是基础设施,不属于任何一层业务,所以它该有自己的位置,别塞进 route/controller/service/repository 里。**

常见的放法,从简到讲究:

**选项 A:单独建一个 `config/db.js`(推荐)**
在 `src/` 下建个 `config/`(或叫 `db/`、`lib/`),里面 `db.js` 专门负责连接。导出一个 `connectDB` 函数,内部做 `mongoose.connect(...)` + 错误处理。然后在 app 启动的地方 `import { connectDB }` 调它。

好处:连接逻辑集中一处、和业务代码隔离、以后要改连接配置只动这一个文件。这符合你 Day 2 建立的那套"每个东西有明确的归属"的思路。

**选项 B:直接写在 `app.js` 里**
简单粗暴,连接代码就搁在 `app.js` 顶部。今天只有一个连接、代码不多,这样也能跑。缺点:app.js 会越来越杂(它已经有 logger、路由挂载、错误处理了),连接混进去不清爽。

**我的建议:用 A。** 你 Day 2 刚把"职责分离"这件事贯彻得很好,连接作为基础设施单独拎出来,是同一个思路的延续。而且 Day 3 之后你可能还要加别的基础设施(比如环境变量校验),`config/` 这个位置正好收纳它们。

**所以结构会变成:**

```
src/
├── config/
│   └── db.js          ← 新增:connectDB 函数在这
├── routes/
├── controller/
├── services/
├── repositories/
├── app.js             ← 这里 import 并调用 connectDB
└── .env               ← 连接字符串在这
```

**留给你自己想的:**

- `db.js` 里导出的 `connectDB`,应该是个 **async 函数**(因为 `mongoose.connect` 是异步的)。那 app.js 里调它时怎么处理这个异步?——这就接回我上一条说的"连接放 `app.listen` 之前还是之后"。你会发现:如果想"库连上了再起 server",app.js 里启动的逻辑本身可能也得包成一个 async 函数。这个结构你自己搭搭看。
- 连接字符串从哪来?`db.js` 里用 `process.env.MONGODB_URI` 读——但前提是 `.env` 已经被加载了。加载 `.env` 的时机(`--env-file` 还是 `dotenv`)要在连接之前完成。想想这个顺序。

先把 `config/db.js` 建起来、`connectDB` 的骨架写出来(mongoose.connect + try/catch),然后回 app.js 想怎么调它。卡在异步串联或加载顺序,再发我。

代码尝试:
删掉 ?authSource=admin 后:
MongoDB connection error: MongoServerError: Authentication failed.
    at Connection.sendCommand (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/mongodb/lib/cmap/connection.js:320:27)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async Connection.command (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/mongodb/lib/cmap/connection.js:347:26)
    at async executeScram (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/mongodb/lib/cmap/auth/scram.js:78:22)
    at async ScramSHA256.auth (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/mongodb/lib/cmap/auth/scram.js:38:16)
    at async performInitialHandshake (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/mongodb/lib/cmap/connect.js:110:13)
    at async connect (/Users/nezha/Documents/nodejs-skillup/week2-express/src/node_modules/mongodb/lib/cmap/connect.js:28:9) {
  errorLabelSet: Set(2) { 'HandshakeError', 'ResetPool' },
  errorResponse: {
    ok: 0,
    errmsg: 'Authentication failed.',
    code: 18,
    codeName: 'AuthenticationFailed'
  },
  ok: 0,
  code: 18,
  codeName: 'AuthenticationFailed',
  connectionGeneration: 0
}
Failed running 'app.js'. Waiting for file changes before restarting... 页面显示无法访问此网站
localhost 拒绝了我们的连接请求。

week2-express/src/config/db.js
import mongoose from "mongoose";

const connectDB = async() => {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri).then(() => {
        console.log("MongoDB connected");
    }).catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });
}

export default connectDB;
week2-express/src/app.js
import connectDB from './config/db.js';
app.listen(PORT, async () => {
  await connectDB();
  console.log(`Express server running at http://localhost:${PORT}/`);
});

  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node --env-file=.env app.js",
    "dev": "node --env-file=.env --watch app.js"
  },

实验成功了,而且成功得很完整——你把该验证的两件事都验证到了,连带暴露了一个**结构 bug**,这个 bug 比实验本身更有价值。逐个收。

**验证 1:错误处理是真的在工作。** 删掉 `authSource=admin` → `Authentication failed`(code 18)→ 被你的 `.catch` 抓到、打印、`process.exit(1)` 退出。没有静默 crash,没有一堆没头没脑的堆栈冒到顶层。你的错误处理不是摆设。✓

**验证 2:`authSource=admin` 确实是必需的。** 少了它,Mongo 不知道去 admin 库验证 root 账号,直接认证失败。这个坑你现在亲手撞过一次,以后连任何带认证的 Mongo,你都会记得检查 authSource。✓(记得加回去)

---

**但这个实验顺手暴露了一个真 bug——你自己可能没注意到那句"localhost 拒绝了连接"。**

看你 app.js 的结构:

```js
app.listen(PORT, async () => {
  await connectDB();        // ← 连库在 listen 的回调里
  console.log(`...`);
});
```

你把 `connectDB()` 放在了 **`app.listen` 的回调里面**。这个顺序是**反的**,问题是这样的:

`app.listen` 先执行——server **立刻**开始监听端口、开始接收请求。**然后**回调里才 `await connectDB()`。这意味着有一个**时间窗口**:server 已经在收请求了,但库还没连上(甚至正在连、或连失败正在退出)。这段时间进来的请求,会打到一个"库还没就绪"的 app 上。

而这次更明显:`connectDB()` 里认证失败 → `process.exit(1)` → **进程直接退出** → 所以你浏览器访问时"localhost 拒绝连接"(server 进程已经没了)。你看到的那句拒绝连接,就是这个顺序问题的直接表现。

**正确的顺序应该反过来:先连库,连成功了,再起 server。** 想想为什么:

- 库是这个 app 的命根子,库连不上,server 起来了也没法干活(所有请求都会失败)。
- 所以逻辑应该是:`await connectDB()` **先**跑,成功了(没 exit)才往下走到 `app.listen`。

**改法(你来):** 把结构从"listen 里面 await 连库"改成"先 await 连库,再 listen"。大概的形状是——把启动逻辑包成一个 async 函数:先 `await connectDB()`,这一步过了(没失败退出),再 `app.listen(...)`。这样保证:**库不通,server 根本不会起;库通了,server 起来就是完全就绪的状态。**

一个自己想的点:`connectDB` 里已经有 `.catch` + `process.exit(1)` 了,那么在启动函数里 `await connectDB()` 之后的 `app.listen`,是不是只有在连接成功时才会执行到?(因为失败的话进程已经 exit 了,根本走不到 listen)——顺着这个想,你会发现"先连后起"的结构天然就对了。

---

**另外两个小点,一并说:**

**(a) 你 `connectDB` 里 `async/await` 和 `.then/.catch` 混用了。**

```js
await mongoose.connect(uri).then(...).catch(...)
```

这是两种异步写法叠在一起——`await` 是一种,`.then/.catch` 是另一种,你同时用了。能跑,但风格混乱。选一种:要么纯 `await` + `try/catch`,要么纯 `.then/.catch`(不加 await)。既然你函数是 `async`,更顺的是 **`try/catch` + `await`**。你改一下,统一风格。(这不是 bug,是可读性。)

**(b) 你 `--env-file` 用对了。** scripts 里 `node --env-file=.env` —— 你选了 Node 原生方式加载 `.env`,没用 dotenv 包,省一个依赖,对。说明你查了 Node 版本确认支持。✓ 顺带确认:`.env` 加进 `.gitignore` 了吗?(密码绝不进 git)这个自查一下。

---

**收一下你要改的:**
1. **把 `authSource=admin` 加回去**(实验做完了)
2. **调整启动顺序**:先 `await connectDB()`,成功后再 `app.listen`——不要在 listen 回调里连库(这是主要 bug,修完"拒绝连接"和"时间窗口"问题一起消失)
3. `connectDB` 里 `await` 和 `.then` 二选一,统一风格(可读性)
4. 自查 `.env` 在 `.gitignore` 里

改完验收:正常启动时,终端应该**先**打印"MongoDB connected"、**再**打印"Express server running";故意搞错连接串时,server 那句不该出现(因为库没连上,压根走不到 listen)。这个"两句话的先后顺序",就是你启动顺序对不对的直接证据。

.env已加 .gitignore
db.js
import mongoose from "mongoose";

const connectDB = async() => {
    const uri = process.env.MONGODB_URI;
    try {
        await mongoose.connect(uri);
        console.log("MongoDB connected");
    } catch (err) {
        console.error("MongoDB connection error:", err);
        throw err;
    }
}

export default connectDB;

app.js
async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Express server running at http://localhost:${PORT}/`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

startServer();

