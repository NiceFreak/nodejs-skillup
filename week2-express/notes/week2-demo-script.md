# Week 2 Demo 讲解脚本 · Express RESTful API + MongoDB

> 用途：现场演示用的脚本，不是学习笔记。按顺序念/演示即可，每一步标了**做什么**（操作）和**说什么**（话术要点）。API 调用部分全部用 Postman 操作（对应 `week2-express/src/users.postman_collection.json`），架构讲解口头带过 + 展示代码/目录。预计总时长 12–15 分钟，边界场景那段可以按现场时间伸缩。

---

## 0. Demo 前置检查清单（开始前 5 分钟做完）

- [ ] MongoDB 已启动（`week1-mongodb/docker-compose.yml`：`docker compose up -d`，或本地 `mongod`），Compass 连上、打开 `shop` 库的 `users` 集合，留一个窗口方便随时刷新给大家看
- [ ] `week2-express/src/.env` 里 `MONGODB_URI` 配置正确
- [ ] 终端里 `cd week2-express/src && npm run dev`，确认打印出 `Server is running on port 3000`，没有报错
- [ ] Postman 导入/打开 `users.postman_collection.json`，确认 collection variable `baseUrl` 指向 `http://localhost:3000`
- [ ] （可选）提前跑一遍"四、边界场景 · 409"文件夹里的 seed 请求，确认它们能正常创建+自动清理，避免临场出岔子
- [ ] 准备好一个终端窗口专门留给最后的 **优雅关闭** 演示（`Ctrl+C`）

---

## 1. 开场：项目定位（30 秒）

**说什么：**

> "这是 Node.js 学习计划 Week 2 的成果——用 Express 从零搭建一个 RESTful 的 User CRUD API，连接真实 MongoDB。目标不是'写一个能跑的 demo'，而是把分层结构、错误处理、边界情况都想清楚、能讲出每个设计决定背后的理由。"

---

## 2. 架构讲解（3 分钟，展示代码/目录，不用敲键盘）

**做什么：** 打开 `week2-express/src/` 目录树，或者直接展示这张结构图。

```
src/
├── app.js                 # 挂中间件、路由、错误中间件、优雅关闭
├── config/db.js           # connectDB / disconnectDB
├── middlewares/           # 入口把关：ObjectId 格式、body 是否存在
├── models/users.js        # Schema + 校验(required/unique/match)
├── routes/users.js        # URL → 中间件 → controller
├── controller/users.js    # 翻译官：req/res ↔ 业务
├── services/users.js      # 业务规则(目前装的是字段白名单)
├── repositories/users.js  # 数据访问 + 错误翻译
├── errors/userErrors.js   # 领域错误类
└── utils/validators.js    # 纯校验函数
```

**说什么（挑 2-3 点讲，不用逐行念）：**

- "四层结构：route 分发、controller 翻译 HTTP ↔ 业务、service 装业务规则、repository 管数据访问。**只有 controller 碰 `req`/`res`**，这条规则从第一天守到现在没破过。"
- "校验分两种：**ObjectId 格式对不对、body 存不存在**这类跟业务无关的，在进 controller 之前就被 `middlewares/` 里的中间件挡掉了；**哪些字段允许被更新**这种业务规则，放在 service 里——这是下午专门讨论出来的一把判断标尺：'这件事是在描述 HTTP 请求长什么样，还是业务允许发生什么'。"
- "错误处理是两条路径：**'查不到'是 controller 主动判断返回 404**（正常的函数返回，不算错误）；**'数据不合法/冲突'是 repository 主动抛出领域错误，冒泡到 app.js 的错误中间件**统一翻译成 400/409/500。这两条路径互斥，一次请求只会走一条。"

---

## 3. 黄金路径实操（Postman，5 分钟）

**做什么：** Postman 里打开文件夹 **"一、黄金路径 · 完整生命周期演示"**，从上到下依次点。请求之间靠 Test 脚本自动传递 `demoUserId`，不用手动复制粘贴。

| # | 请求 | 做什么 | 说什么 |
|---|---|---|---|
| 1 | List users(创建前) | 点，看当前列表 | "先看一眼现在库里有什么，方便等下对比" |
| 2 | Create user | 点，看 201 + 新用户对象（带 `_id`） | "POST 成功用 201，返回新建的资源。这里带了一个嵌入的 address 子文档——Week 1 建模时定的embedded 设计"；顺手切到 Compass 刷新，给大家看数据真的落库了 |
| 3 | List users(创建后) | 点 | "确认新用户出现在列表里" |
| 4 | Get user by id | 点，200 | "按 id 查询，内容和 Create 返回的一致" |
| 5 | Update（PATCH） | 点，只改 name/age，200 | "PATCH 是局部更新语义——只传想改的字段，email/addresses 不受影响。选 PATCH 不选 PUT 是有意的取舍（见下面 §6 Q&A）" |
| 6 | Get 确认更新持久化 | 点，200，看到新值 | "确认改动真的写进数据库了，不是接口'假装成功'" |
| 7 | Delete | 点，200 + message | "删除成功返回一句确认消息，而不是被删对象本身——因为资源已经不存在了，返回它的完整数据意义不大" |
| 8 | Get 确认已删除 | 点，**404** | "这个 404 是 controller 自己判断出来的——`findById` 查不到返回 `null`，controller 判断后主动 `res.status(404)`，全程没有 throw、没经过错误中间件，是一次很普通的函数返回" |

---

## 4. 边界与错误场景（5 分钟，挑着讲，不用全点完）

**做什么：** Postman 里 **"二/三/四"** 三个边界文件夹，按下面优先级挑着演示（时间紧就只做加粗的几条）：

- **400（格式/校验类）**
  - **`Create user - invalid email format`** → 400，讲 Model 的 `match` 正则校验，"这是测试清单挖出来的唯一真 gap，今天补上了"
  - `Update user - empty body (no valid fields)` → 400，讲字段白名单校验（"body 里挑不出任何可更新字段，在碰数据库前就被 service 挡下"）
- **404（不存在）**
  - `Update user - valid format, no matching user` → 404，讲和 Read/Delete 是同一套判断逻辑
- **409（邮箱冲突）**
  - **`Create user - duplicate email`** → 409，讲完整错误翻译链：*"repository 捕获 Mongo 的 E11000 错误码 → 翻译成 `EmailConflictError` 这个领域错误 → 冒泡到 app.js 的错误中间件（controller 完全不知道这个错误存在）→ 中间件 `instanceof` 判断、赋 409"*
  - `Update user - duplicate email` → 409，讲"这条错误翻译链不是 Create 专属，Update 复用了同一套 try/catch，证明这套机制是通用的"

---

## 5. 优雅关闭演示（1 分钟，终端操作）

**做什么：** 切到运行 server 的终端，按 `Ctrl+C`。

**说什么：**

> "现在演示一下优雅关闭。如果直接杀进程，正好在处理中的请求会被截断，数据库连接也来不及好好关。"

**观察终端应该依次打印：**

```
Received SIGINT. Shutting down gracefully...
Disconnected from MongoDB
SIGINT Server closed
```

> "顺序是：先停止接收新请求、等现有请求处理完，再断开数据库，最后才退出进程——这个顺序反了的话，正在处理中的请求会在数据库已经断开之后还想查库，直接炸掉。"

---

## 6. 设计取舍 Q&A 预案

被问到下面这些问题时，可以直接用这几句作答：

**Q：为什么没有 PUT，只有 PATCH？**
> "PATCH 覆盖了目前所有真实的更新场景（改姓名、年龄、邮箱，本质都是'改几个字段'），没有一次是'整体替换'。PUT 的整体替换语义暂时没有真实需求，等场景出现再补——这是有意识的取舍，不是漏掉了。"

**Q：为什么 `addresses` 允许传空数组？**
> "新注册用户可能还没填收货地址，这是合理场景，不该在数据层面堵死。空数组允许创建成功，是主动做的产品判断，不是 bug。"

**Q：为什么错误响应体是 `{ error: "..." }`，不是更结构化的 `{ code, message }`？**
> "这是记在 TODO 里的设计决定，还没做——因为它是一次全局响应格式重构（错误中间件 + 所有 controller 的成功响应都要跟着改），不是改一行字段名，怕改一半导致新旧格式混用，所以先留着现在这版，等专门的时间块处理。"

**Q：字段白名单为什么放在 service 而不是中间件/controller？**
> "判断标尺是：这件事是在描述'HTTP 请求长什么样'，还是'业务允许发生什么'。ObjectId 格式、body 存不存在，换任何业务都一样，属于 HTTP 层；'User 允许改哪些字段'是业务规则，换一个业务（比如库存系统）这条规则完全不同，所以归 service。"

**Q：Mongoose 报错信息直接返回给客户端合适吗？**
> "现在是直接透传的，比较啰嗦、面向开发者，这是已知的 TODO，生产环境通常不会这样做，demo 阶段先保留，方便调试。"

---

## 7. 收尾

**说什么：**

> "Week 2 的交付目标是完整 CRUD API + 连通 MongoDB，五个端点、统一的错误分层、统一的校验中间件、优雅关闭，今天全部收口。下周（Week 3）会在这个基础上做 Mongoose 进阶——聚合管道和查询性能优化。"

---

## 附：五个端点速查表（万一被问细节）

```
GET    /users        → 200 列表
GET    /users/:id    → 200 单个 / 400 格式错 / 404 不存在
POST   /users        → 201 创建 / 400 校验失败 / 409 重复
PATCH  /users/:id    → 200 更新 / 400 格式错/body缺失/无有效字段 / 404 不存在 / 409 重复
DELETE /users/:id    → 200 删除 / 400 格式错 / 404 不存在
```
</content>
