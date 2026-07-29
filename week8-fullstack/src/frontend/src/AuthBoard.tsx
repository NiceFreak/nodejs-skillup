import { useEffect, useMemo, useState } from "react";
import { AUTH_TOPICS, type AuthTopic } from "./authTopics";
import { FrameNarration, FrameTransport, useFramePlayer } from "./framePlayer";
import { tabKeyDown } from "./tabs";
import type { BoardMode } from "./types";

type AuthPathId = "unauthorized" | "forbidden" | "success";

interface AuthPath {
  id: AuthPathId;
  tab: string;
  condition: string;
  status: "401" | "403" | "200";
  stopAt: number;
  meaning: string;
}

interface AuthChainStep {
  from: number;
  to: number;
  title: string;
  payload: string;
  detail: string;
  startsAtRequest?: boolean;
}

const AUTH_LANES = [
  { label: "客户端", sub: "长期凭据 / Bearer token" },
  { label: "Auth Service", sub: "凭据验证 / JWT 签发" },
  { label: "Repository + DB", sub: "hash / 当前 role" },
  { label: "受保护请求管道", sub: "认证 / 授权 / 资源" },
];

const AUTH_CHAIN: AuthChainStep[] = [
  {
    from: 0,
    to: 1,
    title: "提交登录凭据",
    payload: "POST /auth/login · email + password",
    detail: "长期密码只进入登录链，不进入后续资源请求。",
  },
  {
    from: 1,
    to: 2,
    title: "查询并比较认证材料",
    payload: "findByEmail(+passwordHash) · bcrypt.compare",
    detail: "Repository 提供 hash，Service 作出凭据是否有效的结论。",
  },
  {
    from: 1,
    to: 0,
    title: "签发最小身份凭证",
    payload: "access token · payload = { sub }",
    detail: "JWT 不携带 role；权限继续以数据库当前值为准。",
  },
  {
    from: 0,
    to: 3,
    title: "携带 Bearer token 请求报表",
    payload: "GET /reports/monthly-sales",
    detail: "受保护请求从这里进入认证、授权与资源处理。",
    startsAtRequest: true,
  },
  {
    from: 3,
    to: 3,
    title: "validateToken 恢复主体",
    payload: "verify → req.auth.sub",
    detail: "无 token、签名无效、过期或缺少 sub 都在这里终止为 401。",
    startsAtRequest: true,
  },
  {
    from: 3,
    to: 2,
    title: "requireRole 查询当前角色",
    payload: "findUserRoleById(sub)",
    detail: "身份有效但角色不是 admin 时终止为 403；数据库异常不能伪装成拒绝。",
    startsAtRequest: true,
  },
  {
    from: 3,
    to: 3,
    title: "Controller 处理报表",
    payload: "admin → next() → 200",
    detail: "只有认证与授权都通过，请求才会进入参数校验和报表资源。",
    startsAtRequest: true,
  },
];

const AUTH_PATHS: AuthPath[] = [
  {
    id: "unauthorized",
    tab: "无效身份 · 401",
    condition: "无 token / token 无效",
    status: "401",
    stopAt: 4,
    meaning: "认证层无法确认“你是谁”，不进入角色查询。",
  },
  {
    id: "forbidden",
    tab: "member · 403",
    condition: "有效 token + 非 admin",
    status: "403",
    stopAt: 5,
    meaning: "身份已经确认，但数据库当前角色不满足路由要求。",
  },
  {
    id: "success",
    tab: "admin · 200",
    condition: "有效 token + admin",
    status: "200",
    stopAt: 6,
    meaning: "认证与授权通过，资源 Controller 才开始处理报表。",
  },
];

const AUTH_PATH_TAB_IDS = AUTH_PATHS.map((item) => `auth-path-tab-${item.id}`);
const AUTH_REQUEST_START = AUTH_CHAIN.findIndex((item) => item.startsAtRequest);

// 一条路径实际经过的链路步骤下标。401 从受保护请求开始（不含登录段），
// 403 / 200 从登录开始，各自停在自己的 stopAt。
function authPathFrames(path: AuthPath): number[] {
  return AUTH_CHAIN.map((_, index) => index).filter(
    (index) => index <= path.stopAt && (path.id !== "unauthorized" || index >= AUTH_REQUEST_START),
  );
}

export default function AuthBoard({ mode }: { mode: BoardMode }) {
  const [activeId, setActiveId] = useState(AUTH_TOPICS[0].id);
  const [step, setStep] = useState(0);
  const [pathId, setPathId] = useState<AuthPathId>("success");
  const [revealed, setRevealed] = useState(mode === "demo");
  const active = AUTH_TOPICS.find((topic) => topic.id === activeId) ?? AUTH_TOPICS[0];
  const current = active.steps[Math.min(step, active.steps.length - 1)];
  const path = AUTH_PATHS.find((item) => item.id === pathId) ?? AUTH_PATHS[2];

  // 端到端链路的逐帧推进。默认不自动播放：这是代表页，用户通常先读再走。
  const chainFrames = useMemo(() => authPathFrames(path), [path]);
  const chainPlayer = useFramePlayer(chainFrames.length, { interval: 1500, autoPlay: false });
  const chainIndex = chainFrames[Math.min(chainPlayer.index, chainFrames.length - 1)];
  const chainStep = AUTH_CHAIN[chainIndex];
  const atStop = chainIndex === path.stopAt;

  useEffect(() => {
    setRevealed(mode === "demo");
  }, [mode, pathId]);

  function selectPath(id: AuthPathId) {
    setPathId(id);
    chainPlayer.seek(0);
  }

  function selectTopic(topic: AuthTopic) {
    setActiveId(topic.id);
    setStep(0);
  }

  return (
    <div className="authk-board">
      <header className="authk-head">
        <div>
          <span>可视化说明</span>
          <h2>认证与授权边界</h2>
          <p>注册、登录、JWT 与最小 RBAC 的分层与凭据边界说明。</p>
        </div>
        <b>{AUTH_TOPICS.length} 个专题</b>
      </header>

      <section className="auth-master" aria-label="登录到受保护报表的端到端认证链">
        <div className="auth-master-head">
          <div>
            <span>端到端总览</span>
            <h3>登录凭据如何变成一次受保护请求</h3>
            <p>同一张图分开显示调用顺序、职责归属，以及 401 / 403 / 200 在哪里分叉。</p>
          </div>
          <div
            className="auth-path-toggle"
            role="tablist"
            aria-label="认证与授权结果路径"
            onKeyDown={tabKeyDown(
              AUTH_PATH_TAB_IDS,
              AUTH_PATHS.findIndex((item) => item.id === path.id),
              (index) => selectPath(AUTH_PATHS[index].id),
            )}
          >
            {AUTH_PATHS.map((item) => {
              const selected = path.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`auth-path-tab-${item.id}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls="auth-path-panel"
                  tabIndex={selected ? 0 : -1}
                  className={`${item.id}${selected ? " on" : ""}`}
                  onClick={() => selectPath(item.id)}
                >
                  {item.tab}
                </button>
              );
            })}
          </div>
        </div>

        <div id="auth-path-panel" role="tabpanel" aria-labelledby={`auth-path-tab-${path.id}`}>
        {mode === "review" && !revealed ? (
          <div className="auth-master-recall">
            <span>先口述，再核对</span>
            <h4>这条路径会经过哪两道门，在哪一层停止？</h4>
            <p>请先说明长期密码、JWT、<code>sub</code> 与数据库 <code>role</code> 各自在哪一段出现。</p>
            <button type="button" onClick={() => setRevealed(true)}>显示职责与分支</button>
          </div>
        ) : (
          <>
            <div className="auth-master-transport">
              <span className="auth-master-transport-label">
                第 {chainIndex + 1} 段 · {chainStep.title}
              </span>
              <FrameTransport player={chainPlayer} length={chainFrames.length} />
            </div>

            {/* 当前这一段消息的收发双方高亮：参与者不再只是一排静态表头。 */}
            <div className="auth-master-lanes" aria-label="参与者与职责">
              {AUTH_LANES.map((lane, index) => {
                const involved = index === chainStep.from || index === chainStep.to;
                return (
                  <div key={lane.label} className={involved ? "active" : ""}>
                    <strong>{lane.label}</strong>
                    <span>{lane.sub}</span>
                  </div>
                );
              })}
            </div>
            <div className="mobile-scroll-cue auth-lane-cue" aria-hidden="true">
              {AUTH_LANES.map((lane, index) => (
                <span key={lane.label}>{index + 1}<small>{lane.label}</small></span>
              ))}
            </div>

            <ol className={`auth-master-sequence path-${path.id}`}>
              {AUTH_CHAIN.map((item, index) => {
                const inSelectedPath = chainFrames.includes(index);
                // 已走过 / 当前 / 本路径还没走到 / 不属于本路径，四种状态分开。
                // 之前只有「属于路径」和「不属于路径」两种，走到哪一步是看不出来的。
                const state = !inSelectedPath
                  ? "context"
                  : index < chainIndex
                    ? "done"
                    : index === chainIndex
                      ? "on"
                      : "upcoming";
                return (
                  <li key={item.title} className={state}>
                    <b>{state === "done" ? "✓" : index + 1}</b>
                    <div className="auth-master-message">
                      <span>{AUTH_LANES[item.from].label}</span>
                      <i className={item.from > item.to ? "reverse" : ""} aria-hidden="true" />
                      <span>{AUTH_LANES[item.to].label}</span>
                    </div>
                    <div className="auth-master-copy">
                      <strong>{item.title}</strong>
                      <code>{item.payload}</code>
                      <small>{item.detail}</small>
                    </div>
                    {index === path.stopAt && atStop && (
                      <em className={`auth-master-status status-${path.status}`}>{path.status}</em>
                    )}
                  </li>
                );
              })}
            </ol>

            <FrameNarration
              step={chainIndex + 1}
              text={
                atStop
                  ? `${chainStep.title} —— 这条路径在这里停止，返回 ${path.status}。${path.meaning}`
                  : `${chainStep.title}：${chainStep.detail}`
              }
              tone={atStop ? `status-${path.status}` : undefined}
            />

            {/* 状态码是走到停止点之后的结论，不是一开始就摆在那里的标签。 */}
            <div className={`auth-master-outcome status-${path.status}${atStop ? " reached" : " pending"}`}>
              <span>{path.condition}</span>
              <strong>{atStop ? path.status : "…"}</strong>
              <p>{atStop ? path.meaning : `继续推进链路，看这条路径停在哪一层。`}</p>
            </div>

          </>
        )}
        </div>
      </section>

      {(mode === "demo" || revealed) && <nav className="authk-nav" aria-label="认证知识点">
        {AUTH_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className={topic.id === active.id ? "on" : ""}
            onClick={() => selectTopic(topic)}
          >
            <span>{topic.label}</span>
            <strong>{topic.title}</strong>
          </button>
        ))}
      </nav>}

      {(mode === "demo" || revealed) && <article className="authk-stage">
        <div className="authk-title-row">
          <div>
            <span>{active.label}</span>
            <h3>{active.title}</h3>
          </div>
          <p>{active.question}</p>
        </div>

        <section className="authk-actors" aria-label="流程参与层">
          {active.actors.map((actor) => {
            const highlighted = actor.key === current.from || actor.key === current.to;
            return (
              <div key={actor.key} className={highlighted ? "active" : ""}>
                <strong>{actor.label}</strong>
                <span>{actor.responsibility}</span>
              </div>
            );
          })}
        </section>

        <section className={`authk-player ${current.tone}`}>
          <div className="authk-player-head">
            <div>
              <span>步骤 {step + 1}</span>
              <strong>{current.title}</strong>
            </div>
            <div className="authk-controls">
              <button type="button" className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
                上一步
              </button>
              <span>{step + 1} / {active.steps.length}</span>
              <button
                type="button"
                disabled={step === active.steps.length - 1}
                onClick={() => setStep(step + 1)}
              >
                下一步
              </button>
            </div>
          </div>

          <div className="authk-arrow">
            <span>{actorShort(active, current.from)}</span>
            <div>
              <code>{current.carries}</code>
            </div>
            <span>{actorShort(active, current.to)}</span>
          </div>
          <p>{current.note}</p>

          <div className="authk-legend" aria-hidden="true">
            <span className="warn">敏感凭据流动</span>
            <span className="safe">安全边界收敛</span>
            <span className="neutral">常规处理</span>
          </div>
          <ol className="authk-steps" aria-label="全流程一览">
            {active.steps.map((item, index) => (
              <li key={item.title}>
                <button
                  type="button"
                  className={`authk-step-item ${item.tone}${index === step ? " on" : ""}${index < step ? " done" : ""}`}
                  onClick={() => setStep(index)}
                  aria-current={index === step ? "step" : undefined}
                >
                  <span className="authk-step-idx">{index < step ? "✓" : index + 1}</span>
                  <span className="authk-step-main">
                    <strong>{item.title}</strong>
                    <span className="authk-step-route">
                      {actorShort(active, item.from)} → {actorShort(active, item.to)} · <code>{item.carries}</code>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="authk-artifacts" aria-label="数据与凭据边界">
          {active.artifacts.map((artifact) => (
            <div key={artifact.key} className={current.activates.includes(artifact.key) ? "active" : ""}>
              <code>{artifact.label}</code>
              <span>{artifact.boundary}</span>
            </div>
          ))}
        </section>

        {active.outcomes && (
          <section className="authk-outcomes" aria-label="真实结果对照">
            {active.outcomes.map((outcome) => (
              <div key={outcome.condition} className={outcome.tone}>
                <span>{outcome.condition}</span>
                <strong>{outcome.result}</strong>
                <p>{outcome.meaning}</p>
              </div>
            ))}
          </section>
        )}

        <footer className="authk-conclusion">
          <div>
            <span>核心判断</span>
            <strong>{active.judgment}</strong>
          </div>
          <div>
            <span>映射回业务</span>
            <p>{active.mapping}</p>
          </div>
          <details>
            <summary>查看验收证据与笔记来源</summary>
            <ul>
              {active.evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <small>主要来源：{active.source}</small>
          </details>
        </footer>
      </article>}
    </div>
  );
}

function actorShort(topic: AuthTopic, key: string) {
  return topic.actors.find((actor) => actor.key === key)?.short ?? key;
}
