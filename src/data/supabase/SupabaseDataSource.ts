/**
 * Supabase implementation of the DataSource contract (DATA-SOURCE.md path B).
 * The app reads only from Supabase. Category/amenity filters run in Postgres; the
 * open-now / distance / sort pass runs client-side (parity with the mock) — and
 * crucially there is NO boost/featured column to order by, so ranking is structurally
 * equal: relevance (verified, then nearer) / distance / name / recency only.
 */
import type {
  Business,
  BusinessClass,
  CommunityNotice,
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
import { topCategoryFor, categoryValuesFor, tallyByTile } from "@/lib/taxonomy";
import { eventStartToUtc } from "@/lib/calendar";
import { redmondDateYmd } from "@/lib/format";
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
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
import { rowToBusiness, rowToBulletin,
  rowToBusinessClass,
  rowToCommunityNotice, rowToEvent, rowToNews, rowToResource } from "./mappers";

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
      // categoryValuesFor, NOT `.includes` — the stored value may be the Sheet's slug-case
      // spelling ("food-drink") rather than the display one ("Food & Drink"). Filtering on
      // `.includes` alone emptied every browse tile after the first Sheet sync.
      const values = categoryValuesFor(query.categorySlug);
      qb = qb.in("category", values.length ? values : ["__none__"]);
    }
    if (query.amenityTags?.length) qb = qb.contains("amenity_tags", query.amenityTags);
    if (query.claimed != null) qb = qb.eq("claimed", query.claimed);

    const { data, error } = await qb;
    if (error) throw error;
    let items = (data ?? []).map(rowToBusiness);

    // The catch-all is a COMPLEMENT, so it can't be a server-side `.in(...)` like the other
    // tiles — it has to catch values the app has never seen. Filtered here, next to the
    // other predicates that can't be pushed down, rather than as a `not.in` list that would
    // have to hand-quote every value containing "&" or a space.
    if (query.categorySlug === "more")
      items = items.filter((b) => topCategoryFor(b.category) === "more");

    if (query.text) items = items.filter((b) => textMatch(b, query.text!));
    if (query.openNow) items = items.filter((b) => getOpenStatus(b.hours).open);
    if (query.maxDistanceMi != null)
      items = items.filter(
        (b) => b.hasPreciseLocation !== false && distanceMiles(origin, b.geo) <= query.maxDistanceMi!,
      );

    items = this.sortBusinesses(items, query.sort ?? "relevance", origin);

    const total = items.length;
    const offset = query.offset ?? 0;
    if (query.limit != null) items = items.slice(offset, offset + query.limit);
    return { items, total };
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
        // relevance: verified first, then nearer. NO paid boost (no such column exists).
        return by.sort((a, b) => {
          if (a.verified !== b.verified) return Number(b.verified) - Number(a.verified);
          return byDistanceThenName(a, b);
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

  async listBusinessesByIds(ids: ID[]): Promise<Business[]> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return []; // no round-trip for an empty list
    // Chunked so a long id list can't blow the URL length limit on the GET PostgREST
    // builds — a heavy saver with hundreds of saves still resolves in a few requests.
    const CHUNK = 100;
    const out: Business[] = [];
    for (let i = 0; i < unique.length; i += CHUNK) {
      const { data, error } = await this.sb
        .from("businesses")
        .select("*")
        .in("id", unique.slice(i, i + CHUNK));
      if (error) throw error;
      out.push(...(data ?? []).map(rowToBusiness));
    }
    return out;
  }

  async listCategories(): Promise<CategoryCount[]> {
    const { data, error } = await this.sb.from("businesses").select("category");
    if (error) throw error;
    return tallyByTile((data ?? []).map((r: { category: string }) => r.category));
  }

  // ---- Bulletins ----
  async listBulletins(
    params: { businessId?: ID; limit?: number; status?: "live" | "all" } = {},
  ): Promise<Bulletin[]> {
    // Publishing is demand-driven: the first reader after a scheduled time promotes due
    // posts before fetching. The RPC is idempotent and only touches already-due rows.
    const { error: publishError } = await this.sb.rpc("publish_due_bulletins");
    if (publishError) throw publishError;
    let qb = this.sb.from("bulletins").select("*").order("created_at", { ascending: false });
    if (params.status !== "all") qb = qb.eq("status", "live");
    if (params.businessId) qb = qb.eq("business_id", params.businessId);
    if (params.limit != null) qb = qb.limit(params.limit);
    const { data, error } = await qb;
    if (error) throw error;
    return (data ?? []).map(rowToBulletin);
  }

  async listCommunityNotices(): Promise<CommunityNotice[]> {
    // Pinned first, then newest. Ordered in SQL so both data sources agree, and so the
    // ordering is a data property rather than something a screen could quietly change.
    //
    // No staleness filter, deliberately. One row is not enough to invent a cutoff from and
    // any cutoff would be wrong for the next notice — a road closure is stale in a week, a
    // memorial never is. A visibly-dated notice lets the reader judge; a magic number in
    // here would make that judgement for them, wrongly. The stale row is a content fix.
    const { data, error } = await this.sb
      .from("community_bulletins")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToCommunityNotice);
  }

  async listBusinessClasses(businessId: ID): Promise<BusinessClass[]> {
    // UPCOMING only, soonest first. `date` is a plain `date` column, so the comparison is a
    // calendar-day one — a class happening TODAY is still upcoming, which `>= today` gets
    // right and a timestamp comparison against `now()` would silently drop by mid-morning.
    // The app is hyperlocal even when the viewer is not. At 11:30 PM in Redmond it is
    // already tomorrow on the East Coast; filtering by the viewer's day would drop a class
    // that is still happening today in Redmond.
    const ymd = redmondDateYmd();
    const { data, error } = await this.sb
      .from("business_classes")
      .select("*")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("date", ymd)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToBusinessClass);
  }

  async listManagedBusinessClasses(businessId: ID): Promise<BusinessClass[]> {
    // RLS makes cancelled rows visible only to this business's owner. No status/date
    // predicate here: the management screen needs a complete audit trail.
    const { data, error } = await this.sb
      .from("business_classes")
      .select("*")
      .eq("business_id", businessId)
      .order("date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToBusinessClass);
  }

  async countBulletinsThisMonth(businessId: ID): Promise<number> {
    const ym = redmondDateYmd().slice(0, 7);
    const { data, error } = await this.sb
      .from("bulletins")
      .select("created_at,scheduled_for,status")
      .eq("business_id", businessId)
      .in("status", ["live", "scheduled", "expired"]);
    if (error) throw error;
    return (data ?? []).filter((row) => (row.scheduled_for ?? row.created_at).slice(0, 7) === ym).length;
  }

  // ---- Events ----
  async listEvents(query: EventQuery = {}): Promise<EventItem[]> {
    let qb = this.sb.from("events").select("*").order("start_at", { ascending: true });
    if (query.businessId) qb = qb.eq("business_id", query.businessId);
    if (query.category) qb = qb.eq("category", query.category);
    if (query.from) qb = qb.gte("start_at", query.from);
    if (query.to) qb = qb.lte("start_at", query.to);
    if (!query.includePast) qb = qb.eq("status", "upcoming");
    const { data, error } = await qb;
    if (error) throw error;
    let items = (data ?? []).map(rowToEvent);
    if (!query.includePast) {
      const now = Date.now();
      items = items.filter((e) => +new Date(e.endAt ?? e.startAt) >= now && e.status === "upcoming");
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
      const { data } = await this.sb.from("events").select("*").eq("status", "upcoming").ilike("title", like);
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
    // owned listings, deletes the profile, and deletes the auth user — in that order,
    // refusing the irreversible step unless the earlier ones are verified done.
    const { data, error } = await this.sb.functions.invoke("delete-account", { method: "POST" });
    if (error) {
      // On a non-2xx, invoke() reports only "Edge Function returned a non-2xx status
      // code" and puts the real body on error.context. Read it, so which step failed and
      // whether it's resumable is diagnosable from the browser and not just from the
      // function logs.
      let detail = error.message ?? "Account deletion failed";
      try {
        const ctx = (error as { context?: Response }).context;
        const body = ctx ? await ctx.clone().json() : null;
        if (body?.error) {
          detail = body.failedStep ? `${body.error} (failed at: ${body.failedStep})` : body.error;
        }
      } catch {
        /* body wasn't JSON — keep the generic message */
      }
      throw new Error(detail);
    }
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
    const ownerId = u.user?.id;
    if (!ownerId) throw new Error("Sign in before creating a business listing.");
    const { data, error } = await this.sb
      .from("businesses")
      .insert({
        name: input.name,
        slug: this.slugify(input.name),
        category: input.category,
        subcategories: input.subcategories ?? [],
        description: input.description ?? "",
        address: input.address,
        // No geocoder runs in this form. NULL is more accurate than silently pinning a new
        // business to Redmond's center and then presenting that synthetic point as nearby.
        lat: input.geo?.lat ?? null,
        lng: input.geo?.lng ?? null,
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

  async claimBusiness(id: ID): Promise<Business> {
    // Ownership is taken from auth.uid() inside the RPC; never trust a client-supplied id.
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

  async updateBulletin(id: ID, patch: BulletinPatch): Promise<Bulletin> {
    const row: Record<string, unknown> = {};
    const columns: Record<keyof BulletinPatch, string> = {
      body: "body",
      linkCta: "link_cta",
      scheduledFor: "scheduled_for",
      status: "status",
    };
    for (const [key, column] of Object.entries(columns)) {
      if (key in patch) row[column] = patch[key as keyof BulletinPatch] ?? null;
    }
    const { data, error } = await this.sb.from("bulletins").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return rowToBulletin(data);
  }

  async deleteBulletin(id: ID): Promise<void> {
    const { error } = await this.sb.from("bulletins").delete().eq("id", id).select("id").single();
    if (error) throw error;
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

  async updateEvent(id: ID, patch: EventPatch): Promise<EventItem> {
    const row: Record<string, unknown> = {};
    const columns: Record<Exclude<keyof EventPatch, "geo">, string> = {
      title: "title",
      startAt: "start_at",
      endAt: "end_at",
      venueName: "venue_name",
      address: "address",
      description: "description",
      category: "category",
      tags: "tags",
      status: "status",
    };
    for (const [key, column] of Object.entries(columns)) {
      if (!(key in patch)) continue;
      const value = patch[key as Exclude<keyof EventPatch, "geo">];
      row[column] = (key === "startAt" || key === "endAt") && value
        ? eventStartToUtc(value as string).toISOString()
        : value ?? null;
    }
    if ("geo" in patch) {
      row.lat = patch.geo?.lat ?? null;
      row.lng = patch.geo?.lng ?? null;
    }
    const { data, error } = await this.sb.from("events").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return rowToEvent(data);
  }

  async deleteEvent(id: ID): Promise<void> {
    const { error } = await this.sb.from("events").delete().eq("id", id).select("id").single();
    if (error) throw error;
  }

  async createBusinessClass(input: NewBusinessClassInput): Promise<BusinessClass> {
    const { data, error } = await this.sb
      .from("business_classes")
      .insert({
        business_id: input.businessId,
        title: input.title,
        date: input.date,
        time_text: input.timeText ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
        link: input.link ?? null,
        status: input.status ?? "open",
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToBusinessClass(data);
  }

  async updateBusinessClass(id: ID, patch: BusinessClassPatch): Promise<BusinessClass> {
    const row: Record<string, unknown> = {};
    const columns: Record<keyof BusinessClassPatch, string> = {
      title: "title",
      date: "date",
      timeText: "time_text",
      location: "location",
      description: "description",
      link: "link",
      status: "status",
    };
    for (const [key, column] of Object.entries(columns)) {
      if (key in patch) row[column] = patch[key as keyof BusinessClassPatch] ?? null;
    }
    const { data, error } = await this.sb
      .from("business_classes")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToBusinessClass(data);
  }

  async deleteBusinessClass(id: ID): Promise<void> {
    // Selecting the deleted id makes a 0-row RLS denial observable instead of reporting a
    // misleading success while the entry remains in the database.
    const { error } = await this.sb
      .from("business_classes")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
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
