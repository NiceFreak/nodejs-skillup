// OAuth2 授权码流程 · 时序播放。
// 独立于 Dashboard：这是零后端的展板内容，而 Dashboard 是需要 API 的管理后台。
// 两者同处一个模块时，Showcase 的 import 会把 charts / api / 报表视图一起拖进
// SHOWCASE_ONLY 构建，让「展板无后端依赖」变成只能靠 grep 维持的约定。
import { useEffect, useState } from "react";
import { FrameNarration, FrameTransport, useFramePlayer } from "./framePlayer";
import type { BoardMode } from "./types";

// ---- OAuth2 授权码流程 · 时序播放（展示资产：把纯文字流程改成一步步的可视时序） ----

type OAuthLane = "browser" | "backend" | "third";
type OAuthChannel = "front" | "back" | "session";
type CredKey = "state" | "code" | "secret" | "provToken" | "jwt";

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
    creds: ["state"],
    note: "后端生成并保存不可预测的 state，再拼出授权 URL；浏览器只负责跳转。state 不是密钥，但必须在 callback 比对。",
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
    title: "callback 校验 state 并收 code",
    carries: "state + 一次性 code",
    channel: "front",
    creds: ["state", "code"],
    note: "第三方经浏览器重定向回 callback。后端先比较返回的 state；不匹配立即终止，匹配后才接收短命的一次性 code。",
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
    channel: "session",
    creds: ["jwt"],
    note: "后端按 provider + providerUserId 建/绑本地用户，再通过第一方响应交付本系统 JWT。这不是 OAuth 后信道；之后权限仍走本地 RBAC。",
  },
];

const OAUTH_CREDS: { key: CredKey; label: string; boundary: string }[] = [
  { key: "state", label: "state", boundary: "服务端生成并保存 · 浏览器往返 · callback 必须比对" },
  { key: "code", label: "code", boundary: "一次性换票 · 过浏览器 · 短命" },
  { key: "secret", label: "client_secret", boundary: "只在后端 · 绝不进浏览器" },
  { key: "provToken", label: "第三方 access token", boundary: "后端持有 · 访问第三方 · ≠ 本系统 token" },
  { key: "jwt", label: "本系统 JWT", boundary: "我们签发 · 权限走本地 RBAC" },
];

function laneShort(key: OAuthLane): string {
  return OAUTH_LANES.find((l) => l.key === key)?.short ?? key;
}

const OAUTH_CHANNEL_LABEL: Record<OAuthChannel, string> = {
  front: "前信道 · 经过浏览器",
  back: "后信道 · 后端直连第三方",
  session: "第一方响应 · 交付本系统会话",
};

export function OAuth2FlowPanel({ mode }: { mode: BoardMode }) {
  // 授权码流程是一条固定时序，和 W5 数据流组同构：统一用逐帧播放器驱动，
  // 补上原来缺的播放 / 暂停 / 重放，并遵守 reduced-motion。
  const player = useFramePlayer(OAUTH_STEPS.length, { interval: 1800, autoPlay: false });
  const step = player.index;
  const [revealed, setRevealed] = useState(mode === "demo");
  const cur = OAUTH_STEPS[step];

  useEffect(() => {
    setRevealed(mode === "demo");
  }, [mode, step]);

  function selectStep(next: number) {
    player.seek(next);
    setRevealed(mode === "demo");
  }

  return (
    <div className="oauth-flow">
      <section className="chart-card">
        <div className="chart-card-head">
          <div>
            <h3>授权码流程 · 时序播放</h3>
            <p className="muted">一步步看前信道、OAuth 后信道，以及完成授权后如何交付本系统会话。</p>
          </div>
          <FrameTransport player={player} length={OAUTH_STEPS.length} />
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

        {mode === "review" && !revealed ? (
          <div className="oauth-recall">
            <span>步骤 {step + 1} · {laneShort(cur.from)} → {laneShort(cur.to)}</span>
            <h4>先判断这一步走哪种信道，携带什么，以及哪个凭据边界最重要。</h4>
            <p>特别检查：是否经过浏览器、<code>state</code> 何时比较、<code>client_secret</code> 能否离开后端，以及 OAuth 完成后本地权限从哪里取得。</p>
            <button type="button" onClick={() => setRevealed(true)}>揭示当前消息与凭据</button>
          </div>
        ) : (
          <>
            <div className={`oauth-stage ${cur.channel}`}>
              <div className="oauth-stage-head">
                <span className="oauth-step-no">{step + 1}</span>
                <strong>{cur.title}</strong>
                <span className={`oauth-chan ${cur.channel}`}>
                  {OAUTH_CHANNEL_LABEL[cur.channel]}
                </span>
              </div>
              <div className="oauth-arrow">
                <span className="oauth-endpoint">{laneShort(cur.from)}</span>
                <span className="oauth-line">
                  <span className="oauth-payload">{cur.carries}</span>
                </span>
                <span className="oauth-endpoint">{laneShort(cur.to)}</span>
              </div>
              <FrameNarration
                step={step + 1}
                text={cur.note}
                tone={`oauth-note ${cur.channel}`}
              />
            </div>

            <div className="oauth-legend" aria-hidden="true">
              <span className="front">前信道 · 过浏览器</span>
              <span className="back">后信道 · 后端直连第三方</span>
              <span className="session">第一方响应 · 本系统会话</span>
            </div>
            <ol className="oauth-steps" aria-label="授权码流程 · 全流程一览">
              {OAUTH_STEPS.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`oauth-step-item ${s.channel}${i === step ? " on" : ""}${i < step ? " done" : ""}`}
                    onClick={() => selectStep(i)}
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span className="oauth-step-idx">{i < step ? "✓" : i + 1}</span>
                    <span className="oauth-step-main">
                      <strong>{s.title}</strong>
                      <span className="oauth-step-route">
                        {laneShort(s.from)} → {laneShort(s.to)} · <code>{s.carries}</code>
                      </span>
                    </span>
                    <span className={`oauth-step-chan ${s.channel}`}>
                      {s.channel === "front" ? "前信道" : s.channel === "back" ? "后信道" : "第一方响应"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {(mode === "demo" || revealed) && <section className="oauth-creds">
        {OAUTH_CREDS.map((c) => {
          const active = cur.creds.includes(c.key);
          return (
            <div key={c.key} className={`oauth-cred${active ? " active" : ""}`}>
              <code>{c.label}</code>
              <span>{c.boundary}</span>
            </div>
          );
        })}
      </section>}
    </div>
  );
}
