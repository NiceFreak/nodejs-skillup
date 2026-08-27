// W11 发布流水线的 canonical 事实（展示资产，纯前端静态数据）。
//
// 与 w9Facts / w10Facts 分开的理由不变：每块板遍历自己的全量数据，
// 混在一起会让别的板凭空多出它没有叙述的条目。
//
// 数字来源：week11-ci/notes/ 下的
//   day1-release-contract.md   §4 Q1–Q18 / §5.1 发布契约表 / §5.5 部署后验证清单 / §5.6 只读基线
//   day1-contract-freeze.md    §3 预测与偏差
//   day2-controller-setup.md   §0 开工前 review 十处 / §3 P1–P6 / §4 九步执行记录与十四条计划外事件
//   day3-deploy-credentials.md §3 P1–P7 与 D1–D5 / §4 前置核对与十二步执行记录 / 收工点 A 与 B 的验证结果
//   ../Jenkinsfile             D2 落地的三阶段流水线，D3 增加部署、验证与日志扫描
//   d2-server-baseline/        装 Jenkins 前后各 192 行、七项只读基线
//   change-order-showcase-remote-trigger.md §2 三条决定性事实 / §3 三方案取舍 / §9 执行结果回填
//   retro-remote-trigger-workload.md §3 三条失效判据的机制
//   day4-rollback-drill.md    §2.3 C1–C6 与 V1–V12 / §3 P1–P6 / §4 十一步执行记录 / §5 三份五段式记录
// 方法稿见 week11-ci/notes/week11-visualization-plan.md
//（§17 为 D3 成果的编码表，§19 为 ⑧ 远程触发的信任边界，§20 为 ⑨ 判据失效面）。
//
// 唯一真源纪律：下面这些数字（5 个阶段 / 7 项零改动核对 / 14 条计划外事件 /
// 514 包 24 秒 / 3 suites 9 tests 12.9 秒 / 8 GiB 与 512 MiB / 301 MB / 481 M /
// 30 秒超时 / 6a1b1a1；D3 一批：提权白名单 8 条 / 强制命令 4 条 / 收窄前 2 文件 4 条 /
// 7 项验证 5 层覆盖 / 执行侧 6 与 1 / 116 包 2 秒 / 0.515 秒与预测 5 至 8 秒 /
// 构建 33 与 36 / 约 190 行 / 80 个提交 / 7b90b25；D3 附加项一批：候选通道 3 与要求 5 项 /
// 可证伪验证 9 条 / 待拍板 6 条 / 手机侧请求超时 12 秒 / 落盘命令进白名单后 9 条 /
// 判据 11 条与失效 3 条 / 轮询延迟 1 分 29 秒 / 构建 8 与 9 与 10 与 12；
// D4 一批：六个提交的短 sha 与时刻 / 构建 57 至 61 / 1 失败 9 通过共 10 条 / 轮询失败 47.7 秒 /
// 健康检查等 30 秒 / 崩溃循环 11:28:00 至 11:28:11 / 回滚重装 116 包 2 秒 / 磁盘 32.2 GiB 与内存 1299 MB /
// 三种关闭时机 × 100 次 × 两侧 / 两侧 Node v24.16.0 与 v24.19.0 / 端口 3001 与 13000）
// 只在本文件出现一次，组件里不得再写字面量。
//
// 派生值一律由函数算：⑨ 的判定由两个观察字段是否相等算出（criterionVerdict），
// ⑧ 的采纳与否由否决依据算出，都不在数据里手写一份可能与取值漂移的结论。

/**
 * 证据档位。沿用 W10 的三档，一个字不改。
 *
 * D3 收口后本板已无 contract 档：部署段两阶段在 8/26 翻档为 measured。
 * 现在的 pending 是真实欠账（收窄尚未闭合的两项、部署后未留下记录的一次性核对，
 * 以及 D4 之后新增的四项：零次执行的自动回滚路径、两处没留痕的快照取值、
 * 仍是纸面的第三条路径、修复后没采集的那一格），
 * 它们写成节点而不是脚注——板头的「待做」计数因此不再是 0。
 *
 * 本周专属的一条分档纪律（复盘时两者要走的路不同）：
 *   contract 错了是决策要改（例：明文端口本周下线）；
 *   pending  只是还没量或还没做。
 */
export type W11Grade = "measured" | "contract" | "pending";

export const W11_GRADE: Record<W11Grade, { label: string; meaning: string }> = {
  measured: {
    label: "已实测",
    meaning: "有构建记录、命令输出或前后对照可追溯到实际执行。",
  },
  contract: {
    label: "已拍板",
    meaning: "已作出明确决定，但尚未实现或尚未验证。",
  },
  pending: {
    label: "待做",
    meaning: "证据尚未产生，或已确认需要修改但尚未完成。",
  },
};

/* ==================================================== ② 五阶段与它们各自的失败面 */

/**
 * 一个阶段在哪一侧执行。这是全板贯穿的空间约定：
 * 左 = controller（开发机），右 = 服务器，cross = 这一段跨过中线（一次 SSH）。
 *
 * 它不是画法上的偏好：本周所有失败面的分界线就是这条中线——
 * 前三阶段之所以对服务器零影响，正是因为它们整段都在左半。
 */
export type W11Side = "controller" | "cross" | "server";

export const W11_SIDE: Record<W11Side, string> = {
  controller: "controller（开发机）",
  cross: "经 SSH 在服务器执行",
  server: "服务器",
};

/** 阶段失败时服务器处于什么状态。三种，不是两种。 */
export type ServerState = "untouched" | "risk" | "deployed";

export const SERVER_STATE: Record<ServerState, { label: string; detail: string }> = {
  untouched: { label: "未被碰过", detail: "本阶段动作全部在 controller 执行，服务器保持上一轮部署的版本。" },
  risk: { label: "可能处于中间态", detail: "代码可能已更新，依赖可能只安装一半，进程可能未启动。" },
  deployed: { label: "已换版本并重启", detail: "部署已执行，应用运行在新版本上。" },
};

export interface Stage {
  id: string;
  n: number;
  name: string;
  side: W11Side;
  /** 入口动作。只写动作名与对象，不给可复制的整条命令（方法稿 §9）。 */
  entry: string;
  /** 什么条件算这一阶段失败。 */
  fail: string;
  serverState: ServerState;
  /** 失败之后由谁来动、动什么。 */
  after: string;
  grade: W11Grade;
  /** measured 的那几格：证据是什么。 */
  evidence?: string;
  /** contract 的那几格：证据差在哪。档位标签一个词带不过去。 */
  caveat?: string;
}

export const STAGES: Stage[] = [
  {
    id: "checkout",
    n: 1,
    name: "Checkout",
    side: "controller",
    entry: "按 job 配置的分支取到指定提交",
    fail: "git 退出码非零：网络不可达、分支不存在或凭据无效",
    serverState: "untouched",
    after: "流水线标记失败，人工介入",
    grade: "measured",
    evidence: "8/25 构建 #7 由 Poll SCM 自动触发并完成取码。另有一次 443 端口连接超时 75 秒的失败样本。",
  },
  {
    id: "install",
    n: 2,
    name: "Install",
    side: "controller",
    entry: "按 lockfile 安装全量依赖，含 devDependencies",
    fail: "npm ci 退出码非零：lockfile 与 package.json 不一致、网络不通或原生依赖安装失败",
    serverState: "untouched",
    after: "流水线标记失败，人工核对 lockfile。工作区由 deleteDir 清理。",
    grade: "measured",
    evidence: "8/25 实测安装 514 个包，用时 24 秒。",
  },
  {
    id: "test",
    n: 3,
    name: "Test",
    side: "controller",
    entry: "运行三份测试，两份集成测试使用 MongoMemoryServer",
    fail: "任一用例失败，或测试环境启动失败",
    serverState: "untouched",
    after: "流水线标记失败并输出失败用例，由人修改代码。无需回滚。",
    grade: "measured",
    evidence: "8/25 实测 3 个套件 9 条用例通过，用时 12.9 秒。变红实验修改一条断言后为 1 失败 8 通过。",
  },
  {
    id: "deploy",
    n: 4,
    name: "Deploy",
    side: "cross",
    entry: "通过部署密钥调用服务器上的 deploy-wrapper，传入提交号",
    fail: "SSH 连接失败，或 wrapper 内任一步退出码非零",
    serverState: "risk",
    after: "在同一 SSH 会话内回滚到本轮起点，回滚后仍标记失败",
    grade: "measured",
    evidence:
      "8/26 首次自动部署：记录本轮起点提交、取码、按运行时依赖安装 116 个包用时 2 秒、重启服务，" +
      "服务器版本由 6a1b1a1 换到 7b90b25。重启到本地健康端点再次返回 200 实测 0.515 秒。" +
      "本次跨越 80 个提交，但部署单元内只有测试脚本与超时两处改动，依赖与 lockfile 未变，运行时差异为零。",
  },
  {
    id: "verify",
    n: 5,
    name: "Verify",
    side: "server",
    entry: "按部署后验证清单依次探活：本地 /health、数据库、公网 443、端口监听、两项检查脚本",
    fail: "任一验证项不通过",
    serverState: "deployed",
    after: "不自动回滚。标记失败，由人判定是否回滚。",
    grade: "measured",
    evidence:
      "8/26 部署后七项按表序全部通过，含经公网反向代理的一次 200。验证结果由服务器侧一次调用打印回构建日志，" +
      "回滚基线随后由更新基线的命令写成本次提交。两个检查脚本的路径已用服务单元实测值替换契约中的占位。",
  },
];

/** 前三阶段共用同一段「未被碰过」，画成一整段而不是三段各写一次。 */
export const UNTOUCHED_SPAN = STAGES.filter((s) => s.serverState === "untouched").length;

/**
 * 两条必须与 ② 相邻的限定语。不写会让「测试绿」被读成「生产没问题」。
 * 两条都来自 D2 执行期，不是 D1 契约里就有的。
 */
export const STAGE_CAVEATS: Array<{ id: string; title: string; body: string; grade: W11Grade }> = [
  {
    id: "three-sources",
    title: "Test 阶段使用的数据库与生产不同源",
    body:
      "Jenkins 侧由 MongoMemoryServer 启动 mongod 8.2.6，GitHub Actions 使用 mongo:7 容器，生产版本尚未核对。" +
      "该阶段通过只说明隔离环境中的行为。兜底放在部署后验证（真实 mongod 加只读探活）；" +
      "报表聚合与权限校验这类低频路径不在探活范围内。",
    grade: "measured",
  },
  {
    id: "testee-config",
    title: "为运行该阶段修改了被测项目的测试配置",
    body:
      "jest 默认并发 2 个 worker，两个内存库同时启动会使 beforeAll 超过默认的 5 秒超时。" +
      "处理方式是测试串行执行并将超时提高到 30 秒，写入被测项目的 package.json。" +
      "该改动属测试运行配置，不涉及业务逻辑，但构成被测对象对流水线的一处耦合。",
    grade: "measured",
  },
];

/**
 * 「服务器零改动」不是一句声明。装 Jenkins 前后各采一次同样的七项只读基线，
 * 收工后逐行 diff——这是本板上唯一一条有对照组的「未发生」。
 */
export const ZERO_CHANGE: {
  items: Array<{ id: string; name: string; baseline: string }>;
  diff: string;
  lesson: string;
  grade: W11Grade;
} = {
  items: [
    { id: "authkeys", name: "认证入口", baseline: "authorized_keys 的校验和不变" },
    { id: "sudo", name: "特权范围", baseline: "四条授权条目一字不变" },
    { id: "listen", name: "监听端口", baseline: "八个端口，一个不多一个不少" },
    { id: "services", name: "服务与定时器", baseline: "三个常驻服务 active，四个检查 timer 在册" },
    { id: "worktree", name: "部署工作副本", baseline: "HEAD 仍是 6a1b1a1，未跟踪文件仍只有那一个静态产物目录" },
    { id: "procs", name: "进程快照", baseline: "只有应用进程，无 jenkins / java" },
    { id: "tmp", name: "临时文件", baseline: "无 jenkins 残留" },
  ],
  diff: "七项中六项逐字相同。差异只出现在进程项的两个动态列：常驻内存减少 308 KB，累计 CPU 由 7:07 增加到 7:26。",
  lesson:
    "全量进程快照会把内存与 CPU 这类动态列纳入 diff。进程项应只比对进程是否新增或消失。" +
    "基线粒度过细会把动态噪音判为变更，过粗则会遗漏真实变更。",
  grade: "measured",
};

/* ============================================ ⑥·1 契约层：纸面推演抓到的六条 */

/**
 * 是什么手段抓到了这一条。这一列是 ⑥·1 的重心：六条里没有一条来自机器，
 * 因为契约在那个时刻还不是任何工具的输入——这一层根本没有机器可用。
 */
export type PaperCatcher = "conflict" | "fact" | "mechanism" | "source";

export const PAPER_CATCHER: Record<PaperCatcher, string> = {
  conflict: "冲突自查",
  fact: "事实核对",
  mechanism: "机制核对",
  source: "读源码",
};

/** 机器手段的名字。留一个常量是为了让「机器抓到 0 条」这句话在数据层就成立。 */
export const MACHINE_CATCHERS: string[] = [];

export interface ContractCheck {
  id: string;
  /** 契约里的编号；两条阻断性修复没有编号，用破折号。 */
  tag: string;
  title: string;
  initial: string;
  mechanism: string;
  fix: string;
  caughtBy: PaperCatcher;
  caughtDetail: string;
  grade: W11Grade;
}

export const SELF_CHECKS_CONTRACT: ContractCheck[] = [
  {
    id: "devdeps",
    tag: "B1",
    title: "两侧安装的依赖集合不同",
    initial: "依赖安装一次即可：生产只运行应用，两侧都按不含开发依赖安装。",
    mechanism:
      "controller 侧要运行测试，而测试框架、HTTP 断言库与内存数据库都在 devDependencies。" +
      "按生产方式安装后，Test 阶段找不到测试命令。",
    fix: "controller 安装全量依赖，服务器只安装运行时依赖。两侧集合不同，写入契约表。",
    caughtBy: "conflict",
    caughtDetail: "冲突自查并列检查“测试在哪一侧运行”与“产物形态”两题时发现。",
    grade: "measured",
  },
  {
    id: "markverified",
    tag: "B1′",
    title: "回滚基线缺少写入通道",
    initial: "部署后验证通过后，最近一次验证通过的提交会自动更新。",
    mechanism:
      "回滚基线存放在服务器上的一个文件中，部署身份可执行的命令是一份白名单。" +
      "白名单只有部署与回滚两条，没有任何命令会写入该文件。",
    fix: "白名单增加第三条命令：只写入基线文件，不部署也不重启，由验证通过后调用。",
    caughtBy: "conflict",
    caughtDetail: "并列检查回滚目标与权限清单两题时发现：判据已定义，执行通道缺失。",
    grade: "measured",
  },
  {
    id: "logger",
    tag: "B2",
    title: "部署标记可由任意登录用户写入",
    initial: "部署窗口用系统日志标记划定，只有部署脚本写该标记，因此见到标记即可抑制告警。",
    mechanism:
      "logger 命令对任何登录用户可用，/dev/log 对普通用户可写，标记本身没有权限控制。" +
      "前提不成立时，抑制规则等价于任何用户都可以让告警静默。",
    fix:
      "抑制依据改为交叉验证：系统日志中的提交号与构建编号需与当次构建记录一致，且未超时。" +
      "标记继续保留，但只作线索，不作凭据。",
    caughtBy: "mechanism",
    caughtDetail: "复核该抑制规则的安全论证时发现：先确认前提是否成立。",
    grade: "measured",
  },
  {
    id: "nologin",
    tag: "B3",
    title: "计划使用的部署身份无法登录",
    initial: "部署目录属于应用用户，用该身份登录服务器执行部署。",
    mechanism:
      "该用户为 nologin，不能 SSH 登录，服务器上唯一的 SSH 入口是另一个用户。" +
      "仓库属主仍是应用用户，登录身份直接操作仓库会触发属主校验失败。",
    fix: "登录使用唯一 SSH 入口身份，文件操作切换到应用用户执行，服务重启走提权白名单。",
    caughtBy: "fact",
    caughtDetail: "只读采集中查询该用户的身份信息时证伪。",
    grade: "measured",
  },
  {
    id: "sshcmd",
    tag: "—",
    title: "wrapper 读不到位置参数",
    initial: "提交号作为位置参数传给服务器上的 wrapper。",
    mechanism:
      "公钥配置强制命令后，客户端传来的命令整体被替换，原始命令进入环境变量 SSH_ORIGINAL_COMMAND。" +
      "按位置参数编写的脚本读到的是空值，且不报错。",
    fix: "脚本改为读取该环境变量，用正则白名单校验，并拒绝以短横线开头的参数。",
    caughtBy: "mechanism",
    caughtDetail: "核对强制命令的替换范围时发现。",
    grade: "measured",
  },
  {
    id: "jdk",
    tag: "—",
    title: "单独安装的 JDK 不会被使用",
    initial: "先安装长期支持版 JDK，再安装 CI 服务，两者版本对应。",
    mechanism:
      "该服务的安装配方声明依赖另一个 JDK 大版本，启动脚本硬编码使用该版本的路径。" +
      "单独安装的版本不会被加载。",
    fix: "删除该步骤，JDK 由安装配方带入。由包管理器管理 JDK 依赖的设计意图不变。",
    caughtBy: "source",
    caughtDetail: "起草落地单时读取安装配方源码与接口描述，双向确认。",
    grade: "measured",
  },
];

/* ======================================== ⑥·2 机制层：动手之后，一条命令才看得见 */

export interface RuntimeCheck {
  id: string;
  /** criterion = 判据级，换任何一套 CI 工具都会再遇到；cost = 不判据级但代价最高。 */
  kind: "criterion" | "cost";
  title: string;
  initial: string;
  mechanism: string;
  fix: string;
  /** 抓到它的那条命令。⑥·1 的对应列是「谁抓到的」，两列语义相反。 */
  command: string;
  commandNote: string;
  grade: W11Grade;
}

export const RUNTIME_KIND: Record<RuntimeCheck["kind"], string> = {
  criterion: "判据级",
  cost: "代价最高",
};

export const SELF_CHECKS_RUNTIME: RuntimeCheck[] = [
  {
    id: "heap",
    kind: "criterion",
    title: "服务已启动，堆参数未生效",
    initial: "配置文件已创建、路径已按实测修正、服务显示已启动、常驻内存低于止步线，堆参数已生效。",
    mechanism:
      "该版本包管理器的服务机制不读取这个配置文件，生成的启动描述里没有环境变量段。" +
      "实际最大堆仍是默认值 8 GiB，合约值是 512 MiB。上述四项观察都不反映参数是否被读取。",
    fix:
      "改为在启动描述文件中注入环境变量并自行管理启停。重启后最大堆 512 MiB，常驻内存 301 MB。" +
      "附带一条管理约定：不再用包管理器的服务命令启停它，否则注入会被覆盖。",
    command: "向 JVM 查询实际堆参数",
    commandNote:
      "该验证项来自开工前 review：原验证只测量常驻内存，而默认堆下的空载服务同样低于止步线，" +
      "对参数是否生效不敏感。",
    grade: "measured",
  },
  {
    id: "ci",
    kind: "criterion",
    title: "构建环境注入 CI 变量，测试回退路径失效",
    initial: "构建环境不会设置 CI 变量，测试走内存数据库的回退路径。",
    mechanism:
      "该版本 CI 服务向构建环境注入 CI=true，与另一套托管 CI 行为一致，且不来自任何可配置位置。" +
      "测试代码的规则是：CI 为真且未提供数据库地址时直接抛错。",
    fix:
      "Test 阶段把该变量置为空串（JS 假值），保留内存数据库的隔离验证。" +
      "不能写成 false：非空字符串在 JS 中为真值。",
    command: "一次冒烟构建，打印构建环境变量",
    commandNote: "该步骤原本用于确认构建环境能否找到 node，打印出的变量同时推翻了库来源决策的前提。",
    grade: "measured",
  },
  {
    id: "polling",
    kind: "criterion",
    title: "轮询失败被记为无变化，不触发也不报错",
    initial: "轮询失败会报错，在界面上看得到。",
    mechanism:
      "代码托管方 443 端口间歇不可达时，轮询把该次失败记为 No changes，不触发构建，也不产生错误。" +
      "界面显示与没有新提交时相同。",
    fix:
      "当天网络恢复后由轮询自动触发并通过。部署段把轮询作为唯一触发通道，需要能区分这两种情况。",
    command: "查看轮询日志",
    commandNote: "与 W10「检查从未产生红色结果时无法区分正常与未运行」属同类问题。该条移交 D3。",
    grade: "measured",
  },
  {
    id: "path",
    kind: "cost",
    title: "构建环境的 node 与登录 shell 的 node 不是同一个",
    initial: "开发机上 node 的版本，就是只读采集记录的那一个。",
    mechanism:
      "服务由 launchd 启动，进程 PATH 是系统默认值，不含 /usr/local/bin，首次构建报找不到 node。" +
      "该机器安装了四个 node（官网安装包、版本管理器、包管理器两个），采集记录的是登录 shell 中的版本。",
    fix:
      "在 CI 全局配置中写入完整 PATH（该项是替换而非追加），锁定官网安装包那一个。" +
      "它与服务器运行时同属一个大版本，产物形态的理由不变。",
    command: "构建日志中的找不到命令，加上逐个目录核对 node",
    commandNote: "只读基线中该行的含义因此收窄为登录 shell 中的取值。",
    grade: "measured",
  },
  {
    id: "mms",
    kind: "cost",
    title: "缓存未命中叠加测试并发，导致启动超时",
    initial: "内存数据库的二进制会被缓存，第二次构建可以直接复用。",
    mechanism:
      "缓存分项目级与用户级两处。预下载脚本在项目目录执行，二进制写入项目级缓存，" +
      "而流水线工作区是另一份目录，每次仍重新下载 481 M。补齐用户级缓存后仍然超时：" +
      "测试框架默认并发 2 个 worker，两个内存库同时启动，beforeAll 约 4.5 秒，接近默认 5 秒上限。属两个原因叠加。",
    fix: "二进制复制到用户级缓存；测试改为串行并把超时提高到 30 秒。本地实测 9 条用例通过，用时 10.5 秒。",
    command: "强制串行运行一次测试",
    commandNote: "串行运行把两个原因分开：并发条件下无法判断时间消耗在下载还是资源竞争。",
    grade: "measured",
  },
];

/**
 * 十四条计划外事件按成本落点分组，并把「流水线逻辑」作为第一组保留在同一把尺上。
 * 该组条数为 0：阶段划分、每阶段的入口动作与失败条件来自已冻结的契约，执行当天未修改过。
 *
 * 分组是对执行记录中那张十四行表的渲染分组，不新增事实：每一条都能在
 * day2-controller-setup.md §4 的十四行里找到对应。
 */
export const UNPLANNED_BUCKETS: Array<{ id: string; label: string; n: number; detail: string }> = [
  {
    id: "logic",
    label: "流水线逻辑",
    n: 0,
    detail: "阶段划分、每阶段的入口动作与失败条件来自已冻结的契约，执行当天未修改。",
  },
  {
    id: "tool",
    label: "工具行为与默认值",
    n: 6,
    detail: "包管理器前缀与服务机制、CI 服务注入变量、内存库接口在新版本中变更、轮询把失败记为无变化、版本控制拒绝带未提交改动切分支。",
  },
  {
    id: "env",
    label: "构建环境差异",
    n: 2,
    detail: "登录使用的密钥别名、后台服务的 PATH 与登录 shell 不同。",
  },
  {
    id: "res",
    label: "资源与缓存",
    n: 2,
    detail: "二进制从未真正下载成功、两个内存库并发抢占 CPU。",
  },
  {
    id: "net",
    label: "网络抖动",
    n: 1,
    detail: "取代码时 443 端口连接超时 75 秒，重试后通过。",
  },
  {
    id: "human",
    label: "人的操作",
    n: 2,
    detail: "命令粘贴到服务器终端执行、把合并输出的显示格式判断为漏合。",
  },
  {
    id: "plan",
    label: "计划内实验",
    n: 1,
    detail: "变红实验：修改一条断言使流水线报红，再还原。",
  },
];

/** 图上零长度的那一条。断言直接读它，避免图与数字各说各话。 */
export const LOGIC_BUCKET_ID = "logic";

export const UNPLANNED_TOTAL = UNPLANNED_BUCKETS.reduce((n, b) => n + b.n, 0);

export const UNPLANNED_LOGIC_COUNT =
  UNPLANNED_BUCKETS.find((b) => b.id === LOGIC_BUCKET_ID)?.n ?? 0;

/* ============================================ ③ 部署身份的权限收窄（D3 落地） */

/**
 * 一格的四种取值。第四种与「不适用」不是一回事：收窄之前部署密钥这条通道尚未建立，
 * 那一列的空白说明的是通道不存在，不是这类命令被允许或被拒绝。
 */
export type TrustVerdict = "allow" | "deny" | "n-a" | "absent";

export const TRUST_VERDICT: Record<TrustVerdict, { label: string; mark: string }> = {
  allow: { label: "允许", mark: "允许" },
  deny: { label: "拒绝", mark: "拒绝" },
  "n-a": { label: "不适用", mark: "不适用" },
  absent: { label: "通道尚未建立", mark: "无通道" },
};

/**
 * 收窄之后，这一类命令的判定由什么决定。
 * no-password 是本页的结论：那一格的拒绝不来自任何一条限制规则。
 */
export type TrustBasis = "regex" | "sudo-list" | "sudo-temp" | "no-password";

export const TRUST_BASIS: Record<TrustBasis, string> = {
  regex: "强制命令白名单：命令需整体匹配一条正则",
  "sudo-list": "提权白名单：命令与参数需精确匹配一条条目",
  "sudo-temp": "提权白名单中的一次性条目：用完即删除",
  "no-password": "账户无口令：提权请求要求口令，无法完成",
};

/** 两条通道。它们不对称：没有任何一类命令同时经过两层限制。 */
export const TRUST_CHANNELS = [
  { id: "deploy-key", name: "部署密钥", detail: "登录后执行的命令被强制替换，只接受白名单内的命令名与参数形态。" },
  { id: "personal-key", name: "个人密钥", detail: "登录后是普通会话，提权动作逐条比对提权白名单。" },
] as const;

export interface TrustRow {
  id: string;
  /** 命令类别，不写命令原文与参数（方法稿 §9）。 */
  name: string;
  beforeDeployKey: TrustVerdict;
  beforePersonalKey: TrustVerdict;
  afterDeployKey: TrustVerdict;
  afterPersonalKey: TrustVerdict;
  basis: TrustBasis;
  detail: string;
}

export const TRUST_ROWS: TrustRow[] = [
  {
    id: "deploy",
    name: "换版本并重启应用",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "allow",
    afterPersonalKey: "n-a",
    basis: "regex",
    detail: "参数须是 40 位十六进制提交号。收窄前由人工按发布步骤执行，无白名单约束。",
  },
  {
    id: "verify",
    name: "部署后验证（只读探活）",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "allow",
    afterPersonalKey: "n-a",
    basis: "regex",
    detail: "该命令是 D3 执行期新增的第四条：七项验证里有六项要在服务器上执行，原三条通道执行不了。",
  },
  {
    id: "rollback",
    name: "回滚到最近一次验证通过的版本",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "allow",
    afterPersonalKey: "n-a",
    basis: "regex",
    detail: "不接受外部传入的提交号，目标只从基线文件读取。",
  },
  {
    id: "mark",
    name: "更新回滚基线",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "allow",
    afterPersonalKey: "n-a",
    basis: "regex",
    detail: "验证全部通过后才调用，写入本次部署的提交号。它就是契约层自纠 B1′ 补出来的那条命令。",
  },
  {
    id: "asapp",
    name: "以应用身份执行版本控制与依赖安装",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "deny",
    afterPersonalKey: "allow",
    basis: "sudo-list",
    detail: "部署链路依赖的两条命令。部署通道不直接接受它们，由服务器上的脚本在自己的会话内调用。",
  },
  {
    id: "svc",
    name: "应用服务的重启与状态查询",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "deny",
    afterPersonalKey: "allow",
    basis: "sudo-list",
    detail: "只保留重启与查询状态，启动与停止不在条目内。",
  },
  {
    id: "diag",
    name: "排障只读：服务日志、反代配置测试与重载",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "deny",
    afterPersonalKey: "allow",
    basis: "sudo-list",
    detail:
      "配置测试只做语法检查不生效，重载只让已有配置生效而不修改文件，反代配置目录该账户不可写。" +
      "日志查询的参数锁定到应用服务本身。",
  },
  {
    id: "oneshot",
    name: "一次性配置落位：复制已准备好的反代配置",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "deny",
    afterPersonalKey: "allow",
    basis: "sudo-temp",
    detail:
      "为下线明文端口保留的通道。源文件位于任何用户可写的临时目录，因此它是一次性条目：" +
      "下线完成后连同源文件一起删除。",
  },
  {
    id: "rest",
    name: "其余任意提权命令（编辑器、属主与权限修改、口令修改、切换用户、启停应用服务）",
    beforeDeployKey: "absent",
    beforePersonalKey: "allow",
    afterDeployKey: "deny",
    afterPersonalKey: "deny",
    basis: "no-password",
    detail:
      "这一行的拒绝不来自白名单。用户组的全权规则仍在册，提权请求落到它上面时要求口令，" +
      "而该账户没有设置口令，请求因此无法完成。收窄尚未闭合。",
  },
];

/** 两层各自的条数。两个数不能互相替代：它们约束的是两条不同的通道。 */
export const TRUST_COUNTS = {
  sudoWhitelist: 8,
  forcedCommands: 4,
  beforeFiles: 2,
  beforeEntries: 4,
  beforeGroupRules: 1,
};

/** 收窄之后立即执行的五项验证。没有被拒过的白名单，区分不了限制生效与限制未配置。 */
export const TRUST_CHECKS: Array<{
  id: string;
  name: string;
  expect: string;
  actual: string;
  deviation?: string;
  grade: W11Grade;
}> = [
  {
    id: "syntax",
    name: "提权配置语法校验",
    expect: "全部文件通过校验",
    actual: "全部文件通过。改动期间保留一个已登录会话，避免写坏配置后无法提权。",
    grade: "measured",
  },
  {
    id: "forced",
    name: "强制命令层越权",
    expect: "清单外的命令不被执行，返回非零",
    actual: "两条清单外命令（一条任意命令、一条参数形态不合规的部署命令）均被拒绝并返回非零。",
    grade: "measured",
  },
  {
    id: "sudo",
    name: "提权层越权",
    expect: "清单外的提权命令被拒，输出为命令不在允许范围",
    actual: "命令被拒、退出码非零，但输出是要求口令。安全效果达成，语义来源与契约预期不同。",
    deviation: "该偏差与另外三条同族，见「冻结取值」一页。用户组规则移除后转为契约预期的语义。",
    grade: "measured",
  },
  {
    id: "inside",
    name: "白名单内仍可用",
    expect: "以应用身份查询仓库状态返回 0",
    actual: "返回 0，且未跟踪的静态产物目录仍在原处。",
    grade: "measured",
  },
  {
    id: "owner",
    name: "服务器上那个脚本的属主与权限",
    expect: "属主为 root，组与其他用户不可写",
    actual: "属主为 root，权限位符合预期。同日把两个检查脚本的属主一并从登录账户改为 root。",
    grade: "measured",
  },
];

/** 收窄尚未闭合的两项。它们是本板第一批「待做」，不写成脚注。 */
export const TRUST_PENDING: Array<{ id: string; name: string; detail: string; when: string; grade: W11Grade }> = [
  {
    id: "group",
    name: "把登录账户移出提权用户组",
    detail:
      "用户组的全权规则仍在册，该组唯一成员就是这个账户。当前由账户无口令挡住，" +
      "一旦为该账户设置口令，全权立即恢复。",
    when: "需要 root。绑定下次任何需要 root 的运维操作，在同一会话内完成。",
    grade: "pending",
  },
  {
    id: "otheruser",
    name: "注释另一个账户的全权条目",
    detail: "该账户当前没有 SSH 登录通道，可利用面为零，但条目仍然存在，服务可借用该身份提权。",
    when: "同上，与移出用户组同批处理。",
    grade: "pending",
  },
];

export const TRUST_COST =
  "收窄的对象是整个登录身份，不只是自动化那条通道。个人密钥登录后的手工排障命令同样要先进白名单，" +
  "否则第一次被拒时容易被当成配置错误去修。排障三条与一次性配置落位就是为此保留的。";

/* ======================================== ⑤ 部署后验证的覆盖范围（D3 落地） */

/** 交付路径的五层。磁盘检查不落在其中任何一层，那一行的空白是本页的第二条结论。 */
export const VERIFY_LAYERS = [
  { id: "proc", name: "进程存活" },
  { id: "socket", name: "端口监听" },
  { id: "http", name: "HTTP 路由" },
  { id: "db", name: "数据库可连" },
  { id: "edge", name: "对外反向代理" },
] as const;

export interface VerifyCheck {
  id: string;
  name: string;
  /** 在哪一侧执行。这一列是执行期新增第四条通道命令的原因。 */
  side: "server" | "controller";
  layers: string[];
  /** 这一项证明不了什么。该列是本页的重心。 */
  cannot: string;
  grade: W11Grade;
}

export const VERIFY_CHECKS: VerifyCheck[] = [
  {
    id: "health",
    name: "本地健康端点",
    side: "server",
    layers: ["proc", "socket", "http"],
    cannot: "该端点不查询数据库，只反映 HTTP 层能否响应。返回 200 不说明业务路径可用。",
    grade: "measured",
  },
  {
    id: "biz",
    name: "本地业务接口",
    side: "server",
    layers: ["proc", "socket", "http"],
    cannot: "该路由返回固定字符串，不经过数据库、鉴权与聚合路径。",
    grade: "measured",
  },
  {
    id: "db",
    name: "数据库连通探测",
    side: "server",
    layers: ["db"],
    cannot:
      "它使用本机默认连接，与应用配置里的连接串不是同一条。" +
      "应用自己能否连上数据库，七项里没有任何一项走过。",
    grade: "measured",
  },
  {
    id: "listen",
    name: "端口监听查询",
    side: "server",
    layers: ["proc", "socket"],
    cannot: "只说明监听存在且属于哪个进程，不说明请求会得到正确结果。",
    grade: "measured",
  },
  {
    id: "checkapp",
    name: "应用检查脚本",
    side: "server",
    layers: ["proc", "http"],
    cannot: "只探本地回环地址。对外反向代理返回错误时它仍然通过，这正是 W10 记录的盲区②。",
    grade: "measured",
  },
  {
    id: "checkdisk",
    name: "磁盘检查脚本",
    side: "server",
    layers: [],
    cannot:
      "不覆盖交付路径的任何一层。它是部署能否继续的资源前置条件：磁盘不足时依赖安装会中途失败。",
    grade: "measured",
  },
  {
    id: "public",
    name: "经公网反向代理的一次请求",
    side: "controller",
    layers: ["proc", "socket", "http", "edge"],
    cannot: "只覆盖根路径这一个公开面。管理面与其他公开面不在这一项之内。",
    grade: "measured",
  },
];

/** 部署当天定为必验、但执行记录里没有留下结果的一项。不按「必验」写成已验。 */
export const VERIFY_PENDING: Array<{ id: string; name: string; detail: string; grade: W11Grade }> = [
  {
    id: "untracked",
    name: "未跟踪静态产物保全与管理面可达",
    detail:
      "部署形态是原地重置工作副本，未跟踪的静态产物目录按机制不会被删除，" +
      "管理面依赖该目录。这一项与部署后磁盘余量复核都被定为必验，执行记录里没有留下结果。",
    grade: "pending",
  },
];

export const VERIFY_NOTES: Array<{ id: string; title: string; body: string }> = [
  {
    id: "coexist",
    title: "两条口径并存，后者不推翻前者",
    body:
      "常驻检查不使用公网探针，理由是不把常驻判断依赖在外部路径上（W10 结论）。" +
      "部署后验证使用一次公网请求，理由是它一次性、有人在场，且它是唯一覆盖对外反向代理那一层的一项。",
  },
  {
    id: "scope",
    title: "关闭盲区②的范围限于部署窗口",
    body:
      "公网请求只在部署后执行一次。部署窗口之外，对外反向代理那一层仍然没有常驻检查覆盖，" +
      "W10 给出的替代信号（反代错误日志的上游模式）尚未接入。",
  },
];

/* ================================ ⑥·3 冻结取值层：冻结时写下的取值与实测的偏差 */

/** 一条取值在写下的那一刻依据的是什么。最后一种是实测，冻结侧那一列的计数为 0。 */
export type FrozenBasis = "inference" | "literal" | "unchecked" | "measured";

export const FROZEN_BASIS: Record<FrozenBasis, string> = {
  inference: "推断",
  literal: "契约字面",
  unchecked: "未复核",
  measured: "命令输出与构建记录",
};

/** 冻结侧可能出现的依据类型，用于矩阵列序；实测侧一律是最后一种。 */
export const FROZEN_BASIS_ORDER: FrozenBasis[] = ["inference", "literal", "unchecked", "measured"];

export interface FrozenValue {
  id: string;
  tag: string;
  title: string;
  frozen: string;
  frozenBasis: FrozenBasis;
  measured: string;
  /** 实测之后改的是依据、取值，还是两者。 */
  changed: "basis" | "value" | "both";
  evidence: string;
  grade: W11Grade;
}

export const FROZEN_CHANGED: Record<FrozenValue["changed"], string> = {
  basis: "依据变了",
  value: "取值变了",
  both: "依据与取值都变了",
};

export const FROZEN_VALUES: FrozenValue[] = [
  {
    id: "getlog",
    tag: "P6",
    title: "取当次构建日志的接口",
    frozen: "选定的接口稳定，不依赖日志文件的落盘状态，因此用它取整段日志。",
    frozenBasis: "inference",
    measured:
      "无参形式返回的是一整段文本而不是行的列表，按行遍历实际是按字符遍历，" +
      "每次匹配都不成立。该阶段在修复前不可能报出敏感内容。",
    changed: "both",
    evidence:
      "注入一段假密钥头后该阶段仍然通过；改为按行返回的形式后，第 33 次构建判红，" +
      "移除注入后第 36 次构建恢复通过。修复后的形式只返回最近部分，当次日志约 190 行，未触及上限。",
    grade: "measured",
  },
  {
    id: "restart",
    tag: "P5",
    title: "重启到应用重新可用的时长",
    frozen: "预测 5 至 8 秒。分段估算：旧进程关闭、新进程建立数据库连接、首次响应。",
    frozenBasis: "inference",
    measured: "两次部署实测 0.515 秒与 0.516 秒，预测高估一个数量级。",
    changed: "value",
    evidence:
      "部署窗口内对本地健康端点高频轮询计时。成立条件是无活跃连接、模块已在页缓存、数据库在本机。" +
      "告警抑制窗口保持 5 分钟，但依据由重启时长换成依赖安装的 1 至 3 分钟。",
    grade: "measured",
  },
  {
    id: "denysemantics",
    tag: "V3",
    title: "越权提权命令被拒时的输出",
    frozen: "输出为命令不在允许范围。",
    frozenBasis: "literal",
    measured: "输出为要求口令：用户组的全权规则仍在册，拒绝由账户无口令产生，不由白名单产生。",
    changed: "both",
    evidence:
      "收窄完成后用新建的 SSH 连接执行一条清单外提权命令，退出码非零。" +
      "旧会话仍持有原用户组身份，因此越权验证必须用新连接。安全效果达成，收窄尚未闭合。",
    grade: "measured",
  },
  {
    id: "cleared",
    tag: "—",
    title: "清空一份旧提权配置之后，后续提权是否仍可用",
    frozen: "清空之后继续用提权命令完成剩余收窄步骤。",
    frozenBasis: "unchecked",
    measured:
      "清空即移除了免口令提权的最后一个来源，随后的提权命令全部落到要求口令的规则上并被拒。" +
      "当时先判断为文件异常消失，实际是被自己那条命令成功清空。",
    changed: "basis",
    evidence:
      "认证日志显示该次写入以 root 身份成功，随后的提权命令全部失败。" +
      "补充纪律：改完权限配置立即用免交互方式复核一次当前可执行清单，不等后续命令失败再回头判断。",
    grade: "measured",
  },
];

/* ================================ ⑧ 远程触发的信任边界（D3 附加项，8/26 落地） */

/**
 * 一格的三种取值。列写成「要求」而不是「维度」，「满足」才有确定方向：
 * 满足 = 这条通道满足该项要求，不满足 = 不满足，不适用 = 该项要求不覆盖这条通道。
 */
export type TriggerVerdict = "meets" | "fails" | "n-a";

export const TRIGGER_VERDICT: Record<TriggerVerdict, { label: string; mark: string }> = {
  meets: { label: "满足", mark: "满足" },
  fails: { label: "不满足", mark: "不满足" },
  "n-a": { label: "不适用", mark: "不适用" },
};

/**
 * 被否决时，决定性的依据属于哪一类。这一列是本页的结论：
 * 两条被否的通道，依据分属两类——一类是仓库属性，一类是会话的运行位置。
 * 契约冲突是 self-hosted runner 的第二条依据，不是决定性的那条：
 * 仓库转私有并关掉 fork 之后仓库属性那条消失，契约冲突仍在，但方案的取舍会重新打开。
 */
export type TriggerRejectBasis = "repo-visibility" | "runtime-location" | "contract-conflict" | "none";

export const TRIGGER_REJECT_BASIS: Record<TriggerRejectBasis, string> = {
  "repo-visibility": "仓库属性：仓库为 public 且允许 fork",
  "runtime-location": "运行位置：手机侧会话在临时云容器里",
  "contract-conflict": "契约冲突：推翻已冻结的只读条款",
  none: "未被否决：本通道即采纳方案",
};

/** 五项要求。第三项是本页的结论锚：触发权与内容决定权是不是同一件事。 */
export const TRIGGER_DIMENSIONS = [
  { id: "no-server-cred", name: "手机侧凭据", requirement: "手机不持服务器凭据" },
  { id: "no-inbound", name: "公网入站", requirement: "不需要开公网入站端口" },
  { id: "content-control", name: "内容决定权", requirement: "触发方不能决定发布内容" },
  { id: "contract", name: "已冻结契约", requirement: "不推翻已冻结的契约条款" },
  { id: "self-proof", name: "结果自证", requirement: "会话能自证发布成功" },
] as const;

export type TriggerDimensionId = (typeof TRIGGER_DIMENSIONS)[number]["id"];

/** 结论锚那一列的 id。断言直接读它，避免断言里写死列序。 */
export const TRIGGER_ANCHOR_DIMENSION: TriggerDimensionId = "content-control";

export interface TriggerChannel {
  id: string;
  name: string;
  /** 这条通道怎么走。只写通道形态，不写凭据形态（方法稿 §9 与安全边界）。 */
  path: string;
  verdicts: Record<TriggerDimensionId, TriggerVerdict>;
  /** 逐格的限定语。矩阵里只有三态标记，成立条件写在这里。 */
  notes: Record<TriggerDimensionId, string>;
  rejectBasis: TriggerRejectBasis;
  /** 否决依据的展开；采纳的那条写它为什么成立。 */
  basisDetail: string;
  grade: W11Grade;
}

export const TRIGGER_CHANNELS: TriggerChannel[] = [
  {
    id: "jenkins-poll",
    name: "Jenkins 轮询触发分支",
    path:
      "手机把触发信号推到 GitHub 上一条只放信号与回执的分支；开发机上已有的 Jenkins 出站轮询到它之后，" +
      "从 main 构建并发布，再把回执推回 GitHub。",
    verdicts: {
      "no-server-cred": "meets",
      "no-inbound": "meets",
      "content-control": "meets",
      contract: "meets",
      "self-proof": "meets",
    },
    notes: {
      "no-server-cred": "手机只向 GitHub 推一条信号，服务器凭据全部留在 Jenkins 侧。",
      "no-inbound": "Jenkins 主动向外轮询，开发机不开任何入站端口。",
      "content-control": "流水线定义存放在 Jenkins 里，不从触发分支读取；构建内容固定取 main。",
      contract: "已冻结的契约写明只有 Jenkins 持部署凭据，本通道正是按它走的。",
      "self-proof": "回执推回 GitHub，会话读 GitHub 即可确认，不需要连展板端口。",
    },
    rejectBasis: "none",
    basisDetail:
      "能写触发分支的人只能决定什么时候发，决定不了发什么，也无法让开发机执行任意脚本。" +
      "代价两条并接受：轮询延迟最多 5 分钟；开发机必须醒着，而这一条不会静默——回执超时会暴露它。",
    grade: "measured",
  },
  {
    id: "actions-runner",
    name: "GitHub Actions 加开发机 self-hosted runner",
    path: "开发机上常驻一个 runner 长轮询 GitHub 取任务，工作流定义存放在仓库里。",
    verdicts: {
      "no-server-cred": "meets",
      "no-inbound": "meets",
      "content-control": "fails",
      contract: "fails",
      "self-proof": "meets",
    },
    notes: {
      "no-server-cred": "手机经 GitHub 触发工作流，本身不持服务器凭据。",
      "no-inbound": "runner 长轮询 GitHub 取任务，同样是出站。",
      "content-control":
        "工作流定义在仓库里，而仓库为 public 且允许 fork。fork 出来的分支提交的工作流会在开发机上执行，" +
        "等于触发方能决定开发机执行什么，而开发机上存着能登录服务器的私钥。",
      contract: "已冻结的契约把 Actions 限定为只读，本通道要给它执行权。",
      "self-proof": "工作流的运行状态与日志可由会话从 GitHub 读到。",
    },
    rejectBasis: "repo-visibility",
    basisDetail:
      "仓库属性由 GitHub 接口实测：public 且允许 fork。这条依据可以变——仓库转私有并关掉 fork 之后它消失，" +
      "该方案重新成立，因此记入 backlog 而不是永久排除。契约冲突是它的第二条依据，不是决定性的那条。",
    grade: "measured",
  },
  {
    id: "tunnel",
    name: "隧道直连（常驻隧道或强制命令 SSH）",
    path: "开发机上装一条常驻隧道，手机侧会话直接登录开发机执行发布。",
    verdicts: {
      "no-server-cred": "fails",
      "no-inbound": "meets",
      "content-control": "fails",
      contract: "n-a",
      "self-proof": "meets",
    },
    notes: {
      "no-server-cred": "会话要持一把能登录开发机的私钥，而它跑在一个会被回收的临时容器里。",
      "no-inbound": "常驻隧道由开发机主动建立，不开公网入站端口；代价是开发机多一个常驻组件。",
      "content-control":
        "持有那把私钥即可在开发机上执行命令。改成强制命令形态能收窄到一份白名单，" +
        "但两种形态都要先把私钥放进临时容器。",
      contract:
        "不适用：已冻结的只读条款约束的是 Jenkins 与 Actions 两条既有通道，没有覆盖直连隧道这种形态。",
      "self-proof": "会话直接看到命令输出。",
    },
    rejectBasis: "runtime-location",
    basisDetail:
      "决定性依据是会话的运行位置：手机侧会话跑在临时云容器里，把能登录开发机的私钥放进一个会被回收的容器，" +
      "比放在手机上更糟。与发布契约冻结时对 webhook 的判断同源——隧道这一档的代价不由本次需求承担。",
    grade: "measured",
  },
];

/**
 * 方案选择依据的三条实测事实。它们不是通道的属性，是先于通道存在的约束，
 * 因此单列一组：矩阵里每一格的取值都要回到这三条上才能核。
 */
export const TRIGGER_FACTS: Array<{
  id: string;
  name: string;
  fact: string;
  how: string;
  effect: string;
  grade: W11Grade;
}> = [
  {
    id: "jenkins-running",
    name: "开发机上已有一条出站轮询链路",
    fact: "Jenkins controller 已在跑，轮询 main，并且是契约里唯一持部署凭据的一侧。",
    how: "发布契约的问答条目与仓库里的流水线定义。",
    effect: "远程通道不用新建，现成的出站链路可以复用。",
    grade: "measured",
  },
  {
    id: "repo-public",
    name: "仓库为 public 且允许 fork",
    fact: "仓库可见性为公开，fork 开关为允许。",
    how: "GitHub 接口查询仓库属性，实测返回。",
    effect: "否决 self-hosted runner：fork 分支提交的工作流会在开发机上执行。",
    grade: "measured",
  },
  {
    id: "phone-cannot-reach",
    name: "手机侧会话的容器连不到展板端口",
    fact: "容器内向展板端口发一次请求，12 秒超时，返回码为 000。",
    how: "在手机侧会话的容器里直接发请求并计时。",
    effect: "手机侧自证发布成功不能靠直接请求线上，回执必须经 GitHub 回来。",
    grade: "measured",
  },
];

/**
 * 本页新增的计数。与既有数字的交叉都在这里标时点，避免读者读成矛盾：
 *   sudoAfterShowcaseLand 是展板落盘命令进入白名单之后的条数，
 *   TRUST_COUNTS.sudoWhitelist 的 8 条是 D3 收窄当天的取值，两者不是同一时点。
 */
export const TRIGGER_COUNTS = {
  /** 变更单可证伪验证清单的条目数。它与 CRITERIA 的条数不是同一个口径。 */
  changeOrderChecks: 9,
  /** 变更单里待拍板的决策条数，8/26 全部落地。 */
  decisions: 6,
  /** 事实 3：手机侧容器发一次请求的超时秒数。 */
  phoneRequestTimeoutSeconds: 12,
  /** 展板落盘命令进入提权白名单之后的条数（时点：8/26 展板发布脚本化之后）。 */
  sudoAfterShowcaseLand: 9,
};

/* ================================ ⑨ 判据失效面（D3 附加项复盘，8/26 落地） */

/** 失效是在什么时候被识别出来的。三条失效里有一条与另两条不同。 */
export type CriterionExposure = "after-execution" | "at-design-time";

export const CRITERION_EXPOSURE: Record<CriterionExposure, string> = {
  "after-execution": "执行之后才暴露",
  "at-design-time": "设判据时当场识别",
};

/** 判定只有两种，且它由两列取值是否相同算出，不手写。 */
export type CriterionVerdict = "holds" | "degenerate";

export const CRITERION_VERDICT: Record<CriterionVerdict, { label: string; meaning: string }> = {
  holds: { label: "成立", meaning: "两种情况下观察到的取值不同，判据能把它们分开。" },
  degenerate: { label: "失效", meaning: "两种情况下观察到的取值相同，判据不承载信息。" },
};

export interface Criterion {
  id: string;
  /** 这条判据出自哪里。九条来自变更单的可证伪验证清单，两条是执行期补进来的。 */
  source: string;
  name: string;
  /** 机制正确时观察到什么。 */
  positiveObservation: string;
  /** 机制没运行时观察到什么。与上一格相同即为失效。 */
  nullObservation: string;
  /** 「机制没运行」在这一条上指哪一种情况。没有它，两列的对照读不出来。 */
  nullCase: string;
  /** 失效行才有：失效是在什么时候被识别出来的。 */
  exposedAt?: CriterionExposure;
  /** 失效行才有：两列为什么会取到同一个值。手写，与算出来的判定交叉校验。 */
  degenerateMechanism?: string;
  /** 失效行才有：判据后来改成了什么。 */
  fix?: string;
  evidence: string;
  grade: W11Grade;
}

export const CRITERIA: Criterion[] = [
  {
    id: "bootstrap",
    source: "变更单验证 1",
    name: "建触发分支的脚本不碰主工作区",
    positiveObservation: "列出 5 个文件、提交数 1，跑完主工作区状态干净",
    nullObservation: "没有文件清单输出，也没有产生提交",
    nullCase: "脚本根本没有运行",
    evidence:
      "8/26 开发机演练：列出 5 个文件、提交数 1，推送预演显示新分支；跑完主工作区状态干净，" +
      "被忽略的本地环境文件仍在位。",
    grade: "measured",
  },
  {
    id: "orphan-branch",
    source: "变更单验证 2",
    name: "触发分支落地后没有源码历史",
    positiveObservation: "分支存在，提交记录只有 1 条",
    nullObservation: "分支不存在",
    nullCase: "推送没有成功",
    evidence: "8/26 推送后核对：分支存在，提交记录 1 条，触发信号为全零种子。",
    grade: "measured",
  },
  {
    id: "seed",
    source: "变更单验证 3",
    name: "种子占位信号不会触发发布",
    positiveObservation: "构建结果为未构建，日志写明跳过原因是种子占位信号",
    nullObservation: "构建列表里没有这次构建",
    nullCase: "job 没有被触发",
    evidence:
      "8/26 手动构建：幂等判断、拉取 main、构建并发布三段全部跳过，日志打印跳过且不写回执的原因为种子，" +
      "结果为未构建，回执目录无新文件。",
    grade: "measured",
  },
  {
    id: "e2e",
    source: "变更单验证 4",
    name: "手机侧发出触发信号后能拿到成功回执",
    positiveObservation: "8 分钟内出现回执，状态为成功",
    nullObservation: "回执目录一直没有新文件",
    nullCase: "轮询没有取到这次改动",
    evidence:
      "8/26 16:27:39Z 写入信号，构建 10 于 16:31:22Z 起、16:34:54Z 结束，回执状态为成功。" +
      "首次尝试因干净克隆没有依赖目录而失败，在发布脚本前补上安装步骤后通过。",
    grade: "measured",
  },
  {
    id: "receipt",
    source: "变更单验证 5",
    name: "回执字段与当次发布一致",
    positiveObservation: "回执里的发布提交号与三项检查取值与当次发布一致",
    nullObservation: "没有回执可读",
    nullCase: "构建没有走到写回执那一步",
    evidence:
      "8/26 回执实测：发布提交号等于当时的 main，展板端口返回 200，静态产物三个文件一致，" +
      "门禁接口按预期返回 400，说明反向代理通。",
    grade: "measured",
  },
  {
    id: "no-self-trigger",
    source: "变更单验证 6 的原判据",
    name: "回执推回之后不再起新构建",
    positiveObservation: "10 分钟内没有新构建",
    nullObservation: "10 分钟内没有新构建",
    nullCase: "轮询整体没有在运行",
    exposedAt: "after-execution",
    degenerateMechanism:
      "轮询过滤用的那个扩展走的是需要工作区的已弃用路径，它不产出变更判定，" +
      "结果是永远判为无变化、永不构建。因此没有新构建这个观察，在过滤正确与轮询没运行两种情况下取值相同。",
    fix:
      "改为与能被正常触发成对验证：先证一次触发信号改动能在 5 分钟内起构建，再证一次回执推送不起新构建。" +
      "缺前一句时后一句不承载信息。",
    evidence:
      "8/26 15:00:05Z 推入触发信号，开发机 15:12 起持续唤醒，至 15:45 共 45 分钟、醒着 33 分钟，零构建零回执。" +
      "移除该过滤扩展后，16:19:50Z 的信号由构建 8 于 16:21:19Z 自动启动，延迟 1 分 29 秒，无人操作 Jenkins。",
    grade: "measured",
  },
  {
    id: "idempotent",
    source: "变更单验证 7",
    name: "main 未变且未加强制标记时不重复发布",
    positiveObservation: "回执状态为跳过，发布阶段没有执行",
    nullObservation: "没有回执可读",
    nullCase: "这次触发根本没有起构建",
    evidence:
      "8/26 构建 8：main 与上次成功发布的提交号相同，日志跳过原因为无变化，" +
      "回执状态为跳过、发布提交号为空、五项检查与证据均为空。",
    grade: "measured",
  },
  {
    id: "force",
    source: "变更单验证 8",
    name: "强制标记能绕过幂等判断",
    positiveObservation: "回执状态为成功，重新执行了一次发布",
    nullObservation: "回执状态为跳过",
    nullCase: "强制标记没有被读到，仍走幂等分支",
    evidence:
      "8/26 构建 12：触发时 main 与上次成功发布的提交号相同，正是无变化该命中的条件；" +
      "带强制标记后返回成功而不是跳过，这个前提写清了这一条才测得出东西。",
    grade: "measured",
  },
  {
    id: "surfaces",
    source: "变更单验证 9",
    name: "发布之后四个对外入口仍然可用",
    positiveObservation: "四个入口全部返回 200",
    nullObservation: "至少一个入口超时或返回非 200",
    nullCase: "这次发布把某个对外入口弄坏了",
    evidence: "8/26 本人浏览器实测 80、443、8080、8081 四个入口全部返回 200。",
    grade: "measured",
  },
  {
    id: "protection",
    source: "执行期补入：分支保护的验证判据",
    name: "main 上的分支保护对写权限凭据生效",
    positiveObservation: "推送预演的输出与远端一致，没有出现拒绝信息",
    nullObservation: "推送预演的输出与远端一致，没有出现拒绝信息",
    nullCase: "main 上根本没有配分支保护",
    exposedAt: "after-execution",
    degenerateMechanism:
      "推送预演只与远端协商、不发送数据，触发不到服务端的接收前检查。" +
      "本地与远端一致时，有没有保护都输出同一行。",
    fix: "改用一次真实推送（内容为空的提交）触发接收前检查。",
    evidence:
      "8/26 改真实推送后当场暴露：规则只勾了必须走 PR、没勾包含管理员，写权限凭据被按管理员级对待并放行，" +
      "输出为已绕过规则；勾上包含管理员后重验，推送被拒并返回受保护分支更新失败。",
    grade: "measured",
  },
  {
    id: "duplicate",
    source: "执行期补入：陷阱 1 重验的第一版判据",
    name: "回执推送只引出一次不发布的构建",
    positiveObservation: "回执目录没有新增文件",
    nullObservation: "回执目录没有新增文件",
    nullCase: "一次构建都没有起",
    exposedAt: "at-design-time",
    degenerateMechanism:
      "不发布的那条分支本来就不写回执。因此回执目录没有新增这个观察，" +
      "在起了一次不发布的构建与一次构建都没起两种情况下取值相同。",
    fix: "改为直接查构建列表：核对那次构建存在、结果为未构建、日志写明跳过原因是重复。",
    evidence:
      "8/26 回执推送之后，本人在构建列表核对构建 9 存在、结果为未构建、日志跳过原因为重复；" +
      "回执目录全窗口无新增只作旁证。这是三条失效里唯一一条在设判据时当场识别的。",
    grade: "measured",
  },
];

/* ================================ ④ 回滚：三条路径与两个指针（D4 演练，8/27 落地） */

/**
 * 演练里出现过的提交，数组顺序即时间顺序——它就是这一页那条轴的横坐标。
 *
 * 短 sha 是这一页唯一能承载结论的标识：两个状态文件里存的就是它，
 * 「回滚目标是哪一个提交」这句问话只能用它回答。
 */
export interface DrillCommit {
  sha: string;
  clock: string;
  role: string;
  /** 有没有在服务器上跑过。被测试拦下的那个提交这一格为否，它那一列因此空着。 */
  reachedServer: boolean;
}

export const DRILL_COMMITS: DrillCommit[] = [
  {
    sha: "6da765a",
    clock: "10:23",
    role: "上一轮部署开始时的运行版本，演练开始时 .rollback_target 指着它",
    reachedServer: true,
  },
  {
    sha: "59dc11d",
    clock: "10:39",
    role: "构建 57 部署并验证通过，演练的对照组",
    reachedServer: true,
  },
  {
    sha: "9d08659",
    clock: "11:04",
    role: "候选①：测试文件追加一条必然失败的用例，业务代码零改动",
    reachedServer: false,
  },
  {
    sha: "fd39799",
    clock: "11:15",
    role: "候选①的撤回提交，构建 59 部署并验证通过",
    reachedServer: true,
  },
  {
    sha: "eff8766",
    clock: "11:20",
    role: "候选②：启动路径顶层抛错，能过测试但起不来",
    reachedServer: true,
  },
  {
    sha: "0332de7",
    clock: "11:29",
    role: "候选②的撤回提交，构建 61 部署并验证通过",
    reachedServer: true,
  },
];

/** 轴上要标三样东西：线上跑的那个，与两个状态文件各自指的那个。 */
export type PointerKind = "head" | "previous" | "target";

export const POINTERS: Record<
  PointerKind,
  { file: string; label: string; meaning: string; writtenBy: string; readBy: string }
> = {
  head: {
    file: "线上 HEAD",
    label: "线上运行的提交",
    meaning: "服务器工作区当前检出的提交，不是文件而是仓库状态。",
    writtenBy: "每一次部署与每一次回滚都会改写它。",
    readBy: "回滚后的版本对照读它，与状态文件比对。",
  },
  previous: {
    file: ".previous_commit",
    label: "最近一次验证通过的提交",
    meaning: "人工回滚的目标。只有走完部署后验证的版本才写得进来。",
    writtenBy: "只有流水线的 mark-verified 写它，人工回滚成功后也不写（D4 拍板不扩写入方）。",
    readBy: "deploy-wrapper rollback 只读它，不接受外部传入的 sha。",
  },
  target: {
    file: ".rollback_target",
    label: "本轮部署开始时的运行版本",
    meaning: "部署中途失败时的即时恢复点，与「验证过」无关。",
    writtenBy: "每次部署与每次回滚开始时由部署脚本写入当时正在运行的提交。",
    readBy: "只有部署中途失败的那条自动路径读它。演练期间它一次都没有被读过。",
  },
};

/** 一个时点的结局。它决定这一行在轴上的读法，也决定这一行的着色。 */
export type DrillOutcome = "baseline" | "blocked" | "failed" | "rolled-back" | "verified";

export const DRILL_OUTCOME: Record<DrillOutcome, { label: string; detail: string }> = {
  baseline: { label: "对照组", detail: "演练开始前采下的基线，后面每一行都与它比对。" },
  blocked: { label: "被拦下", detail: "坏提交止步在 controller，没有到达服务器。" },
  failed: { label: "部署后验证报红", detail: "版本已经换过去，验证没通过。" },
  "rolled-back": { label: "人工回滚", detail: "回到状态文件指定的提交，并跑完整验证清单。" },
  verified: { label: "部署并验证通过", detail: "走完全部阶段，基线随之更新。" },
};

export interface DrillEvent {
  id: string;
  n: number;
  clock: string;
  name: string;
  /** 对应的构建号；没有构建号的时点（人工回滚）为 null。 */
  build: string | null;
  outcome: DrillOutcome;
  /**
   * 三个指针各自落在哪个提交上。null 表示演练记录里没有留下这一格的取值——
   * 空格就是空格，不拿推断填。缺格本身进待做清单。
   */
  positions: Record<PointerKind, string | null>;
  detail: string;
  evidence: string;
  grade: W11Grade;
}

export const DRILL_EVENTS: DrillEvent[] = [
  {
    id: "baseline",
    n: 1,
    clock: "10:45",
    name: "演练前基线",
    build: "构建 57 部署后",
    outcome: "baseline",
    positions: { head: "59dc11d", previous: "59dc11d", target: "6da765a" },
    detail:
      "两个状态文件此刻已经指着不同的提交：验证通过的是本轮部署上去的那个，" +
      "快照留的是上一轮跑着的那个。没有对照组的回滚证明不成立，所以它先采。",
    evidence:
      "前置核对读到单元形态为 Type=simple、Restart=on-failure、RestartSec=10 秒，进程起始时间 10:45:55；" +
      "磁盘可用 32.2 GiB、内存 available 1299 MB，够候选②多跑一轮依赖安装。",
    grade: "measured",
  },
  {
    id: "b58",
    n: 2,
    clock: "11:13",
    name: "候选①被 Test 阶段拦下",
    build: "构建 58",
    outcome: "blocked",
    positions: { head: "59dc11d", previous: "59dc11d", target: "6da765a" },
    detail:
      "三个取值与上一行逐格相同，这一行的信息全在「没有变」上：" +
      "坏提交进了主干、触发了构建，但部署段没有开始，服务器不知道发生过这件事。",
    evidence:
      "构建 58 为失败，测试输出 1 条失败 9 条通过共 10 条，部署、验证与日志扫描三段全部因前序失败被跳过；" +
      "服务器侧三个取值未变，部署日志当天没有新记录。推送到触发之间隔了 5 分钟：" +
      "中间一次轮询在 443 上连接失败 47.7 秒，结果被记成「无变更」——这正是 D2 记下的那条静默。",
    grade: "measured",
  },
  {
    id: "b59",
    n: 3,
    clock: "11:15",
    name: "撤回提交触发一次正常部署",
    build: "构建 59",
    outcome: "verified",
    positions: { head: "fd39799", previous: "fd39799", target: "59dc11d" },
    detail:
      "撤回不是回滚：它是一个新提交，走完与任何一次发布相同的五个阶段，" +
      "两个状态文件因此同时前移一格。线上回到的那份代码与基线等价，但它在仓库里是另一个对象。",
    evidence: "构建 59 成功，3 个套件 9 条用例通过，部署后验证通过并写入新的验证基线。",
    grade: "measured",
  },
  {
    id: "b60",
    n: 4,
    clock: "11:28",
    name: "候选②：部署段退 0，验证段报红",
    build: "构建 60",
    outcome: "failed",
    positions: { head: "eff8766", previous: "fd39799", target: null },
    detail:
      "线上已经换到起不来的版本，而验证通过的那个指针没有动——两者在这一行第一次分开。" +
      "重启命令返回 0，自动回滚的触发条件因此没有成立。",
    evidence:
      "构建 60 的测试段 9 条全过，部署段输出「completed successfully」退出码为 0，" +
      "验证段第一项健康检查等满 30 秒后报红；服务器进入崩溃重启循环（11:28:00 到 11:28:11 之间反复），" +
      "部署日志只有部署结束一条、没有回滚结束，快照文件没有被读过。",
    grade: "measured",
  },
  {
    id: "rollback",
    n: 5,
    clock: "11:29",
    name: "人工回滚并跑完整验证清单",
    build: null,
    outcome: "rolled-back",
    positions: { head: "fd39799", previous: "fd39799", target: "eff8766" },
    detail:
      "回滚把线上拉回验证通过的那个提交，同时把快照更新成刚刚被换下的那个——" +
      "两个文件在同一次动作里各写各的，职责区分在这一行第三次被看到。",
    evidence:
      "回滚命令退出码 0，输出回到 fd39799，重装依赖 116 个包用时 2 秒；" +
      "回滚后按表序跑完七项验证全绿，含公网 443 一次 200。",
    grade: "measured",
  },
  {
    id: "b61",
    n: 6,
    clock: "11:29",
    name: "撤回候选②，线上自动恢复",
    build: "构建 61",
    outcome: "verified",
    positions: { head: "0332de7", previous: "0332de7", target: null },
    detail:
      "演练结束时线上跑的既不是基线也不是回滚目标，而是第二个撤回提交：" +
      "它与基线的内容等价，sha 是新的。半年后读 log 的人要能看出这一点，靠的是提交标题里的演练前缀。",
    evidence: "构建 61 成功并写入新的验证基线，演练痕迹清零，未跟踪产物仍在原处。",
    grade: "measured",
  },
];

/** 契约冻结时写下的三条回滚路径。执行次数由演练填，不是路径自己声称的。 */
export interface RollbackPath {
  id: string;
  n: number;
  trigger: string;
  /** 回滚目标是哪一个文件。第三条没有目标，这一格为 null，画成断点。 */
  targetFile: PointerKind | null;
  action: string;
  verifyAfter: string;
  decidedBy: "自动" | "人工";
  /** D4 演练里这条路径被执行了几次。 */
  runs: number;
  evidence: string;
  grade: W11Grade;
}

export const ROLLBACK_PATHS: RollbackPath[] = [
  {
    id: "deploy-fail",
    n: 1,
    trigger: "部署过程中任一步非零：取码、切版本、装依赖或重启失败",
    targetFile: "target",
    action: "同一次连接里立刻切回快照版本、重装依赖并重启",
    verifyAfter: "一次健康检查快速确认",
    decidedBy: "自动",
    runs: 0,
    evidence:
      "候选②本该落在这一行，实际没有：单元是 Type=simple，重启命令只保证进程被拉起就返回 0，" +
      "崩溃由重启策略接管，于是部署段的退出码是 0，这条路径的触发条件没有成立。" +
      "演练结束时它仍是零次执行，快照文件一次也没有被消费过。",
    grade: "pending",
  },
  {
    id: "verify-fail",
    n: 2,
    trigger: "部署后验证清单任一项不通过",
    targetFile: "previous",
    action: "人工执行回滚命令，脚本读验证基线文件切版本、重装依赖并重启",
    verifyAfter: "完整七项验证清单",
    decidedBy: "人工",
    runs: 1,
    evidence:
      "候选②走的就是这一条：回滚命令退出码 0，回滚后线上版本与验证基线文件逐字相等，" +
      "七项验证全绿。这也是这条路径第一次被真的执行——D3 只装了它，没有跑过它。",
    grade: "measured",
  },
  {
    id: "rollback-fail",
    n: 3,
    trigger: "回滚动作本身失败：快照缺失、切版本失败或回滚过程中装依赖失败",
    targetFile: null,
    action: "人工紧急介入，登录服务器手工切到已知可用版本",
    verifyAfter: "人工逐项确认服务恢复",
    decidedBy: "人工",
    runs: 0,
    evidence: "演练里回滚一次通过，这条路径没有发生。它的命令序列至今仍是纸面。",
    grade: "pending",
  },
];

/** 演练当天线上一共恢复了三次，其中只有一次是回滚。这一行对照是本页的第二条结论。 */
export const RECOVERIES: Array<{ id: string; name: string; how: string; isRollback: boolean; landedOn: string }> = [
  { id: "b59", name: "候选①之后", how: "撤回提交触发的一次正常发布", isRollback: false, landedOn: "fd39799" },
  { id: "manual", name: "候选②之后", how: "人工回滚命令", isRollback: true, landedOn: "fd39799" },
  { id: "b61", name: "撤回候选②", how: "撤回提交触发的一次正常发布", isRollback: false, landedOn: "0332de7" },
];

export const ROLLBACK_NOTES: Array<{ id: string; title: string; body: string }> = [
  {
    id: "not-a-switch",
    title: "回滚不是切一个指针，是把旧版本重新部署一遍",
    body:
      "部署形态是原地更新，所以回滚要重新切版本、重装依赖、重启进程，" +
      "中间存在一个「旧代码 + 依赖已删」的窗口，那段时间健康检查必然不通。" +
      "这是预期现象，不是回滚失败——判据以回滚命令的退出码与随后的完整验证为准。" +
      "把它读成一次原子切换，就会在那个窗口里误判成回滚失败而叠加第二次操作。",
  },
  {
    id: "revert-sha",
    title: "撤回提交与回滚目标不是同一个对象",
    body:
      "仓库侧撤回坏提交用的是新增一个反向提交，内容与旧版本等价但 sha 是新的；" +
      "线上回滚是把工作区切回旧 sha。演练里这两个 sha 分别是 fd39799 与 0332de7 那一类新对象，" +
      "以及状态文件里存着的旧对象。记录里把两者写成一个，回滚目标就说不清了。",
  },
  {
    id: "single-writer",
    title: "人工回滚验证通过之后，不写回验证基线",
    body:
      "验证基线的语义是「最近一次由流水线完整验证通过的提交」。人工回滚后的验证是运维应急动作，" +
      "写回去等于给这个文件加第二个写入方，「只有验证通过的版本才进得来」这条不变量就没了。" +
      "回滚脚本只读不写正是为此设计，演练当天照此执行，回滚后的验证证据留在记录里而不是文件里。",
  },
  {
    id: "first-baseline",
    title: "首个基线是「当前唯一已知可用态」，不是「验证过的版本」",
    body:
      "验证基线文件初始化时填的是当时的线上版本，那个提交并没有走过部署后验证——" +
      "W10 收口态里还没有这一步。这个限定语一旦被抹掉，回滚看起来就是闭环的。" +
      "到 D4 为止它已经被三次真实的验证通过覆盖，演练里读到的取值就是其中之一。",
  },
];

/** ④ 的三项待做。它们是路径与取值两类欠账，不写成脚注。 */
export const ROLLBACK_PENDING: Array<{ id: string; name: string; detail: string; when: string; grade: W11Grade }> = [
  {
    id: "auto-path",
    name: "自动回滚路径至今零次执行",
    detail:
      "契约第一行那条路径要求部署过程中有一步返回非零。候选②做不到这一点：" +
      "启动即崩在这套单元形态下表现为「部署成功 + 验证报红」。快照文件因此从建起来到现在没有被读过一次。",
    when: "需要一次部署脚本内部真的失败：取码、切版本、装依赖或重启命令返回非零。",
    grade: "pending",
  },
  {
    id: "target-gap",
    name: "两处快照取值没有留痕",
    detail:
      "候选②部署开始时与最后一次撤回部署开始时，快照文件都被改写过，但当天只读了验证基线那一个。" +
      "按已经实测过两次的写入规则（部署开始时写入当时正在运行的提交）可以推出这两格的取值，" +
      "推断不进表：这一页的两个指针格全部只放实读到的值。",
    when: "下一次部署前后各读一次两个状态文件即可补齐，属只读操作。",
    grade: "pending",
  },
  {
    id: "third-path",
    name: "第三条路径的应急序列仍是纸面",
    detail:
      "回滚动作本身失败时的手工介入步骤在契约里写着，演练没有触到它——回滚一次就通过了。" +
      "在它被走过之前，这条路径与另外两条不能画成同样的强度。",
    when: "需要一次真实的回滚失败，或一次显式的演练注入；W11 剩余两日不安排。",
    grade: "pending",
  },
];

/* ================== ⑪ 假 active 的机制定论（W10 移交项，D4 8/27 闭合） */

/**
 * 这一页是 W10 D4（8/20）那次现场留下的问题：进程报活、端口没有监听、健康检查不通。
 * W10 收口时只读了代码，机制没验证，整条挂账移交本周。
 *
 * 编码：四项观察 × 三种情况的取值表，以现场那一列为基准列。
 * 判定由「与基准列逐格是否相同」算出，不手写——同 ⑨ 的纪律。
 * close 竞争那一批不进这张表：它的观察对象是每次循环的计数，不是同一组观察项，
 * 混进来会让两种证据看起来可比。它单独一张计数表，结论是否证。
 *
 * 这一块不在方法稿 §16 的编码表里（那张表定的是 ①③④⑤⑦ 五块）。
 * 材料来自 D4 主线 B，编码在本文件声明。
 */
export type ObsValue = "yes" | "no" | "n-a" | "unlogged";

export const OBS_VALUE: Record<ObsValue, { label: string; meaning: string }> = {
  yes: { label: "是", meaning: "该情况下观察到这一项。" },
  no: { label: "否", meaning: "该情况下没有观察到这一项。" },
  "n-a": { label: "不适用", meaning: "该情况下这一项不存在，不能与其他列比较。" },
  unlogged: { label: "未记录", meaning: "本次没有采集这一格，不参与逐格比对。" },
};

export const FALSE_ACTIVE_CASES = [
  {
    id: "field",
    name: "W10 现场",
    sub: "8/20，生产端口",
    detail: "服务被判为运行中，端口没有监听，健康检查不通，日志里有一行「服务运行端口」。",
  },
  {
    id: "inject-before",
    name: "注入复现 · 修复前",
    sub: "8/27，占用端口后启动",
    detail: "先占住一个本地端口，再让完整的应用启动到同一个地址上，观察它的三项表现。",
  },
  {
    id: "inject-after",
    name: "注入复现 · 修复后",
    sub: "8/27，同一注入",
    detail: "加上监听失败处理之后，用同一条注入再跑一次。",
  },
] as const;

export type FalseActiveCaseId = (typeof FALSE_ACTIVE_CASES)[number]["id"];

/** 基准列：其余各列与它逐格比对，相同即同形。 */
export const FALSE_ACTIVE_ANCHOR: FalseActiveCaseId = "field";

export interface Observation {
  id: string;
  n: number;
  name: string;
  detail: string;
  values: Record<FalseActiveCaseId, ObsValue>;
}

export const OBSERVATIONS: Observation[] = [
  {
    id: "callback",
    n: 1,
    name: "监听成功的回调触发（日志里出现「服务运行端口」）",
    detail: "这一项是整件事的入口：日志说服务起来了，人就不会再去查端口。",
    values: { field: "yes", "inject-before": "yes", "inject-after": "unlogged" },
  },
  {
    id: "listening",
    n: 2,
    name: "端口真的处于监听状态",
    detail: "底层绑定是否成功。它与上一项分开，正是这一页的全部内容。",
    values: { field: "no", "inject-before": "no", "inject-after": "no" },
  },
  {
    id: "alive",
    n: 3,
    name: "进程静默存活（被判为运行中，没有错误输出）",
    detail: "静默存活让常驻检查的进程判活那一层判为正常，故障因此没有告警。",
    values: { field: "yes", "inject-before": "yes", "inject-after": "no" },
  },
  {
    id: "explicit",
    n: 4,
    name: "失败被显式化（错误日志 + 非零退出码）",
    detail: "显式化之后，重启策略才接得住这类失败，它才会变成一次可见的崩溃循环。",
    values: { field: "no", "inject-before": "no", "inject-after": "yes" },
  },
];

/** 最小样本那一批：三种关闭时机 × 两侧 × 100 次。它的结论是否证，不是复现。 */
export const RACE_RUNS_PER_MODE = 100;

export const RACE_SIDES = [
  { id: "dev", name: "开发机", node: "v24.16.0", port: "3001" },
  { id: "server", name: "服务器", node: "v24.19.0", port: "13000" },
] as const;

export interface RaceMode {
  id: string;
  name: string;
  what: string;
  /** 监听成功回调触发的次数。 */
  callbacks: number;
  /** 探针看到端口处于监听的次数；回调没触发时这一项不适用，为 null。 */
  listening: number | null;
  /** 「回调触发但没有绑定」的次数。三种时机全为 0 就是否证。 */
  falseActive: number;
  mechanism: string;
}

export const RACE_MODES: RaceMode[] = [
  {
    id: "in-callback",
    name: "回调内关闭",
    what: "在监听成功的回调里立刻关闭",
    callbacks: 100,
    listening: 100,
    falseActive: 0,
    mechanism: "关闭动作总在回调之后发生，回调执行的那一刻端口必然已经绑定。",
  },
  {
    id: "after-listen",
    name: "发起后立即关闭",
    what: "调用监听之后不等回调就安排关闭，与回调竞速",
    callbacks: 100,
    listening: 100,
    falseActive: 0,
    mechanism: "监听成功的回调走的是更早的一档任务队列，恒先于安排在后一档的关闭动作。",
  },
  {
    id: "sync",
    name: "同步关闭",
    what: "调用监听之后同一轮同步关闭",
    callbacks: 0,
    listening: null,
    falseActive: 0,
    mechanism: "同步关闭直接取消了尚未完成的监听，回调一次也不会触发，与现场的日志形态相反。",
  },
];

/** 结论分级。三档各自的内容不同，混写会把推断读成事实。 */
export const FALSE_ACTIVE_GRADED: Array<{ id: string; level: string; body: string }> = [
  {
    id: "fact",
    level: "事实",
    body:
      "注入对照的两组输出：修复前进程存活、端口没有监听、日志里有那一行成功；" +
      "修复后进程以非零码退出并留下监听失败的错误日志。以及三种关闭时机在两侧各 100 次的计数。",
  },
  {
    id: "inference",
    level: "推断",
    body:
      "这套机制就是 W10 现场那次的解释——依据是修复前那一列与现场那一列逐格相同，" +
      "不是因为在现场重跑过。现场那台机器上没有再注入过。",
  },
  {
    id: "unverified",
    level: "未验证",
    body:
      "生产端口上的同类注入没有做，也不打算做：那是唯一一台生产机。" +
      "因此「生产上也会这样」是按同形推断的，不是实测。",
  },
];

export const FALSE_ACTIVE_FIX = {
  what: "给监听对象加一个错误处理：地址被占用、权限不足、地址不可用三类直接以非零码退出，其余记一条告警后保活。",
  why: "退出之后重启策略才接得住，失败从静默变成可见的崩溃循环——候选②那次已经证明这种形态会被验证段拦下。",
  evidence: "注入验证退出码为 1 并留下错误日志；三个套件 9 条用例全过；修复已随一次正常发布上线。",
  sideFinding:
    "注入过程本身留下一条经验：绑在通配地址上的占用挡不住绑到具体本机地址的监听，注入必须占同一个地址才成立。",
  handover: "排障手册里那条「机制未验证」的记录随之翻档为已定论，展板的排障页当天同步。",
  grade: "measured" as W11Grade,
};

export const FALSE_ACTIVE_PENDING: Array<{ id: string; name: string; detail: string; when: string; grade: W11Grade }> = [
  {
    id: "after-callback",
    name: "修复后那一格没有采集成功日志是否仍然打印",
    detail:
      "修复后只记了退出码与错误日志两项，成功回调那一行因此是未记录。" +
      "它不影响结论——决定性的是端口与退出码那两行——但逐格比对少一格。",
    when: "下次注入时多看一眼日志顺序即可补齐，属只读观察。",
    grade: "pending",
  },
];

/* ================================================================ 板块建构进度 */

export const W11_STAGE_PLAN: Array<{ id: string; title: string; question: string; done: boolean; when: string }> = [
  { id: "selfcheck-contract", title: "⑥·1 契约层的六条自纠", question: "流水线搭建前，依据什么发现问题", done: true, when: "D1 冻结当天已完成" },
  { id: "selfcheck-runtime", title: "⑥·2 机制层的五条自纠", question: "流水线运行后，依据什么发现问题", done: true, when: "D2 执行期已完成" },
  { id: "frozen-values", title: "⑥·3 冻结取值与实测的偏差", question: "冻结时写下的取值还剩几条成立", done: true, when: "D3 执行期已完成" },
  { id: "stages", title: "② 五阶段各自的失败面", question: "哪个阶段失败会影响服务器", done: true, when: "D3 收口后部署段翻档" },
  { id: "trust", title: "③ 部署身份的权限收窄", question: "收窄后被拒的依据是什么", done: true, when: "D3 越权验证已有输出" },
  { id: "verify", title: "⑤ 部署后验证的覆盖范围", question: "哪一项不覆盖任何交付层", done: true, when: "D3 首次自动部署后" },
  { id: "rollback", title: "④ 回滚的三条路径与两个基线文件", question: "回滚目标是哪一个提交", done: true, when: "D4 回滚演练当天已完成" },
  { id: "lanes", title: "① 三条自动化与服务器写入权限", question: "哪条流水线的结果决定部署", done: false, when: "D5（触发链路终点仍在变）" },
  { id: "handoff", title: "⑦ 与手工部署的逐步对照", question: "哪几步仍由人执行", done: false, when: "D5 对照说明成篇后" },
  { id: "remote-trigger", title: "⑧ 远程触发的信任边界", question: "凭什么手机只能决定什么时候发", done: true, when: "D3 附加项端到端跑通后" },
  { id: "criteria", title: "⑨ 判据失效面", question: "哪几条判据在机制没运行时也取同一个值", done: true, when: "D3 附加项复盘后" },
  { id: "false-active", title: "⑪ 假 active 的机制定论", question: "回调触发了，端口为什么没有监听", done: true, when: "D4 最小样本与注入复现后" },
];

/* ==================================================================== 计算值 */

/** 板头计数。从数据算出来，不手写——它是 D3–D5 的翻档进度条。 */
export function gradeCounts(): Record<W11Grade, number> {
  const counts: Record<W11Grade, number> = { measured: 0, contract: 0, pending: 0 };
  const graded: Array<{ grade: W11Grade }> = [
    ...STAGES,
    ...STAGE_CAVEATS,
    { grade: ZERO_CHANGE.grade },
    ...SELF_CHECKS_CONTRACT,
    ...SELF_CHECKS_RUNTIME,
    ...TRUST_CHECKS,
    ...TRUST_PENDING,
    ...VERIFY_CHECKS,
    ...VERIFY_PENDING,
    ...FROZEN_VALUES,
    ...TRIGGER_FACTS,
    ...TRIGGER_CHANNELS,
    ...CRITERIA,
    ...DRILL_EVENTS,
    // ROLLBACK_PATHS 不进这个计数：两条零次执行的路径与 ROLLBACK_PENDING 的头尾两条
    // 是同一笔欠账的两种呈现（表里的一格与清单里的一条）。两处都数，板头的待做会把
    // 同一笔账计两次，而「板头计数 = 页内待做节点数」这条不变量正是为了防这个。
    ...ROLLBACK_PENDING,
    { grade: FALSE_ACTIVE_FIX.grade },
    ...FALSE_ACTIVE_PENDING,
  ];
  for (const item of graded) counts[item.grade] += 1;
  return counts;
}

/** ⑥·1 的标题那句话：六条里有几条是机器抓到的。答案是 0，而且它是算出来的。 */
export function machineCaughtCount(): number {
  return SELF_CHECKS_CONTRACT.filter((c) => MACHINE_CATCHERS.includes(c.caughtBy)).length;
}

/** ② 的一眼结论：五个阶段里有几格能把服务器弄坏。 */
export function riskStageCount(): number {
  return STAGES.filter((s) => s.serverState === "risk").length;
}

/** ⑥·2 的判据级条目数（与「代价最高」那两条分开数）。 */
export function criterionCount(): number {
  return SELF_CHECKS_RUNTIME.filter((c) => c.kind === "criterion").length;
}

/** ⑤ 的列合计：每一层有几项验证覆盖。合计为 1 的那几层就是这一页的结论。 */
export function layerCoverage(): Array<{ id: string; name: string; n: number }> {
  return VERIFY_LAYERS.map((layer) => ({
    id: layer.id,
    name: layer.name,
    n: VERIFY_CHECKS.filter((c) => c.layers.includes(layer.id)).length,
  }));
}

/** 只有一项验证覆盖的层。删掉那一项，该层就没有任何验证。 */
export function singleCoverageLayers(): string[] {
  return layerCoverage().filter((l) => l.n === 1).map((l) => l.name);
}

/** 不落在交付路径任何一层的验证项。整行空白是 ⑤ 的第二条结论。 */
export function uncoveredChecks(): VerifyCheck[] {
  return VERIFY_CHECKS.filter((c) => c.layers.length === 0);
}

/** ⑤ 的执行侧计数。它是执行期把通道白名单从三条加到四条的原因。 */
export function verifySideCounts(): { server: number; controller: number } {
  return {
    server: VERIFY_CHECKS.filter((c) => c.side === "server").length,
    controller: VERIFY_CHECKS.filter((c) => c.side === "controller").length,
  };
}

/** ⑥·3 的标题那句话：冻结那一刻，有几条取值的依据是实测。答案是 0，且它是算出来的。 */
export function frozenMeasuredAtFreeze(): number {
  return FROZEN_VALUES.filter((v) => v.frozenBasis === "measured").length;
}

/** ⑥·3 冻结侧按依据类型的分布，用于列脚合计。 */
export function frozenBasisCounts(): Record<FrozenBasis, number> {
  const counts: Record<FrozenBasis, number> = { inference: 0, literal: 0, unchecked: 0, measured: 0 };
  for (const v of FROZEN_VALUES) counts[v.frozenBasis] += 1;
  return counts;
}

/** ③ 的结论格：收窄之后，有几类命令的拒绝不来自任何一条限制规则。 */
export function noPasswordRows(): TrustRow[] {
  return TRUST_ROWS.filter((r) => r.basis === "no-password");
}

/** ⑧ 每条通道满足的要求项数。三条通道共用一把尺，因此它可以直接比较。 */
export function triggerMeetCount(channel: TriggerChannel): number {
  return TRIGGER_DIMENSIONS.filter((d) => channel.verdicts[d.id] === "meets").length;
}

/** ⑧ 被否决的通道。采纳与否由否决依据算出，不另设一个可能与它对不上的布尔字段。 */
export function rejectedChannels(): TriggerChannel[] {
  return TRIGGER_CHANNELS.filter((c) => c.rejectBasis !== "none");
}

export function adoptedChannels(): TriggerChannel[] {
  return TRIGGER_CHANNELS.filter((c) => c.rejectBasis === "none");
}

/** ⑧ 满足全部五项要求的通道。它应当与采纳的那条重合，对不上就是取值填错了。 */
export function channelsMeetingAll(): TriggerChannel[] {
  return TRIGGER_CHANNELS.filter((c) => triggerMeetCount(c) === TRIGGER_DIMENSIONS.length);
}

/** ⑧ 的结论：被否两条的依据是不是同一类。同源就说明这一页的分类塌了。 */
export function rejectBasisKinds(): TriggerRejectBasis[] {
  return [...new Set(rejectedChannels().map((c) => c.rejectBasis))];
}

/**
 * ⑨ 的判定：两个观察字段相等即为失效。它由代码算出，不手写——
 * 手写的判定与两列取值漂移之后，读者会读到一张自相矛盾的表。
 */
export function criterionVerdict(c: Criterion): CriterionVerdict {
  return c.positiveObservation === c.nullObservation ? "degenerate" : "holds";
}

/** ⑨ 的结论行：两列取值相同的那几条。 */
export function degenerateCriteria(): Criterion[] {
  return CRITERIA.filter((c) => criterionVerdict(c) === "degenerate");
}

/** ⑨ 失效行按识别时点的分布。三条不全相同，第三条是设判据时当场识别的。 */
export function criterionExposureCounts(): Record<CriterionExposure, number> {
  const counts: Record<CriterionExposure, number> = { "after-execution": 0, "at-design-time": 0 };
  for (const c of degenerateCriteria()) {
    if (c.exposedAt) counts[c.exposedAt] += 1;
  }
  return counts;
}

/**
 * ④ 的判定：一个时点上两个指针有没有落在同一个提交上。
 * 有一格没留痕就不判（返回 null）——拿推断填格会让这一页的结论变成推出来的。
 */
export function pointersCoincide(e: DrillEvent): boolean | null {
  const previous = e.positions.previous;
  const target = e.positions.target;
  if (!previous || !target) return null;
  return previous === target;
}

/** ④ 两个指针取值都留痕的时点。它是下面那个「重合几次」的分母。 */
export function loggedEvents(): DrillEvent[] {
  return DRILL_EVENTS.filter((e) => pointersCoincide(e) !== null);
}

/** ④ 的结论行：两个指针指向同一个提交的时点。 */
export function coincidingEvents(): DrillEvent[] {
  return DRILL_EVENTS.filter((e) => pointersCoincide(e) === true);
}

/** ④ 缺格的时点。缺几格与待做清单里那一条必须对得上。 */
export function unloggedEvents(): DrillEvent[] {
  return DRILL_EVENTS.filter((e) => pointersCoincide(e) === null);
}

/** ④ 的第二条结论：被测试拦下的提交，一格指针也没有落在它那一列。 */
export function commitsNeverOnServer(): DrillCommit[] {
  return DRILL_COMMITS.filter((c) => !c.reachedServer);
}

/** ④ 某个提交在某个时点上被哪几个指针指着。空数组即空格。 */
export function pointersAt(e: DrillEvent, sha: string): PointerKind[] {
  return (Object.keys(e.positions) as PointerKind[]).filter((k) => e.positions[k] === sha);
}

/** ④ 演练里真的被执行过的路径。三条里几条，是这一页的标题。 */
export function pathsRun(): RollbackPath[] {
  return ROLLBACK_PATHS.filter((p) => p.runs > 0);
}

/** ④ 三次线上恢复里，靠回滚完成的有几次。 */
export function rollbackRecoveries(): number {
  return RECOVERIES.filter((r) => r.isRollback).length;
}

/**
 * ⑪ 的判定：某一列与现场那一列逐格是否相同。
 * 未记录的格子不参与比对，两侧任一为未记录时跳过该行。
 */
export function matchesField(caseId: FalseActiveCaseId): { same: number; compared: number } {
  let same = 0;
  let compared = 0;
  for (const obs of OBSERVATIONS) {
    const anchor = obs.values[FALSE_ACTIVE_ANCHOR];
    const value = obs.values[caseId];
    if (anchor === "unlogged" || value === "unlogged") continue;
    compared += 1;
    if (anchor === value) same += 1;
  }
  return { same, compared };
}

/** ⑪ 与现场逐格相同的那一列。它就是「复现」这个结论的依据。 */
export function sameShapeCases(): FalseActiveCaseId[] {
  return FALSE_ACTIVE_CASES.filter((c) => c.id !== FALSE_ACTIVE_ANCHOR)
    .filter((c) => {
      const { same, compared } = matchesField(c.id);
      return compared > 0 && same === compared;
    })
    .map((c) => c.id);
}

/** ⑪ 最小样本那一批的合计：三种时机 × 两侧各 100 次里，「回调触发但没绑定」出现几次。 */
export function falseActiveInSamples(): number {
  return RACE_MODES.reduce((n, m) => n + m.falseActive, 0) * RACE_SIDES.length;
}

/** ⑪ 最小样本一共跑了多少次。三种时机 × 每种 100 次 × 两侧。 */
export function raceRunTotal(): number {
  return RACE_MODES.length * RACE_RUNS_PER_MODE * RACE_SIDES.length;
}
