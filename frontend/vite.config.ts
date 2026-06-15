import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@/assets": "/src/assets",
        "@/components": "/src/components",
        "@/config": "/src/config",
        "@/lib": "/src/lib",
        "@/pages": "/src/pages",
      },
    },
    server: {
      proxy: {
        "/api": env.VITE_API_PROXY_TARGET || "http://localhost:3000",
      },
    },
  };
});
