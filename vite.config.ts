import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

/**
 * Redmond Compass — Vite config (PWA, BUILD-BRIEF §10).
 * Installable, app-shell precache + offline. SW is disabled in dev (avoids caching
 * surprises while building); it builds + registers for production/preview.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        id: "/",
        name: "Redmond Compass",
        short_name: "Compass",
        description: "Find local Redmond, OR businesses, events, and community news.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "en-US",
        dir: "ltr",
        theme_color: "#082954",
        background_color: "#FAF8F5",
        categories: ["business", "lifestyle", "navigation"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Search", short_name: "Search", url: "/search", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Events", short_name: "Events", url: "/events", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Saved", short_name: "Saved", url: "/saved", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Precache the app shell; SPA routes fall back to index.html so deep links
        // work offline. Data is bundled/local at MVP — the /api/ rule is the seam
        // for the real backend (network-first with a short timeout, then cache).
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-stylesheets", expiration: { maxEntries: 10 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Seam for the real backend (base44/Supabase): network-first so the
            // latest data wins, with a cached fallback for offline.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-data",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libs into their own cached chunks. With the
        // PWA's autoUpdate, an app-code change then re-downloads only the small app chunk
        // instead of the whole entry (supabase-js + React + Query), and the vendors load
        // in parallel. Screens are already route-split via React.lazy; the supabase chunk
        // is referenced only by the dynamically-imported source, so it stays on-demand.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/react-router") ||
            id.includes("@remix-run") ||
            id.includes("/scheduler/")
          )
            return "react-vendor";
        },
      },
    },
  },
});
