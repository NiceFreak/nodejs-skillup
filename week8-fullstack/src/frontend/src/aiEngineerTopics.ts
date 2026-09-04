// W12 起「AI 工程」板的数据源（展示资产，纯前端静态数据）。
//
// 命名是跨周的 ai-engineer 而不是 w12：W13-W16 的产出会加进同一棵树，
// 数据长期挂在某个周次名下会变成误导性的所有权。
//
// 内容源（逐条可回溯，不在本文件里造结论）：
// - Bub 源码 ~/Documents/bub @ 33c417a（只读），结论口径以
//   week12-python-rag/notes/bub-reading-report.md 与 day3-bub-main-chain.md 为准；
// - Python 语法六单元 = week12-python-rag/notes/day2-freeze-and-baseline.md §5；
// - Express 侧真实来源 = week2-express/src（行号 2026-09-02 逐条核对）。
//
// 证据等级四档常驻：源码事实 / 本人实测 / 推断 / 待运行验证。未验证的分支必须带
// 「待运行验证」，不允许在页面上升格成事实。

export type AeGroup = "Python 迁移增量" | "Bub harness 骨架";
export type AeEvidence = "源码事实" | "本人实测" | "推断" | "待运行验证";

export interface ScopedEvidence {
  kind: AeEvidence;
  scope:
    | "Bub @ 33c417a"
    | "Python 3.12.10 等价结构"
    | "D4 本项目受控 HTTP 实验"
    | "D4 真实 DeepSeek 调用"
    | "D4 最小 demo × Bub @ 33c417a";
  targetVerified: boolean;
}

export interface AeBase {
  /** = topic id，同时是深链参数 #/showcase?tab=ai-engineer&topic=<id> */
  id: string;
  label: string;
  title: string;
  /** 十列①：这一块回答的单一问题 */
  question: string;
  /** 十列②：10 秒结论，常驻首屏 */
  anchor: string;
  group: AeGroup;
  evidenceKind: AeEvidence;
  source: string;
  /** 常驻边界句：这块图不主张什么 */
  boundary: string;
  /** 十列⑦：视觉记忆点（必须来自技术关系） */
  memory: string;
  /** 十列⑩：验收句，人工闸的 expected answer */
  accept: string;
  /**
   * 源码位置（折叠层）。
   *
   * 2026-09-02 调整：行号与内部函数链原本挂在主路径上，读者要先解析标识符才拿得到机制，
   * 与上游十列⑥「常驻 = 结论句 + 边界，折叠 = 各阶段细节」不符。证据不删——结论必须可回溯，
   * 十列⑩也要求行号在页——改为整体降到这一层。
   */
  sources?: Array<{ label: string; ref: string }>;
}

/* ------------------------------------------------------------------ P1 语法映照 */

export type AeMapType = "eq" | "approx" | "new" | "py-internal";

export interface AeSyntaxTopic extends AeBase {
  kind: "syntax";
  legend: Array<{ type: AeMapType; label: string; shape: string }>;
  units: Array<{
    id: string;
    semantics: string;
    sides: Array<{
      lang: "TypeScript" | "Python";
      kind: string;
      note?: string;
      /** 可核来源（折叠层显示）。主路径不放行号，见施工图 §6.0 文字层级。 */
      source?: string;
      /** 本仓库确实没有这个对照物——空本身是信息，不拿推断去填。 */
      absent?: boolean;
    }>;
    mapType: AeMapType;
    pitfall: string;
    detail: string;
  }>;
}

/* -------------------------------------------------------------- P3 CLI 分发器对照 */

export interface AeAlignTopic extends AeBase {
  kind: "align";
  hosts: { left: string; right: string };
  positions: Array<{
    id: string;
    role: string;
    express: { node: string; source: string };
    typer: { node: string; source: string };
    holds: string;
    fails: string;
    holdsShort: string;
    failsShort: string;
  }>;
  voids: Array<{ label: string; detail: string }>;
}

/* ------------------------------------------------------------- P4 异步失败轨迹 */

export type AeFailureActor = "caller" | "http-client" | "server" | "resource";
export type AeFailureKind = "wait" | "trigger" | "exception" | "fin" | "cleanup" | "terminal";

export interface AeTraceTopic extends AeBase {
  kind: "trace";
  actors: Array<{ id: AeFailureActor; label: string }>;
  traces: Array<{
    id: "timeout-low" | "timeout-control" | "cancel";
    label: string;
    scale: "ordinal";
    inputs: { readSeconds: number; holdSeconds: number };
    points: Array<{
      id: string;
      ordinal: number;
      actor: AeFailureActor;
      kind: AeFailureKind;
      label: string;
      atSeconds?: number;
    }>;
    edges: Array<{ from: string; to: string; relation: "before" | "causes" | "observed-after" }>;
    outcome: { exception: "ReadTimeout" | "none" | "CancelledError"; clientClosed: boolean };
    evidence: ScopedEvidence;
  }>;
  details: Array<{ id: "mro" | "cancel" | "cleanup" | "pending-warning"; label: string; text: string }>;
}

/* ------------------------------------------------------------------- B1 入口链 */

export interface AeEntryTopic extends AeBase {
  kind: "entry";
  lanes: Array<{ id: "console" | "python-m"; label: string; trigger: string }>;
  nodes: Array<{
    id: string;
    module: string;
    line: string;
    /** 图上的短标签（≤10 字）。完整动作在 action，渲染在图下的文字层。 */
    short: string;
    action: string;
    lineOwner: "console" | "python-m" | "both" | "after-join";
    verified: AeEvidence;
    /** 折叠层：模块级调用链内部细节 */
    detail?: string;
    /** 第一次 turn 的触发点，供拓扑断言读取 */
    trigger?: boolean;
    /** 两条启动线在此汇合 */
    join?: boolean;
  }>;
  edges: Array<{
    from: string;
    to: string;
    flow: "flow" | "split" | "join";
    owner: "console" | "python-m" | "both";
  }>;
  timing: {
    rule: string;
    gate: string;
    experiments: Array<{ command: string; output: string; reading: string }>;
  };
  corrections: string[];
  /** 笔记这条链上尚未核实的接缝——原样呈现，不替笔记解释。 */
  seam: { at: string; question: string; status: AeEvidence };
}

/* --------------------------------------------------------------- B2 turn 管线 */

export interface AePipelineTopic extends AeBase {
  kind: "pipeline";
  stages: Array<{ id: string; label: string; note: string }>;
  checkpoint: { id: "save-state"; label: string; after: "run-model"; note: string };
  outcomes: Array<{
    id: "success" | "exception" | "cancelled";
    label: string;
    path: string[];
    tone: "ok" | "raise" | "cancel";
    evidence: ScopedEvidence[];
  }>;
  bypasses: Array<{
    from: "resolve-session" | "build-state" | "build-prompt";
    to: "early-error";
    excludes: "save-state";
  }>;
  stateNote: { mutable: string; frozen: string };
}

/* ------------------------------------------------------------ B3 tape → context */

export interface AeTapeTopic extends AeBase {
  kind: "tape";
  entries: Array<{
    id: string;
    entryKind: string;
    payloadBrief: string;
    inDefaultMessages: boolean;
  }>;
  readStages: Array<{
    step: number;
    label: string;
    selectorMode: "default" | "custom";
    effect: string;
  }>;
  currentInputs: Array<{ slot: "system" | "steering" | "prompt"; label: string }>;
  writeStages: Array<{ order: number; entryKind: string; note: string }>;
  writeTriggers: Array<{ path: "tool" | "text" | "intercepted"; note: string }>;
  frames: Array<{
    id: string;
    phase: "read" | "assemble" | "model" | "execute" | "append";
    title: string;
    text: string;
    path?: "tool" | "text";
  }>;
}

/* ------------------------------------------------------------- B4 step 循环判定 */

export interface AeMachineTopic extends AeBase {
  kind: "machine";
  loopScope: { outer: "turn"; inner: "step-loop"; note: string };
  zones: Array<{ id: "normal" | "recover" | "boundary"; layer: 1 | 2 | 3; title: string; note: string }>;
  nodes: Array<{ id: string; zone: "normal" | "recover" | "boundary"; label: string; tone?: "stop" | "continue" | "error" }>;
  edges: Array<{
    from: string;
    to: string;
    zone: "normal" | "recover" | "boundary";
    condition: string;
    kind: "continue" | "stop" | "recover" | "raise";
    shortCircuit?: boolean;
  }>;
  experiment: {
    maxSteps: 3;
    steering: false;
    branch: "tool_calls";
    evidence: ScopedEvidence[];
    traces: Array<{
      id: "repeat" | "control";
      label: string;
      steps: Array<{ step: 1 | 2 | 3; toolCalls: boolean }>;
      terminal: { afterStep: 2 | 3; outcome: "max_steps_reached=3" | "return" };
    }>;
    uncovered: Array<"tool_results" | "steering" | "auto_handoff" | "Bub runtime">;
  };
}

/* ------------------------------------------------------------ B5 工具调用职责矩阵 */

export interface AeRolesTopic extends AeBase {
  kind: "roles";
  systems: Array<{ id: "d4" | "bub"; label: string; evidence: ScopedEvidence }>;
  responsibilities: Array<{ id: "decide" | "execute" | "continue" | "persist"; label: string }>;
  cells: Array<{
    system: "d4" | "bub";
    responsibility: "decide" | "execute" | "continue" | "persist";
    status: "present" | "manual" | "absent";
    owner: string | null;
    mechanism: string;
  }>;
  edges: Array<{ system: "d4" | "bub"; from: string; to: string; payload: string }>;
  observations: {
    contentEmpty: true;
    toolCallCount: 1;
    argumentsJsonParseable: true;
    resultFedBack: false;
  };
  alignmentEvidence: ScopedEvidence;
  hooks: Array<{ name: string; call: string }>;
}

export type AeTopic =
  | AeSyntaxTopic
  | AeAlignTopic
  | AeTraceTopic
  | AeEntryTopic
  | AePipelineTopic
  | AeTapeTopic
  | AeMachineTopic
  | AeRolesTopic;

export const AE_GROUPS: readonly AeGroup[] = ["Python 迁移增量", "Bub harness 骨架"];

const BUB_SOURCE = "Bub @ 33c417a（只读）· bub-reading-report.md / day3-bub-main-chain.md";

/* ================================================================= 八块内容 */

const P1: AeSyntaxTopic = {
  kind: "syntax",
  id: "py-syntax",
  label: "P1",
  title: "六个语法单元的映射类型",
  question: "本周（D2）完成的六个语法单元迁到 Python 时，对应关系各是什么形态？",
  anchor:
    "六个单元都有明确对应；本页实际分为近似映射与「同语言两形态」——" +
    "dataclass 与 Pydantic 的语义源是 TS interface，属 Python 内两形态，不是 TS 等价。",
  group: "Python 迁移增量",
  evidenceKind: "本人实测",
  source: "week12-python-rag/notes/day2-freeze-and-baseline.md §5 · Python 3.12.10 / pydantic 2.13.5",
  boundary:
    "两侧证据性质不同：Python 侧是 D2 的本人实测（含预测偏差留痕）；TS 侧是从本仓库 W8 前端、W2 测试与 W6" +
    "笔记里取的既有代码，本周没有为对照重跑过 TS 侧实验。「资源收尾」那一对只在「退出必执行」这一点上成立：" +
    "TS 侧收的是 UI 状态，Python 侧讲的是资源清理契约，对照到此为止。",
  memory: "同一行 = 同一语义；中列的线型说明这两端是怎么对上的。",
  accept:
    "六单元的映射类型能被独立正确分类，dataclass 与 Pydantic 记为 Python 内两形态而非 TS 等价。",
  legend: [
    { type: "approx", label: "近似（语法对，语义有坑）", shape: "实线单箭头 + 空心端点" },
    { type: "py-internal", label: "Python 内两形态", shape: "栏内并列框 + 括号线" },
  ],
  units: [
    {
      id: "fn-types",
      semantics: "可选参数与返回类型",
      sides: [
        {
          lang: "TypeScript",
          kind: "reviewNote?: string",
          note: "可选属性；另有返回类型注解 function readErrorMessage(body: unknown, status: number): string",
          source: "authTopics.ts:49 / api.ts:45",
        },
        { lang: "Python", kind: "int | None = None，返回用 -> str", note: "笔记原文列的 Optional 写法", source: "day2 §5 单元 1" },
      ],
      mapType: "approx",
      pitfall: "truthy 与 is None 是两种语义：语法对不等于行为一致。",
      detail:
        "greet('x','') 在 if title: 下输出「你好，x」（对齐可选参数的直觉）；" +
        "在 if title is None: 下输出「 x」——空字符串被当成「有 title」。本人两版实测对照，通过。" +
        "三元顺序是 X if cond else Y，格式化用 f-string。",
    },
    {
      id: "imports",
      semantics: "聚合导出与包的导出面",
      sides: [
        {
          lang: "TypeScript",
          kind: "index.ts 聚合导出",
          note: "笔记原文给出的概念对照；本仓库前端实际没有 barrel export，未逐行比对",
          source: "day2 §5 单元 2（原文「对应 TS index.ts 聚合导出」）",
        },
        {
          lang: "Python",
          kind: "__init__.py 里写 from .greet import greet",
          source: "day2 §5 单元 2",
        },
      ],
      mapType: "approx",
      pitfall: "__init__.py 是包标记与导出面，不是入口文件——入口是 __main__.py。",
      detail:
        "三种导入的绑定不同：from src.users.greet import greet 取到函数；import src.users.greet 要走属性链；" +
        "from src.users import greet 在 __init__.py 为空时触发隐式子模块回退，greet 绑到模块对象，" +
        "调用报 TypeError: 'module' object is not callable。补上导出后本人用 type() 验证得到 <class 'function'>。",
    },
    {
      id: "data-shape",
      semantics: "数据形状与运行时校验",
      sides: [
        {
          lang: "TypeScript",
          kind: "interface LoginResponse / SafeUser",
          note: "编译期形状，运行时不拦截",
          source: "types.ts:29 / types.ts:39（笔记原文亦以「TS interface」作对照）",
        },
        { lang: "Python", kind: "@dataclass", note: "只装数据，不校验", source: "day2 §5 单元 3" },
        { lang: "Python", kind: "pydantic.BaseModel", note: "运行时拦截非法数据（笔记原文：如 Mongoose）", source: "day2 §5 单元 3" },
      ],
      mapType: "py-internal",
      pitfall: "判断标准是「运行时是否拦截非法数据」，不是「哪个写起来像 interface」。",
      detail:
        "实验：dataclass 接受 email='not-an-email' 直接创建；Pydantic 抛 ValidationError。" +
        "预测偏差留痕：type(exc).__name__ 预测 str、实际 ValidationError——异常对象不等于它的字符串表示。" +
        "Pydantic v2 的错误报告形如「1 validation error for User / email / String should match pattern ...」。",
    },
    {
      id: "exc-chain",
      semantics: "业务异常包装",
      sides: [
        {
          lang: "TypeScript",
          kind: "new UserValidationError(..., { cause: error })",
          note: "W2 repository 把数据库校验错误翻译成业务错误，并保留原异常 cause",
          source: "week2-express/src/repositories/users.js:37 · errors/userErrors.js:13-17",
        },
        { lang: "Python", kind: "raise UserValidationError(...) from exc，原异常挂在 __cause__", source: "day2 §5 单元 4" },
      ],
      mapType: "approx",
      pitfall: "from exc 把原异常挂到 __cause__，traceback 会打「direct cause」那句。",
      detail:
        "三问验证：抛出的业务异常是 UserValidationError；exc.__cause__ 是原 ValidationError；" +
        "__cause__.__class__.__name__ 为 ValidationError。本人独立实现 create_user 翻译原型，通过。",
    },
    {
      id: "ctx-manager",
      semantics: "资源收尾契约",
      sides: [
        {
          lang: "TypeScript",
          kind: "try { … } finally { 恢复 UI 状态 }",
          note: "同一条契约：无论正常返回还是抛错，finally 都执行。收的是 UI 状态不是句柄类资源，对照到此为止",
          source: "AuthView.tsx:48-49（setBusy）· Dashboard.tsx:94-95（setRefreshing）",
        },
        { lang: "Python", kind: "with + __exit__，退出必被调用", source: "day2 §5 单元 5" },
      ],
      mapType: "approx",
      pitfall: "块体正常、异常、return 三种退出都会调用 __exit__——异常也是一条退出路径。",
      detail:
        "两版对照：return False 版输出止于「... → caught: boom」；return True 版止于" +
        "「exit: closed (exc_type=ValueError)」，没有 caught 行。差异只发生在 exit 行之后——" +
        "__exit__ 是否被调用与收到什么参数都不依赖返回值，返回值只决定异常是否继续传播。" +
        "推论：repository 收尾的 __aexit__ 应返回 False，只清理、不吞正在发生的异常。",
    },
    {
      id: "pytest",
      semantics: "测试入口与发现规则",
      sides: [
        {
          lang: "TypeScript",
          kind: "Jest / Supertest",
          note: "W6 记的框架；可引的真实测试在 week2-express（week6-testing/src 本身是空的）",
          source: "week6-testing-ci-mental-model.md:32 · week2-express/src/__tests__/auth-flow.test.js:1-2",
        },
        { lang: "Python", kind: "pytest：test_*.py + test_* 函数 + assert 关键字", source: "day2 §5 单元 6" },
      ],
      mapType: "approx",
      pitfall: "src layout 下要在 pyproject 写 [tool.pytest.ini_options] pythonpath = [\".\"] 才 import 得到 src。",
      detail:
        "assert 是语言关键字，失败时直接显示两侧值；with pytest.raises(Exception): 断言块内必须抛。" +
        "练习结果 pytest -v = 6 passed（2 smoke + 4 users）。pytest-asyncio 1.4.0 默认 mode=STRICT，" +
        "async 测试需要显式 @pytest.mark.asyncio（D4 用到）。",
    },
  ],
};

const P3: AeAlignTopic = {
  kind: "align",
  id: "cli-dispatch",
  label: "P3",
  title: "CLI 分发器对照：Express 与 typer",
  question:
    "同一个「前置处理 → 分发 → 上下文 → 处理函数」形状，在 Express 与 typer 里各如何实现？对应到哪、失效在哪？",
  anchor:
    "四个职责位置可以在两边对上：全局前置、处理注册、入站解析、处理函数与上下文。" +
    "笔记当时的收口用词是「与 Express 同构」；本板逐对核对仓库代码后降级为「近似」——" +
    "每一对都单列了成立点与失效点。",
  group: "Python 迁移增量",
  evidenceKind: "推断",
  source: "week2-express/src（行号 2026-09-02 已核对）× " + BUB_SOURCE,
  boundary:
    "D3 笔记原话是「typer 是 CLI 分发器，与 Express 同构」；本板只比较笔记列出的 Typer 位置与本仓库" +
    "Express 代码的可见形状。由这组局部材料不能推出两个框架整体同构，因此整体证据等级为推断。",
  memory: "四根职责对齐线：线在哪，说明这两个位置在各自框架里干同一件事。",
  accept:
    "四个职责位置能逐对说出成立点与失效点，并说明「同构」是笔记原话、「近似」是本板核对后的降级。",
  hosts: { left: "Express（Node）", right: "typer（Python）" },
  positions: [
    {
      id: "prelude",
      role: "全局前置",
      express: { node: "请求日志中间件：生成 requestId 后 next()", source: "app.js:19" },
      typer: { node: "@app.callback 的 _main：--workspace option，ctx.obj = self", source: "framework.py 当时 L105-112" },
      holds: "都在具体处理函数之前对每次调用统一执行，并可把共享对象挂到上下文上。",
      fails: "当前 Express 位置接收 req/res/next 并写入 requestId；笔记中的 Typer 位置接收 workspace option，并把 framework 放入 ctx.obj。两侧载荷与上下文对象不同。",
      holdsShort: "处理前执行",
      failsShort: "载荷与上下文不同",
    },
    {
      id: "register",
      role: "处理注册",
      express: { node: "app.use('/auth', authRouter) 与 router.post('/register', ...)", source: "app.js:100 · routes/auth.js:9" },
      typer: { node: "app.command(\"run\")(cli.run)", source: "hook_impl.py 当时 L248" },
      holds: "都是「把名字绑到处理函数」的注册表写入，且注册都发生在分发之前。",
      fails: "当前 Express 注册包含 router 挂载、HTTP 方法、路径和中间件序列；笔记记录的 Typer 注册是把 run 命令名绑定到 cli.run。这里只能确认当前代码形状不同。",
      holdsShort: "绑定处理函数",
      failsShort: "注册键不同",
    },
    {
      id: "parse",
      role: "入站解析",
      express: { node: "express.json() 解析请求体；路由匹配由 app.use / router 承担", source: "app.js:83" },
      typer: { node: "app() 读 sys.argv 并按 run() 签名映射参数（笔记把它对到 Express 的路由匹配）", source: "__main__.py 当时 L45-46 · cli.py 当时 L38-67" },
      holds: "都把原始入站内容变成处理函数可以直接用的结构化输入。",
      fails: "Express 把 express.json() 单独注册为中间件；笔记只记录 app() 读取 sys.argv，并按 run() 签名映射参数。两侧解析入口不同。",
      holdsShort: "解析入站输入",
      failsShort: "解析入口不同",
    },
    {
      id: "handler",
      role: "处理函数与上下文",
      express: { node: "registerController(req, res, next)", source: "controllers/auth.js:3" },
      typer: { node: "run(ctx, ...) 内 ctx.ensure_object(BubFramework) 取回实例", source: "cli.py 当时 L38-67 · cli.py 当时 L48" },
      holds: "都由框架按固定签名把处理函数调起来。typer 侧还从 ctx 取回 framework 实例；Express 侧本仓库的 controller 只从 req.body 取入站数据，没有消费中间件注入的共享对象。",
      fails: "当前 registerController 从 req.body 取值并调用 res.status().json()；笔记中的 cli.run 从 ctx 取回 BubFramework。两侧处理函数消费的上下文与输出接口不同。",
      holdsShort: "框架调用处理函数",
      failsShort: "上下文与输出不同",
    },
  ],
  voids: [
    {
      label: "管线收口：404 catch-all 与 error handler",
      detail: "app.js:103 的 404 catch-all 与 app.js:110 的 error handler 是 Express 管线的收口。typer 侧有没有对应物，笔记没记、源码也不在本仓库，属未核。",
    },
    {
      label: "运行模型：常驻循环与一次性循环",
      detail:
        "Node 有常驻的 libuv 事件循环，Express 只注册回调；Python 没有常驻循环，cli.py 当时 L61 的 asyncio.run(_run()) " +
        "在同步函数内显式创建一个循环并运行到结束。",
    },
  ],
};

const P4: AeTraceTopic = {
  kind: "trace",
  id: "async-failure-lifecycle",
  label: "P4",
  title: "HTTP 等待失败后的传播与清理",
  question: "等待 HTTP 响应时，read timeout 与外部 cancel 怎样退出，连接和业务资源何时清理？",
  anchor:
    "read timeout 与外部 cancel 的触发源和异常类型不同，但 server 都观察到 FIN。cancel 轨迹中，" +
    "FIN 先于业务 finally 完成；随后调用方收到 CancelledError 并观察 task 已 cancelled，外层 client 再关闭。",
  group: "Python 迁移增量",
  evidenceKind: "本人实测",
  source: "day4-async-and-real-calls.md §11 · Python 3.12.10 / httpx 0.28.1",
  boundary:
    "三条轨迹只编码各自的因果顺序，轨间横向距离不是共同时间比例。timeout 对照只改变 read timeout；" +
    "本页不把 Python 的异常注入结构类比成 Node 的取消模型。",
  memory: "三条有向轨迹：低 read timeout、同 server 的长 timeout 对照、外部 cancel；终点都落到资源状态。",
  accept:
    "低 read timeout 以 ReadTimeout 退出；长 timeout 对照成功；外部 cancel 以 CancelledError 退出，" +
    "且 cancel < FIN < finally 完成 < client closed。两条失败轨迹最终 client 都已关闭。",
  actors: [
    { id: "caller", label: "调用方" },
    { id: "http-client", label: "HTTP client" },
    { id: "server", label: "慢 server" },
    { id: "resource", label: "资源状态" },
  ],
  traces: [
    {
      id: "timeout-low",
      label: "read timeout",
      scale: "ordinal",
      inputs: { readSeconds: 0.5, holdSeconds: 3 },
      points: [
        { id: "tl-wait", ordinal: 1, actor: "http-client", kind: "wait", label: "等待响应头" },
        { id: "tl-trigger", ordinal: 2, actor: "http-client", kind: "trigger", label: "read=0.5s 到期" },
        { id: "tl-fin", ordinal: 3, actor: "server", kind: "fin", label: "观察到 FIN" },
        { id: "tl-error", ordinal: 4, actor: "caller", kind: "exception", label: "ReadTimeout" },
        { id: "tl-closed", ordinal: 5, actor: "resource", kind: "terminal", label: "is_closed=True" },
      ],
      edges: [
        { from: "tl-wait", to: "tl-trigger", relation: "before" },
        { from: "tl-trigger", to: "tl-fin", relation: "causes" },
        { from: "tl-fin", to: "tl-error", relation: "observed-after" },
        { from: "tl-error", to: "tl-closed", relation: "before" },
      ],
      outcome: { exception: "ReadTimeout", clientClosed: true },
      evidence: { kind: "本人实测", scope: "D4 本项目受控 HTTP 实验", targetVerified: true },
    },
    {
      id: "timeout-control",
      label: "长 timeout 对照",
      scale: "ordinal",
      inputs: { readSeconds: 5, holdSeconds: 3 },
      points: [
        { id: "tc-wait", ordinal: 1, actor: "http-client", kind: "wait", label: "等待响应头" },
        { id: "tc-response", ordinal: 2, actor: "server", kind: "trigger", label: "hold=3s 后响应" },
        { id: "tc-success", ordinal: 3, actor: "caller", kind: "terminal", label: "content='ok'" },
        { id: "tc-closed", ordinal: 4, actor: "resource", kind: "cleanup", label: "正常关闭 client" },
      ],
      edges: [
        { from: "tc-wait", to: "tc-response", relation: "before" },
        { from: "tc-response", to: "tc-success", relation: "causes" },
        { from: "tc-success", to: "tc-closed", relation: "before" },
      ],
      outcome: { exception: "none", clientClosed: true },
      evidence: { kind: "本人实测", scope: "D4 本项目受控 HTTP 实验", targetVerified: true },
    },
    {
      id: "cancel",
      label: "外部 cancel",
      scale: "ordinal",
      inputs: { readSeconds: 30, holdSeconds: 60 },
      points: [
        { id: "ca-wait", ordinal: 1, actor: "http-client", kind: "wait", label: "挂起等待响应" },
        { id: "ca-cancel", ordinal: 2, actor: "caller", kind: "trigger", label: "task.cancel()", atSeconds: 0.469 },
        { id: "ca-fin", ordinal: 3, actor: "server", kind: "fin", label: "观察到 FIN", atSeconds: 0.47 },
        { id: "ca-finally", ordinal: 4, actor: "resource", kind: "cleanup", label: "finally 完成", atSeconds: 0.571 },
        { id: "ca-error", ordinal: 5, actor: "caller", kind: "terminal", label: "CancelledError；task cancelled", atSeconds: 0.571 },
        { id: "ca-closed", ordinal: 6, actor: "resource", kind: "cleanup", label: "client closed", atSeconds: 0.572 },
      ],
      edges: [
        { from: "ca-wait", to: "ca-cancel", relation: "before" },
        { from: "ca-cancel", to: "ca-fin", relation: "causes" },
        { from: "ca-fin", to: "ca-finally", relation: "observed-after" },
        { from: "ca-finally", to: "ca-error", relation: "before" },
        { from: "ca-error", to: "ca-closed", relation: "before" },
      ],
      outcome: { exception: "CancelledError", clientClosed: true },
      evidence: { kind: "本人实测", scope: "D4 本项目受控 HTTP 实验", targetVerified: true },
    },
  ],
  details: [
    { id: "mro", label: "ReadTimeout 类型层级", text: "ReadTimeout → TimeoutException → TransportError → RequestError → HTTPError。" },
    { id: "cancel", label: "取消注入", text: "CancelledError 在下一个 await 挂起点注入；它继承 BaseException，不匹配 except Exception。" },
    { id: "cleanup", label: "C3 收尾证据", text: "两类失败后 client 均关闭；收尾点 all_tasks 只剩当前任务，且无非主线程残留。" },
    { id: "pending-warning", label: "pending task 警告边界", text: "手动 close loop 前未取消 task 才复现 pending task 警告；它走 event loop exception handler，-W error 捕不到。" },
  ],
  sources: [
    { label: "read timeout 与长 timeout 对照", ref: "day4-async-and-real-calls.md §11 C-1" },
    { label: "外部取消的传播与清理时间点", ref: "day4-async-and-real-calls.md §11 C-2" },
    { label: "无残留检查与 pending task 边界", ref: "day4-async-and-real-calls.md §11 C-3 / P-4" },
  ],
};

const B1: AeEntryTopic = {
  kind: "entry",
  id: "entry-chain",
  label: "B1",
  title: "两条启动路径汇入第一次 turn",
  question: "bub console script 与 python -m bub 如何执行模块级初始化，并在 app() 汇合后触发第一次 turn？",
  anchor:
    "console script 导入 bub.__main__，python -m bub 直接执行该模块；两条路径都会执行模块级初始化" +
    "（app = create_cli_app()）。差异在 app() 的调用者：python -m 由 __name__ 门调用，console wrapper" +
    " 的调用形态待运行验证；两条路径在 app() 汇合后，共用 cli.run 到 process_inbound 的后续链路。",
  group: "Bub harness 骨架",
  evidenceKind: "推断",
  source: BUB_SOURCE,
  boundary:
    "[project.scripts] 只证明入口声明；console wrapper 的生成、导入与调用 app() 尚未运行核实。python -m 一路由" +
    "Python 模块执行语义和 __name__ 实验支撑。真实参数映射仍属待运行验证。",
  memory: "跨两列的节点由两条路径共同执行；单列节点区分 app() 的调用者；app() 节点是汇合点。",
  accept:
    "两条启动路径都会执行模块级初始化（app = create_cli_app()）；python -m 由 __name__ 门调用 app()，" +
    "console wrapper 的调用形态待运行验证；两条路径在 app() 汇合。",
  lanes: [
    { id: "console", label: "console script", trigger: "bub run \"hello\"" },
    { id: "python-m", label: "python -m", trigger: "python -m bub" },
  ],
  nodes: [
    {
      id: "console-start",
      short: "入口声明",
      module: "pyproject.toml",
      line: "L47-48",
      action: "[project.scripts] bub = \"bub.__main__:app\"——入口声明",
      lineOwner: "console",
      verified: "源码事实",
      detail: "这是打包配置里的入口声明，不是运行代码。",
    },
    {
      id: "python-m-start",
      short: "直接执行模块",
      module: "python -m bub",
      line: "Python 语义",
      action: "解释器执行 bub/__main__.py，并把 __name__ 设为 \"__main__\"",
      lineOwner: "python-m",
      verified: "源码事实",
    },
    {
      id: "module-level",
      short: "模块级建 app",
      module: "__main__.py",
      line: "L43",
      action: "app = create_cli_app()：模块级语句，import 或运行都会执行",
      lineOwner: "both",
      verified: "源码事实",
      detail:
        "内部三步：L30 BubFramework() 实例化 → L31 framework.load_hooks() → L32 framework.create_cli_app()。",
    },
    {
      id: "create-cli-app",
      short: "建 typer 应用",
      module: "framework.py",
      line: "L101-115",
      action: "建 typer 应用：L103 typer.Typer(name=\"bub\")；L105-112 全局回调挂上 ctx.obj；L114 触发命令注册 hook",
      lineOwner: "both",
      verified: "源码事实",
      detail: "L112 ctx.obj = self 把 framework 实例注入上下文，后面命令回调靠它取回。",
    },
    {
      id: "register-run",
      short: "注册 run 命令",
      module: "hook_impl.py",
      line: "L245-256",
      action: "register_cli_commands（hook 实现）：L248 app.command(\"run\")(cli.run) 注册 run 子命令",
      lineOwner: "both",
      verified: "源码事实",
    },
    {
      id: "wrapper-call",
      short: "wrapper 调 app()",
      module: "console wrapper",
      line: "生成形态未核",
      action: "wrapper 导入 bub.__main__ 后调用导出的 app",
      lineOwner: "console",
      verified: "待运行验证",
    },
    {
      id: "name-gate",
      short: "__name__ 门调用",
      module: "__main__.py",
      line: "L45-46",
      action: "if __name__ == \"__main__\": app()——仅直接执行模块时门打开",
      lineOwner: "python-m",
      verified: "源码事实",
    },
    {
      id: "dispatch",
      short: "app() 分发",
      module: "typer.Typer",
      line: "汇合点",
      action: "app() 读取 sys.argv，并分发到已注册的 run 命令",
      lineOwner: "both",
      verified: "源码事实",
      join: true,
    },
    {
      id: "cli-run",
      short: "run 回调",
      module: "builtin/cli.py",
      line: "L38-67",
      action: "run() 命令回调：L48 取回 framework 实例；L49-55 构造入站消息",
      lineOwner: "after-join",
      verified: "源码事实",
    },
    {
      id: "asyncio-run",
      short: "起事件循环",
      module: "builtin/cli.py",
      line: "L61",
      action: "asyncio.run(_run())：同步函数里手动起一个事件循环",
      lineOwner: "after-join",
      verified: "源码事实",
    },
    {
      id: "running",
      short: "启动 store",
      module: "builtin/cli.py",
      line: "L58",
      action: "async with framework.running()：起 tape store 与 steering inbox",
      lineOwner: "after-join",
      verified: "源码事实",
    },
    {
      id: "process-inbound",
      short: "触发第一次 turn",
      module: "builtin/cli.py",
      line: "L59",
      action: "framework.process_inbound(inbound)——第一次 turn 的触发点",
      lineOwner: "after-join",
      verified: "源码事实",
      trigger: true,
    },
  ],
  edges: [
    { from: "console-start", to: "module-level", flow: "join", owner: "console" },
    { from: "python-m-start", to: "module-level", flow: "join", owner: "python-m" },
    { from: "module-level", to: "create-cli-app", flow: "flow", owner: "both" },
    { from: "create-cli-app", to: "register-run", flow: "flow", owner: "both" },
    { from: "register-run", to: "wrapper-call", flow: "split", owner: "console" },
    { from: "register-run", to: "name-gate", flow: "split", owner: "python-m" },
    { from: "wrapper-call", to: "dispatch", flow: "join", owner: "console" },
    { from: "name-gate", to: "dispatch", flow: "join", owner: "python-m" },
    { from: "dispatch", to: "cli-run", flow: "flow", owner: "both" },
    { from: "cli-run", to: "asyncio-run", flow: "flow", owner: "both" },
    { from: "asyncio-run", to: "running", flow: "flow", owner: "both" },
    { from: "running", to: "process-inbound", flow: "flow", owner: "both" },
  ],
  timing: {
    rule: "模块顶层代码在 import 时就执行；__main__.py 的模块级 app = create_cli_app()（当时 L43）位于 if 之外，所以 import 即完成初始化。",
    gate:
      "if __name__ == \"__main__\" 只区分「直接运行」与「被 import」，对应 Node CommonJS 的 require.main === module。",
    experiments: [
      {
        command: "python src/tmp_main.py（内部 import tmp_mod）",
        output: "module loaded / done",
        reading: "tmp_mod 的顶层 print 执行了，但 __name__ 是 \"tmp_mod\"，门关着，没有 running as main。",
      },
      {
        command: "python src/tmp_mod.py",
        output: "module loaded / running as main",
        reading: "直接运行时 __name__ 是 \"__main__\"，门打开。",
      },
    ],
  },
  corrections: [
    "原判断 app 是 create_cli_app 对象 → 实际 create_cli_app 是 __main__.py 的模块级函数（当时 L28-40），app 是它的返回值（typer.Typer 实例）；同名的 framework.create_cli_app() 在 framework.py（当时 L101），两处要分开。",
    "原判断参数解析在 __main__.py（当时 L32）、初始化在 L46 → 实际当时 L32 是命令注册（经 register_cli_commands hook），参数解析发生在当时 L46 的 app()，初始化在当时 L43 的模块级调用链内完成。",
    "原判断第一次 turn 的触发点是「BubFramework 函数」→ 实际 BubFramework 是类（framework.py，当时 L47），实例化不触发 turn，触发点在 cli.py（当时 L59）。",
  ],
  seam: {
    at: "console wrapper → app()",
    question:
      "[project.scripts] 声明了 bub.__main__:app，但笔记没有保留安装后 wrapper 的生成代码或真实执行输出；" +
      "wrapper 如何导入模块并调用 app() 仍待运行核实。",
    status: "待运行验证",
  },
  sources: [
    { label: "模块级初始化与 app() 后续链", ref: "day3-bub-main-chain.md §上午（L43 到 process_inbound）" },
    { label: "入口声明与后续链报告", ref: "bub-reading-report.md §1" },
    { label: "模块执行时机与 __name__ 门实验", ref: "day3-bub-main-chain.md §额外经验" },
    { label: "console wrapper 与参数映射待运行验证", ref: "w12-ai-visualization-plan.md §4.4 B1 / bub-reading-report.md §8" },
  ],
};

const B2: AePipelineTopic = {
  kind: "pipeline",
  id: "turn-pipeline",
  label: "B2",
  title: "turn 管线里 save_state 的保证范围",
  question: "哪些 _run_model 结果会经过 save_state checkpoint，哪些更早错误会绕过它？",
  anchor:
    "_run_model 的成功、普通异常与取消都先经过 save_state checkpoint，再各自分流；" +
    "resolve_session、build_state、build_prompt 的错误发生在保护区之前，会绕过该 checkpoint。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "checkpoint 表示 finally 会尝试调用 save_state hook，不等于持久化成功。取消的 Python 语言层行为已由" +
    " 3.12.10 等价结构实测；Bub 本体的取消路径仍待运行。",
  memory: "三条 _run_model 结果线汇入一个 checkpoint；前三阶段的 error 旁路明确绕开它。",
  accept:
    "success、exception、cancelled 都从 _run_model 经 save_state checkpoint；前三阶段 error 绕过它。" +
    "取消只有 Python 3.12.10 等价结构已实测，Bub 本体仍待运行；调用 hook 不保证持久化成功。",
  stages: [
    { id: "resolve-session", label: "resolve_session", note: "定位入站消息所属会话。" },
    { id: "build-state", label: "build_state", note: "合并各 hook 给出的 turn 初始状态。" },
    { id: "build-prompt", label: "build_prompt", note: "生成这一 turn 的模型输入。" },
    { id: "run-model", label: "_run_model", note: "success、exception、cancelled 都从这里离开。" },
    { id: "collect-outbounds", label: "_collect_outbounds", note: "仅 success 在 checkpoint 后进入。" },
    { id: "dispatch-outbound", label: "dispatch_outbound", note: "逐条分发出站消息。" },
  ],
  checkpoint: {
    id: "save-state",
    label: "save_state checkpoint",
    after: "run-model",
    note: "finally 在 _run_model 离开时尝试调用；三种结果共用这一检查点。",
  },
  outcomes: [
    {
      id: "success",
      label: "正常返回",
      path: ["run-model", "save-state", "collect-outbounds", "dispatch-outbound", "success"],
      tone: "ok",
      evidence: [{ kind: "源码事实", scope: "Bub @ 33c417a", targetVerified: true }],
    },
    {
      id: "exception",
      label: "普通异常重抛",
      path: ["run-model", "save-state", "exception"],
      tone: "raise",
      evidence: [{ kind: "源码事实", scope: "Bub @ 33c417a", targetVerified: true }],
    },
    {
      id: "cancelled",
      label: "取消传播",
      path: ["run-model", "save-state", "cancelled"],
      tone: "cancel",
      evidence: [
        { kind: "本人实测", scope: "Python 3.12.10 等价结构", targetVerified: true },
        { kind: "待运行验证", scope: "Bub @ 33c417a", targetVerified: false },
      ],
    },
  ],
  bypasses: [
    { from: "resolve-session", to: "early-error", excludes: "save-state" },
    { from: "build-state", to: "early-error", excludes: "save-state" },
    { from: "build-prompt", to: "early-error", excludes: "save-state" },
  ],
  stateNote: {
    mutable: "TurnState 是 turn 内流转的可变字典。",
    frozen: "TurnResult 是 frozen dataclass 外层；其中 state 仍是可变字典，笔记未证明深冻结或复制。",
  },
  sources: [
    { label: "完整 turn 管线与错误捕获", ref: "framework.py 当时 L144-178" },
    { label: "_run_model 与 save_state checkpoint", ref: "framework.py 当时 L154-163" },
    { label: "前三阶段位于保护区之前", ref: "framework.py 当时 L148-152" },
    { label: "取消的 Python 3.12.10 等价实验", ref: "day4-async-and-real-calls.md §11 P-2 / C-2" },
  ],
};

const B3: AeTapeTopic = {
  kind: "tape",
  id: "tape-context",
  label: "B3",
  title: "tape 只增不改，模型看到的历史每次重算",
  question: "记录都先写进 tape，模型每次看到的 context 为什么是当场重算出来的，而不是一份累积的缓存？",
  anchor:
    "会话历史只存 tape 一份，而且只增不改。默认 selector 下，模型每次要看的历史都在调用前按规则重新读取；" +
    "再拼上本轮的系统提示、插话和 prompt 才发出去——历史是每次算出来的结果，不是一份越攒越大的记忆。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "本图画的是读写规则与七类记录，不是某次真实会话的 tape 内容。D4 未覆盖 Bub tape，真实会话 dump" +
    " 仍待验证。记录 id 在生成时是 0，真正的 id 由存储追加时分配，" +
    "这一条是推断，存储那一侧未读，待验证。",
  memory: "默认读取经过范围、context 标记和 message 类型三级过滤；调用后按固定顺序追加回同一 tape。",
  accept:
    "默认 selector 下，模型 messages 的历史部分在调用前从最近一个 anchor 往后、按 context 规则重新读出；" +
    "完整 messages 等于这部分再加上本轮的系统提示、插话和 prompt。",
  // 七类记录**类型**，不是一条真实 tape 上的记录序列——笔记只提供类型清单与过滤规则，
  // 没有任何一次真实会话的 tape 内容（那属于 C3，待 D4/D5 dump）。图因此画规则，不画实例。
  entries: [
    { id: "e-system", entryKind: "system", payloadBrief: "系统提示块", inDefaultMessages: false },
    { id: "e-message", entryKind: "message", payloadBrief: "默认 selector 会保留的对话消息", inDefaultMessages: true },
    { id: "e-anchor", entryKind: "anchor", payloadBrief: "读取起点：圈范围时从它之后开始", inDefaultMessages: false },
    { id: "e-tool-call", entryKind: "tool_call", payloadBrief: "模型发出的工具调用意图", inDefaultMessages: false },
    { id: "e-tool-result", entryKind: "tool_result", payloadBrief: "工具执行结果", inDefaultMessages: false },
    { id: "e-error", entryKind: "error", payloadBrief: "本轮错误记录", inDefaultMessages: false },
    { id: "e-event", entryKind: "event", payloadBrief: "本轮汇总：状态、用量、provider、模型", inDefaultMessages: false },
  ],
  // 图上画成三级过滤：① = 圈定并取出，② = 去掉标记，③ = 只留 message。
  // 第 4 条是整体替换上面三级的旁路，不是第四级。
  readStages: [
    { step: 1, label: "按 anchor 圈定范围并取出", selectorMode: "default", effect: "默认从最近一个 anchor 之后开始；也可以指定某个 anchor，或者干脆全量。每次都重新从存储读，不用缓存。" },
    { step: 2, label: "去掉标了「不进上下文」的记录", selectorMode: "default", effect: "显式标记过的记录在这一步被排除。" },
    { step: 3, label: "默认规则只留 message", selectorMode: "default", effect: "默认 selector 下，system、anchor、tool_call、tool_result、error、event 留在 tape 上，不进入历史投影。" },
    { step: 4, label: "自定义选取规则可整体替换上面三级", selectorMode: "custom", effect: "传了自定义规则就用它替代默认过滤——默认规则与自定义覆盖是两回事，不要混读。" },
  ],
  currentInputs: [
    { slot: "system", label: "系统提示（若有）拼在最前" },
    { slot: "steering", label: "别的通道插进来的 steering 消息拼在后面" },
    { slot: "prompt", label: "本轮 prompt 拼在最后" },
  ],
  writeStages: [
    { order: 1, entryKind: "system", note: "本轮系统提示。" },
    { order: 2, entryKind: "context_error", note: "有上下文错误时才追加。" },
    { order: 3, entryKind: "message", note: "本轮新增的每条消息各追加一条。" },
    { order: 4, entryKind: "tool_call", note: "模型发出的工具调用。" },
    { order: 5, entryKind: "tool_result", note: "工具执行结果。" },
    { order: 6, entryKind: "error", note: "本轮错误。" },
    { order: 7, entryKind: "message", note: "模型这一轮的回复文本。" },
    { order: 8, entryKind: "event", note: "汇总记录：状态、用量、provider、模型。" },
  ],
  writeTriggers: [
    { path: "tool", note: "工具路径：工具执行完之后才写回 tape。" },
    { path: "text", note: "纯文本路径：模型返回后直接写回 tape。" },
    { path: "intercepted", note: "被拦截：hook 在调模型之前直接给出结果时，这次写入替代那次真实调用。" },
  ],
  frames: [
    {
      id: "f-start",
      phase: "read",
      title: "tape 现状",
      text: "tape 里存着这一会话的全部记录，共七类。它只增不改：已经写进去的记录不会被改写或删除。",
    },
    {
      id: "f-range",
      phase: "read",
      title: "① 按 anchor 圈定范围",
      text: "第一级：按 anchor 定出这一轮要读的范围，默认是最近一个 anchor 之后。每次都重新从存储读，不用缓存——这一步决定了历史是算出来的，不是攒下来的。",
    },
    {
      id: "f-filter",
      phase: "read",
      title: "② 去掉标了「不进上下文」的",
      text: "第二级：范围内被显式标记为「不进上下文」的记录在这里被排除。",
    },
    {
      id: "f-kind",
      phase: "read",
      title: "③ 默认规则只留 message",
      text: "第三级是默认 selector：只有 message 进入历史投影。自定义 select 可以整体替换这三级规则。",
    },
    {
      id: "f-assemble",
      phase: "assemble",
      title: "拼上本轮输入",
      text: "三级过滤的结果只是 messages 里历史的那一半；再拼上系统提示、别的通道插话和本轮 prompt，才是完整的 messages。两半来源不同，所以分开画。",
    },
    {
      id: "f-model",
      phase: "model",
      title: "调模型",
      text: "模型拿到完整 messages，返回工具调用或纯文本。从这里开始分成工具路径与纯文本路径两条。",
    },
    {
      id: "f-execute",
      phase: "execute",
      title: "工具路径：先执行",
      text: "先执行工具，拿到结果之后才写回 tape——写入发生在工具执行完，不是模型一返回就写。",
      path: "tool",
    },
    {
      id: "f-append-tool",
      phase: "append",
      title: "④ 追加回 tape（工具路径）",
      text: "这一轮按固定顺序追加：system、可选 context_error、new_messages、tool_call、tool_result、error、assistant message、event。旧记录不改，下一轮仍从 tape 读取。",
      path: "tool",
    },
    {
      id: "f-append-text",
      phase: "append",
      title: "④ 追加回 tape（纯文本路径）",
      text: "没有工具执行时，模型一返回就写回 tape，追加的记录里没有工具调用和工具结果这两条。",
      path: "text",
    },
  ],
  sources: [
    { label: "调用前读出历史的那条链", ref: "tape.py 当时 L300-307（由 model_runner.py 当时 L322 触发）" },
    { label: "只挑对话消息的默认规则", ref: "tape.py 当时 L165-173" },
    { label: "七类条目的生成入口", ref: "tape.py 当时 L84-129" },
    { label: "anchor 规则与自定义选取", ref: "tape.py 当时 L143-157" },
    { label: "本轮输入的拼装位置", ref: "model_runner.py 当时 L333-336" },
    { label: "落盘 record_chat 的追加顺序", ref: "model_runner.py 当时 L359-389 → tape.py 当时 L323-366" },
    { label: "落盘触发点：工具路径 / 纯文本 / 被拦截", ref: "model_runner.py 当时 L251 / L270 / L198" },
  ],
};

const B4: AeMachineTopic = {
  kind: "machine",
  id: "step-loop",
  label: "B4",
  title: "step 循环：正常、恢复与耗尽",
  question: "一个 turn 内，step 循环怎样继续、返回、恢复，以及在第 max_steps 次仍继续后耗尽？",
  anchor:
    "tool_calls/tool_results 为真时直接继续；二者为空才检查 steering，三者都空就 return。" +
    "上下文超长按预算恢复；第 max_steps 次仍要求继续时，for 循环耗尽并抛 RuntimeError，不存在 step 4。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "C1 已在 Python 3.12.10 等价结构验证；Bub 本体仍待运行。实验只覆盖 tool_calls 分支且 steering=false，" +
    "未覆盖 tool_results、steering 与 auto_handoff。",
  memory: "turn 外框内有 step loop；重复组停在 step 3 后抛错，对照组在 step 2 return。",
  accept:
    "状态机完整显示正常、恢复与耗尽；C1 两组 max_steps 都为 3：重复组仅有 step 1/2/3 后抛" +
    " max_steps_reached=3，对照组在 step 2 return，页面没有 step 4。turn 包含 step loop。",
  loopScope: {
    outer: "turn",
    inner: "step-loop",
    note: "turn 是一次入站处理边界；step loop 是其内部的模型往返迭代。",
  },
  zones: [
    { id: "normal", layer: 1, title: "常规继续与停止", note: "先看 tool_calls/tool_results；两者都没有时再检查 steering。" },
    { id: "recover", layer: 2, title: "异常恢复", note: "上下文超长分支受自动交接次数预算限制。" },
    { id: "boundary", layer: 3, title: "循环边界层", note: "循环自身的耗尽，与前两层不在同一个控制层次。" },
  ],
  nodes: [
    { id: "run", zone: "normal", label: "跑完一个 step" },
    { id: "final", zone: "normal", label: "这一步有没有产出工具调用或工具结果" },
    { id: "steering", zone: "normal", label: "别的通道有没有插话" },
    { id: "continue", zone: "normal", label: "继续：进入下一个 step", tone: "continue" },
    { id: "stop", zone: "normal", label: "停止：记一条正常结束，在循环内返回", tone: "stop" },
    { id: "except", zone: "recover", label: "这一步抛了异常" },
    { id: "budget", zone: "recover", label: "是否为上下文超长且自动交接次数未用完" },
    { id: "handoff", zone: "recover", label: "换一个新起点（重置 anchor），带原 prompt 重试" },
    { id: "raise", zone: "recover", label: "记成错误，把异常抛给上层", tone: "error" },
    { id: "last-step", zone: "boundary", label: "step=max_steps 仍要求继续" },
    { id: "max-steps", zone: "boundary", label: "for 耗尽，抛 RuntimeError", tone: "error" },
  ],
  edges: [
    { from: "run", to: "final", zone: "normal", condition: "一个 step 跑完，产出用于判定的事件", kind: "continue" },
    {
      from: "final",
      to: "continue",
      zone: "normal",
      condition: "tool_calls 或 tool_results 为真；Python or 短路，不调用 steering 检查",
      kind: "continue",
      shortCircuit: true,
    },
    { from: "final", to: "steering", zone: "normal", condition: "没有工具调用，也没有工具结果时看插话", kind: "continue" },
    { from: "steering", to: "continue", zone: "normal", condition: "有插话 → 继续", kind: "continue" },
    { from: "steering", to: "stop", zone: "normal", condition: "没有工具调用、工具结果或插话 → 停止", kind: "stop" },
    { from: "continue", to: "run", zone: "normal", condition: "进入下一个 step 的迭代", kind: "continue" },
    { from: "except", to: "budget", zone: "recover", condition: "异常进入恢复条件判定", kind: "recover" },
    { from: "budget", to: "handoff", zone: "recover", condition: "上下文超长，且自动交接的次数还没用完", kind: "recover" },
    { from: "handoff", to: "run", zone: "recover", condition: "重置起点后带原 prompt 回到下一次迭代", kind: "recover" },
    { from: "budget", to: "raise", zone: "recover", condition: "次数已用完，或者根本不是上下文超长", kind: "raise" },
    { from: "continue", to: "last-step", zone: "boundary", condition: "当前为 step=max_steps 且仍要求继续", kind: "continue" },
    { from: "last-step", to: "max-steps", zone: "boundary", condition: "for range(1, max_steps + 1) 耗尽 → RuntimeError", kind: "raise" },
  ],
  experiment: {
    maxSteps: 3,
    steering: false,
    branch: "tool_calls",
    evidence: [
      { kind: "本人实测", scope: "Python 3.12.10 等价结构", targetVerified: true },
      { kind: "待运行验证", scope: "Bub @ 33c417a", targetVerified: false },
    ],
    traces: [
      {
        id: "repeat",
        label: "重复 tool_call",
        steps: [
          { step: 1, toolCalls: true },
          { step: 2, toolCalls: true },
          { step: 3, toolCalls: true },
        ],
        terminal: { afterStep: 3, outcome: "max_steps_reached=3" },
      },
      {
        id: "control",
        label: "第 2 轮改为 text",
        steps: [
          { step: 1, toolCalls: true },
          { step: 2, toolCalls: false },
        ],
        terminal: { afterStep: 2, outcome: "return" },
      },
    ],
    uncovered: ["tool_results", "steering", "auto_handoff", "Bub runtime"],
  },
  sources: [
    { label: "for step 范围", ref: "agent.py 当时 L214" },
    { label: "tool_calls/tool_results truthy 判定", ref: "agent.py 当时 L242" },
    { label: "Python or 短路、三者空时 return", ref: "agent.py 当时 L285-286" },
    { label: "③ 异常分支与自动交接次数预算", ref: "agent.py 当时 L243-280（预算上限常量 MAX_AUTO_HANDOFF_RETRIES，笔记未给行号）" },
    { label: "for 循环耗尽后的 RuntimeError", ref: "agent.py 当时 L309" },
    { label: "C1 等价结构运行记录", ref: "day4-async-and-real-calls.md §11 C1" },
  ],
};

const B5: AeRolesTopic = {
  kind: "roles",
  id: "roles-nesting",
  label: "B5",
  title: "工具调用的职责边界：最小 demo 与 Bub",
  question: "决定、执行、继续和持久化四项职责，在 D4 最小 demo 与 Bub 中分别由谁承担？",
  anchor:
    "D4 demo 只有模型决定与调用方手工执行，继续和持久化两格为空；Bub 的四格分别由 model、" +
    "ToolExecutor、Agent、ModelRunner+tape 承担。空格是系统边界，不用文字补成隐含能力。",
  group: "Bub harness 骨架",
  evidenceKind: "推断",
  source: "day4-async-and-real-calls.md §11 §6.2 × " + BUB_SOURCE,
  boundary:
    "D4 只做一次往返，tool result 未回灌；因此 D4 不存在 execute→model 或 execute→tape 的边。" +
    "跨系统职责对齐是推断，不把最小 demo 写成完整 harness。",
  memory: "四行两列的覆盖矩阵：D4 下半两格留空，Bub 四格都有明确 owner。",
  accept:
    "D4：decide=present、execute=manual、continue=absent、persist=absent；Bub 四项都有 owner。" +
    "D4 不画 execute→model/tape，Bub 显示 tool result 进入 Agent continuation 与 tape。",
  systems: [
    {
      id: "d4",
      label: "D4 最小 demo",
      evidence: { kind: "本人实测", scope: "D4 真实 DeepSeek 调用", targetVerified: true },
    },
    {
      id: "bub",
      label: "Bub harness",
      evidence: { kind: "源码事实", scope: "Bub @ 33c417a", targetVerified: true },
    },
  ],
  responsibilities: [
    { id: "decide", label: "决定" },
    { id: "execute", label: "执行" },
    { id: "continue", label: "继续" },
    { id: "persist", label: "持久化" },
  ],
  cells: [
    { system: "d4", responsibility: "decide", status: "present", owner: "DeepSeek model", mechanism: "返回一个 tool_call" },
    { system: "d4", responsibility: "execute", status: "manual", owner: "调用方 main()", mechanism: "json.loads arguments 后手工调用本地函数" },
    { system: "d4", responsibility: "continue", status: "absent", owner: null, mechanism: "resultFedBack=false；一次往返即停" },
    { system: "d4", responsibility: "persist", status: "absent", owner: null, mechanism: "无 tape、state 或 record_chat" },
    { system: "bub", responsibility: "decide", status: "present", owner: "model", mechanism: "产出 tool_calls 或纯文本" },
    { system: "bub", responsibility: "execute", status: "present", owner: "ToolExecutor", mechanism: "执行已注册工具并生成 tool_result" },
    { system: "bub", responsibility: "continue", status: "present", owner: "Agent", mechanism: "依据 tool result 与 steering 推进" },
    { system: "bub", responsibility: "persist", status: "present", owner: "ModelRunner + tape", mechanism: "record_chat 追加本轮记录" },
  ],
  edges: [
    { system: "d4", from: "d4-decide", to: "d4-execute", payload: "tool_call arguments" },
    { system: "bub", from: "bub-decide", to: "bub-execute", payload: "tool_calls" },
    { system: "bub", from: "bub-execute", to: "bub-continue", payload: "tool_result" },
    { system: "bub", from: "bub-execute", to: "bub-persist", payload: "tool_result → record_chat" },
  ],
  observations: {
    contentEmpty: true,
    toolCallCount: 1,
    argumentsJsonParseable: true,
    resultFedBack: false,
  },
  alignmentEvidence: { kind: "推断", scope: "D4 最小 demo × Bub @ 33c417a", targetVerified: false },
  hooks: [
    { name: "D4 原始输出", call: "content 为空、tool_calls=1、arguments 可 JSON 解析；call id 下沉到每日笔记。" },
    { name: "Bub 记录点", call: "ToolExecutor 结果由 ModelRunner 交给 record_chat，再追加到 tape。" },
    { name: "未知工具", call: "占位 Tool 抛错，交给 hook 恢复；不改变四职责归属。" },
  ],
  sources: [
    { label: "D4 一次工具调用与三层对照", ref: "day4-async-and-real-calls.md §11 §6.2" },
    { label: "Bub 工具结果与 record_chat", ref: "model_runner.py 当时 L251 / L359-389" },
    { label: "Bub 继续判定 owner", ref: "agent.py 当时 L242 / L285-286" },
    { label: "未知工具名 → 占位工具抛错", ref: "model_runner.py 当时 L504-525" },
  ],
};

/** 顺序即导航顺序：先 Python 迁移增量，再 Bub harness 骨架。 */
export const AE_TOPICS: AeTopic[] = [P1, P3, P4, B1, B2, B3, B4, B5];
