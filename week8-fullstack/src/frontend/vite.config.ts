import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// 后端跨域用 dev proxy 解决：前端相对路径请求 /auth、/users、/reports，
// 由 Vite 转发到本机后端（week2-express/src，默认 3000 端口），后端无需加 CORS。
// 后端端口不同的话改这里或设 VITE_API_TARGET 环境变量。
const target = process.env.VITE_API_TARGET ?? "http://localhost:3000";
const proxy = {
  "/auth": { target, changeOrigin: true },
  "/reports": { target, changeOrigin: true },
  "/users": { target, changeOrigin: true },
};

// 双入口产物：index.html 是默认入口（两种构建都有，各自 serve 对应版本），
// 另加一个显式命名入口 admin.html / showcase.html 标记产物的身份。
// VITE_SHOWCASE_ONLY=1 时只构建 showcase 相关文件；否则只构建 admin 相关文件。
// 因此 admin 产物里根本没有 showcase.html 与整棵展板模块图；showcase 产物同理。
const SHOWCASE = process.env.VITE_SHOWCASE_ONLY === "1";
const INPUT: Record<string, string> = SHOWCASE
  ? {
      index: fileURLToPath(new URL("./index.html", import.meta.url)),
      showcase: fileURLToPath(new URL("./showcase.html", import.meta.url)),
    }
  : {
      index: fileURLToPath(new URL("./index.html", import.meta.url)),
      admin: fileURLToPath(new URL("./admin.html", import.meta.url)),
    };

// 标题应该由构建期决定，产物本身就是对的，不靠部署脚本事后改写。
const SHOWCASE_TITLE = "Node.js Skillup · 学习展板";
const ADMIN_TITLE = "Skillup 经营报表管理后台";
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
      // index.html 挂载哪个 App 由构建期条件导入决定（见 main.tsx），
      // 这里只做标题与 favicon。
      const out = html.replace(
        /<title>[^<]*<\/title>/,
        `<title>${SHOWCASE ? SHOWCASE_TITLE : ADMIN_TITLE}</title>`,
      );
      return out.replace(
        "</head>",
        `  <link rel="icon" href="${FAVICON}" />\n  </head>`,
      );
    },
  };
}

// 两种构建分目录输出，避免互相覆盖（服务器上两个站点各 serve 一份）：
// - admin 构建（默认）→ dist/，由 8080 的 shop-admin 站点 serve，保持现状不动；
// - showcase 构建（VITE_SHOWCASE_ONLY=1）→ dist-showcase/，由 8081 的复习站 serve。
// 若共用 dist/，后构建的一方会覆盖另一方（admin.html / showcase.html 互删），
// 8080 或 8081 必有一个站点拿到残缺产物。
const OUT_DIR = SHOWCASE ? "dist-showcase" : "dist";

export default defineConfig({
  plugins: [react(), htmlHead()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
  build: {
    outDir: OUT_DIR,
    rollupOptions: {
      input: INPUT,
    },
  },
});
