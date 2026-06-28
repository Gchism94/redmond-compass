import { Phone, Navigation, Bookmark, Plus, Check } from "lucide-react";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/cn";
import { directionsHref, telHref } from "@/lib/links";

export interface ActionBarProps {
  business: Business;
  saved?: boolean;
  following?: boolean;
  /** Save & Follow are auth-gated (JIT login — the only place we ask, step 6). */
  onSave?: (b: Business) => void;
  onFollow?: (b: Business) => void;
  className?: string;
}

/**
 * Sticky profile action bar (S5) — Call · Directions · Save · Follow.
 * Same four verbs as ResultCard. Pinned so it's always one tap away on scroll.
 */
export function ActionBar({
  business,
  saved = false,
  following = false,
  onSave,
  onFollow,
  className,
}: ActionBarProps) {
  const tel = telHref(business.phone);
  return (
    <div
      className={cn(
        "sticky top-0 z-20 grid grid-cols-4 gap-2 border-b border-border bg-background/95 px-3 py-2.5 shadow-sticky backdrop-blur",
        className,
      )}
    >
      <ActionLink
        href={tel}
        disabled={!tel}
        icon={<Phone size={18} />}
        label="Call"
        tone="primary"
      />
      <ActionLink
        href={directionsHref({ address: business.address, geo: business.geo })}
        external
        icon={<Navigation size={18} />}
        label="Directions"
        tone="primary"
      />
      <ActionButton
        active={saved}
        onClick={() => onSave?.(business)}
        icon={<Bookmark size={18} className={saved ? "fill-current" : undefined} />}
        label={saved ? "Saved" : "Save"}
      />
      <ActionButton
        active={following}
        onClick={() => onFollow?.(business)}
        icon={following ? <Check size={18} /> : <Plus size={18} />}
        label={following ? "Following" : "Follow"}
      />
    </div>
  );
}

function ActionLink({
  href,
  external,
  disabled,
  icon,
  label,
  tone,
}: {
  href?: string;
  external?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tone: "primary";
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      aria-disabled={disabled}
      onClick={(e) => disabled && e.preventDefault()}
      className={cn(
        "flex min-h-tap flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition",
        tone === "primary" && "bg-primary text-primary-foreground hover:brightness-95",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

function ActionButton({
  active,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-tap flex-col items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition",
        active
          ? "border-positive bg-positive/10 text-positive"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
