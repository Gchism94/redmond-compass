import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Thumb } from "./ui/Thumb";
import { tGlobal } from "@/i18n";

export type FeedItemType = "news" | "bulletin";

export interface FeedItemProps {
  type: FeedItemType;
  title: string;
  /** source/business name */
  sourceLabel: string;
  /** relative time, e.g. "2 days ago" */
  time: string;
  image?: string;
  /** seed for the placeholder thumb (business/source name) */
  seed?: string;
  href?: string;
  /** show the NEWS/BULLETIN tag (Community blends both; Home rails may hide it) */
  showTypeTag?: boolean;
  className?: string;
}

const TAG_STYLE: Record<FeedItemType, string> = {
  news: "bg-secondary text-secondary-foreground border-border",
  bulletin: "bg-positive/10 text-positive border-positive/25",
};

/**
 * Feed row for a bulletin or news article (Home, Community/News). Type-tagged so
 * a blended feed stays legible. No featured/promoted styling — organic order.
 */
export function FeedItem({
  type,
  title,
  sourceLabel,
  time,
  image,
  seed,
  href,
  showTypeTag = true,
  className,
}: FeedItemProps) {
  const body = (
    <>
      <Thumb
        src={image}
        seed={seed ?? sourceLabel}
        alt={sourceLabel}
        className="h-11 w-[54px]"
        rounded="rounded-md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <h3 className="font-heading text-sm font-semibold leading-snug text-foreground">
            {title}
          </h3>
          {showTypeTag && (
            <span
              className={cn(
                "mt-0.5 shrink-0 rounded-pill border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
                TAG_STYLE[type],
              )}
            >
              {tGlobal(type === "news" ? "feed.news" : "feed.bulletin")}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {sourceLabel} · {time}
        </p>
      </div>
    </>
  );

  const cls = cn("flex gap-3 py-3", className);
  return href ? (
    <Link to={href} className={cn(cls, "focus-visible:outline-none")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
