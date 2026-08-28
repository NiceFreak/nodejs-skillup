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
    from: "backend",
    to: "browser",
    title: "后端生成 state 并建立关联",
    carries: "302 Location · authorization URL + state",
    channel: "front",
    creds: ["state"],
    note: "流程模型要求后端先生成不可预测的 state，将它与当前授权请求关联，再通过授权 URL 交给浏览器。本仓库未选定具体的服务端保存机制。",
  },
  {
    from: "browser",
    to: "third",
    title: "跳转授权页",
    carries: "client_id · redirect_uri · state",
    channel: "front",
    creds: ["state"],
    note: "浏览器只携带后端已关联的 state 跳转到第三方授权端点。state 不是密钥，但必须在 callback 与原请求比对。",
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

        <aside className="oauth-evidence-grade" role="note">
          <strong>证据等级：流程模型</strong>
          <span>本仓库未接入真实 OAuth provider；本页只验收渠道、凭据去向与职责边界，不证明真实回调、provider 兼容性或攻击防护已运行。</span>
        </aside>

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
              <FrameNarration
                step={step + 1}
                text={cur.note}
                tone={`oauth-note ${cur.channel}`}
              />
            </div>

            {/* 三泳道序列图：七段消息全部画成跨列箭头，起点列是发出方、终点列是接收方。
                前信道与后信道原来只由颜色和文字标签区分，颜色不能单独承载信息；
                改成序列图之后有了第二编码——**箭头有没有触到浏览器列**：
                触到的是前信道（消息经过浏览器），只在后端与第三方之间的是后信道。
                client_secret 那一步因此看得出来它压根没碰浏览器列。 */}
            <p className="oauth-seq-rule">
              <b>怎么读</b>
              箭头触到「浏览器」列 = 前信道，消息经过浏览器；只连「后端」与「第三方」两列 =
              后信道，浏览器全程不参与。点任意一行可跳到那一步。
            </p>
            <ol
              className="oauth-seq"
              data-anchor="oauth-channel-boundary"
              aria-label="授权码流程 · 七段消息的时序"
            >
              {OAUTH_STEPS.map((s, i) => {
                const fromIdx = OAUTH_LANES.findIndex((l) => l.key === s.from);
                const toIdx = OAUTH_LANES.findIndex((l) => l.key === s.to);
                const left = Math.min(fromIdx, toIdx);
                const right = Math.max(fromIdx, toIdx);
                const touchesBrowser = left === 0;
                return (
                  <li key={i} className={`${s.channel}${i === step ? " on" : ""}${i < step ? " done" : ""}`}>
                    <button
                      type="button"
                      className="oauth-seq-row"
                      onClick={() => selectStep(i)}
                      aria-current={i === step ? "step" : undefined}
                    >
                      <span className="oauth-seq-grid" aria-hidden="true">
                        {OAUTH_LANES.map((lane, laneIndex) => (
                          <i
                            key={lane.key}
                            className={`oauth-seq-life${laneIndex === fromIdx || laneIndex === toIdx ? " active" : ""}`}
                          />
                        ))}
                        <span
                          className={`oauth-seq-arrow ${s.channel}${fromIdx > toIdx ? " reverse" : ""}`}
                          style={{ gridColumn: `${left + 1} / ${right + 2}` }}
                        >
                          <b>{i < step ? "✓" : i + 1}</b>
                          <code>{s.carries}</code>
                        </span>
                      </span>
                      <span className="oauth-seq-copy">
                        <strong>{s.title}</strong>
                        <span className="oauth-seq-route">
                          {laneShort(s.from)} → {laneShort(s.to)}
                          {"："}
                          {s.carries}
                        </span>
                      </span>
                      <span className={`oauth-step-chan ${s.channel}`}>
                        {s.channel === "front" ? "前信道" : s.channel === "back" ? "后信道" : "第一方响应"}
                        <em>{touchesBrowser ? "触到浏览器列" : "不碰浏览器列"}</em>
                      </span>
                    </button>
                  </li>
                );
              })}
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
