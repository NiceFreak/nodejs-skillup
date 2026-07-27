# AI 推理对比台 · MVP 方案

> 状态：方案已确认，尚未实现  
> 日期：2026-07-27（Asia/Shanghai）  
> 位置：`week7-ai/`  
> 性质：独立、本地运行的可选 AI 展示工具，不改变 W6 学习主线和 2026-07-31 截止安排

## 1. 目标

实现一个带基础 UI 的本地 AI 推理对比台。用户输入同一个问题后，工具分别调用 DeepSeek 的非思考模式和思考模式，并排展示两次请求的最终答案、耗时和 Token 用量；思考模式额外提供可折叠的思考内容。

这个工具不是聊天页面。它的核心价值是让同一输入、同一模型在两种推理配置下形成可观察对比：

- 最终答案有什么差异；
- 思考模式是否带来更长耗时和更多 Token；
- 增加推理过程后，答案是否真的更完整或更准确。

结果只用于观察，不能据此宣称某种模式普遍更好。模型输出具有非确定性，一次运行不是性能基准。

## 2. 与学习主线的关系

- 不修改 `week2-express/` 的 API、鉴权、数据库、测试或 CI。
- 不修改 `week8-fullstack/`，也不进入当前 GitHub Pages 构建与发布链。
- 不读取学习笔记，不生成 W1-W6 的掌握结论，不作为重建或验收证据。
- 实现范围是独立 UI、配置胶水和 DeepSeek 特定 API 接线，可由 AI 完整实现，不产生学习债务。
- 用户在当前主线中不承担该工具的编码、测试设计或讲解任务。

## 3. 用户流程

```text
打开本地页面
→ 输入一个需要推理的问题
→ 点击「运行对比」
→ 页面同时发起非思考 / 思考两次请求
→ 两侧独立显示加载、成功或失败状态
→ 对照最终答案、耗时和 Token
→ 按需展开思考内容
```

同一次运行的两侧请求使用：

- 相同的用户输入；
- 相同的 system prompt；
- 相同的模型；
- 相同的最大输出长度；
- 唯一有意变化的参数是 `thinking.type`。

这能减少无关变量，但不能消除服务端负载、采样和模型非确定性带来的差异。

## 4. 页面结构

```text
┌──────────────────────────────────────────────────────────┐
│ AI 推理对比台                             本地实验        │
│ 同一问题，对比直接回答与思考模式                          │
├──────────────────────────────────────────────────────────┤
│ 问题                                                     │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 多行输入框                                           │ │
│ └──────────────────────────────────────────────────────┘ │
│                                      [清空] [运行对比]    │
├──────────────────────────┬───────────────────────────────┤
│ 直接回答                 │ 思考模式                      │
│ 状态 / 耗时 / Token      │ 状态 / 耗时 / Token           │
│                          │ [展开思考内容]                 │
│ 最终答案                 │ 最终答案                      │
└──────────────────────────┴───────────────────────────────┘
```

响应式要求：

- 桌面端两列并排，便于直接比较。
- 窄屏改为上下排列，直接回答在前、思考模式在后。
- 两个结果区域使用稳定的最小高度，加载和错误状态不得造成明显布局跳动。
- 长文本正常换行；代码或不可断开的内容允许结果区域内部横向滚动，不能撑破页面。

## 5. MVP 功能范围

### 5.1 输入

- 一个多行文本输入框。
- 一个内置示例问题，首次打开时可直接运行。
- 输入为空时禁止发送，并显示就地提示。
- 不保存输入历史，不写入 URL、`localStorage` 或其他持久化位置。

### 5.2 运行对比

- 点击一次产生两次 API 调用，页面明确提示这一成本。
- 两次请求尽量同时开始，分别计时。
- 使用独立结果状态；一侧失败不能抹掉另一侧的成功结果。
- 请求进行中禁用重复提交，避免无意产生多组费用。

### 5.3 结果

每侧展示：

- `idle / loading / success / error` 状态；
- 最终回答；
- 客户端观察到的请求耗时；
- API 返回的输入、输出和总 Token 用量；字段缺失时显示“未返回”，不伪造为 `0`。

思考模式额外展示：

- `reasoning_content`；
- 默认折叠，避免长内容压过最终答案；
- API 未返回时显示明确的空状态。

### 5.4 错误

MVP 区分以下错误表现，但不建立复杂错误分类系统：

- 本地未配置 API key；
- 网络或代理不可达；
- DeepSeek 返回非 2xx；
- 响应不是预期 JSON；
- 成功响应中缺少最终答案。

界面只显示安全、可操作的信息，不回显 Authorization header、API key 或完整内部响应头。

## 6. 技术方案

### 6.1 技术栈

- Vite；
- 原生 TypeScript；
- 原生 HTML / CSS；
- 浏览器 `fetch`；
- 不引入 React、组件库或 OpenAI SDK。

选择原生 TypeScript 是为了保持项目独立和依赖最少。当前页面只有一个输入区和两个结果区，不需要状态框架。

### 6.2 本地请求链路

```text
浏览器
  POST /api/deepseek/chat/completions
        ↓
Vite 本地代理
  从服务端环境读取 DEEPSEEK_API_KEY
  注入 Authorization header
        ↓
https://api.deepseek.com/chat/completions
```

浏览器代码不读取 API key，也不把 key 编译进 JavaScript。API base URL 不是秘密，但仍由本地配置统一管理，避免散落在 UI 代码中。

### 6.3 计划目录

```text
week7-ai/
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts
│   ├── api.ts
│   └── styles.css
└── notes/
    └── ai-reasoning-comparison-plan.md
```

不为 MVP 增加 router、状态管理、测试框架、后端目录或共享 package workspace。

## 7. DeepSeek 请求契约

模型默认使用当前的 `deepseek-v4-flash`，并通过配置保留替换空间。两次请求的关键差异：

```text
直接回答：thinking.type = disabled
思考模式：thinking.type = enabled
```

思考模式的 `reasoning_content` 与最终 `content` 分开读取。MVP 是单轮请求，不拼接历史消息，也不涉及 tool calls，因此不处理多轮 `reasoning_content` 回传规则。

建议的本地环境变量：

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

`.env.example` 只提供变量名和非敏感默认值，不包含真实 key。

参考：

- [DeepSeek · Your First API Call](https://api-docs.deepseek.com/quick_start/pricing-details-usd/)
- [DeepSeek · Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
- [DeepSeek · Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)

## 8. 密钥与发布边界

真实 key 计划迁移到 `week7-ai/.env`。仓库根 `.gitignore` 已忽略 `.env` 和 `.env.*`，但实现时仍必须验证：

```bash
git check-ignore -v week7-ai/.env
git status --short
```

约束：

- key 不使用 `VITE_` 前缀；
- key 不写入源码、`.env.example`、URL、浏览器存储、日志或错误提示；
- key 不进入 `week8-fullstack`；
- `week7-ai` 不加入 Pages 构建、复制或部署步骤；
- 当前工具只承诺通过 Vite 本地开发服务器运行，静态打开 `index.html` 不属于支持范围；
- 若未来需要公开部署，另行选择 BYOK 或服务端代理，不在本 MVP 中预埋部署抽象。

迁移 key 时，同时删除 `week2-express/src/.env` 中重复的 DeepSeek 配置；MongoDB 和 JWT 配置保持原样。

## 9. 验收标准

### 功能

- 配置有效 key 后，一个问题能产生两侧结果。
- 非思考请求显式发送 `thinking.type = disabled`。
- 思考请求显式发送 `thinking.type = enabled`。
- 两侧展示最终回答、独立耗时和 API 实际返回的 Token 信息。
- 思考内容默认折叠并可展开。
- 任一请求失败时，另一侧结果仍然保留。

### 安全与隔离

- 浏览器 Network 面板中的本地请求不包含真实 DeepSeek key。
- 前端源码和构建产物中搜索不到真实 key。
- `git check-ignore -v week7-ai/.env` 能证明真实配置被忽略。
- `git status --short` 不出现 `week7-ai/.env`。
- `week8-fullstack` 和 Pages 发布产物没有新增 AI 请求或运行时依赖。

### 工程与界面

- TypeScript 检查和 Vite 构建通过。
- 本地开发服务器可通过一个 npm script 启动。
- 桌面和移动视口均无重叠、横向页面溢出或不可操作控件。
- 空输入、加载、单侧失败、双侧成功四种状态均完成手动验证。

## 10. 明确不做

- 通用聊天机器人；
- 多轮上下文和历史记录；
- RAG、embedding 或向量数据库；
- tool calls 或 Agent；
- 流式响应；
- 文件上传或读取仓库笔记；
- 用户系统、用量配额或服务端持久化；
- 接入 week2 报表、鉴权或数据库；
- GitHub Pages 或其他公开部署；
- 把一次对比结果包装成模型能力结论。

上述内容需要时进入后续 backlog，不为 MVP 预先设计扩展层。

## 11. 实施顺序

1. 建立最小 Vite + TypeScript 项目和本地环境变量样板。
2. 配置本地代理，先验证两种 thinking 参数都能返回结果。
3. 完成单页 UI 和两侧独立状态。
4. 补齐耗时、Token、折叠思考内容和安全错误提示。
5. 运行 typecheck / build，并检查 key、Git 状态和 Week8 零变更。
6. 使用桌面和移动视口完成最终手动验收。

实施完成后才更新本文状态；在此之前，本文只代表已确认方案，不代表功能已经交付。
