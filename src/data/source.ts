/**
 * The ONE place a concrete data source is chosen (BUILD-BRIEF §2, DATA-SOURCE.md).
 * Switching backends is config, not code — nothing in features/ or components/
 * imports a concrete source.
 *
 *   VITE_DATA_SOURCE = "mock" (dev default) | "supabase" (path B — the real backend)
 *
 * Loaded ON DEMAND via dynamic import: the chosen source (and, for supabase, the
 * ~55 KB-gzip @supabase/supabase-js it pulls in) is kept OUT of the entry chunk, so the
 * app shell + skeletons paint first and the data lib loads in parallel. The promise is
 * cached, so every caller shares one source instance.
 */
import type { DataSource } from "./DataSource";

let cached: Promise<DataSource> | null = null;

export function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  cached = (async () => {
    // Deliberately an `if` on the RAW `import.meta.env` expression rather than a `switch` on
    // a local. Vite substitutes the literal at build time, so this folds to `if (true)` in a
    // supabase build and Rollup drops everything below — which is what finally keeps the
    // MockDataSource chunk and its fictional seed ("Juniper & Sage Cafe", …) OUT of the
    // production bundle. The old `switch (kind)` never folded, so ~11 KB of invented
    // businesses shipped to every user and sat in the service worker's precache.
    if (import.meta.env.VITE_DATA_SOURCE === "supabase") {
      const { createSupabaseSource } = await import("./supabase/SupabaseDataSource");
      return createSupabaseSource(); // app reads only from Supabase (the Sheet syncs in server-side)
    }

    // Runtime backstop to the build-time guard in vite.config.ts. If a production bundle
    // ever gets built without VITE_DATA_SOURCE (a deleted Cloudflare Pages variable, a new
    // environment that never had it), FAIL rather than quietly serving invented businesses
    // as though they were Redmond's real directory. A silent fallback here is the worst
    // outcome available: it looks like a working app.
    if (import.meta.env.PROD && import.meta.env.VITE_ALLOW_MOCK !== "1") {
      throw new Error(
        `Refusing to start: VITE_DATA_SOURCE is "${import.meta.env.VITE_DATA_SOURCE ?? "(unset)"}", not "supabase". ` +
          "A production build must not serve mock data. Set VITE_DATA_SOURCE / VITE_SUPABASE_URL / " +
          "VITE_SUPABASE_ANON_KEY (Cloudflare Pages → Settings → Variables and Secrets), or set " +
          "VITE_ALLOW_MOCK=1 if a mock build is genuinely what you want.",
      );
    }

    const { MockDataSource } = await import("./mock/MockDataSource");
    return new MockDataSource();
  })();
  return cached;
}
