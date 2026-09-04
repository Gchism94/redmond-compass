import type { LucideIcon } from "lucide-react";
import { CalendarPlus, ExternalLink, Megaphone, Presentation } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { OWNER_LINKS } from "@/lib/siteMode";
import { useI18n, type DictKey } from "@/i18n";

export type MainSiteContentKind = "post" | "event" | "class";

const CONFIG: Record<MainSiteContentKind, { icon: LucideIcon; href: string; titleKey: DictKey; bodyKey: DictKey; actionKey: DictKey }> = {
  post: {
    icon: Megaphone,
    href: OWNER_LINKS.post,
    titleKey: "owner.submitPostOnMainSite",
    bodyKey: "owner.submitPostOnMainSiteBody",
    actionKey: "owner.openPostRegistration",
  },
  event: {
    icon: CalendarPlus,
    href: OWNER_LINKS.event,
    titleKey: "owner.submitEventOnMainSite",
    bodyKey: "owner.submitEventOnMainSiteBody",
    actionKey: "owner.openEventRegistration",
  },
  class: {
    icon: Presentation,
    href: OWNER_LINKS.dashboard,
    titleKey: "owner.addClassOnMainSite",
    bodyKey: "owner.addClassOnMainSiteBody",
    actionKey: "owner.openClassRegistration",
  },
};

/** App-only content routes terminate here so even a bookmarked legacy editor cannot
 *  create a second, conflicting source record. */
export function MainSiteContentHandoff({ kind }: { kind: MainSiteContentKind }) {
  const { t } = useI18n();
  const config = CONFIG[kind];
  const Icon = config.icon;

  return (
    <div className="pb-8">
      <ScreenHeader title={t(config.titleKey)} back />
      <div className="mx-auto max-w-xl px-4 pt-3">
        <Card className="p-5 sm:p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon size={22} aria-hidden />
          </span>
          <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">{t(config.titleKey)}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(config.bodyKey)}</p>
          <a
            href={config.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-95 sm:w-auto"
          >
            {t(config.actionKey)} <ExternalLink size={16} aria-hidden />
          </a>
          <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            {t("owner.approvedContentSyncNote")}
          </p>
        </Card>
      </div>
    </div>
  );
}
