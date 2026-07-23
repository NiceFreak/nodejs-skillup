// UI 壳与视图切换 —— 前端为验收展示资产，由 AI 搭建维护（AGENTS.md 白名单）。
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, login, register, token } from "./api";
import type { BoardMode, SafeUser, ShowcaseTab } from "./types";
import Dashboard from "./Dashboard";
import Showcase from "./Showcase";

type AppRoute = "showcase" | "admin";

// 展板的可视状态（视角 / tab / 专题）全部落在 URL hash 里，而不是 localStorage：
// - 视角可见、可分享、可直接链接到某个专题，刷新不丢；
// - 默认（干净链接）永远是「展示」视角——不会有上次复习残留悄悄带进演示。
interface ShowcaseView {
  mode: BoardMode;
  tab: ShowcaseTab;
  topic: string | null;
}

const SHOWCASE_TABS: ShowcaseTab[] = ["auth", "oauth2", "database", "runtime"];

interface HashState {
  route: AppRoute;
  view: ShowcaseView;
}

function parseHash(): HashState {
  // 形如 "#/showcase?tab=database&topic=lookup-index&mode=review"
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const route: AppRoute = path === "admin" ? "admin" : "showcase";
  const params = new URLSearchParams(query);
  const mode: BoardMode = params.get("mode") === "review" ? "review" : "demo";
  const tabParam = params.get("tab");
  const tab: ShowcaseTab = SHOWCASE_TABS.includes(tabParam as ShowcaseTab)
    ? (tabParam as ShowcaseTab)
    : "auth";
  return { route, view: { mode, tab, topic: params.get("topic") } };
}

function buildHash(route: AppRoute, view: ShowcaseView): string {
  if (route === "admin") return "#/admin";
  const params = new URLSearchParams();
  // 只写非默认值：干净的 #/showcase 天然等于「展示状态 + 认证 tab」。
  if (view.mode === "review") params.set("mode", "review");
  if (view.tab !== "auth") params.set("tab", view.tab);
  if (view.topic) params.set("topic", view.topic);
  const q = params.toString();
  return q ? `#/showcase?${q}` : "#/showcase";
}

export default function App() {
  const [{ route, view }, setHashState] = useState<HashState>(parseHash);

  // [React] useState 惰性初始化：传函数而不是值，localStorage 读取只在首次挂载执行一次，
  // 而不是每次渲染都读。
  const [user, setUser] = useState<SafeUser | null>(() => {
    const cached = localStorage.getItem("skillup_user");
    if (!token.get() || !cached) return null;
    try {
      // [TS] as 类型断言：JSON.parse 返回 any，这里告诉编译器「它是 SafeUser」——
      // 断言只影响编译期，运行时不校验，所以外层 try/catch 兜住脏数据。
      return JSON.parse(cached) as SafeUser;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // hash 是唯一真源：任何导航都写 hash，再由 hashchange 回流到 state。
    function sync() {
      setHashState(parseHash());
    }
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function navigate(nextRoute: AppRoute) {
    window.location.hash = buildHash(nextRoute, view);
  }

  // 展板视图局部更新：切 tab 时顺带清掉上一个板的 topic，避免跨板串号。
  function updateView(patch: Partial<ShowcaseView>) {
    window.location.hash = buildHash("showcase", { ...view, ...patch });
  }

  function handleLogin(u: SafeUser) {
    localStorage.setItem("skillup_user", JSON.stringify(u));
    setUser(u);
  }

  function handleLogout() {
    token.clear();
    localStorage.removeItem("skillup_user");
    setUser(null);
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>{route === "showcase" ? "Node.js Skillup · 学习展板" : "Node.js Skillup · 经营报表管理后台"}</h1>
          <span className="sub">
            {route === "showcase" ? "无需登录 · 内部 demo 展示 / 个人复习" : "受保护路由 · JWT 认证 · 最小 RBAC（admin-only 报表）"}
          </span>
        </div>
        <div className="head-right">
          <nav className="app-nav" aria-label="应用区域">
            <button className={route === "showcase" ? "on" : ""} onClick={() => navigate("showcase")}>学习展板</button>
            <button className={route === "admin" ? "on" : ""} onClick={() => navigate("admin")}>管理后台</button>
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
        {route === "showcase" ? (
          <Showcase
            openAdmin={() => navigate("admin")}
            mode={view.mode}
            onModeChange={(m) => updateView({ mode: m })}
            tab={view.tab}
            onTabChange={(t) => updateView({ tab: t, topic: null })}
            topic={view.topic}
            onTopicChange={(id) => updateView({ topic: id })}
          />
        ) : user ? (
          <Dashboard onAuthExpired={handleLogout} />
        ) : (
          <AuthView onSuccess={handleLogin} />
        )}
      </main>

      <footer className="page muted">
        学习展板可直接访问；管理后台通过真实注册 / 登录 / JWT / RBAC 链路访问。后端实现见
        <code> week2-express/src/</code>。
      </footer>
    </>
  );
}

function AuthView({ onSuccess }: { onSuccess: (u: SafeUser) => void }) {
  const [formMode, setFormMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    try {
      if (formMode === "register") {
        await register(String(data.get("name")), email, password);
        setInfo("注册成功，请直接登录（新账号默认角色 member）。");
        setFormMode("login");
      } else {
        const { accessToken, user } = await login(email, password);
        token.set(accessToken);
        onSuccess(user);
      }
    } catch (ex) {
      if (ex instanceof ApiError) {
        setError(`${ex.status} · ${ex.message}`);
      } else {
        setError(ex instanceof Error ? ex.message : "请求失败");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-view">
      <div className="admin-auth-intro">
        <span>受保护管理后台</span>
        <h2>使用真实 API 完成注册与登录</h2>
        <p>建议新开匿名浏览器验证完整流程；新注册账号默认是 member，登录后访问 admin-only 报表会得到 403。</p>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <div className="view-toggle" role="tablist">
          <button
            type="button"
            className={formMode === "login" ? "on" : ""}
            onClick={() => setFormMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={formMode === "register" ? "on" : ""}
            onClick={() => setFormMode("register")}
          >
            注册
          </button>
        </div>
        {formMode === "register" && (
          <label>
            姓名 <input name="name" required autoComplete="name" />
          </label>
        )}
        <label>
          邮箱 <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          密码{" "}
          <input
            name="password"
            type="password"
            required
            autoComplete={formMode === "login" ? "current-password" : "new-password"}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "请求中…" : formMode === "login" ? "登录" : "注册"}
        </button>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
        <p className="muted">
          报表看板仅 <code>admin</code> 可见；member 登录会看到真实的 403（RBAC 演示）。
          提权命令见根 README「常用命令 · 将账户提升为 admin」。
        </p>
      </form>
    </section>
  );
}
