/**
 * Row (snake_case Postgres) → domain (camelCase, src/lib/types.ts) mappers.
 * The only place column names appear, so the rest of the app is unchanged.
 */
import type { Business, Bulletin, EventItem, NewsArticle, Resource, Hours } from "@/lib/types";
import { REDMOND_CENTER } from "@/lib/geo";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

/** A UTC timestamptz from the DB → the naive Redmond/Pacific wall-clock string the
 *  app uses for event times (matches the mock convention + lib/calendar.ts). */
export function toEventLocal(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const hh = m.hour === "24" ? "00" : m.hour;
  return `${m.year}-${m.month}-${m.day}T${hh}:${m.minute}:${m.second}`;
}

export function rowToBusiness(r: Row): Business {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category,
    subcategories: r.subcategories ?? [],
    description: r.description ?? "",
    address: r.address ?? "",
    geo: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : REDMOND_CENTER,
    phone: r.phone ?? undefined,
    website: r.website ?? undefined,
    email: r.email ?? undefined,
    hours: (r.hours as Hours) ?? undefined,
    photos: r.photos ?? [],
    amenityTags: r.amenity_tags ?? [],
    claimed: !!r.claimed,
    verified: !!r.verified,
    ownerId: r.owner_id ?? undefined,
    tier: r.tier,
    createdAt: r.created_at,
    memberSince: r.member_since ?? undefined,
    story: r.story ?? undefined,
    ownerSpotlight: r.owner_spotlight ?? undefined,
    menu: r.menu ?? undefined,
    ctas: r.ctas ?? undefined,
    gallery: r.gallery ?? undefined,
    followerCount: r.follower_count ?? undefined,
    postFrequency: r.post_frequency ?? undefined,
    responseTime: r.response_time ?? undefined,
    recommendCount: r.recommend_count ?? undefined,
    longDescription: r.long_description ?? undefined,
    messageLink: r.message_link ?? undefined,
    socials: r.socials ?? undefined,
    licenseNumber: r.license_number ?? undefined,
    specials: r.specials ?? undefined,
    specialsImageUrl: r.specials_image_url ?? undefined,
    additionalLocations: r.additional_locations ?? undefined,
    extraCategories: r.extra_categories ?? undefined,
    hoursText: r.hours_text ?? undefined,
  };
}

export function rowToBulletin(r: Row): Bulletin {
  return {
    id: r.id,
    businessId: r.business_id,
    body: r.body,
    image: r.image ?? undefined,
    linkCta: r.link_cta ?? undefined,
    activeUntil: r.active_until ?? undefined,
    scheduledFor: r.scheduled_for ?? undefined,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function rowToEvent(r: Row): EventItem {
  return {
    id: r.id,
    businessId: r.business_id ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    startAt: toEventLocal(r.start_at)!,
    endAt: toEventLocal(r.end_at),
    venueName: r.venue_name ?? undefined,
    address: r.address ?? undefined,
    geo: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : undefined,
    image: r.image ?? undefined,
    category: r.category ?? undefined,
    tags: r.tags ?? [],
    linkCta: r.link_cta ?? undefined,
    status: r.status,
    approvalStatus: r.approval_status ?? undefined,
    submitterName: r.submitter_name ?? undefined,
    gcalEventId: r.gcal_event_id ?? undefined,
  };
}

export function rowToNews(r: Row): NewsArticle {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt ?? "",
    body: r.body ?? "",
    image: r.image ?? undefined,
    source: r.source,
    author: r.author ?? undefined,
    publishedAt: r.published_at,
    category: r.category ?? undefined,
    pinned: !!r.pinned,
    sourceUrl: r.source_url ?? undefined,
  };
}

export function rowToResource(r: Row): Resource {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description ?? "",
    phone: r.phone ?? undefined,
    url: r.url ?? undefined,
    address: r.address ?? undefined,
    subcategory: r.subcategory ?? undefined,
    image: r.image_url ?? undefined,
    email: r.email ?? undefined,
    additionalPhones: r.additional_phones ?? undefined,
    serviceTimes: r.service_times ?? undefined,
  };
}
