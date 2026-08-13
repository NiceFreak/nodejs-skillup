// 默认入口（index.html）：由构建期 VITE_SHOWCASE_ONLY 决策挂载哪个 App。
// 双入口拆分后，命名入口 showcase.html / admin.html 各自走 main-showcase.tsx / main-admin.tsx；
// index.html 是两种构建共有的默认 URL（部署根路径），这里用 Vite 官方的条件导入模式：
// 构建时 VITE_SHOWCASE_ONLY 被替换为字面量（undefined / "1"），`=== "1"` 成为编译期常量，
// 未选中的 import() 分支会被 Rollup 作为 dead code 从产物中移除——
// admin 构建的 index.html 产物因此只含管理后台树，不含展示树。
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const loadApp =
  import.meta.env.VITE_SHOWCASE_ONLY === "1"
    ? () => import("./AppShowcase")
    : () => import("./AppAdmin");

// [TS] 非空断言 !：getElementById 返回 HTMLElement | null，! 告诉编译器「此处一定不为 null」
//（index.html 里 #root 确定存在）。滥用 ! 会把空指针从编译期挪回运行时，仅在确有把握时用。
loadApp().then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});