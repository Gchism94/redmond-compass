/**
 * Gallery (/_gallery) — renders the shared components with mock data so you can
 * eyeball them against the hi-fi before building screens. Dev-only; remove or
 * guard for production.
 */
import { useState } from "react";
import { List, CalendarDays } from "lucide-react";
import { ResultCard, ActionBar, EventCalendar, AddToCalendar, SegmentedToggle } from "../components";
import { businesses, events } from "../data/mock";

export function Gallery() {
  const featured = businesses[0];
  const [view, setView] = useState<"list" | "calendar">("calendar");

  return (
    <section className="space-y-8 px-4 pt-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground">Component gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">Shared components on mock data.</p>
      </header>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">ResultCard</h2>
        <div className="space-y-3">
          {/* established: open, verified, recommended */}
          <ResultCard business={businesses[0]} distanceMi={0.4} isOpen closesAt="6 PM" recommendCount={43} saved />
          {/* new / unverified: closed, "New to Compass" */}
          <ResultCard business={businesses[2]} distanceMi={1.2} isOpen={false} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">ActionBar</h2>
        <p className="mb-2 text-xs text-ink-faint">(sticks to the bottom of its scroll container on a real screen)</p>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="h-24 bg-surface-sunken" />
          <ActionBar business={featured} saved following={false} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-secondary">AddToCalendar</h2>
        <AddToCalendar event={events[0]} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-secondary">Events view (S6)</h2>
          <SegmentedToggle
            ariaLabel="Events view"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List", icon: <List className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" strokeWidth={1.75} /> },
            ]}
          />
        </div>
        {view === "list" ? (
          <div className="space-y-2">
            {events.map((e) => (
              <article key={e.id} className="rounded-lg border border-border bg-card">
                <div className="p-3">
                  <p className="font-heading text-[15px] font-semibold text-foreground">{e.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{e.venueName}</p>
                </div>
                <div className="border-t border-border px-3 py-2">
                  <AddToCalendar event={e} variant="ghost" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="-mx-4 rounded-lg border border-border py-2">
            <EventCalendar events={events} />
          </div>
        )}
      </div>

      <p className="text-xs text-ink-faint">BottomTabNav renders at the bottom of every screen via AppLayout.</p>
    </section>
  );
}
