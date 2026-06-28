/**
 * Client session + personalization store (BUILD-BRIEF §12 step 6, §10).
 *
 * Local-first by design: onboarding prefs (location, interests, notifications) and
 * recently-viewed work with NO account — "store prefs locally until/unless the user
 * creates an account." Save / Follow / Save-event are the ONLY gated actions; tapping
 * one as a guest fires the just-in-time AuthSheet (login is never a browse gate).
 *
 * Auth here is a MOCK (local) — the real backend implements DataSource.getCurrentUser
 * + sign-in and this provider swaps its internals; the hook surface stays the same.
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

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

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
const USER_KEY = "rc.user";
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

  // auth
  signIn: (email: string, name?: string) => void;
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(() => load(PROFILE_KEY, DEFAULT_PROFILE));
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  });
  const [authPrompt, setAuthPrompt] = useState<AuthPrompt>({ open: false, reason: "save" });

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }, [profile]);
  useEffect(() => {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, [user]);

  const isAuthed = !!user;
  // keep a ref so requireAuth always sees current auth state
  const authedRef = useRef(isAuthed);
  authedRef.current = isAuthed;

  const openAuth = useCallback((reason: AuthReason, pending?: () => void) => {
    setAuthPrompt({ open: true, reason, pending });
  }, []);
  const closeAuth = useCallback(() => setAuthPrompt((p) => ({ ...p, open: false, pending: undefined })), []);

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
      signIn: (email, name) => {
        const cleanName = name?.trim() || email.split("@")[0];
        setUser({ id: `u_${email.toLowerCase()}`, email: email.trim(), name: cleanName });
      },
      signOut: () => setUser(null),
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
      requireAuth,
      authPrompt,
      openAuth,
      closeAuth,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
