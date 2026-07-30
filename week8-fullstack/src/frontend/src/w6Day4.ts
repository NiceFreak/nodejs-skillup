// W6 Day 4「W3–W6 整体技术总结」数据源（展示资产，纯前端静态数据）。
//
// 唯一来源：week6-testing/notes/day4-overall-technical-summary.md（2026-07-30 已验收）。
// 逐轮纠错过程见同目录 day4-raw-learning-log.md。本文件不新增结论、不改口径。
//
// Day 4 与 Day 1–3 的分工：前三天各自证明一件事（行为可信 / 证据可重复 / 用户走得通），
// Day 4 不再新增功能，而是把 W3 聚合与优化、W4 认证鉴权、W5 运行时、W6 测试与 CI
// 收束成一条有因果关系的主线，并明确哪些结论不能外推。

/** Day 4 的组织框架：四个维度，顺序本身就是论证顺序。 */
export const D4_DIMENSIONS = [
  {
    id: "contract",
    step: "契约",
    title: "系统对用户承诺什么结果",
    detail: "注册创建默认 member 且不签 token；登录成功才签发 JWT；受保护报表按当前角色返回 200 / 403 / 401。",
    tone: "contract",
  },
  {
    id: "duty",
    step: "职责",
    title: "每一层为什么只承担当前工作",
    detail: "认证只确认身份，授权才决定权限；业务意图归 Service，查询实现归 Repository，视图补齐归前端。",
    tone: "duty",
  },
  {
    id: "evidence",
    step: "证据",
    title: "哪些结论由测试或受控实验支持",
    detail: "正反路径集成测试保护行为，CI 让证据脱离本机，三组受控实验各自只支持一句具体结论。",
    tone: "evidence",
  },
  {
    id: "limit",
    step: "限制",
    title: "哪些结果不能外推到生产",
    detail: "生产拓扑、吞吐、最优 Worker 数、真实 OAuth2 与故障注入都没有验证，明确不冒充已解决。",
    tone: "limit",
  },
] as const;

/** 四周各自贡献了什么，以及交给下一环什么。这是 Day 4 的因果链，不是周报罗列。 */
export const D4_MAINLINE = [
  {
    id: "w3",
    week: "W3",
    theme: "聚合与查询优化",
    solves: "报表数字从哪来，以及查询要付出多少工作量",
    handoff: "一条能返回业务结果的聚合链路",
    tone: "w3",
  },
  {
    id: "w4",
    week: "W4",
    theme: "认证与鉴权",
    solves: "谁能看到这份报表，权限变更多久生效",
    handoff: "sub-only JWT + 每次查库的角色判断",
    tone: "w4",
  },
  {
    id: "w5",
    week: "W5",
    theme: "Node.js 运行时",
    solves: "慢在 CPU 还是 I/O，主线程还能不能响应",
    handoff: "判断阻塞与响应性的可测量方法",
    tone: "w5",
  },
  {
    id: "w6",
    week: "W6",
    theme: "测试与 CI",
    solves: "以上结论凭什么可信，换台机器还成不成立",
    handoff: "正反路径证据 + 可重复的执行环境",
    tone: "w6",
  },
] as const;

/** 业务终点：同一个 admin-only 资源的三种结局。 */
export const D4_ENDPOINTS = [
  { path: "无 token", stop: "validateToken", status: "401", tone: "denied" },
  { path: "member token", stop: "requireRole", status: "403", tone: "denied" },
  { path: "admin token", stop: "Controller → Service → Repository → MongoDB", status: "200", tone: "pass" },
] as const;

/** 跨层职责与返回值：重点不是「有几层」，是每层交付物的形状都不一样。 */
export const D4_LAYERS = [
  { layer: "前端", duty: "保存 token、发请求、管理页面状态、补齐视图时间轴", deliver: "连续月份图表数据与页面状态", shape: "view" },
  { layer: "Vite proxy", duty: "把浏览器同源相对路径转发到后端", deliver: "代理后的 HTTP 请求 / 响应", shape: "transport" },
  { layer: "validateToken", duty: "验证 Bearer token，提取 sub", deliver: "req.auth = { sub } 或认证错误", shape: "guard" },
  { layer: "requireRole", duty: "查询数据库当前角色并判断 admin 权限", deliver: "放行或授权错误", shape: "guard" },
  { layer: "参数中间件", duty: "校验并转换 query", deliver: "req.months / req.status", shape: "guard" },
  { layer: "Controller", duty: "读取已校验输入，调用 Service，表达成功 HTTP 响应", deliver: "JSON 数组", shape: "http" },
  { layer: "Service", duty: "计算自然月边界，转换金额 DTO", deliver: "金额为 Number 的稀疏报表数组", shape: "domain" },
  { layer: "Repository / Mongoose", duty: "定义并发起聚合数据访问", deliver: "含 Decimal128 的普通对象数组", shape: "data" },
  { layer: "MongoDB", duty: "执行 $match / $group / $sort / $project", deliver: "聚合结果", shape: "data" },
  { layer: "全局 error handler", duty: "把传播到此处的领域错误翻译成 HTTP", deliver: "401 / 403 / 409 / 500 等响应", shape: "http" },
] as const;

/** 最容易被追问、也最容易讲错的一条形状事实。 */
export const D4_SHAPE_NOTE =
  "await Order.aggregate(...) 不返回 Mongoose document：聚合结果不经过 document hydration，没有 .save() 等实例方法，所以 Service 对数组执行 .map() 不会写回数据库。";

/** §5 关键纠错：初始说法 → 问题 → 最终结论。这是 Day 4 留下的最有复习价值的一张表。 */
export const D4_CORRECTIONS = [
  {
    id: "cd",
    initial: "学到持续发布和事故处理",
    problem: "超出已有证据",
    final: "当前完成 CI、错误边界与进程生命周期学习，不声称 CD 或生产事故处置",
    kind: "overclaim",
  },
  {
    id: "register-token",
    initial: "注册后 JWT 发 token",
    problem: "调用顺序错误",
    final: "注册不发 token，登录成功才签发 JWT",
    kind: "order",
  },
  {
    id: "login-authz",
    initial: "登录后决定能看什么",
    problem: "混淆认证与授权",
    final: "登录确认身份；受保护请求由 requireRole 决定权限",
    kind: "concept",
  },
  {
    id: "admin-only",
    initial: "admin 200 足以证明授权",
    problem: "缺少反例",
    final: "必须与真实 member 403 组成正反证据",
    kind: "evidence",
  },
  {
    id: "repo-dto",
    initial: "Repository 返回最终 DTO",
    problem: "返回边界错误",
    final: "Repository 返回普通对象数组；Service 转换 Decimal128；前端补月份",
    kind: "boundary",
  },
  {
    id: "fake-number",
    initial: "使用未记录的 1.2s → 0.15s",
    problem: "把合理示例冒充事实",
    final: "只使用 W3 Day 5 可追溯的 explain 原始指标",
    kind: "evidence",
  },
  {
    id: "id-index",
    initial: "_id_ 单点结果证明建索引有效",
    problem: "没有无索引对照",
    final: "_id_ 结果只证明当前走索引；因果结论使用 name 前后实验",
    kind: "evidence",
  },
  {
    id: "cors-simple",
    initial: "简单跨域 GET 可能侥幸通过",
    problem: "混淆 preflight 与 CORS 响应检查",
    final: "简单请求只是不预检；缺少允许源时浏览器仍不向 JS 交付响应",
    kind: "concept",
  },
  {
    id: "worker",
    initial: "Worker 不会加速计算",
    problem: "过度外推单次实验",
    final: "本次单任务实验没有显示计算加速",
    kind: "overclaim",
  },
] as const;

export const CORRECTION_KIND_LABEL: Record<string, string> = {
  overclaim: "结论超出证据",
  order: "调用顺序",
  concept: "概念混淆",
  evidence: "证据不成立",
  boundary: "边界归属",
};

/** §6 当前限制：明确「没有证明什么」，与上面的证据一一相对。 */
export const D4_LIMITS = [
  {
    id: "cors",
    title: "生产部署拓扑尚未验证",
    detail: "本地 Vite proxy 保持浏览器同源。若生产前后端分属不同 Origin，需要配置并实测 CORS allowlist、允许方法与 header、preflight 和实际请求；同源反向代理部署则不需要 CORS。",
  },
  {
    id: "timing",
    title: "Login timing 仍可能泄露邮箱是否存在",
    detail: "当前 demo 未公网开放，因此记录为安全遗留，不冒充已解决。",
  },
  {
    id: "envelope",
    title: "错误响应仍有两种形状",
    detail: "{ error } 与 { code, message } 并存，前端需要兼容两种契约。",
  },
  {
    id: "promise-all",
    title: "两份报表没有部分降级",
    detail: "Dashboard 用一个 Promise.all 管理两份报表；任一失败时不展示另一份可能成功的数据，当前没有部分降级需求。",
  },
  {
    id: "teardown",
    title: "CI 异常 teardown 路径未验证",
    detail: "前一步抛错时可能跳过后续清理或环境变量恢复。正常路径已验证，不代表故障注入已完成。",
  },
  {
    id: "scale",
    title: "规模化结论一概不成立",
    detail: "当前实验不能证明生产吞吐、最佳索引集合、最优 Worker 数量或真实 OAuth2 已接入。",
  },
] as const;

/** §7 AI 协作与债务：代表案例的完整还债链。 */
export const D4_DEBT_CHAIN = [
  { date: "2026-07-13", event: "AI 给到 L2 定向提示", detail: "自然月报表边界：滚动窗口 vs 自然月契约、$gte/$lt 半开区间", tone: "owe" },
  { date: "同日", event: "记入 DEBT.md", detail: "黑名单知识点触发 L2 即记账，并排期延迟重建", tone: "owe" },
  { date: "2026-07-16", event: "第一档重建通过", detail: "只允许查看本人一页纸笔记，从空白重建 Service / Repository 与测试", tone: "rebuild" },
  { date: "2026-07-27", event: "无提示独立推导", detail: "把需求改成「本月及前两个月」，自行推导半开区间、跨年与月末边界影响", tone: "paid" },
  { date: "结论", event: "债已还", detail: "代码由本人提交不能排除外包；延迟后能复述数据流、预测变更影响，才是掌握证据", tone: "paid" },
] as const;

/** §8 最终验证：Day 4 当天实际跑过的命令与结果。 */
export const D4_VERIFICATION = [
  { cmd: "npm test -- --runInBand", result: "3 个套件 / 9 个测试全部通过", ok: true },
  { cmd: "npm run lint", result: "0 errors，9 个既有 warnings", ok: true },
  { cmd: "yarn typecheck", result: "通过", ok: true },
  { cmd: "VITE_SHOWCASE_ONLY=1 yarn build", result: "通过", ok: true },
  { cmd: "git diff --check", result: "通过", ok: true },
] as const;
