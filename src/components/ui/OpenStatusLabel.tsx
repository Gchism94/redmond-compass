import type { Hours } from "@/lib/types";
import { getOpenStatus } from "@/lib/hours";
import { cn } from "@/lib/cn";

export interface OpenStatusLabelProps {
  hours?: Hours;
  /** trailing meta to append after the status, e.g. "0.4 mi" */
  trailing?: string;
  className?: string;
}

/**
 * "● Open · closes 6:00 PM · 0.4 mi" — the most-glanced element on cards/profile.
 * "Open" is pine-green (positive role); closed is muted. No rating ever appears here.
 */
export function OpenStatusLabel({ hours, trailing, className }: OpenStatusLabelProps) {
  const status = getOpenStatus(hours);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 text-sm", className)}>
      <span
        className={cn(
          "inline-flex items-center font-semibold",
          status.open ? "text-positive" : "text-muted-foreground",
        )}
      >
        {status.state !== "unknown" && (
          <span
            aria-hidden
            className={cn(
              "mr-1 inline-block h-1.5 w-1.5 rounded-full",
              status.open ? "bg-positive" : "bg-muted-foreground",
            )}
          />
        )}
        {status.label}
      </span>
      {status.detail && <span className="text-muted-foreground">· {status.detail}</span>}
      {trailing && <span className="text-muted-foreground">· {trailing}</span>}
    </span>
  );
}
