// W10 可观测性链路的 canonical 事实（展示资产，纯前端静态数据）。
//
// 与 w9Facts.ts 分开的理由和当初 w9Facts 从 evidenceSets 分开是同一条：
// 两块板遍历各自的全量数据，混在一起会让 W9 板凭空多出它没有叙述的条目。
//
// 数字来源：week10-observability/notes/ 下的
//   day1-observability-contract.md  §5.1 字段契约 / §5.3 四项判据 / §5.5 只读基线
//   day2-logging-rollout.md         §2.3 九个 location / §2.5 七项验证 / §11 实测记录
//   day3-monitoring-alerting.md     §2.3 验证表 / §3 P1–P5 / §9 弄红与 timer 执行记录
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
    meaning: "有命令输出、日志原文或验证记录可追溯到 8/18、8/19 那两次真实执行。",
  },
  contract: {
    label: "已拍板",
    meaning: "本人在 D1 冻结、或 D2 D3 执行期决定要这样，但尚未实现或尚未被检验。",
  },
  pending: {
    label: "待做",
    meaning: "D4 演练、D5 runbook 才会产生，或者已经发现要改但还没改的，不能按已完成呈现。",
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
    trigger: "客户端断连或上游超时掐断，res 走 close 而非 finish",
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
      "这一格永远不会有：请求根本没走到 Node。它由 Nginx access.log 那条流回答——那边有一条带 rid 的记录。",
    caveat:
      "反代配错时的实际表现要到 D4 演练才注入验证；今天这一格是契约里的判定规则，不是跑出来的。",
    grade: "contract",
  },
  {
    id: "error",
    name: "进程内出错",
    trigger: "error handler 接住的任何错误",
    before: {
      has: true,
      evidence: "有 console.error，但与上面那条请求行之间没有任何共同 id，并发时对不上",
    },
    after: {
      has: true,
      evidence: "pino error / warn，带同一个 requestId + errorType（错误类名，不是 message）",
    },
    caveat:
      "形态来自已上线的 error handler 代码；D2 的七项验证没有单独抓一条错误日志原文，所以还不算实测。",
    grade: "contract",
  },
];

/** 「Node 日志里查不到这次请求」的两种含义。靠 id 的形态分，不靠猜。 */
export const MISSING_LOG_BRANCHES = [
  {
    id: "nginx-only",
    symptom: "Node 侧完全查不到，Nginx access.log 里有一条",
    verdict: "请求没进 Node",
    next: "拿 access.log 里的 rid 去 error.log 看 connect() failed / no live upstreams",
    grade: "contract" as W10Grade,
  },
  {
    id: "local-prefix",
    symptom: "Node 侧查到了，但 requestId 是 local- 开头",
    verdict: "走到 Node 了，但没经过 Nginx（直连 3000 或反代没传头）",
    next: "别去 access.log 里找它——那边不会有；先确认这次请求是从哪个口进来的",
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
  why: "bcrypt 快路径 4 ms 就返回了，50 ms 的超时根本没来得及触发，全走 finish",
  worked: "改用 100 KB body + 限速，curl 退出码 28（超时）",
  result: "requestStatus=close 恰好一条，请求日志流 uniq -d 无重复",
};

/* ==================================================== ⑥ 假生效：三个绿灯与实例 */

/** 一道自动检查。checks 写清它到底在查什么——本块的全部张力都在这一列。 */
export interface GreenGate {
  id: string;
  name: string;
  checks: string;
  blind: string;
}

export const GREEN_GATES: GreenGate[] = [
  { id: "nginxt", name: "nginx -t", checks: "配置文件的语法", blind: "指令写在哪一层、有没有被同名指令族屏蔽、定义了的格式有没有被用上" },
  { id: "redact", name: "pino redact", checks: "日志对象上的字段路径", blind: "已经拼成字符串的内容——它不解析字符串，也不知道里面有凭据" },
  { id: "eslint", name: "eslint no-console", checks: "源码里的裸 console.*", blind: "走 logger 的那一条：logger.error(obj, msg) 的 msg 参数是合法调用" },
];

export type GateVerdict = "passed" | "na";

/** 一条「绿灯放行了但语义没生效」的实例。 */
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
  /** 三道绿灯各自的裁决：passed = 放过去了，na = 这道灯根本不管这类。 */
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
  selfcheck: "写文档时自查",
  review: "review",
  none: "无需拦（良性）",
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
    initial: "四份 site 各加一行 server 级的 proxy_set_header X-Request-Id，就四个面都传上了。",
    mechanism:
      "location 里一旦出现 proxy_set_header，整个指令族都不再继承上层——不是逐条合并。现有九个反代 location 每一个都写了 proxy_set_header Host $host，于是 server 级那一行对它们全部无效——配置看着加了，一个面都没生效。",
    fix: "九个反代 location 逐个加（P1 选 a）：重复但清晰，看一眼配置就知道传了什么头，不依赖继承语义。",
    gates: { nginxt: "passed", redact: "na", eslint: "na" },
    caughtBy: "reasoning",
    caughtDetail: "P1 答题时推出来的；验证⑤（一个 id 串两条流）是唯一能证伪它的实验",
    grade: "measured",
  },
  {
    id: "logformat",
    title: "log_format 定义了，access_log 没指定它",
    initial: "在 http 块里写好 log_format obs，Nginx 就会按新格式记日志了。",
    mechanism:
      "log_format 只是定义一个模板，并不决定谁用它。access_log 那行不写 obs，用的仍是默认 combined——里面没有 $request_id，验证⑤ 当场断链。而这两行都合法，nginx -t 照样通过。",
    fix: "access_log /var/log/nginx/access.log obs; —— 显式指定用哪个格式。",
    gates: { nginxt: "passed", redact: "na", eslint: "na" },
    caughtBy: "selfcheck",
    caughtDetail: "写本地副本、逐行核对服务器配置时发现的，不是跑出来的",
    grade: "measured",
  },
  {
    id: "queryleak",
    title: "err.message 里拼了 req.url",
    initial: "redact 清单里写了 req.query 的凭据字段，查询串里的临时凭据就不会进日志了。",
    mechanism:
      "redact 认的是对象路径。404 的 err.message 用 req.url 拼出一句话，查询串就以字符串形式进了 message，再被 error handler 当消息参数落盘——redact 不解析字符串，eslint 也管不着 logger 调用。",
    fix: "断两个通道：源头 catch-all 改用 req.path（不含查询串），出口 error handler 的消息改成纯描述。只堵一头都不够。",
    gates: { nginxt: "na", redact: "passed", eslint: "passed" },
    caughtBy: "review",
    caughtDetail: "上线前 review 抓到，属阻断项——查到密码或凭据就不上线（止步条件 2）",
    grade: "measured",
  },
  {
    id: "healthgate",
    title: "/health 被 location / 的 return 404 挡在公网外",
    initial: "新增了一个路由，它就在公网上能访问了。",
    mechanism:
      "80 / 443 的 location / { return 404; } 是 URL 白名单形态：没被显式放行的路径一律 404。/health 不在白名单里，于是什么都不做，它就只在 127.0.0.1 可见。",
    fix: "保持现状。检查脚本在本机跑，curl 127.0.0.1:3000/health 足够；不暴露 = 少一个攻击面，与「3000 仅 loopback」的信任边界一致。",
    gates: { nginxt: "na", redact: "na", eslint: "na" },
    caughtBy: "none",
    caughtDetail: "同一个机制，这一次结果正是想要的——但它是被认出来的，不是碰巧对的",
    benign: true,
    grade: "measured",
  },
];

/* ================================================================ 板级与进度 */

/**
 * 本板的七块。第七块是 D3 当天新增的——方案定的六块里没有它，
 * 因为「检查凭什么可信」这个问题要等到真有检查、并且真弄红过一次之后才存在。
 * 未 done 的那一块按方案 §9 的阶段排，不假装已经做完。
 */
export const W10_STAGE_PLAN = [
  { id: "falsegreen", title: "⑥ 三个绿灯漏掉什么", question: "全绿了为什么还是没生效", done: true },
  { id: "blindspot", title: "① 盲区：请求终局", question: "断在半路留下什么", done: true },
  { id: "journey", title: "③ 日志旅程", question: "那根 id 挂在几个地方", done: true },
  { id: "fields", title: "② 字段契约销账", question: "说好的十个字段兑现了吗", done: true },
  { id: "thresholds", title: "④ 阈值从哪来", question: "红线凭什么定在这", done: true },
  { id: "redproof", title: "⑦ 红过才算数", question: "一个检查凭什么可信", done: true },
  { id: "drill", title: "⑤ 演练分档与定位", question: "哪些能在生产机上真做", done: false },
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
      "内置变量（1.11.0+），每请求一个 32 位十六进制。同一行同时写进 access.log —— 四份 site 共用 http 块里那一份 access_log，所以格式只在一处定义。",
    grade: "measured",
  },
  {
    id: "pass",
    lane: "nginx",
    title: "proxy_set_header X-Request-Id 传给 Node",
    detail:
      "九个反代 location 各写一次。写在 server 级会被 location 级的同名指令族整体屏蔽，而 nginx -t 照样通过。",
    grade: "measured",
  },
  {
    id: "read",
    lane: "node",
    title: "中间件直读 req.headers['x-request-id']",
    detail:
      "不建跨层传递机制（显式传参与 AsyncLocalStorage 都推迟到业务层真需要记日志时）。头缺失时本地兜底生成 local- 前缀的 id，九个必有字段永不缺席。",
    grade: "measured",
  },
  {
    id: "echo",
    lane: "node",
    title: "响应头回写 X-Request-Id",
    detail:
      "必须在 next() 之前 setHeader，而且回写的要是最终决定的那个 id（header 有就用 header 的，没有就用 local- 兜底），否则客户端拿到的与日志里记的对不上。",
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
  { id: "shop", name: "shop", port: "80", proxyLocations: ["= /", "/auth", "/reports"], staticNote: "location / 是 return 404（URL 白名单）" },
  { id: "shop-ssl", name: "shop-ssl", port: "443", proxyLocations: ["= /", "/auth", "/reports"], staticNote: "/admin/ 是 alias 静态产物，不挂" },
  { id: "shop-admin", name: "shop-admin", port: "8080", proxyLocations: ["/auth", "/reports"], staticNote: "root dist 静态，不挂" },
  { id: "shop-showcase", name: "shop-showcase", port: "8081", proxyLocations: ["/auth"], staticNote: "root dist-showcase 静态，不挂" },
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
  goal: "目的不是让两个数字长得一样，是让排障的人不把 8 小时差当成 bug",
  chosen: "接受 +08:00，偏移量显式写在每一行里，runbook 写死「Nginx 北京时间、Node UTC，换算减 8 小时」",
  rejected: "给 nginx 单元设 TZ=UTC —— 那只是把「Node vs Nginx 的差」换成「Nginx vs 系统其余部分的差」，复杂度没消失只是转移，还多一条长期维护规则",
};

/** 两个耗时不是同一个数。写串一次就会把正常的差当成 bug 查半天。 */
export const DURATION_SPLIT = [
  { id: "nginx", label: "rt=$request_time（Nginx）", covers: "从收到请求第一个字节，到把响应最后一个字节发出去——含 TLS 握手后的排队、读 body、回传" },
  { id: "node", label: "duration（Node）", covers: "从请求日志中间件入口，到 res 触发 finish——不含 Nginx 侧排队与 body 未读完的时间" },
];

/** 验证⑤ 的实测证据：同一个 id 在两条流里各一条。 */
export const JOURNEY_EVIDENCE = {
  id: "63245c0a",
  idFull: "63245c0a…（32 位十六进制，板上只显示前 8 位）",
  nginxLine: "access.log 一条：rid=63245c0a… 时间戳带 +08:00",
  nodeLine: "journald 一条：\"requestId\":\"63245c0a…\" 时间戳 Z 结尾",
  header: "公网 443 响应头 X-Request-Id: 63245c0a…",
};

/* ============================================== ② 字段契约销账：说好的兑现了吗 */

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
 * 所以这不是欠账，是**没有顺手加码**。销账要同时看这两个方向。
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
  { id: "port", contract: "入口端口", required: "optional", actual: null, blindWithout: "单面故障定位要多走一步（拿 id 反查 Nginx access.log）", grade: "contract", note: "契约就写的「不进核心契约」——没实现是照做，不是欠账" },
  { id: "ridsource", contract: "requestIdSource（nginx / local）", required: "optional", actual: null, blindWithout: "id 来源要靠前缀形态判断，而不是读字段", grade: "contract", note: "D2 P5 提出的扩展位，同「入口端口」待遇；local- 前缀已经自解释，暂不加" },
];

/** 实测那一行里多出来的、契约没写的键。不是漏，是库的形态。 */
export const EXTRA_FIELD = {
  key: "level",
  why: "pino 自带的级别数字（info=30）。D1 Q5 定了级别口径但没把 level 列进字段表——实测比契约多一个键，属库的形态，不是实现加码。",
};

/** 销账计数从数据算，不手写。 */
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

/* -------------------------------------------------------------- 脱敏的四道闸 */

/** 一道闸。force 决定它在图上排第几——按强制力，不按写下来的顺序。 */
export interface RedactGate {
  id: string;
  name: string;
  force: "design" | "config" | "machine" | "human";
  forceLabel: string;
  what: string;
  /** 这道闸今天到底有没有起作用。 */
  effect: string;
  grade: W10Grade;
}

/**
 * 四道闸按强制力排。本块最反直觉的一条在第二道：
 * redact 配了五条路径，但中间件根本不把 req 对象记进日志——
 * 所以那五条路径今天一条都没被触发过。验证② 的 NOT_FOUND 是第一道闸的功劳。
 */
export const REDACT_GATES: RedactGate[] = [
  {
    id: "nobody",
    name: "中间件根本不记 body",
    force: "design",
    forceLabel: "设计",
    what: "请求日志只组装九个字段，req.body / req.headers 整体不进日志对象",
    effect: "验证② 的 PASSWORD_NOT_FOUND 是这道挡下的——真正生效的是它",
    grade: "measured",
  },
  {
    id: "redact",
    name: "pino redact 五条路径",
    force: "config",
    forceLabel: "配置",
    what: "req.body.password / req.headers.authorization / req.headers.cookie / req.query.resetToken / req.query.access_token",
    effect: "今天一条都没被触发过——它是「万一将来有人把 req 记进去了」的保险，不是当前的主防线",
    grade: "measured",
  },
  {
    id: "noconsole",
    name: "eslint no-console",
    force: "machine",
    forceLabel: "机器强制",
    what: "把「全走 pino、禁止裸 console」从纪律变成 lint 会失败的约束",
    effect: "拦住裸 console.*，但拦不住走 logger 的那一条（msg 参数是合法调用）",
    grade: "measured",
  },
  {
    id: "review",
    name: "上线前 review",
    force: "human",
    forceLabel: "人",
    what: "读一遍改动，问「这条路径上会不会有凭据以字符串形式落盘」",
    effect: "唯一抓到真实漏的那道：404 的 err.message 拼了 req.url，查询串凭据从前三道中间穿过去了",
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
 * 最右一环（真造资源条件）本周整列是空的。那不是没做完，是 D3 与 D4 的接力线：
 * D3 只证明「判据能红」，D4 才证明「真故障发生时这条链路走得通」。
 */
export type RedLever = "threshold" | "entry" | "service" | "resource";

export const RED_LEVERS: { id: RedLever; label: string; what: string; strength: string }[] = [
  { id: "threshold", label: "改判据阈值", what: "把红线临时挪到当前值的另一侧", strength: "只证明比较逻辑与报红通路是通的" },
  { id: "entry", label: "改脚本读的入口", what: "让脚本去读一个不存在的端口、或一份假证书", strength: "证明判据算得对，没证明真实路径下读得到、读得对" },
  { id: "service", label: "停一个真服务", what: "把被检对象真的停掉，脚本读到的是真实状态", strength: "证明进程判据能红；停的是可秒级还原的那一个" },
  { id: "resource", label: "真造资源条件", what: "真把盘写满、真把内存吃光", strength: "端到端真实——本周一次都不用，整列留给 D4" },
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
    how: "把 nginx 停掉（脚本按 nginx、nodeapp、mongod 顺序查，第一项就红）",
    restore: "sudo systemctl start nginx",
    chain: [
      { state: "green", at: "17:03", exit: 0, detail: "三服务全 active，健康端点 200" },
      { state: "red", at: "17:03", exit: 1, detail: "子系统标到 nginx，说清红的是哪一项" },
      { state: "green", at: "17:03", exit: 0, detail: "起回来立刻回绿" },
    ],
    action: "重启 nginx 并看它的状态",
    proves: "进程判据能红，而且红的时候说得出是三个服务里的哪一个",
    notProves: "真实的 nginx 崩溃（不是人手停的）会不会有别的表现",
    grade: "measured",
  },
  {
    id: "app-health",
    name: "健康层：进程活着但不干活",
    unit: "check-app",
    lever: "entry",
    how: "把脚本里的健康端点端口从 3000 改成 3001（不存在的端口），连接被拒必红；不碰 app.js 一行",
    restore: "用备份覆盖回脚本",
    chain: [
      { state: "green", at: "17:04", exit: 0, detail: "端口 3000，健康端点 200" },
      { state: "red", at: "17:04", exit: 1, detail: "三服务仍全 active，子系统标到 health" },
      { state: "green", at: "17:04", exit: 0, detail: "覆盖回备份，端口回到 3000" },
    ],
    action: "带 -v 再打一次健康端点，并翻 nodeapp 最近 50 行日志",
    proves: "两层判据真的是两层：第一层全绿的情况下第二层照样报红",
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
    notProves: "真实内存耗尽时的连锁反应——那属最高一档，留给 D4",
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
    proves: "同上；并且报红那一行带着设备与实时水位，不用再去敲一次 df",
    notProves: "真把盘写满时 journald 自动清理等真实行为——那是 D4 的注入",
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
    proves: "判据算得对——15 天这条线上，一份剩 10 天的证书确实被判红",
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
  /** 拍板与实际不一致时写在这里——它本身就是一条「绿灯放行了，但语义不是你以为的那个」。 */
  mismatch?: string;
  /** mismatch 已修好并拿到销账证据时写在这里——表格状态回到 hit/实测，教学块保留教训。 */
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
      "8/19 建 ⑦ 时这里写的是 *-*-* *:0/6——这个表达式的分母是分钟，实际每 6 分钟触发一次，比拍板的频率密 240 倍。",
    resolved:
      "8/20 D4 开工前置：改 OnCalendar=0/6:00:00，用 systemd-analyze calendar --iterations=3 看到 12:00 → 18:00 → 次日 00:00 相邻间隔 6 小时销账；list-timers 的 NEXT/LAST 会被 Persistent=true 的补跑污染，单看会再次上当。",
    persistent: true,
    user: "root",
    grade: "measured",
  },
];

/** 身份为什么不是一刀切：证书那一项要读的目录，普通用户进不去。 */
export const IDENTITY_SPLIT = {
  normal: "三项以普通用户跑：查服务状态、请求本机健康端点、读内存与磁盘，都不需要提权",
  root: "证书那一项以 root 跑：证书目录普通用户读不到，试过一次是拒绝访问",
  why: "拆成四个 unit 的第二个理由就在这里——合成一个的话，这个 unit 的身份得取四项里最高的那个，等于为了一项把另外三项一起提权了",
  actionRule:
    "脚本自己跑的命令一律不带 sudo，身份由 unit 决定；报红时给人的恢复命令保留 sudo 前缀——执行的人需要知道这一条要提权",
};

/** 谁监控监控本身。静默常绿是这一天最危险的失败模式。 */
export const MONITOR_SELF = [
  {
    id: "timerstop",
    mode: "timer 被停掉，或者根本没在排程",
    signal: "列 timer 时那一行的下次触发时间变成 n/a，上次触发时间停在原地不动",
    detail:
      "17:11 真停了一次验证过：信号是下次触发变成 n/a，而不是那一行消失——列全部 timer 时连未激活的也会列出来。重新启动后下次触发时间恢复。",
    grade: "measured" as W10Grade,
  },
  {
    id: "scripterr",
    mode: "脚本自己语法错、跑不起来",
    signal: "systemd 把这个 unit 记成 failed，日志里写的是以退出码结束，而不是正常的已停用",
    detail:
      "没有现场造语法错误，这一半降为待补。机制由弄红那一轮的退出码 1 间接验证过：非 0 退出会让 systemd 标 failed，与跑完一次的正常终态在日志里长得不一样。",
    grade: "contract" as W10Grade,
  },
];

/** 绿的时候也每次打一行——这条决定直接服务于上面那个失败模式。 */
export const GREEN_LINE_RULE = {
  chosen: "绿态每次也输出一行，状态写 OK",
  why: "绿时静默的话，日志里一片安静有两种可能：一切正常，或者检查根本没跑。留一行就把这两种分开了",
  cost: "四项加起来一天两千行、两 MB 量级，对着日志那 500 MB 的上限不构成压力",
};

/** 报红输出的口径：一行 JSON，人能扫、机器能查，且必须带下一步动作。 */
export const ALERT_FORMAT = {
  shape: "一行一条 JSON，字段固定：检查名、子系统、状态、时间、主机、下一步动作、上下文",
  why: "纯文本下游工具解析不了；绿走机器格式、红走人读格式又要维护两套。报红时人同样需要机器可取的字段",
  actionable:
    "「磁盘不足」不是可操作指令。写清可用多少、红线多少，再给出先清哪里、再看哪里，才叫报出来我该做什么",
  subsystem: "同一个 unit 里红的是哪一层，靠子系统字段区分：nginx 挂了给重启，健康端点不通给查日志；退出码统一非 0",
};

/** 今天用掉的弄红方式，明天不能再用一次——两天的证据是接力，不是重复。 */
export const RELAY_LINE = {
  d3: "D3 验证的是「检查本身可不可信」：判据算得对、报红通路是通的。所以弄红可以是假的",
  d4: "D4 验证的是「真故障发生时这条链路走得通」：真占端口、真写满盘、真改反代。所以注入必须是真的",
  rule: "写不出还原命令的那一类，本周不做",
};

/** 工具行为踩点：真遇过一次才知道的那几条。 */
export const TOOL_GOTCHAS = [
  {
    id: "sedperm",
    hit: "在 /opt 下就地改脚本失败，退出码 4",
    fact: "就地编辑要在同目录建临时文件再原子替换，所以它要的是目录写权限，不只是文件写权限；而那个目录属 root",
    take: "弄红改阈值一律提权执行；还原用拷贝覆盖——拷贝不建临时文件，普通用户就能做",
  },
  {
    id: "oneshot",
    hit: "跑完的检查服务显示未激活、已死",
    fact: "一次性类型的服务本来就是跑完就退出，这是正常终态，不是没起来。常驻服务那套 active 直觉在这里会误导人",
    take: "看它有没有失败要看退出码与 failed 标记，不是看 active",
  },
  {
    id: "timerstarget",
    hit: "timer 的开机自启装错目标",
    fact: "timer 要装到 timers.target，写成 multi-user.target 会 enable 成功但不排程",
    take: "enable 成功不等于会跑，还要看下次触发时间那一列",
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
 * 一条尺。告警型的三个点是「今天的实测值 → 红线 → 出事点」，
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
    outage: "被内核直接杀掉：交换区是 0，没有先变慢这个中间态",
    basis: "取的是 available 不是 free；红线是基线 1304 MB 的一成半",
    action: "看整体内存占用，再按内存排序找出吃得最多的进程",
    watchedBy: "check-mem · 每 5 分钟",
    provenRed: "17:05 把红线临时挪到 1500 MB，当场报红并还原",
    grade: "measured",
    caveat: "红过的是判据本身。真实内存耗尽时的连锁反应仍未验证——那是 D4 的事",
  },
  {
    id: "disk",
    subject: "磁盘余量",
    kind: "alarm",
    current: { value: 31, unit: "GB", at: "8/19 检查脚本读到的根分区可用空间" },
    redline: { value: 4, label: "4 GB" },
    outage: "写不进去：日志、上传、临时文件一起完蛋",
    basis: "绝对值比百分比直观；日志上限 500 MB 加上演练要占的水位之后，仍留三 GB 多余量",
    action: "先把日志压到 200 MB，再看日志目录里谁最大",
    watchedBy: "check-disk · 每 1 小时",
    provenRed: "17:06 把红线临时挪到 35 GB，当场报红并还原",
    grade: "measured",
    caveat: "同上：真把盘写满时的自动清理行为，要等 D4 的注入",
  },
  {
    id: "cert",
    subject: "证书剩余天数",
    kind: "alarm",
    current: { value: 84, unit: "天", at: "8/19 距离到期还剩的天数" },
    redline: { value: 15, label: "15 天" },
    outage: "过期，443 那三个面一起不可用",
    basis: "自动续期失败之后手工修要五到七天，再乘两倍缓冲",
    action: "手动跑一次证书续期并验证",
    watchedBy: "check-cert · root 身份",
    provenRed: "17:07 换成一份剩 10 天的假证书，当场报红并还原",
    grade: "measured",
    caveat: "8/20 已把盯它的 timer 频率从每 6 分钟修正为每 6 小时，并用 systemd-analyze --iterations=3 销账（见 ⑦ 频率表），「多久看一次」这一格随 8/20 生效；正式路径读得到、读得对由 D4 块 B 的手工运行补验",
  },
  {
    id: "journald",
    subject: "日志占用上限",
    kind: "cap",
    current: { value: 272, unit: "MB", at: "8/18 设定上限当天的占用" },
    redline: { value: 500, label: "500 MB 硬上限" },
    outage: "没有上限时它会一路涨到吃掉磁盘——那时候就变成上面那条磁盘尺的问题",
    basis: "设定当天占用 248 MB，上限留出翻倍的余量",
    action: "到上限之后日志系统自己滚掉最老的，不需要人做任何事",
    watchedBy: null,
    provenRed: null,
    grade: "measured",
    caveat: "这一条不是告警线：它到了不会有人被叫醒。四条里只有它是这样",
  },
];

/** 尺上的位置从数据算：红线离出事点多近，就画多近。 */
export function redlineRatio(r: ThresholdRuler): number {
  return r.redline.value / r.current.value;
}
