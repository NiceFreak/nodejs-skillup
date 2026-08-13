import React from "react";
import ReactDOM from "react-dom/client";
// showcase 独立入口：showcase.html 与构建期 main.tsx 改写都指向本文件。
// 只挂载展板版 App，管理后台模块树不会进入本入口的依赖图。
import App from "./AppShowcase";
import "./styles.css";

// [TS] 非空断言 !：getElementById 返回 HTMLElement | null，! 告诉编译器「此处一定不为 null」
//（HTML 里 #root 确定存在）。滥用 ! 会把空指针从编译期挪回运行时，仅在确有把握时用。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);