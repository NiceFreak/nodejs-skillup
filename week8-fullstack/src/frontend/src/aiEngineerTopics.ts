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
  }>;
  voids: Array<{ label: string; detail: string }>;
}

/* ------------------------------------------------------------------- B1 入口链 */

export type AeLineOwner = "console" | "python-m" | "both" | "after-join";

export interface AeEntryTopic extends AeBase {
  kind: "entry";
  lanes: Array<{ id: "console" | "python-m"; label: string; trigger: string }>;
  nodes: Array<{
    id: string;
    module: string;
    line: string;
    action: string;
    lineOwner: AeLineOwner;
    verified: AeEvidence;
    /** 折叠层：模块级调用链内部细节 */
    detail?: string;
    /** 汇合点单独标记，供拓扑断言读取 */
    join?: boolean;
  }>;
  timing: {
    rule: string;
    gate: string;
    experiments: Array<{ command: string; output: string; reading: string }>;
  };
  corrections: string[];
}

/* --------------------------------------------------------------- B2 turn 管线 */

export interface AePipelineTopic extends AeBase {
  kind: "pipeline";
  stages: Array<{ id: string; label: string; note: string }>;
  finallyScope: { from: string; to: string; note: string };
  ends: Array<{
    id: string;
    label: string;
    path: string;
    tone: "ok" | "raise" | "cancel";
    verified: AeEvidence;
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
    metaContext: boolean;
    inMessages: boolean;
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
  demo: Array<{ id: string; text: string }>;
  evidenceStatus: Array<{ branch: string; status: AeEvidence }>;
}

/* ---------------------------------------------------------- B5 职责与 turn⊃step */

export interface AeRolesTopic extends AeBase {
  kind: "roles";
  participants: Array<{
    id: string;
    lane: "model" | "tool" | "harness";
    object: string;
    role: string;
    decides: string;
  }>;
  nesting: { turn: string; step: string; note: string };
  crossing: Array<{ from: string; to: string; payload: string }>;
  hooks: Array<{ name: string; call: string }>;
}

export type AeTopic =
  | AeSyntaxTopic
  | AeAlignTopic
  | AeEntryTopic
  | AePipelineTopic
  | AeTapeTopic
  | AeMachineTopic
  | AeRolesTopic;

export const AE_GROUPS: readonly AeGroup[] = ["Python 迁移增量", "Bub harness 骨架"];

const BUB_SOURCE = "Bub @ 33c417a（只读）· bub-reading-report.md / day3-bub-main-chain.md";

/* ================================================================= 七块内容 */

const P1: AeSyntaxTopic = {
  kind: "syntax",
  id: "py-syntax",
  label: "P1",
  title: "六个语法单元的映射类型",
  question: "本周（D2）完成的六个语法单元迁到 Python 时，对应关系各是什么形态？",
  anchor:
    "六个单元都有明确对应，但映射类型不同：等价、近似、Python 侧新增，以及「同语言两形态」——" +
    "dataclass 与 Pydantic 的语义源是 TS interface，属 Python 内两形态，不是 TS 等价。",
  group: "Python 迁移增量",
  evidenceKind: "本人实测",
  source: "week12-python-rag/notes/day2-freeze-and-baseline.md §5 · Python 3.12.10 / pydantic 2.13.5",
  boundary:
    "两侧证据性质不同：Python 侧是 D2 的本人实测（含预测偏差留痕）；TS 侧是从本仓库 W8 前端与 W6 笔记里" +
    "取的既有代码或框架，本周没有为对照重跑过 TS 侧实验。「资源收尾」一栏本仓库前端确实没有对照物，" +
    "留空标注而不是拿常识去填。",
  memory: "同一行 = 同一语义；中列的线型说明这两端是怎么对上的。",
  accept:
    "六单元的映射类型能被独立正确分类，dataclass 与 Pydantic 记为 Python 内两形态而非 TS 等价。",
  legend: [
    { type: "eq", label: "等价", shape: "实线双箭头" },
    { type: "approx", label: "近似（语法对，语义有坑）", shape: "实线单箭头 + 空心端点" },
    { type: "new", label: "Python 侧新增语言级契约", shape: "虚线 + 方块端点" },
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
        { lang: "Python", kind: "title: str | None = None，返回用 -> str", source: "day2 §5 单元 1" },
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
          kind: "class ApiError extends Error（带 status）",
          note: "本仓库前端的同类做法；笔记未把它列为本单元的对照物",
          source: "api.ts:34-42",
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
          kind: "本仓库前端没有 try/finally 资源收尾",
          note: "不拿常识对照顶替：这一侧本周没有可核的对照物",
          absent: true,
        },
        { lang: "Python", kind: "with + __exit__，退出必被调用", source: "day2 §5 单元 5" },
      ],
      mapType: "new",
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
          note: "W6 用的框架；week6-testing/src 为空，仓库里没有可引的测试文件",
          source: "week6-testing/notes/week6-testing-ci-mental-model.md:32",
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
    "Express 的中间件与路由模型是理解 typer 的脚手架：四个职责位置可以对应，但每一对都有成立点与失效点，" +
    "不是严格同构。",
  group: "Python 迁移增量",
  evidenceKind: "源码事实",
  source: "week2-express/src（行号 2026-09-02 已核对）× " + BUB_SOURCE,
  boundary:
    "本板不宣称严格同构。「Express 是理解 typer 的脚手架」这句由本人 D3 用 Express 词汇收口、AI 验收通过。",
  memory: "四根职责对齐线：线在哪，说明这两个位置在各自框架里干同一件事。",
  accept:
    "Express 是理解 typer 的近似脚手架：四个职责位置可对应，每对都标注了成立与失效边界，未宣称严格同构。",
  hosts: { left: "Express（Node）", right: "typer（Python）" },
  positions: [
    {
      id: "prelude",
      role: "全局前置",
      express: { node: "请求日志中间件：生成 requestId 后 next()", source: "app.js:19" },
      typer: { node: "@app.callback 的 _main：--workspace option，ctx.obj = self", source: "framework.py:105-112" },
      holds: "都在具体处理函数之前对每次调用统一执行，并可把共享对象挂到上下文上。",
      fails: "Express 中间件可以叠多层，也可以不调 next() 直接终止链路；typer 的 callback 每进程一次，不能拦截命令分发。",
    },
    {
      id: "register",
      role: "处理注册",
      express: { node: "app.use('/auth', authRouter) 与 router.post('/register', ...)", source: "app.js:100 · routes/auth.js:9" },
      typer: { node: "app.command(\"run\")(cli.run)", source: "hook_impl.py:248" },
      holds: "都是「把名字绑到处理函数」的注册表写入，且注册都发生在分发之前。",
      fails: "Express 是两级（router 挂载 + 方法 × 路径），同一路径按 HTTP 方法分叉；typer 只有命令名一级，没有方法维度。",
    },
    {
      id: "parse",
      role: "入站解析",
      express: { node: "express.json()", source: "app.js:83" },
      typer: { node: "typer 按 run() 函数签名把 argv 映射为参数（位置参数 / --option）", source: "cli.py:38-67" },
      holds: "都把原始入站内容变成处理函数可以直接用的结构化输入。",
      fails: "express.json() 是可插拔中间件，可换成别的、也可以不装；typer 的映射由函数签名与类型注解静态决定，不是中间件。",
    },
    {
      id: "handler",
      role: "处理函数与上下文",
      express: { node: "registerController(req, res, next)", source: "controllers/auth.js:3" },
      typer: { node: "run(ctx, ...) 内 ctx.ensure_object(BubFramework) 取回实例", source: "cli.py:38-67 · cli.py:48" },
      holds: "都先从上下文对象取共享依赖，再执行业务。",
      fails: "HTTP 每请求有独立的 req/res 生命周期，res 是必须回写的出口；CLI 是一次 argv 的进程，没有 res，出口是 stdout 与退出码。",
    },
  ],
  voids: [
    {
      label: "管线收口：404 catch-all 与 error handler",
      detail: "app.js:103 的 404 catch-all 与 app.js:110 的 error handler 是 Express 管线的收口，typer 侧没有对应物。",
    },
    {
      label: "运行模型：常驻循环与一次性循环",
      detail:
        "Node 有常驻的 libuv 事件循环，Express 只注册回调；Python 没有常驻循环，cli.py:61 的 asyncio.run(_run()) " +
        "在同步函数内显式创建一个循环并运行到结束。",
    },
  ],
};

const B1: AeEntryTopic = {
  kind: "entry",
  id: "entry-chain",
  label: "B1",
  title: "两条启动线汇到一个 app()",
  question: "bub 命令与 python -m bub 两条启动路径如何汇到同一个 app()？模块归属与执行时机如何分工？",
  anchor:
    "两条路径的模块级执行一致——都先执行 __main__.py:43 建好 app；差异只在谁调用 app()：" +
    "console script 由安装生成的 wrapper 调用，python -m 由 __main__.py:46 的 __name__ 门调用。" +
    "汇合后同样走 typer 分发 → cli.run → process_inbound。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "构建后端是 hatchling（pyproject.toml:66-68）；[project.scripts] 只是入口声明（L47-48）。" +
    "console wrapper 的生成与调用形态、bub run 的端到端执行本周未运行核实，标为待运行验证；" +
    "python -m 一路为源码可读。",
  memory: "两条启动线、一个 app()：跨两列的节点是两线共有，只占一列的是那条线独有。",
  accept:
    "两条启动路径的模块级执行一致（L43 两线共有）；差异落在 app() 的调用者——python -m 由 L46 调用（源码可读），" +
    "console wrapper 行为列为待运行验证；两线最终汇合到 app()。",
  lanes: [
    { id: "console", label: "console script（bub run \"hello\"）", trigger: "安装生成的 wrapper" },
    { id: "python-m", label: "python -m bub", trigger: "解释器把 bub/__main__.py 当作 __main__ 执行" },
  ],
  nodes: [
    {
      id: "scripts",
      module: "pyproject.toml",
      line: "L47-48",
      action: "[project.scripts] bub = \"bub.__main__:app\"（入口声明）",
      lineOwner: "console",
      verified: "源码事实",
      detail: "属打包配置，不是运行代码；构建后端为 hatchling（pyproject.toml:66-68）。",
    },
    {
      id: "wrapper-import",
      module: "console wrapper",
      line: "安装生成",
      action: "导入 bub.__main__ 并取到模块级的 app",
      lineOwner: "console",
      verified: "待运行验证",
    },
    {
      id: "dash-m",
      module: "python -m bub",
      line: "Python 语义",
      action: "解释器加载 bub/__main__.py，并把 __name__ 置为 \"__main__\"",
      lineOwner: "python-m",
      verified: "源码事实",
    },
    {
      id: "module-level",
      module: "__main__.py",
      line: "L43",
      action: "app = create_cli_app()：模块级语句，import 或运行都会执行",
      lineOwner: "both",
      verified: "源码事实",
      detail:
        "内部：L30 BubFramework() 实例化（framework.py:50-61，持有 PluginManager / HookRuntime / AgentHooks / " +
        "ChannelRouter / TapeStore / SteeringInbox）→ L31 framework.load_hooks()（framework.py:75-99，" +
        "builtin 先注册、entry-point 插件后注册）→ L32 framework.create_cli_app()（framework.py:101-115：" +
        "L103 建 typer.Typer(name=\"bub\")；L105-112 @app.callback 全局回调；L114 call_many_sync" +
        "(\"register_cli_commands\")）→ hook_impl.py:248 app.command(\"run\")(cli.run) 注册子命令。",
    },
    {
      id: "wrapper-call",
      module: "console wrapper",
      line: "安装生成",
      action: "由 wrapper 调用 app()",
      lineOwner: "console",
      verified: "待运行验证",
    },
    {
      id: "name-gate",
      module: "__main__.py",
      line: "L45-46",
      action: "if __name__ == \"__main__\": app()——由 __name__ 门调用",
      lineOwner: "python-m",
      verified: "源码事实",
    },
    {
      id: "join-app",
      module: "typer.Typer 实例",
      line: "汇合点",
      action: "app() 读 sys.argv 分发到 run 命令",
      lineOwner: "both",
      verified: "源码事实",
      join: true,
    },
    {
      id: "cli-run",
      module: "builtin/cli.py",
      line: "L38-67",
      action: "run() 命令回调：L48 ctx.ensure_object(BubFramework)；L49-55 构造 ChannelMessage（inbound）",
      lineOwner: "after-join",
      verified: "源码事实",
    },
    {
      id: "asyncio-run",
      module: "builtin/cli.py",
      line: "L61",
      action: "asyncio.run(_run())：同步函数内显式起一个事件循环",
      lineOwner: "after-join",
      verified: "源码事实",
    },
    {
      id: "running",
      module: "builtin/cli.py",
      line: "L58",
      action: "async with framework.running()：起 tape store 与 steering inbox",
      lineOwner: "after-join",
      verified: "源码事实",
    },
    {
      id: "process-inbound",
      module: "builtin/cli.py",
      line: "L59",
      action: "framework.process_inbound(inbound)——第一次 turn 的触发点",
      lineOwner: "after-join",
      verified: "源码事实",
    },
  ],
  timing: {
    rule: "模块顶层代码在 import 时就执行；__main__.py:43 位于 if 之外，所以 import 即完成初始化。",
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
    "原判断 app 是 create_cli_app 对象 → 实际 create_cli_app 是 __main__.py:28-40 的模块级函数，app 是它的返回值（typer.Typer 实例）；同名的 framework.create_cli_app() 在 framework.py:101，两处要分开。",
    "原判断参数解析在 __main__.py:32、初始化在 L46 → 实际 L32 是命令注册（经 register_cli_commands hook），参数解析发生在 L46 的 app()，初始化在 L43 的模块级调用链内完成。",
    "原判断第一次 turn 的触发点是「BubFramework 函数」→ 实际 BubFramework 是类（framework.py:47），实例化不触发 turn，触发点在 cli.py:59。",
  ],
};

const B2: AePipelineTopic = {
  kind: "pipeline",
  id: "turn-pipeline",
  label: "B2",
  title: "turn 管线与 finally 的作用域",
  question: "一次 turn 的管线阶段顺序是什么？save_state 的保证范围到哪？结束时按什么分叉？",
  anchor:
    "阶段顺序固定；进入 _run_model 之后，无论正常、普通异常还是取消，都会尝试调用 save_state——" +
    "finally 只罩住 _run_model，更早阶段的异常不经过它。「尝试调用」不等于「持久化成功」。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "落盘 hook 在 finally 里无条件调用，拿到的是那一刻的模型输出（异常时是空串或半成品）；" +
    "调用了 hook 不等于持久化成功。取消那一支为源码推导，运行验证属 D4。",
  memory: "finally 的罩子只盖到 _run_model——罩子的起止范围本身就是结论。",
  accept: "save_state 的 finally 只罩 _run_model，不是整个 turn；它是尝试调用，不是保证持久化成功。",
  stages: [
    { id: "resolve-session", label: "resolve_session", note: "先定位这条入站消息属于哪个会话；入站是字典时把会话 id 补进去。" },
    { id: "build-state", label: "build_state", note: "建这一 turn 的状态：预置工作区与插话收件箱，再合并各 hook 给的初始状态。" },
    { id: "build-prompt", label: "build_prompt", note: "定这一 turn 发给模型的 prompt；没有 hook 改写就取消息内容本身。" },
    { id: "run-model", label: "_run_model", note: "真正调模型的阶段，也是唯一被 finally 罩住的阶段。" },
    { id: "collect-outbounds", label: "_collect_outbounds", note: "收集这一 turn 要发出去的消息。" },
    { id: "dispatch-outbound", label: "dispatch_outbound", note: "逐条把出站消息交给各自的通道。" },
  ],
  finallyScope: {
    from: "run-model",
    to: "run-model",
    note: "try/finally 只包住调模型这一段：更早的阶段抛异常，根本走不到落盘那一步。",
  },
  ends: [
    {
      id: "ok",
      label: "正常返回",
      path: "走完全部阶段，返回这一 turn 的不可变结果：会话 id、prompt、模型输出、出站消息、状态快照。",
      tone: "ok",
      verified: "源码事实",
    },
    {
      id: "raise",
      label: "普通异常：先落盘再重抛",
      path: "finally 里的落盘先跑，然后记一条异常日志、发一条标着 turn 阶段的错误通知，异常继续抛给调用方。",
      tone: "raise",
      verified: "源码事实",
    },
    {
      id: "cancel",
      label: "取消：直穿调用方",
      path: "取消异常不属于「普通异常」那一支，捕获不到；finally 仍然落盘，但异常直接穿过去，不记日志也不发错误通知。",
      tone: "cancel",
      verified: "待运行验证",
    },
  ],
  stateNote: {
    mutable: "turn 内流转的是一张可变草稿纸（普通字典），各阶段都能往上写。",
    frozen: "交付出去的是不可变结果对象，带一份状态快照——离开 turn 之后不会再变。",
  },
  sources: [
    { label: "turn 管线与三条结束分支", ref: "framework.py:144-178" },
    { label: "finally 的作用域（只包 _run_model）", ref: "framework.py:154-163" },
    { label: "落盘 hook save_state 的调用点", ref: "framework.py:157" },
    { label: "build_state / build_prompt / _run_model", ref: "framework.py:135-142 / 117-126 / 186-225" },
    { label: "可变草稿纸 TurnState 与不可变结果 TurnResult", ref: "turn.py:10 / turn.py:13-21" },
  ],
};

const B3: AeTapeTopic = {
  kind: "tape",
  id: "tape-context",
  label: "B3",
  title: "tape 只增不改，模型看到的历史每次重算",
  question: "记录都先写进 tape，模型每次看到的 context 为什么是当场重算出来的，而不是一份累积的缓存？",
  anchor:
    "会话历史只存 tape 一份，而且只增不改。模型每次要看的历史，都是在调用前按规则重新读一遍算出来的；" +
    "再拼上本轮的系统提示、插话和 prompt 才发出去——历史是每次算出来的结果，不是一份越攒越大的记忆。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "本图画的是读写规则与七类记录，不是某次真实会话的 tape 内容——一次真实会话里 messages 到底" +
    "长什么样属于 C3，待 D4/D5 dump 后才能画。记录 id 在生成时是 0，真正的 id 由存储追加时分配，" +
    "这一条是推断，存储那一侧未读，待验证。",
  memory: "读要过三级过滤才拿到历史，写按固定顺序追加回同一个集合——读在调用前、写在调用后，闭成一个环。",
  accept:
    "模型 messages 里的历史部分，是调用前从最近一个 anchor 往后、按 context 规则重新读出来的；" +
    "完整 messages 等于这部分再加上本轮的系统提示、插话和 prompt。",
  // 七类记录**类型**，不是一条真实 tape 上的记录序列——笔记只提供类型清单与过滤规则，
  // 没有任何一次真实会话的 tape 内容（那属于 C3，待 D4/D5 dump）。图因此画规则，不画实例。
  entries: [
    { id: "e-system", entryKind: "system", payloadBrief: "系统提示块", metaContext: true, inMessages: false },
    { id: "e-message", entryKind: "message", payloadBrief: "对话消息（模型真正读的那一类）", metaContext: true, inMessages: true },
    { id: "e-anchor", entryKind: "anchor", payloadBrief: "读取起点：圈范围时从它之后开始", metaContext: true, inMessages: false },
    { id: "e-tool-call", entryKind: "tool_call", payloadBrief: "模型发出的工具调用意图", metaContext: true, inMessages: false },
    { id: "e-tool-result", entryKind: "tool_result", payloadBrief: "工具执行结果", metaContext: true, inMessages: false },
    { id: "e-error", entryKind: "error", payloadBrief: "本轮错误记录", metaContext: true, inMessages: false },
    { id: "e-event", entryKind: "event", payloadBrief: "本轮汇总：状态、用量、provider、模型", metaContext: true, inMessages: false },
  ],
  // 图上画成三级过滤：① = 圈定并取出，② = 去掉标记，③ = 只留 message。
  // 第 4 条是整体替换上面三级的旁路，不是第四级。
  readStages: [
    { step: 1, label: "按 anchor 圈定范围并取出", selectorMode: "default", effect: "默认从最近一个 anchor 之后开始；也可以指定某个 anchor，或者干脆全量。每次都重新从存储读，不用缓存。" },
    { step: 2, label: "去掉标了「不进上下文」的记录", selectorMode: "default", effect: "显式标记过的记录在这一步被排除。" },
    { step: 3, label: "只留对话消息", selectorMode: "default", effect: "系统提示、anchor、工具调用、工具结果、错误、事件这六类都留在 tape 上，不进模型输入。" },
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
      title: "③ 只留对话消息",
      text: "第三级：只有 message 这一类往下走。系统提示、anchor、工具调用、工具结果、错误、事件六类都留在 tape 上，模型看不到它们。",
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
      text: "这一轮的记录按固定顺序追加回 tape：系统提示、消息、工具调用、工具结果、错误、模型回复、汇总。anchor 不动，旧记录不变——闭环回到起点，下一轮再从这里读。",
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
    { label: "调用前读出历史的那条链", ref: "tape.py:300-307（由 model_runner.py:322 触发）" },
    { label: "只挑对话消息的默认规则", ref: "tape.py:165-173" },
    { label: "七类条目的生成入口", ref: "tape.py:84-129" },
    { label: "anchor 规则与自定义选取", ref: "tape.py:143-157" },
    { label: "本轮输入的拼装位置", ref: "model_runner.py:333-336" },
    { label: "落盘 record_chat 的追加顺序", ref: "model_runner.py:359-389 → tape.py:323-366" },
    { label: "落盘触发点：工具路径 / 纯文本 / 被拦截", ref: "model_runner.py:251 / :270 / :198" },
  ],
};

const B4: AeMachineTopic = {
  kind: "machine",
  id: "step-loop",
  label: "B4",
  title: "step 循环的四个控制层次",
  question: "一次 turn 内的 step 循环，什么条件下继续、停止、恢复或兜底？这些判定各在哪个控制层次？",
  anchor:
    "这一步产出了工具调用或工具结果，就直接继续（短路，不再看插话）；没有才去看别的通道有没有插话，" +
    "有插话也继续；两者皆无才停。上下文超长且自动交接的次数还没用完才走恢复，用完就记成错误抛出去。" +
    "步数兜底只在最后一次迭代仍要求继续之后触发——四类出口不在同一层。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "没有停滞检测：模型反复要同一个工具时只有步数兜底。这正是 C1 闭合问题的由来，" +
    "结论与实测计数待 D4 的 mock 实验回填；本板演示只表达结构，不表达次数。",
  memory: "两条「继续」来源对一条「停止」：继续来自工具结果或插话，停止是两者皆无；恢复与兜底在环外的另外两层。",
  accept:
    "有工具结果就短路继续（不再看插话）；没有工具结果才看插话来定停止；" +
    "自动交接只在上下文超长且次数未用完时发生（用完则记错误并抛出）；" +
    "步数兜底只在最后一次迭代仍要求继续之后触发。",
  zones: [
    { id: "normal", layer: 1, title: "正常判定子机", note: "事件消费层与补充判定层：先看这一步产出了什么，再看有没有插话。" },
    { id: "recover", layer: 2, title: "异常恢复子机", note: "异常分支加上一份交接次数预算；恢复是有上限的，不是无限重试。" },
    { id: "boundary", layer: 3, title: "循环边界层", note: "循环自身的耗尽，与前两层不在同一个控制层次。" },
  ],
  nodes: [
    { id: "run", zone: "normal", label: "跑完一个 step" },
    { id: "final", zone: "normal", label: "这一步有没有产出工具调用或工具结果" },
    { id: "steering", zone: "normal", label: "别的通道有没有插话" },
    { id: "continue", zone: "normal", label: "继续：进入下一个 step", tone: "continue" },
    { id: "stop", zone: "normal", label: "停止：记一条正常结束，在循环内返回", tone: "stop" },
    { id: "except", zone: "recover", label: "这一步抛了异常" },
    { id: "handoff", zone: "recover", label: "换一个新起点（重置 anchor），带原 prompt 重试" },
    { id: "raise", zone: "recover", label: "记成错误，把异常抛给上层", tone: "error" },
    { id: "last-step", zone: "boundary", label: "最后一次迭代仍然要求继续" },
    { id: "max-steps", zone: "boundary", label: "步数用尽，抛错终止", tone: "error" },
  ],
  edges: [
    { from: "run", to: "final", zone: "normal", condition: "一个 step 跑完，产出用于判定的事件", kind: "continue" },
    {
      from: "final",
      to: "continue",
      zone: "normal",
      condition: "有工具调用或工具结果 → 直接继续，不再看插话",
      kind: "continue",
      shortCircuit: true,
    },
    { from: "final", to: "steering", zone: "normal", condition: "没有工具结果，才去看插话", kind: "continue" },
    { from: "steering", to: "continue", zone: "normal", condition: "有插话 → 继续", kind: "continue" },
    { from: "steering", to: "stop", zone: "normal", condition: "没有工具结果，也没有插话 → 停止", kind: "stop" },
    {
      from: "except",
      to: "handoff",
      zone: "recover",
      condition: "上下文超长，且自动交接的次数还没用完",
      kind: "recover",
    },
    { from: "handoff", to: "run", zone: "recover", condition: "重置起点后带原 prompt 回到下一次迭代", kind: "recover" },
    { from: "except", to: "raise", zone: "recover", condition: "次数已用完，或者根本不是上下文超长", kind: "raise" },
    { from: "continue", to: "last-step", zone: "boundary", condition: "一路继续到最后一次迭代", kind: "continue" },
    { from: "last-step", to: "max-steps", zone: "boundary", condition: "最后一次仍要求继续，步数就此用尽", kind: "raise" },
  ],
  demo: [
    { id: "d1", text: "模型返回工具调用：这一步产出了工具结果，走短路边直接继续，插话判定在这条路径上不可达。" },
    { id: "d2", text: "下一个 step 模型又返回同样的工具调用：仍然走同一条短路边，正常判定子机不收敛。" },
    { id: "d3", text: "循环里没有停滞检测，正常判定这一层自己不会停——继续与否只看有没有工具结果。" },
    { id: "d4", text: "最后一次迭代仍要求继续，步数用尽，循环边界层抛错终止。" },
  ],
  evidenceStatus: [
    { branch: "① 有工具结果就直接继续（短路）", status: "源码事实" },
    { branch: "② 没有工具结果才看插话，两者皆无才停", status: "源码事实" },
    { branch: "③ 自动交接的次数预算与抛出", status: "源码事实" },
    { branch: "④ 步数兜底", status: "源码事实" },
    { branch: "C1：真实会话中反复要工具时的分支次数", status: "待运行验证" },
  ],
  sources: [
    { label: "step 循环的判定主体", ref: "agent.py:202-309" },
    { label: "① 继续与否（看工具调用/结果）", ref: "agent.py:242" },
    { label: "② 插话判定与停止", ref: "agent.py:285-296" },
    { label: "③ 异常分支与自动交接次数预算", ref: "agent.py:243-280（预算 agent.py:246）" },
    { label: "④ 步数兜底 max_steps_reached", ref: "agent.py:309" },
  ],
};

const B5: AeRolesTopic = {
  kind: "roles",
  id: "roles-nesting",
  label: "B5",
  title: "职责三分与 turn 包含 step",
  question: "model、tool、harness 各自承担什么？turn 与 step 是什么包含关系？",
  anchor:
    "model 负责决策（产出 tool_calls 或纯文本）、Tool 负责执行、harness 负责编排与落盘；" +
    "一个 turn 里可以有多个 step——turn 是框架层的 inbound → TurnResult，step 是其中一次模型往返。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE,
  boundary:
    "停止判定不在本板重复（见 B4 step 循环），避免两块板口径漂移。" +
    "未知工具名会拿到一个占位工具并抛错，留给 hook 去恢复。",
  memory: "turn 盒子套着 step 环：外框是框架层边界，内环是可以转很多圈的模型往返。",
  accept: "决策、执行、编排三者归属正确，且 turn 包含 step。",
  participants: [
    { id: "model", lane: "model", object: "any_llm 抽象", role: "输出文本或 tool_calls", decides: "「下一步做什么」的决策者" },
    { id: "tool", lane: "tool", object: "Tool / REGISTRY / ToolExecutor（tools.py）", role: "能力注册表与执行器", decides: "「这个工具怎么执行」；名字不认识就给占位工具并抛错" },
    { id: "agent", lane: "harness", object: "Agent（agent.py）", role: "编排 step 循环、停止与 auto-handoff", decides: "「何时继续 / 停 / 重置」" },
    { id: "runner", lane: "harness", object: "ModelRunner（model_runner.py）", role: "单次模型步：重建 context、调模型、执行工具、record_chat", decides: "「一次模型往返怎么跑完并记录」" },
    { id: "framework", lane: "harness", object: "BubFramework（framework.py）", role: "turn 边界、hook 路由、save_state、collect_outbounds", decides: "「inbound → TurnResult 容器」" },
  ],
  nesting: {
    turn: "turn：一个入站消息到一份不可变结果，框架层的边界",
    step: "step：turn 内一次「模型调用 + 可能的工具执行」循环迭代",
    note: "一个 turn 通常是多 step，直到模型以纯文本收尾；harness 对 model 与 tool 的调用全部是 async。",
  },
  crossing: [
    { from: "harness", to: "model", payload: "完整 messages（读出的历史 + 本轮输入）" },
    { from: "model", to: "harness", payload: "tool_calls 或纯文本" },
    { from: "harness", to: "tool", payload: "工具执行请求（ToolExecutor）" },
    { from: "tool", to: "harness", payload: "tool_result" },
    { from: "harness", to: "harness", payload: "record_chat 落盘到 tape（工具执行之后、返回之前）" },
  ],
  hooks: [
    { name: "build_prompt", call: "改写这一 turn 发给模型的 prompt（framework.py:121）" },
    { name: "load_state", call: "给这一 turn 的初始状态（framework.py:137-138）" },
    { name: "save_state", call: "落盘状态，异常路径也会执行（framework.py:157）" },
    { name: "run_model_stream", call: "把模型这一步交给 Agent 跑（hook_impl.py:229）" },
    { name: "dispatch_outbound", call: "把出站消息交给通道（framework.py:167）" },
    { name: "continue_prompt", call: "决定下一个 step 的输入（framework.py:130）" },
    { name: "system_prompt", call: "拼接系统提示块（framework.py:388）" },
    { name: "build_tape_context", call: "定这一 turn 的 tape 读取规则（framework.py:393）" },
  ],
  sources: [
    { label: "turn 边界 process_inbound", ref: "framework.py:144" },
    { label: "step 循环编排", ref: "agent.py" },
    { label: "单次模型步：重建 context、调模型、执行工具、落盘", ref: "model_runner.py" },
    { label: "未知工具名 → 占位工具抛错", ref: "model_runner.py:504-525" },
    { label: "工具注册表与执行器", ref: "tools.py" },
  ],
};

/** 顺序即导航顺序：先 Python 迁移增量，再 Bub harness 骨架。 */
export const AE_TOPICS: AeTopic[] = [P1, P3, B1, B2, B3, B4, B5];
