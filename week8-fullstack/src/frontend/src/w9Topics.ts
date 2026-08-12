// W9 各专题的舞台数据（展示资产）。引用 w9Facts 的事实，不复制数字。
//
// 阶段 1 只落地「故障分叉」代表页——先用一块板证明本轮新增的语法成立
// （四态切换 + 停止点后才揭示状态码 + 证据档位强制显示），再推其余五块。
// 其余五块的范围见 week9-deployment/notes/week9-visualization-plan.md §4。

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

/** 阶段进度：其余五块的范围，避免把「只做了一块」呈现成「W9 已经做完」。 */
export const W9_STAGE_PLAN = [
  { id: "failure", title: "故障分叉", question: "两个 502 差在哪", done: true },
  { id: "boundary", title: "信任边界与端口", question: "外面能摸到哪一层", done: false },
  { id: "systemd", title: "systemd 失败模式", question: "崩溃循环怎么被停住", done: true },
  { id: "chain", title: "端到端验收链", question: "某次 200 没有证明什么", done: false },
  { id: "proxy", title: "反代 header 决策", question: "反代后该传什么头", done: false },
  { id: "evidence", title: "契约销账与资源闸门", question: "还欠什么", done: false },
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
