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
 * **It imports the product's own objects rather than copies.** `@` resolves
 * into `/app/src`, so the ramps, the band levels, the colors and the layer
 * names are the ones Weatherman draws with. A page built to find disagreements
 * between the map and an operator must not introduce one between itself and the
 * map it is inspecting.
 *
 * Its dependencies are pinned to the same versions `/app` uses for the same
 * reason: a drifted React or Tailwind here would repaint a band and the
 * difference would look like a finding.
 *
 * `~` is this app's own source, so the two origins stay visible at every import.
 */
export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "@": path.resolve(__dirname, "../../app/src"),
    },
    // The files behind `@` sit outside this app's tree, so they have no
    // `node_modules` above them to resolve React from. Naming it here points
    // them at the one copy this app installs — the same statement the `paths`
    // block in `tsconfig.json` makes to the typechecker.
    dedupe: ["react", "react-dom"],
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    // `@` reaches outside this app's root, so the dev server has to be told it
    // may serve from `/app` as well. Both paths are relative to this file, so
    // they hold in the container and on a laptop alike.
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, "../../app")],
    },
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
