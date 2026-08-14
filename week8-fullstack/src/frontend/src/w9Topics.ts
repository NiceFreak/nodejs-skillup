// W9 各专题的舞台数据（展示资产）。引用 w9Facts 的事实，不复制数字。
//
// 十块已全部落地。当初先做「故障分叉」代表页，是为了用一块板证明本轮新增的语法成立
// （四态切换 + 停止点后才揭示状态码 + 证据档位强制显示），成立之后才推其余各块。
// 8/13 主线收口后重建并从六块扩到十块（先到九块，D4-c 再补「服务边界 vs 暴露边界」），
// 缘由见 W9_STAGE_PLAN 上方注释。
// 各块范围见 week9-deployment/notes/week9-visualization-plan.md §4。

import type { EvidenceGrade } from "./w9Facts";

/** 一帧：请求走到哪一跳、发生了什么。stop 帧是这条路径的终点。 */
export interface PathFrame {
  /** 当前活动的节点 id（对应 CHAIN_NODES）。 */
  at: string;
  /** 这一帧要送达的下一跳；没有则表示停在 at 上。 */
  to?: string;
  narration: string;
  /** 停止点：走到这里请求就结束了（成功或失败）。 */
  stop?: boolean;
}

export interface Discriminator {
  /** 排查动作或观察点。 */
  signal: string;
  /** 这条路径下会看到什么。 */
  value: string;
  /** 是否为区分两条 502 的决定性判据。 */
  key?: boolean;
}

export interface FailurePath {
  id: string;
  /** 场景名 = 条件。复习态照样给出，被隐藏的是结论而不是条件。 */
  label: string;
  condition: string;
  /** 外部看到的状态码。走到停止点之前不渲染。 */
  status: string;
  /**
   * 停止点标记上的文字。刻意按路径分别写：同样是「红在 Node 那一格」，
   * 「到不了这里」（Node 没起来）与「没被发到这里」（Node 活着但 Nginx 没发过来）
   * 是两件不同的事，用一句通用的「停在这里」会把它们抹平。
   */
  stopLabel: string;
  tone: "success" | "failure";
  grade: EvidenceGrade;
  /** 档位说明：为什么是这一档。必须与图相邻显示，不能只放折叠区。 */
  gradeNote: string;
  frames: PathFrame[];
  /** 第一个排查动作。两条 502 的这一格刻意相同——是结果而不是动作把它们分开。 */
  firstAction: string;
  rootCause: string;
  discriminators: Discriminator[];
}

/**
 * 四条路径共用同一条链路，只有停止点不同——这正是 week8 认证链 401/403/200
 * 已经验证过的形态。看点是：两个 502 的外部现象完全相同，靠「第一个排查动作
 * 得到什么结果」分叉。
 *
 * 来源：day1 §5.3（三条路径的设计推演）、day3 §5-B4（快失败注入实测）、
 * day4 §6（正常路径公网实测）。
 */
export const FAILURE_PATHS: FailurePath[] = [
  {
    id: "ok",
    label: "正常",
    condition: "四跳都健在，Nginx 反代配置正确，admin token 有效。",
    status: "200",
    stopLabel: "走完",
    tone: "success",
    grade: "measured",
    gradeNote:
      "D4 ⑤ 唯一验收：本地开发机（非服务器 SSH）实测走通 curl / 登录 / 报表三步，返回真实聚合数据。",
    frames: [
      {
        at: "client",
        to: "nginx",
        narration: "本地开发机发起 GET /reports/monthly-sales?months=6，带 Bearer token，走公网打到 80 端口。",
      },
      {
        at: "nginx",
        narration: "ufw 放行 80，Nginx 接下请求；server_name 精确匹配该 IP，进入 location /。",
      },
      {
        at: "nginx",
        to: "node",
        narration: "proxy_pass http://127.0.0.1:3000 —— 只覆盖 Host $host，不补 X-Forwarded-*（本应用不消费这三类字段）。",
      },
      {
        at: "node",
        narration: "Express 收下请求，依次过 validateToken 与 requireRole('admin')。层内中间件顺序见「测试闭环」板 Day 3，这里不重画。",
      },
      {
        at: "node",
        to: "mongo",
        narration: "requireRole 查库拿当前角色、控制器跑月度聚合，都走 127.0.0.1:27017 这条内线。",
      },
      {
        at: "mongo",
        narration: "聚合结果原路返回。外部拿到 200 与真实数据。",
        stop: true,
      },
    ],
    firstAction: "—（不需要排查）",
    rootCause: "—",
    discriminators: [
      { signal: "systemctl status nodeapp", value: "active (running)" },
      { signal: "ss -tlnp 看 3000", value: "看得到 127.0.0.1:3000" },
      { signal: "Nginx error log", value: "无 upstream 错误" },
      { signal: "外部状态码", value: "200" },
    ],
  },
  {
    id: "boot-db-down",
    label: "启动前挂库",
    condition: "Node 启动的那一刻 MongoDB 不可用（进程没起、认证错、连接串错都算）。",
    status: "502",
    stopLabel: "到不了这里",
    tone: "failure",
    grade: "derived",
    gradeNote:
      "同形态近似实测：D3 B4 第二轮确实观察到 nodeapp 进 failed、3000 未监听，但注入源是 JWT_SECRET 改短，不是 Mongo 挂。本路径本身没有直接注入过。",
    frames: [
      {
        at: "client",
        to: "nginx",
        narration: "外部什么都不知道，照常发起请求。",
      },
      {
        at: "nginx",
        narration: "Nginx 活着，照常接下请求，进入 location /。",
      },
      {
        at: "nginx",
        to: "node",
        narration:
          "proxy_pass 去连 127.0.0.1:3000 —— 连不上。Node 进程根本没起来：connectDB() 失败就 exit(1)，走不到 listen()，3000 从未 bind。",
        stop: true,
      },
    ],
    firstAction: "systemctl status nodeapp",
    rootCause:
      "MongoDB 不可用 → connectDB() 失败 → 进程 exit(1) → 3000 从未监听 → Nginx 转发无门可进。反复失败会按 RestartSec 退避重试，快失败还会撞上 StartLimitBurst 停住。",
    discriminators: [
      { signal: "systemctl status nodeapp", value: "failed（或 activating / auto-restart 循环）", key: true },
      { signal: "ss -tlnp 看 3000", value: "看不到——端口从未 bind", key: true },
      { signal: "Nginx error log", value: "upstream 连接被拒" },
      { signal: "外部状态码", value: "502" },
    ],
  },
  {
    id: "proxy-misconfig",
    label: "反代地址写错",
    condition: "Node 活得好好的，但 Nginx 的 proxy_pass 指向了错误的地址或端口。",
    status: "502",
    stopLabel: "没被发到这里",
    tone: "failure",
    grade: "derived",
    gradeNote:
      "D1 §5.3 的设计推演，从未注入实测。列在这里是因为它与上一条外部现象完全相同——不列出来，排障时就会漏掉这个分支。",
    frames: [
      {
        at: "client",
        to: "nginx",
        narration: "外部照常发起请求，看到的现象会和上一条一模一样。",
      },
      {
        at: "nginx",
        narration: "Nginx 活着，接下请求，进入 location /。",
      },
      {
        at: "nginx",
        to: "node",
        narration:
          "Nginx 按配置里那个错误的 upstream 转发 —— 那个地址上没有进程。Node 活着、3000 也在监听，只是 Nginx 压根没往那儿发。",
        stop: true,
      },
    ],
    firstAction: "systemctl status nodeapp",
    rootCause:
      "配置错误，不是进程错误。Nginx 与 Node 都健康，问题在两者之间的那一行 proxy_pass。下一步是 nginx -t 加读 Nginx 的 error log。",
    discriminators: [
      { signal: "systemctl status nodeapp", value: "active (running)——Node 是好的", key: true },
      { signal: "ss -tlnp 看 3000", value: "看得到 127.0.0.1:3000", key: true },
      { signal: "Nginx error log", value: "upstream 连接被拒（指向写错的那个地址）" },
      { signal: "外部状态码", value: "502" },
    ],
  },
  {
    id: "runtime-db-down",
    label: "运行中挂库",
    condition: "Node 已经正常启动并在服务，之后 MongoDB 才挂掉或连接断开。",
    status: "500",
    stopLabel: "停在这里",
    tone: "failure",
    grade: "derived",
    gradeNote: "D1 §5.3 的设计推演，从未注入实测。与前两条的差别是它停得更深——请求已经进到应用里了。",
    frames: [
      {
        at: "client",
        to: "nginx",
        narration: "外部照常发起请求。",
      },
      {
        at: "nginx",
        narration: "Nginx 活着，接下请求。",
      },
      {
        at: "nginx",
        to: "node",
        narration: "转发到 127.0.0.1:3000 成功——Node 早就启动好了，端口在监听。",
      },
      {
        at: "node",
        narration: "validateToken 只验签、不查库，所以这一步照样过得去。",
      },
      {
        at: "node",
        to: "mongo",
        narration:
          "requireRole 要查库拿角色、控制器要跑聚合 —— 这时才撞上挂掉的 Mongo，查询抛错，被错误中间件翻译成 500。",
        stop: true,
      },
    ],
    firstAction: "journalctl -u nodeapp（先看应用运行日志）",
    rootCause:
      "启动时库是好的，所以进程正常起来了；跑起来之后库才没的。请求进得来，只是查不到数据——这就是它是 500 而不是 502 的原因。",
    discriminators: [
      { signal: "systemctl status nodeapp", value: "active (running)" },
      { signal: "ss -tlnp 看 3000", value: "看得到 127.0.0.1:3000" },
      { signal: "Nginx error log", value: "无 upstream 错误——请求成功转发进去了", key: true },
      { signal: "外部状态码", value: "500（不是 502）", key: true },
    ],
  },
];

/** 判据对照表的行序（与各路径 discriminators 一一对应）。 */
export const DISCRIMINATOR_ROWS = [
  "systemctl status nodeapp",
  "ss -tlnp 看 3000",
  "Nginx error log",
  "外部状态码",
] as const;

/** 本板要留下的那一条可迁移规则。 */
export const FORK_RULE = {
  symptom: "外部看到 502",
  action: "systemctl status nodeapp",
  branches: [
    { result: "failed", conclusion: "Node 没起来 → 路径「启动前挂库」", next: "journalctl -u nodeapp 看 connectDB 报什么" },
    { result: "running", conclusion: "Node 活着 → 路径「反代地址写错」", next: "nginx -t，再读 Nginx error log 的 upstream 行" },
  ],
  note: "两条路径的第一个动作是同一个——把它们分开的是这个动作的结果，不是动作本身。",
} as const;

/**
 * 建构进度。六块建于 8/12（事实截到 D4-HTTP），8/13 主线收口后先按新事实重建，
 * 随后发现 day4b 还有三类内容完全没有归宿——证书、改动纪律、以及被并进
 * 「信任边界」的授权层——于是拆一块、加两块，成为九块；D4-c 又补
 * 「服务边界 vs 暴露边界」成十块。
 */
export const W9_STAGE_PLAN = [
  { id: "boundary", title: "信任边界与端口", question: "外面能摸到哪一层", done: true },
  { id: "urlface", title: "URL 面与授权层", question: "进了门谁被拦在哪", done: true },
  { id: "cert", title: "证书与信任", question: "HTTPS 通了证明了什么", done: true },
  { id: "failure", title: "故障分叉", question: "两个 502 差在哪", done: true },
  { id: "systemd", title: "systemd 失败模式", question: "崩溃循环怎么被停住", done: true },
  { id: "rollback", title: "改一台在跑的机器", question: "改砸了怎么退回去", done: true },
  { id: "chain", title: "端到端验收链", question: "某次 200 没有证明什么", done: true },
  { id: "proxy", title: "反代 header 决策", question: "反代后该传什么头", done: true },
  { id: "evidence", title: "契约销账与资源闸门", question: "还欠什么", done: true },
  { id: "exposure", title: "服务边界 vs 暴露边界", question: "加了入口等于加了业务吗", done: true },
] as const;

/* ==========================================================================
   ③ systemd 失败模式：快失败 vs 慢失败
   舞台的空间编码是「同一个 60 秒窗口，两种重启密度」——
   快失败的 5 次尝试全落在窗口里所以撞上 StartLimitBurst；
   慢失败一次要等 30s 超时，窗口里塞不下 5 次，因此永远触发不了限速。
   这不是两段文字的对比，是同一根轴上两种疏密。
   ========================================================================== */

/** 轴上的一次启动尝试。 */
export interface Attempt {
  /** 相对起点的秒数。 */
  at: number;
  /** 这次尝试怎么结束的。 */
  outcome: "exit" | "timeout" | "refused" | "pending";
  label: string;
  /** 实测拿到的 PID（只有快失败那几次有）。 */
  pid?: string;
}

export interface FailureMode {
  id: string;
  label: string;
  question: string;
  grade: EvidenceGrade;
  gradeNote: string;
  /** 轴的总长度（秒），两条模式各自不同。 */
  spanSec: number;
  attempts: Attempt[];
  frames: Array<{ narration: string; /** 这一帧推进到第几次尝试（含）。 */ upto: number }>;
  /** 结局。 */
  verdict: string;
  verdictTone: "failure" | "controlled";
}

export const FAILURE_MODES: FailureMode[] = [
  {
    id: "fast",
    label: "快失败",
    question: "配置写错了，会不会一直重启下去？",
    grade: "measured",
    gradeNote:
      "B4 第二轮实测：PID、journal 原文与 ~42s 总时长都有记录。但每次重启的精确时刻没记，轴上的位置由 RestartSec=10s 与总时长反推——位置是推的，次数与结局是实测的。",
    spanSec: 62,
    attempts: [
      { at: 0, outcome: "exit", label: "第 1 次：毫秒级 exit(1)", pid: "4600" },
      { at: 10, outcome: "exit", label: "第 2 次：同样立刻退出", pid: "4659" },
      { at: 20, outcome: "exit", label: "第 3 次", pid: "4733" },
      { at: 30, outcome: "exit", label: "第 4 次", pid: "4839" },
      { at: 40, outcome: "exit", label: "第 5 次——计数器到 5" },
      { at: 42, outcome: "refused", label: "第 6 次被拒绝：failed 停住" },
    ],
    frames: [
      { upto: 1, narration: "JWT_SECRET 被改短，启动校验①抛 JwtSecretConfigurationError，进程毫秒级 exit(1)。这是「快」的含义：一次尝试几乎不占时间。", },
      { upto: 2, narration: "RestartSec=10s 退避后再来一次，结果一样——配置错误不会因为重试而消失。", },
      { upto: 4, narration: "第 3、4 次同样秒退。注意 60 秒窗口还没走完，尝试次数已经堆到 4。", },
      { upto: 5, narration: "第 5 次退出，窗口内的启动计数达到 StartLimitBurst=5。", },
      { upto: 6, narration: "systemd 拒绝再拉起：Start request repeated too quickly → 单元进入 failed，停住不动。崩溃循环被掐断了。", },
    ],
    verdict: "failed 停住——这正是 StartLimitBurst 要保护的场景",
    verdictTone: "failure",
  },
  {
    id: "slow",
    label: "慢失败",
    question: "数据库挂了，会不会也被限速停住？",
    grade: "derived",
    gradeNote:
      "由 serverSelectionTimeoutMS=30s 与 StartLimitIntervalSec=60s 推出，没有真正跑过一次。标为推演：结论可信，但不是实测记录。",
    spanSec: 100,
    attempts: [
      { at: 0, outcome: "timeout", label: "第 1 次：connectDB 等 30s 才超时" },
      { at: 40, outcome: "timeout", label: "第 2 次：40s 才开始，又要等 30s" },
      { at: 80, outcome: "pending", label: "第 3 次：窗口早就滑过去了" },
    ],
    frames: [
      { upto: 1, narration: "MongoDB 不可用，connectDB 不会立刻失败——它要等满 serverSelectionTimeoutMS=30s。这是「慢」的含义：一次尝试就吃掉半个窗口。", },
      { upto: 2, narration: "超时后 RestartSec=10s 退避，第 2 次在第 40 秒才开始，又要等 30s。60 秒窗口里最多塞下 2 次启动。", },
      { upto: 3, narration: "计数永远到不了 5，限速器不会触发。单元一直在 restarting——这是设计意图：数据库恢复后它自己会拉起来。", },
    ],
    verdict: "一直 restarting，等依赖恢复后自动拉起",
    verdictTone: "controlled",
  },
];

/** 本板要留下的那一条结论。 */
export const LIMIT_RULE =
  "StartLimitBurst 保护的是崩溃循环，不是慢依赖等待。判据是「一次失败要花多久」：秒级失败会在窗口内堆满次数被停住，30 秒级失败根本堆不满。";

/* ==========================================================================
   ⑥ 认知修正 17 条（8/13 新增两条：静态服务要读盘、两层防火墙；D4-c 又补三条）
   ========================================================================== */

/**
 * 分类比结论本身更值得复习：它记录的是**哪一类推理会出错**。
 *
 * `experiential` 是 W9 相对 week8 Day4 必须新增的一类。read -s、sudo env_reset、
 * ESM 解析锚点这些不是推理错误，是 AGENTS.md §4 明确定义的「必须真实遇过一次才知道」
 * 的经验知识。把它们和「结论超出证据」混成一类，等于告诉复习者「你本该推出来」，
 * 与协作规范直接冲突。
 */
export type CorrectionKind = "overreach" | "order" | "concept" | "evidence" | "boundary" | "experiential";

export const W9_CORRECTION_KIND: Record<CorrectionKind, string> = {
  overreach: "结论超出证据",
  order: "调用顺序",
  concept: "概念混淆",
  evidence: "证据不成立",
  boundary: "边界归属",
  experiential: "工具行为经验 · 必须遇过一次",
};

export interface W9Correction {
  id: string;
  kind: CorrectionKind;
  initial: string;
  problem: string;
  final: string;
  from: string;
}

export const W9_CORRECTIONS: W9Correction[] = [
  {
    id: "bcrypt",
    kind: "concept",
    initial: "bcrypt 装的时候会走 node-pre-gyp 去下载预编译产物，装不上就现场编译。",
    problem: "认错了机制。这两条路径的失败形态、耗时和依赖完全不同，判断「会不会 OOM」时会走偏。",
    final: "实际是 node-gyp-build / prebuildify：产物直接打进 npm 包，零下载零现场编译。102 包 5s 装完，OOM 风险实质解除。",
    from: "D3 槽位 b",
  },
  {
    id: "allow-scripts",
    kind: "overreach",
    initial: "npm 11 的 allowScripts 大概不会生效，安装脚本照跑。",
    problem: "把没验证过的推断写进了 day2 笔记 §2.2，后面的判断都建在它上面。",
    final: "实测生效。推断和结论要分开写，否则后续推理会继承一个没人核过的前提。",
    from: "D3 槽位 b",
  },
  {
    id: "root-600",
    kind: "boundary",
    initial: "root 读不了 600 的文件。",
    problem: "把普通用户的权限直觉套到了 root 上；同一形态连着出现三次才最终定论。",
    final: "root 不受文件权限位限制。另外 nologin 用户不能 su -——身份切换与文件权限是两套边界，不能混着推。",
    from: "D2 / D3",
  },
  {
    id: "ping",
    kind: "evidence",
    initial: "用 ping 判断 MongoDB 认证是否配好了。",
    problem: "ping 不需要认证也能过，它证明不了认证生效——用了一条没有判别力的证据。",
    final: "改用语义明确的命令：listDatabases 这类需要授权的操作，失败才有意义。",
    from: "D3 槽位 e",
  },
  {
    id: "restart-async",
    kind: "order",
    initial: "systemctl restart 返回了，服务就已经起来、端口已经 bind。",
    problem: "命令返回和进程就绪是两个时刻，中间还有 connectDB 与 listen。按返回值就去 curl 会看到假失败。",
    final: "restart 是异步的。要验证就查 systemctl status 加 ss，不能拿命令返回当就绪信号。",
    from: "D3 槽位 e",
  },
  {
    id: "read-s",
    kind: "experiential",
    initial: "在网页终端里用 read -s 读密码，和本地终端一样。",
    problem: "网页终端不是 TTY，read -s 读不到 stdin——printf 'len=%s' 实测长度为 0。这件事文档里查不到。",
    final: "改用 export VAR='...' 赋值：不进 ps、不进历史，也不依赖 TTY。",
    from: "D3 B2",
  },
  {
    id: "node-e-esm",
    kind: "experiential",
    initial: "node -e 里 import 一个包，解析规则和写在文件里一样。",
    problem: "node -e 的模块解析锚在 cwd（报错路径显示 /home/ubuntu/[eval1]），不在脚本位置——因为根本没有脚本位置。",
    final: "内联执行要么切到有 node_modules 的目录，要么用绝对路径 import。",
    from: "D3 B2",
  },
  {
    id: "wants",
    kind: "concept",
    initial: "stop mongod 之后再 start nodeapp，就能观察到「数据库没了所以起不来」。",
    problem: "Wants=mongod.service 在 start 时会把依赖连带拉起（pid 3556 与 3557 相邻同秒），注入根本没生效。",
    final: "Wants 是弱依赖但仍会连带启动。设计故障注入之前必须先想清依赖语义，否则测的是另一件事。",
    from: "D3 B4 第一轮",
  },
  {
    id: "fast-slow",
    kind: "concept",
    initial: "StartLimitBurst 会保护所有反复失败的情况。",
    problem: "把「失败」当成了一种东西。一次失败要花多久，决定了 60s 窗口里能堆几次。",
    final: "它保护的是崩溃循环（秒级快失败）。等依赖的慢失败（30s 超时）在窗口里堆不满 5 次，会一直 restarting——这是设计意图。",
    from: "D3 B4 第二轮",
  },
  {
    id: "utc",
    kind: "boundary",
    initial: "服务器时区设成 CST，聚合出来的月份就是本地月份。",
    problem: "$match 的时间窗按本地收进来，$group 的 $year/$month 却按 UTC 分组——两个阶段用了不同的时间基准。",
    final: "凌晨 00:00–08:00 的单会跨月归因（实测 7 月多出 3 单）。要按业务时区就得在 $dateToString 里显式指定。",
    from: "D3 B3",
  },
  {
    id: "esm-file",
    kind: "experiential",
    initial: "脚本放 /tmp 跑，--env-file 能找到 .env，import 应该也没问题。",
    problem: "两者锚点不同：--env-file 按 cwd 解析（所以找得到 .env），而文件脚本的 import 锚在脚本文件位置，从 /tmp 向上找不到 node_modules。",
    final: "这是 node -e（锚 cwd）的对称面。脚本要放在与 node_modules 同一棵树里。",
    from: "D4 ① 凭据轮换",
  },
  {
    id: "sudo-env",
    kind: "experiential",
    initial: "export 过的变量，sudo -u other 之后进程里还能读到。",
    problem: "sudo 默认 env_reset，环境变量被丢掉了，process.env.X 是 undefined。",
    final: "要跨 sudo 传变量得显式 --preserve-env=VAR，而且只带需要的那一个，不展开全部。",
    from: "D4 ① 凭据轮换",
  },
  {
    id: "static-reads-disk",
    kind: "experiential",
    initial: "Nginx 之前在 80 上跑得好好的，加个 8080 静态站点当然也能读到 dist。",
    problem:
      "80 站点从头到尾没读过磁盘——proxy_pass 只是把请求转走。8080 的 location / 是 root，Nginx worker（www-data）要真的去 /home/nodeapp 下取文件，而那个目录是 750，other 没有 x 就无法穿越，直接 403。",
    final:
      "反代不读盘，静态服务要读盘。chmod o+x /home/nodeapp（750 → 751，drwxr-x--x）之后 200——给的是穿越权限，不是列目录权限。80 一直没被 750 影响过，正是因为它从不碰磁盘。",
    from: "D4-b 段 2 · B3",
  },
  {
    id: "two-firewalls",
    kind: "overreach",
    initial: "ufw 放行了 8080，ss 也看得到 0.0.0.0:8080 在监听，那公网就该通了。",
    problem:
      "只数了主机内的那一道闸门。腾讯云控制台的「防火墙」是另一层完全独立的防线，D4 那天只放过 80——8080 的包在进主机之前就被丢了，表现为 SYN DROP 而不是拒绝。",
    final:
      "两层都放行才等于公网可达。判据是失败形态：超时说明包没进主机，该查控制台；拒绝说明包进来了但没人监听，该查本机。这条在 day4 §5 就作为「归因预备」写下过，8/13 才第一次真的触发。",
    from: "D4-b 段 2 · B5",
  },
  {
    id: "service-exposure",
    kind: "boundary",
    initial: "给服务器新加一个学习展板站点，相当于在服务器上多部署了一个业务。",
    problem:
      "把「Nginx 新增 server block + 一份前端产物」当成了「新增业务」。加的是暴露面，不是业务进程。",
    final:
      "服务边界看进程（ps / ss 里几个后端进程），暴露边界看 server block。四个面（80/443/8080/8081）后面还是同一个 nodeapp，一个厨房四个门。",
    from: "D4-c §4",
  },
  {
    id: "dist-split",
    kind: "boundary",
    initial: "管理后台和学习展板都是同一份前端构建产物，输出到同一个 dist 就行。",
    problem:
      "两个 UI 站点若共用 dist/，后构建的一方会覆盖另一方（admin.html / showcase.html 互删），必有一个站点拿到残缺产物。",
    final:
      "构建产物按入口分目录：OUT_DIR = SHOWCASE ? dist-showcase : dist。admin 构建 → dist/，showcase 构建（VITE_SHOWCASE_ONLY=1）→ dist-showcase/，两套并存互不覆盖。",
    from: "D4-c §2.3",
  },
  {
    id: "gate-browser-only",
    kind: "boundary",
    initial: "给学习展板加了登录门禁，未登录就访问不到展板内容了。",
    problem:
      "前端门禁只挡浏览器用户——静态内容打包在 bundle 里，curl 照样能抓。把「挡路人」档位说成「真访问控制」是夸大。",
    final:
      "形态 A（前端门禁）只挡随手打开链接的人；静态内容可被抓取是接受这个档位时必须承认的边界。要真访问控制得走 Nginx auth_request / 后端 serve 前校验（形态 B，属 W4）。",
    from: "D4-c §1.3",
  },
];

/* ==========================================================================
   ②-b TLS 排障两相位（H4 冻结，2026-08-13）
   故障分叉板处理的是「502 之后往哪走」，这一段处理的是 443 上线之后新增的问法：
   「域名打不开」——它比 502 更早一步，因为请求可能连 Nginx 都没摸到。
   H4 第一版把七层排成一条直线，review 之后改成两相位：先看症状是不是超时，
   两条相位不共用同一条排查线，跨相位不串层。
   ========================================================================== */

export interface TriageStep {
  layer: string;
  command: string;
  /** 看到什么算这一层没问题。 */
  pass: string;
  /** 看到什么就停在这一层。 */
  fail: string;
}

export interface TriagePhase {
  id: string;
  /** 进入这条相位的症状判据。 */
  symptom: string;
  label: string;
  why: string;
  steps: TriageStep[];
  grade: EvidenceGrade;
  gradeNote: string;
}

export const TLS_TRIAGE: TriagePhase[] = [
  {
    id: "timeout",
    symptom: "症状 = 超时（没有任何回应）",
    label: "相位 A · 包根本没到",
    why: "超时意味着连 TCP 都没握上手，谈证书、谈 server_name 都太早——先确认包能不能进到主机。",
    grade: "measured",
    gradeNote:
      "A2 与 A4 在 8/13 真的走过：443 放行前后拿到 timed out → refused 的差分，8080 那次的根因也确实落在控制台。A1 的 dig 同日实测。",
    steps: [
      {
        layer: "① DNS 解析",
        command: "dig +short 43-128-154-242.sslip.io",
        pass: "返回 43.128.154.242 —— 域名指对了",
        fail: "空结果或指向别处：问题在域名，不在服务器",
      },
      {
        layer: "② 外部 TCP",
        command: "nc -zv -G5 43.128.154.242 443",
        pass: "连得上 → 说明包进得来，转到相位 B",
        fail: "还是超时 → 继续往下，别跳过 ufw",
      },
      {
        layer: "③ 本机监听 + ufw",
        command: "sudo ss -tlnp | grep 443 · sudo ufw status",
        pass: "有进程在听且 ufw ALLOW —— 主机这一侧是干净的",
        fail: "没监听 → 查站点配置；ufw 没放行 → 就是它（默认 DROP 的表现正是超时）",
      },
      {
        layer: "④ 差分安全组",
        command: "本机监听正常 ∧ ufw 放行 ∧ 外部仍超时 → 打开腾讯云控制台",
        pass: "补上规则后由 timed out 变成 refused 或 200",
        fail: "—— 这是相位 A 的终点，三条件差分成立时答案只可能在这里",
      },
    ],
  },
  {
    id: "error",
    symptom: "症状 ≠ 超时（有回应，但不对）",
    label: "相位 B · 包到了，但被挡在某一层",
    why: "有回应就说明网络层已经通了。往下查的是 TLS、证书、反代这三层，跟防火墙无关。",
    grade: "derived",
    gradeNote:
      "冻结时按 H4 推演排定；实际执行没有触发这条相位（一次就签发成功、H1 直接过），所以三步都没有真跑过。",
    steps: [
      {
        layer: "① TLS 握手 + SNI",
        command: "openssl s_client -connect …:443 -servername 43-128-154-242.sslip.io",
        pass: "握手完成并返回证书链",
        fail: "握手失败 → server_name / ssl_certificate 配置对不上",
      },
      {
        layer: "② 证书信任",
        command: "curl -v https://43-128-154-242.sslip.io（看 verify 那几行）",
        pass: "SSL_VERIFY:0",
        fail: "非 0 → 证书过期、链不全，或用 IP 访问导致 SAN mismatch",
      },
      {
        layer: "③ 后端反代",
        command: "看 HTTP_CODE",
        pass: "200 —— 全链贯通",
        fail: "5xx → 后端挂了（回故障分叉板）；4xx → 白名单或路由问题",
      },
    ],
  },
];

/** 两相位之间那条不能越过的界。 */
export const TRIAGE_RULE =
  "先分相位，再查层——不要把七层排成一条直线挨个试。症状是超时还是有回应，决定了走哪一条；跨相位不串层，否则会在证书上耗半小时，而问题其实在控制台的一条规则里。";
