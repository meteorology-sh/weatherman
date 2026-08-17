// Vite
import { defineConfig } from "vite";

// Meta
import path from "path";

// Plugins
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The evaluation app.
 *
 * **It installs nothing.** `node_modules` is a committed symlink to `/app`'s,
 * and `@` resolves into `/app/src`, so the renderers, the layer urls and the
 * types here are the product's own objects rather than copies. A page built to
 * find disagreements between the map and an operator must not introduce one
 * between itself and the map it is inspecting, and a second install could drift
 * a version and repaint a band.
 *
 * `~` is this app's own source, so the two origins stay visible at every import.
 */
export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "@": path.resolve(__dirname, "../../app/src"),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    cors: true,
    proxy: {
      // The findings and the flight record. Local files, so this is instant.
      "/eval": {
        target: process.env.EVAL_ORIGIN || "http://localhost:3100",
        changeOrigin: true,
        rewrite: (route) => route.replace(/^\/eval/, ""),
      },
      // The weather itself, from the product's own server. A replayed hour is a
      // cold read out of the archive, so these wait as long as the app does.
      ...Object.fromEntries(
        ["/candidate", "/cloudtop", "/forecast", "/radar"].map((prefix) => [
          prefix,
          {
            target: process.env.SERVER_ORIGIN || "http://localhost:3000",
            changeOrigin: true,
            timeout: 240_000,
            proxyTimeout: 240_000,
          },
        ])
      ),
    },
    watch: { usePolling: true },
  },
});
