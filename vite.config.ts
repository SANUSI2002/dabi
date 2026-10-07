import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { sabiPwaOptions } from "./apps/telemedicine/packages/shared-portal/pwa/pwaOptions.ts";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

// Each deployment installs as its own app (set by scripts/build-vercel.mjs).
const INSTALLED_APP = {
  health: { name: "Sabi Health", shortName: "Sabi Health", description: "Sabi Health: connected digital healthcare for organizations and patients." },
  emr: { name: "Sabi EMR", shortName: "Sabi EMR", description: "The Sabi Health hospital workspace for patient records and clinical care." },
  pharmacy: { name: "Sabi Pharmacy", shortName: "Sabi Pharmacy", description: "The Sabi Health pharmacy workspace." },
  "command-center": { name: "Sabi Command Center", shortName: "Command Center", description: "Sabi Health operations and platform administration." },
} as const;
type InstalledSurface = keyof typeof INSTALLED_APP;
const surface = process.env.VITE_DEPLOYMENT_SURFACE ?? "";
const installedApp = INSTALLED_APP[(surface in INSTALLED_APP ? surface : "health") as InstalledSurface];

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { SABI_DEV_API_TARGET } = loadEnv(mode, process.cwd(), "SABI_DEV_");
  return {
    plugins: [
      react(),
      VitePWA(sabiPwaOptions({
        cacheId: "main",
        ...installedApp,
        themeColor: "#061d15",
        backgroundColor: "#061d15",
        // The health deployment also hosts the patient and professional portals.
        nestedApps: [/^\/(?:telemedicine|doctor-portal)(?:\/|$)/],
      })),
    ],
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
