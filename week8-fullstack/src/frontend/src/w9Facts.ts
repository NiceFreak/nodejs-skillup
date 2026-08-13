// W9 部署链路的 canonical 事实（展示资产，纯前端静态数据）。
//
// 抽出来的原因与 evidenceSets.ts 相同：同一个数字在 week9 笔记里已经出现多次
// （314 单在 B2/B3 各一次、187.4MB 在 B5/roadmap/day4 各三次），复制到组件里必然漂移。
// 抽象边界只到「事实」这一层——每块板怎么用这些事实由各自组件决定。
//
// 数字来源：week9-deployment/notes/ 下的 day1 §5、day3 §5（阶段 B 执行记录）、
// day4 §1–§6、week9-roadmap-d1-d4.md §1。方法稿见 week9-visualization-plan.md。

/**
 * 证据档位。W9 与 week8 最大的差别是推演比例高得多——D1 §5.3 的失败路径写得和
 * D3 B4 的实测记录一样确定，但其中两条从未真正注入过。做成图之后极易被读成
 * 「四条路径都验证过」，所以每个可视化对象都必须显式挂档位，渲染时不允许省略。
 */
export type EvidenceGrade = "measured" | "derived" | "pending";

export const EVIDENCE_GRADE: Record<EvidenceGrade, { label: string; meaning: string }> = {
  measured: {
    label: "实测",
    meaning: "有命令输出、journal、PID 或时间戳可追溯到某次真实执行。",
  },
  derived: {
    label: "推演",
    meaning: "从已冻结契约或代码推出，结论可信，但没有真正跑过一次。",
  },
  pending: {
    label: "待做",
    meaning: "尚未落地，不能按已完成呈现。",
  },
};

/** 部署链路上的一跳。plane 决定它落在公网面还是 loopback 内线。 */
export interface ChainNode {
  id: string;
  name: string;
  /** 监听地址或发起位置。 */
  addr: string;
  plane: "client" | "public" | "loopback";
  /** 这一跳负责什么（白话优先，术语在 term 里）。 */
  role: string;
  term?: string;
}

/**
 * 四跳链路。这是 W9 全周的底层心智：公网请求最多到 Nginx，
 * 3000 / 27017 的「不可达」是 loopback 内线，不是「没在用」。
 * 来源：day1 §5.1 每跳表 + roadmap §1 端口表（D4-HTTP 后状态）。
 */
export const CHAIN_NODES: ChainNode[] = [
  {
    id: "client",
    name: "本地开发机",
    addr: "公网发起",
    plane: "client",
    role: "浏览器或 curl，唯一的外部入口",
  },
  {
    id: "nginx",
    name: "Nginx",
    addr: "0.0.0.0:80",
    plane: "public",
    role: "门卫：公网只认它，收下请求再转交内部",
    term: "反向代理",
  },
  {
    id: "node",
    name: "Node · Express",
    addr: "127.0.0.1:3000",
    plane: "loopback",
    role: "店铺：跑业务逻辑，只有同机的 Nginx 能连上",
    term: "应用服务（systemd 守护）",
  },
  {
    id: "mongo",
    name: "MongoDB",
    addr: "127.0.0.1:27017",
    plane: "loopback",
    role: "仓库：只有同机的 Node 能连上",
    term: "数据库（systemd 守护）",
  },
];

export const PLANE_LABEL: Record<ChainNode["plane"], string> = {
  client: "外部",
  public: "公网可达",
  loopback: "仅本机（loopback 内线）",
};

/**
 * D4 ⑤ 唯一验收的实测读数。本地开发机执行，非服务器 SSH。
 * 来源：day4 §6。
 */
export const ACCEPTANCE_READINGS = {
  host: "43.128.154.242",
  head: "200 OK · Server: nginx/1.18.0 · X-Powered-By: Express",
  login: "POST /auth/login → 200 + accessToken",
  report: "GET /reports/monthly-sales?months=6 → 200",
  sample: "2026-03 起 258 单 / 146988.82 元",
  /** GET /auth/login 的 404 是反代原样转发的反证（路由只注册 POST）。 */
  proxyProof: "GET /auth/login → 404（路由只注册 POST）—— 反证请求被原样转发到 Express，而不是落在 Nginx 默认站点",
} as const;

/**
 * systemd 限速契约。三个值都来自单元文件本身，不是推断。
 * 来源：day2 §systemd 七条契约、day3 §5-B4。
 */
export const SYSTEMD_LIMITS = {
  restartSec: 10,
  /** 窗口长度：systemd 默认 StartLimitIntervalSec。 */
  windowSec: 60,
  /** 窗口内允许的启动次数，超过就拒绝再拉起。 */
  burst: 5,
  /** connectDB 的 serverSelectionTimeoutMS——慢失败一次要耗掉的时间。 */
  dbTimeoutSec: 30,
} as const;

/**
 * B4 第二轮快失败注入的实测读数。
 * 注意档位：PID、journal 原文与 ~42s 总时长是实测；每次重启的**精确时刻**没有记录，
 * 轴上的位置由 RestartSec=10s 与总时长反推。这条区别必须显示出来。
 */
export const FAST_FAIL_OBSERVED = {
  trigger: "把 .env 里的 JWT_SECRET 改短（<32），触发启动校验①，进程毫秒级 exit(1)",
  pids: ["4600", "4659", "4733", "4839"],
  totalSec: 42,
  journal: [
    "JwtSecretConfigurationError",
    "restart counter is at 5",
    "Start request repeated too quickly",
    "Failed to start",
  ],
  recovery: ".env.bak-b4 还原 → systemctl reset-failed → start → active (running) → curl 200",
} as const;

/**
 * B4 第一轮的注入设计盲区：这条比结论本身更值得复习——它记录的是**实验设计本身会出错**。
 * 来源：day3 §5-B4 第一轮。
 */
export const INJECTION_BLIND_SPOT = {
  intent: "stop mongod → start nodeapp，观察「数据库没了所以起不来」",
  whatHappened:
    "nodeapp 1 秒内就 listen 成功了。Wants=mongod.service 在 start 时把 mongod 连带拉了起来（pid 3556 与 nodeapp 3557 相邻同秒），After 又保证了它先起——connectDB 当然成功。",
  fix: "改用与数据库无关的快失败源：把 JWT_SECRET 改短，让启动校验①在毫秒级抛错退出。",
  lesson: "注入之前要先想清依赖语义。这一轮同时实证了 Wants 的连带拉起，属于计划外的收获。",
} as const;

/**
 * 启动顺序约束：server.js 先 connectDB() 后 listen()。
 * 这一条是 502-A 成立的全部原因，也是 D2 目标句「按字面不成立」的来源。
 * 来源：day1 §2.2、day2 §2.1。
 */
export const STARTUP_ORDER_NOTE =
  "server.js 先 connectDB() 后 listen()：数据库连不上就走不到监听那一步，3000 从未 bind。";

/* ==========================================================================
   ① 信任边界与端口
   ========================================================================== */

/** 可达性由三个条件的合取决定，任何一个不放行就摸不到。 */
export type Gate = "allow" | "deny" | "unknown" | "na";

export interface PortRow {
  port: string;
  /** 实测的监听地址；没在监听就是 null。 */
  bind: string | null;
  process: string;
  /** 腾讯云控制台安全组。 */
  cloudGate: Gate;
  /** 主机上的 ufw。 */
  ufw: Gate;
  /** 结论：公网摸不摸得到。 */
  publicReachable: boolean;
  /** 落在哪一层——嵌套面图按这个把端口放进对应的圈。 */
  layer: "exposed" | "loopback";
  status: string;
  grade: EvidenceGrade;
  /** 谁需要它 / 不开的后果。来源：day1 §5.2。 */
  needs: string;
  ifClosed: string;
}

/**
 * 端口全集。注意两处诚实边界：
 *
 * 1. **安全组那一列从未直接查过控制台。** day4 §5 只写了「归因预备（未触发但记录）」——
 *    因为公网 200 实测通过，反推安全组必然放行 22 与 80，但这是反推不是观察。
 *    443 的安全组状态则完全未知。标成 measured 会是谎报。
 * 2. **53 端口不在 D1 契约表里**，是 Ubuntu 22.04 的 systemd-resolved stub。
 *    day2-result §1 的 ss 输出里有它。实际监听的端口比契约表多一个，这件事本身值得显示。
 */
export const PORT_ROWS: PortRow[] = [
  {
    port: "22",
    bind: "0.0.0.0 + [::]",
    process: "sshd",
    cloudGate: "allow",
    ufw: "allow",
    publicReachable: true,
    layer: "exposed",
    status: "D2 已落地",
    grade: "measured",
    needs: "本人唯一的远程管理通道；已禁 root、只允许公钥登录",
    ifClosed: "无法远程管理，只能走腾讯云网页终端这条带外通道",
  },
  {
    port: "80",
    bind: "0.0.0.0",
    process: "nginx",
    cloudGate: "allow",
    ufw: "allow",
    publicReachable: true,
    layer: "exposed",
    status: "D4-HTTP 已落地",
    grade: "measured",
    needs: "所有外部客户端；将来还要用于证书 HTTP-01 验证与 http→https 重定向",
    ifClosed: "外部完全访问不到服务——当前唯一的公网入口就是它",
  },
  {
    port: "443",
    bind: null,
    process: "nginx + 证书（未安装）",
    cloudGate: "unknown",
    ufw: "deny",
    publicReachable: false,
    layer: "exposed",
    status: "D4-HTTPS 待做",
    grade: "pending",
    needs: "HTTPS 的最终入口",
    ifClosed: "只能走明文 HTTP。当前就是这个状态，不是已完成后又关掉",
  },
  {
    port: "3000",
    bind: "127.0.0.1",
    process: "node（systemd 守护）",
    cloudGate: "na",
    ufw: "deny",
    publicReachable: false,
    layer: "loopback",
    status: "D2 已落地",
    grade: "measured",
    needs: "只被同机的 Nginx 连——每一个公网请求最后都要经过它",
    ifClosed: "Nginx 转发无门可进，外部拿到 502",
  },
  {
    port: "27017",
    bind: "127.0.0.1",
    process: "mongod（systemd 守护）",
    cloudGate: "na",
    ufw: "deny",
    publicReachable: false,
    layer: "loopback",
    status: "D3 已落地",
    grade: "measured",
    needs: "只被同机的 Node 连——认证、查角色、跑聚合都靠它",
    ifClosed: "请求进得来但查不到数据，外部拿到 500",
  },
  {
    port: "53",
    bind: "127.0.0.53",
    process: "systemd-resolved（本地 DNS stub）",
    cloudGate: "na",
    ufw: "deny",
    publicReachable: false,
    layer: "loopback",
    status: "Ubuntu 22.04 标配",
    grade: "measured",
    needs: "主机自己解析域名用；不在 D1 契约表里",
    ifClosed: "属系统组件，不由本项目管理",
  },
];

/** 两道闸门是独立的两层，ufw 放行不等于公网可达。来源：day4 §5「归因预备」。 */
export const GATES = [
  {
    id: "cloud",
    name: "腾讯云安全组",
    where: "主机之外，云平台侧",
    note: "从未直接查过控制台。80 能从公网走通，只能反推它放行了——这是反推，不是观察。",
    grade: "derived" as EvidenceGrade,
  },
  {
    id: "ufw",
    name: "ufw 防火墙",
    where: "主机之内，内核 netfilter",
    note: "实测输出：Default deny (incoming)，只放行 22 与 80/tcp（双栈）。27017 / 3000 不在列表里。",
    grade: "measured" as EvidenceGrade,
  },
] as const;

/** 本板要留下的三条。 */
export const BOUNDARY_NOTES = {
  notUnused:
    "3000 与 27017 的「公网不可达」不是「没在用」。它们是 loopback 内线：Nginx→Node→Mongo 这三跳全靠它们，只是外面摸不到。",
  defenseInDepth:
    "3000 有两道彼此独立的防线——进程绑在 127.0.0.1，加上 ufw 默认 deny。坏一道还有一道，这就是纵深防御的具体形态。",
  twoGates:
    "ufw 只是一层。若本地访问超时（而不是被拒绝），下一步该查的是云平台安全组，不是继续改 ufw。",
} as const;

/* ==========================================================================
   ④ 端到端验收链
   ========================================================================== */

/** 链路被切成四段。三次验收的差别就是各自从第几段开始。 */
export const ACC_SEGMENTS = [
  { id: "public", label: "公网", detail: "本地开发机 → 服务器 :80" },
  { id: "nginx", label: "Nginx 反代", detail: ":80 → 127.0.0.1:3000" },
  { id: "node", label: "Node 应用", detail: "认证 / 授权 / 控制器" },
  { id: "mongo", label: "MongoDB", detail: "查角色 + 跑聚合" },
] as const;

export interface AcceptanceRun {
  id: string;
  label: string;
  when: string;
  from: string;
  /** 覆盖到 ACC_SEGMENTS 的哪几段。没覆盖的段会显式标「没验证」。 */
  covers: number[];
  grade: EvidenceGrade;
  steps: string[];
  readings: Array<{ label: string; value: string }>;
  proves: string[];
  limits: string[];
}

/**
 * 三次端到端验收。它们在笔记里读起来像三段重复记录，实际**覆盖段完全不同**——
 * 这正是「某次 200 没有证明什么」的全部答案。
 * 来源：day3 §5-B2 / §5-B3、day4 §6。
 */
export const ACCEPTANCE_RUNS: AcceptanceRun[] = [
  {
    id: "b2",
    label: "B2 · 服务器内部端到端",
    when: "D3（8/12）",
    from: "服务器内部，直接打 127.0.0.1:3000",
    covers: [2, 3],
    grade: "measured",
    steps: [
      "register admin → 201",
      "updateOne 提权 admin → modified: 1",
      "login → 200 + accessToken",
      "GET /reports/monthly-sales?months=6 → 200",
    ],
    readings: [
      { label: "月份序列", value: "6 个月（2026-03 … 08）" },
      { label: "orderCount", value: "2581 单" },
      { label: "totalSpending", value: "≈ 155 万" },
      { label: "8 月锚点", value: "314 单，与 seed 汇总一致" },
    ],
    proves: [
      "登录签发 JWT → 认证 → 授权查库 → 聚合，这条链在服务器上真的通了",
      "返回的是真实 seed 数据，量级与月份序列都能对上锚点",
    ],
    limits: [
      "不证明 Nginx 可用——那时候还没装",
      "不证明公网可达——走的是 127.0.0.1，外面摸不到这条路",
      "不证明重启后还能起来",
    ],
  },
  {
    id: "b3",
    label: "B3 · 重启恢复",
    when: "D3（8/12）",
    from: "服务器内部，reboot 之后重新走一次",
    covers: [2, 3],
    grade: "measured",
    steps: [
      "sudo reboot",
      "systemctl is-enabled nodeapp mongod → 双 enabled",
      "两个服务同秒 active (running)",
      "重新登录 → GET ?months=1 → 200",
    ],
    readings: [
      { label: "自起", value: "双服务 enabled + active，同秒启动" },
      { label: "口径", value: "months=1（只查一个月，不是 B2 的 6 个月）" },
      { label: "8 月", value: "314 单 / 191442.37，与 B2 一致" },
      { label: "意外多出", value: "7 月 3 单——时区边界，见下" },
    ],
    proves: [
      "开机自启契约成立：重启后不需要人工介入",
      "接口在重启后仍返回真实聚合，不只是进程活着",
    ],
    limits: [
      "仍是服务器内部，同样不证明 Nginx 与公网",
      "只查了一个月，没有重证 B2 那 6 个月的聚合",
    ],
  },
  {
    id: "d4",
    label: "D4 ⑤ · 公网验收",
    when: "D4-HTTP（8/12）",
    from: "本地开发机，走公网打 43.128.154.242",
    covers: [0, 1, 2, 3],
    grade: "measured",
    steps: [
      "curl -I http://<公网 IP>/ → 200",
      "POST /auth/login → 200 + accessToken",
      "GET /reports/monthly-sales?months=6 → 200",
      "GET /auth/login → 404（路由只注册 POST）",
    ],
    readings: [
      { label: "响应头", value: "Server: nginx/1.18.0 · X-Powered-By: Express" },
      { label: "口径", value: "months=6，但取数时间点与 B2 不同" },
      { label: "首月", value: "2026-03 起 258 单 / 146988.82 元" },
      { label: "反代反证", value: "404 说明请求被原样转发到 Express，不是落在 Nginx 默认站点" },
    ],
    proves: [
      "四段全通：公网 → Nginx → Node → Mongo",
      "反代配置正确——Nginx 默认欢迎页不会带 X-Powered-By",
      "admin 凭据轮换之后，用密码管理器里的值登录仍然 200",
    ],
    limits: [
      "不证明 HTTPS——443 从未落地",
      "不证明并发与吞吐，只是一次成功的往返",
      "单次成功不等于稳定性，没有做持续观测",
    ],
  },
];

/** 三组数字口径不同，不能并排当趋势读。 */
export const READING_CAVEAT =
  "三次的 months 参数与取数时间点都不一样（6 / 1 / 6，且 B2 与 D4 不同时刻）。它们各自验证的是「这条链通不通」，不是同一把尺子量三次——并排当趋势读会得出假结论。";

/** 时区观察点：必须紧邻 B3，否则「7 月怎么冒出 3 单」会被读成数据错。 */
export const TIMEZONE_NOTE = {
  observation: "B3 用 months=1 查，却返回了 2 个月：8 月 314 单，外加 7 月 3 单。",
  cause:
    "服务器时区是 CST(UTC+8)，而聚合的 $year / $month 按 UTC 分组。本地 8 月 1 日凌晨 00:00–08:00 下的单，UTC 还在 7 月 31 日——$match 的时间窗按本地收进来了，$group 却把它归到 7 月。",
  status: "D5 待决策：是否用 $dateToString 指定业务时区修正。属代码改动，需走 review。",
  grade: "pending" as EvidenceGrade,
};

/* ==========================================================================
   ⑤ 反代 header 决策
   ========================================================================== */

export interface Distortion {
  id: string;
  field: string;
  /** 客户端真正发出的值。 */
  sent: string;
  /** 穿过 Nginx 之后 Node 默认看到的值——这就是「失真」本身。 */
  seen: string;
  /**
   * 配置修正之后 Node 真正看到的值。只有 Host 那条有。
   * 分开两行是因为「默认会变成什么」和「我们修没修」是两件事，
   * 挤进同一格再靠颜色区分，会让人以为 Node 现在看到的就是 $proxy_host。
   */
  fixed?: string;
  /** 理论上补回来的方案。 */
  remedy: string;
  /** 本应用是否消费这个字段——读代码逐处核对的结论。 */
  consumed: boolean;
  /** 读代码的依据。来源：day4 §4.2。 */
  codeEvidence: string;
  decision: "配" | "不配";
  why: string;
}

/**
 * 反代之后 Node 看到的三类信息失真。
 *
 * 档位说明：失真本身是 Nginx 的默认行为，本次**没有逐项实测**（标 derived）；
 * 「应用是否消费」是读代码逐处核对出来的（day4 §4.2 列了四处），代码是可复核的
 * 静态事实，标 measured；`Host $host` 生效有 curl 实测。
 */
export const DISTORTIONS: Distortion[] = [
  {
    id: "ip",
    field: "客户端真实 IP",
    sent: "浏览器的公网 IP",
    seen: "127.0.0.1（Nginx 自己）",
    remedy: "X-Real-IP / X-Forwarded-For",
    consumed: false,
    codeEvidence: "app.js 的 logger 只记 req.method / req.url / 状态码 / 耗时，没读 req.ip",
    decision: "不配",
    why: "应用拿不到也不用，补传就是「为未来配现在」",
  },
  {
    id: "proto",
    field: "原始协议",
    sent: "http（将来是 https）",
    seen: "恒为 http",
    remedy: "X-Forwarded-Proto",
    consumed: false,
    codeEvidence: "没有中间件读 req.protocol 或 req.secure",
    decision: "不配",
    why: "同上；等真的上了 443 再连同 trust proxy 一起引入",
  },
  {
    id: "host",
    field: "原始 Host",
    sent: "43.128.154.242",
    seen: "$proxy_host —— 即 127.0.0.1:3000",
    fixed: "配上 Host $host 之后 → 43.128.154.242（原样透传）",
    remedy: "Host $host",
    consumed: false,
    codeEvidence: "同样没有中间件读 req.hostname",
    decision: "配",
    why: "这条是唯一的例外：应用照样不读，但透传原始 Host 是零成本的合理默认——Nginx 不覆盖就会把它改写掉。所以「配不配」不是只看应用消不消费。",
  },
];

/** 落盘的站点配置。来源：day4 §4.3。 */
export const PROXY_CONFIG = `server {
    listen 80;
    server_name 43.128.154.242;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}`;

/** 将来要引入时的规则。分开做会拿到不可信的假 IP。 */
export const PAIRING_RULE = {
  question: "应用是否读 req.ip / req.protocol / req.hostname / req.secure？",
  yes: {
    label: "读",
    action: "XFF 透传与 app.set('trust proxy') 必须成对引入",
    risk: "只配 Nginx 不设 trust proxy，Express 不信任这些头，拿到的还是 127.0.0.1；只设 trust proxy 不在 Nginx 覆盖，客户端可以自己伪造 X-Forwarded-For。两边都要做，缺一边就是假 IP。",
  },
  no: {
    label: "不读",
    action: "只配 Host $host，其余都不配",
    risk: "这就是本次的选择：纯部署、零代码变更，最小改动。",
  },
} as const;

/** 未采用方案，不能画成已配置。 */
export const NOT_ADOPTED = "X-Real-IP / X-Forwarded-For / X-Forwarded-Proto 与 trust proxy 都没有配。上面那份配置就是服务器上实际生效的全部内容。";

/* ==========================================================================
   ⑥ 契约销账与资源闸门
   ========================================================================== */

export interface Contract {
  id: string;
  what: string;
  /** 在哪一天被销账；null = 到今天仍然欠着。 */
  settledOn: "D2" | "D3" | "D4" | null;
  /** 销账证据，或仍欠时的归属。 */
  evidence: string;
  grade: EvidenceGrade;
}

/**
 * D1 冻结的契约逐条对账。时间轴的横坐标就是「哪天销的」，
 * 仍欠的那几条没有落点、悬在末端——「还欠什么」因此是看出来的。
 * 来源：day1 §4 决策表、day2/day3/day4 执行记录、roadmap §6。
 */
export const CONTRACTS: Contract[] = [
  {
    id: "app",
    what: "目标应用与唯一验收接口",
    settledOn: "D3",
    evidence: "B2 服务器内部端到端 200，返回 6 个月真实聚合",
    grade: "measured",
  },
  {
    id: "host-init",
    what: "主机最小权限：非 root、SSH 密钥、ufw 白名单",
    settledOn: "D2",
    evidence: "nodeapp 用户 nologin + home 750；禁 root 登录；ufw 仅放行 22",
    grade: "measured",
  },
  {
    id: "systemd",
    what: "systemd 为唯一进程守护方案（pm2 只对比不实现）",
    settledOn: "D2",
    evidence: "七条契约实证：kill -9 自动拉起 / ~11s 退避 / SIGTERM 优雅关停 / 30s 超时 / enabled / journald / 限速配置落位",
    grade: "measured",
  },
  {
    id: "mongo-boundary",
    what: "MongoDB 同机、仅 loopback、启用认证、最小权限",
    settledOn: "D3",
    evidence: "官方 apt 8.0.29 + 双用户（admin=userAdmin / nodeapp=readWrite(shop)）+ authSource=admin + .env 600",
    grade: "measured",
  },
  {
    id: "fail-fast",
    what: "启动即失败要按 StartLimitBurst 停住，而不是无限重启",
    settledOn: "D3",
    evidence: "B4 第二轮快失败注入 → restart counter at 5 → failed 停住 → 恢复 200。这是 D2 选 A 欠下的那条，补完即销账",
    grade: "measured",
  },
  {
    id: "reboot",
    what: "验证一次服务重启后的恢复",
    settledOn: "D3",
    evidence: "B3：reboot 后双服务 enabled + active 同秒自起，接口仍 200",
    grade: "measured",
  },
  {
    id: "reverse-proxy",
    what: "反向代理：公网只认 Nginx，内部服务藏在后面",
    settledOn: "D4",
    evidence: "80 → 127.0.0.1:3000，本地开发机走公网实测 200",
    grade: "measured",
  },
  {
    id: "cred-rotate",
    what: "接公网前轮换测试凭据",
    settledOn: "D4",
    evidence: "bcrypt(12) 重算写库 modifiedCount: 1，密码管理器值实测登录 200",
    grade: "measured",
  },
  {
    id: "https",
    what: "域名 HTTPS 可访问、证书有效",
    settledOn: null,
    evidence: "D4-HTTPS 待做：certbot + sslip.io + 443；签发不可用则回退纯 IP+HTTP（该回退基线已可用）",
    grade: "pending",
  },
  {
    id: "cert-renew",
    what: "证书续期检查",
    settledOn: null,
    evidence: "归 D5，依赖 HTTPS 先落地",
    grade: "pending",
  },
  {
    id: "cold-path",
    what: "按文档做一次冷路径复核（可复现部署）",
    settledOn: null,
    evidence: "归 D5：清理清单 + 逐项核对，在现有主机上重走",
    grade: "pending",
  },
  {
    id: "timezone",
    what: "聚合时区口径是否按业务时区修正",
    settledOn: null,
    evidence: "D5 决策。属代码改动，需走 review——不是部署配置能解决的",
    grade: "pending",
  },
];

/** 内存闸门实测（装 Nginx 之前）。来源：day3 §5-B5。 */
export const MEMORY_GATE = {
  totalMB: 1931,
  availableMB: 1388,
  swapMB: 0,
  processes: [
    { name: "mongod", mb: 187.4, note: "seed 之后；空载时 93.1 MB" },
    { name: "nodeapp", mb: 83.9, note: "Node 24 + Express" },
    { name: "nginx", mb: 8.5, note: "安装时读数，不在这次 available 里" },
  ],
  /** 预测被实测推翻的那一条。 */
  prediction: {
    what: "WiredTiger 会吃掉 ≈450 MB（物理内存 50% 上限）",
    actual: "实测 187.4 MB —— 只有预测上限的约 40%",
    conclusion: "WiredTiger cache 按需增长，不预分配。空载 93.1 → seed 后 187.4，翻倍但远低于上限",
  },
  verdict: "绿灯：两进程合计 ≈271 MB，加 Nginx 后余量仍约 1350 MB，远超 400 MB 锚点",
  caveat:
    "available 1388 MB 是装 Nginx 之前实测的；「装后仍约 1350 MB」是按 8.5 MB 推算，没有重测。Swap = 0 是现状而非配置选择——真撞到内存上限时没有磁盘兜底。",
} as const;

/** 与真实生产的对照。来源：roadmap §4。 */
export const PRODUCTION_PARITY = {
  done: [
    "云主机初始化、非 root、SSH 密钥、ufw 最小放行",
    "git clone + npm ci --omit=dev（CI 产物上机的手工等效）",
    "Node + systemd 守护 + 开机自启",
    "MongoDB 同机 + 认证 + 最小权限 + loopback",
    ".env 600 + 密钥分离",
    "seed / 端到端 / 重启 / 故障注入的验证心智",
  ],
  missing: [
    { what: "HTTPS 与证书续期", owner: "D4-HTTPS / D5" },
    { what: "CI/CD 发布与回滚", owner: "W11" },
    { what: "监控、告警、日志聚合", owner: "W10" },
    { what: "备份 + 恢复演练", owner: "未排" },
    { what: "多环境隔离（dev / staging / prod）", owner: "未排，单台直上 prod" },
    { what: "水平扩展 / 多 AZ", owner: "单机，范围外" },
  ],
  verdict:
    "缺的这些是成熟度与规模差异，不是结构错误。结构对了，缺的是「自动化包裹」——今天手工做的每一步，正是 CI/CD 脚本要复刻的真相源。",
} as const;
