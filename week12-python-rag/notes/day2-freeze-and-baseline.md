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

- [ ] **第一入口：DEBT 类 2 第一档盲重建**。不看原脚本与既有解释，复述三点：探测时机为何必须在
  close 前发起；三种 close 时序（inCallback / afterListen / sync）各自的竞争语义与实测结果；
  EADDRINUSE 注入为何必须绑同一地址。结论与证据记入 §5，同步更新 `DEBT.md` 状态。
- [ ] 冻结 §3 六项决策（对应 `week12-plan.md` §5）。
- [ ] 建立项目级 Python 3.12 环境、依赖锁定与最小运行入口（白名单：AI 可直接解除环境阻塞，
  不挤占学习时间）。
- [ ] 冻结 Bub 与 DeepSeek Harness 的来源 commit；本周只读 Bub。
- [ ] 在 VS Code 内记录 Codex 与 Cline 扩展的版本、provider、权限模式和规则来源；确认两端加载
  根 `AGENTS.md`。不安装 Claude Code，不使用 Codex App，不开始同题对照。
- [ ] 验证 DeepSeek key 只存在于 gitignored 本地环境。
- [ ] 条件项：root 会话可得时闭合 cp/L55；不可得时保持 BACKLOG（勾选时补一句实际结果）。

## 3. 本人决策冻结区（AI 不预填）

1. **唯一验收句**（什么可证伪结果代表本周通过）：
2. **Python 冒烟测试判据**（什么运行结果证明环境、import 和测试入口可用）：
3. **D5 陌生代码诊断边界**（允许查看哪些资料，什么行为算通过）：
4. **每日止步条件**（什么必须当日收口，什么可降档或进 BACKLOG）：
5. **运行信任边界**（哪些 Bub 结论只来自源码，哪些必须用实验确认）：
6. **prompt v0 与 coding-agent 对照**（适用任务、同题输入、允许材料和可证伪成功条件）：

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

## 6. 收尾清单

- [ ] `DEBT.md` 类 2 条目状态更新（通过 / 卡档 + 证据链接）。
- [ ] `week12-plan.md` §3 D2 清单勾选，未完成项写去向。
- [ ] `LEARNING-STATE.md` 更新：当天结论与 D3 第一动作。
- [ ] 按 `DAILY-SPEAKING-PROTOCOL.md` 生成当天口语稿。
- [ ] git diff 检查无敏感信息（DeepSeek key、公司资料、PII）；是否 commit 由本人决定。

## 7. 明日入口（D3，9/2 周三）

上午定位 Bub 的 CLI/framework 入口、一次 turn 的开始与结束和主要对象创建关系；下午跟主链五条
（turn lifecycle、hook、tape、context rebuild、model/tool/channel）。前置条件：本文件 §3 已冻结、
Python 基线可运行、Bub 来源 commit 已冻结。
