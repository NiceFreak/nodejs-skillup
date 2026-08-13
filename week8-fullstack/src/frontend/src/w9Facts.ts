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
 * 来源：day1 §5.1 每跳表 + roadmap §1 端口表（D4-HTTPS 收口后状态）。
 *
 * 8/13 之后跳数没变，变的是**第一跳落在哪个面上**：Nginx 从一个 80 端口
 * 长成四个面（80 / 443 / 8080 / 8081），四面共用后面同一条 Node → Mongo 内线。
 * 所以链路图仍是四跳，「四面」另用 PUBLIC_FACES 表达——把它塞成八个节点
 * 会让「公网请求最多到 Nginx」这条主结论被支线冲淡。
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
    addr: "0.0.0.0 · 80 / 443 / 8080 / 8081",
    plane: "public",
    role: "门卫：公网只认它，收下请求再转交内部；四个面各自一份 server 块",
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
 * Nginx 的四个对外面。它们不是四套系统——**后面接的是同一条 Node → Mongo 内线**，
 * 区别只在「谁进得来、进来之后往哪个房间引」。
 *
 * 排成一行才看得出 8/13 那天真正发生的事：80 那个面被削窄（段 0 白名单），
 * 443 直接继承了削窄后的面，而 8080 / 8081 是各自另开的一扇门、职责与前两个不同
 * （它们自己 serve 静态文件，只有 /auth（+ /reports）才转给 Node）。
 * 来源：day4b §3 段 0、§4.3 D4-HTTPS、§5 段 2 执行记录、day4c §3 部署与验收。
 */
export interface PublicFace {
  id: string;
  port: string;
  scheme: "http" | "https";
  site: string;
  serves: string;
  /** 这个面上，哪些路径会被放行；其余一律兜底。 */
  allow: string[];
  /** 白名单之外看到什么。 */
  fallback: string;
  when: string;
  grade: EvidenceGrade;
  /** 唯一验收读数。 */
  proof: string;
}

export const PUBLIC_FACES: PublicFace[] = [
  {
    id: "http",
    port: "80",
    scheme: "http",
    site: "sites-available/shop",
    serves: "API 面 + 根：三条路径全部反代给 127.0.0.1:3000，自己不读磁盘",
    allow: ["= /", "/auth", "/reports"],
    fallback: "Nginx 直接返回 HTML 404，请求根本到不了 Express",
    when: "D4-HTTP 8/12 建面 · 段 0 8/13 削窄",
    grade: "measured",
    proof: "公网 / → 200、/users → 404、报表首月 258 单 / 146988.82",
  },
  {
    id: "https",
    port: "443",
    scheme: "https",
    site: "sites-available/shop-ssl",
    serves: "与 80 同一份白名单语义，只是外面套了 TLS；证书由 certbot 签发",
    allow: ["= /", "/auth", "/reports"],
    fallback: "同样是 Nginx 兜底 404——443 的 URL 面收敛是从 80 继承来的，不是重新配的",
    when: "D4-HTTPS 8/13",
    grade: "measured",
    proof: "本地开发机 HTTP_CODE:200 + SSL_VERIFY:0；HTTPS /users → 404",
  },
  {
    id: "admin",
    port: "8080",
    scheme: "http",
    site: "sites-available/shop-admin",
    serves: "week8 管理后台：location / 从磁盘 serve dist 静态文件，/auth 与 /reports 才反代 3000",
    allow: ["/（静态 dist）", "/auth", "/reports"],
    fallback: "dist 里不存在的路径 → Nginx 404。刻意不配 try_files（配了会把 404 变成 200 首页）",
    when: "D4-b 段 2 8/13",
    grade: "measured",
    proof: "8080 / → 200（index.html 843B）、登录 200 + token、报表 258 / 146988.82",
  },
  {
    id: "showcase",
    port: "8081",
    scheme: "http",
    site: "sites-available/shop-showcase",
    serves: "学习展板：location / 从磁盘 serve dist-showcase 静态文件，/auth 才反代 3000（门禁登录用）",
    allow: ["/（静态 dist-showcase）", "/auth"],
    fallback: "dist-showcase 里不存在的路径 → Nginx 404。静态页扛 VITE_SHOWCASE_ONLY=1 构建，与 admin 产物分目录",
    when: "D4-c 8/13",
    grade: "measured",
    proof: "8081 / → 200、/showcase.html → 200、POST /auth（缺字段）→ 400 反代贯通；浏览器实测登录门禁回跳展板",
  },
];

/**
 * 四个面的共同结论。这条比四张卡片本身更值得记住两条：
 * ① 削窄的是「面」，不是「层」——应用层此刻仍然是敞开的（见 SECURITY_DEBT）；
 * ② 服务边界 ≠ 暴露边界——四个 server 块后面仍是同一个 Node 进程（见 SERVICE_EXPOSURE）。
 */
export const FACES_NOTE =
  "四个面共用同一个 Node 进程与同一个数据库。80 与 443 是同一份白名单的两种外衣；8080 与 8081 是各自另开的一扇门——它们比前两个多一件事：自己读磁盘。这件事在 8/13 当天就以 403 的形态收了学费（见认知修正 ⑬），而「加了入口 ≠ 加了业务」是 D4-c 新长出的心智（见认知修正 ⑰）。";

/* ==========================================================================
   ⑩ 服务边界 vs 暴露边界（D4-c，2026-08-13）
   这是一个新问题域：加 Nginx 入口 ≠ 加业务。服务个数看进程，入口个数看 server block。
   它从「信任边界」的另一端看同一棵树：信任边界问「外面能摸到哪」，这里问
   「外面摸到的东西后面到底有几个系统」。
   ========================================================================== */

export interface ServiceExposure {
  id: string;
  kind: "service" | "exposure";
  /** 用哪个事实来数它。 */
  countBy: string;
  current: string;
  note: string;
  /** 改变它会带来什么。 */
  ifChanged: string;
}

export const SERVICE_EXPOSURE: ServiceExposure[] = [
  {
    id: "service-count",
    kind: "service",
    countBy: "进程数（ps / ss 里几个后端进程）",
    current: "1 个 —— nodeapp（systemd 守护，:3000）",
    note: "mongod 不是服务，是本机依赖。今天没有新增任何后端进程——四个面全部指向同一个 3000。",
    ifChanged: "新增后端进程（比如再起一个 Node）才是「加了业务」；加端口、加 UI 站点都不算。",
  },
  {
    id: "exposure-count",
    kind: "exposure",
    countBy: "Nginx server block 数",
    current: "4 个 —— shop / shop-ssl / shop-admin / shop-showcase",
    note: "四个 server 块是同一进程的四扇门。每个块可以各自决定：listen 哪个端口、读哪份静态产物、反代哪条路径。",
    ifChanged: "加一个 server block = 多一扇门，不改变业务进程；但每扇门都会扩大攻击面，所以要问「为什么开」。",
  },
];

export const SERVICE_EXPOSURE_NOTE =
  "类比：一个餐馆（一个后端进程）只有一个厨房，但开了四个门——正门（API）、外卖窗口（管理后台）、包厢入口（复习展板）、VIP 通道（HTTPS）。菜都是同一厨房做的，只是门牌不同。'加门'与'加厨房'是两回事。";

/** 这一板要留下的两条结论。来源：day4c §4.3。 */
export const SERVICE_EXPOSURE_TAKEAWAYS = {
  decoupled:
    "反代与业务职责分离：Nginx 管 TLS / 静态 / 路由 / 限流，进程管业务 / 数据 / 鉴权。加暴露面不碰业务进程——D4-c 全程 nodeapp 未重启。",
  microservices:
    "微服务 = 一入口多进程；今天 = 一进程多入口。同一「服务数 / 入口数不同」规律的第一次体感——这是将来理解网关的地基。",
} as const;

/** 三种暴露面切分方式。这是「为什么用端口而不是域名/路径」的答案。 */
export const EXPOSURE_SPLIT = [
  { way: "端口", example: "8080 / 8081", cost: "最直接，但要记数字", chosen: true },
  { way: "域名", example: "admin.example.com", cost: "需要 DNS + 证书", chosen: false },
  { way: "路径", example: "/admin", cost: "共享 URL 面，易冲突", chosen: false },
] as const;

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
 * D4-HTTPS 的 H1 验收读数。H1 冻结时经两轮 review 把三处收紧，
 * 这三处本身就是这条验收的全部价值——一条 `curl -I` 返回 200 证明不了「证书被信任」。
 * 来源：day4b §4.3。
 */
export const HTTPS_READINGS = {
  host: "43-128-154-242.sslip.io",
  command: `curl -sS -o /dev/null -w "HTTP_CODE:%{http_code}\\nSSL_VERIFY:%{ssl_verify_result}\\n" https://43-128-154-242.sslip.io`,
  result: "HTTP_CODE:200 · SSL_VERIFY:0",
  /** H1 两轮 review 收紧的三处——每一处都能独立废掉这条验收。 */
  tightened: [
    "执行位置必须在本地开发机：服务器自连绕过 DNS、安全组与整条公网链路，等于没验。",
    "不许加 -k：跳过证书校验就把「信任」这半边自废了，剩下的只证明「有个东西在 443 上应答」。",
    "URL 必须用 sslip.io 域名而不是 IP：证书 SAN 只签了域名，用 IP 访问必然 mismatch。",
  ],
  /** 执行期才暴露的口径：连不上时这个字段也是 0。 */
  zeroCaveat:
    "SSL_VERIFY:0 只有在连接成功之后才具信任语义——Step 0 预检时 443 还没配置，curl 超时退出，那一次的 0 是默认空值不是「证书可信」。",
  cert: "SAN = 43-128-154-242.sslip.io，notAfter 2026-11-11（Let's Encrypt 90 天）",
  renew:
    "certbot.timer enabled + NEXT 8/14 04:13 CST + journal「Started Run certbot twice daily」；`certbot renew --dry-run` 实跑 → all simulated renewals succeeded",
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
 * 端口全集。两处诚实边界，其中第一处在 8/13 变了性质：
 *
 * 1. **安全组那一列 8/12 时还是反推，8/13 变成了实测。** D4-HTTP 当天只写了
 *    「归因预备（未触发但记录）」——由公网 200 反推安全组放行了 22 与 80。
 *    8/13 放 8080 与 443 时两次真的动了控制台，并且拿到了
 *    「放行前 timed out → 放行后 refused」的差分，两道闸门第一次被分别观察到。
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
    status: "D4-HTTP 已落地 · 段 0 已削窄",
    grade: "measured",
    needs:
      "http-01 挑战（首发与每次续期都硬编码走 80）、段 0 的存活验收锚点、将来 301 跳转的发射台",
    ifClosed:
      "证书续期会在 90 天后的某一天静默失败，而那时候没人在看。443 上线后 80 不是冗余，是续期的必经之路",
  },
  {
    port: "443",
    bind: "0.0.0.0",
    process: "nginx + Let's Encrypt 证书（certbot 签发）",
    cloudGate: "allow",
    ufw: "allow",
    publicReachable: true,
    layer: "exposed",
    status: "D4-HTTPS 已落地（8/13）",
    grade: "measured",
    needs: "浏览器信任的加密入口；sslip.io 子域名让「没有自有域名」不再是阻断条件",
    ifClosed: "退回明文 HTTP——回退基线一直可用，所以这条路线从开始就不是单点赌注",
  },
  {
    port: "8080",
    bind: "0.0.0.0",
    process: "nginx（静态 serve dist + /auth /reports 反代）",
    cloudGate: "allow",
    ufw: "allow",
    publicReachable: true,
    layer: "exposed",
    status: "D4-b 段 2 已落地（8/13）",
    grade: "measured",
    needs: "week8 管理后台的页面入口；独占端口才不用去动刚收敛完的 80 白名单",
    ifClosed:
      "后台页面打不开，但 API 面不受影响——两个 server 块互不干扰正是选独立端口的理由。明文登录表单是已知短板，HTTPS 之后应迁到 443",
  },
  {
    port: "8081",
    bind: "0.0.0.0",
    process: "nginx（静态 serve dist-showcase + /auth 反代）",
    cloudGate: "allow",
    ufw: "allow",
    publicReachable: true,
    layer: "exposed",
    status: "D4-c 已落地（8/13）",
    grade: "measured",
    needs: "学习展板（个人复习入口）+ 登录门禁；与 8080 是两块不同的 UI，产物分目录才互不覆盖",
    ifClosed:
      "展板打不开，但 8080 管理后台与 API 面都不受影响。门禁只挡浏览器、不加密传输——明文短板与 8080 同属「迁 443」清单",
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

/**
 * 两道闸门是独立的两层，ufw 放行不等于公网可达。
 * 来源：day4 §5「归因预备」（写下预判）、day4b §5-B5 与 §4.3 Step 2（两次实测）。
 */
export const GATES = [
  {
    id: "cloud",
    name: "腾讯云安全组",
    where: "主机之外，云平台侧",
    note:
      "8/13 两次亲自动了控制台：8080 那次是 ufw 已放行、公网仍 SYN DROP，根因就在这一层；443 那次拿到了放行前 timed out、放行后 refused 的差分。从反推变成了观察。",
    grade: "measured" as EvidenceGrade,
  },
  {
    id: "ufw",
    name: "ufw 防火墙",
    where: "主机之内，内核 netfilter",
    note: "实测输出：Default deny (incoming)，放行 22 / 80 / 443 / 8080 / 8081（双栈）。27017 / 3000 不在列表里。",
    grade: "measured" as EvidenceGrade,
  },
] as const;

/**
 * 两道闸门被分别观察到的那一刻。这是 8/13 最值钱的一条实测——
 * 「超时」与「拒绝」不是两种失败程度，是**两层**给出的两种回答。
 * 来源：day4b §4.3 Step 2。
 */
export const GATE_DIFFERENTIAL = {
  before: { symptom: "Operation timed out", meaning: "包在云平台侧就被丢了，根本没进主机——安全组这一层没放行。" },
  after: { symptom: "Connection refused", meaning: "包进了主机内核，只是 443 上还没有进程在监听——已经越过安全组与 ufw 两道闸门。" },
  rule:
    "超时 → 往外查（安全组、路由）；拒绝 → 往内查（监听、站点配置）。8080 那次踩的正是前一半：ufw 放行了、ss 也看得到监听，公网还是不通，答案在控制台里。",
} as const;

/** 本板要留下的三条。 */
export const BOUNDARY_NOTES = {
  notUnused:
    "3000 与 27017 的「公网不可达」不是「没在用」。它们是 loopback 内线：Nginx→Node→Mongo 这三跳全靠它们，只是外面摸不到。",
  defenseInDepth:
    "3000 有两道彼此独立的防线——进程绑在 127.0.0.1，加上 ufw 默认 deny。坏一道还有一道，这就是纵深防御的具体形态。",
  twoGates:
    "ufw 只是一层。若本地访问超时（而不是被拒绝），下一步该查的是云平台安全组，不是继续改 ufw——8/13 放 8080 时这条预判第一次被真的触发，根因就在控制台。",
} as const;

/* ==========================================================================
   ①-b URL 面收敛（段 0，2026-08-13）
   端口面回答「哪几扇门开着」，URL 面回答「进了门之后，哪几个房间是通的」。
   同一条最小暴露原则的第二次应用——但这一次它暴露出一件端口面看不见的事：
   收窄的是「面」，不是「层」。
   ========================================================================== */

export interface UrlRule {
  path: string;
  kind: "allow" | "deny";
  /** 为什么必须在白名单里；或者为什么被关上。 */
  why: string;
  /** 读代码得到的依据。 */
  codeEvidence?: string;
}

/**
 * 段 0 冻结的白名单。逐条都是读代码定下来的，不是「看着差不多」。
 * 来源：day4b §3 Q4（白名单定义）+ Q5（默认拒绝形态）。
 */
export const URL_RULES: UrlRule[] = [
  {
    path: "location = /",
    kind: "allow",
    why: "week2 根路由，同时是 D4-HTTP 固化下来的公网存活锚点（curl -I / → 200）",
    codeEvidence: "app.js:33-35 只注册了 GET /，其他方法本来就会被 Express catch-all 404",
  },
  {
    path: "location /auth",
    kind: "allow",
    why: "登录与注册，前端唯一的入口",
    codeEvidence: "auth.js:9-11 只有 POST /register 与 POST /login 两条",
  },
  {
    path: "location /reports",
    kind: "allow",
    why: "D1 冻结的唯一验收接口",
    codeEvidence: "reports.js:15-32 两条路由都已挂 validateToken + requireRole('admin')",
  },
  {
    path: "location / { return 404; }",
    kind: "deny",
    why: "兜底：白名单之外一律 404，包括 /users。注意这是必须的——同一个 location / 不能既放行又拒绝",
  },
];

/**
 * 为什么是 404 而不是 403。这一题的答案全在「扫描者要付多少识别成本」上。
 * 来源：day4b §3 Q5。
 */
export const DENY_FORM = {
  chosen: "404",
  why: "公网 /users 与 /this-path-does-not-exist-12345 返回完全一致，扫描者无法区分「存在但被屏蔽」与「压根不存在」。",
  rejected403: "403 等于主动告知「这个路径是存在的，只是你没权限」——反而是在给下一步探测指路。",
  rejectedDrop: "直接断开会让 curl 报 (52)/(56)，-w '%{http_code}' 失效，验收命令得改成检测 $? 与 stderr，复杂度换不来收益。",
  /** 附赠的排障信号：两种 404 长得不一样。 */
  twoKindsOf404:
    "白名单外被 Nginx 拒 = HTML 404；白名单内但 Express 没这条路由（如 /auth/foo）= JSON 404 {error:'路由不存在'}。看一眼 404 的body 就知道请求到底有没有穿到应用层——这是排障时的免费二分。",
} as const;

/**
 * 段 0 的核心洞察，也是这块板最该被记住的一句：**两层防的不是同一批人。**
 * 来源：day4b §3 Q3（选 A + review 纠正）。
 */
export const LAYER_CHOICE = {
  question: "「/users 不该对公网开」这条约束，落在反代层还是应用层？",
  chosen: "只做反代层（今天）",
  proxyLayer: { defends: "门外汉——扫描器、随手试路径的人", blind: "已经登录、但不该看这个数据的普通用户" },
  appLayer: { defends: "有票没座位的人——已登录无权者", blind: "什么都不做的话，门外汉也进得来" },
  whyOkForNow:
    "当前没有第二条进应用的路：Node 只听 127.0.0.1:3000、Mongo 只听 127.0.0.1:27017、ufw 默认 deny。Nginx 屏蔽掉之后外部确实触达不到 /users。",
  costLater:
    "威胁模型不重叠，所以这不是「做了一层就够」。将来若公网需要合法 admin 访问 /users，一刀切的反代规则会误伤——届时要么开放规则并补鉴权，要么两层都做。",
} as const;

/**
 * Q8 安全债。放在 URL 面这一块的末尾，因为它正是上面那条「收窄的是面不是层」的账单。
 * 归类刻意写清楚：这是本人主动做的架构权衡，不是 AI 援助欠账，所以不进 DEBT.md。
 * 来源：day4b §3 Q8。
 */
export const SECURITY_DEBT = {
  what: "应用层 /users 五条路由至今没有鉴权——匿名、普通用户、admin 一视同仁 200。",
  mitigation: "当前由 Nginx 白名单封堵，公网拿到的是 404。缓解不等于修复：规则一旦失效或将来出现内网访问路径，敞口立刻回来。",
  classify: "本人主动决策的安全债（架构性技术债），责任方是自己，因此记 BACKLOG P1 + LEARNING-STATE 风险跟踪，不记 DEBT.md（那是给 AI 援助记账的）。",
  repay: "按 reports.js 的范式给五条路由挂 validateToken + requireRole('admin')。属黑名单 W4，本人实现、AI 只 review。",
  accept: "验收 = 本地直连带普通 token → 403、带 admin token → 200，且公网仍非 200。",
  when: "暂定 D5（8/14）收口前；与 D5 基建挤兑则顺延到 D5 之后第一个工作日。",
  grade: "pending" as EvidenceGrade,
} as const;

/* ==========================================================================
   ⑦ 证书与信任
   D1 契约的头号交付物「域名 HTTPS 可访问、证书有效」原先没有自己的板——
   H1 只作为验收链里某一次验收的附属面板存在。可是「200 只证明活着、
   SSL_VERIFY:0 才证明被信任」这件事，问的是加密层而不是验收方法。
   来源：day4b §4.1 H1–H4 冻结、§4.2 现场问答、§4.3 Step 0–8。
   ========================================================================== */

/**
 * 信任链的四环。空间编码用**嵌套的签名关系**：每一环都由上一环签名背书，
 * 最外层的锚是操作系统里预装的根证书——「被信任」不是证书自己声称的，
 * 是这条链一路指回到你机器上早就装好的那份名单。
 */
export interface TrustLink {
  id: string;
  name: string;
  what: string;
  /** 这一环由谁背书。 */
  signedBy: string;
  /** 这一环出问题时，curl / 浏览器会怎么说。 */
  ifBroken: string;
}

export const TRUST_CHAIN: TrustLink[] = [
  {
    id: "root",
    name: "系统根证书库",
    what: "操作系统与浏览器预装的一份名单，Let's Encrypt 在里面。整条链的信任锚就是它。",
    signedBy: "自签名——链到这里为止，再往上没有了",
    ifBroken: "系统根证书库缺失或过旧：所有 HTTPS 站点一起报错，不会只有你这一个",
  },
  {
    id: "intermediate",
    name: "Let's Encrypt 中间证书",
    what: "签发机构不直接拿根证书签叶子证书，中间隔一层，根私钥可以离线保存。",
    signedBy: "由根证书签名",
    ifBroken: "服务器只发了叶证书没发中间证书 → 部分客户端报「证书链不完整」，浏览器能自己补、curl 往往不能",
  },
  {
    id: "leaf",
    name: "我的证书",
    what: "certbot 走 ACME http-01 挑战证明「这台机器确实控制这个域名」之后签发的。",
    signedBy: "由中间证书签名",
    ifBroken: "过期或被吊销 → SSL_VERIFY 非 0，浏览器整页拦截",
  },
  {
    id: "san",
    name: "SAN 与请求域名匹配",
    what: "证书里写死了它对哪个名字有效：SAN = 43-128-154-242.sslip.io。",
    signedBy: "写在证书内容里，由上面三环共同担保没被篡改",
    ifBroken: "用 IP 直接访问 443 → 必然 mismatch。这不是配置错误，是证书本来就没签那个名字",
  },
];

/** 证书本身的事实。来源：day4b §4.3 Step 4。 */
export const CERT_FACTS = {
  san: "43-128-154-242.sslip.io",
  issuedOn: "2026-08-13",
  notAfter: "2026-11-11",
  lifespanDays: 90,
  issuer: "Let's Encrypt",
  challenge: "http-01（走 80 端口，certbot 在网站根下放一个临时文件让 LE 来取）",
  /** 为什么没有自有域名也能签成。 */
  sslip:
    "没有自有域名，走 sslip.io：把 IP 编进域名里，43-128-154-242.sslip.io 解析回 43.128.154.242。零成本拿到一个真实域名，证书因此签得下来。",
  grade: "measured" as EvidenceGrade,
};

/**
 * 签发方式的选择。这一条对「要看懂每一行」的学习目标很关键：
 * `--nginx` 插件会**改写你已经写好的 sites-available/shop**，
 * 于是「我配的」和「跑着的」不再是同一份。
 * 来源：day4b §4.2。
 */
export const CERTBOT_CHOICE = {
  chosen: "certonly + 手写 server 块",
  why: "certbot 只负责把证书签下来放到 /etc/letsencrypt，443 的 server 块由我自己写。配置文件里每一行都是我放进去的。",
  alternative: "--nginx 插件",
  altCost:
    "它会自动改写已有的 sites-available/shop：加 ssl 指令、挪走 listen、插入跳转。跑起来更快，但从此「我写的配置」和「实际生效的配置」是两份东西——排障时这个差异会加倍收费。",
  install: "apt 装 certbot 1.21.0（不用 snap：apt 版没有额外的封装层，装完就能看清它做了什么），同时自动创建 certbot.timer。",
} as const;

/**
 * 90 天生命周期。空间编码是一条时间轴：签发点、每日两次的检查点、
 * 续期窗口、到期点——「为什么需要自动续期」是看出来的，不是读出来的。
 */
export const CERT_LIFECYCLE = {
  span: "90 天",
  marks: [
    { at: 0, label: "8/13 签发", note: "http-01 挑战通过，fullchain + privkey 落到 /etc/letsencrypt/live/" },
    { at: 1, label: "8/14 起 certbot.timer", note: "每天两次检查，NEXT 实测 8/14 04:13 CST；journal 有「Started Run certbot twice daily」" },
    { at: 66, label: "到期前 30 天进入续期窗口", note: "LE 的续期窗口；timer 每天都在跑，进窗口后某一次就会真的续上" },
    { at: 90, label: "11/11 到期", note: "如果续期从没跑成，这一天之后所有访问者看到的是整页拦截" },
  ],
  /** 「会跑」与「应该会跑」的差别。 */
  proof:
    "certbot renew --dry-run 实跑过一次：Congratulations, all simulated renewals succeeded。模拟续期把整个流程走完了——这是「会跑」的证据，而不是「配了 timer 所以它应该会跑」。",
  /** 90 天这个数字本身的设计意图。 */
  whyShort:
    "90 天短得让人不得不自动化。这是 Let's Encrypt 故意的：手工续期在 90 天周期下必然出事，于是所有人都被推着去把续期做成自动的。",
  grade: "measured" as EvidenceGrade,
};

/** LE 的速率限制——签发失败时它决定了你还能试几次。来源：day4b §4.2。 */
export const LE_RATE_LIMIT =
  "Let's Encrypt 有速率限制（同一域名的失败验证约 5 次/小时）。这就是 H3 把重试间隔定成 ≥5 分钟的原因：既给瞬时抖动留余量，又不至于把额度打光——额度打光之后就不是「再试一次」的问题了，得等。";

/* ==========================================================================
   ⑧ 改一台在跑的机器
   这块讲的不是系统结构，是**过程纪律**：动手之前先想好怎么退回去，
   以及什么时候该停手。8/13 全天每一步都靠它兜底，但它此前在展板上完全不存在——
   生产对照里那条「回滚」还挂在「缺」的一侧，等于把做过的事呈现成没做。
   来源：day4b §3 Q7、§4.1 H3、§4.3 遗留观察点。
   ========================================================================== */

/**
 * 两级回滚。空间编码是**改动生效的深度**：
 * 配置改了但没加载，与已经加载并对外生效，退路不同——
 * 而且反直觉的是，「最坏情况」那一级反而更安全。
 */
export interface RollbackLevel {
  id: string;
  trigger: string;
  depth: "not-loaded" | "live";
  /** 此刻公网受到的影响。 */
  blastRadius: string;
  steps: string[];
  note?: string;
}

export const ROLLBACK_LEVELS: RollbackLevel[] = [
  {
    id: "worst",
    trigger: "nginx -t 没通过，或 reload 失败",
    depth: "not-loaded",
    blastRadius: "公网零影响——新配置从未被加载，跑着的还是旧的那份",
    steps: ["cp shop.bak shop", "nginx -t 通过即可"],
    note: "不需要 reload。这一级听起来最糟，实际最安全：Nginx 的配置校验挡在生效之前，语法错误根本不会上线。",
  },
  {
    id: "live",
    trigger: "reload 成功了，但验收没过（比如 /reports 被误拦）",
    depth: "live",
    blastRadius: "公网已经在吃新配置——这一级才是真的出事了",
    steps: ["cp shop.bak shop", "nginx -t", "systemctl reload nginx", "公网验收复测"],
    note: "reload 是平滑的：不重启 worker、不断开长连接。所以退回去本身不会造成第二次中断。",
  },
];

/** 动手前的纪律。三步，缺一步回滚就无从谈起。 */
export const CHANGE_DISCIPLINE = [
  { step: "改之前", what: "cp sites-available/shop sites-available/shop.bak —— 先有退路才动手" },
  { step: "改之后", what: "nginx -t —— 校验挡在生效之前" },
  { step: "生效", what: "systemctl reload nginx —— 平滑加载，随后立刻跑验收命令" },
] as const;

/**
 * 止损线。这是 H3 最值得迁移的一条：**动手之前先写死什么时候放弃**，
 * 否则会在证书上耗掉一整天，而当天真正的主线是别的东西。
 */
export const STOP_LOSS = {
  rule: "签发命令连续失败 3 次、每次间隔不少于 5 分钟 —— 第三次失败立即回退，当天到此为止。",
  whyThree: "给瞬时抖动留了两次余量：DNS 尚未生效、网络抖动这类问题常常第二次就好了。",
  whyFive: "LE 的失败验证有速率限制（约 5 次/小时）。间隔太密会把额度打光，那时候就不是「再试一次」而是「得等」。",
  whatCounts: "回退不算失败，算「这条路线当前不可用」的实证结论——纯 IP + HTTP 的基线一直在，退回去服务照样是通的。",
  checklist: [
    "先给基线拍快照：80 与 8080 双 200（如果这时已经挂了，那是人工介入，不属于回退范围）",
    "ufw delete allow 443/tcp",
    "恢复 Nginx 配置：cp shop.bak shop → nginx -t → reload",
    "保留 /etc/letsencrypt 不删",
    "disable certbot.timer",
    "回退后复验双 200 —— 确认真的回到了基线，而不是以为回到了",
  ],
  /** 清单里最容易被跳过、也最容易踩的一条。 */
  keepAccountKey:
    "「保留 /etc/letsencrypt」是最反直觉的一步。里面有 ACME account key——删掉重来会重新注册账号，而账号注册本身也有额度限制。清理失败现场时顺手删掉，等于给下一次尝试又加了一道墙。",
  /** 顺序本身也是设计。 */
  orderNote:
    "「先恢复配置，再谈其他」是有原因的：certbot 的 --nginx 插件可能已经改写过站点文件，那会连 80 一起拖下水。先把 80 救回来，再慢慢收拾 443。",
  grade: "derived" as EvidenceGrade,
  gradeNote: "止损线冻结了，但从没有触发过——一次就签发成功。它是写在动手之前的预案，不是执行记录。",
};

/**
 * 活着的风险：备份文件本身过期了。
 * 这条必须显示，因为它是「回滚」这套纪律当前唯一的破口。
 */
export const STALE_BACKUP = {
  what: "shop.bak 停在段 0 修改之前的那一刻：161 字节，不含白名单。",
  risk: "现在如果拿它回滚 shop，会把段 0 的 URL 面收敛一起退掉——/users 立刻重新对公网敞开，而且不会有任何报错提示你这件事发生了。",
  fix: "回滚前先刷新备份；或者现在就把当前形态重新备份一次。",
  status: "D5（8/14）收口项之一。",
  lesson: "备份不是一次性动作。「有备份」和「备份是当前形态」是两件事——中间隔着每一次你忘了重新备份的改动。",
  grade: "pending" as EvidenceGrade,
};

/* ==========================================================================
   ④ 端到端验收链
   ========================================================================== */

/** 链路被切成四段。各次验收的差别首先是从第几段开始，其次才是从哪个面进来。 */
export const ACC_SEGMENTS = [
  { id: "public", label: "公网", detail: "本地开发机 → 服务器 :80 / :443 / :8080 / :8081" },
  { id: "nginx", label: "Nginx 反代", detail: ":80 → 127.0.0.1:3000" },
  { id: "node", label: "Node 应用", detail: "认证 / 授权 / 控制器" },
  { id: "mongo", label: "MongoDB", detail: "查角色 + 跑聚合" },
] as const;

export interface AcceptanceRun {
  id: string;
  label: string;
  when: string;
  from: string;
  /**
   * 入口落在哪个对外面上。覆盖段这把尺量不到它——三次公网验收的覆盖段一模一样，
   * 区别全在这一格里。内部验收没有这一格。
   */
  entry?: string;
  /** 覆盖到 ACC_SEGMENTS 的哪几段。没覆盖的段会显式标「没验证」。 */
  covers: number[];
  grade: EvidenceGrade;
  steps: string[];
  readings: Array<{ label: string; value: string }>;
  proves: string[];
  limits: string[];
}

/**
 * 五次端到端验收。它们在笔记里读起来像五段重复记录，实际**覆盖段完全不同**——
 * 这正是「某次 200 没有证明什么」的全部答案。
 *
 * 8/13 新增的两次让这块板的结论更锋利了：D4-b 与 D4-HTTPS 的覆盖段与 D4-HTTP
 * **完全一样**（四段全覆盖），但它们各自证明的东西并不相同。覆盖段相同 ≠ 证明力相同，
 * 因为「入口是哪个面」是覆盖段这把尺量不到的维度。
 * 来源：day3 §5-B2 / §5-B3、day4 §6、day4b §3 段 0 执行、§5-B5、§4.3 Step 7。
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
    entry: "80 · 明文，当时 location / 全量反代",
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
      "不证明 HTTPS——这一天 443 还没落地（8/13 才补上，见下面两次）",
      "不证明 URL 面收敛——当时 location / 是全量反代，/users 从公网打得到（Q0 实测 200）",
      "不证明并发与吞吐，只是一次成功的往返",
      "单次成功不等于稳定性，没有做持续观测",
    ],
  },
  {
    id: "d4b",
    label: "D4-b · 段 0 收敛 + 8080 后台",
    when: "D4-b（8/13）",
    from: "本地开发机，同时打 80 与 8080 两个面",
    entry: "80（削窄后）+ 8080 · 都还是明文",
    covers: [0, 1, 2, 3],
    grade: "measured",
    steps: [
      "GET 80 /users → 404（关上侧）",
      "POST 80 /auth/login → 200 + token（通侧，密码走 stdin）",
      "GET 8080 / → 200（静态 index.html，843B）",
      "带 token GET 8080 /reports/monthly-sales?months=6 → 200",
    ],
    readings: [
      { label: "关上侧", value: "/users → 404，与不存在的路径返回完全一致" },
      { label: "两个面的报表", value: "都是 258 / 2026 / 3 / 146988.82——同一个 Node 进程" },
      { label: "静态页", value: "Content-Length 843" },
      { label: "80 回归", value: "/ → 200、/users → 404、报表锚点未变" },
    ],
    proves: [
      "URL 面真的收窄了，而且没有误伤验收接口——「该关的关上」与「该通的没被误伤」两侧同时成立",
      "新加一个 server 块不会动到已有的面：8080 上线之后 80 的三连原样重跑通过",
      "8080 的 /auth 与 /reports 反代到的是同一个 Node——两个面共用一条内线，不是两套系统",
    ],
    limits: [
      "不证明应用层安全：/users 的 404 来自 Nginx，Express 那五条路由至今谁都能调（见 Q8 安全债）",
      "不证明 HTTPS——这两个面当天都还是明文，8080 上还挂着一个明文登录表单",
      "不证明静态产物的内容边界：admin 产物里不含面试稿是构建期 grep 证明的，不是这次验收证明的",
    ],
  },
  {
    id: "d4https",
    label: "D4-HTTPS · H1 验收",
    when: "D4-HTTPS（8/13）",
    from: "本地开发机，走 sslip.io 域名打 443（非服务器自连、不加 -k）",
    entry: "443 · TLS，证书由 Let's Encrypt 签发",
    covers: [0, 1, 2, 3],
    grade: "measured",
    steps: [
      "dig +short 43-128-154-242.sslip.io → 43.128.154.242",
      'curl -w "HTTP_CODE:%{http_code}\\nSSL_VERIFY:%{ssl_verify_result}"',
      "GET https:// /users → 404（继承段 0 收敛）",
      "80 / 8080 回归三连",
    ],
    readings: [
      { label: "H1 唯一验收", value: "HTTP_CODE:200 · SSL_VERIFY:0" },
      { label: "证书", value: "SAN = 43-128-154-242.sslip.io，notAfter 2026-11-11" },
      { label: "URL 面", value: "HTTPS /users → 404，白名单是从 80 继承来的" },
      { label: "续期", value: "timer enabled + renew --dry-run 实跑成功" },
    ],
    proves: [
      "证书链、域名 SAN 与有效期同时成立——SSL_VERIFY:0 是「被信任」这半边的机器可读证据",
      "整条公网链路在 TLS 之下依然通到 Mongo：DNS → TLS → Nginx 白名单 → 3000 → 27017",
      "续期不是「应该会跑」而是「已经跑过一次模拟」——dry-run 真的走完了全流程",
    ],
    limits: [
      "不证明 90 天后的真实续期一定成功：dry-run 走的是 staging 流程，真实续期还没到期过",
      "不证明 8080 的明文短板被解决——admin 迁 443 仍在待办里",
      "不证明 HTTP 会自动跳 HTTPS：301 还没配，80 目前是并行的明文面而不是跳板",
    ],
  },
];

/** 五组数字口径不同，不能并排当趋势读。 */
export const READING_CAVEAT =
  "五次的 months 参数与取数时间点都不一样（6 / 1 / 6 / 6 / 6，且分散在 8/12 与 8/13 的不同时刻）。它们各自验证的是「这条链通不通」，不是同一把尺子量五次——并排当趋势读会得出假结论。同一个 258 / 146988.82 在后三次里反复出现，恰恰因为它是同一份 seed 数据的同一个锚点，不是「数据没变」的证据。";

/**
 * 后三次公网验收的覆盖段完全相同，但证明力并不相同。
 * 这条是 8/13 之后这块板新长出来的结论——也是覆盖段这把尺子的边界。
 */
export const COVERAGE_LIMIT =
  "D4-HTTP、D4-b、D4-HTTPS 三次都是「四段全覆盖」，但入口面分别是 80 全量反代、80 削窄 + 8080、443 TLS。覆盖段回答「走到了链上第几段」，回答不了「从哪扇门进来的」——两次验收的覆盖段一样，不代表它们可以互相替代。";

/** 时区观察点：必须紧邻 B3，否则「7 月怎么冒出 3 单」会被读成数据错。 */
export const TIMEZONE_NOTE = {
  observation: "B3 用 months=1 查，却返回了 2 个月：8 月 314 单，外加 7 月 3 单。",
  cause:
    "服务器时区是 CST(UTC+8)，而聚合的 $year / $month 按 UTC 分组。本地 8 月 1 日凌晨 00:00–08:00 下的单，UTC 还在 7 月 31 日——$match 的时间窗按本地收进来了，$group 却把它归到 7 月。",
  status: "D5（8/14）待决策：是否用 $dateToString 指定业务时区修正。属代码改动，需走 review。",
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
    why:
      "8/13 443 真的上了，这条却仍然是「不配」——因为判断规则从来不是「有没有 HTTPS」，而是「应用读不读」。代码依旧没有一处读 req.protocol / req.secure，补传就还是「为未来配现在」。真正会改变结论的是那天没做的事：配 301 跳转、或让应用按协议做分支。",
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

/**
 * 服务器上现在真正生效的四份站点配置。
 *
 * 8/12 的版本只有一份，而且 `location /` 是全量反代——那份配置**已经不存在了**，
 * 段 0 当天就把它改成白名单形态。四份并排放才看得出两件事：
 * 443 是 80 的复制加一层 TLS，而 8080 / 8081 的 `location /` 换了性质（root 而非 proxy_pass）。
 * 8081 与 8080 是同一性质的又一扇门，差别在产物目录与放行路径——它只反代 /auth。
 * 来源：day4 §4.3（80，段 0 后形态）、day4b §4.3 Step 5（443）、§5-B3（8080）、day4c §3（8081）。
 */
export interface SiteConfig {
  id: string;
  label: string;
  port: string;
  /** 这份配置在整体里承担什么，一句话。 */
  purpose: string;
  config: string;
}

export const SITE_CONFIGS: SiteConfig[] = [
  {
    id: "shop",
    label: "sites-available/shop",
    port: "80",
    purpose: "API 面。段 0 之后 location / 从「全量反代」变成「兜底 404」——这是当天改动最大的一行。",
    config: `server {
    listen 80;
    server_name 43.128.154.242;

    location = / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    location /auth {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    location /reports {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    location / {
        return 404;
    }
}`,
  },
  {
    id: "shop-ssl",
    label: "sites-available/shop-ssl",
    port: "443",
    purpose: "HTTPS 面。白名单三条与 80 逐字相同——URL 面收敛是抄过来的，不是重新想的。",
    config: `server {
    listen 443 ssl;
    server_name 43-128-154-242.sslip.io;

    ssl_certificate     /etc/letsencrypt/live/43-128-154-242.sslip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/43-128-154-242.sslip.io/privkey.pem;

    location = / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    location /auth  { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
    location /reports { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }

    location / {
        return 404;
    }
}`,
  },
  {
    id: "shop-admin",
    label: "sites-available/shop-admin",
    port: "8080",
    purpose:
      "管理后台面。这份的 location / 是 root 不是 proxy_pass——它要读磁盘，也因此踩到了 750 权限那颗雷。",
    config: `server {
    listen 8080;
    server_name 43.128.154.242;

    root  /home/nodeapp/.../frontend/dist;
    index index.html;

    location /auth    { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
    location /reports { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }

    # 刻意不写 try_files $uri $uri/ /index.html：
    # hash 路由不需要 SPA 兜底，配了反而会把本该 404 的路径变成 200 首页。
    location / {
    }
}`,
  },
  {
    id: "shop-showcase",
    label: "sites-available/shop-showcase",
    port: "8081",
    purpose:
      "学习展板面。与 8080 同一性质：root 读磁盘。差别是产物目录（dist-showcase）与放行路径——只有 /auth 反代，没有 /reports。",
    config: `server {
    listen 8081;
    server_name 43.128.154.242;

    root  /home/nodeapp/.../frontend/dist-showcase;
    index index.html;

    location /auth { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }

    location / {
    }
}`,
  },
];


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
export const NOT_ADOPTED =
  "X-Real-IP / X-Forwarded-For / X-Forwarded-Proto 与 trust proxy 三个面上一个都没有配。上面四份就是服务器上实际生效的全部内容——443 上线也没有让这个决定改变，因为应用照样不读那三个字段。";

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
    settledOn: "D4",
    evidence:
      "8/13 收口：certbot 签发 sslip.io 子域名证书 + 手写 shop-ssl；本地开发机 HTTP_CODE:200 + SSL_VERIFY:0。D1 留的「签发失败就回退纯 IP+HTTP」那条支线因为没触发而作废",
    grade: "measured",
  },
  {
    id: "cert-renew",
    what: "证书续期检查",
    settledOn: "D4",
    evidence:
      "8/13 同日销账，不必留到 D5：certbot.timer enabled + NEXT 8/14 04:13 CST + journal 有启动记录，并且 `certbot renew --dry-run` 实跑通过（all simulated renewals succeeded）——「会跑」有了证据，不再只是「应该会跑」",
    grade: "measured",
  },
  {
    id: "cold-path",
    what: "按文档做一次冷路径复核（可复现部署）",
    settledOn: null,
    evidence: "归 D5（8/14）：清理清单 + 逐项核对，在现有主机上重走。拓扑已经比 D1 多出 443 / shop-ssl / certbot.timer，要复核的面比原计划宽",
    grade: "pending",
  },
  {
    id: "timezone",
    what: "聚合时区口径是否按业务时区修正",
    settledOn: null,
    evidence: "D5（8/14）决策。属代码改动，需走 review——不是部署配置能解决的",
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
    "反向代理 + URL 面白名单收敛（公网只暴露真正被调用的路径）",
    "HTTPS 证书签发与自动续期（certbot + systemd timer，dry-run 已验证）",
    "改动纪律：改前备份、nginx -t 挡在生效之前、两级回滚、动手前先写死止损线",
    "一进程多入口：学习展板 8081 独立部署 + 登录门禁（服务边界 ≠ 暴露边界）",
  ],
  missing: [
    { what: "应用层鉴权补齐（/users 目前只有反代层封堵）", owner: "Q8 安全债 · D5 决策" },
    { what: "HTTP→HTTPS 301 跳转与 admin / showcase 面迁到 443（8080/8081 均明文）", owner: "D5 收口决策" },
    { what: "自动化的发布与回滚（手工回滚已成型，缺的是把它变成一条命令）", owner: "W11" },
    { what: "监控、告警、日志聚合", owner: "W10" },
    { what: "备份 + 恢复演练", owner: "未排" },
    { what: "多环境隔离（dev / staging / prod）", owner: "未排，单台直上 prod" },
    { what: "水平扩展 / 多 AZ", owner: "单机，范围外" },
  ],
  verdict:
    "缺的这些是成熟度与规模差异，不是结构错误。结构对了，缺的是「自动化包裹」——今天手工做的每一步，正是 CI/CD 脚本要复刻的真相源。",
} as const;
