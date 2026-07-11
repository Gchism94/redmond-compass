import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Compass, LifeBuoy, Flame, ClipboardList, HeartHandshake, Mountain, PawPrint,
  Info, Mail, Download, Share, Plus, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RouteFallback } from "./RouteFallback";
import { OfflineBanner } from "@/pwa/OfflineBanner";
import { useInstallPrompt } from "@/pwa/useInstallPrompt";
import { useSession } from "@/features/account/session";
import { useI18n, type DictKey } from "@/i18n";
import { cn } from "@/lib/cn";

/**
 * Desktop web shell (≥1024px) — the site returning redmondcompass.com visitors
 * know: white logo bar, cream guide-link row, navy footer with Explore /
 * Community / Contribute columns (layout mirrors the Phase 0 crawl in
 * migration/content/screenshots/). Same routes and screens as the mobile
 * AppShell; only the frame differs. Primary nav links in the top bar are a
 * deliberate small addition over the original (interior pages need a way home).
 */

// Cream guide-link row — same eight links, same order, as the original site.
const GUIDE_LINKS: { to: string; labelKey: DictKey; icon: LucideIcon }[] = [
  { to: "/help-essentials", labelKey: "guides.help-essentials", icon: LifeBuoy },
  { to: "/seasonal-safety", labelKey: "guides.seasonal-safety", icon: Flame },
  { to: "/getting-settled", labelKey: "web.nav.newToRedmond", icon: ClipboardList },
  { to: "/senior-resources", labelKey: "guides.senior-resources", icon: HeartHandshake },
  { to: "/get-outside", labelKey: "guides.get-outside", icon: Mountain },
  { to: "/pets", labelKey: "guides.pets", icon: PawPrint },
  { to: "/about", labelKey: "web.nav.about", icon: Info },
  { to: "/contact", labelKey: "web.nav.contact", icon: Mail },
];

const PRIMARY_LINKS: { to: string; labelKey: DictKey }[] = [
  { to: "/search", labelKey: "web.nav.directory" },
  { to: "/events", labelKey: "web.nav.events" },
  { to: "/community", labelKey: "web.nav.news" },
  { to: "/resources", labelKey: "web.nav.resources" },
];

// Screens designed as wide surfaces; everything else gets a readable column.
const WIDE_ROUTES = new Set(["/", "/search", "/search/results", "/events", "/community"]);

export function WebShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const wide = WIDE_ROUTES.has(pathname.replace(/\/+$/, "") || "/");

  return (
    <div className="min-h-[100dvh] bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>
      <WebHeader />
      <main id="main" className={cn("mx-auto w-full px-6 pb-16", wide ? "max-w-6xl" : "max-w-3xl")}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <OfflineBanner />
      <WebFooter />
    </div>
  );
}

function WebHeader() {
  const { t } = useI18n();
  const session = useSession();

  return (
    <header className="sticky top-0 z-20">
      {/* Row 1 — white bar: logo · primary links · Get the app / Sign in */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
          <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Compass size={20} />
            </span>
            <span className="leading-none">
              <span className="block font-heading text-lg font-bold text-foreground">Redmond</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">Compass</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="ml-4 flex items-center gap-5">
            {PRIMARY_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "text-sm font-medium transition-colors hover:text-foreground",
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                  )
                }
              >
                {t(l.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <GetAppButton />
            {session.isAuthed ? (
              <Link
                to="/account"
                className="inline-flex h-10 items-center gap-2 rounded-pill bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-95"
              >
                {session.user!.name}
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-10 items-center rounded-pill bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-95"
              >
                {t("web.signIn")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — cream guide links, exactly the original's eight */}
      <div className="border-b border-border bg-secondary/70 backdrop-blur">
        <nav
          aria-label="Guides"
          className="mx-auto flex max-w-6xl items-center justify-center gap-6 overflow-x-auto px-6 py-2"
        >
          {GUIDE_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 text-xs font-medium transition-colors hover:text-foreground",
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                )
              }
            >
              <l.icon size={13} className="text-primary" /> {t(l.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** "Get the app": Chromium fires the native install prompt; iOS/others get instructions. */
function GetAppButton() {
  const { t } = useI18n();
  const { canInstall, promptInstall, isStandalone } = useInstallPrompt();
  const [showHint, setShowHint] = useState(false);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isStandalone) return null;

  const onClick = async () => {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome !== "unavailable") return;
    }
    setShowHint(true);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
      >
        <Download size={15} /> {t("web.getApp")}
      </button>
      {showHint && (
        <div className="absolute right-0 top-12 z-30 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading text-sm font-semibold text-foreground">{t("web.installTitle")}</p>
            <button
              type="button"
              aria-label={t("common.dismiss")}
              onClick={() => setShowHint(false)}
              className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          {isIOS ? (
            <p className="mt-1.5 inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {t("pwa.iosTap")} <Share size={12} className="inline" /> {t("pwa.iosShareThen")}{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <Plus size={12} /> {t("pwa.addToHome")}
              </span>
              .
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">{t("web.installDesktopHint")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function WebFooter() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const columns: { headingKey: DictKey; links: { labelKey: DictKey; to: string }[] }[] = [
    {
      headingKey: "web.footer.explore",
      links: [
        { labelKey: "web.footer.directory", to: "/search" },
        { labelKey: "web.footer.events", to: "/events" },
        { labelKey: "web.footer.news", to: "/community" },
      ],
    },
    {
      headingKey: "web.footer.community",
      links: [
        { labelKey: "web.footer.bulletin", to: "/community" },
        { labelKey: "web.footer.resources", to: "/resources" },
        { labelKey: "web.footer.about", to: "/about" },
      ],
    },
    {
      headingKey: "web.footer.contribute",
      links: [
        { labelKey: "web.footer.submitBusiness", to: "/claim" },
        { labelKey: "web.footer.submitEvent", to: "/manage/event/new" },
      ],
    },
  ];

  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 md:grid-cols-4">
        <div>
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Compass size={20} />
            </span>
            <span className="text-left leading-none">
              <span className="block font-heading text-lg font-bold">Redmond</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">Compass</span>
            </span>
          </button>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-background/70">{t("web.footer.tagline")}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.headingKey} aria-label={t(col.headingKey)}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-background/60">{t(col.headingKey)}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.labelKey}>
                  <Link to={l.to} className="text-sm text-background/85 hover:text-background">
                    {t(l.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-background/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 text-xs text-background/60">
          <span>{t("web.footer.rights", { year })}</span>
          <Link to="/privacy" className="hover:text-background">
            {t("account.privacy")}
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="font-medium text-background/85 hover:text-background"
          >
            {lang === "en" ? "Español" : "English"}
          </button>
          <span className="ml-auto">{t("web.footer.made")}</span>
        </div>
      </div>
    </footer>
  );
}
