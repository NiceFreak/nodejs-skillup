// UI 壳与视图切换 —— 前端为验收展示资产，由 AI 搭建维护（AGENTS.md 白名单）。
import { useState, type FormEvent } from "react";
import { ApiError, login, register, token } from "./api";
import type { SafeUser } from "./types";
import Dashboard from "./Dashboard";

export default function App() {
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
      <header>
        <div>
          <h1>Node.js Skillup · 经营报表管理后台</h1>
          <span className="sub">Express + MongoDB · JWT 认证 · 最小 RBAC（admin-only 报表）</span>
        </div>
        <div className="head-right">
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
          <Dashboard onAuthExpired={handleLogout} />
        ) : (
          <AuthView onSuccess={handleLogin} />
        )}
      </main>

      <footer className="page muted">
        前端为展示脚手架（AI 搭建维护）；后端 API、鉴权与聚合逻辑见
        <code> week2-express/src/</code>。AI 功能整合在 backlog（7/31 后再启用）。
      </footer>
    </>
  );
}

function AuthView({ onSuccess }: { onSuccess: (u: SafeUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
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
      if (mode === "register") {
        await register(String(data.get("name")), email, password);
        setInfo("注册成功，请直接登录（新账号默认角色 member）。");
        setMode("login");
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
      <form className="card" onSubmit={handleSubmit}>
        <div className="view-toggle" role="tablist">
          <button
            type="button"
            className={mode === "login" ? "on" : ""}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "on" : ""}
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </div>
        {mode === "register" && (
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
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "请求中…" : mode === "login" ? "登录" : "注册"}
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
