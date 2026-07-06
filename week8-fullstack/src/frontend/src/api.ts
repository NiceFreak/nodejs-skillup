// API 封装层 —— 脚手架（壳）由 AI 提供，真实端点接线由你在 W6 完成。
//
// ⚠️ 这里是「端到端串联」的学习点，属于你的核心任务：
//    下面 login() / fetchList() 的 fetch 细节标了 TODO，请对着你 W2/W4 自己写的
//    后端路由把它们接通，不要让 AI 代写这部分。
import type { ListItem } from "./types";

export const API_BASE = "http://localhost:3000"; // TODO: 换成你后端实际地址/端口

export const token = {
  get: (): string | null => localStorage.getItem("skillup_token"),
  set: (t: string): void => localStorage.setItem("skillup_token", t),
  clear: (): void => localStorage.removeItem("skillup_token"),
};

// 统一 fetch：自动带 Authorization，非 2xx 抛错。
// 导出供你在 login()/fetchList() 接线时直接用（见下方 TODO 示例）。
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const t = token.get();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `请求失败 (${res.status})`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

// ---- 下面是你 W6 要接通的端点（现在是 TODO 占位）----

export async function login(email: string, password: string): Promise<{ token: string }> {
  // TODO(W6): 接你 W4 的登录路由，返回 { token }
  //   例：return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  void email;
  void password;
  throw new Error("尚未接通：请在 api.ts 的 login() 里接上你 W4 的登录路由");
}

export async function fetchList(): Promise<ListItem[]> {
  // TODO(W6): 接你 W2/W3 的列表路由（受保护资源），返回数组
  //   例：return request<ListItem[]>("/users");
  throw new Error("尚未接通：请在 api.ts 的 fetchList() 里接上你的列表路由");
}
