import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
