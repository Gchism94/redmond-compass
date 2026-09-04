import { eventStartToUtc } from "../../src/lib/calendar.ts";

const ENTITY_BASE = "https://redmondcompass.com/api/apps/6a05e41957c8ee753cb7380c/entities";
export const MAIN_SITE_CONTENT_URLS = {
  events: `${ENTITY_BASE}/Event?sort=-created_date&limit=500`,
  posts: `${ENTITY_BASE}/BusinessPost?sort=-created_date&limit=500`,
  classes: `${ENTITY_BASE}/BusinessClass?sort=-created_date&limit=500`,
} as const;

export const MAIN_SITE_SOURCE = "main_site";
export const MIN_EXPECTED_EVENTS = 25;

type JsonRecord = Record<string, unknown>;
type ExistingEvent = { id: string; title: string; start_at: string; source?: string | null; source_id?: string | null; gcal_event_id?: string | null };
type ExistingSourceRow = { id: string; source_id?: string | null };

export interface ContentSyncInput {
  events: unknown;
  posts: unknown;
  classes: unknown;
  businessIds: Iterable<string>;
  existingEvents?: ExistingEvent[];
  existingPosts?: ExistingSourceRow[];
  existingClasses?: ExistingSourceRow[];
  now?: Date;
  minimumEvents?: number;
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isoOrNull = (value: unknown) => {
  const valueText = text(value);
  return valueText && !Number.isNaN(Date.parse(valueText)) ? new Date(valueText).toISOString() : null;
};
const urlOrNull = (value: unknown) => {
  const valueText = text(value);
  if (!valueText) return null;
  try {
    const parsed = new URL(valueText);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
};
const records = (payload: unknown, label: string): JsonRecord[] => {
  if (!Array.isArray(payload)) throw new Error(`Main-site ${label} response was not an array.`);
  return payload.filter((value): value is JsonRecord => !!value && typeof value === "object");
};
const normalizeTitle = (value: string) => value.normalize("NFKD").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();

function redmondDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(+date)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validDate(value: unknown): string | null {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

type Clock = { hour: number; minute: number; meridiem?: "am" | "pm" };
function clock(value: string): Clock | null {
  const clean = value.toLowerCase().replace(/\./g, "").trim();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3] as Clock["meridiem"];
  if (minute > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) return null;
  return { hour, minute, meridiem };
}

function to24(value: Clock, inferred?: Clock["meridiem"]): { hour: number; minute: number } {
  const meridiem = value.meridiem ?? inferred;
  if (!meridiem) return { hour: value.hour, minute: value.minute };
  return { hour: (value.hour % 12) + (meridiem === "pm" ? 12 : 0), minute: value.minute };
}

/** Parse the human-authored time field without guessing when no recognizable time exists. */
export function parseMainSiteTime(value: unknown): { start: string; end?: string } | null {
  const original = text(value).replace(/\u00a0/g, " ");
  if (!original) return null;
  const parts = original.split(/\s*(?:-|–|—|\bto\b)\s*/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 2) return null;
  const startClock = clock(parts[0]);
  const endClock = parts[1] ? clock(parts[1]) : null;
  if (!startClock || (parts[1] && !endClock)) return null;
  const start = to24(startClock, endClock?.meridiem);
  const end = endClock ? to24(endClock, startClock.meridiem) : undefined;
  const format = (part: { hour: number; minute: number }) => `${String(part.hour).padStart(2, "0")}:${String(part.minute).padStart(2, "0")}`;
  return { start: format(start), ...(end ? { end: format(end) } : {}) };
}

function sourceId(record: JsonRecord) {
  return text(record.id);
}

function sourceDeletes(existing: ExistingSourceRow[], desiredIds: Set<string>) {
  return existing.filter((row) => !desiredIds.has(row.source_id ?? "")).map((row) => row.id);
}

export function buildMainSiteContentPlan(input: ContentSyncInput) {
  const eventRecords = records(input.events, "Event");
  const postRecords = records(input.posts, "BusinessPost");
  const classRecords = records(input.classes, "BusinessClass");
  const approvedEvents = eventRecords.filter((row) => text(row.status).toLowerCase() === "approved");
  const minimumEvents = input.minimumEvents ?? MIN_EXPECTED_EVENTS;
  if (approvedEvents.length < minimumEvents) {
    throw new Error(`Main-site event feed returned ${approvedEvents.length} approved rows; expected at least ${minimumEvents}. Refusing a partial sync.`);
  }

  const now = input.now ?? new Date();
  const businessIds = new Set(input.businessIds);
  const existingEvents = input.existingEvents ?? [];
  const occupiedEventKeys = new Set(existingEvents
    .filter((row) => row.source !== MAIN_SITE_SOURCE)
    .map((row) => {
      const date = redmondDate(row.start_at);
      return date ? `${normalizeTitle(row.title)}|${date}` : "";
    })
    .filter(Boolean));
  const skipped: Array<{ entity: string; id: string; reason: string }> = [];

  const events = approvedEvents.flatMap((row) => {
    const id = sourceId(row);
    const title = text(row.title);
    const date = validDate(row.date);
    const parsedTime = parseMainSiteTime(row.time);
    if (!id || !title || !date || !parsedTime) {
      skipped.push({ entity: "Event", id, reason: "missing id, title, valid date, or parseable time" });
      return [];
    }
    const key = `${normalizeTitle(title)}|${date}`;
    if (occupiedEventKeys.has(key)) {
      skipped.push({ entity: "Event", id, reason: "already represented by another event source" });
      return [];
    }
    const start = eventStartToUtc(`${date}T${parsedTime.start}:00`);
    let end = parsedTime.end ? eventStartToUtc(`${date}T${parsedTime.end}:00`) : undefined;
    if (end && end <= start) end = new Date(end.getTime() + 86_400_000);
    const link = urlOrNull(row.link);
    const businessId = text(row.business_id);
    return [{
      id: `ms_event_${id}`,
      business_id: businessId && businessIds.has(businessId) ? businessId : null,
      title,
      description: text(row.description) || null,
      start_at: start.toISOString(),
      end_at: end?.toISOString() ?? null,
      venue_name: text(row.location) || null,
      address: null,
      image: urlOrNull(row.image_url),
      category: text(row.category) || null,
      tags: [],
      link_cta: link ? { label: "Event details", url: link } : null,
      status: (end ?? start) < now ? "past" : "upcoming",
      approval_status: "approved",
      submitter_name: text(row.submitter_name) || null,
      gcal_event_id: null,
      source: MAIN_SITE_SOURCE,
      source_id: id,
      source_time_text: text(row.time),
      source_updated_at: isoOrNull(row.updated_date) ?? isoOrNull(row.created_date) ?? now.toISOString(),
    }];
  });

  const posts = postRecords.flatMap((row) => {
    if (text(row.status).toLowerCase() !== "approved") return [];
    const id = sourceId(row);
    const businessId = text(row.business_id);
    const title = text(row.title);
    const body = text(row.body) || title;
    if (!id || !businessId || !businessIds.has(businessId) || !body) {
      skipped.push({ entity: "BusinessPost", id, reason: "missing id, matched business, or body" });
      return [];
    }
    const gallery = Array.isArray(row.gallery_images) ? row.gallery_images.map(urlOrNull).filter(Boolean) : [];
    return [{
      id: `ms_post_${id}`,
      business_id: businessId,
      title: title || null,
      body,
      image: urlOrNull(row.image_url) ?? gallery[0] ?? null,
      gallery_images: gallery,
      link_cta: null,
      active_until: null,
      scheduled_for: null,
      status: "live",
      created_at: isoOrNull(row.created_date) ?? now.toISOString(),
      source: MAIN_SITE_SOURCE,
      source_id: id,
      source_updated_at: isoOrNull(row.updated_date) ?? isoOrNull(row.created_date) ?? now.toISOString(),
    }];
  });

  const classes = classRecords.flatMap((row) => {
    const upstreamStatus = text(row.status).toLowerCase();
    if (!["approved", "open", "sold_out", "waitlist"].includes(upstreamStatus)) return [];
    const id = sourceId(row);
    const businessId = text(row.business_id);
    const title = text(row.title);
    const date = validDate(row.date);
    if (!id || !businessId || !businessIds.has(businessId) || !title || !date) {
      skipped.push({ entity: "BusinessClass", id, reason: "missing id, matched business, title, or valid date" });
      return [];
    }
    return [{
      id: `ms_class_${id}`,
      business_id: businessId,
      title,
      date,
      time_text: text(row.time) || null,
      location: text(row.location) || null,
      description: text(row.description) || null,
      link: urlOrNull(row.link),
      image_url: urlOrNull(row.image_url),
      status: ["sold_out", "waitlist"].includes(upstreamStatus) ? upstreamStatus : "open",
      created_at: isoOrNull(row.created_date) ?? now.toISOString(),
      source: MAIN_SITE_SOURCE,
      source_id: id,
      source_updated_at: isoOrNull(row.updated_date) ?? isoOrNull(row.created_date) ?? now.toISOString(),
    }];
  });

  const desiredEventIds = new Set(events.map((row) => row.source_id));
  const desiredPostIds = new Set(posts.map((row) => row.source_id));
  const desiredClassIds = new Set(classes.map((row) => row.source_id));
  const existingSourceEvents = existingEvents.filter((row) => row.source === MAIN_SITE_SOURCE);

  return {
    events,
    posts,
    classes,
    deleteEventIds: sourceDeletes(existingSourceEvents, desiredEventIds),
    deletePostIds: sourceDeletes(input.existingPosts ?? [], desiredPostIds),
    deleteClassIds: sourceDeletes(input.existingClasses ?? [], desiredClassIds),
    skipped,
    rowsRead: eventRecords.length + postRecords.length + classRecords.length,
  };
}
