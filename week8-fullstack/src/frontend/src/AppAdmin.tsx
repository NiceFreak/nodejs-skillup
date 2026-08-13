// UI 壳与视图切换 —— admin 独立入口版（展示资产，AGENTS.md 白名单）。
// 双入口拆分：本文件是 admin / 管理后台版，只引用管理后台依赖树
//（Dashboard / AuthView / api），不引用任何展板模块（Showcase / *Topics / *Facts），
// 确保 admin 产物不包含 showcase 树（面试问答稿、W9 部署笔记、w9Facts 等）。
// 展板走独立入口 showcase.html（showcase 构建）。
import { Suspense, lazy, useEffect, useState } from "react";
import { token } from "./api";
import type { SafeUser } from "./types";
import AuthView from "./AuthView";

// 管理后台按需加载：报表视图与图表是一个相对大的 chunk，懒加载让首屏更快。
const Dashboard = lazy(() => import("./Dashboard"));

export default function AppAdmin() {
  // 只存在一种路由：管理后台（入口页本身是 admin.html）。
  const [user, setUser] = useState<SafeUser | null>(() => {
    const cached = localStorage.getItem("skillup_user");
    if (!token.get() || !cached) return null;
    try {
      return JSON.parse(cached) as SafeUser;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // hash 是唯一真源：任何导航都写 hash，再由 hashchange 回流到 state。
    // admin 版当前只关心是否有人试图带 #/showcase 进来——归一为 #/admin。
    function sync() {
      if (window.location.hash && window.location.hash !== "#/admin") {
        window.location.hash = "#/admin";
      }
    }
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

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
          <h1>Node.js Skillup · 经营报表管理后台</h1>
          <span className="sub">受保护路由 · JWT 认证 · 最小 RBAC（admin-only 报表）</span>
        </div>
        <div className="head-right">
          <nav className="app-nav" aria-label="应用区域">
            {/* admin 版不再渲染「学习展板」按钮：展板在独立入口 showcase.html。 */}
            <span className="pill on">管理后台</span>
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
          <Suspense fallback={<p className="notes-loading">正在载入管理后台…</p>}>
            <Dashboard onAuthExpired={handleLogout} />
          </Suspense>
        ) : (
          <AuthView onSuccess={handleLogin} />
        )}
      </main>

      <footer className="page muted">
        管理后台通过真实注册 / 登录 / JWT / RBAC 链路访问。后端实现见
        <code> week2-express/src/</code>。学习展板（零后端）在独立入口 <code>showcase.html</code>。
      </footer>
    </>
  );
}