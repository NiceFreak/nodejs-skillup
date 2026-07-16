import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// [TS] 非空断言 !：getElementById 返回 HTMLElement | null，! 告诉编译器「此处一定不为 null」
//（index.html 里 #root 确定存在）。滥用 ! 会把空指针从编译期挪回运行时，仅在确有把握时用。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
