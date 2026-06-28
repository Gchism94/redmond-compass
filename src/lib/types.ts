/**
 * Redmond Compass — data model (v1 / MVP).
 * Mirrors BUILD-BRIEF.md §5. Fields/types marked DEFERRED are for post-MVP
 * features — kept in the schema so turning them on is config, not migration.
 *
 * The 5 content types: Business · Bulletin · EventItem · NewsArticle · Resource.
 * Recommendation is a lightweight 6th (fast-follow). "EventItem" avoids the DOM `Event`.
 */

export type Tier = "free" | "member" | "pro"; // MVP: always "free"
export type ID = string;

/** "HH:MM" 24h, e.g. "07:00" */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}
export interface SpecialHours {
  date: string;
  open?: string;
  close?: string;
  closed?: boolean;
  note?: string;
}
export interface Hours {
  week: Record<Weekday, DayHours>;
  special?: SpecialHours[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Business {
  id: ID;
  name: string;
  slug: string;
  category: string;
  subcategories?: string[];
  description: string;
  address: string;
  geo: GeoPoint;
  phone?: string;
  website?: string;
  email?: string;
  hours?: Hours;
  photos: string[]; // MVP cap 5 (see entitlements LIMITS)
  amenityTags: string[]; // must match the search facet vocabulary
  claimed: boolean;
  verified: boolean;
  ownerId?: ID;
  tier: Tier; // MVP always "free"
  createdAt: string;
  memberSince?: string;
  // DEFERRED (post-MVP enhanced/Member + derived presence signals)
  story?: string;
  ownerSpotlight?: { name: string; blurb: string; photo?: string };
  menu?: { name: string; price?: string; note?: string }[];
  ctas?: { label: string; url: string }[];
  gallery?: string[];
  followerCount?: number;
  postFrequency?: "weekly" | "monthly" | "occasional";
  responseTime?: string; // e.g. "usually replies in a day"
  recommendCount?: number; // DEFERRED (fast-follow) — positive-only count; NOT a rating
}

export interface Bulletin {
  id: ID;
  businessId: ID;
  body: string; // char-limited in UI
  image?: string;
  linkCta?: { label: string; url: string };
  activeUntil?: string;
  scheduledFor?: string;
  status: "draft" | "scheduled" | "live" | "expired";
  createdAt: string;
}

export interface EventItem {
  id: ID;
  businessId?: ID; // null/undefined = community event
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  venueName?: string;
  address?: string;
  geo?: GeoPoint;
  image?: string;
  category?: string;
  tags?: string[];
  linkCta?: { label: string; url: string };
  status: "upcoming" | "past" | "cancelled";
}

export interface NewsArticle {
  id: ID;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  image?: string;
  source: string;
  author?: string;
  publishedAt: string;
}

export type ResourceCategory = "emergency" | "government" | "community" | "utilities";
export interface Resource {
  id: ID;
  name: string;
  category: ResourceCategory;
  description: string;
  phone?: string;
  url?: string;
  address?: string;
}

export interface User {
  id: ID;
  email: string;
  name: string;
  role: "resident" | "owner" | "admin";
  interests: string[];
  location?: GeoPoint;
  savedBusinessIds: ID[];
  followedBusinessIds: ID[];
  savedEventIds: ID[];
  recentlyViewedIds: ID[];
  notificationPrefs: { followedBulletins: boolean; savedEvents: boolean; localNews: boolean };
}

/** DEFERRED — fast-follow. Positive-only by design: there is NO rating value. */
export interface Recommendation {
  id: ID;
  businessId: ID;
  userId: ID;
  note?: string;
  verifiedCustomer: boolean;
  createdAt: string;
}

/** Convenience union for unified search results (S3/S4). */
export type SearchResultType = "business" | "event" | "bulletin" | "news";
export type SearchResult =
  | { type: "business"; item: Business }
  | { type: "event"; item: EventItem }
  | { type: "bulletin"; item: Bulletin }
  | { type: "news"; item: NewsArticle };
