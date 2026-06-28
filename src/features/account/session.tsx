/**
 * Client session + personalization store (BUILD-BRIEF §12 step 6, §10).
 *
 * Local-first by design: onboarding prefs (location, interests, notifications) and
 * recently-viewed work with NO account — stored in localStorage until/unless the user
 * signs in. Save / Follow / Save-event are the ONLY gated actions; tapping one as a
 * guest fires the just-in-time AuthSheet (login is never a browse gate).
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
import { useDataSource } from "@/data/DataProvider";
import type { AuthUser, PersistedProfile } from "@/data/DataSource";

export type SessionUser = AuthUser;

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
  interests: string[];
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
  interests: [],
  location: null,
  notificationPrefs: { followedBulletins: true, savedEvents: true, localNews: false },
  onboarded: false,
  ownerBusinessId: null,
};

const PROFILE_KEY = "rc.profile";
const MAX_RECENT = 10;

/** The reason a JIT auth prompt was raised — tunes the AuthSheet copy. */
export type AuthReason = "save" | "follow" | "saveEvent" | "account";

interface AuthPrompt {
  open: boolean;
  reason: AuthReason;
  pending?: () => void;
}

interface SessionValue extends Profile {
  user: SessionUser | null;
  isAuthed: boolean;

  // gated actions (fire JIT auth when guest)
  isSaved: (id: string) => boolean;
  toggleSaveBusiness: (id: string) => void;
  isFollowing: (id: string) => boolean;
  toggleFollow: (id: string) => void;
  isSavedEvent: (id: string) => boolean;
  toggleSaveEvent: (id: string) => void;

  // local prefs (no auth)
  addRecentlyViewed: (id: string) => void;
  toggleInterest: (interest: string) => void;
  setInterests: (interests: string[]) => void;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  setLocation: (loc: GeoPoint | null) => void;
  completeOnboarding: (patch?: Partial<Pick<Profile, "interests" | "location">>) => void;
  setOwnerBusinessId: (id: string | null) => void;

  // auth (passwordless email; Supabase = OTP code, mock = instant)
  /** Begin sign-in. Returns whether a one-time code was emailed (→ call verifyOtp next). */
  startSignIn: (email: string, name?: string) => Promise<{ needsOtp: boolean }>;
  /** Complete OTP sign-in with the emailed code. */
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => void;
  requireAuth: (action: () => void, reason?: AuthReason) => void;

  // JIT auth sheet
  authPrompt: AuthPrompt;
  openAuth: (reason: AuthReason, pending?: () => void) => void;
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
    interests: p.interests,
    notificationPrefs: p.notificationPrefs,
    location: p.location,
    onboarded: p.onboarded,
    ownerBusinessId: p.ownerBusinessId,
  };
}

/** Merge guest-local prefs with the server row so a guest's activity is never lost. */
function mergeProfiles(local: Profile, server: Partial<PersistedProfile> | null): Profile {
  if (!server) return local;
  return {
    ...local,
    savedBusinessIds: uniq(local.savedBusinessIds, server.savedBusinessIds),
    followedBusinessIds: uniq(local.followedBusinessIds, server.followedBusinessIds),
    savedEventIds: uniq(local.savedEventIds, server.savedEventIds),
    recentlyViewedIds: uniq(local.recentlyViewedIds, server.recentlyViewedIds).slice(0, MAX_RECENT),
    interests: uniq(local.interests, server.interests),
    notificationPrefs: server.notificationPrefs ?? local.notificationPrefs,
    location: local.location ?? server.location ?? null,
    onboarded: local.onboarded || !!server.onboarded,
    ownerBusinessId: server.ownerBusinessId ?? local.ownerBusinessId ?? null,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const ds = useDataSource();
  const [profile, setProfile] = useState<Profile>(() => load(PROFILE_KEY, DEFAULT_PROFILE));
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authPrompt, setAuthPrompt] = useState<AuthPrompt>({ open: false, reason: "save" });

  // keep a live snapshot of the profile for the sign-in merge (avoids stale closures)
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const syncedRef = useRef(false); // server-merge done → safe to push prefs back
  const lastUserIdRef = useRef<string | null>(null);

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
    const server = await ds.getProfile();
    const merged = mergeProfiles(profileRef.current, server);
    setProfile(merged);
    await ds.saveProfile(toPersisted(merged));
    syncedRef.current = true;
  }, [ds]);

  useEffect(() => {
    let active = true;
    const apply = (u: SessionUser | null) => {
      if (!active) return;
      setUser(u);
      if (u) {
        if (lastUserIdRef.current !== u.id) {
          lastUserIdRef.current = u.id;
          void syncProfileOnSignIn();
        }
      } else {
        lastUserIdRef.current = null;
        syncedRef.current = false;
      }
    };
    // initial (mock onAuthChange doesn't replay; Supabase fires INITIAL_SESSION — dedup'd by id)
    void ds.getAuthUser().then(apply);
    const unsub = ds.onAuthChange(apply);
    return () => {
      active = false;
      unsub();
    };
  }, [ds, syncProfileOnSignIn]);

  // once signed in (and merged), push later pref changes to the server row
  useEffect(() => {
    if (user && syncedRef.current) void ds.saveProfile(toPersisted(profile));
  }, [profile, user, ds]);

  const isAuthed = !!user;
  const authedRef = useRef(isAuthed);
  authedRef.current = isAuthed;

  const openAuth = useCallback((reason: AuthReason, pending?: () => void) => {
    setAuthPrompt({ open: true, reason, pending });
  }, []);
  const closeAuth = useCallback(
    () => setAuthPrompt((p) => ({ ...p, open: false, pending: undefined })),
    [],
  );

  const requireAuth = useCallback(
    (action: () => void, reason: AuthReason = "save") => {
      if (authedRef.current) action();
      else openAuth(reason, action);
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

  const toggleSaveBusiness = useCallback(
    (id: string) => requireAuth(() => toggleId("savedBusinessIds", id), "save"),
    [requireAuth, toggleId],
  );
  const toggleFollow = useCallback(
    (id: string) => requireAuth(() => toggleId("followedBusinessIds", id), "follow"),
    [requireAuth, toggleId],
  );
  const toggleSaveEvent = useCallback(
    (id: string) => requireAuth(() => toggleId("savedEventIds", id), "saveEvent"),
    [requireAuth, toggleId],
  );

  const addRecentlyViewed = useCallback((id: string) => {
    setProfile((p) => {
      if (p.recentlyViewedIds[0] === id) return p;
      const next = [id, ...p.recentlyViewedIds.filter((x) => x !== id)].slice(0, MAX_RECENT);
      return { ...p, recentlyViewedIds: next };
    });
  }, []);

  const toggleInterest = useCallback((interest: string) => {
    setProfile((p) => ({
      ...p,
      interests: p.interests.includes(interest)
        ? p.interests.filter((x) => x !== interest)
        : [...p.interests, interest],
    }));
  }, []);

  const startSignIn = useCallback(
    async (email: string, name?: string) => {
      const res = await ds.startEmailAuth(email, name);
      return { needsOtp: res.otpSent };
    },
    [ds],
  );

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      await ds.verifyEmailOtp(email, token);
      // onAuthChange fires → user + prefs sync; the Supabase client is already authed.
    },
    [ds],
  );

  const signOut = useCallback(() => {
    void ds.signOut();
  }, [ds]);

  const value = useMemo<SessionValue>(
    () => ({
      ...profile,
      user,
      isAuthed,
      isSaved: (id) => profile.savedBusinessIds.includes(id),
      toggleSaveBusiness,
      isFollowing: (id) => profile.followedBusinessIds.includes(id),
      toggleFollow,
      isSavedEvent: (id) => profile.savedEventIds.includes(id),
      toggleSaveEvent,
      addRecentlyViewed,
      toggleInterest,
      setInterests: (interests) => setProfile((p) => ({ ...p, interests })),
      setNotificationPref: (key, val) =>
        setProfile((p) => ({ ...p, notificationPrefs: { ...p.notificationPrefs, [key]: val } })),
      setLocation: (loc) => setProfile((p) => ({ ...p, location: loc })),
      completeOnboarding: (patch) => setProfile((p) => ({ ...p, ...patch, onboarded: true })),
      setOwnerBusinessId: (id) => setProfile((p) => ({ ...p, ownerBusinessId: id })),
      startSignIn,
      verifyOtp,
      signOut,
      requireAuth,
      authPrompt,
      openAuth,
      closeAuth,
    }),
    [
      profile,
      user,
      isAuthed,
      toggleSaveBusiness,
      toggleFollow,
      toggleSaveEvent,
      addRecentlyViewed,
      toggleInterest,
      startSignIn,
      verifyOtp,
      signOut,
      requireAuth,
      authPrompt,
      openAuth,
      closeAuth,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
