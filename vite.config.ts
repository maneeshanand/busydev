import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

const host = process.env.TAURI_DEV_HOST;
const buildNumber = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    __APP_BUILD__: JSON.stringify(buildNumber),
  },
  server: {
    host: host || false,
    port: 1423,
    strictPort: true,
    hmr: host ? { protocol: "ws", host, port: 1424 } : undefined,
    watch: { ignored: ["**/src-tauri/**", "**/.worktrees/**"] },
  },
});
