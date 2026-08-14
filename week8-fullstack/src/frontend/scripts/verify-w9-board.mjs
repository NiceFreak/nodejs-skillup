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
 *   3. 几何断言      —— 数据加了一列而 CSS 的 grid 没跟上，位置编码当场失效（销账轨道踩过）
 * 加上横向溢出与触控目标两条，构成每一块板的最低体检。
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
  "rollback", "release", "chain", "proxy", "evidence", "exposure",
];

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
const browser = await chromium.launch();
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
  await page.waitForTimeout(220);
}
const bodyText = () => page.evaluate(() => document.body.innerText);

/** 复习门：把本专题里所有揭示按钮点开，否则结论区不渲染。 */
async function revealAll() {
  for (let i = 0; i < 8; i++) {
    const btns = page.locator(".w9-reveal-gate button, .w9-recall-gate button");
    if ((await btns.count()) === 0) break;
    await btns.first().click();
    await page.waitForTimeout(140);
  }
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

// ⑥ 契约销账：D5 一列、仍欠为空、决策关闭单独标
await goTopic("evidence");
t = await bodyText();
const days = await page.locator(".w9-settle-day").allInnerTexts();
ok("销账 四天 + 仍欠列", days.join(",") === "D2,D3,D4,D5,仍欠", days.join(","));
ok("销账 仍欠列空了", (await page.locator(".w9-settle-empty").count()) === 1);
ok("销账 决策关闭单独标", t.includes("决策关闭，不是修好了"));
// 几何断言：数据加了一列而 grid 没跟上，「横坐标 = 哪天销的」当场失效——踩过一次
const colTops = await page.locator(".w9-settle-col").evaluateAll((els) =>
  Array.from(new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))));
ok("销账 五列同一行", colTops.length === 1, `${colTops.length} 行`);
ok("销账 契约表之外四笔", (await page.locator(".w9-offbook-item").count()) === 4);
ok("销账 主动接受与还欠着分开", t.includes("主动接受") && t.includes("还欠着"));
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

  // 白字：任何可见文本的计算色都不得是纯白
  const white = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".w9-board *").forEach((el) => {
      if (!el.textContent?.trim()) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (getComputedStyle(el).color === "rgb(255, 255, 255)") bad.push(el.className || el.tagName);
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

/* ================================================ C. 展示 / 复习两态的可见性边界 */

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${BASE}/#/showcase?tab=auth`, { waitUntil: "networkidle" });
await page.waitForTimeout(200);
const showText = await bodyText();
ok("展示态 无部署板 tab", !showText.includes("部署上线"));

await page.goto(`${BASE}/#/showcase?tab=notes`, { waitUntil: "networkidle" });
await page.waitForTimeout(250);
const notesShow = await bodyText();
ok("展示态 笔记列表不含 W9 D5", !notesShow.includes("W9 D5 · 收口日"));
ok("展示态 笔记列表不含权限速查表", !notesShow.includes("W9 权限速查表"));

await page.goto(`${BASE}/#/showcase?mode=review&tab=notes`, { waitUntil: "networkidle" });
await page.waitForTimeout(250);
const notesReview = await bodyText();
for (const label of ["W9 D5 · 收口日", "W9 Demo 讲稿", "W9 权限速查表", "W9 D4-c · 展板 8081", "W9 周计划"]) {
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
