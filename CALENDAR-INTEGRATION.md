# Calendar integration (step 6b)

The pieces are built — `src/lib/calendar.ts`, `AddToCalendar`, `EventCalendar`, `SegmentedToggle`.
This is the wiring: four small edits to screens that already exist. No backend, no auth.

> Times convert to true UTC on export, so `.ics` / Google / Outlook all land on the
> right wall-clock regardless of the user's device timezone. Bulk export is `.ics`
> only (the Google/Outlook deep links are single-event).

---

## 1. Events (S6) — list ⇄ calendar toggle
List stays the default; calendar is the alternate view.

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, CalendarDays } from "lucide-react";
import { SegmentedToggle, EventCalendar } from "../components";

const navigate = useNavigate();
const [view, setView] = useState<"list" | "calendar">("list");

// In the screen header (right-aligned):
<SegmentedToggle
  ariaLabel="Events view"
  value={view}
  onChange={setView}
  options={[
    { value: "list", label: "List", icon: <List className="h-4 w-4" strokeWidth={1.75} /> },
    { value: "calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" strokeWidth={1.75} /> },
  ]}
/>

// Body:
{view === "list" ? (
  <EventsList events={events} />   {/* your existing list */}
) : (
  <EventCalendar events={events} onSelectEvent={(id) => navigate(`/events/${id}`)} />
)}
```

## 2. Event detail (`/events/:id`) — Add to Calendar
```tsx
import { AddToCalendar } from "../components";

// Near the title / hero actions:
<AddToCalendar event={event} />        {/* amber button; menu opens downward */}
```

## 3. Event cards (Events list, Home rail, Saved → Events)
Place `AddToCalendar` as a **sibling** of the card's tappable region — never nested
inside the link/button that navigates (avoids nested-interactive issues, same rule
as ResultCard's action row).

```tsx
import { AddToCalendar } from "../components";

<article className="rounded-lg border border-border bg-card">
  <button onClick={() => navigate(`/events/${e.id}`)} className="block w-full p-3 text-left ...">
    {/* date badge · title · venue · distance */}
  </button>
  <div className="border-t border-border px-3 py-2">
    <AddToCalendar event={e} variant="ghost" />
  </div>
</article>
```

For a card pinned near the bottom of the viewport, open the menu upward:
`<AddToCalendar event={e} variant="ghost" menuPlacement="up" />`

## 4. Saved → Events — "Add all to calendar"
One `.ics` with every saved event.

```tsx
import { CalendarPlus } from "lucide-react";
import { eventsToICS, downloadICS } from "../lib/calendar";

{savedEvents.length > 0 && (
  <button
    type="button"
    onClick={() => downloadICS("redmond-compass-events", eventsToICS(savedEvents))}
    className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <CalendarPlus className="h-4 w-4" strokeWidth={1.75} /> Add all to calendar (.ics)
  </button>
)}
```

---

## Verify
- 390px: toggle + calendar grid fit with no horizontal overflow; day cells ≥ 44px tap.
- Export an event → open the `.ics` → time matches the listing (test once in summer/PDT
  and once in winter/PST to confirm DST).
- Google/Outlook links open a prefilled event in a new tab.
- Reduced-motion: no animation on the toggle (transitions already minimal).

## Deferred (not now)
Live subscription feed (`webcal://` that auto-updates) = a Supabase edge function
serving `.ics` per business/saved-set. Post-MVP.
