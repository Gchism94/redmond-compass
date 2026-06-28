/**
 * Component gallery (BUILD-BRIEF §12 step 2) — every shared design-system
 * component rendered against the tokens, so the system can be reviewed before
 * screens are built. Route: /gallery.
 */
import { useState } from "react";
import { Phone, Search as SearchIcon, UtensilsCrossed, MoreHorizontal } from "lucide-react";
import {
  Button,
  IconButton,
  Chip,
  Toggle,
  Switch,
  Card,
  Skeleton,
  SectionHeader,
  StatusBadge,
  VerifiedBadge,
  OpenStatusLabel,
  CompletenessMeter,
  EmptyState,
  Thumb,
  ResultCard,
  ActionBar,
} from "@/components";
import { businesses } from "@/data/mock/seed";

function Swatch({ name, className, hex }: { name: string; className: string; hex: string }) {
  return (
    <div className="text-center">
      <div className={`h-14 w-full rounded-lg border border-border ${className}`} />
      <div className="mt-1 text-xs font-medium text-foreground">{name}</div>
      <div className="text-[10px] text-muted-foreground">{hex}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-4 py-6">
      <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function GalleryPage() {
  const [seg, setSeg] = useState<"list" | "map">("list");
  const [notif, setNotif] = useState(true);
  const [openNow, setOpenNow] = useState(true);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const demo = businesses[0];
  const photoless = businesses.find((b) => b.photos.length === 0) ?? businesses[2];

  return (
    <div className="pb-10">
      <header className="px-4 pt-5">
        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-positive">
          Design system
        </p>
        <h1 className="font-heading text-2xl font-bold text-foreground">Component gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every shared component, wired to <code>design-tokens.css</code>. Playfair for display,
          DM Sans for everything else. No stars, no featured slots.
        </p>
      </header>

      <Group title="Color tokens">
        <div className="grid grid-cols-3 gap-3">
          <Swatch name="primary" className="bg-primary" hex="#C86604 amber" />
          <Swatch name="accent" className="bg-accent" hex="#D76942 terra" />
          <Swatch name="positive" className="bg-positive" hex="#2E6049 pine" />
          <Swatch name="foreground" className="bg-foreground" hex="#082954 navy" />
          <Swatch name="background" className="bg-background" hex="#FAF8F5 cream" />
          <Swatch name="secondary" className="bg-secondary" hex="#F3EBE2 warm" />
        </div>
      </Group>

      <Group title="Typography">
        <h1 className="font-heading text-3xl font-bold text-foreground">Display · Playfair</h1>
        <h2 className="font-heading text-xl font-semibold text-foreground">Section head · Playfair</h2>
        <p className="text-base text-foreground">
          Body copy is DM Sans — functional, legible, used for everything that isn't a heading.
        </p>
        <p className="text-sm text-muted-foreground">
          Metadata / secondary text — DM Sans, muted (distance, "2 days ago").
        </p>
      </Group>

      <Group title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Call</Button>
          <Button variant="positive">Open now</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <IconButton label="Call"><Phone size={18} /></IconButton>
          <IconButton label="More" variant="solid"><MoreHorizontal size={18} /></IconButton>
        </div>
      </Group>

      <Group title="Chips & filters">
        <div className="flex flex-wrap gap-2">
          <Chip active={openNow} onClick={() => setOpenNow((v) => !v)} leadingIcon={<span className="h-2 w-2 rounded-full bg-current" />}>
            Open now
          </Chip>
          <Chip onClick={() => {}}>Near me</Chip>
          <Chip>Wi-Fi</Chip>
          <Chip active>Kid-friendly</Chip>
          <Chip onRemove={() => {}} active>
            &lt; 2 mi
          </Chip>
        </div>
      </Group>

      <Group title="Toggle & switch">
        <Toggle
          ariaLabel="Results view"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "list", label: "List" },
            { value: "map", label: "Map" },
          ]}
        />
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <span className="text-sm text-foreground">Bulletins from places you follow</span>
          <Switch checked={notif} onChange={setNotif} label="Bulletin notifications" />
        </div>
      </Group>

      <Group title="Section header">
        <SectionHeader title="Open now near you" seeAllHref="/search/results" />
        <SectionHeader title="Recent" variant="eyebrow" />
      </Group>

      <Group title="Badges & status (no stars — by design)">
        <div className="flex flex-wrap items-center gap-2">
          <VerifiedBadge />
          <StatusBadge tone="positive">Posts weekly</StatusBadge>
          <StatusBadge tone="neutral">Replies in a day</StatusBadge>
          <StatusBadge tone="info">Local since 2019</StatusBadge>
          <StatusBadge tone="accent">New to Compass</StatusBadge>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <OpenStatusLabel hours={demo.hours} trailing="0.4 mi" />
        </div>
      </Group>

      <Group title="Completeness meter (owner)">
        <Card className="p-4">
          <CompletenessMeter value={70} nextAction="add 2 photos · add holiday hours" />
        </Card>
      </Group>

      <Group title="Thumbnails (branded placeholder fallback)">
        <div className="flex gap-3">
          <Thumb src={demo.photos[0]} seed={demo.name} alt={demo.name} className="h-16 w-16" rounded="rounded-lg" />
          <Thumb seed={photoless.name} alt={photoless.name} className="h-16 w-16" rounded="rounded-lg" />
          <Thumb alt="no seed" className="h-16 w-16" rounded="rounded-lg" />
        </div>
        <p className="text-xs text-muted-foreground">
          Free, photo-less listings still read complete — never broken.
        </p>
      </Group>

      <Group title="ResultCard — row (S4 / Saved)">
        <Card className="px-3">
          <ResultCard business={demo} saved={saved} onSave={() => setSaved((v) => !v)} />
          <div className="border-t border-border" />
          <ResultCard business={photoless} />
        </Card>
        <p className="text-xs text-muted-foreground">
          Recommend count is a deferred (fast-follow) seam — off by default at MVP:
        </p>
        <Card className="px-3">
          <ResultCard business={businesses[1]} showRecommend />
        </Card>
      </Group>

      <Group title="ResultCard — rail (Home)">
        <div className="no-scrollbar flex gap-3 overflow-x-auto">
          {businesses.slice(0, 5).map((b) => (
            <ResultCard key={b.id} business={b} variant="rail" />
          ))}
        </div>
      </Group>

      <Group title="ActionBar — sticky (S5 profile)">
        <Card className="overflow-hidden">
          <ActionBar
            business={demo}
            saved={saved}
            following={following}
            onSave={() => setSaved((v) => !v)}
            onFollow={() => setFollowing((v) => !v)}
            className="!static"
          />
        </Card>
      </Group>

      <Group title="Empty state (always routes forward)">
        <Card>
          <EmptyState
            icon={<SearchIcon size={22} />}
            title="No rewards yet"
            message="Join a loyalty program at a local business and your cards show up here."
            action={{ label: "Find local businesses", href: "/search" }}
          />
        </Card>
      </Group>

      <Group title="Loading skeletons">
        <Card className="flex gap-3 p-3">
          <Skeleton className="h-[58px] w-[58px] rounded-lg" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
      </Group>

      <Group title="Category tile (browse grid)">
        <div className="grid grid-cols-4 gap-3">
          {["Food & Drink", "Services", "Retail", "Health"].map((c) => (
            <div key={c} className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-positive">
                <UtensilsCrossed size={20} />
              </div>
              <span className="text-center text-[10px] font-medium text-foreground">{c}</span>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}
