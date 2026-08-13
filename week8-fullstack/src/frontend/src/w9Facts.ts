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
