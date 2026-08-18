// W10 可观测性链路的 canonical 事实（展示资产，纯前端静态数据）。
//
// 与 w9Facts.ts 分开的理由和当初 w9Facts 从 evidenceSets 分开是同一条：
// 两块板遍历各自的全量数据，混在一起会让 W9 板凭空多出它没有叙述的条目。
//
// 数字来源：week10-observability/notes/ 下的
//   day1-observability-contract.md  §5.1 字段契约 / §5.3 四项判据 / §5.5 只读基线
//   day2-logging-rollout.md         §2.3 九个 location / §2.5 七项验证 / §11 实测记录
//   nginx/nginx.conf-http-logging.md（log_format 与 access_log 的关系）
// 方法稿见 week10-observability/notes/week10-visualization-plan.md。
//
// 唯一真源纪律：下面这些数字（9 个 location / 272M / 500M / 1304MB / 200MB / 4GB /
// 31G / 86 天 / 15 天）只在本文件出现一次，组件里不得再写字面量。

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
    meaning: "有命令输出、日志原文或验证记录可追溯到 8/18 那次真实执行。",
  },
  contract: {
    label: "已拍板",
    meaning: "本人在 D1 冻结或 D2 执行期决定要这样，但尚未实现或尚未被检验。",
  },
  pending: {
    label: "待做",
    meaning: "D3 检查脚本、D4 演练、D5 runbook 才会产生，不能按已完成呈现。",
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

/** 本板的六块。done 之外的四块按方案 §9 的阶段排，不假装已经做完。 */
export const W10_STAGE_PLAN = [
  { id: "falsegreen", title: "⑥ 三个绿灯漏掉什么", question: "全绿了为什么还是没生效", done: true },
  { id: "blindspot", title: "① 盲区：请求终局", question: "断在半路留下什么", done: true },
  { id: "journey", title: "③ 日志旅程", question: "那根 id 挂在几个地方", done: false },
  { id: "fields", title: "② 字段契约销账", question: "说好的十个字段兑现了吗", done: false },
  { id: "thresholds", title: "④ 阈值从哪来", question: "红线凭什么定在这", done: false },
  { id: "drill", title: "⑤ 演练分档与定位", question: "哪些能在生产机上真做", done: false },
];

/** 板头计数：把已落地两块里的事实按档位数一遍，不手写数字。 */
export function gradeCounts(): Record<W10Grade, number> {
  const all: W10Grade[] = [
    ...REQUEST_ENDINGS.map((e) => e.grade),
    ...MISSING_LOG_BRANCHES.map((b) => b.grade),
    ...FALSE_GREENS.map((f) => f.grade),
  ];
  return {
    measured: all.filter((g) => g === "measured").length,
    contract: all.filter((g) => g === "contract").length,
    pending: all.filter((g) => g === "pending").length,
  };
}
