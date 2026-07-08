import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  base: "/admin/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/": {
        target: "http://localhost:3000",
        changeOrigin: true,
        bypass: (req) => {
          const url = req.url || "";
          if (
            url.startsWith("/admin") ||
            url.startsWith("/src") ||
            url.startsWith("/node_modules") ||
            url.startsWith("/@vite") ||
            url.startsWith("/@id") ||
            url.startsWith("/@fs") ||
            url.includes("hot-update") ||
            url.startsWith("/favicon.ico")
          ) {
            return url;
          }
          return null;
        }
      }
    },
  },
});
