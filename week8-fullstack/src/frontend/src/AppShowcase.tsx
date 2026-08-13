// UI 壳与视图切换 —— showcase 独立入口版（展示资产，AGENTS.md 白名单）。
// 双入口拆分：本文件是 showcase 版，只引用展板依赖树（types / Showcase），
// 不引用任何管理后台模块（Dashboard / AuthView / api），确保 showcase 产物
// 零后端、零管理后台模块图。管理后台走独立入口 admin.html（admin 构建）。
import { useEffect, useState } from "react";
import type { BoardMode, ShowcaseTab } from "./types";
import Showcase from "./Showcase";

// 展板的可视状态（视角 / tab / 专题）全部落在 URL hash 里，而不是 localStorage：
// - 视角可见、可分享、可直接链接到某个专题，刷新不丢；
// - 默认（干净链接）永远是「展示」视角——不会有上次复习残留悄悄带进演示。
interface ShowcaseView {
  mode: BoardMode;
  tab: ShowcaseTab;
  topic: string | null;
}

const SHOWCASE_TABS: ShowcaseTab[] = [
  "auth",
  "oauth2",
  "database",
  "runtime",
  "testing",
  "deploy",
  "interview",
  "notes",
];

/**
 * 只在复习状态出现的 tab：
 * - interview：个人面试材料，不进对外 demo。
 * - deploy：W9 板会把一台在跑的服务的拓扑、端口与排障判据聚在一页，按本人决定不对外呈现。
 */
const REVIEW_ONLY_TABS: readonly ShowcaseTab[] = ["deploy", "interview"];

function parseHash(): ShowcaseView {
  // 形如 "#/showcase?tab=database&topic=lookup-index&mode=review"
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [, query = ""] = raw.split("?");
  // showcase 入口只服务展板：遗留的 #/admin 深链归一为 showcase（管理后台已迁到 admin.html）。
  const params = new URLSearchParams(query);
  const tabParam = params.get("tab");
  const tab: ShowcaseTab = SHOWCASE_TABS.includes(tabParam as ShowcaseTab)
    ? (tabParam as ShowcaseTab)
    : "auth";
  // 只属于复习状态的板（面试准备 / 部署上线）不进对外展示。
  // 深链带这类 tab 时直接进复习状态——链接的意图就是要看那块板，
  // 否则会选中一个当前渲染不出来的 tab。反方向（在该 tab 上切回展示）见 changeMode。
  const mode: BoardMode =
    params.get("mode") === "review" || REVIEW_ONLY_TABS.includes(tab) ? "review" : "demo";
  return { mode, tab, topic: params.get("topic") };
}

function buildHash(view: ShowcaseView): string {
  const params = new URLSearchParams();
  // 只写非默认值：干净的 #/showcase 天然等于「展示状态 + 认证 tab」。
  if (view.mode === "review") params.set("mode", "review");
  if (view.tab !== "auth") params.set("tab", view.tab);
  if (view.topic) params.set("topic", view.topic);
  const q = params.toString();
  return q ? `#/showcase?${q}` : "#/showcase";
}

export default function AppShowcase() {
  const [view, setView] = useState<ShowcaseView>(parseHash);

  useEffect(() => {
    // hash 是唯一真源：任何导航都写 hash，再由 hashchange 回流到 state。
    function sync() {
      setView(parseHash());
    }
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // 展板视图局部更新：切 tab 时顺带清掉上一个板的 topic，避免跨板串号。
  function updateView(patch: Partial<ShowcaseView>) {
    window.location.hash = buildHash({ ...view, ...patch });
  }

  // 在只属于复习状态的 tab 上切回展示状态时，同时把 tab 落回默认页——
  // 否则会停在一个已经不在 tab 列表里的选中项上。
  function changeMode(next: BoardMode) {
    if (next === "demo" && REVIEW_ONLY_TABS.includes(view.tab)) {
      updateView({ mode: next, tab: "auth", topic: null });
      return;
    }
    updateView({ mode: next });
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Node.js Skillup · 学习展板</h1>
          <span className="sub">无需登录 · 内部 demo 展示 / 个人复习</span>
        </div>
      </header>

      <main className="page">
        <Showcase
          mode={view.mode}
          onModeChange={changeMode}
          tab={view.tab}
          onTabChange={(t) => updateView({ tab: t, topic: null })}
          topic={view.topic}
          onTopicChange={(id) => updateView({ topic: id })}
        />
      </main>

      <footer className="page muted">
        纯前端学习展板 · 零后端依赖 · 内容随仓库 week8 笔记构建更新。管理后台（JWT / RBAC / 报表）见
        <code> nodejs-skillup/week8-fullstack</code> 源码中的 admin 入口。
      </footer>
    </>
  );
}