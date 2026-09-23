import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { SABI_DEV_API_TARGET } = loadEnv(mode, process.cwd(), "SABI_DEV_");
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      ...(SABI_DEV_API_TARGET ? { proxy: { "/api": { target: SABI_DEV_API_TARGET, changeOrigin: true } } } : {}),
      hmr: {
        host: "127.0.0.1",
        port: 5173,
        protocol: "ws",
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
