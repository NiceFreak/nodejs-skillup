import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 最小配置。dev server 端口 5173；后端跨域可在后端加 CORS，或在此加 server.proxy。
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
