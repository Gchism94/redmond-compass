/**
 * Supabase implementation of the DataSource contract (DATA-SOURCE.md path B).
 * The app reads only from Supabase. Category/amenity filters run in Postgres; the
 * open-now / distance / sort pass runs client-side (parity with the mock) — and
 * crucially there is NO boost/featured column to order by, so ranking is structurally
 * equal: relevance (verified, then nearer) / distance / name / recency only.
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
import { eventStartToUtc } from "@/lib/calendar";
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
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
import { rowToBusiness, rowToBulletin, rowToEvent, rowToNews, rowToResource } from "./mappers";

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

class SupabaseDataSource implements DataSource {
  private sb = getSupabaseClient();

  // ---- Businesses ----
  async listBusinesses(query: BusinessQuery = {}): Promise<Paged<Business>> {
    const origin = query.origin ?? REDMOND_CENTER;
    let qb = this.sb.from("businesses").select("*");
    if (query.categorySlug && query.categorySlug !== "more") {
      const includes = TOP_CATEGORIES.find((c) => c.slug === query.categorySlug)?.includes ?? [];
      qb = qb.in("category", includes.length ? includes : ["__none__"]);
    }
    if (query.amenityTags?.length) qb = qb.contains("amenity_tags", query.amenityTags);

    const { data, error } = await qb;
    if (error) throw error;
    let items = (data ?? []).map(rowToBusiness);

    if (query.text) items = items.filter((b) => textMatch(b, query.text!));
    if (query.openNow) items = items.filter((b) => getOpenStatus(b.hours).open);
    if (query.maxDistanceMi != null)
      items = items.filter((b) => distanceMiles(origin, b.geo) <= query.maxDistanceMi!);

    items = this.sortBusinesses(items, query.sort ?? "relevance", origin);

    const total = items.length;
    const offset = query.offset ?? 0;
    if (query.limit != null) items = items.slice(offset, offset + query.limit);
    return { items, total };
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
        // relevance: verified first, then nearer. NO paid boost (no such column exists).
        return by.sort((a, b) => {
          if (a.verified !== b.verified) return Number(b.verified) - Number(a.verified);
          return distanceMiles(origin, a.geo) - distanceMiles(origin, b.geo);
        });
    }
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const { data, error } = await this.sb.from("businesses").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? rowToBusiness(data) : null;
  }

  async getBusinessById(id: ID): Promise<Business | null> {
    const { data, error } = await this.sb.from("businesses").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToBusiness(data) : null;
  }

  async listCategories(): Promise<CategoryCount[]> {
    const { data, error } = await this.sb.from("businesses").select("category");
    if (error) throw error;
    const cats = (data ?? []).map((r: { category: string }) => r.category);
    return TOP_CATEGORIES.map((c) => ({
      slug: c.slug,
      label: c.label,
      count: c.slug === "more" ? 0 : cats.filter((cat) => topCategoryFor(cat) === c.slug).length,
    }));
  }

  // ---- Bulletins ----
  async listBulletins(
    params: { businessId?: ID; limit?: number; status?: "live" | "all" } = {},
  ): Promise<Bulletin[]> {
    let qb = this.sb.from("bulletins").select("*").order("created_at", { ascending: false });
    if (params.status !== "all") qb = qb.eq("status", "live");
    if (params.businessId) qb = qb.eq("business_id", params.businessId);
    if (params.limit != null) qb = qb.limit(params.limit);
    const { data, error } = await qb;
    if (error) throw error;
    return (data ?? []).map(rowToBulletin);
  }

  async countBulletinsThisMonth(businessId: ID): Promise<number> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const { count, error } = await this.sb
      .from("bulletins")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", start.toISOString());
    if (error) throw error;
    return count ?? 0;
  }

  // ---- Events ----
  async listEvents(query: EventQuery = {}): Promise<EventItem[]> {
    let qb = this.sb.from("events").select("*").order("start_at", { ascending: true });
    if (query.businessId) qb = qb.eq("business_id", query.businessId);
    if (query.category) qb = qb.eq("category", query.category);
    if (query.from) qb = qb.gte("start_at", query.from);
    if (query.to) qb = qb.lte("start_at", query.to);
    const { data, error } = await qb;
    if (error) throw error;
    let items = (data ?? []).map(rowToEvent);
    if (!query.includePast) {
      const now = Date.now();
      items = items.filter((e) => +new Date(e.endAt ?? e.startAt) >= now && e.status !== "past");
    }
    if (query.text) {
      const t = query.text.toLowerCase();
      items = items.filter(
        (e) => e.title.toLowerCase().includes(t) || (e.venueName ?? "").toLowerCase().includes(t),
      );
    }
    if (query.limit != null) items = items.slice(0, query.limit);
    return items;
  }

  async getEventById(id: ID): Promise<EventItem | null> {
    const { data, error } = await this.sb.from("events").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToEvent(data) : null;
  }

  // ---- News ----
  async listNews(params: { limit?: number } = {}): Promise<NewsArticle[]> {
    let qb = this.sb.from("news_articles").select("*").order("published_at", { ascending: false });
    if (params.limit != null) qb = qb.limit(params.limit);
    const { data, error } = await qb;
    if (error) throw error;
    return (data ?? []).map(rowToNews);
  }

  async getNewsBySlug(slug: string): Promise<NewsArticle | null> {
    const { data, error } = await this.sb.from("news_articles").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? rowToNews(data) : null;
  }

  // ---- Resources ----
  async listResources(
    params: { category?: ResourceCategory; text?: string } = {},
  ): Promise<Resource[]> {
    let qb = this.sb.from("resources").select("*").order("name", { ascending: true });
    if (params.category) qb = qb.eq("category", params.category);
    const { data, error } = await qb;
    if (error) throw error;
    let items = (data ?? []).map(rowToResource);
    if (params.text) {
      const t = params.text.toLowerCase();
      items = items.filter(
        (r) => r.name.toLowerCase().includes(t) || r.description.toLowerCase().includes(t),
      );
    }
    return items;
  }

  // ---- Unified search (S3/S4) ----
  async search(text: string, query: SearchQuery = {}): Promise<SearchResult[]> {
    const term = text.trim();
    if (!term) return [];
    const types = query.types ?? ["business", "event", "bulletin", "news"];
    const like = `%${term.replace(/[%,()]/g, " ")}%`;
    const out: SearchResult[] = [];

    if (types.includes("business")) {
      const { data } = await this.sb.from("businesses").select("*");
      (data ?? []).map(rowToBusiness).forEach((b) => {
        if (textMatch(b, term)) out.push({ type: "business", item: b });
      });
    }
    if (types.includes("event")) {
      const { data } = await this.sb.from("events").select("*").ilike("title", like);
      (data ?? []).forEach((r) => out.push({ type: "event", item: rowToEvent(r) }));
    }
    if (types.includes("bulletin")) {
      const { data } = await this.sb.from("bulletins").select("*").eq("status", "live").ilike("body", like);
      (data ?? []).forEach((r) => out.push({ type: "bulletin", item: rowToBulletin(r) }));
    }
    if (types.includes("news")) {
      const { data } = await this.sb
        .from("news_articles")
        .select("*")
        .or(`title.ilike.${like},excerpt.ilike.${like}`);
      (data ?? []).forEach((r) => out.push({ type: "news", item: rowToNews(r) }));
    }
    return query.limit != null ? out.slice(0, query.limit) : out;
  }

  // ---- Reputation (positive-only count; never a rating) ----
  async getRecommendations(businessId: ID): Promise<{ count: number; recent: Recommendation[] }> {
    // The displayed count is the cached, positive-only `businesses.recommend_count`
    // (kept in sync by the bump trigger) — same field the mock + Business model use.
    const { data: biz } = await this.sb
      .from("businesses")
      .select("recommend_count")
      .eq("id", businessId)
      .maybeSingle();
    const { data } = await this.sb
      .from("recommendations")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5);
    const recent: Recommendation[] = (data ?? []).map((r) => ({
      id: r.id,
      businessId: r.business_id,
      userId: r.user_id,
      note: r.note ?? undefined,
      verifiedCustomer: !!r.verified_customer,
      createdAt: r.created_at,
    }));
    return { count: biz?.recommend_count ?? 0, recent };
  }

  async recommend(businessId: ID): Promise<void> {
    const { data: au } = await this.sb.auth.getUser();
    const uid = au.user?.id;
    if (!uid) throw new Error("Sign in to recommend");
    // insert-only; the unique(business_id,user_id) makes it idempotent (can't be bombed),
    // and the bump_recommend_count trigger raises the cached count. No value/rating column.
    const { error } = await this.sb
      .from("recommendations")
      .insert({ business_id: businessId, user_id: uid });
    if (error && error.code !== "23505") throw error; // 23505 = already recommended → no-op
  }

  async hasRecommended(businessId: ID): Promise<boolean> {
    const { data: au } = await this.sb.auth.getUser();
    const uid = au.user?.id;
    if (!uid) return false;
    const { count } = await this.sb
      .from("recommendations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("user_id", uid);
    return (count ?? 0) > 0;
  }

  // ---- Session ----
  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.sb.auth.getUser();
    const u = data.user;
    if (!u) return null;
    return {
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.name as string) ?? u.email?.split("@")[0] ?? "You",
      role: "resident",
      interests: [],
      savedBusinessIds: [],
      followedBusinessIds: [],
      savedEventIds: [],
      recentlyViewedIds: [],
      notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false },
    };
  }

  // ---- Auth (real Supabase Auth: passwordless email OTP — no redirect, so the
  //      pending JIT action completes in-place after the code is verified) ----
  private mapAuthUser(u: SupabaseAuthUser): AuthUser {
    return {
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.name as string) ?? u.email?.split("@")[0] ?? "You",
    };
  }

  async startEmailAuth(email: string, name?: string): Promise<StartAuthResult> {
    const { error } = await this.sb.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: name?.trim() ? { name: name.trim() } : undefined },
    });
    if (error) throw error;
    return { otpSent: true };
  }

  async verifyEmailOtp(email: string, token: string): Promise<AuthUser> {
    const { data, error } = await this.sb.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "email",
    });
    if (error) throw error;
    if (!data.user) throw new Error("Verification failed");
    return this.mapAuthUser(data.user);
  }

  async signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<{ redirected: boolean }> {
    // supabase-js navigates the browser to the provider; PKCE + detectSessionInUrl
    // (client.ts) complete the session on return to `redirectTo`.
    const { error } = await this.sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw error;
    return { redirected: true };
  }

  async signOut(): Promise<void> {
    const { error } = await this.sb.auth.signOut();
    if (error) throw error;
  }

  async deleteAccount(): Promise<void> {
    // supabase-js attaches the session JWT; the edge function verifies it, releases
    // owned listings, deletes the profile, and deletes the auth user.
    const { data, error } = await this.sb.functions.invoke("delete-account", { method: "POST" });
    if (error) throw new Error(error.message ?? "Account deletion failed");
    if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error);
    await this.sb.auth.signOut();
  }

  async getAuthUser(): Promise<AuthUser | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? this.mapAuthUser(u) : null;
  }

  onAuthChange(cb: (user: AuthUser | null) => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((_event, session) => {
      cb(session?.user ? this.mapAuthUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  // ---- Profile (prefs persisted to the user's `profiles` row; RLS = own row only) ----
  async getProfile(): Promise<Partial<PersistedProfile> | null> {
    const { data: au } = await this.sb.auth.getUser();
    const uid = au.user?.id;
    if (!uid) return null;
    const { data: row } = await this.sb.from("profiles").select("*").eq("id", uid).maybeSingle();
    // ownership source of truth is businesses.owner_id (not the cached column)
    const { data: owned } = await this.sb.from("businesses").select("id").eq("owner_id", uid).limit(1);
    const ownerBusinessId = owned?.[0]?.id ?? row?.owner_business_id ?? null;
    if (!row) return { ownerBusinessId };
    return {
      savedBusinessIds: row.saved_business_ids ?? [],
      followedBusinessIds: row.followed_business_ids ?? [],
      savedEventIds: row.saved_event_ids ?? [],
      recentlyViewedIds: row.recently_viewed_ids ?? [],
      interests: row.interests ?? [],
      notificationPrefs: row.notification_prefs ?? undefined,
      location: row.location ?? null,
      onboarded: row.onboarded ?? false,
      ownerBusinessId,
    };
  }

  async saveProfile(patch: Partial<PersistedProfile>): Promise<void> {
    const { data: au } = await this.sb.auth.getUser();
    const uid = au.user?.id;
    if (!uid) return; // guest — nothing to persist server-side
    const row: Record<string, unknown> = { id: uid };
    if ("savedBusinessIds" in patch) row.saved_business_ids = patch.savedBusinessIds;
    if ("followedBusinessIds" in patch) row.followed_business_ids = patch.followedBusinessIds;
    if ("savedEventIds" in patch) row.saved_event_ids = patch.savedEventIds;
    if ("recentlyViewedIds" in patch) row.recently_viewed_ids = patch.recentlyViewedIds;
    if ("interests" in patch) row.interests = patch.interests;
    if ("notificationPrefs" in patch) row.notification_prefs = patch.notificationPrefs;
    if ("location" in patch) row.location = patch.location;
    if ("onboarded" in patch) row.onboarded = patch.onboarded;
    if ("ownerBusinessId" in patch) row.owner_business_id = patch.ownerBusinessId;
    const { error } = await this.sb.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw error;
  }

  // ---- Owner writes (RLS enforces ownership + tier; needs a Supabase auth session) ----
  async createBusiness(input: NewBusinessInput): Promise<Business> {
    const { data: u } = await this.sb.auth.getUser();
    const ownerId = input.ownerId ?? u.user?.id;
    const { data, error } = await this.sb
      .from("businesses")
      .insert({
        name: input.name,
        slug: this.slugify(input.name),
        category: input.category,
        subcategories: input.subcategories ?? [],
        description: input.description ?? "",
        address: input.address,
        lat: input.geo?.lat ?? REDMOND_CENTER.lat,
        lng: input.geo?.lng ?? REDMOND_CENTER.lng,
        phone: input.phone,
        website: input.website,
        email: input.email,
        hours: input.hours ?? null,
        amenity_tags: input.amenityTags ?? [],
        claimed: true,
        verified: false,
        owner_id: ownerId,
        tier: "free",
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToBusiness(data);
  }

  async updateBusiness(id: ID, patch: Partial<Business>): Promise<Business> {
    const row: Record<string, unknown> = {};
    const map: Record<string, string> = {
      name: "name", slug: "slug", category: "category", subcategories: "subcategories",
      description: "description", address: "address", phone: "phone", website: "website",
      email: "email", hours: "hours", photos: "photos", amenityTags: "amenity_tags",
      verified: "verified", tier: "tier", story: "story", menu: "menu", ctas: "ctas",
      gallery: "gallery", ownerSpotlight: "owner_spotlight",
    };
    for (const [k, col] of Object.entries(map)) {
      if (k in patch) row[col] = (patch as Record<string, unknown>)[k];
    }
    if (patch.geo) {
      row.lat = patch.geo.lat;
      row.lng = patch.geo.lng;
    }
    const { data, error } = await this.sb.from("businesses").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return rowToBusiness(data);
  }

  async claimBusiness(id: ID, _ownerId: ID): Promise<Business> {
    void _ownerId; // ownership is taken from auth.uid() inside the RPC
    const { data, error } = await this.sb.rpc("claim_business", { b_id: id });
    if (error) throw error;
    return rowToBusiness(Array.isArray(data) ? data[0] : data);
  }

  async createBulletin(input: NewBulletinInput): Promise<Bulletin> {
    const { data, error } = await this.sb
      .from("bulletins")
      .insert({
        business_id: input.businessId,
        body: input.body,
        link_cta: input.linkCta ?? null,
        scheduled_for: input.scheduledFor ?? null,
        status: input.status ?? (input.scheduledFor ? "scheduled" : "live"),
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToBulletin(data);
  }

  async createEvent(input: NewEventInput): Promise<EventItem> {
    // Event times are naive Redmond/Pacific → store the true instant (timestamptz).
    const { data, error } = await this.sb
      .from("events")
      .insert({
        business_id: input.businessId ?? null,
        title: input.title,
        description: input.description ?? null,
        start_at: eventStartToUtc(input.startAt).toISOString(),
        end_at: input.endAt ? eventStartToUtc(input.endAt).toISOString() : null,
        venue_name: input.venueName ?? null,
        address: input.address ?? null,
        lat: input.geo?.lat ?? null,
        lng: input.geo?.lng ?? null,
        category: input.category ?? null,
        tags: input.tags ?? [],
        status: "upcoming",
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToEvent(data);
  }

  private slugify(name: string): string {
    return (
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "listing"
    ) + "-" + Math.random().toString(36).slice(2, 6);
  }
}

/** Factory (keeps the swap seam in src/data/source.ts). */
export function createSupabaseSource(): DataSource {
  return new SupabaseDataSource();
}
