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

const kind = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? "mock";

let cached: Promise<DataSource> | null = null;

export function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  cached = (async () => {
    switch (kind) {
      case "supabase": {
        const { createSupabaseSource } = await import("./supabase/SupabaseDataSource");
        return createSupabaseSource(); // app reads only from Supabase (the Sheet syncs in server-side)
      }
      case "mock":
      default: {
        const { MockDataSource } = await import("./mock/MockDataSource");
        return new MockDataSource();
      }
    }
  })();
  return cached;
}
