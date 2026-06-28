import { cn } from "@/lib/cn";

export interface CompletenessMeterProps {
  /** 0–100 */
  value: number;
  label?: string;
  /** the single next best action, shown beneath the bar (B4) */
  nextAction?: string;
  className?: string;
}

/**
 * Listing completeness meter (B4 owner edit). Free-tier engagement driver —
 * completeness lifts discoverability. Pine-green fill.
 */
export function CompletenessMeter({
  value,
  label = "Listing completeness",
  nextAction,
  className,
}: CompletenessMeterProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-heading font-semibold text-foreground">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 overflow-hidden rounded-pill bg-muted"
      >
        <div
          className={cn("h-full rounded-pill bg-positive transition-[width]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {nextAction && <p className="mt-1.5 text-xs text-accent">Next: {nextAction}</p>}
    </div>
  );
}
