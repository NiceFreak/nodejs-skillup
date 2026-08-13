// 登录 / 注册表单 —— 管理后台共享组件（展示资产，AGENTS.md 白名单）。
// 从 App.tsx 抽出：admin 版与 showcase 版都需要展示「打开管理后台实验」时跳转的登录界面，
// 抽出后两版共用同一份登录逻辑，不复制业务代码。
import { useState, type FormEvent } from "react";
import { ApiError, login, register, token } from "./api";
import type { SafeUser } from "./types";

export default function AuthView({ onSuccess }: { onSuccess: (u: SafeUser) => void }) {
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
        {/* 这不是 tab：它切换的是同一个表单的字段，没有独立面板。
            用 aria-pressed 的开关按钮组表达，不冒充 tablist。 */}
        <div className="view-toggle" role="group" aria-label="表单模式">
          <button
            type="button"
            aria-pressed={formMode === "login"}
            className={formMode === "login" ? "on" : ""}
            onClick={() => setFormMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            aria-pressed={formMode === "register"}
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