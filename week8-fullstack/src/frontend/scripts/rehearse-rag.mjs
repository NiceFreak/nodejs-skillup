// Local rehearsal of the built static board, using the same synthetic browser
// context as verify:board. The app and production login gate remain unchanged.
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../dist-showcase/", import.meta.url));
const check = process.argv.includes("--check");
const screenshotDir = process.env.RAG_SCREENSHOTS;

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const runFile = promisify(execFile);
const rehearsalToken = randomBytes(24).toString("hex");
let verificationRunning = false;
let base;
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
await stat(join(root, "index.html"));
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/__rag_demo/")) {
      const send = (status, body) => {
        res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(body));
      };
      // Only the isolated rehearsal page may start this fixed, read-only command.
      // There is no caller-supplied executable, path, query or model request.
      if (url.pathname !== "/__rag_demo/verify" || url.search) { send(404, { ok: false, error: "未知演练操作" }); return; }
      if (req.method !== "POST") { send(405, { ok: false, error: "此操作仅接受 POST" }); return; }
      if (req.headers.host !== new URL(base).host ||
          (req.headers.origin && req.headers.origin !== base) ||
          req.headers["x-rag-rehearsal"] !== rehearsalToken) {
        send(403, { ok: false, error: "请使用本地演练浏览器" }); return;
      }
      if (req.headers["transfer-encoding"] || Number(req.headers["content-length"] ?? 0) !== 0) {
        send(400, { ok: false, error: "本操作不接受输入参数" }); return;
      }
      if (verificationRunning) { send(409, { ok: false, error: "已有一次重算正在运行，请稍候" }); return; }
      verificationRunning = true;
      try {
        let stdout;
        try {
          ({ stdout } = await runFile(join(repo, "week13-rag/.venv/bin/python"),
            ["-B", join(repo, "week13-rag/scripts/demo-replay.py"), "verify", "--json"],
            { cwd: repo, timeout: 30000, maxBuffer: 1024 * 1024,
              env: { PATH: process.env.PATH ?? "/usr/bin:/bin", PYTHONDONTWRITEBYTECODE: "1" } }));
        } catch (error) {
          // A comparison mismatch returns a structured result with exit code 1.
          if (error.code === 1 && error.stdout?.trim().startsWith("{")) stdout = error.stdout;
          else throw error;
        }
        const result = JSON.parse(stdout);
        if (!Array.isArray(result.checks) || result.checks.length !== 10 || result.total !== 10 || result.modelCalled !== false ||
            new Set(result.checks.map((row) => row.itemId)).size !== 10 ||
            result.checks.some((row) => typeof row.itemId !== "string" || !row.itemId.startsWith("w13-dev-") ||
              ["hitOrder", "contextHash", "contextChars"].some((key) => typeof row[key] !== "boolean"))) throw new Error("Invalid verification output");
        const matched = result.checks.filter((row) => row.hitOrder && row.contextHash && row.contextChars).length;
        if (result.matched !== matched || result.ok !== (matched === 10)) throw new Error("Invalid verification summary");
        send(200, result);
      } catch (error) {
        const message = error.code === "ENOENT" ? "本地 Python 环境未就绪，请使用讲稿中的终端备用命令。"
          : error.killed ? "重算超过 30 秒，请使用终端定位原因；历史记录仍可展示。"
          : "本地重算未完成，请使用讲稿中的终端命令查看错误；历史记录仍可展示。";
        send(500, { ok: false, error: message });
      } finally { verificationRunning = false; }
      return;
    }
    const path = resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!path.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) { res.writeHead(403).end(); return; }
    const bytes = await readFile(path);
    res.writeHead(200, { "Content-Type": mime[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(bytes);
  } catch { res.writeHead(404).end("Not found"); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: check, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => { const url = new URL(route.request().url()); if (url.origin !== base || /^\/(auth|users|reports)\b/.test(url.pathname)) return route.abort(); return route.continue(); });
  await context.addInitScript((token) => { window.__RAG_REHEARSAL__ = { token }; localStorage.setItem("skillup_token", "rehearsal-only"); localStorage.setItem("skillup_user", JSON.stringify({ name: "本地演练", email: "rehearsal@example.com", role: "user" })); }, rehearsalToken);
  const page = await context.newPage(); const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  const topics = ["rag-build", "rag-corpus", "rag-retrieval", "rag-context", "rag-generation", "rag-citation"];
  if (!check) { await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-build`, { waitUntil: "networkidle" }); console.log(`本地 RAG 演练已打开：${base}/#/showcase?tab=ai-w13&topic=rag-build`); console.log("关闭浏览器结束。页面只读，不调用模型。"); await new Promise(() => {}); }
  const metrics = [];
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const topic of topics) {
      await page.goto(`${base}/#/showcase?tab=ai-w13&topic=${topic}`, { waitUntil: "networkidle" }); await page.locator(".rag-visual").waitFor();
      const metric = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, visualHeight: Math.round(document.querySelector(".rag-visual").getBoundingClientRect().height), controls: document.querySelectorAll(".rag-visual button").length }));
      if (metric.overflow > 0) throw new Error(`${topic} ${viewport.name}: horizontal overflow ${metric.overflow}px`); metrics.push({ viewport: viewport.name, topic, ...metric });
    }
  }
  await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-build`, { waitUntil: "networkidle" }); await page.locator(".rag-v2-flow button").nth(3).click();
  if (!(await page.locator(".rag-v2-focus").innerText()).includes("模型响应")) throw new Error("main flow interaction failed");
  await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-corpus`, { waitUntil: "networkidle" }); await page.locator(".rag-field-picker button").last().click();
  if (!(await page.locator(".rag-v2-focus").innerText()).includes("内容校验")) throw new Error("corpus interaction failed");
  await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-context`, { waitUntil: "networkidle" }); await page.locator(".rag-context-controls button").click();
  if (!(await page.locator(".rag-context-objects").innerText()).includes("移除")) throw new Error("context interaction failed");
  if (errors.length) throw new Error(errors.join("\\n"));
  console.log(JSON.stringify({ checked: metrics.length, topics: topics.length, pageErrors: errors.length, interactions: "passed", metrics }, null, 2));
} finally { if (browser) await browser.close(); server.close(); }
