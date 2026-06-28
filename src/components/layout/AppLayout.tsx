import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { BottomTabNav } from "../BottomTabNav";
import { OfflineBanner } from "@/pwa/OfflineBanner";

/**
 * App shell: the mobile content column + persistent bottom tab nav.
 * Caps width to ~480px (mobile-first canvas), reserves space for the tab bar,
 * and resets scroll on route change. A skip link + main landmark cover a11y basics.
 */
export function AppLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on navigation (respects reduced-motion via global CSS).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>
      <main
        id="main"
        ref={mainRef}
        className="app-frame min-h-[100dvh] pb-[calc(58px+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </main>
      <OfflineBanner />
      <BottomTabNav />
    </div>
  );
}
