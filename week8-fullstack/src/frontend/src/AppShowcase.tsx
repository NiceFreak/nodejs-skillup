// UI 壳与视图切换 —— showcase 独立入口版（展示资产，AGENTS.md 白名单）。
// 双入口拆分：本文件是 showcase 版，只引用展板依赖树（types / Showcase），
// 不引用任何管理后台模块（Dashboard / api），确保 showcase 产物零后端、零管理后台模块图。
// 管理后台走独立入口 admin.html（admin 构建）。
//
// 门禁（形态乙 · 独立登录页）：
// - `#/login` 是登录页语义；未登录访问任何 `#/showcase...` 深链会重定向到 `#/login?next=...`，
//   把原始 hash 编码进 next，登录成功后回到原本想看的页面。
// - 未登录时不渲染展板内容（包括不放任何一帧），登录页复用 AuthView（context="gate" 仅登录）。
// - 登录态 = token + skillup_user 都存在；与 admin 入口共用同一套 localStorage 键，
//   因为后端是同一个账号体系（/auth/login）。
import { useEffect, useState } from "react";
import { token } from "./api";
import { AE_TOPICS } from "./aiEngineerTopics";
import type { BoardMode, SafeUser, ShowcaseTab } from "./types";
import AuthView from "./AuthView";
import Showcase from "./Showcase";

// 展板的可视状态（视角 / tab / 专题）全部落在 URL hash 里，而不是 localStorage：
// - 视角可见、可分享、可直接链接到某个专题，刷新不丢；
// - 默认（干净链接）永远是「展示」视角——不会有上次复习残留悄悄带进演示。
interface ShowcaseView {
  mode: BoardMode;
  tab: ShowcaseTab;
  topic: string | null;
  /** 仅 notes tab 使用的稳定章节键，如 2.5、3.1、11。 */
  section: string | null;
  /** 仅来源于 AI 工程板的笔记深链使用；用于在原文页显式返回发起专题。 */
  returnTab: "ai-engineer" | null;
  returnTopic: string | null;
}

interface Location {
  route: "login" | "showcase";
  view: ShowcaseView;
  /** login 页的 next 参数（解码后的 hash 原文，如 "#/showcase?tab=database"） */
  next: string | null;
}

const SHOWCASE_TABS: ShowcaseTab[] = [
  "auth",
  "oauth2",
  "architecture",
  "database",
  "runtime",
  "testing",
  "deploy",
  "observability",
  "runbook",
  "release",
  "interview",
  "ai-engineer",
  "notes",
];

/**
 * 只在复习状态出现的 tab：
 * - interview：个人面试材料，不进对外 demo。
 * - deploy：W9 板会把一台在跑的服务的拓扑、端口与排障判据聚在一页，按本人决定不对外呈现。
 * - observability：W10 板更进一步，含阈值、注入方式与回滚路径，同样只在复习状态出现。
 * - release：W11 板含部署身份、权限收窄形态与回滚判据，比前两块更贴近运维内情。
 * runbook 是例外：2026-08-27 拍板对外可见，但展示状态把真实 IP / 域名替换为占位符
 * （脱敏规则见 SHOWCASE-DEPLOY-PROTOCOL.md §发布不变量）。
 */
const REVIEW_ONLY_TABS: readonly ShowcaseTab[] = ["deploy", "observability", "release", "interview"];

const DEFAULT_VIEW: ShowcaseView = {
  mode: "demo",
  tab: "auth",
  topic: null,
  section: null,
  returnTab: null,
  returnTopic: null,
};

const AI_ENGINEER_TOPIC_IDS = new Set(AE_TOPICS.map((item) => item.id));

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
  const returnTopic = params.get("returnTopic");
  const hasAiEngineerReturn = tab === "notes"
    && params.get("returnTab") === "ai-engineer"
    && returnTopic !== null
    && AI_ENGINEER_TOPIC_IDS.has(returnTopic);
  return {
    mode,
    tab,
    topic: params.get("topic"),
    section: tab === "notes" ? params.get("section") : null,
    returnTab: hasAiEngineerReturn ? "ai-engineer" : null,
    returnTopic: hasAiEngineerReturn ? returnTopic : null,
  };
}

function parseLocation(): Location {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  if (path === "login") {
    // 登录页：next 是登录成功后要回的 hash 原文（URLSearchParams 已自动解码）。
    return { route: "login", view: DEFAULT_VIEW, next: params.get("next") };
  }
  return { route: "showcase", view: parseHash(), next: null };
}

function buildHash(view: ShowcaseView): string {
  const params = new URLSearchParams();
  // 只写非默认值：干净的 #/showcase 天然等于「展示状态 + 认证 tab」。
  if (view.mode === "review") params.set("mode", "review");
  if (view.tab !== "auth") params.set("tab", view.tab);
  if (view.topic) params.set("topic", view.topic);
  if (view.tab === "notes" && view.topic && view.section) params.set("section", view.section);
  if (
    view.tab === "notes"
    && view.returnTab === "ai-engineer"
    && view.returnTopic
    && AI_ENGINEER_TOPIC_IDS.has(view.returnTopic)
  ) {
    params.set("returnTab", view.returnTab);
    params.set("returnTopic", view.returnTopic);
  }
  const q = params.toString();
  return q ? `#/showcase?${q}` : "#/showcase";
}

/** 从 localStorage 恢复登录态；token 或 user 任一缺失都视为未登录 */
function restoreUser(): SafeUser | null {
  const cached = localStorage.getItem("skillup_user");
  if (!cached || !token.get()) return null;
  try {
    return JSON.parse(cached) as SafeUser;
  } catch {
    return null;
  }
}

export default function AppShowcase() {
  const [user, setUser] = useState<SafeUser | null>(restoreUser);
  const [loc, setLoc] = useState<Location>(parseLocation);

  useEffect(() => {
    // hash 是唯一真源：任何导航都写 hash，再由 hashchange 回流到 state。
    function sync() {
      setLoc(parseLocation());
    }
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // 门禁规则（纯前端守卫，只挡「随手打开的浏览器用户」）：
  // - 未登录想进 showcase → 重定向到 #/login?next=<原 hash>，登录成功后回跳；
  // - 已登录却停在 login（手动输入）→ 归一为 showcase 或 next。
  // 用 useEffect 而非 render 里改 hash：hash 是唯一真源，避免「state 驱动 hash」与
  // 「hashchange 回流 state」互相打架。
  useEffect(() => {
    if (!user && loc.route === "showcase") {
      const original = window.location.hash;
      const next = encodeURIComponent(original);
      window.location.hash = next ? `#/login?next=${next}` : "#/login";
      return;
    }
    if (user && loc.route === "login") {
      window.location.hash = loc.next || "#/showcase";
    }
  }, [user, loc]);

  // 展板视图局部更新：切 tab 时顺带清掉上一个板的 topic，避免跨板串号。
  function updateView(patch: Partial<ShowcaseView>) {
    window.location.hash = buildHash({ ...loc.view, ...patch });
  }

  // 在只属于复习状态的 tab 上切回展示状态时，同时把 tab 落回默认页——
  // 否则会停在一个已经不在 tab 列表里的选中项上。
  function changeMode(next: BoardMode) {
    if (next === "demo" && REVIEW_ONLY_TABS.includes(loc.view.tab)) {
      updateView({
        mode: next,
        tab: "auth",
        topic: null,
        section: null,
        returnTab: null,
        returnTopic: null,
      });
      return;
    }
    updateView({ mode: next });
  }

  function handleLogin(u: SafeUser) {
    localStorage.setItem("skillup_user", JSON.stringify(u));
    setUser(u);
    // user 更新后，上面的门禁 effect 会把 #/login 归一为 next（或 #/showcase）。
  }

  function handleLogout() {
    token.clear();
    localStorage.removeItem("skillup_user");
    setUser(null);
    window.location.hash = "#/login";
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Node.js Skillup · 学习展板</h1>
          <span className="sub">
            {user ? `已登录 · ${user.name}` : "仅本人可见 · 登录复习门禁"}
          </span>
        </div>
        <div className="head-right">
          <nav className="app-nav" aria-label="应用区域">
            <span className="pill on">学习展板</span>
          </nav>
          {user ? (
            <>
              <span className="pill on">{user.name}</span>
              <button className="ghost inverse" onClick={handleLogout}>
                登出
              </button>
            </>
          ) : (
            <span className="pill">未登录</span>
          )}
        </div>
      </header>

      <main className="page">
        {user ? (
          <Showcase
            mode={loc.view.mode}
            onModeChange={changeMode}
            tab={loc.view.tab}
            onTabChange={(t) => updateView({
              tab: t,
              topic: null,
              section: null,
              returnTab: null,
              returnTopic: null,
            })}
            topic={loc.view.topic}
            onTopicChange={(id) => updateView({ topic: id, section: null })}
            section={loc.view.section}
            onSectionChange={(section) => updateView({ section })}
            noteReturnTarget={loc.view.returnTab && loc.view.returnTopic ? {
              tab: loc.view.returnTab,
              topic: loc.view.returnTopic,
            } : null}
          />
        ) : (
          <AuthView context="gate" onSuccess={handleLogin} />
        )}
      </main>

      <footer className="page muted">
        复习门禁 · 复用后端登录（JWT）。门禁只挡浏览器用户——静态内容本就在产物里，请勿把链接
        发给不信任的人。管理后台（JWT / RBAC / 报表）见
        <code> nodejs-skillup/week8-fullstack</code> 源码中的 admin 入口。
      </footer>
    </>
  );
}
