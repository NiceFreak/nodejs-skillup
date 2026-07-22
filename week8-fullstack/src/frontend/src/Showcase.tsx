import { useState } from "react";
import AuthBoard from "./AuthBoard";
import { OAuth2FlowPanel } from "./Dashboard";
import W3Board from "./W3Board";
import W5Board from "./W5Board";
import type { BoardMode } from "./types";

type ShowcaseTab = "auth" | "oauth2" | "database" | "runtime";

function readMode(): BoardMode {
  return localStorage.getItem("skillup_board_mode") === "review" ? "review" : "demo";
}

export default function Showcase({ openAdmin }: { openAdmin: () => void }) {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("auth");
  // 展示视角：默认展示模式，避免把学习状态外现给外部观众；本人可切复习模式看全量。
  const [mode, setMode] = useState<BoardMode>(readMode);

  function chooseMode(next: BoardMode) {
    localStorage.setItem("skillup_board_mode", next);
    setMode(next);
  }

  return (
    <div className="showcase">
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

      <div className="showcase-tabbar">
        <div className="section-tabs showcase-tabs" role="tablist" aria-label="公开学习展板">
          <button type="button" className={activeTab === "auth" ? "on" : ""} onClick={() => setActiveTab("auth")} role="tab" aria-selected={activeTab === "auth"}>认证与授权</button>
          <button type="button" className={activeTab === "oauth2" ? "on" : ""} onClick={() => setActiveTab("oauth2")} role="tab" aria-selected={activeTab === "oauth2"}>OAuth2 流程</button>
          <button type="button" className={activeTab === "database" ? "on" : ""} onClick={() => setActiveTab("database")} role="tab" aria-selected={activeTab === "database"}>数据库聚合</button>
          <button type="button" className={activeTab === "runtime" ? "on" : ""} onClick={() => setActiveTab("runtime")} role="tab" aria-selected={activeTab === "runtime"}>Node.js 运行时</button>
        </div>
        <div className="board-mode" role="group" aria-label="展示视角">
          <button type="button" className={mode === "demo" ? "on" : ""} aria-pressed={mode === "demo"} onClick={() => chooseMode("demo")}>展示模式</button>
          <button type="button" className={mode === "review" ? "on" : ""} aria-pressed={mode === "review"} onClick={() => chooseMode("review")}>复习模式</button>
        </div>
      </div>

      {activeTab === "auth" ? (
        <AuthBoard mode={mode} />
      ) : activeTab === "oauth2" ? (
        <OAuth2FlowPanel />
      ) : activeTab === "database" ? (
        <W3Board mode={mode} />
      ) : (
        <W5Board mode={mode} />
      )}
    </div>
  );
}
