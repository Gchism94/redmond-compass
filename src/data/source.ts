/**
 * The ONE place a concrete data source is chosen (BUILD-BRIEF §2).
 * Switching the backend (base44 API vs shared Supabase) means adding a class that
 * implements DataSource and changing this file — nothing in features/ or
 * components/ imports a concrete source.
 *
 * Selection is env-driven so the swap is config, not code:
 *   VITE_DATA_SOURCE = "mock" (default) | "base44" | "supabase"
 */
import type { DataSource } from "./DataSource";
import { MockDataSource } from "./mock/MockDataSource";

function createDataSource(): DataSource {
  const kind = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? "mock";
  switch (kind) {
    // case "base44":   return new Base44DataSource(...)   // TODO when backend decided (§14)
    // case "supabase": return new SupabaseDataSource(...) // TODO when backend decided (§14)
    case "mock":
    default:
      return new MockDataSource();
  }
}

/** Module-singleton; injected via DataProvider so components never import it directly. */
export const dataSource: DataSource = createDataSource();
