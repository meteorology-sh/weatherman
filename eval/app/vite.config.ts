// Vite
import { defineConfig } from "vite";

// Meta
import path from "path";

// Plugins
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The eval map's dev server.
 *
 * **It installs nothing.** `node_modules` is a symlink to `/app`'s, and `@`
 * points at `/app`'s source, so this page draws with the same ArcGIS build and
 * the same renderer objects the app under test draws with. A second install
 * could drift a minor version and repaint a band, and every difference this
 * page exists to show would then be partly its own.
 *
 * Two proxies, because two servers answer here: the weather comes from
 * Weatherman on 3000, and the flight record and our scores come from
 * `eval/server.mjs` on 3100. Nothing merges them server-side — the whole point
 * is to lay one over the other and look.
 */
const APP = path.resolve(__dirname, "../../app");
const WEATHERMAN = process.env.SERVER_ORIGIN || "http://localhost:3000";
const EVAL = process.env.EVAL_ORIGIN || "http://localhost:3100";

/** A cold replay build reads five sources out of the archive one range at a time. */
const COLD_BUILD_MS = 240_000;

const weatherman = {
  target: WEATHERMAN,
  changeOrigin: true,
  timeout: COLD_BUILD_MS,
  proxyTimeout: COLD_BUILD_MS,
};

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(APP, "src"),
      "~": path.resolve(__dirname, "src"),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    hmr: { host: "localhost", port: 5174 },
    proxy: {
      "/candidate": weatherman,
      "/cloudtop": weatherman,
      "/forecast": weatherman,
      "/radar": weatherman,
      "/eval": {
        target: EVAL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/eval/, ""),
      },
    },
  },
});
