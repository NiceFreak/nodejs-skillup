import { lazy, Suspense } from "react";
import AuthBoard from "./AuthBoard";
import { OAuth2FlowPanel } from "./Dashboard";
import W3Board from "./W3Board";
import W5Board from "./W5Board";
import W6Board from "./W6Board";
import type { BoardMode, ShowcaseTab } from "./types";

const MarkdownNotes = lazy(() => import("./MarkdownNotes"));

// tab / 内容状态 / 专题都由 App 从 URL hash 提供并回写（刷新保留、可直接链接）。
// 展示与复习是内部工具的两种内容状态，不是访问控制：展示状态收起学习记录，
// 复习状态展开开放问题与自我复盘，并用醒目横幅避免内部 demo 时混淆。
export default function Showcase({
  openAdmin,
  mode,
  onModeChange,
  tab,
  onTabChange,
  topic,
  onTopicChange,
}: {
  openAdmin?: () => void;
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
        <span className="showcase-viewbar-label">
          {review ? "复习状态 · 展开个人学习记录" : "展示状态 · 仅显示中性技术内容"}
        </span>
        <div className="board-mode" role="group" aria-label="展板内容状态">
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
            <strong>复习状态</strong>
            <span>每页先给条件与问题，主动判断后再揭示模型、证据和外推边界。</span>
          </div>
          <button type="button" onClick={() => onModeChange("demo")}>切回展示</button>
        </div>
      )}

      <div className="section-tabs showcase-tabs" role="tablist" aria-label="学习展板主题">
        <button type="button" className={tab === "auth" ? "on" : ""} onClick={() => onTabChange("auth")} role="tab" aria-selected={tab === "auth"}>认证与授权</button>
        <button type="button" className={tab === "oauth2" ? "on" : ""} onClick={() => onTabChange("oauth2")} role="tab" aria-selected={tab === "oauth2"}>OAuth2 流程</button>
        <button type="button" className={tab === "database" ? "on" : ""} onClick={() => onTabChange("database")} role="tab" aria-selected={tab === "database"}>数据库聚合</button>
        <button type="button" className={tab === "runtime" ? "on" : ""} onClick={() => onTabChange("runtime")} role="tab" aria-selected={tab === "runtime"}>Node.js 运行时</button>
        <button type="button" className={tab === "testing" ? "on" : ""} onClick={() => onTabChange("testing")} role="tab" aria-selected={tab === "testing"}>测试闭环</button>
        <button type="button" className={tab === "notes" ? "on" : ""} onClick={() => onTabChange("notes")} role="tab" aria-selected={tab === "notes"}>前端笔记</button>
      </div>

      <div className="showcase-context">
        <nav className="learning-sequence" aria-label="W3 到 W6 学习演进">
          <button type="button" className={tab === "database" ? "on" : ""} onClick={() => onTabChange("database")}>
            <span>W3</span><strong>数据查询</strong>
          </button>
          <i aria-hidden="true">→</i>
          <button type="button" className={tab === "auth" || tab === "oauth2" ? "on" : ""} onClick={() => onTabChange("auth")}>
            <span>W4</span><strong>身份边界</strong>
          </button>
          <i aria-hidden="true">→</i>
          <button type="button" className={tab === "runtime" ? "on" : ""} onClick={() => onTabChange("runtime")}>
            <span>W5</span><strong>运行时</strong>
          </button>
          <i aria-hidden="true">→</i>
          <button type="button" className={tab === "testing" ? "on" : ""} onClick={() => onTabChange("testing")}>
            <span>W6</span><strong>测试证据</strong>
          </button>
        </nav>

        <details className="global-viz-legend">
          <summary>关系图例</summary>
          <div>
            <span className="flow">调用 / 数据流</span>
            <span className="resource">资源边界</span>
            <span className="success">成功</span>
            <span className="controlled">受控拒绝 / 暂停</span>
            <span className="failure">异常 / 阻断</span>
            <span className="unknown">未测量 / 不在范围</span>
          </div>
          <p>虚线只表示推断或未验证；异步边界另带文字标签。</p>
        </details>
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
              {openAdmin && <button type="button" onClick={openAdmin}>打开管理后台实验</button>}
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

          <AuthBoard mode={mode} />
        </>
      ) : tab === "oauth2" ? (
        <OAuth2FlowPanel mode={mode} />
      ) : tab === "database" ? (
        <W3Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "runtime" ? (
        <W5Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "testing" ? (
        <W6Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : (
        <Suspense fallback={<p className="notes-loading">正在载入笔记…</p>}>
          <MarkdownNotes mode={mode} topic={topic} onTopicChange={onTopicChange} />
        </Suspense>
      )}
    </div>
  );
}
