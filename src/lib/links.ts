/**
 * Outbound action links (Call / Directions). These work without auth — browse &
 * act are always free (BUILD-BRIEF §1). Save/Follow are the auth-gated actions.
 */
import type { Business, GeoPoint } from "./types";

export function telHref(phone?: string): string | undefined {
  const raw = phone?.trim();
  if (!raw) return undefined;

  // Keep an extension separate from the subscriber number. Concatenating "x9" onto the
  // base digits dials a different (and invalid) phone number; RFC 3966 uses `;ext=`.
  const extensionMatch = raw.match(/(?:\bext(?:ension)?\.?|\bx)\s*[:#.-]?\s*(\d+)\s*$/i);
  const extension = extensionMatch?.[1];
  const base = extensionMatch ? raw.slice(0, extensionMatch.index).trim() : raw;
  const digits = base.replace(/\D/g, "");
  // Three-digit service codes (911/211/988) are valid callable numbers.
  if (digits.length < 3) return undefined;

  const subscriber = `${base.startsWith("+") ? "+" : ""}${digits}`;
  return `tel:${subscriber}${extension ? `;ext=${extension}` : ""}`;
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
