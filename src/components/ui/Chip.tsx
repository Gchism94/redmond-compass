import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChipProps {
  children: ReactNode;
  /** filled pine-green when active (selected filter / quick filter on) */
  active?: boolean;
  /** renders a × affordance and calls onRemove (active filter chips, S4) */
  onRemove?: () => void;
  onClick?: () => void;
  /** render as a button (interactive) vs static label */
  as?: "button" | "span";
  leadingIcon?: ReactNode;
  className?: string;
}

/**
 * Pill / chip — quick filters, amenity facets, removable active filters, category tags.
 * Active = pine-green (positive role). Static tags use as="span".
 */
export function Chip({
  children,
  active,
  onRemove,
  onClick,
  as = onClick || onRemove ? "button" : "span",
  leadingIcon,
  className,
}: ChipProps) {
  const Comp = as;
  return (
    <Comp
      {...(as === "button" ? { type: "button" as const, onClick } : {})}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-positive bg-positive/10 text-positive"
          : "border-border bg-card text-foreground",
        as === "button" && "hover:border-positive/60 focus-visible:outline-none",
        className,
      )}
    >
      {leadingIcon}
      <span>{children}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Remove filter"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRemove();
            }
          }}
          className="-mr-1 ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full opacity-70 hover:opacity-100"
        >
          <X size={13} />
        </span>
      )}
    </Comp>
  );
}
