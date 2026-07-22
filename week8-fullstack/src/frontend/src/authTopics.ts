// W4 认证与授权知识板数据。
// 主要来源：week4-auth/notes/day2-password-hash-register-login.md、
// day3-jwt-sign-verify-middleware.md、day4-rebuild-projection-minimal-rbac.md。
// 这里只搬运本人已经完成并验收的结论，不补写新的认证实现。

export interface AuthActor {
  key: string;
  label: string;
  short: string;
  responsibility: string;
}

export interface AuthStep {
  title: string;
  from: string;
  to: string;
  carries: string;
  note: string;
  activates: string[];
  tone: "neutral" | "safe" | "warn";
}

export interface AuthArtifact {
  key: string;
  label: string;
  boundary: string;
}

export interface AuthOutcome {
  condition: string;
  result: string;
  meaning: string;
  tone: "good" | "warn" | "bad";
}

export interface AuthTopic {
  id: string;
  label: string;
  title: string;
  question: string;
  actors: AuthActor[];
  steps: AuthStep[];
  artifacts: AuthArtifact[];
  outcomes?: AuthOutcome[];
  judgment: string;
  mapping: string;
  evidence: string[];
  source: string;
}

export const AUTH_TOPICS: AuthTopic[] = [
  {
    id: "register",
    label: "知识点 1",
    title: "注册与密码存储边界",
    question: "明文密码经过哪些层，最终哪里可以留下什么？",
    actors: [
      { key: "client", label: "客户端", short: "客户端", responsibility: "提交注册凭据" },
      { key: "http", label: "校验 + Controller", short: "HTTP 层", responsibility: "校验格式、读取请求、组织响应" },
      { key: "service", label: "Auth Service", short: "Service", responsibility: "执行密码策略与 bcrypt hash" },
      { key: "storage", label: "Repository + MongoDB", short: "存储层", responsibility: "只持久化 passwordHash" },
    ],
    steps: [
      {
        title: "提交注册凭据",
        from: "client",
        to: "http",
        carries: "name + email + 明文 password",
        note: "明文密码进入请求链路，但不能进入持久化模型或成功响应。",
        activates: ["plain"],
        tone: "warn",
      },
      {
        title: "完成 HTTP 输入校验",
        from: "http",
        to: "service",
        carries: "通过格式校验的注册数据",
        note: "Controller 读取 req.body；密码强度与 hash 属于 Service 的业务职责。",
        activates: ["plain"],
        tone: "neutral",
      },
      {
        title: "生成不可逆密码哈希",
        from: "service",
        to: "storage",
        carries: "passwordHash（bcrypt 内含 salt）",
        note: "随机 salt 破坏相同密码映射为相同输出的规律；数据库不保存明文 password。",
        activates: ["hash"],
        tone: "safe",
      },
      {
        title: "主动构造安全响应",
        from: "http",
        to: "client",
        carries: "201 + name + email",
        note: "save() 返回的当前 document 仍可能带 passwordHash，因此 Controller 不能直接透传完整结果。",
        activates: ["safeResponse"],
        tone: "safe",
      },
    ],
    artifacts: [
      { key: "plain", label: "明文 password", boundary: "只在请求与 Service 内存中短暂停留" },
      { key: "hash", label: "passwordHash", boundary: "允许进入数据库；普通查询默认排除" },
      { key: "safeResponse", label: "安全用户摘要", boundary: "响应只返回 name / email" },
    ],
    judgment: "Service 负责把长期凭据转成不可逆 hash；Repository 只保存 hash；Controller 主动缩小响应边界。",
    mapping: "注册接口创建的是身份与凭据记录，不等于完成登录，也不应允许客户端提交 role 自我提权。",
    evidence: [
      "首次注册返回 201；重复邮箱 409；非法输入 400。",
      "MongoDB 文档包含 bcrypt passwordHash，不包含明文 password。",
      "注册响应与普通 GET 查询均不泄露 passwordHash。",
    ],
    source: "Week4 · 密码哈希 + 注册竖切学习笔记",
  },
  {
    id: "login",
    label: "知识点 2",
    title: "登录凭据验证",
    question: "如何验证密码，同时不泄露账号是否存在？",
    actors: [
      { key: "client", label: "客户端", short: "客户端", responsibility: "提交长期凭据" },
      { key: "http", label: "Controller", short: "Controller", responsibility: "解析请求并返回统一契约" },
      { key: "service", label: "Auth Service", short: "Service", responsibility: "判定凭据是否有效" },
      { key: "storage", label: "Repository", short: "Repository", responsibility: "唯一一次显式取回 passwordHash" },
    ],
    steps: [
      {
        title: "提交邮箱与密码",
        from: "client",
        to: "http",
        carries: "email + 明文 password",
        note: "Login 只验证已有凭据，不重新执行注册时的密码强度策略。",
        activates: ["credentials"],
        tone: "warn",
      },
      {
        title: "按邮箱查询认证材料",
        from: "service",
        to: "storage",
        carries: "findByEmail + select(+passwordHash)",
        note: "passwordHash 默认不可见；只有登录查询显式打开，用完即弃。",
        activates: ["hash"],
        tone: "neutral",
      },
      {
        title: "比较长期凭据",
        from: "storage",
        to: "service",
        carries: "bcrypt.compare(明文, 存量 hash)",
        note: "compare 从存量 hash 中读取 salt 后重算；不能重新 hash 再比较字符串。",
        activates: ["credentials", "hash"],
        tone: "safe",
      },
      {
        title: "收口认证结果",
        from: "service",
        to: "http",
        carries: "安全身份摘要，或统一 InvalidCredentialsError",
        note: "认证成败是 Service 的业务结论；Login 全程不写数据库。",
        activates: ["identity"],
        tone: "safe",
      },
    ],
    artifacts: [
      { key: "credentials", label: "email + password", boundary: "长期凭据，只在 Login 使用" },
      { key: "hash", label: "passwordHash", boundary: "只在 Repository → Service 的认证路径出现" },
      { key: "identity", label: "认证后的身份", boundary: "只保留 userId / name / email" },
    ],
    outcomes: [
      { condition: "邮箱和密码正确", result: "200", meaning: "身份认证通过，进入 JWT 签发", tone: "good" },
      { condition: "密码错误", result: "401", meaning: "邮箱或密码错误", tone: "bad" },
      { condition: "邮箱不存在 / 无 hash", result: "401", meaning: "同一文案，阻止直接账号枚举", tone: "bad" },
    ],
    judgment: "Repository 提供认证所需材料，Service 用 bcrypt.compare 作出认证结论，失败分支统一成同一个 401。",
    mapping: "前端校验只改善体验；后端验证才是不能绕过的安全边界。",
    evidence: [
      "正确凭据 200；错误密码、不存在邮箱、历史无 hash 用户均为相同 401。",
      "成功后 passwordHash 不再向 Controller 传递，Login 不写数据库。",
      "已观察到错误密码与不存在邮箱的响应时间差异，计时枚举作为已知安全遗留。",
    ],
    source: "Week4 · Login 凭据验证学习笔记",
  },
  {
    id: "jwt",
    label: "知识点 3",
    title: "JWT 签发与请求认证",
    question: "长期密码验证通过后，后续请求如何恢复最小身份？",
    actors: [
      { key: "service", label: "Auth Service", short: "Service", responsibility: "验证成功后签发 access token" },
      { key: "client", label: "客户端", short: "客户端", responsibility: "保存并携带 Bearer token" },
      { key: "middleware", label: "validateToken", short: "认证中间件", responsibility: "逐次验证签名、过期与 sub" },
      { key: "route", label: "受保护路由", short: "后续链路", responsibility: "只接收最小身份 req.auth.sub" },
    ],
    steps: [
      {
        title: "凭据验证成功后签发",
        from: "service",
        to: "client",
        carries: "JWT payload = { sub } · expiresIn 1h",
        note: "payload 不放 role、email、name 或密码材料；JWT 内容可被客户端读取。",
        activates: ["jwt", "sub"],
        tone: "safe",
      },
      {
        title: "后续请求携带短期凭证",
        from: "client",
        to: "middleware",
        carries: "Authorization: Bearer <token>",
        note: "后续高频请求不再重复提交长期密码，但 Bearer token 被窃取后仍可被冒用。",
        activates: ["jwt"],
        tone: "warn",
      },
      {
        title: "服务端逐次验证",
        from: "middleware",
        to: "middleware",
        carries: "jwt.verify(token, JWT_SECRET)",
        note: "结构错误、签名无效、过期或缺少 sub 都统一进入请求认证失败 401。",
        activates: ["jwt", "secret"],
        tone: "neutral",
      },
      {
        title: "恢复最小身份声明",
        from: "middleware",
        to: "route",
        carries: "req.auth = { sub }",
        note: "认证中间件回答“你是谁”；它不在这里判断角色或具体资源权限。",
        activates: ["sub"],
        tone: "safe",
      },
    ],
    artifacts: [
      { key: "secret", label: "JWT_SECRET", boundary: "只在服务端环境变量；缺失或过短时失败" },
      { key: "jwt", label: "access token", boundary: "1 小时 Bearer 凭证，不等于不可窃取" },
      { key: "sub", label: "sub", boundary: "token 与 req.auth 中唯一业务身份声明" },
    ],
    outcomes: [
      { condition: "无 token / 格式错误", result: "401", meaning: "不能确认请求者身份", tone: "bad" },
      { condition: "篡改 / 过期 / 无 sub", result: "401", meaning: "Token 无效或已过期", tone: "bad" },
      { condition: "验证通过", result: "next()", meaning: "携带 req.auth.sub 进入后续链路", tone: "good" },
    ],
    judgment: "JWT 是服务端逐次验证的短期身份凭证；最小 payload 只放 sub，认证与授权继续分层。",
    mapping: "给存量接口接入 validateToken 属于契约变更，前端、Postman 与集成测试等消费方都必须同步。",
    evidence: [
      "正确登录签发 JWT，解码后 sub 与用户 _id 一致，exp - iat = 3600。",
      "无 token 请求受保护报表返回 401；有效 token 可进入后续链路。",
      "JWT_SECRET 缺失时服务启动失败，Service 签发点另有防御性校验。",
    ],
    source: "Week4 · JWT 签发与验证中间件学习笔记",
  },
  {
    id: "rbac",
    label: "知识点 4",
    title: "RBAC 与 401 / 403 分界",
    question: "身份已经确认后，谁决定这个角色能否进入接口？",
    actors: [
      { key: "client", label: "客户端请求", short: "请求", responsibility: "携带 Bearer token 访问 admin-only 报表" },
      { key: "authn", label: "validateToken", short: "认证", responsibility: "验证 token，恢复 req.auth.sub" },
      { key: "authz", label: "requireRole('admin')", short: "授权", responsibility: "查询并判断数据库当前 role" },
      { key: "route", label: "Controller / 报表", short: "业务接口", responsibility: "只接收已经通过认证与路由授权的请求" },
    ],
    steps: [
      {
        title: "先完成请求认证",
        from: "client",
        to: "authn",
        carries: "Bearer token",
        note: "没有有效身份时链路止于 401，不进入参数校验或业务查询。",
        activates: ["401", "sub"],
        tone: "neutral",
      },
      {
        title: "把主体交给授权层",
        from: "authn",
        to: "authz",
        carries: "req.auth.sub",
        note: "token 不携带 role，避免权限成为签发时的过期快照。",
        activates: ["sub"],
        tone: "safe",
      },
      {
        title: "查询数据库当前角色",
        from: "authz",
        to: "authz",
        carries: "findUserRoleById(sub)",
        note: "角色型路由授权属于 requireRole；数据库异常必须原样交给全局错误处理，不能伪装成 403。",
        activates: ["role"],
        tone: "neutral",
      },
      {
        title: "按接口契约决定是否放行",
        from: "authz",
        to: "route",
        carries: "admin → next() · member → 403",
        note: "403 表示身份已经确认，但数据库当前角色不满足 admin-only 路由要求。",
        activates: ["403", "200", "role"],
        tone: "safe",
      },
    ],
    artifacts: [
      { key: "sub", label: "req.auth.sub", boundary: "认证层交给授权层的最小主体身份" },
      { key: "role", label: "数据库 User.role", boundary: "当前权限的唯一可信来源" },
      { key: "401", label: "401", boundary: "无法确认“你是谁”" },
      { key: "403", label: "403", boundary: "身份有效，但“你不能进这个接口”" },
      { key: "200", label: "200", boundary: "admin 通过角色门槛进入报表" },
    ],
    outcomes: [
      { condition: "无有效 token", result: "401", meaning: "认证失败", tone: "bad" },
      { condition: "member + 有效 token", result: "403", meaning: "认证通过，授权失败", tone: "warn" },
      { condition: "admin + 有效 token", result: "200", meaning: "认证与授权均通过", tone: "good" },
    ],
    judgment: "validateToken 回答“你是谁”，requireRole 用数据库当前 role 回答“这个角色能否进入接口”。",
    mapping: "角色型路由权限适合中间件；具体订单归属等资源级授权仍应由 Service 查询资源并判断。",
    evidence: [
      "真实链路：validateToken → requireRole('admin') → 参数校验 → Controller。",
      "无 token 401、member token 403、admin token 200 三条路径均已实跑。",
      "首版把所有异常转成 403 被 review 打回；数据库异常现保持原样透传。",
    ],
    source: "Week4 · 最小 RBAC 与 401/403 学习笔记",
  },
];
