/**
 * Tiny typed i18n layer (no dependency — keeps the entry bundle small).
 *
 * - `useI18n()` in components → { t, lang, setLang, locale }; re-renders on switch.
 * - `tGlobal()` / `getLocale()` for non-React lib code (hours.ts, format.ts): a module
 *   singleton the provider keeps in sync. Components re-render on language change, so
 *   lib-computed strings recompute with the new language.
 * - Language: persisted in localStorage ("rc.lang"); defaults from navigator.language
 *   (es* → Spanish). <html lang> stays in sync for a11y/SEO.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { en, es, type DictKey } from "./dict";

export type Lang = "en" | "es";
const DICTS: Record<Lang, Record<DictKey, string>> = { en, es };
const LANG_KEY = "rc.lang";

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "es") return stored;
    return (navigator.language || "").toLowerCase().startsWith("es") ? "es" : "en";
  } catch {
    return "en";
  }
}

// ---- module singleton (for lib code without hook access) ----
let currentLang: Lang = detectLang();
export const getLang = (): Lang => currentLang;
export const getLocale = (): string => (currentLang === "es" ? "es-US" : "en-US");

export function tGlobal(key: DictKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[currentLang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

interface I18nValue {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = detectLang();
    currentLang = l;
    if (typeof document !== "undefined") document.documentElement.lang = l;
    return l;
  });

  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
    setLangState(l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, locale: lang === "es" ? "es-US" : "en-US", setLang, t: (key, vars) => tGlobal(key, vars) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export type { DictKey };
