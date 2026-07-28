import { useEffect, useState } from "react";
import type { BoardMode } from "./types";

type FlowId = "admin" | "new-user";

interface FlowStep {
  label: string;
  detail: string;
  status: string;
}

interface FlowDefinition {
  id: FlowId;
  tab: string;
  title: string;
  contract: string;
  tone: "pass" | "deny";
  steps: FlowStep[];
  proves: string[];
  limits: string[];
}

const FLOWS: FlowDefinition[] = [
  {
    id: "admin",
    tab: "admin · 200",
    title: "登录签发的真实 Token 被资源链路接纳",
    contract: "从已有 admin 凭据开始，隔离注册逻辑，只验证登录结果与后续认证、授权和最小资源访问的衔接。",
    tone: "pass",
    steps: [
      { label: "Admin fixture", detail: "内存库中预置 bcrypt 哈希", status: "准备" },
      { label: "POST /auth/login", detail: "真实邮箱与明文密码", status: "200" },
      { label: "payload.accessToken", detail: "响应交付非空字符串", status: "Token" },
      { label: "GET monthly-sales", detail: "Bearer Token 进入保护链", status: "200" },
    ],
    proves: [
      "登录阶段成功完成用户查询、bcrypt 比对与 Token 签发",
      "Controller 按 body.payload.accessToken 交付凭证",
      "Token 能通过 validateToken、数据库角色查询与资源处理",
    ],
    limits: [
      "非空字符串本身不能证明它是有效 JWT",
      "报表返回 200 不等于本测试重新验证了聚合数值",
      "失败时仍需用直接签发 Token 的报表测试作对照",
    ],
  },
  {
    id: "new-user",
    tab: "新用户 · 403",
    title: "新注册用户不能访问 admin 报表",
    contract: "保护外部权限结果，不直接读取数据库角色；测试关注非 admin 用户被拒绝，而不是默认角色字段的精确值。",
    tone: "deny",
    steps: [
      { label: "POST /auth/register", detail: "创建符合密码规则的新用户", status: "201" },
      { label: "POST /auth/login", detail: "使用刚注册的真实凭据", status: "200" },
      { label: "payload.accessToken", detail: "登录链实时签发凭证", status: "Token" },
      { label: "GET monthly-sales", detail: "身份有效，但 admin 权限不足", status: "403" },
    ],
    proves: [
      "注册、登录、认证与授权四段可以按当前契约串联",
      "Token 已通过认证，否则请求更可能停在 401",
      "授权阶段把当前用户作为非 admin 拒绝",
    ],
    limits: [
      "403 不能单独证明数据库角色精确等于 member",
      "请求被授权中间件拦截，不能证明报表聚合正确",
      "这仍是后端集成测试，不是包含前端的完整 E2E",
    ],
  },
];

const LIFECYCLE = [
  { name: "JWT_SECRET", start: "保存原值后固定覆盖", hold: "整个 suite", end: "删除或精确恢复" },
  { name: "MongoMemoryServer", start: "启动独立实例", hold: "整个 suite", end: "停止实例" },
  { name: "Mongoose", start: "连接内存库 URI", hold: "整个 suite", end: "先断开连接" },
  { name: "Admin fixture", start: "连接后创建", hold: "只读共享", end: "随数据库销毁" },
];

const COVERAGE_TOPOLOGY = [
  { label: "validator 单测", covers: "输入归一化与拒绝", gap: "不经过 HTTP / DB / auth", tone: "existing" },
  { label: "报表集成测试", covers: "直接签发 Token -> RBAC -> 聚合响应", gap: "绕过真实登录签发", tone: "existing" },
  { label: "认证流集成测试", covers: "register / login -> Token -> RBAC", gap: "不重证聚合数值", tone: "added" },
];

const EVIDENCE_MATRIX = [
  {
    observation: "admin 真实登录 -> 报表 200",
    proves: "登录契约、Token 被 validateToken 接纳、admin 授权分支、报表 Controller 已到达",
    limits: "不重证聚合数值；不覆盖真实 OAuth2；不代表所有角色和权限组合",
    tone: "pass",
  },
  {
    observation: "新注册用户真实登录 -> 报表 403",
    proves: "注册与登录可串联、Token 已通过认证、RBAC 在资源处理前拒绝非 admin",
    limits: "不证明数据库角色精确等于 member；不证明报表 Controller 或聚合已执行",
    tone: "deny",
  },
  {
    observation: "直接签发 admin Token -> 月报 200 + 数据断言",
    proves: "报表路由、RBAC admin 分支与当前 fixture 下的月报聚合契约",
    limits: "不证明 login 能签出兼容 Token；不覆盖注册；不覆盖真实 OAuth2",
    tone: "pass",
  },
];

const SUITE_TIMELINE = [
  { phase: "1", label: "保存并覆盖 JWT_SECRET", owner: "process env", tone: "resource" },
  { phase: "2", label: "启动 MongoMemoryServer", owner: "独立内存库", tone: "resource" },
  { phase: "3", label: "Mongoose 连接并创建 fixture", owner: "DB state", tone: "resource" },
  { phase: "4", label: "执行两条认证流", owner: "test cases", tone: "flow" },
  { phase: "5", label: "断开 Mongoose -> 停止内存库", owner: "afterAll", tone: "controlled" },
  { phase: "6", label: "精确恢复或删除 JWT_SECRET", owner: "afterAll", tone: "controlled" },
];

export default function W6Board({ mode }: { mode: BoardMode }) {
  const [flowId, setFlowId] = useState<FlowId>("admin");
  const [revealed, setRevealed] = useState(mode === "demo");
  const flow = FLOWS.find((item) => item.id === flowId) ?? FLOWS[0];
  const showEvidence = mode === "demo" || revealed;

  useEffect(() => {
    setRevealed(mode === "demo");
  }, [mode, flowId]);

  return (
    <section className="w6-board">
      <header className="w6-head">
        <div>
          <span>W6 · Testing / Day 1</span>
          <h2>从覆盖缺口到认证闭环</h2>
          <p>先保护已有契约，再用最小 fixture、分阶段断言和对照测试，证明真实登录 Token 能进入受保护资源。</p>
        </div>
        <strong>3 suites · 9 tests</strong>
      </header>

      <section className="w6-topology" aria-label="测试覆盖拓扑">
        <div className="w6-section-head">
          <span>coverage topology</span>
          <h3>旧覆盖留下登录缺口，新 suite 补链但不重复证明聚合</h3>
        </div>
        <div className="w6-topology-grid">
          {COVERAGE_TOPOLOGY.map((item, index) => (
            <article key={item.label} className={item.tone}>
              <b>{index + 1}</b>
              <span>{item.label}</span>
              <strong>{item.covers}</strong>
              <small>{item.gap}</small>
            </article>
          ))}
        </div>
        <p><strong>覆盖增量</strong> 2 suites / 7 tests <i>+</i> 认证流 1 suite / 2 tests <i>=</i> 3 suites / 9 tests 全绿</p>
      </section>

      <section className="w6-parallel" aria-label="两条认证流并行对照">
        <div className="w6-section-head">
          <span>parallel auth paths</span>
          <h3>相同登录与认证入口，在授权阶段分成 200 / 403</h3>
        </div>
        <div className="w6-parallel-grid">
          {FLOWS.map((item) => (
            <article key={item.id} className={item.tone}>
              <header><span>{item.tab}</span><strong>{item.title}</strong></header>
              <ol>
                {item.steps.map((step, index) => (
                  <li key={step.label}>
                    <b>{index + 1}</b>
                    <span>{step.label}</span>
                    <em>{step.status}</em>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
        <p className="w6-parallel-answer"><strong>不能互相替代：</strong>200 证明 admin 成功穿过授权并到达资源；403 证明有效身份在授权门停止。只保留一条，就会丢掉另一侧分支的回归证据。</p>
      </section>

      <article className="w6-flow-stage">
        <div className="w6-flow-head">
          <div>
            <span>真实认证链</span>
            <h3>{flow.title}</h3>
          </div>
          <div className="w6-flow-toggle" role="tablist" aria-label="认证测试链路">
            {FLOWS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={flowId === item.id ? "on" : ""}
                role="tab"
                aria-selected={flowId === item.id}
                onClick={() => setFlowId(item.id)}
              >
                {item.tab}
              </button>
            ))}
          </div>
        </div>

        {mode === "review" && !revealed ? (
          <div className="w6-recall">
            <span>先口述，再核对</span>
            <h4>这条链的最小输入、三个关键断言和最终状态码分别是什么？</h4>
            <p>再说明最终状态码能证明什么，以及至少两个不能由它推出的结论。</p>
            <button type="button" onClick={() => setRevealed(true)}>展开核对</button>
          </div>
        ) : (
          <>
            <p className="w6-contract">{flow.contract}</p>
            <ol className={`w6-flow ${flow.tone}`}>
              {flow.steps.map((step, index) => (
                <li key={step.label}>
                  <b>{index + 1}</b>
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.detail}</span>
                  </div>
                  <em>{step.status}</em>
                </li>
              ))}
            </ol>

            <div className="w6-evidence-grid">
              <section className="proves">
                <span>这条链能证明</span>
                <ul>{flow.proves.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section className="limits">
                <span>不能从结果直接推出</span>
                <ul>{flow.limits.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            </div>
          </>
        )}
      </article>

      {showEvidence && (
        <details className="w6-matrix">
          <summary>展开证据精度矩阵</summary>
          <div className="w6-matrix-table" role="table" aria-label="测试观察结果的证据边界">
            <div className="w6-matrix-head" role="row">
              <span role="columnheader">测试 / 观察结果</span>
              <span role="columnheader">能证明</span>
              <span role="columnheader">没有证明</span>
            </div>
            {EVIDENCE_MATRIX.map((item) => (
              <div className={`w6-matrix-row ${item.tone}`} role="row" key={item.observation}>
                <strong role="cell">{item.observation}</strong>
                <span role="cell">{item.proves}</span>
                <span role="cell">{item.limits}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {showEvidence && (
        <article className="w6-suite-axis">
          <div className="w6-section-head">
            <span>resource timeline</span>
            <h3>资源按顺序创建、使用、清理和恢复</h3>
          </div>
          <ol>
            {SUITE_TIMELINE.map((item) => (
              <li key={item.phase} className={item.tone}>
                <b>{item.phase}</b>
                <strong>{item.label}</strong>
                <span>{item.owner}</span>
              </li>
            ))}
          </ol>
        </article>
      )}

      {showEvidence && (
        <article className="w6-lifecycle">
          <div className="w6-section-head">
            <span>测试生命周期</span>
            <h3>四类状态，各自拥有明确的创建与清理边界</h3>
          </div>
          <div className="w6-lifecycle-head" aria-hidden="true">
            <span>资源</span><span>beforeAll</span><span>suite 内</span><span>afterAll</span>
          </div>
          <div className="w6-lifecycle-rows">
            {LIFECYCLE.map((item) => (
              <div className="w6-lifecycle-row" key={item.name}>
                <strong>{item.name}</strong>
                <span>{item.start}</span>
                <span>{item.hold}</span>
                <span>{item.end}</span>
              </div>
            ))}
          </div>
          <p>关键不变量：测试环境必须“固定覆盖、正常生命周期内精确恢复”；不能假设测试文件结束就等于 Jest 进程结束。</p>
        </article>
      )}

      {showEvidence && (
        <div className="w6-boundaries">
          <article>
            <span>契约排序</span>
            <strong>已有行为优先</strong>
            <p>登录限流是安全 backlog，但不能替代当前真实 Token 链的回归保护。</p>
          </article>
          <article>
            <span>凭证证据</span>
            <strong>字符串 ≠ 有效 JWT</strong>
            <p>凭证被后续受保护路由接纳，才构成当前系统中的有效性证据。</p>
          </article>
          <article>
            <span>状态码边界</span>
            <strong>403 ≠ 精确角色值</strong>
            <p>共同拒绝分支只能证明非 admin，不能反推数据库里一定是 member。</p>
          </article>
        </div>
      )}

      {mode === "review" && showEvidence && (
        <aside className="w6-review-note">
          <span>下一入口</span>
          <p>对照 CI 的 MongoDB service 与测试中的 MongoMemoryServer，明确唯一数据库来源、隔离方式和完整清理责任。</p>
        </aside>
      )}
    </section>
  );
}
