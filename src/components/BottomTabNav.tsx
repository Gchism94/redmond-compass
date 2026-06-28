import { NavLink } from "react-router-dom";
import { Home, Search, Calendar, Bookmark, User } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/search", label: "Search", icon: Search, end: false },
  { to: "/events", label: "Events", icon: Calendar, end: false },
  { to: "/saved", label: "Saved", icon: Bookmark, end: false },
  { to: "/account", label: "Account", icon: User, end: false },
] as const;

/**
 * Bottom tab bar — the app's primary nav (BUILD-BRIEF §9). Persists across screens
 * incl. pushed ones (profile). Active tab = pine-green. 44px+ tap targets.
 */
export function BottomTabNav() {
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
                  "flex min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition",
                  isActive ? "text-positive" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
