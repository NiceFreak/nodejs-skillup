// UI 壳与视图切换 —— 脚手架由 AI 提供。
// 这部分是「界面脚手架」（AGENTS.md 允许）：登录/列表视图的显隐、事件绑定、渲染。
// 真正的业务接线在 api.js 的 TODO 里，由你完成。
import { login, fetchList, token } from "./api.js";

const views = {
  login: document.getElementById("view-login"),
  list: document.getElementById("view-list"),
};
const authState = document.getElementById("auth-state");

function show(name) {
  Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
  const loggedIn = name !== "login";
  authState.textContent = loggedIn ? "已登录" : "未登录";
  authState.classList.toggle("on", loggedIn);
}

async function loadList() {
  const err = document.getElementById("list-error");
  const ul = document.getElementById("list");
  err.textContent = "";
  ul.innerHTML = "";
  try {
    const items = await fetchList();
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = typeof item === "string" ? item : JSON.stringify(item);
      ul.appendChild(li);
    }
    if (items.length === 0) ul.innerHTML = "<li class='muted'>暂无数据</li>";
  } catch (e) {
    err.textContent = e.message;
  }
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("login-error");
  err.textContent = "";
  const { email, password } = Object.fromEntries(new FormData(e.target));
  try {
    const { token: t } = await login(email, password);
    token.set(t);
    show("list");
    loadList();
  } catch (ex) {
    err.textContent = ex.message;
  }
});

document.getElementById("reload-btn").addEventListener("click", loadList);
document.getElementById("logout-btn").addEventListener("click", () => {
  token.clear();
  show("login");
});

// 启动：有 token 直接进列表，否则进登录
show(token.get() ? "list" : "login");
if (token.get()) loadList();
