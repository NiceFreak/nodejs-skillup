// W2「Express 服务端架构 · 复习板」数据源（展示资产，纯前端静态数据）。
//
// 这块板补的是展板原来从 W3 起步留下的缺口：W1–W2 的结论此前只存在于
// interview-prep/backend-qa-sheet.md 的文字里，展板上没有对应形态，而
// interviewTopics.ts 的覆盖矩阵把这一段标为 lead（面试优先引导的一块）。
//
// 事实口径：**以 week2-express/src 的当前代码为准**，笔记作为推理与踩坑的来源。
// 两者不一致时按代码写，并在 evidence 里点出差异，不让展板复述已经被改掉的写法。
// 主要来源：week2-express/notes/day1-node-server-and-express.md、day2-express-layers.md、
// day3-connect-mongodb.md、day4-CRUD.md；week1-mongoose/notes/day2-4-mongoose.md；
// 以及 week2-express/src 下的 app.js / routes / controllers / services / repositories。

export interface ArchKnowledgeBase {
  id: string;
  label: string;
  title: string;
  /** 复习门上的问题：一个问题只考一个设计点。 */
  question: string;
  judgment: string;
  mapping: string;
  evidence: string[];
  source: string;
  /** 结论口径：把结论限定在证据成立的条件内，展示与复习状态都显示。 */
  reviewNote?: string;
}

/** ① 中间件管道：进入正序、离开反序，以及计时点落在哪一帧。 */
export interface OnionKnowledge extends ArchKnowledgeBase {
  kind: "onion";
  frames: Array<{
    actor: string;
    phase: "enter" | "leave";
    depth: number;
    line: string;
    note: string;
  }>;
  rule: { title: string; body: string; both: string; neither: string };
  timing: {
    question: string;
    wrong: { where: string; measured: string; why: string };
    right: { where: string; measured: string; why: string };
  };
}

/** ② 四层职责与依赖方向。 */
export interface LayersKnowledge extends ArchKnowledgeBase {
  kind: "layers";
  lanes: Array<{ name: string; role: string; touches: string; avoids: string; file: string }>;
  ruler: string;
  direction: string;
  /** 与洋葱模型的区分：两者方向不同，不是同一条原则。 */
  contrast: Array<{ subject: string; describes: string; axis: string; scope: string }>;
}

/** ③ 一条请求穿四层：每层收到什么形状、交出什么形状。 */
export interface ChainKnowledge extends ArchKnowledgeBase {
  kind: "chain";
  request: string;
  steps: Array<{
    layer: string;
    file: string;
    input: string;
    output: string;
    avoids: string;
  }>;
  outcomes: Array<{ path: string; stop: string; status: string; tone: "success" | "controlled" | "failure" }>;
}

/** ④ 两条互斥的响应路径。 */
export interface ExitsKnowledge extends ArchKnowledgeBase {
  kind: "exits";
  paths: Array<{
    id: string;
    name: string;
    trigger: string;
    actor: string;
    hops: string[];
    status: string;
    tone: "controlled" | "failure";
  }>;
  exclusive: string;
  correction: { initial: string; problem: string; final: string };
}

/** ⑤ 错误翻译落在哪一层：原始错误 → 翻译点 → 领域错误 → 状态码。 */
export interface ErrorMapKnowledge extends ArchKnowledgeBase {
  kind: "errormap";
  rows: Array<{
    raw: string;
    origin: string;
    translatedAt: string;
    domainError: string;
    status: string;
    tone: "controlled" | "failure" | "unknown";
  }>;
  defense: {
    title: string;
    layers: Array<{ name: string; declares: string; whenChecked: string; throws: string }>;
    consequence: string;
  };
  registration: string;
}

/** ⑥ 归属判断标尺：HTTP 形态 vs 业务规则。 */
export interface RulerKnowledge extends ArchKnowledgeBase {
  kind: "ruler";
  ruler: string;
  crossTest: string;
  cases: Array<{
    subject: string;
    describes: "http" | "business";
    home: string;
    reason: string;
  }>;
  corrections: Array<{ id: string; initial: string; problem: string; final: string; kind: string }>;
}

export type W2Knowledge =
  | OnionKnowledge
  | LayersKnowledge
  | ChainKnowledge
  | ExitsKnowledge
  | ErrorMapKnowledge
  | RulerKnowledge;

// 顺序按概念递进，不按学习日期：
// 先看请求横向穿过什么（① 中间件管道），再看代码纵向分成什么（② 四层职责），
// 然后把两者合起来走一条真实请求（③ 形状变化），接着分出正常与错误两个出口
// （④ 两条路径 → ⑤ 错误翻译落层），最后给出决定「这段代码该放哪层」的判据（⑥）。
export const W2_KNOWLEDGE: W2Knowledge[] = [
  {
    id: "middleware",
    label: "知识点 1",
    title: "中间件管道：进入正序，离开反序",
    question: "三个中间件各自在 next() 前后打印一行，输出顺序是什么？为什么离开是反序？",
    kind: "onion",
    frames: [
      { actor: "A", phase: "enter", depth: 0, line: "A: 进入", note: "A 的函数体开始执行，随后调用 next()。" },
      { actor: "B", phase: "enter", depth: 1, line: "B: 进入", note: "A 的 next() 尚未返回，控制权在 B 的函数体里。" },
      { actor: "C", phase: "enter", depth: 2, line: "C: 进入", note: "调用栈到达最深处，C 之后没有下一个中间件。" },
      { actor: "C", phase: "leave", depth: 2, line: "C: 离开", note: "C 的函数体跑完，栈开始往回弹。" },
      { actor: "B", phase: "leave", depth: 1, line: "B: 离开", note: "B 的 next() 此时才返回，next() 之后的代码现在执行。" },
      { actor: "A", phase: "leave", depth: 0, line: "A: 离开", note: "A 的 next() 返回，整条链结束。同一层的进入与离开包住了它内部的一切。" },
    ],
    rule: {
      title: "中间件二选一",
      body: "一个中间件要么调用 next() 把请求往下传，要么自己产生响应（res.send / res.json / res.end）把请求了结。",
      both: "两件都做：第二次写响应时抛 headers already sent。",
      neither: "两件都不做：没有人结束响应，浏览器一直等待。实测把 B 的 next() 注释掉，输出停在 A 进 → B 进 → B 离 → A 离，C 与后续路由没有执行。",
    },
    timing: {
      question: "logger 中间件要记录这次请求耗时，计时结束点放在哪一帧？",
      wrong: {
        where: "next() 返回之后立即计算",
        measured: "异步路由量到 0ms",
        why: "路由遇到 await 就把控制权交回，next() 提前返回，此时响应还没发出。",
      },
      right: {
        where: "res.on('finish') 回调里计算",
        measured: "同一条路由量到约 100ms（路由内 setTimeout 100ms）",
        why: "finish 绑定的是响应真正发出这个事件，与路由是同步还是异步、成功还是出错无关。",
      },
    },
    judgment:
      "next() 是一次阻塞到后续链条全部返回才结束的函数调用，所以进入是正序、离开是反序；同一层的进入与离开之间包住了它下游的全部执行，计时与收尾动作可以挂在这个结构上。",
    mapping:
      "week2-express/src/app.js 的首个中间件就用这个结构：进入时取 start 与 requestId、注册 res.on('finish')，请求结束时才写日志。W10 的 requestId 关联链依赖同一个位置。",
    evidence: [
      "三个中间件各打印进入与离开：A 进 → B 进 → C 进 → C 离 → B 离 → A 离。",
      "注释掉 B 的 next()：输出为 A 进 → B 进 → B 离 → A 离，浏览器无响应；说明未调用 next() 时下游不执行，且没有任何一环结束响应。",
      "同一条 async 路由，next() 之后测得 0ms，res.on('finish') 中测得约 100ms。",
    ],
    source: "Week2 · Day1 原生 HTTP → Express · 中间件管道（§3、§4）",
    reviewNote:
      "0ms 与 100ms 来自一条内含 setTimeout 100ms 的实验路由，用于说明两个测量点的差别，不是接口性能数据。",
  },
  {
    id: "layers",
    label: "知识点 2",
    title: "四层职责与依赖方向",
    question: "route / controller / service / repository 各自碰什么、不碰什么？调用方向为什么只能向下？",
    kind: "layers",
    lanes: [
      {
        name: "route",
        role: "请求入口：匹配 URL 与方法，挂载中间件，把请求交给 controller",
        touches: "路由表、中间件挂载顺序",
        avoids: "业务规则、数据访问",
        file: "routes/users.js",
      },
      {
        name: "controller",
        role: "HTTP 与业务之间的翻译：读 req 取参数，调 service，把结果写成 res",
        touches: "req / res、状态码",
        avoids: "业务决策、数据库调用",
        file: "controllers/users.js",
      },
      {
        name: "service",
        role: "业务规则：接收普通参数，执行规则，需要数据时调 repository",
        touches: "普通参数与返回值、领域错误",
        avoids: "req / res、数据库细节",
        file: "services/users.js",
      },
      {
        name: "repository",
        role: "数据访问：调用 Mongoose Model，把数据库错误翻译成领域错误",
        touches: "Model、聚合管道、E11000",
        avoids: "req / res、业务规则",
        file: "repositories/users.js",
      },
    ],
    ruler: "检验越界的判据：全局搜索 req 与 res，这两个标识符只应出现在 controller 与中间件里。出现在 service 或 repository，就是分层被破坏。",
    direction:
      "调用只能 route → controller → service → repository。下层不引用上层：repository 一旦调用 service，数据访问层就开始持有业务规则，换数据库时业务代码要跟着改，并且形成循环依赖。",
    contrast: [
      {
        subject: "中间件管道（洋葱模型）",
        describes: "一次请求依次穿过 logger、校验、路由、catch-all、错误处理",
        axis: "横向穿过一串中间件，进入正序、离开反序",
        scope: "Express 的框架特性",
      },
      {
        subject: "分层单向依赖",
        describes: "代码从 route 逐层向下调用到 repository",
        axis: "纵向逐层下调，不回头",
        scope: "软件架构原则，换框架或语言同样成立",
      },
    ],
    judgment:
      "分层单向的根据是依赖方向：上层依赖下层，下层不引用上层。它与中间件的洋葱结构方向不同、来源不同，不能互相推导。",
    mapping:
      "换数据库时只有 repository 需要改，route / controller / service 不动；service 不碰 req / res，因此可以直接喂普通参数做单元测试（W6 测试分工的前提）。",
    evidence: [
      "当前代码中 req / res 作为变量只出现在 controllers/ 与 middlewares/ 两个目录；config/logger.js 里的 req.body.password 等是脱敏字段路径字符串，不是对请求对象的访问。",
      "services/users.js 的 updateUserService 接收 (id, updateData) 两个普通参数，返回值交给 controller 决定状态码。",
      "repositories/users.js 只引用 Model 与领域错误类，不引用任何 service。",
    ],
    source: "Week2 · Day2 分层架构（§1、§2）与 week2-express/src 当前代码",
  },
  {
    id: "request-shape",
    label: "知识点 3",
    title: "一条请求穿四层：每层交出什么形状",
    question: "GET /users/:id 这条请求，每一层收到的是什么、必须交给下一层什么？",
    kind: "chain",
    request: "GET /users/689f1c2b4a7e3d0012ab34cd",
    steps: [
      {
        layer: "Router",
        file: "routes/users.js",
        input: "HTTP 请求行 GET /users/689f1c2b4a7e3d0012ab34cd",
        output: "匹配到 '/:id'，req.params.id = '689f1c2b4a7e3d0012ab34cd'（字符串）",
        avoids: "不读请求体，不判断这个 id 是否存在",
      },
      {
        layer: "中间件",
        file: "middlewares/validateIdParamMiddleware.js",
        input: "req.params.id（字符串）",
        output: "格式合法则调用 next()；不合法直接返回 400，请求不再向下",
        avoids: "不查数据库，只看 req 本身就能判断",
      },
      {
        layer: "controller",
        file: "controllers/users.js",
        input: "req.params.id",
        output: "调用 listUserByIdService(id)，拿到 document 或 null",
        avoids: "不调用 Model，不决定查询怎么写",
      },
      {
        layer: "service",
        file: "services/users.js",
        input: "id（普通字符串参数）",
        output: "转发给 findById(id) 并返回其结果",
        avoids: "不碰 req / res，不知道调用方是 HTTP 还是脚本",
      },
      {
        layer: "repository",
        file: "repositories/users.js",
        input: "id",
        output: "await User.findById(id) 的结果：Mongoose document 或 null",
        avoids: "不把 null 翻译成 404，也不抛错",
      },
      {
        layer: "controller（回程）",
        file: "controllers/users.js",
        input: "document 或 null",
        output: "null → res.status(404)；document → res.json(user)",
        avoids: "不修改业务数据，只决定 HTTP 表达",
      },
    ],
    outcomes: [
      { path: "id 格式非法", stop: "validateIdParam 中间件，未进入 controller", status: "400", tone: "controlled" },
      { path: "id 合法、库中无此文档", stop: "controller 判断 null", status: "404", tone: "controlled" },
      { path: "id 合法、文档存在", stop: "controller 返回 document", status: "200", tone: "success" },
    ],
    judgment:
      "每层只加工属于自己的那一段：Router 产出字符串参数，中间件决定放行与否，repository 产出 document 或 null，只有 controller 把这些形状翻译成状态码。null 一路原样返回，直到 controller 才变成 404。",
    mapping:
      "面试里被问「讲一条请求从前端到数据库」时，这六格就是答题骨架：先说每层的输入输出形状，再说三种结局分别停在哪一层。",
    evidence: [
      "req.params.id 由 Express 在路由匹配阶段填入，值始终是字符串。",
      "当前 routes/users.js 的 GET '/:id' 挂载顺序为 validateIdParam → listUsersController。",
      "repositories/users.js 的 findById 直接返回 User.findById(id) 的结果，未做 null 判断。",
    ],
    source: "Week2 · Day2 §7–§9、Day4 §1，与 week2-express/src 当前代码",
    reviewNote:
      "这条链上还有两个统一守卫（validateToken、requireRole('admin')）先于 validateIdParam 执行，属于 W4 认证与授权板的内容，这里不重复展开。",
  },
  {
    id: "two-exits",
    label: "知识点 4",
    title: "两条互斥的响应路径",
    question: "404 和 409 都由服务端返回，它们是同一条路径吗？各自由谁调用 res？",
    kind: "exits",
    paths: [
      {
        id: "not-found",
        name: "查询合法地没有结果",
        trigger: "User.findById(id) 返回 null",
        actor: "controller 主动判断",
        hops: [
          "repository 原样返回 null，不抛错",
          "null 顺着正常返回值一路回到 controller",
          "controller 执行 if (!user) return res.status(404)",
        ],
        status: "404",
        tone: "controlled",
      },
      {
        id: "thrown",
        name: "抛出领域错误",
        trigger: "repository 捕获 E11000 后 throw EmailConflictError",
        actor: "错误处理中间件",
        hops: [
          "repository throw 领域错误",
          "Promise 被 reject，Express 5 自动转交错误处理中间件",
          "跳过 controller 与其余普通中间件",
          "app.js 的四参数中间件按错误类赋 statusCode 并调用 res.status().json()",
        ],
        status: "409",
        tone: "failure",
      },
    ],
    exclusive:
      "一次请求只会走其中一条：要么 controller 拿到返回值后自己决定响应，要么错误在中途被抛出、由错误处理中间件收尾。项目里因此有两个调用 res 的位置，controller 是其中之一。",
    correction: {
      initial: "查不到用户时 repository 返回一个错误，这个错误被错误中间件翻译成 404。",
      problem: "把「业务上没找到」与「程序出错」当成同一种情况。findById 查不到时返回 null，属于查询正常完成的结果，全程没有 throw、没有 next(err)。",
      final: "404 由 controller 在正常返回路径上主动判断产生，不经过错误处理中间件；只有 repository 或 service 主动 throw 的领域错误才会走错误中间件。",
    },
    judgment:
      "触发方式决定路径：返回值走 controller，throw 走错误处理中间件。写测试用例前先判断这次要验的是哪条路径，它直接决定断言写在哪一层。",
    mapping:
      "常见的分层架构图只画 controller 这一个响应出口，那是省略了错误路径的 happy path 图；引入全局错误中间件后，第二个出口在 app.js 里。",
    evidence: [
      "controllers/users.js 的 listUsersController、deleteUserController、updateUserController 各有一处 if (!x) return res.status(404)。",
      "repositories/users.js 的 createUser / updateUser 在 catch 中 throw 领域错误，函数本身不返回状态码。",
      "app.js 末尾的四参数中间件是错误路径唯一的响应出口。",
    ],
    source: "Week2 · Day4 §1（闭卷复盘暴露的两处偏差）与 Day3 §3.4",
  },
  {
    id: "error-map",
    label: "知识点 5",
    title: "错误翻译落在哪一层",
    question: "Mongo 的 E11000 一路裸奔到客户端会怎样？该在哪一层把它变成业务概念？",
    kind: "errormap",
    rows: [
      {
        raw: "Mongoose ValidationError（required / match 不通过）",
        origin: "Model 校验，写入数据库之前",
        translatedAt: "repositories/users.js catch",
        domainError: "UserValidationError",
        status: "400",
        tone: "controlled",
      },
      {
        raw: "MongoDB E11000 duplicate key（email 唯一索引）",
        origin: "数据库写入时",
        translatedAt: "repositories/users.js catch（error.code === 11000）",
        domainError: "EmailConflictError",
        status: "409",
        tone: "controlled",
      },
      {
        raw: "更新请求里没有任何白名单字段",
        origin: "业务规则判断",
        translatedAt: "services/users.js updateUserService throw",
        domainError: "UserValidationError",
        status: "400",
        tone: "controlled",
      },
      {
        raw: "Token 缺失、无效或过期",
        origin: "认证中间件",
        translatedAt: "middlewares/validateTokenMiddleware.js",
        domainError: "AuthenticationError",
        status: "401",
        tone: "controlled",
      },
      {
        raw: "角色不满足接口要求",
        origin: "授权中间件",
        translatedAt: "middlewares/validateRoleMiddleware.js",
        domainError: "AuthorizationError",
        status: "403",
        tone: "controlled",
      },
      {
        raw: "聚合管道执行失败",
        origin: "Order.aggregate",
        translatedAt: "repositories/users.js catch",
        domainError: "AggregationError",
        status: "500",
        tone: "failure",
      },
      {
        raw: "未识别的错误",
        origin: "任意位置",
        translatedAt: "不翻译，原样向上抛",
        domainError: "无（保持原始 Error）",
        status: "500",
        tone: "unknown",
      },
    ],
    defense: {
      title: "两层防线：同一个 email 字段有两处约束，报错形态不同",
      layers: [
        {
          name: "应用层校验",
          declares: "Schema 中的 required / match / enum",
          whenChecked: "写入数据库之前，在 Node 进程内检查",
          throws: "Mongoose ValidationError，数据不会进入数据库",
        },
        {
          name: "数据库层约束",
          declares: "Schema 中的 unique（由 MongoDB 唯一索引实现）",
          whenChecked: "真正尝试写入时，由数据库拒绝",
          throws: "E11000 duplicate key error",
        },
      ],
      consequence:
        "unique 不是校验器，因此捕获重复时不能只判断 ValidationError，必须单独判断 error.code === 11000。这也是 repository 里两个分支并存的原因。",
    },
    registration:
      "新增一个领域错误类时，除了定义类本身，还要在 app.js 的错误处理中间件里加上对应分支；只定义不注册的类不会被赋 statusCode，最终落到兜底的 500。",
    judgment:
      "数据库专属的错误码只出现在 repository。向上走时 service、controller 与 app.js 认识的都是 UserValidationError、EmailConflictError 这类业务概念，不认识 11000。",
    mapping:
      "这与 Day2「数据访问细节不泄漏到上层」是同一条原则，泄漏候选物换成了数据库错误码；W3 的「聚合管道归 repository、业务规则归 service」是同一判据的另一次应用。",
    evidence: [
      "errors/userErrors.js 当前定义 8 个错误类；app.js 的错误中间件为其中 6 个注册了状态码分支。",
      "app.js 用 switch (err.constructor) 分派，未匹配的错误取 err.statusCode || 500。",
      "catch-all 中间件为不存在的路径构造 err.statusCode = 404 并调用 next(err)，与领域错误共用同一个响应出口。",
      "W1 用三条违规写入实测过两层防线：缺 required 与 age 越界报 validation failed，重复 email 报 E11000。",
    ],
    source: "Week2 · Day3 §3.4；Week1 · Mongoose 入门 §3–§4；week2-express/src/app.js 当前代码",
    reviewNote:
      "Day3 笔记记录的 app.js 判断方式是 instanceof，当前代码是 switch (err.constructor)。现有错误类之间没有继承关系，两种写法对这 6 个类结果相同；此处按当前代码陈述。",
  },
  {
    id: "ownership",
    label: "知识点 6",
    title: "这段逻辑该放哪层：一把判断标尺",
    question: "「用户允许更新哪些字段」该由路由中间件拦，还是由 service 决定？",
    kind: "ruler",
    ruler: "问这件事在描述 HTTP 请求长什么样，还是在描述这个业务允许发生什么。前者归中间件或 controller，后者归 service。",
    crossTest: "配套检验：换一个完全不同的业务，这段逻辑还成立吗？还成立说明它与业务无关，不该进 service。",
    cases: [
      {
        subject: "req.params.id 是不是合法 ObjectId",
        describes: "http",
        home: "middlewares/validateIdParamMiddleware.js",
        reason: "换成图书管理系统同样成立，格式规则与业务内容无关。",
      },
      {
        subject: "请求体是否为空",
        describes: "http",
        home: "middlewares/validateHasRequestBodyMiddleware.js",
        reason: "只看 req 本身即可判断，不需要业务知识。",
      },
      {
        subject: "User 允许更新 name / email / age / addresses",
        describes: "business",
        home: "services/users.js updateUserService",
        reason: "换成图书管理系统这条规则不存在，会变成完全不同的字段清单。",
      },
      {
        subject: "把 months 换算成自然月的半开区间 [startDate, endDate)",
        describes: "business",
        home: "services/orderService.js getMonthlySalesTrendReport",
        reason: "月度报表统计到哪一天为止是业务规则；算好的时间边界才交给 repository 的聚合管道（与 W3 知识点 1 同一判据）。",
      },
    ],
    corrections: [
      {
        id: "whitelist",
        initial: "字段白名单做成路由中间件 setUpdateDataWhitelist，在进入 controller 前组装 req.updateData。",
        problem: "允许更新哪些字段是业务规则，不是请求形态。Model 新增字段时要记得同步改中间件里的清单，否则新字段永远更不进去，并且会返回一个没有有效字段的 400。字段清单等于维护了两处。",
        final: "白名单与「没有有效字段」的判断都搬进 updateUserService，中间件文件删除。service 不碰 res，因此用 throw 领域错误表达拒绝。",
        kind: "boundary",
      },
      {
        id: "register",
        initial: "为「没有有效字段」新建 NoValidFieldsWhenUpdatingError 并在 service 抛出。",
        problem: "只定义了错误类，没有在 app.js 的错误中间件里注册对应分支。该错误没有被赋 statusCode，实测返回 500 而不是 400。",
        final: "不新建类，复用 UserValidationError。两者语义同为客户端提交的数据不符合要求，状态码同为 400；每多一个类就多一处必须注册的位置。",
        kind: "registration",
      },
      {
        id: "single-source",
        initial: "controller 里写 if (!name || !email) 返回 400，同时 Model 里 name / email 也是 required。",
        problem: "同一条校验规则写在两处。Model 增删字段时 controller 不会跟着变，两处会不一致。",
        final: "删掉 controller 那道判断，由 Model 做单一校验源；ValidationError 已能在 repository 被翻译成 400。",
        kind: "duplication",
      },
    ],
    judgment:
      "归属判断不看这段代码写起来方便放在哪，而看它描述的是请求形态还是业务规则。判断错的代价是同一条规则出现在两处，随后不同步。",
    mapping:
      "service 层前三天一直是纯转发，看上去多余；字段白名单是第一个必须落在 service 的真实规则，这层的用途从那时起才具体。",
    evidence: [
      "services/users.js 当前持有 allowedFields = ['name', 'email', 'age', 'addresses'] 与空字段判断。",
      "middlewares/ 目录下不存在 setUpdateDataWhitelistMiddleware.js，该文件已删除。",
      "errors/userErrors.js 中不存在 NoValidFieldsWhenUpdatingError，该类未被保留。",
    ],
    source: "Week2 · Day4 §8–§9（含 §9.5 的 500 排查记录）与 week2-express/src 当前代码",
  },
];

export const CORRECTION_KIND_LABEL: Record<string, string> = {
  boundary: "归属判断",
  registration: "登记遗漏",
  duplication: "重复来源",
};

/** 未验证与待澄清项：与已验收结论分开列出，标注当前状态与下一步。 */
export const W2_OPEN_ITEMS = [
  {
    id: "error-envelope",
    title: "错误响应信封未统一",
    status: "已理解·暂缓" as const,
    tone: "deferred" as const,
    detail:
      "错误响应当前统一是 { error: message }，而 /auth 的成功响应已经是 { code, message, payload } 信封，users 与 reports 的成功响应则直接返回数据本身。errors/userErrors.js 顶部记着这条待办。",
    plan: "见 BACKLOG P1-3「报表错误响应信封统一」，规模小，未排期。",
  },
  {
    id: "constructor-vs-instanceof",
    title: "app.js 用 switch (err.constructor) 分派",
    status: "待澄清" as const,
    tone: "review" as const,
    detail:
      "Day3 笔记记录的决定是改用 instanceof（理由是字符串判断脆弱）。当前代码是 switch (err.constructor)，对没有继承关系的错误类两者结果相同，但对将来出现的子类不同：constructor 只匹配精确类。",
    plan: "回看时确认这是有意的改动还是漂移；在没有子类之前不影响行为，不单独记 DEBT。",
  },
  {
    id: "express4-async",
    title: "async 抛错自动转交依赖 Express 5",
    status: "已验证·有条件" as const,
    tone: "review" as const,
    detail:
      "知识点 4 的第二条路径依赖 Express 5 对 async 路由返回的 rejected Promise 自动转交错误中间件。当前 package.json 为 express ^5.2.1。Express 4 不具备该行为，需要补丁库或在每个路由里 try/catch + next(err)。",
    plan: "读旧资料或迁移到 4.x 项目时先确认版本，不把 5 的行为当作 Express 通例。",
  },
];

export type W2OpenItem = (typeof W2_OPEN_ITEMS)[number];
