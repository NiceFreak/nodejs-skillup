// API 封装层 —— 脚手架（壳）由 AI 提供，真实端点接线由你在 W6 完成。
//
// ⚠️ 这里是「端到端串联」的学习点，属于你的核心任务：
//    下面每个函数的 fetch 细节（路径、请求体、错误语义）标了 TODO，
//    请你对着 W2/W4 自己写的后端路由把它们接通，不要让 AI 代写这部分。
//
// 约定：后端 base URL 用 Vite 风格环境变量或直接改这里。
export const API_BASE = "http://localhost:3000"; // TODO: 换成你后端实际地址/端口

// 简单的 token 存取（W4 认证产出的 JWT）
export const token = {
  get: () => localStorage.getItem("skillup_token"),
  set: (t) => localStorage.setItem("skillup_token", t),
  clear: () => localStorage.removeItem("skillup_token"),
};

// 统一 fetch：自动带上 Authorization，非 2xx 抛错
async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `请求失败 (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

// ---- 下面是你 W6 要接通的端点（现在是 TODO 占位）----

export async function login(email, password) {
  // TODO(W6): 接你 W4 的登录路由，返回 { token }
  //   例：return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  throw new Error("尚未接通：请在 api.js 的 login() 里接上你 W4 的登录路由");
}

export async function fetchList() {
  // TODO(W6): 接你 W2/W3 的列表路由（受保护资源），返回数组
  //   例：return request("/users");
  throw new Error("尚未接通：请在 api.js 的 fetchList() 里接上你的列表路由");
}
