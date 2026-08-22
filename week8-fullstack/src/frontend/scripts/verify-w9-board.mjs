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
 * 名字叫 verify-w9-board，但 §B3 起它同时守着**全站十个 tab 的排版下限**，
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
ok("生产对照 鉴权进已做", t.includes("应用层鉴权"));

// ⑦ 证书：timer 档位升级，但仍不证明续签成功
await goTopic("cert");
await revealAll();
t = await bodyText();
ok("证书 LAST 实测", t.includes("04:14:01"));
ok("证书 仍不证明续签成功", t.includes("跳过") || t.includes("不证明"));

// ⑧ 暴露面：两天各选了一种切法
await goTopic("exposure");
await revealAll();
t = await bodyText();
ok("暴露 路径也被选过", t.includes("D5（8/14）admin 迁 443 用它"));
ok("暴露 端口那次仍在", t.includes("D4-c（8/13）"));
ok("暴露 证书按域名签是分水岭", t.includes("证书按域名签"));
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

/* ====================================================== B3. 全站排版（十个 tab）

   B2 那组断言只看 W9。但 W9 暴露出来的三类缺陷都不是 W9 独有的机制：
     · 正文掉进元信息梯子      —— 任何「容器设了元信息号、里面却放了要读的句子」都会中
     · 桌面档漏项              —— 各板的 min-width: 1200px 档是**手写清单**，漏一个不报错，
                                  只会安静地小一号；实测就抓到 W6 漏了 3 个选择器、
                                  全站共用的 .global-viz-legend 说明段漏在所有板上
     · 控件字体族              —— 全局的，一处漏写全站都中
   所以这三条要在十个 tab 上都跑一遍。桌面与手机各有下限：桌面 12px（各板正文档），
   手机 11.5px（W6 一系的正文基础值就是 11.5px，不能按桌面的尺子量）。
*/

const SHOWCASE_TABS = ["auth", "oauth2", "architecture", "database", "runtime", "testing", "deploy", "observability", "interview", "notes"];

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
ok("W10⑧ 根因定论了也不把未实测写成红", w10t.includes("四格全部保持未实测"));
ok("W10⑧ 修复方向已定但先不动手", w10t.includes("机制没复现之前不动手"));


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
ok("架构板 六条泳道都渲染", (await page.locator(".arch-flow-lane").count()) === 6);
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

// 移交 W11 的两项在板上必须仍写着「未验证 / 待做」，不能因为周结束就被读成已完成。
await goW10("drill-blinds");
await revealAll();
const w10Handover = await bodyText();
ok("时效-W10 假 active 仍标机制未验证", w10Handover.includes("机制未验证"));
ok("时效-W10 假 active 去处指向 W11", w10Handover.includes("W11"));

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

/* ====== H. OAuth2 三泳道序列图与 W6 Day4 十层交接链（2026-08-22 第十轮）

   两块的结论此前都由颜色 + 文字标签承载：
     · OAuth2 的前信道 / 后信道 —— 只有一个彩色 chip 和一句话
     · Day4 的 shape 分类       —— 只作为 CSS class 存在，没有可见标签
   roadmap 明令「颜色单独承载信息（必须有第二编码）」。改成序列图与交接链之后，
   第二编码分别是「箭头有没有触到浏览器列」和「交付物令牌成为一列可比的芯片」，
   下面这几条守的就是这两个几何事实。
*/

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${BASE}/#/showcase?tab=oauth2`, { waitUntil: "networkidle" });

await page.waitForTimeout(350);

ok("OAuth2 序列 六段消息", (await page.locator(".oauth-seq > li").count()) === 6);
ok("OAuth2 序列 每行三条生命线", (await page.locator(".oauth-seq > li").first().locator(".oauth-seq-life").count()) === 3);

// OAUTH_STEPS 的 from/to 是 browser→third / third→browser / browser→backend /
// backend→third / backend→third / backend→browser，列序 browser=1 backend=2 third=3，
// 箭头按 min..max 跨列 → 1-4 | 1-4 | 1-3 | 2-4 | 2-4 | 1-3。
const oauthSpans = await page.evaluate(() =>
  [...document.querySelectorAll(".oauth-seq .oauth-seq-arrow")].map((el) => {
    const cs = getComputedStyle(el);
    return `${cs.gridColumnStart}-${cs.gridColumnEnd}`;
  }),
);
ok("OAuth2 序列 箭头跨列与 from/to 一致", oauthSpans.join("|") === "1-4|1-4|1-3|2-4|2-4|1-3", oauthSpans.join("|"));

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
// 反向两段：第三方 → 浏览器（步骤 2）与后端 → 浏览器（步骤 6），接收方都在发出方左边
ok("OAuth2 序列 两段反向", (await page.locator(".oauth-seq .oauth-seq-arrow.reverse").count()) === 2);

const oauthOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
ok("溢出-OAuth2 序列 桌面", oauthOverflow <= 0, `+${oauthOverflow}px`);

await page.goto(`${BASE}/#/showcase?tab=testing&topic=day4`, { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
await page.waitForTimeout(350);

ok("Day4 交接链 十层", (await page.locator(".d4-chain-row").count()) === 10);
ok("Day4 交接链 一条侧支", (await page.locator(".d4-chain-row.side").count()) === 1);
// 侧支必须缩进：画平了就会被读成「请求最后都会走到 error handler」
const sideIndent = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".d4-chain-row")];
  const side = document.querySelector(".d4-chain-row.side");
  const normal = rows.find((r) => !r.classList.contains("side"));
  return side && normal ? side.getBoundingClientRect().left - normal.getBoundingClientRect().left : 0;
});
ok("Day4 交接链 侧支缩进", sideIndent > 20, `${Math.round(sideIndent)}px`);
// 本块的验收句：十层交出的东西两两不同。图上就是十枚互不相同的令牌。
const delivers = await page.evaluate(() =>
  [...document.querySelectorAll(".d4-chain-deliver")].map((el) => el.textContent.trim()),
);
ok(
  "Day4 交接链 十个交付物两两不同",
  delivers.length === 10 && new Set(delivers).size === 10,
  `${delivers.length}/${new Set(delivers).size}`,
);
// shape 分类要有可见标签，不能只靠颜色
ok("Day4 交接链 分类图例六项", (await page.locator(".d4-chain-legend span").count()) === 6);

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
// 窄屏画不出跨列箭头，退回文字路由，六段都要在
await page.goto(`${BASE}/#/showcase?tab=oauth2`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
ok("OAuth2 手机档 文字路由仍在", (await page.locator(".oauth-seq-route").count()) === 6);

/* ================================================ C. 展示 / 复习两态的可见性边界 */

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${BASE}/#/showcase?tab=auth`, { waitUntil: "networkidle" });
await page.waitForTimeout(200);
const showText = await bodyText();
ok("展示态 无部署板 tab", !showText.includes("部署上线"));
ok("展示态 无可观测性 tab", !showText.includes("可观测性"));

await page.goto(`${BASE}/#/showcase?tab=notes`, { waitUntil: "networkidle" });
await page.waitForTimeout(250);
const notesShow = await bodyText();
ok("展示态 笔记列表不含 W9 D5", !notesShow.includes("W9 D5 · 收口日"));
ok("展示态 笔记列表不含权限速查表", !notesShow.includes("W9 权限速查表"));
ok("展示态 笔记列表不含 W10 D2", !notesShow.includes("W10 D2 · 日志上线"));
ok("展示态 笔记列表不含 W10 runbook", !notesShow.includes("W10 排障 Runbook"));

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

ok("无 console error", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
// 展板本体零后端；门禁的 /auth 只在真的去登录时才发，这条断言路径上不会触发
ok("零后端请求", apiCalls.length === 0, apiCalls.slice(0, 2).join(" | "));

await browser.close();
server.close();

console.log(`\n通过 ${passed} 项，失败 ${failures.length} 项`);
if (failures.length) {
  console.log("\n失败明细：");
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
