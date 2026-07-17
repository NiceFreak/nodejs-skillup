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
// [TS] import type / 行内 type 修饰符：显式标记「只在类型位置使用」的导入，
// 打包时整行擦除，不产生运行时代码（isolatedModules 下也能安全单文件编译）。
import {
  ORDER_STATUSES,
  type CustomerSpendingRow,
  type MonthlySalesRow,
  type OrderStatus,
  type ProbeResult,
} from "./types";

// [TS] Record<K, V> 工具类型：键必须覆盖 OrderStatus 的每个成员，值是 string——
// 后端加一个新状态、这里漏写映射时，编译期直接报错。
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
    // Date 构造器的 month 参数可为负/越界，JS 会自动进退位年份——正好用来回溯自然月
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

// [TS] 字符串字面量联合当「轻量状态机」：比多个 boolean 组合（isLoading + isError…）
// 更能表达互斥——任一时刻只处于一个状态，switch/if 分支穷举时 TS 还能查漏。
type AccessState = "loading" | "admin" | "forbidden" | "unauthorized" | "error";
type DashboardTab = "reports" | "oauth2";

export default function Dashboard({ onAuthExpired }: { onAuthExpired: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("reports");
  // 筛选行：一行、置于所有图表之上，作用于下方全部内容
  const [status, setStatus] = useState<OrderStatus>("completed");
  const [months, setMonths] = useState(6);
  const [days, setDays] = useState(30);

  const [access, setAccess] = useState<AccessState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [monthly, setMonthly] = useState<MonthlySalesRow[]>([]);
  const [customers, setCustomers] = useState<CustomerSpendingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // [React] useCallback：把函数身份「钉住」，只有依赖 (months/days/status) 变了才生成新函数；
  // 下面 useEffect 以 [load] 为依赖，于是「筛选条件变 → load 变 → effect 重新执行」串成一条链。
  const load = useCallback(async () => {
    setRefreshing(true);
    setErrorMsg("");
    try {
      // [ES2015/2017] Promise.all + 数组解构：两个报表请求并发发出，
      // await 同时等两个结果，再按位置解构到 m / c——比串行 await 少一轮网络往返。
      const [m, c] = await Promise.all([
        fetchMonthlySales(months, status),
        fetchCustomerSpending(days, status),
      ]);
      setMonthly(fillMonths(m, months));
      setCustomers(c);
      setAccess("admin");
    } catch (ex) {
      // [TS] instanceof 类型收窄：catch 变量默认是 unknown，
      // 经过 instanceof ApiError 判断后，该分支内 ex 自动变成 ApiError，可安全读 .status。
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
      <div className="section-tabs" role="tablist" aria-label="验收视图">
        <button
          className={activeTab === "reports" ? "on" : ""}
          onClick={() => setActiveTab("reports")}
          role="tab"
          aria-selected={activeTab === "reports"}
        >
          经营报表
        </button>
        <button
          className={activeTab === "oauth2" ? "on" : ""}
          onClick={() => setActiveTab("oauth2")}
          role="tab"
          aria-selected={activeTab === "oauth2"}
        >
          OAuth2 流程
        </button>
      </div>

      {activeTab === "reports" ? (
        <>
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

          {/* [React] 条件渲染惯用法：`state === x && <JSX/>`；刷新时整块降透明度
              （保留旧渲染而不是骨架屏闪烁，布局不跳动） */}
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
        </>
      ) : (
        <OAuth2FlowPanel />
      )}
    </div>
  );
}

function OAuth2FlowPanel() {
  return (
    <div className="oauth-flow">
      <section className="chart-card">
        <div className="chart-card-head">
          <div>
            <h3>授权码流程</h3>
            <p className="muted">开发者配置 → 用户授权 → 后端换 token → 建立本系统登录态</p>
          </div>
        </div>
        <ol className="flow-list">
          <li>
            <strong>注册 OAuth App</strong>
            <span>
              在 GitHub / Google 控制台登记 <code>redirect_uri</code>，拿到
              <code> client_id</code> 和 <code>client_secret</code>。
            </span>
          </li>
          <li>
            <strong>跳转授权页</strong>
            <span>
              用户点击第三方登录，我们带 <code>client_id</code>、<code>redirect_uri</code>、
              <code>state</code> 把浏览器跳到授权服务器。
            </span>
          </li>
          <li>
            <strong>callback 收 code</strong>
            <span>
              第三方授权服务器通过浏览器重定向回我们的 callback，并在 URL 上带一次性的
              <code> code</code>。
            </span>
          </li>
          <li>
            <strong>后端换 access token</strong>
            <span>
              我们的后端用 <code>code + client_secret</code> 向授权服务器换
              <code> access token</code>。
            </span>
          </li>
          <li>
            <strong>请求用户资料</strong>
            <span>
              后端用第三方 <code>access token</code> 请求资源服务器，拿到
              <code> providerUserId</code> 等资料。
            </span>
          </li>
          <li>
            <strong>签发本系统 JWT</strong>
            <span>
              根据 <code>provider + providerUserId</code> 创建或绑定本地用户，再签发我们自己的
              JWT 给前端。
            </span>
          </li>
        </ol>
      </section>

      <section className="oauth-grid">
        <div className="chart-card">
          <h3>凭据边界</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>内容</th>
                <th>职责</th>
                <th>边界</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>code</code></td>
                <td>一次性换票凭据</td>
                <td>经浏览器带回 callback，短期使用</td>
              </tr>
              <tr>
                <td><code>access token</code></td>
                <td>访问第三方资源</td>
                <td>由后端保存和使用，不作为本系统 API token</td>
              </tr>
              <tr>
                <td><code>client_secret</code></td>
                <td>证明应用后端身份</td>
                <td>只在后端换 token 时使用，不能进入前端</td>
              </tr>
              <tr>
                <td>本系统 JWT</td>
                <td>访问我们的 API</td>
                <td>由我们的后端签发，权限仍按本地用户与 RBAC 判断</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="chart-card">
          <h3>威胁点</h3>
          <ul className="check-list">
            <li>
              <code>state</code> 是随机 nonce / 关联 ID，用来确认 callback 属于刚刚发起的流程。
            </li>
            <li>
              <code>redirect_uri</code> 是回调白名单，限制 <code>code</code> 只能回到我们控制的地址。
            </li>
            <li>
              <code>client_secret</code> 不能放浏览器，否则任何人都能冒充我们的应用后端。
            </li>
            <li>
              第三方 token 和本系统 JWT 分属两个权限域，不能混用。
            </li>
          </ul>
        </div>
      </section>
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
                  {/* [ES2017] padStart：不足位数在头部补齐，7 → "07" */}
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
    // [React] 函数式 setState：基于上一次状态 prev 计算新状态，避免闭包里的旧值；
    // 新纪录放最前 + slice 截断，等价于「定长队列头插」，且不改动原数组（不可变更新）。
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
