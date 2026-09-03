# 当前学习状态

> 最后更新：2026-09-03（Asia/Shanghai，**W12 D4 单日计划建立**）：D4 计划落盘
> [`day4-async-and-real-calls.md`](week12-python-rag/notes/day4-async-and-real-calls.md)，`week12-plan.md`
> §3 的 D3 勾选按执行事实同步、D4 清单改为可勾选形态。当日主线 = 异步生命周期 + 一次真实 DeepSeek
> 调用 + 一次最小工具调用 + timeout/cancellation 各真实触发一次 + 收尾无残留证据；第一入口 =
> DEBT 类 2 第一档**第三次**重建（D2、D3 连续两次卡档，仍第一档）。前置缺口：依赖里尚无 HTTP client，
> 也无 pytest-cov（D2 决策 1 的验收句含覆盖率 ≥ 90%，D5 前须可用）。Bub 残余（hook 改写能力收口、
> 闭合问题 C1）列为条件时段，与主线冲突时整体顺延 D5。读前预测、实验结论与两项本人决策未预填。
> 周交付物、必修内容与范围保护清单未变。
>
> 上一次更新：2026-09-02（Asia/Shanghai，**W12 D3 单日计划建立**）：D3 计划落盘
> [`day3-bub-main-chain.md`](week12-python-rag/notes/day3-bub-main-chain.md)，`week12-plan.md` §3 的
> D3 清单同步改为可勾选形态。当日主线 = Bub 入口与三条主链（turn lifecycle、tape -> context rebuild、
> model/tool/harness 职责），第一入口 = DEBT 类 2 第一档再重建（上限 45 分钟，仍第一档）。
> 计划文件的预测区与执行记录未预填，由本人当天填写。周交付物、必修内容与范围保护清单未变。
>
> 上一次更新：2026-09-01（Asia/Shanghai，**W12 D2 收口**）：下午语法对照单元 6/6 完成（函数与类型、
> import/export、dataclass/Pydantic、异常链、context manager、pytest 入口；`pytest -v` 6 passed），
> **`prompt v0` 已版本化落盘**（`prompts/prompt-v0.md`，schema 与 `UserCreate` 对齐，通过标准量化）。
> **已冻结**：Bub 来源 commit `33c417a`（`~/Documents/bub`，detached HEAD）；Codex/Cline 规则来源
> 两端实测确认（根 `AGENTS.md` 均已加载）。**未完成（D3 前）**：DEBT 类 2 再重建（仍第一档）、
> typing/Protocol 未覆盖（随组合练习 / D3 现场展开）；Codex/Cline provider / 权限模式补记
> （D3–D5 机动）；cp/L55 保持 BACKLOG。D2 收口见
> [`day2-freeze-and-baseline.md`](week12-python-rag/notes/day2-freeze-and-baseline.md)。
>
> 上一次更新：2026-09-01（Asia/Shanghai，**RAG/harness 学习范围复核**）：五周顺序与日期不变。
> W12 的 Bub 必读范围缩到 turn 生命周期、tape -> context 主链和 model/tool/harness 职责；hook 只跟
> 主链实际经过部分，channel/provider 扩展降为选修。W13 增加 full-context RAG 必要性门禁，并明确
> eval 从 W13 持续到 W16。W14 增加同题非 Agent 基线；自建最小 harness 后必须完成 60-90 分钟
> OpenAI Agents SDK 职责对照，真实 SDK run 只在凭据与网络可用时执行。DeepSeek Harness 不再进入
> 五周主线。自建 RAG/harness 是教学实现，不扩展为向量数据库、通用 Agent framework、多 provider
> 抽象或 multi-agent。D2 已记录的执行事实与 DEBT 卡档结论不变。
>
> 最后更新：2026-08-31（晚，Asia/Shanghai，**W12 改排为 4 个有效学习日**）：D1（8/31）全天用于五周计划的评审与改建（评审已通过），W12 原 D1 执行清单未动。交付物与必修内容不减：原 D1 任务并入 D2（9/1）上午，原 D2 下午的 Bub 入口移入 D3，D4 增设最多 90 分钟机动时段吸收 Bub 溢出，D5 不变。DEBT 类 2 重建顺延为 D2 第一入口。改排详情见 [`week12-plan.md`](week12-python-rag/notes/week12-plan.md) §3；D2 单日计划见 [`day2-freeze-and-baseline.md`](week12-python-rag/notes/day2-freeze-and-baseline.md)，其中 §3 六项本人决策未预填。
>
> 上一次更新：2026-08-31（Asia/Shanghai，**工具与 Intel 硬件前提已更正**）：W12-W16 主线顺序仍是 Python/Bub -> RAG -> 单 Agent harness -> MCP -> reliability/evals；Prompt engineering、Agent memory、MCP/Skills 生命周期与调度、AI SDLC、VS Code Codex/Cline 均嵌入既有实验，不增加周次。Agent memory 只做有界 session 的隔离/reset/淘汰与故障观察，不引入长期向量 memory；调度复用 multi-trial runner，不建调度服务。实际工具是 VS Code Codex 扩展 `26.5825.51511` 与 Cline `4.1.16`；Claude Code 受防火墙限制，Codex App 不支持 Intel，均不作为 hands-on 依赖。W13 只确认在 `x86_64` Intel i7/32 GB 上具备小型 CPU embedding 的小样本试验条件，默认候选为 `intfloat/multilingual-e5-small`，`bge-small-zh-v1.5` 仅作中文回退；runtime 安装、全量速度和质量仍待实测，不安排本地生成模型。五周结构见 [`ai-engineer-reskill-5-week-plan.md`](plan/ai-engineer-reskill-5-week-plan.md)，简洁执行表与参考链接见 [`AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`](plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx)。本次为 L1 计划与事实核对，不新增债务。
>
> 上一次计划更新：2026-08-28（Asia/Shanghai，**W12-W13 方向变更已落盘**）：W12 改为 Python 项目阅读 + 检索基线，W13 改为只读 Agent；Java 退出，React/Next 降级。该两周版现已被 2026-08-31 五周版替代，历史判断保留在 git 与旧记录中。
>
> 此前更新：2026-08-28（Asia/Shanghai，**展板第一轮视觉契约已确认、实现并通过验收**）：W11 全周收口事实不变；本轮按根视觉规范审查 11 个内容 tab，关闭事实漂移、错误技术几何、首屏主路径与 ARIA 四类阻断。Runbook 由 1 个长页拆为 6 个专题，最终范围为 79 个专题；`verify:board` **1070/1070**，视觉采样 79 专题 × 2 视口共 **158 个状态且页面级横向溢出全部为 0**，并已按视觉语法抽查代表截图。审计、十列契约、实现结果与剩余非阻断代价见 [`showcase-visual-audit-2026-08-28.md`](week8-fullstack/notes/showcase-visual-audit-2026-08-28.md)。**未部署**；W12 入口与既有 DEBT 安排不变。

## 当前进度

- 当前周：**W12（8/31-9/4，Python for AI Engineering + Bub 深读，有效学习日 4 天）**。五周扩展于 2026-08-31 落盘；检索、题库和 embedding 移到 W13。W11「CI 流水线与自动化发布」已于 2026-08-28 全周收口。
- **当前 Day：W12 D4（9/3 周四）计划已落盘、尚未执行**——[`day4-async-and-real-calls.md`](week12-python-rag/notes/day4-async-and-real-calls.md)：第一入口 = DEBT 类 2 第一档第三次重建（口径与时限待本人拍板）；前置补 HTTP client 依赖与 fake client 骨架（白名单）；主线 = async/task/timeout/cancellation 迁移增量、用冻结 `prompt v0` 完成一次真实 DeepSeek 调用与一次最小工具调用、timeout 与 cancellation 各真实触发一次、收尾无残留 task/连接/未处理异常的**观察证据**；条件时段（≤90 分钟）收 Bub 残余与闭合问题 C1，冲突时顺延 D5。
- 上一日：**W12 D3（9/2 周三）已执行**——[`day3-bub-main-chain.md`](week12-python-rag/notes/day3-bub-main-chain.md)：四条主链（turn lifecycle / tape 追加 / context rebuild / model·tool·harness 职责）已落盘，阅读报告草稿 [`bub-reading-report.md`](week12-python-rag/notes/bub-reading-report.md) v0（§0-§9，来源版本 `33c417a`）当天起草，闭合问题**选定 C1**（step 循环收敛性，可纯本地 mock），验证归 D4/D5；hook 只完成注册与调用点定位，「能改写哪些输入输出」的逐点收口挂在报告 §6。**DEBT 类 2 第一档再重建再次卡档**（题 1/题 3 完整，题 2 的 afterListen 阶段顺序推导有事实错误、sync 收尾兜底仍未触及），第三次重建排 D4/D5，仍第一档。D3 收尾未做项：`day3-english-speaking.md` 未生成（`week12-plan.md` §3 的 D3 勾选已于 9/3 随 D4 计划同步补齐）。
- 上上日：**W12 D2（9/1 周二）已完成收口**——[`day2-freeze-and-baseline.md`](week12-python-rag/notes/day2-freeze-and-baseline.md)：上午 DEBT 类 2 第一档盲重建 **卡档**落盘、六项决策冻结、Python 3.12.10 基线全绿、DeepSeek key 验证通过；下午方案调整（契约跨度修正为「先语法后组合」）+ 语法对照单元 6/6 + **`prompt v0` 落盘**。**下一入口 = W12 D3（9/2 周三）：Bub 入口与主链深读**；D3 前置 = Bub 已冻结 `33c417a`（`~/Documents/bub`）、DEBT 类 2 再重建（仍第一档）。
- 上一周收口：**W11 D5（8/28 周五）**——[`day5-wrapup.md`](week11-ci/notes/day5-wrapup.md)：A 对照说明成篇（六步 × 三种归属）、B 口述三问全过、C runbook 盲重画（用户裁量不纳入重建对象）+ 类 2 顺延、D 展板 ①⑦ 上板（verify 1024/1024）+ 8081 发布 + 状态收口。
- W11 D4（8/27 周四）已完成收口——[`day4-rollback-drill.md`](week11-ci/notes/day4-rollback-drill.md)：回滚演练（候选①/② 全走通）、类 2 机制定论 + 修复上线（`2b9f87b`）、8080 下线、L55 复核。
- W11 D3（8/26 周三）已完成（网络阻塞收口）——[`day3-deploy-credentials.md`](week11-ci/notes/day3-deploy-credentials.md)：P1–P7 + D1–D5 全部冻结（Verify 通道 / 状态文件 / 部署对象 / 手工运维白名单 / restart 预测 5–8s / validate-logs / 触发与静默）；C1–C6 前置核对；wrapper 实现/安装（root:root 755）+ 白名单自测；部署密钥 ed25519 + `command=` 公钥；sudoers 收窄（白名单 8 条 / L56 注释 / 90-cloud 清空，**待补 gpasswd -d + lighthouse 注释需 root**）；**第一次自动部署成功**（构建 13 轮询触发 + 14 Build Now，服务器 `6a1b1a1`→`7b90b25`，Verify 七项全绿 + mark-verified）；V7 / V8 / V10（restart 实测 0.515s，P5 预测 5–8s 高估）/ V11 / V12 达成；`getRawBuild` 已批准。**收工点 B 部分达成**（验收句第 3 段 validate-logs 绿 + V9 待开发机→github 网络恢复）。
- **W11 D3 附加项（8/26，两轮）**——[`deploy-showcase-script.md`](week11-ci/notes/deploy-showcase-script.md)。
  **第一轮·发布脚本化**：展板发布此前全手工 scp，机械且过时。落盘通道选「服务器固定脚本 `showcase-land`（无参数、路径写死）+ sudoers 白名单一条」，否决 rsync 直推（参数面宽、白名单无 rsync、sudo 需密码）；本地脚本 build → `verify:board` → 产物校验 → scp → 落盘 → 线上验证一条龙，已端到端验收（`verify:board` 868/868、8081 `/` 200、asset 一致 3 个、`POST /auth/login` 400、五面回归全 200）。sudoers 由 8 条增至 **9 条**。
  **第二轮·异地触发**（本人在手机上提出：人不在开发机旁、手机不持 `admin.pem`）：先量后设计，三条事实实测——① 开发机已有 Jenkins controller 在跑（出站轮询 + 凭据齐），② 仓库是 **public 且允许 fork**，③ **手机侧 AI 会话的容器连不到 8081**（`curl --max-time 12` → `code=000`）。② 砍掉 self-hosted runner 方案（fork PR 的 workflow 能在有 `admin.pem` 的开发机上执行，且推翻契约 Q3），③ 砍掉「curl 线上自证成功」并逼出「回执必须走 GitHub 回来」；隧道直连因手机侧会话跑在**临时云容器**里被否。采纳「Jenkins 轮询触发分支」，核心不变量是 **触发权 ≠ 内容权**（pipeline 存在 Jenkins 里，内容固定取 `origin/main`）。
  **已入库**：手机侧 skill `trigger-showcase-deploy`、触发分支种子与孤儿分支创建脚本、[变更单](week11-ci/notes/change-order-showcase-remote-trigger.md)（四要素 + inline pipeline + 9 条可证伪验证 + 6 条待拍板）、部署脚本的 `SHOWCASE_SSH_OPTS`（默认空 → 本人手跑行为不变）。**Jenkins 侧执行完成（2026-08-26）**：D2 拍板选 B（新建展板专用密钥、裸装无 `command=`，`authorized_keys` 第 3 行）；D3 拍板仓库级 deploy key with write access（main 加保护 + GH006 实测通过）；验证 3 / 5 / 6 / 7 / 8 达成、回执字段级干净；pipeline 最终版落档 `week11-ci/ops/pipeline-showcase-deploy.groovy`，执行期十项偏差与修复见变更单 §9.2。**手机端到端 + 五面回归待跑**（预期 main 未变时普通触发得 skipped）。
  **写变更单时浮现三个坑**（均非设计时想到）：回执自触发死循环、`拉 main` 的 checkout 会把 main 混进轮询目标、浅克隆推不回 GitHub。共同形态是「Jenkins 的轮询目标由上一次构建的行为隐式决定，不由配置显式声明」——与 D2 的 F8（launchd 的 PATH ≠ 登录 shell 的 PATH）同类。
  **一条权限对照**：sudoers 能按「用户 + 单条命令」放行到极窄，GitHub 没有「只能推某个分支」的凭据形态——同一个最小权限目标，两个系统能达到的下限不一样。
  **展板：本轮不上板**，编码表存档在 [`week11-visualization-plan.md`](week11-ci/notes/week11-visualization-plan.md) §19——实现侧整页 pending，上板等于用展板渲染一份计划（协议 §2 挡的正是这个形态）。上板触发条件写在 §19.0。方案 B 记 BACKLOG **P1-8**（前置条件：仓库转 private + 关 fork）。
- **W11 D2（8/25 周二）已完成**——[`day2-controller-setup.md`](week11-ci/notes/day2-controller-setup.md) 九步全部执行：Jenkins LTS 2.568.2 装起（Intel 开发机，brew 前缀 `/usr/local`）；**P2 执行期重估**（brew 6.0.6 不读 `etc/services/*.env`）→ 改 plist 注入 `JAVA_TOOL_OPTIONS=-Xmx512m -Xms256m` + **launchctl 自管**（管理约定：不用 `brew services` 管 jenkins-lts）；第一条三阶段流水线（Checkout/Install/Test）绿；MMS 预下载（8.2.6，用户级缓存）+ jest 串行/超时修正（`--maxWorkers=1` + `testTimeout 30s`）；变红实验成功（验证 ⑥）；**Poll SCM 自动触发验证**（#7 `Started by an SCM change`，含一次轮询网络失败被静默记 `No changes` 的插曲）；服务器零改动核对通过（7 项 diff 仅 nodeapp RSS/TIME 动态列）。**验收句三段全达成**。Jenkinsfile 已合入 main（`1349188`）。
- **W11 D1（8/24 周一）已完成（契约冻结）**——[`day1-release-contract.md`](week11-ci/notes/day1-release-contract.md) Q1–Q18 全部本人作答、九对冲突自查通过、五张表填满、口述验收通过；[`week11-plan.md`](week11-ci/notes/week11-plan.md) §5 勾选 **18 / 18**。D1 零副作用纪律保持到收口：服务器只做了块 C 只读采集，未装 Jenkins、未建用户/密钥、未改 sudoers/配置。每日笔记 [`day1-contract-freeze.md`](week11-ci/notes/day1-contract-freeze.md)。
- **学习展板现状（2026-08-26）**：**11 个 tab / 十块板**——`release`「发布流水线」按 `week11-visualization-plan.md` §17 的编码表落地**阶段 2 三页**：③ 部署身份的权限收窄（9 类命令 × 两条通道 × 收窄前后的矩阵，最后一列写判定依据）、⑤ 部署后验证的覆盖范围（7 项 × 5 层 + 执行侧 + 「它证明不了什么」+ 列合计行）、**⑥·3 冻结取值与实测的偏差**（D3 材料多出的一批，§16 五块都装不下，新增一页）。同时把 ② 的 Deploy 与 Verify 两阶段由「已拍板」翻档为「已实测」，板头计数由 17/2/0 变为 **35 已实测 · 0 已拍板 · 3 待做**——待做首次非零，三项都写成节点：移出提权用户组、注释另一账户全权条目、部署后定为必验但无记录的一次性核对。D3 笔记接进 notes tab（接入前按 Q10 敏感模式自查通过）。两处按实测改了方案的预期：**⑤ 的列合计出现两个 1**（数据库那一层也只有一项，且它与应用自己的连接不同源——七项里没有一项走过应用的数据库连接），**③ 的对称矩阵不成立**（两条通道各自只经过一层）。`yarn verify:board` **868/868**（上一基线 784），并做了反向证明：故意改坏两处事实后如实报出 3 条红，改回恢复全过；`yarn typecheck` 与 showcase 构建均通过，**未部署**。
- **上一条（2026-08-25）**：**11 个 tab / 十块板**——2026-08-25 新增 `release`「发布流水线」（W11，`reviewOnly`，阶段 1 落地三页：⑥·1 契约层的六条自纠、⑥·2 机制层的五条自纠、② 五阶段各自的失败面；另五块按 `week11-visualization-plan.md` §10 排在 D3–D5）。同日顺带修一处存量：学习演进导航在窄屏与 1440 / 1200 / 721 三档都把节点标题裁掉一截（八个节点时就已如此，加到九个更明显），改成允许折行并补了一条与节点数无关的断言。`yarn verify:board` **784/784**（上一基线 698），`yarn typecheck` 与 showcase 构建均通过，**未部署**（发布目标为自建服务器 8081，Pages 冻结中）。
  上一条（2026-08-22）：10 个 tab / 九块板——新增 `architecture`「服务端架构」，数据库板扩到八个知识点，并按 roadmap 第九 / 第十轮把六块的形态从表格改成流动图或序列图，同日完成 W10 的数据时效核查（当时 698/698）。
- **独立线（已关闭）**：**展板状态核查线**（[`showcase-audit-line.md`](week8-fullstack/notes/showcase-audit-line.md)）已于 2026-08-21 按 §8 收口，阶段一完成八块展板的视觉编码与阅读负担核查，阶段二完成八轮处理；详细计数、取舍和屏数见执行文档。W10 ⑤ 与 ⑧ 均拆为三个专题页，W10 当前为 **8 块内容、12 个专题页**，该线关闭时 `verify:board` 为 **490/490**（2026-08-22 新增服务端架构板、返工存量四块并补 W10 时效断言后为 **628/628**），未部署。2026-08-21 另完成 W10 全部用户可见文案与 ARIA 的直述化复审；**W10 的每日笔记、周计划、runbook 与展板设计文档随后也按该规范全量核查并整改**（见「最近完成」的合规核查条目）。其他周的历史学习笔记不继续批量优化，后续新建或修改文案按根目录 [`TECHNICAL-WRITING-PROTOCOL.md`](TECHNICAL-WRITING-PROTOCOL.md) 执行。

## 最近完成

- **2026-08-28（展板视觉规范审计与接口修正）**：确认反复出现的“文字量大、图表/动效少”不只是单页实现问题——根级恢复链此前没有视觉规范入口，旧六列编码表也没有约束首屏、文字层级、视觉记忆与人工验收证据。新增根级 [`SHOWCASE-VISUAL-PROTOCOL.md`](SHOWCASE-VISUAL-PROTOCOL.md) 作为唯一现行规范：十列设计契约、视觉形态选型、图标职责、动效三分法、默认态屏数/主路径字数护栏、机器检查与人工闸分工。`AGENTS.md`、`LEARNING-PROTOCOL.md`、技术文案规范、部署规范和 W8 文档入口均已接线；W8 roadmap 降为历史记录，旧欠账审计保留为 8/25 基线。**本次没有修改展板代码、没有构建或部署；存量返工不因规范升级自动开工。**
- **2026-08-22（展板 tab 条裁切修复）**：复习状态下 tab 条渲染不完整——视口 ≥1200px 时第 10 个 tab「学习笔记」被容器的 `overflow: hidden` 裁掉大部分，只剩「学」的左半边，既读不出标题也点不到。
  - **根因是两条互相不知情的 CSS**：`.showcase-tabs` 写的是 `display: grid` + `repeat(6, auto)`，但紧跟其后的 `.section-tabs`（同优先级、更靠后）把 `display` 改回 `inline-flex`，网格从 6 个 tab 时代起就没生效过；1200px 档又把 tab 条宽度锁死在 `min(100%, 1060px)`。10 个 tab 的自然宽度是 1122px，超出的 62px 正好被容器裁掉。tab 从 6 个长到 10 个（8/22 新增 `architecture`）时这两处都没跟着改。
  - **改法是不再写死列数**：`.showcase-tabs` 改为 `flex-wrap: wrap` + `justify-content: center`，tab 用 `flex: none` + `white-space: nowrap`——排得下就一行，排不下就换行，不再裁切也不再把标题压成两行（721–1199px 此前每个标题都折行）。1200px 档去掉 1060px 宽度锁，横向 padding 从 20px 收到 16px，10 个 tab 在该档仍排一行。手机（≤720px）的两列网格不变，该档单独恢复 `white-space: normal`，避免 320px 下「Node.js 运行时」顶出列宽撑出横向滚动。
  - **实测**：展示（7 个 tab）与复习（10 个 tab）两种状态 × 1920 / 1440 / 1280 / 1200 / 1199 / 1100 / 1024 / 900 / 820 / 721 / 720 / 600 / 480 / 390 / 320 共 15 档宽度，无 tab 被裁切、无标题被截断、无整页横向滚动。另扫描十块板全部 `role="tablist"`，1440 与 390 两档下无同类缺陷。
  - **补第 4 条几何断言（§B4）**：B3 那组只量字号，量不到「控件被容器切掉」。新增的断言量 tab 条自己的几何（每个 tab 完整落在条内、标题不被自身裁切、不撑出横向滚动），两种状态 × 7 档宽度共 70 项，写成与 tab 数无关的形态，加板不用改断言。在修复前的 CSS 上跑该断言，如实报出 3 项失败（review 1920 / 1440 / 1200 的「学习笔记」）。
  - **验证**：`yarn typecheck` 通过；`yarn build:showcase` 与 `yarn build` 均通过；`yarn verify:board` **698/698**（628 + 70，既有断言未改、未放宽）。**未部署。**
- **2026-08-22（展板补齐 W1–W2）**：展板此前从 W3 起步，核查确认 W1–W2 的结论**没有被后续板吸收**——只有 explain 基线（被 W3 知识点吸收）和四层职责判据（被 W3 / W4 复用，但没有形态）两条例外；建模、最左前缀、覆盖查询、Mongoose 两层防线、中间件管道、请求穿四层的形状、两条响应路径、错误落层此前零覆盖。而 `interviewTopics.ts` 的覆盖矩阵把 W1–W2 标为 `lead`、W3 标为 `hold`，等于最该引导的一段没有板。
  - **新增第九个 tab「服务端架构」**（`architecture`，排在 OAuth2 与数据库之间）：六个知识点——中间件管道（逐帧输出 + `next()` 二选一 + 两个计时点对照）、四层职责与依赖方向、一条 `GET /users/:id` 穿六格的形状变化与三种结局、两条互斥响应路径、错误翻译落层矩阵（七行，含两层防线）、归属判断标尺（含三条被推翻的做法）。
  - **数据库板扩到八个知识点**：新增 W1 的建模决策、最左前缀、覆盖查询，顺序重排为「先存对 → 再写对 → 最后调快」，标题改为「MongoDB 建模、聚合与查询优化」。
  - **事实口径 = 当前代码优先**：命中三处笔记与代码的差异，其中 `app.js` 的 `switch (err.constructor)` vs 笔记记的 `instanceof` 已进开放问题清单（**待澄清，无子类时不影响行为，不记 DEBT**）。
  - **顺带修正一处口径**：W3 板原把覆盖查询记为「未验证 · 阻塞中」，而 W1 已在 `bigdata` 造数集合上正反验证过。已收窄为「项目集合上的覆盖查询未验证（脚本不可运行）」，plan 与 BACKLOG P0-1 合并。
  - **W1–W2 七份原文接进笔记 tab**（建模 / 索引 / Mongoose / D1–D4），板上的实验数字可当场核对。
  - **同日返工（本人反馈「没有什么动效和图表」）**：核对后确认第一轮违反的是仓库自己的判据——roadmap 第八轮已把标准改成「遮住标题与结论段仍能答出验收句」「图形负责结论本身」，而第一轮六块里有四块是表格加正文。① 改成三层同心环 + 令牌进出，③ 改成六泳道双轨流动图（左下行右上行、令牌带着当前形状走完一个来回、三种结局是轨道上的三个停止点），⑤ 改成「按翻译层分三列 → 汇进唯一出口 → 扇出五个状态码」，W3 的聚合 pipeline 改成逐阶段的文档形状变形（字段芯片按新增 / 消失 / 改形着色 + 多重性变化）。② 与 ⑥ 保留矩阵——二维分类判断本来就该用表。新增九条结构断言守着「图塌了等于结论没了」。
  - **顺带关闭一条 BACKLOG**：`AuthBoard` 改成真泳道正是 **P2-2「认证主链改真泳道」**（7/29 起挂在 P2），已按维护约定标记完成并保留原判断留痕。原判断说它是「代表页布局重写、对面试和工作不产生增量」——实际改动只落在一个组件的一段 JSX 加一段 CSS，而它承载的是问答稿里的强题。**规模估高了，收益估低了。**
  - **第三轮（同日，把形态倒回存量板）**：按 roadmap 第九轮的判定，`AuthBoard` 端到端认证链改成**泳道序列图**（四条泳道是四列，七段消息各画一根跨列箭头，两段自环 = 受保护请求管道内部处理，两段反向 = 签发 JWT 与 requireRole 查库），`W6Board` 全栈轨道改成 **U 形折返**（01–07 出站一行，08 React render 落回第二行第一列，虚线画出回程；六个交接点各挂一枚令牌显示该段交出的值，引用同页交接契约表不另写一份）。`AuthBoard` 顶部的 `StopMatrix` 本来合格，未动。**8/20 记下的「八块板重新校对」清单由此完成 2 块**（`AuthBoard`、`W6Board`），其余 6 块仍在册。
  - **第四轮（同日，续清算存量）**：`OAuth2Panel` 授权码流程改成**三泳道序列图**（六段消息全部画成跨列箭头；前信道 / 后信道原来只由颜色 + 文字标签承载，现在的第二编码是「箭头有没有触到浏览器列」，`client_secret` 那两段压根不碰第一列）；`W6Day4Board` 的十层交付物表改成**交接链**（九层依次交接各挂一枚交付物令牌，`shape` 分类补可见标签，**全局 error handler 从第十行改画成缩进侧支**——它不是第十步，画成直线会读成「请求最后都会走到 error handler」）。**选型先纠错**：第三轮收尾时建议下一轮做 `W5Board`，动手前按复核仪式实际打开看了三块，判定 **W5 是全站形态最完整的一块、不需要返工**，已从存量清单移出。8/20 的八块板清单至此完成四块，余 `W9Board`（记 BACKLOG 延后）、`W10Board`、`InterviewBoard`。
  - **第五轮（同日，W10 数据时效核查）**：`day5-wrapup.md` §10.4 边界④留的那一维（形态那条线 8/21 已关，当天的 D 只做时效）本次补完。先确认三处计数（板头档位、⑤ 红绿格、建构进度）都是由数据算出、结构上不会漂；随后抓到三类共 11 处：**① 事实归属错日 1 处**——journald 的 248 MB 被归到「设定上限当天」，实际是 D1（8/17）块 C 基线，设定当天（D2 / 8/18）实测的是 272 MB；**② 孤立的周相对时间 3 处**（两处「本周不做」、一处「下周复现」，后者 8/24 当天就会失效）；**③ 孤立的日相对时间 7 处**（⑧ 块里的「前一天 / 当天」，指 D4 与 D5）。一处判定不改：延迟自测的「隔一天：前一天真注入，第二天自测」是方法的间隔结构，不是日期。移交 W11 的两项（类 2 假 active 机制未验证、盲区②）复核后仍如实标注。新增**常驻时效断言**：12 个专题页逐页扫孤立相对时间 + journald 归属 + 移交项状态；顺带按规范 §5.7 把⑤ 那条钉死整句的旧断言改成钉稳定事实。
  - **验证**：`yarn typecheck` 通过；`yarn build:showcase` 通过；`yarn verify:board` **628/628**（490 → 496 是新 tab 进入全站排版体检，再加 §E 架构板、§F W1 三块、§G W4 泳道序列与 W6 轨道折返、§H OAuth2 序列与 Day4 交接链的结构断言、§I W10 常驻时效断言）。方法与取舍见 [`w2-architecture-visualization-plan.md`](week8-fullstack/notes/w2-architecture-visualization-plan.md)。**未部署。**
- **2026-08-21（W10 D5 收口日，全周完成）**：
  - **runbook 成篇 + 延迟自测两类走通（判据 1–4 销账）**：`runbook.md` 三类五列齐全、判定分叉可判真假；类 1（反代 502）+ 类 3（磁盘逼近满）盲测不看笔记走通，**全程 0 次翻笔记**。
  - **check-disk 取整盲区已修（#11 变更单）**：`df -BG` 取整 → 字节级 `df -B1` 比较；15:18 重注入该类条件拿到 `status=FAIL`「该红就红」实证（旧判据同条件 8/20 报 OK）。
  - **类 2「假 active」根因定论**：读 `server.js`（98 行只读）确认无 `error` 监听；偏差归因改为「成功回调触发但底层未绑定，**机制未验证**」→ 排 W11 最小样本复现；修复方向（`error` 监听 + `process.exit(1)`，复用外层 server）已入 runbook 与本次笔记 §8。
  - **展板数据时效翻档四处**（`w10Facts.ts`）：盲区①→已修、盲区③→修复方向已定、类 2 根因 unverified 更新、④阈值尺磁盘 caveat 追加「8/21 已修」；**grade 保持 pending 不夸大**（机制未验证）。`verify:board` **421/421**（playwright 改为本地 devDependency 1.62.1）。
  - **块 H 全绿 + 残留核零**：五面 200 + health 200 + 7 active；`/tmp/disk-fill.bin` 不存在、3000 仅 nodeapp（backlog 511）、shop-ssl 与 d4bak/d5bak diff 空、nodeapp unit 无临时 Environment。**唯一生产机今晚可安稳过夜。**
- **2026-08-21（其余展板合规核查，第三轮）**：范围 = W9 / W10 之外的六块展板、面试准备板及其数据文件（13 个源文件），加「学习笔记」tab 里尚未过审的 8 份文档。
  - **先量后改**：逐词扫描显示 §3.1 禁用隐喻（刀 / 劈 / 闸 / 绿灯 / 说谎 / 接力 / 销账 / 过夜等）**0 处**、感叹号 **0 处**、未锚定的「今天 / 昨天 / 明天」**0 处**——对照 W10 单隐喻一项就有 144 处。这些板建于 7/29–8/12，主体是关系图与流程图，文字量小，长叙事里堆积隐喻的机制在这里没有发生。
  - **术语与前两轮对齐**（实改一）：`W3Board` / `InterviewBoard` 的 kicker「仍在路上 · 已如实记账」→「开放问题清单」「材料缺口清单」；`W3Board` 的 `h3`「还没吃透 / 未验证的部分」→「未验证与待澄清项：各自的状态与下一步」。`aria-label`、`w3Topics` 的交叉引用、`types.ts` 与 `MarkdownNotes.tsx` 的注释与描述、`plan/w5-display-board.md` 两处指向一并同步（规范 §5.6）。
  - **表演性旁白**（实改二）：`interviewTopics` 板块 2 标题「两处硬伤：说错了最掉分」→「两处答错过的题：旧答法与已验收结论矛盾」；两处 `mapping` 去掉「比从没错过更能体现你真的验证过」「那才是当场会掉分的地方」；两个开放项面板的说明去掉「不必反复自我怀疑」「哪些已经踏实」。`week8-fullstack/README.md`、`visualization-optimization-roadmap.md`、`showcase-audit-line.md` 中指向旧板块名的三处引用同步。
  - **引号包普通事实 + 口语「真的」**（实改三）：`W6Board` 主标题「从「系统能运行」到「证据可重复」再到「用户真的走得通」」→「从本地能运行，到证据可重复，再到全栈契约闭环」（与三张卡的 `title` 对齐）；Day 3 卡片 `answer` 改「真实浏览器能走通吗？」；Day 2 标题改「让测试连到 CI 启动的那个 MongoDB service」。
  - **两处判定不改**：①「记账」是 `AGENTS.md` §5「欠债记账」的机制名，展板内 5 处保留——它与 W9 改掉的「销账」不是同一类；② `W5Board`「先不看答案，口述你的判断链」与 `W3Board` / `OAuth2Panel` 的同型复习门措辞，按规范 §7 判为功能性指令而非表演性旁白，不列入发现。
  - **未纳入**：W1–W6 的历史每日笔记不在展板在册清单内（`week3-mongoose` 三处「还没吃透」保留），仍按「其他周历史笔记不批量优化」的口径处理。
  - **验证**：`yarn typecheck` 通过；`yarn build:showcase` + `yarn verify:board` **490/490**（断言未改、未放宽），覆盖 1440 与 390 两档宽度的溢出与触控目标体检。
- **2026-08-21（展板在册文档 + W9 合规核查，第二轮）**：范围 = 展板 `MarkdownNotes` 清单里的面试准备与学习笔记、W9 全部笔记、W9 展板文案。
  - **拍板**：W9 的类比体系（门卫 / 管家 / 仓库 / 救生索 / 两道闸门）**按「只改独立出现的」处理**——技术对象已并列的保留（`w9Glossary` 术语+白话双列、roadmap §8.3 六条类比、「已越过安全组与 ufw 两道闸门」），读者需反推的改实名（展板 `闸门 1/2` → `过滤层 1/2`、「过了两道闸门才到这里」→「过了安全组与 ufw 两层过滤才到这里」）。「销账」统一改为「验收 / 核对」，与 W10 对齐。
  - **删除误入笔记的工具脚手架**：`day4b-https-and-admin-plan.md` §2 混进了一个残留的 `</replace_in_file>` 闭合标签与一份 `task_progress` 清单（4 个空框曾被误读为「未完成项」）。该文件在展板上渲染，现已删除，「原建议（保留备查）」重新接上三条理由。
  - **保留了一处真实区分**：W9 展板方法 §12.13/§12.15 分「过时」与「谎报」两种失效。未按 W10 的口径合并，改用「错报」，区分保持不变。
  - **W9 未回填项**：`week9-plan.md` D4 父项三条子线全 `[x]` 而父项空 → 勾选；`day5-rebuild-closeout.md` 四项「未完成」按仓库状态回填，其中「本人自己讲」明确标注仓库无留痕、无法确认。
  - **展板可见文案与断言同步改**（规范 §5.6）：`w9Facts` 的「展板会说谎」→「展板给出与最新数据不一致的结论」，`verify-w9-board.mjs` 第 362 行断言同步；板块名「契约销账与资源闸门」→「契约验收与资源上限」，`W9Board` / `w9Topics` / aria-label 三处一致。
  - **上一轮的连带修正**：`MarkdownNotes.tsx` 两条展板描述仍写着「通用第一刀」「先做的会先说谎」，已与改写后的 W10 文档对齐；`showcase-audit-line.md` 等三份 W8 文档里指向旧板块名的引用一并同步。
  - **验证**：`yarn typecheck` 通过；`yarn verify:board` **490/490**；diff 数字比对零净流失。
- **2026-08-21（W10 文档合规核查）**：按 `TECHNICAL-WRITING-PROTOCOL.md` 核查 W10 九份文档 + 展板源码，逐项整改：
  - **runbook 一处事实漂移已修**：§2.3 类 3 的「症状」栏原用现在时写 `check-disk` 报 OK（`avail=4G`），与同页 §3 盲区①、§4.3 的「2026-08-21 已改字节级判据」矛盾；现补 8/20 旧判据与 8/21 新判据两个时间锚点。
  - **禁用隐喻清零**：刀 / 劈 / 断口 / 闸 / 绿灯 / 说谎 / 接力 / 销账 / 过夜共 144 处，全部改为直述技术对象（通用首查、拦截层、自动检查、分工、验收、无人值守运行等）；runbook、笔记与展板可见文案的术语现已一致。
  - **收尾清单回填**：day2–day5 共 39 个 `- [ ]` 与正文「已完成」矛盾，逐项核实证据后勾选，条件项补实际结果（`DEBT.md` 无 W10 条目 = 未触发）；根因写进 `LEARNING-PROTOCOL.md` §6 的收口口径。
  - **过期事实回填**：`day5-wrapup.md` §10.2 交付物 ⑦ 由「部分达成 / day5 待生成」改为「达成」（口语稿与该笔记同一次提交入库）；`day1` §5 标题去掉「模板，待填」；`day1` §5.4 补第 4 类未执行与 `26.5G` 漂移的实际结果；`week10-plan.md` D5 的孤立「今天」改为 8/21 锚点并回填展板核查线已关闭。
  - **验证**：`yarn typecheck` 通过；`yarn verify:board` **490/490**（与整改前基线一致，无断言放宽）。展板源码只动注释，可见字符串与 `aria-label` 未变。
- **2026-08-20（D4）**：三类故障真注入挖出三个盲区；展板 ⑤ 落地 421/421。
- **2026-08-19（D3）**：四项检查全部「绿→弄红→还原→绿」，4 脚本 + 8 unit 入库。

## 当前主线

- **当前入口 = W12 D4（9/3 周四）**：异步生命周期、真实模型调用与真实失败（async/await、task、
  timeout、cancellation、资源清理与异常边界；一次真实 DeepSeek 调用 + 一次最小工具调用，输入用
  D2 冻结的 `prompt v0`）。单日计划见
  [`day4-async-and-real-calls.md`](week12-python-rag/notes/day4-async-and-real-calls.md)。D4 前置 =
  补 HTTP client 依赖（白名单）、key 仍只在 gitignored 本地环境、DeepSeek base_url 与模型 ID 待运行
  确认。本日不实现 Agent loop；真实 API 不可用时按周计划 §9.3 保留错误证据 + fake client 验证本地
  生命周期，不把 fake 成功写成 API 已验证。D5 陌生代码诊断、报告收口与 W13 接口。
- 五周主线：W12 Python/Bub -> W13 RAG -> W14 Agent -> W15 MCP -> W16 reliability/evals。
- 横切必修：Prompt 版本/eval、Agent memory 边界与有界状态实验、MCP/Skills 生命周期与运行调度、
  AI SDLC、VS Code Codex/Cline 同题 hands-on。它们复用主线任务，不建立额外产品。
- 独立执行表与参考链接：[`AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`](plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx)。
- 通用 harness 契约沿用 week7 方案；W14 delta 只补 Python/RAG/`clarification_required`、prompt 版本关联
  和有界 session state 实验边界，并由本人完成任务级正确性判断。

## 当前阻塞与风险

- **未发现 W12 开工阻断**。项目级 Python 3.12.10 环境已于 D2 建立并冒烟全绿（`python -m src.smoke` exit 0、`pytest -k smoke` 2 passed、`mypy src` Success）。
- W12 容量由 5 天压缩为 4 天：D2 任务密度全周最高（原 D1 + 原 D2 上午），Bub 阅读由 1.5 天压缩为 1 天。对策已入周计划 §9：D2 溢出只压缩当日迁移增量覆盖面（随 D3 现场展开补），Bub 溢出由 D4 机动时段吸收，降档只作最后手段并如实记录。
- W13 风险：中文 BM25 预处理、`multilingual-e5-small` 的 macOS x86 runtime 可安装性、Intel CPU
  速度/内存/质量和 Tier B token 数尚未实测；只确认具备小样本试验条件，不预设全量速度可接受。
  PyPI 已核对 `onnxruntime==1.23.2` 与 `torch==2.2.2` 存在 CPython 3.12/macOS x86_64 wheel；D1 以
  ONNX 1.23.2 为首选并真实安装、冻结 hash，不做源码编译。失败时保留 BM25，dense 不阻塞 W14。
- W15 风险：MCP Inspector 官方文档已覆盖现代/旧版协商；本机版本、Node 前提与自建 server/client
  的实际消息流仍待验证，旧版消息流只做一次兼容对照。
- VS Code Codex `26.5825.51511` 与 Cline `4.1.16` 已从扩展清单确认；W12 仍需在各自界面记录
  provider、权限、context 和根 `AGENTS.md` 的实际加载证据。W15 的产品 MCP 接入只作互操作观察，
  现代协议验收由 Python SDK 原始消息流承担。
- 横切能力增量必须复用既有实验：W14 prompt + session state/context 实验合计半天且不做跨 run
  持久 memory，W15 产品客户端/Skill 生命周期合计 90 分钟，W16 AI SDLC 60-90 分钟且不引入调度基础设施。
- W15/W16 受节假日压缩，分别按 4 天和 3 天设计。假期不回填主线，只可回填 stretch。
- 类 2 最小样本债仍待还；cp/L55 仍是 root 会话条件项。

## 下一步（W12 D4，9/3 周四 · 新会话入口）

单日计划：[`day4-async-and-real-calls.md`](week12-python-rag/notes/day4-async-and-real-calls.md)，
执行细节记入其 §11。D3 已收口的项不重复执行；本日不实现 Agent loop，不进入检索与题库，不改 Bub 仓库。

1. [ ] 第一入口：DEBT 类 2 第一档**第三次**重建（盲，AI 出题，本人作答）。题面口径二选一
   （完整三题 25 分钟 / 只补 D3 未过的两点 15-20 分钟，后者不计入「连续两次通过」）由本人拍板；
   超时判卡档另排，不挤占主线。
2. [ ] 前置（白名单，≤30 分钟）：选定 HTTP 通路（裸 `httpx` 还是 `openai` SDK，取舍待本人拍板）、
   写入 `pyproject.toml` 并重新锁定、`.env.example` 落盘、最小 client 与 fake client 骨架；
   新依赖入库后 `python -m src.smoke` 退出码仍须为 0、`pytest -v` 与 `mypy src` 仍全绿。
3. [ ] async 迁移增量：先盲答 §5.1 四条预测（事件循环差异、`task.cancel()` 的传播与清理、超时后的
   连接归属、退出时残留 task 的现象），再用实验对照留痕。
4. [ ] 一次真实 DeepSeek 调用：输入用冻结的 `prompt v0`，记录模型 ID、prompt 版本、实际输入边界，
   并用 Pydantic（`UserCreate`）真实校验输出，记录校验失败的错误形态。
5. [ ] 一次最小工具调用：一个本地函数 + 工具 schema，只做一次往返，记录 `tool_calls` 结构与执行边界，
   并与 D3 读到的 Bub 三层分离（模型决策 / ToolExecutor 执行 / harness 落盘）对照。
6. [ ] timeout 与 cancellation **各真实触发一次**，各按「操作 -> 观察 -> 结论 -> 未验证边界」记录；
   timeout 实验须可证伪（放大超时后同一段代码不再触发）。收尾无残留需给至少两项观察到的证据，
   不接受「没报错」。
7. [ ] 条件时段（≤90 分钟，仅在主线收口后）：hook 的「能改写哪些输入输出」逐点收口 + 闭合问题 C1
   最小实验；与主线冲突整体顺延 D5。
8. [ ] 收口：`DEBT.md` 状态、`week12-plan.md` §3 D4 勾选、本文件更新（写出 D5 第一动作）、
   `day4-english-speaking.md`（并决定 `day3-english-speaking.md` 补或不补）、git diff 敏感信息检查
   （key / `.env` / 公司资料 / PII）。

止步条件（D2 决策 4 + 本日特有）：P0 连续 2 个番茄钟无实质进展即记卡点降档；真实 API 连续两次同类型
失败即停止重试并转 fake 路径保留证据；17:00 前工作区脏文件需在状态中说明。

## 验收命令或证据（W11 收口态）

- **六条最低交付边界全部达成**（`day5-wrapup.md` §8.1：流水线 / 发布契约 / 验证进日志 / 回滚演练 / 对照说明 / 公网面全绿）
- `verify:board` **1024/1024**（W11 展板 12/12 块全落地，断言未放宽：934 → 988 → 1024）
- 8081 发布：V9（/ 200 + asset 一致 + login 400）+ V10（80/443/443-admin/8081 四面 + 80 /showcase/ 全 200 + 8080 无监听）+ V11（3000 仅 nodeapp、sudoers 9 条）
- 服务器 `2a485ee`（D5 后 main 前进到 `ec8554d`，自动部署正常演进）

## 需要读取的文件（W12）

1. `AGENTS.md`、`LEARNING-PROTOCOL.md`、本文件。
2. **W11 留给 W12 的接口**：`week11-ci/notes/day5-wrapup.md`（结账 + 下周入口 §11）、`DEBT.md`（类 2 条目，W12 D2 重建）、`week11-ci/notes/change-order-showcase-remote-trigger.md`（P1-8 挂钩）。
3. 五周执行表与参考链接：[`plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx`](plan/AI_Engineer_Reskill_5_Week_Plan_20260831.xlsx)。
4. 五周总计划：[`plan/ai-engineer-reskill-5-week-plan.md`](plan/ai-engineer-reskill-5-week-plan.md)。
5. 当前周计划：[`week12-python-rag/notes/week12-plan.md`](week12-python-rag/notes/week12-plan.md)；
   当前单日计划：[`week12-python-rag/notes/day4-async-and-real-calls.md`](week12-python-rag/notes/day4-async-and-real-calls.md)；
   上一日执行记录：[`week12-python-rag/notes/day3-bub-main-chain.md`](week12-python-rag/notes/day3-bub-main-chain.md)
   与 Bub 阅读报告草稿 [`week12-python-rag/notes/bub-reading-report.md`](week12-python-rag/notes/bub-reading-report.md)
   （§7 闭合问题 C1、§8 待运行验证清单是 D4 的直接输入）；决策来源：[`week12-python-rag/notes/day2-freeze-and-baseline.md`](week12-python-rag/notes/day2-freeze-and-baseline.md) §3。
6. 通用 harness 契约：[`week7-ai/notes/single-agent-harness-lab-plan.md`](week7-ai/notes/single-agent-harness-lab-plan.md)与 `BACKLOG.md` P0-2；W12 只需知道后续接口，不进入实现。
7. `week9-deployment/notes/week9-plan.md` §3.1（语言侧 hands-on 通用验收定义）。
8. 本周产物：`week12-python-rag/prompts/prompt-v0.md`（D4 真实调用的冻结输入）、
   `week12-python-rag/pyproject.toml` 与 `requirements.lock`（D4 需补 HTTP client 依赖）。

## AI 辅助记录与延迟重建

- **2026-09-03（W12 D4 单日计划）**：AI 以实现方模式（白名单文档）按 `week12-plan.md` §3 预排
  `day4-async-and-real-calls.md`，并按 D3 执行事实同步 `week12-plan.md` §3 的 D3 勾选与去向、
  把 D4 清单改为可勾选形态，更新本文件入口。计划只写「做什么、证明什么、怎么记录」；读前预测、
  实验结论、DEBT 第三次重建的题面，以及两项本人决策（重建口径、HTTP 通路取舍）均未预填。
  未提供 Agent loop、终止状态机、工具契约、trace、verifier 的 L2 骨架，**不新增债务**。
- **2026-09-02（W12 D3 单日计划）**：AI 以实现方模式（白名单文档）按 `week12-plan.md` §3 预排
  `day3-bub-main-chain.md`，并同步 `week12-plan.md` §3/§10 与本文件入口。计划只写「读什么、证明什么、
  怎么记录」，Bub 调用链结论、读前预测与执行记录留空由本人填写；未提供黑名单 L2 骨架，**不新增债务**。
- **2026-09-01（W12 D2 下午，语法单元与 prompt v0）**：契约讨论把「TS→Python 迁移」做成了
  「完整迁移项目交付」（Protocol 签名、Optional 语义、错误类收敛等细化），超出「先掌握 Python
  语法」的真实目标；本人声明不具备直接写 Python 脚本能力后，AI 校准为语法对照单元（白名单语法
  直接教 + 本人读/改 + 实测 + AI review）。已学 6 单元均实测通过，**未给黑名单 L2 骨架**。
  `prompt v0` 内容与通过标准由本人确定，AI 仅 review 表达边界（E1–E5）。**不新增债务**。
- **2026-09-01（RAG/harness 计划复核落盘）**：AI 依据 Anthropic/OpenAI 官方工程资料以 L1 review
  五周计划，并按本人要求以实现方模式同步总计划、W12 执行计划、README、BACKLOG、工作簿与本状态
  入口。变更只涉及学习/生产边界、范围门禁和资料链接；未设计 RAG 指标、Agent loop、终止/停滞、
  工具契约、trace schema、verifier 或 eval task，未提供黑名单 L2 骨架，**不新增债务**。
- **2026-08-31（晚，W12 四天改排）**：D1 全天被五周计划评审消耗后，AI 以实现方模式（白名单文档）
  改排 `week12-plan.md` §3、建立 `day2-freeze-and-baseline.md` 并同步本文件与 `DEBT.md` 的重建日期。
  交付物与不可砍清单未减；D2 §3 六项本人决策未预填，未提供任何黑名单 L2 骨架，**不新增债务**。
- **2026-08-31（工具环境更正）**：本人说明 Claude Code 受公司防火墙限制、Codex App 不支持 Intel，
  实际工具是 VS Code Codex 与 Cline。此前只读检测只能证明本机存在相关程序，不能证明网络和硬件条件下
  可用于 hands-on；相关可用性结论已撤回。AI 以 L1 同步计划和硬件门禁，不新增债务。
- **2026-08-31（横切能力 review 落盘）**：AI 以 L1 将 Prompt、Agent memory、MCP/Skills 生命周期与调度、
  AI SDLC 与 coding-agent 使用嵌入 W12-W16；具体 hands-on 工具随后按上一条更正为 VS Code Codex 与
  Cline。未设计 prompt 内容、memory policy、调度判据、Agent loop、
  工具契约、trace schema、verifier 或 eval task 的 L2 骨架，**不新增债务**。
- **2026-08-31（五周 AI Engineer 计划落盘）**：AI 以 L1 完成仓库事实、官方资料与两轮 review 的收口，改建五周总计划和 W12；随后将 W12-W16 从第二轮历史 Excel 拆为独立工作簿，并在 `References` sheet 收录经核实的一手资料链接。README、BACKLOG 与本文件同步更新。MCP 当前事实改为 `2026-07-28` 现代协议，DeepSeek 使用 V4 模型线；所有待运行项继续标为待验证。未提供 Agent loop、终止状态、工具契约、trace schema、verifier 或 eval task 的 L2 骨架，**不新增债务**。既有辅助边界续期到 W16：loop/终止 L1-only；其余黑名单如请求 L2，逐项记债并排两周后重建。
- **2026-08-28（W12–W13 规划 review 与计划变更落盘）**：AI 以 **L1** 提供规划 review（范围校准、排期风险、eval 设计取舍、文件影响面分析），并按裁定落盘 README / 本文件 / `BACKLOG.md` / `AGENTS.md` 的文档变更。**未对任何黑名单知识点给出 L2 骨架**，未代写 Agent loop、终止状态机、工具契约、verifier 或 eval 任务；**不记债**。AI 明确拒绝了「因 AI Agent 领域高度依赖模型能力而放宽黑名单」的方向，按 `AGENTS.md` §1.5 只做解释性补充。W12–W13 开工前已约定**债务预算**：`loop 控制流`与`终止状态机`两项坚持 **L1-only 手写**，其余（工具契约 / trace schema / verifier 设计 / eval 任务选择）接受 L2 并把重建日期排到两周之后。
- **2026-08-28（展板全量审查与第一轮优化）**：本人确认十列设计契约后，AI 以实现方模式修改白名单展示资产，使用三条并行分线分别处理 W2/Auth/OAuth2/W3、W6 Day 4、W9/W10，主线处理 W11/Runbook/Interview 与统一验收。未修改黑名单核心学习代码，未给黑名单 L2，不新增 `DEBT.md`。等价本地验证为 typecheck 通过、showcase build 通过、`verify:board` 1070/1070、79 专题 × 2 视口无页面级横向溢出；未部署。
- **2026-08-28（D5 执行期）**：A 对照说明（六步归属本人作答，AI 两轮 review 纠偏：build/送产物属 showcase 链路替掉、第三类不空、clone 表述）；B 口述三问本人作答 AI 验收（Q1 三错一漏 / Q2 实例引用反了 / Q3 分层，当场修正计入证据）；C runbook 盲重画 AI 出题验收（漏5/错4/多3，**用户裁量 runbook 属查阅物不纳入重建对象**）；展板 ①⑦ 组件/数据/断言、8081 发布、状态文件落盘属**白名单展示资产**按实现方模式交付（typecheck + verify 1024/1024 + 线上 V9/V10 全绿为自测证据）。**未对黑名单给 L2 骨架**；执行期未新增 `DEBT.md` 记账。
- **2026-08-27（D4 执行期）**：主线 A（回滚演练）全程导师模式——P1–P6 由本人作答 + AI review；类 2 脚本 v1→v8 迭代中 AI 给到 **L2 定向提示** → **已记入 `DEBT.md`**。`server.js` 修复实现与验证设计由本人完成。
- **2026-09-01（W12 D2，DEBT 类 2 第一档盲重建 → 卡档）**：三点问答中题 1 / 题 3 方向对但缺本案
  机制，题 2 整体偏离（通用 Node 语义推演而非本案脚本构造，sync「阻塞」为 Node 事实错误，未给实测
  且虚构实测表现），按重建梯子判**卡档**，已记入 `DEBT.md`（状态「卡档，待还」）。AI 验收后以 L1
  讲解真实机制；再重建另排（D2 下午机动或 D3 前，仍第一档）。未对黑名单新增 L2 援助，**不新增债务**。
- 欠账：**`Run.getLog()` 已还（2026-08-27 第一档通过）**；**类 2 最小样本 L2 债仍待还**（W12 D2
  第一档已执行 → **卡档**，再重建另排 = D2 下午机动或 D3 前，仍第一档，见 `DEBT.md`）。
