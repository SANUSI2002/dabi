import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const preview = mode === "doctor-preview";
  const target = process.env.SABI_DEV_API_TARGET || env.SABI_DEV_API_TARGET;
  return {
    base: "/doctor-portal/",
    envDir: repoRoot,
    plugins: [react()],
    resolve: { alias: { "design-system": fileURLToPath(new URL("./design-system/index.jsx", import.meta.url)) } },
    define: {
      "import.meta.env.VITE_SABI_IDENTITY_API_URL": JSON.stringify(preview ? "" : process.env.VITE_SABI_IDENTITY_API_URL || env.VITE_SABI_IDENTITY_API_URL || env.VITE_API_BASE_URL || "same-origin"),
    },
    server: { ...(target && !preview ? { proxy: { "/api": { target, changeOrigin: true } } } : {}) },
  };
});
