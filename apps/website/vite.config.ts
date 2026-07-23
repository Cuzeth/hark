import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_URL = process.env.API_PROXY_TARGET ?? "http://localhost:8788";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist/client",
  },
  server: {
    port: 8787,
    strictPort: true,
    proxy: {
      "/api": API_URL,
      "/hooks": API_URL,
    },
  },
});
