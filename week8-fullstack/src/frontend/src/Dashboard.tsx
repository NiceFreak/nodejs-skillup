// 管理看板：筛选行 → KPI 行 → 两张报表图（图表/表格可切换）→ 鉴权演示面板。
// 数据全部来自 admin-only 报表 API；member 登录会拿到 403，看板降级为 RBAC 说明。
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  fetchCustomerSpending,
  fetchMonthlySales,
  probe,
  token,
} from "./api";
import { ColumnChart, HBarChart, StatTile, fmtMoney } from "./charts";
import {
  ORDER_STATUSES,
  type CustomerSpendingRow,
  type MonthlySalesRow,
  type OrderStatus,
  type ProbeResult,
} from "./types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  completed: "已完成",
  pending: "待处理",
  canceled: "已取消",
  refunding: "退款中",
  refunded: "已退款",
};

/** 无订单的月份不在响应里：按窗口补齐 N 个自然月（与后端同为「当前月 + 此前 N-1 个自然月」） */
function fillMonths(rows: MonthlySalesRow[], months: number): MonthlySalesRow[] {
  const now = new Date();
  const out: MonthlySalesRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const hit = rows.find((r) => r.year === d.getFullYear() && r.month === d.getMonth() + 1);
    out.push(
      hit ?? {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        orderCount: 0,
        totalSpending: 0,
        avgOrderValue: 0,
      },
    );
  }
  return out;
}

type AccessState = "loading" | "admin" | "forbidden" | "unauthorized" | "error";

export default function Dashboard({ onAuthExpired }: { onAuthExpired: () => void }) {
  // 筛选行：一行、置于所有图表之上，作用于下方全部内容
  const [status, setStatus] = useState<OrderStatus>("completed");
  const [months, setMonths] = useState(6);
  const [days, setDays] = useState(30);

  const [access, setAccess] = useState<AccessState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [monthly, setMonthly] = useState<MonthlySalesRow[]>([]);
  const [customers, setCustomers] = useState<CustomerSpendingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setErrorMsg("");
    try {
      const [m, c] = await Promise.all([
        fetchMonthlySales(months, status),
        fetchCustomerSpending(days, status),
      ]);
      setMonthly(fillMonths(m, months));
      setCustomers(c);
      setAccess("admin");
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 403) {
        setAccess("forbidden");
      } else if (ex instanceof ApiError && ex.status === 401) {
        setAccess("unauthorized");
      } else {
        setAccess("error");
        setErrorMsg(ex instanceof Error ? ex.message : "加载失败");
      }
    } finally {
      setRefreshing(false);
    }
  }, [months, days, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpi = useMemo(() => {
    const totalSales = monthly.reduce((s, r) => s + r.totalSpending, 0);
    const totalOrders = monthly.reduce((s, r) => s + r.orderCount, 0);
    return {
      totalSales,
      totalOrders,
      avgOrder: totalOrders > 0 ? totalSales / totalOrders : 0,
      customerCount: customers.length,
    };
  }, [monthly, customers]);

  return (
    <div className="dashboard">
      {/* 筛选行 */}
      <div className="filter-row">
        <label>
          订单状态
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}（{s}）
              </option>
            ))}
          </select>
        </label>
        <label>
          月度趋势窗口
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 12].map((m) => (
              <option key={m} value={m}>
                近 {m} 个自然月
              </option>
            ))}
          </select>
        </label>
        <label>
          客户消费窗口
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                近 {d} 天
              </option>
            ))}
          </select>
        </label>
        <button className="ghost" onClick={() => void load()} disabled={refreshing}>
          {refreshing ? "刷新中…" : "刷新"}
        </button>
      </div>

      {access === "forbidden" && (
        <div className="notice notice-403">
          <strong>403 权限不足</strong>
          <p>
            当前账号角色是 <code>member</code>，报表 API 要求 <code>admin</code>。这正是最小
            RBAC 在工作：token 有效（身份已确认），但服务端查库得到的角色不满足路由要求。
            用 mongosh 将账号提权为 admin 后重新登录即可查看报表（命令见根 README「常用命令」）。
          </p>
        </div>
      )}
      {access === "unauthorized" && (
        <div className="notice notice-403">
          <strong>401 认证失效</strong>
          <p>token 无效或已过期，请重新登录。</p>
          <button onClick={() => { token.clear(); onAuthExpired(); }}>重新登录</button>
        </div>
      )}
      {access === "error" && <p className="error">{errorMsg}</p>}

      {access === "admin" && (
        <div style={{ opacity: refreshing ? 0.55 : 1 }}>
          {/* KPI 行 */}
          <div className="kpi-row">
            <StatTile
              label={`总销售额（近 ${months} 个月 · ${STATUS_LABEL[status]}）`}
              value={`¥${fmtMoney(Math.round(kpi.totalSales))}`}
            />
            <StatTile label="订单数" value={kpi.totalOrders.toLocaleString("zh-CN")} />
            <StatTile
              label="平均客单价"
              value={`¥${fmtMoney(Math.round(kpi.avgOrder))}`}
            />
            <StatTile
              label={`活跃客户（近 ${days} 天）`}
              value={kpi.customerCount.toLocaleString("zh-CN")}
            />
          </div>

          <MonthlyCard monthly={monthly} />
          <CustomerCard customers={customers} days={days} />
        </div>
      )}

      <AuthProbePanel />
    </div>
  );
}

// ---- 月度趋势卡片 ----

function MonthlyCard({ monthly }: { monthly: MonthlySalesRow[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>月度销售趋势</h3>
          <p className="muted">GET /reports/monthly-sales · 自然月边界 $gte/$lt 半开区间</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>
      {view === "chart" ? (
        <ColumnChart
          data={monthly.map((r) => ({
            label: `${r.month}月`,
            value: r.totalSpending,
            detail: (
              <>
                <div className="tip-value">¥{fmtMoney(r.totalSpending)}</div>
                <div className="tip-row">
                  {r.year}年{r.month}月 · {r.orderCount} 单
                  {r.orderCount > 0 ? ` · 客单价 ¥${fmtMoney(Math.round(r.avgOrderValue))}` : ""}
                </div>
              </>
            ),
          }))}
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>月份</th>
              <th className="num">销售额</th>
              <th className="num">订单数</th>
              <th className="num">客单价</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((r) => (
              <tr key={`${r.year}-${r.month}`}>
                <td>
                  {r.year}-{String(r.month).padStart(2, "0")}
                </td>
                <td className="num">¥{r.totalSpending.toLocaleString("zh-CN")}</td>
                <td className="num">{r.orderCount}</td>
                <td className="num">¥{Math.round(r.avgOrderValue).toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---- 客户消费卡片 ----

function CustomerCard({ customers, days }: { customers: CustomerSpendingRow[]; days: number }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const TOP_N = 8;
  const top = customers.slice(0, TOP_N);
  return (
    <section className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>客户消费 Top {Math.min(TOP_N, customers.length) || TOP_N}（近 {days} 天）</h3>
          <p className="muted">GET /reports/customer-spending · $group + $lookup 聚合</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>
      {customers.length === 0 ? (
        <p className="muted">当前窗口内没有符合条件的订单。</p>
      ) : view === "chart" ? (
        <>
          <HBarChart
            data={top.map((r) => ({
              label: r.customerName,
              value: r.totalSpending,
              detail: (
                <>
                  <div className="tip-value">¥{fmtMoney(r.totalSpending)}</div>
                  <div className="tip-row">
                    {r.customerName}（{r.customerEmail}）· {r.orderCount} 单 · 客单价 ¥
                    {fmtMoney(Math.round(r.avgOrderValue))}
                  </div>
                </>
              ),
            }))}
          />
          {customers.length > TOP_N && (
            <p className="muted">其余 {customers.length - TOP_N} 位客户见表格视图。</p>
          )}
        </>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>客户</th>
              <th>邮箱</th>
              <th className="num">消费总额</th>
              <th className="num">订单数</th>
              <th className="num">客单价</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((r) => (
              <tr key={r.userId}>
                <td>{r.customerName}</td>
                <td>{r.customerEmail}</td>
                <td className="num">¥{r.totalSpending.toLocaleString("zh-CN")}</td>
                <td className="num">{r.orderCount}</td>
                <td className="num">¥{Math.round(r.avgOrderValue).toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "chart" | "table";
  onChange: (v: "chart" | "table") => void;
}) {
  return (
    <div className="view-toggle" role="tablist">
      <button
        className={view === "chart" ? "on" : ""}
        onClick={() => onChange("chart")}
        role="tab"
        aria-selected={view === "chart"}
      >
        图表
      </button>
      <button
        className={view === "table" ? "on" : ""}
        onClick={() => onChange("table")}
        role="tab"
        aria-selected={view === "table"}
      >
        表格
      </button>
    </div>
  );
}

// ---- 鉴权演示面板：现场演示 401 / 403 / 200 三条路径 ----

const PROBE_PATH = "/reports/monthly-sales?months=6&status=completed";

function AuthProbePanel() {
  const [log, setLog] = useState<ProbeResult[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(label: string, withToken: boolean) {
    setBusy(true);
    const res = await probe(PROBE_PATH, withToken);
    setLog((prev) => [
      {
        label,
        method: "GET",
        path: PROBE_PATH,
        withToken,
        status: res.status,
        body: res.body,
        at: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      },
      ...prev.slice(0, 7),
    ]);
    setBusy(false);
  }

  return (
    <section className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>鉴权链路演示</h3>
          <p className="muted">
            validateToken（认证 401）→ requireRole('admin')（授权 403）→ controller（200）
          </p>
        </div>
      </div>
      <div className="probe-actions">
        <button className="ghost" disabled={busy} onClick={() => void run("不带 token 请求", false)}>
          不带 token 请求报表
        </button>
        <button className="ghost" disabled={busy} onClick={() => void run("带当前 token 请求", true)}>
          带当前 token 请求报表
        </button>
      </div>
      {log.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>请求</th>
              <th>状态</th>
              <th>响应</th>
            </tr>
          </thead>
          <tbody>
            {log.map((r, i) => (
              <tr key={i}>
                <td className="num">{r.at}</td>
                <td>{r.label}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td className="probe-body">{r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <span className="badge badge-err">✕ 网络错误</span>;
  const cls = status < 300 ? "badge-ok" : status === 403 ? "badge-warn" : "badge-err";
  const icon = status < 300 ? "✓" : "✕";
  return (
    <span className={`badge ${cls}`}>
      {icon} {status}
    </span>
  );
}
