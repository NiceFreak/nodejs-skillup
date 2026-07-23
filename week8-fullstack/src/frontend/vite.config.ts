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

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
});
