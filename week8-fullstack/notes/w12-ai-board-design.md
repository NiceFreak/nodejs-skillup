# W12 展板设计方案（施工图 v1）：`ai-engineer` tab · 七块内容

> 状态：**施工图 v1（2026-09-02）**。上游 = `w12-ai-visualization-plan.md`（草案 v0.4，四轮 review
> 通过，§4 十列与 §5 数据契约已冻结）与 `SHOWCASE-VISUAL-PROTOCOL.md`（含 2026-09-02 两条补充护栏）。
>
> 分工：上游方案定「画什么关系、结论是什么、验收句是什么」；**本文件只定「怎么画、DOM 怎么排、
> 断言怎么写」**。本文件不新增结论、不改动上游任何一列；实现期若发现必须改核心图形 / 分页 / 主路径，
> 先回写上游 §4 十列，再回写本文件。
>
> 内容源（本周 D2/D3 已冻结记录，逐条可回溯）：
> - Bub 源码 `~/Documents/bub` @ `33c417a`（detached HEAD，只读）；结论口径以
>   `week12-python-rag/notes/bub-reading-report.md` 与 `day3-bub-main-chain.md` 为准。
> - Python 语法六单元 = `week12-python-rag/notes/day2-freeze-and-baseline.md` §5「下午：语法对照单元」。
> - Express 侧真实来源 = `week2-express/src/`（行号本次已逐条核对，见 §3.2）。
>
> 范围：只新增 `week8-fullstack/src/frontend/` 展示资产（AGENTS.md 白名单）。不改学习代码、不部署、
> 不返工存量板；对共享文件（`types.ts` / `Showcase.tsx` / 两个脚本 / `styles.css`）只做加法。

---

## 0. 这份施工图要消除的不确定性

上游方案冻结到「形态 + 十列 + 数据契约」为止。直接进 JSX 会有四类决定被留在实现时随手做掉，而它们
恰恰决定这批图能不能被机器守住：

1. **几何**：哪些位置编码承担结论（B2 的 finally 罩子范围、B1 的两线共有槽位、P1/P3 的对齐线端点）。
   位置编码一旦只靠肉眼，CSS 一改就静默失效——这是 `verify-w9-board.mjs` 注释里记的第 3 类事故。
2. **选择器**：断言要读的东西必须有稳定 class 与 `data-*`。图拓扑断言（上游 §6）只有在「边」是真实
   DOM 节点且带 `data-from` / `data-to` 时才写得出来，否则会退化成查文字。
3. **手机等价**：390px 下不是把桌面列堆起来就完事（上游 §7 风险 3）。每块要明确「哪一维保留、
   哪一维改由滚动承担」。
4. **数据实例**：十列写的是形状，不是值。本文件把七块的**真实取值**逐条落定，实现只做搬运，
   避免实现期临时编词造成与笔记口径漂移。

---

## 1. 板面骨架与接线

### 1.1 tab 与分组

| 项 | 取值 |
|---|---|
| 顶层 tab id | `ai-engineer`（`ShowcaseTab` union 新增一项，加在 `interview` 之后、`notes` 之前） |
| tab 标签 | `AI 工程` |
| `reviewOnly` | 否。板上无服务器拓扑、无凭据、无个人材料，展示状态可见 |
| 组 1 | `Python 迁移增量`：P1 语法映照、P3 CLI 分发器对照 |
| 组 2 | `Bub harness 骨架`：B1 入口链、B2 turn 管线、B3 tape→context、B4 step 循环、B5 职责与层级 |
| 默认专题 | `py-syntax`（组 1 第一块） |
| 未来扩展 | W13–W16 在本 tab 内加组，不新增顶层 tab |

### 1.2 topic id 与深链

| 块 | topic id | 深链 |
|---|---|---|
| P1 语法映照 | `py-syntax` | `#/showcase?tab=ai-engineer&topic=py-syntax` |
| P3 CLI 分发器对照 | `cli-dispatch` | `#/showcase?tab=ai-engineer&topic=cli-dispatch` |
| B1 入口链（含 P2 模块执行语义） | `entry-chain` | `…&topic=entry-chain` |
| B2 turn 管线 | `turn-pipeline` | `…&topic=turn-pipeline` |
| B3 tape → context | `tape-context` | `…&topic=tape-context` |
| B4 step 循环判定 | `step-loop` | `…&topic=step-loop` |
| B5 职责与层级 | `roles-nesting` | `…&topic=roles-nesting` |

深链语义沿用既有 `AppShowcase.tsx`，不新增机制：hash 是唯一真源（刷新保留）；切 tab 由
`onTabChange` 清 topic（`updateView({ tab, topic: null })`）；未知 topic 由板内
`find(...) ?? TOPICS[0]` 回退到默认专题。**这三条都要进断言**（上游 §6「深链与状态」）。

### 1.3 页面结构（自上而下）

```
.ae-board
├── header.ae-head              组标题 + 一句话范围 + 内容源版本（33c417a）
├── .ae-nav-groups              两组导航（组名 + 该组的 topic 按钮）
│   └── nav.ae-topic-nav        按钮：label / title / evidenceKind
└── article.ae-stage            当前专题舞台
    ├── .ae-stage-title         专题号 + 标题 + 单一问题（十列①）
    ├── .ae-recall-gate         复习状态未揭示时：只给问题（主动回忆）
    └── .ae-stage-body          揭示后（或展示状态）：
        ├── .ae-anchor          10 秒结论（十列②，常驻，首屏）
        ├── <各块专属视觉舞台>    十列⑤，见 §3
        ├── .ae-boundary        边界与证据等级（常驻一行，折叠详情）
        └── details.ae-evidence 折叠层：来源行号、原始记录、待验证项
```

复习门与 W5/W9 同形：`review && !revealed` 时只渲染问题与「显示模型与证据」按钮。按钮 class
`.ae-reveal-gate button`，纳入 `verify` 脚本 `revealAll()` 的选择器列表。

### 1.4 文件清单（新增 / 修改）

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/aiEngineerTopics.ts` | 新增 | 数据层，七块的全部可枚举数据 + TS 类型（§4） |
| `src/AiEngineerBoard.tsx` | 新增 | 板组件 + 七个视觉组件 |
| `src/types.ts` | 改 | `ShowcaseTab` union 增 `"ai-engineer"` |
| `src/Showcase.tsx` | 改 | `TABS` 增一项 + tabpanel 分发增一支 |
| `src/AppShowcase.tsx` | 改 | `SHOWCASE_TABS` 数组增一项（hash 白名单，不加就回退到 auth） |
| `src/styles.css` | 改 | 新增 `.ae-*` 段，追加在文件末尾，不改任何存量选择器 |
| `scripts/verify-w9-board.mjs` | 改 | 新增 §E 段断言（§5.2）+ `SHOWCASE_TABS` 常量增一项 |
| `scripts/audit-showcase-visual.mjs` | 改 | `BOARDS` 增一行，纳入两视口采样 |

命名：跨周 tab 用中性前缀 `ae-`（ai-engineer），不用 `w12-`——W13–W16 的内容要挂在同一棵树下。

### 1.5 全局约束（七块共同）

- **无新外部依赖**。图形全部用 CSS grid / flex + 少量内联 SVG（只在需要真实斜线的 P1/P3 对齐线上用）。
- **颜色只做第二编码**：每处颜色区分同时有形状、线型、线端标记或文字标签；沿用全局图例的六类语义
  （`--viz-flow` / `--viz-resource` / `--viz-success` / `--viz-controlled` / `--viz-failure` /
  `--viz-unknown`），不引入新色。
- **字号只用既有梯子**（`--fs-b1/b2/b3`、`--fs-d1/d2`、`--fs-s1..s7`），不写死 px。
- **证据等级三档**常驻可见：`事实（源码 / 实测）`、`推断`、`待运行验证`。B2 的 `CancelledError`、
  B1 的 console wrapper、B4 的 C1 计数三处必须带 `待运行验证` 标记。
- **reduced-motion**：三块带动效的板（B3、B4，以及 B1/P3 的方位过渡）在
  `prefers-reduced-motion: reduce` 下不自动播放且信息完整；`useFramePlayer` 已内置该判定，
  静态兜底靠「末帧即全量」的画法而不是隐藏内容。
- **手机（390px）**：所有横向超宽的图（B1 序列、B2 管线、B3 带子）放进
  `overflow-x: auto` 的自有容器，页面本身不横向滚动；`.mobile-scroll-cue` 复用既有提示。

---

## 2. 七块的舞台几何（总表）

| 块 | 桌面 1440 主布局 | 手机 390 主布局 | 位置编码承担的结论 |
|---|---|---|---|
| P1 | 三列 grid：`TS 栏 (1fr) / 映射带 (150px) / Python 栏 (1fr)`，六行 | 单列：每单元一张卡，内含 TS→Python 两段 + 映射带横置 | 同一行 = 同一语义；中列线型 = 映射类型 |
| P3 | 三列 grid：`Express (1fr) / 对齐线 (170px) / typer (1fr)`，四行 + 底部失效位区 | 单列：每职责位置一张卡，成立/失效两栏并列 | 四条水平对齐线 = 四个可对应的职责位置 |
| B1 | 两列泳道（`console` / `python -m`）× 纵向时间轴；共有节点跨两列 | 两列保留（列宽压到 1fr 1fr），横向不滚动；节点内文字换行 | 跨列 = 两线共有；单列 = 该线独有；汇合点在下方跨列 |
| B2 | 六段横向管线（等宽 grid）+ 覆盖第 4 段的 finally 框 + 右端三岔 | 纵向管线（六行）+ 框只包第 4 行 + 三岔在底部 | 罩子的**起止**就是结论：只包 `_run_model` |
| B3 | 上：投影区 + 本轮输入区 → messages → model；下：tape 带（横向条目序列）+ 读口/写口 | 上下顺序不变；tape 带自身横向滚动 | 窗口 ⊂ 带子（包含）；读在上、写在下（方向） |
| B4 | 三个分区纵向堆叠：正常判定子机 / 异常恢复子机 / 循环边界 | 同上，节点内换行；边标签移到节点下方 | 分区 = 控制层次；短路边直连 continue |
| B5 | 三条泳道（model / tool / harness）+ 跨泳道连接；turn 容器框内含 step 环 | 泳道纵向堆叠；turn 容器仍为可见外框 | 外框包内环 = turn ⊃ step |

默认态屏数目标 ≤1.5 屏（1440×1000）。七块中 B4 最重，若超出，折叠层承担溢出，主路径不拆页。

---

## 3. 逐块施工图

每块给：结论锚（十列② 原文）→ 舞台 DOM → 数据实例（真实取值）→ 动效 → 折叠层 → 断言。

### 3.1 P1 · 语法映照（`py-syntax`）

**单一问题**：本周（D2）完成的六个语法单元迁到 Python 时的对应关系各是什么形态？

**结论锚（常驻，首屏）**：六个单元都有明确对应，但映射类型不同——等价 / 近似 / 新增 /
Python 内两形态；`dataclass ↔ Pydantic` 的语义源是 TS interface，属同语言两形态，不是 TS 等价。

**DOM**：

```
section.ae-map (role="table" 语义用 aria-label 代替，不用 table 标签——中列是图形不是单元格)
├── .ae-map-legend        映射类型图例：四种线型 + 文字标签
└── .ae-map-rows
    └── .ae-map-row[data-unit="fn-types"]           一行 = 一个语义单元
        ├── .ae-map-side.ts[id="ae-p1-fn-types-ts"]      TS 端点
        ├── .ae-map-link[data-from="ae-p1-fn-types-ts"]
        │                [data-to="ae-p1-fn-types-py"]
        │                [data-maptype="approx"]          中列：线型 + 类型标签
        └── .ae-map-side.py[id="ae-p1-fn-types-py"]      Python 端点
            └── .ae-map-pair                             仅 py-internal 行：栏内并列两形态框
```

映射类型的四种线型（颜色之外的第二编码）：

| mapType | 线型 | 标签 |
|---|---|---|
| `eq` | 实线双箭头 | 等价 |
| `approx` | 实线单箭头 + 端点空心 | 近似（语法对，语义有坑） |
| `new` | 虚线 + 端点方块 | Python 侧新增语言级契约 |
| `py-internal` | 中列不连 TS，改为 Python 栏内并列框 + 括号线 | Python 内两形态 |

**数据实例（六单元，全部来自 day2 §5）**：

| id | 语义单元 | TS 端点 | Python 端点 | mapType | 常驻易错点 | 折叠详情（实测） |
|---|---|---|---|---|---|---|
| `fn-types` | 函数与类型映射 | `function greet(name: string, title?: string): string` | `def greet(name: str, title: str \| None = None) -> str` | approx | truthy 与 `is None` 是两种语义，语法对 ≠ 行为一致 | `greet('x','')` 在 `if title:` 下输出「你好，x」（对齐 TS）；在 `if title is None:` 下输出「 x」（空串被当作有 title）。本人两版实测对照通过 |
| `imports` | import/export 与 `__init__.py` | `index.ts` 聚合导出 | `from src.users.greet import greet` / `import src.users.greet` / `from src.users import greet` | approx | `__init__.py` 是包标记与导出面，不是入口文件（入口是 `__main__.py`） | 三种绑定差异：第三种在 `__init__.py` 为空时触发隐式子模块回退，`greet` 绑到模块对象 → `TypeError: 'module' object is not callable`；加 `from .greet import greet` 修复后 `type()` = `<class 'function'>` |
| `data-shape` | 数据形状与校验 | `interface User`（编译期形状，运行时不拦截） | `@dataclass` ↔ `pydantic.BaseModel` | **py-internal** | 判断标准 = 运行时是否拦截非法数据：Pydantic 会（如 Mongoose），dataclass 不会（如 TS interface） | dataclass 接受 `email='not-an-email'` 直接创建；Pydantic 抛 `ValidationError`。预测偏差：`type(exc).__name__` 预测 `str`，实际 `ValidationError`——异常对象 ≠ 其字符串表示 |
| `exc-chain` | 异常传播与异常链 | 业务异常包装（`week2-express` 的 `UserValidationError`） | `raise UserValidationError(...) from exc` + `__cause__` | approx | `from exc` 把原异常挂到 `__cause__`，traceback 打「direct cause」句 | 三问验证：业务异常 = `UserValidationError`；`exc.__cause__` = 原 `ValidationError`；`__cause__.__class__.__name__` = `ValidationError`。本人独立实现 `create_user` 翻译原型通过 |
| `ctx-manager` | 资源收尾契约 | `try / finally` 手写收尾 | `with` + `__exit__` 语言级契约 | **new** | 块体无论正常 / 异常 / `return` 退出，`__exit__` 都被调用；**异常也是退出路径** | 两版对照：`return False` 版输出止于 `... → caught: boom`；`return True` 版止于 `exit: closed (exc_type=ValueError)`。差异只在 `exit` 行之后——`__exit__` 是否被调用与参数不依赖返回值。推论：repository 的 `__aexit__` 应返回 `False`（只清理、不吞异常） |
| `pytest` | 测试入口与发现规则 | jest：`*.test.js` + `expect()`（W6 测试闭环板） | pytest：`test_*.py` + `test_*` 函数 + `assert` 关键字 | approx | src layout 下需 `[tool.pytest.ini_options] pythonpath = ["."]` 才能 `from src.users...` | `pytest -v` = **6 passed**（2 smoke + 4 users）；`with pytest.raises(Exception):` 断言块内必抛；pytest-asyncio 1.4.0 默认 `mode=STRICT`（async 测试需显式 `@pytest.mark.asyncio`） |

**边界（常驻一行）**：六单元的实测全部发生在 Python 侧（`week12-python-rag/.venv`，Python 3.12.10）；
TS 端点用于定位语义位置，本周未逐条重跑 TS 侧对照实验。

**动效**：无过程动画。hover / focus 某一端点时高亮同一行的另一端点与中列连线（方位过渡，120ms）。
键盘可达：端点是 `button`，`:focus-visible` 触发同样的高亮，不做 hover-only。

**断言**（§5.2 E-P1）：六行都在；每行 `.ae-map-link` 的 `data-from` / `data-to` 指向的 id 在页面上
**真实存在**（不是只查标签文字）；`data-shape` 行的 `data-maptype="py-internal"` 且该行 Python 栏含
两个 `.ae-map-pair > *`；图例四类齐全；六行的行首在同一列 x（几何：`.ae-map-side.ts` 的 left 全等）。

### 3.2 P3 · CLI 分发器对照（`cli-dispatch`）

**单一问题**：同一个「前置处理 → 分发 → 上下文 → 处理函数」形状，在 Express 与 typer 里各如何实现？
对应到哪、失效在哪？

**结论锚**：Express 的中间件 / 路由模型是理解 typer 的**脚手架**——四个职责位置可对应，但每对都有
成立点与失效点，不是严格同构。

**DOM**：

```
section.ae-align
├── .ae-align-head        两侧宿主标签：Express (Node) / typer (Python)
├── .ae-align-rows
│   └── .ae-align-row[data-pos="1"]
│       ├── .ae-align-side.express[id="ae-p3-1-express"]   节点 + 真实来源行
│       ├── .ae-align-link[data-from=…][data-to=…]         对齐线（SVG 直线 + 两端标记）
│       │   ├── .ae-align-holds  「成立」标签
│       │   └── .ae-align-fails  「失效」标签
│       └── .ae-align-side.typer[id="ae-p3-1-typer"]
└── .ae-align-void        底部失效位区：Express 有、typer 无对应物的两项 + 运行模型差异
```

线端标记：成立端 = 实心圆；失效端 = 短横杠（非隐喻符号，与成立端形状不同，不靠颜色）。

**数据实例（四个职责位置，行号 2026-09-02 已核对）**：

| # | 职责位置 | Express 侧（`week2-express/src`） | typer 侧（bub @ 33c417a） | 成立点 | 失效点 |
|---|---|---|---|---|---|
| 1 | 全局前置 | `app.js:19` 请求日志中间件（生成 requestId 后 `next()`） | `framework.py:105-112` `@app.callback` `_main`（`--workspace` option；L112 `ctx.obj = self`） | 都在具体处理函数之前对每次调用统一执行，并可把共享对象挂上下文 | Express 中间件可叠多层、可不调 `next()` 直接终止链路；typer 的 callback 每进程一次，不能拦截命令分发 |
| 2 | 处理注册 | `app.js:100` `app.use('/auth', authRouter)` + `routes/auth.js:9` `router.post('/register', …)` | `hook_impl.py:248` `app.command("run")(cli.run)` | 都是「把名字绑到处理函数」的注册表写入，注册发生在分发之前 | Express 是两级（router 挂载 + 方法×路径），同一路径按 HTTP 方法分叉；typer 只有命令名一级，没有方法维度 |
| 3 | 入站解析 | `app.js:83` `express.json()` | typer 按 `cli.py` `run()` 签名把 argv 映射为参数（位置参数 / `--option`） | 都把原始入站内容变成处理函数可直接用的结构化输入 | `express.json()` 是可插拔中间件（可换、可不装）；typer 的映射由函数签名与类型注解静态决定，不是中间件 |
| 4 | 处理函数 + 上下文 | `controllers/auth.js:3` `registerController(req, res, next)` | `cli.py:38-67` `run(ctx, …)` + `cli.py:48` `ctx.ensure_object(BubFramework)` | 都从上下文取共享依赖再执行业务 | HTTP 每请求独立 `req`/`res` 生命周期、`res` 是必须回写的出口；CLI 是一次 argv 的进程，无 `res`，出口是 stdout 与退出码 |

**底部失效位（typer 无对应物）**：

- `app.js:103` 404 catch-all 与 `app.js:110` error handler 是 Express 管线的收口，typer 侧无对应物。
- 运行模型：Node 常驻 libuv 事件循环，Express 只注册回调；Python 无常驻循环，`cli.py:61`
  `asyncio.run(_run())` 在同步函数内显式起一个循环并运行到结束。

**边界（常驻）**：本板不宣称严格同构；「Express 是理解 typer 的脚手架」这句由本人 D3 用 Express 词汇
收口、AI 验收通过（day3 §额外经验）。页面上不出现虚构的 `/run` 路由。

**动效**：无过程动画。hover / focus 一侧节点时点亮该行对齐线与对侧节点。

**断言**（E-P3）：四行对齐存在；每行同时含「成立」与「失效」文本节点；`data-from`/`data-to` 端点 id
真实存在；页面含 `hook_impl.py:248`、`routes/auth.js:9`、`app.js:19`、`app.js:83`、`app.js:100`、
`framework.py:105-112`、`cli.py:48` 这些真实来源串；**页面不含 `/run` 路由字样**；底部失效位两项在页。

### 3.3 B1 · 入口链（`entry-chain`，含 P2 模块执行语义）

**单一问题**：`bub` 命令与 `python -m bub` 两条启动路径如何汇到同一个 `app()`？模块归属与执行时机
如何分工？

**结论锚**：两条路径的模块级执行一致——都先执行 `__main__.py:43`（建 app）；差异只在**谁调用
`app()`**：console script 由安装生成的 wrapper 调用，`python -m` 由 `__main__.py:46` 的
`if __name__ == "__main__"` 门调用。汇合后同样走 typer 分发 → `cli.run` → `process_inbound`。

**DOM**：

```
section.ae-entry
├── .ae-entry-lanes            两列表头：console script / python -m
├── .ae-entry-track            纵向时间轴（grid，两列）
│   ├── .ae-entry-node[data-owner="console"]     只占左列
│   ├── .ae-entry-node[data-owner="python-m"]    只占右列
│   ├── .ae-entry-node[data-owner="both"]        grid-column: 1 / -1（跨两列 = 两线共有）
│   └── .ae-entry-join[data-edge="join"]         汇合点 app()，跨两列，带上收口线
├── .ae-entry-after            汇合后的单链：typer 分发 → cli.run → process_inbound
└── .ae-entry-timing           P2 语义块：import 即执行 / __name__ 门（含实测证据）
```

`data-owner="both"` 的节点跨列，是本板唯一承担结论的位置编码：**共有 = 跨列，独有 = 单列**。

**数据实例（节点，源码事实，行号来自 day3 §上午 与 报告 §1）**：

| 顺序 | 节点 | 来源 | owner | 动作 |
|---|---|---|---|---|
| 1 | `[project.scripts] bub = "bub.__main__:app"` | `pyproject.toml:47-48` | console | 入口声明（打包配置，非运行代码） |
| 2 | console wrapper 导入 `bub.__main__` 取 `app` | 安装生成 | console · **待运行验证** | wrapper 的生成与调用形态本周未运行核实 |
| 3 | 解释器把 `bub/__main__.py` 作为 `__main__` 执行 | Python 语义 | python-m | `-m` 路径的模块加载 |
| 4 | `app = create_cli_app()` | `__main__.py:43` | **both** | 模块级语句，import / 运行即执行 |
| 4a | `BubFramework()` 实例化 | `__main__.py:30` → `framework.py:50-61` | both（折叠） | 持有 PluginManager / HookRuntime / AgentHooks / ChannelRouter / TapeStore / SteeringInbox |
| 4b | `framework.load_hooks()` | `__main__.py:31` → `framework.py:75-99` | both（折叠） | builtin 先注册、entry-point 插件后注册 |
| 4c | `framework.create_cli_app()` | `__main__.py:32` → `framework.py:101-115` | both（折叠） | L103 建 `typer.Typer(name="bub")`；L105-112 `@app.callback`；L114 `call_many_sync("register_cli_commands")` |
| 4d | `app.command("run")(cli.run)` | `hook_impl.py:248` | both（折叠） | 命令注册（hook 实现内） |
| 5 | wrapper 调用 `app()` | 安装生成 | console · **待运行验证** | 调用者 = wrapper |
| 6 | `if __name__ == "__main__": app()` | `__main__.py:45-46` | python-m | 调用者 = `__name__` 门 |
| 7 | **汇合点 `app()`** | `typer.Typer` 实例 | join | typer 读 `sys.argv` 分发 |
| 8 | `run()` 命令回调 | `builtin/cli.py:38-67` | 汇合后 | L48 `ctx.ensure_object(BubFramework)`；L49-55 构造 `ChannelMessage` |
| 9 | `asyncio.run(_run())` | `cli.py:61` | 汇合后 | 同步函数内显式起事件循环 |
| 10 | `async with framework.running()` | `cli.py:58` | 汇合后 | 起 tape store / steering inbox |
| 11 | `process_inbound(inbound)` | `cli.py:59` | 汇合后 | **第一次 turn 触发点** |

**P2 模块执行语义块（并入本板，含 D3 实测）**：

- 模块顶层代码在 import 时执行；`__main__.py:43` 位于 `if` 外，故 import 即执行初始化。
- `if __name__ == "__main__"` 只区分「直接运行 vs 被 import」，对应 Node CommonJS `require.main === module`。
- 实测（2026-09-02，`week12-python-rag/.venv/bin/python`，临时脚本已删）：
  `python src/tmp_main.py`（内部 `import tmp_mod`）→ 输出 `module loaded` + `done`，**无** `running as main`；
  `python src/tmp_mod.py` → 输出 `module loaded` + `running as main`。门的开合由 `__name__` 取值决定。

**折叠层**：先答后对的三处偏差（`app` 是返回值不是函数对象；参数解析在 L46 的 `app()` 不在 L32；
`BubFramework` 是类、实例化不触发 turn，触发点在 `cli.py:59`）；构建后端 = hatchling（`pyproject.toml:66-68`）。

**动效**：静态为主。hover / focus 某条启动线的表头时，高亮该线独有节点并淡化对侧（方位过渡），
共有节点两态都保持高亮——这条视觉规则本身表达「共有」。不自动播放。

**断言**（E-B1）：两列表头存在；`data-owner="both"` 节点的宽度 ≈ 两列总宽（几何断言：其
`getBoundingClientRect().width` ≥ 单列节点宽度的 1.8 倍）；`__main__.py:46` 节点的 `data-owner`
= `python-m`；存在 `data-edge="join"` 的汇合节点且文本含 `app()`；wrapper 两个节点带「待运行验证」
标签；页面含 `cli.py:59` 与 `process_inbound`。

### 3.4 B2 · turn 管线与 finally 作用域（`turn-pipeline`）

**单一问题**：一次 turn 的管线阶段顺序、`save_state` 的保证范围、结束异常怎么分叉？

**结论锚**：阶段顺序固定；**进入 `_run_model` 之后**，无论正常、普通异常还是取消，都会尝试调用
`save_state`（`finally` 只罩 `_run_model`，更早阶段的异常不经过它）；「尝试调用」不等于「持久化成功」。

**DOM**：

```
section.ae-pipe
├── .ae-pipe-track            六段等宽 grid（桌面横向 / 手机纵向）
│   └── .ae-pipe-stage[data-stage="run-model"]
├── .ae-pipe-scope[data-scope-from="run-model"][data-scope-to="run-model"]
│                             finally 罩子：grid-column 精确落在第 4 段
├── .ae-pipe-ends             右端三岔
│   └── .ae-pipe-end[data-tone="ok|raise|cancel"][data-verified="true|false"]
└── .ae-pipe-state            TurnState（可变草稿纸）vs TurnResult（frozen 交付物）
```

罩子用 grid 定位而非绝对定位：`.ae-pipe-scope { grid-column: 4 / 5; }` 与阶段共享同一 grid，
CSS 一改列数，罩子会跟着错位并被几何断言抓住。

**数据实例（阶段，framework.py）**：

| # | 阶段 | 行 | 说明 |
|---|---|---|---|
| 1 | `resolve_session` | L148 | 首个 await 动作；L149-150 若 inbound 是 dict 则 `setdefault("session_id", …)` |
| 2 | `build_state` | L151 → L135-142 | 预置 workspace / steering_inbox + 合并 `load_state` hook 返回（reversed 顺序 merge） |
| 3 | `build_prompt` | L152 → L117-126 | `call_first`；缺省取 `content_of(message)`。此前 L153 `model_output = ""` 先置空 |
| 4 | `_run_model` | L155 → L186-225 | **被 finally 罩住的唯一阶段**（L154-163）；非流式走 `run_model` hook，流式走 `run_model_stream` |
| 5 | `_collect_outbounds` | L165 | 收集出站 |
| 6 | `dispatch_outbound` | L166-167 | for 循环逐条 `call_many` |

**三岔（结束分支）**：

| tone | 分支 | 路径 | verified |
|---|---|---|---|
| `ok` | 正常 | L168-174 构造并 return `TurnResult` | 事实（源码） |
| `raise` | 普通异常 | 内层 finally 先跑 `save_state` → L175 `except Exception` → L176 `logger.exception` → L177 `notify_error(stage="turn")` → L178 `raise` | 事实（源码） |
| `cancel` | 取消 | `asyncio.CancelledError` 继承 `BaseException`、不匹配 `except Exception` → finally 仍落盘 → 直穿调用方，**无** `notify_error` / `logger.exception` | **待运行验证（D4）** |

**常驻边界**：`save_state`（L157 `call_many`）在 finally 内无条件调用，`model_output` 取该时刻值
（异常时为空串或半成品）；「调用了 hook」≠「持久化成功」。

**折叠层**：`TurnState`（`turn.py:10`，`type TurnState = dict[str, Any]`，可变 dict，turn 内草稿纸）
与 `TurnResult`（`turn.py:13-21`，frozen dataclass，含 state 快照）的区别；本人初答只列 2 条结束分支、
漏取消路径、行号偏 1-3 行的留痕。

**动效**：静态。hover / focus 三岔中的一支时高亮对应路径（方位过渡）。不自动播放。

**断言**（E-B2）：六段在页且顺序正确；`.ae-pipe-scope` 的左边界 ≥ 第 4 段左边界 − 2px 且右边界
≤ 第 4 段右边界 + 2px（**几何断言：罩子只盖一段**）；三岔各一个且 `cancel` 支带 `data-verified="false"`
与「待运行验证」文字；页面含「尝试调」而非「保证持久化」措辞。

### 3.5 B3 · tape 追加 vs context 重建（`tape-context`，重点板）

**单一问题**：事实先落 tape，模型每次看到的 context 为何是「现算投影」而非累积缓存？

**结论锚**：tape 是会话历史的唯一持久化真相源、只追加不修改；每次模型调用前 harness 从带子现读历史
投影，再并入本轮 system / prompt / steering 后发给模型——历史是投影，不是越存越大的记忆。

**DOM**：

```
section.ae-tape
├── .ae-tape-upper                     模型输入的组装（上半）
│   ├── .ae-tape-projection            「tape 投影区」：只含 kind=message 的条目
│   ├── .ae-tape-current               「本轮输入区」：system / steering / prompt
│   └── .ae-tape-model                 → llm.acompletion
├── .ae-tape-band                      带子（下半，横向条目序列，overflow-x:auto）
│   └── .ae-tape-entry[data-kind="…"][data-context="true|false"][data-filtered]
├── .ae-tape-port.read[data-dir="read"]    读口：带子 → 投影区（向上）
├── .ae-tape-port.write[data-dir="write"]  写口：模型返回 → 带子右端（向下追加）
└── .ae-tape-frames                    FrameTransport + FrameNarration
```

被过滤的条目保留在带子里但加 `data-filtered` 并降饱和 + 加斜线纹（形状第二编码），标签写明
「不进模型 messages」。**投影区与本轮输入区是两个并列的分区**，各自有可见标题——这是本板最容易被
读错的地方，也是断言重点。

**数据实例**：

- 带子条目 kind（`tape.py:84-129`，7 个工厂方法）：`message`(L97-99) / `system`(L101-103) /
  `anchor`(L105-110) / `tool_call`(L112-114) / `tool_result`(L116-118) / `error`(L121-122) /
  `event`(L124-129)。全部 frozen dataclass，只追加不修改（模块 docstring「Append-only tape」）。
- 读链（`tape.py:300-307`，由 `model_runner.py:322` 在每次模型调用**前**触发）：
  L301 `context.build_query`（anchor 规则：`LAST_ANCHOR` 默认 = 最近 anchor 之后 / 具体名 / `None` = 全量）
  → L302 `store.fetch_all` → L303 过滤 `entry.meta["context"] is not False`
  → L304 → `_default_messages`(L165-173) **只挑 `kind == "message"`** → OpenAI 兼容 messages。
  自定义 `TapeContext.select`（`tape.py:143-157`）可覆盖默认过滤——**与默认规则分开标注**。
- 本轮输入区（`model_runner.py:333-336`）：prepend `system_prompt`（若有）→ append steering + 当前 prompt。
- 写链（`record_chat`，`model_runner.py:359-389` → `tape.py:323-366`）一次按序追加：
  `system` → [`context_error`] → 每条 `new_messages`(message) → `tool_call` → `tool_result` → `error`
  → assistant message(response_text) → `event("run", {status/usage/provider/model})`。
  触发点：`model_runner.py:251`（有工具路径）/ `:270`（纯文本路径）/ `:198`（`before_llm_call`
  返回 decision 拦截时，record_chat 替代真实调用）。

**动效（本板唯一的真实时序过程）**——帧序列，`useFramePlayer` + `dwellByText`：

| 帧 | 内容 | 标注 |
|---|---|---|
| 1 | 带子现状：若干条目，anchor 标出 | 起点 |
| 2 | **read**：build_query(anchor) → fetch_all → 过滤 `meta.context=False` → 只留 `message` | 读口发光，投影区逐条填充；被过滤条目在带子上打斜线 |
| 3 | 组装本轮输入：投影 + system + steering + prompt → messages | 两区并列合成，边界线仍在 |
| 4 | 模型往返 `llm.acompletion` | 返回 tool_calls 或纯文本，分岔 |
| 5a | **工具路径**：ToolExecutor 执行 → `record_chat`（L251） | 帧内标「工具路径」 |
| 5b | **纯文本路径**：`record_chat`（L270） | 帧内标「纯文本路径，不含工具执行」 |
| 6 | **append**：按 record_chat 顺序追加到带子右端；anchor 不变、旧条目不修改 | 写口发光，带子变长 |

reduced-motion：不自动播放，直接呈现末帧（带子已追加、投影区已填充、两区标签齐全），信息不缺。

**常驻边界**：`tool_call` / `tool_result` / `error` / `event` / `system` 五类 kind 不进模型 messages；
TapeEntry 的 id 在工厂方法中为 0，真正 id 由 store append 时分配（**推断**，`store.py` 未读，待验证）。

**断言**（E-B3）：`.ae-tape-projection` 与 `.ae-tape-current` **同时存在**且各带可见标题；带子上
`data-kind="tool_call"` 的条目带 `data-filtered`；页面同时出现「默认」过滤规则与「`select` 可覆盖」
两段说明；读口 `data-dir="read"` 与写口 `data-dir="write"` 各一个，且读口在带子上方、写口在带子下方
（几何：读口 top < 带子 top < 写口 top）；帧序里 read 帧的 index < model 帧 < append 帧
（**动画帧序断言**，读 `.ae-tape-frames` 的 `data-frame` 值）；带子横向可滚而页面不横向溢出。

### 3.6 B4 · Agent step loop 判定（`step-loop`，四控制层次）

**单一问题**：一次 turn 内的 step 循环，什么条件下继续、停止、恢复或兜底？这些判定各在哪个控制层次？

**结论锚**：正常判定里，final 事件带 `tool_calls` 或 `tool_results` → **直接继续**（短路，不再查
steering）；否则才查 steering，有插话也继续；两者皆无才停。context 超限**且** auto_handoff 预算未耗尽
才走恢复（耗尽则记 error 并 raise）。`max_steps` 只在最后一次仍要求 continue、for 耗尽后触发——
四类出口不在同一层。

**DOM**：

```
section.ae-machine
├── .ae-zone.normal[data-layer="1"]     正常判定子机
│   ├── .ae-node[data-node="run"|"final"|"continue"|"steering"|"stop"]
│   └── .ae-edge[data-from="final"][data-to="continue"][data-shortcircuit="true"]
├── .ae-zone.recover[data-layer="2"]    异常恢复子机（含预算）
│   └── .ae-edge[data-from="except"][data-to="handoff"][data-condition="context 超限 且 预算>0"]
├── .ae-zone.boundary[data-layer="3"]   循环边界层
│   └── .ae-edge[data-from="last-step"][data-to="max-steps"][data-condition="最后一次仍 continue"]
├── .ae-machine-demo                    C1 演示（FrameTransport）
└── .ae-machine-evidence                逐分支证据状态
```

三个分区各有可见分区标题与外框，节点不共享外框——**分区本身是记忆锚**，不能把四类出口压成同一节点
下的四岔。

**数据实例（`agent.py` L202-309）**：

| 层 | 判定 | 行 | 条件 → 结果 |
|---|---|---|---|
| ① 事件消费 | final 事件 | L242 | `should_continue = bool(tool_calls or tool_results)` → True 时**短路 continue**，不再查 steering |
| ② 补充判定 | steering | L285-296 | `should_continue or= _has_steering_messages(...)`（Python `or` 短路，故仅在 ① 为 False 时求值）→ True 则 continue；False 则记 `loop.step status=ok` 并在循环内 return |
| ③ 异常恢复 | except | L243-280（预算 L246） | context length 超限 **且** `auto_handoff_remaining > 0` → `handoff("auto_handoff/context_overflow")` 重置 anchor → `next_prompt = prompt` 重试（`MAX_AUTO_HANDOFF_RETRIES` 内）；预算耗尽或其他异常 → 记 `loop.step status=error` → `raise` |
| ④ 循环边界 | for 耗尽 | L309 | 最后一次迭代仍要求 continue、for 耗尽 → `RuntimeError("max_steps_reached")` |

**C1 演示（结构演示，非实测计数）**：模型反复产出同一 tool_call → 每次走 ① 的短路 continue →
最后一步仍 continue → ④ 触发 `RuntimeError`。演示帧固定标注「相对示意；C1 mock 实测（D4）后回填
实测计数」。**不预填任何数字**，`evidenceStatus` 字段逐分支给：① ② ③ ④ 均为「源码事实」，
C1 计数为「待运行验证（D4）」。

**常驻边界**：无停滞检测——模型反复要工具时只有 `max_steps` 兜底（对照 `week7-ai` 计划的停滞判据）；
这是 C1 闭合问题的由来，结论待 D4 实验。

**动效**：语义过程（step 流经判定），可暂停 / 单步 / 重放；reduced-motion 下退为三分区静态拓扑，
分区、节点、边条件全部可读。

**断言**（E-B4）：三个 `.ae-zone` 存在且 `data-layer` 为 1/2/3；存在
`data-from="final"][data-to="continue"][data-shortcircuit="true"]` 的边；**steering 节点不在该短路边
的下游**（断言短路边的 `data-to` 不等于 `steering`）；stop 边的 `data-condition` 同时含「无 tool 结果」
与「无 steering」；handoff 边的 `data-condition` 含预算条件；`max-steps` 边的 `data-condition` 含
「最后一次仍 continue」；C1 演示区含「相对示意」与「待运行验证」；页面不含任何未标来源的实测数字。

### 3.7 B5 · 职责泳道与 turn ⊃ step（`roles-nesting`）

**单一问题**：model / tool / harness 各自承担什么？turn 与 step 是什么包含关系？

**结论锚**：model 决策（产出 tool_calls）、Tool 执行、harness 编排与落盘；一个 turn 含多个 step
（turn ⊃ step）。停止判定不在本板重复（见 B4），避免两板口径漂移。

**DOM**：

```
section.ae-roles
├── .ae-roles-lanes
│   └── .ae-lane[data-role="model|tool|harness"]   泳道（归属）
│       └── .ae-lane-action[data-owner=…]
├── .ae-nest                                        嵌套容器
│   ├── .ae-nest-turn[data-level="turn"]            turn 外框：process_inbound → TurnResult
│   │   └── .ae-nest-step[data-level="step"]        step 环：模型调用 + 可能工具执行
└── .ae-roles-crossing                              跨泳道连接（带载荷标签）
```

嵌套用真实 DOM 嵌套（`.ae-nest-step` 是 `.ae-nest-turn` 的子节点），几何断言据此检查「内框完整落在
外框内」——包含关系不能只靠画一个圆。

**数据实例（职责归属表，报告 §5）**：

| 泳道 | 对象 | 角色 | 决定什么 |
|---|---|---|---|
| model | any_llm 抽象 | 输出文本或 tool_calls | 「下一步做什么」的决策者 |
| tool | `Tool` / `REGISTRY` / `ToolExecutor`（`tools.py`） | 能力注册表与执行器 | 未知工具名 → placeholder Tool 抛错供 hook 恢复（`model_runner.py:504-525`） |
| harness | `Agent`（`agent.py`） | 编排 step 循环 / 停止 / auto-handoff | 「何时继续 / 停 / 重置」 |
| harness | `ModelRunner`（`model_runner.py`） | 单次模型步：重建 context / 调模型 / 执行工具 / record_chat | 「一次模型往返怎么跑完并记录」 |
| harness | `BubFramework`（`framework.py`） | turn 边界 / hook 路由 / save_state / collect_outbounds | 「inbound → TurnResult 容器」 |

**跨泳道连接（带载荷）**：harness → model：messages（投影 + 本轮输入）；model → harness：tool_calls
或纯文本；harness → tool：执行请求；tool → harness：tool_result；harness → tape：`record_chat` 落盘。
时序事实：tool 执行在模型调用之后、落盘之前；harness 对 model 与 tool 的调用全部 async。

**折叠层**：hook 主链调用点（`build_prompt` framework L121 `call_first` / `load_state` L137-138 /
`save_state` L157 / `run_model_stream` hook_impl L229 / `dispatch_outbound` L167 / `continue_prompt`
L130 / `system_prompt` L388 / `build_tape_context` L393）。

**动效**：静态；方位过渡只用于专题切换。

**断言**（E-B5）：三条泳道存在且 `data-role` 齐全；`.ae-nest-step` 是 `.ae-nest-turn` 的后代
（DOM 断言）且其外接矩形完整落在 turn 外框内（**几何断言**）；跨泳道连接 ≥5 条且各带载荷标签；
页面含 placeholder Tool 边界句；**本板不出现停止判定条件文字**（口径不与 B4 重复）。

---

## 4. 数据层（`aiEngineerTopics.ts`）

与上游 §5 的可枚举契约一一对应。共同基类沿用 W5 的三层证据口径。

```ts
export type AeGroup = "Python 迁移增量" | "Bub harness 骨架";
export type AeEvidence = "源码事实" | "本人实测" | "推断" | "待运行验证";

export interface AeBase {
  id: string;            // = topic id（深链）
  label: string;         // 组内序号标签，如「P1」
  title: string;
  question: string;      // 十列①
  anchor: string;        // 十列②：10 秒结论
  group: AeGroup;
  evidenceKind: AeEvidence;
  source: string;        // 内容源（文件 + 版本）
  boundary: string;      // 常驻边界句
  memory: string;        // 十列⑦：视觉记忆点
  accept: string;        // 十列⑩：验收句（人工闸 expected answer）
}

export interface AeSyntaxTopic extends AeBase {
  kind: "syntax";
  units: Array<{
    id: string;
    semantics: string;
    sides: Array<{ lang: "TypeScript" | "Python"; kind: string; note?: string }>;
    mapType: "eq" | "approx" | "new" | "py-internal";
    pitfall: string;
    detail: string;
  }>;
}

export interface AeAlignTopic extends AeBase {
  kind: "align";
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

export interface AeEntryTopic extends AeBase {
  kind: "entry";
  nodes: Array<{
    id: string; module: string; line: string; action: string;
    lineOwner: "console" | "python-m" | "both" | "after-join";
    verified: AeEvidence; detail?: string;
  }>;
  edges: Array<{ from: string; to: string; type: "flow" | "split" | "join" }>;
  timing: { rule: string; experiments: Array<{ command: string; output: string; reading: string }> };
}

export interface AePipelineTopic extends AeBase {
  kind: "pipeline";
  stages: Array<{ id: string; label: string; line: string; note: string }>;
  finallyScope: { from: string; to: string; note: string };
  ends: Array<{ id: string; label: string; path: string; tone: "ok" | "raise" | "cancel"; verified: AeEvidence }>;
  stateNote: { mutable: string; frozen: string };
}

export interface AeTapeTopic extends AeBase {
  kind: "tape";
  entries: Array<{ id: string; kind: string; line: string; payloadBrief: string; metaContext: boolean; inMessages: boolean }>;
  readStages: Array<{ step: number; label: string; line: string; selectorMode: "default" | "custom"; effect: string }>;
  currentInputs: Array<{ kind: "system" | "prompt" | "steering"; label: string; line: string }>;
  writeStages: Array<{ order: number; kind: string; note: string }>;
  writeTriggers: Array<{ path: "tool" | "text" | "intercepted"; line: string; note: string }>;
  frames: Array<{ id: string; phase: "read" | "assemble" | "model" | "execute" | "append"; text: string; path?: "tool" | "text" }>;
}

export interface AeMachineTopic extends AeBase {
  kind: "machine";
  zones: Array<{ id: "normal" | "recover" | "boundary"; layer: 1 | 2 | 3; title: string; note: string }>;
  nodes: Array<{ id: string; zone: string; label: string; line?: string }>;
  edges: Array<{
    from: string; to: string; zone: string; condition: string; line: string;
    shortCircuit?: boolean; kind: "continue" | "stop" | "recover" | "raise";
  }>;
  demo: Array<{ id: string; text: string }>;      // C1 结构演示帧（无实测数字）
  evidenceStatus: Array<{ branch: string; status: AeEvidence }>;
}

export interface AeRolesTopic extends AeBase {
  kind: "roles";
  participants: Array<{ id: string; lane: "model" | "tool" | "harness"; object: string; role: string; decides: string }>;
  nesting: { turn: string; step: string; note: string };
  crossing: Array<{ from: string; to: string; payload: string }>;
  hooks: Array<{ name: string; call: string }>;
}

export type AeTopic =
  | AeSyntaxTopic | AeAlignTopic | AeEntryTopic
  | AePipelineTopic | AeTapeTopic | AeMachineTopic | AeRolesTopic;

export const AE_TOPICS: AeTopic[] = [ /* 七块，顺序 = 导航顺序 */ ];
```

纪律（沿用 `w5Topics.ts`）：数据层只放**已验收的事实与已标注等级的推断**；未完成内容不提前造结论；
每条带来源；不在组件里硬编码任何内容字符串。

---

## 5. 验收

### 5.1 机器闸（命令）

```bash
cd week8-fullstack/src/frontend
yarn typecheck
yarn build:showcase
yarn verify:board          # 存量 1070 项 + 本批新增，必须全绿
yarn audit:visual          # 两视口几何采样
```

`verify:board` 的存量基线 = **1070 项，0 失败**（本次施工前已复跑确认）。新增断言只增不改存量。

**实测结果（2026-09-02）**：`typecheck` 通过；`build:showcase` 通过；`verify:board` = **1189 项，
0 失败**（1070 存量 + 119 新增，含 §6.0 换层后新增的 E-S 组）；`audit:visual` 采样 172 个视口专题
状态，本板七块两视口 `horizontalOverflow` 全为 0。

施工期发现并修掉的两处断言/夹具问题，记在这里免得下次再撞：

1. `TAB_COUNT` 是写死的夹具（展示 8 / 复习 12），加第 13 个 tab 后 14 条 tab 条几何断言全红。
   已改为 9 / 13，并在旁边留注释说明「加一块板就在这里 +1」。
2. 「B2 口径是尝试调而非保证持久化」最初写成「页面不得出现『保证持久化成功』」，但页面上正确的
   那句话（「尝试调用」不等于「持久化成功」）本身就含这个词，断言假红。改成正向查两段口径。

### 5.2 新增断言清单（`verify-w9-board.mjs` §E）

| 编号 | 断言 | 类型 |
|---|---|---|
| E-0a | `tab=ai-engineer` 可达；七个 topic 深链各自渲染出对应舞台 | 深链 |
| E-0b | 未知 topic（`topic=not-a-topic`）回退到 `py-syntax` 且不报错 | 深链回退 |
| E-0c | 切到别的 tab 再切回来，topic 被清空（不跨板串号） | 状态 |
| E-P1 | 六单元在页；连线 `data-from`/`data-to` 端点 id 真实存在；`data-shape` 行为 `py-internal` 且 Python 栏两形态框；四类图例齐全；六行行首同列（几何） | 图拓扑 + 几何 |
| E-P3 | 四行对齐；每对含「成立」「失效」；七处真实来源串在页；无 `/run` 字样；底部失效位两项 | 图拓扑 + 事实 |
| E-B1 | `both` 节点跨两列（几何：宽度 ≥ 单列 1.8 倍）；L46 节点 owner = `python-m`；join 节点含 `app()`；wrapper 节点带「待运行验证」 | 几何 + 图拓扑 |
| E-B2 | 六段顺序正确；finally 罩子左右边界只覆盖第 4 段（几何 ±2px）；三岔齐全且 cancel 支 `data-verified="false"`；措辞是「尝试调」 | 几何 |
| E-B3 | 投影区与本轮输入区同时存在且各有标题；`tool_call` 条目带 `data-filtered`；默认过滤与 `select` 覆盖分开说明；读口在带上方、写口在带下方（几何）；帧序 read < model < append | 图拓扑 + 几何 + 帧序 |
| E-B4 | 三分区 `data-layer` 1/2/3；短路边 `final→continue` 存在且 `data-to ≠ steering`；stop 边条件含两个「无」；handoff 边含预算条件；max-steps 边含「最后一次仍 continue」；演示区含「相对示意」 | 图拓扑 |
| E-B5 | 三泳道齐全；step 框是 turn 框的后代且几何完全内含；跨泳道连接 ≥5 且带载荷；不出现停止判定条件文字 | DOM + 几何 |
| E-S | 每块有折叠的「源码位置」层且含关键行号（证据没被删）；**主路径上不出现 `xxx.py:NN`**（不会漂回去）。判据是「舞台区去掉全部折叠层之后」再采样 | 文字层级 |
| E-X1 | 本板纳入既有五类体检：白字扫描、Markdown 残留、横向溢出、触控目标、控件字体族 | 类别性 |
| E-X2 | 全站 tab 条几何：新增第 13 个 tab 后，展示与复习两种状态下每个 tab 仍完整落在条内、标题不裁切 | 存量回归 |

### 5.3 人工闸（逐块记录，上游 §6）

对七块逐块执行，记录进本文件 §7：

1. 写下 expected answer = 该块的 `accept` 验收句。
2. **同时遮挡标题与结论段**，只看图。
3. 口述回答，与 expected answer 比对，记「通过 / 不通过」。
4. 另记两项：**首屏是否先出现完整视觉舞台与结论锚**；视觉记忆点是否来自技术关系而非装饰。

### 5.4 视口与状态矩阵

| 维度 | 取值 |
|---|---|
| 视口 | 桌面 1440×1000、手机 390×844 |
| 配色 | 浅色、深色（`prefers-color-scheme`）各核一遍 |
| 状态 | 默认态、全部展开态、复习态（含复习门未揭示）、reduced-motion |
| 截图 | 每块两视口各一张，留存于 `/tmp/nodejs-skillup-showcase-visual-audit`，交付记录指明路径 |

### 5.5 存量回归

共享文件只做加法，但 `Showcase.tsx` 的 `TABS` 增加一项会改变 tab 条布局。回归判失败标准冻结三项：
① 各存量 tab 的结论锚仍在首屏；② 无文本裁切；③ 无页面级横向溢出。

---

## 6. 里程碑

| 里程碑 | 内容 | 完成判据 |
|---|---|---|
| M1 | 数据层 `aiEngineerTopics.ts` + 接线（types / Showcase / AppShowcase）+ P3 / B1 / B3 | `typecheck` + `build:showcase` 绿；E-0*、E-P3、E-B1、E-B3 通过 |
| M2 | B2 / B4 / B5 / P1 + 样式收口 | E-P1、E-B2、E-B4、E-B5 通过；存量 1070 项仍绿 |
| M3 | 两视口截图 + 人工闸七块记录 + 存量首屏回归 | §5.3 / §5.4 / §5.5 全部记录在案 |
| M4（D4 后） | C1 mock 实测数字回填 B4 `evidenceStatus` | 数字带「mock 实测」来源标注 |

## 6.0 文字层级调整：源码位置整体下沉（2026-09-02，本人 review 后）

**问题**：首版把行号与内部函数链留在了 B2/B3/B4 的主路径上（B2 23 处、B3 21 处、B4 22 处），
读者要先解析标识符才拿得到机制。本人 review 判定「在可视化展板的语境中，引用这些代码对阅读与理解
没有帮助」。

**判定**：这条批评指向的是实现偏离，不是方案变更——上游十列⑥对 B2/B3/B4 写的本来就是
「常驻 = 结论句 + 边界，折叠 = 各阶段 / 各分支细节」。首版把证据层写进了常驻层。

**处置（证据不删，只换层）**：

1. 主路径改为机制语言。阶段名、条目 kind、turn/step/anchor 这类**正在被学习的领域词**保留；
   `L148`、`build_query → fetch_all → _default_messages`、`should_continue = bool(...)`
   这类**代码转写**清出主路径。
2. 每块新增折叠层「源码位置（Bub @ 33c417a，只读）」（`AeBase.sources`），行号成组列在那里，
   要去核对时展开一次即可，不必逐个节点找。
3. 例外两块，理由是内容本身：
   - **B1 入口链**保留节点上的 `文件:行`——上游 §4.4 B1 的⑤明确要求「节点标真实 `文件:行`」，
     而且这块的单一问题就是「哪个模块在什么时机执行」，位置即内容。
   - **P3** 两侧的 `app.js:19` / `hook_impl.py:248` 等是对照关系的两个端点，不是旁注；
     去掉就没有「哪一行对上哪一行」了。
4. 断言跟着换层：原先「行号出现在舞台上」的覆盖改为 §5.2 的 **E-S** 组——一边断言折叠层里有关键
   行号（证据没被删），一边**反向断言主路径上不再出现 `xxx.py:NN`**（不会慢慢漂回去）。

**效果**：B2 1.45 → 0.82 屏，B3 1.35 → 1.25 屏，B4 1.45 → 1.30 屏，主路径字数同步下降。

**这轮改动被自己的新断言抓到两处回归**（都已修）：`.ae-sources` 的长 ref 在 390px 下撑破页面
（B2 +4px、B3 +43px）；「主路径无行号」最初把块内自带的 `details`（B5 的 hook 清单）也算进主路径，
判据改为「舞台区去掉全部折叠层之后」再采样。

## 6.1 实现期落地记录（2026-09-02）

**默认态屏数（桌面 1440×1000，`.ae-stage` 高度实测）**：

| 块 | 高度 | 屏数 |
|---|---|---|
| P1 语法映照 | 1150px | 1.15 |
| P3 CLI 分发器对照 | 1005px | 1.00 |
| B1 入口链 | 1251px | 1.25 |
| B2 turn 管线 | 824px | 0.82 |
| B3 tape → context | 1246px | 1.25 |
| B4 step 循环 | 1298px | 1.30 |
| B5 职责与层级 | 1013px | 1.01 |

（B2/B3/B4/B5 为 §6.0 换层之后的值。）

七块均在 §2 的 ≤1.5 屏门槛内，无需登记「不可拆理由」。B4 一度到 1.55 屏，靠三处压缩收回：
边的条件与行号并排成一行、演示与证据状态并排、层 3 的线性链在桌面改横排（见 §8 差异 1）。

**位置编码实测（几何断言的实际取值）**：

| 编码 | 桌面实测 | 判据 |
|---|---|---|
| B1 共有节点跨两列 | 1334px vs 单列 663px（比值 2.01） | ≥1.8 倍 |
| B2 finally 罩子 | 727–937px，`_run_model` 段 727–937px | 完全重合（±2px） |
| B3 读写口方位 | 读口 1449 < 带子 1491 < 写口 1669 | 读在上、写在下 |
| B3 帧序 | read → read → assemble → model → execute → append | read < model < append |
| B5 嵌套 | step 框四边均在 turn 框内，且是其 DOM 后代 | 几何 + DOM 双条件 |

**类别性体检（七块 × 桌面/手机）**：横向溢出 0；触控目标无 <24px；浅底白字 0；Markdown 残留
（`**` 与反引号）0；正文字号无低于 12px；字体族无非 system-ui / ui-monospace；行内 code 不大于
正文；console error 0。

## 7. 人工闸（待本人执行，AI 不代填）

机器闸已全绿（§6.1），但**人工闸是本人的判断，不能由实现方代答**：机器只能证明图的结构、几何与
文字在位，证明不了「遮住标题和结论段之后，图本身是否讲清了那个技术关系」。

执行方式（每块一遍）：先默写 expected answer，再遮住标题与结论段只看图，口述回答，与 expected
answer 比对。expected answer 已从数据层的 `accept` 字段落在页面里：展开「验收句与证据等级」即可看到，
不必回翻文档。

| 块 | expected answer（页内可见） | 命中 | 首屏结论锚 | 记忆点来自技术关系 |
|---|---|---|---|---|
| P1 | 六单元映射类型能被独立正确分类，dataclass/Pydantic 记为 Python 内两形态 | 待本人 | 待本人 | 待本人 |
| P3 | 四个职责位置可对应，每对都标了成立与失效，未宣称严格同构 | 待本人 | 待本人 | 待本人 |
| B1 | 模块级执行两线共有，差异在 app() 的调用者，wrapper 一路待运行验证 | 待本人 | 待本人 | 待本人 |
| B2 | finally 只罩 `_run_model`，是尝试调用不是保证持久化 | 待本人 | 待本人 | 待本人 |
| B3 | messages 的历史部分是现读投影，完整 messages 还含本轮 system/steering/prompt | 待本人 | 待本人 | 待本人 |
| B4 | 有 tool 结果就短路 continue；停止是两者皆无；handoff 看预算；max_steps 在最后一次仍 continue 后 | 待本人 | 待本人 | 待本人 |
| B5 | 决策 / 执行 / 编排归属正确，且 turn 包含 step | 待本人 | 待本人 | 待本人 |

**截图**：`SHOWCASE_AUDIT_SCREENSHOTS=1 SHOWCASE_AUDIT_TOPICS=ai-engineer yarn audit:visual` 产出
桌面与手机两档，落在 `/tmp/nodejs-skillup-showcase-visual-audit`（不进仓库）。

## 8. 与上游方案的差异

本施工图对上游 `w12-ai-visualization-plan.md` 的结论、形态、十列与数据契约**无改动**；新增的全部是
实现层决定（DOM 结构、class 与 `data-*` 命名、grid 列数、帧序编号、断言选择器）。需要显式记录的五处：

1. **B4 层 3 在桌面改横排**（手机仍竖排）。层 3 是一条线性链（继续 → 最后一次迭代 → for 耗尽 →
   抛错），横排就是它本来的形状，同时把这块最高的板从 1.55 屏收回 1.45 屏。三分区、边条件与
   「四类出口不在同一层」的结论不变，箭头随之转向，方向编码不丢。
2. **B3 的两条路径做成显式切换**（工具路径 / 纯文本路径），而不是把两条 append 路径塞进同一条帧序。
   同一条时间轴上先演工具路径再演纯文本路径会读成「先后发生」，而它们是互斥分支。切换后两条路径
   各自 6 帧 / 5 帧，纯文本路径的帧内明确写「无工具执行」，与上游 §4.1 ⑨ 的要求一致。
3. **B2 手机档的罩子改到右列**，与 `_run_model` 同排而不是竖向括号。包含关系由「同排」承担，
   断言在手机档改量纵向包含（scope 的 top/bottom 落在该阶段之内）。
4. **P1 的 TS 端点证据地位写死为定位用途**（本周实测发生在 Python 侧），并把该边界句放进常驻文字层，
   避免六行被读成「两侧都本周实测过」。这是补充说明，不改上游 §4.4 的契约形状。
5. **B5 断言追加一条「不重复停止判定」**（页面不得出现「两者皆无」「max_steps」字样）。上游 §4.4 B5
   的十列已写明停止判定归 B4，这里把它变成机器可查的口径护栏。

**跟进项（不在本批）**：W12 的三份笔记（`week12-plan.md` / `day2-freeze-and-baseline.md` /
`day3-bub-main-chain.md`）尚未接进学习笔记 tab，读者暂时只能通过板上的来源标注按路径去仓库核对。
上游 §1.3 已把「Python 语法全量速查进学习笔记 tab」列为独立事项，一并在那批处理。
