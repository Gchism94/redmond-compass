/**
 * Redmond Compass — the swappable data-access contract (BUILD-BRIEF §2, §5, §12 step 4).
 *
 * Everything in the app reads/writes through this interface. The MVP ships a
 * MockDataSource; the real backend (base44 API vs a shared Supabase) is an
 * undecided open question (§14) — when chosen it implements THIS interface and
 * nothing in features/ or components/ changes. Do not import a concrete source
 * anywhere but src/data/source.ts.
 *
 * Conventions:
 *  - All methods are async (a real backend is over the network).
 *  - Filtering/sorting params are descriptive, not SQL — the implementation maps
 *    them to its own query mechanism (in-memory for mock; RLS/REST/SQL for real).
 *  - Distance + open-now depend on "now" and the user's origin, passed in by the
 *    caller so the source stays deterministic and testable.
 */
import type {
  Business,
  Bulletin,
  EventItem,
  Hours,
  NewsArticle,
  Resource,
  ResourceCategory,
  Recommendation,
  SearchResult,
  SearchResultType,
  GeoPoint,
  User,
  ID,
} from "@/lib/types";

/** Owner-path write inputs (BUILD-BRIEF §12 step 7). */
export interface NewBusinessInput {
  name: string;
  category: string;
  address: string;
  geo?: GeoPoint;
  description?: string;
  phone?: string;
  website?: string;
  email?: string;
  subcategories?: string[];
  amenityTags?: string[];
  hours?: Hours;
  ownerId?: ID;
}

export interface NewBulletinInput {
  businessId: ID;
  body: string;
  linkCta?: { label: string; url: string };
  scheduledFor?: string;
  status?: Bulletin["status"];
}

export interface NewEventInput {
  businessId?: ID;
  title: string;
  startAt: string;
  endAt?: string;
  venueName?: string;
  address?: string;
  geo?: GeoPoint;
  description?: string;
  category?: string;
  tags?: string[];
}

/** Lightweight authed identity (the session surface). */
export interface AuthUser {
  id: ID;
  email: string;
  name: string;
}

export type NotificationPrefs = User["notificationPrefs"];

/**
 * Per-user personalization persisted server-side (the `profiles` row in Supabase).
 * Mirrors the local-first guest profile so a guest's prefs MERGE in on first sign-in.
 */
export interface PersistedProfile {
  savedBusinessIds: ID[];
  followedBusinessIds: ID[];
  savedEventIds: ID[];
  recentlyViewedIds: ID[];
  interests: string[];
  notificationPrefs: NotificationPrefs;
  location: GeoPoint | null;
  onboarded: boolean;
  ownerBusinessId: ID | null;
}

/** Result of starting email sign-in: mock signs in instantly; Supabase emails an OTP. */
export interface StartAuthResult {
  /** true when a one-time code was emailed and verifyEmailOtp() is needed next */
  otpSent: boolean;
  /** present only when sign-in completed synchronously (mock) */
  user?: AuthUser;
}

/** OAuth providers we offer (extend as more are enabled in Supabase). */
export type OAuthProvider = "google";

export type BusinessSort = "relevance" | "distance" | "recommend" | "openNow" | "name";

export interface BusinessQuery {
  /** free-text match across name / description / category / amenity tags */
  text?: string;
  /** top-level category slug (see taxonomy.ts) */
  categorySlug?: string;
  /** amenity facets — AND semantics (must have all) */
  amenityTags?: string[];
  /** keep only businesses open at `now` */
  openNow?: boolean;
  /** origin for distance calc/sort; defaults to Redmond center if omitted */
  origin?: GeoPoint;
  /** drop results farther than this many miles from origin */
  maxDistanceMi?: number;
  sort?: BusinessSort;
  limit?: number;
  offset?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface EventQuery {
  businessId?: ID;
  /** include events that already started/ended */
  includePast?: boolean;
  /** ISO bounds */
  from?: string;
  to?: string;
  category?: string;
  text?: string;
  origin?: GeoPoint;
  limit?: number;
}

export interface SearchQuery {
  /** which content types to include; defaults to all */
  types?: SearchResultType[];
  origin?: GeoPoint;
  limit?: number;
}

export interface CategoryCount {
  slug: string;
  label: string;
  count: number;
}

/**
 * Read + write contract for all five content types (+ session seams).
 * MVP uses the read methods; write/session methods are seams for steps 6–7
 * (auth, saved/follow, owner path) — defined now so turning them on is wiring,
 * not an interface change.
 */
export interface DataSource {
  // ---- Businesses (the spine) ----
  listBusinesses(query?: BusinessQuery): Promise<Paged<Business>>;
  getBusinessBySlug(slug: string): Promise<Business | null>;
  getBusinessById(id: ID): Promise<Business | null>;
  /** category counts for the browse grid (S3) */
  listCategories(): Promise<CategoryCount[]>;

  // ---- Bulletins (business posts) ----
  listBulletins(params?: { businessId?: ID; limit?: number; status?: "live" | "all" }): Promise<Bulletin[]>;
  /** count toward the free monthly cap (all statuses, current month) */
  countBulletinsThisMonth(businessId: ID): Promise<number>;

  // ---- Events ----
  listEvents(query?: EventQuery): Promise<EventItem[]>;
  getEventById(id: ID): Promise<EventItem | null>;

  // ---- News (admin-published) ----
  listNews(params?: { limit?: number }): Promise<NewsArticle[]>;
  getNewsBySlug(slug: string): Promise<NewsArticle | null>;

  // ---- Resources (civic) ----
  listResources(params?: { category?: ResourceCategory; text?: string }): Promise<Resource[]>;

  // ---- Unified search (S3 autocomplete / S4 results) ----
  search(text: string, query?: SearchQuery): Promise<SearchResult[]>;

  // ---- Reputation (DEFERRED / fast-follow; positive-only, never a rating) ----
  /** Recommendation summary for a business. MVP returns count only; notes come fast-follow. */
  getRecommendations(businessId: ID): Promise<{ count: number; recent: Recommendation[] }>;

  // ---- Session & personalization (BUILD-BRIEF §12 step 6) ----
  /** Current resident, or null when browsing as a guest (the default at MVP). */
  getCurrentUser(): Promise<User | null>;

  // ---- Auth (JIT — real Supabase Auth; mock signs in instantly for dev) ----
  /** Begin email sign-in. Supabase emails a 6-digit OTP; mock returns the user inline. */
  startEmailAuth(email: string, name?: string): Promise<StartAuthResult>;
  /** Complete email sign-in with the emailed code (Supabase). */
  verifyEmailOtp(email: string, token: string): Promise<AuthUser>;
  /**
   * Begin OAuth sign-in. Supabase redirects the browser to the provider and back to
   * `redirectTo` (→ `redirected: true`, the page is navigating away); mock signs in
   * instantly (→ `redirected: false`). The session persists a pending intent first so a
   * save/follow completes after the round-trip.
   */
  signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<{ redirected: boolean }>;
  signOut(): Promise<void>;
  /** The current authed user from the live session (restored on reload), or null. */
  getAuthUser(): Promise<AuthUser | null>;
  /** Subscribe to auth changes (sign-in/out, token refresh). Returns an unsubscribe fn. */
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;

  // ---- Profile (prefs persistence — local-first, synced to the user row on sign-in) ----
  /** The signed-in user's persisted prefs, or null if none/guest. */
  getProfile(): Promise<Partial<PersistedProfile> | null>;
  /** Upsert the signed-in user's prefs (no-op for a guest). */
  saveProfile(patch: Partial<PersistedProfile>): Promise<void>;

  // ---- Owner writes (BUILD-BRIEF §12 step 7) ----
  /** List/claim a free listing (current-site parity fields). */
  createBusiness(input: NewBusinessInput): Promise<Business>;
  updateBusiness(id: ID, patch: Partial<Business>): Promise<Business>;
  /** Claim an existing (unclaimed) listing for an owner. */
  claimBusiness(id: ID, ownerId: ID): Promise<Business>;
  /** Post a bulletin (free monthly cap enforced in the UI, never destroys work). */
  createBulletin(input: NewBulletinInput): Promise<Bulletin>;
  /** Submit an event (free + uncapped for all tiers). */
  createEvent(input: NewEventInput): Promise<EventItem>;
}
