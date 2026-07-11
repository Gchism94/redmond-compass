import { useMemo, useState } from "react";
import {
  Siren, Landmark, Users, Zap, Phone, ExternalLink, LifeBuoy,
  HeartPulse, Brain, GraduationCap, House, Bus, CircleEllipsis,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SearchField, EmptyState, Skeleton } from "@/components";
import { useResources } from "@/data/queries";
import { telHref } from "@/lib/links";
import type { Resource, ResourceCategory } from "@/lib/types";

// All 10 resource categories (widened for the Base44 import); groups with no
// entries simply don't render, so the screen stays exactly as tight as the data.
const GROUPS: { category: ResourceCategory; label: string; icon: LucideIcon }[] = [
  { category: "emergency", label: "Emergency & safety", icon: Siren },
  { category: "health", label: "Health", icon: HeartPulse },
  { category: "mental_health", label: "Mental health", icon: Brain },
  { category: "government", label: "Government", icon: Landmark },
  { category: "community", label: "Community", icon: Users },
  { category: "education", label: "Education", icon: GraduationCap },
  { category: "housing", label: "Housing", icon: House },
  { category: "transportation", label: "Transportation", icon: Bus },
  { category: "utilities", label: "Utilities", icon: Zap },
  { category: "other", label: "More resources", icon: CircleEllipsis },
];

/** Resources. Searchable, categorized civic list — the simplest screen, pure utility. */
export function ResourcesScreen() {
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
      <ScreenHeader title="Resources" />
      <div className="px-4 pt-1">
        <SearchField value={text} onChange={setText} placeholder="Search resources" />
      </div>

      {isLoading ? (
        <div className="space-y-3 px-4 pt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={20} />}
          title="No resources match"
          message="Try a different search term."
          action={{ label: "Clear search", onClick: () => setText("") }}
        />
      ) : (
        GROUPS.filter((g) => (byCategory.get(g.category)?.length ?? 0) > 0).map((g) => (
          <section key={g.category} className="px-4 pt-3">
            <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <g.icon size={13} /> {g.label}
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
          <Phone size={13} /> Call
        </a>
      ) : resource.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
        >
          <ExternalLink size={13} /> Open
        </a>
      ) : null}
    </li>
  );
}
