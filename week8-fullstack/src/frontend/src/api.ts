// API 封装层 —— 已对照 week2-express/src 的真实路由完整接线。
// 按 AGENTS.md 白名单与 2026-07-15 决策（前端仅为展示、AI 搭建、本人不写），
// 前端接线由 AI 完成；「端到端链路的验收讲解」仍是本人任务（见 week8 README）。
//
// 契约要点（与后端一一对应）：
//   POST /auth/login    → 200 { code, message, payload: { accessToken, user } }
//   POST /auth/register → 201 { message, data }
//   GET  /reports/*     → 200 裸数组；401 { error }（无/坏 token）；403 { error }（非 admin）
//   错误体有 { error } 与 { code, message } 两种形状，统一在 readErrorMessage 里兜住。
import type {
  CustomerSpendingRow,
  LoginResponse,
  MonthlySalesRow,
  OrderStatus,
  SafeUser,
} from "./types";

// 相对路径 + Vite dev proxy 转发到后端（见 vite.config.ts），无需后端开 CORS。
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const token = {
  get: (): string | null => localStorage.getItem("skillup_token"),
  set: (t: string): void => localStorage.setItem("skillup_token", t),
  clear: (): void => localStorage.removeItem("skillup_token"),
};

/** 带 HTTP 状态码的错误，UI 用它区分 401（认证）与 403（授权） */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function readErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as { error?: unknown; message?: unknown };
    if (typeof b.error === "string") return b.error;
    if (typeof b.message === "string") return b.message;
  }
  return `请求失败 (${status})`;
}

// 统一 fetch：自动带 Authorization，非 2xx 抛 ApiError。
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const t = token.get();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    throw new ApiError(res.status, readErrorMessage(body, res.status));
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

// ---- 认证 ----

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; user: SafeUser }> {
  const res = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res.payload;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<void> {
  await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

// ---- 报表（admin-only：validateToken → requireRole('admin') → controller）----

export async function fetchCustomerSpending(
  days: number,
  status: OrderStatus,
): Promise<CustomerSpendingRow[]> {
  return request<CustomerSpendingRow[]>(
    `/reports/customer-spending?days=${days}&status=${status}`,
  );
}

export async function fetchMonthlySales(
  months: number,
  status: OrderStatus,
): Promise<MonthlySalesRow[]> {
  return request<MonthlySalesRow[]>(`/reports/monthly-sales?months=${months}&status=${status}`);
}

// ---- 鉴权演示：不抛错，原样返回状态码和响应体，供面板展示 401/403/200 ----

export async function probe(
  path: string,
  withToken: boolean,
): Promise<{ status: number | null; body: string }> {
  const headers = new Headers();
  const t = token.get();
  if (withToken && t) headers.set("Authorization", `Bearer ${t}`);
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers });
    const text = await res.text();
    let body = text;
    try {
      const parsed: unknown = JSON.parse(text);
      body = Array.isArray(parsed)
        ? `[…${parsed.length} 行报表数据]`
        : JSON.stringify(parsed, null, 0);
    } catch {
      /* 非 JSON 原样展示 */
    }
    return { status: res.status, body: body.slice(0, 300) };
  } catch (ex) {
    return { status: null, body: ex instanceof Error ? ex.message : "网络错误" };
  }
}
