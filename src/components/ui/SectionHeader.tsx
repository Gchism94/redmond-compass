import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface SectionHeaderProps {
  title: string;
  /** route for the "See all" link; omit to hide it */
  seeAllHref?: string;
  seeAllLabel?: string;
  /** small/quiet variant (uppercase label) used inside dense screens */
  variant?: "default" | "eyebrow";
  className?: string;
}

/** Section title with optional "See all" link (Home rails, S3, profile sections). */
export function SectionHeader({
  title,
  seeAllHref,
  seeAllLabel = "See all",
  variant = "default",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-3", className)}>
      {variant === "eyebrow" ? (
        <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : (
        <h2 className="font-heading text-md font-semibold text-foreground">{title}</h2>
      )}
      {seeAllHref && (
        <Link
          to={seeAllHref}
          className="shrink-0 text-sm font-semibold text-positive hover:underline"
        >
          {seeAllLabel}
        </Link>
      )}
    </div>
  );
}
