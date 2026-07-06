// UI 壳与视图切换 —— 脚手架由 AI 提供（AGENTS.md 允许的前端验收界面脚手架）。
// 业务接线在 api.ts 的 TODO 里，由你完成。
import { useEffect, useState, type FormEvent } from "react";
import { login, fetchList, token } from "./api";
import type { ListItem } from "./types";

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => Boolean(token.get()));

  return (
    <>
      <header>
        <h1>Node.js Skillup · 全栈验收 Demo</h1>
        <span className={`pill${loggedIn ? " on" : ""}`}>{loggedIn ? "已登录" : "未登录"}</span>
      </header>

      {loggedIn ? (
        <ListView onLogout={() => setLoggedIn(false)} />
      ) : (
        <LoginView onSuccess={() => setLoggedIn(true)} />
      )}

      <section className="view">
        <h2>AI 功能（backlog 占位）</h2>
        <p className="muted">
          AI 能力整合已移入 backlog；此处仅留占位，7/31 后如补 AI demo 再启用。
        </p>
        <button disabled>智能总结（未启用）</button>
      </section>
    </>
  );
}

function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    try {
      const { token: t } = await login(email, password);
      token.set(t);
      onSuccess();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "登录失败");
    }
  }

  return (
    <section className="view">
      <h2>登录</h2>
      <form className="card" onSubmit={handleSubmit}>
        <label>
          邮箱 <input name="email" type="email" required />
        </label>
        <label>
          密码 <input name="password" type="password" required />
        </label>
        <button type="submit">登录</button>
        <p className="error">{error}</p>
      </form>
    </section>
  );
}

function ListView({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setItems(await fetchList());
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "加载失败");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleLogout() {
    token.clear();
    onLogout();
  }

  return (
    <section className="view">
      <div className="row">
        <h2>数据列表</h2>
        <button className="ghost" onClick={handleLogout}>
          登出
        </button>
      </div>
      <button onClick={() => void load()}>刷新</button>
      <ul>
        {items.length === 0 && !error ? (
          <li className="muted">暂无数据</li>
        ) : (
          items.map((item, i) => (
            <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
          ))
        )}
      </ul>
      <p className="error">{error}</p>
    </section>
  );
}
