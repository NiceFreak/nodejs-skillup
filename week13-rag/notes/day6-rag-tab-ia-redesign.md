# W13 RAG 展板信息架构重建（执行版）

> 状态：前六页已实现，2026-09-12。展示证据以 technical-v2 为主；rules-c0a4b85 仅保留在学习记录，不进入 RAG 前端。

## 目标

读者打开 W13 页面后，能沿一条固定问答链路回答：我们准备了什么来源、检索如何排序、哪些内容进入模型、响应如何解析，以及引用如何回到原文。每页只承担一个问题，页面交互用于查看对象关系和已有运行边界。

## 导航

1. 主链总览：从 query 到独立评估。
2. 语料与身份：原文、source block、registry、Document 的转换。
3. 检索与排序：BM25、dense、RRF 的返回值和项目层稳定排序。
4. Context 组装：候选、registry 正文、Evidence Context、实际 messages 的边界。
5. 生成与解析：HTTP 响应、JSON/schema 检查和 answered/abstained 分支。
6. 引用与评估：citation resolution、context membership、claim support、evidence coverage 的分层。
7. 失败诊断与 8. 框架边界作为后续专题，暂不在首轮实现。

旧页面 ID 不再作为前端导航目标；需要保留的学习探索通过笔记和证据文件回查。

## 当前证据边界

- snapshot：technical-9c6e6549b991，11 个文件、1502 个 source blocks。
- technical-v2 检索对照的 3 个适用题在 BM25、dense、RRF 中均为 3/3；只有 BM25 接入当前生成入口。
- generation-04 的四个模型案例有独立签认；六个 diagnostic fixture 不调用模型。两类记录不合并统计。
- generation-05 是新的机械运行记录，不能自动继承 generation-04 的语义结论。
- 预算裁剪只作为独立 fixture 观察，未接入主生成链路。
- 当前仍复用 HTTP 模型客户端，尚未使用 ChatModel/LCEL 或 LangGraph runtime。
- 前端不展示动态“待本人确认”状态，也不把旧运行结果伪装成当前质量结论。

## 视觉和交互约束

形状由认知任务决定：主链使用可选阶段流，来源身份使用分层转换，检索使用并列方法卡和统一排序层，Context 使用对象转换，生成使用可选状态机，引用使用 claim 到 source span 的追踪链。交互只展开真实对象、案例和边界；不模拟未实现的重试或模型行为。移动端使用重排后的分步结构，禁止缩小桌面图或依赖横向滚动。

验证重点：六页均可从 W13 导航进入；桌面和移动端无横向溢出；关键选择控件可操作；页面错误为零；文字和图例在实际尺寸下可读。
