/**
 * 全展板视觉审计采样器。
 *
 * 默认只测量，不截图：
 *   yarn audit:visual
 *
 * 只为指定专题生成桌面 / 手机两屏截图：
 *   SHOWCASE_AUDIT_SCREENSHOTS=1 \
 *   SHOWCASE_AUDIT_TOPICS=runtime,event-loop,release/lanes \
 *   yarn audit:visual
 *
 * 产物默认写入 /tmp/nodejs-skillup-showcase-visual-audit，避免把临时证据混进仓库。
 * 本工具只报告几何与内容负担，不把「主图是否解释了机制」降格成代理指标。
 */
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DIST = process.env.DIST ?? join(ROOT, "dist-showcase");
const PORT = Number(process.env.PORT ?? 8100);
const BASE = `http://127.0.0.1:${PORT}`;
const OUTPUT = process.env.SHOWCASE_AUDIT_OUTPUT ?? "/tmp/nodejs-skillup-showcase-visual-audit";
const TAKE_SCREENSHOTS = process.env.SHOWCASE_AUDIT_SCREENSHOTS === "1";
const FILTERS = (process.env.SHOWCASE_AUDIT_TOPICS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

// topicNav 为空的板仍会采样一次。其余专题通过真实按钮切换，避免在这里复制 topic id。
const BOARDS = [
  { tab: "auth", mode: "demo", root: ".authk-board", panel: ".authk-stage", topicNav: ".authk-nav button" },
  { tab: "oauth2", mode: "demo", root: ".oauth-flow", panel: ".oauth-flow" },
  { tab: "architecture", mode: "demo", root: ".arch-board", panel: ".w5-stage", topicNav: ".w5-knowledge-nav button" },
  { tab: "database", mode: "demo", root: ".w5-board", panel: ".w5-stage", topicNav: ".w5-knowledge-nav button" },
  { tab: "runtime", mode: "demo", root: ".w5-board", panel: ".w5-stage", topicNav: ".w5-knowledge-nav button" },
  { tab: "testing", mode: "demo", root: ".w6-board", panel: ".w6-day-switch", panelAfterNav: true, topicNav: ".w6-day-switch button" },
  { tab: "deploy", mode: "review", root: ".w9-board", panel: "#w9-topic-panel", topicNav: ".w9-topic-switch button" },
  { tab: "observability", mode: "review", root: ".w10-board", panel: "#w10-topic-panel", topicNav: ".w10-topic-switch button" },
  { tab: "runbook", mode: "demo", root: ".rb-board", panel: "#runbook-topic-panel", topicNav: ".rb-topic-switch button" },
  { tab: "release", mode: "review", root: ".w11-board", panel: "#w11-topic-panel", topicNav: ".w11-topic-switch button" },
  { tab: "interview", mode: "review", root: ".w5-board", panel: ".w5-stage", topicNav: ".iv-nav button" },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

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
      // Try the next supported installation location.
    }
  }
  throw new Error(`找不到 playwright；已试过：${specs.join("、")}`);
}

function serveDist() {
  return new Promise((ready) => {
    const server = createServer(async (req, res) => {
      const pathname = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const file = join(DIST, pathname === "/" ? "index.html" : pathname);
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

function currentTopic(url, fallback) {
  const hash = new URL(url).hash;
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("topic") ?? fallback;
}

function wantsScreenshot(tab, topic) {
  if (!TAKE_SCREENSHOTS) return false;
  if (FILTERS.length === 0) return true;
  return FILTERS.some((filter) => filter === tab || filter === topic || filter === `${tab}/${topic}`);
}

async function revealCurrentTopic(page) {
  const selectors = [
    ".w5-recall-gate button",
    ".w9-reveal-gate button",
    ".w9-recall-gate button",
    "button.w10-reveal-gate",
  ];
  for (let pass = 0; pass < 8; pass++) {
    let clicked = false;
    for (const selector of selectors) {
      const button = page.locator(selector).first();
      if ((await button.count()) === 0 || !(await button.isVisible())) continue;
      await button.click();
      await page.waitForTimeout(80);
      clicked = true;
      break;
    }
    if (!clicked) break;
  }
}

async function measure(page, board, viewport, topic, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const metrics = await page.evaluate(({ rootSelector, panelSelector, panelAfterNav, navSelector, viewportHeight }) => {
    const root = document.querySelector(rootSelector);
    const panelMarker = document.querySelector(panelSelector);
    const panel = panelAfterNav ? panelMarker?.nextElementSibling : panelMarker;
    const nav = navSelector ? document.querySelector(navSelector)?.parentElement : null;
    if (!root || !panel) return null;

    const rootRect = root.getBoundingClientRect();
    const measuredRect = panel.getBoundingClientRect();
    const panelRect = panelAfterNav
      ? { top: measuredRect.top, height: Math.max(0, rootRect.bottom - measuredRect.top) }
      : measuredRect;
    const navRect = nav?.getBoundingClientRect() ?? null;
    const anchorScope = panelAfterNav
      ? [...root.querySelectorAll("[data-anchor]")].filter(
          (element) => element.getBoundingClientRect().top >= measuredRect.top,
        )
      : [
          ...(panel.matches("[data-anchor]") ? [panel] : []),
          ...panel.querySelectorAll("[data-anchor]"),
        ];
    const anchor = anchorScope.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    });
    const anchorRect = anchor?.getBoundingClientRect() ?? null;
    const targets = [...root.querySelectorAll("button, a[href], [role='button'], [role='tab']")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      })
      .filter(({ width, height }) => width > 0 && height > 0);
    const smallTargets = targets.filter(({ width, height }) => width < 44 || height < 44);
    const visibleText = panelAfterNav
      ? [...root.children]
          .slice([...root.children].indexOf(panel))
          .map((element) => element.innerText ?? "")
          .join("")
          .replace(/\s+/g, "").length
      : (panel.innerText ?? "").replace(/\s+/g, "").length;

    return {
      documentHeight: Math.round(document.documentElement.scrollHeight),
      horizontalOverflow: Math.max(0, Math.round(document.documentElement.scrollWidth - window.innerWidth)),
      rootTop: Math.round(rootRect.top),
      rootHeight: Math.round(rootRect.height),
      rootScreens: Number((rootRect.height / viewportHeight).toFixed(2)),
      topicTop: Math.round(panelRect.top),
      topicHeight: Math.round(panelRect.height),
      topicScreens: Number((panelRect.height / viewportHeight).toFixed(2)),
      topicAfterNav: navRect ? Math.round(panelRect.top - navRect.bottom) : null,
      anchorTop: anchorRect ? Math.round(anchorRect.top) : null,
      anchorScreensFromTop: anchorRect ? Number((anchorRect.top / viewportHeight).toFixed(2)) : null,
      anchorLabel: anchor?.getAttribute("data-anchor") ?? null,
      visibleTextChars: visibleText,
      targetCount: targets.length,
      smallTargetCount: smallTargets.length,
      smallestTarget: smallTargets.sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height))[0] ?? null,
    };
  }, {
    rootSelector: board.root,
    panelSelector: board.panel,
    panelAfterNav: board.panelAfterNav ?? false,
    navSelector: board.topicNav ?? null,
    viewportHeight: viewport.height,
  });
  if (!metrics) throw new Error(`${board.tab}/${topic}: 找不到 ${board.root} 或 ${board.panel}`);

  const row = { viewport: viewport.name, tab: board.tab, topic, label, ...metrics };
  if (wantsScreenshot(board.tab, topic)) {
    const filename = `${viewport.name}-${board.tab}-${topic}`.replace(/[^a-zA-Z0-9._-]/g, "-") + ".png";
    // Playwright 的 clip 不能可靠抓取当前视口以外的区域。临时把视口扩成两屏，
    // 从专题起点滚动后抓当前视口；宽度不变，因此不会改变响应式断点。
    await page.setViewportSize({ width: viewport.width, height: viewport.height * 2 });
    await page.evaluate(({ panelSelector, panelAfterNav, captureHeight }) => {
      const marker = document.querySelector(panelSelector);
      const target = panelAfterNav ? marker?.nextElementSibling : marker;
      if (!target) throw new Error(`截图时找不到 ${panelSelector}`);
      const captureY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 16);
      // 长视口会缩短最大 scrollY。临时页尾占位保证专题顶端能精确滚到截图顶端。
      const spacer = document.createElement("div");
      spacer.id = "showcase-visual-audit-spacer";
      spacer.style.height = `${Math.max(0, captureY + captureHeight - document.documentElement.scrollHeight + 1)}px`;
      document.body.append(spacer);
      window.scrollTo(0, captureY);
    }, { panelSelector: board.panel, panelAfterNav: board.panelAfterNav ?? false, captureHeight: viewport.height * 2 });
    await page.waitForTimeout(80);
    await page.screenshot({
      path: join(OUTPUT, filename),
      animations: "disabled",
    });
    await page.evaluate(() => document.querySelector("#showcase-visual-audit-spacer")?.remove());
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => window.scrollTo(0, 0));
    row.screenshot = filename;
  }
  return row;
}

try {
  await stat(join(DIST, "index.html"));
} catch {
  console.error(`产物不存在：${DIST}/index.html\n先跑 yarn build:showcase`);
  process.exit(2);
}

await mkdir(OUTPUT, { recursive: true });
const chromium = await loadChromium();
const server = await serveDist();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const rows = [];
const consoleErrors = [];

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      localStorage.setItem("skillup_token", "visual-audit-only-not-a-real-token");
      localStorage.setItem("skillup_user", JSON.stringify({ name: "audit", email: "audit@example.com", role: "admin" }));
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });

    for (const board of BOARDS) {
      await page.goto(`${BASE}/#/showcase?mode=${board.mode}&tab=${board.tab}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(120);
      const count = board.topicNav ? await page.locator(board.topicNav).count() : 0;
      const states = Math.max(1, count);
      for (let index = 0; index < states; index++) {
        if (board.topicNav) {
          const topicButton = page.locator(board.topicNav).nth(index);
          if (await topicButton.isVisible()) {
            await topicButton.click();
          } else {
            // 手机端的完整目录按契约默认折叠；程序化触发同一个按钮，
            // 仍由组件自己的 onClick 更新 URL 与专题状态。
            await topicButton.evaluate((element) => element.click());
          }
          await page.waitForTimeout(120);
        }
        await revealCurrentTopic(page);
        const selected = board.topicNav
          ? page.locator(`${board.topicNav}.on, ${board.topicNav}[aria-selected='true']`).first()
          : null;
        const label = selected && (await selected.count()) > 0
          ? ((await selected.textContent()) ?? "").replace(/\s+/g, " ").trim()
          : board.tab;
        const topic = currentTopic(page.url(), count > 0 ? `index-${index + 1}` : "overview");
        rows.push(await measure(page, board, viewport, topic, label));
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

const report = {
  generatedAt: new Date().toISOString(),
  dist: DIST,
  screenshots: TAKE_SCREENSHOTS,
  filters: FILTERS,
  consoleErrors,
  rows,
};
await writeFile(join(OUTPUT, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const summary = [];
for (const viewport of VIEWPORTS) {
  for (const board of BOARDS) {
    const matches = rows.filter((row) => row.viewport === viewport.name && row.tab === board.tab);
    summary.push({
      viewport: viewport.name,
      tab: board.tab,
      states: matches.length,
      maxTopicScreens: Math.max(...matches.map((row) => row.topicScreens)),
      topicStartsAt: Math.max(...matches.map((row) => Number((row.topicTop / viewport.height).toFixed(2)))),
      maxChars: Math.max(...matches.map((row) => row.visibleTextChars)),
      maxSmallTargets: Math.max(...matches.map((row) => row.smallTargetCount)),
      maxOverflow: Math.max(...matches.map((row) => row.horizontalOverflow)),
    });
  }
}
console.table(summary);
console.table(
  [...rows]
    .sort((a, b) => b.topicScreens - a.topicScreens)
    .slice(0, 12)
    .map((row) => ({ viewport: row.viewport, topic: `${row.tab}/${row.topic}`, topicScreens: row.topicScreens, chars: row.visibleTextChars })),
);
console.log(`\n采样 ${rows.length} 个视口专题状态；报告：${join(OUTPUT, "metrics.json")}`);
if (consoleErrors.length > 0) {
  console.error(`浏览器 console error：${consoleErrors.length} 条`);
  process.exitCode = 1;
}
