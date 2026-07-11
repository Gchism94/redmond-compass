import { useMemo, useState } from "react";
import { Bookmark, UserPlus, CalendarPlus, LogIn } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Toggle, ResultCard, EventCard, EmptyState, Skeleton, Button } from "@/components";
import { useBusinesses, useEvents } from "@/data/queries";
import { useSession } from "@/features/account/session";
import { eventsToICS, downloadICS } from "@/lib/calendar";
import type { Business } from "@/lib/types";
import { useI18n } from "@/i18n";

type Tab = "businesses" | "following" | "events";

/** Saved (S7). Tabs: Businesses · Following · Events. (Rewards is deferred — Loyalty.) */
export function SavedScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("businesses");
  const session = useSession();
  const allBiz = useBusinesses({ limit: 50 });
  const allEvents = useEvents({ includePast: true });

  const bizById = useMemo(() => {
    const m = new Map<string, Business>();
    allBiz.data?.items.forEach((b) => m.set(b.id, b));
    return m;
  }, [allBiz.data]);

  const saved = session.savedBusinessIds
    .map((id) => bizById.get(id))
    .filter((b): b is Business => !!b);
  const following = session.followedBusinessIds
    .map((id) => bizById.get(id))
    .filter((b): b is Business => !!b);
  const savedEvents = (allEvents.data ?? []).filter((e) => session.savedEventIds.includes(e.id));

  return (
    <div className="pb-4">
      <ScreenHeader title={t("saved.title")} />
      <div className="px-4 pt-1">
        <Toggle
          ariaLabel={t("saved.filter")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "businesses", label: t("saved.tab.businesses") },
            { value: "following", label: t("saved.tab.following") },
            { value: "events", label: t("saved.tab.events") },
          ]}
        />
      </div>

      {/* Gentle sign-in nudge for guests (never a gate) */}
      {!session.isAuthed && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-border bg-secondary/60 p-3">
          <LogIn size={18} className="shrink-0 text-positive" />
          <p className="flex-1 text-xs text-muted-foreground">
            {t("saved.signInMsg")}
          </p>
          <Button size="sm" variant="ghost" onClick={() => session.openAuth("account")}>
            {t("saved.signIn")}
          </Button>
        </div>
      )}

      <div className="px-4 pt-2">
        {allBiz.isLoading ? (
          <div className="space-y-3 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : tab === "businesses" ? (
          saved.length ? (
            <ul className="divide-y divide-border">
              {saved.map((b) => (
                <li key={b.id}>
                  <ResultCard
                    business={b}
                    origin={session.location ?? undefined}
                    saved={session.isSaved(b.id)}
                    onSave={() => session.toggleSaveBusiness(b.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Bookmark size={20} />}
              title={t("saved.emptyBusinesses")}
              message={t("saved.emptyBusinessesMsg")}
              action={{ label: t("saved.explore"), href: "/search" }}
            />
          )
        ) : tab === "following" ? (
          following.length ? (
            <ul className="divide-y divide-border">
              {following.map((b) => (
                <li key={b.id}>
                  <ResultCard
                    business={b}
                    origin={session.location ?? undefined}
                    saved={session.isSaved(b.id)}
                    onSave={() => session.toggleSaveBusiness(b.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<UserPlus size={20} />}
              title={t("saved.emptyFollowing")}
              message={t("saved.emptyFollowingMsg")}
              action={{ label: t("saved.explore"), href: "/search" }}
            />
          )
        ) : savedEvents.length ? (
          <>
            <button
              type="button"
              onClick={() => downloadICS("redmond-compass-events", eventsToICS(savedEvents))}
              className="mb-1 inline-flex min-h-tap items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none"
            >
              <CalendarPlus size={16} strokeWidth={1.75} /> {t("events.addAll")}
            </button>
            <div className="divide-y divide-border">
              {savedEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  origin={session.location ?? undefined}
                  saved
                  onSave={() => session.toggleSaveEvent(e.id)}
                  addToCalendar
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<CalendarPlus size={20} />}
            title={t("saved.emptyEvents")}
            message={t("saved.emptyEventsMsg")}
            action={{ label: t("events.browse"), href: "/events" }}
          />
        )}
      </div>
    </div>
  );
}
