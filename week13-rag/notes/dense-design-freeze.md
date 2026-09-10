# W13 dense retrieval 设计点冻结记录

> 建立：2026-09-10（D4）。用途：记录 W13 计划 §8 的 dense 阶段设计点冻结过程与理由。
> 边界：本文件只记录本人已冻结的语义，AI 不代填。

## 环境前置检查（2026-09-10）

| 项 | 状态 |
|---|---|
| `onnxruntime` | **1.23.2 已安装**（可用 provider：`CoreMLExecutionProvider` / `AzureExecutionProvider` / `CPUExecutionProvider`） |
| `transformers` / `huggingface_hub` / `numpy` | 4.57.6 / 0.36.2 / 2.5.3（已装） |
| PyPI 可达性 | 可达但慢（`pypi.org/simple/` 8 秒才响应） |
| HuggingFace 可达性 | **不可达**（`huggingface.co` 与 `cdn-lfs.huggingface.co` 均返回 `000`，即时失败） |
| 本机模型缓存 | 无（`~/.cache/torch`、`~/.cache/huggingface`、`~/.cache/modelscope` 均不存在） |

## D1 模型与运行时（2026-09-10 冻结）

**决定**：`intfloat/multilingual-e5-small` + `onnxruntime 1.23.2`，fp32 ONNX 模型文件，
`CPUExecutionProvider`，线程数默认。

**理由**：按 W13 计划 §8 的默认候选与首选运行时/精度。

**待验证（模型文件就绪后）**：模型文件 sha256、wheel 版本、provider、输出维度（应为 384）。

### D1/D2 功能验证结果（2026-09-10；`scripts/verify-e5-onnx.py` 可重跑）

| 项 | 结果 |
|---|---|
| provider | `CPUExecutionProvider` ✓（D1 冻结值） |
| ONNX 输入 | `input_ids` / `attention_mask` / `token_type_ids`（XLM-R tokenizer 不产出第三项，按惯例补 0） |
| 输出维度 | **384** ✓ |
| 最长块 | **334** token（`AGENTS.md#L47-L58`），均值 59.9，超 512 的块 = 0 → D2 的 512 上限不会触发截断 |
| 前缀影响 | 同文本加/不加前缀 cosine = **0.9797** |
| 模型文件 | `onnx/model.onnx` sha256 `ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665`（475 MB）；`onnxruntime` 1.23.2 |
| 来源 | `hf-mirror.com`（社区镜像）；**未与官方 hash 交叉验证**（官方源不可达） |

**语义检索功能验证（用 BM25 失败的同一案例）**：

| 检索器 | 相关块 `AGENTS.md#L69` 排名 | 对照块 `SHOWCASE-DEPLOY-PROTOCOL.md#L28` 排名 |
|---|---|---|
| BM25（冻结配置） | 165 | 1 |
| dense（e5-small，D1/D2 配置） | **248** | 88 |

**结论与边界**：

- **dense 在该案例上没有解决 BM25 的排序盲区**：相关块排名更靠后（248 vs 165）。dense top5 为
  `AGENTS.md#L119`(0.8961)、`#L107`(0.8960)、`LEARNING-PROTOCOL.md#L41`(0.8952) 等。
- top5 分数集中在 **0.893–0.896**，区分度很低：e5-small 在这类「任务型 query vs 规则文本」上的区分能力有限。
- 这只是**一条 query 的观察**，不能推广到 10 条 dev；最终结论必须由完整的 dense retrieval-only eval（D3/D4 冻结后）
  与 BM25 三条曲线对照得出。
- 来源限制：模型来自社区镜像，未与官方 hash 交叉验证；功能验证（384 维、前缀、长度、排序行为）已通过，但不构成
  来源真实性证明。

## D2 输入构造与向量生成（2026-09-10 冻结）

**决定**：

1. 前缀：query 加 `query: `，文档加 `passage: `（e5 系列的训练约定）。
2. 最大长度：512 token（e5-small 位置编码上限）；超出即截断并记录（实测块长预期远低于该值）。
3. 池化：mean pooling，对 `last_hidden_state` 按 `attention_mask` 加权平均。
4. 归一化：对池化向量做 L2 归一化，使内积等价于 cosine。

**理由（本人给出）**：按 e5 的标准用法，避免因用法偏离导致质量下降并被误读为「模型能力不足」。

**对照一致性要求**：以上设置冻结后，dense 与 BM25 之间只允许差「打分方式」一个因素（同一 corpus、同一 dev set、
同一 `top_k`、同一 B4.1 门禁）。

## D3 相似度与 top_k（2026-09-10 冻结）

**决定**：相似度用**归一化内积**（因 D2 已冻结 L2 归一化，等价于 cosine）；`top_k = 10`（与 BM25 冻结值
一致），并额外输出 **20 / 30** 两条曲线做同口径对照。

**理由（本人给出）**：保持「dense 与 BM25 只差打分方式」的单因素对照，四个配置可在同一张表内比较。

## D4 eval 复用与记录项（2026-09-10 冻结）

**决定**：

1. **完全复用 B4.1**：交集命中口径 + 覆盖行数/比例诊断 + item 通过 = 该题所有适用 requirement 命中 +
   split 通过 = 全部适用题通过；dev set、corpus、曲线点（10 / 20 / 30）均不变。**唯一变化是打分方式**。
2. **按计划 §8 记录**：provider、线程数、batch、截断情况、冷启动、吞吐、查询 p50 / p95、峰值 RSS。
3. **embedding 缓存**：572 个 passage 向量落盘到 `.cache/`，缓存身份 = 模型文件 sha256 + tokenizer sha256 +
   最大长度 + 池化方式 + 归一化 + 块数；身份不一致即视为缓存失效并重算。

### D1–D4 完成判定（2026-09-10）

四个设计点均已由本人冻结，dense 可进入实现。


