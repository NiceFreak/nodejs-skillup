import { lazy, Suspense } from "react";
import AuthBoard from "./AuthBoard";
import { OAuth2FlowPanel } from "./OAuth2Panel";
import W2Board from "./W2Board";
import W3Board from "./W3Board";
import W5Board from "./W5Board";
import W6Board from "./W6Board";
import W9Board from "./W9Board";
import W10Board from "./W10Board";
import RunbookBoard from "./RunbookBoard";
import W11Board from "./W11Board";
import InterviewBoard from "./InterviewBoard";
import { tabKeyDown } from "./tabs";
import type { BoardMode, ShowcaseTab } from "./types";

const MarkdownNotes = lazy(() => import("./MarkdownNotes"));

// reviewOnly 的 tab 只在复习状态出现：面试准备是个人材料；部署上线板会把一台在跑的
// 服务器的拓扑、端口与排障判据聚在一页——两者都不进对外 demo。
// 这条不变式的另一半（深链与切回展示状态）在 App.tsx 的 parseHash / changeMode 里。
const TABS: Array<{ id: ShowcaseTab; label: string; reviewOnly?: boolean }> = [
  { id: "auth", label: "认证与授权" },
  { id: "oauth2", label: "OAuth2 流程" },
  { id: "architecture", label: "服务端架构" },
  { id: "database", label: "数据库聚合" },
  { id: "runtime", label: "Node.js 运行时" },
  { id: "testing", label: "测试闭环" },
  { id: "deploy", label: "部署上线", reviewOnly: true },
  { id: "observability", label: "可观测性", reviewOnly: true },
  // 排障手册：操作手册形态，展示状态也可见（真实地址在展示状态以占位符显示）。
  { id: "runbook", label: "排障手册" },
  { id: "release", label: "发布流水线", reviewOnly: true },
  { id: "interview", label: "面试准备", reviewOnly: true },
  { id: "notes", label: "学习笔记" },
];

const tabDomId = (id: ShowcaseTab) => `showcase-tab-${id}`;
const panelDomId = (id: ShowcaseTab) => `showcase-panel-${id}`;


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
  // 方向键与 roving tabindex 都基于「当前可见」的 tab 列表，否则会跳到渲染不出来的项上。
  const visibleTabs = TABS.filter((item) => review || !item.reviewOnly);
  const tabDomIds = visibleTabs.map((item) => tabDomId(item.id));

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

      <div
        className="section-tabs showcase-tabs"
        role="tablist"
        aria-label="学习展板主题"
        onKeyDown={tabKeyDown(
          tabDomIds,
          visibleTabs.findIndex((item) => item.id === tab),
          (index) => onTabChange(visibleTabs[index].id),
        )}
      >
        {visibleTabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              id={tabDomId(item.id)}
              role="tab"
              aria-selected={selected}
              aria-controls={panelDomId(item.id)}
              // roving tabindex：Tab 键进出 tablist 一次，组内用方向键移动。
              tabIndex={selected ? 0 : -1}
              className={selected ? "on" : ""}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="showcase-context">
        <nav className="learning-sequence" aria-label="W1 到 W6 学习演进">
          <button type="button" className={tab === "architecture" ? "on" : ""} onClick={() => onTabChange("architecture")}>
            <span>W1–W2</span><strong>服务端架构</strong>
          </button>
          <i aria-hidden="true">→</i>
          <button type="button" className={tab === "database" ? "on" : ""} onClick={() => onTabChange("database")}>
            <span>W1·W3</span><strong>数据与查询</strong>
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
          {/* W9 与终点节点都只属于复习状态，因此展示状态下整条演进就停在 W6。
              终点节点不标周次：前面几段是「学会了什么」，它是「能不能讲出口」。 */}
          {review && (
            <>
              <i aria-hidden="true">→</i>
              <button type="button" className={tab === "deploy" ? "on" : ""} onClick={() => onTabChange("deploy")}>
                <span>W9</span><strong>上线运行</strong>
              </button>
              <i aria-hidden="true">→</i>
              <button type="button" className={tab === "observability" ? "on" : ""} onClick={() => onTabChange("observability")}>
                <span>W10</span><strong>看得见</strong>
              </button>
              <i aria-hidden="true">→</i>
              <button type="button" className={tab === "release" ? "on" : ""} onClick={() => onTabChange("release")}>
                <span>W11</span><strong>交给机器</strong>
              </button>
              <i aria-hidden="true">→</i>
              <button
                type="button"
                className={`terminal${tab === "interview" ? " on" : ""}`}
                onClick={() => onTabChange("interview")}
              >
                <span>产出</span><strong>讲得出口</strong>
              </button>
            </>
          )}
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

      {/* tabpanel 与 tab 双向关联：读屏切到某个 tab 时能直接跳进对应面板。 */}
      <div className="showcase-panel" id={panelDomId(tab)} role="tabpanel" aria-labelledby={tabDomId(tab)}>
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
      ) : tab === "architecture" ? (
        <W2Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "database" ? (
        <W3Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "runtime" ? (
        <W5Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "testing" ? (
        <W6Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "deploy" ? (
        <W9Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "observability" ? (
        <W10Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "runbook" ? (
        <RunbookBoard mode={mode} />
      ) : tab === "release" ? (
        <W11Board mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : tab === "interview" ? (
        <InterviewBoard mode={mode} topic={topic} onTopicChange={onTopicChange} />
      ) : (
        <Suspense fallback={<p className="notes-loading">正在载入笔记…</p>}>
          <MarkdownNotes mode={mode} topic={topic} onTopicChange={onTopicChange} />
        </Suspense>
      )}
      </div>
    </div>
  );
}
