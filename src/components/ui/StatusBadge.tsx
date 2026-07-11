import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { tGlobal } from "@/i18n";

type Tone = "positive" | "neutral" | "accent" | "info";

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  positive: "bg-positive/10 text-positive border-positive/25",
  neutral: "bg-muted text-muted-foreground border-border",
  accent: "bg-accent/12 text-accent border-accent/25",
  info: "bg-secondary text-secondary-foreground border-border",
};

/**
 * Factual, non-rating badge: "Verified", "Posts weekly", "Replies in a day",
 * "New to Compass". No stars, no scores (BUILD-BRIEF §8).
 */
export function StatusBadge({ children, tone = "neutral", icon, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Automatic "claimed & verified" badge — the only MVP reputation signal. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <StatusBadge tone="positive" icon={<Check size={12} strokeWidth={3} />} className={className}>
      {tGlobal("status.verified")}
    </StatusBadge>
  );
}
