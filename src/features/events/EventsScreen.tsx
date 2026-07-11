import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, List, CalendarDays } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  SearchField,
  Chip,
  EventCard,
  EmptyState,
  Skeleton,
  SegmentedToggle,
  EventCalendar,
} from "@/components";
import { useEvents } from "@/data/queries";
import { eventGroup, eventGroupLabel, type EventGroup } from "@/lib/format";
import { useI18n } from "@/i18n";
import { useSession } from "@/features/account/session";
import type { EventItem } from "@/lib/types";

type Quick = "all" | "today" | "weekend" | "free";
const QUICK: { value: Quick; labelKey: "events.filter.all" | "events.filter.today" | "events.filter.weekend" | "events.filter.free" }[] = [
  { value: "all", labelKey: "events.filter.all" },
  { value: "today", labelKey: "events.filter.today" },
  { value: "weekend", labelKey: "events.filter.weekend" },
  { value: "free", labelKey: "events.filter.free" },
];
const ORDER: EventGroup[] = ["today", "weekend", "later"];

/** Events (S6). List (default) ⇄ calendar view; time-grouped list with quick filters. */
export function EventsScreen() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [quick, setQuick] = useState<Quick>("all");
  const [view, setView] = useState<"list" | "calendar">("list");
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
      <ScreenHeader
        title={t("events.title")}
        action={
          <SegmentedToggle
            ariaLabel={t("events.view")}
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t("events.list"), icon: <List size={15} strokeWidth={1.75} /> },
              { value: "calendar", label: t("events.calendar"), icon: <CalendarDays size={15} strokeWidth={1.75} /> },
            ]}
          />
        }
      />
      <div className="px-4 pt-1">
        <SearchField value={text} onChange={setText} placeholder={t("events.searchPlaceholder")} />
        {view === "list" && (
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {QUICK.map((q) => (
              <Chip key={q.value} active={quick === q.value} onClick={() => setQuick(q.value)}>
                {t(q.labelKey)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {view === "calendar" ? (
        <EventCalendar events={data ?? []} onSelectEvent={(id) => navigate(`/events/${id}`)} />
      ) : isLoading ? (
        <div className="space-y-3 px-4 pt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={<Calendar size={20} />}
          title={t("events.empty")}
          message={t("events.emptyMsg")}
          action={{ label: t("search.title"), href: "/search" }}
        />
      ) : (
        ORDER.filter((g) => grouped[g].length > 0).map((g) => (
          <section key={g} className="px-4 pt-3">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {eventGroupLabel(g)}
            </h2>
            <div className="divide-y divide-border">
              {grouped[g].map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  origin={session.location ?? undefined}
                  saved={session.isSavedEvent(e.id)}
                  onSave={() => session.toggleSaveEvent(e.id)}
                  addToCalendar
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
