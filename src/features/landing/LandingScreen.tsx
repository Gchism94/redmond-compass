import { useEffect, useId, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight, Ban, Bookmark, BookOpen, CalendarDays, ChevronDown, Compass, Download,
  Eye, Home, Info, Languages, LockOpen, MapPin, Monitor, Plus, Scale, Search, Share,
  ShieldCheck, Smartphone, Star, Store, UserPlus, WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useInstallPrompt } from "@/pwa/useInstallPrompt";
import { usePageMeta } from "@/lib/pageMeta";
import { useI18n, type DictKey } from "@/i18n";
import { HOME_PATH, LIVE_SITE } from "@/lib/siteMode";
import { cn } from "@/lib/cn";

/** An installed app opens the app itself, never this introduction. */
export function LandingGate() {
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  if (standalone) return <Navigate to={HOME_PATH} replace />;
  return <LandingScreen />;
}

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
      <header className="border-b border-border bg-card/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <a href={LIVE_SITE} className="flex min-h-tap shrink-0 items-center gap-2.5" aria-label="Redmond Compass">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Compass size={19} />
            </span>
            <span className="leading-none">
              <span className="block font-heading text-lg font-bold text-foreground">Redmond</span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.3em] text-primary">Compass</span>
            </span>
          </a>
          <nav aria-label="redmondcompass.com" className="ml-3 hidden items-center gap-5 md:flex">
            {SITE_NAV.map((item) => (
              <a key={item.path} href={`${LIVE_SITE}${item.path}`} className="inline-flex min-h-tap items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {t(item.labelKey)}
              </a>
            ))}
          </nav>
          <button type="button" onClick={() => navigate(HOME_PATH)} className="ml-auto inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">
            {t("landing.open")} <ArrowRight size={15} />
          </button>
        </div>
      </header>

      <main className="pb-16">
        <section className="mx-auto max-w-6xl px-5 pt-5 sm:pt-8">
          <div className="overflow-hidden rounded-[28px] border border-foreground/10 bg-foreground shadow-lift lg:grid lg:min-h-[470px] lg:grid-cols-[1fr_1.35fr]">
            <div className="relative z-10 flex flex-col justify-center px-7 py-8 text-background sm:px-10 sm:py-10 lg:px-12">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-chart-4">
                <MapPin size={14} /> {t("landing.eyebrow")}
              </p>
              <h1 className="mt-4 max-w-xl font-heading text-4xl font-bold leading-[1.06] sm:mt-5 sm:text-5xl">{t("landing.heroTitle")}</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-background/80 sm:mt-5">{t("landing.heroSub")}</p>
              <div className="mt-6 grid gap-3 sm:mt-7 sm:flex sm:flex-wrap">
                <button type="button" onClick={() => navigate(HOME_PATH)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-background px-6 text-base font-semibold text-foreground transition-colors hover:bg-secondary sm:w-auto">
                  {t("landing.open")} <ArrowRight size={17} />
                </button>
                <button type="button" onClick={install} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-background/35 px-6 text-base font-semibold text-background transition-colors hover:bg-background/10 sm:w-auto">
                  <Download size={17} /> {t("landing.install")}
                </button>
              </div>
              <p className="mt-5 flex max-w-xl items-start gap-2 text-xs leading-relaxed text-background/70 sm:mt-6">
                <Info size={14} className="mt-0.5 shrink-0 text-chart-4" /> {t("landing.accountNote")}
              </p>
            </div>

            <div className="relative aspect-[2/1] overflow-hidden bg-secondary sm:aspect-auto sm:min-h-[430px] lg:min-h-full">
              <img src="/web/hero.jpg" alt={t("web.hero.imageAlt")} className="absolute inset-0 h-full w-full object-cover object-center" width={1200} height={600} />
              <div className="absolute inset-0 hidden bg-gradient-to-t from-foreground/35 via-transparent to-transparent sm:block" />
              <div className="absolute inset-x-0 bottom-0 hidden justify-center px-5 sm:flex sm:justify-end sm:px-9">
                <AppPreview />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-6xl px-5 sm:mt-20">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Redmond Compass</p>
              <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-foreground">{t("landing.canTitle")}</h2>
            </div>
            <ul className="grid border-t border-border sm:grid-cols-2">
              {CAN.map(({ key, icon: Icon }) => (
                <li key={key} className="flex min-h-24 items-start gap-3 border-b border-border py-5 sm:odd:pr-6 sm:even:border-l sm:even:pl-6">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-positive"><Icon size={17} /></span>
                  <span className="text-sm leading-6 text-card-foreground">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-6xl px-5 sm:mt-20">
          <div className="rounded-[24px] bg-secondary px-6 py-8 sm:px-9 sm:py-10 lg:grid lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <h2 className="font-heading text-3xl font-bold leading-tight text-foreground">{t("landing.cantTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("landing.cantSub")}</p>
            </div>
            <ul className="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:mt-0">
              {CANT.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-start gap-3">
                  <Icon size={17} className="mt-0.5 shrink-0 text-primary" />
                  <span className="text-sm leading-6 text-card-foreground">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="install" className="mx-auto mt-16 max-w-6xl scroll-mt-6 px-5 sm:mt-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("landing.installLabel")}</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground">{t("landing.installTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("landing.installSub")}</p>
          </div>
          <div className="mt-6 grid items-start gap-3 md:grid-cols-3">
            <InstallCard icon={Smartphone} title={t("landing.installAndroid")} body={t("landing.installAndroidBody")} highlight={canInstall} action={canInstall ? (
              <button type="button" onClick={() => void promptInstall()} className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                <Download size={14} /> {t("pwa.install")}
              </button>
            ) : null} />
            <InstallCard icon={Share} title={t("landing.installIos")} highlight={showIosHint} body="" action={
              <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-sm leading-relaxed text-muted-foreground">
                {t("pwa.iosTap")} <Share size={13} className="inline text-foreground" /> {t("pwa.iosShareThen")} {" "}
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground"><Plus size={13} /> {t("pwa.addToHome")}</span>.
              </p>
            } />
            <InstallCard icon={Monitor} title={t("landing.installDesktop")} body={t("landing.installDesktopBody")} highlight={!canInstall && !showIosHint && !isStandalone} action={
              <Link to={HOME_PATH} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-positive">{t("landing.useInBrowser")} <ArrowRight size={14} /></Link>
            } />
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-6xl px-5 sm:mt-20">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[24px] border border-border bg-card p-7 shadow-card sm:flex-row sm:items-center sm:p-9">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Store size={20} /></span>
              <div>
                <h2 className="font-heading text-xl font-semibold text-foreground">{t("landing.ownersTitle")}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t("landing.ownersBody")}</p>
              </div>
            </div>
            <a href={`${LIVE_SITE}/for-business-owners`} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-navy-soft">
              {t("landing.ownersCta")} <ArrowRight size={15} />
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-8 text-sm">
          <span className="font-heading font-semibold">Redmond Compass</span>
          <span className="text-xs uppercase tracking-[0.22em] text-chart-4">Redmond, Oregon</span>
          <span className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-background/80">
            <a href={LIVE_SITE} className="inline-flex min-h-tap items-center hover:text-background">{t("landing.backToSite")}</a>
            <Link to="/privacy" className="inline-flex min-h-tap items-center hover:text-background">{t("account.privacy")}</Link>
            <a href="mailto:RedmondCompass@gmail.com" className="inline-flex min-h-tap items-center hover:text-background">RedmondCompass@gmail.com</a>
            <button type="button" onClick={() => setLang(lang === "en" ? "es" : "en")} className="inline-flex min-h-tap items-center font-medium text-background hover:text-chart-4">
              {lang === "en" ? "Español" : "English"}
            </button>
          </span>
        </div>
      </footer>
    </div>
  );
}

function AppPreview() {
  const { t } = useI18n();
  return (
    <div aria-hidden="true" className="w-[250px] translate-y-8 rounded-t-[32px] border-[7px] border-b-0 border-foreground bg-background p-3 shadow-2xl sm:w-[278px]">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-pill bg-foreground/20" />
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Compass size={16} /></span>
        <div className="leading-none">
          <p className="font-heading text-base font-bold text-foreground">Redmond Compass</p>
          <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-primary">Redmond, Oregon</p>
        </div>
      </div>
      <div className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] text-muted-foreground shadow-sm">
        <Search size={13} /> {t("landing.previewSearch")}
      </div>
      <div className="mt-2 inline-flex items-center gap-1 rounded-pill bg-positive-tint px-2.5 py-1 text-[9px] font-semibold text-positive">
        <MapPin size={10} /> {t("landing.previewNearby")}
      </div>
      <div className="mt-4 space-y-2">
        <PreviewRow icon={Store} label={t("landing.previewDirectory")} />
        <PreviewRow icon={CalendarDays} label={t("landing.previewEvents")} />
        <PreviewRow icon={BookOpen} label={t("landing.previewResources")} />
      </div>
      <div className="mt-4 grid grid-cols-4 border-t border-border pt-2 text-positive">
        {[Home, Search, CalendarDays, Bookmark].map((Icon, index) => <span key={index} className="flex justify-center"><Icon size={14} /></span>)}
      </div>
    </div>
  );
}

function PreviewRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Icon size={15} /></span>
      <span className="text-[11px] font-semibold text-foreground">{label}</span>
      <ArrowRight size={12} className="ml-auto text-muted-foreground" />
    </div>
  );
}

function InstallCard({ icon: Icon, title, body, action, highlight }: { icon: LucideIcon; title: string; body: string; action?: React.ReactNode; highlight?: boolean }) {
  const panelId = useId();
  const [open, setOpen] = useState(!!highlight);
  useEffect(() => {
    if (highlight) setOpen(true);
  }, [highlight]);
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-card", highlight ? "border-positive/50 ring-1 ring-positive/20" : "border-border")}>
      <button type="button" aria-controls={panelId} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-h-tap w-full items-center gap-2.5 text-left">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", highlight ? "bg-positive/10 text-positive" : "bg-secondary text-muted-foreground")}><Icon size={17} /></span>
        <span className="flex-1 font-heading text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown size={15} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div id={panelId} className="mt-2 pl-[46px]">{body && <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>}{action}</div>}
    </div>
  );
}
