import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "react": fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./node_modules/react-dom", import.meta.url)),
      // Cross-workspace component tests share one router/React context.
      "react-router-dom": fileURLToPath(new URL("./node_modules/react-router-dom", import.meta.url)),
      "lucide-react": fileURLToPath(new URL("./node_modules/lucide-react", import.meta.url)),
      "@daily-co/daily-js": fileURLToPath(new URL("./apps/telemedicine/node_modules/@daily-co/daily-js/dist/daily-esm.js", import.meta.url)),
    },
  },
  test: {
    // Workspace-specific Node/backend tests run in their own commands, not jsdom.
    include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    environment: "jsdom",
    setupFiles: ["./src/testing/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    css: true,
  },
});
