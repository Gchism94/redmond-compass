import { useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SearchField, Chip, EventCard, EmptyState, Skeleton } from "@/components";
import { useEvents } from "@/data/queries";
import { eventGroup, EVENT_GROUP_LABEL, type EventGroup } from "@/lib/format";
import { useSession } from "@/features/account/session";
import type { EventItem } from "@/lib/types";

type Quick = "all" | "today" | "weekend" | "free";
const QUICK: { value: Quick; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "weekend", label: "This weekend" },
  { value: "free", label: "Free" },
];
const ORDER: EventGroup[] = ["today", "weekend", "later"];

/** Events (S6). Time-grouped list with quick date filters. Reuses EventCard. */
export function EventsScreen() {
  const [text, setText] = useState("");
  const [quick, setQuick] = useState<Quick>("all");
  const session = useSession();
  const { data, isLoading } = useEvents({ text: text || undefined });

  const grouped = useMemo(() => {
    const buckets: Record<EventGroup, EventItem[]> = { today: [], weekend: [], later: [], past: [] };
    (data ?? []).forEach((e) => {
      const g = eventGroup(e.startAt);
      if (quick === "today" && g !== "today") return;
      if (quick === "weekend" && g !== "weekend") return;
      if (quick === "free" && !(e.tags ?? []).includes("Free")) return;
      if (g !== "past") buckets[g].push(e);
    });
    return buckets;
  }, [data, quick]);

  const total = ORDER.reduce((n, g) => n + grouped[g].length, 0);

  return (
    <div className="pb-4">
      <ScreenHeader title="Events" />
      <div className="px-4 pt-1">
        <SearchField value={text} onChange={setText} placeholder="Search events" />
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {QUICK.map((q) => (
            <Chip key={q.value} active={quick === q.value} onClick={() => setQuick(q.value)}>
              {q.label}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-4 pt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={<Calendar size={20} />}
          title="No events match"
          message="Try a different filter or search the directory for what's happening."
          action={{ label: "Browse businesses", href: "/search" }}
        />
      ) : (
        ORDER.filter((g) => grouped[g].length > 0).map((g) => (
          <section key={g} className="px-4 pt-3">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {EVENT_GROUP_LABEL[g]}
            </h2>
            <div className="divide-y divide-border">
              {grouped[g].map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  origin={session.location ?? undefined}
                  saved={session.isSavedEvent(e.id)}
                  onSave={() => session.toggleSaveEvent(e.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
