import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const { SABI_DEV_API_TARGET } = loadEnv(mode, process.cwd(), "SABI_DEV_");
  return {
    plugins: [react()],
    server: SABI_DEV_API_TARGET
      ? { proxy: { "/api": { target: SABI_DEV_API_TARGET, changeOrigin: true } } }
      : undefined,
  };
});
