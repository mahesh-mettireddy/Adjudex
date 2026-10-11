import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api to the Node API (`npm run server`). The Gemini key never
    // reaches the browser: only the server process reads it.
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.js"],
    environmentMatchGlobs: [["server/**", "node"]],
  },
});
