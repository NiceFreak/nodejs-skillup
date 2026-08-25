// W11 发布流水线的 canonical 事实（展示资产，纯前端静态数据）。
//
// 与 w9Facts / w10Facts 分开的理由不变：每块板遍历自己的全量数据，
// 混在一起会让别的板凭空多出它没有叙述的条目。
//
// 数字来源：week11-ci/notes/ 下的
//   day1-release-contract.md   §4 Q1–Q18 / §5.1 发布契约表 / §5.5 部署后验证清单 / §5.6 只读基线
//   day1-contract-freeze.md    §3 预测与偏差
//   day2-controller-setup.md   §0 开工前 review 十处 / §3 P1–P6 / §4 九步执行记录与十四条计划外事件
//   ../Jenkinsfile             D2 落地的三阶段流水线
//   d2-server-baseline/        装 Jenkins 前后各 192 行、七项只读基线
// 方法稿见 week11-ci/notes/week11-visualization-plan.md。
//
// 唯一真源纪律：下面这些数字（5 个阶段 / 7 项零改动核对 / 14 条计划外事件 /
// 514 包 24 秒 / 3 suites 9 tests 12.9 秒 / 8 GiB 与 512 MiB / 301 MB / 481 M /
// 30 秒超时 / 6a1b1a1）只在本文件出现一次，组件里不得再写字面量。

/**
 * 证据档位。沿用 W10 的三档，一个字不改——本周同样存在大量「已拍板、要等 D3/D4
 * 才被检验」的条目，而且比例比 W10 更极端：D2 收口时部署段整段还是纸面。
 *
 * 本周专属的一条分档纪律（两者在 D3 之前长得很像，但复盘时要走的路不同）：
 *   contract 错了是**决策要改**（例：8080 本周下线、两层收窄的白名单内容）；
 *   pending  只是**还没量**（例：bcrypt 在服务器侧走预编译还是走编译、
 *            check-app / check-disk 的脚本路径仍是占位、restart 的实际不可用时长）。
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
    grade: "contract",
    caveat: "D2 边界是不配置指向服务器的凭据，因此 wrapper、部署密钥与越权验证在 8/25 均未创建。bcrypt 在服务器侧使用预编译二进制还是本地编译，也未实测。",
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
    grade: "contract",
    caveat: "七项验证的实测结果需等待第一次自动部署。清单中 check-app 与 check-disk 的脚本路径仍是占位，待 D3 用 systemctl cat 核实。",
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

/* ================================================================ 板块建构进度 */

export const W11_STAGE_PLAN: Array<{ id: string; title: string; question: string; done: boolean; when: string }> = [
  { id: "selfcheck-contract", title: "⑥·1 契约层的六条自纠", question: "流水线搭建前，依据什么发现问题", done: true, when: "D1 冻结当天已完成" },
  { id: "selfcheck-runtime", title: "⑥·2 机制层的五条自纠", question: "流水线运行后，依据什么发现问题", done: true, when: "D2 执行期已完成" },
  { id: "stages", title: "② 五阶段各自的失败面", question: "哪个阶段失败会影响服务器", done: true, when: "D2 收口后前三阶段翻档" },
  { id: "trust", title: "③ 部署身份的权限收窄", question: "权限收窄后影响哪些操作", done: false, when: "D3 越权验证有输出后" },
  { id: "verify", title: "⑤ 部署后验证的覆盖范围", question: "哪一层只有一项验证覆盖", done: false, when: "D3 首次自动部署后" },
  { id: "rollback", title: "④ 回滚的三条路径与两个基线文件", question: "回滚目标是哪一个提交", done: false, when: "D4 回滚演练后" },
  { id: "lanes", title: "① 三条自动化与服务器写入权限", question: "哪条流水线的结果决定部署", done: false, when: "D5（触发链路终点仍在变）" },
  { id: "handoff", title: "⑦ 与手工部署的逐步对照", question: "哪几步仍由人执行", done: false, when: "D5 对照说明成篇后" },
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
