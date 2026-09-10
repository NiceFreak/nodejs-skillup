# W13 生成模型策略（model-policy v1）

> 建立：2026-09-10（D4）。用途：把「用哪个模型」从散落在笔记里的假设变成一条可追溯的配置记录，并把
> 「模型退役 / 升级」当作一类需要门禁的变更，而不是一次性的口径问题。
>
> 边界：本文件记录**请求值**与**已知路由事实**；它不承诺服务端权重不变，也不替代运行证据。

## 1. 当前记录

| 项 | 值 |
|---|---|
| 逻辑名（本实验使用） | `w13-generation` |
| 请求字段值 | `deepseek-v4-flash` |
| 传输 | Chat Completions |
| 模式 | non-thinking（请求显式发送 `thinking: disabled`；接线验证在 D4 阶段 3） |
| 已知路由 | 官方文档（检索 2026-09-10）标注该名为 **legacy name**、对应模型**已退役**，请求由 `DeepSeek-V4.1-Flash` 提供服务并按 Flash 计费 |
| 当前主名 | `deepseek-flash`（官方页 MODEL 列） |
| 外部容量事实 | `CONTEXT LENGTH 1M`、`MAX OUTPUT MAXIMUM: 384K` |
| 本实验输出预留 | `max_tokens = 4096`（自设上限，不是厂商上限） |
| 来源 | DeepSeek Models & Pricing、Token & Token Usage（检索 2026-09-10） |

## 2. 运行证据必填字段（每次真实调用）

| 字段 | 来源 | 为什么必填 |
|---|---|---|
| `requested_model` | 我方请求 payload | 证明请求按冻结配置发出 |
| `served_model` | 响应 `model` 字段 | 别名可能被路由，结论必须绑定实际提供服务的模型 |
| `system_fingerprint` | 响应字段（若提供） | 服务端实现变化的可观察信号 |
| `usage` | 响应字段 | 真实处理量，与离线 estimate 分开记录 |
| `created` / 本地时间 | 响应 / 本地 | 运行锚点 |
| `thinking` / `max_tokens` | 我方请求 payload | 证明模式与输出预留被显式发送 |

**实现状态（2026-09-10）**：上述字段已在 `src/w13rag/generation.py` 的 `RunRecord` 落地，并由
`tests/test_generation_payload.py` 的 payload 用例断言「确实进入请求体」。

## 3. 升级与退役的处理规则

1. **请求字段与逻辑名分离**：换模型只改请求字段，不改 Prompt、response schema、评测规则或代码结构。
2. 订阅厂商 changelog，把「模型弃用」登记为一次带日期的变更，而不是运行当天才发现。
3. 换模型（或被路由到新模型）后，必须在同一冻结 dev 集上重跑并按冻结阈值比较；通过才更新本记录。
   首次 holdout 的纪律不变：只在全部冻结后运行，且首次结果不用于调参。
4. **结论绑定身份**：写「在本次运行观察到的 `served_model = X` 条件下…」，不写「某别名下…」。
5. 不把版本号当作行为冻结手段：托管模型无法位级冻结；可复现性来自「冻结输入 + 记录身份 + 评测门禁」。

## 4. 适用范围

- 本记录只覆盖 W13 的生成模型。W14 Agent、W15 MCP、W16 reliability/evals 若使用其它模型或供应商，
  各自建立同形状的记录，不共用本文件。
- 官方页信息属外部事实，检索日期之后可能变化；变化时更新本文件并重新核对 §1，不改写历史记录。
