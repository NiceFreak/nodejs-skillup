import AuthBoard from "./AuthBoard";
import { OAuth2FlowPanel } from "./Dashboard";
import W3Board from "./W3Board";
import W5Board from "./W5Board";
import type { BoardMode, ShowcaseTab } from "./types";

// tab / 视角 / 专题都由 App 从 URL hash 提供并回写（刷新保留、可直接链接）。
// 视角开关直接放在展板上（不再藏在管理后台登录页）：当前视角一眼可见、可随手切换，
// 默认「展示」，进入「复习」时给出醒目横幅——演示前不会带着私有开放问题而不自知。
export default function Showcase({
  openAdmin,
  mode,
  onModeChange,
  tab,
  onTabChange,
  topic,
  onTopicChange,
}: {
  openAdmin: () => void;
  mode: BoardMode;
  onModeChange: (m: BoardMode) => void;
  tab: ShowcaseTab;
  onTabChange: (t: ShowcaseTab) => void;
  topic: string | null;
  onTopicChange: (id: string) => void;
}) {
  const review = mode === "review";

  return (
    <div className="showcase">
      <div className="showcase-viewbar">
        <span className="showcase-viewbar-label">学习展板 · 公开可视化复习与 demo</span>
        <div className="board-mode" role="group" aria-label="展板视角 · 仅本人">
          <button
            type="button"
            className={!review ? "on" : ""}
            aria-pressed={!review}
            onClick={() => onModeChange("demo")}
          >
            展示
          </button>
          <button
            type="button"
            className={review ? "on" : ""}
            aria-pressed={review}
            onClick={() => onModeChange("review")}
          >
            复习
          </button>
        </div>
      </div>

      {review && (
        <div className="showcase-review-banner" role="status">
          <div>
            <strong>复习视角</strong>
            <span>正在显示仅本人的开放问题与自我复盘（对外演示前请切回「展示」）。</span>
          </div>
          <button type="button" onClick={() => onModeChange("demo")}>切回展示</button>
        </div>
      )}

      <div className="section-tabs showcase-tabs" role="tablist" aria-label="公开学习展板">
        <button type="button" className={tab === "auth" ? "on" : ""} onClick={() => onTabChange("auth")} role="tab" aria-selected={tab === "auth"}>认证与授权</button>
        <button type="button" className={tab === "oauth2" ? "on" : ""} onClick={() => onTabChange("oauth2")} role="tab" aria-selected={tab === "oauth2"}>OAuth2 流程</button>
        <button type="button" className={tab === "database" ? "on" : ""} onClick={() => onTabChange("database")} role="tab" aria-selected={tab === "database"}>数据库聚合</button>
        <button type="button" className={tab === "runtime" ? "on" : ""} onClick={() => onTabChange("runtime")} role="tab" aria-selected={tab === "runtime"}>Node.js 运行时</button>
      </div>

      {tab === "auth" ? (
        <>
          {/* 认证实验说明只挂在认证 tab 下，切到数据库 / 运行时不再把它顶在最前，语境一致。 */}
          <section className="experiment-guide">
            <div className="experiment-guide-head">
              <div>
                <span>验证方式</span>
                <h2>同一条认证链路，用三种媒介看不同证据</h2>
              </div>
              <button type="button" onClick={openAdmin}>打开管理后台实验</button>
            </div>
            <div className="experiment-methods">
              <article>
                <b>1</b>
                <div>
                  <strong>匿名浏览器 · 走用户旅程</strong>
                  <p>新开匿名窗口进入管理后台，依次注册、登录并观察 member 访问报表时的 403。</p>
                  <span>证明：页面接线、真实 API 串联、token 存储与路由门禁。</span>
                </div>
              </article>
              <article>
                <b>2</b>
                <div>
                  <strong>Postman · 验 HTTP 契约</strong>
                  <p>分别发送正确与错误请求，对照 201 / 400 / 409、统一 401，以及 401 / 403 / 200。</p>
                  <span>证明：状态码、响应体、Bearer header 和失败分支符合契约。</span>
                </div>
              </article>
              <article>
                <b>3</b>
                <div>
                  <strong>代码 + MongoDB · 查内部证据</strong>
                  <p>回看分层调用与数据库文档，确认只保存 passwordHash、JWT 只放 sub、role 来自数据库。</p>
                  <span>证明：职责归属、持久化边界和安全字段没有被 UI 表象掩盖。</span>
                </div>
              </article>
            </div>
            <p className="experiment-rule">
              三种媒介不互相替代：浏览器证明完整体验，Postman 证明协议分支，代码与数据库解释内部原因。
            </p>
          </section>

          <AuthBoard />
        </>
      ) : tab === "oauth2" ? (
        <OAuth2FlowPanel />
      ) : tab === "database" ? (
        <W3Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : (
        <W5Board topic={topic} onTopicChange={onTopicChange} />
      )}
    </div>
  );
}
