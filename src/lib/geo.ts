/**
 * Distance helpers for the "0.4 mi" metadata on cards and the profile.
 * Map search is deferred (BUILD-BRIEF §3) — this is list-side distance only.
 */
import type { GeoPoint } from "./types";

/** Downtown Redmond, OR — fallback origin when the user hasn't shared location. */
export const REDMOND_CENTER: GeoPoint = { lat: 44.2726, lng: -121.1739 };

const R_MILES = 3958.8;

/** Great-circle distance in miles between two points (Haversine). */
export function distanceMiles(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** "0.4 mi" / "1.2 mi". Under 0.1 mi reads "nearby". */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return "nearby";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
