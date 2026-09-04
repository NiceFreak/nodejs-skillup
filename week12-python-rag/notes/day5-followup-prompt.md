# W12 遗留项执行提示词（新开对话用）

> 使用方法：把下面代码块整体复制到新对话。该对话的 AI 应先按 `LEARNING-PROTOCOL.md` 恢复状态，再执行本任务。

```
按 LEARNING-PROTOCOL.md 恢复状态后，执行 W12 遗留项收口。背景：W12（9/4）已收口，
DEBT 类 2 已还、Bub 报告 v1、五项交付全过。剩余三个遗留项需要处理，范围与边界如下。

## 遗留项 1（主任务）：B3 展板（tape-context）与 day5 Q2 事实修正同步

背景事实：day5 §5.1 Q2 确认 Bub tape→context 默认渲染规则是 `_select_messages`——
message / tool_call（assistant tool_calls）/ tool_result（role:"tool"）/ anchor 渲染进模型输入，
system/error/event 丢弃；`_default_messages`（只挑 message）是 `select=None` 的 fallback 非默认。
报告 bub-reading-report.md §4 已修正，但 week8-fullstack 展板的 B3（tape-context）主图仍按旧语义
（「只留 message、tool_call/tool_result 不进模型」）构图，见 w12-ai-visualization-plan.md §10.3。

任务：
1. 先读 AGENTS.md、TECHNICAL-WRITING-PROTOCOL.md、SHOWCASE-VISUAL-PROTOCOL.md（改展板必读）、
   bub-reading-report.md §4、w12-ai-visualization-plan.md §10.3、day5 §5.1。
2. 定位 B3 在 aiEngineerTopics.ts / AiEngineerBoard.tsx 中的内容源（含几何、数据标记如
   inDefaultMessages/readStages、断言语义），对照报告 §4 修正为正确语义。
3. 修正 = 独立视觉设计：几何与断言需联动，按 SHOWCASE-VISUAL-PROTOCOL.md 执行；W12 版式规则
   （行号降级为「符号名 + bub@33c417a + 当时 Lxx」折叠证据）继续适用。
4. 验证：yarn typecheck、build、verify:board（含 B3 相关断言）全绿；截图核对桌面/手机两档视口。
5. 汇报：B3 修改的几何/数据标记/断言对照清单 + 验证输出。不改 B3 以外的板，不做无关重构。

## 遗留项 2（可选，按成本取舍）：vendor 快照

当前取舍默认是「文档头注记 clone + checkout 33c417a 即可复核」。若本仓库只需 clone 本仓库即可
精确复核 bub 引用，可评估把 bub@33c417a 主链源码最小快照放入 week12-python-rag/vendor/ 并附
README（来源、commit、快照日期、生成命令）。只快照报告引用到的主链文件（framework/agent/
model_runner/tape/context/hook_impl/store/turn 等），不整仓、不改学习边界。快照后更新相关笔记
的引用路径。不做也接受，记录结论即可。

## 遗留项 3（可选实测）：论断 10

真实 TCP/TLS 下 asyncio.timeout 中途取消是否额外丢弃连接。用 experiments/_slow_server.py +
真实 httpx（非 MockTransport）设计最小实验；结论由仓库主人运行后自写，AI 不代填结论。
不动 production 代码。不做也接受，记录结论即可。

## 边界（不可违反）
- 不修改 Bub 源码（~/Documents/bub 保持只读 detached HEAD 33c417a）。
- 不实现 Agent loop / 终止状态机 / 工具契约 / trace / verifier / eval 设计（黑名单）。
- B3 视觉语义的最终判断归属仓库主人；AI 给方案与实现，主人验收。
- 改动是否 commit 由仓库主人决定；AI 不自动提交。
- 汇报每个遗留项的实际结果：完成 / 记录结论未做 / 卡在哪。
```
