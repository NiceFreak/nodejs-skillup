// 后端真实契约的类型描述（对照 week2-express/src 的 controller/repository 输出）。

/** POST /auth/login 成功响应（契约 v2 信封） */
export interface LoginResponse {
  code: number;
  message: string;
  payload: {
    accessToken: string;
    user: SafeUser;
  };
}

/** 登录/注册返回的安全用户摘要（不含 role —— token 只证明 sub，角色由服务端查库判断） */
export interface SafeUser {
  userId: string;
  name: string;
  email: string;
}

/** GET /reports/customer-spending 单行（按 totalSpending 降序） */
export interface CustomerSpendingRow {
  orderCount: number;
  totalSpending: number;
  avgOrderValue: number;
  userId: string;
  customerName: string;
  customerEmail: string;
}

/** GET /reports/monthly-sales 单行（无订单的月份不在数组里，前端补零） */
export interface MonthlySalesRow {
  orderCount: number;
  totalSpending: number;
  avgOrderValue: number;
  year: number;
  month: number;
}

/** 订单状态枚举（对照后端 validateStatus） */
export const ORDER_STATUSES = [
  "completed",
  "pending",
  "canceled",
  "refunding",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** 鉴权演示面板里一次请求的记录 */
export interface ProbeResult {
  label: string;
  method: string;
  path: string;
  withToken: boolean;
  status: number | null; // null = 网络错误
  body: string;
  at: string;
}
