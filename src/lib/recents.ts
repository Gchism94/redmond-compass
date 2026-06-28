/**
 * Recent searches, stored locally (pre-auth is fine — "store prefs locally until
 * the user creates an account", BUILD-BRIEF §10). Swaps to the user record later.
 */
const KEY = "rc.recentSearches";
const MAX = 6;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): string[] {
  const t = term.trim();
  if (!t) return getRecentSearches();
  const next = [t, ...getRecentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(
    0,
    MAX,
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota/availability */
  }
  return next;
}
