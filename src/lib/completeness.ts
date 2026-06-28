/**
 * Listing completeness (B1 dashboard + B4 edit). The best free-tier engagement
 * driver — completeness lifts discoverability for everyone. Returns a percent and
 * the single next best action to surface (BUILD-BRIEF, B1/B4 wireframe notes).
 */
import type { Business } from "./types";
import { LIMITS } from "./entitlements";

interface Check {
  done: boolean;
  /** copy for the "next: …" nudge when not done */
  next: string;
  weight: number;
}

export interface Completeness {
  percent: number;
  nextAction?: string;
}

export function listingCompleteness(b: Business): Completeness {
  const photoCap = LIMITS[b.tier].photos ?? 5;
  const checks: Check[] = [
    { done: !!b.name, next: "add your business name", weight: 1 },
    { done: !!b.category, next: "choose a category", weight: 1 },
    { done: b.description.trim().length >= 20, next: "write a short description", weight: 1 },
    { done: !!b.address, next: "add your address", weight: 1 },
    { done: !!b.phone, next: "add a phone number", weight: 1 },
    { done: !!b.website, next: "add your website", weight: 1 },
    { done: !!b.hours, next: "set your hours", weight: 1 },
    { done: b.amenityTags.length > 0, next: "tag your amenities", weight: 1 },
    {
      done: b.photos.length >= Math.min(3, photoCap),
      next: `add ${Math.max(0, Math.min(3, photoCap) - b.photos.length)} photo(s)`,
      weight: 2,
    },
  ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.done ? c.weight : 0), 0);
  const percent = Math.round((got / total) * 100);
  const nextAction = checks.find((c) => !c.done)?.next;
  return { percent, nextAction };
}
