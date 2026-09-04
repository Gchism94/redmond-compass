/**
 * Row (snake_case Postgres) → domain (camelCase, src/lib/types.ts) mappers.
 * The only place column names appear, so the rest of the app is unchanged.
 */
import type { Business, BusinessClass, CommunityNotice, Bulletin, EventItem, NewsArticle, Resource, Hours } from "@/lib/types";
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
    hasPreciseLocation: r.lat != null && r.lng != null,
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
    hideAddress: !!r.hide_address,
    hoursLocationName: r.hours_location_name ?? undefined,
    videos: r.videos ?? undefined,
    headshotUrl: r.headshot_url ?? undefined,
    licenseType: r.license_type ?? undefined,
    referralEnabled: !!r.referral_enabled,
    referralPromoCode: r.referral_promo_code ?? undefined,
    sourceUpdatedAt: r.source_updated_at ?? undefined,
  };
}

export function rowToBulletin(r: Row): Bulletin {
  return {
    id: r.id,
    businessId: r.business_id,
    title: r.title ?? undefined,
    body: r.body,
    image: r.image ?? undefined,
    galleryImages: r.gallery_images ?? [],
    linkCta: r.link_cta ?? undefined,
    activeUntil: r.active_until ?? undefined,
    scheduledFor: r.scheduled_for ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    source: r.source ?? undefined,
    sourceUpdatedAt: r.source_updated_at ?? undefined,
  };
}

export function rowToCommunityNotice(r: Row): CommunityNotice {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    // imageUrl is mapped but NOT rendered — the one live row points at media.base44.com,
    // which is expiring (guide images were self-hosted for exactly this reason) and
    // check:base44 scans code, not data, so nothing would catch it going dark.
    imageUrl: r.image_url ?? undefined,
    supportLink: r.support_link ?? undefined,
    supportLabel: r.support_label ?? undefined,
    pinned: !!r.pinned,
    category: r.category ?? undefined,
    createdAt: r.created_at,
  };
}

export function rowToBusinessClass(r: Row): BusinessClass {
  return {
    id: r.id,
    businessId: r.business_id,
    title: r.title,
    date: r.date,
    timeText: r.time_text ?? undefined,
    location: r.location ?? undefined,
    description: r.description ?? undefined,
    link: r.link ?? undefined,
    // imageUrl is mapped but NOT rendered: every live row hotlinks the studio's own Wix
    // CDN, and the section reads fine without them. Kept on the type so an owner editor
    // (or self-hosted images) can use it without a schema round-trip.
    imageUrl: r.image_url ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    source: r.source ?? undefined,
    sourceUpdatedAt: r.source_updated_at ?? undefined,
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
    source: r.source ?? undefined,
    sourceTimeText: r.source_time_text ?? undefined,
    sourceUpdatedAt: r.source_updated_at ?? undefined,
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
