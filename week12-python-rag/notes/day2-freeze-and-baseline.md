# W12 D2（9/1 周二）：结账、决策冻结、Python 基线与迁移增量

> 建立：2026-08-31（Asia/Shanghai）。本文件是 D2 的单日计划与当日笔记载体。计划部分由 AI 按
> 实现方模式（白名单文档）预排；§3 本人决策与 §5 执行记录由本人在 9/1 当天填写，AI 不预填。
>
> 背景：D1（8/31）全天用于五周计划的评审与改建（评审已通过），原 D1 执行清单未动。本周有效
> 学习日为 4 天（9/1-9/4），改排依据见 [`week12-plan.md`](./week12-plan.md) §3 与顶部改排说明。

## 1. 今日目标与止步条件

主线一句话：还清 DEBT 类 2、冻结本周六项决策、建立项目级 Python 3.12 基线，并完成
TypeScript -> Python 迁移增量的首轮学习与 `prompt v0` 落盘。

当日必须收口（任一不满足则当天不算完成，按实际状态记录去向）：

- DEBT 类 2 第一档盲重建有明确的通过或卡档结论。
- §3 六项决策全部冻结。
- Python 3.12 环境、依赖锁定、最小运行入口与冒烟测试可运行。
- `prompt v0` 已版本化落盘（D4 真实调用的前置）。

可顺延项：当日迁移增量未覆盖的知识点随 D3 的 Bub 调用链现场展开；cp/L55 保持 root 会话条件项。

## 2. 上午：结账与基线（原 D1 清单）

执行顺序固定：先确定性存量（DEBT、决策），后环境配置。

- [x] **第一入口：DEBT 类 2 第一档盲重建**（2026-09-01 执行 → **卡档**，证据见 §5；`DEBT.md`
  状态已更新为「卡档，待还」，再重建另排）。
- [x] 冻结 §3 六项决策（对应 `week12-plan.md` §5，2026-09-01 已冻结）。
- [x] 建立项目级 Python 3.12 环境、依赖锁定与最小运行入口（白名单；2026-09-01 完成，见 §5）。
- [ ] 冻结 Bub 的来源 commit；本周只读 Bub；DeepSeek Harness 不再进入五周主线（HEAD `33c417a`
  已探测，待本人拍板）。
- [ ] 在 VS Code 内记录 Codex 与 Cline 扩展的版本、provider、权限模式和规则来源；确认两端加载
  根 `AGENTS.md`。不安装 Claude Code，不使用 Codex App，不开始同题对照（版本已确认 26.5825.51511 /
  4.1.16，provider/权限/规则来源待记录）。
- [x] 验证 DeepSeek key 只存在于 gitignored 本地环境（`week2-express/src/.env`，`.gitignore:5`
  覆盖、未 tracked ✅）。
- [ ] 条件项：root 会话可得时闭合 cp/L55；不可得时保持 BACKLOG（勾选时补一句实际结果）。

## 3. 本人决策冻结区（2026-09-01 D2 已冻结）

1. **唯一验收句**：本周通过的可证伪标准为五项交付物**全部满足**（对齐 `week12-plan.md` §1）：
   1. 环境：Python 3.12+ 项目环境中 `pytest` 全量通过且增量迁移代码行覆盖率 ≥ 90%。
   2. Bub 阅读：阅读报告落盘（turn / hook / tape / context rebuild / model/tool/channel 调用顺序
      与职责边界），且至少包含一个**源码级深读闭合问题**（定义见本项注）。
   3. 真实客户端实验：D4 完成真实模型调用、最小工具调用、timeout / cancellation 各真实触发，
      实验记录落盘。
   4. Prompt v0：`prompt v0` 版本化落盘（D2 内完成）。
   5. W13 输入清单：本周结束前产出 W13 的学习输入清单（明确要读的代码 / 文档 / 实验范围）。
   五项缺一不可，任一未完成则本周不通过。
   
   注（闭合问题定义）：针对 Bub / CPython 源码中某一具体机制（如 turn 状态机、hook 注入点、
   tape 生命周期），提出可证伪假设 → 通过源码定位与最小实验验证 → 得出明确结论（通过 / 证伪），
   全过程记录于阅读报告附录；该闭合问题是报告的一部分，不额外计数。

2. **Python 冒烟测试判据**：
   - `python -c "import sys, pydantic; print(sys.version)"` 正常输出，无 ModuleNotFoundError。
   - 项目级入口脚本（如 `python -m src.smoke`）以 0 退出码在 5 秒内完成；若存在
     `pytest -k "smoke"` 亦需通过。
   - 无 ImportError / VersionConflict；静态类型检查（如配置 `mypy .`）零严重错误。
   - Bub 导入按实际来源处理：本地包用 `PYTHONPATH` 或 `pip install -e`；不可安装则绕过，
     仅验证能通过路径访问核心模块。

3. **D5 陌生代码诊断边界**：
   - 允许查看：项目内源码、官方文档（pydantic / pytest / CPython）、git 历史提交记录、
     `DEBT.md` / `LEARNING-STATE.md` 既有笔记。
   - 禁止：直接复制粘贴外部完整解法至代码库，除非逐行注解原理与适配理由。
   - 通过定义：**本人独立作答**在 45 分钟内定位根因（具体函数 / 类 / 文件 / 行），并产出可执行
     修复假设（即便最终未合并），记录于当日状态文件；两端（Codex / Cline）不限时但记录各自实际
     用时，用于对照。

4. **每日止步条件**：
   - 必须当日收口：`LEARNING-STATE.md` 与当日计划文件的状态更新（含卡点结论、已执行项、明日入口）。
   - 可降档至 BACKLOG：任一 P0 类任务（如 DEBT 类 2 重建）连续 2 个番茄钟无实质进展（无新推断、
     无新实验、无新笔记）后，记录卡点、降档，切换至确定性任务（环境配置、依赖锁定、pytest 用例搬运）。
   - 下午 17:00 前：git 工作区仍有未提交脏文件且未在状态中说明，视为违反止步条件。

5. **运行信任边界**：
   - 必须溯源至源码：Bub 中关于并发 / 竞态、GIL、内存分配、引用计数的所有结论，先与 CPython
     源码交叉核对，不凭文档或 blog 接受。
   - 必须实验确认：第三方库（FastAPI / Pydantic / httpx）文档未覆盖的边界行为，需最小独立实验
     脚本（≤ 50 行）验证；**模型调用、工具调用、timeout / cancellation 的实际行为均需最小实验
     确认，不允许纯推断写进报告**。

6. **prompt v0 与 coding-agent（两个独立实验，不作同题对照）**：
   - **prompt v0**：D2 独立版本化落盘，用于 D4 真实模型 client 调用（本人用该 prompt 与模型交互
     并记录效果）。允许材料 = `week12-plan.md` 需求描述 + `DEBT.md` 已闭条款。成功条件 = 冒烟
     可用，且 D4 真实调用能稳定触发模型返回预期结构。
   - **coding-agent（Codex / Cline）**：D5 独立用于陌生代码诊断（本人先答 → 两端只读 review →
     对比诊断结论）。适用任务 = 对既有代码**只读分析**（定位根因、给诊断意见，不产出任何 diff
     或代码修改）。允许材料 = 额外允许既有源码文件、`pyproject.toml`、`pytest.ini`（只读）。
     成功条件 = 诊断结论与本人结论在根因定位上一致或优于本人（以诊断报告对比为准）。
   - **本周 coding-agent 不承担迁移 / 重构 / 修剪任务**：迁移由本人手动完成，coding-agent 仅作
     诊断辅助（对齐 `week12-plan.md` §4 / §6 只读边界）。

## 4. 下午：TypeScript -> Python 迁移增量 + prompt v0

围绕一个最小可运行模块按主链学习，不做语法通览（边界见 `week12-plan.md` §2.1）：

- [ ] package/import 与 `__init__.py`。
- [ ] typing/Protocol、dataclass 与 Pydantic 的职责边界。
- [ ] exception 传播与 context manager。
- [ ] pytest 冒烟入口。
- [ ] `prompt v0`：instructions / input / examples / context / output schema 分区，版本化落盘；
  内容与通过标准由本人确定（`week12-plan.md` §2.2）。

上午溢出时只压缩当日迁移增量的覆盖面，不推迟决策冻结、环境基线与 `prompt v0`。

## 5. 执行记录（当日滚动填写）

按「目标 -> 操作 -> 观察 -> 结论 -> 边界」记录；预测偏差按「原判断 -> 实际现象 -> 关键证据 ->
偏差类型 -> 修正与待验证项」留痕。

### 第一入口：DEBT 类 2 第一档盲重建 → **卡档**

- **目标**：不看原脚本与既有解释，复述三点（探测时机为何必须在 close 前发起 / 三种 close 时序
  inCallback·afterListen·sync 的竞争语义与实测结果 / EADDRINUSE 注入为何必须绑同地址）。
- **操作**：本人作答三点；AI 对照 `week11-ci/src/reproduce-close-race.js`（v7）、git 迭代记录与
  `week11-ci/notes/day4-rollback-drill.md` 步 9 / 9b / §5.3 验收。
- **结论（AI 验收）**：**第一档卡档**。
  - 题 1 方向对但机制偏差：本案是单次连接探测与 close 竞速（观察 connected/refused），非「获取
    close 前快照再对比」；探测是发起而非「完成」。
  - 题 2 整体偏离：给出的是通用 Node 语义推演，不是本案脚本构造。真实机制 = inCallback 的 close
    注册在 listen 回调内 → 竞争窗口不成立；afterListen 的 listening 回调走 nextTick 微任务，恒先于
    setImmediate close → falseActive=0；sync 同步 close 直接取消 listen 完成回调（A=0），核心收尾是
    catch（未启动抛 ERR_SERVER_NOT_RUNNING）+ close 回调 + 短兜底（cb 未触发 → probe 置 timeout、
    无条件 finish）。「sync 阻塞当前线程直至资源释放」为 Node 事实错误（`server.close()` 从不阻塞）。
    实测结果：三模式 × 100（开发机 v24.16 / 服务器 v24.19 一致）close 竞争均未复现；假 active 靠
    完整 `server.js` + EADDRINUSE 注入复现（listen 回调仍触发 + bind 失败 + 无 error 监听 → 静默存活）。
  - 题 3 方向对但缺本案关键经验事实：IPv6 通配 `*:3002` 不挡 IPv4 `127.0.0.1:3002`，「同地址」特指
    同地址族 + 通配/具体形态一致；SO_REUSEADDR 等非本案实测要点。
- **AI 辅助**：验收后按重建规则以 **L1** 讲解（为什么探测必须与 close 竞速、三模式为什么都复现不了、
  真凶在 bind 失败 + 无 error 监听、注入须绑同地址的 IPv4/IPv6 区分）。未给可运行实现。
- **边界**：卡档另排、不挤占决策冻结（周计划 §9.8）；下次重建仍第一档，时间 = D2 下午机动或 D3 前。
- **本人理解验证与延迟重建证据**：待本人消化 L1 讲解后复述补记。

### 上午清单滚动事实（brew 安装等待期间补记）

- **第二入口：六项决策冻结**——完成并落盘本文件 §3（对齐周计划 §5，已冻结注记）。B1–B4 处理：
  验收句覆盖五项交付物、删「L55」歧义（改「源码级闭合问题」且包含于阅读报告）、coding-agent
  保持只读、prompt v0 与 coding-agent 不作同题对照（两个独立实验）。S1–S3 处理：冒烟判据泛化
  （不硬写 `import bub`）、45 分钟归属本人、决策 5 补「模型/工具调用、timeout/cancellation 必须
  最小实验确认」。
- **Bub 来源 commit 探测**（day2 §2 已被并行复核更新为「冻结 Bub 来源 commit；DeepSeek Harness
  移出五周主线」）：仓库 = `github.com/bubbuild/bub`（hook-first agent runtime，Python），
  default branch = `main`，HEAD = `33c417a`（2026-09-01T04:19:22Z）。**冻结哪个 commit 待本人
  拍板**（建议固定 HEAD `33c417a`）。
- **Codex / Cline 扩展确认**（只读）：Codex = `openai.chatgpt-26.5825.51511`（darwin-x64，
  Intel）；Cline = `saoudrizwan.claude-dev-4.1.16`。与状态文件记录一致。provider / 权限模式 /
  规则来源待本人在 VS Code 内记录。
- **DeepSeek key 验证**：key 实际位于 `week2-express/src/.env`（非周计划所写 `week7-ai/.env`，
  **事实更正**）；`git check-ignore -v` → `.gitignore:5:.env`，未 tracked（`git ls-files` = 0）；
  根 `.env.example` 仅模板占位。结论 = key 只存在于 gitignored 本地环境 ✅。
- **并行更新确认**：2026-09-01「RAG/harness 学习范围复核」已落盘（`LEARNING-STATE.md` 头部 /
  day2 §2 / `week12-plan.md` §3-§4 / `BACKLOG.md`），Bub 必读范围缩到 turn 生命周期、tape →
  context 主链与 model/tool/harness 职责；DeepSeek Harness 不再进入五周主线。与本文件卡档、
  决策记录无冲突。

### 环境基线与冒烟验证（决策 2 判据全绿，2026-09-01 下午前完成）

- **Python 3.12 安装**：python.org 官方 **3.12.10** pkg。网络处理：brew 因
  `raw.githubusercontent.com` 的 openssl@3.rb formula HEAD 请求挂起（GitHub 系域名整体慢/挂，
  但 `api.github.com` / `github.com` 主页可达）；GitHub release 下载超时（uv 的
  python-build-standalone 方案排除）；python.org 官方域名仅 130KB/s；切换**华为云镜像**下载
  （2.37 MB/s，45720356 字节与官方一致）→ `sudo installer -pkg /tmp/python-3.12.10-macos11.pkg
  -target /` 由本人在终端执行，`The install was successful`。
- **venv**：`week12-python-rag/.venv`（Python 3.12.10，pip 25.0.1）。
- **依赖**（清华 PyPI 镜像）：pydantic **2.13.5** / pytest **9.1.1** / pytest-asyncio **1.4.0** /
  mypy **2.3.1**；`requirements.lock` 16 行已生成。
- **冒烟验证**（决策 2 三条判据）：`python -m src.smoke` → `[smoke] OK: python=3.12.10
  pydantic=2.13.5`，exit **0**；`pytest -k smoke` → **2 passed**；`mypy src` → **Success**。
- **项目骨架**（白名单样板）：`pyproject.toml`（`requires-python = ">=3.12"`，dev 依赖）、
  `src/__init__.py`、`src/smoke.py`、`tests/test_smoke.py`；根 `.gitignore` 补 `.venv/`、
  `__pycache__/`、`*.pyc`、`.pytest_cache/`。
- **边界**：迁移增量模块与业务测试由本人下午实现（黑名单）；冒烟样板只证明环境可用，不代写
  学习内容。
- **未完成（新会话入口）**：Bub 来源 commit 冻结（HEAD `33c417a` 已探测，待本人拍板）；
  Codex/Cline 的 provider / 权限模式 / 规则来源在 VS Code 内记录；条件项 cp/L55；下午迁移增量
  与 `prompt v0` 落盘。

### 下午：语法对照单元（方案调整后，2026-09-01）

- **调整触发**：契约讨论把「TS→Python 迁移」做成了「完整迁移项目交付」（Protocol 签名、Optional
  语义、错误类收敛、async sleep 位置等细化），超出「先掌握 Python 基础语法」的真实目标。本人明确
  声明不具备直接写 Python 脚本的能力。
- **归因（非文档失误）**：`week12-plan.md` §2.1 知识点清单方向正确；问题是**执行顺序错位**——
  契约细化放在语法基础之前，且未先确认语法基线。AI 应先做基线诊断再谈契约。
- **调整决定**：users 迁移降级为「语法单元学完后的组合练习载体」；学习改为对照单元
  「TS 写法 → Python 写法 → 最小可运行 → 本人读/改 → 运行验证 → AI review」。白名单语法直接教。
- **已学单元**：
  1. **函数与类型映射**（`str` / `int | None = None` / `-> str`、三元顺序 `X if cond else Y`、
     f-string、`print`）。关键坑：**truthy vs `is None` 是两种语义**——`greet('x','')` 在
     `if title:` 下输出 `你好，x`（对齐 TS），在 `if title is None:` 下输出 ` x`（空串当有 title）。
     迁移契约意识：语法对 ≠ 行为一致。本人两版实测对照，通过。
  2. **import/export 与 `__init__.py`**。三种导入绑定差异：`from src.users.greet import greet` 取到
     函数；`import src.users.greet` 需属性链；`from src.users import greet` 在 `__init__.py` 为空时
     触发**隐式子模块回退**——`greet` 绑定到模块对象 → `TypeError: 'module' object is not callable`。
     `__init__.py` 加 `from .greet import greet` 修复（对应 TS `index.ts` 聚合导出）。`__init__.py`
     是包标记/初始化/导出面，非入口文件（`__main__.py` 才是入口）。本人修复并 `type()` 验证 =
     `<class 'function'>`，通过。
  3. **dataclass vs Pydantic 职责边界**。判断标准 = 运行时是否拦截非法数据：Pydantic 会（如
     Mongoose），dataclass 不会（如 TS interface）。实验：dataclass 接受 `email='not-an-email'`
     直接创建；Pydantic 抛 `ValidationError`。预测偏差：`type(exc).__name__` 预测 `str`，实际
     `ValidationError`——异常对象 ≠ 其字符串表示；对应关系先答反后纠正。Pydantic v2 错误报告格式：
     `1 validation error for User / email / String should match pattern ...`。
  4. **exception 传播与异常链**。`raise ... from exc` 把原异常挂到 `__cause__`；traceback 显示
     `The above exception was the direct cause of the following exception:`。实验三问：业务异常
     `UserValidationError`、`exc.__cause__` = 原 ValidationError、`__cause__.__class__.__name__` =
     `ValidationError`。本人独立实现 `create_user` 翻译原型，通过。
  5. **context manager（`with`/`__exit__`）**。契约：块体无论正常 / 异常 / `return` 退出，
     `__exit__` 保证被调用；**异常也是退出路径**。`raise` 使块体异常退出，`__exit__` 收到
     `exc_type=ValueError`；返回 `False` = 不吞异常（继续传播），`True` = 吞掉。实验顺序
     （场景 B）：`body B` → `exit: closed (exc_type=ValueError)` → `caught: boom`，与预测一致。
     基础版通过；拓展实验（`return True`）待补。

- **随做随记约定（2026-09-01 本人提出）**：每完成一个学习单元即时更新本笔记，不攒到收口；额外
  问题与拓展知识同步记入本节。文案按 `TECHNICAL-WRITING-PROTOCOL.md`：每句承担信息职责、
  事实/推断/边界分层、删除表演性旁白。
- **额外经验与拓展（随做随记）**：
  - **shell 引号坑**：`python -c "..."` 外层双引号被 f-string 内层双引号提前闭合，代码截断、碎片被
    zsh 当命令执行。多行带引号代码改用 heredoc `python - <<'PYEOF'`（定界符带单引号禁用 shell 展开）
    或存 `.py` 文件。
  - **脚本运行方式**：`python file.py` / `python -m pkg.mod`（src layout 推荐）/ `python -c` /
    heredoc / `python -i`。`if __name__ == '__main__':` = 直接运行才执行、被 import 不执行
    （对应 Node `require.main === module`）。
  - **traceback 定位差异**：heredoc 显示 `File "<stdin>", line N`；文件方式显示真实路径 + 行号。
- **剩余单元（调整后顺序）**：context manager（`with`/`__exit__`，repository 收尾）→ pytest 入口
  （`tests/users/`）→ prompt v0 落盘（不变）。


## 6. 收尾清单

- [ ] `DEBT.md` 类 2 条目状态更新（通过 / 卡档 + 证据链接）。
- [ ] `week12-plan.md` §3 D2 清单勾选，未完成项写去向。
- [ ] `LEARNING-STATE.md` 更新：当天结论与 D3 第一动作。
- [ ] 按 `DAILY-SPEAKING-PROTOCOL.md` 生成当天口语稿。
- [ ] git diff 检查无敏感信息（DeepSeek key、公司资料、PII）；是否 commit 由本人决定。

## 7. 明日入口（D3，9/2 周三）

上午定位 Bub 的 CLI/framework 入口、一次 turn 的开始与结束和主要对象创建关系；下午跟 turn、
tape -> context rebuild 与 model/tool/harness 主链，hook 只记录主链实际经过的注册与调用。
channel/provider 扩展为选修。前置条件：本文件 §3 已冻结、Python 基线可运行、Bub 来源 commit 已冻结。
