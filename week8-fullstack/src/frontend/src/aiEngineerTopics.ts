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
}

/* ------------------------------------------------------------------ P1 语法映照 */

export type AeMapType = "eq" | "approx" | "new" | "py-internal";

export interface AeSyntaxTopic extends AeBase {
  kind: "syntax";
  legend: Array<{ type: AeMapType; label: string; shape: string }>;
  units: Array<{
    id: string;
    semantics: string;
    sides: Array<{ lang: "TypeScript" | "Python"; kind: string; note?: string }>;
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
  stages: Array<{ id: string; label: string; line: string; note: string }>;
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
    line: string;
    payloadBrief: string;
    metaContext: boolean;
    inMessages: boolean;
  }>;
  readStages: Array<{
    step: number;
    label: string;
    line: string;
    selectorMode: "default" | "custom";
    effect: string;
  }>;
  currentInputs: Array<{ slot: "system" | "steering" | "prompt"; label: string; line: string }>;
  writeStages: Array<{ order: number; entryKind: string; note: string }>;
  writeTriggers: Array<{ path: "tool" | "text" | "intercepted"; line: string; note: string }>;
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
  nodes: Array<{ id: string; zone: "normal" | "recover" | "boundary"; label: string; line?: string; tone?: "stop" | "continue" | "error" }>;
  edges: Array<{
    from: string;
    to: string;
    zone: "normal" | "recover" | "boundary";
    condition: string;
    line: string;
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
    "六单元的实测全部发生在 Python 侧（week12-python-rag/.venv）；TS 端点用于定位语义位置，" +
    "本周未逐条重跑 TS 侧对照实验。",
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
      semantics: "函数与类型映射",
      sides: [
        { lang: "TypeScript", kind: "function greet(name: string, title?: string): string" },
        { lang: "Python", kind: "def greet(name: str, title: str | None = None) -> str" },
      ],
      mapType: "approx",
      pitfall: "truthy 与 is None 是两种语义：语法对不等于行为一致。",
      detail:
        "greet('x','') 在 if title: 下输出「你好，x」（对齐 TS 的可选参数直觉）；" +
        "在 if title is None: 下输出「 x」——空字符串被当成「有 title」。本人两版实测对照，通过。" +
        "三元顺序是 X if cond else Y，格式化用 f-string。",
    },
    {
      id: "imports",
      semantics: "import / export 与 __init__.py",
      sides: [
        { lang: "TypeScript", kind: "index.ts 聚合导出" },
        { lang: "Python", kind: "from src.users.greet import greet / import src.users.greet / from src.users import greet" },
      ],
      mapType: "approx",
      pitfall: "__init__.py 是包标记与导出面，不是入口文件——入口是 __main__.py。",
      detail:
        "三种导入的绑定不同：第一种取到函数；第二种要走属性链；第三种在 __init__.py 为空时触发隐式" +
        "子模块回退，greet 绑定到模块对象，调用报 TypeError: 'module' object is not callable。" +
        "在 __init__.py 写 from .greet import greet 后修复，本人用 type() 验证得到 <class 'function'>。",
    },
    {
      id: "data-shape",
      semantics: "数据形状与运行时校验",
      sides: [
        { lang: "TypeScript", kind: "interface User", note: "编译期形状，运行时不拦截" },
        { lang: "Python", kind: "@dataclass", note: "只装数据，不校验（≈ interface）" },
        { lang: "Python", kind: "pydantic.BaseModel", note: "运行时拦截非法数据（≈ Mongoose）" },
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
      semantics: "异常传播与异常链",
      sides: [
        { lang: "TypeScript", kind: "业务异常包装（week2-express 的 UserValidationError）" },
        { lang: "Python", kind: "raise UserValidationError(...) from exc 与 __cause__" },
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
        { lang: "TypeScript", kind: "try / finally 手写收尾" },
        { lang: "Python", kind: "with 与 __exit__ 的语言级契约" },
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
        { lang: "TypeScript", kind: "jest：*.test.js 与 expect()（W6 测试闭环板）" },
        { lang: "Python", kind: "pytest：test_*.py + test_* 函数 + assert 关键字" },
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
  source: BUB_SOURCE + " · framework.py / turn.py",
  boundary:
    "save_state（L157 call_many）在 finally 内无条件调用，model_output 取该时刻的值（异常时是空串或半成品）；" +
    "调用了 hook 不等于持久化成功。CancelledError 一支为源码推导，运行验证属 D4。",
  memory: "finally 的罩子只盖到 _run_model——罩子的起止范围本身就是结论。",
  accept: "save_state 的 finally 只罩 _run_model，不是整个 turn；它是尝试调用，不是保证持久化成功。",
  stages: [
    { id: "resolve-session", label: "resolve_session", line: "L148", note: "首个 await 动作；L149-150 若 inbound 是 dict 则 setdefault(\"session_id\", ...)。" },
    { id: "build-state", label: "build_state", line: "L151", note: "framework.py:135-142：预置 workspace / steering_inbox，再按 reversed 顺序合并 load_state hook 的返回。" },
    { id: "build-prompt", label: "build_prompt", line: "L152", note: "framework.py:117-126：call_first；缺省取 content_of(message)。随后 L153 把 model_output 先置为空串。" },
    { id: "run-model", label: "_run_model", line: "L155", note: "framework.py:186-225：非流式走 run_model hook，流式走 run_model_stream。这是被 finally 罩住的唯一阶段（L154-163）。" },
    { id: "collect-outbounds", label: "_collect_outbounds", line: "L165", note: "收集本次 turn 的出站消息。" },
    { id: "dispatch-outbound", label: "dispatch_outbound", line: "L166-167", note: "for 循环逐条 call_many。" },
  ],
  finallyScope: {
    from: "run-model",
    to: "run-model",
    note: "try/finally 在 L154-163，只包住 L155 的 _run_model；finally 里 L157 call_many(\"save_state\", ...)。",
  },
  ends: [
    {
      id: "ok",
      label: "正常返回 TurnResult",
      path: "L168-174 构造并 return TurnResult(session_id / prompt / model_output / outbounds / state)。",
      tone: "ok",
      verified: "源码事实",
    },
    {
      id: "raise",
      label: "普通异常重抛",
      path: "内层 finally 先跑 save_state → L175 except Exception → L176 logger.exception → L177 notify_error(stage=\"turn\") → L178 raise。",
      tone: "raise",
      verified: "源码事实",
    },
    {
      id: "cancel",
      label: "取消直穿调用方",
      path: "asyncio.CancelledError 继承 BaseException，不匹配 except Exception → finally 仍落盘 → 直穿到调用方，没有 notify_error 与 logger.exception。",
      tone: "cancel",
      verified: "待运行验证",
    },
  ],
  stateNote: {
    mutable: "TurnState（turn.py:10，type TurnState = dict[str, Any]）是 turn 内流转的可变草稿纸。",
    frozen: "TurnResult（turn.py:13-21）是 frozen dataclass，不可变交付物，带 state 快照。",
  },
};

const B3: AeTapeTopic = {
  kind: "tape",
  id: "tape-context",
  label: "B3",
  title: "tape 只追加，context 每次现算",
  question: "事实先落 tape，模型每次看到的 context 为什么是「现算投影」而不是累积缓存？",
  anchor:
    "tape 是会话历史唯一的持久化真相源，只追加不修改；每次模型调用前 harness 从带子现读一份历史投影，" +
    "再并上本轮的 system、steering 与 prompt 发给模型——历史是投影，不是越存越大的记忆。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE + " · tape.py / model_runner.py",
  boundary:
    "tool_call / tool_result / error / event / system 五类 kind 不进模型 messages。" +
    "TapeEntry 的 id 在工厂方法里是 0，真正的 id 由 store append 时分配——这一条是推断，store.py 未读，待验证。",
  memory: "一卷带子、两个朝向它的口：读是快照，写是追加，二者不同时发生。",
  accept:
    "模型 messages 的历史部分等于「最近 anchor 之后按 context 规则现读的投影」；完整 messages 等于该投影加上本轮的 system、steering 与 prompt。",
  entries: [
    { id: "e-system", entryKind: "system", line: "tape.py:101-103", payloadBrief: "系统提示块", metaContext: true, inMessages: false },
    { id: "e-message", entryKind: "message", line: "tape.py:97-99", payloadBrief: "OpenAI 格式的对话消息", metaContext: true, inMessages: true },
    { id: "e-anchor", entryKind: "anchor", line: "tape.py:105-110", payloadBrief: "游标：读取从这里之后开始", metaContext: true, inMessages: false },
    { id: "e-tool-call", entryKind: "tool_call", line: "tape.py:112-114", payloadBrief: "模型发出的工具调用意图", metaContext: true, inMessages: false },
    { id: "e-tool-result", entryKind: "tool_result", line: "tape.py:116-118", payloadBrief: "工具执行结果", metaContext: true, inMessages: false },
    { id: "e-error", entryKind: "error", line: "tape.py:121-122", payloadBrief: "本轮错误记录", metaContext: true, inMessages: false },
    { id: "e-event", entryKind: "event", line: "tape.py:124-129", payloadBrief: "run 汇总：status / usage / provider / model", metaContext: true, inMessages: false },
  ],
  readStages: [
    { step: 1, label: "context.build_query", line: "tape.py:301", selectorMode: "default", effect: "按 anchor 规则定范围：LAST_ANCHOR（默认，最近 anchor 之后）/ 指定名字 / None 表示全量。" },
    { step: 2, label: "store.fetch_all", line: "tape.py:302", selectorMode: "default", effect: "按 query 从 store 取出条目。" },
    { step: 3, label: "过滤 meta[\"context\"] is not False", line: "tape.py:303", selectorMode: "default", effect: "显式标了 context=False 的条目被排除。" },
    { step: 4, label: "_default_messages 只挑 kind == \"message\"", line: "tape.py:304 → L165-173", selectorMode: "default", effect: "转成 OpenAI 兼容 messages；工具记录与事件在这一步被留在带子上。" },
    { step: 5, label: "TapeContext.select 自定义覆盖", line: "tape.py:143-157", selectorMode: "custom", effect: "传了 select 就用它替代上面的默认过滤——默认规则与自定义覆盖是两回事，不要混读。" },
  ],
  currentInputs: [
    { slot: "system", label: "system_prompt（若有）prepend 在最前", line: "model_runner.py:333-336" },
    { slot: "steering", label: "steering 消息 append 在后", line: "model_runner.py:333-336" },
    { slot: "prompt", label: "本轮 prompt append 在最后", line: "model_runner.py:333-336" },
  ],
  writeStages: [
    { order: 1, entryKind: "system", note: "本轮系统提示。" },
    { order: 2, entryKind: "context_error", note: "有 context 错误时才追加。" },
    { order: 3, entryKind: "message", note: "每条 new_messages 各追加一条。" },
    { order: 4, entryKind: "tool_call", note: "模型发出的工具调用。" },
    { order: 5, entryKind: "tool_result", note: "工具执行结果。" },
    { order: 6, entryKind: "error", note: "本轮错误。" },
    { order: 7, entryKind: "message", note: "assistant 的 response_text。" },
    { order: 8, entryKind: "event(\"run\")", note: "汇总条目：status / usage / provider / model。" },
  ],
  writeTriggers: [
    { path: "tool", line: "model_runner.py:251", note: "有工具路径：ToolExecutor 执行完之后调 record_chat。" },
    { path: "text", line: "model_runner.py:270", note: "纯文本路径：模型返回后直接调 record_chat。" },
    { path: "intercepted", line: "model_runner.py:198", note: "before_llm_call 返回 decision 拦截时，record_chat 替代真实调用。" },
  ],
  frames: [
    {
      id: "f-start",
      phase: "read",
      title: "带子现状",
      text: "tape 上已有若干条目，anchor 标出了本轮读取的起点。带子只追加，历史条目不会被改写。",
    },
    {
      id: "f-read",
      phase: "read",
      title: "读口：现读一份投影",
      text: "read_messages 走 build_query → fetch_all → 过滤 context=False → 只留 kind=message，得到历史投影；工具记录留在带子上，不进 messages。",
    },
    {
      id: "f-assemble",
      phase: "assemble",
      title: "并上本轮输入",
      text: "投影是 messages 的历史部分；再 prepend system_prompt、append steering 与本轮 prompt，才是完整 messages。两段来源不同，分区显示。",
    },
    {
      id: "f-model",
      phase: "model",
      title: "模型往返",
      text: "llm.acompletion 拿到完整 messages，返回 tool_calls 或纯文本。这一帧之后分成工具路径与纯文本路径。",
    },
    {
      id: "f-execute",
      phase: "execute",
      title: "工具路径：先执行再落盘",
      text: "ToolExecutor 执行工具，拿到结果后才调 record_chat（model_runner.py:251）。",
      path: "tool",
    },
    {
      id: "f-append-tool",
      phase: "append",
      title: "写口：按序追加（工具路径）",
      text: "record_chat 按 system → message → tool_call → tool_result → error → assistant → event(\"run\") 的顺序追加到带子右端；anchor 不变，旧条目不修改。",
      path: "tool",
    },
    {
      id: "f-append-text",
      phase: "append",
      title: "写口：纯文本路径",
      text: "不含工具执行时走 model_runner.py:270 直接 record_chat，追加序列里没有 tool_call 与 tool_result 两条。",
      path: "text",
    },
  ],
};

const B4: AeMachineTopic = {
  kind: "machine",
  id: "step-loop",
  label: "B4",
  title: "step 循环的四个控制层次",
  question: "一次 turn 内的 step 循环，什么条件下继续、停止、恢复或兜底？这些判定各在哪个控制层次？",
  anchor:
    "final 事件带 tool_calls 或 tool_results 就直接继续（短路，不再查 steering）；没有才查 steering，" +
    "有插话也继续；两者皆无才停。context 超限且 auto_handoff 预算未耗尽才走恢复，预算耗尽就记 error 并 raise。" +
    "max_steps 只在最后一次仍要求 continue、for 耗尽之后触发——四类出口不在同一层。",
  group: "Bub harness 骨架",
  evidenceKind: "源码事实",
  source: BUB_SOURCE + " · agent.py:202-309",
  boundary:
    "没有停滞检测：模型反复要同一个工具时只有 max_steps 兜底。这正是 C1 闭合问题的由来，" +
    "结论与实测计数待 D4 的 mock 实验回填；本板演示只表达结构，不表达次数。",
  memory: "两条「继续」来源对一条「停止」：继续来自工具结果或插话，停止是两者皆无；恢复与兜底在环外的另外两层。",
  accept:
    "有 tool 结果就短路 continue（不再查 steering）；没有 tool 结果才查 steering 来定 stop；" +
    "auto_handoff 只在 context 超限且预算大于 0 时发生（预算耗尽记 error 并 raise）；" +
    "max_steps 只在最后一次仍 continue、for 耗尽后触发。",
  zones: [
    { id: "normal", layer: 1, title: "正常判定子机", note: "事件消费层与补充判定层：先看 final 事件，再看 steering。" },
    { id: "recover", layer: 2, title: "异常恢复子机", note: "except 分支加 auto_handoff 预算；恢复是有预算上限的，不是无限重试。" },
    { id: "boundary", layer: 3, title: "循环边界层", note: "for 循环自身的耗尽，与前两层不在同一个控制层次。" },
  ],
  nodes: [
    { id: "run", zone: "normal", label: "_run_once：跑一个 step", line: "agent.py:220" },
    { id: "final", zone: "normal", label: "final 事件：有没有 tool_calls / tool_results", line: "agent.py:242" },
    { id: "steering", zone: "normal", label: "steering 判定：别的 channel 有没有插话", line: "agent.py:285-296" },
    { id: "continue", zone: "normal", label: "continue：进入下一 step", tone: "continue" },
    { id: "stop", zone: "normal", label: "记 loop.step status=ok 并在循环内 return", tone: "stop" },
    { id: "except", zone: "recover", label: "except：本 step 抛异常", line: "agent.py:243-280" },
    { id: "handoff", zone: "recover", label: "handoff(\"auto_handoff/context_overflow\") 重置 anchor，next_prompt = 原 prompt 重试", line: "agent.py:246" },
    { id: "raise", zone: "recover", label: "记 loop.step status=error 后 raise", tone: "error" },
    { id: "last-step", zone: "boundary", label: "最后一次迭代仍要求 continue" },
    { id: "max-steps", zone: "boundary", label: "for 耗尽 → RuntimeError(\"max_steps_reached\")", line: "agent.py:309", tone: "error" },
  ],
  edges: [
    {
      from: "run",
      to: "final",
      zone: "normal",
      condition: "一个 step 跑完，产出 final 事件",
      line: "agent.py:220",
      kind: "continue",
    },
    {
      from: "final",
      to: "continue",
      zone: "normal",
      condition: "有 tool_calls 或 tool_results → 直接继续，不再查 steering",
      line: "agent.py:242",
      kind: "continue",
      shortCircuit: true,
    },
    {
      from: "final",
      to: "steering",
      zone: "normal",
      condition: "没有 tool 结果，才求值 steering（Python or 短路）",
      line: "agent.py:285",
      kind: "continue",
    },
    {
      from: "steering",
      to: "continue",
      zone: "normal",
      condition: "有 steering 消息 → 继续",
      line: "agent.py:285-296",
      kind: "continue",
    },
    {
      from: "steering",
      to: "stop",
      zone: "normal",
      condition: "无 tool 结果且无 steering 消息 → 停止",
      line: "agent.py:286-296",
      kind: "stop",
    },
    {
      from: "except",
      to: "handoff",
      zone: "recover",
      condition: "context 长度超限且 auto_handoff 预算大于 0（MAX_AUTO_HANDOFF_RETRIES 内）",
      line: "agent.py:246",
      kind: "recover",
    },
    {
      from: "handoff",
      to: "run",
      zone: "recover",
      condition: "重置 anchor 后带原 prompt 回到下一迭代",
      line: "agent.py:243-280",
      kind: "recover",
    },
    {
      from: "except",
      to: "raise",
      zone: "recover",
      condition: "预算耗尽，或不是 context 超限的其他异常",
      line: "agent.py:243-280",
      kind: "raise",
    },
    {
      from: "continue",
      to: "last-step",
      zone: "boundary",
      condition: "继续到 for 的最后一次迭代",
      line: "agent.py:309",
      kind: "continue",
    },
    {
      from: "last-step",
      to: "max-steps",
      zone: "boundary",
      condition: "最后一次仍 continue 且 for 耗尽 → 抛 RuntimeError",
      line: "agent.py:309",
      kind: "raise",
    },
  ],
  demo: [
    { id: "d1", text: "模型返回 tool_calls：final 事件带工具结果，走短路边直接 continue，steering 判定在这条路径上不可达。" },
    { id: "d2", text: "下一 step 模型再次返回同样的 tool_calls：仍然走同一条短路边，正常判定子机不收敛。" },
    { id: "d3", text: "循环里没有停滞检测，normal 环自己不会停——继续与否只看有没有工具结果。" },
    { id: "d4", text: "最后一次迭代仍要求 continue，for 耗尽，循环边界层抛 RuntimeError(\"max_steps_reached\")。" },
  ],
  evidenceStatus: [
    { branch: "① final 事件短路 continue（L242）", status: "源码事实" },
    { branch: "② steering 补充判定与停止（L285-296）", status: "源码事实" },
    { branch: "③ auto_handoff 预算与 raise（L243-280，预算 L246）", status: "源码事实" },
    { branch: "④ max_steps 兜底（L309）", status: "源码事实" },
    { branch: "C1：真实会话中反复要工具时的分支次数", status: "待运行验证" },
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
  source: BUB_SOURCE + " · agent.py / model_runner.py / framework.py / tools.py",
  boundary:
    "停止判定不在本板重复（见 B4 step 循环），避免两块板口径漂移。" +
    "未知工具名会拿到 placeholder Tool 并抛错，供 hook 恢复（model_runner.py:504-525）。",
  memory: "turn 盒子套着 step 环：外框是框架层边界，内环是可以转很多圈的模型往返。",
  accept: "决策、执行、编排三者归属正确，且 turn 包含 step。",
  participants: [
    { id: "model", lane: "model", object: "any_llm 抽象", role: "输出文本或 tool_calls", decides: "「下一步做什么」的决策者" },
    { id: "tool", lane: "tool", object: "Tool / REGISTRY / ToolExecutor（tools.py）", role: "能力注册表与执行器", decides: "未知工具名 → placeholder Tool 抛错供 hook 恢复（model_runner.py:504-525）" },
    { id: "agent", lane: "harness", object: "Agent（agent.py）", role: "编排 step 循环、停止与 auto-handoff", decides: "「何时继续 / 停 / 重置」" },
    { id: "runner", lane: "harness", object: "ModelRunner（model_runner.py）", role: "单次模型步：重建 context、调模型、执行工具、record_chat", decides: "「一次模型往返怎么跑完并记录」" },
    { id: "framework", lane: "harness", object: "BubFramework（framework.py）", role: "turn 边界、hook 路由、save_state、collect_outbounds", decides: "「inbound → TurnResult 容器」" },
  ],
  nesting: {
    turn: "turn：一个 inbound 到 TurnResult，框架层边界（process_inbound，framework.py:144）",
    step: "step：turn 内一次「模型调用 + 可能的工具执行」循环迭代",
    note: "一个 turn 通常是多 step，直到模型以纯文本收尾；harness 对 model 与 tool 的调用全部是 async。",
  },
  crossing: [
    { from: "harness", to: "model", payload: "完整 messages（历史投影 + 本轮输入）" },
    { from: "model", to: "harness", payload: "tool_calls 或纯文本" },
    { from: "harness", to: "tool", payload: "工具执行请求（ToolExecutor）" },
    { from: "tool", to: "harness", payload: "tool_result" },
    { from: "harness", to: "harness", payload: "record_chat 落盘到 tape（工具执行之后、返回之前）" },
  ],
  hooks: [
    { name: "build_prompt", call: "framework.py:121（call_first）" },
    { name: "load_state", call: "framework.py:137-138（call_many）" },
    { name: "save_state", call: "framework.py:157（call_many，异常路径也执行）" },
    { name: "run_model_stream", call: "hook_impl.py:229" },
    { name: "dispatch_outbound", call: "framework.py:167（call_many）" },
    { name: "continue_prompt", call: "framework.py:130" },
    { name: "system_prompt", call: "framework.py:388" },
    { name: "build_tape_context", call: "framework.py:393" },
  ],
};

/** 顺序即导航顺序：先 Python 迁移增量，再 Bub harness 骨架。 */
export const AE_TOPICS: AeTopic[] = [P1, P3, B1, B2, B3, B4, B5];
