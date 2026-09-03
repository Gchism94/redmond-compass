import { Link } from "react-router-dom";
import { CalendarDays, Landmark, Megaphone, Newspaper, Store, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { Thumb } from "./ui/Thumb";
import { BusinessImageFallback } from "./BusinessThumb";
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
  excerpt?: string;
  category?: string;
  businessCategory?: string;
  /** seed for the placeholder thumb (business/source name) */
  seed?: string;
  href?: string;
  /** show the NEWS/BULLETIN tag (Community blends both; Home rails may hide it) */
  showTypeTag?: boolean;
  /** Card treatment for full feed screens; compact rows remain available for Home/profile. */
  card?: boolean;
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
  excerpt,
  category,
  businessCategory,
  seed,
  href,
  showTypeTag = true,
  card = false,
  className,
}: FeedItemProps) {
  if (type === "news") {
    const newsBody = (
      <>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {showTypeTag && (
              <span className={cn(
                "rounded-pill border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
                TAG_STYLE.news,
              )}>
                {tGlobal("feed.news")}
              </span>
            )}
            {category && <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">{category}</span>}
          </div>
          <h3 className="mt-1 line-clamp-2 font-heading text-sm font-semibold leading-snug text-foreground">
            {title}
          </h3>
          {excerpt && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{excerpt}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{sourceLabel} · {time}</p>
        </div>
        <Thumb
          src={image}
          alt={title}
          className="h-16 w-20 border border-border/70"
          rounded="rounded-lg"
          fallback={(
            <NewsImageFallback title={title} category={category} />
          )}
        />
      </>
    );
    const newsClass = cn(
      "flex items-start gap-3 py-3",
      card && "rounded-xl border border-border bg-card p-3 shadow-card transition hover:border-border-strong hover:shadow-lift",
      className,
    );
    return href ? (
      <Link to={href} className={cn(newsClass, "focus-visible:outline-none")}>{newsBody}</Link>
    ) : (
      <div className={newsClass}>{newsBody}</div>
    );
  }

  const body = (
    <>
      <Thumb
        src={image}
        seed={seed ?? sourceLabel}
        alt={sourceLabel}
        className="h-11 w-[54px]"
        rounded="rounded-md"
        fallback={businessCategory
          ? <BusinessImageFallback category={businessCategory} />
          : <Megaphone size={20} className="text-positive/70" />}
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
              {tGlobal("feed.bulletin")}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {sourceLabel} · {time}
        </p>
      </div>
    </>
  );

  const cls = cn(
    "flex gap-3 py-3",
    card && "rounded-xl border border-border bg-card p-3 shadow-card transition hover:border-border-strong hover:shadow-lift",
    className,
  );
  return href ? (
    <Link to={href} className={cn(cls, "focus-visible:outline-none")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const NEWS_TONES = [
  "bg-primary text-primary-foreground",
  "bg-positive text-background",
  "bg-foreground text-background",
  "bg-accent text-accent-foreground",
] as const;

function NewsImageFallback({ title, category }: { title: string; category?: string }) {
  const normalized = category?.toLowerCase() ?? "";
  const Icon = normalized.includes("government") || normalized.includes("civic")
    ? Landmark
    : normalized.includes("event")
      ? CalendarDays
      : normalized.includes("business")
        ? Store
        : normalized.includes("community")
          ? UsersRound
          : Newspaper;
  let hash = 0;
  for (let index = 0; index < title.length; index++) hash = (hash * 31 + title.charCodeAt(index)) >>> 0;

  return (
    <span
      data-news-image-fallback
      className={cn("flex h-full w-full items-center justify-center", NEWS_TONES[hash % NEWS_TONES.length])}
    >
      <Icon size={22} strokeWidth={1.6} />
    </span>
  );
}
