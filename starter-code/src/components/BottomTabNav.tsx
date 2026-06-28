/**
 * BottomTabNav — the app's primary navigation (all consumer screens).
 * Home · Search · Events · Saved · Account. Line icons + labels (cartographic feel).
 * Active tab uses the pine-green "positive" role; inactive is faint.
 *
 * Deps: lucide-react. Router-agnostic: renders <a href>; swap for your router's
 * <Link> and derive `active` from the current route (e.g. useLocation).
 */
import { Home, Search, CalendarDays, Heart, CircleUser } from "lucide-react";

export type TabKey = "home" | "search" | "events" | "saved" | "account";

const TABS: { key: TabKey; label: string; href: string; Icon: typeof Home }[] = [
  { key: "home", label: "Home", href: "/", Icon: Home },
  { key: "search", label: "Search", href: "/search", Icon: Search },
  { key: "events", label: "Events", href: "/events", Icon: CalendarDays },
  { key: "saved", label: "Saved", href: "/saved", Icon: Heart },
  { key: "account", label: "Account", href: "/account", Icon: CircleUser },
];

export interface BottomTabNavProps {
  active: TabKey | null; // null on detail / owner / auth routes (nothing highlighted)
  onNavigate?: (key: TabKey, href: string) => void; // optional intercept (e.g. router.push)
}

export function BottomTabNav({ active, onNavigate }: BottomTabNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto grid max-w-content grid-cols-5 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <a
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            onClick={(e) => {
              if (onNavigate) { e.preventDefault(); onNavigate(key, href); }
            }}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive ? "font-medium text-positive" : "text-ink-faint hover:text-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? "fill-positive-tint" : ""}`} strokeWidth={1.75} aria-hidden />
            {label}
          </a>
        );
      })}
    </nav>
  );
}
