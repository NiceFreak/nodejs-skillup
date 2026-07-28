import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 后端跨域用 dev proxy 解决：前端相对路径请求 /auth、/users、/reports，
// 由 Vite 转发到本机后端（week2-express/src，默认 3000 端口），后端无需加 CORS。
// 后端端口不同的话改这里或设 VITE_API_TARGET 环境变量。
const target = process.env.VITE_API_TARGET ?? "http://localhost:3000";
const proxy = {
  "/auth": { target, changeOrigin: true },
  "/reports": { target, changeOrigin: true },
  "/users": { target, changeOrigin: true },
};

// 展板与管理后台是同一份源码的两种构建，标题也应该由构建期决定。
// 之前 dist/index.html 的标题靠 deploy skill 事后用 perl 改写，产物本身是错的；
// 这里让 VITE_SHOWCASE_ONLY 直接决定标题，同时内联一个 favicon（否则每次加载都 404）。
const SHOWCASE_TITLE = "Node.js Skillup · 学习展板";
const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" rx="7" fill="#1c5cab"/>' +
      '<path d="M9 21V11h2.6l4.8 6.4V11H19v10h-2.6l-4.8-6.4V21z" fill="#fff"/>' +
      "</svg>",
  );

function htmlHead() {
  return {
    name: "skillup-html-head",
    transformIndexHtml(html: string) {
      const out = process.env.VITE_SHOWCASE_ONLY === "1"
        ? html.replace(/<title>[^<]*<\/title>/, `<title>${SHOWCASE_TITLE}</title>`)
        : html;
      return out.replace(
        "</head>",
        `  <link rel="icon" href="${FAVICON}" />\n  </head>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), htmlHead()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
});
