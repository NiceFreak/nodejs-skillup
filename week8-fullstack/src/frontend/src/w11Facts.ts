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
  cross: "跨过中线：一次 SSH",
  server: "服务器",
};

/** 阶段失败时服务器处于什么状态。三种，不是两种。 */
export type ServerState = "untouched" | "risk" | "deployed";

export const SERVER_STATE: Record<ServerState, { label: string; detail: string }> = {
  untouched: { label: "未被碰过", detail: "本阶段全部动作发生在 controller，服务器保持上一轮部署的版本。" },
  risk: { label: "可能处于中间态", detail: "代码可能已经换、依赖可能只装了一半、进程可能没起来。" },
  deployed: { label: "已换版本并重启", detail: "部署已经发生，应用运行在新版本上。" },
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
    entry: "按 job 配置的分支取到这次提交",
    fail: "git 非零：网络不可达、分支不存在、凭据无效",
    serverState: "untouched",
    after: "流水线标记失败，人工介入",
    grade: "measured",
    evidence: "8/25 构建 #7 由 Poll SCM 自动触发并取到提交；另有一次 443 超时 75 秒的失败样本",
  },
  {
    id: "install",
    n: 2,
    name: "Install",
    side: "controller",
    entry: "按 lockfile 装全量依赖（含 devDependencies）",
    fail: "npm ci 非零：lockfile 与 package.json 不一致、网络不通、原生依赖装不上",
    serverState: "untouched",
    after: "流水线标记失败，人工核 lockfile；工作区由 deleteDir 兜底",
    grade: "measured",
    evidence: "8/25 实测装入 514 个包，用时 24 秒",
  },
  {
    id: "test",
    n: 3,
    name: "Test",
    side: "controller",
    entry: "跑三份测试（两份集成走 MongoMemoryServer）",
    fail: "任一用例失败，或测试环境拉不起来",
    serverState: "untouched",
    after: "流水线标记失败并打印失败用例，人工改代码；无需回滚",
    grade: "measured",
    evidence: "8/25 实测 3 个套件 9 条用例全过，用时 12.9 秒；变红实验改坏一条断言后为 1 失败 8 通过",
  },
  {
    id: "deploy",
    n: 4,
    name: "Deploy",
    side: "cross",
    entry: "经部署密钥调用服务器上的 deploy-wrapper，带本次提交号",
    fail: "SSH 失败，或 wrapper 内部任一步非零",
    serverState: "risk",
    after: "同一会话内自动回滚到本轮起点，回滚后仍标记失败",
    grade: "contract",
    caveat: "D2 硬边界是不配置任何指向服务器的凭据，因此 wrapper、部署密钥与越权验证在 8/25 都还不存在；bcrypt 在服务器侧走预编译还是走编译也未实测。",
  },
  {
    id: "verify",
    n: 5,
    name: "Verify",
    side: "server",
    entry: "按部署后验证清单逐项探活（本地 / 数据库 / 公网 / 监听 / 两项检查）",
    fail: "任一验证项不通过",
    serverState: "deployed",
    after: "不自动回滚：标记失败，由人判定是否回滚",
    grade: "contract",
    caveat: "七项验证的实测结果要等第一次自动部署；清单里 check-app 与 check-disk 的脚本路径目前仍是占位，待 D3 用 systemctl cat 核实。",
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
    title: "Test 阶段测的库，和生产不是同一个",
    body:
      "Jenkins 侧用 MongoMemoryServer 拉起的是 mongod 8.2.6，GitHub Actions 用的是 mongo:7 容器，" +
      "生产上的版本尚未核对——三个来源全不同。所以这一阶段的绿证明的是隔离环境里的行为；" +
      "兜底放在部署后验证（真实 mongod + 只读探活），而报表聚合、权限校验这类低频路径，探活也探不到。",
    grade: "measured",
  },
  {
    id: "testee-config",
    title: "为了让这一阶段跑起来，改了被测项目的配置",
    body:
      "jest 默认并发两个 worker，两个内存库同时启动会把 beforeAll 顶过默认的 5 秒超时。" +
      "处理方式是测试串行加超时放宽到 30 秒，写进被测项目的 package.json——" +
      "这是 W11 周内第一次为流水线改被测项目。属边界内（不是业务逻辑），但要留痕：" +
      "被测对象为了适配流水线而变化，本身就是一处需要记住的耦合。",
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
  diff: "七项里六项逐字相同；唯一差异落在进程项的两个动态列——常驻内存少了 308 KB、累计 CPU 从 7:07 走到 7:26。",
  lesson:
    "这次对照也暴露了方法本身的粒度问题：全量进程快照会把内存与 CPU 这类动态列一起 diff 进来。" +
    "进程项应当只比对「有没有新增或消失的进程」。对照基线选错粒度，会把噪音读成变更；" +
    "反过来放得太粗，真变更又会藏进噪音里。",
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
    title: "两侧装的依赖不是同一套",
    initial: "依赖只装一次就够：既然生产只跑应用，两侧都按「不含开发依赖」装。",
    mechanism:
      "controller 侧要跑测试，而测试框架、HTTP 断言库与内存数据库全都在开发依赖里。" +
      "按生产的装法装，Test 阶段第一步就找不到测试命令。",
    fix: "两侧依赖集合不同是设计：controller 装全量，服务器只装运行时依赖。写进契约表，不靠记忆。",
    caughtBy: "conflict",
    caughtDetail: "冲突自查把「测试在哪一侧跑」与「产物形态」两题并排看时暴露的。",
    grade: "measured",
  },
  {
    id: "markverified",
    tag: "B1′",
    title: "回滚基线没有人写",
    initial: "验证通过之后，那个「最近一次验证通过的提交」自然就更新了。",
    mechanism:
      "回滚目标存在服务器上的一个文件里，而部署身份可执行的命令是一份白名单。" +
      "白名单里只有部署和回滚两条——没有任何一条命令会去写这个文件。",
    fix: "白名单补第三条命令：只写文件、不部署也不重启，由验证全部通过后调用。",
    caughtBy: "conflict",
    caughtDetail: "把回滚目标那一题与权限清单那一题并排看时暴露的：判据有了，执行通道没有。",
    grade: "measured",
  },
  {
    id: "logger",
    tag: "B2",
    title: "部署标记谁都能打",
    initial: "部署窗口用一个日志标记划出来，只有部署脚本会打这个标记，所以看到标记就可以抑制告警。",
    mechanism:
      "写系统日志的那个命令任何登录用户都能用，标记本身不带任何权限控制。" +
      "「只有脚本能打」这个前提不成立，于是「看到标记就抑制」等于「谁都能让告警闭嘴」。",
    fix:
      "抑制的信任依据换成交叉验证：系统日志里的提交号与构建编号，要与当次构建记录对得上，且未超时。" +
      "标记继续用，但它只是线索，不是凭据。",
    caughtBy: "mechanism",
    caughtDetail: "复核这条抑制规则的安全论证时暴露的：先问「这个前提凭什么成立」，再发现它不成立。",
    grade: "measured",
  },
  {
    id: "nologin",
    tag: "B3",
    title: "想用的那个身份登录不进来",
    initial: "既然部署目录属于应用用户，就用这个身份登录服务器执行部署。",
    mechanism:
      "该用户是 nologin，根本不能登录；服务器上唯一的 SSH 入口是另一个用户。" +
      "而仓库属主又确实是应用用户，直接用登录身份去动仓库会撞属主问题。",
    fix: "登录用唯一入口那个身份，文件操作切到应用用户执行，服务重启走提权白名单。三者分开写清。",
    caughtBy: "fact",
    caughtDetail: "只读采集里查了一次这个用户的身份信息，当场证伪。",
    grade: "measured",
  },
  {
    id: "sshcmd",
    tag: "—",
    title: "包装脚本收不到参数",
    initial: "把提交号作为参数传给服务器上的包装脚本，脚本按位置参数读。",
    mechanism:
      "给公钥加了强制命令之后，客户端传来的命令整段被替换掉——脚本拿不到任何位置参数，" +
      "原始命令被放进一个环境变量里。按位置参数写的脚本会静默地拿到空值。",
    fix: "脚本改成读那个环境变量，再用正则白名单校验，顺带挡掉以短横线开头的选项注入。",
    caughtBy: "mechanism",
    caughtDetail: "核对强制命令这个机制到底替换了什么时暴露的。",
    grade: "measured",
  },
  {
    id: "jdk",
    tag: "—",
    title: "先装的那个 JDK 不会被用到",
    initial: "先装一个长期支持版 JDK，再装 CI 服务，两者版本对上。",
    mechanism:
      "该服务的安装配方自己声明了对另一个 JDK 大版本的依赖，启动脚本也硬编码走那个版本的路径。" +
      "单独先装的那一个装了也不会被使用。",
    fix: "删掉这一步，JDK 由安装配方自己带。设计意图（由包管理器管理 JDK 依赖）不变，不重开决策。",
    caughtBy: "source",
    caughtDetail: "起草落地单时读了一遍安装配方的源码与接口描述，双向确认。",
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
    title: "服务起来了，参数没生效",
    initial: "配置文件建好了、路径也已按实测修正、服务显示已启动、常驻内存还在止步线以内——四样都对，堆参数当然生效了。",
    mechanism:
      "本机这一版包管理器的服务机制根本不读那个配置文件，生成的启动描述里没有注入环境变量的段落。" +
      "实际最大堆仍是默认值 8 GiB，而合约值是 512 MiB。四项观察没有一项对「参数有没有被读到」敏感。",
    fix: "改用启动描述文件直接注入环境变量并自管启停，重跑后最大堆为 512 MiB、常驻内存 301 MB。同时留下一条管理约定：此后不再用包管理器的服务命令启停它，否则注入会被覆盖掉。",
    command: "向 JVM 直接问一次实际堆参数",
    commandNote:
      "这一项之所以存在，是因为开工前 review 问了一句「那条验证对它要验的东西敏感吗」——" +
      "原本只量常驻内存，而默认堆下的空载服务同样落在止步线以内。一条不敏感的验证，等于一格假绿。",
    grade: "measured",
  },
  {
    id: "ci",
    kind: "criterion",
    title: "预测的前提当场不成立",
    initial: "构建环境里不会有那个通用 CI 标记，所以测试会走内存数据库这条回退路径。",
    mechanism:
      "这一版 CI 服务自己就会向构建环境注入 CI=true，与另一套托管 CI 的行为一致，且不来自任何可配置位置。" +
      "而测试代码的规则是「CI 为真且没给数据库地址就直接抛错」——前提一反，整条回退路径就没了。",
    fix: "在测试阶段把这个变量显式置成空串（在 JS 里是假值），维持内存数据库的隔离验证定位；注意不能写成 false，非空字符串仍是真值。",
    command: "一次一分钟的冒烟构建，只打印几个变量",
    commandNote:
      "这一步本来是为了验另一件事（构建环境看不看得见 node）。顺手打印的那个变量把 P6 的前提推翻了——" +
      "先答后对的价值在这里很具体：预测写下来了，才知道被推翻的是哪一条。",
    grade: "measured",
  },
  {
    id: "polling",
    kind: "criterion",
    title: "轮询安静，不等于没有新提交",
    initial: "轮询要是失败了会报错，看得见。",
    mechanism:
      "代码托管方 443 端口间歇性不可达时，轮询把这次失败记成「没有变化」——既不触发构建，也不报错。" +
      "人在界面上看到的是「流水线没动静」，而「没动静」有两种含义：真的没有新提交，或者根本没问成。",
    fix: "当天等网络恢复后由轮询自动触发并转绿。真正的处理留给部署段：那时轮询是唯一的触发通道，「没动静」必须能被分辨。",
    command: "翻轮询自己的日志",
    commandNote:
      "与 W10 那条「没报过红的检查，区分不了『一切正常』和『检查根本没在跑』」是同一族——" +
      "换了个宿主又长了一次。它也是这三条里唯一一条要交给 D3 的。",
    grade: "measured",
  },
  {
    id: "path",
    kind: "cost",
    title: "构建环境里的 node，不是我 shell 里那个",
    initial: "开发机上 node 的版本，就是只读采集时记下的那一个。",
    mechanism:
      "服务由 launchd 拉起，进程的 PATH 是系统默认值，不含包管理器与手工安装的目录，第一次构建直接报找不到 node。" +
      "而这台机器上其实装着四个 node（官网安装包、版本管理器、包管理器的两个），采集时记下的是登录 shell 里的那一个。",
    fix: "在 CI 的全局配置里把 PATH 写全（它是替换不是追加），锁定官网安装包那一个；它与服务器上的运行时同属一个大版本，产物形态的理由仍然成立。",
    command: "构建日志里的一行「找不到命令」，加上逐个目录数一遍 node",
    commandNote:
      "「我机器上的 node 版本」这个说法，在一台装了四个 node 的机器上没有意义——" +
      "要说清是哪个进程、以什么方式启动、PATH 是什么。只读基线里那一行的语义因此被执行期收窄了。",
    grade: "measured",
  },
  {
    id: "mms",
    kind: "cost",
    title: "两级缓存加并发，叠出一个超时",
    initial: "内存数据库的二进制会被缓存，第一次慢，第二次就快了。",
    mechanism:
      "缓存有两级：项目级与用户级。预下载脚本在项目目录里跑，二进制落进项目级缓存，" +
      "而流水线的工作区是另一份目录，找不到它，于是每次都重新下载 481 M。" +
      "补齐用户级缓存之后仍然超时——因为测试框架默认并发两个 worker，两个内存库同时启动抢 CPU，" +
      "启动钩子约 4.5 秒，贴着默认的 5 秒上限。是两个原因叠在一起，不是一个。",
    fix: "二进制复制到用户级缓存；测试改成串行并把超时放宽到 30 秒，本地实测 9 条用例全过、用时 10.5 秒。",
    command: "把测试强制串行跑一次",
    commandNote:
      "串行实证是把两个原因分开的那一刀：并发跑不出结论，串行一跑就知道时间花在竞争上，" +
      "而不是下载上。双因素故障最容易被当成单因素修一半。",
    grade: "measured",
  },
];

/**
 * 十四条计划外事件按「成本落在哪里」归类。
 * 左栏（流水线逻辑）是空的——这是 ⑥·2 的一眼结论，空栏本身就是结论，不能补满。
 *
 * 归类是渲染时对执行记录那张表的分组，不新增事实：每一条都能在
 * day2-controller-setup.md §4 的十四行里找到对应。
 */
export const UNPLANNED_LOGIC: Array<{ id: string; label: string }> = [];

export const UNPLANNED_ENV: Array<{ id: string; bucket: string; n: number; detail: string }> = [
  {
    id: "tool",
    bucket: "工具行为与默认值",
    n: 6,
    detail: "包管理器前缀与它的服务机制、CI 服务自注入变量、内存库的接口在新版本里变了、轮询把失败记成无变化、版本控制拒绝带未提交改动切分支",
  },
  {
    id: "env",
    bucket: "构建环境差异",
    n: 2,
    detail: "登录用的密钥别名、后台服务的 PATH 不是登录 shell 的 PATH",
  },
  {
    id: "res",
    bucket: "资源与缓存",
    n: 2,
    detail: "二进制从未真正下载成功、两个内存库并发抢 CPU",
  },
  {
    id: "net",
    bucket: "网络抖动",
    n: 1,
    detail: "取代码时 443 超时 75 秒，重试即过",
  },
  {
    id: "human",
    bucket: "人的操作",
    n: 2,
    detail: "命令粘到了服务器终端、把合并输出的显示格式误读成漏合",
  },
  {
    id: "plan",
    bucket: "计划内实验",
    n: 1,
    detail: "变红实验本身：改坏一条断言让流水线报红，再还原",
  },
];

export const UNPLANNED_TOTAL = UNPLANNED_ENV.reduce((n, b) => n + b.n, 0) + UNPLANNED_LOGIC.length;

/* ================================================================ 板块建构进度 */

export const W11_STAGE_PLAN: Array<{ id: string; title: string; question: string; done: boolean; when: string }> = [
  { id: "selfcheck-contract", title: "⑥·1 契约层的六条自纠", question: "动手之前，判断力从哪来", done: true, when: "D1 冻结当天已发生完" },
  { id: "selfcheck-runtime", title: "⑥·2 机制层的五条自纠", question: "动手之后，绿灯凭什么可信", done: true, when: "D2 执行期已发生完" },
  { id: "stages", title: "② 五阶段各自的失败面", question: "哪一个阶段能把服务器弄坏", done: true, when: "D2 收口后前三阶段翻档" },
  { id: "trust", title: "③ 从全权免密到两道闸门", question: "收窄之后代价落在谁身上", done: false, when: "D3 越权验证有输出后" },
  { id: "verify", title: "⑤ 部署后验证各自证明不了什么", question: "哪一层只有一项验证覆盖", done: false, when: "D3 首次自动部署后" },
  { id: "rollback", title: "④ 回滚三条路径与两个指针", question: "回滚回到哪一个提交", done: false, when: "D4 回滚演练后" },
  { id: "lanes", title: "① 三条自动化与一把钥匙", question: "为什么只有一条的结论算数", done: false, when: "D5（触发链路终点仍在变）" },
  { id: "handoff", title: "⑦ 与手工部署逐步对照", question: "哪几步没有被替掉", done: false, when: "D5 对照说明成篇后" },
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
