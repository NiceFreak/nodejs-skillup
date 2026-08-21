// W10 可观测性链路的 canonical 事实（展示资产，纯前端静态数据）。
//
// 与 w9Facts.ts 分开的理由和当初 w9Facts 从 evidenceSets 分开是同一条：
// 两块板遍历各自的全量数据，混在一起会让 W9 板凭空多出它没有叙述的条目。
//
// 数字来源：week10-observability/notes/ 下的
//   day1-observability-contract.md  §5.1 字段契约 / §5.3 四项判据 / §5.5 只读基线
//   day2-logging-rollout.md         §2.3 九个 location / §2.5 七项验证 / §11 实测记录
//   day3-monitoring-alerting.md     §2.3 验证表 / §3 P1–P5 / §9 弄红与 timer 执行记录
//   day4-fault-drills.md            §6 三类演练的五段式记录 / §10 收口对照与残留核零
//   nginx/nginx.conf-http-logging.md（log_format 与 access_log 的关系）
//   checks/（四个检查脚本与八个 unit 的入库副本）
// 方法稿见 week10-observability/notes/week10-visualization-plan.md。
//
// 唯一真源纪律：下面这些数字（9 个 location / 272M / 500M / 1304MB / 200MB / 4GB /
// 31G / 86 天 / 15 天 / 1203MB / 84 天 / 17:03–17:18 那串时刻）只在本文件出现一次，
// 组件里不得再写字面量。

/**
 * 证据档位。W9 用的是 measured / derived / pending，W10 装不下——
 * 本周存在大量「已拍板、要等 D3/D4 才被检验」的条目，它们既不是实测也不是推演。
 *
 * derived（推演）错了是**推理错**，就地修正即可；
 * contract（已拍板）错了是**决策要改**，要重新走一遍冲突自查。
 * D2 当天就现身说法：P2 把 D1 Q6 的「$time_iso8601 是 UTC」推翻成「接受 +08:00 偏移」,
 * 那不是算错了，是契约条目被执行期事实推翻后重新拍的板。两者混成一档，复盘时找不到该改哪里。
 */
export type W10Grade = "measured" | "contract" | "pending";

export const W10_GRADE: Record<W10Grade, { label: string; meaning: string }> = {
  measured: {
    label: "已实测",
    meaning: "有命令输出、日志原文或验证记录，可追溯到实际执行。",
  },
  contract: {
    label: "已拍板",
    meaning: "已作出明确决定，但尚未实现或尚未完成验证。",
  },
  pending: {
    label: "待做",
    meaning: "证据尚未产生，或已确认需要修改但尚未完成。",
  },
};

/* ============================================================ ① 盲区：请求终局 */

/** 一个请求可能的终局，以及它在改造前后各留下什么证据。 */
export interface RequestEnding {
  id: string;
  /** 终局名（术语侧）。 */
  name: string;
  /** 什么情况下会走到这个终局。 */
  trigger: string;
  /** 8/17 之前留下的证据；evidence 为空串表示「什么都没有」。 */
  before: { has: boolean; evidence: string };
  /** 8/18 之后留下的证据。 */
  after: { has: boolean; evidence: string };
  grade: W10Grade;
  /** 只有 after.has === false 的那一格需要它：解释为什么这一格空着是对的。 */
  byDesign?: string;
  /** 证据强度不到「已实测」时，把差在哪写清楚——不能靠档位标签一个词带过。 */
  caveat?: string;
}

/**
 * 四个终局。顺序按「离正常有多远」排，不按重要性——
 * 因为本块的结论恰恰是「最不正常的那个终局，此前一条日志都没有」。
 *
 * 第三格是本块的立身之处：它在改造后**仍然是空的**，而这是对的。
 * 把它去掉会让图变得整齐，也会让「盲区被填满了」变成一句谎话。
 */
export const REQUEST_ENDINGS: RequestEnding[] = [
  {
    id: "finish",
    name: "正常走完",
    trigger: "响应发送完毕，res 触发 finish",
    before: { has: true, evidence: "一行文本：logger:  GET /users 200 12 ms" },
    after: {
      has: true,
      evidence: "一行 NDJSON，九个必有字段齐（method / path / statusCode / requestId / duration / ip / ua / errorType / requestStatus）",
    },
    grade: "measured",
  },
  {
    id: "close",
    name: "客户端中途断开",
    trigger: "客户端断开或上游超时，res 触发 close 而非 finish",
    before: { has: false, evidence: "" },
    after: {
      has: true,
      evidence: "一条 requestStatus=close，与 finish 共用去重标志，每请求至多一条",
    },
    grade: "measured",
  },
  {
    id: "noserver",
    name: "请求没进 Node",
    trigger: "反代配错、502、Nginx 层直接拒绝",
    before: { has: false, evidence: "" },
    after: { has: false, evidence: "" },
    byDesign:
      "请求未进入 Node，因此 Node 不会产生日志；应在 Nginx access.log 中查询带 rid 的记录。",
    caveat:
      "8/20 已实际注入反代配置错误，根路径返回 502，错误日志记录上游连接失败。但当天未分别取样验证 Node 无日志且 Nginx 有同一 id，因此该项仍为已拍板。",
    grade: "contract",
  },
  {
    id: "error",
    name: "进程内出错",
    trigger: "error handler 接住的任何错误",
    before: {
      has: true,
      evidence: "有 console.error，但与请求日志没有共同 id，并发请求下无法关联",
    },
    after: {
      has: true,
      evidence: "pino error / warn，带同一个 requestId + errorType（错误类名，不是 message）",
    },
    caveat:
      "该结构来自已上线的 error handler；D2 验证未单独保留错误日志原文，因此证据等级仍为已拍板。",
    grade: "contract",
  },
];

/** 「Node 日志里查不到这次请求」的两种含义。靠 id 的形态分，不靠猜。 */
export const MISSING_LOG_BRANCHES = [
  {
    id: "nginx-only",
    symptom: "Node 侧完全查不到，Nginx access.log 里有一条",
    verdict: "请求没进 Node",
    next: "使用 access.log 中的 rid 查询 error.log，检查 connect() failed 或 no live upstreams",
    grade: "contract" as W10Grade,
  },
  {
    id: "local-prefix",
    symptom: "Node 侧查到了，但 requestId 是 local- 开头",
    verdict: "走到 Node 了，但没经过 Nginx（直连 3000 或反代没传头）",
    next: "该 id 不会出现在 access.log；先确认请求是否直连 Node，或反代是否遗漏传递请求头",
    grade: "measured" as W10Grade,
  },
];

/** requestId 的两种形态。local- 前缀不是降级失败，是自解释的分支。 */
export const REQUEST_ID_FORMS = [
  { id: "nginx", source: "Nginx $request_id", shape: "32 位十六进制", sample: "63245c0a…", meaning: "走了反代，两条流都查得到" },
  { id: "local", source: "Node 本地兜底", shape: "local- + UUID", sample: "local-…", meaning: "没走反代，Nginx 侧不会有对应记录" },
];

/**
 * 验证③ 的踩点：第一次没造出断连，不是实现有问题，是**测试方式**不成立。
 * 留在板上是因为它本身就是一条可迁移的教训——验证方法自己也会失效。
 */
export const CLOSE_TEST_NOTE = {
  failed: "curl --max-time 0.05 打登录接口",
  why: "bcrypt 快路径 4 ms，50 ms 超时未触发，所有请求均走 finish",
  worked: "改用 100 KB body + 限速，curl 退出码 28（超时）",
  result: "requestStatus=close 恰好一条，请求日志流 uniq -d 无重复",
};

/* ==================================================== ⑥ 假生效：三项自动检查与实例 */

/** 一道自动检查。checks 写清它到底在查什么——本块的全部张力都在这一列。 */
export interface GreenGate {
  id: string;
  name: string;
  checks: string;
  blind: string;
}

export const GREEN_GATES: GreenGate[] = [
  { id: "nginxt", name: "nginx -t", checks: "配置文件语法", blind: "指令作用域、继承结果，以及已定义的日志格式是否被引用" },
  { id: "redact", name: "pino redact", checks: "日志对象中的字段路径", blind: "已拼接为字符串的内容；它不解析字符串中的凭据" },
  { id: "eslint", name: "eslint no-console", checks: "源码里的裸 console.*", blind: "logger 调用不在 no-console 的检查范围；logger.error(obj, msg) 的 msg 参数是合法调用" },
];

export type GateVerdict = "passed" | "na";

/** 一条「自动检查放行了但语义没生效」的实例。 */
export interface FalseGreen {
  id: string;
  /** 一句话说这是什么。 */
  title: string;
  /** ❌ 想当然的说法。 */
  initial: string;
  /** ⚡ 实际机制。 */
  mechanism: string;
  /** ✅ 修正 / 处置。 */
  fix: string;
  /** 三项自动检查各自的结果：passed = 放过去了，na = 这一项不覆盖这类。 */
  gates: Record<string, GateVerdict>;
  /** 真正抓到它的是谁。 */
  caughtBy: "reasoning" | "selfcheck" | "review" | "none";
  caughtDetail: string;
  /** 良性：同一机制这次站在我们这边，不是缺陷。 */
  benign?: boolean;
  grade: W10Grade;
}

export const CATCHERS: Record<FalseGreen["caughtBy"], string> = {
  reasoning: "事前推理",
  selfcheck: "配置逐行核对",
  review: "review",
  none: "符合预期",
};

/**
 * 四条实例。前三条是「配置改了但没生效」的同一族（day2 §2.3、§11、nginx 副本各记了一条），
 * 第四条是脱敏那条漏。放在一起是因为它们的失效机制完全相同：
 * **自动检查通过的是它自己那一层，而不是你以为的那件事。**
 *
 * 第三条（/health）标了 benign：同样是「location 层把上层挡住」，
 * 这一次结果正是想要的（探针天然不出公网）。留着它是为了说明
 * 机制本身不分好坏——分好坏的是你有没有意识到它在起作用。
 */
export const FALSE_GREENS: FalseGreen[] = [
  {
    id: "proxyheader",
    title: "proxy_set_header 写在 server 级",
    initial: "原判断：四份 site 在 server 级设置 X-Request-Id 后，所有反代路径都会继承。",
    mechanism:
      "location 内只要定义任一 proxy_set_header，就不会继承上层同指令族。九个反代 location 均已定义 Host，因此 server 级的 X-Request-Id 对它们不生效。",
    fix: "在九个反代 location 中分别设置 X-Request-Id（P1 选择方案 a）。该方案存在重复，但配置含义明确且不依赖继承语义。",
    gates: { nginxt: "passed", redact: "na", eslint: "na" },
    caughtBy: "reasoning",
    caughtDetail: "P1 推理时发现；验证⑤通过同一 id 关联 Nginx 与 Node，是唯一能够证伪该配置的实验",
    grade: "measured",
  },
  {
    id: "logformat",
    title: "log_format 定义了，access_log 没指定它",
    initial: "原判断：在 http 块定义 log_format obs 后，Nginx 会自动使用该格式。",
    mechanism:
      "log_format 只定义格式模板。access_log 未指定 obs 时仍使用默认 combined，记录中没有 $request_id；两行配置均能通过 nginx -t。",
    fix: "在 access_log 中显式指定 obs 格式。",
    gates: { nginxt: "passed", redact: "na", eslint: "na" },
    caughtBy: "selfcheck",
    caughtDetail: "逐行核对本地副本与服务器配置时发现；验证⑤的首轮日志关联曾因此中断",
    grade: "measured",
  },
  {
    id: "queryleak",
    title: "err.message 里拼了 req.url",
    initial: "原判断：redact 已配置 req.query 凭据字段，因此查询串凭据不会进入日志。",
    mechanism:
      "redact 只处理对象路径。404 的 err.message 拼接 req.url 后，查询串以字符串形式进入 message，再由 error handler 写入日志；redact 不解析字符串，eslint 也不会阻止合法的 logger 调用。",
    fix: "同时修改两处：catch-all 改用不含查询串的 req.path；error handler 的消息参数改为不含请求原文的固定描述。单独修改任一处都不能消除全部泄漏路径。",
    gates: { nginxt: "na", redact: "passed", eslint: "passed" },
    caughtBy: "review",
    caughtDetail: "上线前 review 发现；密码或凭据进入日志属于上线止步条件 2",
    grade: "measured",
  },
  {
    id: "healthgate",
    title: "/health 未配置公网访问入口",
    initial: "原判断：新增 /health 路由后，该路径会从公网可访问。",
    mechanism:
      "80 / 443 的 location / 返回 404，形成 URL 白名单。/health 未被显式放行，因此只可通过 127.0.0.1 访问。",
    fix: "保持现状。检查脚本在本机访问 127.0.0.1:3000/health，与 3000 端口仅监听 loopback 的边界一致，也减少一个公网攻击面。",
    gates: { nginxt: "na", redact: "na", eslint: "na" },
    caughtBy: "none",
    caughtDetail: "该行为符合既定的公网路径白名单与本机健康检查边界",
    benign: true,
    grade: "measured",
  },
];

/* ================================================================ 板级与进度 */

/**
 * 本板的七块。第七块是 D3 当天新增的——方案定的六块里没有它，
 * 因为「检查凭什么可信」这个问题要等到真有检查、并且真弄红过一次之后才存在。
 * ⑤ 是最后落地的一块，押到 8/20 演练收口之后才做：在真注入之前，
 * 那三类的「首个症状」还只是预测，画出来就是把预测冒充成实测。
 */
export const W10_STAGE_PLAN = [
  { id: "falsegreen", title: "⑥ 发布检查盲区", question: "四个实例为何均未触发检查失败", done: true },
  { id: "blindspot", title: "① 请求中断日志", question: "请求中断时留下哪些日志", done: true },
  { id: "journey", title: "③ requestId 跨层传递", question: "X-Request-Id 配置在哪些反代 location", done: true },
  { id: "fields", title: "② 日志字段契约", question: "必有、可选与契约外字段是否符合约定", done: true },
  { id: "thresholds", title: "④ 告警阈值依据", question: "三项告警阈值依据哪些实测", done: true },
  { id: "redproof", title: "⑦ 检查脚本验证", question: "检查脚本经过哪些红态验证", done: true },
  { id: "drill", title: "⑤ 故障注入与定位", question: "真实故障是否会触发检查告警", done: true },
  // 第八块是 8/21 收口日建成的：前七块的产出是改动，这一块的产出是「别人照着能用的判断」。
  // 它不是 ⑤ 的分页——⑤ 那三页拆的是一块内容怎么呈现，这里是真的多建成了一块。
  { id: "runbook", title: "⑧ runbook 验收", question: "不看笔记，能否按 runbook 走通两类故障", done: true },
];

/** 板头计数：把已落地各块里的事实按档位数一遍，不手写数字。 */
export function gradeCounts(): Record<W10Grade, number> {
  const all: W10Grade[] = [
    ...REQUEST_ENDINGS.map((e) => e.grade),
    ...MISSING_LOG_BRANCHES.map((b) => b.grade),
    ...FALSE_GREENS.map((f) => f.grade),
    ...JOURNEY_STEPS.map((j) => j.grade),
    ...TWO_SETS.map((t) => t.grade),
    ...LOG_FIELDS.map((f) => f.grade),
    ...REDACT_GATES.map((g) => g.grade),
    ...RED_PROOFS.map((r) => r.grade),
    ...CHECK_UNITS.map((u) => u.grade),
    ...MONITOR_SELF.map((m) => m.grade),
    ...THRESHOLD_RULERS.map((t) => t.grade),
    ...DRILLS.map((d) => d.grade),
    ...DRILLS.flatMap((d) => (d.rootCause ? [d.rootCause.grade] : [])),
    ...LOCATE_SIGNALS.map((s) => s.grade),
    ...BLIND_SPOTS.map((b) => b.grade),
    // ⑧ 收口日的四条：通用首查、延迟自测、取整区间的对照，以及两条收尾各自走到的终点。
    FIRST_CUT.grade,
    SELF_TEST.grade,
    ROUNDING_BAND.grade,
    ...CLOSEOUT_TRACKS.map((t) => t.end),
  ];
  return {
    measured: all.filter((g) => g === "measured").length,
    contract: all.filter((g) => g === "contract").length,
    pending: all.filter((g) => g === "pending").length,
  };
}

/* ================================================== ③ 日志旅程：一根 id 的四步 */

/** 旅程的一步。lane 决定它落在哪条泳道上。 */
export interface JourneyStep {
  id: string;
  lane: "client" | "nginx" | "node";
  title: string;
  detail: string;
  grade: W10Grade;
}

/**
 * 四步。第 2 步是本块的重心——它不是「一处配置」，是九处。
 * 客户端两端（发起与收到响应）合成首尾两步，不单独占泳道格，
 * 否则「两条日志流」这条主结论会被四条泳道冲淡。
 */
export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "gen",
    lane: "nginx",
    title: "Nginx 生成 $request_id",
    detail:
      "内置变量（1.11.0+），每个请求生成一个 32 位十六进制值，并写入 access.log。四份 site 共用 http 块中的一份 access_log，格式只定义一次。",
    grade: "measured",
  },
  {
    id: "pass",
    lane: "nginx",
    title: "proxy_set_header X-Request-Id 传给 Node",
    detail:
      "九个反代 location 分别设置该请求头。location 内只要定义任一 proxy_set_header，就不再继承 server 级的整个同类指令集，且该配置仍能通过 nginx -t。",
    grade: "measured",
  },
  {
    id: "read",
    lane: "node",
    title: "中间件直读 req.headers['x-request-id']",
    detail:
      "当前不引入显式传参或 AsyncLocalStorage。请求头缺失时生成 local- 前缀的本地 id，确保 requestId 必有字段始终存在。",
    grade: "measured",
  },
  {
    id: "echo",
    lane: "node",
    title: "响应头回写 X-Request-Id",
    detail:
      "在 next() 前回写最终采用的 id：优先使用请求头，否则使用 local- 本地 id，确保响应头与日志一致。",
    grade: "measured",
  },
];

/** 一份 site 上要挂几处。静态 location 不挂——它根本不反代。 */
export interface ProxySite {
  id: string;
  name: string;
  port: string;
  proxyLocations: string[];
  staticNote: string;
}

/**
 * 九个挂点。D1 §5.1 写的是「四份 server 块全部加」，落到配置层才发现
 * 真正的计数单位是反代 location，不是 server 块——这就是本块的一眼结论。
 */
export const PROXY_SITES: ProxySite[] = [
  { id: "shop", name: "shop", port: "80", proxyLocations: ["= /", "/auth", "/reports"], staticNote: "location / 返回 404，不进行反代，无需配置请求头" },
  { id: "shop-ssl", name: "shop-ssl", port: "443", proxyLocations: ["= /", "/auth", "/reports"], staticNote: "/admin/ 为 alias 静态产物，无需配置请求头" },
  { id: "shop-admin", name: "shop-admin", port: "8080", proxyLocations: ["/auth", "/reports"], staticNote: "root dist 为静态资源，无需配置请求头" },
  { id: "shop-showcase", name: "shop-showcase", port: "8081", proxyLocations: ["/auth"], staticNote: "root dist-showcase 为静态资源，无需配置请求头" },
];

/** 挂点总数从数据算，不手写——加一个 location 忘了改文案就会对不上。 */
export function proxyLocationCount(): number {
  return PROXY_SITES.reduce((n, s) => n + s.proxyLocations.length, 0);
}

/**
 * 三个「两套」。这张表是「为什么必须有一根 id」的完整答案：
 * 两条流在落点、轮转、时间口径上没有一处是共用的。
 */
export const TWO_SETS = [
  {
    id: "sink",
    aspect: "落点",
    nginx: "文件 /var/log/nginx/access.log（四份 site 共用一份）",
    node: "stdout → systemd → journald（二进制索引）",
    grade: "measured" as W10Grade,
  },
  {
    id: "rotate",
    aspect: "轮转",
    nginx: "logrotate：daily + rotate 14 + compress",
    node: "journald 自己的上限：SystemMaxUse=500M（D2 设定，当前占用 272M）",
    grade: "measured" as W10Grade,
  },
  {
    id: "time",
    aspect: "时间戳",
    nginx: "$time_iso8601 = 本地时间带偏移（+08:00）",
    node: "pino isoTime = 真 UTC（Z 结尾）",
    grade: "measured" as W10Grade,
  },
];

/**
 * 时间口径不统一是**拍板的结果**，不是待修项。
 * D1 Q6 原写「Nginx 也走 UTC」，执行期发现 $time_iso8601 带偏移，P2 重新拍板。
 */
export const TIME_DECISION = {
  goal: "让排障人员明确识别两类时间戳，避免把固定 8 小时时差误判为异常",
  chosen: "保留 Nginx 的 +08:00 偏移与 Node 的 UTC Z；runbook 明确写明 Nginx 时间换算到 UTC 时减 8 小时",
  rejected: "不单独给 Nginx unit 设置 TZ=UTC，因为这会使 Nginx 与系统其他日志的时间口径不同，并增加维护规则",
};

/** 两个耗时不是同一个数。写串一次就会把正常的差当成 bug 查半天。 */
export const DURATION_SPLIT = [
  { id: "nginx", label: "rt=$request_time（Nginx）", covers: "从收到请求第一个字节到发出响应最后一个字节，包括 TLS 握手后的排队、读取 body 与响应回传" },
  { id: "node", label: "duration（Node）", covers: "从请求日志中间件入口到 res 触发 finish，不包括 Nginx 侧排队及进入 Node 前的请求读取时间" },
];

/** 验证⑤ 的实测证据：同一个 id 在两条流里各一条。 */
export const JOURNEY_EVIDENCE = {
  id: "63245c0a",
  idFull: "63245c0a…（32 位十六进制，板上只显示前 8 位）",
  nginxLine: "access.log 一条：rid=63245c0a… 时间戳带 +08:00",
  nodeLine: "journald 一条：\"requestId\":\"63245c0a…\" 时间戳 Z 结尾",
  header: "公网 443 响应头 X-Request-Id: 63245c0a…",
};

/* ========================================== ② 字段契约兑现核对：说好的兑现了吗 */

/** 契约里的一行，以及它在实测那一行 NDJSON 里对应的键。 */
export interface LogField {
  id: string;
  /** D1 §5.1 的字段名（契约侧措辞）。 */
  contract: string;
  required: "must" | "optional";
  /** 实测 NDJSON 里的键；未实现时为 null。 */
  actual: string | null;
  /** 没有它查不了什么。 */
  blindWithout: string;
  grade: W10Grade;
  note?: string;
}

/**
 * 十行 = D1 §5.1 的十行，顺序不动。
 * 九条必有全部兑现，两条可选都没实现——而契约写的就是「可选 / 不进核心」，
 * 因此两条可选字段未实现符合契约，核对时同时检查必有字段与可选字段。
 */
export const LOG_FIELDS: LogField[] = [
  { id: "time", contract: "时间戳", required: "must", actual: "time", blindWithout: "时间范围统计与回溯", grade: "measured", note: "pino isoTime，Z 结尾" },
  { id: "method", contract: "method", required: "must", actual: "method", blindWithout: "同路径 GET / POST 的错误率分不开", grade: "measured" },
  { id: "path", contract: "path（req.path，不含查询串）", required: "must", actual: "path", blindWithout: "分不清哪个接口；扫描与业务错误混在一起", grade: "measured", note: "不含查询串这一条同时是脱敏的一环" },
  { id: "status", contract: "statusCode", required: "must", actual: "statusCode", blindWithout: "「500 多少次 / 404 洪峰」统计不了", grade: "measured" },
  { id: "rid", contract: "requestId", required: "must", actual: "requestId", blindWithout: "Nginx 与 Node 两条日志无法串联", grade: "measured" },
  { id: "duration", contract: "duration", required: "must", actual: "duration", blindWithout: "「哪个接口慢」答不出", grade: "measured" },
  { id: "ipua", contract: "来源 IP / UA", required: "must", actual: "ip / ua", blindWithout: "识别扫描源；区分正常与攻击流量", grade: "measured", note: "取 X-Forwarded-For 第一段，信任 Nginx 侧" },
  { id: "errtype", contract: "错误类型（类名，不是 message）", required: "must", actual: "errorType", blindWithout: "同类错误无法按类聚合", grade: "measured", note: "正常请求为 null；错误由 error handler 补" },
  { id: "reqstatus", contract: "请求状态（finish / close）", required: "must", actual: "requestStatus", blindWithout: "分不清正常走完还是断连 / 超时", grade: "measured" },
  { id: "port", contract: "入口端口", required: "optional", actual: null, blindWithout: "单面故障定位需要使用 id 反查 Nginx access.log", grade: "contract", note: "D1 将其列为不进入核心契约的可选字段，当前未实现" },
  { id: "ridsource", contract: "requestIdSource（nginx / local）", required: "optional", actual: null, blindWithout: "id 来源需要通过前缀形态判断", grade: "contract", note: "D2 P5 新增的可选字段；local- 前缀已能区分来源，当前未实现" },
];

/** 实测那一行里多出来的、契约没写的键。不是漏，是库的形态。 */
export const EXTRA_FIELD = {
  key: "level",
  why: "pino 自动添加的日志级别数字（info=30）。D1 Q5 约定了级别口径但未把 level 列入字段表，因此它是库自动生成的契约外键。",
};

/** 兑现计数从数据算，不手写。 */
export function fieldSettlement() {
  const must = LOG_FIELDS.filter((f) => f.required === "must");
  const optional = LOG_FIELDS.filter((f) => f.required === "optional");
  return {
    must: must.length,
    mustDone: must.filter((f) => f.actual).length,
    optional: optional.length,
    optionalDone: optional.filter((f) => f.actual).length,
  };
}

/* ------------------------------------------------------------ 脱敏的四层拦截 */

/** 一层拦截。force 决定它在图上排第几——按强制力，不按写下来的顺序。 */
export interface RedactGate {
  id: string;
  name: string;
  force: "design" | "config" | "machine" | "human";
  forceLabel: string;
  what: string;
  /** 这一层今天到底有没有起作用。 */
  effect: string;
  grade: W10Grade;
}

/**
 * 四层拦截按强制力排。本块最反直觉的一条在第二层：
 * redact 配了五条路径，但中间件根本不把 req 对象记进日志——
 * 所以那五条路径今天一条都没被触发过。验证② 的 NOT_FOUND 来自第一层拦截。
 */
export const REDACT_GATES: RedactGate[] = [
  {
    id: "nobody",
    name: "请求日志不记录 body",
    force: "design",
    forceLabel: "设计",
    what: "请求日志只组装九个字段，req.body / req.headers 整体不进日志对象",
    effect: "PASSWORD_NOT_FOUND 来自请求日志未记录 body",
    grade: "measured",
  },
  {
    id: "redact",
    name: "pino redact 五条路径",
    force: "config",
    forceLabel: "配置",
    what: "req.body.password / req.headers.authorization / req.headers.cookie / req.query.resetToken / req.query.access_token",
    effect: "当前日志对象不包含 req，因此五条路径均未触发；该配置用于防止未来记录 req 时泄露字段",
    grade: "measured",
  },
  {
    id: "noconsole",
    name: "eslint no-console",
    force: "machine",
    forceLabel: "机器强制",
    what: "禁止源码使用 console.*，违反时 lint 失败",
    effect: "能够拦截 console.*，但不会拦截合法的 logger 消息参数",
    grade: "measured",
  },
  {
    id: "review",
    name: "上线前代码审查",
    force: "human",
    forceLabel: "人",
    what: "读一遍改动，问「这条路径上会不会有凭据以字符串形式落盘」",
    effect: "发现 404 的 err.message 拼接 req.url，导致查询串凭据绕过前三项约束",
    grade: "measured",
  },
];

/** 永不入日志清单（D1 §5.1）。第三条自带一个配套动作，不是单纯的「别记」。 */
export const NEVER_LOG = [
  { id: "pw", item: "req.body.password 及密码确认字段", extra: "" },
  { id: "auth", item: "req.headers.authorization（完整 Bearer）、session cookie 的 session id", extra: "" },
  { id: "query", item: "查询串里的临时凭据（resetToken / access_token）", extra: "配套动作：日志的 path 一律用 req.path，不含查询串" },
  { id: "pii", item: "扩展预留：addresses[].phone、身份证号（两模型均无此字段）", extra: "" },
];

/** 那条漏是怎么修的：两个通道都要断，只堵一头不够。 */
export const LEAK_FIX = {
  path: "源头：catch-all 生成 404 时改用 req.path，不再拼 req.url",
  message: "出口：error handler 的消息参数改成纯描述，不带请求原文",
  why: "只改源头，别处再拼一次 req.url 又会漏；只改出口，err.message 里仍然带着凭据在进程内传递",
};

/* ==================================== ⑦ 红过才算数：D3 的四项检查与五次红态 */
//
// 数字来源：day3-monitoring-alerting.md §2.3 验证表、§3 P1–P5 的答案、§9 执行记录；
// unit 与脚本本体见 week10-observability/notes/checks/。
// 唯一真源纪律同上：17:03–17:18 的时刻、退出码、四档频率只在本文件出现一次。

/**
 * 弄红作用在链条的哪一环。列的顺序 = 离真实故障由远到近——
 * 最右一环（真造资源条件）本周整列是空的。那不是没做完，是 D3 与 D4 的分工线：
 * D3 只证明「判据能红」，D4 才证明「真故障发生时这条链路走得通」。
 */
export type RedLever = "threshold" | "entry" | "service" | "resource";

export const RED_LEVERS: { id: RedLever; label: string; what: string; strength: string }[] = [
  { id: "threshold", label: "临时修改阈值", what: "将阈值临时调整到当前值另一侧", strength: "验证比较逻辑与红态输出路径" },
  { id: "entry", label: "替换检查输入", what: "让脚本读取不存在的端口或临时证书", strength: "验证输入解析与判定，不验证正式路径输入" },
  { id: "service", label: "停止被检服务", what: "停止可快速恢复的真实服务，让脚本读取实际状态", strength: "验证进程状态判据与红态输出" },
  { id: "resource", label: "注入资源条件", what: "实际降低磁盘或内存余量", strength: "验证端到端链路；D3 未使用，留待 D4 故障注入" },
];

/** 一项检查的一次完整红态证据链。三个状态格 + 两个动作，缺一格这一项就不算做完。 */
export interface RedProof {
  id: string;
  /** 检查项名。app 拆两层，因为脚本顺序短路，停了 nginx 根本走不到健康那一层。 */
  name: string;
  unit: string;
  lever: RedLever;
  how: string;
  /** 还原命令——写不出还原命令的弄红方式今天不做。 */
  restore: string;
  /** 三个状态格：绿 → 红 → 绿。exit 是脚本退出码，时刻取自执行记录。 */
  chain: { state: "green" | "red"; at: string; exit: number; detail: string }[];
  /** 报红那一行里给出的「我下一步该做什么」。 */
  action: string;
  proves: string;
  notProves: string;
  grade: W10Grade;
}

/**
 * 五次红。app 占两行不是凑数：脚本按顺序短路，nginx 一挂就退出、根本测不到健康那一层，
 * 所以两层必须分别触发、分别还原——这正是 D1 定两层判据的全部理由。
 */
export const RED_PROOFS: RedProof[] = [
  {
    id: "app-proc",
    name: "进程层：三服务 active",
    unit: "check-app",
    lever: "service",
    how: "停止 nginx；脚本按 nginx、nodeapp、mongod 顺序检查，第一项返回红态",
    restore: "sudo systemctl start nginx",
    chain: [
      { state: "green", at: "17:03", exit: 0, detail: "三服务全 active，健康端点 200" },
      { state: "red", at: "17:03", exit: 1, detail: "subsystem=nginx，明确失败项" },
      { state: "green", at: "17:03", exit: 0, detail: "启动 nginx 后恢复为绿" },
    ],
    action: "重启 nginx 并看它的状态",
    proves: "进程状态判据能够返回红态，并明确指出三个服务中的失败项",
    notProves: "真实的 nginx 崩溃（不是人手停的）会不会有别的表现",
    grade: "measured",
  },
  {
    id: "app-health",
    name: "健康层：进程活着但不干活",
    unit: "check-app",
    lever: "entry",
    how: "将脚本的健康检查端口从 3000 临时改为不存在的 3001，不修改 app.js",
    restore: "用备份覆盖回脚本",
    chain: [
      { state: "green", at: "17:04", exit: 0, detail: "端口 3000，健康端点 200" },
      { state: "red", at: "17:04", exit: 1, detail: "三服务仍全 active，子系统标到 health" },
      { state: "green", at: "17:04", exit: 0, detail: "覆盖回备份，端口回到 3000" },
    ],
    action: "带 -v 再打一次健康端点，并翻 nodeapp 最近 50 行日志",
    proves: "进程层全绿时，健康检查层仍能独立返回红态",
    notProves: "健康端点返回 500（而不是连不上）时的表现",
    grade: "measured",
  },
  {
    id: "mem",
    name: "内存余量",
    unit: "check-mem",
    lever: "threshold",
    how: "把红线常量从 200 MB 临时改到 1500 MB，当前可用 1203 MB 立刻落到线下",
    restore: "用备份覆盖回脚本",
    chain: [
      { state: "green", at: "17:05", exit: 0, detail: "可用 1205 MB，红线 200 MB" },
      { state: "red", at: "17:05", exit: 1, detail: "可用 1203 MB 低于临时红线 1500 MB" },
      { state: "green", at: "17:05", exit: 0, detail: "红线回到 200 MB，可用 1203 MB" },
    ],
    action: "看整体内存占用，再按内存排序找出吃得最多的进程",
    proves: "比较逻辑与报红通路是通的",
    notProves: "真实内存耗尽时的连锁反应；该类属于 C 档，D4 不注入",
    grade: "measured",
  },
  {
    id: "disk",
    name: "磁盘余量",
    unit: "check-disk",
    lever: "threshold",
    how: "把红线常量从 4 GB 临时改到 35 GB，当前可用 31 GB 立刻落到线下",
    restore: "用备份覆盖回脚本",
    chain: [
      { state: "green", at: "17:06", exit: 0, detail: "可用 31 GB，红线 4 GB" },
      { state: "red", at: "17:06", exit: 1, detail: "设备名、总量、已用、百分比全部实时取，不硬编码" },
      { state: "green", at: "17:06", exit: 0, detail: "红线回到 4 GB" },
    ],
    action: "先把 journald 压到 200 MB，再看日志目录里谁最大",
    proves: "比较逻辑与红态输出路径，并确认红态记录包含设备与实时水位",
    notProves: "实际降低磁盘余量时的 journald 清理等端到端行为；该项由 D4 注入验证",
    grade: "measured",
  },
  {
    id: "cert",
    name: "证书剩余天数",
    unit: "check-cert",
    lever: "entry",
    how: "生成一份 10 天有效期的自签证书放在临时目录，用环境变量让脚本读它；正式路径一个字节都不碰",
    restore: "删掉那份假证书，并移除 unit 里那行环境变量",
    chain: [
      { state: "green", at: "17:07", exit: 0, detail: "正式证书，剩余远超 15 天" },
      { state: "red", at: "17:07", exit: 1, detail: "假证书剩 10 天，openssl 的到期检查直接给出非 0 退出码" },
      { state: "green", at: "17:07", exit: 0, detail: "删掉假证书，回到正式路径" },
    ],
    action: "手动跑一次证书续期",
    proves: "15 天阈值判定正确，剩余 10 天的证书返回红态",
    notProves: "正式路径下读得到、读得对；那要走一次正式路径的判定逻辑模拟",
    grade: "measured",
  },
];

/** 四个 unit 的频率与身份（拆四个 / 四档频率 / 三普通一 root）。 */
export interface CheckUnit {
  id: string;
  unit: string;
  watches: string;
  redline: string;
  /** 拍板的频率。 */
  cadence: string;
  /** unit 文件里实际写的排程表达式。 */
  calendar: string;
  /** 拍板与实际不一致时写在这里——它本身就是一条「自动检查放行了，但语义不是你以为的那个」。 */
  mismatch?: string;
  /** mismatch 已修好并拿到核对证据时写在这里——表格状态回到 hit/实测，教学块保留教训。 */
  resolved?: string;
  persistent: boolean;
  user: string;
  grade: W10Grade;
}

/**
 * 四档频率不是拍脑袋：证书一天变一格，每分钟查它没有意义；进程存活一天查一次等于没查。
 * 补跑开关开的是低频项——关机期间漏掉的那次值得补；高频项开机重算即可。
 */
export const CHECK_UNITS: CheckUnit[] = [
  {
    id: "app",
    unit: "check-app",
    watches: "nginx、nodeapp、mongod 三服务 active，再加健康端点 200",
    redline: "任一失败即红",
    cadence: "每 1 分钟",
    calendar: "*:0/1",
    persistent: false,
    user: "ubuntu",
    grade: "measured",
  },
  {
    id: "mem",
    unit: "check-mem",
    watches: "可用内存（available，不是 free）",
    redline: "低于 200 MB 红",
    cadence: "每 5 分钟",
    calendar: "*:0/5",
    persistent: false,
    user: "ubuntu",
    grade: "measured",
  },
  {
    id: "disk",
    unit: "check-disk",
    watches: "根分区可用空间",
    redline: "低于 4 GB 红",
    cadence: "每 1 小时",
    calendar: "hourly",
    persistent: true,
    user: "ubuntu",
    grade: "measured",
  },
  {
    id: "cert",
    unit: "check-cert",
    watches: "正式证书的剩余有效期",
    redline: "少于 15 天红",
    cadence: "每 6 小时",
    calendar: "0/6:00:00",
    mismatch:
      "8/19 配置为 *-*-* *:0/6；该表达式按分钟计算，实际每 6 分钟触发一次，比约定的每 6 小时高 240 倍。",
    resolved:
      "8/20 改为 OnCalendar=0/6:00:00；systemd-analyze calendar --iterations=3 显示 12:00、18:00、次日 00:00，相邻间隔均为 6 小时。Persistent=true 会影响 list-timers 的 NEXT/LAST，因此不单独以该输出判断间隔。",
    persistent: true,
    user: "root",
    grade: "measured",
  },
];

/** 身份为什么不能四项统一：证书那一项要读的目录，普通用户进不去。 */
export const IDENTITY_SPLIT = {
  normal: "三项以普通用户运行：查询服务状态、本机健康检查、内存和磁盘均不需要提权",
  root: "证书检查以 root 运行：普通用户读取证书目录时返回拒绝访问",
  why: "四个 unit 分开运行，使证书检查单独使用 root，其他三项保持普通用户权限",
  actionRule:
    "脚本内命令不使用 sudo，运行身份由 unit 决定；红态输出中的人工恢复命令保留 sudo 前缀",
};

/** 谁监控监控本身。静默常绿是这一天最危险的失败模式。 */
export const MONITOR_SELF = [
  {
    id: "timerstop",
    mode: "timer 被停掉，或者根本没在排程",
    signal: "列 timer 时那一行的下次触发时间变成 n/a，上次触发时间停在原地不动",
    detail:
      "17:11 实际停止 timer 后，下次触发时间变为 n/a，该行仍保留；列出全部 timer 时也会显示未激活项。重新启动后下次触发时间恢复。",
    grade: "measured" as W10Grade,
  },
  {
    id: "scripterr",
    mode: "脚本自己语法错、跑不起来",
    signal: "systemd 把这个 unit 记成 failed，日志里写的是以退出码结束，而不是正常的已停用",
    detail:
      "未现场注入脚本语法错误，因此证据等级为已拍板。红态验证曾确认退出码 1 会使 systemd 标记 failed，与 oneshot 正常结束的状态不同。",
    grade: "contract" as W10Grade,
  },
];

/** 绿的时候也每次打一行——这条决定直接服务于上面那个失败模式。 */
export const GREEN_LINE_RULE = {
  chosen: "绿态每次也输出一行，状态写 OK",
  why: "绿态日志作为执行心跳，用于区分检查正常执行与检查未运行",
  cost: "四项加起来一天两千行、两 MB 量级，对着日志那 500 MB 的上限不构成压力",
};

/** 报红输出的口径：一行 JSON，人能扫、机器能查，且必须带下一步动作。 */
export const ALERT_FORMAT = {
  shape: "一行一条 JSON，字段固定：检查名、子系统、状态、时间、主机、下一步动作、上下文",
  why: "固定 JSON 字段便于下游解析，也避免分别维护绿态与红态两套格式",
  actionable:
    "输出当前值、阈值及排障顺序，使告警能够直接指向下一项操作",
  subsystem: "同一个 unit 里红的是哪一层，靠子系统字段区分：nginx 挂了给重启，健康端点不通给查日志；退出码统一非 0",
};

/** 今天用掉的弄红方式，明天不能再用一次——两天的证据是分工覆盖，不是重复。 */
export const RELAY_LINE = {
  d3: "D3 使用可逆测试输入，验证判据计算与红态输出路径",
  d4: "D4 注入真实端口占用、磁盘条件和反代配置错误，验证端到端表现",
  rule: "写不出还原命令的那一类，本周不做",
};

/** 工具行为踩点：真遇过一次才知道的那几条。 */
export const TOOL_GOTCHAS = [
  {
    id: "sedperm",
    hit: "在 /opt 下就地改脚本失败，退出码 4",
    fact: "就地编辑要在同目录建临时文件再原子替换，所以它要的是目录写权限，不只是文件写权限；而那个目录属 root",
    take: "修改阈值时使用所需权限；还原时用备份覆盖原文件",
  },
  {
    id: "oneshot",
    hit: "跑完的检查服务显示未激活、已死",
    fact: "oneshot 服务执行完成后退出并进入 inactive，是正常终态",
    take: "使用退出码和 failed 标记判断是否失败，不使用 active 作为成功标准",
  },
  {
    id: "timerstarget",
    hit: "timer 的开机自启装错目标",
    fact: "timer 要装到 timers.target，写成 multi-user.target 会 enable 成功但不排程",
    take: "启用后继续检查下次触发时间，确认 timer 已实际排程",
  },
  {
    id: "polkit",
    hit: "远程非交互会话里执行 systemd 属主操作，被要求交互认证",
    fact: "没有终端就没法交互认证，权限框架直接拒绝",
    take: "远程脚本里的 systemd 操作必须显式提权，不能指望会弹出询问",
  },
  {
    id: "stderr",
    hit: "证书检查绿的时候，先冒出一行不是 JSON 的文字",
    fact: "openssl 在有效期充足时会往标准错误打一句提示，混在 JSON 行前面",
    take: "现在日志系统容忍混合输出；将来真接了采集，这一行要么重定向、要么在消费端过滤",
  },
];

/* ============================================== ④ 阈值从哪来：四条距离尺 */

/**
 * 一条尺。告警型的三个点是「当前实测值 → 红线 → 出事点」，
 * 红线到实测值的那一段就是留给自己的动作时间。
 * 上限型只有一条：它不是告警线，是硬上限，到了系统自己清，不需要人。
 */
export interface ThresholdRuler {
  id: string;
  subject: string;
  kind: "alarm" | "cap";
  current: { value: number; unit: string; at: string };
  redline: { value: number; label: string };
  outage: string;
  basis: string;
  action: string;
  /** 哪个检查在盯它、多久看一次；null = 没有检查盯它。 */
  watchedBy: string | null;
  /** D3 弄红的实测证据；null = 这条不靠检查脚本兜。 */
  provenRed: string | null;
  grade: W10Grade;
  caveat?: string;
}

/**
 * 四条。前三条 8/18 还都是「已拍板」——那天没有任何东西会真的报警；
 * D3 把检查脚本写出来、并各弄红一次之后，它们才翻成已实测。
 * 第四条方向相反：它 D2 当天就生效了，但它从来不是告警线。
 */
export const THRESHOLD_RULERS: ThresholdRuler[] = [
  {
    id: "mem",
    subject: "内存余量",
    kind: "alarm",
    current: { value: 1203, unit: "MB", at: "8/19 检查脚本读到的可用内存" },
    redline: { value: 200, label: "200 MB" },
    outage: "交换区为 0，内存不足时进程可能被内核直接终止",
    basis: "使用 available 而非 free；200 MB 约为 D1 基线 1304 MB 的 15%",
    action: "看整体内存占用，再按内存排序找出吃得最多的进程",
    watchedBy: "check-mem · 每 5 分钟",
    provenRed: "17:05 将阈值临时改为 1500 MB，检查返回红态；还原 200 MB 后恢复为绿",
    grade: "measured",
    caveat: "已验证判据与红态输出。真实内存耗尽的连锁反应未验证；该类属于 C 档，在此主机上无可控回滚方式（见 ⑤）",
  },
  {
    id: "disk",
    subject: "磁盘余量",
    kind: "alarm",
    current: { value: 31, unit: "GB", at: "8/19 检查脚本读到的根分区可用空间" },
    redline: { value: 4, label: "4 GB" },
    outage: "剩余空间耗尽后，日志、上传和临时文件均无法写入",
    basis: "使用绝对剩余空间；扣除 500 MB 日志上限与演练水位后，仍保留 3 GB 以上余量",
    action: "先把日志压到 200 MB，再看日志目录里谁最大",
    watchedBy: "check-disk · 每 1 小时",
    provenRed: "17:06 将阈值临时改为 35 GB，检查返回红态；还原 4 GB 后恢复为绿",
    grade: "measured",
    caveat: "8/20 可用空间降至 3.84 GiB，但取整显示为 4G，旧判据仍返回绿（见 ⑤）。8/21 改为字节级判据，并取得红态证据",
  },
  {
    id: "cert",
    subject: "证书剩余天数",
    kind: "alarm",
    current: { value: 84, unit: "天", at: "8/19 距离到期还剩的天数" },
    redline: { value: 15, label: "15 天" },
    outage: "证书过期后，三个 443 入口均不可用",
    basis: "自动续期失败之后手工修要五到七天，再乘两倍缓冲",
    action: "手动跑一次证书续期并验证",
    watchedBy: "check-cert · root 身份",
    provenRed: "17:07 使用剩余 10 天的临时证书，检查返回红态；恢复正式证书后回绿",
    grade: "measured",
    caveat: "8/20 将 timer 从每 6 分钟修正为每 6 小时，并用 systemd-analyze --iterations=3 验证间隔（见 ⑦）。11:43:55 手工运行正式检查路径，确认读取与判定正确",
  },
  {
    id: "journald",
    subject: "日志占用上限",
    kind: "cap",
    current: { value: 272, unit: "MB", at: "8/18 设定上限当天的占用" },
    redline: { value: 500, label: "500 MB 硬上限" },
    outage: "未设置上限时，日志占用持续增长并消耗磁盘空间",
    basis: "设定当天占用 248 MB，上限留出翻倍的余量",
    action: "达到上限后由 journald 自动删除最旧日志，无需人工处理",
    watchedBy: null,
    provenRed: null,
    grade: "measured",
    caveat: "该项是自动清理硬上限，不触发人工告警",
  },
];

/** 尺上的位置从数据算：红线离出事点多近，就画多近。 */
export function redlineRatio(r: ThresholdRuler): number {
  return r.redline.value / r.current.value;
}

/* ============================= ⑤ 演练分档与定位：8/20 真注入的那三类 */

/**
 * 注入距离分三档。分的不是「多危险」，是**还原它要付出什么**——
 * 这也是本周唯一一条准入规则的由来：写不出回滚命令的那一类，本周不做。
 */
export type DrillTier = "A" | "B" | "C";

export const DRILL_TIERS: { id: DrillTier; label: string; meaning: string; rollback: string }[] = [
  {
    id: "A",
    label: "A 同机可逆",
    meaning: "故障范围限定为单个配置文件或单个端口占用进程",
    rollback: "恢复配置副本或终止端口占用进程",
  },
  {
    id: "B",
    label: "B 受控目录",
    meaning: "在指定临时目录创建资源条件，并预先设置止步线",
    rollback: "删除演练创建的占位文件",
  },
  {
    id: "C",
    label: "C 必须隔离",
    meaning: "内存耗尽影响整台主机，无法限定到单个文件或进程",
    rollback: "无可控回滚方式，因此不执行",
  },
];

/** C 档整列空着的理由。空列是主动收窄的证据，不是没画完。 */
export const TIER_C_EMPTY = {
  candidate: "内存耗尽",
  why: "该主机承载五个公网面且无交换区；内存耗尽时，被终止的进程不可预测",
  rule: "写不出回滚命令的那一类，本周不做",
};

/** 根因的三层。混成一句「因为 X」，明天就分不清哪一层还欠着证据。 */
export interface RootCause {
  /** 命令输出直接支持的部分。 */
  fact: string;
  /** 由事实推出来、但还没被单独验证的部分。 */
  guess: string;
  /** 明确知道自己还没验的那一条。 */
  unverified: string;
  grade: W10Grade;
}

export interface Drill {
  id: string;
  name: string;
  tier: DrillTier;
  /** 今天真注入了没有。false 的那一类必须写清谁在替它作证。 */
  ran: boolean;
  standIn?: string;
  /** 只写动作与目标，不给可复制的整条注入命令（方案 §8）。 */
  inject?: string;
  rollback?: string;
  /** 首查看的是什么，以及它把范围分成哪两支。 */
  firstProbe?: string;
  split?: string;
  predicted?: string;
  actual?: string;
  /** hit = 首个症状与预测一致；overturned = 实测把预测推翻了。 */
  verdict?: "hit" | "overturned";
  /** 一段可复核的原文证据（命令输出里的关键行，已截短）。 */
  evidence?: string;
  deviation?: string;
  rootCause?: RootCause;
  recovery?: string;
  closure?: string;
  grade: W10Grade;
}

/**
 * 四类。顺序按当天的执行顺序排（类 3 要对准整点排程，所以它第一个做）。
 * 第四类今天没做，而它不做的理由本身就是一条结论——同一手法前一天已经用过。
 */
export const DRILLS: Drill[] = [
  {
    id: "disk",
    name: "磁盘满",
    tier: "B",
    ran: true,
    inject: "往临时目录写一个占位文件，把可用空间压到告警线附近、又高于止步线",
    rollback: "删掉那个占位文件",
    firstProbe: "看根分区的可用空间（先看可读格式，再看字节级）",
    split: "低于止步线立刻止损、不再往下查；高于止步线说明磁盘不是根因，转去看内存",
    predicted: "整点排程触发的那一次，磁盘检查报红",
    actual: "整点排程已触发并写入日志，但检查结果为绿",
    verdict: "overturned",
    evidence: "15:00:01 磁盘检查记录 status=OK、avail=4G；故障注入成立，但未触发红色结果",
    rootCause: {
      fact: "字节级可用空间 3.84 GiB，确实低于 4 GB 红线；但脚本读的是取整后的显示值，显示成 4G，判据 4 小于 4 不成立",
      guess: "指定块大小时，磁盘用量工具按最近块四舍五入，而非向下取整；脚本逻辑本身无误",
      unverified: "手册对这条取整规则的原文表述；用同一条命令的字节级与取整两种输出对照即可验",
      grade: "measured",
    },
    recovery: "删掉占位文件后可用空间回到基线，三层基线全绿",
    closure: "D4 完成端到端验证并发现取整盲区。未下调止步线，因为触发红色结果所需的可用空间低于止步线",
    grade: "measured",
  },
  {
    id: "proxy",
    name: "反代配置错误",
    tier: "A",
    ran: true,
    inject: "把 443 那份 site 里根路径那一条的上游端口，改成一个没人监听的端口",
    rollback: "拷回注入前的副本，语法检查通过后重载",
    firstProbe: "在服务器内直连应用的健康检查口",
    split: "健康检查口响应 200 表示 Node 健康处理器可响应，转查反代层；非 200 转查应用层",
    predicted: "根路径 502，另外两条路径照常 200",
    actual: "根路径 502 与预测一致；另外两条路径为 404，其基线本来就是 404",
    verdict: "hit",
    evidence: "错误日志：connect() failed (111) while connecting to upstream: 127.0.0.1:9999",
    deviation:
      "预测另外两条路径为 200 属于先验缺失：两条裸前缀直连应用的基线为 404。预测混淆了上游可达与响应状态码",
    rootCause: {
      fact: "上游端口指向没有监听的端口，反代连不上，对外就是 502；语法检查全过",
      guess: "语法检查不验证上游可达性；该故障属于进程存活、语法正确但配置语义错误",
      unverified: "无：这一类的每一步都有命令输出",
      grade: "measured",
    },
    recovery: "拷回副本后配置与还原点逐字相同（比对无输出），根路径回到 200",
    closure: "注入期间四项检查均为绿，确认存在公网可达性监控盲区",
    grade: "measured",
  },
  {
    id: "port",
    name: "端口占用",
    tier: "A",
    ran: true,
    inject: "先停掉应用，再让一个监听工具抢占它的端口，然后把应用起回来",
    rollback: "杀掉抢占者，重启应用",
    firstProbe: "同上，直连健康检查口",
    split: "非 200 = 往应用层查，先看端口被谁占着",
    predicted: "应用起不来，服务状态是失败，日志里能看到端口已被占用",
    actual: "服务状态是 active，日志一个错都没有，端口上却没有监听、健康检查连都连不上",
    verdict: "overturned",
    evidence: "同一时刻三件事同时成立：状态 active、无端口占用报错、健康检查返回 000",
    deviation:
      "第一次注入时，端口占用工具默认仅接受一次连接；每分钟运行的健康检查消耗该连接后，工具退出并释放端口",
    rootCause: {
      fact: "抢占者持续占着端口时，应用进程活着、日志只写「服务运行端口」，但端口上查不到监听，健康检查连接被拒",
      guess: "应用未处理监听失败：进程未退出且没有错误日志，因此服务状态检查通过，但进程无法提供服务",
      unverified: "机制未验证：成功回调触发但底层未绑定；需 W11 最小样本复现",
      grade: "pending",
    },
    recovery: "重启应用后端口监听恢复、健康检查回到 200",
    closure: "D4 完成定位；当日未用读代码替代机制验证，根因分析移交 D5",
    grade: "measured",
  },
  {
    id: "cert",
    name: "证书过期",
    tier: "A",
    ran: false,
    standIn:
      "同类证书替换演练已在 8/19 完成，再次执行不会增加证据。8/20 改为手工运行正式检查路径；11:43:55 验证读取与判定均正确",
    grade: "measured",
  },
];

/** 三类真注入里，预测被实测推翻的条数。图上那两条断掉的连线就是它。 */
export function overturnedCount(): number {
  return DRILLS.filter((d) => d.verdict === "overturned").length;
}

/**
 * 四项检查在三类故障里的表态。每格两层：上层是注入前写死的预测，下层是实测。
 * 这块矩阵是全板最难看但最该看的一张：**故障是真的，红字一个都没有**。
 */
export type VerdictMark = "red" | "green" | "untested";

export interface CheckVerdictRow {
  drill: string;
  cells: { check: string; predicted: VerdictMark; actual: VerdictMark; note?: string }[];
}

export const CHECK_NAMES = ["check-app", "check-mem", "check-disk", "check-cert"];

export const CHECK_VERDICTS: CheckVerdictRow[] = [
  {
    drill: "disk",
    cells: [
      { check: "check-app", predicted: "green", actual: "green" },
      { check: "check-mem", predicted: "green", actual: "green" },
      {
        check: "check-disk",
        predicted: "red",
        actual: "green",
        note: "该格预测错误：可用空间进入阈值区间后，取整口径仍使检查结果为绿",
      },
      { check: "check-cert", predicted: "green", actual: "green" },
    ],
  },
  {
    drill: "proxy",
    cells: [
      {
        check: "check-app",
        predicted: "green",
        actual: "green",
        note: "预测与实测一致：对外根路径为 502 时，check-app 仍为绿",
      },
      { check: "check-mem", predicted: "green", actual: "green" },
      { check: "check-disk", predicted: "green", actual: "green" },
      { check: "check-cert", predicted: "green", actual: "green" },
    ],
  },
  {
    drill: "port",
    cells: [
      {
        check: "check-app",
        predicted: "red",
        actual: "untested",
        note: "D4 时计划在 D5 补测。D5 因需先复现机制，且在唯一生产机上重复注入风险较高，未再次注入；该类四格保持未实测",
      },
      { check: "check-mem", predicted: "green", actual: "untested" },
      { check: "check-disk", predicted: "green", actual: "untested" },
      { check: "check-cert", predicted: "green", actual: "untested" },
    ],
  },
];

/** 表过态的次数与其中红的次数——板上那句结论从这里算，不手写。 */
export function verdictTally(): { spoke: number; red: number; untested: number } {
  const cells = CHECK_VERDICTS.flatMap((r) => r.cells);
  return {
    spoke: cells.filter((c) => c.actual !== "untested").length,
    red: cells.filter((c) => c.actual === "red").length,
    untested: cells.filter((c) => c.actual === "untested").length,
  };
}

/**
 * 三个定位信号，各自在三类故障里的表现。
 * hit = 指对了方向；blind = 看得见有事但分不了层，或者干脆什么都没看见；
 * wrong = 给了错的方向；na = 这一类没用到它。
 */
export type SignalCall = "hit" | "blind" | "wrong" | "na";

export const SIGNAL_CALLS: Record<SignalCall, string> = {
  hit: "定位正确",
  blind: "无法分层",
  wrong: "定位错误",
  na: "未使用",
};

export interface LocateSignal {
  id: string;
  name: string;
  reads: string;
  cannot: string;
  calls: { drill: string; call: SignalCall; detail: string }[];
  grade: W10Grade;
}

export const LOCATE_SIGNALS: LocateSignal[] = [
  {
    id: "public",
    name: "五个公网面各探一次",
    reads: "公网可达性",
    cannot: "不能区分反代层与应用层，两类故障的公网表现相同",
    calls: [
      { drill: "disk", call: "blind", detail: "注入期间五个公网面均为 200，未识别磁盘阈值异常" },
      { drill: "proxy", call: "blind", detail: "根路径为 502，只能确认公网异常，不能定位层" },
      { drill: "port", call: "na", detail: "首查直接使用服务器内健康检查口，未经过公网检查" },
    ],
    grade: "measured",
  },
  {
    id: "health",
    name: "服务器内直连健康检查口",
    reads: "绕过反代，检查应用健康检查口是否响应",
    cannot: "不检查数据库连接状态；数据库异常通过业务错误暴露",
    calls: [
      { drill: "disk", call: "na", detail: "资源类故障首查看磁盘，不使用该检查" },
      { drill: "proxy", call: "hit", detail: "健康检查 200，定位到反代层" },
      { drill: "port", call: "hit", detail: "健康检查 000，定位到应用层；后续现象与预测不同" },
    ],
    grade: "measured",
  },
  {
    id: "isactive",
    name: "检查排程系统中的服务状态",
    reads: "进程状态",
    cannot: "不能判断进程是否能够提供服务；8/20 的端口占用故障已证伪该判断",
    calls: [
      { drill: "disk", call: "na", detail: "资源类故障不使用该检查" },
      { drill: "proxy", call: "blind", detail: "进程存活但配置语义错误，服务状态无法识别" },
      { drill: "port", call: "wrong", detail: "服务状态为 active，但端口无监听且健康检查失败" },
    ],
    grade: "measured",
  },
];

/** 九格里「指对方向」的格数——一眼结论从数据算。 */
export function signalHits(): number {
  return LOCATE_SIGNALS.flatMap((s) => s.calls).filter((c) => c.call === "hit").length;
}

/**
 * 三个盲区。它们不是同一件事：
 * defect = 实现缺陷，判据写法让真条件永远够不着红线；
 * scope  = 分工问题，检查本来就不管这一层，但「没人管」这件事仍然要补。
 */
export interface BlindSpot {
  id: string;
  name: string;
  kind: "defect" | "scope";
  /** 这一条是哪一种失效——三条的机制各不相同，不能用一句「实现缺陷」盖过去。 */
  kindNote: string;
  watcher: string;
  silentWhen: string;
  mechanism: string;
  evidence: string;
  fixCandidate: string;
  goesTo: string;
  grade: W10Grade;
}

export const BLIND_SPOTS: BlindSpot[] = [
  {
    id: "rounding",
    name: "磁盘检查的取整盲区",
    kind: "defect",
    kindNote: "实现缺陷：判据读取取整后的显示值，导致合法演练区间内无法触发红色结果",
    watcher: "check-disk",
    silentWhen: "可用空间在 3.5 到 4 GiB 之间时，检查结果仍为绿",
    mechanism:
      "判据读取按 G 显示的取整值。3.84 显示为 4，整数比较不成立；触发红色结果需要先低于止步线，因此旧判据的触发范围位于合法演练区间之外",
    evidence: "15:00:01 那条 OK 行：avail=4G，而字节级是 3.84 GiB",
    fixCandidate: "已修（2026-08-21 #11 改字节级判据）",
    goesTo: "已修（#11）；runbook 盲区表保留该历史案例",
    grade: "measured",
  },
  {
    id: "scope",
    name: "应用检查的可达性盲区",
    kind: "scope",
    kindNote: "职责范围缺口：check-app 不检查公网可达性，需要由其他检查覆盖",
    watcher: "check-app",
    silentWhen: "反代配置错误、对外根路径为 502，但应用进程正常时，检查结果为绿",
    mechanism:
      "check-app 检查服务进程可用性，不检查公网可达性。两者职责不同；D4 前公网可达性没有对应检查",
    evidence: "注入态四项检查全部正常退出，同一时刻根路径是 502",
    fixCandidate: "候选方案：增加本地后端健康检查，或监测错误日志中的上游连接失败。公网探针方案已否决，因为会引入新的单点",
    goesTo: "D5 runbook；D3 已记录备选方案及其代价",
    grade: "measured",
  },
  {
    id: "fakeactive",
    name: "应用的假 active",
    kind: "defect",
    kindNote: "实现缺陷：应用未上报监听失败，服务状态仍为 active",
    watcher: "排程系统的服务状态",
    silentWhen: "端口被占用时，服务状态仍为 active",
    mechanism:
      "进程存活且日志记录“服务运行端口”，但端口没有监听，进程实际无法提供服务",
    evidence: "抢占者持续占着端口时：状态 active + 无报错 + 健康检查 000，三件事同时成立",
    fixCandidate: "修复方向：error 监听 + process.exit(1)，复用外层 server；机制未验证需 W11 最小样本复现",
    goesTo: "D5 已读码定论（成功回调触发但底层未绑定，机制未验证）→ W11 最小样本复现",
    grade: "pending",
  },
];

/**
 * 当天纠正的两条工具认知。都属于「必须真遇过一次才知道」那一类，
 * 也都在同一天里直接改变了下一步怎么做。
 */
export const DRILL_CORRECTIONS = [
  {
    id: "fallocate",
    thought: "原判断：声明的占用量等于实际占用量，第一次注入多出的 0.7 G 来自工具额外占用",
    mechanism:
      "字节级结果显示：声明 1 G 后实际占用 1 GiB 加 4 K。额外 0.7 G 来自可读格式舍入；真实余量 32.5 G 显示为 31 G，以显示值相减会产生 1.7 G 偏差",
    fix: "按字节级基线计算注入量，不使用可读格式显示值做减法",
    grade: "measured" as W10Grade,
  },
  {
    id: "listener",
    thought: "原判断：监听工具会持续占用端口",
    mechanism:
      "监听工具默认仅接受一次连接。每分钟运行的健康检查消耗该连接后，工具退出并释放端口",
    fix: "端口占用工具需配置为接受多次连接；每一步均现场确认故障注入仍然存在",
    grade: "measured" as W10Grade,
  },
];

/** 演练痕迹的标记方式：不是仪式，是明天要能一条命令捞回来。 */
export const DRILL_MARKER = {
  how: "每次注入和恢复前，在系统日志写入包含 DRILL 标签的 UTC 记录",
  why: "该标记用于区分演练日志与真实故障日志",
};

/** 收尾：三层基线复绿 + 残留逐条核零。缺一条，这台机器今晚就不能不管。 */
export const DRILL_CLOSEOUT = {
  baseline: [
    "五个公网面加内部健康检查，全部 200",
    "三个服务加四个排程，七个全部 active",
  ],
  residues: [
    { item: "占位文件与探针文件", proof: "都不在了" },
    { item: "被抢占过的那个端口", proof: "监听队列长度是应用自己的那个值，不是抢占者留下的" },
    { item: "改过的那份 site 配置", proof: "与还原点逐字相同，比对无输出" },
    { item: "应用的服务定义", proof: "没有演练时临时加进去的环境变量" },
    { item: "四个检查脚本", proof: "按修改时间查，8/20 一次都没被碰过" },
  ],
  verdict: "唯一一台生产机已恢复基线，演练残留为 0",
};

/** 本块的一句话去处：今天挖到的三个盲区，明天全部要在 runbook 里有位置。 */
export const DRILL_HANDOFF = {
  toRunbook: "runbook 分别记录三个盲区不触发告警的条件，以及对应的人工发现方式",
  toSelfTest: "延迟自测选择两类故障，其中必须包含假 active；D4 时该故障的根因尚未确定",
};

/* ================================ ⑧ 收口日：一份别人照着能用的 runbook（D5，8/21） */

/**
 * 这一块与前七块的差别写在产出物的形态上：前七块的产出是**改动**（日志、检查、演练），
 * 这一块的产出是**可被复用的判断**。所以验收句不问「今天做了什么」，问「不看笔记还能不能走通」。
 *
 * 版面承载的结论有三处，都不靠标题：
 *   · 首查把范围分成两支，三类故障各自落位——落不进任何一支的那一类，画出来就是一个断点
 *   · 两条盲测轨道从头贯到尾，而轨道上「翻笔记」的记号一个都没有
 *   · 收口那天的两件事走到的终点不一样长：一条走满四段，另一条断在最后一段
 */

/** 今天的验收句与它的可证伪形态（不临时改，取自周计划交付物 ⑤）。 */
export const RUNBOOK_ACCEPT = {
  sentence: "不看笔记，按 runbook 走通两类故障",
  columns: ["症状", "首查命令", "判定分叉", "修复", "预防"],
  classCount: 3,
  forkRule:
    "「判定分叉」那一列必须写成可判真假的条件（真 → 走 X，假 → 走 Y）；写成「检查一下应用层」的不算",
  quickRef:
    "五个公网面、四个服务、四项检查的一行判据与命令保留在 runbook，板上不复制",
};

/** 通用首查：只看到症状、还不知道是哪一类时，先跑的那一条。 */
export const FIRST_CUT = {
  probe: "在服务器内直连应用的健康检查口",
  why: "它绕过反代，直接请求应用健康检查口。反代故障与应用故障在公网表现相同；该检查可根据健康检查口是否响应区分两层",
  branches: [
    {
      id: "up",
      verdict: "200",
      goes: "反代层 / 资源层",
      next: "再检查五个公网面是全部异常还是单个异常",
    },
    {
      id: "down",
      verdict: "非 200（含连都连不上）",
      goes: "应用层 / 进程层",
      next: "接着看端口上有没有监听、服务日志里有没有报错",
    },
  ],
  grade: "measured" as W10Grade,
};

/** 三类故障各自落在哪一支。cut=false 的那一类，是这一条首查区分不出来的。 */
export const CUT_LANDINGS: Array<{
  drill: string;
  branch: "up" | "down";
  cut: boolean;
  reads: string;
}> = [
  {
    drill: "proxy",
    branch: "up",
    cut: true,
    reads: "注入期间健康检查为 200、对外根路径为 502。两项结果不同，可定位到反代层",
  },
  {
    drill: "port",
    branch: "down",
    cut: true,
    reads: "健康检查无法连接，转查应用层。后续现象超出预测，但首查方向正确",
  },
  {
    drill: "disk",
    branch: "up",
    cut: false,
    reads: "五个公网面和健康检查均为 200；资源逼近告警线时，健康检查无法识别异常",
  },
];

/** 首查的失灵边界与补位信号：一个信号不能兼职，这是本板第三次遇到它。 */
export const CUT_BLIND_EDGE = {
  drill: "disk",
  why: "健康检查口是纯内存探针，不访问数据库，也不写磁盘。磁盘可用空间逼近告警线时，健康检查仍返回 200",
  standIn: "四项检查各自的输出",
};

/** 第二层判断：真支上继续分层。 */
export const SECOND_CUT = {
  question: "五个公网面是全挂，还是只有一个面挂",
  all: { label: "全挂", goes: "共享下游：应用与反代这两个进程，以及它们的监听" },
  single: { label: "单面挂", goes: "该面专属的那一份 site 配置" },
  note: "本机没有公共上游实体，四份 site 分别直连应用。因此，全部异常指向应用与反代两个共享进程，不指向公共配置",
};

/** 延迟自测：隔一天、不看演练笔记，按 runbook 走。 */
export const SELF_TEST = {
  gap: "隔一天：前一天真注入，第二天自测",
  rule: "全程不打开演练笔记，每次翻阅都现场记录。翻阅次数是判断 runbook 是否有缺口的唯一直接证据",
  flips: 0,
  pick: {
    ranIds: ["disk", "proxy"],
    droppedId: "port",
    why: "选择前一天完成完整闭环的两类故障。相关记忆最新，更容易依赖记忆而非 runbook，因此必须记录是否翻阅笔记",
    droppedWhy: "假 active 当前需要机制复现，不需要重复定位演练。在唯一一台生产机上再次注入，风险高于本次自测收益",
    changedFrom:
      "D4 原计划要求自测包含假 active，D5 开工前改为磁盘与反代故障。变更理由和代价保留在上一行",
  },
  runs: [
    {
      drill: "disk",
      steps: [
        { label: "算注入量", text: "按记忆加一次十进制换算算出 27.3 G", mark: "wrong" },
        {
          label: "触止步",
          text: "注入后可用空间跌破止步线。按变更单立即止损：删除占位文件，停止后续检查",
          mark: "back",
        },
        {
          label: "重算",
          text: "改用当天的字节级基线和实测出来的换算率重算：26.4 G，落在止步线与红线之间",
          mark: "",
        },
        {
          label: "检查结果为红",
          text: "手工触发磁盘检查，结果为 FAIL。前一天同类条件的结果为 OK",
          mark: "evidence",
          at: "15:18",
        },
        {
          label: "回基线",
          text: "删掉占位文件，可用空间回到基线，同一条检查写下绿",
          mark: "evidence",
          at: "15:58",
        },
      ],
    },
    {
      drill: "proxy",
      steps: [
        { label: "症状", text: "对外根路径 502，其余的面照常", mark: "" },
        { label: "首查命令", text: "健康检查口返回 200，说明 Node 的健康检查处理仍可响应，转查反代层", mark: "" },
        { label: "定位", text: "配置与还原点逐字比对；注入期间有差异输出，作为第一份证据", mark: "evidence" },
        { label: "修复", text: "拷回还原点，语法检查通过后重载", mark: "" },
        { label: "回基线", text: "根路径恢复为 200，配置比对无差异输出，作为第二份证据", mark: "evidence" },
      ],
    },
  ],
  stuck: {
    where: "注入量该算多少",
    why: "runbook 处理真实故障，不包含演练准备步骤，因此没有注入量计算",
    how: "未翻阅笔记。根据当天基线和换算率现场计算；第一次结果偏大，随后回退并重算",
    verdict:
      "注入量计算不回填 runbook。排障手册面向真实故障，演练物料由单独清单维护；此次停顿说明该步骤属于演练清单",
  },
  unrecorded:
    "本次没有逐步留痕，无法区分每个判断来自 runbook 还是已有记忆。现有证据只支持全程 0 次翻笔记；由于间隔仅一天，不能进一步证明各步骤完全依赖 runbook",
  grade: "measured" as W10Grade,
};

/** 收口那天的两件事，各自走到哪一段。断在最后一段的那条，不许按走完呈现。 */
export const CLOSEOUT_TRACKS: Array<{
  id: string;
  subject: string;
  ask: string;
  steps: Array<{ label: string; text: string; broken?: boolean }>;
  end: W10Grade;
  endText: string;
}> = [
  {
    id: "rounding",
    subject: "磁盘判据的取整盲区",
    ask: "判据修改后，真实条件是否会触发红色结果",
    steps: [
      { label: "改判据", text: "从「读取整后的显示值」改成「直接比字节」，走变更单、留还原副本" },
      {
        label: "同类条件重注入",
        text: "把可用空间压回止步线与红线之间。前一天同一区间的检查结果为绿",
      },
      { label: "拿到红字", text: "检查写下 FAIL：同一段区间，两套判据，两个结论" },
      { label: "回绿", text: "删除占位文件后基线恢复，同一检查结果恢复为绿" },
    ],
    end: "measured",
    endText: "已触发红色结果，并保留同一条件下旧、新判据的对照",
  },
  {
    id: "fakeactive",
    subject: "应用的假 active",
    ask: "进程为 active 但端口没有监听，故障发生在哪个环节",
    steps: [
      { label: "先写预测", text: "监听失败会让进程带着错误退出，服务状态应该是失败" },
      {
        label: "再读代码",
        text: "监听调用只带了成功回调，没有任何错误监听；外层那圈捕获拦不到这一类异步错误",
      },
      {
        label: "对照",
        text: "前一天的实测证伪了预测：日志显示成功回调已触发，但端口没有监听",
      },
      { label: "机制", text: "成功回调已触发，但端口实际没有监听；具体机制尚未验证", broken: true },
    ],
    end: "pending",
    endText: "已定位待验证环节；最小样本复现安排在下周",
  },
];

/** 假 active 的修复方向：方向已经定了，但机制没验证之前不动手。 */
export const FAKEACTIVE_FIX = {
  direction: "补一个错误监听：端口被占这类错误发生时，让进程带着非零码退出，好让排程系统看见失败",
  care: "必须复用外层已有变量，不能在局部新建同名变量；优雅关停引用外层变量，变量遮蔽会使它无法取得服务器实例",
  hold: "机制没复现之前不动手，避免新增退出逻辑影响正常关停路径",
};

/** 取整盲区的那一段区间：同一个落点，两把尺，两个结论。 */
export const ROUNDING_BAND = {
  unit: "GiB",
  window: { from: 3, to: 4.5 },
  stop: { value: 3.5, label: "止步线" },
  redline: { value: 4, label: "红线" },
  observed: { value: 3.84, label: "前一天的实测落点" },
  rules: [
    {
      id: "old",
      name: "旧判据：读取整后的显示值",
      reading: "3.84 显示成 4，「小于 4」不成立",
      verdict: "green" as const,
      when: "8/20",
    },
    {
      id: "new",
      name: "新判据：直接比字节",
      reading: "3.84 就是 3.84，「小于 4」成立",
      verdict: "red" as const,
      when: "8/21",
    },
  ],
  band:
    "旧判据在止步线与红线之间无法触发红色结果。要触发红色结果，可用空间必须低于止步线，但演练禁止进入该区间。取整使旧判据的触发范围落在允许演练的区间之外",
  grade: "measured" as W10Grade,
};

/** 这一周最值钱的一条，收在这里：它和 Node、和 Nginx 都没关系。 */
export const WEEK_TAKEAWAY = {
  line: "假输入的红态验证不能证明真实故障会触发红色结果",
  why: "D3 通过修改阈值和注入临期证书，验证了检查脚本能报告红色结果。D4 的三类真实故障表明，这仍不足以证明检查可信：磁盘进入阈值区间时报告绿，对外根路径返回 502 时四项检查均为绿，端口冲突时服务状态仍为 active",
  so: "检查脚本测试只能证明判据按预期计算，不能证明真实故障一定触发红色结果。需要通过一次真实故障注入完成验证",
};
