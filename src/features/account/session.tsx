/**
 * Client session + personalization store (BUILD-BRIEF §12 step 6, §10).
 *
 * Local-first by design: onboarding prefs (location, notifications) and
 * recently-viewed work with NO account — stored in localStorage until/unless the user
 * signs in. Save / Follow / Save-event are local-first TOO: a guest's tap writes straight
 * to local state and is merged into their account on first sign-in. Only `recommend` (a
 * server write keyed to a user id) and the owner/claim flows raise the JIT AuthSheet.
 *
 * Auth is delegated to the DataSource (the swap seam): Supabase does real passwordless
 * email-OTP sign-in (the session carries the Supabase JWT, so authed reads/writes use
 * it); the mock signs in instantly for dev. On first sign-in the guest's local prefs are
 * MERGED into the user's server row so nothing they did as a guest is lost.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GeoPoint } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { useDataSource } from "@/data/DataProvider";
import type { AuthUser, PersistedProfile, OAuthProvider } from "@/data/DataSource";

export type SessionUser = AuthUser;

/**
 * Notification preferences — STORED BUT NOT EDITABLE (2026-08-14).
 *
 * The Account toggles were removed because nothing delivers: no VAPID keys, no
 * PushManager registration, no notification-sending Edge Function. A switch that
 * configures mail which cannot arrive is a promise the app does not keep.
 *
 * The model is kept ON PURPOSE, unlike `interests` which was deleted outright in the same
 * pass. The difference is that interests had a broken vocabulary — 6 of its 10 values
 * mapped to no browse tile, so it could not be wired up without being redesigned first,
 * and there was nothing worth preserving. These three keys have no such defect: they name
 * things the app already has (bulletins from followed businesses, saved events, local
 * news), and a delivery feature would reuse them verbatim.
 *
 * `notifChanged` below stays for the same reason. It is correct logic with no live input
 * right now — "prefer this device's explicit choice over another device's defaults".
 * Deleting it would mean whoever ships delivery has to re-derive it, and if they miss it,
 * one device's defaults silently overwrite another device's real settings. That is a bug
 * worth not planting.
 */
export interface NotificationPrefs {
  followedBulletins: boolean;
  savedEvents: boolean;
  localNews: boolean;
}

interface Profile {
  savedBusinessIds: string[];
  followedBusinessIds: string[];
  savedEventIds: string[];
  recentlyViewedIds: string[];
  location: GeoPoint | null;
  notificationPrefs: NotificationPrefs;
  onboarded: boolean;
  /** the business this user manages (owner path, step 7); null = not an owner yet */
  ownerBusinessId: string | null;
}

const DEFAULT_PROFILE: Profile = {
  savedBusinessIds: [],
  followedBusinessIds: [],
  savedEventIds: [],
  recentlyViewedIds: [],
  location: null,
  notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false },
  onboarded: false,
  ownerBusinessId: null,
};

const PROFILE_KEY = "rc.profile";
const PENDING_INTENT_KEY = "rc.pendingIntent";
const MAX_RECENT = 10;

/** The reason a JIT auth prompt was raised — tunes the AuthSheet copy. */
export type AuthReason = "save" | "follow" | "saveEvent" | "recommend" | "account";

/**
 * A gated action serialized so it can complete AFTER an OAuth redirect round-trip
 * (the in-memory `pending` closure can't survive the full-page navigation). Only the
 * simple add-to-list toggles are replayable; owner flows just land signed-in.
 */
export type PendingIntent = { type: "save" | "follow" | "saveEvent" | "recommend"; id: string };

interface AuthPrompt {
  open: boolean;
  reason: AuthReason;
  pending?: () => void;
  intent?: PendingIntent;
}

interface SessionValue extends Profile {
  user: SessionUser | null;
  isAuthed: boolean;
  /**
   * True when the sign-in profile merge failed, i.e. the user IS signed in but their
   * saves/follows are not reaching the server. Surfaced so this can never fail silently
   * again; `retryProfileSync` is the escape hatch (also retried automatically on the
   * user's next pref change).
   */
  profileSyncFailed: boolean;
  retryProfileSync: () => void;

  // personal collections — guest-local, merged on sign-in (no auth gate)
  isSaved: (id: string) => boolean;
  toggleSaveBusiness: (id: string) => void;
  isFollowing: (id: string) => boolean;
  toggleFollow: (id: string) => void;
  isSavedEvent: (id: string) => boolean;
  toggleSaveEvent: (id: string) => void;

  // local prefs (no auth)
  addRecentlyViewed: (id: string) => void;
  /** No UI calls this today — the Account toggles are hidden pending delivery. See
   *  NotificationPrefs above; kept so reinstating is additive. */
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  setLocation: (loc: GeoPoint | null) => void;
  completeOnboarding: (patch?: Partial<Pick<Profile, "location">>) => void;
  setOwnerBusinessId: (id: string | null) => void;

  // auth (passwordless email; Supabase = OTP code, mock = instant)
  /** Begin sign-in. Returns whether a one-time code was emailed (→ call verifyOtp next). */
  startSignIn: (email: string, name?: string) => Promise<{ needsOtp: boolean }>;
  /** Complete OTP sign-in with the emailed code. */
  verifyOtp: (email: string, token: string) => Promise<void>;
  /** OAuth sign-in (e.g. Google). Persists the pending intent so a save/follow completes
   *  after the redirect. Returns whether the browser is navigating away. */
  signInWithProvider: (provider: OAuthProvider) => Promise<{ redirected: boolean }>;
  signOut: () => void;
  /** Permanently delete the account (server-side) and wipe this device's local prefs. */
  deleteAccount: () => Promise<void>;
  requireAuth: (action: () => void, reason?: AuthReason, intent?: PendingIntent) => void;

  // JIT auth sheet
  authPrompt: AuthPrompt;
  openAuth: (reason: AuthReason, pending?: () => void, intent?: PendingIntent) => void;
  closeAuth: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

const uniq = (a: string[] = [], b: string[] = []) => Array.from(new Set([...a, ...b]));

/** Pull only the persisted-profile fields out of the local Profile. */
function toPersisted(p: Profile): PersistedProfile {
  return {
    savedBusinessIds: p.savedBusinessIds,
    followedBusinessIds: p.followedBusinessIds,
    savedEventIds: p.savedEventIds,
    recentlyViewedIds: p.recentlyViewedIds,
    notificationPrefs: p.notificationPrefs,
    location: p.location,
    onboarded: p.onboarded,
    ownerBusinessId: p.ownerBusinessId,
  };
}

const notifChanged = (p: NotificationPrefs) =>
  JSON.stringify(p) !== JSON.stringify(DEFAULT_PROFILE.notificationPrefs);

/** Merge guest-local prefs with the server row so a guest's activity is never lost. */
function mergeProfiles(local: Profile, server: Partial<PersistedProfile> | null): Profile {
  if (!server) return local;
  return {
    ...local,
    savedBusinessIds: uniq(local.savedBusinessIds, server.savedBusinessIds),
    followedBusinessIds: uniq(local.followedBusinessIds, server.followedBusinessIds),
    savedEventIds: uniq(local.savedEventIds, server.savedEventIds),
    recentlyViewedIds: uniq(local.recentlyViewedIds, server.recentlyViewedIds).slice(0, MAX_RECENT),
    // The server row is auto-created with DEFAULT notification prefs, so it's always
    // truthy — prefer the guest's choice when they actually changed it (migrate it),
    // else keep the server's (don't clobber another device's settings with defaults).
    notificationPrefs: notifChanged(local.notificationPrefs)
      ? local.notificationPrefs
      : server.notificationPrefs ?? local.notificationPrefs,
    location: local.location ?? server.location ?? null,
    onboarded: local.onboarded || !!server.onboarded,
    ownerBusinessId: server.ownerBusinessId ?? local.ownerBusinessId ?? null,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const getDS = useDataSource();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<Profile>(() => load(PROFILE_KEY, DEFAULT_PROFILE));
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authPrompt, setAuthPrompt] = useState<AuthPrompt>({ open: false, reason: "save" });

  // keep a live snapshot of the profile for the sign-in merge (avoids stale closures)
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const syncedRef = useRef(false); // server-merge done → safe to push prefs back
  const lastUserIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false); // a merge is in flight → don't start a second one
  /** The sign-in profile merge failed; prefs are NOT reaching the server. */
  const [profileSyncFailed, setProfileSyncFailed] = useState(false);

  // persist local-first prefs (works for guests and authed users alike)
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }, [profile]);

  // ---- auth wiring: reflect the DataSource session + merge prefs on sign-in ----
  const syncProfileOnSignIn = useCallback(async () => {
    if (syncingRef.current) return; // a retry raced the initial attempt
    syncingRef.current = true;
    try {
      const ds = await getDS();
      const server = await ds.getProfile();
      const merged = mergeProfiles(profileRef.current, server);
      setProfile(merged);
      await ds.saveProfile(toPersisted(merged));
      syncedRef.current = true;
      setProfileSyncFailed(false);
    } finally {
      syncingRef.current = false;
    }
  }, [getDS]);

  /**
   * Retry the sign-in merge. Exposed on the session so a surface can offer it, and called
   * automatically when the user next changes a pref (see the pref-push effect).
   */
  const retryProfileSync = useCallback(() => {
    // lastUserIdRef (not authedRef) — it's set in the same place the sync is triggered, so
    // this can't disagree with whether a merge is owed.
    if (!lastUserIdRef.current || syncedRef.current || syncingRef.current) return;
    void syncProfileOnSignIn().catch((err) => {
      console.error("[session] profile sync retry failed; prefs still local-only", err);
    });
  }, [syncProfileOnSignIn]);

  /**
   * Drop everything that belongs to the account rather than the device.
   *
   * Shared by explicit sign-out (PR #4) and by session LOSS — an expired or revoked token
   * leaves exactly the same stale state behind, and until item 6 only the first path
   * cleared it. `ownerBusinessId` is the one with teeth: it gates the owner dashboard, so
   * leaving it set routes a signed-out user into screens whose every write fails.
   *
   * syncedRef is flipped false FIRST so the pref-push effect can't write this cleared
   * profile back over the real server row; the server keeps it and re-merges on next
   * sign-in.
   */
  /**
   * `serverHasACopy` is passed IN rather than read from syncedRef, because one caller (the
   * lost-session branch) resets syncedRef immediately before calling this — reading the ref
   * here would have always seen `false` and silently stopped clearing anything on sign-out.
   */
  const clearAccountScopedState = useCallback((serverHasACopy: boolean) => {
    // Now that saves are guest-local, "clear the account's lists" has a failure case it did
    // not have when saving required sign-in. If the sign-in merge never succeeded
    // (`getProfile()` threw — see profileSyncFailed), then NOTHING from the account was ever
    // loaded into local state and nothing local was ever pushed up. The lists therefore hold
    // only this device's own taps, stored nowhere else. Clearing them would be the one path
    // in this flow that destroys data permanently.
    //
    // So: clear when we know the server has a copy; keep when we know it does not. Keeping
    // is not a shared-device leak in that case for the same reason it is not a loss — an
    // unsynced profile contains no one else's activity.
    syncedRef.current = false;
    lastUserIdRef.current = null;
    setProfileSyncFailed(false);
    setProfile((p) => ({
      ...p,
      // ownerBusinessId always goes: it gates the owner dashboard, so leaving it set routes a
      // signed-out user into screens whose every write fails. It is also never guest-created.
      ownerBusinessId: null,
      ...(serverHasACopy
        ? { savedBusinessIds: [], followedBusinessIds: [], savedEventIds: [] }
        : null),
    }));
  }, []);

  // Replay a gated action that was stashed before an OAuth redirect (so a save/follow
  // started as a guest completes once they land back signed-in). Add-only = idempotent.
  const replayIntent = useCallback(() => {
    let intent: PendingIntent | null = null;
    try {
      const raw = localStorage.getItem(PENDING_INTENT_KEY);
      if (raw) intent = JSON.parse(raw) as PendingIntent;
      localStorage.removeItem(PENDING_INTENT_KEY);
    } catch {
      return;
    }
    if (!intent?.id) return;
    if (intent.type === "recommend") {
      // recommend is a server write (positive-only) — fire it, then refresh the count
      void getDS()
        .then((ds) => ds.recommend(intent!.id))
        .then(() => {
          qc.invalidateQueries({ queryKey: ["recommendations"] });
          qc.invalidateQueries({ queryKey: ["has-recommended"] });
        })
        .catch(() => {});
      return;
    }
    const key = (
      { save: "savedBusinessIds", follow: "followedBusinessIds", saveEvent: "savedEventIds" } as const
    )[intent.type];
    setProfile((p) =>
      p[key].includes(intent!.id) ? p : { ...p, [key]: [...p[key], intent!.id] },
    );
  }, [getDS, qc]);

  useEffect(() => {
    let active = true;
    let unsub = () => {};
    const apply = (u: SessionUser | null) => {
      if (!active) return;
      setUser(u);
      if (u) {
        if (lastUserIdRef.current !== u.id) {
          lastUserIdRef.current = u.id;
          // A rejection here used to be swallowed: replayIntent never ran, syncedRef stayed
          // false, and the pref-push effect below then silently no-op'd for the WHOLE
          // session — every save/follow stayed on the device while the UI showed success.
          // Now it's logged, flagged, and retried on the user's next pref change.
          void syncProfileOnSignIn()
            .then(replayIntent)
            .catch((err) => {
              console.error("[session] sign-in profile sync failed; saves are local-only until it succeeds", err);
              setProfileSyncFailed(true);
              // Still replay the pending intent — it writes to local state, which works
              // regardless of whether the server merge landed.
              try {
                replayIntent();
              } catch {
                /* ignore */
              }
            });
        }
      } else {
        // Session ENDED. If we previously had a user this is a sign-out or, more
        // importantly, a silently expired/revoked token — the case PR #4's explicit
        // sign-out fix didn't cover. Account-scoped state must not outlive the session:
        // `ownerBusinessId` in particular would keep routing the owner into /manage, a
        // screen that cannot work without a session (item 6).
        //
        // Guarded on having HAD a user, so a guest's local-first saves are never wiped on
        // a normal cold start (where apply(null) fires before the session restores).
        const hadUser = lastUserIdRef.current !== null;
        const serverHasACopy = syncedRef.current; // capture BEFORE the reset below
        lastUserIdRef.current = null;
        syncedRef.current = false;
        if (hadUser) clearAccountScopedState(serverHasACopy);
      }
    };
    // resolve the (lazily-loaded) source, then reflect its session
    // (mock onAuthChange doesn't replay; Supabase fires INITIAL_SESSION — dedup'd by id)
    void getDS().then((ds) => {
      if (!active) return;
      void ds.getAuthUser().then(apply);
      unsub = ds.onAuthChange(apply);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [getDS, syncProfileOnSignIn, replayIntent]);

  // once signed in (and merged), push later pref changes to the server row
  useEffect(() => {
    if (!user) return;
    if (syncedRef.current) {
      void getDS()
        .then((ds) => ds.saveProfile(toPersisted(profile)))
        .catch((err) => {
          // One failed push is not fatal — the local profile is still the source of truth
          // and the next change re-pushes the whole object — but it must not be silent.
          console.error("[session] could not push prefs to the server row", err);
        });
      return;
    }
    // The initial merge never landed. Rather than dropping every subsequent save on the
    // floor for the rest of the session, use this pref change as the trigger to retry.
    retryProfileSync();
  }, [profile, user, getDS, retryProfileSync]);

  const isAuthed = !!user;
  const authedRef = useRef(isAuthed);
  authedRef.current = isAuthed;

  // live snapshot of the prompt so signInWithProvider can read the pending intent
  const authPromptRef = useRef(authPrompt);
  authPromptRef.current = authPrompt;

  const openAuth = useCallback((reason: AuthReason, pending?: () => void, intent?: PendingIntent) => {
    setAuthPrompt({ open: true, reason, pending, intent });
  }, []);
  const closeAuth = useCallback(
    () => setAuthPrompt((p) => ({ ...p, open: false, pending: undefined, intent: undefined })),
    [],
  );

  const requireAuth = useCallback(
    (action: () => void, reason: AuthReason = "save", intent?: PendingIntent) => {
      if (authedRef.current) action();
      else openAuth(reason, action, intent);
    },
    [openAuth],
  );

  const toggleId = useCallback(
    (key: "savedBusinessIds" | "followedBusinessIds" | "savedEventIds", id: string) =>
      setProfile((p) => {
        const has = p[key].includes(id);
        return { ...p, [key]: has ? p[key].filter((x) => x !== id) : [...p[key], id] };
      }),
    [],
  );

  /**
   * Save / follow are GUEST-LOCAL — they write straight to local state, no sign-in.
   *
   * These three used to go through `requireAuth`, which opened the auth sheet and deferred
   * the tap until the user signed in. That contradicted the rest of the app: onboarding
   * collected a guest's home location with no account at all, the landing page sells "optional"
   * accounts", and the privacy policy documents local-first guest prefs. So the app asked a
   * first-time visitor what they liked, then demanded an account to bookmark a coffee shop.
   *
   * Nothing new is needed to make this safe: the profile is already persisted to
   * localStorage for guests and authed users alike, and `mergeProfiles` already UNIONS
   * local with server on sign-in — it was written for exactly this. A guest's saves are
   * carried into their account rather than replacing it or being replaced by it.
   *
   * Still gated (correctly): `recommend` is a server write keyed to a user id, and
   * claim/owner flows need an account by definition.
   */
  const toggleSaveBusiness = useCallback(
    (id: string) => toggleId("savedBusinessIds", id),
    [toggleId],
  );
  const toggleFollow = useCallback((id: string) => toggleId("followedBusinessIds", id), [toggleId]);
  const toggleSaveEvent = useCallback((id: string) => toggleId("savedEventIds", id), [toggleId]);

  const addRecentlyViewed = useCallback((id: string) => {
    setProfile((p) => {
      if (p.recentlyViewedIds[0] === id) return p;
      const next = [id, ...p.recentlyViewedIds.filter((x) => x !== id)].slice(0, MAX_RECENT);
      return { ...p, recentlyViewedIds: next };
    });
  }, []);

  const startSignIn = useCallback(
    async (email: string, name?: string) => {
      const res = await (await getDS()).startEmailAuth(email, name);
      return { needsOtp: res.otpSent };
    },
    [getDS],
  );

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      await (await getDS()).verifyEmailOtp(email, token);
      // onAuthChange fires → user + prefs sync; the Supabase client is already authed.
    },
    [getDS],
  );

  const signInWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      // stash the gated action so it replays after the OAuth round-trip (see replayIntent)
      const intent = authPromptRef.current.intent;
      try {
        if (intent) localStorage.setItem(PENDING_INTENT_KEY, JSON.stringify(intent));
        else localStorage.removeItem(PENDING_INTENT_KEY);
      } catch {
        /* ignore */
      }
      const redirectTo =
        typeof window !== "undefined"
          ? window.location.origin + window.location.pathname
          : undefined;
      return (await getDS()).signInWithOAuth(provider, redirectTo);
    },
    [getDS],
  );

  const signOut = useCallback(() => {
    // Same clearing as a lost session — see clearAccountScopedState. (a) a signed-out
    // ex-owner can't reach the owner dashboard, and (b) a shared device doesn't merge one
    // user's saves/follows into the NEXT account on sign-in.
    clearAccountScopedState(syncedRef.current);
    void getDS().then((ds) => ds.signOut());
  }, [getDS, clearAccountScopedState]);

  const deleteAccount = useCallback(async () => {
    const ds = await getDS();
    await ds.deleteAccount(); // server delete + signOut (Supabase); mock signs out
    // account is gone — this device must not keep its saves/follows. Unlike
    // sign-out, this clears unconditionally: there is no server row left to recover from,
    // but there is also no account left that these lists could belong to.
    clearAccountScopedState(true);
    setProfile(DEFAULT_PROFILE);
    try {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(PENDING_INTENT_KEY);
    } catch {
      /* ignore */
    }
  }, [getDS, clearAccountScopedState]);

  const value = useMemo<SessionValue>(
    () => ({
      ...profile,
      user,
      isAuthed,
      profileSyncFailed,
      retryProfileSync,
      isSaved: (id) => profile.savedBusinessIds.includes(id),
      toggleSaveBusiness,
      isFollowing: (id) => profile.followedBusinessIds.includes(id),
      toggleFollow,
      isSavedEvent: (id) => profile.savedEventIds.includes(id),
      toggleSaveEvent,
      addRecentlyViewed,
      setNotificationPref: (key, val) =>
        setProfile((p) => ({ ...p, notificationPrefs: { ...p.notificationPrefs, [key]: val } })),
      setLocation: (loc) => setProfile((p) => ({ ...p, location: loc })),
      completeOnboarding: (patch) => setProfile((p) => ({ ...p, ...patch, onboarded: true })),
      setOwnerBusinessId: (id) => setProfile((p) => ({ ...p, ownerBusinessId: id })),
      startSignIn,
      verifyOtp,
      signInWithProvider,
      signOut,
      deleteAccount,
      requireAuth,
      authPrompt,
      openAuth,
      closeAuth,
    }),
    [
      profile,
      user,
      isAuthed,
      profileSyncFailed,
      retryProfileSync,
      toggleSaveBusiness,
      toggleFollow,
      toggleSaveEvent,
      addRecentlyViewed,
      startSignIn,
      verifyOtp,
      signInWithProvider,
      signOut,
      deleteAccount,
      requireAuth,
      authPrompt,
      openAuth,
      closeAuth,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
