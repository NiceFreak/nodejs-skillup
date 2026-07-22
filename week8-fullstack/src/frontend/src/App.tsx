// UI 壳与视图切换 —— 前端为验收展示资产，由 AI 搭建维护（AGENTS.md 白名单）。
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, login, register, token } from "./api";
import type { BoardMode, SafeUser } from "./types";
import Dashboard from "./Dashboard";
import Showcase from "./Showcase";

type AppRoute = "showcase" | "admin";

function readRoute(): AppRoute {
  return window.location.hash === "#/admin" ? "admin" : "showcase";
}

function readMode(): BoardMode {
  return localStorage.getItem("skillup_board_mode") === "review" ? "review" : "demo";
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(readRoute);
  // 展板视角：仅本人的设置，在登录前选择；默认展示模式，展示接收方无需感知。
  const [mode, setMode] = useState<BoardMode>(readMode);

  function chooseMode(next: BoardMode) {
    localStorage.setItem("skillup_board_mode", next);
    setMode(next);
  }
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
    function syncRoute() {
      setRoute(readRoute());
    }
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  function navigate(nextRoute: AppRoute) {
    window.location.hash = nextRoute === "admin" ? "#/admin" : "#/showcase";
    setRoute(nextRoute);
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
            {route === "showcase" ? "公开访问 · 可视化复习与 demo 展示" : "受保护路由 · JWT 认证 · 最小 RBAC（admin-only 报表）"}
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
          <Showcase openAdmin={() => navigate("admin")} mode={mode} />
        ) : user ? (
          <Dashboard onAuthExpired={handleLogout} />
        ) : (
          <AuthView onSuccess={handleLogin} mode={mode} onModeChange={chooseMode} />
        )}
      </main>

      <footer className="page muted">
        学习展板可直接访问；管理后台通过真实注册 / 登录 / JWT / RBAC 链路访问。后端实现见
        <code> week2-express/src/</code>。
      </footer>
    </>
  );
}

function AuthView({
  onSuccess,
  mode,
  onModeChange,
}: {
  onSuccess: (u: SafeUser) => void;
  mode: BoardMode;
  onModeChange: (m: BoardMode) => void;
}) {
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
        <div className="board-mode-pick">
          <span>展板视角 · 仅本人</span>
          <div className="board-mode" role="group" aria-label="展板视角">
            <button type="button" className={mode === "demo" ? "on" : ""} aria-pressed={mode === "demo"} onClick={() => onModeChange("demo")}>展示</button>
            <button type="button" className={mode === "review" ? "on" : ""} aria-pressed={mode === "review"} onClick={() => onModeChange("review")}>复习</button>
          </div>
          <small>复习视角会在「学习展板 · 数据库聚合」显示我的开放问题与自我复盘，仅本机记住；展示视角对外只呈现技术说明。</small>
        </div>
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
