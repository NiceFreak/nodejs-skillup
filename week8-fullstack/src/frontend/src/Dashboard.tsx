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

// ---- OAuth2 授权码流程 · 时序播放（展示资产：把纯文字流程改成一步步的可视时序） ----

type OAuthLane = "browser" | "backend" | "third";
type OAuthChannel = "front" | "back";
type CredKey = "code" | "secret" | "provToken" | "jwt";

const OAUTH_LANES: { key: OAuthLane; label: string; short: string; sub: string }[] = [
  { key: "browser", label: "用户 / 浏览器", short: "浏览器", sub: "前信道 · 半可信" },
  { key: "backend", label: "我们的后端", short: "后端", sub: "Client · 持有 secret" },
  { key: "third", label: "第三方", short: "第三方", sub: "授权 + 资源服务器" },
];

interface OAuthStep {
  from: OAuthLane;
  to: OAuthLane;
  title: string;
  carries: string;
  channel: OAuthChannel;
  creds: CredKey[];
  note: string;
}

const OAUTH_STEPS: OAuthStep[] = [
  {
    from: "browser",
    to: "third",
    title: "跳转授权页",
    carries: "client_id · redirect_uri · state",
    channel: "front",
    creds: [],
    note: "后端拼出带 state 的授权 URL，浏览器跳到第三方。此步没有任何密钥。",
  },
  {
    from: "third",
    to: "browser",
    title: "用户登录并同意",
    carries: "用户在第三方授权",
    channel: "front",
    creds: [],
    note: "用户在第三方（不是我们）输入账号密码并点同意，我们从不接触其密码。",
  },
  {
    from: "browser",
    to: "backend",
    title: "callback 收 code",
    carries: "一次性 code",
    channel: "front",
    creds: ["code"],
    note: "第三方经浏览器重定向回我们的 callback，URL 带一次性 code。code 会过浏览器，所以短命。",
  },
  {
    from: "backend",
    to: "third",
    title: "换 access token",
    carries: "code + client_secret → access token",
    channel: "back",
    creds: ["code", "secret", "provToken"],
    note: "后端直连第三方换 token。client_secret 只在这一步用，绝不经过浏览器——这是整条流程的安全支点。",
  },
  {
    from: "backend",
    to: "third",
    title: "拉用户资料",
    carries: "access token → providerUserId",
    channel: "back",
    creds: ["provToken"],
    note: "后端拿第三方 token 请求资源服务器，得到 provider 侧身份。第三方 token 只属于后端。",
  },
  {
    from: "backend",
    to: "browser",
    title: "签发本系统 JWT",
    carries: "本系统 JWT",
    channel: "back",
    creds: ["jwt"],
    note: "按 provider + providerUserId 建/绑本地用户，签发我们自己的 JWT。之后权限仍走本地 RBAC，与第三方 token 无关。",
  },
];

const OAUTH_CREDS: { key: CredKey; label: string; boundary: string }[] = [
  { key: "code", label: "code", boundary: "一次性换票 · 过浏览器 · 短命" },
  { key: "secret", label: "client_secret", boundary: "只在后端 · 绝不进浏览器" },
  { key: "provToken", label: "第三方 access token", boundary: "后端持有 · 访问第三方 · ≠ 本系统 token" },
  { key: "jwt", label: "本系统 JWT", boundary: "我们签发 · 权限走本地 RBAC" },
];

function laneShort(key: OAuthLane): string {
  return OAUTH_LANES.find((l) => l.key === key)?.short ?? key;
}

function OAuth2FlowPanel() {
  const [step, setStep] = useState(0);
  const cur = OAUTH_STEPS[step];
  const last = OAUTH_STEPS.length - 1;

  return (
    <div className="oauth-flow">
      <section className="chart-card">
        <div className="chart-card-head">
          <div>
            <h3>授权码流程 · 时序播放</h3>
            <p className="muted">一步步看：什么经过浏览器（前信道），什么只在后端（后信道）。</p>
          </div>
          <div className="oauth-nav">
            <button className="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              ← 上一步
            </button>
            <span className="oauth-count">
              {step + 1} / {OAUTH_STEPS.length}
            </span>
            <button className="ghost" onClick={() => setStep((s) => Math.min(last, s + 1))} disabled={step === last}>
              下一步 →
            </button>
          </div>
        </div>

        <div className="oauth-lanes">
          {OAUTH_LANES.map((l) => {
            const active = l.key === cur.from || l.key === cur.to;
            return (
              <div key={l.key} className={`oauth-lane${active ? " active" : ""}`}>
                <strong>{l.label}</strong>
                <span>{l.sub}</span>
              </div>
            );
          })}
        </div>

        <div className={`oauth-stage ${cur.channel}`}>
          <div className="oauth-stage-head">
            <span className="oauth-step-no">{step + 1}</span>
            <strong>{cur.title}</strong>
            <span className={`oauth-chan ${cur.channel}`}>
              {cur.channel === "front" ? "前信道 · 过浏览器" : "后信道 · 后端直连"}
            </span>
          </div>
          <div className="oauth-arrow">
            <span className="oauth-endpoint">{laneShort(cur.from)}</span>
            <span className="oauth-line">
              <span className="oauth-payload">{cur.carries}</span>
            </span>
            <span className="oauth-endpoint">{laneShort(cur.to)}</span>
          </div>
          <p className="oauth-note">{cur.note}</p>
        </div>

        <div className="oauth-dots">
          {OAUTH_STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`oauth-dot ${s.channel}${i === step ? " on" : ""}${i < step ? " done" : ""}`}
              onClick={() => setStep(i)}
              aria-label={`第 ${i + 1} 步：${s.title}`}
              title={`${i + 1}. ${s.title}`}
            />
          ))}
        </div>
      </section>

      <section className="oauth-creds">
        {OAUTH_CREDS.map((c) => {
          const active = cur.creds.includes(c.key);
          return (
            <div key={c.key} className={`oauth-cred${active ? " active" : ""}`}>
              <code>{c.label}</code>
              <span>{c.boundary}</span>
            </div>
          );
        })}
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
