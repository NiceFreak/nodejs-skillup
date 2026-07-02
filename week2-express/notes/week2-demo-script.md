# Week 2 Demo 讲解脚本 · Express RESTful API + MongoDB

> 用途：现场演示，半脱稿用。每步列了做什么操作、讲哪几个关键词，照着关键词把内容说清楚就行，不用背台词。API 调用用 Postman（对应 `users.postman_collection.json`）。总时长 12–15 分钟，边界场景那段时间紧就少点几条。

---

## 0. 开场前检查清单（提前 5 分钟做完）

- [ ] MongoDB 启动了（`docker compose up -d`），Compass 连上、开着 `users` 集合
- [ ] `.env` 里 `MONGODB_URI` 配对了
- [ ] `npm run dev` 跑起来，终端打出 `Server is running on port 3000`，没报错
- [ ] Postman 打开 `users.postman_collection.json`，`baseUrl` 指向 `http://localhost:3000`
- [ ] 提前空跑一遍第四个文件夹（409 那组）的两条 seed 请求，确认能正常创建+自动清理
- [ ] 留一个终端窗口，给最后 `Ctrl+C` 那个环节用

---

## 1. 开场

**说：** "这周做的是一个 User 的增删改查接口，用 Express 写的，连的是 MongoDB。下面先过一遍架构，再用 Postman 走一遍主流程和几个边界情况。"

---

## 2. 架构（3 分钟，指着目录讲）

**做什么：** 打开 `week2-express/src/` 目录：

```
src/
├── app.js                 # 挂中间件、路由、错误中间件、优雅关闭
├── config/db.js           # connectDB / disconnectDB
├── middlewares/           # 入口校验：ObjectId 格式、body 是否存在
├── models/users.js        # Schema + 校验(required/unique/match)
├── routes/users.js        # URL → 中间件 → controller
├── controller/users.js    # 处理 req/res，调用 service
├── services/users.js      # 业务规则(目前是字段白名单)
├── repositories/users.js  # 数据访问 + 错误翻译
├── errors/userErrors.js   # 领域错误类
└── utils/validators.js    # 纯校验函数
```

**讲三件事：**

**① 分层 —— `四层` `req/res 只在 controller`**
> "分四层：route 匹配走哪个处理函数；controller 从 `req` 取参数、调用 service、把结果包成响应返回；service 放业务规则；repository 操作数据库。`req`/`res` 只在 controller 里出现，其他层不碰这两个对象。"

**② 校验分两类 —— `中间件` `service`**
> "校验分两类。跟业务无关的，比如 id 格式对不对、body 存不存在，在中间件那层就拦掉，不进 controller。跟业务有关的，比如一个 User 允许改哪些字段，放在 service 里判断。"

**③ 两种失败路径 —— `404` `409` `冒泡`**
> "查不到资源返回 404，是 controller 判断出来的，正常的函数返回。数据冲突返回 409，是 repository 那边真的抛出了一个错误，这个错误冒泡到 app.js 里统一处理错误的中间件，由它返回 409。两条路径不会同时发生。"

---

## 3. 主流程（Postman，5 分钟）

**做什么：** Postman 打开文件夹 **"一、黄金路径 · 完整生命周期演示"**，从上到下点，请求之间会自动传 `demoUserId`。

| # | 点这个请求 | 关键词 | 讲什么 |
|---|---|---|---|
| 1 | List users（创建前） | — | 点一下，看现在列表里有什么 |
| 2 | Create user | **201** · **内嵌地址字段** | 点一下，201，返回新建的用户，带 `_id`，还有一个内嵌的地址字段；切到 Compass 刷新，确认数据写进去了 |
| 3 | List users（创建后） | — | 再点一下列表，新用户在里面了 |
| 4 | Get user by id | — | 按 id 查一次，内容和创建时一致 |
| 5 | Update（PATCH） | **局部更新** | 改 name/age，200；PATCH 是局部更新，只传要改的字段 |
| 6 | Get 确认更新持久化 | — | 再查一次，确认改动写进去了 |
| 7 | Delete | **200，返回一句提示** | 删掉，200，返回一条确认消息，不是被删的对象本身 |
| 8 | Get 确认已删除 | **404** | 再查一次，404——同样是 controller 判断出来的，不是走错误中间件那条路 |

---

## 4. 边界场景（5 分钟，挑着讲）

**做什么：** Postman 里 **"二/三/四"** 三个边界文件夹，挑着点：

- **400**
  - `Create user - invalid email format` → 400。email 格式不对会被拒绝，这是写测试清单时发现的一个漏洞，当时能创建成功，后来在 Model 上加了正则校验
  - `Update user - empty body (no valid fields)` → 400。body 里没有任何可更新字段，也会被拒绝
- **404**
  - `Update user - valid format, no matching user` → 404。id 格式合法但查无此人，和 Read/Delete 是同一套判断
- **409**
  - `Create user - duplicate email` → 409。邮箱重复。讲一下完整链路：MongoDB 报重复键错误，repository 捕获这个错误，转换成一个业务错误对象并抛出，这个错误冒泡到错误中间件，中间件判断错误类型，返回 409。controller 没有 catch 这个错误，也没做转发
  - `Update user - duplicate email` → 409。改邮箱改成重复的也是 409，说明这套错误处理逻辑 Create 和 Update 是复用的

---

## 5. 优雅关闭（1 分钟，终端操作）

**做什么：** 切到跑 server 的终端，按 `Ctrl+C`。

**说：** "如果直接杀掉进程，正在处理中的请求会被中断，数据库连接也来不及正常关闭。"

终端应该依次打出：

```
Received SIGINT. Shutting down gracefully...
Disconnected from MongoDB
SIGINT Server closed
```

**说：** "顺序是先停止接收新请求、把正在处理的请求跑完，再断开数据库，最后退出进程。顺序反了的话，正在处理的请求这时候要查库，库已经断了，会报错。"

---

## 6. 设计取舍 Q&A 预案

**Q：为什么没写 PUT，只有 PATCH？**
> "这几个更新场景都是改几个字段，没有整条记录替换的需求，所以先只做 PATCH，PUT 等有需要再补。"

**Q：为什么允许 `addresses` 传空数组？**
> "刚注册的用户可能还没填地址，允许创建成功比较合理，这是主动做的判断，不是漏了校验。"

**Q：报错格式是 `{ error: "..." }`，为什么不带错误码？**
> "记在 TODO 里了。改这个不只是改错误响应，所有成功响应的格式也要跟着统一，改动范围比较大，先没动。"

**Q：字段白名单为什么放在 service，不放中间件？**
> "判断标准是这件事跟 HTTP 请求本身有关，还是跟业务规则有关。id 格式校验跟业务无关，放中间件；'哪些字段允许被改'是业务规则，换个业务这条规则会不一样，所以放 service。"

**Q：数据库报错信息直接返回给客户端，合适吗？**
> "现在是直接透传的，方便调试，但信息比较冗长，生产环境一般不会这样做，这个也记在 TODO 里，还没处理。"

---

## 7. 收尾

**说：** "这周的交付目标是完整的 CRUD 接口加连通 MongoDB。五个端点、统一的错误处理、统一的入口校验、加优雅关闭，都做完了。下周是 Mongoose 进阶，聚合查询和性能优化。"

---

## 附：五个端点速查表

```
GET    /users        → 200 列表
GET    /users/:id    → 200 单个 / 400 格式错 / 404 不存在
POST   /users        → 201 创建 / 400 校验失败 / 409 重复
PATCH  /users/:id    → 200 更新 / 400 格式错/body缺失/无有效字段 / 404 不存在 / 409 重复
DELETE /users/:id    → 200 删除 / 400 格式错 / 404 不存在
```
</content>
