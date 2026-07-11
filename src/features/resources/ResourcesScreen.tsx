import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Siren, Landmark, Users, Zap, Phone, ExternalLink, LifeBuoy,
  HeartPulse, Brain, GraduationCap, House, Bus, CircleEllipsis,
  ClipboardList, Languages, Flame, Mountain, PawPrint, HeartHandshake, Handshake, BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SearchField, EmptyState, Skeleton } from "@/components";
import { useResources } from "@/data/queries";
import { telHref } from "@/lib/links";
import type { Resource, ResourceCategory } from "@/lib/types";
import { useI18n, type DictKey } from "@/i18n";

// All 10 resource categories (widened for the Base44 import); groups with no
// entries simply don't render, so the screen stays exactly as tight as the data.
// Content-page guides (Stage 1 Phase 2) surfaced above the resource list —
// labels come from the dict (the page copy itself is a lazy chunk per guide).
const GUIDES: { slug: string; icon: LucideIcon }[] = [
  { slug: "getting-settled", icon: ClipboardList },
  { slug: "new-to-the-area", icon: Languages },
  { slug: "help-essentials", icon: LifeBuoy },
  { slug: "seasonal-safety", icon: Flame },
  { slug: "get-outside", icon: Mountain },
  { slug: "pets", icon: PawPrint },
  { slug: "senior-resources", icon: HeartHandshake },
  { slug: "community-organizations", icon: Handshake },
];

const GROUPS: { category: ResourceCategory; icon: LucideIcon }[] = [
  { category: "emergency", icon: Siren },
  { category: "health", icon: HeartPulse },
  { category: "mental_health", icon: Brain },
  { category: "government", icon: Landmark },
  { category: "community", icon: Users },
  { category: "education", icon: GraduationCap },
  { category: "housing", icon: House },
  { category: "transportation", icon: Bus },
  { category: "utilities", icon: Zap },
  { category: "other", icon: CircleEllipsis },
];

/** Resources. Searchable, categorized civic list — the simplest screen, pure utility. */
export function ResourcesScreen() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const { data, isLoading } = useResources({ text: text || undefined });

  const byCategory = useMemo(() => {
    const m = new Map<ResourceCategory, Resource[]>();
    (data ?? []).forEach((r) => {
      const arr = m.get(r.category) ?? [];
      arr.push(r);
      m.set(r.category, arr);
    });
    return m;
  }, [data]);

  return (
    <div className="pb-4">
      <ScreenHeader title={t("home.resources")} />
      <div className="px-4 pt-1">
        <SearchField value={text} onChange={setText} placeholder={t("resources.searchPlaceholder")} />
      </div>

      {/* Guides grid — hidden while searching so results stay front and center */}
      {!text && (
        <section className="px-4 pt-3">
          <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <BookOpen size={13} /> {t("guides.title")}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {GUIDES.map((g) => (
              <Link
                key={g.slug}
                to={`/${g.slug}`}
                className="flex min-h-tap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <g.icon size={16} className="shrink-0 text-positive" />
                <span className="text-[13px] font-medium leading-tight text-foreground">
                  {t(`guides.${g.slug}` as DictKey)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="space-y-3 px-4 pt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={20} />}
          title={t("resources.empty")}
          message={t("resources.emptyMsg")}
          action={{ label: t("events.clear"), onClick: () => setText("") }}
        />
      ) : (
        GROUPS.filter((g) => (byCategory.get(g.category)?.length ?? 0) > 0).map((g) => (
          <section key={g.category} className="px-4 pt-3">
            <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <g.icon size={13} /> {t(`resources.group.${g.category}` as DictKey)}
            </h2>
            <ul className="divide-y divide-border">
              {byCategory.get(g.category)!.map((r) => (
                <ResourceRow key={r.id} resource={r} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ResourceRow({ resource }: { resource: Resource }) {
  const { t } = useI18n();
  const tel = telHref(resource.phone);
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold leading-tight text-foreground">{resource.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{resource.description}</p>
        {resource.address && <p className="mt-0.5 text-xs text-muted-foreground">{resource.address}</p>}
      </div>
      {tel ? (
        <a
          href={tel}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          <Phone size={13} /> {t("common.call")}
        </a>
      ) : resource.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
        >
          <ExternalLink size={13} /> {t("common.open")}
        </a>
      ) : null}
    </li>
  );
}
