import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

/**
 * Redmond Compass — Vite config.
 * PWA wiring is scaffolded here but kept light at this stage (BUILD-BRIEF §12 step 8
 * is the full PWA pass: offline for saved/recent, install prompt, icons). The manifest
 * below matches BUILD-BRIEF §10. Icons are added in the PWA step.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Service-worker behaviour is fleshed out in the PWA step; dev is disabled to
      // avoid caching surprises while building the consumer read path.
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Redmond Compass",
        short_name: "Compass",
        description: "Find local Redmond businesses, events, and news.",
        start_url: "/",
        display: "standalone",
        theme_color: "#082954",
        background_color: "#FAF8F5",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
