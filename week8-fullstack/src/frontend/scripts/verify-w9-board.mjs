/**
 * W9「部署上线」板的回归断言。
 *
 * 为什么它要入库
 * -------------
 * 这套断言此前每一轮都是临时写的、跑完就丢。代价在 2026-08-14 那轮暴露出来：
 * 那次把 Markdown 残留扫描写得比前几轮严（扫整块板、只排除 pre 与 code），
 * 立刻抓出 5 处存量反引号——它们是 8/13 写进去的，之前几轮的断言压根没覆盖到。
 * 也就是说，重写一次 = 严格程度重新掷一次骰子。落进仓库之后，
 * 覆盖面只会往上走，不会因为换了一轮就退回去。
 *
 * 它拦的是哪一类缺陷
 * ----------------
 * 内容断言（某段文字在不在）只是底线。真正值钱的是三条**类别性**断言，
 * 它们各自对应一次靠肉眼才发现的事故：
 *   1. 白字扫描      —— 重写了 background 却没写 color，全局 button{color:#fff} 让文字在浅色底上消失
 *   2. Markdown 残留 —— 在普通字符串里写 **强调** 或反引号，页面上原样显示（已出现三次）
 *   3. 几何断言      —— 数据加了一列而 CSS 的 grid 没跟上，位置编码当场失效（验收轨道踩过）
 * 加上横向溢出与触控目标两条，构成每一块板的最低体检。
 *
 * 覆盖范围
 * --------
 * 名字叫 verify-w9-board，但 §B3 起它同时守着**全站十二个 tab 的排版下限**，
 * §B4 守着 tab 条自己的几何（每个 tab 完整落在条内、标题不被裁切；
 * 展示与复习两种状态各量一遍），
 * §D 起还守着 W10 可观测性板（同一组类别性断言 + 每块板各自的图形断言）——
 * 正文不掉进元信息梯子、控件字体族、行内 code 不大于正文。
 * 这三类缺陷的机制都不是 W9 独有的（手写的桌面档清单漏一个不会报错，只会安静地
 * 小一号），只在 W9 上断言等于把已经修过的坑留给别的板再踩一遍。
 *
 * 怎么跑
 * -----
 *   yarn build:showcase && yarn verify:board
 *
 * 依赖 playwright（chromium）。本仓库不把它列进 devDependencies——
 * 它只在这个脚本里用得到，装进依赖树会让每个人的 install 都变重。
 * 全局装过（npm i -g playwright）或项目里装过都能解析到；
 * 都没有时用 PLAYWRIGHT_MODULE 指到具体路径。
 *
 * 脚本自带静态服务，不需要另外起 http-server；退出码非 0 即失败。
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DIST = process.env.DIST ?? join(ROOT, "dist-showcase");
const PORT = Number(process.env.PORT ?? 8099);
const BASE = `http://127.0.0.1:${PORT}`;

/** 十块板的 topic id。新增一块时加在这里，体检自动覆盖它。 */
const TOPICS = [
  "boundary", "urlface", "cert", "failure", "systemd",
  "rollback", "release", "identity", "spoken", "chain", "proxy", "evidence", "exposure",
];

/** ⑦ 那块「绿时也打一行」的关键词，单独拎出来避免断言里写死一整句。 */
const GREEN_LINE_HINT = "绿态每次也输出一行";

/** W10 可观测性板已落地的 topic id。同上：加一块就加在这里。 */
// ⑤ 与 ⑧ 各在 tab 上分三页；「本板共几块」数的是建成了哪几块内容（现在八块），
// 与 tab 数（十二个）不是一个数，见 W10Board 的 DRILL_TABS / RUNBOOK_TABS 注释。
const W10_TOPICS = ["falsegreen", "blindspot", "journey", "fields", "thresholds", "redproof",
  "drill", "drill-signals", "drill-blinds",
  "runbook", "runbook-selftest", "runbook-strength"];

/** W11 发布流水线板已落地的 topic id。D5 收口日 ①⑦ 落地后全板十二块齐。 */
const W11_TOPICS = ["selfcheck-contract", "selfcheck-runtime", "frozen-values",
  "stages", "trust", "verify", "remote-trigger", "criteria",
  "rollback", "false-active", "lanes", "handoff"];

const RUNBOOK_TOPICS = ["first-probe", "topology", "fault-1", "fault-2", "fault-3", "drill-boundaries"];

/* ---------------------------------------------------------------- 基础设施 */

/**
 * 找到 playwright。裸标识符只会沿 node_modules 往上找，**找不到全局安装的包**——
 * 所以除了裸标识符，还要显式试一遍全局目录：node 在 <prefix>/bin/node，
 * 全局包就在 <prefix>/lib/node_modules 下（nvm、homebrew、apt 装的 node 都是这个布局）。
 */
async function loadChromium() {
  const globalRoot = resolve(process.execPath, "../../lib/node_modules");
  const specs = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    "playwright-core",
    join(globalRoot, "playwright/index.mjs"),
    join(globalRoot, "playwright-core/index.mjs"),
  ].filter(Boolean);
  for (const spec of specs) {
    try {
      return (await import(spec)).chromium;
    } catch {
      /* 试下一个 */
    }
  }
  throw new Error(
    "找不到 playwright。装一个：npm i -g playwright && npx playwright install chromium；" +
      `已试过的位置：${specs.join("、")}。` +
      "都不合适时用 PLAYWRIGHT_MODULE=/绝对路径/playwright/index.mjs 直接指定。",
  );
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

/** 只服务 dist 目录，够跑断言就行；不做目录穿越之外的任何花样。 */
function serveDist() {
  return new Promise((ready) => {
    const server = createServer(async (req, res) => {
      const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const file = join(DIST, path === "/" ? "index.html" : path);
      if (!file.startsWith(DIST)) {
        res.writeHead(403).end();
        return;
      }
      try {
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404).end("not found");
      }
    });
    server.listen(PORT, "127.0.0.1", () => ready(server));
  });
}

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) { passed++; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ------------------------------------------------------------------- 主流程 */

try {
  await stat(join(DIST, "index.html"));
} catch {
  console.error(`产物不存在：${DIST}/index.html\n先跑 yarn build:showcase`);
  process.exit(2);
}

const chromium = await loadChromium();
const server = await serveDist();
// 浏览器本体：默认用 playwright 自己下的那份。有些环境（容器镜像预装、版本与本地
// playwright 不同号）里那份不存在，但机器上有一份可用的 Chromium——用 CHROMIUM_PATH
// 指过去即可，和上面的 PLAYWRIGHT_MODULE 是同一类逃生口，不改任何断言。
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

// D4-c 之后展板要登录才渲染。门禁是纯前端守卫，预置 localStorage 即可绕过——
// 这条本身也是那块板的结论：静态内容本来就在产物里，门禁挡的只是浏览器用户。
await ctx.addInitScript(() => {
  localStorage.setItem("skillup_token", "verify-only-not-a-real-token");
  localStorage.setItem("skillup_user", JSON.stringify({ name: "verify", email: "v@example.com", role: "admin" }));
});

const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
const apiCalls = [];
page.on("request", (r) => {
  const u = r.url();
  if (u.startsWith(BASE) && /\/(auth|users|reports)\b/.test(u)) apiCalls.push(u);
});

async function goTopic(topic) {
  await page.goto(`${BASE}/#/showcase?mode=review&tab=deploy&topic=${topic}`, { waitUntil: "networkidle" });
  // 同 goTab / revealAll：折叠内容也要进采样。默认收起的块（生产对照、认知修正、
  // 分档图例、建构进度）里一样有断言要读的正文，而 innerText 读不到隐藏内容。
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.waitForTimeout(220);
}
const bodyText = () => page.evaluate(() => document.body.innerText);

/** 复习门：把本专题里所有揭示按钮点开，否则结论区不渲染。 */
async function revealAll() {
  for (let i = 0; i < 8; i++) {
    const btns = page.locator(".w9-reveal-gate button, .w9-recall-gate button, button.w10-reveal-gate");
    if ((await btns.count()) === 0) break;
    await btns.first().click();
    await page.waitForTimeout(140);
  }
  // 同 goTab：折叠内容也要进采样。默认收起的块（分档图例、建构进度、术语表）里
  // 一样有档位标签和正文，隐藏态下 innerText 读出来是空串，会让断言假红。
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.waitForTimeout(120);
}

/* ============================================ A. 事实：页面上说的与仓库事实一致 */

// ① Q8 已还 + 双层防线（8/14 之前这里写的是「欠着」）
await goTopic("urlface");
await revealAll();
let t = await bodyText();
ok("Q8 卡头写已还", t.includes("8/14 已还"));
ok("Q8 不再自称至今谁都能调", !t.includes("至今谁都能调"));
ok("Q8 三档期望值渲染", t.includes("401") && t.includes("403") && t.includes("200"));
ok("Q8 jest 回归行", t.includes("3 suites / 9 tests"));
ok("Q8 线上复现", t.includes("线上复现"));
ok("双层 两条路径", (await page.locator(".w9-twolayer-path").count()) === 2);
const stops = await page.locator(".w9-twolayer-code").allInnerTexts();
ok("双层 两个状态码 404/401", stops.join(",") === "404,401", stops.join(","));
// 内线是绕过 Nginx，不是穿过它——第一版画错过，这四条把形状钉住
ok("双层 内线标绕过", (await page.locator(".w9-twolayer-path.internal .w9-twolayer-link.bypass").count()) === 1);
ok("双层 内线的 Nginx 是灰的", (await page.locator(".w9-twolayer-path.internal .w9-twolayer-node.dim").count()) === 1);
ok("双层 公网那条 Express 是灰的", (await page.locator(".w9-twolayer-path.public .w9-twolayer-node.dim").count()) === 1);
ok("双层 公网断在 Nginx→Express", (await page.locator(".w9-twolayer-path.public .w9-twolayer-link.cut").count()) === 1);
ok("层选择 日期锚定而非「今天没做」", t.includes("8/13 没做，8/14 补上") && !t.includes("应用层 · 今天没做"));

// ② 时区：明确不修（观察点只挂在 B3 上）
await goTopic("chain");
await page.locator(".w9-acc-row", { hasText: "B3" }).click();
await page.waitForTimeout(180);
await revealAll();
t = await bodyText();
ok("时区 决策已落", t.includes("明确不修"));
ok("时区 不再写待决策", !t.includes("待决策"));
ok("时区 说清是被接受不是被修好", t.includes("已知口径"));

// ③ 七次验收，且冷启动那次最右段是空的（覆盖跨度图唯一的这种形状）
const rows = await page.locator(".w9-acc-row").count();
ok("验收 行数 7", rows === 7, String(rows));
const coldCells = await page.locator(".w9-acc-row", { hasText: "冷启动自愈" }).locator(".w9-acc-seg").allInnerTexts();
ok("验收 冷启动只覆盖前三段", coldCells.join(",") === "验证到,验证到,验证到,没验证", coldCells.join(","));
const depCells = await page.locator(".w9-acc-row", { hasText: "admin 迁 443" }).locator(".w9-acc-seg").allInnerTexts();
ok("验收 发布验收四段全覆盖", depCells.every((c) => c === "验证到"), depCells.join(","));

// ④ shop.bak 破口闭合，但破口原文保留
await goTopic("rollback");
await revealAll();
t = await bodyText();
ok("破口 已闭合", t.includes("已闭合"));
ok("破口 不再自称当前的破口", !t.includes("这套纪律当前的破口"));
ok("破口 424 字节新基线", t.includes("424"));
ok("破口 仍点名 443 那份没进 git", t.includes("shop-ssl") && t.includes("不在 git"));

// ⑤ 五个面 / 四份 server 块——这两个数字从 8/14 起不再相等
await goTopic("boundary");
t = await bodyText();
ok("面 五张卡", (await page.locator(".w9-face").count()) === 5);
ok("面 标题写 5 个面 4 份 server 块", /5 个面、4 份 server 块/.test(t));
ok("面 第五张标为 location", (await page.locator(".w9-face.location").count()) === 1);

// ⑥ 契约验收：D5 一列、仍欠为空、决策关闭单独标
await goTopic("evidence");
t = await bodyText();
const days = await page.locator(".w9-settle-day").allInnerTexts();
ok("契约验收 四天 + 仍欠列", days.join(",") === "D2,D3,D4,D5,仍欠", days.join(","));
ok("契约验收 仍欠列空了", (await page.locator(".w9-settle-empty").count()) === 1);
ok("契约验收 决策关闭单独标", t.includes("决策关闭，不是修好了"));
// 几何断言：数据加了一列而 grid 没跟上，「横坐标 = 哪天销的」当场失效——踩过一次
const colTops = await page.locator(".w9-settle-col").evaluateAll((els) =>
  Array.from(new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))));
ok("契约验收 五列同一行", colTops.length === 1, `${colTops.length} 行`);
ok("契约验收 契约表之外四笔", (await page.locator(".w9-offbook-item").count()) === 4);
ok("契约验收 主动接受与还欠着分开", t.includes("主动接受") && t.includes("还欠着"));
ok("契约验收 旧待办显示 8/27 结局", t.includes("8080 监听") && t.includes("已串联 admin token"));
ok("生产对照 鉴权进已做", t.includes("应用层鉴权"));
ok("内存 RSS 与 MemAvailable 分成两图", (await page.locator(".w9-mem-scale").count()) === 2);
ok("内存 不再渲染 RSS+available 堆叠条", (await page.locator(".w9-mem-bar").count()) === 0);
ok("内存 available 单独对照 400MB 门", t.includes("1388 MB") && t.includes("400 MB 门"));
ok("内存 采集时点与不可相加口径常驻", t.includes("2026-08-12") && t.includes("不能相加"));

// ⑦ 证书：timer 档位升级，但仍不证明续签成功
await goTopic("cert");
await revealAll();
t = await bodyText();
ok("证书 LAST 实测", t.includes("04:14:01"));
ok("证书 仍不证明续签成功", t.includes("跳过") || t.includes("不证明"));
ok("证书 issuer 链只有叶中根三段", (await page.locator(".w9-issuer-chain > li").count()) === 3);
ok("证书 trust store 与 hostname 是两道独立判定", (await page.locator(".w9-trust-gates > article").count()) === 2);
ok("证书 SAN 不再进入 issuer 链", (await page.locator(".w9-issuer-chain", { hasText: "SAN" }).count()) === 0);
ok("证书 可交互控件不再藏进 role=img", (await page.locator("[role=img] button").count()) === 0);

// ⑧ 暴露面：两天各选了一种切法
await goTopic("exposure");
await revealAll();
t = await bodyText();
ok("暴露 路径也被选过", t.includes("D5（8/14）admin 迁 443 用它"));
ok("暴露 端口那次仍在", t.includes("D4-c（8/13）"));
ok("暴露 证书按域名签是分水岭", t.includes("证书按域名签"));
ok("拓扑 W9 历史与 W11 当前并列", (await page.locator(".w9-topology-snapshot").count()) === 2);
ok("拓扑 8080 下线且 80 新增 showcase", t.includes("8080 下线") && t.includes("80 · /showcase/"));
ok("拓扑 API 展示资产已串联 token", t.includes("Postman 已串联 admin token"));
ok("拓扑 两个时点共用 Node Mongo 内线", (await page.locator(".w9-topology-upstream strong").count()) === 2);
ok("暴露 服务没变门换了", t.includes("服务没变，门换了"));

// ⑨ 发布变更单：期望必须先于结果，覆盖矩阵必须有对照组
await goTopic("release");
t = await bodyText();
ok("变更单 四要素", (await page.locator(".w9-ticket-el").count()) === 4);
const checks = await page.locator(".w9-verify-row").count();
ok("变更单 六项验证", checks === 6, String(checks));
// 期望必须排在实测之前，而且期望要有来源——这块板的全部主张就在这个顺序里。
// （不能拿整页文本比位置：证据档位图例里就有「实测」这个词。）
const expectOrder = await page.locator(".w9-verify-expect dt").allInnerTexts();
ok("变更单 期望→来源→实测 的顺序", expectOrder.join(",") === "期望,期望来源,实测", expectOrder.join(","));
ok("变更单 ④ 期望 401 不是 200", t.includes("401（不是 200）"));
ok("变更单 ⑤ 必须服务器内直连", t.includes("服务器内直连") || t.includes("绕过 Nginx"));
ok("变更单 对照组存在", t.includes("对照组"));
await revealAll();
t = await bodyText();
ok("变更单 产物二份制", t.includes("dist-admin443") && t.includes("两种产物形态"));
ok("变更单 三个执行期踩点", (await page.locator(".w9-snag").count()) === 3);

// ⑪ 列计数升级为真条形图：旧「这一层被验了几次」数字行已被图表替代，不能并存
await goTopic("release");
await revealAll();
ok("条形图-⑪ 列计数条形图存在", (await page.locator(".w9-chart-block .chart-wrap svg[role='img']").count()) >= 1);
t = await bodyText();
ok("条形图-⑪ 写入「哪一层被反复验」", t.includes("哪一层被反复验"));
ok("条形图-⑪ 旧数字行已被移除", (await page.locator(".w9-verify-foot").count()) === 0);

// ⑩ 身份矩阵：坑的密度必须是数出来的，不是写死的一句话
await goTopic("identity");
t = await bodyText();
ok("身份 四个身份", (await page.locator(".w9-idm-id").count()) === 4);
// www-data 是唯一一个你不会登录成它的身份，漏了它就解释不了那次 403
ok("身份 含 www-data", t.includes("www-data"));
ok("身份 五个对象", (await page.locator(".w9-idm-row").count()) === 5);
ok("身份 二十个格子", (await page.locator(".w9-idm-cell").count()) === 20);
// 第 9 与第 10 条落在同一格——这是本块最值钱的一条，用计数把它钉住
const ubuntuRepo = page.locator(".w9-idm-row", { hasText: "代码仓库" }).locator(".w9-idm-cell").nth(0);
ok("身份 ubuntu×仓库 标了踩过 3", (await ubuntuRepo.locator(".w9-idm-count").innerText()).includes("3"));
await ubuntuRepo.click();
await page.waitForTimeout(180);
t = await bodyText();
ok("身份 那一格列出三条坑", (await page.locator(".w9-idm-snags li").count()) === 3);
ok("身份 dubious ownership 在那一格", t.includes("dubious ownership"));
ok("身份 FETCH_HEAD 也在那一格", t.includes("FETCH_HEAD"));
ok("身份 绕过第一个只会送到第二个", t.includes("绕过第一个"));
await revealAll();
t = await bodyText();
ok("身份 最密的一格是结论", t.includes("落在同一格"));
ok("身份 换身份本身的坑单列", (await page.locator(".w9-idm-loose-item").count()) === 3);
ok("身份 黄金规则", t.includes("sudo -u nodeapp"));
ok("身份 报错先问哪一句", t.includes("以谁的身份"));
ok("身份 五条正确形态", (await page.locator(".w9-idm-recipes li").count()) === 5);

// ⑫b 身份矩阵：坑按身份分布升级为真条形图（2026-08-17 可视化增强）
ok("条形图-⑫ 坑分布存在", (await page.locator(".w9-chart-block .chart-wrap svg[role='img']").count()) >= 1);
t = await bodyText();
ok("条形图-⑫ 写入「按身份数」", t.includes("按身份数"));
ok("条形图-⑫ 未把 loose 条混入身份", !t.includes("独占 8"));

// ⑬ 讲得出来才算会：密度必须是画出来的，零错的层不能被画没
await goTopic("spoken");
t = await bodyText();
ok("口述 八层轴", (await page.locator(".w9-spoken-layer").count()) === 8);
// 前三层零错正是这块板的结论——它们必须显式标出来，不能是空白
const cleanCount = await page.locator(".w9-spoken-layer.clean").count();
ok("口述 三层零错", cleanCount === 3, String(cleanCount));
ok("口述 零错也画一条线", t.includes("零错"));
// 中间那几层是密度所在
const entryN = await page.locator(".w9-spoken-layer", { hasText: "Nginx 选入口" }).locator(".w9-spoken-n").innerText();
ok("口述 Nginx 选入口 2 处", entryN.includes("2"), entryN);
const allowN = await page.locator(".w9-spoken-layer", { hasText: "URL 白名单" }).locator(".w9-spoken-n").innerText();
ok("口述 URL 白名单 2 处", allowN.includes("2"), allowN);
// 复习门未揭示时，只给初始说法，不给修正
ok("口述 复习门未揭示不给修正", !t.includes("✅ 修正"));
await page.locator(".w9-spoken-layer", { hasText: "URL 白名单" }).click();
await page.waitForTimeout(180);
t = await bodyText();
ok("口述 未揭示时只给初始说法", t.includes("❌ 我当时说") && !t.includes("⚡ 错在哪一步"));
await revealAll();
t = await bodyText();
ok("口述 揭示后给出三段式", t.includes("⚡ 错在哪一步") && t.includes("✅ 修正"));
ok("口述 精确路径不是前缀", t.includes("精确路径"));
ok("口述 统一 404 不用 403", t.includes("404") && t.includes("403"));
ok("口述 密度结论", t.includes("前三层"));
// 「记忆停在旧状态」是最难自查的一类，必须单独成类
ok("口述 五类错", (await page.locator(".w9-spoken-kind-card").count()) === 5);
ok("口述 stale 单独着色", (await page.locator(".w9-spoken-kind-card.stale").count()) === 1);
ok("口述 stale 与展板结论过时同源", t.includes("展板给出与最新数据不一致的结论"));

/* ================================== B. 每块板的最低体检（三条类别性断言 + 两条） */

for (const topic of TOPICS) {
  await goTopic(topic);
  await revealAll();
  const text = await bodyText();

  // Markdown 残留：落盘的配置块（pre / code）除外
  const plain = await page.evaluate(() => {
    const root = document.querySelector(".w9-board") ?? document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("pre, code").forEach((n) => n.remove());
    return clone.innerText;
  });
  ok(`残留-${topic} 无 ** 加粗`, !plain.includes("**"));
  ok(`残留-${topic} 无反引号`, !plain.includes("`"));

  // 白字：浅色底上的纯白文字（重写了 background 却没写 color 时会出现，文字直接消失）。
  //
  // 这条断言此前写的是「任何元素的计算色都不得是纯白」，而且因为选择器写的 .w9-board
  // 一直不存在（W9 是唯一没有板根的板），入库以来一直选中 0 个元素、空跑着通过。
  // 补上板根之后它立刻响了 5 次，但全是误报，原因是原判据有两处太粗：
  //   1. 用 textContent 判断「有文字」，于是按钮容器会因为后代的文字被算进来——
  //      容器自己继承全局 button { color: #fff }，可见文字却在各自设色的子元素里；
  //   2. 只看文字色、不看底色，于是深色底上正常的白字（选中态的蓝底按钮）也算违规。
  // 收紧成「自己直接含文本节点 + 底色够浅」之后，13 块板实测 0 命中，
  // 而它要拦的那类缺陷（浅底白字）仍然会被抓住。
  const white = await page.evaluate(() => {
    const luminance = (color) => {
      const n = color.match(/[\d.]+/g);
      if (!n) return null;
      return 0.2126 * Number(n[0]) + 0.7152 * Number(n[1]) + 0.0722 * Number(n[2]);
    };
    // 逐级往上找第一个不透明底色：元素自己多半是 transparent
    const effectiveBg = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const parts = bg.match(/[\d.]+/g);
        if (parts && (parts.length < 4 || Number(parts[3]) > 0.5)) return bg;
      }
      return "rgb(255, 255, 255)";
    };
    const bad = [];
    document.querySelectorAll(".w9-board *").forEach((el) => {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (getComputedStyle(el).color !== "rgb(255, 255, 255)") return;
      const lum = luminance(effectiveBg(el));
      if (lum !== null && lum >= 200) bad.push(el.className || el.tagName);
    });
    return bad.slice(0, 3);
  });
  ok(`白字-${topic}`, white.length === 0, white.join("|"));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`溢出-${topic} 桌面`, overflow <= 0, `+${overflow}px`);
  // 空壳保护：某块只渲染出标题时截图容易看漏，这条会响
  ok(`文本-${topic} 非空壳`, text.length > 400, String(text.length));
}

// 移动视口：全部十块都过一遍溢出与触控目标
await page.setViewportSize({ width: 390, height: 844 });
for (const topic of TOPICS) {
  await goTopic(topic);
  await revealAll();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`溢出-${topic} 移动`, overflow <= 0, `+${overflow}px`);
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".w9-board button, .w9-board summary").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.width < 24 || r.height < 24) bad.push(`${el.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return bad.slice(0, 3);
  });
  ok(`触控-${topic} 移动 ≥24px`, small.length === 0, small.join("|"));
}

/* ============================================================ B2. 排版体系不回退

   下面五条各自守住一次实测出来的样式事故。它们是**类别性**断言，不是「某处字号
   应该是 13.5px」这种会被下一次改版正常改掉的具体值：

     1. SVG 缩放比      —— viewBox 宽写死、CSS 再拉到 100%，会把 font-size 一起缩放。
                           实测代价：桌面 10px 的轴文字渲染成 21px，手机渲染成 6px，
                           而且 CSS 里针对性写的覆盖完全不起作用（改的是用户单位）。
     2. 柱厚           —— 厚度是 mark 的非度量维，不该编码任何东西，全站一个值。
     3. 正文不掉进元信息梯子 —— p/li/dd 落到 10.5px 一档是漏网，不是层级设计。
     4. 桌面不小于手机   —— 只有 max-width 断点、没有 min-width 断点时会出现的倒挂。
     5. 字体族         —— button/input 不写 font-family: inherit 就落回 UA 默认字体，
                           页面上会出现「按钮内 Arial、按钮外 system-ui」。
*/

await page.setViewportSize({ width: 1440, height: 1000 });

// 1 + 2：图表几何。两块板各有一张 HBarChart，走同一个组件。
for (const topic of ["release", "identity"]) {
  await goTopic(topic);
  await revealAll();
  const geo = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".chart-wrap svg").forEach((svg) => {
      const vb = (svg.getAttribute("viewBox") ?? "0 0 0 0").split(/\s+/).map(Number);
      const w = svg.getBoundingClientRect().width;
      out.push({
        scale: vb[2] ? w / vb[2] : 0,
        thick: [...svg.querySelectorAll("path.series-fill")].map((p) =>
          Math.round(p.getBoundingClientRect().height),
        ),
      });
    });
    return out;
  });
  for (const [i, g] of geo.entries()) {
    ok(`图表-${topic}#${i} 缩放比为 1`, Math.abs(g.scale - 1) < 0.02, `scale=${g.scale.toFixed(3)}`);
    ok(
      `图表-${topic}#${i} 柱厚 18px`,
      g.thick.every((t) => t === 18),
      g.thick.join("/"),
    );
  }
}

// 2b：手写的竖柱与 SVG 横条同厚。--viz-bar 只有一个值，两边都该读它。
await goTopic("spoken");
const spokenBar = await page.evaluate(() =>
  [...document.querySelectorAll(".w9-spoken-layer:not(.clean) .w9-spoken-bar")].map((el) =>
    Math.round(el.getBoundingClientRect().width),
  ),
);
ok(
  "柱厚 .w9-spoken-bar 与图表一致（18px）",
  spokenBar.length > 0 && spokenBar.every((w) => w === 18),
  spokenBar.join("/"),
);

/** 每块板里「自己直接含文字」的元素字号，用于 3/4 两条。 */
const proseSizes = async () =>
  page.evaluate(() => {
    const out = [];
    const walk = (el) => {
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
      if (own && cs.display !== "none" && el.getBoundingClientRect().height > 0) {
        out.push({ tag: el.tagName.toLowerCase(), fs: parseFloat(cs.fontSize), cls: el.className });
      }
      for (const c of el.children) walk(c);
    };
    const root = document.querySelector(".w9-board") ?? document.querySelector(".showcase");
    if (root) walk(root);
    return out;
  });

// 3：正文元素不许落回元信息梯子。.global-viz-legend 是全站共用的图例，不算 W9 的账。
const PROSE_FLOOR = 12;
for (const topic of TOPICS) {
  await goTopic(topic);
  await revealAll();
  const rows = await proseSizes();
  const sunk = rows
    .filter((r) => ["p", "li", "dd"].includes(r.tag) && r.fs < PROSE_FLOOR)
    .filter((r) => !String(r.cls).includes("global-viz-legend"))
    .map((r) => `${r.tag}.${String(r.cls).split(" ")[0]}:${r.fs}px`);
  ok(`正文-${topic} 桌面 ≥${PROSE_FLOOR}px`, sunk.length === 0, [...new Set(sunk)].slice(0, 3).join("|"));
}

// 4：同一块板，桌面正文不得小于手机正文。倒挂过一次（1440px 10.5px < 390px 11.5px）。
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const bodyMedian = async (w) => {
  await page.setViewportSize({ width: w, height: 1000 });
  await goTopic("boundary");
  await revealAll();
  const rows = await proseSizes();
  return median(rows.filter((r) => r.tag === "p").map((r) => r.fs));
};
const mobileBody = await bodyMedian(390);
const desktopBody = await bodyMedian(1440);
ok(
  "正文 桌面不小于手机",
  desktopBody >= mobileBody,
  `1440px=${desktopBody}px < 390px=${mobileBody}px`,
);

// 5：字体族。整块板只该有 body 的 system-ui 与 code 的 ui-monospace 两族。
await page.setViewportSize({ width: 1440, height: 1000 });
await goTopic("chain");
await revealAll();
const families = await page.evaluate(() => {
  const seen = new Map();
  const root = document.querySelector(".w9-board") ?? document.body;
  root.querySelectorAll("*").forEach((el) => {
    if (!el.textContent?.trim()) return;
    const fam = getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "");
    if (fam === "system-ui" || fam === "ui-monospace") return;
    seen.set(fam, `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
  });
  return [...seen.entries()].map(([f, w]) => `${f}@${w}`);
});
ok("字体族 只有 system-ui 与 ui-monospace", families.length === 0, families.slice(0, 3).join("|"));

// 6：行内 code 不得大于包住它的正文。全局 code { font-size: 0.92em } 只服务
// 「夹在正文里」这一种 code；给它写绝对值就会脱钩，出现代码比正文还大的倒挂。
await page.setViewportSize({ width: 1440, height: 1000 });
for (const topic of TOPICS) {
  await goTopic(topic);
  await revealAll();
  const inverted = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".w9-board code").forEach((el) => {
      const parent = el.parentElement;
      if (!parent) return;
      // 只看真的夹在正文里的：父元素自己也直接含文字
      const inProse = [...parent.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 2,
      );
      if (!inProse) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const pfs = parseFloat(getComputedStyle(parent).fontSize);
      if (fs > pfs + 0.01) bad.push(`${String(parent.className).split(" ")[0]}:${fs}>${pfs}`);
    });
    return [...new Set(bad)].slice(0, 3);
  });
  ok(`行内 code-${topic} 不大于正文`, inverted.length === 0, inverted.join("|"));
}

/* ====================================================== B3. 全站排版（十二个 tab）

   B2 那组断言只看 W9。但 W9 暴露出来的三类缺陷都不是 W9 独有的机制：
     · 正文掉进元信息梯子      —— 任何「容器设了元信息号、里面却放了要读的句子」都会中
     · 桌面档漏项              —— 各板的 min-width: 1200px 档是**手写清单**，漏一个不报错，
                                  只会安静地小一号；实测就抓到 W6 漏了 3 个选择器、
                                  全站共用的 .global-viz-legend 说明段漏在所有板上
     · 控件字体族              —— 全局的，一处漏写全站都中
   所以这三条要在十二个 tab 上都跑一遍。桌面与手机各有下限：桌面 12px（各板正文档），
   手机 11.5px（W6 一系的正文基础值就是 11.5px，不能按桌面的尺子量）。
*/

const SHOWCASE_TABS = ["auth", "oauth2", "architecture", "database", "runtime", "testing", "deploy", "observability", "runbook", "release", "interview", "ai-engineer", "notes"];

/** 打开一个 tab，并把 details 全部展开，让折叠内容也进入采样。 */
async function goTab(tab) {
  await page.goto(`${BASE}/#/showcase?mode=review&tab=${tab}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.waitForTimeout(300);
}

const typographyScan = () =>
  page.evaluate(() => {
    const prose = [];
    const families = new Set();
    const walk = (el) => {
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
      if (own && cs.display !== "none" && el.getBoundingClientRect().height > 0) {
        const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "");
        if (fam !== "system-ui" && fam !== "ui-monospace") {
          families.add(`${fam}@${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
        }
        if (["P", "LI", "DD"].includes(el.tagName)) {
          prose.push({
            fs: parseFloat(cs.fontSize),
            at: `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0] || "(无class)"}`,
          });
        }
      }
      for (const c of el.children) walk(c);
    };
    const root = document.querySelector(".showcase-panel") ?? document.querySelector(".showcase");
    if (root) walk(root);

    // 行内 code 不得大于包住它的正文
    const inverted = [];
    document.querySelectorAll("code").forEach((el) => {
      const parent = el.parentElement;
      if (!parent) return;
      const inProse = [...parent.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 2,
      );
      if (!inProse) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const pfs = parseFloat(getComputedStyle(parent).fontSize);
      if (fs > pfs + 0.01) inverted.push(`${String(parent.className).split(" ")[0]}:${fs}>${pfs}`);
    });

    return { prose, families: [...families], inverted: [...new Set(inverted)] };
  });

for (const [width, floor, label] of [
  [1440, 12, "桌面"],
  [390, 11.5, "手机"],
]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const tab of SHOWCASE_TABS) {
    await goTab(tab);
    const { prose, families, inverted } = await typographyScan();
    const sunk = [...new Set(prose.filter((r) => r.fs < floor).map((r) => `${r.at}:${r.fs}px`))];
    ok(`全站正文-${tab} ${label} ≥${floor}px`, sunk.length === 0, sunk.slice(0, 3).join("|"));
    ok(`全站字体族-${tab} ${label}`, families.length === 0, families.slice(0, 3).join("|"));
    ok(`全站行内 code-${tab} ${label}`, inverted.length === 0, inverted.slice(0, 3).join("|"));
  }
}

/* ---------------------------------------------- B4. tab 条本身（2026-08-22）

   这是第 4 条几何断言，起因是一次真事故：tab 从 6 个长到 10 个，CSS 却还写着
   repeat(6, ...) 与 width: min(100%, 1060px)。复习状态第 10 个 tab「学习笔记」
   在 ≥1200px 上被容器的 overflow: hidden 裁成半个字——看不全，也点不到。
   而 B3 那组断言只量字号，量不到「控件被容器切掉」。

   所以这里量的是 tab 条自己的几何，且必须两种状态都量：展示状态 7 个 tab 排得下，
   复习状态 10 个才排不下，只测默认状态等于测不到。断言写成「与 tab 数无关」的形态
   （每个 tab 都完整落在 tab 条内、标题不被自身裁切），下次再加板也不用改这里。
*/

// 加一块板就在这里 +1（2026-09-02：新增 ai-engineer，展示 8→9、复习 12→13）。
// 它守的是「渲染出来的 tab 数与 TABS 一致」，几何断言才知道该量几个。
const TAB_COUNT = { demo: 9, review: 13 };

/** 一个 tab 是否完整落在 tab 条内；标题被自身裁切（scrollWidth 溢出）也算不完整。 */
const tabBarScan = () =>
  page.evaluate(() => {
    const bar = document.querySelector('[role="tablist"].showcase-tabs');
    if (!bar) return null;
    const box = bar.getBoundingClientRect();
    const tabs = [...bar.querySelectorAll('[role="tab"]')];
    const outside = [];
    const truncated = [];
    for (const el of tabs) {
      const r = el.getBoundingClientRect();
      // 0.5px 容差：devicePixelRatio 下的亚像素误差不算裁切。
      if (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5) {
        outside.push(el.textContent);
      }
      if (el.scrollWidth > el.clientWidth + 1) truncated.push(el.textContent);
    }
    return { n: tabs.length, outside, truncated };
  });

/* B5. 学习演进导航（2026-08-25）

   与 B4 同一个机制，换了个控件：这条导航在窄屏是一行 space-between，标题又是 nowrap，
   节点加到第 9 个（W11）时每个按钮只剩 28px 宽，标题整段溢出自己的盒子。
   实测发现它在 8 个节点时就已经这样——属存量，加节点让它更明显。
   断言写成与节点数无关的形态：每个节点的标题都不被自身裁切。 */

const seqScan = () =>
  page.evaluate(() => {
    const nav = document.querySelector(".learning-sequence");
    if (!nav) return null;
    const btns = [...nav.querySelectorAll("button")];
    return {
      n: btns.length,
      spill: btns.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
    };
  });

for (const width of [1440, 1200, 721, 390, 320]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`${BASE}/#/showcase?mode=review`, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const seq = await seqScan();
  ok(`演进导航渲染-${width}px`, seq !== null);
  if (!seq) continue;
  ok(`演进导航 9 个节点-${width}px`, seq.n === 9, String(seq.n));
  ok(`演进导航标题不被自身裁切-${width}px`, seq.spill.length === 0, seq.spill.slice(0, 3).join("|"));
}
await page.setViewportSize({ width: 1440, height: 1000 });

for (const mode of ["demo", "review"]) {
  // 1200 是桌面档的下沿（十二个 tab 排一行最紧的一档），721 是手机两列网格之上最窄的一档。
  for (const width of [1920, 1440, 1200, 1024, 721, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${BASE}/#/showcase?mode=${mode}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const bar = await tabBarScan();
    const at = `${mode} ${width}px`;
    ok(`tab 条渲染-${at}`, bar !== null);
    if (!bar) continue;
    ok(`tab 条数量-${at} ${TAB_COUNT[mode]} 个`, bar.n === TAB_COUNT[mode], String(bar.n));
    ok(`tab 不被容器裁切-${at}`, bar.outside.length === 0, bar.outside.join("|"));
    ok(`tab 标题不被自身裁切-${at}`, bar.truncated.length === 0, bar.truncated.join("|"));
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    ok(`tab 条不撑出横向滚动-${at}`, overflowX <= 0, String(overflowX));
  }
}
await page.setViewportSize({ width: 1440, height: 1000 });

/* ============================================== D. W10 可观测性板（2026-08-18）

   同一组类别性断言（Markdown 残留 / 白字 / 溢出 / 空壳 / 触控 / 正文下限），
   外加两条本板专属的：
     · 每条事实都挂了档位标签       —— 这块板一半内容是「还没被检验的承诺」，
                                       漏一个标签就等于把承诺画成了已完成
     · 那一格空轨道真的渲染出来了   —— ①「请求没进 Node」改造后仍然没有 Node 日志，
                                       补满它图会更整齐，结论会变成谎话
*/

async function goW10(topic) {
  await page.goto(`${BASE}/#/showcase?mode=review&tab=observability&topic=${topic}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(220);
}

await page.setViewportSize({ width: 1440, height: 1000 });

// D1. ⑥ 假生效：矩阵的形状就是结论——三道灯没有一个「拦」字
await goW10("falsegreen");
await revealAll();
let w10t = await bodyText();
ok("W10⑥ 标题给出结论", w10t.includes("四个实例均未触发检查失败"));
const rowsW10 = await page.locator(".w10-corridor-row").count();
ok("W10⑥ 四条实例", rowsW10 === 4, String(rowsW10));
const gateCells = await page.locator(".w10-corridor-mark small").allInnerTexts();
ok("W10⑥ 闸的裁决无「拦」", gateCells.every((c) => !c.includes("拦")), gateCells.join("/"));
ok(
  "W10⑥ 单元格只显示检查结果或范围边界",
  gateCells.length === 12 && gateCells.every((c) => c.trim() === "检查通过" || c.trim() === "不在检查范围"),
  [...new Set(gateCells.map((c) => c.trim()))].join("|"),
);
// 新判据：结论要由版面承载。四条轨迹线各自完整贯穿整条通道，
// 「零命中」因此是量出来的图形事实，不是标题里的一句话。
const tracks = await page.evaluate(() =>
  [...document.querySelectorAll(".w10-corridor-row")].map((row) => {
    const track = row.querySelector(".w10-corridor-track");
    const line = row.querySelector(".w10-corridor-line");
    if (!track || !line) return 0;
    const t = track.getBoundingClientRect();
    const l = line.getBoundingClientRect();
    return t.width > 0 ? l.width / t.width : 0;
  }),
);
ok(
  "W10⑥ 四条轨迹都完整贯穿（没有一条被闸截断）",
  tracks.length === 4 && tracks.every((r) => r > 0.98),
  tracks.map((r) => r.toFixed(2)).join("/"),
);
const catchers = await page.locator(".w10-corridor-catch").allInnerTexts();
ok(
  "W10⑥ 抓到者分布 事前推理/自查/review 各一",
  ["事前推理", "配置逐行核对", "review"].every((c) => catchers.join("|").includes(c)),
  catchers.join("|"),
);
ok("W10⑥ 良性那条单列", (await page.locator(".w10-corridor-row.benign").count()) === 1);
// 三条真实缺陷的机制都必须在页面上写出来，不能只给结论
ok("W10⑥ location 指令族屏蔽", w10t.includes("不会继承上层同指令族"));
ok("W10⑥ log_format 需要被引用", w10t.includes("只定义格式模板"));
ok("W10⑥ redact 只认对象路径", w10t.includes("只处理对象路径"));
ok("W10⑥ 查询串泄漏需双向修复", w10t.includes("catch-all 改用不含查询串的 req.path") && w10t.includes("消息参数改为不含请求原文"));
ok("W10⑥ 三道灯的盲区卡片", (await page.locator(".w10-gate-grid article").count()) === 3);

// D2. ① 盲区：空轨道必须真的在页面上
await goW10("blindspot");
await revealAll();
w10t = await bodyText();
ok("W10① 四个终局", (await page.locator(".w10-ending").count()) === 4);
const emptyAfter = await page.locator(".w10-track.after.empty").count();
ok("W10① 改造后仍空的恰好一格", emptyAfter === 1, String(emptyAfter));
// 新判据：行首合计必须与该行画出来的实心格数一致，否则数字与图会各说各话
const rowTotals = await page.locator(".w10-grid-rowhead b").allInnerTexts();
const beforeFilled = await page.locator(".w10-track.before.has").count();
const afterFilled = await page.locator(".w10-track.after.has").count();
ok(
  "W10① 行首合计与实心格数一致",
  rowTotals.join("|") === `${beforeFilled}/4|${afterFilled}/4`,
  `${rowTotals.join("|")} vs ${beforeFilled}/${afterFilled}`,
);
ok("W10① 空格是分工不是漏洞", w10t.includes("分清日志归属"));
ok("W10① 断连改造前一条都不留", w10t.includes("一条日志都不留"));
ok("W10① 两种「查不到」", (await page.locator(".w10-branch-list li").count()) === 2);
ok("W10① local 前缀自解释", w10t.includes("local-"));
ok("W10① 验证方法本身可能失效", w10t.includes("验证方法失效"));
// 证据强度不到实测的那两格必须把差在哪写出来，不能只靠档位标签一个词带过
const caveats = await page.locator(".w10-ending-caveat").count();
ok("W10① 未实测的格子写清证据差在哪", caveats === 2, String(caveats));
ok("W10① 至少一格是已拍板不是已实测", w10t.includes("已拍板"));

// D3. 档位：每条事实都挂了标签，且板头计数与数据一致
for (const topic of W10_TOPICS) {
  await goW10(topic);
  await revealAll();
  const chips = await page.locator(`.w10-board .w10-grade-chip`).count();
  // 图例本身有三枚（三档各一），事实节点的标签必须在此之外
  ok(`W10 档位-${topic} 事实节点带标签`, chips > 3, String(chips));
  const labels = await page.locator(".w10-board .w10-grade-chip").allInnerTexts();
  ok(
    `W10 档位-${topic} 只用三档`,
    labels.every((l) => ["已实测", "已拍板", "待做"].includes(l.trim())),
    [...new Set(labels.map((l) => l.trim()))].join("|"),
  );
}
const countText = await page.locator(".w10-grade-count").innerText();
ok("W10 板头计数三档齐", /已实测/.test(countText) && /已拍板/.test(countText) && /待做/.test(countText), countText);

// D4. 阶段进度：已落地的按已落地呈现，没做的那块必须仍然写着待做
const stageDone = await page.locator(".w10-stage-list li.done").count();
const stageTodo = await page.locator(".w10-stage-list li.todo").count();
ok("W10 阶段 8 已落地 / 0 待做", stageDone === 8 && stageTodo === 0, `${stageDone}/${stageTodo}`);

// D3b. ③ 日志旅程：计数单位从 server 块变成反代 location，是这块的一眼结论
await goW10("journey");
await revealAll();
w10t = await bodyText();
const hookCounts = await page.locator(".w10-hook-head b").allInnerTexts();
const hookSum = hookCounts.reduce((n, c) => n + Number(c), 0);
ok("W10③ 四份 site 挂点合计 9", hookCounts.length === 4 && hookSum === 9, hookCounts.join("+"));
ok("W10③ 改漏一处会变 local-", w10t.includes("local-"));
// 新判据：「串起两条流的只有这一根 id」必须是画出来的——竖线覆盖泳道全高
const thread = await page.evaluate(() => {
  const body = document.querySelector(".w10-swim-body");
  if (!body) return null;
  const line = getComputedStyle(body, "::before");
  const steps = body.querySelectorAll(".w10-swim-step");
  const lanes = new Set([...steps].map((el) => (el.className.match(/lane-\w+/) ?? [""])[0]));
  return { hasLine: line.content !== "none", steps: steps.length, lanes: lanes.size };
});
ok(
  "W10③ 两条泳道 + 一根贯穿的 id 线",
  thread !== null && thread.hasLine && thread.steps === 4 && thread.lanes === 2,
  JSON.stringify(thread),
);
ok("W10③ 交叉点单独标出来", (await page.locator(".w10-swim-cross").count()) === 1);
ok("W10③ 三样都是两套", (await page.locator(".w10-twosets .w10-matrix tbody tr").count()) === 3);
ok("W10③ 时间口径明确", w10t.includes("Nginx 的 +08:00 偏移") && w10t.includes("Node 的 UTC Z"));
ok("W10③ 两个耗时不是一个数", (await page.locator(".w10-duration li").count()) === 2);
ok("W10③ 验证⑤ 只能在服务器内跑", w10t.includes("必须在服务器内跑"));

// D3c. ② 字段兑现核对：两个方向都要看——没缩水，也没加码
await goW10("fields");
await revealAll();
w10t = await bodyText();
const fieldRows = await page.locator(".w10-field-table tbody tr").count();
ok("W10② 契约十行", fieldRows === 11, String(fieldRows));
const miss = await page.locator(".w10-field-table td.miss").count();
ok("W10② 两个可选未实现且标出来", miss === 2, String(miss));
// 新判据：兑现与否由连线承载——接上的实线圆点 9 条，断开的虚线 ✕ 2 条
const linked = await page.locator(".w10-link.linked").count();
const broken = await page.locator(".w10-link.broken").count();
ok("W10② 连线 9 接上 / 2 断开", linked === 9 && broken === 2, `${linked}/${broken}`);
ok("W10② 必有与可选字段分开核对", w10t.includes("必有字段一次上线全部到位") && w10t.includes("两个可选字段未实现符合约定"));
ok("W10② 实测多出 level", w10t.includes("level"));
ok("W10② 四道闸按强制力", (await page.locator(".w10-gate-ladder li").count()) === 4);
// 本块最反直觉的一条：真正挡住密码的不是配了一整页的那道
ok("W10② redact 五条路径今天没被触发", w10t.includes("五条路径均未触发"));
ok("W10② 查询串泄漏两处均修复", w10t.includes("404 构造") && w10t.includes("错误输出"));

// D3d. ④ 阈值尺：红线的位置是量出来的，不是画着好看的
await goW10("thresholds");
await revealAll();
w10t = await bodyText();
ok("W10④ 四条尺", (await page.locator(".w10-ruler").count()) === 4);
ok("W10④ 其中一条不是告警线是硬上限", (await page.locator(".w10-ruler.kind-cap").count()) === 1);
// 新判据（几何 × 数字）：每条告警尺上，红线标记的位置必须等于
// 「红线值 ÷ 今天实测值」。图和标签各说各话时这条会响——
// 比如把红线的数字改了却没改位置，或者反过来。
const rulerGeom = await page.evaluate(() =>
  [...document.querySelectorAll(".w10-ruler.kind-alarm")].map((card) => {
    const track = card.querySelector(".w10-ruler-track");
    const mark = card.querySelector(".w10-ruler-mark");
    const num = (el) => Number((el?.textContent ?? "").replace(/[^\d.]/g, ""));
    if (!track || !mark) return { drawn: -1, fromNumbers: -2 };
    const t = track.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    return {
      drawn: t.width > 0 ? (m.left - t.left) / t.width : -1,
      fromNumbers: num(card.querySelector(".w10-ruler-redline")) / num(card.querySelector(".w10-ruler-current")),
    };
  }),
);
ok(
  "W10④ 红线位置 = 红线值 ÷ 实测值（三条尺）",
  rulerGeom.length === 3 && rulerGeom.every((r) => Math.abs(r.drawn - r.fromNumbers) < 0.02),
  rulerGeom.map((r) => `${r.drawn.toFixed(3)}vs${r.fromNumbers.toFixed(3)}`).join("/"),
);
// 动作时间那一段（红线到今天）必须比危险段长——四条红线没有一条贴着出事点
const margins = await page.evaluate(() =>
  [...document.querySelectorAll(".w10-ruler.kind-alarm")].map((card) => {
    const track = card.querySelector(".w10-ruler-track");
    const margin = card.querySelector(".w10-ruler-margin");
    if (!track || !margin) return 0;
    return margin.getBoundingClientRect().width / track.getBoundingClientRect().width;
  }),
);
ok(
  "W10④ 三条尺的动作时间段都超过一半",
  margins.length === 3 && margins.every((m) => m > 0.5),
  margins.map((m) => m.toFixed(2)).join("/"),
);
// 谁在盯 / 红过没有：三条有人盯且红过，硬上限那条两格都是「没有」
const watchOn = await page.locator(".w10-ruler-watch p.on").count();
const watchOff = await page.locator(".w10-ruler-watch p.off").count();
ok("W10④ 三条有人盯且红过 / 一条两格皆无", watchOn === 6 && watchOff === 2, `${watchOn}/${watchOff}`);
ok("W10④ 告警线不定在故障点上", w10t.includes("条告警线设置在故障点"));
ok("W10④ 翻档依赖红态证据", w10t.includes("分别经过红态触发与恢复验证"));

// D3e. ⑦ 红过才算数：每一行中间那一格必须是红的
await goW10("redproof");
await revealAll();
w10t = await bodyText();
const chainRows = await page.locator(".w10-chain-row").count();
const chainCells = await page.locator(".w10-chain-cell").count();
ok("W10⑦ 五条链各三格", chainRows === 5 && chainCells === chainRows * 3, `${chainRows}/${chainCells}`);
// 新判据：红格的位置就是结论。每行必须是 绿-红-绿，缺中间那一格 = 这一项没红过。
const chainShapes = await page.evaluate(() =>
  [...document.querySelectorAll(".w10-chain-row")].map((row) =>
    [...row.querySelectorAll(".w10-chain-cell")]
      .map((c) => (c.classList.contains("red") ? "红" : "绿"))
      .join(""),
  ),
);
ok(
  "W10⑦ 每一行都是 绿红绿（没有只剩绿态的行）",
  chainShapes.length === 5 && chainShapes.every((sh) => sh === "绿红绿"),
  chainShapes.join("|"),
);
// 报红必须带下一步动作，一条都不能少
const actions = await page.locator(".w10-chain-action").count();
ok("W10⑦ 每个红格下面都挂着下一步做什么", actions === chainRows, String(actions));
// 弄红作用在哪一环：最右那一列（真造资源条件）整列空着，是与 D4 的分工线
const leverCols = await page.evaluate(() => {
  const grid = document.querySelector(".w10-lever-grid");
  if (!grid) return null;
  const cols = grid.querySelectorAll(".w10-lever-head").length;
  const cells = [...grid.querySelectorAll(".w10-lever-cell")];
  const lastColOn = cells.filter((c, i) => i % cols === cols - 1 && c.classList.contains("on")).length;
  return { cols, on: cells.filter((c) => c.classList.contains("on")).length, lastColOn };
});
ok(
  "W10⑦ 五个实心点，最右一列一个都没有",
  leverCols !== null && leverCols.on === 5 && leverCols.lastColOn === 0,
  JSON.stringify(leverCols),
);
ok("W10⑦ D3 未使用真实资源故障", w10t.includes("D3 的五条红态证据均未注入真实资源故障"));
// 频率与身份：四个 unit，其中拍板与实际对不上的那一行要被标出来并挂待做
ok("W10⑦ 四个 unit 一行一个", (await page.locator(".w10-units .w10-matrix tbody tr").count()) === 4);
// 频率与身份：四个 unit。曾对不上的那一行（cert）仍在教学区单独说明，但已通过验收——
// 验收的证据是表格里不再有「未实现」行、且教学区出现「已核对」块（含核对证据）。
ok("W10⑦ 未核对教学块不存在", (await page.locator(".w10-mismatch:not(.ok)").count()) === 0);
ok("W10⑦ 已核对的那一行单独说明", (await page.locator(".w10-mismatch.ok").count()) === 1);
ok("W10⑦ 已核对行挂了已实测档位", (await page.locator(".w10-units .w10-matrix tr", { hasText: "check-cert" }).locator(".w10-grade-chip.measured").count()) === 1);
ok("W10⑦ 核对后不再有未实现行", (await page.locator(".w10-units .w10-matrix tr.unimpl").count()) === 0);
ok("W10⑦ 排程修正证据可见", w10t.includes("systemd-analyze calendar --iterations=3") && w10t.includes("验证证据"));
ok("W10⑦ 两种「监控自己挂了」", (await page.locator(".w10-selfwatch-list li").count()) === 2);
ok("W10⑦ 检查未运行有独立信号", w10t.includes("排程状态、失败状态与日志确认检查是否运行"));
ok("W10⑦ 绿时也打一行", w10t.includes(GREEN_LINE_HINT));
ok("W10⑦ 工具踩点五条", (await page.locator(".w10-gotcha-list li").count()) === 5);

// D3f. ⑤ 演练分档与定位：这块板的三处结论全部由版面承载，断言量的就是这三张图
await goW10("drill");
await revealAll();
w10t = await bodyText();
// 分档矩阵：四类各占一格，最右那一列（必须隔离）整列空着
const tierCols = await page.evaluate(() => {
  const grid = document.querySelector(".w10-tier-grid");
  if (!grid) return null;
  const cols = grid.querySelectorAll(".w10-tier-head").length;
  const cells = [...grid.querySelectorAll(".w10-tier-cell")];
  const marked = (c) => c.classList.contains("on") || c.classList.contains("stood-in");
  return {
    cols,
    rows: cells.length / cols,
    marked: cells.filter(marked).length,
    lastCol: cells.filter((c, i) => i % cols === cols - 1 && marked(c)).length,
  };
});
ok(
  "W10⑤ 四类各落一档，C 档整列空着",
  tierCols !== null && tierCols.cols === 3 && tierCols.rows === 4 && tierCols.marked === 4 && tierCols.lastCol === 0,
  JSON.stringify(tierCols),
);
// 断言只钉「准入规则存在且理由是写不出回滚命令」这个稳定事实，不钉整句措辞——
// 8/22 把孤立的「本周」改成「W10 周内」时，原来钉死整句的写法当场报红。
ok(
  "W10⑤ 空列是主动收窄不是没做完",
  w10t.includes("写不出回滚命令的那一类") && /W10 周内不做|本周不做/.test(w10t),
);
// 预测 vs 实测：三类各一根连线，断掉的两根就是「预测被推翻」
const drillCards = await page.locator(".w10-drill-card").count();
const linkedDrill = await page.locator(".w10-drill-card .w10-link.linked").count();
const brokenDrill = await page.locator(".w10-drill-card .w10-link.broken").count();
ok(
  "W10⑤ 三类各一根连线，断两根",
  drillCards === 3 && linkedDrill === 1 && brokenDrill === 2,
  `${drillCards}/${linkedDrill}/${brokenDrill}`,
);
// 根因分三层，三类一类不少；其中一类的根因还挂着待做（读代码是明天的事）
ok("W10⑤ 三类都拆了根因三层", (await page.locator(".w10-cause").count()) === 3);
ok(
  "W10⑤ 有一类的根因仍是待做",
  (await page.locator(".w10-cause .w10-grade-chip.pending").count()) === 1,
  String(await page.locator(".w10-cause .w10-grade-chip.pending").count()),
);
// ⑤·2：检查表态与定位信号另起一页
await goW10("drill-signals");
await revealAll();
w10t = await bodyText();
// 检查表态矩阵：实测那一层一个红点都没有，而预测层有两个
const cvGeom = await page.evaluate(() => {
  const cells = [...document.querySelectorAll(".w10-cv-cell")];
  const count = (sel, cls) => cells.filter((c) => c.querySelector(sel)?.classList.contains(cls)).length;
  return {
    cells: cells.length,
    predRed: count(".w10-cv-mark.predicted", "red"),
    actualRed: count(".w10-cv-mark.actual", "red"),
    untested: count(".w10-cv-mark.actual", "untested"),
    diff: cells.filter((c) => c.classList.contains("diff")).length,
    owed: cells.filter((c) => c.classList.contains("owed")).length,
  };
});
ok(
  "W10⑤ 十二格里实测层零个红点（预测层两个）",
  cvGeom.cells === 12 && cvGeom.predRed === 2 && cvGeom.actualRed === 0 && cvGeom.untested === 4,
  JSON.stringify(cvGeom),
);
// 预测错的一格与还欠着实测的四格，是两种不同的缺口，图上必须分得开
ok("W10⑤ 预测错的一格与欠实测的四格分开标", cvGeom.diff === 1 && cvGeom.owed === 4, `${cvGeom.diff}/${cvGeom.owed}`);
ok("W10⑤ 真实故障不一定触发红色结果", w10t.includes("真实故障不一定触发红色结果"));
// 三信号：九次判决里指对方向的两次，必须落在同一行（同一把刀）
const signalGeom = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".w10-signal-list > li")];
  return rows.map((r) => ({
    hit: r.querySelectorAll(".w10-signal-call.hit").length,
    wrong: r.querySelectorAll(".w10-signal-call.wrong").length,
    calls: r.querySelectorAll(".w10-signal-call").length,
  }));
});
ok(
  "W10⑤ 三信号 × 三类共九格，指对方向两格且同一行",
  signalGeom.length === 3 &&
    signalGeom.every((r) => r.calls === 3) &&
    signalGeom.filter((r) => r.hit > 0).length === 1 &&
    signalGeom.reduce((n, r) => n + r.hit, 0) === 2 &&
    signalGeom.reduce((n, r) => n + r.wrong, 0) === 1,
  JSON.stringify(signalGeom),
);
// ⑤·3：盲区与收尾另起一页
await goW10("drill-blinds");
await revealAll();
w10t = await bodyText();
// 三个盲区：两个实现缺陷 + 一个分工，分类不能被抹平
ok("W10⑤ 三个盲区", (await page.locator(".w10-blind").count()) === 3);
ok("W10⑤ 其中一个是分工不是缺陷", (await page.locator(".w10-blind.kind-scope").count()) === 1);
ok("W10⑤ 每个盲区都写了去哪", (await page.locator(".w10-blind-goes").count()) === 3);
// 演练做完不算完：残留逐条核零
ok("W10⑤ 残留核零五条", (await page.locator(".w10-closeout-residue li").count()) === 5);
ok("W10⑤ 注入命令不给可复制的整条", !w10t.includes("fallocate") && !w10t.includes("pkill"));

/* D4d. ⑧ 收口日的三页（2026-08-21 建成的第八块）。
   同 ⑥ 的口径：断言量的是**图形事实**，不是页面上有没有某句话——
   两支上各落几类、断口有没有接到补位信号、轨道上有没有出现「翻笔记」这种记号、
   两条收尾的轨道是不是一样长而终点不一样。 */

// ⑧·1 通用首查：一个判定点、两支，三类各自落位，落不进任何一支的那一类画成断点
await goW10("runbook");
await revealAll();
w10t = await bodyText();
const cutGeom = await page.evaluate(() => {
  const branches = [...document.querySelectorAll(".w10-cut-branch")];
  return {
    probes: document.querySelectorAll(".w10-cut-probe").length,
    branches: branches.length,
    perBranch: branches.map((b) => ({
      id: (String(b.className).match(/branch-(\w+)/) ?? [])[1] ?? "?",
      landings: b.querySelectorAll(".w10-cut-landings > li").length,
      miss: b.querySelectorAll(".w10-cut-landings > li.miss").length,
      standIn: b.querySelectorAll(".w10-cut-standin").length,
    })),
  };
});
ok(
  "W10⑧ 一个判定点分两支，三类各自落位",
  cutGeom.probes === 1 &&
    cutGeom.branches === 2 &&
    cutGeom.perBranch.reduce((n, b) => n + b.landings, 0) === 3,
  JSON.stringify(cutGeom),
);
// 断口恰好一个，且它所在的那一支必须接着补位信号——否则「劈不中」就成了一句没有下文的话
const missBranch = cutGeom.perBranch.find((b) => b.miss > 0);
ok(
  "W10⑧ 断口恰好一个且接了补位信号",
  cutGeom.perBranch.reduce((n, b) => n + b.miss, 0) === 1 &&
    missBranch !== undefined &&
    missBranch.standIn === 1 &&
    cutGeom.perBranch.filter((b) => b.standIn > 0).length === 1,
  JSON.stringify(cutGeom.perBranch),
);
ok("W10⑧ 五列齐全是数出来的", w10t.includes("格五列齐全"));
ok("W10⑧ 速查表留在 runbook 不复制到板上", w10t.includes("板上不复制"));
ok("W10⑧ 第二刀分全挂与单面挂", (await page.locator(".w10-cut-second-grid p").count()) === 2);

// ⑧·2 盲测：两条轨道贯到最后一段，而「翻笔记」这种记号一次都没有出现
await goW10("runbook-selftest");
await revealAll();
w10t = await bodyText();
const runGeom = await page.evaluate(() => {
  const runs = [...document.querySelectorAll(".w10-run")];
  return runs.map((r) => {
    const steps = [...r.querySelectorAll(".w10-run-step")];
    return {
      steps: steps.length,
      evidence: steps.filter((s) => s.classList.contains("mark-evidence")).length,
      back: steps.filter((s) => s.classList.contains("mark-back")).length,
      wrong: steps.filter((s) => s.classList.contains("mark-wrong")).length,
      flip: steps.filter((s) => s.classList.contains("mark-flip")).length,
      last: steps.at(-1)?.querySelector("b")?.textContent?.trim() ?? "",
    };
  });
});
ok(
  "W10⑧ 两条轨道，都走到「回基线」那一段",
  runGeom.length === 2 && runGeom.every((r) => r.steps === 5 && r.last === "回基线"),
  JSON.stringify(runGeom),
);
// 这一条是本页的结论本身：翻笔记的记号一个都没有，而它是从类名数出来的，不是标题里的一句话
ok(
  "W10⑧ 轨道上零个翻笔记记号",
  runGeom.reduce((n, r) => n + r.flip, 0) === 0,
  JSON.stringify(runGeom.map((r) => r.flip)),
);
// 折返只发生在一类上（触止步 → 止损 → 重来），另一类是直的——差别由位置承担
ok(
  "W10⑧ 折返恰好一次且只在一条轨道上",
  runGeom.filter((r) => r.back > 0).length === 1 && runGeom.reduce((n, r) => n + r.back, 0) === 1,
  JSON.stringify(runGeom.map((r) => r.back)),
);
ok("W10⑧ 卡住的那一句判定为不回填", w10t.includes("不回填 runbook"));
ok("W10⑧ 逐步留痕的缺口写在正面", w10t.includes("没有逐步留痕"));

// ⑧·3 两条收尾：轨道一样长，终点不一样——断掉的那条最后一段连线是虚的
await goW10("runbook-strength");
await revealAll();
w10t = await bodyText();
const strengthGeom = await page.evaluate(() => {
  const tracks = [...document.querySelectorAll(".w10-strength-track")];
  return tracks.map((t) => {
    const items = [...t.querySelectorAll("li")];
    return {
      end: (String(t.className).match(/end-(\w+)/) ?? [])[1] ?? "?",
      steps: items.length,
      broken: items.filter((li) => li.classList.contains("broken")).length,
      brokenIsLast: items.length > 0 && items.at(-1).classList.contains("broken"),
    };
  });
});
ok(
  "W10⑧ 两条收尾一样长（各四段），一条走满一条断在最后一段",
  strengthGeom.length === 2 &&
    strengthGeom.every((t) => t.steps === 4) &&
    strengthGeom.filter((t) => t.end === "measured").length === 1 &&
    strengthGeom.filter((t) => t.end === "pending").length === 1 &&
    strengthGeom.reduce((n, t) => n + t.broken, 0) === 1 &&
    strengthGeom.find((t) => t.broken > 0)?.brokenIsLast === true,
  JSON.stringify(strengthGeom),
);
// 那一段区间：同一个落点在两把尺上必须落在同一个位置，否则「两把尺读同一个数」不成立
const bandGeom = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".w10-band-row")];
  return rows.map((r) => {
    const track = r.querySelector(".w10-band-track").getBoundingClientRect();
    const dot = r.querySelector("i.w10-band-dot").getBoundingClientRect();
    const fill = r.querySelector(".w10-band-fill").getBoundingClientRect();
    return {
      verdict: (String(r.className).match(/verdict-(\w+)/) ?? [])[1] ?? "?",
      dotPct: Math.round(((dot.left + dot.width / 2 - track.left) / track.width) * 1000) / 10,
      fillFrom: Math.round(((fill.left - track.left) / track.width) * 1000) / 10,
      fillTo: Math.round(((fill.right - track.left) / track.width) * 1000) / 10,
      read: r.querySelector(".w10-band-read b")?.textContent?.trim() ?? "",
    };
  });
});
ok(
  "W10⑧ 两把尺，同一个落点位置相同",
  bandGeom.length === 2 && Math.abs(bandGeom[0].dotPct - bandGeom[1].dotPct) < 0.5,
  JSON.stringify(bandGeom.map((b) => b.dotPct)),
);
// 落点必须落在那一段区间里面（止步线与红线之间），不然这张图讲的就不是同一件事
ok(
  "W10⑧ 落点落在止步线与红线之间",
  bandGeom.every((b) => b.dotPct > b.fillFrom && b.dotPct < b.fillTo),
  JSON.stringify(bandGeom),
);
ok(
  "W10⑧ 同一段区间，两套判据两个结论",
  bandGeom.map((b) => `${b.verdict}:${b.read}`).join("|") === "green:绿|red:红",
  bandGeom.map((b) => `${b.verdict}:${b.read}`).join("|"),
);
ok("W10⑧ 当前仍守住生产未注入边界", w10t.includes("0") && w10t.includes("生产同类注入"));
ok("W10⑧ 8/21 暂停理由作为历史保留", w10t.includes("W10 当时的修复方向") && w10t.includes("机制没复现之前不动手"));


// D5. 每块板的最低体检（与 W9 同一组判据，换个板根）
for (const topic of W10_TOPICS) {
  await goW10(topic);
  await revealAll();
  const text = await bodyText();

  const plain = await page.evaluate(() => {
    const root = document.querySelector(".w10-board") ?? document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("pre, code").forEach((n) => n.remove());
    return clone.innerText;
  });
  ok(`W10 残留-${topic} 无 ** 加粗`, !plain.includes("**"));
  ok(`W10 残留-${topic} 无反引号`, !plain.includes("`"));

  const white = await page.evaluate(() => {
    const luminance = (color) => {
      const n = color.match(/[\d.]+/g);
      if (!n) return null;
      return 0.2126 * Number(n[0]) + 0.7152 * Number(n[1]) + 0.0722 * Number(n[2]);
    };
    const effectiveBg = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const parts = bg.match(/[\d.]+/g);
        if (parts && (parts.length < 4 || Number(parts[3]) > 0.5)) return bg;
      }
      return "rgb(255, 255, 255)";
    };
    const bad = [];
    document.querySelectorAll(".w10-board *").forEach((el) => {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (getComputedStyle(el).color !== "rgb(255, 255, 255)") return;
      const lum = luminance(effectiveBg(el));
      if (lum !== null && lum >= 200) bad.push(el.className || el.tagName);
    });
    return bad.slice(0, 3);
  });
  ok(`W10 白字-${topic}`, white.length === 0, white.join("|"));

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`W10 溢出-${topic} 桌面`, overflow <= 0, `+${overflow}px`);
  ok(`W10 文本-${topic} 非空壳`, text.length > 400, String(text.length));

  // 正文不许掉进元信息梯子（同 B2 第 3 条，换个板根）
  const sunk = await page.evaluate(() => {
    const out = [];
    const walk = (el) => {
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
      if (own && cs.display !== "none" && el.getBoundingClientRect().height > 0) {
        if (["P", "LI", "DD"].includes(el.tagName) && parseFloat(cs.fontSize) < 12) {
          out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}:${cs.fontSize}`);
        }
      }
      for (const c of el.children) walk(c);
    };
    const root = document.querySelector(".w10-board");
    if (root) walk(root);
    return [...new Set(out)];
  });
  ok(`W10 正文-${topic} 桌面 ≥12px`, sunk.length === 0, sunk.slice(0, 3).join("|"));
}

// D6. 手机档：溢出与触控目标
await page.setViewportSize({ width: 390, height: 844 });
for (const topic of W10_TOPICS) {
  await goW10(topic);
  await revealAll();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`W10 溢出-${topic} 移动`, overflow <= 0, `+${overflow}px`);
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".w10-board button, .w10-board summary").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.width < 24 || r.height < 24) bad.push(`${el.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return bad.slice(0, 3);
  });
  ok(`W10 触控-${topic} 移动 ≥24px`, small.length === 0, small.join("|"));
}

await page.setViewportSize({ width: 1440, height: 1000 });

/* ================================ E. W2 服务端架构板（2026-08-22）

   同一组类别性断言（Markdown 残留 / 白字 / 溢出 / 空壳 / 触控 / 正文下限由 B3 覆盖），
   外加三条本板专属的：
     · 六块内容都渲染得出来      —— 数据文件加一块而 Showcase 的分支没跟上时，
                                    页面会静默落到最后一个分支，截图很难看出来
     · 错误矩阵七行都在          —— 这块板的结论就是「哪一层翻译哪一类错误」，
                                    少一行等于少一条翻译路径
     · 三种结局的状态码都在      —— 400 / 404 / 200 是知识点 3 的验收句
*/

const ARCH_TOPICS = ["middleware", "layers", "request-shape", "two-exits", "error-map", "ownership"];

async function goArch(topic) {
  await page.goto(`${BASE}/#/showcase?mode=review&tab=architecture&topic=${topic}`, {
    waitUntil: "networkidle",
  });
  // 复习态整页先关着；本板的揭示按钮有三种（专题门、纠错逐条、逐层显示）。
  for (let i = 0; i < 12; i++) {
    const btns = page.locator(
      ".arch-board .w5-recall-gate button, .arch-board .arch-correction > button, " +
        ".arch-board .arch-correction-item button, .arch-board .arch-chain-prompt button",
    );
    if ((await btns.count()) === 0) break;
    await btns.first().click();
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.waitForTimeout(200);
}

await page.setViewportSize({ width: 1440, height: 1000 });
for (const topic of ARCH_TOPICS) {
  await goArch(topic);
  const text = await bodyText();
  ok(`架构板-${topic} 渲染出板根`, (await page.locator(".arch-board").count()) === 1);
  ok(`文本-架构板-${topic} 非空壳`, text.length > 400, String(text.length));

  const plain = await page.evaluate(() => {
    const root = document.querySelector(".arch-board");
    if (!root) return "";
    const clone = root.cloneNode(true);
    clone.querySelectorAll("pre, code").forEach((n) => n.remove());
    return clone.innerText;
  });
  ok(`残留-架构板-${topic} 无 ** 加粗`, !plain.includes("**"));
  ok(`残留-架构板-${topic} 无反引号`, !plain.includes("`"));

  const white = await page.evaluate(() => {
    const luminance = (color) => {
      const n = color.match(/[\d.]+/g);
      if (!n) return null;
      return 0.2126 * Number(n[0]) + 0.7152 * Number(n[1]) + 0.0722 * Number(n[2]);
    };
    const effectiveBg = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const parts = bg.match(/[\d.]+/g);
        if (parts && (parts.length < 4 || Number(parts[3]) > 0.5)) return bg;
      }
      return "rgb(255, 255, 255)";
    };
    const bad = [];
    document.querySelectorAll(".arch-board *").forEach((el) => {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (getComputedStyle(el).color !== "rgb(255, 255, 255)") return;
      const lum = luminance(effectiveBg(el));
      if (lum !== null && lum >= 200) bad.push(el.className || el.tagName);
    });
    return bad.slice(0, 3);
  });
  ok(`白字-架构板-${topic}`, white.length === 0, white.join("|"));

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`溢出-架构板-${topic} 桌面`, overflow <= 0, `+${overflow}px`);
}

// 本板专属：三条内容断言
await goArch("error-map");
const archErrText = await bodyText();
ok(
  "架构板 错误矩阵七行",
  (await page.locator(".arch-errormap-row").count()) === 7,
  String(await page.locator(".arch-errormap-row").count()),
);
for (const label of ["EmailConflictError", "UserValidationError", "AuthorizationError", "E11000"]) {
  ok(`架构板 错误矩阵含 ${label}`, archErrText.includes(label));
}
// 两层防线：应用层与数据库层必须同时在场，只留一层等于把 E11000 说成校验错误
ok("架构板 两层防线两块都在", (await page.locator(".arch-defense-pair article").count()) === 2);

await goArch("request-shape");
const archChainText = await bodyText();
const archChainAllText = await page.locator(".arch-chain").textContent();
ok("架构板 七条泳道都渲染", (await page.locator(".arch-flow-lane").count()) === 7);
ok(
  "架构板 请求回程经过 Mongoose",
  archChainAllText.includes("Mongoose") && archChainAllText.includes("User document") && archChainAllText.includes("findById()"),
);
ok("架构板 请求回程经过 repository", archChainText.includes("repository 再把该值交回 service"));
ok("架构板 请求轨道有结论锚", (await page.locator('[data-anchor="w2-request-return"]').count()) === 1);
// 令牌必须真的落在某条泳道上：图形承载「当前这一跳携带什么」，掉了就只剩解说文字
ok("架构板 令牌在场", (await page.locator(".arch-flow-token").count()) === 1);
// 走过的轨道要着色——「下行到底再原路返回」这件事在静止截图上也得看得出来
const litRails = await page.evaluate(() => document.querySelectorAll(".arch-flow-rail.on").length);
ok("架构板 走过的轨道已着色", litRails >= 6, String(litRails));
for (const code of ["400", "404", "200"]) {
  ok(`架构板 结局含 ${code}`, archChainText.includes(code));
}

await goArch("layers");
ok("架构板 四层职责四行", (await page.locator(".arch-lane").count()) === 4);

await goArch("middleware");
// 三层同心环 + 令牌：包裹结构由几何给出，环塌掉就只剩一份文字日志
ok("架构板 洋葱三层环", (await page.locator(".arch-onion-ring").count()) === 3);
ok("架构板 洋葱令牌在场", (await page.locator(".arch-onion-token").count()) === 1);
const ringBoxes = await page.evaluate(() =>
  [...document.querySelectorAll(".arch-onion-ring")].map((el) => Math.round(el.getBoundingClientRect().width)),
);
ok("架构板 洋葱环逐层内缩", ringBoxes.length === 3 && ringBoxes[0] > ringBoxes[1] && ringBoxes[1] > ringBoxes[2], ringBoxes.join("|"));
const middlewareText = await bodyText();
ok("架构板 同步栈不外推异步完成", middlewareText.includes("不能外推") && middlewareText.includes("finish") && middlewareText.includes("close"));
ok("架构板 同步栈有结论锚", (await page.locator('[data-anchor="w2-sync-stack"]').count()) === 1);

await goArch("ownership");
const ownershipText = await bodyText();
ok("架构板 role-only 差异已显式标出", ownershipText.includes("{ role: 'admin' }") && ownershipText.includes("过滤前"));

await goArch("error-map");
// 汇聚到唯一出口再扇出：中间那个 hub 只能有一个，出口按状态码去重后是五个
ok("架构板 错误唯一出口", (await page.locator(".arch-efunnel-hub").count()) === 1);
ok("架构板 状态码扇出五格", (await page.locator(".arch-efunnel-exit").count()) === 5, String(await page.locator(".arch-efunnel-exit").count()));

// 移动视口：六块过一遍溢出与触控目标
await page.setViewportSize({ width: 390, height: 844 });
for (const topic of ARCH_TOPICS) {
  await goArch(topic);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`溢出-架构板-${topic} 移动`, overflow <= 0, `+${overflow}px`);
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".arch-board button, .arch-board summary").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.width < 24 || r.height < 24) bad.push(`${el.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return bad.slice(0, 3);
  });
  ok(`触控-架构板-${topic} 移动 ≥24px`, small.length === 0, small.join("|"));
}

/* ============ F. 数据库板上的 W1 三块（建模 / 最左前缀 / 覆盖查询，2026-08-22） */

async function goDb(topic) {
  await page.goto(`${BASE}/#/showcase?mode=review&tab=database&topic=${topic}`, {
    waitUntil: "networkidle",
  });
  for (let i = 0; i < 8; i++) {
    const btns = page.locator(".w5-board .w5-recall-gate button, .w5-board .w3-pipeline-prompt button");
    if ((await btns.count()) === 0) break;
    await btns.first().click();
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.waitForTimeout(200);
}

await page.setViewportSize({ width: 1440, height: 1000 });
for (const [topic, selector, count] of [
  ["modeling", ".w3-modeling-decisions article", 4],
  ["prefix", ".w3-prefix-row", 3],
  ["covered", ".w3-covered-pair article", 2],
]) {
  await goDb(topic);
  ok(`W1 板块-${topic} 渲染`, (await page.locator(selector).count()) === count, String(await page.locator(selector).count()));
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`溢出-W1 板块-${topic} 桌面`, overflow <= 0, `+${overflow}px`);
}

// 聚合 pipeline：字段芯片必须真的随阶段增删，否则「阶段顺序改变数据形状」这条结论没有版面承载
await goDb("aggregation-shape");
ok("W3 聚合 六段管道轨道", (await page.locator(".w3-pipe-track li").count()) === 6);
ok("W3 聚合 前后两张文档卡", (await page.locator(".w3-doccard").count()) === 2);
// 停在 $group 那一步：应同时出现 added（新生成的聚合字段）与 dropped（消失的原订单字段）
await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".w3-pipe-track li button")];
  btns[1]?.click();
});
await page.waitForTimeout(250);
ok("W3 聚合 $group 有新增字段", (await page.locator(".w3-chip.added").count()) >= 3, String(await page.locator(".w3-chip.added").count()));
ok("W3 聚合 $group 有消失字段", (await page.locator(".w3-chip.dropped").count()) >= 3, String(await page.locator(".w3-chip.dropped").count()));

// 最左前缀那三行的扫描量差两个数量级，长度编码不能塌成等长——塌了就等于没有非文字编码。
await goDb("prefix");
const scanBars = await page.evaluate(() =>
  [...document.querySelectorAll(".w3-prefix-row .scan i")].map((el) => Math.round(el.getBoundingClientRect().width)),
);
ok("W1 最左前缀 三条扫描量长度递减", scanBars.length === 3 && scanBars[0] > scanBars[2] && scanBars[2] > scanBars[1], scanBars.join("|"));

// 口径边界：造数集合这句必须与图相邻，否则 16667 会被读成项目数据
const prefixText = await bodyText();
ok("W1 最左前缀 标注造数集合", prefixText.includes("bigdata"));
ok("W1 最左前缀 标注 50000 文档", prefixText.includes("50000"));

await goDb("covered");
const coveredText = await bodyText();
ok("W1 覆盖查询 正向 PROJECTION_COVERED", coveredText.includes("PROJECTION_COVERED"));
ok("W1 覆盖查询 反证 FETCH", coveredText.includes("FETCH"));
ok("W1 覆盖查询 不再声称最高效形态", !coveredText.includes("索引的最高效形态"));

await goDb("match-index");
const matchIndexText = await bodyText();
ok("W3 match-index 只结论扫描工作量", matchIndexText.includes("扫描工作量") && matchIndexText.includes("不是耗时证据"));
ok("W3 match-index 不再用更快验收句", !matchIndexText.includes("加索引后为什么更快"));
ok("W3 开放项无过期 Week6/Week8 未来时", !matchIndexText.includes("Week6 技术总结时") && !matchIndexText.includes("Week8 整合时"));

// 开放问题清单：覆盖查询那条已收窄为「项目集合上未验证」，不能再写成知识点本身未验证
await page.goto(`${BASE}/#/showcase?mode=review&tab=database&topic=covered`, { waitUntil: "networkidle" });
await page.waitForTimeout(200);
const dbOpenText = await bodyText();
ok("W1 覆盖查询 开放项已收窄到项目集合", dbOpenText.includes("项目集合上的覆盖查询未验证"));

await page.setViewportSize({ width: 390, height: 844 });
for (const topic of ["modeling", "prefix", "covered"]) {
  await goDb(topic);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`溢出-W1 板块-${topic} 移动`, overflow <= 0, `+${overflow}px`);
}

/* ============ I. W10 板的数据时效：可见文案里不留孤立的相对时间（2026-08-22）

   这块板是唯一一块「从落地那天起就在等着被明天检验」的板，它的失效方式不是排版
   塌了，而是**说法过期**。8/22 的时效核查抓到三类：
     · 「本周不做 / 下周复现」—— 展板跨日，读者无从判断是哪一周；且「下周」在 8/24 当天失效
     · 「前一天 / 当天」×6  —— 都在 ⑧ 收口日块里，指 D4（8/20）与 D5（8/21），
                                 读者要反推才知道是哪天
     · journald 的 248 MB 归到了「设定上限当天」—— 那是 D1（8/17）块 C 的基线，
                                 设定当天（D2 / 8/18）实测的是 272 MB
   前两类是措辞，第三类是事实归属错日。这条断言守的是前两类不再回来。

   唯一豁免：延迟自测的方法定义「隔一天：前一天真注入，第二天自测」——
   那里的「前一天 / 第二天」描述的是这个方法的间隔结构，不是某个具体日期。
*/

const W10_RELATIVE_WORDS = ["今天", "昨天", "明天", "下周", "上周", "本周", "前一天", "后一天"];
/** 方法定义，不是历史记录；它里面的相对词是结构性的。 */
const W10_RELATIVE_ALLOWED = "隔一天：前一天真注入，第二天自测";

await page.setViewportSize({ width: 1440, height: 1000 });
for (const topic of W10_TOPICS) {
  await goW10(topic);
  await revealAll();
  const text = (await bodyText()).split(W10_RELATIVE_ALLOWED).join("");
  const hits = W10_RELATIVE_WORDS.filter((w) => text.includes(w));
  ok(`时效-W10 ${topic} 无孤立相对时间`, hits.length === 0, hits.join("|"));
}

// 事实归属：248 MB 是 D1（8/17）基线，272 MB 才是设定上限当天（D2 / 8/18）的占用。
// 两个数字都要在场，且 248 不能再挂在「设定当天」名下。
await goW10("thresholds");
await revealAll();
const w10Journald = await bodyText();
ok("时效-W10 journald 基线归 D1", w10Journald.includes("D1（8/17）块 C 基线占用 248 MB"));
ok("时效-W10 journald 设定当天为 272", w10Journald.includes("8/18 设定上限当天的占用"));
ok("时效-W10 248 不再挂在设定当天", !w10Journald.includes("设定当天占用 248"));

// W10 历史 pending 不能覆盖；W11 8/27 的当前结论也不能继续被写成当前 pending。
await goW10("drill-blinds");
await revealAll();
const w10Handover = await bodyText();
ok("时效-W10 假 active 保留 8/21 历史 pending", w10Handover.includes("截至 8/21") && w10Handover.includes("机制仍待"));
ok("时效-W10 假 active 盲区卡接到 8/27 结局", w10Handover.includes("8/27 W11") && w10Handover.includes("修复上线"));

await goW10("runbook-strength");
await revealAll();
const w10FakeActiveRelay = await bodyText();
ok("时效-W10 假 active 双时点接力", (await page.locator(".w10-fakeactive-time > article").count()) === 2);
ok("时效-W10 假 active 8/27 修复证据", w10FakeActiveRelay.includes("3 个套件 9 条用例通过") && w10FakeActiveRelay.includes("修复已上线"));
ok("时效-W10 假 active 事实推断未验证分开", (await page.locator(".w10-fakeactive-grades > article").count()) === 3);
ok("时效-W10 假 active 保留生产未注入边界", w10FakeActiveRelay.includes("生产机的 3000 端口没有做同类注入"));

// 手机默认入口：当前项先出现，完整目录按需展开，证据图例落在专题正文之后。
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/#/showcase?mode=review&tab=deploy&topic=cert`, { waitUntil: "networkidle" });
await page.waitForTimeout(220);
ok("入口-W9 手机默认目录收起", !(await page.locator(".w9-topic-directory").getAttribute("open")));
const w9EntryOrder = await page.evaluate(() => {
  const current = document.querySelector(".w9-topic-current")?.getBoundingClientRect().top ?? 0;
  const directory = document.querySelector(".w9-topic-directory")?.getBoundingClientRect().top ?? 0;
  const panel = document.querySelector("#w9-topic-panel")?.getBoundingClientRect().top ?? 0;
  const legend = document.querySelector(".w9-grade-legend")?.getBoundingClientRect().top ?? 0;
  return { current, directory, panel, legend };
});
ok("入口-W9 当前项先于目录与正文", w9EntryOrder.current < w9EntryOrder.directory && w9EntryOrder.directory < w9EntryOrder.panel, JSON.stringify(w9EntryOrder));
ok("入口-W9 图例在专题之后", w9EntryOrder.panel < w9EntryOrder.legend, JSON.stringify(w9EntryOrder));

await page.goto(`${BASE}/#/showcase?mode=review&tab=observability&topic=runbook-strength`, { waitUntil: "networkidle" });
await page.waitForTimeout(220);
ok("入口-W10 手机默认目录收起", !(await page.locator(".w10-topic-directory").getAttribute("open")));
const w10EntryOrder = await page.evaluate(() => {
  const current = document.querySelector(".w10-topic-current")?.getBoundingClientRect().top ?? 0;
  const directory = document.querySelector(".w10-topic-directory")?.getBoundingClientRect().top ?? 0;
  const panel = document.querySelector("#w10-topic-panel")?.getBoundingClientRect().top ?? 0;
  const legend = document.querySelector(".w10-grade-legend")?.getBoundingClientRect().top ?? 0;
  return { current, directory, panel, legend };
});
ok("入口-W10 当前项先于目录与正文", w10EntryOrder.current < w10EntryOrder.directory && w10EntryOrder.directory < w10EntryOrder.panel, JSON.stringify(w10EntryOrder));
ok("入口-W10 图例在专题之后", w10EntryOrder.panel < w10EntryOrder.legend, JSON.stringify(w10EntryOrder));

/* ====== G. W4 认证泳道序列图与 W6 全栈轨道折返（2026-08-22 第三轮返工）

   这两块建于 8/12，属 roadmap 第八轮之前的旧口径。返工后图形承载结论，
   所以它们的几何必须有断言守着：
     · W4 七段消息各自跨的列 —— 「长期密码只在前三段、受保护请求整段停在管道列内」
                                这两句是靠箭头起止列给出的，列错了结论就反了
     · W6 轨道分两行         —— 01–07 出站、08 落到第二行，「数据回到浏览器」靠折返表达
*/

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${BASE}/#/showcase?tab=auth`, { waitUntil: "networkidle" });
await page.waitForTimeout(350);

ok("W4 泳道序列 七段消息", (await page.locator(".auth-master-sequence > li").count()) === 7);
ok("W4 总览默认收起七段详情", !(await page.locator(".auth-master-details").evaluate((el) => el.open)));
ok("W4 停止矩阵有结论锚", (await page.locator('[data-anchor="auth-stop-points"]').count()) === 1);
ok("W4 专题 tab 只有一个选中", (await page.locator('.authk-nav [role="tab"][aria-selected="true"]').count()) === 1);
ok("W4 泳道序列 四条生命线", (await page.locator(".auth-master-sequence > li").first().locator(".auth-seq-life").count()) === 4);

// 每段箭头实际跨的网格列。AUTH_CHAIN 的 from/to 是 [0,1] [1,2] [1,0] [0,3] [3,3] [3,2] [3,3]，
// 箭头按 min..max 跨列，因此期望 1-3 / 2-4 / 1-3 / 1-5 / 4-5 / 3-5 / 4-5（CSS 列号从 1 起，end 是 max+2）。
const seqSpans = await page.evaluate(() =>
  [...document.querySelectorAll(".auth-master-sequence > li .auth-seq-arrow")].map((el) => {
    const cs = getComputedStyle(el);
    return `${cs.gridColumnStart}-${cs.gridColumnEnd}`;
  }),
);
ok(
  "W4 泳道序列 箭头跨列与 from/to 一致",
  seqSpans.join("|") === "1-3|2-4|1-3|1-5|4-5|3-5|4-5",
  seqSpans.join("|"),
);
// 自环两段（validateToken / Controller）只占一列：受保护请求管道内部处理，不跨泳道
ok("W4 泳道序列 两段自环", (await page.locator(".auth-master-sequence .auth-seq-arrow.self").count()) === 2);
// 反向两段：签发 JWT（Auth Service → 客户端）与 requireRole 查库（管道 → Repository），
// 两者的接收方都在发出方左边，箭头朝左。
ok("W4 泳道序列 两段反向", (await page.locator(".auth-master-sequence .auth-seq-arrow.reverse").count()) === 2);

const authOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
ok("溢出-W4 泳道序列 桌面", authOverflow <= 0, `+${authOverflow}px`);

const registerText = await bodyText();
ok("W4 register 安全摘要归 Service", registerText.includes("Service → HTTP 层") && registerText.includes("Controller 只组织 HTTP envelope"));
await page.locator("#auth-topic-tab-login").click();
const loginText = await bodyText();
ok("W4 login 计时枚举边界常驻", loginText.includes("响应时序差异") && loginText.includes("未闭合边界"));

await page.goto(`${BASE}/#/showcase?tab=testing&topic=fullstack`, { waitUntil: "networkidle" });
await page.waitForTimeout(350);
ok("W6 轨道 八段", (await page.locator(".w6-fs-track > li").count()) === 8);
ok("W6 轨道 一段返回", (await page.locator(".w6-fs-track > li.return").count()) === 1);
// 折返靠的是「08 换行到第二行」这个几何事实：08 的顶边必须低于 07，左边必须回到 01 那一列
const turn = await page.evaluate(() => {
  const items = [...document.querySelectorAll(".w6-fs-track > li")];
  const first = items[0].getBoundingClientRect();
  const seventh = items[6].getBoundingClientRect();
  const eighth = items[7].getBoundingClientRect();
  return {
    wrapped: eighth.top > seventh.bottom - 1,
    backToFirstColumn: Math.abs(eighth.left - first.left) < 2,
  };
});
ok("W6 轨道 08 换到第二行", turn.wrapped);
ok("W6 轨道 08 回到第一列", turn.backToFirstColumn);
// 交接值令牌：走到的段才出现，默认光标在 01，因此至少有一枚
ok("W6 轨道 交接值令牌在场", (await page.locator(".w6-fs-carry").count()) >= 1);

const w6Overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
ok("溢出-W6 轨道 桌面", w6Overflow <= 0, `+${w6Overflow}px`);

await page.setViewportSize({ width: 390, height: 844 });
for (const [label, url] of [
  ["W4 泳道序列", `${BASE}/#/showcase?tab=auth`],
  ["W6 轨道", `${BASE}/#/showcase?tab=testing&topic=fullstack`],
]) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`溢出-${label} 移动`, over <= 0, `+${over}px`);
}
// 手机档泳道列画不出跨列箭头，退回文字路由；那份路由必须始终在
await page.goto(`${BASE}/#/showcase?tab=auth`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
ok("W4 手机档 文字路由仍在", (await page.locator(".auth-seq-route").count()) === 7);

/* ====== H. OAuth2 三泳道序列图与 W6 Day4 admin 报表往返链

   两块的结论此前都由颜色 + 文字标签承载：
     · OAuth2 的前信道 / 后信道 —— 只有一个彩色 chip 和一句话
     · Day4 的调用 / 职责 / 返回 —— 原本压在一条单向交接表里
   第二编码分别是「箭头有没有触到浏览器列」和 admin 报表的 O/R 序号、固定职责区；
   下面的断言守住方向、归属、失败侧支，以及 d4-chain 不再被两套图复用。
*/

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${BASE}/#/showcase?tab=oauth2`, { waitUntil: "networkidle" });

await page.waitForTimeout(350);

ok("OAuth2 序列 七段消息", (await page.locator(".oauth-seq > li").count()) === 7);
ok("OAuth2 序列 每行三条生命线", (await page.locator(".oauth-seq > li").first().locator(".oauth-seq-life").count()) === 3);
const oauthText = await bodyText();
ok("OAuth2 state 由后端生成并关联", oauthText.includes("后端生成 state 并建立关联"));
ok("OAuth2 常驻流程模型边界", oauthText.includes("证据等级：流程模型") && oauthText.includes("未接入真实 OAuth provider"));
ok("OAuth2 渠道边界有结论锚", (await page.locator('[data-anchor="oauth-channel-boundary"]').count()) === 1);

// OAUTH_STEPS 的 from/to 从 backend→browser 的 state 关联开始，后面才是授权跳转。
const oauthSpans = await page.evaluate(() =>
  [...document.querySelectorAll(".oauth-seq .oauth-seq-arrow")].map((el) => {
    const cs = getComputedStyle(el);
    return `${cs.gridColumnStart}-${cs.gridColumnEnd}`;
  }),
);
ok("OAuth2 序列 箭头跨列与 from/to 一致", oauthSpans.join("|") === "1-3|1-4|1-4|1-3|2-4|2-4|1-3", oauthSpans.join("|"));

// 本块的验收句：后信道两段（换 token / 拉资料）压根不碰浏览器列。
// 它们的 gridColumnStart 必须 ≥ 2；只要有一段从第 1 列起步，client_secret
// 那条「绝不经过浏览器」的结论在图上就不成立了。
const backSpans = await page.evaluate(() =>
  [...document.querySelectorAll(".oauth-seq > li.back .oauth-seq-arrow")].map(
    (el) => Number(getComputedStyle(el).gridColumnStart),
  ),
);
ok(
  "OAuth2 后信道两段不触浏览器列",
  backSpans.length === 2 && backSpans.every((n) => n >= 2),
  backSpans.join("|"),
);
// 反向三段：state 授权 URL、第三方授权回跳、本地 JWT 都向浏览器列返回。
ok("OAuth2 序列 三段反向", (await page.locator(".oauth-seq .oauth-seq-arrow.reverse").count()) === 3);

const oauthOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
ok("溢出-OAuth2 序列 桌面", oauthOverflow <= 0, `+${oauthOverflow}px`);

await page.goto(`${BASE}/#/showcase?tab=testing&topic=day4`, { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
await page.waitForTimeout(350);

const d4OutboundLayers = await page.locator(".d4-io-node").evaluateAll((nodes) =>
  nodes.map((node) => node.getAttribute("data-layer")),
);
ok(
  "Day4 admin 报表 九步调用下行",
  d4OutboundLayers.join("|") ===
    "前端|Vite proxy|validateToken|requireRole|参数中间件|Controller|Service|Repository / Mongoose|MongoDB",
  d4OutboundLayers.join("|"),
);

const d4ReturnLayers = await page.locator(".d4-io-return[data-return-order]").evaluateAll((nodes) =>
  nodes
    .map((node) => ({
      order: Number(node.getAttribute("data-return-order")),
      layer: node.closest(".d4-io-node")?.getAttribute("data-layer"),
    }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.layer),
);
ok(
  "Day4 admin 报表 六步结果回程",
  d4ReturnLayers.join("|") ===
    "MongoDB|Repository / Mongoose|Service|Controller|Vite proxy|前端",
  d4ReturnLayers.join("|"),
);

ok("Day4 admin 报表 三种视角常驻", (await page.locator(".d4-io-lenses > p").count()) === 3);
ok("Day4 admin 报表 一条失败侧支", (await page.locator(".d4-io-error").count()) === 1);
ok(
  "Day4 失败侧支不混入调用序号",
  (await page.locator(".d4-io-error").getAttribute("class"))?.includes("d4-io-node") === false,
);

// d4-chain 只属于四周主线，不能再被 admin 报表的后置规则改成纵向 flex。
const d4MainlineShape = await page.locator(".d4-mainline > .d4-chain").evaluate((node) => ({
  display: getComputedStyle(node).display,
  columns: getComputedStyle(node).gridTemplateColumns.split(" ").length,
}));
ok(
  "Day4 d4-chain 主线仍为四列 grid",
  d4MainlineShape.display === "grid" && d4MainlineShape.columns === 4,
  `${d4MainlineShape.display}/${d4MainlineShape.columns}`,
);

const d4Overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
ok("溢出-Day4 交接链 桌面", d4Overflow <= 0, `+${d4Overflow}px`);

await page.setViewportSize({ width: 390, height: 844 });
for (const [label, url] of [
  ["OAuth2 序列", `${BASE}/#/showcase?tab=oauth2`],
  ["Day4 交接链", `${BASE}/#/showcase?tab=testing&topic=day4`],
]) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`溢出-${label} 移动`, over <= 0, `+${over}px`);
}
await page.goto(`${BASE}/#/showcase?tab=testing&topic=day4`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
ok("Day4 手机档 九步职责仍在", (await page.locator(".d4-io-node").count()) === 9);
ok("Day4 手机档 六个返回来源仍在", (await page.locator(".d4-io-return[data-return-order]").count()) === 6);
ok(
  "Day4 手机档 回程文字路由仍在",
  (await page.locator(".d4-io-direction.inbound").innerText()).includes(
    "MongoDB → Mongoose / Repository → Service → Controller → Vite proxy → 浏览器",
  ),
);
// 窄屏画不出跨列箭头，退回文字路由，七段都要在
await page.goto(`${BASE}/#/showcase?tab=oauth2`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
ok("OAuth2 手机档 文字路由仍在", (await page.locator(".oauth-seq-route").count()) === 7);

/* ======================================= H. W11 发布流水线板（2026-08-25 建，2026-08-26 扩）

   同一组类别性断言（Markdown 残留 / 白字 / 溢出 / 空壳 / 触控 / 正文下限），
   外加五条本板专属的。这五条量的都是图形事实，不是页面上有没有某句话：
     · ⑥·1 六个标记全落在契约期那一段，执行期那一段一个都没有
       —— 「这一层没有机器手段可用」是位置关系；往右段补一个，结论就不成立了
     · ⑥·2 左栏「流水线逻辑」渲染出来且为空
       —— 空栏本身是结论，补满它图会更整齐，结论会变成谎话
     · ⑥·2 每一条都挂着抓到它的那条命令
       —— 少一条就退回成「我后来知道了」，那是另一回事
     · ②   五阶段里「可能中间态」恰好一格，且它与唯一横跨中线的那一格是同一列
       —— 两件事对齐在同一列上是这一页的全部结论，用几何比对，不数文字
     · ②   已拍板的格子必须写清证据差在哪
       —— 这块板一半内容是承诺，漏一个 caveat 就等于把承诺画成了已完成

   2026-08-26 扩到六页，新增的三页各带自己的结论锚断言：
     · ⑥·3 命令输出那一列的冻结侧合计为 0，且空心与实心是两种形状不是两种颜色
       —— 冻结那一刻没有一条取值有实测支撑，这句话由列脚承载
     · ③   判定依据那一列恰好一格不是限制规则（账户无口令）
       —— 收窄尚未闭合。用户组规则移除后这一格会变，断言先报红提醒改结论
     · ⑤   列合计恰好两层为 1，且列合计等于该列真实标记数；一行整行空着
       —— 空行是「不覆盖任何交付层」，补满它这一页的标题就不成立

   2026-08-26 阶段 3 扩到八页，新增的两页各带自己的结论锚断言：
     · ⑧   内容决定权那一列，采纳行的标记与两条被否行的标记不同；
       否决依据那一列的两格文本不相等
       —— 两条被否的通道依据不同源（一条是仓库属性、一条是运行位置）是这一页的结论。
       两格写成同一个值，这一页就退回成一张普通选型表，断言 3 先报红
     · ⑨   两个取值格文本相等的行恰好 3 行，且这 3 行同时被标为失效、同时带失效机制说明
       —— 判定由两列取值是否相等算出，不手写。三者对不上就是口径漂移
     · ⑨   三条失效的识别时点不全相同
       —— 其中一条是设判据时当场识别的，时点信息塌掉之后这条区别就读不出来了

   2026-08-27 阶段 4 扩到十页，新增的两页各带自己的结论锚断言：
     · ④   时点 × 提交的网格里，两个状态文件的标记在每一个留痕时点上落在不同列；
       被测试拦下的那个提交整列没有标记
       —— 「两个指针从不重合」是列位置的比对，不是页面上写着的一句话。
       某一行填成同一列时，这一页的标题先失效；那一列被补上一个标记，
       「被拦下的提交没有到过服务器」就成了谎话
     · ④   三条路径里恰好一条没有目标文件且画成断点，执行次数合计为 1
       —— 三条画成同样的强度就是把两条没走过的路径呈现为实测
     · ⑪   列脚里恰好一列与现场那一列逐格相同，且标出的相同格数与列脚一致
       —— 判定由逐格比较算出，手写的结论与格子漂移时它先响
     · ⑪   最小样本那张表的末列三格全为 0，且「未记录」有自己的形状
       —— 否证靠的是那一列的计数；未记录被画成「否」，这一页就多出一格没量过的结论

   本批仍没有「临时偏差」格子（轮询对象是功能分支那一条属 ① 那块的内容），
   方法稿 §10 里那条「临时偏差带失效日期」的断言等 ① 落地时再加。
*/

async function goW11(topic) {
  await page.goto(`${BASE}/#/showcase?mode=review&tab=release&topic=${topic}`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  await page.waitForTimeout(220);
}

await page.setViewportSize({ width: 1440, height: 1000 });

// H1. ⑥·1 契约层：六行各落一个标记，自动检查那一列没有标记
await goW11("selfcheck-contract");
let w11t = await bodyText();
ok("W11⑥·1 标题给出对象与结论", w11t.includes("记录 6 条自纠，自动检查发现 0 条"));
const dots = await page.locator(".w11-matrix tbody .w11-dot").count();
ok("W11⑥·1 六行各落一个标记", dots === 6, String(dots));
const autoDots = await page.locator(".w11-matrix tbody td.w11-col-auto .w11-dot").count();
ok("W11⑥·1 自动检查那一列没有标记", autoDots === 0, String(autoDots));
// 列脚合计与实际标记数一致：图与数字各说各话时这条先响
const footTotals = await page.locator(".w11-matrix tfoot td").allInnerTexts();
const footSum = footTotals.reduce((n, c) => n + Number(c.trim() || 0), 0);
ok("W11⑥·1 列脚合计等于标记数", footSum === dots, `${footTotals.join("+")}=${footSum} vs ${dots}`);
ok("W11⑥·1 自动检查列合计为 0", (await page.locator(".w11-matrix tfoot .w11-zero-cell").innerText()).trim() === "0");
const catcherChips = await page.locator(".w11-catcher-chip").allInnerTexts();
ok(
  "W11⑥·1 六条各自挂着发现方式",
  catcherChips.length === 6 && catcherChips.every((c) => c.trim().length > 0),
  catcherChips.join("/"),
);
ok(
  "W11⑥·1 发现方式里没有自动手段",
  catcherChips.every((c) => !c.includes("自动")),
  [...new Set(catcherChips.map((c) => c.trim()))].join("|"),
);
const contractRows = await page.locator(".w11-contract .w11-correction").count();
ok("W11⑥·1 六条自纠条目", contractRows === 6, String(contractRows));

// H2. ⑥·2 机制层：七个分组共用一把尺，流水线逻辑那一条长度为 0
await goW11("selfcheck-runtime");
w11t = await bodyText();
ok("W11⑥·2 标题给出对象与结论", w11t.includes("记录 14 条计划外事件，流水线逻辑相关 0 条"));
const bars = await page.evaluate(() => {
  const svg = document.querySelector(".w11-chart svg");
  if (!svg) return null;
  const rows = [...svg.querySelectorAll("g")].map((g) => ({
    label: g.querySelector("text")?.textContent ?? "",
    value: g.querySelectorAll("text")[1]?.textContent ?? "",
    hasBar: g.querySelector("path") !== null,
  }));
  return rows;
});
ok("W11⑥·2 条形图渲染出七行", bars !== null && bars.length === 7, JSON.stringify(bars?.length));
const logicRow = bars?.find((r) => r.label.includes("流水线逻辑"));
ok(
  "W11⑥·2 流水线逻辑那一行是 0 条且没有条形",
  logicRow !== undefined && logicRow.value.trim() === "0 条" && logicRow.hasBar === false,
  JSON.stringify(logicRow),
);
const barSum = (bars ?? []).reduce((n, r) => n + Number(String(r.value).replace(/[^0-9]/g, "") || 0), 0);
ok("W11⑥·2 各分组之和等于总数", barSum === 14, String(barSum));
const runtimeRows = await page.locator(".w11-runtime .w11-correction").count();
const commandChips = await page.locator(".w11-runtime .w11-command-chip").allInnerTexts();
ok(
  "W11⑥·2 每一条都挂着抓到它的那条命令",
  runtimeRows === 5 && commandChips.length === 5 && commandChips.every((c) => c.trim().length > 0),
  `${runtimeRows}/${commandChips.length}`,
);
ok("W11⑥·2 判据级与代价最高分开标", (await page.locator(".w11-correction.cost").count()) === 2);

// H3. ② 五阶段：唯一跨中线的那一格，与唯一「可能中间态」的那一格是同一列
await goW11("stages");
w11t = await bodyText();
ok("W11② 标题给出对象与结论", w11t.includes("只有在服务器上执行的第 4 阶段会留下中间态"));
const stageCells = await page.locator(".w11-stage-row .w11-stage").count();
ok("W11② 五个阶段", stageCells === 5, String(stageCells));
const risk = await page.locator(".w11-state.w11-stage-risk").count();
ok("W11② 「可能中间态」恰好一格", risk === 1, String(risk));
// 几何比对：跨中线那一格与中间态那一格的水平中点必须重合（同一列）
const align = await page.evaluate(() => {
  const cross = document.querySelector(".w11-stage-row .w11-stage.side-cross");
  const risky = document.querySelector(".w11-state.w11-stage-risk");
  if (!cross || !risky) return null;
  const a = cross.getBoundingClientRect();
  const b = risky.getBoundingClientRect();
  return { dx: Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2), w: a.width };
});
ok(
  "W11② 跨中线的一格与中间态那一格同列",
  align !== null && align.dx < 2,
  JSON.stringify(align),
);
// 「跨过」是画出来的：那条中线必须从第 4 格内部穿过，不能画在它旁边
const crossLine = await page.evaluate(() => {
  const rail = document.querySelector(".w11-rail");
  const cross = document.querySelector(".w11-stage-row .w11-stage.side-cross");
  if (!rail || !cross) return null;
  const railBox = rail.getBoundingClientRect();
  const line = getComputedStyle(rail, "::after").left;
  const x = railBox.left + parseFloat(line);
  const c = cross.getBoundingClientRect();
  return { x, left: c.left, right: c.right };
});
ok(
  "W11② 中线从跨中线那一格内部穿过",
  crossLine !== null && crossLine.x > crossLine.left + 4 && crossLine.x < crossLine.right - 4,
  JSON.stringify(crossLine),
);
// 前三阶段共用一整段状态，不是三段各写一次
const untouchedSpan = await page.evaluate(() => {
  const el = document.querySelector(".w11-state.untouched");
  const one = document.querySelector(".w11-state.w11-stage-risk");
  if (!el || !one) return null;
  return { ratio: el.getBoundingClientRect().width / one.getBoundingClientRect().width };
});
ok(
  "W11② 未被碰过是一整段（约三格宽）",
  untouchedSpan !== null && untouchedSpan.ratio > 2.6,
  JSON.stringify(untouchedSpan),
);
// caveat 数与已拍板格子数一致。8/26 部署段翻档后两者同时归零，这条断言的形态与档位数无关：
// 将来任何一格退回已拍板而没写清证据差在哪，它仍然会报。
const w11Caveats = await page.locator(".w11-stage-caveat").count();
const w11ContractChips = await page.locator(".w11-stage-item .w11-grade-chip.contract").count();
ok("W11② 已拍板的格子都写清证据差在哪", w11Caveats === w11ContractChips, `${w11Caveats}/${w11ContractChips}`);
// 部署段两阶段翻档之后，每一格都必须挂着实测证据，否则就是把承诺画成了完成
const w11Evidence = await page.locator(".w11-stage-evidence").count();
const w11MeasuredChips = await page.locator(".w11-stage-item .w11-grade-chip.measured").count();
ok("W11② 已实测的格子都挂着证据", w11Evidence === w11MeasuredChips && w11Evidence === 5, `${w11Evidence}/${w11MeasuredChips}`);
ok("W11② 部署段写明跨度与运行时差异并存", w11t.includes("跨越 80 个提交") && w11t.includes("运行时差异为零"));
ok("W11② 零改动有对照组", w11t.includes("七项中六项逐字相同"));
ok("W11② 三源库版本不同写在页内", w11t.includes("生产版本尚未核对"));

// H3b. ⑥·3 冻结取值层：冻结那一刻，依据是实测的有 0 条
await goW11("frozen-values");
w11t = await bodyText();
ok("W11⑥·3 标题给出对象与结论", w11t.includes("依据是实测的有 0 条"));
const frozenRows = await page.locator(".w11-frozen-matrix tbody tr").count();
ok("W11⑥·3 四行取值", frozenRows === 4, String(frozenRows));
// 空心标记 = 冻结时的依据，实心标记 = 实测之后的依据。两种形状同时存在才读得出「改了什么」
const hollow = await page.locator(".w11-frozen-matrix tbody .w11-dot.hollow").count();
const solid = await page.locator(".w11-frozen-matrix tbody .w11-dot:not(.hollow)").count();
ok("W11⑥·3 每行一个空心标记（冻结时的依据）", hollow === frozenRows, String(hollow));
ok("W11⑥·3 每行一个实心标记（实测之后的依据）", solid === frozenRows, String(solid));
// 两种标记形状必须真的不同：只靠颜色区分时，这条会报
const frozenShapes = await page.evaluate(() => {
  const a = document.querySelector(".w11-frozen-matrix tbody .w11-dot.hollow");
  const b = document.querySelector(".w11-frozen-matrix tbody .w11-dot:not(.hollow)");
  if (!a || !b) return null;
  const sa = getComputedStyle(a);
  const sb = getComputedStyle(b);
  return { aBorder: sa.borderTopWidth, aBg: sa.backgroundColor, bBorder: sb.borderTopWidth, bBg: sb.backgroundColor };
});
ok(
  "W11⑥·3 空心与实心是两种形状，不只是两种颜色",
  frozenShapes !== null &&
    parseFloat(frozenShapes.aBorder) > 0 &&
    parseFloat(frozenShapes.bBorder) === 0,
  JSON.stringify(frozenShapes),
);
// 结论锚：命令输出那一列，冻结侧的合计是 0
const frozenZeroCount = await page.locator(".w11-frozen-matrix tfoot .w11-zero-cell").count();
const frozenZero = frozenZeroCount > 0
  ? (await page.locator(".w11-frozen-matrix tfoot .w11-zero-cell").first().innerText())
  : "";
ok("W11⑥·3 命令输出那一列的冻结侧合计为 0", frozenZero.trim() === "0", frozenZero || "(该格不存在)");
const frozenFootRows = await page.locator(".w11-frozen-matrix tfoot tr").count();
ok("W11⑥·3 两行列脚分别给出冻结侧与实测侧", frozenFootRows === 2, String(frozenFootRows));
// 每条都要有证据，缺一条就退回成「后来知道了」
const frozenEvidence = await page.locator(".w11-frozen .w11-correction-command").count();
ok("W11⑥·3 四条各自挂着证据", frozenEvidence === 4, String(frozenEvidence));
ok("W11⑥·3 判红与恢复绿两次构建都写出来", w11t.includes("第 33 次构建判红") && w11t.includes("第 36 次构建恢复通过"));

// H3c. ③ 权限收窄：收窄后被拒的依据，有一行不是限制规则
await goW11("trust");
w11t = await bodyText();
ok("W11③ 标题给出对象与结论", w11t.includes("拒绝不来自任何一条限制规则"));
const trustRows = await page.locator(".w11-trust-matrix tbody tr").count();
ok("W11③ 九类命令", trustRows === 9, String(trustRows));
// 结论锚：判定依据那一列，恰好一格标着「账户无口令」
const basisFlag = await page.locator(".w11-trust-matrix .w11-basis-flag").count();
ok("W11③ 判定依据里恰好一格不是限制规则", basisFlag === 1, String(basisFlag));
// 先数再读：那一格消失时这里要报红，不能因为读不到元素而让整个脚本崩掉
const basisFlagText = basisFlag > 0
  ? (await page.locator(".w11-trust-matrix .w11-basis-flag").first().innerText())
  : "";
ok("W11③ 那一格写的是账户无口令", basisFlagText.includes("账户无口令"), basisFlagText || "(该格不存在)");
// 收窄前部署密钥整列是「通道尚未建立」：那条通道是收窄当天才有的
const absentCells = await page.locator(".w11-trust-matrix tbody td.v-absent").count();
ok("W11③ 收窄前部署密钥整列没有取值", absentCells === trustRows, String(absentCells));
// 四种取值各有形状，不只靠颜色（roadmap 第十轮）
const verdictShapes = await page.evaluate(() => {
  const kinds = ["m-allow", "m-deny", "m-n-a", "m-absent"];
  return kinds.map((k) => {
    const el = document.querySelector(`.w11-trust-matrix .${k}`);
    if (!el) return null;
    const st = getComputedStyle(el);
    return `${st.borderTopWidth}|${st.borderTopStyle}|${st.height}|${st.backgroundColor === "rgba(0, 0, 0, 0)" ? "none" : "fill"}`;
  });
});
ok(
  "W11③ 四种取值是四种形状",
  verdictShapes.every((v) => v !== null) && new Set(verdictShapes).size === 4,
  JSON.stringify(verdictShapes),
);
// 两层的条数分别渲染且不相等：它们约束的不是同一条通道
ok("W11③ 两层条数分别写出且不相等", w11t.includes("只接受 4 条命令") && w11t.includes("比对 8 条白名单"));
// 收窄尚未闭合的两项是节点，不是脚注
const trustPending = await page.locator(".w11-trust .w11-pending li").count();
ok("W11③ 收窄未闭合的两项写成待做节点", trustPending === 2, String(trustPending));
ok("W11③ 越权验证的语义偏差如实写出", w11t.includes("输出是要求口令"));

// H3d. ⑤ 覆盖矩阵：列合计行是结论，磁盘检查那一行整行没有标记
await goW11("verify");
w11t = await bodyText();
ok("W11⑤ 标题给出对象与结论", w11t.includes("项不覆盖交付路径的任何一层"));
const verifyRows = await page.locator(".w11-verify-matrix tbody tr").count();
ok("W11⑤ 七项验证", verifyRows === 7, String(verifyRows));
// 结论锚：列合计。对外反向代理与数据库两层各自只有一项覆盖
const layerTotals = await page.evaluate(() => {
  const foot = document.querySelector(".w11-verify-matrix tfoot tr");
  if (!foot) return null;
  return [...foot.querySelectorAll("td")]
    .filter((td) => !td.classList.contains("w11-col-side") && !td.classList.contains("w11-col-cannot"))
    .map((td) => Number(td.textContent.trim()));
});
ok("W11⑤ 列合计行渲染出五层", layerTotals !== null && layerTotals.length === 5, JSON.stringify(layerTotals));
ok(
  "W11⑤ 恰好两层的合计是 1",
  layerTotals !== null && layerTotals.filter((n) => n === 1).length === 2,
  JSON.stringify(layerTotals),
);
// 列合计必须等于该列真实的标记数，图与数字各说各话时它先响
const layerDots = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".w11-verify-matrix tbody tr")];
  const counts = [0, 0, 0, 0, 0];
  for (const row of rows) {
    const cells = [...row.querySelectorAll("td")].filter(
      (td) => !td.classList.contains("w11-col-side") && !td.classList.contains("w11-col-cannot"),
    );
    cells.forEach((td, i) => {
      if (td.querySelector(".w11-dot")) counts[i] += 1;
    });
  }
  return counts;
});
ok(
  "W11⑤ 列合计等于该列的标记数",
  JSON.stringify(layerDots) === JSON.stringify(layerTotals),
  `${JSON.stringify(layerDots)} vs ${JSON.stringify(layerTotals)}`,
);
// 磁盘检查那一行整行没有标记：空行本身是结论，补满它结论就不成立
const emptyRows = await page.locator(".w11-verify-matrix tbody tr.w11-row-empty").count();
const emptyRowDots = await page.locator(".w11-verify-matrix tbody tr.w11-row-empty .w11-dot").count();
ok("W11⑤ 恰好一行不落任何层且真的空着", emptyRows === 1 && emptyRowDots === 0, `${emptyRows}/${emptyRowDots}`);
// 执行侧：六项在服务器、一项在 controller，合计等于验证项数
const sideCells = await page.locator(".w11-verify-matrix tbody td.w11-col-side").allInnerTexts();
const serverSide = sideCells.filter((t) => t.trim() === "服务器").length;
const ctrlSide = sideCells.filter((t) => t.trim() === "controller").length;
ok(
  "W11⑤ 执行侧 6 加 1 等于七项",
  serverSide === 6 && ctrlSide === 1 && serverSide + ctrlSide === verifyRows,
  `${serverSide}/${ctrlSide}`,
);
// 每一项都写清它证明不了什么，这一列是本页的重心
const cannotCells = await page.locator(".w11-verify-matrix tbody td.w11-col-cannot").allInnerTexts();
ok(
  "W11⑤ 七项各自写明证明不了什么",
  cannotCells.length === 7 && cannotCells.every((t) => t.trim().length > 10),
  String(cannotCells.length),
);
// 两条口径并存，后者不推翻前者
ok("W11⑤ 常驻检查与部署后验证两条口径并存", w11t.includes("常驻检查不使用公网探针"));
ok("W11⑤ 关闭盲区的范围限于部署窗口", w11t.includes("部署窗口之外"));
const verifyPending = await page.locator(".w11-verify .w11-pending li").count();
ok("W11⑤ 必验但无结果的一项写成待做节点", verifyPending === 1, String(verifyPending));

// H3e. ⑧ 信任边界：三条通道 × 五项要求，结论落在内容决定权与否决依据两列
await goW11("remote-trigger");
w11t = await bodyText();
ok("W11⑧ 标题给出对象与结论", w11t.includes("被否的 2 条依据分属 2 类"));
const trigRows = await page.locator(".w11-trigger-matrix tbody tr").count();
ok("W11⑧ 三条候选通道", trigRows === 3, String(trigRows));
// 15 格全部有取值：空格意味着某条通道在某项要求上没被判过，那一页就不是逐项比对
const trigCells = await page.locator(".w11-trigger-matrix tbody td.w11-verdict-cell").count();
const trigMarks = await page.locator(".w11-trigger-matrix tbody td.w11-verdict-cell .w11-verdict-mark").count();
ok("W11⑧ 三行五列十五格全部有标记", trigCells === 15 && trigMarks === 15, `${trigCells}/${trigMarks}`);
// 结论锚一：内容决定权那一列，采纳行与两条被否行的标记不同
const anchorCol = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".w11-trigger-matrix tbody tr")];
  return rows.map((row) => {
    const cell = row.querySelector("td.w11-verdict-cell.w11-col-anchor");
    return {
      rejected: row.classList.contains("w11-row-flag"),
      mark: cell ? [...cell.querySelector("i").classList].find((c) => c.startsWith("m-")) : null,
    };
  });
});
const adoptedMarks = anchorCol.filter((r) => !r.rejected).map((r) => r.mark);
const rejectedMarks = anchorCol.filter((r) => r.rejected).map((r) => r.mark);
ok(
  "W11⑧ 内容决定权那一列渲染出三格",
  anchorCol.length === 3 && anchorCol.every((r) => r.mark !== null),
  JSON.stringify(anchorCol),
);
ok(
  "W11⑧ 内容决定权那一列采纳行与两条被否行的标记不同",
  adoptedMarks.length === 1 && rejectedMarks.length === 2 &&
    rejectedMarks.every((m) => m !== adoptedMarks[0]),
  JSON.stringify({ adoptedMarks, rejectedMarks }),
);
// 结论锚二：否决依据那一列的两格文本不相等。同源就说明这一页的分类塌了
const trigBasis = await page.locator(".w11-trigger-matrix tbody td.w11-basis-flag").allInnerTexts();
ok("W11⑧ 否决依据恰好两格", trigBasis.length === 2, String(trigBasis.length));
ok(
  "W11⑧ 两条被否的依据不同源",
  trigBasis.length === 2 && trigBasis[0].trim() !== trigBasis[1].trim(),
  trigBasis.join(" vs "),
);
// 满足项数那一列必须等于该行真实的满足标记数，图与数字各说各话时它先响
const trigCounts = await page.evaluate(() => {
  return [...document.querySelectorAll(".w11-trigger-matrix tbody tr")].map((row) => ({
    shown: Number(row.querySelector("td.w11-col-count").textContent.trim()),
    marks: row.querySelectorAll("td.w11-verdict-cell .w11-verdict-mark.m-meets").length,
  }));
});
ok(
  "W11⑧ 满足项数等于该行的满足标记数",
  trigCounts.every((r) => r.shown === r.marks),
  JSON.stringify(trigCounts),
);
// 三态各有形状，不只靠颜色（沿用第十轮判据）
const trigShapes = await page.evaluate(() => {
  return ["m-meets", "m-fails", "m-n-a"].map((k) => {
    const el = document.querySelector(`.w11-trigger-matrix .${k}`);
    if (!el) return null;
    const st = getComputedStyle(el);
    return `${st.borderTopWidth}|${st.height}|${st.backgroundColor === "rgba(0, 0, 0, 0)" ? "none" : "fill"}`;
  });
});
ok(
  "W11⑧ 三种取值是三种形状",
  trigShapes.every((v) => v !== null) && new Set(trigShapes).size === 3,
  JSON.stringify(trigShapes),
);
// 三条决定性事实与两处计数的时点都在页内：8 条是 D3 取值，9 条是落盘命令进白名单之后
ok("W11⑧ 三条决定性事实在页内", w11t.includes("仓库为 public 且允许 fork") && w11t.includes("12 秒超时"));
ok(
  "W11⑧ 两处计数各自标了时点",
  w11t.includes("8 条提权白名单是 D3 收窄当天") && w11t.includes("之后是 9 条"),
);

// H3f. ⑨ 判据失效面：两列取值相同的行即失效，判定由相等算出
await goW11("criteria");
w11t = await bodyText();
ok("W11⑨ 标题给出对象与结论", w11t.includes("11 条判据里，3 条在机制正确与机制没运行时观察到的取值相同"));
const critRows = await page.locator(".w11-criteria-matrix tbody tr").count();
ok("W11⑨ 十一条判据", critRows === 11, String(critRows));
// 两列全部有取值：空格意味着某一条判据没有被两种情况各判一次
const critObs = await page.evaluate(() => {
  return [...document.querySelectorAll(".w11-criteria-matrix tbody tr")].map((row) => {
    const cells = [...row.querySelectorAll("td.w11-col-obs")].map((td) => td.textContent.trim());
    return {
      cells,
      flagged: row.classList.contains("w11-row-flag"),
      verdict: row.querySelector("td.w11-col-verdict").textContent.trim(),
      when: row.querySelector("td.w11-col-when").textContent.trim(),
    };
  });
});
ok(
  "W11⑨ 十一行的两列全部有取值",
  critObs.length === 11 && critObs.every((r) => r.cells.length === 2 && r.cells.every((c) => c.length > 4)),
  JSON.stringify(critObs.map((r) => r.cells.map((c) => c.length))),
);
// 口径一致性：判定为失效的行、两格文本相等的行、带失效机制说明的行，三者必须是同一批。
// 前两者由同一个函数算出，第三者是手写的说明——手写的那份与算出来的判定漂移时，这条先响。
const critSame = critObs.filter((r) => r.cells[0] === r.cells[1]).length;
const critFail = critObs.filter((r) => r.verdict === "失效").length;
const critMech = await page.locator(".w11-criteria .w11-degenerate-mech").count();
ok(
  "W11⑨ 失效行数等于两列取值相等的行数，也等于手写失效机制的条数",
  critSame === critFail && critFail === critMech,
  `相等 ${critSame} / 判定失效 ${critFail} / 带失效机制 ${critMech}`,
);
// 失效行必须整行标出来，成立的行不得被标成失效
ok(
  "W11⑨ 失效行与整行标记一一对应",
  critObs.every((r) => r.flagged === (r.cells[0] === r.cells[1])),
  JSON.stringify(critObs.map((r) => [r.flagged, r.cells[0] === r.cells[1]])),
);
// 结论锚：失效恰好三行，且三行的识别时点不全相同
ok("W11⑨ 失效恰好三行", critFail === 3, String(critFail));
const critWhen = critObs.filter((r) => r.cells[0] === r.cells[1]).map((r) => r.when);
ok(
  "W11⑨ 三条失效的识别时点不全相同",
  critWhen.length === 3 && new Set(critWhen).size > 1,
  critWhen.join("|"),
);
// 成立的行直接写清状态，不借只有视觉含义的破折号表达。
ok(
  "W11⑨ 成立的行明确写判据成立",
  critObs.filter((r) => r.cells[0] !== r.cells[1]).every((r) => r.when === "判据成立"),
  critObs.filter((r) => r.cells[0] !== r.cells[1]).map((r) => r.when).join("|"),
);
// 两个计数的口径写清楚，否则 9 与 11 会被读成矛盾
ok("W11⑨ 与九条验证的口径差别写在页内", w11t.includes("不是同一个口径"));
// 三条失效的机制各不相同；G 条不属判据失效的理由也要在页内
ok("W11⑨ 三条失效的机制分别写出", w11t.includes("推送预演不发送数据") && w11t.includes("不产出变更判定") && w11t.includes("本来就不写回执"));
ok("W11⑨ 绕过分支保护那一条不算判据失效", w11t.includes("不属于判据失效"));

// H3g. ④ 回滚：时点 × 提交的网格，两个指针的列位置逐行比对
await goW11("rollback");
w11t = await bodyText();
ok(
  "W11④ 标题给出对象与结论",
  w11t.includes("3 条回滚路径里 1 条被真的走过") && w11t.includes("重合 0 次"),
);
// 网格的形状：每一行是一个时点，每一列是一个提交
const drillGrid = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".w11-drill-matrix tbody tr")];
  const cols = document.querySelectorAll(".w11-drill-matrix thead th").length - 2; // 去掉行首与行尾两列
  return {
    cols,
    rows: rows.map((row) => {
      const cells = [...row.querySelectorAll("td.w11-pointer-cell")];
      const at = (cls) => cells.findIndex((td) => td.querySelector(`.w11-pointer-mark.p-${cls}`));
      return {
        head: at("head"),
        previous: at("previous"),
        target: at("target"),
        heads: cells.filter((td) => td.querySelector(".w11-pointer-mark.p-head")).length,
        gap: row.classList.contains("w11-row-gap"),
        gapFlag: row.querySelector(".w11-gap-flag") !== null,
      };
    }),
  };
});
ok(
  "W11④ 网格是六个时点 × 六个提交",
  drillGrid.rows.length === 6 && drillGrid.cols === 6,
  `${drillGrid.rows.length}行/${drillGrid.cols}列`,
);
// 每一行只有一个线上版本：两个方块意味着某一行的取值填重了
ok(
  "W11④ 每个时点恰好一个线上运行标记",
  drillGrid.rows.every((r) => r.heads === 1),
  JSON.stringify(drillGrid.rows.map((r) => r.heads)),
);
// 结论锚一：两个指针的列位置在每一行都不同。相等的那一行出现时，这一页的标题先失效
const bothLogged = drillGrid.rows.filter((r) => r.previous >= 0 && r.target >= 0);
ok(
  "W11④ 两个指针在每个留痕时点上落在不同列",
  bothLogged.length > 0 && bothLogged.every((r) => r.previous !== r.target),
  JSON.stringify(bothLogged.map((r) => [r.previous, r.target])),
);
// 结论锚二：被测试拦下的那个提交整列没有指针标记
const blockedCol = await page.evaluate(() => {
  const heads = [...document.querySelectorAll(".w11-drill-matrix thead th")];
  const idx = heads.findIndex((th) => th.classList.contains("w11-col-offserver"));
  if (idx < 0) return null;
  const col = idx - 1; // 行首那一列不是提交列
  const marks = [...document.querySelectorAll(".w11-drill-matrix tbody tr")].reduce((n, row) => {
    const cells = [...row.querySelectorAll("td.w11-pointer-cell")];
    return n + (cells[col]?.querySelectorAll(".w11-pointer-mark").length ?? 0);
  }, 0);
  return { col, marks, cols: heads.filter((th) => th.classList.contains("w11-col-offserver")).length };
});
ok(
  "W11④ 被测试拦下的提交恰好一列，且整列没有指针标记",
  blockedCol !== null && blockedCol.cols === 1 && blockedCol.marks === 0,
  JSON.stringify(blockedCol),
);
// 缺格是节点不是脚注：淡出的行必须同时在行尾标出来，且数量与待做那一条对得上
const gapRows = drillGrid.rows.filter((r) => r.gap);
ok(
  "W11④ 未留痕的行整行标出且行尾有标记",
  gapRows.length > 0 && gapRows.every((r) => r.gapFlag) &&
    drillGrid.rows.filter((r) => r.gapFlag).length === gapRows.length,
  `${gapRows.length}`,
);
ok(
  "W11④ 未留痕的行里两个指针不同时齐全",
  gapRows.every((r) => r.previous < 0 || r.target < 0),
  JSON.stringify(gapRows.map((r) => [r.previous, r.target])),
);
// 三种指针是三种形状，不只靠颜色（沿用第十轮判据）
const pointerShapes = await page.evaluate(() => {
  return ["p-head", "p-previous", "p-target"].map((k) => {
    const el = document.querySelector(`.w11-drill-matrix .${k}`);
    if (!el) return null;
    const st = getComputedStyle(el);
    return `${st.borderTopWidth}|${st.borderRadius}|${
      st.backgroundColor === "rgba(0, 0, 0, 0)" ? "none" : "fill"
    }`;
  });
});
ok(
  "W11④ 三种指针是三种形状",
  pointerShapes.every((v) => v !== null) && new Set(pointerShapes).size === 3,
  JSON.stringify(pointerShapes),
);
// 三条路径表：第三条的目标格是断点，执行次数合计恰好 1
const pathRows = await page.evaluate(() => {
  return [...document.querySelectorAll(".w11-path-matrix tbody tr")].map((row) => ({
    runs: Number(row.querySelector("td.w11-col-count").textContent.trim()),
    hasFile: row.querySelector("td.w11-target-cell code") !== null,
    broken: row.querySelector("td.w11-target-cell .w11-pointer-mark.p-none") !== null,
    empty: row.classList.contains("w11-row-empty"),
  }));
});
ok("W11④ 三条路径", pathRows.length === 3, String(pathRows.length));
ok(
  "W11④ 恰好一条路径没有目标文件，且它画成断点",
  pathRows.filter((r) => !r.hasFile).length === 1 &&
    pathRows.filter((r) => r.broken).length === 1 &&
    pathRows.every((r) => r.hasFile !== r.broken),
  JSON.stringify(pathRows),
);
ok(
  "W11④ 执行次数合计为 1，零次的两行整行标出",
  pathRows.reduce((n, r) => n + r.runs, 0) === 1 &&
    pathRows.every((r) => r.empty === (r.runs === 0)),
  JSON.stringify(pathRows.map((r) => [r.runs, r.empty])),
);
// 两条限定语必须在页内：回滚是重新部署一遍、撤回提交与回滚目标不是同一个对象
ok(
  "W11④ 回滚不是切指针这条限定语在页内",
  w11t.includes("回滚不是切一个指针") && w11t.includes("撤回提交与回滚目标不是同一个对象"),
);
// 恢复次数的口径：三次恢复里只有一次是回滚，混记会把路径执行次数高估
ok("W11④ 恢复次数与回滚次数分开记", w11t.includes("线上恢复了 3 次，其中 1 次是回滚"));

// H3h. ⑪ 假 active：与现场那一列逐格比对，最小样本的计数单独一张表
await goW11("false-active");
w11t = await bodyText();
ok(
  "W11⑪ 标题给出对象与结论",
  w11t.includes("逐格相同") && w11t.includes("出现 0 次"),
);
const obsGrid = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".w11-obs-matrix tbody tr")];
  const cells = (row) => [...row.querySelectorAll("td.w11-obs-cell")];
  const cols = rows[0] ? cells(rows[0]).length : 0;
  // 逐列统计：标出「与现场相同」的格数，与列脚那一格的分子分母对照
  const foot = [...document.querySelectorAll(".w11-obs-matrix tfoot td")];
  const byCol = [];
  for (let i = 0; i < cols; i += 1) {
    const same = rows.filter((row) => cells(row)[i]?.classList.contains("w11-obs-same")).length;
    const cell = foot[i];
    const m = cell ? cell.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/) : null;
    byCol.push({
      same,
      shown: m ? Number(m[1]) : null,
      compared: m ? Number(m[2]) : null,
      anchor: cells(rows[0])[i]?.classList.contains("w11-col-anchor") ?? false,
      matched: cell ? cell.classList.contains("w11-cell-match") : false,
    });
  }
  return {
    rows: rows.length,
    cols,
    byCol,
    unlogged: document.querySelectorAll(".w11-obs-matrix .w11-obs-mark.o-unlogged").length,
  };
});
ok(
  "W11⑪ 四项观察 × 三种情况",
  obsGrid.rows === 4 && obsGrid.cols === 3,
  JSON.stringify({ rows: obsGrid.rows, cols: obsGrid.cols }),
);
// 结论锚：列脚里恰好一列与现场逐格相同（分子等于分母），其余列不是
const matched = obsGrid.byCol.filter((c) => c.matched);
ok(
  "W11⑪ 列脚恰好一列与现场逐格相同",
  matched.length === 1 && matched[0].shown !== null && matched[0].shown === matched[0].compared,
  JSON.stringify(obsGrid.byCol),
);
// 逐列的相同格数必须等于该列列脚的分子，图与列脚各说各话时它先响
ok(
  "W11⑪ 每一列标出的相同格数与该列列脚一致",
  obsGrid.byCol.every((c) => c.anchor || c.shown === null || c.same === c.shown),
  JSON.stringify(obsGrid.byCol.map((c) => [c.same, c.shown])),
);
// 未记录不是「否」：它有自己的形状，且这一页只有一格
ok("W11⑪ 未记录恰好一格", obsGrid.unlogged === 1, String(obsGrid.unlogged));
const obsShapes = await page.evaluate(() => {
  return ["o-yes", "o-no", "o-unlogged"].map((k) => {
    const el = document.querySelector(`.w11-obs-matrix .${k}`);
    if (!el) return null;
    const st = getComputedStyle(el);
    return `${st.borderTopStyle}|${st.borderRadius}|${
      st.backgroundColor === "rgba(0, 0, 0, 0)" ? "none" : "fill"
    }`;
  });
});
ok(
  "W11⑪ 是 / 否 / 未记录是三种形状",
  obsShapes.every((v) => v !== null) && new Set(obsShapes).size === 3,
  JSON.stringify(obsShapes),
);
// 最小样本那张表：末列三格全 0，否证靠的是这一列不是某句话
const raceCol = await page.evaluate(() => {
  return [...document.querySelectorAll(".w11-race-matrix tbody tr")].map((row) => {
    const cells = [...row.querySelectorAll("td.w11-col-count")];
    return cells[cells.length - 1].textContent.trim();
  });
});
ok(
  "W11⑪ 最小样本三种时机的复现计数全为 0",
  raceCol.length === 3 && raceCol.every((v) => v === "0"),
  raceCol.join("|"),
);
// 分级三档必须齐：只写事实会把推断读成实测
ok(
  "W11⑪ 结论分三档写",
  (await page.locator(".w11-graded article").count()) === 3 &&
    w11t.includes("事实") && w11t.includes("推断") && w11t.includes("未验证"),
);
ok(
  "W11⑪ 没复现与已否证的区别写在页内",
  w11t.includes("没复现不等于已否证"),
);
// 修复与它的连带更新在页内：修复上线之后排障手册那条记录才翻档
ok("W11⑪ 修复与连带更新在页内", w11t.includes("监听失败") && w11t.includes("排障手册"));

// H3i. ① 三条自动化：能写服务器的只有一条；轮询等待段上限 5 分钟
await goW11("lanes");
w11t = await bodyText();
const laneRows = await page.locator(".w11-lane-map .w11-lane-row").count();
const laneWriters = await page.locator(".w11-lane-map .w11-lane-row.current-writer").count();
const serverEndpoints = await page.locator(".w11-lane-map .w11-server-endpoint").count();
ok("W11① 三条轨道汇入同一张图", laneRows === 3, String(laneRows));
ok("W11① 只有一条当前写入轨道", laneWriters === 1, String(laneWriters));
ok("W11① 只有一个服务器端点", serverEndpoints === 1, String(serverEndpoints));
ok(
  "W11① 一眼结论写在页内",
  w11t.includes("能写服务器的只有") && w11t.includes("不是漏配"),
);
ok(
  "W11① 轮询等待段带上限与因果",
  w11t.includes("最长 5 分钟") && w11t.includes("网络位置决定的") &&
    w11t.includes("No changes"),
);

// H3j. ⑦ 与手工部署的逐步对照：六步 × 三种归属，两类没被替掉用两种画法
await goW11("handoff");
w11t = await bodyText();
const handoffRows = await page.locator(".w11-handoff-matrix tbody tr").count();
const ownerChips = await page.locator(".w11-owner-chip").allInnerTexts();
ok("W11⑦ 六步对照表", handoffRows === 6, String(handoffRows));
ok(
  "W11⑦ 三种归属各有落行（含第三类）",
  ownerChips.some((t) => t.includes("被替掉")) &&
    ownerChips.some((t) => t.includes("依赖会关机的机器")) &&
    ownerChips.some((t) => t.includes("主动不交")),
  [...new Set(ownerChips)].join("|"),
);
ok(
  "W11⑦ 两类没被替掉用两种画法且分界说明在页内",
  (await page.locator(".w11-handoff-matrix tr.w11-handoff-not-handed-主动不交").count()) === 1 &&
    w11t.includes("主动不交") && w11t.includes("不能交") &&
    w11t.includes("不是额度问题"),
);
ok("W11⑦ 第三类独立成格", w11t.includes("依赖这台会关机的机器"));

// H4. 档位：每条事实都挂标签、只用三档；板头计数三档齐
for (const topic of W11_TOPICS) {
  await goW11(topic);
  const chips = await page.locator(".w11-board .w11-grade-chip").count();
  ok(`W11 档位-${topic} 事实节点带标签`, chips > 3, String(chips));
  const labels = await page.locator(".w11-board .w11-grade-chip").allInnerTexts();
  ok(
    `W11 档位-${topic} 只用三档`,
    labels.every((l) => ["已实测", "已拍板", "待做"].includes(l.trim())),
    [...new Set(labels.map((l) => l.trim()))].join("|"),
  );
}
const w11Count = await page.locator(".w11-grade-count").innerText();
ok("W11 板头计数三档齐", /已实测/.test(w11Count) && /已拍板/.test(w11Count) && /待做/.test(w11Count), w11Count);

// H5. 阶段进度：十二块全部落地（D5 收口日 ①⑦ 上板），不把待做呈现成已完成
const w11Done = await page.locator(".w11-plan-list li.done").count();
const w11Todo = await page.locator(".w11-plan-list li.todo").count();
ok("W11 阶段 12 已落地 / 0 待做", w11Done === 12 && w11Todo === 0, `${w11Done}/${w11Todo}`);
// 板头的「待做」不再是 0：D3 之后确有三项未完成，D4 之后又多四项，写成节点而不是脚注。
// 逐页数出来的待做节点必须与板头计数相等，否则就是有一项欠账没被计入。
let w11PendingNodes = 0;
for (const topic of W11_TOPICS) {
  await goW11(topic);
  w11PendingNodes += await page.locator(".w11-pending li").count();
}
const w11PendingCount = Number(
  (await page.locator(".w11-grade-count strong").innerText()).match(/(\d+)\s*待做/)?.[1] ?? -1,
);
ok(
  "W11 板头待做计数大于 0 且与页内待做节点数一致",
  w11PendingCount > 0 && w11PendingCount === w11PendingNodes,
  `${w11PendingCount}/${w11PendingNodes}`,
);

// H6. 每页的最低体检（与 W9 / W10 同一组判据，换个板根）
for (const topic of W11_TOPICS) {
  await goW11(topic);
  const text = await bodyText();

  const plain = await page.evaluate(() => {
    const root = document.querySelector(".w11-board") ?? document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("pre, code").forEach((n) => n.remove());
    return clone.innerText;
  });
  ok(`W11 残留-${topic} 无 ** 加粗`, !plain.includes("**"));
  ok(`W11 残留-${topic} 无反引号`, !plain.includes("`"));

  const white = await page.evaluate(() => {
    const luminance = (color) => {
      const n = color.match(/[\d.]+/g);
      if (!n) return null;
      return 0.2126 * Number(n[0]) + 0.7152 * Number(n[1]) + 0.0722 * Number(n[2]);
    };
    const effectiveBg = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const parts = bg.match(/[\d.]+/g);
        if (parts && (parts.length < 4 || Number(parts[3]) > 0.5)) return bg;
      }
      return "rgb(255, 255, 255)";
    };
    const bad = [];
    document.querySelectorAll(".w11-board *").forEach((el) => {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (getComputedStyle(el).color !== "rgb(255, 255, 255)") return;
      const lum = luminance(effectiveBg(el));
      if (lum !== null && lum >= 200) bad.push(el.className || el.tagName);
    });
    return bad.slice(0, 3);
  });
  ok(`W11 白字-${topic}`, white.length === 0, white.join("|"));

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`W11 溢出-${topic} 桌面`, overflow <= 0, `+${overflow}px`);
  ok(`W11 文本-${topic} 非空壳`, text.length > 400, String(text.length));

  const sunk = await page.evaluate(() => {
    const out = [];
    const walk = (el) => {
      const cs = getComputedStyle(el);
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
      if (own && cs.display !== "none" && el.getBoundingClientRect().height > 0) {
        if (["P", "LI", "DD"].includes(el.tagName) && parseFloat(cs.fontSize) < 12) {
          out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}:${cs.fontSize}`);
        }
      }
      for (const c of el.children) walk(c);
    };
    const root = document.querySelector(".w11-board");
    if (root) walk(root);
    return [...new Set(out)];
  });
  ok(`W11 正文-${topic} 桌面 ≥12px`, sunk.length === 0, sunk.slice(0, 3).join("|"));
}

// H7. 手机档：溢出与触控目标
await page.setViewportSize({ width: 390, height: 844 });
// 前面的全站批次都通过 hash 在同一 document 内切板；先做一次真实导航，
// 避免 Chromium 把旧板横向滚动区域短暂保留到这一批的首轮宽度计算里。
await page.goto(`${BASE}/?verify=w11-mobile`, { waitUntil: "networkidle" });
for (const topic of W11_TOPICS) {
  await goW11(topic);
  const overflowState = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const describe = (el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).split(" ").filter(Boolean).slice(0, 2).join("."),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        client: el.clientWidth,
        scroll: el.scrollWidth,
        overflowX: getComputedStyle(el).overflowX,
      };
    };
    const elements = [...document.querySelectorAll(".w11-board *")];
    const culprits = elements
      .map((el) => {
        return describe(el);
      })
      .filter((item) => item.right > viewport + 1 || item.left < -1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 4);
    const boundaries = elements
      .map((el) => describe(el))
      .filter((item) => item.right > viewport && item.right <= documentWidth + 2)
      .sort((a, b) => b.right - a.right)
      .slice(0, 6);
    const matrixWrap = document.querySelector(".w11-matrix-wrap");
    return {
      overflow: documentWidth - viewport,
      culprits,
      boundaries,
      matrixWrap: matrixWrap ? describe(matrixWrap) : null,
    };
  });
  ok(
    `W11 溢出-${topic} 移动`,
    overflowState.overflow <= 0,
    `+${overflowState.overflow}px ${JSON.stringify({ culprits: overflowState.culprits, boundaries: overflowState.boundaries, matrixWrap: overflowState.matrixWrap })}`,
  );
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".w11-board button, .w11-board summary").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.width < 24 || r.height < 24) bad.push(`${el.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return bad.slice(0, 3);
  });
  ok(`W11 触控-${topic} 移动 ≥24px`, small.length === 0, small.join("|"));
}

// H8. 时效：本板不留孤立的相对时间（沿用 W10 §13 的那一维）
await page.setViewportSize({ width: 1440, height: 1000 });
const W11_RELATIVE_WORDS = ["今天", "昨天", "明天", "下周", "上周", "本周", "前一天", "后一天"];
for (const topic of W11_TOPICS) {
  await goW11(topic);
  const text = await bodyText();
  const hits = W11_RELATIVE_WORDS.filter((w) => text.includes(w));
  ok(`时效-W11 ${topic} 无孤立相对时间`, hits.length === 0, hits.join("|"));
}

await page.setViewportSize({ width: 1440, height: 1000 });

/* ===================== I. 跨板下限：每个专题页必须标出结论锚（2026-08-25）

   第八轮定过「结论有没有被版面承载」不做机器断言，理由是代理指标会被凑数满足。
   该决定保留：这里不判定锚好不好，只判定作者有没有回答过「这一页的结论锚是哪个元素」。
   标不出来就是没有——W10Board 与 W11Board 的首版都会在这条上红。

   生效范围随返工推进，不一次性铺开：新建板一律纳入，存量板按编码欠账盘点的结果
   逐块补标注后再加进下面这份清单（见 roadmap「开工判据 · 结论锚与它的机器下限」）。
*/

const ANCHORED_BOARDS = [
  { tab: "release", root: ".w11-board", topics: W11_TOPICS },
];

await page.setViewportSize({ width: 1440, height: 1000 });
for (const board of ANCHORED_BOARDS) {
  for (const topic of board.topics) {
    await page.goto(`${BASE}/#/showcase?mode=review&tab=${board.tab}&topic=${topic}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(200);
    const anchors = await page.evaluate((root) => {
      const panel = document.querySelector("#w11-topic-panel") ?? document.querySelector(root);
      if (!panel) return null;
      return [...panel.querySelectorAll("[data-anchor]")].map((el) => ({
        label: el.getAttribute("data-anchor") ?? "",
        cls: String(el.className),
        h: Math.round(el.getBoundingClientRect().height),
      }));
    }, board.root);
    ok(`结论锚-${board.tab}/${topic} 存在`, anchors !== null && anchors.length >= 1, JSON.stringify(anchors));
    if (!anchors || anchors.length === 0) continue;
    // 锚不能是图例、档位标签或计数条：那几类哪块板都有，标它们等于没标
    const forbidden = /legend|grade-chip|grade-count|verdict|topic-switch/;
    ok(
      `结论锚-${board.tab}/${topic} 不是图例或计数`,
      anchors.every((a) => !forbidden.test(a.cls)),
      anchors.map((a) => a.cls).join("|"),
    );
    ok(
      `结论锚-${board.tab}/${topic} 有描述且可见`,
      anchors.every((a) => a.label.trim().length >= 6 && a.h > 40),
      anchors.map((a) => `${a.label.slice(0, 10)}:${a.h}`).join("|"),
    );
  }
}

/* ================================================ C. 展示 / 复习两态的可见性边界 */

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${BASE}/#/showcase?tab=auth`, { waitUntil: "networkidle" });
await page.waitForTimeout(200);
const showText = await bodyText();
ok("展示态 无部署板 tab", !showText.includes("部署上线"));
ok("展示态 无可观测性 tab", !showText.includes("可观测性"));
ok("展示态 无发布流水线 tab", !showText.includes("发布流水线"));
ok("展示态 有排障手册 tab", showText.includes("排障手册"));

// runbook 板已经拆成六个可寻址专题；脱敏与事实断言必须汇总全板，不能只读默认专题。
async function runbookText(mode) {
  const chunks = [];
  for (const topic of RUNBOOK_TOPICS) {
    const modeQuery = mode === "review" ? "mode=review&" : "";
    await page.goto(`${BASE}/#/showcase?${modeQuery}tab=runbook&topic=${topic}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(120);
    chunks.push(await bodyText());
  }
  return chunks.join("\n");
}

const rbShow = await runbookText("showcase");
ok("展示态 runbook 无真实 IP", !rbShow.includes("43.128.154.242"));
ok("展示态 runbook 无真实域名", !rbShow.includes("43-128-154-242.sslip.io"));
ok("展示态 runbook 含占位 IP", rbShow.includes("<服务器公网 IP>"));
ok("展示态 runbook 含占位域名", rbShow.includes("<服务器域名>"));
ok("展示态 runbook 通用首查在列", rbShow.includes("通用首查"));
ok("展示态 runbook 速查表在列", rbShow.includes("速查表"));
ok("展示态 runbook 8080 已下线", rbShow.includes("已下线（2026-08-27）"));
ok("展示态 runbook 有 /showcase/ 入口", rbShow.includes("/showcase/"));

const rbReview = await runbookText("review");
ok("复习态 runbook 含真实 IP", rbReview.includes("43.128.154.242"));
ok("复习态 runbook 含真实域名", rbReview.includes("43-128-154-242.sslip.io"));
ok("复习态 runbook 三类故障在列", rbReview.includes("反代配置错误") && rbReview.includes("端口占用") && rbReview.includes("磁盘逼近满"));
ok("复习态 runbook 假 active 已修复", rbReview.includes("已修复"));

await page.goto(`${BASE}/#/showcase?tab=notes`, { waitUntil: "networkidle" });
await page.waitForTimeout(250);
const notesShow = await bodyText();
ok("展示态 笔记列表不含 W9 D5", !notesShow.includes("W9 D5 · 收口日"));
ok("展示态 笔记列表不含权限速查表", !notesShow.includes("W9 权限速查表"));
ok("展示态 笔记列表不含 W10 D2", !notesShow.includes("W10 D2 · 日志上线"));
ok("展示态 笔记列表不含 W10 runbook", !notesShow.includes("W10 排障 Runbook"));
ok("展示态 笔记列表不含 W11 D1", !notesShow.includes("W11 D1 · 发布契约"));
for (const label of ["W12 概念地图", "W12 Bub 阅读报告", "W12 Demo 讲稿"]) {
  ok(`展示态 W12 核心链含 ${label}`, notesShow.includes(label));
}
ok("展示态 W12 执行与方法稿不在列",
  !notesShow.includes("W12 D2 · 基线与迁移增量") && !notesShow.includes("W12 展板方法"));
ok("展示态 W12 核心链组恰有3份",
  (await page.locator('.notes-index-group[data-note-group="W12 核心链"] button').count()) === 3);

await page.goto(`${BASE}/#/showcase?mode=review&tab=notes`, { waitUntil: "networkidle" });
await page.waitForTimeout(250);
const notesReview = await bodyText();
for (const label of ["W9 D5 · 收口日", "W9 Demo 讲稿", "W9 权限速查表", "W9 D4-c · 展板 8081", "W9 周计划"]) {
  ok(`笔记 ${label} 在列`, notesReview.includes(label));
}
// W10 板上每条结论都指回这四份；接不进来读者只能看结论、核不了事实
for (const label of ["W10 排障 Runbook", "W10 D5 · 收口日", "W10 D4 · 故障演练", "W10 D2 · 日志上线", "W10 D1 · 观测契约", "W10 周计划", "W10 展板方法"]) {
  ok(`笔记 ${label} 在列`, notesReview.includes(label));
}
// W11 板上的十五条自纠、五个阶段、权限矩阵与覆盖矩阵逐条出自这六份原文
for (const label of ["W11 D3 · 部署段与凭据", "W11 D2 · controller 与第一条流水线", "W11 D1 · 发布契约", "W11 D1 · 收口记录", "W11 周计划", "W11 展板方法"]) {
  ok(`笔记 ${label} 在列`, notesReview.includes(label));
}
for (const label of [
  "W12 概念地图", "W12 Bub 阅读报告", "W12 Demo 讲稿",
  "W12 D2 · 基线与迁移增量", "W12 D3 · Bub 主链", "W12 D4 · 异步与真实调用",
  "W12 D5 · 诊断与收口", "W12 周计划", "W12 展板方法",
]) ok(`复习态 W12 核心链 ${label} 在列`, notesReview.includes(label));
ok("复习态 W12 核心链组恰有9份",
  (await page.locator('.notes-index-group[data-note-group="W12 核心链"] button').count()) === 9);

ok("无 console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
/* ================================================== E. AI 工程板（ai-engineer，W12）

   所有图拓扑断言都先锁定元素数量，再检查 SVG 本体的端点、条件或几何；不以文字层替代图形，
   也不允许 selector 选中 0 个元素时空跑。施工图见 week8-fullstack/notes/w12-ai-board-design.md。 */

const aePassedAtStart = passed;
const aeFailuresAtStart = failures.length;
const AE_TOPICS = ["py-syntax", "cli-dispatch", "async-failure-lifecycle", "entry-chain", "turn-pipeline", "tape-context", "step-loop", "roles-nesting", "concept-map"];

const AE_ACCEPT_EXPECT = {
  "py-syntax": ["映射类型", "Python 内两形态"],
  "cli-dispatch": ["成立点", "失效点", "近似"],
  "async-failure-lifecycle": ["ReadTimeout", "CancelledError", "client", "关闭"],
  "entry-chain": ["两条启动路径", "console wrapper", "待运行验证", "汇合"],
  "turn-pipeline": ["success", "exception", "cancelled", "checkpoint", "Bub 本体仍待运行"],
  "tape-context": ["默认 _select_messages", "tool_call", "tool_result", "anchor", "system", "error", "event", "select=None"],
  "step-loop": ["max_steps", "step 1/2/3", "step 2 return", "没有 step 4", "turn 包含 step loop"],
  "roles-nesting": ["decide=present", "execute=manual", "continue=absent", "persist=absent", "Bub 四项都有 owner"],
  "concept-map": ["五个对象", "载体", "方法迁移", "范围包含", "实例化", "假设来源", "两条推断边", "三条实例化出边", "一条假设来源入边"],
};

async function goAe(topic, { expand = true } = {}) {
  await page.goto(`${BASE}/#/showcase?tab=ai-engineer&topic=${topic}`, { waitUntil: "networkidle" });
  await page.evaluate((open) => document.querySelectorAll("details").forEach((d) => (d.open = open)), expand);
  await page.waitForTimeout(220);
}

await page.setViewportSize({ width: 1440, height: 1000 });

// E-0 深链与回退：九块各自可达，未知 topic 回到第一块，切 tab 不串号
for (const topic of AE_TOPICS) {
  await goAe(topic, { expand: false });
  const text = await bodyText();
  ok(`AI 板-${topic} 舞台渲染`, (await page.locator(".ae-board .ae-stage-body").count()) === 1);
  ok(`AI 板-${topic} 只有当前专题标为 pressed`,
    (await page.locator('.ae-topic-nav button[aria-pressed="true"]').count()) === 1 &&
    (await page.locator('.ae-topic-nav button.on').getAttribute("aria-pressed")) === "true");
  ok(`AI 板-${topic} 非空壳`, text.length > 400, String(text.length));
  const accept = page.locator(".ae-accept");
  const acceptCount = await accept.count();
  ok(`AI 板-${topic} 只有一条验收句`, acceptCount === 1, `${acceptCount} 条`);
  const acceptText = acceptCount === 1 ? (await accept.textContent() ?? "") : "";
  const missingAccept = AE_ACCEPT_EXPECT[topic].filter((part) => !acceptText.includes(part));
  ok(`AI 板-${topic} 关键结论受断言保护`, missingAccept.length === 0, missingAccept.join(" | "));
  const residue = await page.evaluate(() => {
    const stage = document.querySelector(".ae-stage-body")?.cloneNode(true);
    if (!stage) return ["stage missing"];
    stage.querySelectorAll("code, pre").forEach((node) => node.remove());
    return stage.innerText.match(/\*\*|`/g) ?? [];
  });
  ok(`AI 板-${topic} 普通文字无 Markdown 残留`, residue.length === 0, residue.join(""));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`AI 板-${topic} 桌面无横向溢出`, overflow <= 0, `+${overflow}px`);
  const stageHeight = await page.locator(".ae-stage").evaluate((el) => Math.round(el.getBoundingClientRect().height));
  ok(`AI 板-${topic} 默认主舞台不超过 1.5 屏`, stageHeight <= 1500, `${stageHeight}px`);
}
await goAe("not-a-real-topic");
ok("AI 板 未知 topic 回退到第一块", (await page.locator(".ae-topic-nav button.on").innerText()).includes("六个语法单元"));
await goAe("step-loop", { expand: false });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(160);
const aeReloadHash = await page.evaluate(() => window.location.hash);
ok("AI 板 刷新保留当前专题", aeReloadHash.includes("topic=step-loop") &&
  (await page.locator('.ae-topic-nav button.on[aria-pressed="true"]').innerText()).includes("step 循环"));
await page.goto(`${BASE}/#/showcase?tab=ai-engineer&topic=step-loop`, { waitUntil: "networkidle" });
await page.locator(".showcase-tabs button", { hasText: "认证与授权" }).click();
await page.waitForTimeout(160);
const aeHash = await page.evaluate(() => window.location.hash);
ok("AI 板 切 tab 清 topic", !aeHash.includes("topic="), aeHash);

// E-CM 概念地图：直接检查分区节点、边端点、方向、线型和推断集合，不以页面文案替代关系图。
await goAe("concept-map");
t = await bodyText();
const conceptGroups = await page.locator('.ae-nav-group[data-group]').evaluateAll((groups) => groups.map((group) => ({
  name: group.dataset.group,
  top: Math.round(group.getBoundingClientRect().top),
  width: Math.round(group.getBoundingClientRect().width),
  gridStart: getComputedStyle(group).gridColumnStart,
  gridEnd: getComputedStyle(group).gridColumnEnd,
})));
ok("概念地图导航是第一组且三组顺序冻结",
  conceptGroups.map((group) => group.name).join(",") === "概念地图,Python 迁移增量,Bub harness 骨架",
  JSON.stringify(conceptGroups));
ok("概念地图导航桌面独占一整行",
  conceptGroups[0]?.gridStart === "1" && conceptGroups[0]?.gridEnd === "-1" &&
  conceptGroups[0]?.top < conceptGroups[1]?.top && conceptGroups[1]?.top === conceptGroups[2]?.top &&
  conceptGroups[0]?.width > conceptGroups[1]?.width,
  JSON.stringify(conceptGroups));
const conceptActiveBadge = await page.locator('.ae-topic-nav button.on em[data-evidence-kind]').innerText();
ok("概念地图导航徽标为混合", conceptActiveBadge.trim() === "混合", conceptActiveBadge);
const conceptEvidenceNote = await page.locator('.ae-evidence').innerText();
ok("概念地图证据说明使用混合专门文案",
  conceptEvidenceNote.includes("块内边级证据混合") &&
  ["推断", "源码事实", "本人实测"].every((kind) => conceptEvidenceNote.includes(kind)) &&
  !conceptEvidenceNote.includes("本块整体为"), conceptEvidenceNote);

const conceptNodes = await page.locator('.ae-concept-figure .ae-concept-node[data-node][data-zone]').evaluateAll((nodes) =>
  nodes.map((node) => ({ id: node.dataset.node, zone: node.dataset.zone })).sort((a, b) => a.id.localeCompare(b.id)));
ok("概念地图桌面 SVG 恰有五个冻结节点", JSON.stringify(conceptNodes) === JSON.stringify([
  { id: "2.1", zone: "left" }, { id: "2.2", zone: "left" },
  { id: "2.3", zone: "right" }, { id: "2.4", zone: "right" }, { id: "2.5", zone: "right" },
]), JSON.stringify(conceptNodes));
const conceptBubGeometry = await page.evaluate(() => {
  const bub = document.querySelector('.ae-concept-node[data-node="2.5"]');
  const left = document.querySelector('.ae-concept-zone[data-zone="left"] rect');
  const right = document.querySelector('.ae-concept-zone[data-zone="right"] rect');
  if (!(bub instanceof SVGGraphicsElement) || !(left instanceof SVGGraphicsElement) || !(right instanceof SVGGraphicsElement)) return null;
  const dimensions = (element) => {
    const { x, y, width, height } = element.getBBox();
    return { x, y, width, height };
  };
  return { bub: dimensions(bub), left: dimensions(left), right: dimensions(right) };
});
ok("Bub 位于右区左缘且不越界", !!conceptBubGeometry &&
  conceptBubGeometry.bub.x >= conceptBubGeometry.right.x &&
  conceptBubGeometry.bub.x + conceptBubGeometry.bub.width <= conceptBubGeometry.right.x + conceptBubGeometry.right.width &&
  conceptBubGeometry.bub.x >= conceptBubGeometry.left.x + conceptBubGeometry.left.width &&
  conceptBubGeometry.bub.x - conceptBubGeometry.right.x <= 50,
  JSON.stringify(conceptBubGeometry));

const conceptEdges = await page.locator('.ae-concept-figure .ae-concept-edge[data-from][data-to][data-relation][data-evidence]').evaluateAll((edges) =>
  edges.map((edge) => {
    const path = edge.querySelector('path');
    return {
      key: `${edge.dataset.from}->${edge.dataset.to}`,
      relation: edge.dataset.relation,
      evidence: edge.dataset.evidence,
      endpointsExist: !!document.querySelector(`.ae-concept-node[data-node="${edge.dataset.from}"]`) &&
        !!document.querySelector(`.ae-concept-node[data-node="${edge.dataset.to}"]`),
      marker: path?.getAttribute("marker-end"),
      d: path?.getAttribute("d"),
      dash: path ? getComputedStyle(path).strokeDasharray : null,
      inferenceMarks: edge.querySelectorAll('.ae-concept-inference').length,
    };
  }).sort((a, b) => a.key.localeCompare(b.key)));
const conceptEdgeContract = conceptEdges.map((edge) => `${edge.key}:${edge.relation}:${edge.evidence}`).sort();
const expectedConceptEdges = [
  "2.1->2.2:carrier:本人实测",
  "2.2->2.4:migration:推断",
  "2.3->2.4:contain:推断",
  "2.4->2.5:hypothesis-source:本人实测",
  "2.5->2.1:instantiate:源码事实",
  "2.5->2.2:instantiate:本人实测",
  "2.5->2.4:instantiate:源码事实",
].sort();
ok("概念地图七条边的方向、关系与证据逐条冻结",
  conceptEdgeContract.length === 7 && JSON.stringify(conceptEdgeContract) === JSON.stringify(expectedConceptEdges),
  conceptEdgeContract.join(" | "));
ok("概念地图七条边端点存在且方向由箭头编码",
  conceptEdges.length === 7 && conceptEdges.every((edge) => edge.endpointsExist && edge.marker === "url(#ae-concept-arrow)"),
  JSON.stringify(conceptEdges));
const conceptRelationCounts = Object.fromEntries([...new Set(conceptEdges.map((edge) => edge.relation))].sort().map((relation) => [
  relation, conceptEdges.filter((edge) => edge.relation === relation).length,
]));
ok("概念地图五类关系覆盖为 1/1/1/3/1",
  JSON.stringify(conceptRelationCounts) === JSON.stringify({ carrier: 1, contain: 1, "hypothesis-source": 1, instantiate: 3, migration: 1 }),
  JSON.stringify(conceptRelationCounts));
const conceptLineStyles = ["carrier", "migration", "contain", "instantiate", "hypothesis-source"].map((relation) => ({
  relation,
  dash: conceptEdges.find((edge) => edge.relation === relation)?.dash,
}));
ok("概念地图五类关系使用五种不同线型",
  conceptLineStyles.every((style) => style.dash !== null) && new Set(conceptLineStyles.map((style) => style.dash)).size === 5,
  JSON.stringify(conceptLineStyles));
const conceptInferenceEdges = conceptEdges.filter((edge) => edge.inferenceMarks === 1).map((edge) => edge.key).sort();
ok("概念地图仅两条推断边带推断标记",
  conceptInferenceEdges.join(",") === "2.2->2.4,2.3->2.4" &&
  conceptEdges.filter((edge) => edge.inferenceMarks === 0).length === 5,
  conceptInferenceEdges.join(","));
const conceptForward = conceptEdges.find((edge) => edge.key === "2.4->2.5");
const conceptReverse = conceptEdges.find((edge) => edge.key === "2.5->2.4");
ok("2.4 与 2.5 的反向边以不同曲线分离",
  conceptForward?.d?.includes("C") && conceptReverse?.d?.includes("C") && conceptForward.d !== conceptReverse.d,
  JSON.stringify({ forward: conceptForward?.d, reverse: conceptReverse?.d }));
ok("Bub 的三条实例化出边与一条假设来源入边可从结构读出",
  conceptEdges.filter((edge) => edge.key.startsWith("2.5->") && edge.relation === "instantiate").length === 3 &&
  conceptEdges.filter((edge) => edge.key.endsWith("->2.5") && edge.relation === "hypothesis-source").length === 1);
ok("概念地图图例恰列五类关系并另列证据标记",
  (await page.locator('.ae-concept-legend-item[data-relation]').count()) === 5 &&
  (await page.locator('.ae-concept-legend-evidence').count()) === 1);
ok("概念地图边界明示关系集合开放", t.includes("对象与关系集合开放"));

// E-CM-N 导航接线：与七条知识边分层，直接检查五个入口集合与真实点击。
const aeVisibleLabels = await page.locator(".ae-topic-nav button span").allInnerTexts();
ok("AI 板导航使用九个语义短标签", aeVisibleLabels.join("|") === [
  "总览", "语法映射", "CLI 分发", "异步清理", "启动入口", "turn 检查点", "tape → context", "step 循环", "职责边界",
].join("|"), aeVisibleLabels.join("|"));
ok("AI 板主导航无 P/B 施工编号", aeVisibleLabels.every((label) => !/^[PB]\d+$/.test(label)));

const provenance = await page.locator('.ae-concept-provenance a[data-provenance-step][data-note-target][data-note-section]').evaluateAll((links) =>
  links.map((link) => `${link.dataset.provenanceStep}:${link.dataset.noteTarget}:${link.dataset.noteSection}`));
ok("概念地图形成轨恰有3步且都可达源文档",
  provenance.join(",") === "1:w12concept:1.1,2:w12concept:1.2,3:w12concept:5", provenance.join("|"));
ok("概念地图形成口径不伪造唯一算法",
  t.includes("不是从八个专题反推") && t.includes("没有唯一") && t.includes("开放导航集合"));

const landingRows = await page.locator('.ae-concept-landing-list article[data-concept]').evaluateAll((rows) =>
  rows.map((row) => ({
    concept: row.dataset.concept,
    topics: [...row.querySelectorAll('button[data-landing-topic]')].map((button) => button.dataset.landingTopic),
  })));
const expectedLandings = {
  "2.1": ["py-syntax", "async-failure-lifecycle"],
  "2.2": ["cli-dispatch", "async-failure-lifecycle"],
  "2.3": ["roles-nesting"],
  "2.4": ["entry-chain", "turn-pipeline", "tape-context", "step-loop", "roles-nesting"],
  "2.5": ["cli-dispatch", "entry-chain"],
};
function landingContractHolds(rows) {
  const actual = Object.fromEntries(rows.map((row) => [row.concept, row.topics]));
  const union = [...new Set(rows.flatMap((row) => row.topics))].sort();
  const expectedUnion = AE_TOPICS.filter((topic) => topic !== "concept-map").sort();
  return JSON.stringify(actual) === JSON.stringify(expectedLandings) &&
    JSON.stringify(union) === JSON.stringify(expectedUnion);
}
ok("概念地图五组阅读入口精确且覆盖现有八专题",
  landingContractHolds(landingRows), JSON.stringify(landingRows));
const missingLanding = landingRows.map((row) => ({ ...row, topics: [...row.topics] }));
missingLanding[0].topics.shift();
ok("概念地图入口负控能抓住缺失专题",
  landingContractHolds(landingRows) && !landingContractHolds(missingLanding));
ok("概念地图阅读入口明示不是完整归属",
  t.includes("不是对象归属、完整覆盖或第八类概念关系"));
const conceptDetailNotes = await page.locator('.ae-concept-details li p').allInnerTexts();
ok("概念地图关系依据不再显示裸 2.x 编号",
  conceptDetailNotes.length === 7 && conceptDetailNotes.every((line) => !/\b2\.[1-5]\b/.test(line)),
  conceptDetailNotes.filter((line) => /\b2\.[1-5]\b/.test(line)).join(" | "));
const conceptNakedIds = await page.evaluate(() => {
  const stage = document.querySelector('.ae-stage')?.cloneNode(true);
  if (!stage) return ["stage missing"];
  stage.querySelectorAll('a[data-note-section], a[data-note-target]').forEach((link) => link.remove());
  return stage.innerText.match(/\b2\.[1-5]\b/g) ?? [];
});
ok("概念地图可见文案除真实章节链接外无裸 2.x 编号",
  conceptNakedIds.length === 0, conceptNakedIds.join(","));

const conceptSourceLinks = await page.locator('.ae-concept a[data-note-section]').evaluateAll((links) =>
  [...new Set(links.map((link) => link.dataset.noteSection))].sort());
ok("概念地图 2.x 只作为可打开的原文章节目标",
  ["2.1", "2.2", "2.3", "2.4", "2.5"].every((section) => conceptSourceLinks.includes(section)), conceptSourceLinks.join(","));
const conceptNoteHrefs = await page.locator('.ae-concept a[href*="tab=notes"]').evaluateAll((links) =>
  links.map((link) => link.getAttribute("href") ?? ""));
ok("概念地图各类原文入口都携带总览返回上下文",
  conceptNoteHrefs.length === 18 && conceptNoteHrefs.every((href) => {
    const params = new URLSearchParams(href.split("?", 2)[1] ?? "");
    return params.get("returnTab") === "ai-engineer" && params.get("returnTopic") === "concept-map";
  }), `${conceptNoteHrefs.length} links`);

await page.locator('.ae-concept-landing-list article[data-concept="2.4"] button[data-landing-topic="turn-pipeline"]').click();
await page.waitForTimeout(120);
ok("概念阅读入口点击后到达真实专题",
  (await page.evaluate(() => window.location.hash)).includes("topic=turn-pipeline") &&
  (await page.locator('.ae-topic-nav button.on').innerText()).includes("turn 检查点"));
ok("普通专题显示概念入口和返回总览",
  (await page.locator('.ae-topic-context [data-concept="2.4"]').count()) === 1 &&
  (await page.locator('.ae-topic-context button', { hasText: "返回概念地图" }).count()) === 1);
await page.locator('.ae-topic-context button', { hasText: "返回概念地图" }).click();
await page.waitForTimeout(120);
ok("普通专题可返回概念地图",
  (await page.evaluate(() => window.location.hash)).includes("topic=concept-map") &&
  (await page.locator('.ae-topic-nav button.on').innerText()).includes("概念地图总览"));

// E-P1 语法映照：直接检查 SVG 连线端点与线型，不用折叠文字层的 .ae-map-link 代替图。
await goAe("py-syntax");
t = await bodyText();
const p1UnitCount = await page.locator(".ae-svg-unit").count();
ok("P1 SVG 有六个语义单元", p1UnitCount === 6, `${p1UnitCount} 个`);
const p1SvgLinkCount = await page.locator(".ae-svg-map-line[data-from][data-to]").count();
ok("P1 SVG 有六条可定位映射线", p1SvgLinkCount === 6, `${p1SvgLinkCount} 条`);
const p1Links = await page.locator(".ae-svg-map-line[data-from][data-to]").evaluateAll((els) =>
  els.map((el) => ({
    from: el.dataset.from,
    to: el.dataset.to,
    type: el.closest(".ae-svg-unit")?.dataset.maptype,
    fromOk: !!document.getElementById(el.dataset.from),
    toOk: !!document.getElementById(el.dataset.to),
  })));
ok("P1 连线端点真实存在", p1Links.length === 6 && p1Links.every((l) => l.fromOk && l.toOk),
  p1Links.filter((l) => !l.fromOk || !l.toOk).map((l) => `${l.from}->${l.to}`).join("|"));
ok("P1 dataclass/Pydantic 记为 Python 内两形态",
  p1Links.filter((l) => l.type === "py-internal").length === 1 &&
  p1Links.some((l) => l.from.includes("data-shape")) &&
  (await page.locator('.ae-svg-unit[data-unit="data-shape"] .ae-svg-map-divider').count()) === 1);
const p1Types = [...new Set(p1Links.map((link) => link.type))].sort();
ok("P1 图例只列本页实际使用的两类", p1Types.join(",") === "approx,py-internal" &&
  (await page.locator(".ae-map-legend-item").count()) === 2, p1Types.join(","));
ok("P1 资源收尾不再误标为 Python 侧新增",
  (await page.locator('.ae-svg-unit[data-unit="ctx-manager"][data-maptype="approx"]').count()) === 1);
const p1Sources = await page.locator(".ae-map-sources li").allInnerTexts();
ok("P1 每个端点都有非空来源",
  p1Sources.length === 13 && p1Sources.every((line) => line.trim().length > 6 && !line.includes("本仓库无对照物")),
  `${p1Sources.length} 条`);
for (const source of [
  "authTopics.ts:49 / api.ts:45",
  "week2-express/src/repositories/users.js:37 · errors/userErrors.js:13-17",
  "AuthView.tsx:48-49（setBusy）· Dashboard.tsx:94-95（setRefreshing）",
  "week2-express/src/__tests__/auth-flow.test.js:1-2",
]) ok(`P1 关键 TS 来源在页：${source}`, p1Sources.some((line) => line.includes(source)), source);

// E-P3 对齐映照：SVG 的四条对齐线必须各有真实端点、成立短标签与失效短标签。
await goAe("cli-dispatch");
t = await bodyText();
const p3PairCount = await page.locator(".ae-svg-pair").count();
ok("P3 SVG 有四组职责对齐", p3PairCount === 4, `${p3PairCount} 组`);
const p3SvgLinkCount = await page.locator(".ae-svg-align-line[data-from][data-to]").count();
ok("P3 SVG 有四条可定位对齐线", p3SvgLinkCount === 4, `${p3SvgLinkCount} 条`);
const p3Links = await page.locator(".ae-svg-align-line[data-from][data-to]").evaluateAll((els) =>
  els.map((el) => ({
    from: el.dataset.from,
    to: el.dataset.to,
    fromOk: !!document.getElementById(el.dataset.from),
    toOk: !!document.getElementById(el.dataset.to),
    holds: el.parentElement?.querySelectorAll(".ae-svg-align-tag.holds").length ?? 0,
    fails: el.parentElement?.querySelectorAll(".ae-svg-align-tag.fails").length ?? 0,
  })));
ok("P3 SVG 对齐线端点真实存在", p3Links.length === 4 && p3Links.every((item) => item.fromOk && item.toOk),
  JSON.stringify(p3Links));
ok("P3 每条 SVG 对齐线都有成立与失效标签",
  p3Links.every((item) => item.holds === 1 && item.fails === 1), JSON.stringify(p3Links));
for (const src of ["app.js:19", "app.js:83", "app.js:100", "routes/auth.js:9", "controllers/auth.js:3",
  "hook_impl.py 当时 L248", "framework.py 当时 L105-112", "cli.py 当时 L48"]) {
  ok(`P3 来源 ${src} 在页`, t.includes(src));
}
ok("P3 不虚构 /run 路由", !t.includes("/run"));
ok("P3 说明同构是笔记原话、近似是本板降级",
  t.includes("与 Express 同构") && t.includes("本板逐对核对"));
ok("P3 失效位两项", (await page.locator(".ae-align-void p").count()) === 2);

// E-P4 三条异步失败轨迹：每条各自按序数连通，轨间不共享时间比例。
await goAe("async-failure-lifecycle");
t = await bodyText();
const p4Traces = await page.locator(".ae-fig-failure .ae-svg-failure-trace[data-trace]").evaluateAll((traces) =>
  traces.map((trace) => {
    const nodes = [...trace.querySelectorAll("[data-node][data-ordinal]")].map((node) => ({
      id: node.dataset.node,
      ordinal: Number(node.dataset.ordinal),
      at: node.dataset.atSeconds === undefined ? null : Number(node.dataset.atSeconds),
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = [...trace.querySelectorAll("[data-from][data-to]")].map((edge) => ({
      from: edge.dataset.from,
      to: edge.dataset.to,
      endpointsExist: nodeIds.has(edge.dataset.from) && nodeIds.has(edge.dataset.to),
    }));
    return {
      id: trace.dataset.trace,
      scale: trace.dataset.scale,
      read: Number(trace.dataset.readSeconds),
      hold: Number(trace.dataset.holdSeconds),
      exception: trace.dataset.exception,
      closed: trace.dataset.clientClosed,
      nodes,
      edges,
    };
  }));
ok("P4 桌面恰好三条有向因果轨迹", p4Traces.length === 3, JSON.stringify(p4Traces.map((trace) => trace.id)));
ok("P4 每条轨迹端点存在且 ordinal 严格递增", p4Traces.every((trace) =>
  trace.edges.length === trace.nodes.length - 1 && trace.edges.every((edge) => edge.endpointsExist) &&
  trace.nodes.every((node, index) => index === 0 || node.ordinal > trace.nodes[index - 1].ordinal)), JSON.stringify(p4Traces));
const p4Low = p4Traces.find((trace) => trace.id === "timeout-low");
const p4Control = p4Traces.find((trace) => trace.id === "timeout-control");
const p4Cancel = p4Traces.find((trace) => trace.id === "cancel");
ok("P4 timeout 对照只改变 read timeout", p4Low?.hold === 3 && p4Control?.hold === 3 && p4Low?.read === .5 && p4Control?.read === 5,
  JSON.stringify({ low: p4Low, control: p4Control }));
ok("P4 cancel 使用 D4 原实验的 read=30s / hold=60s", p4Cancel?.read === 30 && p4Cancel?.hold === 60,
  JSON.stringify({ read: p4Cancel?.read, hold: p4Cancel?.hold }));
ok("P4 失败终点都 closed 且异常类型不同", p4Low?.closed === "true" && p4Cancel?.closed === "true" &&
  p4Low?.exception === "ReadTimeout" && p4Cancel?.exception === "CancelledError", JSON.stringify({ low: p4Low, cancel: p4Cancel }));
const p4CancelSequence = p4Cancel?.nodes.map((node) => `${node.id}:${node.ordinal}:${node.at ?? "-"}`) ?? [];
ok("P4 cancel 依次经过 FIN、finally、caller cancelled、client closed",
  p4CancelSequence.join(",") ===
    "ca-wait:1:-,ca-cancel:2:0.469,ca-fin:3:0.47,ca-finally:4:0.571,ca-error:5:0.571,ca-closed:6:0.572",
  p4CancelSequence.join(","));
ok("P4 标明 D4 本项目受控 HTTP 实验作用域",
  (await page.locator('.ae-failure-evidence[data-scope="D4 本项目受控 HTTP 实验"][data-target-verified="true"]').count()) === 1 &&
  t.includes("D4 本项目受控 HTTP 实验 · 本人实测"));
ok("P4 明示轨间横距不是共同时间比例", (await page.locator('.ae-fig-failure[data-scale="ordinal-not-common-time"]').count()) === 1 &&
  t.includes("轨间横向距离不是共同时间比例"));

// E-B1 入口链：两条启动路径必须真实分开、共享初始化、再由两个调用方汇入 app()。
await goAe("entry-chain");
t = await bodyText();
const b1NodeCount = await page.locator(".ae-svg-entry-node[data-node]").count();
const b1EdgeCount = await page.locator(".ae-svg-entry-edge[data-from][data-to]").count();
ok("B1 SVG 有十二个节点", b1NodeCount === 12, `${b1NodeCount} 个`);
ok("B1 SVG 有十二条边", b1EdgeCount === 12, `${b1EdgeCount} 条`);
const b1Topology = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll(".ae-svg-entry-node[data-node]")].map((node) => node.dataset.node);
  const edges = [...document.querySelectorAll(".ae-svg-entry-edge[data-from][data-to]")].map((edge) => ({
    from: edge.dataset.from, to: edge.dataset.to, flow: edge.dataset.flow, owner: edge.dataset.owner,
  }));
  const nodeSet = new Set(nodes);
  const reachable = (start, target) => {
    const seen = new Set([start]);
    const pending = [start];
    while (pending.length) {
      const current = pending.shift();
      for (const edge of edges.filter((item) => item.from === current)) {
        if (edge.to === target) return true;
        if (!seen.has(edge.to)) { seen.add(edge.to); pending.push(edge.to); }
      }
    }
    return false;
  };
  return {
    endpointsExist: edges.every((edge) => nodeSet.has(edge.from) && nodeSet.has(edge.to)),
    consoleReachesTurn: reachable("console-start", "process-inbound"),
    pythonMReachesTurn: reachable("python-m-start", "process-inbound"),
    edges,
  };
});
ok("B1 所有 SVG 边端点都存在", b1Topology.endpointsExist, JSON.stringify(b1Topology.edges));
ok("B1 两条启动路径都可达第一次 turn",
  b1Topology.consoleReachesTurn && b1Topology.pythonMReachesTurn, JSON.stringify(b1Topology));
const b1Edges = b1Topology.edges.map((edge) => `${edge.from}->${edge.to}:${edge.flow}:${edge.owner}`);
for (const expected of [
  "console-start->module-level:join:console",
  "python-m-start->module-level:join:python-m",
  "register-run->wrapper-call:split:console",
  "register-run->name-gate:split:python-m",
  "wrapper-call->dispatch:join:console",
  "name-gate->dispatch:join:python-m",
]) ok(`B1 关键边 ${expected}`, b1Edges.includes(expected), b1Edges.join(" | "));
ok("B1 三个共享初始化节点标明两线共有",
  (await page.locator('.ae-svg-entry-node[data-owner="both"]:is([data-node="module-level"], [data-node="create-cli-app"], [data-node="register-run"])').count()) === 3);
ok("B1 app() 是唯一汇合节点",
  (await page.locator('.ae-svg-entry-node[data-node="dispatch"][data-join="true"]').count()) === 1 &&
  (await page.locator('.ae-svg-entry-node[data-join="true"]').count()) === 1);
ok("B1 process_inbound 是唯一第一次 turn 触发点",
  (await page.locator('.ae-svg-entry-node[data-node="process-inbound"][data-trigger="true"]').count()) === 1 &&
  (await page.locator('.ae-svg-entry-node[data-trigger="true"]').count()) === 1);
ok("B1 未验证调用关系单独呈现", (await page.locator('[data-seam="open"]').count()) === 1);
const b1Seam = await page.locator('[data-seam="open"]').innerText();
ok("B1 console wrapper 调用关系标为待运行验证",
  b1Seam.includes("console wrapper → app()") && b1Seam.includes("待运行验证"), b1Seam.slice(0, 80));
ok("B1 模块级执行时机的实验证据在页", t.includes("running as main") && t.includes("module loaded"));

// E-B2 管线：三种 _run_model 结果必须经同一 checkpoint；前三阶段 error 明确绕过。
await goAe("turn-pipeline");
t = await bodyText();
ok("B2 图上六个阶段", (await page.locator(".ae-svg-stage").count()) === 6);
ok("B2 文字层也逐阶段说明", (await page.locator(".ae-pipe-notes li").count()) === 6);
ok("B2 save_state checkpoint 唯一", (await page.locator('.ae-fig-pipe [data-node="save-state"][data-checkpoint="true"]').count()) === 1);
const b2Paths = await page.locator('.ae-fig-pipe .ae-svg-outcome-path[data-path]').evaluateAll((paths) =>
  paths.map((path) => ({
    id: path.dataset.path,
    edges: [...path.querySelectorAll('[data-from][data-to]')].map((edge) => `${edge.dataset.from}->${edge.dataset.to}`),
  })));
ok("B2 三种 run-model outcome 都经 save-state", b2Paths.length === 3 && b2Paths.every((path) =>
  path.edges.includes("run-model->save-state")), JSON.stringify(b2Paths));
ok("B2 success 在 checkpoint 后继续 collect 与 dispatch", b2Paths.find((path) => path.id === "success")?.edges.join("|") ===
  "run-model->save-state|save-state->collect-outbounds|collect-outbounds->dispatch-outbound|dispatch-outbound->success", JSON.stringify(b2Paths));
const b2Bypasses = await page.locator('.ae-fig-pipe .ae-svg-bypass-edge[data-from][data-to][data-excludes]').evaluateAll((edges) =>
  edges.map((edge) => `${edge.dataset.from}->${edge.dataset.to}:${edge.dataset.excludes}`).sort());
ok("B2 前三阶段 error 结构化绕过 save-state", b2Bypasses.join(",") ===
  "build-prompt->early-error:save-state,build-state->early-error:save-state,resolve-session->early-error:save-state", b2Bypasses.join(","));
const b2CancelEvidence = await page.locator('.ae-pipe-end[data-outcome="cancelled"] [data-scope][data-target-verified]').evaluateAll((els) =>
  els.map((el) => `${el.dataset.scope}:${el.dataset.targetVerified}`).sort());
ok("B2 取消同时标等价实测与 Bub 待运行", b2CancelEvidence.join(",") ===
  "Bub @ 33c417a:false,Python 3.12.10 等价结构:true", b2CancelEvidence.join(","));
ok("B2 调用 hook 不等于持久化成功", t.includes("调用 hook 不等于持久化成功"));

// E-B3 tape：共同前置、默认四类渲染、替代 renderer 分支、读写闭环与帧序
await goAe("tape-context");
t = await bodyText();
// 图画的是规则（过滤链 + 闭环），不是某次真实会话的记录序列——
// 上一版画成序列是虚构（笔记只有类型清单与规则，实例属 C3，待 D4/D5 dump）。
// 这一组断言守的就是「画规则」这件事本身。
ok("B3 tape 是记录集合，七类齐全", (await page.locator(".ae-svg-kind").count()) === 7);
ok("B3 两个共同前置加默认 renderer", (await page.locator(".ae-svg-gate").count()) === 3);
const b3Gates = await page.locator(".ae-svg-gate").evaluateAll((els) => els.map((e) => e.dataset.gate));
ok("B3 读取阶段编号 1→2→3", b3Gates.join(",") === "1,2,3", b3Gates.join(","));
const b3StageKinds = await page.locator(".ae-svg-gate").evaluateAll((els) => els.map((e) => e.dataset.stageKind));
ok("B3 前两步共同、第三步默认渲染", b3StageKinds.join(",") === "common,common,default-renderer", b3StageKinds.join(","));
const b3RenderedKinds = await page.locator('.ae-svg-kind[data-default-rendered="true"]').evaluateAll((els) =>
  els.map((e) => e.dataset.kind).sort());
ok("B3 默认 _select_messages 渲染四类",
  b3RenderedKinds.join(",") === "anchor,message,tool_call,tool_result", b3RenderedKinds.join(","));
const b3DiscardedKinds = await page.locator('.ae-svg-kind[data-default-discarded="true"]').evaluateAll((els) =>
  els.map((e) => e.dataset.kind).sort());
ok("B3 默认 _select_messages 丢弃三类",
  b3DiscardedKinds.join(",") === "error,event,system", b3DiscardedKinds.join(","));
const b3Projection = await page.locator('[data-zone="projection"] .ae-svg-kept').evaluateAll((els) =>
  els.map((e) => `${e.dataset.kind}:${e.dataset.outputRole}`).sort());
ok("B3 历史投影保留四类输出角色",
  b3Projection.join(",") === "anchor:assistant,message:payload role,tool_call:assistant,tool_result:tool", b3Projection.join(","));
ok("B3 默认丢弃区单独画出", (await page.locator('[data-node="dropped"]').count()) === 1);
ok("B3 历史与本轮输入是两个来源",
  (await page.locator('[data-zone="projection"]').count()) === 1 &&
  (await page.locator('[data-zone="current"]').count()) === 1);
const b3Alternatives = await page.locator('[data-selector-alternative]').evaluateAll((els) =>
  [...new Set(els.map((e) => e.dataset.selectorAlternative))].sort());
ok("B3 custom 与 fallback 是两个替代 renderer", b3Alternatives.join(",") === "custom,fallback", b3Alternatives.join(","));
const b3AlternativeEdges = await page.locator('.ae-svg-selector-alternative [data-from][data-to]').evaluateAll((els) =>
  els.map((e) => `${e.dataset.from}->${e.dataset.to}`).sort());
ok("B3 替代 renderer 从共同前置后分叉",
  b3AlternativeEdges.join(",") === "gate-2->projection,gate-2->projection", b3AlternativeEdges.join(","));
ok("B3 fallback 明确非默认且只挑 message",
  t.includes("select=None") && t.includes("_default_messages") && t.includes("不是 Bub 默认 context"));
const b3EdgeCount = await page.locator('.ae-tape-figure [data-from][data-to]').count();
ok("B3 图上十一条读写与 selector 边都有端点", b3EdgeCount === 11, `${b3EdgeCount} 条`);
const b3Edges = await page.locator('.ae-tape-figure [data-from][data-to]').evaluateAll((els) =>
  els.map((el) => `${el.dataset.from}->${el.dataset.to}`));
for (const expected of [
  "tape->gate-1", "gate-1->gate-2", "gate-2->gate-3", "gate-3->projection",
  "current->messages", "projection->messages", "messages->model", "model->tool", "tool->tape",
]) ok(`B3 SVG 边 ${expected}`, b3Edges.includes(expected), b3Edges.join(" | "));
const b3FirstRead = page.locator('.ae-tape-figure [data-from="tape"][data-to="gate-1"]');
ok("B3 起始帧不会提前点亮第一段读取", !(await b3FirstRead.getAttribute("class")).includes(" on"));
await page.locator(".ae-frame-track button").nth(1).click();
ok("B3 进入范围帧后点亮第一段读取", (await b3FirstRead.getAttribute("class")).includes(" on"));
// 闭环：写回那条弧的终点必须落回 tape 集合，否则「下一轮从同一处再读」这个结论就断了
const b3WriteCount = await page.locator('[data-dir="write"][data-to="tape"]').count();
ok("B3 写回弧唯一且目标为 tape", b3WriteCount === 1, `${b3WriteCount} 条`);
const b3Loop = b3WriteCount === 1 ? await page.evaluate(() => {
  const el = document.querySelector('[data-dir="write"]');
  const end = el.getPointAtLength(el.getTotalLength());
  const store = document.querySelector('[data-node="tape"] rect').getBBox();
  return {
    endX: end.x, endY: end.y,
    x0: store.x, x1: store.x + store.width, y0: store.y, y1: store.y + store.height,
  };
}) : null;
ok("B3 写回弧闭环回到 tape",
  b3Loop && b3Loop.endX >= b3Loop.x0 - 20 && b3Loop.endX <= b3Loop.x1 + 20 &&
  b3Loop.endY >= b3Loop.y0 - 20 && b3Loop.endY <= b3Loop.y1 + 20,
  b3Loop ? `end ${Math.round(b3Loop.endX)},${Math.round(b3Loop.endY)} in ${Math.round(b3Loop.x0)}-${Math.round(b3Loop.x1)}` : "write edge missing");
// 页面不得再声称画的是一次真实会话
ok("B3 明确标注画的不是真实会话内容", t.includes("不是某次真实会话的 tape 内容"));
ok("B3 D4 未覆盖 Bub tape 且真实会话 dump 待验证", t.includes("D4 未覆盖 Bub tape") && t.includes("真实会话 dump") && t.includes("仍待验证"));
const b3Frames = await page.locator(".ae-frame-track button").evaluateAll((els) => els.map((e) => e.dataset.phase));
ok("B3 帧序 read → model → append",
  b3Frames.indexOf("read") < b3Frames.indexOf("model") && b3Frames.indexOf("model") < b3Frames.indexOf("append"),
  b3Frames.join(","));
ok("B3 工具路径帧含执行步", b3Frames.includes("execute"));
// 纯文本路径必须显式说明不含工具执行，否则读者会把工具条目当成模型返回就写
await page.locator(".ae-tape-paths button", { hasText: "纯文本路径" }).click();
await page.waitForTimeout(160);
const b3Text = await page.locator(".ae-frame-track button").evaluateAll((els) => els.map((e) => e.dataset.phase));
ok("B3 纯文本路径无执行帧", !b3Text.includes("execute"), b3Text.join(","));

// E-B4 状态机：断言直接落在 SVG 节点、边、条件和逐帧激活状态上。
await goAe("step-loop");
t = await bodyText();
const b4LayerCount = await page.locator(".ae-fig-machine .ae-svg-band-zone[data-layer]").count();
ok("B4 SVG 有三个控制分区", b4LayerCount === 3, `${b4LayerCount} 个`);
const b4Layers = await page.locator(".ae-fig-machine .ae-svg-band-zone[data-layer]").evaluateAll((els) => els.map((e) => e.dataset.layer));
ok("B4 SVG 分区层次为 1→2→3", b4Layers.join(",") === "1,2,3", b4Layers.join(","));
const b4NodeCount = await page.locator(".ae-fig-machine .ae-svg-mnode[data-node]").count();
const b4EdgeCount = await page.locator(".ae-fig-machine .ae-svg-medge[data-from][data-to][data-condition]").count();
ok("B4 SVG 有十一节点", b4NodeCount === 11, `${b4NodeCount} 个`);
ok("B4 SVG 有十二条带条件的边", b4EdgeCount === 12, `${b4EdgeCount} 条`);
const b4Topology = await page.evaluate(() => {
  const nodes = new Set([...document.querySelectorAll(".ae-fig-machine .ae-svg-mnode[data-node]")].map((el) => el.dataset.node));
  return [...document.querySelectorAll(".ae-fig-machine .ae-svg-medge[data-from][data-to][data-condition]")].map((el) => ({
    from: el.dataset.from, to: el.dataset.to, condition: el.dataset.condition,
    endpointsExist: nodes.has(el.dataset.from) && nodes.has(el.dataset.to),
  }));
});
ok("B4 所有 SVG 边端点都存在", b4Topology.length === 12 && b4Topology.every((edge) => edge.endpointsExist),
  JSON.stringify(b4Topology.filter((edge) => !edge.endpointsExist)));
const b4ShortCount = await page.locator('.ae-fig-machine .ae-svg-medge[data-shortcircuit="true"][data-condition]').count();
ok("B4 SVG 只有一条短路边", b4ShortCount === 1, `${b4ShortCount} 条`);
const b4Short = await page.locator('.ae-fig-machine .ae-svg-medge[data-shortcircuit="true"][data-condition]').evaluateAll((els) =>
  els.map((e) => ({ from: e.dataset.from, to: e.dataset.to, cond: e.dataset.condition })));
ok("B4 短路边 final → continue", b4Short.length === 1 && b4Short[0].from === "final" && b4Short[0].to === "continue",
  JSON.stringify(b4Short));
ok("B4 短路边不经过 steering", b4Short.every((e) => e.to !== "steering"));
const b4Stop = await page.locator('.ae-fig-machine .ae-svg-medge[data-from="steering"][data-to="stop"]').getAttribute("data-condition");
ok("B4 停止条件同时排除工具调用、工具结果和插话",
  (b4Stop ?? "").includes("没有工具调用、工具结果或插话"), String(b4Stop));
const b4Handoff = await page.locator('.ae-fig-machine .ae-svg-medge[data-from="budget"][data-to="handoff"]').getAttribute("data-condition");
ok("B4 恢复边带次数预算条件", (b4Handoff ?? "").includes("次数还没用完"), String(b4Handoff));
ok("B4 Python or 短路为源码事实", (b4Short[0]?.cond ?? "").includes("Python or 短路"), b4Short[0]?.cond ?? "");
ok("B4 turn 是 step loop 的唯一外层容器",
  (await page.locator('.ae-machine[data-level="turn"] > [data-level="step-loop"]').count()) === 1 &&
  (await page.locator('.ae-board [data-level="turn"]').count()) === 1);
const b4BoundaryCount = await page.locator('.ae-fig-machine .ae-svg-medge[data-from="continue"][data-to="last-step"]').count();
ok("B4 SVG 画出 continue 到循环边界的跨层边", b4BoundaryCount === 1, `${b4BoundaryCount} 条`);
const b4Max = await page.locator('.ae-fig-machine .ae-svg-medge[data-from="last-step"][data-to="max-steps"]').getAttribute("data-condition");
ok("B4 边界是第 max_steps 次仍 continue 后 for 耗尽", (b4Max ?? "").includes("range(1, max_steps + 1)") &&
  t.includes("没有 step 4"), String(b4Max));
const b4Experiment = page.locator('.ae-c1-traces[data-max-steps="3"][data-steering="false"][data-branch="tool_calls"]');
ok("B4 C1 固定 max_steps=3 且两条轨迹齐全", (await b4Experiment.count()) === 1 &&
  (await b4Experiment.locator('article[data-trace]').count()) === 2);
const b4TraceData = await b4Experiment.locator('article[data-trace]').evaluateAll((traces) => traces.map((trace) => ({
  id: trace.dataset.trace,
  max: trace.dataset.maxSteps,
  steps: [...trace.querySelectorAll('[data-step]')].map((step) => `${step.dataset.step}:${step.dataset.toolCalls}`),
  terminal: trace.querySelector('[data-terminal]')?.dataset.terminal,
  after: trace.querySelector('[data-terminal]')?.dataset.afterStep,
})));
const b4Repeat = b4TraceData.find((trace) => trace.id === "repeat");
const b4Control = b4TraceData.find((trace) => trace.id === "control");
ok("B4 重复组恰好 step1/2/3 后 RuntimeError", b4Repeat?.steps.join(",") === "1:true,2:true,3:true" &&
  b4Repeat?.terminal === "max_steps_reached=3" && b4Repeat?.after === "3", JSON.stringify(b4Repeat));
ok("B4 对照组在 step2 return", b4Control?.steps.join(",") === "1:true,2:false" &&
  b4Control?.terminal === "return" && b4Control?.after === "2", JSON.stringify(b4Control));
ok("B4 两轨同 max_steps 且无 step4", b4TraceData.every((trace) => trace.max === "3") &&
  (await b4Experiment.locator('[data-step="4"]').count()) === 0);
ok("B4 Bub 本体仍待运行", (await b4Experiment.locator('[data-scope="Bub @ 33c417a"][data-target-verified="false"]').count()) === 1);
ok("B4 移除旧的待验证误写", !t.includes("超过 max_steps") && !t.includes("C1 未实测") && !t.includes("具体触发时机待验证"));

// E-B5 四职责矩阵：D4 的 absent 格必须为空，Bub 四格都要有 owner。
await goAe("roles-nesting");
t = await bodyText();
const b5Rows = await page.locator('.ae-role-row[data-responsibility]').count();
const b5Cells = await page.locator('.ae-role-cell[data-system][data-responsibility][data-status][data-owner]').count();
ok("B5 四职责两系统形成 4x2 矩阵", b5Rows === 4 && b5Cells === 8, `${b5Rows} rows / ${b5Cells} cells`);
const b5D4 = await page.locator('.ae-role-cell[data-system="d4"]').evaluateAll((cells) =>
  cells.map((cell) => `${cell.dataset.responsibility}:${cell.dataset.status}:${cell.dataset.owner}`).sort());
ok("B5 D4 四格 present/manual/absent/absent", b5D4.join(",") ===
  "continue:absent:absent,decide:present:DeepSeek model,execute:manual:调用方 main(),persist:absent:absent", b5D4.join(","));
const b5BubOwners = await page.locator('.ae-role-cell[data-system="bub"]').evaluateAll((cells) =>
  cells.map((cell) => ({ responsibility: cell.dataset.responsibility, owner: cell.dataset.owner, status: cell.dataset.status })));
ok("B5 Bub 四格都有 owner", b5BubOwners.length === 4 && b5BubOwners.every((cell) => cell.owner !== "absent" && cell.status === "present"),
  JSON.stringify(b5BubOwners));
const b5Edges = await page.locator('.ae-role-edges [data-from][data-to]').evaluateAll((edges) =>
  edges.map((edge) => `${edge.dataset.from}->${edge.dataset.to}`));
const b5D4Edges = b5Edges.filter((edge) => edge.startsWith("d4-")).sort();
ok("B5 D4 只有 decide→execute 一条结构边", b5D4Edges.join(",") === "d4-decide->d4-execute", b5D4Edges.join(" | "));
ok("B5 Bub tool result 进入 continuation 与 tape", b5Edges.includes("bub-execute->bub-continue") &&
  b5Edges.includes("bub-execute->bub-persist"), b5Edges.join(" | "));
ok("B5 跨系统职责对齐整体标为推断",
  (await page.locator('.ae-topic-nav button.on em').innerText()) === "推断" &&
  (await page.locator('.ae-roles [data-scope="D4 最小 demo × Bub @ 33c417a"][data-target-verified="false"]').count()) === 1);
ok("B5 不再承担 turn 包含 step", (await page.locator('.ae-roles [data-level]').count()) === 0);

// E-S 源码位置折叠层：主路径讲机制，行号下沉到这一层——但必须仍然在页，否则结论就不可回溯了。
// 这组断言替代了原先「行号出现在舞台上」的覆盖：位置变了，证据不能变没。
const AE_SOURCE_EXPECT = {
  "concept-map": ["w12-concept-map.md §2.1", "w12-concept-map.md §3.1"],
  "async-failure-lifecycle": ["day4-async-and-real-calls.md §11 C-1", "day4-async-and-real-calls.md §11 C-2"],
  "turn-pipeline": ["framework.py 当时 L154-163", "framework.py 当时 L148-152"],
  "tape-context": ["tape.py 当时 L300-307", "context.py 当时 L12-34", "hook_impl.py 当时 L396-398", "tape.py 当时 L159-173", "model_runner.py 当时 L333-336"],
  "step-loop": ["agent.py 当时 L214", "agent.py 当时 L242", "agent.py 当时 L285-286", "agent.py 当时 L309"],
  "roles-nesting": ["day4-async-and-real-calls.md §11 §6.2", "model_runner.py 当时 L504-525"],
};
for (const [topic, refs] of Object.entries(AE_SOURCE_EXPECT)) {
  await goAe(topic);
  ok(`AI 板-${topic} 有源码位置折叠层`, (await page.locator(".ae-sources").count()) === 1);
  const inLayer = await page.locator(".ae-sources").innerText();
  for (const ref of refs) ok(`AI 板-${topic} 源码位置含 ${ref}`, inLayer.includes(ref), inLayer.slice(0, 80));
  // 反向：行号不该再回到主路径（舞台区）上——这块板的主路径只讲机制
  const leaked = await page.evaluate(() => {
    const stage = document.querySelector(".ae-stage-body > section");
    const clone = stage.cloneNode(true);
    // 折叠层无论挂在哪里都算证据层（.ae-sources 在舞台外，各块自带的 details 在舞台内）
    clone.querySelectorAll("details").forEach((node) => node.remove());
    return clone.innerText.match(/[A-Za-z_]+\.py:\d+/g) ?? [];
  });
  ok(`AI 板-${topic} 主路径无源码行号`, leaked.length === 0, [...new Set(leaked)].slice(0, 3).join("|"));
}

const AE_DETAIL_TARGETS = {
  "concept-map": [
    "w12concept:2.1", "w12concept:2.2", "w12concept:2.3",
    "w12concept:2.4", "w12concept:2.5", "w12concept:3.1",
  ],
  "async-failure-lifecycle": ["w12d4:11", "w12d4:11", "w12d4:11"],
  "entry-chain": ["w12d3:4", "w12bub:1", "w12d3:额外经验与拓展", "w12viz:4.4", "w12bub:8"],
  "turn-pipeline": ["w12bub:2", "w12bub:2", "w12bub:2", "w12d4:11"],
  "tape-context": Array(8).fill("w12bub:4"),
  "step-loop": ["w12bub:5", "w12bub:5", "w12bub:5", "w12bub:5", "w12bub:5", "w12d4:11"],
  "roles-nesting": ["w12d4:11", "w12bub:5", "w12bub:5", "w12bub:5"],
};
const detailHrefs = [];
for (const [topic, expectedTargets] of Object.entries(AE_DETAIL_TARGETS)) {
  await goAe(topic);
  const items = await page.locator('.ae-sources li').evaluateAll((rows) => rows.map((row) => {
    const link = row.querySelector('a[data-note-target][data-note-section]');
    return {
      target: link ? `${link.dataset.noteTarget}:${link.dataset.noteSection}` : "missing",
      href: link?.getAttribute("href") ?? "",
    };
  }));
  ok(`AI 板-${topic} 每条细项来源都有精确笔记目标`,
    JSON.stringify(items.map((item) => item.target)) === JSON.stringify(expectedTargets),
    items.map((item) => item.target).join(" | "));
  ok(`AI 板-${topic} 每条细项来源都返回发起专题`, items.every((item) => {
    const params = new URLSearchParams(item.href.split("?", 2)[1] ?? "");
    return params.get("returnTab") === "ai-engineer" && params.get("returnTopic") === topic;
  }), items.map((item) => item.href).join(" | "));
  detailHrefs.push(...items.map((item) => {
    const [noteId, ...sectionParts] = item.target.split(":");
    return { topic, noteId, section: sectionParts.join(":"), href: item.href };
  }));
}

// 真实点击一条细项来源，再点击正文中的页内 #；两次都必须保持 SPA 的 note/topic 语义。
await goAe("entry-chain");
await page.locator('.ae-sources a[data-note-target="w12viz"][data-note-section="4.4"]').click();
let detailSourceHash = await page.evaluate(() => window.location.hash);
ok("细项来源真实点击进入精确笔记章节",
  detailSourceHash.includes("mode=review") && detailSourceHash.includes("topic=w12viz") &&
  detailSourceHash.includes("section=4.4") && detailSourceHash.includes("returnTopic=entry-chain"),
  detailSourceHash);
await page.locator('.notes-return[data-return-topic="entry-chain"]').waitFor({ state: "visible" });
ok("复习门前已有语义化返回原专题入口",
  (await page.locator('.notes-return[data-return-topic="entry-chain"]').count()) === 1 &&
  (await page.locator('.notes-return').innerText()).includes("两条启动路径汇入第一次 turn"));
await page.locator('.notes-recall button').click();
await page.waitForSelector('.markdown-reader [data-note-section="4.4"]', { state: "visible" });
const inPageLink = page.locator('.markdown-reader a', { hasText: "实现结果与证据边界" });
await inPageLink.waitFor({ state: "visible" });
await inPageLink.click();
await page.waitForFunction(() => window.location.hash.includes("section=13.7"));
detailSourceHash = await page.evaluate(() => window.location.hash);
const inPageTargetGeometry = await page.locator('.markdown-reader [data-note-section="13.7"]').evaluate((heading) => ({
  top: Math.round(heading.getBoundingClientRect().top),
  viewport: window.innerHeight,
}));
ok("笔记页内 # 点击保持 SPA 笔记、返回上下文并写入稳定 section",
  detailSourceHash.includes("mode=review") && detailSourceHash.includes("topic=w12viz") &&
  detailSourceHash.includes("section=13.7") && detailSourceHash.includes("returnTopic=entry-chain"),
  detailSourceHash);
ok("笔记页内 # 点击后真实标题进入视口",
  inPageTargetGeometry.top >= 0 && inPageTargetGeometry.top < inPageTargetGeometry.viewport,
  JSON.stringify(inPageTargetGeometry));
const crossNoteLink = page.locator('.markdown-reader a[href*="topic=w12concept"]', { hasText: "w12-concept-map.md" });
await crossNoteLink.click();
await page.waitForSelector('.markdown-reader [data-note-section="2"]', { state: "visible" });
detailSourceHash = await page.evaluate(() => window.location.hash);
ok("笔记间真实链接保持原专题返回上下文",
  detailSourceHash.includes("topic=w12concept") && detailSourceHash.includes("section=2") &&
  detailSourceHash.includes("returnTab=ai-engineer") && detailSourceHash.includes("returnTopic=entry-chain"),
  detailSourceHash);

// E-N 笔记接线：主来源与概念反查都是可导航结构，不接受只把文件名写在页面上。
const AE_PRIMARY_TARGETS = {
  "concept-map": ["w12concept", "2"],
  "py-syntax": ["w12d2", "5"],
  "cli-dispatch": ["w12d3", "8"],
  "async-failure-lifecycle": ["w12d4", "11"],
  "entry-chain": ["w12bub", "1"],
  "turn-pipeline": ["w12bub", "2"],
  "tape-context": ["w12bub", "4"],
  "step-loop": ["w12bub", "5"],
  "roles-nesting": ["w12bub", "5"],
};
const AE_REVERSE_CONCEPTS = {
  "py-syntax": ["2.1"],
  "cli-dispatch": ["2.2", "2.5"],
  "async-failure-lifecycle": ["2.1", "2.2"],
  "entry-chain": ["2.4", "2.5"],
  "turn-pipeline": ["2.4"],
  "tape-context": ["2.4"],
  "step-loop": ["2.4"],
  "roles-nesting": ["2.3", "2.4"],
};
const primaryHrefs = [];
for (const [topic, [noteId, section]] of Object.entries(AE_PRIMARY_TARGETS)) {
  await goAe(topic, { expand: false });
  const link = page.locator(`.ae-source a[data-note-target="${noteId}"][data-note-section="${section}"]`);
  const linkCount = await link.count();
  const href = linkCount === 1 ? await link.getAttribute("href") : "";
  const params = new URLSearchParams((href ?? "").split("?", 2)[1] ?? "");
  ok(`AI 板-${topic} 主来源精确指向 ${noteId} §${section}`,
    linkCount === 1 && params.get("tab") === "notes" && params.get("topic") === noteId && params.get("section") === section,
    href ?? "missing");
  ok(`AI 板-${topic} 主来源返回发起专题`,
    params.get("returnTab") === "ai-engineer" && params.get("returnTopic") === topic,
    href ?? "missing");
  if (["w12d2", "w12d3", "w12d4"].includes(noteId)) {
    ok(`AI 板-${topic} 复习材料链接自动进入复习态`, params.get("mode") === "review", href ?? "missing");
  }
  primaryHrefs.push({ topic, noteId, section, href: href ?? "" });

  if (topic !== "concept-map") {
    const actualConcepts = await page.locator(".ae-topic-context [data-concept]").evaluateAll((items) =>
      items.map((item) => item.dataset.concept));
    ok(`AI 板-${topic} 反查概念入口精确`,
      JSON.stringify(actualConcepts) === JSON.stringify(AE_REVERSE_CONCEPTS[topic]), actualConcepts.join(","));
  }
}

// 逐一打开主来源，证明目标章节真实存在；相同 §5 只加载一次，但两个专题的 href 上面分别受保护。
const uniquePrimaryHrefs = [...primaryHrefs, ...detailHrefs].filter((item, index, all) =>
  all.findIndex((candidate) => candidate.noteId === item.noteId && candidate.section === item.section) === index);
for (const { noteId, section, href } of uniquePrimaryHrefs) {
  await page.goto(new URL(href, BASE).href, { waitUntil: "networkidle" });
  const reveal = page.locator(".notes-recall button");
  if ((await reveal.count()) === 1) await reveal.click();
  const targetHeading = `.markdown-reader [data-note-section="${section}"]`;
  await page.waitForSelector(targetHeading, { state: "visible" });
  ok(`笔记 ${noteId} 的 §${section} 深链落到真实标题`, (await page.locator(targetHeading).count()) === 1);
}

// 从概念节点进入 §2.5，刷新仍留在同一节；显式入口必须回到发起导航的概念图。
await goAe("concept-map", { expand: false });
await page.locator('.ae-concept-landing-list article[data-concept="2.5"] a[data-note-section="2.5"]').click();
await page.waitForSelector('.markdown-reader [data-note-section="2.5"]', { state: "visible" });
let noteHash = await page.evaluate(() => window.location.hash);
ok("概念节点真实点击到 W12 概念原文 §2.5",
  noteHash.includes("tab=notes") && noteHash.includes("topic=w12concept") && noteHash.includes("section=2.5") &&
  noteHash.includes("returnTab=ai-engineer") && noteHash.includes("returnTopic=concept-map") &&
  (await page.locator('.notes-toc a[aria-current="location"][href*="section=2.5"]').count()) === 1, noteHash);
const conceptReturn = page.locator('.notes-return[data-return-topic="concept-map"]');
ok("概念原文显示语义化显式返回入口",
  (await conceptReturn.count()) === 1 && (await conceptReturn.innerText()).includes("概念地图总览"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('.markdown-reader [data-note-section="2.5"]', { state: "visible" });
noteHash = await page.evaluate(() => window.location.hash);
ok("刷新保留笔记、章节与返回上下文",
  noteHash.includes("topic=w12concept") && noteHash.includes("section=2.5") &&
  noteHash.includes("returnTopic=concept-map") && (await conceptReturn.count()) === 1, noteHash);
await conceptReturn.click();
await page.waitForSelector('.ae-concept-figure', { state: "visible" });
ok("笔记显式返回入口回到概念地图并清除笔记状态",
  (await page.evaluate(() => window.location.hash)).includes("topic=concept-map") &&
  !(await page.evaluate(() => window.location.hash)).includes("returnTopic=") &&
  (await page.locator('.ae-topic-nav button.on').innerText()).includes("概念地图总览"));

// 复习门必须保留精确目标，揭示后再定位，而不是悄悄切到别篇或文首。
await goAe("async-failure-lifecycle", { expand: false });
await page.locator('.ae-source a[data-note-target="w12d4"][data-note-section="11"]').click();
ok("复习材料链接保留 mode=review 与 section=11",
  (await page.evaluate(() => window.location.hash)).includes("mode=review") &&
  (await page.evaluate(() => window.location.hash)).includes("section=11") &&
  (await page.evaluate(() => window.location.hash)).includes("returnTopic=async-failure-lifecycle"));
const asyncReturn = page.locator('.notes-return[data-return-topic="async-failure-lifecycle"]');
await asyncReturn.waitFor({ state: "visible" });
ok("复习材料揭示前也能显式返回准确专题",
  (await asyncReturn.count()) === 1 &&
  (await asyncReturn.innerText()).includes("HTTP 等待失败后的传播与清理") &&
  (await asyncReturn.getAttribute("href")).includes("mode=review"));
await asyncReturn.click();
await page.waitForSelector('.ae-recall-gate', { state: "visible" });
ok("复习材料返回保持当前复习态并命中原专题",
  (await page.evaluate(() => window.location.hash)).includes("topic=async-failure-lifecycle") &&
  (await page.locator('.ae-topic-nav button.on').innerText()).includes("HTTP 等待失败后的传播与清理"));
await goAe("async-failure-lifecycle", { expand: false });
await page.locator('.ae-source a[data-note-target="w12d4"][data-note-section="11"]').click();
ok("复习门说明将定位目标章节",
  (await page.locator('.notes-recall button').innerText()).includes("定位目标章节"));
await page.locator('.notes-recall button').click();
await page.waitForSelector('.markdown-reader [data-note-section="11"]', { state: "visible" });
ok("揭示后落到 W12 D4 §11", (await page.locator('.notes-toc a[aria-current="location"][href*="section=11"]').count()) === 1);

// 未知章节沿用同一个 data-note-section 判据做负控，并给出明确回退提示。
await page.goto(`${BASE}/#/showcase?tab=notes&topic=w12concept&section=not-a-section`, { waitUntil: "networkidle" });
await page.waitForSelector('.notes-section-notice', { state: "visible" });
const knownSections = await page.locator('.markdown-reader [data-note-section]').evaluateAll((items) =>
  items.map((item) => item.dataset.noteSection));
ok("笔记章节存在性负控能抓住错误 section", knownSections.includes("2.5") && !knownSections.includes("not-a-section"));
ok("未知 section 明示回退文首", (await page.locator('.notes-section-notice').innerText()).includes("未找到章节 not-a-section"));

// 返回参数必须成对白名单化；不得把伪造或残缺 topic 回退成第一块。
for (const suffix of [
  "returnTab=notes&returnTopic=concept-map",
  "returnTab=ai-engineer&returnTopic=not-a-real-topic",
  "returnTab=ai-engineer",
  "returnTopic=concept-map",
]) {
  await page.goto(`${BASE}/#/showcase?tab=notes&topic=w12concept&${suffix}`, { waitUntil: "networkidle" });
  ok(`非法或残缺返回上下文不显示入口 ${suffix}`,
    (await page.locator('.notes-return').count()) === 0);
}

// 正常换笔记、切 tab 都必须清 section，防止跨文档复用旧章节号。
await page.goto(`${BASE}/#/showcase?tab=notes&topic=w12concept&section=2.5&returnTab=ai-engineer&returnTopic=concept-map`, { waitUntil: "networkidle" });
await page.locator('.notes-index button', { hasText: "W12 Bub 阅读报告" }).click();
await page.waitForTimeout(120);
noteHash = await page.evaluate(() => window.location.hash);
ok("换笔记清除旧 section 并保留返回上下文",
  noteHash.includes("topic=w12bub") && !noteHash.includes("section=") &&
  noteHash.includes("returnTopic=concept-map") && (await page.locator('.notes-return').count()) === 1, noteHash);
await page.goto(`${BASE}/#/showcase?tab=notes&topic=w12concept&section=2.5&returnTab=ai-engineer&returnTopic=concept-map`, { waitUntil: "networkidle" });
await page.locator('.showcase-tabs button', { hasText: "AI 工程" }).click();
await page.waitForTimeout(120);
noteHash = await page.evaluate(() => window.location.hash);
ok("切 tab 同时清 topic、section 与返回上下文",
  noteHash.includes("tab=ai-engineer") && !noteHash.includes("topic=") &&
  !noteHash.includes("section=") && !noteHash.includes("returnTopic="), noteHash);

// 同名文件必须按完整 repoPath 解析：W11 的相对链接不能误跳到 W9 同名笔记。
await page.goto(`${BASE}/#/showcase?mode=review&tab=notes&topic=w11viz`, { waitUntil: "networkidle" });
await page.locator('.notes-recall button').click();
await page.waitForSelector('.markdown-reader a[href*="topic=w11freeze"]', { state: "visible" });
const w11FreezeLink = page.locator('.markdown-reader a[href*="topic=w11freeze"]').first();
ok("W11 同名 day1-contract-freeze 链接按完整路径命中 W11",
  !(await w11FreezeLink.getAttribute("href")).includes("topic=w9d1"));
await w11FreezeLink.click();
await page.waitForTimeout(120);
noteHash = await page.evaluate(() => window.location.hash);
ok("W11 同名链接真实点击不串到 W9", noteHash.includes("topic=w11freeze") && !noteHash.includes("topic=w9d1"), noteHash);

// E-X 手机档：除横向对象 B3 与职责矩阵 B5 外，其余七块显示等价窄屏主图并隐藏桌面 SVG。
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/#/showcase?tab=notes&topic=w12concept&section=2.5&returnTab=ai-engineer&returnTopic=concept-map`, { waitUntil: "networkidle" });
await page.waitForSelector('.notes-index-picker', { state: "visible" });
ok("笔记手机态使用分组选单并隐藏桌面长列表",
  await page.locator('.notes-index-picker').isVisible() && !(await page.locator('.notes-index').isVisible()) &&
  (await page.locator('.notes-index-picker optgroup[label="W12 核心链"] option').count()) === 3);
await page.locator('.notes-index-picker select').selectOption("w12bub");
await page.waitForTimeout(120);
noteHash = await page.evaluate(() => window.location.hash);
ok("手机选单切笔记、清除旧 section 并保留返回上下文",
  noteHash.includes("topic=w12bub") && !noteHash.includes("section=") &&
  noteHash.includes("returnTopic=concept-map") && (await page.locator('.notes-return').count()) === 1, noteHash);

const AE_MOBILE_SVG = {
  "concept-map": ".ae-concept-figure",
  "py-syntax": ".ae-fig-map",
  "cli-dispatch": ".ae-fig-align",
  "async-failure-lifecycle": ".ae-fig-failure",
  "entry-chain": ".ae-fig-entry",
  "turn-pipeline": ".ae-fig-pipe",
  "step-loop": ".ae-fig-machine",
};
for (const topic of AE_TOPICS) {
  await goAe(topic, { expand: false });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`AI 板-${topic} 手机无横向溢出`, overflow <= 0, `+${overflow}px`);
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".ae-board button, .ae-board summary").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.width < 24 || r.height < 24) bad.push(`${el.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return bad.slice(0, 3);
  });
  ok(`AI 板-${topic} 触控 ≥24px`, small.length === 0, small.join("|"));
  if (topic === "tape-context") {
    ok("B3 手机保留横向 tape 图", await page.locator(".ae-tape-figure").isVisible());
    ok("B3 手机显示横向滑动提示", await page.locator(".ae-tape-figure-wrap .mobile-scroll-cue").isVisible());
  } else if (topic === "roles-nesting") {
    ok("B5 手机职责矩阵可见", await page.locator('.ae-role-matrix[data-mobile-visual="roles-nesting"]').isVisible());
  } else {
    const mobile = page.locator(`[data-mobile-visual="${topic}"]`);
    const mobileCount = await mobile.count();
    ok(`AI 板-${topic} 手机等价图唯一`, mobileCount === 1, `${mobileCount} 个`);
    ok(`AI 板-${topic} 手机等价图可见`, mobileCount === 1 && await mobile.isVisible());
    ok(`AI 板-${topic} 手机隐藏桌面 SVG`, !(await page.locator(AE_MOBILE_SVG[topic]).isVisible()));
  }
}
await goAe("py-syntax", { expand: false });
ok("P1 手机图仍有六个语义单元", (await page.locator('.ae-mobile-map article[data-unit]').count()) === 6);
await goAe("cli-dispatch", { expand: false });
ok("P3 手机图仍有四组成立/失效对照", (await page.locator('.ae-mobile-align article[data-pos]').count()) === 4);
await goAe("async-failure-lifecycle", { expand: false });
ok("P4 手机图是三条纵向等价轨迹", (await page.locator('.ae-mobile-failure article[data-trace]').count()) === 3 &&
  (await page.locator('.ae-mobile-failure article[data-trace] li[data-ordinal]').count()) === 15);
await goAe("entry-chain", { expand: false });
ok("B1 手机图仍有两条启动线和一个汇合点",
  (await page.locator('.ae-mobile-entry [data-lane]').count()) === 2 &&
  (await page.locator('.ae-mobile-entry .ae-mobile-node.join[data-node="dispatch"]').count()) === 1);
await goAe("turn-pipeline", { expand: false });
ok("B2 手机图保留前三阶段 bypass、protected region 与三条 checkpoint 分支",
  (await page.locator('.ae-mobile-pipe li[data-bypass-to="early-error"][data-excludes="save-state"]').count()) === 3 &&
  (await page.locator('.ae-mobile-pipe [data-region="run-model-finally"] [data-checkpoint="true"]').count()) === 1 &&
  (await page.locator('.ae-mobile-pipe .ae-mobile-ends [data-via="save-state"]').count()) === 3);
await goAe("step-loop", { expand: false });
ok("B4 手机图仍有三个控制分区", (await page.locator('.ae-mobile-machine section[data-layer]').count()) === 3);
await goAe("roles-nesting", { expand: false });
ok("B5 手机按四项职责逐项成对", (await page.locator('.ae-role-row[data-responsibility]').count()) === 4 &&
  (await page.locator('.ae-role-row[data-responsibility] .ae-role-cell').count()) === 8);
await goAe("concept-map", { expand: false });
const conceptMobileNodes = await page.locator('.ae-mobile-concept [data-node][data-zone]').evaluateAll((nodes) =>
  nodes.map((node) => `${node.dataset.node}:${node.dataset.zone}`).sort());
ok("概念地图手机图保留五节点与左右分区",
  conceptMobileNodes.join(",") === "2.1:left,2.2:left,2.3:right,2.4:right,2.5:right", conceptMobileNodes.join(","));
const conceptMobileEdges = await page.locator('.ae-mobile-concept-route[data-from][data-to][data-relation][data-evidence]').evaluateAll((edges) =>
  edges.map((edge) => ({
    key: `${edge.dataset.from}->${edge.dataset.to}`,
    inferenceMarks: edge.querySelectorAll('.ae-concept-inference').length,
  })));
ok("概念地图手机图保留七条有向关系", conceptMobileEdges.length === 7, `${conceptMobileEdges.length} 条`);
ok("概念地图手机图仍只标两条推断边",
  conceptMobileEdges.filter((edge) => edge.inferenceMarks === 1).map((edge) => edge.key).sort().join(",") === "2.2->2.4,2.3->2.4" &&
  conceptMobileEdges.filter((edge) => edge.inferenceMarks === 0).length === 5,
  JSON.stringify(conceptMobileEdges));
const conceptMobileTargets = await page.locator('.ae-mobile-concept a[data-note-section], .ae-concept-landing-list button[data-landing-topic]').evaluateAll((items) =>
  items.map((item) => {
    const rect = item.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  }));
ok("概念地图手机节点与专题入口触控尺寸 ≥24px",
  conceptMobileTargets.length === 17 && conceptMobileTargets.every((item) => item.width >= 24 && item.height >= 24),
  JSON.stringify(conceptMobileTargets.filter((item) => item.width < 24 || item.height < 24)));
ok("概念地图桌面与手机节点都是原生可聚焦链接",
  (await page.locator('.ae-concept-figure a[href][data-note-section]').count()) === 5 &&
  (await page.locator('.ae-mobile-concept a[href][data-note-section]').count()) === 5);
await page.setViewportSize({ width: 1440, height: 1000 });

// 展板本体零后端；门禁的 /auth 只在真的去登录时才发，这条断言路径上不会触发
ok("零后端请求", apiCalls.length === 0, apiCalls.slice(0, 2).join(" | "));
ok("AI 工程与笔记深链全程无 console error", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
console.log(`AI 工程专项：通过 ${passed - aePassedAtStart} 项，失败 ${failures.length - aeFailuresAtStart} 项`);

await browser.close();
server.close();

console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
if (failures.length) {
  console.log("\n失败明细：");
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
