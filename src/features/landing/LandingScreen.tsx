import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Compass, Download, Share, Plus, Search, CalendarDays, Bookmark, UserPlus, WifiOff,
  Languages, Ban, Star, Scale, LockOpen, Eye, ShieldCheck, Store, ArrowRight, Smartphone,
  Monitor, Info, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useInstallPrompt } from "@/pwa/useInstallPrompt";
import { usePageMeta } from "@/lib/pageMeta";
import { useI18n, type DictKey } from "@/i18n";
import { HOME_PATH, LIVE_SITE } from "@/lib/siteMode";
import { cn } from "@/lib/cn";

/**
 * App landing page — `/` in app-only mode (App-Only Mode spec §4). The marketing
 * front door on app.redmondcompass.com while redmondcompass.com stays live on
 * Base44: same brand, links OUT to the live site's content, and sells exactly one
 * thing — installing/opening the app. Bilingual; assets self-hosted (no Base44 CDN).
 */

/** `/` route: an installed (standalone) app must open the app, never its own ad. */
export function LandingGate() {
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  if (standalone) return <Navigate to={HOME_PATH} replace />;
  return <LandingScreen />;
}

// Slim nav of ABSOLUTE links out to the live site (the page must not dead-end).
const SITE_NAV: { labelKey: DictKey; path: string }[] = [
  { labelKey: "web.nav.directory", path: "/directory" },
  { labelKey: "web.nav.events", path: "/events" },
  { labelKey: "web.nav.news", path: "/news" },
  { labelKey: "web.nav.resources", path: "/resources" },
  { labelKey: "web.nav.about", path: "/about" },
];

const CAN: { key: DictKey; icon: LucideIcon }[] = [
  { key: "landing.can1", icon: Search },
  { key: "landing.can2", icon: CalendarDays },
  { key: "landing.can3", icon: Bookmark },
  { key: "landing.can4", icon: UserPlus },
  { key: "landing.can5", icon: WifiOff },
  { key: "landing.can6", icon: Languages },
];

const CANT: { key: DictKey; icon: LucideIcon }[] = [
  { key: "landing.cant1", icon: Ban },
  { key: "landing.cant2", icon: Star },
  { key: "landing.cant3", icon: Scale },
  { key: "landing.cant4", icon: LockOpen },
  { key: "landing.cant5", icon: Eye },
  { key: "landing.cant6", icon: ShieldCheck },
];

export function LandingScreen() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { canInstall, showIosHint, promptInstall, isStandalone } = useInstallPrompt();
  usePageMeta(t("landing.metaTitle"), t("landing.metaDesc"));

  const install = async () => {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome !== "unavailable") return;
    }
    document.getElementById("install")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header — logo goes BACK to the live site (absolute); slim outbound nav */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5">
          <a href={LIVE_SITE} className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Compass size={20} />
            </span>
            <span className="leading-none">
              <span className="block font-heading text-lg font-bold text-foreground">Redmond</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">Compass</span>
            </span>
          </a>
          <nav aria-label="redmondcompass.com" className="ml-2 hidden items-center gap-4 md:flex">
            {SITE_NAV.map((l) => (
              <a key={l.path} href={`${LIVE_SITE}${l.path}`} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {t(l.labelKey)}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={install}
            className="ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-95"
          >
            <Download size={15} /> {t("web.getApp")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        {/* 1 — Hero */}
        <section className="grid items-center gap-10 pt-10 lg:grid-cols-[1fr_minmax(0,340px)] lg:pt-14">
          <div>
            <h1 className="font-heading text-4xl font-bold leading-tight text-foreground lg:text-5xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{t("landing.heroSub")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={install}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground hover:brightness-95"
              >
                <Download size={17} /> {t("landing.install")}
              </button>
              <button
                type="button"
                onClick={() => navigate(HOME_PATH)}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-6 text-base font-semibold text-foreground hover:bg-muted"
              >
                {t("landing.open")} <ArrowRight size={17} />
              </button>
            </div>
            {/* §5 — two account systems: say it plainly, keep it small */}
            <p className="mt-5 flex max-w-xl items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Info size={14} className="mt-0.5 shrink-0 text-positive" /> {t("landing.accountNote")}
            </p>
          </div>
          {/* Real screenshots from the deployed app, self-hosted */}
          <div className="relative mx-auto hidden w-full max-w-[340px] sm:block">
            <img
              src="/landing/app-home.jpg"
              alt="Redmond Compass app — home screen"
              className="w-[75%] rounded-[28px] border-[6px] border-foreground/90 shadow-xl"
              width={780}
              height={1560}
            />
            <img
              src="/landing/app-events.jpg"
              alt="Redmond Compass app — events"
              className="absolute -right-1 top-14 w-[52%] rounded-[20px] border-[5px] border-foreground/90 shadow-2xl"
              width={780}
              height={1560}
              loading="lazy"
            />
          </div>
        </section>

        {/* 2 — Platform-aware install instructions */}
        <section id="install" className="mt-14 scroll-mt-6">
          <h2 className="font-heading text-2xl font-bold text-foreground">{t("landing.installTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("landing.installSub")}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InstallCard
              icon={Smartphone}
              title={t("landing.installAndroid")}
              body={t("landing.installAndroidBody")}
              highlight={canInstall}
              action={
                canInstall ? (
                  <button
                    type="button"
                    onClick={() => void promptInstall()}
                    className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    <Download size={14} /> {t("pwa.install")}
                  </button>
                ) : null
              }
            />
            <InstallCard
              icon={Share}
              title={t("landing.installIos")}
              highlight={showIosHint}
              body=""
              action={
                <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-sm leading-relaxed text-muted-foreground">
                  {t("pwa.iosTap")} <Share size={13} className="inline text-foreground" /> {t("pwa.iosShareThen")}{" "}
                  <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                    <Plus size={13} /> {t("pwa.addToHome")}
                  </span>
                  .
                </p>
              }
            />
            <InstallCard
              icon={Monitor}
              title={t("landing.installDesktop")}
              body={t("landing.installDesktopBody")}
              highlight={!canInstall && !showIosHint && !isStandalone}
              action={
                <Link to={HOME_PATH} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-positive">
                  {t("landing.useInBrowser")} <ArrowRight size={14} />
                </Link>
              }
            />
          </div>
        </section>

        {/* 3 — What you can do */}
        <section className="mt-14">
          <h2 className="font-heading text-2xl font-bold text-foreground">{t("landing.canTitle")}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAN.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-positive">
                  <Icon size={17} />
                </span>
                <span className="text-sm leading-relaxed text-foreground">{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 4 — What it will never do (the non-negotiables, stated plainly) */}
        <section className="mt-14 rounded-xl bg-foreground p-7 text-background lg:p-10">
          <h2 className="font-heading text-2xl font-bold">{t("landing.cantTitle")}</h2>
          <p className="mt-1 text-sm text-background/70">{t("landing.cantSub")}</p>
          <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {CANT.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-start gap-3">
                <Icon size={17} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-sm leading-relaxed text-background/90">{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 5 — Business owners → the LIVE site's page */}
        <section className="mt-14 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-7 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-positive">
              <Store size={20} />
            </span>
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">{t("landing.ownersTitle")}</h2>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">{t("landing.ownersBody")}</p>
            </div>
          </div>
          <a
            href={`${LIVE_SITE}/for-business-owners`}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-95"
          >
            {t("landing.ownersCta")} <ArrowRight size={15} />
          </a>
        </section>
      </main>

      {/* 6 — Footer */}
      <footer className="bg-foreground text-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-8 text-sm">
          <span className="font-heading font-semibold">Redmond Compass</span>
          <span className="text-xs uppercase tracking-[0.22em] text-primary">Discover · Connect · Live Local</span>
          <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-background/80">
            <a href={LIVE_SITE} className="hover:text-background">{t("landing.backToSite")}</a>
            <Link to="/privacy" className="hover:text-background">{t("account.privacy")}</Link>
            <a href="mailto:RedmondCompass@gmail.com" className="hover:text-background">RedmondCompass@gmail.com</a>
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "es" : "en")}
              className="font-medium text-background hover:text-primary"
            >
              {lang === "en" ? "Español" : "English"}
            </button>
          </span>
        </div>
      </footer>
    </div>
  );
}

function InstallCard({
  icon: Icon,
  title,
  body,
  action,
  highlight,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  highlight?: boolean;
}) {
  // The visitor's own platform is expanded by default; the others stay reachable.
  // `highlight` can arrive AFTER mount (beforeinstallprompt fires async) — follow it.
  const [open, setOpen] = useState(!!highlight);
  useEffect(() => {
    if (highlight) setOpen(true);
  }, [highlight]);
  return (
    <div className={cn("rounded-lg border bg-card p-4", highlight ? "border-positive/50 ring-1 ring-positive/20" : "border-border")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 text-left">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", highlight ? "bg-positive/10 text-positive" : "bg-secondary text-muted-foreground")}>
          <Icon size={17} />
        </span>
        <span className="flex-1 font-heading text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown size={15} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 pl-[46px]">
          {body && <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>}
          {action}
        </div>
      )}
    </div>
  );
}
