import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { compassConfig } from "./compass.config";

const appOnly = compassConfig.siteMode === "app-only";

/**
 * Fail a PRODUCTION build that isn't wired to real data, instead of silently shipping the
 * fictional mock directory (audit 2026-08-13, item 7).
 *
 * `src/data/source.ts` used to fall through to MockDataSource whenever VITE_DATA_SOURCE was
 * unset — so a build missing its env would produce a perfectly functional-looking app full
 * of invented businesses. Nothing anywhere said "this isn't real". Cloudflare Pages
 * currently HAS all three variables set on both Production and Preview (verified against
 * the deployed bundles), so this guard should never fire today; it exists for the day a
 * variable is deleted, renamed, or a new environment is added without them.
 *
 * Deliberately fails the build rather than warning: a broken build is a five-minute fix,
 * a live directory of fictional businesses is a credibility problem.
 */
function requireRealDataSource(): Plugin {
  return {
    name: "compass:require-real-data-source",
    apply: "build",
    config(_config, { mode }) {
      if (mode !== "production") return;
      // Reads .env files AND Cloudflare Pages' injected build variables (process.env).
      // Values are trimmed before every check: a variable pasted into a dashboard with a
      // trailing space or newline is a configuration wart, not a reason to block a deploy,
      // and this guard failing the build over one would be worse than the thing it guards.
      const raw = loadEnv(mode, process.cwd(), "");
      const env = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
      ) as Record<string, string>;
      if (env.VITE_ALLOW_MOCK === "1") {
        console.warn("\n⚠️  VITE_ALLOW_MOCK=1 — building with MOCK data on purpose. Do not deploy this to production.\n");
        return;
      }
      const missing = [
        ["VITE_DATA_SOURCE", env.VITE_DATA_SOURCE],
        ["VITE_SUPABASE_URL", env.VITE_SUPABASE_URL],
        ["VITE_SUPABASE_ANON_KEY", env.VITE_SUPABASE_ANON_KEY],
      ].filter(([, v]) => !v).map(([k]) => k as string);

      if (env.VITE_DATA_SOURCE && env.VITE_DATA_SOURCE !== "supabase") {
        throw new Error(
          `[compass] Production build blocked: VITE_DATA_SOURCE is "${env.VITE_DATA_SOURCE}", expected "supabase". ` +
            "Shipping this would serve the fictional seed directory as if it were Redmond's real listings. " +
            "Set VITE_ALLOW_MOCK=1 if you genuinely want a mock build.",
        );
      }
      if (missing.length) {
        throw new Error(
          `[compass] Production build blocked: missing ${missing.join(", ")}.\n` +
            "  • Cloudflare Pages: Settings → Variables and Secrets (set for BOTH Production and Preview).\n" +
            "  • Local build: .env.production.local (gitignored — see .env.example).\n" +
            "Without these the app falls back to mock data and looks like it works.",
        );
      }
      // Cheap shape checks — a truncated or wrong-kind key is as broken as a missing one,
      // and the service-role key must NEVER reach a browser bundle.
      if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(env.VITE_SUPABASE_URL)) {
        throw new Error(`[compass] VITE_SUPABASE_URL doesn't look like a hosted Supabase URL: "${env.VITE_SUPABASE_URL}"`);
      }
      if (/service_role|^sb_secret_/.test(env.VITE_SUPABASE_ANON_KEY)) {
        throw new Error("[compass] VITE_SUPABASE_ANON_KEY looks like a SERVICE-ROLE/secret key. Never ship that to the browser.");
      }
    },
  };
}

/**
 * Redmond Compass — Vite config (PWA, BUILD-BRIEF §10).
 * Installable, app-shell precache + offline. SW is disabled in dev (avoids caching
 * surprises while building); it builds + registers for production/preview.
 */
export default defineConfig({
  plugins: [
    requireRealDataSource(),
    react(),
    VitePWA({
      // Auto-activate updates so an older installed app cannot strand a newer
      // worker in "waiting" before the update banner code itself has loaded.
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        id: "/",
        name: "Redmond Compass",
        short_name: "Compass",
        description: "Find local Redmond, OR businesses, events, and community news.",
        // app-only mode: `/` is the marketing landing page; the INSTALLED app must
        // open the real app home, not the pitch for the thing you already installed.
        start_url: appOnly ? "/home" : "/",
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@config": path.resolve(__dirname, "./compass.config.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libs into their own cached chunks. With the
        // PWA update prompt, an app-code change then re-downloads only the small app chunk
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
