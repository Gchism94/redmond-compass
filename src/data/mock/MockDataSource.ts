/**
 * In-memory implementation of the DataSource contract over fictional seed data,
 * with a localStorage OVERLAY for owner writes (step 7) — new/edited listings,
 * bulletins, and events persist across reloads and show throughout the app.
 *
 * This is the MVP source. A real backend (base44 / Supabase) implements the same
 * interface and swaps in at src/data/source.ts with no feature-code changes.
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
  NewBusinessInput,
  NewBulletinInput,
  NewEventInput,
  AuthUser,
  StartAuthResult,
  PersistedProfile,
  OAuthProvider,
} from "../DataSource";
import {
  businesses as baseBusinesses,
  bulletins as baseBulletins,
  events as baseEvents,
  news,
  resources,
} from "./seed";

const LATENCY_MS = 180;
const OVERLAY_KEY = "rc.owner.v1";

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

interface Overlay {
  newBusinesses: Business[];
  patches: Record<string, Partial<Business>>;
  newBulletins: Bulletin[];
  newEvents: EventItem[];
}

const EMPTY_OVERLAY: Overlay = { newBusinesses: [], patches: {}, newBulletins: [], newEvents: [] };

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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "listing"
  );
}

const AUTH_KEY = "rc.auth.user";

export class MockDataSource implements DataSource {
  private overlay: Overlay;
  private authUser: AuthUser | null;
  private authListeners = new Set<(u: AuthUser | null) => void>();

  constructor() {
    this.overlay = this.loadOverlay();
    this.authUser = this.loadAuthUser();
  }

  private loadAuthUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private setAuthUser(u: AuthUser | null) {
    this.authUser = u;
    try {
      if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
      else localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    this.authListeners.forEach((cb) => cb(u));
  }

  private loadOverlay(): Overlay {
    try {
      const raw = localStorage.getItem(OVERLAY_KEY);
      return raw ? { ...EMPTY_OVERLAY, ...JSON.parse(raw) } : { ...EMPTY_OVERLAY };
    } catch {
      return { ...EMPTY_OVERLAY };
    }
  }

  private persist() {
    try {
      localStorage.setItem(OVERLAY_KEY, JSON.stringify(this.overlay));
    } catch {
      /* ignore quota/availability */
    }
  }

  // ---- merged views (seed + overlay) ----
  private applyPatch(b: Business): Business {
    const p = this.overlay.patches[b.id];
    return p ? { ...b, ...p } : b;
  }
  private businessList(): Business[] {
    return [...baseBusinesses, ...this.overlay.newBusinesses].map((b) => this.applyPatch(b));
  }
  private bulletinList(): Bulletin[] {
    return [...baseBulletins, ...this.overlay.newBulletins];
  }
  private eventList(): EventItem[] {
    return [...baseEvents, ...this.overlay.newEvents];
  }

  private uniqueSlug(name: string): string {
    const base = slugify(name);
    const taken = new Set(this.businessList().map((b) => b.slug));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  // ---- Businesses ----
  async listBusinesses(query: BusinessQuery = {}): Promise<Paged<Business>> {
    const origin = query.origin ?? REDMOND_CENTER;
    let items = this.businessList();

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
    return delay(this.businessList().find((b) => b.slug === slug) ?? null);
  }

  async getBusinessById(id: ID): Promise<Business | null> {
    return delay(this.businessList().find((b) => b.id === id) ?? null);
  }

  async listCategories(): Promise<CategoryCount[]> {
    const list = this.businessList();
    const counts: CategoryCount[] = TOP_CATEGORIES.map((c) => ({
      slug: c.slug,
      label: c.label,
      count: c.slug === "more" ? 0 : list.filter((b) => topCategoryFor(b.category) === c.slug).length,
    }));
    return delay(counts);
  }

  // ---- Bulletins ----
  async listBulletins(
    params: { businessId?: ID; limit?: number; status?: "live" | "all" } = {},
  ): Promise<Bulletin[]> {
    let items = this.bulletinList();
    if (params.status !== "all") items = items.filter((b) => b.status === "live");
    if (params.businessId) items = items.filter((b) => b.businessId === params.businessId);
    items = items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (params.limit != null) items = items.slice(0, params.limit);
    return delay(items);
  }

  async countBulletinsThisMonth(businessId: ID): Promise<number> {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const n = this.bulletinList().filter(
      (b) => b.businessId === businessId && b.createdAt.slice(0, 7) === ym,
    ).length;
    return delay(n);
  }

  // ---- Events ----
  async listEvents(query: EventQuery = {}): Promise<EventItem[]> {
    let items = this.eventList();
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
    return delay(this.eventList().find((e) => e.id === id) ?? null);
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
      for (const b of this.businessList()) if (textMatch(b, term)) out.push({ type: "business", item: b });
    }
    if (types.includes("event")) {
      for (const e of this.eventList()) {
        if (e.title.toLowerCase().includes(term) || (e.category ?? "").toLowerCase().includes(term))
          out.push({ type: "event", item: e });
      }
    }
    if (types.includes("bulletin")) {
      for (const bl of this.bulletinList()) {
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
    const b = this.businessList().find((x) => x.id === businessId);
    return delay({ count: b?.recommendCount ?? 0, recent: [] });
  }

  // ---- Session ----
  async getCurrentUser(): Promise<User | null> {
    if (!this.authUser) return delay(null);
    return delay({
      id: this.authUser.id,
      email: this.authUser.email,
      name: this.authUser.name,
      role: "resident",
      interests: [],
      savedBusinessIds: [],
      followedBusinessIds: [],
      savedEventIds: [],
      recentlyViewedIds: [],
      notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false },
    });
  }

  // ---- Auth (mock: instant sign-in, no OTP — keeps dev frictionless) ----
  async startEmailAuth(email: string, name?: string): Promise<StartAuthResult> {
    const clean = email.trim();
    const user: AuthUser = {
      id: `u_${clean.toLowerCase()}`,
      email: clean,
      name: name?.trim() || clean.split("@")[0],
    };
    this.setAuthUser(user);
    return delay({ otpSent: false, user });
  }

  async verifyEmailOtp(email: string, _token: string): Promise<AuthUser> {
    // mock has no real OTP; if somehow called, just sign in.
    void _token;
    const res = await this.startEmailAuth(email);
    return res.user!;
  }

  async signInWithOAuth(provider: OAuthProvider, _redirectTo?: string): Promise<{ redirected: boolean }> {
    // mock has no real OAuth — sign in instantly (no redirect) so dev keeps flowing.
    void _redirectTo;
    const user: AuthUser = {
      id: `u_${provider}_demo`,
      email: `demo@${provider}.dev`,
      name: provider === "google" ? "Google User" : "Demo User",
    };
    this.setAuthUser(user);
    return { redirected: false };
  }

  async signOut(): Promise<void> {
    this.setAuthUser(null);
  }

  async getAuthUser(): Promise<AuthUser | null> {
    return this.authUser;
  }

  onAuthChange(cb: (u: AuthUser | null) => void): () => void {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }

  // ---- Profile (mock keeps prefs local in the session; no server row) ----
  async getProfile(): Promise<Partial<PersistedProfile> | null> {
    return null;
  }

  async saveProfile(_patch: Partial<PersistedProfile>): Promise<void> {
    void _patch; // mock persists prefs via the session's own localStorage
  }

  // ---- Owner writes (step 7) ----
  async createBusiness(input: NewBusinessInput): Promise<Business> {
    const id = `b_${Date.now().toString(36)}`;
    const biz: Business = {
      id,
      name: input.name,
      slug: this.uniqueSlug(input.name),
      category: input.category,
      subcategories: input.subcategories ?? [],
      description: input.description ?? "",
      address: input.address,
      geo: input.geo ?? REDMOND_CENTER,
      phone: input.phone,
      website: input.website,
      email: input.email,
      hours: input.hours,
      photos: [],
      amenityTags: input.amenityTags ?? [],
      claimed: true,
      verified: false, // new listings start unverified; "claimed & verified" is earned
      ownerId: input.ownerId,
      tier: "free",
      createdAt: new Date().toISOString(),
    };
    this.overlay.newBusinesses.push(biz);
    this.persist();
    return delay(biz);
  }

  async updateBusiness(id: ID, patch: Partial<Business>): Promise<Business> {
    const created = this.overlay.newBusinesses.find((b) => b.id === id);
    if (created) Object.assign(created, patch);
    else this.overlay.patches[id] = { ...this.overlay.patches[id], ...patch };
    this.persist();
    const updated = this.businessList().find((b) => b.id === id);
    if (!updated) throw new Error(`Business ${id} not found`);
    return delay(updated);
  }

  async claimBusiness(id: ID, ownerId: ID): Promise<Business> {
    return this.updateBusiness(id, { claimed: true, ownerId });
  }

  async createBulletin(input: NewBulletinInput): Promise<Bulletin> {
    const bulletin: Bulletin = {
      id: `bl_${Date.now().toString(36)}`,
      businessId: input.businessId,
      body: input.body,
      linkCta: input.linkCta,
      scheduledFor: input.scheduledFor,
      status: input.status ?? (input.scheduledFor ? "scheduled" : "live"),
      createdAt: new Date().toISOString(),
    };
    this.overlay.newBulletins.push(bulletin);
    this.persist();
    return delay(bulletin);
  }

  async createEvent(input: NewEventInput): Promise<EventItem> {
    const event: EventItem = {
      id: `e_${Date.now().toString(36)}`,
      businessId: input.businessId,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      venueName: input.venueName,
      address: input.address,
      geo: input.geo,
      description: input.description,
      category: input.category,
      tags: input.tags,
      status: "upcoming",
    };
    this.overlay.newEvents.push(event);
    this.persist();
    return delay(event);
  }
}
