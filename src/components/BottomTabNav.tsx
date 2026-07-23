import { NavLink } from "react-router-dom";
import { Home, Search, Calendar, Bookmark, User } from "lucide-react";
import { useI18n } from "@/i18n";
import { HOME_PATH } from "@/lib/siteMode";
import { cn } from "@/lib/cn";

const TABS = [
  { to: HOME_PATH, label: "nav.home", icon: Home, end: true },
  { to: "/search", label: "nav.search", icon: Search, end: false },
  { to: "/events", label: "nav.events", icon: Calendar, end: false },
  { to: "/saved", label: "nav.saved", icon: Bookmark, end: false },
  { to: "/account", label: "nav.account", icon: User, end: false },
] as const;

/**
 * Bottom tab bar — the app's primary nav (BUILD-BRIEF §9). Persists across screens
 * incl. pushed ones (profile). Active tab = pine-green. 44px+ tap targets.
 */
export function BottomTabNav() {
  const { t } = useI18n();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-safe backdrop-blur"
    >
      <ul className="app-frame grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition",
                  isActive ? "text-positive" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  <span>{t(label as never)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
