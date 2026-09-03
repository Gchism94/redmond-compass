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
  BusinessClass,
  CommunityNotice,
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
import { redmondDateYmd } from "@/lib/format";
import { topCategoryFor, tallyByTile } from "@/lib/taxonomy";
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
  BulletinPatch,
  EventPatch,
  NewBusinessClassInput,
  BusinessClassPatch,
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
  businessClasses,
  communityNotices,
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
  bulletinPatches: Record<string, BulletinPatch>;
  deletedBulletinIds: string[];
  newEvents: EventItem[];
  eventPatches: Record<string, EventPatch>;
  deletedEventIds: string[];
  newBusinessClasses: BusinessClass[];
  businessClassPatches: Record<string, BusinessClassPatch>;
  deletedBusinessClassIds: string[];
  /** business ids the current (mock) user has recommended — positive-only */
  recommendedBusinessIds: string[];
}

const EMPTY_OVERLAY: Overlay = {
  newBusinesses: [],
  patches: {},
  newBulletins: [],
  bulletinPatches: {},
  deletedBulletinIds: [],
  newEvents: [],
  eventPatches: {},
  deletedEventIds: [],
  newBusinessClasses: [],
  businessClassPatches: {},
  deletedBusinessClassIds: [],
  recommendedBusinessIds: [],
};

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
    const deleted = new Set(this.overlay.deletedBulletinIds);
    const now = Date.now();
    return [...baseBulletins, ...this.overlay.newBulletins]
      .filter((item) => !deleted.has(item.id))
      .map((item) => ({ ...item, ...(this.overlay.bulletinPatches[item.id] ?? {}) }))
      .map((item) =>
        item.status === "scheduled" && item.scheduledFor && +new Date(item.scheduledFor) <= now
          ? { ...item, status: "live" as const }
          : item,
      );
  }
  private eventList(): EventItem[] {
    const deleted = new Set(this.overlay.deletedEventIds);
    return [...baseEvents, ...this.overlay.newEvents]
      .filter((item) => !deleted.has(item.id))
      .map((item) => ({ ...item, ...(this.overlay.eventPatches[item.id] ?? {}) }));
  }
  private businessClassList(): BusinessClass[] {
    const deleted = new Set(this.overlay.deletedBusinessClassIds);
    return [...businessClasses, ...this.overlay.newBusinessClasses]
      .filter((item) => !deleted.has(item.id))
      .map((item) => ({ ...item, ...(this.overlay.businessClassPatches[item.id] ?? {}) }));
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
    // No "more" exemption: topCategoryFor() returns "more" for anything unplaced, so the
    // catch-all filters to its real members instead of falling through to every business.
    if (query.categorySlug) {
      items = items.filter((b) => topCategoryFor(b.category) === query.categorySlug);
    }
    if (query.amenityTags?.length) {
      items = items.filter((b) => query.amenityTags!.every((t) => b.amenityTags.includes(t)));
    }
    if (query.claimed != null) items = items.filter((b) => b.claimed === query.claimed);
    if (query.openNow) items = items.filter((b) => getOpenStatus(b.hours).open);
    if (query.maxDistanceMi != null) {
      items = items.filter(
        (b) => b.hasPreciseLocation !== false && distanceMiles(origin, b.geo) <= query.maxDistanceMi!,
      );
    }

    items = this.sortBusinesses(items, query.sort ?? "relevance", origin);

    const total = items.length;
    const offset = query.offset ?? 0;
    if (query.limit != null) items = items.slice(offset, offset + query.limit);
    return delay({ items, total });
  }

  private sortBusinesses(items: Business[], sort: BusinessQuery["sort"], origin = REDMOND_CENTER) {
    const by = [...items];
    const distance = (business: Business) =>
      business.hasPreciseLocation === false ? Number.POSITIVE_INFINITY : distanceMiles(origin, business.geo);
    const byDistanceThenName = (a: Business, b: Business) =>
      distance(a) - distance(b) || a.name.localeCompare(b.name);
    switch (sort) {
      case "distance":
        return by.sort(byDistanceThenName);
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
          return byDistanceThenName(a, b);
        });
    }
  }

  async listBusinessesByIds(ids: ID[]): Promise<Business[]> {
    const want = new Set(ids.filter(Boolean));
    if (!want.size) return delay([]);
    // No page cap by design — the caller holds the id list, so the result is already bounded
    // by it. Order is deliberately NOT the caller's id order (matching the real source, whose
    // `in` query gives no ordering guarantee), so a screen that needs an order must impose it.
    return delay(this.businessList().filter((b) => want.has(b.id)));
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    return delay(this.businessList().find((b) => b.slug === slug) ?? null);
  }

  async getBusinessById(id: ID): Promise<Business | null> {
    return delay(this.businessList().find((b) => b.id === id) ?? null);
  }

  async listCategories(): Promise<CategoryCount[]> {
    const counts: CategoryCount[] = tallyByTile(this.businessList().map((b) => b.category));
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

  async listCommunityNotices(): Promise<CommunityNotice[]> {
    const items = [...communityNotices].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    return delay(items);
  }

  async listBusinessClasses(businessId: ID): Promise<BusinessClass[]> {
    // Mirrors the Supabase implementation: upcoming only (calendar-day, so a class today
    // still counts), soonest first. "Today" is Redmond's day, not the viewer's: an
    // out-of-state visitor must not lose tonight's class because midnight passed there.
    const ymd = redmondDateYmd();
    const items = this.businessClassList()
      .filter((c) => c.businessId === businessId && c.date >= ymd && c.status !== "cancelled")
      .sort((a, b) => a.date.localeCompare(b.date));
    return delay(items);
  }

  async listManagedBusinessClasses(businessId: ID): Promise<BusinessClass[]> {
    return delay(
      this.businessClassList()
        .filter((item) => item.businessId === businessId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  }

  async countBulletinsThisMonth(businessId: ID): Promise<number> {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const n = this.bulletinList().filter((b) => {
      const effectiveMonth = (b.scheduledFor ?? b.createdAt).slice(0, 7);
      return b.businessId === businessId && effectiveMonth === ym && b.status !== "draft";
    }).length;
    return delay(n);
  }

  // ---- Events ----
  async listEvents(query: EventQuery = {}): Promise<EventItem[]> {
    let items = this.eventList();
    if (query.businessId) items = items.filter((e) => e.businessId === query.businessId);
    if (!query.includePast) {
      const now = Date.now();
      items = items.filter((e) => +new Date(e.endAt ?? e.startAt) >= now && e.status === "upcoming");
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
        if (e.status === "upcoming" && (e.title.toLowerCase().includes(term) || (e.category ?? "").toLowerCase().includes(term)))
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

  // ---- Reputation (positive-only count; never a rating) ----
  async getRecommendations(businessId: ID): Promise<{ count: number; recent: Recommendation[] }> {
    const b = this.businessList().find((x) => x.id === businessId);
    const mine = this.overlay.recommendedBusinessIds.includes(businessId) ? 1 : 0;
    return delay({ count: (b?.recommendCount ?? 0) + mine, recent: [] });
  }

  async recommend(businessId: ID): Promise<void> {
    if (!this.authUser) throw new Error("Sign in to recommend");
    if (!this.overlay.recommendedBusinessIds.includes(businessId)) {
      this.overlay.recommendedBusinessIds.push(businessId); // idempotent, positive-only
      this.persist();
    }
    return delay(undefined);
  }

  async hasRecommended(businessId: ID): Promise<boolean> {
    return delay(!!this.authUser && this.overlay.recommendedBusinessIds.includes(businessId));
  }

  // ---- Session ----
  async getCurrentUser(): Promise<User | null> {
    if (!this.authUser) return delay(null);
    return delay({
      id: this.authUser.id,
      email: this.authUser.email,
      name: this.authUser.name,
      role: "resident",
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

  async deleteAccount(): Promise<void> {
    // no server in dev — just sign out; the session wipes local prefs.
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
    if (!this.authUser) throw new Error("Sign in before creating a business listing.");
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
      hasPreciseLocation: !!input.geo,
      phone: input.phone,
      website: input.website,
      email: input.email,
      hours: input.hours,
      photos: [],
      amenityTags: input.amenityTags ?? [],
      claimed: true,
      verified: false, // new listings start unverified; "claimed & verified" is earned
      ownerId: this.authUser.id,
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

  async claimBusiness(id: ID): Promise<Business> {
    if (!this.authUser) throw new Error("Sign in before claiming a business listing.");
    return this.updateBusiness(id, { claimed: true, ownerId: this.authUser.id });
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

  async updateBulletin(id: ID, patch: BulletinPatch): Promise<Bulletin> {
    const current = this.bulletinList().find((item) => item.id === id);
    if (!current) throw new Error(`Bulletin ${id} not found`);
    this.overlay.bulletinPatches[id] = { ...(this.overlay.bulletinPatches[id] ?? {}), ...patch };
    this.persist();
    return delay({ ...current, ...patch });
  }

  async deleteBulletin(id: ID): Promise<void> {
    if (!this.bulletinList().some((item) => item.id === id)) throw new Error(`Bulletin ${id} not found`);
    this.overlay.deletedBulletinIds = [...new Set([...this.overlay.deletedBulletinIds, id])];
    this.persist();
    return delay(undefined);
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

  async updateEvent(id: ID, patch: EventPatch): Promise<EventItem> {
    const current = this.eventList().find((item) => item.id === id);
    if (!current) throw new Error(`Event ${id} not found`);
    if (current.gcalEventId) throw new Error("Calendar-managed events are read-only");
    this.overlay.eventPatches[id] = { ...(this.overlay.eventPatches[id] ?? {}), ...patch };
    this.persist();
    return delay({ ...current, ...patch });
  }

  async deleteEvent(id: ID): Promise<void> {
    const current = this.eventList().find((item) => item.id === id);
    if (!current) throw new Error(`Event ${id} not found`);
    if (current.gcalEventId) throw new Error("Calendar-managed events are read-only");
    this.overlay.deletedEventIds = [...new Set([...this.overlay.deletedEventIds, id])];
    this.persist();
    return delay(undefined);
  }

  async createBusinessClass(input: NewBusinessClassInput): Promise<BusinessClass> {
    const item: BusinessClass = {
      id: `bc_${Date.now().toString(36)}`,
      businessId: input.businessId,
      title: input.title,
      date: input.date,
      timeText: input.timeText,
      location: input.location,
      description: input.description,
      link: input.link,
      status: input.status ?? "open",
      createdAt: new Date().toISOString(),
    };
    this.overlay.newBusinessClasses.push(item);
    this.persist();
    return delay(item);
  }

  async updateBusinessClass(id: ID, patch: BusinessClassPatch): Promise<BusinessClass> {
    const current = this.businessClassList().find((item) => item.id === id);
    if (!current) throw new Error(`Business class ${id} not found`);
    this.overlay.businessClassPatches[id] = {
      ...(this.overlay.businessClassPatches[id] ?? {}),
      ...patch,
    };
    this.persist();
    return delay({ ...current, ...patch });
  }

  async deleteBusinessClass(id: ID): Promise<void> {
    if (!this.businessClassList().some((item) => item.id === id))
      throw new Error(`Business class ${id} not found`);
    this.overlay.deletedBusinessClassIds = [
      ...new Set([...this.overlay.deletedBusinessClassIds, id]),
    ];
    this.persist();
    return delay(undefined);
  }
}
