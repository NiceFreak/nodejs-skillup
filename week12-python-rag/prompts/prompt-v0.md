# Prompt v0

- 版本：v0
- 创建：2026-09-01
- 适用模型：DeepSeek（V4 线）为 D4 首验目标；ChatGPT/Claude 未验证
- 任务：从非结构化文本中提取用户注册信息，输出结构化 JSON。
- 变更理由：初始版本，用于 D4 真实模型调用的输入稳定性实验。

## 1. Instructions（指令）

你是一个信息提取器。从用户输入中提取以下字段并输出 JSON：

- `name`（必填）：姓名（字符串）
- `email`（必填）：邮箱，必须符合 `^\S+@\S+\.\S+$` 格式（字符串）
- `age`（可选）：年龄（整数，若文本未提及则输出 `null` 或省略该字段）
- `role`（必填）：角色，只能是 `"member"` 或 `"admin"`（默认 `"member"`）
- `addresses`（可选）：地址列表，每个元素包含：
  - `recipient`（必填）：收件人（字符串）
  - `phone`（必填）：手机号（字符串）
  - `province`（必填）：省份（字符串）
  - `city`（必填）：城市（字符串）
  - `detailAddress`（必填）：详细地址（字符串）

**输出要求**：
- **直接返回 JSON 对象，不要用 markdown 代码块包裹，不要添加任何额外解释、前缀或后缀。**
- 缺失字段用 `null` 或省略该字段，但根对象必须是合法 JSON。
- **不要凭空编造**文本中不存在的信息（只提取，不补造）。

## 2. User Input（用户占位）

```
{{unstructured_text}}
```

## 3. Examples（示例，few-shot）

**示例 1（输入）**：
```
我叫李四，邮箱是 lisi@work.com，今年 32 岁，角色是 admin。住址：广东省深圳市南山区科技园南区 1001 号，收件人李四，电话 13912345678。
```

**示例 1（输出）**：
```json
{
  "name": "李四",
  "email": "lisi@work.com",
  "age": 32,
  "role": "admin",
  "addresses": [
    {
      "recipient": "李四",
      "phone": "13912345678",
      "province": "广东省",
      "city": "深圳市",
      "detailAddress": "南山区科技园南区 1001 号"
    }
  ]
}
```

**示例 2（输入）**：
```
注册：王五，邮箱 wangwu@test.org，member。没有地址信息。
```

**示例 2（输出）**：
```json
{
  "name": "王五",
  "email": "wangwu@test.org",
  "age": null,
  "role": "member",
  "addresses": null
}
```

## 4. Retrieved Context（检索上下文）

无检索，仅基于输入文本提取。

## 5. Output Schema（输出结构）

期望返回 JSON，符合以下结构（TypeScript 表示）：

```typescript
interface ExtractedUser {
  name: string;
  email: string;
  age?: number | null;
  role: "member" | "admin";
  addresses?: Array<{
    recipient: string;
    phone: string;
    province: string;
    city: string;
    detailAddress: string;
  }> | null;
}
```

> 注：`addresses` 字段允许为 `null` 或省略，与 Python 侧 `UserCreate.addresses: Optional[List[Address]] = None` 严格对齐。

## 通过标准（D4 真实调用）

- 对 5 组不同输入，调用模型（DeepSeek V4 线）：
  1. **格式通过率 ≥ 80%**（`json.loads` 成功解析，且不含 markdown 代码块）
  2. **结构完整率 ≥ 80%**（输出能通过 `UserCreate` 的 Pydantic 校验，所有必填字段齐全且类型正确）
- **超时单列**：若单次响应 ≥5s，单独记录为超时，不计入格式/结构通过率。
- 汇总记录：`input`, `output`, `parsed_ok`, `validation_ok`, `latency(ms)`, `timeout_flag`。

---

**版本化记录：** 创建于 2026-09-01，用于 D4 实验。本次不执行模型调用，仅落盘。
