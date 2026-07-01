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