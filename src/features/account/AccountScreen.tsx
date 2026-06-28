import { useState } from "react";
import {
  ChevronRight,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  Store,
  Check,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Switch, Chip, Button } from "@/components";
import { Sheet } from "@/components/ui/Sheet";
import { INTERESTS } from "@/lib/taxonomy";
import { useSession } from "./session";

/** Account (S8). Status, interests, notification prefs, location, switch-to-business. */
export function AccountScreen() {
  const s = useSession();
  const [editInterests, setEditInterests] = useState(false);
  const [bizNote, setBizNote] = useState(false);

  return (
    <div className="pb-6">
      <ScreenHeader title="Account" />

      {/* Status */}
      <section className="px-4 pt-1">
        {s.isAuthed ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary font-heading text-md font-semibold text-positive">
              {s.user!.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-semibold text-foreground">{s.user!.name}</p>
              <p className="truncate text-xs text-muted-foreground">Signed in · syncing saves</p>
            </div>
            <button
              type="button"
              onClick={s.signOut}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/60 p-3">
            <LogIn size={20} className="shrink-0 text-positive" />
            <div className="flex-1">
              <p className="font-heading text-sm font-semibold text-foreground">Browsing as a guest</p>
              <p className="text-xs text-muted-foreground">Sign in to sync saves, follows & prefs.</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => s.openAuth("account")}>
              Sign in
            </Button>
          </div>
        )}
      </section>

      {/* Interests */}
      <Section title="Your interests" onAction={() => setEditInterests(true)} actionLabel="Edit">
        {s.interests.length ? (
          <div className="flex flex-wrap gap-2">
            {s.interests.map((i) => (
              <Chip key={i} active as="span">
                {i}
              </Chip>
            ))}
            <Chip leadingIcon={<Plus size={12} />} onClick={() => setEditInterests(true)}>
              Add
            </Chip>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditInterests(true)}
            className="text-sm font-medium text-positive"
          >
            + Add interests to personalize your feed
          </button>
        )}
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <ToggleRow
          label="Bulletins from places you follow"
          checked={s.notificationPrefs.followedBulletins}
          onChange={(v) => s.setNotificationPref("followedBulletins", v)}
        />
        <ToggleRow
          label="Saved-event reminders"
          checked={s.notificationPrefs.savedEvents}
          onChange={(v) => s.setNotificationPref("savedEvents", v)}
        />
        <ToggleRow
          label="Local news"
          checked={s.notificationPrefs.localNews}
          onChange={(v) => s.setNotificationPref("localNews", v)}
        />
      </Section>

      {/* Switch to Business */}
      <section className="px-4 py-3">
        <button
          type="button"
          onClick={() => setBizNote((v) => !v)}
          className="flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
        >
          <Store size={16} /> Switch to Business
        </button>
        {bizNote && (
          <p className="mt-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            Business tools — claim your listing, dashboard, edit, post bulletins & events — arrive in the next update (owner path).
          </p>
        )}
      </section>

      {/* Location + links */}
      <Section title="Settings">
        <div className="flex items-center justify-between py-3 text-sm">
          <span className="flex items-center gap-2 text-foreground">
            <MapPin size={15} className="text-muted-foreground" /> Location
          </span>
          <LocationControl />
        </div>
        <LinkRow label="About & Contact" href="https://redmondcompass.com" external />
        <LinkRow label="Help" href="https://redmondcompass.com" external />
        <LinkRow label="Privacy & terms" href="https://redmondcompass.com" external />
      </Section>

      <p className="px-4 pt-2 text-center text-xs text-muted-foreground">Redmond Compass · v0.1 (MVP)</p>

      {/* Interest editor */}
      <Sheet open={editInterests} onClose={() => setEditInterests(false)} title="Your interests">
        <p className="mb-3 text-sm text-muted-foreground">
          Pick what you're into — we'll use it to personalize your Home feed.
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Chip key={i} active={s.interests.includes(i)} onClick={() => s.toggleInterest(i)}>
              {s.interests.includes(i) && <Check size={12} />} {i}
            </Chip>
          ))}
        </div>
        <Button variant="primary" size="lg" fullWidth className="mt-5" onClick={() => setEditInterests(false)}>
          Done
        </Button>
      </Sheet>
    </div>
  );
}

function Section({
  title,
  children,
  onAction,
  actionLabel,
}: {
  title: string;
  children: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <section className="border-t border-border px-4 py-3 first:border-t-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
        {onAction && (
          <button type="button" onClick={onAction} className="text-xs font-semibold text-positive">
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-foreground">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function LinkRow({ label, href, external }: { label: string; href: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex items-center justify-between py-3 text-sm text-foreground"
    >
      {label}
      <ChevronRight size={16} className="text-muted-foreground" />
    </a>
  );
}

function LocationControl() {
  const s = useSession();
  const [busy, setBusy] = useState(false);
  if (s.location) {
    return (
      <button
        type="button"
        onClick={() => s.setLocation(null)}
        className="text-sm font-medium text-positive"
      >
        Using your location · Clear
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (!("geolocation" in navigator)) return;
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            s.setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setBusy(false);
          },
          () => setBusy(false),
          { timeout: 8000 },
        );
      }}
      className="text-sm font-medium text-positive"
    >
      {busy ? "Locating…" : "Redmond, OR · Use mine"}
    </button>
  );
}
