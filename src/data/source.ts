/**
 * The ONE place a concrete data source is chosen (BUILD-BRIEF §2, DATA-SOURCE.md).
 * Switching backends is config, not code — nothing in features/ or components/
 * imports a concrete source.
 *
 *   VITE_DATA_SOURCE = "mock" (dev default) | "supabase" (recommended path B) | "base44"
 */
import type { DataSource } from "./DataSource";
import { MockDataSource } from "./mock/MockDataSource";
import { createSupabaseSource } from "./supabase/SupabaseDataSource";

function createDataSource(): DataSource {
  const kind = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? "mock";
  switch (kind) {
    case "supabase":
      return createSupabaseSource(); // app reads only from Supabase (GHL syncs in later)
    // case "base44": return createBase44Source(); // not implemented
    case "mock":
    default:
      return new MockDataSource();
  }
}

/** Module-singleton; injected via DataProvider so components never import it directly. */
export const dataSource: DataSource = createDataSource();
