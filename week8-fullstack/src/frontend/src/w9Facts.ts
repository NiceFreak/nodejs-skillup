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
