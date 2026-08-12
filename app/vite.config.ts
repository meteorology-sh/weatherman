// Vite
import { defineConfig } from "vitest/config";

// Meta
import path from "path";
import dotenv from "dotenv";

// Plugins
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Environment
dotenv.config();

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: {
      host: "localhost",
      port: 5173,
    },
    cors: true,
    proxy: {
      "/forecast": {
        target: process.env.SERVER_ORIGIN || "http://localhost:3000",
        changeOrigin: true,
        // The seeding-band build is a ~30 s cold read of ~34 GRIB records.
        // Node's default socket timeout would cut it off mid-build.
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
      "/pireps": {
        target: process.env.SERVER_ORIGIN || "http://localhost:3000",
        changeOrigin: true,
      },
      "/radar": {
        target: process.env.SERVER_ORIGIN || "http://localhost:3000",
        changeOrigin: true,
        // A cold mosaic is a ~9 s decode of a 24.5M-point grid.
        timeout: 60_000,
        proxyTimeout: 60_000,
      },
    },
    watch: {
      usePolling: true,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
