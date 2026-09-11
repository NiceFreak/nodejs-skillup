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
const topics = ["rag-roadmap", "rag-flow", "rag-implementation", "rag-evidence", "rag-eval", "rag-framework"];
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
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base || /^\/(auth|users|reports)\b/.test(url.pathname)) return route.abort();
    return route.continue();
  });
  await context.addInitScript((token) => {
    window.__RAG_REHEARSAL__ = { token };
    localStorage.setItem("skillup_token", "rehearsal-only-not-a-real-token");
    localStorage.setItem("skillup_user", JSON.stringify({ name: "本地演练", email: "rehearsal@example.com", role: "user" }));
  }, rehearsalToken);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-roadmap`, { waitUntil: "networkidle" });
  await page.locator('.rag-visual').waitFor();
  if (check) {
    if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
    const denied = await fetch(`${base}/__rag_demo/verify`, { method: "POST" });
    if (denied.status !== 403) throw new Error("Verification must reject requests without rehearsal token");
    for (const request of [
      { path: "/__rag_demo/verify?query=unused", options: { method: "POST" }, status: 404 },
      { path: "/__rag_demo/verify", options: { method: "GET" }, status: 405 },
      { path: "/__rag_demo/verify", options: { method: "POST", body: "unused" }, status: 400 },
      { path: "/__rag_demo/verify", options: { method: "POST", headers: { Origin: "https://example.com" } }, status: 403 },
    ]) {
      const response = await fetch(`${base}${request.path}`, { ...request.options,
        headers: { "X-RAG-Rehearsal": rehearsalToken, ...request.options.headers } });
      if (response.status !== request.status) throw new Error(`Verification boundary failed: expected ${request.status}`);
    }
    const metrics = [];
    const layoutErrors = [];
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        for (const topic of topics) {
          await page.goto(`${base}/#/showcase?tab=ai-w13&topic=${topic}`, { waitUntil: "networkidle" });
          for (const state of ["default", "expanded"]) {
            if (state === "expanded") {
              await page.locator(".ae-stage details").evaluateAll((nodes) => nodes.forEach((node) => { node.open = true; }));
              if (topic === "rag-evidence") await page.locator(".rag-citations button").first().click();
              await page.locator(".ae-stage details").evaluateAll((nodes) => nodes.forEach((node) => { node.open = true; }));
            }
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { window.scrollTo(0, 0); resolve(); }))));
            const metric = await page.evaluate(({ topic, viewport }) => {
              const stage = document.querySelector(".ae-stage");
              const visual = document.querySelector(".rag-visual");
              const anchorSelector = {
                "rag-roadmap": viewport === "desktop" ? ".rag-roadmap-desktop" : ".rag-roadmap-mobile",
                "rag-flow": ".rag-registry", "rag-implementation": ".rag-impl-body",
                "rag-evidence": ".rag-citations", "rag-eval": ".rag-eval-panels", "rag-framework": ".rag-framework-next",
              }[topic];
              const anchorEnd = document.querySelector(anchorSelector);
              const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
              let prose = "", svgLabels = "", otherLabels = "";
              while (walker.nextNode()) {
                const parent = walker.currentNode.parentElement;
                if (!parent || !parent.getBoundingClientRect().width || !parent.getBoundingClientRect().height ||
                    parent.closest("details, code, .rag-label, .ae-meta, .ae-stage-title, button, summary")) continue;
                const text = walker.currentNode.textContent;
                if (parent.closest("svg")) svgLabels += text;
                else if (parent.closest("p, small") && !parent.closest(".rag-query, .rag-claim, .rag-abstention")) prose += text;
                else otherLabels += text;
              }
              const controls = [...visual.querySelectorAll("button, summary")].filter((node) => node.getBoundingClientRect().height > 0);
              return { overflow: document.documentElement.scrollWidth - innerWidth,
                stageHeight: Math.round(stage.getBoundingClientRect().height), anchorY: Math.round(visual.getBoundingClientRect().top),
                anchorBottom: Math.ceil(anchorEnd.getBoundingClientRect().bottom),
                proseChineseChars: (prose.match(/[\u3400-\u9fff]/g) ?? []).length,
                svgLabelChineseChars: (svgLabels.match(/[\u3400-\u9fff]/g) ?? []).length,
                otherLabelChineseChars: (otherLabels.match(/[\u3400-\u9fff]/g) ?? []).length,
                smallControls: controls.filter((node) => node.getBoundingClientRect().height < 24).length,
                animations: visual.getAnimations({ subtree: true }).length };
            }, { topic, viewport: viewport.name });
            metrics.push({ viewport: viewport.name, topic, colorScheme, state, ...metric });
            if (metric.overflow > 0 || metric.smallControls || metric.animations) layoutErrors.push(`${topic} ${viewport.name} ${state}: ${JSON.stringify(metric)}`);
            if (viewport.name === "desktop" && state === "default" && metric.anchorBottom > 1000) layoutErrors.push(`${topic}: main visual is below first viewport (${metric.anchorBottom}px)`);
            if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `${topic}-${viewport.name}-${colorScheme}-${state}.png`), fullPage: true });
          }
        }
      }
    }
    if (screenshotDir) await writeFile(join(screenshotDir, "metrics.json"), JSON.stringify(metrics, null, 2));
    if (layoutErrors.length) throw new Error(layoutErrors.join("\n"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-roadmap`, { waitUntil: "networkidle" });
    await page.locator('.rag-roadmap-desktop [data-rag-target="rag-implementation"]').click();
    await page.waitForURL(/topic=rag-implementation/);
    await page.locator('[data-note-target="w13ragguide"]').first().click();
    await page.waitForURL(/topic=w13ragguide/);
    await page.locator('[data-return-topic="rag-implementation"]').waitFor();
    await page.getByRole("button", { name: "展开并定位目标章节", exact: true }).click();
    await page.getByRole("heading", { name: "W13 RAG 代码导读：从来源块到回答与评估", exact: true }).waitFor();
    await page.locator('[data-return-topic="rag-implementation"]').click();
    await page.waitForURL(/tab=ai-w13&topic=rag-implementation/);
    await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-flow`, { waitUntil: "networkidle" });
    const chain = await page.locator(".rag-common-path > div").evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect(); return { node: node.dataset.node, x: rect.x, y: rect.y };
    }));
    if (chain.map((node) => node.node).join(",") !== "assembly,generation,response" || !(chain[0].x < chain[1].x && chain[1].x < chain[2].x) || new Set(chain.map((node) => node.y)).size !== 1) throw new Error("RAG shared chain direction is ambiguous");
    await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-eval`, { waitUntil: "networkidle" });
    const barValues = await page.locator(".rag-bar[data-method]").evaluateAll((nodes) => nodes.map((node) => `${node.dataset.method}:${node.dataset.k}:${node.dataset.passed}`));
    if (barValues.join(",") !== "BM25:10:5,BM25:20:6,BM25:30:7,Dense:10:3,Dense:20:4,Dense:30:5,Hybrid:10:4,Hybrid:20:5,Hybrid:30:7") throw new Error("Unexpected retrieval chart values");
    if (!(await page.locator(".rag-human-diagnostic").innerText()).includes("4/10")) throw new Error("Missing human diagnostic provenance");
    await page.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-evidence`, { waitUntil: "networkidle" });
    const citationButton = page.locator(".rag-citations button").first();
    await citationButton.focus();
    await page.keyboard.press("Enter");
    if (await citationButton.getAttribute("aria-expanded") !== "true" || await page.locator(".rag-source-line").count() === 0) throw new Error("Keyboard citation expansion failed");
    if (await page.locator(".rag-model-block pre code").count() !== 1) throw new Error("Missing model-visible source block");
    for (const index of [1, 2]) {
      await page.locator(".rag-case-nav button").nth(index).click();
      if (await page.locator(".rag-branch-compare").getAttribute("data-branch-match") !== String(index === 1)) throw new Error("Replay branch mismatch");
    }
    await page.locator(".rag-case-nav button").first().click();
    const runButton = page.getByTestId("rag-run-verify");
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/__rag_demo/verify") && response.request().method() === "POST");
    await runButton.click();
    const runResponse = await responsePromise;
    const verification = await runResponse.json();
    if (runResponse.status() !== 200 || verification.ok !== true || verification.matched !== 10 || verification.modelCalled !== false) throw new Error("Local verification did not reproduce all ten dev inputs");
    await page.getByTestId("rag-verify-result").getByText("10/10", { exact: true }).first().waitFor();
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "rag-evidence-desktop-live-verify.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Live verification overflows mobile viewport");
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "rag-evidence-mobile-live-verify.png"), fullPage: true });
    // Exercise a failed local run without mutating the frozen evidence or Python environment.
    await page.route("**/__rag_demo/verify", (route) => route.fulfill({ status: 500, contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "合成故障：本地重算未完成，请使用终端备用路径。" }) }));
    await runButton.click();
    await page.getByTestId("rag-verify-result").getByText(/合成故障/).waitFor();
    await page.unroute("**/__rag_demo/verify");
    const readonlyPage = await context.newPage();
    await readonlyPage.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-evidence`, { waitUntil: "networkidle" });
    await readonlyPage.evaluate(() => { delete window.__RAG_REHEARSAL__; });
    await readonlyPage.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-flow`, { waitUntil: "networkidle" });
    await readonlyPage.goto(`${base}/#/showcase?tab=ai-w13&topic=rag-evidence`, { waitUntil: "networkidle" });
    if (!(await readonlyPage.getByTestId("rag-run-verify").isDisabled())) throw new Error("Static replay must not enable local command execution");
    await readonlyPage.close();
    if (errors.length) throw new Error(errors.join("\n"));
    if (screenshotDir) await writeFile(join(screenshotDir, "metrics.json"), JSON.stringify(metrics, null, 2));
    console.log(JSON.stringify({ checked: metrics.length, topics: topics.length, keyboardCitation: "passed", replayBranches: "passed",
      localVerification: "10/10", rejectedRequestVariants: 5, localFailureDisplay: "passed", staticReplay: "passed",
      roadmapGuideReturn: "passed", pageErrors: errors.length, metrics }, null, 2));
  } else {
    console.log(`本地 RAG 演练已打开：${base}/#/showcase?tab=ai-w13&topic=rag-roadmap`);
    console.log("可在证据页重新计算本地 BM25 与模型输入；不会调用模型。外部与业务 API 请求被阻止，关闭浏览器结束。其他浏览器仍遵守正常登录门禁。");
    await new Promise((resolve) => browser.once("disconnected", resolve));
  }
} finally {
  if (browser?.isConnected()) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
