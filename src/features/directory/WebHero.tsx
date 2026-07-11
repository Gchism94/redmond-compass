import { Link, useNavigate } from "react-router-dom";
import {
  MapPin, Store, CalendarDays, Share2, ArrowRight, LifeBuoy, Newspaper, Users, TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n, type DictKey } from "@/i18n";

/**
 * Desktop-only home hero + quick-link tiles, matching the original
 * redmondcompass.com landing (Phase 0 crawl): navy panel with the "Your Guide
 * to Redmond Living" headline and stacked CTAs beside the "Greetings from
 * Redmond" mural, then the white shortcut tiles. The original's Yard Sales tile
 * returns with that feature; its "Featured Businesses" section deliberately
 * does not (equal ranking).
 */

const TILES: { to: string; titleKey: DictKey; subKey: DictKey; icon: LucideIcon }[] = [
  { to: "/search", titleKey: "web.tile.directory", subKey: "web.tile.directorySub", icon: Store },
  { to: "/events", titleKey: "web.tile.events", subKey: "web.tile.eventsSub", icon: CalendarDays },
  { to: "/resources", titleKey: "web.tile.resources", subKey: "web.tile.resourcesSub", icon: LifeBuoy },
  { to: "/community", titleKey: "web.tile.news", subKey: "web.tile.newsSub", icon: Newspaper },
  { to: "/community", titleKey: "web.tile.community", subKey: "web.tile.communitySub", icon: Users },
  { to: "/for-business-owners", titleKey: "web.tile.owners", subKey: "web.tile.ownersSub", icon: TrendingUp },
];

export function WebHero() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const share = async () => {
    const data = { title: "Redmond Compass", url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
    } catch {
      /* user dismissed the share sheet */
    }
  };

  return (
    <div className="pt-6">
      {/* Split hero — navy panel + mural, per the original site */}
      <section className="grid overflow-hidden rounded-xl lg:grid-cols-2">
        <div className="bg-foreground p-10 text-background">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-background/70">
            <MapPin size={13} /> {t("web.hero.eyebrow")}
          </p>
          <h1 className="mt-3 font-heading text-[42px] font-bold leading-[1.08]">{t("web.hero.title")}</h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-background/75">{t("web.hero.sub")}</p>
          <div className="mt-6 flex max-w-xs flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-background text-sm font-semibold text-foreground hover:brightness-95"
            >
              <Store size={15} /> {t("web.hero.explore")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/events")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-background/30 text-sm font-semibold text-background hover:bg-background/10"
            >
              <CalendarDays size={15} /> {t("web.hero.events")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/for-business-owners")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:brightness-95"
            >
              <TrendingUp size={15} /> {t("web.hero.owners")}
            </button>
            <button
              type="button"
              onClick={share}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-background/10 text-sm font-semibold text-background/85 hover:bg-background/20"
            >
              <Share2 size={15} /> {t("web.hero.share")}
            </button>
          </div>
        </div>
        <img src="/web/hero.jpg" alt={t("web.hero.imageAlt")} className="h-full min-h-[380px] w-full object-cover" />
      </section>

      {/* Quick-link tiles */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        {TILES.map((tile) => (
          <Link
            key={tile.titleKey}
            to={tile.to}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition hover:bg-muted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              <tile.icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm font-semibold text-foreground">{t(tile.titleKey)}</span>
              <span className="block truncate text-xs text-muted-foreground">{t(tile.subKey)}</span>
            </span>
            <ArrowRight size={15} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </section>
    </div>
  );
}
