/**
 * In-memory implementation of the DataSource contract over fictional seed data.
 * This is the MVP source. A real backend (base44 / Supabase) implements the same
 * interface and swaps in at src/data/source.ts with no feature-code changes.
 *
 * A small artificial latency makes loading/skeleton states observable in dev.
 */
import type {
  Business,
  Bulletin,
  EventItem,
  NewsArticle,
  Resource,
  ResourceCategory,
  Recommendation,
  SearchResult,
  User,
  ID,
} from "@/lib/types";
import { REDMOND_CENTER, distanceMiles } from "@/lib/geo";
import { getOpenStatus } from "@/lib/hours";
import { TOP_CATEGORIES, topCategoryFor } from "@/lib/taxonomy";
import type {
  DataSource,
  BusinessQuery,
  EventQuery,
  SearchQuery,
  Paged,
  CategoryCount,
} from "../DataSource";
import { businesses, bulletins, events, news, resources } from "./seed";

const LATENCY_MS = 180;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

function textMatch(b: Business, text: string): boolean {
  const hay = [b.name, b.description, b.category, ...(b.subcategories ?? []), ...b.amenityTags]
    .join(" ")
    .toLowerCase();
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export class MockDataSource implements DataSource {
  // ---- Businesses ----
  async listBusinesses(query: BusinessQuery = {}): Promise<Paged<Business>> {
    const origin = query.origin ?? REDMOND_CENTER;
    let items = [...businesses];

    if (query.text) items = items.filter((b) => textMatch(b, query.text!));
    if (query.categorySlug && query.categorySlug !== "more") {
      items = items.filter((b) => topCategoryFor(b.category) === query.categorySlug);
    }
    if (query.amenityTags?.length) {
      items = items.filter((b) => query.amenityTags!.every((t) => b.amenityTags.includes(t)));
    }
    if (query.openNow) items = items.filter((b) => getOpenStatus(b.hours).open);
    if (query.maxDistanceMi != null) {
      items = items.filter((b) => distanceMiles(origin, b.geo) <= query.maxDistanceMi!);
    }

    items = this.sortBusinesses(items, query.sort ?? "relevance", origin);

    const total = items.length;
    const offset = query.offset ?? 0;
    if (query.limit != null) items = items.slice(offset, offset + query.limit);
    return delay({ items, total });
  }

  private sortBusinesses(items: Business[], sort: BusinessQuery["sort"], origin = REDMOND_CENTER) {
    const by = [...items];
    switch (sort) {
      case "distance":
        return by.sort((a, b) => distanceMiles(origin, a.geo) - distanceMiles(origin, b.geo));
      case "recommend":
        return by.sort((a, b) => (b.recommendCount ?? 0) - (a.recommendCount ?? 0));
      case "name":
        return by.sort((a, b) => a.name.localeCompare(b.name));
      case "openNow":
        return by.sort(
          (a, b) => Number(getOpenStatus(b.hours).open) - Number(getOpenStatus(a.hours).open),
        );
      default:
        // "relevance": verified first, then nearer. Equal ranking otherwise — no paid boosts.
        return by.sort((a, b) => {
          if (a.verified !== b.verified) return Number(b.verified) - Number(a.verified);
          return distanceMiles(origin, a.geo) - distanceMiles(origin, b.geo);
        });
    }
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    return delay(businesses.find((b) => b.slug === slug) ?? null);
  }

  async getBusinessById(id: ID): Promise<Business | null> {
    return delay(businesses.find((b) => b.id === id) ?? null);
  }

  async listCategories(): Promise<CategoryCount[]> {
    const counts: CategoryCount[] = TOP_CATEGORIES.map((c) => ({
      slug: c.slug,
      label: c.label,
      count:
        c.slug === "more"
          ? 0
          : businesses.filter((b) => topCategoryFor(b.category) === c.slug).length,
    }));
    return delay(counts);
  }

  // ---- Bulletins ----
  async listBulletins(params: { businessId?: ID; limit?: number } = {}): Promise<Bulletin[]> {
    let items = bulletins.filter((b) => b.status === "live");
    if (params.businessId) items = items.filter((b) => b.businessId === params.businessId);
    items = items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (params.limit != null) items = items.slice(0, params.limit);
    return delay(items);
  }

  // ---- Events ----
  async listEvents(query: EventQuery = {}): Promise<EventItem[]> {
    let items = [...events];
    if (query.businessId) items = items.filter((e) => e.businessId === query.businessId);
    if (!query.includePast) {
      const now = Date.now();
      items = items.filter((e) => +new Date(e.endAt ?? e.startAt) >= now && e.status !== "past");
    }
    if (query.category) items = items.filter((e) => e.category === query.category);
    if (query.text) {
      const t = query.text.toLowerCase();
      items = items.filter(
        (e) => e.title.toLowerCase().includes(t) || (e.venueName ?? "").toLowerCase().includes(t),
      );
    }
    if (query.from) items = items.filter((e) => +new Date(e.startAt) >= +new Date(query.from!));
    if (query.to) items = items.filter((e) => +new Date(e.startAt) <= +new Date(query.to!));
    items = items.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    if (query.limit != null) items = items.slice(0, query.limit);
    return delay(items);
  }

  async getEventById(id: ID): Promise<EventItem | null> {
    return delay(events.find((e) => e.id === id) ?? null);
  }

  // ---- News ----
  async listNews(params: { limit?: number } = {}): Promise<NewsArticle[]> {
    let items = [...news].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    if (params.limit != null) items = items.slice(0, params.limit);
    return delay(items);
  }

  async getNewsBySlug(slug: string): Promise<NewsArticle | null> {
    return delay(news.find((n) => n.slug === slug) ?? null);
  }

  // ---- Resources ----
  async listResources(
    params: { category?: ResourceCategory; text?: string } = {},
  ): Promise<Resource[]> {
    let items = [...resources];
    if (params.category) items = items.filter((r) => r.category === params.category);
    if (params.text) {
      const t = params.text.toLowerCase();
      items = items.filter(
        (r) => r.name.toLowerCase().includes(t) || r.description.toLowerCase().includes(t),
      );
    }
    return delay(items);
  }

  // ---- Unified search (S3/S4) ----
  async search(text: string, query: SearchQuery = {}): Promise<SearchResult[]> {
    const term = text.trim().toLowerCase();
    if (!term) return delay([]);
    const types = query.types ?? ["business", "event", "bulletin", "news"];
    const out: SearchResult[] = [];

    if (types.includes("business")) {
      for (const b of businesses) if (textMatch(b, term)) out.push({ type: "business", item: b });
    }
    if (types.includes("event")) {
      for (const e of events) {
        if (
          e.title.toLowerCase().includes(term) ||
          (e.category ?? "").toLowerCase().includes(term)
        )
          out.push({ type: "event", item: e });
      }
    }
    if (types.includes("bulletin")) {
      for (const bl of bulletins) {
        if (bl.status === "live" && bl.body.toLowerCase().includes(term))
          out.push({ type: "bulletin", item: bl });
      }
    }
    if (types.includes("news")) {
      for (const n of news) {
        if (n.title.toLowerCase().includes(term) || n.excerpt.toLowerCase().includes(term))
          out.push({ type: "news", item: n });
      }
    }

    return delay(query.limit != null ? out.slice(0, query.limit) : out);
  }

  // ---- Reputation (DEFERRED seam) ----
  async getRecommendations(businessId: ID): Promise<{ count: number; recent: Recommendation[] }> {
    const b = businesses.find((x) => x.id === businessId);
    // MVP: count only, notes are fast-follow (positive-only; never a rating).
    return delay({ count: b?.recommendCount ?? 0, recent: [] });
  }

  // ---- Session (guest at MVP; auth wiring is step 6) ----
  async getCurrentUser(): Promise<User | null> {
    return delay(null);
  }
}
