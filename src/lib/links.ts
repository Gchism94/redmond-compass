/**
 * Outbound action links (Call / Directions). These work without auth — browse &
 * act are always free (BUILD-BRIEF §1). Save/Follow are the auth-gated actions.
 */
import type { Business, GeoPoint } from "./types";

export function telHref(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : undefined;
}

export function directionsHref(opts: { address?: string; geo?: GeoPoint }): string {
  const dest = opts.geo
    ? `${opts.geo.lat},${opts.geo.lng}`
    : encodeURIComponent(opts.address ?? "");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function businessHref(b: Pick<Business, "slug">): string {
  return `/b/${b.slug}`;
}
