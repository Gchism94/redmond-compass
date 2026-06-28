/**
 * GoHighLevel → Business mapping SEAM (DATA-SOURCE.md, path B).
 *
 * NOT WIRED YET. GHL is the system-of-record for businesses; a server-side sync
 * (webhook + nightly reconcile, in a Supabase edge function — NOT in this app)
 * will upsert into `public.businesses` keyed by the stable `ghl_id`. This file is
 * the ONLY place GHL's field names should ever appear — the one function the sync
 * job imports. The PWA never calls GHL directly (tokens can't ship client-side and
 * its rate limits aren't sized for public reads).
 *
 * When the sync ships: flesh out `ghlRecordToBusiness`, run it in the edge function,
 * and `upsert ... on conflict (ghl_id)` so replays are idempotent.
 */
import type { Business } from "@/lib/types";

/** Loose shape of a GHL custom-object / contact record (fields TBD against the real API). */
export interface GhlBusinessRecord {
  id: string; // GHL record id → businesses.ghl_id
  [field: string]: unknown;
}

/** Row shape upserted into public.businesses (snake_case). Subset the sync sets. */
export type BusinessUpsertRow = Partial<Record<string, unknown>> & {
  ghl_id: string;
  name: string;
  slug: string;
  category: string;
};

/**
 * STUB — map a GHL record to a businesses upsert row. Implement when the GHL custom
 * field names are known. Keeping the signature stable now lets the sync job and tests
 * compile against it. Throws so it can't be mistaken for a working sync.
 */
export function ghlRecordToBusiness(_record: GhlBusinessRecord): BusinessUpsertRow {
  void _record;
  throw new Error(
    "ghlRecordToBusiness is a stub — GHL → Supabase sync is not implemented yet (DATA-SOURCE.md). " +
      "Map GHL custom fields to the businesses columns here, then upsert on ghl_id in the edge function.",
  );
}

/** Reference: the domain type the synced row becomes once read back through the DataSource. */
export type SyncedBusiness = Business;
